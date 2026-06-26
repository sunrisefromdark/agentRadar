import { describe, expect, it } from "vitest";
import { buildPolicyFinanceGroupHandoff } from "../../../../industry/agents/policy-agent/handoff.ts";

describe("policy-finance negative fixtures", () => {
  it("keeps official-first failure and anti-upgrade evidence as degraded or rejected", () => {
    const result = buildPolicyFinanceGroupHandoff({
      runId: "run-negative-1",
      threadId: "thread-negative-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T15:00:00+08:00",
      finance: {
        runId: "run-negative-1",
        threadId: "thread-negative-1",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T15:00:00+08:00",
        availableToolIds: ["manual-finance-triage"],
        canonicalSourceAvailable: false,
        stopPolicy: { canonicalSourceAvailable: false },
        sources: [
          {
            sourceId: "finance-hype",
            displayName: "媒体热稿",
            sourceType: "news",
            authorityTier: "ordinary",
            primarySourceDistance: "secondary",
            bucket: "rejected",
            title: "资本热度高但缺官方文件",
            summaryCn: "不满足 cross confirmation，不可升级为核心趋势。",
            agentRelevanceScore: 0.45,
            agentRelevanceReasons: ["anti-upgrade"],
            rejectedReason: "official_first_not_met",
          },
        ],
      },
      regulatory: {
        runId: "run-negative-1",
        threadId: "thread-negative-1",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T15:00:00+08:00",
        availableToolIds: ["policy-domain-search"],
        canonicalSourceAvailable: false,
        stopReasonCode: "no_canonical_source_available",
        sources: [
          {
            sourceId: "policy-hot",
            displayName: "政策解读",
            sourceType: "news",
            authorityTier: "ordinary",
            primarySourceDistance: "secondary",
            bucket: "rejected",
            title: "政策关注高但无监管正文",
            summaryCn: "只能保留反例与诊断。",
            agentRelevanceScore: 0.5,
            agentRelevanceReasons: ["anti-upgrade"],
            rejectedReason: "news_cannot_replace_regulator_primary",
          },
        ],
      },
      thinktank: {
        runId: "run-negative-1",
        threadId: "thread-negative-1",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T15:00:00+08:00",
        availableToolIds: ["thinktank-domain-search"],
        canonicalSourceAvailable: false,
        stopReasonCode: "no_canonical_source_available",
        sources: [
          {
            sourceId: "thinktank-opinion",
            displayName: "智库评论",
            sourceType: "thinktank_report",
            authorityTier: "watch",
            primarySourceDistance: "near_primary",
            bucket: "diagnostic",
            title: "智库观点强但不是监管结论",
            summaryCn: "需要与政策主证拆账。",
            agentRelevanceScore: 0.7,
            agentRelevanceReasons: ["anti-upgrade"],
          },
        ],
      },
    });

    expect(result.finance.coverage.payload.report.degraded).toBe(true);
    expect(result.finance.rejected.payload.events[0]?.audit.rejected_reason).toBe("official_first_not_met");
    expect(result.regulatory.rejected.payload.events[0]?.audit.rejected_reason).toBe("news_cannot_replace_regulator_primary");
    expect(result.thinktank.diagnostic.payload.events[0]?.axis).toBe("policy_research_thinktank");
  });
});
