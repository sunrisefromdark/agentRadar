import fs from "node:fs";

import {
  attachExternalActorIdentityHashes,
  parseExternalActorIdentityHashes,
} from "./actorIdentity.ts";
import { externalRawInputPath } from "./paths.ts";
import { containsForbiddenPublicArtifactText, stableSourceInputHash } from "./redaction.ts";
import {
  EXTERNAL_ACTOR_TYPES,
  EXTERNAL_COVERAGE_STATUSES,
  EXTERNAL_DIRECTION_LABELS,
  EXTERNAL_PLATFORMS,
  EXTERNAL_PROVIDER_STATUSES,
  EXTERNAL_PROVIDER_TIER_HINTS,
  EXTERNAL_RAW_EVENT_KINDS,
  EXTERNAL_SIGNAL_KINDS,
  type ExternalActorType,
  type ExternalCoverageStatus,
  type ExternalDiscoveryCoverage,
  type ExternalDirectionLabel,
  type ExternalPlatform,
  type ExternalPlatformCoverage,
  type ExternalProviderStatus,
  type ExternalProviderTierHint,
  type ExternalRawEventKind,
  type ExternalSignalEvent,
  type ExternalSignalKind,
  type ExternalTargetType,
  type NonEmptyExternalSignalKinds,
} from "./types.ts";

const PROVIDER_SCHEMA_VERSION = "agent-reach.external-discovery.v1";

export interface AgentReachRejectedEvent {
  raw_ref?: string;
  reason_code: string;
  reason_detail: string;
}

export interface AgentReachProviderResult {
  provider: "agent-reach";
  schema_version: typeof PROVIDER_SCHEMA_VERSION;
  provider_run_id?: string;
  source_input_ref: string;
  source_input_hash?: string;
  events: ExternalSignalEvent[];
  rejected_events: AgentReachRejectedEvent[];
  status: ExternalProviderStatus;
  status_reason: string;
  warnings: string[];
  coverage?: ExternalDiscoveryCoverage;
}

export interface LoadAgentReachProviderArtifactOptions {
  date: string;
  inputPath?: string;
}

interface AgentReachProviderArtifact {
  provider: "agent-reach";
  schema_version: typeof PROVIDER_SCHEMA_VERSION;
  provider_run_id: string;
  generated_at: string;
  query: unknown;
  platforms: ExternalPlatform[];
  status: ExternalProviderStatus;
  items: unknown[];
  diagnostics: {
    warnings: string[];
  };
  coverage?: ExternalDiscoveryCoverage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().trim().replace(/[_\s]+/g, "-");
}

const EXTERNAL_DIRECTION_LABEL_SYNONYMS: Record<string, ExternalDirectionLabel> = {
  "research-agent": "research-agent",
  "research agent": "research-agent",
  "office-agent": "office-agent",
  "office agent": "office-agent",
  "office-assistant": "personal-assistant-agent",
  "office assistant": "personal-assistant-agent",
  "personal-assistant": "personal-assistant-agent",
  "personal assistant": "personal-assistant-agent",
};

function canonicalizeDirectionLabels(value: unknown): {
  directionLabels: ExternalDirectionLabel[];
  warnings: string[];
} {
  if (!isStringArray(value)) return { directionLabels: [], warnings: [] };

  const directionLabels: ExternalDirectionLabel[] = [];
  const warnings: string[] = [];
  for (const label of value) {
    const normalized = normalizeLabel(label);
    const canonical =
      EXTERNAL_DIRECTION_LABELS.find((candidate) => candidate === normalized) ??
      EXTERNAL_DIRECTION_LABEL_SYNONYMS[label.trim().toLowerCase()];
    if (canonical) {
      if (!directionLabels.includes(canonical)) directionLabels.push(canonical);
      continue;
    }
    warnings.push(`dropped_direction_label:${label}`);
  }
  return { directionLabels, warnings };
}

function isExternalPlatform(value: unknown): value is ExternalPlatform {
  return typeof value === "string" && EXTERNAL_PLATFORMS.includes(value as ExternalPlatform);
}

function isProviderStatus(value: unknown): value is ExternalProviderStatus {
  return (
    typeof value === "string" &&
    EXTERNAL_PROVIDER_STATUSES.includes(value as ExternalProviderStatus)
  );
}

function isCoverageStatus(value: unknown): value is ExternalCoverageStatus {
  return (
    typeof value === "string" &&
    EXTERNAL_COVERAGE_STATUSES.includes(value as ExternalCoverageStatus)
  );
}

function isActorType(value: unknown): value is ExternalActorType {
  return typeof value === "string" && EXTERNAL_ACTOR_TYPES.includes(value as ExternalActorType);
}

function isProviderTierHint(value: unknown): value is ExternalProviderTierHint {
  return (
    typeof value === "string" &&
    EXTERNAL_PROVIDER_TIER_HINTS.includes(value as ExternalProviderTierHint)
  );
}

function isRawEventKind(value: unknown): value is ExternalRawEventKind {
  return (
    typeof value === "string" &&
    EXTERNAL_RAW_EVENT_KINDS.includes(value as ExternalRawEventKind)
  );
}

function isSignalKind(value: unknown): value is ExternalSignalKind {
  return typeof value === "string" && EXTERNAL_SIGNAL_KINDS.includes(value as ExternalSignalKind);
}

function failedResult(
  sourceInputRef: string,
  statusReason: string,
  rejectedEvent: AgentReachRejectedEvent,
  sourceInputHash?: string,
): AgentReachProviderResult {
  return {
    provider: "agent-reach",
    schema_version: PROVIDER_SCHEMA_VERSION,
    source_input_ref: sourceInputRef,
    source_input_hash: sourceInputHash,
    events: [],
    rejected_events: [rejectedEvent],
    status: "failed",
    status_reason: statusReason,
    warnings: [],
  };
}

function skippedResult(sourceInputRef: string): AgentReachProviderResult {
  return {
    provider: "agent-reach",
    schema_version: PROVIDER_SCHEMA_VERSION,
    source_input_ref: sourceInputRef,
    events: [],
    rejected_events: [],
    status: "skipped",
    status_reason: "input_missing",
    warnings: [],
  };
}

function validateArtifact(value: unknown): {
  artifact?: AgentReachProviderArtifact;
  errors: string[];
} {
  const errors: string[] = [];
  if (!isRecord(value)) return { errors: ["artifact must be an object"] };
  const parsedCoverage = parseCoverage(value.coverage);

  if (value.provider !== "agent-reach") errors.push('provider must be "agent-reach"');
  if (value.schema_version !== PROVIDER_SCHEMA_VERSION) {
    errors.push(`schema_version must be "${PROVIDER_SCHEMA_VERSION}"`);
  }
  if (!isNonEmptyString(value.provider_run_id)) errors.push("provider_run_id is required");
  if (!isNonEmptyString(value.generated_at)) errors.push("generated_at is required");
  if (!Object.hasOwn(value, "query")) errors.push("query is required");
  if (Object.hasOwn(value, "query") && containsForbiddenPublicArtifactText(value.query)) {
    errors.push("query is not public-safe");
  }
  if (!Array.isArray(value.platforms)) {
    errors.push("platforms is required");
  } else if (!value.platforms.every(isExternalPlatform)) {
    errors.push("platforms must only contain V1 external platforms");
  }
  if (!isProviderStatus(value.status)) errors.push("status is required");
  if (!Array.isArray(value.items)) errors.push("items is required");

  const diagnostics = value.diagnostics;
  if (!isRecord(diagnostics) || !Array.isArray(diagnostics.warnings)) {
    errors.push("diagnostics.warnings is required");
  } else if (!diagnostics.warnings.every((item) => typeof item === "string")) {
    errors.push("diagnostics.warnings must be string[]");
  } else if (containsForbiddenPublicArtifactText(diagnostics.warnings)) {
    errors.push("diagnostics.warnings are not public-safe");
  }

  errors.push(...parsedCoverage.errors);

  if (errors.length > 0) return { errors };
  const artifact = value as unknown as AgentReachProviderArtifact;
  if (parsedCoverage.coverage) artifact.coverage = parsedCoverage.coverage;
  return { artifact, errors };
}

function parseCoverage(value: unknown): {
  coverage?: ExternalDiscoveryCoverage;
  errors: string[];
} {
  if (value === undefined) return { errors: ["coverage is required"] };
  const errors: string[] = [];
  if (!isRecord(value)) return { errors: ["coverage must be an object"] };
  if (containsForbiddenPublicArtifactText(value)) {
    return { errors: ["coverage is not public-safe"] };
  }

  const coverage: ExternalDiscoveryCoverage = {};
  for (const [platform, rawCoverage] of Object.entries(value)) {
    if (!isExternalPlatform(platform)) {
      errors.push(`coverage.${platform} is not a V1 external platform`);
      continue;
    }
    if (!isRecord(rawCoverage)) {
      errors.push(`coverage.${platform} must be an object`);
      continue;
    }
    if (!isCoverageStatus(rawCoverage.status)) {
      errors.push(`coverage.${platform}.status is invalid`);
      continue;
    }

    const platformCoverage: ExternalPlatformCoverage = {
      status: rawCoverage.status,
    };
    if (rawCoverage.reason !== undefined) {
      if (!isNonEmptyString(rawCoverage.reason)) {
        errors.push(`coverage.${platform}.reason must be a non-empty string`);
      } else {
        platformCoverage.reason = rawCoverage.reason;
      }
    }
    if (rawCoverage.warnings !== undefined) {
      if (!isStringArray(rawCoverage.warnings)) {
        errors.push(`coverage.${platform}.warnings must be string[]`);
      } else {
        platformCoverage.warnings = [...rawCoverage.warnings];
      }
    }
    coverage[platform] = platformCoverage;
  }
  for (const platform of EXTERNAL_PLATFORMS) {
    if (!coverage[platform]) {
      errors.push(`coverage.${platform} is required`);
    }
  }

  return { coverage, errors };
}

function rawRefFromItem(item: unknown): string | undefined {
  if (!isRecord(item)) return undefined;
  return isNonEmptyString(item.raw_ref) ? item.raw_ref : undefined;
}

function rejectItem(item: unknown, reasonCode: string, reasonDetail: string): AgentReachRejectedEvent {
  return {
    raw_ref: rawRefFromItem(item),
    reason_code: reasonCode,
    reason_detail: reasonDetail,
  };
}

function derivedSignalKinds(item: Record<string, unknown>): NonEmptyExternalSignalKinds {
  const rawKinds = Array.isArray(item.derived_signal_kinds)
    ? item.derived_signal_kinds
    : isSignalKind(item.derived_signal_kind)
      ? [item.derived_signal_kind]
      : [];
  const kinds = [...new Set(rawKinds.filter(isSignalKind))];
  const firstKind = kinds[0];
  return firstKind ? [firstKind, ...kinds.slice(1)] : ["discovery"];
}

function inferRawEventKind(item: Record<string, unknown>): ExternalRawEventKind {
  return isRawEventKind(item.raw_event_kind) ? item.raw_event_kind : "unknown";
}

function inferTargetType(target: Record<string, unknown> | undefined): ExternalTargetType {
  if (target && isNonEmptyString(target.repo_url)) return "project";
  if (target && isNonEmptyString(target.paper_url)) return "paper";
  if (target && isNonEmptyString(target.topic_hint)) return "topic";
  return "product";
}

function canonicalActorType(actor: Record<string, unknown> | undefined): ExternalActorType {
  if (!actor || !isActorType(actor.type_hint)) return "unknown";
  return actor.type_hint;
}

function numericMetrics(value: unknown): ExternalSignalEvent["metrics"] | undefined {
  if (!isRecord(value)) return undefined;
  const metrics: NonNullable<ExternalSignalEvent["metrics"]> = {};
  for (const key of ["likes", "reposts", "comments", "upvotes", "replies"] as const) {
    if (typeof value[key] === "number" && Number.isFinite(value[key])) {
      metrics[key] = value[key];
    }
  }
  return Object.keys(metrics).length > 0 ? metrics : undefined;
}

function itemToEvent(
  item: unknown,
  providerRunId: string,
  inputHash: string,
  ingestedAt: string,
): { event?: ExternalSignalEvent; rejection?: AgentReachRejectedEvent; warnings: string[] } {
  if (!isRecord(item)) {
    return {
      rejection: rejectItem(item, "item_schema_invalid", "item must be an object"),
      warnings: [],
    };
  }

  if (!isExternalPlatform(item.platform)) {
    return {
      rejection: rejectItem(item, "unsupported_platform", "platform is not in V1 whitelist"),
      warnings: [],
    };
  }

  const rawRef = isNonEmptyString(item.raw_ref) ? item.raw_ref : undefined;
  const url = isNonEmptyString(item.url) ? item.url : undefined;
  if (!rawRef && !url) {
    return {
      rejection: rejectItem(item, "missing_trace_ref", "url and raw_ref cannot both be missing"),
      warnings: [],
    };
  }

  if (!isNonEmptyString(item.observed_at)) {
    return {
      rejection: rejectItem(item, "missing_observed_at", "observed_at is required"),
      warnings: [],
    };
  }

  const actor = isRecord(item.actor) ? item.actor : undefined;
  const target = isRecord(item.target) ? item.target : undefined;
  const targetType = inferTargetType(target);
  const topicHint =
    targetType === "topic" && target && isNonEmptyString(target.topic_hint)
      ? target.topic_hint
      : undefined;
  const itemTitle = isNonEmptyString(item.title) ? item.title : undefined;
  const targetName =
    (target && isNonEmptyString(target.name) ? target.name : undefined) ??
    topicHint ??
    itemTitle ??
    rawRef ??
    url ??
    "unknown external target";
  const providerTierHint =
    actor && isProviderTierHint(actor.tier_hint) ? actor.tier_hint : undefined;
  const canonicalActor = attachExternalActorIdentityHashes(
    {
      ...(actor && isNonEmptyString(actor.display_name) ? { display_name: actor.display_name } : {}),
      actor_type: canonicalActorType(actor),
      ...(providerTierHint ? { provider_tier_hint: providerTierHint } : {}),
      effective_tier: "unknown",
      tier_basis: "unknown",
    },
    parseExternalActorIdentityHashes(actor?.identity_hashes),
  );
  const { directionLabels, warnings } = canonicalizeDirectionLabels(item.direction_labels);
  const eventIdSeed = JSON.stringify({
    provider_run_id: providerRunId,
    raw_ref: rawRef,
    url,
    observed_at: item.observed_at,
    source_input_hash: inputHash,
  });

  return {
    event: {
      event_id: `agent-reach:${stableSourceInputHash(eventIdSeed).slice("sha256:".length)}`,
      provider: "agent-reach",
      platform: item.platform,
      raw_event_kind: inferRawEventKind(item),
      derived_signal_kinds: derivedSignalKinds(item),
      ...(isNonEmptyString(item.source_published_at)
        ? { source_published_at: item.source_published_at }
        : {}),
      observed_at: item.observed_at,
      ingested_at: ingestedAt,
      ...(url ? { event_url: url } : {}),
      ...(isNonEmptyString(item.title) ? { content_title: item.title } : {}),
      actor: canonicalActor,
      target: {
        target_type: targetType,
        name: targetName,
        ...(target && isNonEmptyString(target.url) ? { url: target.url } : {}),
        ...(target && isNonEmptyString(target.repo_url) ? { repo_url: target.repo_url } : {}),
        ...(target && isNonEmptyString(target.paper_url) ? { paper_url: target.paper_url } : {}),
        ...(topicHint ? { topic_hint: topicHint } : {}),
        binding_confidence: "unbound",
      },
      ...(numericMetrics(item.metrics) ? { metrics: numericMetrics(item.metrics) } : {}),
      direction_labels: directionLabels,
      tags: isStringArray(item.tags) ? item.tags : [],
      ...(rawRef ? { raw_ref: rawRef } : {}),
      notes: topicHint ? [`provider_topic_hint:${topicHint}`] : [],
    },
    warnings,
  };
}

export function loadAgentReachProviderArtifact(
  options: LoadAgentReachProviderArtifactOptions,
): AgentReachProviderResult {
  const sourceInputRef = options.inputPath ?? externalRawInputPath(options.date);
  const explicitInput = options.inputPath !== undefined;

  if (!fs.existsSync(sourceInputRef)) {
    return explicitInput
      ? failedResult(sourceInputRef, "input_missing", {
          reason_code: "input_missing",
          reason_detail: "explicit input path does not exist",
        })
      : skippedResult(sourceInputRef);
  }

  let rawText: string;
  try {
    rawText = fs.readFileSync(sourceInputRef, "utf-8");
  } catch {
    return failedResult(sourceInputRef, "input_unreadable", {
      reason_code: "input_unreadable",
      reason_detail: "explicit input path could not be read",
    });
  }

  const sourceInputHash = stableSourceInputHash(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return failedResult(
      sourceInputRef,
      "json_parse_error",
      {
        reason_code: "json_parse_error",
        reason_detail: "input JSON could not be parsed",
      },
      sourceInputHash,
    );
  }

  const { artifact, errors } = validateArtifact(parsed);
  if (!artifact) {
    return failedResult(
      sourceInputRef,
      "schema_invalid",
      {
        reason_code: "schema_invalid",
        reason_detail: errors.join("; "),
      },
      sourceInputHash,
    );
  }

  if (artifact.status === "failed" || artifact.status === "skipped") {
    return {
      provider: "agent-reach",
      schema_version: PROVIDER_SCHEMA_VERSION,
      provider_run_id: artifact.provider_run_id,
      source_input_ref: sourceInputRef,
      source_input_hash: sourceInputHash,
      events: [],
      rejected_events: [],
      status: artifact.status,
      status_reason: `provider_status_${artifact.status}`,
      warnings: artifact.diagnostics.warnings,
      ...(artifact.coverage ? { coverage: artifact.coverage } : {}),
    };
  }

  const events: ExternalSignalEvent[] = [];
  const rejectedEvents: AgentReachRejectedEvent[] = [];
  const itemWarnings: string[] = [];
  for (const item of artifact.items) {
    const { event, rejection, warnings } = itemToEvent(
      item,
      artifact.provider_run_id,
      sourceInputHash,
      artifact.generated_at,
    );
    if (event) events.push(event);
    if (rejection) rejectedEvents.push(rejection);
    itemWarnings.push(...warnings);
  }

  const status: ExternalProviderStatus = rejectedEvents.length > 0 ? "partial" : artifact.status;
  return {
    provider: "agent-reach",
    schema_version: PROVIDER_SCHEMA_VERSION,
    provider_run_id: artifact.provider_run_id,
    source_input_ref: sourceInputRef,
    source_input_hash: sourceInputHash,
    events,
    rejected_events: rejectedEvents,
    status,
    status_reason: rejectedEvents.length > 0 ? "partial_events_rejected" : artifact.status,
    warnings: [...artifact.diagnostics.warnings, ...itemWarnings],
    ...(artifact.coverage ? { coverage: artifact.coverage } : {}),
  };
}
