import crypto from "node:crypto";

export type ProductOssAgentId = "product-oss-agent";
export type ProductOssResponsibilityId = "product-platform" | "developer-studio" | "project-oss";
export type ProductOssAxisId = "product_vendor_release" | "developer_studio" | "project_open_source";
export type EvidenceBucket = "accepted" | "counter" | "diagnostic" | "rejected";
export type RouteLevel = "primary_tool" | "secondary_toolset" | "fallback_tools" | "last_resort_mode" | "none";
export type SourceClass =
  | "official_owned_feed_or_doc"
  | "repository_release_feed"
  | "developer_platform_docs"
  | "community_or_news_context"
  | "manual_or_local_only"
  | "none";

export interface ProductExecutionContext {
  primary_responsibility_id: ProductOssResponsibilityId;
  default_owner_agent_id: ProductOssAgentId;
  operational_executor_id: ProductOssAgentId;
  takeover_mode: "none" | "delegated_execution" | "temporary_backfill" | "emergency_manual";
  takeover_audit_ref?: string;
}

export interface ProductSignalEvent {
  event_id: string;
  schema_version: "industry-signal-event.v1";
  observed_at: string;
  source_published_at?: string;
  ingested_at: string;
  axis: ProductOssAxisId;
  bucket: EvidenceBucket;
  source: {
    source_id: string;
    display_name: string;
    source_url?: string;
    source_type:
      | "vendor_release"
      | "api_docs"
      | "release_notes"
      | "customer_case"
      | "developer_docs"
      | "sdk_release"
      | "console_update"
      | "repo_release"
      | "package_version"
      | "model_card"
      | "dependency_adoption"
      | "vendor_blog"
      | "news";
    authority_tier: "core" | "proven" | "watch" | "ordinary" | "excluded";
    primary_source_distance: "primary" | "near_primary" | "secondary" | "rumor" | "unknown";
    language?: "zh" | "en" | "multi" | "unknown";
    region?: string;
  };
  evidence: {
    title: string;
    summary: string;
    url?: string;
    raw_ref: string;
    citation_ref?: string;
  };
  responsibility_id: ProductOssResponsibilityId;
  collected_by_agent_id: ProductOssAgentId;
  execution_context: ProductExecutionContext;
  audit: {
    dedupe_key: string;
    source_chain_key: string;
    direct_owner_responsibility_id: ProductOssResponsibilityId;
    rejected_reason?: string;
    cross_responsibility_attestation_refs: string[];
  };
}

export interface ProductToolCoverageReport {
  axis: ProductOssAxisId;
  active_route_level: RouteLevel;
  active_tool_ids: string[];
  active_source_class: SourceClass;
  degraded: boolean;
  degradation_reason_codes: string[];
  candidate_ref_count: number;
  accepted_ref_count: number;
  evidence_event_ids: string[];
  rejected_event_ids: string[];
  registry_snapshot_ref: string;
  tool_registry_snapshot_ref: string;
  summary: string;
}

export interface ProductAgentContribution {
  responsibility_id: ProductOssResponsibilityId;
  handled_by_agent_id: ProductOssAgentId;
  execution_context: ProductExecutionContext;
  status: "ok" | "partial" | "skipped" | "failed" | "unavailable";
  covered_axes: ProductOssAxisId[];
  event_count: number;
  accepted_event_count: number;
  rejected_event_count: number;
  counter_event_count: number;
  diagnostic_event_count: number;
  input_artifact_refs: string[];
  output_artifact_refs: string[];
  contribution_summary: string;
}

export interface ProductAgentMessageEnvelope {
  kind: "evidence_batch" | "tool_status_report" | "industry_agent_contribution";
  message_id: string;
  schema_version: "industry-agent-message.v1";
  run_id: string;
  thread_id: string;
  window_start: string;
  window_end: string;
  sent_at: string;
  from_agent_id: ProductOssAgentId;
  to_agent_id: "broadcast";
  responsibility_id?: ProductOssResponsibilityId;
  payload_schema: "industry-signal-event-batch.v1" | "axis-tool-coverage-report.v1" | "industry-agent-contribution.v1";
  payload_ref: string;
  output_artifact_refs: string[];
  status: "sent";
}

export interface ProductArtifactManifest {
  artifact_ref: string;
  artifact_kind: "event-batch" | "tool-coverage-report" | "agent-contribution";
  schema_version: string;
  produced_by_agent_id: ProductOssAgentId;
  responsibility_id?: ProductOssResponsibilityId;
  produced_at: string;
  event_ids: string[];
  axis_keys: ProductOssAxisId[];
  content_hash: string;
  storage_path: string;
  summary: string;
}

export interface ProductEventBatchPayload {
  schema_id: "industry-signal-event-batch.v1";
  schema_version: "1.0.0";
  payload_id: string;
  run_id: string;
  responsibility_id: ProductOssResponsibilityId;
  axis: ProductOssAxisId;
  bucket: EvidenceBucket;
  events: ProductSignalEvent[];
}

export interface ProductCoveragePayload {
  schema_id: "axis-tool-coverage-report.v1";
  schema_version: "1.0.0";
  payload_id: string;
  run_id: string;
  responsibility_id: ProductOssResponsibilityId;
  report: ProductToolCoverageReport;
}

export interface ProductContributionPayload {
  schema_id: "industry-agent-contribution.v1";
  schema_version: "1.0.0";
  payload_id: string;
  run_id: string;
  contribution: ProductAgentContribution;
}

export interface ArtifactEnvelope<TPayload> {
  envelope: ProductAgentMessageEnvelope;
  manifest: ProductArtifactManifest;
  payload: TPayload;
}

export interface ProductAxisArtifacts {
  accepted: ArtifactEnvelope<ProductEventBatchPayload>;
  counter: ArtifactEnvelope<ProductEventBatchPayload>;
  diagnostic: ArtifactEnvelope<ProductEventBatchPayload>;
  rejected: ArtifactEnvelope<ProductEventBatchPayload>;
  coverage: ArtifactEnvelope<ProductCoveragePayload>;
  contribution: ArtifactEnvelope<ProductContributionPayload>;
  acceptedEvents: ProductSignalEvent[];
  rejectedEvents: ProductSignalEvent[];
}

export interface ToolRouteDefinition {
  tool_id: string;
  source_class: Exclude<SourceClass, "none">;
}

export interface ProductAxisSeedConfig {
  agent_id: ProductOssAgentId;
  responsibility_id: ProductOssResponsibilityId;
  axis: ProductOssAxisId;
  primary: ToolRouteDefinition[];
  secondary: ToolRouteDefinition[];
  fallback: ToolRouteDefinition[];
  last_resort: ToolRouteDefinition[];
  registry_snapshot_ref: string;
  tool_registry_snapshot_ref: string;
}

export interface ProductSourceInput {
  sourceId: string;
  displayName: string;
  url?: string;
  sourceType: ProductSignalEvent["source"]["source_type"];
  authorityTier: ProductSignalEvent["source"]["authority_tier"];
  primarySourceDistance: ProductSignalEvent["source"]["primary_source_distance"];
  language?: ProductSignalEvent["source"]["language"];
  region?: string;
  publishedAt?: string;
  bucket: EvidenceBucket;
  title: string;
  summary: string;
  topicKey?: string;
  rejectedReason?: string;
  directOwnerResponsibilityId?: ProductOssResponsibilityId;
  crossResponsibilityAttestationRefs?: string[];
}

export interface ProductRouteSelectionInput {
  availableToolIds: string[];
  attemptedToolIds?: string[];
  canonicalSourceAvailable: boolean;
  degradationReasonCodes?: string[];
}

export interface ProductRouteSelectionResult {
  routeLevel: RouteLevel;
  activeToolIds: string[];
  activeSourceClass: SourceClass;
  degraded: boolean;
  degradationReasonCodes: string[];
}

export interface BuildProductAxisInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  seed: ProductAxisSeedConfig;
  routeSelection: ProductRouteSelectionResult;
  sources: ProductSourceInput[];
}

export function createProductExecutionContext(responsibilityId: ProductOssResponsibilityId): ProductExecutionContext {
  return {
    primary_responsibility_id: responsibilityId,
    default_owner_agent_id: "product-oss-agent",
    operational_executor_id: "product-oss-agent",
    takeover_mode: "none",
  };
}

export function selectProductRoute(seed: ProductAxisSeedConfig, input: ProductRouteSelectionInput): ProductRouteSelectionResult {
  const available = new Set(input.availableToolIds);
  const routeOrder: Array<{ level: Exclude<RouteLevel, "none">; tools: ToolRouteDefinition[] }> = [
    { level: "primary_tool", tools: seed.primary },
    { level: "secondary_toolset", tools: seed.secondary },
    { level: "fallback_tools", tools: seed.fallback },
    { level: "last_resort_mode", tools: seed.last_resort },
  ];
  const reasonCodes = new Set(input.degradationReasonCodes ?? []);
  if (!input.canonicalSourceAvailable) reasonCodes.add("no_canonical_source_available");

  for (const item of routeOrder) {
    const activeTools = item.tools.filter((tool) => available.has(tool.tool_id));
    if (activeTools.length === 0) continue;
    const activeSourceClass = activeTools[0]?.source_class ?? "none";
    const degraded = item.level !== "primary_tool" || !input.canonicalSourceAvailable || activeSourceClass === "manual_or_local_only";
    if (item.level !== "primary_tool") reasonCodes.add(`route_${item.level}`);
    if (activeSourceClass === "manual_or_local_only") reasonCodes.add("manual_last_resort_only");
    return {
      routeLevel: item.level,
      activeToolIds: activeTools.map((tool) => tool.tool_id),
      activeSourceClass,
      degraded,
      degradationReasonCodes: Array.from(reasonCodes),
    };
  }

  return {
    routeLevel: "none",
    activeToolIds: [],
    activeSourceClass: "none",
    degraded: true,
    degradationReasonCodes: Array.from(reasonCodes.size > 0 ? reasonCodes : new Set(["no_route_available"])),
  };
}

export function buildProductAxisArtifacts(input: BuildProductAxisInput): ProductAxisArtifacts {
  const events = input.sources.map((source) => buildProductEvent(input, source));
  const acceptedEvents = events.filter((event) => event.bucket === "accepted");
  const counterEvents = events.filter((event) => event.bucket === "counter");
  const diagnosticEvents = events.filter((event) => event.bucket === "diagnostic");
  const rejectedEvents = events.filter((event) => event.bucket === "rejected");

  const accepted = buildProductEventBatch(input, "accepted", acceptedEvents);
  const counter = buildProductEventBatch(input, "counter", counterEvents);
  const diagnostic = buildProductEventBatch(input, "diagnostic", diagnosticEvents);
  const rejected = buildProductEventBatch(input, "rejected", rejectedEvents);
  const coverage = buildProductCoverage(input, acceptedEvents, rejectedEvents);
  const contribution = buildProductContribution(input, accepted, counter, diagnostic, rejected);

  return { accepted, counter, diagnostic, rejected, coverage, contribution, acceptedEvents, rejectedEvents };
}

function buildProductEvent(input: BuildProductAxisInput, source: ProductSourceInput): ProductSignalEvent {
  const eventBase = `${input.runId}:${input.seed.responsibility_id}:${source.sourceId}:${source.title}:${source.bucket}`;
  return {
    event_id: stableId("evt", eventBase),
    schema_version: "industry-signal-event.v1",
    observed_at: input.now,
    source_published_at: source.publishedAt,
    ingested_at: input.now,
    axis: input.seed.axis,
    bucket: source.bucket,
    source: {
      source_id: source.sourceId,
      display_name: source.displayName,
      source_url: source.url,
      source_type: source.sourceType,
      authority_tier: source.authorityTier,
      primary_source_distance: source.primarySourceDistance,
      language: source.language ?? "unknown",
      region: source.region ?? "global",
    },
    evidence: {
      title: source.title,
      summary: source.summary,
      url: source.url,
      raw_ref: `raw://${stableId("raw", eventBase)}`,
      citation_ref: source.url ? `citation://${stableId("cite", source.url)}` : undefined,
    },
    responsibility_id: input.seed.responsibility_id,
    collected_by_agent_id: input.seed.agent_id,
    execution_context: createProductExecutionContext(input.seed.responsibility_id),
    audit: {
      dedupe_key: stableId("dedupe", `${input.seed.axis}:${source.sourceId}:${source.title}`),
      source_chain_key: stableId("chain", `${source.sourceId}:${source.url ?? source.title}`),
      direct_owner_responsibility_id: source.directOwnerResponsibilityId ?? input.seed.responsibility_id,
      rejected_reason: source.rejectedReason,
      cross_responsibility_attestation_refs: source.crossResponsibilityAttestationRefs ?? [],
    },
  };
}

function buildProductEventBatch(
  input: BuildProductAxisInput,
  bucket: EvidenceBucket,
  events: ProductSignalEvent[],
): ArtifactEnvelope<ProductEventBatchPayload> {
  const payload: ProductEventBatchPayload = {
    schema_id: "industry-signal-event-batch.v1",
    schema_version: "1.0.0",
    payload_id: stableId("payload", `${input.runId}:${input.seed.axis}:${bucket}`),
    run_id: input.runId,
    responsibility_id: input.seed.responsibility_id,
    axis: input.seed.axis,
    bucket,
    events,
  };
  return buildProductArtifactEnvelope(input, "industry-signal-event-batch.v1", "event-batch", payload, events.map((event) => event.event_id), `${input.seed.axis} ${bucket}`);
}

function buildProductCoverage(
  input: BuildProductAxisInput,
  acceptedEvents: ProductSignalEvent[],
  rejectedEvents: ProductSignalEvent[],
): ArtifactEnvelope<ProductCoveragePayload> {
  const report: ProductToolCoverageReport = {
    axis: input.seed.axis,
    active_route_level: input.routeSelection.routeLevel,
    active_tool_ids: input.routeSelection.activeToolIds,
    active_source_class: input.routeSelection.activeSourceClass,
    degraded: input.routeSelection.degraded,
    degradation_reason_codes: input.routeSelection.degradationReasonCodes,
    candidate_ref_count: input.sources.length,
    accepted_ref_count: acceptedEvents.length,
    evidence_event_ids: acceptedEvents.map((event) => event.event_id),
    rejected_event_ids: rejectedEvents.map((event) => event.event_id),
    registry_snapshot_ref: input.seed.registry_snapshot_ref,
    tool_registry_snapshot_ref: input.seed.tool_registry_snapshot_ref,
    summary: `${input.seed.axis} coverage draft`,
  };
  const payload: ProductCoveragePayload = {
    schema_id: "axis-tool-coverage-report.v1",
    schema_version: "1.0.0",
    payload_id: stableId("payload", `${input.runId}:${input.seed.axis}:coverage`),
    run_id: input.runId,
    responsibility_id: input.seed.responsibility_id,
    report,
  };
  return buildProductArtifactEnvelope(input, "axis-tool-coverage-report.v1", "tool-coverage-report", payload, [...report.evidence_event_ids, ...report.rejected_event_ids], `${input.seed.axis} coverage`);
}

function buildProductContribution(
  input: BuildProductAxisInput,
  accepted: ArtifactEnvelope<ProductEventBatchPayload>,
  counter: ArtifactEnvelope<ProductEventBatchPayload>,
  diagnostic: ArtifactEnvelope<ProductEventBatchPayload>,
  rejected: ArtifactEnvelope<ProductEventBatchPayload>,
): ArtifactEnvelope<ProductContributionPayload> {
  const acceptedCount = accepted.payload.events.length;
  const counterCount = counter.payload.events.length;
  const diagnosticCount = diagnostic.payload.events.length;
  const rejectedCount = rejected.payload.events.length;
  const contribution: ProductAgentContribution = {
    responsibility_id: input.seed.responsibility_id,
    handled_by_agent_id: input.seed.agent_id,
    execution_context: createProductExecutionContext(input.seed.responsibility_id),
    status: input.routeSelection.routeLevel === "none" ? "unavailable" : input.routeSelection.degraded ? "partial" : "ok",
    covered_axes: [input.seed.axis],
    event_count: acceptedCount + counterCount + diagnosticCount + rejectedCount,
    accepted_event_count: acceptedCount,
    rejected_event_count: rejectedCount,
    counter_event_count: counterCount,
    diagnostic_event_count: diagnosticCount,
    input_artifact_refs: [],
    output_artifact_refs: [accepted.manifest.artifact_ref, counter.manifest.artifact_ref, diagnostic.manifest.artifact_ref, rejected.manifest.artifact_ref],
    contribution_summary: `${input.seed.responsibility_id} contribution draft`,
  };
  const payload: ProductContributionPayload = {
    schema_id: "industry-agent-contribution.v1",
    schema_version: "1.0.0",
    payload_id: stableId("payload", `${input.runId}:${input.seed.responsibility_id}:contribution`),
    run_id: input.runId,
    contribution,
  };
  return buildProductArtifactEnvelope(input, "industry-agent-contribution.v1", "agent-contribution", payload, accepted.payload.events.map((event) => event.event_id), `${input.seed.responsibility_id} contribution`);
}

function buildProductArtifactEnvelope<TPayload>(
  input: BuildProductAxisInput,
  payloadSchema: ProductAgentMessageEnvelope["payload_schema"],
  artifactKind: ProductArtifactManifest["artifact_kind"],
  payload: TPayload,
  eventIds: string[],
  summary: string,
): ArtifactEnvelope<TPayload> {
  const serializedPayload = JSON.stringify(payload);
  const artifactRef = `artifact://${input.runId}/${stableId("artifact", `${payloadSchema}:${serializedPayload}`)}`;
  const manifest: ProductArtifactManifest = {
    artifact_ref: artifactRef,
    artifact_kind: artifactKind,
    schema_version: "1.0.0",
    produced_by_agent_id: input.seed.agent_id,
    responsibility_id: input.seed.responsibility_id,
    produced_at: input.now,
    event_ids: eventIds,
    axis_keys: [input.seed.axis],
    content_hash: sha256(serializedPayload),
    storage_path: `data/industry-runs/${input.runId}/${payloadSchema}/${stableId("blob", artifactRef)}.json`,
    summary,
  };
  const envelope: ProductAgentMessageEnvelope = {
    kind: kindForPayloadSchema(payloadSchema),
    message_id: stableId("msg", `${input.runId}:${artifactRef}`),
    schema_version: "industry-agent-message.v1",
    run_id: input.runId,
    thread_id: input.threadId,
    window_start: input.windowStart,
    window_end: input.windowEnd,
    sent_at: input.now,
    from_agent_id: input.seed.agent_id,
    to_agent_id: "broadcast",
    responsibility_id: input.seed.responsibility_id,
    payload_schema: payloadSchema,
    payload_ref: artifactRef,
    output_artifact_refs: [artifactRef],
    status: "sent",
  };
  return { envelope, manifest, payload };
}

function kindForPayloadSchema(payloadSchema: ProductAgentMessageEnvelope["payload_schema"]): ProductAgentMessageEnvelope["kind"] {
  return payloadSchema === "industry-signal-event-batch.v1"
    ? "evidence_batch"
    : payloadSchema === "axis-tool-coverage-report.v1"
      ? "tool_status_report"
      : "industry_agent_contribution";
}

export function stableId(prefix: string, raw: string): string {
  return `${prefix}-${sha256(raw).slice(0, 12)}`;
}

function sha256(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
