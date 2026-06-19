import type {
  ExternalDirectionLabel,
  ExternalPlatform,
  ExternalProviderStatus,
  ExternalRawEventKind,
  ExternalSignalKind,
} from "../externalDiscovery/types.ts";
import type { AgentReachQueryEntry } from "./queryPack.ts";
import type { AgentReachTransport } from "./transport.ts";

export const AGENT_REACH_PROVIDER = "agent-reach" as const;
export const AGENT_REACH_SCHEMA_VERSION = "agent-reach.external-discovery.v1" as const;

export const AGENT_REACH_PROVIDER_IDS = [
  "external-import",
  "rss-blog",
  "official-web",
  "hacker-news",
  "x_twitter",
  "reddit",
] as const;

export type AgentReachProviderId = (typeof AGENT_REACH_PROVIDER_IDS)[number];

export const AGENT_REACH_PROVIDER_MODES = ["active", "manual_import_only"] as const;
export type AgentReachProviderMode = (typeof AGENT_REACH_PROVIDER_MODES)[number];

export const AGENT_REACH_COVERAGE_STATUSES = [
  "ok",
  "partial",
  "not_configured",
  "manual_import_only",
  "unavailable",
  "failed",
] as const;

export type AgentReachCoverageStatus = (typeof AGENT_REACH_COVERAGE_STATUSES)[number];

export const AGENT_REACH_PROVIDER_RUN_STATUSES = AGENT_REACH_COVERAGE_STATUSES;
export type AgentReachProviderRunStatus =
  (typeof AGENT_REACH_PROVIDER_RUN_STATUSES)[number];

export interface AgentReachPlatformCoverage {
  status: AgentReachCoverageStatus;
  reason?: string;
  warnings?: string[];
}

export type AgentReachCoverage = Record<ExternalPlatform, AgentReachPlatformCoverage>;

export interface AgentReachProviderItem {
  raw_ref?: string;
  platform: ExternalPlatform;
  raw_event_kind?: ExternalRawEventKind;
  derived_signal_kinds?: ExternalSignalKind[];
  source_published_at?: string;
  observed_at: string;
  url?: string;
  title?: string;
  actor?: {
    display_name?: string;
    type_hint?: string;
    tier_hint?: string;
  };
  target?: {
    name?: string;
    url?: string;
    repo_url?: string;
    paper_url?: string;
    topic_hint?: string;
  };
  metrics?: Record<string, number>;
  direction_labels?: ExternalDirectionLabel[];
  tags?: string[];
}

export interface AgentReachProviderArtifact {
  provider: typeof AGENT_REACH_PROVIDER;
  schema_version: typeof AGENT_REACH_SCHEMA_VERSION;
  provider_run_id: string;
  generated_at: string;
  query: unknown;
  platforms: ExternalPlatform[];
  status: ExternalProviderStatus;
  items: AgentReachProviderItem[];
  diagnostics: {
    warnings: string[];
  };
  coverage: AgentReachCoverage;
}

export interface AgentReachArtifactWriteResult {
  output_path: string;
  dry_run: boolean;
  coverage_summary: string;
  artifact: AgentReachProviderArtifact;
}

export interface AgentReachRejectedProviderItem {
  raw_ref?: string;
  reason_code: string;
  reason_detail: string;
}

export interface AgentReachProviderConfig {
  input_path?: string;
  live?: {
    enabled?: boolean;
    urls?: string[];
    timeout_ms?: number;
    max_response_bytes?: number;
    query_limit?: number;
  };
}

export type AgentReachProviderConfigMap = Partial<
  Record<AgentReachProviderId, AgentReachProviderConfig>
>;

export interface AgentReachSearchJob {
  job_id: string;
  provider_id: AgentReachProviderId;
  query_entry_id: string;
  term: string;
  direction_labels: ExternalDirectionLabel[];
  tags: string[];
  max_items: number;
}

export interface AgentReachSearchPlanSummary {
  job_count: number;
  provider_count: number;
  query_entry_count: number;
  reserved_provider_count: number;
  max_items_per_query: number;
  provider_job_counts: Partial<Record<AgentReachProviderId, number>>;
}

export interface AgentReachSearchPlan {
  jobs: AgentReachSearchJob[];
  summary: AgentReachSearchPlanSummary;
}

export interface AgentReachQualityPolicy {
  lookback_days: number;
  max_items_per_query: number;
  max_items_per_provider: number;
  max_items_total: number;
}

export type AgentReachQualityPolicyInput = Partial<AgentReachQualityPolicy>;

export interface AgentReachProviderContext {
  date: string;
  generated_at: string;
  query_pack: readonly AgentReachQueryEntry[];
  search_jobs: readonly AgentReachSearchJob[];
  search_plan_summary: AgentReachSearchPlanSummary;
  provider_config: AgentReachProviderConfig;
  quality_policy: AgentReachQualityPolicy;
  transport: AgentReachTransport;
}

export interface AgentReachProviderResult {
  provider_id: AgentReachProviderId;
  status: AgentReachProviderRunStatus;
  items: AgentReachProviderItem[];
  coverage: Partial<Record<ExternalPlatform, AgentReachPlatformCoverage>>;
  warnings: string[];
  rejected_items: AgentReachRejectedProviderItem[];
}

export interface AgentReachProducerProvider {
  readonly provider_id: AgentReachProviderId;
  readonly platforms: readonly ExternalPlatform[];
  readonly mode: AgentReachProviderMode;
  readonly default_enabled: boolean;
  run(context: AgentReachProviderContext): Promise<AgentReachProviderResult>;
}

export type AgentReachProducerStatus = Exclude<ExternalProviderStatus, "skipped">;

export interface AgentReachProducerRunSummary {
  selected_provider_ids: AgentReachProviderId[];
  status: AgentReachProducerStatus;
  search_plan_summary: AgentReachSearchPlanSummary;
  provider_results: AgentReachProviderResult[];
  items: AgentReachProviderItem[];
  coverage: AgentReachCoverage;
  warnings: string[];
  rejected_items: AgentReachRejectedProviderItem[];
}
