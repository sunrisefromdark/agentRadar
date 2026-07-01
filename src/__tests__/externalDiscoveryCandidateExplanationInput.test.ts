import { describe, expect, it } from "vitest";
import { buildCandidateExplanationInputs } from "../externalDiscovery/explanations.ts";
import type { DailyExternalAggregate, ExternalSignalEvent } from "../externalDiscovery/types.ts";
import { buildDailyExternalAggregate } from "../externalDiscovery/aggregate.ts";
import type { ProjectLibraryEnhancementArtifact, ScoredProject } from "../types.ts";

function event(overrides: Partial<ExternalSignalEvent> = {}): ExternalSignalEvent {
  return {
    event_id: "evt-1",
    platform: "hacker_news",
    raw_event_kind: "discussion",
    derived_signal_kinds: ["evidence"],
    scope: "project",
    target_type: "project",
    target_key: "openai/agents-sdk",
    actor: { actor_type: "community", effective_tier: "ordinary", tier_basis: "none" },
    observed_at: "2026-06-30T00:00:00.000Z",
    raw_ref: "provider:event:1",
    ...overrides,
  };
}

function aggregate(events: ExternalSignalEvent[]): DailyExternalAggregate {
  return buildDailyExternalAggregate({
    date: "2026-06-30",
    generated_at: "2026-06-30T01:00:00.000Z",
    events,
  });
}

describe("external candidate explanation input builder", () => {
  it("builds project inputs from aggregate evidence and existing project brief", () => {
    const projectLibraryArtifact: ProjectLibraryEnhancementArtifact = {
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      provider: "deepseek",
      entries: [
        {
          repo_full_name: "openai/agents-sdk",
          project_brief_cn: "OpenAI Agents SDK 是用于构建和编排智能体工作流的开发工具包。",
          source: "agent",
          provider: "deepseek",
          generated_at: "2026-06-30T01:00:00.000Z",
        },
      ],
    };
    const scored = [
      {
        project: {
          repo_full_name: "openai/agents-sdk",
          repo_url: "https://github.com/openai/agents-sdk",
          project_name: "Agents SDK",
          description: "Build agentic workflows with tools and handoffs.",
        },
      },
    ] as ScoredProject[];

    const result = buildCandidateExplanationInputs({
      aggregate: aggregate([event()]),
      titleContext: [
        {
          event_id: "evt-1",
          target_key: "openai/agents-sdk",
          target_display_name: "Agents SDK",
          public_evidence_title: "Launch HN: Agents SDK",
          source_platform: "hacker_news",
        },
      ],
      scoredProjects: scored,
      projectLibraryArtifact,
    });

    expect(result.inputs[0]).toMatchObject({
      candidate_key: "project:openai/agents-sdk",
      explanation_scope: "external_evidence_boost",
      input_confidence: "high",
      existing_project_brief_cn: "OpenAI Agents SDK 是用于构建和编排智能体工作流的开发工具包。",
      repo_description: "Build agentic workflows with tools and handoffs.",
    });
    expect(result.input_context_hash).toHaveLength(64);
  });

  it("keeps direction evidence as direction_signal and lowers confidence when title context is missing", () => {
    const result = buildCandidateExplanationInputs({
      aggregate: aggregate([
        event({
          event_id: "direction-1",
          scope: "direction",
          target_type: "topic",
          target_key: "agent memory evaluation workflows",
          derived_signal_kinds: ["discovery"],
        }),
      ]),
    });

    expect(result.inputs[0]).toMatchObject({
      candidate_key: "direction:agent memory evaluation workflows",
      explanation_scope: "direction_signal",
      input_confidence: "low",
    });
    expect(result.warnings.map((item) => item.reason_code)).toContain("public_title_context_missing");
    expect(result.warnings.map((item) => item.reason_code)).toContain("direction_candidate_low_confidence");
  });
});
