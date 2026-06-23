# 外接 AgentReach 真实 Runner 消费闭环设计

## 文档状态
- 状态：`Approved for ExecPlan`
- 需求来源：[外部发现与补证信号层需求分析](../product-specs/外部发现与补证信号层需求分析.md)
- 依赖实现基线：已提交 bridge `781c897`
- 设计范围：外接 AgentReach runner -> AgentRadar consumer -> daily / weekly / 浏览器展示契约
- 非目标：继续扩写旧大草稿、实现旧 `src/agentReach/*` producer、重新引入 web-search / X live provider / Visual Console WIP、改变主 score
- 现有 `src/agentReach/*` 代码如继续保留，只能视为 legacy / WIP / local smoke 路径；其迁移或退场关系留给后续 exec-plan，不在本设计中升级为正式发布链路。

## 0. 设计结论

这份文档只冻结一件事：**bridge 已存在之后，AgentRadar 如何把外接 AgentReach 的真实 runner 结果稳定地消费成可降级、可审计、可展示的外部发现与补证闭环**。

它不是外接搜索实现本身，也不是旧 producer 的重写版本。外接 AgentReach 负责真实联网、初步归一化和方向偏好；AgentRadar 负责协议调用、public-safe 校验、artifact 映射、daily / weekly 聚合和展示语义。

如果本文件与旧的大草稿冲突，以本文件为准。

## 1. 需求对齐

需求分析里已经冻结的边界，在本设计里保持不变：

- 外部层是**次级判断信号**，不是主裁决链路。
- daily 和 weekly 都消费外部层，但消费语义不同。
- 外部层必须可降级，主产物不能因外部层失效而失败。
- `direction_labels` 必须稳定、可 canonicalize、可审计。
- `direction_labels` 不能污染主 score、`discussion_score` 或主源多源确认。
- 外部层必须支持项目级对象和方向级对象两种表达。
- V1 平台范围固定为 `X / Twitter`、`Reddit`、`Hacker News`、`official web / blog`。
- artifact / TypeScript 层 canonical platform id 固定为 `x_twitter`、`reddit`、`hacker_news`、`official_web`、`official_blog`；其中 `official web / blog` 的展示语义在结构层拆为 `official_web` 与 `official_blog` 两个 coverage platform。
- `Web Search`、`RSS`、`External Import` 这类词只表示 ingress / import 方式，不是新的 V1 平台名；如后续使用，必须映射到上面的 V1 平台语义，不能扩张平台闭集。
- 最终 artifact 的 coverage platform 只能落到上述 V1 平台语义；runner / provider / source mechanism 不能直接作为 coverage platform。
- 其中 `X / Twitter`、`Reddit`、`Hacker News` 主要承载讨论与发现信号，`official web / blog` 主要承载补证与发布确认信号。
- GitHub 不属于 external layer。

## 2. 外接 Runner 合同

Runner 合同只写到接口边界，不写外接 AgentReach 内部搜索策略。

### 2.1 输入

`AgentReachGatewayRequest` 作为唯一任务级请求：

- `intent`
- `platforms`
- `topic` / `query`
- `actors`
- `time_window`
- `max_results`
- `budget`
- `allowed_evidence_classes`
- `public_safety_mode: "public_safe_only"`

设计冻结点：

- 不包含 backend 实现细节。
- 不包含 OpenCLI、平台账号、cookie、session、OAuth、token、local path。
- `topic` / `query` 只能是 public-safe 的任务主题、摘要或 query id，不能包含 raw compiled platform query、用户私有输入、认证上下文或 runner 私有参数。
- 不允许把平台原文、stderr、raw exception 直接带回 public artifact。

### 2.2 输出

`AgentReachLocalRunnerResult` 作为唯一 runner 结果：

- `provider_run_id`
- `generated_at`
- `gateway_status`
- `configured`
- `query`
- `requested_platforms`
- `coverage`
- `observations`
- `rejected_items`
- `diagnostics.warnings`

设计冻结点：

- runner 可以建议 `direction_labels`，但不能直接决定标签 canonicalization 结果。
- runner 可以返回 coverage、rejected items 和 diagnostics，但这些字段都必须经过 public-safe 校验。
- 输出中的 `query` 只能保留 public-safe 摘要或 query id，不能回传平台原始查询串、用户私有输入或完整请求参数。
- `configured=false` 不能被解释成“没有外部讨论”，只能解释成未配置或未启用。
- runner 崩溃、输出非 JSON、schema 不合法或 public-safe 校验失败时，provider status 统一落为 `failed`；只有明确未启用、未配置或 opt-out 未运行时才使用 `skipped`。

### 2.3 Runner 到 artifact 的映射

`AgentReachLocalRunnerResult` 只是 runner 输出层，最终仍要映射到现有 `agent-reach.external-discovery.v1` artifact，再由 consumer 生成 daily / weekly 聚合。

冻结映射关系：

- `observations` -> canonical events / artifact items
- `coverage` -> artifact coverage
- `gateway_status` -> provider status
- `rejected_items` -> diagnostics / audit
- `diagnostics.warnings` -> safety / audit warnings
- `direction_labels` -> consumer 侧 canonicalization 后的方向标签

设计要求：

- 不新增第二套平行 artifact schema。
- 不让 runner 绕过 consumer 直接写入主 score 或主结论。
- 任何映射规则都必须保持旧 artifact reader 可读。
- 后续 exec-plan 必须拆出字段级映射表，至少覆盖 `direction_labels`、`topic_hint` / `topic_key`、actor identity hash、coverage status 与 `rejected_items.reason_code` 的落点。

## 3. Coverage 与状态语义

### 3.1 Platform coverage

V1 冻结的 coverage 状态集合为：

- `ok`
- `partial`
- `zero_relevant_results`
- `not_configured`
- `manual_import_only`
- `unavailable`
- `failed`

语义边界：

- `ok`：平台搜索成功，且有可用结果。
- `partial`：平台有部分可用结果，但也有部分被拒绝、截断或不完整。
- `zero_relevant_results`：平台搜索**真实执行成功**，但没有相关结果。
- `not_configured`：该平台后端未配置或未启用。
- `manual_import_only`：该平台仅支持手工导入，不做 live 采集。
- `unavailable`：平台或后端当前不可用。
- `failed`：请求、执行、输出或 schema 失败。

### 3.2 顶层 provider status

顶层 provider status 仍只表达本次 runner / artifact 是否可消费：

- `ok`
- `partial`
- `skipped`
- `failed`

设计冻结点：

- `zero_relevant_results` **不等于** `failed`。
- `zero_relevant_results` **不等于** `not_configured`。
- `zero_relevant_results` **不等于** `unavailable`。
- 成功执行但无相关结果时，顶层状态仍可保持 `ok`，平台 coverage 用 `zero_relevant_results` 表达。

冻结状态映射：

| runner / gateway 状态 | configured | 顶层 provider status | platform coverage 语义 |
| --- | --- | --- | --- |
| `ok` | `true` / omitted | `ok` | 使用 runner 返回的 coverage；成功但无相关结果的平台必须用 `zero_relevant_results` |
| `partial` | `true` / omitted | `partial` | 部分平台可用，失败 / 不完整 / 无结果平台分别保留自己的 coverage status |
| `failed` | any | `failed` | 请求、执行、输出、schema 或 public-safe 失败的平台为 `failed` |
| `not_configured` | any | `skipped` | 未配置 / 未启用的平台为 `not_configured` |
| `skipped` | any | `skipped` | 明确 opt-out 或未运行；不得解释为无外部讨论 |
| `unavailable` | `true` | `failed` | backend 已配置但当前不可用；平台 coverage 为 `unavailable` |
| `unavailable` | `false` / omitted | `skipped` | backend 未配置或未启用；平台 coverage 为 `not_configured` 或 `unavailable`，由 runner 明示 |

### 3.3 兼容性

- 旧 sanitized fixtures 或旧 artifact 没有 `zero_relevant_results` 时，consumer 仍必须能读取。
- 新 status 是后续实现目标，不破坏旧 artifact 的可读性。
- 缺失的 platform coverage 只能作为兼容降级信息处理，不能被悄悄解释成“没有外部讨论”。
- 这是对现有 coverage/status 合同的兼容扩展，不是第二套 schema；如果代码里已有 TypeScript union，应在原 union 上扩展，而不是另起一套兼容分支。
- `zero_relevant_results` 只表示“真实执行成功但无相关结果”，不产生 observation，也不应把 accepted count 算成非 0。
- 后续实现必须保留至少一组 legacy compatibility fixture / test，覆盖旧 `status="ok" + reason="zero_relevant_results"` 或缺少新 coverage status 的 artifact 仍可读，且不会被解释成未配置或无外部讨论。

## 4. Label / Topic / Tags 边界

### 4.1 分层关系

- `direction_labels`：稳定方向语义，供偏好、聚合、展示和审计使用。
- `tags`：普通辅助标签，可保留技术能力、形态和自由分类。
- `topic_hint`：自由文本输入。
- `topic_key`：canonical 聚合键。

设计冻结点：

- `direction_labels` 只能进入 canonical event / aggregate，不能直接进主 score。
- `tags` 不能自动升级为方向标签。
- `topic_hint` 不能直接等价于 `topic_key`。
- 技术能力词如 `agent-runtime`、`mcp`、`browser-agent` 默认只作 `tags`，不自动归入 `direction_labels`。

### 4.2 方向标签集合

V1 的初始方向标签集合是一个**显式闭集**，只包括以下标签：

```text
research-agent
literature-review-agent
research-data-analysis-agent
academic-writing-agent
office-agent
personal-assistant-agent
office-productivity-agent
document-agent
spreadsheet-agent
meeting-agent
workflow-automation-agent
vertical-office-agent
legal-agent
finance-agent
sales-crm-agent
hr-agent
healthcare-admin-agent
education-agent
enterprise-ops-agent
```

冻结规则：

- 以上标签是 V1 唯一可直接进入 canonical event / aggregate 的方向标签集合。
- 任何新增方向标签都必须通过后续独立设计和 exec-plan 冻结，不能默认混入 V1。
- 新方向必须先映射到该闭集中的稳定 label，再进入聚合和展示。
- 未知 label 不能静默通过，必须进入审计。
- canonicalization 负责丢弃不合法 label，而不是把自由文本原样放行。

### 4.3 Actor 与 tier

- `actor_type`、`registry_tier`、`provider_tier_hint` 的边界必须分开。
- runner hint 只能作为弱信号。
- 只有维护中的实体注册表和后续 enrichment 才能给出稳定 tier。
- public artifact 里只能保留 public-safe 的 actor 语义，不保留敏感原始字段。

设计冻结点：

- V1 `actor_type` 至少必须区分 `institution`、`team`、`person` 三类主体，并保持对现有 `community`、`unknown` 的兼容；不能收缩成单一桶，也不要引入新词 `individual` 去替换现有 `person`。
- V1 `registry_tier` 至少必须区分 `core`、`proven`、`watch` 三层语义，不能退化成只有“有/无”。
- 只有命中维护中的实体注册表且带稳定 tier 标签的对象，才可参与“头部讨论”判断与 `registry_tier_participation` gate。

## 5. Daily / Weekly Consumer Contract

### 5.1 Daily

daily 的职责是把外部 artifact 消费成：

- project-level external evidence
- direction-level observation candidates
- external diagnostics / audit

daily 可以表达：

- 新发现了什么
- 哪些已有候选获得了外部补证
- 哪些方向出现了稳定外部讨论

但 daily 不能：

- 把外部热度伪装成主源事实
- 把 direction-level 观察伪装成项目级结论
- 把未配置 / 无结果 / 失败混成同一个“空”状态
- 把 `zero_relevant_results` 误算成有意义的接受样本或自动制造 observation

### 5.2 Weekly

weekly 只消费 7 日窗口内已生成的 `DailyExternalAggregate[]`。

V1 冻结的周度 gate 为 4 个：

- `cross_platform_confirmation`
- `multi_actor_confirmation`
- `multi_day_persistence`
- `registry_tier_participation`

接受规则：

- 至少满足 2 个 gate 才能形成 weekly direction observation。
- `cross_platform_confirmation` 至少要求同一项目级对象或方向级对象出现在 2 个不同的 V1 平台上。
- `multi_actor_confirmation` 至少要求 2 个经过 canonicalization 的不同 public-safe actor。
- `multi_day_persistence` 至少要求在 7 日窗口内出现于 2 个不同自然日。
- `registry_tier_participation` 只统计命中维护实体注册表且带 tier 标签的讨论对象，原始 handle 或自由文本作者名不计入。

设计冻结点：

- weekly 只做方向级强化，不做主裁决。
- weekly 的 external cross-platform confirmation 不是 primary-source multi-source confirmation。
- direction-level observation 必须显式标注“不能成为主结论”。

### 5.3 Consumer 输出语义

consumer 层应保持这些可见结果：

- `direction_label_counts`
- `weekly_direction_observations`
- `external_project_evidence_summaries`
- `external_cross_platform_confirmations`
- `direction_gate_audit`

这保证 daily 和 weekly 都能解释“谁在讨论、讨论是否持续、是否跨平台”，但不会污染主 score。
- 底层统计口径仍应以事件为单位，daily 负责按日聚合，weekly 只负责消费最近 7 日窗口的 daily 聚合结果，不得把 weekly 改写成唯一统计层。

## 6. 浏览器展示契约

这里写的是**展示语义**，不是视觉方案。
具体页面可以后置重做成新的分项页；本设计只冻结必须展示的状态和语义，不冻结旧页面布局。

浏览器必须能看到：

- runner 状态
- per-platform coverage
- accepted / rejected 数量
- 真实 observation
- project-level 补证摘要
- direction-level observation
- failed / skipped / zero_relevant_results / not_configured / manual_import_only 的明确原因

展示边界：

- 不能把 `zero_relevant_results` 显示成 `not_configured`
- 不能把 `not_configured` 显示成 `no signal`
- 不能把 `failed` 显示成正常结果
- 不能让外部层看起来像主源确认

浏览器可以继续沿用现有 overview / run health / weekly 视图，但本设计不定义具体布局、卡片样式或交互细节。

## 7. 公共安全与审计

外接 runner 和 consumer 必须默认 public-safe。

设计要求：

- 不写入 token、cookie、session、OAuth、raw stderr、raw exception。
- 不把未脱敏 handle、profile url、原始长文本直接放进 public artifact。
- 必要时使用不可逆 identity hash，而不是原始账号态字段。
- 任何不安全字段必须被拒绝，并在 diagnostics / warnings 里留下安全的审计痕迹。

这条边界的目标是：**可消费、可回放、可审计，但不泄露私有上下文**。

补充验收口径：

- 当某个平台为 `zero_relevant_results` 时，顶层 status 仍可为 `ok`，但该平台的 accepted / observation 计数必须保持为 0。
- `zero_relevant_results` 只能通过 coverage 语义对外表达，不能被浏览器或汇总层误读成“未配置”或“无信号”。

## 8. 范围外内容

以下内容不属于本设计：

- 旧 `src/agentReach/*` producer 的继续扩展
- 现有 `src/agentReach/*` 代码可以继续作为 legacy / WIP / local smoke 存在，但不得被本设计升级为正式发布链路的一部分
- web-search / X live provider / Reddit legacy provider 的重新混入
- 多 provider registry
- 直接接平台 API 的 AgentRadar 实现
- 修改主 score 公式
- 新增未同步 spec / config / tests 的 score component
- Video / podcast / 长内容平台扩展
- Visual Console 的具体 UI 重构方案

这些内容如果后续要做，必须另开 exec-plan，不得在本文件里顺手展开。

## 9. 给后续 Exec-Plan 的交接点

后续 exec-plan 应当围绕这几个代码面收口：

- `zero_relevant_results` 的类型与消费兼容
- runner / adapter 的状态映射
- weekly gate 和 direction observation 的稳定测试
- 浏览器展示语义的补齐
- 真实 live runner 的手动 smoke 验证

本设计文档只负责把边界说死，不负责把实现步骤拆完。
