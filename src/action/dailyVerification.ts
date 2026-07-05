import fs from "node:fs";
import path from "node:path";
import { externalAggregatePath, externalCandidateExplanationsPath } from "../externalDiscovery/paths.ts";
import { assertPublicSafeAggregate, assertPublicSafeTrendWindow } from "../externalDiscovery/redaction.ts";
import { assertPublicSafeCandidateExplanations } from "../externalDiscovery/explanationRedaction.ts";
import type { ExternalCandidateExplanationArtifact } from "../externalDiscovery/explanations.ts";
import { readExternalDiscussionTrendWindowByDate, type ExternalDiscussionTrendWindowReadResult } from "../externalDiscovery/trendWindowIntegration.ts";
import { isExternalPlatform } from "../externalDiscovery/types.ts";
import { readJsonFile } from "../storage/files.ts";
import type {
  DailyReport,
  DailyRunSummary,
  DailyFreshnessSource,
  GitHubEnrichmentAuditEntry,
  IndustryRuntimeSummaryArtifact,
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

function policyFinanceRuntimeReplayPath(date: string): string {
  return path.join("data", "reports", `${date}.policy-finance-runtime-replay.json`);
}

type PolicyFinanceRuntimeReplayArtifact = {
  artifact_kind?: string;
  current_status?: string;
  negative_reason_code?: string;
  runtime_consumed_same_run_messages?: number;
};

function industryRuntimeSummaryPath(date: string): string {
  return path.join("data", "reports", `${date}.industry-runtime-summary.json`);
}

interface OptionalJsonRead {
  exists: boolean;
  value?: unknown;
  error?: string;
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

function externalAggregateContractChecks(filepath: string, aggregateRead: OptionalJsonRead): VerificationCheck[] {
  if (!aggregateRead.exists) {
    return [
      buildCheck(
        "external_discovery_aggregate_contract",
        "pass",
        `external aggregate not present at ${filepath}; external layer not run for this date`,
      ),
    ];
  }

  if (aggregateRead.error) {
    return [buildCheck("external_discovery_aggregate_contract", "fail", `external aggregate unreadable: ${aggregateRead.error}`)];
  }

  const aggregate = aggregateRead.value;
  const redaction = assertPublicSafeAggregate(aggregate);
  const inspection = inspectExternalAggregateContract(aggregate);
  const issues = [
    ...(!redaction.ok ? [`redaction=${redaction.reason_codes.join(",")}`] : []),
    ...inspection.issues,
  ];

  return [
    buildCheck(
      "external_discovery_aggregate_contract",
      issues.length === 0 ? "pass" : "fail",
      issues.length === 0
        ? `external aggregate public-safe; project_evidence=${inspection.projectEvidenceCount}; direction_evidence=${inspection.directionEvidenceCount}; named_actor_rows=${inspection.namedActorRows}`
        : issues.join("; "),
    ),
  ];
}

function externalCandidateExplanationContractChecks(
  filepath: string,
  aggregateRead: OptionalJsonRead,
  explanationsRead: OptionalJsonRead,
): VerificationCheck[] {
  if (!explanationsRead.exists) {
    const needsExplanationArtifact = aggregateNeedsCandidateExplanations(aggregateRead.value);
    return [
      buildCheck(
        "external_candidate_explanations_contract",
        needsExplanationArtifact ? "fail" : "pass",
        needsExplanationArtifact
          ? `candidate explanations missing at ${filepath}; external aggregate has accepted events or candidates`
          : `candidate explanations not present at ${filepath}; external explanation layer not run for this date`,
      ),
    ];
  }

  if (explanationsRead.error) {
    return [buildCheck("external_candidate_explanations_contract", "fail", `candidate explanations unreadable: ${explanationsRead.error}`)];
  }

  const artifact = explanationsRead.value as ExternalCandidateExplanationArtifact;
  const redaction = assertPublicSafeCandidateExplanations(artifact);
  const inspection = inspectExternalCandidateExplanationContract(artifact, aggregateRead.value);
  const issues = [
    ...(!redaction.ok ? [`redaction=${redaction.reason_codes.join(",")}`] : []),
    ...inspection.issues,
  ];

  return [
    buildCheck(
      "external_candidate_explanations_contract",
      issues.length === 0 ? "pass" : "fail",
      issues.length === 0
        ? `candidate explanations public-safe; status=${inspection.status}; eligible=${inspection.eligibleCount}; enhanced=${inspection.enhancedCount}; fallback=${inspection.fallbackCount}`
        : issues.join("; "),
    ),
  ];
}

function policyFinanceRuntimeReplayChecks(
  artifact: PolicyFinanceRuntimeReplayArtifact | null,
  artifactPath: string,
): VerificationCheck[] {
  if (!artifact) {
    return [buildCheck("policy_finance_runtime_replay_artifact", "fail", `missing ${artifactPath}`)];
  }

  return [
    buildCheck(
      "policy_finance_runtime_replay_artifact",
      artifact.artifact_kind === "policy_finance_runtime_replay" &&
      artifact.current_status === "policy_finance_runtime_ready" &&
      artifact.negative_reason_code === "dispatch_context_missing"
        ? "pass"
        : "fail",
      `artifact_kind=${artifact.artifact_kind ?? "missing"}; current_status=${artifact.current_status ?? "missing"}; negative_reason_code=${artifact.negative_reason_code ?? "missing"}`,
    ),
    buildCheck(
      "policy_finance_runtime_same_run_messages",
      typeof artifact.runtime_consumed_same_run_messages === "number" && artifact.runtime_consumed_same_run_messages > 0
        ? "pass"
        : "fail",
      `runtime_consumed_same_run_messages=${artifact.runtime_consumed_same_run_messages ?? "missing"}`,
    ),
  ];
}

function externalTrendWindowContractChecks(
  summary: DailyRunSummary,
  trendWindowRead: ExternalDiscussionTrendWindowReadResult,
): VerificationCheck[] {
  const externalSummary = summary.external_discovery;
  if (trendWindowRead.read_status === "not_found") {
    const status = externalSummary ? "warn" : "pass";
    return [
      buildCheck(
        "external_discussion_trend_window_contract",
        status,
        externalSummary
          ? `trend window missing at ${trendWindowRead.path}; external discovery summary expected a trend artifact`
          : `trend window not present at ${trendWindowRead.path}; external layer not run for this date`,
      ),
    ];
  }

  if (trendWindowRead.read_status === "parse_error" || !trendWindowRead.trend_window) {
    return [
      buildCheck(
        "external_discussion_trend_window_contract",
        "fail",
        `trend window unreadable at ${trendWindowRead.path}: ${trendWindowRead.error ?? "parse_error"}`,
      ),
    ];
  }

  const trendWindow = trendWindowRead.trend_window;
  const redaction = assertPublicSafeTrendWindow(trendWindow);
  const itemIssues = [
    ...trendWindow.project_trends
      .filter((item) => item.scope !== "project")
      .map((item) => `project_trends contains non-project item ${item.trend_id}`),
    ...trendWindow.direction_trends
      .filter((item) => item.scope !== "direction")
      .map((item) => `direction_trends contains non-direction item ${item.trend_id}`),
    ...[...trendWindow.project_trends, ...trendWindow.direction_trends]
      .filter((item) => item.cannot_be_primary_conclusion !== true)
      .map((item) => `${item.trend_id} missing cannot_be_primary_conclusion=true`),
    ...trendWindow.direction_trends
      .filter((item) => item.weekly_eligible && item.weekly_gate_reasons.length < 2)
      .map((item) => `${item.trend_id} direction weekly eligibility does not satisfy 4-choose-2 gate`),
    ...[...trendWindow.project_trends, ...trendWindow.direction_trends]
      .filter((item) => item.verdict === "noise_spike" && item.weekly_eligible)
      .map((item) => `${item.trend_id} noise_spike must not be weekly eligible`),
  ];
  const summaryIssues = externalSummary
    ? [
        ...(externalSummary.trend_window_read_status !== trendWindowRead.read_status
          ? [`summary read status ${externalSummary.trend_window_read_status} does not match artifact read status ${trendWindowRead.read_status}`]
          : []),
        ...(externalSummary.trend_window_status !== trendWindow.status
          ? [`summary trend status ${externalSummary.trend_window_status ?? "missing"} does not match artifact status ${trendWindow.status}`]
          : []),
        ...(externalSummary.trend_window_path.replace(/\\/g, "/") !== trendWindowRead.path.replace(/\\/g, "/")
          ? [`summary trend path ${externalSummary.trend_window_path} does not match ${trendWindowRead.path}`]
          : []),
      ]
    : [];
  const issues = [
    ...(!redaction.ok ? [`redaction=${redaction.reason_codes.join(",")}`] : []),
    ...itemIssues,
    ...summaryIssues,
  ];

  return [
    buildCheck(
      "external_discussion_trend_window_contract",
      issues.length === 0 ? "pass" : "fail",
      issues.length === 0
        ? `trend window ${trendWindowRead.read_status}; usable_days=${trendWindow.coverage.usable_day_count}; project_trends=${trendWindow.project_trends.length}; direction_trends=${trendWindow.direction_trends.length}`
        : issues.join("; "),
    ),
  ];
}

function aggregateNeedsCandidateExplanations(aggregate: unknown): boolean {
  if (!isRecord(aggregate)) return false;
  const acceptedEventCount = typeof aggregate.accepted_event_count === "number" ? aggregate.accepted_event_count : 0;
  const candidates = Array.isArray(aggregate.observation_candidates) ? aggregate.observation_candidates : [];
  return acceptedEventCount > 0 || candidates.length > 0;
}

function inspectExternalCandidateExplanationContract(value: unknown, aggregate: unknown): {
  status: string;
  eligibleCount: number;
  enhancedCount: number;
  fallbackCount: number;
  issues: string[];
} {
  const issues: string[] = [];
  if (!isRecord(value)) {
    return { status: "unknown", eligibleCount: 0, enhancedCount: 0, fallbackCount: 0, issues: ["candidate explanations must be an object"] };
  }

  if (value.schema_version !== "external-discovery.candidate-explanations.v1") {
    issues.push("schema_version must be external-discovery.candidate-explanations.v1");
  }
  if (value.public_safe !== true || value.contains_raw_text !== false || value.contains_profile_urls !== false) {
    issues.push("candidate explanations must carry public_safe=true, contains_raw_text=false, contains_profile_urls=false");
  }
  if (isRecord(aggregate) && typeof aggregate.source_input_hash === "string" && value.aggregate_source_input_hash !== aggregate.source_input_hash) {
    issues.push("aggregate_source_input_hash does not match external aggregate source_input_hash");
  }
  if (typeof value.input_context_hash !== "string" || value.input_context_hash.length === 0) {
    issues.push("input_context_hash missing");
  }

  const explanations = Array.isArray(value.explanations) ? value.explanations : [];
  const audit = isRecord(value.audit) ? value.audit : {};
  const eligibleCount = Number(audit.eligible_count ?? 0);
  const enhancedCount = Number(audit.enhanced_count ?? 0);
  const fallbackCount = Number(audit.fallback_count ?? 0);
  const status = typeof value.status === "string" ? value.status : "unknown";
  const fallbackCountFromRows = explanations.filter((item) => isRecord(item) && item.summary_source === "rules_fallback").length;

  if (fallbackCount !== fallbackCountFromRows) {
    issues.push("fallback_count does not match rules_fallback rows");
  }
  if (status === "ok" && eligibleCount > 0 && enhancedCount / eligibleCount < 0.7) {
    issues.push("status ok requires enhanced coverage >= 70%");
  }

  return {
    status,
    eligibleCount,
    enhancedCount,
    fallbackCount,
    issues,
  };
}

function inspectExternalAggregateContract(value: unknown): {
  projectEvidenceCount: number;
  directionEvidenceCount: number;
  namedActorRows: number;
  issues: string[];
} {
  const issues: string[] = [];
  if (!isRecord(value)) {
    return { projectEvidenceCount: 0, directionEvidenceCount: 0, namedActorRows: 0, issues: ["external aggregate must be an object"] };
  }

  if (value.schema_version !== "external-discovery.aggregate.v1") {
    issues.push("schema_version must be external-discovery.aggregate.v1");
  }

  const projectEvidence = evidenceArray(value.project_evidence, "project_evidence", issues);
  const directionEvidence = evidenceArray(value.direction_evidence, "direction_evidence", issues);
  let namedActorRows = 0;

  for (const [sectionName, evidenceRows] of [
    ["project_evidence", projectEvidence],
    ["direction_evidence", directionEvidence],
  ] as const) {
    evidenceRows.forEach((evidence, evidenceIndex) => {
      if (!isRecord(evidence)) {
        issues.push(`${sectionName}[${evidenceIndex}] must be an object`);
        return;
      }
      if (!Array.isArray(evidence.named_registry_actors)) {
        issues.push(`${sectionName}[${evidenceIndex}].named_registry_actors must be an array`);
        return;
      }
      evidence.named_registry_actors.forEach((actor, actorIndex) => {
        namedActorRows += 1;
        if (!isRecord(actor)) {
          issues.push(`${sectionName}[${evidenceIndex}].named_registry_actors[${actorIndex}] must be an object`);
          return;
        }
        const sourceRoles = actor.source_roles;
        if (!Array.isArray(sourceRoles) || sourceRoles.length === 0) {
          issues.push(`${sectionName}[${evidenceIndex}].named_registry_actors[${actorIndex}].source_roles must be non-empty`);
          return;
        }
        const invalidRoles = sourceRoles.filter((role) => !isNamedActorSourceRole(role));
        if (invalidRoles.length > 0) {
          issues.push(`${sectionName}[${evidenceIndex}].named_registry_actors[${actorIndex}].source_roles has invalid roles`);
        }
      });
      issues.push(...inspectPublicActorContract(evidence, `${sectionName}[${evidenceIndex}]`));
    });
  }

  return {
    projectEvidenceCount: projectEvidence.length,
    directionEvidenceCount: directionEvidence.length,
    namedActorRows,
    issues,
  };
}

function evidenceArray(value: unknown, name: string, issues: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  issues.push(`${name} must be an array`);
  return [];
}

function isNamedActorSourceRole(value: unknown): boolean {
  return value === "social_discussant" || value === "official_publisher" || value === "official_owner";
}

function inspectPublicActorContract(evidence: Record<string, unknown>, prefix: string): string[] {
  return [
    ...inspectPublicActors(evidence.public_actors, `${prefix}.public_actors`),
    ...inspectPublicActorAudit(evidence.public_actor_audit, `${prefix}.public_actor_audit`),
  ];
}

function inspectPublicActors(value: unknown, prefix: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${prefix} must be an array`];
  const issues: string[] = [];
  value.forEach((actor, index) => {
    const actorPrefix = `${prefix}[${index}]`;
    if (!isRecord(actor)) {
      issues.push(`${actorPrefix} must be an object`);
      return;
    }
    if (typeof actor.public_actor_id !== "string" || actor.public_actor_id.length === 0) {
      issues.push(`${actorPrefix}.public_actor_id missing`);
    } else if (/^https?:\/\//i.test(actor.public_actor_id) || /[?#\s\u0000-\u001F\u007F]/.test(actor.public_actor_id)) {
      issues.push(`${actorPrefix}.public_actor_id must be a safe non-URL id`);
    }
    if (typeof actor.display_name !== "string" || actor.display_name.length === 0) {
      issues.push(`${actorPrefix}.display_name missing`);
    } else if (
      actor.display_name.length > 80 ||
      /https?:\/\//i.test(actor.display_name) ||
      /[\u0000-\u001F\u007F]/.test(actor.display_name) ||
      /\b(cookie|session|oauth|bearer|token|api[_ -]?key|password)\b/i.test(actor.display_name)
    ) {
      issues.push(`${actorPrefix}.display_name must be public-safe`);
    }
    if (!isExternalActorType(actor.actor_type)) issues.push(`${actorPrefix}.actor_type invalid`);
    if (!isPublicActorRole(actor.actor_role)) issues.push(`${actorPrefix}.actor_role invalid`);
    if (!isPublicActorSourceKind(actor.source_kind)) issues.push(`${actorPrefix}.source_kind invalid`);
    if (!isPublicActorSourceBasis(actor.source_basis)) issues.push(`${actorPrefix}.source_basis invalid`);
    if (!isPublicActorTierBasis(actor.tier_basis)) issues.push(`${actorPrefix}.tier_basis invalid`);
    if (actor.authority_tier !== undefined && !isPublicActorAuthorityTier(actor.authority_tier)) {
      issues.push(`${actorPrefix}.authority_tier invalid`);
    }
    if (typeof actor.is_head_actor !== "boolean") {
      issues.push(`${actorPrefix}.is_head_actor must be boolean`);
    }
    if (actor.is_head_actor === true && actor.tier_basis !== "registry_match") {
      issues.push(`${actorPrefix}.is_head_actor requires registry_match tier_basis`);
    }
    if (actor.is_head_actor === true && actor.actor_role !== "registry_entity") {
      issues.push(`${actorPrefix}.is_head_actor requires registry_entity role`);
    }
    if ((actor.actor_role === "official_publisher" || actor.actor_role === "project_owner") && actor.is_head_actor === true) {
      issues.push(`${actorPrefix}.official/project sources cannot be head discussion actors`);
    }
    if (typeof actor.event_count !== "number" || actor.event_count <= 0) issues.push(`${actorPrefix}.event_count invalid`);
    if (!Array.isArray(actor.platforms) || actor.platforms.some((platform) => !isExternalPlatform(platform))) {
      issues.push(`${actorPrefix}.platforms invalid`);
    }
  });
  return issues;
}

function inspectPublicActorAudit(value: unknown, prefix: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return [`${prefix} must be an array`];
  const issues: string[] = [];
  value.forEach((audit, index) => {
    const auditPrefix = `${prefix}[${index}]`;
    if (!isRecord(audit)) {
      issues.push(`${auditPrefix} must be an object`);
      return;
    }
    const extraKeys = Object.keys(audit).filter((key) => !["platform", "status", "reason", "event_count"].includes(key));
    if (extraKeys.length > 0) issues.push(`${auditPrefix} must not contain raw or extra fields`);
    if (!isExternalPlatform(audit.platform)) issues.push(`${auditPrefix}.platform invalid`);
    if (!isIdentityStatus(audit.status)) issues.push(`${auditPrefix}.status invalid`);
    if (!isIdentityReason(audit.reason)) issues.push(`${auditPrefix}.reason invalid`);
    if (audit.status === "available" && audit.reason !== "actor_public_identity_available") {
      issues.push(`${auditPrefix}.available status must use actor_public_identity_available`);
    }
    if (audit.status !== "available" && audit.reason === "actor_public_identity_available") {
      issues.push(`${auditPrefix}.non-available status must not use actor_public_identity_available`);
    }
    if (typeof audit.event_count !== "number" || audit.event_count <= 0) issues.push(`${auditPrefix}.event_count invalid`);
  });
  return issues;
}

function isExternalActorType(value: unknown): boolean {
  return value === "institution" || value === "team" || value === "person" || value === "community" || value === "unknown";
}

function isPublicActorRole(value: unknown): boolean {
  return value === "discussion_actor" || value === "community_source" || value === "official_publisher" || value === "project_owner" || value === "registry_entity";
}

function isPublicActorSourceKind(value: unknown): boolean {
  return value === "registry_entity" || value === "x_handle" || value === "reddit_community" || value === "reddit_user" || value === "hn_user" || value === "github_owner" || value === "official_domain" || value === "provider_actor";
}

function isPublicActorSourceBasis(value: unknown): boolean {
  return value === "registry_match" || value === "explicit_actor_field" || value === "source_url_path" || value === "official_source_url" || value === "target_official_url";
}

function isPublicActorTierBasis(value: unknown): boolean {
  return value === "registry_match" || value === "provider_hint" || value === "none";
}

function isPublicActorAuthorityTier(value: unknown): boolean {
  return value === "core" || value === "proven" || value === "watch" || value === "ordinary" || value === "unknown";
}

function isIdentityStatus(value: unknown): boolean {
  return value === "available" || value === "missing" || value === "invalid_reserved_path" || value === "redacted";
}

function isIdentityReason(value: unknown): boolean {
  return (
    value === "actor_public_identity_available" ||
    value === "actor_public_identity_missing" ||
    value === "x_reserved_or_indirect_url" ||
    value === "official_source_url_missing" ||
    value === "registry_entity_not_matched" ||
    value === "redacted_for_public_safety"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function industryRuntimeSummaryChecks(
  artifact: IndustryRuntimeSummaryArtifact | null,
  artifactPath: string,
): VerificationCheck[] {
  if (!artifact) {
    return [buildCheck("industry_runtime_summary_artifact", "fail", `missing ${artifactPath}`)];
  }

  return [
    buildCheck(
      "industry_runtime_summary_artifact",
      artifact.artifact_kind === "industry_runtime_summary" &&
      artifact.overall_status === "industry_runtime_contracts_ready"
        ? "pass"
        : "fail",
      `artifact_kind=${artifact.artifact_kind ?? "missing"}; overall_status=${artifact.overall_status ?? "missing"}`,
    ),
    buildCheck(
      "industry_runtime_group_statuses",
      artifact.policy_finance?.status === "policy_finance_runtime_ready" &&
      artifact.product_ecosystem?.status === "normalization_dry_run_ready" &&
      artifact.academic_preparatory?.status === "academic_preparatory_normalization_dry_run_ready"
        ? "pass"
        : "fail",
      `policy_finance=${artifact.policy_finance?.status ?? "missing"}; product_ecosystem=${artifact.product_ecosystem?.status ?? "missing"}; academic_preparatory=${artifact.academic_preparatory?.status ?? "missing"}`,
    ),
    buildCheck(
      "industry_runtime_platform_contract",
      artifact.platform_contract?.shared_governance_published === true &&
      artifact.platform_contract?.dispatch_gate?.high_cost_requires_reservation_state === "granted" &&
      artifact.platform_contract?.event_consumer_gate?.takeover_requires_takeover_audit_ref === true
        ? "pass"
        : "fail",
      `governance_published=${artifact.platform_contract?.shared_governance_published ?? "missing"}; reservation_state=${artifact.platform_contract?.dispatch_gate?.high_cost_requires_reservation_state ?? "missing"}; takeover_requires_audit_ref=${artifact.platform_contract?.event_consumer_gate?.takeover_requires_takeover_audit_ref ?? "missing"}`,
    ),
    buildCheck(
      "industry_runtime_policy_finance_profiles",
      Array.isArray(artifact.policy_finance?.activation_profile_ids) &&
      artifact.policy_finance.activation_profile_ids.length > 0 &&
      Array.isArray(artifact.policy_finance?.stop_profile_ids) &&
      artifact.policy_finance.stop_profile_ids.length > 0 &&
      Array.isArray(artifact.policy_finance?.review_profile_ids) &&
      artifact.policy_finance.review_profile_ids.length > 0
        ? "pass"
        : "fail",
      `activation_profiles=${artifact.policy_finance?.activation_profile_ids?.join(",") || "missing"}; stop_profiles=${artifact.policy_finance?.stop_profile_ids?.join(",") || "missing"}; review_profiles=${artifact.policy_finance?.review_profile_ids?.join(",") || "missing"}`,
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

function buildChecks(
  summary: DailyRunSummary,
  githubAudit: GitHubEnrichmentAuditEntry[],
  report: DailyReport | null,
  externalAggregateFilepath: string,
  externalAggregate: OptionalJsonRead,
  externalCandidateExplanationsFilepath: string,
  externalCandidateExplanations: OptionalJsonRead,
  externalTrendWindow: ExternalDiscussionTrendWindowReadResult,
  policyFinanceRuntimeReplay: PolicyFinanceRuntimeReplayArtifact | null,
  policyFinanceRuntimeReplayArtifactPath: string,
  industryRuntimeSummary: IndustryRuntimeSummaryArtifact | null,
  industryRuntimeSummaryArtifactPath: string,
): VerificationCheck[] {
  const checks = [
    ...completionChecks(summary),
    ...sourceChecks(summary),
    ...qualityChecks(summary),
    ...llmChecks(summary),
    ...freshnessChecks(summary),
    ...projectSearchContractChecks(summary, report),
    ...externalAggregateContractChecks(externalAggregateFilepath, externalAggregate),
    ...externalCandidateExplanationContractChecks(externalCandidateExplanationsFilepath, externalAggregate, externalCandidateExplanations),
    ...externalTrendWindowContractChecks(summary, externalTrendWindow),
    ...policyFinanceRuntimeReplayChecks(policyFinanceRuntimeReplay, policyFinanceRuntimeReplayArtifactPath),
    ...industryRuntimeSummaryChecks(industryRuntimeSummary, industryRuntimeSummaryArtifactPath),
  ];
  const githubCheck = githubAuditCheck(summary, githubAudit);
  if (githubCheck) checks.push(githubCheck);
  return checks;
}

function readOptionalJson(filepath: string): OptionalJsonRead {
  if (!fs.existsSync(filepath)) return { exists: false };
  try {
    return { exists: true, value: readJsonFile<unknown>(filepath, null) };
  } catch (error) {
    return {
      exists: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * daily verification 负责把“这次产物能不能信”收敛成一组稳定检查项。
 * 这里故意把主链路完成信号、source 健康度和数据异常诊断放在同一处，避免调用方各自拼装质检口径。
 */
export function buildVerifyDailyResult(date: string): VerifyDailyResult {
  const runSummaryPath = summaryPath(date);
  const githubEnrichmentPath = githubAuditPath(date);
  const reportPath = dailyReportPath(date);
  const externalAggregateFilepath = externalAggregatePath(date);
  const externalCandidateExplanationsFilepath = externalCandidateExplanationsPath(date);
  const policyFinanceRuntimeReplayArtifactPath = policyFinanceRuntimeReplayPath(date);
  const industryRuntimeSummaryArtifactPath = industryRuntimeSummaryPath(date);
  const summary = readJsonFile<DailyRunSummary | null>(runSummaryPath, null);
  const githubAudit = readJsonFile<GitHubEnrichmentAuditEntry[]>(githubEnrichmentPath, []);
  const report = readJsonFile<DailyReport | null>(reportPath, null);
  const externalAggregate = readOptionalJson(externalAggregateFilepath);
  const externalCandidateExplanations = readOptionalJson(externalCandidateExplanationsFilepath);
  const externalTrendWindow = readExternalDiscussionTrendWindowByDate(date);
  const policyFinanceRuntimeReplay = readJsonFile<PolicyFinanceRuntimeReplayArtifact | null>(
    policyFinanceRuntimeReplayArtifactPath,
    null,
  );
  const industryRuntimeSummary = readJsonFile<IndustryRuntimeSummaryArtifact | null>(industryRuntimeSummaryArtifactPath, null);

  if (!summary) {
    return missingSummaryResult(date, runSummaryPath, githubEnrichmentPath);
  }

  const normalizedSummary = normalizeSummaryDiagnostics(summary);
  const checks = buildChecks(
    normalizedSummary,
    githubAudit,
    report,
    externalAggregateFilepath,
    externalAggregate,
    externalCandidateExplanationsFilepath,
    externalCandidateExplanations,
    externalTrendWindow,
    policyFinanceRuntimeReplay,
    policyFinanceRuntimeReplayArtifactPath,
    industryRuntimeSummary,
    industryRuntimeSummaryArtifactPath,
  );
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
