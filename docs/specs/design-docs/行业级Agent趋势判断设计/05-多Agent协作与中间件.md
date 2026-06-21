# 行业级 Agent 趋势判断：多 Agent 协作与中间件

> 本文档拆自 [行业级Agent趋势判断设计文档.md](../行业级Agent趋势判断设计文档.md)，是行业级 Agent 趋势判断设计文档包的一部分。

## 多 Agent 分工

V1 冻结 9 个实际 Agent 与 15 个职责项。实际 Agent 是真正干活的执行者；职责项是 weekly 必须分别交账的覆盖项。一个实际 Agent 可以负责多个职责项，但每个职责项必须有且只有一个实际 Agent 负责，并在 weekly 中单独输出状态、证据计数、失败原因和来源引用。

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

每个实际 Agent 的最小条件：

1. 有单独的输入 artifact 引用。
2. 有单独的输出 artifact 或 contribution record。
3. 有单独的 `status`、`status_reason` 和失败/跳过语义。
4. 可在测试中证明 Trend Agent 只消费上游 Agent 的输出，不直接补采原始来源。

### 多 Agent 消息与交互协议

V1 不允许各 Agent 自行定义输入输出 JSON。所有 Agent 间通信必须通过统一的 `IndustryAgentMessageEnvelope` 和可引用 artifact 完成；自由文本只能作为 `summary_cn` 或 notes，不能作为下游可执行事实。

```ts
type IndustryAgentMessageKind =
  | "task_request"
  | "task_result"
  | "evidence_batch"
  | "normalization_request"
  | "normalization_result"
  | "registry_review_request"
  | "registry_review_result"
  | "audit_request"
  | "audit_result"
  | "claim_candidate_batch"
  | "trend_decision_input"
  | "tool_status_report"
  | "failure_notice";

type IndustryArtifactKind =
  | "raw_tool_output_ref"
  | "industry_signal_event_batch"
  | "normalized_event_batch"
  | "rejected_event_batch"
  | "registry_snapshot"
  | "tool_registry_snapshot"
  | "registry_review"
  | "claim_candidate_batch"
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
  status: "created" | "sent" | "consumed" | "superseded" | "failed";
  reason_code?: string;
  public_safe: boolean;
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
  public_safe: boolean;
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
| `status` | enum | 消息生命周期状态。 | 只有 `sent` 可被消费；消费成功改为 `consumed`；被替代改为 `superseded`。 |
| `reason_code` | string optional | 失败、替代或拒绝原因。 | `failed/superseded` 必填。 |
| `public_safe` | boolean | 消息及 payload 是否可公开消费。 | false 时 payload 不得进入公开 weekly。 |

`IndustryAgentArtifactManifest` 字段定义冻结如下：

| 字段 | 类型 / 取值 | 含义 | 执行约束 |
| --- | --- | --- | --- |
| `artifact_ref` | stable string | artifact 全局引用。 | 必须可被 message、contribution、ledger、weekly card 反查。 |
| `artifact_kind` | `IndustryArtifactKind` | artifact 类型。 | 下游必须按 kind 和 schema_version 解析。 |
| `produced_by_agent_id` | `IndustryAgentId` | 产出 Agent。 | 必须与 source message 的 `from_agent_id` 或处理 Agent 一致。 |
| `source_message_id` | string optional | 触发该 artifact 的消息。 | 由消息驱动产物必须填写。 |
| `input_artifact_refs` | string[] | 产物依赖的上游 artifact。 | 用于审计信息流，不能省略。 |
| `event_ids` / `claim_ids` / `axis_keys` | arrays | 产物覆盖对象。 | 不适用时为空数组；不得省略字段。 |
| `content_hash` | string | artifact 内容 hash。 | 用于防止同 ref 内容漂移；内容变化必须新 hash。 |
| `storage_path` | string | 本地或公开产物路径。 | raw local-only artifact 不得出现在 public manifest 中。 |

### Lineage 与 Manifest 语义

其余协作术语统一以 [术语与审计词汇表](09-术语与审计词汇表.md) 为准；这里仅补充本章最关键的两个审计对象。


为避免实现阶段把消息系统退化成“发几份 JSON 就算交接完成”，这里额外冻结两个专用名词：

- `message lineage`：指同一 `run_id`、`thread_id`、`correlation_id` 下，消息从 request 到 result、从 claim-builder pass 到 audit pass、再到 tier-decider pass 的依赖链。它不是日志时间线，而是可被 `depends_on_message_ids`、`source_message_id`、`input_artifact_refs` 和 `output_artifact_refs` 验证的结构化交接链。
- `artifact manifest`：指对每个 canonical artifact 的登记条目，即 `IndustryAgentArtifactManifest`。它不是文件列表，而是 artifact 的 canonical inventory，负责说明这个 artifact 是谁在什么 schema version 下、基于哪些输入产出的，以及下游应该如何解析它。

执行约束：

- 没有 `message lineage` 的消息，只能视为未完成 handoff，不能证明某个 claim 真正经过了审计和裁决。
- 没有 `artifact manifest` 的 artifact，只能视为未登记中间产物，下游不得把它当作 canonical 输入消费。

### Payload Schema Registry

`payload_schema` 不能只是 envelope 上的字符串。V1 冻结以下 payload schema registry；ExecPlan 可以把字段落成 JSON Schema / Zod / TypeBox，但不得删减 producer、consumer、required refs、missing behavior 或失败语义。

所有 payload 共同字段：

- `payload_id`、`schema_version`、`run_id`、`window_start`、`window_end` 必填，且必须与 `IndustryAgentMessageEnvelope` 对齐。
- `source_message_id` 必须指向当前 payload 所属 envelope；request / result 链路还必须共享 `correlation_id`。
- payload 中的 `*_artifact_ref(s)` 必须能在 `IndustryAgentArtifactManifest` 中解析；无法解析时消息进入 `failed` 或 `rejected`，不得由下游猜测。
- `summary_cn` 只能解释结构化字段，不得新增事实；下游可执行事实只能来自 event、registry、audit、coverage 或 ledger artifact。

| payload_schema | allowed `kind` | producer | consumer | required fields / refs | missing / failure behavior |
| --- | --- | --- | --- | --- | --- |
| `task-request.v1` | `task_request` | registry-agent 或上游实际 Agent | 专责搜寻 Agent、normalization-agent、audit-agent、trend-agent | `task_id`、`responsibility_id`、`axis_keys`、`registry_snapshot_ref`、`tool_registry_snapshot_ref`、`deadline_at`、`budget_profile_id`、`input_artifact_refs` | 缺 registry/tool snapshot 时任务不得启动，必须产出 `failure_notice.v1`。 |
| `task-result.v1` | `task_result` | 任一实际 Agent | task requester、registry-agent | `task_id`、`status`、`output_artifact_refs`、`agent_contribution_ref`、`reason_code?` | `partial/skipped/failed/unavailable` 必须有 `reason_code`；不得只返回自然语言摘要。 |
| `event-batch.v1` | `evidence_batch` | academic/product/community/finance/policy Agent | normalization-agent | `events_ref`、`raw_tool_output_refs`、`agent_contribution_ref`、`tool_status_report_refs`、`responsibility_id` | 缺 `events_ref` 时视为无 accepted events；仍必须有 contribution 或 failure notice。 |
| `normalization-request.v1` | `normalization_request` | registry-agent / trend-agent claim-builder pass | normalization-agent | `event_batch_refs`、`registry_snapshot_ref`、`dedupe_policy_version` | 缺 event batch 时不得生成空成功结果；应标 `skipped` 或 `unavailable`。 |
| `normalization-result.v1` | `normalization_result` | normalization-agent | registry-agent、audit-agent、trend-agent claim-builder pass | `normalized_event_batch_ref`、`rejected_event_batch_ref`、`merge_audit_ref`、`used_event_batch_refs` | 未产出 `merge_audit_ref` 时下游不得消费 normalized events。 |
| `registry-review-request.v1` | `registry_review_request` | normalization-agent、audit-agent、专责搜寻 Agent | registry-agent | `unknown_actor_refs`、`provisional_authority_refs`、`basis_event_ids`、`requested_action` | 缺 basis events 时只能生成 rejected review，不能提升 authority。 |
| `registry-review-result.v1` | `registry_review_result` | registry-agent | audit-agent、trend-agent | `registry_review_ref`、`registry_snapshot_ref`、`approved_entity_ids`、`rejected_entity_ids`、`reason_codes` | provisional authority 未经 registry-agent + audit-agent 双审时不得作为 core/proven。 |
| `audit-request.v1` | `audit_request` | trend-agent claim-builder pass / registry-agent | audit-agent | `claim_candidate_batch_ref`、`normalized_event_batch_ref`、`registry_review_result_refs`、`supporting_event_ids`、`counter_event_ids` | 缺 claim candidate 时 audit-agent 不得凭空审计；必须返回 failed request 或 skipped reason。 |
| `audit-result.v1` | `audit_result` | audit-agent | trend-agent tier-decider pass | `counter_evidence_audit_ref`、`audited_claim_candidate_ids`、`blocking_claim_candidate_ids`、`downgrade_recommendations` | 每个进入 tier decision 的 candidate 必须有 audit result；缺失时最高 `insufficient_evidence`。 |
| `claim-candidate-batch.v1` | `claim_candidate_batch` | trend-agent claim-builder pass | audit-agent、trend-agent tier-decider pass | `claim_candidate_batch_ref`、`claim_builder_audit_refs`、`candidate_group_ids`、`input_event_ids`、`generated_claim_ids`、`deferred_event_ids`、`rejected_event_ids` | 该 payload 不得包含最终 `decision_tier`；候选缺 audit 时不得进入最终 ledger。 |
| `trend-decision-input.v1` | `trend_decision_input` | registry-agent / trend-agent tier-decider pass | trend-agent tier-decider pass | `claim_candidate_batch_ref`、`normalization_result_ref`、`registry_review_result_refs`、`audit_result_refs`、`tool_coverage_report_refs`、`agent_contribution_refs`、`project_weekly_artifact_refs` | 缺 `audit_result_refs`、tool coverage 或 agent contribution 时必须降级并写入 `missing_axes` / `not_complete_unless`。 |
| `tool-status-report.v1` | `tool_status_report` | registry-agent、专责搜寻 Agent | normalization-agent、trend-agent、weekly output | `axis_tool_coverage_report_refs`、`tool_registry_snapshot_ref`、`active_route_level`、`degradation_reason_codes` | 没有每轴 coverage report 时，相关轴必须为 `unavailable`，不能默认为 covered。 |
| `failure-notice.v1` | `failure_notice` | 任一实际 Agent | 下游依赖 Agent、weekly output | `failed_agent_id`、`responsibility_id?`、`failed_kind`、`reason_code`、`affected_axis_keys`、`retryable`、`fallback_action` | 下游必须把 affected axes 写入 missing/unavailable；不得静默重试后丢失失败记录。 |

Payload schema 与 message kind 的匹配是结构测试项：`kind` 与 `payload_schema` 不匹配时消息必须 rejected；同一 `payload_ref` 不能被多个不兼容 schema 复用。

Agent 交互 DAG 冻结如下：

```text
registry-agent
  -> registry_snapshot / tool_registry_snapshot
  -> broadcast tool_status_report

academic-agent / product-oss-agent / community-news-agent / finance-agent / policy-agent
  <- task_request + registry/tool snapshots
  -> evidence_batch + tool_status_report + agent_contribution

normalization-agent
  <- evidence_batch[]
  -> normalization_result(normalized_event_batch, rejected_event_batch, merge_audit)

registry-agent + audit-agent
  <- normalization_result events with unknown/provisional actors
  -> registry_review_result

trend-agent (claim-builder pass)
  <- normalization_result + registry_review_result + tool_coverage_report + project weekly artifacts
  -> claim_candidate_batch + claim_builder_audit

audit-agent
  <- claim_candidate_batch + normalization_result + registry_review_result + supporting/counter events
  -> audit_result(counter_evidence_audit)

trend-agent (tier-decider pass)
  <- claim_candidate_batch + normalization_result + registry_review_result + audit_result + tool_coverage_report + agent_contribution
  <- trend_decision_input
  -> claim_ledger
```

交互规则冻结如下：

1. 专责搜寻 Agent 只能输出 `evidence_batch`、`tool_status_report` 和 `agent_contribution`；不得直接输出 `IndustryTrendDecision`。
2. `normalization-agent` 是所有 `IndustrySignalEvent` 进入 claim builder 前的唯一归一入口；trend-agent 不得直接消费 raw tool output。
3. `registry-agent` 负责 registry/tool snapshot 与 provisional authority review；其他 Agent 可以提出 `registry_review_request`，但不能自授权。
4. `trend-agent` 必须拆成 claim-builder pass 与 tier-decider pass：前者只生成 `claim_candidate_batch` 和 `claim_builder_audit`，不得输出最终 `decision_tier`；后者必须在消费 `audit_result` 后才能生成 `claim_ledger`。
5. `audit-agent` 必须在 `claim_candidate_batch` 之后、最终 `claim_ledger` 之前输出 `audit_result`；没有反证也必须输出空审计。
6. `trend-agent` 只能消费 `normalization_result`、`registry_review_result`、`claim_candidate_batch`、`audit_result`、`tool_coverage_report`、`agent_contribution` 和现有 project weekly artifacts；不得发送搜寻型 `task_request` 给自己，也不得临时调用原始 provider。
7. 任一 Agent 失败必须发送 `failure_notice` 或在 contribution 中标 `failed/unavailable`；下游必须把缺口写入 missing/unavailable 状态，不能静默跳过。
8. 所有跨 Agent 输入输出必须有 `IndustryAgentMessageEnvelope`、`IndustryAgentArtifactManifest` 和匹配的 payload schema；只有 artifact 路径而没有 envelope / manifest / schema 的输出不得被下游消费。
9. 同一 `idempotency_key` 产生的重复 event 必须由 normalization-agent 去重，并在 `IndustryMergeAudit` 中记录。
10. 任何进入 tier-decider pass 的 claim candidate 必须能反查 `claim-candidate-batch.v1`、`audit-result.v1`、tool coverage 和 agent contribution；缺任一项时不得输出 `core_industry_trend`。

### 中间件采用策略

本设计鼓励复用成熟中间件，但中间件只能承载校验、执行、编排、工具接入和观测，不能替代本文冻结的 evidence、message、artifact、audit 和 trend decision 语义。所有中间件输出都必须最终落为 `IndustryAgentMessageEnvelope`、`IndustryAgentArtifactManifest`、`IndustrySignalEvent`、`IndustryClaimLedger` 或相关 canonical artifact。

V1 / 后续可采用范围冻结如下：

| 类别 | 推荐中间件 / 框架 | 采用阶段 | 适合承担 | 不得承担 |
| --- | --- | --- | --- | --- |
| Schema 校验 | JSON Schema、Zod、TypeBox | V1 推荐 | 校验 message、event、manifest、ledger、weekly section 的结构与枚举 | 不得把 schema 放宽成自由 JSON；不得替代业务裁决规则 |
| 工具 / connector 协议 | MCP、专用 connector、官方 SDK / API adapter | V1 推荐 | 统一接入网页、GitHub、论文、金融、政策、社区等工具输出 | 不得直接产出趋势等级；不得绕过 normalization-agent |
| 本地 artifact 存储 | JSONL / JSON artifact、content hash、manifest index | V1 推荐 | 保存 message、manifest、daily pack、claim ledger、tool coverage report | 不得只保存框架内部状态而不落 canonical artifact |
| Observability / tracing | OpenTelemetry、Langfuse 或等价 trace store | V1 可选 | 记录调用链、耗时、失败、token/cost、Agent route | 不得替代 `IndustryAgentContribution`、`AxisToolCoverageReport` 或 audit artifact |
| Agent DAG / 状态图 | LangGraph 或等价 DAG runner | V1 可选，复杂后采用 | 执行多 Agent DAG、条件分支、重试和状态转移 | 不得把 LangGraph state 当作唯一事实源；必须同步写 envelope / manifest |
| Workflow 编排 | Temporal、Prefect、Dagster | V2 或运行复杂后采用 | 定时、重试、依赖、backfill、失败恢复、长任务编排 | V1 不得为了引入编排框架而弱化 artifact-first pipeline |
| 低代码工作流 | n8n、Activepieces | 可作为外围 connector | 快速接入外部 API、通知、轻量任务触发 | 不得作为核心趋势判断引擎或证据账本 |
| 多 Agent 对话框架 | AutoGen、CrewAI 等 | 默认不作为 V1 核心 | 可用于实验性搜寻或草稿型外部 Agent | 不得替代固定职责、message envelope、audit 和 rules-first decision |
| 消息队列 | Kafka、RabbitMQ、NATS、Redis Streams | 非 V1 默认，服务化后再评估 | 跨服务异步消息、高并发、实时流式处理 | 当前 daily/weekly batch 不得因消息队列引入不可审计内部状态 |

采用规则：

1. 优先复用 schema 校验、connector、tracing 和可选 DAG runner，避免重复造轮子。
2. V1 默认以文件 artifact + manifest + CLI pipeline 为 canonical runtime；只有当重试、并发、backfill 或跨服务部署复杂度超过本地 pipeline 时，才引入 Temporal / Prefect / Dagster 等编排层。
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
| `input_artifact_refs` | string[] | 输入 artifact 引用。 | `ok/partial` 状态不能为空。 |
| `output_artifact_refs` | string[] | 输出 artifact 引用。 | `ok/partial/failed` 都应有输出或失败日志引用；`skipped/unavailable` 应有原因。 |
| `tool_route_ids` | string[] | 使用的工具 route。 | 有工具调用时必须可追溯到 tool registry。 |
| `status_reason` | string optional | 状态原因。 | `partial/skipped/failed/unavailable` 必填；必须是稳定 reason code 或短语，不得只写散文。 |
| `contribution_summary_cn` | string | 用户可读贡献摘要。 | 只能解释状态和贡献，不能替代结构化计数和 artifact refs。 |

如果某个职责项没有对应输入，weekly 必须在 `agent_contributions` 中标为 `unavailable` 或 `skipped`，对应证据轴状态不得伪装成已覆盖。
