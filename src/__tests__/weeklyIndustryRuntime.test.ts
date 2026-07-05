import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.ts";
import { buildWeeklyArtifacts } from "../action/weeklyEnhancement.ts";
import { renderWeeklyReport } from "../action/weeklyReport.ts";
import type { DailyReport, DailyRunSummary } from "../types.ts";

function makeDailyReport(date: string): DailyReport {
  return {
    date,
    generated_at: `${date}T08:00:00.000Z`,
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
  };
}

function makeRunSummary(date: string, withIndustryRuntimeSummary: boolean): DailyRunSummary {
  return {
    date,
    generated_at: `${date}T08:00:00.000Z`,
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
    observer_top_candidates: [],
    watchouts: [],
    next_focus: [],
    recommended_actions: [],
    industry_runtime_summary: withIndustryRuntimeSummary
      ? {
          artifact_kind: "industry_runtime_summary",
          date,
          generated_at: `${date}T08:00:00.000Z`,
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
            activation_profile_ids: ["axis-activation-policy.v1/capital_finance"],
            stop_profile_ids: ["canonical-fetch-stop-policy.v1/capital_finance"],
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
        }
      : undefined,
  };
}

describe("weekly industry runtime window summary", () => {
  it("carries daily runtime summaries into weekly artifacts and markdown", () => {
    const config = loadConfig("config.yaml");
    const days = [
      {
        date: "2026-06-25",
        scored: [],
        daily: makeDailyReport("2026-06-25"),
        runSummary: null,
      },
      {
        date: "2026-06-26",
        scored: [],
        daily: makeDailyReport("2026-06-26"),
        runSummary: makeRunSummary("2026-06-26", true),
      },
    ];

    const artifacts = buildWeeklyArtifacts(days, config);
    const summary = artifacts.report.industry_runtime_window_summary;
    const rendered = renderWeeklyReport(artifacts.report, { judgment: artifacts.judgment });

    expect(summary).toMatchObject({
      window_day_count: 2,
      days_with_run_summary: 1,
      days_with_industry_runtime_summary: 1,
      missing_run_summary_dates: ["2026-06-25"],
      missing_industry_runtime_summary_dates: ["2026-06-25"],
      policy_finance_runtime_ready_days: ["2026-06-26"],
      product_ecosystem_dry_run_ready_days: ["2026-06-26"],
      academic_preparatory_ready_days: ["2026-06-26"],
      latest_summary_date: "2026-06-26",
      latest_overall_status: "industry_runtime_contracts_ready",
      latest_academic_blocked_until: "formal_academic_handoff",
      latest_platform_contract_fixture: "platform-phase1-current-consumer.v1",
      latest_policy_finance_activation_profile_ids: ["axis-activation-policy.v1/capital_finance"],
      latest_policy_finance_stop_profile_ids: ["canonical-fetch-stop-policy.v1/capital_finance"],
      latest_policy_finance_review_profile_ids: ["same-run-review-availability-policy.v1/policy_finance"],
    });
    expect(artifacts.judgment.industry_runtime_window_summary).toEqual(summary);
    expect(artifacts.audit.industry_runtime_window_summary).toEqual(summary);
    expect(rendered).toContain("## Industry Runtime Window");
    expect(rendered).toContain("days_with_industry_runtime_summary: 1");
    expect(rendered).toContain("latest_academic_blocked_until: formal_academic_handoff");
    expect(rendered).toContain("policy_finance_runtime_ready_days: 2026-06-26");
    expect(rendered).toContain("latest_platform_contract_fixture: platform-phase1-current-consumer.v1");
    expect(rendered).toContain("latest_policy_finance_activation_profiles: axis-activation-policy.v1/capital_finance");
  });

  it("falls back to standalone industry runtime artifacts when run-summary is older", () => {
    const config = loadConfig("config.yaml");
    const standaloneIndustryRuntimeSummary = makeRunSummary("2026-06-26", true).industry_runtime_summary!;
    const days = [
      {
        date: "2026-06-25",
        scored: [],
        daily: makeDailyReport("2026-06-25"),
        runSummary: makeRunSummary("2026-06-25", false),
        industryRuntimeSummary: null,
      },
      {
        date: "2026-06-26",
        scored: [],
        daily: makeDailyReport("2026-06-26"),
        runSummary: makeRunSummary("2026-06-26", false),
        industryRuntimeSummary: standaloneIndustryRuntimeSummary,
      },
    ];

    const artifacts = buildWeeklyArtifacts(days, config);
    expect(artifacts.report.industry_runtime_window_summary).toMatchObject({
      days_with_run_summary: 2,
      days_with_industry_runtime_summary: 1,
      missing_industry_runtime_summary_dates: ["2026-06-25"],
      policy_finance_runtime_ready_days: ["2026-06-26"],
      latest_summary_date: "2026-06-26",
      latest_academic_blocked_until: "formal_academic_handoff",
      latest_platform_contract_fixture: "platform-phase1-current-consumer.v1",
      latest_policy_finance_activation_profile_ids: ["axis-activation-policy.v1/capital_finance"],
    });
  });
});
