import type { AppConfig } from "../config.ts";
import type { Logger } from "../logger.ts";
import type {
  DailyFreshnessSource,
  DailyRunSummarySourceStatus,
  FreshnessState,
  GitHubEnrichmentAuditEntry,
  RawSignal,
  ScoredProject,
} from "../types.ts";
import { withRetry } from "../retry.ts";
import { scoreProjects } from "../filter/scoring.ts";
import { normalizeSignals } from "../normalize.ts";
import {
  fetchAgentsRadarSignalsDetailed,
  type AgentsRadarFetchResult,
} from "./agentsRadarConnector.ts";
import {
  fetchGitHubTrendingSignals,
  fetchWatchlistLiveActivitySignals,
  type RealtimeSourceFetchResult,
} from "./githubRealtimeConnectors.ts";
import {
  extractGitHubRepoFullName,
  fetchGitHubRepoMetricsDetailed,
  resolveGitHubStarDeltas,
  seedGitHubRepoMetricsCacheFromSignal,
  type GitHubStarDeltaSummary,
} from "./githubMetrics.ts";
import { RawSignalValidationError, validateRawSignals } from "./rawSignalSchema.ts";
import {
  fetchTrendshiftSignalsDetailed,
  type TrendshiftFetchResult,
} from "./trendshiftConnector.ts";
import { annotateWatchlistSignals } from "./watchlist.ts";

type GitHubMetricsResult = Awaited<ReturnType<typeof fetchGitHubRepoMetricsDetailed>>;

interface SourceCollection {
  rows: RawSignal[];
  sourceStatus: DailyRunSummarySourceStatus;
  freshnessSource: DailyFreshnessSource;
}

interface PrimarySourcesResult {
  agentsRadar: SourceCollection;
  trendshift: SourceCollection;
  githubTrending: SourceCollection;
  watchlistLiveActivity: SourceCollection;
  raw: RawSignal[];
  freshnessSources: DailyFreshnessSource[];
}

interface GitHubEnrichmentStats {
  repoKeys: Set<string>;
  seededCacheCount: number;
  apiHits: number;
  htmlHits: number;
  cacheHits: number;
  unavailableHits: number;
  invalidRepoHits: number;
  enrichmentNotes: Set<string>;
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function mapInBatches<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map((item, index) => mapper(item, i + index)));
    results.push(...chunkResults);
  }
  return results;
}

export interface RawSignalCollectionResult {
  rawSignals: RawSignal[];
  sourceStatus: DailyRunSummarySourceStatus[];
  freshnessSources: DailyFreshnessSource[];
  githubEnrichment: GitHubEnrichmentAuditEntry[];
  githubStarDelta: GitHubStarDeltaSummary;
}

function freshnessStateFromResolvedDate(
  resolvedDate: string,
  requestedDate: string,
  fallbackUsed: boolean,
  signalCount: number,
): FreshnessState {
  if (signalCount === 0 && !fallbackUsed) return "unavailable";
  if (!fallbackUsed && resolvedDate === requestedDate) return "fresh_today";

  const resolved = new Date(`${resolvedDate}T00:00:00.000Z`);
  const requested = new Date(`${requestedDate}T00:00:00.000Z`);
  const deltaDays = Math.max(0, Math.round((requested.getTime() - resolved.getTime()) / 86_400_000));
  if (deltaDays <= 2) return "fallback_recent";
  return "fallback_stale";
}

function fallbackReasonFromNotes(notes: string[]): string | undefined {
  const candidates = notes.filter((note) => /fallback|missing|failed|unavailable|repo_sync_failed|producer_environment_unready|producer_run_failed/i.test(note));
  return candidates[0];
}

function diagnosticReasonFromNotes(notes: string[]): string | undefined {
  const candidates = notes.filter((note) => /repo_sync_failed|producer_environment_unready|failed|unavailable|missing/i.test(note));
  return candidates[0];
}

function displayFreshnessSourceName(source: string): string {
  if (source === "agents-radar") return "agents-radar 历史上下文";
  if (source === "trendshift_live") return "Trendshift 当日命中";
  if (source === "github_trending") return "GitHub Trending";
  if (source === "github_live_star_delta") return "GitHub 当日涨星信号";
  if (source === "watchlist_live_activity") return "重点观察清单动态";
  return source;
}

function freshnessSummaryCn(
  source: string,
  freshnessSourceName: string,
  freshnessState: FreshnessState,
  result: Pick<AgentsRadarFetchResult | TrendshiftFetchResult, "resolved_date" | "requested_date" | "fallback_used" | "notes" | "signals">,
): string {
  const date = result.resolved_date ?? result.requested_date;
  if (source === "agents-radar") {
    if (freshnessState === "fresh_today") return `agents-radar 仓库已同步，可读取 ${date} 的最新 digest`;
    if (result.notes.some((note) => note === "repo_sync_failed" || note === "producer_environment_unready")) {
      return `agents-radar 同步失败，已改读 ${date} 的历史 digest`;
    }
    if (result.notes.some((note) => note === "manifest_missing")) {
      return `agents-radar 已同步，但 manifest 缺失，只能回退到 ${date} 的历史 digest`;
    }
    if (result.notes.some((note) => note === "digest_missing_for_requested_date" || note === "report_parse_partial")) {
      return `agents-radar 已同步，但当天 digest 不完整，已回退到 ${date} 的历史 digest`;
    }
    return `agents-radar 使用 ${date} 的历史 digest 作为上下文`;
  }

  if (freshnessSourceName === "trendshift_live") {
    if (freshnessState === "fresh_today") return `Trendshift 实时抓取成功，发现 ${result.signals.length} 个候选`;
    if (freshnessState === "fallback_recent" || freshnessState === "fallback_stale") {
      return `Trendshift 当前未拿到最新实时信号，已回退到 ${date} 的可用快照`;
    }
  }

  if (freshnessSourceName === "github_trending") {
    if (freshnessState === "fresh_today") return `GitHub Trending 实时抓取成功，发现 ${result.signals.length} 个候选`;
    return "GitHub Trending 当前没有可用实时信号";
  }

  if (freshnessSourceName === "watchlist_live_activity") {
    if (freshnessState === "fresh_today") return `重点观察清单实时活动成功，发现 ${result.signals.length} 个候选`;
    return "重点观察清单当天没有新的实时活动";
  }

  return freshnessState === "fresh_today"
    ? "实时信号抓取成功"
    : "实时信号当前不可用，已降级为上下文";
}

function buildFreshnessSource(
  source: string,
  sourceRole: DailyFreshnessSource["source_role"],
  freshnessSourceName: string,
  result: Pick<AgentsRadarFetchResult | TrendshiftFetchResult, "resolved_date" | "requested_date" | "fallback_used" | "notes" | "signals">,
): DailyFreshnessSource {
  const freshnessState = freshnessStateFromResolvedDate(
    result.resolved_date,
    result.requested_date,
    result.fallback_used,
    result.signals.length,
  );
  return {
    source: freshnessSourceName,
    effective_date: result.resolved_date ?? null,
    freshness_state: freshnessState,
    fallback_reason: result.fallback_used ? fallbackReasonFromNotes(result.notes) : undefined,
    status_summary_cn: freshnessSummaryCn(source, freshnessSourceName, freshnessState, result),
    diagnostic_reason: diagnosticReasonFromNotes(result.notes),
    diagnostic_ref: result.notes.find((note) => /repo_sync_failed|producer_environment_unready|producer_run_failed/i.test(note)),
    from_realtime_run: !result.fallback_used && freshnessState === "fresh_today",
    source_role: sourceRole,
  };
}

function metricsTrustForSource(source: RawSignal["metrics_source"]): number {
  if (source === "github_api") return 1;
  if (source === "github_cache") return 0.7;
  if (source === "embedded") return 0.6;
  if (source === "github_html") return 0.3;
  return 0;
}

function annotateSignalMetricsTrust(signal: RawSignal): RawSignal {
  const hasStructuredMetrics =
    signal.stars !== undefined || signal.forks !== undefined || signal.issues !== undefined || signal.PR !== undefined;
  const metricsSource = signal.metrics_source ?? (hasStructuredMetrics ? "embedded" : "unavailable");
  return {
    ...signal,
    metrics_source: metricsSource,
    metrics_trust_score: signal.metrics_trust_score ?? metricsTrustForSource(metricsSource),
    star_delta_source: signal.star_delta !== undefined ? "signal" : "unavailable",
  };
}

function metricsSourceFromGitHubStatus(status: GitHubMetricsResult["status"]): RawSignal["metrics_source"] {
  if (status === "api") return "github_api";
  if (status === "html") return "github_html";
  if (status === "cache") return "github_cache";
  return "unavailable";
}

function mergeSignalWithMetrics(
  signal: RawSignal,
  metrics: GitHubMetricsResult["metrics"],
  status?: GitHubMetricsResult["status"],
): RawSignal {
  if (!metrics) return signal;
  const metricsSource = metricsSourceFromGitHubStatus(status ?? "unavailable");
  return {
    ...signal,
    project_name: signal.project_name || metrics.repo_full_name,
    repo_url: metrics.repo_url,
    stars: signal.stars ?? metrics.stars,
    forks: signal.forks ?? metrics.forks,
    issues: signal.issues ?? metrics.issues,
    PR: signal.PR ?? metrics.PR,
    tags: [...new Set([...signal.tags, ...metrics.tags])],
    description: signal.description || metrics.description,
    metrics_source: metricsSource,
    metrics_trust_score: metricsTrustForSource(metricsSource),
  };
}

function summarizeSourceStatus(
  source: DailyRunSummarySourceStatus["source"],
  enabled: boolean,
  rows: RawSignal[],
  status: DailyRunSummarySourceStatus["status"],
  notes: string[],
): DailyRunSummarySourceStatus {
  return {
    source,
    enabled,
    item_count: rows.length,
    distinct_projects: new Set(rows.map((item) => item.repo_url.toLowerCase())).size,
    status,
    notes,
  };
}

async function collectSourceSignalsDetailed<TResult extends AgentsRadarFetchResult | TrendshiftFetchResult>(
  source: "agents-radar" | "trendshift",
  enabled: boolean,
  fetcher: () => Promise<TResult>,
  logger: Logger,
  sourceRole: DailyFreshnessSource["source_role"],
  freshnessSourceName: string,
): Promise<{ collection: SourceCollection; detailed: TResult }> {
  if (!enabled) {
    const detailed = {
      signals: [],
      requested_date: new Date().toISOString().slice(0, 10),
      resolved_date: new Date().toISOString().slice(0, 10),
      fallback_used: false,
      notes: ["disabled by CLI flag"],
    } as unknown as TResult;

    return {
      collection: {
        rows: [],
        sourceStatus: summarizeSourceStatus(source, false, [], "disabled", ["disabled by CLI flag"]),
        freshnessSource: {
          source: freshnessSourceName,
          effective_date: null,
          freshness_state: "unavailable",
          fallback_reason: "disabled by CLI flag",
          from_realtime_run: false,
          source_role: sourceRole,
        },
      },
      detailed,
    };
  }

  try {
    const detailed = await fetcher();
    const rows = detailed.signals;
    const status = rows.length > 0 ? "active" : "empty";
    const notes = [
      ...(rows.length > 0
        ? [`source produced ${rows.length} raw signals`]
        : ["source completed successfully but produced no signals"]),
      ...detailed.notes,
    ];
    return {
      collection: {
        rows,
        sourceStatus: summarizeSourceStatus(source, true, rows, status, notes),
        freshnessSource: buildFreshnessSource(source, sourceRole, freshnessSourceName, detailed),
      },
      detailed,
    };
  } catch (error) {
    logger.warn(`${source} source unavailable`, { error: String(error) });
    const fallbackDate = new Date().toISOString().slice(0, 10);
    const diagnosticReason = error instanceof Error ? error.message : String(error);
    const detailed = {
      signals: [],
      requested_date: fallbackDate,
      resolved_date: fallbackDate,
      fallback_used: false,
      notes: [`${source} source refresh failed`],
    } as unknown as TResult;
    return {
      collection: {
        rows: [],
        sourceStatus: summarizeSourceStatus(source, true, [], "failed", [`${source} source refresh failed`]),
        freshnessSource: {
          source: freshnessSourceName,
          effective_date: null,
          freshness_state: "unavailable",
          fallback_reason: `${source} source refresh failed`,
          status_summary_cn: `${displayFreshnessSourceName(freshnessSourceName)} 当前不可用，已降级为上下文信号`,
          diagnostic_reason: diagnosticReason,
          diagnostic_ref: "source_refresh_failed",
          from_realtime_run: false,
          source_role: sourceRole,
        },
      },
      detailed,
    };
  }
}

function logRawSignalValidationError(logger: Logger, error: RawSignalValidationError): void {
  logger.error("raw signal schema validation failed", {
    index: error.index,
    field: error.field,
    reason: error.reason,
  });
}

async function collectPrimarySourceSignals(
  config: AppConfig,
  logger: Logger,
  opts: {
    date?: string;
    dryRun?: boolean;
    includeAgentsRadar?: boolean;
    includeTrendshift?: boolean;
  },
): Promise<PrimarySourcesResult> {
  const requestedDate = opts.date ?? new Date().toISOString().slice(0, 10);
  const [agentsRadarResult, trendshiftResult, githubTrendingResult, watchlistLiveActivityResult] = await Promise.all([
    collectSourceSignalsDetailed(
      "agents-radar",
      opts.includeAgentsRadar !== false,
      () =>
        withRetry("agents-radar", config.runtime.retry.attempts, config.runtime.retry.baseDelayMs, () =>
          fetchAgentsRadarSignalsDetailed(config.sources.agentsRadar, { date: opts.date }),
      ),
      logger,
      "context",
      "agents-radar",
    ),
    collectSourceSignalsDetailed(
      "trendshift",
      opts.includeTrendshift !== false,
      () =>
        withRetry("trendshift", config.runtime.retry.attempts, config.runtime.retry.baseDelayMs, () =>
          fetchTrendshiftSignalsDetailed(config.sources.trendshift, { date: opts.date, dryRun: opts.dryRun }),
      ),
      logger,
      "freshness-driving",
      "trendshift_live",
    ),
    fetchGitHubTrendingSignals(requestedDate),
    fetchWatchlistLiveActivitySignals(config.sources.watchlistOrgs, requestedDate),
  ]);

  const agentsRadar = agentsRadarResult.collection;
  const trendshift = trendshiftResult.collection;
  const githubTrending = realtimeCollectionToSourceCollection("github_trending", true, githubTrendingResult);
  const watchlistLiveActivity = realtimeCollectionToSourceCollection(
    "watchlist_live_activity",
    true,
    watchlistLiveActivityResult,
  );

  return {
    agentsRadar,
    trendshift,
    githubTrending,
    watchlistLiveActivity,
    raw: [...agentsRadar.rows, ...trendshift.rows, ...githubTrending.rows, ...watchlistLiveActivity.rows],
    freshnessSources: [
      agentsRadar.freshnessSource,
      trendshift.freshnessSource,
      githubTrending.freshnessSource,
      watchlistLiveActivity.freshnessSource,
    ],
  };
}

function realtimeCollectionToSourceCollection(
  source: "github_trending" | "watchlist_live_activity",
  enabled: boolean,
  result: RealtimeSourceFetchResult,
): SourceCollection {
  if (!enabled) {
    return {
      rows: [],
      sourceStatus: summarizeSourceStatus(source, false, [], "disabled", ["disabled by config"]),
      freshnessSource: {
        source,
        effective_date: null,
        freshness_state: "unavailable",
        fallback_reason: "disabled by config",
        from_realtime_run: false,
        source_role: "freshness-driving",
      },
    };
  }

  const status = result.signals.length > 0 ? "active" : "empty";
  return {
    rows: result.signals,
    sourceStatus: summarizeSourceStatus(source, true, result.signals, status, result.notes),
    freshnessSource: result.freshnessSource,
  };
}

function buildGitHubLiveDeltaSignals(signals: RawSignal[], date: string): RawSignal[] {
  const timestamp = `${date}T00:00:00.000Z`;
  const byRepo = new Map<string, RawSignal>();

  for (const signal of signals) {
    if (signal.star_delta_source !== "github_live") continue;
    const repoKey = extractGitHubRepoFullName(signal.repo_url).toLowerCase();
    if (!repoKey) continue;

    const candidate: RawSignal = {
      ...signal,
      source: "github_live_star_delta",
      timestamp,
      tags: [...new Set([...signal.tags, "github-live-star-delta", "fresh-today"])],
    };
    const existing = byRepo.get(repoKey);
    if (!existing || (candidate.star_delta ?? 0) > (existing.star_delta ?? 0)) {
      byRepo.set(repoKey, candidate);
    }
  }

  return [...byRepo.values()];
}

function buildGitHubLiveDeltaFreshnessSource(
  date: string,
  liveDeltaSignals: RawSignal[],
  summary: GitHubStarDeltaSummary,
): DailyFreshnessSource {
  if (liveDeltaSignals.length > 0) {
    return {
      source: "github_live_star_delta",
      effective_date: date,
      freshness_state: "fresh_today",
      status_summary_cn: `GitHub 当日涨星信号实时解析成功，发现 ${liveDeltaSignals.length} 个候选`,
      from_realtime_run: true,
      source_role: "freshness-driving",
    };
  }

  if (summary.snapshot_delta_success > 0) {
    return {
      source: "github_live_star_delta",
      effective_date: date,
      freshness_state: "fallback_recent",
      fallback_reason: "live star delta unavailable; using snapshot deltas",
      status_summary_cn: `GitHub 当日涨星信号当前不可用，已回退到快照结果（${summary.snapshot_delta_success} 个成功）`,
      from_realtime_run: false,
      source_role: "freshness-driving",
    };
  }

  return {
    source: "github_live_star_delta",
    effective_date: date,
    freshness_state: "unavailable",
    fallback_reason: "no realtime github_live_star_delta candidates resolved in this run",
    status_summary_cn: "GitHub 当日涨星信号当前不可用，本次未解析到可用实时结果",
    from_realtime_run: false,
    source_role: "freshness-driving",
  };
}

function validateAndAnnotateSignals(raw: RawSignal[], config: AppConfig, logger: Logger): RawSignal[] {
  try {
    const validated = validateRawSignals(raw).map(annotateSignalMetricsTrust);
    const watchlistAnnotated = annotateWatchlistSignals(validated, config.sources.watchlistOrgs);
    const watchlistHits = watchlistAnnotated.filter((signal) => signal.tags.includes("watchlist-hit")).length;
    logger.info("collected raw signals", { count: raw.length });
    if (watchlistHits > 0) {
      logger.info("annotated watchlist signals", { watchlistHits });
    }
    return watchlistAnnotated;
  } catch (error) {
    if (error instanceof RawSignalValidationError) {
      logRawSignalValidationError(logger, error);
    }
    throw error;
  }
}

function buildGithubDisabledStatus(): DailyRunSummarySourceStatus {
  return summarizeSourceStatus("github-enrichment", false, [], "disabled", ["disabled by CLI flag"]);
}

function createGitHubEnrichmentStats(): GitHubEnrichmentStats {
  return {
    repoKeys: new Set<string>(),
    seededCacheCount: 0,
    apiHits: 0,
    htmlHits: 0,
    cacheHits: 0,
    unavailableHits: 0,
    invalidRepoHits: 0,
    enrichmentNotes: new Set<string>(),
  };
}

function seedGitHubCache(signals: RawSignal[], stats: GitHubEnrichmentStats): void {
  for (const signal of signals) {
    if (seedGitHubRepoMetricsCacheFromSignal(signal)) stats.seededCacheCount += 1;
  }
}

function recordRepoKey(stats: GitHubEnrichmentStats, repoUrl: string): string {
  const repoKey = extractGitHubRepoFullName(repoUrl).toLowerCase();
  if (repoKey) stats.repoKeys.add(repoKey);
  return repoKey;
}

function recordMetricsResult(stats: GitHubEnrichmentStats, result: GitHubMetricsResult): void {
  if (result.status === "api") stats.apiHits += 1;
  if (result.status === "html") stats.htmlHits += 1;
  if (result.status === "cache") stats.cacheHits += 1;
  if (result.status === "unavailable") stats.unavailableHits += 1;
  if (result.status === "invalid_repo") stats.invalidRepoHits += 1;
  for (const note of result.notes) stats.enrichmentNotes.add(note);
}

function summarizeGitHubStatus(stats: GitHubEnrichmentStats): DailyRunSummarySourceStatus["status"] {
  if (stats.repoKeys.size === 0) return "empty";
  if (stats.apiHits > 0 || stats.htmlHits > 0 || stats.cacheHits > 0) return "active";
  if (stats.unavailableHits > 0 || stats.invalidRepoHits > 0) return "failed";
  return "empty";
}

function buildGitHubNotes(stats: GitHubEnrichmentStats): string[] {
  return [
    `candidate repos=${stats.repoKeys.size}`,
    `seeded_cache_from_signals=${stats.seededCacheCount}`,
    `api_hits=${stats.apiHits}`,
    `html_hits=${stats.htmlHits}`,
    `cache_hits=${stats.cacheHits}`,
    `unavailable=${stats.unavailableHits}`,
    `invalid_repo=${stats.invalidRepoHits}`,
    ...[...stats.enrichmentNotes].slice(0, 4),
  ];
}

function buildGitHubSourceStatus(stats: GitHubEnrichmentStats): DailyRunSummarySourceStatus {
  return {
    source: "github-enrichment",
    enabled: true,
    item_count: stats.apiHits + stats.htmlHits + stats.cacheHits,
    distinct_projects: stats.repoKeys.size,
    status: summarizeGitHubStatus(stats),
    notes: buildGitHubNotes(stats),
  };
}

async function fetchGitHubMetricsOnce(
  signal: RawSignal,
  cache: Map<string, Promise<GitHubMetricsResult>>,
  githubEnrichment: GitHubEnrichmentAuditEntry[],
  stats: GitHubEnrichmentStats,
): Promise<GitHubMetricsResult> {
  const repoKey = recordRepoKey(stats, signal.repo_url);
  const cacheKey = repoKey || signal.repo_url.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const detailedPromise = fetchGitHubRepoMetricsDetailed(signal.repo_url).then((detailed) => {
    githubEnrichment.push({
      repo_url: signal.repo_url,
      repo_full_name: repoKey || "(invalid-repo-url)",
      status: detailed.status,
      metrics_applied: Boolean(detailed.metrics),
      notes: detailed.notes,
    });
    return detailed;
  });
  cache.set(cacheKey, detailedPromise);
  return detailedPromise;
}

async function enrichSignalsWithGitHubMetrics(signals: RawSignal[], logger: Logger): Promise<{
  enriched: RawSignal[];
  githubEnrichment: GitHubEnrichmentAuditEntry[];
  githubStatus: DailyRunSummarySourceStatus;
}> {
  const enriched: RawSignal[] = [];
  const cache = new Map<string, Promise<GitHubMetricsResult>>();
  const githubEnrichment: GitHubEnrichmentAuditEntry[] = [];
  const stats = createGitHubEnrichmentStats();
  const concurrency = readPositiveIntEnv("AGENT_TREND_RADAR_GITHUB_CONCURRENCY", 3);

  seedGitHubCache(signals, stats);

  const mapped = await mapInBatches(signals, concurrency, async (signal) => {
    const metricsResult = await fetchGitHubMetricsOnce(signal, cache, githubEnrichment, stats);
    return { signal, metricsResult };
  });

  for (const { signal, metricsResult } of mapped) {
    recordMetricsResult(stats, metricsResult);
    enriched.push(mergeSignalWithMetrics(signal, metricsResult.metrics, metricsResult.status));
  }

  validateRawSignals(enriched);
  logger.info("enriched signals with GitHub metrics", { count: enriched.length, concurrency });

  return {
    enriched,
    githubEnrichment,
    githubStatus: buildGitHubSourceStatus(stats),
  };
}

async function resolveSignalsWithGitHubStarDeltas(
  signals: RawSignal[],
  date: string,
  scoredProjects: ScoredProject[],
): Promise<{
  signals: RawSignal[];
  summary: GitHubStarDeltaSummary;
}> {
  const result = await resolveGitHubStarDeltas(signals, date, scoredProjects);
  return {
    signals: result.signals,
    summary: result.summary,
  };
}

export async function collectRawSignals(
  config: AppConfig,
  logger: Logger,
  opts: {
    date?: string;
    dryRun?: boolean;
    enrichGithub?: boolean;
    includeAgentsRadar?: boolean;
    includeTrendshift?: boolean;
  } = {},
): Promise<RawSignal[]> {
  const result = await collectRawSignalsDetailed(config, logger, opts);
  return result.rawSignals;
}

/**
 * Signal layer orchestrates primary source collection, schema validation, watchlist annotation,
 * GitHub enrichment, and star-delta resolution. The upper layers only consume validated data plus
 * freshness metadata.
 */
export async function collectRawSignalsDetailed(
  config: AppConfig,
  logger: Logger,
  opts: {
    date?: string;
    dryRun?: boolean;
    enrichGithub?: boolean;
    includeAgentsRadar?: boolean;
    includeTrendshift?: boolean;
  } = {},
): Promise<RawSignalCollectionResult> {
  const primarySources = await collectPrimarySourceSignals(config, logger, opts);
  const watchlistAnnotated = validateAndAnnotateSignals(primarySources.raw, config, logger);

  if (opts.enrichGithub === false) {
    return {
      rawSignals: watchlistAnnotated,
      sourceStatus: [
        primarySources.agentsRadar.sourceStatus,
        primarySources.trendshift.sourceStatus,
        primarySources.githubTrending.sourceStatus,
        primarySources.watchlistLiveActivity.sourceStatus,
        buildGithubDisabledStatus(),
      ],
      freshnessSources: primarySources.freshnessSources,
      githubEnrichment: [],
      githubStarDelta: {
        live_delta_attempts: 0,
        live_delta_success: 0,
        snapshot_delta_success: 0,
        token_missing: 0,
        auth_invalid: 0,
        rate_limit: 0,
        network_blocked: 0,
      },
    };
  }

  const githubResult = await enrichSignalsWithGitHubMetrics(watchlistAnnotated, logger);
  const previewNormalized = normalizeSignals(githubResult.enriched);
  const previewScored = scoreProjects(previewNormalized, config);
  const starDeltaDate = opts.date ?? new Date().toISOString().slice(0, 10);
  const starDeltaResult = await resolveSignalsWithGitHubStarDeltas(githubResult.enriched, starDeltaDate, previewScored);
  const githubLiveDeltaSignals = buildGitHubLiveDeltaSignals(starDeltaResult.signals, starDeltaDate);
  const combinedSignals = validateAndAnnotateSignals(
    [...starDeltaResult.signals, ...githubLiveDeltaSignals],
    config,
    logger,
  );
  const githubLiveDeltaFreshness = buildGitHubLiveDeltaFreshnessSource(
    starDeltaDate,
    githubLiveDeltaSignals,
    starDeltaResult.summary,
  );

  return {
    rawSignals: combinedSignals,
    sourceStatus: [
      primarySources.agentsRadar.sourceStatus,
      primarySources.trendshift.sourceStatus,
      primarySources.githubTrending.sourceStatus,
      primarySources.watchlistLiveActivity.sourceStatus,
      githubResult.githubStatus,
    ],
    freshnessSources: [...primarySources.freshnessSources, githubLiveDeltaFreshness],
    githubEnrichment: githubResult.githubEnrichment,
    githubStarDelta: starDeltaResult.summary,
  };
}
