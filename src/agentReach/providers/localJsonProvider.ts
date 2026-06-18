import fs from "node:fs";

import type { ExternalPlatform } from "../../externalDiscovery/types.ts";
import { normalizeAgentReachProviderItems } from "../normalizer.ts";
import { AgentReachProviderError } from "../providerErrors.ts";
import type {
  AgentReachProviderContext,
  AgentReachProviderId,
  AgentReachProviderResult,
} from "../types.ts";

export interface LoadLocalJsonProviderInput {
  inputPath: string;
  providerId: AgentReachProviderId;
  defaultPlatform: ExternalPlatform;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadLocalJsonProvider(
  input: LoadLocalJsonProviderInput,
): AgentReachProviderResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(input.inputPath, "utf-8")) as unknown;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error && error.code === "ENOENT"
        ? "input_missing"
        : "input_invalid";
    throw new AgentReachProviderError({
      providerId: input.providerId,
      code,
      retryable: false,
      safeMessage:
        code === "input_missing"
          ? `${input.providerId} input is missing`
          : `${input.providerId} input JSON is invalid`,
      cause: error,
    });
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
    throw new AgentReachProviderError({
      providerId: input.providerId,
      code: "input_invalid",
      retryable: false,
      safeMessage: `${input.providerId} input must contain items[]`,
    });
  }
  return normalizeAgentReachProviderItems({
    providerId: input.providerId,
    rawItems: parsed.items,
    defaultPlatform: input.defaultPlatform,
  });
}

export async function runLocalJsonProvider(input: {
  context: AgentReachProviderContext;
  providerId: AgentReachProviderId;
  defaultPlatform: ExternalPlatform;
}): Promise<AgentReachProviderResult> {
  const inputPath = input.context.provider_config.input_path;
  if (!inputPath) {
    return {
      provider_id: input.providerId,
      status: "not_configured",
      items: [],
      coverage: {
        [input.defaultPlatform]: {
          status: "not_configured",
          reason: "provider_input_not_configured",
        },
      },
      warnings: [],
      rejected_items: [],
    };
  }

  return loadLocalJsonProvider({
    inputPath,
    providerId: input.providerId,
    defaultPlatform: input.defaultPlatform,
  });
}
