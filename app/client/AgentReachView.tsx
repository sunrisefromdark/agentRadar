import React, { useEffect, useMemo, useRef, useState } from "react";

import type {
  AgentReachCandidateCardViewModel,
  AgentReachChipTone,
  AgentReachCoverageViewModel,
  AgentReachSummaryCardViewModel,
  AgentReachViewModel,
} from "../../src/visualConsole/types.ts";

export type AgentReachSortMode = "attention" | "time" | "evidence";
type AgentReachUiCopy = ReturnType<typeof agentReachCopy>;

export type AgentReachViewProps = Pick<
  AgentReachViewModel,
  "status" | "summary_cards" | "filters" | "candidates" | "coverage" | "direction_snapshot" | "warnings" | "state" | "banner"
> & {
  lang?: "zh" | "en";
  initialTheme: "light" | "dark";
  initialSelectedId?: string | null;
};

declare global {
  interface Window {
    __AGENTREACH_INITIAL_DATA__?: Partial<AgentReachViewProps>;
  }
}

const PAGE_SIZE = 4;

function uiText(lang: "zh" | "en" | undefined, zh: string, en: string): string {
  return lang === "en" ? en : zh;
}

function agentReachCopy(lang: "zh" | "en" | undefined) {
  return {
    lang: lang === "en" ? "en" : "zh",
    unknown: uiText(lang, "未知", "Unknown"),
    externalAttention: uiText(lang, "外部关注度", "External Attention"),
    object: uiText(lang, "对象", "Object"),
    evidence: uiText(lang, "证据", "Evidence"),
    source: uiText(lang, "来源", "Sources"),
    pending: uiText(lang, "待补充", "Pending"),
    crossPlatform: uiText(lang, "跨平台", "Cross-platform"),
    cannotPrimary: uiText(lang, "不能作为主结论", "Not a primary conclusion"),
    evidenceAggregation: uiText(lang, "证据聚合", "Evidence Aggregate"),
    mention: uiText(lang, "提及", "Mentions"),
    distinctSources: uiText(lang, "独立来源", "Distinct Sources"),
    activeDays: uiText(lang, "活跃天数", "Active Days"),
    lastSeen: uiText(lang, "最近看到", "Last Seen"),
    crossPlatformConfirm: uiText(lang, "跨平台外部确认", "Cross-platform confirmation"),
    singlePlatformSignal: uiText(lang, "单平台信号", "Single-platform signal"),
    noEvidenceAggregate: uiText(lang, "当前候选没有可绑定的证据聚合。", "No bindable evidence aggregate is available for this candidate."),
    evidenceSources: uiText(lang, "证据来源", "Evidence Sources"),
    publishedAt: uiText(lang, "发布时间", "Published"),
    observedAt: uiText(lang, "观察时间", "Observed"),
    visitSource: uiText(lang, "访问来源", "Open Source"),
    sourceUnavailable: uiText(lang, "本次数据没有来源明细；仍可查看证据聚合与谁在讨论。", "Source detail rows are not included in this run; evidence aggregates and discussion identity remain available."),
    whoIsDiscussing: uiText(lang, "谁在讨论", "Who Is Discussing"),
    publicSources: uiText(lang, "公开来源", "Public Sources"),
    namedSources: uiText(lang, "具名来源", "Named Sources"),
    anonymizedSources: uiText(lang, "未命中具名来源", "No Named Match"),
    anonymizedDiscussionNote: uiText(lang, "暂未命中具名讨论者；当前仅能确认 {count} 个脱敏独立来源，覆盖 {platforms}。", "No named discussion source matched; currently only {count} anonymized distinct source(s) are confirmed across {platforms}."),
    additionalAnonymizedDiscussionNote: uiText(lang, "另有 {count} 个脱敏独立来源，覆盖 {platforms}。", "{count} additional anonymized distinct source(s) are confirmed across {platforms}."),
    noDiscussionIdentity: uiText(lang, "暂无可识别讨论者，仅保留平台与证据计数。", "No identifiable discussion source is available; only platform and evidence counts are retained."),
    eventUnit: uiText(lang, "条", "events"),
    type: uiText(lang, "类型", "Types"),
    tier: uiText(lang, "层级", "Tiers"),
    failed: uiText(lang, "外部层执行失败", "External Layer Failed"),
    selectCandidate: uiText(lang, "选择候选后查看外部证据详情", "Select a candidate to inspect external evidence"),
    failedBody: uiText(lang, "请查看平台 coverage 与失败说明，不要把失败渲染成无信号。", "Check platform coverage and failure notes instead of rendering failures as no signal."),
    emptyBody: uiText(lang, "今天暂无可展示的外部候选，页面仍保留平台审计状态。", "No external candidates are available today. Platform audit state is still retained."),
    observing: uiText(lang, "观察中", "Observing"),
    externalSupplement: uiText(lang, "外部补证", "External Evidence"),
    attention: uiText(lang, "关注度", "Attention"),
    objectBinding: uiText(lang, "它是什么", "What It Is"),
    whyWatch: uiText(lang, "为什么值得看", "Why Watch"),
    confirmationGaps: uiText(lang, "还需要确认什么", "What Still Needs Confirmation"),
    directionSignal: uiText(lang, "方向线索", "Direction Signal"),
    boundObject: uiText(lang, "已绑定对象", "Bound Object"),
    discussionSignal: uiText(lang, "讨论", "Discussion"),
    needsPrimary: uiText(lang, "需主源确认", "Needs Primary Confirmation"),
    enterDaily: uiText(lang, "进入日报", "Daily"),
    enterWeekly: uiText(lang, "进入周报", "Weekly"),
    yes: uiText(lang, "是", "Yes"),
    no: uiText(lang, "否", "No"),
    secondaryOnly: uiText(lang, "外部信号只作为次级判断", "External signals are secondary-only"),
    judgement: uiText(lang, "当前判断和建议", "Current Judgement"),
    defaultReason: uiText(lang, "先查看证据来源，再决定是否进入后续观察。", "Review evidence sources before deciding whether to keep observing."),
    noCaveat: uiText(lang, "无额外 caveat", "No extra caveat"),
    noConfirmationGap: uiText(lang, "暂无额外确认项", "No extra confirmation gap"),
    viewEvidence: uiText(lang, "查看证据", "View Evidence"),
    pendingObserverBridge: uiText(lang, "待接入观察", "Observer Bridge Pending"),
    observerBridgeReadOnly: uiText(lang, "观察池写入待接入，当前仅支持查看证据。", "Observer write-back is pending; evidence review is read-only for now."),
    actionReadOnlyNoSource: uiText(lang, "本条没有可打开的来源明细，观察池写入待接入。", "No openable source detail is available for this item; observer write-back is pending."),
    footerKicker: uiText(lang, "方向观察与平台状态", "Direction Watch & Platform Status"),
    footerTitle: uiText(lang, "今日外部讨论快照", "Today External Discussion Snapshot"),
    trendKicker: uiText(lang, "外部趋势", "External Trend"),
    trendTitle: uiText(lang, "外部讨论观察", "External Discussion Watch"),
    trendSubtitle: uiText(lang, "基于当前外部候选整理，趋势判断需等待近 7 日窗口确认。", "Built from current external candidates; trend claims still need the 7-day window."),
    projectTrend: uiText(lang, "项目趋势", "Project Trends"),
    directionTrend: uiText(lang, "方向观察", "Direction Watch"),
    trendCode: uiText(lang, "外部趋势", "External Trend"),
    trendAttention: uiText(lang, "外部关注", "Attention"),
    trendSources: uiText(lang, "来源", "Sources"),
    trendActive: uiText(lang, "活跃", "Active"),
    trendDays: uiText(lang, "天", "days"),
    trendObserveOnly: uiText(lang, "仅观察", "Observe Only"),
    trendExternalBoost: uiText(lang, "外部补强", "External Boost"),
    trendSingleDay: uiText(lang, "单日快照", "Single-day"),
    trendNoItems: uiText(lang, "当前暂无可展示的外部趋势项。", "No external trend items are available yet."),
    platformStatusTitle: uiText(lang, "平台与数据状态", "Platform & Data Status"),
    platformStatusKicker: uiText(lang, "覆盖情况", "Coverage"),
    platformStatusSubtitle: uiText(lang, "用于判断外部层可信度，不是项目排名指标。", "Used to judge external-layer reliability, not project ranking."),
    platformBoundary: uiText(lang, "外部信号只作为次级判断，需 GitHub / Trendshift 主链路确认。", "External signals are secondary evidence and need GitHub / Trendshift confirmation."),
    directionEvidence: uiText(lang, "方向证据", "Direction Evidence"),
    directionCandidates: uiText(lang, "方向候选", "Direction Candidates"),
    pendingExternalSignals: uiText(lang, "待归档外部信号", "Pending External Signals"),
    zeroRelevant: uiText(lang, "无相关结果", "Zero Relevant Results"),
    notConfigured: uiText(lang, "未配置", "Not Configured"),
    heroPill: uiText(lang, "AgentReach 外部层", "AgentReach External Layer"),
    heroTitle: uiText(lang, "外部发现", "External Discovery"),
    heroBody: uiText(
      lang,
      "从 X / Reddit / HN / 官方来源发现项目与补证信号，先看候选，再看证据。",
      "Discover project candidates and supporting signals from X, Reddit, HN, and official sources. Review candidates first, then evidence.",
    ),
    secondaryWarning: uiText(lang, "外部信号只作为次级判断，不单独形成主结论。", "External signals are secondary-only and do not form primary conclusions alone."),
    dataSource: uiText(lang, "数据源", "Data Source"),
    filters: uiText(lang, "候选范围", "Candidate Range"),
    all: uiText(lang, "全部", "All"),
    sort: uiText(lang, "排序", "Sort"),
    candidateList: uiText(lang, "候选列表", "Candidates"),
    candidateTitle: uiText(lang, "项目 / 方向候选", "Project / Direction Candidates"),
    listFailed: uiText(lang, "外部层执行失败", "External layer failed"),
    noCandidates: uiText(lang, "今天暂无可展示的外部候选", "No external candidates today"),
    noCandidatesBody: uiText(
      lang,
      "已保留平台 coverage，避免把 failed / not_configured 误写成无信号。",
      "Platform coverage is retained so failed / not_configured is not mistaken for no signal.",
    ),
    externalCandidateSummary: uiText(
      lang,
      "外部层候选，需要结合主源数据继续确认。",
      "External-only candidate. Continue validating it with primary-source data before drawing conclusions.",
    ),
    evidenceAuthoritySummary: uiText(
      lang,
      "外部来源提供了候选证据，但只能作为次级判断信号。",
      "External sources provide supporting evidence, but this remains a secondary signal.",
    ),
    evidenceIntensitySummary: uiText(
      lang,
      "当前证据来自已脱敏的外部事件聚合。",
      "The current evidence is aggregated from sanitized external events.",
    ),
    evidencePersistenceSummary: uiText(
      lang,
      "当前仅作为今日外部讨论快照，后续趋势需要多日聚合确认。",
      "This is a single-day external discussion snapshot; trend claims require multi-day aggregation.",
    ),
    externalOnlyCaveat: uiText(
      lang,
      "外部热度不能直接提升为主榜结论。",
      "External attention cannot be promoted directly into a primary ranking conclusion.",
    ),
    statusReasonFallback: uiText(lang, "外部层已执行。", "External layer has run."),
    warningFallback: uiText(lang, "存在外部层提示，请查看平台状态。", "External-layer notes are available. Check platform status."),
    previousPage: uiText(lang, "上一页", "Prev"),
    nextPage: uiText(lang, "下一页", "Next"),
  };
}

function isEnglish(copy: AgentReachUiCopy): boolean {
  return copy.lang === "en";
}

function enByKey(key: string, fallback: string, values: Record<string, string>): string {
  return values[key] ?? fallback;
}

function summaryCardLabel(card: AgentReachSummaryCardViewModel, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return card.label;
  return enByKey(card.key, card.label, {
    overview: "Overview",
    new_discoveries: "New Candidates",
    project_evidence: "Existing Candidate Evidence",
    direction_observations: "Direction Watch",
    official_releases: "Official Confirmation",
  });
}

function summaryCardBody(card: AgentReachSummaryCardViewModel, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return card.body;
  return enByKey(card.key, card.body, {
    overview: "External signals across discovery, supporting evidence, and direction watch.",
    new_discoveries: "Externally discovered projects or objects that still need primary-source confirmation.",
    project_evidence: "External discussion that supplements existing candidates.",
    direction_observations: "Direction-level signals for today's snapshot only.",
    official_releases: "Official-source signals that still remain secondary to the primary ranking.",
  });
}

function typeLabel(key: string, fallback: string, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return fallback;
  return enByKey(key, fallback, {
    new_discovery: "New Discovery",
    project_evidence: "External Evidence",
    direction_watch: "Direction Watch",
    official_signal: "Official Signal",
    needs_confirmation: "Needs Confirmation",
  });
}

function sortLabel(key: string, fallback: string, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return fallback;
  return enByKey(key, fallback, {
    attention: "Attention",
    time: "Time",
    evidence: "Evidence",
  });
}

function platformLabelForView(platform: string, fallback: string | undefined, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return fallback ?? platform;
  return enByKey(platform, fallback ?? platform, {
    x_twitter: "X",
    reddit: "Reddit",
    hacker_news: "HN",
    official_web: "Official Web",
    official_blog: "Official Blog",
    official: "Official",
  });
}

function platformLabelsForView(platforms: string[], fallbackLabels: string[], copy: AgentReachUiCopy): string[] {
  return platforms.map((platform, index) => platformLabelForView(platform, fallbackLabels[index], copy));
}

function targetTypeLabelForView(type: string, fallback: string, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return fallback;
  return enByKey(type, fallback, {
    project: "Project",
    paper: "Paper",
    product: "Product",
    topic: "Topic",
    unknown: "Object",
  });
}

function objectLabelForView(candidate: AgentReachCandidateCardViewModel, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return candidate.object_label;
  const level = candidate.scope === "direction" ? "Direction level" : "Project level";
  return `${targetTypeLabelForView(candidate.target_type, candidate.target_type_label, copy)} · ${level}`;
}

function qualificationLabelForView(candidate: AgentReachCandidateCardViewModel, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return candidate.qualification_label;
  return enByKey(candidate.qualification, candidate.qualification_label, {
    observe: "Observe",
    needs_primary_confirmation: "Needs Primary Confirmation",
    supporting_evidence_only: "Supporting Evidence Only",
  });
}

function bindingConfidenceLabelForView(candidate: AgentReachCandidateCardViewModel, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return candidate.binding_confidence_label;
  return enByKey(candidate.binding_confidence, candidate.binding_confidence_label, {
    high: "High",
    medium: "Medium",
    low: "Low",
    unbound: "Unbound",
  });
}

function rawEventKindLabelForView(kind: string, fallback: string, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return fallback;
  return enByKey(kind, fallback, {
    mention: "Mention",
    discussion: "Discussion",
    official_release: "Official Release",
    blog_post: "Blog Update",
    question: "Question",
    showcase: "Showcase",
    unknown: "Unknown Event",
  });
}

function actorTypeLabelForView(type: string, fallback: string, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return fallback;
  return enByKey(type, fallback, {
    institution: "Institution",
    team: "Team",
    person: "Person",
    community: "Community",
    unknown: "Unknown",
  });
}

function actorTierLabelForView(tier: string, fallback: string, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return fallback;
  return enByKey(tier, fallback, {
    core: "Core",
    proven: "Proven",
    watch: "Watch",
    ordinary: "Ordinary",
    unknown: "Unknown",
  });
}

function coverageStatusLabelForView(item: AgentReachCoverageViewModel, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return item.status_label;
  return enByKey(item.status, item.status_label, {
    ok: "OK",
    partial: "Partial",
    zero_relevant_results: "No Relevant Results",
    not_configured: "Not Configured",
    manual_import_only: "Manual Import Only",
    unavailable: "Unavailable",
    failed: "Failed",
    missing: "Missing",
  });
}

function metricLabelForView(key: string, fallback: string, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return fallback;
  return enByKey(key, fallback, {
    likes: "likes",
    reposts: "reposts",
    comments: "comments",
    upvotes: "upvotes",
    replies: "replies",
  });
}

function isDirectionSignalForView(candidate: AgentReachCandidateCardViewModel): boolean {
  return candidate.scope === "direction" || (candidate.binding_confidence === "unbound" && !candidate.target_url);
}

function boundObjectTextForView(candidate: AgentReachCandidateCardViewModel, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) {
    if (candidate.target_type === "project" && /^https?:\/\/github\.com\//i.test(candidate.target_url ?? "")) return "GitHub repo";
    return `${candidate.target_type_label}对象`;
  }
  if (candidate.target_type === "project" && /^https?:\/\/github\.com\//i.test(candidate.target_url ?? "")) return "GitHub repo";
  return `${targetTypeLabelForView(candidate.target_type, candidate.target_type_label, copy).toLowerCase()} object`;
}

function hasConfirmedBindingForView(candidate: AgentReachCandidateCardViewModel): boolean {
  return Boolean(candidate.target_url && candidate.binding_confidence !== "unbound");
}

function platformTextForView(candidate: AgentReachCandidateCardViewModel, copy: AgentReachUiCopy): string {
  const platforms = candidate.platforms.length > 0 ? platformLabelsForView(candidate.platforms, candidate.platform_labels, copy).join(" / ") : copy.pending;
  return platforms;
}

function candidateIntroLineForView(candidate: AgentReachCandidateCardViewModel, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return candidate.intro_line;
  const platforms = platformTextForView(candidate, copy);
  const boundObject = boundObjectTextForView(candidate, copy);
  if (isDirectionSignalForView(candidate)) {
    return `Direction signal, not yet bound to a specific GitHub repo or paper; found through ${platforms}.`;
  }
  if (candidate.type_key === "project_evidence") {
    return `Existing candidate with external supporting evidence from ${platforms}; bound to a ${boundObject}.`;
  }
  if (candidate.type_key === "official_signal") {
    return hasConfirmedBindingForView(candidate)
      ? `Official-source release or update signal bound to a ${boundObject}.`
      : `Official-source release or update signal found a ${boundObject} URL; binding still needs confirmation.`;
  }
  return hasConfirmedBindingForView(candidate)
    ? `${boundObject} candidate found through ${platforms}; bound object is available.`
    : `${boundObject} candidate found through ${platforms}; object URL is available but binding still needs primary-source confirmation.`;
}

function candidateAppearanceReasonForView(candidate: AgentReachCandidateCardViewModel, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return candidate.appearance_reason;
  const platforms = platformTextForView(candidate, copy);
  if (isDirectionSignalForView(candidate)) {
    return `${platforms} surfaced direction-level discussion, so this is kept as an external direction signal.`;
  }
  if (candidate.type_key === "project_evidence") {
    return `${platforms} surfaced discussion around an existing candidate, so this is kept as external supporting evidence.`;
  }
  if (candidate.type_key === "official_signal") {
    return `${platforms} surfaced an official release or update signal.`;
  }
  return `${platforms} surfaced discussion around this object, so it enters as an external candidate.`;
}

function candidateWhyWatchReasonsForView(candidate: AgentReachCandidateCardViewModel, copy: AgentReachUiCopy): string[] {
  if (!isEnglish(copy)) return candidate.why_watch_reasons.length > 0 ? candidate.why_watch_reasons : [copy.defaultReason];
  const platforms = platformTextForView(candidate, copy);
  const reasons = [
    candidate.external_attention_score !== null ? `External attention ${candidate.external_attention_score}` : null,
    candidate.type_key === "official_signal" ? "Official source published or updated this signal." : `${platforms} discussion is available.`,
    candidate.cross_platform ? "Cross-platform confirmation lowers single-platform noise risk." : null,
    isDirectionSignalForView(candidate)
      ? "Direction signal can feed follow-up trend watch."
      : hasConfirmedBindingForView(candidate)
        ? "Bound to a specific object."
        : "Object URL is available, but binding still needs confirmation.",
    candidate.can_enter_daily ? "Can enter the daily report as secondary evidence." : null,
    candidate.can_enter_weekly ? "Can enter the weekly report as secondary evidence." : null,
    candidate.named_actor_count > 0
      ? `Matched ${candidate.named_actor_count} named discussion source(s).`
      : candidate.distinct_actor_count > 0
        ? `Confirmed ${candidate.distinct_actor_count} sanitized distinct source(s).`
        : null,
  ].filter((reason): reason is string => Boolean(reason));
  return [...new Set(reasons)].slice(0, 5);
}

function candidateConfirmationGapsForView(candidate: AgentReachCandidateCardViewModel, copy: AgentReachUiCopy): string[] {
  if (!isEnglish(copy)) return candidate.confirmation_gaps.length > 0 ? candidate.confirmation_gaps : [copy.noConfirmationGap];
  const gaps = [
    isDirectionSignalForView(candidate) ? "Not yet bound to a specific GitHub repo or paper." : null,
    candidate.qualification === "needs_primary_confirmation" ? "Needs GitHub / Trendshift primary-source confirmation." : null,
    candidate.target_url && candidate.binding_confidence === "unbound" ? "Object binding confidence still needs confirmation." : null,
    candidate.cannot_be_primary_conclusion ? "Cannot be used as a primary ranking conclusion." : null,
    !candidate.cross_platform ? "Needs cross-platform or multi-day confirmation." : null,
    candidate.named_actor_count === 0 ? "No named discussion source matched yet." : null,
  ].filter((gap): gap is string => Boolean(gap));
  return [...new Set(gaps)].slice(0, 4);
}

function candidateReasonChipsForView(candidate: AgentReachCandidateCardViewModel, copy: AgentReachUiCopy): string[] {
  const platform = candidate.platforms[0]
    ? platformLabelForView(candidate.platforms[0], candidate.platform_labels[0], copy)
    : null;
  const chips = [
    isDirectionSignalForView(candidate) ? copy.directionSignal : hasConfirmedBindingForView(candidate) ? copy.boundObject : null,
    platform ? `${platform} ${copy.discussionSignal}` : null,
    candidate.cross_platform ? copy.crossPlatform : null,
    candidate.cannot_be_primary_conclusion ? copy.cannotPrimary : null,
  ].filter((chip): chip is string => Boolean(chip));
  return [...new Set(chips)].slice(0, 3);
}

function evidenceSummaryForView(
  evidence: AgentReachCandidateCardViewModel["evidence_cards"][number],
  field: "authority" | "intensity" | "persistence",
  copy: AgentReachUiCopy,
): string {
  if (!isEnglish(copy)) {
    if (field === "authority") return evidence.authority_summary_cn;
    if (field === "intensity") return evidence.intensity_summary_cn;
    return evidence.persistence_summary_cn;
  }
  if (field === "authority") return copy.evidenceAuthoritySummary;
  if (field === "intensity") return copy.evidenceIntensitySummary;
  return copy.evidencePersistenceSummary;
}

function evidenceCaveatForView(evidence: AgentReachCandidateCardViewModel["evidence_cards"][number], copy: AgentReachUiCopy): string | null {
  if (!isEnglish(copy)) return evidence.caveats.length > 0 ? evidence.caveats.join("；") : null;
  return evidence.caveats.length > 0 ? copy.externalOnlyCaveat : null;
}

function statusReasonForView(reason: string | null | undefined, copy: AgentReachUiCopy): string {
  if (!reason) return copy.statusReasonFallback;
  if (!isEnglish(copy)) return reason;
  return /[\u3400-\u9fff]/.test(reason) ? copy.statusReasonFallback : reason;
}

function warningForView(warning: string, copy: AgentReachUiCopy): string {
  if (!isEnglish(copy)) return warning;
  if (!/[\u3400-\u9fff]/.test(warning)) return warning;
  if (warning.includes("来源明细不可用")) return copy.sourceUnavailable;
  if (warning.includes("只读取到 run summary")) return "Only run-summary metadata is available; candidate and source details are unavailable.";
  if (warning.includes("aggregate 读取状态")) return "Aggregate read status is not OK. Check data generation logs.";
  return copy.warningFallback;
}

const DEFAULT_PROPS: AgentReachViewProps = {
  lang: "zh",
  initialTheme: "light",
  initialSelectedId: null,
  status: {
    provider_status: "missing",
    label: "missing",
    reason: "DailyExternalAggregate 未生成",
    tone: "neutral",
    data_source: "missing",
    aggregate_path: null,
  },
  summary_cards: [],
  filters: {
    type_chips: [],
    source_chips: [],
    sort_options: [],
    status_chips: [],
  },
  candidates: [],
  coverage: [],
  direction_snapshot: {
    direction_evidence_count: 0,
    direction_candidate_count: 0,
    direction_label_counts: [],
    pending_external_signal_count: 0,
    zero_relevant_results_count: 0,
    not_configured_count: 0,
    partial_count: 0,
  },
  warnings: [],
  state: {
    status: "failed",
    reasons: [],
  },
  banner: {
    title: "AgentReach",
    context_label: "daily",
    generated_at: null,
    enhancement_status: "unknown",
    mode_label: "unknown",
    github_enrichment_status: "external-discovery",
    source_health: "missing",
    notes: [],
  },
};

function readPayloadFromDom(): Partial<AgentReachViewProps> | null {
  if (typeof document === "undefined") return null;
  const payloadNode = document.getElementById("agentreach-react-payload");
  if (!payloadNode?.textContent) return null;
  try {
    return JSON.parse(payloadNode.textContent) as Partial<AgentReachViewProps>;
  } catch {
    return null;
  }
}

function readPayloadFromWindow(): Partial<AgentReachViewProps> | null {
  if (typeof window === "undefined") return null;
  const payload = window.__AGENTREACH_INITIAL_DATA__;
  return payload && typeof payload === "object" ? payload : null;
}

export function parseAgentReachViewPayload(): AgentReachViewProps {
  const payload = readPayloadFromDom() ?? readPayloadFromWindow() ?? {};
  return {
    ...DEFAULT_PROPS,
    ...payload,
    status: payload.status ?? DEFAULT_PROPS.status,
    summary_cards: payload.summary_cards ?? DEFAULT_PROPS.summary_cards,
    filters: payload.filters ?? DEFAULT_PROPS.filters,
    candidates: payload.candidates ?? DEFAULT_PROPS.candidates,
    coverage: payload.coverage ?? DEFAULT_PROPS.coverage,
    direction_snapshot: payload.direction_snapshot ?? DEFAULT_PROPS.direction_snapshot,
    warnings: payload.warnings ?? DEFAULT_PROPS.warnings,
    state: payload.state ?? DEFAULT_PROPS.state,
    banner: payload.banner ?? DEFAULT_PROPS.banner,
  };
}

function toneClass(tone: AgentReachChipTone | undefined): string {
  switch (tone) {
    case "good":
      return "agentreach-tone-good";
    case "warn":
      return "agentreach-tone-warn";
    case "bad":
      return "agentreach-tone-bad";
    case "accent":
      return "agentreach-tone-accent";
    default:
      return "agentreach-tone-neutral";
  }
}

function formatDateTime(value: string | null | undefined, copy: AgentReachUiCopy): string {
  if (!value) return copy.unknown;
  return value.replace("T", " ").replace(/\.000Z?$/, "").replace(/Z$/, "");
}

function sortCandidates(candidates: AgentReachCandidateCardViewModel[], sortMode: AgentReachSortMode): AgentReachCandidateCardViewModel[] {
  return [...candidates].sort((left, right) => {
    const priorityDelta = candidateDisplayPriority(left) - candidateDisplayPriority(right);
    if (priorityDelta !== 0) return priorityDelta;
    if (sortMode === "time") {
      return String(right.last_seen_at ?? "").localeCompare(String(left.last_seen_at ?? "")) || right.evidence_count - left.evidence_count;
    }
    if (sortMode === "evidence") {
      return right.evidence_count - left.evidence_count || right.platforms.length - left.platforms.length;
    }
    return (right.external_attention_score ?? -1) - (left.external_attention_score ?? -1) || right.evidence_count - left.evidence_count;
  });
}

function candidateDisplayPriority(candidate: AgentReachCandidateCardViewModel): number {
  if (candidate.type_key === "new_discovery" && candidate.target_url) return 0;
  if (candidate.type_key === "official_signal" && candidate.target_url) return 1;
  if (candidate.type_key === "project_evidence") return 2;
  if (candidate.type_key === "needs_confirmation" && candidate.target_url) return 3;
  if (candidate.scope === "direction" || candidate.type_key === "direction_watch") return 4;
  return 5;
}

function defaultActiveType(props: AgentReachViewProps): string {
  const newDiscovery = props.filters.type_chips.find((chip) => chip.key === "new_discovery");
  if (newDiscovery && Number(newDiscovery.count ?? 0) > 0) return "new_discovery";
  return "all";
}

function candidateMatchesType(candidate: AgentReachCandidateCardViewModel, activeType: string): boolean {
  return activeType === "all" || candidate.type_key === activeType;
}

function paginate<T>(items: T[], page: number): { items: T[]; page: number; pageCount: number; start: number; end: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const paged = items.slice(start, start + PAGE_SIZE);
  return {
    items: paged,
    page: currentPage,
    pageCount,
    start,
    end: start + paged.length,
  };
}

function SummaryCard(props: { card: AgentReachSummaryCardViewModel; copy: AgentReachUiCopy }) {
  return (
    <article className={`agentreach-summary-card ${toneClass(props.card.tone)}`}>
      <span>{summaryCardLabel(props.card, props.copy)}</span>
      <strong>{props.card.value}</strong>
      <p>{summaryCardBody(props.card, props.copy)}</p>
    </article>
  );
}

function CandidateCard(props: {
  candidate: AgentReachCandidateCardViewModel;
  selected: boolean;
  onSelect: (id: string) => void;
  copy: AgentReachUiCopy;
}) {
  const candidate = props.candidate;
  const copy = props.copy;
  return (
    <button
      type="button"
      className={`agentreach-candidate-card ${props.selected ? "is-selected" : ""}`}
      onClick={() => props.onSelect(candidate.candidate_id)}
      aria-pressed={props.selected}
    >
      <div className="agentreach-card-head">
        <span className="agentreach-chip agentreach-tone-accent">{typeLabel(candidate.type_key, candidate.type_label, copy)}</span>
        <span className="agentreach-card-score">{copy.externalAttention} {candidate.external_attention_label}</span>
      </div>
      <h3 title={candidate.display_name}>{candidate.display_name}</h3>
      <p>{candidateAppearanceReasonForView(candidate, copy)}</p>
      <div className="agentreach-card-meta">
        <span>{copy.object} {objectLabelForView(candidate, copy)}</span>
        <span>{copy.evidence} {candidate.evidence_count}</span>
        <span>{copy.source} {candidate.platforms.length > 0 ? platformLabelsForView(candidate.platforms, candidate.platform_labels, copy).join(" / ") : copy.pending}</span>
      </div>
      <div className="agentreach-card-tags">
        <span className="agentreach-chip agentreach-tone-neutral">{qualificationLabelForView(candidate, copy)}</span>
        {candidateReasonChipsForView(candidate, copy).map((chip) => (
          <span className="agentreach-chip agentreach-tone-neutral" key={`${candidate.candidate_id}-${chip}`}>{chip}</span>
        ))}
      </div>
    </button>
  );
}

function MetricCell(props: { label: string; value: string | number }) {
  return (
    <div className="agentreach-metric-cell">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function EvidenceSection(props: { candidate: AgentReachCandidateCardViewModel; copy: AgentReachUiCopy; sectionRef?: React.Ref<HTMLElement> }) {
  const candidate = props.candidate;
  const copy = props.copy;
  return (
    <section className="agentreach-detail-section" id="agentreach-evidence-section" ref={props.sectionRef}>
      <div className="agentreach-section-head">
        <h3>{copy.evidenceAggregation}</h3>
        <span>{candidate.evidence_cards.length}</span>
      </div>
      {candidate.evidence_cards.length > 0 ? (
        <div className="agentreach-evidence-stack">
          {candidate.evidence_cards.map((evidence) => (
            <article className="agentreach-evidence-card" key={evidence.evidence_id}>
              <div className="agentreach-evidence-head">
                <strong>{platformLabelsForView(evidence.platforms, evidence.platform_labels, copy).join(" / ") || evidence.evidence_id}</strong>
                <span className={`agentreach-chip ${evidence.cross_platform ? "agentreach-tone-good" : "agentreach-tone-neutral"}`}>
                  {evidence.cross_platform ? copy.crossPlatformConfirm : copy.singlePlatformSignal}
                </span>
              </div>
              <div className="agentreach-mini-grid">
                <MetricCell label={copy.mention} value={evidence.mention_count} />
                <MetricCell label={copy.distinctSources} value={evidence.distinct_actor_count} />
                <MetricCell label={copy.activeDays} value={evidence.active_day_count} />
                <MetricCell label={copy.lastSeen} value={formatDateTime(evidence.last_seen_at, copy)} />
              </div>
              <p>{evidenceSummaryForView(evidence, "authority", copy)}</p>
              <p>{evidenceSummaryForView(evidence, "intensity", copy)}</p>
              <p>{evidenceSummaryForView(evidence, "persistence", copy)}</p>
              {evidenceCaveatForView(evidence, copy) ? <p className="agentreach-caveat">{evidenceCaveatForView(evidence, copy)}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="agentreach-empty-copy">{copy.noEvidenceAggregate}</p>
      )}
    </section>
  );
}

function SourceCards(props: { candidate: AgentReachCandidateCardViewModel; copy: AgentReachUiCopy }) {
  const sources = props.candidate.source_cards;
  const copy = props.copy;
  return (
    <section className="agentreach-detail-section">
      <div className="agentreach-section-head">
        <h3>{copy.evidenceSources}</h3>
        <span>{sources.length}</span>
      </div>
      {sources.length > 0 ? (
        <div className="agentreach-source-list">
          {sources.map((source) => (
            <article className="agentreach-source-card" key={source.source_id}>
              <div>
                <span className="agentreach-chip agentreach-tone-neutral">{platformLabelForView(source.platform, source.platform_label, copy)}</span>
                <span className="agentreach-chip agentreach-tone-accent">{rawEventKindLabelForView(source.raw_event_kind, source.raw_event_kind_label, copy)}</span>
              </div>
              <h4>{source.title}</h4>
              <p>{source.target_name}</p>
              <div className="agentreach-source-meta">
                <span>{copy.publishedAt} {formatDateTime(source.source_published_at, copy)}</span>
                <span>{copy.observedAt} {formatDateTime(source.observed_at, copy)}</span>
                <span>{actorTypeLabelForView(source.actor_type, source.actor_type_label, copy)} / {actorTierLabelForView(source.actor_tier, source.actor_tier_label, copy)}</span>
              </div>
              {source.metrics.length > 0 ? (
                <div className="agentreach-card-tags">
                  {source.metrics.map((metric) => (
                    <span className="agentreach-chip agentreach-tone-neutral" key={`${source.source_id}-${metric.key}`}>
                      {metricLabelForView(metric.key, metric.label, copy)} {metric.value}
                    </span>
                  ))}
                </div>
              ) : null}
              {source.source_url ? (
                <a className="agentreach-link-button" href={source.source_url} target="_blank" rel="noreferrer">
                  {copy.visitSource}
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="agentreach-empty-copy">{copy.sourceUnavailable}</p>
      )}
    </section>
  );
}

function WhoIsDiscussing(props: { candidate: AgentReachCandidateCardViewModel; copy: AgentReachUiCopy }) {
  const candidate = props.candidate;
  const copy = props.copy;
  const namedActors = candidate.named_registry_actors ?? [];
  const publicActors = candidate.public_actors ?? [];
  const platformLabel = candidate.platforms.length > 0 ? platformLabelsForView(candidate.platforms, candidate.platform_labels, copy).join(" / ") : copy.pending;
  const anonymizedRemainder = Math.max(0, candidate.distinct_actor_count - publicActors.length - namedActors.length);
  const anonymizedNote = candidate.distinct_actor_count > 0
    ? copy.anonymizedDiscussionNote
        .replace("{count}", String(candidate.distinct_actor_count))
        .replace("{platforms}", platformLabel)
    : copy.noDiscussionIdentity;
  const additionalAnonymizedNote = anonymizedRemainder > 0
    ? copy.additionalAnonymizedDiscussionNote
        .replace("{count}", String(anonymizedRemainder))
        .replace("{platforms}", platformLabel)
    : null;
  const identifiedCount = publicActors.length + namedActors.length;

  return (
    <section className="agentreach-detail-section">
      <div className="agentreach-section-head">
        <h3>{copy.whoIsDiscussing}</h3>
        <span>{identifiedCount > 0 ? `${copy.publicSources} ${identifiedCount}` : copy.anonymizedSources}</span>
      </div>
      {identifiedCount > 0 ? (
        <div className="agentreach-actor-list">
          {publicActors.map((actor) => (
            <div className="agentreach-actor-row" key={actor.actor_id}>
              <strong>{actor.display_name}</strong>
              <span>{actorTypeLabelForView(actor.actor_type, actor.actor_type_label, copy)} · {actor.source_kind_label}</span>
              <span>{platformLabelsForView(actor.platforms, actor.platform_labels, copy).join(" / ") || copy.pending}</span>
              <span>{actor.event_count} {copy.eventUnit}</span>
            </div>
          ))}
          {namedActors.map((actor) => (
            <div className="agentreach-actor-row" key={actor.entity_id}>
              <strong>{actor.display_name}</strong>
              <span>{actorTypeLabelForView(actor.actor_type, actor.actor_type_label, copy)} · {actorTierLabelForView(actor.registry_tier, actor.registry_tier_label, copy)}</span>
              <span>{platformLabelsForView(actor.platforms, actor.platform_labels, copy).join(" / ") || copy.pending}</span>
              <span>{actor.event_count} {copy.eventUnit}</span>
            </div>
          ))}
          {additionalAnonymizedNote ? <p className="agentreach-discussion-note">{additionalAnonymizedNote}</p> : null}
        </div>
      ) : (
        <p className="agentreach-discussion-note">{anonymizedNote}</p>
      )}
    </section>
  );
}

function DetailPanel(props: { candidate: AgentReachCandidateCardViewModel | null; statusFailed: boolean; copy: AgentReachUiCopy }) {
  const candidate = props.candidate;
  const copy = props.copy;
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const evidenceSectionRef = useRef<HTMLElement | null>(null);

  function handleViewEvidence(): void {
    const container = detailScrollRef.current;
    const evidenceSection = evidenceSectionRef.current;
    if (!container || !evidenceSection) return;

    const top = evidenceSection.offsetTop - container.offsetTop;
    container.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
  }

  if (!candidate) {
    return (
      <aside className="agentreach-detail-card">
        <div className="agentreach-empty-detail">
          <span className={`agentreach-chip ${props.statusFailed ? "agentreach-tone-bad" : "agentreach-tone-neutral"}`}>
            {props.statusFailed ? "failed" : "empty"}
          </span>
          <h2>{props.statusFailed ? copy.failed : copy.selectCandidate}</h2>
          <p>{props.statusFailed ? copy.failedBody : copy.emptyBody}</p>
        </div>
      </aside>
    );
  }

  const firstSourceUrl = candidate.source_cards.find((source) => source.source_url)?.source_url ?? candidate.target_url;
  const confirmationGaps = candidateConfirmationGapsForView(candidate, copy).slice(0, 2);
  return (
    <aside className="agentreach-detail-card">
      <div className="agentreach-detail-head">
        <div>
          <span className="agentreach-chip agentreach-tone-accent">{copy.observing}</span>
          <h2>{candidate.display_name}</h2>
          {isEnglish(copy) ? (
            <p className="agentreach-en-object-line">{objectLabelForView(candidate, copy)} · {candidate.target_key}</p>
          ) : (
            <p className="agentreach-source-object-line">{candidate.object_label} · {candidate.target_key}</p>
          )}
        </div>
        <span className={`agentreach-chip ${candidate.cannot_be_primary_conclusion ? "agentreach-tone-warn" : "agentreach-tone-neutral"}`}>
          {candidate.cannot_be_primary_conclusion ? copy.cannotPrimary : copy.externalSupplement}
        </span>
      </div>

      <div className="agentreach-detail-scroll" ref={detailScrollRef}>
        <div className="agentreach-metric-grid">
          <MetricCell label={copy.attention} value={candidate.external_attention_label} />
          <MetricCell label={copy.evidence} value={candidate.evidence_count} />
          <MetricCell label={copy.source} value={candidate.platforms.length > 0 ? platformLabelsForView(candidate.platforms, candidate.platform_labels, copy).join(" / ") : copy.pending} />
          <MetricCell label={copy.distinctSources} value={candidate.distinct_actor_count} />
        </div>

        <section className="agentreach-detail-section agentreach-binding-card">
          <div className="agentreach-section-head">
            <h3>{copy.objectBinding}</h3>
            <span>{bindingConfidenceLabelForView(candidate, copy)}</span>
          </div>
          <p>{candidateIntroLineForView(candidate, copy)}</p>
          {candidate.target_url ? (
            <a className="agentreach-object-link" href={candidate.target_url} target="_blank" rel="noreferrer">
              {candidate.target_url}
            </a>
          ) : null}
          <div className="agentreach-card-tags">
            <span className="agentreach-chip agentreach-tone-neutral">{copy.enterDaily} {candidate.can_enter_daily ? copy.yes : copy.no}</span>
            <span className="agentreach-chip agentreach-tone-neutral">{copy.enterWeekly} {candidate.can_enter_weekly ? copy.yes : copy.no}</span>
            <span className="agentreach-chip agentreach-tone-warn">{copy.secondaryOnly}</span>
          </div>
        </section>

        <section className="agentreach-detail-section">
          <div className="agentreach-section-head">
            <h3>{copy.whyWatch}</h3>
            <span>{qualificationLabelForView(candidate, copy)}</span>
          </div>
          {candidateWhyWatchReasonsForView(candidate, copy).slice(0, 3).map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
          <div className="agentreach-confirmation-gaps">
            <span>{copy.confirmationGaps}</span>
            {confirmationGaps.map((gap) => (
              <p className="agentreach-caveat" key={gap}>{gap}</p>
            ))}
          </div>
        </section>

        <WhoIsDiscussing candidate={candidate} copy={copy} />
        <EvidenceSection candidate={candidate} copy={copy} sectionRef={evidenceSectionRef} />
        <SourceCards candidate={candidate} copy={copy} />
      </div>

      <div className="agentreach-detail-actions">
        <button type="button" className="agentreach-secondary-button" onClick={handleViewEvidence}>{copy.viewEvidence}</button>
        {firstSourceUrl ? (
          <a href={firstSourceUrl} target="_blank" rel="noreferrer" className="agentreach-primary-button">{copy.visitSource}</a>
        ) : null}
        <span className="agentreach-action-note">{firstSourceUrl ? copy.observerBridgeReadOnly : copy.actionReadOnlyNoSource}</span>
      </div>
    </aside>
  );
}

function trendVerdict(candidate: AgentReachCandidateCardViewModel, copy: AgentReachUiCopy): { label: string; tone: AgentReachChipTone } {
  if (candidate.type_key === "project_evidence" || candidate.cross_platform) {
    return { label: copy.trendExternalBoost, tone: "accent" };
  }
  if (candidate.evidence_cards.some((item) => item.active_day_count > 1)) {
    return { label: copy.trendObserveOnly, tone: "good" };
  }
  return { label: copy.trendSingleDay, tone: "warn" };
}

function trendCandidates(
  candidates: AgentReachCandidateCardViewModel[],
  mode: "project" | "direction",
): AgentReachCandidateCardViewModel[] {
  return candidates
    .filter((candidate) => (mode === "direction" ? isDirectionSignalForView(candidate) : !isDirectionSignalForView(candidate)))
    .sort(
      (left, right) =>
        (right.external_attention_score ?? -1) - (left.external_attention_score ?? -1) ||
        right.evidence_count - left.evidence_count ||
        left.display_name.localeCompare(right.display_name),
    )
    .slice(0, 4);
}

function TrendObservationPanel(props: {
  candidates: AgentReachCandidateCardViewModel[];
  directionSnapshot: AgentReachViewProps["direction_snapshot"];
  selectedCandidateId: string | null;
  onSelectCandidate: (candidateId: string) => void;
  copy: AgentReachUiCopy;
}) {
  const copy = props.copy;
  const projectItems = trendCandidates(props.candidates, "project");
  const directionItems = trendCandidates(props.candidates, "direction");
  const [mode, setMode] = useState<"project" | "direction">(projectItems.length > 0 ? "project" : "direction");
  const items = mode === "project" ? projectItems : directionItems;

  return (
    <article className="agentreach-trend-panel">
      <div className="agentreach-trend-head">
        <div>
          <span className="agentreach-section-kicker">{copy.trendKicker}</span>
          <h2>{copy.trendTitle}</h2>
          <p>{copy.trendSubtitle}</p>
        </div>
        <div className="agentreach-trend-tabs" aria-label={copy.trendTitle}>
          <button type="button" className={mode === "project" ? "is-active" : ""} onClick={() => setMode("project")}>
            {copy.projectTrend} {projectItems.length}
          </button>
          <button type="button" className={mode === "direction" ? "is-active" : ""} onClick={() => setMode("direction")}>
            {copy.directionTrend} {Math.max(directionItems.length, props.directionSnapshot.direction_candidate_count)}
          </button>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="agentreach-trend-list">
          {items.map((candidate, index) => {
            const verdict = trendVerdict(candidate, copy);
            const platforms = candidate.platforms.length > 0 ? platformLabelsForView(candidate.platforms, candidate.platform_labels, copy).join(" / ") : copy.pending;
            const activeDays = Math.max(1, ...candidate.evidence_cards.map((item) => item.active_day_count));
            const selected = candidate.candidate_id === props.selectedCandidateId;
            return (
              <article
                className={`agentreach-trend-row ${selected ? "is-selected" : ""}`}
                key={candidate.candidate_id}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                onClick={() => props.onSelectCandidate(candidate.candidate_id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    props.onSelectCandidate(candidate.candidate_id);
                  }
                }}
              >
                <div className="agentreach-trend-row-main">
                  <div className="agentreach-trend-row-top">
                    <span className="agentreach-trend-code">{copy.trendCode} · {String(index + 1).padStart(2, "0")}</span>
                    <span className={`agentreach-chip ${toneClass(verdict.tone)}`}>{verdict.label}</span>
                  </div>
                  <h3>{candidate.display_name}</h3>
                  <p>{candidateAppearanceReasonForView(candidate, copy)}</p>
                </div>
                <div className="agentreach-trend-metrics">
                  <span>{copy.trendAttention} <strong>{candidate.external_attention_label}</strong></span>
                  <span>{copy.trendSources} <strong>{candidate.platforms.length || candidate.source_count}</strong></span>
                  <span>{copy.trendActive} <strong>{activeDays} {copy.trendDays}</strong></span>
                </div>
                <div className="agentreach-trend-foot">
                  <span>{platforms}</span>
                  <span>{candidateWhyWatchReasonsForView(candidate, copy)[0] ?? copy.defaultReason}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="agentreach-trend-empty">
          <p>{copy.trendNoItems}</p>
        </div>
      )}
    </article>
  );
}

function PlatformStatusPanel(props: {
  coverage: AgentReachCoverageViewModel[];
  directionSnapshot: AgentReachViewProps["direction_snapshot"];
  copy: AgentReachUiCopy;
}) {
  const copy = props.copy;
  return (
    <aside className="agentreach-platform-panel">
      <span className="agentreach-section-kicker">{copy.platformStatusKicker}</span>
      <h2>{copy.platformStatusTitle}</h2>
      <p>{copy.platformStatusSubtitle}</p>
      <div className="agentreach-platform-grid">
        {props.coverage.map((item) => (
          <span className={`agentreach-chip ${toneClass(item.tone)}`} key={item.platform}>
            {platformLabelForView(item.platform, item.platform_label, copy)} {coverageStatusLabelForView(item, copy)}
          </span>
        ))}
      </div>
      <div className="agentreach-platform-counts">
        <span>{copy.directionEvidence} <strong>{props.directionSnapshot.direction_evidence_count}</strong></span>
        <span>{copy.directionCandidates} <strong>{props.directionSnapshot.direction_candidate_count}</strong></span>
        <span>{copy.pendingExternalSignals} <strong>{props.directionSnapshot.pending_external_signal_count}</strong></span>
      </div>
      <div className="agentreach-platform-note">
        <span aria-hidden="true">i</span>
        <p>{copy.platformBoundary}</p>
      </div>
    </aside>
  );
}

function CoverageStrip(props: {
  candidates: AgentReachCandidateCardViewModel[];
  coverage: AgentReachCoverageViewModel[];
  directionSnapshot: AgentReachViewProps["direction_snapshot"];
  selectedCandidateId: string | null;
  onSelectCandidate: (candidateId: string) => void;
  copy: AgentReachUiCopy;
}) {
  const copy = props.copy;
  return (
    <section className="agentreach-footer-status">
      <TrendObservationPanel
        candidates={props.candidates}
        directionSnapshot={props.directionSnapshot}
        selectedCandidateId={props.selectedCandidateId}
        onSelectCandidate={props.onSelectCandidate}
        copy={copy}
      />
      <PlatformStatusPanel coverage={props.coverage} directionSnapshot={props.directionSnapshot} copy={copy} />
    </section>
  );
}

export default function AgentReachView(inputProps: AgentReachViewProps) {
  const props = { ...DEFAULT_PROPS, ...inputProps };
  const copy = agentReachCopy(props.lang);
  const [activeType, setActiveType] = useState(() => defaultActiveType(props));
  const [sortMode, setSortMode] = useState<AgentReachSortMode>("attention");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(props.initialSelectedId ?? props.candidates[0]?.candidate_id ?? null);
  const workbenchRef = useRef<HTMLElement | null>(null);

  const filteredCandidates = useMemo(() => {
    return sortCandidates(
      props.candidates.filter((candidate) => candidateMatchesType(candidate, activeType)),
      sortMode,
    );
  }, [activeType, props.candidates, sortMode]);

  const paged = useMemo(() => paginate(filteredCandidates, page), [filteredCandidates, page]);
  const visibleIds = useMemo(() => new Set(paged.items.map((candidate) => candidate.candidate_id)), [paged.items]);

  useEffect(() => {
    setPage(1);
  }, [activeType, sortMode]);

  useEffect(() => {
    if (page !== paged.page) {
      setPage(paged.page);
    }
  }, [page, paged.page]);

  useEffect(() => {
    if (selectedId && visibleIds.has(selectedId)) return;
    setSelectedId(paged.items[0]?.candidate_id ?? null);
  }, [paged.items, selectedId, visibleIds]);

  const selectedCandidate = paged.items.find((candidate) => candidate.candidate_id === selectedId) ?? paged.items[0] ?? null;
  const statusFailed = props.status.provider_status === "failed";

  function handlePageChange(nextPage: number) {
    const nextPaged = paginate(filteredCandidates, nextPage);
    setPage(nextPaged.page);
    setSelectedId(nextPaged.items[0]?.candidate_id ?? null);
  }

  function handleTrendCandidateSelect(candidateId: string) {
    const allCandidates = sortCandidates(props.candidates, sortMode);
    const candidateIndex = allCandidates.findIndex((candidate) => candidate.candidate_id === candidateId);
    setActiveType("all");
    if (candidateIndex >= 0) {
      setPage(Math.floor(candidateIndex / PAGE_SIZE) + 1);
    }
    setSelectedId(candidateId);
    window.setTimeout(() => {
      workbenchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <div className="agentreach-view" data-lang={copy.lang}>
      <div className="agentreach-shell">
        <section className="agentreach-hero">
          <span className="agentreach-pill">{copy.heroPill}</span>
          <h1>{copy.heroTitle}</h1>
          <p>{copy.heroBody}</p>
          <div className="agentreach-hero-foot">
            <span className={`agentreach-chip ${toneClass(props.status.tone)}`}>{props.status.label}</span>
            <span className="agentreach-chip agentreach-tone-warn">{copy.secondaryWarning}</span>
            <span className="agentreach-chip agentreach-tone-neutral">{copy.dataSource} {props.status.data_source}</span>
          </div>
        </section>

        <section className="agentreach-filter-panel">
          <div className="agentreach-filter-row agentreach-filter-row-main">
            <span>{copy.filters}</span>
            <div className="agentreach-chip-scroll">
              <button className={`agentreach-filter-chip ${activeType === "all" ? "is-active" : ""}`} type="button" onClick={() => setActiveType("all")}>{copy.all}</button>
              {props.filters.type_chips.map((chip) => (
                <button
                  className={`agentreach-filter-chip ${activeType === chip.key ? "is-active" : ""}`}
                  type="button"
                  key={chip.key}
                  onClick={() => setActiveType(chip.key)}
                >
                  {typeLabel(chip.key, chip.label, copy)} {chip.count ?? 0}
                </button>
              ))}
            </div>
          </div>
          <div className="agentreach-filter-row agentreach-filter-row-sort">
            <span>{copy.sort}</span>
            <div className="agentreach-chip-scroll">
              {props.filters.sort_options.map((chip) => (
                <button
                  className={`agentreach-filter-chip ${sortMode === chip.key ? "is-active" : ""}`}
                  type="button"
                  key={chip.key}
                  onClick={() => setSortMode(chip.key as AgentReachSortMode)}
                >
                  {sortLabel(chip.key, chip.label, copy)}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="agentreach-summary-grid">
          {props.summary_cards.map((card) => <SummaryCard card={card} copy={copy} key={card.key} />)}
        </section>

        <section className="agentreach-workbench" data-empty={filteredCandidates.length === 0 ? "true" : "false"} ref={workbenchRef}>
          <div className="agentreach-list-panel">
            <div className="agentreach-panel-head">
              <div>
                <span className="agentreach-section-kicker">{copy.candidateList}</span>
                <h2>{copy.candidateTitle}</h2>
              </div>
              <span>{filteredCandidates.length}</span>
            </div>

            {statusFailed ? (
              <div className="agentreach-list-empty">
                <h3>{copy.listFailed}</h3>
                <p>{statusReasonForView(props.status.reason, copy)}</p>
              </div>
            ) : paged.items.length > 0 ? (
              <div className="agentreach-candidate-list">
                {paged.items.map((candidate) => (
                  <CandidateCard
                    key={candidate.candidate_id}
                    candidate={candidate}
                    selected={candidate.candidate_id === selectedId}
                    onSelect={setSelectedId}
                    copy={copy}
                  />
                ))}
              </div>
            ) : (
              <div className="agentreach-list-empty">
                <h3>{copy.noCandidates}</h3>
                <p>{copy.noCandidatesBody}</p>
              </div>
            )}

            <div className="agentreach-pagination">
              <span>{filteredCandidates.length > 0 ? `${paged.start + 1}-${paged.end} / ${filteredCandidates.length}` : "0 / 0"}</span>
              <div>
                <button type="button" disabled={paged.page <= 1} onClick={() => handlePageChange(paged.page - 1)}>{copy.previousPage}</button>
                <span>{paged.page} / {paged.pageCount}</span>
                <button type="button" disabled={paged.page >= paged.pageCount} onClick={() => handlePageChange(paged.page + 1)}>{copy.nextPage}</button>
              </div>
            </div>
          </div>

          <DetailPanel candidate={selectedCandidate} statusFailed={statusFailed} copy={copy} />
        </section>

        <CoverageStrip
          candidates={props.candidates}
          coverage={props.coverage}
          directionSnapshot={props.direction_snapshot}
          selectedCandidateId={selectedId}
          onSelectCandidate={handleTrendCandidateSelect}
          copy={copy}
        />
      </div>
    </div>
  );
}
