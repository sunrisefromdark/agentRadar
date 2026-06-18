import fs from "node:fs";
import path from "node:path";

import { assertValidDateOnly } from "../dateInput.ts";
import { externalRawInputPath } from "../externalDiscovery/paths.ts";
import { writeAgentReachArtifact } from "./artifactWriter.ts";
import { runAgentReachProviders } from "./orchestrator.ts";
import {
  AGENT_REACH_PROVIDER_REGISTRY,
} from "./providerRegistry.ts";
import { AGENT_REACH_QUERY_PACK } from "./queryPack.ts";
import { createDisabledAgentReachTransport } from "./transport.ts";
import {
  AGENT_REACH_PROVIDER_IDS,
  type AgentReachArtifactWriteResult,
  type AgentReachProviderConfig,
  type AgentReachProviderId,
} from "./types.ts";

interface AgentReachConfig {
  providers?: Partial<Record<AgentReachProviderId, AgentReachProviderConfig>>;
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
    providers[providerId] = {
      ...(typeof rawConfig.input_path === "string"
        ? { input_path: path.resolve(path.dirname(configPath), rawConfig.input_path) }
        : {}),
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

  const summary = await runAgentReachProviders({
    selected_provider_ids: opts.providers,
    providers: AGENT_REACH_PROVIDER_REGISTRY,
    date: opts.date,
    generated_at: generatedAt,
    query_pack: AGENT_REACH_QUERY_PACK,
    provider_configs: providerConfigs,
    transport: createDisabledAgentReachTransport(),
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
): Promise<AgentReachArtifactWriteResult> {
  assertValidDateOnly(opts.date, "--date");
  const config = loadAgentReachConfig(opts.configPath);
  return runAgentReachDiscoverWithConfig(opts, config);
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
