import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ReviewAvailability = {
  same_run_review_mode: "staffed_human" | "service_account_only" | "async_only";
  reviewer_on_duty_count: number;
};

type ReviewGateAction = "same_run_review" | "conservative_consumption";
export type PlatformRegistrySnapshotGroupId = "policy_finance" | "academic" | "product_ecosystem";
type GovernanceImpactScope = "headline_core" | "tier_blocking" | "public_output_only" | "owner_primary" | "long_tail";

type RuntimeSnapshotInput = {
  registrySnapshotRef: string;
  toolRegistrySnapshotRef: string;
  toolCoverageRefs: string[];
  seedRefs?: string[];
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
      reviewGateAction: ReviewGateAction;
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

export type PlatformRegistrySnapshotGroup = {
  group_id: PlatformRegistrySnapshotGroupId;
  registry_snapshot_ref: string;
  tool_registry_snapshot_ref: string;
  seed_refs: string[];
  authority_refs: string[];
};

export type PlatformRegistrySnapshotFixture = {
  fixture_id: string;
  schema_version: "platform-registry-snapshot-fixture.v1";
  published_for: PlatformRegistrySnapshotGroupId[];
  review_availability: {
    manual_review_pool_slots: number;
    same_run_review_mode: ReviewAvailability["same_run_review_mode"];
    reviewer_on_duty_count: number;
    default_gate_action: ReviewGateAction;
  };
  groups: PlatformRegistrySnapshotGroup[];
};

const projectRoot = path.resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const defaultFixturePath = path.join(
  projectRoot,
  "fixtures",
  "industry",
  "platform",
  "current-consumer",
  "phase2-registry-snapshot.json",
);

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function assertTextArray(values: string[], label: string): void {
  if (!values.length || !values.every(hasText)) {
    throw new Error(`Invalid Phase 2 registry snapshot fixture ${label}.`);
  }
}

function sameRunReviewAvailable(input: {
  manualReviewPoolSlots: number;
  reviewAvailability: ReviewAvailability;
}): boolean {
  return (
    input.manualReviewPoolSlots > 0 &&
    input.reviewAvailability.reviewer_on_duty_count > 0 &&
    input.reviewAvailability.same_run_review_mode !== "async_only"
  );
}

export function loadPlatformRegistrySnapshotFixture(fixturePath = defaultFixturePath): PlatformRegistrySnapshotFixture {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as PlatformRegistrySnapshotFixture;
  for (const group of fixture.groups) {
    if (!hasText(group.registry_snapshot_ref) || !hasText(group.tool_registry_snapshot_ref)) {
      throw new Error(`Invalid Phase 2 registry snapshot fixture group: ${group.group_id}.`);
    }
    assertTextArray(group.seed_refs, `${group.group_id}.seed_refs`);
    assertTextArray(group.authority_refs, `${group.group_id}.authority_refs`);
  }
  return fixture;
}

export function getPlatformRegistrySnapshotGroup(
  groupId: PlatformRegistrySnapshotGroupId,
  fixture = loadPlatformRegistrySnapshotFixture(),
): PlatformRegistrySnapshotGroup {
  const group = fixture.groups.find((item) => item.group_id === groupId);
  if (!group) {
    throw new Error(`Missing Phase 2 registry snapshot group: ${groupId}.`);
  }
  return group;
}

export function publishRuntimeRegistrySnapshot(input: RuntimeSnapshotInput): RuntimeSnapshotResult {
  if (!hasText(input.registrySnapshotRef) || !hasText(input.toolRegistrySnapshotRef)) {
    return { ok: false, reasonCode: "lineage_failed", message: "Runtime snapshot requires registry and tool registry refs." };
  }

  if (input.governanceReviewRefs?.length) {
    return { ok: false, reasonCode: "schema_mismatch", message: "Governance review refs must not enter runtime snapshot." };
  }

  const runtimeInputRefs = [...input.toolCoverageRefs, ...(input.seedRefs ?? []), ...input.authorityRefs];
  if (!runtimeInputRefs.length || !runtimeInputRefs.every(hasText)) {
    return { ok: false, reasonCode: "lineage_failed", message: "Runtime snapshot requires resolvable runtime input refs." };
  }

  const reviewAvailable = sameRunReviewAvailable(input);

  return {
    ok: true,
    status: "runtime_snapshot_published",
    registrySnapshotRef: input.registrySnapshotRef,
    toolRegistrySnapshotRef: input.toolRegistrySnapshotRef,
    runtimeInputRefs,
    sameRunReviewAvailable: reviewAvailable,
    reviewGateAction: reviewAvailable ? "same_run_review" : "conservative_consumption",
  };
}

export function buildRuntimeRegistrySnapshotFromFixture(input: {
  groupId: PlatformRegistrySnapshotGroupId;
  toolCoverageRefs: string[];
  fixture?: PlatformRegistrySnapshotFixture;
}): RuntimeSnapshotResult {
  const fixture = input.fixture ?? loadPlatformRegistrySnapshotFixture();
  const group = getPlatformRegistrySnapshotGroup(input.groupId, fixture);
  return publishRuntimeRegistrySnapshot({
    registrySnapshotRef: group.registry_snapshot_ref,
    toolRegistrySnapshotRef: group.tool_registry_snapshot_ref,
    toolCoverageRefs: input.toolCoverageRefs,
    seedRefs: group.seed_refs,
    authorityRefs: group.authority_refs,
    manualReviewPoolSlots: fixture.review_availability.manual_review_pool_slots,
    reviewAvailability: {
      same_run_review_mode: fixture.review_availability.same_run_review_mode,
      reviewer_on_duty_count: fixture.review_availability.reviewer_on_duty_count,
    },
  });
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
