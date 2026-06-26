import crypto from "node:crypto";

export type CommunityNewsAgentId = "community-news-agent";
export type CommunityNewsResponsibilityId = "cn-community" | "global-community" | "news-pr";
export type CommunityNewsAxisId = "community_discussion" | "news_pr_narrative";
export type EvidenceBucket = "accepted" | "counter" | "diagnostic" | "rejected";
export type RouteLevel = "primary_tool" | "secondary_toolset" | "fallback_tools" | "last_resort_mode" | "none";
export type SourceClass = "community_original_thread" | "news_or_press_release" | "community_search" | "manual_or_local_only" | "none";

export interface CommunityExecutionContext {
  primary_responsibility_id: CommunityNewsResponsibilityId;
  default_owner_agent_id: CommunityNewsAgentId;
  operational_executor_id: CommunityNewsAgentId;
  takeover_mode: "none" | "delegated_execution" | "temporary_backfill" | "emergency_manual";
  takeover_audit_ref?: string;
}

export interface CommunitySignalEvent {
  event_id: string;
  schema_version: "industry-signal-event.v1";
  observed_at: string;
  source_published_at?: string;
  ingested_at: string;
  axis: CommunityNewsAxisId;
  bucket: EvidenceBucket;
  source: {
    source_id: string;
    display_name: string;
    source_url?: string;
    source_type: "forum_post" | "issue" | "user_practice" | "media_report" | "press_release" | "seo_content" | "aggregator";
    authority_tier: "core" | "proven" | "watch" | "ordinary" | "excluded";
    primary_source_distance: "primary" | "near_primary" | "secondary" | "rumor" | "unknown";
    language: "zh" | "en" | "multi" | "unknown";
    region: string;
  };
  evidence: {
    title: string;
    summary: string;
    url?: string;
    raw_ref: string;
    citation_ref?: string;
  };
  responsibility_id: CommunityNewsResponsibilityId;
  collected_by_agent_id: CommunityNewsAgentId;
  execution_context: CommunityExecutionContext;
  audit: {
    dedupe_key: string;
    source_chain_key: string;
    direct_owner_responsibility_id: CommunityNewsResponsibilityId;
    rejected_reason?: string;
    relation_refs: string[];
  };
}

export interface CommunityToolCoverageReport {
  axis: CommunityNewsAxisId;
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

export interface CommunityAgentContribution {
  responsibility_id: CommunityNewsResponsibilityId;
  handled_by_agent_id: CommunityNewsAgentId;
  execution_context: CommunityExecutionContext;
  status: "ok" | "partial" | "skipped" | "failed" | "unavailable";
  covered_axes: CommunityNewsAxisId[];
  event_count: number;
  accepted_event_count: number;
  rejected_event_count: number;
  counter_event_count: number;
  diagnostic_event_count: number;
  input_artifact_refs: string[];
  output_artifact_refs: string[];
  contribution_summary: string;
}

export interface CommunityAgentMessageEnvelope {
  message_id: string;
  schema_version: "industry-agent-message.v1";
  run_id: string;
  thread_id: string;
  window_start: string;
  window_end: string;
  sent_at: string;
  from_agent_id: CommunityNewsAgentId;
  to_agent_id: "broadcast";
  responsibility_id?: CommunityNewsResponsibilityId;
  payload_schema:
    | "industry-signal-event-batch.v1"
    | "axis-tool-coverage-report.v1"
    | "industry-agent-contribution.v1"
    | "daily-industry-evidence-pack-input.v1";
  payload_ref: string;
  output_artifact_refs: string[];
  status: "sent";
}

export interface CommunityArtifactManifest {
  artifact_ref: string;
  artifact_kind: "event-batch" | "tool-coverage-report" | "agent-contribution" | "daily-pack-input";
  schema_version: string;
  produced_by_agent_id: CommunityNewsAgentId;
  responsibility_id?: CommunityNewsResponsibilityId;
  produced_at: string;
  event_ids: string[];
  axis_keys: CommunityNewsAxisId[];
  content_hash: string;
  storage_path: string;
  summary: string;
}

export interface CommunityEventBatchPayload {
  schema_id: "industry-signal-event-batch.v1";
  schema_version: "1.0.0";
  payload_id: string;
  run_id: string;
  responsibility_id: CommunityNewsResponsibilityId;
  axis: CommunityNewsAxisId;
  bucket: EvidenceBucket;
  events: CommunitySignalEvent[];
}

export interface CommunityCoveragePayload {
  schema_id: "axis-tool-coverage-report.v1";
  schema_version: "1.0.0";
  payload_id: string;
  run_id: string;
  responsibility_id: CommunityNewsResponsibilityId;
  report: CommunityToolCoverageReport;
}

export interface CommunityContributionPayload {
  schema_id: "industry-agent-contribution.v1";
  schema_version: "1.0.0";
  payload_id: string;
  run_id: string;
  contribution: CommunityAgentContribution;
}

export interface DailyIndustryEvidencePackInputDraft {
  schema_id: "daily-industry-evidence-pack-input.v1";
  schema_version: "1.0.0";
  payload_id: string;
  run_id: string;
  window_start: string;
  window_end: string;
  source_message_ids: string[];
  normalized_event_batch_refs: string[];
  rejected_event_batch_refs: string[];
  coverage_refs: string[];
  contribution_refs: string[];
}

export interface ArtifactEnvelope<TPayload> {
  envelope: CommunityAgentMessageEnvelope;
  manifest: CommunityArtifactManifest;
  payload: TPayload;
}

export interface CommunityAxisArtifacts {
  accepted: ArtifactEnvelope<CommunityEventBatchPayload>;
  counter: ArtifactEnvelope<CommunityEventBatchPayload>;
  diagnostic: ArtifactEnvelope<CommunityEventBatchPayload>;
  rejected: ArtifactEnvelope<CommunityEventBatchPayload>;
  coverage: ArtifactEnvelope<CommunityCoveragePayload>;
  contribution: ArtifactEnvelope<CommunityContributionPayload>;
  acceptedEvents: CommunitySignalEvent[];
  rejectedEvents: CommunitySignalEvent[];
}

export interface ToolRouteDefinition {
  tool_id: string;
  source_class: Exclude<SourceClass, "none">;
}

export interface CommunityAxisSeedConfig {
  agent_id: CommunityNewsAgentId;
  responsibility_id: CommunityNewsResponsibilityId;
  axis: CommunityNewsAxisId;
  primary: ToolRouteDefinition[];
  secondary: ToolRouteDefinition[];
  fallback: ToolRouteDefinition[];
  last_resort: ToolRouteDefinition[];
  registry_snapshot_ref: string;
  tool_registry_snapshot_ref: string;
}

export interface CommunitySourceInput {
  sourceId: string;
  displayName: string;
  url?: string;
  sourceType: CommunitySignalEvent["source"]["source_type"];
  authorityTier: CommunitySignalEvent["source"]["authority_tier"];
  primarySourceDistance: CommunitySignalEvent["source"]["primary_source_distance"];
  language: CommunitySignalEvent["source"]["language"];
  region: string;
  publishedAt?: string;
  bucket: EvidenceBucket;
  title: string;
  summary: string;
  rejectedReason?: string;
  directOwnerResponsibilityId?: CommunityNewsResponsibilityId;
  retellsSourceId?: string;
  relationRefs?: string[];
}

export interface CommunityRouteSelectionInput {
  availableToolIds: string[];
  canonicalSourceAvailable: boolean;
  degradationReasonCodes?: string[];
}

export interface CommunityRouteSelectionResult {
  routeLevel: RouteLevel;
  activeToolIds: string[];
  activeSourceClass: SourceClass;
  degraded: boolean;
  degradationReasonCodes: string[];
}

export interface BuildCommunityAxisInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  seed: CommunityAxisSeedConfig;
  routeSelection: CommunityRouteSelectionResult;
  sources: CommunitySourceInput[];
}

export function createCommunityExecutionContext(responsibilityId: CommunityNewsResponsibilityId): CommunityExecutionContext {
  return {
    primary_responsibility_id: responsibilityId,
    default_owner_agent_id: "community-news-agent",
    operational_executor_id: "community-news-agent",
    takeover_mode: "none",
  };
}

export function selectCommunityRoute(seed: CommunityAxisSeedConfig, input: CommunityRouteSelectionInput): CommunityRouteSelectionResult {
  const available = new Set(input.availableToolIds);
  const reasonCodes = new Set(input.degradationReasonCodes ?? []);
  if (!input.canonicalSourceAvailable) reasonCodes.add("no_canonical_source_available");

  for (const item of [
    { level: "primary_tool" as const, tools: seed.primary },
    { level: "secondary_toolset" as const, tools: seed.secondary },
    { level: "fallback_tools" as const, tools: seed.fallback },
    { level: "last_resort_mode" as const, tools: seed.last_resort },
  ]) {
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

export function buildCommunityAxisArtifacts(input: BuildCommunityAxisInput): CommunityAxisArtifacts {
  const events = input.sources.map((source) => buildCommunityEvent(input, source));
  const acceptedEvents = events.filter((event) => event.bucket === "accepted");
  const counterEvents = events.filter((event) => event.bucket === "counter");
  const diagnosticEvents = events.filter((event) => event.bucket === "diagnostic");
  const rejectedEvents = events.filter((event) => event.bucket === "rejected");

  const accepted = buildEventBatch(input, "accepted", acceptedEvents);
  const counter = buildEventBatch(input, "counter", counterEvents);
  const diagnostic = buildEventBatch(input, "diagnostic", diagnosticEvents);
  const rejected = buildEventBatch(input, "rejected", rejectedEvents);
  const coverage = buildCoverage(input, acceptedEvents, rejectedEvents);
  const contribution = buildContribution(input, accepted, counter, diagnostic, rejected);

  return { accepted, counter, diagnostic, rejected, coverage, contribution, acceptedEvents, rejectedEvents };
}

export function buildMergedCommunityDiscussionArtifacts(input: {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  cn: CommunityAxisArtifacts;
  global: CommunityAxisArtifacts;
}): Pick<CommunityAxisArtifacts, "coverage"> {
  const seed: CommunityAxisSeedConfig = {
    agent_id: "community-news-agent",
    responsibility_id: "cn-community",
    axis: "community_discussion",
    primary: [],
    secondary: [],
    fallback: [],
    last_resort: [],
    registry_snapshot_ref: "registry://industry/source-authority/community-discussion/v1",
    tool_registry_snapshot_ref: "registry://industry/tool-catalog/community-discussion/v1",
  };
  const routeSelection: CommunityRouteSelectionResult = {
    routeLevel: "primary_tool",
    activeToolIds: ["community-axis-aggregate"],
    activeSourceClass: "community_original_thread",
    degraded: false,
    degradationReasonCodes: [],
  };
  const baseInput: BuildCommunityAxisInput = {
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    seed,
    routeSelection,
    sources: [],
  };
  const acceptedEvents = [...input.cn.acceptedEvents, ...input.global.acceptedEvents];
  const rejectedEvents = [...input.cn.rejectedEvents, ...input.global.rejectedEvents];
  return {
    coverage: buildCoverage(baseInput, acceptedEvents, rejectedEvents),
  };
}

export function buildDailyInputDraft(input: {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  sourceMessageIds: string[];
  normalizedEventBatchRefs: string[];
  rejectedEventBatchRefs: string[];
  coverageRefs: string[];
  contributionRefs: string[];
}): ArtifactEnvelope<DailyIndustryEvidencePackInputDraft> {
  const payload: DailyIndustryEvidencePackInputDraft = {
    schema_id: "daily-industry-evidence-pack-input.v1",
    schema_version: "1.0.0",
    payload_id: stableId("payload", `${input.runId}:product-ecosystem-daily-input`),
    run_id: input.runId,
    window_start: input.windowStart,
    window_end: input.windowEnd,
    source_message_ids: input.sourceMessageIds,
    normalized_event_batch_refs: input.normalizedEventBatchRefs,
    rejected_event_batch_refs: input.rejectedEventBatchRefs,
    coverage_refs: input.coverageRefs,
    contribution_refs: input.contributionRefs,
  };
  return buildArtifactEnvelope({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    seed: {
      agent_id: "community-news-agent",
      responsibility_id: "news-pr",
      axis: "news_pr_narrative",
      primary: [],
      secondary: [],
      fallback: [],
      last_resort: [],
      registry_snapshot_ref: "registry://industry/source-authority/product-ecosystem/v1",
      tool_registry_snapshot_ref: "registry://industry/tool-catalog/product-ecosystem/v1",
    },
    routeSelection: {
      routeLevel: "primary_tool",
      activeToolIds: ["product-ecosystem-local-seam"],
      activeSourceClass: "manual_or_local_only",
      degraded: false,
      degradationReasonCodes: [],
    },
    sources: [],
  }, "daily-industry-evidence-pack-input.v1", "daily-pack-input", payload, [], "product ecosystem daily input draft");
}

function buildCommunityEvent(input: BuildCommunityAxisInput, source: CommunitySourceInput): CommunitySignalEvent {
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
      language: source.language,
      region: source.region,
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
    execution_context: createCommunityExecutionContext(input.seed.responsibility_id),
    audit: {
      dedupe_key: stableId("dedupe", `${input.seed.axis}:${source.sourceId}:${source.title}`),
      source_chain_key: stableId("chain", `${source.sourceId}:${source.url ?? source.title}`),
      direct_owner_responsibility_id: source.directOwnerResponsibilityId ?? input.seed.responsibility_id,
      rejected_reason: source.rejectedReason,
      relation_refs: source.relationRefs ?? [],
    },
  };
}

function buildEventBatch(
  input: BuildCommunityAxisInput,
  bucket: EvidenceBucket,
  events: CommunitySignalEvent[],
): ArtifactEnvelope<CommunityEventBatchPayload> {
  const payload: CommunityEventBatchPayload = {
    schema_id: "industry-signal-event-batch.v1",
    schema_version: "1.0.0",
    payload_id: stableId("payload", `${input.runId}:${input.seed.responsibility_id}:${input.seed.axis}:${bucket}`),
    run_id: input.runId,
    responsibility_id: input.seed.responsibility_id,
    axis: input.seed.axis,
    bucket,
    events,
  };
  return buildArtifactEnvelope(input, "industry-signal-event-batch.v1", "event-batch", payload, events.map((event) => event.event_id), `${input.seed.axis} ${bucket}`);
}

function buildCoverage(
  input: BuildCommunityAxisInput,
  acceptedEvents: CommunitySignalEvent[],
  rejectedEvents: CommunitySignalEvent[],
): ArtifactEnvelope<CommunityCoveragePayload> {
  const report: CommunityToolCoverageReport = {
    axis: input.seed.axis,
    active_route_level: input.routeSelection.routeLevel,
    active_tool_ids: input.routeSelection.activeToolIds,
    active_source_class: input.routeSelection.activeSourceClass,
    degraded: input.routeSelection.degraded,
    degradation_reason_codes: input.routeSelection.degradationReasonCodes,
    candidate_ref_count: input.sources.length || acceptedEvents.length + rejectedEvents.length,
    accepted_ref_count: acceptedEvents.length,
    evidence_event_ids: acceptedEvents.map((event) => event.event_id),
    rejected_event_ids: rejectedEvents.map((event) => event.event_id),
    registry_snapshot_ref: input.seed.registry_snapshot_ref,
    tool_registry_snapshot_ref: input.seed.tool_registry_snapshot_ref,
    summary: `${input.seed.axis} coverage draft`,
  };
  const payload: CommunityCoveragePayload = {
    schema_id: "axis-tool-coverage-report.v1",
    schema_version: "1.0.0",
    payload_id: stableId("payload", `${input.runId}:${input.seed.responsibility_id}:${input.seed.axis}:coverage`),
    run_id: input.runId,
    responsibility_id: input.seed.responsibility_id,
    report,
  };
  return buildArtifactEnvelope(input, "axis-tool-coverage-report.v1", "tool-coverage-report", payload, [...report.evidence_event_ids, ...report.rejected_event_ids], `${input.seed.axis} coverage`);
}

function buildContribution(
  input: BuildCommunityAxisInput,
  accepted: ArtifactEnvelope<CommunityEventBatchPayload>,
  counter: ArtifactEnvelope<CommunityEventBatchPayload>,
  diagnostic: ArtifactEnvelope<CommunityEventBatchPayload>,
  rejected: ArtifactEnvelope<CommunityEventBatchPayload>,
): ArtifactEnvelope<CommunityContributionPayload> {
  const acceptedCount = accepted.payload.events.length;
  const counterCount = counter.payload.events.length;
  const diagnosticCount = diagnostic.payload.events.length;
  const rejectedCount = rejected.payload.events.length;
  const payload: CommunityContributionPayload = {
    schema_id: "industry-agent-contribution.v1",
    schema_version: "1.0.0",
    payload_id: stableId("payload", `${input.runId}:${input.seed.responsibility_id}:contribution`),
    run_id: input.runId,
    contribution: {
      responsibility_id: input.seed.responsibility_id,
      handled_by_agent_id: input.seed.agent_id,
      execution_context: createCommunityExecutionContext(input.seed.responsibility_id),
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
    },
  };
  return buildArtifactEnvelope(input, "industry-agent-contribution.v1", "agent-contribution", payload, accepted.payload.events.map((event) => event.event_id), `${input.seed.responsibility_id} contribution`);
}

interface ArtifactEnvelopeBuildInput<TPayload> extends BuildCommunityAxisInput {
  seed: CommunityAxisSeedConfig;
}

function buildArtifactEnvelope<TPayload>(
  input: ArtifactEnvelopeBuildInput<TPayload>,
  payloadSchema: CommunityAgentMessageEnvelope["payload_schema"],
  artifactKind: CommunityArtifactManifest["artifact_kind"],
  payload: TPayload,
  eventIds: string[],
  summary: string,
): ArtifactEnvelope<TPayload> {
  const serializedPayload = JSON.stringify(payload);
  const artifactRef = `artifact://${input.runId}/${stableId("artifact", `${payloadSchema}:${serializedPayload}`)}`;
  const manifest: CommunityArtifactManifest = {
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
  const envelope: CommunityAgentMessageEnvelope = {
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

export function stableId(prefix: string, raw: string): string {
  return `${prefix}-${sha256(raw).slice(0, 12)}`;
}

function sha256(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
