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
          sourceFamily: "finance_investor_relations",
          authorityTier: "proven",
          primarySourceDistance: "near_primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "Investor Relations",
          bucket: "accepted",
          title: "某 Agent 公司披露新一轮融资",
          summaryCn: "公司 IR 页面披露融资进展，与 Agent 平台扩张直接相关。",
          financeSignalKind: "capital_allocation",
          optionalPaidSourceFamilies: ["finance_industry_data"],
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
          sourceFamily: "finance_funding_news",
          authorityTier: "ordinary",
          primarySourceDistance: "secondary",
          accessMode: "public",
          costTier: "low",
          reviewStatus: "watch",
          bucket: "rejected",
          title: "媒体称融资落地",
          summaryCn: "媒体转述不能抢 owner，只能保留 rejected lineage。",
          financeSignalKind: "financing_heat",
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
          sourceFamily: "generic_context",
          authorityTier: "ordinary",
          primarySourceDistance: "secondary",
          accessMode: "human_exception",
          costTier: "high",
          reviewStatus: "needs_review",
          humanExceptionRequired: true,
          bucket: "diagnostic",
          title: "尚缺官方主证补记",
          summaryCn: "diagnostic 只保留缺口说明，不计入 accepted。",
          missingSourceFamilies: ["finance_sec_filing", "finance_earnings_call_transcript"],
          agentRelevanceScore: 0.32,
          agentRelevanceReasons: ["gap-note"],
        },
      ],
    });

    expect(result.coverage.payload.report.active_route_level).toBe("fallback_tools");
    expect(result.coverage.payload.report.degraded).toBe(true);
    expect(result.coverage.payload.report.degradation_reason_codes).toContain("no_canonical_source_available");
    expect(result.coverage.payload.report.primary_tool_ids).toContain("sec-edgar-api");
    expect(result.coverage.payload.report.fallback_tool_ids).toContain("licensed-market-discovery");
    expect(result.coverage.payload.report.source_families_present).toEqual(
      expect.arrayContaining(["finance_investor_relations", "finance_funding_news"]),
    );
    expect(result.coverage.payload.report.access_modes_present).toEqual(expect.arrayContaining(["public", "human_exception"]));
    expect(result.coverage.payload.report.optional_paid_source_families).toEqual(["finance_industry_data"]);
    expect(result.coverage.payload.report.missing_source_families).toEqual([
      "finance_sec_filing",
      "finance_earnings_call_transcript",
    ]);
    expect(result.coverage.payload.report.human_exception_required).toBe(true);
    expect(result.accepted.payload.events).toHaveLength(1);
    expect(result.accepted.payload.events[0]?.source.source_family).toBe("finance_investor_relations");
    expect(result.accepted.payload.events[0]?.evidence.finance_signal_kind).toBe("capital_allocation");
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

  it("rejects accepted finance events that do not declare a finance semantic kind", () => {
    expect(() =>
      buildCapitalFinanceHandoff({
        runId: "run-finance-2",
        threadId: "thread-finance-2",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T10:10:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "missing-finance-kind",
            displayName: "上市公司公告",
            sourceType: "financial_filing",
            sourceFamily: "finance_public_company_announcement",
            authorityTier: "core",
            primarySourceDistance: "primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "active",
            bucket: "accepted",
            title: "缺 financeSignalKind 的 accepted finance 事件",
            summaryCn: "producer 应拒绝这类不完整语义。",
            agentRelevanceScore: 0.91,
            agentRelevanceReasons: ["semantic-completeness"],
          },
        ],
      }),
    ).toThrow(/missing financeSignalKind/);
  });

  it("accepts all required finance semantic categories when source families line up", () => {
    const result = buildCapitalFinanceHandoff({
      runId: "run-finance-3",
      threadId: "thread-finance-3",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T10:20:00+08:00",
      availableToolIds: ["sec-edgar-api", "portfolio-company-ir-feed", "public-ma-announcements"],
      canonicalSourceAvailable: true,
      sources: [
        {
          sourceId: "funding-heat",
          displayName: "融资新闻",
          sourceType: "news",
          sourceFamily: "finance_funding_news",
          authorityTier: "ordinary",
          primarySourceDistance: "secondary",
          accessMode: "public",
          costTier: "low",
          reviewStatus: "watch",
          bucket: "accepted",
          title: "融资热度信号",
          summaryCn: "保留融资热度，但不越权写成熟趋势。",
          financeSignalKind: "financing_heat",
          agentRelevanceScore: 0.66,
          agentRelevanceReasons: ["heat"],
        },
        {
          sourceId: "allocation-filing",
          displayName: "SEC Filing",
          sourceType: "financial_filing",
          sourceFamily: "finance_sec_filing",
          authorityTier: "core",
          primarySourceDistance: "primary",
          accessMode: "api",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "SEC EDGAR",
          bucket: "accepted",
          title: "资本配置主证",
          summaryCn: "资本配置",
          financeSignalKind: "capital_allocation",
          agentRelevanceScore: 0.92,
          agentRelevanceReasons: ["allocation"],
        },
        {
          sourceId: "org-investment-ir",
          displayName: "IR",
          sourceType: "funding",
          sourceFamily: "finance_investor_relations",
          authorityTier: "proven",
          primarySourceDistance: "near_primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "Investor Relations",
          bucket: "accepted",
          title: "组织投入主证",
          summaryCn: "组织投入",
          financeSignalKind: "organizational_investment",
          agentRelevanceScore: 0.86,
          agentRelevanceReasons: ["org-investment"],
        },
        {
          sourceId: "ma-announcement",
          displayName: "并购公告",
          sourceType: "financial_filing",
          sourceFamily: "finance_merger_acquisition",
          authorityTier: "core",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          bucket: "accepted",
          title: "并购整合主证",
          summaryCn: "并购整合",
          financeSignalKind: "merger_integration",
          agentRelevanceScore: 0.9,
          agentRelevanceReasons: ["ma"],
        },
        {
          sourceId: "public-company-tilt",
          displayName: "上市公司公告",
          sourceType: "financial_filing",
          sourceFamily: "finance_public_company_announcement",
          authorityTier: "core",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          bucket: "accepted",
          title: "业务倾斜主证",
          summaryCn: "业务倾斜",
          financeSignalKind: "public_company_tilt",
          agentRelevanceScore: 0.88,
          agentRelevanceReasons: ["tilt"],
        },
        {
          sourceId: "industry-report",
          displayName: "产业研究",
          sourceType: "news",
          sourceFamily: "finance_industry_data",
          authorityTier: "watch",
          primarySourceDistance: "secondary",
          accessMode: "optional_paid",
          costTier: "high",
          reviewStatus: "needs_review",
          namedSource: "Gartner",
          bucket: "accepted",
          title: "产业研究叙事主证",
          summaryCn: "产业研究叙事",
          financeSignalKind: "industry_research_narrative",
          optionalPaidSourceFamilies: ["finance_industry_data"],
          agentRelevanceScore: 0.73,
          agentRelevanceReasons: ["research-narrative"],
        },
      ],
    });

    expect(result.accepted.payload.events.map((event) => event.evidence.finance_signal_kind)).toEqual([
      "financing_heat",
      "capital_allocation",
      "organizational_investment",
      "merger_integration",
      "public_company_tilt",
      "industry_research_narrative",
    ]);
    expect(result.coverage.payload.report.optional_paid_source_families).toEqual(["finance_industry_data"]);
  });

  it("covers earnings report, fund report, and earnings call transcript source families with audit fields", () => {
    const result = buildCapitalFinanceHandoff({
      runId: "run-finance-3b",
      threadId: "thread-finance-3b",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T10:25:00+08:00",
      availableToolIds: ["public-company-filings", "public-fund-reports", "earnings-call-transcripts"],
      canonicalSourceAvailable: true,
      sources: [
        {
          sourceId: "earnings-report",
          displayName: "10-Q",
          sourceType: "financial_filing",
          sourceFamily: "finance_earnings_report",
          authorityTier: "core",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          bucket: "accepted",
          title: "财报体现业务倾斜",
          summaryCn: "财报中体现资本配置与业务倾斜。",
          financeSignalKind: "public_company_tilt",
          agentRelevanceScore: 0.9,
          agentRelevanceReasons: ["earnings-report"],
        },
        {
          sourceId: "fund-report",
          displayName: "ARK Big Ideas",
          sourceType: "funding",
          sourceFamily: "finance_fund_report",
          authorityTier: "watch",
          primarySourceDistance: "near_primary",
          accessMode: "optional_paid",
          costTier: "high",
          reviewStatus: "watch",
          namedSource: "ARK Big Ideas",
          bucket: "accepted",
          title: "基金报告形成产业研究叙事",
          summaryCn: "基金报告作为产业研究叙事补证。",
          financeSignalKind: "industry_research_narrative",
          optionalPaidSourceFamilies: ["finance_fund_report"],
          agentRelevanceScore: 0.72,
          agentRelevanceReasons: ["fund-report"],
        },
        {
          sourceId: "earnings-call",
          displayName: "公开电话会 transcript",
          sourceType: "news",
          sourceFamily: "finance_earnings_call_transcript",
          authorityTier: "proven",
          primarySourceDistance: "near_primary",
          accessMode: "public",
          costTier: "low",
          reviewStatus: "active",
          bucket: "accepted",
          title: "电话会披露组织投入",
          summaryCn: "电话会 transcript 体现组织投入方向。",
          financeSignalKind: "organizational_investment",
          agentRelevanceScore: 0.84,
          agentRelevanceReasons: ["earnings-call"],
        },
      ],
    });

    expect(result.accepted.payload.events.map((event) => event.source.source_family)).toEqual([
      "finance_earnings_report",
      "finance_fund_report",
      "finance_earnings_call_transcript",
    ]);
    expect(result.accepted.payload.events.map((event) => event.source.primary_source_distance)).toEqual([
      "primary",
      "near_primary",
      "near_primary",
    ]);
    expect(result.coverage.payload.report.access_modes_present).toEqual(expect.arrayContaining(["public", "optional_paid"]));
    expect(result.coverage.payload.report.optional_paid_source_families).toEqual(["finance_fund_report"]);
  });

  it("rejects inconsistent optional_paid audit state", () => {
    expect(() =>
      buildCapitalFinanceHandoff({
        runId: "run-finance-4",
        threadId: "thread-finance-4",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T10:30:00+08:00",
        availableToolIds: ["licensed-market-discovery"],
        canonicalSourceAvailable: false,
        sources: [
          {
            sourceId: "paid-source-bad-state",
            displayName: "产业数据付费源",
            sourceType: "news",
            sourceFamily: "finance_industry_data",
            authorityTier: "watch",
            primarySourceDistance: "secondary",
            accessMode: "optional_paid",
            costTier: "high",
            reviewStatus: "active",
            bucket: "accepted",
            title: "不一致的付费源状态",
            summaryCn: "付费源应保持 needs_review/watch。",
            financeSignalKind: "industry_research_narrative",
            optionalPaidSourceFamilies: ["finance_industry_data"],
            agentRelevanceScore: 0.7,
            agentRelevanceReasons: ["paid-audit"],
          },
        ],
      }),
    ).toThrow(/optional_paid should stay in needs_review\/watch state/);
  });

  it("rejects generic accepted finance evidence and missing audit fields", () => {
    expect(() =>
      buildCapitalFinanceHandoff({
        runId: "run-finance-5",
        threadId: "thread-finance-5",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T10:35:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "generic-accepted-finance",
            displayName: "泛新闻",
            sourceType: "news",
            sourceFamily: "generic_news",
            authorityTier: "ordinary",
            primarySourceDistance: "secondary",
            accessMode: "public",
            costTier: "low",
            reviewStatus: "watch",
            bucket: "accepted",
            title: "不能把泛新闻直接当 finance accepted",
            summaryCn: "应要求显式 finance source family。",
            financeSignalKind: "financing_heat",
            agentRelevanceScore: 0.52,
            agentRelevanceReasons: ["generic-news"],
          },
        ],
      }),
    ).toThrow(/axis-specific sourceFamily/);

    expect(() =>
      buildCapitalFinanceHandoff({
        runId: "run-finance-6",
        threadId: "thread-finance-6",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T10:36:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "missing-audit-fields",
            displayName: "SEC Filing",
            sourceType: "financial_filing",
            sourceFamily: "finance_sec_filing",
            authorityTier: "core",
            primarySourceDistance: "primary",
            namedSource: "SEC EDGAR",
            bucket: "accepted",
            title: "accepted finance 事件缺少审计字段",
            summaryCn: "producer 应拒绝这类不完整输出。",
            financeSignalKind: "capital_allocation",
            agentRelevanceScore: 0.92,
            agentRelevanceReasons: ["missing-audit"],
          },
        ],
      }),
    ).toThrow(/missing required audit fields/);
  });

  it("rejects excluded or rumor-grade finance evidence from accepted facts", () => {
    expect(() =>
      buildCapitalFinanceHandoff({
        runId: "run-finance-7",
        threadId: "thread-finance-7",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T10:37:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "excluded-finance",
            displayName: "SEO 聚合页",
            sourceType: "news",
            sourceFamily: "finance_funding_news",
            authorityTier: "excluded",
            primarySourceDistance: "secondary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "watch",
            bucket: "accepted",
            title: "被排除来源不应进入 accepted",
            summaryCn: "excluded 来源只能拒收或留痕。",
            financeSignalKind: "financing_heat",
            agentRelevanceScore: 0.3,
            agentRelevanceReasons: ["excluded"],
          },
        ],
      }),
    ).toThrow(/authorityTier=excluded/);

    expect(() =>
      buildCapitalFinanceHandoff({
        runId: "run-finance-8",
        threadId: "thread-finance-8",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T10:38:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "rumor-finance",
            displayName: "未证实传闻",
            sourceType: "news",
            sourceFamily: "finance_funding_news",
            authorityTier: "ordinary",
            primarySourceDistance: "rumor",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "watch",
            bucket: "accepted",
            title: "传闻不能进入 accepted",
            summaryCn: "rumor 级别只能作为 rejected/diagnostic。",
            financeSignalKind: "financing_heat",
            agentRelevanceScore: 0.28,
            agentRelevanceReasons: ["rumor"],
          },
        ],
      }),
    ).toThrow(/primarySourceDistance=rumor/);
  });

  it("rejects accepted finance evidence when no route is available", () => {
    expect(() =>
      buildCapitalFinanceHandoff({
        runId: "run-finance-9",
        threadId: "thread-finance-9",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T10:39:00+08:00",
        availableToolIds: [],
        canonicalSourceAvailable: false,
        sources: [
          {
            sourceId: "impossible-accepted-finance",
            displayName: "SEC Filing",
            sourceType: "financial_filing",
            sourceFamily: "finance_sec_filing",
            authorityTier: "core",
            primarySourceDistance: "primary",
            accessMode: "api",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "SEC EDGAR",
            bucket: "accepted",
            title: "无路由时不应还能 accepted",
            summaryCn: "route none 只能留 rejected/diagnostic。",
            financeSignalKind: "capital_allocation",
            agentRelevanceScore: 0.9,
            agentRelevanceReasons: ["route-none"],
          },
        ],
      }),
    ).toThrow(/cannot emit accepted\/counter evidence when no route is available/);
  });

  it("rejects finance accepted evidence that is still unavailable or waiting for human exception", () => {
    expect(() =>
      buildCapitalFinanceHandoff({
        runId: "run-finance-10",
        threadId: "thread-finance-10",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T10:40:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "unavailable-finance",
            displayName: "SEC Filing",
            sourceType: "financial_filing",
            sourceFamily: "finance_sec_filing",
            authorityTier: "core",
            primarySourceDistance: "primary",
            accessMode: "unavailable",
            costTier: "unknown",
            reviewStatus: "unavailable",
            namedSource: "SEC EDGAR",
            bucket: "accepted",
            title: "不可用来源不能进 accepted",
            summaryCn: "unavailable 应只留在 gap 轨迹。",
            financeSignalKind: "capital_allocation",
            agentRelevanceScore: 0.9,
            agentRelevanceReasons: ["unavailable"],
          },
        ],
      }),
    ).toThrow(/accessMode=unavailable/);

    expect(() =>
      buildCapitalFinanceHandoff({
        runId: "run-finance-11",
        threadId: "thread-finance-11",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T10:41:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "human-exception-finance",
            displayName: "IR Page",
            sourceType: "funding",
            sourceFamily: "finance_investor_relations",
            authorityTier: "proven",
            primarySourceDistance: "near_primary",
            accessMode: "human_exception",
            costTier: "high",
            reviewStatus: "needs_review",
            humanExceptionRequired: true,
            namedSource: "Investor Relations",
            bucket: "accepted",
            title: "等待人工例外的来源不能进 accepted",
            summaryCn: "human exception required 应只留在 diagnostic。",
            financeSignalKind: "capital_allocation",
            agentRelevanceScore: 0.81,
            agentRelevanceReasons: ["human-exception"],
          },
        ],
      }),
    ).toThrow(/humanExceptionRequired=true/);
  });

  it("rejects finance accepted evidence in last_resort_mode", () => {
    expect(() =>
      buildCapitalFinanceHandoff({
        runId: "run-finance-12",
        threadId: "thread-finance-12",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T10:42:00+08:00",
        availableToolIds: ["manual-finance-triage"],
        canonicalSourceAvailable: false,
        sources: [
          {
            sourceId: "last-resort-finance",
            displayName: "手工记录",
            sourceType: "funding",
            sourceFamily: "finance_investor_relations",
            authorityTier: "proven",
            primarySourceDistance: "near_primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "Investor Relations",
            bucket: "accepted",
            title: "last resort 不该还能 accepted",
            summaryCn: "weak signal only 路径只能留 rejected/diagnostic。",
            financeSignalKind: "capital_allocation",
            agentRelevanceScore: 0.8,
            agentRelevanceReasons: ["last-resort"],
          },
        ],
      }),
    ).toThrow(/cannot emit accepted\/counter evidence in last_resort_mode/);
  });

  it("rejects deprecated finance evidence from accepted facts", () => {
    expect(() =>
      buildCapitalFinanceHandoff({
        runId: "run-finance-13",
        threadId: "thread-finance-13",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T10:43:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "deprecated-finance",
            displayName: "旧 IR 页面",
            sourceType: "funding",
            sourceFamily: "finance_investor_relations",
            authorityTier: "proven",
            primarySourceDistance: "near_primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "deprecated",
            namedSource: "Investor Relations",
            bucket: "accepted",
            title: "废弃来源不能进 accepted",
            summaryCn: "deprecated 只能留背景或缺口。",
            financeSignalKind: "capital_allocation",
            agentRelevanceScore: 0.7,
            agentRelevanceReasons: ["deprecated"],
          },
        ],
      }),
    ).toThrow(/reviewStatus=deprecated/);
  });

  it("rejects finance accepted evidence that still carries rejectedReason", () => {
    expect(() =>
      buildCapitalFinanceHandoff({
        runId: "run-finance-14",
        threadId: "thread-finance-14",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T10:44:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "accepted-with-rejected-reason",
            displayName: "SEC Filing",
            sourceType: "financial_filing",
            sourceFamily: "finance_sec_filing",
            authorityTier: "core",
            primarySourceDistance: "primary",
            accessMode: "api",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "SEC EDGAR",
            bucket: "accepted",
            title: "accepted 不应带 rejectedReason",
            summaryCn: "rejectedReason 只应存在于 rejected bucket。",
            financeSignalKind: "capital_allocation",
            agentRelevanceScore: 0.92,
            agentRelevanceReasons: ["lineage-cleanliness"],
            rejectedReason: "should-not-be-here",
          },
        ],
      }),
    ).toThrow(/cannot carry rejectedReason/);
  });
});
