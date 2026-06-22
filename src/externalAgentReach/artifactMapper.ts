import {
  EXTERNAL_PLATFORMS,
  type ExternalPlatformCoverage,
} from "../externalDiscovery/types.ts";
import { containsForbiddenPublicArtifactText } from "../externalDiscovery/redaction.ts";
import {
  type AgentReachLocalRunnerResult,
  type AgentReachProviderArtifact,
  type AgentReachRunnerObservation,
  type AgentReachGatewayRequest,
} from "./types.ts";
import {
  completeAgentReachCoverage,
  mapGatewayRunStatusToProviderStatus,
} from "./statusMapping.ts";

const PROVIDER_SCHEMA_VERSION = "agent-reach.external-discovery.v1";
const UNSAFE_RUNNER_COVERAGE_REASON = "unsafe_runner_coverage_reason_rejected";

function isSafeStringArray(value: string[] | undefined): string[] {
  return (value ?? []).filter((item) => !containsForbiddenPublicArtifactText(item));
}

function isSafeString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !containsForbiddenPublicArtifactText(value);
}

function safeRunnerMetadata(input: {
  result: AgentReachLocalRunnerResult;
  generatedAt: string;
}): {
  providerRunId: string;
  generatedAt: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  let providerRunId = `external-agentreach:${input.generatedAt}`;
  let generatedAt = input.generatedAt;

  if (input.result.provider_run_id !== undefined) {
    if (isSafeString(input.result.provider_run_id)) {
      providerRunId = input.result.provider_run_id;
    } else {
      warnings.push("unsafe_runner_metadata_rejected:provider_run_id");
    }
  }
  if (input.result.generated_at !== undefined) {
    if (isSafeString(input.result.generated_at)) {
      generatedAt = input.result.generated_at;
    } else {
      warnings.push("unsafe_runner_metadata_rejected:generated_at");
    }
  }

  return { providerRunId, generatedAt, warnings };
}

function safeCoverageFromRunnerResult(
  partialCoverage: AgentReachLocalRunnerResult["coverage"],
): {
  coverage: AgentReachProviderArtifact["coverage"];
  rejectedFieldCount: number;
} {
  const completedCoverage = completeAgentReachCoverage(partialCoverage);
  const safeCoverage: Partial<AgentReachProviderArtifact["coverage"]> = {};
  let rejectedFieldCount = 0;

  for (const platform of EXTERNAL_PLATFORMS) {
    const rawCoverage = completedCoverage[platform];
    const platformCoverage: ExternalPlatformCoverage = {
      status: rawCoverage.status,
    };

    if (rawCoverage.reason !== undefined) {
      if (containsForbiddenPublicArtifactText(rawCoverage.reason)) {
        platformCoverage.reason = UNSAFE_RUNNER_COVERAGE_REASON;
        rejectedFieldCount += 1;
      } else {
        platformCoverage.reason = rawCoverage.reason;
      }
    }

    if (rawCoverage.warnings !== undefined) {
      const warnings = rawCoverage.warnings.filter((warning) => {
        const safe = !containsForbiddenPublicArtifactText(warning);
        if (!safe) rejectedFieldCount += 1;
        return safe;
      });
      if (warnings.length > 0) platformCoverage.warnings = warnings;
    }

    safeCoverage[platform] = platformCoverage;
  }

  return {
    coverage: safeCoverage as AgentReachProviderArtifact["coverage"],
    rejectedFieldCount,
  };
}

function safeObjectField<T>(value: T | undefined): { value?: T; rejected: boolean } {
  if (value === undefined) return { rejected: false };
  if (containsForbiddenPublicArtifactText(value)) return { rejected: true };
  return { value, rejected: false };
}

function safeQueryFromRequest(request: AgentReachGatewayRequest): {
  query: Record<string, unknown>;
  rejectedFieldCount: number;
} {
  const query: Record<string, unknown> = {
    intent: request.intent,
  };
  let rejectedFieldCount = 0;

  const optionalFields = [
    ["platforms", request.platforms ? [...request.platforms] : undefined],
    ["topic", request.topic],
    ["query", request.query],
    ["actors", request.actors ? [...request.actors] : undefined],
    ["time_window", request.time_window],
    ["max_results", request.max_results],
    ["budget", request.budget],
    [
      "allowed_evidence_classes",
      request.allowed_evidence_classes ? [...request.allowed_evidence_classes] : undefined,
    ],
  ] as const;

  for (const [field, rawValue] of optionalFields) {
    const safeField = safeObjectField(rawValue);
    if (safeField.rejected) {
      rejectedFieldCount += 1;
      continue;
    }
    if (safeField.value !== undefined) query[field] = safeField.value;
  }

  return { query, rejectedFieldCount };
}

function rejectedItemWarnings(
  rejectedItems: AgentReachLocalRunnerResult["rejected_items"],
): string[] {
  const warnings: string[] = [];
  let unsafeRejectedItems = 0;

  for (const rejectedItem of rejectedItems ?? []) {
    if (containsForbiddenPublicArtifactText(rejectedItem)) {
      unsafeRejectedItems += 1;
      continue;
    }
    const warning = [
      "rejected_items",
      rejectedItem.platform ?? "unknown_platform",
      rejectedItem.reason_code,
      rejectedItem.reason_detail,
    ]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(":");
    warnings.push(warning);
  }

  if (unsafeRejectedItems > 0) {
    warnings.push(`rejected_items_rejected_unsafe:${unsafeRejectedItems}`);
  }
  return warnings;
}

function safeObservation(
  observation: AgentReachRunnerObservation,
): AgentReachRunnerObservation | undefined {
  if (containsForbiddenPublicArtifactText(observation)) return undefined;
  return {
    platform: observation.platform,
    ...(observation.raw_ref ? { raw_ref: observation.raw_ref } : {}),
    ...(observation.url ? { url: observation.url } : {}),
    observed_at: observation.observed_at,
    ...(observation.source_published_at
      ? { source_published_at: observation.source_published_at }
      : {}),
    ...(observation.title ? { title: observation.title } : {}),
    ...(observation.raw_event_kind ? { raw_event_kind: observation.raw_event_kind } : {}),
    ...(observation.derived_signal_kinds
      ? { derived_signal_kinds: [...observation.derived_signal_kinds] }
      : {}),
    ...(observation.actor ? { actor: observation.actor } : {}),
    ...(observation.target ? { target: observation.target } : {}),
    ...(observation.metrics ? { metrics: observation.metrics } : {}),
    ...(observation.direction_labels
      ? { direction_labels: [...observation.direction_labels] }
      : {}),
    ...(observation.tags ? { tags: [...observation.tags] } : {}),
  };
}

export function mapAgentReachRunnerResultToArtifact(input: {
  request: AgentReachGatewayRequest;
  result: AgentReachLocalRunnerResult;
  generatedAt: string;
}): AgentReachProviderArtifact {
  const metadata = safeRunnerMetadata({
    result: input.result,
    generatedAt: input.generatedAt,
  });
  const safeCoverage = safeCoverageFromRunnerResult(input.result.coverage);
  const safeItems = (input.result.observations ?? []).flatMap((observation) => {
    const item = safeObservation(observation);
    return item ? [item] : [];
  });
  const droppedUnsafeCount = (input.result.observations ?? []).length - safeItems.length;
  const safeQuery = safeQueryFromRequest(input.request);
  const warnings = [
    ...metadata.warnings,
    ...isSafeStringArray(input.result.diagnostics?.warnings),
    ...rejectedItemWarnings(input.result.rejected_items),
    ...(safeQuery.rejectedFieldCount > 0
      ? [`unsafe_query_fields_rejected:${safeQuery.rejectedFieldCount}`]
      : []),
    ...(safeCoverage.rejectedFieldCount > 0
      ? [`unsafe_coverage_fields_rejected:${safeCoverage.rejectedFieldCount}`]
      : []),
    ...(droppedUnsafeCount > 0 ? [`unsafe_observations_rejected:${droppedUnsafeCount}`] : []),
  ];

  return {
    provider: "agent-reach",
    schema_version: PROVIDER_SCHEMA_VERSION,
    provider_run_id: metadata.providerRunId,
    generated_at: metadata.generatedAt,
    query: safeQuery.query,
    platforms: [...EXTERNAL_PLATFORMS],
    status: mapGatewayRunStatusToProviderStatus({
      gateway_status: input.result.gateway_status,
      configured: input.result.configured,
    }),
    items: safeItems,
    diagnostics: {
      warnings,
    },
    coverage: safeCoverage.coverage,
  };
}
