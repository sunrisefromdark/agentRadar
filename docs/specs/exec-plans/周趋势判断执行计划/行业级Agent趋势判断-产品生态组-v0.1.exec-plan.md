# 执行计划：行业级Agent趋势判断-产品生态组 v0.1

## 文档状态

- 版本：`v0.1`
- 当前状态：`Draft`
- 上游总控：
  - `docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-v0.1.exec-plan.md`
- 对应设计：
  - `docs/specs/design-docs/行业级Agent趋势判断设计/02-证据轴与相关性门控.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/03-数据模型契约.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/05-多Agent协作与中间件.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/06-工具保障与SeedRegistry.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/08-验证追溯与完成定义.md`
  - `docs/specs/design-docs/行业级Agent趋势判断设计/09-术语与审计词汇表.md`
- 负责人：`3号执行人`

## 当前进度

| Phase | 状态 | 已落地项 | 说明 |
| --- | --- | --- | --- |
| Phase 1：职责边界固定 | `DONE` | product-platform / developer-studio / project-oss / community_discussion / news-pr owner 初判与负例 | 已在本组目录内落地 owner boundary policy 与 fixture |
| Phase 2：event 生产草稿 | `DONE` | 五类输入面的 canonical-like event batch draft | accepted / counter / diagnostic / rejected 分离 batch refs |
| Phase 3：tool coverage 与降级草稿 | `DONE` | 五条 axis coverage draft | daily 输入中 `coverage_refs=5` 有 contract test |
| Phase 4：contribution 与测试 | `DONE` | 六职责项 contribution draft 与 unit / contract / negative / replay 测试 | `cn-community` 与 `global-community` contribution 分账 |
| Phase 4A：daily handoff 草稿 | `DONE` | `daily-industry-evidence-pack-input.v1` 轻索引草稿 | 只包含 refs / lineage，不内嵌全量 event |
| Phase 4B：正式跨组 handoff 输入准备 | `READY_FOR_PLATFORM_DRY_RUN` | 本组 formal envelope / payload / manifest / refs 已收口，contract self-check fixture 已补齐 | 本组 producer-side 输入准备已完成；中台 contract dry-run / normalization dry-run 尚未完成，等待 `4号执行人` 接入 |

## 阶段更新（2026-06-27）

当前做到：产品生态组实际执行到本组 producer-side formal handoff 输入准备完成，状态为 `READY_FOR_PLATFORM_DRY_RUN`。本组现在可以从第一轮 draft seam 生成正式 `ProductEcosystemFormalHandoffBundle`，包含 `IndustryAgentMessageEnvelope`、formal payload、`IndustryAgentArtifactManifest` 与 `industry://` artifact refs；并已补上 message / payload / manifest / ref 的绑定校验。这不表示中台 contract dry-run、normalization dry-run、Phase 1B / 1C 后接线或 weekly 集成已经完成。

交付口径：这与其他领域组“可独立交付部分先完成，等待 `4号执行人` 接平台消费层后继续跨组收口”的形式一致。本组已完成的是产品生态 producer / fixture / manifest / handoff 输入准备；下一步由中台接收 bundle 并产出 dry-run / normalization 反馈后，产品生态组再按反馈修正本组 payload / lineage / refs。

已完成：

1. Phase 1 - Phase 4A：职责边界、五类 event draft、5 条 coverage draft、6 条 contribution draft、daily 轻索引草稿均已完成。
2. Phase 4B producer-side 输入准备：`src/industry/agents/community-news-agent/formalHandoff.ts` 已能生成正式 handoff bundle，并保持 `coverage_refs=5`、`contribution_refs=6`。
3. Phase 4B formal handoff 自检 fixtures：已覆盖 current、previous compatible same-major、unknown higher major、missing required ref，以及 missing payload 负例。
4. 审核修复：formal validator 已要求每条 message 必须有对应 payload / manifest，payload schema 必须匹配 envelope，payload `source_message_id` 必须回指 message。

未完成 / 继续阻塞：

1. 中台 contract dry-run / normalization dry-run 尚未完成。原因：需要 `4号执行人` 在中台运行时接收本组 formal bundle，并接入统一 consumer runner、normalization dry-run 与反馈产物。
2. activation / budget / review / same-run 深补证尚未接入。原因：本轮只完成 producer-side formal handoff 输入准备，后续需要等待 `4号执行人` 发布 Phase 1B / 1C 的 dispatch、budget、review、same-run 运行时基座与 current fixtures。
3. weekly 总集成尚未完成。原因：需要三组正式 handoff 全量齐备，并由中台组 materialize `DailyIndustryEvidencePack.v2` 与 weekly internal / consumer / public 三层闭环。

继续推进所需产出：

1. `4号执行人`：接收产品生态 formal bundle，提供 contract dry-run / normalization dry-run 结果与失败反馈格式。
2. `4号执行人`：发布 Phase 1B / 1C 的 activation、budget、review、same-run consumer fixtures 与 runtime 接线约束。
3. 产品生态组：收到中台 dry-run 反馈后，只在本组目录内修正 payload / lineage / refs；收到 Phase 1B / 1C 后再接后续深补证能力。

## 落地标记（截至 2026-06-27）

| 项目 | 当前判断 | 依据 |
| --- | --- | --- |
| source catalog | `DONE` | 已新增产品、开发者、OSS、社区、新闻五类 source catalog 与 seed |
| owner-boundary / propagation / anti-upgrade fixture | `DONE` | 已新增 product/community/news 的边界、传播链与 anti-upgrade 样本 |
| producer event builder | `DONE` | 已新增 product / developer / OSS / community / news event builder 草稿 |
| coverage / contribution writer | `DONE` | 本组 coverage 固定 5 条，contribution 固定 6 条 |
| local adapter seam / daily input | `DONE` | `buildProductEcosystemHandoff` 可生成本组 daily 输入草稿 |
| formal handoff 输入准备 | `READY_FOR_PLATFORM_DRY_RUN` | `buildProductEcosystemFormalHandoff` 可生成正式 envelope / payload / manifest / refs；等待中台 dry-run 后才能提升为消费侧完成 |
| 中台 dry-run 接入 | `BLOCKED` | 等 `4号执行人` 接入统一 consumer runner / normalization dry-run 并回传反馈 |

## 目标

把产品、开源、开发者、社区、新闻五类输入面做成可记账、可去重、可降级的 canonical event 来源，并且在 producer 阶段先保住 owner 边界，不把媒体回声写成多条 accepted evidence。

## 负责范围

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

负责交付：

1. 五类职责项的 canonical event 生产。
2. 中文/海外社区、社区/新闻、产品/OSS 的 owner 边界前置约束。
3. 五类 tool coverage 与 contribution。
4. owner-boundary / propagation 模板首稿，供 `1/2/4号执行人` 复用。

## 单写者边界

### 允许修改

- `src/industry/agents/product-oss-agent/*`
- `src/industry/agents/community-news-agent/*`
- `src/__tests__/industry/agents/product-oss-agent/*`
- `src/__tests__/industry/agents/community-news-agent/*`
- `fixtures/industry/agents/product-oss-agent/*`
- `fixtures/industry/agents/community-news-agent/*`
- `data/industry-seeds/agents/product-oss-agent/*`
- `data/industry-seeds/agents/community-news-agent/*`
- 本组目录下的 docs-note / handoff-note / fixture note

### 禁止修改

- 不得直接修改 `schemas/industry/*`
- 不得直接修改 weekly tier 与 public projection
- 不得把 `news-pr` 和 `community_discussion` 写成同一个 accepted 事实的双 owner
- 不得把 vendor blog 提到 repo 更新就自动记到 `product-platform`
- 不得直接修改 `docs/specs/services/*`、`docs/specs/constraints/*`、`docs/specs/feedback-loops/*`、`README.md`、`data/README.md`

## 工作目录与文件落点

本组独立工作目录固定为：

- `src/industry/agents/product-oss-agent/*`
- `src/industry/agents/community-news-agent/*`
- `src/__tests__/industry/agents/product-oss-agent/*`
- `src/__tests__/industry/agents/community-news-agent/*`
- `fixtures/industry/agents/product-oss-agent/*`
- `fixtures/industry/agents/community-news-agent/*`
- `data/industry-seeds/agents/product-oss-agent/*`
- `data/industry-seeds/agents/community-news-agent/*`

目录内建议按职责边界先拆，再按流水线拆：

- `src/industry/agents/product-oss-agent/productPlatformSourceCatalog.ts`
- `src/industry/agents/product-oss-agent/productPlatformEventBuilder.ts`
- `src/industry/agents/product-oss-agent/developerStudioSourceCatalog.ts`
- `src/industry/agents/product-oss-agent/developerStudioEventBuilder.ts`
- `src/industry/agents/product-oss-agent/projectOssSourceCatalog.ts`
- `src/industry/agents/product-oss-agent/projectOssEventBuilder.ts`
- `src/industry/agents/product-oss-agent/coverageReport.ts`
- `src/industry/agents/product-oss-agent/contributionLedger.ts`
- `src/industry/agents/community-news-agent/communitySourceCatalog.ts`
- `src/industry/agents/community-news-agent/newsNarrativeSourceCatalog.ts`
- `src/industry/agents/community-news-agent/ownerBoundaryPolicy.ts`
- `src/industry/agents/community-news-agent/eventBuilder.ts`
- `src/industry/agents/community-news-agent/handoff.ts`
- `src/__tests__/industry/agents/product-oss-agent/{contract,unit,negative,replay}*.test.ts`
- `src/__tests__/industry/agents/community-news-agent/{contract,unit,negative,replay}*.test.ts`

落点约束：

- `product-platform`、`developer-studio`、`project-oss` 逻辑只放 `src/industry/agents/product-oss-agent/*`。
- `community_discussion`、`news_pr_narrative` 逻辑只放 `src/industry/agents/community-news-agent/*`。
- 中文 / 海外社区可共用 `community_discussion` 轴实现，但 contribution 与 fixture 必须保留 `cn-community`、`global-community` 两条职责口径。
- owner boundary、传播链、anti-upgrade fixture 分别放进 `fixtures/industry/agents/product-oss-agent/{owner-boundary,propagation,anti-upgrade}/` 与 `fixtures/industry/agents/community-news-agent/{owner-boundary,propagation,anti-upgrade}/` 子目录，防止后续 replay 资产无法维护。
- 现有 `src/signal/*` 等旧目录只允许只读复用；如需改写或抽共享 runtime，必须先提 `shared-runtime-note`，由中台组上收进 `src/industry/platform/*`。

### 运行方式

- 本组优先使用独立 worktree / workspace root；若无法隔离，至少保证只写本组目录与本组 fixture / seed / test。
- `owner-boundary / propagation / anti-upgrade` 模板由本组唯一维护，其他组只能引用，不得复制后改成自己的第二份模板。
- 若需要修改跨组 specs / README，只能提交 `docs-change-note` 给中台组统一写入；本组不得直接改跨组文档真源。
- `product-platform / developer-studio / project-oss / community / news` 五类 source catalog 与 event builder 只允许在本组目录内闭合，不得写进 `src/action/*`。

文件规模约束：

- 任意文件必须 `< 2000` 行。
- 任一文件超过 `1200` 行时，优先按 `product-platform / developer-studio / project-oss / community / news` 拆开，而不是继续塞分支。
- 测试文件超过 `800` 行时，拆成 contract、unit、negative、replay 多个文件。

## 依赖输入

最小开工只需要拿到：

1. 已批准设计文档中的 product / oss / community / news 语义冻结结论与总控职责映射表。
2. 学术组、政策金融组无需先完成；本组可独立产出自己的 preparatory artifacts 与 event batch 草稿。
3. 单写者边界、本组目录模板与 `daily-industry-evidence-pack-input.v1` 最小数组合同。

其中：

- `Day-0/Day-1` 零等待开工不要求先拿到中台已 materialize 的 event / contribution 契约；本组可先启动 source、owner-boundary / propagation / anti-upgrade 样本、coverage / contribution writer 草稿与 local adapter seam。
- 进入跨组 handoff 冻结、claim-critical payload 编码与 same-run 接线前，仍必须回到中台组发布的 canonical schema、payload 正式名与 compatibility matrix。

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
- 已发布的 dispatch / budget runtime 基座与 payload registry current fixtures。

执行约束：

- 若共享治理、dispatch 基座或 current fixtures 尚未发布，本组仍需继续推进五类输入面的 source/event、owner boundary 负例、coverage / contribution writer 与 handoff producer。
- 未接入 shared governance 前，可以先用 schema 对齐的本组 stub fixture 跑领域测试，但不得本地扩展正式 `payload_schema`、reason code、state 或 weekly 语义。
- 若 `shared-runtime-note` 尚未被中台上收，本组允许先在 product/community/news 目录内保留只服务本组的临时 wrapper / adapter seam；但不得把它暴露成别组依赖的共享运行时。

## 给实现人的白话派工

### 你先做什么

- 先把 `product-oss-agent`、`community-news-agent` 目录骨架搭好。
- 先把 product / oss / developer / community / news 的 source catalog 写出来。
- 先把 owner-boundary / propagation / anti-upgrade 样本补齐。
- 先把 coverage / contribution writer 草稿、local adapter seam 和 contract / unit / replay 测试骨架跑起来。

### 第一阶段做到哪一步就可以先交

- 只要你已经能稳定产出五类 event batch 草稿、coverage / contribution 草稿，并且 owner-boundary / propagation 反例能跑，就可以先把 preparatory artifact refs 交给 `4号执行人` 做早期 contract review。
- 这一步不要求你已经把 shared runtime 上收，也不要求政策金融组或学术组先完成。

### 你只在这些时点必须等待

- 只有在你要做正式跨组 handoff 时，才需要等待 `4号执行人` 的 `Phase 1A`。
- 只有在你要把 coverage / contribution 正式 payload 交给中台消费时，才需要等 canonical schema、payload 正式名和 compatibility matrix。
- 只有在你要接 same-run 的深补证路径时，才需要等 dispatch / budget runtime 基座。

### 等到什么产物出来再继续

- 等到 `4号执行人` 发出 canonical schema、payload 正式名、artifact path、compatibility matrix。
- 等到 current consumer fixtures 可用后，再把本地 seam 收口成正式 handoff。

### 不要等什么

- 不要等学术组先交 replay 结果。
- 不要等政策金融组先交 owner 争议样本。
- 不要等 shared runtime 先抽完；先在本组目录里把逻辑做出来。

### 本组从开工到完工的顺序

1. 先在本组目录里把五类 source catalog、owner-boundary / propagation / anti-upgrade 样本、coverage / contribution 草稿、local seam、测试骨架做起来。
2. 等 `4号执行人` 发出 `Phase 1A` 的 canonical schema、payload 正式名、artifact path、compatibility matrix 后，把本地 seam 收口成正式 handoff。
3. 先把本组正式 envelope / payload / manifest / refs 交给 `4号执行人`；如果本组先准备好，就先进入 contract test 和 normalization dry-run，不等另外两组。
4. 等 `4号执行人` 发布 `Phase 1B / 1C` 后，再把 activation / budget / same-run 深补证这类后接线能力接上。
5. 最后等三组都完成正式 handoff 后，再一起进入最终 weekly 集成和总验收。

## 输出与 handoff

必须交给中台组的产物：

1. `industry-signal-event-batch.v1` envelope + payload + manifest：
   - `product_vendor_release` event batch refs
   - `developer_studio` event batch refs
   - `project_open_source` event batch refs
   - `community_discussion` event batch refs
   - `news_pr_narrative` event batch refs
2. 五条 `axis-tool-coverage-report.v1` envelope + payload + manifest：
   - `product_vendor_release`
   - `developer_studio`
   - `project_open_source`
   - `community_discussion`
   - `news_pr_narrative`
3. 六条 `industry-agent-contribution.v1` envelope + payload + manifest：
   - `product-platform`
   - `developer-studio`
   - `project-oss`
   - `cn-community`
   - `global-community`
   - `news-pr`
4. `daily-industry-evidence-pack-input.v1` envelope + payload + manifest
5. 传播链 / context / counter / rejected artifact refs
6. 若命中 same-run admission / budget / review，必须附 `dispatch_context_ref`、`scheduling_key` 与相关 refs
7. `cross_responsibility_attestation_refs?`、owner boundary negative fixture refs、`news-pr` anti-upgrade fixture refs

职责项映射冻结：

- 本组有 `6` 个 `responsibility_id`，但只覆盖 `5` 条主要 `axis_id`
- `community_discussion` 轴由 `cn-community` 与 `global-community` 两个职责项分别交账
- `event batch` 可以按 `5` 条轴输出
- `AxisToolCoverageReport` 必须按 `5` 条轴输出
- `IndustryAgentContribution` 必须按 `6` 个职责项输出

handoff 要求：

- 不得再使用“五条或六条 coverage”这类模糊口径；本组 coverage 固定为 `5` 条，contribution 固定为 `6` 条
- 不得只交 event batch ref；必须交完整 `IndustryAgentMessageEnvelope`、`payload_ref`、`IndustryAgentArtifactManifest`
- `execution_context.primary_responsibility_id` 必须与 event 的 `responsibility_id` 一致；`execution_context.operational_executor_id` 必须如实记录这次实际执行的 Agent
- 若发生 delegated execution / takeover / backfill，必须显式带 `takeover_mode` 与 `takeover_audit_ref`；否则宁可记 `context / unavailable / needs_review`，不得伪装为本组正常已覆盖
- daily 输入只能交 ref 与 lineage，不得内嵌 accepted / rejected 全量 event
- 本组只负责提交 `daily-industry-evidence-pack-input.v1`；`DailyIndustryEvidencePack.v2` 只能由中台组 materialize 和写盘
- `daily-industry-evidence-pack-input.v1` 必须使用数组字段；本组冻结为 `coverage_refs=5`、`contribution_refs=6`，且 `normalized_event_batch_refs` 必须覆盖五条主要 `axis_id`
- 对被学术、政策或金融组视为更高一手度的事实，本组只能交 provisional owner / attestation / context，不得坚持保留双 owner accepted event

## 实施阶段

### Phase 1：职责边界固定

1. 以总控已冻结的目录模板为前提，只在本组既定工作根目录内新增文件；若根目录缺失，本组可按模板自行创建本组目录，但不得改路径命名或越界创建共享目录。
2. 固定 `product-platform` vs `project-oss`：
   - 官方产品发布、API docs、release notes、客户案例归 `product-platform`
   - repo release、包版本、模型卡、依赖采纳、维护动作归 `project-oss`
3. 固定 `community_discussion` vs `news-pr`：
   - 原帖、issue、forum、复现、用户实践归社区
   - 媒体报道、PR 稿、传播链归新闻
4. 固定中文 / 海外社区只影响 `language` / `region` / `source_type`，不天然加权。
5. 固定本组口径：
   - `5` 条轴 coverage
   - `6` 条职责项 contribution
   - accepted event direct owner 唯一，不能双 owner
6. 若发现需要直接改 `src/signal/*` 或其他共享旧模块，立即停止并提交 `shared-runtime-note`；本组不得自行越界改共享热点。
7. 命中 same-run 的 producer payload 一旦接线，必须消费中台组发布的 `dispatch_context_ref`、`claim_admission_assessment_ref`、reservation refs、`scheduling_key` 与 `gap_scope` 语义。
8. 高成本扩张必须遵守固定顺序：`claim family fold -> claim admission -> claim budget -> shared capacity -> axis expansion`；不得因为叙事热度或社区噪声高就跳过前序仲裁直接抢 same-run 配额。

### Phase 2：event 生产

1. 为产品、开发者、开源、社区、新闻五类输入面产出 canonical event。
2. producer 阶段只做 owner 初判，不做最终 owner arbitration。
3. 当媒体只是转述官方发布或社区原帖时：
   - direct fact owner 留给原始事实侧
   - 新闻只作为 context / relation / supporting trace
4. accepted / counter / diagnostic / rejected 事件必须进入分离 batch refs，不能在一个批次里混语义。
5. 若发现跨职责高价值事实，必须产出 `cross_responsibility_attestation_refs` 输入位，而不是等中台组靠文本猜 owner。
6. 只有命中 `tier_blocking`、`public_output_only` 或 headline 主语义争议的跨职责事实，才要求 same-run critical attestation；其余传播链 / owner 边界争议允许先进入 provisional / post-weekly 治理。

### Phase 3：tool coverage 与降级

1. 五类输入面都要有 coverage 报告。
2. `news_pr_narrative` 永远不能单独推动核心趋势升级。
3. 社区高噪声源、搬运号、SEO 内容默认 rejected / watch / context。
4. tool coverage 核心 writer 可先落地；进入 review / budget / reason code 接线时，必须消费共享治理 profile 与受控字典；不得本地重写阈值。
5. 没有 `reservation_state=\"granted\"` 的 same-run 请求不得启动高成本拉取或 deep check。

### Phase 4：contribution 与测试

1. 每个职责项单独出 `IndustryAgentContribution`。
2. 补 owner 边界、传播链、双计数防回归测试。
3. `community_discussion` 轴可以汇总来自 `cn-community` 与 `global-community` 的 accepted event，但 contribution 必须保留两条职责项记录，不能合并。
4. 必须准备本组 anti-upgrade / owner 负例：
   - `news-pr` 强但不能升 core
   - vendor blog 提到 repo 变更时 owner 仍可归 `project-oss`
   - 社区原帖被媒体转述时 owner 仍归 community

### Phase 4A：daily handoff 冻结

1. 产出本组的 `daily-industry-evidence-pack-input.v1`。
2. payload 至少能解析：
   - `normalized_event_batch_refs`
   - `rejected_event_batch_refs`
   - `source_message_ids`
   - `coverage_refs`
   - `contribution_refs`
3. cardinality 冻结为：
   - `coverage_refs` 恰好 `5`
   - `contribution_refs` 恰好 `6`
   - `normalized_event_batch_refs` 至少覆盖 `product_vendor_release`、`developer_studio`、`project_open_source`、`community_discussion`、`news_pr_narrative`
4. 不得把全量 event 内嵌进 daily 输入包。

### Phase 4B：跨组 contract fixtures

1. 产出 current schema version consumer fixture。
2. 产出 previous compatible same-major consumer fixture。
3. 产出 missing required ref negative fixture。
4. 产出 unknown higher major negative fixture。
5. 产出 owner boundary / anti-upgrade fixture refs，供中台组统一接入 eval/replay。
6. 若中台 current consumer fixture 尚未发布，本组先提交 producer fixture 与 artifact refs；待中台 fixture 发布后补兼容消费验证，不回退五轴 / 六职责口径。

## 验收标准

1. 六个职责项都能独立交账。
2. 同一事实不会被 `product-platform` / `project-oss` 或 `community_discussion` / `news-pr` 双计 accepted。
3. 中文/海外社区有来源和语言标注，但不产生天然权重偏置。
4. `news_pr_narrative` 最多做 narrative / early signal / context，不写成核心主支柱。
5. handoff 产物可被中台组直接做 source-chain / fact normalization。
6. 本组 coverage 固定 `5` 条、contribution 固定 `6` 条，口径不再模糊。
7. daily handoff 保持轻索引，不内嵌胖 event 快照。
8. `news-pr` anti-upgrade 与 owner boundary 反例可直接进入统一 eval/replay。
9. 本组全部源码、测试、fixture builder 文件都小于 `2000` 行，且 product / community / news 没有堆进单文件实现。

## 验证矩阵

| 范围 | 验证内容 | 方式 | 通过标准 |
| --- | --- | --- | --- |
| product vs oss | owner 初判 | unit test | vendor 发布与 repo 动作不混写 |
| community vs news | 原帖与媒体转述边界 | unit test | 转述链不双计 accepted |
| language/region | 中文/海外标注 | fixture test | 标注存在但不直接影响 acceptance |
| contribution | 六职责项交账 | schema test | 一职责项一记录 |
| daily handoff | daily 输入是轻索引 | schema + fixture test | 只交 ref / lineage，不内嵌全量 event |
| cross-group contract | envelope / manifest / payload / compatibility | contract fixture | 中台组无需口头补字段即可消费 |
| owner boundary | 社区/新闻、产品/OSS 边界 | negative fixture | 同一事实不双计 accepted |
| anti-upgrade | `news-pr` 单轴热度 | eval fixture | 不误升 core |

## 回滚策略

1. 若某类来源噪声过高，先降为 context / rejected，不进 accepted supporting。
2. 若 owner 边界不稳定，宁可少记 accepted，也不要双计 accepted。

## 验证记录

| 日期 | 命令 | 结果 | 备注 |
| --- | --- | --- | --- |
| 2026-06-23 | 未运行 | `Not Started` | 本轮仅生成子计划 |
| 2026-06-23 | 手工修订子计划 | `Completed` | 已对齐 `agent-relevance-profile.v1` 依赖、目录骨架前置条件与 daily handoff 数组合同 |
| 2026-06-26 | `corepack pnpm exec vitest run src/__tests__/industry/agents/product-oss-agent src/__tests__/industry/agents/community-news-agent` | `Passed` | 8 个测试文件、10 条测试通过；覆盖产品/OSS、社区/新闻 owner 边界、news-pr anti-upgrade、5 coverage / 6 contribution 与 daily 轻索引 |
| 2026-06-26 | `corepack pnpm run typecheck` | `Passed` | TypeScript 全仓类型检查通过 |
| 2026-06-26 | `corepack pnpm run code-implementation:preflight -- --exec-plan "docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-产品生态组-v0.1.exec-plan.md"` | `Passed` | 产品生态组 implementation preflight 校验通过 |
| 2026-06-27 | `corepack pnpm exec vitest run src/__tests__/industry/agents/product-oss-agent src/__tests__/industry/agents/community-news-agent` | `Passed` | 8 个测试文件、15 条测试通过；新增 formal handoff 输入准备、current / previous compatible / unknown higher major / missing ref / missing payload contract 验证 |
| 2026-06-27 | `corepack pnpm run typecheck` | `Passed` | TypeScript 全仓类型检查通过 |
| 2026-06-27 | `corepack pnpm run code-implementation:preflight -- --exec-plan "docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-产品生态组-v0.1.exec-plan.md"` | `Passed` | 产品生态组 implementation preflight 校验通过 |
| 2026-06-27 | `corepack pnpm run code-implementation:preflight -- --write --exec-plan "docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-产品生态组-v0.1.exec-plan.md"` | `Passed` | 已将当前状态修正为 `READY_FOR_PLATFORM_DRY_RUN`，并刷新 implementation preflight receipt |
| 2026-06-27 | `corepack pnpm run code-implementation:preflight -- --exec-plan "docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-产品生态组-v0.1.exec-plan.md"` | `Passed` | 状态口径修正后 preflight receipt 校验通过 |
| 2026-06-27 | `corepack pnpm run code-implementation:preflight -- --write --exec-plan "docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-产品生态组-v0.1.exec-plan.md"` | `Passed` | 补充同类领域组“可独立交付部分完成，等待中台消费层”口径，并刷新 implementation preflight receipt |
| 2026-06-27 | `corepack pnpm run code-implementation:preflight -- --exec-plan "docs/specs/exec-plans/周趋势判断执行计划/行业级Agent趋势判断-产品生态组-v0.1.exec-plan.md"` | `Passed` | 同类交付口径补充后 preflight receipt 校验通过 |

## 下一阶段入口

1. `DONE`：已消费 `4号执行人` Phase 1A 的 canonical schema、payload 正式名、artifact path 与 compatibility matrix，并将本地 seam 刷新为正式 envelope / payload / manifest handoff 输入。
2. `DONE`：已补 current / previous compatible / unknown higher major / missing required ref / missing payload 的本组 formal handoff 自检验证。
3. `NEXT`：把产品生态 formal bundle 交给 `4号执行人` 做中台 contract dry-run 与 normalization dry-run；收到失败反馈后，本组只在 product / community / news 目录内修正。
4. `BLOCKED`：activation / budget / review / same-run 深补证能力等待 `4号执行人` 发布 Phase 1B / 1C runtime、consumer fixtures 与接线约束后再做。
5. `BLOCKED`：最终 weekly 集成等待三组正式 handoff 齐备，并由中台组 materialize `DailyIndustryEvidencePack.v2` 与 weekly 三层闭环。
