import fs from "node:fs";
import path from "node:path";

import { externalRawInputPath } from "../externalDiscovery/paths.ts";
import { mapAgentReachRunnerResultToArtifact } from "./artifactMapper.ts";
import type {
  AgentReachGatewayRequest,
  AgentReachLocalRunnerResult,
  AgentReachProviderArtifact,
} from "./types.ts";

export type ExternalAgentReachLocalRunner = (
  request: AgentReachGatewayRequest,
) => Promise<AgentReachLocalRunnerResult> | AgentReachLocalRunnerResult;

export interface RunExternalAgentReachLocalRunnerAdapterOptions {
  date: string;
  request: AgentReachGatewayRequest;
  runner: ExternalAgentReachLocalRunner;
  outputPath?: string;
  generatedAt?: string;
}

export interface RunExternalAgentReachLocalRunnerAdapterResult {
  artifact_path: string;
  status: AgentReachProviderArtifact["status"];
  artifact: AgentReachProviderArtifact;
}

function safeRunnerFailureReason(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "safeReasonCode" in error &&
    typeof error.safeReasonCode === "string" &&
    /^[a-z0-9_:.-]+$/.test(error.safeReasonCode)
  ) {
    return error.safeReasonCode;
  }
  return "runner_failed";
}

export async function runExternalAgentReachLocalRunnerAdapter(
  options: RunExternalAgentReachLocalRunnerAdapterOptions,
): Promise<RunExternalAgentReachLocalRunnerAdapterResult> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  let runnerResult: AgentReachLocalRunnerResult;
  try {
    runnerResult = await options.runner(options.request);
  } catch (error) {
    const reason = safeRunnerFailureReason(error);
    const failedCoverage: AgentReachLocalRunnerResult["coverage"] = {};
    for (const platform of options.request.platforms ?? []) {
      failedCoverage[platform] = {
        status: "failed",
        reason,
      };
    }
    runnerResult = {
      gateway_status: "failed",
      configured: true,
      coverage: failedCoverage,
      observations: [],
      diagnostics: {
        warnings: [reason],
      },
    };
  }
  const artifact = mapAgentReachRunnerResultToArtifact({
    request: options.request,
    result: runnerResult,
    generatedAt,
  });
  const artifactPath = options.outputPath ?? externalRawInputPath(options.date);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
  return {
    artifact_path: artifactPath,
    status: artifact.status,
    artifact,
  };
}
