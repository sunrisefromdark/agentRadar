import type { WeeklyIndustryTrendSection } from "./weeklySection.ts";

export type PublicWeeklyIndustryProjection = {
  projection_id: string;
  schema_version: "public-weekly-industry-projection.v1";
  source_weekly_section_ref: string;
  generated_at: string;
  window_start: string;
  window_end: string;
  publication_snapshot_at: string;
  headline_core_card_ids: string[];
  tier_visible_card_ids: string[];
  redacted_card_ids: string[];
  blocked_card_ids: string[];
  public_card_projection_refs: string[];
  blocked_reason_codes: string[];
};

export function buildPublicWeeklyIndustryProjection(input: {
  date: string;
  section: WeeklyIndustryTrendSection;
}): PublicWeeklyIndustryProjection {
  const allCardIds = [
    ...input.section.core_industry_trends,
    ...input.section.observing_industry_trends,
    ...input.section.wind_probes,
    ...input.section.project_heat_clusters,
    ...input.section.insufficient_evidence_directions,
  ].map((card) => card.card_id);

  return {
    projection_id: `public-weekly-industry-projection-${input.date}`,
    schema_version: "public-weekly-industry-projection.v1",
    source_weekly_section_ref: `industry://internal/${input.date}/weekly-industry-trend-section.v2/${input.section.section_id}`,
    generated_at: `${input.date}T23:59:59+08:00`,
    window_start: input.section.window_start,
    window_end: input.section.window_end,
    publication_snapshot_at: `${input.date}T23:59:59+08:00`,
    headline_core_card_ids: [],
    tier_visible_card_ids: [],
    redacted_card_ids: [],
    blocked_card_ids: allCardIds,
    public_card_projection_refs: [],
    blocked_reason_codes: allCardIds.length ? ["no_public_ready_cards"] : [],
  };
}
