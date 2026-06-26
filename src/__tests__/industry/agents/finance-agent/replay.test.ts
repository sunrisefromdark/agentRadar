import { describe, expect, it } from "vitest";
import { buildCapitalFinanceHandoff } from "../../../../industry/agents/finance-agent/handoff.ts";
import replayFixture from "../../../../../fixtures/industry/agents/finance-agent/replay/capital-finance-window.json";

describe("finance-agent replay window", () => {
  it("replays the same capital-finance window with stable fallback lineage", () => {
    const input = {
      runId: "run-finance-replay-1",
      threadId: "thread-finance-replay-1",
      windowStart: replayFixture.window_start,
      windowEnd: replayFixture.window_end,
      now: "2026-06-26T16:30:00+08:00",
      availableToolIds: ["licensed-market-discovery"],
      attemptedToolIds: ["licensed-market-discovery"],
      canonicalSourceAvailable: false,
      sources: [
        {
          sourceId: "ir-fallback",
          displayName: "公司 IR 页面",
          sourceType: "funding" as const,
          authorityTier: "proven" as const,
          primarySourceDistance: "near_primary" as const,
          bucket: "accepted" as const,
          title: "IR 侧披露融资窗口进展",
          summaryCn: "fallback 路线下仍保留可 replay 的 accepted lineage。",
          agentRelevanceScore: 0.86,
          agentRelevanceReasons: ["capital-replay"],
        },
      ],
    };

    const firstRun = buildCapitalFinanceHandoff(input);
    const secondRun = buildCapitalFinanceHandoff(input);

    expect(firstRun.coverage.payload.report.active_route_level).toBe(replayFixture.expected_route_level);
    expect(firstRun.accepted.envelope.message_id).toBe(secondRun.accepted.envelope.message_id);
    expect(firstRun.accepted.manifest.artifact_ref).toBe(secondRun.accepted.manifest.artifact_ref);
    expect(
      [
        firstRun.accepted.envelope.message_id,
        firstRun.rejected.envelope.message_id,
        firstRun.coverage.envelope.message_id,
        firstRun.contribution.envelope.message_id,
      ].length,
    ).toBe(replayFixture.expected_source_message_count);
  });
});
