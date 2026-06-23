# 行业级 Agent 趋势判断：多 Agent 协作与中间件

> 本文档拆自 [行业级Agent趋势判断设计文档.md](../行业级Agent趋势判断设计文档.md)，是行业级 Agent 趋势判断设计文档包的一部分。

## 多 Agent 分工

当前设计冻结 9 个实际 Agent 与 15 个职责项。实际 Agent 是真正干活的执行者；职责项是 weekly 必须分别交账的覆盖项。一个实际 Agent 可以负责多个职责项，但每个职责项必须有且只有一个实际 Agent 负责，并在 weekly 中单独输出状态、证据计数、失败原因和来源引用。

实际 Agent 冻结如下：

| actual_agent_id | 负责职责项 | 独立要求 |
| --- | --- | --- |
| `academic-agent` | `research-frontier`、`conference-academic` | 独立输出学术证据包；可以共用 academic 工具链，但不得由 Trend Agent 临时补查 |
| `product-oss-agent` | `product-platform`、`developer-studio`、`project-oss` | 独立输出产品/开发者/开源生态证据包 |
| `community-news-agent` | `cn-community`、`global-community`、`news-pr` | 独立输出社区与新闻宣传证据包；新闻宣传不得推动核心趋势升级 |
| `finance-agent` | `capital-finance` | 必须是独立且高复杂度 Agent，不得由 Trend Agent 或 Community & News Agent 兼任 |
| `policy-agent` | `policy-regulatory`、`policy-research-thinktank` | 必须是独立且高复杂度 Agent，不得与新闻宣传或 Trend Agent 合并解释 |
| `registry-agent` | `registry-governance` | 必须独立维护工具 registry、来源 registry、授权/成本状态和替代关系 |
| `normalization-agent` | `evidence-normalization` | 必须独立完成实体对齐、去重、来源类别标注、语言标注和证据轴归档 |
| `audit-agent` | `counter-evidence-audit` | 必须独立于 Trend Agent，专门发现反证、缺口、来源偏置和过度解读 |
| `trend-agent` | `trend-synthesis` | 必须在语义上拆成 `claim-builder pass` 与 `tier-decider pass`：前者只消费已归一证据生成候选与 evidence links，后者只消费已完成审计/registry review 的候选做最终裁决；不得直接采集原始来源 |

### `trend-agent` 双段消费边界

为避免后续多人实现时把 `trend-agent` 理解成“一律只能读已审计结果”或“任何阶段都能直接读原始证据”，当前设计补充冻结 `trend-agent` 的双段消费边界：

- `claim-builder pass` 只允许消费已关闭 `snapshot_id` 的归一结果、`registry_snapshot_ref`、相关 relevance / freshness / authority 输入和既有 canonical artifact，负责生成 `claim_candidate_batch`、`claim_evidence_link_batch` 与 fold audit。
- `claim-builder pass` 不得直接写 `decision_tier`、`decision_confidence`、`coverage_audit_state`、headline/public 分桶，也不得绕过 `normalization-agent` 直接读取原始 provider 输出。
- `tier-decider pass` 只允许在收到 `audit-result.v1`、所需 `registry-review-result.v1`、`DecisionContextArtifact` 和 admission / reservation 相关 canonical 输入后写入最终 decision 字段。
- `tier-decider pass` 不得以“自己理解足够”绕过 audit / registry review，也不得回头直接消费未归一事件流、临时 note 或私有缓存来补写最终裁决。
- 本设计中“`trend-agent` 只消费已归一和已审计证据”的严格限制，默认指向 `tier-decider pass` 与最终 decision path；不得据此否定 `claim-builder pass` 先基于已归一证据生成候选这一必要前置阶段。

### `registry-agent` 双层职责边界

为降低 registry 既做运行供给又做治理审批时的耦合与瓶颈风险，当前设计补充冻结：`registry-agent` 仍保持一个实际 Agent，但其职责必须在语义上拆成两个结算面。

- `runtime snapshot publication plane`：负责发布只读的 `registry_snapshot`、`tool_registry_snapshot`、tool/route 可用性和成本状态，供运行时稳定消费。
- `governance review plane`：负责主体 candidate / promotion / merge、authority review、tool/source 替代关系、授权与成本治理审批。

执行约束：

- 运行时其他 Agent 只能消费已发布 snapshot，不得直接读取治理队列中的半成品状态作为事实前提。
- review / promotion / merge 的结果只有在进入新的 snapshot 后，才对下游运行时生效；不得把“刚审完但未发布”的治理结果偷偷注入当前 run。
- 该拆分是语义边界，不要求额外增加实际 Agent 数量；但实现不得把两类职责重新揉成一个无边界可变对象。

registry artifact 边界补充冻结如下：

- `registry_snapshot_ref` 只允许指向 runtime snapshot publication plane 产物；专责搜寻、normalization、claim-builder 和 tier-decider 默认只消费这一侧。
- `registry_review_ref` / authority promotion / merge / stale / exclusion 等治理决定，只允许落在 governance review plane 产物中；它们不能以未发布的内存状态直接穿透到运行时。
- 非 material 的长尾 governance review 不得阻断主 weekly。只有 admitted claim 命中的 authority material gap，才允许占用 same-run registry review 产能。

Finance Agent 的复杂度要求：

- 必须覆盖融资新闻、财报、SEC 披露、基金报告、并购、上市公司公告、investor relations、公开财报电话会和可信金融/产业数据源。
- 必须区分融资热度、资本配置、组织投入、并购整合、上市公司业务倾斜和产业研究叙事，不得把普通融资报道直接写成行业趋势成立。
- 必须输出来源层级、成本/授权状态、primary source distance、缺失来源、可选付费来源和 `human_exception_required` 状态。
- 只能把资本信号作为趋势支持度或风向信号；没有研究、产品、社区或开源交叉确认时，最多进入 `wind_probe`。

Policy Agent 的复杂度要求：

- 必须覆盖政策/监管文件、政府公告、审批、公共采购、标准组织文件、官方项目、OECD.AI、CSET、Stanford AI Index、Brookings、RAND 等政策研究和智库来源。
- 必须区分监管关注、政策空间、官方支持、确定审批、公共采购、风险提示和智库观点，不得把政策关注写成确定支持或技术成熟。
- 必须优先使用官方政策库、监管文件、标准组织文件、正式报告和可下载原文；新闻解读只能作为辅助解释。
- Policy Agent 的输出不得与 `news-pr` 职责项混写；政策/智库信号必须单独进入 `policy_regulatory` 或 `policy_research_thinktank` 轴。

职责项冻结如下：

| responsibility_id | 负责 Agent | 必须覆盖的轴 |
| --- | --- | --- |
| `research-frontier` | `academic-agent` | `research_paper` |
| `conference-academic` | `academic-agent` | `conference_academic` |
| `product-platform` | `product-oss-agent` | `product_vendor_release` |
| `developer-studio` | `product-oss-agent` | `developer_studio` |
| `cn-community` | `community-news-agent` | `community_discussion`、`news_pr_narrative` |
| `global-community` | `community-news-agent` | `community_discussion` |
| `project-oss` | `product-oss-agent` | `project_open_source` |
| `capital-finance` | `finance-agent` | `capital_finance` |
| `policy-regulatory` | `policy-agent` | `policy_regulatory` |
| `policy-research-thinktank` | `policy-agent` | `policy_research_thinktank` |
| `news-pr` | `community-news-agent` | `news_pr_narrative` |
| `registry-governance` | `registry-agent` | 全部 |
| `evidence-normalization` | `normalization-agent` | 全部 |
| `counter-evidence-audit` | `audit-agent` | 全部 |
| `trend-synthesis` | `trend-agent` | 全部 |

### 职责归属矩阵

为避免同一事实被多个职责项重复写成 accepted event，当前设计补充冻结如下：

1. 每个 `IndustrySignalEvent` 必须且只能有一个 `primary responsibility_id`。
2. 同一事实允许被多个职责项看到，但其他职责项只能以 contribution、relation edge、counter cue、gap request 或 context 形式留痕，不得重复产出第二个 accepted event 来抬高计数。
3. `cn-community` 与 `global-community` 的区别首先是 coverage slice 和搜寻范围，不是两套可重复记账的 community 事实仓。
4. `news-pr` 负责媒体/PR/传播链事实；`community_discussion` 负责社区讨论、原帖、复现和用户侧交流事实。媒体转述社区帖时，accepted event 必须有唯一 primary owner，另一侧只能以 relation 或 supporting context 留痕。
5. `product-platform` 与 `project-oss` 同时命中同一事实时，必须按事实主语义选择唯一 primary owner；另一个职责项只能作为 contributor，不得双计 accepted event。
6. 任何 claim、axis summary、agent contribution 或 weekly coverage 的计数，都必须基于 primary owner 统计；contributors 不得重复增加 accepted evidence 数量。

补充冻结：

- 职责归属必须先看底层事实主语义，再看发现渠道、传播渠道或谁先采到；不得因为媒体、社区或 vendor blog 更早出现，就夺走 direct fact owner。
- `news-pr` 与 `community_discussion` 的边界按事实类型划分：社区原帖、issue、forum、复现、用户实践反馈归 `community_discussion`；媒体报道、PR 稿、新闻转述、传播链归 `news-pr`。若新闻只是在转述一个社区原帖，底层 direct fact owner 仍应留在 community。
- `product-platform` 与 `project-oss` 的边界按事实载体和主语义划分：官方产品发布、SDK/API/docs、客户案例归 `product-platform`；repo release、包版本、模型卡、依赖采纳、开源维护动作归 `project-oss`。即使同一厂商 blog 提到 repo 变化，也不得自动把开源事实改记到 `product-platform`。
- `primary responsibility_id` 只解决“谁采集、谁记账、谁对 artifact 负责”，不直接决定该事实最终属于哪个 claim role、哪一个 archetype 或哪一个 axis 投影。
- claim role、cross-axis projection、supporting/counter 归属和独立性交叉确认，必须由 `fact_id`、`FactResolutionAudit` 和 `IndustryClaimEvidenceLink` 决定，而不是由采集 owner 标签直接决定。
- 允许“单 owner 记账、多角色投影”，但多角色投影不得重复增加 accepted evidence 数量，也不得自动增加独立性交叉确认 credit。

### 运行替补协作语义

单一 `primary responsibility_id` 只解决“最终谁记账、谁负责”，还不够解决运行中的持续 unavailable。否则现实里只剩两条坏路径：要么其他 Agent 偷偷跨职责顶上，要么整条轴长期挂空。当前设计补充冻结“记账 owner”与“运行替补”分离语义如下：

- `primary responsibility_id` 继续表示 accepted event、职责 coverage 和最终语义责任归属；它不因一次替补执行而自动变更。
- 新增 `operational_executor_id` 语义：表示本次 run 中实际执行采集、核验、抓取或补证动作的实际 Agent。它可以与 `primary responsibility_id` 对应的默认 Agent 相同，也可以在受控替补时不同。
- 新增 `takeover_mode` 语义，仅允许以下取值：`none`、`delegated_execution`、`temporary_backfill`、`emergency_manual`。
- 新增 `takeover_audit` 语义，至少保留：`takeover_reason_code`、`approved_by`、`effective_window`、`scope_limits`、`must_not_do`、`source_message_id` 或等价 artifact refs。

执行约束：

- 替补执行解决的是“这次谁实际跑了”，不是“这条职责从此归谁”；accepted event 的最终记账、周级 coverage 归属和缺失责任，默认仍按 `primary responsibility_id` 统计。
- `operational_executor_id != default_agent_for(primary responsibility_id)` 时，必须存在显式 `takeover_mode` 与 `takeover_audit`；不得出现“看起来是原专责产出，实际上别人代跑”的静默跨职责执行。
- `delegated_execution` 适用于专责 Agent 暂时 unavailable、但团队中存在具备同类采集/核验能力的替补执行者；其默认目标是保住轴覆盖，不改变 owner 语义。
- `temporary_backfill` 适用于窗口期补账、历史回补或受控 rerun；它必须有明确 `effective_window`，不得无限期延续成隐性职责迁移。
- `emergency_manual` 只适用于必须人工介入的高影响窗口；它可以保住可审计交账，但不得伪装成自动化专责能力已恢复。
- 替补执行者不得越权改写该职责的长期 authority policy、趋势升级口径或 owner arbitration 结果；`must_not_do` 必须明确写出其禁区，例如“不得自行做最终政策解释升级”“不得把媒体转述提升为 finance/policy 一手源”。
- `handled_by_agent_id`、`collected_by_agent_id` 或其他运行执行者字段，在 takeover 场景下都必须如实记录“这次是谁实际执行了”，而不是回填默认 owner Agent 以维持表面整齐；职责归属稳定性应由 `primary_responsibility_id` / `default_owner_agent_id` 保证，而不是靠伪造执行者字段。
- 若团队中不存在合格替补能力，系统仍应诚实输出 `unavailable`；该机制不允许用低能力替补把本应 unavailable 的高权威轴伪装成已覆盖。
- 替补执行只解决运行协作，不替代 `owner transfer`。只有事实主语义发生变化，或归一后认定初始 owner 错误时，才允许进入 owner 仲裁与转移流程。

### Owner 仲裁与转移

单一 `primary responsibility_id` 不能退化成“谁先写入谁永久拥有”。对跨职责高价值事实，必须允许先落 provisional owner，再由归一阶段完成最终 owner 仲裁与必要转移。

`owner arbitration` 冻结如下：

- 首次写入 accepted event 的职责项，默认只获得 `provisional owner` 身份；它有权先记账，但不自动获得最终语义 owner。
- `normalization-agent` 在 fact merge、cross-axis projection 和 source-chain 去重后，必须确认最终 `primary responsibility_id`；若事实主语义与首次写入职责项不一致，必须触发显式 owner transfer。
- owner transfer 必须保留 `owner_transfer_reason_code`、`previous_primary_responsibility_id`、`new_primary_responsibility_id`、`superseded_event_ids` 和对应 artifact refs；不得只在 notes 中口头说明。
- owner 转移后，旧 owner 只能保留 contributor、attestation、counter cue 或 context 身份；不得继续累计 accepted evidence 数量，也不得继续承担该事实的最终 claim role 解释权。
- 最终 owner 必须对该事实的 canonical artifact、后续补证入口、失败语义和引用完整性负责；不得出现“事件被使用了，但没有职责项承担最终责任”的状态。
- 最终 owner 仲裁顺序必须先看“底层事实语义”，再看“谁先采到”：
  - 论文、录用、benchmark、conference 官方事项优先归 `research-frontier` 或 `conference-academic`，新闻/社区转述不得夺走 direct fact owner。
  - 产品发布、平台能力、官方 changelog、官方示例和 vendor 文档优先归 `product-platform`；社区讨论或媒体报道只能作为 context / attestation。
  - repo、依赖、模型卡、包版本、开源维护动作优先归 `project-oss`；若同一事实同时被官方发布引用，仍按事实主语义在 `product-platform` 与 `project-oss` 中二选一。
  - 融资、财报、并购、IR、filing 和公开资本动作优先归 `capital-finance`；媒体报道不能成为最终 owner。
  - 法规、标准、监管征求意见、采购规则和官方政策文档优先归 `policy-regulatory`；智库/评论稿只能归 `policy-research-thinktank` 或 `news-pr`。
  - 纯社区原帖、复现、实践反馈和用户侧讨论优先归 `cn-community` / `global-community`；新闻复述社区帖不得拿走 owner。
- 触发 owner transfer 的固定条件必须至少包括：命中了更高一手度的 direct fact、事实归一后发现主语义换轴、媒体/社区事件被识别为对既有 primary fact 的传播链、或 provisional owner 被 canonical fact group 吸收。
- `superseded_event_ids` 只解决 accepted 记账 supersede，不允许删除历史 event；被 supersede 的 event 仍必须可被 replay、audit 和来源追溯引用。

### Fact Snapshot 结算边界

owner transfer、attestation 合并和 claim 计数不能依赖“最后数据库状态”。当前设计冻结事实结算边界如下：

- 新增 `fact_partition_id` 与 `claim_partition_id` 语义：事实结算面默认按 topic cluster、claim family、fact group 或等价稳定分区关闭，而不是要求整轮 weekly 只存在一个全局事实大锁。
- `normalization-agent` 产出的 `FactResolutionAudit.snapshot_id` 是当前 run 的事实快照标识；它代表本轮 claim-builder、audit 和 weekly 可读取的唯一事实结算面。
- `FactResolutionAudit.snapshot_id` 必须可映射到一个或多个已关闭的 `fact_partition_id`；claim-builder 默认消费“已关闭 partition snapshot 的并集”，而不是等待所有 partition 同时关闭。
- `claim-builder` 只能消费已关闭的 fact snapshot；不得一边读取 provisional owner 事件流，一边等待 owner transfer 晚到后再回补计数。
- 在 `fact_snapshot_cutoff_at` 之前完成的 owner transfer、attestation 合并和 source-chain / fact merge，可以进入当前 fact snapshot；晚于该 cutoff 的变化只能进入下一 run 或显式 rerun。
- 同一 claim 在同一 run 中的 accepted evidence 计数、独立性交叉确认 credit 和 canonical owner 解释权，必须以该 claim 消费的 `snapshot_id` 为准；不得被后续 transfer 静默改写。
- eval、replay、weekly 和人工复核引用的也是当时的 `snapshot_id`，而不是事后回看时最新的 owner / fact 状态。

`fact partition` 补充冻结如下：

- `fact_partition_id` 的生成必须基于稳定、可重放的 partition key 组合，例如 `topic cluster`、`claim_family_key`、`canonical entity/topic boundary`、`fact group seed` 或等价稳定键；不得按运行时线程、消费顺序或临时队列位置生成。
- 每个 partition 至少要有 `open`、`closing`、`closed`、`reopened` 四类可审计状态；`reopened` 只能由显式 late-result reopen 或 rerun 触发。
- partition close 必须同时记录 `close_reason_codes`、`included_event_batch_refs`、`included_attestation_refs`、`late_result_policy` 和 `snapshot_id`，供 replay 与 diff audit 消费。
- 跨 partition 的 owner transfer、merge 或冲突不得直接改写已关闭 partition；必须进入 `next_run_transfer_candidate`、`late_result_reopen` 或显式 rerun 路径。

补充执行约束：

- 只有 `headline core`、`tier_blocking`、`public_output_only` 或 owner 主语义未定的高影响 partition，才允许占用 same-run 全局结算关注度。
- 长尾 partition 若未及时关闭，默认应通过 `provisional_resolution`、`decision_confidence` 或 `consumer_readiness_state` 暴露，而不是拖住其他 partition 的 claim-builder / audit / tier-decider。
- `WeeklyIndustryTrendSection.run_snapshot` 是全局发布栅栏；fact 归一层不是全局串行大锁。
- partition key、close 条件和 reopen 规则必须是 deterministic 的；同一输入重放不得因并发顺序不同而生成不同 partition 边界。

### `normalization-agent` 争议分层

`normalization-agent` 必须是事实结算面的 owner，但不能被设计成“所有争议都必须 same-run 清零”的总瓶颈。当前设计补充冻结三层争议分层：

- `same_run_critical_resolution`
  - 只覆盖会直接影响 `headline core`、`tier_blocking`、关键独立交叉确认、公开输出阻断（`impact_scope="public_output_only"`）或 owner transfer 主语义归属的争议。
  - 这类争议必须在当前 fact snapshot 关闭前定案，或显式触发 rerun / blocking。
- `provisional_resolution`
  - 适用于仍可保留主事实、但会影响 `decision_confidence`、`coverage_audit_state`、`consumer_readiness_state` 或 public output 限权的未决问题。
  - 这类争议允许带着 `high_impact_unresolved_groups`、`impact_scope`、`auto_resolution_allowed` 和 `default_system_action` 进入当前 snapshot。
- `post_weekly_governance_resolution`
  - 适用于长尾 attestation 补写、低影响 owner 纠偏、alias/实体治理、非 headline claim 的语义清洗。
  - 这类问题进入治理队列或后续 rerun，不得无上限挤占当前 weekly 的 same-run blocking 容量。

执行约束：

- `normalization-agent` 的核心职责是冻结“当前 run 可消费的事实面”，并把争议分层、影响范围和默认系统动作结构化交给下游；不是在每一轮 same-run 内消灭全部长尾歧义。
- 只有命中 `impact_scope="tier_blocking"`、`impact_scope="public_output_only"` 且影响 headline / public projection、或 owner 主语义无法确定的争议，才允许占用 `same_run_critical_resolution`。
- 其余争议默认应进入 `provisional_resolution` 或 `post_weekly_governance_resolution`，并通过 `decision_confidence`、`coverage_audit_state`、`consumer_readiness_state`、`blocked_public_output` 或 review queue 显式暴露，而不是无限等待。
- `provisional_resolution` 不得伪装成“已经完全定案”；它必须在 `FactResolutionAudit.high_impact_unresolved_groups`、相关 review item 或后续治理对象中留下可反查留痕。

### `normalization-agent` 三分面

为避免 `normalization-agent` 在实现上重新膨胀成“一个大步骤里同时做传播链去重、事实归并、owner 仲裁、争议治理和长尾清洗”的串行瓶颈，当前设计补充冻结其内部必须可分离的三分面：

- `source-chain-resolution plane`
  - 负责转载链、转述链、同源多发布面、镜像页和传播噪声的批量去重。
  - 其输出必须形成可复用的 `source_chain_dedupe_batch` 或等价审计面，而不是和 fact merge 结果混成一个不可拆大对象。
- `fact-resolution plane`
  - 负责 `fact_partition` 内 canonical / merged / provisional / conflicted 事实归并，以及 `FactResolutionAudit.snapshot_id` 的关闭。
  - claim-builder、audit 和 weekly 只能消费已经关闭的 fact-resolution snapshot，不得直接穿透到 source-chain 临时中间态。
- `owner-attestation plane`
  - 负责 owner transfer、跨职责 attestation 合并、主语义归属确认和高影响 relation edge 的治理落账。
  - 该平面必须独立保留 `impact_scope`、`default_system_action`、`takeover / attestation refs` 和未决留痕，不能只在 merge winner 上隐式体现。

执行约束：

- `claim-builder` 至少需要一个已关闭的 fact-resolution snapshot，外加与其对应的 owner / attestation 结果；不得在 owner 尚未落账时直接拿临时归并结果生成最终候选。
- 长尾 owner / attestation 治理默认不得阻断 fact-resolution snapshot 关闭；只允许在命中 `tier_blocking`、headline 主语义归属或 `public_output_only` 高影响争议时占用 same-run 关键路径。
- 三分面可以在同一运行单元内实现，但输入输出、审计对象、重试键和关闭条件必须可拆分验证；否则后续并发优化会重新退化成单一串行大锁。

### 跨职责事实二次确认机制

单一 `primary responsibility_id` 只负责记账去重，不应让“谁先记账”变成“谁定义事实全部结构语义”。对于天然跨域的高价值事实，非 owner Agent 必须能把自己看到的关键语义结构化写回主事实，而不是只能写散文 context。

`cross_responsibility_attestation` 冻结如下：

- 任何非 owner Agent 在命中既有 canonical event / fact 时，都可以提交结构化 attestation，而不是重复产出第二个 accepted event。
- attestation 至少包含：`target_event_id` 或 `target_fact_id`、`attesting_responsibility_id`、`asserted_axis_keys`、`asserted_role_cues`、`supporting_or_counter_cue`、`citation_refs`、`reason_codes`。
- attestation 只能补充、纠偏或确认事实语义，不能直接增加 accepted evidence 数量，也不能绕过 owner 另起一条独立事实。
- `normalization-agent` 必须把 attestation 合并进 `FactResolutionAudit.relation_edges` 或等价结构；`trend-agent` 与 `audit-agent` 在处理跨域高价值事实时必须消费这些 attestation，而不是只看 owner 首次写入的字段。
- 对会影响主支柱、交叉确认、反证或 archetype 判定的高影响事实，owner 不得成为唯一结构语义来源；至少应允许相关职责项通过 attestation 正式写回。
- attestation 的强制优先级只应落在 `tier material`、`blocking_path`、public-safe 或 authority 相关事实上；对非关键 supporting/context 事实，允许按 batch 聚合、延后补写或显式缺失，不得把所有跨域事实都升级成 same-run 必填协作动作。

### `normalization-agent` 的脏数据处理顺序

为避免实现阶段把脏数据处理退化成“先大量过滤，再说归一”，当前设计冻结 `normalization-agent` 的执行顺序如下：

1. 先做 Source Chain 层去重：识别同一转载链、同一媒体转述链、同一公告传播链和同一 actor 多渠道复述，先消除传播放大噪声。
2. 再做 Fact 层归并：优先尝试 `canonical` / `merged_strong`，不足时进入 `merged_provisional`、`singleton_unresolved` 或 `conflicted`。
3. 保留关系边而不是只保留 merge winner：`normalization_result` 必须把 `FactResolutionAudit.relation_edges` 一并交给下游。
4. 对会影响 tier、blocking counter evidence 或 claim 争议结论的未决事实组，必须写入 `high_impact_unresolved_groups`，不得只留在 notes。

执行约束：

- 缺少稳定 canonical ID 不是 rejected 的默认理由；只要来源可追溯、axis 可归属、时间可落点且 topic/target 至少有一个可解释锚点，就应进入上述归一链路。
- `trend-agent` 与 `audit-agent` 消费的是“保留不确定性后的结构化结果”，不是被前置筛到只剩少数干净事件的样本。
- 若实现为了吞吐做批处理或缓存，仍不得跳过上述顺序，也不得因为 parser / source 能力薄弱而把大量高价值事件默认打回 rejected。

每个实际 Agent 的最小条件：

1. 有单独的输入 artifact 引用。
2. 有单独的输出 artifact 或 contribution record。
3. 有单独的 `status`、`status_reason` 和失败/跳过语义。
4. 可在测试中证明 Trend Agent 只消费上游 Agent 的输出，不直接补采原始来源。
5. 若发生跨职责替补执行，必须能从 artifact 或 message lineage 反查 `operational_executor_id`、`takeover_mode` 和 `takeover_audit`。

当前设计对“独立”的现实约束：

- 本章默认的“独立 Agent”首先指职责边界、输入输出 artifact、状态语义、失败语义和工具调用边界独立，不默认要求独立进程、独立队列、独立部署单元或独立服务账号。
- 当前设计允许多个实际 Agent 运行在同一 CLI pipeline、同一 DAG runner 或同一进程内，只要 artifact、message lineage、tool permission 和 decision boundary 仍可审计区分。
- `finance-agent`、`policy-agent`、`audit-agent` 和 `trend-agent` 的“独立”是高优先级语义约束：即使复用同一运行时，也不得合并为同一不可区分输出。
- 若 ExecPlan 选择把多个 Agent 映射到同一运行单元，必须说明共享了什么、仍独立保留了什么，以及如何测试“没有被静默合并”。

不是所有内部函数调用都必须暴露为完整消息对象，但所有跨阶段 canonical checkpoint 必须落账。对后续按 Agent 分工的实现，边界冻结如下：

- 任何跨 `actual_agent_id`、跨 `responsibility_id`、跨 stage checkpoint、跨异步队列 / 重试 / rerun / snapshot 边界、或会被另一位负责人独立消费的交接，都必须使用统一的 `IndustryAgentMessageEnvelope`、payload schema 和 artifact manifest。
- 下列交接默认必须暴露为完整消息对象：专责搜寻 Agent 到 `normalization-agent` 的证据批次；`normalization-agent` 到 `registry-agent` / `trend-agent` / `audit-agent` 的归一结果；`trend-agent` claim-builder 到 `audit-agent` 的候选批次；`audit-agent` 到 tier-decider 的审计结果；`registry-agent` 的 authority review 结果；任何 `evidence_gap_request/result`；任何 `failure_notice`；任何进入 weekly packager 的 canonical checkpoint。
- 仅限同一 `actual_agent_id` 内部、同一 stage 内部、同一 snapshot 内部、同步完成且不会单独重试 / 回放 / 审计的纯 helper 调用，可以不暴露为完整消息对象，例如 parser helper、字段补齐 helper、局部 scorer、局部 candidate ranker、局部 dedupe heuristic 或模板化摘要函数。
- 即使内部 helper 不落完整消息对象，其结果也必须通过所在 stage 的 canonical artifact 对外暴露；不得以“内部函数已经做过”绕过统一 schema、artifact 或审计要求。
- 因为后续大概率按 Agent 分工落地，Agent 与 Agent 之间的消息边界默认等于团队协作边界：任何跨 Agent 交接都不得使用临时函数签名、自由 JSON 或口头约定替代统一格式。

### 消息重型化准入

当前设计要求协作可审计，但不允许把每一次协作都升级成同等重量的消息治理动作。消息粒度必须优先服务“判断是否正确”，而不是制造大量协议噪声。

冻结三类 checkpoint：

1. `claim-critical checkpoint`
   - 会直接改变 `IndustryClaim` 准入、`IndustryClaimEvidenceLink` materiality、`CounterEvidenceAudit` 结论、`IndustryTrendDecision`、`HumanReviewQueueItem` / `OverrideAudit`、authority hold / promotion、owner transfer、或 `high_impact_unresolved_groups` 处置路径的交接。
   - 必须输出完整 `IndustryAgentMessageEnvelope`、payload schema、artifact manifest、稳定幂等键和明确的 `input/output_artifact_refs`。
2. `batch-governance checkpoint`
   - `evidence_batch`、`normalization_result`、批量 attestation、`tool_status_report`、聚合 `failure_notice`、daily pack 输入索引等默认属于这一层。
   - 允许把多个 event、gap、attestation 或失败实例聚合进一个 batch artifact，只要每个子项仍可反查 `event_id` / `fact_id` / `claim_id` / `gap_scope` / `reason_code`。
3. `internal-helper checkpoint`
   - 同一 Agent / 同一 stage / 同一 snapshot 内部的局部变换。
   - 不要求单独 message，但结果必须进入该 stage 的 canonical artifact，供 replay、审计和下游消费。

执行约束：

- 不会改变 `claim-critical` 判断路径的跨 Agent 协作，默认应优先落为 `batch-governance checkpoint`，而不是一事一消息地膨胀为细粒度治理流量。
- 同一 `claim_id`、`gap_scope`、`high_impact_unresolved_group_id` 或 `correlation_id` 下的重复 attestation、失败和补证结果，默认应 supersede 或聚合，而不是为每个 event 生成一条新的活动消息。
- 只有 `claim-critical checkpoint` 允许直接改写或新增 `IndustryClaim`、`IndustryClaimEvidenceLink`、`CounterEvidenceAudit`、`IndustryTrendDecision`、`HumanReviewQueueItem`、`OverrideAudit` 和 owner transfer 结果；`batch-governance checkpoint` 只能提供其输入材料，不得越权定案。
- 若同一 stage 同时产出 batch 级结果和少量 claim-critical 结论，允许采用“一个 batch artifact + 少量 claim-critical envelope”的组合；不得为了协议整齐而把整个 batch 复制成多条重型消息。

### 多 Agent 消息与交互协议

本节冻结的是协作语义、producer / consumer 边界、payload required behavior、幂等键、并发 handoff 和 queue/backpressure 规则，不是第二份 machine-readable 字段真源。

- `IndustryAgentMessageEnvelope`、`IndustryAgentArtifactManifest`、`same-run-dispatch-context.v1` 和 payload schema registry 的 machine-readable field truth 只允许来自 `schemas/industry/`。
- 本章若出现 interface、字段表或 payload 结构片段，只能视为“协作用引用摘录（非真源）”；它们用于解释协作语义，不得被单独维护成另一份可执行 schema。
- 若本章摘录与 `schemas/industry/` 或 [03-数据模型契约](03-数据模型契约.md) 的 canonical contract 冲突，必须以 machine-readable 真源和 `03` 的字段所有权约束为准，并把本章冲突文本视为待修复缺陷，而不是让实现“自行择一”。

当前设计不允许各 Agent 自行定义输入输出 JSON。所有 Agent 间通信必须通过统一的 `IndustryAgentMessageEnvelope` 和可引用 artifact 完成；自由文本只能作为 `summary_cn` 或 notes，不能作为下游可执行事实。

以下 code snippet 是协作用引用摘录，用来帮助评审快速理解 envelope / manifest 的关键键集；它不是字段真源，也不允许脱离 `schemas/industry/` 被手工单独演化。

```ts
type IndustryAgentMessageKind =
  | "task_request"
  | "task_result"
  | "evidence_batch"
  | "normalization_request"
  | "normalization_result"
  | "evidence_gap_request"
  | "evidence_gap_result"
  | "registry_review_request"
  | "registry_review_result"
  | "audit_request"
  | "audit_result"
  | "claim_candidate_batch"
  | "trend_decision_input"
  | "tool_status_report"
  | "failure_notice";

type IndustryArtifactKind =
  | "agent_message_payload"
  | "raw_tool_output_ref"
  | "industry_signal_event_batch"
  | "cross_responsibility_attestation_batch"
  | "normalized_event_batch"
  | "rejected_event_batch"
  | "evidence_gap_request"
  | "evidence_gap_result"
  | "registry_snapshot"
  | "tool_registry_snapshot"
  | "registry_review"
  | "claim_candidate_batch"
  | "claim_evidence_link_batch"
  | "claim_builder_audit"
  | "merge_audit"
  | "fact_resolution_audit"
  | "counter_evidence_audit"
  | "claim_admission_assessment"
  | "decision_context_artifact"
  | "claim_ledger"
  | "agent_contribution"
  | "tool_coverage_report"
  | "same_run_dispatch_context"
  | "capacity_reservation"
  | "human_review_queue_item"
  | "override_audit"
  | "daily_industry_evidence_pack"
  | "rolling_evidence_window_snapshot"
  | "weekly_industry_trend_section"
  | "public_weekly_industry_projection"
  | "consumer_weekly_industry_view";

interface IndustryAgentMessageEnvelope {
  message_id: string;
  schema_version: "industry-agent-message.v1";
  thread_id: string;
  run_id: string;
  window_start: string;
  window_end: string;
  sent_at: string;
  from_agent_id: IndustryAgentId;
  to_agent_id: IndustryAgentId | "broadcast";
  responsibility_id?: IndustryResponsibilityId;
  checkpoint_stage:
    | "search"
    | "normalization"
    | "registry_review"
    | "claim_build"
    | "audit"
    | "gap_followup"
    | "tier_decision"
    | "packaging";
  capability_class:
    | "discovery"
    | "normalization"
    | "governance"
    | "audit"
    | "decision"
    | "projection";
  kind: IndustryAgentMessageKind;
  payload_schema:
    | "task-request.v1"
    | "task-result.v1"
    | "event-batch.v1"
    | "normalization-request.v1"
    | "normalization-result.v1"
    | "evidence-gap-request.v1"
    | "evidence-gap-result.v1"
    | "registry-review-request.v1"
    | "registry-review-result.v1"
    | "audit-request.v1"
    | "audit-result.v1"
    | "claim-candidate-batch.v1"
    | "trend-decision-input.v1"
    | "tool-status-report.v1"
    | "failure-notice.v1";
  payload_ref: string;
  input_artifact_refs: string[];
  output_artifact_refs: string[];
  dispatch_context_ref?: string;
  scheduling_key?: string;
  claim_partition_id?: string;
  candidate_group_id?: string;
  claim_admission_assessment_ref?: string;
  capacity_reservation_refs: string[];
  required_depends_on_message_ids: string[];
  advisory_depends_on_message_ids: string[];
  correlation_id?: string;
  idempotency_key: string;
  status: "created" | "sent" | "consumed" | "superseded" | "failed" | "rejected";
  reason_code?: string;
  visibility_tier: "internal_only" | "redacted_public" | "public";
  redaction_policy_version?: string;
  contains_raw_text: boolean;
  contains_profile_urls: boolean;
  public_projection_artifact_ref?: string;
}

interface IndustryAgentArtifactManifest {
  artifact_ref: string;
  artifact_kind: IndustryArtifactKind;
  schema_version: string;
  produced_by_agent_id: IndustryAgentId;
  responsibility_id?: IndustryResponsibilityId;
  produced_at: string;
  source_message_id?: string;
  input_artifact_refs: string[];
  event_ids: string[];
  claim_ids: string[];
  axis_keys: IndustryEvidenceAxisKey[];
  visibility_tier: "internal_only" | "redacted_public" | "public";
  redaction_policy_version?: string;
  contains_raw_text: boolean;
  contains_profile_urls: boolean;
  public_projection_artifact_ref?: string;
  content_hash: string;
  storage_path: string;
  summary_cn: string;
}
```

`IndustryAgentMessageEnvelope` 协作语义摘录如下；字段 required 性、兼容边界和 machine-readable 字段真源仍以 `schemas/industry/` 为准：

| 字段 | 类型 / 取值 | 含义 | 执行约束 |
| --- | --- | --- | --- |
| `message_id` | stable string | 单条 Agent 消息 ID。 | 必须可追溯；重试同一逻辑消息应保留 `correlation_id` 并使用新的 `message_id`。 |
| `thread_id` | string | 同一次行业趋势工作流的消息线程。 | 同一 weekly run 的相关消息必须在同一 thread 下。 |
| `run_id` | string | 运行 ID。 | 必须与 daily / weekly artifact 的 run context 一致。 |
| `window_start/window_end` | ISO date/datetime | 消息处理的证据窗口。 | Agent 不得消费窗口外证据，除非 payload 明确标为历史上下文。 |
| `from_agent_id` / `to_agent_id` | `IndustryAgentId` 或 `broadcast` | 消息发送方和接收方。 | `broadcast` 只允许 registry/tool snapshot、failure notice 或全局 run context；任务执行不得广播给多个 Agent 后各自抢写。 |
| `responsibility_id` | `IndustryResponsibilityId` optional | 消息关联职责项。 | 专责 Agent 的 task/result/evidence 消息必须填写；registry/audit/trend 全局消息可按需为空。 |
| `checkpoint_stage` | 固定 stage enum | 消息所处的 canonical checkpoint。 | schema 兼容、调度和 handoff 边界必须优先按 checkpoint 判断，而不是只按具体 Agent 名称硬编码。 |
| `capability_class` | 固定能力类 enum | 该消息代表的能力类型。 | producer / consumer 兼容判断必须同时参考能力类；后续即使 Agent 拆分或合并，只要能力类和 checkpoint 未变，不得被迫改动 payload 语义。 |
| `kind` | `IndustryAgentMessageKind` | 消息类型。 | 下游只能按 kind 选择 payload parser，不能根据自然语言摘要猜测。 |
| `payload_schema` | schema ID enum | payload 的具体 schema。 | 必须与 `kind` 匹配；不匹配时消息 rejected。 |
| `payload_ref` | artifact ref | 结构化 payload 的存储引用。 | payload 不内联大段自由文本；必须可由 artifact manifest 解析。 |
| `input_artifact_refs` / `output_artifact_refs` | string[] | 本消息读取 / 产出的 artifact。 | 消息消费前必须验证 input refs 存在；输出必须登记 manifest。 |
| `dispatch_context_ref` | string optional | same-run / 共享池调度上下文引用。 | 任何会进入 same-run 配额、共享池或 claim-level 关键路径调度的消息必填；不得只靠 scheduler 本地内存态持有调度事实。 |
| `scheduling_key` | stable string optional | 队列层使用的统一调度键。 | 一旦消息进入 runtime queue 或 shared-pool arbitration，必须由 producer / allocator 显式冻结到 envelope；queue consumer 可以校验，但不得从其他 artifact 本地重算。 |
| `claim_partition_id` / `candidate_group_id` | string optional | 调度与合批使用的 claim / candidate 稳定键。 | 只要队列 coalesce、same-run admission 或共享池仲裁依赖这些稳定键，就必须显式带在 envelope；不得要求调度器先解引用 payload 或 ledger 再推导。 |
| `claim_admission_assessment_ref` | string optional | 当前消息依赖的 canonical claim admission assessment。 | 任何 claim-related same-run 排序、升级资格或配额仲裁若依赖 projected tier / readiness / cost，则必填；调度器不得本地重算后覆盖 canonical assessment。 |
| `capacity_reservation_refs` | string[] | 当前消息绑定的容量分配记录。 | 任何已通过 shared capacity / same-run 关键路径仲裁的消息都必须显式携带；没有 `granted` reservation 不得启动高成本或共享池动作。 |
| `required_depends_on_message_ids` / `advisory_depends_on_message_ids` | string[] | 前置消息依赖。 | `required` 未 consumed 时不得消费当前消息；`advisory` 允许消费，但 consumer 必须触发既定降级、缺口或限权语义。 |
| `correlation_id` | string optional | 同一任务、重试或请求-响应链路 ID。 | request/result、retry/supersede 必须共享 correlation。 |
| `idempotency_key` | string | 幂等键。 | 相同 key 的重复消息不得重复写入 evidence event。 |
| `status` | enum | 消息生命周期状态。 | 只有 `sent` 可被消费；消费成功改为 `consumed`；被替代改为 `superseded`；schema 不匹配、payload 非法或关键 ref 无法解析时必须为 `rejected`。 |
| `reason_code` | string optional | 失败、替代或拒绝原因。 | `failed/superseded/rejected` 必填。 |
| `visibility_tier` | `internal_only` / `redacted_public` / `public` | 消息及 payload 的可见层级。 | `internal_only` 不得被公开 weekly 或 Web surface 直接消费；公开展示必须走显式 projection。 |
| `redaction_policy_version` | string optional | redaction 策略版本。 | `redacted_public` 时必填；`public` 若无需脱敏可为空。 |
| `contains_raw_text` / `contains_profile_urls` | boolean | 是否仍包含 raw text / profile URL。 | 公开 projection 必须为 `false`；否则只能保留 internal。 |
| `public_projection_artifact_ref` | string optional | 对应公开投影 artifact ref。 | `visibility_tier="redacted_public"` 或 `"public"` 时应可解析；不得与 internal storage path 复用同一文件。 |

`IndustryAgentArtifactManifest` 协作语义摘录如下；字段 required 性、兼容边界和 machine-readable 字段真源仍以 `schemas/industry/` 为准：

| 字段 | 类型 / 取值 | 含义 | 执行约束 |
| --- | --- | --- | --- |
| `artifact_ref` | stable string | artifact 全局引用。 | 必须可被 message、contribution、ledger、weekly card 反查。 |
| `artifact_kind` | `IndustryArtifactKind` | artifact 类型。 | 下游必须按 kind 和 schema_version 解析。 |
| `produced_by_agent_id` | `IndustryAgentId` | 产出 Agent。 | 必须与 source message 的 `from_agent_id` 或处理 Agent 一致。 |
| `source_message_id` | string optional | 触发该 artifact 的消息。 | 由消息驱动产物必须填写。 |
| `input_artifact_refs` | string[] | 产物依赖的上游 artifact。 | 用于审计信息流，不能省略。 |
| `event_ids` / `claim_ids` / `axis_keys` | arrays | 产物覆盖对象。 | 不适用时为空数组；不得省略字段。 |
| `visibility_tier` | `internal_only` / `redacted_public` / `public` | artifact 的可见层级。 | internal artifact 可服务 weekly/audit，但不得被公开 surface 直接读取。 |
| `redaction_policy_version` | string optional | artifact 的 redaction 策略版本。 | `redacted_public` 时必填。 |
| `contains_raw_text` / `contains_profile_urls` | boolean | artifact 是否仍含 raw social text / profile URL。 | 公开 projection 必须为 `false`。 |
| `public_projection_artifact_ref` | string optional | 对应公开投影 artifact。 | 存在公开版本时必须登记；不得与 internal artifact 共用 `artifact_ref`。 |
| `content_hash` | string | artifact 内容 hash。 | 用于防止同 ref 内容漂移；内容变化必须新 hash。 |
| `storage_path` | string | 本地或公开产物路径。 | raw local-only artifact 不得出现在 public manifest 中。 |

控制类 payload 的 manifest 约束：

- 所有 `payload_ref` 都必须登记为 `IndustryAgentArtifactManifest`。
- `task_request`、`task_result`、`normalization_request`、`registry_review_request`、`registry_review_result`、`audit_request`、`audit_result`、`trend_decision_input`、`tool_status_report` 和 `failure_notice` 这类控制或交接 payload，如不属于 event/ledger/audit/coverage canonical artifact，必须使用 `artifact_kind="agent_message_payload"` 登记。
- 同一 `payload_ref` 不得被多个 `payload_schema` 复用；如 payload 内容变化，必须生成新 `artifact_ref` 与新 `content_hash`。
- payload 与 manifest 的 `visibility_tier`、raw-text/profile-url 标记必须一致；若某 payload 需要公开消费，必须额外登记独立的 public projection artifact，而不是复用 internal payload path。

当前设计的消息与 artifact 粒度约束：

- 当前默认以 `responsibility_id + run_id`、`claim_candidate_group + run_id` 或 `stage + run_id` 为消息 / payload 的主要粒度，不按单个 event 生成独立 envelope，除非该 event 自身需要被单独审计。
- `evidence_batch`、`tool_status_report`、`failure_notice`、`registry_review_request` 和 `registry_review_result` 默认允许按同一 responsibility 或同一 stage 聚合；只要内部对象仍可由 `event_id`、`claim_id`、`reason_code` 或 `artifact_ref` 反查。
- 文件型 canonical runtime 不要求“每个控制动作一个独立小 artifact”；只要求交接边界可审计、payload schema 匹配、内部对象可追溯。
- ExecPlan 不得把消息粒度细化到导致本地 JSONL / manifest index 成为主要运行瓶颈；如需单 event 粒度，必须写明为什么 batch 粒度不够。
- 消息与 manifest 允许热存压缩，但 compaction 后必须保留 `run_id`、`message_id`、`correlation_id`、`source_message_id`、`input_artifact_refs`、`output_artifact_refs`、`status` 和 visibility 元数据；不得为了省空间把 lineage 压成不可验证摘要。

### `same-run-dispatch-context.v1`

仅把预算字段写进 payload 还不够；queue / scheduler / allocator 还需要一个不能靠解引用推导的统一调度面。当前设计补充冻结 `same-run-dispatch-context.v1`，用于承载 same-run claim admission、共享池仲裁和并发调度共用的 machine-readable 键集。

```ts
interface SameRunDispatchContext {
  dispatch_context_id: string;
  schema_version: "same-run-dispatch-context.v1";
  run_id: string;
  source_message_id: string;
  dispatch_scope:
    | "background"
    | "same_run_claim_scoped"
    | "shared_pool_claim_scoped"
    | "same_run_blocking_review";
  scheduling_key: string;
  claim_partition_id?: string;
  candidate_group_id?: string;
  gap_scope?: {
    scope_type:
      | "single_axis_missing"
      | "single_source_confirmation"
      | "blocking_counter_resolution"
      | "authority_resolution"
      | "owner_arbitration_resolution";
    claim_id: string;
    axis_keys: IndustryEvidenceAxisKey[];
    entity_ids?: string[];
    blocking_class:
      | "tier_blocking"
      | "public_output_only"
      | "authority_only"
      | "confidence_only";
    source_constraint_hash_basis: string[];
  };
  claim_admission_assessment_ref?: string;
  capacity_reservation_refs: string[];
  runtime_budget_profile_id: string;
  cost_budget_profile_id: string;
  critical_path_class: string;
  estimated_cost_units: number;
  dispatch_decision_reason_codes: string[];
  supersedes_dispatch_context_id?: string;
}
```

执行约束：

- 任何会进入 same-run claim admission、共享池仲裁、热点 coalesce 或 `runtime-concurrency-control-policy.v1` 队列的消息，都必须有 `dispatch_context_ref`，并在 envelope 显式镜像 `scheduling_key`、`claim_partition_id`、`candidate_group_id`、`claim_admission_assessment_ref` 和 `capacity_reservation_refs` 中本次调度真正依赖的字段。
- `dispatch_scope="background"` 的消息可以不填 claim / reservation 相关字段；一旦进入 `same_run_claim_scoped`、`shared_pool_claim_scoped` 或 `same_run_blocking_review`，缺少上述键集时必须在入队前 rejected，而不是让调度器去别的 artifact 里补推导。
- `scheduling_key` 是 queue 层外部可审计契约，不是某个实现的私有哈希；其语义必须由 `claim_partition_id`、`candidate_group_id`、`gap_scope` 或等价稳定键在 canonical schema source 中定义，并由 producer / allocator 显式产出。
- scheduler / queue consumer 可以校验 `dispatch_context_ref` 与 envelope 镜像字段的一致性，但不得在字段缺失时改为本地重算 `claim_admission_assessment_ref`、`capacity_reservation_refs`、`claim_partition_id` 或 `candidate_group_id`。
- `same-run-dispatch-context.v1` 必须登记为 `artifact_kind="same_run_dispatch_context"`；任何 supersede、merge 或 queue-level coalesce 都必须保留旧 `dispatch_context_id` 到新 `dispatch_context_id` 的可追溯关系。

### Metric Profile Handoff 规则

本文档不冻结 freshness、axis scoring、trend decision 或 runtime budget 的具体数值；这些数值以对应评分、运行和产品治理文档中的 profile 为准。

但所有 Agent 输出必须携带下游计算这些指标所需的原始结构化字段，不能只输出已经算好的分数或自然语言判断。专责搜寻 Agent 不得自行裁决：

- `axis_score`
- `freshness_score`
- `decision_tier`
- `core_industry_trend`
- `strong / medium / weak`

专责搜寻 Agent 只负责输出计算 profile 所需的事实字段，例如：

- `source_published_at`
- `observed_at`
- `source.source_type`
- `source.primary_source_distance`
- `axis`
- `polarity`
- `agent_relevance`
- `source.authority_tier`
- `tool_route_id`
- `raw_ref` / `citation_ref`
- `audit.dedupe_key`
- `freshness_anchor_kind`；如当前来源无法判断，必须填 `unknown` 并写稳定 `reason_code`

执行约束：

- 专责搜寻 Agent 可以输出“建议性” notes，但不能把这些 notes 当作正式评分结论传给下游。
- `normalization-agent` 必须补齐、降级或拒绝缺少关键 metric input 的 event；不得默认缺字段 event 为可评分 supporting evidence。
- `trend-agent` 可以消费已归一事件、registry review、tool coverage 和 audit result，但不得把原始事件中的缺失 freshness / source / authority / relevance 字段默认为高分判断。
- 任何需要 profile 计算却缺少关键输入字段的 event，必须在 payload、contribution 或 rejected audit 中显式可见；不得静默丢弃。
- 任何需要事实独立性交叉确认的判断，不能只读取 `fact_id` 是否存在；必须同时消费 `fact_resolution_state`、`provisional_fact_group_id`、`FactResolutionAudit` 和对应 unresolved group 语义。

### Lineage 与 Manifest 语义

其余协作术语统一以 [术语与审计词汇表](09-术语与审计词汇表.md) 为准；这里仅补充本章最关键的两个审计对象。


为避免实现阶段把消息系统退化成“发几份 JSON 就算交接完成”，这里额外冻结两个专用名词：

- `message lineage`：指同一 `run_id`、`thread_id`、`correlation_id` 下，消息从 request 到 result、从 claim-builder pass 到 audit pass、再到 tier-decider pass 的依赖链。它不是日志时间线，而是可被 `required_depends_on_message_ids`、`advisory_depends_on_message_ids`、`source_message_id`、`input_artifact_refs` 和 `output_artifact_refs` 验证的结构化交接链。
- `artifact manifest`：指对每个 canonical artifact 的登记条目，即 `IndustryAgentArtifactManifest`。它不是文件列表，而是 artifact 的 canonical inventory，负责说明这个 artifact 是谁在什么 schema version 下、基于哪些输入产出的，以及下游应该如何解析它。

执行约束：

- 没有 `message lineage` 的消息，只能视为未完成 handoff，不能证明某个 claim 真正经过了审计和裁决。
- 没有 `artifact manifest` 的 artifact，只能视为未登记中间产物，下游不得把它当作 canonical 输入消费。

### Payload Schema Registry

`payload_schema` 不能只是 envelope 上的字符串。当前设计冻结以下 payload schema registry；ExecPlan 可以把字段落成 JSON Schema / Zod / TypeBox，但不得删减 producer、consumer、required refs、missing behavior 或失败语义。

所有 payload 共同字段：

- `payload_id`、`schema_version`、`run_id`、`window_start`、`window_end` 必填，且必须与 `IndustryAgentMessageEnvelope` 对齐。
- `source_message_id` 必须指向当前 payload 所属 envelope；request / result 链路还必须共享 `correlation_id`。
- payload 中的 `*_artifact_ref(s)` 必须能在 `IndustryAgentArtifactManifest` 中解析；无法解析时消息进入 `failed` 或 `rejected`，不得由下游猜测。
- `summary_cn` 只能解释结构化字段，不得新增事实；下游可执行事实只能来自 event、registry、audit、coverage 或 ledger artifact。
- 如 payload 依赖评分、freshness、authority 或 relevance profile，则 producer 必须显式传递 profile 计算所需的原始字段缺口；不得用“已判断为 strong / fresh / core”替代输入事实。
- 任何会消耗 same-run 关键路径、共享容量池或高成本 canonical fetch 的 payload，都必须显式携带 `runtime_budget_profile_id`、`cost_budget_profile_id`、`critical_path_class` 和 `estimated_cost_units`；如果是 result payload，还必须补充 `actual_latency_ms`，并在可计量时补充 `actual_cost_units`。
- 任何已经通过 claim budget 或 shared capacity 仲裁的请求 / 结果，都必须显式携带 `capacity_reservation_ref(s)` 或等价 canonical reservation 引用；执行 Agent 不得只靠 coordinator 内存态判断自己是否已获准开跑。
- 任何 claim-related same-run 请求，只要其排序、配额或共享池仲裁依赖 projected tier / readiness / cost，就必须显式携带 `claim_admission_assessment_ref`；调度器不得本地重算 admission 预估再覆盖 canonical assessment。
- 任何会进入 same-run 配额、共享池或 claim-level 并发控制的 payload，都必须显式携带 `dispatch_context_ref`；queue 层依赖的 `scheduling_key`、`claim_partition_id`、`candidate_group_id`、`claim_admission_assessment_ref` 和 `capacity_reservation_refs` 必须来自该 dispatch context 与 envelope 镜像字段，而不是由 consumer 事后推导。

schema governance 补充冻结如下：

- payload schema registry、`reason-code-registry.v1`、`state-transition-registry.v1` 与 `IndustryAgentMessageEnvelope` 必须从同一 canonical schema source 发布，不得由各 Agent 仓内复制粘贴维护。
- 必须存在单一 `schema_owner` 负责批准 payload schema breaking change、reason/state registry 扩展和兼容矩阵更新；不得由单个 Agent 实现者私自扩字段后要求下游兼容。
- `compatibility_matrix` 必须明确 producer 与 consumer 对当前 major、上一个兼容 major/minor 的支持范围；consumer 不得以“尽量解析”替代显式兼容声明。
- payload schema registry 的 producer / consumer 表达的是当前默认运行执行者，不是 payload 语义对具体 Agent 名称的永久硬绑定；真正冻结的协作边界应由 `responsibility_id`、`checkpoint_stage`、`capability_class` 和 payload required behavior 共同决定。
- `codegen_targets` 必须覆盖至少一种 machine-readable canonical target，供多人实现共享；仅有 prose 表格而无可机读 schema 视为治理不完整。
- 当前设计包必须随仓交付 `schemas/industry/canonical-schema.bundle.json`、`schemas/industry/compatibility-matrix.json`、`schemas/industry/reason-code-registry.json` 和 `schemas/industry/state-transition-registry.json`；若 `schemas/industry/` 目录缺失，则本章所有 schema registry 仍视为解释稿，不得宣称协作契约已收口。
- `03-数据模型契约` 是唯一 prose 真源；`schemas/industry/` 是唯一 machine-readable 真源。若 machine-readable 契约尚未 materialize，结论只能是“设计包仍待补齐”，不得回退成让相邻模块直接依赖本章接口摘录、临时 JSON 或口头字段约定。

### 预算与成本单一结算真源

多 Agent 并行时，最容易失控的不是“能不能启动”，而是“同一笔预算在多个层里被重复记账”。为避免 coordinator、queue dispatcher、shared pool allocator、trend-agent 和 weekly packager 各自维护一套成本账，当前设计补充冻结如下：

- `BudgetArbitrationRecord` 是预算与成本的单一结算真源；它负责把 `claim family / candidate group / shared pool / reservation lane / run total` 上的预算请求结算成唯一 machine-readable 账目。
- `CapacityReservation` 只解决资源占槽与释放，不替代预算结算；同一动作可以同时有 `BudgetArbitrationRecord` 和 `CapacityReservation`，但前者回答“怎么算账”，后者回答“占没占槽”。
- `run_budget_summary` 只能汇总 `BudgetArbitrationRecord` 的非 superseded 记录与终态 reservation，不得从 task-result、日志或队列长度反向推导。
- `task-result.v1`、`evidence-gap-result.v1`、`registry-review-result.v1`、`audit-result.v1`、`failure-notice.v1` 只能回写实际成本或失败原因，不得作为新的预算真源另起一套口径。
- `BudgetArbitrationRecord` 的 `scope_key` 必须稳定对应 `claim_family_key`、`candidate_group_id`、`pool_id`、`reserve_scope.target_ref` 或 `run_id` 中的一项，不得让同一语义范围在不同模块写出不同 key。
- 同一 `scope_key` 只允许一条有效结算记录；任何重试、部分授予、改配额、释放或 supersede 都必须通过旧记录指向新记录完成链式留痕。
- queue dispatcher、allocator 和 weekly packager 均不得本地重新计算总成本或 slot 占用是否足够，只能消费 `BudgetArbitrationRecord` 与 `CapacityReservation` 的最终状态。

| payload_schema | allowed `kind` | producer | consumer | required fields / refs | missing / failure behavior |
| --- | --- | --- | --- | --- | --- |
| `task-request.v1` | `task_request` | registry-agent 或上游实际 Agent | 专责搜寻 Agent、normalization-agent、audit-agent、trend-agent | `task_id`、`responsibility_id`、`axis_keys`、`registry_snapshot_ref`、`tool_registry_snapshot_ref`、`deadline_at`、`runtime_budget_profile_id`、`cost_budget_profile_id`、`critical_path_class`、`estimated_cost_units`、`input_artifact_refs`、`dispatch_context_ref`、`claim_admission_assessment_ref?`、`capacity_reservation_refs?` | 缺 registry/tool snapshot 或预算画像时任务不得启动，必须产出 `failure_notice.v1`。若任务会进入 same-run admission、共享池或 claim-level queue，而缺 `dispatch_context_ref`、缺 `claim_admission_assessment_ref` 或缺 `capacity_reservation_refs`，必须在入队前 rejected；不得让 scheduler 解引用别的 artifact 或本地补算。 |
| `task-result.v1` | `task_result` | 任一实际 Agent | task requester、registry-agent | `task_id`、`request_message_id`、`status`、`output_artifact_refs`、`agent_contribution_ref`、`dispatch_context_ref`、`claim_admission_assessment_ref?`、`capacity_reservation_refs?`、`actual_latency_ms`、`actual_cost_units?`、`reason_code?` | `partial/skipped/failed/unavailable` 必须有 `reason_code`；不得只返回自然语言摘要。若该任务曾占用 same-run 配额或共享池，result 不得丢失对应 dispatch / reservation / admission 引用。 |
| `event-batch.v1` | `evidence_batch` | academic/product/community/finance/policy Agent | normalization-agent | `events_ref`、`raw_tool_output_refs`、`agent_contribution_ref`、`tool_status_report_refs`、`responsibility_id`、`metric_input_completeness`、`cross_responsibility_attestation_refs?` | 缺 `events_ref` 时视为无 accepted events；仍必须有 contribution 或 failure notice。缺关键 metric input 时不得默认为 accepted supporting events，必须补齐、降级为 context、进入 rejected_event_batch 或发送 failure notice。专责 Agent 可以在 event 中标出 source-level counter cue，也可以通过 attestation 对既有主事实补充结构语义，但不得直接给出最终 claim role。 |
| `normalization-request.v1` | `normalization_request` | registry-agent / trend-agent claim-builder pass | normalization-agent | `event_batch_refs`、`registry_snapshot_ref`、`dedupe_policy_version`、`runtime_budget_profile_id`、`cost_budget_profile_id`、`critical_path_class`、`estimated_cost_units` | 缺 event batch 时不得生成空成功结果；应标 `skipped` 或 `unavailable`。 |
| `normalization-result.v1` | `normalization_result` | normalization-agent | registry-agent、audit-agent、trend-agent claim-builder pass | `normalized_event_batch_ref`、`rejected_event_batch_ref`、`merge_audit_ref`、`fact_resolution_audit_ref`、`used_event_batch_refs`、`actual_latency_ms` | 未产出 `merge_audit_ref` 或 `fact_resolution_audit_ref` 时下游不得消费 normalized events。 |
| `evidence-gap-request.v1` | `evidence_gap_request` | trend-agent、audit-agent、registry-agent | 对应专责搜寻 Agent、registry-agent | `claim_id`、`requested_agent_id`、`claim_admission_assessment_ref`、`gap_scope`、`missing_axis_keys`、`gap_reason_code`、`expected_source_constraints`、`deadline_at`、`retry_count`、`runtime_budget_profile_id`、`cost_budget_profile_id`、`critical_path_class`、`estimated_cost_units`、`capacity_reservation_refs?`、`input_artifact_refs` | 只允许针对接近升级门槛但缺关键一手证据的 claim 发起；缺 claim、缺目标 Agent、缺 `claim_admission_assessment_ref` 或缺 `gap_scope` 时请求 rejected。 |
| `evidence-gap-result.v1` | `evidence_gap_result` | 被请求的专责搜寻 Agent 或 registry-agent | request 发起方、trend-agent tier-decider pass、audit-agent | `claim_id`、`request_message_id`、`gap_scope`、`status`、`output_artifact_refs`、`resolved_axis_keys`、`remaining_gap_reason_codes`、`actual_latency_ms`、`actual_cost_units?`、`capacity_reservation_refs?` | `status=failed/partial/unavailable` 时必须保留 gap reason；不得用自然语言宣称“已补齐”而无 artifact。 |
| `registry-review-request.v1` | `registry_review_request` | normalization-agent、audit-agent、专责搜寻 Agent | registry-agent | `unknown_actor_refs`、`provisional_authority_refs`、`basis_event_ids`、`requested_action`、`claim_admission_assessment_ref?`、`runtime_budget_profile_id`、`cost_budget_profile_id`、`critical_path_class`、`estimated_cost_units`、`capacity_reservation_refs?` | same-run material review 若缺 basis events 或缺 `claim_admission_assessment_ref`，只能生成 rejected / deferred review，不能提升 authority。 |
| `registry-review-result.v1` | `registry_review_result` | registry-agent | audit-agent、trend-agent | `registry_review_ref`、`registry_snapshot_ref`、`approved_entity_ids`、`rejected_entity_ids`、`reason_codes`、`actual_latency_ms`、`actual_cost_units?`、`capacity_reservation_refs?` | provisional authority 未经 registry-agent + audit-agent 双审时不得作为 core/proven；authority review 缺失默认阻断 authority 晋升，不默认否定 claim 存在本身。 |
| `audit-request.v1` | `audit_request` | trend-agent claim-builder pass / registry-agent | audit-agent | `claim_candidate_batch_ref`、`claim_evidence_link_batch_ref`、`normalized_event_batch_ref`、`registry_review_result_refs`、`supporting_event_ids`、`counter_event_ids`、`fact_resolution_audit_ref`、`claim_admission_assessment_ref`、`runtime_budget_profile_id`、`cost_budget_profile_id`、`critical_path_class`、`estimated_cost_units`、`capacity_reservation_refs?` | 缺 claim candidate、claim evidence link、`fact_resolution_audit_ref` 或 `claim_admission_assessment_ref` 时 audit-agent 不得凭空审计；必须返回 failed request 或 skipped reason。 |
| `audit-result.v1` | `audit_result` | audit-agent | trend-agent tier-decider pass | `counter_evidence_audit_ref`、`audited_claim_candidate_ids`、`blocking_claim_candidate_ids`、`downgrade_recommendations`、`high_impact_unresolved_group_ids`、`actual_latency_ms`、`actual_cost_units?`、`capacity_reservation_refs?` | 每个进入 tier decision 的 candidate 原则上都应有 audit result；缺失时默认下调 `decision_confidence` 并标记 `coverage_audit_state=partial`。material 边界必须以 `IndustryClaimEvidenceLink.materiality_class` / `is_tier_material` 和 `FactResolutionAudit.high_impact_unresolved_groups.impact_scope` 为准，不得由各 Agent 临时自由判断。只有在缺失审计覆盖主支柱、关键独立交叉确认、`blocking_path` 或 `impact_scope=tier_blocking` 的未决组时，才不得保留原 `core` 候选；若连主支柱级审计都缺失，最高 `insufficient_evidence`。 |
| `claim-candidate-batch.v1` | `claim_candidate_batch` | trend-agent claim-builder pass | audit-agent、trend-agent tier-decider pass | `claim_candidate_batch_ref`、`claim_evidence_link_batch_ref`、`claim_builder_audit_refs`、`candidate_group_ids`、`input_event_ids`、`generated_claim_ids`、`deferred_event_ids`、`rejected_event_ids` | 该 payload 不得包含最终 `decision_tier`；`claim_evidence_link_batch` 中每条 link 必须已写明 `materiality_class`、`is_tier_material` 与 `materiality_reason_codes`。若发生候选折叠，`claim_builder_audit_refs` 还必须能反查 `overlap_cluster_id`、`canonical_candidate_group_id` 和 `fold_reason_codes`。候选缺 claim evidence link、这些 materiality 字段或折叠留痕时，不得进入最终 ledger。 |
| `trend-decision-input.v1` | `trend_decision_input` | registry-agent / trend-agent tier-decider pass | trend-agent tier-decider pass | `claim_candidate_batch_ref`、`claim_evidence_link_batch_ref`、`decision_context_artifact_ref`、`missing_context_reason_codes`、`project_weekly_artifact_refs` | `trend-decision-input.v1` 的 canonical surface 必须收敛为稳定 `decision_context_artifact_ref`，由该 artifact 统一承载 registry、audit、tool coverage、agent contribution 与 normalization 的裁决上下文；tier-decider 不得直接把所有上游 batch 当成“大总线输入面”长期耦合。若缺少 decision context 中的 material 审计或主支柱上下文，默认先下调 `decision_confidence`、标记 `coverage_audit_state=partial` 并写入 `missing_axes` / `not_complete_unless`；其中 `missing_axes` 只允许承载 `axis_applicability_state="required"` 的主缺口。只有当缺口命中 `is_tier_material=true` 的主支柱、关键独立交叉确认、`blocking_path` 或 `impact_scope=tier_blocking` 的未决组时，才允许直接下调 `decision_tier`。生成最终 ledger 时还必须产出 `consumer_readiness_state` 与 `consumer_display_priority`。 |
| `tool-status-report.v1` | `tool_status_report` | registry-agent、专责搜寻 Agent | normalization-agent、trend-agent、weekly output | `axis_tool_coverage_report_refs`、`tool_registry_snapshot_ref`、`active_route_level`、`active_source_class`、`selection_scorecard_version?`、`selection_score_total?`、`veto_reason_codes`、`degradation_reason_codes`、`budget_status_summary` | 没有每轴 coverage report 时，相关轴必须为 `unavailable`，不能默认为 covered；高权威轴若缺 `active_source_class`、scorecard 关键信息或预算摘要，不得被下游默认为 official-first 已满足。 |
| `failure-notice.v1` | `failure_notice` | 任一实际 Agent | 下游依赖 Agent、weekly output | `failed_agent_id`、`responsibility_id?`、`failed_kind`、`reason_code`、`affected_axis_keys`、`retryable`、`fallback_action` | 下游必须把 affected axes 写入 missing/unavailable；不得静默重试后丢失失败记录。 |

Payload schema 与 message kind 的匹配是结构测试项：`kind` 与 `payload_schema` 不匹配时消息必须 rejected；同一 `payload_ref` 不能被多个不兼容 schema 复用。

### `gap-scope-contract.v1`

`gap_scope` 不是自由字符串，而是补证、并发调度、幂等和 backlog merge 的共同稳定键。当前设计冻结最小结构如下：

- `scope_type`：`single_axis_missing` / `single_source_confirmation` / `blocking_counter_resolution` / `authority_resolution` / `owner_arbitration_resolution`
- `claim_id`
- `axis_keys[]`
- `entity_ids[]?`
- `blocking_class`：`tier_blocking` / `public_output_only` / `authority_only` / `confidence_only`
- `source_constraint_hash_basis[]`

执行约束：

- `gap_scope` 必须按 canonical 序列化后参与 `correlation_id`、`idempotency_key`、merge_key 和 backlog family 计算；不得由不同 Agent 各自决定“这一缺口算不算同一个”。
- `axis_keys`、`entity_ids` 和 `source_constraint_hash_basis` 的顺序必须 deterministic；同一语义缺口在不同消费顺序下不得生成不同 `gap_scope`。
- 任何实现若需要额外局部细节，只能放进 owner 模块的 `L2 module-owned extension block`；跨模块去重、并发和 reopen 只能依赖上述冻结结构。

补充冻结：

- 任何 payload 中一旦有字段要被第二个模块、第二个 Agent 或第二个 checkpoint 正式依赖，该字段就必须先回到 canonical schema source 与 payload schema registry，再允许跨模块消费；不得依赖局部约定俗成字段。
- producer / consumer 的适配应优先通过稳定 schema、capability class 和 checkpoint stage 完成，而不是通过“认识某个具体 Agent 名字”完成；否则后续 Agent 拆分、合并或替换会引发协议级连锁变更。

Schema 兼容与 replay 边界冻结如下：

- breaking change 必须升级 `schema_version`；不得在同一版本下改变字段语义、枚举语义或失败语义。
- 当前 consumer 至少要明确两类结果：`supported` 与 `unsupported_version`；遇到未知更高 major version 时必须 rejected 并发送 `failure_notice.v1`，不得“尽量解析”。
- replay runner 必须记录本次使用的 schema snapshot / reader set，区分“数据漂移”“规则漂移”和“版本不兼容阻断”。
- `WeeklyIndustryTrendSection`、`IndustryClaimLedger`、`IndustryAgentMessageEnvelope` 和 `IndustryAgentArtifactManifest` 的 consumer 在当前 major 版本至少要支持当前冻结版本和同 major 的上一个兼容版本；若不支持，必须在治理面标明迁移窗口。
- payload 仍只负责传递结构化字段和 artifact refs；超过单次消费边界的批量对象必须拆成 batch artifact，不得回退为超大 inline JSON。

### `message-key-policy.v1`

为避免重试、补证、并发关闭和 late-result reopen 时消息幂等键各写一套，当前设计补充冻结核心消息键公式：

- `task_request.idempotency_key = run_id + responsibility_id + checkpoint_stage + normalized_input_hash`
- `task_result.correlation_id = source request.correlation_id`
- `evidence_gap_request.correlation_id = run_id + claim_id + gap_scope`
- `evidence_gap_request.idempotency_key = correlation_id + requested_agent_id + expected_source_constraints_hash`
- `audit_request.idempotency_key = run_id + claim_candidate_batch_ref + fact_resolution_audit_ref`
- `registry_review_request.idempotency_key = run_id + requested_action + basis_event_ids_hash`
- `failure_notice.aggregate_key = run_id + responsibility_id + reason_code + correlation_id`

执行约束：

- 同一业务动作的 retry 不得生成新的语义键；只能复用原 `correlation_id` / `idempotency_key`，并通过状态迁移表达重试次数与结果。
- supersede、merge、coalesce 或 reopen 只能在保留原键 lineage 的前提下追加新状态，不得通过随机新键掩盖重复工作或消息风暴。
- `normalized_input_hash`、`expected_source_constraints_hash` 和 `basis_event_ids_hash` 的生成方式必须 deterministic；同一输入集合的不同消费顺序不得产生不同幂等键。
- `gap_scope` 参与 hash 或 key 计算时，必须使用 canonical schema source 中冻结的稳定序列化形式；不得因 JSON 字段顺序、数组顺序或局部命名差异产生不同语义键。

`metric_input_completeness` 最小语义冻结如下：

- `missing_source_published_at_event_ids`
- `missing_primary_source_distance_event_ids`
- `missing_freshness_anchor_kind_event_ids`
- `missing_agent_relevance_event_ids`
- `missing_dedupe_key_event_ids`
- `reason_codes`

其作用不是重新打分，而是让 `normalization-agent`、`audit-agent` 和 weekly coverage 明确知道：哪些 event 缺 profile 计算前提、为什么缺、是否被补齐、是否被降级为 context、以及是否进入 rejected audit。

当前设计的 metric input 最小必填集冻结如下：

- `axis`
- `source.source_type`
- `source.primary_source_distance`
- `agent_relevance.state`
- `agent_relevance.score`
- `audit.dedupe_key`
- `source_published_at` 或稳定 `reason_code`

执行约束：

- 缺少上述最小必填集的 event，不得默认为 accepted supporting evidence；默认只能进入 rejected_event_batch 或 `context`。
- `freshness_anchor_kind`、`source.authority_tier`、`tool_route_id` 和 `citation_ref` 在当前设计中可缺，但缺失时必须进入 `metric_input_completeness`，并触发降级、补齐或 rejected audit。
- `normalization-agent` 可以补齐衍生字段，但不应承担开放式事实猜测；当前设计不得把 normalization 扩张成无限制的数据清洗层。

Agent 交互 DAG 冻结如下。该 DAG 是 `fan-out / fan-in` 结构：专责搜寻、registry review、audit 和补证默认都应支持并发批处理或异步队列化，不应被实现成全链单线程串行流水线。

```text
registry-agent
  -> registry_snapshot / tool_registry_snapshot
  -> broadcast tool_status_report

academic-agent / product-oss-agent / community-news-agent / finance-agent / policy-agent
  <- task_request + registry/tool snapshots
  -> evidence_batch + tool_status_report + agent_contribution
  [parallel fan-out]

normalization-agent
  <- evidence_batch[]
  -> normalization_result(normalized_event_batch, rejected_event_batch, merge_audit)

registry-review queue (async, batched by entity/materiality)
  <- normalization_result events with unknown/provisional actors
  -> registry_review_result

trend-agent (claim-builder pass)
  <- normalization_result + registry_review_result? + tool_coverage_report + project weekly artifacts
  -> claim_candidate_batch + claim_evidence_link_batch + claim_builder_audit

audit queue (async, parallel by claim batch / priority)
  <- claim_candidate_batch + claim_evidence_link_batch + normalization_result + registry_review_result? + supporting/counter events
  -> audit_result(counter_evidence_audit)

specialist-agent / registry-agent
  <- evidence_gap_request
  -> evidence_gap_result
  [parallel by gap_scope]

trend-agent (tier-decider pass)
  <- claim_candidate_batch + claim_evidence_link_batch + decision_context_artifact
  <- trend_decision_input
  -> claim_ledger
```

交互规则冻结如下：

1. 专责搜寻 Agent 只能输出 `evidence_batch`、`tool_status_report` 和 `agent_contribution`；不得直接输出 `IndustryTrendDecision`。它们可以标记 source-level supporting / counter cue，但不能越权定义 claim role。
2. `normalization-agent` 是所有 `IndustrySignalEvent` 进入 claim builder 前的唯一归一入口；trend-agent 不得直接消费 raw tool output。
3. `registry-agent` 负责 registry/tool snapshot 与 provisional authority review；其他 Agent 可以提出 `registry_review_request`，但不能自授权。
4. `trend-agent` 必须拆成 claim-builder pass 与 tier-decider pass：前者只能消费 `normalization_result`、`registry_review_result`、`tool_coverage_report` 和现有 project weekly artifacts，只生成 `claim_candidate_batch`、`claim_evidence_link_batch` 和 `claim_builder_audit`，不得输出最终 `decision_tier`、`claim_ledger`，也不得把缺失 metric input 解释成正式评分结论；后者必须在消费 `decision_context_artifact`（其中统一收敛 `audit_result`、`agent_contribution`、完整 coverage、可选 `evidence_gap_result` 和相关 normalization / registry 上下文）后才能生成 `claim_ledger`。
5. `claim-builder pass` 必须在进入 `audit-agent` 前折叠语义重叠的候选。该规则必须可执行，不能只凭标题相似度或人工语感判断：
   - 命中同一 overlap cluster 的条件固定为任一满足：
     - 共享同一 `candidate_group_id`；
     - `is_tier_material=true` 的 `claim_evidence_link_ids` 对应 `event_id` 集合完全相同；
     - `source_event_ids` 的 Jaccard overlap `>= 0.67`，且主支柱候选轴或 `proposed_claim_archetype` 指向同一方向；
     - 主要差异只体现在表述、命名或 supporting/context 取舍，而主支柱、关键独立交叉确认和 blocking path 指向同一证据结构。
   - overlap cluster 内只能保留一个 canonical candidate 进入 audit / tier-decider。canonical 选择顺序固定为：
     - 优先保留 `is_tier_material=true` links 更完整、且同时覆盖主支柱与关键独立交叉确认的候选；
     - 若仍并列，优先保留 material links 覆盖的 `fact_id` 更独立、`core/proven` 来源更多、`missing_axis_keys` 更少的候选；
     - 若仍并列，优先保留 `proposed_claim_archetype` 与主支柱证据结构更一致的候选；
     - 若仍并列，使用稳定 tie-break：`candidate_group_id` 或 `generated_claim_id` 的字典序最小者为 canonical。
   - 其余重叠候选不得并行进入多个 tier 竞争或重复占用审计产能；只能作为 `deferred` / `rejected` 候选、替代表述或 archetype 竞争记录留在 `claim_builder_audit` 中。
   - 每个被折叠的 overlap cluster 必须在 `claim_builder_audit` 中显式写出 `overlap_cluster_id`、`canonical_candidate_group_id`、`folded_candidate_group_ids` 与 `fold_reason_codes`；缺该留痕时，视为候选折叠未完成，不得进入 audit。
6. `audit-agent` 必须在 `claim_candidate_batch` 之后输出 `audit_result`；没有反证也必须输出空审计。审计对象必须包括 claim evidence links，而不只是原始 supporting / counter event 列表。`audit_result` 可以异步晚于部分低优先级 claim 的 tier-decider 调度，但任何缺失审计的 claim 都必须按 `IndustryClaimEvidenceLink.materiality_class` / `is_tier_material` 和 `FactResolutionAudit.high_impact_unresolved_groups.impact_scope` 显式降 `decision_confidence`、限权 public output，或阻断相应 tier；不得把“哪些 link 算 material”留给实现者自由裁量。
7. `trend-agent` 只能消费 `normalization_result`、`registry_review_result`、`claim_candidate_batch`、`audit_result`、`evidence_gap_result`、`tool_coverage_report`、`agent_contribution` 和现有 project weekly artifacts；不得发送搜寻型 `task_request` 给自己，也不得临时调用原始 provider。
8. 跨 Agent task 的失败、timeout、schema mismatch、关键输入缺失或 payload 被 rejected 时，必须发送 `failure_notice.v1`；`IndustryAgentContribution.status=failed/unavailable` 只能作为 weekly 贡献账本，不得替代 failure notice 或 message lineage。下游必须把缺口写入 missing/unavailable 状态，不能静默跳过。
9. 所有跨 Agent 输入输出必须有 `IndustryAgentMessageEnvelope`、`IndustryAgentArtifactManifest` 和匹配的 payload schema；只有 artifact 路径而没有 envelope / manifest / schema 的输出不得被下游消费。
10. 同一 `idempotency_key` 产生的重复 event 必须由 normalization-agent 去重，并在 `IndustryMergeAudit` 中记录。
11. 任何进入 tier-decider pass 的 claim candidate 必须能反查 `claim-candidate-batch.v1`、`claim_evidence_link_batch`、tool coverage 和 agent contribution；`audit-result.v1` 原则上必须存在，但若缺失仅默认触发 `decision_confidence` / `coverage_audit_state` 降级。只有当缺失审计命中 `is_tier_material=true` 的主支柱、关键独立交叉确认、`blocking_path`，或 `impact_scope=tier_blocking` 的未决组时，才不得输出 `core_industry_trend`。
12. `trend-agent` 不得直接用 `IndustrySignalEvent.source_polarity_cue` 充当最终 supporting / counter 裁决；必须先生成 `IndustryClaimEvidenceLink`，再由 `audit-agent` 基于该 link 审核依赖强度和替代关系。
13. `audit-agent` 对 `blocking/strong` 冲突拥有硬约束权；对 `medium/weak` 冲突输出降级建议，tier-decider 可以保留 tier，但必须降置信并写明原因。
14. 若 `trend-agent` 或 `audit-agent` 发现 claim 已接近升级门槛，但仅缺单个关键一手来源、主体归一或高权威补证，不得自行越权补采；只能发起 `evidence_gap_request` 给对应专责 Agent 或 `registry-agent`。
15. 每个 claim 在同一运行窗口内对同一 `gap_scope` 最多允许一次成功进入跨 Agent 补证回路；不同 `gap_scope` 的补证可以并发执行。重复补证必须复用 `correlation_id` 并提高 `retry_count`，防止无限递归。
16. `evidence_gap_result` 只能回填缺口、补齐 artifact 或明确失败原因；不得直接修改既有 claim tier，也不得绕过 audit 直接进入最终 ledger。
17. 若补证未完成、失败或超时，tier-decider 默认先保留下调后的 `decision_confidence` / `coverage_audit_state`，并把剩余缺口写入 `missing_axes`、`not_complete_unless` 或对应审计 reason code；其中 `missing_axes` 只承载 `required` gap。只有当补证缺口命中主支柱、关键独立交叉确认或 blocking 路径时，才直接下调 `decision_tier`。
18. `trend-agent` 与 `audit-agent` 在处理 `merged_provisional`、`singleton_unresolved` 或 `conflicted` 事实组时，必须显式消费 `FactResolutionAudit`；不得把“没有稳定 fact_id”直接等价成“事件无效”，也不得把 provisional 组直接当成完整独立事实。

补充冻结：

- `claim-builder pass` 必须为每个 claim 产出 `proposed_claim_archetype`；`tier-decider pass` 必须产出 `adjudicated_claim_archetype`。若二者不一致，必须写入 `archetype_revision_reason_code`，并把 revision 依据挂到 claim lineage。
- `registry-agent` 的阻断权仅限 authority / registry 域：它可以阻断主体晋升为 `core/proven/provisional_authority`，但不得单独否定 claim 存在本身或直接改写 `decision_tier`。
- `audit-agent` 的阻断权仅限 tier / public output 域：只有命中主支柱、关键独立交叉确认或高影响反证时，才可触发 `tier_blocking`；其余情况默认输出 `followup_required`，并在需要限制公开消费时标记 `impact_scope="public_output_only"`。
- `trend-agent` 在最终 ledger 中必须同时输出 `decision_tier`、`decision_confidence` 和 `coverage_audit_state`；不得再用单一 tier 降级混写证据语义与流程完整度。
- `trend-decision-input.v1` 与 `decision_context_artifact_ref` 的边界必须保持稳定：上游 audit、registry、coverage、contribution 或 normalization 的局部字段变化，不得直接要求 tier-decider、ledger、weekly packager 一起跟着联改。

### `coalesce-before-parallelize`

并发不是先把消息放大，再让下游背压。当前设计补充冻结：任何会消耗高成本或共享稀缺资源的请求，必须先聚合，再并发。

执行约束：

- `finance_official_fetch_pool`、`policy_official_fetch_pool`、`registry_review_pool`、`audit_pass_pool`、`manual_review_pool` 和等价稀缺资源的请求，必须先按 `candidate_group_id`、`claim_family_key`、`gap_scope`、`entity_batch_id` 或等价稳定键合批。
- 同一 `claim_family_key` 下的语义重叠候选，必须先完成 fold / admission，再决定是否 fan-out 到 finance、policy、registry 或 audit；不得让重复 claim 各自抢占高成本槽位。
- 同一 `gap_scope` 的重复补证请求必须 merge 或 supersede；不得因为多个下游组件同时感到“还差一点”就生成一串并发追单。
- 只有完成聚合、预算仲裁和共享池分配后，才允许进入并发执行队列；不得把队列本身当作仲裁器。

### 运行时间层与 same-run 准入

完整能力目标不变，但 weekly run 只负责本轮裁决所需的关键闭环。当前设计与 [产品表面与生产治理](01-产品表面与生产治理.md) 对齐如下：

| 时间层 | 本章对应 stage | same-run 约束 |
| --- | --- | --- |
| `day-level prerequisite` | 专责搜寻、tool route、normalization、普通 registry review、daily pack | 默认应在 weekly 前完成并落成 canonical artifact |
| `weekly decision-critical` | claim-builder、material audit、少量 single-gap 补证、tier-decider、weekly packager | 只处理 admitted claim 的关键闭环；不负责长尾治理扫尾 |
| `post-weekly governance` | `P1/P2` review、长尾 authority 清洗、watchlist 追扫、显式 rerun backlog | 进入后续窗口或 rerun，不静默改写当前发布结果 |

冻结规则：

- same-run blocking 产能只保留给命中 `tier_blocking`、`impact_scope=public_output_only`、`blocking_output_scope="public_output"`、authority hold 或正在阻断既有 headline core 的事项。
- 未命中这些条件的缺口，不得为了“同轮做完”而无限等待；默认先体现在 `decision_confidence`、`coverage_audit_state`、`consumer_readiness_state` 或公开分桶上。
- finance / policy / academic 深查的常规材料应尽量前置到 `day-level prerequisite`；weekly 只允许为少量 admitted claim 触发 single-gap 补证。

补充冻结：

- same-run 归一与 owner 仲裁的关键通道只保留给以下事项：`tier_blocking` 未决组、`impact_scope="public_output_only"` 的公开阻断、正在影响既有 headline core 的事实归属争议，以及会改变主支柱 direct fact owner 的高影响 owner ambiguity。
- 其余 source-chain 清洗、长尾 provisional merge、非 headline 的 owner 微调和普通 fact regroup，默认进入 `post-weekly governance` 或显式 rerun；不得挤占 same-run 关键归一产能。

### 受控补证回路

当前设计允许存在“受控补证”，但不允许 `trend-agent` 自行变成搜寻 Agent。补证回路只用于修复接近升级门槛的关键缺口，而不是让下游无限追数。

补证触发条件冻结如下：

1. claim 已满足大部分升级条件，仅缺单个关键一手来源、关键主体 authority review、或单个 leading axis 的高权威确认。
2. 缺口必须可被结构化表达为 `missing_axis_keys`、`gap_reason_code` 和 `expected_source_constraints`，不能只写“感觉证据不够”。
3. 发起方只能是 `trend-agent`、`audit-agent` 或 `registry-agent`。
4. 接收方只能是对应专责搜寻 Agent 或 `registry-agent`；不得广播给多个 Agent 抢写同一 `gap_scope`，但不同 `gap_scope` 允许并发补证。

补证执行约束：

1. `evidence_gap_request` 不是新的自由任务系统，它只允许针对既有 claim 的局部缺口补证。
2. 被请求 Agent 只能围绕 `expected_source_constraints` 补齐指定缺口，不能顺手扩张 claim 范围或重写整体叙事。
3. 通过补证回路获得的新 evidence 仍必须经过 normalization、merge audit、必要时的 registry review，再重新进入 tier-decider。
4. 若补证改变了 claim 的关键 supporting / counter 结构，`audit-agent` 必须重新确认受影响的 claim links；不得用旧 audit 直接套新证据。

### `claim-admission-budget-profile.v1`

same-run 审计与补证产能不是无限的，但 admission budget 只能限制“本轮优先处理谁”，不能改写内部 tier 事实。当前设计冻结以下 admission policy：

`ClaimAdmissionAssessment` 在协作层的作用冻结如下：

- claim-builder pass 在完成 candidate fold 后，必须为每个 admitted / candidate claim 产出 `ClaimAdmissionAssessment` 或等价 canonical artifact。
- coordinator、shared pool allocator、queue dispatcher、audit queue 和 gap follow-up queue 只能基于该 assessment 做 same-run admission、排序和配额决策；不得本地重算另一套 projected tier / readiness / cost。
- assessment 一旦被 refresh，必须通过显式 supersede lineage 替代旧 assessment；不得让不同队列各自持有不同版本的 admission 预估。

- 每个 claim candidate 必须先被分入以下三类之一：
  - `critical_headline`：当前 projected tier 已达 `core_industry_trend`，或正在阻断既有 headline core 的 public-safe / authority / blocking counter evidence 问题。
  - `high_priority`：距离 `core_industry_trend`、`observing_industry_trend` 或 `wind_probe` 仅差一个 material audit / authority / single-gap canonical fetch 的候选。
  - `deferred_followup`：其余长尾候选、低价值重复候选或本轮即使补证也不会改变 headline/主叙事的候选。
- 默认 same-run 预算地板冻结为：`critical_headline <= 3`、`high_priority <= 6`；`deferred_followup` 不设 same-run 处理数量上限，但每个实例都必须被路由到受控 backlog bucket，且默认不占用 same-run blocking 审计与补证产能。
- admission 排序顺序固定为：`ClaimAdmissionAssessment.projected_consumer_readiness_state`、`ClaimAdmissionAssessment.projected_consumer_display_priority`、`ClaimAdmissionAssessment.projected_decision_tier`、是否命中 `blocking_path` / `public_output` 风险、`key_independent_confirmation` 完整度、freshness、稳定 tie-break（`claim_id` / `candidate_group_id` 字典序）。
- 超出 same-run admission budget 的候选，不得被静默丢弃、改写为 rejected，或强行降成更低事实 tier；只能保留在 internal ledger、`watchlist_only`、`needs_review`、`insufficient_evidence` 或下一轮 follow-up 队列中。

补充冻结：

- same-run admission budget 必须与 [产品表面与生产治理](01-产品表面与生产治理.md) 中的 `claim-runtime-budget-profile.v1` 联动执行；claim admission 不是只看条数，还必须看该候选是否还有足够 official fetch、registry review、audit slot 和 manual review 预算。
- 当 `critical_headline` 或 `high_priority` claim 之间争抢同一稀缺资源时，排序必须先看 claim-level 剩余预算与潜在收益，再看轴级扩张空间；不得出现低价值 claim 先耗尽高价值 claim 的 canonical fetch 槽位。

### `backlog-compaction-policy.v1`

deferred、watchlist、gap follow-up 和失败通知如果只追加不压缩，热点周会把协作层拖成消息与待办风暴。当前设计补充冻结 backlog 压缩策略：

每类 backlog bucket 至少必须定义：

- `merge_key`
- `supersede_rule`
- `ttl_by_bucket`
- `archive_trigger`
- `reopen_conditions`

默认 backlog taxonomy 冻结如下：

| bucket_id | 默认用途 | 默认 TTL / 关闭窗口 | 是否占 same-run 关键产能 | owner |
| --- | --- | --- | --- | --- |
| `same_run_blocking_gap` | 正在阻断 headline / `tier_blocking` / `public_output_only` 的高影响缺口 | 截止 `publication_snapshot_at` | 是 | 当前 admitted claim 的 coordinating role |
| `next_run_followup` | 本轮未入 same-run，但下一轮仍值得补证的 admitted claim 缺口 | `14d` | 否 | 对应 claim owner / requesting Agent |
| `watchlist_monitoring` | 方向观察、长尾线索、低价值重复候选 | `30d` | 否 | watchlist / discovery owner |
| `registry_pending` | provisional authority、alias/实体治理、长尾 registry review | `14d` | 否 | `registry-agent` |
| `manual_review_pending` | `P0/P1/P2` 人工复核债务 | `P0=current_run`、`P1=24h`、`P2=14d` | 仅 `P0` 默认占用 | review queue owner |
| `archived_context_debt` | 已过活跃窗口但需保留 lineage 的历史债务 | `180d` 或直到显式 reopen | 否 | 对应治理对象 owner |

执行约束：

- 任何 backlog item 若没有 `bucket_id`、TTL、merge_key 和 owner，就不得入账；禁止使用无限兜底的“deferred list”。
- 同一 `claim_family_key` 下重复出现的 `deferred_followup` 候选，默认必须聚合成同一 backlog family entry；不得无限并列生成语义重复条目。
- 同一 `claim_id + gap_scope` 的补证请求默认必须 merge 或 supersede；除非 `expected_source_constraints` 发生实质变化，否则不得为同一缺口反复生成独立待办。
- `failure_notice`、长尾 registry review 和 watchlist 线索允许按稳定 `merge_key` 聚合计数，但 compaction 不得删除 canonical lineage、artifact refs、reason codes 或审批留痕。
- 过期的长尾 backlog 只能进入带 `archive_trigger` 与 `reopen_conditions` 的 archive bucket；不得简单物理删除，更不得让下一轮因为历史上下文缺失而重复从零生成同一债务。
- reopen 必须由显式条件驱动，例如：material late result、authority state 变化、headline 受影响或 `expected_source_constraints` 升级；不得因为“又看到了类似新闻”就无限抖动重开。

### same-run snapshot 冻结

为避免同一周因异步结果先后顺序不同而产出不同结论，weekly run 必须冻结显式 snapshot 边界：

- 每次 weekly 必须记录 `fact_snapshot_cutoff_at`、`claim_admission_cutoff_at`、`authority_snapshot_cutoff_at`、`audit_snapshot_cutoff_at`、`publication_snapshot_at` 和 `review_availability_snapshot`，并写入 `WeeklyIndustryTrendSection.run_snapshot`。
- `run_snapshot` 还必须能反查本次 weekly 实际消费的 `fact_partition_snapshot_refs` 或等价 partition close refs，证明哪些 partition 已关闭、哪些 partition 被延后。
- `claim-builder` 只能消费 `fact_snapshot_cutoff_at` 前已经关闭并落账的 `FactResolutionAudit.snapshot_id`；owner transfer、attestation 合并或主语义改写若晚于该 cutoff，只能进入下一 run 或显式 rerun。
- `trend-agent` 的 tier-decider pass 只能消费各自 cutoff 前已完成并落账的 `registry_review_result`、`audit_result`、`evidence_gap_result` 和 tool coverage；不得一边生成 weekly、一边继续无边界吸收晚到结果。
- 在 `publication_snapshot_at` 之前晚到、且命中已 admitted claim 的结果，只允许重开该 claim 的 tier-decider，不允许无审计地局部改文案。
- 晚于 `publication_snapshot_at` 的 registry / audit / gap 结果，不得静默改写已发布 weekly；只能进入下一次 regular weekly，或产生带 supersede audit 的显式 rerun。
- 同一 claim 在同一 run 中最多允许一次 “late-result reopen”；再次晚到的结果必须进入下一 run 或显式 rerun，防止 claim 在本轮无限抖动。

### `reopen-impact-matrix.v1`

late-result reopen 不能只定义“最多重开几次”，还必须冻结“哪些 claim 会被一起重开、哪些只能下轮生效”。当前设计补充冻结如下：

| 晚到变化命中范围 | 当前 run 动作 | 执行约束 |
| --- | --- | --- |
| 命中 `material_claim_evidence_link_ids` | 允许触发一次 same-run reopen | 必须把所有受影响 claim 写入统一 `affected_claim_ids`，并复用同一 reopen lineage。 |
| 命中 `key_independent_confirmation_link_ids` | 允许触发一次 same-run reopen | 视为会改变 core / observing 边界的高影响变化，不得只局部改一张 card。 |
| 只影响 `supporting_axes`、`decision_confidence` 或 `coverage_audit_state` | 不得 reopen 当前已发布 claim；只能下轮生效或进入显式 rerun | 允许更新治理摘要、follow-up 或 next-run backlog，但不得回写当前 run 的 tier 结果。 |
| 只影响 `consumer_readiness_state` / `public_output_only` 风险 | 允许限制 public projection，但不得重算底层 tier | 必须通过 `blocked_public_output`、review 或 supersede projection 显式暴露。 |

执行约束：

- 同一晚到 fact / audit / registry 结果若影响多个 claim，`normalization-agent`、`audit-agent` 或协调层必须输出统一 `affected_claim_ids` 与单一 reopen / supersede 决策；不得让各 claim 各自独立猜测是否重开。
- reopen 判断必须优先锚定 `material_claim_evidence_link_ids`、`key_independent_confirmation_link_ids`、`impact_scope` 和既有 snapshot lineage；不得仅按“这个结果看起来重要”做临时人工判断。
- 若晚到变化只命中 supporting 或 confidence-only 层，系统默认保留当前 claim，在下一 run 或显式 rerun 中再吸收；不得为了追求同步而扩大 current-run reopen 范围。

### 并发与异步裁决原则

周级批处理不得默认实现成“所有 claim 共享一条串行审计流水线”。设计冻结以下并发与异步原则：

1. 专责搜寻 Agent 默认并发 fan-out；finance、policy、community、academic、product-oss 不应互相串行等待。
2. `registry-agent` 的 authority review 必须支持按 entity batch / materiality 异步处理；长尾主体不得阻断主 weekly。
3. `audit-agent` 必须支持按 claim batch / priority 并发审计；高优先级 core 候选与长尾 observing 候选不得共用单一串行队列。
4. 补证回路必须按 `gap_scope` 异步化；不同缺口允许并发，单一缺口只做去重。
5. `core` 候选、public output 风险、authority 晋升和长尾 follow-up 必须拆成不同优先级队列；不得让低影响争议拖住高影响裁决。
6. 若审计/registry 产能不足，系统默认先在 `decision_confidence` 和 `coverage_audit_state` 上显式暴露，而不是把大批边界 claim 一律静默压回 `observing`。
7. `normalization-agent` 必须支持按 `fact_partition_id` / `claim_partition_id` 并发结算；headline partition 与长尾 partition 不得共用单一串行关闭路径。
8. `shared-capacity-policy.v1` 中定义的共享资源池必须作为并发调度前置约束；并发 fan-out 不能绕过共享池仲裁直接占满 finance / policy / audit / review 稀缺产能。

### `main coordinator` 边界

当前设计不建议引入一个拥有实质语义裁决权的“总指挥 Agent”。如果需要单独的协调层，它只能是薄编排角色，而不是第二个语义大脑。

允许的协调职责：

- run kickoff、snapshot publication、deadline / timeout 驱动
- `claim-admission-budget-profile.v1`、`claim-runtime-budget-profile.v1`、`run-critical-path-budget.v1`、`micro-task-runtime-budget-profile.v1`、`micro-task-cost-profile.v1`、`shared-capacity-policy.v1` 的仲裁触发与排队
- queue dispatch、backpressure、late-result reopen / rerun 编排
- 汇总 `failure_notice.v1`、运行态容量和窗口状态

禁止承担：

- 直接产出 accepted event、registry review 结果、owner arbitration、audit 结论或 `decision_tier`
- 维护一套只存在于 coordinator 内存中的私有事实状态，绕过 canonical artifact
- 发明第二套 schema、reason code 或消息路由语义

补充说明：

- 若实现层引入 `main coordinator`，它应被视为 middleware / scheduler role，而不是第 10 个语义 Agent；主设计冻结的 9 个实际 Agent 与 15 个职责项不因此改变。
- 协调层的所有决定都必须落回 envelope、manifest、budget arbitration record、snapshot cutoff 或 failure notice 等显式 artifact；否则视为不可审计的隐藏耦合。

### `runtime-concurrency-control-policy.v1`

仅有“允许并发”还不够；如果没有统一的调度粒度、在途上限和背压动作，系统仍会在热点周被 fan-out、补证风暴和消息放大拖垮。当前设计补充冻结统一并发控制策略：

每类并发队列至少必须定义：

- `queue_class`
- `scheduling_key`
- `runtime_budget_profile_id`
- `cost_budget_profile_id`
- `max_inflight_items`
- `max_batch_size`
- `coalesce_strategy`
- `backpressure_action`
- `late_result_policy`

默认队列类至少包括：

- `search_fanout_queue`
- `normalization_partition_queue`
- `registry_review_queue`
- `audit_queue`
- `gap_followup_queue`
- `packager_projection_queue`

默认并发数值地板冻结如下。ExecPlan 可以收紧，但不得在没有容量审计与热点周回放证据时放宽：

| `queue_class` | `max_inflight_items` | `max_batch_size` | 默认 `backpressure_action` |
| --- | ---: | ---: | --- |
| `search_fanout_queue` | `24` | `6` | `coalesce` |
| `normalization_partition_queue` | `6` | `2` | `queue` |
| `registry_review_queue` | `4` | `8` | `queue` |
| `audit_queue` | `4` | `6` | `downgrade_confidence_or_readiness` |
| `gap_followup_queue` | `3` | `2` | `defer_followup` |
| `packager_projection_queue` | `2` | `2` | `queue` |

执行约束：

- 调度粒度必须优先使用 `fact_partition_id`、`claim_partition_id`、`candidate_group_id`、`gap_scope`、`entity_batch_id` 或等价稳定键；不得默认按单个 event 进行全链路 fan-out。
- queue admission 必须直接消费 envelope 中冻结的 `scheduling_key`、`claim_partition_id`、`candidate_group_id` 与 `dispatch_context_ref`；最多校验其与 `same-run-dispatch-context.v1` 一致，不能在字段缺失时通过解引用其他 artifact 或本地重算补齐。
- 调度器必须同时考虑 `runtime_budget_profile_id`、`cost_budget_profile_id`、`estimated_cost_units` 和 `critical_path_class`；不得只按队列条数或 worker 空闲与否决定是否放行高成本任务。
- 同一 `claim_partition_id` 在同一 run 中，默认最多允许一个活动中的 normalization close、一个活动中的 audit batch 和一个活动中的 claim-critical gap follow-up；其余请求必须合批、排队或 supersede，避免同一 claim 被并发重算。
- `registry-agent`、`audit-agent`、`normalization-agent` 的入队必须先经过 `claim-admission-budget-profile.v1` 与 `shared-capacity-policy.v1` 仲裁；不得先 fan-out 占满队列，再由下游事后丢弃。
- 当 `max_inflight_items` 或共享池容量触顶时，默认背压动作只能是 `queue`、`coalesce`、`defer_followup`、`downgrade_confidence_or_readiness` 或 `needs_review`；不得通过无限放大 timeout、复制 worker 或静默丢 lineage 来“顶住流量”。
- `coalesce_strategy` 必须优先按 claim family、gap scope、entity batch 或重复 failure notice 聚合；不得允许同一热点话题生成大量语义重复的小消息去争抢同一稀缺资源。
- `late_result_policy` 必须与 same-run snapshot cutoff 对齐；晚到结果只能进入显式 reopen、下一 run 或 rerun，不能绕过 snapshot 栅栏直接插队改写已冻结 claim。
- 并发控制策略属于运行时硬契约；不同实现可以使用 CLI pipeline、DAG runner 或消息队列承载，但不得改变这些 scheduling key、背压语义和队列类的外部可审计口径。

### `headline-capacity-policy.v1`

headline capacity 只限制用户表面的核心位，不得反向篡改 claim ledger 的事实判断。当前设计冻结如下：

- 公开 weekly 的 `headline_core_card_ids` 默认展示预算为 `3`；`provisional_core_watchlist_card_ids` 默认展示预算为 `5`。
- headline 选择顺序必须先用 `consumer_readiness_state`、再用 `consumer_display_priority`、再用 `decision_tier`、`decision_confidence`、freshness 与关键独立交叉确认数量；不得直接按文案吸引力、热度词或编辑主观偏好排序。
- 超出 headline capacity 的 `core_industry_trend` claim 不得被改写为 `observing_industry_trend`；只能保留其内部 tier，并在 surface 上下沉为 `secondary_candidate`、`provisional_core_watchlist` 或 `watchlist_only`。
- 存在 `blocked_public_output`、未关闭 `P0` review、未过 public-safe 或命中 authority hold 的 claim，不得占用 public headline slot，即使其内部 tier 仍为 `core_industry_trend`。
- headline capacity 只约束公开 surface；internal weekly 可以保留更多 `core_industry_trend` ledger/card，用于审计、复核和下一轮 rerank。

### Daily / Weekly 打包产物约束

`DailyIndustryEvidencePack` 与 `WeeklyIndustryTrendSection` 属于运行时打包产物，而不是新的事实来源。它们可以由 `registry-agent`、weekly output stage、run-summary stage 或等价 packager 生成，但 packager 只能做索引、聚合、公开投影和状态归纳，不得新增事实、改写 axis judgement、补造 lineage 或重算 trend decision。

对齐 [运行输出与安全](07-运行输出与安全.md) 的执行约束如下：

- `DailyIndustryEvidencePack` 必须采用轻索引形态，显式输出 `run_id`、`window_start`、`window_end`、`source_message_ids`、`input_artifact_refs`、`normalized_event_batch_ref`、`rejected_event_batch_ref`、`public_projection` 和 `cost_and_degradation_summary`；不得再次内嵌 accepted / rejected 全量事件。
- `RollingEvidenceWindowSnapshot` 是 runtime carry-forward artifact；它只能从既有 daily packs、claim ledger、fact snapshot 和审计结果中提炼当前仍可继承的历史证据，不得反向发明新事实或绕过当前窗口的阻断规则。
- `WeeklyIndustryTrendSection` 必须显式输出 `lineage_refs`、`run_budget_summary`、`run_snapshot` 和 `display_index`，并确保 tier 分区与 `display_index` 来自同一 ledger snapshot；其中 `run_budget_summary` 还必须暴露 run 级总成本与 same-run review availability 摘要，`run_snapshot` 必须保留该次 review availability snapshot。缺少 `claim_candidate_batch_ref`、`claim_admission_assessment_refs`、`decision_context_artifact_refs` 或 `trend_decision_input_ref` 时，packager 不得生成 public `display_index.headline_core_card_ids`，必须改为 `display_index.provisional_core_watchlist_card_ids`、`display_index.needs_review_card_ids`、降级投影或非 core public projection，而不是否定内部 claim ledger 已保留的 tier 候选。
- 若 lineage 缺口只命中 public-ready 或 headline admission 前提，而未命中 `consumption_boundary.internal_consumption_state="blocked"`、`impact_scope=tier_blocking` 或主支柱级事实阻断，packager 允许继续保留 internal tier 分区中的 card/ledger 引用；但这些对象必须同时被打上 `consumer_readiness_state!="ready"`、`publication_readiness_status!=ready` 或等价的 machine-readable 降级状态。实现不得把“不能公开 headline”误写成“内部 tier 也不存在”。
- `WeeklyIndustryTrendSection` 之外，packager 还必须生成独立的 `ConsumerWeeklyIndustryView` 或等价 consumer projection，供产品/UI/API 消费；该 projection 只能重组消费分桶、排序和必要摘要，不得替代 internal canonical section。
- `PublicWeeklyIndustryProjection` 是从 `WeeklyIndustryTrendSection` 派生的独立 public artifact。任何 public consumer 只能读取它或其显式投影 refs，不得直接消费 internal `core_industry_trends`、`observing_industry_trends` 或 `display_index` 自行拼装公开输出。
- weekly packager 只能消费 canonical artifact：daily pack、normalization result、registry review、audit result、claim ledger、tool coverage、agent contribution 和既有 project weekly artifacts；不得回头读取 provider raw input。
- packager 可以生成 consumer-facing projection 和 public projection，但不得回写 event、fact、audit、claim link、owner transfer 或 trend decision 字段。
- `IndustryTrendCard` 的 `freshness_summary` 必须由已归一 event 的 anchor 与 freshness profile 计算得出；packager 不得把 `observed_at`、`ingested_at` 或 run date 伪装成 freshness anchor。
- `decision_tier="core_industry_trend"` 但 `consumer_readiness_state!="ready"` 的 claim，不得被 packager 直接放进 headline core；至少要降到 provisional watchlist、needs-review 或 blocked/suppressed bucket。
- 任何 public artifact 都必须是独立 projection：internal artifact 与 public artifact 必须拥有不同 `artifact_ref`、`content_hash` 和 `storage_path`；只允许通过 `public_projection_artifact_ref` 建立关联。
- daily / weekly packager 若发现 daily pack 的 visibility、lineage、budget 或 degraded-axis 元数据不合法，必须产出 `failure_notice.v1` 或把窗口状态降为 `failed/partial`，而不是静默继续生成正常 weekly。

现实吞吐约束：

- `registry-agent + audit-agent` 的双审只应用于可能影响 `core_industry_trend`、`observing_industry_trend`、`wind_probe` 分层，或会提升主体到 `core/proven/provisional_authority` 的 unknown actor / provisional actor。
- 其余未入 registry 的长尾主体，默认按 `watch / ordinary` 处理，不因未完成双审而阻断主 weekly。
- `finance-agent`、`policy-agent`、`registry-agent`、`audit-agent` 的产能不足默认视为并发与优先级调度问题，而不是默认把所有边界 claim 打回低 tier；系统应优先保留 tier 候选并显式下调 `decision_confidence` / `coverage_audit_state`。
- `failure_notice.v1` 默认允许在同一 `run_id + responsibility_id + reason_code + correlation_id` 下聚合；重复失败应优先 supersede 现有 notice 或在聚合 payload 中追加计数，而不是无限新增独立 notice。
- 工具批量限流、上游 schema 漂移或统一输入缺失时，ExecPlan 应优先产生 stage-level 聚合 failure notice，而不是为每个 event 生成一条失败消息。

### 写权限与协作边界

为避免多人并行实现时各模块都“顺手改一点 canonical artifact”，本章与 [数据模型契约](03-数据模型契约.md) 中的 `field-ownership-policy.v1` 对齐补充如下：

- 专责搜寻 Agent 只能 authoritative 写入 producer fields；不得改写 `fact_id`、owner arbitration、`counter_evidence_severity`、`decision_tier`。
- `normalization-agent` 只对 fact / owner / source-chain authoritative；不得直接写 `decision_tier`、`counter_evidence_severity` 或 public headline 分桶。
- `audit-agent` 只对反证、blocking、冲突限权 authoritative；不得改写原始 source metadata、producer raw refs 或 owner transfer 历史。
- `trend-agent` 只对 claim-level decision authoritative；不得回写 producer-only 或 normalization-authoritative 字段。
- weekly packager / consumer projection stage 只能读 canonical artifact 并生成 projection；不得回写任何 judgment 字段。
- 任何跨边界修改若需人工介入，必须通过 `HumanReviewQueueItem` / `OverrideAudit` 显式落账，而不是直接改 artifact 内容。
- `trend-agent` 内部若拆为 claim-builder pass 与 tier-decider pass，二者必须通过独立 artifact 或等价 canonical checkpoint 隔开：claim-builder pass 只写 claim candidate / claim evidence link / fold audit，tier-decider pass 只在消费 audit result 后写 decision fields。
- claim-builder pass 不得提前写 `decision_tier`、`decision_confidence` 或 headline 分桶；tier-decider pass 不得回写 `fact_id`、owner arbitration、`source.*` 原始元数据或 producer raw refs。

补充解耦约束：

- 跨 Agent、跨模块、跨团队协作时，只允许通过 message envelope、payload schema、artifact manifest 和 canonical refs 交接；不得直接读取其他模块的私有缓存、私有数据库表、临时文件路径、prompt memory 或未登记 helper 输出。
- 模块之间的稳定接口必须是 artifact-first，而不是函数调用优先；即使多个 Agent 暂时运行在同一进程内，也不得把进程内函数签名当成长期协作边界。
- 一个模块的内部重构如果不改变其 canonical output schema，就不应要求相邻模块同步改实现；若必须联改，说明边界仍然耦合，应回到真源章节修正契约。
- 任何需要跨模块共享但尚未进入 canonical schema 的信息，默认只能留在 owner 模块内部；一旦需要被第二个模块依赖，就必须先升级为真源契约，而不是以“先约定一下字段名”方式扩散。

### 中间件采用策略

本设计鼓励复用成熟中间件，但中间件只能承载校验、执行、编排、工具接入和观测，不能替代本文冻结的 evidence、message、artifact、audit 和 trend decision 语义。所有中间件输出都必须最终落为 `IndustryAgentMessageEnvelope`、`IndustryAgentArtifactManifest`、`IndustrySignalEvent`、`IndustryClaimLedger` 或相关 canonical artifact。

目标态采用策略冻结如下：

| 类别 | 推荐中间件 / 框架 | 默认采用条件 | 适合承担 | 不得承担 |
| --- | --- | --- | --- | --- |
| Schema 校验 | JSON Schema、Zod、TypeBox | 目标态默认采用 | 校验 message、event、manifest、ledger、weekly section 的结构与枚举 | 不得把 schema 放宽成自由 JSON；不得替代业务裁决规则 |
| 工具 / connector 协议 | MCP、专用 connector、官方 SDK / API adapter | 目标态默认采用 | 统一接入网页、GitHub、论文、金融、政策、社区等工具输出 | 不得直接产出趋势等级；不得绕过 normalization-agent |
| 本地 artifact 存储 | JSONL / JSON artifact、content hash、manifest index | 目标态默认采用 | 保存 message、manifest、daily pack、claim ledger、tool coverage report | 不得只保存框架内部状态而不落 canonical artifact |
| Observability / tracing | OpenTelemetry、Langfuse 或等价 trace store | 建议采用 | 记录调用链、耗时、失败、token/cost、Agent route | 不得替代 `IndustryAgentContribution`、`AxisToolCoverageReport` 或 audit artifact |
| Agent DAG / 状态图 | LangGraph 或等价 DAG runner | 当本地 pipeline 难以稳定表达并发、重试与状态转移时采用 | 执行多 Agent DAG、条件分支、重试和状态转移 | 不得把 LangGraph state 当作唯一事实源；必须同步写 envelope / manifest |
| Workflow 编排 | Temporal、Prefect、Dagster | 当 backfill、长任务恢复或跨服务协调成为硬需求时采用 | 定时、重试、依赖、backfill、失败恢复、长任务编排 | 不得为了引入编排框架而弱化 artifact-first pipeline |
| 低代码工作流 | n8n、Activepieces | 可作为外围 connector | 快速接入外部 API、通知、轻量任务触发 | 不得作为核心趋势判断引擎或证据账本 |
| 多 Agent 对话框架 | AutoGen、CrewAI 等 | 默认不作为核心依赖 | 可用于实验性搜寻或草稿型外部 Agent | 不得替代固定职责、message envelope、audit 和 rules-first decision |
| 消息队列 | Kafka、RabbitMQ、NATS、Redis Streams | 仅在跨服务异步成为硬约束时采用 | 跨服务异步消息、高并发、实时流式处理 | 当前 daily/weekly batch 不得因消息队列引入不可审计内部状态 |

采用规则：

1. 优先复用 schema 校验、connector、tracing 和可选 DAG runner，避免重复造轮子。
2. 默认以文件 artifact + manifest + CLI pipeline 为 canonical runtime；只有当重试、并发、backfill 或跨服务部署复杂度超过本地 pipeline 时，才引入 Temporal / Prefect / Dagster 等编排层。
3. 任何中间件的内部 state、trace、memory、conversation 或 workflow run 都不是事实源；事实源只能是本文定义的 canonical artifact。
4. ExecPlan 如选择某个中间件，必须写清楚它映射到哪个本文 schema、产出哪些 artifact、失败时如何降级，以及如何测试“不绕过 envelope / manifest / audit”。
5. 中间件替换不得改变 public schema；更换 LangGraph、Temporal、MCP server 或 tracing provider 不应改变 `IndustrySignalEvent`、`IndustryAgentMessageEnvelope` 或 `IndustryClaimLedger` 的语义。

`IndustryAgentContribution` 协作摘录（canonical source: [03-数据模型契约](03-数据模型契约.md)）：

```ts
type IndustryAgentId =
  | "academic-agent"
  | "product-oss-agent"
  | "community-news-agent"
  | "finance-agent"
  | "policy-agent"
  | "registry-agent"
  | "normalization-agent"
  | "audit-agent"
  | "trend-agent";

type IndustryResponsibilityId =
  | "research-frontier"
  | "conference-academic"
  | "product-platform"
  | "developer-studio"
  | "cn-community"
  | "global-community"
  | "project-oss"
  | "capital-finance"
  | "policy-regulatory"
  | "policy-research-thinktank"
  | "news-pr"
  | "registry-governance"
  | "evidence-normalization"
  | "counter-evidence-audit"
  | "trend-synthesis";

interface ExecutionContext {
  primary_responsibility_id: IndustryResponsibilityId;
  default_owner_agent_id: IndustryAgentId;
  operational_executor_id: IndustryAgentId;
  takeover_mode: "none" | "delegated_execution" | "temporary_backfill" | "emergency_manual";
  takeover_audit_ref?: string;
}

interface IndustryAgentContribution {
  responsibility_id: IndustryResponsibilityId;
  handled_by_agent_id: IndustryAgentId;
  execution_context: ExecutionContext;
  status: "ok" | "partial" | "skipped" | "failed" | "unavailable";
  covered_axes: IndustryEvidenceAxisKey[];
  event_count: number;
  accepted_event_count: number;
  assisted_event_count: number;
  rejected_event_count: number;
  counter_event_count: number;
  diagnostic_event_count: number;
  metric_input_gap_count: number;
  unscorable_event_count: number;
  profile_blocked_event_count: number;
  input_artifact_refs: string[];
  output_artifact_refs: string[];
  tool_route_ids: string[];
  status_reason?: string;
  contribution_summary_cn: string;
}
```

本节仅为协作语义摘录；若与 [03-数据模型契约](03-数据模型契约.md) 冲突，以 `03` 为准。

`IndustryAgentContribution` 关键字段在协作层的约束如下：

| 字段 | 类型 / 取值 | 含义 | 执行约束 |
| --- | --- | --- | --- |
| `responsibility_id` | `IndustryResponsibilityId` | weekly 必须交账的职责项。 | 15 个职责项每周都必须出现一条 contribution record。 |
| `handled_by_agent_id` | `IndustryAgentId` | 实际执行该职责项的 Agent。 | 默认等于该职责项的默认执行 Agent；若发生受控 takeover，可以不同于职责表中的默认 Agent，但必须与 `execution_context.operational_executor_id` 一致，并且能反查 `takeover_audit_ref`。不得为了维持静态职责表而回填默认 Agent。 |
| `execution_context` | `ExecutionContext` | 该职责项的 owner / executor / takeover 上下文。 | `execution_context.operational_executor_id` 必须与 `handled_by_agent_id` 一致；发生 takeover 时必须能反查 `takeover_audit_ref`。 |
| `status` | `ok` / `partial` / `skipped` / `failed` / `unavailable` | 职责执行状态。 | `ok` 表示完整覆盖；`partial` 表示部分覆盖且需说明缺口；`skipped` 表示按规则跳过；`failed` 表示尝试失败；`unavailable` 表示输入、工具或授权不可用。 |
| `covered_axes` | `IndustryEvidenceAxisKey[]` | 该职责项覆盖的证据轴。 | 必须与职责项冻结表一致；缺轴时应标 `partial/unavailable`。 |
| `event_count` | number | 该职责项 owner 结算桶总数。 | 固定等于 `accepted_event_count + rejected_event_count + counter_event_count`；不得把 assisted 或诊断计数并入其中。 |
| `accepted_event_count` | number | 由该职责项作为 primary owner 被接受进入证据包的事件数。 | 不能包含 rejected、public unsafe event 或仅作为 contributor / attestation 参与的事实。 |
| `assisted_event_count` | number | 该职责项以 contributor、backfill、attestation、gap follow-up 等身份协助的事件数。 | 只能用于 coverage reporting，不得回写 primary owner 记账，也不得重复增加 accepted evidence 数量。 |
| `rejected_event_count` | number | 被拒绝的事件数。 | 大于 0 时必须有 rejected reason / audit。 |
| `counter_event_count` | number | 反证事件数。 | 大于 0 时必须进入 `CounterEvidenceAudit`。 |
| `diagnostic_event_count` | number | 诊断桶总数。 | 固定等于 `metric_input_gap_count + unscorable_event_count + profile_blocked_event_count`；只用于 coverage / 降级解释，不参与 owner 结算。 |
| `metric_input_gap_count` | number | 缺少 freshness/source/authority/relevance/dedupe 等关键计算输入的事件数。 | 大于 0 时必须能反查 `metric_input_completeness`、reason code 或 normalization/rejected audit。 |
| `unscorable_event_count` | number | 因缺少关键字段、payload 不完整或 profile 前提不足而不能进入 axis scoring 的事件数。 | 这些事件不得伪装成 accepted supporting evidence；必须降级为 context、进入 rejected batch 或在 status_reason 中解释。 |
| `profile_blocked_event_count` | number | 被 Agent relevance、freshness stale、primary-source cap、authority context 或其他冻结 profile 阻断的事件数。 | 用于证明“看到了但不能算分”；不得和 rejected 或 counter 静默混写。 |
| `input_artifact_refs` | string[] | 输入 artifact 引用。 | `ok/partial` 状态不能为空。 |
| `output_artifact_refs` | string[] | 输出 artifact 引用。 | `ok/partial/failed` 都应有输出或失败日志引用；`skipped/unavailable` 应有原因。 |
| `tool_route_ids` | string[] | 使用的工具 route。 | 有工具调用时必须可追溯到 tool registry。 |
| `status_reason` | string optional | 状态原因。 | `partial/skipped/failed/unavailable` 必填；必须是稳定 reason code 或短语，不得只写散文。 |
| `contribution_summary_cn` | string | 用户可读贡献摘要。 | 只能解释状态和贡献，不能替代结构化计数和 artifact refs。 |

补充冻结：

- `IndustryAgentContribution` 的 owner 记账与 weekly coverage reporting 必须分层表达：owner 结算看 `accepted_event_count`，协助与替补覆盖看 `assisted_event_count`，二者不得混写。
- `IndustryAgentContribution` 的诊断桶必须独立闭合：`diagnostic_event_count` 只汇总 `metric_input_gap_count`、`unscorable_event_count` 与 `profile_blocked_event_count`，不得再让 `event_count` 同时承担“结算总数”和“诊断总数”两种语义。
- weekly coverage 可以展示 contributor、takeover、gap follow-up 或 backfill 的工作量，但这些报表不应反向改写 `primary responsibility_id`、accepted evidence 数量或事实 owner 结算。

如果某个职责项没有对应输入，weekly 必须在 `agent_contributions` 中标为 `unavailable` 或 `skipped`，对应证据轴状态不得伪装成已覆盖。
