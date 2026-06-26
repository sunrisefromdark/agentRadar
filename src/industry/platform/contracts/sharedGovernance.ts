import type { IndustrySchemaRegistry } from "./schemaRegistry.ts";

export const PHASE1_SHARED_GOVERNANCE_PROFILE_IDS = [
  "field-ownership-policy.v1",
  "fact-resolution-profile.v1",
  "freshness-decay-profile.v1",
  "agent-relevance-profile.v1",
  "SourceAuthorityContextProfile",
  "tool-selection-scorecard.v1",
  "task-timeout-profile.v1",
  "tool-call-timeout-profile.v1",
  "axis-subscore-rubric.v1",
  "axis-activation-policy.v1",
  "claim-archetype-axis-applicability.v1",
  "axis-status-threshold-profile.v1",
  "claim-archetype-decision-profile.v1",
  "independence-credit-profile.v1",
  "canonical-fetch-stop-policy.v1",
  "axis-runtime-budget-profile.v1",
  "same-run-eligible-micro-task-matrix.v1",
  "micro-task-runtime-budget-profile.v1",
  "micro-task-cost-profile.v1",
  "rotation-budget-profile.v1",
  "claim-admission-budget-profile.v1",
  "claim-runtime-budget-profile.v1",
  "run-critical-path-budget.v1",
  "shared-capacity-policy.v1",
  "run-total-budget-policy.v1",
  "same-run-review-availability-policy.v1",
  "runtime-sizing-assumptions.v1",
  "gap-scope-contract.v1",
  "message-key-policy.v1",
  "runtime-concurrency-control-policy.v1",
  "backlog-compaction-policy.v1",
  "reopen-impact-matrix.v1",
  "headline-capacity-policy.v1",
] as const;

export const PHASE1_FEEDBACK_PAYLOAD_SCHEMA_IDS = [
  "normalization-feedback.v1",
  "schema-governance-notice.v1",
  "schema-change-note.v1",
] as const;

const REQUIRED_SCHEMA_IDS = [
  "industry-agent-message.v1",
  "same-run-dispatch-context.v1",
  "capacity-reservation.v1",
  "budget-arbitration-record.v1",
  "human-review-queue-item.v1",
  "failure-notice.v1",
  "override-audit.v1",
  ...PHASE1_SHARED_GOVERNANCE_PROFILE_IDS,
  ...PHASE1_FEEDBACK_PAYLOAD_SCHEMA_IDS,
];

const REQUIRED_REASON_CODES = [
  "schema_mismatch",
  "unsupported_version",
  "lineage_failed",
  "dispatch_context_missing",
  "reservation_missing",
  "budget_exceeded",
  "capacity_exhausted",
  "timeout_budget_exhausted",
];

const REQUIRED_STATES = [
  ["capacity-reservation.reservation_state", "granted"],
  ["capacity-reservation.reservation_state", "rejected"],
  ["human-review-queue-item.queue_state", "open"],
];

type GovernanceResult =
  | { ok: true; status: "shared_governance_published"; profileIds: readonly string[] }
  | { ok: false; reasonCode: "schema_mismatch"; message: string };

export function validateSharedGovernanceBaseline(registry: IndustrySchemaRegistry): GovernanceResult {
  const schemaIds = new Set(registry.canonical.entries.map((entry) => entry.schema_id));
  const compatibleIds = new Set(registry.compatibility.entries.map((entry) => entry.schema_id));
  const reasonCodes = new Set(registry.reasonCodes.codes.map((entry) => entry.code));
  const states = new Set(
    registry.stateTransitions.entries.map((entry) => `${entry.state_family}:${entry.local_state}`),
  );

  const missingSchema = REQUIRED_SCHEMA_IDS.find((id) => !schemaIds.has(id) || !compatibleIds.has(id));
  if (missingSchema) {
    return { ok: false, reasonCode: "schema_mismatch", message: `Missing governance schema: ${missingSchema}` };
  }

  const missingReason = REQUIRED_REASON_CODES.find((code) => !reasonCodes.has(code));
  if (missingReason) {
    return { ok: false, reasonCode: "schema_mismatch", message: `Missing governance reason code: ${missingReason}` };
  }

  const missingState = REQUIRED_STATES.find(([family, state]) => !states.has(`${family}:${state}`));
  if (missingState) {
    return {
      ok: false,
      reasonCode: "schema_mismatch",
      message: `Missing governance state: ${missingState[0]}:${missingState[1]}`,
    };
  }

  return {
    ok: true,
    status: "shared_governance_published",
    profileIds: PHASE1_SHARED_GOVERNANCE_PROFILE_IDS,
  };
}
