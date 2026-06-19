import { externalImportProvider } from "./providers/externalImportProvider.ts";
import { hackerNewsProvider } from "./providers/hackerNewsProvider.ts";
import { officialWebProvider } from "./providers/officialWebProvider.ts";
import { redditProvider } from "./providers/redditProvider.ts";
import { rssBlogProvider } from "./providers/rssBlogProvider.ts";
import { xTwitterProvider } from "./providers/xTwitterProvider.ts";
import type {
  AgentReachProducerProvider,
  AgentReachProviderId,
} from "./types.ts";

export const AGENT_REACH_PROVIDER_REGISTRY: readonly AgentReachProducerProvider[] = [
  externalImportProvider,
  rssBlogProvider,
  officialWebProvider,
  hackerNewsProvider,
  xTwitterProvider,
  redditProvider,
];

export function defaultAgentReachProviderIds(): AgentReachProviderId[] {
  return AGENT_REACH_PROVIDER_REGISTRY
    .filter((provider) => provider.default_enabled)
    .map((provider) => provider.provider_id);
}

export function selectAgentReachProviders(
  registry: readonly AgentReachProducerProvider[],
  selectedProviderIds: readonly AgentReachProviderId[],
): AgentReachProducerProvider[] {
  const selected = new Set(selectedProviderIds);
  const providers = registry.filter((provider) => selected.has(provider.provider_id));
  const found = new Set(providers.map((provider) => provider.provider_id));
  const missing = [...selected].filter((providerId) => !found.has(providerId));
  if (missing.length > 0) {
    throw new Error(`provider registry entries missing: ${missing.join(",")}`);
  }
  return providers;
}
