import { describe, expect, it } from "vitest";
import currentBundleFixture from "../../../../fixtures/industry/agents/policy-agent/replay/phase1-current-bundle.json" with { type: "json" };
import negativeBundleFixture from "../../../../fixtures/industry/agents/policy-agent/replay/phase1-missing-stable-claim-key-bundle.json" with { type: "json" };
import sameRunCurrentFixture from "../../../../fixtures/industry/agents/policy-agent/compatibility/same-run-current-consumer.json" with { type: "json" };
import sameRunNegativeFixture from "../../../../fixtures/industry/agents/policy-agent/compatibility/same-run-missing-stable-claim-key-negative.json" with { type: "json" };
import { buildProductEcosystemFormalHandoff } from "../../../industry/agents/community-news-agent/formalHandoff.ts";
import { consumeFinancePolicyHandoffForDryRun } from "../../../industry/platform/normalization/financePolicyDryRun.ts";
import { consumeProductEcosystemHandoffForDryRun } from "../../../industry/platform/normalization/productEcosystemDryRun.ts";
import type { FinancePolicyHandoffBundle } from "../../../industry/platform/contracts/financePolicyHandoff.ts";

describe("industry platform normalization dry-run", () => {
  it("materializes the policy-finance current bundle without a producer wrapper", () => {
    const result = consumeFinancePolicyHandoffForDryRun({
      bundle: currentBundleFixture as FinancePolicyHandoffBundle,
      dispatchContext: sameRunCurrentFixture.dispatch_context,
      reservations: sameRunCurrentFixture.reservations,
      budgetArbitration: sameRunCurrentFixture.budget_arbitration,
      requiresCapacityReservation: true,
    });

    expect(result).toEqual({
      ok: true,
      status: "normalization_dry_run_ready",
      normalizedEventBatchRefs: [
        "industry://internal/2026-06-26/industry-signal-event-batch.v1/artifact-db38e9289fd9",
        "industry://internal/2026-06-26/industry-signal-event-batch.v1/artifact-f060994f979f",
        "industry://internal/2026-06-26/industry-signal-event-batch.v1/artifact-08e24477f2f6",
      ],
      rejectedEventBatchRefs: [
        "industry://internal/2026-06-26/industry-signal-event-batch.v1/artifact-a1d50f3eef0c",
        "industry://internal/2026-06-26/industry-signal-event-batch.v1/artifact-84c26a2cdf7b",
        "industry://internal/2026-06-26/industry-signal-event-batch.v1/artifact-f9f411bbf48c",
      ],
      coverageRefs: [
        "industry://internal/2026-06-26/axis-tool-coverage-report.v1/artifact-a5d9b9371f3d",
        "industry://internal/2026-06-26/axis-tool-coverage-report.v1/artifact-e6203625b947",
        "industry://internal/2026-06-26/axis-tool-coverage-report.v1/artifact-fcfa36416828",
      ],
      contributionRefs: [
        "industry://internal/2026-06-26/industry-agent-contribution.v1/artifact-26f2355c0b55",
        "industry://internal/2026-06-26/industry-agent-contribution.v1/artifact-22d14bc3c145",
        "industry://internal/2026-06-26/industry-agent-contribution.v1/artifact-c4823b591078",
      ],
      governanceProfileIds: [
        "axis-runtime-budget-profile.v1/capital_finance",
        "axis-runtime-budget-profile.v1/policy_regulatory",
        "axis-runtime-budget-profile.v1/policy_research_thinktank",
      ],
    });
  });

  it("rejects the policy-finance negative bundle before normalization dry-run", () => {
    const result = consumeFinancePolicyHandoffForDryRun({
      bundle: negativeBundleFixture as FinancePolicyHandoffBundle,
      dispatchContext: sameRunNegativeFixture.dispatch_context,
      reservations: sameRunNegativeFixture.reservations,
      budgetArbitration: sameRunNegativeFixture.budget_arbitration,
      requiresCapacityReservation: true,
    });

    expect(result).toMatchObject({
      ok: false,
      reasonCode: "dispatch_context_missing",
    });
  });

  it("materializes the product ecosystem formal bundle for dry-run feedback", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildProductEcosystemInput());
    const result = consumeProductEcosystemHandoffForDryRun({
      bundle,
      registrySnapshotRef: "industry://internal/2026-06-26/registry-snapshot.v1/product-ecosystem",
      toolRegistrySnapshotRef: "industry://internal/2026-06-26/tool-registry-snapshot.v1/product-ecosystem",
      authorityRefs: ["industry://internal/2026-06-26/source-authority-context.v1/product-ecosystem"],
      manualReviewPoolSlots: 2,
      reviewAvailability: { same_run_review_mode: "async_only", reviewer_on_duty_count: 0 },
    });

    expect(result).toMatchObject({
      ok: true,
      status: "normalization_dry_run_ready",
      normalizedEventBatchRefs: expect.any(Array),
      rejectedEventBatchRefs: expect.any(Array),
      coverageRefs: expect.any(Array),
      contributionRefs: expect.any(Array),
      feedbackPayloadSchema: "normalization-feedback.v1",
      feedbackPayload: {
        payload_schema: "normalization-feedback.v1",
        schema_version: "1.0.0",
        run_id: "run-product-ecosystem-platform-normalization",
        producer_agent_id: "normalization-agent",
        feedback_status: "dry_run_ready",
      },
      runtimeSnapshot: {
        ok: true,
        status: "runtime_snapshot_published",
        registrySnapshotRef: "industry://internal/2026-06-26/registry-snapshot.v1/product-ecosystem",
        toolRegistrySnapshotRef: "industry://internal/2026-06-26/tool-registry-snapshot.v1/product-ecosystem",
        sameRunReviewAvailable: false,
      },
    });
    if (result.ok) {
      expect(result.normalizedEventBatchRefs).toHaveLength(6);
      expect(result.rejectedEventBatchRefs).toHaveLength(6);
      expect(result.coverageRefs).toHaveLength(5);
      expect(result.contributionRefs).toHaveLength(6);
      expect(result.governanceProfileIds).toEqual(["axis-runtime-budget-profile.v1/product_ecosystem"]);
      expect(result.feedbackPayload.payload_id).toMatch(/^feedback-/);
      expect(result.feedbackPayload.fact_resolution_audit_ref).toMatch(/^industry:\/\/internal\/2026-06-26\/fact-resolution-audit.v1\//);
    }
  });

  it("rejects product ecosystem dry-run when coverage uses an unpublished governance profile", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildProductEcosystemInput());
    const coverage = bundle.payloads.find((payload) => payload.payload_schema === "axis-tool-coverage-report.v1");
    if (coverage && typeof coverage.budget_status === "object" && coverage.budget_status !== null) {
      (coverage.budget_status as Record<string, unknown>).profile_id = "product-ecosystem-formal-handoff.v1";
    }

    expect(consumeProductEcosystemHandoffForDryRun({ bundle })).toMatchObject({
      ok: false,
      reasonCode: "schema_mismatch",
      feedbackPayloadSchema: "normalization-feedback.v1",
      feedbackPayload: {
        payload_schema: "normalization-feedback.v1",
        feedback_status: "dry_run_rejected",
        producer_agent_id: "normalization-agent",
        feedback_ext: {
          reason_code: "schema_mismatch",
        },
      },
    });
  });
});

function buildProductEcosystemInput() {
  const base = {
    runId: "run-product-ecosystem-platform-normalization",
    threadId: "thread-product-ecosystem-platform-normalization",
    windowStart: "2026-06-20T00:00:00+08:00",
    windowEnd: "2026-06-26T23:59:59+08:00",
    now: "2026-06-26T17:30:00+08:00",
    canonicalSourceAvailable: true,
  };
  return {
    ...base,
    productPlatform: {
      ...base,
      availableToolIds: ["vendor-release-notes-feed"],
      sources: [
        {
          sourceId: "vendor-release",
          displayName: "Release Notes",
          sourceType: "vendor_release" as const,
          authorityTier: "core" as const,
          primarySourceDistance: "primary" as const,
          bucket: "accepted" as const,
          title: "Product release",
          summary: "Official product release.",
        },
      ],
    },
    developerStudio: {
      ...base,
      availableToolIds: ["developer-docs-changelog"],
      sources: [
        {
          sourceId: "sdk-release",
          displayName: "SDK Feed",
          sourceType: "sdk_release" as const,
          authorityTier: "core" as const,
          primarySourceDistance: "primary" as const,
          bucket: "accepted" as const,
          title: "SDK release",
          summary: "Developer studio release.",
        },
      ],
    },
    projectOss: {
      ...base,
      availableToolIds: ["github-release-feed"],
      sources: [
        {
          sourceId: "repo-release",
          displayName: "GitHub Releases",
          sourceType: "repo_release" as const,
          authorityTier: "core" as const,
          primarySourceDistance: "primary" as const,
          bucket: "accepted" as const,
          title: "Repo release",
          summary: "Open source release.",
        },
      ],
    },
    cnCommunity: {
      ...base,
      responsibilityId: "cn-community" as const,
      availableToolIds: ["cn-community-original-thread-index"],
      sources: [
        {
          sourceId: "cn-thread",
          displayName: "CN Community",
          sourceType: "forum_post" as const,
          authorityTier: "proven" as const,
          primarySourceDistance: "primary" as const,
          language: "zh" as const,
          region: "cn",
          bucket: "accepted" as const,
          title: "CN community practice",
          summary: "Original CN community signal.",
        },
      ],
    },
    globalCommunity: {
      ...base,
      responsibilityId: "global-community" as const,
      availableToolIds: ["global-community-original-thread-index"],
      sources: [
        {
          sourceId: "global-issue",
          displayName: "Global Issue",
          sourceType: "issue" as const,
          authorityTier: "proven" as const,
          primarySourceDistance: "primary" as const,
          language: "en" as const,
          region: "global",
          bucket: "accepted" as const,
          title: "Global community issue",
          summary: "Original global community signal.",
        },
      ],
    },
    newsPr: {
      ...base,
      availableToolIds: ["news-pr-narrative-index"],
      sources: [
        {
          sourceId: "news-context",
          displayName: "Media",
          sourceType: "media_report" as const,
          authorityTier: "ordinary" as const,
          primarySourceDistance: "secondary" as const,
          language: "en" as const,
          region: "global",
          bucket: "diagnostic" as const,
          title: "News narrative context",
          summary: "News narrative stays as context.",
        },
      ],
    },
  };
}
