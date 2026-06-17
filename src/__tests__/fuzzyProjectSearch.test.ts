import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createVisualConsoleServer } from "../../app/server.ts";
import type { AppConfig } from "../config.ts";
import {
  searchFuzzyProjects,
  type FuzzySearchCache,
} from "../search/fuzzyProjectSearchService.ts";
import {
  FUZZY_QUERY_SCHEMA_VERSION,
  type ExpandedProjectQuery,
  type LlmFuzzyQueryInterpretation,
} from "../search/fuzzyQueryTypes.ts";
import type { ProjectsViewModel } from "../visualConsole/types.ts";

const openServers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

const disabledLlm: AppConfig["llm"] = {
  enabled: false,
  mode: "rules-only",
  provider: "none",
};

function makeProject(args: {
  repo: string;
  description: string;
  briefCn: string;
  whyCn: string;
  tags: string[];
  directions: string[];
  score?: number;
  growth?: number;
  firstSeen?: string;
  confidence?: "high" | "medium" | "low";
}): ProjectsViewModel["projects"][number] {
  const projectName = args.repo.split("/")[1] ?? args.repo;
  return {
    project: {
      project_name: projectName,
      repo_url: `https://github.com/${args.repo}`,
      repo_full_name: args.repo,
      first_seen: args.firstSeen ?? "2026-06-12",
      last_seen: "2026-06-12",
      sources: ["mission_github_search"],
      source_counts: { mission_github_search: 1 },
      appearances: 2,
      appearance_dates: ["2026-06-11", "2026-06-12"],
      persistence_state: "emerging",
      stars: 100,
      forks: 5,
      issues: 2,
      PR: 1,
      tags: args.tags,
      description: args.description,
      metrics_source: "embedded",
      metrics_trust_score: 0.8,
      data_trust: "medium",
      star_delta_available: true,
      star_delta_daily: args.growth ?? 10,
      star_delta_weekly: 20,
      trust_flags: [],
      raw_signals: [
        {
          project_name: projectName,
          repo_url: `https://github.com/${args.repo}`,
          source: "mission_github_search",
          timestamp: "2026-06-12T08:00:00.000Z",
          tags: args.tags,
          description: args.description,
        },
      ],
    },
    score: {
      total_score: args.score ?? 80,
      verdict: "watch",
      confidence: args.confidence ?? "medium",
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
    objective_score: args.score ?? 80,
    preference_boost: 0,
    base_final_rank: args.score ?? 80,
    final_rank: args.score ?? 80,
    matched_interest_topics: args.directions,
    project_brief_cn: args.briefCn,
    why_today_cn: args.whyCn,
    enhancement_source: "template_fallback",
    direction_matches: args.directions,
    appearance_reason_codes: ["mission_direction_match"],
    exposure_bucket: "mission_match",
    head_project: false,
    head_saturation_state: "normal",
  };
}

function makeView(projects: ProjectsViewModel["projects"] = fixtureProjects()): ProjectsViewModel {
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
    today_pulse_projects: projects.slice(0, 1),
    mission_match_projects: projects,
    explore_ribbon_projects: [],
    historical_context_projects: [],
    projects,
    selected_project: null,
  };
}

function fixtureProjects(): ProjectsViewModel["projects"] {
  return [
    makeProject({
      repo: "acme/helpdesk-agent",
      description: "Customer support workflow automation for helpdesk and service desk tickets.",
      briefCn: "客服工单处理智能体。",
      whyCn: "命中 customer-support-agent 和 helpdesk 方向。",
      tags: ["customer-support-agent", "helpdesk", "service-desk", "ticket-workflow"],
      directions: ["customer-support-agent"],
      score: 91,
      growth: 18,
    }),
    makeProject({
      repo: "TonyWang-hub/mcp-cn-commerce",
      description: "Chinese e-commerce MCP servers for shopping and merchant operations.",
      briefCn: "电商经营数据 MCP 连接器。",
      whyCn: "命中智能导购与电商运营代理方向。",
      tags: ["shopping-commerce-agent", "commerce", "ecommerce"],
      directions: ["shopping-commerce-agent"],
      score: 84,
      growth: 12,
    }),
    makeProject({
      repo: "brokermr810/QuantDinger",
      description: "Finance stock quant trading investment research agent for market analysis workflows.",
      briefCn: "金融投研与量化交易项目。",
      whyCn: "用于检索股票、投研、量化和交易方向项目。",
      tags: ["finance-agent", "stock", "quant", "trading", "investment-research", "金融", "量化"],
      directions: ["finance-research-agent"],
      score: 82,
      growth: 11,
    }),
    makeProject({
      repo: "acme/chemistry-agent",
      description: "Chemistry research assistant for molecule analysis, chemical literature, and laboratory workflows.",
      briefCn: "化学研究与分子分析助手。",
      whyCn: "用于检索化学、分子、实验室工作流方向项目。",
      tags: ["chemistry-agent", "chemical-science", "molecule", "laboratory", "化学", "分子"],
      directions: ["science-research-agent"],
      score: 79,
      growth: 9,
    }),
    makeProject({
      repo: "acme/medical-agent",
      description: "Medical workflow assistant project for healthcare triage and patient intake.",
      briefCn: "医疗工作流助手项目。",
      whyCn: "用于检索医疗场景 agent 项目。",
      tags: ["medical-agent", "healthcare", "triage", "patient-intake"],
      directions: ["regulated-medical-agent"],
      score: 76,
      growth: 8,
    }),
    makeProject({
      repo: "acme/education-agent",
      description: "Education tutoring agent for classroom lesson planning and student learning workflows.",
      briefCn: "教育教学与学生学习助手。",
      whyCn: "用于检索教育行业、课堂教案和学习辅导方向项目。",
      tags: ["education-agent", "edtech", "tutoring", "lesson-planning", "教育", "教学"],
      directions: ["education-agent"],
      score: 74,
      growth: 7,
    }),
  ];
}

const expandedQuery: ExpandedProjectQuery = {
  query: "customer support helpdesk service desk ticket",
  required_terms: [],
  optional_terms: ["customer support", "helpdesk", "service desk", "ticket", "客服", "工单"],
  boost_terms: ["customer-support-agent"],
  exclude_terms: [],
  target_fields: ["description", "tags", "direction", "metadata"],
  why_cn: "把任务描述扩展为客服工单和 helpdesk 项目方向。",
};

function interpretation(overrides: Partial<LlmFuzzyQueryInterpretation> = {}): LlmFuzzyQueryInterpretation {
  const base: LlmFuzzyQueryInterpretation = {
    schema_version: FUZZY_QUERY_SCHEMA_VERSION,
    raw_query: "帮客服处理工单",
    semantic_class: "task_use_case",
    decision: "expand_query",
    result_mode: "projects",
    confidence: 0.88,
    extracted_terms: [
      {
        term: "客服工单",
        normalized_term: "customer support ticket",
        type: "task",
        confidence: 0.9,
        reason_cn: "任务场景明确。",
      },
    ],
    expanded_queries: [expandedQuery],
    filters: {
      time_window: "unspecified",
      risk_preference: "unspecified",
      freshness_preference: "unspecified",
      sort_preference: "existing_rank",
    },
    boundary: {
      is_sensitive_domain: false,
      sensitive_domain: null,
      reason_cn: null,
      user_message_cn: null,
    },
    clarification_options: [],
    explanation_cn: "已按客服工单和 helpdesk 方向扩展搜索。",
    fallback: {
      if_expanded_search_empty: "show_hot_projects",
      preserve_original_query: true,
    },
  };
  const { filters, boundary, fallback, ...rest } = overrides;
  return {
    ...base,
    ...rest,
    filters: {
      ...base.filters,
      ...filters,
    },
    boundary: {
      ...base.boundary,
      ...boundary,
    },
    fallback: {
      ...base.fallback,
      ...fallback,
    },
  };
}

async function listen(server: http.Server): Promise<string> {
  openServers.push(server);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        resolve(`http://127.0.0.1:${address.port}`);
      }
    });
  });
}

async function postJson(baseUrl: string, pathName: string, body: unknown): Promise<{ status: number; payload: unknown }> {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: response.status, payload: await response.json() };
}

function snapshotDataFiles(): string {
  const dataRoot = path.join(process.cwd(), "data");
  const rows: string[] = [];
  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        rows.push(`${path.relative(dataRoot, fullPath).replace(/\\/g, "/")}|${stat.size}|${stat.mtimeMs}`);
      }
    }
  };
  walk(dataRoot);
  return rows.join("\n");
}

describe("fuzzy project search service", () => {
  it("keeps direct search as the highest-priority gate and does not call LLM", async () => {
    let calls = 0;
    const response = await searchFuzzyProjects({
      request: { raw_query: "客服", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => {
        calls += 1;
        return { status: "fallback", fallbackReason: "llm_unconfigured", repaired: false };
      },
    });

    expect(calls).toBe(0);
    expect(response.source).toBe("direct_search");
    expect(response.diagnostics.llm_triggered).toBe(false);
    expect(response.project_ids).toContain("acme/helpdesk-agent");
  });

  it("bypasses low-quality natural-language direct hits that only match generic agent terms", async () => {
    let calls = 0;
    const response = await searchFuzzyProjects({
      request: { raw_query: "航天行业有什么 agent", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => {
        calls += 1;
        return {
          status: "ok",
          interpretation: interpretation({
            raw_query: "航天行业有什么 agent",
            semantic_class: "topic_keyword",
            extracted_terms: [
              {
                term: "航天行业",
                normalized_term: "aerospace satellite orbital spacecraft",
                type: "domain",
                confidence: 0.91,
                reason_cn: "用户指定了明确行业领域。",
              },
            ],
            expanded_queries: [
              {
                query: "aerospace satellite orbital spacecraft space operations 航天 卫星 轨道 飞船",
                required_terms: ["aerospace"],
                optional_terms: ["aerospace", "satellite", "orbital", "spacecraft", "space operations", "航天", "卫星", "轨道", "飞船"],
                boost_terms: ["aerospace-agent"],
                exclude_terms: [],
                target_fields: ["description", "tags", "direction", "metadata"],
                why_cn: "把航天行业提问扩展为航天、卫星和轨道项目关键词。",
              },
            ],
            explanation_cn: "已按航天行业关键词扩展站内项目搜索。",
            fallback: {
              if_expanded_search_empty: "show_no_match",
              preserve_original_query: true,
            },
          }),
          rawOutput: "aerospace raw",
          repaired: false,
        };
      },
    });

    expect(calls).toBe(1);
    expect(response.source).toBe("llm_expanded");
    expect(response.diagnostics.direct_result_count).toBeGreaterThan(0);
    expect(response.result_mode).toBe("none");
    expect(response.project_ids).toEqual([]);
  });

  it("keeps direct search for concise domain keywords", async () => {
    let calls = 0;
    const response = await searchFuzzyProjects({
      request: { raw_query: "教育", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => {
        calls += 1;
        return { status: "fallback", fallbackReason: "schema_invalid", repaired: false };
      },
    });

    expect(calls).toBe(0);
    expect(response.source).toBe("direct_search");
    expect(response.diagnostics.llm_triggered).toBe(false);
    expect(response.project_ids[0]).toBe("acme/education-agent");
  });

  it("routes CJK topics with generic agent terms away from broad direct search", async () => {
    let calls = 0;
    const response = await searchFuzzyProjects({
      request: { raw_query: "电商导购 agent", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => {
        calls += 1;
        return {
          status: "ok",
          interpretation: interpretation({
            raw_query: "电商导购 agent",
            semantic_class: "topic_keyword",
            extracted_terms: [
              {
                term: "电商导购",
                normalized_term: "commerce shopping ecommerce merchant",
                type: "domain",
                confidence: 0.9,
                reason_cn: "用户指定了电商导购领域。",
              },
            ],
            expanded_queries: [
              {
                query: "commerce shopping ecommerce merchant guide agent 电商 导购",
                required_terms: ["commerce"],
                optional_terms: ["commerce", "shopping", "ecommerce", "merchant", "guide", "agent", "电商", "导购"],
                boost_terms: ["shopping-commerce-agent"],
                exclude_terms: [],
                target_fields: ["description", "tags", "direction", "metadata"],
                why_cn: "把电商导购查询扩展为 commerce/shopping 项目关键词。",
              },
            ],
            explanation_cn: "已按电商导购关键词扩展站内项目搜索。",
          }),
          rawOutput: "commerce raw",
          repaired: false,
        };
      },
    });

    expect(calls).toBe(1);
    expect(response.source).toBe("llm_expanded");
    expect(response.diagnostics.direct_result_count).toBeGreaterThan(0);
    expect(response.project_ids[0]).toBe("TonyWang-hub/mcp-cn-commerce");
    expect(response.project_ids).not.toContain("acme/helpdesk-agent");
  });

  it("expands zero-result task queries and returns only local project ids", async () => {
    const response = await searchFuzzyProjects({
      request: { raw_query: "帮客服处理工单", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => ({
        status: "ok",
        interpretation: interpretation(),
        rawOutput: "raw secret output with fake-project",
        repaired: false,
      }),
    });

    expect(response.source).toBe("llm_expanded");
    expect(response.project_ids).toEqual(["acme/helpdesk-agent"]);
    expect(JSON.stringify(response)).not.toContain("raw secret output");
    expect(JSON.stringify(response)).not.toContain("fake-project");
  });

  it("routes regulated keyword searches through project search with a boundary message", async () => {
    let calls = 0;
    const finance = await searchFuzzyProjects({
      request: { raw_query: "美股今天买什么", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => {
        calls += 1;
        return { status: "fallback", fallbackReason: "schema_invalid", repaired: false };
      },
    });
    const response = await searchFuzzyProjects({
      request: { raw_query: "给我诊断这个病", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => {
        calls += 1;
        return { status: "fallback", fallbackReason: "schema_invalid", repaired: false };
      },
    });

    expect(finance.source).toBe("regulated_keyword_search");
    expect(finance.boundary_message_cn).toContain("不提供真实投资建议");
    expect(finance.diagnostics.llm_triggered).toBe(true);
    expect(finance.project_ids[0]).toBe("brokermr810/QuantDinger");
    expect(response.source).toBe("regulated_keyword_search");
    expect(response.boundary_message_cn).toContain("不提供真实医疗诊断");
    expect(response.project_ids).toContain("acme/medical-agent");
    expect(calls).toBe(0);
  });

  it("leaves concrete non-regulated discovery queries to the interpreter instead of local keyword routing", async () => {
    let calls = 0;
    const response = await searchFuzzyProjects({
      request: { raw_query: "化学今天关注什么", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => {
        calls += 1;
        return {
          status: "ok",
          interpretation: interpretation({
            raw_query: "化学今天关注什么",
            semantic_class: "topic_keyword",
            extracted_terms: [
              {
                term: "化学",
                normalized_term: "chemistry",
                type: "domain",
                confidence: 0.92,
                reason_cn: "用户指定了明确的学科领域。",
              },
            ],
            expanded_queries: [
              {
                query: "化学 chemistry chemical science molecule laboratory agent",
                required_terms: ["chemistry"],
                optional_terms: ["chemistry", "chemical", "science", "molecule", "laboratory", "agent", "化学", "分子", "实验室"],
                boost_terms: ["chemistry-agent"],
                exclude_terms: [],
                target_fields: ["description", "tags", "direction", "metadata"],
                why_cn: "把化学领域提问扩展为站内项目库可检索关键词。",
              },
            ],
            explanation_cn: "已按化学领域关键词扩展站内项目搜索。",
          }),
          rawOutput: "chemistry raw",
          repaired: false,
        };
      },
    });

    expect(calls).toBe(1);
    expect(response.source).toBe("llm_expanded");
    expect(response.diagnostics.semantic_class).toBe("topic_keyword");
    expect(response.project_ids[0]).toBe("acme/chemistry-agent");
    expect(response.project_ids).not.toContain("acme/helpdesk-agent");
    expect(response.boundary_message_cn).toBeUndefined();
  });

  it("does not replace empty expanded matches with generic hot projects for concrete topics", async () => {
    const response = await searchFuzzyProjects({
      request: { raw_query: "化学今天关注什么", date: "2026-06-12", lang: "zh" },
      view: makeView([fixtureProjects()[0]]),
      llm: disabledLlm,
      interpreter: async () => ({
        status: "ok",
        interpretation: interpretation({
          raw_query: "化学今天关注什么",
          semantic_class: "topic_keyword",
          extracted_terms: [
            {
              term: "化学",
              normalized_term: "chemistry",
              type: "domain",
              confidence: 0.92,
              reason_cn: "用户指定了明确的学科领域。",
            },
          ],
          expanded_queries: [
            {
              query: "化学 chemistry chemical science molecule laboratory agent",
              required_terms: ["chemistry"],
              optional_terms: ["chemistry", "chemical", "science", "molecule", "laboratory", "agent", "化学", "分子", "实验室"],
              boost_terms: ["chemistry-agent"],
              exclude_terms: [],
              target_fields: ["description", "tags", "direction", "metadata"],
              why_cn: "把化学领域提问扩展为站内项目库可检索关键词。",
            },
          ],
          explanation_cn: "已按化学领域关键词扩展站内项目搜索。",
          fallback: {
            if_expanded_search_empty: "show_hot_projects",
            preserve_original_query: true,
          },
        }),
        rawOutput: "chemistry raw",
        repaired: false,
      }),
    });

    expect(response.source).toBe("llm_expanded");
    expect(response.result_mode).toBe("none");
    expect(response.project_ids).toEqual([]);
    expect(response.diagnostics.fallback_reason).toBe("expanded_empty");
  });

  it("uses extracted core terms as a fallback constraint when LLM omits required_terms", async () => {
    const response = await searchFuzzyProjects({
      request: { raw_query: "化学今天关注什么", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => ({
        status: "ok",
        interpretation: interpretation({
          raw_query: "化学今天关注什么",
          semantic_class: "topic_keyword",
          extracted_terms: [
            {
              term: "化学",
              normalized_term: "chemistry",
              type: "domain",
              confidence: 0.92,
              reason_cn: "用户指定了明确的学科领域。",
            },
          ],
          expanded_queries: [
            {
              query: "化学 chemistry chemical science molecule laboratory agent",
              required_terms: [],
              optional_terms: ["chemistry", "chemical", "science", "molecule", "laboratory", "agent", "化学", "分子", "实验室"],
              boost_terms: ["chemistry-agent"],
              exclude_terms: [],
              target_fields: ["description", "tags", "direction", "metadata"],
              why_cn: "LLM 忘记写 required_terms，但保留了领域词。",
            },
          ],
          explanation_cn: "已按化学领域关键词扩展站内项目搜索。",
          fallback: {
            if_expanded_search_empty: "show_no_match",
            preserve_original_query: true,
          },
        }),
        rawOutput: "chemistry raw",
        repaired: false,
      }),
    });

    expect(response.source).toBe("llm_expanded");
    expect(response.result_mode).toBe("projects");
    expect(response.project_ids[0]).toBe("acme/chemistry-agent");
    expect(response.project_ids).not.toContain("acme/helpdesk-agent");
    expect(response.diagnostics.fallback_reason).toBeUndefined();
  });

  it("ignores generic agent required terms when core extracted terms must constrain expanded matches", async () => {
    const response = await searchFuzzyProjects({
      request: { raw_query: "教育行业有什么 agent", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => ({
        status: "ok",
        interpretation: interpretation({
          raw_query: "教育行业有什么 agent",
          semantic_class: "topic_keyword",
          extracted_terms: [
            {
              term: "教育行业",
              normalized_term: "education edtech tutoring classroom learning",
              type: "domain",
              confidence: 0.92,
              reason_cn: "用户指定了教育行业领域。",
            },
            {
              term: "agent",
              normalized_term: "agent",
              type: "technology",
              confidence: 0.7,
              reason_cn: "用户希望查找 agent 项目。",
            },
          ],
          expanded_queries: [
            {
              query: "education edtech tutoring classroom learning agent 教育 教学 学习",
              required_terms: ["agent"],
              optional_terms: ["education", "edtech", "tutoring", "classroom", "learning", "agent", "教育", "教学", "学习"],
              boost_terms: ["education-agent"],
              exclude_terms: [],
              target_fields: ["description", "tags", "direction", "metadata"],
              why_cn: "模拟 LLM 错把 agent 泛词放进 required_terms 的输出。",
            },
          ],
          explanation_cn: "已按教育行业关键词扩展站内项目搜索。",
          fallback: {
            if_expanded_search_empty: "show_no_match",
            preserve_original_query: true,
          },
        }),
        rawOutput: "education raw",
        repaired: false,
      }),
    });

    expect(response.source).toBe("llm_expanded");
    expect(response.project_ids).toEqual(["acme/education-agent"]);
    expect(response.project_ids).not.toContain("acme/helpdesk-agent");
    expect(response.diagnostics.expanded_result_count).toBe(1);
  });

  it("uses raw core terms instead of hot projects when the LLM fallback has a concrete topic", async () => {
    const response = await searchFuzzyProjects({
      request: { raw_query: "教育行业有什么 agent", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => ({ status: "fallback", fallbackReason: "llm_timeout", repaired: false }),
    });

    expect(response.source).toBe("llm_failed_fallback");
    expect(response.result_mode).toBe("projects");
    expect(response.project_ids).toEqual(["acme/education-agent"]);
    expect(response.project_ids).not.toContain("acme/helpdesk-agent");
    expect(response.diagnostics.decision).toBe("expand_query");
    expect(response.diagnostics.fallback_reason).toBe("llm_timeout");
  });

  it("supports hot-only, clarification, failure fallback, and cache hit diagnostics", async () => {
    const hot = await searchFuzzyProjects({
      request: { raw_query: "这怎么哈哈了", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => ({
        status: "ok",
        interpretation: interpretation({
          semantic_class: "low_semantic",
          decision: "hot_only",
          result_mode: "hot_projects",
          extracted_terms: [],
          expanded_queries: [],
          explanation_cn: "未识别到明确方向，先展示热门项目。",
        }),
        rawOutput: "hot raw",
        repaired: false,
      }),
    });
    expect(hot.source).toBe("hot_only");
    expect(hot.result_mode).toBe("hot_projects");

    const clarification = await searchFuzzyProjects({
      request: { raw_query: "帮我找那个", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => ({
        status: "ok",
        interpretation: interpretation({
          semantic_class: "ambiguous",
          decision: "needs_clarification",
          result_mode: "none",
          expanded_queries: [],
          clarification_options: [
            { label_cn: "客服工单", query: "客服 工单", semantic_hint: "task_use_case", why_cn: "搜索客服工单项目。" },
            { label_cn: "电商导购", query: "电商 导购", semantic_hint: "task_use_case", why_cn: "搜索电商导购项目。" },
          ],
          explanation_cn: "需要选择一个更具体的搜索方向。",
        }),
        rawOutput: "ambiguous raw",
        repaired: false,
      }),
    });
    expect(clarification.source).toBe("needs_clarification");
    expect(clarification.project_ids).toEqual([]);
    expect(clarification.clarification_options).toHaveLength(2);

    const failed = await searchFuzzyProjects({
      request: { raw_query: "找一个不存在的复杂项目", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      interpreter: async () => ({ status: "fallback", fallbackReason: "llm_unconfigured", repaired: false }),
    });
    expect(failed.source).toBe("llm_failed_fallback");
    expect(failed.diagnostics.fallback_reason).toBe("llm_unconfigured");

    const cache: FuzzySearchCache = new Map();
    let calls = 0;
    const first = await searchFuzzyProjects({
      request: { raw_query: "帮客服处理工单", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      cache,
      interpreter: async () => {
        calls += 1;
        return { status: "ok", interpretation: interpretation(), rawOutput: "cached raw", repaired: false };
      },
    });
    const second = await searchFuzzyProjects({
      request: { raw_query: "帮客服处理工单", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      cache,
      interpreter: async () => {
        calls += 1;
        return { status: "fallback", fallbackReason: "schema_invalid", repaired: false };
      },
    });
    expect(first.diagnostics.cache_status).toBe("miss");
    expect(second.diagnostics.cache_status).toBe("hit");
    expect(calls).toBe(1);
  });

  it("does not cache llm timeouts so later requests can retry", async () => {
    const cache: FuzzySearchCache = new Map();
    let calls = 0;

    const first = await searchFuzzyProjects({
      request: { raw_query: "教育行业有什么 agent", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      cache,
      interpreter: async () => {
        calls += 1;
        return { status: "fallback", fallbackReason: "llm_timeout", repaired: false };
      },
    });
    const second = await searchFuzzyProjects({
      request: { raw_query: "教育行业有什么 agent", date: "2026-06-12", lang: "zh" },
      view: makeView(),
      llm: disabledLlm,
      cache,
      interpreter: async () => {
        calls += 1;
        return { status: "ok", interpretation: interpretation(), rawOutput: "retry raw", repaired: false };
      },
    });

    expect(first.diagnostics.cache_status).toBe("miss");
    expect(second.diagnostics.cache_status).toBe("miss");
    expect(calls).toBe(2);
  });
  });

describe("fuzzy project endpoint", () => {
  it("returns stable 4xx JSON for malformed requests", async () => {
    const baseUrl = await listen(createVisualConsoleServer());
    const response = await postJson(baseUrl, "/api/projects/fuzzy-search", "{");

    expect(response.status).toBe(400);
    expect(response.payload).toMatchObject({ error: "invalid_fuzzy_search_request" });
  });

  it("converts internal valid-request failures into endpoint_error fallback responses", async () => {
    const baseUrl = await listen(
      createVisualConsoleServer({
        buildProjectsView: () => makeView(),
        loadConfig: () => ({ llm: disabledLlm } as AppConfig),
        searchFuzzyProjects: async () => {
          throw new Error("boom");
        },
      }),
    );
    const response = await postJson(baseUrl, "/api/projects/fuzzy-search", { raw_query: "帮客服处理工单", date: "2026-06-12" });

    expect(response.status).toBe(200);
    expect(response.payload).toMatchObject({
      source: "llm_failed_fallback",
      diagnostics: { fallback_reason: "endpoint_error" },
    });
  });

  it("does not modify data files for a valid no-key fallback request", async () => {
    const before = snapshotDataFiles();
    const baseUrl = await listen(createVisualConsoleServer());
    const response = await postJson(baseUrl, "/api/projects/fuzzy-search", { raw_query: "不存在的复杂搜索词", date: "latest" });
    const after = snapshotDataFiles();

    expect(response.status).toBe(200);
    expect(response.payload).toMatchObject({ source: "llm_failed_fallback" });
    expect(after).toBe(before);
  });

  it("reuses the fuzzy interpretation cache across endpoint requests", async () => {
    let calls = 0;
    const baseUrl = await listen(
      createVisualConsoleServer({
        buildProjectsView: () => makeView(),
        loadConfig: () => ({ llm: disabledLlm } as AppConfig),
        searchFuzzyProjects: async (input) =>
          searchFuzzyProjects({
            ...input,
            interpreter: async () => {
              calls += 1;
              return { status: "ok", interpretation: interpretation(), rawOutput: "endpoint cached raw", repaired: false };
            },
          }),
      }),
    );

    const first = await postJson(baseUrl, "/api/projects/fuzzy-search", { raw_query: "帮客服处理工单", date: "2026-06-12" });
    const second = await postJson(baseUrl, "/api/projects/fuzzy-search", { raw_query: "帮客服处理工单", date: "2026-06-12" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.payload).toMatchObject({ diagnostics: { cache_status: "miss" } });
    expect(second.payload).toMatchObject({ diagnostics: { cache_status: "hit" } });
    expect(calls).toBe(1);
  });
});
