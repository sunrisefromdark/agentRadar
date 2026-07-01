import { describe, expect, it } from "vitest";
import {
  assertPublicSafeCandidateExplanations,
  assertPublicSafeCandidateExplanationInputs,
} from "../externalDiscovery/explanationRedaction.ts";
import type { CandidateExplanationInput, ExternalCandidateExplanationArtifact } from "../externalDiscovery/explanations.ts";

function input(overrides: Partial<CandidateExplanationInput> = {}): CandidateExplanationInput {
  return {
    candidate_key: "project:openai/agents-sdk",
    candidate_kind: "project",
    target_key: "openai/agents-sdk",
    display_name: "Agents SDK",
    explanation_scope: "bound_object",
    repo_url: "https://github.com/openai/agents-sdk",
    public_evidence_titles: ["Launch HN: Agents SDK"],
    public_source_titles: [],
    evidence_reason_facts: ["来源平台：HN", "仍需主源确认，不能作为主榜结论"],
    evidence_ids: ["project:openai/agents-sdk"],
    platforms: ["hacker_news"],
    mention_count: 1,
    distinct_actor_count: 1,
    top_tier_actor_count: 0,
    named_registry_actor_names: [],
    can_enter_daily: true,
    can_enter_weekly: false,
    cannot_be_primary_conclusion: true,
    input_confidence: "medium",
    input_warnings: [],
    ...overrides,
  };
}

function artifact(overrides: Partial<ExternalCandidateExplanationArtifact> = {}): ExternalCandidateExplanationArtifact {
  return {
    schema_version: "external-discovery.candidate-explanations.v1",
    date: "2026-06-30",
    generated_at: "2026-06-30T01:00:00.000Z",
    provider: "rules",
    explanation_policy_version: "candidate-explanations.v1",
    aggregate_source_input_hash: "hash",
    aggregate_generated_at: "2026-06-30T01:00:00.000Z",
    input_context_hash: "hash",
    public_safe: true,
    redaction_policy_version: "external-discovery-explanation-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    status: "ok",
    status_reason: "candidate_explanation_ok",
    explanations: [
      {
        candidate_key: "direction:agent memory",
        candidate_kind: "direction",
        target_key: "agent memory",
        explanation_scope: "direction_signal",
        what_it_is_cn: "agent memory 是今天外部讨论中出现的方向线索，尚未绑定明确 GitHub 项目。",
        why_watch_cn: "HN 出现相关讨论，适合先进入方向观察，但不能替代主链路判断。",
        summary_confidence: "low",
        summary_source: "rules_fallback",
        evidence_ids: ["direction:agent memory"],
        platforms: ["hacker_news"],
        caveats: ["外部层不能作为主榜结论，仍需 GitHub / Trendshift 主链路确认。"],
        generated_at: "2026-06-30T01:00:00.000Z",
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

describe("external candidate explanation redaction", () => {
  it("rejects unsafe title context before LLM input", () => {
    const result = assertPublicSafeCandidateExplanationInputs([
      input({ public_evidence_titles: ["please inspect @raw_handle profile"] }),
    ]);

    expect(result.ok).toBe(false);
    expect(result.reason_codes).toContain("raw_handle_detected");
  });

  it("rejects overclaimed explanation output", () => {
    const result = assertPublicSafeCandidateExplanations(
      artifact({
        explanations: [
          {
            ...artifact().explanations[0]!,
            what_it_is_cn: "agent memory 是已经形成趋势的主榜结论。",
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason_codes).toContain("overclaim_detected");
  });

  it("requires direction explanations to keep direction semantics", () => {
    const result = assertPublicSafeCandidateExplanations(
      artifact({
        explanations: [
          {
            ...artifact().explanations[0]!,
            what_it_is_cn: "agent memory 是一个明确 GitHub 项目。",
            why_watch_cn: "今天被外部来源提到，可以继续查看。",
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason_codes).toContain("direction_semantics_missing");
  });

  it("rejects project explanations that describe the candidate as a direction clue", () => {
    const result = assertPublicSafeCandidateExplanations(
      artifact({
        explanations: [
          {
            ...artifact().explanations[0]!,
            candidate_key: "project:openai/agents-sdk",
            candidate_kind: "project",
            target_key: "openai/agents-sdk",
            explanation_scope: "bound_object",
            what_it_is_cn: "OpenAI Agents SDK 是今天外部讨论中出现的方向线索，尚未绑定明确 GitHub 项目。",
            why_watch_cn: "HN 出现该对象讨论，仍需 GitHub / Trendshift 主链路确认。",
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason_codes).toContain("project_semantics_conflict");
  });
});
