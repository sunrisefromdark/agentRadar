# 设计文档：自然语言模糊搜索与推荐入口

## 文档状态

- 版本：`v0.1-framework`
- 状态：`Proposed for Review`
- 设计输入：
  - [自然语言模糊搜索与推荐需求分析.md](../product-specs/自然语言模糊搜索与推荐需求分析.md#L1)
  - [architecture-constraints.md](../constraints/architecture-constraints.md#L1)
  - [llm-classification.md](../services/llm-classification.md#L1)
  - [daily-report-freshness-readability-design.md](daily-report-freshness-readability-design.md#L1)
  - [project-search-system-redesign-design.md](project-search-system-redesign-design.md#L1)
- 目标：在不引入第二套事实源、不重算分数、不扩大到开放域问答的前提下，新增一个 `rules-first` 的自然语言意图推荐入口，让用户可以用模糊表达拿到可解释、可审计、可降级的项目或趋势推荐。

## 严格需求 Review 回执

本轮需求文档 review 后，已补强三个会影响设计边界的位置：

1. 文档顶部状态从 `Draft for Review` 调整为 `READY`，与底部冻结状态一致。
2. `需求 6` 从“推荐结果来自 `daily / weekly / observer / kb`”收紧为“一等推荐结果只能来自 `daily projects + weekly trends`，`observer / KB` 只能作为辅助证据或下钻支撑”。
3. `当前缺口` 明确为设计阶段门禁：V1 查询意图词典、近域口语白名单、高冲突判定规则未冻结前，不得进入 ExecPlan。

## 一句话设计

把搜索入口扩展成“请求解释卡 + 主结果轨 + 可选次结果轨”的受控推荐体验：系统先告诉用户它把这句话理解成什么，再只从现有 `daily projects` 和 `weekly trends` 中组织结果，并为每条结果给出可追溯匹配理由。

## 设计 Thesis

本次不是把精确搜索改成“更聪明的关键词匹配”，而是新增一个独立的 `intent recommendation` 产品原语。

用户的核心问题不是“我输错词了”，而是“我不知道该用什么系统词”。因此设计重点不是扩大同义词，而是建立一套可见的解释机制：

1. 我怎么理解你的话。
2. 我按哪个对象范围推荐：项目还是趋势。
3. 我为什么选这些结果。
4. 如果不能推荐，是因为无结果、解释冲突，还是超出产品范围。

这个入口必须比聊天回答更窄，比精确搜索更会承接意图，并且始终保持 artifact-first。

## 用户心智与产品表面

用户应能在一次使用后学会一句话：

> 系统会先解释它怎么理解我的模糊请求，再从今天项目或本周趋势里推荐有证据的结果。

V1 产品表面固定为四个区域：

1. `请求解释卡`
   - 显示对象范围、时间语义、推荐标准、过滤条件、口语映射。
2. `主结果轨`
   - 显示系统本次选择的主解释结果。
3. `次结果轨`
   - 仅在存在轻度双重解释时出现，默认折叠，不与主结果混排。
4. `失败 / 澄清卡`
   - 用于无结果、需澄清、超域、artifact 不可用。

禁止：

- 只显示结果、不显示解释。
- 把项目和趋势混成一个无标签列表。
- 把 `observer / KB` 条目伪装成主结果。
- 用 LLM 自由文本回答替代 artifact 结果。

## 范围

### 包含

- V1 查询意图词典。
- V1 近域口语 / 比喻白名单。
- 项目推荐与趋势推荐的对象范围选择规则。
- 轻度冲突主解释优先、高冲突澄清的门槛。
- 推荐结果的响应结构、字段契约和用户可见解释。
- `rules-only` 下的基础可用路径。
- visual-console 与 visual-console:web 的只读消费语义。

### 不包含

- 不改写 exact search 的命中逻辑。
- 不新建 scoring 分数、热度值、趋势事实或用户兴趣分。
- 不引入外部实时搜索结果作为推荐真相。
- 不把 `interest profile` 纳入 V1 排序加权。
- 不把入口扩张成开放域问答、金融查询或聊天助手。
- 不要求 V1 持久化用户查询历史。

## 核心产品原语

### 1. `QueryInterpretation`

对用户请求的结构化解释。它是推荐入口的第一结果，而不是内部调试字段。

固定包含：

- `mode`
- `primary_object_scope`
- `secondary_object_scope`
- `time_window`
- `ranking_intent`
- `filters`
- `oral_mapping`
- `domain_boundary`
- `confidence_state`
- `explanation_cn`

### 2. `ResultRail`

按对象范围分组的结果轨。

V1 只允许两类：

- `daily_project`
- `weekly_trend`

主结果轨最多展示：

- 项目推荐：`6` 条
- 趋势推荐：`4` 条

次结果轨最多展示 `3` 条，并必须显示“也可按另一种语义理解”。

### 3. `Source-bound Match Reason`

每条推荐结果至少有 `1` 条与本次请求相关、且可追溯到现有 artifact 字段的理由。

若只能生成模板理由但无法绑定到字段，结果仍可展示，但必须标记：

- `explanation_quality = "degraded"`

### 4. `RecommendationFailure`

失败不是一个空列表，而是四类固定状态：

- `no_match`
- `needs_clarification`
- `out_of_scope`
- `artifact_unavailable`

## V1 查询意图词典

V1 必须覆盖以下意图。词典外请求不得被自由扩张解释，只能进入保守降级、澄清或 exact search。

| intent_key | 触发表达 | 主对象范围 | 时间语义 | 排序 / 过滤语义 |
| --- | --- | --- | --- | --- |
| `hot_projects` | `最热`、`最火`、`热门`、`最近火` | `daily_project` | `latest_available` | 使用现有 daily 排序，不新增热度分 |
| `worth_watching_projects` | `值得看`、`值得追`、`值得关注` | `daily_project` | `latest_available` | 使用现有 final_rank / total_score |
| `topic_projects` | `MCP 项目`、`memory 项目`、`coding agent 项目` 等主题 + 项目表达 | `daily_project` | `latest_available` | 先主题过滤，再按现有排序 |
| `low_risk_hot_projects` | `风险低`、`稳一点`、`高置信` + 热度表达 | `daily_project` | `latest_available` | 过滤明显风险项，不新增风险分 |
| `persistent_projects` | `持续出现`、`一直在出现`、`不是单日冒头` | `daily_project` | `recent` | 使用 `persistence_state / appearances` |
| `weekly_trends` | `本周趋势`、`形成趋势`、`趋势方向`、`一周内` | `weekly_trend` | `this_week` | 使用 weekly 既有趋势顺序 |
| `topic_weekly_trends` | 主题 + `趋势 / 方向 / 本周` | `weekly_trend` | `this_week` | 主题过滤 weekly trend |

V1 首批主题识别只允许从既有字段中匹配：

- `tags`
- `description`
- `score.paradigm`
- `matched_interest_topics`
- weekly `trend_key / trend_name_cn / trend_summary_cn`

## 近域口语白名单

白名单先于 LLM 生效。白名单外表达不得由 LLM 或 embedding 自由扩张为站内语义。

| whitelist_key | 允许表达 | 站内解释 | 限制 |
| --- | --- | --- | --- |
| `oral_stock_as_project` | `股票`、`标的` | 值得优先关注的 AI Agent 生态项目候选 | 仅在没有真实金融限定词时生效 |
| `oral_leader` | `龙头`、`头部` | 当前更值得优先看的项目或趋势 | 不等于市场占有率结论 |
| `oral_homework` | `抄作业`、`值得抄作业` | 值得参考其做法或方向的项目 / 趋势 | 必须显示这是站内比喻解释 |
| `oral_watchlist` | `值得追`、`值得蹲` | 值得继续关注的候选 | 不等于投资建议 |

真实金融超域词拥有更高优先级，命中即进入 `out_of_scope`：

- `A 股`
- `美股`
- `港股`
- `股价`
- `股票代码`
- `财报`
- `证券`
- `大盘`
- `板块`
- `涨跌幅`
- `加密资产`
- `币价`
- `token 价格`

示例：

- `我想看看最热的股票有什么`：可按 `oral_stock_as_project` 映射为站内项目标的。
- `美股最近最热的股票是什么`：必须进入 `out_of_scope`。

## 解释状态机

```text
Raw Query
  -> Normalize
  -> Domain Boundary Check
  -> Oral Whitelist Mapping
  -> Intent Dictionary Match
  -> Object Scope Selection
  -> Conflict Policy
  -> Candidate Retrieval
  -> Result Projection
```

### 1. Normalize

最小标准化：

- 全角 / 半角统一
- 大小写统一
- 常见空格折叠
- 中英文主题词保留原文

### 2. Domain Boundary Check

若命中真实金融超域词，直接输出 `out_of_scope`。

除非用户明确写出“不是问真实股票 / 只看 AI Agent 项目”，否则超域词优先于白名单映射。

### 3. Oral Whitelist Mapping

只处理白名单表内表达。

输出必须在解释卡中显示：

- 原始表达
- 映射后的站内语义
- 边界提示

### 4. Intent Dictionary Match

规则词典必须覆盖本设计列出的 V1 intent。

LLM 可提供结构化补充，但不得：

- 生成词典外 intent。
- 覆盖超域判断。
- 绕过白名单限制。
- 直接生成推荐结果。

### 5. Object Scope Selection

主对象范围选择规则固定如下：

| 条件 | primary_object_scope | secondary_object_scope |
| --- | --- | --- |
| 明确出现 `项目 / repo / 仓库 / 标的 / 股票` 且无趋势强指示 | `daily_project` | 可为空 |
| 明确出现 `趋势 / 方向 / 赛道 / 本周 / 一周 / weekly` | `weekly_trend` | 可为空 |
| 只有 `最热 / 值得看 / 最近有什么` 等泛请求 | `daily_project` | `weekly_trend` 可选 |
| 项目和趋势都可解释，但只有一方更强 | 更强的一方 | 另一方可作为次结果轨 |
| 项目和趋势强冲突且无法稳定判定 | 无 | 无，进入 `needs_clarification` |

### 6. 高冲突门槛

实现不得用“感觉有歧义”来决定澄清。V1 高冲突固定为：

- `project_marker_count >= 2`
- `trend_marker_count >= 2`
- 两者差值 `<= 1`
- 且没有明确主语短语位于 `看 / 推荐 / 找 / 有哪些` 之后

若不满足以上全部条件，默认采用主解释优先，并在解释卡中说明取舍。

## 候选池与排序

### Daily Project 候选池

主候选池：

- `DailyReport.today_star_projects`

兼容候选池：

- 当旧 artifact 缺少 `today_star_projects` 时，可从 `high_score_projects / anomaly_projects / new_projects` 投影为 `daily_project`，但解释卡必须标记 `artifact_compatibility = "legacy_degraded"`。

禁止作为主推荐结果：

- `context_only_projects`
- `observer.entries`
- `KB latest`

除非用户显式请求“历史补充 / 背景”，否则 `context_only_projects` 不进入 V1 推荐主结果。

排序规则：

1. 优先使用 `final_rank`。
2. 无 `final_rank` 时使用 `score.total_score`。
3. 同分时按 `repo_url` 字典序稳定排序。

过滤规则：

- 主题过滤：只基于 tags、description、paradigm、matched_interest_topics。
- 风险过滤：`risk_review_required=true`、高风险 `risks` 或明显 `anti_noise_flags` 的项目不得进入 `low_risk_hot_projects` 主结果。
- 持续性过滤：优先 `persistence_state != "single-spike"` 或 `appearances >= 2`。

### Weekly Trend 候选池

主候选池：

- `WeeklyReport.core_trend_cards`

观察候选池：

- `WeeklyReport.weak_signal_cards`

`weak_signal_cards` 只能在以下情况出现：

- 用户请求包含 `弱信号 / 观察 / 冒头`。
- 主候选池无结果，且解释卡明确标记“仅作为观察中信号”。

排序规则：

1. 保留 weekly artifact 原顺序。
2. 同一趋势内 supporting projects 保留 artifact 原顺序。
3. 不新增趋势强度分。

## 输出契约

```ts
type RecommendationMode =
  | "intent_recommendation"
  | "exact_search_passthrough"
  | "needs_clarification"
  | "out_of_scope";

type RecommendationObjectScope = "daily_project" | "weekly_trend";
type RecommendationTimeWindow = "today" | "recent" | "this_week" | "latest_available";
type RecommendationConfidenceState = "stable" | "low_confidence" | "high_conflict";

interface QueryInterpretation {
  mode: RecommendationMode;
  primary_object_scope?: RecommendationObjectScope;
  secondary_object_scope?: RecommendationObjectScope;
  time_window: RecommendationTimeWindow;
  ranking_intent: string;
  filters: string[];
  oral_mapping?: {
    whitelist_key: string;
    raw_phrase: string;
    mapped_meaning_cn: string;
  };
  domain_boundary: "in_scope" | "near_domain_mapped" | "out_of_scope";
  confidence_state: RecommendationConfidenceState;
  explanation_cn: string;
}

interface RecommendationResultItem {
  object_type: RecommendationObjectScope;
  source_artifact: "daily_report" | "weekly_report";
  source_ref: string;
  title: string;
  time_context: string;
  rank_basis: "final_rank" | "total_score" | "weekly_order" | "legacy_degraded";
  match_reasons: string[];
  evidence_refs: string[];
  explanation_quality: "source_bound" | "degraded";
  detail_link?: string;
}

interface RecommendationResultRail {
  scope: RecommendationObjectScope;
  rail_role: "primary" | "secondary";
  title_cn: string;
  items: RecommendationResultItem[];
}

interface RecommendationFailure {
  reason: "no_match" | "needs_clarification" | "out_of_scope" | "artifact_unavailable";
  message_cn: string;
  next_actions: string[];
}

interface NaturalLanguageRecommendationResponse {
  query: string;
  interpretation: QueryInterpretation;
  rails: RecommendationResultRail[];
  failure?: RecommendationFailure;
}
```

## 用户可见文案契约

### 请求解释卡

必须使用类似结构：

```text
已按「当前可用结果中的热门项目推荐」理解你的请求。
对象范围：项目
时间语义：当前可用结果
推荐标准：沿用 daily artifact 既有排序，不新增热度分
口语映射：已将“股票”按站内“项目标的”理解，不提供真实证券推荐
```

### 项目结果理由

项目理由优先从以下字段生成：

- `project_brief_cn`
- `why_today_cn`
- `score.paradigm`
- `project.persistence_state`
- `project.appearances`
- `score.confidence`
- `score.risks`
- `matched_interest_topics`

### 趋势结果理由

趋势理由优先从以下字段生成：

- `trend_name_cn`
- `trend_summary_cn`
- `evidence_summary_cn`
- `worth_following_next_week`
- supporting projects 的 `why_this_week_cn`

## LLM 边界

V1 采用 `rules-first, llm-optional`。

LLM 允许：

- 将用户表达转成结构化候选解释。
- 补充用户可读解释措辞。
- 在 rules 已命中时补充 filters。

LLM 禁止：

- 直接决定最终对象范围。
- 生成白名单外口语映射。
- 把超域请求改写成站内请求。
- 生成不存在的项目或趋势。
- 改写 `final_rank / total_score / weekly order`。
- 在 `llm.enabled=false` 时成为必需路径。

LLM 输出非法、超时或低置信时，系统必须回退规则解释；不能静默退化成自由文本回答。

## visual-console / web 集成边界

V1 推荐入口是只读消费层：

- 读取 `data/reports/*.daily.json`
- 读取 `data/reports/*.weekly.json` 或 weekly markdown 解析结果
- 可读取 KB 作为下钻链接或解释补充
- 可读取 observer 作为辅助证据提示，但不作为主结果

建议新增模块：

- `src/recommendation/types.ts`
- `src/recommendation/intentDictionary.ts`
- `src/recommendation/oralWhitelist.ts`
- `src/recommendation/conflictPolicy.ts`
- `src/recommendation/resultProjector.ts`
- `src/recommendation/recommendationService.ts`

推荐入口不应写入 `data/`，除非后续另立查询审计设计。

## 失败与降级

### `no_match`

条件：

- 解释稳定，但候选池过滤后为空。

用户语义：

- “我理解了你的请求，但当前 artifact 中没有满足条件的结果。”

禁止：

- 直接显示“没有搜索结果”。
- 用 `context_only / observer / KB` 自动补齐主结果。

### `needs_clarification`

条件：

- 满足高冲突门槛。

用户语义：

- “这句话可能是在要项目，也可能是在要趋势，需要你先选一个。”

下一动作固定为：

- `看项目推荐`
- `看趋势推荐`

### `out_of_scope`

条件：

- 命中真实金融或其他站外领域强词。

用户语义：

- “本产品不覆盖真实证券或行情，只能推荐 AI Agent 生态内的项目和趋势。”

下一动作固定为：

- `改看站内热门项目`
- `改看本周 Agent 趋势`

### `artifact_unavailable`

条件：

- 对应 daily / weekly artifact 不存在、解析失败或 schema 不满足最低字段。

用户语义：

- “当前缺少可审计 artifact，不能生成可信推荐。”

禁止：

- 调用 LLM 直接补答案。

## 可测试性

### 单元测试

- 白名单内 `股票 / 标的 / 龙头 / 抄作业` 能被映射，并显示映射解释。
- `美股 / A 股 / 股价 / 财报` 等超域词优先进入 `out_of_scope`。
- 白名单外近义词不得自由映射。
- 泛热度请求默认 `daily_project` 主解释。
- 明确 `趋势 / 本周 / 方向` 请求进入 `weekly_trend`。
- 高冲突门槛只在满足四个条件时触发澄清。
- `llm.enabled=false` 时 V1 intent 仍可运行。
- 排序只使用 `final_rank / total_score / weekly_order`，不新增分数。

### 集成测试

- 使用 daily fixture 输入“最近最热的都有什么”，返回请求解释卡和项目主结果轨。
- 使用 weekly fixture 输入“本周形成趋势的 MCP 方向”，返回趋势主结果轨。
- 输入“我想看看最热的股票有什么”，返回站内项目推荐并显示口语映射。
- 输入“美股最近最热的股票是什么”，返回 `out_of_scope`，不返回站内结果。
- 项目和趋势轻度歧义时返回主轨 + 次轨；高冲突时只返回澄清卡。
- `observer` 与 `KB` fixture 存在时，不能直接混入主结果。

### 回归测试

- exact search 原行为不受影响。
- daily / weekly report schema 不因推荐入口被删除或重命名。
- visual-console 与 visual-console:web 仍可在无 LLM key 环境启动。
- 旧 artifact 缺字段时进入 `legacy_degraded` 或 `artifact_unavailable`，不伪造完整推荐。

## 实施就绪判断

本框架已经冻结：

- V1 产品表面：请求解释卡、主结果轨、次结果轨、失败 / 澄清卡。
- V1 一等结果范围：`daily_project` 与 `weekly_trend`。
- V1 口语白名单和超域优先级。
- V1 查询意图词典。
- 项目 / 趋势对象范围选择规则。
- 高冲突澄清门槛。
- 主结果数量上限。
- 候选池来源与排序依据。
- 输出 TypeScript 契约。
- `rules-only` 与 LLM 边界。
- 失败语义与测试策略。

因此下一步可以对本设计做正式 design review；通过后即可拆 ExecPlan，而不需要实现阶段重新决定产品边界。
