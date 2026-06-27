import { beforeEach, describe, expect, it, vi } from "vitest";

const baseDailyReport = {
  generated_at: "2026-06-27T08:00:00.000Z",
  enhancement_status: "agent-full",
  overall_daily_status: "ready",
  personalized_relevance_applicable: false,
  all_projects: [],
  global_hot_projects: [],
  today_star_projects: [],
  today_pulse_projects: [
    makeProject({
      repoFullName: "openai/codex",
      finalRank: 98,
      objectiveScore: 98,
      description: "Mature coding assistant with steady popularity.",
      exposureBucket: "today_pulse",
      headProject: true,
    }),
    makeProject({
      repoFullName: "acme/task-agent",
      finalRank: 90,
      objectiveScore: 90,
      description: "New desktop branch release for customer support workflows.",
      exposureBucket: "today_pulse",
      headProject: false,
      whyToday: "Desktop branch release makes it newly useful today.",
    }),
  ],
  mission_match_projects: [
    makeProject({
      repoFullName: "acme/research-copilot",
      finalRank: 88,
      objectiveScore: 88,
      description: "Research workflow agent for literature review.",
      exposureBucket: "mission_match",
      directionMatches: ["research-knowledge-agent"],
    }),
  ],
  explore_ribbon_projects: [
    makeProject({
      repoFullName: "acme/browser-helper",
      finalRank: 84,
      objectiveScore: 84,
      description: "Browser workflow helper with a new plugin mode.",
      exposureBucket: "explore_ribbon",
    }),
  ],
  context_only_projects: [
    makeProject({
      repoFullName: "acme/runtime-kit",
      finalRank: 82,
      objectiveScore: 82,
      description: "Agent runtime platform and SDK for deployment.",
      exposureBucket: "historical_context",
      headProject: true,
    }),
  ],
};

vi.mock("../visualConsole/context.ts", () => ({
  resolveDailyContext: () => ({
    status: "ok",
    context: {
      selected_date: "2026-06-27",
      stale: false,
      generated_at: null,
      selected_window: null,
    },
  }),
  resolveDailyTimeWindow: () => ({
    current: "2026-06-27",
    latest: "2026-06-27",
    previous: null,
    next: null,
  }),
  resolveNearestWeeklyAnchor: () => null,
  resolveWeeklyContext: () => ({
    status: "failed",
    context: {
      selected_date: null,
      stale: false,
      generated_at: null,
      selected_window: null,
    },
  }),
  resolveWeeklyTimeWindow: () => ({
    current: null,
    latest: null,
    previous: null,
    next: null,
  }),
}));

vi.mock("../visualConsole/fileCache.ts", () => ({
  getFilesystemStateSignature: () => "test-signature",
}));

let mockDailyReport = structuredClone(baseDailyReport);

vi.mock("../visualConsole/readLayer.ts", () => ({
  getDailyReport: () => ({ status: "ok", value: structuredClone(mockDailyReport) }),
  getDailyNavigatorPreview: (date: string) => ({ kind: "daily", slice_key: date }),
  getGithubEnrichmentAudit: () => ({ status: "ok", value: [] }),
  getKbCard: () => ({ status: "not_found" }),
  getKbIndex: () => ({ status: "ok", value: [] }),
  getMissionScoutArtifact: () => ({ status: "not_found" }),
  getMissionScoutEnhancementArtifact: () => ({ status: "not_found" }),
  getObserverArtifact: () => ({ status: "not_found" }),
  getProjectLibraryEnhancementArtifact: () => ({ status: "not_found" }),
  getRunSummary: () => ({ status: "ok", value: { source_status: [], watchouts: [], recommended_actions: [] } }),
  getVerifyDailyResult: () => ({ status: "ok", value: { status: "pass" } }),
  getWeeklyAudit: () => ({ status: "not_found" }),
  getWeeklyJudgmentReport: () => ({ status: "not_found" }),
  getWeeklyNavigatorPreview: (date: string) => ({ kind: "weekly", slice_key: date }),
  getWeeklyReport: () => ({ status: "not_found" }),
  getWeeklyStructuredReport: () => ({ status: "not_found" }),
}));

function makeProject(input: {
  repoFullName: string;
  finalRank: number;
  objectiveScore: number;
  description: string;
  exposureBucket: string;
  headProject: boolean;
  directionMatches?: string[];
  whyToday?: string;
}) {
  const repoName = input.repoFullName.split("/")[1] ?? input.repoFullName;
  return {
    project: {
      project_name: repoName,
      repo_url: `https://github.com/${input.repoFullName}`,
      repo_full_name: input.repoFullName,
      first_seen: "2026-06-20",
      last_seen: "2026-06-27",
      sources: ["github"],
      source_counts: { github: 1 },
      appearances: 1,
      appearance_dates: ["2026-06-27"],
      persistence_state: "emerging",
      stars: 1000,
      star_delta_daily: 12,
      star_delta_weekly: 40,
      star_delta_source: "github",
      forks: 10,
      issues: 2,
      PR: 1,
      tags: [],
      description: input.description,
      metrics_source: "github",
      metrics_trust_score: 1,
      data_trust: "high",
      star_delta_available: true,
      trust_flags: [],
      raw_signals: [],
    },
    score: {
      total_score: input.objectiveScore,
      components: [],
      verdict: "high",
      confidence: "high",
      trust_score: 1,
      data_trust: "high",
      paradigm: "agent",
      anti_noise_flags: [],
      risks: [],
      next_actions: [],
      rules_only: false,
    },
    project_class: input.exposureBucket === "historical_context" ? "context_only" : "today_star",
    objective_score: input.objectiveScore,
    preference_boost: 0,
    base_final_rank: input.finalRank,
    final_rank: input.finalRank,
    matched_interest_topics: [],
    project_brief_cn: input.description,
    why_today_cn: input.whyToday ?? input.description,
    enhancement_source: "template_fallback",
    summary_source: "template_fallback",
    position_qualification: "keep-observing",
    judge_score_delta: 0,
    judge_source: "template_fallback",
    direction_matches: input.directionMatches ?? [],
    appearance_reason_codes: [],
    appearance_explanation_cn: input.description,
    exposure_bucket: input.exposureBucket,
    head_project: input.headProject,
    head_saturation_state: "normal",
  };
}

describe("overview top decision ranking", () => {
  beforeEach(() => {
    mockDailyReport = structuredClone(baseDailyReport);
    vi.resetModules();
  });

  it("suppresses default demoted headline projects when fresher candidates exist", async () => {
    const { buildOverviewView } = await import("../visualConsole/build.ts");

    const view = buildOverviewView("2026-06-27");
    const repos = view.top_decisions.map((project) => project.project.repo_full_name);

    expect(repos[0]).toBe("acme/task-agent");
    expect(repos).toContain("acme/research-copilot");
    expect(repos).not.toContain("openai/codex");
  });

  it("keeps demoting default headline projects when they only mention domain adoption or infra shifts", async () => {
    mockDailyReport.today_pulse_projects[0] = makeProject({
      repoFullName: "openai/codex",
      finalRank: 99,
      objectiveScore: 99,
      description: "Finance workflow platform adoption across the ecosystem runtime standard.",
      exposureBucket: "today_pulse",
      headProject: true,
      directionMatches: ["finance-investment-research-agent"],
    });

    const { buildOverviewView, buildProjectsView } = await import("../visualConsole/build.ts");

    const overviewRepos = buildOverviewView("2026-06-27").top_decisions.map((project) => project.project.repo_full_name);
    const projectRepos = buildProjectsView("2026-06-27").projects.map((project) => project.project.repo_full_name);

    expect(overviewRepos[0]).toBe("acme/task-agent");
    expect(overviewRepos).not.toContain("openai/codex");
    expect(projectRepos[0]).toBe("acme/task-agent");
    expect(projectRepos.indexOf("openai/codex")).toBeGreaterThan(projectRepos.indexOf("acme/research-copilot"));
  });
});
