import { describe, expect, it } from "vitest";
import { buildPolicyFinanceGroupHandoff } from "../../../../industry/agents/policy-agent/handoff.ts";

describe("policy-finance group replay handoff", () => {
  it("keeps producer artifact refs aligned across daily handoff packaging", () => {
    const result = buildPolicyFinanceGroupHandoff({
      runId: "run-group-replay-1",
      threadId: "thread-group-replay-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:00:00+08:00",
      finance: {
        runId: "run-group-replay-1",
        threadId: "thread-group-replay-1",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:00:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "finance-replay",
            displayName: "SEC Filing",
            sourceType: "financial_filing",
            authorityTier: "core",
            primarySourceDistance: "primary",
            bucket: "accepted",
            title: "资本主证 replay",
            summaryCn: "finance accepted replay",
            agentRelevanceScore: 0.91,
            agentRelevanceReasons: ["finance-replay"],
          },
        ],
      },
      regulatory: {
        runId: "run-group-replay-1",
        threadId: "thread-group-replay-1",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:00:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "reg-replay",
            displayName: "监管公告",
            sourceType: "policy",
            authorityTier: "core",
            primarySourceDistance: "primary",
            bucket: "accepted",
            title: "监管主证 replay",
            summaryCn: "regulatory accepted replay",
            agentRelevanceScore: 0.9,
            agentRelevanceReasons: ["reg-replay"],
          },
        ],
      },
      thinktank: {
        runId: "run-group-replay-1",
        threadId: "thread-group-replay-1",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:00:00+08:00",
        availableToolIds: ["thinktank-report-registry"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "thinktank-replay",
            displayName: "智库报告",
            sourceType: "thinktank_report",
            authorityTier: "proven",
            primarySourceDistance: "primary",
            bucket: "accepted",
            title: "智库主证 replay",
            summaryCn: "thinktank accepted replay",
            agentRelevanceScore: 0.82,
            agentRelevanceReasons: ["thinktank-replay"],
          },
        ],
      },
    });

    expect(result.dailyInput.payload.source_message_ids).toHaveLength(12);
    expect(result.dailyInput.payload.normalized_event_batch_refs).toEqual([
      result.finance.accepted.manifest.artifact_ref,
      result.regulatory.accepted.manifest.artifact_ref,
      result.thinktank.accepted.manifest.artifact_ref,
    ]);
    expect(result.dailyInput.payload.rejected_event_batch_refs).toEqual([
      result.finance.rejected.manifest.artifact_ref,
      result.regulatory.rejected.manifest.artifact_ref,
      result.thinktank.rejected.manifest.artifact_ref,
    ]);
    expect(result.dailyInput.payload).not.toHaveProperty("events");
    expect(new Set(result.dailyInput.payload.source_message_ids).size).toBe(result.dailyInput.payload.source_message_ids.length);
  });
});
