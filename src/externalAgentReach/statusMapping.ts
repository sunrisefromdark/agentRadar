import { EXTERNAL_PLATFORMS } from "../externalDiscovery/types.ts";
import type {
  AgentReachProviderArtifact,
  ExternalPlatform,
  ExternalProviderStatus,
  GatewayStatusMappingInput,
} from "./types.ts";

export type CompletedAgentReachCoverage = AgentReachProviderArtifact["coverage"];

export function mapGatewayRunStatusToProviderStatus(
  input: GatewayStatusMappingInput,
): ExternalProviderStatus {
  if (input.gateway_status === "ok") return "ok";
  if (input.gateway_status === "partial") return "partial";
  if (input.gateway_status === "failed") return "failed";
  if (input.gateway_status === "not_configured") return "skipped";
  if (input.gateway_status === "skipped") return "skipped";
  return input.configured ? "failed" : "skipped";
}

export function completeAgentReachCoverage(
  partialCoverage: Partial<CompletedAgentReachCoverage> | undefined,
  missingReason = "platform_not_returned_by_gateway",
): CompletedAgentReachCoverage {
  const coverage: Partial<CompletedAgentReachCoverage> = {};
  for (const platform of EXTERNAL_PLATFORMS) {
    coverage[platform] = partialCoverage?.[platform] ?? {
      status: "not_configured",
      reason: missingReason,
    };
  }
  return coverage as Record<ExternalPlatform, CompletedAgentReachCoverage[ExternalPlatform]>;
}
