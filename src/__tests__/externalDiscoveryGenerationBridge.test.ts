import { describe, expect, it } from "vitest";

import {
  parseArgs,
  prepareAgentReachGenerationForDaily,
  type AgentReachDailyGenerationDependencies,
} from "../cli.ts";
import { defaultAgentReachProviderIds } from "../agentReach/providerRegistry.ts";
import { externalRawInputPath } from "../externalDiscovery/paths.ts";
import type { AgentReachArtifactWriteResult } from "../agentReach/types.ts";

const BASE_ARGV = ["node", "src/cli.ts"];
const DATE_ARGS = ["--date", "2026-06-18"];
const GENERATED_AT = "2026-06-18T12:00:00.000Z";
const CONFIG_PATH = "config/agentreach.yaml";

function parse(command: string, ...args: string[]) {
  return parseArgs([...BASE_ARGV, command, ...DATE_ARGS, ...args]);
}

function writeResult(input: { dryRun: boolean }): AgentReachArtifactWriteResult {
  return {
    output_path: externalRawInputPath("2026-06-18"),
    dry_run: input.dryRun,
    coverage_summary: "ok",
    artifact: {} as AgentReachArtifactWriteResult["artifact"],
  };
}

describe("AgentReach daily generation bridge", () => {
  it("does not invoke the producer without explicit generation", async () => {
    const { opts } = parse("run-daily");
    let producerCalled = false;
    const dependencies: AgentReachDailyGenerationDependencies = {
      runAgentReachDiscover: async () => {
        producerCalled = true;
        return writeResult({ dryRun: false });
      },
    };

    const result = await prepareAgentReachGenerationForDaily({
      command: "run-daily",
      opts,
      generatedAt: GENERATED_AT,
      dryRun: false,
    }, dependencies);

    expect(producerCalled).toBe(false);
    expect(result).toEqual({ warnings: [] });
  });

  it("does not invoke the producer for recover-daily even if generation is set programmatically", async () => {
    const { opts } = parse(
      "recover-daily",
      "--external-discovery-generate",
      "--agentreach-config",
      CONFIG_PATH,
    );
    let producerCalled = false;
    const dependencies: AgentReachDailyGenerationDependencies = {
      runAgentReachDiscover: async () => {
        producerCalled = true;
        return writeResult({ dryRun: false });
      },
    };

    const result = await prepareAgentReachGenerationForDaily({
      command: "recover-daily",
      opts,
      generatedAt: GENERATED_AT,
      dryRun: false,
    }, dependencies);

    expect(producerCalled).toBe(false);
    expect(result).toEqual({ warnings: [] });
  });

  it("dry-runs the producer and returns a skipped provider override without consuming the artifact", async () => {
    const { opts } = parse(
      "run-daily",
      "--external-discovery-generate",
      "--agentreach-config",
      CONFIG_PATH,
    );
    const calls: unknown[] = [];
    const dependencies: AgentReachDailyGenerationDependencies = {
      runAgentReachDiscover: async (producerOptions) => {
        calls.push(producerOptions);
        return writeResult({ dryRun: true });
      },
    };

    const result = await prepareAgentReachGenerationForDaily({
      command: "run-daily",
      opts,
      generatedAt: GENERATED_AT,
      dryRun: true,
    }, dependencies);

    expect(calls).toEqual([
      {
        date: "2026-06-18",
        providers: defaultAgentReachProviderIds(),
        configPath: CONFIG_PATH,
        dryRun: true,
        generatedAt: GENERATED_AT,
      },
    ]);
    expect(result.providerResultOverride?.status).toBe("skipped");
    expect(result.providerResultOverride?.status_reason).toBe("agentreach_generate_dry_run");
    expect(result.providerResultOverride?.events).toEqual([]);
    expect(result.warnings).toEqual(["agentreach_generate_dry_run"]);
  });

  it("lets the consumer read the generated artifact after a non-dry-run producer success", async () => {
    const { opts } = parse(
      "run-daily",
      "--external-discovery-generate",
      "--agentreach-config",
      CONFIG_PATH,
    );
    const calls: unknown[] = [];
    const dependencies: AgentReachDailyGenerationDependencies = {
      runAgentReachDiscover: async (producerOptions) => {
        calls.push(producerOptions);
        return writeResult({ dryRun: false });
      },
    };

    const result = await prepareAgentReachGenerationForDaily({
      command: "run-daily",
      opts,
      generatedAt: GENERATED_AT,
      dryRun: false,
    }, dependencies);

    expect(calls).toEqual([
      {
        date: "2026-06-18",
        providers: defaultAgentReachProviderIds(),
        configPath: CONFIG_PATH,
        dryRun: false,
        generatedAt: GENERATED_AT,
      },
    ]);
    expect(result).toEqual({ warnings: [] });
  });

  it("converts producer failures to a safe failed provider override", async () => {
    const { opts } = parse(
      "run-daily",
      "--external-discovery-generate",
      "--agentreach-config",
      CONFIG_PATH,
    );
    const dependencies: AgentReachDailyGenerationDependencies = {
      runAgentReachDiscover: async () => {
        throw new Error("secret token abc123 stack trace");
      },
    };

    const result = await prepareAgentReachGenerationForDaily({
      command: "run-daily",
      opts,
      generatedAt: GENERATED_AT,
      dryRun: false,
    }, dependencies);

    expect(result.providerResultOverride).toMatchObject({
      provider: "agent-reach",
      schema_version: "agent-reach.external-discovery.v1",
      source_input_ref: externalRawInputPath("2026-06-18"),
      events: [],
      rejected_events: [],
      status: "failed",
      status_reason: "agentreach_generate_failed",
      warnings: ["agentreach_generate_failed"],
    });
    expect(result.warnings).toEqual(["agentreach_generate_failed"]);
    expect(JSON.stringify(result.providerResultOverride)).not.toContain("secret");
    expect(JSON.stringify(result.providerResultOverride)).not.toContain("abc123");
    expect(JSON.stringify(result.providerResultOverride)).not.toContain("stack trace");
  });
});
