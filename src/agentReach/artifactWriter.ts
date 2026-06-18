import fs from "node:fs";
import path from "node:path";

import { containsForbiddenPublicArtifactText } from "../externalDiscovery/redaction.ts";
import {
  EXTERNAL_PLATFORMS,
  type ExternalPlatform,
  type ExternalProviderStatus,
} from "../externalDiscovery/types.ts";
import {
  AGENT_REACH_COVERAGE_STATUSES,
  AGENT_REACH_PROVIDER,
  AGENT_REACH_SCHEMA_VERSION,
  type AgentReachArtifactWriteResult,
  type AgentReachCoverage,
  type AgentReachProviderArtifact,
  type AgentReachProviderItem,
} from "./types.ts";

export interface WriteAgentReachArtifactInput {
  date: string;
  outputPath: string;
  dryRun?: boolean;
  providerRunId: string;
  generatedAt: string;
  query: unknown;
  platforms: ExternalPlatform[];
  status: ExternalProviderStatus;
  items: AgentReachProviderItem[];
  diagnostics: {
    warnings: string[];
  };
  coverage: AgentReachCoverage;
}

function assertCompleteCoverage(coverage: AgentReachCoverage): void {
  const keys = Object.keys(coverage);
  const missingPlatforms = EXTERNAL_PLATFORMS.filter(
    (platform) => !Object.hasOwn(coverage, platform),
  );
  const unknownPlatforms = keys.filter(
    (platform) => !EXTERNAL_PLATFORMS.includes(platform as ExternalPlatform),
  );
  const invalidStatuses = EXTERNAL_PLATFORMS.filter((platform) => {
    const status = coverage[platform]?.status;
    return !AGENT_REACH_COVERAGE_STATUSES.includes(status);
  });
  if (
    missingPlatforms.length > 0 ||
    unknownPlatforms.length > 0 ||
    invalidStatuses.length > 0
  ) {
    throw new Error(
      `AgentReach artifact requires complete coverage: missing=${missingPlatforms.join(",") || "none"}; unknown=${unknownPlatforms.join(",") || "none"}; invalid_status=${invalidStatuses.join(",") || "none"}`,
    );
  }
}

function assertPublicSafeArtifact(artifact: AgentReachProviderArtifact): void {
  assertCompleteCoverage(artifact.coverage);
  if (containsForbiddenPublicArtifactText(artifact.coverage)) {
    throw new Error("AgentReach coverage is not public-safe");
  }
  if (containsForbiddenPublicArtifactText(artifact.items)) {
    throw new Error("AgentReach items are not public-safe");
  }
  if (containsForbiddenPublicArtifactText(artifact.diagnostics.warnings)) {
    throw new Error("AgentReach diagnostics are not public-safe");
  }
  if (containsForbiddenPublicArtifactText(artifact.query)) {
    throw new Error("AgentReach query is not public-safe");
  }
}

export function writeAgentReachArtifact(
  input: WriteAgentReachArtifactInput,
): AgentReachArtifactWriteResult {
  const artifact: AgentReachProviderArtifact = {
    provider: AGENT_REACH_PROVIDER,
    schema_version: AGENT_REACH_SCHEMA_VERSION,
    provider_run_id: input.providerRunId,
    generated_at: input.generatedAt,
    query: input.query,
    platforms: input.platforms,
    status: input.status,
    items: input.items,
    diagnostics: input.diagnostics,
    coverage: input.coverage,
  };

  assertPublicSafeArtifact(artifact);

  if (!input.dryRun) {
    fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
    fs.writeFileSync(input.outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf-8");
  }

  return {
    output_path: input.outputPath,
    dry_run: input.dryRun === true,
    artifact,
  };
}
