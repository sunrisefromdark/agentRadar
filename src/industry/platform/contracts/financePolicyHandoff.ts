import type { IndustrySchemaRegistry } from "./schemaRegistry.ts";
import { canConsumePayloadSchema } from "./payloadRegistry.ts";

type HandoffRecord = Record<string, unknown>;

export type FinancePolicyHandoffBundle = {
  messages: HandoffRecord[];
  manifests: HandoffRecord[];
  payloads: HandoffRecord[];
  artifactRefs: string[];
};

type HandoffResult =
  | { ok: true; status: "accepted_for_dry_run" }
  | {
      ok: false;
      reasonCode: "schema_mismatch" | "unsupported_version" | "lineage_failed" | "dispatch_context_missing";
      message: string;
    };

const REQUIRED_RESPONSIBILITIES = ["capital-finance", "policy-regulatory", "policy-research-thinktank"];
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

function canConsumeHandoffSchema(
  registry: IndustrySchemaRegistry,
  schemaId: string,
  producerVersion: string,
): Exclude<HandoffResult, { ok: true }> | undefined {
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

export function validateFinancePolicyHandoff(
  registry: IndustrySchemaRegistry,
  bundle: FinancePolicyHandoffBundle,
): HandoffResult {
  const manifestRefs = new Set(bundle.manifests.map((manifest) => (manifest as HandoffRecord).artifact_ref).filter(hasText));
  const artifactRefs = new Set(bundle.artifactRefs);

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
        message: `Unsupported finance policy handoff schema: ${envelope.payload_schema}`,
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
        message: `Unsupported finance policy handoff schema: ${payloadRecord.payload_schema}`,
      };
    }

    const compatibilityError = canConsumeHandoffSchema(registry, payloadRecord.payload_schema, payloadRecord.schema_version);
    if (compatibilityError) return compatibilityError;
  }

  const responsibilities = new Set(bundle.payloads.map((payload) => (payload as HandoffRecord).responsibility_id).filter(hasText));
  for (const responsibility of REQUIRED_RESPONSIBILITIES) {
    if (!responsibilities.has(responsibility)) {
      return {
        ok: false,
        reasonCode: "lineage_failed",
        message: `Missing finance policy responsibility: ${responsibility}`,
      };
    }
  }

  const dailyInput = bundle.payloads.find((payload) => (payload as HandoffRecord).payload_schema === "daily-industry-evidence-pack-input.v1") as
    | HandoffRecord
    | undefined;
  if (!dailyInput) {
    return { ok: false, reasonCode: "lineage_failed", message: "Missing daily industry evidence pack input." };
  }

  if (
    !hasStringArray(dailyInput.normalized_event_batch_refs) ||
    !hasStringArray(dailyInput.source_message_ids) ||
    !hasStringArray(dailyInput.coverage_refs, 3) ||
    !hasStringArray(dailyInput.contribution_refs, 3)
  ) {
    return { ok: false, reasonCode: "lineage_failed", message: "Daily input must use canonical ref arrays." };
  }

  if ("accepted_events" in dailyInput || "rejected_events" in dailyInput) {
    return { ok: false, reasonCode: "lineage_failed", message: "Daily input must not embed event snapshots." };
  }

  return { ok: true, status: "accepted_for_dry_run" };
}
