import { describe, expect, it } from "vitest";
import { buildMissionInventoryAudit } from "../signal/missionInventoryAudit.ts";
import { DIRECTION_CATALOG } from "../signal/directionCatalog.ts";
import type { DailyReport, ScoredProject } from "../types.ts";

function makeScoredProject(repoFullName: string, description: string): ScoredProject {
  return {
    project: {
      project_name: repoFullName.split("/")[1] ?? repoFullName,
      repo_url: `https://github.com/${repoFullName}`,
      repo_full_name: repoFullName,
      first_seen: "2026-06-12",
      last_seen: "2026-06-12",
      sources: ["github_trending"],
      source_counts: { github_trending: 1 },
      appearances: 1,
      appearance_dates: ["2026-06-12"],
      persistence_state: "emerging",
      stars: 100,
      forks: 1,
      issues: 0,
      PR: 0,
      tags: [],
      description,
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
  };
}

function makeReport(projects: ScoredProject[]): DailyReport {
  return {
    all_projects: projects,
    today_pulse_projects: [],
    mission_match_projects: [],
    explore_ribbon_projects: [],
  } as unknown as DailyReport;
}

describe("buildMissionInventoryAudit", () => {
  it("does not count core-agent-work projects as vertical or task-oriented inventory", () => {
    const coding = makeScoredProject("acme/coding-agent", "coding agent patch review automation");
    const commerce = makeScoredProject("acme/shopping-agent", "shopping commerce agent guide conversion automation");

    const audit = buildMissionInventoryAudit({
      currentReport: makeReport([coding, commerce]),
      rolling30dReports: [],
      directionCatalog: DIRECTION_CATALOG,
    });

    expect(audit.rolling_30d_searchable_catalog_count).toBe(2);
    expect(audit.rolling_30d_vertical_or_task_oriented_count).toBe(1);
  });
});
