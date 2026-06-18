import type { ExternalPlatform } from "../../externalDiscovery/types.ts";
import { normalizeAgentReachProviderItems } from "../normalizer.ts";
import { AgentReachProviderError, toSafeAgentReachProviderError } from "../providerErrors.ts";
import type {
  AgentReachProviderContext,
  AgentReachProviderId,
  AgentReachProviderResult,
} from "../types.ts";

export interface ParseLiveProviderResponseInput {
  url: string;
  body: string;
  context: AgentReachProviderContext;
}

export type ParseLiveProviderResponse = (
  input: ParseLiveProviderResponseInput,
) => unknown[];

export function liveProviderNotConfigured(input: {
  providerId: AgentReachProviderId;
  defaultPlatform: ExternalPlatform;
}): AgentReachProviderResult {
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

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

export async function runLiveProvider(input: {
  context: AgentReachProviderContext;
  providerId: AgentReachProviderId;
  defaultPlatform: ExternalPlatform;
  parseResponse: ParseLiveProviderResponse;
}): Promise<AgentReachProviderResult> {
  const liveConfig = input.context.provider_config.live;
  if (liveConfig?.enabled !== true) {
    return liveProviderNotConfigured({
      providerId: input.providerId,
      defaultPlatform: input.defaultPlatform,
    });
  }

  const urls = liveConfig.urls ?? [];
  if (urls.length === 0) {
    throw new AgentReachProviderError({
      providerId: input.providerId,
      code: "configuration_invalid",
      retryable: false,
      safeMessage: `${input.providerId} live urls are required`,
    });
  }

  const timeoutMs = positiveInteger(liveConfig.timeout_ms, 5000);
  const maxResponseBytes = positiveInteger(liveConfig.max_response_bytes, 512_000);
  const rawItems: unknown[] = [];
  const fetchWarnings: string[] = [];
  const parseWarnings: string[] = [];
  let failedFetchCount = 0;
  let failedParseCount = 0;

  for (const url of urls) {
    let body: string;
    try {
      const response = await input.context.transport.request({
        provider_id: input.providerId,
        url,
        method: "GET",
        headers: {},
        timeout_ms: timeoutMs,
        max_response_bytes: maxResponseBytes,
      });
      body = response.body;
    } catch (error) {
      failedFetchCount += 1;
      const safeError = toSafeAgentReachProviderError(error, input.providerId);
      fetchWarnings.push(`live_fetch_failed:${safeError.code}`);
      continue;
    }

    try {
      rawItems.push(
        ...input.parseResponse({
          url,
          body,
          context: input.context,
        }),
      );
    } catch (error) {
      failedParseCount += 1;
      const safeError = toSafeAgentReachProviderError(error, input.providerId);
      parseWarnings.push(`live_parse_failed:${safeError.code}`);
    }
  }

  const warnings = [...fetchWarnings, ...parseWarnings];

  if (rawItems.length === 0 && failedParseCount > 0) {
    return {
      provider_id: input.providerId,
      status: "failed",
      items: [],
      coverage: {
        [input.defaultPlatform]: {
          status: "failed",
          reason: "provider_response_invalid",
          warnings,
        },
      },
      warnings,
      rejected_items: [],
    };
  }

  if (rawItems.length === 0 && failedFetchCount > 0) {
    return {
      provider_id: input.providerId,
      status: "unavailable",
      items: [],
      coverage: {
        [input.defaultPlatform]: {
          status: "unavailable",
          reason: "provider_transport_unavailable",
          warnings,
        },
      },
      warnings,
      rejected_items: [],
    };
  }

  const result = normalizeAgentReachProviderItems({
    providerId: input.providerId,
    rawItems,
    defaultPlatform: input.defaultPlatform,
  });
  if (failedFetchCount === 0 && failedParseCount === 0) return result;
  const reason =
    failedParseCount > 0 ? "provider_response_partial" : "provider_transport_partial";

  return {
    ...result,
    status: result.status === "failed" ? "failed" : "partial",
    coverage: {
      ...result.coverage,
      [input.defaultPlatform]: {
        status: result.coverage[input.defaultPlatform]?.status === "failed" ? "failed" : "partial",
        reason,
        warnings,
      },
    },
    warnings: [...result.warnings, ...warnings],
  };
}
