import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildWeeklyView } from "../visualConsole/build.ts";
import { renderWeeklyView } from "../visualConsole/render.ts";

const roots: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function setupWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-weekly-runtime-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "data", "reports"), { recursive: true });
  process.chdir(root);
  return root;
}

function writeJson(filepath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(value, null, 2));
}

describe("visual console weekly runtime window", () => {
  it("surfaces runtime window blockage from structured weekly artifacts", () => {
    const root = setupWorkspace();
    fs.writeFileSync(
      path.join(root, "data", "reports", "2026-06-13.weekly.md"),
      [
        "# Agent Trend Radar 周报 2026-06-13",
        "",
        "> generated_at: 2026-06-13T08:00:00.000Z",
        "> window: 2026-06-07 -> 2026-06-13",
        "",
        "## 本周总结",
        "",
        "- 规则层已形成若干趋势判断。",
        "- enhancement_status: rules-only",
        "- supporting_trend_keys: agent-runtime",
        "",
        "## 已成立趋势",
        "",
        "- 趋势: Agent Runtime [agent-runtime]",
        "  - 总结: runtime is consolidating",
        "  - 证据: runtime evidence",
        "  - 强度: medium",
        "  - 下周是否继续跟进: keep watching",
        "",
        "## 待观察趋势",
        "",
        "- 当前没有额外待观察趋势。",
        "",
      ].join("\n"),
    );

    writeJson(path.join(root, "data", "reports", "2026-06-13.weekly.json"), {
      date: "2026-06-13",
      generated_at: "2026-06-13T08:00:00.000Z",
      window_start: "2026-06-07",
      window_end: "2026-06-13",
      enhancement_status: "rules-only",
      industry_runtime_window_summary: {
        window_day_count: 7,
        days_with_run_summary: 7,
        days_with_industry_runtime_summary: 1,
        missing_run_summary_dates: [],
        missing_industry_runtime_summary_dates: [
          "2026-06-07",
          "2026-06-08",
          "2026-06-09",
          "2026-06-10",
          "2026-06-11",
          "2026-06-12",
        ],
        policy_finance_runtime_ready_days: ["2026-06-13"],
        product_ecosystem_dry_run_ready_days: ["2026-06-13"],
        academic_preparatory_ready_days: ["2026-06-13"],
        latest_summary_date: "2026-06-13",
        latest_overall_status: "industry_runtime_contracts_ready",
        latest_academic_blocked_until: "formal_academic_handoff",
        latest_platform_contract_fixture: "platform-phase1-current-consumer.v1",
        latest_policy_finance_activation_profile_ids: ["axis-activation-policy.v1/capital_finance"],
        latest_policy_finance_stop_profile_ids: ["canonical-fetch-stop-policy.v1/capital_finance"],
        latest_policy_finance_review_profile_ids: ["same-run-review-availability-policy.v1/policy_finance"],
      },
      personalized_weekly_focus_applicable: false,
      overall_summary_cn: "规则层已形成若干趋势判断。",
      supporting_trend_keys: ["agent-runtime"],
      evidence_matrix: undefined,
      core_trend_cards: [
        {
          trend_key: "agent-runtime",
          trend_name_cn: "Agent Runtime",
          trend_summary_cn: "runtime is consolidating",
          evidence_summary_cn: "runtime evidence",
          strength: "medium",
          worth_following_next_week: "keep watching",
          supporting_projects: [],
        },
      ],
      personalized_weekly_focus: [],
      weak_signal_cards: [],
      enhancement_audit: { rejected_outputs: [] },
    });

    writeJson(path.join(root, "data", "reports", "2026-06-13.weekly.judgment.json"), {
      date: "2026-06-13",
      generated_at: "2026-06-13T08:00:00.000Z",
      window_start: "2026-06-07",
      window_end: "2026-06-13",
      enhancement_status: "rules-only",
      industry_runtime_window_summary: {
        window_day_count: 7,
        days_with_run_summary: 7,
        days_with_industry_runtime_summary: 1,
        missing_run_summary_dates: [],
        missing_industry_runtime_summary_dates: [
          "2026-06-07",
          "2026-06-08",
          "2026-06-09",
          "2026-06-10",
          "2026-06-11",
          "2026-06-12",
        ],
        policy_finance_runtime_ready_days: ["2026-06-13"],
        product_ecosystem_dry_run_ready_days: ["2026-06-13"],
        academic_preparatory_ready_days: ["2026-06-13"],
        latest_summary_date: "2026-06-13",
        latest_overall_status: "industry_runtime_contracts_ready",
        latest_academic_blocked_until: "formal_academic_handoff",
        latest_platform_contract_fixture: "platform-phase1-current-consumer.v1",
        latest_policy_finance_activation_profile_ids: ["axis-activation-policy.v1/capital_finance"],
        latest_policy_finance_stop_profile_ids: ["canonical-fetch-stop-policy.v1/capital_finance"],
        latest_policy_finance_review_profile_ids: ["same-run-review-availability-policy.v1/policy_finance"],
      },
      executive_summary_cn: "规则层已形成若干趋势判断。",
      rule_materials: {
        evidence_projects: [],
        evidence_clusters: [],
        trend_candidates: [],
        unexplained_project_refs: [],
        anomaly_project_refs: [],
      },
      established_trends: [],
      observing_trends: [],
      audit_conclusion: {
        accepted_candidate_ids: [],
        rejected_candidate_ids: [],
        merged_groups: [],
        split_actions: [],
        added_trends: [],
        missed_signal_summary_cn: [],
        misjudgment_summary_cn: [],
        residual_blindspots_cn: [],
      },
      enhancement_audit: { rejected_outputs: [] },
    });

    writeJson(path.join(root, "data", "reports", "2026-06-13.weekly.audit.json"), {
      enhancement_status: "rules-only",
      industry_runtime_window_summary: {
        window_day_count: 7,
        days_with_run_summary: 7,
        days_with_industry_runtime_summary: 1,
        missing_run_summary_dates: [],
        missing_industry_runtime_summary_dates: [
          "2026-06-07",
          "2026-06-08",
          "2026-06-09",
          "2026-06-10",
          "2026-06-11",
          "2026-06-12",
        ],
        policy_finance_runtime_ready_days: ["2026-06-13"],
        product_ecosystem_dry_run_ready_days: ["2026-06-13"],
        academic_preparatory_ready_days: ["2026-06-13"],
        latest_summary_date: "2026-06-13",
        latest_overall_status: "industry_runtime_contracts_ready",
        latest_academic_blocked_until: "formal_academic_handoff",
        latest_platform_contract_fixture: "platform-phase1-current-consumer.v1",
        latest_policy_finance_activation_profile_ids: ["axis-activation-policy.v1/capital_finance"],
        latest_policy_finance_stop_profile_ids: ["canonical-fetch-stop-policy.v1/capital_finance"],
        latest_policy_finance_review_profile_ids: ["same-run-review-availability-policy.v1/policy_finance"],
      },
      personalized_weekly_focus: [],
      rejected_outputs: [],
    });

    const view = buildWeeklyView("2026-06-13");
    const rendered = renderWeeklyView(view);

    expect(view.banner.notes).toContain("weekly runtime 仍阻塞于 formal_academic_handoff");
    expect(view.state.reasons).toContain("weekly runtime 阻塞于 formal_academic_handoff");
    expect(rendered).toContain("## Industry Runtime Window");
    expect(rendered).toContain("latest_academic_blocked_until: formal_academic_handoff");
    expect(rendered).toContain("policy_finance_runtime_ready_days: 2026-06-13");
    expect(rendered).toContain("latest_platform_contract_fixture: platform-phase1-current-consumer.v1");
    expect(rendered).toContain("latest_policy_finance_activation_profiles: axis-activation-policy.v1/capital_finance");
  });
});
