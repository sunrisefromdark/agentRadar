# 执行计划：AgentReach 外部讨论趋势窗口 v0.1

## 文档状态

- 版本：`v0.1`
- 当前状态：`Approved for Implementation`
- 日期：`2026-07-03`
- 关联需求：`docs/specs/product-specs/外部发现与补证信号层需求分析.md`
- 关联设计：`docs/specs/design-docs/agentreach-external-discussion-trend-window-design.md`
- 设计状态：`Approved for ExecPlan`
- 说明：本计划只负责把已批准的外部讨论趋势窗口设计拆成可执行实现步骤，不修改代码、不调用外部平台 API、不生成真实运行产物。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | AgentReach External Discussion Trend Window |
| 负责人 | Codex |
| 风险等级 | `High` |
| 主要边界 | `External Discovery`、`Action / Weekly`、`Visual Console read model` |
| 主要影响范围 | `src/externalDiscovery/*`、`src/action/*weekly*`、`src/visualConsole/build.ts`、`app/client/*AgentReach*`、`src/__tests__/*`、`docs/specs/*`、`data/README.md` |
| 明确不触达 | 主评分公式、`RawSignal[]`、`discussion_score`、外部平台采集、AgentReach 上游配置、产品生态分支内容 |

## 价值判断

当前 AgentReach 已能产出单日 `DailyExternalAggregate`，可以展示“今天外部层发现了什么”。但它还不能稳定回答“这波讨论是短促噪声，还是近 7 日持续发酵”。该缺口直接影响需求文档中的外部趋势判断、weekly 方向观察和用户对“外部发现是否有价值”的理解。

本计划的价值是新增一个可审计的趋势窗口 artifact，把外部层从“单日候选列表”推进为“可判断持续性、跨平台、讨论者层级和噪声风险的次级证据层”。

## 目标

1. 基于最近 7 天 `DailyExternalAggregate[]` 生成 public-safe `ExternalDiscussionTrendWindow`。
2. 固定趋势窗口 canonical artifact：
   - `data/external-discovery/windows/YYYY-MM-DD.discussion-trend-window.json`
   - `data/external-discovery/windows/latest.discussion-trend-window.json`
3. 使用 rules-first 逻辑生成：
   - `components`
   - `momentum`
   - `verdict`
   - `weekly_eligible`
   - `weekly_gate_reasons`
   - `caveats`
4. 让 weekly 只把趋势窗口作为 external secondary evidence 消费，不改变主榜评分和排名。
5. 让 `/agentreach` UI 只读展示“近 7 日外部讨论”轻量摘要，不在 UI 侧重算趋势。

## 非目标

- 不新增外部平台。
- 不直接调用 AgentReach CLI、X / Reddit / HN / official web API。
- 不读取 `data/raw/external-discovery/**`。
- 不把 external trend 写入 `RawSignal[]`。
- 不新增或修改 `ScoreBreakdown` score component。
- 不让 LLM 生成 `momentum`、`verdict` 或 `weekly_eligible`。
- 不提交 `data/external-discovery/` 运行产物。
- 不把方向级趋势升级为项目级主结论。

## 不变量

实现完成后必须保持：

- `ScoreBreakdown.total_score` 公式不变。
- `discussion_score` 不消费 external evidence。
- 主榜排序不因 external trend 改变。
- `DailyExternalAggregate` 仍能独立服务今日外部发现页面。
- external raw input 仍是 local-only。
- `--dry-run` 不写 date-specific trend window 或 latest 指针。
- UI 和 weekly 不回退读取 raw input。

## 架构落点

### 新增或扩展模块

- `src/externalDiscovery/types.ts`
  - 追加 `ExternalDiscussionTrendWindow`、`ExternalTrendItem`、`ExternalTrendComponent`、`ExternalTrendCoverage`、`ExternalTrendAudit`、`ExternalTrendMomentum`、`ExternalTrendVerdict`、`ExternalTrendBindingConfidence`、`ExternalWeeklyGateReason`。
  - 不删除或重命名已有 external discovery 类型。

- `src/externalDiscovery/paths.ts`
  - 新增 `externalTrendWindowPath(date: string): string`。
  - 新增 `externalTrendWindowLatestPath(): string`。
  - 路径固定到 `data/external-discovery/windows/`。

- `src/externalDiscovery/trendWindow.ts`
  - 新增 7 日 aggregate reader、trend item builder、component builder、momentum / verdict / weekly gate rules、public-safe assertion。
  - 只消费 `DailyExternalAggregate[]`。
  - 不读取 provider raw input。

- `src/externalDiscovery/trendWindowIntegration.ts`
  - 封装 run-daily 后的 trend window planned write / real write。
  - 保持 dry-run 只返回 planned writes。
  - 非 dry-run 下，若当日 aggregate 不存在、窗口不足或 usable day 不足，写入 public-safe `status="insufficient"` date-specific artifact。
  - dry-run 下只返回 planned `insufficient` write，不落盘、不更新 latest。

- `src/externalDiscovery/redaction.ts`
  - 扩展 public-safe 检查以覆盖 `ExternalDiscussionTrendWindow`。
  - 禁止 raw text、raw handle、profile URL、cookie、token、session、OAuth、private diagnostics。

### 修改模块

- `src/action/runSummary.ts`
  - 追加 external discussion trend window 读取状态、artifact 状态、路径、coverage、usable day count、project / direction trend counts。
  - 不标记为 primary freshness source。

- `src/action/weeklyEnhancement.ts` / `src/action/weeklyReport.ts`
  - 读取 canonical trend window 或由 7 日 aggregate 派生的同一结构。
  - 只展示 `external_reinforcement` 与 `weekly_eligible=true` 的 `watch_signal`。
  - `noise_spike` 只进入风险提示或 audit，不作为正向趋势材料。

- `src/action/dailyVerification.ts`
  - 增加 trend window public-safe、score contamination、raw input fallback、direction-to-project pollution 检查。

- `src/visualConsole/build.ts`
  - 新增或扩展 AgentReach view-model，使 `/agentreach` 读取 trend window。
  - 只做展示适配，不重算 `momentum`、`verdict`、`weekly_eligible`。

- `app/client/*AgentReach*` 或当前 AgentReach 页面组件
  - 候选详情轻量显示 `近 7 日外部讨论`。
  - 展开区显示 components、gate reasons、caveats、具名讨论者摘要。
  - 不新增宽屏趋势 dashboard。

### 文档同步

- `data/README.md`
  - 说明 `data/external-discovery/windows/*.discussion-trend-window.json` 是 public-safe 派生 artifact。
  - 说明 `data/raw/external-discovery/**` 仍 local-only。

- `docs/specs/services/action-output.md`
  - 补充 weekly 可消费 external discussion trend window，但只作为 secondary evidence。

- `docs/specs/services/visual-console-testing-manual.md`
  - 补充 `/agentreach` trend window read-only、not_found / insufficient / partial 状态检查。

- `docs/specs/services/scoring-engine.md`
  - 如当前文档未说明 external trend 不进入 score，补充不变量。

## 数据契约

### Canonical artifact

```text
data/external-discovery/windows/YYYY-MM-DD.discussion-trend-window.json
data/external-discovery/windows/latest.discussion-trend-window.json
```

### `ExternalDiscussionTrendWindow`

必须实现设计文档冻结字段：

- `schema_version="external-discussion-trend-window.v1"`
- `anchor_date`
- `window_start`
- `window_end`
- `window_days=7`
- `status`
- `project_trends`
- `direction_trends`
- `coverage`
- `audit`
- `public_safe=true`
- `contains_raw_text=false`
- `contains_profile_urls=false`

### `ExternalTrendItem`

必须实现：

- `trend_id`
- `scope`
- `target_key`
- `display_name`
- `target_url?`
- `binding_confidence`
- `official_signal`
- `weekly_eligible`
- `weekly_gate_reasons`
- `weekly_gate_missing_reasons`
- `daily_counts`
- `mention_count_total`
- `active_day_count`
- `platform_count`
- `cross_platform_days`
- `distinct_actor_count`
- `top_tier_actor_count`
- `named_registry_actors`
- `components`
- `momentum`
- `verdict`
- `cannot_be_primary_conclusion=true`
- `evidence_ids`
- `source_aggregate_dates`
- `caveats`

### `ExternalTrendWindowReadStatus`

必须新增并冻结统一读取状态，供 UI / weekly / verify 共用：

```ts
type ExternalTrendWindowReadStatus =
  | "ok"
  | "not_found"
  | "parse_error"
  | "partial"
  | "insufficient"
  | "failed"
  | "skipped";
```

读取状态映射必须固定：

- 指定日期文件不存在 => `not_found`。
- JSON 解析失败或 schema 不匹配 => `parse_error`。
- artifact 内部 `status` 透传为 `ok` / `partial` / `insufficient` / `failed` / `skipped`。
- date-specific 路由不得静默回退读取 `latest`。
- latest 路由只读取 `latest.discussion-trend-window.json`。
- UI / weekly / verify 都不得在 trend window 缺失时回退读取 raw input。

## 字段派生规则

实现必须遵循设计文档 `6.4.1 字段派生与来源映射`，重点验证：

- `display_name` 不来自 raw title、raw text 或 LLM。
- `target_url` 不读取 raw provider URL 补齐。
- `source_count` 固定为 contributing `event_ids` 去重数量。
- `official_signal` 只由 `official_web` / `official_blog` platform 得出。
- `binding_confidence` 不由 LLM 或 title 猜测。
- `distinct_actor_count` 无法跨 evidence 去重时必须用保守口径并加 caveat。
- `top_tier_actor_count` 只来自 registry 命中的 `named_registry_actors.entity_id`。

## 阶段进度

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：执行前对齐 | `DONE` | 固定设计、当前代码基线、测试入口和不变量 | preflight receipt 已生成并通过 `--check` |
| Phase 1：类型、路径、public-safe 基座 | `DONE` | 增加趋势窗口类型、canonical path、redaction 检查 | 类型、路径、redaction 聚焦测试与 typecheck 通过 |
| Phase 2：趋势窗口 builder | `DONE` | 合并 7 日 aggregate，生成 trend items、coverage、audit | builder 单测覆盖窗口、字段派生、缺失日 |
| Phase 3：rules-first 判断 | `DONE` | 实现 components、momentum、verdict、weekly gate | 规则单测覆盖 spike/rising/fading/gate |
| Phase 4：artifact 写入与 dry-run | `DONE` | date-specific / latest 写入，dry-run planned write | 写入、latest、dry-run 单测通过 |
| Phase 5：weekly / run-summary / verify 消费 | `DONE` | weekly 只作为 secondary evidence 消费，verify 防污染 | action / verification 测试通过 |
| Phase 6：/agentreach UI read-only 展示 | `DONE` | 详情页显示近 7 日外部讨论，不重算趋势 | view-model / SSR 渲染测试通过 |
| Phase 7：文档与总体验收 | `DONE` | 同步 data README / specs，运行聚焦验证 | 验证记录补齐 |

## 实施阶段

### Phase 0：执行前对齐

1. 读取并确认以下文档状态：
   - `docs/specs/product-specs/外部发现与补证信号层需求分析.md`
   - `docs/specs/design-docs/agentreach-external-discussion-trend-window-design.md`
   - `docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md`
   - `docs/specs/exec-plans/agent-reach-external-discovery-and-evidence-v0.1.exec-plan.md`
2. 确认本计划不改变已存在 AgentReach provider / daily aggregate 语义。
3. 检查当前 `src/externalDiscovery/` 中已有文件：
   - `types.ts`
   - `paths.ts`
   - `aggregate.ts`
   - `dailyIntegration.ts`
   - `redaction.ts`
4. 确认 `src/externalDiscovery/weeklyWindow.ts` 若不存在，不复用旧名强行迁移；本计划新增 `trendWindow.ts` 作为趋势窗口 owner。
5. 写或更新结构测试，先让以下约束可被测试捕获：
   - canonical path 必须在 `data/external-discovery/windows/`。
   - UI / weekly 不得读取 `data/raw/external-discovery/**`。
   - trend window 不得引入 score component。
6. 在进入 Phase 1 生产实现前，必须执行 CodeImplementation preflight 并生成 receipt：
   - `corepack pnpm run code-implementation:preflight -- --exec-plan docs/specs/exec-plans/agentreach-external-discussion-trend-window-v0.1.exec-plan.md --write`
   - `corepack pnpm run code-implementation:preflight -- --exec-plan docs/specs/exec-plans/agentreach-external-discussion-trend-window-v0.1.exec-plan.md --check`
7. 预期 receipt 位置：
   - `docs/specs/agent-work/code-implementation-preflight.agentreach-external-discussion-trend-window-v0.1.json`
   - 若项目脚本实际生成同名变体 receipt，以脚本输出的 matching receipt 为准，但必须记录在验证记录中。
8. preflight `--check` 通过前，不得进入 Phase 1 生产代码实现。
9. 本阶段不改生产逻辑。

### Phase 1：类型、路径、public-safe 基座

1. 在 `src/externalDiscovery/types.ts` 追加趋势窗口类型和统一读取状态：
   - `ExternalDiscussionTrendWindow`
   - `ExternalTrendItem`
   - `ExternalTrendWindowReadStatus`
2. 在 `src/externalDiscovery/paths.ts` 追加：
   - `externalTrendWindowPath(date: string)`
   - `externalTrendWindowLatestPath()`
3. 在 `src/externalDiscovery/redaction.ts` 追加：
   - `assertPublicSafeTrendWindow(value: unknown)`
   - 或复用通用 public-safe scanner 并增加 trend window 测试。
4. 新增测试：
   - `src/__tests__/externalDiscussionTrendWindowTypeContract.test.ts`
   - `src/__tests__/externalDiscussionTrendWindowPath.test.ts`
   - `src/__tests__/externalDiscussionTrendWindowRedaction.test.ts`
5. 覆盖断言：
   - `cannot_be_primary_conclusion` 固定为 `true`。
   - `weekly_gate_reasons` 只能取四个 frozen reason。
   - `ExternalTrendWindowReadStatus` 只能取 `ok` / `not_found` / `parse_error` / `partial` / `insufficient` / `failed` / `skipped`。
   - canonical path 不得平铺在 `data/external-discovery/`。
   - raw text / profile URL / token 类字段会 fail。
6. 运行：
   - `pnpm test -- externalDiscussionTrendWindowTypeContract.test.ts`
   - `pnpm test -- externalDiscussionTrendWindowPath.test.ts`
   - `pnpm test -- externalDiscussionTrendWindowRedaction.test.ts`
   - `pnpm typecheck`

### Phase 2：趋势窗口 builder

1. 新增 `src/externalDiscovery/trendWindow.ts`。
2. 实现 7 日窗口日期计算：
   - `window_start = anchor_date - 6 days`
   - `window_end = anchor_date`
   - `window_days = 7`
3. 实现 aggregate loader：
   - 只读取 `data/external-discovery/YYYY-MM-DD.aggregate.json`
   - 记录 `expected_dates`
   - 记录 `loaded_dates`
   - 记录 `missing_dates`
   - 记录 `failed_dates`
   - 不读取 raw input
4. 实现趋势项归并：
   - project evidence 按 `scope:target_key` 合并到 `project_trends`
   - direction evidence 按 `scope:target_key` 合并到 `direction_trends`
   - `source_aggregate_dates` 记录参与日期
   - `evidence_ids` 保留可追溯引用
5. 实现字段派生：
   - `display_name`
   - `target_url`
   - `source_count`
   - `mention_count_total`
   - `active_day_count`
   - `platform_count`
   - `cross_platform_days`
   - `distinct_actor_count`
   - `top_tier_actor_count`
   - `official_signal`
   - `binding_confidence`
   - `caveats`
6. 若无法安全派生 `display_name`，使用 `target_key`，不得调用 LLM。
7. 若无法跨 evidence 安全去重 actor，使用保守口径并增加 caveat。
8. 新增测试：
   - `src/__tests__/externalDiscussionTrendWindowBuilder.test.ts`
9. 覆盖断言：
   - missing day 不当作 0。
   - failed aggregate 进入 coverage。
   - `display_name` 不使用 raw title。
   - `official_signal` 只来自 official platform。
   - direction 不进入 project trends。
10. 运行：
   - `pnpm test -- externalDiscussionTrendWindowBuilder.test.ts`
   - `pnpm typecheck`

### Phase 3：rules-first 判断

1. 在 `trendWindow.ts` 或独立 `trendRules.ts` 实现 frozen constants：
   - `usable_day_count >= 5` 正常判断
   - `usable_day_count = 3-4` partial
   - `usable_day_count < 3` insufficient
   - `max_daily_share >= 0.70` spike
   - `late_avg >= max(early_avg + 1, early_avg * 1.5)` rising
   - `early_avg >= max(late_avg + 1, late_avg * 1.5)` 且后两 loaded day 为 0 时 fading
   - stable 要求 `active_day_count >= 3` 且 `max_daily_share < 0.60`
2. 实现 components：
   - `discussion_volume`
   - `persistence`
   - `cross_platform_confirmation`
   - `actor_authority`
   - `binding_confidence`
   - `noise_risk`
3. 实现 verdict：
   - `external_reinforcement`
   - `watch_signal`
   - `noise_spike`
   - `insufficient`
4. 实现 direction weekly gate：
   - 4 选 2
   - `provider_tier_hint` 不得满足 registry gate
   - 未达 gate 的 direction 不进入 weekly 正文
5. 新增测试：
   - `src/__tests__/externalDiscussionTrendWindowRules.test.ts`
   - `src/__tests__/externalDiscussionTrendWindowDirectionGate.test.ts`
6. 覆盖断言：
   - 单日单平台无 official / registry => `noise_spike`
   - 多日单平台 => `watch_signal` 但可能非 weekly eligible
   - 多日跨平台项目 => `external_reinforcement`
   - 方向满足 1 个 gate => `weekly_eligible=false`
   - 方向满足 2 个 gate => `weekly_eligible=true`
   - provider hint 不产生 `top_tier_actor_count`
7. 运行：
   - `pnpm test -- externalDiscussionTrendWindowRules.test.ts`
   - `pnpm test -- externalDiscussionTrendWindowDirectionGate.test.ts`
   - `pnpm typecheck`

### Phase 4：artifact 写入与 dry-run

1. 新增 `src/externalDiscovery/trendWindowIntegration.ts`。
2. 接入 run-daily 后置步骤：
   - 当 daily aggregate 已真实写入时，构建并写入 trend window。
   - 当 `--dry-run` 时，只返回 planned write path。
   - 当 aggregate 缺失、窗口不足或 usable day 不足时，写入 `status="insufficient"` date-specific artifact，并保留 coverage / audit。
   - 当部分平台或部分日期可用但窗口仍可生成时，写入 `status="partial"` date-specific artifact，并保留 partial 平台与日期说明。
   - 当 JSON 解析失败但可以构造 public-safe 失败 artifact 时，写入 `status="failed"` date-specific artifact，并记录 `failed_dates`。
   - 当 public-safe 检查失败时，不写 date-specific artifact，也不更新 latest。
   - 当外部趋势窗口被显式禁用或 external discovery 未启用时，写入 public-safe `status="skipped"` date-specific artifact。
3. 实现 writer：
   - 写入 date-specific file
   - public-safe 检查通过后更新 latest pointer。
   - `latest` 在任何成功写入的 public-safe date-specific artifact 后更新，包括 `partial` / `insufficient` / `failed`。
   - `skipped` 只有在 public-safe skipped artifact 成功写入后才更新 latest。
   - public-safe 检查失败时不写 date-specific，也不写 latest。
4. 不改 raw input 读取逻辑。
5. 新增测试：
   - `src/__tests__/externalDiscussionTrendWindowWrite.test.ts`
   - `src/__tests__/externalDiscussionTrendWindowDryRun.test.ts`
6. 覆盖断言：
   - date-specific path 正确。
   - latest 只在 public-safe date-specific artifact 成功写入后更新。
   - `partial` / `insufficient` / `failed` 成功写入时也更新 latest。
   - aggregate missing / window insufficient / usable day insufficient 固定写 `insufficient` artifact，不回退为空列表。
   - parse failure 可构造 public-safe failure artifact 时固定写 `failed` artifact。
   - dry-run 不写任何 trend window 文件。
   - public-safe fail 不写 date-specific，也不写 latest。
7. 运行：
   - `pnpm test -- externalDiscussionTrendWindowWrite.test.ts`
   - `pnpm test -- externalDiscussionTrendWindowDryRun.test.ts`
   - `pnpm typecheck`

### Phase 5：weekly / run-summary / verify 消费

1. `runSummary` 增加：
   - trend window status
   - trend window read status：`trend_window_read_status`
   - trend window path
   - usable day count
   - project trend count
   - direction trend count
   - failed / missing date count
2. weekly 增加 external trend consumption：
   - 读取 canonical trend window。
   - date-specific missing 时表达 `not_found`，不得静默读取 `latest`。
   - JSON 解析失败或 schema mismatch 时表达 `parse_error`，不得渲染成空列表。
   - artifact 内部 `status` 透传为 `ok` / `partial` / `insufficient` / `failed` / `skipped`。
   - 不回退读取 raw input。
   - `noise_spike` 不进入正向趋势材料。
   - `direction_trends` 只有 `weekly_eligible=true` 才进入 direction observation。
3. verify 增加：
   - trend window public-safe 检查。
   - `ExternalTrendWindowReadStatus` 映射检查。
   - date-specific route 不得 fallback 到 latest。
   - trend window 不得污染 score。
   - direction trend 不得写成 project conclusion。
   - weekly / UI 不得读取 raw input。
4. 新增测试：
   - `src/__tests__/externalDiscussionTrendWindowActionOutput.test.ts`
   - `src/__tests__/externalDiscussionTrendWindowWeekly.test.ts`
   - `src/__tests__/externalDiscussionTrendWindowVerification.test.ts`
5. 运行：
   - `pnpm test -- externalDiscussionTrendWindowActionOutput.test.ts`
   - `pnpm test -- externalDiscussionTrendWindowWeekly.test.ts`
   - `pnpm test -- externalDiscussionTrendWindowVerification.test.ts`
   - `pnpm typecheck`

### Phase 6：/agentreach UI read-only 展示

1. 在 `src/visualConsole/build.ts` 或 AgentReach view-model adapter 中读取 trend window。
2. 新增 view-model 字段：
   - `trend_window_read_status`
   - `trend_window_status`
   - `trend_window_summary`
   - `selected_candidate_trend`
   - `direction_trend_items`
3. 候选详情展示：
   - `近 7 日外部讨论`
   - `momentum`
   - `active_day_count`
   - `platform_count`
   - `verdict`
   - caveats
4. 展开区展示：
   - components
   - gate reasons
   - named registry actors
   - insufficient / partial 状态说明
   - `not_found`：显示“指定日期暂无近 7 日外部讨论窗口”。
   - `parse_error`：显示“趋势窗口文件无法解析，请检查产物”。
   - `insufficient`：显示“近 7 日可用外部数据不足，暂不判断趋势”。
5. UI 禁止：
   - 不显示 `score` 作为主指标。
   - 不把 `partial` 写成无信号。
   - 不把 `not_found` / `parse_error` / `insufficient` 渲染成相同空态。
   - date-specific 页面不得 fallback 到 latest。
   - 不把空 `named_registry_actors` 写成没人讨论。
   - 不在 React / SSR 中重新计算 trend。
6. 新增测试：
   - `src/__tests__/agentReachTrendWindowViewModel.test.ts`
   - `app/client/__tests__/AgentReachTrendWindowView.test.tsx` 或项目现有 React 测试路径
7. 运行：
   - `pnpm test -- agentReachTrendWindowViewModel.test.ts`
   - `pnpm test -- AgentReachTrendWindowView.test.tsx`
   - `pnpm typecheck`

### Phase 7：文档与总体验收

1. 更新 `data/README.md`：
   - 说明 trend window public-safe 派生 artifact。
   - 说明 raw input 仍 local-only。
2. 更新 `docs/specs/services/action-output.md`：
   - weekly 可展示 external discussion trend secondary evidence。
3. 更新 `docs/specs/services/visual-console-testing-manual.md`：
   - `/agentreach` trend window read-only、not_found / partial / insufficient 验收。
4. 如 `docs/specs/services/scoring-engine.md` 尚未明确 external trend 不入 score，补充不变量。
5. 运行总体验收：
   - `pnpm test -- externalDiscussionTrendWindow`
   - `pnpm typecheck`
   - `pnpm test -- externalDiscovery`
   - `pnpm run-daily -- --date 2026-07-03 --dry-run --no-external-discovery`
   - `pnpm run-weekly -- --date 2026-07-03 --dry-run --no-external-discovery`
6. 检查 git diff：
   - 不得出现 `data/external-discovery/` 运行产物被提交。
   - 不得出现 raw external input。
   - 不得出现主 score 公式改动。
   - 不得出现 `RawSignal.source` 新增 external provider。

## 验收标准

1. 能基于最近 7 天 `DailyExternalAggregate[]` 生成 `ExternalDiscussionTrendWindow`。
2. 趋势窗口只写入 `data/external-discovery/windows/YYYY-MM-DD.discussion-trend-window.json` 与 `latest.discussion-trend-window.json`。
3. `dry-run` 不写 date-specific trend window 或 latest 指针。
4. 缺失日期进入 coverage，不当作 0。
5. partial aggregate 会让窗口状态或 caveats 体现 partial。
6. `display_name / target_url / source_count / official_signal / binding_confidence` 来源符合设计字段派生表。
7. 单日单平台爆发输出 `noise_spike`，不进入 weekly 正向材料。
8. 多日或跨平台项目可输出 `external_reinforcement`。
9. 方向级趋势必须满足 4 选 2 gate 才能 `weekly_eligible=true`。
10. `provider_tier_hint` 不得产生 registry participation。
11. `named_registry_actors` 只来自 public-safe registry 命中。
12. 所有趋势项都带 `cannot_be_primary_conclusion=true`。
13. weekly 只消费 trend window 或 public aggregate，不读取 raw input。
14. weekly 不改变主榜 score、ranking、discussion_score。
15. UI 只读展示 trend window，不在 UI 侧重算。
16. public-safe / redaction 检查通过。
17. `partial` / `insufficient` / `failed` / `skipped` 的 artifact 写入语义固定，不能被实现阶段改成空列表或静默跳过。
18. `latest` 只在 public-safe date-specific artifact 成功写入后更新，且覆盖 `partial` / `insufficient` / `failed` 成功写入场景。
19. UI / weekly / verify 共用 `ExternalTrendWindowReadStatus`，并区分 `not_found` / `parse_error` / `insufficient`。
20. date-specific 读取路径不得 fallback 到 latest，latest 路径不得读取 date-specific 或 raw input。

## 验证矩阵

| 文件位置或类型 | 验证内容 | 命令 | 通过标准 |
| --- | --- | --- | --- |
| `src/externalDiscovery/types.ts` | trend window 类型、枚举、`cannot_be_primary_conclusion` | `pnpm test -- externalDiscussionTrendWindowTypeContract.test.ts` | 字段和枚举与设计一致 |
| `src/externalDiscovery/types.ts`、consumer adapter | `ExternalTrendWindowReadStatus` 冻结与映射 | `pnpm test -- externalDiscussionTrendWindowTypeContract.test.ts`、`pnpm test -- externalDiscussionTrendWindowReadStatus.test.ts` | UI / weekly / verify 共用状态，`not_found` / `parse_error` 不被吞掉 |
| `src/externalDiscovery/paths.ts` | canonical windows path / latest path | `pnpm test -- externalDiscussionTrendWindowPath.test.ts` | 只允许 `data/external-discovery/windows/` |
| `src/externalDiscovery/redaction.ts` | public-safe trend window | `pnpm test -- externalDiscussionTrendWindowRedaction.test.ts` | raw text / handle / profile URL / token 类字段 fail |
| `src/externalDiscovery/trendWindow.ts` | 7 日合并、coverage、字段派生 | `pnpm test -- externalDiscussionTrendWindowBuilder.test.ts` | missing / failed / partial / field derivation 全覆盖 |
| `src/externalDiscovery/trendWindow.ts` 或 `trendRules.ts` | momentum / verdict / noise risk | `pnpm test -- externalDiscussionTrendWindowRules.test.ts` | spike/rising/fading/stable/insufficient 可复现 |
| `src/externalDiscovery/trendWindow.ts` | direction 4 选 2 gate | `pnpm test -- externalDiscussionTrendWindowDirectionGate.test.ts` | 未达 gate 不进 weekly |
| `src/externalDiscovery/trendWindowIntegration.ts` | write / latest / dry-run | `pnpm test -- externalDiscussionTrendWindowWrite.test.ts`、`pnpm test -- externalDiscussionTrendWindowDryRun.test.ts` | dry-run 不写，latest 只在 public-safe date-specific 成功写入后更新 |
| `src/externalDiscovery/trendWindowIntegration.ts` | `partial` / `insufficient` / `failed` / `skipped` artifact 写入语义 | `pnpm test -- externalDiscussionTrendWindowWrite.test.ts` | public-safe 状态产物写入规则和 latest 更新规则固定 |
| `src/action/*weekly*` | weekly secondary consumption | `pnpm test -- externalDiscussionTrendWindowWeekly.test.ts` | 不读 raw input，不污染主结论 |
| `src/action/*weekly*`、`src/action/dailyVerification.ts`、`src/visualConsole/build.ts` | date-specific read 不 fallback 到 latest | `pnpm test -- externalDiscussionTrendWindowReadStatus.test.ts` | date route 只读指定日期，latest route 只读 latest |
| `src/action/dailyVerification.ts` | verify 防污染和 public-safe | `pnpm test -- externalDiscussionTrendWindowVerification.test.ts` | score pollution / redaction fail 被拦截 |
| `src/visualConsole/build.ts`、AgentReach UI | read-only 展示 | `pnpm test -- agentReachTrendWindowViewModel.test.ts`、React 测试 | UI 不重算趋势，状态文案正确 |
| 全仓 | 类型和回归 | `pnpm typecheck`、`pnpm test -- externalDiscovery` | 聚焦测试通过 |

## 回滚策略

1. 若 trend window builder 失败，禁用 trend window 写入，保留 daily aggregate 和现有 `/agentreach` 今日发现展示。
2. 若 weekly 消费造成语义污染，回滚 weekly integration，仅保留 trend window artifact。
3. 若 UI 展示过重或误导，隐藏 trend window UI 区块，保留后端 artifact。
4. 任意回滚不得恢复 raw input 读取、不得改主 score、不得提交运行产物。

## 当前残余风险

- 真实外部讨论稀疏时，7 日窗口可能常见 `insufficient`；这是产品语义上的保守降级，不应通过放宽规则解决。
- 当前 `DailyExternalAggregate` 若缺少 target display name / URL，V1 只能按设计派生表保守展示；不能用 raw title 或 LLM 补齐。
- 如果上游 X / Reddit 长期 partial，趋势窗口可用性会下降，但不能把 partial 误写成无信号。
- UI 具体组件路径取决于当前 AgentReach 页面实现位置，exec-plan 实现阶段需先定位文件，不能顺手改其他页面风格。

## 下一阶段入口

本 exec-plan 已通过审核并进入 `Approved for Implementation`。实现前必须先执行 Phase 0 的 CodeImplementation preflight，receipt 检查通过后，再按 Phase 1 -> Phase 7 顺序执行代码实现。

## 验证记录

| 日期 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 2026-07-03 | 未运行 | `Not Started` | 本轮只生成 exec-plan，未修改实现代码 |
| 2026-07-03 | `corepack pnpm run code-implementation:preflight -- --exec-plan docs/specs/exec-plans/agentreach-external-discussion-trend-window-v0.1.exec-plan.md --write` | `PASS` | 生成 implementation preflight receipt |
| 2026-07-03 | `corepack pnpm run code-implementation:preflight -- --exec-plan docs/specs/exec-plans/agentreach-external-discussion-trend-window-v0.1.exec-plan.md --check` | `PASS` | receipt 校验通过，可以进入 Phase 1 |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/externalDiscussionTrendWindowTypeContract.test.ts` | `PASS` | Phase 1 类型与枚举契约 |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/externalDiscussionTrendWindowPath.test.ts` | `PASS` | Phase 1 canonical windows path |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/externalDiscussionTrendWindowRedaction.test.ts` | `PASS` | Phase 1 public-safe trend window |
| 2026-07-03 | `corepack pnpm typecheck` | `PASS` | Phase 1 类型检查 |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/externalDiscussionTrendWindowBuilder.test.ts` | `PASS` | Phase 2 builder、coverage、字段派生 |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/externalDiscussionTrendWindowRules.test.ts` | `PASS` | Phase 3 momentum / verdict / noise risk |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/externalDiscussionTrendWindowDirectionGate.test.ts` | `PASS` | Phase 3 direction 4 选 2 gate |
| 2026-07-03 | `corepack pnpm typecheck` | `PASS` | Phase 2/3 类型检查 |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/externalDiscussionTrendWindowWrite.test.ts` | `PASS` | Phase 4 write/latest/public-safe |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/externalDiscussionTrendWindowDryRun.test.ts` | `PASS` | Phase 4 dry-run 不落盘 |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/externalDiscoveryDailyIntegration.test.ts` | `PASS` | Phase 4 daily integration 写入趋势窗口 |
| 2026-07-03 | `corepack pnpm typecheck` | `PASS` | Phase 4 类型检查 |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/externalDiscussionTrendWindowReadStatus.test.ts src/__tests__/externalDiscussionTrendWindowActionOutput.test.ts src/__tests__/externalDiscussionTrendWindowVerification.test.ts src/__tests__/externalDiscussionTrendWindowWeekly.test.ts` | `PASS` | Phase 5 read-status / run-summary / verify / weekly secondary consumption |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/externalDiscussionTrendWindowTypeContract.test.ts src/__tests__/externalDiscussionTrendWindowPath.test.ts src/__tests__/externalDiscussionTrendWindowRedaction.test.ts src/__tests__/externalDiscussionTrendWindowBuilder.test.ts src/__tests__/externalDiscussionTrendWindowRules.test.ts src/__tests__/externalDiscussionTrendWindowDirectionGate.test.ts src/__tests__/externalDiscussionTrendWindowWrite.test.ts src/__tests__/externalDiscussionTrendWindowDryRun.test.ts src/__tests__/externalDiscoveryDailyIntegration.test.ts` | `PASS` | Phase 1-4 focused regression after Phase 5 |
| 2026-07-03 | `corepack pnpm typecheck` | `PASS` | Phase 5 typecheck |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/agentReachTrendWindowViewModel.test.ts` | `PASS` | Phase 6 /agentreach date-specific aggregate + trend window view-model and SSR rendering |
| 2026-07-03 | `corepack pnpm exec vitest run src/__tests__/externalDiscussionTrendWindowReadStatus.test.ts src/__tests__/externalDiscussionTrendWindowActionOutput.test.ts src/__tests__/externalDiscussionTrendWindowVerification.test.ts src/__tests__/externalDiscussionTrendWindowWeekly.test.ts src/__tests__/externalDiscussionTrendWindowTypeContract.test.ts src/__tests__/externalDiscussionTrendWindowPath.test.ts src/__tests__/externalDiscussionTrendWindowRedaction.test.ts src/__tests__/externalDiscussionTrendWindowBuilder.test.ts src/__tests__/externalDiscussionTrendWindowRules.test.ts src/__tests__/externalDiscussionTrendWindowDirectionGate.test.ts src/__tests__/externalDiscussionTrendWindowWrite.test.ts src/__tests__/externalDiscussionTrendWindowDryRun.test.ts src/__tests__/externalDiscoveryDailyIntegration.test.ts src/__tests__/agentReachTrendWindowViewModel.test.ts` | `PASS` | Phase 6 focused regression across trend window builder, consumers, and UI read model |
| 2026-07-03 | `corepack pnpm typecheck` | `PASS` | Phase 6 typecheck |
| 2026-07-04 | `corepack pnpm exec vitest run src/__tests__/agentReachTrendWindowViewModel.test.ts` | `PASS` | Phase 7 CLI text view coverage for `visual-console --view agentreach` |
| 2026-07-04 | `corepack pnpm exec vitest run src/__tests__/externalDiscussionTrendWindowReadStatus.test.ts src/__tests__/externalDiscussionTrendWindowActionOutput.test.ts src/__tests__/externalDiscussionTrendWindowVerification.test.ts src/__tests__/externalDiscussionTrendWindowWeekly.test.ts src/__tests__/externalDiscussionTrendWindowTypeContract.test.ts src/__tests__/externalDiscussionTrendWindowPath.test.ts src/__tests__/externalDiscussionTrendWindowRedaction.test.ts src/__tests__/externalDiscussionTrendWindowBuilder.test.ts src/__tests__/externalDiscussionTrendWindowRules.test.ts src/__tests__/externalDiscussionTrendWindowDirectionGate.test.ts src/__tests__/externalDiscussionTrendWindowWrite.test.ts src/__tests__/externalDiscussionTrendWindowDryRun.test.ts src/__tests__/externalDiscoveryDailyIntegration.test.ts src/__tests__/agentReachTrendWindowViewModel.test.ts` | `PASS` | Phase 7 focused regression after docs and CLI text view sync |
| 2026-07-04 | `corepack pnpm typecheck` | `PASS` | Phase 7 typecheck |
| 2026-07-04 | `corepack pnpm visual-console -- --view agentreach --date 2026-07-03` | `PASS` | Read-only CLI smoke; current workspace had no 2026-07-03 external aggregate/window, so output correctly reported `not_found` without writing artifacts |
