import type {
  AcademicHandoffBundle,
  AcademicFormalHandoffBundle as AcademicFormalHandoffShape,
  ProducedArtifact,
} from "../../agents/academic-agent/types.ts";
import { canConsumePayloadSchema } from "./payloadRegistry.ts";
import type { IndustrySchemaRegistry } from "./schemaRegistry.ts";
import { validatePayloadSchema } from "./schemaRegistry.ts";

type HandoffRecord = Record<string, unknown>;

export type AcademicFormalHandoffBundle = AcademicFormalHandoffShape;

type AcademicPrepReviewResult =
  | { ok: true; status: "handoff_ready" }
  | { ok: false; reasonCode: "schema_mismatch" | "lineage_failed"; message: string };

type AcademicHandoffResult =
  | { ok: true; status: "accepted_for_dry_run" }
  | {
      ok: false;
      reasonCode: "schema_mismatch" | "unsupported_version" | "lineage_failed" | "dispatch_context_missing";
      message: string;
    };

const REQUIRED_RESPONSIBILITIES = ["research-frontier", "conference-academic"];
const ALLOWED_HANDOFF_SCHEMAS = new Set([
  "industry-signal-event-batch.v1",
  "axis-tool-coverage-report.v1",
  "industry-agent-contribution.v1",
  "daily-industry-evidence-pack-input.v1",
]);
const ALLOWED_KIND_BY_SCHEMA: Record<string, string> = {
  "industry-signal-event-batch.v1": "evidence_batch",
  "axis-tool-coverage-report.v1": "tool_status_report",
  "industry-agent-contribution.v1": "industry_agent_contribution",
  "daily-industry-evidence-pack-input.v1": "daily_industry_evidence_pack_input",
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasStringArray(value: unknown, length?: number): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(hasText) && (length === undefined || value.length === length);
}

function knownSchemaExists(registry: IndustrySchemaRegistry, schemaId: string): boolean {
  return validatePayloadSchema(registry, schemaId).ok || registry.compatibility.entries.some((entry) => entry.schema_id === schemaId);
}

function canConsumeHandoffSchema(
  registry: IndustrySchemaRegistry,
  schemaId: string,
  producerVersion: string,
): Exclude<AcademicHandoffResult, { ok: true }> | undefined {
  const payloadResult = canConsumePayloadSchema(registry, schemaId, producerVersion);
  if (payloadResult.ok) return undefined;

  const entry = registry.compatibility.entries.find((item) => item.schema_id === schemaId);
  if (!entry) return payloadResult;

  if ((entry.current_version.split(".", 1)[0] ?? "") !== (producerVersion.split(".", 1)[0] ?? "")) {
    return {
      ok: false,
      reasonCode: "unsupported_version",
      message: `Unsupported major version for ${schemaId}: ${producerVersion}`,
    };
  }

  return undefined;
}

function validateAcademicFormalHandoff(
  registry: IndustrySchemaRegistry,
  bundle: AcademicFormalHandoffBundle,
): AcademicHandoffResult {
  const manifestRefs = new Set(bundle.manifests.map((manifest) => (manifest as HandoffRecord).artifact_ref).filter(hasText));
  const artifactRefs = new Set(bundle.artifactRefs.filter(hasText));

  for (const message of bundle.messages) {
    const envelope = message as HandoffRecord;
    if (
      !hasText(envelope.kind) ||
      !hasText(envelope.payload_schema) ||
      !hasText(envelope.from_agent_id) ||
      !hasText(envelope.to_agent_id)
    ) {
      return { ok: false, reasonCode: "schema_mismatch", message: "Message is missing required envelope fields." };
    }

    if (!hasText(envelope.payload_ref)) {
      return { ok: false, reasonCode: "lineage_failed", message: "Message is missing payload_ref." };
    }

    if (!manifestRefs.has(envelope.payload_ref) && !artifactRefs.has(envelope.payload_ref)) {
      return { ok: false, reasonCode: "lineage_failed", message: `Unresolved payload_ref: ${envelope.payload_ref}` };
    }

    if (!ALLOWED_HANDOFF_SCHEMAS.has(envelope.payload_schema)) {
      return {
        ok: false,
        reasonCode: "schema_mismatch",
        message: `Unsupported academic handoff schema: ${envelope.payload_schema}`,
      };
    }

    if (envelope.kind !== ALLOWED_KIND_BY_SCHEMA[envelope.payload_schema]) {
      return {
        ok: false,
        reasonCode: "schema_mismatch",
        message: `Message kind does not match payload_schema: ${envelope.payload_schema}`,
      };
    }

    const compatibilityError = canConsumeHandoffSchema(registry, envelope.payload_schema, "1.0.0");
    if (compatibilityError) return compatibilityError;

    if (
      envelope.capability_class === "claim-critical" &&
      (!hasText(envelope.dispatch_context_ref) ||
        !hasText(envelope.scheduling_key) ||
        (!hasText(envelope.claim_partition_id) && !hasText(envelope.candidate_group_id)) ||
        !hasText(envelope.claim_admission_assessment_ref) ||
        !hasStringArray(envelope.capacity_reservation_refs))
    ) {
      return {
        ok: false,
        reasonCode: "dispatch_context_missing",
        message: "Claim-critical handoff requires dispatch context, scheduling key, stable claim key, admission ref, and reservation refs.",
      };
    }
  }

  for (const payload of bundle.payloads) {
    const payloadRecord = payload as HandoffRecord;
    if (!hasText(payloadRecord.payload_schema) || !hasText(payloadRecord.schema_version)) {
      return { ok: false, reasonCode: "schema_mismatch", message: "Payload is missing schema identity." };
    }

    if (!ALLOWED_HANDOFF_SCHEMAS.has(payloadRecord.payload_schema)) {
      return {
        ok: false,
        reasonCode: "schema_mismatch",
        message: `Unsupported academic handoff schema: ${payloadRecord.payload_schema}`,
      };
    }

    const compatibilityError = canConsumeHandoffSchema(registry, payloadRecord.payload_schema, payloadRecord.schema_version);
    if (compatibilityError) return compatibilityError;
  }

  const responsibilities = new Set(bundle.payloads.map((payload) => (payload as HandoffRecord).responsibility_id).filter(hasText));
  for (const responsibility of REQUIRED_RESPONSIBILITIES) {
    if (!responsibilities.has(responsibility)) {
      return { ok: false, reasonCode: "lineage_failed", message: `Missing academic responsibility: ${responsibility}` };
    }
  }

  const dailyInput = bundle.payloads.find((payload) => (payload as HandoffRecord).payload_schema === "daily-industry-evidence-pack-input.v1") as
    | HandoffRecord
    | undefined;
  if (!dailyInput) {
    return { ok: false, reasonCode: "lineage_failed", message: "Missing daily industry evidence pack input." };
  }

  if (
    !hasStringArray(dailyInput.normalized_event_batch_refs, 2) ||
    !hasStringArray(dailyInput.rejected_event_batch_refs, 2) ||
    !hasStringArray(dailyInput.source_message_ids) ||
    !hasStringArray(dailyInput.coverage_refs, 2) ||
    !hasStringArray(dailyInput.contribution_refs, 2)
  ) {
    return { ok: false, reasonCode: "lineage_failed", message: "Daily input must use two-axis academic ref arrays." };
  }

  if ("accepted_events" in dailyInput || "rejected_events" in dailyInput || "events" in dailyInput) {
    return { ok: false, reasonCode: "lineage_failed", message: "Daily input must not embed event snapshots." };
  }

  const dailyRefs = [
    ...dailyInput.normalized_event_batch_refs,
    ...dailyInput.rejected_event_batch_refs,
    ...dailyInput.coverage_refs,
    ...dailyInput.contribution_refs,
  ];
  if (dailyRefs.some((ref) => !artifactRefs.has(ref))) {
    return { ok: false, reasonCode: "lineage_failed", message: "Academic daily input references unresolved artifacts." };
  }

  if (
    !hasStringArray(bundle.replayFixtureRefs) ||
    !hasStringArray(bundle.evalFixtureRefs) ||
    !hasStringArray(bundle.ownerBoundaryFixtureRefs)
  ) {
    return {
      ok: false,
      reasonCode: "lineage_failed",
      message: "Academic formal handoff must include replay, eval, and owner-boundary fixture refs.",
    };
  }

  return { ok: true, status: "accepted_for_dry_run" };
}

function isAcademicFormalHandoffBundle(
  bundle: AcademicHandoffBundle | AcademicFormalHandoffBundle,
): bundle is AcademicFormalHandoffBundle {
  return "messages" in bundle && "manifests" in bundle && "payloads" in bundle && "artifactRefs" in bundle;
}

export function validateAcademicHandoff(
  registry: IndustrySchemaRegistry,
  bundle: AcademicHandoffBundle,
): AcademicPrepReviewResult;
export function validateAcademicHandoff(
  registry: IndustrySchemaRegistry,
  bundle: AcademicFormalHandoffBundle,
): AcademicHandoffResult;
export function validateAcademicHandoff(
  registry: IndustrySchemaRegistry,
  bundle: AcademicHandoffBundle | AcademicFormalHandoffBundle,
): AcademicPrepReviewResult | AcademicHandoffResult {
  if (isAcademicFormalHandoffBundle(bundle)) return validateAcademicFormalHandoff(registry, bundle);
  return reviewAcademicPreparatoryHandoff(registry, bundle);
}

export function reviewAcademicPreparatoryHandoff(
  registry: IndustrySchemaRegistry,
  bundle: AcademicHandoffBundle,
): AcademicPrepReviewResult {
  const artifacts: ProducedArtifact<unknown>[] = [
    ...bundle.event_batches,
    ...bundle.coverage_reports,
    ...bundle.contributions,
    bundle.daily_input,
  ];
  const refs = new Set(artifacts.map((artifact) => artifact.ref).filter(hasText));

  if (
    bundle.event_batches.length !== 8 ||
    bundle.coverage_reports.length !== 2 ||
    bundle.contributions.length !== 2 ||
    refs.size !== artifacts.length
  ) {
    return { ok: false, reasonCode: "lineage_failed", message: "Academic preparatory bundle is missing required artifacts." };
  }

  for (const artifact of artifacts) {
    if (!hasText(artifact.ref) || !artifact.payload || !artifact.manifest || !artifact.message) {
      return { ok: false, reasonCode: "lineage_failed", message: "Academic artifact is missing ref, payload, manifest, or message." };
    }
    if (artifact.manifest.artifact_ref !== artifact.ref || artifact.message.payload_ref !== artifact.ref) {
      return { ok: false, reasonCode: "lineage_failed", message: `Academic artifact lineage does not resolve: ${artifact.ref}` };
    }
    if (artifact.message.payload_schema !== artifact.payload_schema) {
      return { ok: false, reasonCode: "schema_mismatch", message: `Academic message schema mismatch: ${artifact.ref}` };
    }
    const inputRefs = artifact.message.input_artifact_refs;
    if (Array.isArray(inputRefs) && inputRefs.some((ref) => !refs.has(ref))) {
      return { ok: false, reasonCode: "lineage_failed", message: `Academic input ref is unresolved: ${artifact.ref}` };
    }
  }

  if (!bundle.event_batches.every((artifact) => artifact.payload_schema === "industry-signal-event-batch.v1")) {
    return { ok: false, reasonCode: "schema_mismatch", message: "Academic event batches must use industry-signal-event-batch.v1." };
  }
  if (!bundle.coverage_reports.every((artifact) => artifact.payload_schema === "axis-tool-coverage-report.v1")) {
    return { ok: false, reasonCode: "schema_mismatch", message: "Academic coverage reports must use axis-tool-coverage-report.v1." };
  }
  if (!bundle.contributions.every((artifact) => artifact.payload_schema === "industry-agent-contribution.v1")) {
    return { ok: false, reasonCode: "schema_mismatch", message: "Academic contributions must use industry-agent-contribution.v1." };
  }
  if (bundle.daily_input.payload_schema !== "daily-industry-evidence-pack-input.v1") {
    return { ok: false, reasonCode: "schema_mismatch", message: "Academic daily input must use daily-industry-evidence-pack-input.v1." };
  }
  for (const schemaId of [
    "industry-signal-event-batch.v1",
    "axis-tool-coverage-report.v1",
    "industry-agent-contribution.v1",
    "daily-industry-evidence-pack-input.v1",
  ]) {
    if (!knownSchemaExists(registry, schemaId)) {
      return { ok: false, reasonCode: "schema_mismatch", message: `Missing canonical schema for academic handoff: ${schemaId}` };
    }
  }

  const daily = bundle.daily_input.payload;
  if (
    !daily ||
    !hasStringArray(daily.normalized_event_batch_refs, 2) ||
    !hasStringArray(daily.rejected_event_batch_refs, 2) ||
    !hasStringArray(daily.source_message_ids) ||
    !hasStringArray(daily.coverage_refs, 2) ||
    !hasStringArray(daily.contribution_refs, 2) ||
    "accepted_events" in daily ||
    "rejected_events" in daily ||
    "events" in daily
  ) {
    return { ok: false, reasonCode: "lineage_failed", message: "Academic daily input must stay a two-axis lightweight ref index." };
  }
  const dailyRefs = [
    ...daily.normalized_event_batch_refs,
    ...daily.rejected_event_batch_refs,
    ...daily.coverage_refs,
    ...daily.contribution_refs,
  ];
  if (dailyRefs.some((ref) => !refs.has(ref))) {
    return { ok: false, reasonCode: "lineage_failed", message: "Academic daily input references unresolved artifacts." };
  }

  return { ok: true, status: "handoff_ready" };
}
