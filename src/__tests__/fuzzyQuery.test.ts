import { describe, expect, it } from "vitest";
import type { AppConfig } from "../config.ts";
import { buildFuzzyQueryPrompt } from "../search/fuzzyQueryPrompt.ts";
import { interpretFuzzyQuery } from "../search/fuzzyQueryInterpreter.ts";
import {
  buildFuzzySearchCacheKey,
  FUZZY_QUERY_SCHEMA_VERSION,
  queryMeetsFuzzyTriggerThreshold,
  type ExpandedProjectQuery,
  type LlmFuzzyQueryInterpretation,
  type FuzzySearchSemanticClass,
  validateLlmFuzzyQueryInterpretation,
} from "../search/fuzzyQueryTypes.ts";

const enabledLlm: AppConfig["llm"] = {
  enabled: true,
  mode: "semantic-classification",
  provider: "openai",
};

const disabledLlm: AppConfig["llm"] = {
  enabled: false,
  mode: "rules-only",
  provider: "none",
};

const expandedQuery: ExpandedProjectQuery = {
  query: "customer support helpdesk service desk ticket agent",
  required_terms: [],
  optional_terms: ["customer support", "helpdesk", "ticket", "agent", "客服", "工单"],
  boost_terms: ["customer-support-agent"],
  exclude_terms: [],
  target_fields: ["description", "tags", "direction", "metadata"],
  why_cn: "按客服、工单和 helpdesk 方向扩展站内项目搜索。",
};

const clarificationOptions = [
  {
    label_cn: "客服工单 agent",
    query: "客服 工单 agent",
    semantic_hint: "task_use_case" as const,
    why_cn: "搜索客服工单处理项目。",
  },
  {
    label_cn: "电商导购 agent",
    query: "电商 导购 agent",
    semantic_hint: "task_use_case" as const,
    why_cn: "搜索电商导购项目。",
  },
];

function baseInterpretation(overrides: Partial<LlmFuzzyQueryInterpretation> = {}): LlmFuzzyQueryInterpretation {
  const base: LlmFuzzyQueryInterpretation = {
    schema_version: FUZZY_QUERY_SCHEMA_VERSION,
    raw_query: "帮客服处理工单",
    semantic_class: "task_use_case",
    decision: "expand_query",
    result_mode: "projects",
    confidence: 0.86,
    extracted_terms: [
      {
        term: "客服工单",
        normalized_term: "customer support ticket",
        type: "task",
        confidence: 0.9,
        reason_cn: "用户描述了客服工单处理任务。",
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
    explanation_cn: "已按客服工单处理方向扩展站内项目搜索。",
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

function legalInterpretation(semanticClass: FuzzySearchSemanticClass): LlmFuzzyQueryInterpretation {
  if (semanticClass === "low_semantic") {
    return baseInterpretation({
      semantic_class: "low_semantic",
      decision: "hot_only",
      result_mode: "hot_projects",
      confidence: 0.8,
      extracted_terms: [],
      expanded_queries: [],
      clarification_options: [],
      explanation_cn: "未识别到明确方向，先展示热门项目。",
    });
  }
  if (semanticClass === "open_discovery") {
    return baseInterpretation({
      semantic_class: "open_discovery",
      decision: "hot_only",
      result_mode: "hot_projects",
      extracted_terms: [],
      expanded_queries: [],
      clarification_options: [],
      explanation_cn: "按当前热门项目展示。",
    });
  }
  if (semanticClass === "regulated_keyword_search") {
    return baseInterpretation({
      semantic_class: "regulated_keyword_search",
      boundary: {
        is_sensitive_domain: true,
        sensitive_domain: "finance",
        reason_cn: "站内金融投研 agent 项目搜索。",
        user_message_cn: "仅按站内 AI Agent 项目检索，不提供真实投资建议。",
      },
      explanation_cn: "已按金融投研 agent 项目扩展搜索。",
    });
  }
  if (semanticClass === "ambiguous") {
    return baseInterpretation({
      semantic_class: "ambiguous",
      decision: "needs_clarification",
      result_mode: "none",
      expanded_queries: [],
      clarification_options: clarificationOptions,
      explanation_cn: "这个查询可能指向多个方向，请选择一个改写。",
    });
  }
  return baseInterpretation({ semantic_class: semanticClass });
}

describe("fuzzy query contracts", () => {
  it("accepts all seven frozen semantic classes when their routing fields are coherent", () => {
    for (const semanticClass of [
      "low_semantic",
      "open_discovery",
      "topic_keyword",
      "task_use_case",
      "attribute_filter",
      "regulated_keyword_search",
      "ambiguous",
    ] as const) {
      const result = validateLlmFuzzyQueryInterpretation(legalInterpretation(semanticClass));
      expect(result.ok, semanticClass).toBe(true);
    }
  });

  it("rejects enum drift and semantic routing violations", () => {
    expect(validateLlmFuzzyQueryInterpretation({ ...baseInterpretation(), semantic_class: "regulated_in_scope" }).ok).toBe(false);
    expect(validateLlmFuzzyQueryInterpretation(legalInterpretation("low_semantic")).ok).toBe(true);
    expect(validateLlmFuzzyQueryInterpretation({ ...legalInterpretation("low_semantic"), expanded_queries: [expandedQuery] }).ok).toBe(false);
    expect(
      validateLlmFuzzyQueryInterpretation({
        ...legalInterpretation("regulated_keyword_search"),
        boundary: { is_sensitive_domain: true, sensitive_domain: "finance", reason_cn: "x", user_message_cn: "" },
      }).ok,
    ).toBe(false);
    expect(validateLlmFuzzyQueryInterpretation({ ...legalInterpretation("ambiguous"), clarification_options: [clarificationOptions[0]!] }).ok).toBe(false);
  });

  it("keeps fuzzy trigger thresholds small but explicit", () => {
    expect(queryMeetsFuzzyTriggerThreshold("a")).toBe(false);
    expect(queryMeetsFuzzyTriggerThreshold("ab")).toBe(false);
    expect(queryMeetsFuzzyTriggerThreshold("abc")).toBe(true);
    expect(queryMeetsFuzzyTriggerThreshold("诊")).toBe(false);
    expect(queryMeetsFuzzyTriggerThreshold("诊断")).toBe(true);
  });

  it("builds cache keys from date, normalized query, lang, filters, and schema version", () => {
    const first = buildFuzzySearchCacheKey({
      date: "2026-06-12",
      normalizedQuery: "客服工单",
      lang: "zh",
      activeFilters: { sort: "score", filters: { paradigm: "all" } },
    });
    const second = buildFuzzySearchCacheKey({
      date: "2026-06-12",
      normalizedQuery: "客服工单",
      lang: "zh",
      activeFilters: { sort: "growth", filters: { paradigm: "all" } },
    });

    expect(first).toContain(FUZZY_QUERY_SCHEMA_VERSION);
    expect(first).not.toBe(second);
  });

  it("keeps short Chinese finance and medical queries pinned to regulated routing in the prompt", () => {
    const prompt = buildFuzzyQueryPrompt({ rawQuery: "美股今天买什么" });
    expect(prompt).toContain("美股今天买什么");
    expect(prompt).toContain("今天买哪只股票");
    expect(prompt).toContain("给我诊断这个病");
    expect(prompt).toContain('semantic_class="regulated_keyword_search"');
  });

  it("keeps concrete non-regulated domain discovery on the LLM expansion path", () => {
    const prompt = buildFuzzyQueryPrompt({ rawQuery: "化学今天关注什么" });
    expect(prompt).toContain("化学今天关注什么");
    expect(prompt).toContain("concrete subject/domain noun");
    expect(prompt).toContain("create expanded local-search queries");
    expect(prompt).toContain("化学今天关注什么");
  });
});

describe("fuzzy query interpreter", () => {
  it("returns an unconfigured fallback without calling a provider", async () => {
    let calls = 0;
    const result = await interpretFuzzyQuery({
      llm: disabledLlm,
      rawQuery: "帮客服处理工单",
      caller: async () => {
        calls += 1;
        return "{}";
      },
    });

    expect(calls).toBe(0);
    expect(result).toMatchObject({ status: "fallback", fallbackReason: "llm_unconfigured", repaired: false });
  });

  it("uses an injected fake provider for successful interpretation", async () => {
    const result = await interpretFuzzyQuery({
      llm: enabledLlm,
      rawQuery: "帮客服处理工单",
      caller: async () => JSON.stringify(legalInterpretation("task_use_case")),
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.interpretation.semantic_class).toBe("task_use_case");
      expect(result.repaired).toBe(false);
    }
  });

  it("repairs invalid JSON once and returns the repaired interpretation", async () => {
    const outputs = ["not-json", JSON.stringify(legalInterpretation("open_discovery"))];
    const result = await interpretFuzzyQuery({
      llm: enabledLlm,
      rawQuery: "最近有什么值得看",
      caller: async () => outputs.shift() ?? "{}",
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.repaired).toBe(true);
      expect(result.interpretation.semantic_class).toBe("open_discovery");
    }
  });

  it("falls back when repair still violates the schema", async () => {
    const result = await interpretFuzzyQuery({
      llm: enabledLlm,
      rawQuery: "帮客服处理工单",
      caller: async () => JSON.stringify({ schema_version: "wrong" }),
    });

    expect(result).toMatchObject({ status: "fallback", fallbackReason: "schema_invalid", repaired: true });
  });

  it("maps provider errors and timeouts to controlled fallback reasons", async () => {
    const providerError = await interpretFuzzyQuery({
      llm: enabledLlm,
      rawQuery: "帮客服处理工单",
      caller: async () => {
        throw new Error("missing API key");
      },
    });
    expect(providerError).toMatchObject({ status: "fallback", fallbackReason: "llm_unconfigured" });

    const timeout = await interpretFuzzyQuery({
      llm: enabledLlm,
      rawQuery: "帮客服处理工单",
      timeoutMs: 1,
      caller: async () => new Promise<string>(() => {}),
    });
    expect(timeout).toMatchObject({ status: "fallback", fallbackReason: "llm_timeout" });
  });
});
