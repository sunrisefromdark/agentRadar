import path from "node:path";
import { readJsonFile } from "../storage/files.ts";
import type {
  DailyReport,
  DailyRunSummary,
  DailyFreshnessSource,
  GitHubEnrichmentAuditEntry,
  VerificationCheck,
  VerifyDailyResult,
} from "../types.ts";
import { MISSION_DISCOVERY_CONFIG } from "../signal/missionDiscoveryConfig.ts";

function summaryPath(date: string): string {
  return path.join("data", "reports", `${date}.run-summary.json`);
}

function githubAuditPath(date: string): string {
  return path.join("data", "raw", "github", `${date}.enrichment.json`);
}

function dailyReportPath(date: string): string {
  return path.join("data", "reports", `${date}.daily.json`);
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

function projectSearchContractChecks(summary: DailyRunSummary, report: DailyReport | null): VerificationCheck[] {
  if (!report) {
    return [buildCheck("project_search_daily_fields", "warn", "daily report missing; cannot verify project-search contract fields")];
  }

  const todayPulseProjects = Array.isArray(report.today_pulse_projects)
    ? report.today_pulse_projects
    : Array.isArray(report.today_star_projects)
      ? report.today_star_projects
      : [];
  const missionMatchProjects = Array.isArray(report.mission_match_projects)
    ? report.mission_match_projects
    : Array.isArray(report.demand_relevant_projects)
      ? report.demand_relevant_projects
      : [];
  const exploreRibbonProjects = Array.isArray(report.explore_ribbon_projects) ? report.explore_ribbon_projects : [];
  const coverageAtlas = Array.isArray(report.coverage_atlas)
    ? report.coverage_atlas
    : Array.isArray(report.searched_direction_statuses)
      ? report.searched_direction_statuses
      : [];
  const gapLedger = Array.isArray(report.gap_ledger) ? report.gap_ledger : [];
  const hasDirectProjectSearchSchema =
    Array.isArray(report.today_pulse_projects) &&
    Array.isArray(report.mission_match_projects) &&
    Array.isArray(report.explore_ribbon_projects) &&
    Array.isArray(report.coverage_atlas) &&
    Array.isArray(report.gap_ledger);
  const hasLegacyCompatibilitySchema =
    Array.isArray(report.today_star_projects) ||
    Array.isArray(report.demand_relevant_projects) ||
    Array.isArray(report.searched_direction_statuses);
  const requiredFieldsPresent =
    hasDirectProjectSearchSchema ||
    (hasLegacyCompatibilitySchema &&
      todayPulseProjects.length >= 0 &&
      missionMatchProjects.length >= 0 &&
      coverageAtlas.length >= 0);
  const cardsWithAppearanceReasons = [
    ...todayPulseProjects,
    ...missionMatchProjects,
    ...exploreRibbonProjects,
  ].every(
    (project) =>
      Array.isArray(project.appearance_reason_codes) &&
      project.appearance_reason_codes.length > 0 &&
      typeof project.appearance_explanation_cn === "string" &&
      project.appearance_explanation_cn.trim().length > 0 &&
      Array.isArray(project.direction_matches),
  );
  const missionQuota = 4;
  const missionUnderQuota = missionMatchProjects.length < missionQuota;
  const exploreAllowed = missionUnderQuota || exploreRibbonProjects.length === 0;
  const overlap = new Set(missionMatchProjects.map((project) => project.project.repo_full_name.toLowerCase()));
  const exploreOverlap = exploreRibbonProjects.some((project) =>
    overlap.has(project.project.repo_full_name.toLowerCase()),
  );
  const top3MissionProjects = missionMatchProjects.slice(0, 3);
  const directionDupInTop3 = top3MissionProjects.some((project, index) =>
    top3MissionProjects.slice(index + 1).some((other) =>
      (project.direction_matches ?? []).some((direction) => (other.direction_matches ?? []).includes(direction)),
    ),
  );
  const directionFamilyLookup = new Map([
    ["coding-agent", "agent-stack"],
    ["browser-computer-use", "agent-stack"],
    ["workflow-automation-agent", "agent-stack"],
    ["research-knowledge-agent", "agent-stack"],
    ["shopping-commerce-agent", "revenue-commerce"],
    ["sales-prospecting-agent", "revenue-commerce"],
    ["customer-support-agent", "revenue-commerce"],
    ["marketing-content-ops-agent", "revenue-commerce"],
    ["finance-investment-research-agent", "analysis-professional"],
    ["data-analytics-bi-agent", "analysis-professional"],
    ["legal-compliance-agent", "analysis-professional"],
    ["security-soc-agent", "analysis-professional"],
    ["healthcare-ops-agent", "vertical-ops"],
    ["recruiting-hr-agent", "vertical-ops"],
    ["supply-chain-procurement-agent", "vertical-ops"],
    ["industrial-field-ops-agent", "vertical-ops"],
  ]);
  const familyCounts = new Map<string, number>();
  for (const project of missionMatchProjects) {
    for (const direction of new Set(project.direction_matches ?? [])) {
      const family = directionFamilyLookup.get(direction);
      if (!family) continue;
      familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
    }
  }
  const familyOverLimit = [...familyCounts.values()].some((count) => count > 2);
  const degradedExplained =
    summary.mission_discovery_status !== "degraded" ||
    (summary.mission_degraded_reason_codes ?? []).length > 0;
  const missionMetrics = summary.mission_metrics;
  const rollingInventoryComplete =
    typeof missionMetrics?.rolling_30d_searchable_catalog_count === "number" &&
    typeof missionMetrics?.rolling_30d_vertical_or_task_oriented_count === "number" &&
    typeof missionMetrics?.rolling_7d_qualified_non_head_count === "number";
  const rollingCatalogMet =
    (missionMetrics?.rolling_30d_searchable_catalog_count ?? 0) >= MISSION_DISCOVERY_CONFIG.rolling_30d_searchable_catalog_min;
  const rollingVerticalMet =
    (missionMetrics?.rolling_30d_vertical_or_task_oriented_count ?? 0) >= MISSION_DISCOVERY_CONFIG.vertical_or_task_oriented_projects_min;
  const rollingNonHeadMet =
    (missionMetrics?.rolling_7d_qualified_non_head_count ?? 0) >= MISSION_DISCOVERY_CONFIG.rolling_7d_qualified_non_head_projects_min;
  const rollingDirectionCounts = missionMetrics?.rolling_30d_direction_qualified_counts ?? {};
  const underfilledDirections = Object.entries(rollingDirectionCounts)
    .filter(([, count]) => count < MISSION_DISCOVERY_CONFIG.rolling_30d_qualified_projects_per_direction_min)
    .map(([directionKey, count]) => `${directionKey}=${count}`);

  return [
    buildCheck(
      "project_search_daily_fields",
      !requiredFieldsPresent ? "fail" : hasDirectProjectSearchSchema ? "pass" : "warn",
      requiredFieldsPresent
        ? hasDirectProjectSearchSchema
          ? `today_pulse=${todayPulseProjects.length}; mission_match=${missionMatchProjects.length}; explore_ribbon=${exploreRibbonProjects.length}; coverage_atlas=${coverageAtlas.length}; gap_ledger=${gapLedger.length}`
          : `legacy-compatible daily schema detected; today_pulse=${todayPulseProjects.length}; mission_match=${missionMatchProjects.length}; coverage_atlas=${coverageAtlas.length}`
        : "missing required project-search daily fields",
    ),
    buildCheck(
      "project_cards_have_direction_and_appearance_reason",
      hasDirectProjectSearchSchema ? (cardsWithAppearanceReasons ? "pass" : "warn") : "warn",
      cardsWithAppearanceReasons && hasDirectProjectSearchSchema
        ? "today_pulse / mission_match / explore_ribbon cards all carry direction and appearance reason"
        : hasDirectProjectSearchSchema
          ? "one or more project cards are missing direction_matches or appearance reason fields"
          : "legacy-compatible daily schema does not guarantee appearance-reason fields",
    ),
    buildCheck(
      "mission_quota_and_explore_ribbon_contract",
      exploreAllowed && !exploreOverlap ? "pass" : "fail",
      `mission_match=${missionMatchProjects.length}; mission_quota=${missionQuota}; explore_ribbon=${exploreRibbonProjects.length}; explore_overlap=${exploreOverlap ? "true" : "false"}`,
    ),
    buildCheck(
      "mission_fairness_constraints",
      !directionDupInTop3 && !familyOverLimit ? "pass" : "fail",
      `top3_direction_collision=${directionDupInTop3 ? "true" : "false"}; family_over_limit=${familyOverLimit ? "true" : "false"}`,
    ),
    buildCheck(
      "mission_degraded_semantics",
      summary.mission_discovery_status === undefined ? "warn" : degradedExplained ? "pass" : "fail",
      summary.mission_discovery_status === "degraded"
        ? `mission_degraded_reason_codes=${(summary.mission_degraded_reason_codes ?? []).join(",") || "none"}`
        : `mission_discovery_status=${summary.mission_discovery_status ?? "missing"}`,
    ),
    buildCheck(
      "rolling_inventory_audit_present",
      rollingInventoryComplete ? "pass" : "warn",
      rollingInventoryComplete
        ? `catalog_30d=${missionMetrics?.rolling_30d_searchable_catalog_count}; vertical_30d=${missionMetrics?.rolling_30d_vertical_or_task_oriented_count}; non_head_7d=${missionMetrics?.rolling_7d_qualified_non_head_count}`
        : "mission inventory audit fields are missing from run-summary",
    ),
    buildCheck(
      "rolling_inventory_targets_met",
      rollingInventoryComplete && rollingCatalogMet && rollingVerticalMet && rollingNonHeadMet && underfilledDirections.length === 0
        ? "pass"
        : rollingInventoryComplete
          ? "fail"
          : "warn",
      rollingInventoryComplete
        ? `catalog_30d=${missionMetrics?.rolling_30d_searchable_catalog_count}/${MISSION_DISCOVERY_CONFIG.rolling_30d_searchable_catalog_min}; vertical_30d=${missionMetrics?.rolling_30d_vertical_or_task_oriented_count}/${MISSION_DISCOVERY_CONFIG.vertical_or_task_oriented_projects_min}; non_head_7d=${missionMetrics?.rolling_7d_qualified_non_head_count}/${MISSION_DISCOVERY_CONFIG.rolling_7d_qualified_non_head_projects_min}; underfilled_directions=${underfilledDirections.join(",") || "none"}`
        : "mission inventory audit fields are missing from run-summary",
    ),
  ];
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

function buildChecks(summary: DailyRunSummary, githubAudit: GitHubEnrichmentAuditEntry[], report: DailyReport | null): VerificationCheck[] {
  const checks = [
    ...completionChecks(summary),
    ...sourceChecks(summary),
    ...qualityChecks(summary),
    ...llmChecks(summary),
    ...freshnessChecks(summary),
    ...projectSearchContractChecks(summary, report),
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
  const reportPath = dailyReportPath(date);
  const summary = readJsonFile<DailyRunSummary | null>(runSummaryPath, null);
  const githubAudit = readJsonFile<GitHubEnrichmentAuditEntry[]>(githubEnrichmentPath, []);
  const report = readJsonFile<DailyReport | null>(reportPath, null);

  if (!summary) {
    return missingSummaryResult(date, runSummaryPath, githubEnrichmentPath);
  }

  const normalizedSummary = normalizeSummaryDiagnostics(summary);
  const checks = buildChecks(normalizedSummary, githubAudit, report);
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
