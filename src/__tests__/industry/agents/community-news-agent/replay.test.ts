import { describe, expect, it } from "vitest";
import { buildProductEcosystemHandoff } from "../../../../industry/agents/community-news-agent/handoff.ts";

describe("product ecosystem handoff replay", () => {
  it("keeps daily draft refs stable for the same input window", () => {
    const input = {
      runId: "run-ecosystem-replay",
      threadId: "thread-ecosystem-replay",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:40:00+08:00",
      canonicalSourceAvailable: true,
      productPlatform: {
        runId: "run-ecosystem-replay",
        threadId: "thread-ecosystem-replay",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:40:00+08:00",
        canonicalSourceAvailable: true,
        availableToolIds: ["vendor-release-notes-feed"],
        sources: [],
      },
      developerStudio: {
        runId: "run-ecosystem-replay",
        threadId: "thread-ecosystem-replay",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:40:00+08:00",
        canonicalSourceAvailable: true,
        availableToolIds: ["developer-docs-changelog"],
        sources: [],
      },
      projectOss: {
        runId: "run-ecosystem-replay",
        threadId: "thread-ecosystem-replay",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:40:00+08:00",
        canonicalSourceAvailable: true,
        availableToolIds: ["github-release-feed"],
        sources: [],
      },
      cnCommunity: {
        runId: "run-ecosystem-replay",
        threadId: "thread-ecosystem-replay",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:40:00+08:00",
        canonicalSourceAvailable: true,
        responsibilityId: "cn-community" as const,
        availableToolIds: ["cn-community-original-thread-index"],
        sources: [],
      },
      globalCommunity: {
        runId: "run-ecosystem-replay",
        threadId: "thread-ecosystem-replay",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:40:00+08:00",
        canonicalSourceAvailable: true,
        responsibilityId: "global-community" as const,
        availableToolIds: ["global-community-original-thread-index"],
        sources: [],
      },
      newsPr: {
        runId: "run-ecosystem-replay",
        threadId: "thread-ecosystem-replay",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:40:00+08:00",
        canonicalSourceAvailable: true,
        availableToolIds: ["news-pr-narrative-index"],
        sources: [],
      },
    };

    const first = buildProductEcosystemHandoff(input);
    const second = buildProductEcosystemHandoff(input);

    expect(first.dailyInput.envelope.message_id).toBe(second.dailyInput.envelope.message_id);
    expect(first.dailyInput.manifest.artifact_ref).toBe(second.dailyInput.manifest.artifact_ref);
    expect(first.dailyInput.payload.coverage_refs).toHaveLength(5);
    expect(first.dailyInput.payload.contribution_refs).toHaveLength(6);
    expect(first.dailyInput.payload.normalized_event_batch_refs).toHaveLength(6);
  });
});
