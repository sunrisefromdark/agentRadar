import { validateSameRunConsumerRefs } from "../contracts/consumerFixtures.ts";
import { validateDispatchRuntimeGate, type DispatchRuntimeInput } from "../contracts/dispatchRuntime.ts";
import {
  validateFinancePolicyHandoff,
  type FinancePolicyHandoffBundle,
} from "../contracts/financePolicyHandoff.ts";
import { loadIndustrySchemaRegistry, type IndustrySchemaRegistry } from "../contracts/schemaRegistry.ts";
import { resolveSharedGovernanceProfile } from "../contracts/sharedGovernance.ts";

type RecordLike = Record<string, unknown>;

export type FinancePolicyDryRunInput = Omit<DispatchRuntimeInput, "message"> & {
  bundle: FinancePolicyHandoffBundle;
  registry?: IndustrySchemaRegistry;
};

export type FinancePolicyDryRunResult =
  | {
      ok: true;
      status: "normalization_dry_run_ready";
      normalizedEventBatchRefs: string[];
      rejectedEventBatchRefs: string[];
      coverageRefs: string[];
      contributionRefs: string[];
      governanceProfileIds: string[];
    }
  | {
      ok: false;
      reasonCode: "schema_mismatch" | "unsupported_version" | "lineage_failed" | "dispatch_context_missing" | "reservation_missing" | "budget_exceeded";
      message: string;
    };

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(hasText) : [];
}

function dailyInputPayload(bundle: FinancePolicyHandoffBundle): RecordLike | undefined {
  return bundle.payloads.find((payload) => (payload as RecordLike).payload_schema === "daily-industry-evidence-pack-input.v1") as
    | RecordLike
    | undefined;
}

function budgetProfileIds(bundle: FinancePolicyHandoffBundle): string[] {
  const ids = bundle.payloads
    .map((payload) => (payload as { budget_status?: { profile_id?: unknown } }).budget_status?.profile_id)
    .filter(hasText);
  return [...new Set(ids)];
}

export function consumeFinancePolicyHandoffForDryRun(input: FinancePolicyDryRunInput): FinancePolicyDryRunResult {
  const registry = input.registry ?? loadIndustrySchemaRegistry();
  const handoff = validateFinancePolicyHandoff(registry, input.bundle);
  if (!handoff.ok) return handoff;

  const claimCriticalMessages = input.bundle.messages.filter((message) => (message as RecordLike).capability_class === "claim-critical");
  for (const message of claimCriticalMessages) {
    const consumerGate = validateSameRunConsumerRefs(message);
    if (!consumerGate.ok) return consumerGate;

    const dispatchGate = validateDispatchRuntimeGate({ ...input, message });
    if (!dispatchGate.ok) return dispatchGate;
  }

  const dailyInput = dailyInputPayload(input.bundle);
  if (!dailyInput) {
    return { ok: false, reasonCode: "lineage_failed", message: "Missing daily industry evidence pack input." };
  }

  const governanceProfileIds = budgetProfileIds(input.bundle);
  for (const profileId of governanceProfileIds) {
    const profile = resolveSharedGovernanceProfile(registry, profileId);
    if (!profile.ok) return profile;
  }

  return {
    ok: true,
    status: "normalization_dry_run_ready",
    normalizedEventBatchRefs: stringArray(dailyInput.normalized_event_batch_refs),
    rejectedEventBatchRefs: stringArray(dailyInput.rejected_event_batch_refs),
    coverageRefs: stringArray(dailyInput.coverage_refs),
    contributionRefs: stringArray(dailyInput.contribution_refs),
    governanceProfileIds,
  };
}
