import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildVerifyDailyResult } from "../action/dailyVerification.ts";
import { buildExternalDiscussionTrendWindow } from "../externalDiscovery/trendWindow.ts";
import { writeExternalDiscussionTrendWindow } from "../externalDiscovery/trendWindowIntegration.ts";
import type { DailyReport, DailyRunSummary } from "../types.ts";
import { aggregateForDate, loadedWindow, trendEvidence } from "./externalDiscussionTrendWindowFixtures.ts";

const roots: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function setupWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "external-trend-window-verify-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "data", "reports"), { recursive: true });
  fs.mkdirSync(path.join(root, "data", "raw", "github"), { recursive: true });
  process.chdir(root);
  return root;
}

function writeJson(filepath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(value, null, 2), "utf-8");
}

function makeReport(date: string): DailyReport {
  return {
    date,
    generated_at: `${date}T00:00:00.000Z`,
    enhancement_status: "rules-only",
    enhancement_audit: { rejected_outputs: [] },
    personalized_relevance_applicable: false,
    overall_daily_status: "鏁版嵁鏂伴矞锛屽彲鐩存帴闃呰",
    freshness_sources: [],
    today_fresh_candidate_count: 1,
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
  } as unknown as DailyReport;
}

function makeSummary(date: string, trendWindowStatus: "ok" | "partial" | "failed" | "insufficient" | "skipped"): DailyRunSummary {
  return {
    date,
    generated_at: `${date}T00:00:00.000Z`,
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
    source_status: [
      {
        source: "agents-radar",
        enabled: true,
        item_count: 1,
        distinct_projects: 1,
        status: "active",
        notes: [],
      },
    ],
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
        auth_invalid: 0,
        rate_limit: 0,
        network_blocked: 0,
      },
    },
    top_projects: [],
    external_discovery: {
      aggregate_status: "ok",
      accepted_event_count: 2,
      rejected_event_count: 0,
      observation_candidate_count: 1,
      project_evidence_count: 1,
      direction_evidence_count: 0,
      explanation_status: "skipped",
      explanation_eligible_count: 0,
      explanation_attempted_count: 0,
      explanation_enhanced_count: 0,
      explanation_fallback_count: 0,
      explanation_rejected_count: 0,
      trend_window_read_status: trendWindowStatus,
      trend_window_status: trendWindowStatus,
      trend_window_path: `data/external-discovery/windows/${date}.discussion-trend-window.json`,
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

describe("external discussion trend window daily verification", () => {
  it("passes the trend window contract for a public-safe date-specific artifact", () => {
    const root = setupWorkspace();
    const date = "2026-07-03";
    const trendWindow = buildExternalDiscussionTrendWindow({
      anchorDate: date,
      generatedAt: `${date}T00:00:00.000Z`,
      aggregateResults: loadedWindow({
        "2026-07-02": aggregateForDate({
          date: "2026-07-02",
          project_evidence: [trendEvidence({ scope: "project", target_key: "openai/agents", date: "2026-07-02", mention_count: 2 })],
        }),
      }),
    });
    writeExternalDiscussionTrendWindow({ date, trendWindow });
    writeJson(path.join(root, "data", "reports", `${date}.run-summary.json`), makeSummary(date, trendWindow.status));
    writeJson(path.join(root, "data", "reports", `${date}.daily.json`), makeReport(date));
    writeJson(path.join(root, "data", "raw", "github", `${date}.enrichment.json`), []);

    const result = buildVerifyDailyResult(date);
    const check = result.checks.find((item) => item.name === "external_discussion_trend_window_contract");
    expect(check?.status).toBe("pass");
    expect(check?.detail).toContain("project_trends=1");
  });

  it("fails the trend window contract for parse errors", () => {
    const root = setupWorkspace();
    const date = "2026-07-03";
    fs.mkdirSync(path.join(root, "data", "external-discovery", "windows"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "data", "external-discovery", "windows", `${date}.discussion-trend-window.json`),
      "{not-json",
      "utf-8",
    );
    writeJson(path.join(root, "data", "reports", `${date}.run-summary.json`), makeSummary(date, "ok"));
    writeJson(path.join(root, "data", "reports", `${date}.daily.json`), makeReport(date));
    writeJson(path.join(root, "data", "raw", "github", `${date}.enrichment.json`), []);

    const result = buildVerifyDailyResult(date);
    const check = result.checks.find((item) => item.name === "external_discussion_trend_window_contract");
    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("trend window unreadable");
  });
});
