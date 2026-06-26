import { describe, expect, it } from "vitest";
import { buildPolicyRegulatoryHandoff, buildPolicyThinktankHandoff } from "../../../../industry/agents/policy-agent/handoff.ts";

describe("policy-agent axis separation", () => {
  it("keeps regulatory evidence on policy_regulatory and degrades to unavailable when official path is blocked", () => {
    const result = buildPolicyRegulatoryHandoff({
      runId: "run-policy-1",
      threadId: "thread-policy-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T11:00:00+08:00",
      availableToolIds: [],
      attemptedToolIds: [],
      canonicalSourceAvailable: false,
      stopReasonCode: "no_canonical_source_available",
      sources: [
        {
          sourceId: "reg-gap",
          displayName: "监管缺口",
          sourceType: "policy",
          authorityTier: "ordinary",
          primarySourceDistance: "unknown",
          bucket: "diagnostic",
          title: "本轮未找到监管主证",
          summaryCn: "仅留下 needs_review / unavailable 轨迹。",
          agentRelevanceScore: 0.8,
          agentRelevanceReasons: ["policy-core"],
        },
      ],
    });

    expect(result.coverage.payload.report.axis).toBe("policy_regulatory");
    expect(result.coverage.payload.report.active_route_level).toBe("none");
    expect(result.coverage.payload.report.unavailable_state?.reason_code).toBe("no_canonical_source_available");
    expect(result.contribution.payload.contribution.status).toBe("unavailable");
  });

  it("keeps thinktank viewpoints separate from regulatory decisions", () => {
    const result = buildPolicyThinktankHandoff({
      runId: "run-thinktank-1",
      threadId: "thread-thinktank-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T12:00:00+08:00",
      availableToolIds: ["thinktank-report-registry"],
      attemptedToolIds: ["thinktank-report-registry"],
      canonicalSourceAvailable: true,
      sources: [
        {
          sourceId: "thinktank-report",
          displayName: "某智库",
          url: "https://example.com/report",
          sourceType: "thinktank_report",
          authorityTier: "proven",
          primarySourceDistance: "primary",
          bucket: "accepted",
          title: "智库报告判断 Agent 监管将趋严",
          summaryCn: "智库观点可作为 thinktank 轴 accepted，但不是监管结论。",
          actorName: "某智库",
          actorType: "thinktank",
          agentRelevanceScore: 0.78,
          agentRelevanceReasons: ["policy-research"],
        },
      ],
    });

    expect(result.accepted.payload.axis).toBe("policy_research_thinktank");
    expect(result.accepted.payload.events[0]?.responsibility_id).toBe("policy-research-thinktank");
    expect(result.coverage.payload.report.active_source_class).toBe("official_owned_feed_or_doc");
  });
});
