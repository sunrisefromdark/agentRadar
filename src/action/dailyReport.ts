import type { AppConfig } from "../config.ts";
import type {
  DailyFreshnessSource,
  DailyMainBoardMode,
  DailyOverallStatus,
  DailyProjectClass,
  DailyReport,
  DailyReportProjectDetail,
  DailySemanticInputBundle,
  DailySemanticInputProject,
  EnhancementAudit,
  EnhancementSource,
  EnhancementStatus,
  LlmRunDiagnostics,
  RawSignal,
  RejectedOutput,
  ScoredProject,
  UserInterestTopicName,
} from "../types.ts";
import { callStructuredEnhancement, isEnhancementEnabled } from "./enhancementLlm.ts";
import { warmMissingProjectDescriptions } from "./descriptionBackfill.ts";
import { buildProjectBriefFromScoredProject, validateProjectBriefSpecificity } from "./projectBriefs.ts";
import { buildRiskReviewNote, riskReviewRequired } from "./riskReview.ts";

const FRESHNESS_SOURCE_DISPLAY_NAMES: Record<string, string> = {
  "agents-radar": "agents-radar 历史上下文",
  trendshift_live: "Trendshift 当日命中",
  github_trending: "GitHub Trending",
  github_live_star_delta: "GitHub 当日涨星信号",
  watchlist_live_activity: "重点观察清单动态",
};

const INFORMATION_SOURCE_EXPLANATIONS: Array<{ source: string; explanation: string }> = [
  { source: "GitHub 当日涨星信号", explanation: "表示本次运行里直接观测到的 GitHub 星标增长，用来捕捉突然升温的仓库。" },
  { source: "GitHub Trending", explanation: "表示 GitHub 当天趋势页里的高热度项目，用来发现短时间内集中关注的仓库。" },
  { source: "重点观察清单动态", explanation: "表示我们持续关注的组织仓库当天发生了更新，用来补背景和持续性。" },
  { source: "Trendshift 当日命中", explanation: "表示 Trendshift 本次运行里命中的实时趋势信号，用来发现当日话题热度。" },
  { source: "agents-radar 历史上下文", explanation: "表示近期曾出现在上游摘要里的项目，只用于补充背景，不单独证明它今天是新鲜项目。" },
];

function formatScore(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function distinct<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  const normalizedChunkSize = Math.max(1, chunkSize);
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += normalizedChunkSize) {
    chunks.push(items.slice(index, index + normalizedChunkSize));
  }
  return chunks;
}

function displayFreshnessSourceName(source: string): string {
  return FRESHNESS_SOURCE_DISPLAY_NAMES[source] ?? source;
}

function signalDate(signal: RawSignal): string {
  return signal.timestamp.slice(0, 10);
}

const KNOWN_FRESHNESS_DRIVING_SOURCE_NAMES = new Set([
  "trendshift_live",
  "github_trending",
  "github_live_star_delta",
  "watchlist_live_activity",
]);

function isKnownFreshnessDrivingSourceName(sourceName: string): boolean {
  return KNOWN_FRESHNESS_DRIVING_SOURCE_NAMES.has(sourceName);
}

function freshnessSourceToRawSignalSources(source: DailyFreshnessSource): string[] {
  if (source.source === "trendshift_live") return ["trendshift"];
  return [source.source];
}

function rawSignalSourceToDisplayName(source: string): string {
  if (source === "trendshift") return displayFreshnessSourceName("trendshift_live");
  return displayFreshnessSourceName(source);
}

function isFreshnessDrivingSource(source: DailyFreshnessSource): boolean {
  if (source.source_role) {
    return source.source_role === "freshness-driving" && isKnownFreshnessDrivingSourceName(source.source);
  }
  return source.source !== "agents-radar" && isKnownFreshnessDrivingSourceName(source.source) && source.freshness_state === "fresh_today";
}

function freshnessDrivingSources(freshnessSources: DailyFreshnessSource[]): DailyFreshnessSource[] {
  return freshnessSources.filter((source) => {
    if (source.source_role) {
      return source.source_role === "freshness-driving" && isKnownFreshnessDrivingSourceName(source.source);
    }
    return source.source !== "agents-radar" && isKnownFreshnessDrivingSourceName(source.source);
  });
}

function evidenceSummary(score: ScoredProject["score"]): string {
  const evidence = [...score.components]
    .sort((a, b) => b.weighted_score - a.weighted_score)
    .slice(0, 2)
    .map((component) => {
      const primaryEvidence = component.evidence[0] ?? "no explicit evidence";
      return `${component.name}=${component.score}(${primaryEvidence})`;
    });
  return evidence.length > 0 ? evidence.join("; ") : "无显式结构化证据";
}

function projectWhyToday(
  project: ScoredProject,
  category: DailyProjectClass,
  freshTodaySourceCount: number,
  freshTodaySources: string[],
): string {
  const starDelta = project.project.star_delta_daily ?? 0;
  const deltaText = starDelta > 0 ? `当日 star 增长约 ${starDelta}` : "当日没有明显 star 增长";
  const sourceText = freshTodaySourceCount > 0 ? `命中 ${freshTodaySources.join("、")} 的实时新鲜信号` : "未命中本次实时新鲜来源";

  if (category === "today_star") {
    return `它${sourceText}，并且已经通过多源或多天确认，所以今天仍然值得优先关注；${deltaText}。`;
  }
  if (category === "pending_confirmation") {
    return `它${sourceText}，说明热度已经冒头，但当前还需要继续做二次确认；${deltaText}。`;
  }
  return `它${sourceText}，因此这次更适合作为历史补充观察来理解背景；${deltaText}。`;
}

function matchTopics(project: ScoredProject, config: AppConfig): UserInterestTopicName[] {
  const userInterestProfile = config.sources.userInterestProfile;
  if (!userInterestProfile?.enabled) return [] as UserInterestTopicName[];

  const searchable = [
    ...project.project.tags,
    project.project.description,
    project.project.project_name,
    project.score.paradigm,
  ]
    .filter(Boolean)
    .map((value) => value!.toLowerCase())
    .join(" ");

  const topics: UserInterestTopicName[] = [];
  for (const topic of userInterestProfile.topics) {
    const token = topic.name.toLowerCase();
    const variant = token.replace(/-/g, " ");
    const matched =
      searchable.includes(token) ||
      searchable.includes(variant) ||
      (token === "agent-runtime" && searchable.includes("agent") && searchable.includes("runtime")) ||
      (token === "coding-agent" && searchable.includes("coding") && searchable.includes("agent")) ||
      (token === "infra" && searchable.includes("infrastructure"));

    if (matched) topics.push(topic.name);
  }

  return distinct(topics);
}

function preferenceBoost(topics: UserInterestTopicName[], config: AppConfig): number {
  const userInterestProfile = config.sources.userInterestProfile;
  if (!userInterestProfile?.enabled || userInterestProfile.topics.length === 0) return 0;

  const boosts = userInterestProfile.topics
    .filter((topic) => topics.includes(topic.name))
    .map((topic) => topic.weight * 10);
  return Number(boosts.reduce((sum, value) => sum + value, 0).toFixed(2));
}

function classifyProject(
  project: ScoredProject,
  reportDate: string,
  freshRawSourceNames: Set<string>,
): {
  category: DailyProjectClass;
  freshTodaySourceCount: number;
  hasFreshTodaySignal: boolean;
} {
  const freshSignals = project.project.raw_signals.filter(
    (signal) => signalDate(signal) === reportDate && freshRawSourceNames.has(signal.source),
  );
  const freshTodaySourceCount = distinct(freshSignals.map((signal) => signal.source)).length;
  const hasFreshTodaySignal = freshSignals.length > 0;

  if (hasFreshTodaySignal) {
    const confirmedCrossSource = freshTodaySourceCount >= 2;
    const confirmedCrossDay = project.project.appearances >= 2;
    if (confirmedCrossSource || confirmedCrossDay) {
      return { category: "today_star", freshTodaySourceCount, hasFreshTodaySignal };
    }
    return { category: "pending_confirmation", freshTodaySourceCount, hasFreshTodaySignal };
  }

  return { category: "context_only", freshTodaySourceCount, hasFreshTodaySignal };
}

function mainBoardMode(todayStarProjects: Array<{ final_rank: number }>, freshnessSources: DailyFreshnessSource[]): DailyMainBoardMode {
  if (todayStarProjects.length === 0) return "no_fresh_main_board";
  const freshTodaySources = freshnessDrivingSources(freshnessSources).filter((item) => item.freshness_state === "fresh_today").length;
  if (freshTodaySources >= 2) return "fresh_today_only";
  return "partial_fresh";
}

function overallDailyStatus(
  mainBoard: DailyMainBoardMode,
  contextCount: number,
  pendingCount: number,
  freshnessSources: DailyFreshnessSource[],
): DailyOverallStatus {
  void contextCount;
  void pendingCount;
  const drivingSources = freshnessDrivingSources(freshnessSources);
  const freshTodaySources = drivingSources.filter((item) => item.freshness_state === "fresh_today").length;
  const hasFallback = drivingSources.some(
    (item) =>
      item.freshness_state === "fallback_recent" ||
      item.freshness_state === "fallback_stale" ||
      item.freshness_state === "unavailable",
  );

  if (mainBoard === "fresh_today_only" && freshTodaySources >= 2 && !hasFallback) {
    return "数据新鲜，可直接阅读";
  }

  if (freshTodaySources > 0 || hasFallback) {
    return "数据部分回退，谨慎参考";
  }

  return "数据显著过期，不建议直接用于判断";
}

interface ProjectView {
  project: ScoredProject;
  project_class: DailyProjectClass;
  fresh_today_source_count: number;
  has_fresh_today_signal: boolean;
  fresh_today_sources: string[];
  objective_score: number;
  preference_boost: number;
  base_final_rank: number;
  final_rank: number;
  matched_interest_topics: UserInterestTopicName[];
  project_brief_cn: string;
  why_today_cn: string;
  enhancement_source: EnhancementSource;
  summary_source: EnhancementSource;
  position_qualification: DailyReportProjectDetail["position_qualification"];
  position_rationale_cn?: string;
  judge_score_delta: number;
  judge_source: EnhancementSource;
  personalization_reason_cn?: string;
  risk_review_required?: boolean;
  risk_review_note_cn?: string;
  risk_review_source?: EnhancementSource;
  watchlist_note_cn?: string;
}

function defaultPositionQualification(projectClass: DailyProjectClass): DailyReportProjectDetail["position_qualification"] {
  return projectClass === "today_star" ? "strong-watch" : "keep-observing";
}

function decorateProject(
  project: ScoredProject,
  config: AppConfig,
  reportDate: string,
  freshRawSourceNames: Set<string>,
): ProjectView {
  const classification = classifyProject(project, reportDate, freshRawSourceNames);
  const matchedInterestTopics = matchTopics(project, config);
  const boost = preferenceBoost(matchedInterestTopics, config);
  const objectiveScore = project.score.total_score;
  const baseFinalRank = Number((objectiveScore + boost).toFixed(2));
  const projectFreshTodaySources = distinct(
    project.project.raw_signals
      .filter((signal) => signalDate(signal) === reportDate && freshRawSourceNames.has(signal.source))
      .map((signal) => rawSignalSourceToDisplayName(signal.source)),
  );

  const needsRiskReview = riskReviewRequired(project);
  const personalized = matchedInterestTopics.length > 0 && Boolean(config.sources.userInterestProfile?.enabled);

  return {
    project,
    project_class: classification.category,
    fresh_today_source_count: classification.freshTodaySourceCount,
    has_fresh_today_signal: classification.hasFreshTodaySignal,
    fresh_today_sources: projectFreshTodaySources,
    objective_score: objectiveScore,
    preference_boost: boost,
    base_final_rank: baseFinalRank,
    final_rank: baseFinalRank,
    matched_interest_topics: matchedInterestTopics,
    project_brief_cn: buildProjectBriefFromScoredProject(project, matchedInterestTopics),
    why_today_cn: projectWhyToday(project, classification.category, classification.freshTodaySourceCount, projectFreshTodaySources),
    enhancement_source: "template_fallback",
    summary_source: "template_fallback",
    position_qualification: defaultPositionQualification(classification.category),
    judge_score_delta: 0,
    judge_source: "template_fallback",
    personalization_reason_cn: personalized ? `命中 ${matchedInterestTopics.join("、")}，所以更贴近你当前关注的方向。` : undefined,
    risk_review_required: needsRiskReview,
    risk_review_note_cn: needsRiskReview ? buildRiskReviewNote(project) : undefined,
    risk_review_source: needsRiskReview ? "template_fallback" : undefined,
    watchlist_note_cn: project.project.tags.includes("watchlist-hit") ? "你跟踪的对象有更新。" : undefined,
  };
}

function toDailyReportProject(view: ProjectView): ScoredProject & DailyReportProjectDetail {
  return {
    ...view.project,
    objective_score: view.objective_score,
    preference_boost: view.preference_boost,
    base_final_rank: view.base_final_rank,
    final_rank: view.final_rank,
    matched_interest_topics: view.matched_interest_topics,
    project_brief_cn: view.project_brief_cn,
    why_today_cn: view.why_today_cn,
    enhancement_source: view.enhancement_source,
    summary_source: view.summary_source,
    position_qualification: view.position_qualification,
    position_rationale_cn: view.position_rationale_cn,
    judge_score_delta: view.judge_score_delta,
    judge_source: view.judge_source,
    personalization_reason_cn: view.personalization_reason_cn,
    risk_review_required: view.risk_review_required,
    risk_review_note_cn: view.risk_review_note_cn,
    risk_review_source: view.risk_review_source,
    watchlist_note_cn: view.watchlist_note_cn,
    project_class: view.project_class,
  };
}

function sourceLine(source: DailyFreshnessSource): string {
  const date = source.effective_date ?? "unknown";
  const role = source.source_role ? ` [${source.source_role}]` : "";
  const status = source.status_summary_cn ?? "暂无可读状态";
  const diagnostic = source.diagnostic_ref ? ` | 诊断: ${source.diagnostic_ref}` : "";
  return `- ${displayFreshnessSourceName(source.source)}${role}: ${source.freshness_state} | effective_date=${date} | realtime=${source.from_realtime_run ? "true" : "false"} | ${status}${diagnostic}`;
}

function renderInformationSources(): string[] {
  return [
    "## 信息来源",
    "",
    ...INFORMATION_SOURCE_EXPLANATIONS.map((item) => `- ${item.source}: ${item.explanation}`),
    "",
  ];
}

function projectCard(project: ScoredProject & DailyReportProjectDetail): string[] {
  return [
    `- [${project.project.project_name}](${project.project.repo_url})`,
    `  - 项目简介: ${project.project_brief_cn}`,
    `  - 入选原因: ${project.why_today_cn}`,
    `  - enhancement_source: ${project.enhancement_source}`,
    `  - summary_source: ${project.summary_source ?? "template_fallback"} | qualification=${project.position_qualification ?? "keep-observing"} | judge_delta=${project.judge_score_delta ?? 0} | judge_source=${project.judge_source ?? "template_fallback"}`,
    ...(project.position_rationale_cn ? [`  - position_rationale_cn: ${project.position_rationale_cn}`] : []),
    ...(project.personalization_reason_cn ? [`  - personalization_reason_cn: ${project.personalization_reason_cn}`] : []),
    ...(project.risk_review_required ? [`  - risk_review_required: true`] : []),
    ...(project.risk_review_note_cn ? [`  - risk_review_note_cn: ${project.risk_review_note_cn}`] : []),
    ...(project.risk_review_source ? [`  - risk_review_source: ${project.risk_review_source}`] : []),
    ...(project.watchlist_note_cn ? [`  - watchlist_note_cn: ${project.watchlist_note_cn}`] : []),
    `  - 选择依据: objective_score=${formatScore(project.objective_score)} | base_final_rank=${formatScore(project.base_final_rank)} | final_rank=${formatScore(project.final_rank)} | 关键证据: ${evidenceSummary(project.score)} | anti_noise=${project.score.anti_noise_flags.length > 0 ? project.score.anti_noise_flags.join(", ") : "none"}`,
    `  - objective_score: ${formatScore(project.objective_score)} | preference_boost: ${formatScore(project.preference_boost)} | base_final_rank: ${formatScore(project.base_final_rank)} | final_rank: ${formatScore(project.final_rank)}`,
    `  - 置信度: ${project.score.confidence}`,
    `  - matched_interest_topics: ${project.matched_interest_topics.length > 0 ? project.matched_interest_topics.join(", ") : "none"}`,
    `  - paradigm: ${project.score.paradigm} | persistence: ${project.project.persistence_state} (${project.project.appearances} appearances across ${project.project.sources.length} sources)`,
    `  - Trust ${project.score.data_trust}/${formatScore(project.score.trust_score)}`,
    `  - 来源: ${project.project.sources.map((source) => rawSignalSourceToDisplayName(source)).join(", ")} | stars=${project.project.stars} | star_delta_daily=${project.project.star_delta_daily ?? "unavailable"} | pending_confirmation=${project.project_class === "pending_confirmation" ? "yes" : "no"}`,
    `  - anti_noise_flags: ${project.score.anti_noise_flags.length > 0 ? project.score.anti_noise_flags.join(", ") : "none"}`,
  ];
}

function renderPersonalizedSectionPreview(report: DailyReport): string[] {
  if (!report.personalized_relevance_applicable) return [];

  const personalized = [...report.today_star_projects, ...report.context_only_projects]
    .filter((project) => project.matched_interest_topics.length > 0)
    .sort((a, b) => {
      if (a.matched_interest_topics.length !== b.matched_interest_topics.length) {
        return b.matched_interest_topics.length - a.matched_interest_topics.length;
      }
      if (a.preference_boost !== b.preference_boost) return b.preference_boost - a.preference_boost;
      return b.final_rank - a.final_rank;
    })
    .slice(0, 3);

  return [
    "## 更适合你关注的摘要",
    "",
    ...(personalized.length > 0
      ? personalized.flatMap((project) => [
          `- [${project.project.project_name}](${project.project.repo_url})`,
          `  - 命中主题: ${project.matched_interest_topics.join("、")}`,
          `  - 关注理由: ${project.personalization_reason_cn ?? "暂无可读个性化说明"}`,
          `  - 偏好增益: ${formatScore(project.preference_boost)} | final_rank=${formatScore(project.final_rank)}`,
          "",
        ])
      : ["- 本次没有更贴近你当前关注方向的项目", ""]),
  ];
}

function compatibilitySummary(report: DailyReport): string[] {
  return [
    "## MVP 摘要",
    "",
    report.today_fresh_candidate_count === 0 ? "- 当前没有新项目达到信号阈值" : `- 当前有 ${report.today_fresh_candidate_count} 个新项目达到信号阈值`,
    report.high_score_projects.length === 0 ? "- 当前没有项目达到高分阈值" : `- 当前有 ${report.high_score_projects.length} 个项目达到高分阈值`,
    report.anomaly_projects.length === 0 ? "- 今天没有异常增长项目" : `- 今天有 ${report.anomaly_projects.length} 个异常增长项目`,
    "",
    "## 降噪关注项",
    "",
    ...(report.all_projects.some((item) => item.score.anti_noise_flags.length > 0)
      ? report.all_projects.filter((item) => item.score.anti_noise_flags.length > 0).map((item) => `- ${item.project.project_name}: ${item.score.anti_noise_flags.join(", ")}`)
      : ["- 当前样本中没有明显的降噪告警"]),
    "",
  ];
}

function renderProjectSection(
  title: string,
  projects: Array<ScoredProject & DailyReportProjectDetail>,
  emptyText: string,
  opts?: { limit?: number; compressedLabel?: string },
): string[] {
  if (projects.length === 0) return [title, "", `- ${emptyText}`, ""];
  const limit = opts?.limit ?? projects.length;
  const visibleProjects = projects.slice(0, limit);
  const hiddenCount = Math.max(0, projects.length - visibleProjects.length);
  const compressedLabel = opts?.compressedLabel ?? "其余项目已折叠";
  return [
    title,
    "",
    ...visibleProjects.flatMap((project) => [...projectCard(project), ""]),
    ...(hiddenCount > 0 ? [`- ${compressedLabel}: 其余 ${hiddenCount} 个项目已压缩显示`, ""] : []),
    "",
  ];
}

export function buildDailyReport(
  scored: ScoredProject[],
  config: AppConfig,
  opts: {
    date: string;
    generatedAt: string;
    freshnessSources?: DailyFreshnessSource[];
    rawSignals?: RawSignal[];
  },
): DailyReport {
  const freshnessSources = opts.freshnessSources ?? [];
  const freshRawSourceNames = new Set(
    freshnessSources
      .filter((source) => source.freshness_state === "fresh_today" && isFreshnessDrivingSource(source))
      .flatMap((source) => freshnessSourceToRawSignalSources(source)),
  );
  const decorated = scored.map((project) => decorateProject(project, config, opts.date, freshRawSourceNames));
  const todayStarProjects = decorated
    .filter((project) => project.project_class === "today_star")
    .sort((a, b) => b.final_rank - a.final_rank)
    .map(toDailyReportProject);
  const contextOnlyProjects = decorated
    .filter((project) => project.project_class === "context_only")
    .sort((a, b) => b.final_rank - a.final_rank)
    .map(toDailyReportProject);
  const pendingConfirmationCount = decorated.filter((project) => project.project_class === "pending_confirmation").length;
  const todayFreshCandidateCount = decorated.filter((project) => project.has_fresh_today_signal).length;
  const contextCandidateCount = contextOnlyProjects.length;
  const mainBoard = mainBoardMode(todayStarProjects, freshnessSources);
  const overallStatus = overallDailyStatus(mainBoard, contextCandidateCount, pendingConfirmationCount, freshnessSources);

  const newProjects = scored.filter((item) => item.project.appearances <= item.project.raw_signals.length);
  const highScoreProjects = scored.filter((item) => item.score.total_score >= config.thresholds.highScore);
  const anomalyProjects = scored.filter((item) => (item.project.star_delta_daily ?? 0) >= config.thresholds.anomalyStarDeltaDaily);

  return {
    date: opts.date,
    generated_at: opts.generatedAt,
    enhancement_status: "rules-only",
    enhancement_audit: { rejected_outputs: [] },
    personalized_relevance_applicable: Boolean(config.sources.userInterestProfile?.enabled),
    overall_daily_status: overallStatus,
    freshness_sources: freshnessSources,
    today_fresh_candidate_count: todayFreshCandidateCount,
    context_candidate_count: contextCandidateCount,
    pending_confirmation_count: pendingConfirmationCount,
    main_board_mode: mainBoard,
    today_star_projects: todayStarProjects,
    context_only_projects: contextOnlyProjects,
    new_projects: newProjects,
    high_score_projects: highScoreProjects,
    anomaly_projects: anomalyProjects,
    all_projects: scored,
  };
}

interface DailyEnhancementProjectDraft {
  repo_full_name: string;
  project_brief_cn?: string;
  why_today_cn?: string;
  personalization_reason_cn?: string;
  risk_review_note_cn?: string;
  watchlist_note_cn?: string;
}

interface DailyEnhancementDraft {
  projects: DailyEnhancementProjectDraft[];
}

interface DailyPositionJudgeAdjustment {
  repo_full_name: string;
  position_qualification: NonNullable<DailyReportProjectDetail["position_qualification"]>;
  score_delta: number;
  rationale_cn: string;
}

interface DailyPositionJudgeDraft {
  adjustments: DailyPositionJudgeAdjustment[];
}

interface DailyEnhancementApplyResult {
  applicableCount: number;
  agentCount: number;
  rejectedOutputs: RejectedOutput[];
}

function emptyEnhancementDiagnostics(config: AppConfig): LlmRunDiagnostics {
  return {
    enabled: isEnhancementEnabled(config),
    mode: config.llm.mode,
    provider: config.llm.provider,
    classification_attempt_count: 0,
    classification_success_count: 0,
    classification_failure_count: 0,
    summary_attempt_count: 0,
    summary_success_count: 0,
    summary_failure_count: 0,
    judge_attempt_count: 0,
    judge_success_count: 0,
    judge_failure_count: 0,
  };
}

function buildDailySemanticInputProject(
  project: ScoredProject & DailyReportProjectDetail,
  reportDate: string,
  freshRawSourceNames: Set<string>,
): DailySemanticInputProject {
  const freshnessHitSources = distinct(
    project.project.raw_signals
      .filter((signal) => signalDate(signal) === reportDate && freshRawSourceNames.has(signal.source))
      .map((signal) => rawSignalSourceToDisplayName(signal.source)),
  );

  return {
    repo_url: project.project.repo_url,
    project_name: project.project.project_name,
    repo_full_name: project.project.repo_full_name,
    project_class: project.project_class,
    objective_score: project.objective_score,
    preference_boost: project.preference_boost,
    base_final_rank: project.base_final_rank,
    final_rank: project.final_rank,
    matched_interest_topics: [...project.matched_interest_topics],
    project_brief_cn: project.project_brief_cn,
    why_today_cn: project.why_today_cn,
    project: {
      data_trust: project.score.data_trust,
      appearances: project.project.appearances,
      star_delta_daily: project.project.star_delta_daily,
      trust_flags: [...project.project.trust_flags],
      tags: [...project.project.tags],
      description: project.project.description,
      raw_signals: [...project.project.raw_signals],
    },
    freshness_hit_sources: freshnessHitSources,
    score: {
      verdict: project.score.verdict,
      confidence: project.score.confidence,
      paradigm: project.score.paradigm,
      components: [...project.score.components],
      anti_noise_flags: [...project.score.anti_noise_flags],
      risks: [...project.score.risks],
    },
  };
}

function buildDailySemanticInputBundle(report: DailyReport, scored: ScoredProject[], config: AppConfig): DailySemanticInputBundle {
  const visibleProjects = [...report.today_star_projects, ...report.context_only_projects];
  const visibleByRepo = new Map(visibleProjects.map((project) => [project.project.repo_full_name.toLowerCase(), project] as const));
  const freshRawSourceNames = new Set(
    report.freshness_sources
      .filter((source) => source.freshness_state === "fresh_today" && isFreshnessDrivingSource(source))
      .flatMap((source) => freshnessSourceToRawSignalSources(source)),
  );

  return {
    report_date: report.date,
    overall_daily_status: report.overall_daily_status,
    freshness_sources: [...report.freshness_sources],
    objective_projects: scored
      .map((project) => visibleByRepo.get(project.project.repo_full_name.toLowerCase()))
      .filter((project): project is ScoredProject & DailyReportProjectDetail => Boolean(project))
      .map((project) => buildDailySemanticInputProject(project, report.date, freshRawSourceNames)),
    user_interest_profile:
      config.sources.userInterestProfile ?? {
        enabled: false,
        topics: [],
      },
    agent_mode: report.enhancement_status,
  };
}

function takePromptItems<T>(items: T[] | undefined, maxItems: number): T[] {
  return Array.isArray(items) ? items.slice(0, maxItems) : [];
}

function compactDailyBundle(bundle: DailySemanticInputBundle) {
  return {
    date: bundle.report_date,
    status: bundle.overall_daily_status,
    fresh: takePromptItems(bundle.freshness_sources, 4).map((source) => ({
      s: source.source,
      d: source.effective_date,
      st: source.freshness_state,
      r: source.source_role,
    })),
    projs: bundle.objective_projects.map((project) => ({
      repo: project.repo_full_name,
      cls: project.project_class,
      obj: project.objective_score,
      boost: project.preference_boost,
      base: project.base_final_rank,
      rank: project.final_rank,
      topics: takePromptItems(project.matched_interest_topics, 4),
      brief: project.project_brief_cn,
      why: project.why_today_cn,
      meta: {
        trust: project.project.data_trust,
        app: project.project.appearances,
        dd: project.project.star_delta_daily ?? null,
        flags: takePromptItems(project.project.trust_flags, 3),
        tags: takePromptItems(project.project.tags, 4),
        desc: project.project.description,
      },
      hits: takePromptItems(project.freshness_hit_sources, 4),
      score: {
        v: project.score.verdict,
        c: project.score.confidence,
        p: project.score.paradigm,
        comps: takePromptItems(project.score.components, 3).map((component) => ({
          n: component.name,
          s: component.score,
          w: component.weighted_score,
          e: takePromptItems(component.evidence, 1),
        })),
        flags: takePromptItems(project.score.anti_noise_flags, 3),
        risks: takePromptItems(project.score.risks, 2),
      },
    })),
    profile: bundle.user_interest_profile.enabled
      ? {
          en: true,
          topics: takePromptItems(bundle.user_interest_profile.topics, 6).map((topic) => ({
            n: topic.name,
            w: topic.weight,
          })),
        }
      : { en: false, topics: [] },
    mode: bundle.agent_mode,
  };
}

function buildDailyEnhancementPrompt(bundle: DailySemanticInputBundle): string {
  return [
    "You are writing the human-language enhancement layer for agent-radar daily reports.",
    "Return JSON only. Do not use markdown fences.",
    "Use only fields present in the input bundle.",
    "Do not invent new facts or refer to extra sources.",
    "Write project_brief_cn with project evidence first: consume description, tags, repo name semantics, and classification evidence before falling back to broad paradigm language.",
    "Each project_brief_cn must explain what the project actually does for a normal user, and mention 1-2 concrete capabilities when the input supports them.",
    'Prefer concrete product words such as "代码编辑器", "IDE", "工作台", "搜索工具", "终端助手", "工作流框架" over abstract jargon like "基础设施层" or "运行时能力" when both are supported by the input.',
    'When the evidence is sufficient, write project_brief_cn in a plain structure close to "这是什么 + 它主要帮人做什么 + 大家通常拿它来干什么".',
    'Do not say "当前项目信息不足" or "缺少明确的功能描述" unless description, tags, repo name semantics, and classification evidence all still fail to reveal the project function.',
    "Avoid homogeneous family-only copy such as '这是一个 AI 代理调度后台'. Different projects in the same response should not reuse the same brief.",
    "Each project_brief_cn should be an easy-to-read Chinese paragraph around 50-80 characters, ideally using plain language plus 1-2 concrete use cases.",
    "Each why_today_cn should be an easy-to-read Chinese paragraph around 50-80 characters, ideally using plain language to explain why it is worth reading today.",
    "Input is compacted for token efficiency. projs are the visible projects only; raw_signals are intentionally removed.",
    "",
    "Input legend: fresh=freshness sources, projs=projects, profile=user interest profile.",
    "Project keys: repo repo_full_name, cls class, obj objective_score, boost preference_boost, base base_final_rank, rank current final_rank, topics matched topics, brief existing project brief, why existing why-now text, meta {trust/app/dd/flags/tags/desc}, hits freshness hit sources, score {v/c/p/comps/flags/risks}.",
    'Output JSON keys: "projects"[] with {repo_full_name, project_brief_cn?, why_today_cn?, personalization_reason_cn?, risk_review_note_cn?, watchlist_note_cn?}.',
    "",
    JSON.stringify(compactDailyBundle(bundle)),
  ].join("\n");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeValidationText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function compactTextLength(value: string): number {
  return value.replace(/\s+/g, "").length;
}

function includesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function normalizeBriefForComparison(value: string): string {
  return normalizeValidationText(value).replace(/[，。、“”"'；：:,.!?！？()（）\-\s]/g, "");
}

function rejectOutput(
  rejectedOutputs: RejectedOutput[],
  layer: string,
  targetKey: string,
  reasonCode: string,
  reasonDetail: string,
): void {
  rejectedOutputs.push({
    layer,
    target_key: targetKey,
    reason_code: reasonCode,
    reason_detail: reasonDetail,
  });
}

function projectBriefValidationInput(project: ScoredProject & DailyReportProjectDetail) {
  const sourceDescriptions = distinct(
    project.project.raw_signals
      .map((signal) => signal.description?.trim() ?? "")
      .filter((description) => description.length > 0),
  );
  const sourceTags = distinct(
    project.project.raw_signals.flatMap((signal) => (signal.tags ?? []).map((tag) => tag.trim())).filter((tag) => tag.length > 0),
  );

  return {
    project_name: project.project.project_name,
    repo_full_name: project.project.repo_full_name,
    description: project.project.description,
    tags: project.project.tags,
    paradigm: project.score.paradigm,
    evidence: project.score.components.flatMap((component) => component.evidence),
    source_descriptions: sourceDescriptions,
    source_tags: sourceTags,
  };
}

function validateProjectBriefText(project: ScoredProject & DailyReportProjectDetail, value: string): string | undefined {
  const normalized = normalizeValidationText(value);
  if (!normalized) return "missing_field";
  const compactLength = compactTextLength(value);
  if (compactLength < 30 || compactLength > 90) return "invalid_length";
  if (/https?:\/\//i.test(value) || /\[[^\]]+\]\([^)]+\)/.test(value) || /[|]{2,}/.test(value)) {
    return "invalid_source_scope";
  }
  if (includesAny(normalized, ["今天", "本周", "涨星", "风险", "watchlist", "观察清单"])) {
    return "invalid_source_scope";
  }
  if (includesAny(normalized, ["值得关注", "值得继续观察", "值得继续跟踪", "值得优先关注", "值得看"])) {
    return "invalid_source_scope";
  }
  const specificityReason = validateProjectBriefSpecificity(projectBriefValidationInput(project), value);
  if (specificityReason) return specificityReason;
  return undefined;
}

function validateWhyTodayText(project: DailySemanticInputProject, value: string): string | undefined {
  const normalized = normalizeValidationText(value);
  if (!normalized) return "missing_field";
  const compactLength = compactTextLength(value);
  if (compactLength < 30 || compactLength > 90) return "invalid_length";

  const sourceNames = project.freshness_hit_sources.map((source) => source.toLowerCase());
  const mentionsGithub = normalized.includes("github");
  const mentionsTrendshift = normalized.includes("trendshift");
  const mentionsWatchlist = normalized.includes("watchlist") || normalized.includes("观察清单");

  if (mentionsGithub && !sourceNames.some((source) => source.includes("github"))) return "evidence_conflict";
  if (mentionsTrendshift && !sourceNames.some((source) => source.includes("trendshift"))) return "evidence_conflict";
  if (mentionsWatchlist && !sourceNames.some((source) => source.includes("观察清单") || source.includes("watchlist"))) {
    return "evidence_conflict";
  }
  if (project.project.star_delta_daily === undefined && /\d+/.test(normalized) && normalized.includes("star")) {
    return "evidence_conflict";
  }

  return undefined;
}

function validatePersonalizationText(
  project: ScoredProject & DailyReportProjectDetail,
  value: string,
): string | undefined {
  if (!isNonEmptyString(value)) return "missing_field";
  const normalized = normalizeValidationText(value);
  const matchedTopics = project.matched_interest_topics.map((topic) => topic.toLowerCase());
  if (matchedTopics.length === 0) return "not_applicable";
  if (!matchedTopics.some((topic) => normalized.includes(topic))) return "evidence_conflict";
  return undefined;
}

function validateRiskReviewText(project: ScoredProject & DailyReportProjectDetail, value: string): string | undefined {
  if (!isNonEmptyString(value)) return "missing_field";
  const normalized = normalizeValidationText(value);
  if (!project.risk_review_required) return "not_applicable";
  if (includesAny(normalized, ["没有风险", "可忽略风险", "风险很低", "无需谨慎", "完全可靠"])) {
    return "evidence_conflict";
  }
  if (project.score.risks.length > 0 && includesAny(normalized, ["没有发现", "没有明显问题"])) {
    return "evidence_conflict";
  }
  return undefined;
}

function validateWatchlistText(project: ScoredProject & DailyReportProjectDetail, value: string): string | undefined {
  if (!isNonEmptyString(value)) return "missing_field";
  if (!project.watchlist_note_cn) return "not_applicable";
  const normalized = normalizeValidationText(value);
  if (!includesAny(normalized, ["跟踪", "观察", "watchlist", "更新"])) return "evidence_conflict";
  return undefined;
}

function buildDailyEnhancementDraft(raw: unknown): DailyEnhancementDraft | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const projects = Array.isArray(record.projects)
    ? record.projects
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : undefined))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          repo_full_name: isNonEmptyString(item.repo_full_name) ? item.repo_full_name.trim() : "",
          project_brief_cn: isNonEmptyString(item.project_brief_cn) ? item.project_brief_cn.trim() : undefined,
          why_today_cn: isNonEmptyString(item.why_today_cn) ? item.why_today_cn.trim() : undefined,
          personalization_reason_cn: isNonEmptyString(item.personalization_reason_cn)
            ? item.personalization_reason_cn.trim()
            : undefined,
          risk_review_note_cn: isNonEmptyString(item.risk_review_note_cn) ? item.risk_review_note_cn.trim() : undefined,
          watchlist_note_cn: isNonEmptyString(item.watchlist_note_cn) ? item.watchlist_note_cn.trim() : undefined,
        }))
        .filter((item) => item.repo_full_name.length > 0)
    : [];

  return { projects };
}

function mergeDailyEnhancementDrafts(drafts: DailyEnhancementDraft[]): DailyEnhancementDraft | undefined {
  if (drafts.length === 0) return undefined;

  const mergedByRepo = new Map<string, DailyEnhancementProjectDraft>();
  for (const draft of drafts) {
    for (const project of draft.projects) {
      mergedByRepo.set(project.repo_full_name.toLowerCase(), project);
    }
  }

  return {
    projects: [...mergedByRepo.values()],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePositionQualification(
  value: unknown,
  fallback: NonNullable<DailyReportProjectDetail["position_qualification"]>,
): NonNullable<DailyReportProjectDetail["position_qualification"]> {
  if (value === "top-tier-now" || value === "strong-watch" || value === "keep-observing" || value === "drop") {
    return value;
  }
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, "-") : "";
  if (normalized === "top tier now" || normalized === "top-tier-now") return "top-tier-now";
  if (normalized === "strong watch" || normalized === "strong-watch") return "strong-watch";
  if (normalized === "keep observing" || normalized === "keep-observing") return "keep-observing";
  if (normalized === "drop") return "drop";
  return fallback;
}

function buildDailyPositionJudgePrompt(
  visibleProjects: Array<ScoredProject & DailyReportProjectDetail>,
  judgeTopN: number,
): string {
  const judgeWindow = visibleProjects.slice(0, Math.max(1, Math.min(visibleProjects.length, judgeTopN)));
  return [
    "你是 agent-radar 主链路的榜单裁判。",
    "规则系统已经先给出基础排序，你现在要判断这些项目是否真的配站在当前的位置。",
    "请返回 exactly one JSON object and nothing else.",
    "不要使用 markdown，不要输出解释性前言。",
    "",
    "要求：",
    "- 你不是重写项目介绍，而是判断当前排序是否合理。",
    "- today_star 和 context_only 是两个不同舞台；不要把 context_only 判成主榜，但可以判断它在本舞台里是否应该更靠前或更靠后。",
    "- score_delta 可以为负数或正数，用于微调 base_final_rank。",
    "- 如果一个项目只是品牌光环、完成度不足、证据弱、或 why-now 不成立，可以给 drop 或较大的负向调整。",
    "- 必须为输入里的每一个项目返回一条 adjustment。",
    "- 输入已经压缩，优先根据 rank、brief、why、risks、flags 来做位置微调判断。",
    "",
    "Input legend: repo repo_full_name, surf surface rank, cls project_class, obj objective_score, boost preference boost, base base_final_rank, rank current final_rank, conf confidence, para paradigm, topics matched topics, brief project brief, why why-now, risks risks, flags anti-noise flags.",
    'Output JSON keys: "adjustments"[] with {repo_full_name, position_qualification, score_delta, rationale_cn}.',
    "",
    JSON.stringify(
      judgeWindow.map((project, index) => ({
        repo: project.project.repo_full_name,
        surf: index + 1,
        cls: project.project_class,
        obj: project.objective_score,
        boost: project.preference_boost,
        base: project.base_final_rank,
        rank: project.final_rank,
        conf: project.score.confidence,
        para: project.score.paradigm,
        topics: takePromptItems(project.matched_interest_topics, 4),
        brief: project.project_brief_cn,
        why: project.why_today_cn,
        risks: takePromptItems(project.score.risks, 2),
        flags: takePromptItems(project.score.anti_noise_flags, 3),
      })),
    ),
  ].join("\n");
}

function buildDailyJudgeRetryWindows(initialTopN: number, visibleCount: number): number[] {
  const effectiveTopN = Math.max(1, Math.min(visibleCount, initialTopN));
  const windows = [
    effectiveTopN,
    Math.floor(effectiveTopN * 0.75),
    Math.floor(effectiveTopN * 0.5),
    Math.min(5, effectiveTopN),
    Math.min(3, effectiveTopN),
    1,
  ];
  const deduped: number[] = [];
  for (const windowSize of windows) {
    const normalized = Math.max(1, Math.min(visibleCount, windowSize));
    if (!deduped.includes(normalized)) deduped.push(normalized);
  }
  return deduped;
}

function dailyJudgeMaxTokens(judgeTopN: number): number {
  if (judgeTopN <= 3) return 1400;
  if (judgeTopN <= 6) return 1800;
  return 2400;
}

function buildDailyPositionJudgeDraft(raw: unknown): DailyPositionJudgeDraft | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  const rawItems =
    Array.isArray(record.adjustments) ? record.adjustments : Array.isArray(record.results) ? record.results : Array.isArray(raw) ? raw : [];
  if (!Array.isArray(rawItems)) return undefined;

  const adjustments = rawItems
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : undefined))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      repo_full_name: isNonEmptyString(item.repo_full_name)
        ? item.repo_full_name.trim()
        : isNonEmptyString(item.repo)
          ? item.repo.trim()
          : "",
      position_qualification: normalizePositionQualification(
        item.position_qualification ?? item.qualification ?? item.decision ?? item.rank_fit,
        "keep-observing",
      ),
      score_delta: clamp(
        typeof item.score_delta === "number"
          ? item.score_delta
          : typeof item.delta === "number"
            ? item.delta
            : typeof item.adjustment_score === "number"
              ? item.adjustment_score
              : 0,
        -25,
        25,
      ),
      rationale_cn: isNonEmptyString(item.rationale_cn)
        ? item.rationale_cn.trim()
        : isNonEmptyString(item.rationale)
          ? item.rationale.trim()
          : isNonEmptyString(item.reason_cn)
            ? item.reason_cn.trim()
            : isNonEmptyString(item.reason)
              ? item.reason.trim()
              : "",
    }))
    .filter((item) => item.repo_full_name.length > 0 && item.rationale_cn.length >= 4);

  return adjustments.length > 0 ? { adjustments } : undefined;
}

function applyDailyEnhancement(
  report: DailyReport,
  draft: DailyEnhancementDraft,
  semanticBundle: DailySemanticInputBundle,
): DailyEnhancementApplyResult {
  const draftsByRepo = new Map(draft.projects.map((project) => [project.repo_full_name.toLowerCase(), project] as const));
  const visibleProjects = [...report.today_star_projects, ...report.context_only_projects];
  const semanticByRepo = new Map(semanticBundle.objective_projects.map((project) => [project.repo_full_name.toLowerCase(), project] as const));
  const rejectedOutputs: RejectedOutput[] = [];
  const acceptedProjectBriefs = new Map<string, string>();
  let applicableCount = 0;
  let agentCount = 0;

  for (const project of visibleProjects) {
    const key = project.project.repo_full_name.toLowerCase();
    const draftProject = draftsByRepo.get(key);
    const semanticProject = semanticByRepo.get(key);
    const personalizationApplicable = Boolean(project.personalization_reason_cn);
    const riskApplicable = Boolean(project.risk_review_required);
    const watchlistApplicable = Boolean(project.watchlist_note_cn);
    const projectBriefReason = draftProject?.project_brief_cn
      ? validateProjectBriefText(project, draftProject.project_brief_cn)
      : "missing_field";
    const whyTodayReason =
      draftProject?.why_today_cn && semanticProject ? validateWhyTodayText(semanticProject, draftProject.why_today_cn) : "missing_field";
    const personalizationReason =
      personalizationApplicable && draftProject?.personalization_reason_cn
        ? validatePersonalizationText(project, draftProject.personalization_reason_cn)
        : personalizationApplicable
          ? "missing_field"
          : "not_applicable";
    const riskReason =
      riskApplicable && draftProject?.risk_review_note_cn
        ? validateRiskReviewText(project, draftProject.risk_review_note_cn)
        : riskApplicable
          ? "missing_field"
          : "not_applicable";
    const watchlistReason =
      watchlistApplicable && draftProject?.watchlist_note_cn
        ? validateWatchlistText(project, draftProject.watchlist_note_cn)
        : watchlistApplicable
          ? "missing_field"
          : "not_applicable";
    const duplicateBriefRepo =
      draftProject?.project_brief_cn ? acceptedProjectBriefs.get(normalizeBriefForComparison(draftProject.project_brief_cn)) : undefined;
    const projectBriefAccepted = projectBriefReason === undefined && !duplicateBriefRepo;
    const whyTodayAccepted = whyTodayReason === undefined;
    const personalizationAccepted = personalizationApplicable && personalizationReason === undefined;
    const riskAccepted = riskApplicable && riskReason === undefined;
    const watchlistAccepted = watchlistApplicable && watchlistReason === undefined;

    applicableCount += 2 + (personalizationApplicable ? 1 : 0) + (riskApplicable ? 1 : 0) + (watchlistApplicable ? 1 : 0);
    agentCount +=
      (projectBriefAccepted ? 1 : 0) +
      (whyTodayAccepted ? 1 : 0) +
      (personalizationAccepted ? 1 : 0) +
      (riskAccepted ? 1 : 0) +
      (watchlistAccepted ? 1 : 0);

    if (projectBriefAccepted) {
      project.project_brief_cn = draftProject!.project_brief_cn!.trim();
      acceptedProjectBriefs.set(normalizeBriefForComparison(draftProject!.project_brief_cn!), key);
    }
    if (whyTodayAccepted) project.why_today_cn = draftProject!.why_today_cn!.trim();
    if (personalizationAccepted && draftProject?.personalization_reason_cn) {
      project.personalization_reason_cn = draftProject.personalization_reason_cn.trim();
    }
    if (riskAccepted && draftProject?.risk_review_note_cn) {
      project.risk_review_note_cn = draftProject.risk_review_note_cn.trim();
      project.risk_review_source = "agent";
    }
    if (watchlistAccepted && draftProject?.watchlist_note_cn) {
      project.watchlist_note_cn = draftProject.watchlist_note_cn.trim();
    }

    if (projectBriefAccepted && whyTodayAccepted) {
      project.enhancement_source = "agent";
    }
    if (projectBriefAccepted || whyTodayAccepted) {
      project.summary_source = "agent";
    }

    if (!projectBriefAccepted) {
      rejectOutput(
        rejectedOutputs,
        "project_explanation",
        key,
        duplicateBriefRepo ? "homogeneous_copy" : (projectBriefReason ?? "template_fallback"),
        duplicateBriefRepo
          ? `project_brief_cn fell back to template rules (homogeneous_copy with ${duplicateBriefRepo}).`
          : `project_brief_cn fell back to template rules (${projectBriefReason ?? "template_fallback"}).`,
      );
    }
    if (!whyTodayAccepted) {
      rejectOutput(
        rejectedOutputs,
        "project_explanation",
        key,
        whyTodayReason ?? "template_fallback",
        `why_today_cn fell back to template rules (${whyTodayReason ?? "template_fallback"}).`,
      );
    }
    if (personalizationApplicable && !personalizationAccepted) {
      rejectOutput(
        rejectedOutputs,
        "personalization",
        key,
        personalizationReason ?? "template_fallback",
        `personalization_reason_cn fell back to template rules (${personalizationReason ?? "template_fallback"}).`,
      );
    }
    if (riskApplicable && !riskAccepted) {
      rejectOutput(
        rejectedOutputs,
        "risk_review",
        key,
        riskReason ?? "template_fallback",
        `risk_review_note_cn fell back to template rules (${riskReason ?? "template_fallback"}).`,
      );
    }
    if (watchlistApplicable && !watchlistAccepted) {
      rejectOutput(
        rejectedOutputs,
        "watchlist",
        key,
        watchlistReason ?? "template_fallback",
        `watchlist_note_cn fell back to template rules (${watchlistReason ?? "template_fallback"}).`,
      );
    }
  }
  return { applicableCount, agentCount, rejectedOutputs };
}

function applyDailyPositionJudgments(
  report: DailyReport,
  draft: DailyPositionJudgeDraft,
  judgeTopN: number,
): DailyEnhancementApplyResult {
  const visibleProjects = [...report.today_star_projects, ...report.context_only_projects];
  const judgeWindow = visibleProjects.slice(0, Math.max(1, Math.min(visibleProjects.length, judgeTopN)));
  const adjustmentsByRepo = new Map(draft.adjustments.map((item) => [item.repo_full_name.toLowerCase(), item] as const));
  const rejectedOutputs: RejectedOutput[] = [];
  let applicableCount = judgeWindow.length;
  let agentCount = 0;

  for (const project of judgeWindow) {
    const key = project.project.repo_full_name.toLowerCase();
    const adjustment = adjustmentsByRepo.get(key);
    if (!adjustment) {
      rejectOutput(
        rejectedOutputs,
        "position_judgment",
        key,
        "missing_field",
        "position judgment fell back to base ranking because no adjustment was returned.",
      );
      continue;
    }

    project.position_qualification = adjustment.position_qualification;
    project.position_rationale_cn = adjustment.rationale_cn;
    project.judge_score_delta = adjustment.score_delta;
    project.judge_source = "agent";
    project.final_rank = Number((project.base_final_rank + adjustment.score_delta).toFixed(2));
    agentCount += 1;
  }

  const sortByFinalRank = (a: ScoredProject & DailyReportProjectDetail, b: ScoredProject & DailyReportProjectDetail) =>
    b.final_rank - a.final_rank || b.base_final_rank - a.base_final_rank || b.score.total_score - a.score.total_score;
  report.today_star_projects.sort(sortByFinalRank);
  report.context_only_projects.sort(sortByFinalRank);

  return { applicableCount, agentCount, rejectedOutputs };
}

function enhancementStatusFromCounts(summary: DailyEnhancementApplyResult, judge: DailyEnhancementApplyResult): EnhancementStatus {
  const totalApplicable = summary.applicableCount + judge.applicableCount;
  const totalAgent = summary.agentCount + judge.agentCount;
  if (totalAgent === 0 || totalApplicable === 0) return "rules-only";
  return totalAgent === totalApplicable ? "agent-full" : "agent-partial";
}

async function applyRetriedDailyPositionJudgments(
  report: DailyReport,
  visibleProjects: Array<ScoredProject & DailyReportProjectDetail>,
  config: AppConfig,
  judgeTopN: number,
  diagnostics: LlmRunDiagnostics,
): Promise<DailyEnhancementApplyResult> {
  const retryWindows = buildDailyJudgeRetryWindows(judgeTopN, visibleProjects.length);
  let lastError = "";

  for (const windowSize of retryWindows) {
    diagnostics.judge_attempt_count = (diagnostics.judge_attempt_count ?? 0) + 1;
    const judgeRaw = await callStructuredEnhancement<unknown>(buildDailyPositionJudgePrompt(visibleProjects, windowSize), config, {
      maxTokens: dailyJudgeMaxTokens(windowSize),
    });
    const judgeDraft = judgeRaw ? buildDailyPositionJudgeDraft(judgeRaw) : undefined;
    if (judgeDraft?.adjustments.length) {
      diagnostics.judge_success_count = (diagnostics.judge_success_count ?? 0) + 1;
      diagnostics.judge_last_error = undefined;
      return applyDailyPositionJudgments(report, judgeDraft, windowSize);
    }

    diagnostics.judge_failure_count = (diagnostics.judge_failure_count ?? 0) + 1;
    lastError = `position judge returned no structured adjustments for window=${windowSize}`;
    diagnostics.judge_last_error = lastError;
  }

  return {
    applicableCount: Math.min(visibleProjects.length, judgeTopN),
    agentCount: 0,
    rejectedOutputs: lastError
      ? [
          {
            layer: "position_judgment",
            target_key: visibleProjects[0]?.project.repo_full_name.toLowerCase() ?? "daily-position-judge",
            reason_code: "llm_unavailable",
            reason_detail: lastError,
          },
        ]
      : [],
  };
}

export async function buildEnhancedDailyReport(
  scored: ScoredProject[],
  config: AppConfig,
  opts: {
    date: string;
    generatedAt: string;
    freshnessSources?: DailyFreshnessSource[];
    rawSignals?: RawSignal[];
  },
): Promise<DailyReport> {
  await warmMissingProjectDescriptions(scored);
  const report = buildDailyReport(scored, config, opts);
  if (!isEnhancementEnabled(config)) return report;

  const bundle = buildDailySemanticInputBundle(report, scored, config);
  if (bundle.objective_projects.length === 0) return report;

  const diagnostics = emptyEnhancementDiagnostics(config);
  const batchSize = readPositiveIntEnv("DAILY_ENHANCEMENT_BATCH_SIZE", 6);
  const draftResults = await Promise.all(
    chunkItems(bundle.objective_projects, batchSize).map(async (objectiveProjects) => {
      diagnostics.summary_attempt_count = (diagnostics.summary_attempt_count ?? 0) + 1;
      const batchBundle: DailySemanticInputBundle = {
        ...bundle,
        objective_projects: objectiveProjects,
      };
      const draftRaw = await callStructuredEnhancement<unknown>(buildDailyEnhancementPrompt(batchBundle), config, {
        maxTokens: 4096,
      });
      const parsed = draftRaw ? buildDailyEnhancementDraft(draftRaw) : undefined;
      if (parsed?.projects.length) {
        diagnostics.summary_success_count = (diagnostics.summary_success_count ?? 0) + 1;
      } else {
        diagnostics.summary_failure_count = (diagnostics.summary_failure_count ?? 0) + 1;
        diagnostics.summary_last_error = "daily summary returned no structured projects";
      }
      return parsed;
    }),
  );
  const draft = mergeDailyEnhancementDrafts(
    draftResults.filter((item): item is DailyEnhancementDraft => Boolean(item && item.projects.length > 0)),
  );
  const summaryApplied = draft && draft.projects.length > 0
    ? applyDailyEnhancement(report, draft, bundle)
    : { applicableCount: bundle.objective_projects.length * 2, agentCount: 0, rejectedOutputs: [] };

  const judgeTopN = Math.max(1, config.llm.dailyJudgeTopN ?? 12);
  const visibleProjects = [...report.today_star_projects, ...report.context_only_projects];
  let judgeApplied: DailyEnhancementApplyResult = { applicableCount: 0, agentCount: 0, rejectedOutputs: [] };
  if (visibleProjects.length > 0) {
    judgeApplied = await applyRetriedDailyPositionJudgments(report, visibleProjects, config, judgeTopN, diagnostics);
  }

  report.enhancement_status = enhancementStatusFromCounts(summaryApplied, judgeApplied);
  report.enhancement_audit = {
    rejected_outputs: [...summaryApplied.rejectedOutputs, ...judgeApplied.rejectedOutputs],
  };
  report.llm_diagnostics = diagnostics;
  return report;
}

function renderPersonalizedSection(report: DailyReport): string[] {
  if (!report.personalized_relevance_applicable) return [];

  const personalized = [...report.today_star_projects, ...report.context_only_projects]
    .filter((project) => project.matched_interest_topics.length > 0)
    .sort((a, b) => {
      if (a.matched_interest_topics.length !== b.matched_interest_topics.length) {
        return b.matched_interest_topics.length - a.matched_interest_topics.length;
      }
      if (a.preference_boost !== b.preference_boost) return b.preference_boost - a.preference_boost;
      return b.final_rank - a.final_rank;
    })
    .slice(0, 3);

  return [
    "## 更适合你关注的摘要",
    "",
    ...(personalized.length > 0
      ? personalized.flatMap((project) => [
          `- [${project.project.project_name}](${project.project.repo_url})`,
          `  - 命中主题: ${project.matched_interest_topics.join("、")}`,
          `  - 关注理由: ${project.personalization_reason_cn ?? "暂无可读个性化说明"}`,
          `  - 偏好增益: ${formatScore(project.preference_boost)} | final_rank=${formatScore(project.final_rank)}`,
          "",
        ])
      : ["- 本次没有更贴近你当前关注方向的项目", ""]),
  ];
}

function renderLlmDiagnostics(report: DailyReport): string[] {
  const diagnostics = report.llm_diagnostics;
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
    `- enhancement_status: ${report.enhancement_status}`,
    ...(diagnostics.classification_last_error ? [`- latest_provider_error: ${diagnostics.classification_last_error}`] : []),
    ...(diagnostics.summary_last_error ? [`- latest_summary_error: ${diagnostics.summary_last_error}`] : []),
    ...(diagnostics.judge_last_error ? [`- latest_judge_error: ${diagnostics.judge_last_error}`] : []),
  ];
}

export function renderDailyReport(report: DailyReport): string {
  const freshnessLines =
    report.freshness_sources.length > 0 ? report.freshness_sources.map(sourceLine) : ["- 暂无可用的新鲜度输入，默认降级为过期视图"];
  const todayStarProjects = report.today_star_projects;
  const contextProjects = report.context_only_projects;

  return [
    `# Agent Trend Radar Daily Report ${report.date}`,
    "",
    `> generated_at: ${report.generated_at}`,
    "",
    "## 今日日志",
    "",
    `- 总状态: ${report.overall_daily_status}`,
    `- 是否建议继续阅读主榜单: ${report.main_board_mode === "no_fresh_main_board" ? "否" : "是"}`,
    `- 当天新鲜候选数: ${report.today_fresh_candidate_count}`,
    `- 历史补充候选数: ${report.context_candidate_count}`,
    `- 待二次确认项目数: ${report.pending_confirmation_count}`,
    "",
    "## 新鲜度摘要",
    "",
    ...freshnessLines,
    "",
    "## LLM 诊断",
    "",
    ...renderLlmDiagnostics(report),
    "",
    "## 候选池概览",
    "",
    `- main_board_mode: ${report.main_board_mode}`,
    `- today_fresh_candidate_count: ${report.today_fresh_candidate_count}`,
    `- context_candidate_count: ${report.context_candidate_count}`,
    `- pending_confirmation_count: ${report.pending_confirmation_count}`,
    "",
    ...renderInformationSources(),
    ...renderPersonalizedSection(report),
    "## 当天明星项目",
    "",
    ...(todayStarProjects.length > 0
      ? todayStarProjects.flatMap((project) => [...projectCard(project), ""])
      : ["- 当前主榜单为空，历史 fallback 不会自动补齐为今天明星项目", ""]),
    ...(contextProjects.length > 0
      ? renderProjectSection("## 历史补充观察", contextProjects, "暂无历史补充观察项目", {
          limit: 8,
          compressedLabel: "历史补充观察已折叠",
        })
      : ["## 历史补充观察", "", "- 暂无历史补充观察项目", ""]),
    ...compatibilitySummary(report),
  ].join("\n");
}
