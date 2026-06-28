import { describe, expect, it } from "vitest";
import { renderProjectsView, renderRunHealthView } from "../visualConsole/render.ts";
import { buildRunHealthView } from "../visualConsole/build.ts";
import type { ProjectsViewModel, RunHealthViewModel } from "../visualConsole/types.ts";
import type { DailyReport } from "../types.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function withProjectPresetDefaults(
  project: Omit<ProjectsViewModel["projects"][number], "preset_bucket" | "preset_memberships" | "utility_hint" | "repeat_exposure_state" | "head_project_exception_reason" | "hard_infra"> &
    Partial<Pick<ProjectsViewModel["projects"][number], "preset_bucket" | "preset_memberships" | "utility_hint" | "repeat_exposure_state" | "head_project_exception_reason" | "hard_infra">>,
): ProjectsViewModel["projects"][number] {
  const presetBucket = project.preset_bucket ?? "useful_first";
  return {
    ...project,
    preset_bucket: presetBucket,
    preset_memberships: project.preset_memberships ?? [presetBucket],
    utility_hint: project.utility_hint ?? "general",
    repeat_exposure_state: project.repeat_exposure_state ?? "fresh",
    head_project_exception_reason: project.head_project_exception_reason ?? null,
    hard_infra: project.hard_infra ?? false,
  };
}

function makeProject(overrides: Partial<ProjectsViewModel["projects"][number]> = {}): ProjectsViewModel["projects"][number] {
  return withProjectPresetDefaults({
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
  });
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
      default_preset: "all",
      preset_query_enabled: false,
      preset_groups: {
        useful_first: [pulse, mission, explore, historical],
        by_scenario: [],
        worth_trying_today: [],
        infra_tools: [],
        supplemental_inventory: [],
      },
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
          industry_runtime_summary: {
            artifact_kind: "industry_runtime_summary",
            date: "2026-06-12",
            generated_at: "2026-06-12T08:00:00.000Z",
            overall_status: "industry_runtime_contracts_ready",
            platform_contract: {
              fixture_id: "platform-phase1-current-consumer.v1",
              published_for: ["finance-agent", "policy-agent", "academic-agent"],
              handoff_payload_schema_count: 4,
              feedback_payload_schema_count: 3,
              runtime_artifact_schema_count: 6,
              shared_governance_published: true,
              shared_governance_profile_count: 33,
              dispatch_gate: {
                same_run_requires_count: 5,
                high_cost_requires_reservation_state: "granted",
                budget_rejected_blocks_start: true,
                async_only_review_is_not_same_run_available: true,
              },
              event_consumer_gate: {
                execution_context_primary_responsibility_matches_responsibility: true,
                operational_executor_id_required: true,
                takeover_requires_takeover_audit_ref: true,
              },
            },
            policy_finance: {
              status: "policy_finance_runtime_ready",
              negative_reason_code: "dispatch_context_missing",
              runtime_consumed_same_run_messages: 19,
              activation_profile_ids: ["axis-activation-policy.v1/finance_capital"],
              stop_profile_ids: ["canonical-fetch-stop-policy.v1/finance_capital"],
              review_profile_ids: ["same-run-review-availability-policy.v1/policy_finance"],
            },
            product_ecosystem: {
              status: "normalization_dry_run_ready",
              normalized_event_batch_refs_count: 6,
              coverage_refs_count: 5,
              contribution_refs_count: 6,
            },
            academic_preparatory: {
              status: "academic_preparatory_normalization_dry_run_ready",
              blocked_until: "formal_academic_handoff",
              promotion_ready: false,
              normalized_event_batch_refs_count: 2,
            },
          },
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
    expect(rendered).toContain("## Industry Runtime");
    expect(rendered).toContain("governance_published=true");
    expect(rendered).toContain("blocked_until=formal_academic_handoff");
    expect(rendered).toContain("等待 academic 侧交付 formal_academic_handoff 后再继续推进 formal runtime 集成");
    expect(rendered).toContain("## Mission Health");
    expect(rendered).toContain("mission_discovery_status: degraded");
    expect(rendered).toContain("## Coverage Atlas");
    expect(rendered).toContain("search_exhausted=true");
    expect(rendered).toContain("## Gap Ledger");
  });

  it("surfaces academic formal handoff blockage in run health banner notes", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-run-health-"));
    const cwd = process.cwd();
    try {
      fs.mkdirSync(path.join(root, "data", "reports"), { recursive: true });
      fs.mkdirSync(path.join(root, "data", "raw", "github"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "data", "reports", "2026-06-12.daily.json"),
        JSON.stringify({
          date: "2026-06-12",
          generated_at: "2026-06-12T08:00:00.000Z",
          enhancement_status: "rules-only",
          enhancement_audit: { rejected_outputs: [] },
          personalized_relevance_applicable: false,
          overall_daily_status: "数据新鲜，可直接阅读",
          freshness_sources: [],
          today_fresh_candidate_count: 0,
          context_candidate_count: 0,
          pending_confirmation_count: 0,
          main_board_mode: "fresh_today_only",
          today_star_projects: [],
          context_only_projects: [],
          today_pulse_projects: [],
          mission_match_projects: [],
          explore_ribbon_projects: [],
          coverage_atlas: [],
          gap_ledger: [],
          mission_discovery_status: "active",
          mission_degraded_reason_codes: [],
          global_hot_projects: [],
          demand_relevant_projects: [],
          searched_direction_statuses: [],
          new_projects: [],
          high_score_projects: [],
          anomaly_projects: [],
          all_projects: [],
        }),
      );
      fs.writeFileSync(
        path.join(root, "data", "reports", "2026-06-12.run-summary.json"),
        JSON.stringify({
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
          industry_runtime_summary: {
            artifact_kind: "industry_runtime_summary",
            date: "2026-06-12",
            generated_at: "2026-06-12T08:00:00.000Z",
            overall_status: "industry_runtime_contracts_ready",
            platform_contract: {
              fixture_id: "platform-phase1-current-consumer.v1",
              published_for: ["finance-agent", "policy-agent", "academic-agent"],
              handoff_payload_schema_count: 4,
              feedback_payload_schema_count: 3,
              runtime_artifact_schema_count: 6,
              shared_governance_published: true,
              shared_governance_profile_count: 33,
              dispatch_gate: {
                same_run_requires_count: 5,
                high_cost_requires_reservation_state: "granted",
                budget_rejected_blocks_start: true,
                async_only_review_is_not_same_run_available: true,
              },
              event_consumer_gate: {
                execution_context_primary_responsibility_matches_responsibility: true,
                operational_executor_id_required: true,
                takeover_requires_takeover_audit_ref: true,
              },
            },
            policy_finance: {
              status: "policy_finance_runtime_ready",
              negative_reason_code: "dispatch_context_missing",
              runtime_consumed_same_run_messages: 19,
              activation_profile_ids: ["axis-activation-policy.v1/finance_capital"],
              stop_profile_ids: ["canonical-fetch-stop-policy.v1/finance_capital"],
              review_profile_ids: ["same-run-review-availability-policy.v1/policy_finance"],
            },
            product_ecosystem: {
              status: "normalization_dry_run_ready",
              normalized_event_batch_refs_count: 6,
              coverage_refs_count: 5,
              contribution_refs_count: 6,
            },
            academic_preparatory: {
              status: "academic_preparatory_normalization_dry_run_ready",
              blocked_until: "formal_academic_handoff",
              promotion_ready: false,
              normalized_event_batch_refs_count: 2,
            },
          },
        }),
      );
      fs.writeFileSync(
        path.join(root, "data", "reports", "2026-06-12.verify-daily.json"),
        JSON.stringify({
          date: "2026-06-12",
          status: "pass",
          summary_path: "a",
          github_audit_path: "b",
          checks: [],
          recommended_actions: [],
        }),
      );
      fs.writeFileSync(path.join(root, "data", "raw", "github", "2026-06-12.enrichment.json"), JSON.stringify([]));

      process.chdir(root);
      const view = buildRunHealthView("2026-06-12");
      expect(view.banner.notes).toContain("academic runtime 仍阻塞于 formal_academic_handoff");
    } finally {
      process.chdir(cwd);
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("hydrates industry runtime from the standalone artifact when run-summary is older", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-run-health-fallback-"));
    const cwd = process.cwd();
    try {
      fs.mkdirSync(path.join(root, "data", "reports"), { recursive: true });
      fs.mkdirSync(path.join(root, "data", "raw", "github"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "data", "reports", "2026-06-26.daily.json"),
        JSON.stringify({
          date: "2026-06-26",
          generated_at: "2026-06-26T08:00:00.000Z",
          enhancement_status: "rules-only",
          enhancement_audit: { rejected_outputs: [] },
          personalized_relevance_applicable: false,
          overall_daily_status: "数据新鲜，可直接阅读",
          freshness_sources: [],
          today_fresh_candidate_count: 0,
          context_candidate_count: 0,
          pending_confirmation_count: 0,
          main_board_mode: "fresh_today_only",
          today_star_projects: [],
          context_only_projects: [],
          today_pulse_projects: [],
          mission_match_projects: [],
          explore_ribbon_projects: [],
          coverage_atlas: [],
          gap_ledger: [],
          mission_discovery_status: "active",
          mission_degraded_reason_codes: [],
          global_hot_projects: [],
          demand_relevant_projects: [],
          searched_direction_statuses: [],
          new_projects: [],
          high_score_projects: [],
          anomaly_projects: [],
          all_projects: [],
        }),
      );
      fs.writeFileSync(
        path.join(root, "data", "reports", "2026-06-26.run-summary.json"),
        JSON.stringify({
          date: "2026-06-26",
          generated_at: "2026-06-26T08:00:00.000Z",
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
        }),
      );
      fs.writeFileSync(
        path.join(root, "data", "reports", "2026-06-26.industry-runtime-summary.json"),
        JSON.stringify({
          artifact_kind: "industry_runtime_summary",
          date: "2026-06-26",
          generated_at: "2026-06-26T09:00:00.000Z",
          overall_status: "industry_runtime_contracts_ready",
          platform_contract: {
            fixture_id: "platform-phase1-current-consumer.v1",
            published_for: ["finance-agent", "policy-agent", "academic-agent"],
            handoff_payload_schema_count: 4,
            feedback_payload_schema_count: 3,
            runtime_artifact_schema_count: 6,
            shared_governance_published: true,
            shared_governance_profile_count: 33,
            dispatch_gate: {
              same_run_requires_count: 5,
              high_cost_requires_reservation_state: "granted",
              budget_rejected_blocks_start: true,
              async_only_review_is_not_same_run_available: true,
            },
            event_consumer_gate: {
              execution_context_primary_responsibility_matches_responsibility: true,
              operational_executor_id_required: true,
              takeover_requires_takeover_audit_ref: true,
            },
          },
          policy_finance: {
            status: "policy_finance_runtime_ready",
            negative_reason_code: "dispatch_context_missing",
            runtime_consumed_same_run_messages: 19,
            activation_profile_ids: ["axis-activation-policy.v1/finance_capital"],
            stop_profile_ids: ["canonical-fetch-stop-policy.v1/finance_capital"],
            review_profile_ids: ["same-run-review-availability-policy.v1/policy_finance"],
          },
          product_ecosystem: {
            status: "normalization_dry_run_ready",
            normalized_event_batch_refs_count: 6,
            coverage_refs_count: 5,
            contribution_refs_count: 6,
          },
          academic_preparatory: {
            status: "academic_preparatory_normalization_dry_run_ready",
            blocked_until: "formal_academic_handoff",
            promotion_ready: false,
            normalized_event_batch_refs_count: 2,
          },
        }),
      );
      fs.writeFileSync(
        path.join(root, "data", "reports", "2026-06-26.verify-daily.json"),
        JSON.stringify({
          date: "2026-06-26",
          status: "pass",
          summary_path: "a",
          github_audit_path: "b",
          checks: [],
          recommended_actions: [],
        }),
      );
      fs.writeFileSync(path.join(root, "data", "raw", "github", "2026-06-26.enrichment.json"), JSON.stringify([]));

      process.chdir(root);
      const view = buildRunHealthView("2026-06-26");
      const rendered = renderRunHealthView(view);
      expect(view.banner.notes).toContain("industry runtime 已从独立 artifact 回填到 run health");
      expect(rendered).toContain("overall_status: industry_runtime_contracts_ready");
      expect(rendered).toContain("policy_finance_runtime_ready");
      expect(rendered).toContain("activation_profiles=");
      expect(rendered).not.toContain("overall_status: missing");
    } finally {
      process.chdir(cwd);
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("resolves latest run health from runtime-only dates", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-run-health-latest-"));
    const cwd = process.cwd();
    try {
      fs.mkdirSync(path.join(root, "data", "reports"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "data", "reports", "2026-06-20.daily.json"),
        JSON.stringify({
          date: "2026-06-20",
          generated_at: "2026-06-20T08:00:00.000Z",
          enhancement_status: "rules-only",
          enhancement_audit: { rejected_outputs: [] },
          personalized_relevance_applicable: false,
          overall_daily_status: "数据新鲜，可直接阅读",
          freshness_sources: [],
          today_fresh_candidate_count: 0,
          context_candidate_count: 0,
          pending_confirmation_count: 0,
          main_board_mode: "fresh_today_only",
          today_star_projects: [],
          context_only_projects: [],
          today_pulse_projects: [],
          mission_match_projects: [],
          explore_ribbon_projects: [],
          coverage_atlas: [],
          gap_ledger: [],
          mission_discovery_status: "active",
          mission_degraded_reason_codes: [],
          global_hot_projects: [],
          demand_relevant_projects: [],
          searched_direction_statuses: [],
          new_projects: [],
          high_score_projects: [],
          anomaly_projects: [],
          all_projects: [],
        }),
      );
      fs.writeFileSync(
        path.join(root, "data", "reports", "2026-06-26.industry-runtime-summary.json"),
        JSON.stringify({
          artifact_kind: "industry_runtime_summary",
          date: "2026-06-26",
          generated_at: "2026-06-26T09:00:00.000Z",
          overall_status: "industry_runtime_contracts_ready",
          platform_contract: {
            fixture_id: "platform-phase1-current-consumer.v1",
            published_for: ["finance-agent", "policy-agent"],
            handoff_payload_schema_count: 4,
            feedback_payload_schema_count: 3,
            runtime_artifact_schema_count: 6,
            shared_governance_published: true,
            shared_governance_profile_count: 33,
            dispatch_gate: {
              same_run_requires_count: 5,
              high_cost_requires_reservation_state: "granted",
              budget_rejected_blocks_start: true,
              async_only_review_is_not_same_run_available: true,
            },
            event_consumer_gate: {
              execution_context_primary_responsibility_matches_responsibility: true,
              operational_executor_id_required: true,
              takeover_requires_takeover_audit_ref: true,
            },
          },
          policy_finance: {
            status: "policy_finance_runtime_ready",
            negative_reason_code: "dispatch_context_missing",
            runtime_consumed_same_run_messages: 19,
            activation_profile_ids: ["axis-activation-policy.v1/finance_capital"],
            stop_profile_ids: ["canonical-fetch-stop-policy.v1/finance_capital"],
            review_profile_ids: ["same-run-review-availability-policy.v1/policy_finance"],
          },
          product_ecosystem: {
            status: "normalization_dry_run_ready",
            normalized_event_batch_refs_count: 6,
            coverage_refs_count: 5,
            contribution_refs_count: 6,
          },
          academic_preparatory: {
            status: "academic_preparatory_normalization_dry_run_ready",
            blocked_until: "formal_academic_handoff",
            promotion_ready: false,
            normalized_event_batch_refs_count: 2,
          },
        }),
      );

      process.chdir(root);
      const view = buildRunHealthView("latest");
      expect(view.context.selected_date).toBe("2026-06-26");
      expect(view.time_navigator.current_key).toBe("2026-06-26");
      expect(view.time_navigator.latest_key).toBe("2026-06-26");
      expect(view.banner.notes).toContain("industry runtime 仅来自独立 artifact");
    } finally {
      process.chdir(cwd);
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
