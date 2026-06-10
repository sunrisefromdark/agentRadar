import type {
  DailyReport,
  DailyRunSummary,
  DailyRunSummaryDiagnostics,
  LlmRunDiagnostics,
  DailyRunSummaryQuality,
  DailyRunSummarySourceStatus,
  DailyRunSummaryTopProject,
  EcosystemObserverEntry,
  ObserverStatus,
  MetricsSource,
  RawSignal,
  ScoredProject,
  SignalSource,
  StarDeltaSource,
} from "../types.ts";
import type { GitHubStarDeltaSummary } from "../signal/githubMetrics.ts";

const FRESHNESS_SOURCE_DISPLAY_NAMES: Record<string, string> = {
  "agents-radar": "agents-radar 历史上下文",
  trendshift_live: "Trendshift 当日命中",
  github_trending: "GitHub Trending",
  github_live_star_delta: "GitHub 当日涨星信号",
  watchlist_live_activity: "重点观察清单动态",
};

function displayFreshnessSourceName(source: string): string {
  return FRESHNESS_SOURCE_DISPLAY_NAMES[source] ?? source;
}

type SummaryRuleContext = {
  counts: DailyRunSummary["counts"];
  quality: DailyRunSummaryQuality;
  diagnostics?: DailyRunSummaryDiagnostics;
  sources: DailyRunSummarySourceStatus[];
  githubNotes?: string;
};

type SummaryRule = (context: SummaryRuleContext) => string | undefined;

/**
 * 运行摘要层承担的是“把 daily 主链路状态翻译成人类可读诊断”的责任。
 * 这里不重复做评分，只消费 scored projects / source status，
 * 输出给实测、排障、review 使用的质量快照和下一步动作。
 */

function distinctProjectsFromRaw(items: RawSignal[], source: RawSignal["source"]): number {
  return new Set(items.filter((item) => item.source === source).map((item) => item.repo_url.toLowerCase())).size;
}

function makeSourceStatus(
  source: RawSignal["source"] | "github-enrichment",
  enabled: boolean,
  itemCount: number,
  distinctProjects: number,
  notes: string[],
): DailyRunSummarySourceStatus {
  if (!enabled) {
    return {
      source,
      enabled,
      item_count: 0,
      distinct_projects: 0,
      status: "disabled",
      notes,
    };
  }

  return {
    source,
    enabled,
    item_count: itemCount,
    distinct_projects: distinctProjects,
    status: itemCount > 0 || distinctProjects > 0 ? "active" : "empty",
    notes,
  };
}

const FALLBACK_SOURCE_ORDER: SignalSource[] = [
  "agents-radar",
  "trendshift",
  "github_trending",
  "watchlist_live_activity",
];

const FALLBACK_SOURCE_NOTES: Record<SignalSource, string> = {
  "agents-radar": "primary local digest input inferred from cached raw signals",
  trendshift: "snapshot/http trend input inferred from cached raw signals",
  github_trending: "GitHub Trending realtime input inferred from cached raw signals",
  github_live_star_delta: "GitHub live star delta input inferred from cached raw signals",
  watchlist_live_activity: "watchlist realtime input inferred from cached raw signals",
  manual: "manual input inferred from cached raw signals",
};

function qualityMetrics(scored: ScoredProject[]): DailyRunSummaryQuality {
  return {
    missing_descriptions: scored.filter((item) => !item.project.description).length,
    watchlist_hits: scored.filter((item) => item.project.tags.includes("watchlist-hit")).length,
    low_confidence_projects: scored.filter((item) => item.score.confidence === "low").length,
    medium_confidence_projects: scored.filter((item) => item.score.confidence === "medium").length,
    insufficient_metrics_projects: scored.filter((item) =>
      item.score.anti_noise_flags.includes("insufficient_metrics"),
    ).length,
    suspicious_growth_projects: scored.filter((item) =>
      item.score.anti_noise_flags.includes("suspicious_growth"),
    ).length,
    single_source_projects: scored.filter((item) => item.score.anti_noise_flags.includes("single_source")).length,
    single_spike_projects: scored.filter((item) => item.project.persistence_state === "single-spike").length,
    emerging_projects: scored.filter((item) => item.project.persistence_state === "emerging").length,
    persistent_projects: scored.filter((item) => item.project.persistence_state === "persistent").length,
  };
}

function diagnostics(
  scored: ScoredProject[],
  counts: DailyRunSummary["counts"],
  githubStarDelta: GitHubStarDeltaSummary,
): DailyRunSummaryDiagnostics {
  const distribution: Record<MetricsSource, number> = {
    embedded: 0,
    github_api: 0,
    github_html: 0,
    github_cache: 0,
    unavailable: 0,
  };
  const starDeltaDistribution: Record<StarDeltaSource, number> = {
    github_live: 0,
    github_snapshot: 0,
    signal: 0,
    unavailable: 0,
  };
  const starVelocityScores = scored
    .map((item) => item.score.components.find((component) => component.name === "star_velocity")?.score)
    .filter((score): score is number => typeof score === "number");

  for (const item of scored) {
    distribution[item.project.metrics_source] += 1;
    starDeltaDistribution[item.project.star_delta_source ?? "unavailable"] += 1;
  }

  const anomalyShare = counts.scored_projects > 0 ? counts.anomaly_projects / counts.scored_projects : 0;
  const uniformStarVelocityDetected =
    starVelocityScores.length >= 5 &&
    starVelocityScores.every((score) => score >= 95) &&
    new Set(starVelocityScores).size <= 2;

  return {
    anomaly_share: Number(anomalyShare.toFixed(4)),
    uniform_star_velocity_detected: uniformStarVelocityDetected,
    metrics_source_distribution: distribution,
    star_delta_source_distribution: starDeltaDistribution,
    github_star_delta: {
      live_delta_attempts: githubStarDelta.live_delta_attempts,
      live_delta_success: githubStarDelta.live_delta_success,
      snapshot_delta_success: starDeltaDistribution.github_snapshot,
      token_missing: githubStarDelta.token_missing,
      auth_invalid: githubStarDelta.auth_invalid,
      rate_limit: githubStarDelta.rate_limit,
      network_blocked: githubStarDelta.network_blocked,
    },
  };
}

function topProjectReason(item: ScoredProject): string[] {
  const strongestComponents = [...item.score.components]
    .sort((a, b) => b.weighted_score - a.weighted_score)
    .slice(0, 3)
    .map((component) => {
      const primaryEvidence = component.evidence[0] ?? "no explicit evidence";
      return `${component.name}=${component.score} (${primaryEvidence})`;
    });

  return [
    `paradigm=${item.score.paradigm}`,
    `confidence=${item.score.confidence}`,
    `persistence=${item.project.persistence_state}`,
    ...strongestComponents,
  ];
}

function topProjects(report: DailyReport, scored: ScoredProject[]): DailyRunSummaryTopProject[] {
  const surfaced = [...report.today_star_projects, ...report.context_only_projects];
  if (surfaced.length > 0) {
    return surfaced.slice(0, 5).map((item) => ({
      project_name: item.project.project_name,
      repo_url: item.project.repo_url,
      total_score: item.score.total_score,
      base_final_rank: item.base_final_rank,
      final_rank: item.final_rank,
      confidence: item.score.confidence,
      paradigm: item.score.paradigm,
      position_qualification: item.position_qualification,
      position_rationale_cn: item.position_rationale_cn,
      judge_score_delta: item.judge_score_delta,
      summary_source: item.summary_source,
      judge_source: item.judge_source,
      why_selected: topProjectReason(item),
      risks: item.score.risks.slice(0, 3),
    }));
  }

  return scored.slice(0, 5).map((item) => ({
    project_name: item.project.project_name,
    repo_url: item.project.repo_url,
    total_score: item.score.total_score,
    confidence: item.score.confidence,
    paradigm: item.score.paradigm,
    why_selected: topProjectReason(item),
    risks: item.score.risks.slice(0, 3),
  }));
}

function sourceStatuses(
  raw: RawSignal[],
  scored: ScoredProject[],
  opts: {
    sourceStatus?: DailyRunSummarySourceStatus[];
  },
): DailyRunSummarySourceStatus[] {
  if (opts.sourceStatus && opts.sourceStatus.length > 0) return opts.sourceStatus;

  const githubEnrichedProjects = scored.filter(
    (item) => item.project.forks > 0 || item.project.issues > 0 || item.project.PR > 0,
  ).length;
  const inferredSources = [
    ...FALLBACK_SOURCE_ORDER,
    ...[...new Set(raw.map((item) => item.source))]
      .filter((source) => source !== "github_live_star_delta" && !FALLBACK_SOURCE_ORDER.includes(source)),
  ];

  return [
    ...inferredSources.map((source) =>
      makeSourceStatus(
        source,
        true,
        raw.filter((item) => item.source === source).length,
        distinctProjectsFromRaw(raw, source),
        [FALLBACK_SOURCE_NOTES[source]],
      )
    ),
    makeSourceStatus(
      "github-enrichment",
      true,
      githubEnrichedProjects,
      githubEnrichedProjects,
      ["project-level enrichment inferred from structured repo metrics"],
    ),
  ];
}

function completionNotes(
  counts: DailyRunSummary["counts"],
  sources: DailyRunSummarySourceStatus[],
  quality: DailyRunSummaryQuality,
  dryRun: boolean,
): string[] {
  const notes: string[] = [];

  notes.push(
    counts.raw_signals > 0 ? `原始信号阶段完成，共 ${counts.raw_signals} 条` : "原始信号阶段没有产出任何数据",
  );
  notes.push(
    counts.normalized_projects > 0
      ? `归一化阶段完成，共 ${counts.normalized_projects} 个项目`
      : "归一化阶段没有产出项目",
  );
  notes.push(
    counts.scored_projects > 0 ? `评分阶段完成，共 ${counts.scored_projects} 个已评分项目` : "评分阶段没有产出已评分项目",
  );

  const activeSources = sources.filter((source) => source.status === "active").length;
  notes.push(`本次运行活跃信号面: ${activeSources}/${sources.filter((source) => source.enabled).length}`);

  if (quality.low_confidence_projects > 0) {
    notes.push(`仍有 ${quality.low_confidence_projects} 个项目处于低置信度，需要后续验证`);
  }

  notes.push(dryRun ? "本次为 dry-run，仅验证产物逻辑" : "本次运行已成功写盘");
  return notes;
}

const COUNTS_WATCHOUT_RULES: SummaryRule[] = [
  ({ counts }) => (counts.raw_signals === 0 ? "daily 主链路没有拿到任何原始信号" : undefined),
  ({ counts }) => (counts.scored_projects === 0 ? "daily 主链路没有产出任何评分结果" : undefined),
];

function sourceStatusWatchout(source: DailyRunSummarySourceStatus): string | undefined {
  if (!source.enabled) return undefined;
  if (source.status === "empty") return `${source.source} 已启用，但本次没有产出可用数据`;
  if (source.status === "failed") return `${source.source} 在本次运行中失败`;
  return undefined;
}

const QUALITY_WATCHOUT_RULES: SummaryRule[] = [
  ({ counts, quality }) =>
    quality.low_confidence_projects > 0
      ? `低置信度项目占比为 ${quality.low_confidence_projects}/${counts.scored_projects || 1}`
      : undefined,
  ({ quality }) =>
    quality.suspicious_growth_projects > 0
      ? `有 ${quality.suspicious_growth_projects} 个项目出现可疑增长尖峰，需要人工复核 daily_delta`
      : undefined,
  ({ quality }) =>
    quality.single_source_projects > 0
      ? `仍有 ${quality.single_source_projects} 个项目只有单一信号源，需要跨源或跨天确认`
      : undefined,
  ({ quality }) =>
    quality.missing_descriptions > 0 ? `有 ${quality.missing_descriptions} 个项目缺少描述，语义判断会受限` : undefined,
];

function applyRules(context: SummaryRuleContext, rules: SummaryRule[]): string[] {
  return rules.map((rule) => rule(context)).filter((item): item is string => Boolean(item));
}

function watchouts(
  counts: DailyRunSummary["counts"],
  sources: DailyRunSummarySourceStatus[],
  quality: DailyRunSummaryQuality,
): string[] {
  const context: SummaryRuleContext = { counts, quality, sources };
  return [
    ...applyRules(context, COUNTS_WATCHOUT_RULES),
    ...sources.map(sourceStatusWatchout).filter((item): item is string => Boolean(item)),
    ...applyRules(context, QUALITY_WATCHOUT_RULES),
  ];
}

function disruptedSourceFocus(summary: DailyRunSummary): string[] {
  return summary.source_status
    .filter((item) => item.enabled && (item.status === "failed" || item.status === "empty"))
    .map((item) => `修复 ${item.source}，避免已启用信号源静默失效`);
}

const NEXT_FOCUS_RULES: Array<(summary: DailyRunSummary) => string | undefined> = [
  (summary) =>
    summary.minimum_viable_run_completed ? undefined : "先稳住 raw -> normalized -> score 主链路，再继续加 enrichment",
  (summary) =>
    summary.quality.low_confidence_projects > 0 ? "为低置信度项目补足描述或结构化 repo 指标" : undefined,
  (summary) =>
    summary.diagnostics.metrics_source_distribution.github_api === 0
      ? "尽快恢复 GitHub API 指标，避免长期依赖 HTML / cache / embedded metrics"
      : undefined,
  (summary) =>
    summary.quality.single_source_projects > 0 ? "在提升弱信号前，先确认跨天 persistence 或第二信号源" : undefined,
  (summary) =>
    summary.counts.high_score_projects === 0 && summary.counts.scored_projects > 0
      ? "如果已有较多评分结果但没有高分项目，回看阈值是否过严"
      : undefined,
];

function nextFocus(summary: DailyRunSummary): string[] {
  const focus = [
    ...NEXT_FOCUS_RULES.map((rule) => rule(summary)).filter((item): item is string => Boolean(item)),
    ...disruptedSourceFocus(summary),
  ];

  if (focus.length === 0) {
    focus.push("可以继续推进更强的 GitHub enrichment 与 weekly 趋势归纳");
  }

  return [...new Set(focus)].slice(0, 6);
}

function githubNotes(summary: DailyRunSummary): string {
  const githubSource = summary.source_status.find((source) => source.source === "github-enrichment");
  return githubSource?.notes.join(" | ").toLowerCase() ?? "";
}

const SOURCE_RECOVERY_ACTIONS: Record<
  DailyRunSummarySourceStatus["source"],
  Partial<Record<DailyRunSummarySourceStatus["status"], string[]>>
> = {
  "github-enrichment": {
    failed: [
      "GitHub 不稳定时，可先用 `--no-github` 保持 daily 主链路继续运行",
      "检查 `GITHUB_TOKEN`、GitHub API 连通性，以及 `tmp/github-metrics-cache/` cache 是否可用",
    ],
    empty: ["先确认 raw signals 里确实包含有效 GitHub repo URL，再期待 GitHub enrichment 生效"],
  },
  trendshift: {
    failed: [
      "把 Trendshift 切到 snapshot 模式，或确认当前日期对应的 snapshot 文件存在",
      "如果仍用 HTTP 模式，下一次运行前先确认 `trendshift.io` 可达",
    ],
    empty: ["检查 Trendshift snapshot 内容或 parser 假设，因为当前返回了 0 条信号"],
  },
  "agents-radar": {
    failed: ["检查 agents-radar manifest 路径和目标日期对应的 digest 目录"],
    empty: ["确认请求日期的 agents-radar digest 文件存在，并且里面仍包含 GitHub repo 链接"],
  },
  github_trending: {
    failed: ["检查 GitHub Trending 页面连通性，确认 `https://github.com/trending` 当前可访问"],
    empty: ["检查 GitHub Trending 页面结构是否变化，或当天是否真的没有可解析候选"],
  },
  github_live_star_delta: {
    failed: ["检查 `GITHUB_TOKEN`、GitHub stargazers API 配额与连通性，确认 live delta 没被限流或阻断"],
    empty: ["确认本次候选项目里至少有一批进入了 live delta 预算，并检查 snapshot 是否错误顶替 live 结果"],
  },
  watchlist_live_activity: {
    failed: ["检查 watchlist org GitHub API 连通性，确认 org repo 列表接口没有被限流或阻断"],
    empty: ["确认 watchlist org 当天确实有 pushed_at/updated_at 变化，或适当调整 org 列表"],
  },
  manual: {},
};

function sourceRecoveryActions(source: DailyRunSummarySourceStatus): string[] {
  if (!source.enabled || source.status === "active") return [];
  return SOURCE_RECOVERY_ACTIONS[source.source][source.status] ?? [];
}

const RECOMMENDED_ACTION_RULES: Array<(summary: DailyRunSummary, githubNotesText: string) => string | undefined> = [
  (summary) =>
    summary.quality.low_confidence_projects > 0 ? "在信任低置信度排序前，优先补有缺失描述或缺失 metrics 的项目" : undefined,
  (summary) =>
    summary.diagnostics.github_star_delta.token_missing > 0
      ? "当前 GitHub live star delta 仍因 token 缺失被跳过，补上 `GITHUB_TOKEN` 后再验证 live / snapshot 优先级"
      : undefined,
  (_, notes) =>
    notes.includes("github_api_timeout_or_blocked") || notes.includes("github_html_timeout_or_blocked")
      ? "当前环境到 GitHub 可能存在出站超时或被拦截，优先检查代理、防火墙和 `github.com` / `api.github.com` 连通性"
      : undefined,
  (_, notes) =>
    notes.includes("github_token=missing")
      ? "当前未设置 `GITHUB_TOKEN`；网络恢复后建议补上 token，减少 GitHub API 403/限流风险"
      : undefined,
  (summary) =>
    summary.diagnostics.metrics_source_distribution.github_html > 0
      ? "当前仍有项目依赖 GitHub HTML fallback，提升优先级恢复 API 指标来源"
      : undefined,
  (summary) =>
    summary.diagnostics.uniform_star_velocity_detected
      ? "star_velocity 分布异常一致，先检查 daily_delta 归一化是否失真"
      : undefined,
  (summary) =>
    summary.quality.single_source_projects > 0 ? "单源项目先等第二信号源或第二天 persistence，再考虑升级判断" : undefined,
  (summary) =>
    summary.counts.scored_projects > 0 && summary.counts.high_score_projects === 0
      ? "如果已有评分结果但始终没有高分项目，检查 threshold 设置是否过严"
      : undefined,
  (summary) =>
    summary.minimum_viable_run_completed ? "可以把这次运行当作稳定基线，继续推进更强的 GitHub enrichment 或 weekly 汇总" : undefined,
];

function recommendedActions(summary: DailyRunSummary): string[] {
  const notes = githubNotes(summary);
  const actions = [
    ...summary.source_status.flatMap(sourceRecoveryActions),
    ...RECOMMENDED_ACTION_RULES.map((rule) => rule(summary, notes)).filter((item): item is string => Boolean(item)),
  ];

  return [...new Set(actions)].slice(0, 8);
}

function buildSummaryCounts(raw: RawSignal[], scored: ScoredProject[], report: DailyReport): DailyRunSummary["counts"] {
  return {
    raw_signals: raw.length,
    normalized_projects: scored.length,
    scored_projects: scored.length,
    high_score_projects: report.high_score_projects.length,
    anomaly_projects: report.anomaly_projects.length,
    new_projects: report.new_projects.length,
    classifications: 0,
  };
}

function hasMinimumViableRun(counts: DailyRunSummary["counts"], sources: DailyRunSummarySourceStatus[]): boolean {
  return counts.raw_signals > 0 && counts.normalized_projects > 0 && counts.scored_projects > 0 && sources.some((item) => item.status === "active");
}

function buildEmptyDailyRunSummary(
  date: string,
  generatedAt: string,
  dryRun: boolean,
  sourceStatus: DailyRunSummarySourceStatus[],
  counts: DailyRunSummary["counts"],
  quality: DailyRunSummaryQuality,
  diag: DailyRunSummaryDiagnostics,
  scored: ScoredProject[],
  report: DailyReport,
): DailyRunSummary {
  const reportView = report as unknown as Pick<
    DailyRunSummary,
    | "overall_daily_status"
    | "freshness_sources"
    | "main_board_mode"
    | "today_fresh_candidate_count"
    | "today_star_count"
    | "context_candidate_count"
    | "pending_confirmation_count"
  >;
  const summary: DailyRunSummary = {
    date,
    generated_at: generatedAt,
    dry_run: dryRun,
    minimum_viable_run_completed: hasMinimumViableRun(counts, sourceStatus),
    completion_notes: [],
    llm_diagnostics: report.llm_diagnostics,
    overall_daily_status: reportView.overall_daily_status,
    freshness_sources: reportView.freshness_sources,
    main_board_mode: reportView.main_board_mode,
    today_fresh_candidate_count: reportView.today_fresh_candidate_count,
    today_star_count: report.today_star_projects.length,
    context_candidate_count: reportView.context_candidate_count,
    pending_confirmation_count: reportView.pending_confirmation_count,
    counts,
    source_status: sourceStatus,
    quality,
    diagnostics: diag,
    top_projects: topProjects(report, scored),
    observer_top_candidates: [],
    watchouts: [],
    next_focus: [],
    recommended_actions: [],
  };

  summary.completion_notes = completionNotes(counts, sourceStatus, quality, dryRun);
  summary.watchouts = watchouts(counts, sourceStatus, quality);
  summary.next_focus = nextFocus(summary);
  summary.recommended_actions = recommendedActions(summary);
  return summary;
}

export function buildDailyRunSummary(
  raw: RawSignal[],
  scored: ScoredProject[],
  report: DailyReport,
  opts: {
    date: string;
    generatedAt: string;
    dryRun: boolean;
    sourceStatus?: DailyRunSummarySourceStatus[];
    classificationsCount: number;
    llmDiagnostics?: LlmRunDiagnostics;
    githubStarDelta?: GitHubStarDeltaSummary;
    observer?: {
      status: ObserverStatus;
      candidateCount: number;
      ecosystemCounts: Record<string, number>;
      topCandidates: Array<
        Pick<
          EcosystemObserverEntry,
          | "repo_full_name"
          | "repo_url"
          | "observer_rank"
          | "base_observer_score"
          | "observer_score"
          | "ecosystems"
          | "labels"
          | "freshness_label"
          | "breakout_label"
          | "ecosystem_depth_label"
          | "long_tail_reason"
          | "pedigree"
          | "entity_tier"
          | "historical_precision_score"
          | "historical_precision_label"
          | "project_brief_cn"
          | "why_now_cn"
          | "watch_next_cn"
          | "summary_source"
          | "position_qualification"
          | "position_rationale_cn"
          | "judge_score_delta"
          | "judge_source"
          | "matched_by"
          | "source_notes"
        >
      >;
    };
  },
): DailyRunSummary {
  const counts = buildSummaryCounts(raw, scored, report);
  counts.classifications = opts.classificationsCount;
  const summarySources = sourceStatuses(raw, scored, { sourceStatus: opts.sourceStatus });
  const quality = qualityMetrics(scored);
  const diag = diagnostics(
    scored,
    counts,
    opts.githubStarDelta ?? {
      live_delta_attempts: 0,
      live_delta_success: 0,
      snapshot_delta_success: 0,
      token_missing: 0,
      auth_invalid: 0,
      rate_limit: 0,
      network_blocked: 0,
    },
  );
  const summary = buildEmptyDailyRunSummary(
    opts.date,
    opts.generatedAt,
    opts.dryRun,
    summarySources,
    counts,
    quality,
    diag,
    scored,
    report,
  );
  const reportLlmDiagnostics = report.llm_diagnostics;
  summary.llm_diagnostics =
    opts.llmDiagnostics || reportLlmDiagnostics
      ? {
          enabled: reportLlmDiagnostics?.enabled ?? opts.llmDiagnostics?.enabled ?? false,
          provider: reportLlmDiagnostics?.provider ?? opts.llmDiagnostics?.provider ?? "none",
          mode: opts.llmDiagnostics?.mode ?? reportLlmDiagnostics?.mode ?? "rules-only",
          classification_cache_hit_count: opts.llmDiagnostics?.classification_cache_hit_count,
          classification_attempt_count: opts.llmDiagnostics?.classification_attempt_count ?? 0,
          classification_success_count: opts.llmDiagnostics?.classification_success_count ?? 0,
          classification_failure_count: opts.llmDiagnostics?.classification_failure_count ?? 0,
          classification_last_error: opts.llmDiagnostics?.classification_last_error,
          summary_attempt_count: reportLlmDiagnostics?.summary_attempt_count,
          summary_success_count: reportLlmDiagnostics?.summary_success_count,
          summary_failure_count: reportLlmDiagnostics?.summary_failure_count,
          summary_last_error: reportLlmDiagnostics?.summary_last_error,
          judge_attempt_count: reportLlmDiagnostics?.judge_attempt_count,
          judge_success_count: reportLlmDiagnostics?.judge_success_count,
          judge_failure_count: reportLlmDiagnostics?.judge_failure_count,
          judge_last_error: reportLlmDiagnostics?.judge_last_error,
        }
      : undefined;
  summary.completion_notes = completionNotes(counts, summarySources, quality, opts.dryRun);
  if (opts.observer) {
    summary.observer_status = { ecosystem_focus: opts.observer.status };
    summary.observer_candidate_count = opts.observer.candidateCount;
    summary.observer_ecosystem_counts = opts.observer.ecosystemCounts;
    summary.observer_top_candidates = opts.observer.topCandidates;
  }
  return summary;
}

function statusLabel(status: DailyRunSummarySourceStatus["status"]): string {
  if (status === "active") return "active";
  if (status === "empty") return "empty";
  if (status === "failed") return "failed";
  return "disabled";
}

function renderMetricLines(summary: DailyRunSummary): string[] {
  return [
    `- watchlist 命中: ${summary.quality.watchlist_hits}`,
    `- 低置信度项目: ${summary.quality.low_confidence_projects}`,
    `- 中等置信度项目: ${summary.quality.medium_confidence_projects}`,
    `- 缺少描述: ${summary.quality.missing_descriptions}`,
    `- 缺少结构化指标: ${summary.quality.insufficient_metrics_projects}`,
    `- 可疑增长项目: ${summary.quality.suspicious_growth_projects}`,
    `- 单一信号源项目: ${summary.quality.single_source_projects}`,
    `- 单日出现项目: ${summary.quality.single_spike_projects}`,
    `- emerging 项目: ${summary.quality.emerging_projects}`,
    `- persistent 项目: ${summary.quality.persistent_projects}`,
  ];
}

function renderDiagnostics(summary: DailyRunSummary): string[] {
  return [
    `- anomaly_share: ${summary.diagnostics.anomaly_share}`,
    `- uniform_star_velocity_detected: ${summary.diagnostics.uniform_star_velocity_detected ? "true" : "false"}`,
    `- metrics_source_distribution: api=${summary.diagnostics.metrics_source_distribution.github_api}, html=${summary.diagnostics.metrics_source_distribution.github_html}, cache=${summary.diagnostics.metrics_source_distribution.github_cache}, embedded=${summary.diagnostics.metrics_source_distribution.embedded}, unavailable=${summary.diagnostics.metrics_source_distribution.unavailable}`,
    `- star_delta_source_distribution: live=${summary.diagnostics.star_delta_source_distribution.github_live}, snapshot=${summary.diagnostics.star_delta_source_distribution.github_snapshot}, signal=${summary.diagnostics.star_delta_source_distribution.signal}, unavailable=${summary.diagnostics.star_delta_source_distribution.unavailable}`,
    `- github_star_delta: live_attempts=${summary.diagnostics.github_star_delta.live_delta_attempts}, live_success=${summary.diagnostics.github_star_delta.live_delta_success}, snapshot_success=${summary.diagnostics.github_star_delta.snapshot_delta_success}, token_missing=${summary.diagnostics.github_star_delta.token_missing}, auth_invalid=${summary.diagnostics.github_star_delta.auth_invalid ?? 0}, rate_limit=${summary.diagnostics.github_star_delta.rate_limit}, network_blocked=${summary.diagnostics.github_star_delta.network_blocked}`,
  ];
}

function renderTopProjects(top: DailyRunSummaryTopProject[]): string[] {
  if (top.length === 0) return ["- 本次运行没有可展示项目"];
  return top.flatMap((item) => [
    `- [${item.project_name}](${item.repo_url}) | 分数 ${item.total_score} | 置信度 ${item.confidence} | 范式 ${item.paradigm}`,
    ...(typeof item.base_final_rank === "number" || typeof item.final_rank === "number"
      ? [
          `  - 排名裁决: base_final_rank=${item.base_final_rank ?? "unknown"} | final_rank=${item.final_rank ?? "unknown"} | qualification=${item.position_qualification ?? "unknown"} | judge_delta=${item.judge_score_delta ?? 0}`,
        ]
      : []),
    ...(item.position_rationale_cn ? [`  - 位置理由: ${item.position_rationale_cn}`] : []),
    `  - 入选原因: ${item.why_selected.join(" | ")}`,
    `  - 风险: ${item.risks.length > 0 ? item.risks.join(" | ") : "无"}`,
  ]);
}

function renderOptionalList(title: string, items: string[], emptyText: string): string[] {
  return [title, "", ...(items.length > 0 ? items.map((item) => `- ${item}`) : [`- ${emptyText}`]), ""];
}

function renderFreshnessSources(summary: DailyRunSummary): string[] {
  const sources = summary.freshness_sources ?? [];
  if (sources.length === 0) {
    return ["- 暂无 freshness_sources，仍在使用兼容输出"];
  }

  return sources.map((source) => {
    const role = source.source_role ? ` [${source.source_role}]` : "";
    const status = source.status_summary_cn ?? "暂无可读状态";
    return `- ${displayFreshnessSourceName(source.source)}${role}: ${source.freshness_state} | effective_date=${source.effective_date ?? "unknown"} | realtime=${source.from_realtime_run ? "true" : "false"} | ${status}`;
  });
}

function renderLlmDiagnostics(summary: DailyRunSummary): string[] {
  const diagnostics = summary.llm_diagnostics;
  if (!diagnostics) {
    return ["- 暂无 LLM 运行诊断信息"];
  }

  return [
    `- enabled: ${diagnostics.enabled ? "true" : "false"}`,
    `- provider: ${diagnostics.provider}`,
    `- mode: ${diagnostics.mode}`,
    `- classification_cache_hit_count: ${diagnostics.classification_cache_hit_count ?? 0}`,
    `- classification_attempt_count: ${diagnostics.classification_attempt_count}`,
    `- classification_success_count: ${diagnostics.classification_success_count}`,
    `- classification_failure_count: ${diagnostics.classification_failure_count}`,
    `- summary_attempt_count: ${diagnostics.summary_attempt_count ?? 0}`,
    `- summary_success_count: ${diagnostics.summary_success_count ?? 0}`,
    `- summary_failure_count: ${diagnostics.summary_failure_count ?? 0}`,
    `- judge_attempt_count: ${diagnostics.judge_attempt_count ?? 0}`,
    `- judge_success_count: ${diagnostics.judge_success_count ?? 0}`,
    `- judge_failure_count: ${diagnostics.judge_failure_count ?? 0}`,
    ...(diagnostics.classification_last_error ? [`- latest_provider_error: ${diagnostics.classification_last_error}`] : []),
    ...(diagnostics.summary_last_error ? [`- latest_summary_error: ${diagnostics.summary_last_error}`] : []),
    ...(diagnostics.judge_last_error ? [`- latest_judge_error: ${diagnostics.judge_last_error}`] : []),
  ];
}

function renderObserverSummary(summary: DailyRunSummary): string[] {
  if (!summary.observer_status) return ["- ecosystem_focus: unavailable"];
  const topCandidatesInput = summary.observer_top_candidates ?? [];

  const counts =
    summary.observer_ecosystem_counts && Object.keys(summary.observer_ecosystem_counts).length > 0
      ? Object.entries(summary.observer_ecosystem_counts)
          .map(([name, count]) => `${name}=${count}`)
          .join(", ")
      : "none";
  const topCandidates =
    topCandidatesInput.length > 0
      ? topCandidatesInput.map((item) => {
          const ecosystems = item.ecosystems.join(", ") || "none";
          const keywords = item.matched_by.keywords.join(", ") || "none";
          const labels = item.labels?.join(", ") || "none";
          return `- #${item.observer_rank ?? "?"} ${item.repo_full_name}: score=${item.observer_score ?? "unknown"}; tier=${item.entity_tier ?? "none"}; history=${item.historical_precision_label ?? "none"}; qualification=${item.position_qualification ?? "unknown"}; ecosystems=${ecosystems}; keywords=${keywords}; labels=${labels}`;
        })
      : ["- none"];

  return [
    `- ecosystem_focus: ${summary.observer_status.ecosystem_focus}`,
    `- observer_candidate_count: ${summary.observer_candidate_count ?? 0}`,
    `- observer_ecosystem_counts: ${counts}`,
    ...topCandidates,
  ];
}

export function renderDailyRunSummary(summary: DailyRunSummary): string {
  return [
    `# Agent Trend Radar 运行摘要 ${summary.date}`,
    "",
    `> 生成时间 ${summary.generated_at}`,
    "",
    "## 新鲜度摘要",
    "",
    `- overall_daily_status: ${summary.overall_daily_status ?? "unknown"}`,
    `- main_board_mode: ${summary.main_board_mode ?? "unknown"}`,
    `- today_fresh_candidate_count: ${summary.today_fresh_candidate_count ?? 0}`,
    `- today_star_count: ${summary.today_star_count ?? 0}`,
    `- context_candidate_count: ${summary.context_candidate_count ?? 0}`,
    `- pending_confirmation_count: ${summary.pending_confirmation_count ?? 0}`,
    ...renderFreshnessSources(summary),
    "",
    "## LLM 诊断",
    "",
    ...renderLlmDiagnostics(summary),
    "",
    "## MVP 完成信号",
    "",
    `- 是否完成: ${summary.minimum_viable_run_completed ? "是" : "否"}`,
    `- dry_run: ${summary.dry_run ? "true" : "false"}`,
    ...summary.completion_notes.map((note) => `- ${note}`),
    "",
    "## 阶段计数",
    "",
    `- 原始信号: ${summary.counts.raw_signals}`,
    `- 归一化项目: ${summary.counts.normalized_projects}`,
    `- 已评分项目: ${summary.counts.scored_projects}`,
    `- 高分项目: ${summary.counts.high_score_projects}`,
    `- 异常增长项目: ${summary.counts.anomaly_projects}`,
    `- 新项目: ${summary.counts.new_projects}`,
    `- classifications: ${summary.counts.classifications}`,
    "",
    "## 数据源状态",
    "",
    ...summary.source_status.map(
      (source) => `- ${source.source}: ${statusLabel(source.status)} | enabled=${source.enabled} | items=${source.item_count} | projects=${source.distinct_projects}`,
    ),
    "",
    "## Observer Status",
    "",
    ...renderObserverSummary(summary),
    "",
    "## 质量快照",
    "",
    ...renderMetricLines(summary),
    "",
    "## 诊断信息",
    "",
    ...renderDiagnostics(summary),
    "",
    "## Top 项目",
    "",
    ...renderTopProjects(summary.top_projects),
    "",
    ...renderOptionalList("## 风险提示", summary.watchouts, "当前没有明显风险提示"),
    ...renderOptionalList("## 下一步重点", summary.next_focus, "当前没有额外重点"),
    ...renderOptionalList("## 建议动作", summary.recommended_actions, "当前没有额外动作"),
  ].join("\n");
}
