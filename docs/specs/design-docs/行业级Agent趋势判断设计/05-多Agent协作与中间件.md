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
| `trend-agent` | `trend-synthesis` | 必须只消费已归一和已审计证据，不直接采集原始来源 |

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

- `primary responsibility_id` 只解决“谁采集、谁记账、谁对 artifact 负责”，不直接决定该事实最终属于哪个 claim role、哪一个 archetype 或哪一个 axis 投影。
- claim role、cross-axis projection、supporting/counter 归属和独立性交叉确认，必须由 `fact_id`、`FactResolutionAudit` 和 `IndustryClaimEvidenceLink` 决定，而不是由采集 owner 标签直接决定。
- 允许“单 owner 记账、多角色投影”，但多角色投影不得重复增加 accepted evidence 数量，也不得自动增加独立性交叉确认 credit。

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

- `normalization-agent` 产出的 `FactResolutionAudit.snapshot_id` 是当前 run 的事实快照标识；它代表本轮 claim-builder、audit 和 weekly 可读取的唯一事实结算面。
- `claim-builder` 只能消费已关闭的 fact snapshot；不得一边读取 provisional owner 事件流，一边等待 owner transfer 晚到后再回补计数。
- 在 `fact_snapshot_cutoff_at` 之前完成的 owner transfer、attestation 合并和 source-chain / fact merge，可以进入当前 fact snapshot；晚于该 cutoff 的变化只能进入下一 run 或显式 rerun。
- 同一 claim 在同一 run 中的 accepted evidence 计数、独立性交叉确认 credit 和 canonical owner 解释权，必须以该 claim 消费的 `snapshot_id` 为准；不得被后续 transfer 静默改写。
- eval、replay、weekly 和人工复核引用的也是当时的 `snapshot_id`，而不是事后回看时最新的 owner / fact 状态。

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

当前设计不允许各 Agent 自行定义输入输出 JSON。所有 Agent 间通信必须通过统一的 `IndustryAgentMessageEnvelope` 和可引用 artifact 完成；自由文本只能作为 `summary_cn` 或 notes，不能作为下游可执行事实。

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
  | "counter_evidence_audit"
  | "claim_ledger"
  | "agent_contribution"
  | "tool_coverage_report";

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
  depends_on_message_ids: string[];
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

`IndustryAgentMessageEnvelope` 字段定义冻结如下：

| 字段 | 类型 / 取值 | 含义 | 执行约束 |
| --- | --- | --- | --- |
| `message_id` | stable string | 单条 Agent 消息 ID。 | 必须可追溯；重试同一逻辑消息应保留 `correlation_id` 并使用新的 `message_id`。 |
| `thread_id` | string | 同一次行业趋势工作流的消息线程。 | 同一 weekly run 的相关消息必须在同一 thread 下。 |
| `run_id` | string | 运行 ID。 | 必须与 daily / weekly artifact 的 run context 一致。 |
| `window_start/window_end` | ISO date/datetime | 消息处理的证据窗口。 | Agent 不得消费窗口外证据，除非 payload 明确标为历史上下文。 |
| `from_agent_id` / `to_agent_id` | `IndustryAgentId` 或 `broadcast` | 消息发送方和接收方。 | `broadcast` 只允许 registry/tool snapshot、failure notice 或全局 run context；任务执行不得广播给多个 Agent 后各自抢写。 |
| `responsibility_id` | `IndustryResponsibilityId` optional | 消息关联职责项。 | 专责 Agent 的 task/result/evidence 消息必须填写；registry/audit/trend 全局消息可按需为空。 |
| `kind` | `IndustryAgentMessageKind` | 消息类型。 | 下游只能按 kind 选择 payload parser，不能根据自然语言摘要猜测。 |
| `payload_schema` | schema ID enum | payload 的具体 schema。 | 必须与 `kind` 匹配；不匹配时消息 rejected。 |
| `payload_ref` | artifact ref | 结构化 payload 的存储引用。 | payload 不内联大段自由文本；必须可由 artifact manifest 解析。 |
| `input_artifact_refs` / `output_artifact_refs` | string[] | 本消息读取 / 产出的 artifact。 | 消息消费前必须验证 input refs 存在；输出必须登记 manifest。 |
| `depends_on_message_ids` | string[] | 前置消息依赖。 | 依赖未 consumed 时不得消费当前消息。 |
| `correlation_id` | string optional | 同一任务、重试或请求-响应链路 ID。 | request/result、retry/supersede 必须共享 correlation。 |
| `idempotency_key` | string | 幂等键。 | 相同 key 的重复消息不得重复写入 evidence event。 |
| `status` | enum | 消息生命周期状态。 | 只有 `sent` 可被消费；消费成功改为 `consumed`；被替代改为 `superseded`；schema 不匹配、payload 非法或关键 ref 无法解析时必须为 `rejected`。 |
| `reason_code` | string optional | 失败、替代或拒绝原因。 | `failed/superseded/rejected` 必填。 |
| `visibility_tier` | `internal_only` / `redacted_public` / `public` | 消息及 payload 的可见层级。 | `internal_only` 不得被公开 weekly 或 Web surface 直接消费；公开展示必须走显式 projection。 |
| `redaction_policy_version` | string optional | redaction 策略版本。 | `redacted_public` 时必填；`public` 若无需脱敏可为空。 |
| `contains_raw_text` / `contains_profile_urls` | boolean | 是否仍包含 raw text / profile URL。 | 公开 projection 必须为 `false`；否则只能保留 internal。 |
| `public_projection_artifact_ref` | string optional | 对应公开投影 artifact ref。 | `visibility_tier="redacted_public"` 或 `"public"` 时应可解析；不得与 internal storage path 复用同一文件。 |

`IndustryAgentArtifactManifest` 字段定义冻结如下：

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

- `message lineage`：指同一 `run_id`、`thread_id`、`correlation_id` 下，消息从 request 到 result、从 claim-builder pass 到 audit pass、再到 tier-decider pass 的依赖链。它不是日志时间线，而是可被 `depends_on_message_ids`、`source_message_id`、`input_artifact_refs` 和 `output_artifact_refs` 验证的结构化交接链。
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

| payload_schema | allowed `kind` | producer | consumer | required fields / refs | missing / failure behavior |
| --- | --- | --- | --- | --- | --- |
| `task-request.v1` | `task_request` | registry-agent 或上游实际 Agent | 专责搜寻 Agent、normalization-agent、audit-agent、trend-agent | `task_id`、`responsibility_id`、`axis_keys`、`registry_snapshot_ref`、`tool_registry_snapshot_ref`、`deadline_at`、`budget_profile_id`、`input_artifact_refs` | 缺 registry/tool snapshot 时任务不得启动，必须产出 `failure_notice.v1`。 |
| `task-result.v1` | `task_result` | 任一实际 Agent | task requester、registry-agent | `task_id`、`status`、`output_artifact_refs`、`agent_contribution_ref`、`reason_code?` | `partial/skipped/failed/unavailable` 必须有 `reason_code`；不得只返回自然语言摘要。 |
| `event-batch.v1` | `evidence_batch` | academic/product/community/finance/policy Agent | normalization-agent | `events_ref`、`raw_tool_output_refs`、`agent_contribution_ref`、`tool_status_report_refs`、`responsibility_id`、`metric_input_completeness`、`cross_responsibility_attestation_refs?` | 缺 `events_ref` 时视为无 accepted events；仍必须有 contribution 或 failure notice。缺关键 metric input 时不得默认为 accepted supporting events，必须补齐、降级为 context、进入 rejected_event_batch 或发送 failure notice。专责 Agent 可以在 event 中标出 source-level counter cue，也可以通过 attestation 对既有主事实补充结构语义，但不得直接给出最终 claim role。 |
| `normalization-request.v1` | `normalization_request` | registry-agent / trend-agent claim-builder pass | normalization-agent | `event_batch_refs`、`registry_snapshot_ref`、`dedupe_policy_version` | 缺 event batch 时不得生成空成功结果；应标 `skipped` 或 `unavailable`。 |
| `normalization-result.v1` | `normalization_result` | normalization-agent | registry-agent、audit-agent、trend-agent claim-builder pass | `normalized_event_batch_ref`、`rejected_event_batch_ref`、`merge_audit_ref`、`fact_resolution_audit_ref`、`used_event_batch_refs` | 未产出 `merge_audit_ref` 或 `fact_resolution_audit_ref` 时下游不得消费 normalized events。 |
| `evidence-gap-request.v1` | `evidence_gap_request` | trend-agent、audit-agent、registry-agent | 对应专责搜寻 Agent、registry-agent | `claim_id`、`requested_agent_id`、`missing_axis_keys`、`gap_reason_code`、`expected_source_constraints`、`deadline_at`、`retry_count`、`input_artifact_refs` | 只允许针对接近升级门槛但缺关键一手证据的 claim 发起；缺 claim 或缺目标 Agent 时请求 rejected。 |
| `evidence-gap-result.v1` | `evidence_gap_result` | 被请求的专责搜寻 Agent 或 registry-agent | request 发起方、trend-agent tier-decider pass、audit-agent | `claim_id`、`request_message_id`、`status`、`output_artifact_refs`、`resolved_axis_keys`、`remaining_gap_reason_codes` | `status=failed/partial/unavailable` 时必须保留 gap reason；不得用自然语言宣称“已补齐”而无 artifact。 |
| `registry-review-request.v1` | `registry_review_request` | normalization-agent、audit-agent、专责搜寻 Agent | registry-agent | `unknown_actor_refs`、`provisional_authority_refs`、`basis_event_ids`、`requested_action` | 缺 basis events 时只能生成 rejected review，不能提升 authority。 |
| `registry-review-result.v1` | `registry_review_result` | registry-agent | audit-agent、trend-agent | `registry_review_ref`、`registry_snapshot_ref`、`approved_entity_ids`、`rejected_entity_ids`、`reason_codes` | provisional authority 未经 registry-agent + audit-agent 双审时不得作为 core/proven；authority review 缺失默认阻断 authority 晋升，不默认否定 claim 存在本身。 |
| `audit-request.v1` | `audit_request` | trend-agent claim-builder pass / registry-agent | audit-agent | `claim_candidate_batch_ref`、`claim_evidence_link_batch_ref`、`normalized_event_batch_ref`、`registry_review_result_refs`、`supporting_event_ids`、`counter_event_ids`、`fact_resolution_audit_ref` | 缺 claim candidate、claim evidence link 或 `fact_resolution_audit_ref` 时 audit-agent 不得凭空审计；必须返回 failed request 或 skipped reason。 |
| `audit-result.v1` | `audit_result` | audit-agent | trend-agent tier-decider pass | `counter_evidence_audit_ref`、`audited_claim_candidate_ids`、`blocking_claim_candidate_ids`、`downgrade_recommendations`、`high_impact_unresolved_group_ids` | 每个进入 tier decision 的 candidate 原则上都应有 audit result；缺失时默认下调 `decision_confidence` 并标记 `coverage_audit_state=partial`。material 边界必须以 `IndustryClaimEvidenceLink.materiality_class` / `is_tier_material` 和 `FactResolutionAudit.high_impact_unresolved_groups.impact_scope` 为准，不得由各 Agent 临时自由判断。只有在缺失审计覆盖主支柱、关键独立交叉确认、`blocking_path` 或 `impact_scope=tier_blocking` 的未决组时，才不得保留原 `core` 候选；若连主支柱级审计都缺失，最高 `insufficient_evidence`。 |
| `claim-candidate-batch.v1` | `claim_candidate_batch` | trend-agent claim-builder pass | audit-agent、trend-agent tier-decider pass | `claim_candidate_batch_ref`、`claim_evidence_link_batch_ref`、`claim_builder_audit_refs`、`candidate_group_ids`、`input_event_ids`、`generated_claim_ids`、`deferred_event_ids`、`rejected_event_ids` | 该 payload 不得包含最终 `decision_tier`；`claim_evidence_link_batch` 中每条 link 必须已写明 `materiality_class`、`is_tier_material` 与 `materiality_reason_codes`。若发生候选折叠，`claim_builder_audit_refs` 还必须能反查 `overlap_cluster_id`、`canonical_candidate_group_id` 和 `fold_reason_codes`。候选缺 claim evidence link、这些 materiality 字段或折叠留痕时，不得进入最终 ledger。 |
| `trend-decision-input.v1` | `trend_decision_input` | registry-agent / trend-agent tier-decider pass | trend-agent tier-decider pass | `claim_candidate_batch_ref`、`claim_evidence_link_batch_ref`、`normalization_result_ref`、`registry_review_result_refs`、`audit_result_refs`、`tool_coverage_report_refs`、`agent_contribution_refs`、`project_weekly_artifact_refs` | 缺 `audit_result_refs`、claim evidence link、tool coverage 或 agent contribution 时，默认先下调 `decision_confidence`、标记 `coverage_audit_state=partial` 并写入 `missing_axes` / `not_complete_unless`；只有当缺口命中 `is_tier_material=true` 的主支柱、关键独立交叉确认、`blocking_path` 或 `impact_scope=tier_blocking` 的未决组时，才允许直接下调 `decision_tier`。生成最终 ledger 时还必须产出 `consumer_readiness_state` 与 `consumer_display_priority`。 |
| `tool-status-report.v1` | `tool_status_report` | registry-agent、专责搜寻 Agent | normalization-agent、trend-agent、weekly output | `axis_tool_coverage_report_refs`、`tool_registry_snapshot_ref`、`active_route_level`、`active_source_class`、`selection_scorecard_version?`、`selection_score_total?`、`veto_reason_codes`、`degradation_reason_codes`、`budget_status_summary` | 没有每轴 coverage report 时，相关轴必须为 `unavailable`，不能默认为 covered；高权威轴若缺 `active_source_class`、scorecard 关键信息或预算摘要，不得被下游默认为 official-first 已满足。 |
| `failure-notice.v1` | `failure_notice` | 任一实际 Agent | 下游依赖 Agent、weekly output | `failed_agent_id`、`responsibility_id?`、`failed_kind`、`reason_code`、`affected_axis_keys`、`retryable`、`fallback_action` | 下游必须把 affected axes 写入 missing/unavailable；不得静默重试后丢失失败记录。 |

Payload schema 与 message kind 的匹配是结构测试项：`kind` 与 `payload_schema` 不匹配时消息必须 rejected；同一 `payload_ref` 不能被多个不兼容 schema 复用。

Schema 兼容与 replay 边界冻结如下：

- breaking change 必须升级 `schema_version`；不得在同一版本下改变字段语义、枚举语义或失败语义。
- V1 consumer 至少要明确两类结果：`supported` 与 `unsupported_version`；遇到未知更高 major version 时必须 rejected 并发送 `failure_notice.v1`，不得“尽量解析”。
- replay runner 必须记录本次使用的 schema snapshot / reader set，区分“数据漂移”“规则漂移”和“版本不兼容阻断”。
- `WeeklyIndustryTrendSection`、`IndustryClaimLedger`、`IndustryAgentMessageEnvelope` 和 `IndustryAgentArtifactManifest` 的 consumer 在 V1 至少要支持当前冻结版本和同 major 的上一个兼容版本；若不支持，必须在治理面标明迁移窗口。
- payload 仍只负责传递结构化字段和 artifact refs；超过单次消费边界的批量对象必须拆成 batch artifact，不得回退为超大 inline JSON。

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
  <- claim_candidate_batch + claim_evidence_link_batch + normalization_result + registry_review_result? + audit_result? + evidence_gap_result? + tool_coverage_report + agent_contribution
  <- trend_decision_input
  -> claim_ledger
```

交互规则冻结如下：

1. 专责搜寻 Agent 只能输出 `evidence_batch`、`tool_status_report` 和 `agent_contribution`；不得直接输出 `IndustryTrendDecision`。它们可以标记 source-level supporting / counter cue，但不能越权定义 claim role。
2. `normalization-agent` 是所有 `IndustrySignalEvent` 进入 claim builder 前的唯一归一入口；trend-agent 不得直接消费 raw tool output。
3. `registry-agent` 负责 registry/tool snapshot 与 provisional authority review；其他 Agent 可以提出 `registry_review_request`，但不能自授权。
4. `trend-agent` 必须拆成 claim-builder pass 与 tier-decider pass：前者只能消费 `normalization_result`、`registry_review_result`、`tool_coverage_report` 和现有 project weekly artifacts，只生成 `claim_candidate_batch`、`claim_evidence_link_batch` 和 `claim_builder_audit`，不得输出最终 `decision_tier`、`claim_ledger`，也不得把缺失 metric input 解释成正式评分结论；后者必须在消费 `audit_result`、`agent_contribution`、完整 coverage 和可选的 `evidence_gap_result` 后才能生成 `claim_ledger`。
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
17. 若补证未完成、失败或超时，tier-decider 默认先保留下调后的 `decision_confidence` / `coverage_audit_state`，并把剩余缺口写入 `missing_axes`、`not_complete_unless` 或对应审计 reason code；只有当补证缺口命中主支柱、关键独立交叉确认或 blocking 路径时，才直接下调 `decision_tier`。
18. `trend-agent` 与 `audit-agent` 在处理 `merged_provisional`、`singleton_unresolved` 或 `conflicted` 事实组时，必须显式消费 `FactResolutionAudit`；不得把“没有稳定 fact_id”直接等价成“事件无效”，也不得把 provisional 组直接当成完整独立事实。

补充冻结：

- `claim-builder pass` 必须为每个 claim 产出 `proposed_claim_archetype`；`tier-decider pass` 必须产出 `adjudicated_claim_archetype`。若二者不一致，必须写入 `archetype_revision_reason_code`，并把 revision 依据挂到 claim lineage。
- `registry-agent` 的阻断权仅限 authority / registry 域：它可以阻断主体晋升为 `core/proven/provisional_authority`，但不得单独否定 claim 存在本身或直接改写 `decision_tier`。
- `audit-agent` 的阻断权仅限 tier / public output 域：只有命中主支柱、关键独立交叉确认或高影响反证时，才可触发 `tier_blocking`；其余情况默认输出 `followup_required` 或 `public_output_blocking`。
- `trend-agent` 在最终 ledger 中必须同时输出 `decision_tier`、`decision_confidence` 和 `coverage_audit_state`；不得再用单一 tier 降级混写证据语义与流程完整度。

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

- 每个 claim candidate 必须先被分入以下三类之一：
  - `critical_headline`：当前 projected tier 已达 `core_industry_trend`，或正在阻断既有 headline core 的 public-safe / authority / blocking counter evidence 问题。
  - `high_priority`：距离 `core_industry_trend`、`observing_industry_trend` 或 `wind_probe` 仅差一个 material audit / authority / single-gap canonical fetch 的候选。
  - `deferred_followup`：其余长尾候选、低价值重复候选或本轮即使补证也不会改变 headline/主叙事的候选。
- 默认 same-run 预算地板冻结为：`critical_headline <= 3`、`high_priority <= 6`；`deferred_followup` 不设数量上限，但默认不占用 same-run blocking 审计与补证产能。
- admission 排序顺序固定为：`consumer_readiness_state` 预期、`consumer_display_priority` 预期、`projected decision_tier`、是否命中 `blocking_path` / `public_output` 风险、`key_independent_confirmation` 完整度、freshness、稳定 tie-break（`claim_id` / `candidate_group_id` 字典序）。
- 超出 same-run admission budget 的候选，不得被静默丢弃、改写为 rejected，或强行降成更低事实 tier；只能保留在 internal ledger、`watchlist_only`、`needs_review`、`insufficient_evidence` 或下一轮 follow-up 队列中。

### same-run snapshot 冻结

为避免同一周因异步结果先后顺序不同而产出不同结论，weekly run 必须冻结显式 snapshot 边界：

- 每次 weekly 必须记录 `fact_snapshot_cutoff_at`、`claim_admission_cutoff_at`、`authority_snapshot_cutoff_at`、`audit_snapshot_cutoff_at` 和 `publication_snapshot_at`，并写入 `WeeklyIndustryTrendSection.run_snapshot`。
- `claim-builder` 只能消费 `fact_snapshot_cutoff_at` 前已经关闭并落账的 `FactResolutionAudit.snapshot_id`；owner transfer、attestation 合并或主语义改写若晚于该 cutoff，只能进入下一 run 或显式 rerun。
- `trend-agent` 的 tier-decider pass 只能消费各自 cutoff 前已完成并落账的 `registry_review_result`、`audit_result`、`evidence_gap_result` 和 tool coverage；不得一边生成 weekly、一边继续无边界吸收晚到结果。
- 在 `publication_snapshot_at` 之前晚到、且命中已 admitted claim 的结果，只允许重开该 claim 的 tier-decider，不允许无审计地局部改文案。
- 晚于 `publication_snapshot_at` 的 registry / audit / gap 结果，不得静默改写已发布 weekly；只能进入下一次 regular weekly，或产生带 supersede audit 的显式 rerun。
- 同一 claim 在同一 run 中最多允许一次 “late-result reopen”；再次晚到的结果必须进入下一 run 或显式 rerun，防止 claim 在本轮无限抖动。

### 并发与异步裁决原则

周级批处理不得默认实现成“所有 claim 共享一条串行审计流水线”。设计冻结以下并发与异步原则：

1. 专责搜寻 Agent 默认并发 fan-out；finance、policy、community、academic、product-oss 不应互相串行等待。
2. `registry-agent` 的 authority review 必须支持按 entity batch / materiality 异步处理；长尾主体不得阻断主 weekly。
3. `audit-agent` 必须支持按 claim batch / priority 并发审计；高优先级 core 候选与长尾 observing 候选不得共用单一串行队列。
4. 补证回路必须按 `gap_scope` 异步化；不同缺口允许并发，单一缺口只做去重。
5. `core` 候选、public output 风险、authority 晋升和长尾 follow-up 必须拆成不同优先级队列；不得让低影响争议拖住高影响裁决。
6. 若审计/registry 产能不足，系统默认先在 `decision_confidence` 和 `coverage_audit_state` 上显式暴露，而不是把大批边界 claim 一律静默压回 `observing`。

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
- `WeeklyIndustryTrendSection` 必须显式输出 `lineage_refs`、`run_budget_summary`、`run_snapshot` 和 `display_index`，并确保 tier 分区与 `display_index` 来自同一 ledger snapshot；缺少 `claim_candidate_batch_ref`、`audit_result_refs` 或 `trend_decision_input_ref` 时，packager 不得生成 public `display_index.headline_core_card_ids`，必须改为 `display_index.provisional_core_watchlist_card_ids`、`display_index.needs_review_card_ids`、降级投影或非 core public projection，而不是否定内部 claim ledger 已保留的 tier 候选。
- weekly packager 只能消费 canonical artifact：daily pack、normalization result、registry review、audit result、claim ledger、tool coverage、agent contribution 和既有 project weekly artifacts；不得回头读取 provider raw input。
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

`IndustryAgentContribution` 契约：

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

interface IndustryAgentContribution {
  responsibility_id: IndustryResponsibilityId;
  handled_by_agent_id: IndustryAgentId;
  status: "ok" | "partial" | "skipped" | "failed" | "unavailable";
  covered_axes: IndustryEvidenceAxisKey[];
  event_count: number;
  accepted_event_count: number;
  rejected_event_count: number;
  counter_event_count: number;
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

`IndustryAgentContribution` 字段定义冻结如下：

| 字段 | 类型 / 取值 | 含义 | 执行约束 |
| --- | --- | --- | --- |
| `responsibility_id` | `IndustryResponsibilityId` | weekly 必须交账的职责项。 | 15 个职责项每周都必须出现一条 contribution record。 |
| `handled_by_agent_id` | `IndustryAgentId` | 实际执行该职责项的 Agent。 | 必须匹配职责表，不得由 trend-agent 临时代填 finance/policy/audit 等职责。 |
| `status` | `ok` / `partial` / `skipped` / `failed` / `unavailable` | 职责执行状态。 | `ok` 表示完整覆盖；`partial` 表示部分覆盖且需说明缺口；`skipped` 表示按规则跳过；`failed` 表示尝试失败；`unavailable` 表示输入、工具或授权不可用。 |
| `covered_axes` | `IndustryEvidenceAxisKey[]` | 该职责项覆盖的证据轴。 | 必须与职责项冻结表一致；缺轴时应标 `partial/unavailable`。 |
| `event_count` | number | 该职责项处理的事件总数。 | 必须等于 accepted + rejected + counter 或在 status_reason 中解释差异。 |
| `accepted_event_count` | number | 被接受进入证据包的事件数。 | 不能包含 rejected 或 public unsafe event。 |
| `rejected_event_count` | number | 被拒绝的事件数。 | 大于 0 时必须有 rejected reason / audit。 |
| `counter_event_count` | number | 反证事件数。 | 大于 0 时必须进入 `CounterEvidenceAudit`。 |
| `metric_input_gap_count` | number | 缺少 freshness/source/authority/relevance/dedupe 等关键计算输入的事件数。 | 大于 0 时必须能反查 `metric_input_completeness`、reason code 或 normalization/rejected audit。 |
| `unscorable_event_count` | number | 因缺少关键字段、payload 不完整或 profile 前提不足而不能进入 axis scoring 的事件数。 | 这些事件不得伪装成 accepted supporting evidence；必须降级为 context、进入 rejected batch 或在 status_reason 中解释。 |
| `profile_blocked_event_count` | number | 被 Agent relevance、freshness stale、primary-source cap、authority context 或其他冻结 profile 阻断的事件数。 | 用于证明“看到了但不能算分”；不得和 rejected 或 counter 静默混写。 |
| `input_artifact_refs` | string[] | 输入 artifact 引用。 | `ok/partial` 状态不能为空。 |
| `output_artifact_refs` | string[] | 输出 artifact 引用。 | `ok/partial/failed` 都应有输出或失败日志引用；`skipped/unavailable` 应有原因。 |
| `tool_route_ids` | string[] | 使用的工具 route。 | 有工具调用时必须可追溯到 tool registry。 |
| `status_reason` | string optional | 状态原因。 | `partial/skipped/failed/unavailable` 必填；必须是稳定 reason code 或短语，不得只写散文。 |
| `contribution_summary_cn` | string | 用户可读贡献摘要。 | 只能解释状态和贡献，不能替代结构化计数和 artifact refs。 |

如果某个职责项没有对应输入，weekly 必须在 `agent_contributions` 中标为 `unavailable` 或 `skipped`，对应证据轴状态不得伪装成已覆盖。
