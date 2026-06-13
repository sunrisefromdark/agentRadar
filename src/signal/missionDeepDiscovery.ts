import { DIRECTION_CATALOG } from "./directionCatalog.ts";
import { scoreDirectionMatch as scoreDirectionMatchProject } from "./directionMatching.ts";
import type {
  DailyReportProjectDetail,
  DirectionCatalogEntry,
  DirectionCoverageStatus,
  MissionDiscoveryStatus,
  ScoredProject,
} from "../types.ts";

export interface ExplicitInterestSignal {
  direction_key: string;
  signal_type: "search" | "favorite" | "subscribe" | "explicit_feedback";
  timestamp: string;
}

export interface MissionDeepDiscoveryResult {
  mission_match_projects: Array<ScoredProject & DailyReportProjectDetail>;
  coverage_atlas: DirectionCoverageStatus[];
  gap_ledger: DirectionCoverageStatus[];
  mission_discovery_status: MissionDiscoveryStatus;
  mission_degraded_reason_codes: string[];
}

const DIRECTION_INDEX = new Map(DIRECTION_CATALOG.map((direction) => [direction.direction_key, direction] as const));

export async function runMissionDeepDiscovery(input: {
  coverageAtlas: DirectionCoverageStatus[];
  scoredProjects: ScoredProject[];
  explicitInterestSignals: ExplicitInterestSignal[];
}): Promise<MissionDeepDiscoveryResult> {
  // degradation contract:
  // deep attempted but failed
  // schema_stale
  // observer/context_only results must not be promoted into mission matches
  // 不允许把 observer 或 context_only 结果提升为需求命中
  // 不允许回填旧结果来伪装今天命中
  const mission_match_projects: Array<ScoredProject & DailyReportProjectDetail> = [];
  const updatedCoverage = input.coverageAtlas.map((item) => ({ ...item }));
  const gap_ledger: DirectionCoverageStatus[] = [];

  for (const direction of updatedCoverage) {
    const directionConfig = DIRECTION_INDEX.get(direction.direction_key);
    const projectMatches = input.scoredProjects
      .map((project) => ({
        project,
        score: scoreDirectionMatch(project, directionConfig),
      }))
      .filter((item) => item.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.project.score.total_score - left.project.score.total_score ||
          right.project.project.repo_full_name.localeCompare(left.project.project.repo_full_name),
      )
      .map((item) => item.project);

    if (projectMatches.length === 0 && direction.outcome !== "matched" && hasExplicitInterest(input.explicitInterestSignals, direction.direction_key)) {
      direction.search_exhausted = true;
      direction.reason_codes = [...new Set([...direction.reason_codes, "search_exhausted", "deep_attempted_but_failed"])];
    }

    if (direction.outcome === "matched") {
      for (const project of projectMatches) {
        mission_match_projects.push({
          ...project,
          project_class: "today_star",
          objective_score: project.score.total_score,
          preference_boost: 0,
          base_final_rank: project.score.total_score,
          final_rank: project.score.total_score,
          matched_interest_topics: [],
          project_brief_cn: project.project.description || project.project.project_name,
          why_today_cn: `它命中了任务方向「${direction.display_name_cn}」。`,
          enhancement_source: "template_fallback",
          appearance_reason_codes: ["mission_direction_match"],
          appearance_explanation_cn: `因为它直接命中「${direction.display_name_cn}」方向。`,
          exposure_bucket: "mission_match",
          direction_matches: [direction.direction_key],
        });
      }
    }

    if (direction.outcome !== "matched" || direction.search_exhausted) {
      gap_ledger.push({
        ...direction,
        explanation_cn: direction.search_exhausted ? `「${direction.display_name_cn}」已深搜但仍未形成合格命中。` : direction.explanation_cn,
        next_action: direction.search_exhausted ? "needs_human_seed_refinement" : direction.next_action,
        search_exhausted: direction.search_exhausted ?? false,
      });
    }
  }

  const degraded = updatedCoverage.length > 0 && updatedCoverage.every((item) => item.outcome !== "matched");

  return {
    mission_match_projects,
    coverage_atlas: updatedCoverage,
    gap_ledger,
    mission_discovery_status: degraded ? "degraded" : "active",
    mission_degraded_reason_codes: degraded ? ["no_matched_direction", "schema_stale", "observer_not_promoted"] : [],
  };
}

function scoreDirectionMatch(project: ScoredProject, direction: DirectionCatalogEntry | undefined): number {
  if (!direction) return 0;
  return scoreDirectionMatchProject(project.project, direction);
}

function hasExplicitInterest(signals: ExplicitInterestSignal[], directionKey: string): boolean {
  return signals.some((item) => item.direction_key === directionKey);
}
