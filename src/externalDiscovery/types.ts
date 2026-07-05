export type ExternalPlatform = "x_twitter" | "reddit" | "hacker_news" | "official_web" | "official_blog";
export type ExternalProviderStatus = "ok" | "skipped" | "partial" | "failed";
export type ExternalSignalKind = "discovery" | "evidence";
export type ExternalRawEventKind = "mention" | "discussion" | "official_release" | "blog_post" | "question" | "showcase" | "unknown";
export type ExternalTargetType = "project" | "paper" | "product" | "topic";
export type ExternalActorType = "institution" | "team" | "person" | "community" | "unknown";
export type ExternalActorTier = "core" | "proven" | "watch" | "ordinary" | "unknown";
export type ExternalRegistryTier = "core" | "proven" | "watch";
export type ExternalProviderTierHint = "core" | "proven" | "watch" | "ordinary" | "unknown";
export type ExternalEvidenceScope = "project" | "direction";
export type ExternalTierBasis = "registry" | "provider_hint" | "none";
export type ExternalNamedActorSourceRole = "social_discussant" | "official_publisher" | "official_owner";
export type ExternalPublicActorRole =
  | "discussion_actor"
  | "community_source"
  | "official_publisher"
  | "project_owner"
  | "registry_entity";
export type ExternalPublicActorSourceBasis =
  | "registry_match"
  | "explicit_actor_field"
  | "source_url_path"
  | "official_source_url"
  | "target_official_url";
export type ExternalPublicActorAuthorityTier = "core" | "proven" | "watch" | "ordinary" | "unknown";
export type ExternalPublicActorTierBasis = "registry_match" | "provider_hint" | "none";
export type ExternalPublicActorIdentityStatus = "available" | "missing" | "invalid_reserved_path" | "redacted";
export type ExternalPublicActorIdentityReason =
  | "actor_public_identity_available"
  | "actor_public_identity_missing"
  | "x_reserved_or_indirect_url"
  | "official_source_url_missing"
  | "registry_entity_not_matched"
  | "redacted_for_public_safety";
export type ExternalTrendWindowStatus = "ok" | "partial" | "failed" | "insufficient" | "skipped";
export type ExternalTrendWindowReadStatus =
  | "ok"
  | "not_found"
  | "parse_error"
  | "partial"
  | "insufficient"
  | "failed"
  | "skipped";
export type ExternalTrendBindingConfidence = "high" | "medium" | "low" | "none";
export type ExternalTrendMomentum = "spike" | "rising" | "stable" | "fading" | "insufficient";
export type ExternalTrendVerdict = "external_reinforcement" | "watch_signal" | "noise_spike" | "insufficient";
export type ExternalWeeklyGateReason =
  | "cross_platform_confirmation"
  | "multi_actor_confirmation"
  | "multi_day_persistence"
  | "registry_tier_participation";
export type ExternalTrendComponentName =
  | "discussion_volume"
  | "persistence"
  | "cross_platform_confirmation"
  | "actor_authority"
  | "binding_confidence"
  | "noise_risk";
export type ExternalTrendComponentLevel = "none" | "low" | "medium" | "high";

export const EXTERNAL_PLATFORMS = ["x_twitter", "reddit", "hacker_news", "official_web", "official_blog"] as const;
export const EXTERNAL_TARGET_TYPES = ["project", "paper", "product", "topic"] as const;
export const EXTERNAL_ACTOR_TYPES = ["institution", "team", "person", "community", "unknown"] as const;
export const EXTERNAL_REGISTRY_TIERS = ["core", "proven", "watch"] as const;
export const EXTERNAL_NAMED_ACTOR_SOURCE_ROLES = ["social_discussant", "official_publisher", "official_owner"] as const;
export const EXTERNAL_PUBLIC_ACTOR_ROLES = [
  "discussion_actor",
  "community_source",
  "official_publisher",
  "project_owner",
  "registry_entity",
] as const;
export const EXTERNAL_PUBLIC_ACTOR_SOURCE_KINDS = [
  "registry_entity",
  "x_handle",
  "reddit_community",
  "reddit_user",
  "hn_user",
  "github_owner",
  "official_domain",
  "provider_actor",
] as const;
export const EXTERNAL_PUBLIC_ACTOR_SOURCE_BASES = [
  "registry_match",
  "explicit_actor_field",
  "source_url_path",
  "official_source_url",
  "target_official_url",
] as const;
export const EXTERNAL_PUBLIC_ACTOR_AUTHORITY_TIERS = ["core", "proven", "watch", "ordinary", "unknown"] as const;
export const EXTERNAL_PUBLIC_ACTOR_TIER_BASES = ["registry_match", "provider_hint", "none"] as const;
export const EXTERNAL_PUBLIC_ACTOR_IDENTITY_STATUSES = ["available", "missing", "invalid_reserved_path", "redacted"] as const;
export const EXTERNAL_PUBLIC_ACTOR_IDENTITY_REASONS = [
  "actor_public_identity_available",
  "actor_public_identity_missing",
  "x_reserved_or_indirect_url",
  "official_source_url_missing",
  "registry_entity_not_matched",
  "redacted_for_public_safety",
] as const;
export const EXTERNAL_TREND_WINDOW_READ_STATUSES = ["ok", "not_found", "parse_error", "partial", "insufficient", "failed", "skipped"] as const;
export const EXTERNAL_WEEKLY_GATE_REASONS = [
  "cross_platform_confirmation",
  "multi_actor_confirmation",
  "multi_day_persistence",
  "registry_tier_participation",
] as const;
export const EXTERNAL_TREND_COMPONENT_NAMES = [
  "discussion_volume",
  "persistence",
  "cross_platform_confirmation",
  "actor_authority",
  "binding_confidence",
  "noise_risk",
] as const;

export function isExternalPlatform(value: unknown): value is ExternalPlatform {
  return EXTERNAL_PLATFORMS.includes(value as ExternalPlatform);
}

export interface ExternalSignalActor {
  actor_type: ExternalActorType;
  effective_tier: ExternalActorTier;
  tier_basis: ExternalTierBasis;
  provider_actor_id?: string;
  identity_hash?: string;
  display_name?: string;
  handle?: string;
  author?: string;
  username?: string;
  user?: string;
  subreddit?: string;
  community?: string;
  hn_user?: string;
  platform_profile_url?: string;
  provider_tier_hint?: ExternalProviderTierHint;
  registry_entity_id?: string;
  registry_display_name?: string;
  registry_tier?: ExternalRegistryTier;
  source_roles?: ExternalNamedActorSourceRole[];
}

export interface ExternalSignalEvent {
  event_id: string;
  platform: ExternalPlatform;
  raw_event_kind: ExternalRawEventKind;
  derived_signal_kinds: ExternalSignalKind[];
  scope: ExternalEvidenceScope;
  target_type: ExternalTargetType;
  target_key: string;
  actor: ExternalSignalActor;
  observed_at: string;
  source_published_at?: string;
  ingested_at?: string;
  url?: string;
  source_url?: string;
  permalink?: string;
  discussion_url?: string;
  target_url?: string;
  target_repo_url?: string;
  raw_ref?: string;
  actor_public_identity_status?: ExternalPublicActorIdentityStatus;
  actor_public_identity_reason?: ExternalPublicActorIdentityReason;
}

export interface ExternalNamedRegistryActor {
  entity_id: string;
  display_name: string;
  actor_type: "institution" | "team" | "person";
  registry_tier: ExternalRegistryTier;
  source_roles: ExternalNamedActorSourceRole[];
  event_count: number;
  platforms: ExternalPlatform[];
  first_seen_at: string;
  last_seen_at: string;
}

export type ExternalPublicActorSourceKind =
  | "registry_entity"
  | "x_handle"
  | "reddit_community"
  | "reddit_user"
  | "hn_user"
  | "github_owner"
  | "official_domain"
  | "provider_actor";

export interface ExternalPublicActor {
  public_actor_id: string;
  display_name: string;
  actor_type: ExternalActorType;
  actor_role: ExternalPublicActorRole;
  authority_tier?: ExternalPublicActorAuthorityTier;
  tier_basis: ExternalPublicActorTierBasis;
  is_head_actor: boolean;
  source_kind: ExternalPublicActorSourceKind;
  source_basis: ExternalPublicActorSourceBasis;
  event_count: number;
  platforms: ExternalPlatform[];
  first_seen_at: string;
  last_seen_at: string;
}

export interface ExternalPublicActorAudit {
  platform: ExternalPlatform;
  status: ExternalPublicActorIdentityStatus;
  reason: ExternalPublicActorIdentityReason;
  event_count: number;
}

export interface ExternalEvidence {
  evidence_id: string;
  event_ids: string[];
  scope: ExternalEvidenceScope;
  target_key: string;
  derived_signal_kinds: ExternalSignalKind[];
  platforms: ExternalPlatform[];
  named_registry_actors: ExternalNamedRegistryActor[];
  public_actors?: ExternalPublicActor[];
  public_actor_audit?: ExternalPublicActorAudit[];
  actor_tiers: Partial<Record<ExternalActorTier, number>>;
  actor_types: Partial<Record<ExternalActorType, number>>;
  mention_count: number;
  distinct_actor_count: number;
  top_tier_actor_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export interface ObservationCandidate {
  candidate_kind: "project" | "paper" | "product" | "direction";
  target_key: string;
  qualification: "needs_primary_confirmation" | "direction_observation";
  can_enter_daily: boolean;
  can_enter_weekly: boolean;
  cannot_be_primary_conclusion: true;
}

export interface ExternalDiscoveryAudit {
  rejected_events: Array<{
    event_id?: string;
    reason_code: string;
    reason_detail: string;
  }>;
  warnings: Array<{
    reason_code: string;
    reason_detail: string;
  }>;
}

export interface DailyExternalAggregate {
  schema_version: "external-discovery.aggregate.v1";
  date: string;
  generated_at: string;
  provider: "agent-reach";
  provider_run_id?: string;
  status: ExternalProviderStatus;
  status_reason?: string;
  source_input_hash: string;
  public_safe: true;
  redaction_policy_version: string;
  contains_raw_text: false;
  contains_profile_urls: false;
  event_count: number;
  accepted_event_count: number;
  rejected_event_count: number;
  platform_counts: Partial<Record<ExternalPlatform, number>>;
  derived_signal_kind_counts: Partial<Record<ExternalSignalKind, number>>;
  project_evidence: ExternalEvidence[];
  direction_evidence: ExternalEvidence[];
  observation_candidates: ObservationCandidate[];
  audit: ExternalDiscoveryAudit;
}

export interface ExternalTrendDailyCount {
  date: string;
  mention_count: number;
  source_count: number;
  platform_count: number;
}

export interface ExternalTrendComponent {
  name: ExternalTrendComponentName;
  level: ExternalTrendComponentLevel;
  evidence: string[];
}

export interface ExternalTrendItem {
  trend_id: string;
  scope: ExternalEvidenceScope;
  target_key: string;
  display_name: string;
  target_url?: string;
  binding_confidence: ExternalTrendBindingConfidence;
  official_signal: boolean;
  weekly_eligible: boolean;
  weekly_gate_reasons: ExternalWeeklyGateReason[];
  weekly_gate_missing_reasons: ExternalWeeklyGateReason[];
  daily_counts: ExternalTrendDailyCount[];
  mention_count_total: number;
  source_count: number;
  active_day_count: number;
  platform_count: number;
  cross_platform_days: number;
  distinct_actor_count: number;
  top_tier_actor_count: number;
  named_registry_actors: ExternalNamedRegistryActor[];
  components: ExternalTrendComponent[];
  momentum: ExternalTrendMomentum;
  verdict: ExternalTrendVerdict;
  cannot_be_primary_conclusion: true;
  evidence_ids: string[];
  source_aggregate_dates: string[];
  caveats: string[];
}

export interface ExternalTrendCoverage {
  expected_dates: string[];
  loaded_dates: string[];
  missing_dates: string[];
  failed_dates: Array<{
    date: string;
    reason_code: string;
    reason_detail: string;
  }>;
  usable_day_count: number;
  platform_counts: Partial<Record<ExternalPlatform, number>>;
  partial_platforms: ExternalPlatform[];
}

export interface ExternalTrendAudit {
  rejected_items: Array<{
    scope?: ExternalEvidenceScope;
    target_key?: string;
    reason_code: string;
    reason_detail: string;
  }>;
  warnings: Array<{
    reason_code: string;
    reason_detail: string;
  }>;
}

export interface ExternalDiscussionTrendWindow {
  schema_version: "external-discussion-trend-window.v1";
  anchor_date: string;
  window_start: string;
  window_end: string;
  window_days: 7;
  generated_at: string;
  status: ExternalTrendWindowStatus;
  status_reason?: string;
  project_trends: ExternalTrendItem[];
  direction_trends: ExternalTrendItem[];
  coverage: ExternalTrendCoverage;
  audit: ExternalTrendAudit;
  public_safe: true;
  redaction_policy_version: string;
  contains_raw_text: false;
  contains_profile_urls: false;
}

export interface ProviderRejectedEvent {
  event_id?: string;
  reason_code: string;
  reason_detail: string;
}

export interface ExternalCandidateExplanationTitleContext {
  event_id?: string;
  target_key: string;
  target_display_name?: string;
  public_evidence_title?: string;
  public_source_title?: string;
  source_platform: ExternalPlatform;
}

export interface AgentReachProviderReadResult {
  provider: "agent-reach";
  schema_version: "agent-reach.external-discovery.v1";
  provider_run_id?: string;
  generated_at?: string;
  status: ExternalProviderStatus;
  status_reason?: string;
  platforms: ExternalPlatform[];
  events: ExternalSignalEvent[];
  rejected_events: ProviderRejectedEvent[];
  warnings: ExternalDiscoveryAudit["warnings"];
  source_input_hash: string;
  title_context: ExternalCandidateExplanationTitleContext[];
}
