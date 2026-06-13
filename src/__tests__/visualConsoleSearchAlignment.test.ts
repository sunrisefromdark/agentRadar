import { describe, expect, it } from "vitest";
import { filterObserverEntries, type ObserverEntry } from "../../app/client/ObserverView.tsx";
import { filterRunHealthNarratives, type NarrativeItem } from "../../app/client/RunHealth.tsx";
import { rankProjectSearchMatch } from "../../app/visualConsole/clientScript.ts";
import { renderProjectsWorkbenchPage } from "../../app/visualConsole/ossProjectsPage.ts";
import type { ProjectsViewModel } from "../visualConsole/types.ts";

function makeObserverEntry(overrides: Partial<ObserverEntry> = {}): ObserverEntry {
  return {
    key: "bytedance/ui-tars-desktop",
    repoFullName: "bytedance/UI-TARS-desktop",
    projectHref: "/projects?project=bytedance%2FUI-TARS-desktop",
    repoUrl: "https://github.com/bytedance/UI-TARS-desktop",
    isTracked: false,
    radarScore: 80,
    baseObserverScore: 70,
    trendPath: "",
    stars: 100,
    forks: 5,
    issues: 2,
    prs: 1,
    attentionReason: "priority-company",
    freshnessTag: "fresh",
    hostLevel: "known-company",
    historyHit: "new",
    qualification: "keep-observing",
    observedAt: "2026-06-12",
    summarySource: "rules-only",
    judgeSource: "rules-only",
    judgeDelta: "+0",
    whyItMatters: "Desktop agent stack from a model company.",
    whyNow: "Fresh activity.",
    verdict: "Watch",
    recommendation: "Keep watching.",
    ecosystems: ["browser-computer-use"],
    labels: ["ecosystem:browser-computer-use"],
    pedigreeTokens: [],
    keywords: ["desktop-agent"],
    topics: ["computer-use"],
    repoSeeds: ["browser-use/browser-use"],
    orgSeeds: ["bytedance-seed"],
    searchOrganizations: ["bytedance"],
    searchText: "Multimodal desktop agent for browser automation and computer use.",
    ...overrides,
  };
}

function makeProject(overrides: Partial<ProjectsViewModel["projects"][number]> = {}): ProjectsViewModel["projects"][number] {
  return {
    project: {
      project_name: "UI-TARS-desktop",
      repo_url: "https://github.com/bytedance/UI-TARS-desktop",
      repo_full_name: "bytedance/UI-TARS-desktop",
      first_seen: "2026-06-12",
      last_seen: "2026-06-12",
      sources: ["mission_github_search"],
      source_counts: { mission_github_search: 1 },
      appearances: 1,
      appearance_dates: ["2026-06-12"],
      persistence_state: "emerging",
      stars: 100,
      forks: 5,
      issues: 2,
      PR: 1,
      tags: ["watchlist:bytedance", "desktop-agent", "computer-use"],
      description: "Multimodal desktop agent for browser automation.",
      metrics_source: "embedded",
      metrics_trust_score: 0.8,
      data_trust: "medium",
      star_delta_available: true,
      star_delta_daily: 12,
      star_delta_weekly: 40,
      trust_flags: [],
      raw_signals: [
        {
          project_name: "UI-TARS-desktop",
          repo_url: "https://github.com/bytedance/UI-TARS-desktop",
          source: "mission_github_search",
          timestamp: "2026-06-12T08:00:00.000Z",
          tags: ["vision-language-action"],
          description: "VLA desktop automation signal.",
        },
      ],
    },
    score: {
      total_score: 82,
      verdict: "watch",
      confidence: "medium",
      trust_score: 0.8,
      data_trust: "medium",
      rules_only: true,
      paradigm: "Agent System",
      components: [],
      anti_noise_flags: [],
      risks: [],
      next_actions: [],
    },
    project_class: "today_star",
    objective_score: 82,
    preference_boost: 0,
    base_final_rank: 82,
    final_rank: 82,
    matched_interest_topics: ["browser-computer-use"],
    project_brief_cn: "字节桌面智能体项目，面向浏览器和电脑使用自动化。",
    why_today_cn: "命中桌面智能体和计算机使用方向。",
    enhancement_source: "template_fallback",
    direction_matches: ["browser-computer-use-agent"],
    appearance_reason_codes: ["mission_direction_match"],
    exposure_bucket: "mission_match",
    head_project: false,
    head_saturation_state: "normal",
    ...overrides,
  };
}

function makeProjectsModel(project: ProjectsViewModel["projects"][number]): ProjectsViewModel {
  return {
    context: {
      mode: "daily",
      selected_date: "2026-06-12",
      selected_window: null,
      entry_kind: "explicit-date",
      resolved_artifacts: [],
      generated_at: "2026-06-12T08:00:00.000Z",
      stale: false,
    },
    banner: {
      title: "Projects",
      context_label: "2026-06-12",
      generated_at: "2026-06-12T08:00:00.000Z",
      enhancement_status: "rules-only",
      mode_label: "rules-only",
      github_enrichment_status: "ok",
      source_health: "ok",
      notes: [],
    },
    state: { status: "ready", reasons: [] },
    time_navigator: {
      mode: "daily",
      current_key: "2026-06-12",
      latest_key: "2026-06-12",
      previous_key: null,
      next_key: null,
      current_label: "2026-06-12",
      stale: false,
      window: { current: "2026-06-12", previous: null, next: null, latest: "2026-06-12", index: 0, total: 1 },
      previews: [],
    },
    route_frame: { route: "projects", hero: null, stage: [], rail: [], strip: [], dock: null, reader: null, audit: [] },
    today_pulse_projects: [],
    mission_match_projects: [project],
    explore_ribbon_projects: [],
    historical_context_projects: [],
    projects: [project],
    selected_project: null,
  };
}

describe("visual console search alignment", () => {
  it("matches observer entries by company, repo, seed, theme, and narrative text", () => {
    const entries = [makeObserverEntry()];

    for (const query of ["字节", "ByteDance", "UI-TARS", "bytedance", "desktop-agent", "computer-use", "browser-use", "bytedance-seed", "browser automation"]) {
      expect(filterObserverEntries(entries, query), query).toHaveLength(1);
    }
  });

  it("matches project workbench cards by name, description, metadata, and aliases", () => {
    const card = {
      searchName: "bytedance/UI-TARS-desktop",
      searchDescription: "A desktop agent stack.",
      searchMeta: "bytedance ByteDance 字节 字节跳动 browser computer use browser-computer-use-agent watchlist:bytedance vision-language-action",
    };

    for (const query of ["字节跳动", "ByteDance", "UI-TARS", "bytedance", "desktop agent", "browser-computer-use-agent", "vision-language-action"]) {
      expect(rankProjectSearchMatch(card, query), query).toBeGreaterThan(0);
    }
  });

  it("renders project search metadata with repo, tags, directions, raw signals, and bilingual company aliases", () => {
    const html = renderProjectsWorkbenchPage(makeProjectsModel(makeProject()), new URL("http://localhost/projects?date=2026-06-12"), "zh", "light");

    for (const value of [
      "bytedance/ui-tars-desktop",
      "ui-tars-desktop",
      "watchlist:bytedance",
      "desktop-agent",
      "browser-computer-use-agent",
      "vision-language-action",
      "字节",
      "字节跳动",
    ]) {
      expect(html.toLowerCase(), value).toContain(value.toLowerCase());
    }
  });

  it("matches run health narratives by expanded project, company, direction, and signal text", () => {
    const items: NarrativeItem[] = [
      {
        key: "bytedance/ui-tars-desktop",
        name: "bytedance/UI-TARS-desktop",
        channel: "github_search",
        scoreLabel: "Score 80 / 100",
        confidenceLabel: "MEDIUM",
        reason: "single source",
        note: "watch",
        searchText: "bytedance ByteDance 字节 字节跳动 UI-TARS desktop agent browser-computer-use-agent vision-language-action",
      },
    ];

    for (const query of ["字节", "ByteDance", "UI-TARS", "bytedance", "desktop agent", "browser-computer-use-agent", "vision-language-action"]) {
      expect(filterRunHealthNarratives(items, query), query).toHaveLength(1);
    }
  });
});
