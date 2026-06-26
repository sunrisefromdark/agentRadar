import { describe, expect, it } from "vitest";
import { buildCapitalFinanceHandoff } from "../../../../industry/agents/finance-agent/handoff.ts";
import antiUpgradeFixture from "../../../../../fixtures/industry/agents/finance-agent/anti-upgrade/capital-heat-without-cross-confirmation.json" with { type: "json" };
import officialFirstFixture from "../../../../../fixtures/industry/agents/finance-agent/official-first/canonical-miss-fallback.json" with { type: "json" };
import ownerBoundaryFixture from "../../../../../fixtures/industry/agents/finance-agent/owner-boundary/news-retell-does-not-own.json" with { type: "json" };

describe("finance-agent negative cases", () => {
  it("keeps anti-upgrade and owner-boundary evidence out of accepted owner facts", () => {
    const result = buildCapitalFinanceHandoff({
      runId: "run-finance-negative-1",
      threadId: "thread-finance-negative-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T16:10:00+08:00",
      availableToolIds: ["manual-finance-triage"],
      canonicalSourceAvailable: false,
      stopPolicy: { canonicalSourceAvailable: false },
      sources: [
        {
          sourceId: "capital-hype",
          displayName: "资本热稿",
          sourceType: "news",
          authorityTier: "ordinary",
          primarySourceDistance: "secondary",
          bucket: "rejected",
          title: "资本热但缺官方文件",
          summaryCn: "不能仅凭资本热度升级。",
          agentRelevanceScore: 0.44,
          agentRelevanceReasons: ["anti-upgrade"],
          rejectedReason: antiUpgradeFixture.expected_rejected_reason,
        },
        {
          sourceId: "news-retell",
          displayName: "媒体转述",
          sourceType: "news",
          authorityTier: "ordinary",
          primarySourceDistance: "secondary",
          bucket: "rejected",
          title: "新闻转述融资",
          summaryCn: "新闻转述不能抢 owner。",
          agentRelevanceScore: 0.41,
          agentRelevanceReasons: ["owner-boundary"],
          rejectedReason: ownerBoundaryFixture.expected_rejected_reason,
        },
      ],
    });

    expect(result.coverage.payload.report.active_route_level).toBe("last_resort_mode");
    expect(result.coverage.payload.report.degraded).toBe(antiUpgradeFixture.expected_degraded);
    expect(result.coverage.payload.report.degradation_reason_codes).toContain("manual_last_resort_only");
    expect(result.coverage.payload.report.degradation_reason_codes).toContain(officialFirstFixture.expected_reason_codes[0]);
    expect(result.accepted.payload.events).toHaveLength(0);
    expect(result.rejected.payload.events.map((item) => item.audit.rejected_reason)).toEqual([
      antiUpgradeFixture.expected_rejected_reason,
      ownerBoundaryFixture.expected_rejected_reason,
    ]);
  });

  it("downgrades to review-safe state when timeout budget is exhausted", () => {
    const result = buildCapitalFinanceHandoff({
      runId: "run-finance-negative-2",
      threadId: "thread-finance-negative-2",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T16:20:00+08:00",
      availableToolIds: ["licensed-market-discovery"],
      attemptedToolIds: ["sec-edgar-api", "licensed-market-discovery"],
      canonicalSourceAvailable: false,
      budgetExceeded: true,
      stopPolicy: {
        timeoutBudgetExhausted: true,
        canonicalSourceAvailable: false,
      },
      sources: [
        {
          sourceId: "budget-stop",
          displayName: "预算耗尽记录",
          sourceType: "news",
          authorityTier: "ordinary",
          primarySourceDistance: "secondary",
          bucket: "diagnostic",
          title: "预算已耗尽，转入 needs_review",
          summaryCn: "高成本官方抓取本轮停止。",
          agentRelevanceScore: 0.52,
          agentRelevanceReasons: ["budget-stop"],
        },
      ],
    });

    expect(result.coverage.payload.report.budget_status.budget_exceeded).toBe(true);
    expect(result.coverage.payload.report.degradation_reason_codes).toContain("budget_exceeded");
    expect(result.coverage.payload.report.degradation_reason_codes).toContain("timeout_budget_exhausted");
    expect(result.contribution.payload.contribution.status_reason).toBe("timeout_budget_exhausted");
    expect(result.diagnostic.payload.events).toHaveLength(1);
  });
});
