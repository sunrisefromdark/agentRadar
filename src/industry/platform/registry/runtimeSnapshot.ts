type ReviewAvailability = {
  same_run_review_mode: "staffed_human" | "service_account_only" | "async_only";
  reviewer_on_duty_count: number;
};

type GovernanceImpactScope = "headline_core" | "tier_blocking" | "public_output_only" | "owner_primary" | "long_tail";

type RuntimeSnapshotInput = {
  registrySnapshotRef: string;
  toolRegistrySnapshotRef: string;
  toolCoverageRefs: string[];
  authorityRefs: string[];
  governanceReviewRefs?: string[];
  manualReviewPoolSlots: number;
  reviewAvailability: ReviewAvailability;
};

type RuntimeSnapshotResult =
  | {
      ok: true;
      status: "runtime_snapshot_published";
      registrySnapshotRef: string;
      toolRegistrySnapshotRef: string;
      runtimeInputRefs: string[];
      sameRunReviewAvailable: boolean;
    }
  | {
      ok: false;
      reasonCode: "schema_mismatch" | "lineage_failed";
      message: string;
    };

type GovernanceReviewInput = {
  registryReviewRef: string;
  impactScope: GovernanceImpactScope;
  reviewAvailability: ReviewAvailability;
};

type GovernanceReviewResult =
  | {
      ok: true;
      plane: "governance_review";
      resolution: "same_run_critical_resolution" | "provisional_resolution" | "post_weekly_governance_resolution";
      defaultSystemAction: "block_public_output" | "lower_confidence" | "defer_to_backlog";
      sameRunBlocking: boolean;
    }
  | { ok: false; reasonCode: "lineage_failed"; message: string };

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function publishRuntimeRegistrySnapshot(input: RuntimeSnapshotInput): RuntimeSnapshotResult {
  if (!hasText(input.registrySnapshotRef) || !hasText(input.toolRegistrySnapshotRef)) {
    return { ok: false, reasonCode: "lineage_failed", message: "Runtime snapshot requires registry and tool registry refs." };
  }

  if (input.governanceReviewRefs?.length) {
    return { ok: false, reasonCode: "schema_mismatch", message: "Governance review refs must not enter runtime snapshot." };
  }

  const runtimeInputRefs = [...input.toolCoverageRefs, ...input.authorityRefs];
  if (!runtimeInputRefs.length || !runtimeInputRefs.every(hasText)) {
    return { ok: false, reasonCode: "lineage_failed", message: "Runtime snapshot requires resolvable runtime input refs." };
  }

  return {
    ok: true,
    status: "runtime_snapshot_published",
    registrySnapshotRef: input.registrySnapshotRef,
    toolRegistrySnapshotRef: input.toolRegistrySnapshotRef,
    runtimeInputRefs,
    sameRunReviewAvailable:
      input.manualReviewPoolSlots > 0 &&
      input.reviewAvailability.reviewer_on_duty_count > 0 &&
      input.reviewAvailability.same_run_review_mode !== "async_only",
  };
}

export function classifyGovernanceReview(input: GovernanceReviewInput): GovernanceReviewResult {
  if (!hasText(input.registryReviewRef)) {
    return { ok: false, reasonCode: "lineage_failed", message: "Governance review requires registry_review_ref." };
  }

  if (input.impactScope === "long_tail") {
    return {
      ok: true,
      plane: "governance_review",
      resolution: "post_weekly_governance_resolution",
      defaultSystemAction: "defer_to_backlog",
      sameRunBlocking: false,
    };
  }

  if (
    input.reviewAvailability.same_run_review_mode === "async_only" ||
    input.reviewAvailability.reviewer_on_duty_count < 1
  ) {
    return {
      ok: true,
      plane: "governance_review",
      resolution: "provisional_resolution",
      defaultSystemAction: input.impactScope === "public_output_only" ? "block_public_output" : "lower_confidence",
      sameRunBlocking: false,
    };
  }

  return {
    ok: true,
    plane: "governance_review",
    resolution: "same_run_critical_resolution",
    defaultSystemAction: input.impactScope === "public_output_only" ? "block_public_output" : "lower_confidence",
    sameRunBlocking: true,
  };
}
