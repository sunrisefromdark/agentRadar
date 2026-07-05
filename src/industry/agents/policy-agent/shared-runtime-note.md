# Policy Finance Shared Runtime Note

## 背景

- 政策金融组 producer 已完成 canonical handoff、same-run runtime refs 透传、current/negative compatibility fixture 与 contract/negative 回归。
- 中台已接通 `normalization dry-run`、`consumeFinancePolicyHandoffForRuntime(...)`、shared governance lookup 与 runtime registry snapshot 发布。

## 已由中台上收的共享运行时能力

1. same-run dispatch runtime consumer
   - 对 `claim-critical` message 正式消费以下字段：
     - `dispatch_context_ref`
     - `scheduling_key`
     - `claim_partition_id` 或 `candidate_group_id`
     - `claim_admission_assessment_ref`
     - `capacity_reservation_refs`
   - 已与 `validateDispatchRuntimeGate(...)` 共享同一约束真源，不再需要领域组各自复制校验逻辑

2. shared governance lookup
   - 已接入 `field-ownership-policy.v1`
   - `axis-runtime-budget-profile.v1`
   - `same-run-review-availability-policy.v1`
   - `message-key-policy.v1`
   - 以及 reason/state registry
   - 领域组不再保留“只验 contract、不真消费”的 runtime seam

## 本组已交付给中台的现成输入

- `normalization dry-run` 入口：`src/industry/platform/normalization/financePolicyDryRun.ts`
- builder 入口：`src/industry/agents/policy-agent/handoff.ts`
- producer same-run envelope seam：`src/industry/agents/policy-agent/groupProtocol.ts`
- handoff note：`src/industry/agents/policy-agent/handoff-note.md`
- same-run 正例 fixture：
  - `fixtures/industry/agents/policy-agent/compatibility/same-run-current-consumer.json`
- same-run 反例 fixture：
  - `fixtures/industry/agents/policy-agent/compatibility/same-run-missing-stable-claim-key-negative.json`

## 不建议继续由领域组承担的内容

- 不建议在政策金融组目录继续新增 normalization wrapper
- 不建议在政策金融组目录复制 dispatch runtime consumer
- 不建议在政策金融组目录本地冻结新的 reason/state/budget 语义

## 当前剩余边界

- 复用现有 bundle + same-run fixtures 做最终跨组集成与总验收
- 若最终集成暴露新的 consumer-facing 拒收项，领域组只补字段、fixture 或 contract test
- 不再扩共享运行时
