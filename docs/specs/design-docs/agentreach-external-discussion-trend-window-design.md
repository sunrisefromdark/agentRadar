# AgentReach 外部讨论趋势窗口设计

## 文档状态

- 状态：`Approved for ExecPlan`
- 日期：`2026-07-03`
- 范围：`AgentReach external discussion trend window`
- 修订记录：`2026-07-03` 根据设计审核补齐 canonical artifact、字段派生、方向级 weekly gate 和趋势阈值硬约束。
- 复审记录：`2026-07-03` Design Review 复审通过，可生成对应 exec-plan。
- 对应需求：`docs/specs/product-specs/外部发现与补证信号层需求分析.md`
- 关联设计：
  - `docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md`
  - `docs/specs/design-docs/agentreach-candidate-explanation-enhancement-design.md`
- 关联现有实现：
  - `src/externalDiscovery/types.ts`
  - `src/externalDiscovery/aggregate.ts`
  - `src/externalDiscovery/dailyIntegration.ts`
  - `src/externalDiscovery/agentReachProvider.ts`
  - `src/externalDiscovery/entityRegistry.ts`
  - `src/externalDiscovery/explanations.ts`
  - `src/action/weeklyEnhancement.ts`
  - `src/action/weeklyReport.ts`
  - `src/visualConsole/build.ts`

本文只冻结设计，不修改代码，不生成 exec-plan，不清理运行产物。

## 1. Summary

AgentReach 目前已经能够把上游外部信号转换为单日 `DailyExternalAggregate`，并产出 `observation_candidates`、`project_evidence`、`direction_evidence`、`platform_counts`、`named_registry_actors`、`audit` 等字段。这个能力可以回答“今天外部层发现了什么”和“哪些候选获得了外部证据”，但还不能稳定回答需求文档中的另一个核心问题：这波外部讨论是偶发噪声，还是正在形成持续趋势。

本设计新增一个只消费最近 7 天 `DailyExternalAggregate[]` 的结构化趋势窗口：`ExternalDiscussionTrendWindow`。它不重新调用 AgentReach 上游，不读取 raw provider input，不改变主榜评分，不让 LLM 直接裁决趋势。它只把已有按日外部聚合进一步整理为项目级和方向级的外部讨论趋势事实，供 weekly、run-summary 和 `/agentreach` UI 只读展示。

设计结论：

1. 外部讨论趋势必须基于 7 日按日窗口，而不是单日 aggregate 或一次 LLM 摘要。
2. 趋势判断使用 rules-first 组件：讨论量、持续天数、跨平台确认、讨论者层级、绑定可信度、噪声风险。
3. LLM 只能解释结构化趋势事实，不能决定 `momentum` 或 `verdict`。
4. 趋势窗口只能作为次级证据，不参与 `ScoreBreakdown.total_score`、`discussion_score`、主源多源确认或主榜排名。
5. 项目级趋势和方向级趋势必须分开表达；未绑定明确 repo / paper / product 的方向讨论不能伪装成项目结论。

## 2. Goals / Non-goals

### Goals

- 支持“外部讨论强度与持续性”的 7 日窗口表达。
- 区分项目级外部补证趋势与方向级观察趋势。
- 判断单平台单日爆发、跨平台确认、多日持续、头部讨论者参与之间的差异。
- 为 weekly 提供外部讨论强化证据，帮助回答“某个方向是否在外部讨论层面也在强化”。
- 为 `/agentreach` UI 提供稳定只读字段，用于展示“今日快照”和“近 7 日讨论趋势”。
- 保留 `ok / partial / failed / insufficient / skipped` 等状态，避免把缺失误写成无信号。
- 继续满足 public-safe、redaction、dry-run 不写盘和 raw/private 输入隔离要求。

### Non-goals

- 不新增 AgentReach 上游平台，不扩大到 YouTube、Bilibili、播客、公众号或长内容平台。
- 不让本仓库直接调用 X / Reddit / HN / 官方网页平台 API。
- 不改变 `RawSignal[]`、`NormalizedProject[]`、`ScoreBreakdown` 或主评分公式。
- 不把外部讨论趋势写成主榜高置信结论、主趋势结论或最终推荐。
- 不设计真正多月历史趋势、季节性趋势或统计显著性模型。
- 不承诺展示具体账号、机构或个人名称，除非 `named_registry_actors` 已经提供 public-safe registry 命中实体。
- 不在 UI 层重新计算趋势；UI 只能消费趋势窗口 artifact。

## 3. Existing Code References

### AgentReach 已有能力

当前 `src/externalDiscovery/types.ts` 已有以下核心字段：

- `DailyExternalAggregate`
- `ExternalEvidence`
- `ObservationCandidate`
- `ExternalNamedRegistryActor`
- `platform_counts`
- `project_evidence`
- `direction_evidence`
- `observation_candidates`
- `audit.rejected_events`
- `audit.warnings`

当前 `src/externalDiscovery/aggregate.ts` 已能基于单日事件聚合：

- `mention_count`
- `distinct_actor_count`
- `top_tier_actor_count`
- `actor_tiers`
- `actor_types`
- `platforms`
- `named_registry_actors`
- `first_seen_at`
- `last_seen_at`

这说明趋势窗口不需要重新设计底层事件 schema，第一版可以直接复用 `DailyExternalAggregate` 作为输入。

### 主榜 / 周报可借鉴模式

`docs/specs/services/scoring-engine.md` 和 `docs/specs/services/action-output.md` 冻结了几个可以借鉴的原则：

- 评分和判断必须 rules-first、evidence-first。
- Action / report 层不能重新计算分数，只展示结构化事实和证据。
- weekly 必须回答趋势抽象问题，不能退化成项目列表。
- 缺少证据时不能编造，应明确降级。

AgentReach 趋势窗口应借鉴这些原则，但不能借用主榜的 `total_score`、`final_rank` 或主源多源确认语义。

## 4. Current Gap

当前 AgentReach 后端链路的主要缺口不是“没有外部信号”，而是：

1. 只有单日 aggregate，无法判断讨论是否持续。
2. UI 可以展示候选和证据，但无法说明这是单日噪声、跨平台确认，还是 7 日持续增强。
3. weekly 还没有一个稳定的外部讨论窗口 artifact 可以消费。
4. 当前 `platform_counts`、`mention_count`、`distinct_actor_count` 分散在单日证据里，缺少跨天归并后的趋势项。
5. LLM 生成项目介绍可以改善“看不懂是什么”，但不能解决“趋势是否成立”的结构化判断。

因此，本设计新增的是一个 external discovery 内部的趋势窗口，不是 UI 美化，也不是主榜评分扩权。

## 5. System Position

新增趋势窗口位于 single-day aggregate 之后、weekly / UI 之前：

```text
AgentReach local artifact
  -> provider / adapter
  -> ExternalSignalEvent[]
  -> DailyExternalAggregate
  -> ExternalDiscussionTrendWindow
  -> weekly secondary evidence
  -> /agentreach read-only trend display
```

主链路保持不变：

```text
Primary sources
  -> RawSignal[]
  -> NormalizedProject[]
  -> ScoredProject[]
  -> DailyReport / WeeklyReport / Visual Console
```

趋势窗口可以被 weekly 引用为 secondary evidence，但不得反向污染主 scoring、主 source count 或主榜排名。

## 6. Data Contract

### 6.1 输入

趋势窗口只读取最近 7 天的 public-safe aggregate：

```text
data/external-discovery/YYYY-MM-DD.aggregate.json
```

窗口锚点为 `anchor_date`，读取范围为：

```text
window_start = anchor_date - 6 days
window_end = anchor_date
window_days = 7
```

输入约束：

- 只读取 `DailyExternalAggregate`。
- 不读取 `data/raw/external-discovery/**`。
- 不调用 AgentReach CLI 或平台 API。
- 不读取 provider raw `text`、handle、profile URL 或私有 diagnostics。
- 缺失某一天 aggregate 时记录为 missing day，不把 missing day 当作无讨论。

### 6.2 输出 artifact

趋势窗口 canonical artifact 固定为：

```text
data/external-discovery/windows/YYYY-MM-DD.discussion-trend-window.json
data/external-discovery/windows/latest.discussion-trend-window.json
```

实现阶段不得再改为 `data/external-discovery/YYYY-MM-DD.discussion-trend-window.json` 或其他平铺路径。原因是趋势窗口是 aggregate 的二级派生 artifact，放入 `windows/` 可以避免与单日 aggregate 混淆。

Writer / reader 规则固定如下：

- 唯一 writer：external discovery trend window builder。
- 允许 reader：weekly secondary evidence builder、run-summary / verify、visual console read model。
- 禁止 reader：主 scoring、normalization、primary source freshness gate。
- `latest.discussion-trend-window.json` 只能指向最近一次成功写入的 public-safe trend window。
- 当 date-specific trend window 缺失时，UI / weekly 必须表达 `not_found` 或 `insufficient`，不得回退读取 raw input。
- 当 `latest` 存在但 date-specific 文件不存在时，date route 不能静默读取 latest；只能在用户显式请求 `latest` 时读取 latest。
- `dry-run` 只能报告 planned write path，不得写入 date-specific 文件或 latest 指针。

### 6.3 `ExternalDiscussionTrendWindow`

```ts
interface ExternalDiscussionTrendWindow {
  schema_version: "external-discussion-trend-window.v1";
  anchor_date: string;
  window_start: string;
  window_end: string;
  window_days: 7;
  generated_at: string;

  status: ExternalTrendWindowStatus;
  status_reason?: string;

  project_trends: ExternalTrendItem[];
  direction_trends: ExternalTrendItem[];

  coverage: ExternalTrendCoverage;
  audit: ExternalTrendAudit;

  public_safe: true;
  redaction_policy_version: string;
  contains_raw_text: false;
  contains_profile_urls: false;
}

type ExternalTrendWindowStatus =
  | "ok"
  | "partial"
  | "failed"
  | "insufficient"
  | "skipped";
```

状态语义：

- `ok`：7 日窗口中可用 aggregate 足够，至少形成一个趋势项或明确无相关趋势。
- `partial`：部分日期或部分平台失败，但仍有可解释趋势项。
- `failed`：窗口读取或解析失败，无法形成趋势窗口。
- `insufficient`：可读数据太少，不足以做趋势判断。
- `skipped`：外部趋势窗口被显式关闭，或上游 external discovery 未启用。

### 6.4 `ExternalTrendItem`

```ts
interface ExternalTrendItem {
  trend_id: string;
  scope: "project" | "direction";
  target_key: string;
  display_name: string;
  target_url?: string;
  binding_confidence: ExternalTrendBindingConfidence;
  official_signal: boolean;
  weekly_eligible: boolean;
  weekly_gate_reasons: ExternalWeeklyGateReason[];
  weekly_gate_missing_reasons: ExternalWeeklyGateReason[];

  daily_counts: ExternalTrendDailyCount[];

  mention_count_total: number;
  active_day_count: number;
  platform_count: number;
  cross_platform_days: number;
  distinct_actor_count: number;
  top_tier_actor_count: number;
  named_registry_actors: ExternalNamedRegistryActor[];

  components: ExternalTrendComponent[];
  momentum: ExternalTrendMomentum;
  verdict: ExternalTrendVerdict;

  cannot_be_primary_conclusion: true;
  evidence_ids: string[];
  source_aggregate_dates: string[];
  caveats: string[];
}

interface ExternalTrendDailyCount {
  date: string;
  mention_count: number;
  source_count: number;
  platform_count: number;
  distinct_actor_count: number;
  top_tier_actor_count: number;
}

type ExternalTrendMomentum =
  | "rising"
  | "stable"
  | "spike"
  | "fading"
  | "insufficient";

type ExternalTrendVerdict =
  | "external_reinforcement"
  | "watch_signal"
  | "noise_spike"
  | "insufficient";

type ExternalTrendBindingConfidence =
  | "high"
  | "medium"
  | "low"
  | "none";

type ExternalWeeklyGateReason =
  | "cross_platform_confirmation"
  | "multi_actor_confirmation"
  | "multi_day_persistence"
  | "registry_tier_participation";
```

约束：

- `cannot_be_primary_conclusion` 固定为 `true`。
- `scope="direction"` 的趋势项不得含义漂移为项目结论。
- `named_registry_actors` 只能来自 aggregate 中的 public-safe `ExternalEvidence.named_registry_actors`。
- `evidence_ids` 必须能回到单日 `project_evidence` 或 `direction_evidence`。
- `source_aggregate_dates` 记录参与当前趋势项的日期，便于审计 missing day。
- `official_signal` 只能由 contributing evidence 的 `platforms` 包含 `official_web` 或 `official_blog` 得出，不能由 LLM 文案、title 或项目名推断。
- `weekly_eligible` 表示该趋势项是否允许进入 weekly 正文的外部讨论趋势区；不等于主榜确认。
- `weekly_gate_reasons` 与 `weekly_gate_missing_reasons` 只记录上方四个 frozen reason，不得写自由文本。

### 6.4.1 字段派生与来源映射

趋势窗口不得从 raw provider input、UI 状态或 LLM 自由文本中临时拼字段。以下字段来源固定：

| 字段 | 生产者 | 来源优先级 | 缺失行为 | 禁止事项 |
| --- | --- | --- | --- | --- |
| `trend_id` | trend window builder | `${scope}:${target_key}` 的稳定 hash 或稳定拼接 | 缺失即 rejected，reason=`trend_item_unstable_target_key` | 不得使用数组下标或随机 ID |
| `display_name` | trend window builder | 1. public aggregate 未来若提供 display name，使用该字段；2. repo-like `target_key` 提取 `owner/repo`；3. topic key 转为可读 label；4. 最后回退 `target_key` | 不得为空 | 不得使用 raw title、raw text 或 LLM 生成名 |
| `target_url` | trend window builder | 1. public aggregate 未来若提供 target URL；2. canonical repo target key 可确定 repo URL 时派生 | 缺失则省略 | 不得读取 raw provider URL 补齐 |
| `binding_confidence` | trend window builder | `scope="project"` 且 target key 可确定 repo / paper / product 为 `medium`；public aggregate 未来提供明确绑定字段时可为 `high`；`scope="direction"` 为 `low`；target key 不稳定为 `none` | 缺失即按 `none` 处理并加 caveat | 不得由 LLM 或 title 猜测绑定 |
| `source_count` | trend window builder | V1 固定为 contributing `event_ids` 去重数量 | 可为 0，仅在 evidence 为空时 | UI 不得把它翻译为“独立来源 URL 数” |
| `mention_count` | trend window builder | contributing `ExternalEvidence.mention_count` 求和 | 无 evidence 时为 0 | 不得从 title 或摘要重新计数 |
| `platform_count` | trend window builder | contributing `ExternalEvidence.platforms` 去重数量 | 无 evidence 时为 0 | 不得把 partial 平台当作 0 信号 |
| `distinct_actor_count` | trend window builder | contributing `ExternalEvidence.distinct_actor_count` 求和后按 public-safe actor identity 去重；若无法跨 evidence 去重，必须保守使用单日最大值并加 caveat | 缺失时为 0 并加 caveat | 不得用 provider raw handle 去重 |
| `top_tier_actor_count` | trend window builder | registry 命中的 `named_registry_actors.entity_id` 去重数量 | 缺失时为 0 | `provider_tier_hint` 不得参与 |
| `official_signal` | trend window builder | contributing evidence 的 `platforms` 包含 `official_web` 或 `official_blog` | 默认为 `false` | 不得由项目名、标题、LLM 文案推断 |
| `caveats` | trend window builder | coverage、binding、gate、partial、public-safe 检查的结构化结果 | 无 caveat 时为空数组 | 不得把 caveat 只留给 UI 临时生成 |

如果实现阶段发现 `DailyExternalAggregate` 无法提供上述 public-safe 来源，必须先扩展 aggregate contract 和测试，再生成趋势窗口；不得由 UI、LLM 或 raw input 补洞。

### 6.5 `ExternalTrendCoverage`

```ts
interface ExternalTrendCoverage {
  expected_dates: string[];
  loaded_dates: string[];
  missing_dates: string[];
  failed_dates: Array<{
    date: string;
    reason_code: string;
    reason_detail: string;
  }>;
  usable_day_count: number;
  platform_counts: Partial<Record<ExternalPlatform, number>>;
  partial_platforms: ExternalPlatform[];
}
```

Coverage 必须区分：

- 日期缺失。
- aggregate 文件存在但解析失败。
- aggregate status 为 `partial`。
- 平台 partial。
- 可用天数不足。

### 6.6 `ExternalTrendAudit`

```ts
interface ExternalTrendAudit {
  rejected_items: Array<{
    scope?: "project" | "direction";
    target_key?: string;
    reason_code: string;
    reason_detail: string;
  }>;
  warnings: Array<{
    reason_code: string;
    reason_detail: string;
  }>;
}
```

典型 reason code：

- `window_aggregate_missing`
- `window_aggregate_parse_failed`
- `window_usable_days_insufficient`
- `trend_item_single_day_single_platform`
- `trend_item_unstable_target_key`
- `direction_without_stable_topic_key`
- `project_trend_unbound`
- `named_actor_registry_empty`
- `named_actor_registry_miss`

## 7. Project vs Direction Normalization

趋势窗口必须先区分项目级和方向级：

### 项目级趋势

满足以下条件之一可进入 `project_trends`：

- 单日 evidence 的 `scope="project"`。
- 目标有稳定 `target_key`，且可绑定 repo / paper / product。
- `ObservationCandidate.candidate_kind` 为 `project | paper | product`，且不是 `qualification="direction_observation"`。

项目级趋势仍然只是外部补证或观察候选，不等于主榜项目成立。

项目级 `weekly_eligible` 规则：

- `verdict="external_reinforcement"` 时可进入 weekly 正文外部补证区。
- `verdict="watch_signal"` 时只进入 weekly 的观察 / 次级证据区，不得写入主趋势确认段。
- `verdict="noise_spike"` 或 `insufficient` 只能进入 audit 或 UI 风险提示，不进入 weekly 正文正向材料。

### 方向级趋势

满足以下条件之一进入 `direction_trends`：

- 单日 evidence 的 `scope="direction"`。
- `target_type="topic"`。
- `ObservationCandidate.candidate_kind="direction"`。
- `qualification="direction_observation"`。

方向级趋势必须显示 caveat：

```text
尚未绑定明确项目，不能作为项目级结论。
```

英文 UI 可对应：

```text
Not bound to a specific project yet; use as a direction-level watch signal only.
```

方向级 `weekly_eligible` gate 固定为 4 选 2。只有满足以下四个收敛条件中的至少两个，方向级趋势才允许进入 weekly 的方向观察区：

1. `cross_platform_confirmation`：同一 `target_key` 在 7 日窗口内至少出现于 2 个 V1 外部平台。
2. `multi_actor_confirmation`：同一 `target_key` 至少有 2 个 public-safe 可区分 actor 参与；若无法跨 evidence 去重，则必须用保守口径并加 caveat。
3. `multi_day_persistence`：同一 `target_key` 在 7 日窗口内至少有 2 个 active day。
4. `registry_tier_participation`：同一 `target_key` 至少有 1 个 registry 命中的 `core / proven / watch` actor 参与。

方向级趋势的消费边界：

- 满足 2 个及以上 gate reason：`weekly_eligible=true`，可进入 weekly 方向观察区，但仍只能表达为方向级观察。
- 只满足 1 个 gate reason：`weekly_eligible=false`，可在 `/agentreach` UI 中作为低置信观察或 audit 提示展示，不进入 weekly 正文。
- 满足 0 个 gate reason：`weekly_eligible=false`，默认归为 `noise_spike` 或 `insufficient`，仅进入 audit。
- `provider_tier_hint` 不得满足 `registry_tier_participation`。
- 单个 HN 高热标题若无法形成多日、多主体、跨平台或 registry 命中，不得进入 weekly 方向观察区。

## 8. Component Design

趋势窗口不使用主榜 `ScoreBreakdown`，但可以采用组件化解释方式。每个 `ExternalTrendItem.components` 包含：

```ts
interface ExternalTrendComponent {
  name: ExternalTrendComponentName;
  level: "none" | "low" | "medium" | "high";
  evidence: string[];
}

type ExternalTrendComponentName =
  | "discussion_volume"
  | "persistence"
  | "cross_platform_confirmation"
  | "actor_authority"
  | "binding_confidence"
  | "noise_risk";
```

### `discussion_volume`

表达 7 日窗口总提及量。第一版只做桶化，不做复杂统计：

- `none`：`mention_count_total = 0`
- `low`：`1-2`
- `medium`：`3-5`
- `high`：`>=6`

### `persistence`

表达持续天数：

- `none`：`active_day_count = 0`
- `low`：`active_day_count = 1`
- `medium`：`active_day_count = 2-3`
- `high`：`active_day_count >= 4`

### `cross_platform_confirmation`

表达跨平台确认：

- `none`：`platform_count <= 1`
- `medium`：`platform_count >= 2`
- `high`：`platform_count >= 2` 且 `cross_platform_days >= 2`

### `actor_authority`

表达“谁在讨论”的分层质量：

- `none`：无可识别 actor。
- `low`：只有普通或 unknown actor。
- `medium`：有 distinct actor 多主体讨论。
- `high`：存在 registry 命中 `core / proven / watch` 的具名讨论者。

`provider_tier_hint` 不得参与 `actor_authority=high`。

### `binding_confidence`

表达对象绑定质量：

- 项目级且可绑定 repo / paper / product：`medium` 或 `high`。
- 方向级或 unbound：`low`。
- 不稳定 target key：`none`，并进入 audit 或 caveat。

### `noise_risk`

表达噪声风险。它是风险组件，不是正向分：

- `high`：满足以下任一条件：
  - `active_day_count = 1` 且 `platform_count = 1` 且 `top_tier_actor_count = 0` 且 `official_signal=false`。
  - `binding_confidence="none"` 或 target key 不稳定。
  - `mention_count_total >= 3` 但 `max_daily_share >= 0.80` 且无跨平台确认。
- `medium`：不满足 high，且满足以下任一条件：
  - `mention_count_total <= 2`。
  - `platform_count = 1`。
  - `binding_confidence="low"`。
  - 窗口状态为 `partial`。
- `low`：不满足 high / medium，且满足以下至少一项：
  - `active_day_count >= 2`。
  - `platform_count >= 2`。
  - `top_tier_actor_count >= 1`。
  - `official_signal=true`。

其中 `max_daily_share = max(daily_counts[].mention_count) / mention_count_total`；当 `mention_count_total=0` 时，`noise_risk` 必须为 `high` 或该项进入 `insufficient`。

## 9. Momentum / Verdict Rules

### Momentum

`momentum` 只基于 7 日结构化计数，不由 LLM 判断。以下列表是用户语义简述，实际实现必须以后方硬阈值为准。

- `rising`：后 3 日提及量高于前 4 日，且 `active_day_count >= 2`。
- `stable`：至少 3 个活跃日，且没有明显单日尖峰。
- `spike`：只有 1 个活跃日，或单日提及量占总量的 `>= 70%`。
- `fading`：前 4 日明显高于后 3 日，且后 2 日无新增。
- `insufficient`：可用天数不足，或有效计数不足。

上述自然语言必须按以下硬阈值实现：

- 先计算：
  - `early_loaded_days`：窗口前 4 天中成功 loaded 的天数。
  - `late_loaded_days`：窗口后 3 天中成功 loaded 的天数。
  - `early_avg = early_mentions / early_loaded_days`；若 `early_loaded_days=0`，该项为 `insufficient`。
  - `late_avg = late_mentions / late_loaded_days`；若 `late_loaded_days=0`，该项为 `insufficient`。
  - `max_daily_share = max(daily_counts[].mention_count) / mention_count_total`。
- `insufficient` 优先级最高：`usable_day_count < 3` 或 `mention_count_total < 2`。
- `spike`：不满足 insufficient，且 `active_day_count = 1` 或 `max_daily_share >= 0.70`。
- `rising`：不满足 insufficient / spike，且 `active_day_count >= 2`，并且 `late_avg >= max(early_avg + 1, early_avg * 1.5)`。
- `fading`：不满足 insufficient / spike，且 `active_day_count >= 2`，并且 `early_avg >= max(late_avg + 1, late_avg * 1.5)`，且窗口最后 2 个已 loaded 日期的 `mention_count` 均为 0。
- `stable`：不满足以上条件，且 `active_day_count >= 3` 且 `max_daily_share < 0.60`。
- 剩余情况归为 `insufficient`，不得勉强归为 stable。

阈值作为 V1 frozen constants；后续若需要配置化，必须另行设计，不得在本 exec-plan 中临时调整。

### Verdict

`verdict` 是外部层内部的次级判断标签，不是主榜结论。

#### `external_reinforcement`

适用于已有对象获得外部趋势补证：

- `scope="project"`。
- 目标可绑定 repo / paper / product。
- `active_day_count >= 2`。
- 满足以下至少一项：
  - `platform_count >= 2`
  - `top_tier_actor_count >= 1`
  - 有 official signal。
- `noise_risk` 不是 `high`。
- `weekly_eligible=true`。项目级 `weekly_eligible` 可由本 verdict 自动成立，但仍不能进入主榜确认。

#### `watch_signal`

适用于值得继续观察但不足以确认的信号：

- 项目级或方向级均可。
- 满足以下至少一项：
  - `active_day_count >= 2`
  - `platform_count >= 2`
  - `top_tier_actor_count >= 1`
- 但绑定、持续性或证据数量不足以进入 `external_reinforcement`。

方向级趋势第一版最高只能到 `watch_signal`，不能成为 `external_reinforcement`。

方向级 `watch_signal` 若 `weekly_eligible=false`，只能在 `/agentreach` UI 中作为低置信观察或 audit 提示展示，不得进入 weekly 正文。

#### `noise_spike`

适用于短促噪声：

- `active_day_count = 1`。
- `platform_count = 1`。
- `top_tier_actor_count = 0`。
- 无官方信号。

#### `insufficient`

适用于：

- 数据窗口不足。
- 缺失日期过多。
- target key 不稳定。
- 单日 aggregate 本身 failed / partial 过多，无法形成趋势判断。

## 10. 7-Day Window Read Semantics

### 可用天数

V1 固定口径：

- `usable_day_count >= 5`：可正常判断。
- `usable_day_count = 3-4`：窗口状态为 `partial`，趋势项可产出但必须带 caveat。
- `usable_day_count < 3`：窗口状态为 `insufficient`，不输出强判断。

### 缺失日期

缺失日期不得被当作 0 信号。UI 和 weekly 应表达：

```text
近 7 日外部窗口不完整，以下趋势仅基于可用日期。
```

### Partial 平台

当某天 aggregate status 为 `partial`，趋势窗口必须继承 partial 信息。不能把 X / Reddit / HN 的失败写成“无讨论”。

## 11. Weekly Consumption

Weekly 只消费 `ExternalDiscussionTrendWindow` 或 7 日 `DailyExternalAggregate[]` 派生出的同一结构，不直接读取 raw input。

Weekly 可使用的字段：

- `project_trends[].verdict`
- `direction_trends[].verdict`
- `momentum`
- `active_day_count`
- `platform_count`
- `top_tier_actor_count`
- `named_registry_actors`
- `caveats`
- `evidence_ids`

Weekly 不得使用外部趋势做以下事情：

- 改变主榜 `total_score`。
- 让方向级趋势升级为项目级高置信结论。
- 把 `external_reinforcement` 写成主源确认。
- 把 `noise_spike` 作为正向趋势材料。

Weekly 推荐表达：

```text
外部讨论补证：该项目在近 7 日出现多日外部讨论，并有跨平台或具名讨论者参与，可作为次级证据继续观察。
```

方向级推荐表达：

```text
方向观察：该主题在近 7 日外部讨论中出现持续或跨平台信号，但尚未绑定明确项目，只作为方向级观察。
```

## 12. UI Consumption

`/agentreach` UI 只能读取趋势窗口 view-model，不得在 React 或 SSR 中重新计算趋势。

推荐 UI 展示层级：

1. 顶部保留今日外部发现总览。
2. 主工作区继续展示候选列表和候选详情。
3. 在详情页增加轻量“近 7 日外部讨论”区块。
4. 底部或侧栏弱化展示方向级趋势，不抢主候选区注意力。

V1 UI 展示方式固定为“详情页轻量补充”，不是新建宽屏趋势 dashboard：

- 候选详情页显示一条紧凑的 `近 7 日外部讨论` 摘要行，最多展示 `momentum`、`active_day_count`、`platform_count`、`verdict`。
- 展开详情时展示 components、gate reasons、caveats 和具名讨论者摘要。
- 方向级趋势只进入弱化区或折叠区，不作为页面主排序入口。
- `noise_spike` 不在 weekly 正文正向展示；UI 可在候选详情中作为风险提示展示。
- 趋势区不存在时，保留今日候选和证据主结构，并显示“近 7 日趋势窗口尚不可用 / 数据不足”。

趋势文案建议：

- `近 7 日外部讨论`
- `讨论势头`
- `持续天数`
- `跨平台`
- `谁在讨论`
- `趋势判断`
- `仍属次级证据`

禁止 UI 文案：

- 不显示 `score` 作为趋势主指标。
- 不显示“主榜结论”“高置信推荐”。
- 不把 `partial` 写成“无信号”。
- 不把 `named_registry_actors=[]` 写成“没有人讨论”；应写成“没有可公开具名展示的讨论者”。

## 13. LLM Boundary

LLM 可以用于：

- 把 `ExternalTrendItem` 的结构化字段总结为短文案。
- 解释“为什么值得看”。
- 把多个 caveats 改写成更易读的中文/英文。
- 生成 UI 的简短项目/方向解释。

LLM 不可以用于：

- 决定 `momentum`。
- 决定 `verdict`。
- 直接生成 `active_day_count`、`platform_count`、`top_tier_actor_count`。
- 编造项目用途、讨论者身份、机构名称或跨平台确认。
- 在没有结构化证据时输出“趋势正在形成”。

如果 LLM 不可用，趋势窗口仍必须能 rules-only 生成结构化结果；UI 只降级为模板文案。

## 14. Public-Safe / Audit / Failure States

趋势窗口是 public aggregate 的派生物，也必须满足 public-safe：

- `public_safe=true`
- `contains_raw_text=false`
- `contains_profile_urls=false`
- 不包含 provider raw `text`
- 不包含 raw handle
- 不包含 profile URL
- 不包含 cookie / token / session / OAuth / password
- 不包含私有 provider diagnostics

失败状态必须进入 artifact：

- 无 aggregate：`insufficient` 或 `skipped`
- aggregate 解析失败：`partial` 或 `failed`
- 可用天数不足：`insufficient`
- 单平台 partial：`partial`
- public-safe 检查失败：`failed`

Verify 阶段应检查：

- 趋势窗口是否只读取 public aggregate。
- 是否包含 forbidden raw 字段。
- 是否把外部趋势写入主 score。
- 是否把方向级趋势写成项目级结论。
- 是否缺少 coverage / audit。

## 15. Test & Review Plan

### Unit Tests

- 7 日 aggregate merge：同一 `target_key` 跨天合并。
- missing day：缺失日期进入 coverage，不当作 0。
- partial aggregate：窗口状态变为 partial。
- insufficient window：可用天数不足时不输出强判断。
- canonical artifact path：只写入 `data/external-discovery/windows/*.discussion-trend-window.json`。
- field derivation：`display_name / target_url / source_count / official_signal / binding_confidence` 不从 raw input、UI 或 LLM 生成。
- project / direction separation：方向级不会进入项目级 trends。
- single-platform spike：输出 `noise_spike`。
- multi-day signal：输出 `watch_signal`。
- multi-day + cross-platform project：输出 `external_reinforcement`。
- direction weekly gate：方向级趋势必须满足 4 选 2 才能 `weekly_eligible=true`。
- registry actor：`named_registry_actors` 只来自 public-safe registry 命中。
- provider hint：不得产生 `actor_authority=high`。
- redaction：趋势窗口不含 raw text / profile URL / token 类字段。

### Integration Tests

- weekly 只读趋势窗口或 daily aggregate，不读 raw input。
- weekly 输出 external secondary evidence，不改主 score。
- `/agentreach` view-model 只消费趋势窗口字段，不在 UI 侧重算。
- `dry-run` 只报告 planned writes，不写趋势窗口 artifact。

### Review Checks

- 与需求文档一致：外部层仍为次级信号。
- 与现有 AgentReach 设计一致：raw input local-only，public aggregate 可公开消费。
- 与主榜评分 spec 一致：不新增 score component，不改 `discussion_score`。
- 与 action-output spec 一致：weekly 输出趋势抽象，但不重新计算分数。

## 16. Risks / Non-blocking Future Questions

### Risks

- 7 日窗口对真实外部讨论仍可能较稀疏，早期经常得到 `insufficient`。
- X / Reddit partial 会降低趋势可信度，用户可能误以为是无讨论。
- 方向级 topic key 若不稳定，会导致趋势碎片化。
- 单平台 HN 高热容易形成 spike，但不一定代表持续趋势。
- 如果 UI 过度强调趋势卡片，用户可能误读为主榜结论。

### Non-blocking Future Questions

以下问题不阻塞本设计进入 exec-plan，且不得在 V1 实现中临时改变本文已冻结契约：

1. 方向级趋势未来是否需要单独维护 topic registry？V1 继续使用现有 topic key 归一规则；无稳定 topic key 的方向项不得进入 weekly。
2. 趋势阈值未来是否需要配置化？V1 使用本文 frozen constants；配置化必须另行设计。
3. UI 是否在后续版本中提供独立趋势页？V1 仅在 `/agentreach` 详情页和弱化区只读展示。

## 17. Rollout Plan

本设计建议分三阶段实施：

### Phase 1：后端趋势窗口 artifact

- 新增 `ExternalDiscussionTrendWindow` 类型。
- 新增 7 日 aggregate reader。
- 新增 trend item builder。
- 新增 component / momentum / verdict rules。
- 新增 public-safe / coverage / audit 测试。

### Phase 2：Weekly secondary consumption

- weekly 读取趋势窗口。
- weekly 输出项目级补证和方向级观察趋势。
- verify 检查外部趋势不污染主 score。

### Phase 3：UI read-only display

- `/agentreach` 读取趋势窗口 view-model。
- 候选详情展示“近 7 日外部讨论”。
- 方向观察区展示低优先级趋势列表。
- UI 只做展示，不重算趋势。

## 18. Acceptance Criteria

- 系统能基于最近 7 天 `DailyExternalAggregate[]` 生成 `ExternalDiscussionTrendWindow`。
- 趋势窗口只写入 `data/external-discovery/windows/YYYY-MM-DD.discussion-trend-window.json` 与 `latest.discussion-trend-window.json`。
- 趋势窗口能表达持续天数、跨平台、讨论者层级、噪声风险和 caveats。
- 项目级和方向级趋势分开输出。
- 单日单平台爆发被标记为 `noise_spike`，不会成为趋势强化。
- 多日或跨平台信号可进入 `watch_signal`。
- 已绑定项目且满足多日 / 跨平台 / 头部讨论者条件时，可进入 `external_reinforcement`。
- 方向级趋势必须满足 4 选 2 gate 才能进入 weekly 方向观察区。
- `display_name / target_url / source_count / official_signal / binding_confidence` 的来源符合字段派生表，不由 raw input、UI 或 LLM 补齐。
- 所有趋势项都带 `cannot_be_primary_conclusion=true`。
- LLM 不参与趋势裁决；无 LLM key 时仍可 rules-only 产出。
- weekly 只把趋势窗口作为次级证据，不改变主榜评分和排名。
- public-safe / redaction 检查通过。

## 19. Explicit Non-Regression

实现本设计后，下列行为必须保持不变：

- `RawSignal.source` 不新增 external provider。
- `ScoreBreakdown.total_score` 公式不变。
- `discussion_score` 不消费 external evidence。
- external raw input 默认 local-only，不被公开提交。
- `DailyExternalAggregate` 仍可独立用于今日外部发现页面。
- `/agentreach` UI 仍可在没有趋势窗口时展示今日候选和证据，并以空态或 partial 状态说明趋势窗口不可用。
