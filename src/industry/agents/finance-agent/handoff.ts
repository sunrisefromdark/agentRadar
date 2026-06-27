import { createExecutionContext, type AxisSourceInput, type SameRunRuntimeContext } from "../policy-agent/groupProtocol.ts";
import { buildCapitalFinanceArtifacts } from "./eventBuilder.ts";
import { evaluateCapitalFinanceStopPolicy, type CapitalFinanceStopPolicyInput } from "./fetchStopPolicy.ts";
import { selectCapitalFinanceRoute } from "./routeSelection.ts";

export interface BuildCapitalFinanceHandoffInput {
  runId: string;
  threadId: string;
  windowStart: string;
  windowEnd: string;
  now: string;
  availableToolIds: string[];
  attemptedToolIds?: string[];
  canonicalSourceAvailable: boolean;
  budgetExceeded?: boolean;
  stopPolicy?: CapitalFinanceStopPolicyInput;
  runtimeContext?: SameRunRuntimeContext;
  sources: AxisSourceInput[];
}

export function buildCapitalFinanceHandoff(input: BuildCapitalFinanceHandoffInput) {
  const stopReasonCode = evaluateCapitalFinanceStopPolicy({
    canonicalSourceAvailable: input.canonicalSourceAvailable,
    ...input.stopPolicy,
  });
  const routeSelection = selectCapitalFinanceRoute({
    now: input.now,
    availableToolIds: input.availableToolIds,
    attemptedToolIds: input.attemptedToolIds,
    canonicalSourceAvailable: input.canonicalSourceAvailable,
    budgetExceeded: input.budgetExceeded,
    stopReasonCode,
  });

  return buildCapitalFinanceArtifacts({
    runId: input.runId,
    threadId: input.threadId,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    now: input.now,
    routeSelection,
    executionContext: createExecutionContext("capital-finance", "finance-agent", "finance-agent"),
    runtimeContext: input.runtimeContext,
    sources: input.sources,
  });
}
