import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../config.ts";
import type { ExternalSignalEvent } from "../externalDiscovery/types.ts";
import type { ScoredProject } from "../types.ts";

const structuredEnhancementMock = vi.hoisted(() => vi.fn());

vi.mock("../action/enhancementLlm.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../action/enhancementLlm.ts")>();
  return {
    ...actual,
    callStructuredEnhancement: structuredEnhancementMock,
  };
});

const { buildDailyExternalAggregate } = await import("../externalDiscovery/aggregate.ts");
const { buildCandidateExplanationInputs, generateExternalCandidateExplanations } = await import("../externalDiscovery/explanations.ts");
const { assertPublicSafeCandidateExplanations } = await import("../externalDiscovery/explanationRedaction.ts");

function config(): AppConfig {
  return {
    llm: {
      enabled: true,
      mode: "semantic-classification",
      provider: "deepseek",
    },
  } as AppConfig;
}

function event(overrides: Partial<ExternalSignalEvent> = {}): ExternalSignalEvent {
  return {
    event_id: "evt-1",
    platform: "hacker_news",
    raw_event_kind: "discussion",
    derived_signal_kinds: ["discovery"],
    scope: "project",
    target_type: "project",
    target_key: "owner/project-a",
    actor: { actor_type: "community", effective_tier: "ordinary", tier_basis: "none" },
    observed_at: "2026-06-30T00:00:00.000Z",
    raw_ref: "provider:event:1",
    ...overrides,
  };
}

describe("external candidate explanation duplicate handling", () => {
  it("downgrades duplicate enhanced summaries instead of failing the whole artifact", async () => {
    structuredEnhancementMock.mockResolvedValueOnce({
      explanations: [
        {
          candidate_key: "project:owner/project-a",
          what_it_is_cn: "这是一个用于构建 AI 工作流的项目候选。",
          why_watch_cn: "外部来源出现讨论，适合作为次级证据继续观察。",
          summary_confidence: "medium",
          caveats: ["仍需主链路确认。"],
        },
        {
          candidate_key: "project:owner/project-b",
          what_it_is_cn: "这是一个用于构建 AI 工作流的项目候选。",
          why_watch_cn: "外部来源出现讨论，适合作为次级证据继续观察。",
          summary_confidence: "medium",
          caveats: ["仍需主链路确认。"],
        },
      ],
    });

    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event(),
        event({
          event_id: "evt-2",
          target_key: "owner/project-b",
          raw_ref: "provider:event:2",
        }),
      ],
    });
    const scoredProjects = [
      {
        project: {
          repo_full_name: "owner/project-a",
          repo_url: "https://github.com/owner/project-a",
          project_name: "Project A",
          description: "Build AI workflow automation.",
        },
      },
      {
        project: {
          repo_full_name: "owner/project-b",
          repo_url: "https://github.com/owner/project-b",
          project_name: "Project B",
          description: "Coordinate AI workflow agents.",
        },
      },
    ] as ScoredProject[];
    const inputBuild = buildCandidateExplanationInputs({ aggregate, scoredProjects });

    const artifact = await generateExternalCandidateExplanations({
      aggregate,
      inputBuild,
      config: config(),
      generatedAt: "2026-06-30T02:00:00.000Z",
    });

    expect(artifact.status).toBe("partial");
    expect(artifact.audit.enhanced_count).toBe(1);
    expect(artifact.audit.fallback_count).toBe(1);
    expect(artifact.audit.warnings.map((warning) => warning.reason_code)).toContain("duplicate_summary_fallback");
    expect(assertPublicSafeCandidateExplanations(artifact).ok).toBe(true);
  });
});
