import { describe, expect, it } from "vitest";
import { renderPrimary } from "../../app/visualConsole/ossPages.ts";
import type { OverviewViewModel } from "../visualConsole/types.ts";
import { buildOverviewView, buildRunHealthView, buildWeeklyView } from "../visualConsole/build.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("visual console web runtime rendering", () => {
  it("renders runtime contract summary in weekly SSR html", () => {
    const html = renderPrimary(
      { route: "weekly", model: buildWeeklyView("2026-06-13") },
      new URL("http://localhost/weekly?date=2026-06-13"),
      "zh",
      "light",
    );

    expect(html).toContain("fixture=platform-phase1-current-consumer.v1");
    expect(html).toContain("blocked_until=formal_academic_handoff");
    expect(html).toContain("same-run-review-availability-policy.v1/policy_finance");
  });

  it("renders runtime contract summary in run-health SSR html", () => {
    const html = renderPrimary(
      { route: "run-health", model: buildRunHealthView("2026-06-26") },
      new URL("http://localhost/run-health?date=2026-06-26"),
      "zh",
      "light",
    );

    expect(html).toContain("overall_status=industry_runtime_contracts_ready");
    expect(html).toContain("fixture=platform-phase1-current-consumer.v1");
    expect(html).toContain("blocked_until=formal_academic_handoff");
  });

  it("renders runtime contract diagnostic in overview SSR html", () => {
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

    const html = renderPrimary(
      { route: "overview", model: view },
      new URL("http://localhost/overview?date=2026-06-27"),
      "zh",
      "light",
    );

    expect(html).toContain("platform-phase1-current-consumer.v1 已接通");
    expect(html).toContain("blocked_until=formal_academic_handoff");
    expect(html).toContain("same-run-review-availability-policy.v1/policy_finance");
  });

  it("falls back to replay-only runtime html when industry summary is absent", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-runtime-replay-only-"));
    const cwd = process.cwd();
    try {
      fs.mkdirSync(path.join(root, "data", "reports"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "data", "reports", "2026-06-29.policy-finance-runtime-replay.json"),
        JSON.stringify(
          {
            artifact_kind: "policy_finance_runtime_replay",
            date: "2026-06-29",
            generated_at: "2026-06-29T08:00:00.000Z",
            fixture_id: "platform-phase1-current-consumer.v1",
            current_status: "policy_finance_runtime_ready",
            negative_reason_code: "dispatch_context_missing",
            runtime_consumed_same_run_messages: 19,
            activation_profile_ids: ["axis-activation-policy.v1/capital_finance"],
            stop_profile_ids: ["canonical-fetch-stop-policy.v1/capital_finance"],
            review_profile_ids: ["same-run-review-availability-policy.v1/policy_finance"],
          },
          null,
          2,
        ),
      );

      process.chdir(root);
      const html = renderPrimary(
        { route: "run-health", model: buildRunHealthView("2026-06-29") },
        new URL("http://localhost/run-health?date=2026-06-29"),
        "zh",
        "light",
      );

      expect(html).toContain("fixture=platform-phase1-current-consumer.v1");
      expect(html).toContain("activation=axis-activation-policy.v1/capital_finance");
      expect(html).toContain("review=same-run-review-availability-policy.v1/policy_finance");
    } finally {
      process.chdir(cwd);
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("falls back to replay-only runtime html in overview when daily is absent", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-overview-runtime-replay-only-"));
    const cwd = process.cwd();
    try {
      fs.mkdirSync(path.join(root, "data", "reports"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "data", "reports", "2026-06-30.policy-finance-runtime-replay.json"),
        JSON.stringify(
          {
            artifact_kind: "policy_finance_runtime_replay",
            date: "2026-06-30",
            generated_at: "2026-06-30T08:00:00.000Z",
            fixture_id: "platform-phase1-current-consumer.v1",
            current_status: "policy_finance_runtime_ready",
            negative_reason_code: "dispatch_context_missing",
            runtime_consumed_same_run_messages: 19,
            activation_profile_ids: ["axis-activation-policy.v1/capital_finance"],
            stop_profile_ids: ["canonical-fetch-stop-policy.v1/capital_finance"],
            review_profile_ids: ["same-run-review-availability-policy.v1/policy_finance"],
          },
          null,
          2,
        ),
      );

      process.chdir(root);
      const html = renderPrimary(
        { route: "overview", model: buildOverviewView("2026-06-30") },
        new URL("http://localhost/overview?date=2026-06-30"),
        "zh",
        "light",
      );

      expect(html).toContain("platform-phase1-current-consumer.v1");
      expect(html).toContain("activation=axis-activation-policy.v1/capital_finance");
      expect(html).toContain("negative_reason=dispatch_context_missing");
    } finally {
      process.chdir(cwd);
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
