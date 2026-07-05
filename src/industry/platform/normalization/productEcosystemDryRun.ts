import { validateSameRunConsumerRefs } from "../contracts/consumerFixtures.ts";
import { validateDispatchRuntimeGate, type DispatchRuntimeInput } from "../contracts/dispatchRuntime.ts";
import {
  validateProductEcosystemHandoff,
  type ProductEcosystemHandoffBundle,
} from "../contracts/productEcosystemHandoff.ts";
import { loadIndustrySchemaRegistry, type IndustrySchemaRegistry } from "../contracts/schemaRegistry.ts";
import { resolveSharedGovernanceProfile } from "../contracts/sharedGovernance.ts";
import { publishRuntimeRegistrySnapshot } from "../registry/runtimeSnapshot.ts";

type RecordLike = Record<string, unknown>;
type ReadyFeedbackPayload = {
  payload_schema: "normalization-feedback.v1";
  schema_version: "1.0.0";
  payload_id: string;
  run_id: string;
  source_message_id: string;
  fact_resolution_audit_ref: string;
  producer_agent_id: "normalization-agent";
  feedback_status: "dry_run_ready";
};
type RejectedFeedbackPayload = Omit<ReadyFeedbackPayload, "feedback_status"> & {
  feedback_status: "dry_run_rejected";
  feedback_ext: {
    reason_code: string;
    message: string;
  };
};

export type ProductEcosystemDryRunInput = Omit<DispatchRuntimeInput, "message"> & {
  bundle: ProductEcosystemHandoffBundle;
  registry?: IndustrySchemaRegistry;
  registrySnapshotRef?: string;
  toolRegistrySnapshotRef?: string;
  seedRefs?: string[];
  authorityRefs?: string[];
  manualReviewPoolSlots?: number;
  reviewAvailability?: {
    same_run_review_mode: "staffed_human" | "service_account_only" | "async_only";
    reviewer_on_duty_count: number;
  };
};

export type ProductEcosystemDryRunResult =
  | {
      ok: true;
      status: "normalization_dry_run_ready";
      normalizedEventBatchRefs: string[];
      rejectedEventBatchRefs: string[];
      coverageRefs: string[];
      contributionRefs: string[];
      governanceProfileIds: string[];
      feedbackPayloadSchema: "normalization-feedback.v1";
      runtimeSnapshot?: ReturnType<typeof publishRuntimeRegistrySnapshot>;
      feedbackPayload: ReadyFeedbackPayload;
    }
  | {
      ok: false;
      reasonCode:
        | "schema_mismatch"
        | "unsupported_version"
        | "lineage_failed"
        | "dispatch_context_missing"
        | "reservation_missing"
        | "budget_exceeded";
      message: string;
      feedbackPayloadSchema?: "normalization-feedback.v1";
      feedbackPayload?: RejectedFeedbackPayload;
    };

const PRODUCT_ECOSYSTEM_BUDGET_PROFILE_ID = "axis-runtime-budget-profile.v1/product_ecosystem";

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(hasText) : [];
}

function dailyInputPayload(bundle: ProductEcosystemHandoffBundle): RecordLike | undefined {
  return bundle.payloads.find((payload) => (payload as RecordLike).payload_schema === "daily-industry-evidence-pack-input.v1") as
    | RecordLike
    | undefined;
}

function budgetProfileIds(bundle: ProductEcosystemHandoffBundle): string[] {
  const ids = bundle.payloads
    .map((payload) => (payload as { budget_status?: { profile_id?: unknown } }).budget_status?.profile_id)
    .filter(hasText);
  return [...new Set(ids)];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stableId(prefix: string, raw: string): string {
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = Math.imul(hash ^ raw.charCodeAt(index), 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function feedbackPayload(dailyInput: RecordLike): ReadyFeedbackPayload;
function feedbackPayload(dailyInput: RecordLike, error: { reasonCode: string; message: string }): RejectedFeedbackPayload;
function feedbackPayload(dailyInput: RecordLike, error?: { reasonCode: string; message: string }): ReadyFeedbackPayload | RejectedFeedbackPayload {
  const runId = text(dailyInput.run_id);
  const sourceMessageId = text(dailyInput.source_message_id);
  const date = text(dailyInput.window_end).slice(0, 10) || "unknown-date";
  const payloadId = stableId("feedback", `${runId}:${sourceMessageId}`);

  const payload = {
    payload_schema: "normalization-feedback.v1" as const,
    schema_version: "1.0.0" as const,
    payload_id: payloadId,
    run_id: runId,
    source_message_id: sourceMessageId,
    fact_resolution_audit_ref: `industry://internal/${date}/fact-resolution-audit.v1/${payloadId}`,
    producer_agent_id: "normalization-agent" as const,
  };
  return error
    ? { ...payload, feedback_status: "dry_run_rejected", feedback_ext: { reason_code: error.reasonCode, message: error.message } }
    : { ...payload, feedback_status: "dry_run_ready" };
}

function rejectedResult(
  result: Exclude<ProductEcosystemDryRunResult, { ok: true }>,
  dailyInput?: RecordLike,
): Exclude<ProductEcosystemDryRunResult, { ok: true }> {
  return dailyInput
    ? {
        ...result,
        feedbackPayloadSchema: "normalization-feedback.v1",
        feedbackPayload: feedbackPayload(dailyInput, result),
      }
    : result;
}

export function consumeProductEcosystemHandoffForDryRun(input: ProductEcosystemDryRunInput): ProductEcosystemDryRunResult {
  const registry = input.registry ?? loadIndustrySchemaRegistry();
  const dailyInput = dailyInputPayload(input.bundle);
  const handoff = validateProductEcosystemHandoff(registry, input.bundle);
  if (!handoff.ok) return rejectedResult(handoff, dailyInput);

  const claimCriticalMessages = input.bundle.messages.filter((message) => (message as RecordLike).capability_class === "claim-critical");
  for (const message of claimCriticalMessages) {
    const consumerGate = validateSameRunConsumerRefs(message);
    if (!consumerGate.ok) return rejectedResult(consumerGate, dailyInput);

    const dispatchGate = validateDispatchRuntimeGate({ ...input, message });
    if (!dispatchGate.ok) return rejectedResult(dispatchGate, dailyInput);
  }

  if (!dailyInput) {
    return { ok: false, reasonCode: "lineage_failed", message: "Missing daily industry evidence pack input." };
  }

  const governanceProfileIds = budgetProfileIds(input.bundle);
  for (const profileId of governanceProfileIds) {
    const profile = resolveSharedGovernanceProfile(registry, profileId);
    if (!profile.ok) return rejectedResult(profile, dailyInput);
  }

  const result: Extract<ProductEcosystemDryRunResult, { ok: true }> = {
    ok: true,
    status: "normalization_dry_run_ready",
    normalizedEventBatchRefs: stringArray(dailyInput.normalized_event_batch_refs),
    rejectedEventBatchRefs: stringArray(dailyInput.rejected_event_batch_refs),
    coverageRefs: stringArray(dailyInput.coverage_refs),
    contributionRefs: stringArray(dailyInput.contribution_refs),
    governanceProfileIds: governanceProfileIds.length ? governanceProfileIds : [PRODUCT_ECOSYSTEM_BUDGET_PROFILE_ID],
    feedbackPayloadSchema: "normalization-feedback.v1",
    feedbackPayload: feedbackPayload(dailyInput),
  };

  if (input.registrySnapshotRef && input.toolRegistrySnapshotRef) {
    const snapshot = publishRuntimeRegistrySnapshot({
      registrySnapshotRef: input.registrySnapshotRef,
      toolRegistrySnapshotRef: input.toolRegistrySnapshotRef,
      toolCoverageRefs: stringArray(dailyInput.coverage_refs),
      seedRefs: input.seedRefs ?? [],
      authorityRefs: input.authorityRefs ?? [],
      manualReviewPoolSlots: input.manualReviewPoolSlots ?? 0,
      reviewAvailability: input.reviewAvailability ?? { same_run_review_mode: "async_only", reviewer_on_duty_count: 0 },
    });
    if (!snapshot.ok) return snapshot;
    result.runtimeSnapshot = snapshot;
  }

  return result;
}
