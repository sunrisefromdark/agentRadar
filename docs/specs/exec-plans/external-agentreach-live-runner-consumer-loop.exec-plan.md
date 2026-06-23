# 执行计划：External AgentReach Live Runner Consumer Loop

## 文档状态

- 当前状态：`Proposed`
- 对应需求：`docs/specs/product-specs/外部发现与补证信号层需求分析.md`
- 对应设计：`docs/specs/design-docs/external-agentreach-live-runner-consumer-loop-design.md`
- 计划范围：把外接 AgentReach 真实 runner 结果消费成可降级、可审计、可展示的 daily / weekly / browser 闭环。
- 非目标：不扩展旧 `src/agentReach/*` producer，不重新引入 web-search / X live provider / Visual Console WIP，不直接接平台 API，不修改主 score、`discussion_score` 或主源多源确认。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | External AgentReach Live Runner Consumer Loop |
| 负责人 | Codex |
| 风险等级 | `High` |
| 关联设计 | `docs/specs/design-docs/external-agentreach-live-runner-consumer-loop-design.md` |
| 主要影响范围 | `src/externalAgentReach/`、`src/externalDiscovery/`、`src/action/*`、`src/types.ts`、`src/visualConsole/*`、`app/visualConsole/*`、`app/client/*`、`src/__tests__/*` |
| 主要产物 | `agent-reach.external-discovery.v1` public-safe artifact、daily aggregate、weekly external artifacts、浏览器展示状态 |

## 目标

在现有 external AgentReach bridge 基线之上，补齐真实 runner 消费闭环：正式区分 `zero_relevant_results`，收紧 runner -> artifact -> daily / weekly / browser 的字段映射与 public-safe 审计，并保证外部层只作为次级发现与补证信号，不污染主结论链路。

本计划是 follow-up hardening，不替代既有 external AgentReach daily bridge 计划，也不把旧 `src/agentReach/*` producer 升级为正式发布链路。

## Key Changes

- 类型与状态合同：
  - 在 `ExternalCoverageStatus` 中新增 `zero_relevant_results`，并同步 runner stdout shape validation、artifact loader、daily presentation、weekly coverage counts、Visual Console 文案。
  - `ExternalProviderStatus` 保持 `ok | partial | skipped | failed`，不得加入 coverage-only 状态。
  - 新 live runner artifact 必须写 full V1 coverage matrix；旧 sanitized fixture 或旧 artifact 缺少新状态时仍可读取。
- runner / adapter 映射：
  - `gateway_status + configured` 映射到 artifact 顶层 `status`；runner 崩溃、非 JSON、非法 schema、public-safe 校验失败均落为 `failed`。
  - `coverage[platform].status` 映射到 artifact `coverage`；`zero_relevant_results` 只表示真实执行成功但无相关结果，不产生 event / observation。
  - `observations[].direction_labels` 只作为 runner 建议；consumer canonicalize 到 V1 闭集，未知 label 丢弃并进入 audit warning。
  - `target.topic_hint` 只能进入 event hint；`topic_key` 仍由 matching / topic context 生成，二者不得直接等价。
  - actor 只能保留 public-safe 语义或不可逆 identity hash；不得输出 handle、profile URL、token、cookie、session、OAuth、raw stderr、raw exception 或 local path。
  - `rejected_items.reason_code` 映射到 diagnostics / audit 的安全 reason code，并参与 rejected count。
- consumer 与展示：
  - daily aggregate 保持 event-first 统计；`zero_relevant_results` 的 accepted / observation count 必须为 0。
  - weekly 只消费最近 7 天 `DailyExternalAggregate[]`，4 个 gate 仍为 `cross_platform_confirmation`、`multi_actor_confirmation`、`multi_day_persistence`、`registry_tier_participation`，至少满足 2 个才输出 direction observation。
  - 浏览器 / Visual Console 必须明确展示 runner 状态、per-platform coverage、accepted / rejected 数量、真实 observation、project evidence、direction observation，并区分 `zero_relevant_results`、`not_configured`、`manual_import_only`、`unavailable`、`failed`。

## 阶段进度

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：执行前护栏 | `Pending` | 锁定设计来源、文件边界与 legacy producer 禁止扩展规则 | 结构测试能证明新闭环不依赖 `src/agentReach/*` legacy producer |
| Phase 1：coverage status hardening | `Pending` | 将 `zero_relevant_results` 升级为正式 coverage 状态 | 类型、loader、process runner schema、presentation 与 fixture 测试通过 |
| Phase 2：runner mapping audit | `Pending` | 补齐字段级映射和 public-safe 拒绝路径 | mapper / adapter 测试覆盖 query、coverage、direction label、actor hash、rejected items 与 diagnostics |
| Phase 3：daily / weekly consumer semantics | `Pending` | 保证 daily event-first、weekly 7 日 aggregate window 与 gate 语义稳定 | zero-result 不制造 observation；weekly gate 4 选 2 与 secondary-only 测试通过 |
| Phase 4：browser semantics | `Pending` | 补齐 Overview / Projects / Weekly / Run Health 可见状态 | 浏览器模型和文本渲染测试能区分各 coverage 状态 |
| Phase 5：verification and live smoke | `Pending` | 完成 focused tests、typecheck、preflight 与真实 runner 手动 smoke | 验证记录写入本计划，剩余风险明确 |

## 实施阶段

### Phase 0：执行前护栏

1. 读取并记录设计依据：
   - `docs/specs/design-docs/external-agentreach-live-runner-consumer-loop-design.md`
   - 既有 external AgentReach daily bridge 计划
   - 既有 external AgentReach primary search entry 计划
2. 扩展结构测试，断言：
   - `src/externalAgentReach/*` 不导入 `src/agentReach/*` producer registry 或 live provider。
   - V1 platform scope 仍只包含 `x_twitter`、`reddit`、`hacker_news`、`official_web`、`official_blog`。
   - `RawSignal`、score component、`discussion_score` 没有新增 external layer 污染入口。
3. 不在本阶段修改生产语义；如果结构边界无法成立，停止实现并回到设计修订。

### Phase 1：coverage status hardening

1. 在 `src/externalDiscovery/types.ts` 扩展 `EXTERNAL_COVERAGE_STATUSES`：
   - 新增 `zero_relevant_results`。
   - 不修改 `EXTERNAL_PROVIDER_STATUSES`。
2. 同步更新：
   - `src/externalAgentReach/processRunner.ts` coverage shape validation。
   - `src/externalDiscovery/agentReachProvider.ts` coverage parsing。
   - `src/externalDiscovery/dailyPresentation.ts` status label / no-result 判断。
   - weekly coverage status count 类型和相关 UI props。
3. 将现有以 `status="ok" + reason="zero_relevant_results"` 表达的测试和 fixture 迁移为 `status="zero_relevant_results"`。
4. 保留 legacy compatibility fixture / test：
   - 旧 `status="ok" + reason="zero_relevant_results"` artifact 仍可读取。
   - 缺少 `zero_relevant_results` 新状态的 sanitized fixture 仍可读取。
   - legacy zero-result 不得被解释为 `not_configured`、`unavailable` 或“没有外部讨论”。

### Phase 2：runner mapping audit

1. 在 `artifactMapper` / adapter 测试中固定字段级映射表：

| Runner 字段 | Artifact / Consumer 落点 | 规则 |
| --- | --- | --- |
| `gateway_status` | artifact `status` | 只映射到 provider status 四值 |
| `configured` | status mapping 输入 | `false` 只能表示未配置 / 未启用，不表示无讨论 |
| `coverage` | artifact `coverage` | full V1 matrix；zero result 不产生 item |
| `observations` | artifact `items` -> canonical events | 每个 item 必须 public-safe，且 `url` / `raw_ref` 至少一个存在 |
| `direction_labels` | consumer canonical labels | 只保留 V1 闭集，未知 label 进 warning |
| `target.topic_hint` | event `target.topic_hint` | 不直接等同 `topic_key` |
| actor identity | registry matching 输入 | 只允许不可逆 hash 或 public-safe actor type / display 语义 |
| `rejected_items.reason_code` | diagnostics / audit | 安全 reason code，不输出 raw text |
| `diagnostics.warnings` | diagnostics / audit warnings | 拒绝敏感文本并记录安全拒绝计数 |

2. 冻结 `gateway_status + configured` 到顶层 provider status 的映射：

| runner / gateway 状态 | configured | 顶层 provider status | platform coverage 语义 |
| --- | --- | --- | --- |
| `ok` | `true` / omitted | `ok` | 使用 runner 返回的 coverage；成功但无相关结果的平台必须用 `zero_relevant_results` |
| `partial` | `true` / omitted | `partial` | 部分平台可用，失败 / 不完整 / 无结果平台分别保留自己的 coverage status |
| `failed` | any | `failed` | 请求、执行、输出、schema 或 public-safe 失败的平台为 `failed` |
| `not_configured` | any | `skipped` | 未配置 / 未启用的平台为 `not_configured` |
| `skipped` | any | `skipped` | 明确 opt-out 或未运行；不得解释为无外部讨论 |
| `unavailable` | `true` | `failed` | backend 已配置但当前不可用；平台 coverage 为 `unavailable` |
| `unavailable` | `false` / omitted | `skipped` | backend 未配置或未启用；platform coverage 按 runner 明示保留 |

3. runner failure 必须写 public-safe failed artifact；只有 adapter 基础设施写盘失败才返回 provider override。
4. stdout 非 JSON、空 stdout、非法 shape、stderr 过大、stdout 过大、timeout、spawn error 都映射到稳定 safe reason code。

### Phase 3：daily / weekly consumer semantics

1. daily：
   - `zero_relevant_results` 平台 accepted / observation count 必须为 0。
   - 不把 zero result 制造成 direction candidate。
   - project-level evidence 与 direction-level observation 继续分层。
2. weekly：
   - 只读取 7 日 public `DailyExternalAggregate[]`。
   - `cross_platform_confirmation` 至少要求同一 project 或 direction 对象出现在 2 个不同 V1 平台。
   - `multi_actor_confirmation` 至少要求 2 个 canonical public-safe actor。
   - `multi_day_persistence` 至少要求 2 个不同自然日。
   - `registry_tier_participation` 只统计命中维护实体注册表且带 stable tier 的对象。
3. 输出保持：
   - `direction_label_counts`
   - `weekly_direction_observations`
   - `external_project_evidence_summaries`
   - `external_cross_platform_confirmations`
   - `direction_gate_audit`

### Phase 4：browser semantics

1. Run Health 必须展示：
   - runner / provider status。
   - full per-platform coverage。
   - accepted / rejected counts。
   - failed / skipped / zero result / not configured / manual import only 的原因。
2. Overview / Projects 只展示可消费价值卡和空状态说明，不暴露 raw diagnostics。
3. Weekly 只展示 direction-level secondary observation，不使用“趋势已确认”“强趋势”“行业趋势成立”等主结论语言。
4. Web Visual Console props 与 text render 都必须通过同一语义测试，避免 React 页面和文本页面分叉。

### Phase 5：verification and live smoke

1. focused tests：

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\externalAgentReachDailyBridge.test.ts src\__tests__\externalAgentReachLocalRunnerAdapter.test.ts src\__tests__\externalAgentReachStatusMapping.test.ts src\__tests__\externalDiscoveryAdapter.test.ts src\__tests__\externalDiscoveryDailyPresentation.test.ts src\__tests__\externalDiscoveryWeekly.test.ts src\__tests__\externalDiscoveryVerification.test.ts src\__tests__\visualConsoleExternalDiscovery.test.ts
```

2. typecheck：

```powershell
corepack pnpm run typecheck
```

3. implementation preflight：

```powershell
corepack pnpm run code-implementation:preflight -- --write
corepack pnpm run code-implementation:preflight -- --check
```

4. 手动 live smoke：

```powershell
.\node_modules\.bin\tsx.cmd src\cli.ts run-daily --date <YYYY-MM-DD> --external-agentreach-generate --external-agentreach-runner <runner-path>
```

验收时检查：
- 生成 `data/raw/external-discovery/YYYY-MM-DD.agent-reach.json`。
- artifact 通过 `loadAgentReachProviderArtifact` 消费。
- daily / run-summary / weekly / browser 输出能显示 coverage 与 secondary-only 文案。
- artifact 和派生产物不包含 token、cookie、session、OAuth、raw stderr、raw exception、local path、未脱敏 handle 或 profile URL。

## 验收标准

1. `zero_relevant_results` 是 coverage parser、runner schema、aggregate audit、weekly counts、browser 展示中的正式状态。
2. 顶层 provider status 仍只使用 `ok | partial | skipped | failed`。
3. 成功执行但无相关结果时，平台 coverage 为 `zero_relevant_results`，accepted / observation count 为 0。
4. 未配置、手动导入、不可用、失败和 zero result 在 daily / weekly / browser 中不会互相误读。
5. `direction_labels` 只接受 V1 闭集，未知 label 被审计并丢弃。
6. `topic_hint` 不直接等于 `topic_key`。
7. `provider_tier_hint` 不会升级为 registry tier，也不参与 `registry_tier_participation` gate。
8. rejected items 和 diagnostics 只保留 public-safe reason / warning。
9. 外部层不改变 `RawSignal`、主 score、`discussion_score`、主源多源确认或 primary conclusion。
10. 默认测试不执行真实网络或真实平台命令。

## 已落地内容

- 当前仅完成计划落盘。
- 生产代码、测试、fixtures、浏览器实现尚未在本计划下修改。

## 验证记录

| 日期 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 2026-06-23 | `corepack pnpm run exec-plan:review:preflight` | `Passed` | 初次 sandbox 运行被 Corepack 用户缓存权限挡住；提升权限重跑通过 |
| 2026-06-23 | `ExecPlan review` | `Approved` | 本计划已通过 exec-plan review；尚未进入代码实现验证 |

## 验证矩阵

| 设计冻结项 | 实施锚点 | 验证 |
| --- | --- | --- |
| full V1 coverage matrix | `statusMapping.ts` / `artifactMapper.ts` / loader | adapter + loader coverage tests |
| `zero_relevant_results` 正式状态 | `types.ts` / process runner / daily presentation / Visual Console | coverage status tests + UI render tests |
| runner failure fail-soft | `processRunner.ts` / `localRunnerAdapter.ts` | invalid stdout / timeout / non-zero exit tests |
| public-safe boundary | `artifactMapper.ts` / `redaction.ts` / loader | unsafe query / diagnostics / actor tests |
| direction label closed set | `agentReachProvider.ts` / matching | direction label canonicalization tests |
| weekly gate 4 选 2 | `weeklyWindow.ts` | direction gate tests |
| secondary-only 展示 | daily / weekly / Visual Console | action output + visual console tests |
| no legacy producer promotion | structure tests | no imports from `src/agentReach/*` producer registry |

## 回滚策略

- Phase 1 失败：回退 coverage union 扩展，继续使用旧 `status="ok" + reason="zero_relevant_results"` 兼容表达，并回到设计复审。
- Phase 2 失败：不发布 live runner artifact mapper hardening；保留现有 bridge 行为。
- Phase 3 失败：daily / weekly 外部层保持 skipped / partial 降级，不阻塞主 daily / weekly 产物。
- Phase 4 失败：browser 字段仅 additive 回退，避免破坏现有 readers。
- 任一阶段需要改动主 score、主源确认或 V1 platform scope 时，停止实现并回到设计文档。

## 结论记录

- 结论：本计划已通过 exec-plan review，可进入实现。
- 当前代码状态：未实施。
- 当前风险：现有实现中 zero-result 仍可能通过 reason 表达；实现阶段必须迁移为 coverage status 并保留兼容。

## 下一阶段入口

通过 exec-plan review 后进入实现。后续如需扩展真实 MCP / HTTP service、actor timeline、video / podcast / long-content 平台、Visual Console 重构或旧 `src/agentReach/*` producer 迁移，必须另开独立 exec-plan。
