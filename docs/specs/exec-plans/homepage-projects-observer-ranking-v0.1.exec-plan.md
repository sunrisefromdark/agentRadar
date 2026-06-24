# 执行计划：首页项目库排序与新兴潜力项目

## 文档状态

- 版本：`v0.1`
- 当前状态：`Draft / Design Approved / Pending Exec Review`
- 设计来源：
  - [首页项目库排序与新兴潜力项目设计.md](../design-docs/首页项目库排序与新兴潜力项目设计.md#L1)
  - [project-search-system-redesign-design.md](../design-docs/project-search-system-redesign-design.md#L1)
  - [trend-radar-ui-v3-stage-redesign-design.md](../design-docs/trend-radar-ui-v3-stage-redesign-design.md#L1)
  - [trend-radar-visual-console-design.md](../design-docs/trend-radar-visual-console-design.md#L1)
  - [trend-radar-visual-console-requirement-analysis.md](../product-specs/trend-radar-visual-console-requirement-analysis.md#L1)
- 上游设计门禁：
  - `首页项目库排序与新兴潜力项目设计.md` 已于 `2026-06-24` 切换为 `Approved`，本计划后续实现必须继续以该批准版本为冻结真源；若设计再次变更，必须先回写本计划再实施。
  - `project-search-system-redesign-design.md` 已于 `2026-06-12` 标记为 `Approved`，其中 `today_pulse_projects / mission_match_projects / explore_ribbon_projects / coverage_atlas / gap_ledger` 的 canonical 含义视为本计划冻结真源。
  - `trend-radar-ui-v3-stage-redesign-design.md` 当前文档头为 `Proposed for Review`，但正文已给出 `READY FOR IMPLEMENTATION PLANNING`。本计划允许引用其页面骨架作为消费层约束，但若后续 UI V3 评审对 `Overview / Projects / Observer` 骨架有改动，必须先同步本计划再实施。
- 说明：本计划只负责把“默认入口、子榜切换、候选落桶、默认降饱和、URL 组合和页面消费语义”落到现有 `daily + observer + visual console` 体系中；不新造综合总分、不新增第二套 artifact、不补造长期个性化 schema，也不把 `Observer` 改写回 `Weekly` 或热榜变体。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | 首页项目库排序与新兴潜力项目 |
| 负责人 | Codex |
| 风险等级 | `High` |
| 关联设计 | `docs/specs/design-docs/首页项目库排序与新兴潜力项目设计.md` |
| 影响范围 | `src/types.ts`、`src/visualConsole/build.ts`、`src/visualConsole/types.ts`、`src/search/projectSearchKernel.ts`、`src/search/projectSearchIndex.ts`、`src/search/fuzzyProjectSearchService.ts`、`app/server.ts`、`app/visualConsole/ossPages.ts`、`app/visualConsole/ossProjectsPage.ts`、`app/client/ObserverView.tsx`、`src/__tests__/`、`docs/specs/exec-plans/` |

## 目标

在不引入新黑盒排序系统的前提下，完成以下交付：

1. 让 `Overview`、`Projects`、`Observer` 不再默认复用同一条热榜答案，而是各自回答设计冻结的三个问题。
2. 让 `Overview` 与 `Projects` 共用 daily 候选池但消费语义不同，`Observer` 继续只消费 observer artifact 的 `entries[]`。
3. 在服务端 view projection 中稳定产出 `preset_bucket / observer_preset_bucket / utility_hint / repeat_exposure_state / head_project_exception_reason / hard_infra`，前端只消费结果，不自由猜测。
4. 落地 `Overview` 四条语义带、`Projects` 五个子榜、`Observer` 四个子榜，以及对应的 `preset_memberships`、主桶优先级、默认降饱和和缺字段降级。
5. 让 `preset`、`preferenceMode`、`sort`、`q` 的组合行为在 `Projects` / `Observer` 中成为可审计的页面状态契约，但在 router/context 正式接纳前，不越权重写基线路由语义。
6. 为默认 landing、显式搜索保护、头部项目例外、空态/折叠、兼容回退和失败降级建立单元、集成、页面行为和 artifact 验证。

## 边界约束

### 允许修改

- `src/types.ts`
- `src/visualConsole/build.ts`
- `src/visualConsole/types.ts`
- `src/search/projectSearchKernel.ts`
- `src/search/projectSearchIndex.ts`
- `src/search/fuzzyProjectSearchService.ts`
- `app/server.ts`
- `app/visualConsole/ossPages.ts`
- `app/visualConsole/ossProjectsPage.ts`
- `app/client/ObserverView.tsx`
- `src/__tests__/*`
- `docs/specs/exec-plans/*`

### 谨慎修改

- `src/visualConsole/context.ts`
  - 只允许在 router/context 基线正式接纳 `preset` 查询参数后补充解析；在那之前不得单边新增一套脱离基线的 query 语义。
- `src/action/dailyReport.ts`
  - 默认不修改。
  - 仅当实现阶段确认现有 artifact 缺少已经存在的事实字段透传时，才允许做最小透传补丁；不得新增 `preset_bucket / observer_preset_bucket / utility_hint / repeat_exposure_state / head_project_exception_reason / hard_infra` 等页面消费字段，不得把页面分发语义写回 canonical artifact。
- `app/visualConsole/renderOverview.ts`、`app/visualConsole/renderProjects.ts`
  - 仅在 `route frame / stage / rail / dock` 结构需要同步时调整，不改写业务事实来源。
- `config.yaml` / `src/config.ts`
  - 只允许加运行时开关或门限读取，不允许把子榜规则、头部例外原因码、语义带容量、唯一机器落桶顺序下放为可随意配置。

### 禁止修改

- 不新增新的综合总分、排序器、持久化 score 或第二套榜单引擎。
- 不改写 `today_pulse_projects / mission_match_projects / explore_ribbon_projects / context_only_projects / observer entries[]` 的 canonical 含义。
- 不把 `Observer` 候选池混入 daily 字段，也不把 daily 字段混入 `Observer` 自身证据链。
- 不让 `preferenceMode=preference` 扩候选、补候选或跨 `preset` 借位。
- 不允许前端根据中文文案、自由标签或启发式自行推断 `preset_bucket / observer_preset_bucket / hard_infra / head_project_exception_reason`。
- 不允许 `context_only_projects` 重新变成 `Projects` 默认 landing 主来源。
- 不允许用“字段缺失”作为理由把三页重新退回成同一条总榜。

### 兼容性约束

- `today_star_projects` 继续保留为旧 artifact/旧 reader 的兼容字段，不再作为新消费逻辑的主来源。
- `visual-console`、`visual-console:web`、`run-daily`、`verify-daily`、`recover-daily` 等现有命令名保持不变。
- `Projects` 现有 `sort=score|growth` 与 `preferenceMode=objective|preference` 继续保留；新增的是 `preset` 横轴，不是再造一条排序轴。
- 默认降饱和只影响默认 landing，不影响显式搜索命中、指定 `preset` 浏览、分页、详情直达。
- 若 router/context 尚未正式接纳 `preset`，`Projects` 与 `Observer` 只能使用页面局部状态承载当前子榜，不得读写 `preset` query，也不得借用其他现有 query 参数伪装承载 `preset`。
- 只有当 `src/visualConsole/context.ts` 与对应 reader/context 基线正式接纳 `preset` 后，`preset` 才能升级为可分享的 URL 状态。

## 设计覆盖映射

| 设计冻结项 | 落地阶段 | 主落地模块 | 验证锚点 |
| --- | --- | --- | --- |
| `Overview`/`Projects` 共用 daily 候选池，`Observer` 独立候选池 | Phase 0 / 1 | `src/visualConsole/build.ts`、`src/types.ts` | 构建层不会把 observer entries 混入 daily，也不会把 daily 混入 observer |
| `Overview` 四条语义带与容量 `2/3/2/1` | Phase 2 | `src/visualConsole/build.ts`、`app/visualConsole/ossPages.ts` | 首页首屏 `<= 8`，且四带语义可区分 |
| `Projects` 五子榜与多桶 memberships | Phase 1 / 3 | `src/visualConsole/build.ts`、`src/visualConsole/types.ts`、`app/visualConsole/ossProjectsPage.ts` | `preset_memberships` 稳定产出，`preset_bucket` 仅保留主显示桶语义 |
| `Observer` 四子榜与唯一机器落桶顺序 | Phase 1 / 4 | `src/visualConsole/build.ts`、`src/visualConsole/types.ts`、`app/client/ObserverView.tsx` | `observer_preset_bucket` 稳定产出且唯一 |
| `preferenceMode` 只在当前 `preset` 候选集内重排 | Phase 0 / 3 / 4 | `src/search/projectSearchKernel.ts`、`fuzzyProjectSearchService.ts`、页面消费层 | 切换偏好不会跨桶补位 |
| 头部项目默认降饱和与例外原因码 | Phase 1 / 2 / 3 / 4 | `src/visualConsole/build.ts`、`src/types.ts` | 默认 landing 前排不被头部统治；例外必须带原因码 |
| 缺字段降级与兼容回退 | Phase 0 / 1 / 2 / 3 / 4 | `build.ts`、页面层 | 缺字段时走空态/降级，不回退成热榜 |
| `preset/preferenceMode/sort/q` 组合规则 | Phase 0 / 3 / 4 / 5 | `context.ts`、`ossProjectsPage.ts`、`ObserverView.tsx`、`server.ts` | 搜索、排序、分页顺序符合设计 |
| view-only 字段不回写 canonical artifact | Phase 0 / 1 / 5 | `src/visualConsole/build.ts`、`src/types.ts`、测试 | `preset_bucket` 等字段只存在于 projection / view-model |
| `preset` 在基线接纳前不形成影子 query 契约 | Phase 0 / 3 / 4 / 5 | `context.ts`、页面层、测试 | 未接纳前页面只用局部状态，不解析也不写入 `preset` |

## 文件与职责

### 建议新增

- `src/__tests__/overviewProjectDistribution.test.ts`
  - 守护 `Overview` 四语义带、容量、去重、空态与头部降饱和。
- `src/__tests__/projectsPresetRouting.test.ts`
  - 守护 `preset / preferenceMode / sort / q / paginate` 的组合行为。
- `src/__tests__/observerPresetRouting.test.ts`
  - 守护 `observer_preset_bucket`、默认前排、显式搜索保护和分页顺序。
- `src/__tests__/projectPresetBucketing.test.ts`
  - 守护 `preset_bucket / hard_infra / utility_hint / repeat_exposure_state / head_project_exception_reason` 的派生规则。

### 建议修改

- `src/types.ts`
  - 为页面消费投影新增 view-only 字段类型，不扩 canonical schema 含义。
- `src/visualConsole/types.ts`
  - 扩展 `OverviewViewModel / ProjectsViewModel / ObserverViewModel` 所需的 preset、bucket、语义带与默认 landing 结构。
- `src/visualConsole/build.ts`
  - 实现唯一机器落桶、语义带分配、默认降饱和、显式搜索保护和兼容回退。
- `src/search/projectSearchKernel.ts`
  - 让 `Projects` 搜索与分页在 `preset` 候选集内执行，而不是先全局搜索再回分桶。
- `src/search/projectSearchIndex.ts`
  - 让搜索索引带上 `preset_bucket`、必要的场景/基础设施提示，但不新增第二真相源。
- `src/search/fuzzyProjectSearchService.ts`
  - 让 zero-result fuzzy 仍在当前 `preset` 候选集内工作，并把 `sort/preferenceMode` 边界保持一致。
- `app/server.ts`
  - 在只读 endpoint 中承接 `preset` 与已有排序状态，保持与页面同一候选口径。
- `app/visualConsole/ossPages.ts`
  - 重组 `Overview` 的 research stream 渲染，并让 overview React props 暴露四语义带。
- `app/visualConsole/ossProjectsPage.ts`
  - 实现 `Projects` 子榜切换、默认 landing、搜索和排序交互。
- `app/client/ObserverView.tsx`
  - 实现 `Observer` 总榜入口与子榜切换、搜索和分页。

## 当前状态

当前仓库已经具备：

- `daily report` 中的 `today_pulse_projects / mission_match_projects / explore_ribbon_projects / context_only_projects` 字段。
- `buildProjectsView()` 对 daily / observer / inventory 的聚合入口。
- `Observer` 页面现有搜索、分页和 `objective / preference` 双模式。
- `Projects` 搜索 kernel、fuzzy zero-result 扩展和现有 `sort/preferenceMode` 行为。

当前已补齐：

- `Overview` 四语义带与首页默认降饱和的正式消费模型。
- `Projects` 的 `preset_memberships`、`preset_bucket`、五子榜 landing 和主桶优先级。
- `Observer` 的 `observer_preset_bucket`、四子榜 landing 和默认前排去饱和。
- 服务端一次性产出的 `utility_hint / repeat_exposure_state / hard_infra / head_project_exception_reason`。
- `preset` 与现有搜索/排序/分页契约的一致性验证。

## 当前进度

- 设计拆解：`Done`
- ExecPlan 生成：`Done`
- 上游设计审批：`Done`
- 实施：`Done`
- 验证：`Done`

## 已落地内容

- 已完成设计与现有代码触达面盘点，确认本计划主要落点在 `visualConsole build/types / Projects 搜索状态 / Observer 页面消费`。
- 已确认现有仓库已有 `buildProjectsView()`、`buildObserverView()`、`projectSearchKernel` 和 `ObserverView`，因此 V1 应复用这些承载层，而不是新造榜单基础设施。
- 已冻结过渡期 `preset` 承载方案：在 router/context 基线正式接纳前，只允许页面局部状态承载，不允许影子 query 协议。
- 已冻结 artifact 边界：`preset_bucket / observer_preset_bucket / utility_hint / repeat_exposure_state / head_project_exception_reason / hard_infra` 只存在于 projection / view-model，不写回 canonical artifact。
- 已在 `src/types.ts`、`src/visualConsole/types.ts`、`src/visualConsole/build.ts` 落地 view-only preset projection，并让 `Overview / Projects / Observer` 拥有各自消费语义。
- 已在 `src/search/projectSearchKernel.ts`、`src/search/projectSearchIndex.ts`、`src/search/fuzzyProjectSearchService.ts` 落地 `preset` 维度，保证搜索、排序、分页都在当前子榜候选集内执行。
- 已在 `app/visualConsole/ossProjectsPage.ts`、`app/visualConsole/clientScript.ts` 落地 Projects 五子榜与总榜入口的本地状态切换；当前 preset 仍只保存在页面局部状态，不写回 URL。
- 已在 `app/visualConsole/ossPages.ts`、`app/client/ObserverView.tsx` 落地 Observer 总榜入口 + 四子榜、本地 preset 过滤，以及 Overview semantic bands 到 React props 的消费重排。
- 已补充并更新相关测试夹具与断言，覆盖 Projects preset 过滤、Observer preset 过滤、fuzzy search 与现有 observer/render 兼容性。

## 实施阶段

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：上游门禁与消费契约冻结 | `Done` | 把设计审批、query 接纳边界、字段真源和降级策略冻结清楚 | 设计变为 `Approved`，且本计划同步记录最终 gate 结论 |
| Phase 1：View-only Projection 与主桶投影 | `Done` | 在服务端投影层稳定产出 bucket、memberships 与去饱和辅助字段 | `preset_memberships / preset_bucket / observer_preset_bucket` 稳定可读，前端不再二次推导 |
| Phase 2：Overview 语义带与默认前排 | `Done` | 把首页重写成四语义带 research stream | 首页首屏 `<= 8`，头部项目默认不占第一主位 |
| Phase 3：Projects 子榜与工作台组合 | `Done` | 让 `Projects` 形成五个预设子榜 + 总榜入口 + 双模式 + 搜索/分页一致性 | 默认 landing 为 `all`，且搜索排序都在当前 `preset`/总榜候选集内完成 |
| Phase 4：Observer 子榜与潜力前排 | `Done` | 让 `Observer` 形成总榜入口 + 四个预设子榜并保住 summary/evidence/context 结构 | 默认 landing 为 `all`，Observer 候选不会因单桶预筛而被隐藏 |
| Phase 5：验证、回滚与账本收口 | `Done` | 跑通字段、页面、交互、回退与兼容验证 | 测试、CLI 和页面 smoke 能证明设计语义存活 |

## 执行记录

### Task: Phase 1：View-only Projection 与主桶投影

- Status: `DONE`
- Files Changed:
  - `src/types.ts`
  - `src/visualConsole/types.ts`
  - `src/visualConsole/build.ts`
- Verification:
  - `wsl bash -lc 'cd /home/adduser/AgentProjection/agentRadar && ./node_modules/.bin/tsc --noEmit'`
  - `wsl bash -lc 'cd /home/adduser/AgentProjection/agentRadar && ./node_modules/.bin/vitest run src/__tests__/visualConsoleSearchAlignment.test.ts src/__tests__/visualConsoleFuzzySearch.test.ts src/__tests__/fuzzyProjectSearch.test.ts src/__tests__/visualConsoleObserver.test.ts'`
- Result:
  - 已稳定产出 `preset_bucket / observer_preset_bucket / utility_hint / repeat_exposure_state / head_project_exception_reason / hard_infra`
  - 保持字段仅存在于 projection / view-model，未回写 canonical artifact

### Task: Phase 2：Overview 语义带与默认前排

- Status: `DONE`
- Files Changed:
  - `src/visualConsole/build.ts`
  - `app/visualConsole/ossPages.ts`
- Verification:
  - `wsl bash -lc 'cd /home/adduser/AgentProjection/agentRadar && ./node_modules/.bin/tsc --noEmit'`
  - `wsl bash -lc 'cd /home/adduser/AgentProjection/agentRadar && ./node_modules/.bin/vitest run src/__tests__/visualConsoleSearchAlignment.test.ts'`
- Result:
  - 首页 props 改为消费 semantic bands，并按 `mission -> pulse -> explore -> infra` 重排首屏项目
  - 首屏不再直接复用单一热榜列表

### Task: Phase 3：Projects 子榜与工作台组合

- Status: `DONE`
- Files Changed:
  - `src/search/projectSearchKernel.ts`
  - `src/search/projectSearchIndex.ts`
  - `src/search/fuzzyProjectSearchService.ts`
  - `app/visualConsole/ossProjectsPage.ts`
  - `app/visualConsole/clientScript.ts`
- Verification:
  - `wsl bash -lc 'cd /home/adduser/AgentProjection/agentRadar && ./node_modules/.bin/tsc --noEmit'`
  - `wsl bash -lc 'cd /home/adduser/AgentProjection/agentRadar && ./node_modules/.bin/vitest run src/__tests__/visualConsoleSearchAlignment.test.ts src/__tests__/visualConsoleFuzzySearch.test.ts src/__tests__/fuzzyProjectSearch.test.ts'`
- Result:
  - Projects 支持五个 preset 子榜和总榜入口的页面局部切换
  - direct search / fuzzy search / sort / paginate 都限定在当前 preset 候选集中执行

### Task: Phase 4：Observer 子榜与潜力前排

- Status: `DONE`
- Files Changed:
  - `src/visualConsole/build.ts`
  - `app/visualConsole/ossPages.ts`
  - `app/client/ObserverView.tsx`
- Verification:
  - `wsl bash -lc 'cd /home/adduser/AgentProjection/agentRadar && ./node_modules/.bin/tsc --noEmit'`
  - `wsl bash -lc 'cd /home/adduser/AgentProjection/agentRadar && ./node_modules/.bin/vitest run src/__tests__/visualConsoleObserver.test.ts src/__tests__/visualConsoleSearchAlignment.test.ts'`
- Result:
  - Observer 改为消费服务端 observer projection
  - 默认总榜 `all`，并支持四子榜本地过滤后再搜索、排序、分页

### Task: Phase 5：验证、回滚与账本收口

- Status: `DONE`
- Files Changed:
  - `src/__tests__/visualConsoleSearchAlignment.test.ts`
  - `src/__tests__/visualConsoleFuzzySearch.test.ts`
  - `src/__tests__/visualConsoleMissionViews.test.ts`
  - `src/__tests__/fuzzyProjectSearch.test.ts`
  - `src/__tests__/visualConsoleObserver.test.ts`
  - `docs/specs/exec-plans/homepage-projects-observer-ranking-v0.1.exec-plan.md`
- Verification:
  - `wsl bash -lc 'cd /home/adduser/AgentProjection/agentRadar && ./node_modules/.bin/tsc --noEmit'`
  - `wsl bash -lc 'cd /home/adduser/AgentProjection/agentRadar && ./node_modules/.bin/vitest run src/__tests__/visualConsoleSearchAlignment.test.ts src/__tests__/visualConsoleFuzzySearch.test.ts src/__tests__/fuzzyProjectSearch.test.ts src/__tests__/visualConsoleObserver.test.ts'`
- Result:
  - `TypeScript` 通过
  - 2026-06-24 追加修复已确认：`Projects` 不再混入 `Observer entries[]` 作为项目库候选，避免统计总量偏离 daily `all_projects`
  - 2026-06-24 追加修复已确认：库存回填项目不再默认兜底落入 `useful_first`，陈旧回填统一进入 `supplemental_inventory`

### Task: 2026-06-24 项目库统计与补充分类纠偏

- Status: `DONE`
- Files Changed:
  - `src/visualConsole/build.ts`
  - `app/visualConsole/ossProjectsPage.ts`
  - `app/visualConsole/clientScript.ts`
  - `src/__tests__/visualConsolePresetBucketing.test.ts`
  - `docs/specs/exec-plans/homepage-projects-observer-ranking-v0.1.exec-plan.md`
- Verification:
  - `./node_modules/.bin/vitest run src/__tests__/visualConsolePresetBucketing.test.ts src/__tests__/visualConsoleSearchAlignment.test.ts src/__tests__/visualConsoleMissionViews.test.ts src/__tests__/fuzzyProjectSearch.test.ts src/__tests__/visualConsoleFuzzySearch.test.ts`
  - `./node_modules/.bin/tsx -e "import { buildProjectsView } from './src/visualConsole/build.ts'; ..."`
- Result:
  - 修复了 `historical_context`/库存回填被过早归入 `useful_first` 的问题，使 `supplemental_inventory` 成为显式可见的第五分类
  - 修复了 `Projects` 违规混入 `Observer` 候选池的问题，真实项目总数重新对齐 daily 候选池而非 `daily + observer` 混算
  - 修复了项目库页头统计文案歧义，当前展示改为“当前结果 / 项目库总量”，避免把当前子榜结果数误读成全库总数
  - 已用 `2026-06-20` 到 `2026-06-23` 的私有日报验证：项目库总数从错误的混算口径回归到 daily 项目池口径，且不再出现空 `supplemental` 分桶
  - 4 个针对性测试文件、47 条测试全部通过

### Task: 2026-06-24 Projects 多桶归属与默认总榜修正

- Status: `DONE`
- Files Changed:
  - `src/search/projectSearchIndex.ts`
  - `app/visualConsole/ossProjectsPage.ts`
  - `src/__tests__/visualConsoleSearchAlignment.test.ts`
  - `src/__tests__/visualConsoleFuzzySearch.test.ts`
  - `src/__tests__/fuzzyProjectSearch.test.ts`
  - `src/__tests__/visualConsoleMissionViews.test.ts`
  - `src/__tests__/visualConsolePresetBucketing.test.ts`
  - `docs/specs/design-docs/首页项目库排序与新兴潜力项目设计.md`
  - `docs/specs/exec-plans/homepage-projects-observer-ranking-v0.1.exec-plan.md`
- Verification:
  - `./node_modules/.bin/vitest run src/__tests__/visualConsolePresetBucketing.test.ts src/__tests__/visualConsoleSearchAlignment.test.ts src/__tests__/visualConsoleMissionViews.test.ts src/__tests__/fuzzyProjectSearch.test.ts src/__tests__/visualConsoleFuzzySearch.test.ts`
  - `./node_modules/.bin/tsx -e "import { buildProjectsView } from './src/visualConsole/build.ts'; ..."`
- Result:
  - 修复了 `preset_memberships` 缺失时搜索索引与页面 helper 的运行时断裂，兼容老夹具和历史投影
  - `Projects` 默认入口已明确为 `all`，不再默认替用户先切进 `useful_first`
  - `Projects` 五个子榜允许重叠归属，`preset_bucket` 仅保留主显示桶语义，筛选和计数统一以 `preset_memberships` 为准
  - 以私有日报 `2026-06-20` 到 `2026-06-23` 验证：项目库总量分别为 `309 / 296 / 315 / 332`

### Task: 2026-06-24 Observer 默认总榜与分桶门槛校正

- Status: `DONE`
- Files Changed:
  - `src/types.ts`
  - `src/visualConsole/types.ts`
  - `src/visualConsole/build.ts`
  - `app/visualConsole/ossPages.ts`
  - `app/client/ObserverView.tsx`
  - `src/__tests__/visualConsolePresetBucketing.test.ts`
  - `src/__tests__/visualConsoleSearchAlignment.test.ts`
  - `src/__tests__/visualConsoleObserver.test.ts`
  - `docs/specs/design-docs/首页项目库排序与新兴潜力项目设计.md`
  - `docs/specs/exec-plans/homepage-projects-observer-ranking-v0.1.exec-plan.md`
- Verification:
  - `./node_modules/.bin/tsc --noEmit`
  - `./node_modules/.bin/vitest run src/__tests__/visualConsolePresetBucketing.test.ts src/__tests__/visualConsoleSearchAlignment.test.ts src/__tests__/visualConsoleObserver.test.ts`
  - `./node_modules/.bin/tsx -e "import { buildObserverView } from './src/visualConsole/build.ts'; ..."`
- Result:
  - Observer 默认入口改为总榜 `all`，不再一进页先被 `early_watch` 单桶预筛
  - `by_scenario` 改为优先吃显式 `ecosystems / topic_hints / labels` 场景信号；缺显式信号时，允许单一高置信业务/垂直方向的文本补偿
  - `new_direction` 放宽为接受 `new-24h/new-72h`、`judge_score_delta>0`、`strong-watch`、新变化 breakout、例外原因码等结构化增量
  - 用真实数据 `2026-06-22` 验证：Observer 总量 `129`，默认视图=`all`，分桶为 `new_direction=16 / by_scenario=27 / infra_early=52 / early_watch=34`

### Task: 2026-06-24 Observer 垂直行业补桶修正

- Status: `DONE`
- Files Changed:
  - `src/visualConsole/build.ts`
  - `src/__tests__/visualConsolePresetBucketing.test.ts`
  - `docs/specs/design-docs/首页项目库排序与新兴潜力项目设计.md`
- Verification:
  - `./node_modules/.bin/vitest run src/__tests__/visualConsolePresetBucketing.test.ts src/__tests__/visualConsoleObserver.test.ts src/__tests__/visualConsoleSearchAlignment.test.ts`
  - `./node_modules/.bin/tsx -e "import { buildObserverView } from './src/visualConsole/build.ts'; ..."`
- Result:
  - `by_scenario` 在显式场景信号缺失时，允许单一高置信垂直方向从文本补桶
  - 股票 / 电商等垂直方向不再因为缺少 `topic_hints` 而全部掉出 `by_scenario`
  - 真实样本确认：`heikki-laitala/inderes-cli`、`novalgo-x/LingTrade`、`TonyWang-hub/mcp-cn-commerce` 已进入 `by_scenario`

## 偏差记录

- Deviation:
  - 额外修改了 `app/visualConsole/clientScript.ts`
  - 原因：`Projects` 子榜切换的实际交互状态与 fuzzy request 组装在该文件内，若不修改则 preset 仅停留在静态 DOM，无法满足 Phase 3 对“先确定 preset 候选集，再执行搜索/排序/分页”的执行语义
  - 影响：仅补充页面局部 preset 状态、按钮绑定与 fuzzy `page_context.path` 透传；未引入新的 URL 契约，也未修改 canonical artifact

## 实施步骤

### Phase 0：上游门禁与消费契约冻结

1. 先补齐上游门禁记录：
   - `首页项目库排序与新兴潜力项目设计.md` 已于 `2026-06-24` 切换为 `Approved`。
   - 若批准时修改了子榜名称、容量、Projects 主桶优先级、Observer 落桶顺序、例外原因码或 URL 规则，必须先回写本计划，再进入实现。
2. 将以下真源边界写死到计划和后续实现守则中：
   - `Overview / Projects` 只消费 daily 双栈字段与 `context_only_projects`。
   - `Observer` 只消费 observer artifact `entries[]`。
   - `score.paradigm` 是首页“同一范式最多 2 个”的唯一真源；缺失时只跳过该约束，不得猜测。
3. 将 URL 契约的实施边界写清楚：
   - `preset` 是目标 URL 契约，不等于前端可绕开 router/context 基线自行定义解析。
   - 在 router/context 正式接纳前，`Projects` 与 `Observer` 只允许以页面局部状态承载当前 `preset`。
   - 在该过渡阶段，不允许读取 `preset` query，不允许写入 `preset` query，也不允许借用其他 query 参数伪装承载 `preset`。
   - 只有当 `src/visualConsole/context.ts` 与对应 reader/context 基线正式接纳 `preset` 后，才允许把页面局部状态升级为 URL 状态。
4. 冻结 `preferenceMode=preference` 的硬边界：
   - 仅允许对当前 `preset` 已确定的客观候选集重排。
   - 不得扩候选、借位或绕过默认降饱和与显式搜索保护。
5. 冻结缺字段降级：
   - 没有 `preset_bucket` 时，`Projects` 退回现有客观列表，不开启默认子榜 landing。
   - 没有 `observer_preset_bucket` 时，`Observer` 退回现有客观列表，不开启默认子榜 landing。
   - 缺少增强字段时执行最小去饱和，不回退热榜。
6. 冻结 artifact 边界：
   - `preset_bucket / observer_preset_bucket / utility_hint / repeat_exposure_state / head_project_exception_reason / hard_infra` 只允许存在于 projection / view-model。
   - `dailyReport.ts`、canonical daily artifact、canonical observer artifact 不得新增这些页面消费字段。

### Phase 1：View-only Projection 与主桶投影

1. 在 `src/types.ts` 和 `src/visualConsole/types.ts` 新增页面消费投影字段：
   - `preset_bucket`
   - `observer_preset_bucket`
   - `utility_hint`
   - `repeat_exposure_state`
   - `head_project_exception_reason`
   - `hard_infra`
2. 在 `src/visualConsole/build.ts` 内实现 `Projects` 的 `preset_memberships` 与主桶优先级：
   - `hard_infra=true -> infra_tools`
   - 方向/场景命中 -> `by_scenario`
   - 探索/信息增量成立 -> `worth_trying_today`
   - 今天最可能直接可用且非 `hard_infra` -> `useful_first`
   - 其余回收到 `supplemental_inventory`
   - 同一项目允许同时命中多个 memberships，`preset_bucket` 只保留主显示桶
3. `hard_infra` 只允许由设计冻结的组合条件判定：
   - `direction_matches` 为空
   - `utility_hint=infra`
   - `project.category / ecosystems / labels / topics` 稳定命中基础设施语义
4. 在同一投影层实现 `Observer` 的唯一机器落桶顺序：
   - 明确场景命中 -> `by_scenario`
   - 否则基础设施主价值面 -> `infra_early`
   - 否则结构化新变化信号成立 -> `new_direction`
   - 其余 -> `early_watch`
5. 将 `head_project_exception_reason` 原因码冻结为：
   - `major_new_release`
   - `new_branch_or_mode`
   - `new_domain_adoption`
   - `critical_ecosystem_shift`
   - 未命中上述原因码时，头部项目不得因“可能有变化”获得前排例外。
6. 将缺字段降级落在服务端投影层：
   - 无 `appearance_reason_codes / qualification / judge_score_delta / freshness_label` 时，`信息增量成立` 只允许由 `explore_ribbon_projects` 成立。
   - 无 `related_direction / keywords / breakout_label / freshness_label / judge_score_delta / qualification` 时，`Observer` 只用现有结构字段派生 bucket。
   - 前端不得兜底猜测。
7. 本阶段禁止把上述投影字段回写到 `dailyReport`、observer artifact 或其他 canonical artifact；如需证明字段可用，必须通过 build/view-model 测试而不是 artifact 扩 schema。

### Phase 2：Overview 语义带与默认前排

1. 在 `buildOverviewView()` 中新增四条语义带投影：
   - `今日最值得看`：主消费 `today_pulse_projects`
   - `与你当前方向更相关`：主消费 `mission_match_projects`
   - `值得建立新认知`：主消费 `explore_ribbon_projects`
   - `基础设施变化`：主消费基础设施子集与 `context_only_projects`
2. 将首页项目归属顺序冻结为：
   - `与你当前方向更相关`
   - `今日最值得看`
   - `值得建立新认知`
   - `基础设施变化`
   - 同一项目在首屏只能出现一次。
3. 固化首页容量：
   - `2 / 3 / 2 / 1`
   - 总卡数 `<= 8`
   - `explore_ribbon_projects` 作为页面层研究流补带，不改写 daily canonical core exposure。
4. 落实首页默认降饱和：
   - 同组织最多 `1` 个
   - 同范式最多 `2` 个
   - `head_project=true` 默认不能占首页第一主位，除非有例外原因码
5. 落实首页空态与折叠：
   - `mission_match` 缺候选时明确空态
   - `基础设施变化` 缺候选时可折叠
   - `值得建立新认知` 缺候选时允许空态，不拿热榜补位
6. 在 `app/visualConsole/ossPages.ts` / `renderOverview` 同步 research stream 渲染，确保页面骨架仍服从 UI V3 的 `Hero -> Rail -> Strip -> Stage -> Dock`。

### Phase 3：Projects 子榜与工作台组合

1. 在 `buildProjectsView()` 中把当前项目集合投影为：
   - `preset=all | useful_first | by_scenario | worth_trying_today | infra_tools | supplemental_inventory`
   - 每个项目必须稳定产出 `preset_memberships`
   - `preset_bucket` 只保留主显示桶，不再代表唯一归属
   - 默认 landing 先消费总榜 `all`
2. 明确默认入口：
   - router/context 已接纳 `preset` 后，`/projects` 无参数时视为 `preset=all&preferenceMode=objective&sort=score`
   - 在 `preset` 尚未接纳前，页面首开默认选中 `all`，子榜切换只保存在页面局部状态
3. 把排序与分页顺序钉死为：
   - 先确定 `preset` 候选集
   - 再执行搜索
   - 再执行 `objective sort` 或 `preference rerank`
   - 最后分页
   - 不允许先分页再分桶。
4. 在 `projectSearchKernel` / `projectSearchIndex` 中加入 `preset` 维度：
   - direct search 只搜索当前 `preset` 结果集
   - zero-result fuzzy 也只能扩展当前 `preset` 结果集
   - 指定 `preset` 浏览与显式搜索不受默认降饱和误伤
5. 在 `ossProjectsPage.ts` 实现五个白话子榜切换，并保留现有双模式：
   - `更可能用得上`
   - `按场景找`
   - `今天值得试试`
   - `看底层工具`
   - `补充项目池`
6. Projects 默认 landing 前排额外守则：
   - 前 `12` 个结果中 `head_project` 不超过 `2`
   - 同一组织不超过 `2`
   - 头部基础设施默认优先沉到 `看底层工具`
7. 若双栈字段缺失，只允许兼容降级到：
   - `today_star_projects + context_only_projects`
   - 且子榜只保留 `useful_first / infra_tools`
   - `by_scenario / worth_trying_today` 必须显示降级不可用

### Phase 4：Observer 子榜与潜力前排

1. 在 `buildObserverView()` 或等价 projection 中产出 `observer_preset_bucket`，不改 canonical observer artifact。
2. 默认入口冻结为：
   - router/context 已接纳 `preset` 后，`/observer` 无参数时视为 `preset=all&preferenceMode=objective`
   - 在 `preset` 尚未接纳前，页面首开默认选中 `all`，子榜切换只保存在页面局部状态
3. 在 `ObserverView.tsx` 中实现四个子榜切换：
   - `值得提前关注`
   - `新方向`
   - `按场景找`
   - `看底层新东西`
4. 保住 Observer 页面骨架：
   - 顶部 summary / scope / watch guidance 仍先出现
   - 中段才是 candidate list 子榜切换
   - 下段保留 evidence / linked context / follow-up context
5. 落实默认去饱和：
   - 熟悉头部项目默认不进 `early_watch` 前排
   - 名气延伸而无潜力信号者只能进入 `infra_early` 或后排
   - 同组织、同家族项目不得占满前排
6. 落实搜索与分页顺序：
   - 先按 `preset` 过滤
   - 再搜索
   - 再按 `objective` 或 `preference` 排列
   - 最后分页
7. 若 `observer_preset_bucket` 缺失：
   - 直接退回现有 Observer 客观列表
   - 不得临时根据中文摘要猜 bucket

### Phase 5：验证、回滚与账本收口

1. 单元测试必须覆盖：
   - `preset_memberships / preset_bucket / observer_preset_bucket` 的投影顺序与边界
   - `hard_infra` 判定
   - `head_project_exception_reason` 原因码
   - 缺字段降级
2. 页面/集成测试必须覆盖：
   - 首页四语义带容量、去重、空态、头部第一主位限制
   - Projects 默认 `useful_first` landing
   - `preset/preferenceMode/sort/q` 组合行为
   - Observer 默认 `all` landing 与 summary/evidence/context 未被列表吞掉
3. 搜索/endpoint 测试必须覆盖：
   - `preset` 内搜索
   - zero-result fuzzy 不跨 `preset`
   - 详情直达、显式搜索和指定 `preset` 浏览不受默认降饱和误伤
4. 边界测试必须覆盖：
   - `preset_bucket / observer_preset_bucket / utility_hint / repeat_exposure_state / head_project_exception_reason / hard_infra` 不出现在 canonical daily / observer artifact
   - 在 router/context 未接纳 `preset` 时，页面不会解析或写入 `preset` query
5. CLI / 页面 smoke 至少验证：
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm run-daily -- --date <date> --dry-run`
   - `pnpm verify-daily -- --date <date>`
   - `pnpm visual-console -- --view overview --date <date>`
   - `pnpm visual-console -- --view projects --date <date>`
   - `pnpm visual-console -- --view observer --date <date>`
6. 实施完成后，必须回写本计划：
   - 当前状态
   - 已落地内容
   - 验证记录
   - 残余风险
   - 下一阶段入口

## 验收标准

### 验收 1：首页不再是同一条总榜

- 成功条件：`Overview` 首屏明确分成四语义带，总卡数 `<= 8`，同一项目只出现一次。
- 失败条件：首页仍只是按分数排前 8 个项目。

### 验收 2：Projects 成为预设子榜工作台

- 成功条件：`Projects` 存在 `5` 个白话子榜，默认进入总榜 `all`，且 `preset` 与 `objective/preference` 双模式共存。
- 失败条件：项目库仍主要回答“谁最热”。

### 验收 3：Observer 保住“提前发现”语义

- 成功条件：默认 `值得提前关注` 前排不再被熟悉头部项目统治，且页面仍先展示 summary / scope / evidence。
- 失败条件：Observer 只是另一个热榜或项目详情附页。

### 验收 4：服务端投影替代前端猜测

- 成功条件：`preset_bucket / observer_preset_bucket / utility_hint / hard_infra / head_project_exception_reason` 由 build/projection 一次性产出。
- 失败条件：前端根据文案、标签或名称自由推 bucket。

### 验收 5：默认降饱和不误伤显式意图

- 成功条件：显式搜索、指定 `preset` 浏览、分页和详情直达不受默认 landing 去饱和误伤。
- 失败条件：用户一搜明确项目却被“多样性”规则挡掉。

### 验收 6：缺字段时优雅降级

- 成功条件：缺字段时走空态、折叠或受限子榜，不回退热榜。
- 失败条件：一旦字段不齐，三页重新变成同一条排行榜。

## 验证矩阵

| 类型 | 验证项 | 命令/方式 | 成功标准 |
| --- | --- | --- | --- |
| 单元 | `Projects` 落桶顺序 | `pnpm test -- projectPresetBucketing` | 每个项目只落一个 `preset_bucket` |
| 单元 | `Observer` 落桶顺序 | `pnpm test -- observerPresetRouting` | 每个 entry 只落一个 `observer_preset_bucket` |
| 单元 | 头部例外原因码 | `pnpm test` | 非冻结原因码不能让头部项目破例前排 |
| 单元 | 缺字段降级 | `pnpm test` | 缺字段时执行设计定义的降级，不猜测 |
| 集成 | Overview 四语义带 | `pnpm test -- overviewProjectDistribution` | `2/3/2/1` 容量、去重、空态正确 |
| 集成 | Projects 组合契约 | `pnpm test -- projectsPresetRouting` | `preset -> search -> sort/rerank -> paginate` 顺序正确 |
| 集成 | Observer 组合契约 | `pnpm test -- observerPresetRouting` | `preset -> search -> rank/rerank -> paginate` 顺序正确 |
| 集成 | fuzzy preset 边界 | `pnpm test -- fuzzyProjectSearch` | zero-result fuzzy 不跨 `preset` 扩候选 |
| 集成 | artifact 边界守护 | `pnpm test -- projectionArtifactBoundary` | `preset_bucket` 等 view-only 字段不写回 canonical artifact |
| 集成 | preset query 边界守护 | `pnpm test -- presetQueryBoundary` | 在 context 未接纳前，不解析也不写入 `preset` query |
| CLI | daily/verify 输出兼容 | `pnpm run-daily -- --date <date> --dry-run`、`pnpm verify-daily -- --date <date>` | 新字段可消费，旧兼容字段不崩溃 |
| 页面 | overview/projects/observer smoke | `pnpm visual-console -- --view <route> --date <date>` | 三页均能消费新结构，路由语义不串台 |

## 验证记录

| 日期 | 验证项 | 状态 | 记录 |
| --- | --- | --- | --- |
| 2026-06-24 | 设计与实现触达面盘点 | 已完成 | 确认本计划主要落在 `build.ts / types.ts / projects search state / observer page` |
| 2026-06-24 | 上游状态核对 | 已完成 | 目标设计已切换为 `Approved`，本计划可进入 exec-plan review / implementation readiness 收口 |
| 2026-06-24 | 过渡边界收口 | 已完成 | 已锁定 `preset` 过渡期只允许页面局部状态承载，禁止影子 query 契约 |
| 2026-06-24 | artifact 边界收口 | 已完成 | 已锁定 view-only 字段不回写 canonical artifact |

## 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 设计审批前就开始写代码 | 实现偷偷补设计，后续返工大 | Phase 0 设为硬 gate，设计未批准不进入实现 |
| `preset` 被页面层擅自发明为全站 query 契约 | router/context 语义漂移 | 在基线正式接纳前，只允许页面局部承载，不越权改 query 真义 |
| 去饱和实现成“隐藏头部项目” | 搜索和显式浏览被误伤 | 明确默认 landing only，搜索/详情/指定 preset 免伤 |
| `Observer` 子榜化吞掉 summary/evidence/context | 潜力页退化成普通列表页 | Phase 4 把骨架保真写成显式验收项 |
| 前端自行猜 bucket | 服务端与页面语义分裂 | 所有 bucket 与例外原因码都在 projection 一次性产出 |

## 回滚策略

1. Phase 1 未完成时：
   - 不开放任何新子榜 UI。
   - 继续使用现有 Projects / Observer 客观列表。
2. Phase 2 失败时：
   - `Overview` 允许暂时继续消费现有 daily 项目流。
   - 但不得伪装成“四语义带已完成”。
3. Phase 3 失败时：
   - 保留 `Projects` 现有 `sort / preferenceMode / search`。
   - 不启用 `preset` landing，也不开放误导性的标签切换。
4. Phase 4 失败时：
   - 保留现有 Observer 搜索、分页与双模式。
   - 不启用 `observer` 子榜切换。
5. 任何阶段不得通过回滚删除或改写 daily / observer canonical artifact 字段。

## 结论记录

- 本计划遵循“先定候选集，再在候选集内排序/重排”的设计 thesis，不把问题重新写回“再造一个更聪明的排序器”。
- 本计划把最大 drift 风险放在 Phase 0 和 Phase 1：若没有明确 gate 和 projection 真源，后续 UI 阶段最容易偷偷补设计。
- 设计批准后，当前剩余关键风险已收敛为两个实现边界：`preset` 过渡承载不能演化成影子 query 契约、view-only 字段不能下沉为 artifact 契约。
- 本计划在进入代码实施前，仍建议先完成一次 exec-plan review，重点验证上述两个边界没有再留实现裁量口。

## 下一阶段入口

1. 针对本计划执行一次 `exec-plan review`，重点检查：
   - `preset` query 接纳边界是否仍有未决问题
   - `Observer` 子榜是否仍保住 summary/evidence/context
   - 默认降饱和是否被误写成全局隐藏规则
2. exec-plan review 通过后，再进入实现阶段，优先从 `build.ts / view-model / 页面局部状态` 落手，不先碰 canonical artifact。
