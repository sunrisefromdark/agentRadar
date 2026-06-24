# 执行计划总控：行业级Agent趋势判断 v0.1

## 文档状态

- 版本：`v0.1`
- 当前状态：`Draft`
- 对应需求：
  - `docs/specs/product-specs/行业级Agent趋势判断需求分析.md`
- 对应设计：
  - `docs/specs/design-docs/行业级Agent趋势判断设计文档.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/09-术语与审计词汇表.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/00-总览与设计边界.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/01-产品表面与生产治理.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/02-证据轴与相关性门控.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/03-数据模型契约.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/04-评分裁决与证据归一.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/05-多Agent协作与中间件.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/06-工具保障与SeedRegistry.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/07-运行输出与安全.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/08-验证追溯与完成定义.md`
- 说明：
  - 本文件是总控计划，负责总阶段、单写者边界、拼装顺序和跨组 handoff，不承载每个人的全部落地细节。
- 逐人可执行细节下沉到四份子计划；实现时默认先读本文件，再读自己对应的子计划。
- 本计划只负责把已冻结设计推进成可执行实施拆分，不新增产品语义。
- 本计划中的“四人分工”只是一层实现 ownership，不改变设计中冻结的 `9` 个实际 Agent 与 `15` 个职责项。
- 本计划要求每个执行人优先使用独立 worktree / workspace root；若工具链暂不支持物理隔离，则至少按各自目录和只写边界执行，禁止跨区直改。
- 上游设计已获批准；本计划可继续作为实施与集成评审输入，并按后续 phase gate 推进生产代码实现。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | 行业级Agent趋势判断 |
| 风险等级 | `High` |
| 负责人 | 四人协作 |
| 实现分工总览 | `1号执行人：政策金融`；`2号执行人：学术前沿 + replay/eval 草案`；`3号执行人：产品生态 + owner-boundary 汇总`；`4号执行人：中台裁决与最终拼装` |
| 物理工作区策略 | 四个执行人优先使用独立 worktree / workspace root 并行开发；同一 checkout 仅允许 `4号执行人` 做总控收口，不允许多人同时写同一批共享热点文件 |
| 关联需求 | `docs/specs/product-specs/行业级Agent趋势判断需求分析.md` |
| 关联设计 | `docs/specs/design-docs/行业级Agent趋势判断设计文档.md` |
| 主要影响范围 | `schemas/industry/*`、`src/types.ts`、`src/cli.ts`、`src/storage/files.ts`、`src/action/*`、新增 `src/industry/*`、`src/__tests__/*`、`docs/specs/services/*`、`docs/specs/constraints/*`、`docs/specs/feedback-loops/*`、`README*`、`data/README.md` |

## 子计划索引

| 子计划 | 负责人 | 用途 |
| --- | --- | --- |
| `docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-政策金融组-v0.1.exec-plan.md` | `1号执行人` | 落地 `capital-finance`、`policy-regulatory`、`policy_research_thinktank` 三轴的 official-first 输入面 |
| `docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-学术前沿组-v0.1.exec-plan.md` | `2号执行人` | 落地 `research_paper`、`conference_academic` 两轴与 academic freshness / citation / replay 输入面 |
| `docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-产品生态组-v0.1.exec-plan.md` | `3号执行人` | 落地产品、开源、开发者、社区、新闻五类输入面 |
| `docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-中台裁决组-v0.1.exec-plan.md` | `4号执行人` | 落地 schema 真源、registry snapshot、normalization、audit、tier decision、weekly 输出拼装 |

## 目标

在不把系统偷改成泛 AI 新闻平台、不改写现有项目评分主链、不把运行态降级当作设计范围删减的前提下，落地 `Industry Claim Ledger` 行业趋势侧车：以十轴证据、反证审计、工具覆盖账本、多 Agent 贡献账本和五档趋势等级，替代“少量高分项目聚类 = weekly 趋势”的旧原语。

## 执行前提与硬门禁

### 上游门禁

1. 需求文档状态已是 `READY / Frozen for Design`，可作为实现输入。
2. 设计文档状态已是 `Approved`；后续实现只需继续遵守本计划中的真源门禁、phase gate 与单写者边界。
3. 若设计评审继续要求补冻结项，本计划不得代偿设计缺口，不得在实现阶段自行发明：
   - 新的趋势等级语义
   - 新的证据轴裁剪
   - 新的 Agent 数量或职责合并
   - 新的 public / internal 消费边界

### 真源门禁

以下 machine-readable 真源必须先通过可读性与非占位检查，才允许各实现组并行开工：

- `schemas/industry/canonical-schema.bundle.json`
- `schemas/industry/compatibility-matrix.json`
- `schemas/industry/reason-code-registry.json`
- `schemas/industry/state-transition-registry.json`

若其中任一文件缺失关键 schema family、仍为占位内容，或与 [03-数据模型契约](../design-docs/行业级Agent趋势判断设计/03-数据模型契约.md) 冲突，则 Phase 0 直接阻断，不允许后续“边写边补”。

## 设计保真锚点

以下锚点来自设计冻结项，ExecPlan 只能落地，不得改义：

1. 行业层主原语是 `Industry Claim Ledger`，不是项目聚类换名。
2. 每条 claim 必须完整输出十轴；缺轴必须显式 `missing / unavailable`，不能省略。
3. `capital_finance`、`policy_regulatory`、`policy_research_thinktank`、`news_pr_narrative` 不能单独把方向升级为 `core_industry_trend`。
4. Weekly 用户表面固定为五段式：`行业主判断`、`核心行业趋势`、`观察中趋势与风向探针`、`项目热度簇`、`证据不足与缺口账本`。
5. 运行态实际 Agent 仍是设计冻结的 `9` 个，职责项仍是 `15` 个；四人分工只是一层实现 ownership。
6. `schemas/industry/` 是 machine-readable 单一真源；其他模块不得手写第二份 enum / payload / reason/state 契约。
7. weekly 只能读取最近 `7` 日 `DailyIndustryEvidencePack[]`、`RollingEvidenceWindowSnapshot`、既有 project weekly artifacts，以及已转成 canonical event 的外部摘要；不得回读 provider raw input。
8. `PublicWeeklyIndustryProjection` 必须与 internal canonical section 分离；public consumer 不得直接读 internal weekly section 自己拼。

## 引用与摘录规则

ExecPlan 可以直接引用上游设计冻结结论，但不得在本计划中制造第二份真源。

- 可以直接引用：
  - `03-数据模型契约` 中的 canonical object、字段语义、受控 enum、reason/state 约束
  - `05-多Agent协作与中间件` 中的协作 DAG、message / manifest / payload required behavior
  - `08-验证追溯与完成定义` 中的验证条目、完成定义和防偷懒约束
- 允许为了执行便利做“协作用引用摘录（非真源）”：
  - 只摘录本阶段必须遵守的 3-10 行规则
  - 必须紧邻原文路径引用
  - 必须显式标注“非真源，以设计文档与 `schemas/industry/*` 为准”
- 不得复制为第二份真源：
  - 完整 schema 表
  - enum / reason code / state transition 全表
  - payload schema 完整字段清单
  - compatibility matrix 的正式可执行定义

执行约束：

- 任何会被第二个模块、第二个 Agent 或第二个 checkpoint 正式消费的字段，都只能先进入 `schemas/industry/*` 真源，再允许在 ExecPlan 中被引用。
- ExecPlan 中若出现与设计真源冲突的字段、命名或状态语义，以设计真源和 `schemas/industry/*` 为准；ExecPlan 视为待修复，而不是实现时自行择一。

## 四人分工

### 分工原则

- 分工按“实现边界与集成依赖”切，不按“谁愿意顺手多改几个文件”切。
- 已固定：`1号执行人` 负责 `政策 + 金融`，不再拆散。
- 其余三组按最少跨界、最少互相等 schema、最少 same-run 串行争抢来切。
- 原草稿里的 `4号执行人` 的确偏大；本次总控改为“总控 + 四份子计划”后，`4号执行人` 只保留共享真源、归一裁决和最终拼装，领域 seed / tool / fixture / docs 责任前推给前三组。

### 工作量再平衡

- `2号执行人` 除学术双轴实现外，额外负责 replay / eval 草案资产的首稿。
- `3号执行人` 除产品生态五轴实现外，额外负责 owner-boundary / propagation 负例模板首稿。
- `4号执行人` 不再补造领域 seed、领域反例文本或 replay 原始样本，只做最终集成。

### 单写者边界

为避免四个人同时改同一批核心文件，本计划冻结单写者规则：

- 只有 `中台裁决组` 可直接修改 `schemas/industry/*`、`src/types.ts`、`src/cli.ts`、`src/storage/files.ts`、`src/action/weekly*`、`src/action/runSummary.ts`、`src/action/dailyVerification.ts`。
- `政策金融组` 只改 finance / policy 相关模块、测试、seed / fixture，并通过 handoff artifact 与 `docs-change-note` 喂给中台组。
- `学术前沿组` 只改 academic 相关模块、测试、seed / fixture，并通过 handoff artifact 与 `docs-change-note` 喂给中台组。
- `产品生态组` 只改 product / oss / developer / community / news 相关模块、测试、seed / fixture，并通过 handoff artifact 与 `docs-change-note` 喂给中台组。
- 领域组不得直接改 weekly 裁决、public projection、共享 schema 真源；需要变更时只提 schema change note，由中台组统一落地。

### 共享热点文件与目录归属

为避免“虽然没碰 `schemas/industry/*`，但大家都去改同一个 fixture / README / seed 文件”的隐形冲突，本计划再冻结一层共享热点归属：

- 只有 `中台裁决组` 可修改：
  - `schemas/industry/*`
  - `src/industry/platform/contracts/*`
  - `src/industry/platform/registry/*`
  - `src/industry/platform/normalization/*`
  - `src/industry/platform/audit/*`
  - `src/industry/platform/trend/*`
  - `src/industry/platform/output/*`
  - `src/storage/files.ts`
  - `src/action/weekly*`
  - `src/action/runSummary.ts`
  - `src/action/dailyVerification.ts`
  - `src/__tests__/industrySchemaContract*.test.ts`
  - `src/__tests__/industryClaimDecision*.test.ts`
  - `src/__tests__/industryWeeklyProjection*.test.ts`
  - `docs/specs/services/*`
  - `docs/specs/constraints/*`
  - `docs/specs/feedback-loops/*`
  - `README.md`
  - `data/README.md`
- 只有 `政策金融组` 可修改：
  - `src/industry/agents/finance-agent/*`
  - `src/industry/agents/policy-agent/*`
  - `src/__tests__/industry/agents/finance-agent/*`
  - `src/__tests__/industry/agents/policy-agent/*`
  - `fixtures/industry/agents/finance-agent/*`
  - `fixtures/industry/agents/policy-agent/*`
  - `data/industry-seeds/agents/finance-agent/*`
  - `data/industry-seeds/agents/policy-agent/*`
- 只有 `学术前沿组` 可修改：
  - `src/industry/agents/academic-agent/*`
  - `src/__tests__/industry/agents/academic-agent/*`
  - `fixtures/industry/agents/academic-agent/*`
  - `data/industry-seeds/agents/academic-agent/*`
- 只有 `产品生态组` 可修改：
  - `src/industry/agents/product-oss-agent/*`
  - `src/industry/agents/community-news-agent/*`
  - `src/__tests__/industry/agents/product-oss-agent/*`
  - `src/__tests__/industry/agents/community-news-agent/*`
  - `fixtures/industry/agents/product-oss-agent/*`
  - `fixtures/industry/agents/community-news-agent/*`
  - `data/industry-seeds/agents/product-oss-agent/*`
  - `data/industry-seeds/agents/community-news-agent/*`
- 四组都不得并发改同一份总控文档、总控 README 或结构测试；领域组若要补充说明，只能改自己子计划和本组目录下的 fixture/seed，或提交 `docs-change-note`；`docs/specs/services/*`、`docs/specs/constraints/*`、`docs/specs/feedback-loops/*`、`README.md`、`data/README.md` 统一由中台组写入和收口。
- replay / eval 草案、owner-boundary 汇总、schema-change-note 与 shared-runtime-note 都必须有唯一 writer；其他组只能引用，不得复制改写成第二份真源。

补充文档协作约束：

- `docs-change-note` 是领域组唯一允许提交的跨组文档变更输入，最少包含：目标文档、拟新增/修改的小节、设计依据、关联 schema/payload、验证影响。
- 领域组不得直接编辑 `docs/specs/services/*`、`docs/specs/constraints/*`、`docs/specs/feedback-loops/*`、`README.md`、`data/README.md`；即使内容只涉及本组，也必须通过 `docs-change-note` 进入 D 组统一落盘。
- D 组在 Phase 6 统一消费 `docs-change-note`，把跨组文档更新收口到单一 writer，避免四人并行时出现文档冲突和口径漂移。
- `docs-change-note` 不是建议单，而是跨组文档的硬门禁；没有先形成 `docs-change-note` 的共享文档改动，一律视为未获授权，不得直接改文件。
- 为避免文档侧再次形成共享热点，四组都不得绕过 `docs-change-note` 直接碰 `docs/specs/services/*`、`docs/specs/constraints/*`、`docs/specs/feedback-loops/*`、`README.md`、`data/README.md`，这部分只保留中台组单写者。

### 文件架构改进结论

当前仓库只有通用 `src/action/*`、`src/types.ts`、`src/storage/*` 等主干目录，尚未形成 industry 侧的独立实现树。若直接在现有平铺结构上加功能，四人会快速挤到同一批文件里，导致：

- 领域逻辑被塞进 `src/action/*`，weekly 入口变胖。
- `src/types.ts`、`src/cli.ts`、`src/storage/files.ts` 成为多人争抢热点。
- 测试、fixture、seed 无法按职责项隔离，后续 replay / eval 难维护。

因此文件架构需要先做一次最小但明确的调整：

1. 新增独立 `src/industry/*` 子树，所有行业趋势逻辑默认只落在该子树。
2. 保留 `src/action/*` 作为薄 orchestration 入口，不承载领域解析、归一、裁决细节。
3. 保留 `src/types.ts` 作为少量公共导出面；细粒度行业类型、payload、artifact ref 解析全部下沉到 `src/industry/platform/contracts/*`。
4. 新增 `src/__tests__/industry/agents/*`、`fixtures/industry/agents/*`、`data/industry-seeds/agents/*` 三层配套目录，按实际 Agent 隔离测试输入与种子数据。
5. 按“每个实际 Agent 一个工作根目录”组织实现，禁止把多 Agent 代码继续堆回单个 mega-file 或单个 mega-folder。
6. 对当前已经接近上限的热点文件建立硬门禁：`src/action/weeklyEnhancement.ts`、`src/action/runSummary.ts`、`src/action/dailyVerification.ts`、`src/cli.ts`、`src/types.ts`、`src/storage/files.ts` 只能保留薄入口和最少 glue code，任何行业趋势相关逻辑、schema 解释、裁决、归一、owner arbitration 与 report 拼装一律下沉到 `src/industry/*`，不得继续回灌热点入口。

### 目录骨架与单 Agent 工作区

总控冻结以下目录骨架；并行开发前必须先由 `4号执行人` 完成一次“只建目录、不写业务逻辑”的 bootstrap，把单 Agent 级工作根目录、测试根目录、fixture 根目录和 seed 根目录全部落出来。当前仓库还没有成型的 `src/industry/*`、`src/__tests__/industry/*`、`fixtures/industry/*`、`data/industry-seeds/*`，如果继续让各组在自己 Phase 里顺手创建，最先分叉的不是实现而是目录命名与根路径。除共享真源外，其他目录只允许对应组维护：

- `中台裁决组` 独立工作区：
  - `schemas/industry/*`
  - `src/industry/agents/registry-agent/*`
  - `src/industry/agents/normalization-agent/*`
  - `src/industry/agents/audit-agent/*`
  - `src/industry/agents/trend-agent/*`
  - `src/industry/platform/contracts/*`
  - `src/industry/platform/registry/*`
  - `src/industry/platform/normalization/*`
  - `src/industry/platform/audit/*`
  - `src/industry/platform/trend/*`
  - `src/industry/platform/output/*`
  - `src/__tests__/industry/agents/registry-agent/*`
  - `src/__tests__/industry/agents/normalization-agent/*`
  - `src/__tests__/industry/agents/audit-agent/*`
  - `src/__tests__/industry/agents/trend-agent/*`
  - `src/__tests__/industry/platform/*`
  - `fixtures/industry/agents/registry-agent/*`
  - `fixtures/industry/agents/normalization-agent/*`
  - `fixtures/industry/agents/audit-agent/*`
  - `fixtures/industry/agents/trend-agent/*`
  - `fixtures/industry/platform/*`
  - `data/industry-seeds/agents/registry-agent/*`
  - `data/industry-seeds/agents/normalization-agent/*`
  - `data/industry-seeds/agents/audit-agent/*`
  - `data/industry-seeds/agents/trend-agent/*`
  - `data/industry-seeds/platform/*`
- `政策金融组` 独立工作区：
  - `src/industry/agents/finance-agent/*`
  - `src/industry/agents/policy-agent/*`
  - `src/__tests__/industry/agents/finance-agent/*`
  - `src/__tests__/industry/agents/policy-agent/*`
  - `fixtures/industry/agents/finance-agent/*`
  - `fixtures/industry/agents/policy-agent/*`
  - `data/industry-seeds/agents/finance-agent/*`
  - `data/industry-seeds/agents/policy-agent/*`
- `学术前沿组` 独立工作区：
  - `src/industry/agents/academic-agent/*`
  - `src/__tests__/industry/agents/academic-agent/*`
  - `fixtures/industry/agents/academic-agent/*`
  - `data/industry-seeds/agents/academic-agent/*`
- `产品生态组` 独立工作区：
  - `src/industry/agents/product-oss-agent/*`
  - `src/industry/agents/community-news-agent/*`
  - `src/__tests__/industry/agents/product-oss-agent/*`
  - `src/__tests__/industry/agents/community-news-agent/*`
  - `fixtures/industry/agents/product-oss-agent/*`
  - `fixtures/industry/agents/community-news-agent/*`
  - `data/industry-seeds/agents/product-oss-agent/*`
  - `data/industry-seeds/agents/community-news-agent/*`

冻结补充规则：

- 历史上的组级目录命名（如 `finance`、`policy`、`academic`、`productOss`、`communityNews`、`finance-policy`、`product-ecosystem`）不再保留为实现目录；若发现残留实现，合并前必须迁移进对应 `*-agent` 目录。
- 每个执行人默认只写自己的工作区、测试区、fixture 区和 seed 区；总控组只允许写 `schemas/industry/*`、platform 共享目录和本总控计划本身。

冻结补充规则：

- `src/action/weekly*`、`src/action/runSummary.ts`、`src/action/dailyVerification.ts` 只能调用 `src/industry/*` 暴露的稳定入口；不得直接承载十轴规则和领域源解析。
- 领域组若需要共享 helper，只能先提 `schema-change-note` 或 shared-runtime-note，由中台组决定是否上收进 `src/industry/platform/contracts/*` 或其他共享目录；不得在两组目录之间互相复制 helper。
- 新功能优先在各自 Agent 工作区内闭合：adapter、policy、builder、coverage、handoff、tests、fixtures、seeds 一起放在对应 Agent 根目录附近，不向外散落。
- `schemas/industry/*` 仍是唯一 machine-readable 真源，但它不再承担“中台组工作根目录”角色；中台运行时代码统一收在 `src/industry/platform/*`。
- 现有 `src/signal/*`、`src/industry/tools/*` 仅允许被只读复用；任何需要改写、抽取或共享的逻辑，都必须先由中台组上收进 `src/industry/platform/*` 后再消费。
- 任何共享 helper、schema-change-note、shared-runtime-note、replay/eval 草案和 owner-boundary 模板都必须有单一 owner；其他组只能引用，不得复制改写成第二份真源。

### 单文件规模与拆分规则

为防止后续出现难以维护的超大文件，本计划冻结以下硬约束：

- 任意新增或重构后的源码、测试、fixture builder 文件都必须 `< 2000` 行。
- 任意文件达到 `1200` 行时，所属实现组必须在当前阶段内拆分，不得继续顺手堆功能。
- 任意文件达到 `1500` 行时，禁止再往该文件加新职责；必须先按“轴 / 职责项 / pipeline stage”拆出子模块。
- `src/action/*`、`src/types.ts`、`src/cli.ts` 这类高热点入口文件应保持更薄，目标不超过 `800` 行。

拆分优先级固定为：

1. 先按职责边界拆：不同 `axis_id`、不同 `responsibility_id`、不同 runtime stage 不放同文件。
2. 再按流水线拆：`sourceCatalog`、`routeSelection`、`policy`、`eventBuilder`、`coverage`、`contribution`、`handoff` 分文件。
3. 测试按 `contract`、`unit`、`negative-fixture`、`replay/eval` 拆分，禁止把全组验证堆进一个大测试文件。

### Canonical 映射总表

为避免实现时把 `actual_agent_id`、`responsibility_id`、`axis_id`、输入面和 contribution 计数单位混成多套主键，当前计划冻结如下映射。实现、fixture、message、manifest、tests 和文档都必须引用这张表；不得各自再发明平行命名。

| actual_agent_id | responsibility_id | 主轴 / 输入面 | canonical `axis_id` | 典型 event family | contribution 计数单位 |
| --- | --- | --- | --- | --- | --- |
| `finance-agent` | `capital-finance` | 资本/金融 | `capital_finance` | filing / fund / M&A / financing / market signal | 每职责项一条 `IndustryAgentContribution` |
| `policy-agent` | `policy-regulatory` | 政策/监管 | `policy_regulatory` | law / regulator notice / official policy doc | 每职责项一条 `IndustryAgentContribution` |
| `policy-agent` | `policy-research-thinktank` | 政策研究/智库 | `policy_research_thinktank` | thinktank report / institute brief / policy research | 每职责项一条 `IndustryAgentContribution` |
| `academic-agent` | `research-frontier` | 研究前沿 | `research_paper` | paper / preprint / benchmark / reproduction | 每职责项一条 `IndustryAgentContribution` |
| `academic-agent` | `conference-academic` | 学术会议 | `conference_academic` | proceedings / accepted talk / workshop / challenge | 每职责项一条 `IndustryAgentContribution` |
| `product-oss-agent` | `product-platform` | 产品平台 | `product_vendor_release` | release note / doc update / product launch | 每职责项一条 `IndustryAgentContribution` |
| `product-oss-agent` | `developer-studio` | 开发者/工作室 | `developer_studio` | studio post / builder update / launch thread | 每职责项一条 `IndustryAgentContribution` |
| `product-oss-agent` | `project-oss` | 项目/开源 | `project_open_source` | repo release / model card / package publish | 每职责项一条 `IndustryAgentContribution` |
| `community-news-agent` | `cn-community` | 中文社区 | `community_discussion` | forum / issue / blog / practice note | 每职责项一条 `IndustryAgentContribution` |
| `community-news-agent` | `global-community` | 海外社区 | `community_discussion` | forum / issue / thread / practice note | 每职责项一条 `IndustryAgentContribution` |
| `community-news-agent` | `news-pr` | 新闻/宣传 | `news_pr_narrative` | media report / PR / recap / narrative | 每职责项一条 `IndustryAgentContribution` |

补充约束：

- `responsibility_id` 是交账与 ownership 单位；`axis_id` 是证据判断维度；二者不能互相代替。
- `community_discussion` 轴允许由 `cn-community` 与 `global-community` 两个职责项分别交账；但每条 accepted event 只能有一个 direct fact owner。
- `event batch` 可以按输入面或轴聚合，但 `IndustryAgentContribution` 必须严格按 `responsibility_id` 一条职责项一条记录。

### 1号执行人：政策与金融 Agent 组

对应运行时 Agent：

- `finance-agent`
- `policy-agent`

对应职责项：

- `capital-finance`
- `policy-regulatory`
- `policy-research-thinktank`

主要职责：

- 落地高权威轴的 official-first 采集与 canonical fetch 停止策略。
- 落地 [06-工具保障与SeedRegistry](../design-docs/行业级Agent趋势判断设计/06-工具保障与SeedRegistry.md) 中对 `capital_finance` / `policy_regulatory` 的 source class、tool scorecard、activation policy、stop policy 约束。
- 产出这三条轴的 `IndustrySignalEvent`、`AxisToolCoverageReport`、缺口 reason code、review 触发条件和 daily evidence pack 输入。

允许改动：

- `src/industry/agents/finance-agent/*`
- `src/industry/agents/policy-agent/*`
- `src/__tests__/industry/agents/finance-agent/*`
- `src/__tests__/industry/agents/policy-agent/*`
- `fixtures/industry/agents/finance-agent/*`
- `fixtures/industry/agents/policy-agent/*`
- `data/industry-seeds/agents/finance-agent/*`
- `data/industry-seeds/agents/policy-agent/*`
- 对应 specs、seed registry、tool registry fixture

禁止改动：

- 不得写 `decision_tier`
- 不得绕过 official-first 把搜索聚合结果当 primary supporting source
- 不得把 `needs_review / unavailable` 伪装成“无趋势”

交付物：

- `industry-signal-event.v1` 批次
- finance / policy `AxisToolCoverageReport`
- 对应 `IndustryAgentContribution`
- finance / policy seed 与 tool registry 快照输入

### 2号执行人：学术前沿 Agent 组

对应运行时 Agent：

- `academic-agent`

对应职责项：

- `research-frontier`
- `conference-academic`

主要职责：

- 落地论文、顶会、benchmark、workshop、tutorial、challenge 相关的 evidence 生产链。
- 严格按 [02-证据轴与相关性门控](../design-docs/行业级Agent趋势判断设计/02-证据轴与相关性门控.md) 与 [04-评分裁决与证据归一](../design-docs/行业级Agent趋势判断设计/04-评分裁决与证据归一.md) 区分 `research_frontier` 的主支柱与独立交叉确认。
- 产出学术轴事件、citation trace、freshness anchor 与 replay 可复现输入。

允许改动：

- `src/industry/agents/academic-agent/*`
- `src/__tests__/industry/agents/academic-agent/*`
- `fixtures/industry/agents/academic-agent/*`
- `data/industry-seeds/agents/academic-agent/*`
- 学术工具 connector、academic 相关 tests、对应 specs

禁止改动：

- 不得把单篇预印本直接写成 `core`
- 不得把通用搜索结果直接替代学术元数据与官方学术源

交付物：

- 学术轴 `IndustrySignalEvent` 批次
- 学术工具覆盖报告
- 学术类 `IndustryAgentContribution`

### 3号执行人：产品生态 Agent 组

对应运行时 Agent：

- `product-oss-agent`
- `community-news-agent`

对应职责项：

- `product-platform`
- `developer-studio`
- `project-oss`
- `cn-community`
- `global-community`
- `news-pr`

主要职责：

- 落地产品发布、开发者/工作室、项目/开源、社区讨论、新闻/宣传五类日常发现链路。
- 负责中文/海外社区区分、传播链去重前的原始 event 生产、产品与 OSS 的 owner 边界输入。
- 产出 supporting / context / counter 线索，但不得把 `news-pr` 直接升级为核心趋势主支柱。

允许改动：

- `src/industry/agents/product-oss-agent/*`
- `src/industry/agents/community-news-agent/*`
- `src/__tests__/industry/agents/product-oss-agent/*`
- `src/__tests__/industry/agents/community-news-agent/*`
- `fixtures/industry/agents/product-oss-agent/*`
- `fixtures/industry/agents/community-news-agent/*`
- `data/industry-seeds/agents/product-oss-agent/*`
- `data/industry-seeds/agents/community-news-agent/*`
- 对应 tests、specs、artifact fixtures

禁止改动：

- 不得把 `news_pr_narrative` 和 `community_discussion` 混写成同一 accepted event
- 不得用媒体转述抢走社区原帖或官方发布的 owner

交付物：

- 产品/社区/开源相关 `IndustrySignalEvent` 批次
- 对应六类职责项 contribution
- 产品生态与社区工具覆盖报告

### 4号执行人：中台裁决与治理 Agent 组

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

主要职责：

- 维护 `schemas/industry/*` 真源、registry snapshot、tool registry snapshot、message / manifest / payload registry。
- 落地 source-chain 去重、fact resolution、owner arbitration、claim family fold、claim admission、counter-evidence audit、tier decision。
- 生成 `IndustryClaimLedger`、`WeeklyIndustryTrendSection`、`ConsumerWeeklyIndustryView`、`PublicWeeklyIndustryProjection`。
- 负责 run-budget、review-availability、rollback seam 与 weekly/public projection 集成。
- 不再独占领域 seed / domain fixture / 领域文档同步；这些交给前三组各自维护并按 handoff 契约输入。

允许改动：

- `schemas/industry/*`
- `src/industry/platform/contracts/*`
- `src/industry/platform/registry/*`
- `src/industry/platform/normalization/*`
- `src/industry/platform/audit/*`
- `src/industry/platform/trend/*`
- `src/industry/platform/output/*`
- `src/types.ts`
- `src/cli.ts`
- `src/storage/files.ts`
- `src/action/dailyVerification.ts`
- `src/action/runSummary.ts`
- `src/action/weeklyEnhancement.ts`
- `src/action/weeklyTrendAgent.ts`
- `src/action/weeklyJudgmentRules.ts`
- `src/action/weeklyReport.ts`
- `src/__tests__/industrySchemaContract.test.ts`
- `src/__tests__/industryClaimDecision.test.ts`
- `src/__tests__/industryWeeklyProjection.test.ts`

禁止改动：

- 不得重新解释十轴语义
- 不得把“coverage / audit 不完整”偷换成“tier 不成立”
- 不得把 public blockage 反向改写 internal ledger 结论

交付物：

- canonical schema / registry / state-machine 真源
- normalization / fact / claim / audit / ledger 产物
- weekly internal / consumer / public 三层输出
- eval / replay / governance artifact

## 当前状态

- 需求分析：`Approved`
- 设计文档：`Approved`
- ExecPlan：`Draft`
- 实施：`Not Started`
- 验证：`Not Started`
- 目录骨架 bootstrap：`Completed`
- ExecPlan 合同对齐：`Completed`

## 阶段进度

| 阶段 | 状态 | 目标 | 主要负责人 |
| --- | --- | --- | --- |
| Phase 0：上游门禁与真源核对 | `Pending` | 确认设计批准状态、schema 真源完整度、实现边界与 preflight | `4号执行人` |
| Phase 1A：L0/L1 契约与存储基座 | `Pending` | 固定 `schemas/industry/*`、artifact path、message/manifest 基线与 payload registry 真源 | `4号执行人` |
| Phase 1B：共享治理契约基线 | `Pending` | 固定 budget / activation / scorecard / review availability 基线 | `4号执行人` |
| Phase 1C：Dispatch / Budget Runtime Base | `Pending` | 固定 `same-run-dispatch-context`、reservation、budget arbitration 与 reject 行为 | `4号执行人` |
| Phase 2：三组领域 Agent 并行落地 | `Pending` | 按学术 / 产品生态 / 政策金融三条输入面生成 canonical event、provisional owner 与领域级负例 fixture | `1/2/3号执行人` |
| Phase 3：Registry、工具覆盖与预算治理 | `Pending` | 跑通 registry snapshot、tool coverage、activation/stop policy、capacity/budget 基线 | `4号执行人` 主导，`1号执行人` 负责高权威轴预算接线，`2号执行人` 负责 replay/eval 输入模板，`3号执行人` 负责 owner-boundary 模板 |
| Phase 4：归一、claim admission 与反证审计 | `Pending` | 跑通 attestation、fact resolution、owner arbitration、claim fold、audit 输入 | `4号执行人` |
| Phase 5：tier decision 与 weekly 三层输出 | `Pending` | 生成 ledger、weekly internal section、consumer view、public projection | `4号执行人` |
| Phase 6：eval / replay / docs / structure 同步 | `Pending` | 汇总各组 fixture、跑通验证矩阵、同步 specs、补齐回放与治理面 | `全员`，`2号执行人` 主导 replay/eval 草案装配，`4号执行人` 收口 |
| Phase 7：总体验收 | `Pending` | typecheck、tests、preflight、dry-run、review 记录全通过 | `全员` |

## 实施阶段

### Handoff 契约

所有子计划之间只通过以下 canonical handoff 拼接，不允许口头补字段：

1. 领域组 -> 中台组
   - `IndustryAgentMessageEnvelope`
   - `payload_schema`
   - `payload_ref`
   - `IndustryAgentArtifactManifest`
   - `input_artifact_refs`
   - `output_artifact_refs`
   - `idempotency_key`
   - `checkpoint_stage`
   - canonical batch refs / coverage refs / contribution refs / rejected-failure-unavailable refs
2. 中台组 -> 领域组
   - schema 真源版本
   - reason/state 受控字典
   - registry snapshot / tool registry snapshot
   - normalization / audit / claim admission 反馈 envelope + manifest + payload refs
3. 总控验收时只认 artifact refs、schema version、compatibility matrix 和验证记录，不认“已经口头对齐”。
4. `replay/eval` 草案、`owner-boundary` 汇总与 `schema-change-note` 只允许各自指定的责任方写入，其他组只能消费引用，不得并行改写同一份草案。

### Handoff Payload Contract

下表冻结本计划允许的跨组 handoff payload 族。字段 required 性、兼容边界和 machine-readable field truth 仍以 `schemas/industry/*` 为准；这里是协作用引用摘录（非真源）。

| handoff 方向 | payload_schema | producer | consumer | 必交 artifact / ref | 缺失时 consumer 必须行为 |
| --- | --- | --- | --- | --- | --- |
| 领域组 -> 中台组 | `industry-signal-event-batch.v1` | A/B/C | D | `accepted_event_batch_ref`、`counter_event_batch_ref?`、`diagnostic_event_batch_ref?`、`rejected_event_batch_ref?` | 拒绝进入 normalization；记录 `schema_mismatch` / `missing_required_artifact_ref` |
| 领域组 -> 中台组 | `axis-tool-coverage-report.v1` | A/B/C | D | `coverage_report_ref`；其中必须能解析 `active_source_class`、`active_route_level`、`degradation_reason_codes` | 对应轴标记 `coverage_audit_state=missing_or_invalid_input`，不得猜测覆盖状态 |
| 领域组 -> 中台组 | `industry-agent-contribution.v1` | A/B/C | D | `contribution_ref`；必须按 `responsibility_id` 一条职责项一条记录 | 对应职责项记为未交账，不得由 event 数反推 contribution |
| 领域组 -> 中台组 | `daily-industry-evidence-pack-input.v1` | A/B/C | D | `normalized_event_batch_refs`、`rejected_event_batch_refs?`、`source_message_ids`、`coverage_refs`、`contribution_refs` | daily pack 进入 `partial`，weekly 不得回读领域组临时文件补链 |
| 中台组 -> 领域组 | `normalization-feedback.v1` | D | A/B/C | `fact_resolution_audit_ref`、`owner_arbitration_ref?`、`claim_admission_feedback_ref?` | 领域组只能按反馈修正 producer；不得绕过 feedback 直接改 weekly 结论 |
| 中台组 -> 领域组 | `schema-governance-notice.v1` | D | A/B/C | `schema_version`、`compatibility_note_ref`、`reason_state_registry_ref` | 未消费新 notice 的领域组不得继续发布新 major 不兼容 payload |

补充约束：

- 所有 claim-critical checkpoint 若命中 same-run admission / budget / review / shared pool，message 必须显式带 `dispatch_context_ref`、`scheduling_key` 和相关 reservation / admission refs。
- 没有 envelope、manifest、payload schema 或 canonical artifact ref 的输出，一律视为未登记中间产物，下游不得消费。
- 领域组、中台组都不得以自由文本、会议纪要或临时路径补足 handoff 所缺字段。
- `daily-industry-evidence-pack-input.v1` 是多轴/多职责 producer 的聚合输入，不允许把数组字段压扁成单值字段或本地路径字符串；consumer 只认 canonical ref 数组。

### Payload Schema Registry 落地包

为防止四组“知道有 handoff 名称，但各自补 required 字段和失败语义”，本计划把 payload registry 明确落成 Phase 1A 的硬交付物。以下 schema family 必须先在 `schemas/industry/canonical-schema.bundle.json` materialize，再允许多组并行编码：

1. 调度与任务族：
   - `same-run-dispatch-context.v1`
   - `task-request.v1`
   - `task-result.v1`
   - `failure-notice.v1`
2. 领域 producer 族：
   - `industry-signal-event-batch.v1`
   - `axis-tool-coverage-report.v1`
   - `industry-agent-contribution.v1`
   - `daily-industry-evidence-pack-input.v1`
3. 中台处理族：
   - `normalization-request.v1`
   - `normalization-result.v1`
   - `claim-candidate-batch.v1`
   - `audit-request.v1`
   - `audit-result.v1`
   - `trend-decision-input.v1`
4. same-run 补证与治理族：
   - `evidence-gap-request.v1`
   - `evidence-gap-result.v1`
   - `registry-review-request.v1`
   - `registry-review-result.v1`
   - `schema-governance-notice.v1`

执行约束：

- 每个 payload schema 都必须同时冻结：producer、consumer、required refs、missing behavior、reject behavior、兼容矩阵 entry。
- `payload_schema` 自带版本语义；当前计划不再单列 `payload_schema_version`，避免与设计真源重复。
- `same-run-dispatch-context.v1`、`task-request.v1`、`task-result.v1`、`failure-notice.v1` 是全组共用 L0/L1 契约，不得留到领域组实现时再“顺手补”。
- D 组必须为每个 payload family 提供 current consumer fixture；A/B/C 必须分别为自己生产的 payload family 提供 producer fixture。
- unknown higher major version、kind/payload mismatch、missing required refs、manifest resolve failure 必须有统一 reject fixture，不能由各 consumer 自己发挥。

### Canonical Payload Naming Rule

为避免 registry family 名和正式 `payload_schema` 混用，本计划再冻结一层命名规则：

| 用途 | 允许出现在 `payload_schema` 的正式名 | 仅允许作为说明性 family 名 |
| --- | --- | --- |
| 领域事件批次 | `industry-signal-event-batch.v1` | `event-batch` |
| 轴级覆盖报告 | `axis-tool-coverage-report.v1` | `tool-status-report` |
| 职责交账 | `industry-agent-contribution.v1` | 无 |
| daily 输入包 | `daily-industry-evidence-pack-input.v1` | 无 |

执行约束：

- envelope、manifest、compatibility matrix、producer fixture、consumer fixture 中的 `payload_schema` 只能使用上表正式名。
- `event-batch`、`tool-status-report` 这类短名只允许作为 registry family、章节标题或协作用语，不得落入 machine-readable `payload_schema`。
- 如需新增正式 payload 名，必须先更新 `schemas/industry/canonical-schema.bundle.json` 与 `compatibility-matrix.json`，不得由某一组先在本地 fixture 里试写。

### 冻结设计项落地矩阵

以下冻结项必须在开工前明确 owner、phase 和落点，防止实现时各组各自补默认行为：

| design item | owner | phase | schema path | runtime / tests path |
| --- | --- | --- | --- | --- |
| `field-ownership-policy.v1` | D | Phase 1A | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + `src/__tests__/industry/platform/contract*.test.ts` |
| `fact-resolution-profile.v1` | D | Phase 1A | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/normalization/*` + `src/__tests__/industry/platform/normalization*.test.ts` |
| `freshness-decay-profile.v1` | D | Phase 1A | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + 领域组 freshness fixtures |
| `agent-relevance-profile.v1` | D | Phase 1A | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + A/B/C relevance fixtures + `src/__tests__/industry/platform/decision*.test.ts` |
| `SourceAuthorityContextProfile` | D | Phase 1A | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + authority contract tests |
| `HumanReviewQueueItem` / `OverrideAudit` | D | Phase 1A | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/registry/*` + review/override fixtures |
| `tool-selection-scorecard.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + coverage/run fixtures |
| `task-timeout-profile.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + timeout/failure fixtures |
| `tool-call-timeout-profile.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + route fallback fixtures |
| `axis-subscore-rubric.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + scoring fixtures + per-axis contract tests |
| `axis-runtime-budget-profile.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + budget fixtures + A/B/C runtime integration fixtures |
| `axis-activation-policy.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | A/C 组 route/activation 模块 + negative fixtures |
| `claim-archetype-axis-applicability.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/trend/*` + `src/__tests__/industry/platform/decision*.test.ts` + projection fixtures |
| `axis-status-threshold-profile.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/trend/*` + decision/eval fixtures |
| `claim-archetype-decision-profile.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/trend/*` + decision/eval fixtures |
| `independence-credit-profile.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/audit/*` + decision/eval fixtures |
| `canonical-fetch-stop-policy.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | A/C 组 stop-policy 模块 + replay fixtures |
| `same-run-eligible-micro-task-matrix.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + run fixtures |
| `micro-task-runtime-budget-profile.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + budget fixtures |
| `micro-task-cost-profile.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + budget fixtures |
| `rotation-budget-profile.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + rotation/retry fixtures |
| `shared-capacity-policy.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + `CapacityReservation` fixtures |
| `runtime-sizing-assumptions.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + replay/eval fixtures |
| `gap-scope-contract.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + gap fixtures |
| `message-key-policy.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/contracts/*` + envelope contract tests |
| `runtime-concurrency-control-policy.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/registry/*` + run fixtures |
| `backlog-compaction-policy.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/registry/*` + replay fixtures |
| `reopen-impact-matrix.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/trend/*` + replay fixtures |
| `headline-capacity-policy.v1` | D | Phase 1B | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/output/*` + projection fixtures |
| `ClaimAdmissionAssessment` / `DecisionContextArtifact` | D | Phase 1C | `schemas/industry/canonical-schema.bundle.json` | `src/industry/platform/trend/*` + decision fixtures |

### Daily / Weekly Artifact Contract

为避免 daily pack 被做成胖快照，或 weekly 回读历史临时输入，本计划冻结以下消费边界：

| artifact | producer | consumer | 必须包含 | 明确禁止 |
| --- | --- | --- | --- | --- |
| `DailyIndustryEvidencePack.v2` | D 汇总，A/B/C 提供输入 | weekly / replay / verification | `normalized_event_batch_ref`、`rejected_event_batch_ref?`、`source_message_ids`、`input_artifact_refs`、`agent_contributions`、`coverage_summary`、public projection 状态 | 内嵌 accepted / rejected 全量 event；读取 provider raw input |
| `RollingEvidenceWindowSnapshot.v1` | D | weekly / replay | `rolling_evidence_snapshot_ref`、`carry_forward_until`、`carry_forward_reason_codes`、`invalidation_reason_codes` | 绕过 snapshot 直接把 7 日外历史 supporting event 偷渡进 weekly |
| `WeeklyIndustryTrendSection` | D | internal consumers | `lineage_refs`、`run_budget_summary`、`industry_window_status`、`public_projection_ref` | 由 public consumer 直接读取并自行拼公开输出 |

`daily-industry-evidence-pack-input.v1` 的最小 required shape 先冻结为数组口径：

- `normalized_event_batch_refs: string[]`
- `rejected_event_batch_refs?: string[]`
- `source_message_ids: string[]`
- `coverage_refs: string[]`
- `contribution_refs: string[]`

`daily-industry-evidence-pack-input.v1` -> `DailyIndustryEvidencePack.v2` 字段映射与 writer/owner 冻结如下：

| 字段 / artifact | A/B/C 领域组负责 | D 组负责 |
| --- | --- | --- |
| `normalized_event_batch_refs` | 在 input payload 中按轴或按本组 canonical bundle 提交 `1..N` 个 batch refs | 聚合多组 refs，materialize 单一 `normalized_event_batch_ref`，校验 manifest / compatibility，不重写领域语义 |
| `rejected_event_batch_refs?` | 提交本组 rejected / unavailable / diagnostic `0..N` 个 batch refs | 统一窗口化与消费，materialize 单一 `rejected_event_batch_ref?`；不得把缺 ref 的组静默补成成功 |
| `source_message_ids` | 提交本组 producer message lineage | 汇总为 daily pack / weekly / replay 可回溯 lineage |
| `coverage_refs` / `contribution_refs` | 各组分别提交本组 ref 数组；按轴 / 职责项稳定拆分 | 解析后生成 `coverage_summary`、`agent_contributions`，并通过 `input_artifact_refs` 保留 lineage |
| `public projection state` | 不负责回填 | 只能由 D 基于治理链与 projection 规则回填 |
| `DailyIndustryEvidencePack.v2` 写盘 | 不直接写最终 daily pack | D 是唯一 materializer；A/B/C 只交 input，不得各自写 daily pack |

### Schema Change Workflow

为避免中台组成为“口头同步瓶颈”或领域组偷加局部字段，本计划冻结如下变更流程：

1. 任何跨模块字段、枚举、reason code、state 或 payload required behavior 变更，都必须先提交 `schema-change-note`。
2. `schema-change-note` 最少包含：
   - 变更背景
   - 影响对象 / payload schema
   - `L0/L1/L2` 分层判断
   - producer / consumer
   - breaking / non-breaking 结论
   - compatibility matrix 影响
   - 所需测试
3. 中台组需在 `24h` 内给出：`accepted`、`accepted_with_constraints`、`rejected` 或 `needs_design_clarification`。
4. 若属 breaking change，必须先更新 `schemas/industry/canonical-schema.bundle.json` 与 `compatibility-matrix.json`，再允许领域组编码。
5. 进入 Phase 2 后，`L0/L1` 只允许修错与补齐已冻结语义，不允许新增自由扩展语义；`L2` 字段若被第二个模块依赖，必须先升级回真源。

### Phase 0：上游门禁与真源核对

1. 运行设计评审前置检查，确认上游设计是否达到可实施状态。
2. 核对以下真源与设计章节是否一致：
   - `schemas/industry/canonical-schema.bundle.json`
   - `schemas/industry/compatibility-matrix.json`
   - `schemas/industry/reason-code-registry.json`
   - `schemas/industry/state-transition-registry.json`
   - [03-数据模型契约](../design-docs/行业级Agent趋势判断设计/03-数据模型契约.md)
3. 明确四人分工不改变运行态 Agent 数量与职责项。
4. 先补 industry 结构测试与 doc consistency 测试，未通过前不进入生产实现。
5. 若设计评审仍要求补冻结项，本计划状态保持 `Draft`，停止后续阶段。

### Phase 1A：L0/L1 契约与存储基座

1. 固定 `schemas/industry/*` 为跨模块唯一真源。
2. 先创建并冻结 industry 目录骨架，至少包括：
   - `src/industry/platform/contracts/*`
   - `src/industry/agents/finance-agent/*`
   - `src/industry/agents/policy-agent/*`
   - `src/industry/agents/academic-agent/*`
   - `src/industry/agents/product-oss-agent/*`
   - `src/industry/agents/community-news-agent/*`
   - `src/industry/agents/registry-agent/*`
   - `src/industry/agents/normalization-agent/*`
   - `src/industry/agents/audit-agent/*`
   - `src/industry/agents/trend-agent/*`
   - `src/industry/platform/registry/*`
   - `src/industry/platform/normalization/*`
   - `src/industry/platform/audit/*`
   - `src/industry/platform/trend/*`
   - `src/industry/platform/output/*`
   - `src/__tests__/industry/agents/{finance-agent,policy-agent,academic-agent,product-oss-agent,community-news-agent,registry-agent,normalization-agent,audit-agent,trend-agent}/*`
   - `fixtures/industry/agents/{finance-agent,policy-agent,academic-agent,product-oss-agent,community-news-agent,registry-agent,normalization-agent,audit-agent,trend-agent}/*`
   - `data/industry-seeds/agents/{finance-agent,policy-agent,academic-agent,product-oss-agent,community-news-agent,registry-agent,normalization-agent,audit-agent,trend-agent}/*`
3. 落地以下 canonical object / payload 真源与兼容矩阵对齐：
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
   - `PublicWeeklyIndustryProjection`
   - `ConsumerWeeklyIndustryView`
4. 同步 materialize payload schema registry，至少覆盖：
   - `same-run-dispatch-context.v1`
   - `task-request.v1`
   - `task-result.v1`
   - `industry-signal-event-batch.v1`
   - `axis-tool-coverage-report.v1`
   - `industry-agent-contribution.v1`
   - `daily-industry-evidence-pack-input.v1`
   - `normalization-request/result.v1`
   - `claim-candidate-batch.v1`
   - `audit-request/result.v1`
   - `evidence-gap-request/result.v1`
   - `registry-review-request/result.v1`
   - `failure-notice.v1`
5. 为上述 payload schema 生成 machine-readable current consumer fixtures 与统一 negative fixtures：
   - kind / payload mismatch
   - missing required ref
   - manifest resolve failure
   - unknown higher major
6. 在 `src/storage/files.ts` 与新增 `src/industry/platform/contracts/*` 中固定 industry artifact 目录与 ref 解析方式。
7. 在 `src/types.ts`、`src/cli.ts` 中预留 daily / weekly / replay / governance 的 industry 入口，但不提前写业务裁决。
8. 先把 internal/public artifact 分离路径定下来，避免后续打包层回写内部产物。
9. 对 `src/action/*`、`src/types.ts`、`src/cli.ts` 这类热点文件，只允许保留薄入口；业务实现必须下沉到 `src/industry/*`，避免形成新的 mega-file。
10. 在 Phase 1A 同步完成目录骨架 bootstrap，至少创建：
   - `src/industry/platform/{contracts,registry,normalization,audit,trend,output}/`
   - `src/industry/agents/{finance-agent,policy-agent,academic-agent,product-oss-agent,community-news-agent,registry-agent,normalization-agent,audit-agent,trend-agent}/`
   - `src/__tests__/industry/agents/{finance-agent,policy-agent,academic-agent,product-oss-agent,community-news-agent,registry-agent,normalization-agent,audit-agent,trend-agent}/`
   - `fixtures/industry/agents/{finance-agent,policy-agent,academic-agent,product-oss-agent,community-news-agent,registry-agent,normalization-agent,audit-agent,trend-agent}/`
   - `data/industry-seeds/agents/{finance-agent,policy-agent,academic-agent,product-oss-agent,community-news-agent,registry-agent,normalization-agent,audit-agent,trend-agent}/`
11. 这一步只允许建目录和占位索引，不允许提前把业务逻辑塞进 `src/action/*`、`src/types.ts` 或其他热点共享文件。
12. 目录骨架 bootstrap 未完成前，A/B/C 三组不得开始代码实现；否则最先发生冲突的是路径与归属，而不是业务逻辑。

### Phase 1B：共享治理契约基线

1. 在任何领域组开始实现 activation / stop / budget 前，先冻结并发布：
   - `field-ownership-policy.v1`
   - `fact-resolution-profile.v1`
   - `freshness-decay-profile.v1`
   - `agent-relevance-profile.v1`
   - `SourceAuthorityContextProfile`
   - `tool-selection-scorecard.v1`
   - `task-timeout-profile.v1`
   - `tool-call-timeout-profile.v1`
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
2. 冻结 run 级总预算、shared pool、publication reserve、same-run review availability、queue 并发、gap 稳定键和 headline capacity 的 machine-readable 消费方式。
3. 冻结 budget / activation / review / reopen / backlog / scheduling key 相关 reason codes、state transitions 和默认保守动作。
4. 只有在上述 profile 已进入 `schemas/industry/*` 真源并通过结构测试后，A/B/C 才允许实现各自领域的 activation / stop / budget 路径。

### Phase 1C：Dispatch / Budget Runtime Base

1. 由 `4号执行人` 先交付以下 canonical runtime artifacts 与聚合规则：
   - `SameRunDispatchContext`
   - `CapacityReservation`
   - `BudgetArbitrationRecord`
   - `run_budget_summary`
   - `HumanReviewQueueItem`
   - `OverrideAudit`
2. 先跑通以下统一 reject / gating 行为：
   - 缺 `dispatch_context_ref` 的 same-run 请求直接 rejected
   - 没有 `reservation_state="granted"` 的高成本动作不得启动
   - `manual_review_pool` 与 reviewer availability 分离，`async_only` 时按保守路径消费
3. A/B/C 只有在拿到 dispatch / reservation / budget current fixture 后，才允许把 same-run activation / stop / budget 逻辑接入各自 producer。
4. 所有会进入 same-run admission、shared pool 或 claim-level queue 的 payload，必须显式带：
   - `dispatch_context_ref`
   - `scheduling_key`
   - `claim_admission_assessment_ref`
   - `capacity_reservation_refs`

### Phase 1C+：Main Coordinator Boundary

1. `main coordinator` 只允许作为 middleware / scheduler role 存在，不新增第 `10` 个语义 Agent，不改写设计冻结的 `9` 个实际 Agent 与 `15` 个职责项。
2. `main coordinator` 的实现落点只允许在：
   - `src/industry/platform/contracts/*`
   - `src/industry/platform/registry/*`
3. `main coordinator` 只允许负责：
   - 发布 / 校验 `same-run-dispatch-context.v1`
   - queue admission / coalesce / shared pool 调度
   - reservation / budget / reviewer availability 的编排消费
   - run snapshot 与 canonical artifact 的调度串联
4. `main coordinator` 明确禁止：
   - 维护只存在于 coordinator 内存中的私有事实真源
   - 绕过 `schemas/industry/*`、artifact manifest 或 payload registry 补字段
   - 在 `src/action/weekly*`、`src/cli.ts`、`src/types.ts` 中沉淀第二套调度或判断语义
   - 直接写 `decision_tier`、`decision_confidence`、`coverage_audit_state` 或 owner arbitration 结果
5. Phase 6 必须补一条 structure test：校验 `main coordinator` 不产生第二套 schema / decision truth，且 `weekly*.ts` 只消费 canonical dispatch / reservation / artifact refs。

补充并行推进约束：

- Phase 1A / 1B / 1C 一旦完成，`4号执行人` 不得再以“等待 replay 草案 / owner-boundary 模板 / official-first 反例”为由阻塞 A/B/C 进入 event producer 开发；这些资产采用并行前推、后续接线的方式集成。
- 前推唯一 writer 固定为：
  - `1号执行人`：official-first failure / finance-policy anti-upgrade 模板
  - `2号执行人`：replay / eval 草案
  - `3号执行人`：owner-boundary / propagation 模板
  - `4号执行人`：schema materialization、governance notice、normalization feedback、最终集成与写盘
- `4号执行人` 后续只通过 `schema-governance-notice.v1`、`normalization-feedback.v1` 和 compatibility matrix 驱动 A/B/C 迭代，不再接管领域组的模板首稿或文档首稿。

### Phase 2：三组领域 Agent 并行落地

前置依赖：

- Phase 1A 完成
- Phase 1B 完成
- Phase 1C 完成
- canonical schema 已稳定

#### Phase 2A：学术前沿面

1. `2号执行人` 落地 `research_paper`、`conference_academic` 两轴的 event 生产。
2. 固定 `freshness_anchor_kind`、citation trace、source authority、accepted / rejected / counter 语义。
3. 输出 provisional owner、`cross_responsibility_attestation_refs` 输入位与学术类 anti-upgrade / boundary / replay fixture。
4. 输出 daily evidence 输入与学术类 tool coverage。

#### Phase 2B：产品生态面

1. `3号执行人` 落地 `product_vendor_release`、`developer_studio`、`project_open_source`、`community_discussion`、`news_pr_narrative` 的 event 生产。
2. 先保住 owner 语义，再进入 normalization；不得在 producer 阶段双计 accepted event。
3. 产出 `product-platform vs project-oss`、`community_discussion vs news-pr`、中文/海外社区抢 owner 负例 fixture 与 provisional owner / attestation 输入。
4. 输出 daily evidence 输入与产品/社区工具覆盖报告。

#### Phase 2C：政策与金融面

1. `1号执行人` 落地 `capital_finance`、`policy_regulatory`、`policy_research_thinktank` 三轴。
2. 必须实现：
   - official-first source class
   - `axis-activation-policy.v1`
   - `canonical-fetch-stop-policy.v1`
   - 高成本 / 授权受限来源的 `needs_review / unavailable / human_exception_required`
3. 产出 finance / policy 媒体转述不抢 owner、official-first failure、anti-upgrade 负例 fixture 与 provisional owner / attestation 输入。
4. 输出这三轴的 event、tool coverage、degradation reason、review trigger。

### Phase 3：Registry、工具覆盖与预算治理

1. `4号执行人` 落地 registry runtime snapshot 与 governance review plane 的分离。
2. 落地 `AxisToolCoverageReport`，并要求十轴一轴一条。
3. 让 `1/2/3号执行人` 的工具调用都通过 Phase 1B 已发布的统一 budget / reservation / reason-code 真源落账。
4. 建立 `manual_review_pool`、`audit_pass_pool`、`registry_review_pool` 等共享池语义，但不把它们混成日志统计。
5. 验证 `manual_review_pool` 不等于 reviewer availability；`async_only` 时必须走保守消费路径。

### Phase 4：归一、claim admission 与反证审计

#### Phase 4A：Producer Ownership / Attestation Input 验收

1. 先验收 A/B/C 三组已交付：
   - provisional owner 事件
   - `cross_responsibility_attestation_refs`
   - owner boundary negative fixtures
2. 未交 provisional owner / attestation 或 owner boundary 负例 fixture 的组，不允许进入 normalization 集成。

#### Phase 4B：Normalization Resolution

1. `4号执行人` 落地 `normalization-agent`：
   - source chain dedupe
   - fact resolution
   - owner arbitration / transfer
   - fact snapshot / partition close
2. 必须把以下 artifact 分开落账，而不是揉成一个大 normalization result：
   - `source_chain_dedupe_batch`
   - `FactResolutionAudit`
   - owner transfer artifact
   - `snapshot_id` / `fact_partition_id`

#### Phase 4C：Claim Builder / Audit Consumption Guard

1. 落地 `trend-agent` 的 `claim-builder pass`：
   - claim family fold
   - proposed claim archetype
   - claim evidence link batch
   - claim admission 申请
2. 落地 `audit-agent`：
   - `CounterEvidenceAudit`
   - `FactResolutionAudit`
   - blocking / downgrade / missing axes / unresolved groups
3. 补齐 closed snapshot consumption tests：
   - claim-builder 只能读取 closed snapshot
   - late owner transfer 不得静默改写当前 weekly
   - attestation merge 不得重复增加 accepted evidence 数量
4. 这里必须保住 [04-评分裁决与证据归一](../design-docs/行业级Agent趋势判断设计/04-评分裁决与证据归一.md) 的语义分离：
   - `decision_tier`
   - `decision_confidence`
   - `coverage_audit_state`

### Phase 5：tier decision 与 weekly 三层输出

1. `4号执行人` 落地 `tier-decider pass`，严格按 `claim_archetype` 与十轴裁决，并直接消费 `agent-relevance-profile.v1`、`claim-archetype-axis-applicability.v1`、`axis-status-threshold-profile.v1`、`claim-archetype-decision-profile.v1`、`independence-credit-profile.v1`；不允许压回一套统一“至少 3 轴”偷懒门槛。
2. 先 materialize `IndustryTrendDecision`，再写入 `IndustryClaimLedger[]`。
3. 从 ledger 派生 `IndustryTrendCard[]`，并以它们组装 internal canonical `WeeklyIndustryTrendSection`。
4. 生成 internal canonical `WeeklyIndustryTrendSection`，并固定：
   - `evidence_window_status`
   - `publication_readiness_status`
   - `governance_load_status`
   - `industry_window_status`
   - `run_snapshot`
   - `display_index`
   - `lineage_refs`
   - `run_budget_summary`
5. 从 internal section 派生：
   - `ConsumerWeeklyIndustryView`
   - `PublicWeeklyIndustryProjection`
6. 修改现有 weekly 输出接入点：
   - `src/action/weeklyEnhancement.ts`
   - `src/action/weeklyTrendAgent.ts`
   - `src/action/weeklyJudgmentRules.ts`
   - `src/action/weeklyReport.ts`
7. 修改 daily / verify / run-summary 接入：
   - `src/action/runSummary.ts`
   - `src/action/dailyVerification.ts`

### Phase 6：eval / replay / docs / structure 同步

1. 补齐 [08-验证追溯与完成定义](../design-docs/行业级Agent趋势判断设计/08-验证追溯与完成定义.md) 要求的验证资产：
   - gold claims
   - negative fixtures
   - replay windows
   - `TrendDecisionEvalCase`
   - `DecisionDiffAudit`
2. 按组汇总前置交付，而不是由 D 组临时补造：
   - A 组必须交：official-first failure、finance/policy anti-upgrade、媒体转述不抢 owner 反例
   - B 组必须交：academic positive canonical case、near-boundary case、academic replay windows
   - C 组必须交：owner boundary 反例、`news-pr` anti-upgrade、community noise 反例
   - D 组负责把上述资产组装为统一 `TrendDecisionEvalCase`、`DecisionDiffAudit` 与 cross-group replay
3. 同步更新：
   - `docs/specs/system-spec.md`
   - `docs/specs/services/signal-ingestion.md`
   - `docs/specs/services/normalization.md`
   - `docs/specs/services/scoring-engine.md`
   - `docs/specs/services/action-output.md`
   - `docs/specs/services/cli-runtime.md`
   - `docs/specs/feedback-loops/observability-contract.md`
   - `docs/specs/feedback-loops/failure-recovery-loop.md`
   - `docs/specs/constraints/structure-tests.md`
   - `README.md`
   - `data/README.md`
4. 补齐 structure tests，确保：
   - `schemas/industry/*` 真源存在且非占位
   - `payload_schema` 只使用冻结正式名，不出现 `event-batch.v1`、`tool-status-report.v1` 这类非正式短名
   - `src/industry/platform/*` 是唯一平台运行时根目录，不存在第二套 `src/industry/{contracts,registry,normalization,audit,trend,output}/*`
   - weekly/public/internal 边界不串
   - 十轴完整输出
   - 9 实际 Agent / 15 职责项都能交账
   - 领域组没有越界改写共享热点目录
   - 新增源码、测试、fixture builder 文件 `< 2000` 行，热点入口文件 `< 800` 行
5. 补齐跨组 contract tests，确保：
   - 领域组 producer fixture 能被中台组当前版本 consumer 直接消费
   - 同 major 的上一个兼容版本 fixture 仍可消费
   - 未知更高 major version 被正确拒绝
   - manifest resolve / payload kind mismatch / missing required refs 时报错一致

### Phase 7：总体验收

1. 运行 schema / type / unit / integration / replay / structure 全矩阵。
2. 运行关键 CLI dry-run，确认 weekly 只读合法 artifact，不读 raw provider input。
3. 做 diff audit，确认：
   - 不是把 coverage 缺口偷降成 tier
   - 不是把 finance / policy / news 单轴热度误升为 core
   - 不是把 public blockage 改写 internal 结论
4. 更新本计划的阶段状态、验证记录、残余风险与下一阶段入口。

## 验收标准

1. 运行态仍是 `9` 个实际 Agent、`15` 个职责项；四人分工只体现在实现 ownership。
2. 每条 claim 都完整输出十轴；缺轴显式 `missing / unavailable`，不得省略。
3. `capital_finance`、`policy_regulatory`、`policy_research_thinktank`、`news_pr_narrative` 不能单独把方向升级为 `core_industry_trend`。
4. `schemas/industry/*` 成为 machine-readable 单一真源；跨模块不得再手写第二份 schema / enum / reason/state。
5. 四组都有独立工作目录，领域代码、测试、fixture、seed 按组隔离，不再继续堆在共享目录里。
6. 任意行业相关源码、测试、fixture builder 文件都小于 `2000` 行，且热点入口文件保持薄封装。
7. daily 只生成轻索引 `DailyIndustryEvidencePack`，不把 accepted / rejected 全量 event 重新内嵌。
8. weekly 只读取最近 `7` 日 daily pack、rolling snapshot 和已标准化 external summary，不直接读取 provider raw input。
9. `DailyIndustryEvidencePack.v2`、`RollingEvidenceWindowSnapshot.v1`、`IndustryTrendDecision`、`IndustryTrendCard`、`IndustryClaimLedger`、`WeeklyIndustryTrendSection`、`ConsumerWeeklyIndustryView`、`PublicWeeklyIndustryProjection` 八层产物同时成立。
10. public consumer 只能读取 `PublicWeeklyIndustryProjection`，不得直接消费 internal weekly section。
11. internal/public blockage 与 `decision_tier`、`decision_confidence`、`coverage_audit_state` 语义分离。
12. `AxisToolCoverageReport` 十轴齐备，且高权威轴必须显式体现 official-first 与降级原因。
13. `TrendDecisionEvalCase`、`DecisionDiffAudit`、gold set、negative fixtures、replay windows 实际存在并能运行。
14. industry 层缺失或失败时，主 weekly 仍能回退到项目级输出，但必须显式写出“行业证据不足 / 降级”，不得静默伪装为正常行业判断。
15. `same-run-dispatch-context`、`CapacityReservation`、`BudgetArbitrationRecord` 与 `run_budget_summary` 可被独立验证，A/B/C 不得各写一套本地 same-run 口径。
16. owner arbitration、cross-responsibility attestation 与 fact snapshot 形成独立 artifact 和 replay 断言，晚到结果不得静默篡改当前 weekly。

## 验证矩阵

| 范围 | 验证内容 | 验证方式 | 通过标准 |
| --- | --- | --- | --- |
| `schemas/industry/*` | canonical schema、compatibility、reason/state registry 非占位且互相一致 | schema parse test + structure test | 无 placeholder、关键 schema family 齐全 |
| `src/industry/agents/academic-agent/*` | 学术轴 event、freshness、citation、authority | unit + integration fixture | 学术源不被通用搜索替代，预印本不误升 core |
| `src/industry/agents/product-oss-agent/*`、`src/industry/agents/community-news-agent/*` | 产品/社区/OSS/news 输入、owner 归属、传播链前置约束 | unit + pipeline fixture | 同一事实不双计 accepted，news 不抢 official/community owner |
| `src/industry/agents/finance-agent/*`、`src/industry/agents/policy-agent/*` | official-first、activation policy、stop policy、高成本降级 | unit + integration fixture | finance/policy 只靠搜索聚合时最高只能 weak / needs_review |
| `src/industry/platform/contracts/*`、`src/industry/platform/registry/*` | scorecard、budget、reservation、review availability、message key、queue policy | unit + run fixture | coverage/budget/review/concurrency 由 canonical ledger 与正式 schema 驱动 |
| `src/industry/platform/normalization/*` | source-chain、fact resolution、owner transfer、snapshot partition | unit + replay fixture | claim-builder 只消费已关闭 snapshot，晚到结果不静默回写 |
| `src/industry/platform/audit/*` | counter evidence、blocking、missing、unresolved group | unit + decision fixture | 反证能阻断或降 confidence，不能只做文案提醒 |
| `src/industry/platform/trend/*`、`src/industry/platform/output/*` | claim archetype、admission、tier decision、consumer readiness、headline capacity、projection | unit + eval fixture | 不同 archetype 不共用一套偷懒门槛，public projection 不回写 internal |
| `src/action/weekly*`、`src/action/runSummary.ts`、`src/action/dailyVerification.ts` | weekly 三层输出、回退、public/internal 分离、window status | integration + snapshot | public projection 独立，industry failure 有显式降级 |
| `src/__tests__/industryReplay*`、`industryEval*` | gold / negative / replay / diff audit | replay + eval command | 指标达到设计冻结地板，且能解释回归 |
| 跨组 contract fixtures | message envelope、manifest、payload schema、compatibility matrix、current/previous consumer 兼容 | contract + replay fixture | 领域组产物无需口头补字段即可被中台组消费；unknown higher major 正确拒绝 |
| 全仓 | `pnpm typecheck`、`pnpm test`、结构测试、preflight | CLI / CI | 全部通过 |

建议新增测试：

- `src/__tests__/industrySchemaContract.test.ts`
- `src/__tests__/industryDomainAgents.test.ts`
- `src/__tests__/industryToolCoverage.test.ts`
- `src/__tests__/industryNormalization.test.ts`
- `src/__tests__/industryClaimDecision.test.ts`
- `src/__tests__/industryWeeklyProjection.test.ts`
- `src/__tests__/industryReplay.test.ts`
- `src/__tests__/industryStructure.test.ts`
- `src/__tests__/industry/agents/finance-agent/*.test.ts`
- `src/__tests__/industry/agents/policy-agent/*.test.ts`
- `src/__tests__/industry/agents/academic-agent/*.test.ts`
- `src/__tests__/industry/agents/product-oss-agent/*.test.ts`
- `src/__tests__/industry/agents/community-news-agent/*.test.ts`

## 回滚策略

1. 若领域 Agent 输入面不稳定，先回滚到只保留 daily industry evidence pack 与 `unavailable / partial` 状态，不让脏输入进入 claim decision。
2. 若 normalization / audit / tier decision 有语义回归，先保留 canonical event 与 daily pack，停止生成 weekly industry section。
3. 若 public projection 有安全或契约问题，立刻停用 `PublicWeeklyIndustryProjection` 输出，只保留 internal artifacts 与 blocked public 状态。
4. 任意回滚都不得：
   - 把 raw provider input 暴露给 weekly
   - 把 finance / policy / news 单轴热度改写成核心趋势
   - 复用 internal artifact 直接冒充 public artifact

## 当前残余风险

1. 上游设计尚未正式批准；这是当前最大门禁。
2. 设计跨度很大，如果不先锁住 `schemas/industry/*` 和 artifact-first 边界，四组实现会很容易各自发明 payload。
3. `1号执行人` 负责的政策/金融组有最高 official-first 和授权/成本复杂度，若 activation / stop policy 未先落地，后续最容易出现“先查了再说”的预算失控。
4. `4号执行人` 汇聚了 registry、normalization、audit、trend、weekly 打包，若不把 Phase 1 与 Phase 3 先做成稳定真源，中后期会成为串行瓶颈。

## 下一阶段入口

先做 ExecPlan Review。若评审认为上游设计仍未达到可实施状态，本计划继续保持 `Draft` 并仅修订门禁与边界；若上游设计批准，则从 `Phase 0` 开始执行，并在每个 Phase 结束后更新状态、验证记录和残余风险。

## 验证记录

| 日期 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 2026-06-23 | 未运行 | `Not Started` | 本轮仅生成 ExecPlan 初稿，未开始实现 |
| 2026-06-23 | `mkdir -p src/industry/* src/__tests__/industry/* fixtures/industry/* data/industry-seeds/*` | `Completed` | 已创建四组并行工作目录骨架，并补 `.gitkeep` 保留空目录 |
| 2026-06-23 | 手工修订总控与四份子计划 | `Completed` | 已补齐缺失 profile owner/phase/path、daily handoff 数组合同、bootstrap 单写者边界与 weekly canonical artifact 落点 |
