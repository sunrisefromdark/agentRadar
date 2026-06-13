import type { DailyReport, DailyReportProjectDetail, DirectionCoverageStatus, MissionDiscoveryStatus, ScoredProject } from "../types.ts";

export interface ProjectSearchDailySectionsInput {
  today_pulse_projects: Array<ScoredProject & DailyReportProjectDetail>;
  mission_match_projects: Array<ScoredProject & DailyReportProjectDetail>;
  explore_ribbon_projects: Array<ScoredProject & DailyReportProjectDetail>;
  coverage_atlas: DirectionCoverageStatus[];
  gap_ledger: DirectionCoverageStatus[];
  mission_discovery_status: MissionDiscoveryStatus;
  mission_degraded_reason_codes: string[];
}

export function applyProjectSearchDailySections(report: DailyReport, sections: ProjectSearchDailySectionsInput): DailyReport {
  report.today_pulse_projects = sections.today_pulse_projects;
  report.mission_match_projects = sections.mission_match_projects;
  report.explore_ribbon_projects = sections.explore_ribbon_projects;
  report.coverage_atlas = sections.coverage_atlas;
  report.gap_ledger = sections.gap_ledger;
  report.mission_discovery_status = sections.mission_discovery_status;
  report.mission_degraded_reason_codes = sections.mission_degraded_reason_codes;
  report.global_hot_projects = report.today_pulse_projects;
  report.demand_relevant_projects = report.mission_match_projects;
  report.searched_direction_statuses = report.coverage_atlas;
  report.today_star_projects = report.today_pulse_projects;
  return report;
}
