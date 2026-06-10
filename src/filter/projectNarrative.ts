import type { AppConfig } from "../config.ts";
import type { SemanticClassification } from "../llmClassification.ts";
import type { NormalizedProject } from "../types.ts";
import {
  hasAny,
  hasSparseEvidence,
  hasStructuredMetrics,
  haystack,
  metricsSource,
  starDeltaAvailable,
  trustFlags,
} from "./scoringShared.ts";

type NarrativeRule = {
  when: (project: NormalizedProject, text: string) => boolean;
  label: string;
};

/**
 * 这一层专门生成“解释性输出”：
 * paradigm / risks / next actions 都属于给人看的叙事层，
 * 不应继续混在 component score 和 confidence policy 里。
 */

const PARADIGM_RULES: NarrativeRule[] = [
  { when: (_, text) => hasAny(text, ["runtime", "orchestrat", "sandbox"]), label: "agent runtime" },
  { when: (_, text) => hasAny(text, ["memory", "persistent", "context"]), label: "persistent memory" },
  { when: (_, text) => hasAny(text, ["self-improving", "learn", "feedback", "reflection"]), label: "self-improving" },
  { when: (_, text) => hasAny(text, ["skill", "mcp", "plugin", "tool-use"]), label: "tool/skill ecosystem" },
  { when: (_, text) => hasAny(text, ["observability", "eval", "trace"]), label: "agent observability" },
  { when: (_, text) => hasAny(text, ["swarm", "multi-agent"]), label: "multi-agent coordination" },
];

function classificationParadigm(classification?: SemanticClassification): string | undefined {
  if (!classification) return undefined;
  if (classification.paradigm_class === "infra") return "agent infra";
  if (classification.paradigm_class === "system") return "agent system";
  if (classification.paradigm_class === "ordinary_tool") return "ordinary AI tool";
  if (classification.paradigm_class !== "agent_runtime") return undefined;

  const parts = ["agent runtime"];
  if (classification.has_persistent_memory) parts.push("persistent memory");
  if (classification.has_self_improving_loop) parts.push("self-improving");
  if (classification.has_skill_ecosystem) parts.push("tool/skill ecosystem");
  return parts.join(" + ");
}

export function inferParadigm(project: NormalizedProject, classification?: SemanticClassification): string {
  const classified = classificationParadigm(classification);
  if (classified) return classified;

  const text = haystack(project);
  const parts = PARADIGM_RULES.filter((rule) => rule.when(project, text)).map((rule) => rule.label);
  return parts.length > 0 ? parts.join(" + ") : "AI project with insufficient paradigm signal";
}

function baseConfidenceRisk(project: NormalizedProject): string | undefined {
  if (hasSparseEvidence(project)) return "insufficient_data: missing description and structured metrics";
  if (!project.description) return "low_confidence: missing description";
  if (!hasStructuredMetrics(project)) return "low_confidence: missing structured metrics";
  return undefined;
}

function engagementRisk(project: NormalizedProject, config: AppConfig): string | undefined {
  const engagement = project.forks + project.issues * 2 + project.PR * 3;
  const ratio = project.stars > 0 ? engagement / project.stars : 0;
  return (project.star_delta_daily ?? 0) >= config.thresholds.anomalyStarDeltaDaily &&
    ratio < config.thresholds.minEngagementRatio
    ? "high star velocity but weak engagement; possible hype or fake-star risk"
    : undefined;
}

const METRICS_RISK_RULES: Array<(project: NormalizedProject) => string | undefined> = [
  (project) => (!starDeltaAvailable(project) ? "daily growth unavailable; star velocity is not trusted for this project" : undefined),
  (project) =>
    metricsSource(project) === "github_html"
      ? "structured metrics came from GitHub HTML fallback; trust is limited"
      : undefined,
  (project) => (metricsSource(project) === "unavailable" ? "structured metrics could not be verified" : undefined),
  (project) =>
    trustFlags(project).includes("fork_star_ratio_anomaly")
      ? "fork/star ratio looks abnormal; metrics may be polluted"
      : undefined,
  (project) =>
    trustFlags(project).includes("activity_scale_anomaly")
      ? "issue/PR scale looks abnormal relative to stars"
      : undefined,
  (project) => ((project.star_delta_daily ?? 0) > 5000 ? "suspicious growth spike; review raw metrics before trusting ranking" : undefined),
];

const PERSISTENCE_RISK_RULES: Array<(project: NormalizedProject) => string | undefined> = [
  (project) => (project.sources.length === 1 ? "single-source signal; needs persistence validation" : undefined),
  (project) =>
    project.persistence_state === "single-spike" ? "single-day appearance; persistence is not yet established" : undefined,
  (project) => (!project.description ? "missing description; semantic classification confidence is low" : undefined),
];

function collectRisks(project: NormalizedProject, rules: Array<(project: NormalizedProject) => string | undefined>): string[] {
  return rules.map((rule) => rule(project)).filter((item): item is string => Boolean(item));
}

export function inferRisks(project: NormalizedProject, config: AppConfig): string[] {
  return [
    ...[baseConfidenceRisk(project)].filter((item): item is string => Boolean(item)),
    ...[engagementRisk(project, config)].filter((item): item is string => Boolean(item)),
    ...collectRisks(project, METRICS_RISK_RULES),
    ...collectRisks(project, PERSISTENCE_RISK_RULES),
  ];
}

const NEXT_ACTION_RULES: Array<(project: NormalizedProject) => string | undefined> = [
  () => "track for 7-day persistence",
  () => "inspect README and release cadence",
  (project) => (hasSparseEvidence(project) ? "treat as insufficient_data until description or metrics improve" : undefined),
  (project) => (project.sources.length > 1 ? "promote to weekly theme candidate" : undefined),
  (project) =>
    project.persistence_state === "emerging" || project.persistence_state === "persistent"
      ? "compare repeated appearances to confirm trend durability"
      : undefined,
  (project) =>
    project.PR + project.issues > 20 ? "review issue/PR quality to separate real engagement from noise" : undefined,
  (project) => (!starDeltaAvailable(project) ? "do not trust star velocity until a real daily delta becomes available" : undefined),
  (project) =>
    metricsSource(project) !== "github_api" ? "prefer GitHub API metrics before promoting this project to high confidence" : undefined,
];

export function inferNextActions(project: NormalizedProject): string[] {
  return NEXT_ACTION_RULES.map((rule) => rule(project)).filter((item): item is string => Boolean(item));
}
