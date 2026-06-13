import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildVerifyDailyResult } from "../action/dailyVerification.ts";
import type { DailyReport, DailyRunSummary } from "../types.ts";

const roots: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function setupWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "daily-verification-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "data", "reports"), { recursive: true });
  fs.mkdirSync(path.join(root, "data", "raw", "github"), { recursive: true });
  process.chdir(root);
  return root;
}

function writeJson(filepath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(value, null, 2));
}

function makeSummary(): DailyRunSummary {
  return {
    date: "2026-06-12",
    generated_at: "2026-06-12T08:00:00.000Z",
    dry_run: true,
    minimum_viable_run_completed: true,
    completion_notes: [],
    counts: {
      raw_signals: 10,
      normalized_projects: 4,
      scored_projects: 4,
      high_score_projects: 2,
      anomaly_projects: 0,
      new_projects: 4,
      classifications: 4,
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
      emerging_projects: 4,
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
        auth_invalid: 0,
        rate_limit: 0,
        network_blocked: 0,
      },
    },
    top_projects: [],
    observer_top_candidates: [],
    watchouts: [],
    next_focus: [],
    recommended_actions: [],
    freshness_sources: [],
    mission_discovery_status: "degraded",
    mission_degraded_reason_codes: ["no_matched_direction"],
  };
}

function makeReport(): DailyReport {
  return {
    date: "2026-06-12",
    generated_at: "2026-06-12T08:00:00.000Z",
    enhancement_status: "rules-only",
    enhancement_audit: { rejected_outputs: [] },
    personalized_relevance_applicable: false,
    overall_daily_status: "数据新鲜，可直接阅读",
    freshness_sources: [],
    today_fresh_candidate_count: 1,
    context_candidate_count: 1,
    pending_confirmation_count: 0,
    main_board_mode: "fresh_today_only",
    today_star_projects: [],
    context_only_projects: [],
    new_projects: [],
    high_score_projects: [],
    anomaly_projects: [],
    all_projects: [],
    today_pulse_projects: [],
    mission_match_projects: [],
    explore_ribbon_projects: [],
    coverage_atlas: [],
    gap_ledger: [],
    mission_discovery_status: "degraded",
    mission_degraded_reason_codes: ["no_matched_direction"],
    global_hot_projects: [],
    demand_relevant_projects: [],
    searched_direction_statuses: [],
  } as DailyReport;
}

describe("buildVerifyDailyResult project-search contract checks", () => {
  it("passes the new contract checks when project-search fields are coherent", () => {
    const root = setupWorkspace();
    const summary = makeSummary();
    const report = makeReport();
    const projectCard = {
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
        stars: 10,
        forks: 0,
        issues: 0,
        PR: 0,
        tags: [],
        description: "coder",
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
      appearance_explanation_cn: "anchor",
      exposure_bucket: "today_pulse",
      direction_matches: ["coding-agent"],
    };
    report.today_pulse_projects = [projectCard as never];
    report.mission_match_projects = [];
    report.explore_ribbon_projects = [];
    report.coverage_atlas = [];
    report.gap_ledger = [];

    writeJson(path.join(root, "data", "reports", "2026-06-12.run-summary.json"), summary);
    writeJson(path.join(root, "data", "reports", "2026-06-12.daily.json"), report);
    writeJson(path.join(root, "data", "raw", "github", "2026-06-12.enrichment.json"), []);

    const result = buildVerifyDailyResult("2026-06-12");
    const checkNames = new Map(result.checks.map((check) => [check.name, check.status]));
    expect(checkNames.get("project_search_daily_fields")).toBe("pass");
    expect(checkNames.get("project_cards_have_direction_and_appearance_reason")).toBe("pass");
    expect(checkNames.get("mission_quota_and_explore_ribbon_contract")).toBe("pass");
    expect(checkNames.get("mission_fairness_constraints")).toBe("pass");
    expect(checkNames.get("mission_degraded_semantics")).toBe("pass");
    expect(checkNames.get("rolling_inventory_audit_present")).toBe("warn");
    expect(checkNames.get("rolling_inventory_targets_met")).toBe("warn");
  });

  it("fails when explore ribbon is emitted despite a full mission quota", () => {
    const root = setupWorkspace();
    const summary = makeSummary();
    summary.mission_discovery_status = "active";
    summary.mission_degraded_reason_codes = [];
    const report = makeReport();
    report.mission_discovery_status = "active";
    report.mission_degraded_reason_codes = [];
    const makeCard = (repo: string) =>
      ({
        project: {
          project_name: repo.split("/")[1],
          repo_url: `https://github.com/${repo}`,
          repo_full_name: repo,
          first_seen: "2026-06-12",
          last_seen: "2026-06-12",
          sources: ["github_trending"],
          source_counts: {},
          appearances: 1,
          appearance_dates: ["2026-06-12"],
          persistence_state: "emerging",
          stars: 10,
          forks: 0,
          issues: 0,
          PR: 0,
          tags: [],
          description: repo,
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
        appearance_reason_codes: ["mission_direction_match"],
        appearance_explanation_cn: "fit",
        exposure_bucket: "mission_match",
        direction_matches: ["coding-agent"],
      }) as never;
    report.mission_match_projects = [makeCard("acme/m1"), makeCard("acme/m2"), makeCard("acme/m3"), makeCard("acme/m4")];
    report.explore_ribbon_projects = [makeCard("acme/explore")];

    writeJson(path.join(root, "data", "reports", "2026-06-12.run-summary.json"), summary);
    writeJson(path.join(root, "data", "reports", "2026-06-12.daily.json"), report);
    writeJson(path.join(root, "data", "raw", "github", "2026-06-12.enrichment.json"), []);

    const result = buildVerifyDailyResult("2026-06-12");
    expect(result.checks.find((check) => check.name === "mission_quota_and_explore_ribbon_contract")?.status).toBe("fail");
  });
});
