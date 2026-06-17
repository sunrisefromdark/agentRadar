# 设计文档：自然语言模糊搜索与 LLM 查询扩展

## 文档状态

- 版本：`v0.2-zero-result-llm-routing`
- 状态：`Approved`
- 批准备注：`2026-06-16 design review 收口；需求文档已处于 READY，且本文已冻结 direct gate、zero-result LLM routing、敏感领域关键词搜索、LLM 输出契约、服务响应契约、澄清选项、缓存/审计、降级与测试口径，可直接进入 ExecPlan。`
- 设计输入：
  - [自然语言模糊搜索与推荐需求分析.md](../product-specs/自然语言模糊搜索与推荐需求分析.md#L1)
  - [project-search-system-redesign-design.md](project-search-system-redesign-design.md#L1)
  - [architecture-boundaries.md](architecture-boundaries.md#L1)
  - [llm-classification.md](../services/llm-classification.md#L1)
- 目标：把项目库搜索设计为 `原始搜索优先；零结果再触发 LLM；LLM 只产出查询解释和扩展计划；最终结果仍由项目库索引检索`。
- 取代口径：本设计废弃上一版 `rules-first, llm-optional` 的意图词典主导方案，不再要求用代码预置敏感条件决定是否触发 LLM。

## 一句话设计

先让当前项目库搜索按原逻辑跑完；只要有结果，就结束。只有原始查询没有任何结果时，才把查询交给 LLM，让它判断这句话是无意义、泛探索、关键词/任务/属性型查询、敏感领域关键词查询还是歧义请求，再由系统执行对应的项目库检索或热门回退。

## 设计 Thesis

这次不是“让搜索框更会联想”，而是把搜索失败后的第二步变成一个受控的 LLM 查询解释器。

核心边界有四条：

1. `direct search gate` 是最高优先级：当前项目库能搜到，就不问 LLM。
2. LLM 负责常识语义分类和查询扩展建议，不负责生成项目答案。
3. 敏感领域交给 LLM 从整句抽取关键词，但不判断用户是否在请求站外建议；系统只把关键词用于站内项目库搜索。
4. 无意义查询和泛探索查询不要硬扩展，只展示热门项目或默认项目流。

## 当前实现基线

当前项目库搜索主要由以下代码提供：

- `app/visualConsole/clientScript.ts`
  - `rankProjectSearchMatch`
  - `filterAndSortProjectCards`
  - `paginateProjectCards`
- `app/visualConsole/ossProjectsPage.ts`
  - `projectSearchText`
  - `companySearchAliases`
  - `directionSearchAliases`
  - `data-project-search`
- `src/__tests__/visualConsoleSearchAlignment.test.ts`
  - 守护公司别名、方向别名、repo、tags、raw signal 等字段能被搜索命中。

本设计必须保留这些已有行为。新增能力应抽出同等口径的 shared search kernel，而不是让前端 direct gate 和后端 LLM 扩展检索各跑一套不一致逻辑。

## 查询状态机

```text
User Query
  -> Normalize Query
  -> Run Existing Project Search
  -> Has Results?
      -> yes: Direct Results, no LLM
      -> no:
          -> Build LLM Interpretation Request
          -> Validate LLM JSON
          -> Route by semantic_class
          -> Execute Expanded Search or Hot Fallback or Clarification
          -> Render Results from Project Index Only
```

### 1. Normalize Query

标准化只做低风险处理：

- trim
- 大小写统一
- 空格折叠
- 全角/半角等价处理
- 保留中英文原词

禁止在该阶段做语义改写、敏感词判断或同义词扩展。

### 2. Direct Search Gate

Direct gate 必须调用与项目库 UI 一致的搜索函数。

输入：

- 原始查询
- 当前项目集合
- 当前筛选条件
- 当前排序方式

输出：

- `direct_result_count`
- `direct_results`

规则：

- `direct_result_count > 0`：直接展示结果，不触发 LLM。
- `direct_result_count === 0`：进入 LLM 语义路由。

### 3. LLM Interpretation

LLM 只接收必要上下文：

- 原始查询
- 当前项目库的可搜索字段摘要
- 当前可用方向名和方向中文别名摘要
- 当前结果范围说明
- direct gate 已确认 `direct_result_count=0`

LLM 不接收完整项目详情列表，不输出最终项目列表。

### 4. Route by Semantic Class

LLM 主分类固定为以下 7 类：

| semantic_class | 含义 | 结果策略 |
| --- | --- | --- |
| `low_semantic` | 混乱、玩笑、无实际检索意图 | 保留原查询，展示热门项目；不扩展 |
| `open_discovery` | 泛探索，例如“最近有什么值得看” | 展示热门项目或默认项目流；可附简短解释 |
| `topic_keyword` | 有明确领域、技术、公司、项目名词 | 执行扩展查询 |
| `task_use_case` | 描述任务/场景，例如客服工单、导购、数据分析 | 执行扩展查询 |
| `attribute_filter` | 带风险、热度、持续性、新鲜度等属性 | 执行扩展查询 + 可执行过滤 |
| `regulated_keyword_search` | 涉及股票、医疗、法律、金融、安全等敏感领域 | 执行关键词扩展查询 + 展示项目搜索边界提示 |
| `ambiguous` | 多个解释冲突，扩展可能误导 | 展示澄清选项，不直接执行搜索 |

## 输出契约

```ts
type FuzzySearchSemanticClass =
  | "low_semantic"
  | "open_discovery"
  | "topic_keyword"
  | "task_use_case"
  | "attribute_filter"
  | "regulated_keyword_search"
  | "ambiguous";

type FuzzySearchDecision =
  | "direct_passthrough"
  | "hot_only"
  | "expand_query"
  | "needs_clarification";

type FuzzySearchResultMode = "projects" | "hot_projects" | "none";

interface ExtractedQueryTerm {
  term: string;
  normalized_term: string;
  type: "domain" | "technology" | "task" | "attribute" | "company" | "project" | "object" | "other";
  confidence: number;
  reason_cn: string;
}

interface ExpandedProjectQuery {
  query: string;
  required_terms: string[];
  optional_terms: string[];
  boost_terms: string[];
  exclude_terms: string[];
  target_fields: Array<"name" | "description" | "tags" | "direction" | "reason" | "metadata">;
  why_cn: string;
}

interface FuzzySearchFilters {
  time_window: "latest" | "recent" | "this_week" | "unspecified";
  risk_preference: "lower_risk" | "any" | "unspecified";
  freshness_preference: "newer" | "persistent" | "any" | "unspecified";
  sort_preference: "existing_rank" | "score" | "growth" | "unspecified";
}

interface FuzzySearchBoundary {
  is_sensitive_domain: boolean;
  sensitive_domain?: "finance" | "medical" | "legal" | "security" | "other";
  reason_cn?: string;
  user_message_cn?: string;
}

interface FuzzySearchClarificationOption {
  label_cn: string;
  query: string;
  semantic_hint: Exclude<FuzzySearchSemanticClass, "ambiguous">;
  why_cn: string;
}

interface LlmFuzzyQueryInterpretation {
  schema_version: "project_fuzzy_query.v1";
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
```

服务端返回给前端的响应契约固定为：

```ts
type FuzzySearchSource =
  | "direct_search"
  | "llm_expanded"
  | "regulated_keyword_search"
  | "hot_only"
  | "needs_clarification"
  | "llm_failed_fallback";

interface FuzzyProjectSearchDiagnostics {
  direct_result_count: number;
  llm_triggered: boolean;
  cache_status: "hit" | "miss" | "bypass";
  interpretation_schema_version?: "project_fuzzy_query.v1";
  semantic_class?: FuzzySearchSemanticClass;
  decision: FuzzySearchDecision;
  expanded_query_count: number;
  expanded_result_count: number;
  unsupported_filters: string[];
  fallback_reason?: "llm_unconfigured" | "llm_timeout" | "invalid_json" | "schema_invalid" | "expanded_empty" | "endpoint_error";
}

interface FuzzyProjectSearchResponse {
  schema_version: "project_fuzzy_search_response.v1";
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
```

响应规则：

- `direct_search` 响应必须满足 `llm_triggered=false`，不返回 `explanation_cn`，只返回当前 direct result 的 `project_ids`。
- `llm_expanded` 响应必须只返回本地项目库检索得到的 `project_ids`，不得返回 LLM 生成的项目名。
- `regulated_keyword_search` 响应必须满足 `diagnostics.semantic_class="regulated_keyword_search"`，只返回本地项目库检索得到的 `project_ids`，并返回 `boundary_message_cn`，说明结果只是项目搜索结果，不提供真实专业建议。
- `hot_only` / `llm_failed_fallback` 响应返回当前默认热门项目流的 `project_ids`，并保留原始查询。
- `needs_clarification` 响应必须返回空 `project_ids`，并返回 2-3 个 `clarification_options`；这些选项必须是可重新执行的查询改写，不是自由文本追问。
- `diagnostics` 是验收和审计契约的一部分；实现不得只把它写入临时 console log。

### 合法性规则

- `low_semantic` 必须满足：
  - `decision="hot_only"`
  - `result_mode="hot_projects"`
  - `expanded_queries=[]`
  - `clarification_options=[]`
  - `fallback.preserve_original_query=true`
- `open_discovery` 必须满足：
  - `decision="hot_only"`
  - `result_mode="hot_projects"`
  - `expanded_queries=[]`
  - `clarification_options=[]`
- `topic_keyword`、`task_use_case`、`attribute_filter`、`regulated_keyword_search` 必须满足：
  - `decision="expand_query"`
  - `expanded_queries.length >= 1`
  - `clarification_options=[]`
- `regulated_keyword_search` 还必须满足：
  - `boundary.is_sensitive_domain=true`
  - `boundary.sensitive_domain` 不为空
  - `boundary.user_message_cn` 不为空，且必须说明“仅按站内 AI Agent 项目检索，不提供真实专业建议”
- `ambiguous` 必须满足：
  - `decision="needs_clarification"`
  - `result_mode="none"`
  - `expanded_queries=[]`
  - `clarification_options.length` 为 `2` 或 `3`
  - 每个 `clarification_options[].query` 必须能作为新查询重新走 direct search gate。

## LLM Prompt

### 主 Prompt

```text
You are the query interpreter for an AI Agent project library.

The current project-library exact search has already run for the user's raw query and returned zero results.
Your job is to classify the query and produce a structured search plan for the local project index.

Hard rules:
1. Return exactly one JSON object. Do not use markdown fences. Do not add prose before or after JSON.
2. Do not invent projects, repositories, facts, scores, rankings, market data, medical/legal/security advice, or external search results.
3. You only interpret the user's query. The application will execute any expanded query against its local project index.
4. If the query is chaotic, joking, meaningless, or has no actionable retrieval intent, do not create expansion terms. Use semantic_class="low_semantic", decision="hot_only".
5. If the query is broad discovery such as "最近有什么值得看" or "给我看新东西", do not create narrow expansion terms. Use semantic_class="open_discovery", decision="hot_only".
6. If the query contains meaningful nouns, tasks, domains, technologies, companies, or attributes, extract them and create expanded local-search queries.
7. Sensitive or regulated domains override the general keyword rule. If the query mentions finance, stocks, investment, medical, diagnosis, treatment, legal, security, exploit, or similar high-risk domains, do not decide whether the user wants professional advice. Extract searchable domain/task/object keywords from the whole query, use semantic_class="regulated_keyword_search", decision="expand_query", and include a short boundary note.
8. Existing direct-search hits are not your concern; direct search already returned zero. Do not recommend "exact search passthrough".
9. Prefer Chinese in user-facing explanations. Keep terms in their original language when useful.
10. Confidence must be between 0 and 1. If confidence is below 0.45 and expansion could mislead, choose semantic_class="ambiguous".
11. If semantic_class="ambiguous", return 2 or 3 clarification_options. Each option must contain a concrete query rewrite that the application can execute as a new search.

Product scope:
- The product is an AI Agent / intelligent software project radar.
- Results can only come from local project-library artifacts.
- In-scope examples: agent projects, AI workflows, coding agents, browser/computer-use agents, MCP/tools/connectors, memory/RAG systems, customer support agents, ecommerce/guide agents, finance research agents as software projects.
- Do not answer real stock picks, medical diagnosis or treatment, legal advice, cyber attack instructions, live prices, or news claims. If the query contains those words, extract searchable project-library keywords instead.

Available local-search fields:
{{search_fields_summary}}

Known direction aliases and examples:
{{direction_alias_summary}}

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

Examples:

User query: "这怎么哈哈了"
Expected:
{
  "schema_version": "project_fuzzy_query.v1",
  "raw_query": "这怎么哈哈了",
  "semantic_class": "low_semantic",
  "decision": "hot_only",
  "result_mode": "hot_projects",
  "confidence": 0.82,
  "extracted_terms": [],
  "expanded_queries": [],
  "filters": {
    "time_window": "unspecified",
    "risk_preference": "unspecified",
    "freshness_preference": "unspecified",
    "sort_preference": "existing_rank"
  },
  "boundary": {
    "is_sensitive_domain": false,
    "sensitive_domain": null,
    "reason_cn": null,
    "user_message_cn": null
  },
  "clarification_options": [],
  "explanation_cn": "这句话没有明确项目、方向或任务检索意图，保留原查询并展示当前热门项目。",
  "fallback": {
    "if_expanded_search_empty": "show_hot_projects",
    "preserve_original_query": true
  }
}

User query: "股票研究 agent"
Expected:
{
  "schema_version": "project_fuzzy_query.v1",
  "raw_query": "股票研究 agent",
  "semantic_class": "regulated_keyword_search",
  "decision": "expand_query",
  "result_mode": "projects",
  "confidence": 0.84,
  "extracted_terms": [
    { "term": "股票研究", "normalized_term": "finance investment research", "type": "domain", "confidence": 0.86, "reason_cn": "用户在寻找金融/股票研究方向的 agent 项目" },
    { "term": "agent", "normalized_term": "agent", "type": "object", "confidence": 0.95, "reason_cn": "限定为 AI Agent 项目或工具" }
  ],
  "expanded_queries": [
    {
      "query": "finance investment research agent stock trading quant",
      "required_terms": ["agent"],
      "optional_terms": ["finance", "investment", "research", "stock", "trading", "quant", "股票", "投研", "金融", "量化"],
      "boost_terms": ["finance-investment-research-agent"],
      "exclude_terms": [],
      "target_fields": ["description", "tags", "direction", "metadata"],
      "why_cn": "把“股票研究”扩展为站内金融投研 agent 方向词。"
    }
  ],
  "filters": {
    "time_window": "latest",
    "risk_preference": "unspecified",
    "freshness_preference": "any",
    "sort_preference": "existing_rank"
  },
  "boundary": {
    "is_sensitive_domain": true,
    "sensitive_domain": "finance",
    "reason_cn": "这是站内金融投研 agent 项目搜索，不是股票投资建议。",
    "user_message_cn": "仅按 AI Agent 项目方向检索，不提供真实股票买卖建议。"
  },
  "clarification_options": [],
  "explanation_cn": "已按“金融/股票研究方向的 AI Agent 项目”理解，并扩展到金融、投研、量化、交易等站内方向词。",
  "fallback": {
    "if_expanded_search_empty": "show_hot_projects",
    "preserve_original_query": true
  }
}

User query: "美股今天买什么"
Expected:
{
  "schema_version": "project_fuzzy_query.v1",
  "raw_query": "美股今天买什么",
  "semantic_class": "regulated_keyword_search",
  "decision": "expand_query",
  "result_mode": "projects",
  "confidence": 0.9,
  "extracted_terms": [
    { "term": "美股", "normalized_term": "us stocks finance investment research", "type": "domain", "confidence": 0.95, "reason_cn": "可转为金融/股票研究方向项目关键词" },
    { "term": "买什么", "normalized_term": "investment decision support research", "type": "task", "confidence": 0.78, "reason_cn": "可转为投研、决策辅助、研究助手等站内项目关键词" }
  ],
  "expanded_queries": [
    {
      "query": "finance investment research stock market analysis agent decision support",
      "required_terms": [],
      "optional_terms": ["finance", "investment", "research", "stock", "market", "analysis", "agent", "金融", "投研", "股票", "美股"],
      "boost_terms": ["finance-investment-research-agent"],
      "exclude_terms": [],
      "target_fields": ["description", "tags", "direction", "metadata"],
      "why_cn": "按金融/股票研究和投资决策辅助方向检索站内 AI Agent 项目。"
    }
  ],
  "filters": {
    "time_window": "unspecified",
    "risk_preference": "unspecified",
    "freshness_preference": "unspecified",
    "sort_preference": "unspecified"
  },
  "boundary": {
    "is_sensitive_domain": true,
    "sensitive_domain": "finance",
    "reason_cn": "这是敏感金融领域关键词搜索，只用于检索站内 AI Agent 项目。",
    "user_message_cn": "仅按站内金融/投研 Agent 项目检索，不提供真实股票买卖建议。"
  },
  "clarification_options": [],
  "explanation_cn": "已按金融、股票研究、投研和决策辅助等关键词检索站内 AI Agent 项目。",
  "fallback": {
    "if_expanded_search_empty": "show_hot_projects",
    "preserve_original_query": true
  }
}

Now classify this query:
{{raw_query}}
```

### 修复 Prompt

当 LLM 返回非法 JSON、缺字段、枚举越界或违反合法性规则时，允许最多一次修复调用。

```text
The previous response did not match the required JSON schema or routing rules.
Repair it from scratch. Do not preserve invalid fields.

Return exactly one JSON object and nothing else.
Do not use markdown fences.

Original user query:
{{raw_query}}

Validation error:
{{validation_error}}

Previous response:
{{previous_response}}

Required routing rules:
- low_semantic/open_discovery => decision hot_only, result_mode hot_projects, expanded_queries empty.
- topic_keyword/task_use_case/attribute_filter/regulated_keyword_search => decision expand_query, result_mode projects, expanded_queries non-empty.
- regulated_keyword_search => boundary.is_sensitive_domain true, boundary.sensitive_domain non-null, boundary.user_message_cn non-empty.
- ambiguous => decision needs_clarification, result_mode none, expanded_queries empty, clarification_options length 2 or 3.
- Never invent projects or final results.

Required schema is project_fuzzy_query.v1.
```

## 服务与模块设计

建议新增模块：

- `src/search/projectSearchKernel.ts`
  - 抽出 `normalizeProjectSearchText`、tokenize、rank、filter/sort 的共享实现。
  - 前端和后端必须消费同一逻辑，避免 direct gate 漂移。
- `src/search/projectSearchIndex.ts`
  - 从 `ProjectsViewModel` 或 daily artifact 投影项目搜索索引。
- `src/search/fuzzyQueryTypes.ts`
  - 冻结 LLM 输出契约和路由枚举。
- `src/search/fuzzyQueryPrompt.ts`
  - 维护主 prompt、修复 prompt、上下文压缩函数。
- `src/search/fuzzyQueryInterpreter.ts`
  - 调用 LLM、解析 JSON、校验 schema、执行一次修复。
- `src/search/fuzzyProjectSearchService.ts`
  - 编排 direct gate、LLM 路由、扩展检索、热门回退与诊断。

前端集成建议：

- `app/visualConsole/clientScript.ts`
  - 保留本地 direct search。
  - 当本地 direct result 为 0 且输入稳定后，请求服务端 fuzzy endpoint。
  - 服务返回扩展后的项目 id/order 或 hot-only 指令。
- `app/server.ts`
  - 新增只读 endpoint，例如 `POST /api/projects/fuzzy-search`。
  - endpoint 只读取当前 date 的项目库数据，不写入 artifact。

## 触发与缓存

### 触发条件

必须同时满足：

- 查询非空。
- 当前 direct search 结果数为 0。
- 查询长度达到最小阈值：中文不少于 2 个字符，英文不少于 3 个字符。
- 用户停止输入超过 debounce 时间，或用户按 Enter。

V1 默认：

- debounce：`600ms`
- 单查询超时：`5000ms`
- 修复调用：最多 `1` 次

### 缓存键

```text
date + normalized_query + lang + active_filters + fuzzy_schema_version
```

缓存内容：

- LLM 原始输出
- 校验后的 interpretation
- 扩展查询列表
- 最终执行策略
- 结果命中数
- 失败原因

缓存只用于查询解释，不缓存不存在于项目库的最终项目事实。

## 结果投影策略

### `expand_query`

1. 对每个 `expanded_queries[].query` 执行项目库搜索。
2. 合并结果并去重。
3. 默认保留扩展查询合并后的相关性顺序；仅当 `sort_preference` 明确为 `score` 或 `growth` 时再按现有分数/增长排序。
4. 如果 `boost_terms` 命中，可只作为同分排序微调或解释，不得新建 LLM 分数。
5. 如果结果为空，按 `fallback.if_expanded_search_empty` 回退。

### 过滤与排序边界

`FuzzySearchFilters` 只表达用户查询里的可执行偏好，不能创建新事实或新分数。

V1 可执行映射：

| filter | 可执行值 | 执行字段 | 边界 |
| --- | --- | --- | --- |
| `time_window` | `latest` / `recent` / `this_week` | 当前 Projects view 的 `context.selected_date`、项目 `first_seen` / `last_seen` / `appearance_dates` | 字段缺失时不硬过滤，记录 `unsupported_filters` |
| `risk_preference` | `lower_risk` | `score.risks`、`score.anti_noise_flags`、`score.confidence` | 只排除明显高风险或低置信项目，不生成风险分 |
| `freshness_preference` | `newer` / `persistent` | `project.first_seen`、`project.persistence_state`、`project.appearances` | `persistent` 优先多日出现或非 single-spike；字段缺失时保持原排序 |
| `sort_preference` | `existing_rank` / `score` / `growth` | 现有 `final_rank` / `score.total_score` / star delta growth | 不允许新增 LLM sort score |

如果 LLM 返回无法用现有字段执行的过滤偏好，系统必须：

1. 忽略该过滤偏好。
2. 在 `diagnostics.unsupported_filters` 中记录字段名。
3. 继续使用可执行的扩展查询和现有排序。
4. 不得让 LLM 再生成替代项目或替代排序解释。

### `hot_only`

1. 保留搜索框中的原始查询。
2. 不把原查询当过滤条件继续隐藏卡片。
3. 展示默认热门项目流，优先使用当前 Projects 页面默认排序。
4. 对 `low_semantic` 不显示“扩展关键词”；对 `open_discovery` 可显示“按当前热门项目展示”。

### `regulated_keyword_search`

1. 从查询句中抽取敏感领域、任务、对象和技术关键词。
2. 执行扩展项目库搜索，不因为用户句子像专业建议请求而拒绝搜索。
3. 展示紧凑边界提示，说明结果只是站内 AI Agent 项目检索，不提供医疗、投资、法律或安全建议。
4. 不展示 LLM 生成的专业建议、行动步骤或事实答案。

### `needs_clarification`

1. 展示 2-3 个澄清选项。
2. 选项不应是 LLM 自由文本问题，而应是可执行的查询改写。
3. 用户选择后重新走 direct search gate。

## UI 语义

### 必须展示

- direct results：不展示 LLM 解释。
- expanded results：展示简短解释，例如“已按：客服工单、helpdesk、customer support 扩展搜索”。
- hot-only low semantic：不羞辱用户，不提示“无意义”，只提示“未识别到明确方向，先展示热门项目”。
- regulated keyword search：每次在 LLM 路径返回敏感领域关键词搜索时，都展示紧凑边界，例如“仅按站内 AI Agent 项目检索，不提供医疗/投资/法律/安全建议”；V1 不依赖用户历史或折叠状态。

### 禁止展示

- LLM 原始长文本。
- LLM 生成的项目答案。
- 大段“我是如何工作的”说明。
- 对 direct results 展示“AI 已优化搜索”，因为这条路径没有触发 LLM。

## 失败与降级

| 失败点 | 降级策略 |
| --- | --- |
| LLM 未配置 | direct search 保持；zero-result 展示热门项目和降级状态 |
| LLM 超时 | 取消本次解释；展示热门项目；记录 `llm_timeout` |
| JSON 解析失败 | 一次 repair；仍失败则展示热门项目 |
| schema 校验失败 | 一次 repair；仍失败则展示热门项目 |
| expanded search 无结果 | 按 fallback 展示热门项目或无结果解释 |
| endpoint 失败 | 前端保留当前 zero-result 状态并显示热门项目入口 |

## 可测试性

### 单元测试

- direct search 有结果时不会调用 LLM。
- direct search 无结果时会调用 LLM。
- `low_semantic` 不允许扩展查询。
- `open_discovery` 展示 hot-only。
- `topic_keyword` 能提取关键词并执行扩展搜索。
- `task_use_case` 能把任务句映射到相关方向词。
- `regulated_keyword_search` 会从敏感领域查询中抽取关键词并执行扩展搜索，但不输出真实专业建议。
- LLM 非法 JSON 会触发一次 repair。
- repair 后仍非法会降级到 hot-only。

### 集成测试

- 输入已有词 `电商`，结果非空且 LLM 调用数为 0。
- 输入原本无结果的“帮客服处理工单的 agent”，LLM 返回 `task_use_case` 后命中客服/工单方向项目。
- 输入“这怎么哈哈了”，保留原查询并显示热门项目。
- 输入“医疗诊断 agent 项目”，返回站内项目扩展并显示边界提示。
- 输入“给我诊断这个病”，返回 `regulated_keyword_search` 扩展检索结果并显示边界提示。
- 输入“最近有什么值得看”，返回热门项目。

### 回归测试

- `src/__tests__/visualConsoleSearchAlignment.test.ts` 中已有别名命中行为保持不变。
- visual console 不配置 LLM key 仍能启动和直接搜索。
- 项目排序没有新增 LLM score 字段。

## 实施就绪判断

本设计已经冻结以下关键技术口径：

- direct search gate 优先级最高。
- zero-result 才触发 LLM。
- LLM 分类枚举为 7 类。
- LLM 输出 JSON schema。
- 前端消费的 fuzzy search response schema。
- 主 prompt 和 repair prompt。
- 扩展查询、敏感领域关键词搜索、热门回退、澄清响应的路由策略。
- `ambiguous` 的 2-3 个可执行澄清改写契约。
- `attribute_filter` 的可执行字段映射与 unsupported filter 诊断。
- 缓存键、审计诊断字段、超时、repair 次数和 LLM 不可用降级。
- LLM 不生成项目事实或最终排序。

因此下一阶段可以直接进入 ExecPlan，而不需要实现者重新做产品级发散。
