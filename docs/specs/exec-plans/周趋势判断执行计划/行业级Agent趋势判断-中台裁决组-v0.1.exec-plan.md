# 执行计划：行业级Agent趋势判断-中台裁决组 v0.1

## 文档状态

- 版本：`v0.1`
- 当前状态：`Draft`
- 上游总控：
  - `docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-v0.1.exec-plan.md`
- 对应设计：
  - `docs/specs/design-docs/行业级Agent趋势判断设计/00-总览与设计边界.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/01-产品表面与生产治理.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/03-数据模型契约.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/04-评分裁决与证据归一.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/05-多Agent协作与中间件.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/07-运行输出与安全.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/08-验证追溯与完成定义.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/09-术语与审计词汇表.md`
- 负责人：`4号执行人`

## 目标

只做全组共享的窄口子：schema 真源、registry snapshot、normalization、audit、tier decision、weekly 拼装。领域 seed / domain fixture / 领域 docs 已前推给前三组，不再由本组吞下。

当前分支优先目标：只推进 `中台裁决组 ↔ 产品生态组` 已 freeze handoff 的接入。中台必须先提供产品生态组下一步需要的 contract dry-run、registry runtime snapshot、normalization dry-run 与成功/失败两类 `normalization-feedback.v1` 反馈 payload；政策金融、学术前沿与最终 weekly 全量集成本分支暂不扩展。

## 当前推进状态（2026-06-27）

| Phase | 状态 | 已落地证据 | 未完成原因 / 下一步 |
| --- | --- | --- | --- |
| `Phase 1A-1` 目录骨架 bootstrap | `Completed` | `src/industry/platform/{contracts,registry,normalization,audit,trend,output}/`、`src/industry/agents/*`、`fixtures/industry/agents/*`、`data/industry-seeds/agents/*` 已存在；`src/__tests__/industry/platform/contract.test.ts` 覆盖目录冻结。 | 无阻塞。A/B/C 可继续在各自私有目录写 producer，不需要等待中台。 |
| `Phase 1A-2` schema 真源与 artifact 路径 | `Completed` | `schemas/industry/canonical-schema.bundle.json`、`compatibility-matrix.json`、`reason-code-registry.json`、`state-transition-registry.json`；`src/industry/platform/contracts/{schemaRegistry,payloadRegistry,artifactPaths}.ts`。 | 后续只接受 schema-change-note；不得由 A/B/C 直接改 `schemas/industry/*`。 |
| `Phase 1A-3` current / negative fixtures | `Completed` | `fixtures/industry/platform/current-consumer/phase1-runtime.json`、`fixtures/industry/platform/negative/phase1-runtime.json`；contract test 覆盖 current、previous-compatible、unknown higher major、kind mismatch、missing refs。 | 无阻塞。A/B/C 应按这些 fixture 补齐 consumer contract。 |
| `Phase 1B` shared governance | `Completed` | `src/industry/platform/contracts/sharedGovernance.ts` 发布 Phase 1 profile / feedback payload 列表，验证 reason/state/profile 均存在。 | 无阻塞。A/B/C activation / budget / review 正式接线必须消费这里的 profile id。 |
| `Phase 1C` dispatch / budget runtime base | `Completed` | `src/industry/platform/contracts/dispatchRuntime.ts`、`consumerFixtures.ts`；fixtures 覆盖 dispatch context、reservation、budget、async_only review gate。 | 无阻塞。命中 same-run 的 A/B/C 消息必须带 `dispatch_context_ref`、`scheduling_key`、stable claim key、admission ref、reservation refs。 |
| `Phase 1C+` main coordinator 边界 | `Completed` | contract test 验证没有 `main-coordinator` 新 Agent，`src/types.ts` / `src/cli.ts` 不持有 coordinator 私有状态。 | 无阻塞。后续 scheduler / middleware 只能落在 contracts / registry，不能回写 weekly 热点文件。 |
| `Phase 2` registry snapshot 与 shared governance | `Partial` | 已新增 `src/industry/platform/registry/runtimeSnapshot.ts` 与 `src/__tests__/industry/platform/registry.test.ts`，冻结 runtime snapshot plane 与 governance review plane 不互相穿透，并验证 `manual_review_pool` 不等于 reviewer availability。 | 还缺正式 registry/tool snapshot fixture 与 A/B/C 合法 tool coverage / authority refs。中台可继续接任一已交齐组跑 snapshot / dry-run，但不能做全量 weekly 集成。 |
| `Phase 3` normalization 与 fact snapshot | `Partial` | `src/industry/platform/normalization/financePolicyDryRun.ts` 已能消费政策金融 current bundle；`src/industry/platform/normalization/productEcosystemDryRun.ts` 已能消费产品生态 formal bundle，产出 registry runtime snapshot、normalized / rejected / coverage / contribution refs 与成功/失败两类 `normalization-feedback.v1` dry-run payload；`src/__tests__/industry/platform/normalization.test.ts` 覆盖 positive / negative。 | 产品生态对接范围内的 contract dry-run / registry snapshot / normalization dry-run 已完成；仍未进入 source-chain dedupe、fact resolution、owner arbitration、closed snapshot。原因：这些属于 closed fact snapshot / claim-builder 前置，不在本分支“只接产品生态下一步”的最小范围内。 |
| `Phase 4` claim-builder 与 audit | `Blocked` | schema 中已有 `claim-candidate-batch.v1`、`audit-request.v1`、`audit-result.v1`、`counter-evidence-audit.v1`。 | 需要 Phase 3 的 closed fact snapshot、`FactResolutionAudit`、owner transfer artifact；还需要 A/B/C 反例 fixture。 |
| `Phase 5` tier decision 与 weekly 三层输出 | `Blocked` | schema 中已有 `industry-trend-card.v1`、`industry-claim-ledger.v1`、`weekly-industry-trend-section.v2`、`consumer-weekly-industry-view.v1`、`public-weekly-industry-projection.v1`。 | 需要 Phase 4 audit result、decision context artifact、最近 7 日 `DailyIndustryEvidencePack.v2` 与 `RollingEvidenceWindowSnapshot.v1`。 |
| `Phase 6` eval / replay / structure | `Blocked` | 现有 platform contract / normalization / registry tests 可跑；部分 A/B/C fixtures 已存在。 | 需要三组正式 replay/eval/gold/negative 资产冻结后拼总评测；中台不替领域组补造语义 fixture。 |

## 继续推进所需输入

| 产出方 | 必须交付 | 解锁阶段 |
| --- | --- | --- |
| `1号执行人` 政策金融组 | 正式 envelope / payload / manifest / canonical artifact refs；`normalized_event_batch_refs`、`rejected_event_batch_refs?`、`source_message_ids`、`coverage_refs`、`contribution_refs`；official-first failure、anti-upgrade、owner boundary、policy/finance replay refs。 | 继续 Phase 2 group snapshot、Phase 3 dry-run -> closed fact snapshot。 |
| `2号执行人` 学术前沿组 | 从 preparatory refs 升级为正式 `industry-signal-event-batch.v1` producer handoff；positive canonical、near-boundary、academic replay/eval refs。 | 从 preparatory review 进入正式 contract test / normalization dry-run。 |
| `3号执行人` 产品生态 / 社区新闻组 | 产品生态与社区新闻正式 envelope / payload / manifest / refs；owner boundary、`news-pr` anti-upgrade、community noise 反例与 replay refs。 | 已解锁中台 contract dry-run 与 normalization dry-run；收到 `normalization-feedback.v1` dry-run payload 后，如有失败反馈，仅在本组目录内修正 payload / lineage / refs。 |
| `4号执行人` 中台裁决组 | 本分支只接产品生态 formal bundle：跑 contract test、registry runtime snapshot、normalization dry-run，并回传 `normalization-feedback.v1`。 | 产品生态下一步所需 snapshot / dry-run / 反馈已落地；closed fact snapshot、audit、tier、weekly 三层输出仍等待更完整 replay/eval 与全量集成范围。 |

## 负责范围

对应运行时 Agent：

- `registry-agent`
- `normalization-agent`
- `audit-agent`
- `trend-agent`

对应职责项：

- `registry-governance`
- `evidence-normalization`
- `counter-evidence-audit`
- `trend-synthesis`

负责交付：

1. `schemas/industry/*` 单一真源。
2. registry snapshot、tool registry snapshot、compatibility / reason / state registry。
3. source-chain、fact resolution、owner arbitration、claim family fold、claim admission。
4. `CounterEvidenceAudit`、`IndustryClaimLedger`、`WeeklyIndustryTrendSection`、`ConsumerWeeklyIndustryView`、`PublicWeeklyIndustryProjection`。

### 运行方式

- 本组优先使用独立 worktree / workspace root；若无法隔离，至少保证只写本组目录与本组 fixture / seed / test。
- `schema-change-note`、`schema-governance-notice`、`normalization-feedback`、`owner transfer` 和 `replay/eval` 收口草案只允许本组唯一 writer 维护。
- 其他三组不得直接改 `schemas/industry/*`、`src/types.ts`、`src/cli.ts`、`src/storage/files.ts` 和 `src/industry/platform/*`，只能通过 handoff 提交变更建议。

## 单写者边界

### 允许修改

- `schemas/industry/*`
- `src/types.ts`
- `src/cli.ts`
- `src/storage/files.ts`
- `src/industry/platform/contracts/*`
- `src/industry/platform/registry/*`
- `src/industry/platform/normalization/*`
- `src/industry/platform/audit/*`
- `src/industry/platform/trend/*`
- `src/industry/platform/output/*`
- `src/action/weekly*`
- `src/action/runSummary.ts`
- `src/action/dailyVerification.ts`
- 中台相关 tests、replay、eval、structure tests
- `docs/specs/services/*`
- `docs/specs/constraints/*`
- `docs/specs/feedback-loops/*`
- `README.md`
- `data/README.md`

### 禁止修改

- 不接管前三组的领域 event 逻辑、领域 source 适配器、领域 seed 文本内容
- 不得把 coverage / audit 缺口偷换成 tier 降级
- 不得直接从 provider raw input 生成 weekly 结论

## 工作目录与文件落点

本组独立工作目录固定为：

- `schemas/industry/*`
- `src/industry/platform/contracts/*`
- `src/industry/platform/registry/*`
- `src/industry/platform/normalization/*`
- `src/industry/platform/audit/*`
- `src/industry/platform/trend/*`
- `src/industry/platform/output/*`
- `src/__tests__/industry/platform/*`
- `fixtures/industry/platform/*`
- `data/industry-seeds/platform/*`

高热点入口文件只允许做薄封装：

- `src/types.ts`
- `src/cli.ts`
- `src/storage/files.ts`
- `src/action/weeklyEnhancement.ts`
- `src/action/weeklyTrendAgent.ts`
- `src/action/weeklyJudgmentRules.ts`
- `src/action/weeklyReport.ts`
- `src/action/runSummary.ts`
- `src/action/dailyVerification.ts`

目录内建议按 runtime stage 拆分，避免 registry、normalization、audit、trend 再次被写回单文件：

- `src/industry/platform/contracts/schemaRegistry.ts`
- `src/industry/platform/contracts/payloadRegistry.ts`
- `src/industry/platform/contracts/artifactPaths.ts`
- `src/industry/platform/registry/runtimeSnapshot.ts`
- `src/industry/platform/registry/governanceReview.ts`
- `src/industry/platform/normalization/sourceChainDedupe.ts`
- `src/industry/platform/normalization/factResolution.ts`
- `src/industry/platform/normalization/ownerArbitration.ts`
- `src/industry/platform/normalization/factSnapshot.ts`
- `src/industry/platform/audit/counterEvidenceAudit.ts`
- `src/industry/platform/audit/claimAdmission.ts`
- `src/industry/platform/trend/claimBuilder.ts`
- `src/industry/platform/trend/tierDecision.ts`
- `src/industry/platform/output/weeklySection.ts`
- `src/industry/platform/output/consumerProjection.ts`
- `src/industry/platform/output/publicProjection.ts`
- `src/__tests__/industry/platform/{contract,structure,normalization,decision,replay}*.test.ts`

落点约束：

- `schemas/industry/*` 只存 machine-readable 真源，不放运行时代码。
- `src/action/*` 只接 CLI / weekly 主链，不写十轴判断、owner arbitration、claim builder 细节。
- 共享逻辑若被 A/B/C 消费，必须先进入 `src/industry/platform/contracts/*` 或明确的 platform 目录；不得把临时 helper 藏在 `weekly*.ts` 里。
- 本组的真正代码工作根目录是 `src/industry/platform/*`；`schemas/industry/*` 只承载 machine-readable 真源，不回写运行时代码。

文件规模约束：

- 任意文件必须 `< 2000` 行。
- 任一文件超过 `1200` 行时，按 `contracts / registry / normalization / audit / trend / output` 或更细 stage 拆分。
- `src/types.ts`、`src/cli.ts`、`src/action/*` 目标不超过 `800` 行；超过后优先下沉实现到 `src/industry/*`。

## 依赖输入

本组依赖分三层消费，不再把前三组完整 handoff 写成统一开工前置：

### L0：本组可独立启动的工作

- `schemas/industry/*`
- artifact path / ref 约定
- payload registry 正式名
- 单写者边界与目录模板

以上足以让本组先启动 schema、registry、normalization shell、audit shell、weekly shell 与结构测试。

### L1：按组增量消费的 handoff

任一领域组只要交出以下产物，本组就必须允许该组先进入 contract test、normalization dry-run 与 daily pack 聚合测试：

1. 各自的 `IndustryAgentMessageEnvelope`
2. 各自的 `payload_schema`、`payload_ref`
3. 各自的 `IndustryAgentArtifactManifest`
4. 各自的 canonical batch refs / coverage refs / contribution refs
5. rejected / failure / unavailable refs
6. 若命中 same-run admission / budget / review，则还必须拿到 `dispatch_context_ref`、`scheduling_key` 与相关 refs
7. 各领域组的 owner boundary / anti-upgrade / official-first failure / replay fixture refs

### L2：最终 weekly 集成前必须齐备

- 三个领域组正式 handoff 全量交付
- cross-group replay / eval 资产
- daily pack、rolling snapshot、weekly internal / consumer / public 的闭环验证

消费约束：

- 无 envelope / manifest / payload schema / canonical artifact ref 的产物一律拒收
- 只接收 compatibility matrix 明确兼容的当前版本与同 major 上一个兼容版本
- unknown higher major version 必须 rejected 并生成 failure notice
- 某一组 handoff 不完整时，只阻塞该组 promotion to final integration；不得阻塞其他已就绪组的 dry-run、contract test 和 normalization 接线
- 若领域组未显式提交 `execution_context.primary_responsibility_id`、`execution_context.operational_executor_id`、必要的 `takeover_mode / takeover_audit_ref`、或 same-run 所需 `claim_partition_id / candidate_group_id`，本组必须按 schema / contract 错误拒收，不得本地脑补。

## 给 `4号执行人` 的白话派工

### 你先做什么

- 先把 `schemas/industry/*`、payload registry、artifact path、compatibility / reason / state registry 立起来。
- 先把 structure tests、contract fixtures、normalization / audit / weekly shell 立起来。
- 先把“别人怎么把东西交给你”这件事说清楚，而不是先替别人写领域逻辑。

### 你的第一优先交付

- `Phase 1A` 的 canonical schema、payload 正式名、artifact path。
- current consumer fixtures。
- shared governance contracts。
- dispatch / reservation / budget base。

### 你什么时候必须等待

- 只有在做最终 weekly 集成时，才需要等待三组都交齐正式 handoff。
- 做 contract test、normalization dry-run、daily pack 聚合测试时，不需要等三组一起完成；谁先齐就先接谁。

### 别把自己变成串行瓶颈

- 不要要求 `1/2/3号执行人` 等你把所有 schema 全部打磨完才开始本地准备工作。
- 不要回头接管 A/B/C 的领域 seed、反例文本、source catalog 首稿。
- 不要因为某一组 handoff 不完整，就停掉其他已就绪组的 dry-run 和接线。

### 你要怎么接前三组

- 哪一组先交齐 envelope、payload、manifest、artifact refs，就先接哪一组。
- 如果对方缺 `execution_context`、`takeover`、same-run 必填 ref，就直接按合同拒收，并把缺什么写清楚；不要自己脑补。
- 早期可以先消费 preparatory artifact refs 做 contract review，但这不算正式 handoff。

### 本组从开工到完工的顺序

1. 先把 `Phase 0.5` 需要的 schema、payload registry、artifact path、structure tests、weekly shell 搭起来，让前三组不必等你才能开工。
2. 尽快交出 `Phase 1A` 的 canonical schema、payload 正式名、artifact path、compatibility matrix，让前三组把本地 seam 收口成正式 handoff。
3. 哪个领域组先交齐 envelope / payload / manifest / refs，就先接哪个组做 contract test、normalization dry-run 和 daily pack 聚合测试。
4. 再发布 `Phase 1B / 1C` 的治理契约和 same-run runtime，让前三组按需接 activation / stop / budget / review / same-run。
5. 最后等三组正式 handoff、cross-group replay / eval、weekly 三层闭环都齐后，再做最终 weekly 集成和总验收。

## 输出与 handoff

本组是最终拼装方，必须输出：

1. schema 真源与 compatibility / reason / state registry
2. normalization / fact snapshot / owner transfer / audit refs
3. `DailyIndustryEvidencePack.v2`
4. `RollingEvidenceWindowSnapshot.v1`
5. `IndustryTrendDecision`
6. `IndustryTrendCard[]`
7. `IndustryClaimLedger[]`
8. `WeeklyIndustryTrendSection`
9. `ConsumerWeeklyIndustryView`
10. `PublicWeeklyIndustryProjection`
11. replay / eval / diff audit 记录
12. dispatch / reservation / budget arbitration current fixtures 与统一 negative fixtures

## 实施阶段

### Phase 1A-1：目录骨架 bootstrap

1. 先验证当前仓库的目录骨架是否与总控约定一致；若有缺口，由本组补齐并一次性冻结全项目目录骨架：
   - `src/industry/platform/{contracts,registry,normalization,audit,trend,output}/`
   - `src/__tests__/industry/platform/`
   - `fixtures/industry/platform/`
   - `data/industry-seeds/platform/`
   - `src/industry/agents/{finance-agent,policy-agent,academic-agent,product-oss-agent,community-news-agent,registry-agent,normalization-agent,audit-agent,trend-agent}/`
   - `src/__tests__/industry/agents/{finance-agent,policy-agent,academic-agent,product-oss-agent,community-news-agent,registry-agent,normalization-agent,audit-agent,trend-agent}/`
   - `fixtures/industry/agents/{finance-agent,policy-agent,academic-agent,product-oss-agent,community-news-agent,registry-agent,normalization-agent,audit-agent,trend-agent}/`
   - `data/industry-seeds/agents/{finance-agent,policy-agent,academic-agent,product-oss-agent,community-news-agent,registry-agent,normalization-agent,audit-agent,trend-agent}/`
2. 这一步只允许建目录和占位索引，不允许提前把业务逻辑塞进 `src/action/*`、`src/types.ts` 或热点共享文件。
3. 若 bootstrap 尚未合入，A/B/C 仍可按总控已冻结的目录模板在各自私有目录内开工；禁止的是擅自改共享目录命名，不是等待本组通知后才能写代码。

### Phase 1A-2：schema 真源与 artifact 路径

1. 先锁 `schemas/industry/*`。
2. 锁 internal / consumer / public 三层 artifact 路径和 ref 解析。
3. 锁 `IndustryAgentMessageEnvelope`、`IndustryAgentArtifactManifest` 与 payload schema registry。
4. canonical object 至少要 materialize：
   - `IndustrySignalEvent`
   - `IndustryClaim`
   - `IndustryTrendDecision`
   - `IndustryClaimLedger`
   - `IndustryTrendCard`
   - `IndustryAgentMessageEnvelope`
   - `IndustryAgentArtifactManifest`
   - `ClaimAdmissionAssessment`
   - `DecisionContextArtifact`
   - `CapacityReservation`
   - `BudgetArbitrationRecord`
   - `HumanReviewQueueItem`
   - `OverrideAudit`
   - `SameRunDispatchContext`
   - `FactResolutionAudit`
   - `CounterEvidenceAudit`
   - `DailyIndustryEvidencePack.v2`
   - `RollingEvidenceWindowSnapshot.v1`
   - `WeeklyIndustryTrendSection`
   - `ConsumerWeeklyIndustryView`
   - `PublicWeeklyIndustryProjection`
5. 锁定以下跨组 handoff payload：
   - `industry-signal-event-batch.v1`
   - `axis-tool-coverage-report.v1`
   - `industry-agent-contribution.v1`
   - `daily-industry-evidence-pack-input.v1`
   - `normalization-feedback.v1`
   - `schema-governance-notice.v1`
6. 正式 `payload_schema` 只允许使用上述业务名；`event-batch`、`tool-status-report` 之类短名只允许作为说明性 family 名，不得落到 envelope、manifest 或 compatibility matrix。
7. 额外 materialize 全组必须先落地的 payload family：
   - `same-run-dispatch-context.v1`
   - `task-request.v1`
   - `task-result.v1`
   - `normalization-request.v1`
   - `normalization-result.v1`
   - `claim-candidate-batch.v1`
   - `audit-request.v1`
   - `audit-result.v1`
   - `evidence-gap-request.v1`
   - `evidence-gap-result.v1`
   - `registry-review-request.v1`
   - `registry-review-result.v1`
   - `failure-notice.v1`
8. 为上述 payload family 发布 current consumer fixture 与统一 negative fixtures：
   - kind / payload mismatch
   - missing required ref
   - manifest resolve failure
   - unknown higher major
9. 明确 `daily-industry-evidence-pack-input.v1 -> DailyIndustryEvidencePack.v2` 的唯一 writer/owner：
   - A/B/C 只负责提交 `normalized_event_batch_refs`、`rejected_event_batch_refs?`、`source_message_ids`、`coverage_refs`、`contribution_refs`
   - D 负责校验数组口径、聚合为单一 `normalized_event_batch_ref` / `rejected_event_batch_ref?`、填充 `input_artifact_refs`
   - D 是 `DailyIndustryEvidencePack.v2` 的唯一 materializer 与写盘方
   - `public projection state` 只能由 D 基于治理链回填
10. 在同一阶段同步发布冻结设计项落地包：
   - `field-ownership-policy.v1`
   - `fact-resolution-profile.v1`
   - `freshness-decay-profile.v1`
   - `agent-relevance-profile.v1`
   - `SourceAuthorityContextProfile`
11. 发布 `schema-change-note` 模板、响应 SLA 与 compatibility matrix 更新规则。
12. 把 `src/types.ts`、`src/cli.ts`、`src/action/*` 控制在薄入口形态，避免行业实现回流成高热点大文件。

### Phase 1A-3：payload registry current fixture 发布

1. 对 Phase 1A-2 中列出的每个 payload family，发布 current consumer fixture。
2. 同步发布统一 negative fixtures：
   - kind / payload mismatch
   - missing required ref
   - manifest resolve failure
   - unknown higher major
3. current fixtures 与 compatibility matrix 是跨组 handoff 冻结前置，不是领域组 source / event 核心开发前置；A/B/C 可先按 schema 真源产出 producer payload 与本组 fixture，待 current fixture 发布后补 contract consumption 验证。
4. current consumer fixtures 必须覆盖 `execution_context.primary_responsibility_id / operational_executor_id` 一致性、takeover 留痕、`claim_partition_id / candidate_group_id` presence 和 same-run admission ref 完整性；不得只验 payload 名称和 ref 存在。

### Phase 1B：shared governance 发布

1. 优先尽早发布，供领域组后接线消费：
   - `field-ownership-policy.v1`
   - `fact-resolution-profile.v1`
   - `freshness-decay-profile.v1`
   - `SourceAuthorityContextProfile`
   - `tool-selection-scorecard.v1`
   - `task-timeout-profile.v1`
   - `tool-call-timeout-profile.v1`
   - `axis-subscore-rubric.v1`
   - `axis-runtime-budget-profile.v1`
   - `axis-activation-policy.v1`
   - `claim-archetype-axis-applicability.v1`
   - `axis-status-threshold-profile.v1`
   - `claim-archetype-decision-profile.v1`
   - `independence-credit-profile.v1`
   - `canonical-fetch-stop-policy.v1`
   - `same-run-eligible-micro-task-matrix.v1`
   - `micro-task-runtime-budget-profile.v1`
   - `micro-task-cost-profile.v1`
   - `rotation-budget-profile.v1`
   - `claim-admission-budget-profile.v1`
   - `claim-runtime-budget-profile.v1`
   - `run-total-budget-policy.v1`
   - `same-run-review-availability-policy.v1`
   - `claim-admission-budget-profile.v1`
   - `claim-runtime-budget-profile.v1`
   - `run-critical-path-budget.v1`
   - `shared-capacity-policy.v1`
   - `run-total-budget-policy.v1`
   - `same-run-review-availability-policy.v1`
   - `runtime-sizing-assumptions.v1`
   - `gap-scope-contract.v1`
   - `message-key-policy.v1`
   - `runtime-concurrency-control-policy.v1`
   - `backlog-compaction-policy.v1`
   - `reopen-impact-matrix.v1`
   - `headline-capacity-policy.v1`
2. 冻结预算、activation、review、reserve、shared pool、queue 并发、gap 稳定键、reopen 和 headline capacity 的 reason/state 契约。
3. 结构测试未通过前，不允许 A/B/C 合入各自的 activation / budget / review 正式接线；但不阻塞领域组先完成 source / event / handoff producer 的本地实现。
4. 明确固定高成本仲裁顺序：`claim family fold -> claim admission -> claim budget -> shared capacity -> axis expansion`；任何 registry / dispatch / scheduler runtime 不得接受倒序执行。

### Phase 1C：dispatch / budget runtime base

1. 先落地：
   - `SameRunDispatchContext`
   - `CapacityReservation`
   - `BudgetArbitrationRecord`
   - `run_budget_summary`
   - `HumanReviewQueueItem`
   - `OverrideAudit`
2. 统一 reject / gating 行为：
   - 缺 `dispatch_context_ref` 的 same-run 请求 rejected
   - 无 `reservation_state="granted"` 的高成本动作 rejected
   - `manual_review_pool` 与 reviewer availability 分离，`async_only` 时走保守消费路径
3. 向 A/B/C 发布 current fixtures，作为各组接入 activation / stop / budget / same-run 的前置；但这只约束接线阶段，不约束领域组先做 source / event / fixture 开发。

### Phase 1C+：main coordinator 边界固化

1. `main coordinator` 只作为 middleware / scheduler role 实现，不新增语义 Agent，不改写 `9` 个实际 Agent / `15` 个职责项。
2. 代码只允许落在：
   - `src/industry/platform/contracts/*`
   - `src/industry/platform/registry/*`
3. 明确禁止把 coordinator 私有事实、调度补算逻辑或第二套 decision truth 写进：
   - `src/action/weekly*`
   - `src/cli.ts`
   - `src/types.ts`
4. 必须补结构测试，验证：
   - `dispatch_context_ref`、`scheduling_key`、reservation refs 都来自 canonical artifact
   - `weekly*.ts` 不持有 coordinator 私有状态
   - coordinator 不直接写入 tier / owner / audit 结论

### Phase 2：registry snapshot 与 shared governance

1. 分离 runtime snapshot plane 与 governance review plane。
2. 统一接各领域组交来的 tool coverage / seed / authority 输入。
3. 生成可供运行时消费的 snapshot，不让未发布 review 结果穿透到当前 run。
4. 验证 `manual_review_pool` 不等于 reviewer availability；`async_only` 时必须强制保守消费或 public block。
5. 发布 registry/tool snapshot current fixtures，避免 A/B/C 各自发明本地假 snapshot。
6. 对 A/B/C 的接入按组推进：哪个组先交合法 refs，就先给哪个组跑 snapshot / normalization dry-run；不得要求“三组一起到齐”才开始。
7. 对长尾 owner / attestation / authority 争议，默认只发布 `provisional_resolution` 或 `post_weekly_governance_resolution` 输入，不得把所有 unresolved groups 都提升成 same-run blocking。

### Phase 3：normalization 与 fact snapshot

1. 做 source-chain dedupe。
2. 做 fact resolution、relation edges、owner arbitration。
3. 关闭 fact partition / snapshot，保证 claim-builder 只读已关闭 snapshot。
4. 只消费合法 `daily-industry-evidence-pack-input.v1` 与已登记 artifact refs；不得回读领域组私有临时文件或 provider raw input。
5. 分开落账：
   - `source_chain_dedupe_batch`
   - `FactResolutionAudit`
   - owner transfer artifact
   - `snapshot_id` / `fact_partition_id`
6. unresolved groups 必须按 `same_run_critical_resolution`、`provisional_resolution`、`post_weekly_governance_resolution` 三层输出，并显式带 `impact_scope` 与 `default_system_action`；不得把所有长尾争议都保留在 same-run blocking。

### Phase 4：claim-builder 与 audit

1. `claim-builder pass` 只消费归一结果，生成：
   - claim candidate batch
   - claim evidence link batch
   - claim family fold audit
2. `audit-agent` 生成：
   - `CounterEvidenceAudit`
   - unresolved groups
   - downgrade / blocking / missing axes
3. 补 closed snapshot / late transfer / attestation merge tests：
   - claim-builder 不得读取未关闭 snapshot
   - late owner transfer 不得静默改写当前 weekly
   - attestation merge 不得重复增加 accepted evidence 数量

### Phase 5：tier decision 与 weekly 三层输出

1. `tier-decider pass` 按 `claim_archetype` 裁决，并直接消费 `agent-relevance-profile.v1`、`claim-archetype-axis-applicability.v1`、`axis-status-threshold-profile.v1`、`claim-archetype-decision-profile.v1`、`independence-credit-profile.v1`；不得压回一套统一门槛。
2. 先 materialize `IndustryTrendDecision`，再写入 `IndustryClaimLedger`。
3. 从 ledger 派生 `IndustryTrendCard[]`。
4. 生成 internal `WeeklyIndustryTrendSection`。
5. 从 internal section 派生 consumer / public 两层 projection。
6. weekly 只能读取最近 `7` 日 `DailyIndustryEvidencePack.v2`、`RollingEvidenceWindowSnapshot.v1`、已标准化 project weekly artifacts 和 canonical external summary；不得回读 raw provider input 或任意历史临时产物。

### Phase 6：eval / replay / structure

1. 读取前三组提供的 fixtures，拼成：
   - gold set
   - negative fixtures
   - replay windows
   - `TrendDecisionEvalCase`
   - `DecisionDiffAudit`
2. 只做组装收口，不替领域组补造语义 fixture：
   - `1号执行人` 提供 official-first failure、anti-upgrade、owner boundary 反例
   - `2号执行人` 提供 positive canonical、near-boundary、academic replay 资产
   - `3号执行人` 提供 owner boundary、`news-pr` anti-upgrade、community noise 反例
3. 同步 weekly / verify / run-summary 的结构测试。
4. 补跨组 consumer contract tests：
   - current schema version 兼容消费
   - same-major previous-compatible 兼容消费
   - unknown higher major 拒绝
   - payload kind mismatch / manifest resolve failure / missing required refs 一致报错
5. 结构测试必须额外拦截：
   - 非正式 `payload_schema`
   - 第二套平台根目录
   - 领域组越界写共享目录
   - 新增源码、测试、fixture builder 文件 `>= 2000` 行
6. 最终 weekly 拼装前，必须复核三组都已从“producer 就绪”提升到“handoff 冻结 + promotion 就绪”；但这一步不回溯阻塞已完成的中间 dry-run。

## 验收标准

1. `schemas/industry/*` 成为唯一 machine-readable 真源。
2. claim-builder、audit、tier-decider 三段式真实存在，不能合成一个黑盒步骤。
3. `decision_tier`、`decision_confidence`、`coverage_audit_state` 语义分离。
4. internal / consumer / public 三层 weekly 产物分离。
5. weekly 只读合法 artifact，不读 provider raw input。
6. eval / replay / diff audit 能运行，并能解释规则变动后的差异。
7. 能直接消费前三组 handoff，无需口头补字段或本地猜测映射。
8. `same-run-dispatch-context`、reservation、budget arbitration 和 run summary 有统一真源，不由领域组各自重算。
9. owner transfer、attestation merge、closed snapshot 消费边界可 replay 验证。
10. 本组全部源码、测试、fixture builder 文件都小于 `2000` 行，且 registry / normalization / trend / output 没有堆进单文件实现。

## 验证矩阵

| 范围 | 验证内容 | 方式 | 通过标准 |
| --- | --- | --- | --- |
| `schemas/industry/*` | 真源完整度 | schema + structure test | 关键 schema family 齐全 |
| normalization | source-chain / fact / owner / snapshot | pipeline fixture | 已关闭 snapshot 才能进入 claim-builder |
| audit | counter / blocking / missing / unresolved | unit + decision fixture | 强反证能阻断或降 confidence |
| trend | archetype-aware decision | eval fixture | 不共用一套偷懒门槛 |
| weekly outputs | internal / consumer / public 分离 | snapshot test | public 不读 internal section 直接拼装 |
| replay / diff audit | 历史窗口回放 | replay test | 能解释 tier/confidence/coverage 变化 |
| cross-group consumer contract | envelope / manifest / payload / compatibility | contract + replay fixture | 前三组产物可按 compatibility matrix 被直接消费 |

## 回滚策略

1. 若 schema 真源不稳，先停并行实现，优先修 schema，不让各组本地各改一份。
2. 若 normalization / audit / trend 任一层不稳，先停 weekly 输出，只保留 upstream event 与 daily pack。
3. 若 public projection 有问题，立即只保留 internal section 与 blocked public 状态。

## 验证记录

| 日期 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 2026-06-23 | 未运行 | `Not Started` | 本轮仅生成子计划 |
| 2026-06-23 | 手工修订子计划 | `Completed` | 已补齐 D 组对 decision profiles、daily/rolling/trend artifacts、bootstrap 验证职责与 daily 聚合 writer/owner 的冻结定义 |
| 2026-06-27 | `pnpm exec vitest run src/__tests__/industry/platform/registry.test.ts` | `Completed` | 新增 Phase 2 最小 registry runtime snapshot / governance review plane 边界测试，2 tests passed |
| 2026-06-27 | `pnpm install` | `Completed` | 按 lockfile 恢复本 worktree 依赖后执行验证 |
| 2026-06-27 | `pnpm exec vitest run src/__tests__/industry/platform` | `Completed` | 中台平台测试 3 files / 36 tests passed |
| 2026-06-27 | `pnpm run typecheck` | `Completed` | `tsc --noEmit` passed |
| 2026-06-27 | `pnpm exec vitest run src/__tests__/industry/platform/normalization.test.ts` | `Completed` | 产品生态 formal bundle 已接入中台 registry snapshot / normalization dry-run，4 tests passed，返回 `normalization-feedback.v1` dry-run payload |
