import type { DailyReport, DirectionCatalogEntry, ScoredProject } from "../types.ts";
import { MISSION_DISCOVERY_CONFIG } from "./missionDiscoveryConfig.ts";
import { directionMatchesProject } from "./directionMatching.ts";

export interface MissionInventoryAudit {
  rolling_30d_searchable_catalog_count: number;
  rolling_30d_vertical_or_task_oriented_count: number;
  rolling_7d_qualified_non_head_count: number;
  rolling_30d_direction_qualified_counts: Record<string, number>;
}

function uniquePush(target: Set<string>, value: string | undefined): void {
  if (!value) return;
  target.add(value.toLowerCase());
}

function matchesDirection(project: ScoredProject, direction: DirectionCatalogEntry): boolean {
  return directionMatchesProject(project.project, direction);
}

function isQualifiedDirectionProject(project: ScoredProject, direction: DirectionCatalogEntry): boolean {
  return directionMatchesProject(project.project, direction);
}

function isVerticalOrTaskOriented(project: ScoredProject, catalog: DirectionCatalogEntry[]): boolean {
  return catalog.some((direction) => direction.family_key !== "core-agent-work" && matchesDirection(project, direction));
}

export function buildMissionInventoryAudit(input: {
  currentReport: DailyReport;
  rolling30dReports: DailyReport[];
  directionCatalog: DirectionCatalogEntry[];
}): MissionInventoryAudit {
  const rollingReports = [...input.rolling30dReports, input.currentReport];
  const searchableCatalog = new Set<string>();
  const verticalOrTaskCatalog = new Set<string>();
  const directionQualifiedCounts: Record<string, Set<string>> = {};
  const qualifiedNonHead7d = new Set<string>();
  const headRepos7d = new Set<string>();

  for (const direction of input.directionCatalog) {
    directionQualifiedCounts[direction.direction_key] = new Set<string>();
  }

  for (const report of rollingReports) {
    for (const project of report.all_projects ?? []) {
      uniquePush(searchableCatalog, project.project.repo_full_name);
      if (isVerticalOrTaskOriented(project, input.directionCatalog)) {
        uniquePush(verticalOrTaskCatalog, project.project.repo_full_name);
      }
      for (const direction of input.directionCatalog) {
        if (matchesDirection(project, direction)) {
          uniquePush(directionQualifiedCounts[direction.direction_key]!, project.project.repo_full_name);
        }
      }
    }
  }

  const rolling7dReports = rollingReports.slice(-7);
  for (const report of rolling7dReports) {
    for (const project of [...(report.today_pulse_projects ?? []), ...(report.mission_match_projects ?? []), ...(report.explore_ribbon_projects ?? [])]) {
      if (project.head_project || project.head_saturation_state === "demote") {
        uniquePush(headRepos7d, project.project.repo_full_name);
      }
    }
  }

  for (const report of rolling7dReports) {
    for (const project of report.all_projects ?? []) {
      const repoKey = project.project.repo_full_name.toLowerCase();
      if (headRepos7d.has(repoKey)) continue;
      const qualifiedDirections = input.directionCatalog.filter((direction) => isQualifiedDirectionProject(project, direction));
      if (qualifiedDirections.length === 0) continue;
      uniquePush(qualifiedNonHead7d, project.project.repo_full_name);
      if (qualifiedNonHead7d.size >= MISSION_DISCOVERY_CONFIG.rolling_7d_qualified_non_head_projects_min) {
        // Keep scanning for stable counts in future runs, but we already crossed the design gate.
      }
    }
  }

  return {
    rolling_30d_searchable_catalog_count: searchableCatalog.size,
    rolling_30d_vertical_or_task_oriented_count: verticalOrTaskCatalog.size,
    rolling_7d_qualified_non_head_count: qualifiedNonHead7d.size,
    rolling_30d_direction_qualified_counts: Object.fromEntries(
      Object.entries(directionQualifiedCounts).map(([directionKey, repos]) => [directionKey, repos.size]),
    ),
  };
}
