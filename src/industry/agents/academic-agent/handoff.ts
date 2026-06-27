import { buildConferenceEvents } from "./conferenceEventBuilder.ts";
import { conferenceSourceCatalog } from "./conferenceSourceCatalog.ts";
import { buildContribution } from "./contributionLedger.ts";
import { buildCoverageReport } from "./coverageReport.ts";
import { buildPaperEvents } from "./paperEventBuilder.ts";
import { paperSourceCatalog } from "./paperSourceCatalog.ts";
import { buildIndustryArtifactRef } from "../../platform/contracts/artifactPaths.ts";
import {
  type AcademicFormalHandoffBundle,
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
  responsibilityForAxis,
} from "./types.ts";

const batchOrder: EventBucket[] = ["accepted", "counter", "diagnostic", "rejected"];

function makeManifest(
  ref: string,
  artifactKind: "event-batch" | "tool-coverage-report" | "agent-contribution" | "daily-pack-input",
  producedAt: string,
  storagePath: string,
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
    visibility_tier: "internal_only",
    contains_raw_text: false,
    contains_profile_urls: false,
    content_hash: sha1Json(payload),
    storage_path: storagePath,
    summary_cn: summaryCn,
  };
}

function kindForPayloadSchema(payloadSchema: IndustryAgentMessageEnvelope["payload_schema"]): IndustryAgentMessageEnvelope["kind"] {
  switch (payloadSchema) {
    case "industry-signal-event-batch.v1":
      return "evidence_batch";
    case "axis-tool-coverage-report.v1":
      return "tool_status_report";
    case "industry-agent-contribution.v1":
      return "industry_agent_contribution";
    case "daily-industry-evidence-pack-input.v1":
      return "daily_industry_evidence_pack_input";
  }
}

function makeMessage(
  fixture: ReplayWindowFixture,
  responsibilityId: IndustryAgentMessageEnvelope["responsibility_id"],
  payloadSchema: IndustryAgentMessageEnvelope["payload_schema"],
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
    responsibility_id: responsibilityId,
    checkpoint_stage: "packaging",
    capability_class: "projection",
    kind: kindForPayloadSchema(payloadSchema),
    payload_schema: payloadSchema,
    payload_ref: payloadRef,
    input_artifact_refs: inputArtifactRefs,
    output_artifact_refs: [payloadRef],
    capacity_reservation_refs: [],
    required_depends_on_message_ids: [],
    advisory_depends_on_message_ids: [],
    idempotency_key: sha1Json([fixture.run_id, payloadSchema, payloadRef]),
    status: "sent",
    visibility_tier: "internal_only",
    contains_raw_text: false,
    contains_profile_urls: false,
  };
}

function makeArtifactRef(
  fixture: ReplayWindowFixture,
  schemaId: IndustryAgentMessageEnvelope["payload_schema"],
  artifactName: string,
  identityInput: unknown,
) {
  return buildIndustryArtifactRef({
    visibility: "internal",
    date: fixture.generated_at.slice(0, 10),
    schemaId,
    artifactId: `artifact-${sha1Json([fixture.run_id, schemaId, artifactName, identityInput]).slice(0, 12)}`,
  });
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
  const responsibility = responsibilityForAxis(axis);
  const { artifactRef: ref, storagePath } = makeArtifactRef(
    fixture,
    "industry-signal-event-batch.v1",
    `${axis}-${bucket}`,
    events,
  );
  const payload: EventBatchPayload = {
    payload_schema: "industry-signal-event-batch.v1",
    payload_id: `${fixture.run_id}.${axis}.${bucket}`,
    schema_version: "1.0.0",
    run_id: fixture.run_id,
    window_start: fixture.window_start,
    window_end: fixture.window_end,
    source_message_id: `${ref}#message`,
    raw_tool_output_refs: [],
    agent_contribution_ref: "",
    tool_status_report_refs: [],
    responsibility_id: responsibility,
    axis,
    bucket,
    event_ids: events.map((event) => event.event_id),
    events_ref: ref,
    events,
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
    "event-batch",
    fixture.generated_at,
    storagePath,
    [],
    payload.event_ids,
    [axis],
    payload,
    `${axis} ${bucket} batch`,
  );
  const message = makeMessage(fixture, responsibility, payload.payload_schema, ref, []);
  return { ref, payload_schema: payload.payload_schema, payload, manifest, message };
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

function toFormalPayload(artifact: ProducedArtifact<unknown>): Record<string, unknown> {
  const payload = artifact.payload as Record<string, unknown>;
  return {
    ...payload,
    payload_schema: artifact.payload_schema,
    schema_version: typeof payload.schema_version === "string" ? payload.schema_version : "1.0.0",
  };
}

export function buildAcademicPrepBundle(fixture: ReplayWindowFixture): AcademicHandoffBundle {
  const events = [...buildPaperEvents(fixture.paper_seeds), ...buildConferenceEvents(fixture.conference_seeds)];
  const eventBatches = (["research_paper", "conference_academic"] as const).flatMap((axis) =>
    batchOrder.map((bucket) => buildBatchArtifact(fixture, groupEvents(events, axis, bucket), axis, bucket)),
  );

  const coverageReports = (["research_paper", "conference_academic"] as const).map((axis) => {
    const report = buildCoverageReport(axis, events);
    const responsibility = responsibilityForAxis(axis);
    const { artifactRef: ref, storagePath } = makeArtifactRef(
      fixture,
      "axis-tool-coverage-report.v1",
      `${axis}-coverage`,
      report,
    );
    const manifest = makeManifest(
      ref,
      "tool-coverage-report",
      fixture.generated_at,
      storagePath,
      eventBatches.filter((batch) => batch.payload.axis === axis).map((batch) => batch.ref),
      report.evidence_event_ids,
      [axis],
      report,
      `${axis} coverage report`,
    );
    const message = makeMessage(fixture, responsibility, "axis-tool-coverage-report.v1", ref, manifest.input_artifact_refs);
    return { ref, payload_schema: "axis-tool-coverage-report.v1", payload: report, manifest, message };
  });

  const contributions = (["research_paper", "conference_academic"] as const).map((axis) => {
    const inputArtifactRefs = eventBatches.filter((batch) => batch.payload.axis === axis).map((batch) => batch.ref);
    const responsibility = responsibilityForAxis(axis);
    const contributionIdentity = {
      axis,
      inputArtifactRefs,
      eventIds: events.filter((event) => event.axis === axis).map((event) => event.event_id),
      toolRouteIds: toolIdsForAxis(axis),
    };
    const { artifactRef: ref, storagePath } = makeArtifactRef(
      fixture,
      "industry-agent-contribution.v1",
      `${axis}-contribution`,
      contributionIdentity,
    );
    const contribution = buildContribution(
      axis,
      events,
      fixture.run_id,
      fixture.window_start,
      fixture.window_end,
      inputArtifactRefs,
      ref,
      toolIdsForAxis(axis),
    );
    const manifest = makeManifest(
      ref,
      "agent-contribution",
      fixture.generated_at,
      storagePath,
      inputArtifactRefs,
      events.filter((event) => event.axis === axis).map((event) => event.event_id),
      [axis],
      contribution,
      `${axis} contribution`,
    );
    const message = makeMessage(fixture, responsibility, "industry-agent-contribution.v1", ref, inputArtifactRefs);
    return {
      ref,
      payload_schema: "industry-agent-contribution.v1",
      payload: contribution,
      manifest,
      message,
    };
  });

  const { artifactRef: dailyRef, storagePath: dailyStoragePath } = makeArtifactRef(
    fixture,
    "daily-industry-evidence-pack-input.v1",
    "academic-daily-pack-input",
    {
      normalizedEventBatchRefs: [
        eventBatches.find((batch) => batch.payload.axis === "research_paper" && batch.payload.bucket === "accepted")!.ref,
        eventBatches.find((batch) => batch.payload.axis === "conference_academic" && batch.payload.bucket === "accepted")!.ref,
      ],
      rejectedEventBatchRefs: [
        eventBatches.find((batch) => batch.payload.axis === "research_paper" && batch.payload.bucket === "rejected")!.ref,
        eventBatches.find((batch) => batch.payload.axis === "conference_academic" && batch.payload.bucket === "rejected")!.ref,
      ],
      coverageRefs: coverageReports.map((artifact) => artifact.ref),
      contributionRefs: contributions.map((artifact) => artifact.ref),
    },
  );
  const dailyPayload: LocalDailyIndustryEvidencePackInput = {
    payload_schema: "daily-industry-evidence-pack-input.v1",
    payload_id: `${fixture.run_id}.academic.daily-input`,
    schema_version: "1.0.0",
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
  };
  const dailyManifest = makeManifest(
    dailyRef,
    "daily-pack-input",
    fixture.generated_at,
    dailyStoragePath,
    dailyPayload.input_artifact_refs,
    [],
    ["research_paper", "conference_academic"],
    dailyPayload,
    "academic daily handoff input",
  );
  const dailyMessage = makeMessage(fixture, undefined, dailyPayload.payload_schema, dailyRef, dailyPayload.input_artifact_refs);

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
      payload_schema: dailyPayload.payload_schema,
      payload: dailyPayload,
      manifest: dailyManifest,
      message: dailyMessage,
    },
    events,
  };
}

export function buildAcademicHandoffBundle(fixture: ReplayWindowFixture): AcademicFormalHandoffBundle {
  const bundle = buildAcademicPrepBundle(fixture);
  const artifacts = [...bundle.event_batches, ...bundle.coverage_reports, ...bundle.contributions, bundle.daily_input];

  return {
    messages: artifacts.map((artifact) => ({ ...artifact.message })) as Array<Record<string, unknown>>,
    manifests: artifacts.map((artifact) => ({ ...artifact.manifest })) as Array<Record<string, unknown>>,
    payloads: artifacts.map((artifact) => toFormalPayload(artifact)),
    artifactRefs: artifacts.map((artifact) => artifact.ref),
    replayFixtureRefs: ["fixtures/industry/agents/academic-agent/replay/academic-replay-window.json"],
    evalFixtureRefs: ["fixtures/industry/agents/academic-agent/eval/anti-upgrade-preprint.json"],
    ownerBoundaryFixtureRefs: ["fixtures/industry/agents/academic-agent/owner-boundary/news-relays-paper.json"],
  };
}
