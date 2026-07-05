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
          sourceFamily: "policy_regulatory_filing",
          authorityTier: "ordinary",
          primarySourceDistance: "unknown",
          accessMode: "unavailable",
          costTier: "unknown",
          reviewStatus: "unavailable",
          missingSourceFamilies: ["policy_standards_body", "policy_public_procurement"],
          bucket: "diagnostic",
          title: "本轮未找到监管主证",
          summaryCn: "仅留下 needs_review / unavailable 轨迹。",
          policySignalKind: "regulatory_attention",
          agentRelevanceScore: 0.8,
          agentRelevanceReasons: ["policy-core"],
        },
      ],
    });

    expect(result.coverage.payload.report.axis).toBe("policy_regulatory");
    expect(result.coverage.payload.report.active_route_level).toBe("none");
    expect(result.coverage.payload.report.unavailable_state?.reason_code).toBe("no_canonical_source_available");
    expect(result.coverage.payload.report.primary_tool_ids).toEqual(
      expect.arrayContaining(["official-regulator-rss", "standards-body-docs", "public-procurement-notices"]),
    );
    expect(result.coverage.payload.report.missing_source_families).toEqual(["policy_standards_body", "policy_public_procurement"]);
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
          sourceFamily: "thinktank_oecd_ai",
          authorityTier: "proven",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "OECD.AI",
          bucket: "accepted",
          title: "智库报告判断 Agent 监管将趋严",
          summaryCn: "智库观点可作为 thinktank 轴 accepted，但不是监管结论。",
          policySignalKind: "thinktank_viewpoint",
          actorName: "某智库",
          actorType: "thinktank",
          agentRelevanceScore: 0.78,
          agentRelevanceReasons: ["policy-research"],
        },
      ],
    });

    expect(result.accepted.payload.axis).toBe("policy_research_thinktank");
    expect(result.accepted.payload.events[0]?.responsibility_id).toBe("policy-research-thinktank");
    expect(result.accepted.payload.events[0]?.source.named_source).toBe("OECD.AI");
    expect(result.accepted.payload.events[0]?.evidence.policy_signal_kind).toBe("thinktank_viewpoint");
    expect(result.coverage.payload.report.active_source_class).toBe("official_owned_feed_or_doc");
    expect(result.coverage.payload.report.named_sources_present).toEqual(["OECD.AI"]);
  });

  it("rejects semantic misalignment when thinktank viewpoint is routed through policy_regulatory", () => {
    expect(() =>
      buildPolicyRegulatoryHandoff({
        runId: "run-policy-2",
        threadId: "thread-policy-2",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T12:30:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "misrouted-thinktank",
            displayName: "某智库",
            sourceType: "policy",
            sourceFamily: "policy_government_announcement",
            authorityTier: "proven",
            primarySourceDistance: "primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "active",
            bucket: "accepted",
            title: "错误地把智库观点塞进监管轴",
            summaryCn: "这应该被本组 producer 拒绝。",
            policySignalKind: "thinktank_viewpoint",
            agentRelevanceScore: 0.72,
            agentRelevanceReasons: ["misroute-check"],
          },
        ],
      }),
    ).toThrow(/cannot use thinktank_viewpoint/);
  });

  it("accepts the required policy semantic categories on the correct source families", () => {
    const regulatory = buildPolicyRegulatoryHandoff({
      runId: "run-policy-3",
      threadId: "thread-policy-3",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T13:00:00+08:00",
      availableToolIds: ["official-regulator-rss", "public-procurement-notices", "approval-bulletins"],
      canonicalSourceAvailable: true,
      sources: [
        {
          sourceId: "reg-attention",
          displayName: "监管文件",
          sourceType: "policy",
          sourceFamily: "policy_regulatory_filing",
          authorityTier: "core",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "FTC",
          bucket: "accepted",
          title: "监管关注",
          summaryCn: "监管关注",
          policySignalKind: "regulatory_attention",
          agentRelevanceScore: 0.84,
          agentRelevanceReasons: ["attention"],
        },
        {
          sourceId: "policy-window",
          displayName: "标准组织",
          sourceType: "policy",
          sourceFamily: "policy_standards_body",
          authorityTier: "proven",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "ISO/IEC JTC 1 SC 42",
          bucket: "accepted",
          title: "政策空间",
          summaryCn: "政策空间",
          policySignalKind: "policy_window",
          agentRelevanceScore: 0.8,
          agentRelevanceReasons: ["window"],
        },
        {
          sourceId: "official-support",
          displayName: "官方项目",
          sourceType: "policy",
          sourceFamily: "policy_official_project",
          authorityTier: "core",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "White House OSTP",
          bucket: "accepted",
          title: "官方支持",
          summaryCn: "官方支持",
          policySignalKind: "official_support",
          agentRelevanceScore: 0.89,
          agentRelevanceReasons: ["support"],
        },
        {
          sourceId: "approval",
          displayName: "审批公示",
          sourceType: "policy",
          sourceFamily: "policy_approval",
          authorityTier: "core",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "EU AI Office",
          bucket: "accepted",
          title: "确定审批",
          summaryCn: "确定审批",
          policySignalKind: "confirmed_approval",
          agentRelevanceScore: 0.91,
          agentRelevanceReasons: ["approval"],
        },
        {
          sourceId: "procurement",
          displayName: "公共采购",
          sourceType: "policy",
          sourceFamily: "policy_public_procurement",
          authorityTier: "core",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "SAM.gov",
          bucket: "accepted",
          title: "公共采购",
          summaryCn: "公共采购",
          policySignalKind: "public_procurement",
          agentRelevanceScore: 0.86,
          agentRelevanceReasons: ["procurement"],
        },
        {
          sourceId: "risk-warning",
          displayName: "风险提示",
          sourceType: "policy",
          sourceFamily: "policy_government_announcement",
          authorityTier: "core",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "NIST",
          bucket: "accepted",
          title: "风险提示",
          summaryCn: "风险提示",
          policySignalKind: "risk_warning",
          agentRelevanceScore: 0.82,
          agentRelevanceReasons: ["risk-warning"],
        },
      ],
    });

    const thinktank = buildPolicyThinktankHandoff({
      runId: "run-policy-4",
      threadId: "thread-policy-4",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T13:10:00+08:00",
      availableToolIds: ["thinktank-report-registry", "oecd-ai-policy-observatory", "rand-ai-research"],
      canonicalSourceAvailable: true,
      sources: [
        {
          sourceId: "thinktank-view",
          displayName: "RAND",
          sourceType: "thinktank_report",
          sourceFamily: "thinktank_rand",
          authorityTier: "proven",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "RAND",
          bucket: "accepted",
          title: "智库观点",
          summaryCn: "智库观点",
          policySignalKind: "thinktank_viewpoint",
          agentRelevanceScore: 0.78,
          agentRelevanceReasons: ["thinktank"],
        },
      ],
    });

    expect(regulatory.accepted.payload.events.map((event) => event.evidence.policy_signal_kind)).toEqual([
      "regulatory_attention",
      "policy_window",
      "official_support",
      "confirmed_approval",
      "public_procurement",
      "risk_warning",
    ]);
    expect(thinktank.accepted.payload.events[0]?.evidence.policy_signal_kind).toBe("thinktank_viewpoint");
  });

  it("covers named thinktank sources including OECD.AI, CSET, Brookings, and Stanford AI Index", () => {
    const thinktank = buildPolicyThinktankHandoff({
      runId: "run-policy-5",
      threadId: "thread-policy-5",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T13:20:00+08:00",
      availableToolIds: [
        "thinktank-report-registry",
        "oecd-ai-policy-observatory",
        "cset-policy-briefs",
        "stanford-ai-index",
        "brookings-ai-research",
      ],
      canonicalSourceAvailable: true,
      sources: [
        {
          sourceId: "oecd-thinktank",
          displayName: "OECD.AI",
          sourceType: "thinktank_report",
          sourceFamily: "thinktank_oecd_ai",
          authorityTier: "proven",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "OECD.AI",
          bucket: "accepted",
          title: "OECD.AI 观点",
          summaryCn: "OECD.AI 原始报告。",
          policySignalKind: "thinktank_viewpoint",
          agentRelevanceScore: 0.81,
          agentRelevanceReasons: ["oecd"],
        },
        {
          sourceId: "cset-thinktank",
          displayName: "CSET",
          sourceType: "thinktank_report",
          sourceFamily: "thinktank_cset",
          authorityTier: "proven",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "CSET",
          bucket: "accepted",
          title: "CSET 观点",
          summaryCn: "CSET 原始报告。",
          policySignalKind: "thinktank_viewpoint",
          agentRelevanceScore: 0.8,
          agentRelevanceReasons: ["cset"],
        },
        {
          sourceId: "stanford-index",
          displayName: "Stanford AI Index",
          sourceType: "thinktank_report",
          sourceFamily: "thinktank_stanford_ai_index",
          authorityTier: "proven",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "Stanford AI Index",
          bucket: "accepted",
          title: "Stanford AI Index 观点",
          summaryCn: "Stanford AI Index 原始报告。",
          policySignalKind: "thinktank_viewpoint",
          agentRelevanceScore: 0.82,
          agentRelevanceReasons: ["stanford"],
        },
        {
          sourceId: "brookings-thinktank",
          displayName: "Brookings",
          sourceType: "thinktank_report",
          sourceFamily: "thinktank_brookings",
          authorityTier: "proven",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "Brookings",
          bucket: "accepted",
          title: "Brookings 观点",
          summaryCn: "Brookings 原始报告。",
          policySignalKind: "thinktank_viewpoint",
          agentRelevanceScore: 0.79,
          agentRelevanceReasons: ["brookings"],
        },
      ],
    });

    expect(thinktank.accepted.payload.events.map((event) => event.source.source_family)).toEqual([
      "thinktank_oecd_ai",
      "thinktank_cset",
      "thinktank_stanford_ai_index",
      "thinktank_brookings",
    ]);
    expect(thinktank.coverage.payload.report.named_sources_present).toEqual([
      "OECD.AI",
      "CSET",
      "Stanford AI Index",
      "Brookings",
    ]);
    expect(thinktank.coverage.payload.report.primary_tool_ids).toEqual(
      expect.arrayContaining([
        "oecd-ai-policy-observatory",
        "cset-policy-briefs",
        "stanford-ai-index",
        "brookings-ai-research",
      ]),
    );
  });

  it("rejects generic accepted policy evidence and missing audit fields", () => {
    expect(() =>
      buildPolicyRegulatoryHandoff({
        runId: "run-policy-6",
        threadId: "thread-policy-6",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:30:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "generic-accepted-policy",
            displayName: "政策解读",
            sourceType: "news",
            sourceFamily: "generic_news",
            authorityTier: "ordinary",
            primarySourceDistance: "secondary",
            accessMode: "public",
            costTier: "low",
            reviewStatus: "watch",
            bucket: "accepted",
            title: "不能把泛政策新闻直接当监管主证",
            summaryCn: "应要求显式 policy source family。",
            policySignalKind: "regulatory_attention",
            agentRelevanceScore: 0.6,
            agentRelevanceReasons: ["generic-news"],
          },
        ],
      }),
    ).toThrow(/axis-specific sourceFamily/);

    expect(() =>
      buildPolicyThinktankHandoff({
        runId: "run-policy-7",
        threadId: "thread-policy-7",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:31:00+08:00",
        availableToolIds: ["thinktank-report-registry"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "missing-policy-audit",
            displayName: "OECD.AI",
            sourceType: "thinktank_report",
            sourceFamily: "thinktank_oecd_ai",
            authorityTier: "proven",
            primarySourceDistance: "primary",
            namedSource: "OECD.AI",
            bucket: "accepted",
            title: "accepted thinktank 事件缺少审计字段",
            summaryCn: "producer 应拒绝这类不完整输出。",
            policySignalKind: "thinktank_viewpoint",
            agentRelevanceScore: 0.82,
            agentRelevanceReasons: ["missing-audit"],
          },
        ],
      }),
    ).toThrow(/missing required audit fields/);
  });

  it("rejects excluded or rumor-grade policy evidence from accepted facts", () => {
    expect(() =>
      buildPolicyRegulatoryHandoff({
        runId: "run-policy-8",
        threadId: "thread-policy-8",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:32:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "excluded-policy",
            displayName: "SEO 政策聚合页",
            sourceType: "policy",
            sourceFamily: "policy_government_announcement",
            authorityTier: "excluded",
            primarySourceDistance: "secondary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "watch",
            namedSource: "Unknown Aggregator",
            bucket: "accepted",
            title: "被排除政策来源不应进入 accepted",
            summaryCn: "excluded 来源只能拒收或留痕。",
            policySignalKind: "regulatory_attention",
            agentRelevanceScore: 0.3,
            agentRelevanceReasons: ["excluded"],
          },
        ],
      }),
    ).toThrow(/authorityTier=excluded/);

    expect(() =>
      buildPolicyThinktankHandoff({
        runId: "run-policy-9",
        threadId: "thread-policy-9",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:33:00+08:00",
        availableToolIds: ["thinktank-report-registry"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "rumor-policy",
            displayName: "未证实智库传闻",
            sourceType: "thinktank_report",
            sourceFamily: "thinktank_oecd_ai",
            authorityTier: "ordinary",
            primarySourceDistance: "rumor",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "watch",
            namedSource: "OECD.AI",
            bucket: "accepted",
            title: "传闻级政策研究不能进入 accepted",
            summaryCn: "rumor 级别只能作为 rejected/diagnostic。",
            policySignalKind: "thinktank_viewpoint",
            agentRelevanceScore: 0.25,
            agentRelevanceReasons: ["rumor"],
          },
        ],
      }),
    ).toThrow(/primarySourceDistance=rumor/);
  });

  it("rejects accepted policy evidence when no route is available", () => {
    expect(() =>
      buildPolicyRegulatoryHandoff({
        runId: "run-policy-10",
        threadId: "thread-policy-10",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:34:00+08:00",
        availableToolIds: [],
        canonicalSourceAvailable: false,
        stopReasonCode: "no_canonical_source_available",
        sources: [
          {
            sourceId: "impossible-accepted-policy",
            displayName: "Federal Register",
            sourceType: "policy",
            sourceFamily: "policy_government_announcement",
            authorityTier: "core",
            primarySourceDistance: "primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "Federal Register",
            bucket: "accepted",
            title: "无路由时不应还能 accepted",
            summaryCn: "route none 只能留 rejected/diagnostic。",
            policySignalKind: "official_support",
            agentRelevanceScore: 0.91,
            agentRelevanceReasons: ["route-none"],
          },
        ],
      }),
    ).toThrow(/cannot emit accepted\/counter evidence when no route is available/);
  });

  it("rejects policy accepted evidence that is still unavailable or waiting for human exception", () => {
    expect(() =>
      buildPolicyRegulatoryHandoff({
        runId: "run-policy-11",
        threadId: "thread-policy-11",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:35:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "unavailable-policy",
            displayName: "Federal Register",
            sourceType: "policy",
            sourceFamily: "policy_government_announcement",
            authorityTier: "core",
            primarySourceDistance: "primary",
            accessMode: "unavailable",
            costTier: "unknown",
            reviewStatus: "unavailable",
            namedSource: "Federal Register",
            bucket: "accepted",
            title: "不可用政策来源不能进 accepted",
            summaryCn: "unavailable 应只留在 gap 轨迹。",
            policySignalKind: "official_support",
            agentRelevanceScore: 0.9,
            agentRelevanceReasons: ["unavailable"],
          },
        ],
      }),
    ).toThrow(/accessMode=unavailable/);

    expect(() =>
      buildPolicyThinktankHandoff({
        runId: "run-policy-12",
        threadId: "thread-policy-12",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:36:00+08:00",
        availableToolIds: ["thinktank-report-registry"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "human-exception-policy",
            displayName: "OECD.AI",
            sourceType: "thinktank_report",
            sourceFamily: "thinktank_oecd_ai",
            authorityTier: "proven",
            primarySourceDistance: "primary",
            accessMode: "human_exception",
            costTier: "high",
            reviewStatus: "needs_review",
            humanExceptionRequired: true,
            namedSource: "OECD.AI",
            bucket: "accepted",
            title: "等待人工例外的政策研究不能进 accepted",
            summaryCn: "human exception required 应只留在 diagnostic。",
            policySignalKind: "thinktank_viewpoint",
            agentRelevanceScore: 0.79,
            agentRelevanceReasons: ["human-exception"],
          },
        ],
      }),
    ).toThrow(/humanExceptionRequired=true/);
  });

  it("rejects policy accepted evidence in last_resort_mode", () => {
    expect(() =>
      buildPolicyRegulatoryHandoff({
        runId: "run-policy-13",
        threadId: "thread-policy-13",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:37:00+08:00",
        availableToolIds: ["manual-regulatory-triage"],
        canonicalSourceAvailable: false,
        stopReasonCode: "no_canonical_source_available",
        sources: [
          {
            sourceId: "last-resort-policy",
            displayName: "手工政策记录",
            sourceType: "policy",
            sourceFamily: "policy_government_announcement",
            authorityTier: "proven",
            primarySourceDistance: "near_primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "Federal Register",
            bucket: "accepted",
            title: "last resort 不该还能 accepted",
            summaryCn: "weak signal only 路径只能留 rejected/diagnostic。",
            policySignalKind: "official_support",
            agentRelevanceScore: 0.82,
            agentRelevanceReasons: ["last-resort"],
          },
        ],
      }),
    ).toThrow(/cannot emit accepted\/counter evidence in last_resort_mode/);
  });

  it("rejects deprecated policy evidence from accepted facts", () => {
    expect(() =>
      buildPolicyRegulatoryHandoff({
        runId: "run-policy-14",
        threadId: "thread-policy-14",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:38:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "deprecated-policy",
            displayName: "旧监管公告",
            sourceType: "policy",
            sourceFamily: "policy_government_announcement",
            authorityTier: "proven",
            primarySourceDistance: "primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "deprecated",
            namedSource: "Federal Register",
            bucket: "accepted",
            title: "废弃政策来源不能进 accepted",
            summaryCn: "deprecated 只能留背景或缺口。",
            policySignalKind: "official_support",
            agentRelevanceScore: 0.72,
            agentRelevanceReasons: ["deprecated"],
          },
        ],
      }),
    ).toThrow(/reviewStatus=deprecated/);
  });

  it("rejects policy accepted evidence that still carries rejectedReason", () => {
    expect(() =>
      buildPolicyRegulatoryHandoff({
        runId: "run-policy-15",
        threadId: "thread-policy-15",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:39:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "accepted-policy-with-rejected-reason",
            displayName: "Federal Register",
            sourceType: "policy",
            sourceFamily: "policy_government_announcement",
            authorityTier: "core",
            primarySourceDistance: "primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "Federal Register",
            bucket: "accepted",
            title: "accepted 不应带 rejectedReason",
            summaryCn: "rejectedReason 只应存在于 rejected bucket。",
            policySignalKind: "official_support",
            agentRelevanceScore: 0.92,
            agentRelevanceReasons: ["lineage-cleanliness"],
            rejectedReason: "should-not-be-here",
          },
        ],
      }),
    ).toThrow(/cannot carry rejectedReason/);
  });

  it("rejects policy and thinktank accepted evidence that degrades to ordinary or secondary sourcing", () => {
    expect(() =>
      buildPolicyRegulatoryHandoff({
        runId: "run-policy-16",
        threadId: "thread-policy-16",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:40:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "ordinary-policy",
            displayName: "二手政策解读",
            sourceType: "policy",
            sourceFamily: "policy_government_announcement",
            authorityTier: "ordinary",
            primarySourceDistance: "near_primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "Federal Register",
            bucket: "accepted",
            title: "ordinary 政策来源不能进 accepted",
            summaryCn: "政策 accepted 必须保持高质量 authority。",
            policySignalKind: "official_support",
            agentRelevanceScore: 0.7,
            agentRelevanceReasons: ["ordinary"],
          },
        ],
      }),
    ).toThrow(/authorityTier=ordinary/);

    expect(() =>
      buildPolicyThinktankHandoff({
        runId: "run-policy-17",
        threadId: "thread-policy-17",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T13:41:00+08:00",
        availableToolIds: ["thinktank-report-registry"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "secondary-thinktank",
            displayName: "二手智库摘编",
            sourceType: "thinktank_report",
            sourceFamily: "thinktank_oecd_ai",
            authorityTier: "proven",
            primarySourceDistance: "secondary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "OECD.AI",
            bucket: "accepted",
            title: "secondary 智库摘编不能进 accepted",
            summaryCn: "智库 accepted 必须保持原始报告距离。",
            policySignalKind: "thinktank_viewpoint",
            agentRelevanceScore: 0.75,
            agentRelevanceReasons: ["secondary"],
          },
        ],
      }),
    ).toThrow(/must stay primary\/near_primary/);
  });
});
