# 执行计划：AgentReach 外部发现页面 UI

## 文档状态

- 版本：`v0.1`
- 当前状态：`Proposed`
- 负责人：`Codex`
- 风险等级：`Medium`
- 关联需求：
  - `docs/specs/product-specs/外部发现与补证信号层需求分析.md`
- 关联设计：
  - `docs/specs/design-docs/agentreach-external-discovery-page-ui-design.md`
- 说明：本计划只承接 `/agentreach` 前端展示实现，不新增后端 schema，不新增平台查询，不修改主评分、主榜单、daily / weekly 主结论或 AgentReach 后端消费链路。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | AgentReach 外部发现页面 UI |
| 用户目标 | 基于真实 `DailyExternalAggregate` 字段重新实现 `/agentreach` 页面，风格接近 Observer / 新兴潜力项目页面 |
| 主要影响面 | `src/visualConsole/*`、`app/visualConsole/*`、`app/client/*`、`app/server.ts`、`app/styles.css`、`src/__tests__/*`、`docs/specs/exec-plans/README.md` |
| 交付目标 | 新增一级 `/agentreach` 页面，中文导航为“外部发现”，展示候选、详情、证据来源、讨论来源画像与平台 coverage 状态 |

## 目标

1. 新增独立 `/agentreach` 页面，并在中文导航中以“外部发现”展示，位置固定在“新兴潜力项目”右侧。
2. 新增 display-only view-model adapter，优先消费 `DailyExternalAggregate`，把后端字段映射为稳定中文 UI 文案。
3. 页面采用 Observer 风格的居中窄版工作台：Hero、筛选与状态区、5 张总览卡、左侧候选列表、右侧详情面板、底部弱化平台状态。
4. 候选列表支持筛选、排序、分页和选中态；点击左侧候选时，右侧详情必须切换。
5. 右侧详情展示对象绑定、外部关注度、证据、来源、独立来源、讨论来源画像、证据聚合、证据来源和只读/禁用动作。
6. 明确表达外部层是 secondary-only 信号，不替代 GitHub / Trendshift 主链路，不单独形成高置信主结论。
7. 覆盖 `ok / partial / failed / empty` 四类 deterministic fixture，避免真实外部结果漂移导致回归不可测。

## 设计对齐

| 设计章节 | 本计划承接位置 | 实施要求 |
| --- | --- | --- |
| `Goals / Non-goals` | `目标`、`边界约束` | 只做前端展示，不新增 schema、live search、主评分或 Observer 写入桥接 |
| `Data Contract / Field Mapping` | `Phase 1`、`Phase 2` | 固定 `DailyExternalAggregate` 为主数据源，daily section 仅 fallback，run summary 只补状态 |
| `Page IA / Layout` | `Phase 4`、`Phase 5` | 六段结构、左候选右详情、底部状态条、导航位置必须落地 |
| `Component Design` | `Phase 2`、`Phase 5` | 新增 AgentReach view-model、候选列表、详情、讨论来源画像和证据来源组件 |
| `States & Empty / Failed UX` | `Phase 3`、`Phase 5` | provider 状态和 platform coverage 状态分开表达，failed 不渲染成空列表 |
| `Reuse From Observer` | `Phase 4`、`Phase 5` | 复用 Observer 的布局和交互模式，不复用字段语义、score、tracking form 或搜索框 |
| `Interaction Rules / Responsive Rules` | `Phase 5`、`Phase 6` | 候选点击联动、分页、筛选、移动端单列和 chips 横向滚动必须可测 |
| `Visual Acceptance Criteria` | `Phase 6`、`验收标准` | 不宽屏 dashboard，不营销页，不自由搜索，不出现 `证据强度` |
| `Test & Review Plan` | `Phase 0`、`Phase 6` | 先准备 4 类 deterministic fixture，再实现 view-model / route / presentation 测试 |

## 边界约束

### 允许修改

- `src/visualConsole/types.ts`
- `src/visualConsole/readLayer.ts`
- `src/visualConsole/build.ts`
- 允许新增 `src/visualConsole/agentReachViewModel.ts` 或同职责文件
- `app/visualConsole/ossTypes.ts`
- `app/visualConsole/ossRouting.ts`
- `app/visualConsole/ossDocument.ts`
- `app/visualConsole/copy.ts`
- `app/visualConsole/ossCopy.ts`
- `app/visualConsole/ossPages.ts`
- `app/visualConsole/clientScript.ts`
- `app/server.ts`
- `app/client/mount.tsx`
- 允许新增 `app/client/AgentReachView.tsx`
- `app/styles.css`
- `src/__tests__/*`
- `docs/specs/exec-plans/README.md`
- 本执行计划文档自身

### 禁止修改

- 不修改 `src/externalDiscovery/types.ts` 的 canonical schema。
- 不修改 `DailyExternalAggregate`、`ObservationCandidate`、`ExternalEvidence`、`ExternalEvidenceSource` 的字段语义。
- 不修改主榜评分、`total_score`、`discussion_score`、GitHub / Trendshift 主链路排序或主结论生成逻辑。
- 不新增 AgentReach live search、平台 API 查询、自由搜索框、浏览器实时搜索或后台轮询。
- 不把 run summary 当作候选或证据主体。
- 不直接读取 `candidate.platforms`，因为 `ObservationCandidate` 没有该字段。
- 不把 `first_seen_at / last_seen_at` 放到 source card 上；source card 只能使用 `source_published_at / observed_at`。
- 不展示后端不存在的 `points` 字段。
- 不把 `加入观察` 做成可提交动作；没有桥接前只能显示 `待接入观察`、disabled 或只读动作。
- 不复用 Observer 的 repo score、star/fork/issues/PR 指标、tracking form、搜索框或 `presetBucket` 语义。

### 数据源约束

1. 页面主体读取优先级固定为：
   - `DailyExternalAggregate`
   - daily report `external_discovery` section fallback
   - run summary `external_discovery` 只补状态、coverage、warnings 和路径提示
2. 若 `DailyExternalAggregate` 与 daily section 同时存在且不一致，页面主体以 aggregate 为准，并在 audit / 平台状态区展示 warning。
3. daily section fallback 缺少 `evidence_sources` 时，不得补假 source；只能降级展示候选、项目 evidence、方向 summary 和 coverage，并显示“来源明细不可用”的 warning。
4. `独立来源` 口径固定为关联 evidence 的 `distinct_actor_count` 最大值，不跨 evidence 简单求和。

## 当前状态

1. AgentReach 后端链路已能产出 `DailyExternalAggregate` 相关字段，包括 `observation_candidates`、`project_evidence`、`direction_evidence`、`evidence_sources`、`platform_counts`、`audit.coverage`。
2. 旧 `/agentreach` UI 曾出现 mock-only、来源为 0、右侧详情不联动、布局与参考图偏离等问题；本计划以 `agentreach-ui-redesign-v2` worktree 中的新设计文档为准，不叠加旧 UI WIP。
3. Observer / 新兴潜力项目页面已经有可参考的卡片、分页、选中态、详情面板和移动端体验。
4. 当前阶段只生成 exec-plan，不开始代码实现。

## 已落地内容

- `docs/specs/design-docs/agentreach-external-discovery-page-ui-design.md` 已完成并通过设计审核，可作为本计划上游设计。
- 本 exec-plan 已落盘，当前尚未开始代码实现。
- 后续实施时必须按阶段更新本节，至少分组记录：
  - view-model / read layer 已落地内容
  - route / navigation / payload 已落地内容
  - React 页面与交互已落地内容
  - CSS / responsive 已落地内容
  - fixture / tests / verification 已落地内容

## 文件结构与职责切分

### 视图模型层

- 新增或修改 `src/visualConsole/agentReachViewModel.ts`
  - 构建 `AgentReachViewModel`。
  - 负责输入选择、字段映射、索引构建、候选派生字段、summary cards、coverage chips、warnings。
  - 不改 canonical artifact，不产生新判断，不改后端 score。
- 修改 `src/visualConsole/readLayer.ts`
  - 新增 `getDailyExternalAggregate(date)` 或同职责 reader。
  - 路径必须使用 `src/externalDiscovery/paths.ts` 中的 `externalAggregatePath(date)`，不得在 view-model 中手写路径。
  - 返回统一 `ReadResult<DailyExternalAggregate>`，保留 `not_found / parse_error / unsupported_context` 语义。
- 修改 `src/visualConsole/types.ts`
  - 增加 `agentreach` route/view 类型。
  - 增加 AgentReach display-only view-model 类型。
- 修改 `src/visualConsole/build.ts`
  - 接入 `buildAgentReachView`。
  - 读取 daily context 中的 aggregate / daily section / run summary fallback。
  - 保持其他页面的 view-model 不变。

### 路由与文档渲染层

- 修改 `app/visualConsole/ossTypes.ts`
  - 将 `agentreach` 加入 `WebRoute`。
  - 将 `agentreach` 加入 `RenderedRoute` discriminated union，model 类型为 AgentReach view-model。
- 修改 `app/visualConsole/ossRouting.ts`
  - 增加 `/agentreach` route normalization、href 和 title。
  - 保留 `lang`、`theme`、`date` 查询参数。
- 修改 `app/visualConsole/copy.ts` 与 `app/visualConsole/ossCopy.ts`
  - 增加中文 `navAgentReach` 或同等 copy key，文案固定为“外部发现”。
  - 增加英文 `AgentReach` 或 `External Discovery` 文案。
  - 不把中文主导航继续写成 `AgentReach`。
- 修改 `app/visualConsole/ossDocument.ts`
  - 顶部导航增加“外部发现”，位置在“新兴潜力项目”右侧。
  - 中文环境禁止显示 `AgentReach` 作为主导航文案。
  - `routeIntent` 必须增加 `agentreach`，中文表达为“先看外部层发现了什么候选，再看证据来自哪里。”或等价语义。
- 修改 `app/visualConsole/ossPages.ts`
  - 为 `/agentreach` 生成 React hydration payload 或 SSR fallback。
- 修改 `app/visualConsole/clientScript.ts`
  - 把 `/agentreach` 纳入客户端导航、payload prefetch 和 route 白名单。
- 修改 `app/server.ts`
  - `/agentreach` 需要 React runtime 时，接入 payload script 与 hydration。

### React 组件层

- 新增 `app/client/AgentReachView.tsx`
  - 负责 Hero、筛选与状态区、总览卡片、候选列表、详情面板、底部状态条。
  - 只消费 `AgentReachViewModel`。
  - 实现候选筛选、排序、分页、选中态和详情切换。
  - 证据来源较多时在详情内部滚动或局部分页。
- 修改 `app/client/mount.tsx`
  - 增加 `agentreach` hydration 入口。

### 样式层

- 修改 `app/styles.css`
  - 增加 `agentreach-*` 独立 class。
  - 视觉参考 `observer-*`，但不污染或重定义 Observer 样式。
  - 实现浅蓝背景、白色卡片、紫色强调、橙/绿状态 chip、圆角卡片、窄版居中布局。
  - 保证候选列表、详情面板、底部状态条不出界。

### 测试与 fixture 层

- 新增 `src/__tests__/visualConsoleAgentReachFixtures.ts`
  - 提供 `ok / partial / failed / empty` 四类 deterministic fixture。
- 新增 `src/__tests__/visualConsoleAgentReachViewModel.test.ts`
  - 验证字段映射、来源反查、独立来源口径、fallback 降级、warnings。
- 新增 `src/__tests__/visualConsoleAgentReachRoute.test.ts`
  - 验证 `/agentreach` route、导航位置、查询参数保留和 React payload 接入。
- 新增 `src/__tests__/visualConsoleAgentReachPresentation.test.ts`
  - 验证中文文案、状态表达、无禁用词、无 fake action、empty/failed UX。
- 可选扩展现有 web/visual 测试
  - 覆盖移动端单列、chips 横向滚动、候选点击切换详情和分页。

## 阶段进度

| 阶段 | 状态 | 设计映射 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：计划与 fixture 前置 | `Proposed` | `Test & Review Plan` | 4 类 deterministic fixture 定义完成，旧 UI WIP 边界确认 |
| Phase 1：route 与类型壳 | `Proposed` | `Existing Code References`、`Top Nav` | `/agentreach` route 类型、导航、href 保参和 payload 白名单接入 |
| Phase 2：AgentReach display-only view-model | `Proposed` | `Data Contract / Field Mapping` | 候选、证据、来源、coverage、summary cards 和 warnings 可由真实字段稳定生成 |
| Phase 3：状态与降级表达 | `Proposed` | `States & Empty / Failed UX` | ok / partial / failed / empty 均有可测试 UI 状态 |
| Phase 4：React 页面与 Observer 风格复用 | `Proposed` | `Page IA / Layout`、`Reuse From Observer` | 页面六段结构、左候选右详情、分页和详情联动完成 |
| Phase 5：视觉与响应式收口 | `Proposed` | `Responsive Rules`、`Visual Acceptance Criteria` | 桌面/移动布局、chips 滚动、文本不出界、按钮不越界 |
| Phase 6：回归验证与文档账本 | `Proposed` | `Test & Review Plan` | AgentReach UI 单测、route 测试、presentation 测试和必要回归通过 |

## 实施步骤

### Phase 0：计划与 fixture 前置

1. 确认当前工作区为 `D:\AgentRadar\worktrees\agentreach-ui-redesign-v2`，分支为 `codex/agentreach-ui-redesign-v2`。
2. 读取并冻结以下材料：
   - `docs/specs/product-specs/外部发现与补证信号层需求分析.md`
   - `docs/specs/design-docs/agentreach-external-discovery-page-ui-design.md`
   - `app/client/ObserverView.tsx`
   - `app/styles.css` 中 `observer-*` 样式
   - `src/externalDiscovery/types.ts`
   - `src/types.ts`
3. 新增 deterministic fixtures，至少覆盖：
   - `ok`：多个候选、项目 evidence、方向 evidence、source cards、跨平台与 actor 分布。
   - `partial`：至少一个 platform partial、至少一个 platform ok，候选仍可展示。
   - `failed`：provider failed，有 `status_reason` 和 `audit.coverage`，不能渲染为空列表。
   - `empty`：provider 非 failed，候选为空，coverage 仍可见。
4. fixture 必须 sanitized，不包含 raw text、未脱敏账号、profile URL、cookie、token、session、password 或 OAuth。
5. 不使用真实实时 AgentReach 结果替代 deterministic fixture。

### Phase 1：route 与类型壳

1. 在 `src/visualConsole/types.ts` 增加 `agentreach` 顶级 view / route 类型。
2. 在 `app/visualConsole/ossTypes.ts` 增加 `agentreach`：
   - `WebRoute`
   - `RenderedRoute`
3. 在 `app/visualConsole/ossRouting.ts` 增加 `/agentreach`：
   - `normalizeRoutePath("/agentreach")`
   - `toViewHref("agentreach")`
   - `routeTitle("agentreach")`
   - `buildRoute("agentreach")`
4. 在 `app/visualConsole/copy.ts` 与 `app/visualConsole/ossCopy.ts` 增加导航 copy：
   - 中文固定为 `外部发现`
   - 英文可为 `AgentReach` 或 `External Discovery`
5. 在 `app/visualConsole/ossDocument.ts` 更新导航顺序：
   1. 首页
   2. 项目库
   3. 本周趋势
   4. 数据状态
   5. 新兴潜力项目
   6. 外部发现
6. `routeIntent` 增加 `agentreach`，文案表达外部发现证据工作台语义。
7. 中文导航文案固定为“外部发现”；英文可为 `AgentReach` 或 `External Discovery`。
8. 确认 href 保留 `lang`、`theme`、`date`，并在需要时保留 `source_view`。
9. 在 `app/server.ts`、`app/visualConsole/ossPages.ts`、`app/visualConsole/clientScript.ts` 和 `app/client/mount.tsx` 接入 `agentreach` React payload。
10. 保证其他路由导航和产品生态相关路由不受影响。

### Phase 2：AgentReach display-only view-model

1. 新增 `buildAgentReachView` 或等价函数。
2. 在 `src/visualConsole/readLayer.ts` 新增 aggregate reader：
   - 函数名建议为 `getDailyExternalAggregate(date)`。
   - 使用 `externalAggregatePath(date)` 生成路径。
   - 返回 `ReadResult<DailyExternalAggregate>`。
   - date 校验沿用 read layer 现有 `validateDateInput` 语义。
3. 输入选择顺序固定为：
   - 优先读取 `DailyExternalAggregate`
   - aggregate 缺失或不可解析时 fallback 到 daily `external_discovery`
   - run summary 只补充 status、coverage、warnings、aggregate path
4. 建立索引：
   - `evidence_by_id: Record<string, ExternalEvidence>`
   - `sources_by_event_id: Record<string, ExternalEvidenceSource[]>`
   - `candidate.evidence_ids -> evidence -> event_ids -> sources`
5. 候选卡派生字段：
   - 类型 chip：`candidate_kind / display_bucket`
   - 对象：`target_type + scope`
   - 外部关注度：`external_attention_score`
   - 证据：`evidence_ids.length`
   - 来源：由 `ExternalEvidence.platforms` 反查，必要时从 source 兜底
   - 资格：`qualification`
   - 日报/周报：`can_enter_daily / can_enter_weekly`
   - 次级边界：`cannot_be_primary_conclusion`
6. 详情派生字段：
   - 对象绑定 URL：`target_url / repo_url / paper_url`
   - 关注度、证据、来源、独立来源
   - 绑定置信：`binding_confidence`
   - 讨论来源画像：`actor_types / actor_tiers / distinct_actor_count`
   - 跨平台确认：`cross_platform`
   - caveats
7. 独立来源口径固定为关联 evidence 的 `distinct_actor_count` 最大值，不求和。
8. source card 使用：
   - `platform`
   - `source_title`
   - `source_url`
   - `raw_event_kind`
   - `target_name / target_url`
   - `source_published_at / observed_at`
   - `metrics.likes / reposts / comments / upvotes / replies`
   - `actor_type / actor_tier`
9. 禁止生成不存在的 `points`、`candidate.platforms` 或账号/机构具体名单。

### Phase 3：状态与降级表达

1. provider 顶层状态映射：
   - `ok`：绿色 chip，正常展示候选、证据和平台状态。
   - `partial`：橙色 chip，说明哪些平台 partial，不能写成“无信号”。
   - `failed`：红色 chip，展示失败说明、coverage、warnings，不能渲染为空列表。
   - `skipped`：中性 chip，表达未执行或跳过，不写成“没有外部讨论”。
2. platform coverage 状态映射：
   - `ok` -> `正常`
   - `partial` -> `部分可用`
   - `zero_relevant_results` -> `已执行但无相关结果`
   - `not_configured` -> `未配置`
   - `manual_import_only` -> `仅手动导入`
   - `unavailable` -> `不可用`
   - `failed` -> `失败`
3. 空候选但 provider 非 failed：
   - 保留页面结构。
   - 左侧显示 `今天暂无可展示的外部候选`。
   - 右侧显示 `选择候选后查看外部证据详情` 或 `本轮没有可绑定详情的候选`。
   - 底部仍展示 coverage。
4. provider failed：
   - 顶部和底部都展示 failed 状态。
   - 候选区显示失败说明，不显示“暂无讨论”。
   - 必须展示 `status_reason`、`audit.coverage`、`audit.warnings`。
5. daily section fallback 缺 source 明细时：
   - 候选与 evidence summary 可展示。
   - source cards 显示“来源明细不可用”。
   - 底部 warning 明确 fallback 降级，不得填假 source。

### Phase 4：React 页面与 Observer 风格复用

1. 新增 `AgentReachView` React 组件。
2. 页面六段结构固定为：
   - Top Nav
   - Hero
   - 筛选与状态区
   - 总览卡片区
   - 主工作区
   - 方向观察与平台状态
3. Hero 文案固定：
   - 小 pill：`AgentReach 外部层`
   - 主标题：`外部发现`
   - 副文案：`从 X / Reddit / HN / 官方来源发现项目与补证信号，先看候选，再看证据。`
   - 边界说明：`外部信号只作为次级判断，不单独形成主结论。`
4. 筛选区不能出现自由搜索框。
5. 类型 chips：
   - `新发现`
   - `外部补证`
   - `方向观察`
   - `官方信号`
   - `待确认`
6. 来源 chips：
   - `X`
   - `Reddit`
   - `HN`
   - `官方`
7. 排序控件：
   - `关注排序`
   - `时间排序`
   - `证据排序`
8. 状态 chips 只读展示，不筛选候选。
9. 候选列表：
   - 默认选中第一页第一条。
   - 点击候选切换右侧详情。
   - 筛选后选中项不可见时，切到当前结果第一条或清空。
   - 候选多时分页，不无限拉长页面。
10. 详情面板：
   - 只读当前 `selectedCandidateId`。
   - 操作区只允许 `查看证据`、`访问来源`、`待接入观察`。
   - `待接入观察` 不提交 form，不调用 Observer tracking endpoint。

### Phase 5：视觉与响应式收口

1. `app/styles.css` 新增 `agentreach-*` 样式，参考 `observer-*` 的密度和层次。
2. 桌面布局：
   - 页面居中窄版，不做宽屏 dashboard。
   - 左侧候选约 44%，右侧详情约 56%。
   - 两列顶部对齐，视觉底部尽量对齐。
   - 右侧详情内容短时紧凑，内容长时内部滚动。
3. 总览卡：
   - 一行 5 张，窄屏自动换行。
   - 紫色用于总览或重点。
   - 绿色用于 ok / 可进入。
   - 橙色用于 partial / 待确认 / 需补证。
   - 红色只用于 failed 或主结论边界。
4. chips 横向可滚动，不能撑破容器。
5. 移动端单列顺序固定：
   - Hero
   - 筛选
   - 总览
   - 候选列表
   - 详情
   - 平台状态
6. 长项目名：
   - 候选卡单行省略。
   - 详情标题可换行。
7. 禁止视觉回归：
   - 按钮出界
   - 证据卡出界
   - 底部状态条右边缘超出主内容宽度
   - 文本重叠
   - 详情区因固定大高度产生大量空白

### Phase 6：回归验证与文档账本

1. 运行 AgentReach UI 单测：
   - `corepack pnpm test -- visualConsoleAgentReachViewModel.test.ts`
   - `corepack pnpm test -- visualConsoleAgentReachRoute.test.ts`
   - `corepack pnpm test -- visualConsoleAgentReachPresentation.test.ts`
2. 运行相关 visual-console 回归：
   - `corepack pnpm test -- visualConsole`
   - 若仓库已有更细的 web/route 单测，补跑对应测试文件；不得把 `visual-console:web` 当作自动测试命令。
3. 运行类型检查：
   - `corepack pnpm typecheck`
4. 运行 implementation preflight：
   - `corepack pnpm run code-implementation:preflight -- --check`
5. 人工浏览验证：
   - 启动本地服务：`corepack pnpm run visual-console:web`。
   - `/agentreach?lang=zh&theme=light&date=latest`
   - 中文导航显示“外部发现”，位于“新兴潜力项目”右侧。
   - 左侧候选点击后右侧详情切换。
   - failed / partial / zero_relevant_results / not_configured 文案不混淆。
   - 页面无 `证据强度`。
   - 主指标标题无 `score / sources / mentions`。
   - 没有 fake `加入观察` 写动作。
   - 浏览检查完成后停止本地服务。
6. 如果需要视觉截图，只能作为人工验收辅助，不能替代 deterministic fixture 测试。

## 验收标准

### 验收 1：`/agentreach` 独立页面可打开

- 可观测结果：`/agentreach?lang=zh&theme=light&date=latest` 正常打开。
- 成功条件：页面显示 Hero、筛选与状态区、总览卡片、候选列表、详情面板和底部平台状态。
- 失败条件：页面依赖 mock-only 数据、空白报错，或跳回其他页面。

### 验收 2：导航文案和位置正确

- 可观测结果：中文导航中出现“外部发现”。
- 成功条件：“外部发现”位于“新兴潜力项目”右侧，且保留 `lang/theme/date` 参数。
- 失败条件：中文环境仍显示 `AgentReach`，或导航位置不符合设计。

### 验收 3：真实字段映射正确

- 可观测结果：候选卡和详情来自 `DailyExternalAggregate`。
- 成功条件：来源由 `evidence_ids -> ExternalEvidence.platforms` 反查，证据来源由 `event_ids -> ExternalEvidenceSource` 反查。
- 失败条件：读取不存在的 `candidate.platforms`，导致来源为 0 或 undefined。

### 验收 4：候选点击与详情联动

- 可观测结果：点击不同候选，右侧详情内容变化。
- 成功条件：选中态、分页、筛选后的选中修正均可用。
- 失败条件：右侧详情固定不变、显示幽灵详情，或分页后详情指向不可见候选。

### 验收 5：状态与降级语义不混淆

- 可观测结果：`ok / partial / failed / empty` fixture 都有合理 UI。
- 成功条件：partial 不写成无信号，failed 不渲染为空列表，zero relevant results 不混成 failed / not configured。
- 失败条件：外部层异常被写成“暂无讨论”或页面直接空掉。

### 验收 6：讨论来源画像和证据来源符合后端能力

- 可观测结果：详情展示 actor 类型、actor tier、独立来源、source cards 和 metrics。
- 成功条件：不承诺具体账号、handle、profile URL 或机构名单命中实体；不展示不存在的 `points`。
- 失败条件：UI 展示后端没有的字段，或误把 source 时间字段和 evidence 时间字段混用。

### 验收 7：secondary-only 边界清楚

- 可观测结果：页面显式展示“外部信号只作为次级判断，不单独形成主结论”。
- 成功条件：`cannot_be_primary_conclusion` 可见，`待接入观察` 不提交数据。
- 失败条件：外部关注度被写成主榜分数、主推荐、已确认趋势或可提交加入观察。

### 验收 8：视觉与响应式达标

- 可观测结果：页面接近 Observer / 参考图风格。
- 成功条件：浅蓝背景、白色卡片、紫色强调、橙/绿状态 chip、窄版居中、左候选右详情、移动端单列。
- 失败条件：宽屏 dashboard、营销页、自由搜索主入口、按钮/文本/证据卡出界或底部状态条越界。

## 关键负例

1. 候选来源平台显示为 0，因为实现直接读取了不存在的 `candidate.platforms`。
2. 点击左侧候选后，右侧详情不变化。
3. `partial` 被写成“没有外部讨论”。
4. `failed` 被渲染成“今天暂无可展示的外部候选”。
5. `zero_relevant_results` 与 `failed / not_configured` 文案或颜色混淆。
6. 页面出现自由搜索框或触发实时平台查询。
7. 页面出现“证据强度”。
8. 主指标标题出现 `score / sources / mentions`。
9. source card 展示后端不存在的 `points`。
10. “加入观察”按钮可提交或调用 Observer tracking endpoint。
11. AgentReach 页面样式污染 Observer 页面，导致 Observer 展示回归。
12. 为通过测试而使用 mock-only 字段，不消费真实 aggregate。

## 验证矩阵

| 文件位置或类型 | 验证内容 | 验证方式或命令 | 对应设计 | 通过标准 |
| --- | --- | --- | --- | --- |
| `src/__tests__/visualConsoleAgentReachFixtures.ts` | 4 类 deterministic fixture | 单测引用 | `Test & Review Plan` | ok / partial / failed / empty 均可构建，不含 raw/private 字段 |
| `src/visualConsole/readLayer.ts` | external aggregate reader、路径与 ReadResult 语义 | `corepack pnpm test -- visualConsoleAgentReachViewModel.test.ts` | `Data Contract / Field Mapping` | 使用 `externalAggregatePath(date)`，缺失/解析失败可降级，不在 view-model 手写路径 |
| `src/visualConsole/agentReachViewModel.ts` | view-model 字段映射、来源反查、独立来源口径 | `corepack pnpm test -- visualConsoleAgentReachViewModel.test.ts` | `Data Contract / Field Mapping` | 不读不存在字段，不补假 source，不改 canonical schema |
| `app/visualConsole/ossTypes.ts`、`copy.ts`、`ossCopy.ts` | route union 与导航文案 | `corepack pnpm test -- visualConsoleAgentReachRoute.test.ts` | `Top Nav` | `agentreach` 是合法 route，中文文案固定为“外部发现” |
| `app/visualConsole/ossRouting.ts`、`ossDocument.ts` | `/agentreach` 路由与导航位置 | `corepack pnpm test -- visualConsoleAgentReachRoute.test.ts` | `Top Nav` | 中文“外部发现”在“新兴潜力项目”右侧，href 保参 |
| `app/client/AgentReachView.tsx` | 候选列表、详情联动、筛选、排序、分页 | `corepack pnpm test -- visualConsoleAgentReachPresentation.test.ts` | `Component Design / Interaction Rules` | 点击候选切换详情，筛选不触发网络请求，分页可用 |
| `app/client/AgentReachView.tsx` | 状态表达、empty / failed UX | `corepack pnpm test -- visualConsoleAgentReachPresentation.test.ts` | `States & Empty / Failed UX` | partial / failed / empty / zero relevant results 文案不混淆 |
| `app/styles.css` | 页面视觉、布局和响应式 | web/visual-console 相关测试 + 人工浏览 | `Visual Acceptance Criteria` | 无出界、无重叠、移动端单列，风格接近 Observer |
| 全仓 | 类型与回归 | `corepack pnpm typecheck`、相关 `visualConsole` 测试 | 全设计 | 类型通过，已有 Observer / 产品生态页面不回归 |
| implementation preflight | 代码实现前置门禁 | `corepack pnpm run code-implementation:preflight -- --check` | 项目实现规范 | preflight 通过 |

## 回滚策略

1. 若 `/agentreach` route 接入导致其他页面回归，先从导航隐藏该 route，但保留 view-model 与测试，等待路由修补。
2. 若 React 页面交互不稳定，保留 `/agentreach` 只读 SSR fallback，但不得退回 mock-only 字段。
3. 若证据来源反查存在边界错误，先隐藏 source cards，保留 evidence 聚合与 warning，不得生成假 source。
4. 若视觉样式污染 Observer，回退 `agentreach-*` 样式并重新隔离 class，禁止修改 Observer 语义字段来适配 AgentReach。
5. 任意回滚不得修改后端 external discovery schema、主评分或 daily / weekly 主链路。

## 当前残余风险

1. daily section fallback 缺少完整 source 明细，必须用 warning 降级展示，不能伪造来源卡。
2. `ExternalEvidence` 与 `ExternalEvidenceSource` 字段相近，实现时容易误用 `first_seen_at / last_seen_at` 到 source card。
3. 旧 UI WIP 可能仍在工作区或历史分支里，代码实现必须以本设计和本计划为准。
4. 视觉接近参考图仍需人工浏览确认，单测只能守住结构、文案和交互语义。
5. 真实 AgentReach 结果数量和平台状态会漂移，回归测试必须依赖 deterministic fixture。

## 验证记录

| 日期 | 验证项 | 结果 | 说明 |
| --- | --- | --- | --- |
| 2026-06-29 | 设计文档再次审核 | 通过，可进入 exec-plan | 已确认输入源优先级、来源反查、状态 chips、趋势降级、fixture 要求和 secondary-only 边界 |
| 2026-06-29 | ExecPlan 初稿落盘 | 待验证 | 本文件生成后需进入 ExecPlan Review Skill 审核 |
| 2026-06-29 | ExecPlan 审核修补 | 待复审 | 已补 route union/copy/readLayer 接入点，修正 `visual-console:web` 验证措辞，并增加“已落地内容”账本位 |

## 结论记录

1. 本计划只做 AgentReach 外部发现页面 UI，不扩展后端能力，也不影响产品生态开发分支。
2. 实现必须从真实 `DailyExternalAggregate` 出发，旧 mock-only UI 只能作为反例，不作为承接基础。
3. AgentReach 页面可以复用 Observer 的交互和视觉模式，但字段语义必须独立适配。
4. 若实现阶段发现需要真实“加入观察”、多日趋势图、具体账号/机构展示或 AgentReach live search，必须另开设计与 exec-plan。

## 下一阶段入口

1. 使用 `docs/specs/exec-plans/ExecPlan_ReviewSkill.md` 审核本计划。
2. 根据审核结果修补 exec-plan。
3. 审核通过后，再按 `Phase 0 -> Phase 6` 顺序实施代码。
4. 代码实施期间继续保持 AgentReach UI worktree 与产品生态分支隔离。
