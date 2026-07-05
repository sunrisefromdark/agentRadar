import type { WeeklyIndustryTrendSection } from "./weeklySection.ts";

export type ConsumerWeeklyIndustryView = {
  view_id: string;
  schema_version: "consumer-weekly-industry-view.v1";
  source_weekly_section_ref: string;
  generated_at: string;
  window_start: string;
  window_end: string;
  view_scope: "internal-product";
  visible_card_ids: string[];
  headline_card_ids: string[];
  watchlist_card_ids: string[];
  needs_review_card_ids: string[];
  hidden_card_ids: string[];
  ordering_basis: string;
  card_projection_refs: string[];
};

export function buildConsumerWeeklyIndustryView(input: {
  date: string;
  section: WeeklyIndustryTrendSection;
}): ConsumerWeeklyIndustryView {
  const visibleCardIds = [
    ...input.section.core_industry_trends,
    ...input.section.observing_industry_trends,
    ...input.section.wind_probes,
    ...input.section.project_heat_clusters,
    ...input.section.insufficient_evidence_directions,
  ].map((card) => card.card_id);

  return {
    view_id: `consumer-weekly-industry-view-${input.date}`,
    schema_version: "consumer-weekly-industry-view.v1",
    source_weekly_section_ref: `industry://internal/${input.date}/weekly-industry-trend-section.v2/${input.section.section_id}`,
    generated_at: `${input.date}T23:59:59+08:00`,
    window_start: input.section.window_start,
    window_end: input.section.window_end,
    view_scope: "internal-product",
    visible_card_ids: visibleCardIds,
    headline_card_ids: [],
    watchlist_card_ids: input.section.observing_industry_trends.map((card) => card.card_id),
    needs_review_card_ids: input.section.display_index.needs_review_card_ids,
    hidden_card_ids: [],
    ordering_basis: input.section.ordering_basis,
    card_projection_refs: visibleCardIds.map((cardId) => `industry://consumer/${input.date}/industry-trend-card.v1/${cardId}`),
  };
}
