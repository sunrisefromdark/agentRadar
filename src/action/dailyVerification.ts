import path from "node:path";
import { readJsonFile } from "../storage/files.ts";
import type {
  DailyRunSummary,
  DailyFreshnessSource,
  GitHubEnrichmentAuditEntry,
  VerificationCheck,
  VerifyDailyResult,
} from "../types.ts";

function summaryPath(date: string): string {
  return path.join("data", "reports", `${date}.run-summary.json`);
}

function githubAuditPath(date: string): string {
  return path.join("data", "raw", "github", `${date}.enrichment.json`);
}

function aggregateStatus(checks: VerificationCheck[]): VerifyDailyResult["status"] {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  return "pass";
}

function buildCheck(name: string, status: VerificationCheck["status"], detail: string): VerificationCheck {
  return { name, status, detail };
}

const EXPECTED_FRESHNESS_DRIVING_SOURCES = [
  "trendshift_live",
  "github_trending",
  "github_live_star_delta",
  "watchlist_live_activity",
] as const;

const KNOWN_FRESHNESS_DRIVING_SOURCES = new Set(EXPECTED_FRESHNESS_DRIVING_SOURCES);

function isKnownFreshnessDrivingSourceName(
  source: string,
): source is (typeof EXPECTED_FRESHNESS_DRIVING_SOURCES)[number] {
  return KNOWN_FRESHNESS_DRIVING_SOURCES.has(source as (typeof EXPECTED_FRESHNESS_DRIVING_SOURCES)[number]);
}

function sourceRoleOrDefault(source: DailyFreshnessSource | undefined): DailyFreshnessSource["source_role"] | undefined {
  if (!source) return undefined;
  if (source.source_role === "context" && source.source === "agents-radar") return "context";
  if (source.source_role === "freshness-driving" && isKnownFreshnessDrivingSourceName(source.source)) {
    return "freshness-driving";
  }
  if (!source.source_role) {
    if (source.source === "agents-radar") return "context";
    if (isKnownFreshnessDrivingSourceName(source.source)) return "freshness-driving";
  }
  return undefined;
}

function isFreshnessDrivingSource(source: DailyFreshnessSource | undefined): boolean {
  return sourceRoleOrDefault(source) === "freshness-driving";
}

function missingSummaryResult(date: string, runSummaryPath: string, githubEnrichmentPath: string): VerifyDailyResult {
  return {
    date,
    status: "fail",
    summary_path: runSummaryPath,
    github_audit_path: githubEnrichmentPath,
    checks: [buildCheck("run_summary_exists", "fail", `missing ${runSummaryPath}`)],
    recommended_actions: ["请先执行 `pnpm run-daily -- --date <date>`，再验证 daily 产物"],
  };
}

function completionChecks(summary: DailyRunSummary): VerificationCheck[] {
  return [
    buildCheck(
      "minimum_viable_run_completed",
      summary.minimum_viable_run_completed ? "pass" : "fail",
      summary.minimum_viable_run_completed
        ? "run summary marked the MVP loop as completed"
        : "run summary did not reach the MVP completion signal",
    ),
    buildCheck(
      "raw_signals_present",
      summary.counts.raw_signals > 0 ? "pass" : "fail",
      `raw_signals=${summary.counts.raw_signals}`,
    ),
    buildCheck(
      "scored_projects_present",
      summary.counts.scored_projects > 0 ? "pass" : "fail",
      `scored_projects=${summary.counts.scored_projects}`,
    ),
  ];
}

function sourceChecks(summary: DailyRunSummary): VerificationCheck[] {
  const activeSources = summary.source_status.filter((source) => source.enabled && source.status === "active").length;
  const failedSources = summary.source_status.filter((source) => source.enabled && source.status === "failed");

  return [
    buildCheck("active_sources_present", activeSources > 0 ? "pass" : "fail", `active_sources=${activeSources}`),
    buildCheck(
      "enabled_source_failures",
      failedSources.length === 0 ? "pass" : "warn",
      failedSources.length === 0
        ? "no enabled sources failed"
        : `failed_sources=${failedSources.map((source) => source.source).join(",")}`,
    ),
  ];
}

function qualityChecks(summary: DailyRunSummary): VerificationCheck[] {
  const lowConfidenceShare =
    summary.counts.scored_projects > 0 ? summary.quality.low_confidence_projects / summary.counts.scored_projects : 0;

  return [
    buildCheck(
      "low_confidence_share",
      lowConfidenceShare <= 0.5 ? "pass" : "warn",
      `low_confidence_projects=${summary.quality.low_confidence_projects}/${summary.counts.scored_projects}`,
    ),
    buildCheck(
      "anomaly_share",
      summary.counts.scored_projects >= 5 && summary.diagnostics.anomaly_share > 0.3 ? "fail" : "pass",
      `anomaly_share=${summary.diagnostics.anomaly_share}`,
    ),
    buildCheck(
      "uniform_star_velocity",
      summary.diagnostics.uniform_star_velocity_detected ? "fail" : "pass",
      `uniform_star_velocity_detected=${summary.diagnostics.uniform_star_velocity_detected ? "true" : "false"}`,
    ),
    buildCheck(
      "star_delta_sources_visible",
      "pass",
      `star_delta_source_distribution=live:${summary.diagnostics.star_delta_source_distribution.github_live},snapshot:${summary.diagnostics.star_delta_source_distribution.github_snapshot},signal:${summary.diagnostics.star_delta_source_distribution.signal},unavailable:${summary.diagnostics.star_delta_source_distribution.unavailable}`,
    ),
    buildCheck(
      "live_delta_token_missing",
      summary.diagnostics.github_star_delta.token_missing > 0 ? "warn" : "pass",
      `token_missing=${summary.diagnostics.github_star_delta.token_missing}`,
    ),
    buildCheck(
      "live_delta_auth_invalid",
      (summary.diagnostics.github_star_delta.auth_invalid ?? 0) > 0 ? "warn" : "pass",
      `auth_invalid=${summary.diagnostics.github_star_delta.auth_invalid ?? 0}`,
    ),
    buildCheck(
      "live_delta_rate_limit",
      summary.diagnostics.github_star_delta.rate_limit > 0 ? "warn" : "pass",
      `rate_limit=${summary.diagnostics.github_star_delta.rate_limit}`,
    ),
    buildCheck(
      "live_delta_network_blocked",
      summary.diagnostics.github_star_delta.network_blocked > 0 ? "warn" : "pass",
      `network_blocked=${summary.diagnostics.github_star_delta.network_blocked}`,
    ),
  ];
}

function llmChecks(summary: DailyRunSummary): VerificationCheck[] {
  const diagnostics = summary.llm_diagnostics;
  if (!diagnostics || !diagnostics.enabled) {
    return [buildCheck("llm_classification_health", "pass", "llm semantic classification is disabled")];
  }

  const detail =
    `cache_hits=${diagnostics.classification_cache_hit_count ?? 0}; ` +
    `provider=${diagnostics.provider}; attempts=${diagnostics.classification_attempt_count}; ` +
    `success=${diagnostics.classification_success_count}; failures=${diagnostics.classification_failure_count}` +
    (diagnostics.classification_last_error ? `; latest_error=${diagnostics.classification_last_error}` : "");

  if ((diagnostics.classification_cache_hit_count ?? 0) > 0 && diagnostics.classification_attempt_count === 0) {
    return [buildCheck("llm_classification_health", "pass", `${detail}; reused cached semantic classifications`)];
  }
  if (diagnostics.classification_attempt_count === 0) {
    return [buildCheck("llm_classification_health", "warn", `${detail}; no classification attempts were recorded`)];
  }
  if (diagnostics.classification_success_count === 0) {
    return [buildCheck("llm_classification_health", "fail", `${detail}; provider chain did not produce any successful classification`)];
  }
  if (diagnostics.classification_failure_count > 0) {
    return [buildCheck("llm_classification_health", "warn", `${detail}; provider partially succeeded with failures`)];
  }
  return [buildCheck("llm_classification_health", "pass", detail)];
}

function freshnessChecks(summary: DailyRunSummary): VerificationCheck[] {
  const freshnessSources = summary.freshness_sources ?? [];
  const trendshiftFresh = freshnessSources.find((item) => item.source === "trendshift_live");
  const agentsRadarFreshness = freshnessSources.find((item) => item.source === "agents-radar");
  const githubFreshnessSources = freshnessSources.filter((item) => item.source.startsWith("github_"));
  const freshnessDrivingSources = freshnessSources.filter(isFreshnessDrivingSource);
  const freshDrivingTodaySources = freshnessDrivingSources.filter((item) => item.freshness_state === "fresh_today");
  const contextFreshTodaySources = freshnessSources.filter(
    (item) => sourceRoleOrDefault(item) === "context" && item.freshness_state === "fresh_today",
  );
  const todayStarCount = summary.today_star_count ?? 0;
  const hasFreshDrivingTodaySources = freshDrivingTodaySources.length > 0;
  const hasTodayStarProjects = todayStarCount > 0;

  const complete =
    sourceRoleOrDefault(trendshiftFresh) === "freshness-driving" &&
    githubFreshnessSources.length >= 2 &&
    freshnessSources.some((item) => item.source === "watchlist_live_activity" && isFreshnessDrivingSource(item)) &&
    freshnessDrivingSources.some((item) => item.source === "github_trending") &&
    freshnessDrivingSources.some((item) => item.source === "github_live_star_delta") &&
    freshnessDrivingSources.some((item) => item.source === "watchlist_live_activity") &&
    sourceRoleOrDefault(agentsRadarFreshness) === "context";

  const alignmentWarning =
    hasFreshDrivingTodaySources && !hasTodayStarProjects
      ? "fresh-driving source exists but today_star_count is 0"
      : !hasFreshDrivingTodaySources && hasTodayStarProjects
        ? "no freshness-driving source exists but today_star_count is greater than 0"
        : `fresh-driving_today_sources=${freshDrivingTodaySources.length}; context_today_sources=${contextFreshTodaySources.length}; today_star_count=${todayStarCount}; today_fresh_candidate_count=${summary.today_fresh_candidate_count ?? 0}`;

  return [
    buildCheck(
      "freshness_sources_complete",
      complete ? "pass" : "warn",
      complete
        ? `freshness_sources=${freshnessSources.map((item) => `${item.source}[${sourceRoleOrDefault(item) ?? "unknown"}]`).join(",")}`
        : `missing expected freshness source coverage: expected_driving=${EXPECTED_FRESHNESS_DRIVING_SOURCES.join(",")}; freshness_sources=${freshnessSources.map((item) => `${item.source}[${sourceRoleOrDefault(item) ?? "unknown"}]`).join(",") || "none"}`,
    ),
    buildCheck(
      "fresh_source_project_alignment",
      hasFreshDrivingTodaySources === hasTodayStarProjects ? "pass" : "warn",
      alignmentWarning,
    ),
    buildCheck(
      "agents_radar_stale_fallback",
      agentsRadarFreshness?.freshness_state === "fallback_stale" ? "warn" : "pass",
      agentsRadarFreshness
        ? `agents-radar source_role=${sourceRoleOrDefault(agentsRadarFreshness) ?? "unknown"}; freshness_state=${agentsRadarFreshness.freshness_state}; effective_date=${agentsRadarFreshness.effective_date ?? "unknown"}`
        : "agents-radar freshness source missing",
    ),
    buildCheck(
      "agents_radar_context_only",
      sourceRoleOrDefault(agentsRadarFreshness) === "context" &&
      agentsRadarFreshness?.freshness_state !== "fallback_stale"
        ? "pass"
        : "warn",
      agentsRadarFreshness
        ? `agents-radar source_role=${sourceRoleOrDefault(agentsRadarFreshness) ?? "unknown"}; freshness_state=${agentsRadarFreshness.freshness_state}; effective_date=${agentsRadarFreshness.effective_date ?? "unknown"}`
        : "agents-radar freshness source missing",
    ),
  ];
}

function githubAuditCheck(
  summary: DailyRunSummary,
  githubAudit: GitHubEnrichmentAuditEntry[],
): VerificationCheck | undefined {
  const githubSource = summary.source_status.find((source) => source.source === "github-enrichment");
  if (!githubSource?.enabled || githubSource.status === "disabled") return undefined;

  return buildCheck(
    "github_audit_written",
    githubAudit.length > 0 || githubSource.status === "empty" ? "pass" : "warn",
    githubAudit.length > 0
      ? `github_enrichment_audits=${githubAudit.length}`
      : "github enrichment produced no audit rows for this date",
  );
}

function defaultDiagnostics(): NonNullable<DailyRunSummary["diagnostics"]> {
  return {
    anomaly_share: 0,
    uniform_star_velocity_detected: false,
    metrics_source_distribution: {
      embedded: 0,
      github_api: 0,
      github_html: 0,
      github_cache: 0,
      unavailable: 0,
    },
    star_delta_source_distribution: {
      github_live: 0,
      github_snapshot: 0,
      signal: 0,
      unavailable: 0,
    },
    github_star_delta: {
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

function normalizeDiagnostics(diagnostics: DailyRunSummary["diagnostics"] | undefined): DailyRunSummary["diagnostics"] {
  const defaults = defaultDiagnostics();
  const current = diagnostics ?? defaults;

  return {
    anomaly_share: current.anomaly_share ?? defaults.anomaly_share,
    uniform_star_velocity_detected:
      current.uniform_star_velocity_detected ?? defaults.uniform_star_velocity_detected,
    metrics_source_distribution: {
      ...defaults.metrics_source_distribution,
      ...(current.metrics_source_distribution ?? {}),
    },
    star_delta_source_distribution: {
      ...defaults.star_delta_source_distribution,
      ...(current.star_delta_source_distribution ?? {}),
    },
    github_star_delta: {
      ...defaults.github_star_delta,
      ...(current.github_star_delta ?? {}),
    },
  };
}

function normalizeSummaryDiagnostics(summary: DailyRunSummary): DailyRunSummary {
  return {
    ...summary,
    diagnostics: normalizeDiagnostics(summary.diagnostics),
  };
}

function buildChecks(summary: DailyRunSummary, githubAudit: GitHubEnrichmentAuditEntry[]): VerificationCheck[] {
  const checks = [
    ...completionChecks(summary),
    ...sourceChecks(summary),
    ...qualityChecks(summary),
    ...llmChecks(summary),
    ...freshnessChecks(summary),
  ];
  const githubCheck = githubAuditCheck(summary, githubAudit);
  if (githubCheck) checks.push(githubCheck);
  return checks;
}

/**
 * daily verification 负责把“这次产物能不能信”收敛成一组稳定检查项。
 * 这里故意把主链路完成信号、source 健康度和数据异常诊断放在同一处，避免调用方各自拼装质检口径。
 */
export function buildVerifyDailyResult(date: string): VerifyDailyResult {
  const runSummaryPath = summaryPath(date);
  const githubEnrichmentPath = githubAuditPath(date);
  const summary = readJsonFile<DailyRunSummary | null>(runSummaryPath, null);
  const githubAudit = readJsonFile<GitHubEnrichmentAuditEntry[]>(githubEnrichmentPath, []);

  if (!summary) {
    return missingSummaryResult(date, runSummaryPath, githubEnrichmentPath);
  }

  const normalizedSummary = normalizeSummaryDiagnostics(summary);
  const checks = buildChecks(normalizedSummary, githubAudit);
  return {
    date,
    status: aggregateStatus(checks),
    summary_path: runSummaryPath,
    github_audit_path: githubEnrichmentPath,
    checks,
    recommended_actions: normalizedSummary.recommended_actions,
  };
}

function renderChecklist(checks: VerificationCheck[]): string[] {
  return checks.map((check) => `- ${check.name}: ${check.status} | ${check.detail}`);
}

export function renderVerifyDailyResult(result: VerifyDailyResult): string {
  return [
    `# Agent Trend Radar Daily 质检 ${result.date}`,
    "",
    `- 状态: ${result.status}`,
    `- run_summary: ${result.summary_path}`,
    `- github_audit: ${result.github_audit_path}`,
    "",
    "## 检查项",
    "",
    ...renderChecklist(result.checks),
    "",
    "## 建议动作",
    "",
    ...(result.recommended_actions.length > 0
      ? result.recommended_actions.map((item) => `- ${item}`)
      : ["- 当前没有额外动作"]),
    "",
  ].join("\n");
}
