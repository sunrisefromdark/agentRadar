import { DIRECTION_CATALOG, PROJECT_SEARCH_CONSTANTS } from "../signal/directionCatalog.ts";
import type {
  DailyReport,
  DailyReportProjectDetail,
  DirectionCoverageStatus,
  MissionDiscoveryStatus,
  ScoredProject,
} from "../types.ts";
import type { ProjectSearchDailySectionsInput } from "./projectSearchDailySections.ts";

type RankedProject = ScoredProject & DailyReportProjectDetail;
type ExposureHistory = { coreCount: number; frontHalfCount: number; consecutiveCoreStreak: number };

const DIRECTION_TO_FAMILY = new Map(DIRECTION_CATALOG.map((direction) => [direction.direction_key, direction.family_key] as const));

function uniqueByRepo(projects: RankedProject[]): RankedProject[] {
  const seen = new Set<string>();
  return projects.filter((project) => {
    const key = project.project.repo_full_name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildExposureHistory(reports: DailyReport[]): Map<string, ExposureHistory> {
  const history = new Map<string, ExposureHistory>();
  const recentReports = reports.slice(-5);

  for (const report of recentReports) {
    const coreProjects = (report.today_pulse_projects?.length ? report.today_pulse_projects : report.today_star_projects) ?? [];
    const frontHalf = coreProjects.slice(0, PROJECT_SEARCH_CONSTANTS.anchorSeatCount);
    const coreKeys = new Set(coreProjects.map((project) => project.project.repo_full_name.toLowerCase()));
    const frontHalfKeys = new Set(frontHalf.map((project) => project.project.repo_full_name.toLowerCase()));

    for (const key of coreKeys) {
      const current = history.get(key) ?? { coreCount: 0, frontHalfCount: 0, consecutiveCoreStreak: 0 };
      current.coreCount += 1;
      current.consecutiveCoreStreak += 1;
      if (frontHalfKeys.has(key)) current.frontHalfCount += 1;
      history.set(key, current);
    }

    for (const [key, current] of history.entries()) {
      if (!coreKeys.has(key)) current.consecutiveCoreStreak = 0;
    }
  }

  return history;
}

function annotateHeadSaturation(projects: RankedProject[], reports: DailyReport[] | undefined): RankedProject[] {
  const history = buildExposureHistory(reports ?? []);
  return projects.map((project) => {
    const stats = history.get(project.project.repo_full_name.toLowerCase());
    const headProject = (stats?.coreCount ?? 0) >= 3 && (stats?.frontHalfCount ?? 0) >= 2;
    const headSaturationState = headProject && (stats?.consecutiveCoreStreak ?? 0) >= 3 ? "demote" : "normal";
    return {
      ...project,
      head_project: headProject,
      head_saturation_state: headSaturationState,
    };
  });
}

function annotateTodayPulse(projects: RankedProject[], reports: DailyReport[] | undefined): RankedProject[] {
  const enriched = annotateHeadSaturation(projects, reports);
  const anchors = enriched.slice(0, PROJECT_SEARCH_CONSTANTS.anchorSeatCount);
  const challengers = enriched
    .filter((project) => !anchors.some((anchor) => anchor.project.repo_full_name.toLowerCase() === project.project.repo_full_name.toLowerCase()))
    .filter((project) => !project.head_project && project.head_saturation_state !== "demote")
    .slice(0, PROJECT_SEARCH_CONSTANTS.challengerSeatCount);

  return [...anchors, ...challengers].slice(0, PROJECT_SEARCH_CONSTANTS.globalHotQuota).map((project, index) => ({
    ...project,
    appearance_reason_codes: [index < PROJECT_SEARCH_CONSTANTS.anchorSeatCount ? "today_pulse_anchor" : "today_pulse_challenger"],
    appearance_explanation_cn:
      index < PROJECT_SEARCH_CONSTANTS.anchorSeatCount ? "该项目占据今日全局脉冲 anchor 席位。" : "该项目占据今日全局脉冲 challenger 席位。",
    exposure_bucket: "today_pulse",
    direction_matches: project.direction_matches ?? [],
  }));
}

function annotateExploreRibbon(projects: RankedProject[], reports: DailyReport[] | undefined): RankedProject[] {
  const enriched = annotateHeadSaturation(projects, reports);
  return enriched
    .filter((project) => !project.head_project && project.head_saturation_state !== "demote")
    .map((project) => ({
      ...project,
      appearance_reason_codes: ["explore_ribbon_fill"],
      appearance_explanation_cn: "该项目不是任务命中，只是任务区之外的新鲜探索补位。",
      exposure_bucket: "explore_ribbon",
      direction_matches: [],
    }));
}

function uniqueFamilies(project: RankedProject): string[] {
  return [...new Set((project.direction_matches ?? []).map((directionKey) => DIRECTION_TO_FAMILY.get(directionKey)).filter(Boolean))] as string[];
}

function annotateMissionMatch(projects: RankedProject[]): RankedProject[] {
  return projects.map((project) => {
    const directions = project.direction_matches ?? [];
    const directionName = directions[0] ? DIRECTION_CATALOG.find((direction) => direction.direction_key === directions[0])?.display_name_cn : undefined;
    return {
      ...project,
      appearance_reason_codes: project.appearance_reason_codes?.length ? project.appearance_reason_codes : ["mission_direction_match"],
      appearance_explanation_cn:
        project.appearance_explanation_cn ?? (directionName ? `因为它直接命中「${directionName}」方向。` : "因为它直接命中任务方向。"),
      exposure_bucket: "mission_match",
    };
  });
}

function selectMissionMatchProjects(projects: RankedProject[], todayPulseProjects: RankedProject[], reports: DailyReport[] | undefined): RankedProject[] {
  const pulseRepos = new Set(todayPulseProjects.map((project) => project.project.repo_full_name.toLowerCase()));
  const directionCountsTop3 = new Map<string, number>();
  const familyCounts = new Map<string, number>();
  const selected: RankedProject[] = [];

  for (const project of uniqueByRepo(annotateHeadSaturation(projects, reports))) {
    const repoKey = project.project.repo_full_name.toLowerCase();
    if (pulseRepos.has(repoKey)) continue;
    if (project.head_project || project.head_saturation_state === "demote") continue;

    const directions = [...new Set(project.direction_matches ?? [])];
    const families = uniqueFamilies(project);
    if (directions.length === 0 || families.length === 0) continue;

    const top3Locked = selected.length < 3;
    const sameDirectionBlocked = top3Locked && directions.every((direction) => (directionCountsTop3.get(direction) ?? 0) >= 1);
    const sameFamilyBlocked = families.every((family) => (familyCounts.get(family) ?? 0) >= 2);
    if (sameDirectionBlocked || sameFamilyBlocked) continue;

    selected.push(project);
    for (const direction of directions) {
      if (selected.length <= 3) {
        directionCountsTop3.set(direction, (directionCountsTop3.get(direction) ?? 0) + 1);
      }
    }
    for (const family of families) {
      familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
    }

    if (selected.length >= PROJECT_SEARCH_CONSTANTS.demandRelevantQuota) break;
  }

  return annotateMissionMatch(selected);
}

export function buildProjectSearchDailySections(input: {
  report: DailyReport;
  mission_match_projects: RankedProject[];
  coverage_atlas: DirectionCoverageStatus[];
  gap_ledger: DirectionCoverageStatus[];
  mission_discovery_status: MissionDiscoveryStatus;
  mission_degraded_reason_codes: string[];
  recent_daily_reports?: DailyReport[];
}): ProjectSearchDailySectionsInput {
  const todayPulseProjects = annotateTodayPulse(uniqueByRepo(input.report.today_star_projects), input.recent_daily_reports);
  const missionMatchProjects = selectMissionMatchProjects(input.mission_match_projects, todayPulseProjects, input.recent_daily_reports);
  const excludedRepos = new Set(
    [...todayPulseProjects, ...missionMatchProjects].map((project) => project.project.repo_full_name.toLowerCase()),
  );
  const missionMissingSeats = Math.max(0, PROJECT_SEARCH_CONSTANTS.demandRelevantQuota - missionMatchProjects.length);
  const exploreRibbonProjects =
    missionMissingSeats > 0
      ? annotateExploreRibbon(
          uniqueByRepo(
            input.report.today_star_projects.filter(
              (project) =>
                project.project_class === "today_star" &&
                (project.direction_matches?.length ?? 0) === 0 &&
                !excludedRepos.has(project.project.repo_full_name.toLowerCase()),
            ),
          ).slice(0, missionMissingSeats),
          input.recent_daily_reports,
        )
      : [];

  return {
    today_pulse_projects: todayPulseProjects,
    mission_match_projects: missionMatchProjects,
    explore_ribbon_projects: exploreRibbonProjects,
    coverage_atlas: input.coverage_atlas,
    gap_ledger: input.gap_ledger,
    mission_discovery_status: input.mission_discovery_status,
    mission_degraded_reason_codes: input.mission_degraded_reason_codes,
  };
}
