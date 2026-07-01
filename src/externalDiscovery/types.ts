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

export const EXTERNAL_PLATFORMS = ["x_twitter", "reddit", "hacker_news", "official_web", "official_blog"] as const;
export const EXTERNAL_TARGET_TYPES = ["project", "paper", "product", "topic"] as const;
export const EXTERNAL_ACTOR_TYPES = ["institution", "team", "person", "community", "unknown"] as const;
export const EXTERNAL_REGISTRY_TIERS = ["core", "proven", "watch"] as const;
export const EXTERNAL_NAMED_ACTOR_SOURCE_ROLES = ["social_discussant", "official_publisher", "official_owner"] as const;

export interface ExternalSignalActor {
  actor_type: ExternalActorType;
  effective_tier: ExternalActorTier;
  tier_basis: ExternalTierBasis;
  provider_actor_id?: string;
  identity_hash?: string;
  display_name?: string;
  handle?: string;
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
  target_url?: string;
  target_repo_url?: string;
  raw_ref?: string;
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

export interface ExternalEvidence {
  evidence_id: string;
  event_ids: string[];
  scope: ExternalEvidenceScope;
  target_key: string;
  derived_signal_kinds: ExternalSignalKind[];
  platforms: ExternalPlatform[];
  named_registry_actors: ExternalNamedRegistryActor[];
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
