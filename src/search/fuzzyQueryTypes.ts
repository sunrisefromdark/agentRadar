import { normalizeProjectSearchText } from "./projectSearchKernel.ts";

export const FUZZY_QUERY_SCHEMA_VERSION = "project_fuzzy_query.v1";
export const FUZZY_SEARCH_RESPONSE_SCHEMA_VERSION = "project_fuzzy_search_response.v1";
export const FUZZY_SEARCH_MIN_CHINESE_CHARS = 2;
export const FUZZY_SEARCH_MIN_ENGLISH_CHARS = 3;
export const FUZZY_SEARCH_DEBOUNCE_MS = 600;
export const FUZZY_SEARCH_LLM_TIMEOUT_MS = 12000;
export const FUZZY_SEARCH_MAX_REPAIR_CALLS = 1;

export const FUZZY_SEARCH_SEMANTIC_CLASSES = [
  "low_semantic",
  "open_discovery",
  "topic_keyword",
  "task_use_case",
  "attribute_filter",
  "regulated_keyword_search",
  "ambiguous",
] as const;

export type FuzzySearchSemanticClass = (typeof FUZZY_SEARCH_SEMANTIC_CLASSES)[number];

export const FUZZY_SEARCH_DECISIONS = ["direct_passthrough", "hot_only", "expand_query", "needs_clarification"] as const;
export type FuzzySearchDecision = (typeof FUZZY_SEARCH_DECISIONS)[number];

export const FUZZY_SEARCH_RESULT_MODES = ["projects", "hot_projects", "none"] as const;
export type FuzzySearchResultMode = (typeof FUZZY_SEARCH_RESULT_MODES)[number];

export const FUZZY_SEARCH_SOURCES = [
  "direct_search",
  "llm_expanded",
  "regulated_keyword_search",
  "hot_only",
  "needs_clarification",
  "llm_failed_fallback",
] as const;
export type FuzzySearchSource = (typeof FUZZY_SEARCH_SOURCES)[number];

export const FUZZY_SEARCH_FALLBACK_REASONS = [
  "llm_unconfigured",
  "llm_timeout",
  "invalid_json",
  "schema_invalid",
  "expanded_empty",
  "endpoint_error",
] as const;
export type FuzzySearchFallbackReason = (typeof FUZZY_SEARCH_FALLBACK_REASONS)[number];

export type ExtractedQueryTermType = "domain" | "technology" | "task" | "attribute" | "company" | "project" | "object" | "other";
export type ExpandedProjectQueryTargetField = "name" | "description" | "tags" | "direction" | "reason" | "metadata";
export type FuzzySensitiveDomain = "finance" | "medical" | "legal" | "security" | "other";
export type FuzzySearchCacheStatus = "hit" | "miss" | "bypass";

export interface ExtractedQueryTerm {
  term: string;
  normalized_term: string;
  type: ExtractedQueryTermType;
  confidence: number;
  reason_cn: string;
}

export interface ExpandedProjectQuery {
  query: string;
  required_terms: string[];
  optional_terms: string[];
  boost_terms: string[];
  exclude_terms: string[];
  target_fields: ExpandedProjectQueryTargetField[];
  why_cn: string;
}

export interface FuzzySearchFilters {
  time_window: "latest" | "recent" | "this_week" | "unspecified";
  risk_preference: "lower_risk" | "any" | "unspecified";
  freshness_preference: "newer" | "persistent" | "any" | "unspecified";
  sort_preference: "existing_rank" | "score" | "growth" | "unspecified";
}

export interface FuzzySearchBoundary {
  is_sensitive_domain: boolean;
  sensitive_domain?: FuzzySensitiveDomain | null;
  reason_cn?: string | null;
  user_message_cn?: string | null;
}

export interface FuzzySearchClarificationOption {
  label_cn: string;
  query: string;
  semantic_hint: Exclude<FuzzySearchSemanticClass, "ambiguous">;
  why_cn: string;
}

export interface LlmFuzzyQueryInterpretation {
  schema_version: typeof FUZZY_QUERY_SCHEMA_VERSION;
  raw_query: string;
  semantic_class: FuzzySearchSemanticClass;
  decision: Exclude<FuzzySearchDecision, "direct_passthrough">;
  result_mode: FuzzySearchResultMode;
  confidence: number;
  extracted_terms: ExtractedQueryTerm[];
  expanded_queries: ExpandedProjectQuery[];
  filters: FuzzySearchFilters;
  boundary: FuzzySearchBoundary;
  clarification_options: FuzzySearchClarificationOption[];
  explanation_cn: string;
  fallback: {
    if_expanded_search_empty: "show_hot_projects" | "show_no_match" | "ask_clarification";
    preserve_original_query: boolean;
  };
}

export interface FuzzyProjectSearchDiagnostics {
  direct_result_count: number;
  llm_triggered: boolean;
  cache_status: FuzzySearchCacheStatus;
  interpretation_schema_version?: typeof FUZZY_QUERY_SCHEMA_VERSION;
  semantic_class?: FuzzySearchSemanticClass;
  decision: FuzzySearchDecision;
  expanded_query_count: number;
  expanded_result_count: number;
  unsupported_filters: string[];
  fallback_reason?: FuzzySearchFallbackReason;
}

export interface FuzzyProjectSearchResponse {
  schema_version: typeof FUZZY_SEARCH_RESPONSE_SCHEMA_VERSION;
  raw_query: string;
  normalized_query: string;
  source: FuzzySearchSource;
  result_mode: FuzzySearchResultMode;
  project_ids: string[];
  explanation_cn?: string;
  boundary_message_cn?: string;
  clarification_options: FuzzySearchClarificationOption[];
  diagnostics: FuzzyProjectSearchDiagnostics;
}

export interface FuzzyProjectSearchRequest {
  raw_query: string;
  date?: string;
  lang?: "zh" | "en";
  filters?: {
    paradigm?: string;
    persistence?: string;
  };
  sort?: "score" | "growth";
  page_context?: {
    page?: number;
    page_size?: number;
    path?: string;
  };
}

export interface FuzzySearchCacheKeyInput {
  date: string;
  normalizedQuery: string;
  lang: "zh" | "en";
  activeFilters: unknown;
  schemaVersion?: typeof FUZZY_QUERY_SCHEMA_VERSION;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, candidates: T): value is T[number] {
  return typeof value === "string" && (candidates as readonly string[]).includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateExtractedTerm(value: unknown, index: number): ValidationResult<ExtractedQueryTerm> {
  if (!isRecord(value)) return { ok: false, error: `extracted_terms[${index}] must be an object` };
  if (!hasText(value.term)) return { ok: false, error: `extracted_terms[${index}].term must be non-empty` };
  if (!hasText(value.normalized_term)) return { ok: false, error: `extracted_terms[${index}].normalized_term must be non-empty` };
  if (!isOneOf(value.type, ["domain", "technology", "task", "attribute", "company", "project", "object", "other"] as const)) {
    return { ok: false, error: `extracted_terms[${index}].type is invalid` };
  }
  if (!isConfidence(value.confidence)) return { ok: false, error: `extracted_terms[${index}].confidence must be between 0 and 1` };
  if (!hasText(value.reason_cn)) return { ok: false, error: `extracted_terms[${index}].reason_cn must be non-empty` };
  return { ok: true, value: value as unknown as ExtractedQueryTerm };
}

function validateExpandedQuery(value: unknown, index: number): ValidationResult<ExpandedProjectQuery> {
  if (!isRecord(value)) return { ok: false, error: `expanded_queries[${index}] must be an object` };
  if (!hasText(value.query)) return { ok: false, error: `expanded_queries[${index}].query must be non-empty` };
  for (const key of ["required_terms", "optional_terms", "boost_terms", "exclude_terms"] as const) {
    if (!isStringArray(value[key])) return { ok: false, error: `expanded_queries[${index}].${key} must be string[]` };
  }
  if (!Array.isArray(value.target_fields)) return { ok: false, error: `expanded_queries[${index}].target_fields must be an array` };
  for (const field of value.target_fields) {
    if (!isOneOf(field, ["name", "description", "tags", "direction", "reason", "metadata"] as const)) {
      return { ok: false, error: `expanded_queries[${index}].target_fields contains invalid value` };
    }
  }
  if (!hasText(value.why_cn)) return { ok: false, error: `expanded_queries[${index}].why_cn must be non-empty` };
  return { ok: true, value: value as unknown as ExpandedProjectQuery };
}

function validateFilters(value: unknown): ValidationResult<FuzzySearchFilters> {
  if (!isRecord(value)) return { ok: false, error: "filters must be an object" };
  if (!isOneOf(value.time_window, ["latest", "recent", "this_week", "unspecified"] as const)) return { ok: false, error: "filters.time_window is invalid" };
  if (!isOneOf(value.risk_preference, ["lower_risk", "any", "unspecified"] as const)) return { ok: false, error: "filters.risk_preference is invalid" };
  if (!isOneOf(value.freshness_preference, ["newer", "persistent", "any", "unspecified"] as const)) return { ok: false, error: "filters.freshness_preference is invalid" };
  if (!isOneOf(value.sort_preference, ["existing_rank", "score", "growth", "unspecified"] as const)) return { ok: false, error: "filters.sort_preference is invalid" };
  return { ok: true, value: value as unknown as FuzzySearchFilters };
}

function validateBoundary(value: unknown): ValidationResult<FuzzySearchBoundary> {
  if (!isRecord(value)) return { ok: false, error: "boundary must be an object" };
  if (typeof value.is_sensitive_domain !== "boolean") return { ok: false, error: "boundary.is_sensitive_domain must be boolean" };
  if (
    value.sensitive_domain !== undefined &&
    value.sensitive_domain !== null &&
    !isOneOf(value.sensitive_domain, ["finance", "medical", "legal", "security", "other"] as const)
  ) {
    return { ok: false, error: "boundary.sensitive_domain is invalid" };
  }
  if (value.reason_cn !== undefined && value.reason_cn !== null && typeof value.reason_cn !== "string") return { ok: false, error: "boundary.reason_cn must be string or null" };
  if (value.user_message_cn !== undefined && value.user_message_cn !== null && typeof value.user_message_cn !== "string") {
    return { ok: false, error: "boundary.user_message_cn must be string or null" };
  }
  return { ok: true, value: value as unknown as FuzzySearchBoundary };
}

function validateClarificationOption(value: unknown, index: number): ValidationResult<FuzzySearchClarificationOption> {
  if (!isRecord(value)) return { ok: false, error: `clarification_options[${index}] must be an object` };
  if (!hasText(value.label_cn)) return { ok: false, error: `clarification_options[${index}].label_cn must be non-empty` };
  if (!hasText(value.query)) return { ok: false, error: `clarification_options[${index}].query must be non-empty` };
  if (
    !isOneOf(value.semantic_hint, [
      "low_semantic",
      "open_discovery",
      "topic_keyword",
      "task_use_case",
      "attribute_filter",
      "regulated_keyword_search",
    ] as const)
  ) {
    return { ok: false, error: `clarification_options[${index}].semantic_hint is invalid` };
  }
  if (!hasText(value.why_cn)) return { ok: false, error: `clarification_options[${index}].why_cn must be non-empty` };
  return { ok: true, value: value as unknown as FuzzySearchClarificationOption };
}

export function validateLlmFuzzyQueryInterpretation(value: unknown): ValidationResult<LlmFuzzyQueryInterpretation> {
  if (!isRecord(value)) return { ok: false, error: "interpretation must be an object" };
  if (value.schema_version !== FUZZY_QUERY_SCHEMA_VERSION) return { ok: false, error: "schema_version is invalid" };
  if (!hasText(value.raw_query)) return { ok: false, error: "raw_query must be non-empty" };
  if (!isOneOf(value.semantic_class, FUZZY_SEARCH_SEMANTIC_CLASSES)) return { ok: false, error: "semantic_class is invalid" };
  if (!isOneOf(value.decision, ["hot_only", "expand_query", "needs_clarification"] as const)) return { ok: false, error: "decision is invalid" };
  if (!isOneOf(value.result_mode, FUZZY_SEARCH_RESULT_MODES)) return { ok: false, error: "result_mode is invalid" };
  if (!isConfidence(value.confidence)) return { ok: false, error: "confidence must be between 0 and 1" };
  if (!Array.isArray(value.extracted_terms)) return { ok: false, error: "extracted_terms must be an array" };
  if (!Array.isArray(value.expanded_queries)) return { ok: false, error: "expanded_queries must be an array" };
  if (!Array.isArray(value.clarification_options)) return { ok: false, error: "clarification_options must be an array" };

  for (let index = 0; index < value.extracted_terms.length; index += 1) {
    const result = validateExtractedTerm(value.extracted_terms[index], index);
    if (!result.ok) return result;
  }
  for (let index = 0; index < value.expanded_queries.length; index += 1) {
    const result = validateExpandedQuery(value.expanded_queries[index], index);
    if (!result.ok) return result;
  }
  const filters = validateFilters(value.filters);
  if (!filters.ok) return filters;
  const boundary = validateBoundary(value.boundary);
  if (!boundary.ok) return boundary;
  for (let index = 0; index < value.clarification_options.length; index += 1) {
    const result = validateClarificationOption(value.clarification_options[index], index);
    if (!result.ok) return result;
  }
  if (!hasText(value.explanation_cn)) return { ok: false, error: "explanation_cn must be non-empty" };
  if (!isRecord(value.fallback)) return { ok: false, error: "fallback must be an object" };
  if (!isOneOf(value.fallback.if_expanded_search_empty, ["show_hot_projects", "show_no_match", "ask_clarification"] as const)) {
    return { ok: false, error: "fallback.if_expanded_search_empty is invalid" };
  }
  if (typeof value.fallback.preserve_original_query !== "boolean") return { ok: false, error: "fallback.preserve_original_query must be boolean" };

  const interpretation = value as unknown as LlmFuzzyQueryInterpretation;
  return validateInterpretationSemantics(interpretation);
}

export function validateInterpretationSemantics(interpretation: LlmFuzzyQueryInterpretation): ValidationResult<LlmFuzzyQueryInterpretation> {
  switch (interpretation.semantic_class) {
    case "low_semantic":
      if (interpretation.decision !== "hot_only" || interpretation.result_mode !== "hot_projects") {
        return { ok: false, error: "low_semantic must use hot_only/hot_projects" };
      }
      if (interpretation.expanded_queries.length !== 0) return { ok: false, error: "low_semantic must not include expanded_queries" };
      if (interpretation.clarification_options.length !== 0) return { ok: false, error: "low_semantic must not include clarification_options" };
      if (!interpretation.fallback.preserve_original_query) return { ok: false, error: "low_semantic must preserve original query" };
      return { ok: true, value: interpretation };
    case "open_discovery":
      if (interpretation.decision !== "hot_only" || interpretation.result_mode !== "hot_projects") {
        return { ok: false, error: "open_discovery must use hot_only/hot_projects" };
      }
      if (interpretation.expanded_queries.length !== 0) return { ok: false, error: "open_discovery must not include expanded_queries" };
      if (interpretation.clarification_options.length !== 0) return { ok: false, error: "open_discovery must not include clarification_options" };
      return { ok: true, value: interpretation };
    case "topic_keyword":
    case "task_use_case":
    case "attribute_filter":
    case "regulated_keyword_search":
      if (interpretation.decision !== "expand_query" || interpretation.result_mode !== "projects") {
        return { ok: false, error: `${interpretation.semantic_class} must use expand_query/projects` };
      }
      if (interpretation.expanded_queries.length < 1) return { ok: false, error: `${interpretation.semantic_class} must include expanded_queries` };
      if (interpretation.clarification_options.length !== 0) return { ok: false, error: `${interpretation.semantic_class} must not include clarification_options` };
      if (interpretation.semantic_class === "regulated_keyword_search") {
        if (!interpretation.boundary.is_sensitive_domain) return { ok: false, error: "regulated_keyword_search must set boundary.is_sensitive_domain" };
        if (!interpretation.boundary.sensitive_domain) return { ok: false, error: "regulated_keyword_search must set boundary.sensitive_domain" };
        if (!hasText(interpretation.boundary.user_message_cn)) return { ok: false, error: "regulated_keyword_search must set boundary.user_message_cn" };
      }
      return { ok: true, value: interpretation };
    case "ambiguous":
      if (interpretation.decision !== "needs_clarification" || interpretation.result_mode !== "none") {
        return { ok: false, error: "ambiguous must use needs_clarification/none" };
      }
      if (interpretation.expanded_queries.length !== 0) return { ok: false, error: "ambiguous must not include expanded_queries" };
      if (interpretation.clarification_options.length < 2 || interpretation.clarification_options.length > 3) {
        return { ok: false, error: "ambiguous must include 2-3 clarification_options" };
      }
      return { ok: true, value: interpretation };
  }
}

export function queryMeetsFuzzyTriggerThreshold(rawQuery: string): boolean {
  const normalized = normalizeProjectSearchText(rawQuery);
  if (!normalized) return false;
  const cjkCount = Array.from(normalized).filter((char) => /[\u3400-\u9fff]/u.test(char)).length;
  if (cjkCount > 0) return cjkCount >= FUZZY_SEARCH_MIN_CHINESE_CHARS;
  return normalized.replace(/\s+/g, "").length >= FUZZY_SEARCH_MIN_ENGLISH_CHARS;
}

export function buildFuzzySearchCacheKey(input: FuzzySearchCacheKeyInput): string {
  return JSON.stringify({
    date: input.date,
    normalized_query: input.normalizedQuery,
    lang: input.lang,
    active_filters: input.activeFilters,
    fuzzy_schema_version: input.schemaVersion ?? FUZZY_QUERY_SCHEMA_VERSION,
  });
}
