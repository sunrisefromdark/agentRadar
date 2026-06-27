# 执行计划：行业级Agent趋势判断-政策金融组 v0.1

## 文档状态

- 版本：`v0.1`
- 当前状态：`In Progress`
- 上游总控：
  - `docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-v0.1.exec-plan.md`
- 对应设计：
  - `docs/specs/design-docs/行业级Agent趋势判断设计/02-证据轴与相关性门控.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/03-数据模型契约.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/05-多Agent协作与中间件.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/06-工具保障与SeedRegistry.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/08-验证追溯与完成定义.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/09-术语与审计词汇表.md`
- 负责人：`1号执行人`

## 当前进度

### 一句话状态

- 本组对 `4号执行人` 的正式 handoff 前提已经交齐：
  - `envelope`
  - `payload`
  - `manifest`
  - `artifact refs`
  - `execution_context`
  - claim-critical 场景下的 same-run 必填 ref
- `4号执行人` 已用这批输入接通 `normalization dry-run`。
- 当前不再缺本组输入；剩余未完成项只在中台运行时消费层。

### 对 4 号的接收条件

| 条件 | 当前状态 | 说明 |
| --- | --- | --- |
| `envelope / payload / manifest / artifact refs` 交齐 | `DONE` | current / negative bundle fixture、delivery manifest、checksums 已提供 |
| `execution_context` 完整 | `DONE` | current bundle 已带 `primary_responsibility_id` 与 `operational_executor_id`，并有 platform contract / dry-run 覆盖 |
| `takeover` 语义明确 | `DONE` | 当前交付全部显式为 `takeover_mode: none`，不存在需要 4 号脑补的 takeover 空洞 |
| claim-critical same-run 必填 ref 交齐 | `DONE` | current fixture / current bundle 已带 `dispatch_context_ref`、`scheduling_key`、stable claim key、admission ref、reservation refs |
| negative reject 样本交齐 | `DONE` | 已提供缺 stable claim key 的 negative fixture / negative bundle，4 号可直接按合同拒收 |
| `normalization dry-run` 已接通 | `DONE` | 中台 `financePolicyDryRun.ts` 与 `normalization.test.ts` 已消费本组 current / negative bundle |
| dispatch runtime 真消费 same-run refs | `WAITING_4` | 仍待 4 号把 same-run refs 从 dry-run 校验接到真实 runtime path |
| shared governance 真运行时接线 | `WAITING_4` | 仍待 4 号把 activation / stop / budget / same-run 行为接成运行时实现 |

| Phase | 状态 | 已落地项 | 说明 |
| --- | --- | --- | --- |
| Phase 1-2：source / route / event / handoff 骨架 | `DONE` | `finance-agent`、`policy-agent` 目录骨架、source catalog、route selection、event builder、handoff、unit/contract/negative/replay fixture 与测试骨架 | 当前仓库内可独立落地的骨架、最小领域验证与 producer artifact 校验已闭环 |
| Phase 3-4A：正式 cross-group contract 收口 | `DONE` | canonical payload 名、message kind、`industry://` artifact ref、payload 顶层 canonical 字段、finance-policy handoff gate dry-run | 已对齐中台 `Phase 1A` contract，并通过平台 handoff gate 验证 |
| Phase 3-5：shared governance / same-run / activation-budget 正式接线 | `IN_PROGRESS` | 本组 producer 接线、正式 bundle 交付、negative 样本、normalization dry-run 前提均已完成 | 本组侧能独立完成的部分已做完；剩余只待 `4号执行人` 把 same-run / activation / stop / budget 接成平台运行时行为 |

## 落地标记（截至 2026-06-26）

### 已完成

| 项目 | 当前判断 | 依据 |
| --- | --- | --- |
| `finance-agent` / `policy-agent` 目录骨架 | `DONE` | 目录与建议文件已存在，source / route / event / handoff 已落在本组目录 |
| 三轴 source catalog 与 official-first route 基线 | `DONE` | finance / regulatory / thinktank 的 source catalog 与 route selection 已实现 |
| 三轴 canonical event / batch producer 骨架 | `DONE` | accepted / counter / diagnostic / rejected 四类 batch 已能生成 |
| tool coverage / contribution 基础产物 | `DONE` | 三轴 coverage 与 contribution 已可生成；计数闭合缺口已在本轮修复 |
| daily handoff 轻索引输入骨架 | `DONE` | `daily-industry-evidence-pack-input.v1` 已生成，且 `coverage_refs=3`、`contribution_refs=3` 有 contract test |
| owner-boundary / official-first / anti-upgrade 基础 fixture | `DONE` | finance 与 policy 目录下已落基础反例样本 |
| 本组最小领域回归 | `DONE` | finance unit、policy unit / negative / contract 共 6 条测试通过 |

### 已完成（本轮补齐）

| 项目 | 当前判断 | 说明 |
| --- | --- | --- |
| finance 侧 `contract / negative / replay` 测试补齐 | `DONE` | 已补 finance `contract.test.ts`、`negative.test.ts`、`replay.test.ts` |
| policy / finance fixture 细化与 replay 覆盖 | `DONE` | 已新增 finance `compatibility/`、`replay/` fixture，并补 group replay 覆盖 |
| stop / budget 本地弱接线回归 | `DONE` | 已补 finance timeout-budget / fallback / last-resort 回归 |
| preparatory producer fixture 整理 | `DONE` | 已用 replay/contract 测试固定 `source_message_ids`、batch refs、coverage refs、contribution refs 的包装关系 |
| same-run runtime ref producer 接线 | `DONE` | 已补 claim-critical `capability_class`、`dispatch_context_ref`、`scheduling_key`、stable claim key、admission / reservation refs 的 envelope 透传，并通过 platform consumer/runtime gate；同轮补齐缺 stable claim key / reservation 的 negative 回归，并产出 same-run current/negative compatibility fixture |
| shared-runtime 对接清单 | `DONE` | 已提交本组 `shared-runtime-note`，明确中台需要上收的 normalization consumer、same-run dispatch runtime consumer 与 shared governance lookup 接线点 |
| stable export / handoff 入口 | `DONE` | 已补 `policy-agent/index.ts` 与 `finance-agent/index.ts`，对外稳定导出 handoff builder / bundle 入口，降低中台对文件内部路径的耦合 |
| next-step 对接清单 | `DONE` | 已补 machine-readable `phase1-next-platform-actions.json`，把 4 号下一步必须落的 normalization / same-run runtime / shared governance 消费动作显式列出 |
| delivery checksum 清单 | `DONE` | 已补 machine-readable `phase1-delivery-checksums.json`，让 4 号可对 current/negative bundle、same-run fixture、notes 与 stable entrypoint 做输入校验 |

### 必须等 4 号

| 项目 | 当前判断 | 阻塞原因 |
| --- | --- | --- |
| 正式 cross-group handoff 收口 | `DONE` | 已切到 canonical payload 名、正式 message kind 与 `industry://` artifact ref，并通过平台 `financePolicyHandoff` gate 的 dry-run 验证 |
| current / previous compatible consumer fixture 最终对接闭环 | `DONE` | 已对齐 compatibility matrix，并由领域 contract test + 平台 contract gate 覆盖 |
| `dispatch_context_ref` / reservation / admission 等 same-run 接线 | `WAITING_4` | 本组 producer 交付、fixture、bundle、dry-run 输入已交齐；剩余只待 4 号把 same-run ref 接入真实 runtime path |
| activation / stop / budget 正式治理接线 | `WAITING_4` | 本组 `shared-runtime-note` 已提交，normalization dry-run 已落；剩余只待 4 号把共享治理 profile 与受控 reason/state 字典接入实际运行时消费链路 |
| 正式提交给中台组消费的 envelope / payload / manifest 套件 | `DONE` | 本组已交齐 current / negative bundle、delivery manifest、checksums、handoff note、shared-runtime note、stable entrypoint；4 号不应再因缺本组输入而阻塞 |

## 目标

只把政策与金融三轴输入面做扎实：稳定产出 `IndustrySignalEvent`、`AxisToolCoverageReport`、`IndustryAgentContribution` 和失败/降级账本，不碰最终 tier decision。

## 负责范围

对应运行时 Agent：

- `finance-agent`
- `policy-agent`

对应职责项：

- `capital-finance`
- `policy-regulatory`
- `policy-research-thinktank`

负责交付：

1. finance / policy / thinktank 三轴 canonical event 生产。
2. official-first route 选择、降级、stop policy、budget 命中与 reason code 落账。
3. 这三轴的 daily 输入包、tool coverage、agent contribution、rejected / failed / unavailable 证据。

## 单写者边界

### 允许修改

- `src/industry/agents/finance-agent/*`
- `src/industry/agents/policy-agent/*`
- `src/__tests__/industry/agents/finance-agent/*`
- `src/__tests__/industry/agents/policy-agent/*`
- `fixtures/industry/agents/finance-agent/*`
- `fixtures/industry/agents/policy-agent/*`
- `data/industry-seeds/agents/finance-agent/*`
- `data/industry-seeds/agents/policy-agent/*`
- finance / policy tool fixture、doc fixture
- 本组目录下的 docs-note / handoff-note / fixture note

### 禁止修改

- 不得直接修改 `schemas/industry/*`
- 不得修改 `src/action/weekly*`
- 不得写 `decision_tier`、`decision_confidence`、`coverage_audit_state`
- 不得把搜索聚合、媒体转述、研究摘要直接当 `policy_regulatory` 或 `capital_finance` 的 primary supporting source
- 不得直接修改 `docs/specs/services/*`、`docs/specs/constraints/*`、`docs/specs/feedback-loops/*`、`README.md`、`data/README.md`

## 工作目录与文件落点

本组独立工作目录固定为：

- `src/industry/agents/finance-agent/*`
- `src/industry/agents/policy-agent/*`
- `src/__tests__/industry/agents/finance-agent/*`
- `src/__tests__/industry/agents/policy-agent/*`
- `fixtures/industry/agents/finance-agent/*`
- `fixtures/industry/agents/policy-agent/*`
- `data/industry-seeds/agents/finance-agent/*`
- `data/industry-seeds/agents/policy-agent/*`

目录内建议按“轴 + 流水线阶段”拆分，避免一个文件同时承载 source、budget、event、handoff：

- `src/industry/agents/finance-agent/sourceCatalog.ts`
- `src/industry/agents/finance-agent/routeSelection.ts`
- `src/industry/agents/finance-agent/fetchStopPolicy.ts`
- `src/industry/agents/finance-agent/eventBuilder.ts`
- `src/industry/agents/finance-agent/coverageReport.ts`
- `src/industry/agents/finance-agent/contributionLedger.ts`
- `src/industry/agents/finance-agent/handoff.ts`
- `src/industry/agents/policy-agent/regulatorySourceCatalog.ts`
- `src/industry/agents/policy-agent/regulatoryRouteSelection.ts`
- `src/industry/agents/policy-agent/thinktankSourceCatalog.ts`
- `src/industry/agents/policy-agent/thinktankRouteSelection.ts`
- `src/industry/agents/policy-agent/eventBuilder.ts`
- `src/industry/agents/policy-agent/coverageReport.ts`
- `src/industry/agents/policy-agent/contributionLedger.ts`
- `src/industry/agents/policy-agent/handoff.ts`
- `src/__tests__/industry/agents/finance-agent/{contract,unit,negative,replay}*.test.ts`
- `src/__tests__/industry/agents/policy-agent/{contract,unit,negative,replay}*.test.ts`

落点约束：

- finance 轴逻辑只放 `src/industry/agents/finance-agent/*`，不得回写 `src/action/*`。
- `policy_regulatory` 与 `policy_research_thinktank` 虽同属 policy 组，但 source class、route、anti-upgrade fixture 必须拆文件，不能揉成一个 `policy.ts` 大文件。
- 本组若需要共享本组内部 helper，只能放在 `src/industry/agents/finance-agent/` 或 `src/industry/agents/policy-agent/` 下；不得把 helper 扔进共享目录等别组复用。
- fixture 按语义拆目录：`fixtures/industry/agents/finance-agent/{official-first,owner-boundary,anti-upgrade,compatibility}/`、`fixtures/industry/agents/policy-agent/{official-first,owner-boundary,anti-upgrade,compatibility}/`，避免所有反例堆在一个文件。
- 现有 `src/industry/tools/*`、其他旧目录只允许只读复用；如需改写或抽共享 runtime，必须先提 `shared-runtime-note`，由中台组上收进 `src/industry/platform/*`。

### 运行方式

- 本组优先使用独立 worktree / workspace root；若无法隔离，至少保证只写本组目录与本组 fixture / seed / test。
- `finance / policy` 的 source catalog、route selection、coverage、handoff 只允许在本组目录内闭合，不得写进 `src/action/*`。
- `shared-runtime-note` 只负责描述需要上收的共享运行时，不允许把政策金融 helper 再复制进学术或产品生态目录。
- 若需要修改跨组 specs / README，只能提交 `docs-change-note` 给中台组统一写入；本组不得直接改跨组文档真源。

文件规模约束：

- 任意文件必须 `< 2000` 行。
- 任一文件超过 `1200` 行时，立即按 finance / regulatory / thinktank 或按 `source -> policy -> builder -> handoff` 拆分。
- 测试文件超过 `800` 行时，优先拆成 contract、unit、negative、replay 四类。

## 依赖输入

最小开工只需要拿到：

1. 已批准设计文档中的 official-first、source authority、finance/policy 语义冻结结论。
2. 总控计划中的单写者边界、职责映射表与目录命名模板。
3. `daily-industry-evidence-pack-input.v1` 最小数组合同。

其中：

- `Day-0/Day-1` 零等待开工不要求先拿到中台已 materialize 的 machine-readable bundle；本组可先按设计冻结语义启动 source / route / fixture / seed / local adapter seam。
- 进入跨组 handoff 冻结、claim-critical payload 编码与 same-run 接线前，仍必须回到中台组发布的 schema 真源版本与 reason/state 字典。

以下资产属于“后接线依赖”，不阻塞本组先做 source / event / fixture / handoff producer：

- 已发布的共享治理契约：
   - `field-ownership-policy.v1`
   - `fact-resolution-profile.v1`
   - `agent-relevance-profile.v1`
   - `SourceAuthorityContextProfile`
   - `tool-selection-scorecard.v1`
   - `axis-runtime-budget-profile.v1`
   - `axis-activation-policy.v1`
   - `canonical-fetch-stop-policy.v1`
   - `same-run-eligible-micro-task-matrix.v1`
   - `micro-task-runtime-budget-profile.v1`
   - `micro-task-cost-profile.v1`
   - `claim-admission-budget-profile.v1`
   - `claim-runtime-budget-profile.v1`
   - `run-critical-path-budget.v1`
   - `shared-capacity-policy.v1`
   - `run-total-budget-policy.v1`
   - `same-run-review-availability-policy.v1`
   - `gap-scope-contract.v1`
   - `message-key-policy.v1`
   - `runtime-concurrency-control-policy.v1`
- 已发布的 dispatch / budget runtime 基座：
   - `same-run-dispatch-context.v1`
   - `CapacityReservation`
   - `BudgetArbitrationRecord`
   - current consumer / negative fixtures

执行约束：

- 若共享治理或 dispatch 基座尚未发布，本组必须先在本组目录内保留 adapter seam、schema-aligned producer fixture 与 negative fixture，不得停工等待。
- 未接入 shared governance 前，可以先完成 source catalog、event builder、batch writer、coverage / contribution writer 与 owner / anti-upgrade fixtures；但不得本地发明新的正式字段、reason code 或 state 语义。
- 若 `shared-runtime-note` 尚未被中台上收，本组允许先在 finance/policy 目录内保留只服务本组的临时 wrapper / adapter seam；但不得把它暴露成别组依赖的共享运行时。

## 给实现人的白话派工

### 你先做什么

- 先把 `finance-agent`、`policy-agent` 目录骨架搭好。
- 先把 official-first source catalog、route 草稿、stop policy 草稿写出来。
- 先把 negative fixture、owner-boundary / anti-upgrade 样本补齐。
- 先把本组 local adapter seam 和 contract / unit / replay 测试骨架跑起来。

### 第一阶段做到哪一步就可以先交

- 只要你已经能稳定产出本组 event batch 草稿、coverage / contribution 草稿，并且 fixture 能覆盖正例和反例，就可以先把 preparatory artifact refs 交给 `4号执行人` 做早期 contract review。
- 这一步不要求你已经接好最终 same-run，也不要求学术组或产品生态组已经完成。

### 你只在这些时点必须等待

- 只有在你要把本组结果正式交给别组消费时，才需要等待 `4号执行人` 的 `Phase 1A`。
- 只有在你要写正式 `industry-signal-event-batch.v1`、`axis-tool-coverage-report.v1`、`industry-agent-contribution.v1` 并作为跨组真交接件提交时，才需要等 canonical schema 和 payload 正式名冻结。
- 只有在你要接 same-run 的高成本路径时，才需要等 dispatch / budget runtime 基座。

### 现在继续推进需要谁产出什么

- `1号执行人（本组）`：
  - 当前无需再补新的政策金融输入，除非 `4号执行人` 在实际 runtime 接线时给出新的合同拒收项。
- `4号执行人`：
  - 继续把 `dispatch_context_ref`、`scheduling_key`、stable claim key、admission / reservation refs 接入真实 runtime path。
  - 继续把 `axis-activation-policy.v1`、`canonical-fetch-stop-policy.v1`、`axis-runtime-budget-profile.v1`、`same-run-review-availability-policy.v1` 等 shared governance profile 接成运行时行为。
  - 若 runtime 接线后新增拒收项，必须按合同明确指出缺的字段或语义，而不是让本组猜。
- `2号执行人 / 3号执行人`：
  - 不阻塞政策金融组这条线继续进入平台 runtime；只在做最终 weekly 集成时才重新形成强依赖。

### 从现在到集成前的完整流程

| 顺序 | 谁推进 | 要做什么 | 完成标志 | 完成后是否还需要本组回合 |
| --- | --- | --- | --- | --- |
| 1 | `4号执行人` | 继续在平台 runtime path 消费 same-run refs，而不只停在 `normalization dry-run` | current bundle 能走过真实 runtime path，negative bundle 能在 runtime path 按合同拒收 | `通常不需要` |
| 2 | `4号执行人` | 把 `axis-activation-policy.v1`、`canonical-fetch-stop-policy.v1`、`axis-runtime-budget-profile.v1`、`same-run-review-availability-policy.v1` 等 shared governance profile 接成运行时行为 | activation / stop / budget / same-run 行为由运行时实现驱动，不再只是 contract/fixture 校验 | `通常不需要` |
| 3 | `4号执行人` | 若 runtime 接线时发现本组字段或语义仍不满足合同，按拒收项明确指出缺什么 | 出现明确的字段级 / 语义级拒收单 | `需要本组补一次` |
| 4 | `1号执行人（仅在被明确拒收时）` | 只按明确拒收项补字段、样本或契约，不扩新语义 | 拒收项被关闭，相关回归转绿 | `补完后再回到4号` |
| 5 | `4号执行人` | 完成政策金融线的 runtime 消费闭环后，继续并行接另外两组，再做 cross-group normalization / audit / weekly 拼装 | 三组正式 handoff 都已进入中台主链路 | `此时本组无需单独推进` |
| 6 | `4号执行人 + 全员` | 进入最终 weekly 集成与总验收 | weekly internal / consumer / public 三层产物齐备 | `进入集成阶段` |

### 来回轮次预期

- `最优路径`：
  - 当前这轮之后，本组不再需要新增交付；`4号执行人` 直接完成 runtime path 与 shared governance 接线，然后进入跨组集成。
- `保守路径`：
  - `4号执行人` 在 runtime 接线时给出一次明确拒收单；
  - 本组只按拒收项补一次；
  - 补完后回到 `4号执行人` 继续完成剩余平台实现。
- `不接受的路径`：
  - 反复以“缺政策金融输入”为由停工，但不给出明确合同拒收项；
  - 这不符合当前执行计划，因为本组已交齐 `envelope / payload / manifest / artifact refs / execution_context / same-run refs / current-negative bundle / manifests / checksums`。

### 等到什么产物出来再继续

- 等到 `4号执行人` 发出 canonical schema、reason/state 真源、artifact path、payload 正式名。
- 等到 current consumer fixtures 和 compatibility matrix 可用后，再把本地 seam 收口成正式 handoff。

### 不要等什么

- 不要等学术组先交 citation 样本。
- 不要等产品生态组先交 owner-boundary 模板。
- 不要等 shared runtime 先抽好；先在本组目录内留临时 seam 继续做。

### 本组从开工到完工的顺序

1. 先在本组目录里把 source catalog、route 草稿、fixture、local seam、测试骨架做起来。
2. 等 `4号执行人` 发出 `Phase 1A` 的 canonical schema、payload 正式名、artifact path 后，把本地 seam 收口成正式 handoff。
3. 先把本组正式 envelope / payload / manifest / refs 交给 `4号执行人`；如果本组先准备好，就先进入 contract test 和 normalization dry-run，不等另外两组。
4. 等 `4号执行人` 发布 `Phase 1B / 1C` 后，再把 activation / stop / budget / same-run 这些后接线能力接上。
5. 最后等三组都完成正式 handoff 后，再一起进入最终 weekly 集成和总验收。

## 输出与 handoff

必须交给中台组的产物：

1. `industry-signal-event-batch.v1` envelope + payload + manifest：
   - `capital_finance` accepted / counter / diagnostic / rejected batch refs
   - `policy_regulatory` accepted / counter / diagnostic / rejected batch refs
   - `policy_research_thinktank` accepted / counter / diagnostic / rejected batch refs
2. 三轴 `axis-tool-coverage-report.v1` envelope + payload + manifest
3. 三条 `industry-agent-contribution.v1` envelope + payload + manifest
4. `daily-industry-evidence-pack-input.v1` envelope + payload + manifest
5. 失败 / unavailable / review-needed artifact refs
6. 若命中 same-run admission / budget / review，必须附 `dispatch_context_ref`、`scheduling_key` 与相关 reservation / admission refs
7. `cross_responsibility_attestation_refs?`、official-first failure refs、owner boundary negative fixture refs

handoff 要求：

- event 必须符合 `industry-signal-event.v1`
- `execution_context.primary_responsibility_id` 必须与 event 的 `responsibility_id` 一致；`execution_context.operational_executor_id` 必须如实记录这次实际执行采集/补证的 Agent
- 若存在 delegated execution / takeover / backfill，必须显式带 `takeover_mode` 与 `takeover_audit_ref`；否则宁可记 `unavailable / needs_review`，不得伪装成正常已覆盖
- tool coverage 必须显式包含 `active_source_class`、`active_route_level`、`degraded`、`degradation_reason_codes`
- official fetch 停止时必须留下 `stop_reason_code`
- 不得只交 batch 路径字符串；必须交完整 `IndustryAgentMessageEnvelope`、`payload_ref`、`IndustryAgentArtifactManifest`、`input_artifact_refs`、`output_artifact_refs`
- `IndustryAgentContribution` 必须按 `responsibility_id` 拆成三条：
  - `capital-finance`
  - `policy-regulatory`
  - `policy-research-thinktank`
- `DailyIndustryEvidencePack` 输入只能交 ref 与 lineage，不得内嵌 accepted / rejected 全量 event
- 本组只负责提交 `daily-industry-evidence-pack-input.v1`；`DailyIndustryEvidencePack.v2` 只能由中台组 materialize 和写盘
- `daily-industry-evidence-pack-input.v1` 必须使用数组字段；本组冻结为 `coverage_refs=3`、`contribution_refs=3`，且 `normalized_event_batch_refs` 必须覆盖三轴 canonical batch
- 若同一事实被新闻、社区、政策摘要或金融转述侧同时看到，本组只能提交一个 provisional owner accepted event；其余必须走 attestation / context / relation edge

## 实施阶段

### Phase 1：source class 与 route 基线

1. 以总控已冻结的目录模板为前提，只在本组既定工作根目录内新增文件；若根目录缺失，本组可按模板自行创建本组目录，但不得改路径命名或越界创建共享目录。
2. 若发现实现需要直接改 `src/industry/tools/*` 或其他共享旧模块，立即停止并提交 `shared-runtime-note`；本组不得自行越界改共享热点。
3. 固定三轴 source class：
   - `capital_finance` 优先 `official_structured_api` / `official_owned_feed_or_doc`
   - `policy_regulatory` 优先 `official_structured_api` / `official_owned_feed_or_doc`
   - `policy_research_thinktank` 优先可信报告与机构自有文档
4. 领域内实现 `primary / secondary / fallback / last_resort` route 映射。
5. 先把搜索聚合器降到 discovery / context / weak-signal-only，不允许先查聚合再补官方的倒序实现。
6. route selection 核心实现可先落地；进入 activation / stop / review / budget 接线时，必须消费总控已发布的共享治理 profile；不得在本组内重新发明 budget 阈值、review 语义或近义 reason code。
7. 一旦接入 same-run 的 route，必须显式从中台组消费 `dispatch_context_ref`、`claim_admission_assessment_ref`、`capacity_reservation_refs`、`scheduling_key` 与 `gap_scope` 语义；不得本地猜测“现在应该能跑”。
8. 高成本扩张必须遵守固定顺序：`claim family fold -> claim admission -> claim budget -> shared capacity -> axis expansion`；finance / policy 不得因为“看起来重要”就先抢 official fetch 或 same-run 高成本配额。

### Phase 2：event 生产

1. 生成 finance / policy / thinktank 事件适配器。
2. 每条 event 必须带：
   - `axis`
   - `source`
   - `agent_relevance`
   - `execution_context`
   - `audit`
   - `evidence`
3. 未拿到 canonical source 时：
   - 可输出 `context` / `needs_review`
   - 不得伪装成 strong accepted supporting evidence
4. accepted / counter / diagnostic / rejected 事件必须分别进入受控 batch refs；不得在一个 batch 内混语义靠字段猜。
5. 任何 finance / policy accepted event 若存在跨职责语义，必须补 `cross_responsibility_attestation_refs` 输入位；不得等中台组事后从 prose 猜。
6. 只有命中 `tier_blocking`、`public_output_only` 或 headline 主语义争议的跨职责事实，才要求 same-run critical attestation；其余跨域事实可先按 provisional / post-weekly 路径留痕，不得把所有长尾争议都堵在本组开工阶段。

### Phase 3：activation / stop / budget 接线

1. 落地高成本轴激活条件。
2. 落地 canonical fetch 停止条件：
   - `license_risk_high`
   - `access_mode_optional_paid`
   - `human_exception_required`
   - `timeout_budget_exhausted`
   - `no_canonical_source_available`
   - `public_fetch_disallowed`
3. 超预算默认动作只能是：
   - `defer_followup`
   - `needs_review`
   - `unavailable`
   - `weak`
4. 不得因 `manual_review_pool` 有槽位就默认 same-run 有人可审；必须按 `same-run-review-availability-policy.v1` 判断。
5. 没有 `reservation_state=\"granted\"` 的 reservation ref 时，不得启动 official high-cost fetch。

补充说明：

- 本阶段只阻塞 high-cost fetch、same-run、review 和 budget 相关能力的上线，不阻塞前序 source / event / handoff producer 开发。

### Phase 4：tool coverage 与 contribution

1. 三轴都要输出 `AxisToolCoverageReport`。
2. `IndustryAgentContribution` 必须一条职责项一条记录，不得把 finance / policy 混成一条。
3. `accepted_event_count`、`rejected_event_count`、`counter_event_count`、`diagnostic_event_count` 要闭合。
4. 三轴 coverage 必须按 `axis_id` 分开；三条 contribution 必须按 `responsibility_id` 分开，不能互相代替。
5. 若发现媒体转述、研究摘要或社区讨论命中本组事实，只能保留 provisional owner 或 attestation 输入，不得双计 accepted event。

### Phase 4A：daily handoff 冻结

1. 产出本组的 `daily-industry-evidence-pack-input.v1`。
2. payload 至少能解析：
   - `normalized_event_batch_refs`
   - `rejected_event_batch_refs`
   - `source_message_ids`
   - `coverage_refs`
   - `contribution_refs`
3. cardinality 冻结为：
   - `coverage_refs` 恰好 `3`
   - `contribution_refs` 恰好 `3`
   - `normalized_event_batch_refs` 至少覆盖 `capital_finance`、`policy_regulatory`、`policy_research_thinktank`
4. 不得把 accepted / rejected 全量 event 内嵌进 daily 输入包。

### Phase 4B：owner / attestation 负例 fixture

1. 产出 finance / policy 媒体转述不抢 owner 反例。
2. 产出 official-first failure 反例。
3. 产出 `capital_finance`、`policy_regulatory`、`policy_research_thinktank` anti-upgrade 反例：
   - 资本强但缺研究/产品/社区交叉确认
   - 政策关注强但缺落地确认
   - 智库观点强但不是监管结论
4. 这些 fixture 必须在本组目录下维护，由中台组只消费不重写。

### Phase 5：领域测试与 handoff 冻结

1. 跑完领域测试。
2. 产出稳定 fixture。
3. 产出跨组 contract fixtures：
   - current schema version consumer fixture
   - previous compatible same-major consumer fixture
   - missing required ref negative fixture
   - unknown higher major negative fixture
4. 把 envelope / payload / manifest / batch refs / coverage refs / contribution refs 交给中台组接入。
5. 把 owner / attestation / anti-upgrade / official-first failure fixtures 一并交给中台组接入 replay/eval。
6. 若中台 current consumer fixture 尚未发布，本组先提交 producer fixture 与 artifact refs；待中台发布后再补兼容消费用例，不回头改本组领域语义。

## 验收标准

1. 三轴都能独立产出 canonical event。
2. 三轴都显式体现 official-first；未命中官方源时必须 `degraded=true` 或 `unavailable`。
3. 搜索聚合、新闻转述、研究摘要最高只能做 weak / context / needs_review。
4. `capital_finance`、`policy_regulatory`、`policy_research_thinktank` 不直接触碰 tier decision。
5. 高成本 / 授权受限来源不会被伪装成“已覆盖”。
6. 三轴 handoff 产物能被中台组直接消费，无需再猜字段。
7. daily handoff 是轻索引输入，不回传胖 event 快照。
8. current + previous compatible contract fixtures 均能被中台组按 compatibility matrix 消费。
9. finance / policy 媒体转述不会抢走 direct fact owner。
10. official-first failure、anti-upgrade 反例可直接进入统一 eval/replay。
11. 本组全部源码、测试、fixture builder 文件都小于 `2000` 行，且 finance / regulatory / thinktank 没有堆进单文件实现。

## 验证矩阵

| 范围 | 验证内容 | 方式 | 通过标准 |
| --- | --- | --- | --- |
| finance adapters | official filing / IR / report / news 区分 | unit test | 官方源与转述源分层正确 |
| policy adapters | official policy / regulator / news 解读区分 | unit test | 新闻解读不能冒充政策主证 |
| thinktank adapters | 智库 / 研究报告与政策文件区分 | unit test | `policy_research_thinktank` 不与 `policy_regulatory` 混轴 |
| route selection | official-first 与 fallback | fixture test | 未命中官方源时显式降级 |
| activation / stop | budget / timeout / license / paid gate | fixture test | 停止后留下可审计 reason code |
| contribution | 三职责项交账 | schema test | 一职责项一记录，计数闭合 |
| daily handoff | daily 输入是轻索引 | schema + fixture test | 只交 ref / lineage，不内嵌全量 event |
| cross-group contract | envelope / manifest / payload / compatibility | contract fixture | 中台组无需口头补字段即可消费 |
| owner boundary | 转述源不抢 owner | negative fixture | 新闻/摘要不会双计 accepted |
| anti-upgrade | 资本/政策/智库单轴热度 | eval fixture | 不会误升 core |

## 回滚策略

1. 若官方源适配不稳，先保留 discovery/context 输入，不让弱证据进入 accepted supporting。
2. 若 stop / budget 策略有 bug，先收紧为 `needs_review / unavailable`，不要放宽成“先给强结论”。

## 验证记录

| 日期 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 2026-06-23 | 未运行 | `Not Started` | 本轮仅生成子计划 |
| 2026-06-23 | 手工修订子计划 | `Completed` | 已对齐 `agent-relevance-profile.v1` 依赖、目录骨架前置条件与 daily handoff 数组合同 |
| 2026-06-26 | `npx vitest run src/__tests__/industry/agents/finance-agent/unit.test.ts src/__tests__/industry/agents/policy-agent/unit.test.ts src/__tests__/industry/agents/policy-agent/negative.test.ts src/__tests__/industry/agents/policy-agent/contract.test.ts` | `Passed` | 4 个测试文件、6 条测试全部通过；已覆盖 finance official-first、policy 轴拆分、negative fixture 与 daily handoff contract |
| 2026-06-26 | `npx vitest run src/__tests__/industry/agents/finance-agent/unit.test.ts src/__tests__/industry/agents/finance-agent/contract.test.ts src/__tests__/industry/agents/finance-agent/negative.test.ts src/__tests__/industry/agents/finance-agent/replay.test.ts src/__tests__/industry/agents/policy-agent/unit.test.ts src/__tests__/industry/agents/policy-agent/contract.test.ts src/__tests__/industry/agents/policy-agent/negative.test.ts src/__tests__/industry/agents/policy-agent/replay.test.ts` | `Passed` | 8 个测试文件、12 条测试全部通过；已覆盖 finance/policy 的 unit、contract、negative、replay 与 producer artifact refs 闭环 |
| 2026-06-26 | `npx vitest run src/__tests__/industry/platform/contract.test.ts src/__tests__/industry/agents/finance-agent/unit.test.ts src/__tests__/industry/agents/finance-agent/contract.test.ts src/__tests__/industry/agents/finance-agent/negative.test.ts src/__tests__/industry/agents/finance-agent/replay.test.ts src/__tests__/industry/agents/policy-agent/unit.test.ts src/__tests__/industry/agents/policy-agent/contract.test.ts src/__tests__/industry/agents/policy-agent/negative.test.ts src/__tests__/industry/agents/policy-agent/replay.test.ts` | `Passed` | 9 个测试文件、28 条测试全部通过；已把政策金融组 producer 切到 canonical payload 名 / message kind / `industry://` artifact ref，并通过平台 handoff gate dry-run |
| 2026-06-26 | `npx vitest run src/__tests__/industry/platform/contract.test.ts src/__tests__/industry/agents/finance-agent/unit.test.ts src/__tests__/industry/agents/finance-agent/contract.test.ts src/__tests__/industry/agents/finance-agent/negative.test.ts src/__tests__/industry/agents/finance-agent/replay.test.ts src/__tests__/industry/agents/policy-agent/unit.test.ts src/__tests__/industry/agents/policy-agent/contract.test.ts src/__tests__/industry/agents/policy-agent/negative.test.ts src/__tests__/industry/agents/policy-agent/replay.test.ts` | `Passed` | 9 个测试文件、28 条测试全部通过；已补齐 event batch / contribution / daily input 的 `source_message_id` 与顶层 canonical 字段，继续保持平台 handoff gate 通过 |
| 2026-06-26 | `npx tsx scripts/execPlanPreflight.ts --write --exec-plan "docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-政策金融组-v0.1.exec-plan.md" && npx tsx scripts/execPlanPreflight.ts --exec-plan "docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-政策金融组-v0.1.exec-plan.md"` | `Passed` | 已补齐本计划对应 receipt，并通过 code-implementation preflight 校验 |

## 下一阶段入口

1. 本组 producer 已对齐中台 `Phase 1A` 合同；若中台开放 normalization dry-run / consumer 接口，可直接拿本组 bundle 进入下一阶段对接。
2. 若继续推进 activation / stop / budget / same-run，则等待 `4号执行人` 发布 `Phase 1B / 1C` 的共享治理 profile 与 runtime 基座。
