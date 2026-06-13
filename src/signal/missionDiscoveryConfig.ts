import { PROJECT_SEARCH_CONSTANTS } from "./directionCatalog.ts";

export const MISSION_DISCOVERY_CONFIG = {
  query_pack_count_min: PROJECT_SEARCH_CONSTANTS.queryPackCountMin,
  query_template_count_per_pack_min: PROJECT_SEARCH_CONSTANTS.queryTemplateCountPerPackMin,
  raw_hits_min: PROJECT_SEARCH_CONSTANTS.directionRawHitsMin,
  normalized_hits_min: PROJECT_SEARCH_CONSTANTS.directionNormalizedHitsMin,
  quality_passed_hits_min: PROJECT_SEARCH_CONSTANTS.directionQualityPassedHitsMin,
  rolling_30d_searchable_catalog_min: 300,
  vertical_or_task_oriented_projects_min: 180,
  rolling_30d_qualified_projects_per_direction_min: 12,
  rolling_7d_qualified_non_head_projects_min: 30,
  global_hot_quota: PROJECT_SEARCH_CONSTANTS.globalHotQuota,
  demand_relevant_quota: PROJECT_SEARCH_CONSTANTS.demandRelevantQuota,
  anchor_seats: PROJECT_SEARCH_CONSTANTS.anchorSeatCount,
  challenger_seats: PROJECT_SEARCH_CONSTANTS.challengerSeatCount,
  task_area_same_direction_max_in_top3: 1,
  task_area_same_family_max: 2,
} as const;

// Frozen fairness rules:
// same direction max 1 seat in top 3 of mission area
// same family max 2 seats in mission area
// raw_hits >= 20
// normalized_hits >= 6
// quality_passed_hits >= 2
// query_pack_count >= 3
