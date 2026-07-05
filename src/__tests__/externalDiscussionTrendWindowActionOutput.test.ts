import { describe, expect, it } from "vitest";
import { renderDailyRunSummary } from "../action/runSummary.ts";
import type { DailyRunSummary } from "../types.ts";

function makeSummary(): DailyRunSummary {
  return {
    date: "2026-07-03",
    generated_at: "2026-07-03T00:00:00.000Z",
    dry_run: true,
    minimum_viable_run_completed: true,
    completion_notes: [],
    counts: {
      raw_signals: 1,
      normalized_projects: 1,
      scored_projects: 1,
      high_score_projects: 0,
      anomaly_projects: 0,
      new_projects: 1,
      classifications: 0,
    },
    source_status: [],
    quality: {
      missing_descriptions: 0,
      watchlist_hits: 0,
      low_confidence_projects: 0,
      medium_confidence_projects: 0,
      insufficient_metrics_projects: 0,
      suspicious_growth_projects: 0,
      single_source_projects: 0,
      single_spike_projects: 0,
      emerging_projects: 1,
      persistent_projects: 0,
    },
    diagnostics: {
      anomaly_share: 0,
      uniform_star_velocity_detected: false,
      metrics_source_distribution: { embedded: 1, github_api: 0, github_html: 0, github_cache: 0, unavailable: 0 },
      star_delta_source_distribution: { github_live: 0, github_snapshot: 0, signal: 1, unavailable: 0 },
      github_star_delta: {
        live_delta_attempts: 0,
        live_delta_success: 0,
        snapshot_delta_success: 0,
        token_missing: 0,
        rate_limit: 0,
        network_blocked: 0,
      },
    },
    top_projects: [],
    external_discovery: {
      aggregate_status: "ok",
      accepted_event_count: 3,
      rejected_event_count: 0,
      observation_candidate_count: 1,
      project_evidence_count: 1,
      direction_evidence_count: 0,
      explanation_status: "ok",
      explanation_eligible_count: 1,
      explanation_attempted_count: 1,
      explanation_enhanced_count: 1,
      explanation_fallback_count: 0,
      explanation_rejected_count: 0,
      trend_window_read_status: "ok",
      trend_window_status: "ok",
      trend_window_path: "data/external-discovery/windows/2026-07-03.discussion-trend-window.json",
      trend_window_usable_day_count: 7,
      trend_window_project_trend_count: 1,
      trend_window_direction_trend_count: 0,
      trend_window_failed_date_count: 0,
      trend_window_missing_date_count: 0,
      warning_count: 0,
      warnings: [],
    },
    observer_top_candidates: [],
    watchouts: [],
    next_focus: [],
    recommended_actions: [],
  };
}

describe("external discussion trend window action output", () => {
  it("renders trend window read status and coverage in daily run summary", () => {
    const rendered = renderDailyRunSummary(makeSummary());
    expect(rendered).toContain("trend_window_read_status: ok");
    expect(rendered).toContain("trend_window_status: ok");
    expect(rendered).toContain("trend_window_coverage: usable_days=7; failed_dates=0; missing_dates=0");
    expect(rendered).toContain("trend_window_items: project=1; direction=0");
  });
});
