import { createHash } from "node:crypto";

export type IndustryAgentId =
  | "academic-agent"
  | "product-oss-agent"
  | "community-news-agent"
  | "finance-agent"
  | "policy-agent"
  | "registry-agent"
  | "normalization-agent"
  | "audit-agent"
  | "trend-agent";

export type IndustryEvidenceAxisKey = "research_paper" | "conference_academic";
export type IndustryResponsibilityId = "research-frontier" | "conference-academic";
export type EvidencePolarity = "supporting" | "counter" | "context";
export type FreshnessState = "fresh" | "stale_but_usable" | "stale";
export type EventBucket = "accepted" | "counter" | "diagnostic" | "rejected";
export type FreshnessAnchorKind =
  | "first_release"
  | "major_revision"
  | "accepted_or_proceedings"
  | "benchmark_or_dataset_update"
  | "code_or_replication_release"
  | "unknown";

export interface ExecutionContext {
  primary_responsibility_id: IndustryResponsibilityId;
  default_owner_agent_id: IndustryAgentId;
  operational_executor_id: IndustryAgentId;
  takeover_mode: "none" | "delegated_execution" | "temporary_backfill" | "emergency_manual";
  takeover_audit_ref?: string;
}

export interface CanonicalRefs {
  doi?: string;
  arxiv_id?: string;
  openreview_id?: string;
  proceedings_url?: string;
  official_url?: string;
  code_url?: string;
  leaderboard_url?: string;
}

export interface AcademicSeedBase {
  id: string;
  title: string;
  summary_cn: string;
  observed_at: string;
  published_at?: string;
  source_key: string;
  source_url: string;
  polarity: EvidencePolarity;
  freshness_anchor_kind: FreshnessAnchorKind;
  canonical_refs?: CanonicalRefs;
  venue?: string;
  venue_year?: number;
  organization?: string;
  authors?: string[];
}

export interface PaperSeed extends AcademicSeedBase {
  axis: "research_paper";
}

export interface ConferenceSeed extends AcademicSeedBase {
  axis: "conference_academic";
}

export interface ReplayWindowFixture {
  run_id: string;
  thread_id: string;
  window_start: string;
  window_end: string;
  generated_at: string;
  paper_seeds: PaperSeed[];
  conference_seeds: ConferenceSeed[];
}

export interface OwnerBoundaryFixture {
  fact_id: string;
  direct_owner_axis: IndustryEvidenceAxisKey;
  direct_owner_agent_id: IndustryAgentId;
  relayed_by_axis: string;
  relayed_source_url: string;
  academic_source_url: string;
  summary_cn: string;
}

export interface CitationTrace {
  status: "complete" | "missing";
  canonical_ref?: string;
  citation_refs: string[];
}

export interface FreshnessAssessment {
  profile_id: string;
  state: FreshnessState;
  age_days: number | null;
}

export interface IndustrySignalEvent {
  event_id: string;
  schema_version: "industry-signal-event.v1";
  observed_at: string;
  source_published_at?: string;
  ingested_at: string;
  freshness_anchor_kind: FreshnessAnchorKind;
  freshness_profile_id: string;
  axis: IndustryEvidenceAxisKey;
  source_polarity_cue: EvidencePolarity;
  source: {
    source_id: string;
    display_name: string;
    source_url: string;
    source_type: "paper" | "conference";
    authority_tier: "core" | "proven" | "watch" | "ordinary" | "excluded";
    primary_source_distance: "primary" | "near_primary" | "secondary" | "rumor" | "unknown";
  };
  agent_relevance: {
    state: "agent_core";
    score: number;
    summary_cn: string;
  };
  evidence: {
    title: string;
    summary_cn: string;
    citation_trace_refs: string[];
    canonical_ref?: string;
  };
  collected_by_agent_id: "academic-agent";
  responsibility_id: IndustryResponsibilityId;
  execution_context: ExecutionContext;
  audit: {
    bucket: EventBucket;
    reason_codes: string[];
    direct_fact_owner_agent_id: "academic-agent";
    anti_upgrade_guard?: "single_preprint_not_core";
  };
}

export interface EventBatchPayload {
  payload_schema: "industry-signal-event-batch.v1";
  payload_id: string;
  schema_version: "1.0.0";
  run_id: string;
  window_start: string;
  window_end: string;
  source_message_id: string;
  raw_tool_output_refs: string[];
  agent_contribution_ref: string;
  tool_status_report_refs: string[];
  responsibility_id: IndustryResponsibilityId;
  axis: IndustryEvidenceAxisKey;
  bucket: EventBucket;
  event_ids: string[];
  events_ref: string;
  events: IndustrySignalEvent[];
  metric_input_completeness: {
    citation_trace_complete: number;
    freshness_anchor_complete: number;
    primary_source_complete: number;
  };
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
  selection_scorecard_version: string;
  selection_score_total: number;
  selection_score_breakdown: Record<string, number>;
  veto_reason_codes: string[];
  selection_reason_codes: string[];
  active_route_level: "primary" | "secondary" | "fallback";
  active_tool_ids: string[];
  active_source_class: "official_academic";
  route_status: "ok" | "degraded";
  budget_status: "within_budget";
  degraded: boolean;
  degradation_reason_codes: string[];
  candidate_ref_count: number;
  accepted_ref_count: number;
  citation_trace_rate: number;
  evidence_event_ids: string[];
  rejected_event_ids: string[];
  registry_snapshot_ref: string;
  tool_registry_snapshot_ref: string;
  summary_cn: string;
}

export interface LocalIndustryAgentContribution {
  payload_schema: "industry-agent-contribution.v1";
  payload_id: string;
  schema_version: "1.0.0";
  run_id: string;
  window_start: string;
  window_end: string;
  source_message_id: string;
  actual_agent_id: "academic-agent";
  responsibility_id: IndustryResponsibilityId;
  execution_context: ExecutionContext;
  status: "ok" | "partial";
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

export interface IndustryAgentArtifactManifest {
  artifact_ref: string;
  artifact_kind: "event-batch" | "tool-coverage-report" | "agent-contribution" | "daily-pack-input";
  schema_version: "industry-agent-artifact-manifest.v1";
  produced_by_agent_id: "academic-agent";
  produced_at: string;
  input_artifact_refs: string[];
  event_ids: string[];
  claim_ids: string[];
  axis_keys: IndustryEvidenceAxisKey[];
  visibility_tier: "internal_only";
  contains_raw_text: false;
  contains_profile_urls: false;
  content_hash: string;
  storage_path: string;
  summary_cn: string;
}

export interface IndustryAgentMessageEnvelope {
  message_id: string;
  schema_version: "industry-agent-message.v1";
  thread_id: string;
  run_id: string;
  window_start: string;
  window_end: string;
  sent_at: string;
  from_agent_id: "academic-agent";
  to_agent_id: "normalization-agent";
  responsibility_id?: IndustryResponsibilityId;
  checkpoint_stage: "packaging";
  capability_class: "projection";
  kind: "evidence_batch" | "tool_status_report" | "industry_agent_contribution" | "daily_industry_evidence_pack_input";
  payload_schema:
    | "industry-signal-event-batch.v1"
    | "axis-tool-coverage-report.v1"
    | "industry-agent-contribution.v1"
    | "daily-industry-evidence-pack-input.v1";
  payload_ref: string;
  input_artifact_refs: string[];
  output_artifact_refs: string[];
  capacity_reservation_refs: string[];
  required_depends_on_message_ids: string[];
  advisory_depends_on_message_ids: string[];
  idempotency_key: string;
  status: "sent";
  visibility_tier: "internal_only";
  contains_raw_text: false;
  contains_profile_urls: false;
}

export interface LocalDailyIndustryEvidencePackInput {
  payload_schema: "daily-industry-evidence-pack-input.v1";
  payload_id: string;
  schema_version: "1.0.0";
  run_id: string;
  window_start: string;
  window_end: string;
  source_message_id: string;
  normalized_event_batch_refs: string[];
  rejected_event_batch_refs: string[];
  counter_event_batch_refs: string[];
  diagnostic_event_batch_refs: string[];
  source_message_ids: string[];
  coverage_refs: string[];
  contribution_refs: string[];
  input_artifact_refs: string[];
  summary_cn: string;
}

export interface ProducedArtifact<TPayload> {
  ref: string;
  payload_schema: string;
  payload: TPayload;
  manifest: IndustryAgentArtifactManifest;
  message: IndustryAgentMessageEnvelope;
}

export interface AcademicHandoffBundle {
  event_batches: ProducedArtifact<EventBatchPayload>[];
  coverage_reports: ProducedArtifact<AxisToolCoverageReport>[];
  contributions: ProducedArtifact<LocalIndustryAgentContribution>[];
  daily_input: ProducedArtifact<LocalDailyIndustryEvidencePackInput>;
  events: IndustrySignalEvent[];
}

export interface AcademicFormalHandoffBundle {
  messages: Array<Record<string, unknown>>;
  manifests: Array<Record<string, unknown>>;
  payloads: Array<Record<string, unknown>>;
  artifactRefs: string[];
  positiveCanonicalFixtureRefs: string[];
  nearBoundaryFixtureRefs: string[];
  replayFixtureRefs: string[];
  evalFixtureRefs: string[];
  ownerBoundaryFixtureRefs: string[];
}

export const academicAgentId = "academic-agent";

export function responsibilityForAxis(axis: IndustryEvidenceAxisKey): IndustryResponsibilityId {
  return axis === "research_paper" ? "research-frontier" : "conference-academic";
}

export function executionContextFor(axis: IndustryEvidenceAxisKey): ExecutionContext {
  const responsibility = responsibilityForAxis(axis);
  return {
    primary_responsibility_id: responsibility,
    default_owner_agent_id: academicAgentId,
    operational_executor_id: academicAgentId,
    takeover_mode: "none",
  };
}

export function daysBetween(start: string, end: string): number {
  const startAt = new Date(start).getTime();
  const endAt = new Date(end).getTime();
  return Math.max(0, Math.floor((endAt - startAt) / 86_400_000));
}

export function sha1Json(value: unknown): string {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}
