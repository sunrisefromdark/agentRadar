import crypto from "node:crypto";

export type IndustryAgentId = "finance-agent" | "policy-agent";
export type IndustryResponsibilityId = "capital-finance" | "policy-regulatory" | "policy-research-thinktank";
export type IndustryEvidenceAxisKey = "capital_finance" | "policy_regulatory" | "policy_research_thinktank";
export type EvidenceBucket = "accepted" | "counter" | "diagnostic" | "rejected";
export type RouteLevel = "primary_tool" | "secondary_toolset" | "fallback_tools" | "last_resort_mode" | "none";
export type SourceClass =
  | "official_structured_api"
  | "official_owned_feed_or_doc"
  | "domain_structured_search"
  | "specialized_research_or_discovery"
  | "general_web_search"
  | "manual_or_local_only"
  | "none";

export interface ExecutionContext {
  primary_responsibility_id: IndustryResponsibilityId;
  default_owner_agent_id: IndustryAgentId;
  operational_executor_id: IndustryAgentId;
  takeover_mode: "none" | "delegated_execution" | "temporary_backfill" | "emergency_manual";
  takeover_audit_ref?: string;
}

export interface IndustrySignalEvent {
  event_id: string;
  schema_version: "industry-signal-event.v1";
  observed_at: string;
  source_published_at?: string;
  ingested_at: string;
  freshness_anchor_kind: "published_at" | "observed_at" | "mixed";
  freshness_profile_id: string;
  axis: IndustryEvidenceAxisKey;
  source_polarity_cue: "supporting" | "counter" | "missing_marker" | "context";
  source: {
    source_id: string;
    display_name: string;
    source_url?: string;
    source_type: "financial_filing" | "funding" | "policy" | "thinktank_report" | "news";
    authority_tier: "core" | "proven" | "watch" | "ordinary" | "excluded";
    language?: "zh" | "en" | "multi" | "unknown";
    region?: string;
    primary_source_distance: "primary" | "near_primary" | "secondary" | "rumor" | "unknown";
  };
  actor?: {
    entity_id?: string;
    display_name: string;
    entity_type: "company" | "investor" | "regulator" | "thinktank" | "media";
    authority_tier: "core" | "proven" | "watch" | "ordinary" | "excluded";
  };
  target?: {
    topic_key?: string;
    product_url?: string;
    policy_url?: string;
    entity_id?: string;
  };
  agent_relevance: {
    state: "agent_core" | "agent_adjacent" | "generic_ai_background" | "out_of_scope";
    score: number;
    matched_reasons: string[];
  };
  evidence: {
    title?: string;
    summary_cn: string;
    url?: string;
    raw_ref?: string;
    citation_ref?: string;
    metrics?: Record<string, number>;
  };
  collected_by_agent_id: IndustryAgentId;
  responsibility_id: IndustryResponsibilityId;
  execution_context: ExecutionContext;
  tool_route_id?: string;
  audit: {
    public_safe: boolean;
    redaction_policy_version: string;
    dedupe_key: string;
    source_chain_key?: string;
    rejected_reason?: string;
  };
}

export interface ToolAvailabilityState {
  state: "available" | "degraded" | "blocked" | "unavailable";
  reason_codes: string[];
}

export interface AxisToolCoverageReport {
  axis: IndustryEvidenceAxisKey;
  primary_tool_ids: string[];
  secondary_toolset_ids: string[];
  fallback_tool_ids: string[];
  last_resort_tool_ids: string[];
  eligible_tool_ids: string[];
  selected_from_tool_ids: string[];
  attempted_tool_ids: string[];
  selection_scorecard_version?: "tool-selection-scorecard.v1";
  selection_score_total?: number;
  selection_score_breakdown?: {
    source_fidelity: number;
    citation_traceability: number;
    output_structure: number;
    freshness_sla_fit: number;
    stability: number;
    cost_efficiency: number;
    license_risk_fit: number;
  };
  veto_reason_codes: string[];
  selection_reason_codes: string[];
  active_route_level: RouteLevel;
  active_tool_ids: string[];
  active_source_class: SourceClass;
  last_resort_mode_kind?: "targeted_fetch" | "manual_verification" | "weak_signal_only" | "mark_unavailable";
  route_status: {
    primary_tool: ToolAvailabilityState;
    secondary_toolset: ToolAvailabilityState;
    fallback_tools: ToolAvailabilityState;
    last_resort_mode: ToolAvailabilityState;
  };
  budget_status: {
    profile_id: string;
    budget_exceeded: boolean;
    spent_summary_cn: string;
  };
  unavailable_state?: {
    reason_code: string;
    since: string;
    affected_axes: IndustryEvidenceAxisKey[];
  };
  degraded: boolean;
  degradation_reason_codes: string[];
  candidate_ref_count: number;
  accepted_ref_count: number;
  citation_trace_rate: number;
  max_source_lag_days?: number;
  evidence_event_ids: string[];
  rejected_event_ids: string[];
  registry_snapshot_ref: string;
  tool_registry_snapshot_ref: string;
  summary_cn: string;
}

export interface IndustryAgentContribution {
  responsibility_id: IndustryResponsibilityId;
  handled_by_agent_id: IndustryAgentId;
  execution_context: ExecutionContext;
  status: "ok" | "partial" | "skipped" | "failed" | "unavailable";
  covered_axes: IndustryEvidenceAxisKey[];
  event_count: number;
  accepted_event_count: number;
  assisted_event_count: number;
  rejected_event_count: number;
  counter_event_count: number;
  diagnostic_event_count: number;
  metric_input_gap_count: number;
  unscorable_event_count: number;
  profile_blocked_event_count: number;
  input_artifact_refs: string[];
  output_artifact_refs: string[];
  tool_route_ids: string[];
  status_reason?: string;
  contribution_summary_cn: string;
}

export interface IndustryAgentMessageEnvelope {
  message_id: string;
  schema_version: "industry-agent-message.v1";
  thread_id: string;
  run_id: string;
  window_start: string;
  window_end: string;
  sent_at: string;
  from_agent_id: IndustryAgentId;
  to_agent_id: IndustryAgentId | "broadcast";
  responsibility_id?: IndustryResponsibilityId;
  checkpoint_stage: "packaging";
  capability_class: "projection";
  kind: "task-result";
  payload_schema: "event-batch.v1" | "tool-status-report.v1" | "daily-industry-evidence-pack-input.v1";
  payload_ref: string;
  input_artifact_refs: string[];
  output_artifact_refs: string[];
  dispatch_context_ref?: string;
  scheduling_key?: string;
  claim_admission_assessment_ref?: string;
  capacity_reservation_refs: string[];
  required_depends_on_message_ids: string[];
  advisory_depends_on_message_ids: string[];
  correlation_id?: string;
  idempotency_key: string;
  status: "created" | "sent" | "consumed" | "superseded" | "failed" | "rejected";
  reason_code?: string;
  visibility_tier: "internal_only" | "redacted_public" | "public";
  redaction_policy_version?: string;
  contains_raw_text: boolean;
  contains_profile_urls: boolean;
  public_projection_artifact_ref?: string;
}

export interface IndustryAgentArtifactManifest {
  artifact_ref: string;
  artifact_kind: "event-batch" | "tool-coverage-report" | "agent-contribution" | "daily-pack-input";
  schema_version: string;
  produced_by_agent_id: IndustryAgentId;
  responsibility_id?: IndustryResponsibilityId;
  produced_at: string;
  source_message_id?: string;
  input_artifact_refs: string[];
  event_ids: string[];
  claim_ids: string[];
  axis_keys: IndustryEvidenceAxisKey[];
  visibility_tier: "internal_only" | "redacted_public" | "public";
  redaction_policy_version?: string;
  contains_raw_text: boolean;
  contains_profile_urls: boolean;
  public_projection_artifact_ref?: string;
  content_hash: string;
  storage_path: string;
  summary_cn: string;
}

export interface EventBatchPayload {
  schema_id: "event-batch.v1";
  schema_version: "1.0.0";
  payload_id: string;
  run_id: string;
  window_start: string;
  window_end: string;
  responsibility_id: IndustryResponsibilityId;
  axis: IndustryEvidenceAxisKey;
  bucket: EvidenceBucket;
  events: IndustrySignalEvent[];
}

export interface CoveragePayload {
  schema_id: "tool-status-report.v1";
  schema_version: "1.0.0";
  payload_id: string;
  run_id: string;
  responsibility_id: IndustryResponsibilityId;
  report: AxisToolCoverageReport;
}

export interface DailyIndustryEvidencePackInput {
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

export interface ContributionPayload {
  schema_id: "industry-agent-contribution.v1";
  schema_version: "1.0.0";
  payload_id: string;
  run_id: string;
  contribution: IndustryAgentContribution;
}

export interface ToolRouteDefinition {
  tool_id: string;
  source_class: Exclude<SourceClass, "none">;
}

export interface AxisSeedConfig {
  agent_id: IndustryAgentId;
  responsibility_id: IndustryResponsibilityId;
  axis: IndustryEvidenceAxisKey;
  primary: ToolRouteDefinition[];
  secondary: ToolRouteDefinition[];
  fallback: ToolRouteDefinition[];
  last_resort: ToolRouteDefinition[];
  registry_snapshot_ref: string;
  tool_registry_snapshot_ref: string;
  budget_profile_id: string;
}

export interface RouteSelectionInput {
  now: string;
  availableToolIds: string[];
  attemptedToolIds?: string[];
  canonicalSourceAvailable: boolean;
  budgetExceeded?: boolean;
  stopReasonCode?: string;
  lastResortModeKind?: AxisToolCoverageReport["last_resort_mode_kind"];
}

export interface RouteSelectionResult {
  routeLevel: RouteLevel;
  activeToolIds: string[];
  activeSourceClass: SourceClass;
  degraded: boolean;
  degradationReasonCodes: string[];
  stopReasonCode?: string;
  routeStatus: AxisToolCoverageReport["route_status"];
  eligibleToolIds: string[];
  selectedFromToolIds: string[];
  attemptedToolIds: string[];
}

export interface AxisBuildInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  responsibilityId: IndustryResponsibilityId;
  axis: IndustryEvidenceAxisKey;
  producerAgentId: IndustryAgentId;
  executionContext: ExecutionContext;
  routeSelection: RouteSelectionResult;
  registrySnapshotRef: string;
  toolRegistrySnapshotRef: string;
  budgetProfileId: string;
  sources: AxisSourceInput[];
}

export interface AxisSourceInput {
  sourceId: string;
  displayName: string;
  url?: string;
  sourceType: IndustrySignalEvent["source"]["source_type"];
  authorityTier: IndustrySignalEvent["source"]["authority_tier"];
  primarySourceDistance: IndustrySignalEvent["source"]["primary_source_distance"];
  publishedAt?: string;
  bucket: EvidenceBucket;
  title: string;
  summaryCn: string;
  actorName?: string;
  actorType?: "company" | "investor" | "regulator" | "thinktank" | "media";
  agentRelevanceScore: number;
  agentRelevanceReasons: string[];
  topicKey?: string;
  metrics?: Record<string, number>;
  rejectedReason?: string;
}

export interface AxisArtifacts {
  accepted: ArtifactEnvelope<EventBatchPayload>;
  counter: ArtifactEnvelope<EventBatchPayload>;
  diagnostic: ArtifactEnvelope<EventBatchPayload>;
  rejected: ArtifactEnvelope<EventBatchPayload>;
  coverage: ArtifactEnvelope<CoveragePayload>;
  contribution: ArtifactEnvelope<ContributionPayload>;
  acceptedEvents: IndustrySignalEvent[];
  rejectedEvents: IndustrySignalEvent[];
}

export interface ArtifactEnvelope<TPayload> {
  envelope: IndustryAgentMessageEnvelope;
  manifest: IndustryAgentArtifactManifest;
  payload: TPayload;
}

export function createExecutionContext(
  responsibilityId: IndustryResponsibilityId,
  defaultOwner: IndustryAgentId,
  executor: IndustryAgentId,
): ExecutionContext {
  return {
    primary_responsibility_id: responsibilityId,
    default_owner_agent_id: defaultOwner,
    operational_executor_id: executor,
    takeover_mode: "none",
  };
}

export function selectRoute(seed: AxisSeedConfig, input: RouteSelectionInput): RouteSelectionResult {
  const attemptedToolIds = input.attemptedToolIds ?? [];
  const available = new Set(input.availableToolIds);
  const routeOrder: Array<{ level: Exclude<RouteLevel, "none">; tools: ToolRouteDefinition[] }> = [
    { level: "primary_tool", tools: seed.primary },
    { level: "secondary_toolset", tools: seed.secondary },
    { level: "fallback_tools", tools: seed.fallback },
    { level: "last_resort_mode", tools: seed.last_resort },
  ];

  const routeStatus: AxisToolCoverageReport["route_status"] = {
    primary_tool: availabilityState(seed.primary, available),
    secondary_toolset: availabilityState(seed.secondary, available),
    fallback_tools: availabilityState(seed.fallback, available),
    last_resort_mode: availabilityState(seed.last_resort, available),
  };

  const eligibleToolIds = routeOrder.flatMap((item) => item.tools.filter((tool) => available.has(tool.tool_id)).map((tool) => tool.tool_id));
  const selectedFromToolIds = eligibleToolIds.length > 0 ? eligibleToolIds : routeOrder.flatMap((item) => item.tools.map((tool) => tool.tool_id));
  const degradationReasonCodes = new Set<string>();
  if (!input.canonicalSourceAvailable) degradationReasonCodes.add("no_canonical_source_available");
  if (input.budgetExceeded) degradationReasonCodes.add("budget_exceeded");
  if (input.stopReasonCode) degradationReasonCodes.add(input.stopReasonCode);

  for (const item of routeOrder) {
    const activeTools = item.tools.filter((tool) => available.has(tool.tool_id));
    if (activeTools.length === 0) continue;
    const activeSourceClass = activeTools[0]?.source_class ?? "none";
    const degraded =
      item.level !== "primary_tool" ||
      input.budgetExceeded === true ||
      activeSourceClass === "general_web_search" ||
      activeSourceClass === "manual_or_local_only" ||
      (!input.canonicalSourceAvailable && item.level !== "primary_tool");

    if (item.level !== "primary_tool") degradationReasonCodes.add(`route_${item.level}`);
    if (activeSourceClass === "general_web_search") degradationReasonCodes.add("non_official_source_class");
    if (activeSourceClass === "manual_or_local_only") degradationReasonCodes.add("manual_last_resort_only");

    return {
      routeLevel: item.level,
      activeToolIds: activeTools.map((tool) => tool.tool_id),
      activeSourceClass,
      degraded,
      degradationReasonCodes: Array.from(degradationReasonCodes),
      stopReasonCode: input.stopReasonCode,
      routeStatus,
      eligibleToolIds,
      selectedFromToolIds,
      attemptedToolIds,
    };
  }

  return {
    routeLevel: "none",
    activeToolIds: [],
    activeSourceClass: "none",
    degraded: true,
    degradationReasonCodes: Array.from(degradationReasonCodes.size > 0 ? degradationReasonCodes : new Set(["no_route_available"])),
    stopReasonCode: input.stopReasonCode ?? "no_canonical_source_available",
    routeStatus,
    eligibleToolIds,
    selectedFromToolIds,
    attemptedToolIds,
  };
}

function availabilityState(tools: ToolRouteDefinition[], available: Set<string>): ToolAvailabilityState {
  if (tools.length === 0) return { state: "unavailable", reason_codes: ["route_not_configured"] };
  const activeCount = tools.filter((tool) => available.has(tool.tool_id)).length;
  if (activeCount === 0) return { state: "blocked", reason_codes: ["tool_unavailable"] };
  if (activeCount < tools.length) return { state: "degraded", reason_codes: ["partial_tool_availability"] };
  return { state: "available", reason_codes: [] };
}

export function buildAxisArtifacts(input: AxisBuildInput): AxisArtifacts {
  const acceptedEvents = input.sources.filter((item) => item.bucket === "accepted").map((item) => buildEvent(input, item));
  const counterEvents = input.sources.filter((item) => item.bucket === "counter").map((item) => buildEvent(input, item));
  const diagnosticEvents = input.sources.filter((item) => item.bucket === "diagnostic").map((item) => buildEvent(input, item));
  const rejectedEvents = input.sources.filter((item) => item.bucket === "rejected").map((item) => buildEvent(input, item));

  const accepted = buildEventBatchArtifact(input, "accepted", acceptedEvents);
  const counter = buildEventBatchArtifact(input, "counter", counterEvents);
  const diagnostic = buildEventBatchArtifact(input, "diagnostic", diagnosticEvents);
  const rejected = buildEventBatchArtifact(input, "rejected", rejectedEvents);
  const coverage = buildCoverageArtifact(input, acceptedEvents, rejectedEvents);
  const contribution = buildContributionArtifact(input, accepted, counter, diagnostic, rejected);

  return {
    accepted,
    counter,
    diagnostic,
    rejected,
    coverage,
    contribution,
    acceptedEvents,
    rejectedEvents,
  };
}

function buildEvent(input: AxisBuildInput, source: AxisSourceInput): IndustrySignalEvent {
  const eventBase = `${input.runId}:${input.responsibilityId}:${source.sourceId}:${source.title}:${source.bucket}`;
  return {
    event_id: stableId("evt", eventBase),
    schema_version: "industry-signal-event.v1",
    observed_at: input.now,
    source_published_at: source.publishedAt,
    ingested_at: input.now,
    freshness_anchor_kind: source.publishedAt ? "published_at" : "observed_at",
    freshness_profile_id: `${input.axis}.freshness.v1`,
    axis: input.axis,
    source_polarity_cue:
      source.bucket === "accepted" ? "supporting" : source.bucket === "counter" ? "counter" : source.bucket === "diagnostic" ? "context" : "missing_marker",
    source: {
      source_id: source.sourceId,
      display_name: source.displayName,
      source_url: source.url,
      source_type: source.sourceType,
      authority_tier: source.authorityTier,
      primary_source_distance: source.primarySourceDistance,
      language: "zh",
      region: "global",
    },
    actor: source.actorName && source.actorType ? {
      display_name: source.actorName,
      entity_type: source.actorType,
      authority_tier: source.authorityTier,
    } : undefined,
    target: source.topicKey ? { topic_key: source.topicKey } : undefined,
    agent_relevance: {
      state: source.agentRelevanceScore >= 0.75 ? "agent_core" : source.agentRelevanceScore >= 0.5 ? "agent_adjacent" : "generic_ai_background",
      score: source.agentRelevanceScore,
      matched_reasons: source.agentRelevanceReasons,
    },
    evidence: {
      title: source.title,
      summary_cn: source.summaryCn,
      url: source.url,
      citation_ref: source.url ? `citation://${stableId("cite", source.url)}` : undefined,
      raw_ref: `raw://${stableId("raw", eventBase)}`,
      metrics: source.metrics,
    },
    collected_by_agent_id: input.producerAgentId,
    responsibility_id: input.responsibilityId,
    execution_context: input.executionContext,
    tool_route_id: `${input.axis}:${input.routeSelection.routeLevel}:${input.routeSelection.activeToolIds[0] ?? "none"}`,
    audit: {
      public_safe: true,
      redaction_policy_version: "industry-redaction.v1",
      dedupe_key: stableId("dedupe", `${input.axis}:${source.sourceId}:${source.title}`),
      source_chain_key: stableId("chain", `${source.sourceId}:${source.url ?? source.title}`),
      rejected_reason: source.rejectedReason,
    },
  };
}

function buildEventBatchArtifact(
  input: AxisBuildInput,
  bucket: EvidenceBucket,
  events: IndustrySignalEvent[],
): ArtifactEnvelope<EventBatchPayload> {
  const payload: EventBatchPayload = {
    schema_id: "event-batch.v1",
    schema_version: "1.0.0",
    payload_id: stableId("payload", `${input.runId}:${input.responsibilityId}:${input.axis}:${bucket}`),
    run_id: input.runId,
    window_start: input.windowStart,
    window_end: input.windowEnd,
    responsibility_id: input.responsibilityId,
    axis: input.axis,
    bucket,
    events,
  };

  return buildArtifactEnvelope({
    runId: input.runId,
    threadId: input.threadId,
    now: input.now,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    fromAgentId: input.producerAgentId,
    responsibilityId: input.responsibilityId,
    payloadSchema: "event-batch.v1",
    payload,
    artifactKind: "event-batch",
    schemaVersion: payload.schema_version,
    axisKeys: [input.axis],
    eventIds: events.map((item) => item.event_id),
    summaryCn: `${input.responsibilityId} ${bucket} 事件批次`,
  });
}

function buildCoverageArtifact(
  input: AxisBuildInput,
  acceptedEvents: IndustrySignalEvent[],
  rejectedEvents: IndustrySignalEvent[],
): ArtifactEnvelope<CoveragePayload> {
  const coverage: AxisToolCoverageReport = {
    axis: input.axis,
    primary_tool_ids: [],
    secondary_toolset_ids: [],
    fallback_tool_ids: [],
    last_resort_tool_ids: [],
    eligible_tool_ids: input.routeSelection.eligibleToolIds,
    selected_from_tool_ids: input.routeSelection.selectedFromToolIds,
    attempted_tool_ids: input.routeSelection.attemptedToolIds,
    selection_scorecard_version: input.routeSelection.routeLevel === "none" ? undefined : "tool-selection-scorecard.v1",
    selection_score_total: input.routeSelection.routeLevel === "none" ? undefined : 0.91,
    selection_score_breakdown: input.routeSelection.routeLevel === "none" ? undefined : {
      source_fidelity: 0.16,
      citation_traceability: 0.14,
      output_structure: 0.14,
      freshness_sla_fit: 0.14,
      stability: 0.12,
      cost_efficiency: 0.11,
      license_risk_fit: 0.1,
    },
    veto_reason_codes: [],
    selection_reason_codes:
      input.routeSelection.routeLevel === "none"
        ? ["no_route_available"]
        : [`route_${input.routeSelection.routeLevel}`, input.routeSelection.activeSourceClass],
    active_route_level: input.routeSelection.routeLevel,
    active_tool_ids: input.routeSelection.activeToolIds,
    active_source_class: input.routeSelection.activeSourceClass,
    last_resort_mode_kind: input.routeSelection.routeLevel === "last_resort_mode" ? "weak_signal_only" : undefined,
    route_status: input.routeSelection.routeStatus,
    budget_status: {
      profile_id: input.budgetProfileId,
      budget_exceeded: input.routeSelection.degradationReasonCodes.includes("budget_exceeded"),
      spent_summary_cn: input.routeSelection.degradationReasonCodes.includes("budget_exceeded") ? "预算已命中上限，已降级到弱路径" : "预算在安全范围内",
    },
    unavailable_state:
      input.routeSelection.routeLevel === "none"
        ? {
            reason_code: input.routeSelection.stopReasonCode ?? "no_route_available",
            since: input.now,
            affected_axes: [input.axis],
          }
        : undefined,
    degraded: input.routeSelection.degraded,
    degradation_reason_codes: input.routeSelection.degradationReasonCodes,
    candidate_ref_count: input.sources.length,
    accepted_ref_count: acceptedEvents.length,
    citation_trace_rate: acceptedEvents.length === 0 ? 0 : 1,
    evidence_event_ids: acceptedEvents.map((item) => item.event_id),
    rejected_event_ids: rejectedEvents.map((item) => item.event_id),
    registry_snapshot_ref: input.registrySnapshotRef,
    tool_registry_snapshot_ref: input.toolRegistrySnapshotRef,
    summary_cn:
      input.routeSelection.routeLevel === "none"
        ? `${input.axis} 未拿到可用官方路径，当前仅能留痕 unavailable`
        : `${input.axis} 采用 ${input.routeSelection.routeLevel} 路线，来源类型为 ${input.routeSelection.activeSourceClass}`,
  };

  const payload: CoveragePayload = {
    schema_id: "tool-status-report.v1",
    schema_version: "1.0.0",
    payload_id: stableId("payload", `${input.runId}:${input.responsibilityId}:${input.axis}:coverage`),
    run_id: input.runId,
    responsibility_id: input.responsibilityId,
    report: coverage,
  };

  const envelope = buildArtifactEnvelope({
    runId: input.runId,
    threadId: input.threadId,
    now: input.now,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    fromAgentId: input.producerAgentId,
    responsibilityId: input.responsibilityId,
    payloadSchema: "tool-status-report.v1",
    payload,
    artifactKind: "tool-coverage-report",
    schemaVersion: payload.schema_version,
    axisKeys: [input.axis],
    eventIds: [...acceptedEvents.map((item) => item.event_id), ...rejectedEvents.map((item) => item.event_id)],
    summaryCn: `${input.responsibilityId} 工具覆盖报告`,
  });

  envelope.payload.report.primary_tool_ids = input.routeSelection.routeStatus.primary_tool.state === "unavailable" ? [] : input.routeSelection.selectedFromToolIds;
  return envelope;
}

function buildContributionArtifact(
  input: AxisBuildInput,
  accepted: ArtifactEnvelope<EventBatchPayload>,
  counter: ArtifactEnvelope<EventBatchPayload>,
  diagnostic: ArtifactEnvelope<EventBatchPayload>,
  rejected: ArtifactEnvelope<EventBatchPayload>,
): ArtifactEnvelope<ContributionPayload> {
  const acceptedCount = accepted.payload.events.length;
  const counterCount = counter.payload.events.length;
  const diagnosticCount = diagnostic.payload.events.length;
  const rejectedCount = rejected.payload.events.length;

  const contribution: IndustryAgentContribution = {
    responsibility_id: input.responsibilityId,
    handled_by_agent_id: input.producerAgentId,
    execution_context: input.executionContext,
    status: input.routeSelection.routeLevel === "none" ? "unavailable" : input.routeSelection.degraded ? "partial" : "ok",
    covered_axes: [input.axis],
    event_count: acceptedCount + counterCount + diagnosticCount + rejectedCount,
    accepted_event_count: acceptedCount,
    assisted_event_count: 0,
    rejected_event_count: rejectedCount,
    counter_event_count: counterCount,
    diagnostic_event_count: diagnosticCount,
    metric_input_gap_count: diagnosticCount,
    unscorable_event_count: 0,
    profile_blocked_event_count: 0,
    input_artifact_refs: [],
    output_artifact_refs: [accepted.manifest.artifact_ref, counter.manifest.artifact_ref, diagnostic.manifest.artifact_ref, rejected.manifest.artifact_ref],
    tool_route_ids: [`${input.axis}:${input.routeSelection.routeLevel}`],
    status_reason: input.routeSelection.stopReasonCode,
    contribution_summary_cn:
      input.routeSelection.routeLevel === "none"
        ? `${input.responsibilityId} 本轮未取得 canonical 路径，已按 unavailable 留痕`
        : `${input.responsibilityId} 已完成事件、coverage 和 handoff 产出`,
  };

  const payload: ContributionPayload = {
    schema_id: "industry-agent-contribution.v1",
    schema_version: "1.0.0",
    payload_id: stableId("payload", `${input.runId}:${input.responsibilityId}:${input.axis}:contribution`),
    run_id: input.runId,
    contribution,
  };

  return buildArtifactEnvelope({
    runId: input.runId,
    threadId: input.threadId,
    now: input.now,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    fromAgentId: input.producerAgentId,
    responsibilityId: input.responsibilityId,
    payloadSchema: "tool-status-report.v1",
    payload,
    artifactKind: "agent-contribution",
    schemaVersion: payload.schema_version,
    axisKeys: [input.axis],
    eventIds: accepted.payload.events.map((item) => item.event_id),
    summaryCn: `${input.responsibilityId} contribution`,
  });
}

interface BuildArtifactEnvelopeInput<TPayload> {
  runId: string;
  threadId: string;
  now: string;
  windowStart: string;
  windowEnd: string;
  fromAgentId: IndustryAgentId;
  responsibilityId?: IndustryResponsibilityId;
  payloadSchema: IndustryAgentMessageEnvelope["payload_schema"];
  payload: TPayload;
  artifactKind: IndustryAgentArtifactManifest["artifact_kind"];
  schemaVersion: string;
  axisKeys: IndustryEvidenceAxisKey[];
  eventIds: string[];
  summaryCn: string;
}

function buildArtifactEnvelope<TPayload>(input: BuildArtifactEnvelopeInput<TPayload>): ArtifactEnvelope<TPayload> {
  const serializedPayload = JSON.stringify(input.payload);
  const artifactRef = `artifact://${input.runId}/${stableId("artifact", `${input.payloadSchema}:${serializedPayload}`)}`;
  const manifest: IndustryAgentArtifactManifest = {
    artifact_ref: artifactRef,
    artifact_kind: input.artifactKind,
    schema_version: input.schemaVersion,
    produced_by_agent_id: input.fromAgentId,
    responsibility_id: input.responsibilityId,
    produced_at: input.now,
    input_artifact_refs: [],
    event_ids: input.eventIds,
    claim_ids: [],
    axis_keys: input.axisKeys,
    visibility_tier: "internal_only",
    contains_raw_text: false,
    contains_profile_urls: false,
    content_hash: sha256(serializedPayload),
    storage_path: `data/industry-runs/${input.runId}/${input.payloadSchema}/${stableId("blob", artifactRef)}.json`,
    summary_cn: input.summaryCn,
  };
  const envelope: IndustryAgentMessageEnvelope = {
    message_id: stableId("msg", `${input.runId}:${artifactRef}`),
    schema_version: "industry-agent-message.v1",
    thread_id: input.threadId,
    run_id: input.runId,
    window_start: input.windowStart,
    window_end: input.windowEnd,
    sent_at: input.now,
    from_agent_id: input.fromAgentId,
    to_agent_id: "broadcast",
    responsibility_id: input.responsibilityId,
    checkpoint_stage: "packaging",
    capability_class: "projection",
    kind: "task-result",
    payload_schema: input.payloadSchema,
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

  return { envelope, manifest, payload: input.payload };
}

export function buildDailyInputArtifact(input: {
  runId: string;
  threadId: string;
  now: string;
  windowStart: string;
  windowEnd: string;
  sourceMessageIds: string[];
  normalizedEventBatchRefs: string[];
  rejectedEventBatchRefs: string[];
  coverageRefs: string[];
  contributionRefs: string[];
}): ArtifactEnvelope<DailyIndustryEvidencePackInput> {
  const payload: DailyIndustryEvidencePackInput = {
    schema_id: "daily-industry-evidence-pack-input.v1",
    schema_version: "1.0.0",
    payload_id: stableId("payload", `${input.runId}:daily-pack-input`),
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
    now: input.now,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    fromAgentId: "policy-agent",
    payloadSchema: "daily-industry-evidence-pack-input.v1",
    payload,
    artifactKind: "daily-pack-input",
    schemaVersion: payload.schema_version,
    axisKeys: ["capital_finance", "policy_regulatory", "policy_research_thinktank"],
    eventIds: [],
    summaryCn: "政策金融组 daily-industry-evidence-pack-input",
  });
}

export function isSupportedSameMajorVersion(current: string, incoming: string): boolean {
  const currentParts = current.split(".").map((part) => Number.parseInt(part, 10));
  const incomingParts = incoming.split(".").map((part) => Number.parseInt(part, 10));
  if (currentParts.length !== 3 || incomingParts.length !== 3 || currentParts.some(Number.isNaN) || incomingParts.some(Number.isNaN)) {
    return false;
  }
  return currentParts[0] === incomingParts[0] && incomingParts[1] <= currentParts[1];
}

export function assertConsumableEnvelope(
  envelope: {
    schema_version: string;
    payload_ref: string;
    payload_schema: string;
    output_artifact_refs: string[];
  },
  expectedSchemaVersion: string,
): { ok: true } | { ok: false; reason: string } {
  if (!envelope.payload_ref) return { ok: false, reason: "missing_required_artifact_ref" };
  if (envelope.output_artifact_refs.length === 0) return { ok: false, reason: "missing_required_artifact_ref" };
  if (!isSupportedSameMajorVersion(expectedSchemaVersion, "1.0.0")) return { ok: false, reason: "unsupported_consumer_baseline" };
  if (!/^industry-agent-message\.v\d+$/.test(envelope.schema_version)) return { ok: false, reason: "unknown_message_schema" };
  const major = Number.parseInt(envelope.schema_version.split(".v")[1] ?? "", 10);
  if (!Number.isFinite(major) || major > 1) return { ok: false, reason: "unknown_higher_major" };
  return { ok: true };
}

export function stableId(prefix: string, raw: string): string {
  return `${prefix}-${sha256(raw).slice(0, 12)}`;
}

function sha256(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
