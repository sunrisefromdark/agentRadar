import { describe, expect, it } from "vitest";
import { buildDailyExternalAggregate } from "../externalDiscovery/aggregate.ts";
import {
  buildCandidateExplanationInputs,
  generateExternalCandidateExplanations,
} from "../externalDiscovery/explanations.ts";
import type { AppConfig } from "../config.ts";
import type { ExternalSignalEvent } from "../externalDiscovery/types.ts";
import type { ProjectLibraryEnhancementArtifact } from "../types.ts";

function config(enabled: boolean): AppConfig {
  return {
    llm: {
      enabled,
      mode: enabled ? "semantic-classification" : "rules-only",
      provider: enabled ? "deepseek" : "none",
    },
  } as AppConfig;
}

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

describe("external candidate explanations", () => {
  it("uses existing project brief as enhanced source without calling LLM", async () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [event()],
    });
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
    const inputBuild = buildCandidateExplanationInputs({ aggregate, projectLibraryArtifact });

    const artifact = await generateExternalCandidateExplanations({
      aggregate,
      inputBuild,
      config: config(true),
      generatedAt: "2026-06-30T02:00:00.000Z",
    });

    expect(artifact.status).toBe("ok");
    expect(artifact.audit.enhanced_count).toBe(1);
    expect(artifact.explanations[0]).toMatchObject({
      summary_source: "existing_project_brief",
      what_it_is_cn: "OpenAI Agents SDK 是用于构建和编排智能体工作流的开发工具包。",
    });
  });

  it("does not mark all-rules fallback output as ok", async () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event({
          event_id: "direction-1",
          scope: "direction",
          target_type: "topic",
          target_key: "agent memory evaluation workflows",
          derived_signal_kinds: ["discovery"],
        }),
      ],
    });
    const inputBuild = buildCandidateExplanationInputs({ aggregate });

    const artifact = await generateExternalCandidateExplanations({
      aggregate,
      inputBuild,
      config: config(true),
      generatedAt: "2026-06-30T02:00:00.000Z",
    });

    expect(artifact.status).toBe("failed");
    expect(artifact.audit.enhanced_count).toBe(0);
    expect(artifact.audit.fallback_count).toBe(1);
    expect(artifact.explanations[0]?.what_it_is_cn).toContain("方向线索");
  });

  it("marks LLM disabled artifacts as skipped while keeping fallback explanations", async () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [event()],
    });
    const inputBuild = buildCandidateExplanationInputs({ aggregate });

    const artifact = await generateExternalCandidateExplanations({
      aggregate,
      inputBuild,
      config: config(false),
      generatedAt: "2026-06-30T02:00:00.000Z",
    });

    expect(artifact.status).toBe("skipped");
    expect(artifact.status_reason).toBe("llm_disabled");
    expect(artifact.explanations[0]?.summary_source).toBe("rules_fallback");
  });
});
