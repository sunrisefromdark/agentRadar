import { describe, expect, it } from "vitest";
import { applyProjectSearchDailySections } from "../action/projectSearchDailySections.ts";
import type { DailyReport } from "../types.ts";

describe("applyProjectSearchDailySections", () => {
  it("writes the new daily fields and preserves compatibility aliases", () => {
    const report = applyProjectSearchDailySections({
      date: "2026-06-12",
      generated_at: "2026-06-12T08:00:00.000Z",
      enhancement_status: "rules-only",
      enhancement_audit: { rejected_outputs: [] },
      personalized_relevance_applicable: false,
      overall_daily_status: "数据新鲜，可直接阅读",
      freshness_sources: [],
      today_fresh_candidate_count: 1,
      context_candidate_count: 0,
      pending_confirmation_count: 0,
      main_board_mode: "fresh_today_only",
      today_star_projects: [],
      context_only_projects: [],
      new_projects: [],
      high_score_projects: [],
      anomaly_projects: [],
      all_projects: [],
    } as unknown as DailyReport, {
      today_pulse_projects: [
        {
          project: {
            project_name: "coder",
            repo_url: "https://github.com/acme/coder",
            repo_full_name: "acme/coder",
            first_seen: "2026-06-12",
            last_seen: "2026-06-12",
            sources: ["github_trending"],
            source_counts: {},
            appearances: 1,
            appearance_dates: ["2026-06-12"],
            persistence_state: "emerging",
            stars: 100,
            forks: 1,
            issues: 0,
            PR: 0,
            tags: [],
            description: "brief",
            metrics_source: "embedded",
            metrics_trust_score: 0.5,
            data_trust: "medium",
            star_delta_available: false,
            trust_flags: [],
            raw_signals: [],
          },
          score: {
            total_score: 80,
            components: [],
            verdict: "high",
            confidence: "high",
            trust_score: 0.8,
            data_trust: "medium",
            paradigm: "agent",
            anti_noise_flags: [],
            risks: [],
            next_actions: [],
            rules_only: true,
          },
          project_class: "today_star",
          objective_score: 80,
          preference_boost: 0,
          base_final_rank: 80,
          final_rank: 82,
          matched_interest_topics: [],
          project_brief_cn: "brief",
          why_today_cn: "why",
          enhancement_source: "template_fallback",
          appearance_reason_codes: ["today_pulse_anchor"],
          appearance_explanation_cn: "因为今天全局热度高。",
          exposure_bucket: "today_pulse",
          direction_matches: ["coding-agent"],
        },
      ],
      mission_match_projects: [],
      explore_ribbon_projects: [],
      coverage_atlas: [],
      gap_ledger: [],
      mission_discovery_status: "active",
      mission_degraded_reason_codes: [],
    });

    expect(report.today_pulse_projects).toHaveLength(1);
    expect(report.global_hot_projects).toEqual(report.today_pulse_projects);
    expect(report.demand_relevant_projects).toEqual(report.mission_match_projects);
    expect(report.searched_direction_statuses).toEqual(report.coverage_atlas);
    expect(report.today_star_projects).toEqual(report.today_pulse_projects);
  });
});
