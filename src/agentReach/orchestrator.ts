import type { ExternalPlatform } from "../externalDiscovery/types.ts";
import {
  createCompleteCoverage,
  mergeAgentReachPlatformCoverage,
} from "./coverageAudit.ts";
import { toSafeAgentReachProviderError } from "./providerErrors.ts";
import { selectAgentReachProviders } from "./providerRegistry.ts";
import type { AgentReachQueryEntry } from "./queryPack.ts";
import type { AgentReachTransport } from "./transport.ts";
import type {
  AgentReachCoverage,
  AgentReachProducerProvider,
  AgentReachProducerRunSummary,
  AgentReachProviderConfig,
  AgentReachProviderId,
  AgentReachProviderResult,
  AgentReachProviderRunStatus,
} from "./types.ts";

export interface RunAgentReachProvidersInput {
  selected_provider_ids: readonly AgentReachProviderId[];
  providers: readonly AgentReachProducerProvider[];
  date: string;
  generated_at: string;
  query_pack: readonly AgentReachQueryEntry[];
  provider_configs: Partial<Record<AgentReachProviderId, AgentReachProviderConfig>>;
  transport: AgentReachTransport;
}

function mergeCoverage(
  target: Partial<AgentReachCoverage>,
  result: AgentReachProviderResult,
): void {
  for (const [platform, coverage] of Object.entries(result.coverage) as Array<
    [ExternalPlatform, AgentReachCoverage[ExternalPlatform]]
  >) {
    target[platform] = mergeAgentReachPlatformCoverage(target[platform], coverage);
  }
}

function failureStatusForCode(
  code: ReturnType<typeof toSafeAgentReachProviderError>["code"],
): Extract<AgentReachProviderRunStatus, "unavailable" | "failed"> {
  return code === "timeout" || code === "http" || code === "unavailable"
    ? "unavailable"
    : "failed";
}

function failedProviderResult(
  provider: AgentReachProducerProvider,
  error: unknown,
): AgentReachProviderResult {
  const safeError = toSafeAgentReachProviderError(error, provider.provider_id);
  const status = failureStatusForCode(safeError.code);
  const coverage = Object.fromEntries(
    provider.platforms.map((platform) => [
      platform,
      {
        status,
        reason:
          status === "unavailable"
            ? "provider_transport_unavailable"
            : "provider_execution_failed",
      },
    ]),
  ) as AgentReachProviderResult["coverage"];

  return {
    provider_id: provider.provider_id,
    status,
    items: [],
    coverage,
    warnings: [`provider_failed:${provider.provider_id}:${safeError.code}`],
    rejected_items: [],
  };
}

function computeProducerStatus(input: {
  selectedProviders: readonly AgentReachProducerProvider[];
  providerResults: readonly AgentReachProviderResult[];
  rejectedItemCount: number;
}): AgentReachProducerRunSummary["status"] {
  const activeIds = new Set(
    input.selectedProviders
      .filter((provider) => provider.mode === "active")
      .map((provider) => provider.provider_id),
  );
  const activeResults = input.providerResults.filter((result) =>
    activeIds.has(result.provider_id),
  );
  const attemptedActiveResults = activeResults.filter(
    (result) => result.status !== "not_configured",
  );
  const allAttemptedActiveFailed =
    attemptedActiveResults.length > 0 &&
    attemptedActiveResults.every(
      (result) => result.status === "failed" || result.status === "unavailable",
    );
  if (allAttemptedActiveFailed) return "failed";

  if (
    input.rejectedItemCount > 0 ||
    activeResults.some(
      (result) =>
        result.status === "partial" ||
        result.status === "unavailable" ||
        result.status === "failed",
    )
  ) {
    return "partial";
  }

  return "ok";
}

export async function runAgentReachProviders(
  input: RunAgentReachProvidersInput,
): Promise<AgentReachProducerRunSummary> {
  const selectedProviders = selectAgentReachProviders(
    input.providers,
    input.selected_provider_ids,
  );
  const providerResults: AgentReachProviderResult[] = [];
  const items: AgentReachProducerRunSummary["items"] = [];
  const warnings: string[] = [];
  const rejectedItems: AgentReachProducerRunSummary["rejected_items"] = [];
  const providerCoverage: Partial<AgentReachCoverage> = {};

  for (const provider of selectedProviders) {
    let result: AgentReachProviderResult;
    try {
      result = await provider.run({
        date: input.date,
        generated_at: input.generated_at,
        query_pack: input.query_pack,
        provider_config: input.provider_configs[provider.provider_id] ?? {},
        transport: input.transport,
      });
      if (result.provider_id !== provider.provider_id) {
        throw new Error("provider result id mismatch");
      }
    } catch (error) {
      result = failedProviderResult(provider, error);
    }

    providerResults.push(result);
    items.push(...result.items);
    warnings.push(...result.warnings);
    rejectedItems.push(...result.rejected_items);
    mergeCoverage(providerCoverage, result);
  }

  const activePlatforms = selectedProviders
    .filter((provider) => provider.mode === "active")
    .flatMap((provider) => [...provider.platforms]);
  const reservedPlatforms = selectedProviders
    .filter((provider) => provider.mode === "manual_import_only")
    .flatMap((provider) => [...provider.platforms]);
  const coverage = createCompleteCoverage({
    activePlatforms,
    reservedPlatforms,
    providerCoverage,
  });

  return {
    selected_provider_ids: selectedProviders.map((provider) => provider.provider_id),
    status: computeProducerStatus({
      selectedProviders,
      providerResults,
      rejectedItemCount: rejectedItems.length,
    }),
    provider_results: providerResults,
    items,
    coverage,
    warnings,
    rejected_items: rejectedItems,
  };
}
