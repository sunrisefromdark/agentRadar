import { describe, expect, it } from "vitest";
import { renderProjectsView, renderRunHealthView } from "../visualConsole/render.ts";
import type { ProjectsViewModel, RunHealthViewModel } from "../visualConsole/types.ts";
import type { DailyReport } from "../types.ts";

function makeProject(overrides: Partial<ProjectsViewModel["projects"][number]> = {}): ProjectsViewModel["projects"][number] {
  return {
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
      forks: 2,
      issues: 1,
      PR: 0,
      tags: [],
      description: "brief",
      metrics_source: "embedded",
      metrics_trust_score: 0.6,
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
    ...overrides,
  };
}

describe("visual console mission-facing views", () => {
  it("renders project sections with direction and appearance reasons", () => {
    const pulse = makeProject();
    const mission = makeProject({
      project: { ...pulse.project, project_name: "mission-fit", repo_full_name: "acme/mission-fit", repo_url: "https://github.com/acme/mission-fit" },
      exposure_bucket: "mission_match",
      appearance_reason_codes: ["mission_direction_match"],
      direction_matches: ["workflow-automation-agent"],
    });
    const explore = makeProject({
      project: { ...pulse.project, project_name: "explore", repo_full_name: "acme/explore", repo_url: "https://github.com/acme/explore" },
      exposure_bucket: "explore_ribbon",
      appearance_reason_codes: ["explore_ribbon_fill"],
    });
    const historical = makeProject({
      project: { ...pulse.project, project_name: "history", repo_full_name: "acme/history", repo_url: "https://github.com/acme/history" },
      exposure_bucket: "historical_context",
    });

    const model: ProjectsViewModel = {
      context: {
        mode: "daily",
        selected_date: "2026-06-12",
        selected_window: null,
        entry_kind: "explicit-date",
        resolved_artifacts: [],
        generated_at: "2026-06-12T08:00:00.000Z",
        stale: false,
      },
      banner: {
        title: "Projects",
        context_label: "2026-06-12",
        generated_at: "2026-06-12T08:00:00.000Z",
        enhancement_status: "rules-only",
        mode_label: "rules-only",
        github_enrichment_status: "ok",
        source_health: "ok",
        notes: [],
      },
      state: { status: "ready", reasons: [] },
      time_navigator: {
        mode: "daily",
        current_key: "2026-06-12",
        latest_key: "2026-06-12",
        previous_key: null,
        next_key: null,
        current_label: "2026-06-12",
        stale: false,
        window: { current: "2026-06-12", previous: null, next: null, latest: "2026-06-12", index: 0, total: 1 },
        previews: [],
      },
      route_frame: { route: "projects", hero: null, stage: [], rail: [], strip: [], dock: null, reader: null, audit: [] },
      today_pulse_projects: [pulse],
      mission_match_projects: [mission],
      explore_ribbon_projects: [explore],
      historical_context_projects: [historical],
      projects: [pulse, mission, explore, historical],
      selected_project: null,
    };

    const rendered = renderProjectsView(model);
    expect(rendered).toContain("## Today Pulse");
    expect(rendered).toContain("## Mission Match");
    expect(rendered).toContain("## Explore Ribbon");
    expect(rendered).toContain("appearance_reason_codes=mission_direction_match");
    expect(rendered).toContain("directions=workflow-automation-agent");
  });

  it("renders mission degraded, coverage atlas and gap ledger in run health", () => {
    const model: RunHealthViewModel = {
      context: {
        mode: "daily",
        selected_date: "2026-06-12",
        selected_window: null,
        entry_kind: "explicit-date",
        resolved_artifacts: [],
        generated_at: "2026-06-12T08:00:00.000Z",
        stale: false,
      },
      banner: {
        title: "Run Health",
        context_label: "2026-06-12",
        generated_at: "2026-06-12T08:00:00.000Z",
        enhancement_status: "rules-only",
        mode_label: "rules-only",
        github_enrichment_status: "ok",
        source_health: "ok",
        notes: [],
      },
      state: { status: "ready", reasons: [] },
      time_navigator: {
        mode: "daily",
        current_key: "2026-06-12",
        latest_key: "2026-06-12",
        previous_key: null,
        next_key: null,
        current_label: "2026-06-12",
        stale: false,
        window: { current: "2026-06-12", previous: null, next: null, latest: "2026-06-12", index: 0, total: 1 },
        previews: [],
      },
      route_frame: { route: "run-health", hero: null, stage: [], rail: [], strip: [], dock: null, reader: null, audit: [] },
      run_snapshot: {
        date: "2026-06-12",
        daily_report: {} as DailyReport,
        verify_result: {
          date: "2026-06-12",
          status: "warn",
          summary_path: "a",
          github_audit_path: "b",
          checks: [],
          recommended_actions: [],
        },
        github_audit: [],
        observer_artifact: null,
        run_summary: {
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
            metrics_source_distribution: { embedded: 0, github_api: 0, github_html: 0, github_cache: 0, unavailable: 0 },
            star_delta_source_distribution: { github_live: 0, github_snapshot: 0, signal: 0, unavailable: 0 },
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
          observer_top_candidates: [],
          watchouts: [],
          next_focus: [],
          recommended_actions: [],
          mission_discovery_status: "degraded",
          mission_degraded_reason_codes: ["no_matched_direction", "observer_not_promoted"],
          coverage_atlas: [
            {
              direction_key: "coding-agent",
              family_key: "agent-stack",
              display_name_cn: "编码代理",
              boundary_mode: "strict-agent",
              search_depth: "deep",
              query_pack_count: 3,
              query_template_count: 6,
              lane_types: ["canonical", "job-to-be-done", "user-speak-or-ecosystem"],
              pressure_state: "pressurized",
              outcome: "weak_signal",
              reason_codes: ["quality_floor_unmet"],
              explanation_cn: "weak",
              next_action: "upgrade_to_deep",
              candidate_counts: { raw_hits: 1, boundary_passed_hits: 1, normalized_hits: 1, quality_passed_hits: 0, exposed_hits: 0 },
              quantity_target_met: false,
              search_exhausted: true,
            },
          ],
          gap_ledger: [
            {
              direction_key: "coding-agent",
              family_key: "agent-stack",
              display_name_cn: "编码代理",
              boundary_mode: "strict-agent",
              search_depth: "deep",
              query_pack_count: 3,
              query_template_count: 6,
              lane_types: ["canonical", "job-to-be-done", "user-speak-or-ecosystem"],
              pressure_state: "pressurized",
              outcome: "weak_signal",
              reason_codes: ["quality_floor_unmet"],
              explanation_cn: "weak",
              next_action: "upgrade_to_deep",
              candidate_counts: { raw_hits: 1, boundary_passed_hits: 1, normalized_hits: 1, quality_passed_hits: 0, exposed_hits: 0 },
              quantity_target_met: false,
              search_exhausted: true,
            },
          ],
        },
      },
    };

    const rendered = renderRunHealthView(model);
    expect(rendered).toContain("## Mission Health");
    expect(rendered).toContain("mission_discovery_status: degraded");
    expect(rendered).toContain("## Coverage Atlas");
    expect(rendered).toContain("search_exhausted=true");
    expect(rendered).toContain("## Gap Ledger");
  });
});
