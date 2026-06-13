import { describe, expect, it } from "vitest";
import { buildProjectSearchDailySections } from "../action/projectSearchExposurePlanner.ts";
import type { DailyReport, ScoredProject, DailyReportProjectDetail } from "../types.ts";

function makeProject(repoFullName: string, overrides: Partial<ScoredProject & DailyReportProjectDetail> = {}): ScoredProject & DailyReportProjectDetail {
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
      description: repoFullName,
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
    direction_matches: [],
    ...overrides,
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
    today_fresh_candidate_count: 0,
    context_candidate_count: 0,
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
    mission_discovery_status: "active",
    mission_degraded_reason_codes: [],
    global_hot_projects: [],
    demand_relevant_projects: [],
    searched_direction_statuses: [],
  } as DailyReport;
}

describe("buildProjectSearchDailySections", () => {
  it("only emits explore ribbon from fresh non-mission projects when mission seats are below quota", () => {
    const pulseProjects = [
      makeProject("acme/pulse-a"),
      makeProject("acme/pulse-b"),
      makeProject("acme/pulse-c"),
      makeProject("acme/pulse-d"),
      makeProject("acme/explore"),
    ];
    const mission = makeProject("acme/mission", {
      direction_matches: ["coding-agent"],
    });
    const report = makeReport();
    report.today_star_projects = pulseProjects;
    report.context_only_projects = [makeProject("acme/context", { project_class: "context_only" })];

    const sections = buildProjectSearchDailySections({
      report,
      mission_match_projects: [mission],
      coverage_atlas: [],
      gap_ledger: [],
      mission_discovery_status: "active",
      mission_degraded_reason_codes: [],
    });

    expect(sections.mission_match_projects).toHaveLength(1);
    expect(sections.mission_match_projects[0]?.appearance_reason_codes).toContain("mission_direction_match");
    expect(sections.mission_match_projects[0]?.exposure_bucket).toBe("mission_match");
    expect(sections.explore_ribbon_projects).toHaveLength(1);
    expect(sections.explore_ribbon_projects[0]?.project.repo_full_name).toBe("acme/explore");
    expect(sections.explore_ribbon_projects[0]?.project_class).toBe("today_star");
    expect(sections.explore_ribbon_projects[0]?.direction_matches).toEqual([]);
    expect(sections.explore_ribbon_projects[0]?.appearance_explanation_cn).toContain("不是任务命中");
  });

  it("suppresses explore ribbon once mission quota is full", () => {
    const report = makeReport();
    report.today_star_projects = [
      makeProject("acme/pulse-a"),
      makeProject("acme/pulse-b"),
      makeProject("acme/pulse-c"),
      makeProject("acme/pulse-d"),
      makeProject("acme/explore"),
    ];
    report.context_only_projects = [makeProject("acme/explore")];

    const sections = buildProjectSearchDailySections({
      report,
      mission_match_projects: [
        makeProject("acme/m1", { direction_matches: ["coding-agent"] }),
        makeProject("acme/m2", { direction_matches: ["shopping-commerce-agent"] }),
        makeProject("acme/m3", { direction_matches: ["finance-investment-research-agent"] }),
        makeProject("acme/m4", { direction_matches: ["healthcare-ops-agent"] }),
      ],
      coverage_atlas: [],
      gap_ledger: [],
      mission_discovery_status: "active",
      mission_degraded_reason_codes: [],
    });

    expect(sections.mission_match_projects).toHaveLength(4);
    expect(sections.explore_ribbon_projects).toEqual([]);
  });

  it("enforces top-3 same-direction fairness in mission seats", () => {
    const report = makeReport();
    report.today_star_projects = [makeProject("acme/pulse")];

    const sections = buildProjectSearchDailySections({
      report,
      mission_match_projects: [
        makeProject("acme/m1", { direction_matches: ["coding-agent"] }),
        makeProject("acme/m2", { direction_matches: ["coding-agent"] }),
        makeProject("acme/m3", { direction_matches: ["workflow-automation-agent"] }),
        makeProject("acme/m4", { direction_matches: ["research-knowledge-agent"] }),
      ],
      coverage_atlas: [],
      gap_ledger: [],
      mission_discovery_status: "active",
      mission_degraded_reason_codes: [],
    });

    expect(
      sections.mission_match_projects
        .slice(0, 3)
        .filter((project) => project.direction_matches?.includes("coding-agent")),
    ).toHaveLength(1);
  });
});
