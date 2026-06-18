export const EXTERNAL_PLATFORMS = [
  "x_twitter",
  "reddit",
  "hacker_news",
  "official_web",
  "official_blog",
] as const;

export type ExternalPlatform = (typeof EXTERNAL_PLATFORMS)[number];

export const EXTERNAL_PROVIDER_STATUSES = ["ok", "skipped", "partial", "failed"] as const;
export type ExternalProviderStatus = (typeof EXTERNAL_PROVIDER_STATUSES)[number];

export const EXTERNAL_COVERAGE_STATUSES = [
  "ok",
  "partial",
  "not_configured",
  "manual_import_only",
  "unavailable",
  "failed",
] as const;
export type ExternalCoverageStatus = (typeof EXTERNAL_COVERAGE_STATUSES)[number];

export interface ExternalPlatformCoverage {
  status: ExternalCoverageStatus;
  reason?: string;
  warnings?: string[];
}

export type ExternalDiscoveryCoverage = Partial<Record<ExternalPlatform, ExternalPlatformCoverage>>;

export const EXTERNAL_SIGNAL_KINDS = ["discovery", "evidence"] as const;
export type ExternalSignalKind = (typeof EXTERNAL_SIGNAL_KINDS)[number];

export const EXTERNAL_RAW_EVENT_KINDS = [
  "mention",
  "discussion",
  "official_release",
  "blog_post",
  "question",
  "showcase",
  "unknown",
] as const;
export type ExternalRawEventKind = (typeof EXTERNAL_RAW_EVENT_KINDS)[number];

export const EXTERNAL_TARGET_TYPES = ["project", "paper", "product", "topic"] as const;
export type ExternalTargetType = (typeof EXTERNAL_TARGET_TYPES)[number];

export const EXTERNAL_DIRECTION_LABELS = [
  "research-agent",
  "literature-review-agent",
  "research-data-analysis-agent",
  "academic-writing-agent",
  "office-agent",
  "personal-assistant-agent",
  "office-productivity-agent",
  "document-agent",
  "spreadsheet-agent",
  "meeting-agent",
  "workflow-automation-agent",
  "vertical-office-agent",
  "legal-agent",
  "finance-agent",
  "sales-crm-agent",
  "hr-agent",
  "healthcare-admin-agent",
  "education-agent",
  "enterprise-ops-agent",
] as const;
export type ExternalDirectionLabel = (typeof EXTERNAL_DIRECTION_LABELS)[number];

export const EXTERNAL_ACTOR_TYPES = ["institution", "team", "person", "community", "unknown"] as const;
export type ExternalActorType = (typeof EXTERNAL_ACTOR_TYPES)[number];

export const EXTERNAL_ACTOR_TIERS = ["core", "proven", "watch", "ordinary", "unknown"] as const;
export type ExternalActorTier = (typeof EXTERNAL_ACTOR_TIERS)[number];

export const EXTERNAL_REGISTRY_TIERS = ["core", "proven", "watch"] as const;
export type ExternalRegistryTier = (typeof EXTERNAL_REGISTRY_TIERS)[number];

export const EXTERNAL_PROVIDER_TIER_HINTS = [
  "core",
  "proven",
  "watch",
  "ordinary",
  "unknown",
] as const;
export type ExternalProviderTierHint = (typeof EXTERNAL_PROVIDER_TIER_HINTS)[number];

export type ExternalProvider = "agent-reach";
export type ExternalTierBasis = "registry" | "registry_miss" | "unknown";
export type ExternalBindingConfidence = "high" | "medium" | "low" | "unbound";
export type ExternalScope = "project" | "direction";
export type ExternalCandidateKind =
  | "new_external_discovery"
  | "needs_confirmation"
  | "external_evidence_boost"
  | "direction_watch";
export type ExternalCandidateQualification =
  | "observe"
  | "needs_primary_confirmation"
  | "supporting_evidence_only";
export type NonEmptyExternalSignalKinds = readonly [
  ExternalSignalKind,
  ...ExternalSignalKind[],
];

export interface ExternalSignalEvent {
  event_id: string;
  provider: ExternalProvider;
  platform: ExternalPlatform;
  raw_event_kind: ExternalRawEventKind;
  derived_signal_kinds: NonEmptyExternalSignalKinds;
  source_published_at?: string;
  observed_at: string;
  ingested_at: string;
  event_url?: string;
  content_text?: string;
  content_title?: string;
  language?: string;
  actor: {
    display_name?: string;
    handle?: string;
    platform_profile_url?: string;
    actor_type: ExternalActorType;
    registry_entity_id?: string;
    registry_tier?: ExternalRegistryTier;
    provider_tier_hint?: ExternalProviderTierHint;
    effective_tier: ExternalActorTier;
    tier_basis: ExternalTierBasis;
  };
  target: {
    target_type: ExternalTargetType;
    name: string;
    url?: string;
    repo_url?: string;
    paper_url?: string;
    canonical_key?: string;
    topic_key?: string;
    topic_hint?: string;
    binding_confidence: ExternalBindingConfidence;
  };
  metrics?: {
    likes?: number;
    reposts?: number;
    comments?: number;
    upvotes?: number;
    replies?: number;
  };
  direction_labels: ExternalDirectionLabel[];
  tags: string[];
  raw_ref?: string;
  notes: string[];
}

export interface ExternalEvidence {
  evidence_id: string;
  event_ids: string[];
  scope: ExternalScope;
  target_key: string;
  derived_signal_kinds: NonEmptyExternalSignalKinds;
  direction_labels: ExternalDirectionLabel[];
  platforms: ExternalPlatform[];
  actor_tiers: Partial<Record<ExternalActorTier, number>>;
  actor_types: Partial<Record<ExternalActorType, number>>;
  mention_count: number;
  distinct_actor_count: number;
  first_seen_at: string;
  last_seen_at: string;
  active_day_count: number;
  cross_platform: boolean;
  authority_summary_cn: string;
  intensity_summary_cn: string;
  persistence_summary_cn: string;
  caveats: string[];
}

export interface ObservationCandidate {
  candidate_id: string;
  scope: ExternalScope;
  candidate_kind: ExternalCandidateKind;
  target_key: string;
  display_name: string;
  repo_url?: string;
  paper_url?: string;
  topic_key?: string;
  direction_labels: ExternalDirectionLabel[];
  binding_confidence: ExternalBindingConfidence;
  evidence_ids: string[];
  evidence_summary_cn: string;
  qualification: ExternalCandidateQualification;
  can_enter_daily: boolean;
  can_enter_weekly: boolean;
  cannot_be_primary_conclusion: true;
  caveats: string[];
}

export interface DailyExternalAggregate {
  schema_version: "external-discovery.aggregate.v1";
  date: string;
  generated_at: string;
  provider: ExternalProvider;
  provider_run_id?: string;
  status: ExternalProviderStatus;
  status_reason?: string;
  source_input_ref?: string;
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
  direction_label_counts: Partial<Record<ExternalDirectionLabel, number>>;
  project_evidence: ExternalEvidence[];
  direction_evidence: ExternalEvidence[];
  observation_candidates: ObservationCandidate[];
  audit: {
    coverage?: ExternalDiscoveryCoverage;
    rejected_events: Array<{
      raw_ref?: string;
      reason_code: string;
      reason_detail: string;
    }>;
    warnings: string[];
  };
}

export interface ExternalDiscoveryAudit {
  provider: ExternalProvider;
  schema_version: string;
  provider_run_id?: string;
  status: ExternalProviderStatus;
  status_reason?: string;
  source_input_ref?: string;
  source_input_hash?: string;
  rejected_events: Array<{
    raw_ref?: string;
    reason_code: string;
    reason_detail: string;
  }>;
  warnings: string[];
}
