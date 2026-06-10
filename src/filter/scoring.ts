import type { AppConfig } from "../config.ts";
import type { SemanticClassification } from "../llmClassification.ts";
import type { NormalizedProject, ScoredProject } from "../types.ts";
import { buildScoreComponents } from "./scoreComponents.ts";
import { inferConfidence, inferAntiNoiseFlags } from "./confidencePolicy.ts";
import { inferNextActions, inferParadigm, inferRisks } from "./projectNarrative.ts";
import { dataTrust, metricsTrustScore } from "./scoringShared.ts";

/**
 * 评分入口层只负责 orchestration：
 * 1. 先算 component scores
 * 2. 再应用 anti-noise / confidence policy
 * 3. 最后生成给 report/summary 用的叙事字段
 *
 * 这样做的目的，是把“分数计算”“置信度裁剪”“人类可读解释”三种职责拆开，
 * 避免单文件继续演变成 if 分支和文案拼接混杂的维护热点。
 *
 * 当前正式 score components 仍然保持为：
 * - star_velocity
 * - engagement_score
 * - architecture_shift
 * - compounding_capability
 * - autonomy_score
 * - discussion_score
 */

export function scoreProject(
  project: NormalizedProject,
  config: AppConfig,
  classification?: SemanticClassification,
): ScoredProject {
  const components = buildScoreComponents(project, config, classification);
  const totalScore = Number(components.reduce((sum, item) => sum + item.weighted_score, 0).toFixed(2));
  const verdict = totalScore >= config.thresholds.highScore ? "high" : totalScore >= 45 ? "watch" : "low";
  const antiNoiseFlags = inferAntiNoiseFlags(project, config);
  const confidence = inferConfidence(project, antiNoiseFlags, components);

  return {
    project,
    score: {
      total_score: totalScore,
      components,
      verdict,
      confidence,
      trust_score: metricsTrustScore(project),
      data_trust: dataTrust(project),
      paradigm: inferParadigm(project, classification),
      anti_noise_flags: antiNoiseFlags,
      risks: inferRisks(project, config),
      next_actions: inferNextActions(project),
      rules_only: !config.llm.enabled || config.llm.mode === "rules-only",
    },
  };
}

export function scoreProjects(
  projects: NormalizedProject[],
  config: AppConfig,
  classifications: Map<string, SemanticClassification> = new Map(),
): ScoredProject[] {
  return projects
    .map((project) => scoreProject(project, config, classifications.get(project.repo_full_name.toLowerCase())))
    .sort((a, b) => b.score.total_score - a.score.total_score);
}
