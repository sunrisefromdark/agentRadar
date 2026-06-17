import { buildDirectionAliasSummary, buildSearchFieldsSummary } from "./projectSearchIndex.ts";

export interface FuzzyQueryPromptInput {
  rawQuery: string;
  searchFieldsSummary?: string;
  directionAliasSummary?: string;
}

export interface FuzzyQueryRepairPromptInput extends FuzzyQueryPromptInput {
  validationError: string;
  previousResponse: string;
}

export function buildFuzzyQueryPrompt(input: FuzzyQueryPromptInput): string {
  return `
You are the query interpreter for an AI Agent project library.

The current project-library exact search has already run for the user's raw query and returned zero results.
Your job is to classify the query and produce a structured search plan for the local project index.

Hard rules:
1. Return exactly one JSON object. Do not use markdown fences. Do not add prose before or after JSON.
2. Do not invent projects, repositories, facts, scores, rankings, market data, medical/legal/security advice, or external search results.
3. You only interpret the user's query. The application will execute any expanded query against its local project index.
4. If the query is chaotic, joking, meaningless, or has no actionable retrieval intent, do not create expansion terms. Use semantic_class="low_semantic", decision="hot_only".
5. If the query is broad discovery and does not contain a concrete subject/domain noun, such as "最近有什么值得看" or "给我看新东西", do not create narrow expansion terms. Use semantic_class="open_discovery", decision="hot_only".
6. If the query contains a concrete subject/domain noun, even when it is wrapped in "今天关注什么", "最近有什么", or "有哪些", keep that subject and create expanded local-search queries. Example: "化学今天关注什么".
7. Sensitive or regulated domains override the general keyword rule. If the query mentions finance, stocks, investment, medical, diagnosis, treatment, legal, security, exploit, or similar high-risk domains, do not decide whether the user wants professional advice. Extract searchable domain/task/object keywords from the whole query, use semantic_class="regulated_keyword_search", decision="expand_query", and include a short boundary note.
8. For short Chinese finance or medical phrasing, still route to regulated_keyword_search. Examples include: "美股今天买什么", "今天买哪只股票", "给我诊断这个病", "要不要吃药", "律师怎么建议". Do not downgrade these to low_semantic or open_discovery just because they are short.
9. Existing direct-search hits are not your concern; direct search already returned zero. Do not recommend "exact search passthrough".
10. Prefer Chinese in user-facing explanations. Keep terms in their original language when useful.
11. Confidence must be between 0 and 1. If confidence is below 0.45 and expansion could mislead, choose semantic_class="ambiguous".
12. If semantic_class="ambiguous", return 2 or 3 clarification_options. Each option must contain a concrete query rewrite that the application can execute as a new search.
13. For expanded_queries.required_terms, include only core subject/domain/task constraints that must appear in a matching project. Do not use generic product-scope words such as "agent", "agents", "AI", "project", "tool", "assistant", "智能体", "项目", or "工具" as required_terms unless they are paired with a concrete qualifier in the same required term.

Product scope:
- The product is an AI Agent / intelligent software project radar.
- Results can only come from local project-library artifacts.
- In-scope examples: agent projects, AI workflows, coding agents, browser/computer-use agents, MCP/tools/connectors, memory/RAG systems, customer support agents, ecommerce/guide agents, finance research agents as software projects.
- Do not answer real stock picks, medical diagnosis or treatment, legal advice, cyber attack instructions, live prices, or news claims. If the query contains those words, extract searchable project-library keywords instead.

Available local-search fields:
${input.searchFieldsSummary ?? buildSearchFieldsSummary()}

Known direction aliases and examples:
${input.directionAliasSummary ?? buildDirectionAliasSummary()}

Return JSON schema:
{
  "schema_version": "project_fuzzy_query.v1",
  "raw_query": string,
  "semantic_class": "low_semantic" | "open_discovery" | "topic_keyword" | "task_use_case" | "attribute_filter" | "regulated_keyword_search" | "ambiguous",
  "decision": "hot_only" | "expand_query" | "needs_clarification",
  "result_mode": "projects" | "hot_projects" | "none",
  "confidence": number,
  "extracted_terms": [
    {
      "term": string,
      "normalized_term": string,
      "type": "domain" | "technology" | "task" | "attribute" | "company" | "project" | "object" | "other",
      "confidence": number,
      "reason_cn": string
    }
  ],
  "expanded_queries": [
    {
      "query": string,
      "required_terms": string[],
      "optional_terms": string[],
      "boost_terms": string[],
      "exclude_terms": string[],
      "target_fields": ["name" | "description" | "tags" | "direction" | "reason" | "metadata"],
      "why_cn": string
    }
  ],
  "filters": {
    "time_window": "latest" | "recent" | "this_week" | "unspecified",
    "risk_preference": "lower_risk" | "any" | "unspecified",
    "freshness_preference": "newer" | "persistent" | "any" | "unspecified",
    "sort_preference": "existing_rank" | "score" | "growth" | "unspecified"
  },
  "boundary": {
    "is_sensitive_domain": boolean,
    "sensitive_domain": "finance" | "medical" | "legal" | "security" | "other" | null,
    "reason_cn": string | null,
    "user_message_cn": string | null
  },
  "clarification_options": [
    {
      "label_cn": string,
      "query": string,
      "semantic_hint": "low_semantic" | "open_discovery" | "topic_keyword" | "task_use_case" | "attribute_filter" | "regulated_keyword_search",
      "why_cn": string
    }
  ],
  "explanation_cn": string,
  "fallback": {
    "if_expanded_search_empty": "show_hot_projects" | "show_no_match" | "ask_clarification",
    "preserve_original_query": boolean
  }
}

Now classify this query:
${input.rawQuery}
`.trim();
}

export function buildFuzzyQueryRepairPrompt(input: FuzzyQueryRepairPromptInput): string {
  return `
The previous response did not match the required JSON schema or routing rules.
Repair it from scratch. Do not preserve invalid fields.

Return exactly one JSON object and nothing else.
Do not use markdown fences.

Original user query:
${input.rawQuery}

Validation error:
${input.validationError}

Previous response:
${input.previousResponse}

Required routing rules:
- low_semantic/open_discovery => decision hot_only, result_mode hot_projects, expanded_queries empty.
- topic_keyword/task_use_case/attribute_filter/regulated_keyword_search => decision expand_query, result_mode projects, expanded_queries non-empty.
- regulated_keyword_search => boundary.is_sensitive_domain true, boundary.sensitive_domain non-null, boundary.user_message_cn non-empty.
- ambiguous => decision needs_clarification, result_mode none, expanded_queries empty, clarification_options length 2 or 3.
- Never invent projects or final results.

Required schema is project_fuzzy_query.v1.
`.trim();
}
