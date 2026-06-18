import {
  EXTERNAL_PLATFORMS,
  type ExternalPlatform,
} from "../externalDiscovery/types.ts";
import type {
  AgentReachCoverage,
  AgentReachPlatformCoverage,
} from "./types.ts";

export interface CreateCompleteCoverageInput {
  activePlatforms: ExternalPlatform[];
  reservedPlatforms: ExternalPlatform[];
  providerCoverage?: Partial<Record<ExternalPlatform, AgentReachPlatformCoverage>>;
}

function uniquePlatforms(platforms: ExternalPlatform[]): Set<ExternalPlatform> {
  return new Set(platforms);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function copyCoverage(
  coverage: AgentReachPlatformCoverage,
): AgentReachPlatformCoverage {
  return {
    status: coverage.status,
    ...(coverage.reason ? { reason: coverage.reason } : {}),
    ...(coverage.warnings ? { warnings: [...coverage.warnings] } : {}),
  };
}

export function mergeAgentReachPlatformCoverage(
  current: AgentReachPlatformCoverage | undefined,
  incoming: AgentReachPlatformCoverage,
): AgentReachPlatformCoverage {
  if (!current) return copyCoverage(incoming);

  const warnings = uniqueStrings([
    ...(current.warnings ?? []),
    ...(incoming.warnings ?? []),
  ]);
  const withWarnings = (
    coverage: AgentReachPlatformCoverage,
  ): AgentReachPlatformCoverage => ({
    ...coverage,
    ...(warnings.length > 0 ? { warnings } : {}),
  });

  if (current.status === incoming.status) {
    return withWarnings({
      status: current.status,
      ...(current.reason || incoming.reason
        ? { reason: current.reason ?? incoming.reason }
        : {}),
    });
  }

  const statuses = new Set([current.status, incoming.status]);
  if (statuses.has("ok")) {
    if (statuses.has("partial") || statuses.has("unavailable") || statuses.has("failed")) {
      return withWarnings({
        status: "partial",
        reason: "multiple_provider_outcomes",
      });
    }
    return withWarnings({ status: "ok" });
  }

  if (statuses.has("partial")) {
    return withWarnings({
      status: "partial",
      reason: "multiple_provider_outcomes",
    });
  }

  if (statuses.has("failed")) {
    return withWarnings({
      status: "failed",
      reason: current.reason ?? incoming.reason ?? "provider_execution_failed",
    });
  }

  if (statuses.has("unavailable")) {
    return withWarnings({
      status: "unavailable",
      reason: current.reason ?? incoming.reason ?? "provider_transport_unavailable",
    });
  }

  if (statuses.has("manual_import_only")) {
    return withWarnings({
      status: "manual_import_only",
      reason: current.reason ?? incoming.reason ?? "reserved_provider_not_configured",
    });
  }

  return withWarnings({
    status: "not_configured",
    reason: current.reason ?? incoming.reason ?? "provider_not_configured",
  });
}

export function createCompleteCoverage(input: CreateCompleteCoverageInput): AgentReachCoverage {
  const activePlatforms = uniquePlatforms(input.activePlatforms);
  const reservedPlatforms = uniquePlatforms(input.reservedPlatforms);
  const coverage = {} as AgentReachCoverage;

  for (const platform of EXTERNAL_PLATFORMS) {
    const explicitCoverage = input.providerCoverage?.[platform];
    if (explicitCoverage) {
      coverage[platform] = explicitCoverage;
      continue;
    }

    if (reservedPlatforms.has(platform)) {
      coverage[platform] = {
        status: "manual_import_only",
        reason: "reserved_provider_not_configured",
      };
      continue;
    }

    if (activePlatforms.has(platform)) {
      coverage[platform] = {
        status: "not_configured",
        reason: "provider_selected_without_result",
      };
      continue;
    }

    coverage[platform] = {
      status: "not_configured",
      reason: "provider_not_selected",
    };
  }

  return coverage;
}
