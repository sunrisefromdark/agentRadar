import { describe, expect, it } from "vitest";

import {
  parseArgs,
  prepareExternalAgentReachGenerationForDaily,
  resolveExternalDiscoveryCliMode,
  validateExternalDiscoveryCliMatrix,
  type ExternalAgentReachDailyGenerationDependencies,
} from "../cli.ts";
import { EXTERNAL_PLATFORMS } from "../externalDiscovery/types.ts";
import { externalRawInputPath } from "../externalDiscovery/paths.ts";
import type { AgentReachProviderArtifact } from "../externalAgentReach/types.ts";

const BASE_ARGV = ["node", "src/cli.ts"];
const DATE_ARGS = ["--date", "2026-06-18"];
const GENERATED_AT = "2026-06-18T12:00:00.000Z";
const RUNNER_PATH = "tools/external-agentreach-runner.mjs";

function parse(command: string, ...args: string[]) {
  return parseArgs([...BASE_ARGV, command, ...DATE_ARGS, ...args]);
}

describe("external AgentReach daily bridge CLI matrix", () => {
  it("allows run-daily to request external AgentReach generation with a runner path", () => {
    const { command, opts } = parse(
      "run-daily",
      "--external-agentreach-generate",
      "--external-agentreach-runner",
      RUNNER_PATH,
    );
    const mode = resolveExternalDiscoveryCliMode(command, opts);

    expect(() => validateExternalDiscoveryCliMatrix(command, opts)).not.toThrow();
    expect(opts.externalAgentReachGenerate).toBe(true);
    expect(opts.externalAgentReachRunnerPath).toBe(RUNNER_PATH);
    expect(mode.externalAgentReachGenerate).toBe(true);
    expect(mode.externalAgentReachRunnerPath).toBe(RUNNER_PATH);
    expect(mode.readsExternalRawInput).toBe(true);
    expect(mode.generatesDailyAggregate).toBe(true);
  });

  it("rejects external AgentReach generation without a runner path", () => {
    const { command, opts } = parse("run-daily", "--external-agentreach-generate");

    expect(() => validateExternalDiscoveryCliMatrix(command, opts)).toThrow(
      /--external-agentreach-generate requires --external-agentreach-runner/,
    );
  });

  it("rejects a runner path without explicit external AgentReach generation", () => {
    const { command, opts } = parse("run-daily", "--external-agentreach-runner", RUNNER_PATH);

    expect(() => validateExternalDiscoveryCliMatrix(command, opts)).toThrow(
      /--external-agentreach-runner requires --external-agentreach-generate/,
    );
  });

  it("rejects external AgentReach generation combined with legacy discovery generation", () => {
    const { command, opts } = parse(
      "run-daily",
      "--external-agentreach-generate",
      "--external-agentreach-runner",
      RUNNER_PATH,
      "--external-discovery-generate",
      "--agentreach-config",
      "config/agentreach.yaml",
    );

    expect(() => validateExternalDiscoveryCliMatrix(command, opts)).toThrow(
      /--external-agentreach-generate cannot be combined with --external-discovery-generate/,
    );
  });

  it("rejects external AgentReach generation combined with the legacy config flag", () => {
    const { command, opts } = parse(
      "run-daily",
      "--external-agentreach-generate",
      "--external-agentreach-runner",
      RUNNER_PATH,
      "--agentreach-config",
      "config/agentreach.yaml",
    );

    expect(() => validateExternalDiscoveryCliMatrix(command, opts)).toThrow(
      /--external-agentreach-generate cannot be combined with --agentreach-config/,
    );
  });

  it("rejects external AgentReach generation combined with manual external discovery input", () => {
    const { command, opts } = parse(
      "run-daily",
      "--external-agentreach-generate",
      "--external-agentreach-runner",
      RUNNER_PATH,
      "--external-discovery-input",
      "data/raw/external-discovery/fixtures/agent-reach.sample.sanitized.json",
    );

    expect(() => validateExternalDiscoveryCliMatrix(command, opts)).toThrow(
      /--external-agentreach-generate cannot be combined with --external-discovery-input/,
    );
  });

  it("rejects external AgentReach generation combined with disabled external discovery", () => {
    const { command, opts } = parse(
      "run-daily",
      "--no-external-discovery",
      "--external-agentreach-generate",
      "--external-agentreach-runner",
      RUNNER_PATH,
    );

    expect(() => validateExternalDiscoveryCliMatrix(command, opts)).toThrow(
      /--external-agentreach-generate cannot be combined with --no-external-discovery/,
    );
  });

  it.each(["recover-daily", "run-weekly", "verify-daily"])(
    "rejects %s external AgentReach generation flags",
    (commandName) => {
      const { command, opts } = parse(
        commandName,
        "--external-agentreach-generate",
        "--external-agentreach-runner",
        RUNNER_PATH,
      );

      expect(() => validateExternalDiscoveryCliMatrix(command, opts)).toThrow(
        new RegExp(`${commandName} does not accept --external-agentreach-generate`),
      );
    },
  );
});

describe("external AgentReach daily bridge execution", () => {
  it("dry-runs without creating a runner, writing an artifact, or reading a missing artifact", async () => {
    const { opts } = parse(
      "run-daily",
      "--external-agentreach-generate",
      "--external-agentreach-runner",
      RUNNER_PATH,
    );
    const dependencies: ExternalAgentReachDailyGenerationDependencies = {
      createExternalAgentReachRunner: () => {
        throw new Error("runner should not be created during dry-run");
      },
      runExternalAgentReachLocalRunnerAdapter: async () => {
        throw new Error("adapter should not be called during dry-run");
      },
    };

    const result = await prepareExternalAgentReachGenerationForDaily({
      command: "run-daily",
      opts,
      generatedAt: GENERATED_AT,
      dryRun: true,
    }, dependencies);

    expect(result.providerResultOverride).toMatchObject({
      provider: "agent-reach",
      schema_version: "agent-reach.external-discovery.v1",
      source_input_ref: externalRawInputPath("2026-06-18"),
      events: [],
      rejected_events: [],
      status: "skipped",
      status_reason: "external_agentreach_generate_dry_run",
      warnings: ["external_agentreach_generate_dry_run"],
    });
    expect(result.warnings).toEqual(["external_agentreach_generate_dry_run"]);
  });

  it("runs the adapter with a backend-agnostic daily gateway request", async () => {
    const { opts } = parse(
      "run-daily",
      "--external-agentreach-generate",
      "--external-agentreach-runner",
      RUNNER_PATH,
    );
    const calls: unknown[] = [];
    const artifact = {} as AgentReachProviderArtifact;
    const dependencies: ExternalAgentReachDailyGenerationDependencies = {
      createExternalAgentReachRunner: (pathToRunner) => {
        calls.push({ createRunner: pathToRunner });
        return async () => ({
          gateway_status: "ok",
          configured: true,
          observations: [],
        });
      },
      runExternalAgentReachLocalRunnerAdapter: async (adapterOptions) => {
        calls.push({
          date: adapterOptions.date,
          generatedAt: adapterOptions.generatedAt,
          request: adapterOptions.request,
          runnerType: typeof adapterOptions.runner,
        });
        return {
          artifact_path: externalRawInputPath("2026-06-18"),
          status: "ok",
          artifact,
        };
      },
    };

    const result = await prepareExternalAgentReachGenerationForDaily({
      command: "run-daily",
      opts,
      generatedAt: GENERATED_AT,
      dryRun: false,
    }, dependencies);

    expect(result).toEqual({ warnings: [] });
    expect(calls).toEqual([
      { createRunner: RUNNER_PATH },
      {
        date: "2026-06-18",
        generatedAt: GENERATED_AT,
        request: {
          intent: "collect_trend_signals",
          platforms: [...EXTERNAL_PLATFORMS],
          time_window: { date: "2026-06-18" },
          allowed_evidence_classes: [
            "project_discovery",
            "actor_message",
            "discussion_thread",
            "product_launch",
            "paper_mention",
            "benchmark_mention",
            "trend_signal",
          ],
          public_safety_mode: "public_safe_only",
        },
        runnerType: "function",
      },
    ]);
    expect(JSON.stringify(calls).toLowerCase()).not.toContain("opencli");
    expect(JSON.stringify(calls).toLowerCase()).not.toContain("mcporter");
    expect(JSON.stringify(calls).toLowerCase()).not.toContain("token");
    expect(JSON.stringify(calls).toLowerCase()).not.toContain("cookie");
  });

  it("converts adapter infrastructure failures to a safe failed provider override", async () => {
    const { opts } = parse(
      "run-daily",
      "--external-agentreach-generate",
      "--external-agentreach-runner",
      RUNNER_PATH,
    );
    const dependencies: ExternalAgentReachDailyGenerationDependencies = {
      createExternalAgentReachRunner: () => async () => ({
        gateway_status: "ok",
        configured: true,
        observations: [],
      }),
      runExternalAgentReachLocalRunnerAdapter: async () => {
        throw new Error("OAuth token expired at C:\\Users\\Aspetta\\private-path");
      },
    };

    const result = await prepareExternalAgentReachGenerationForDaily({
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
      status_reason: "external_agentreach_generate_failed",
      warnings: ["external_agentreach_generate_failed"],
    });
    expect(JSON.stringify(result.providerResultOverride)).not.toContain("OAuth token");
    expect(JSON.stringify(result.providerResultOverride)).not.toContain("private-path");
  });
});
