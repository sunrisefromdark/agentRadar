import type { AppConfig } from "../config.ts";
import type {
  CoreTrendCard,
  DailyReport,
  DailyReportProjectDetail,
  EnhancementAudit,
  EnhancementStatus,
  FinalWeeklyTrend,
  FinalWeeklyTrendObservation,
  PersonalizedWeeklyFocus,
  RejectedOutput,
  ScoreComponentName,
  ScoredProject,
  WeeklyAuditReport,
  WeeklyEvidenceCluster,
  WeeklyEvidenceProject,
  WeeklyEvidenceAxis,
  WeeklyEvidenceMatrix,
  WeeklyJudgmentReport,
  WeeklyReport,
  WeeklySemanticInputBundle,
  WeeklySemanticInputProject,
  WeeklySupportProject,
  WeeklyTrendAgentReview,
  WeeklyTrendCandidate,
  WeeklyTrendCandidateV2,
  WeakSignalCard,
  UserInterestTopicName,
} from "../types.ts";
import { callStructuredEnhancement, isEnhancementEnabled } from "./enhancementLlm.ts";
import { warmMissingProjectDescriptions } from "./descriptionBackfill.ts";
import { buildProjectBriefFromScoredProject, validateProjectBriefSpecificity } from "./projectBriefs.ts";
import { buildRiskReviewNote, riskReviewRequired } from "./riskReview.ts";
import {
  buildRulesFallbackWeeklyJudgment,
  buildWeeklyEvidenceClusters,
  buildWeeklyEvidenceProjects,
  buildWeeklyTrendCandidatesV2,
} from "./weeklyJudgmentRules.ts";
import { applyWeeklyTrendAgentReview, buildWeeklyTrendAgentPrompt } from "./weeklyTrendAgent.ts";

type WindowDay = {
  date: string;
  scored: ScoredProject[];
  daily: DailyReport;
};

type VisibleProject = ScoredProject & DailyReportProjectDetail;

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function legacyVisibleProject(
  project: ScoredProject,
  projectClass: DailyReportProjectDetail["project_class"],
): VisibleProject {
  return {
    ...project,
    project_class: projectClass,
    objective_score: project.score.total_score,
    preference_boost: 0,
    base_final_rank: project.score.total_score,
    final_rank: project.score.total_score,
    matched_interest_topics: [],
    project_brief_cn: buildProjectBriefFromScoredProject(project),
    why_today_cn: `它在 ${Math.max(project.project.appearance_dates.length, 1)} 个日期里持续留下记录，可作为本周变化判断的背景证据。`,
    enhancement_source: "template_fallback",
  };
}

function legacyVisibleProjectsForDay(day: WindowDay): VisibleProject[] {
  const report = day.daily as Partial<DailyReport> | null | undefined;
  const newProjects = asArray(report?.new_projects);
  const highScoreProjects = asArray(report?.high_score_projects);
  const allProjects = asArray(report?.all_projects);
  const visible = new Map<string, VisibleProject>();

  for (const project of newProjects) {
    visible.set(project.project.repo_full_name.toLowerCase(), legacyVisibleProject(project, "today_star"));
  }

  for (const project of highScoreProjects) {
    const key = project.project.repo_full_name.toLowerCase();
    if (!visible.has(key)) {
      visible.set(key, legacyVisibleProject(project, "context_only"));
    }
  }

  if (visible.size === 0) {
    for (const project of allProjects) {
      const key = project.project.repo_full_name.toLowerCase();
      if (!visible.has(key)) {
        visible.set(key, legacyVisibleProject(project, "context_only"));
      }
    }
  }

  return [...visible.values()];
}

function visibleProjectsForDay(day: WindowDay): VisibleProject[] {
  const todayProjects = asArray(day.daily?.today_star_projects);
  const contextProjects = asArray(day.daily?.context_only_projects);
  if (todayProjects.length > 0 || contextProjects.length > 0) {
    return [...todayProjects, ...contextProjects];
  }
  return legacyVisibleProjectsForDay(day);
}

type TrendBucket = {
  trend_key: string;
  matched_topics: UserInterestTopicName[];
  matched_paradigm: string;
  distinct_repo_count: number;
  supporting_project_refs: Array<{
    repo_url: string;
    repo_full_name: string;
    appearance_dates: string[];
  }>;
  appearance_dates: Set<string>;
  shared_capability_tags: Set<string>;
  evidence_notes: string[];
  candidate_strength: "strong" | "medium";
  projects: ScoredProject[];
};

const TOPIC_KEYWORDS: Record<UserInterestTopicName, string[]> = {
  "agent-runtime": ["agent", "runtime", "orchestrat", "sandbox", "workflow", "autonomy"],
  memory: ["memory", "context", "retrieval", "remember", "persistent"],
  "coding-agent": ["coding", "code", "agent", "autonomous developer", "repo"],
  infra: ["infra", "infrastructure", "platform", "sdk", "framework", "gateway", "router", "mcp"],
  evaluation: ["eval", "evaluation", "benchmark", "judge", "quality", "review"],
  mcp: ["mcp", "model context protocol", "tooling", "tool-use"],
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function normalizeText(...parts: Array<string | undefined>): string {
  return parts
    .filter((item): item is string => Boolean(item))
    .join(" ")
    .toLowerCase();
}

function repoFullNameFromRepoUrl(repoUrl: string): string {
  return repoUrl.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
}

function matchTopics(text: string): UserInterestTopicName[] {
  const matches: UserInterestTopicName[] = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS) as Array<[UserInterestTopicName, string[]]>) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      matches.push(topic);
    }
  }
  return unique(matches);
}

function trendKeyFromTopics(topics: UserInterestTopicName[], paradigm: string, tags: string[]): string {
  if (topics.includes("agent-runtime")) return "agent-runtime";
  if (topics.includes("memory")) return "memory";
  if (topics.includes("coding-agent")) return "coding-agent";
  if (topics.includes("infra")) return "infra";
  if (topics.includes("evaluation")) return "evaluation";
  if (topics.includes("mcp")) return "mcp";

  const tagMatch = tags.find((tag) => /agent|memory|infra|eval|mcp|tool/i.test(tag));
  if (tagMatch) return slugify(tagMatch);

  return slugify(paradigm || "trend");
}

function candidateStrength(distinctRepoCount: number, appearanceDates: number, evidenceNotes: number): "strong" | "medium" {
  return distinctRepoCount >= 2 && appearanceDates >= 2 && evidenceNotes >= 2 ? "strong" : "medium";
}

const WEEKLY_EVIDENCE_AXES: ScoreComponentName[] = [
  "star_velocity",
  "engagement_score",
  "architecture_shift",
  "compounding_capability",
  "autonomy_score",
  "discussion_score",
];

function roundScore(value: number): number {
  return Number.parseFloat(value.toFixed(1));
}

function summarizeWeeklyEvidenceAxis(
  axis: ScoreComponentName,
  score: number,
  projectCount: number,
  highSignalCount: number,
  leadProjects: string[],
  leadEvidence: string | undefined,
): string {
  const scope =
    projectCount > 0
      ? `${projectCount} 个项目留下该轴记录，其中 ${highSignalCount} 个达到高强度，轴均分 ${roundScore(score)}。`
      : "当前周窗口没有该轴的项目级记录。";
  const projectSummary = leadProjects.length > 0 ? `代表项目包括 ${leadProjects.join("、")}。` : "";
  const evidenceSummary = leadEvidence ? `证据摘要：${leadEvidence}` : "当前没有额外证据摘录。";
  void axis;
  return `${scope}${projectSummary}${evidenceSummary}`;
}

type WeeklyAxisProjectMatch = {
  project: WeeklySemanticInputProject;
  component: WeeklySemanticInputProject["score"]["components"][number];
};

function resolveFocusedTrend(
  report: Pick<WeeklyReport, "core_trend_cards" | "supporting_trend_keys" | "weak_signal_cards">,
): { focusedTrendKey: string | null; focusedTrendName: string | null } {
  const focusedCoreTrend = report.core_trend_cards[0];
  const fallbackWeakSignal = report.weak_signal_cards[0];
  let focusedTrendKey: string | null = null;
  let focusedTrendName: string | null = null;

  if (focusedCoreTrend) {
    focusedTrendKey = focusedCoreTrend.trend_key;
    focusedTrendName = focusedCoreTrend.trend_name_cn;
  }
  if (!focusedTrendKey) {
    const supportingTrendKey = report.supporting_trend_keys[0];
    if (supportingTrendKey) {
      focusedTrendKey = supportingTrendKey;
    }
  }
  if (!focusedTrendKey) {
    if (fallbackWeakSignal) {
      focusedTrendKey = fallbackWeakSignal.trend_key;
    }
  }
  if (!focusedTrendName) {
    if (fallbackWeakSignal) {
      focusedTrendName = fallbackWeakSignal.signal_name_cn;
    }
  }
  if (!focusedTrendName) {
    focusedTrendName = focusedTrendKey;
  }

  return { focusedTrendKey, focusedTrendName };
}

function findWeeklyAxisComponent(
  project: WeeklySemanticInputProject,
  axis: ScoreComponentName,
): WeeklyAxisProjectMatch["component"] | null {
  return project.score.components.find((component) => component.name === axis) ?? null;
}

function collectWeeklyAxisProjectMatches(
  focusedProjects: WeeklySemanticInputProject[],
  axis: ScoreComponentName,
): WeeklyAxisProjectMatch[] {
  return focusedProjects
    .map((project) => ({
      project,
      component: findWeeklyAxisComponent(project, axis),
    }))
    .filter((item): item is WeeklyAxisProjectMatch => Boolean(item.component && Number.isFinite(item.component.score)))
    .sort((left, right) => right.component.score - left.component.score);
}

function buildWeeklyEvidenceAxisFromProjects(
  axis: ScoreComponentName,
  focusedProjects: WeeklySemanticInputProject[],
): WeeklyEvidenceAxis {
  const axisProjects = collectWeeklyAxisProjectMatches(focusedProjects, axis);
  const projectCount = axisProjects.length;
  const evidence = unique(
    axisProjects
      .flatMap((item) => item.component.evidence)
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const totalScore = axisProjects.reduce((sum, item) => sum + item.component.score, 0);
  const score = projectCount > 0 ? roundScore(totalScore / projectCount) : 0;
  const highSignalProjectCount = axisProjects.filter((item) => item.component.score >= 70).length;
  const sampleProjects = axisProjects.slice(0, 3).map((item) => ({
    repo_url: item.project.repo_url,
    repo_full_name: item.project.repo_full_name,
    score: roundScore(item.component.score),
  }));

  return {
    axis,
    score,
    project_count: projectCount,
    high_signal_project_count: highSignalProjectCount,
    evidence_count: evidence.length,
    sample_projects: sampleProjects,
    top_evidence: evidence.slice(0, 2),
    summary_cn: summarizeWeeklyEvidenceAxis(
      axis,
      score,
      projectCount,
      highSignalProjectCount,
      sampleProjects.map((project) => project.repo_full_name),
      evidence[0],
    ),
  };
}

function summarizeWeeklyEvidenceMatrix(focusedTrendKey: string | null, coveredAxes: number): string {
  if (focusedTrendKey && coveredAxes > 0) {
    return `当前聚焦 ${focusedTrendKey}，六轴里有 ${coveredAxes} 个维度具备项目级结构化证据，可直接展开核对。`;
  }
  return "当前周报还没有可聚焦的稳定趋势，因此结构化证据矩阵仍然不足。";
}

function buildTrendScopedEvidenceMatrix(
  focusedTrendKey: string | null,
  focusedTrendName: string | null,
  weeklyFocusProjects: WeeklySemanticInputProject[],
): WeeklyEvidenceMatrix {
  const focusedProjects = focusedTrendKey
    ? weeklyFocusProjects.filter((project) => project.trend_key === focusedTrendKey)
    : [];
  const axes = WEEKLY_EVIDENCE_AXES.map((axis) => buildWeeklyEvidenceAxisFromProjects(axis, focusedProjects));
  const coveredAxes = axes.filter((axis) => axis.project_count > 0).length;

  return {
    focused_trend_key: focusedTrendKey,
    focused_trend_name_cn: focusedTrendName,
    summary_cn: summarizeWeeklyEvidenceMatrix(focusedTrendKey, coveredAxes),
    axes,
  };
}

function attachCoreTrendEvidenceMatrices(
  cards: CoreTrendCard[],
  weeklyFocusProjects: WeeklySemanticInputProject[],
): CoreTrendCard[] {
  return cards.map((card) => ({
    ...card,
    evidence_matrix: buildTrendScopedEvidenceMatrix(card.trend_key, card.trend_name_cn, weeklyFocusProjects),
  }));
}

function buildWeeklyEvidenceMatrix(
  report: Pick<WeeklyReport, "core_trend_cards" | "supporting_trend_keys" | "weak_signal_cards">,
  weeklyFocusProjects: WeeklySemanticInputProject[],
): WeeklyEvidenceMatrix {
  const { focusedTrendKey, focusedTrendName } = resolveFocusedTrend(report);
  return buildTrendScopedEvidenceMatrix(focusedTrendKey, focusedTrendName, weeklyFocusProjects);
}

function addBucket(
  buckets: Map<string, TrendBucket>,
  project: ScoredProject,
  trendKey: string,
  topics: UserInterestTopicName[],
): void {
  const existing = buckets.get(trendKey);
  const appearanceDates = new Set(project.project.appearance_dates);
  const sharedTags = new Set(
    project.project.tags.filter((tag) => !/watchlist-hit/i.test(tag) && !/noise/i.test(tag)),
  );
  const evidenceNotes = [
    `repo=${project.project.repo_full_name}`,
    `paradigm=${project.score.paradigm}`,
    `confidence=${project.score.confidence}`,
    `appearances=${project.project.appearances}`,
  ];

  if (!existing) {
    buckets.set(trendKey, {
      trend_key: trendKey,
      matched_topics: topics,
      matched_paradigm: project.score.paradigm,
      distinct_repo_count: 1,
      supporting_project_refs: [
        {
          repo_url: project.project.repo_url,
          repo_full_name: project.project.repo_full_name,
          appearance_dates: [...project.project.appearance_dates],
        },
      ],
      appearance_dates: appearanceDates,
      shared_capability_tags: sharedTags,
      evidence_notes: evidenceNotes,
      candidate_strength: "medium",
      projects: [project],
    });
    return;
  }

  existing.matched_topics = unique([...existing.matched_topics, ...topics]);
  existing.supporting_project_refs.push({
    repo_url: project.project.repo_url,
    repo_full_name: project.project.repo_full_name,
    appearance_dates: [...project.project.appearance_dates],
  });
  for (const item of appearanceDates) existing.appearance_dates.add(item);
  for (const item of sharedTags) existing.shared_capability_tags.add(item);
  existing.evidence_notes.push(...evidenceNotes);
  existing.projects.push(project);
  existing.distinct_repo_count = new Set(existing.supporting_project_refs.map((item) => item.repo_full_name.toLowerCase())).size;
  existing.candidate_strength = candidateStrength(
    existing.distinct_repo_count,
    existing.appearance_dates.size,
    existing.evidence_notes.length,
  );
}

export function buildWeeklyTrendCandidates(days: WindowDay[]): WeeklyTrendCandidate[] {
  const buckets = new Map<string, TrendBucket>();

  for (const day of days) {
    for (const item of day.scored) {
      const text = normalizeText(
        item.project.project_name,
        item.project.repo_full_name,
        item.project.description,
        item.score.paradigm,
        ...item.project.tags,
      );
      const topics = matchTopics(text);
      const trendKey = trendKeyFromTopics(topics, item.score.paradigm, item.project.tags);
      addBucket(buckets, item, trendKey, topics);
    }
  }

  return [...buckets.values()].map((bucket) => ({
    trend_key: bucket.trend_key,
    matched_topics: bucket.matched_topics,
    matched_paradigm: bucket.matched_paradigm,
    distinct_repo_count: bucket.distinct_repo_count,
    supporting_project_refs: bucket.supporting_project_refs,
    appearance_dates: [...bucket.appearance_dates].sort(),
    shared_capability_tags: [...bucket.shared_capability_tags].sort(),
    evidence_notes: [...new Set(bucket.evidence_notes)],
    candidate_strength: candidateStrength(
      bucket.distinct_repo_count,
      bucket.appearance_dates.size,
      bucket.evidence_notes.length,
    ),
  }));
}

function buildWeeklyFocusProjects(days: WindowDay[], candidates: WeeklyTrendCandidate[]): WeeklySemanticInputProject[] {
  const candidatesByKey = new Map(candidates.map((candidate) => [candidate.trend_key, candidate]));
  const seen = new Set<string>();
  const result: WeeklySemanticInputProject[] = [];

  for (const day of days) {
    for (const project of visibleProjectsForDay(day)) {
      const text = normalizeText(
        project.project.project_name,
        project.project.repo_full_name,
        project.project.description,
        project.score.paradigm,
        ...project.project.tags,
      );
      const topics = matchTopics(text);
      const trendKey = trendKeyFromTopics(topics, project.score.paradigm, project.project.tags);
      if (!candidatesByKey.has(trendKey)) continue;
      const marker = `${project.project.repo_full_name.toLowerCase()}::${trendKey}`;
      if (seen.has(marker)) continue;
      seen.add(marker);
      result.push({
        repo_url: project.project.repo_url,
        project_name: project.project.project_name,
        repo_full_name: project.project.repo_full_name,
        trend_key: trendKey,
        data_trust: project.score.data_trust,
        appearance_dates: [...project.project.appearance_dates],
        sources: [...project.project.sources],
        trust_flags: [...project.project.trust_flags],
        score: {
          paradigm: project.score.paradigm,
          components: [...project.score.components],
          anti_noise_flags: [...project.score.anti_noise_flags],
          risks: [...project.score.risks],
        },
        tags: [...project.project.tags],
        description: project.project.description,
      });
    }
  }

  return result;
}

function trendSupportProjects(
  trendKey: string,
  days: WindowDay[],
  limit: number,
  config: AppConfig,
): WeeklySupportProject[] {
  const projects = new Map<string, VisibleProject>();
  for (const day of days) {
    for (const project of visibleProjectsForDay(day)) {
      const text = normalizeText(
        project.project.project_name,
        project.project.repo_full_name,
        project.project.description,
        project.score.paradigm,
        ...project.project.tags,
      );
      const topics = matchTopics(text);
      const candidateKey = trendKeyFromTopics(topics, project.score.paradigm, project.project.tags);
      if (candidateKey !== trendKey) continue;
      projects.set(project.project.repo_full_name.toLowerCase(), project);
    }
  }

  return [...projects.values()]
    .sort((a, b) => b.score.total_score - a.score.total_score)
    .filter((project) => project.score.total_score >= config.thresholds.highScore)
    .slice(0, limit)
    .map((project) => {
      const matchedInterestTopics = matchWeeklyInterestTopics(project, config);
      const needsRiskReview = riskReviewRequired(project);
      return {
        repo_url: project.project.repo_url,
        project_name: project.project.project_name,
        project_class: project.score.verdict === "high" ? "today_star" : "context_only",
        objective_score: project.score.total_score,
        preference_boost: 0,
        base_final_rank: project.score.total_score,
        final_rank: project.score.total_score,
        matched_interest_topics: matchedInterestTopics,
        project_brief_cn: buildProjectBriefFromScoredProject(project, matchedInterestTopics),
        why_today_cn: `它本周在 ${trendKey} 方向里持续出现，说明不是单点波动，仍然值得继续跟踪观察。`,
        enhancement_source: "template_fallback",
        personalization_reason_cn: matchedInterestReason(matchedInterestTopics),
        risk_review_required: needsRiskReview,
        risk_review_note_cn: needsRiskReview ? buildRiskReviewNote(project) : undefined,
        risk_review_source: needsRiskReview ? "template_fallback" : undefined,
        watchlist_note_cn: project.project.tags.includes("watchlist-hit") ? "你跟踪的对象有更新。" : undefined,
        trend_key: trendKey,
        why_this_week_cn: `最近 ${Math.max(project.project.appearance_dates.length, 1)} 个日期里它都出现在 ${trendKey} 方向里，和本周趋势候选保持一致。`,
      };
    });
}

function buildCoreTrendCards(
  days: WindowDay[],
  candidates: WeeklyTrendCandidate[],
  config: AppConfig,
): { cards: CoreTrendCard[]; demotedTrendKeys: string[] } {
  const coreCandidates = candidates
    .filter((candidate) => candidate.candidate_strength === "strong")
    .sort((a, b) => {
      if (a.matched_topics.length !== b.matched_topics.length) return b.matched_topics.length - a.matched_topics.length;
      if (a.candidate_strength !== b.candidate_strength) return a.candidate_strength === "strong" ? -1 : 1;
      return b.distinct_repo_count - a.distinct_repo_count;
    });

  const cards: CoreTrendCard[] = [];
  const demotedTrendKeys: string[] = [];

  for (const candidate of coreCandidates) {
    const supportingProjects = trendSupportProjects(candidate.trend_key, days, 3, config);
    if (supportingProjects.length === 0) {
      demotedTrendKeys.push(candidate.trend_key);
      continue;
    }
    if (cards.length >= 4) {
      continue;
    }

    cards.push({
      trend_key: candidate.trend_key,
      trend_name_cn: candidate.matched_topics[0] ?? candidate.trend_key,
      trend_summary_cn: `本周围绕 ${candidate.trend_key} 形成了 ${candidate.distinct_repo_count} 个不同仓库的重复出现，已经具备稳定聚合迹象。`,
      evidence_summary_cn: candidate.evidence_notes.slice(0, 2).join("；"),
      strength: candidate.candidate_strength,
      worth_following_next_week:
        candidate.distinct_repo_count >= 2 ? "值得继续跟踪，看下周是否继续扩大。" : "仍需继续观察，确认能否转成稳定趋势。",
      supporting_projects: supportingProjects,
    });
  }

  return { cards, demotedTrendKeys };
}

function weakSignalCards(candidates: WeeklyTrendCandidate[], demotedTrendKeys: string[]): WeakSignalCard[] {
  const demoted = new Set(demotedTrendKeys);
  return candidates
    .filter((candidate) => candidate.candidate_strength !== "strong" || demoted.has(candidate.trend_key))
    .sort((a, b) => {
      if (a.matched_topics.length !== b.matched_topics.length) return b.matched_topics.length - a.matched_topics.length;
      if (a.distinct_repo_count !== b.distinct_repo_count) return b.distinct_repo_count - a.distinct_repo_count;
      if (a.appearance_dates.length !== b.appearance_dates.length) return b.appearance_dates.length - a.appearance_dates.length;
      return a.trend_key.localeCompare(b.trend_key);
    })
    .slice(0, 2)
    .map((candidate) => ({
      trend_key: candidate.trend_key,
      signal_name_cn: candidate.matched_topics[0] ?? candidate.trend_key,
      why_weak_cn: `当前只有 ${candidate.distinct_repo_count} 个仓库支持，还不足以升级为核心趋势。`,
      evidence_summary_cn: candidate.evidence_notes.slice(0, 2).join("；"),
      worth_following_next_week: "如果下周继续出现，再考虑升级为核心趋势。",
    }));
}

function matchInterestTopicsFromSearchableText(searchable: string, config: AppConfig): UserInterestTopicName[] {
  const profile = config.sources.userInterestProfile;
  if (!profile?.enabled) return [];

  const topics: UserInterestTopicName[] = [];
  for (const topic of profile.topics) {
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

  return unique(topics);
}

function matchWeeklyInterestTopics(project: VisibleProject, config: AppConfig): UserInterestTopicName[] {
  return matchInterestTopicsFromSearchableText(
    normalizeText(
      project.project.project_name,
      project.project.repo_full_name,
      project.project.description,
      project.score.paradigm,
      ...project.project.tags,
    ),
    config,
  );
}

function matchedInterestReason(topics: UserInterestTopicName[]): string | undefined {
  if (topics.length === 0) return undefined;
  return `命中 ${topics.join(", ")}，和你当前关注方向一致。`;
}

function enhancementSourceForProject(coreExplanationAccepted: boolean): "agent" | "template_fallback" {
  return coreExplanationAccepted ? "agent" : "template_fallback";
}

function defaultNoMatchPersonalizationNote(): string {
  return "本周没有明显更贴近你当前关注方向的趋势。";
}

function personalizedWeeklyFocus(coreCards: CoreTrendCard[], config: AppConfig): PersonalizedWeeklyFocus[] {
  const userInterestProfile = config.sources.userInterestProfile;
  if (!userInterestProfile?.enabled) return [];

  const enabledTopics = userInterestProfile.topics.map((topic) => topic.name);
  if (enabledTopics.length === 0 || coreCards.length === 0) return [];

  const enabledTopicSet = new Set(enabledTopics);

  const personalizedCandidates = coreCards
    .map((card) => {
      const matchedTopics = matchInterestTopicsFromSearchableText(normalizeText(card.trend_key), config);
      if (matchedTopics.length === 0) return undefined;

      const supportingProjectRefs = card.supporting_projects
        .filter((project) => project.matched_interest_topics.some((topic) => enabledTopicSet.has(topic)))
        .slice(0, 3)
        .map((project) => ({
          repo_url: project.repo_url,
          repo_full_name: repoFullNameFromRepoUrl(project.repo_url),
        }));

      if (supportingProjectRefs.length === 0) return undefined;

      return {
        trend_key: card.trend_key,
        matched_interest_topics: matchedTopics,
        personalization_reason_cn: `命中 ${matchedTopics.join(", ")}，和你当前关注方向一致。`,
        supporting_project_refs: supportingProjectRefs,
        matched_interest_topic_count: matchedTopics.length,
        supporting_project_hit_count: supportingProjectRefs.length,
        candidate_strength: card.strength,
      };
    })
    .filter((item): item is Exclude<typeof item, undefined> => item !== undefined);

  return personalizedCandidates
    .sort((a, b) => {
      if (a.matched_interest_topic_count !== b.matched_interest_topic_count) {
        return b.matched_interest_topic_count - a.matched_interest_topic_count;
      }
      if (a.candidate_strength !== b.candidate_strength) {
        return a.candidate_strength === "strong" ? -1 : 1;
      }
      if (a.supporting_project_hit_count !== b.supporting_project_hit_count) {
        return b.supporting_project_hit_count - a.supporting_project_hit_count;
      }
      return a.trend_key.localeCompare(b.trend_key);
    })
    .slice(0, 3)
    .map(({ trend_key, matched_interest_topics, personalization_reason_cn, supporting_project_refs }) => ({
      trend_key,
      matched_interest_topics,
      personalization_reason_cn,
      supporting_project_refs,
    }));
}

function overallSummary(cards: CoreTrendCard[], weakSignals: WeakSignalCard[]): string {
  if (cards.length === 0) {
    if (weakSignals.length === 0) return "本周尚未形成稳定趋势，主要仍处在规则层弱信号观察阶段。";
    return "本周尚未形成稳定趋势，更多是弱信号和待观察方向。";
  }

  const leader = cards[0];
  return `本周最稳定的方向是 ${leader.trend_name_cn}，并且已经在多个仓库中重复出现。`;
}

function rejection(layer: string, targetKey: string, reasonDetail: string): RejectedOutput {
  return {
    layer,
    target_key: targetKey,
    reason_code: "template_fallback",
    reason_detail: reasonDetail,
  };
}

function personalizedFocusApplicable(report: WeeklyReport): boolean {
  return report.personalized_weekly_focus_applicable;
}

function summaryReferencesCoreTrends(
  summary: string,
  supportingTrendKeys: string[] | undefined,
  coreCards: CoreTrendCard[],
): boolean {
  if (!isNonEmptyString(summary) || !supportingTrendKeys || supportingTrendKeys.length === 0) return false;

  const coreCardsByKey = new Map(coreCards.map((card) => [card.trend_key, card] as const));
  if (supportingTrendKeys.some((key) => !coreCardsByKey.has(key))) return false;

  const summaryText = normalizeText(summary);
  return supportingTrendKeys.some((key) => {
    const card = coreCardsByKey.get(key);
    return summaryText.includes(key.toLowerCase()) || (card?.trend_name_cn ? summaryText.includes(card.trend_name_cn.toLowerCase()) : false);
  });
}

function enhancementStatusFromCards(cards: CoreTrendCard[], weeklyFocusProjects: WeeklySemanticInputProject[]): EnhancementStatus {
  void cards;
  void weeklyFocusProjects;
  return "rules-only";
}

function buildRejections(
  report: WeeklyReport,
  cards: CoreTrendCard[],
  weakSignals: WeakSignalCard[],
  weeklyFocusProjects: WeeklySemanticInputProject[],
): RejectedOutput[] {
  return [
    rejection(
      "weekly_summary",
      report.window_end,
      "overall_summary_cn was generated from template rules rather than an agent output.",
    ),
    ...cards.map((card) => ({
      layer: "core_trend_card",
      target_key: card.trend_key,
      reason_code: "template_fallback",
      reason_detail: "core trend card text was generated from template rules rather than an agent output.",
    })),
    ...weakSignals.map((card) => ({
      layer: "weak_signal_card",
      target_key: card.trend_key,
      reason_code: "template_fallback",
      reason_detail: "weak signal card text was generated from template rules rather than an agent output.",
    })),
    ...weeklyFocusProjects.map((project) => ({
      layer: "weekly_focus_project",
      target_key: project.repo_url,
      reason_code: "template_fallback",
      reason_detail: "weekly project explanation was generated from template rules rather than an agent output.",
    })),
    ...report.personalized_weekly_focus.map((focus) => ({
      layer: "personalized_weekly_focus",
      target_key: focus.trend_key,
      reason_code: "template_fallback",
      reason_detail: "personalization_reason_cn was generated from template rules rather than an agent output.",
    })),
    ...(report.personalized_weekly_focus_applicable && report.personalized_weekly_focus.length === 0
      ? [
          {
            layer: "personalized_weekly_focus",
            target_key: report.window_end,
            reason_code: "template_fallback",
            reason_detail: "no-match personalization note was generated from template rules rather than an agent output.",
          },
        ]
      : []),
  ];
}

function buildVisibleProjectIndex(days: WindowDay[]): Map<string, VisibleProject> {
  const visible = new Map<string, VisibleProject>();
  for (const day of days) {
    for (const project of visibleProjectsForDay(day)) {
      const key = project.project.repo_full_name.toLowerCase();
      const existing = visible.get(key);
      if (!existing || project.score.total_score > existing.score.total_score) {
        visible.set(key, project);
      }
    }
  }
  return visible;
}

function buildCompatibilityTrendCandidates(
  candidates: WeeklyTrendCandidateV2[],
  projects: WeeklyEvidenceProject[],
): WeeklyTrendCandidate[] {
  const projectByRepo = new Map(projects.map((project) => [project.repo_full_name, project] as const));
  return candidates.map((candidate) => {
    const supportingProjects = candidate.supporting_project_refs
      .map((repoFullName) => projectByRepo.get(repoFullName))
      .filter((project): project is WeeklyEvidenceProject => Boolean(project));
    return {
      trend_key: candidate.candidate_name_hint,
      matched_topics: unique(supportingProjects.flatMap((project) => project.matched_topics)),
      matched_paradigm: unique(supportingProjects.map((project) => project.paradigm)).join(" + ") || candidate.candidate_name_hint,
      distinct_repo_count: supportingProjects.length,
      supporting_project_refs: supportingProjects.map((project) => ({
        repo_url: project.repo_url,
        repo_full_name: project.repo_full_name,
        appearance_dates: [...project.appearance_dates],
      })),
      appearance_dates: unique(supportingProjects.flatMap((project) => project.appearance_dates)).sort(),
      shared_capability_tags: unique(supportingProjects.flatMap((project) => project.tags)).sort(),
      evidence_notes: [...candidate.evidence_refs],
      candidate_strength: candidate.rule_verdict === "likely-trend" ? "strong" : "medium",
    };
  });
}

function buildWeeklySupportProjectFromVisibleProject(
  visibleProject: VisibleProject,
  trendKey: string,
  config: AppConfig,
): WeeklySupportProject {
  const matchedInterestTopics = matchWeeklyInterestTopics(visibleProject, config);
  const needsRiskReview = riskReviewRequired(visibleProject);
  return {
    repo_url: visibleProject.project.repo_url,
    project_name: visibleProject.project.project_name,
    project_class: visibleProject.project_class,
    objective_score: visibleProject.objective_score,
    preference_boost: visibleProject.preference_boost,
    base_final_rank: visibleProject.base_final_rank,
    final_rank: visibleProject.final_rank,
    matched_interest_topics: matchedInterestTopics,
    project_brief_cn: buildProjectBriefFromScoredProject(visibleProject, matchedInterestTopics),
    why_today_cn: visibleProject.why_today_cn,
    enhancement_source: "template_fallback",
    personalization_reason_cn: matchedInterestReason(matchedInterestTopics),
    risk_review_required: needsRiskReview,
    risk_review_note_cn: needsRiskReview ? buildRiskReviewNote(visibleProject) : undefined,
    risk_review_source: needsRiskReview ? "template_fallback" : undefined,
    watchlist_note_cn: visibleProject.project.tags.includes("watchlist-hit") ? "你跟踪的对象有更新。" : undefined,
    trend_key: trendKey,
    why_this_week_cn: `最近 ${Math.max(visibleProject.project.appearance_dates.length, 1)} 个日期里它都出现在该方向附近，是这条周趋势的重要承载项目。`,
  };
}

function buildSupportProjectsFromTrendRefs(
  projectRefs: string[],
  trendKey: string,
  visibleProjects: Map<string, VisibleProject>,
  config: AppConfig,
): WeeklySupportProject[] {
  return projectRefs
    .map((repoFullName) => visibleProjects.get(repoFullName.toLowerCase()))
    .filter((project): project is VisibleProject => Boolean(project))
    .sort((left, right) => right.score.total_score - left.score.total_score)
    .slice(0, 3)
    .map((project) => buildWeeklySupportProjectFromVisibleProject(project, trendKey, config));
}

function buildWeeklyFocusProjectsFromSupportProjects(
  trendKey: string,
  supportingProjects: WeeklySupportProject[],
  visibleProjects: Map<string, VisibleProject>,
): WeeklySemanticInputProject[] {
  return supportingProjects
    .map((supportProject) => {
      const visibleProject = visibleProjects.get(repoFullNameFromRepoUrl(supportProject.repo_url).toLowerCase());
      if (!visibleProject) return undefined;
      return {
        repo_url: visibleProject.project.repo_url,
        project_name: visibleProject.project.project_name,
        repo_full_name: visibleProject.project.repo_full_name,
        trend_key: trendKey,
        data_trust: visibleProject.score.data_trust,
        appearance_dates: [...visibleProject.project.appearance_dates],
        sources: [...visibleProject.project.sources],
        trust_flags: [...visibleProject.project.trust_flags],
        score: {
          paradigm: visibleProject.score.paradigm,
          components: [...visibleProject.score.components],
          anti_noise_flags: [...visibleProject.score.anti_noise_flags],
          risks: [...visibleProject.score.risks],
        },
        tags: [...visibleProject.project.tags],
        description: visibleProject.project.description,
      };
    })
    .filter((project): project is WeeklySemanticInputProject => Boolean(project));
}

function compatibilityTrendKey(trendId: string, trendNameCn: string): string {
  const fromName = slugify(trendNameCn);
  if (fromName) return fromName;
  if (trendId.startsWith("candidate-cluster-")) {
    return trendId.replace(/^candidate-cluster-/, "");
  }
  return slugify(trendId) || trendId;
}

function weeklyTrendStrength(trend: FinalWeeklyTrend): CoreTrendCard["strength"] {
  return trend.audit_confidence === "high" ? "strong" : "medium";
}

function evidenceSummaryFromRefs(evidenceRefs: string[], fallback: string): string {
  return evidenceRefs.length > 0 ? evidenceRefs.slice(0, 2).join("；") : fallback;
}

function buildCompatibilityWeeklyReport(
  days: WindowDay[],
  judgment: WeeklyJudgmentReport,
  config: AppConfig,
): { report: WeeklyReport; audit: WeeklyAuditReport; weeklyFocusProjects: WeeklySemanticInputProject[] } {
  const visibleProjects = buildVisibleProjectIndex(days);
  const weeklyFocusProjects: WeeklySemanticInputProject[] = [];
  const coreCards = judgment.established_trends.map((trend) => {
    const trendKey = compatibilityTrendKey(trend.trend_id, trend.trend_name_cn);
    const supportingProjects = buildSupportProjectsFromTrendRefs(
      trend.supporting_project_refs,
      trendKey,
      visibleProjects,
      config,
    );
    weeklyFocusProjects.push(...buildWeeklyFocusProjectsFromSupportProjects(trendKey, supportingProjects, visibleProjects));
    return {
      trend_key: trendKey,
      trend_name_cn: trend.trend_name_cn,
      trend_summary_cn: trend.claim_cn,
      evidence_summary_cn: evidenceSummaryFromRefs(trend.evidence_refs, trend.why_established_cn),
      strength: weeklyTrendStrength(trend),
      worth_following_next_week: trend.watch_next_week_cn,
      supporting_projects: supportingProjects,
    } satisfies CoreTrendCard;
  });
  const weakSignals = judgment.observing_trends.map((trend) => {
    const trendKey = compatibilityTrendKey(trend.trend_id, trend.trend_name_cn);
    const supportingProjects = buildSupportProjectsFromTrendRefs(
      trend.supporting_project_refs,
      trendKey,
      visibleProjects,
      config,
    );
    weeklyFocusProjects.push(...buildWeeklyFocusProjectsFromSupportProjects(trendKey, supportingProjects, visibleProjects));
    return {
      trend_key: trendKey,
      signal_name_cn: trend.trend_name_cn,
      why_weak_cn: trend.why_not_established_cn,
      evidence_summary_cn: evidenceSummaryFromRefs(trend.evidence_refs, trend.why_not_established_cn),
      worth_following_next_week: trend.watch_next_week_cn,
    } satisfies WeakSignalCard;
  });
  const personalized = personalizedWeeklyFocus(coreCards, config);
  const report: WeeklyReport = {
    date: judgment.date,
    generated_at: judgment.generated_at,
    window_start: judgment.window_start,
    window_end: judgment.window_end,
    enhancement_status: judgment.enhancement_status,
    personalized_weekly_focus_applicable: Boolean(config.sources.userInterestProfile?.enabled),
    personalized_weekly_focus_note_cn:
      config.sources.userInterestProfile?.enabled && personalized.length === 0
        ? defaultNoMatchPersonalizationNote()
        : undefined,
    overall_summary_cn:
      judgment.enhancement_status === "rules-only" ? overallSummary(coreCards, weakSignals) : judgment.executive_summary_cn,
    supporting_trend_keys: coreCards.map((card) => card.trend_key),
    core_trend_cards: attachCoreTrendEvidenceMatrices(coreCards, weeklyFocusProjects),
    personalized_weekly_focus: personalized,
    weak_signal_cards: weakSignals,
    enhancement_audit: { rejected_outputs: [] },
  };
  report.evidence_matrix = buildWeeklyEvidenceMatrix(report, weeklyFocusProjects);
  report.enhancement_audit = {
    rejected_outputs:
      judgment.enhancement_status === "rules-only" && judgment.enhancement_audit.rejected_outputs.length === 0
        ? buildRejections(report, coreCards, weakSignals, weeklyFocusProjects)
        : judgment.enhancement_audit.rejected_outputs,
  };
  const audit: WeeklyAuditReport = {
    enhancement_status: report.enhancement_status,
    personalized_weekly_focus: report.personalized_weekly_focus,
    rejected_outputs: report.enhancement_audit.rejected_outputs,
  };
  return { report, audit, weeklyFocusProjects };
}

function buildWeeklyJudgmentReport(
  days: WindowDay[],
  review: WeeklyTrendAgentReview,
  enhancementStatus: EnhancementStatus,
  rejectedOutputs: RejectedOutput[],
  materials: {
    evidenceProjects: WeeklyEvidenceProject[];
    evidenceClusters: WeeklyEvidenceCluster[];
    trendCandidates: WeeklyTrendCandidateV2[];
  },
): WeeklyJudgmentReport {
  return {
    date: days[days.length - 1]?.date ?? "",
    generated_at: days[days.length - 1]?.daily.generated_at ?? "",
    window_start: days[0]?.date ?? "",
    window_end: days[days.length - 1]?.date ?? "",
    enhancement_status: enhancementStatus,
    executive_summary_cn: review.executive_summary_cn,
    rule_materials: {
      evidence_projects: materials.evidenceProjects,
      evidence_clusters: materials.evidenceClusters,
      trend_candidates: materials.trendCandidates,
      unexplained_project_refs: unique(materials.trendCandidates.flatMap((candidate) => candidate.unexplained_project_refs)),
      anomaly_project_refs: unique(materials.trendCandidates.flatMap((candidate) => candidate.anomaly_refs)),
    },
    established_trends: review.established_trends,
    observing_trends: review.observing_trends,
    audit_conclusion: review.audit_findings,
    evidence_matrix: undefined,
    enhancement_audit: { rejected_outputs: rejectedOutputs },
  };
}

function buildWeeklyTrendAgentReviewDraft(raw: unknown): WeeklyTrendAgentReview | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.established_trends) || !Array.isArray(record.observing_trends)) return undefined;
  if (!record.audit_findings || typeof record.audit_findings !== "object") return undefined;

  const confidenceOf = (value: unknown): "high" | "medium" | "low" =>
    value === "high" || value === "medium" || value === "low" ? value : "medium";
  const stringList = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
  const auditFindings = record.audit_findings as Record<string, unknown>;

  return {
    executive_summary_cn: isNonEmptyString(record.executive_summary_cn)
      ? record.executive_summary_cn.trim()
      : "Agent 未提供有效总结，沿用规则层结论。",
    established_trends: record.established_trends
      .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : undefined))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        trend_id: isNonEmptyString(item.trend_id) ? item.trend_id.trim() : "",
        trend_name_cn: isNonEmptyString(item.trend_name_cn) ? item.trend_name_cn.trim() : "",
        claim_cn: isNonEmptyString(item.claim_cn) ? item.claim_cn.trim() : "",
        why_established_cn: isNonEmptyString(item.why_established_cn) ? item.why_established_cn.trim() : "",
        supporting_candidate_ids: stringList(item.supporting_candidate_ids),
        supporting_project_refs: stringList(item.supporting_project_refs),
        evidence_refs: stringList(item.evidence_refs),
        counter_evidence_refs: stringList(item.counter_evidence_refs),
        watch_next_week_cn: isNonEmptyString(item.watch_next_week_cn) ? item.watch_next_week_cn.trim() : "",
        audit_confidence: confidenceOf(item.audit_confidence),
      }))
      .filter((item) => item.trend_id.length > 0 && item.trend_name_cn.length > 0),
    observing_trends: record.observing_trends
      .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : undefined))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item) => ({
        trend_id: isNonEmptyString(item.trend_id) ? item.trend_id.trim() : "",
        trend_name_cn: isNonEmptyString(item.trend_name_cn) ? item.trend_name_cn.trim() : "",
        why_not_established_cn: isNonEmptyString(item.why_not_established_cn) ? item.why_not_established_cn.trim() : "",
        supporting_candidate_ids: stringList(item.supporting_candidate_ids),
        supporting_project_refs: stringList(item.supporting_project_refs),
        evidence_refs: stringList(item.evidence_refs),
        watch_next_week_cn: isNonEmptyString(item.watch_next_week_cn) ? item.watch_next_week_cn.trim() : "",
      }))
      .filter((item) => item.trend_id.length > 0 && item.trend_name_cn.length > 0),
    audit_findings: {
      accepted_candidate_ids: stringList(auditFindings.accepted_candidate_ids),
      rejected_candidate_ids: stringList(auditFindings.rejected_candidate_ids),
      merged_groups: Array.isArray(auditFindings.merged_groups)
        ? auditFindings.merged_groups.map((item) => stringList(item)).filter((item) => item.length > 0)
        : [],
      split_actions: Array.isArray(auditFindings.split_actions)
        ? auditFindings.split_actions
            .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : undefined))
            .filter((item): item is Record<string, unknown> => Boolean(item))
            .map((item) => ({
              source_candidate_id: isNonEmptyString(item.source_candidate_id) ? item.source_candidate_id.trim() : "",
              new_trend_names: stringList(item.new_trend_names),
            }))
            .filter((item) => item.source_candidate_id.length > 0)
        : [],
      added_trends: stringList(auditFindings.added_trends),
      missed_signal_summary_cn: stringList(auditFindings.missed_signal_summary_cn),
      misjudgment_summary_cn: stringList(auditFindings.misjudgment_summary_cn),
      residual_blindspots_cn: stringList(auditFindings.residual_blindspots_cn),
    },
  };
}

export function buildWeeklyArtifacts(days: WindowDay[], config: AppConfig): {
  report: WeeklyReport;
  audit: WeeklyAuditReport;
  judgment: WeeklyJudgmentReport;
  semanticInput: WeeklySemanticInputBundle;
  trendCandidates: WeeklyTrendCandidate[];
  trendCandidatesV2: WeeklyTrendCandidateV2[];
  fallbackReview: WeeklyTrendAgentReview;
  evidenceProjects: WeeklyEvidenceProject[];
  evidenceClusters: WeeklyEvidenceCluster[];
  weeklyFocusProjects: WeeklySemanticInputProject[];
} {
  const evidenceProjects = buildWeeklyEvidenceProjects(days);
  const evidenceClusters = buildWeeklyEvidenceClusters(evidenceProjects);
  const trendCandidatesV2 = buildWeeklyTrendCandidatesV2(evidenceClusters, evidenceProjects);
  const trendCandidates = buildCompatibilityTrendCandidates(trendCandidatesV2, evidenceProjects);
  const fallbackReview = buildRulesFallbackWeeklyJudgment(days[days.length - 1]?.date ?? "", trendCandidatesV2, evidenceProjects);
  const judgment = buildWeeklyJudgmentReport(days, fallbackReview, "rules-only", [], {
    evidenceProjects,
    evidenceClusters,
    trendCandidates: trendCandidatesV2,
  });
  const compatibility = buildCompatibilityWeeklyReport(days, judgment, config);
  judgment.evidence_matrix = compatibility.report.evidence_matrix;

  const semanticInput: WeeklySemanticInputBundle = {
    window_start: compatibility.report.window_start,
    window_end: compatibility.report.window_end,
    scored_project_windows: days.map((day) => ({
      date: day.date,
      scored_projects: day.scored,
    })),
    trend_candidates: trendCandidates,
    weekly_focus_projects: compatibility.weeklyFocusProjects,
    user_interest_profile:
      config.sources.userInterestProfile ?? {
        enabled: false,
        topics: [],
      },
    agent_mode: compatibility.report.enhancement_status,
  };

  return {
    report: compatibility.report,
    audit: compatibility.audit,
    judgment,
    semanticInput,
    trendCandidates,
    trendCandidatesV2,
    fallbackReview,
    evidenceProjects,
    evidenceClusters,
    weeklyFocusProjects: compatibility.weeklyFocusProjects,
  };
}

type WeeklyArtifacts = ReturnType<typeof buildWeeklyArtifacts>;

interface WeeklyEnhancementSupportProjectDraft {
  repo_url: string;
  project_name: string;
  project_brief_cn?: string;
  why_this_week_cn?: string;
  personalization_reason_cn?: string;
  risk_review_note_cn?: string;
  watchlist_note_cn?: string;
}

interface WeeklyEnhancementCoreTrendCardDraft {
  trend_key: string;
  trend_name_cn?: string;
  trend_summary_cn?: string;
  evidence_summary_cn?: string;
  worth_following_next_week?: string;
  supporting_projects?: WeeklyEnhancementSupportProjectDraft[];
}

interface WeeklyEnhancementWeakSignalCardDraft {
  trend_key: string;
  signal_name_cn?: string;
  why_weak_cn?: string;
  evidence_summary_cn?: string;
  worth_following_next_week?: string;
}

interface WeeklyEnhancementFocusDraft {
  trend_key: string;
  personalization_reason_cn?: string;
}

interface WeeklyEnhancementDraft {
  overall_summary_cn?: string;
  supporting_trend_keys?: string[];
  core_trend_cards?: WeeklyEnhancementCoreTrendCardDraft[];
  weak_signal_cards?: WeeklyEnhancementWeakSignalCardDraft[];
  personalized_weekly_focus?: WeeklyEnhancementFocusDraft[];
  personalized_weekly_focus_note_cn?: string;
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

function hasInvalidMarkup(value: string): boolean {
  return /https?:\/\//i.test(value) || /\[[^\]]+\]\([^)]+\)/.test(value) || /[|]{2,}/.test(value);
}

function validateWeeklyProjectBriefText(
  project: WeeklySupportProject,
  semanticProject: WeeklySemanticInputProject | undefined,
  value: string,
): string | undefined {
  const normalized = normalizeValidationText(value);
  if (!normalized) return "missing_field";
  const compactLength = compactTextLength(value);
  if (compactLength < 30 || compactLength > 90) return "invalid_length";
  if (hasInvalidMarkup(value)) return "invalid_source_scope";
  if (includesAny(normalized, ["今天", "今日", "本周", "涨星", "风险", "watchlist", "观察清单"])) {
    return "invalid_source_scope";
  }
  if (includesAny(normalized, ["值得关注", "值得继续观察", "值得继续跟踪", "值得优先关注", "值得看"])) {
    return "invalid_source_scope";
  }
  const specificityReason = validateProjectBriefSpecificity(
    {
      project_name: project.project_name,
      repo_full_name: project.repo_url.replace(/^https?:\/\/github\.com\//i, ""),
      description: semanticProject?.description ?? "",
      tags: semanticProject?.tags ?? [],
      paradigm: semanticProject?.score.paradigm ?? project.trend_key,
      evidence: semanticProject?.score.components.flatMap((component) => component.evidence) ?? [],
    },
    value,
  );
  if (specificityReason) return specificityReason;
  return undefined;
}

function validateWeeklyWhyThisWeekText(project: WeeklySemanticInputProject, value: string): string | undefined {
  const normalized = normalizeValidationText(value);
  if (!normalized) return "missing_field";
  const compactLength = compactTextLength(value);
  if (compactLength < 30 || compactLength > 90) return "invalid_length";
  if (hasInvalidMarkup(value)) return "invalid_source_scope";
  if (includesAny(normalized, ["今天", "今日"])) return "invalid_source_scope";

  const sourceNames = project.sources.map((source) => source.toLowerCase());
  const mentionsGithub = normalized.includes("github");
  const mentionsTrendshift = normalized.includes("trendshift");
  const mentionsWatchlist = normalized.includes("watchlist") || normalized.includes("观察清单");

  if (mentionsGithub && !sourceNames.some((source) => source.includes("github"))) return "evidence_conflict";
  if (mentionsTrendshift && !sourceNames.some((source) => source.includes("trendshift"))) return "evidence_conflict";
  if (mentionsWatchlist && !project.tags.some((tag) => tag.toLowerCase() === "watchlist-hit")) return "evidence_conflict";

  return undefined;
}

function validateWeeklyPersonalizationText(matchedTopics: UserInterestTopicName[], value: string): string | undefined {
  if (!isNonEmptyString(value)) return "missing_field";
  const normalized = normalizeValidationText(value);
  if (matchedTopics.length === 0) return "not_applicable";
  if (!matchedTopics.some((topic) => normalized.includes(topic.toLowerCase()))) return "evidence_conflict";
  return undefined;
}

function validateWeeklyRiskReviewText(project: WeeklySupportProject, value: string): string | undefined {
  if (!isNonEmptyString(value)) return "missing_field";
  if (!project.risk_review_required) return "not_applicable";
  const normalized = normalizeValidationText(value);
  if (includesAny(normalized, ["没有风险", "可忽略风险", "风险很低", "无需谨慎", "完全可靠"])) {
    return "evidence_conflict";
  }
  return undefined;
}

function validateWeeklyWatchlistText(project: WeeklySupportProject, value: string): string | undefined {
  if (!isNonEmptyString(value)) return "missing_field";
  if (!project.watchlist_note_cn) return "not_applicable";
  const normalized = normalizeValidationText(value);
  if (!includesAny(normalized, ["跟踪", "观察", "watchlist", "更新"])) return "evidence_conflict";
  return undefined;
}

function validateWeakSignalField(field: "signal_name_cn" | "why_weak_cn" | "evidence_summary_cn" | "worth_following_next_week", value: string): string | undefined {
  const normalized = normalizeValidationText(value);
  if (!normalized) return "missing_field";
  if (hasInvalidMarkup(value)) return "invalid_source_scope";
  if (field === "why_weak_cn" && includesAny(normalized, ["已经形成稳定趋势", "已经是核心趋势", "核心趋势已经形成"])) {
    return "evidence_conflict";
  }
  return undefined;
}

function buildCompactWeeklyEnhancementBundle(bundle: WeeklySemanticInputBundle) {
  return {
    window_start: bundle.window_start,
    window_end: bundle.window_end,
    agent_mode: bundle.agent_mode,
    user_interest_profile: bundle.user_interest_profile,
    trend_candidates: bundle.trend_candidates.map((candidate) => ({
      trend_key: candidate.trend_key,
      matched_topics: candidate.matched_topics,
      matched_paradigm: candidate.matched_paradigm,
      distinct_repo_count: candidate.distinct_repo_count,
      appearance_dates: candidate.appearance_dates,
      shared_capability_tags: candidate.shared_capability_tags.slice(0, 8),
      evidence_notes: candidate.evidence_notes.slice(0, 4),
      candidate_strength: candidate.candidate_strength,
    })),
    weekly_focus_projects: bundle.weekly_focus_projects.slice(0, 24).map((project) => ({
      repo_url: project.repo_url,
      project_name: project.project_name,
      repo_full_name: project.repo_full_name,
      trend_key: project.trend_key,
      data_trust: project.data_trust,
      appearance_dates: project.appearance_dates,
      sources: project.sources,
      trust_flags: project.trust_flags,
      tags: project.tags.slice(0, 10),
      description: project.description,
      score: {
        paradigm: project.score.paradigm,
        components: project.score.components.map((component) => ({
          name: component.name,
          evidence: component.evidence.slice(0, 3),
        })),
        anti_noise_flags: project.score.anti_noise_flags,
        risks: project.score.risks,
      },
    })),
    scored_project_windows: bundle.scored_project_windows.map((window) => ({
      date: window.date,
      scored_projects: window.scored_projects
        .slice()
        .sort((a, b) => b.score.total_score - a.score.total_score)
        .slice(0, 8)
        .map((project) => ({
          repo_url: project.project.repo_url,
          repo_full_name: project.project.repo_full_name,
          project_name: project.project.project_name,
          sources: project.project.sources,
          appearance_dates: project.project.appearance_dates,
          tags: project.project.tags.slice(0, 10),
          description: project.project.description,
          trust_flags: project.project.trust_flags,
          score: {
            total_score: project.score.total_score,
            confidence: project.score.confidence,
            data_trust: project.score.data_trust,
            paradigm: project.score.paradigm,
            verdict: project.score.verdict,
            anti_noise_flags: project.score.anti_noise_flags,
            risks: project.score.risks,
          },
        })),
    })),
  };
}

function buildCompactWeeklyEnhancementReport(report: WeeklyReport) {
  return {
    date: report.date,
    generated_at: report.generated_at,
    window_start: report.window_start,
    window_end: report.window_end,
    enhancement_status: report.enhancement_status,
    overall_summary_cn: report.overall_summary_cn,
    supporting_trend_keys: report.supporting_trend_keys,
    core_trend_cards: report.core_trend_cards.map((card) => ({
      trend_key: card.trend_key,
      trend_name_cn: card.trend_name_cn,
      trend_summary_cn: card.trend_summary_cn,
      evidence_summary_cn: card.evidence_summary_cn,
      strength: card.strength,
      worth_following_next_week: card.worth_following_next_week,
      supporting_projects: card.supporting_projects.map((project) => ({
        repo_url: project.repo_url,
        project_name: project.project_name,
        project_class: project.project_class,
        matched_interest_topics: project.matched_interest_topics,
        project_brief_cn: project.project_brief_cn,
        why_this_week_cn: project.why_this_week_cn,
        personalization_reason_cn: project.personalization_reason_cn,
        risk_review_required: project.risk_review_required,
        risk_review_note_cn: project.risk_review_note_cn,
        watchlist_note_cn: project.watchlist_note_cn,
      })),
    })),
    weak_signal_cards: report.weak_signal_cards.map((card) => ({
      trend_key: card.trend_key,
      signal_name_cn: card.signal_name_cn,
      why_weak_cn: card.why_weak_cn,
      evidence_summary_cn: card.evidence_summary_cn,
      worth_following_next_week: card.worth_following_next_week,
    })),
    personalized_weekly_focus_applicable: report.personalized_weekly_focus_applicable,
    personalized_weekly_focus_note_cn: report.personalized_weekly_focus_note_cn,
    personalized_weekly_focus: report.personalized_weekly_focus.map((focus) => ({
      trend_key: focus.trend_key,
      matched_interest_topics: focus.matched_interest_topics,
      personalization_reason_cn: focus.personalization_reason_cn,
    })),
  };
}

function buildWeeklyEnhancementPrompt(bundle: WeeklySemanticInputBundle, report: WeeklyReport): string {
  const compactBundle = buildCompactWeeklyEnhancementBundle(bundle);
  const compactReport = buildCompactWeeklyEnhancementReport(report);

  return [
    "You are writing the human-language enhancement layer for agent-radar weekly reports.",
    "Return JSON only. Do not use markdown fences.",
    "Use only fields present in the input bundle and the structural keys already present in the report skeleton.",
    "Do not invent new facts or refer to extra sources.",
    "Keep the 7-day score window as scored_project_windows with date plus scored_projects; do not flatten it into a single list.",
    "Write supporting project project_brief_cn with project evidence first: consume description, tags, repo name semantics, and classification evidence before falling back to broad paradigm language.",
    "Each supporting project project_brief_cn must explain what the project actually does for a normal user, with 1-2 concrete capabilities when the input supports them.",
    'Prefer concrete product words such as "代码编辑器", "IDE", "工作台", "搜索工具", "终端助手", "工作流框架" over abstract jargon like "基础设施层" or "运行时能力" when both are supported by the input.',
    'When the evidence is sufficient, write supporting project project_brief_cn in a plain structure close to "这是什么 + 它主要帮人做什么 + 大家通常拿它来干什么".',
    'Do not say "当前项目信息不足" or "缺少明确的功能描述" unless description, tags, repo name semantics, and classification evidence all still fail to reveal the project function.',
    "Avoid homogeneous family-only copy such as '这是一个 AI 代理调度后台'. Different projects in the same response should not reuse the same brief.",
    "Each supporting project project_brief_cn should be an easy-to-read Chinese paragraph around 50-80 characters, ideally using plain language plus 1-2 concrete use cases.",
    "Each why_this_week_cn should be an easy-to-read Chinese paragraph around 50-80 characters, preferably explaining in plain language why the project matters this week.",
    "If you provide overall_summary_cn, also provide supporting_trend_keys that are a non-empty subset of the existing core_trend_cards[].trend_key values.",
    "",
    "Output schema:",
    "{",
    '  "overall_summary_cn"?: string,',
    '  "supporting_trend_keys"?: string[],',
    '  "core_trend_cards"?: [',
    "    {",
    '      "trend_key": string,',
    '      "trend_name_cn"?: string,',
    '      "trend_summary_cn"?: string,',
    '      "evidence_summary_cn"?: string,',
    '      "worth_following_next_week"?: string,',
    '      "supporting_projects"?: [',
    "        {",
    '          "repo_url": string,',
    '          "project_name": string,',
    '          "project_brief_cn"?: string,',
    '          "why_this_week_cn"?: string,',
    '          "personalization_reason_cn"?: string,',
    '          "risk_review_note_cn"?: string,',
    '          "watchlist_note_cn"?: string',
    "        }",
    "      ]",
    "    }",
    "  ],",
    '  "weak_signal_cards"?: [',
    "    {",
    '      "trend_key": string,',
    '      "signal_name_cn"?: string,',
    '      "why_weak_cn"?: string,',
    '      "evidence_summary_cn"?: string,',
    '      "worth_following_next_week"?: string',
    "    }",
    "  ],",
    '  "personalized_weekly_focus"?: [',
    "    {",
    '      "trend_key": string,',
    '      "personalization_reason_cn"?: string',
    "    }",
    "  ],",
    '  "personalized_weekly_focus_note_cn"?: string',
    "}",
    "",
    "Input bundle:",
    JSON.stringify({ bundle: compactBundle, report_skeleton: compactReport }, null, 2),
  ].join("\n");
}

function buildWeeklyEnhancementDraft(raw: unknown): WeeklyEnhancementDraft | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Record<string, unknown>;

  const coreTrendCards = Array.isArray(record.core_trend_cards)
    ? record.core_trend_cards
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : undefined))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          trend_key: isNonEmptyString(item.trend_key) ? item.trend_key.trim() : "",
          trend_name_cn: isNonEmptyString(item.trend_name_cn) ? item.trend_name_cn.trim() : undefined,
          trend_summary_cn: isNonEmptyString(item.trend_summary_cn) ? item.trend_summary_cn.trim() : undefined,
          evidence_summary_cn: isNonEmptyString(item.evidence_summary_cn) ? item.evidence_summary_cn.trim() : undefined,
          worth_following_next_week: isNonEmptyString(item.worth_following_next_week)
            ? item.worth_following_next_week.trim()
            : undefined,
          supporting_projects: Array.isArray(item.supporting_projects)
            ? item.supporting_projects
                .map((project) => (project && typeof project === "object" ? (project as Record<string, unknown>) : undefined))
                .filter((project): project is Record<string, unknown> => Boolean(project))
                .map((project) => ({
                  repo_url: isNonEmptyString(project.repo_url) ? project.repo_url.trim() : "",
                  project_name: isNonEmptyString(project.project_name) ? project.project_name.trim() : "",
                  project_brief_cn: isNonEmptyString(project.project_brief_cn) ? project.project_brief_cn.trim() : undefined,
                  why_this_week_cn: isNonEmptyString(project.why_this_week_cn) ? project.why_this_week_cn.trim() : undefined,
                  personalization_reason_cn: isNonEmptyString(project.personalization_reason_cn)
                    ? project.personalization_reason_cn.trim()
                    : undefined,
                  risk_review_note_cn: isNonEmptyString(project.risk_review_note_cn) ? project.risk_review_note_cn.trim() : undefined,
                  watchlist_note_cn: isNonEmptyString(project.watchlist_note_cn) ? project.watchlist_note_cn.trim() : undefined,
                }))
                .filter((project) => project.repo_url.length > 0 && project.project_name.length > 0)
            : [],
        }))
        .filter((item) => item.trend_key.length > 0)
    : [];

  const weakSignalCards = Array.isArray(record.weak_signal_cards)
    ? record.weak_signal_cards
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : undefined))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          trend_key: isNonEmptyString(item.trend_key) ? item.trend_key.trim() : "",
          signal_name_cn: isNonEmptyString(item.signal_name_cn) ? item.signal_name_cn.trim() : undefined,
          why_weak_cn: isNonEmptyString(item.why_weak_cn) ? item.why_weak_cn.trim() : undefined,
          evidence_summary_cn: isNonEmptyString(item.evidence_summary_cn) ? item.evidence_summary_cn.trim() : undefined,
          worth_following_next_week: isNonEmptyString(item.worth_following_next_week)
            ? item.worth_following_next_week.trim()
            : undefined,
        }))
        .filter((item) => item.trend_key.length > 0)
    : [];

  const personalizedWeeklyFocus = Array.isArray(record.personalized_weekly_focus)
    ? record.personalized_weekly_focus
        .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : undefined))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          trend_key: isNonEmptyString(item.trend_key) ? item.trend_key.trim() : "",
          personalization_reason_cn: isNonEmptyString(item.personalization_reason_cn)
            ? item.personalization_reason_cn.trim()
            : undefined,
        }))
        .filter((item) => item.trend_key.length > 0)
    : [];

  return {
    overall_summary_cn: isNonEmptyString(record.overall_summary_cn) ? record.overall_summary_cn.trim() : undefined,
    supporting_trend_keys: Array.isArray(record.supporting_trend_keys)
      ? record.supporting_trend_keys.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
      : undefined,
    core_trend_cards: coreTrendCards,
    weak_signal_cards: weakSignalCards,
    personalized_weekly_focus: personalizedWeeklyFocus,
    personalized_weekly_focus_note_cn: isNonEmptyString(record.personalized_weekly_focus_note_cn)
      ? record.personalized_weekly_focus_note_cn.trim()
      : undefined,
  };
}

function mergeEnhancementStatus(left: EnhancementStatus, right: EnhancementStatus): EnhancementStatus {
  if (left === "rules-only" && right === "rules-only") return "rules-only";
  if (left === "agent-full" && right === "agent-full") return "agent-full";
  return "agent-partial";
}

function applyWeeklyEnhancement(
  report: WeeklyReport,
  draft: WeeklyEnhancementDraft,
  semanticBundle: WeeklySemanticInputBundle,
): { enhancementStatus: EnhancementStatus; rejectedOutputs: RejectedOutput[] } {
  const coreByKey = new Map(report.core_trend_cards.map((card) => [card.trend_key, card] as const));
  const weakByKey = new Map(report.weak_signal_cards.map((card) => [card.trend_key, card] as const));
  const focusByKey = new Map(report.personalized_weekly_focus.map((focus) => [focus.trend_key, focus] as const));
  const semanticProjectByRepo = new Map(
    semanticBundle.weekly_focus_projects.map((project) => [project.repo_url.toLowerCase(), project] as const),
  );
  const rejectedOutputs: RejectedOutput[] = [];
  const acceptedProjectBriefs = new Map<string, string>();
  let applicableCount = 0;
  let agentCount = 0;
  const summaryText = draft.overall_summary_cn;

  if (summaryReferencesCoreTrends(summaryText ?? "", draft.supporting_trend_keys, report.core_trend_cards)) {
    report.overall_summary_cn = summaryText!.trim();
    agentCount += 1;
  } else {
    rejectedOutputs.push(rejection("weekly_summary", report.window_end, "overall_summary_cn fell back to template rules."));
  }
  applicableCount += 1;

  for (const card of report.core_trend_cards) {
    const draftCard = draft.core_trend_cards?.find((item) => item.trend_key === card.trend_key);
    const cardAccepted =
      isNonEmptyString(draftCard?.trend_name_cn) ||
      isNonEmptyString(draftCard?.trend_summary_cn) ||
      isNonEmptyString(draftCard?.evidence_summary_cn) ||
      isNonEmptyString(draftCard?.worth_following_next_week);

    if (isNonEmptyString(draftCard?.trend_name_cn)) {
      card.trend_name_cn = draftCard.trend_name_cn.trim();
      agentCount += 1;
    } else {
      rejectedOutputs.push(rejection("core_trend_card", card.trend_key, "trend_name_cn fell back to template rules."));
    }
    if (isNonEmptyString(draftCard?.trend_summary_cn)) {
      card.trend_summary_cn = draftCard.trend_summary_cn.trim();
      agentCount += 1;
    } else {
      rejectedOutputs.push(rejection("core_trend_card", card.trend_key, "trend_summary_cn fell back to template rules."));
    }
    if (isNonEmptyString(draftCard?.evidence_summary_cn)) {
      card.evidence_summary_cn = draftCard.evidence_summary_cn.trim();
      agentCount += 1;
    } else {
      rejectedOutputs.push(rejection("core_trend_card", card.trend_key, "evidence_summary_cn fell back to template rules."));
    }
    if (isNonEmptyString(draftCard?.worth_following_next_week)) {
      card.worth_following_next_week = draftCard.worth_following_next_week.trim();
      agentCount += 1;
    } else {
      rejectedOutputs.push(rejection("core_trend_card", card.trend_key, "worth_following_next_week fell back to template rules."));
    }

    for (const project of card.supporting_projects) {
      const draftProject = draftCard?.supporting_projects?.find((item) => item.repo_url === project.repo_url);
      const semanticProject = semanticProjectByRepo.get(project.repo_url.toLowerCase());
      const briefReason = draftProject?.project_brief_cn
        ? validateWeeklyProjectBriefText(project, semanticProject, draftProject.project_brief_cn)
        : "missing_field";
      const whyReason =
        draftProject?.why_this_week_cn && semanticProject
          ? validateWeeklyWhyThisWeekText(semanticProject, draftProject.why_this_week_cn)
          : "missing_field";
      const personalizationReason =
        project.personalization_reason_cn && draftProject?.personalization_reason_cn
          ? validateWeeklyPersonalizationText(project.matched_interest_topics, draftProject.personalization_reason_cn)
          : project.personalization_reason_cn
            ? "missing_field"
            : "not_applicable";
      const riskReason =
        project.risk_review_required && draftProject?.risk_review_note_cn
          ? validateWeeklyRiskReviewText(project, draftProject.risk_review_note_cn)
          : project.risk_review_required
            ? "missing_field"
            : "not_applicable";
      const watchlistReason =
        project.watchlist_note_cn && draftProject?.watchlist_note_cn
          ? validateWeeklyWatchlistText(project, draftProject.watchlist_note_cn)
          : project.watchlist_note_cn
            ? "missing_field"
            : "not_applicable";
      const duplicateBriefRepo =
        draftProject?.project_brief_cn ? acceptedProjectBriefs.get(normalizeBriefForComparison(draftProject.project_brief_cn)) : undefined;
      const briefAccepted = briefReason === undefined && !duplicateBriefRepo;
      const whyAccepted = whyReason === undefined;
      const personalizationAccepted = Boolean(project.personalization_reason_cn) && personalizationReason === undefined;
      const riskAccepted = Boolean(project.risk_review_required) && riskReason === undefined;
      const watchlistAccepted = Boolean(project.watchlist_note_cn) && watchlistReason === undefined;

      applicableCount += 2 + (project.personalization_reason_cn ? 1 : 0) + (project.risk_review_required ? 1 : 0) + (project.watchlist_note_cn ? 1 : 0);
      agentCount += (briefAccepted ? 1 : 0) + (whyAccepted ? 1 : 0) + (personalizationAccepted ? 1 : 0) + (riskAccepted ? 1 : 0) + (watchlistAccepted ? 1 : 0);

      if (briefAccepted) {
        project.project_brief_cn = draftProject!.project_brief_cn!.trim();
        acceptedProjectBriefs.set(normalizeBriefForComparison(draftProject!.project_brief_cn!), project.repo_url);
      }
      if (whyAccepted) project.why_this_week_cn = draftProject!.why_this_week_cn!.trim();
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
      if (briefAccepted && whyAccepted) {
        project.enhancement_source = enhancementSourceForProject(briefAccepted && whyAccepted);
      }

      if (!briefAccepted) {
        rejectedOutputs.push({
          layer: "weekly_support_project",
          target_key: project.repo_url,
          reason_code: duplicateBriefRepo ? "homogeneous_copy" : (briefReason ?? "template_fallback"),
          reason_detail: duplicateBriefRepo
            ? `project_brief_cn fell back to template rules (homogeneous_copy with ${duplicateBriefRepo}).`
            : `project_brief_cn fell back to template rules (${briefReason ?? "template_fallback"}).`,
        });
      }
      if (!whyAccepted) {
        rejectedOutputs.push({
          layer: "weekly_support_project",
          target_key: project.repo_url,
          reason_code: whyReason ?? "template_fallback",
          reason_detail: `why_this_week_cn fell back to template rules (${whyReason ?? "template_fallback"}).`,
        });
      }
      if (project.personalization_reason_cn && !personalizationAccepted) {
        rejectedOutputs.push({
          layer: "weekly_support_project",
          target_key: project.repo_url,
          reason_code: personalizationReason ?? "template_fallback",
          reason_detail: `personalization_reason_cn fell back to template rules (${personalizationReason ?? "template_fallback"}).`,
        });
      }
      if (project.risk_review_required && !riskAccepted) {
        rejectedOutputs.push({
          layer: "weekly_support_project",
          target_key: project.repo_url,
          reason_code: riskReason ?? "template_fallback",
          reason_detail: `risk_review_note_cn fell back to template rules (${riskReason ?? "template_fallback"}).`,
        });
      }
      if (project.watchlist_note_cn && !watchlistAccepted) {
        rejectedOutputs.push({
          layer: "weekly_support_project",
          target_key: project.repo_url,
          reason_code: watchlistReason ?? "template_fallback",
          reason_detail: `watchlist_note_cn fell back to template rules (${watchlistReason ?? "template_fallback"}).`,
        });
      }
    }

    if (cardAccepted) {
      // already counted per field above
    }
  }

  for (const card of report.weak_signal_cards) {
    const draftCard = draft.weak_signal_cards?.find((item) => item.trend_key === card.trend_key);
    const nameReason = draftCard?.signal_name_cn ? validateWeakSignalField("signal_name_cn", draftCard.signal_name_cn) : "missing_field";
    const whyReason = draftCard?.why_weak_cn ? validateWeakSignalField("why_weak_cn", draftCard.why_weak_cn) : "missing_field";
    const evidenceReason = draftCard?.evidence_summary_cn
      ? validateWeakSignalField("evidence_summary_cn", draftCard.evidence_summary_cn)
      : "missing_field";
    const worthReason = draftCard?.worth_following_next_week
      ? validateWeakSignalField("worth_following_next_week", draftCard.worth_following_next_week)
      : "missing_field";
    const nameAccepted = nameReason === undefined;
    const whyAccepted = whyReason === undefined;
    const evidenceAccepted = evidenceReason === undefined;
    const worthAccepted = worthReason === undefined;

    applicableCount += 4;
    agentCount += (nameAccepted ? 1 : 0) + (whyAccepted ? 1 : 0) + (evidenceAccepted ? 1 : 0) + (worthAccepted ? 1 : 0);

    if (nameAccepted) card.signal_name_cn = draftCard!.signal_name_cn!.trim();
    else {
      rejectedOutputs.push({
        layer: "weak_signal_card",
        target_key: card.trend_key,
        reason_code: nameReason ?? "template_fallback",
        reason_detail: `signal_name_cn fell back to template rules (${nameReason ?? "template_fallback"}).`,
      });
    }
    if (whyAccepted) card.why_weak_cn = draftCard!.why_weak_cn!.trim();
    else {
      rejectedOutputs.push({
        layer: "weak_signal_card",
        target_key: card.trend_key,
        reason_code: whyReason ?? "template_fallback",
        reason_detail: `why_weak_cn fell back to template rules (${whyReason ?? "template_fallback"}).`,
      });
    }
    if (evidenceAccepted) card.evidence_summary_cn = draftCard!.evidence_summary_cn!.trim();
    else {
      rejectedOutputs.push({
        layer: "weak_signal_card",
        target_key: card.trend_key,
        reason_code: evidenceReason ?? "template_fallback",
        reason_detail: `evidence_summary_cn fell back to template rules (${evidenceReason ?? "template_fallback"}).`,
      });
    }
    if (worthAccepted) card.worth_following_next_week = draftCard!.worth_following_next_week!.trim();
    else {
      rejectedOutputs.push({
        layer: "weak_signal_card",
        target_key: card.trend_key,
        reason_code: worthReason ?? "template_fallback",
        reason_detail: `worth_following_next_week fell back to template rules (${worthReason ?? "template_fallback"}).`,
      });
    }
  }

  const enabledFocus = report.personalized_weekly_focus.length > 0;
  if (enabledFocus) {
    for (const focus of report.personalized_weekly_focus) {
      const draftFocus = draft.personalized_weekly_focus?.find((item) => item.trend_key === focus.trend_key);
      applicableCount += 1;
      const personalizationReason = draftFocus?.personalization_reason_cn;
      const focusReason = personalizationReason
        ? validateWeeklyPersonalizationText(focus.matched_interest_topics, personalizationReason)
        : "missing_field";
      if (focusReason === undefined) {
        focus.personalization_reason_cn = personalizationReason!.trim();
        agentCount += 1;
      } else {
        rejectedOutputs.push({
          layer: "personalized_weekly_focus",
          target_key: focus.trend_key,
          reason_code: focusReason ?? "template_fallback",
          reason_detail: `personalization_reason_cn fell back to template rules (${focusReason ?? "template_fallback"}).`,
        });
      }
    }
  }

  if (personalizedFocusApplicable(report) && report.personalized_weekly_focus.length === 0) {
    applicableCount += 1;
    if (isNonEmptyString(draft.personalized_weekly_focus_note_cn)) {
      report.personalized_weekly_focus_note_cn = draft.personalized_weekly_focus_note_cn.trim();
      agentCount += 1;
    } else {
      rejectedOutputs.push(
        rejection(
          "personalized_weekly_focus",
          report.window_end,
          "no-match personalization note fell back to template rules.",
        ),
      );
    }
  }

  const enhancementStatus: EnhancementStatus =
    agentCount === 0 ? "rules-only" : agentCount === applicableCount ? "agent-full" : "agent-partial";

  void coreByKey;
  void weakByKey;
  void focusByKey;

  return { enhancementStatus, rejectedOutputs };
}

export async function buildWeeklyArtifactsWithEnhancement(days: WindowDay[], config: AppConfig): Promise<{
  report: WeeklyReport;
  audit: WeeklyAuditReport;
  judgment: WeeklyJudgmentReport;
  semanticInput: WeeklySemanticInputBundle;
  trendCandidates: WeeklyTrendCandidate[];
  trendCandidatesV2: WeeklyTrendCandidateV2[];
  fallbackReview: WeeklyTrendAgentReview;
  evidenceProjects: WeeklyEvidenceProject[];
  evidenceClusters: WeeklyEvidenceCluster[];
  weeklyFocusProjects: WeeklySemanticInputProject[];
}> {
  await warmMissingProjectDescriptions(days.flatMap((day) => day.scored));
  const artifacts = buildWeeklyArtifacts(days, config);
  if (!isEnhancementEnabled(config)) return artifacts;

  const draftRaw = await callStructuredEnhancement<unknown>(
    buildWeeklyTrendAgentPrompt(
      artifacts.trendCandidatesV2,
      artifacts.evidenceClusters,
      artifacts.evidenceProjects,
      artifacts.fallbackReview,
    ),
    config,
    { maxTokens: 4096 },
  );
  const reviewDraft = draftRaw ? buildWeeklyTrendAgentReviewDraft(draftRaw) : undefined;

  if (reviewDraft) {
    const reviewed = applyWeeklyTrendAgentReview(artifacts.fallbackReview, reviewDraft, {
      candidates: artifacts.trendCandidatesV2,
      projects: artifacts.evidenceProjects,
    });
    artifacts.judgment = buildWeeklyJudgmentReport(
      days,
      reviewed.review,
      reviewed.enhancementStatus,
      reviewed.rejectedOutputs,
      {
        evidenceProjects: artifacts.evidenceProjects,
        evidenceClusters: artifacts.evidenceClusters,
        trendCandidates: artifacts.trendCandidatesV2,
      },
    );
    const compatibility = buildCompatibilityWeeklyReport(days, artifacts.judgment, config);
    artifacts.judgment.evidence_matrix = compatibility.report.evidence_matrix;
    artifacts.report = compatibility.report;
    artifacts.audit = compatibility.audit;
    artifacts.weeklyFocusProjects = compatibility.weeklyFocusProjects;
    artifacts.semanticInput.weekly_focus_projects = compatibility.weeklyFocusProjects;
    artifacts.semanticInput.agent_mode = compatibility.report.enhancement_status;
    await applyWeeklyNarrativeEnhancement(artifacts, config);
    return artifacts;
  }

  await applyWeeklyNarrativeEnhancement(artifacts, config, draftRaw);
  return artifacts;
}

async function applyWeeklyNarrativeEnhancement(
  artifacts: WeeklyArtifacts,
  config: AppConfig,
  draftRaw?: unknown,
): Promise<void> {
  const raw =
    draftRaw ??
    (await callStructuredEnhancement<unknown>(buildWeeklyEnhancementPrompt(artifacts.semanticInput, artifacts.report), config, {
      maxTokens: 4096,
    }));
  const draft = raw ? buildWeeklyEnhancementDraft(raw) : undefined;
  if (!draft) return;

  const applied = applyWeeklyEnhancement(artifacts.report, draft, artifacts.semanticInput);
  const mergedStatus = mergeEnhancementStatus(artifacts.report.enhancement_status, applied.enhancementStatus);
  const mergedRejectedOutputs = [
    ...(artifacts.report.enhancement_audit?.rejected_outputs ?? []),
    ...applied.rejectedOutputs,
  ];

  artifacts.report.enhancement_status = mergedStatus;
  artifacts.report.enhancement_audit = { rejected_outputs: mergedRejectedOutputs };
  artifacts.report.core_trend_cards = attachCoreTrendEvidenceMatrices(artifacts.report.core_trend_cards, artifacts.weeklyFocusProjects);
  artifacts.report.evidence_matrix = buildWeeklyEvidenceMatrix(artifacts.report, artifacts.weeklyFocusProjects);
  artifacts.judgment.enhancement_status = mergedStatus;
  artifacts.judgment.executive_summary_cn = artifacts.report.overall_summary_cn;
  artifacts.judgment.evidence_matrix = artifacts.report.evidence_matrix;
  artifacts.judgment.enhancement_audit = { rejected_outputs: mergedRejectedOutputs };
  artifacts.audit = {
    enhancement_status: mergedStatus,
    personalized_weekly_focus: artifacts.report.personalized_weekly_focus,
    rejected_outputs: mergedRejectedOutputs,
  };
}

export function renderCoreTrendCard(card: CoreTrendCard): string[] {
  return [
    `- 趋势: ${card.trend_name_cn} [${card.trend_key}]`,
    `  - 总结: ${card.trend_summary_cn}`,
    `  - 证据: ${card.evidence_summary_cn}`,
    `  - 强度: ${card.strength}`,
    `  - 下周是否继续跟进: ${card.worth_following_next_week}`,
    ...card.supporting_projects.flatMap((project) => [
      `  - [${project.project_name}](${project.repo_url})`,
      `    - 这个项目是做什么的: ${project.project_brief_cn}`,
      `    - 为什么这周值得记住: ${project.why_this_week_cn}`,
      `    - enhancement_source: ${project.enhancement_source}`,
      ...(project.personalization_reason_cn ? [`    - personalization_reason_cn: ${project.personalization_reason_cn}`] : []),
      ...(project.risk_review_required ? [`    - risk_review_required: true`] : []),
      ...(project.risk_review_note_cn ? [`    - risk_review_note_cn: ${project.risk_review_note_cn}`] : []),
      ...(project.risk_review_source ? [`    - risk_review_source: ${project.risk_review_source}`] : []),
      ...(project.watchlist_note_cn ? [`    - watchlist_note_cn: ${project.watchlist_note_cn}`] : []),
    ]),
  ];
}

export function renderWeakSignalCard(card: WeakSignalCard): string[] {
  return [
    `- ${card.signal_name_cn} [${card.trend_key}]`,
    `  - 为什么它还是弱信号: ${card.why_weak_cn}`,
    `  - 证据: ${card.evidence_summary_cn}`,
    `  - 下周是否继续跟进: ${card.worth_following_next_week}`,
  ];
}
