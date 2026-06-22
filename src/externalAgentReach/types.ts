import type {
  ExternalCoverageStatus,
  ExternalDiscoveryCoverage,
  ExternalPlatform,
  ExternalPlatformCoverage,
  ExternalProviderStatus,
} from "../externalDiscovery/types.ts";

export const AGENTREACH_TOOL_NAMES = [
  "agentreach.capabilities",
  "agentreach.search",
  "agentreach.collectActorMessages",
  "agentreach.discoverProjects",
  "agentreach.collectTrendSignals",
] as const;

export type AgentReachToolName = (typeof AGENTREACH_TOOL_NAMES)[number];

export type AgentReachGatewayIntent =
  | "search"
  | "discover_projects"
  | "collect_actor_messages"
  | "collect_trend_signals"
  | "capability_probe";

export type AgentReachEvidenceClass =
  | "project_discovery"
  | "actor_message"
  | "discussion_thread"
  | "product_launch"
  | "paper_mention"
  | "benchmark_mention"
  | "trend_signal";

export interface AgentReachActorRef {
  registry_id?: string;
  name?: string;
  identity_hash?: string;
}

export interface AgentReachTimeWindow {
  date?: string;
  since?: string;
  until?: string;
}

export interface AgentReachBudget {
  max_items_per_platform?: number;
  max_total_items?: number;
  timeout_ms?: number;
}

export interface AgentReachGatewayRequest {
  intent: AgentReachGatewayIntent;
  platforms?: ExternalPlatform[];
  topic?: string;
  query?: string;
  actors?: AgentReachActorRef[];
  time_window?: AgentReachTimeWindow;
  max_results?: number;
  budget?: AgentReachBudget;
  allowed_evidence_classes?: AgentReachEvidenceClass[];
  public_safety_mode: "public_safe_only";
}

export type GatewayRunStatus =
  | "ok"
  | "partial"
  | "skipped"
  | "unavailable"
  | "failed"
  | "not_configured";

export interface GatewayStatusMappingInput {
  gateway_status: GatewayRunStatus;
  configured?: boolean;
}

export interface AgentReachRejectedItem {
  reason_code: string;
  reason_detail?: string;
  platform?: ExternalPlatform;
}

export interface AgentReachRunnerObservation {
  platform: ExternalPlatform;
  raw_ref?: string;
  url?: string;
  observed_at: string;
  source_published_at?: string;
  title?: string;
  raw_event_kind?: string;
  derived_signal_kinds?: string[];
  actor?: unknown;
  target?: unknown;
  metrics?: unknown;
  direction_labels?: string[];
  tags?: string[];
}

export interface AgentReachLocalRunnerResult {
  provider_run_id?: string;
  generated_at?: string;
  gateway_status: GatewayRunStatus;
  configured?: boolean;
  query?: unknown;
  requested_platforms?: ExternalPlatform[];
  coverage?: ExternalDiscoveryCoverage;
  observations?: AgentReachRunnerObservation[];
  rejected_items?: AgentReachRejectedItem[];
  diagnostics?: {
    warnings?: string[];
  };
}

export interface AgentReachProviderArtifact {
  provider: "agent-reach";
  schema_version: "agent-reach.external-discovery.v1";
  provider_run_id: string;
  generated_at: string;
  query: unknown;
  platforms: ExternalPlatform[];
  status: ExternalProviderStatus;
  items: AgentReachRunnerObservation[];
  diagnostics: {
    warnings: string[];
  };
  coverage: Record<ExternalPlatform, ExternalPlatformCoverage>;
}

export type { ExternalCoverageStatus, ExternalPlatform, ExternalProviderStatus };
