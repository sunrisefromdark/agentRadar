import fs from "node:fs";
import path from "node:path";

import { assertValidDateOnly } from "../dateInput.ts";
import { externalRawInputPath } from "../externalDiscovery/paths.ts";
import { containsForbiddenPublicArtifactText } from "../externalDiscovery/redaction.ts";
import { writeAgentReachArtifact } from "./artifactWriter.ts";
import { runAgentReachProviders } from "./orchestrator.ts";
import {
  AGENT_REACH_PROVIDER_REGISTRY,
} from "./providerRegistry.ts";
import { AGENT_REACH_QUERY_PACK } from "./queryPack.ts";
import {
  createDisabledAgentReachTransport,
  createFetchAgentReachTransport,
  type AgentReachTransport,
} from "./transport.ts";
import {
  AGENT_REACH_PROVIDER_IDS,
  type AgentReachArtifactWriteResult,
  type AgentReachProviderConfig,
  type AgentReachProviderId,
} from "./types.ts";

interface AgentReachConfig {
  providers?: Partial<Record<AgentReachProviderId, AgentReachProviderConfig>>;
}

export interface RunAgentReachDiscoverDependencies {
  transport?: AgentReachTransport;
}

export interface AgentReachDiscoverOptions {
  date: string;
  providers: AgentReachProviderId[];
  outputPath?: string;
  dryRun: boolean;
  externalImportPath?: string;
  configPath?: string;
  generatedAt?: string;
}

function readRequiredFlagValue(flag: string, argv: string[], index: number): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function isProviderId(value: string): value is AgentReachProviderId {
  return AGENT_REACH_PROVIDER_IDS.includes(value as AgentReachProviderId);
}

function isConfigurableProviderId(
  value: AgentReachProviderId,
): boolean {
  return AGENT_REACH_PROVIDER_REGISTRY.some(
    (provider) => provider.provider_id === value && provider.mode === "active",
  );
}

function parseProviders(value: string): AgentReachProviderId[] {
  const providers = value
    .split(",")
    .map((provider) => provider.trim())
    .filter(Boolean);
  if (providers.length === 0) {
    throw new Error("--providers requires at least one provider");
  }

  return providers.map((provider) => {
    if (!isProviderId(provider)) {
      throw new Error(`unknown provider: ${provider}`);
    }
    return provider;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const LIVE_CONFIG_PROVIDER_IDS = new Set<AgentReachProviderId>([
  "rss-blog",
  "official-web",
  "hacker-news",
]);

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${label} must be string[]`);
  }
  return value;
}

const FORBIDDEN_LIVE_URL_QUERY_KEYS = new Set([
  "apikey",
  "accesstoken",
  "authorization",
  "auth",
  "cookie",
  "key",
  "oauth",
  "pass",
  "password",
  "secret",
  "session",
  "sessionid",
  "token",
]);

function assertPublicSafeLiveUrl(value: string, providerId: AgentReachProviderId): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`provider live.urls must be public-safe: ${providerId}`);
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    containsForbiddenPublicArtifactText(value)
  ) {
    throw new Error(`provider live.urls must be public-safe: ${providerId}`);
  }

  for (const key of parsed.searchParams.keys()) {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
    if (FORBIDDEN_LIVE_URL_QUERY_KEYS.has(normalizedKey)) {
      throw new Error(`provider live.urls must be public-safe: ${providerId}`);
    }
  }

  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function parseLiveConfig(
  providerId: AgentReachProviderId,
  rawLive: unknown,
): AgentReachProviderConfig["live"] | undefined {
  if (rawLive === undefined) return undefined;
  if (!LIVE_CONFIG_PROVIDER_IDS.has(providerId)) {
    throw new Error(`provider live config is not supported: ${providerId}`);
  }
  if (!isRecord(rawLive)) {
    throw new Error(`provider live config must be an object: ${providerId}`);
  }
  if (rawLive.enabled !== undefined && typeof rawLive.enabled !== "boolean") {
    throw new Error(`provider live.enabled must be a boolean: ${providerId}`);
  }
  const enabled = rawLive.enabled === true;
  const urls = rawLive.urls === undefined
    ? undefined
    : stringArray(rawLive.urls, `provider live.urls: ${providerId}`).map((url) =>
        assertPublicSafeLiveUrl(url, providerId),
      );
  if (enabled && (!urls || urls.length === 0)) {
    throw new Error(`provider live.urls must be a non-empty string[]: ${providerId}`);
  }
  return {
    ...(rawLive.enabled !== undefined ? { enabled } : {}),
    ...(urls ? { urls } : {}),
    ...(rawLive.timeout_ms !== undefined
      ? { timeout_ms: positiveInteger(rawLive.timeout_ms, `provider live.timeout_ms: ${providerId}`) }
      : {}),
    ...(rawLive.max_response_bytes !== undefined
      ? {
          max_response_bytes: positiveInteger(
            rawLive.max_response_bytes,
            `provider live.max_response_bytes: ${providerId}`,
          ),
        }
      : {}),
    ...(rawLive.query_limit !== undefined
      ? { query_limit: positiveInteger(rawLive.query_limit, `provider live.query_limit: ${providerId}`) }
      : {}),
  };
}

function loadAgentReachConfig(configPath: string | undefined): AgentReachConfig {
  if (!configPath) return {};
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8")) as unknown;
  if (!isRecord(parsed)) throw new Error("AgentReach config must be an object");
  if (parsed.providers === undefined) return {};
  if (!isRecord(parsed.providers)) {
    throw new Error("AgentReach config providers must be an object");
  }

  const providers: Partial<Record<AgentReachProviderId, AgentReachProviderConfig>> = {};
  for (const [providerId, rawConfig] of Object.entries(parsed.providers)) {
    if (!isProviderId(providerId) || !isConfigurableProviderId(providerId)) {
      throw new Error(`unknown configured provider: ${providerId}`);
    }
    if (!isRecord(rawConfig)) {
      throw new Error(`provider config must be an object: ${providerId}`);
    }
    if (rawConfig.input_path !== undefined && typeof rawConfig.input_path !== "string") {
      throw new Error(`provider input_path must be a string: ${providerId}`);
    }
    const live = parseLiveConfig(providerId, rawConfig.live);
    if (typeof rawConfig.input_path === "string" && live?.enabled === true) {
      throw new Error(`provider cannot combine input_path and live: ${providerId}`);
    }
    providers[providerId] = {
      ...(typeof rawConfig.input_path === "string"
        ? { input_path: path.resolve(path.dirname(configPath), rawConfig.input_path) }
        : {}),
      ...(live ? { live } : {}),
    };
  }
  return { providers };
}

export function parseAgentReachDiscoverArgs(argv: string[]): AgentReachDiscoverOptions {
  const opts: AgentReachDiscoverOptions = {
    date: new Date().toISOString().slice(0, 10),
    providers: AGENT_REACH_PROVIDER_REGISTRY
      .filter((provider) => provider.default_enabled)
      .map((provider) => provider.provider_id),
    dryRun: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--":
        break;
      case "--date":
        opts.date = readRequiredFlagValue("--date", argv, index);
        index += 1;
        break;
      case "--providers":
        opts.providers = parseProviders(readRequiredFlagValue("--providers", argv, index));
        index += 1;
        break;
      case "--output":
        opts.outputPath = readRequiredFlagValue("--output", argv, index);
        index += 1;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--external-import":
        opts.externalImportPath = readRequiredFlagValue("--external-import", argv, index);
        index += 1;
        break;
      case "--config":
        opts.configPath = readRequiredFlagValue("--config", argv, index);
        index += 1;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (opts.providers.length === 0) {
    throw new Error("--providers requires at least one provider");
  }
  assertValidDateOnly(opts.date, "--date");

  return opts;
}

async function runAgentReachDiscoverWithConfig(
  opts: AgentReachDiscoverOptions,
  config: AgentReachConfig,
  dependencies: RunAgentReachDiscoverDependencies = {},
): Promise<AgentReachArtifactWriteResult> {
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const providerConfigs: Partial<
    Record<AgentReachProviderId, AgentReachProviderConfig>
  > = {
    ...(config.providers ?? {}),
  };
  if (opts.externalImportPath) {
    providerConfigs["external-import"] = {
      ...(providerConfigs["external-import"] ?? {}),
      input_path: opts.externalImportPath,
    };
  }
  const hasLiveProviderConfig = opts.providers.some(
    (providerId) => providerConfigs[providerId]?.live?.enabled === true,
  );
  const transport = dependencies.transport ??
    (hasLiveProviderConfig
      ? createFetchAgentReachTransport()
      : createDisabledAgentReachTransport());

  const summary = await runAgentReachProviders({
    selected_provider_ids: opts.providers,
    providers: AGENT_REACH_PROVIDER_REGISTRY,
    date: opts.date,
    generated_at: generatedAt,
    query_pack: AGENT_REACH_QUERY_PACK,
    provider_configs: providerConfigs,
    transport,
  });
  const outputPath = opts.outputPath ?? externalRawInputPath(opts.date);
  const platforms = Array.from(new Set(summary.items.map((item) => item.platform)));

  return writeAgentReachArtifact({
    date: opts.date,
    outputPath,
    dryRun: opts.dryRun,
    providerRunId: `agentreach-${opts.date}`,
    generatedAt,
    query: {
      terms: AGENT_REACH_QUERY_PACK.flatMap((query) => query.terms),
      providers: opts.providers,
      ...(opts.configPath ? { config_loaded: true } : {}),
    },
    platforms,
    status: summary.status,
    items: summary.items,
    diagnostics: { warnings: summary.warnings },
    coverage: summary.coverage,
  });
}

export function runAgentReachDiscover(
  opts: AgentReachDiscoverOptions,
  dependencies: RunAgentReachDiscoverDependencies = {},
): Promise<AgentReachArtifactWriteResult> {
  assertValidDateOnly(opts.date, "--date");
  const config = loadAgentReachConfig(opts.configPath);
  return runAgentReachDiscoverWithConfig(opts, config, dependencies);
}

function isMainModule(): boolean {
  return process.argv[1]?.replace(/\\/g, "/").endsWith("/src/agentReach/cli.ts") === true;
}

if (isMainModule()) {
  const result = await runAgentReachDiscover(
    parseAgentReachDiscoverArgs(process.argv),
  );
  console.log(JSON.stringify(result, null, 2));
}
