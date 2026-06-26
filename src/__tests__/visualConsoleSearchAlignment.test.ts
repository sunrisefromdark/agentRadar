import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ObserverView, { filterObserverEntries, type ObserverEntry, type ObserverViewProps } from "../../app/client/ObserverView.tsx";
import { filterRunHealthNarratives, type NarrativeItem } from "../../app/client/RunHealth.tsx";
import { filterAndSortProjectCards, rankProjectSearchMatch } from "../../app/visualConsole/clientScript.ts";
import { renderProjectsWorkbenchPage } from "../../app/visualConsole/ossProjectsPage.ts";
import { buildProjectsView } from "../visualConsole/build.ts";
import type { ProjectsViewModel } from "../visualConsole/types.ts";

function withProjectPresetDefaults(project: ProjectsViewModel["projects"][number]): ProjectsViewModel["projects"][number] {
  const presetBucket = project.preset_bucket ?? "useful_first";
  return {
    ...project,
    preset_bucket: presetBucket,
    preset_memberships: project.preset_memberships ?? [presetBucket],
    utility_hint: project.utility_hint ?? "general",
    repeat_exposure_state: project.repeat_exposure_state ?? "fresh",
    head_project_exception_reason: project.head_project_exception_reason ?? null,
    hard_infra: project.hard_infra ?? false,
  };
}

function makeObserverEntry(overrides: Partial<ObserverEntry> = {}): ObserverEntry {
  return {
    key: "bytedance/ui-tars-desktop",
    repoFullName: "bytedance/UI-TARS-desktop",
    displayName: "UI-TARS-desktop",
    authorName: "bytedance",
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
    preferenceScore: 0,
    presetBucket: "early_watch",
    utilityHint: "general",
    repeatExposureState: "fresh",
    headProjectExceptionReason: null,
    hardInfra: false,
    ...overrides,
  };
}

function makeObserverProps(overrides: Partial<ObserverViewProps> = {}): ObserverViewProps {
  return {
    lang: "en",
    initialTheme: "light",
    pageBadge: "Long-tail Watch",
    pageTitle: "Long-tail Watch",
    pageSummary: "Projects worth watching.",
    pageSummaryCaption: "Observer deck.",
    searchLabel: "Search",
    searchPlaceholder: "Search projects",
    searchSuggestionsLabel: "Suggestions",
    searchSuggestions: [],
    searchExamples: [],
    searchHelperBody: "",
    searchEmptyTitle: "Empty",
    searchEmptyBody: "No matches",
    detailEmptyTitle: "No selection",
    detailEmptyBody: "Select a project",
    telemetryStatusLabel: "Status",
    telemetryStatusValue: "active",
    telemetryGeneratedAtLabel: "Generated",
    telemetryGeneratedAtValue: "2026-06-12",
    telemetryModeLabel: "Mode",
    telemetryModeValue: "rules-only",
    telemetrySourceHealthLabel: "Source Health",
    telemetrySourceHealthValue: "ok",
    telemetryCandidateCountLabel: "Candidates",
    telemetryCandidateCountValue: "1",
    telemetryEcosystemCountLabel: "Ecosystems",
    telemetryEcosystemCountValue: "1",
    guidanceJudgeLabel: "Watch Heuristic",
    guidanceJudgeBody: "Watch it.",
    guidanceLinkageLabel: "Dock Linkage",
    guidanceLinkageBody: "Open details.",
    detailStageLabel: "Observer Detail Cabin",
    detailStageStatus: "Observing",
    closeLabel: "Close",
    openProjectLabel: "Project Detail",
    openRepositoryLabel: "Open Repository",
    keepTrackingLabel: "Keep Tracking",
    keepTrackingActiveLabel: "Tracking Active",
    observerScoreLabel: "Observer Score",
    watchReasonLabel: "Watch Reason",
    freshnessLabel: "Freshness",
    tierLabel: "Tier",
    historyLabel: "History",
    whyNowTitle: "Why Now",
    positionTitle: "Current Judgment",
    recommendationTitle: "Watch Next",
    semanticSignalsTitle: "Signals",
    semanticSignalsHint: "",
    pedigreeLabel: "Pedigree",
    keywordsLabel: "Keywords",
    topicsLabel: "Topics",
    repoSeedsLabel: "Repo Seeds",
    orgSeedsLabel: "Org Seeds",
    ecosystemsLabel: "Ecosystems",
    labelsLabel: "Labels",
    summarySourceLabel: "Summary Source",
    judgeSourceLabel: "Judgment Source",
    observedAtLabel: "Observed At",
    judgeDeltaLabel: "Judgment Delta",
    notes: [],
    ecosystemBadges: [],
    entries: [makeObserverEntry()],
    defaultPreset: "all",
    presetOptions: [
      { key: "all", label: "All", description: "All entries", count: 1 },
      { key: "early_watch", label: "Watch Early", description: "Early signals", count: 1 },
      { key: "new_direction", label: "New Direction", description: "New shifts", count: 0 },
      { key: "by_scenario", label: "By Scenario", description: "Scenario hits", count: 0 },
      { key: "infra_early", label: "Infra Early", description: "Infra watch", count: 0 },
    ],
    initialSelectedKey: "bytedance/ui-tars-desktop",
    canTrack: false,
    trackingActionPath: "",
    trackingReturnTo: "/observer",
    trackingSignInHref: "#",
    signInToTrackLabel: "Sign in to track",
    csrfToken: "",
    trackingStatusRepoKey: null,
    trackingStatusMessage: "",
    trackingStatusTone: "neutral",
    ...overrides,
  };
}

function makeProject(overrides: Partial<ProjectsViewModel["projects"][number]> = {}): ProjectsViewModel["projects"][number] {
  return withProjectPresetDefaults({
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
  } as ProjectsViewModel["projects"][number]);
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
    default_preset: "all",
    preset_query_enabled: false,
    preset_groups: {
      useful_first: [project],
      by_scenario: [],
      worth_trying_today: [],
      infra_tools: [],
      supplemental_inventory: [],
    },
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

  it("keeps observer search exact repo queries tight instead of returning unrelated narrative matches", () => {
    const entries = [
      makeObserverEntry({
        key: "chopratejas/headroom",
        repoFullName: "chopratejas/headroom",
        repoUrl: "https://github.com/chopratejas/headroom",
        whyItMatters: "Context optimization layer for LLM applications.",
        whyNow: "Fresh activity.",
        ecosystems: ["research-knowledge-agent"],
        labels: ["ecosystem:research-knowledge-agent"],
        keywords: ["context-optimization"],
        topics: ["rag"],
        searchText: "Headroom context optimization layer for LLM apps.",
      }),
      makeObserverEntry({
        key: "moltis-org/moltis",
        repoFullName: "moltis-org/moltis",
        repoUrl: "https://github.com/moltis-org/moltis",
        whyItMatters: "AI workspace for teams.",
        whyNow: "Fresh activity.",
        ecosystems: ["workflow-automation-agent"],
        labels: ["ecosystem:workflow-automation-agent"],
        keywords: ["workspace"],
        topics: ["operations"],
        searchText: "Workflow automation workspace for operations teams.",
      }),
    ];

    const results = filterObserverEntries(entries, "Headroom");
    expect(results).toHaveLength(1);
    expect(results[0]?.repoFullName.toLowerCase()).toBe("chopratejas/headroom");
  });

  it("renders the observer preset deck and sort switch with the newer observer UI structure", () => {
    const html = renderToStaticMarkup(createElement(ObserverView, makeObserverProps()));

    expect(html).toContain('data-observer-preset-deck="true"');
    expect(html).toContain('data-observer-preset-option="all"');
    expect(html).toContain('data-observer-preset-option="early_watch"');
    expect(html).toContain('data-observer-preset-option="new_direction"');
    expect(html).toContain('data-observer-preset-option="by_scenario"');
    expect(html).toContain('data-observer-preset-option="infra_early"');
    expect(html).toContain("Objective");
    expect(html).toContain("Preference");
    expect(html).toContain("UI-TARS-desktop");
    expect(html).toContain("bytedance");
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

  it("matches vertical demand cards by Chinese direction aliases", () => {
    const card = {
      searchName: "TonyWang-hub/mcp-cn-commerce",
      searchDescription: "Chinese e-commerce MCP servers for AI agents.",
      searchMeta: "shopping-commerce-agent commerce ecommerce 电商 导购 购物 商品 商家经营",
    };

    for (const query of ["电商", "导购", "购物", "shopping-commerce-agent", "ecommerce"]) {
      expect(rankProjectSearchMatch(card, query), query).toBeGreaterThan(0);
    }
  });

  it("matches finance demand cards by Chinese stock and investment aliases", () => {
    const card = {
      searchName: "ZhuLinsen/daily_stock_analysis",
      searchDescription: "LLM-powered stock analysis for A/H/US markets.",
      searchMeta: "finance-investment-research-agent finance investment stock stocks trading quant \u80a1\u7968 \u6295\u7814 \u91d1\u878d \u91cf\u5316 \u4ea4\u6613",
    };

    for (const query of ["\u80a1\u7968", "\u6295\u7814", "\u91d1\u878d", "\u91cf\u5316", "\u4ea4\u6613", "finance-investment-research-agent", "stock"]) {
      expect(rankProjectSearchMatch(card, query), query).toBeGreaterThan(0);
    }
  });

  it("matches research and office-productivity cards by user-facing Chinese aliases", () => {
    const researchCard = {
      searchName: "google-deepmind/science-skills",
      searchDescription: "Scientific workflow and literature-grounded research agent skills.",
      searchMeta: "research-knowledge-agent research knowledge science paper literature citation notebook 科研 研究 文献 论文 知识工作",
    };
    const productivityCard = {
      searchName: "microsoft/markitdown",
      searchDescription: "Document workflow automation for office files.",
      searchMeta: "workflow-automation-agent productivity office document spreadsheet slides email meeting calendar 办公提效 效率 自动化 文档 表格 幻灯片 邮件 会议 日历",
    };

    for (const query of ["科研", "研究", "文献", "论文", "知识工作", "research-knowledge-agent"]) {
      expect(rankProjectSearchMatch(researchCard, query), query).toBeGreaterThan(0);
    }
    for (const query of ["办公提效", "效率", "自动化", "文档", "表格", "幻灯片", "邮件", "会议", "日历", "workflow-automation-agent"]) {
      expect(rankProjectSearchMatch(productivityCard, query), query).toBeGreaterThan(0);
    }
  });

  it("prioritizes exact repo-name matches like Headroom in project search", () => {
    const headroomCard = {
      searchName: "chopratejas/headroom",
      searchDescription: "Context optimization layer for LLM applications.",
      searchMeta: "headroom context optimization mcp server rag",
    };
    const unrelatedCard = {
      searchName: "moltis-org/moltis",
      searchDescription: "AI workspace for teams.",
      searchMeta: "workflow collaboration operations",
    };

    expect(rankProjectSearchMatch(headroomCard, "Headroom")).toBeGreaterThan(0);
    expect(rankProjectSearchMatch(unrelatedCard, "Headroom")).toBe(0);
  });

  it("filters project workbench cards without breaking on repo separators", () => {
    const headroomCard = {
      searchName: "chopratejas/headroom",
      searchDescription: "Context optimization layer for LLM applications.",
      searchMeta: "headroom context optimization mcp server rag",
      score: 50,
      growth: 0,
      order: 1,
      paradigm: "Agent System",
      persistence: "context_only",
    };
    const unrelatedCard = {
      searchName: "moltis-org/moltis",
      searchDescription: "AI workspace for teams.",
      searchMeta: "workflow collaboration operations",
      score: 99,
      growth: 99,
      order: 0,
      paradigm: "Agent System",
      persistence: "emerging",
    };

    const results = filterAndSortProjectCards([unrelatedCard, headroomCard], {
      search: "Headroom",
      sort: "score",
      paradigm: "all",
      persistence: "all",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.searchName).toBe("chopratejas/headroom");
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
    expect(html).toContain('data-project-bucket-deck="true"');
    expect(html).toContain('data-projects-preset-option="all"');
    expect(html).toContain("projects-preset-card-topline");
    expect(html).toContain("projects-preset-card-icon");
    expect(html).toContain("projects-preset-card-meta-value");
  });

  it("renders vertical direction aliases so Chinese demand searches can find commerce projects", () => {
    const commerceProject = makeProject({
      project: {
        ...makeProject().project,
        project_name: "mcp-cn-commerce",
        repo_full_name: "TonyWang-hub/mcp-cn-commerce",
        repo_url: "https://github.com/TonyWang-hub/mcp-cn-commerce",
        tags: ["mission-direction:shopping-commerce-agent", "shopping-commerce-agent", "commerce", "ecommerce"],
        description: "Chinese e-commerce MCP servers for AI agents.",
      },
      matched_interest_topics: ["shopping-commerce-agent"],
      direction_matches: ["shopping-commerce-agent"],
      project_brief_cn: "电商经营数据 MCP 连接器。",
      why_today_cn: "命中智能导购与电商运营代理方向。",
    });
    const html = renderProjectsWorkbenchPage(makeProjectsModel(commerceProject), new URL("http://localhost/projects?date=2026-06-12"), "zh", "light");

    for (const value of ["电商", "导购", "购物", "shopping-commerce-agent"]) {
      expect(html.toLowerCase(), value).toContain(value.toLowerCase());
    }
  });

  it("renders finance direction aliases so Chinese stock searches can find investment projects", () => {
    const financeProject = makeProject({
      project: {
        ...makeProject().project,
        project_name: "daily_stock_analysis",
        repo_full_name: "ZhuLinsen/daily_stock_analysis",
        repo_url: "https://github.com/ZhuLinsen/daily_stock_analysis",
        tags: ["mission-direction:finance-investment-research-agent", "finance-investment-research-agent", "stock", "quant"],
        description: "LLM-powered stock analysis system for A/H/US markets.",
      },
      matched_interest_topics: ["finance-investment-research-agent"],
      direction_matches: ["finance-investment-research-agent"],
      project_brief_cn: "LLM-powered stock analysis for A/H/US markets.",
      why_today_cn: "finance investment research agent candidate.",
    });
    const html = renderProjectsWorkbenchPage(makeProjectsModel(financeProject), new URL("http://localhost/projects?date=2026-06-12"), "zh", "light");

    for (const value of ["\u80a1\u7968", "\u6295\u7814", "\u91d1\u878d", "\u91cf\u5316", "\u4ea4\u6613", "finance-investment-research-agent"]) {
      expect(html.toLowerCase(), value).toContain(value.toLowerCase());
    }
  });

  it("renders Chinese fallback summaries for finance projects when upstream briefs are English", () => {
    const financeProject = makeProject({
      project: {
        ...makeProject().project,
        project_name: "daily_stock_analysis",
        repo_full_name: "ZhuLinsen/daily_stock_analysis",
        repo_url: "https://github.com/ZhuLinsen/daily_stock_analysis",
        tags: ["mission-direction:finance-investment-research-agent", "finance-investment-research-agent", "stock", "quant"],
        description: "LLM-powered stock analysis system for A/H/US markets.",
      },
      matched_interest_topics: ["finance-investment-research-agent"],
      direction_matches: ["finance-investment-research-agent"],
      project_brief_cn: "LLM-powered stock analysis for A/H/US markets.",
      appearance_explanation_cn: undefined,
      why_today_cn: "finance investment research agent candidate.",
    });
    const html = renderProjectsWorkbenchPage(makeProjectsModel(financeProject), new URL("http://localhost/projects?date=2026-06-12"), "zh", "light");

    expect(html).toContain("金融投研/股票分析相关项目");
    expect(html).not.toContain('<p class="project-row-brief">LLM-powered stock analysis for A/H/US markets.</p>');
  });

  it("renders research and office-productivity aliases into project search metadata", () => {
    const researchProject = makeProject({
      project: {
        ...makeProject().project,
        project_name: "science-skills",
        repo_full_name: "google-deepmind/science-skills",
        repo_url: "https://github.com/google-deepmind/science-skills",
        tags: ["mission-direction:research-knowledge-agent", "research-knowledge-agent", "science", "paper", "citation"],
        description: "Scientific workflow skills for research and literature-grounded discovery.",
      },
      matched_interest_topics: ["research-knowledge-agent"],
      direction_matches: ["research-knowledge-agent"],
      project_brief_cn: "scientific research and literature workflows",
      why_today_cn: "research knowledge agent candidate",
    });
    const productivityProject = makeProject({
      project: {
        ...makeProject().project,
        project_name: "markitdown",
        repo_full_name: "microsoft/markitdown",
        repo_url: "https://github.com/microsoft/markitdown",
        tags: ["mission-direction:workflow-automation-agent", "workflow-automation-agent", "document", "spreadsheet", "office"],
        description: "Document workflow automation for office files and productivity tasks.",
      },
      matched_interest_topics: ["workflow-automation-agent"],
      direction_matches: ["workflow-automation-agent"],
      project_brief_cn: "office productivity automation",
      why_today_cn: "workflow automation agent candidate",
    });

    const researchHtml = renderProjectsWorkbenchPage(makeProjectsModel(researchProject), new URL("http://localhost/projects?date=2026-06-12"), "zh", "light");
    const productivityHtml = renderProjectsWorkbenchPage(makeProjectsModel(productivityProject), new URL("http://localhost/projects?date=2026-06-12"), "zh", "light");

    for (const value of ["科研", "研究", "文献", "论文", "知识工作", "research-knowledge-agent"]) {
      expect(researchHtml.toLowerCase(), value).toContain(value.toLowerCase());
    }
    for (const value of ["办公提效", "效率", "自动化", "文档", "表格", "幻灯片", "邮件", "会议", "日历", "workflow-automation-agent"]) {
      expect(productivityHtml.toLowerCase(), value).toContain(value.toLowerCase());
    }
  });

  it("surfaces mission scout commerce candidates in the project workbench inventory", () => {
    const model = buildProjectsView("2026-06-12");
    const commerce = model.projects.find((project) => project.project.repo_full_name.toLowerCase() === "tonywang-hub/mcp-cn-commerce");

    expect(commerce).toBeTruthy();
    expect(commerce?.project_class).toBe("pending_confirmation");
    expect(commerce?.exposure_bucket).toBe("explore_ribbon");
    expect(commerce?.direction_matches).toContain("shopping-commerce-agent");
  });

  it("surfaces expanded finance mission-scout inventory beyond the default per-direction cap", () => {
    const model = buildProjectsView("2026-06-13");
    const financeCandidates = model.projects.filter(
      (project) =>
        project.project_class === "pending_confirmation" &&
        project.exposure_bucket === "explore_ribbon" &&
        project.direction_matches?.includes("finance-investment-research-agent"),
    );

    expect(financeCandidates.length).toBeGreaterThan(8);
    expect(financeCandidates.some((project) => project.project.repo_full_name.toLowerCase() === "zhulinsen/alphaevo")).toBe(true);
  });

  it("keeps Headroom searchable inside the project library inventory", () => {
    const model = buildProjectsView("latest");
    const headroom = model.projects.find((project) => project.project.repo_full_name.toLowerCase() === "chopratejas/headroom");

    expect(headroom).toBeTruthy();
    expect(
      headroom
        ? model.projects.some((project) => project.project.repo_full_name.toLowerCase() === headroom.project.repo_full_name.toLowerCase())
        : false,
    ).toBe(true);
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
