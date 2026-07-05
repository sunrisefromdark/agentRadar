import { buildDailyExternalAggregate } from "./aggregate.ts";
import { readAgentReachProviderArtifact } from "./agentReachProvider.ts";
import {
  externalAggregateLatestPath,
  externalAggregatePath,
  externalCandidateExplanationsLatestPath,
  externalCandidateExplanationsPath,
  externalRawInputPath,
} from "./paths.ts";
import { assertPublicSafeAggregate, stableSourceInputHash } from "./redaction.ts";
import { runDailyExternalTrendWindowIntegration, type DailyExternalTrendWindowIntegrationResult } from "./trendWindowIntegration.ts";
import {
  buildCandidateExplanationInputs,
  generateExternalCandidateExplanations,
  type CandidateExplanationBuildResult,
  type ExternalCandidateExplanationArtifact,
} from "./explanations.ts";
import { assertPublicSafeCandidateExplanations } from "./explanationRedaction.ts";
import { writeJsonFile } from "../storage/files.ts";
import type { AppConfig } from "../config.ts";
import type { ProjectLibraryEnhancementArtifact, ScoredProject } from "../types.ts";
import type { DailyExternalAggregate } from "./types.ts";

export interface DailyExternalDiscoveryIntegrationResult {
  aggregate: DailyExternalAggregate;
  explanations: ExternalCandidateExplanationArtifact;
  input_build: CandidateExplanationBuildResult;
  trend_window: DailyExternalTrendWindowIntegrationResult["trend_window"];
  paths: {
    aggregate: string;
    aggregate_latest: string;
    explanations: string;
    explanations_latest: string;
    trend_window: string;
    trend_window_latest: string;
  };
}

function emptyCandidateExplanationBuildResult(reasonCode: string, reasonDetail: string, hashSeed: string): CandidateExplanationBuildResult {
  return {
    inputs: [],
    input_context_hash: stableSourceInputHash(hashSeed),
    warnings: [{ reason_code: reasonCode, reason_detail: reasonDetail }],
    eligible_count: 0,
  };
}

function failedCandidateExplanations(args: {
  aggregate: DailyExternalAggregate;
  inputBuild: CandidateExplanationBuildResult;
  generatedAt: string;
  provider: string;
  reasonCode: string;
  reasonDetail: string;
}): ExternalCandidateExplanationArtifact {
  return {
    schema_version: "external-discovery.candidate-explanations.v1",
    date: args.aggregate.date,
    generated_at: args.generatedAt,
    provider: args.provider,
    explanation_policy_version: "candidate-explanations.v1",
    aggregate_source_input_hash: args.aggregate.source_input_hash,
    aggregate_generated_at: args.aggregate.generated_at,
    input_context_hash: args.inputBuild.input_context_hash,
    public_safe: true,
    redaction_policy_version: "external-discovery-explanation-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    status: "failed",
    status_reason: args.reasonCode,
    explanations: [],
    audit: {
      eligible_count: args.inputBuild.eligible_count,
      attempted_count: 0,
      accepted_count: 0,
      enhanced_count: 0,
      rejected_count: args.inputBuild.inputs.length,
      fallback_count: 0,
      warnings: [
        ...args.inputBuild.warnings,
        {
          reason_code: args.reasonCode,
          reason_detail: args.reasonDetail,
        },
      ],
    },
  };
}

function safeErrorDetail(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

export async function runDailyExternalDiscoveryIntegration(args: {
  date: string;
  generatedAt: string;
  config: AppConfig;
  dryRun?: boolean;
  inputPath?: string;
  explicitInput?: boolean;
  scoredProjects?: ScoredProject[];
  projectLibraryArtifact?: ProjectLibraryEnhancementArtifact | null;
}): Promise<DailyExternalDiscoveryIntegrationResult> {
  const inputPath = args.inputPath ?? externalRawInputPath(args.date);
  const providerResult = readAgentReachProviderArtifact(inputPath, {
    explicitInput: args.explicitInput ?? Boolean(args.inputPath),
  });
  const aggregate = buildDailyExternalAggregate({
    date: args.date,
    generated_at: args.generatedAt,
    provider_result: providerResult,
    source_input_hash: providerResult.source_input_hash || stableSourceInputHash(`${providerResult.status}:${providerResult.status_reason ?? ""}:${inputPath}`),
  });

  const aggregateSafety = assertPublicSafeAggregate(aggregate);
  if (!aggregateSafety.ok) {
    throw new Error(`external aggregate is not public-safe: ${aggregateSafety.reason_codes.join(",")}`);
  }

  const aggregatePath = externalAggregatePath(args.date);
  const aggregateLatest = externalAggregateLatestPath();
  writeJsonFile(aggregatePath, aggregate, args.dryRun);
  writeJsonFile(aggregateLatest, aggregate, args.dryRun);

  let inputBuild = emptyCandidateExplanationBuildResult(
    "candidate_explanation_not_started",
    "candidate explanation build has not started",
    `${aggregate.source_input_hash}:candidate-explanation-not-started`,
  );
  let explanations: ExternalCandidateExplanationArtifact;
  try {
    inputBuild = buildCandidateExplanationInputs({
      aggregate,
      titleContext: providerResult.title_context,
      scoredProjects: args.scoredProjects ?? [],
      projectLibraryArtifact: args.projectLibraryArtifact ?? null,
    });
    const generated = await generateExternalCandidateExplanations({
      aggregate,
      inputBuild,
      config: args.config,
      generatedAt: args.generatedAt,
    });
    const explanationSafety = assertPublicSafeCandidateExplanations(generated);
    explanations = explanationSafety.ok
      ? generated
      : failedCandidateExplanations({
          aggregate,
          inputBuild,
          generatedAt: args.generatedAt,
          provider: generated.provider,
          reasonCode: "candidate_explanation_public_safe_failed",
          reasonDetail: explanationSafety.reason_codes.join(","),
        });
  } catch (error) {
    explanations = failedCandidateExplanations({
      aggregate,
      inputBuild,
      generatedAt: args.generatedAt,
      provider: args.config.llm?.provider ?? "unknown",
      reasonCode: "candidate_explanation_generation_failed",
      reasonDetail: safeErrorDetail(error),
    });
  }

  const explanationsPath = externalCandidateExplanationsPath(args.date);
  const explanationsLatest = externalCandidateExplanationsLatestPath();
  writeJsonFile(explanationsPath, explanations, args.dryRun);
  writeJsonFile(explanationsLatest, explanations, args.dryRun);
  const trendWindow = runDailyExternalTrendWindowIntegration({
    date: args.date,
    generatedAt: args.generatedAt,
    dryRun: args.dryRun,
    currentAggregate: aggregate,
  });

  return {
    aggregate,
    explanations,
    input_build: inputBuild,
    trend_window: trendWindow.trend_window,
    paths: {
      aggregate: aggregatePath,
      aggregate_latest: aggregateLatest,
      explanations: explanationsPath,
      explanations_latest: explanationsLatest,
      trend_window: trendWindow.paths.trend_window,
      trend_window_latest: trendWindow.paths.trend_window_latest,
    },
  };
}
