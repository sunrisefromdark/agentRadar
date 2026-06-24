# 执行计划：行业级Agent趋势判断-学术前沿组 v0.1

## 文档状态

- 版本：`v0.1`
- 当前状态：`Draft`
- 上游总控：
  - `docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-v0.1.exec-plan.md`
- 对应设计：
  - `docs/specs/design-docs/行业级Agent趋势判断设计/02-证据轴与相关性门控.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/03-数据模型契约.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/04-评分裁决与证据归一.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/06-工具保障与SeedRegistry.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/08-验证追溯与完成定义.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/09-术语与审计词汇表.md`
- 负责人：`2号执行人`

## 目标

只把 `research_paper`、`conference_academic` 两轴做成可复核、可 replay、引用可追溯的 canonical 输入面，不碰 weekly 最终裁决。

## 负责范围

对应运行时 Agent：

- `academic-agent`

对应职责项：

- `research-frontier`
- `conference-academic`

负责交付：

1. 论文 / 顶会 / benchmark / workshop / tutorial / challenge 的 event 输入。
2. 学术 citation trace、freshness anchor、accepted / rejected / counter 语义。
3. 学术轴 tool coverage 与 contribution。
4. replay / eval 草案资产首稿，供 `4号执行人` 做最终装配。

## 单写者边界

### 允许修改

- `src/industry/agents/academic-agent/*`
- 学术工具接入与对应 tests
- `fixtures/industry/agents/academic-agent/*`
- `data/industry-seeds/agents/academic-agent/*`
- academic replay fixture
- 本组目录下的 docs-note / handoff-note / fixture note

### 运行方式

- 本组优先使用独立 worktree / workspace root；若无法隔离，至少保证只写本组目录与本组 fixture / seed / test。
- replay / eval 草案只允许 `2号执行人` 作为唯一 writer，其他组只能引用该草案，不得复制改写为第二份真源。
- `schema-change-note`、`shared-runtime-note` 与 owner-boundary 反例若涉及学术语义，只能以引用方式交给中台组，不得直接改中台共享目录。
- 若需要修改跨组 specs / README，只能提交 `docs-change-note` 给中台组统一写入；本组不得直接改跨组文档真源。

### 禁止修改

- 不得直接修改 `schemas/industry/*`
- 不得直接写 weekly 分桶与最终 tier
- 不得把通用网页搜索结果直接替代学术元数据与官方学术源
- 不得直接修改 `docs/specs/services/*`、`docs/specs/constraints/*`、`docs/specs/feedback-loops/*`、`README.md`、`data/README.md`

## 工作目录与文件落点

本组独立工作目录固定为：

- `src/industry/agents/academic-agent/*`
- `src/__tests__/industry/agents/academic-agent/*`
- `fixtures/industry/agents/academic-agent/*`
- `data/industry-seeds/agents/academic-agent/*`

目录内建议按“paper / conference + 流水线阶段”拆分：

- `src/industry/agents/academic-agent/paperSourceCatalog.ts`
- `src/industry/agents/academic-agent/paperFreshness.ts`
- `src/industry/agents/academic-agent/paperCitationTrace.ts`
- `src/industry/agents/academic-agent/paperEventBuilder.ts`
- `src/industry/agents/academic-agent/conferenceSourceCatalog.ts`
- `src/industry/agents/academic-agent/conferenceFreshness.ts`
- `src/industry/agents/academic-agent/conferenceEventBuilder.ts`
- `src/industry/agents/academic-agent/coverageReport.ts`
- `src/industry/agents/academic-agent/contributionLedger.ts`
- `src/industry/agents/academic-agent/handoff.ts`
- `src/__tests__/industry/agents/academic-agent/{contract,unit,negative,replay}*.test.ts`

落点约束：

- `research_paper` 与 `conference_academic` 的 freshness / citation / boundary fixture 必须拆文件，不能写成一个全能 `academic.ts`。
- replay 输入、eval 正例、owner boundary 反例分别放在 `fixtures/industry/agents/academic-agent/replay/`、`fixtures/industry/agents/academic-agent/eval/`、`fixtures/industry/agents/academic-agent/owner-boundary/`。
- 学术元数据解析只放在 `academic-agent` 目录内，不向 `src/action/*` 或共享目录泄漏实现细节。
- 若发现共享 helper 或旧模块需要改写，先提 `shared-runtime-note` 交给中台组；本组只允许在 academic 工作区内实现和维护代码。

文件规模约束：

- 任意文件必须 `< 2000` 行。
- 任一文件超过 `1200` 行时，按 `paper / conference / replay` 或按 `source / freshness / builder / handoff` 拆分。
- replay / eval 测试超过 `800` 行时必须拆成多文件，防止单文件吞掉所有历史窗口样本。

## 依赖输入

1. 中台组发布的 canonical schema 与 citation/ref 约束。
2. 学术轴的 freshness / authority / source-type 定义。
3. 已发布的共享治理契约：
   - `field-ownership-policy.v1`
   - `freshness-decay-profile.v1`
   - `agent-relevance-profile.v1`
   - `SourceAuthorityContextProfile`
   - `tool-selection-scorecard.v1`
   - `axis-runtime-budget-profile.v1`
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
4. 已发布的 dispatch / budget runtime 基座与 payload registry current fixtures。

## 输出与 handoff

必须交给中台组的产物：

1. `industry-signal-event-batch.v1` envelope + payload + manifest：
   - `research_paper` accepted / counter / diagnostic / rejected batch refs
   - `conference_academic` accepted / counter / diagnostic / rejected batch refs
2. 两条 `axis-tool-coverage-report.v1` envelope + payload + manifest
3. 两条 `industry-agent-contribution.v1` envelope + payload + manifest
4. `daily-industry-evidence-pack-input.v1` envelope + payload + manifest
5. replay / eval 所需 academic fixtures
6. 若命中 same-run admission / budget / review，必须附 `dispatch_context_ref`、`scheduling_key` 与相关 refs
7. `cross_responsibility_attestation_refs?`、owner boundary 反例、academic anti-upgrade / boundary fixture refs

handoff 要求：

- 不得只交 event batch ref；必须交完整 `IndustryAgentMessageEnvelope`、`payload_ref`、`IndustryAgentArtifactManifest`
- `IndustryAgentContribution` 必须按 `responsibility_id` 拆成两条：
  - `research-frontier`
  - `conference-academic`
- daily 输入只能交 ref 与 lineage，不得内嵌 accepted / rejected 全量 event
- 本组只负责提交 `daily-industry-evidence-pack-input.v1`；`DailyIndustryEvidencePack.v2` 只能由中台组 materialize 和写盘
- `daily-industry-evidence-pack-input.v1` 必须使用数组字段；本组冻结为 `coverage_refs=2`、`contribution_refs=2`，且 `normalized_event_batch_refs` 必须覆盖两轴 canonical batch
- 新闻、社区或产品侧若引用论文/会议信息，本组仍要保留 direct fact owner，并通过 attestation 暴露跨职责补充，而不是允许他组抢 owner

## 实施阶段

### Phase 1：source 与 freshness 基线

1. 以中台组已完成的目录骨架 bootstrap 为前提，只在本组既定工作根目录内新增文件；若根目录缺失，只报告中台组补齐，不得自行改路径命名。
2. 区分 paper / proceedings / schedule / leaderboard / workshop 页面 / benchmark 更新。
3. 绑定 `freshness_anchor_kind`，不得用抓取时间伪装论文或会议新鲜度。
4. 对预印本、录用、正式 proceedings、benchmark 更新、代码复现发布区分 source 与 freshness 语义。
5. freshness、review、budget 和 reason code 必须直接消费共享治理与受控字典；不得在本组内造近义码。
6. 命中 same-run 的补证动作必须显式消费 `dispatch_context_ref`、`claim_admission_assessment_ref`、reservation refs、`scheduling_key` 与 `gap_scope` 语义。

### Phase 2：event 生产

1. 生成 `research_paper` 与 `conference_academic` 事件。
2. 每条 accepted event 必须有 citation ref 或等价 canonical ref。
3. 单篇未复核预印本可以进入 event，但不得被标成足以单独支撑 core 的强主证。
4. accepted / counter / diagnostic / rejected 事件必须进入分离 batch refs，不能在同一批次里混语义。
5. 若论文/会议事实被他组先发现，本组必须提供 owner boundary fixture 与 attestation 输入，确保最终 owner 可回到 academic。

### Phase 3：tool coverage 与 rejection

1. 输出两轴 tool coverage。
2. 对无 DOI、无 canonical venue、无可追溯元数据的结果，进入 rejected / context / needs_review。
3. 保留 benchmark / leaderboard / 复现材料作为 follow-on confirmation，而不是和原论文混成一条事实。
4. 对新闻、社区、产品文档对学术事实的转述，必须准备 owner 不转移的负例 fixture。

### Phase 3A：daily handoff 冻结

1. 产出本组的 `daily-industry-evidence-pack-input.v1`。
2. payload 至少能解析：
   - `normalized_event_batch_refs`
   - `rejected_event_batch_refs`
   - `source_message_ids`
   - `coverage_refs`
   - `contribution_refs`
3. cardinality 冻结为：
   - `coverage_refs` 恰好 `2`
   - `contribution_refs` 恰好 `2`
   - `normalized_event_batch_refs` 至少覆盖 `research_paper`、`conference_academic`
4. 不得把全量 event 内嵌进 daily 输入包。

### Phase 4：academic replay fixture

1. 准备 replay 可重放输入。
2. 准备 `TrendDecisionEvalCase` 所需的研究前沿正例、边界样本、误升级反例。
3. 补跨组 contract fixtures：
   - current schema version consumer fixture
   - previous compatible same-major consumer fixture
   - missing required ref negative fixture
   - unknown higher major negative fixture
4. 补 owner boundary / attestation fixture：
   - 学术事实被新闻/社区/产品转述时，owner 仍归 academic
   - 单篇预印本、单场 workshop、单次 benchmark 更新不可误升 core

## 验收标准

1. `research_paper` 与 `conference_academic` 两轴都能稳定产出 canonical event。
2. 学术引用可追溯，不依赖自由文本解释。
3. 预印本、录用、正式发表、benchmark 更新、代码复现不混语义。
4. 单篇预印本不会被实现层偷升为核心行业趋势主支柱。
5. replay fixture 能作为中台组 decision / diff audit 输入。
6. 两轴 handoff 产物能被中台组直接消费，无需猜字段。
7. daily handoff 保持轻索引，不内嵌胖快照。
8. 学术 owner boundary 与 anti-upgrade 反例可直接进入统一 eval/replay。
9. 本组全部源码、测试、fixture builder 文件都小于 `2000` 行，且 paper / conference / replay 没有堆进单文件实现。

## 验证矩阵

| 范围 | 验证内容 | 方式 | 通过标准 |
| --- | --- | --- | --- |
| paper adapters | paper 元数据与 citation | unit test | citation/ref 可解析 |
| conference adapters | accepted / workshop / schedule / leaderboard 区分 | unit test | venue 语义不混写 |
| freshness | anchor 区分 | fixture test | 不以抓取时间代替发布时间 |
| replay fixtures | historical window 学术输入 | replay fixture | 可被 decision replay 直接消费 |
| daily handoff | daily 输入是轻索引 | schema + fixture test | 只交 ref / lineage，不内嵌全量 event |
| cross-group contract | envelope / manifest / payload / compatibility | contract fixture | 中台组无需口头补字段即可消费 |
| owner boundary | 学术事实被转述 | negative fixture | academic owner 不被新闻/社区抢走 |
| anti-upgrade | 单篇预印本 / 单次会务更新 | eval fixture | 不误升 core |

## 回滚策略

1. 若某类 academic source 不稳定，先降为 context / needs_review，不让它污染 accepted 主证。
2. 若 citation trace 不达标，直接阻断该类结果进入强 supporting。

## 验证记录

| 日期 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 2026-06-23 | 未运行 | `Not Started` | 本轮仅生成子计划 |
| 2026-06-23 | 手工修订子计划 | `Completed` | 已对齐 `agent-relevance-profile.v1` 依赖、目录骨架前置条件与 daily handoff 数组合同 |
