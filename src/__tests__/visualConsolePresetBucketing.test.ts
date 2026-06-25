import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildObserverView, buildProjectsView } from "../visualConsole/build.ts";
import type { DailyExposureProject, DailyReport, EcosystemObserverArtifact, EcosystemObserverEntry, ScoredProject } from "../types.ts";

const roots: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function setupWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "visual-console-buckets-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "data", "reports"), { recursive: true });
  fs.mkdirSync(path.join(root, "data", "observer", "ecosystem-focus"), { recursive: true });
  process.chdir(root);
  return root;
}

function writeJson(filepath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(value, null, 2));
}

function makeScoredProject(repoFullName: string, tags: string[] = [], description?: string): ScoredProject {
  const repoName = repoFullName.split("/")[1] ?? repoFullName;
  return {
    project: {
      project_name: repoName,
      repo_url: `https://github.com/${repoFullName}`,
      repo_full_name: repoFullName,
      first_seen: "2026-07-01",
      last_seen: "2026-07-01",
      sources: ["github_trending"],
      source_counts: { github_trending: 1 },
      appearances: 1,
      appearance_dates: ["2026-07-01"],
      persistence_state: "emerging",
      stars: 100,
      forks: 4,
      issues: 2,
      PR: 0,
      tags,
      description: description ?? `${repoName} description`,
      metrics_source: "embedded",
      metrics_trust_score: 0.7,
      data_trust: "medium",
      star_delta_available: true,
      star_delta_daily: 12,
      star_delta_weekly: 40,
      trust_flags: [],
      raw_signals: [],
    },
    score: {
      total_score: 80,
      components: [],
      verdict: "watch",
      confidence: "medium",
      trust_score: 0.7,
      data_trust: "medium",
      paradigm: "Agent System",
      anti_noise_flags: [],
      risks: [],
      next_actions: [],
      rules_only: true,
    },
  };
}

function makeExposureProject(args: {
  repoFullName: string;
  exposureBucket?: DailyExposureProject["exposure_bucket"];
  directionMatches?: string[];
  tags?: string[];
  description?: string;
  appearanceReasonCodes?: string[];
  headProject?: boolean;
}): DailyExposureProject {
  const base = makeScoredProject(args.repoFullName, args.tags ?? [], args.description);
  return {
    ...base,
    project_class: "today_star",
    objective_score: 80,
    preference_boost: 0,
    base_final_rank: 80,
    final_rank: 80,
    matched_interest_topics: [],
    project_brief_cn: "brief",
    why_today_cn: "why now",
    enhancement_source: "template_fallback",
    summary_source: "template_fallback",
    position_qualification: "keep-observing",
    judge_score_delta: 0,
    judge_source: "template_fallback",
    direction_matches: args.directionMatches,
    appearance_reason_codes: args.appearanceReasonCodes ?? [],
    appearance_explanation_cn: "test",
    exposure_bucket: args.exposureBucket,
    head_project: args.headProject ?? false,
    head_saturation_state: "normal",
  };
}

function makeDailyReport(date: string, projects: {
  todayStar?: DailyExposureProject[];
  todayPulse?: DailyExposureProject[];
  mission?: DailyExposureProject[];
  explore?: DailyExposureProject[];
  context?: DailyExposureProject[];
  all?: ScoredProject[];
}): DailyReport {
  return {
    date,
    generated_at: `${date}T08:00:00.000Z`,
    enhancement_status: "rules-only",
    enhancement_audit: { rejected_outputs: [] },
    personalized_relevance_applicable: false,
    overall_daily_status: "数据新鲜，可直接阅读",
    freshness_sources: [],
    today_fresh_candidate_count: (projects.todayStar ?? []).length,
    context_candidate_count: (projects.context ?? []).length,
    pending_confirmation_count: 0,
    main_board_mode: "fresh_today_only",
    today_star_projects: projects.todayStar ?? [],
    context_only_projects: projects.context ?? [],
    today_pulse_projects: projects.todayPulse ?? [],
    mission_match_projects: projects.mission ?? [],
    explore_ribbon_projects: projects.explore ?? [],
    coverage_atlas: [],
    gap_ledger: [],
    mission_discovery_status: "active",
    mission_degraded_reason_codes: [],
    global_hot_projects: projects.todayPulse ?? [],
    demand_relevant_projects: projects.mission ?? [],
    searched_direction_statuses: [],
    new_projects: [],
    high_score_projects: [],
    anomaly_projects: [],
    all_projects: projects.all ?? [],
  } as DailyReport;
}

function makeObserverEntry(args: {
  repoFullName: string;
  ecosystems?: string[];
  topicHints?: string[];
  keywords?: string[];
  breakoutLabel?: string;
  freshnessLabel?: string;
  positionQualification?: EcosystemObserverEntry["position_qualification"];
  judgeScoreDelta?: number;
  description?: string;
}): EcosystemObserverEntry {
  return {
    repo_full_name: args.repoFullName,
    repo_url: `https://github.com/${args.repoFullName}`,
    observed_at: "2026-07-02T08:00:00.000Z",
    ecosystems: args.ecosystems ?? [],
    labels: [],
    breakout_label: args.breakoutLabel,
    freshness_label: args.freshnessLabel,
    position_qualification: args.positionQualification ?? "keep-observing",
    judge_score_delta: args.judgeScoreDelta,
    matched_by: {
      keywords: args.keywords ?? [],
      topic_hints: args.topicHints ?? [],
      repo_seeds: [],
      org_seeds: [],
    },
    description: args.description,
    source_notes: ["candidate_pool=github-search"],
  };
}

describe("visual console preset bucketing", () => {
  it("restores legacy today_star exposure semantics and reclassifies historical context through preset buckets", () => {
    const root = setupWorkspace();
    const date = "2026-07-01";
    const useful = makeExposureProject({
      repoFullName: "acme/useful-agent",
      tags: ["agent", "desktop"],
      description: "Desktop agent that helps finish daily coding tasks.",
      appearanceReasonCodes: ["today_pulse_anchor"],
    });
    const infra = makeExposureProject({
      repoFullName: "acme/mcp-runtime",
      tags: ["mcp", "sdk", "runtime"],
      description: "MCP SDK runtime for agent integrations.",
      appearanceReasonCodes: ["today_pulse_anchor"],
      headProject: true,
    });
    const historical = makeExposureProject({
      repoFullName: "acme/history-only",
      exposureBucket: "historical_context",
      directionMatches: ["research-knowledge-agent"],
      tags: ["research", "knowledge"],
      description: "Historical catalog backfill that should stay out of landing buckets.",
    });

    writeJson(path.join(root, "data", "reports", `${date}.daily.json`), makeDailyReport(date, {
      todayStar: [useful, infra],
      context: [historical],
    }));

    const model = buildProjectsView(date);
    expect(model.preset_groups.useful_first.map((project) => project.project.repo_full_name)).toEqual([
      "acme/useful-agent",
      "acme/history-only",
    ]);
    expect(model.preset_groups.infra_tools.map((project) => project.project.repo_full_name)).toEqual(["acme/mcp-runtime"]);
    expect(model.projects.map((project) => project.project.repo_full_name)).toContain("acme/history-only");
    expect(model.preset_groups.by_scenario.map((project) => project.project.repo_full_name)).toContain("acme/history-only");
  });

  it("reclassifies catalog inventory into preset buckets instead of forcing it all into supplemental", () => {
    const root = setupWorkspace();
    const date = "2026-07-03";
    const usefulInventory = Array.from({ length: 14 }, (_, index) =>
      makeScoredProject(`acme/useful-${index + 1}`, ["agent", "coding"], "General coding agent for daily tasks."),
    );
    const scenarioInventory = [
      makeScoredProject("acme/finance-analyst", ["finance", "investment"], "Finance investment research workflow for analysts."),
      makeScoredProject("acme/research-notebook", ["research", "paper"], "Scientific literature and research notebook assistant."),
    ];
    const infraInventory = [
      makeScoredProject("acme/mcp-gateway", ["mcp", "sdk", "gateway"], "MCP SDK gateway for agent integrations."),
    ];

    writeJson(path.join(root, "data", "reports", `${date}.daily.json`), makeDailyReport(date, {
      all: [...usefulInventory, ...scenarioInventory, ...infraInventory],
    }));

    const model = buildProjectsView(date);

    expect(model.preset_groups.worth_trying_today).toHaveLength(16);
    expect(model.preset_groups.by_scenario.map((project) => project.project.repo_full_name)).toEqual([
      "acme/finance-analyst",
      "acme/research-notebook",
    ]);
    expect(model.preset_groups.worth_trying_today.map((project) => project.project.repo_full_name)).toEqual(
      expect.arrayContaining(["acme/finance-analyst", "acme/research-notebook"]),
    );
    expect(model.preset_groups.infra_tools.map((project) => project.project.repo_full_name)).toEqual(["acme/mcp-gateway"]);
    expect(model.projects).toHaveLength(17);
    expect(model.projects.filter((project) => project.preset_bucket === null)).toHaveLength(0);
  });

  it("routes fresh inventory candidates into worth trying today and keeps stale leftovers visible in supplemental inventory", () => {
    const root = setupWorkspace();
    const date = "2026-07-04";
    const freshExplore = makeScoredProject("acme/fresh-lab", ["agent", "prototype"], "Fresh agent prototype worth trying.");
    const staleLeftover = makeScoredProject("acme/stale-archive", ["archive"], "Older archive project.");
    staleLeftover.project.appearances = 3;
    staleLeftover.project.appearance_dates = ["2026-07-01", "2026-07-02", "2026-07-04"];
    staleLeftover.project.first_seen = "2026-07-01";
    staleLeftover.project.last_seen = "2026-07-04";
    staleLeftover.project.star_delta_available = false;
    staleLeftover.project.star_delta_daily = 0;

    writeJson(path.join(root, "data", "reports", `${date}.daily.json`), makeDailyReport(date, {
      all: [freshExplore, staleLeftover],
    }));

    const model = buildProjectsView(date);

    expect(model.preset_groups.worth_trying_today.map((project) => project.project.repo_full_name)).toEqual(["acme/fresh-lab"]);
    expect(model.preset_groups.supplemental_inventory.map((project) => project.project.repo_full_name)).toEqual(["acme/stale-archive"]);
  });

  it("keeps observer candidates out of the projects library candidate pool", () => {
    const root = setupWorkspace();
    const date = "2026-07-05";
    const dailyOnly = makeExposureProject({
      repoFullName: "acme/daily-project",
      exposureBucket: "today_pulse",
      tags: ["agent"],
      description: "Daily candidate that belongs in the projects library.",
    });
    const artifact: EcosystemObserverArtifact = {
      scope: "ecosystem-focus",
      date,
      generated_at: `${date}T08:00:00.000Z`,
      status: "active",
      candidate_count: 1,
      ecosystem_counts: {},
      incubating_directions: [],
      promotion_candidates: [],
      notes: [],
      entries: [
        makeObserverEntry({
          repoFullName: "acme/observer-only",
          ecosystems: ["multi-agent-coordination"],
          breakoutLabel: "watch",
          freshnessLabel: "new-24h",
          description: "Observer-only candidate that should stay out of the projects page.",
        }),
      ],
    };

    writeJson(path.join(root, "data", "reports", `${date}.daily.json`), makeDailyReport(date, {
      todayPulse: [dailyOnly],
      all: [dailyOnly],
    }));
    writeJson(path.join(root, "data", "observer", "ecosystem-focus", `${date}.json`), artifact);

    const model = buildProjectsView(date);

    expect(model.projects.map((project) => project.project.repo_full_name)).toEqual(["acme/daily-project"]);
  });

  it("keeps generic observer topic hints out of by_scenario and defaults them to early watch", () => {
    const root = setupWorkspace();
    const date = "2026-07-02";
    const artifact: EcosystemObserverArtifact = {
      scope: "ecosystem-focus",
      date,
      generated_at: `${date}T08:00:00.000Z`,
      status: "active",
      candidate_count: 7,
      ecosystem_counts: {},
      incubating_directions: [],
      promotion_candidates: [],
      notes: [],
      entries: [
        makeObserverEntry({
          repoFullName: "acme/review-helper",
          ecosystems: ["coding-agents"],
          topicHints: ["code-review"],
          keywords: ["review"],
          breakoutLabel: "steady",
          description: "Code review helper for teams.",
        }),
        makeObserverEntry({
          repoFullName: "acme/finance-watch",
          ecosystems: ["finance-investment-research-agent"],
          topicHints: ["finance-investment-research-agent"],
          keywords: ["finance"],
          description: "Finance copilot for analysts.",
        }),
        makeObserverEntry({
          repoFullName: "acme/new-swarm",
          ecosystems: ["multi-agent-coordination"],
          breakoutLabel: "watch",
          freshnessLabel: "new-24h",
          positionQualification: "strong-watch",
          judgeScoreDelta: 8,
          description: "New multi-agent coordination sample.",
        }),
        makeObserverEntry({
          repoFullName: "acme/mcp-gateway",
          ecosystems: ["skills-tools-mcp"],
          topicHints: ["mcp"],
          keywords: ["mcp", "gateway"],
          description: "MCP gateway for tool connections.",
        }),
        makeObserverEntry({
          repoFullName: "acme/fresh-voice",
          ecosystems: ["coding-agents"],
          freshnessLabel: "new-24h",
          description: "Fresh voice assistant candidate with a new launch window.",
        }),
        makeObserverEntry({
          repoFullName: "acme/stock-terminal",
          ecosystems: ["memory-knowledge"],
          keywords: ["research"],
          description: "Open-source stock analysis workstation for A-share and portfolio research teams.",
        }),
        makeObserverEntry({
          repoFullName: "acme/omni-skills",
          ecosystems: ["skills-tools-mcp"],
          description: "Reusable skills for finance, legal, marketing, sales, research, and customer support teams.",
        }),
      ],
    };

    writeJson(path.join(root, "data", "observer", "ecosystem-focus", `${date}.json`), artifact);

    const model = buildObserverView(date);
    const buckets = new Map(model.entries.map((entry) => [entry.repo_full_name, entry.observer_preset_bucket]));
    expect(buckets.get("acme/review-helper")).toBe("early_watch");
    expect(buckets.get("acme/finance-watch")).toBe("by_scenario");
    expect(buckets.get("acme/new-swarm")).toBe("new_direction");
    expect(buckets.get("acme/mcp-gateway")).toBe("infra_early");
    expect(buckets.get("acme/fresh-voice")).toBe("new_direction");
    expect(buckets.get("acme/stock-terminal")).toBe("by_scenario");
    expect(buckets.get("acme/omni-skills")).toBe("infra_early");
  });
});
