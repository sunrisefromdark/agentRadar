import type { AppConfig } from "../config.ts";
import type { NormalizedProject, ScoreBreakdown, ScoreComponent } from "../types.ts";
import {
  hasDetailedDescription,
  hasSparseEvidence,
  hasStructuredMetrics,
  hasVeryDetailedDescription,
  metricsSource,
  semanticTagStrength,
  starDeltaAvailable,
  structuredSignalCount,
  trustFlags,
  withinSourceCorroboration,
} from "./scoringShared.ts";

type WeightedEvidenceRule = {
  when: (project: NormalizedProject, components: ScoreComponent[], antiNoiseFlags?: string[]) => boolean;
  score: number;
};

/**
 * 这一层专门处理“降噪规则”和“置信度裁剪”。
 * trust-first scoring 的核心约束必须集中在这里，
 * 否则 component 分数、风险文案、summary 很容易各自演化出不同口径。
 */

function clampConfidence(
  confidence: ScoreBreakdown["confidence"],
  maxAllowed: ScoreBreakdown["confidence"],
): ScoreBreakdown["confidence"] {
  const rank = { low: 1, medium: 2, high: 3 } as const;
  return rank[confidence] <= rank[maxAllowed] ? confidence : maxAllowed;
}

function collectFlags(project: NormalizedProject, rules: Array<(project: NormalizedProject) => string | undefined>): string[] {
  return rules.map((rule) => rule(project)).filter((flag): flag is string => Boolean(flag));
}

const ANTI_NOISE_RULES: Array<(project: NormalizedProject, config: AppConfig) => string | undefined> = [
  (project) => (!hasStructuredMetrics(project) ? "insufficient_metrics" : undefined),
  (project) => (!project.description ? "missing_description" : undefined),
  (project) => (project.sources.length === 1 ? "single_source" : undefined),
  (project) => (project.persistence_state === "single-spike" ? "single_spike" : undefined),
  (project, config) => {
    const engagement = project.forks + project.issues * 2 + project.PR * 3;
    const ratio = project.stars > 0 ? engagement / project.stars : 0;
    return (project.star_delta_daily ?? 0) >= config.thresholds.anomalyStarDeltaDaily &&
      ratio < config.thresholds.minEngagementRatio
      ? "high_velocity_low_engagement"
      : undefined;
  },
  (project) =>
    (project.star_delta_daily ?? 0) > 0 && project.stars === 0 && !hasStructuredMetrics(project)
      ? "delta_without_structured_baseline"
      : undefined,
  (project) => ((project.star_delta_daily ?? 0) > 5000 ? "suspicious_growth" : undefined),
  (project) =>
    trustFlags(project).includes("fork_star_ratio_anomaly") || trustFlags(project).includes("activity_scale_anomaly")
      ? "metric_scale_anomaly"
      : undefined,
  (project) => (metricsSource(project) === "github_html" ? "html_metrics_fallback" : undefined),
  (project) => (!starDeltaAvailable(project) ? "daily_delta_unavailable" : undefined),
  (project) => (metricsSource(project) === "unavailable" ? "unverified_metrics" : undefined),
];

export function inferAntiNoiseFlags(project: NormalizedProject, config: AppConfig): string[] {
  return collectFlags(
    project,
    ANTI_NOISE_RULES.map((rule) => (target) => rule(target, config)),
  );
}

const POSITIVE_EVIDENCE_RULES: WeightedEvidenceRule[] = [
  { when: (project) => hasStructuredMetrics(project), score: 2 },
  { when: (project) => !hasStructuredMetrics(project) && structuredSignalCount(project) > 0, score: 1 },
  { when: (project) => Boolean(project.description), score: 1 },
  { when: (project) => hasDetailedDescription(project), score: 1 },
  { when: (project) => hasVeryDetailedDescription(project), score: 1 },
  { when: (project) => project.sources.length >= 2, score: 1 },
  { when: (project) => project.appearances >= 2, score: 1 },
  { when: (project) => project.raw_signals.length >= 2, score: 1 },
  { when: (project) => semanticTagStrength(project) >= 3, score: 1 },
  { when: (project) => project.tags.includes("watchlist-hit"), score: 1 },
  { when: (project) => (project.star_delta_daily ?? 0) > 0, score: 1 },
  { when: (project) => project.sources.includes("agents-radar"), score: 1 },
  { when: (project) => withinSourceCorroboration(project) >= 2, score: 1 },
  { when: (project) => withinSourceCorroboration(project) >= 4, score: 1 },
  { when: (project) => metricsSource(project) === "github_api", score: 2 },
  { when: (project) => metricsSource(project) === "github_cache", score: 1 },
  {
    when: (_, components) => components.filter((component) => component.score >= 70).length >= 2,
    score: 1,
  },
  {
    when: (_, components) => components.filter((component) => component.score >= 70).length >= 4,
    score: 1,
  },
];

function positiveEvidenceScore(project: NormalizedProject, components: ScoreComponent[]): number {
  return POSITIVE_EVIDENCE_RULES.reduce(
    (sum, rule) => sum + (rule.when(project, components) ? rule.score : 0),
    0,
  );
}

const NEGATIVE_EVIDENCE_RULES: WeightedEvidenceRule[] = [
  { when: (project) => !project.description, score: 2 },
  {
    when: (project) =>
      !hasStructuredMetrics(project) &&
      structuredSignalCount(project) === 0 &&
      !(hasDetailedDescription(project) && semanticTagStrength(project) >= 3 && (project.star_delta_daily ?? 0) > 0),
    score: 2,
  },
  {
    when: (project) =>
      !hasStructuredMetrics(project) &&
      structuredSignalCount(project) === 0 &&
      hasDetailedDescription(project) &&
      semanticTagStrength(project) >= 3 &&
      (project.star_delta_daily ?? 0) > 0,
    score: 1,
  },
  { when: (project) => project.sources.length === 1 && project.raw_signals.length <= 1, score: 1 },
  { when: (project) => project.persistence_state === "single-spike" && project.appearances === 1, score: 1 },
  {
    when: (_, __, flags) => Boolean(flags?.includes("high_velocity_low_engagement")),
    score: 1,
  },
  { when: (project) => metricsSource(project) !== "github_api", score: 1 },
  { when: (_, __, flags) => Boolean(flags?.includes("metric_scale_anomaly")), score: 2 },
  { when: (_, __, flags) => Boolean(flags?.includes("suspicious_growth")), score: 1 },
];

function negativeEvidenceScore(project: NormalizedProject, antiNoiseFlags: string[]): number {
  return NEGATIVE_EVIDENCE_RULES.reduce(
    (sum, rule) => sum + (rule.when(project, [], antiNoiseFlags) ? rule.score : 0),
    0,
  );
}

function baseConfidenceFromEvidence(score: number): ScoreBreakdown["confidence"] {
  if (score >= 7) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function applyConfidenceCaps(
  project: NormalizedProject,
  confidence: ScoreBreakdown["confidence"],
): ScoreBreakdown["confidence"] {
  let next = confidence;
  if (metricsSource(project) !== "github_api") next = clampConfidence(next, "medium");
  if (project.sources.length <= 1 || project.appearance_dates.length < 2) {
    next = clampConfidence(next, "medium");
  }
  if (metricsSource(project) === "unavailable") next = clampConfidence(next, "low");
  return next;
}

export function inferConfidence(
  project: NormalizedProject,
  antiNoiseFlags: string[],
  components: ScoreComponent[],
): ScoreBreakdown["confidence"] {
  if (hasSparseEvidence(project)) return "low";

  const evidenceScore = positiveEvidenceScore(project, components) - negativeEvidenceScore(project, antiNoiseFlags);
  const baseConfidence = baseConfidenceFromEvidence(evidenceScore);
  return applyConfidenceCaps(project, baseConfidence);
}
