import { knowledgeCardSlug } from "../action/knowledgeCard.ts";
import { buildProjectBriefFromScoredProject } from "../action/projectBriefs.ts";
import { DIRECTION_CATALOG } from "../signal/directionCatalog.ts";
import type { DailyReport, KnowledgeCard, RawSignal, ScoredProject, UserInterestTopicName, WeeklyJudgmentReport, WeeklyReport } from "../types.ts";
import { resolveDailyContext, resolveDailyTimeWindow, resolveNearestWeeklyAnchor, resolveWeeklyContext, resolveWeeklyTimeWindow } from "./context.ts";
import { getFilesystemStateSignature } from "./fileCache.ts";
import { parseKnowledgeCardMarkdown } from "./kbMarkdown.ts";
import {
  getDailyReport,
  getDailyNavigatorPreview,
  getGithubEnrichmentAudit,
  getKbCard,
  getKbIndex,
  getMissionScoutArtifact,
  getObserverArtifact,
  getRunSummary,
  getVerifyDailyResult,
  getWeeklyAudit,
  getWeeklyJudgmentReport,
  getWeeklyNavigatorPreview,
  getWeeklyReport,
  getWeeklyStructuredReport,
} from "./readLayer.ts";
import { makeState } from "./status.ts";
import type {
  DailyTimeNavigatorPreview,
  DrilldownRef,
  KnowledgeBaseViewModel,
  ObserverViewModel,
  OverviewViewModel,
  ProjectContextBinding,
  ProjectsViewModel,
  RouteFrameModel,
  RunHealthViewModel,
  RunSnapshot,
  SurfaceBlockModel,
  TimeNavigatorModel,
  TopLevelViewStatus,
  ViewBanner,
  WeeklySnapshot,
  WeeklyTimeNavigatorPreview,
  WeeklyViewModel,
} from "./types.ts";
import { parseWeeklyMarkdown } from "./weeklyMarkdown.ts";

type DerivedCacheEntry<T> = {
  signature: string;
  value: T;
};

type RunSnapshotResult = { snapshot: RunSnapshot | null; auditNotes: string[]; githubStatus: string };
type WeeklySnapshotResult = { snapshot: WeeklySnapshot | null; notes: string[] };

const runSnapshotCache = new Map<string, DerivedCacheEntry<RunSnapshotResult>>();
const weeklySnapshotCache = new Map<string, DerivedCacheEntry<WeeklySnapshotResult>>();

function readDerivedCache<T>(
  cache: Map<string, DerivedCacheEntry<T>>,
  key: string,
  signature: string,
  load: () => T,
): T {
  const cached = cache.get(key);
  if (cached && cached.signature === signature) {
    return cached.value;
  }
  const value = load();
  cache.set(key, { signature, value });
  return value;
}

function repoKeyFromProject(project: { repo_full_name?: string; repo_url: string; project_name: string }): string {
  return (project.repo_full_name ?? project.repo_url.replace(/^https?:\/\/github\.com\//i, "")).toLowerCase();
}

function makeBanner(args: {
  title: string;
  contextLabel: string;
  generatedAt: string | null;
  enhancementStatus?: string | null;
  sourceHealth?: string;
  githubStatus?: string;
  notes?: string[];
}): ViewBanner {
  const enhancement = args.enhancementStatus;
  const mode =
    enhancement === "rules-only" || enhancement === "agent-partial" || enhancement === "agent-full" ? enhancement : "unknown";
  return {
    title: args.title,
    context_label: args.contextLabel,
    generated_at: args.generatedAt,
    enhancement_status: mode,
    mode_label: mode,
    github_enrichment_status: args.githubStatus ?? "unknown",
    source_health: args.sourceHealth ?? "unknown",
    notes: args.notes ?? [],
  };
}

function inferObserverEnhancementStatus(
  diagnostics?: {
    enabled?: boolean;
    summary_attempt_count?: number;
    summary_success_count?: number;
    judge_attempt_count?: number;
    judge_success_count?: number;
  } | null,
): "rules-only" | "agent-partial" | "agent-full" {
  if (!diagnostics?.enabled) return "rules-only";
  const summarySucceeded = (diagnostics.summary_success_count ?? 0) > 0;
  const judgeSucceeded = (diagnostics.judge_success_count ?? 0) > 0;
  if (summarySucceeded && judgeSucceeded) return "agent-full";

  const attempts = (diagnostics.summary_attempt_count ?? 0) + (diagnostics.judge_attempt_count ?? 0);
  return summarySucceeded || judgeSucceeded || attempts > 0 ? "agent-partial" : "rules-only";
}

function summarizeObserverNotes(notes: string[]): string[] {
  const passthrough: string[] = [];
  const ecosystems = new Set<string>();
  let queryCount = 0;
  let failureCount = 0;

  for (const note of notes) {
    const failedMatch = note.match(/^query failed ecosystem=([^\s]+)/i);
    if (failedMatch) {
      queryCount += 1;
      failureCount += 1;
      ecosystems.add(failedMatch[1]);
      continue;
    }

    const queryMatch = note.match(/^query ecosystem=([^\s]+)/i);
    if (queryMatch) {
      queryCount += 1;
      ecosystems.add(queryMatch[1]);
      continue;
    }

    passthrough.push(note);
  }

  if (queryCount > 0) {
    passthrough.push(`observer query probes=${queryCount} across ${ecosystems.size} ecosystem(s)`);
  }
  if (failureCount > 0) {
    passthrough.push(`observer query failures=${failureCount}; candidate pool continued with remaining sources`);
  }

  return passthrough;
}

type DailyRankedProject = DailyReport["today_star_projects"][number];
const DIRECTION_LABELS = new Map(DIRECTION_CATALOG.map((direction) => [direction.direction_key, direction.display_name_cn] as const));

function buildCatalogInventoryProject(project: ScoredProject): DailyRankedProject {
  const leadEvidence = project.score.components.flatMap((component) => component.evidence).find(Boolean);
  const brief = buildProjectBriefFromScoredProject(project);
  const whyToday =
    leadEvidence ||
    project.score.risks[0] ||
    project.project.description ||
    `${project.project.project_name} stayed in the extended project inventory for broader search coverage.`;

  return {
    ...project,
    project_class: "context_only",
    objective_score: project.score.total_score,
    preference_boost: 0,
    base_final_rank: project.score.total_score,
    final_rank: project.score.total_score,
    matched_interest_topics: [],
    project_brief_cn: brief,
    why_today_cn: whyToday,
    enhancement_source: "template_fallback",
    summary_source: "template_fallback",
    position_qualification: "keep-observing",
    judge_score_delta: 0,
    judge_source: "template_fallback",
    direction_matches: [],
    appearance_reason_codes: ["catalog_inventory_backfill"],
    appearance_explanation_cn: "该项目来自扩展项目池补充，用于提升项目库检索覆盖面，不伪装成今日正式曝光位。",
    exposure_bucket: "historical_context",
    head_project: false,
    head_saturation_state: "normal",
  };
}

function buildObserverInventoryProject(
  entry: NonNullable<RunSnapshot["observer_artifact"]>["entries"][number],
): DailyRankedProject {
  const scoreValue = Number(entry.observer_score ?? entry.base_observer_score ?? 0);
  const repoKey = entry.repo_full_name.split("/")[1] ?? entry.repo_full_name;
  const tags = [...new Set([...(entry.labels ?? []), ...(entry.ecosystems ?? []), ...(entry.matched_by.keywords ?? []), ...(entry.matched_by.topic_hints ?? [])])];

  return {
    project: {
      project_name: repoKey,
      repo_url: entry.repo_url,
      repo_full_name: entry.repo_full_name,
      first_seen: entry.repo_created_at ?? entry.observed_at,
      last_seen: entry.repo_updated_at ?? entry.observed_at,
      sources: ["manual"],
      source_counts: { manual: 1 },
      appearances: Math.max(1, entry.historical_precision_score ?? 1),
      appearance_dates: [String(entry.observed_at).slice(0, 10)].filter(Boolean),
      persistence_state: entry.historical_precision_label === "validated" ? "persistent" : "emerging",
      stars: entry.stars ?? 0,
      star_delta_daily: 0,
      star_delta_weekly: 0,
      star_delta_source: "unavailable",
      forks: entry.forks ?? 0,
      issues: entry.issues ?? 0,
      PR: entry.PR ?? 0,
      tags,
      description: entry.description ?? entry.project_brief_cn ?? entry.repo_full_name,
      metrics_source: "unavailable",
      metrics_trust_score: 0.5,
      data_trust: "medium",
      star_delta_available: false,
      trust_flags: [],
      raw_signals: [],
    },
    score: {
      total_score: scoreValue,
      components: [],
      verdict: scoreValue >= 75 ? "high" : scoreValue >= 50 ? "watch" : "low",
      confidence: entry.historical_precision_label === "validated" ? "high" : "medium",
      trust_score: 0.5,
      data_trust: "medium",
      paradigm: (entry.ecosystems ?? [])[0] ?? "observer",
      anti_noise_flags: [],
      risks: [],
      next_actions: [entry.watch_next_cn ?? "keep observing observer candidate"],
      rules_only: true,
    },
    project_class: "context_only",
    objective_score: scoreValue,
    preference_boost: 0,
    base_final_rank: scoreValue,
    final_rank: scoreValue,
    matched_interest_topics: [],
    project_brief_cn: entry.project_brief_cn ?? entry.description ?? entry.repo_full_name,
    why_today_cn: entry.why_now_cn ?? entry.long_tail_reason ?? "observer candidate backfill",
    enhancement_source: "template_fallback",
    summary_source: entry.summary_source ?? "template_fallback",
    position_qualification: entry.position_qualification ?? "keep-observing",
    position_rationale_cn: entry.position_rationale_cn,
    judge_score_delta: entry.judge_score_delta ?? 0,
    judge_source: entry.judge_source ?? "template_fallback",
    direction_matches: entry.ecosystems ?? [],
    appearance_reason_codes: ["observer_inventory_backfill"],
    appearance_explanation_cn: "该项目来自新兴潜力候选池补充，用于提升项目库搜索覆盖面，不伪装成主榜正式曝光位。",
    exposure_bucket: "historical_context",
    head_project: false,
    head_saturation_state: "normal",
  };
}

function repoFullNameFromGithubUrl(repoUrl: string): string | null {
  const match = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(repoUrl.trim());
  if (!match) return null;
  return `${match[1]}/${match[2].replace(/\.git$/i, "")}`;
}

function directionMatchesFromSignal(signal: RawSignal): string[] {
  return [
    ...new Set(
      signal.tags
        .map((tag) => /^mission-direction:(.+)$/i.exec(tag)?.[1] ?? (DIRECTION_LABELS.has(tag) ? tag : null))
        .filter((tag): tag is string => Boolean(tag)),
    ),
  ];
}

function buildMissionScoutInventoryProject(signal: RawSignal): DailyRankedProject | null {
  const repoFullName = repoFullNameFromGithubUrl(signal.repo_url);
  if (!repoFullName) return null;

  const directionMatches = directionMatchesFromSignal(signal);
  if (directionMatches.length === 0) return null;

  const displayName = DIRECTION_LABELS.get(directionMatches[0] ?? "") ?? "垂直需求方向";
  const scoreValue = Math.min(69, Math.max(35, 42 + Math.log10(Math.max(1, Number(signal.stars ?? 0))) * 8));

  return {
    project: {
      project_name: signal.project_name || repoFullName.split("/")[1] || repoFullName,
      repo_url: signal.repo_url,
      repo_full_name: repoFullName,
      first_seen: signal.timestamp.slice(0, 10),
      last_seen: signal.timestamp.slice(0, 10),
      sources: [signal.source],
      source_counts: { [signal.source]: 1 },
      appearances: 1,
      appearance_dates: [signal.timestamp.slice(0, 10)],
      persistence_state: "emerging",
      stars: Number(signal.stars ?? 0),
      star_delta_daily: Number(signal.star_delta ?? 0),
      star_delta_weekly: 0,
      star_delta_source: signal.star_delta_source ?? "unavailable",
      forks: Number(signal.forks ?? 0),
      issues: Number(signal.issues ?? 0),
      PR: Number(signal.PR ?? 0),
      tags: [...new Set([...signal.tags, "mission-scout-candidate", "pending-confirmation"])],
      description: signal.description ?? signal.project_name,
      metrics_source: signal.metrics_source ?? "unavailable",
      metrics_trust_score: signal.metrics_trust_score ?? 0.5,
      data_trust: signal.metrics_source && signal.metrics_source !== "unavailable" ? "medium" : "unverified",
      star_delta_available: typeof signal.star_delta === "number",
      trust_flags: ["pending_score_confirmation"],
      raw_signals: [signal],
    },
    score: {
      total_score: Number(scoreValue.toFixed(2)),
      components: [],
      verdict: "watch",
      confidence: "medium",
      trust_score: signal.metrics_trust_score ?? 0.5,
      data_trust: signal.metrics_source && signal.metrics_source !== "unavailable" ? "medium" : "unverified",
      paradigm: "Agent System",
      anti_noise_flags: [],
      risks: ["mission scout 候选尚未进入完整评分链路"],
      next_actions: [`继续补证「${displayName}」方向的仓库质量、活跃度和真实使用场景。`],
      rules_only: true,
    },
    project_class: "pending_confirmation",
    objective_score: Number(scoreValue.toFixed(2)),
    preference_boost: 0,
    base_final_rank: Number(scoreValue.toFixed(2)),
    final_rank: Number(scoreValue.toFixed(2)),
    matched_interest_topics: directionMatches,
    project_brief_cn: signal.description ?? signal.project_name,
    why_today_cn: `它来自 mission scout 对「${displayName}」方向的候选发现，适合作为待确认观察对象。`,
    enhancement_source: "template_fallback",
    summary_source: "template_fallback",
    position_qualification: "keep-observing",
    judge_score_delta: 0,
    judge_source: "template_fallback",
    direction_matches: directionMatches,
    appearance_reason_codes: ["mission_scout_candidate"],
    appearance_explanation_cn: `该项目来自「${displayName}」方向搜索候选，进入探索补位而非正式主榜。`,
    exposure_bucket: "explore_ribbon",
    head_project: false,
    head_saturation_state: "normal",
  };
}

function buildMissionScoutInventory(date: string, surfacedProjects: DailyRankedProject[]): DailyRankedProject[] {
  const artifact = getMissionScoutArtifact(date);
  if (artifact.status !== "ok") return [];

  const surfacedKeys = new Set(surfacedProjects.map((project) => project.project.repo_full_name.toLowerCase()));
  const perDirectionCount = new Map<string, number>();
  const projects: DailyRankedProject[] = [];

  for (const signal of artifact.value.raw_signals ?? []) {
    const candidate = buildMissionScoutInventoryProject(signal);
    if (!candidate) continue;

    const repoKey = candidate.project.repo_full_name.toLowerCase();
    if (surfacedKeys.has(repoKey)) continue;

    const primaryDirection = candidate.direction_matches?.[0] ?? "unknown";
    const currentCount = perDirectionCount.get(primaryDirection) ?? 0;
    if (currentCount >= 8) continue;

    surfacedKeys.add(repoKey);
    perDirectionCount.set(primaryDirection, currentCount + 1);
    projects.push(candidate);
  }

  return projects.sort(comparePersonalizedProjects);
}

function readTodayPulseProjects(report: DailyReport): DailyRankedProject[] {
  const todayPulseProjects = Array.isArray(report.today_pulse_projects) ? report.today_pulse_projects : [];
  const todayStarProjects = Array.isArray(report.today_star_projects) ? report.today_star_projects : [];
  return todayPulseProjects.length > 0 ? todayPulseProjects : todayStarProjects;
}

function readMissionProjects(report: DailyReport): DailyRankedProject[] {
  const missionProjects = Array.isArray(report.mission_match_projects) ? report.mission_match_projects : [];
  return missionProjects;
}

function readExploreRibbonProjects(report: DailyReport): DailyRankedProject[] {
  return Array.isArray(report.explore_ribbon_projects) ? report.explore_ribbon_projects : [];
}

function distinctInterestTopics(topics: UserInterestTopicName[] | undefined): UserInterestTopicName[] {
  return [...new Set((topics ?? []).map((topic) => topic.trim()).filter((topic): topic is UserInterestTopicName => topic.length > 0))];
}

function buildInterestSearchIndex(project: DailyRankedProject): { compact: string; tokenized: string } {
  const source = [
    project.project.project_name,
    project.project.repo_full_name,
    project.project.repo_url,
    project.project.description,
    project.project_brief_cn,
    project.why_today_cn,
    project.personalization_reason_cn,
    project.score.paradigm,
    ...project.project.tags,
    ...project.project.sources,
    ...project.matched_interest_topics,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    compact: source,
    tokenized: ` ${source.replace(/[^a-z0-9]+/g, " ").trim()} `,
  };
}

function projectMatchesInterest(project: DailyRankedProject, topic: UserInterestTopicName): boolean {
  const normalizedTopic = topic.trim().toLowerCase();
  if (!normalizedTopic) return false;
  const variant = normalizedTopic.replace(/-/g, " ");
  const searchIndex = buildInterestSearchIndex(project);
  const topicTokens = variant.split(/\s+/).filter(Boolean);

  if (searchIndex.compact.includes(normalizedTopic) || searchIndex.compact.includes(variant)) return true;
  if (topicTokens.length > 1 && topicTokens.every((token) => searchIndex.tokenized.includes(` ${token} `))) return true;
  if (normalizedTopic.length <= 2) return searchIndex.tokenized.includes(` ${normalizedTopic} `);
  if (normalizedTopic === "agent-runtime") return searchIndex.tokenized.includes(" agent ") && searchIndex.tokenized.includes(" runtime ");
  if (normalizedTopic === "coding-agent") return searchIndex.tokenized.includes(" coding ") && searchIndex.tokenized.includes(" agent ");
  if (normalizedTopic === "infra") return searchIndex.tokenized.includes(" infrastructure ") || searchIndex.tokenized.includes(" infra ");
  return false;
}

function personalizeRankedProject(project: DailyRankedProject, interestTopics: UserInterestTopicName[]): DailyRankedProject {
  if (interestTopics.length === 0) return project;

  const matchedTopics = interestTopics.filter((topic) => projectMatchesInterest(project, topic));
  if (matchedTopics.length === 0) return project;

  const topicWeight = Number((1 / interestTopics.length).toFixed(4));
  const requestBoost = Number((matchedTopics.length * topicWeight * 10).toFixed(2));
  const combinedTopics = [...new Set([...project.matched_interest_topics, ...matchedTopics])] as UserInterestTopicName[];
  const personalizationReason = `登录偏好命中 ${matchedTopics.join("、")}，当前视图已按你的兴趣加权。`;
  const judgeDelta = Number((project.final_rank - project.base_final_rank).toFixed(2));
  const personalizedBaseRank = Number((project.base_final_rank + requestBoost).toFixed(2));

  return {
    ...project,
    preference_boost: Number((project.preference_boost + requestBoost).toFixed(2)),
    base_final_rank: personalizedBaseRank,
    final_rank: Number((personalizedBaseRank + judgeDelta).toFixed(2)),
    matched_interest_topics: combinedTopics,
    personalization_reason_cn: project.personalization_reason_cn
      ? `${project.personalization_reason_cn}；${personalizationReason}`
      : personalizationReason,
  };
}

function comparePersonalizedProjects(left: DailyRankedProject, right: DailyRankedProject): number {
  return right.final_rank - left.final_rank || right.base_final_rank - left.base_final_rank || right.score.total_score - left.score.total_score;
}

function personalizeDailyReportForRequest(report: DailyReport, requestInterestTopics: UserInterestTopicName[] | undefined): DailyReport {
  const interestTopics = distinctInterestTopics(requestInterestTopics);
  if (interestTopics.length === 0) return report;

  const todayStarProjects = readTodayPulseProjects(report).map((project) => personalizeRankedProject(project, interestTopics)).sort(comparePersonalizedProjects);
  const contextOnlyProjects = report.context_only_projects.map((project) => personalizeRankedProject(project, interestTopics)).sort(comparePersonalizedProjects);

  return {
    ...report,
    personalized_relevance_applicable: report.personalized_relevance_applicable || interestTopics.length > 0,
    today_star_projects: todayStarProjects,
    today_pulse_projects: todayStarProjects,
    mission_match_projects: readMissionProjects(report).map((project) => personalizeRankedProject(project, interestTopics)).sort(comparePersonalizedProjects),
    context_only_projects: contextOnlyProjects,
  };
}

function buildExtendedProjectInventory(
  report: DailyReport,
  requestInterestTopics: UserInterestTopicName[] | undefined,
  surfacedProjects: DailyRankedProject[],
): DailyRankedProject[] {
  const surfacedKeys = new Set(surfacedProjects.map((project) => project.project.repo_full_name.toLowerCase()));
  const interestTopics = distinctInterestTopics(requestInterestTopics);

  return (Array.isArray(report.all_projects) ? report.all_projects : [])
    .filter((project) => !surfacedKeys.has(project.project.repo_full_name.toLowerCase()))
    .map((project) => buildCatalogInventoryProject(project))
    .map((project) => personalizeRankedProject(project, interestTopics))
    .sort(comparePersonalizedProjects);
}

function buildRunSnapshot(
  date: string,
  options?: { requestInterestTopics?: UserInterestTopicName[] },
): { snapshot: RunSnapshot | null; auditNotes: string[]; githubStatus: string } {
  const signature = getFilesystemStateSignature([
    `data/reports/${date}.daily.json`,
    `data/reports/${date}.run-summary.json`,
    `data/reports/${date}.verify-daily.json`,
    `data/raw/github/${date}.enrichment.json`,
    `data/observer/ecosystem-focus/${date}.json`,
  ]);
  const base = readDerivedCache(runSnapshotCache, date, signature, () => {
    const daily = getDailyReport(date);
    if (daily.status !== "ok") return { snapshot: null, auditNotes: [], githubStatus: "unknown" };

    const summary = getRunSummary(date);
    const verify = getVerifyDailyResult(date);
    const githubAudit = getGithubEnrichmentAudit(date);
    const observer = getObserverArtifact(date);
    const githubStatus =
      githubAudit.status === "ok"
        ? githubAudit.value.some((entry) => entry.status === "unavailable" || entry.status === "invalid_repo")
          ? "fallback/partial"
          : "ok"
        : githubAudit.status === "not_found"
          ? "missing"
          : "failed";

    const notes: string[] = [];
    if (summary.status === "not_found") notes.push("健康上下文缺失");
    if (summary.status === "parse_error") notes.push("run-summary 解析失败");
    if (verify.status === "not_found") notes.push("verify 上下文缺失");
    if (githubAudit.status === "not_found") notes.push("GitHub enrichment 审计缺失");

    return {
      snapshot: {
        date,
        daily_report: daily.value,
        run_summary: summary.status === "ok" ? summary.value : null,
        verify_result: verify.status === "ok" ? verify.value : null,
        github_audit: githubAudit.status === "ok" ? githubAudit.value : null,
        observer_artifact: observer.status === "ok" ? observer.value : null,
      },
      auditNotes: notes,
      githubStatus,
    };
  });

  if (base.snapshot) {
    const personalizedReport = personalizeDailyReportForRequest(base.snapshot.daily_report, options?.requestInterestTopics);
    if (personalizedReport !== base.snapshot.daily_report) {
      return {
        snapshot: {
          ...base.snapshot,
          daily_report: personalizedReport,
        },
        auditNotes: base.auditNotes,
        githubStatus: base.githubStatus,
      };
    }
  }

  return base;
}

function reportEvidenceMatrixToParsed(
  matrix: WeeklyReport["evidence_matrix"] | undefined,
): WeeklySnapshot["markdown"]["evidence_matrix"] {
  if (!matrix) return null;
  return {
    focused_trend_key: matrix.focused_trend_key,
    focused_trend_name_cn: matrix.focused_trend_name_cn,
    summary_cn: matrix.summary_cn,
    axes: matrix.axes.map((axis) => ({
      axis: axis.axis,
      score: axis.score,
      project_count: axis.project_count,
      high_signal_project_count: axis.high_signal_project_count,
      evidence_count: axis.evidence_count,
      sample_projects: axis.sample_projects.map((project) => project.repo_full_name),
      top_evidence: [...axis.top_evidence],
      summary_cn: axis.summary_cn,
    })),
  };
}

function mergeParsedWeeklyEvidenceMatrix(
  parsed: WeeklySnapshot["markdown"]["evidence_matrix"],
  reportMatrix: WeeklySnapshot["markdown"]["evidence_matrix"],
): WeeklySnapshot["markdown"]["evidence_matrix"] {
  if (parsed === null) return reportMatrix;
  return {
    focused_trend_key: preferParsedValue(parsed.focused_trend_key, reportMatrix?.focused_trend_key),
    focused_trend_name_cn: preferParsedValue(parsed.focused_trend_name_cn, reportMatrix?.focused_trend_name_cn),
    summary_cn: preferParsedValue(parsed.summary_cn, reportMatrix?.summary_cn),
    axes: preferNonEmptyList(parsed.axes, reportMatrix?.axes ?? []),
  };
}

function reportCoreTrendCardsToParsed(
  cards: WeeklyReport["core_trend_cards"],
): WeeklySnapshot["markdown"]["core_trend_cards"] {
  return cards.map((card) => ({
    trend_key: card.trend_key,
    trend_name_cn: card.trend_name_cn,
    trend_summary_cn: card.trend_summary_cn,
    evidence_summary_cn: card.evidence_summary_cn,
    strength: card.strength,
    worth_following_next_week: card.worth_following_next_week,
    evidence_matrix: reportEvidenceMatrixToParsed(card.evidence_matrix),
    supporting_projects: card.supporting_projects.map((project) => ({
      repo_url: project.repo_url,
      project_name: project.project_name,
      objective_score: project.objective_score,
      base_final_rank: project.base_final_rank,
      final_rank: project.final_rank,
      project_brief_cn: project.project_brief_cn ?? null,
      why_this_week_cn: project.why_this_week_cn ?? null,
      enhancement_source: project.enhancement_source ?? null,
      personalization_reason_cn: project.personalization_reason_cn ?? null,
      risk_review_required: Boolean(project.risk_review_required),
      risk_review_note_cn: project.risk_review_note_cn ?? null,
      risk_review_source: project.risk_review_source ?? null,
      watchlist_note_cn: project.watchlist_note_cn ?? null,
    })),
  }));
}

function reportWeakSignalCardsToParsed(
  cards: WeeklyReport["weak_signal_cards"],
): WeeklySnapshot["markdown"]["weak_signal_cards"] {
  return cards.map((card) => ({
    trend_key: card.trend_key,
    signal_name_cn: card.signal_name_cn,
    why_weak_cn: card.why_weak_cn,
    evidence_summary_cn: card.evidence_summary_cn,
    worth_following_next_week: card.worth_following_next_week,
  }));
}

function judgmentProjectByRepo(
  judgment: WeeklyJudgmentReport,
): Map<string, WeeklyJudgmentReport["rule_materials"]["evidence_projects"][number]> {
  return new Map(
    judgment.rule_materials.evidence_projects.map((project) => [project.repo_full_name.toLowerCase(), project] as const),
  );
}

function judgmentTrendKey(trendId: string, trendName: string): string {
  const normalizedName = trendName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalizedName) return normalizedName;
  return trendId.replace(/^candidate-cluster-/, "");
}

function judgmentSupportProjectsToParsed(
  judgment: WeeklyJudgmentReport,
  supportingProjectRefs: string[],
  fallbackReason: string,
): WeeklySnapshot["markdown"]["core_trend_cards"][number]["supporting_projects"] {
  const projectByRepo = judgmentProjectByRepo(judgment);
  return supportingProjectRefs
    .map((repoFullName) => projectByRepo.get(repoFullName.toLowerCase()))
    .filter((project): project is WeeklyJudgmentReport["rule_materials"]["evidence_projects"][number] => Boolean(project))
    .map((project) => ({
      repo_url: project.repo_url,
      project_name: project.project_name,
      objective_score: project.total_score,
      base_final_rank: project.total_score,
      final_rank: project.total_score,
      project_brief_cn: project.description || null,
      why_this_week_cn: fallbackReason,
      enhancement_source: "template_fallback",
      personalization_reason_cn: null,
      risk_review_required: project.risks.length > 0,
      risk_review_note_cn: project.risks[0] ?? null,
      risk_review_source: project.risks.length > 0 ? "template_fallback" : null,
      watchlist_note_cn: project.tags.includes("watchlist-hit") ? "你跟踪的对象有更新。" : null,
    }));
}

function judgmentCoreTrendCardsToParsed(
  judgment: WeeklyJudgmentReport,
): WeeklySnapshot["markdown"]["core_trend_cards"] {
  return judgment.established_trends.map((trend) => ({
    trend_key: judgmentTrendKey(trend.trend_id, trend.trend_name_cn),
    trend_name_cn: trend.trend_name_cn,
    trend_summary_cn: trend.claim_cn,
    evidence_summary_cn: trend.evidence_refs.slice(0, 2).join("；") || trend.why_established_cn,
    strength: trend.audit_confidence === "high" ? "strong" : "medium",
    worth_following_next_week: trend.watch_next_week_cn,
    evidence_matrix: null,
    supporting_projects: judgmentSupportProjectsToParsed(judgment, trend.supporting_project_refs, trend.why_established_cn),
  }));
}

function judgmentWeakSignalsToParsed(
  judgment: WeeklyJudgmentReport,
): WeeklySnapshot["markdown"]["weak_signal_cards"] {
  return judgment.observing_trends.map((trend) => ({
    trend_key: judgmentTrendKey(trend.trend_id, trend.trend_name_cn),
    signal_name_cn: trend.trend_name_cn,
    why_weak_cn: trend.why_not_established_cn,
    evidence_summary_cn: trend.evidence_refs.slice(0, 2).join("；") || trend.why_not_established_cn,
    worth_following_next_week: trend.watch_next_week_cn,
  }));
}

function preferParsedValue<T>(primary: T | null | undefined, fallback: T | null | undefined): T | null {
  if (primary !== null && primary !== undefined) {
    return primary;
  }
  return fallback ?? null;
}

function preferNonEmptyList<T>(primary: T[], fallback: T[]): T[] {
  return primary.length > 0 ? primary : [...fallback];
}

function mergeWeeklySupportProjects(
  parsedProjects: WeeklySnapshot["markdown"]["core_trend_cards"][number]["supporting_projects"],
  reportProjects: WeeklySnapshot["markdown"]["core_trend_cards"][number]["supporting_projects"],
): WeeklySnapshot["markdown"]["core_trend_cards"][number]["supporting_projects"] {
  if (parsedProjects.length === 0) return [...reportProjects];

  const reportByRepo = new Map(reportProjects.map((project) => [project.repo_url.toLowerCase(), project] as const));
  const mergedProjects = parsedProjects.map((project) => {
    const reportProject = reportByRepo.get(project.repo_url.toLowerCase());
    if (!reportProject) return project;
    return {
      ...reportProject,
      ...project,
      project_brief_cn: preferParsedValue(project.project_brief_cn, reportProject.project_brief_cn),
      why_this_week_cn: preferParsedValue(project.why_this_week_cn, reportProject.why_this_week_cn),
      enhancement_source: preferParsedValue(project.enhancement_source, reportProject.enhancement_source),
      personalization_reason_cn: preferParsedValue(project.personalization_reason_cn, reportProject.personalization_reason_cn),
      risk_review_required: project.risk_review_required || reportProject.risk_review_required,
      risk_review_note_cn: preferParsedValue(project.risk_review_note_cn, reportProject.risk_review_note_cn),
      risk_review_source: preferParsedValue(project.risk_review_source, reportProject.risk_review_source),
      watchlist_note_cn: preferParsedValue(project.watchlist_note_cn, reportProject.watchlist_note_cn),
    };
  });
  const parsedRepos = new Set(parsedProjects.map((project) => project.repo_url.toLowerCase()));
  const reportOnlyProjects = reportProjects.filter((project) => !parsedRepos.has(project.repo_url.toLowerCase()));
  return [...mergedProjects, ...reportOnlyProjects];
}

function mergeWeeklyCoreTrendCards(
  parsedCards: WeeklySnapshot["markdown"]["core_trend_cards"],
  reportCards: WeeklySnapshot["markdown"]["core_trend_cards"],
): WeeklySnapshot["markdown"]["core_trend_cards"] {
  if (parsedCards.length === 0) return [...reportCards];

  const reportByTrendKey = new Map(reportCards.map((card) => [card.trend_key, card] as const));
  const mergedCards = parsedCards.map((card) => {
    const reportCard = reportByTrendKey.get(card.trend_key);
    if (!reportCard) return card;
    return {
      ...reportCard,
      ...card,
      trend_name_cn: preferParsedValue(card.trend_name_cn, reportCard.trend_name_cn) ?? reportCard.trend_name_cn,
      trend_summary_cn: preferParsedValue(card.trend_summary_cn, reportCard.trend_summary_cn),
      evidence_summary_cn: preferParsedValue(card.evidence_summary_cn, reportCard.evidence_summary_cn),
      strength: preferParsedValue(card.strength, reportCard.strength),
      worth_following_next_week: preferParsedValue(card.worth_following_next_week, reportCard.worth_following_next_week),
      evidence_matrix: mergeParsedWeeklyEvidenceMatrix(card.evidence_matrix, reportCard.evidence_matrix),
      supporting_projects: mergeWeeklySupportProjects(card.supporting_projects, reportCard.supporting_projects),
    };
  });
  const parsedTrendKeys = new Set(parsedCards.map((card) => card.trend_key));
  const reportOnlyCards = reportCards.filter((card) => !parsedTrendKeys.has(card.trend_key));
  return [...mergedCards, ...reportOnlyCards];
}

function mergeWeeklyMarkdownWithStructuredReport(
  parsed: WeeklySnapshot["markdown"],
  report: WeeklyReport | null,
  judgment: WeeklyJudgmentReport | null,
): WeeklySnapshot["markdown"] {
  if (!report && !judgment) return parsed;

  const structuredMatrix = report
    ? reportEvidenceMatrixToParsed(report.evidence_matrix)
    : judgment
      ? reportEvidenceMatrixToParsed(judgment.evidence_matrix)
      : null;
  const structuredSummary = report?.overall_summary_cn ?? judgment?.executive_summary_cn ?? null;
  const structuredEnhancementStatus = report?.enhancement_status ?? judgment?.enhancement_status ?? null;
  const structuredSupportingTrendKeys =
    report?.supporting_trend_keys ??
    judgment?.established_trends.map((trend) => judgmentTrendKey(trend.trend_id, trend.trend_name_cn)) ??
    [];
  const structuredCoreTrendCards = report
    ? reportCoreTrendCardsToParsed(report.core_trend_cards)
    : judgment
      ? judgmentCoreTrendCardsToParsed(judgment)
      : [];
  const structuredWeakSignalCards = report
    ? reportWeakSignalCardsToParsed(report.weak_signal_cards)
    : judgment
      ? judgmentWeakSignalsToParsed(judgment)
      : [];

  return {
    generated_at: preferParsedValue(parsed.generated_at, report?.generated_at ?? judgment?.generated_at),
    window_start: preferParsedValue(parsed.window_start, report?.window_start ?? judgment?.window_start),
    window_end: preferParsedValue(parsed.window_end, report?.window_end ?? judgment?.window_end),
    overall_summary_cn: preferParsedValue(parsed.overall_summary_cn, structuredSummary),
    enhancement_status: preferParsedValue(parsed.enhancement_status, structuredEnhancementStatus),
    supporting_trend_keys: preferNonEmptyList(parsed.supporting_trend_keys, structuredSupportingTrendKeys),
    evidence_matrix: mergeParsedWeeklyEvidenceMatrix(parsed.evidence_matrix, structuredMatrix),
    core_trend_cards: mergeWeeklyCoreTrendCards(parsed.core_trend_cards, structuredCoreTrendCards),
    weak_signal_cards: preferNonEmptyList(parsed.weak_signal_cards, structuredWeakSignalCards),
  };
}

function buildWeeklySnapshot(anchorDate: string): { snapshot: WeeklySnapshot | null; notes: string[] } {
  const signature = getFilesystemStateSignature([
    `data/reports/${anchorDate}.weekly.md`,
    `data/reports/${anchorDate}.weekly.json`,
    `data/reports/${anchorDate}.weekly.judgment.json`,
    `data/reports/${anchorDate}.weekly.audit.json`,
  ]);
  return readDerivedCache(weeklySnapshotCache, anchorDate, signature, () => {
    const weekly = getWeeklyReport(anchorDate);
    if (weekly.status !== "ok") return { snapshot: null, notes: [] };
    const structured = getWeeklyStructuredReport(anchorDate);
    const judgment = getWeeklyJudgmentReport(anchorDate);
    const parsed = mergeWeeklyMarkdownWithStructuredReport(
      parseWeeklyMarkdown(weekly.value),
      structured.status === "ok" ? structured.value : null,
      judgment.status === "ok" ? judgment.value : null,
    );
    const audit = getWeeklyAudit(anchorDate);
    const notes: string[] = [];
    if (structured.status === "not_found" && judgment.status !== "ok") notes.push("weekly JSON 缺失");
    if (structured.status === "parse_error" && judgment.status !== "ok") notes.push("weekly JSON 解析失败");
    if (judgment.status === "not_found") notes.push("weekly judgment JSON 缺失");
    if (judgment.status === "parse_error") notes.push("weekly judgment JSON 解析失败");
    if (audit.status === "not_found") notes.push("审计上下文缺失");
    if (audit.status === "parse_error") notes.push("weekly audit 解析失败");
    return {
      snapshot: {
        anchor_date: anchorDate,
        markdown: parsed,
        judgment_status: judgment.status,
        judgment_enhancement_status: judgment.status === "ok" ? judgment.value.enhancement_status : null,
        judgment_rule_candidate_count: judgment.status === "ok" ? judgment.value.rule_materials.trend_candidates.length : 0,
        judgment_unexplained_project_count:
          judgment.status === "ok" ? judgment.value.rule_materials.unexplained_project_refs.length : 0,
        judgment_anomaly_project_count:
          judgment.status === "ok" ? judgment.value.rule_materials.anomaly_project_refs.length : 0,
        audit_status: audit.status,
        audit_enhancement_status: audit.status === "ok" ? audit.value.enhancement_status : null,
        audit_rejected_outputs: audit.status === "ok" ? audit.value.rejected_outputs.length : 0,
      },
      notes,
    };
  });
}

function buildDailyCurrentPreview(date: string, snapshot: RunSnapshot | null): DailyTimeNavigatorPreview {
  if (!snapshot) return getDailyNavigatorPreview(date);
  const sourceStatus = snapshot.run_summary?.source_status ?? [];
  const hasJudgment = Boolean(snapshot.daily_report.overall_daily_status);
  const topLevelState =
    snapshot.daily_report.all_projects.length === 0
      ? "empty"
      : !hasJudgment
        ? "not-judgeable"
        : !snapshot.run_summary || !snapshot.verify_result || snapshot.daily_report.enhancement_status === "rules-only"
          ? "degraded"
          : "ready";

  return {
    kind: "daily",
    slice_key: date,
    generated_at: snapshot.daily_report.generated_at,
    top_level_state: topLevelState,
    enhancement_status: snapshot.daily_report.enhancement_status,
    top_decision_count: readTodayPulseProjects(snapshot.daily_report).length,
    source_active_count: sourceStatus.filter((entry) => entry.status === "active").length,
    failed_count: sourceStatus.filter((entry) => entry.status === "failed").length,
    empty_count: sourceStatus.filter((entry) => entry.status === "empty").length,
    verify_status: snapshot.verify_result?.status ?? null,
  };
}

function buildWeeklyCurrentPreview(anchorDate: string, snapshot: WeeklySnapshot | null): WeeklyTimeNavigatorPreview {
  if (!snapshot) return getWeeklyNavigatorPreview(anchorDate);
  const parsed = snapshot.markdown;
  const topLevelState =
    parsed.core_trend_cards.length === 0 && parsed.weak_signal_cards.length === 0
      ? "empty"
      : parsed.core_trend_cards.length === 0
        ? "not-judgeable"
        : snapshot.audit_status !== "ok" || parsed.enhancement_status === "rules-only"
          ? "degraded"
          : "ready";

  return {
    kind: "weekly",
    slice_key: anchorDate,
    generated_at: parsed.generated_at,
    top_level_state: topLevelState,
    enhancement_status: parsed.enhancement_status,
    core_trend_count: parsed.core_trend_cards.length,
    weak_signal_count: parsed.weak_signal_cards.length,
    audit_status: snapshot.audit_status,
  };
}

function buildDailyNavigator(date: string | null, stale: boolean, snapshot: RunSnapshot | null): TimeNavigatorModel {
  const window = resolveDailyTimeWindow(date);
  const previews = [];
  if (window.previous) previews.push(getDailyNavigatorPreview(window.previous));
  if (window.current) previews.push(buildDailyCurrentPreview(window.current, snapshot));
  if (window.next) previews.push(getDailyNavigatorPreview(window.next));

  return {
    mode: "daily",
    current_key: window.current,
    latest_key: window.latest,
    previous_key: window.previous,
    next_key: window.next,
    current_label: window.current ?? "daily-unavailable",
    stale,
    window,
    previews,
  };
}

function buildWeeklyNavigator(anchorDate: string | null, stale: boolean, snapshot: WeeklySnapshot | null): TimeNavigatorModel {
  const window = resolveWeeklyTimeWindow(anchorDate);
  const previews = [];
  if (window.previous) previews.push(getWeeklyNavigatorPreview(window.previous));
  if (window.current) previews.push(buildWeeklyCurrentPreview(window.current, snapshot));
  if (window.next) previews.push(getWeeklyNavigatorPreview(window.next));

  return {
    mode: "weekly",
    current_key: window.current,
    latest_key: window.latest,
    previous_key: window.previous,
    next_key: window.next,
    current_label: snapshot?.markdown.window_start && snapshot?.markdown.window_end ? `${snapshot.markdown.window_start} -> ${snapshot.markdown.window_end}` : window.current ?? "weekly-unavailable",
    stale,
    window,
    previews,
  };
}

function buildProjectKbPreview(project: DailyReport["today_star_projects"][number] | DailyReport["context_only_projects"][number]): {
  kb_preview: KnowledgeCard | null;
  kb_missing: boolean;
} {
  const kbIndex = getKbIndex();
  if (kbIndex.status !== "ok") return { kb_preview: null, kb_missing: true };
  const repoKey = repoKeyFromProject(project.project);
  const preview = kbIndex.value.find((item) => item.repo_url.toLowerCase().includes(repoKey) || knowledgeCardSlug(item.project_name) === knowledgeCardSlug(project.project.project_name)) ?? null;
  return { kb_preview: preview, kb_missing: preview === null };
}

function summarizeSourceHealth(snapshot: RunSnapshot | null): string {
  if (!snapshot?.run_summary) return "health-context-missing";
  const { source_status } = snapshot.run_summary;
  return `active=${source_status.filter((item) => item.status === "active").length}, empty=${source_status.filter((item) => item.status === "empty").length}, failed=${source_status.filter((item) => item.status === "failed").length}`;
}

function readObserverIncubatingDirections(
  artifact: RunSnapshot["observer_artifact"] | ObserverViewModel["artifact"] | null,
) {
  return Array.isArray(artifact?.incubating_directions) ? artifact.incubating_directions : [];
}

function readObserverPromotionCandidates(
  artifact: RunSnapshot["observer_artifact"] | ObserverViewModel["artifact"] | null,
) {
  return Array.isArray(artifact?.promotion_candidates) ? artifact.promotion_candidates : [];
}

function buildOverviewStateEntries(snapshot: RunSnapshot | null, stale: boolean) {
  const statuses = [];
  if (!snapshot) {
    statuses.push({ status: "failed" as const, reason: "当前日期 daily 结果不存在" });
    return statuses;
  }
  if (stale) statuses.push({ status: "stale" as const, reason: "latest 已解析到非当天结果" });
  if (!snapshot.run_summary) statuses.push({ status: "degraded" as const, reason: "健康上下文缺失" });
  if (snapshot.daily_report.enhancement_status === "rules-only") statuses.push({ status: "degraded" as const, reason: "当前为 rules-only 模式" });
  if (snapshot.daily_report.all_projects.length === 0) statuses.push({ status: "empty" as const, reason: "当日没有可展示项目" });
  if (!snapshot.daily_report.overall_daily_status) statuses.push({ status: "not-judgeable" as const, reason: "缺少 overall_daily_status" });
  if (statuses.length === 0) statuses.push({ status: "ready" as const, reason: "daily artifact 可直接消费" });
  return statuses;
}

function findSelectedProject(
  projects: ProjectsViewModel["projects"],
  selectedProject: string | undefined,
): ProjectsViewModel["projects"][number] | null {
  if (!selectedProject) return null;
  return (
    projects.find((project) =>
      [project.project.repo_full_name, project.project.repo_url, project.project.project_name].some(
        (token) => token.toLowerCase() === selectedProject.toLowerCase(),
      ),
    ) ?? null
  );
}

function buildWeeklyStateEntries(snapshot: WeeklySnapshot | null, stale: boolean) {
  const statuses = [];
  if (!snapshot) {
    statuses.push({ status: "failed" as const, reason: "当前时间窗 weekly 结果不存在" });
    return statuses;
  }
  if (stale) statuses.push({ status: "stale" as const, reason: "latest 已解析到非最新 weekly" });
  if (snapshot.audit_status === "not_found") statuses.push({ status: "degraded" as const, reason: "审计上下文缺失" });
  if (snapshot.markdown.enhancement_status === "rules-only") statuses.push({ status: "degraded" as const, reason: "当前为 rules-only weekly" });
  if (snapshot.markdown.core_trend_cards.length === 0 && snapshot.markdown.weak_signal_cards.length > 0) {
    statuses.push({ status: "not-judgeable" as const, reason: "尚未形成稳定趋势" });
  }
  if (snapshot.markdown.core_trend_cards.length === 0 && snapshot.markdown.weak_signal_cards.length === 0) {
    statuses.push({ status: "empty" as const, reason: "当前 weekly 没有核心趋势或弱信号" });
  }
  if (statuses.length === 0) statuses.push({ status: "ready" as const, reason: "weekly artifact 可直接消费" });
  return statuses;
}

function buildWeeklyDrilldowns(snapshot: WeeklySnapshot | null, windowEnd: string | null, anchorDate: string): DrilldownRef[] {
  const drilldowns: DrilldownRef[] = [];
  for (const card of snapshot?.markdown.core_trend_cards ?? []) {
    for (const project of card.supporting_projects) {
      drilldowns.push({
        label: `${card.trend_key} -> ${project.project_name}`,
        view: "projects",
        date: snapshot?.markdown.window_end ?? windowEnd ?? undefined,
        project: project.repo_url,
        trend_key: card.trend_key,
        anchor_date: anchorDate,
      });
    }
  }
  return drilldowns;
}

function makeSurfaceBlock(args: {
  id: string;
  role: SurfaceBlockModel["role"];
  title: string;
  state?: TopLevelViewStatus | "neutral";
  body?: string | null;
  primaryObjectKey?: string | null;
  emphasis?: SurfaceBlockModel["emphasis"];
}): SurfaceBlockModel {
  return {
    id: args.id,
    role: args.role,
    title: args.title,
    body: args.body ?? null,
    state: args.state ?? "neutral",
    primaryObjectKey: args.primaryObjectKey ?? null,
    emphasis: args.emphasis ?? "secondary",
    slots: [],
    sections: [],
    anchors: [],
  };
}

function buildAuditSurface(route: RouteFrameModel["route"], state: { status: TopLevelViewStatus; reasons: string[] }): SurfaceBlockModel[] {
  if (state.status === "ready" && state.reasons.length === 0) return [];
  return [
    makeSurfaceBlock({
      id: `${route}-audit`,
      role: "audit",
      title: "Audit Notes",
      state: state.status,
      body: state.reasons.join(" | ") || "No blocking audit notes.",
      emphasis: "tertiary",
    }),
  ];
}

function buildOverviewRouteFrame(model: Pick<OverviewViewModel, "state" | "top_decisions" | "weekly_entry">): RouteFrameModel {
  return {
    route: "overview",
    hero: makeSurfaceBlock({
      id: "overview-decision-gate-hero",
      role: "hero",
      title: "Trust Gate",
      state: model.state.status,
      body: model.state.reasons[0] ?? "Overview is ready for scanning.",
      emphasis: "primary",
    }),
    stage: [
      makeSurfaceBlock({
        id: "overview-spotlight-continuation-stage",
        role: "stage",
        title: "Decision Gate",
        state: model.state.status,
        body: `${model.top_decisions.length} top decision(s) are staged.`,
        emphasis: "primary",
      }),
      makeSurfaceBlock({
        id: "overview-research-stream-stage",
        role: "stage",
        title: "Research Stream",
        state: model.state.status,
      }),
    ],
    rail: [makeSurfaceBlock({ id: "overview-context-rail", role: "rail", title: "Continuation Rail" })],
    strip: [makeSurfaceBlock({ id: "overview-instrument-strip", role: "strip", title: "Instrument Strip" })],
    dock: model.weekly_entry
      ? makeSurfaceBlock({
          id: "overview-selected-project-dock",
          role: "dock",
          title: "Weekly Entry Dock",
          primaryObjectKey: model.weekly_entry.anchor_date ?? null,
        })
      : null,
    reader: null,
    audit: buildAuditSurface("overview", model.state),
  };
}

function buildProjectsRouteFrame(model: Pick<ProjectsViewModel, "state" | "projects" | "selected_project">): RouteFrameModel {
  return {
    route: "projects",
    hero: null,
    stage: [
      makeSurfaceBlock({
        id: "projects-scan-rows",
        role: "stage",
        title: "Scan Bench",
        state: model.state.status,
        body: `${model.projects.length} project row(s) are available.`,
        emphasis: "primary",
      }),
    ],
    rail: [makeSurfaceBlock({ id: "projects-reading-hints-rail", role: "rail", title: "Reading Hints" })],
    strip: [makeSurfaceBlock({ id: "projects-filter-bench", role: "strip", title: "Filter Bench" })],
    dock: model.selected_project
      ? makeSurfaceBlock({
          id: "projects-dossier-dock",
          role: "dock",
          title: "Project Dossier",
          state: model.state.status,
          primaryObjectKey: repoKeyFromProject(model.selected_project.project.project),
        })
      : null,
    reader: null,
    audit: buildAuditSurface("projects", model.state),
  };
}

function buildWeeklyRouteFrame(model: Pick<WeeklyViewModel, "state" | "weekly_snapshot">): RouteFrameModel {
  return {
    route: "weekly",
    hero: makeSurfaceBlock({
      id: "weekly-cover-stage",
      role: "hero",
      title: "Weekly Cover",
      state: model.state.status,
      body: model.weekly_snapshot?.markdown.overall_summary_cn ?? model.state.reasons[0] ?? null,
      emphasis: "primary",
    }),
    stage: [
      makeSurfaceBlock({ id: "weekly-evidence-matrix", role: "stage", title: "Evidence Matrix", state: model.state.status }),
      makeSurfaceBlock({ id: "weekly-core-trend-stage", role: "stage", title: "Core Trend Stage", state: model.state.status }),
    ],
    rail: [makeSurfaceBlock({ id: "weekly-judgment-rail", role: "rail", title: "Context Rail" })],
    strip: [
      makeSurfaceBlock({ id: "weekly-weak-signal-strip", role: "strip", title: "Weak Signal Strip" }),
      makeSurfaceBlock({ id: "weekly-watchpoints-strip", role: "strip", title: "Watchpoints" }),
    ],
    dock: null,
    reader: null,
    audit: buildAuditSurface("weekly", model.state),
  };
}

function buildRunHealthRouteFrame(model: Pick<RunHealthViewModel, "state" | "run_snapshot">): RouteFrameModel {
  return {
    route: "run-health",
    hero: makeSurfaceBlock({
      id: "run-health-trust-hero",
      role: "hero",
      title: "Trust Gate",
      state: model.state.status,
      body: model.run_snapshot?.run_summary?.overall_daily_status ?? model.state.reasons[0] ?? null,
      emphasis: "primary",
    }),
    stage: [makeSurfaceBlock({ id: "run-health-source-stage", role: "stage", title: "Source Status Stage", state: model.state.status })],
    rail: [makeSurfaceBlock({ id: "run-health-actions-rail", role: "rail", title: "Recommended Actions" })],
    strip: [],
    dock: null,
    reader: null,
    audit:
      model.state.status === "ready" && model.state.reasons.length === 0
        ? [makeSurfaceBlock({ id: "run-health-audit-stage", role: "audit", title: "Audit Stage", state: model.state.status })]
        : buildAuditSurface("run-health", model.state).map((surface) => ({ ...surface, id: "run-health-audit-stage" })),
  };
}

function buildObserverRouteFrame(model: Pick<ObserverViewModel, "state" | "artifact" | "banner">): RouteFrameModel {
  return {
    route: "observer",
    hero: makeSurfaceBlock({
      id: "observer-discovery-hero",
      role: "hero",
      title: "Discovery Workbench",
      state: model.state.status,
      body: model.banner.notes[0] ?? "Observer findings are ecosystem-first and not scored.",
      emphasis: "primary",
    }),
    stage: [
      makeSurfaceBlock({
        id: "observer-ecosystem-stage",
        role: "stage",
        title: "Ecosystem Coverage",
        state: model.state.status,
      }),
      makeSurfaceBlock({
        id: "observer-candidates-stage",
        role: "stage",
        title: "Candidate Bench",
        state: model.state.status,
      }),
    ],
    rail: [makeSurfaceBlock({ id: "observer-guidance-rail", role: "rail", title: "Observer Guidance" })],
    strip: [makeSurfaceBlock({ id: "observer-evidence-strip", role: "strip", title: "Match Evidence" })],
    dock: null,
    reader: null,
    audit: buildAuditSurface("observer", model.state),
  };
}

function buildKnowledgeBaseRouteFrame(model: Pick<KnowledgeBaseViewModel, "state" | "selected_card">): RouteFrameModel {
  return {
    route: "kb",
    hero: model.selected_card
      ? makeSurfaceBlock({
          id: "kb-hero",
          role: "hero",
          title: "Executive Summary",
          state: model.state.status,
          body: model.selected_card.project_name,
          emphasis: "primary",
        })
      : null,
    stage: [makeSurfaceBlock({ id: "kb-index-stage", role: "stage", title: "Knowledge Index", state: model.state.status })],
    rail: [makeSurfaceBlock({ id: "kb-meta-rail", role: "rail", title: "Meta Rail" })],
    strip: [],
    dock: null,
    reader: model.selected_card
      ? makeSurfaceBlock({
          id: "kb-reader",
          role: "reader",
          title: "Reader Focus",
          state: model.state.status,
          primaryObjectKey: knowledgeCardSlug(model.selected_card.project_name),
        })
      : null,
    audit: buildAuditSurface("kb", model.state),
  };
}

export function buildOverviewView(
  dateOrLatest: string,
  options?: { requestInterestTopics?: UserInterestTopicName[] },
): OverviewViewModel {
  const resolved = resolveDailyContext(dateOrLatest);
  if (resolved.status === "failed" || !resolved.context.selected_date) {
    const state = makeState([{ status: "failed", reason: resolved.status === "failed" ? resolved.message : "daily 上下文缺失" }]);
    const view: OverviewViewModel = {
      context: resolved.context,
      banner: makeBanner({
        title: "Overview",
        contextLabel: "daily",
        generatedAt: null,
        notes: state.reasons,
      }),
      state,
      time_navigator: buildDailyNavigator(resolved.context.selected_date, resolved.context.stale, null),
      route_frame: {} as RouteFrameModel,
      run_snapshot: null,
      top_decisions: [],
      risks_and_actions: [],
      weekly_entry: null,
    };
    view.route_frame = buildOverviewRouteFrame(view);
    return view;
  }

  const { snapshot, auditNotes, githubStatus } = buildRunSnapshot(resolved.context.selected_date, options);
  resolved.context.generated_at = snapshot?.daily_report.generated_at ?? null;
  const state = makeState(buildOverviewStateEntries(snapshot, resolved.context.stale));
  const risksAndActions = snapshot?.run_summary
    ? [...snapshot.run_summary.watchouts, ...snapshot.run_summary.recommended_actions]
    : auditNotes;
  const weeklyAnchor = resolveNearestWeeklyAnchor(resolved.context.selected_date);

  const view: OverviewViewModel = {
    context: resolved.context,
    banner: makeBanner({
      title: "Overview",
      contextLabel: resolved.context.selected_date,
      generatedAt: snapshot?.daily_report.generated_at ?? null,
      enhancementStatus: snapshot?.daily_report.enhancement_status ?? null,
      githubStatus,
      sourceHealth: summarizeSourceHealth(snapshot),
      notes: auditNotes,
    }),
    state,
    time_navigator: buildDailyNavigator(resolved.context.selected_date, resolved.context.stale, snapshot),
    route_frame: {} as RouteFrameModel,
    run_snapshot: snapshot,
    top_decisions: snapshot ? readTodayPulseProjects(snapshot.daily_report) : [],
    risks_and_actions: risksAndActions,
    weekly_entry: weeklyAnchor
      ? { label: "Open Weekly", view: "weekly", anchor_date: weeklyAnchor }
      : null,
  };
  view.route_frame = buildOverviewRouteFrame(view);
  return view;
}

function buildFailedProjectsView(
  resolved: ReturnType<typeof resolveDailyContext>,
): ProjectsViewModel {
  const state = makeState([{ status: "failed", reason: resolved.status === "failed" ? resolved.message : "daily 上下文缺失" }]);
  const view: ProjectsViewModel = {
    context: resolved.context,
    banner: makeBanner({ title: "Projects", contextLabel: "daily", generatedAt: null, notes: state.reasons }),
    state,
    time_navigator: buildDailyNavigator(resolved.context.selected_date, resolved.context.stale, null),
    route_frame: {} as RouteFrameModel,
    today_pulse_projects: [],
    mission_match_projects: [],
    explore_ribbon_projects: [],
    historical_context_projects: [],
    projects: [],
    selected_project: null,
  };
  view.route_frame = buildProjectsRouteFrame(view);
  return view;
}

function buildProjectsState(
  snapshot: RunSnapshot | null,
  stale: boolean,
  projects: ProjectsViewModel["projects"],
) {
  if (!snapshot) {
    return makeState([{ status: "failed" as const, reason: "当前日期 daily 结果不存在" }]);
  }

  return makeState([
    stale ? { status: "stale" as const, reason: "latest 已解析到非当天结果" } : { status: "ready" as const, reason: "daily artifact 可直接消费" },
    snapshot.run_summary ? { status: "ready" as const, reason: null } : { status: "degraded" as const, reason: "健康上下文缺失" },
    projects.length > 0 ? { status: "ready" as const, reason: null } : { status: "empty" as const, reason: "当前日期没有已展示项目" },
  ]);
}

function buildSelectedProjectView(
  selected: ProjectsViewModel["projects"][number] | null,
  binding: Partial<ProjectContextBinding> | undefined,
  selectedDate: string,
): ProjectsViewModel["selected_project"] {
  if (!selected) return null;
  return {
    project: selected,
    binding: {
      source_view: binding?.source_view ?? "projects",
      date: binding?.date ?? selectedDate,
      window_end: binding?.window_end ?? null,
      trend_key: binding?.trend_key ?? null,
    },
    ...buildProjectKbPreview(selected),
  };
}

export function buildProjectsView(
  dateOrLatest: string,
  selectedProject?: string,
  binding?: Partial<ProjectContextBinding>,
  options?: { requestInterestTopics?: UserInterestTopicName[] },
): ProjectsViewModel {
  const resolved = resolveDailyContext(dateOrLatest);
  if (resolved.status === "failed" || !resolved.context.selected_date) {
    return buildFailedProjectsView(resolved);
  }

  const { snapshot, auditNotes, githubStatus } = buildRunSnapshot(resolved.context.selected_date, options);
  resolved.context.generated_at = snapshot?.daily_report.generated_at ?? null;
  const todayPulseProjects = snapshot ? readTodayPulseProjects(snapshot.daily_report) : [];
  const missionMatchProjects = snapshot ? readMissionProjects(snapshot.daily_report) : [];
  const exploreRibbonProjects = snapshot ? readExploreRibbonProjects(snapshot.daily_report) : [];
  const surfacedProjects = [...todayPulseProjects, ...missionMatchProjects, ...exploreRibbonProjects, ...(snapshot ? snapshot.daily_report.context_only_projects : [])];
  const missionScoutInventoryProjects = snapshot ? buildMissionScoutInventory(resolved.context.selected_date, surfacedProjects) : [];
  const surfacedWithScoutProjects = [...surfacedProjects, ...missionScoutInventoryProjects];
  const observerInventoryProjects = snapshot?.observer_artifact
    ? snapshot.observer_artifact.entries.map((entry) => buildObserverInventoryProject(entry))
    : [];
  const catalogInventoryProjects = snapshot
    ? buildExtendedProjectInventory(snapshot.daily_report, options?.requestInterestTopics, surfacedWithScoutProjects)
    : [];
  const historicalContextProjects = [...(snapshot ? snapshot.daily_report.context_only_projects : []), ...catalogInventoryProjects, ...observerInventoryProjects].filter(
    (project, index, all) =>
      all.findIndex((item) => item.project.repo_full_name.toLowerCase() === project.project.repo_full_name.toLowerCase()) === index,
  );
  const projects = snapshot
    ? [...todayPulseProjects, ...missionMatchProjects, ...exploreRibbonProjects, ...missionScoutInventoryProjects, ...historicalContextProjects].filter(
        (project, index, all) =>
          all.findIndex((item) => item.project.repo_full_name.toLowerCase() === project.project.repo_full_name.toLowerCase()) === index,
      )
    : [];
  const state = buildProjectsState(snapshot, resolved.context.stale, projects);
  const selected = snapshot ? findSelectedProject(projects, selectedProject) : null;

  const view: ProjectsViewModel = {
    context: resolved.context,
    banner: makeBanner({
      title: selected ? "Project Detail" : "Projects",
      contextLabel: resolved.context.selected_date,
      generatedAt: snapshot?.daily_report.generated_at ?? null,
      enhancementStatus: snapshot?.daily_report.enhancement_status ?? null,
      githubStatus,
      sourceHealth: summarizeSourceHealth(snapshot),
      notes: auditNotes,
    }),
    state,
    time_navigator: buildDailyNavigator(resolved.context.selected_date, resolved.context.stale, snapshot),
    route_frame: {} as RouteFrameModel,
    today_pulse_projects: todayPulseProjects,
    mission_match_projects: missionMatchProjects,
    explore_ribbon_projects: [...exploreRibbonProjects, ...missionScoutInventoryProjects].filter(
      (project, index, all) =>
        all.findIndex((item) => item.project.repo_full_name.toLowerCase() === project.project.repo_full_name.toLowerCase()) === index,
    ),
    historical_context_projects: historicalContextProjects,
    projects,
    selected_project: buildSelectedProjectView(selected, binding, resolved.context.selected_date),
  };
  view.route_frame = buildProjectsRouteFrame(view);
  return view;
}

export function buildWeeklyView(anchorDateOrLatest: string): WeeklyViewModel {
  const resolved = resolveWeeklyContext(anchorDateOrLatest);
  if (resolved.status === "failed" || !resolved.context.selected_window) {
    const state = makeState([{ status: "failed", reason: resolved.status === "failed" ? resolved.message : "weekly 上下文缺失" }]);
    const view: WeeklyViewModel = {
      context: resolved.context,
      banner: makeBanner({ title: "Weekly", contextLabel: "weekly", generatedAt: null, notes: state.reasons }),
      state,
      time_navigator: buildWeeklyNavigator(resolved.context.selected_window?.anchor_date ?? resolved.context.selected_date, resolved.context.stale, null),
      route_frame: {} as RouteFrameModel,
      weekly_snapshot: null,
      overall_judgment: null,
      supporting_project_drilldowns: [],
    };
    view.route_frame = buildWeeklyRouteFrame(view);
    return view;
  }

  const { snapshot, notes } = buildWeeklySnapshot(resolved.context.selected_window.anchor_date);
  resolved.context.generated_at = snapshot?.markdown.generated_at ?? null;
  if (snapshot?.markdown.window_start && snapshot?.markdown.window_end) {
    resolved.context.selected_window.window_start = snapshot.markdown.window_start;
    resolved.context.selected_window.window_end = snapshot.markdown.window_end;
  }
  const state = makeState(buildWeeklyStateEntries(snapshot, resolved.context.stale));
  const drilldowns = buildWeeklyDrilldowns(
    snapshot,
    resolved.context.selected_window.window_end,
    resolved.context.selected_window.anchor_date,
  );

  const view: WeeklyViewModel = {
    context: resolved.context,
    banner: makeBanner({
      title: "Weekly",
      contextLabel: `${resolved.context.selected_window.window_start} -> ${resolved.context.selected_window.window_end}`,
      generatedAt: snapshot?.markdown.generated_at ?? null,
      enhancementStatus: snapshot?.markdown.enhancement_status ?? snapshot?.audit_enhancement_status ?? null,
      githubStatus: "artifact-first",
      sourceHealth: snapshot?.audit_status === "ok" ? `rejected_outputs=${snapshot.audit_rejected_outputs}` : "audit-missing",
      notes,
    }),
    state,
    time_navigator: buildWeeklyNavigator(resolved.context.selected_window.anchor_date, resolved.context.stale, snapshot),
    route_frame: {} as RouteFrameModel,
    weekly_snapshot: snapshot,
    overall_judgment: snapshot?.markdown.overall_summary_cn ?? null,
    supporting_project_drilldowns: drilldowns,
  };
  view.route_frame = buildWeeklyRouteFrame(view);
  return view;
}

export function buildRunHealthView(dateOrLatest: string): RunHealthViewModel {
  const resolved = resolveDailyContext(dateOrLatest);
  if (resolved.status === "failed" || !resolved.context.selected_date) {
    const state = makeState([{ status: "failed", reason: resolved.status === "failed" ? resolved.message : "daily 上下文缺失" }]);
    const view: RunHealthViewModel = {
      context: resolved.context,
      banner: makeBanner({ title: "Run Health", contextLabel: "daily", generatedAt: null, notes: state.reasons }),
      state,
      time_navigator: buildDailyNavigator(resolved.context.selected_date, resolved.context.stale, null),
      route_frame: {} as RouteFrameModel,
      run_snapshot: null,
    };
    view.route_frame = buildRunHealthRouteFrame(view);
    return view;
  }

  const { snapshot, auditNotes, githubStatus } = buildRunSnapshot(resolved.context.selected_date);
  resolved.context.generated_at = snapshot?.run_summary?.generated_at ?? snapshot?.daily_report.generated_at ?? null;
  const state = makeState(
    snapshot
      ? [
          snapshot.run_summary ? { status: "ready" as const, reason: null } : { status: "failed" as const, reason: "健康上下文缺失" },
          snapshot.verify_result ? { status: "ready" as const, reason: null } : { status: "failed" as const, reason: "verify 上下文缺失" },
          resolved.context.stale ? { status: "stale" as const, reason: "latest 已解析到非当天结果" } : { status: "ready" as const, reason: null },
        ]
      : [{ status: "failed" as const, reason: "当前日期 daily 结果不存在" }],
  );

  const view: RunHealthViewModel = {
    context: resolved.context,
    banner: makeBanner({
      title: "Run Health",
      contextLabel: resolved.context.selected_date,
      generatedAt: resolved.context.generated_at,
      enhancementStatus: snapshot?.daily_report.enhancement_status ?? null,
      githubStatus,
      sourceHealth: snapshot?.run_summary ? `sources=${snapshot.run_summary.source_status.length}` : "missing",
      notes: auditNotes,
    }),
    state,
    time_navigator: buildDailyNavigator(resolved.context.selected_date, resolved.context.stale, snapshot),
    route_frame: {} as RouteFrameModel,
    run_snapshot: snapshot,
  };
  view.route_frame = buildRunHealthRouteFrame(view);
  return view;
}

export function buildObserverView(dateOrLatest: string, options?: { requestInterestTopics?: UserInterestTopicName[] }): ObserverViewModel {
  const resolved = resolveDailyContext(dateOrLatest);
  if (resolved.status === "failed" || !resolved.context.selected_date) {
    const state = makeState([{ status: "failed", reason: resolved.status === "failed" ? resolved.message : "observer context missing" }]);
    const view: ObserverViewModel = {
      context: resolved.context,
      banner: makeBanner({ title: "Observer", contextLabel: "daily", generatedAt: null, githubStatus: "github-search", notes: state.reasons }),
      state,
      time_navigator: buildDailyNavigator(resolved.context.selected_date, resolved.context.stale, null),
      route_frame: {} as RouteFrameModel,
      artifact: null,
    };
    view.route_frame = buildObserverRouteFrame(view);
    return view;
  }

  const observer = getObserverArtifact(resolved.context.selected_date);
  const artifact = observer.status === "ok" ? observer.value : null;
  const reasons =
    observer.status === "ok"
      ? [
          observer.value.status === "active"
            ? { status: "ready" as const, reason: "observer artifact ready" }
            : observer.value.status === "empty"
              ? { status: "empty" as const, reason: "observer returned no candidates" }
              : observer.value.status === "disabled"
                ? { status: "degraded" as const, reason: "observer disabled" }
                : { status: "failed" as const, reason: "observer failed" },
          resolved.context.stale ? { status: "stale" as const, reason: "latest resolved to a historical daily slice" } : { status: "ready" as const, reason: null },
        ]
      : [{ status: "failed" as const, reason: "observer artifact missing" }];
  const state = makeState(reasons);
  const observerNotes = summarizeObserverNotes(artifact?.notes ?? state.reasons);
  const view: ObserverViewModel = {
    context: resolved.context,
    banner: makeBanner({
      title: "Observer",
      contextLabel: resolved.context.selected_date,
      generatedAt: artifact?.generated_at ?? null,
      enhancementStatus: inferObserverEnhancementStatus(artifact?.llm_diagnostics),
      githubStatus: "github-search",
      sourceHealth: artifact
        ? `ecosystems=${Object.keys(artifact.ecosystem_counts).length}, candidates=${artifact.candidate_count}, incubating=${readObserverIncubatingDirections(artifact).length}, promotions=${readObserverPromotionCandidates(artifact).length}`
        : "missing",
      notes: observerNotes,
    }),
    state,
    time_navigator: buildDailyNavigator(resolved.context.selected_date, resolved.context.stale, null),
    route_frame: {} as RouteFrameModel,
    artifact,
  };
  view.route_frame = buildObserverRouteFrame(view);
  return view;
}

export function buildKnowledgeBaseView(
  selectedSlug?: string,
  selectedProject?: string,
  dailyDateOrLatest = "latest",
): KnowledgeBaseViewModel {
  const resolved = resolveDailyContext(dailyDateOrLatest);
  const index = getKbIndex();
  const stateEntries = [];
  if (resolved.status === "failed") stateEntries.push({ status: "failed" as const, reason: resolved.message });
  if (index.status === "not_found") stateEntries.push({ status: "failed" as const, reason: "KB 未生成 / 不存在" });
  if (index.status === "parse_error") stateEntries.push({ status: "failed" as const, reason: "KB index 解析失败" });
  if (index.status === "ok" && index.value.length === 0) stateEntries.push({ status: "empty" as const, reason: "KB index 为空" });
  if (stateEntries.length === 0) stateEntries.push({ status: "ready" as const, reason: "KB artifact 可直接消费" });

  let targetSlug = selectedSlug ?? "";
  if (!targetSlug && selectedProject && index.status === "ok") {
    const found = index.value.find((card) =>
      [card.project_name, card.repo_url, knowledgeCardSlug(card.project_name)].some(
        (token) => token.toLowerCase() === selectedProject.toLowerCase(),
      ),
    );
    targetSlug = found ? knowledgeCardSlug(found.project_name) : "";
  }

  const selectedCardMarkdown = targetSlug ? getKbCard(targetSlug) : null;
  if (targetSlug && selectedCardMarkdown?.status === "not_found") {
    stateEntries.push({ status: "failed" as const, reason: "KB 未生成 / 不存在" });
  }
  const state = makeState(stateEntries);
  const selectedCard =
    targetSlug && index.status === "ok"
      ? (index.value.find((card) => knowledgeCardSlug(card.project_name) === targetSlug) ?? null)
      : null;

  const view: KnowledgeBaseViewModel = {
    context: resolved.context,
    banner: makeBanner({
      title: "Knowledge Base",
      contextLabel: selectedCard?.project_name ?? "KB Index",
      generatedAt: selectedCard?.updated_at ?? null,
      enhancementStatus: null,
      githubStatus: "n/a",
      sourceHealth: index.status,
      notes: state.reasons,
    }),
    state,
    time_navigator: buildDailyNavigator(resolved.context.selected_date, resolved.context.stale, null),
    route_frame: {} as RouteFrameModel,
    index: index.status === "ok" ? index.value : null,
    selected_card:
      selectedCard && selectedCardMarkdown?.status === "ok"
        ? {
            ...selectedCard,
            sections: parseKnowledgeCardMarkdown(selectedCardMarkdown.value),
        }
        : null,
  };
  view.route_frame = buildKnowledgeBaseRouteFrame(view);
  return view;
}
