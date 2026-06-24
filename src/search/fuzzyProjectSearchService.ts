import type { AppConfig } from "../config.ts";
import type { ProjectsViewModel } from "../visualConsole/types.ts";
import { interpretFuzzyQuery, type FuzzyQueryInterpretationResult, type InterpretFuzzyQueryOptions } from "./fuzzyQueryInterpreter.ts";
import {
  buildFuzzySearchCacheKey,
  FUZZY_QUERY_SCHEMA_VERSION,
  FUZZY_SEARCH_RESPONSE_SCHEMA_VERSION,
  queryMeetsFuzzyTriggerThreshold,
  type FuzzyProjectSearchDiagnostics,
  type FuzzyProjectSearchRequest,
  type FuzzyProjectSearchResponse,
  type FuzzySearchFallbackReason,
  type FuzzySearchFilters,
  type FuzzySearchSource,
  type LlmFuzzyQueryInterpretation,
} from "./fuzzyQueryTypes.ts";
import { buildProjectSearchRecords, buildSearchFieldsSummary, buildDirectionAliasSummary, type ProjectSearchLang, type ProjectSearchRecord } from "./projectSearchIndex.ts";
import {
  extractMeaningfulProjectSearchCjkTerms,
  filterAndSortProjectCards,
  GENERIC_DIRECT_SEARCH_TOKENS,
  isCommonDirectSearchToken,
  normalizeProjectSearchText,
  projectSearchRecordContainsTerm,
  projectSearchTextHasCjk,
  shouldUseDirectProjectSearch,
  tokenizeProjectSearchText,
  type ProjectsWorkbenchSortMode,
} from "./projectSearchKernel.ts";

export interface FuzzySearchCacheEntry {
  status: FuzzyQueryInterpretationResult["status"];
  interpretation?: LlmFuzzyQueryInterpretation;
  fallbackReason?: FuzzySearchFallbackReason;
  rawOutput?: string;
  validationError?: string;
  repaired: boolean;
}

export type FuzzySearchCache = Map<string, FuzzySearchCacheEntry>;

export interface SearchFuzzyProjectsInput {
  request: FuzzyProjectSearchRequest;
  view: ProjectsViewModel;
  llm: AppConfig["llm"];
  cache?: FuzzySearchCache;
  interpreter?: (options: InterpretFuzzyQueryOptions) => Promise<FuzzyQueryInterpretationResult>;
  interpreterOptions?: Partial<Pick<InterpretFuzzyQueryOptions, "caller" | "timeoutMs" | "maxRepairCalls" | "maxTokens">>;
}

const DEFAULT_LLM_CONFIG: AppConfig["llm"] = {
  enabled: false,
  mode: "rules-only",
  provider: "none",
};

function langFromRequest(request: FuzzyProjectSearchRequest): ProjectSearchLang {
  return request.lang === "en" ? "en" : "zh";
}

function sortFromRequest(request: FuzzyProjectSearchRequest, interpretation?: LlmFuzzyQueryInterpretation): ProjectsWorkbenchSortMode {
  const preference = interpretation?.filters.sort_preference;
  if (preference === "growth") return "growth";
  if (preference === "score") return "score";
  return request.sort === "growth" ? "growth" : "score";
}

function filtersFromRequest(request: FuzzyProjectSearchRequest): { paradigm: string; persistence: string } {
  return {
    paradigm: request.filters?.paradigm || "all",
    persistence: request.filters?.persistence || "all",
  };
}

function presetFromRequest(request: FuzzyProjectSearchRequest): string {
  const rawPath = request.page_context?.path ?? "";
  if (!rawPath) return "all";
  try {
    const parsed = new URL(rawPath, "http://localhost");
    return parsed.searchParams.get("preset")?.trim() || "all";
  } catch {
    return "all";
  }
}

function projectIds(records: ProjectSearchRecord[]): string[] {
  return records.map((record) => record.projectId);
}

function buildDiagnostics(input: {
  directResultCount: number;
  llmTriggered: boolean;
  cacheStatus: FuzzyProjectSearchDiagnostics["cache_status"];
  decision: FuzzyProjectSearchDiagnostics["decision"];
  semanticClass?: FuzzyProjectSearchDiagnostics["semantic_class"];
  expandedQueryCount?: number;
  expandedResultCount?: number;
  unsupportedFilters?: string[];
  fallbackReason?: FuzzySearchFallbackReason;
}): FuzzyProjectSearchDiagnostics {
  return {
    direct_result_count: input.directResultCount,
    llm_triggered: input.llmTriggered,
    cache_status: input.cacheStatus,
    interpretation_schema_version: input.semanticClass ? FUZZY_QUERY_SCHEMA_VERSION : undefined,
    semantic_class: input.semanticClass,
    decision: input.decision,
    expanded_query_count: input.expandedQueryCount ?? 0,
    expanded_result_count: input.expandedResultCount ?? 0,
    unsupported_filters: input.unsupportedFilters ?? [],
    fallback_reason: input.fallbackReason,
  };
}

function buildResponse(input: {
  rawQuery: string;
  normalizedQuery: string;
  source: FuzzySearchSource;
  resultMode: FuzzyProjectSearchResponse["result_mode"];
  projectIds: string[];
  explanationCn?: string;
  boundaryMessageCn?: string;
  clarificationOptions?: FuzzyProjectSearchResponse["clarification_options"];
  diagnostics: FuzzyProjectSearchDiagnostics;
}): FuzzyProjectSearchResponse {
  return {
    schema_version: FUZZY_SEARCH_RESPONSE_SCHEMA_VERSION,
    raw_query: input.rawQuery,
    normalized_query: input.normalizedQuery,
    source: input.source,
    result_mode: input.resultMode,
    project_ids: input.projectIds,
    explanation_cn: input.explanationCn,
    boundary_message_cn: input.boundaryMessageCn,
    clarification_options: input.clarificationOptions ?? [],
    diagnostics: input.diagnostics,
  };
}

function hotProjectRecords(records: ProjectSearchRecord[], request: FuzzyProjectSearchRequest): ProjectSearchRecord[] {
  const active = filtersFromRequest(request);
  return filterAndSortProjectCards(records, {
    search: "",
    sort: sortFromRequest(request),
    preset: presetFromRequest(request),
    paradigm: active.paradigm,
    persistence: active.persistence,
  });
}

function directProjectRecords(records: ProjectSearchRecord[], request: FuzzyProjectSearchRequest): ProjectSearchRecord[] {
  const active = filtersFromRequest(request);
  return filterAndSortProjectCards(records, {
    search: request.raw_query,
    sort: sortFromRequest(request),
    preset: presetFromRequest(request),
    paradigm: active.paradigm,
    persistence: active.persistence,
  });
}

const CORE_EXTRACTED_TERM_TYPES = new Set(["domain", "technology", "task", "attribute", "company", "project", "object"]);
const CJK_CONSTRAINT_SUFFIXES = ["行业", "领域", "方向", "场景", "相关"];

function normalizeConstraintTerm(term: string): string {
  return normalizeProjectSearchText(term)
    .replace(/\b(agent|agents|agentic|ai|llm|llms|project|projects|tool|tools|assistant|assistants)\b/g, " ")
    .replace(/(智能体|代理|助手|项目|工具|应用|系统|开源|仓库)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addConstraintTerm(terms: Set<string>, term: string): void {
  const normalized = normalizeProjectSearchText(term);
  if (normalized.length < 2 || GENERIC_DIRECT_SEARCH_TOKENS.has(normalized)) return;
  terms.add(normalized);

  if (!projectSearchTextHasCjk(normalized)) return;
  for (const suffix of CJK_CONSTRAINT_SUFFIXES) {
    if (!normalized.endsWith(suffix) || normalized.length <= suffix.length + 1) continue;
    const stripped = normalized.slice(0, -suffix.length).trim();
    if (stripped.length >= 2 && !GENERIC_DIRECT_SEARCH_TOKENS.has(stripped)) terms.add(stripped);
  }
}

function splitConstraintTerm(term: string): string[] {
  const normalized = normalizeConstraintTerm(term);
  const terms = new Set<string>();
  addConstraintTerm(terms, normalized);
  for (const token of tokenizeProjectSearchText(normalized)) {
    addConstraintTerm(terms, token);
  }
  for (const cjkTerm of extractMeaningfulProjectSearchCjkTerms(normalized)) {
    addConstraintTerm(terms, cjkTerm);
  }
  return Array.from(terms);
}

function extractedCoreConstraintTerms(interpretation: LlmFuzzyQueryInterpretation): string[] {
  const terms = new Set<string>();
  for (const item of interpretation.extracted_terms) {
    if (!CORE_EXTRACTED_TERM_TYPES.has(item.type) || item.confidence < 0.55) continue;
    for (const term of splitConstraintTerm(item.term)) terms.add(term);
    for (const term of splitConstraintTerm(item.normalized_term)) terms.add(term);
  }
  return Array.from(terms);
}

function extractedConstraintTermsForExpandedQuery(interpretation: LlmFuzzyQueryInterpretation, expanded: LlmFuzzyQueryInterpretation["expanded_queries"][number]): string[] {
  const terms = new Set<string>([...extractedCoreConstraintTerms(interpretation), ...expanded.required_terms.flatMap((term) => splitConstraintTerm(term))]);
  return Array.from(terms).filter((term) => term.length >= 2 && !GENERIC_DIRECT_SEARCH_TOKENS.has(term));
}

function rawQueryConstraintTerms(records: ProjectSearchRecord[], rawQuery: string): string[] {
  const terms = new Set<string>();

  for (const cjkTerm of extractMeaningfulProjectSearchCjkTerms(rawQuery)) {
    for (const term of splitConstraintTerm(cjkTerm)) terms.add(term);
  }

  for (const token of tokenizeProjectSearchText(rawQuery)) {
    if (projectSearchTextHasCjk(token)) continue;
    for (const term of splitConstraintTerm(token)) {
      if (!isCommonDirectSearchToken(records, term)) terms.add(term);
    }
  }

  return Array.from(terms);
}

function regulatedKeywordInterpretation(rawQuery: string, normalizedQuery: string): LlmFuzzyQueryInterpretation | null {
  const finance = /(美股|股票|买什么|买哪只|投资|投研|量化|交易|stock|stocks|investment|trading|quant)/i.test(rawQuery);
  const medical = /(诊断|这个病|吃药|治疗|医疗|症状|medical|diagnosis|treatment|medicine)/i.test(rawQuery);
  const legal = /(律师|法律|起诉|合同|legal|lawyer|lawsuit|contract)/i.test(rawQuery);
  const security = /(漏洞|攻击|入侵|exploit|security|attack|vulnerability)/i.test(rawQuery);
  const sensitiveDomain = finance ? "finance" : medical ? "medical" : legal ? "legal" : security ? "security" : null;
  if (!sensitiveDomain) return null;

  const query =
    sensitiveDomain === "finance"
      ? "finance stock quant trading investment 股票 投研 金融 量化 交易"
      : sensitiveDomain === "medical"
        ? "medical healthcare triage diagnosis patient intake agent"
        : sensitiveDomain === "legal"
          ? "legal contract compliance law agent"
          : "security vulnerability analysis defense agent";
  const boundaryMessage =
    sensitiveDomain === "finance"
      ? "仅按站内 AI Agent 项目检索，不提供真实投资建议或股票推荐。"
      : sensitiveDomain === "medical"
        ? "仅按站内 AI Agent 项目检索，不提供真实医疗诊断或治疗建议。"
        : sensitiveDomain === "legal"
          ? "仅按站内 AI Agent 项目检索，不提供真实法律建议。"
          : "仅按站内 AI Agent 项目检索，不提供攻击指导或真实安全处置建议。";

  return {
    schema_version: FUZZY_QUERY_SCHEMA_VERSION,
    raw_query: rawQuery,
    semantic_class: "regulated_keyword_search",
    decision: "expand_query",
    result_mode: "projects",
    confidence: 0.9,
    extracted_terms: [
      {
        term: rawQuery,
        normalized_term: normalizedQuery,
        type: "domain",
        confidence: 0.9,
        reason_cn: "查询包含敏感领域关键词，按站内项目库关键词检索处理。",
      },
    ],
    expanded_queries: [
      {
        query,
        required_terms: [],
        optional_terms: query.split(/\s+/),
        boost_terms: [],
        exclude_terms: [],
        target_fields: ["description", "tags", "direction", "metadata"],
        why_cn: "按敏感领域相关的软件项目关键词扩展站内项目库搜索。",
      },
    ],
    filters: {
      time_window: "unspecified",
      risk_preference: "unspecified",
      freshness_preference: "unspecified",
      sort_preference: "existing_rank",
    },
    boundary: {
      is_sensitive_domain: true,
      sensitive_domain: sensitiveDomain,
      reason_cn: "敏感领域查询仅转换为站内项目库关键词搜索。",
      user_message_cn: boundaryMessage,
    },
    clarification_options: [],
    explanation_cn: "已按敏感领域相关关键词扩展站内项目库搜索。",
    fallback: {
      if_expanded_search_empty: "show_hot_projects",
      preserve_original_query: true,
    },
  };
}

function dateValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function applyFuzzyFilters(records: ProjectSearchRecord[], filters: FuzzySearchFilters, selectedDate: string | null): { records: ProjectSearchRecord[]; unsupportedFilters: string[] } {
  let next = records.slice();
  const unsupportedFilters: string[] = [];
  const selectedDateValue = dateValue(selectedDate);

  if (filters.time_window !== "unspecified") {
    if (selectedDateValue === null) {
      unsupportedFilters.push("time_window");
    } else {
      const maxAgeDays = filters.time_window === "latest" ? 1 : 7;
      next = next.filter((record) => {
        const seen = dateValue(record.project.project.last_seen ?? record.project.project.first_seen);
        if (seen === null) {
          unsupportedFilters.push("time_window");
          return true;
        }
        return Math.abs(selectedDateValue - seen) / 86_400_000 <= maxAgeDays;
      });
    }
  }

  if (filters.risk_preference === "lower_risk") {
    next = next.filter((record) => record.project.score.confidence !== "low" && record.project.score.risks.length === 0 && record.project.score.anti_noise_flags.length === 0);
  }

  if (filters.freshness_preference === "persistent") {
    next = next.filter((record) => record.project.project.persistence_state !== "single-spike" || record.project.project.appearances > 1);
  }

  if (filters.freshness_preference === "newer") {
    next.sort((left, right) => (dateValue(right.project.project.first_seen) ?? 0) - (dateValue(left.project.project.first_seen) ?? 0));
  } else if (filters.sort_preference === "growth") {
    next.sort((left, right) => right.growth - left.growth || left.order - right.order);
  } else if (filters.sort_preference === "score") {
    next.sort((left, right) => right.score - left.score || left.order - right.order);
  }

  return { records: next, unsupportedFilters: Array.from(new Set(unsupportedFilters)) };
}

function expandedQueryAllowsRecord(record: ProjectSearchRecord, expanded: LlmFuzzyQueryInterpretation["expanded_queries"][number], coreConstraintTerms: string[]): boolean {
  const requiredTerms = Array.from(new Set([...coreConstraintTerms, ...expanded.required_terms.flatMap((term) => splitConstraintTerm(term))]));
  const excludeTerms = expanded.exclude_terms.map((term) => term.trim()).filter(Boolean);
  if (requiredTerms.length > 0 && !requiredTerms.some((term) => projectSearchRecordContainsTerm(record, term))) return false;
  if (excludeTerms.some((term) => projectSearchRecordContainsTerm(record, term))) return false;
  return true;
}

function expandedProjectRecords(
  records: ProjectSearchRecord[],
  request: FuzzyProjectSearchRequest,
  interpretation: LlmFuzzyQueryInterpretation,
): { records: ProjectSearchRecord[]; unsupportedFilters: string[] } {
  const active = filtersFromRequest(request);
  const matches = new Map<string, ProjectSearchRecord>();
  for (const expanded of interpretation.expanded_queries) {
    const constraintTerms = interpretation.semantic_class === "regulated_keyword_search" ? [] : extractedConstraintTermsForExpandedQuery(interpretation, expanded);
    const result = filterAndSortProjectCards(records, {
      search: expanded.query,
      sort: sortFromRequest(request, interpretation),
      preset: presetFromRequest(request),
      paradigm: active.paradigm,
      persistence: active.persistence,
    });
    for (const record of result) {
      if (!expandedQueryAllowsRecord(record, expanded, constraintTerms)) continue;
      if (!matches.has(record.projectId)) matches.set(record.projectId, record);
    }
  }
  return applyFuzzyFilters(Array.from(matches.values()), interpretation.filters, request.date ?? null);
}

function responseFromFallback(
  request: FuzzyProjectSearchRequest,
  normalizedQuery: string,
  records: ProjectSearchRecord[],
  directResultCount: number,
  fallbackReason: FuzzySearchFallbackReason,
  cacheStatus: FuzzyProjectSearchDiagnostics["cache_status"],
): FuzzyProjectSearchResponse {
  const constraintTerms = rawQueryConstraintTerms(records, request.raw_query);
  if (constraintTerms.length > 0) {
    const active = filtersFromRequest(request);
    const constrained = filterAndSortProjectCards(records, {
      search: constraintTerms.join(" "),
      sort: sortFromRequest(request),
      preset: presetFromRequest(request),
      paradigm: active.paradigm,
      persistence: active.persistence,
    }).filter((record) => constraintTerms.some((term) => projectSearchRecordContainsTerm(record, term)));
    const filtered = applyFuzzyFilters(constrained, {
      time_window: "unspecified",
      risk_preference: "unspecified",
      freshness_preference: "unspecified",
      sort_preference: sortFromRequest(request) === "growth" ? "growth" : "existing_rank",
    }, request.date ?? null);

    return buildResponse({
      rawQuery: request.raw_query,
      normalizedQuery,
      source: "llm_failed_fallback",
      resultMode: filtered.records.length > 0 ? "projects" : "none",
      projectIds: projectIds(filtered.records),
      explanationCn:
        filtered.records.length > 0
          ? "项目搜索解释暂不可用，已按查询中的核心词进行本地约束检索。"
          : "项目搜索解释暂不可用，已按查询中的核心词进行本地约束检索，但未命中相关项目。",
      diagnostics: buildDiagnostics({
        directResultCount,
        llmTriggered: true,
        cacheStatus,
        decision: "expand_query",
        expandedQueryCount: 1,
        expandedResultCount: filtered.records.length,
        unsupportedFilters: filtered.unsupportedFilters,
        fallbackReason,
      }),
    });
  }

  const hot = hotProjectRecords(records, request);
  return buildResponse({
    rawQuery: request.raw_query,
    normalizedQuery,
    source: "llm_failed_fallback",
    resultMode: "hot_projects",
    projectIds: projectIds(hot),
    explanationCn: "项目搜索解释暂不可用，先展示当前热门项目。",
    diagnostics: buildDiagnostics({
      directResultCount,
      llmTriggered: true,
      cacheStatus,
      decision: "hot_only",
      expandedResultCount: hot.length,
      fallbackReason,
    }),
  });
}

function responseFromNoExpandedMatch(
  request: FuzzyProjectSearchRequest,
  normalizedQuery: string,
  directResultCount: number,
  interpretation: LlmFuzzyQueryInterpretation,
  cacheStatus: FuzzyProjectSearchDiagnostics["cache_status"],
  unsupportedFilters: string[],
): FuzzyProjectSearchResponse {
  return buildResponse({
    rawQuery: request.raw_query,
    normalizedQuery,
    source: interpretation.semantic_class === "regulated_keyword_search" ? "regulated_keyword_search" : "llm_expanded",
    resultMode: "none",
    projectIds: [],
    explanationCn: "扩展检索未命中相关项目。",
    boundaryMessageCn: interpretation.semantic_class === "regulated_keyword_search" ? interpretation.boundary.user_message_cn ?? undefined : undefined,
    diagnostics: buildDiagnostics({
      directResultCount,
      llmTriggered: true,
      cacheStatus,
      semanticClass: interpretation.semantic_class,
      decision: interpretation.decision,
      expandedQueryCount: interpretation.expanded_queries.length,
      expandedResultCount: 0,
      unsupportedFilters,
      fallbackReason: "expanded_empty",
    }),
  });
}

function cacheEntryFromResult(result: FuzzyQueryInterpretationResult): FuzzySearchCacheEntry {
  if (result.status === "ok") {
    return {
      status: "ok",
      interpretation: result.interpretation,
      rawOutput: result.rawOutput,
      repaired: result.repaired,
    };
  }
  return {
    status: "fallback",
    fallbackReason: result.fallbackReason,
    rawOutput: result.rawOutput,
    validationError: result.validationError,
    repaired: result.repaired,
  };
}

function resultFromCacheEntry(entry: FuzzySearchCacheEntry): FuzzyQueryInterpretationResult {
  if (entry.status === "ok" && entry.interpretation) {
    return {
      status: "ok",
      interpretation: entry.interpretation,
      rawOutput: entry.rawOutput ?? "",
      repaired: entry.repaired,
    };
  }
  return {
    status: "fallback",
    fallbackReason: entry.fallbackReason ?? "schema_invalid",
    rawOutput: entry.rawOutput,
    validationError: entry.validationError,
    repaired: entry.repaired,
  };
}

function responseFromInterpretation(
  request: FuzzyProjectSearchRequest,
  normalizedQuery: string,
  records: ProjectSearchRecord[],
  directResultCount: number,
  interpretation: LlmFuzzyQueryInterpretation,
  cacheStatus: FuzzyProjectSearchDiagnostics["cache_status"],
): FuzzyProjectSearchResponse {
  if (interpretation.semantic_class === "low_semantic" || interpretation.semantic_class === "open_discovery") {
    const hot = hotProjectRecords(records, request);
    return buildResponse({
      rawQuery: request.raw_query,
      normalizedQuery,
      source: "hot_only",
      resultMode: "hot_projects",
      projectIds: projectIds(hot),
      explanationCn: interpretation.semantic_class === "low_semantic" ? "未识别到明确方向，先展示热门项目。" : "按当前热门项目展示。",
      diagnostics: buildDiagnostics({
        directResultCount,
        llmTriggered: true,
        cacheStatus,
        semanticClass: interpretation.semantic_class,
        decision: interpretation.decision,
        expandedResultCount: hot.length,
      }),
    });
  }

  if (interpretation.semantic_class === "ambiguous") {
    return buildResponse({
      rawQuery: request.raw_query,
      normalizedQuery,
      source: "needs_clarification",
      resultMode: "none",
      projectIds: [],
      explanationCn: interpretation.explanation_cn,
      clarificationOptions: interpretation.clarification_options,
      diagnostics: buildDiagnostics({
        directResultCount,
        llmTriggered: true,
        cacheStatus,
        semanticClass: interpretation.semantic_class,
        decision: interpretation.decision,
      }),
    });
  }

  const expanded = expandedProjectRecords(records, request, interpretation);
  const ids = projectIds(expanded.records);
  if (ids.length === 0 && interpretation.semantic_class !== "regulated_keyword_search") {
    return responseFromNoExpandedMatch(request, normalizedQuery, directResultCount, interpretation, cacheStatus, expanded.unsupportedFilters);
  }

  if (ids.length === 0 && interpretation.fallback.if_expanded_search_empty === "show_hot_projects") {
    const hot = hotProjectRecords(records, request);
    return buildResponse({
      rawQuery: request.raw_query,
      normalizedQuery,
      source: "hot_only",
      resultMode: "hot_projects",
      projectIds: projectIds(hot),
      explanationCn: "扩展检索未命中项目库，先展示当前热门项目。",
      boundaryMessageCn: interpretation.semantic_class === "regulated_keyword_search" ? interpretation.boundary.user_message_cn ?? undefined : undefined,
      diagnostics: buildDiagnostics({
        directResultCount,
        llmTriggered: true,
        cacheStatus,
        semanticClass: interpretation.semantic_class,
        decision: interpretation.decision,
        expandedQueryCount: interpretation.expanded_queries.length,
        expandedResultCount: 0,
        unsupportedFilters: expanded.unsupportedFilters,
        fallbackReason: "expanded_empty",
      }),
    });
  }

  return buildResponse({
    rawQuery: request.raw_query,
    normalizedQuery,
    source: interpretation.semantic_class === "regulated_keyword_search" ? "regulated_keyword_search" : "llm_expanded",
    resultMode: ids.length > 0 ? "projects" : "none",
    projectIds: ids,
    explanationCn: interpretation.explanation_cn,
    boundaryMessageCn: interpretation.semantic_class === "regulated_keyword_search" ? interpretation.boundary.user_message_cn ?? undefined : undefined,
    diagnostics: buildDiagnostics({
      directResultCount,
      llmTriggered: true,
      cacheStatus,
      semanticClass: interpretation.semantic_class,
      decision: interpretation.decision,
      expandedQueryCount: interpretation.expanded_queries.length,
      expandedResultCount: ids.length,
      unsupportedFilters: expanded.unsupportedFilters,
      fallbackReason: ids.length === 0 ? "expanded_empty" : undefined,
    }),
  });
}

export async function searchFuzzyProjects(input: SearchFuzzyProjectsInput): Promise<FuzzyProjectSearchResponse> {
  const request = {
    ...input.request,
    raw_query: input.request.raw_query.trim(),
    sort: input.request.sort === "growth" ? "growth" : "score",
    lang: langFromRequest(input.request),
  } satisfies FuzzyProjectSearchRequest;
  const normalizedQuery = normalizeProjectSearchText(request.raw_query);
  const records = buildProjectSearchRecords(input.view.projects, request.lang ?? "zh");
  const direct = directProjectRecords(records, request);
  const useDirect = shouldUseDirectProjectSearch(records, request.raw_query, direct);

  if (useDirect) {
    return buildResponse({
      rawQuery: request.raw_query,
      normalizedQuery,
      source: "direct_search",
      resultMode: "projects",
      projectIds: projectIds(direct),
      diagnostics: buildDiagnostics({
        directResultCount: direct.length,
        llmTriggered: false,
        cacheStatus: "bypass",
        decision: "direct_passthrough",
        expandedResultCount: direct.length,
      }),
    });
  }

  if (!queryMeetsFuzzyTriggerThreshold(request.raw_query)) {
    const hot = hotProjectRecords(records, request);
    return buildResponse({
      rawQuery: request.raw_query,
      normalizedQuery,
      source: "hot_only",
      resultMode: "hot_projects",
      projectIds: projectIds(hot),
      diagnostics: buildDiagnostics({
        directResultCount: direct.length,
        llmTriggered: false,
        cacheStatus: "bypass",
        decision: "hot_only",
        expandedResultCount: hot.length,
      }),
    });
  }

  const regulated = regulatedKeywordInterpretation(request.raw_query, normalizedQuery);
  if (regulated) {
    return responseFromInterpretation(request, normalizedQuery, records, direct.length, regulated, "bypass");
  }

  const cacheKey = buildFuzzySearchCacheKey({
    date: request.date ?? input.view.context.selected_date ?? "latest",
    normalizedQuery,
    lang: request.lang ?? "zh",
    activeFilters: {
      filters: request.filters ?? {},
      sort: request.sort ?? "score",
    },
  });
  const cached = input.cache?.get(cacheKey);
  const interpretationResult =
    cached
      ? resultFromCacheEntry(cached)
      : await (input.interpreter ?? interpretFuzzyQuery)({
          llm: input.llm ?? DEFAULT_LLM_CONFIG,
          rawQuery: request.raw_query,
          searchFieldsSummary: buildSearchFieldsSummary(),
          directionAliasSummary: buildDirectionAliasSummary(),
          ...input.interpreterOptions,
        });
  if (!cached && !(interpretationResult.status === "fallback" && interpretationResult.fallbackReason === "llm_timeout")) {
    input.cache?.set(cacheKey, cacheEntryFromResult(interpretationResult));
  }

  if (interpretationResult.status === "fallback") {
    return responseFromFallback(request, normalizedQuery, records, direct.length, interpretationResult.fallbackReason, cached ? "hit" : "miss");
  }

  return responseFromInterpretation(request, normalizedQuery, records, direct.length, interpretationResult.interpretation, cached ? "hit" : "miss");
}

export function buildEndpointErrorFuzzyResponse(request: FuzzyProjectSearchRequest, view: ProjectsViewModel): FuzzyProjectSearchResponse {
  const normalizedQuery = normalizeProjectSearchText(request.raw_query);
  const records = buildProjectSearchRecords(view.projects, langFromRequest(request));
  return responseFromFallback(request, normalizedQuery, records, 0, "endpoint_error", "bypass");
}
