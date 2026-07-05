# AgentReach 候选解释增强层设计

## 文档状态

- 状态：`Approved for ExecPlan`
- 存放位置：`docs/specs/design-docs/`
- 提交策略：正式设计文档，可随对应实现或 exec-plan 一并提交
- 对应需求：`docs/specs/product-specs/外部发现与补证信号层需求分析.md`
- 设计范围：AgentReach 外部发现候选的“它是什么 / 为什么值得看”后端解释增强
- 非目标：不做外部讨论趋势，不改 Agent-Reach 上游，不改主评分，不让前端直接调用 DeepSeek

## 1. Summary

当前 AgentReach 后端链路已经能产出 `DailyExternalAggregate`，包含 `observation_candidates`、`project_evidence`、`direction_evidence`、`platform_counts`、`audit`、`named_registry_actors` 等结构化字段。前端已经可以展示外部候选与证据，但用户仍难以从候选名称和平台标签判断“这个项目到底是什么”“为什么值得看”。

本设计新增一层后端 display-oriented 解释增强能力：在不修改外部发现核心 schema、不影响 primary score 的前提下，基于已有 aggregate 和 evidence 字段，调用现有 LLM provider 链路生成可缓存、可降级、可审计的候选解释摘要。

目标输出是给 UI 消费的解释字段，而不是新的事实判断：

- `what_it_is_cn`：它是什么，用普通中文解释项目或方向线索。
- `why_watch_cn`：为什么值得看，解释进入外部发现页的原因。
- `summary_confidence`：摘要可信度，只表达输入信息是否足够。
- `summary_source`：摘要来源，区分 `llm`、`rules_fallback`、`existing_project_brief`。
- `summary_warnings`：摘要生成中的限制，例如缺少 repo description、方向未绑定项目。

LLM 只负责把已有结构化证据转成人话，不得凭空补充功能、机构、使用场景或趋势结论。

## 2. Goals

1. 让 `/agentreach` 页面候选卡和详情页能稳定展示“它是什么”和“为什么值得看”。
2. 对已绑定 repo / product / paper 的候选，尽量生成具体、可读的项目简介。
3. 对未绑定明确对象的方向候选，明确写成“方向线索”，不得伪装成 GitHub 项目。
4. 复用现有 LLM provider、DeepSeek provider、`callStructuredEnhancement`、JSON 修复和脱敏机制。
5. LLM 失败、超时、配置缺失或输出不合格时，必须回退到当前规则解释，不影响 daily 或 aggregate 产出。
6. 输出字段只作为 display-only enrichment，不参与主榜分数、Trendshift / GitHub 主链路判断。

## 3. Non-goals

1. 不做真正多日“外部讨论趋势”总结。单日 aggregate 只能生成今日候选解释。
2. 不扩展 Agent-Reach 上游搜索平台，不新增 X / Reddit / HN API 调用。
3. 不把 LLM 摘要写入 `ExternalSignalEvent` 原始事件事实。
4. 不把外部热度提升为主榜结论，不修改 `ScoreBreakdown` 或 primary score。
5. 不在浏览器、React 组件或前端 API 中暴露 `DEEPSEEK_API_KEY`。
6. 不承诺英文摘要第一版完整生成。英文 UI 可先使用英文规则回退，中文摘要只在中文页展示。

## 4. Existing Code References

### AgentReach 外部发现后端

- `src/externalDiscovery/types.ts`
  - 定义 `ExternalSignalEvent`、`ExternalEvidence`、`ObservationCandidate`、`DailyExternalAggregate`。
- `src/externalDiscovery/aggregate.ts`
  - 将事件聚合为 `project_evidence`、`direction_evidence`、`platform_counts`、`named_registry_actors`。
- `src/externalDiscovery/agentReachProvider.ts`
  - 读取 AgentReach 本地 artifact 并转为 canonical event。
- `src/externalDiscovery/redaction.ts`
  - 校验 public-safe aggregate，避免 raw text、profile URL 或敏感字段泄露。
- `src/externalDiscovery/paths.ts`
  - 当前已有 `externalAggregatePath(date)` 和 `externalAggregateLatestPath()`。

### 现有 LLM 增强能力

- `src/llm.ts`
  - 统一 LLM 调用、并发、重试、prompt 脱敏。
- `src/providers/deepseek.ts`
  - DeepSeek provider。
- `src/action/enhancementLlm.ts`
  - `callStructuredEnhancement` 和 JSON 修复重试。
- `src/action/projectLibraryEnhancement.ts`
  - 已有 `project_brief_cn` 生成模式，可复用其“项目简介必须具体”的校验思路。
- `src/action/dailyReport.ts`
  - 已有 `project_brief_cn` / `why_today_cn` 的 prompt 约束和 fallback 经验。

### 前端消费位置

- UI worktree 中的 `/agentreach` 页面应只读取后端产物字段。
- 后端输出建议通过 view-model adapter 暴露给 `AgentReachViewModel`，不要让 React 自己拼 LLM prompt。

## 5. Data Contract / Field Mapping

### 5.1 新增展示增强模型

建议新增 display-only artifact，而不是直接扩展核心 `DailyExternalAggregate` 第一层字段。

```ts
interface ExternalCandidateExplanationArtifact {
  schema_version: "external-discovery.candidate-explanations.v1";
  date: string;
  generated_at: string;
  provider: "deepseek" | "openai" | "anthropic" | "openrouter" | "minimax" | "github-copilot" | "rules";
  explanation_policy_version: "candidate-explanations.v1";
  aggregate_source_input_hash: string;
  aggregate_generated_at: string;
  input_context_hash: string;
  public_safe: true;
  redaction_policy_version: string;
  contains_raw_text: false;
  contains_profile_urls: false;
  status: "ok" | "partial" | "skipped" | "failed";
  status_reason?: string;
  explanations: ExternalCandidateExplanation[];
  audit: {
    eligible_count: number;
    attempted_count: number;
    accepted_count: number;
    enhanced_count: number;
    rejected_count: number;
    fallback_count: number;
    warnings: Array<{ reason_code: string; reason_detail: string }>;
  };
}
```

```ts
interface ExternalCandidateExplanation {
  candidate_key: string;
  candidate_kind: "project" | "paper" | "product" | "direction";
  target_key: string;
  explanation_scope: "bound_object" | "direction_signal" | "external_evidence_boost";
  what_it_is_cn: string;
  why_watch_cn: string;
  summary_confidence: "high" | "medium" | "low";
  summary_source: "llm" | "rules_fallback" | "existing_project_brief";
  evidence_ids: string[];
  platforms: ExternalPlatform[];
  caveats: string[];
  generated_at: string;
}
```

### 5.2 字段语义冻结

| 字段 | 生产者 | 消费者 | 语义 | 缺失 / 降级行为 |
| --- | --- | --- | --- | --- |
| `explanation_policy_version` | explanation generator | verify / replay | 摘要生成策略版本，V1 固定为 `candidate-explanations.v1` | 缺失时 verify fail |
| `aggregate_source_input_hash` | aggregate builder | explanation generator / verify | 关联被解释的 `DailyExternalAggregate.source_input_hash` | 缺失时 artifact 不可用于 UI merge |
| `input_context_hash` | explanation input builder | cache / replay / verify | 对排序后的 `CandidateExplanationInput[]` 做稳定 hash，用于判断摘要是否对应当前输入包 | 不匹配时 UI 不得使用该 explanation artifact |
| `public_safe` / `contains_raw_text` / `contains_profile_urls` | public-safe validator | deploy / verify / UI | 与 aggregate 保持同类公开安全标记，必须为 `true/false/false` | 缺失或不匹配时不得提交或供 UI 读取 |
| `candidate_key` | explanation input builder | explanation merge / UI view-model | 稳定候选键，格式固定为 `${candidate_kind}:${target_key}`；同一 daily aggregate 内必须唯一 | 无法生成时不得进入 LLM batch，记录 `candidate_key_missing` 并使用规则 fallback |
| `explanation_scope` | explanation input builder | prompt / validator / UI | `bound_object` 表示已绑定 repo/product/paper；`direction_signal` 表示方向线索；`external_evidence_boost` 表示已有候选获得外部补证 | 不得由 LLM 自行决定；无法判断时使用 `direction_signal` 并降为 `low` |
| `status` | explanation generator | run-summary / UI / verify | `ok`=eligible candidates 全部有可展示 explanation，且 `llm/existing_project_brief` 增强覆盖率达到 70%；`partial`=部分 LLM 调用或校验失败，或增强覆盖率不足；`skipped`=LLM 未启用或无候选；`failed`=增强流程整体失败但 aggregate 仍可用 | UI 不得把 `partial/failed/skipped` 解释成“没有外部信号” |
| `status_reason` | explanation generator | run-summary / verify | 固定 reason code，见第 9 节 | 缺失时 verify warning |
| `summary_confidence` | validator | UI | 摘要可信度，只表示解释输入是否足够，不表示项目质量 | 缺失时视为 `low` |
| `summary_source` | explanation generator | UI / verify | `existing_project_brief`=复用已有项目简介；`llm`=LLM 输出通过校验；`rules_fallback`=规则回退 | 缺失时视为 `rules_fallback` |
| `what_it_is_cn` | existing brief / LLM / rules | UI | 回答“它是什么”，不得承诺主榜结论 | 缺失时使用规则 `intro_line` |
| `why_watch_cn` | LLM / rules | UI | 回答“为什么今天值得看”，只表达外部层原因 | 缺失时使用规则 `appearance_reason` |
| `caveats` | generator / validator | UI | 展示限制和待确认项，例如需要主源确认、方向未绑定 repo | 缺失时默认追加“外部层不能作为主榜结论” |

`summary_confidence` 判定冻结为：

- `high`：存在可复用的 `project_brief_cn` 或 repo description，且候选已绑定明确 repo/product/paper，并至少有 1 条外部证据。
- `medium`：存在明确 `target_url/repo_url` 或 `target_display_name`，但缺少项目简介；可说明对象存在和外部讨论原因，但不能写具体用途。
- `low`：只有方向 topic、长标题、平台计数或未绑定对象；只能写方向线索或保守候选说明。

`summary_source` 优先级冻结为：

1. `existing_project_brief` 优先用于 `what_it_is_cn`，避免重复调用 LLM 生成已有项目简介。
2. `llm` 可用于生成 `why_watch_cn`，也可在有足够输入时生成 `what_it_is_cn`。
3. `rules_fallback` 是所有失败、缺失、低质量输出的最终兜底。

### 5.3 为什么建议旁路 artifact

`DailyExternalAggregate` 当前是 public-safe 外部发现事实聚合，核心字段不包含自由文本摘要。LLM 摘要属于解释层，具有失败、重试、缓存、质量校验等独立生命周期。旁路 artifact 有三个好处：

1. 不污染已冻结的 external discovery aggregate 事实契约。
2. LLM 摘要可以独立重跑、独立缓存、独立回退。
3. UI 可以优先读取解释 artifact，缺失时仍展示原 aggregate。

推荐路径：

```text
data/external-discovery/YYYY-MM-DD.candidate-explanations.json
data/external-discovery/latest.candidate-explanations.json
```

第一版也可以在 view-model 构建时把 explanation artifact merge 到候选展示模型中，但不要反向覆盖 `DailyExternalAggregate`。

### 5.4 冻结的 CandidateExplanationInput

为了避免 LLM 只能生成“被外部讨论提到的候选”这类空泛文案，第一版必须构建独立的 public-safe prompt input。该输入不是 canonical fact schema，而是解释增强层的只读输入包。

```ts
interface CandidateExplanationInput {
  candidate_key: string;
  candidate_kind: "project" | "paper" | "product" | "direction";
  target_key: string;
  display_name: string;
  explanation_scope: "bound_object" | "direction_signal" | "external_evidence_boost";
  target_url?: string;
  repo_url?: string;
  target_display_name?: string;
  existing_project_brief_cn?: string;
  repo_description?: string;
  public_evidence_titles: string[];
  public_source_titles: string[];
  evidence_reason_facts: string[];
  evidence_ids: string[];
  platforms: ExternalPlatform[];
  mention_count: number;
  distinct_actor_count: number;
  top_tier_actor_count: number;
  named_registry_actor_names: string[];
  can_enter_daily: boolean;
  can_enter_weekly: boolean;
  cannot_be_primary_conclusion: true;
  input_confidence: "high" | "medium" | "low";
}
```

字段来源冻结为：

| 输入字段 | 来源 | 规则 |
| --- | --- | --- |
| `display_name` | `ObservationCandidate.target_key`、UI display adapter 或 sanitized provider target name | 必须存在；长标题可截断展示，但 prompt input 保留完整 public-safe 文本 |
| `target_url` / `repo_url` | canonical event / provider target URL / existing project index | 只允许 repo、paper、product 官方 URL；不得放 profile URL |
| `target_display_name` | sanitized provider target name 或 repo full name | 仅用于帮助 LLM 识别对象，不作为主源确认 |
| `existing_project_brief_cn` | project library / observer / daily report existing brief | 已知 repo 命中时必须优先使用 |
| `repo_description` | existing project index / GitHub 主链路已采集 description | 仅使用已在主链路或项目库存在的描述，不新增 live GitHub 请求 |
| `public_evidence_titles` | AgentReach provider item title 经 sanitizer 后产生 | 只允许标题级短文本；禁止 raw post body、评论全文、handle、profile URL |
| `public_source_titles` | official page/blog/HN/Reddit/X item title 经 sanitizer 后产生 | 最多 5 条，每条建议不超过 160 字符 |
| `evidence_reason_facts` | 规则生成 | 例如“HN 出现外部讨论”“具名讨论者 OpenAI 命中 registry”“跨平台出现” |
| `named_registry_actor_names` | `ExternalEvidence.named_registry_actors.display_name` | 只能使用 registry 命中的 public-safe display name |

`public_evidence_titles` / `public_source_titles` 是解决“它是什么”的关键输入。实现阶段不得只把它们留作未来扩展；如果 provider raw title 暂时不可用，必须记录 `public_title_context_missing`，并将对应候选 `input_confidence` 降为 `medium` 或 `low`。

### 5.5 基础 aggregate 输入字段

每个候选解释输入应只包含 public-safe 字段：

- `ObservationCandidate`
  - `candidate_kind`
  - `target_key`
  - `qualification`
  - `can_enter_daily`
  - `can_enter_weekly`
  - `cannot_be_primary_conclusion`
- 对应的 `ExternalEvidence`
  - `scope`
  - `target_key`
  - `derived_signal_kinds`
  - `platforms`
  - `mention_count`
  - `distinct_actor_count`
  - `top_tier_actor_count`
  - `named_registry_actors.display_name`
  - `actor_types`
  - `actor_tiers`
  - `first_seen_at`
  - `last_seen_at`
- 聚合上下文
  - `status`
  - `status_reason`
  - `platform_counts`
  - `accepted_event_count`
  - `rejected_event_count`

如果 `CandidateExplanationInput` 不包含 `existing_project_brief_cn`、`repo_description`、`public_evidence_titles` 或 `public_source_titles` 中至少一类具体语义输入，则 LLM 不得编造具体功能，只能生成保守解释；该候选的 `summary_confidence` 不得高于 `medium`。

## 6. Explanation Semantics

### 6.1 项目级候选

当候选满足以下条件之一时，可以按项目候选解释：

- `candidate_kind` 是 `project`、`paper` 或 `product`。
- 对应 evidence `scope=project`。
- `target_key` 是 repo-like key 或存在可 public-safe 展示的 repo / object URL。

输出语义：

- `what_it_is_cn` 应解释“这是一个什么对象”，例如项目、论文、产品、工具。
- 如果输入缺少 description，不得写“它可以自动完成某某任务”这类无来源功能描述。
- 可以写“目前只能确认它是一个被外部讨论提到的 GitHub repo 候选，具体功能仍需主源补充”。

### 6.2 方向级候选

当候选满足以下条件之一时，必须按方向线索解释：

- `candidate_kind=direction`
- evidence `scope=direction`
- `qualification=direction_observation`
- 无明确 repo / paper / product 绑定

输出语义：

- `what_it_is_cn` 必须包含“方向线索”或等价含义。
- 不得把长标题或 topic hint 写成具体项目名。
- `why_watch_cn` 应解释该方向在外部讨论中出现，适合进入观察，不是主榜结论。

### 6.3 外部补证候选

当 evidence 主要是对已有对象的 `derived_signal_kinds` 包含 `evidence`，或上层 view-model 标记为外部补证时：

- `what_it_is_cn` 可以优先使用已有项目简介或绑定对象描述。
- `why_watch_cn` 应突出“已有候选获得外部补证”，而不是“新项目发现”。
- 仍必须带上“外部层仅作次级证据”的 caveat。

## 7. LLM Prompt Rules

Prompt 必须固定以下约束：

1. 只根据输入 JSON 写摘要，不得访问互联网，不得推测未提供的功能。
2. 输出 exactly one JSON object，不使用 markdown。
3. 对项目候选，优先说明“它是什么 + 用户通常拿它做什么”，但只有输入支持时才能写用途。
4. 对方向候选，必须写成“方向线索”，不得包装成项目简介。
5. `why_watch_cn` 必须解释外部层原因，例如跨平台、具名讨论者、关注度、可进入日报/周报。
6. 不得出现“主榜结论”“高置信推荐”“已经形成趋势”等过度结论。
7. 若证据不足，必须显式写“仍需 GitHub / Trendshift 主链路确认”。

建议 LLM 输出草案：

```json
{
  "explanations": [
    {
      "candidate_key": "project:example/repo",
      "what_it_is_cn": "这是一个被外部讨论提到的 GitHub repo 候选，目前可以确认对象存在，但具体功能仍需主源补充。",
      "why_watch_cn": "它今天在 HN 和 Reddit 出现外部讨论，并已发现可绑定的 repo 线索，适合作为外部层候选继续观察。",
      "summary_confidence": "medium",
      "caveats": ["外部层不能作为主榜结论", "仍需 GitHub / Trendshift 主链路确认"]
    }
  ]
}
```

## 8. Validation Rules

LLM 输出必须经过校验，校验失败则丢弃并回退规则文案。

基础校验：

- `candidate_key` 必须能匹配输入候选。
- `what_it_is_cn` 和 `why_watch_cn` 必须是中文非空字符串。
- 每段长度建议 30 到 140 个中文字符。
- 不得包含 URL、markdown 链接、API key、profile URL。
- 不得包含“主榜结论”“高置信推荐”“确定爆发”“已经成为趋势”等过度判断。
- 方向候选的 `what_it_is_cn` 必须包含“方向”或“线索”等弱绑定语义。
- 未提供功能描述时，不得出现明显编造的具体能力动词，例如“自动部署”“自动生成完整应用”等，除非输入 evidence 明确支持。

去重校验：

- 不同候选不得复用完全相同的 `what_it_is_cn`。
- 多个候选若输出高度相似，应优先保留 evidence 更充分的候选，其余回退规则文案。

## 8.1 最小增强义务

解释增强层的外部依赖是 optional，但当 LLM 已启用且存在候选时，增强结果不能被实现缩水成“全部规则 fallback 也算完成”。

V1 最小义务冻结为：

1. 默认 eligible candidate 覆盖上限为 `top_n=30`，由候选排序后的前 30 个候选组成；少于 30 个时覆盖全部候选。
2. eligible candidate 排序优先级：`external_evidence_boost` 高于 `bound_object` 高于 `direction_signal`；同类内按 evidence 数、平台数、`top_tier_actor_count`、`mention_count` 降序。
3. 有 `existing_project_brief_cn` 的候选必须生成 explanation，不需要调用 LLM 也不能跳过。
4. 有 `repo_url/target_url` 且有 `public_evidence_titles` 或 `repo_description` 的项目候选必须尝试 LLM 或复用现有简介。
5. 方向候选至少覆盖 eligible direction candidates 的前 5 个；若不足 5 个则覆盖全部。
6. eligible candidate 中增强 explanation 覆盖率低于 70% 时，artifact `status` 必须是 `partial`，不得标记为 `ok`。增强 explanation 只统计 `summary_source=llm` 或 `existing_project_brief`，不统计 `rules_fallback`。
7. eligible candidate 中增强 explanation 覆盖率为 0 且候选数大于 0 时，artifact `status` 必须是 `failed` 或 `skipped`，不得标记为 `ok`。

`rules_fallback` 可以作为单候选兜底，但不得被用来规避 LLM 尝试义务。若因为输入不足未调用 LLM，必须在 audit 中记录 `input_context_insufficient`。

## 9. Fallback Strategy

增强层必须可降级，但降级语义必须显式可见。

### LLM 未启用

- status：`skipped`
- 原因：`llm_disabled`
- UI 使用现有规则字段：项目候选、方向线索、外部补证、需主源确认。

### LLM 调用失败

- status：`partial` 或 `failed`
- 单候选失败不影响其他候选。
- 失败候选使用 `rules_fallback`。
- audit 记录 `summary_generation_failed`。

### LLM 输出不合格

- 丢弃该候选 LLM 摘要。
- 使用规则 fallback。
- audit 记录 `summary_validation_failed` 和原因码。

### 输入信息不足

- 不调用或调用后降级为低置信摘要。
- `summary_confidence=low`
- `caveats` 写明“缺少项目功能描述”或“尚未绑定明确 repo”。

### status_reason 冻结集合

`status_reason` 必须使用以下 reason code 之一或组合；不得写自由文本作为唯一状态原因：

- `llm_disabled`
- `no_candidates`
- `candidate_explanation_ok`
- `partial_llm_failure`
- `summary_generation_failed`
- `summary_validation_failed`
- `input_context_insufficient`
- `public_safe_validation_failed`
- `provider_unavailable`
- `unexpected_exception`

单候选 warning reason code 固定为：

- `candidate_key_missing`
- `candidate_not_eligible`
- `public_title_context_missing`
- `project_brief_reused`
- `llm_output_rejected`
- `rules_fallback_used`
- `direction_candidate_low_confidence`
- `primary_source_confirmation_required`

## 10. Runtime Placement

第一版推荐作为 daily external aggregate 后处理步骤：

```text
AgentReach raw artifact
  -> readAgentReachProviderArtifact
  -> buildDailyExternalAggregate
  -> assertPublicSafeAggregate
  -> buildCandidateExplanationInputs
  -> assertPublicSafeCandidateExplanationInputs
  -> generateExternalCandidateExplanations
  -> assertPublicSafeCandidateExplanations
  -> write candidate-explanations artifact
  -> visual console / UI read model merge
```

这样可以保证：

- 只有通过 public-safe 校验的 aggregate 与 `CandidateExplanationInput` 会进入 LLM prompt。
- `CandidateExplanationInput` 必须先通过 public-safe 校验，再进入 LLM prompt。
- LLM 摘要失败不会破坏 external aggregate。
- UI 可以在没有 explanation artifact 时正常运行。

## 11. UI Consumption Contract

前端 `/agentreach` 页面不直接调用 DeepSeek，只消费后端产物。

UI 优先级：

1. `ExternalCandidateExplanation.what_it_is_cn`
2. 已有项目库或 observer 的 `project_brief_cn`
3. 规则 fallback `intro_line`

候选卡：

- 标题下展示 `why_watch_cn` 的短版，或规则 `appearance_reason`。
- chip 仍只展示状态和来源，不承载长解释。

详情页：

- `它是什么` 展示 `what_it_is_cn`。
- `为什么值得看` 展示 `why_watch_cn` 和 caveats。
- 方向候选显示“方向线索 / 尚未绑定明确项目”。

英文页：

- 第一版不直接展示中文 LLM 摘要。
- 若没有英文摘要字段，英文页使用英文规则 fallback。
- 后续如需英文摘要，应新增 `what_it_is_en` / `why_watch_en`，不要机器翻译中文字段后直接混用。

## 12. Security & Privacy

1. `DEEPSEEK_API_KEY` 只存在服务端环境变量，不进入浏览器 bundle。
2. Prompt 输入只来自 public-safe aggregate 与通过校验的 `CandidateExplanationInput`，不包含 raw text、profile URL、handle、private registry metadata。
3. 调用 `callLlm` 时继续使用现有 prompt 脱敏机制。
4. LLM 输出不得写回 raw input，不得覆盖 canonical event。
5. explanation artifact 公开提交前必须通过 `assertPublicSafeCandidateExplanations`。

### 12.1 CandidateExplanationInput public-safe 校验

`assertPublicSafeCandidateExplanationInputs` 必须拒绝以下内容：

- API key、token、cookie、bearer token、private key 等敏感字符串。
- `profile_url`、社交平台个人主页 URL、带 handle 的 profile 链接。
- raw post body、评论全文、长文本 thread、未截断网页正文。
- 未经 registry 命中的 actor handle 或 display name。
- markdown link、HTML anchor、未脱敏 URL 列表。
- 单条 `public_evidence_titles` 或 `public_source_titles` 超过 160 字符。

允许进入 input 的 URL 仅限：

- `repo_url`
- `target_url`
- paper / product / official page 的对象 URL

这些 URL 只用于对象绑定，不得作为 source actor 或讨论者身份展示。

### 12.2 CandidateExplanation artifact public-safe 校验

`assertPublicSafeCandidateExplanations` 必须拒绝以下输出：

- 包含 API key、token、cookie、profile URL、raw handle。
- 包含 markdown 链接或 HTML 链接。
- 包含“主榜结论”“高置信推荐”“确定爆发”“已经成为趋势”等过度结论。
- 方向候选摘要未包含“方向 / 线索 / 尚未绑定明确项目”等弱绑定语义。
- `what_it_is_cn` 或 `why_watch_cn` 与其他候选完全重复。
- LLM 输出未经输入支持的具名机构、具体功能或使用场景。

reason code 固定为：

- `sensitive_text_detected`
- `profile_url_detected`
- `raw_handle_detected`
- `markdown_link_detected`
- `overclaim_detected`
- `direction_semantics_missing`
- `duplicate_summary_detected`
- `unsupported_actor_claim`
- `unsupported_function_claim`

### 12.3 产物提交策略

`candidate-explanations` 是 public-safe display artifact，但默认仍按运行产物处理：

- 本地真实运行生成的 `data/external-discovery/*.candidate-explanations.json` 默认不提交。
- 只有经过脱敏、用于测试的 fixture 可以提交。
- 若未来要把解释摘要作为线上页面预生成数据发布，必须在对应 release / deploy 流程中运行 public-safe 校验。

## 13. Test & Review Plan

### Unit tests

- 项目候选能生成或回退 `what_it_is_cn` / `why_watch_cn`。
- 方向候选必须保留“方向线索”语义。
- LLM disabled 时 artifact status 为 `skipped` 或返回 null，不影响 aggregate。
- LLM 返回非法 JSON 时可 repair 或 fallback。
- LLM 输出过度结论时被 validation 拒绝。
- 未命中 repo description 时不得编造项目功能。
- eligible candidates enhanced explanation 覆盖率低于 70% 时，artifact status 必须是 `partial`。
- 有 `existing_project_brief_cn` 的候选必须产生 `existing_project_brief` source 的 explanation。
- `CandidateExplanationInput` 包含 profile URL、raw handle、长正文时必须被 public-safe 校验拒绝。

### Integration tests

- 使用 fixture aggregate 生成 `candidate-explanations.json`。
- 合并 explanation artifact 后，view-model 优先展示 LLM 摘要。
- explanation artifact 缺失时 UI 仍能展示规则 fallback。
- `assertPublicSafeAggregate` 仍覆盖原 aggregate，新增 explanation artifact 需要对应 public-safe 检查。
- 使用真实或近真实 fixture 检查至少 5 个候选的 `what_it_is_cn`，不得全部退化成“被外部讨论提到的候选”。

### Manual review

- 选择 3 类真实候选检查：
  - 已绑定 repo 项目候选。
  - 未绑定方向线索。
  - 已有候选外部补证。
- 检查中文文案是否能回答“它是什么 / 为什么值得看”。
- 检查是否出现把外部层写成主榜结论的表达。

## 14. Risks / Open Questions

### Risks

- 如果输入缺少 repo description 或 source title，LLM 能生成的“是什么”仍会偏保守。
- 如果把 explanation artifact 直接混入 aggregate，后续事实契约和解释契约容易混乱。
- 如果英文 UI 直接展示中文摘要，会破坏语言切换体验。
- 如果 prompt 不限制，LLM 容易把方向线索写成确定项目或趋势结论。

### Open Questions

1. 后续是否需要增加 `what_it_is_en` / `why_watch_en`。
2. 线上部署时 explanation artifact 是按 daily 预生成，还是页面构建时读取 latest artifact 后合并。

## 15. Recommended Next Step

本设计通过后，再生成对应 exec-plan。exec-plan 应明确：

1. 新增文件和路径。
2. LLM prompt 与 validation 实现。
3. explanation artifact 写入与 latest 同步。
4. UI view-model merge 规则。
5. 测试命令和真实 dry-run 验证步骤。
