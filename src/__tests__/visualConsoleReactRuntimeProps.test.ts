import { describe, expect, it } from "vitest";
import {
  buildOverviewReactProps,
  buildRunHealthReactProps,
  buildWeeklyReactProps,
} from "../../app/visualConsole/ossPages.ts";
import type { OverviewViewModel } from "../visualConsole/types.ts";
import { buildRunHealthView, buildWeeklyView } from "../visualConsole/build.ts";

describe("visual console react runtime props", () => {
  it("passes runtime contract details into weekly react props", () => {
    const view = buildWeeklyView("2026-06-13");
    const props = buildWeeklyReactProps(view, new URL("https://example.test/weekly?date=2026-06-13"), "zh", "light");

    expect(props.runtimeSummaryLines).toContain("fixture=platform-phase1-current-consumer.v1");
    expect(props.runtimeSummaryLines).toContain(
      "review=same-run-review-availability-policy.v1/policy_finance",
    );
    expect(props.runtimeSummaryLines?.some((line) => line.includes("activation=axis-activation-policy.v1/capital_finance"))).toBe(true);
  });

  it("passes runtime contract details into run-health react props", () => {
    const view = buildRunHealthView("2026-06-26");
    const props = buildRunHealthReactProps(view, "zh");

    expect(props.runtimeSummaryLines).toContain("overall_status=industry_runtime_contracts_ready");
    expect(props.runtimeSummaryLines).toContain("fixture=platform-phase1-current-consumer.v1");
    expect(props.runtimeSummaryLines).toContain("blocked_until=formal_academic_handoff");
  });

  it("surfaces runtime contract in overview diagnostics props", () => {
    const view = {
      context: {
        mode: "daily",
        selected_date: "2026-06-27",
        selected_window: null,
        entry_kind: "explicit-date",
        resolved_artifacts: [],
        generated_at: "2026-06-27T08:00:00.000Z",
        stale: false,
      },
      banner: {
        title: "Overview",
        context_label: "2026-06-27",
        generated_at: "2026-06-27T08:00:00.000Z",
        enhancement_status: "rules-only",
        mode_label: "rules-only",
        github_enrichment_status: "ok",
        source_health: "health-context-missing",
        notes: [],
      },
      state: { status: "degraded", reasons: [] },
      time_navigator: {
        mode: "daily",
        current_key: "2026-06-27",
        latest_key: "2026-06-27",
        previous_key: null,
        next_key: null,
        current_label: "2026-06-27",
        stale: false,
        window: { current: "2026-06-27", previous: null, next: null, latest: "2026-06-27", index: 0, total: 1 },
        previews: [],
      },
      route_frame: { route: "overview", hero: null, stage: [], rail: [], strip: [], dock: null, reader: null, audit: [] },
      run_snapshot: {
        date: "2026-06-27",
        daily_report: {
          date: "2026-06-27",
          generated_at: "2026-06-27T08:00:00.000Z",
          enhancement_status: "rules-only",
          enhancement_audit: { rejected_outputs: [] },
          personalized_relevance_applicable: false,
          overall_daily_status: "数据部分回退，谨慎参考",
          freshness_sources: [],
          today_fresh_candidate_count: 0,
          context_candidate_count: 0,
          pending_confirmation_count: 0,
          main_board_mode: "partial_fresh",
          today_star_projects: [],
          context_only_projects: [],
          today_pulse_projects: [],
          mission_match_projects: [],
          explore_ribbon_projects: [],
          coverage_atlas: [],
          gap_ledger: [],
          mission_discovery_status: "degraded",
          mission_degraded_reason_codes: [],
          global_hot_projects: [],
          demand_relevant_projects: [],
          searched_direction_statuses: [],
          new_projects: [],
          high_score_projects: [],
          anomaly_projects: [],
          all_projects: [],
        },
        run_summary: null,
        industry_runtime_summary: {
          artifact_kind: "industry_runtime_summary",
          date: "2026-06-27",
          generated_at: "2026-06-27T08:00:00.000Z",
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
        },
        verify_result: null,
        github_audit: null,
        observer_artifact: null,
      },
      top_decisions: [],
      semantic_bands: [],
      risks_and_actions: [],
      weekly_entry: null,
    } satisfies OverviewViewModel;
    const props = buildOverviewReactProps(
      view,
      new URL("https://example.test/overview?date=2026-06-27"),
      "zh",
      "light",
    );

    const runtimeDiagnostic = props.riskDiagnostics?.find((item) => item.key === "runtime-contract");
    expect(runtimeDiagnostic?.body).toContain("platform-phase1-current-consumer.v1");
    expect(runtimeDiagnostic?.body).toContain("blocked_until=formal_academic_handoff");
  });
});
