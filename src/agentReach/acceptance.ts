import { containsForbiddenPublicArtifactText } from "../externalDiscovery/redaction.ts";
import { canonicalizeAgentReachUrl } from "./quality.ts";
import type {
  AgentReachCoverageStatus,
  AgentReachProviderArtifact,
} from "./types.ts";

export const AGENT_REACH_ACCEPTANCE_SCHEMA_VERSION =
  "agent-reach.acceptance.v1" as const;

export type AgentReachAcceptanceOutcome = "pass" | "warn" | "fail";

export interface AgentReachAcceptanceReport {
  schema_version: typeof AGENT_REACH_ACCEPTANCE_SCHEMA_VERSION;
  outcome: AgentReachAcceptanceOutcome;
  producer_status: AgentReachProviderArtifact["status"] | "not_run";
  item_count: number;
  usable_item_count: number;
  missing_title_count: number;
  missing_trace_count: number;
  missing_direction_labels_count: number;
  missing_source_published_at_count: number;
  duplicate_identity_count: number;
  direction_label_counts: Record<string, number>;
  coverage_status_counts: Partial<Record<AgentReachCoverageStatus, number>>;
  required_platform: "hacker_news";
  required_platform_status: AgentReachCoverageStatus;
  warning_count: number;
  reasons: string[];
}

function increment(
  target: Record<string, number>,
  key: string,
): void {
  target[key] = (target[key] ?? 0) + 1;
}

function sortedRecord<T extends string>(
  input: Partial<Record<T, number>>,
): Partial<Record<T, number>> {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => left.localeCompare(right)),
  ) as Partial<Record<T, number>>;
}

function itemIdentity(
  item: AgentReachProviderArtifact["items"][number],
): string | undefined {
  if (item.platform === "hacker_news" && item.raw_ref) {
    return `${item.platform}:raw_ref:${item.raw_ref}`;
  }
  const canonicalUrl = item.url
    ? canonicalizeAgentReachUrl(item.url)
    : undefined;
  if (canonicalUrl) return `${item.platform}:url:${canonicalUrl}`;
  return item.raw_ref
    ? `${item.platform}:raw_ref:${item.raw_ref}`
    : undefined;
}

export function failedAgentReachAcceptanceReport(): AgentReachAcceptanceReport {
  return {
    schema_version: AGENT_REACH_ACCEPTANCE_SCHEMA_VERSION,
    outcome: "fail",
    producer_status: "not_run",
    item_count: 0,
    usable_item_count: 0,
    missing_title_count: 0,
    missing_trace_count: 0,
    missing_direction_labels_count: 0,
    missing_source_published_at_count: 0,
    duplicate_identity_count: 0,
    direction_label_counts: {},
    coverage_status_counts: {},
    required_platform: "hacker_news",
    required_platform_status: "failed",
    warning_count: 0,
    reasons: ["producer_execution_failed"],
  };
}

export function evaluateAgentReachArtifact(
  artifact: AgentReachProviderArtifact,
): AgentReachAcceptanceReport {
  let missingTitleCount = 0;
  let missingTraceCount = 0;
  let missingDirectionLabelsCount = 0;
  let missingSourcePublishedAtCount = 0;
  let usableItemCount = 0;
  let duplicateIdentityCount = 0;
  const identities = new Set<string>();
  const directionLabelCounts: Record<string, number> = {};
  const coverageStatusCounts: Partial<
    Record<AgentReachCoverageStatus, number>
  > = {};

  for (const item of artifact.items) {
    const hasTitle =
      typeof item.title === "string" && item.title.trim().length > 0;
    const hasTrace = Boolean(item.url || item.raw_ref);
    const hasDirectionLabels = (item.direction_labels?.length ?? 0) > 0;

    if (!hasTitle) missingTitleCount += 1;
    if (!hasTrace) missingTraceCount += 1;
    if (!hasDirectionLabels) missingDirectionLabelsCount += 1;
    if (!item.source_published_at) missingSourcePublishedAtCount += 1;
    if (hasTitle && hasTrace && hasDirectionLabels) usableItemCount += 1;

    for (const label of item.direction_labels ?? []) {
      increment(directionLabelCounts, label);
    }

    const identity = itemIdentity(item);
    if (identity && identities.has(identity)) duplicateIdentityCount += 1;
    if (identity) identities.add(identity);
  }

  for (const coverage of Object.values(artifact.coverage)) {
    increment(
      coverageStatusCounts as Record<string, number>,
      coverage.status,
    );
  }

  const reasons: string[] = [];
  let outcome: AgentReachAcceptanceOutcome = "pass";
  const requiredPlatformStatus = artifact.coverage.hacker_news.status;

  if (artifact.status === "failed") {
    outcome = "fail";
    reasons.push("producer_status:failed");
  } else if (artifact.status !== "ok") {
    outcome = "warn";
    reasons.push(`producer_status:${artifact.status}`);
  }

  if (requiredPlatformStatus === "partial") {
    if (outcome === "pass") outcome = "warn";
    reasons.push("required_platform_status:partial");
  } else if (requiredPlatformStatus !== "ok") {
    outcome = "fail";
    reasons.push(`required_platform_status:${requiredPlatformStatus}`);
  }

  const hackerNewsSearchAttempted =
    requiredPlatformStatus === "ok" || requiredPlatformStatus === "partial";
  if (artifact.items.length === 0 && hackerNewsSearchAttempted) {
    if (outcome === "pass") outcome = "warn";
    reasons.push("zero_relevant_results");
  }

  if (
    missingTitleCount > 0 ||
    missingTraceCount > 0 ||
    missingDirectionLabelsCount > 0
  ) {
    if (outcome === "pass") outcome = "warn";
    reasons.push("incomplete_item_fields");
  }

  if (duplicateIdentityCount > 0) {
    if (outcome === "pass") outcome = "warn";
    reasons.push("duplicate_item_identity");
  }

  const publicSafetyViolation =
    containsForbiddenPublicArtifactText(artifact.query) ||
    containsForbiddenPublicArtifactText(artifact.items) ||
    containsForbiddenPublicArtifactText(artifact.coverage) ||
    containsForbiddenPublicArtifactText(artifact.diagnostics.warnings);
  if (publicSafetyViolation) {
    outcome = "fail";
    reasons.push("public_safety_violation");
  }

  return {
    schema_version: AGENT_REACH_ACCEPTANCE_SCHEMA_VERSION,
    outcome,
    producer_status: artifact.status,
    item_count: artifact.items.length,
    usable_item_count: usableItemCount,
    missing_title_count: missingTitleCount,
    missing_trace_count: missingTraceCount,
    missing_direction_labels_count: missingDirectionLabelsCount,
    missing_source_published_at_count: missingSourcePublishedAtCount,
    duplicate_identity_count: duplicateIdentityCount,
    direction_label_counts: sortedRecord(directionLabelCounts) as Record<
      string,
      number
    >,
    coverage_status_counts: sortedRecord(coverageStatusCounts),
    required_platform: "hacker_news",
    required_platform_status: requiredPlatformStatus,
    warning_count: artifact.diagnostics.warnings.length,
    reasons,
  };
}
