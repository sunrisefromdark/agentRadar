import { buildProjectBriefFromScoredProject } from "./projectBriefs.ts";
import type {
  DailyReport,
  DailyReportProjectDetail,
  FinalWeeklyTrend,
  FinalWeeklyTrendObservation,
  ScoredProject,
  UserInterestTopicName,
  WeeklyTrendAgentReview,
  WeeklyTrendCandidateV2,
  WeeklyAuditConclusion,
  WeeklyEvidenceCluster,
  WeeklyEvidenceProject,
} from "../types.ts";

type WindowDay = {
  date: string;
  scored: ScoredProject[];
  daily: DailyReport;
};

type VisibleProject = ScoredProject & DailyReportProjectDetail;

const TOPIC_KEYWORDS: Record<UserInterestTopicName, string[]> = {
  "agent-runtime": ["agent", "runtime", "orchestrat", "sandbox", "workflow", "autonomy"],
  memory: ["memory", "context", "retrieval", "remember", "persistent"],
  "coding-agent": ["coding", "code", "agent", "autonomous developer", "repo"],
  infra: ["infra", "infrastructure", "platform", "sdk", "framework", "gateway", "router", "mcp"],
  evaluation: ["eval", "evaluation", "benchmark", "judge", "quality", "review"],
  mcp: ["mcp", "model context protocol", "tooling", "tool-use"],
};

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
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

function matchTopics(text: string): UserInterestTopicName[] {
  const matches: UserInterestTopicName[] = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS) as Array<[UserInterestTopicName, string[]]>) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      matches.push(topic);
    }
  }
  return unique(matches);
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

function sharedCapabilitiesFromProjects(projects: WeeklyEvidenceProject[]): string[] {
  return unique(
    projects.flatMap((project) =>
      project.tags.filter((tag) => /runtime|memory|skill|mcp|coding|workflow|eval|tool/i.test(tag.toLowerCase())),
    ),
  ).sort();
}

function sharedParadigmsFromProjects(projects: WeeklyEvidenceProject[]): string[] {
  return unique(
    projects.flatMap((project) =>
      project.paradigm
        .split("+")
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean),
    ),
  ).sort();
}

function detectClusterConflicts(projects: WeeklyEvidenceProject[]): string[] {
  const paradigms = sharedParadigmsFromProjects(projects);
  const conflictPairs = [
    ["agent runtime", "coding workflow"],
    ["agent runtime", "ordinary ai tool"],
    ["persistent memory", "coding workflow"],
  ] as const;

  return conflictPairs
    .filter(([left, right]) => paradigms.includes(left) && paradigms.includes(right))
    .map(([left, right]) => `conflict=${left}::${right}`);
}

function calculateCoverageScore(cluster: WeeklyEvidenceCluster): number {
  return Math.min(100, cluster.distinct_repo_count * 20 + cluster.appearance_day_count * 10);
}

function calculateCohesionScore(cluster: WeeklyEvidenceCluster): number {
  const penalty = cluster.counter_evidence_refs.length * 15;
  return Math.max(0, Math.min(100, 85 - penalty + cluster.shared_capabilities.length * 5));
}

function calculateNoveltyScore(cluster: WeeklyEvidenceCluster): number {
  return Math.min(100, 40 + cluster.shared_capabilities.length * 10 + cluster.shared_paradigms.length * 5);
}

function calculateReliabilityScore(cluster: WeeklyEvidenceCluster): number {
  const averageProjectScore =
    cluster.supporting_projects.length > 0
      ? cluster.supporting_projects.reduce((sum, project) => sum + project.total_score, 0) / cluster.supporting_projects.length
      : 0;
  const trustBase = averageProjectScore * 0.6 + cluster.high_confidence_project_count * 10 + cluster.repeated_project_count * 8;
  const penalty = cluster.counter_evidence_refs.length * 10;
  return Math.max(0, Math.min(100, trustBase - penalty));
}

function buildClusterHypothesis(cluster: WeeklyEvidenceCluster): string {
  const capabilities = cluster.shared_capabilities.slice(0, 3).join(" + ");
  if (capabilities) {
    return `${cluster.seed_labels[0]} is converging around ${capabilities}.`;
  }
  if (cluster.shared_paradigms.length > 0) {
    return `${cluster.seed_labels[0]} is reappearing through a shared ${cluster.shared_paradigms[0]} pattern.`;
  }
  return `${cluster.seed_labels[0]} is repeating across this weekly window.`;
}

function inferRuleVerdict(input: {
  coverageScore: number;
  cohesionScore: number;
  reliabilityScore: number;
  counterEvidenceCount: number;
  distinctRepoCount: number;
  appearanceDayCount: number;
}): WeeklyTrendCandidateV2["rule_verdict"] {
  if (input.counterEvidenceCount >= 2 || input.cohesionScore < 40) return "mixed";
  if (
    input.distinctRepoCount >= 2 &&
    input.appearanceDayCount >= 2 &&
    input.coverageScore >= 55 &&
    input.reliabilityScore >= 70
  ) {
    return "likely-trend";
  }
  if (input.coverageScore >= 30 || input.reliabilityScore >= 40) return "watch";
  return "reject";
}

export function buildWeeklyEvidenceProjects(days: WindowDay[]): WeeklyEvidenceProject[] {
  const seen = new Map<string, WeeklyEvidenceProject>();

  for (const day of days) {
    for (const project of visibleProjectsForDay(day)) {
      const key = project.project.repo_full_name.toLowerCase();
      const existing = seen.get(key);
      const matchedTopics = matchTopics(
        normalizeText(
          project.project.project_name,
          project.project.repo_full_name,
          project.project.description,
          project.score.paradigm,
          ...project.project.tags,
        ),
      );

      const next: WeeklyEvidenceProject = {
        repo_url: project.project.repo_url,
        repo_full_name: project.project.repo_full_name,
        project_name: project.project.project_name,
        description: project.project.description,
        appearance_dates: [...new Set([...(existing?.appearance_dates ?? []), day.date, ...project.project.appearance_dates])].sort(),
        appearances: Math.max(existing?.appearances ?? 0, project.project.appearances),
        persistence_state: project.project.persistence_state,
        sources: [...new Set([...(existing?.sources ?? []), ...project.project.sources])],
        tags: [...new Set([...(existing?.tags ?? []), ...project.project.tags])],
        matched_topics: [...new Set([...(existing?.matched_topics ?? []), ...matchedTopics])],
        paradigm: project.score.paradigm,
        confidence: project.score.confidence,
        total_score: Math.max(existing?.total_score ?? 0, project.score.total_score),
        data_trust: project.score.data_trust,
        anti_noise_flags: [...new Set([...(existing?.anti_noise_flags ?? []), ...project.score.anti_noise_flags])],
        risks: [...new Set([...(existing?.risks ?? []), ...project.score.risks])],
        components: project.score.components,
        evidence_snippets: unique([
          ...(existing?.evidence_snippets ?? []),
          ...project.score.components.flatMap((component) => component.evidence),
        ]),
      };

      seen.set(key, next);
    }
  }

  return [...seen.values()];
}

export function buildWeeklyEvidenceClusters(projects: WeeklyEvidenceProject[]): WeeklyEvidenceCluster[] {
  const buckets = new Map<string, WeeklyEvidenceProject[]>();

  for (const project of projects) {
    const labels = [
      ...project.tags.filter((tag) => /runtime|memory|skill|mcp|coding|workflow|eval|tool/i.test(tag)),
      ...project.paradigm.split("+").map((part) => part.trim().toLowerCase()),
    ]
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    for (const label of new Set(labels)) {
      const existing = buckets.get(label) ?? [];
      existing.push(project);
      buckets.set(label, existing);
    }
  }

  return [...buckets.entries()].map(([label, supportingProjects]) => {
    const uniqueProjects = [...new Map(supportingProjects.map((project) => [project.repo_full_name.toLowerCase(), project] as const)).values()];
    return {
      cluster_id: `cluster-${label.replace(/[^a-z0-9]+/g, "-")}`,
      seed_labels: [label],
      shared_capabilities: sharedCapabilitiesFromProjects(uniqueProjects),
      shared_paradigms: sharedParadigmsFromProjects(uniqueProjects),
      supporting_projects: uniqueProjects,
      repeated_project_count: uniqueProjects.filter((project) => project.appearance_dates.length >= 2).length,
      distinct_repo_count: uniqueProjects.length,
      appearance_day_count: new Set(uniqueProjects.flatMap((project) => project.appearance_dates)).size,
      high_confidence_project_count: uniqueProjects.filter((project) => project.confidence === "high").length,
      evidence_refs: uniqueProjects.flatMap((project) =>
        project.evidence_snippets.slice(0, 3).map((snippet) => `${project.repo_full_name}::${snippet}`),
      ),
      counter_evidence_refs: detectClusterConflicts(uniqueProjects),
      uncovered_project_refs: [],
    };
  });
}

export function buildWeeklyTrendCandidatesV2(
  clusters: WeeklyEvidenceCluster[],
  projects: WeeklyEvidenceProject[],
): WeeklyTrendCandidateV2[] {
  return clusters.map((cluster) => {
    const supportingRefs = cluster.supporting_projects.map((project) => project.repo_full_name);
    const coverageScore = calculateCoverageScore(cluster);
    const cohesionScore = calculateCohesionScore(cluster);
    const noveltyScore = calculateNoveltyScore(cluster);
    const reliabilityScore = calculateReliabilityScore(cluster);

    return {
      candidate_id: `candidate-${cluster.cluster_id}`,
      source_cluster_ids: [cluster.cluster_id],
      candidate_name_hint: cluster.seed_labels.join(" / "),
      hypothesis: buildClusterHypothesis(cluster),
      supporting_project_refs: supportingRefs,
      evidence_refs: cluster.evidence_refs,
      counter_evidence_refs: cluster.counter_evidence_refs,
      unexplained_project_refs: projects
        .filter((project) => !supportingRefs.includes(project.repo_full_name))
        .filter((project) =>
          project.matched_topics.some((topic) => cluster.seed_labels.includes(topic.toLowerCase())),
        )
        .map((project) => project.repo_full_name),
      anomaly_refs: cluster.supporting_projects
        .filter((project) => project.anti_noise_flags.length > 0)
        .map((project) => project.repo_full_name),
      coverage_score: coverageScore,
      cohesion_score: cohesionScore,
      novelty_score: noveltyScore,
      reliability_score: reliabilityScore,
      rule_verdict: inferRuleVerdict({
        coverageScore,
        cohesionScore,
        reliabilityScore,
        counterEvidenceCount: cluster.counter_evidence_refs.length,
        distinctRepoCount: cluster.distinct_repo_count,
        appearanceDayCount: cluster.appearance_day_count,
      }),
    };
  });
}

function buildEstablishedTrend(candidate: WeeklyTrendCandidateV2): FinalWeeklyTrend {
  return {
    trend_id: candidate.candidate_id,
    trend_name_cn: candidate.candidate_name_hint,
    claim_cn: candidate.hypothesis,
    why_established_cn: "规则层观察到跨项目、跨日期、跨证据的重复收敛。",
    supporting_candidate_ids: [candidate.candidate_id],
    supporting_project_refs: candidate.supporting_project_refs.slice(0, 3),
    evidence_refs: candidate.evidence_refs.slice(0, 6),
    counter_evidence_refs: candidate.counter_evidence_refs.slice(0, 3),
    watch_next_week_cn: "下周继续确认这一收敛是否扩大。",
    audit_confidence: candidate.reliability_score >= 80 ? "high" : "medium",
  };
}

function buildObservingTrend(candidate: WeeklyTrendCandidateV2): FinalWeeklyTrendObservation {
  return {
    trend_id: candidate.candidate_id,
    trend_name_cn: candidate.candidate_name_hint,
    why_not_established_cn: "规则层发现了方向，但证据仍未完成闭环。",
    supporting_candidate_ids: [candidate.candidate_id],
    supporting_project_refs: candidate.supporting_project_refs.slice(0, 3),
    evidence_refs: candidate.evidence_refs.slice(0, 6),
    watch_next_week_cn: "若下周继续出现，再考虑升级。",
  };
}

function buildAuditConclusion(
  candidates: WeeklyTrendCandidateV2[],
  projects: WeeklyEvidenceProject[],
  established: FinalWeeklyTrend[],
): WeeklyAuditConclusion {
  return {
    accepted_candidate_ids: established.map((trend) => trend.trend_id),
    rejected_candidate_ids: candidates.filter((candidate) => candidate.rule_verdict === "reject").map((candidate) => candidate.candidate_id),
    merged_groups: [],
    split_actions: [],
    added_trends: [],
    missed_signal_summary_cn: projects.length > 0 ? ["仍有项目未被稳定解释。"] : [],
    misjudgment_summary_cn: candidates.some((candidate) => candidate.rule_verdict === "mixed") ? ["部分候选仍然存在语义混杂风险。"] : [],
    residual_blindspots_cn: [],
  };
}

export function buildRulesFallbackWeeklyJudgment(
  _anchorDate: string,
  candidates: WeeklyTrendCandidateV2[],
  projects: WeeklyEvidenceProject[],
): WeeklyTrendAgentReview {
  const established = candidates
    .filter((candidate) => candidate.rule_verdict === "likely-trend")
    .slice(0, 4)
    .map(buildEstablishedTrend);
  const observing = candidates
    .filter((candidate) => candidate.rule_verdict !== "likely-trend")
    .slice(0, 4)
    .map(buildObservingTrend);
  const auditFindings = buildAuditConclusion(candidates, projects, established);

  return {
    executive_summary_cn:
      established.length > 0
        ? "规则层已发现可成立趋势，但仍待 Agent 审核。"
        : "规则层尚未确认稳定趋势。",
    established_trends: established,
    observing_trends: observing,
    audit_findings: auditFindings,
  };
}
