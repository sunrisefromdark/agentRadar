import { EXTERNAL_PLATFORMS, type ExternalPlatform } from "../externalDiscovery/types.ts";
import {
  AGENTREACH_TOOL_NAMES,
  type AgentReachGatewayRequest,
} from "./types.ts";

export { AGENTREACH_TOOL_NAMES };

export type AgentReachGatewayRequestInput = Omit<
  AgentReachGatewayRequest,
  "platforms" | "public_safety_mode"
> & {
  platforms?: string[];
};

function assertExternalPlatform(platform: string): asserts platform is ExternalPlatform {
  if (!EXTERNAL_PLATFORMS.includes(platform as ExternalPlatform)) {
    throw new Error(`unsupported_external_platform:${platform}`);
  }
}

export function buildAgentReachGatewayRequest(
  input: AgentReachGatewayRequestInput,
): AgentReachGatewayRequest {
  const platforms = input.platforms?.map((platform) => {
    assertExternalPlatform(platform);
    return platform;
  });

  return {
    intent: input.intent,
    ...(platforms ? { platforms } : {}),
    ...(input.topic !== undefined ? { topic: input.topic } : {}),
    ...(input.query !== undefined ? { query: input.query } : {}),
    ...(input.actors !== undefined ? { actors: input.actors } : {}),
    ...(input.time_window !== undefined ? { time_window: input.time_window } : {}),
    ...(input.max_results !== undefined ? { max_results: input.max_results } : {}),
    ...(input.budget !== undefined ? { budget: input.budget } : {}),
    ...(input.allowed_evidence_classes !== undefined
      ? { allowed_evidence_classes: input.allowed_evidence_classes }
      : {}),
    public_safety_mode: "public_safe_only",
  };
}
