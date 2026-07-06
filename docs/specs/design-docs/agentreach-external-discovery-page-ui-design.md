# AgentReach 外部发现页面 UI 设计

## 状态
- Date: 2026-06-28
- Status: Proposed
- Scope: `visual-console /agentreach page`，只覆盖 AgentReach 外部发现与补证信号的前端展示层
- 对应需求：`docs/specs/product-specs/外部发现与补证信号层需求分析.md`
- 设计基线：`codex/agentreach-foundation-clean` 已稳定的 external discovery 后端字段，以及现有 `ObserverView` 的页面体验

## Summary

新增独立的 `/agentreach` 外部发现页面，用来展示 AgentReach 外部层当天发现的项目候选、已有候选补证、方向级观察、证据来源与平台 coverage 状态。

本设计中的第一版是 UI 完成基线，不是占位 MVP。实现阶段不能只接入 mock 数据、不能只做静态页面、不能省略候选详情联动、coverage 状态、secondary-only 边界和真实字段映射。

这个页面的用户心智不是“新的主榜”，而是“外部讨论证据工作台”：

- 先看今天外部层发现了什么候选。
- 再看该候选绑定到什么对象。
- 再看证据来自哪些平台、哪些类型的人群在讨论。
- 最后看本次外部层是否完整、哪些平台 partial / failed / not configured。

页面视觉上参考现有“新兴潜力项目 / Observer”页面与当前确认的 AgentReach 效果图方向：居中窄版、浅蓝背景、白色卡片、紫色主强调、轻量 chip、左侧候选列表、右侧详情面板、底部弱化平台状态。实现不能退化成宽屏 dashboard、营销页或 mock-only 展示。

## Goals / Non-goals

### Goals

- 新增一级页面 `/agentreach`。
- 中文导航文案固定为“外部发现”，位置固定在“新兴潜力项目”右侧。
- 基于真实 external discovery 后端字段展示，不再依赖 mock-only 字段。
- 复用 Observer 页面成熟的候选列表、分页、选中态、详情面板、移动端体验和视觉语言。
- 清楚表达外部层是 secondary-only 信号：可用于发现与补证，不替代 GitHub / Trendshift 主链路，不单独形成高置信主结论。
- 在 `ok / partial / failed / skipped` 以及平台 coverage 异常时，仍保留页面结构和审计信息，让用户知道本轮外部层到底发生了什么。

### Non-goals

- 不新增后端 external discovery schema。
- 不修改 `DailyExternalAggregate`、`ObservationCandidate`、`ExternalEvidence` 或 `ExternalEvidenceSource` 的语义。
- 不修改主榜评分、`total_score`、GitHub / Trendshift 主链路排序或主结论生成逻辑。
- 不新增 AgentReach live search、平台 API 查询、自由搜索框或浏览器实时搜索能力。
- 不把单日 aggregate 包装成真正多日趋势图。
- 不在第一版承诺展示具体账号、handle、profile URL 或机构名单命中实体，除非后端 public-safe 字段明确提供。
- 不把“加入观察”伪装成已可用写动作；没有 AgentReach -> observer/tracking 桥接前只能做禁用态或只读动作。

## Existing Code References

### 页面风格与交互参考

- `app/client/ObserverView.tsx`
  - `OBSERVER_PAGE_SIZE`
  - `paginateObserverEntries`
  - `selectedKey / setSelectedKey`
  - `observer-react-candidate-stage`
  - `observer-react-detail-stage`
  - `observer-react-detail-scroll-region`
  - 移动端详情面板与 body scroll lock
- `app/styles.css`
  - `observer-*` 相关样式可作为视觉参考，但 AgentReach 应使用独立 class 命名，避免污染 Observer。

### 视图模型与投影参考

- `src/visualConsole/build.ts`
  - `buildObserverView`
  - `observerEntryToProjection`
  - `buildObserverRouteFrame`
  - daily context / navigator 的读取方式
- `src/visualConsole/types.ts`
  - `VisualConsoleView`
  - `RouteFrameModel`
  - `TopLevelViewStatus`
  - `TimeNavigatorModel`

### 路由、导航和渲染接入参考

- `app/server.ts`
  - `routeRequiresClientReactRuntime`
  - `resolveHydrationPayloadScripts`
- `app/client/mount.tsx`
  - React 页面 hydration 入口
- `app/visualConsole/ossRouting.ts`
  - `normalizeRoutePath`
  - `toViewHref`
  - `routeTitle`
  - `buildRoute`
- `app/visualConsole/ossDocument.ts`
  - 顶部导航生成
  - route intent 文案
- `app/visualConsole/ossPages.ts`
  - React props 生成与 route page 渲染方式
- `app/visualConsole/clientScript.ts`
  - route prefetch / payload prefetch / client navigation 中 route 白名单与 payload 识别

### 后端数据契约参考

- `src/externalDiscovery/types.ts`
  - `DailyExternalAggregate`
  - `ObservationCandidate`
  - `ExternalEvidence`
  - `ExternalEvidenceSource`
  - `ExternalDiscoveryCoverage`
  - `ExternalProviderStatus`
  - `ExternalCoverageStatus`

## Data Contract / Field Mapping

AgentReach UI 必须新增 display-only view-model adapter，命名为 `AgentReachViewModel` 或 `ExternalDiscoveryViewModel`。该 adapter 只做展示适配，不改 canonical artifact，不改 primary score。

### 输入来源

页面读取顺序固定如下：

1. `DailyExternalAggregate`：作为 `/agentreach` 页面主体数据源，负责候选、证据、来源和 coverage 的完整展示。
2. daily report 中已经嵌入的 `external_discovery` section：仅在 `DailyExternalAggregate` 缺失或不可解析时作为 fallback。
3. run summary 中的 `external_discovery`：只补充运行状态、summary 级 coverage、warnings 和路径提示，不作为候选与证据主体。

若 `DailyExternalAggregate` 与 daily `external_discovery` 同时存在但候选数、证据数或 status 不一致，页面主体仍以 `DailyExternalAggregate` 为准，并在底部平台状态或 audit 区显示“daily section 与 aggregate 不一致”的 warning。实现不能按数量混选不同来源，也不能把两个来源合并成后端没有的事实。

### 顶部概览字段

| UI 文案 | 字段来源 | 说明 |
| --- | --- | --- |
| 运行状态 | `status` | provider 顶层状态，允许值为 `ok / skipped / partial / failed` |
| 状态说明 | `status_reason` | 原样用于状态说明，空值时显示“外部层已执行”或“无额外说明” |
| 已采纳事件 | `accepted_event_count` | 只表达本轮进入聚合的外部事件数量 |
| 已拒绝事件 | `rejected_event_count` | 用于审计，不作为负面质量结论 |
| 外部候选 | `observation_candidates.length` | 候选列表总数 |
| 项目补证 | `project_evidence.length` | 项目级 evidence 聚合数 |
| 方向观察 | `direction_evidence.length` | 方向级 evidence 聚合数 |
| 来源平台 | `platform_counts` | 各平台 accepted event 数 |
| 平台 coverage | `audit.coverage` | 展示平台状态，不等同于候选质量 |

### 总览卡片字段

页面固定展示 5 张总览卡：

| 卡片 | 计数规则 | 文案边界 |
| --- | --- | --- |
| 总览 | `accepted_event_count` | “不同来源的外部信号总览，包括发现、补证与方向观察。” |
| 新发现候选 | `candidate_kind=new_external_discovery` 或 `display_bucket=new_discoveries` | 不写成“已确认项目” |
| 已有候选补证 | `candidate_kind=external_evidence_boost` 或 `display_bucket=project_evidence` | 表达为补充证据 |
| 方向观察 | `scope=direction` 或 `candidate_kind=direction_watch` | 表达为方向线索，不等于趋势已成立 |
| 官方确认 | `display_bucket=official_releases`，或通过 `evidence_ids -> evidence.event_ids -> evidence_sources.raw_event_kind` 命中 `official_release / blog_post` 的候选 | 表达为官方信号，不等于主源确认 |

### 候选卡字段

| UI 文案 | 字段来源 | 展示规则 |
| --- | --- | --- |
| 名称 | `display_name` | 卡片单行省略，详情展示完整可换行 |
| 类型 chip | `candidate_kind / display_bucket` | 映射为“新发现 / 外部补证 / 方向观察 / 官方信号 / 待确认” |
| 对象 | `target_type` + `scope` | project/paper/product/topic 映射为中文 |
| 外部关注度 | `external_attention_score` | 文案固定为“外部关注度”，无值显示“待评估”，禁止“证据强度” |
| 证据 | `evidence_ids.length` | 文案固定为“证据” |
| 来源 | 由 `evidence_ids -> ExternalEvidence.platforms` 反查，必要时从 `evidence_sources` 按 target 兜底 | `ObservationCandidate` 本身没有 `platforms` 字段，不能伪造 |
| 资格 | `qualification` | 映射为“观察 / 需主源确认 / 仅外部补证” |
| 进入日报 | `can_enter_daily` | 显示“是 / 否”，不能解释为已进主榜 |
| 进入周报 | `can_enter_weekly` | 显示“是 / 否”，方向候选可为周报观察 |
| 次级边界 | `cannot_be_primary_conclusion` | 若为 true，固定显示“不能作为主结论” |

候选卡底部可展示一个短线索标签，例如：

- `cross-platform`：来自关联 `ExternalEvidence.cross_platform=true`
- `observe-only`：`qualification=needs_primary_confirmation` 或 `cannot_be_primary_conclusion=true`
- `official-signal`：官方类 bucket 或 raw event

### 右侧详情字段

详情面板必须由左侧选中候选驱动，点击不同候选时右侧内容必须切换。

| UI 文案 | 字段来源 | 展示规则 |
| --- | --- | --- |
| 完整名称 | `display_name` | 可读换行，不强制单行省略 |
| 对象绑定 | `target_type / target_key / target_url / repo_url / paper_url` | 明确显示对象类型与可访问 URL |
| 外部关注度 | `external_attention_score` | 主指标之一 |
| 证据 | `evidence_ids.length` | 主指标之一 |
| 来源 | 反查 evidence platforms | 主指标之一 |
| 独立来源 | 关联 evidence 的 `distinct_actor_count` 最大值 | 中文文案为“独立来源”；避免跨 evidence 简单求和造成重复计数 |
| 绑定置信 | `binding_confidence` | 映射为 high/proven、medium/watch、low/unbound 等中文态 |
| 讨论来源画像 | evidence 的 `actor_types / actor_tiers / distinct_actor_count` | 不承诺具体账号 |
| 跨平台确认 | evidence 的 `cross_platform` | 只能表达“跨平台外部确认”，不是主源确认 |
| 进入日报 / 周报 | `can_enter_daily / can_enter_weekly` | 与主榜结论隔离 |
| 主结论边界 | `cannot_be_primary_conclusion` | 固定可见 |
| 注意事项 | `caveats` | 缺失时显示“无额外 caveat”，不隐藏边界区 |

### 证据聚合卡字段

`ExternalEvidence` 用于解释“这个候选为什么值得看”：

| UI 文案 | 字段来源 |
| --- | --- |
| 证据 ID | `evidence_id` |
| 平台 | `platforms` |
| 提及 | `mention_count` |
| 独立来源 | `distinct_actor_count` |
| 活跃天数 | `active_day_count` |
| 首次看到 | `first_seen_at` |
| 最近看到 | `last_seen_at` |
| 跨平台 | `cross_platform` |
| 权威性摘要 | `authority_summary_cn` |
| 强度摘要 | `intensity_summary_cn` |
| 持续性摘要 | `persistence_summary_cn` |
| caveats | `caveats` |

### 证据来源卡字段

`ExternalEvidenceSource` 用于解释“证据具体来自哪里”：

| UI 文案 | 字段来源 | 展示规则 |
| --- | --- | --- |
| 平台 | `platform` | X / Reddit / HN / 官方网页 / 官方博客 |
| 标题 | `source_title` | 无标题时展示平台 + raw event kind |
| 来源链接 | `source_url` | 可访问时显示“访问来源” |
| 事件类型 | `raw_event_kind` | mention / discussion / official_release 等中文化 |
| 目标 | `target_name / target_url` | 表达该来源提到的对象 |
| 发布时间 | `source_published_at` | 没有时显示“发布时间未知” |
| 观察时间 | `observed_at` | 表达 AgentReach 看到的时间 |
| 互动指标 | `metrics.likes / reposts / comments / upvotes / replies` | 不展示后端不存在的 `points` 字段 |
| 讨论者类型 | `actor_type` | 机构 / 团队 / 个人 / 社区 / unknown |
| 讨论者层级 | `actor_tier` | core / proven / watch / ordinary / unknown |

## Page IA / Layout

页面固定为六段：

1. Top Nav
2. Hero
3. 筛选与状态区
4. 总览卡片区
5. 主工作区
6. 方向观察与平台状态

### Top Nav

导航顺序固定为：

1. 首页
2. 项目库
3. 本周趋势
4. 数据状态
5. 新兴潜力项目
6. 外部发现

中文文案为“外部发现”，英文可暂用 `AgentReach` 或 `External Discovery`。中文环境禁止继续显示 `AgentReach` 作为主导航文案。

导航 href 需要保留：

- `lang`
- `theme`
- `date`
- 必要时保留 `source_view`

### Hero

Hero 采用居中窄版：

- 小 pill：`AgentReach 外部层`
- 主标题：`外部发现`
- 副文案：`从 X / Reddit / HN / 官方来源发现项目与补证信号，先看候选，再看证据。`
- 边界说明：`外部信号只作为次级判断，不单独形成主结论。`

Hero 高度不能占满首屏。桌面首屏必须能看到筛选区、总览卡片和主工作区开头。

### 筛选与状态区

筛选区不是自由搜索框，只展示候选筛选 chips、排序控件和只读状态 chips。

- 类型 chips：`新发现`、`外部补证`、`方向观察`、`官方信号`、`待确认`。这些 chips 可以筛选候选。
- 来源 chips：`X`、`Reddit`、`HN`、`官方`。这些 chips 可以按候选关联 evidence / source 平台筛选候选。
- 排序：`关注排序`、`时间排序`、`证据排序`。排序只作用于当前候选集合。
- 状态 chips：`ok`、`partial`、`failed`、`not configured`、`zero relevant results`。这些 chips 默认只读展示 provider / coverage 状态，不筛选候选。

chips 仅筛选已加载数据，不触发外部平台实时查询。

若后续要让状态 chips 参与筛选，必须另行定义“候选与 platform coverage 的绑定规则”。本设计第一版不允许把 `not_configured` 或 `zero_relevant_results` 当作候选过滤条件。

### 总览卡片区

总览卡片一行 5 张，窄屏自动换行。卡片视觉参考效果图与 Observer 的浅色卡片：

- 紫色强调用于“总览”或当前重点。
- 绿色用于 ok / 可进入。
- 橙色用于 partial / 待确认 / 需补证。
- 红色仅用于 failed 或 “不能作为主结论”边界。

### 主工作区

桌面为左右两列：

- 左侧：候选列表，约 44% 宽度。
- 右侧：候选详情，约 56% 宽度。
- 两列顶部对齐，视觉底部尽量对齐。
- 右侧详情不使用无意义固定大高度；内容较短时保持紧凑，内容较长时内部滚动。

左侧候选列表参考 Observer 卡片：

- 卡片可点击。
- 有选中态。
- 长标题单行省略。
- 卡片底部展示证据、来源、对象、cross-platform / observe-only 标签。
- 候选多时使用分页，优先参考 Observer 的分页体验；不把页面无限拉长。

右侧详情参考 Observer 详情面板，但字段独立：

- 顶部显示选中状态，如“观察中”。
- 对象绑定 URL 作为独立行展示。
- 主指标为“外部关注度 / 证据 / 来源 / 独立来源”。
- 中部展示“为什么值得看”和“当前判断和建议”。
- 下部展示“讨论来源画像”和“证据来源”。
- 操作按钮固定在详情卡内部底部。

### 底部弱化区

底部模块命名为：`方向观察与平台状态`。

展示内容：

- 今日方向快照：`direction_evidence.length`、`direction_label_counts` 与方向级候选数量。
- 待归档外部信号数量。
- `zero_relevant_results` 数量。
- `not_configured` 数量。
- `partial` 数量。
- 平台 coverage chips，例如 `X partial`、`Reddit ok`、`HN ok`、`官方 not configured`。

底部只做审计和状态提示，不抢主工作区注意力。

## Component Design

### AgentReachViewModel

新增 display-only view-model adapter，建议字段形态如下：

```ts
interface AgentReachViewModel {
  context: ViewContext;
  state: VisualConsoleState;
  time_navigator: TimeNavigatorModel;
  route_frame: RouteFrameModel;
  status: AgentReachStatusViewModel;
  summary_cards: AgentReachSummaryCardViewModel[];
  filters: AgentReachFilterViewModel;
  candidates: AgentReachCandidateCardViewModel[];
  evidence_by_id: Record<string, AgentReachEvidenceViewModel>;
  sources_by_event_id: Record<string, AgentReachEvidenceSourceViewModel>;
  coverage: AgentReachCoverageViewModel[];
  warnings: string[];
}
```

该 view-model 的职责是：

- 把 canonical 字段映射为中文 UI 文案。
- 建立 `candidate.evidence_ids -> ExternalEvidence -> evidence.event_ids -> ExternalEvidenceSource` 的反查索引。
- 计算候选卡需要的来源平台、证据数、独立来源数。
- 生成状态 chips 与 coverage chips。
- 不新增判断，不改变后端 score，不把 missing 字段填成假数据。

### 候选列表组件

候选列表组件输入只接受 `AgentReachCandidateCardViewModel[]`。

卡片固定展示：

- 类型 chip
- `display_name`
- 简短摘要：优先 `evidence_summary_cn`，其次 `display_reasons`
- `外部关注度`
- `证据`
- `来源`
- `对象`
- 次级边界标签

候选排序：

- `关注排序`：`external_attention_score` 降序，无值排后。
- `时间排序`：关联 evidence 的 `last_seen_at` 降序，无值排后。
- `证据排序`：`evidence_ids.length` 降序，之后按来源平台数。

### 详情组件

详情组件必须只读当前 `selectedCandidateId`。

详情内部分区：

1. 对象绑定
2. 指标区
3. 候选判断
4. 讨论来源画像
5. 证据聚合
6. 证据来源
7. 操作区

操作区第一版允许：

- `查看证据`
- `访问来源`
- `待接入观察`

若没有 tracking 桥接，`加入观察` 和 `加入方向观察` 必须 disabled，或文案改为 `待接入观察`。不能提交真实 form，也不能调用 Observer 的 tracking endpoint。

### 讨论来源画像组件

组件标题固定为：`讨论来源画像`。

展示：

- `actor_types` 分布：机构、团队、个人、社区、unknown。
- `actor_tiers` 分布：core、proven、watch、ordinary、unknown。
- `distinct_actor_count`：独立来源数。

不展示：

- handle
- profile URL
- 未脱敏账号名
- 后端未提供的机构名单命中实体

### 证据来源组件

证据来源卡每张显示：

- 平台图标或文字标识。
- 标题。
- 事件类型。
- 目标名称。
- 发布时间 / 观察时间。
- metrics。
- 访问来源按钮。

metrics 文案必须平台中立：

- `likes` -> `likes`
- `reposts` -> `转发`
- `comments` -> `comments`
- `upvotes` -> `upvotes`
- `replies` -> `replies`

如果用户界面需要全中文，可在后续统一翻译，但不能展示不存在的 `points`。

## States & Empty / Failed UX

状态表达必须区分 provider 顶层状态和 platform coverage 状态。

### Provider 状态

| 状态 | UI 表达 | 规则 |
| --- | --- | --- |
| `ok` | 绿色 chip | 正常展示候选、证据和平台状态 |
| `partial` | 橙色 chip | 明确说明哪些平台 partial，不能写成“无信号” |
| `failed` | 红色 chip | 显示失败说明、coverage 和 warnings，不能渲染成空列表 |
| `skipped` | 中性 chip | 表达未执行或被跳过，不写成“没有外部讨论” |

### Platform coverage 状态

| 状态 | UI 文案 | 规则 |
| --- | --- | --- |
| `ok` | 正常 | 平台正常参与 |
| `partial` | 部分可用 | 平台有部分失败或结果不完整 |
| `zero_relevant_results` | 已执行但无相关结果 | 不能和 failed / not_configured 混淆 |
| `not_configured` | 未配置 | 显示为未配置 |
| `manual_import_only` | 仅手动导入 | 显示为该平台没有自动 runner |
| `unavailable` | 不可用 | 表达平台不可用 |
| `failed` | 失败 | 显示失败原因和 warnings |

### Empty

当候选为空但 provider 非 failed：

- 保留 Hero、筛选、总览、主工作区、底部状态。
- 左侧候选区显示：`今天暂无可展示的外部候选`。
- 右侧详情显示：`选择候选后查看外部证据详情` 或 `本轮没有可绑定详情的候选`。
- 底部仍展示 coverage。

### Failed

当 provider failed：

- 顶部 status chip 显示 failed。
- 总览卡显示已采纳事件为 0 或实际值。
- 候选列表显示失败说明，不显示“暂无讨论”。
- 底部必须展示 `audit.coverage`、`audit.warnings`、`status_reason`。

## Reuse From Observer

### 可以复用

- 页面视觉密度与居中容器感觉。
- 候选卡的选中态、hover 态、分页控件。
- 左候选 / 右详情布局。
- 移动端单列和详情面板体验。
- chip、卡片、按钮和浅色背景语言。
- `paginateObserverEntries` 的分页思路，可抽成更通用 helper 或在 AgentReach 内局部复刻。

### 不能直接复用

- Observer 的 repo 字段语义。
- Observer 的 star/fork/issues/PR 指标。
- Observer 的 `observerScore` 或 `radarScore`。
- Observer 的 tracking form。
- Observer 的搜索框体验。
- Observer 的 `presetBucket` 语义。

AgentReach 只能复用“形态”和“交互模式”，不能复用“字段含义”。

## Interaction Rules

- 左侧点击候选，右侧详情必须切换。
- 默认选中第一页第一条候选。
- 当前选中候选切换筛选后若不可见，应清空选中或切到当前结果第一条，不能保留幽灵详情。
- 候选分页时，右侧详情只能展示当前页可见候选或明确提示“候选不在当前页”。
- 证据来源较多时，详情内部滚动或局部分页，不撑破页面。
- 筛选 chips 横向可滚动，不撑破容器。
- 排序切换不能触发网络请求。
- “访问来源”只打开已有 `source_url`。
- “待接入观察”不提交数据。

## Responsive Rules

### Desktop

- 页面最大宽度参考 Observer 的居中工作台，但不使用过宽 dashboard。
- 主工作区左右两列。
- 右侧详情面板随内容自适应，设置合理 `max-height` 与内部滚动。
- 两列视觉底部尽量对齐；若右侧内容短，不用硬撑出大空白。

### Tablet

- 总览卡 2-3 列换行。
- 主工作区可继续两列，但右侧宽度不得小于可读详情宽度。
- chips 横向滚动。

### Mobile

- 单列布局。
- 顺序固定：Hero -> 筛选 -> 总览 -> 候选列表 -> 详情 -> 平台状态。
- 候选列表在前，详情在后。
- 若采用抽屉式详情，需要明确返回列表入口。
- 详情按钮仍在详情卡内部，不悬浮遮挡内容。

## Visual Acceptance Criteria

- 页面整体接近确认的 AgentReach 效果图：浅蓝背景、白色卡片、紫色强调、橙/绿状态 chip、圆角卡片。
- 视觉上与 Observer / 新兴潜力项目风格一致，不出现另一个产品的割裂感。
- 不做宽屏 dashboard，不做营销页，不做自由搜索主入口。
- 首屏必须能看到主工作区开头。
- `外部关注度` 必须替代所有 `score` 主指标文案。
- 右侧主指标固定为中文：`关注度`、`证据`、`来源`、`独立来源`。
- 不出现 `证据强度`。
- 不出现 `score / sources / mentions` 作为主指标标题；平台卡内部可以保留 `likes / comments / upvotes / replies` 这类原始指标名。
- 候选列表与详情区域无文本、按钮、证据卡出界。
- 长项目名卡片单行省略，详情可换行。
- 底部状态条右边缘与主内容宽度一致。
- partial / failed / not_configured / zero_relevant_results 颜色和文案必须可区分。

## Test & Review Plan

设计进入 exec-plan 前，必须准备 4 类 sanitized deterministic fixture。真实产物切片只能作为补充人工验收，不能替代回归 fixture，因为真实外部结果会随时间漂移。

1. `ok`
   - 有多个候选。
   - 有项目级 evidence。
   - 有方向级 evidence。
   - 有 evidence sources。
2. `partial`
   - 至少一个平台 `partial`。
   - 至少一个平台 `ok`。
   - 候选仍可展示。
3. `failed`
   - provider `failed`。
   - 有 `status_reason` 和 `audit.coverage`。
   - 页面不渲染成空列表。
4. `empty`
   - provider 非 failed。
   - `observation_candidates=[]`。
   - coverage 仍可见。

实现后需要验证：

- `/agentreach?lang=zh&theme=light&date=latest` 正常打开。
- 中文导航显示“外部发现”，位置在“新兴潜力项目”右侧。
- 左侧候选点击后右侧详情切换。
- 筛选 chips 不触发网络请求。
- 候选分页可用。
- 证据来源卡显示真实 source 与 metrics。
- failed / partial / zero_relevant_results / not_configured 文案不混淆。
- 移动端单列顺序正确。
- 没有 `score / sources / mentions` 作为主指标标题。
- 没有 `证据强度`。
- 没有将外部候选写入 Observer tracking 的假动作。

建议测试文件方向：

- `src/__tests__/visualConsoleAgentReachViewModel.test.ts`
- `src/__tests__/visualConsoleAgentReachRoute.test.ts`
- `src/__tests__/visualConsoleAgentReachPresentation.test.ts`

如实现为 React 页面，还需要覆盖：

- selected candidate state
- pagination
- filter chips
- mobile detail fallback

## Risks / Open Questions

### Risk: 旧 UI WIP 与新设计混用

当前已有旧 `codex/agentreach-external-discovery-ui` 工作区。新实现必须以 `codex/agentreach-ui-redesign-v2` 为准，旧 UI 只能参考，不应直接叠加旧 mock-only 字段。

### Risk: 候选来源平台被错误读取

`ObservationCandidate` 没有 `platforms`。实现若直接读 `candidate.platforms` 会导致来源为 0 或 undefined。必须通过 `evidence_ids` 反查 `ExternalEvidence.platforms`，必要时再通过 `evidence_sources` 兜底。

### Risk: 证据来源卡误用字段

`first_seen_at / last_seen_at` 在 `ExternalEvidence` 上，不在 `ExternalEvidenceSource` 上。来源卡应使用 `source_published_at / observed_at`。

### Risk: HN points 文案

后端 metrics 当前没有 `points` 字段。若界面展示 HN points，必须先有 adapter 映射或 schema 变更。第一版只展示真实存在的 `upvotes / comments / replies`。

### Risk: “谁在讨论”被过度承诺

第一版只能展示 actor 类型与层级分布。具体机构、账号、profile URL 需要 public-safe 后端字段明确提供后才能设计。

### Risk: “趋势”被过度承诺

单日 aggregate 只能展示“今日外部讨论快照”。真正多日趋势需要 weekly 或多日 aggregate 聚合设计，不能在本页面第一版画趋势折线误导用户。

### Risk: 加入观察动作误导

没有 AgentReach -> observer/tracking 写入桥接前，“加入观察”不能是可提交动作。若后续要做真实写入，需要单独设计权限、对象类型、direction topic、repo/product/paper 的落库规则。

### Open Question: `/agentreach` 是否使用 React 页面

推荐使用 React 页面，以便复用 Observer 的选中态、分页、移动端详情体验。但如果实现成本要求更低，也可以用 SSR + 少量 client script。无论方式如何，点击候选切换详情必须可用。

### Open Question: 英文界面文案

中文是第一优先级。英文可沿用 `AgentReach` / `External Discovery`，但不阻塞中文版实现。

### Open Question: AgentReach 与 Observer 的后续桥接

本设计只保留只读/禁用动作。真实桥接需要后续独立设计：

- project / repo 候选进入 Observer tracking
- paper / product 候选进入独立观察池
- topic / direction 候选进入方向观察

这些动作不能混在本次 UI 展示设计里默认完成。
