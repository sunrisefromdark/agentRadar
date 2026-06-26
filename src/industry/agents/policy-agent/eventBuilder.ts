import { buildAxisArtifacts, type AxisBuildInput, type AxisSourceInput } from "./groupProtocol.ts";
import { policyRegulatorySeed } from "./regulatorySourceCatalog.ts";
import { policyThinktankSeed } from "./thinktankSourceCatalog.ts";

export interface PolicyAxisScenarioInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  routeSelection: AxisBuildInput["routeSelection"];
  executionContext: AxisBuildInput["executionContext"];
  responsibilityId: AxisBuildInput["responsibilityId"];
  axis: AxisBuildInput["axis"];
  runtimeContext?: AxisBuildInput["runtimeContext"];
  sources: AxisSourceInput[];
}

export function buildPolicyAxisArtifacts(input: PolicyAxisScenarioInput) {
  const seed = input.axis === "policy_regulatory" ? policyRegulatorySeed : policyThinktankSeed;
  return buildAxisArtifacts({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    responsibilityId: input.responsibilityId,
    axis: input.axis,
    producerAgentId: "policy-agent",
    executionContext: input.executionContext,
    routeSelection: input.routeSelection,
    registrySnapshotRef: seed.registry_snapshot_ref,
    toolRegistrySnapshotRef: seed.tool_registry_snapshot_ref,
    budgetProfileId: seed.budget_profile_id,
    runtimeContext: input.runtimeContext,
    sources: input.sources,
  });
}
