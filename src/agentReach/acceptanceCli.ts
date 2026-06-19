import { assertValidDateOnly } from "../dateInput.ts";
import {
  evaluateAgentReachArtifact,
  failedAgentReachAcceptanceReport,
  type AgentReachAcceptanceOutcome,
  type AgentReachAcceptanceReport,
} from "./acceptance.ts";
import {
  runAgentReachDiscover,
  type AgentReachDiscoverOptions,
} from "./cli.ts";
import type { AgentReachArtifactWriteResult } from "./types.ts";

export interface AgentReachAcceptanceSmokeOptions {
  date: string;
  configPath: string;
}

export interface AgentReachAcceptanceSmokeDependencies {
  runAgentReachDiscover?: (
    options: AgentReachDiscoverOptions,
  ) => Promise<AgentReachArtifactWriteResult>;
}

export function agentReachAcceptanceExitCode(
  outcome: AgentReachAcceptanceOutcome,
): 0 | 1 {
  return outcome === "fail" ? 1 : 0;
}

function requiredValue(flag: string, argv: string[], index: number): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseAgentReachAcceptanceSmokeArgs(
  argv: string[],
): AgentReachAcceptanceSmokeOptions {
  let date = new Date().toISOString().slice(0, 10);
  let configPath: string | undefined;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--date") {
      date = requiredValue("--date", argv, index);
      index += 1;
      continue;
    }
    if (arg === "--config") {
      configPath = requiredValue("--config", argv, index);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  assertValidDateOnly(date, "--date");
  if (!configPath) throw new Error("--config is required");
  return { date, configPath };
}

export async function runAgentReachAcceptanceSmoke(
  options: AgentReachAcceptanceSmokeOptions,
  dependencies: AgentReachAcceptanceSmokeDependencies = {},
): Promise<AgentReachAcceptanceReport> {
  const producer =
    dependencies.runAgentReachDiscover ?? runAgentReachDiscover;
  try {
    const result = await producer({
      date: options.date,
      configPath: options.configPath,
      providers: ["hacker-news"],
      dryRun: true,
    });
    return evaluateAgentReachArtifact(result.artifact);
  } catch {
    return failedAgentReachAcceptanceReport();
  }
}

function isMainModule(): boolean {
  return process.argv[1]
    ?.replace(/\\/g, "/")
    .endsWith("/src/agentReach/acceptanceCli.ts") === true;
}

if (isMainModule()) {
  const report = await runAgentReachAcceptanceSmoke(
    parseAgentReachAcceptanceSmokeArgs(process.argv),
  );
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = agentReachAcceptanceExitCode(report.outcome);
}
