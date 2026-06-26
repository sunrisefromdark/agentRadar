import { describe, expect, it } from "vitest";
import { buildCapitalFinanceHandoff } from "../../../../industry/agents/finance-agent/handoff.ts";

describe("finance-agent official-first routing", () => {
  it("falls back when canonical official source is unavailable and keeps news as rejected context", () => {
    const result = buildCapitalFinanceHandoff({
      runId: "run-finance-1",
      threadId: "thread-finance-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T10:00:00+08:00",
      availableToolIds: ["licensed-market-discovery"],
      attemptedToolIds: ["licensed-market-discovery"],
      canonicalSourceAvailable: false,
      sources: [
        {
          sourceId: "series-c-filing",
          displayName: "投资人关系公告",
          url: "https://example.com/ir",
          sourceType: "funding",
          authorityTier: "proven",
          primarySourceDistance: "near_primary",
          bucket: "accepted",
          title: "某 Agent 公司披露新一轮融资",
          summaryCn: "公司 IR 页面披露融资进展，与 Agent 平台扩张直接相关。",
          actorName: "AgentCo",
          actorType: "company",
          agentRelevanceScore: 0.89,
          agentRelevanceReasons: ["agent-infra-expansion"],
        },
        {
          sourceId: "media-retell",
          displayName: "媒体转述",
          url: "https://example.com/news",
          sourceType: "news",
          authorityTier: "ordinary",
          primarySourceDistance: "secondary",
          bucket: "rejected",
          title: "媒体称融资落地",
          summaryCn: "媒体转述不能抢 owner，只能保留 rejected lineage。",
          actorName: "媒体",
          actorType: "media",
          agentRelevanceScore: 0.4,
          agentRelevanceReasons: ["retell-only"],
          rejectedReason: "media_retell_cannot_claim_owner",
        },
        {
          sourceId: "manual-gap-note",
          displayName: "人工补记",
          sourceType: "news",
          authorityTier: "ordinary",
          primarySourceDistance: "secondary",
          bucket: "diagnostic",
          title: "尚缺官方主证补记",
          summaryCn: "diagnostic 只保留缺口说明，不计入 accepted。",
          agentRelevanceScore: 0.32,
          agentRelevanceReasons: ["gap-note"],
        },
      ],
    });

    expect(result.coverage.payload.report.active_route_level).toBe("fallback_tools");
    expect(result.coverage.payload.report.degraded).toBe(true);
    expect(result.coverage.payload.report.degradation_reason_codes).toContain("no_canonical_source_available");
    expect(result.accepted.payload.events).toHaveLength(1);
    expect(result.diagnostic.payload.events).toHaveLength(1);
    expect(result.rejected.payload.events[0]?.audit.rejected_reason).toBe("media_retell_cannot_claim_owner");
    expect(result.contribution.payload.contribution.event_count).toBe(3);
    expect(result.contribution.payload.contribution.event_count).toBe(
      result.contribution.payload.contribution.accepted_event_count +
        result.contribution.payload.contribution.counter_event_count +
        result.contribution.payload.contribution.diagnostic_event_count +
        result.contribution.payload.contribution.rejected_event_count,
    );
  });
});
