import { buildCapitalFinanceHandoff, type BuildCapitalFinanceHandoffInput } from "../finance-agent/handoff.ts";
import {
  assertConsumableEnvelope,
  buildDailyInputArtifact,
  createExecutionContext,
  type ArtifactEnvelope,
  type AxisSourceInput,
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
  });

  return {
    finance,
    regulatory,
    thinktank,
    dailyInput,
  };
}

export function assertCurrentAndCompatibleFixtures(current: ArtifactEnvelope<unknown>, previousCompatible: ArtifactEnvelope<unknown>) {
  return {
    current: assertConsumableEnvelope(current.envelope, current.manifest.schema_version),
    previous: assertConsumableEnvelope(previousCompatible.envelope, previousCompatible.manifest.schema_version),
  };
}

export { assertConsumableEnvelope } from "./groupProtocol.ts";
