import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../config.ts";
import { buildWeeklyArtifacts } from "../action/weeklyEnhancement.ts";
import { renderWeeklyReport } from "../action/weeklyReport.ts";
import { buildExternalDiscussionTrendWindow } from "../externalDiscovery/trendWindow.ts";
import { writeExternalDiscussionTrendWindow } from "../externalDiscovery/trendWindowIntegration.ts";
import type { DailyReport } from "../types.ts";
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "external-trend-window-weekly-"));
  roots.push(root);
  process.chdir(root);
  return root;
}

function config(): AppConfig {
  return {
    thresholds: { highScore: 70 },
    sources: { userInterestProfile: { enabled: false, topics: [] } },
    llm: { enabled: false, mode: "rules-only", provider: "none" },
  } as unknown as AppConfig;
}

function daily(date: string): DailyReport {
  return {
    date,
    generated_at: `${date}T00:00:00.000Z`,
    enhancement_status: "rules-only",
    enhancement_audit: { rejected_outputs: [] },
    personalized_relevance_applicable: false,
    overall_daily_status: "鏁版嵁鏂伴矞锛屽彲鐩存帴闃呰",
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
  } as unknown as DailyReport;
}

describe("external discussion trend window weekly consumption", () => {
  it("attaches only secondary external trend evidence to weekly artifacts", () => {
    setupWorkspace();
    const trendWindow = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: loadedWindow({
        "2026-07-02": aggregateForDate({
          date: "2026-07-02",
          project_evidence: [
            trendEvidence({
              scope: "project",
              target_key: "openai/agents",
              date: "2026-07-02",
              mention_count: 2,
              platforms: ["hacker_news", "reddit"],
            }),
          ],
        }),
        "2026-07-03": aggregateForDate({
          date: "2026-07-03",
          project_evidence: [
            trendEvidence({
              scope: "project",
              target_key: "openai/agents",
              date: "2026-07-03",
              mention_count: 2,
              platforms: ["hacker_news", "reddit"],
            }),
            trendEvidence({
              scope: "project",
              target_key: "noise/project",
              date: "2026-07-03",
              mention_count: 3,
              platforms: ["hacker_news"],
            }),
          ],
        }),
      }),
    });
    writeExternalDiscussionTrendWindow({ date: "2026-07-03", trendWindow });

    const artifacts = buildWeeklyArtifacts([{ date: "2026-07-03", scored: [], daily: daily("2026-07-03") }], config());

    expect(artifacts.report.external_discussion_trends?.read_status).toBe("ok");
    expect(artifacts.report.external_discussion_trends?.secondary_evidence.map((item) => item.target_key)).toContain(
      "openai/agents",
    );
    expect(artifacts.report.external_discussion_trends?.secondary_evidence.map((item) => item.target_key)).not.toContain(
      "noise/project",
    );
    expect(artifacts.report.external_discussion_trends?.noise_items.map((item) => item.target_key)).toContain(
      "noise/project",
    );

    const rendered = renderWeeklyReport(artifacts.report, { judgment: artifacts.judgment });
    expect(rendered).toContain("## AgentReach 外部讨论趋势");
    expect(rendered).toContain("openai/agents");
  });
});
