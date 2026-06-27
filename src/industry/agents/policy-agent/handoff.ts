import { buildCapitalFinanceHandoff, type BuildCapitalFinanceHandoffInput } from "../finance-agent/handoff.ts";
import type { FinancePolicyHandoffBundle } from "../../platform/contracts/financePolicyHandoff.ts";
import {
  assertConsumableEnvelope,
  buildDailyInputArtifact,
  createExecutionContext,
  type ArtifactEnvelope,
  type AxisSourceInput,
  type AxisArtifacts,
  type DailyIndustryEvidencePackInput,
  type EventBatchPayload,
  type CoveragePayload,
  type ContributionPayload,
  type SameRunRuntimeContext,
} from "./groupProtocol.ts";
import { buildPolicyAxisArtifacts } from "./eventBuilder.ts";
import { selectPolicyRegulatoryRoute } from "./regulatoryRouteSelection.ts";
import { selectPolicyThinktankRoute } from "./thinktankRouteSelection.ts";

export interface BuildPolicyAxisHandoffInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  availableToolIds: string[];
  attemptedToolIds?: string[];
  canonicalSourceAvailable: boolean;
  budgetExceeded?: boolean;
  stopReasonCode?: string;
  runtimeContext?: SameRunRuntimeContext;
  sources: AxisSourceInput[];
}

export interface PolicyFinanceGroupInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  finance: BuildCapitalFinanceHandoffInput;
  regulatory: BuildPolicyAxisHandoffInput;
  thinktank: BuildPolicyAxisHandoffInput;
}

export function buildPolicyRegulatoryHandoff(input: BuildPolicyAxisHandoffInput) {
  return buildPolicyAxisArtifacts({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    responsibilityId: "policy-regulatory",
    axis: "policy_regulatory",
    routeSelection: selectPolicyRegulatoryRoute({
      now: input.now,
      availableToolIds: input.availableToolIds,
      attemptedToolIds: input.attemptedToolIds,
      canonicalSourceAvailable: input.canonicalSourceAvailable,
      budgetExceeded: input.budgetExceeded,
      stopReasonCode: input.stopReasonCode,
    }),
    executionContext: createExecutionContext("policy-regulatory", "policy-agent", "policy-agent"),
    runtimeContext: input.runtimeContext,
    sources: input.sources,
  });
}

export function buildPolicyThinktankHandoff(input: BuildPolicyAxisHandoffInput) {
  return buildPolicyAxisArtifacts({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    responsibilityId: "policy-research-thinktank",
    axis: "policy_research_thinktank",
    routeSelection: selectPolicyThinktankRoute({
      now: input.now,
      availableToolIds: input.availableToolIds,
      attemptedToolIds: input.attemptedToolIds,
      canonicalSourceAvailable: input.canonicalSourceAvailable,
      budgetExceeded: input.budgetExceeded,
      stopReasonCode: input.stopReasonCode,
    }),
    executionContext: createExecutionContext("policy-research-thinktank", "policy-agent", "policy-agent"),
    runtimeContext: input.runtimeContext,
    sources: input.sources,
  });
}

export function buildPolicyFinanceGroupHandoff(input: PolicyFinanceGroupInput) {
  const finance = buildCapitalFinanceHandoff(input.finance);
  const regulatory = buildPolicyRegulatoryHandoff(input.regulatory);
  const thinktank = buildPolicyThinktankHandoff(input.thinktank);

  const sourceMessageIds = [finance, regulatory, thinktank].flatMap((artifact) => [
    artifact.accepted.envelope.message_id,
    artifact.rejected.envelope.message_id,
    artifact.coverage.envelope.message_id,
    artifact.contribution.envelope.message_id,
  ]);
  const dailyInput = buildDailyInputArtifact({
    runId: input.runId,
    threadId: input.threadId,
    now: input.now,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    sourceMessageIds,
    normalizedEventBatchRefs: [finance.accepted.manifest.artifact_ref, regulatory.accepted.manifest.artifact_ref, thinktank.accepted.manifest.artifact_ref],
    rejectedEventBatchRefs: [finance.rejected.manifest.artifact_ref, regulatory.rejected.manifest.artifact_ref, thinktank.rejected.manifest.artifact_ref],
    coverageRefs: [finance.coverage.manifest.artifact_ref, regulatory.coverage.manifest.artifact_ref, thinktank.coverage.manifest.artifact_ref],
    contributionRefs: [finance.contribution.manifest.artifact_ref, regulatory.contribution.manifest.artifact_ref, thinktank.contribution.manifest.artifact_ref],
    runtimeContext: input.finance.runtimeContext ?? input.regulatory.runtimeContext ?? input.thinktank.runtimeContext,
  });

  return {
    finance,
    regulatory,
    thinktank,
    dailyInput,
  };
}

export function buildPolicyFinanceHandoffBundle(result: {
  finance: AxisArtifacts;
  regulatory: AxisArtifacts;
  thinktank: AxisArtifacts;
  dailyInput: ArtifactEnvelope<DailyIndustryEvidencePackInput>;
}): FinancePolicyHandoffBundle {
  const axisArtifacts = [result.finance, result.regulatory, result.thinktank];
  const envelopes = axisArtifacts.flatMap((artifact) => [
    artifact.accepted.envelope,
    artifact.counter.envelope,
    artifact.diagnostic.envelope,
    artifact.rejected.envelope,
    artifact.coverage.envelope,
    artifact.contribution.envelope,
  ]);
  const manifests = axisArtifacts.flatMap((artifact) => [
    artifact.accepted.manifest,
    artifact.counter.manifest,
    artifact.diagnostic.manifest,
    artifact.rejected.manifest,
    artifact.coverage.manifest,
    artifact.contribution.manifest,
  ]);
  const payloads: Array<EventBatchPayload | CoveragePayload | ContributionPayload | DailyIndustryEvidencePackInput> = axisArtifacts.flatMap((artifact) => [
    artifact.accepted.payload,
    artifact.counter.payload,
    artifact.diagnostic.payload,
    artifact.rejected.payload,
    artifact.coverage.payload,
    artifact.contribution.payload,
  ]);

  envelopes.push(result.dailyInput.envelope);
  manifests.push(result.dailyInput.manifest);
  payloads.push(result.dailyInput.payload);

  return {
    messages: envelopes as unknown as Array<Record<string, unknown>>,
    manifests: manifests as unknown as Array<Record<string, unknown>>,
    payloads: payloads as unknown as Array<Record<string, unknown>>,
    artifactRefs: manifests.map((manifest) => manifest.artifact_ref),
  };
}

export function assertCurrentAndCompatibleFixtures(current: ArtifactEnvelope<unknown>, previousCompatible: ArtifactEnvelope<unknown>) {
  return {
    current: assertConsumableEnvelope(current.envelope, current.manifest.schema_version),
    previous: assertConsumableEnvelope(previousCompatible.envelope, previousCompatible.manifest.schema_version),
  };
}

export { assertConsumableEnvelope } from "./groupProtocol.ts";
