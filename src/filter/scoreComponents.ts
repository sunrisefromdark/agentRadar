import type { AppConfig } from "../config.ts";
import type { SemanticClassification } from "../llmClassification.ts";
import type { NormalizedProject, ScoreComponent, ScoreComponentName } from "../types.ts";
import {
  clampScore,
  hasAny,
  hasStructuredMetrics,
  haystack,
  metricsSource,
  metricsTrustMultiplier,
  metricsTrustScore,
  starDeltaAvailable,
  trustFlags,
} from "./scoringShared.ts";

/**
 * 组件评分层只负责把“项目事实”翻译成结构化 component 分数。
 * 这里不直接决定 confidence，也不拼最终 risks 文案，避免一层里混太多责任。
 */

function component(
  name: ScoreComponentName,
  score: number,
  weight: number,
  evidence: string[],
): ScoreComponent {
  const normalizedScore = clampScore(score);
  return {
    name,
    score: normalizedScore,
    weight,
    weighted_score: Number((normalizedScore * weight).toFixed(2)),
    evidence,
  };
}

function classificationEvidence(classification: SemanticClassification | undefined): string[] {
  if (!classification) return [];
  return [
    `classification.paradigm_class=${classification.paradigm_class}`,
    `classification.autonomy_level=${classification.autonomy_level}`,
    `classification.confidence=${classification.confidence.toFixed(2)}`,
    ...classification.evidence_snippets.map((snippet) => `classification.evidence=${snippet}`),
  ];
}

const ARCHITECTURE_CLASSIFICATION_SCORES = {
  agent_runtime: {
    score: 100,
    evidence: ["baseline=default_agent_capability", "classified_as=agent_runtime", "structural_change=true"],
  },
  infra: {
    score: 85,
    evidence: ["baseline=default_agent_capability", "classified_as=infra", "structural_change=true"],
  },
  system: {
    score: 75,
    evidence: ["baseline=default_agent_capability", "classified_as=system", "structural_change=true"],
  },
  ordinary_tool: {
    score: 45,
    evidence: ["baseline=default_agent_capability", "classified_as=tool", "structural_change=false"],
  },
} as const;

const ARCHITECTURE_HEURISTIC_GROUPS = [
  {
    keywords: ["agent-runtime", "runtime", "orchestrat", "sandbox", "scheduler"],
    score: 100,
    evidence: ["baseline=default_agent_capability", "classified_as=agent_runtime", "structural_change=true"],
  },
  {
    keywords: ["infra", "observability", "eval", "gateway", "router", "framework", "sdk", "mcp"],
    score: 85,
    evidence: ["baseline=default_agent_capability", "classified_as=infra", "structural_change=true"],
  },
  {
    keywords: ["system", "platform", "workflow", "swarm", "multi-agent"],
    score: 75,
    evidence: ["baseline=default_agent_capability", "classified_as=system", "structural_change=true"],
  },
  {
    keywords: ["tool", "plugin", "cli", "extension"],
    score: 45,
    evidence: ["baseline=default_agent_capability", "classified_as=tool", "structural_change=false"],
  },
] as const;

function classifiedArchitectureComponent(
  classification: SemanticClassification,
  weight: number,
): ScoreComponent | undefined {
  if (!(classification.paradigm_class in ARCHITECTURE_CLASSIFICATION_SCORES)) return undefined;
  const matched =
    ARCHITECTURE_CLASSIFICATION_SCORES[
      classification.paradigm_class as keyof typeof ARCHITECTURE_CLASSIFICATION_SCORES
    ];
  if (!matched) return undefined;

  return component("architecture_shift", matched.score, weight, [
    ...matched.evidence,
    ...classificationEvidence(classification),
  ]);
}

function heuristicArchitectureComponent(text: string, weight: number): ScoreComponent | undefined {
  const matched = ARCHITECTURE_HEURISTIC_GROUPS.find((group) => hasAny(text, group.keywords));
  if (!matched) return undefined;
  return component("architecture_shift", matched.score, weight, [...matched.evidence]);
}

export function scoreStarVelocity(project: NormalizedProject, config: AppConfig): ScoreComponent {
  const daily = project.star_delta_daily ?? 0;
  const weekly = project.star_delta_weekly ?? 0;

  if (!starDeltaAvailable(project)) {
    return component("star_velocity", 0, config.weights.star_velocity, [
      "daily_delta=unavailable",
      `metrics_source=${metricsSource(project)}`,
    ]);
  }

  const score = Math.max(
    (daily / config.thresholds.anomalyStarDeltaDaily) * 100,
    (weekly / config.thresholds.anomalyStarDeltaWeekly) * 100,
  );

  return component("star_velocity", score * metricsTrustMultiplier(project), config.weights.star_velocity, [
    `daily_delta=${daily}`,
    `weekly_delta=${weekly}`,
    `metrics_source=${metricsSource(project)}`,
    `metrics_trust=${metricsTrustScore(project).toFixed(2)}`,
    `daily_threshold=${config.thresholds.anomalyStarDeltaDaily}`,
  ]);
}

export function scoreEngagement(project: NormalizedProject, config: AppConfig): ScoreComponent {
  if (!hasStructuredMetrics(project)) {
    return component("engagement_score", 0, config.weights.engagement_score, [
      "insufficient_metrics",
      `metrics_source=${metricsSource(project)}`,
      `stars=${project.stars}`,
      `forks=${project.forks}`,
      `issues=${project.issues}`,
      `PR=${project.PR}`,
    ]);
  }

  const engagement = project.forks + project.issues * 2 + project.PR * 3;
  const ratio = project.stars > 0 ? engagement / project.stars : 0;
  let score = Math.min(100, ratio / config.thresholds.minEngagementRatio * 70 + Math.min(30, engagement / 10));
  score *= metricsTrustMultiplier(project);

  if (trustFlags(project).includes("fork_star_ratio_anomaly") || trustFlags(project).includes("activity_scale_anomaly")) {
    score = Math.min(score, 20);
  }

  return component("engagement_score", score, config.weights.engagement_score, [
    `forks=${project.forks}`,
    `issues=${project.issues}`,
    `PR=${project.PR}`,
    `metrics_source=${metricsSource(project)}`,
    `metrics_trust=${metricsTrustScore(project).toFixed(2)}`,
    `engagement_ratio=${ratio.toFixed(4)}`,
  ]);
}

export function scoreArchitectureShift(
  project: NormalizedProject,
  config: AppConfig,
  classification?: SemanticClassification,
): ScoreComponent {
  const text = haystack(project);
  const classified = classification ? classifiedArchitectureComponent(classification, config.weights.architecture_shift) : undefined;
  if (classified) return classified;

  const heuristic = heuristicArchitectureComponent(text, config.weights.architecture_shift);
  if (heuristic) return heuristic;

  return component("architecture_shift", 25, config.weights.architecture_shift, [
    "baseline=default_agent_capability",
    "classified_as=application_or_unknown",
    "structural_change=false",
  ]);
}

export function scoreCompounding(
  project: NormalizedProject,
  config: AppConfig,
  classification?: SemanticClassification,
): ScoreComponent {
  const text = haystack(project);
  const evidence: string[] = [];
  let score = 0;

  if (classification?.has_persistent_memory) {
    score += 35;
    evidence.push("classification.has_persistent_memory");
  }
  if (classification?.has_self_improving_loop) {
    score += 35;
    evidence.push("classification.has_self_improving_loop");
  }
  if (classification?.has_skill_ecosystem) {
    score += 30;
    evidence.push("classification.has_skill_ecosystem");
  }
  if (hasAny(text, ["memory", "persistent", "remember", "context"])) {
    score += 35;
    evidence.push("has_memory_signal");
  }
  if (hasAny(text, ["self-improving", "self improving", "learn", "feedback", "reflection"])) {
    score += 35;
    evidence.push("has_self_improving_signal");
  }
  if (hasAny(text, ["skill", "tool-use", "tool use", "mcp", "plugin"])) {
    score += 30;
    evidence.push("has_skill_or_tool_signal");
  }

  return component(
    "compounding_capability",
    Math.min(100, score),
    config.weights.compounding_capability,
    evidence.length > 0 ? evidence : ["no_compounding_signal"],
  );
}

export function scoreAutonomy(
  project: NormalizedProject,
  config: AppConfig,
  classification?: SemanticClassification,
): ScoreComponent {
  const text = haystack(project);
  const evidence: string[] = [];
  let score = 0;

  if (classification?.autonomy_level === "high") {
    score += 55;
    evidence.push("classification.autonomy_level=high");
  } else if (classification?.autonomy_level === "medium") {
    score += 35;
    evidence.push("classification.autonomy_level=medium");
  } else if (classification?.autonomy_level === "low") {
    score += 15;
    evidence.push("classification.autonomy_level=low");
  }

  if (classification?.has_governance_boundary) {
    score += 10;
    evidence.push("classification.has_governance_boundary");
  }
  if (hasAny(text, ["autonomous", "autonomy", "agent", "swarm"])) {
    score += 45;
    evidence.push("agent_or_swarm_signal");
  }
  if (hasAny(text, ["automation", "automated", "hands-off", "no human", "reduce human"])) {
    score += 35;
    evidence.push("reduces_human_in_loop");
  }
  if (hasAny(text, ["workflow", "execute", "act", "browser", "computer use"])) {
    score += 20;
    evidence.push("action_execution_signal");
  }

  return component(
    "autonomy_score",
    Math.min(100, score),
    config.weights.autonomy_score,
    evidence.length > 0 ? evidence : ["no_autonomy_signal"],
  );
}

export function scoreDiscussion(project: NormalizedProject, config: AppConfig): ScoreComponent {
  const sourceScore =
    project.sources.length >= config.thresholds.minSourcesForDiscussionBonus ? 70 : project.sources.length * 25;
  const persistenceScore =
    project.persistence_state === "persistent"
      ? 30
      : project.persistence_state === "emerging"
        ? 20
        : Math.min(10, project.appearances * 5);

  return component("discussion_score", sourceScore + persistenceScore, config.weights.discussion_score, [
    `sources=${project.sources.join(",")}`,
    `appearances=${project.appearances}`,
    `appearance_dates=${project.appearance_dates.join(",")}`,
    `persistence_state=${project.persistence_state}`,
  ]);
}

export function buildScoreComponents(
  project: NormalizedProject,
  config: AppConfig,
  classification?: SemanticClassification,
): ScoreComponent[] {
  return [
    scoreStarVelocity(project, config),
    scoreEngagement(project, config),
    scoreArchitectureShift(project, config, classification),
    scoreCompounding(project, config, classification),
    scoreAutonomy(project, config, classification),
    scoreDiscussion(project, config),
  ];
}
