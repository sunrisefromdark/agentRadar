import type { AxisBuildInput, AxisSourceInput } from "../policy-agent/groupProtocol.ts";
import { buildAxisArtifacts } from "../policy-agent/groupProtocol.ts";
import { capitalFinanceSeed } from "./sourceCatalog.ts";

export interface CapitalFinanceScenarioInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  routeSelection: AxisBuildInput["routeSelection"];
  executionContext: AxisBuildInput["executionContext"];
  sources: AxisSourceInput[];
}

export function buildCapitalFinanceArtifacts(input: CapitalFinanceScenarioInput) {
  return buildAxisArtifacts({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    responsibilityId: "capital-finance",
    axis: "capital_finance",
    producerAgentId: "finance-agent",
    executionContext: input.executionContext,
    routeSelection: input.routeSelection,
    registrySnapshotRef: capitalFinanceSeed.registry_snapshot_ref,
    toolRegistrySnapshotRef: capitalFinanceSeed.tool_registry_snapshot_ref,
    budgetProfileId: capitalFinanceSeed.budget_profile_id,
    sources: input.sources,
  });
}
