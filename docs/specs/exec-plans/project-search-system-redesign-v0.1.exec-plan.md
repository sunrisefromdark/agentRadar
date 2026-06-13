# 执行计划：项目搜寻体系重塑

## 文档状态

- 版本：`v0.1`
- 当前状态：`Reviewed - Passable`
- 设计来源：
  - [项目搜寻体系重塑需求分析.md](../product-specs/项目搜寻体系重塑需求分析.md#L1)
  - [project-search-system-redesign-design.md](../design-docs/project-search-system-redesign-design.md#L1)
  - [architecture-boundaries.md](../design-docs/architecture-boundaries.md#L1)
  - [signal-filter-action-version-design.md](../design-docs/signal-filter-action-version-design.md#L1)
  - [daily-report-freshness-readability-design.md](../design-docs/daily-report-freshness-readability-design.md#L1)
  - [ecosystem-focused-observer-design.md](../design-docs/ecosystem-focused-observer-design.md#L1)
- 上游设计门禁：`project-search-system-redesign-design.md` 已于 `2026-06-12` 明确切换为 `Approved`，本计划以该冻结版本为唯一设计基线。
- 说明：本计划负责把“项目搜寻体系重塑”设计文档中的全部已冻结设计落地为可运行、可审计、可降级的实现，不在实现阶段新增新的产品语义或放宽设计约束。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | 项目搜寻体系重塑 |
| 负责人 | Codex |
| 风险等级 | `High` |
| 关联需求 | `docs/specs/product-specs/项目搜寻体系重塑需求分析.md` |
| 关联设计 | `docs/specs/design-docs/project-search-system-redesign-design.md` |
| 影响范围 | `src/signal/`、`src/action/`、`src/feedback/`、`src/visualConsole/`、`src/__tests__/`、`src/types.ts`、`src/config.ts`、`src/cli.ts`、`config.yaml`、`data/`、`docs/specs/` |

## 目标

在不重写既有 `rules-first scoring` 主框架的前提下，完成以下交付：

1. 将当前“单榜单混合发现”重构为 `今日全局脉冲 + 与你当前任务更相关 + 方向缺口账本` 的双栈发现体系。
2. 冻结并落地 V1 `16` 个 `must-cover` 方向目录、三类边界模式、最少 `3` 组 query packs、最少 `3` 类 lanes，以及所有数量门槛与滚动库存目标。
3. 新增 `mission scout discovery` 与 `mission deep discovery`，让“已搜索”不再等同于“已覆盖”，并把 `coverage_atlas / gap_ledger` 变成正式产物。
4. 落地 `anchor seats + challenger seats`、任务区公平约束、`explore_ribbon_projects`、头部项目让位和 `head saturation demotion`。
5. 落地方向压力梯度、`gapPressureAggregator`、`pressurized / relieved` 状态切换，以及 `observer -> catalog promotion` 所需的证据链和候选输出。
6. 让 `run-daily`、`daily report`、`run-summary`、`visual console`、兼容字段和降级语义都能消费新结构，并保持旧 reader 不崩溃。
7. 为新增目录、状态机、搜索责任、降级行为、兼容字段和 UI 暴露建立单元、集成、回归与验收测试。

## 边界约束

### 允许修改

- `src/signal/*`
- `src/action/*`
- `src/feedback/*`
- `src/visualConsole/*`
- `src/types.ts`
- `src/config.ts`
- `src/cli.ts`
- `config.yaml`
- `src/__tests__/*`
- `data/*`
- `docs/specs/exec-plans/*`

### 禁止修改

- 不重做底层 `ScoreComponent` 与 `objective_score` 公式。
- 不把 LLM 提升为最终排序裁判或主判定器。
- 不把 `observer-only` 结果直接混入 `today_pulse_projects` 或 `mission_match_projects`。
- 不新增“第三正式项目区”来承载多样性。
- 不引入完整用户画像系统、长期记忆画像或前端偏好配置台。
- 不把系统扩张为泛软件资讯平台。
- 不允许历史 fallback 伪装成当天 mission 命中。

### 兼容性约束

- `run-daily`、`recover-daily`、`verify-daily`、`visual-console` 命令名保持不变。
- `data/reports/YYYY-MM-DD.daily.json`、`data/reports/YYYY-MM-DD.daily.md`、`data/reports/YYYY-MM-DD.run-summary.json` 路径保持不变。
- 保留 `today_star_projects`，并确保 weekly/既有 reader 仍能继续读取该兼容字段。
- 保留 `global_hot_projects`、`demand_relevant_projects`、`searched_direction_statuses` 兼容字段。
- `context_only_projects` 继续只存在于历史补充观察，不参与 mission 命中。
- mission 发现链路失败时，全局脉冲仍可独立产出，且不得提升 observer/context-only 结果冒充 mission 命中。

## 设计覆盖映射

| 设计冻结项 | 落地阶段 | 主落地模块 |
| --- | --- | --- |
| 双栈发现与三段式产品表面 | Phase 3 / 4 / 5 | `src/action/dailyReport.ts`、`src/action/runSummary.ts`、`src/visualConsole/*` |
| 16 个 must-cover 目录、边界模式、方向元数据 | Phase 0 / 1 | `src/signal/directionCatalog.ts`、`src/types.ts` |
| scout / deep 双层 mission discovery | Phase 1 / 2 | `src/signal/missionScoutDiscovery.ts`、`src/signal/missionDeepDiscovery.ts` |
| 方向数量门槛、滚动库存下限、完成定义 | Phase 1 / 2 / 3 | `missionScoutDiscovery`、`missionDeepDiscovery`、`gapPressureAggregator` |
| `coverage_atlas / gap_ledger` 正式产物 | Phase 2 / 4 / 5 | `src/types.ts`、`src/action/dailyReport.ts`、`src/visualConsole/*` |
| `matched / weak_signal / noise_only / zero_candidate / search_failed / disabled` 状态机 | Phase 2 / 3 | `missionScoutDiscovery`、`missionDeepDiscovery`、`types.ts` |
| 项目级 `appearance reason` / 曝光原因 | Phase 0 / 4 / 5 | `src/types.ts`、`src/action/dailyReport.ts`、`src/visualConsole/*` |
| `anchor/challenger`、任务区公平、`explore_ribbon`、头部让位 | Phase 4 | `src/action/dailyReport.ts` |
| `gap pressure`、`pressurized / relieved`、反馈闭环 | Phase 3 | `src/feedback/gapPressureAggregator.ts` |
| observer incubator 与 catalog promotion | Phase 3 | `src/signal/ecosystemFocusObserver.ts`、`runSummary.ts` |
| 失败/降级/兼容策略 | Phase 2 / 4 / 5 | `src/signal/index.ts`、`src/action/*`、`src/visualConsole/*` |
| 单元/集成/回归/验收测试 | Phase 6 | `src/__tests__/*` |

## 文件与职责

### 建议新增

- `src/signal/directionCatalog.ts`
  - 冻结 16 个 `must-cover` 方向、家族、边界模式、默认深度、query packs、lane 定义、required terms、negative terms、evidence verbs/objects。
- `src/signal/githubRepositorySearch.ts`
  - 从 observer 中抽出可复用的 GitHub repository search 能力，统一 mission scout / deep / observer 的查询执行入口。
- `src/signal/missionScoutDiscovery.ts`
  - 执行 catalog-wide `coverage sweep`，输出方向级查询计数、候选计数、结果状态和 deep 升级建议。
- `src/signal/missionDeepDiscovery.ts`
  - 对升级方向执行深搜、方向验证、数量补足、结果/缺口解释，并形成 `mission_match_projects` 候选。
- `src/feedback/gapPressureAggregator.ts`
  - 汇总最近 7 天的 `explicit_not_found`、`search_zero_result`、`skip_repeated_head`、`click_quick_exit`、`return_visit_without_satisfaction`，产出压力状态。
- `src/__tests__/directionCatalog.test.ts`
- `src/__tests__/missionScoutDiscovery.test.ts`
- `src/__tests__/missionDeepDiscovery.test.ts`
- `src/__tests__/gapPressureAggregator.test.ts`
- `src/__tests__/projectSearchDailyOutput.test.ts`
- `src/__tests__/projectSearchVisualConsole.test.ts`

### 建议修改

- `src/types.ts`
  - 新增 `DirectionCoverageStatus`、mission 相关项目字段、任务区/席位字段、压力状态与兼容字段。
- `src/config.ts`
  - 新增 mission 运行时参数与 schema 校验，但产品冻结项仍由代码常量主导，不允许配置层偷改目录与数量目标。
- `config.yaml`
  - 只补 mission 并发、超时、是否启用 GitHub search 等运行时开关，不下放产品规则。
- `src/signal/index.ts`
  - 在现有全局信号收集后接入 mission scout / deep 的 orchestrator，并写出新 artifact。
- `src/signal/ecosystemFocusObserver.ts`
  - 复用共享 search connector，并输出 incubating direction / promotion candidate 所需证据。
- `src/cli.ts`
  - 将 mission discovery、coverage/gap artifacts、observer promotion 候选纳入 `run-daily` 主流程与写盘。
- `src/action/dailyReport.ts`
  - 重构为 `today_pulse_projects`、`mission_match_projects`、`explore_ribbon_projects`、`coverage_atlas`、`gap_ledger` 的正式输出层。
- `src/action/runSummary.ts`
  - 汇总 mission 覆盖完成度、方向状态分布、库存缺口、observer promotion 候选和降级语义。
- `src/visualConsole/readLayer.ts`
  - 读取新 daily JSON 契约并保留兼容别名。
- `src/visualConsole/build.ts`
  - 将“今日全局脉冲 / 方向覆盖总览 / 任务命中 / 缺口账本 / 历史补充观察”映射为独立 surface。
- `src/visualConsole/types.ts`
  - 扩展视图模型与 drilldown 契约。

### 建议新增数据目录

- `data/discovery/mission-scout/`
- `data/discovery/mission-deep/`
- `data/coverage/atlas/`
- `data/feedback/gap-pressure/`

## 当前状态

当前仓库已经具备 `global pulse -> normalize -> score -> daily report -> visual console` 的主链路，但仍缺少以下能力：

- 没有正式的 `must-cover` 方向目录与 query pack 责任模型。
- 没有 mission scout / deep 双层发现，也没有方向级数量下限。
- daily 仍未输出 `today_pulse_projects / mission_match_projects / coverage_atlas / gap_ledger / explore_ribbon_projects`。
- observer 还没有承担 catalog incubator 和 promotion candidate 责任。
- 任务区公平、anchor/challenger、头部让位、gap pressure、滚动库存目标都还没有进入实现层硬约束。

## 当前进度

- 需求分析：`Done`
- 设计冻结：`Done`
- 执行计划：`In Progress`
- 实施：`Not Started`
- 验证：`Not Started`

## 已落地内容

- 已完成设计与现有代码路径对齐，确认本计划应直接落在 `signal / action / visualConsole / observer / types / config / tests` 这些模块上。
- 已确认仓库现有 exec-plan 体系、索引规则与 `run-daily` 写盘路径，后续实现可直接接入现有主流程。

## 实施阶段

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：契约与目录冻结 | `Not Started` | 把方向目录、数量目标、artifact schema、兼容字段和运行时边界冻结到代码与类型层 | `directionCatalog`、`DirectionCoverageStatus`、artifact 目录与 schema 一致 |
| Phase 1：Mission Scout 主链路 | `Not Started` | 落地 16 方向 coverage sweep、lane/query pack 责任与基础 outcome 判定 | 每个方向每天都有正式 scout 状态与数量责任 |
| Phase 2：Mission Deep 与库存补足 | `Not Started` | 落地 deep 升级、数量补足、正式命中与 search exhausted 语义 | `mission_match_projects`、`search_exhausted`、滚动库存统计可观测 |
| Phase 3：Gap Pressure 与 Observer Incubator | `Not Started` | 落地方向压力梯度、observer promotion 候选与反馈闭环 | `pressurized / relieved / promoted`、promotion candidate 正式产出 |
| Phase 4：Daily Output 与 Exposure Planner | `Not Started` | 重构日报输出、任务区公平、anchor/challenger、explore ribbon、头部让位 | daily JSON/Markdown 同时体现双栈发现与缺口账本 |
| Phase 5：Visual Console 与兼容层 | `Not Started` | 让 visual console、read layer、reader 兼容字段消费新结构 | overview/projects/run-health/observer 对新语义稳定可读 |
| Phase 6：验证与收口 | `Not Started` | 补齐单元/集成/回归/验收测试并跑通 CLI 验证 | typecheck、tests、run-daily、verify-daily、visual-console 验证通过 |

## 实施步骤

### Phase 0：契约与目录冻结

1. 在 `src/types.ts` 新增 `DirectionCoverageStatus`，字段必须与设计文档完全对齐：
   - `direction_key`
   - `family_key`
   - `display_name_cn`
   - `boundary_mode`
   - `search_depth`
   - `query_pack_count`
   - `query_template_count`
   - `lane_types`
   - `pressure_state`
   - `outcome`
   - `reason_codes`
   - `explanation_cn`
   - `next_action`
   - `candidate_counts`
   - `quantity_target_met`
   - `search_exhausted`
2. 在项目级暴露契约中新增并冻结 `appearance reason` 语义，禁止只保留方向级解释而让项目卡片重新黑盒化：
   - `DailyExposureProject` 必须新增项目级 `appearance_reason_codes`
   - `DailyExposureProject` 必须新增项目级 `appearance_explanation_cn`
   - `DailyExposureProject` 必须新增 `exposure_bucket`，至少可区分 `today_pulse / mission_match / explore_ribbon / historical_context`
   - `today_pulse_projects / mission_match_projects / explore_ribbon_projects` 中的每张卡都必须带方向与原因
   - `appearance reason` 只负责解释“为什么出现”，不得篡改 `coverage_atlas / gap_ledger` 对“为什么没出现”的方向级语义
3. 在 `DailyReport` 与 `DailyRunSummary` 中新增并冻结：
   - `today_pulse_projects`
   - `mission_match_projects`
   - `explore_ribbon_projects`
   - `coverage_atlas`
   - `gap_ledger`
   - `mission_discovery_status`
   - `mission_degraded_reason_codes`
   - `today_star_projects` 兼容字段继续保留，且不得因双栈改造被删除
   - `global_hot_projects = today_pulse_projects`
   - `demand_relevant_projects = mission_match_projects`
   - `searched_direction_statuses = coverage_atlas`
4. 新增 `src/signal/directionCatalog.ts`，把 16 个方向、4 个家族、3 种 `boundary_mode`、默认深度、lane 定义、required terms、negative terms、`evidence_verbs + evidence_objects`、中文无结果文案全部冻结成代码常量。
5. 将以下产品决策明确写死在实现层，不允许通过 `config.yaml` 自由更改：
   - `16` 个正式方向
   - `query_pack_count >= 3`
   - 每组至少 `2` 个 query templates
   - 至少覆盖 `canonical / job-to-be-done / user-speak-or-ecosystem` 三类 lanes，并允许按方向追加 `adjacent-software`
   - 单方向 `raw_hits >= 20 / normalized_hits >= 6 / quality_passed_hits >= 2`
   - `rolling_30d searchable catalog >= 300`
   - `vertical / task-oriented projects >= 180`
   - 每方向 `rolling_30d qualified projects >= 12`
   - `rolling_7d qualified non-head projects >= 30`
   - `catalog-active = 全部 16 个 must-cover 方向`
   - `deep-active` 默认包含设计文档冻结的 `deep-daily` 方向，且在数量未达标时允许弹性扩张
   - `incubating-active` 只存在于 observer 侧，不得直通主榜
   - `global_hot_quota = 4`
   - `demand_relevant_quota = 4`
   - `anchor seats = 2`
   - `challenger seats = 2`
6. 在 `src/config.ts` 和 `config.yaml` 只增加运行时开关：
   - mission GitHub search enabled
   - 单方向并发
   - query timeout
   - 每次 deep 扩搜批次上限
   - 是否允许 dry-run 跳过 live deep
7. 新建数据目录写盘约定并冻结命名：
   - `data/discovery/mission-scout/YYYY-MM-DD.json`
   - `data/discovery/mission-deep/YYYY-MM-DD.json`
   - `data/coverage/atlas/YYYY-MM-DD.json`
   - `data/feedback/gap-pressure/YYYY-MM-DD.json`
8. 在 mission 相关 artifact 中冻结“当期可审计显式兴趣信号”输入面，禁止实现阶段自由发明兴趣判断：
   - 只允许消费当期 `search / favorite / subscribe / explicit_feedback` 四类输入
   - 明确排除长期用户画像、历史记忆偏好或不可审计 embedding 相似度
   - 为每个方向写出 `explicit_interest_signal_count`、`explicit_interest_signal_types` 与最近一次命中的审计时间戳
   - 这些字段只作为 `deep-active` 升级依据与 run-summary 审计证据，不直接改写 `objective_score`

### Phase 1：Mission Scout 主链路

1. 从 `src/signal/ecosystemFocusObserver.ts` 中抽出 GitHub search 执行层到 `src/signal/githubRepositorySearch.ts`，避免 mission 与 observer 各自维护查询逻辑。
2. 在 `src/signal/missionScoutDiscovery.ts` 中实现 catalog-wide coverage sweep：
   - 对全部 `16` 个方向逐一执行
   - 每个方向生成 `3` 组以上 query packs
   - 每组至少 `2` 个 query templates
   - 至少命中 `canonical / job-to-be-done / user-speak-or-ecosystem` 三类 lanes
   - 对 design 明确要求的方向保留 `adjacent-software lane` 扩展入口
3. 在方向元数据中实现 `strict-agent / workflow-intelligence / regulated-specialist` 三种边界模式的过滤与准入判定。
4. 为每个方向输出以下审计信息：
   - query packs 数
   - query templates 数
   - lanes 覆盖情况
   - `raw_hits / boundary_passed_hits / normalized_hits / quality_passed_hits`
   - 当前 `outcome`
   - `reason_codes`
   - `next_action`
5. 将以下状态区分写入 `missionScoutDiscovery`，禁止继续使用模糊的单一“搜过但信号不足”：
   - `matched`
   - `weak_signal`
   - `noise_only`
   - `zero_candidate`
   - `search_failed`
   - `disabled`
6. 当数量门槛未达标时，不允许在 scout 层直接结束：
   - 必须标记需 `upgrade_to_deep`
   - 或在 lanes/query packs 扩展穷尽后显式附带 `reason_code=search_exhausted`
7. 在 `src/signal/index.ts` 中把 scout artifact 纳入 `collectRawSignalsDetailed` 后的 mission 分支，而不是塞进 global signal collection。

### Phase 2：Mission Deep 与库存补足

1. 新增 `src/signal/missionDeepDiscovery.ts`，消费以下 deep-active 来源：
   - 默认 `deep-daily` 方向
   - `gap pressure` 触发方向
   - scout 命中候选达到升级阈值的方向
   - 单日或滚动库存不足方向
   - observer 强证据方向
   - 当期可审计 `explicit-interest` 方向
2. 在 orchestrator 中冻结 `deep-active` 优先级：
   - `fixed deep-daily`
   - `gap-promoted`
   - `quantity-deficit-promoted`
   - `explicit-interest-promoted`
   - `observer-promoted`
   - `rotating-deep`
   - 运行成本只能限制并发，不能作为“不继续补足库存”的理由
3. 将 `explicit-interest-promoted` 写成正式升级入口，而不是只保留优先级名称：
   - 只允许由当期 `search / favorite / subscribe / explicit_feedback` 触发
   - 任一方向当日满足“至少 1 次 `favorite` / `subscribe` / `explicit_feedback`”或“至少 2 次同方向显式搜索”即可进入 `explicit-interest-promoted`
   - 触发后必须在 deep artifact 与 run-summary 中回写 `explicit_interest_promoted=true`、触发信号类型与触发时间
   - 不允许消费长期用户画像、跨日隐式聚类偏好或不可审计推断结果
3. deep 流程必须继续执行以下责任，直到达标或正式 exhausted：
   - query variants 扩展
   - source expansion
   - lane expansion
   - 候选验证与边界复核
4. deep 输出必须同时形成两层产物：
   - 项目级 `mission_match_projects`
   - 方向级 `coverage_atlas / gap_ledger` 更新
5. 新增滚动库存计算逻辑，基于最近 30 天 mission artifacts 计算：
   - searchable catalog 总量
   - vertical/task-oriented 总量
   - 每方向 qualified projects 数
6. 新增最近 7 天新增量统计，判断是否触发：
   - `source expansion review`
   - `direction seed refinement`
   - `observer promotion review`
7. 将以下降级语义明确写入 deep：
   - scout 失败 -> `search_failed`
   - scout 达标但 deep 失败 -> 保留 `deep attempted but failed`
   - 搜索责任穷尽但仍未达标 -> `zero_candidate` 或 `weak_signal` + `search_exhausted`
8. mission discovery 当日完成定义必须改成“全部方向状态 + 搜索责任达标/正式 exhausted + 滚动库存不跌破下限”，而不是“流程跑完即可”。
9. 历史 artifact 读取必须识别并标记 `schema_stale`，禁止把旧 schema snapshot 混入当天方向结论。
10. 当 mission discovery 整体失败或被显式降级时，必须把降级语义写入正式产物，而不是只留在内部日志：
   - `mission_discovery_status=degraded`
   - `mission_degraded_reason_codes` 至少包含失败层级或主故障类型
   - `coverage_atlas` 与 `gap_ledger` 仍需可读，并明确呈现“本次方向发现降级”
   - 禁止用空数组、静默缺失或 observer/context-only 回填来伪装“今天只是没有命中”

### Phase 3：Gap Pressure 与 Observer Incubator

1. 新增 `src/feedback/gapPressureAggregator.ts`，从最近 7 天 artifact 中汇总：
   - `explicit_not_found`
   - `search_zero_result`
   - `skip_repeated_head`
   - `click_quick_exit`
   - `return_visit_without_satisfaction`
2. 为每个方向产出 `normal / pressurized / promoted / relieved` 状态，并写入 `DirectionCoverageStatus.pressure_state`。
3. 将 `pressurized` 的冻结触发条件落实到 `gapPressureAggregator` 与 mission orchestrator，禁止实现时改写阈值：
   - 最近 7 天 `explicit_not_found >= 1`
   - 或最近 7 天 `search_zero_result >= 2`
   - 或最近 7 天 `skip_repeated_head >= 3` 且无 `favorite/subscribe`
   - 或最近 7 天 `click_quick_exit >= 3` 且无 `favorite/subscribe`
   - 或最近 7 天 `return_visit_without_satisfaction >= 2`
   - 只要命中任一条件，就必须把方向标记为 `pressurized`
4. 将 `pressurized` 的实现行为落实到 mission orchestrator：
   - 默认进入 deep
   - 提升任务区排序优先级
   - 若 observer 持续有证据则纳入 promotion 审查
5. 将 `relieved` 的冻结解除条件落实到 artifact 回写，禁止弱化成模糊“正反馈达标”：
   - 最近 7 天至少 `2` 次 `matched`
   - 或最近 7 天 `favorite + subscribe >= 2` 且 `click_quick_exit` 不再增长
   - 或回访后 `2` 次运行内至少 `1` 次命中并伴随满意消费
   - 未满足以上任一条件时，不得提前解除 `pressurized`
6. 改造 `src/signal/ecosystemFocusObserver.ts`：
   - 继续产出 observer entries
   - 额外产出 incubating directions
   - 为 `observer_promotion_candidate` 提供方向级证据
7. 将 `observer -> catalog promotion` 的冻结门禁写入独立 predicate 与审计产物，禁止只输出泛化候选：
   - 最近 7 天至少 `3` 次被 observer 命中
   - 与现有 `must-cover` 目录不重复
   - 存在明确 `job-to-be-done` 语义
   - 至少有一类用户反馈或 `gap pressure` 与其相关
   - 不越出 `agent / automation / intelligent software` 边界
   - 只有五条同时满足时，才允许标记为 `observer_promotion_candidate`
8. 在 `runSummary` 或独立 artifact 中输出 `candidate catalog additions` 草案，但严格保持“候选进入设计审查，不自动进 must-cover 正式目录”：
   - 草案必须逐条列出上述五项门禁的命中证据
   - 必须显式列出未满足门禁的 incubating direction，防止被静默忽略或偷偷晋升

### Phase 4：Daily Output 与 Exposure Planner

1. 重构 `src/action/dailyReport.ts` 的项目暴露语义：
   - `today_pulse_projects` 取代 `global_hot_projects`
   - `mission_match_projects` 取代 `demand_relevant_projects`
   - `explore_ribbon_projects` 作为 8 个核心位之外的探索补位
   - 每张项目卡必须写出 `appearance_reason_codes + appearance_explanation_cn + exposure_bucket`
2. 在全局脉冲区固化席位规则：
   - `global_hot_quota = 4`
   - `anchor seats = 2`
   - `challenger seats = 2`
3. 在任务区固化配额规则：
   - `demand_relevant_quota = 4`
   - 不得因任务区命中不足而把配额语义弱化为“尽量展示”
   - 当合格命中不足 `4` 席时，只允许通过 `explore_ribbon_projects` 追加探索补位，不得伪装为 mission 命中
4. 实现 `head_project` 与 `head_saturation_state=demote`：
   - 最近 5 个完成 daily 中至少 3 次进入 core slots，且至少 2 次位于全局脉冲前半区 -> `head_project=true`
   - 连续 3 次进入核心位或 `no_incremental_value=true` -> `demote`
5. 落实头部让位行为：
   - 仍可进入 anchor
   - 禁止进入 challenger
   - 禁止占用任务区
   - 禁止进入 explore ribbon
   - 同日最多保留 2 个饱和头部于全局脉冲
6. 在任务区实现正式命中与公平约束：
   - `direction_matches` 非空
   - 通过统一质量门槛
   - 不与 Section A 重复
   - 前 3 席同方向最多 1 席
   - 整个任务区同家族最多 2 席
7. 当任务区不足 4 席时，才允许生成 `explore_ribbon_projects`，并明确标注“不属于任务命中，只是新鲜探索”。
8. 在 Markdown/JSON 中重构产品表面输出顺序：
   - `数据新鲜度总状态`
   - `今日全局脉冲`
   - `方向覆盖总览`
   - `与你当前任务更相关`
   - `方向缺口账本`
   - `历史补充观察`
   - 若 `mission_discovery_status=degraded`，则在 `方向覆盖总览` 与 `方向缺口账本` 中输出明确降级提示，而不是仅减少内容
9. 在 `runSummary.ts` 中新增 mission 相关汇总：
   - coverage 完成度
   - 各 outcome 数量分布
   - deep 升级方向数
   - search exhausted 方向数
   - gap pressure 状态分布
   - observer promotion candidate 数
   - `mission_discovery_status`
   - `mission_degraded_reason_codes`

### Phase 5：Visual Console 与兼容层

1. 修改 `src/visualConsole/readLayer.ts`，读取以下新增 daily fields：
   - `today_pulse_projects`
   - `mission_match_projects`
   - `explore_ribbon_projects`
   - `coverage_atlas`
   - `gap_ledger`
2. 保留兼容别名，保证旧 reader 仍可从：
   - `today_star_projects`
   - `global_hot_projects`
   - `demand_relevant_projects`
   - `searched_direction_statuses`
   读取到等价数据。
3. 修改 `src/visualConsole/build.ts` 和 `src/visualConsole/types.ts`：
   - Overview hero/strip/stage 对应双栈发现与 gap ledger
   - Projects 视图可区分全局脉冲命中、任务命中、历史补充观察
   - Projects 视图必须直接渲染每张项目卡的方向与 `appearance reason`，不得退化为只显示项目名和分数
   - Run Health 视图展示 coverage 未达标 / search exhausted / mission degraded
   - Observer 视图展示 incubating directions 与 promotion candidates
4. 确保 `explore_ribbon_projects` 不会混入任务命中主舞台，只能作为下折叠探索带。
5. 若 `mission_discovery_status=degraded`，visual console 与 read layer 必须直接消费并展示降级状态，不允许把它弱化为“暂无结果”。

### Phase 6：验证与收口

1. 为 `directionCatalog` 补齐单元测试：
   - 16 个方向齐备
   - 家族、边界模式、默认深度、lanes、query packs、required terms 等字段完整
2. 为 `missionScoutDiscovery` 补齐单元测试：
   - 每方向最少 3 组 query packs
   - 至少 3 类 lanes
   - 数量门槛计算正确
   - `matched / weak_signal / noise_only / zero_candidate / search_failed / disabled` 区分正确
3. 为 `missionDeepDiscovery` 补齐单元测试：
   - deep 升级条件
   - `explicit-interest-promoted` 只接受 `search / favorite / subscribe / explicit_feedback`，拒绝长期画像或不可审计兴趣推断
   - `search_exhausted` 语义
   - 滚动库存门槛
   - 7 日新增量触发 review
4. 为 `gapPressureAggregator` 补齐单元测试：
   - `pressurized` 五类冻结阈值逐条触发
   - `relieved` 三类冻结条件逐条解除
   - observer promotion candidate 关联
   - 未满足精确阈值时不得错误切换状态
5. 为 daily/report/run-summary/visual-console 补齐集成与回归测试：
   - `run-daily` 同时产出 `today_pulse_projects / mission_match_projects / coverage_atlas / gap_ledger`
   - mission 失败时全局脉冲仍可用
   - mission 失败时 daily JSON / Markdown / run-summary 明确包含 `mission_discovery_status=degraded` 与对应 reason codes
   - `today_pulse_projects / mission_match_projects / explore_ribbon_projects` 中的每张卡都带方向与 `appearance reason`
   - `demand_relevant_quota = 4` 被当作正式契约验证；不足 4 席时只允许生成 explore ribbon，不允许伪造 mission 命中补位
   - 旧 reader 兼容字段不崩溃
   - `today_star_projects` 兼容字段继续可读，weekly 不因双栈改造回归
   - `explore_ribbon_projects` 不混入任务区
   - observer 命中不污染主榜
   - `explicit-interest-promoted` 会进入 deep artifact 与 run-summary，但不会改写 `objective_score`
   - `candidate catalog additions` 仅在五条 promotion 门禁同时满足时产出
6. 用真实 CLI 跑至少一轮验证：
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm run-daily -- --date <date> --dry-run`
   - `pnpm verify-daily -- --date <date>`
   - `pnpm visual-console -- --view overview --date <date>`

## 验收标准

### 验收 1：目录覆盖正式成立

- 可观测结果：16 个 must-cover 方向每天都有正式状态，不再出现“根本没搜”的灰区。
- 成功条件：每个方向都达到最小搜索责任，或正式带有 `search_exhausted / search_failed`。
- 失败条件：只是流程跑过，但没有方向级责任与解释。

### 验收 2：任务导向发现正式成立

- 可观测结果：daily 输出同时存在 `today_pulse_projects` 与 `mission_match_projects`。
- 成功条件：用户能明确区分全局热点与任务命中，且 mission 区不再被头部项目或伪相关补位挤占。
- 失败条件：最终展示仍退化为单一热榜。

### 验收 3：缺口账本正式成立

- 可观测结果：`gap_ledger` 对每个无结果或弱结果方向都给出状态、原因码、中文解释与下一动作。
- 成功条件：用户能区分“没候选”“只有噪声”“有苗头但不够格”“认真扩搜后仍未形成候选”。
- 失败条件：无结果仍表现为沉默空白。

### 验收 4：数量目标成为实现层硬约束

- 可观测结果：方向搜索下限、单方向候选下限、30 日库存下限、7 日新增量目标都能在 artifact 中被审计。
- 成功条件：mission 完成定义不再等同于“命令跑完”。
- 失败条件：覆盖率仍能被偷换成“执行过一轮搜索”。

### 验收 5：头部让位与新鲜感成立

- 可观测结果：全局脉冲稳定包含 `2 anchor + 2 challenger`，连续多日运行后仍能看到新挑战者。
- 成功条件：熟知头部项目仍可被观察，但不再长期垄断任务区和 challenger 位。
- 失败条件：前排仍主要被熟知头部重复占用。

### 验收 6：反馈闭环成立

- 可观测结果：反复搜不到、跳过、快速离开会推动方向进入 `pressurized` 并默认升级 deep。
- 成功条件：方向压力状态能驱动后续搜索与 observer promotion candidate。
- 失败条件：反馈只停留在日志，不影响发现策略。

### 验收 7：兼容与降级成立

- 可观测结果：mission 层失败时，全局脉冲仍能独立产出；旧 reader 兼容字段仍可读。
- 成功条件：新增能力异常不会让主产物失真，且日报产物会明确告诉用户“本次方向发现降级”。
- 失败条件：observer/context-only 被提升为伪 mission 命中，或旧 reader 直接崩溃。

## 验证矩阵

| 类型 | 验证内容 | 命令 / 方法 | 通过标准 |
| --- | --- | --- | --- |
| 静态 | 类型、配置、artifact schema 对齐 | `pnpm typecheck` | 无类型错误，新增字段命名一致 |
| 单元 | 方向目录冻结 | `pnpm test` | 16 个方向、家族、边界模式、lanes、query packs 完整 |
| 单元 | scout 责任与状态机 | `pnpm test` | 数量门槛、outcome、search exhausted 判定正确 |
| 单元 | deep 升级与库存目标 | `pnpm test` | deep 升级、滚动库存、7 日新增量 review 正确 |
| 单元 | gap pressure 状态切换 | `pnpm test` | `pressurized / relieved / promoted` 切换正确 |
| 单元 | 曝光位规则 | `pnpm test` | `anchor/challenger`、头部让位、任务区公平、explore ribbon 正确 |
| 集成 | run-daily 产出双栈发现 | `pnpm run-daily -- --date <date> --dry-run` | 同时写出 `today_pulse_projects / mission_match_projects / coverage_atlas / gap_ledger` |
| 集成 | mission 失败降级 | fixture / 集成测试 | 全局脉冲仍可用，mission 区不伪装命中，且日报/summary 明确输出 `mission_discovery_status=degraded` |
| 回归 | visual console 兼容 | `pnpm visual-console -- --view overview --date <date>` | overview/projects/run-health/observer 正常读取 |
| 回归 | verify-daily 契约 | `pnpm verify-daily -- --date <date>` | 新字段、`today_star_projects` 与旧兼容字段、降级语义均可观测 |
| 验收 | 30 日库存与 7 日新增量 | fixture / 历史窗口测试 | 门槛未达标会触发深搜或 review，而非静默通过 |

## 验证记录

| 时间 | 事实 | 结果 | 说明 |
| --- | --- | --- | --- |
| 2026-06-12 | 设计文档与需求文档对齐完成 | 已完成 | 计划以设计文档全部冻结决策为准，不再做产品发散 |
| 2026-06-12 | 现有主链路与模块映射完成 | 已完成 | 新能力将落在 `signal / action / visualConsole / observer / tests` |
| 2026-06-12 | 上游设计审批状态补齐 | 已完成 | `project-search-system-redesign-design.md` 已切换为 `Approved`，ExecPlan 不再代偿未决设计缺口 |

## 风险与缓解

### 风险 1：mission 方向扩搜带来更高噪声与 GitHub search 成本

- 缓解：先用 `boundary_mode`、`required_terms`、`negative_terms`、`evidence_verbs/objects` 过滤，再进入展示级质量门槛。
- 缓解：scout 负责广覆盖，deep 只对升级方向和库存赤字方向继续扩搜。

### 风险 2：实现者可能把产品冻结规则下放到 config

- 缓解：目录、数量目标、席位配额、状态机全部冻结在代码常量与类型层，配置只允许控制运行时并发与超时。

### 风险 3：observer 与 mission search 各写一套搜索逻辑

- 缓解：先抽共享 `githubRepositorySearch`，再让 observer 与 mission 共同复用。

### 风险 4：daily 表面改完，但 visual console/read layer 未同步

- 缓解：把 `readLayer/build/types` 明确列为 Phase 5 独立阶段，并将兼容字段纳入回归测试。

## 回滚策略

- 若 mission search 新增逻辑导致主链路不稳定，允许临时关闭 mission live search，只保留全局脉冲与兼容字段，但不得伪造 mission 命中。
- 若 `explore_ribbon_projects` 或任务区公平规则实现不稳定，允许暂时不展示 explore ribbon，但不得让任务区回退为单榜混排。
- 若 observer promotion 候选产出不稳定，允许先保留 incubating evidence，不自动给出 promotion candidate，但不得把 observer 结果混入主榜。
- 若 visual console 对新字段消费不稳定，允许短期只走兼容字段渲染，但 daily JSON 必须继续完整产出新契约。

## 结论记录

- 本计划覆盖设计文档中的全部核心冻结设计，不把任何关键机制留给实现阶段自由发挥。
- 本计划优先解决的是“搜得不够广、不够深、不可解释”的系统性问题，而不是继续在单榜上做权重微调。
- 本计划将以单次系统重构方式同时推进目录冻结、mission 发现、gap 语义、observer incubator、曝光重排、artifact 契约和 visual console 消费层。
- `2026-06-12` exec-plan review 已补齐 `gap pressure` 精确阈值、`explicit-interest` 审计输入与 `observer -> catalog promotion` 门禁，当前评审结论为 `APPROVE_WITH_NITS / Passable`。

## 下一阶段入口

- 本计划已通过 exec-plan review，可按 Phase 0 -> Phase 6 顺序实施，不允许跳过契约冻结直接改输出层。
- 实施时优先把 Phase 0 / Phase 2 / Phase 3 中新增的冻结门禁与审计字段落地，避免后续输出层先行导致语义漂移。
