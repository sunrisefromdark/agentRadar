import type { AcademicHandoffBundle } from "../../agents/academic-agent/types.ts";
import {
  reviewAcademicPreparatoryHandoff,
  validateAcademicHandoff,
  type AcademicFormalHandoffBundle,
} from "../contracts/academicHandoff.ts";
import { loadIndustrySchemaRegistry, type IndustrySchemaRegistry } from "../contracts/schemaRegistry.ts";
import { buildRuntimeRegistrySnapshotFromFixture } from "../registry/runtimeSnapshot.ts";

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

export type AcademicPreparatoryDryRunInput = {
  bundle: AcademicHandoffBundle;
  registry?: IndustrySchemaRegistry;
};

export type AcademicDryRunInput = {
  bundle: AcademicFormalHandoffBundle;
  registry?: IndustrySchemaRegistry;
};

export type AcademicPreparatoryDryRunResult =
  | {
      ok: true;
      status: "academic_preparatory_normalization_dry_run_ready";
      normalizedEventBatchRefs: string[];
      rejectedEventBatchRefs: string[];
      coverageRefs: string[];
      contributionRefs: string[];
      promotionReady: false;
      blockedUntil: "formal_academic_handoff";
      feedbackPayloadSchema: "normalization-feedback.v1";
      feedbackPayload: ReadyFeedbackPayload;
    }
  | {
      ok: false;
      reasonCode: "schema_mismatch" | "lineage_failed";
      message: string;
      feedbackPayloadSchema: "normalization-feedback.v1";
      feedbackPayload: RejectedFeedbackPayload;
    };

export type AcademicDryRunResult =
  | {
      ok: true;
      status: "normalization_dry_run_ready";
      normalizedEventBatchRefs: string[];
      rejectedEventBatchRefs: string[];
      coverageRefs: string[];
      contributionRefs: string[];
      runtimeSnapshot: ReturnType<typeof buildRuntimeRegistrySnapshotFromFixture>;
      feedbackPayloadSchema: "normalization-feedback.v1";
      feedbackPayload: ReadyFeedbackPayload;
    }
  | {
      ok: false;
      reasonCode: "schema_mismatch" | "unsupported_version" | "lineage_failed" | "dispatch_context_missing";
      message: string;
      feedbackPayloadSchema: "normalization-feedback.v1";
      feedbackPayload: RejectedFeedbackPayload;
    };

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function feedbackPayload(
  bundle: AcademicHandoffBundle | AcademicFormalHandoffBundle,
  error?: { reasonCode: string; message: string },
): ReadyFeedbackPayload | RejectedFeedbackPayload {
  const daily = dailyInputPayload(bundle);
  const date = text(daily.window_end).slice(0, 10) || "unknown-date";
  const payloadId = `feedback-${text(daily.payload_id).replaceAll(/[^a-zA-Z0-9-]/g, "-")}`;
  const payload = {
    payload_schema: "normalization-feedback.v1" as const,
    schema_version: "1.0.0" as const,
    payload_id: payloadId,
    run_id: text(daily.run_id),
    source_message_id: text(daily.source_message_id),
    fact_resolution_audit_ref: `industry://internal/${date}/fact-resolution-audit.v1/${payloadId}`,
    producer_agent_id: "normalization-agent" as const,
  };

  return error
    ? { ...payload, feedback_status: "dry_run_rejected", feedback_ext: { reason_code: error.reasonCode, message: error.message } }
    : { ...payload, feedback_status: "dry_run_ready" };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function dailyInputPayload(bundle: AcademicHandoffBundle | AcademicFormalHandoffBundle): RecordLike {
  if ("daily_input" in bundle) return bundle.daily_input.payload as unknown as RecordLike;
  return (bundle.payloads.find((payload) => payload.payload_schema === "daily-industry-evidence-pack-input.v1") ?? {}) as RecordLike;
}

export function consumeAcademicPreparatoryHandoffForDryRun(
  input: AcademicPreparatoryDryRunInput,
): AcademicPreparatoryDryRunResult {
  const result = reviewAcademicPreparatoryHandoff(input.registry ?? loadIndustrySchemaRegistry(), input.bundle);
  if (!result.ok) {
    return {
      ...result,
      feedbackPayloadSchema: "normalization-feedback.v1",
      feedbackPayload: feedbackPayload(input.bundle, result) as RejectedFeedbackPayload,
    };
  }

  const daily = input.bundle.daily_input.payload;
  return {
    ok: true,
    status: "academic_preparatory_normalization_dry_run_ready",
    normalizedEventBatchRefs: daily.normalized_event_batch_refs,
    rejectedEventBatchRefs: daily.rejected_event_batch_refs,
    coverageRefs: daily.coverage_refs,
    contributionRefs: daily.contribution_refs,
    promotionReady: false,
    blockedUntil: "formal_academic_handoff",
    feedbackPayloadSchema: "normalization-feedback.v1",
    feedbackPayload: feedbackPayload(input.bundle) as ReadyFeedbackPayload,
  };
}

export function consumeAcademicHandoffForDryRun(input: AcademicDryRunInput): AcademicDryRunResult {
  const result = validateAcademicHandoff(input.registry ?? loadIndustrySchemaRegistry(), input.bundle);
  if (!result.ok) {
    return {
      ...result,
      feedbackPayloadSchema: "normalization-feedback.v1",
      feedbackPayload: feedbackPayload(input.bundle, result) as RejectedFeedbackPayload,
    };
  }

  const daily = dailyInputPayload(input.bundle);
  const coverageRefs = stringArray(daily.coverage_refs);
  const runtimeSnapshot = buildRuntimeRegistrySnapshotFromFixture({
    groupId: "academic",
    toolCoverageRefs: coverageRefs,
  });
  if (!runtimeSnapshot.ok) {
    return {
      ...runtimeSnapshot,
      feedbackPayloadSchema: "normalization-feedback.v1",
      feedbackPayload: feedbackPayload(input.bundle, runtimeSnapshot) as RejectedFeedbackPayload,
    };
  }

  return {
    ok: true,
    status: "normalization_dry_run_ready",
    normalizedEventBatchRefs: stringArray(daily.normalized_event_batch_refs),
    rejectedEventBatchRefs: stringArray(daily.rejected_event_batch_refs),
    coverageRefs,
    contributionRefs: stringArray(daily.contribution_refs),
    runtimeSnapshot,
    feedbackPayloadSchema: "normalization-feedback.v1",
    feedbackPayload: feedbackPayload(input.bundle) as ReadyFeedbackPayload,
  };
}
