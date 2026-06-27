# Policy Finance Shared Runtime Note

## 背景

- 政策金融组 producer 已完成 canonical handoff、same-run runtime refs 透传、current/negative compatibility fixture 与 contract/negative 回归。
- 当前 remaining gap 不在领域 producer；`normalization dry-run` 已落地，剩余在中台对这些 refs 的实际 runtime 消费链路与共享治理收口。

## 需要中台上收的共享运行时能力

1. same-run dispatch runtime consumer
   - 对 `claim-critical` message 正式消费以下字段：
     - `dispatch_context_ref`
     - `scheduling_key`
     - `claim_partition_id` 或 `candidate_group_id`
     - `claim_admission_assessment_ref`
     - `capacity_reservation_refs`
   - 与 `validateDispatchRuntimeGate(...)` 的约束保持同一真源，不再让领域组各自复制校验逻辑

2. shared governance lookup
   - 将 `field-ownership-policy.v1`
   - `axis-runtime-budget-profile.v1`
   - `same-run-review-availability-policy.v1`
   - `message-key-policy.v1`
   - 以及 reason/state registry
   - 统一接入中台运行时，避免领域组继续本地保留“只验 contract、不真消费”的 seam

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

## 中台接线完成后的最小回接点

- 复用现有 bundle + same-run fixtures 做 integration dry-run
- 若消费链路需要新增共享 helper，由中台上收到 `src/industry/platform/*`
- 领域组只补 consumer-facing fixture 或 contract test，不再扩共享运行时
