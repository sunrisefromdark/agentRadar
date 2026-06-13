import { describe, expect, it } from "vitest";
import { renderDailyRunSummary } from "../action/runSummary.ts";
import type { DailyRunSummary } from "../types.ts";

describe("renderDailyRunSummary observer section", () => {
  it("renders incubating directions and formal promotion candidates from the observer artifact", () => {
    const summary: DailyRunSummary = {
      date: "2026-06-12",
      generated_at: "2026-06-12T08:00:00.000Z",
      dry_run: true,
      minimum_viable_run_completed: true,
      completion_notes: [],
      counts: {
        raw_signals: 0,
        normalized_projects: 0,
        scored_projects: 0,
        high_score_projects: 0,
        anomaly_projects: 0,
        new_projects: 0,
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
        emerging_projects: 0,
        persistent_projects: 0,
      },
      diagnostics: {
        anomaly_share: 0,
        uniform_star_velocity_detected: false,
        metrics_source_distribution: {
          embedded: 0,
          github_api: 0,
          github_html: 0,
          github_cache: 0,
          unavailable: 0,
        },
        star_delta_source_distribution: {
          github_live: 0,
          github_snapshot: 0,
          signal: 0,
          unavailable: 0,
        },
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
      observer_status: {
        ecosystem_focus: "active",
      },
      observer_candidate_count: 1,
      observer_ecosystem_counts: {
        "multi-agent-coordination": 1,
      },
      observer_incubating_directions: [
        {
          direction_key: "multi-agent-coordination",
          display_name_cn: "多代理协作生态",
          status: "incubating-active",
          observer_hits_7d: 3,
          candidate_repo_count: 1,
          related_ecosystems: ["multi-agent-coordination"],
          related_catalog_direction_keys: ["workflow-automation-agent"],
          related_gap_pressure_states: ["pressurized"],
          representative_repos: [
            {
              repo_full_name: "acme/swarm-today",
              repo_url: "https://github.com/acme/swarm-today",
            },
          ],
          evidence: ["observer_hits_7d=3", "gap_pressure=pressurized"],
          unmet_gates: [],
          promotion_candidate: true,
          review_queue: "observer promotion review",
        },
      ],
      observer_promotion_candidates: [
        {
          direction_key: "multi-agent-coordination",
          display_name_cn: "多代理协作生态",
          evidence: ["observer_hits_7d=3", "gap_pressure=pressurized"],
          unmet_gates: [],
        },
      ],
      mission_metrics: {
        outcome_distribution: {},
        pressure_state_distribution: {
          promoted: 1,
        },
        deep_upgrade_direction_count: 0,
        search_exhausted_direction_count: 0,
        quantity_target_met_count: 0,
        observer_promotion_candidate_count: 1,
      },
      observer_top_candidates: [],
      watchouts: [],
      next_focus: [],
      recommended_actions: [],
    };

    const rendered = renderDailyRunSummary(summary);
    expect(rendered).toContain("incubating_direction multi-agent-coordination");
    expect(rendered).toContain("observer_promotion_candidate multi-agent-coordination");
    expect(rendered).toContain("observer_promotion_candidate_count: 1");
    expect(rendered).toContain("pressure_state_distribution");
  });
});
