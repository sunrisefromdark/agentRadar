import { validateSameRunConsumerRefs } from "../contracts/consumerFixtures.ts";
import { validateDispatchRuntimeGate, type DispatchRuntimeInput } from "../contracts/dispatchRuntime.ts";
import {
  validateFinancePolicyHandoff,
  type FinancePolicyHandoffBundle,
} from "../contracts/financePolicyHandoff.ts";
import { loadIndustrySchemaRegistry, type IndustrySchemaRegistry } from "../contracts/schemaRegistry.ts";
import { resolveSharedGovernanceProfile } from "../contracts/sharedGovernance.ts";
import { getPlatformRegistrySnapshotGroup, publishRuntimeRegistrySnapshot } from "../registry/runtimeSnapshot.ts";

type RecordLike = Record<string, unknown>;
type RuntimeProfiles = {
  activationProfileIds: string[];
  stopProfileIds: string[];
  reviewProfileIds: string[];
};
type RuntimeRegistrySnapshot = Extract<ReturnType<typeof publishRuntimeRegistrySnapshot>, { ok: true }>;
type RuntimeSnapshotResult = ReturnType<typeof publishRuntimeRegistrySnapshot>;
type FinancePolicyConsumedHandoff =
  | {
      ok: true;
      status: "policy_finance_handoff_consumed";
      normalizedEventBatchRefs: string[];
      rejectedEventBatchRefs: string[];
      coverageRefs: string[];
      contributionRefs: string[];
      governanceProfileIds: string[];
      runtimeProfiles: RuntimeProfiles;
      runtimeConsumedSameRunMessages: number;
    }
  | Exclude<FinancePolicyDryRunResult, { ok: true }>;

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

export type FinancePolicyRuntimeResult =
  | {
      ok: true;
      status: "policy_finance_runtime_ready";
      normalizedEventBatchRefs: string[];
      rejectedEventBatchRefs: string[];
      coverageRefs: string[];
      contributionRefs: string[];
      activationProfileIds: string[];
      stopProfileIds: string[];
      reviewProfileIds: string[];
      runtimeConsumedSameRunMessages: number;
      runtimeRegistrySnapshots: RuntimeRegistrySnapshot[];
    }
  | Exclude<FinancePolicyDryRunResult, { ok: true }>;

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

function responsibilityKeys(bundle: FinancePolicyHandoffBundle): string[] {
  const ids = bundle.payloads.map((payload) => (payload as RecordLike).responsibility_id).filter(hasText);
  return [...new Set(ids.map((id) => id.replaceAll("-", "_")))];
}

function policyFinanceRuntimeProfileIds(bundle: FinancePolicyHandoffBundle): RuntimeProfiles {
  const responsibilities = responsibilityKeys(bundle);
  return {
    activationProfileIds: [
      ...responsibilities.map((id) => `axis-activation-policy.v1/${id}`),
      ...budgetProfileIds(bundle),
    ],
    stopProfileIds: responsibilities.map((id) => `canonical-fetch-stop-policy.v1/${id}`),
    reviewProfileIds: ["same-run-review-availability-policy.v1/policy_finance"],
  };
}

function policyFinanceRuntimeSnapshots(bundle: FinancePolicyHandoffBundle, coverageRefs: string[]): RuntimeSnapshotResult[] {
  const phase2Snapshot = getPlatformRegistrySnapshotGroup("policy_finance");
  return coverageRefs.map((coverageRef) => {
    const message = bundle.messages.find((item) => (item as RecordLike).payload_ref === coverageRef) as RecordLike | undefined;
    const coverage = message
      ? (bundle.payloads.find((item) => (item as RecordLike).source_message_id === message.message_id) as RecordLike | undefined)
      : undefined;
    if (!coverage) return { ok: false, reasonCode: "lineage_failed", message: `Unresolved coverage ref: ${coverageRef}` };

    return publishRuntimeRegistrySnapshot({
      registrySnapshotRef: String(coverage.registry_snapshot_ref ?? ""),
      toolRegistrySnapshotRef: String(coverage.tool_registry_snapshot_ref ?? ""),
      toolCoverageRefs: [coverageRef],
      seedRefs: phase2Snapshot.seed_refs,
      authorityRefs: phase2Snapshot.authority_refs,
      manualReviewPoolSlots: 0,
      reviewAvailability: { same_run_review_mode: "async_only", reviewer_on_duty_count: 0 },
    });
  });
}

function consumeFinancePolicyHandoff(input: FinancePolicyDryRunInput): FinancePolicyConsumedHandoff {
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

  const runtimeProfiles = policyFinanceRuntimeProfileIds(input.bundle);
  const governanceProfileIds = [
    ...runtimeProfiles.activationProfileIds,
    ...runtimeProfiles.stopProfileIds,
    ...runtimeProfiles.reviewProfileIds,
  ];
  for (const profileId of governanceProfileIds) {
    const profile = resolveSharedGovernanceProfile(registry, profileId);
    if (!profile.ok) return profile;
  }

  return {
    ok: true,
    status: "policy_finance_handoff_consumed",
    normalizedEventBatchRefs: stringArray(dailyInput.normalized_event_batch_refs),
    rejectedEventBatchRefs: stringArray(dailyInput.rejected_event_batch_refs),
    coverageRefs: stringArray(dailyInput.coverage_refs),
    contributionRefs: stringArray(dailyInput.contribution_refs),
    governanceProfileIds: budgetProfileIds(input.bundle),
    runtimeProfiles,
    runtimeConsumedSameRunMessages: claimCriticalMessages.length,
  };
}

export function consumeFinancePolicyHandoffForDryRun(input: FinancePolicyDryRunInput): FinancePolicyDryRunResult {
  const result = consumeFinancePolicyHandoff(input);
  if (!result.ok) return result;

  return {
    ok: true,
    status: "normalization_dry_run_ready",
    normalizedEventBatchRefs: result.normalizedEventBatchRefs,
    rejectedEventBatchRefs: result.rejectedEventBatchRefs,
    coverageRefs: result.coverageRefs,
    contributionRefs: result.contributionRefs,
    governanceProfileIds: result.governanceProfileIds,
  };
}

export function consumeFinancePolicyHandoffForRuntime(input: FinancePolicyDryRunInput): FinancePolicyRuntimeResult {
  const result = consumeFinancePolicyHandoff(input);
  if (!result.ok) return result;

  const runtimeRegistrySnapshots = policyFinanceRuntimeSnapshots(input.bundle, result.coverageRefs);
  const failedRuntimeSnapshot = runtimeRegistrySnapshots.find((snapshot) => !snapshot.ok);
  if (failedRuntimeSnapshot && !failedRuntimeSnapshot.ok) return failedRuntimeSnapshot;

  return {
    ok: true,
    status: "policy_finance_runtime_ready",
    normalizedEventBatchRefs: result.normalizedEventBatchRefs,
    rejectedEventBatchRefs: result.rejectedEventBatchRefs,
    coverageRefs: result.coverageRefs,
    contributionRefs: result.contributionRefs,
    activationProfileIds: result.runtimeProfiles.activationProfileIds,
    stopProfileIds: result.runtimeProfiles.stopProfileIds,
    reviewProfileIds: result.runtimeProfiles.reviewProfileIds,
    runtimeConsumedSameRunMessages: result.runtimeConsumedSameRunMessages,
    runtimeRegistrySnapshots: runtimeRegistrySnapshots.filter((snapshot): snapshot is RuntimeRegistrySnapshot => snapshot.ok),
  };
}
