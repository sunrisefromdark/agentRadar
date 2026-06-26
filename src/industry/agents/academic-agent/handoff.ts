import { buildConferenceEvents } from "./conferenceEventBuilder.ts";
import { conferenceSourceCatalog } from "./conferenceSourceCatalog.ts";
import { buildContribution } from "./contributionLedger.ts";
import { buildCoverageReport } from "./coverageReport.ts";
import { buildPaperEvents } from "./paperEventBuilder.ts";
import { paperSourceCatalog } from "./paperSourceCatalog.ts";
import {
  makeArtifactRef,
  makeStoragePath,
  sha1Json,
  type AcademicHandoffBundle,
  type EventBatchPayload,
  type EventBucket,
  type IndustryAgentArtifactManifest,
  type IndustryAgentMessageEnvelope,
  type IndustryEvidenceAxisKey,
  type IndustrySignalEvent,
  type LocalDailyIndustryEvidencePackInput,
  type ProducedArtifact,
  type ReplayWindowFixture,
} from "./types.ts";

const batchOrder: EventBucket[] = ["accepted", "counter", "diagnostic", "rejected"];

function makeManifest(
  ref: string,
  artifactKind: string,
  producedAt: string,
  inputArtifactRefs: string[],
  eventIds: string[],
  axis: IndustryEvidenceAxisKey[],
  payload: unknown,
  summaryCn: string,
): IndustryAgentArtifactManifest {
  return {
    artifact_ref: ref,
    artifact_kind: artifactKind,
    schema_version: "industry-agent-artifact-manifest.v1",
    produced_by_agent_id: "academic-agent",
    produced_at: producedAt,
    input_artifact_refs: inputArtifactRefs,
    event_ids: eventIds,
    claim_ids: [],
    axis_keys: axis,
    visibility_tier: "internal",
    contains_raw_text: false,
    contains_profile_urls: false,
    content_hash: sha1Json(payload),
    storage_path: makeStoragePath(ref.split("/")[3] ?? "run", axis[0] ?? "academic", artifactKind),
    summary_cn: summaryCn,
  };
}

function makeMessage(
  fixture: ReplayWindowFixture,
  payloadSchema: string,
  payloadRef: string,
  inputArtifactRefs: string[],
): IndustryAgentMessageEnvelope {
  const messageId = `${payloadRef}#message`;
  return {
    message_id: messageId,
    schema_version: "industry-agent-message.v1",
    thread_id: fixture.thread_id,
    run_id: fixture.run_id,
    window_start: fixture.window_start,
    window_end: fixture.window_end,
    sent_at: fixture.generated_at,
    from_agent_id: "academic-agent",
    to_agent_id: "normalization-agent",
    checkpoint_stage: "preparatory_handoff",
    capability_class: "academic_evidence",
    kind: "artifact_handoff",
    payload_schema: payloadSchema,
    payload_ref: payloadRef,
    input_artifact_refs: inputArtifactRefs,
    output_artifact_refs: [payloadRef],
    capacity_reservation_refs: [],
    required_depends_on_message_ids: [],
    advisory_depends_on_message_ids: [],
    idempotency_key: sha1Json([fixture.run_id, payloadSchema, payloadRef]),
    status: "ok",
    visibility_tier: "internal",
    contains_raw_text: false,
    contains_profile_urls: false,
  };
}

function groupEvents(events: IndustrySignalEvent[], axis: IndustryEvidenceAxisKey, bucket: EventBucket) {
  return events.filter((event) => event.axis === axis && event.audit.bucket === bucket);
}

function buildBatchArtifact(
  fixture: ReplayWindowFixture,
  events: IndustrySignalEvent[],
  axis: IndustryEvidenceAxisKey,
  bucket: EventBucket,
): ProducedArtifact<EventBatchPayload> {
  const ref = makeArtifactRef(fixture.run_id, axis, `${bucket}-batch`);
  const payload: EventBatchPayload = {
    payload_id: `${fixture.run_id}.${axis}.${bucket}`,
    schema_version: "event-batch.v1",
    run_id: fixture.run_id,
    window_start: fixture.window_start,
    window_end: fixture.window_end,
    source_message_id: `${ref}#message`,
    raw_tool_output_refs: [],
    agent_contribution_ref: `stub://academic-agent/${fixture.run_id}/${axis}/contribution`,
    tool_status_report_refs: [],
    responsibility_id: axis === "research_paper" ? "research-frontier" : "conference-academic",
    axis,
    bucket,
    event_ids: events.map((event) => event.event_id),
    events_ref: ref,
    metric_input_completeness: {
      citation_trace_complete: events.filter((event) => event.evidence.citation_trace_refs.length > 0).length,
      freshness_anchor_complete: events.filter((event) => event.source_published_at).length,
      primary_source_complete: events.filter(
        (event) => event.source.primary_source_distance === "primary" || event.source.primary_source_distance === "near_primary",
      ).length,
    },
  };
  const manifest = makeManifest(
    ref,
    "event_batch",
    fixture.generated_at,
    [],
    payload.event_ids,
    [axis],
    payload,
    `${axis} ${bucket} batch`,
  );
  const message = makeMessage(fixture, payload.schema_version, ref, []);
  return { ref, payload_schema: payload.schema_version, payload, manifest, message };
}

function toolIdsForAxis(axis: IndustryEvidenceAxisKey): string[] {
  const catalog = axis === "research_paper" ? Object.values(paperSourceCatalog) : Object.values(conferenceSourceCatalog);
  return [...new Set(catalog.flatMap((entry) => entry.tool_ids))];
}

function firstArtifactRefForAxis<TPayload>(
  artifacts: ProducedArtifact<TPayload>[],
  axis: IndustryEvidenceAxisKey,
): string | undefined {
  return artifacts.find((artifact) => artifact.manifest.axis_keys.includes(axis))?.ref;
}

export function buildAcademicPrepBundle(fixture: ReplayWindowFixture): AcademicHandoffBundle {
  const events = [...buildPaperEvents(fixture.paper_seeds), ...buildConferenceEvents(fixture.conference_seeds)];
  const eventBatches = (["research_paper", "conference_academic"] as const).flatMap((axis) =>
    batchOrder.map((bucket) => buildBatchArtifact(fixture, groupEvents(events, axis, bucket), axis, bucket)),
  );

  const coverageReports = (["research_paper", "conference_academic"] as const).map((axis) => {
    const report = buildCoverageReport(axis, events);
    const ref = makeArtifactRef(fixture.run_id, axis, "coverage-report");
    const manifest = makeManifest(
      ref,
      "axis_tool_coverage_report",
      fixture.generated_at,
      eventBatches.filter((batch) => batch.payload.axis === axis).map((batch) => batch.ref),
      report.evidence_event_ids,
      [axis],
      report,
      `${axis} coverage report`,
    );
    const message = makeMessage(fixture, "axis-tool-coverage-report.v1", ref, manifest.input_artifact_refs);
    return { ref, payload_schema: "axis-tool-coverage-report.v1", payload: report, manifest, message };
  });

  const contributions = (["research_paper", "conference_academic"] as const).map((axis) => {
    const inputArtifactRefs = eventBatches.filter((batch) => batch.payload.axis === axis).map((batch) => batch.ref);
    const ref = makeArtifactRef(fixture.run_id, axis, "contribution");
    const contribution = buildContribution(axis, events, inputArtifactRefs, ref, toolIdsForAxis(axis));
    const manifest = makeManifest(
      ref,
      "industry_agent_contribution",
      fixture.generated_at,
      inputArtifactRefs,
      events.filter((event) => event.axis === axis).map((event) => event.event_id),
      [axis],
      contribution,
      `${axis} contribution`,
    );
    const message = makeMessage(fixture, "academic-local-industry-agent-contribution.v1", ref, inputArtifactRefs);
    return {
      ref,
      payload_schema: "academic-local-industry-agent-contribution.v1",
      payload: contribution,
      manifest,
      message,
    };
  });

  const dailyRef = makeArtifactRef(fixture.run_id, "academic-agent", "daily-pack-input");
  const dailyPayload: LocalDailyIndustryEvidencePackInput = {
    payload_id: `${fixture.run_id}.academic.daily-input`,
    schema_version: "academic-local-daily-industry-evidence-pack-input.v1",
    run_id: fixture.run_id,
    window_start: fixture.window_start,
    window_end: fixture.window_end,
    source_message_id: `${dailyRef}#message`,
    normalized_event_batch_refs: [
      eventBatches.find((batch) => batch.payload.axis === "research_paper" && batch.payload.bucket === "accepted")!.ref,
      eventBatches.find((batch) => batch.payload.axis === "conference_academic" && batch.payload.bucket === "accepted")!.ref,
    ],
    rejected_event_batch_refs: [
      eventBatches.find((batch) => batch.payload.axis === "research_paper" && batch.payload.bucket === "rejected")!.ref,
      eventBatches.find((batch) => batch.payload.axis === "conference_academic" && batch.payload.bucket === "rejected")!.ref,
    ],
    counter_event_batch_refs: eventBatches.filter((batch) => batch.payload.bucket === "counter").map((batch) => batch.ref),
    diagnostic_event_batch_refs: eventBatches
      .filter((batch) => batch.payload.bucket === "diagnostic")
      .map((batch) => batch.ref),
    source_message_ids: eventBatches.map((batch) => batch.message.message_id),
    coverage_refs: coverageReports.map((artifact) => artifact.ref),
    contribution_refs: contributions.map((artifact) => artifact.ref),
    input_artifact_refs: eventBatches.map((batch) => batch.ref),
    summary_cn: "academic-agent 预交接 daily 输入，仅交 ref 与 lineage，不内嵌胖快照。",
    upstream_payload_schema: "daily-industry-evidence-pack-input.v1",
  };
  const dailyManifest = makeManifest(
    dailyRef,
    "daily_industry_evidence_pack_input",
    fixture.generated_at,
    dailyPayload.input_artifact_refs,
    [],
    ["research_paper", "conference_academic"],
    dailyPayload,
    "academic daily handoff input",
  );
  const dailyMessage = makeMessage(fixture, dailyPayload.schema_version, dailyRef, dailyPayload.input_artifact_refs);

  for (const axis of ["research_paper", "conference_academic"] as const) {
    const contributionRef = firstArtifactRefForAxis(contributions, axis);
    const coverageRef = firstArtifactRefForAxis(coverageReports, axis);
    for (const batch of eventBatches.filter((artifact) => artifact.payload.axis === axis)) {
      if (contributionRef) {
        batch.payload.agent_contribution_ref = contributionRef;
      }
      if (coverageRef) {
        batch.payload.tool_status_report_refs = [coverageRef];
      }
    }
  }

  return {
    event_batches: eventBatches,
    coverage_reports: coverageReports,
    contributions,
    daily_input: {
      ref: dailyRef,
      payload_schema: dailyPayload.schema_version,
      payload: dailyPayload,
      manifest: dailyManifest,
      message: dailyMessage,
    },
    events,
  };
}
