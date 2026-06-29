import { afterEach, describe, expect, it, vi } from "vitest";
import { DIRECTION_CATALOG, PROJECT_SEARCH_CONSTANTS } from "../signal/directionCatalog.ts";
import { MISSION_GITHUB_PER_DIRECTION_LIMIT, directionGithubSearchTemplates, missionGithubPerDirectionLimit } from "../signal/githubRepositorySearch.ts";
import { resetGitHubSearchRuntimeState } from "../signal/githubSearchRuntime.ts";
import { searchGithubRepositoriesForDirection } from "../signal/githubRepositorySearch.ts";
import { runMissionDeepDiscovery } from "../signal/missionDeepDiscovery.ts";
import { runMissionScoutDiscovery, type MissionScoutSearchResult } from "../signal/missionScoutDiscovery.ts";
import type { DirectionCatalogEntry, ScoredProject } from "../types.ts";

const originalGithubToken = process.env.GITHUB_TOKEN;

function makeScoutResult(overrides: Partial<MissionScoutSearchResult>): MissionScoutSearchResult {
  return {
    status: "ok",
    raw_hits: 0,
    normalized_hits: 0,
    quality_passed_hits: 0,
    lane_hits: {},
    repo_candidates: [],
    query_count: 6,
    ...overrides,
  };
}

function makeScoredProject(args: {
  projectName: string;
  repoFullName: string;
  description?: string;
  tags?: string[];
  totalScore?: number;
}): ScoredProject {
  return {
    project: {
      project_name: args.projectName,
      repo_url: `https://github.com/${args.repoFullName}`,
      repo_full_name: args.repoFullName,
      first_seen: "2026-06-12",
      last_seen: "2026-06-12",
      sources: ["github_trending"],
      source_counts: { github_trending: 1 },
      appearances: 1,
      appearance_dates: ["2026-06-12"],
      persistence_state: "emerging",
      stars: 100,
      star_delta_daily: 10,
      forks: 5,
      issues: 1,
      PR: 0,
      tags: args.tags ?? [],
      description: args.description ?? args.projectName,
      metrics_source: "github_api",
      metrics_trust_score: 0.9,
      data_trust: "high",
      star_delta_available: true,
      star_delta_source: "github_live",
      trust_flags: [],
      raw_signals: [],
    },
    score: {
      total_score: args.totalScore ?? 80,
      components: [],
      verdict: "high",
      confidence: "high",
      trust_score: 0.9,
      data_trust: "high",
      paradigm: "agent",
      anti_noise_flags: [],
      risks: [],
      next_actions: [],
      rules_only: true,
    },
  };
}

afterEach(() => {
  if (originalGithubToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = originalGithubToken;
  resetGitHubSearchRuntimeState();
  vi.unstubAllGlobals();
});

describe("project search system redesign behavior", () => {
  it("freezes the V1 catalog to the approved 19 must-cover directions from the design doc", () => {
    const expectedDirectionKeys = [
      "coding-agent",
      "browser-computer-use",
      "workflow-automation-agent",
      "research-knowledge-agent",
      "shopping-commerce-agent",
      "sales-prospecting-agent",
      "customer-support-agent",
      "marketing-content-ops-agent",
      "finance-investment-research-agent",
      "data-analytics-bi-agent",
      "legal-compliance-agent",
      "security-soc-agent",
      "healthcare-ops-agent",
      "recruiting-hr-agent",
      "supply-chain-procurement-agent",
      "industrial-field-ops-agent",
      "short-drama-generation-agent",
      "image-generation-agent",
      "time-series-forecasting-agent",
    ];

    expect(PROJECT_SEARCH_CONSTANTS.directionCount).toBe(19);
    expect(DIRECTION_CATALOG.map((item) => item.direction_key)).toEqual(expectedDirectionKeys);
  });

  it("marks raw-only noisy results as noise_only instead of weak_signal", async () => {
    const direction: DirectionCatalogEntry = {
      ...DIRECTION_CATALOG[0]!,
      direction_key: "shopping-commerce-agent",
      family_key: "revenue-commerce",
      display_name_cn: "智能导购与电商运营代理",
    };

    const result = await runMissionScoutDiscovery({
      catalog: [direction],
      githubSearchEnabled: true,
      search: async () =>
        makeScoutResult({
          raw_hits: 8,
          normalized_hits: 0,
          quality_passed_hits: 0,
        }),
    });

    expect(result.coverage_atlas[0]?.outcome).toBe("noise_only");
  });

  it("executes the frozen query-pack templates and keeps live search capacity above the raw-hit floor", () => {
    const direction = DIRECTION_CATALOG[0]!;
    const templates = directionGithubSearchTemplates(direction);

    for (const pack of direction.query_packs) {
      for (const template of pack.templates) {
        expect(templates).toContain(template);
      }
    }
    expect(MISSION_GITHUB_PER_DIRECTION_LIMIT).toBeGreaterThanOrEqual(PROJECT_SEARCH_CONSTANTS.directionRawHitsMin);
  });

  it("expands finance live GitHub search beyond generic finance-agent phrasing", () => {
    const direction = DIRECTION_CATALOG.find((item) => item.direction_key === "finance-investment-research-agent")!;
    const templates = directionGithubSearchTemplates(direction).join("\n");

    expect(missionGithubPerDirectionLimit(direction)).toBeGreaterThan(MISSION_GITHUB_PER_DIRECTION_LIMIT);
    expect(templates).toContain("stock analysis agent");
    expect(templates).toContain("portfolio research agent");
    expect(templates).toContain("quant trading agent");
    expect(templates).toContain("AI hedge fund");
    expect(templates).toContain("A-share stock analysis");
  });

  it("expands research and workflow live GitHub search around science and office productivity user language", () => {
    const researchDirection = DIRECTION_CATALOG.find((item) => item.direction_key === "research-knowledge-agent")!;
    const workflowDirection = DIRECTION_CATALOG.find((item) => item.direction_key === "workflow-automation-agent")!;
    const researchTemplates = directionGithubSearchTemplates(researchDirection).join("\n");
    const workflowTemplates = directionGithubSearchTemplates(workflowDirection).join("\n");

    expect(researchTemplates).toContain("scientific research agent");
    expect(researchTemplates).toContain("paper research agent");
    expect(researchTemplates).toContain("literature review agent");
    expect(workflowTemplates).toContain("office productivity agent");
    expect(workflowTemplates).toContain("email calendar workflow agent");
    expect(workflowTemplates).toContain("document spreadsheet automation");
  });

  it("keeps local direction matches when GitHub live search fails mid-query", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("github search down")));

    const result = await searchGithubRepositoriesForDirection({
      direction: DIRECTION_CATALOG.find((item) => item.direction_key === "time-series-forecasting-agent")!,
      projects: [
        makeScoredProject({
          projectName: "Demand Forecast Agent",
          repoFullName: "acme/demand-forecast-agent",
          description: "time series forecasting agent for demand prediction and anomaly signal workflows",
          tags: ["forecasting", "time-series", "demand"],
        }).project,
      ],
      date: "2026-06-28",
      enableLiveSearch: true,
      retryAttempts: 1,
      retryBaseDelayMs: 1,
      queryTimeoutMs: 50,
    });

    expect(result.status).toBe("ok");
    expect(result.normalized_hits).toBe(1);
    expect(result.repo_candidates).toHaveLength(1);
    expect(result.error).toContain("github search down");
  });

  it("retries transient GitHub search failures before giving up", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    let attempt = 0;
    const successResponse = new Response(
      JSON.stringify({
        items: [
          {
            full_name: "acme/demand-forecast-agent",
            html_url: "https://github.com/acme/demand-forecast-agent",
            description: "time series forecasting agent",
            stargazers_count: 42,
            forks_count: 3,
            open_issues_count: 1,
            topics: ["forecasting"],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
    const fetchMock = vi.fn(async () => {
      attempt += 1;
      return attempt === 1 ? new Response("temporary unavailable", { status: 503 }) : successResponse.clone();
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGithubRepositoriesForDirection({
      direction: DIRECTION_CATALOG.find((item) => item.direction_key === "time-series-forecasting-agent")!,
      projects: [],
      date: "2026-06-28",
      enableLiveSearch: true,
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.status).toBe("ok");
    expect(result.repo_candidates).toHaveLength(1);
    expect(result.error).toBeUndefined();
  });

  it("retries GitHub search without auth after a 401 token failure", async () => {
    process.env.GITHUB_TOKEN = "bad-token";
    const successResponse = new Response(
      JSON.stringify({
        items: [
          {
            full_name: "acme/short-drama-agent",
            html_url: "https://github.com/acme/short-drama-agent",
            description: "short drama agent",
            stargazers_count: 18,
            forks_count: 2,
            open_issues_count: 0,
            topics: ["video"],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
    let sawUnauthorized = false;
    const fetchMock = vi.fn(async (_input, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (!sawUnauthorized && headers.Authorization === "Bearer bad-token") {
        sawUnauthorized = true;
        return new Response("unauthorized", { status: 401 });
      }
      return successResponse.clone();
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGithubRepositoriesForDirection({
      direction: DIRECTION_CATALOG.find((item) => item.direction_key === "short-drama-generation-agent")!,
      projects: [],
      date: "2026-06-28",
      enableLiveSearch: true,
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer bad-token" });
    expect(fetchMock.mock.calls.some((call) => !("Authorization" in (((call[1]?.headers as Record<string, string>) ?? {}))))).toBe(true);
    expect(result.status).toBe("ok");
    expect(result.repo_candidates).toHaveLength(1);
  });

  it("keeps mission matches out of the task section when a direction never reached matched", async () => {
    const coverage = [
      {
        direction_key: "finance-investment-research-agent",
        family_key: "analysis-professional",
        display_name_cn: "金融分析与投研代理",
        boundary_mode: "regulated-specialist" as const,
        search_depth: "deep" as const,
        query_pack_count: 3,
        query_template_count: 6,
        lane_types: ["canonical", "job-to-be-done", "user-speak", "ecosystem", "adjacent-software"] as const,
        pressure_state: "normal" as const,
        outcome: "weak_signal" as const,
        reason_codes: ["quantity_target_unmet"],
        explanation_cn: "今天看到了苗头，但还不够格推荐。",
        next_action: "upgrade_to_deep" as const,
        candidate_counts: {
          raw_hits: 8,
          boundary_passed_hits: 2,
          normalized_hits: 1,
          quality_passed_hits: 0,
          exposed_hits: 0,
        },
        quantity_target_met: false,
        search_exhausted: false,
      },
    ];

    const scoredProjects = [
      makeScoredProject({
        projectName: "Finance Investment Research Agent",
        repoFullName: "acme/finance-investment-research-agent",
        description: "finance investment research agent",
      }),
    ];

    const result = await runMissionDeepDiscovery({
      coverageAtlas: coverage,
      scoredProjects,
      explicitInterestSignals: [],
    });

    expect(result.mission_match_projects).toEqual([]);
  });

  it("degrades mission discovery instead of returning active when every direction is effectively missing", async () => {
    const coverage = [
      {
        direction_key: "customer-support-agent",
        family_key: "revenue-commerce",
        display_name_cn: "客服与服务台代理",
        boundary_mode: "workflow-intelligence" as const,
        search_depth: "deep" as const,
        query_pack_count: 3,
        query_template_count: 6,
        lane_types: ["canonical", "job-to-be-done", "user-speak", "ecosystem", "adjacent-software"] as const,
        pressure_state: "normal" as const,
        outcome: "search_failed" as const,
        reason_codes: ["search_failed"],
        explanation_cn: "今天这个方向的搜索本身失败了。",
        next_action: "upgrade_to_deep" as const,
        candidate_counts: {
          raw_hits: 0,
          boundary_passed_hits: 0,
          normalized_hits: 0,
          quality_passed_hits: 0,
          exposed_hits: 0,
        },
        quantity_target_met: false,
        search_exhausted: false,
      },
    ];

    const result = await runMissionDeepDiscovery({
      coverageAtlas: coverage,
      scoredProjects: [],
      explicitInterestSignals: [],
    });

    expect(result.mission_discovery_status).toBe("degraded");
    expect(result.mission_degraded_reason_codes.length).toBeGreaterThan(0);
  });
});
