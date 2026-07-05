import { describe, expect, it } from "vitest";
import {
  buildRuntimeRegistrySnapshotFromFixture,
  classifyGovernanceReview,
  getPlatformRegistrySnapshotGroup,
  loadPlatformRegistrySnapshotFixture,
  publishRuntimeRegistrySnapshot,
} from "../../../industry/platform/registry/runtimeSnapshot.ts";

describe("industry platform registry snapshot", () => {
  it("publishes runtime snapshots without leaking governance review refs into the runtime plane", () => {
    const snapshot = publishRuntimeRegistrySnapshot({
      registrySnapshotRef: "industry://internal/2026-06-26/registry-snapshot.v1/current",
      toolRegistrySnapshotRef: "industry://internal/2026-06-26/tool-registry-snapshot.v1/current",
      toolCoverageRefs: ["industry://internal/2026-06-26/axis-tool-coverage-report.v1/coverage-001"],
      authorityRefs: ["industry://internal/2026-06-26/source-authority-context.v1/source-001"],
      manualReviewPoolSlots: 8,
      reviewAvailability: { same_run_review_mode: "async_only", reviewer_on_duty_count: 0 },
    });

    expect(snapshot).toEqual({
      ok: true,
      status: "runtime_snapshot_published",
      registrySnapshotRef: "industry://internal/2026-06-26/registry-snapshot.v1/current",
      toolRegistrySnapshotRef: "industry://internal/2026-06-26/tool-registry-snapshot.v1/current",
      runtimeInputRefs: [
        "industry://internal/2026-06-26/axis-tool-coverage-report.v1/coverage-001",
        "industry://internal/2026-06-26/source-authority-context.v1/source-001",
      ],
      sameRunReviewAvailable: false,
      reviewGateAction: "conservative_consumption",
    });

    expect(
      publishRuntimeRegistrySnapshot({
        registrySnapshotRef: "industry://internal/2026-06-26/registry-snapshot.v1/current",
        toolRegistrySnapshotRef: "industry://internal/2026-06-26/tool-registry-snapshot.v1/current",
        toolCoverageRefs: ["industry://internal/2026-06-26/axis-tool-coverage-report.v1/coverage-001"],
        authorityRefs: ["industry://internal/2026-06-26/source-authority-context.v1/source-001"],
        governanceReviewRefs: ["industry://internal/2026-06-26/registry-review-result.v1/review-001"],
        manualReviewPoolSlots: 8,
        reviewAvailability: { same_run_review_mode: "staffed_human", reviewer_on_duty_count: 1 },
      }),
    ).toMatchObject({
      ok: false,
      reasonCode: "schema_mismatch",
    });
  });

  it("publishes a shared Phase 2 registry snapshot fixture with seed, tool, and authority refs", () => {
    const fixture = loadPlatformRegistrySnapshotFixture();
    const academic = getPlatformRegistrySnapshotGroup("academic");

    expect(fixture.fixture_id).toBe("platform-phase2-registry-snapshot-current.v1");
    expect(fixture.published_for).toEqual(["policy_finance", "academic", "product_ecosystem"]);
    expect(academic.registry_snapshot_ref).toBe("industry://internal/2026-06-26/registry-snapshot.v1/academic");
    expect(academic.tool_registry_snapshot_ref).toBe("industry://internal/2026-06-26/tool-registry-snapshot.v1/academic");
    expect(academic.seed_refs).toEqual([
      "data/industry-seeds/agents/academic-agent/paper.seeds.json",
      "data/industry-seeds/agents/academic-agent/conference.seeds.json",
    ]);
    expect(academic.authority_refs).toEqual([
      "industry://internal/2026-06-26/source-authority-context.v1/academic",
    ]);

    const snapshot = buildRuntimeRegistrySnapshotFromFixture({
      groupId: "academic",
      toolCoverageRefs: ["industry://internal/2026-06-26/axis-tool-coverage-report.v1/academic-coverage"],
    });

    expect(snapshot).toMatchObject({
      ok: true,
      status: "runtime_snapshot_published",
      registrySnapshotRef: academic.registry_snapshot_ref,
      toolRegistrySnapshotRef: academic.tool_registry_snapshot_ref,
      reviewGateAction: "conservative_consumption",
    });
    if (snapshot.ok) {
      expect(snapshot.runtimeInputRefs).toEqual([
        "industry://internal/2026-06-26/axis-tool-coverage-report.v1/academic-coverage",
        ...academic.seed_refs,
        ...academic.authority_refs,
      ]);
    }
  });

  it("keeps long-tail governance review out of same-run blocking", () => {
    expect(
      classifyGovernanceReview({
        registryReviewRef: "industry://internal/2026-06-26/registry-review-result.v1/review-001",
        impactScope: "long_tail",
        reviewAvailability: { same_run_review_mode: "staffed_human", reviewer_on_duty_count: 1 },
      }),
    ).toEqual({
      ok: true,
      plane: "governance_review",
      resolution: "post_weekly_governance_resolution",
      defaultSystemAction: "defer_to_backlog",
      sameRunBlocking: false,
    });

    expect(
      classifyGovernanceReview({
        registryReviewRef: "industry://internal/2026-06-26/registry-review-result.v1/review-002",
        impactScope: "public_output_only",
        reviewAvailability: { same_run_review_mode: "async_only", reviewer_on_duty_count: 0 },
      }),
    ).toEqual({
      ok: true,
      plane: "governance_review",
      resolution: "provisional_resolution",
      defaultSystemAction: "block_public_output",
      sameRunBlocking: false,
    });
  });
});
