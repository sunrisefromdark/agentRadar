import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildVerifyDailyResult } from "../action/dailyVerification.ts";
import type { DailyReport, DailyRunSummary } from "../types.ts";

const roots: string[] = [];
const originalCwd = process.cwd();
const date = "2026-06-30";

afterEach(() => {
  process.chdir(originalCwd);
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function setupWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "external-discovery-verification-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "data", "reports"), { recursive: true });
  fs.mkdirSync(path.join(root, "data", "raw", "github"), { recursive: true });
  fs.mkdirSync(path.join(root, "data", "external-discovery"), { recursive: true });
  process.chdir(root);
  return root;
}

function writeJson(filepath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(value, null, 2));
}

function makeSummary(): DailyRunSummary {
  return {
    date,
    generated_at: "2026-06-30T08:00:00.000Z",
    dry_run: true,
    minimum_viable_run_completed: true,
    completion_notes: [],
    counts: {
      raw_signals: 10,
      normalized_projects: 4,
      scored_projects: 4,
      high_score_projects: 2,
      anomaly_projects: 0,
      new_projects: 4,
      classifications: 4,
    },
    source_status: [
      {
        source: "github_trending",
        enabled: true,
        item_count: 10,
        distinct_projects: 4,
        status: "active",
        notes: [],
      },
    ],
    quality: {
      missing_descriptions: 0,
      watchlist_hits: 0,
      low_confidence_projects: 0,
      medium_confidence_projects: 0,
      insufficient_metrics_projects: 0,
      suspicious_growth_projects: 0,
      single_source_projects: 0,
      single_spike_projects: 0,
      emerging_projects: 4,
      persistent_projects: 0,
    },
    diagnostics: {
      anomaly_share: 0,
      uniform_star_velocity_detected: false,
      metrics_source_distribution: { embedded: 0, github_api: 0, github_html: 0, github_cache: 0, unavailable: 0 },
      star_delta_source_distribution: { github_live: 0, github_snapshot: 0, signal: 0, unavailable: 0 },
      github_star_delta: {
        live_delta_attempts: 0,
        live_delta_success: 0,
        snapshot_delta_success: 0,
        token_missing: 0,
        auth_invalid: 0,
        rate_limit: 0,
        network_blocked: 0,
      },
    },
    top_projects: [],
    observer_top_candidates: [],
    watchouts: [],
    next_focus: [],
    recommended_actions: [],
    freshness_sources: [],
    mission_discovery_status: "degraded",
    mission_degraded_reason_codes: ["no_matched_direction"],
  };
}

function makeReport(): DailyReport {
  return {
    date,
    generated_at: "2026-06-30T08:00:00.000Z",
    enhancement_status: "rules-only",
    enhancement_audit: { rejected_outputs: [] },
    personalized_relevance_applicable: false,
    overall_daily_status: "数据新鲜，可直接阅读",
    freshness_sources: [],
    today_fresh_candidate_count: 1,
    context_candidate_count: 1,
    pending_confirmation_count: 0,
    main_board_mode: "fresh_today_only",
    today_star_projects: [],
    context_only_projects: [],
    new_projects: [],
    high_score_projects: [],
    anomaly_projects: [],
    all_projects: [],
    today_pulse_projects: [],
    mission_match_projects: [],
    explore_ribbon_projects: [],
    coverage_atlas: [],
    gap_ledger: [],
    mission_discovery_status: "degraded",
    mission_degraded_reason_codes: ["no_matched_direction"],
    global_hot_projects: [],
    demand_relevant_projects: [],
    searched_direction_statuses: [],
  } as DailyReport;
}

function makeExternalAggregate(namedActorOverrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "external-discovery.aggregate.v1",
    date,
    generated_at: "2026-06-30T08:00:00.000Z",
    provider: "agent-reach",
    status: "ok",
    source_input_hash: "abc123",
    public_safe: true,
    redaction_policy_version: "external-discovery-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    event_count: 1,
    accepted_event_count: 1,
    rejected_event_count: 0,
    platform_counts: { x_twitter: 1 },
    derived_signal_kind_counts: { evidence: 1 },
    project_evidence: [
      {
        evidence_id: "project:openai/agents-sdk",
        event_ids: ["evt-1"],
        scope: "project",
        target_key: "openai/agents-sdk",
        derived_signal_kinds: ["evidence"],
        platforms: ["x_twitter"],
        named_registry_actors: [
          {
            entity_id: "entity-openai",
            display_name: "OpenAI",
            actor_type: "institution",
            registry_tier: "core",
            source_roles: ["social_discussant"],
            event_count: 1,
            platforms: ["x_twitter"],
            first_seen_at: "2026-06-30T00:00:00.000Z",
            last_seen_at: "2026-06-30T00:00:00.000Z",
            ...namedActorOverrides,
          },
        ],
        actor_tiers: { core: 1 },
        actor_types: { institution: 1 },
        mention_count: 1,
        distinct_actor_count: 1,
        top_tier_actor_count: 1,
        first_seen_at: "2026-06-30T00:00:00.000Z",
        last_seen_at: "2026-06-30T00:00:00.000Z",
      },
    ],
    direction_evidence: [],
    observation_candidates: [],
    audit: { rejected_events: [], warnings: [] },
  };
}

function makeCandidateExplanations(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "external-discovery.candidate-explanations.v1",
    date,
    generated_at: "2026-06-30T08:00:00.000Z",
    provider: "rules",
    explanation_policy_version: "candidate-explanations.v1",
    aggregate_source_input_hash: "abc123",
    aggregate_generated_at: "2026-06-30T08:00:00.000Z",
    input_context_hash: "input-hash",
    public_safe: true,
    redaction_policy_version: "external-discovery-explanation-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    status: "partial",
    status_reason: "partial_llm_failure",
    explanations: [
      {
        candidate_key: "project:openai/agents-sdk",
        candidate_kind: "project",
        target_key: "openai/agents-sdk",
        explanation_scope: "external_evidence_boost",
        what_it_is_cn: "OpenAI Agents SDK 是已有候选获得外部补证的对象，目前只确认它在外部来源中再次出现。",
        why_watch_cn: "X 出现该对象的外部讨论，可作为日报或周报的次级证据，适合继续查看证据来源。",
        summary_confidence: "medium",
        summary_source: "rules_fallback",
        evidence_ids: ["project:openai/agents-sdk"],
        platforms: ["x_twitter"],
        caveats: ["外部层不能作为主榜结论，仍需 GitHub / Trendshift 主链路确认。"],
        generated_at: "2026-06-30T08:00:00.000Z",
      },
    ],
    audit: {
      eligible_count: 1,
      attempted_count: 0,
      accepted_count: 1,
      enhanced_count: 0,
      rejected_count: 0,
      fallback_count: 1,
      warnings: [],
    },
    ...overrides,
  };
}

function writeDailyInputs(root: string, externalAggregate: Record<string, unknown>, candidateExplanations?: Record<string, unknown>): void {
  writeJson(path.join(root, "data", "reports", `${date}.run-summary.json`), makeSummary());
  writeJson(path.join(root, "data", "reports", `${date}.daily.json`), makeReport());
  writeJson(path.join(root, "data", "raw", "github", `${date}.enrichment.json`), []);
  writeJson(path.join(root, "data", "external-discovery", `${date}.aggregate.json`), externalAggregate);
  if (candidateExplanations) {
    writeJson(path.join(root, "data", "external-discovery", `${date}.candidate-explanations.json`), candidateExplanations);
  }
}

describe("external discovery daily verification contract", () => {
  it("passes public-safe external aggregates with source roles", () => {
    const root = setupWorkspace();
    writeDailyInputs(root, makeExternalAggregate());

    const result = buildVerifyDailyResult(date);
    const check = result.checks.find((item) => item.name === "external_discovery_aggregate_contract");

    expect(check?.status).toBe("pass");
    expect(check?.detail).toContain("named_actor_rows=1");
  });

  it("fails persisted external aggregates with named actors missing source roles", () => {
    const root = setupWorkspace();
    const aggregate = makeExternalAggregate({ source_roles: undefined });
    writeDailyInputs(root, aggregate);

    const result = buildVerifyDailyResult(date);
    const check = result.checks.find((item) => item.name === "external_discovery_aggregate_contract");

    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("source_roles must be non-empty");
    expect(result.status).toBe("fail");
  });

  it("fails when candidate explanations are missing for an aggregate with accepted events", () => {
    const root = setupWorkspace();
    writeDailyInputs(root, makeExternalAggregate());

    const result = buildVerifyDailyResult(date);
    const check = result.checks.find((item) => item.name === "external_candidate_explanations_contract");

    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("candidate explanations missing");
  });

  it("fails stale candidate explanations with mismatched aggregate hash", () => {
    const root = setupWorkspace();
    writeDailyInputs(root, makeExternalAggregate(), makeCandidateExplanations({ aggregate_source_input_hash: "stale-hash" }));

    const result = buildVerifyDailyResult(date);
    const check = result.checks.find((item) => item.name === "external_candidate_explanations_contract");

    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("aggregate_source_input_hash does not match");
  });

  it("fails persisted aggregates with invalid public actor audit reason", () => {
    const root = setupWorkspace();
    const aggregate = makeExternalAggregate();
    const firstEvidence = (aggregate.project_evidence as Record<string, unknown>[])[0]!;
    firstEvidence.public_actor_audit = [
      {
        platform: "x_twitter",
        status: "missing",
        reason: "actor_public_identity_available",
        event_count: 1,
      },
    ];
    writeDailyInputs(root, aggregate, makeCandidateExplanations());

    const result = buildVerifyDailyResult(date);
    const check = result.checks.find((item) => item.name === "external_discovery_aggregate_contract");

    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("non-available status must not use actor_public_identity_available");
  });

  it("fails persisted aggregates that mark project owners as head discussion actors", () => {
    const root = setupWorkspace();
    const aggregate = makeExternalAggregate();
    const firstEvidence = (aggregate.project_evidence as Record<string, unknown>[])[0]!;
    firstEvidence.public_actors = [
      {
        public_actor_id: "github:anthropics",
        display_name: "GitHub anthropics",
        actor_type: "team",
        actor_role: "project_owner",
        authority_tier: "core",
        tier_basis: "provider_hint",
        is_head_actor: true,
        source_kind: "github_owner",
        source_basis: "target_official_url",
        event_count: 1,
        platforms: ["official_web"],
        first_seen_at: "2026-06-30T00:00:00.000Z",
        last_seen_at: "2026-06-30T00:00:00.000Z",
      },
    ];
    writeDailyInputs(root, aggregate, makeCandidateExplanations());

    const result = buildVerifyDailyResult(date);
    const check = result.checks.find((item) => item.name === "external_discovery_aggregate_contract");

    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("official/project sources cannot be head discussion actors");
  });

  it("fails persisted aggregates that make weak single-source candidates weekly eligible", () => {
    const root = setupWorkspace();
    const aggregate = makeExternalAggregate();
    aggregate.observation_candidates = [
      {
        candidate_kind: "project",
        target_key: "openai/agents-sdk",
        qualification: "needs_primary_confirmation",
        can_enter_daily: false,
        can_enter_weekly: true,
        cannot_be_primary_conclusion: true,
        quality_bucket: "weak_single_source",
        display_bucket: "weak_followup",
        quality_score: 10,
      },
    ];
    writeDailyInputs(root, aggregate, makeCandidateExplanations());

    const result = buildVerifyDailyResult(date);
    const check = result.checks.find((item) => item.name === "external_discovery_aggregate_contract");

    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("weak_single_source must not be weekly eligible");
  });

  it("fails persisted aggregates with candidate quality scores outside 0-100", () => {
    const root = setupWorkspace();
    const aggregate = makeExternalAggregate();
    aggregate.observation_candidates = [
      {
        candidate_kind: "project",
        target_key: "openai/agents-sdk",
        qualification: "needs_primary_confirmation",
        can_enter_daily: true,
        can_enter_weekly: true,
        cannot_be_primary_conclusion: true,
        quality_bucket: "cross_platform_confirmed",
        display_bucket: "project_evidence",
        quality_score: 101,
      },
    ];
    writeDailyInputs(root, aggregate, makeCandidateExplanations());

    const result = buildVerifyDailyResult(date);
    const check = result.checks.find((item) => item.name === "external_discovery_aggregate_contract");

    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("quality_score must be between 0 and 100");
  });
});
