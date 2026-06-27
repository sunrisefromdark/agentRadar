import type { AcademicHandoffBundle, ProducedArtifact } from "../../agents/academic-agent/types.ts";
import type { IndustrySchemaRegistry } from "./schemaRegistry.ts";
import { validatePayloadSchema } from "./schemaRegistry.ts";

type HandoffRecord = Record<string, unknown>;

type AcademicPrepReviewResult =
  | { ok: true; status: "preparatory_review_ready"; promotionReady: false }
  | { ok: false; reasonCode: "schema_mismatch" | "lineage_failed"; message: string };

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasStringArray(value: unknown, length?: number): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(hasText) && (length === undefined || value.length === length);
}

function knownSchemaExists(registry: IndustrySchemaRegistry, schemaId: string): boolean {
  return validatePayloadSchema(registry, schemaId).ok || registry.compatibility.entries.some((entry) => entry.schema_id === schemaId);
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

  if (!bundle.event_batches.every((artifact) => artifact.payload_schema === "event-batch.v1")) {
    return { ok: false, reasonCode: "schema_mismatch", message: "Academic event batches are still expected as preparatory event-batch.v1 seams." };
  }
  if (!bundle.coverage_reports.every((artifact) => artifact.payload_schema === "axis-tool-coverage-report.v1")) {
    return { ok: false, reasonCode: "schema_mismatch", message: "Academic coverage reports must use axis-tool-coverage-report.v1." };
  }
  if (!bundle.contributions.every((artifact) => artifact.payload?.upstream_payload_schema === "industry-agent-contribution.v1")) {
    return { ok: false, reasonCode: "schema_mismatch", message: "Academic contributions must declare their canonical upstream schema." };
  }
  if (bundle.daily_input.payload?.upstream_payload_schema !== "daily-industry-evidence-pack-input.v1") {
    return { ok: false, reasonCode: "schema_mismatch", message: "Academic daily input must declare its canonical upstream schema." };
  }
  for (const schemaId of ["axis-tool-coverage-report.v1", "industry-agent-contribution.v1", "daily-industry-evidence-pack-input.v1"]) {
    if (!knownSchemaExists(registry, schemaId)) {
      return { ok: false, reasonCode: "schema_mismatch", message: `Missing canonical schema for academic preparatory review: ${schemaId}` };
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

  return { ok: true, status: "preparatory_review_ready", promotionReady: false };
}
