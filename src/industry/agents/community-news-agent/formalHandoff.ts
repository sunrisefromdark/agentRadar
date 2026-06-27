import crypto from "node:crypto";
import { buildIndustryArtifactRef } from "../../platform/contracts/artifactPaths.ts";
import { canConsumePayloadSchema } from "../../platform/contracts/payloadRegistry.ts";
import type { IndustrySchemaRegistry } from "../../platform/contracts/schemaRegistry.ts";
import { buildProductEcosystemHandoff, type BuildProductEcosystemHandoffInput } from "./handoff.ts";

type HandoffRecord = Record<string, unknown>;

export type ProductEcosystemFormalHandoffBundle = {
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

type DraftArtifact = {
  envelope: HandoffRecord;
  manifest: HandoffRecord;
  payload: HandoffRecord;
};

type DraftAxisArtifacts = {
  accepted: unknown;
  counter: unknown;
  diagnostic: unknown;
  rejected: unknown;
};

type HandoffSchema =
  | "industry-signal-event-batch.v1"
  | "axis-tool-coverage-report.v1"
  | "industry-agent-contribution.v1"
  | "daily-industry-evidence-pack-input.v1";

type FormalItem = {
  draft: DraftArtifact;
  payloadSchema: HandoffSchema;
  artifactKind: string;
  axisKeys: string[];
  eventIds: string[];
  summary: string;
};

const PRODUCT_RESPONSIBILITIES = [
  "product-platform",
  "developer-studio",
  "project-oss",
  "cn-community",
  "global-community",
  "news-pr",
];
const PRODUCT_COVERAGE_AXES = [
  "product_vendor_release",
  "developer_studio",
  "project_open_source",
  "community_discussion",
  "news_pr_narrative",
];
const ALLOWED_HANDOFF_SCHEMAS = new Set<HandoffSchema>([
  "industry-signal-event-batch.v1",
  "axis-tool-coverage-report.v1",
  "industry-agent-contribution.v1",
  "daily-industry-evidence-pack-input.v1",
]);
const KIND_BY_SCHEMA: Record<HandoffSchema, string> = {
  "industry-signal-event-batch.v1": "evidence_batch",
  "axis-tool-coverage-report.v1": "tool_status_report",
  "industry-agent-contribution.v1": "industry_agent_contribution",
  "daily-industry-evidence-pack-input.v1": "daily_industry_evidence_pack_input",
};

export function buildProductEcosystemFormalHandoff(input: BuildProductEcosystemHandoffInput): {
  draft: ReturnType<typeof buildProductEcosystemHandoff>;
  bundle: ProductEcosystemFormalHandoffBundle;
} {
  const draft = buildProductEcosystemHandoff(input);
  const eventItems = [
    ...eventItemsFromAxis(draft.productPlatform),
    ...eventItemsFromAxis(draft.developerStudio),
    ...eventItemsFromAxis(draft.projectOss),
    ...eventItemsFromAxis(draft.cnCommunity),
    ...eventItemsFromAxis(draft.globalCommunity),
    ...eventItemsFromAxis(draft.newsPr),
  ];
  const coverageItems = [
    coverageItem(draft.productPlatform.coverage),
    coverageItem(draft.developerStudio.coverage),
    coverageItem(draft.projectOss.coverage),
    coverageItem(draft.communityDiscussion.coverage),
    coverageItem(draft.newsPr.coverage),
  ];
  const contributionItems = [
    contributionItem(draft.productPlatform.contribution),
    contributionItem(draft.developerStudio.contribution),
    contributionItem(draft.projectOss.contribution),
    contributionItem(draft.cnCommunity.contribution),
    contributionItem(draft.globalCommunity.contribution),
    contributionItem(draft.newsPr.contribution),
  ];
  const nonDailyItems = [...eventItems, ...coverageItems, ...contributionItems];
  const formalRefByDraftRef = new Map<string, string>();
  for (const item of nonDailyItems) {
    const { artifactRef } = makeFormalRef(input.now, item.payloadSchema, text(item.draft.manifest.artifact_ref));
    formalRefByDraftRef.set(text(item.draft.manifest.artifact_ref), artifactRef);
  }

  const contributionRefByResponsibility = new Map<string, string>();
  for (const item of contributionItems) {
    const responsibilityId = responsibilityFromContribution(item.draft.payload) ?? text(item.draft.manifest.responsibility_id);
    contributionRefByResponsibility.set(responsibilityId, requiredMappedRef(formalRefByDraftRef, item.draft.manifest.artifact_ref));
  }
  const coverageRefByAxis = new Map<string, string>();
  for (const item of coverageItems) {
    const axis = axisFromCoverage(item.draft.payload) ?? item.axisKeys[0] ?? "";
    coverageRefByAxis.set(axis, requiredMappedRef(formalRefByDraftRef, item.draft.manifest.artifact_ref));
  }

  const formalArtifacts = [
    ...eventItems.map((item) => buildFormalArtifact(input, item, (artifactRef, messageId) =>
      buildFormalEventPayload(item.draft, artifactRef, messageId, contributionRefByResponsibility, coverageRefByAxis),
    )),
    ...coverageItems.map((item) => buildFormalArtifact(input, item, (_artifactRef, messageId) => buildFormalCoveragePayload(item.draft, messageId))),
    ...contributionItems.map((item) => buildFormalArtifact(input, item, (_artifactRef, messageId) =>
      buildFormalContributionPayload(item.draft, messageId, formalRefByDraftRef),
    )),
  ];

  const dailyItem = dailyInputItem(draft.dailyInput);
  const dailyArtifact = buildFormalArtifact(input, dailyItem, (_artifactRef, messageId) =>
    buildFormalDailyPayload(toDraftArtifact(draft.dailyInput), messageId, formalRefByDraftRef, formalArtifacts),
  );

  return {
    draft,
    bundle: bundleFromArtifacts([...formalArtifacts, dailyArtifact]),
  };
}

export function validateProductEcosystemFormalHandoff(
  registry: IndustrySchemaRegistry,
  bundle: ProductEcosystemFormalHandoffBundle,
): HandoffResult {
  if (bundle.messages.length !== bundle.payloads.length || bundle.messages.length !== bundle.manifests.length) {
    return {
      ok: false,
      reasonCode: "lineage_failed",
      message: "Formal handoff requires one payload and one manifest per message.",
    };
  }

  const manifestRefs = new Set(bundle.manifests.map((manifest) => manifest.artifact_ref).filter(hasText));
  const artifactRefs = new Set(bundle.artifactRefs);
  const payloadByRef = new Map<string, HandoffRecord>();

  for (let index = 0; index < bundle.messages.length; index += 1) {
    const payloadRef = bundle.messages[index]?.payload_ref;
    if (hasText(payloadRef) && bundle.payloads[index]) {
      payloadByRef.set(payloadRef, bundle.payloads[index]);
    }
  }

  for (const message of bundle.messages) {
    const envelope = message;
    if (
      !hasText(envelope.kind) ||
      !hasText(envelope.payload_schema) ||
      !hasText(envelope.from_agent_id) ||
      !hasText(envelope.to_agent_id) ||
      !hasText(envelope.checkpoint_stage) ||
      !hasText(envelope.capability_class) ||
      !Array.isArray(envelope.input_artifact_refs) ||
      !Array.isArray(envelope.output_artifact_refs) ||
      !Array.isArray(envelope.capacity_reservation_refs) ||
      !Array.isArray(envelope.required_depends_on_message_ids) ||
      !Array.isArray(envelope.advisory_depends_on_message_ids) ||
      !hasText(envelope.idempotency_key)
    ) {
      return { ok: false, reasonCode: "schema_mismatch", message: "Message is missing required formal envelope fields." };
    }

    if (!hasText(envelope.payload_ref)) {
      return { ok: false, reasonCode: "lineage_failed", message: "Message is missing payload_ref." };
    }

    if (!manifestRefs.has(envelope.payload_ref) && !artifactRefs.has(envelope.payload_ref)) {
      return { ok: false, reasonCode: "lineage_failed", message: `Unresolved payload_ref: ${envelope.payload_ref}` };
    }

    if (!isAllowedHandoffSchema(envelope.payload_schema)) {
      return { ok: false, reasonCode: "schema_mismatch", message: `Unsupported product ecosystem schema: ${envelope.payload_schema}` };
    }

    if (envelope.kind !== KIND_BY_SCHEMA[envelope.payload_schema]) {
      return { ok: false, reasonCode: "schema_mismatch", message: `Message kind does not match payload_schema: ${envelope.payload_schema}` };
    }

    const payload = payloadByRef.get(envelope.payload_ref);
    if (!payload) {
      return { ok: false, reasonCode: "lineage_failed", message: `Missing payload for payload_ref: ${envelope.payload_ref}` };
    }

    if (payload.payload_schema !== envelope.payload_schema) {
      return { ok: false, reasonCode: "schema_mismatch", message: `Payload schema does not match envelope: ${envelope.payload_ref}` };
    }

    if (payload.source_message_id !== envelope.message_id) {
      return { ok: false, reasonCode: "lineage_failed", message: `Payload source_message_id does not match envelope: ${envelope.payload_ref}` };
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
        message: "Claim-critical handoff requires complete same-run dispatch refs.",
      };
    }
  }

  for (const payload of bundle.payloads) {
    if (!hasText(payload.payload_schema) || !hasText(payload.schema_version)) {
      return { ok: false, reasonCode: "schema_mismatch", message: "Payload is missing schema identity." };
    }

    if (!isAllowedHandoffSchema(payload.payload_schema)) {
      return { ok: false, reasonCode: "schema_mismatch", message: `Unsupported product ecosystem payload schema: ${payload.payload_schema}` };
    }

    const compatibilityError = canConsumeHandoffSchema(registry, payload.payload_schema, payload.schema_version);
    if (compatibilityError) return compatibilityError;
  }

  const coveragePayloads = bundle.payloads.filter((payload) => payload.payload_schema === "axis-tool-coverage-report.v1");
  const contributionPayloads = bundle.payloads.filter((payload) => payload.payload_schema === "industry-agent-contribution.v1");
  if (coveragePayloads.length !== 5 || contributionPayloads.length !== 6) {
    return { ok: false, reasonCode: "lineage_failed", message: "Product ecosystem handoff requires 5 coverage payloads and 6 contribution payloads." };
  }

  const coverageAxes = new Set(coveragePayloads.map((payload) => payload.axis).filter(hasText));
  for (const axis of PRODUCT_COVERAGE_AXES) {
    if (!coverageAxes.has(axis)) return { ok: false, reasonCode: "lineage_failed", message: `Missing coverage axis: ${axis}` };
  }

  const responsibilities = new Set(contributionPayloads.map((payload) => payload.responsibility_id).filter(hasText));
  for (const responsibility of PRODUCT_RESPONSIBILITIES) {
    if (!responsibilities.has(responsibility)) {
      return { ok: false, reasonCode: "lineage_failed", message: `Missing product ecosystem responsibility: ${responsibility}` };
    }
  }

  const dailyInput = bundle.payloads.find((payload) => payload.payload_schema === "daily-industry-evidence-pack-input.v1");
  if (!dailyInput) {
    return { ok: false, reasonCode: "lineage_failed", message: "Missing daily industry evidence pack input." };
  }

  if (
    !hasStringArray(dailyInput.normalized_event_batch_refs) ||
    !hasStringArray(dailyInput.source_message_ids) ||
    !hasStringArray(dailyInput.coverage_refs, 5) ||
    !hasStringArray(dailyInput.contribution_refs, 6)
  ) {
    return { ok: false, reasonCode: "lineage_failed", message: "Daily input must use product ecosystem ref arrays." };
  }

  if (dailyInput.rejected_event_batch_refs !== undefined && !hasStringArray(dailyInput.rejected_event_batch_refs)) {
    return { ok: false, reasonCode: "lineage_failed", message: "Daily rejected refs must remain a ref array when present." };
  }

  if ("events" in dailyInput || "accepted_events" in dailyInput || "rejected_events" in dailyInput) {
    return { ok: false, reasonCode: "lineage_failed", message: "Daily input must not embed event snapshots." };
  }

  const dailyRefs = [
    ...asStringArray(dailyInput.normalized_event_batch_refs),
    ...asStringArray(dailyInput.rejected_event_batch_refs),
    ...asStringArray(dailyInput.coverage_refs),
    ...asStringArray(dailyInput.contribution_refs),
  ];
  for (const ref of dailyRefs) {
    if (!manifestRefs.has(ref) && !artifactRefs.has(ref)) {
      return { ok: false, reasonCode: "lineage_failed", message: `Daily input contains unresolved artifact ref: ${ref}` };
    }
  }

  const normalizedAxes = new Set(asStringArray(dailyInput.normalized_event_batch_refs).map((ref) => payloadByRef.get(ref)?.axis).filter(hasText));
  for (const axis of PRODUCT_COVERAGE_AXES) {
    if (!normalizedAxes.has(axis)) return { ok: false, reasonCode: "lineage_failed", message: `Daily input misses normalized axis: ${axis}` };
  }

  return { ok: true, status: "accepted_for_dry_run" };
}

function eventItemsFromAxis(axisArtifacts: DraftAxisArtifacts): FormalItem[] {
  return [
    eventItem(toDraftArtifact(axisArtifacts.accepted)),
    eventItem(toDraftArtifact(axisArtifacts.counter)),
    eventItem(toDraftArtifact(axisArtifacts.diagnostic)),
    eventItem(toDraftArtifact(axisArtifacts.rejected)),
  ];
}

function eventItem(draft: DraftArtifact): FormalItem {
  return {
    draft,
    payloadSchema: "industry-signal-event-batch.v1",
    artifactKind: "event-batch",
    axisKeys: asStringArray(draft.manifest.axis_keys),
    eventIds: asStringArray(draft.manifest.event_ids),
    summary: text(draft.manifest.summary) || "product ecosystem event batch",
  };
}

function coverageItem(value: unknown): FormalItem {
  const draft = toDraftArtifact(value);
  return {
    draft,
    payloadSchema: "axis-tool-coverage-report.v1",
    artifactKind: "tool-coverage-report",
    axisKeys: asStringArray(draft.manifest.axis_keys),
    eventIds: asStringArray(draft.manifest.event_ids),
    summary: text(draft.manifest.summary) || "product ecosystem coverage",
  };
}

function contributionItem(value: unknown): FormalItem {
  const draft = toDraftArtifact(value);
  return {
    draft,
    payloadSchema: "industry-agent-contribution.v1",
    artifactKind: "agent-contribution",
    axisKeys: asStringArray(draft.manifest.axis_keys),
    eventIds: asStringArray(draft.manifest.event_ids),
    summary: text(draft.manifest.summary) || "product ecosystem contribution",
  };
}

function dailyInputItem(value: unknown): FormalItem {
  const draft = toDraftArtifact(value);
  return {
    draft,
    payloadSchema: "daily-industry-evidence-pack-input.v1",
    artifactKind: "daily-pack-input",
    axisKeys: PRODUCT_COVERAGE_AXES,
    eventIds: [],
    summary: "product ecosystem daily input",
  };
}

function toDraftArtifact(value: unknown): DraftArtifact {
  const artifact = record(value);
  return {
    envelope: record(artifact.envelope),
    manifest: record(artifact.manifest),
    payload: record(artifact.payload),
  };
}

function buildFormalArtifact(
  input: BuildProductEcosystemHandoffInput,
  item: FormalItem,
  buildPayload: (artifactRef: string, messageId: string) => HandoffRecord,
): DraftArtifact {
  const { artifactRef, storagePath } = makeFormalRef(input.now, item.payloadSchema, text(item.draft.manifest.artifact_ref));
  const messageId = stableId("msg", `${input.runId}:${artifactRef}`);
  const payload = buildPayload(artifactRef, messageId);
  const serializedPayload = JSON.stringify(payload);
  const responsibilityId = text(payload.responsibility_id) || text(item.draft.manifest.responsibility_id) || undefined;
  const manifest: HandoffRecord = {
    artifact_ref: artifactRef,
    artifact_kind: item.artifactKind,
    schema_version: "1.0.0",
    produced_by_agent_id: text(item.draft.manifest.produced_by_agent_id) || text(item.draft.envelope.from_agent_id),
    responsibility_id: responsibilityId,
    produced_at: input.now,
    source_message_id: messageId,
    input_artifact_refs: [],
    event_ids: item.eventIds,
    claim_ids: [],
    axis_keys: item.axisKeys,
    visibility_tier: "internal_only",
    contains_raw_text: false,
    contains_profile_urls: false,
    content_hash: sha256(serializedPayload),
    storage_path: storagePath,
    summary_cn: item.summary,
  };
  const envelope: HandoffRecord = {
    message_id: messageId,
    schema_version: "industry-agent-message.v1",
    thread_id: input.threadId,
    run_id: input.runId,
    window_start: input.windowStart,
    window_end: input.windowEnd,
    sent_at: input.now,
    from_agent_id: text(item.draft.envelope.from_agent_id),
    to_agent_id: "broadcast",
    responsibility_id: responsibilityId,
    checkpoint_stage: "packaging",
    capability_class: "projection",
    kind: KIND_BY_SCHEMA[item.payloadSchema],
    payload_schema: item.payloadSchema,
    payload_ref: artifactRef,
    input_artifact_refs: [],
    output_artifact_refs: [artifactRef],
    capacity_reservation_refs: [],
    required_depends_on_message_ids: [],
    advisory_depends_on_message_ids: [],
    idempotency_key: stableId("idem", artifactRef),
    status: "sent",
    visibility_tier: "internal_only",
    contains_raw_text: false,
    contains_profile_urls: false,
  };

  return { envelope, manifest, payload };
}

function buildFormalEventPayload(
  draft: DraftArtifact,
  artifactRef: string,
  messageId: string,
  contributionRefByResponsibility: Map<string, string>,
  coverageRefByAxis: Map<string, string>,
): HandoffRecord {
  const payload = draft.payload;
  const responsibilityId = text(payload.responsibility_id);
  const axis = text(payload.axis);
  const bucket = text(payload.bucket);
  const events = Array.isArray(payload.events) ? payload.events : [];
  const rawToolOutputRefs = events.map((event) => record(record(event).evidence).raw_ref).filter(hasText);

  return {
    payload_schema: "industry-signal-event-batch.v1",
    schema_version: text(payload.schema_version) || "1.0.0",
    payload_id: text(payload.payload_id),
    run_id: text(payload.run_id),
    window_start: text(draft.envelope.window_start),
    window_end: text(draft.envelope.window_end),
    source_message_id: messageId,
    events_ref: artifactRef,
    raw_tool_output_refs: rawToolOutputRefs,
    agent_contribution_ref: contributionRefByResponsibility.get(responsibilityId) ?? "",
    tool_status_report_refs: coverageRefByAxis.has(axis) ? [coverageRefByAxis.get(axis)] : [],
    responsibility_id: responsibilityId,
    metric_input_completeness: {
      accepted_event_count: bucket === "accepted" ? events.length : 0,
      counter_event_count: bucket === "counter" ? events.length : 0,
      diagnostic_event_count: bucket === "diagnostic" ? events.length : 0,
      rejected_event_count: bucket === "rejected" ? events.length : 0,
    },
    axis,
    bucket,
    events,
  };
}

function buildFormalCoveragePayload(draft: DraftArtifact, messageId: string): HandoffRecord {
  const payload = draft.payload;
  const report = record(payload.report);
  const activeToolIds = asStringArray(report.active_tool_ids);
  const activeRouteLevel = text(report.active_route_level) || "none";
  const activeSourceClass = text(report.active_source_class) || "none";
  const degradationReasonCodes = asStringArray(report.degradation_reason_codes);
  const acceptedRefCount = numberValue(report.accepted_ref_count);
  const evidenceEventIds = asStringArray(report.evidence_event_ids);
  const summary = text(report.summary_cn) || text(report.summary) || "product ecosystem coverage";

  return {
    payload_schema: "axis-tool-coverage-report.v1",
    schema_version: text(payload.schema_version) || "1.0.0",
    payload_id: text(payload.payload_id),
    run_id: text(payload.run_id),
    source_message_id: messageId,
    responsibility_id: text(payload.responsibility_id),
    axis: text(report.axis),
    primary_tool_ids: activeRouteLevel === "primary_tool" ? activeToolIds : [],
    secondary_toolset_ids: activeRouteLevel === "secondary_toolset" ? activeToolIds : [],
    fallback_tool_ids: activeRouteLevel === "fallback_tools" ? activeToolIds : [],
    last_resort_tool_ids: activeRouteLevel === "last_resort_mode" ? activeToolIds : [],
    eligible_tool_ids: activeToolIds,
    selected_from_tool_ids: activeToolIds,
    attempted_tool_ids: activeToolIds,
    active_route_level: activeRouteLevel,
    active_tool_ids: activeToolIds,
    active_source_class: activeSourceClass,
    route_status: routeStatus(activeRouteLevel),
    budget_status: {
      profile_id: "axis-runtime-budget-profile.v1/product_ecosystem",
      budget_exceeded: false,
      spent_summary_cn: "within budget",
    },
    degraded: Boolean(report.degraded),
    degradation_reason_codes: degradationReasonCodes,
    candidate_ref_count: numberValue(report.candidate_ref_count),
    accepted_ref_count: acceptedRefCount,
    citation_trace_rate: acceptedRefCount === 0 ? 0 : 1,
    evidence_event_ids: evidenceEventIds,
    rejected_event_ids: asStringArray(report.rejected_event_ids),
    registry_snapshot_ref: text(report.registry_snapshot_ref),
    tool_registry_snapshot_ref: text(report.tool_registry_snapshot_ref),
    summary_cn: summary,
    report: { ...report, summary_cn: summary },
  };
}

function buildFormalContributionPayload(draft: DraftArtifact, messageId: string, formalRefByDraftRef: Map<string, string>): HandoffRecord {
  const payload = draft.payload;
  const contribution = record(payload.contribution);
  const responsibilityId = text(contribution.responsibility_id);
  const inputArtifactRefs = mapRefs(asStringArray(contribution.input_artifact_refs), formalRefByDraftRef);
  const outputArtifactRefs = mapRefs(asStringArray(contribution.output_artifact_refs), formalRefByDraftRef);
  const formalContribution = {
    ...contribution,
    input_artifact_refs: inputArtifactRefs,
    output_artifact_refs: outputArtifactRefs,
    contribution_summary_cn: text(contribution.contribution_summary_cn) || text(contribution.contribution_summary),
  };

  return {
    payload_schema: "industry-agent-contribution.v1",
    schema_version: text(payload.schema_version) || "1.0.0",
    payload_id: text(payload.payload_id),
    run_id: text(payload.run_id),
    window_start: text(draft.envelope.window_start),
    window_end: text(draft.envelope.window_end),
    source_message_id: messageId,
    actual_agent_id: text(contribution.handled_by_agent_id) || text(draft.envelope.from_agent_id),
    responsibility_id: responsibilityId,
    status: text(contribution.status),
    input_artifact_refs: inputArtifactRefs,
    output_artifact_refs: outputArtifactRefs,
    contribution: formalContribution,
  };
}

function buildFormalDailyPayload(
  draft: DraftArtifact,
  messageId: string,
  formalRefByDraftRef: Map<string, string>,
  upstreamArtifacts: DraftArtifact[],
): HandoffRecord {
  const payload = draft.payload;

  return {
    payload_schema: "daily-industry-evidence-pack-input.v1",
    schema_version: text(payload.schema_version) || "1.0.0",
    payload_id: text(payload.payload_id),
    run_id: text(payload.run_id),
    window_start: text(payload.window_start),
    window_end: text(payload.window_end),
    source_message_id: messageId,
    source_message_ids: upstreamArtifacts.map((artifact) => text(artifact.envelope.message_id)).filter(hasText),
    normalized_event_batch_refs: mapRefs(asStringArray(payload.normalized_event_batch_refs), formalRefByDraftRef),
    rejected_event_batch_refs: mapRefs(asStringArray(payload.rejected_event_batch_refs), formalRefByDraftRef),
    coverage_refs: mapRefs(asStringArray(payload.coverage_refs), formalRefByDraftRef),
    contribution_refs: mapRefs(asStringArray(payload.contribution_refs), formalRefByDraftRef),
  };
}

function bundleFromArtifacts(artifacts: DraftArtifact[]): ProductEcosystemFormalHandoffBundle {
  return {
    messages: artifacts.map((artifact) => artifact.envelope),
    manifests: artifacts.map((artifact) => artifact.manifest),
    payloads: artifacts.map((artifact) => artifact.payload),
    artifactRefs: artifacts.map((artifact) => text(artifact.manifest.artifact_ref)).filter(hasText),
  };
}

function canConsumeHandoffSchema(
  registry: IndustrySchemaRegistry,
  schemaId: HandoffSchema,
  producerVersion: string,
): Exclude<HandoffResult, { ok: true }> | undefined {
  const result = canConsumePayloadSchema(registry, schemaId, producerVersion);
  if (result.ok) return undefined;

  const entry = registry.compatibility.entries.find((item) => item.schema_id === schemaId);
  if (!entry) {
    return {
      ok: false,
      reasonCode: result.reasonCode,
      message: result.message,
    };
  }

  if (major(entry.current_version) !== major(producerVersion)) {
    return {
      ok: false,
      reasonCode: "unsupported_version",
      message: `Unsupported major version for ${schemaId}: ${producerVersion}`,
    };
  }

  return undefined;
}

function makeFormalRef(now: string, payloadSchema: HandoffSchema, draftArtifactRef: string): { artifactRef: string; storagePath: string } {
  return buildIndustryArtifactRef({
    visibility: "internal",
    date: now.slice(0, 10),
    schemaId: payloadSchema,
    artifactId: stableId("artifact", `${payloadSchema}:${draftArtifactRef}`),
  });
}

function routeStatus(activeRouteLevel: string): HandoffRecord {
  return {
    primary_tool: routeState(activeRouteLevel, "primary_tool"),
    secondary_toolset: routeState(activeRouteLevel, "secondary_toolset"),
    fallback_tools: routeState(activeRouteLevel, "fallback_tools"),
    last_resort_mode: routeState(activeRouteLevel, "last_resort_mode"),
  };
}

function routeState(activeRouteLevel: string, routeLevel: string): HandoffRecord {
  return activeRouteLevel === routeLevel
    ? { state: "available", reason_codes: [] }
    : { state: "unavailable", reason_codes: ["not_selected"] };
}

function isAllowedHandoffSchema(value: unknown): value is HandoffSchema {
  return hasText(value) && ALLOWED_HANDOFF_SCHEMAS.has(value as HandoffSchema);
}

function responsibilityFromContribution(payload: HandoffRecord): string | undefined {
  const contribution = record(payload.contribution);
  const responsibilityId = text(contribution.responsibility_id);
  return responsibilityId || undefined;
}

function axisFromCoverage(payload: HandoffRecord): string | undefined {
  const report = record(payload.report);
  const axis = text(report.axis);
  return axis || undefined;
}

function requiredMappedRef(refs: Map<string, string>, value: unknown): string {
  const ref = refs.get(text(value));
  if (!ref) throw new Error(`Missing formal artifact ref for ${text(value)}`);
  return ref;
}

function mapRefs(refs: string[], formalRefByDraftRef: Map<string, string>): string[] {
  return refs.map((ref) => formalRefByDraftRef.get(ref) ?? ref);
}

function record(value: unknown): HandoffRecord {
  return typeof value === "object" && value !== null ? (value as HandoffRecord) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(hasText) : [];
}

function hasStringArray(value: unknown, length?: number): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(hasText) && (length === undefined || value.length === length);
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function major(version: string): string {
  return version.split(".", 1)[0] ?? "";
}

function stableId(prefix: string, raw: string): string {
  return `${prefix}-${sha256(raw).slice(0, 16)}`;
}

function sha256(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
