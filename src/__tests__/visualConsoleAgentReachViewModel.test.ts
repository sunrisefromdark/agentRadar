import { describe, expect, it } from "vitest";
import { buildAgentReachDisplayModel } from "../visualConsole/agentReachViewModel.ts";
import {
  makeAgentReachCandidateExplanationsArtifact,
  makeEmptyAgentReachAggregate,
  makeFailedAgentReachAggregate,
  makeOkAgentReachAggregate,
  makePartialAgentReachAggregate,
} from "./visualConsoleAgentReachFixtures.ts";

describe("AgentReach display view-model", () => {
  it("maps candidates through evidence ids instead of reading candidate.platforms", () => {
    const model = buildAgentReachDisplayModel({
      aggregate: makeOkAgentReachAggregate(),
      aggregatePath: "data/external-discovery/2026-06-29.aggregate.json",
      aggregateReadStatus: "ok",
    });

    const candidate = model.candidates.find((item) => item.candidate_id === "cand-agentflow");
    expect(candidate).toBeTruthy();
    expect(candidate?.platform_labels).toEqual(["X", "Reddit"]);
    expect(candidate?.source_count).toBe(2);
    expect(candidate?.distinct_actor_count).toBe(3);
    expect(candidate?.public_actors.map((actor) => actor.display_name)).toEqual(["@acme", "r/LocalLLaMA"]);
    expect(candidate?.type_label).toBe("新发现");
    expect(candidate?.external_attention_label).toBe("72");
    expect(candidate?.cannot_be_primary_conclusion).toBe(true);
    expect(candidate?.intro_line).toContain("GitHub repo");
    expect(candidate?.appearance_reason).toContain("外部层候选");
    expect(candidate?.why_watch_reasons).toContain("外部关注度 72");
    expect(candidate?.why_watch_reasons).toContain("跨平台出现，噪声风险低于单平台讨论");
    expect(candidate?.confirmation_gaps).toContain("仍需 GitHub / Trendshift 主链路确认");
  });

  it("uses matched backend candidate explanations when artifact is safe and current", () => {
    const model = buildAgentReachDisplayModel({
      aggregate: makeOkAgentReachAggregate(),
      candidateExplanations: makeAgentReachCandidateExplanationsArtifact(),
      aggregateReadStatus: "ok",
      candidateExplanationsReadStatus: "ok",
    });

    const candidate = model.candidates.find((item) => item.candidate_id === "cand-agentflow");
    expect(candidate?.intro_line).toBe("AgentFlow 是一个已绑定 GitHub repo 的工作流自动化项目候选。");
    expect(candidate?.appearance_reason).toBe("X 和 Reddit 同时讨论 AgentFlow，适合作为外部层新发现继续观察。");
    expect(candidate?.why_watch_reasons[0]).toBe("X 和 Reddit 同时讨论 AgentFlow，适合作为外部层新发现继续观察。");
    expect(candidate?.confirmation_gaps).toContain("仍需 GitHub 主链路确认活跃度。");
  });

  it("matches backend object-kind candidate_key before target_key fallback", () => {
    const model = buildAgentReachDisplayModel({
      aggregate: makeOkAgentReachAggregate(),
      candidateExplanations: makeAgentReachCandidateExplanationsArtifact({
        explanations: [
          {
            candidate_key: "project:https://github.com/acme/agentflow",
            candidate_kind: "project",
            target_key: "https://github.com/acme/agentflow",
            explanation_scope: "bound_object",
            what_it_is_cn: "AgentFlow 通过真实后端 project 主键直接命中。",
            why_watch_cn: "直接主键命中不应受重复 target_key 兜底限制影响。",
            summary_confidence: "medium",
            summary_source: "llm",
            evidence_ids: ["ev-agentflow"],
            platforms: ["x_twitter"],
            caveats: ["仍需主链路确认。"],
            generated_at: "2026-06-29T08:10:00.000Z",
          },
          {
            candidate_key: "alternate:https://github.com/acme/agentflow",
            candidate_kind: "project",
            target_key: "https://github.com/acme/agentflow",
            explanation_scope: "bound_object",
            what_it_is_cn: "重复 target_key 的备用说明。",
            why_watch_cn: "只能用于证明兜底被阻断。",
            summary_confidence: "medium",
            summary_source: "llm",
            evidence_ids: ["ev-agentflow"],
            platforms: ["reddit"],
            caveats: [],
            generated_at: "2026-06-29T08:10:00.000Z",
          },
        ],
      }),
      aggregateReadStatus: "ok",
      candidateExplanationsReadStatus: "ok",
    });

    expect(model.candidates.find((item) => item.candidate_id === "cand-agentflow")?.intro_line).toBe(
      "AgentFlow 通过真实后端 project 主键直接命中。",
    );
  });

  it("ignores stale backend explanations and keeps rule fallback", () => {
    const model = buildAgentReachDisplayModel({
      aggregate: makeOkAgentReachAggregate(),
      candidateExplanations: makeAgentReachCandidateExplanationsArtifact({
        aggregate_source_input_hash: "stale-hash",
      }),
      aggregateReadStatus: "ok",
      candidateExplanationsReadStatus: "ok",
    });

    const candidate = model.candidates.find((item) => item.candidate_id === "cand-agentflow");
    expect(candidate?.intro_line).toContain("GitHub repo");
    expect(candidate?.intro_line).not.toContain("工作流自动化项目候选");
    expect(model.warnings).toContain("candidate explanations ignored: aggregate source hash mismatch");
  });

  it("keeps candidates visible when backend explanations are missing", () => {
    const model = buildAgentReachDisplayModel({
      aggregate: makeOkAgentReachAggregate(),
      aggregateReadStatus: "ok",
      candidateExplanationsReadStatus: "not_found",
    });

    expect(model.candidates).toHaveLength(2);
    expect(model.candidates[0]?.why_watch_reasons.length).toBeGreaterThan(0);
    expect(model.warnings.join(" ")).not.toContain("candidate explanations ignored");
  });

  it("splits fallback evidence candidates into discovery and evidence buckets", () => {
    const aggregate = makeEmptyAgentReachAggregate();
    aggregate.accepted_event_count = 3;
    aggregate.project_evidence = [
      {
        evidence_id: "ev-new-project",
        event_ids: ["event-new-project"],
        scope: "project",
        target_key: "owner/new-agent",
        derived_signal_kinds: ["discovery"],
        direction_labels: [],
        platforms: ["official_web"],
        named_registry_actors: [],
        actor_tiers: { ordinary: 1 },
        actor_types: { team: 1 },
        mention_count: 1,
        distinct_actor_count: 1,
        top_tier_actor_count: 0,
        first_seen_at: "2026-07-05T10:00:00.000Z",
        last_seen_at: "2026-07-05T10:00:00.000Z",
        active_day_count: 1,
        cross_platform: false,
        authority_summary_cn: "",
        intensity_summary_cn: "",
        persistence_summary_cn: "",
        caveats: [],
      },
      {
        evidence_id: "ev-existing-project",
        event_ids: ["event-existing-project"],
        scope: "project",
        target_key: "owner/existing-agent",
        derived_signal_kinds: ["discovery", "evidence"],
        direction_labels: [],
        platforms: ["hacker_news"],
        named_registry_actors: [],
        actor_tiers: { ordinary: 1 },
        actor_types: { person: 1 },
        mention_count: 1,
        distinct_actor_count: 1,
        top_tier_actor_count: 0,
        first_seen_at: "2026-07-05T10:00:00.000Z",
        last_seen_at: "2026-07-05T10:00:00.000Z",
        active_day_count: 1,
        cross_platform: false,
        authority_summary_cn: "",
        intensity_summary_cn: "",
        persistence_summary_cn: "",
        caveats: [],
      },
    ];
    aggregate.direction_evidence = [
      {
        evidence_id: "ev-direction",
        event_ids: ["event-direction"],
        scope: "direction",
        target_key: "agent-topic",
        derived_signal_kinds: ["discovery", "evidence"],
        direction_labels: [],
        platforms: ["reddit"],
        named_registry_actors: [],
        actor_tiers: { ordinary: 1 },
        actor_types: { community: 1 },
        mention_count: 1,
        distinct_actor_count: 1,
        top_tier_actor_count: 0,
        first_seen_at: "2026-07-05T10:00:00.000Z",
        last_seen_at: "2026-07-05T10:00:00.000Z",
        active_day_count: 1,
        cross_platform: false,
        authority_summary_cn: "",
        intensity_summary_cn: "",
        persistence_summary_cn: "",
        caveats: [],
      },
    ];

    const model = buildAgentReachDisplayModel({
      aggregate,
      aggregateReadStatus: "ok",
      candidateExplanationsReadStatus: "not_found",
    });

    expect(model.candidates.map((candidate) => candidate.type_key).sort()).toEqual([
      "direction_watch",
      "new_discovery",
      "project_evidence",
    ]);
    expect(model.summary_cards.find((card) => card.key === "new_discoveries")?.value).toBe(1);
    expect(model.summary_cards.find((card) => card.key === "project_evidence")?.value).toBe(1);
    expect(model.summary_cards.find((card) => card.key === "direction_observations")?.value).toBe(1);
    expect(model.candidates.find((candidate) => candidate.display_name === "owner/new-agent")?.target_url).toBe(
      "https://github.com/owner/new-agent",
    );
    expect(model.candidates.find((candidate) => candidate.display_name === "owner/existing-agent")?.target_url).toBe(
      "https://github.com/owner/existing-agent",
    );
    expect(model.candidates.find((candidate) => candidate.display_name === "agent-topic")?.target_url).toBeNull();
  });

  it("falls back to a unique target_key explanation when candidate_key does not match", () => {
    const model = buildAgentReachDisplayModel({
      aggregate: makeOkAgentReachAggregate(),
      candidateExplanations: makeAgentReachCandidateExplanationsArtifact({
        explanations: [
          {
            candidate_key: "missing-kind:https://github.com/acme/agentflow",
            candidate_kind: "project",
            target_key: "https://github.com/acme/agentflow",
            explanation_scope: "bound_object",
            what_it_is_cn: "AgentFlow 的 target_key 唯一命中说明。",
            why_watch_cn: "唯一 target_key 可安全兜底到当前候选。",
            summary_confidence: "medium",
            summary_source: "llm",
            evidence_ids: ["ev-agentflow"],
            platforms: ["x_twitter"],
            caveats: ["仍需主链路确认。"],
            generated_at: "2026-06-29T08:10:00.000Z",
          },
        ],
      }),
      aggregateReadStatus: "ok",
      candidateExplanationsReadStatus: "ok",
    });

    expect(model.candidates.find((item) => item.candidate_id === "cand-agentflow")?.intro_line).toBe(
      "AgentFlow 的 target_key 唯一命中说明。",
    );
  });

  it("does not use target_key fallback when explanations for the same target are duplicated", () => {
    const model = buildAgentReachDisplayModel({
      aggregate: makeOkAgentReachAggregate(),
      candidateExplanations: makeAgentReachCandidateExplanationsArtifact({
        explanations: [
          {
            candidate_key: "missing-a:https://github.com/acme/agentflow",
            candidate_kind: "project",
            target_key: "https://github.com/acme/agentflow",
            explanation_scope: "bound_object",
            what_it_is_cn: "重复兜底说明 A。",
            why_watch_cn: "不应该被使用。",
            summary_confidence: "medium",
            summary_source: "llm",
            evidence_ids: ["ev-agentflow"],
            platforms: ["x_twitter"],
            caveats: [],
            generated_at: "2026-06-29T08:10:00.000Z",
          },
          {
            candidate_key: "missing-b:https://github.com/acme/agentflow",
            candidate_kind: "project",
            target_key: "https://github.com/acme/agentflow",
            explanation_scope: "bound_object",
            what_it_is_cn: "重复兜底说明 B。",
            why_watch_cn: "也不应该被使用。",
            summary_confidence: "medium",
            summary_source: "llm",
            evidence_ids: ["ev-agentflow"],
            platforms: ["reddit"],
            caveats: [],
            generated_at: "2026-06-29T08:10:00.000Z",
          },
        ],
      }),
      aggregateReadStatus: "ok",
      candidateExplanationsReadStatus: "ok",
    });

    const candidate = model.candidates.find((item) => item.candidate_id === "cand-agentflow");
    expect(candidate?.intro_line).not.toContain("重复兜底说明");
    expect(candidate?.intro_line).toContain("GitHub repo");
  });

  it("guards explanation scope so direction text cannot override project candidates", () => {
    const model = buildAgentReachDisplayModel({
      aggregate: makeOkAgentReachAggregate(),
      candidateExplanations: makeAgentReachCandidateExplanationsArtifact({
        explanations: [
          {
            candidate_key: "project:https://github.com/acme/agentflow",
            candidate_kind: "direction",
            target_key: "https://github.com/acme/agentflow",
            explanation_scope: "direction_signal",
            what_it_is_cn: "错误的方向说明。",
            why_watch_cn: "不应该覆盖项目候选。",
            summary_confidence: "low",
            summary_source: "llm",
            evidence_ids: ["ev-agentflow"],
            platforms: ["x_twitter"],
            caveats: [],
            generated_at: "2026-06-29T08:10:00.000Z",
          },
        ],
      }),
      aggregateReadStatus: "ok",
      candidateExplanationsReadStatus: "ok",
    });

    const candidate = model.candidates.find((item) => item.candidate_id === "cand-agentflow");
    expect(candidate?.intro_line).not.toContain("错误的方向说明");
    expect(candidate?.intro_line).toContain("GitHub repo");
  });

  it("guards explanation scope so bound-object text cannot override direction candidates", () => {
    const aggregate = makeOkAgentReachAggregate();
    aggregate.observation_candidates.push({
      candidate_id: "cand-workflow-direction",
      scope: "direction",
      candidate_kind: "direction_watch",
      target_type: "topic",
      target_key: "workflow-automation-agent",
      display_name: "workflow automation agent discussion",
      direction_labels: ["workflow-automation-agent"],
      binding_confidence: "unbound",
      evidence_ids: ["ev-workflow-direction"],
      evidence_summary_cn: "方向讨论，尚未绑定明确 repo。",
      qualification: "observe",
      can_enter_daily: false,
      can_enter_weekly: true,
      cannot_be_primary_conclusion: true,
      caveats: ["方向线索不能作为项目级结论。"],
      external_attention_score: 58,
      display_bucket: "direction_observations",
      display_reasons: ["topic-level direction observation kept secondary"],
    });

    const model = buildAgentReachDisplayModel({
      aggregate,
      candidateExplanations: makeAgentReachCandidateExplanationsArtifact({
        explanations: [
          {
            candidate_key: "direction:workflow-automation-agent",
            candidate_kind: "project",
            target_key: "workflow-automation-agent",
            explanation_scope: "bound_object",
            what_it_is_cn: "错误的项目说明。",
            why_watch_cn: "不应该覆盖方向候选。",
            summary_confidence: "medium",
            summary_source: "llm",
            evidence_ids: ["ev-workflow-direction"],
            platforms: ["x_twitter"],
            caveats: [],
            generated_at: "2026-06-29T08:10:00.000Z",
          },
        ],
      }),
      aggregateReadStatus: "ok",
      candidateExplanationsReadStatus: "ok",
    });

    const direction = model.candidates.find((item) => item.candidate_id === "cand-workflow-direction");
    expect(direction?.intro_line).not.toContain("错误的项目说明");
    expect(direction?.intro_line).toContain("方向线索");
    expect(direction?.intro_line).toContain("尚未绑定明确 GitHub 项目");
  });

  it("merges repeated candidates for the same external target into one display card", () => {
    const aggregate = makeOkAgentReachAggregate();
    const baseSource = aggregate.evidence_sources![0]!;
    const baseEvidence = aggregate.project_evidence[0]!;
    const baseCandidate = aggregate.observation_candidates[0]!;

    aggregate.evidence_sources!.push({
      ...baseSource,
      source_id: "src-x-duplicate",
      event_id: "event-x-duplicate",
      source_title: "Second AgentFlow launch discussion",
      metrics: {
        likes: 7,
      },
    });
    aggregate.project_evidence.push({
      ...baseEvidence,
      evidence_id: "ev-agentflow-duplicate",
      event_ids: ["event-x-duplicate"],
      platforms: ["x_twitter"],
      mention_count: 1,
      distinct_actor_count: 1,
      cross_platform: false,
    });
    aggregate.observation_candidates.push({
      ...baseCandidate,
      candidate_id: "cand-agentflow-duplicate",
      evidence_ids: ["ev-agentflow-duplicate"],
      external_attention_score: 75,
    });

    const model = buildAgentReachDisplayModel({ aggregate, aggregateReadStatus: "ok" });
    const agentFlowCandidates = model.candidates.filter((item) => item.target_key === "https://github.com/acme/agentflow");

    expect(agentFlowCandidates).toHaveLength(1);
    expect(agentFlowCandidates[0]?.evidence_count).toBe(2);
    expect(agentFlowCandidates[0]?.source_count).toBe(3);
    expect(agentFlowCandidates[0]?.external_attention_label).toBe("75");
    expect(agentFlowCandidates[0]?.source_cards.map((item) => item.source_id)).toContain("src-x-duplicate");
  });

  it("merges similar unbound direction listicles into one display card", () => {
    const aggregate = makeOkAgentReachAggregate();
    const baseSource = aggregate.evidence_sources![0]!;
    const baseEvidence = aggregate.direction_evidence[0]!;
    const titles = [
      "5 OPEN SOURCE AI REPOS THAT BLEW UP ON GITHUB THIS WEEK 1. MinerU https://t.co/a 2. voicebox https://t.co/b",
      "5 OPEN SOURCE AI REPOS WORTH SAVING THIS WEEK 1. MinerU turns PDFs into markdown 2. voicebox local AI voice studio",
      "5 OPEN SOURCE AI REPOS THAT BLEW UP ON GITHUB THIS WEEK 1. MinerU (https://t.co/c) 2. voicebox (https://t.co/d)",
    ];

    titles.forEach((title, index) => {
      const suffix = String(index + 1);
      aggregate.evidence_sources!.push({
        ...baseSource,
        source_id: `src-open-repos-${suffix}`,
        event_id: `event-open-repos-${suffix}`,
        platform: "x_twitter",
        source_title: title,
        source_url: `https://x.com/i/status/open-repos-${suffix}`,
        target_type: "topic",
        target_name: title,
        direction_labels: ["hr-agent"],
        actor_type: "unknown",
        actor_tier: "unknown",
        metrics: {
          likes: 10 + index,
        },
      });
      aggregate.direction_evidence.push({
        ...baseEvidence,
        evidence_id: `ev-open-repos-${suffix}`,
        event_ids: [`event-open-repos-${suffix}`],
        scope: "direction",
        target_key: `open-source-ai-repos-${suffix}`,
        platforms: ["x_twitter"],
        mention_count: 1,
        distinct_actor_count: 1,
        cross_platform: false,
      });
      aggregate.observation_candidates.push({
        candidate_id: `cand-open-repos-${suffix}`,
        scope: "direction",
        candidate_kind: "direction_watch",
        target_type: "topic",
        target_key: `open-source-ai-repos-${suffix}`,
        display_name: title,
        direction_labels: ["hr-agent"],
        binding_confidence: "unbound",
        evidence_ids: [`ev-open-repos-${suffix}`],
        evidence_summary_cn: "direction-only listicle signal",
        qualification: "observe",
        can_enter_daily: true,
        can_enter_weekly: false,
        cannot_be_primary_conclusion: true,
        caveats: ["direction signal only"],
        external_attention_score: index === 0 ? 57 : 41 + index,
        display_bucket: "direction_observations",
        display_reasons: ["direction-only listicle signal"],
      });
    });

    const model = buildAgentReachDisplayModel({ aggregate, aggregateReadStatus: "ok" });
    const listicleCandidates = model.candidates.filter((item) => item.display_name.includes("OPEN SOURCE AI REPOS"));

    expect(listicleCandidates).toHaveLength(1);
    expect(listicleCandidates[0]?.evidence_count).toBe(3);
    expect(listicleCandidates[0]?.source_count).toBe(3);
    expect(listicleCandidates[0]?.external_attention_label).toBe("57");
    expect(listicleCandidates[0]?.source_cards.map((item) => item.source_id)).toEqual([
      "src-open-repos-1",
      "src-open-repos-2",
      "src-open-repos-3",
    ]);
  });

  it("keeps source cards on real ExternalEvidenceSource fields only", () => {
    const model = buildAgentReachDisplayModel({
      aggregate: makeOkAgentReachAggregate(),
      aggregateReadStatus: "ok",
    });

    const source = model.candidates[0]?.source_cards.find((item) => item.platform === "reddit");
    expect(source?.source_published_at).toBe("2026-06-29T05:30:00.000Z");
    expect(source?.observed_at).toBe("2026-06-29T07:05:00.000Z");
    expect(source?.metrics.map((item) => item.key)).toEqual(["comments", "upvotes", "replies"]);
    expect(source?.metrics.map((item) => item.key)).not.toContain("points");
  });

  it("separates partial, failed and empty semantics", () => {
    const partial = buildAgentReachDisplayModel({ aggregate: makePartialAgentReachAggregate(), aggregateReadStatus: "ok" });
    const failed = buildAgentReachDisplayModel({ aggregate: makeFailedAgentReachAggregate(), aggregateReadStatus: "ok" });
    const empty = buildAgentReachDisplayModel({ aggregate: makeEmptyAgentReachAggregate(), aggregateReadStatus: "ok" });

    expect(partial.status.label).toBe("partial");
    expect(partial.coverage.find((item) => item.platform === "x_twitter")?.status_label).toBe("部分可用");
    expect(partial.coverage.find((item) => item.platform === "reddit")?.status_label).toBe("正常");

    expect(failed.status.label).toBe("failed");
    expect(failed.status.reason).toContain("provider failed");
    expect(failed.candidates).toHaveLength(0);
    expect(failed.coverage.find((item) => item.platform === "x_twitter")?.status_label).toBe("失败");

    expect(empty.status.label).toBe("ok");
    expect(empty.candidates).toHaveLength(0);
    expect(empty.coverage.find((item) => item.platform === "x_twitter")?.status_label).toBe("已执行但无相关结果");
  });

  it("uses daily section fallback without fabricating source cards", () => {
    const aggregate = makeOkAgentReachAggregate();
    const model = buildAgentReachDisplayModel({
      aggregate: null,
      aggregateReadStatus: "not_found",
      dailySection: {
        external_layer_status: {
          status: "ok",
          status_reason: "daily fallback",
          accepted_event_count: 1,
          rejected_event_count: 0,
        },
        external_observation_candidates: aggregate.observation_candidates.slice(0, 1),
        external_project_evidence_summaries: aggregate.project_evidence.slice(0, 1),
        direction_label_counts: aggregate.direction_label_counts ?? {},
        external_audit_summary: {
          coverage: aggregate.audit.coverage,
          warnings: [],
        },
      },
    });

    expect(model.status.data_source).toBe("daily-section");
    expect(model.candidates[0]?.source_count).toBe(0);
    expect(model.warnings).toContain("来源明细不可用");
  });

  it("explains direction candidates without pretending they are bound projects", () => {
    const aggregate = makeOkAgentReachAggregate();
    aggregate.observation_candidates.push({
      candidate_id: "cand-workflow-direction",
      scope: "direction",
      candidate_kind: "direction_watch",
      target_type: "topic",
      target_key: "workflow-automation-agent",
      display_name: "workflow automation agent discussion",
      direction_labels: ["workflow-automation-agent"],
      binding_confidence: "unbound",
      evidence_ids: ["ev-workflow-direction"],
      evidence_summary_cn: "方向讨论，尚未绑定明确 repo。",
      qualification: "observe",
      can_enter_daily: false,
      can_enter_weekly: true,
      cannot_be_primary_conclusion: true,
      caveats: ["方向线索不能作为项目级结论。"],
      external_attention_score: 58,
      display_bucket: "direction_observations",
      display_reasons: ["topic-level direction observation kept secondary"],
    });

    const model = buildAgentReachDisplayModel({ aggregate, aggregateReadStatus: "ok" });
    const direction = model.candidates.find((item) => item.candidate_id === "cand-workflow-direction");

    expect(direction?.intro_line).toContain("方向线索");
    expect(direction?.intro_line).toContain("尚未绑定明确 GitHub 项目");
    expect(direction?.appearance_reason).toContain("方向级讨论");
    expect(direction?.why_watch_reasons).toContain("方向线索可用于后续趋势观察");
    expect(direction?.confirmation_gaps).toContain("尚未绑定明确 GitHub 项目或论文");
    expect(direction?.why_watch_reasons.join(" ")).not.toContain("高置信推荐");
  });

  it("explains project evidence as external support for an existing candidate", () => {
    const aggregate = makeOkAgentReachAggregate();
    const baseCandidate = aggregate.observation_candidates[0]!;
    aggregate.observation_candidates.push({
      ...baseCandidate,
      candidate_id: "cand-agentflow-evidence",
      candidate_kind: "external_evidence_boost",
      display_bucket: "project_evidence",
      qualification: "supporting_evidence_only",
      external_attention_score: 64,
    });

    const model = buildAgentReachDisplayModel({ aggregate, aggregateReadStatus: "ok" });
    const evidenceCandidate = model.candidates.find((item) => item.candidate_id === "cand-agentflow-evidence");

    expect(evidenceCandidate?.type_key).toBe("project_evidence");
    expect(evidenceCandidate?.intro_line).toContain("已有候选获得外部补证");
    expect(evidenceCandidate?.appearance_reason).toContain("外部补证");
    expect(evidenceCandidate?.confirmation_gaps.join(" ")).not.toContain("高置信推荐");
  });
});
