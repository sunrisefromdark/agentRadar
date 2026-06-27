import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import currentBundleFixture from "../../../../fixtures/industry/agents/policy-agent/replay/phase1-current-bundle.json" with { type: "json" };
import negativeBundleFixture from "../../../../fixtures/industry/agents/policy-agent/replay/phase1-missing-stable-claim-key-bundle.json" with { type: "json" };
import sameRunCurrentFixture from "../../../../fixtures/industry/agents/policy-agent/compatibility/same-run-current-consumer.json" with { type: "json" };
import sameRunNegativeFixture from "../../../../fixtures/industry/agents/policy-agent/compatibility/same-run-missing-stable-claim-key-negative.json" with { type: "json" };
import {
  consumeFinancePolicyHandoffForDryRun,
  consumeFinancePolicyHandoffForRuntime,
} from "../../../industry/platform/normalization/financePolicyDryRun.ts";
import { buildProductEcosystemFormalHandoff } from "../../../industry/agents/community-news-agent/formalHandoff.ts";
import { consumeProductEcosystemHandoffForDryRun } from "../../../industry/platform/normalization/productEcosystemDryRun.ts";
import { buildAcademicPrepBundle } from "../../../industry/agents/academic-agent/handoff.ts";
import type { ReplayWindowFixture } from "../../../industry/agents/academic-agent/types.ts";
import {
  consumeAcademicHandoffForDryRun,
  consumeAcademicPreparatoryHandoffForDryRun,
} from "../../../industry/platform/normalization/academicDryRun.ts";
import type { AcademicFormalHandoffBundle } from "../../../industry/platform/contracts/academicHandoff.ts";
import type { FinancePolicyHandoffBundle } from "../../../industry/platform/contracts/financePolicyHandoff.ts";

const currentBundle = currentBundleFixture as FinancePolicyHandoffBundle;
const negativeBundle = negativeBundleFixture as FinancePolicyHandoffBundle;

describe("industry platform normalization dry-run", () => {
  it("materializes the policy-finance current bundle without a producer wrapper", () => {
    const result = consumeFinancePolicyHandoffForDryRun({
      bundle: currentBundle,
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
      bundle: negativeBundle,
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

  it("promotes policy-finance handoff through the runtime path after governance profiles resolve", () => {
    const result = consumeFinancePolicyHandoffForRuntime({
      bundle: currentBundle,
      dispatchContext: sameRunCurrentFixture.dispatch_context,
      reservations: sameRunCurrentFixture.reservations,
      budgetArbitration: sameRunCurrentFixture.budget_arbitration,
      requiresCapacityReservation: true,
    });
    const claimCriticalMessages = currentBundle.messages.filter((message) => message.capability_class === "claim-critical");

    expect(result).toMatchObject({
      ok: true,
      status: "policy_finance_runtime_ready",
      runtimeConsumedSameRunMessages: claimCriticalMessages.length,
      activationProfileIds: [
        "axis-activation-policy.v1/capital_finance",
        "axis-activation-policy.v1/policy_regulatory",
        "axis-activation-policy.v1/policy_research_thinktank",
        "axis-runtime-budget-profile.v1/capital_finance",
        "axis-runtime-budget-profile.v1/policy_regulatory",
        "axis-runtime-budget-profile.v1/policy_research_thinktank",
      ],
      stopProfileIds: [
        "canonical-fetch-stop-policy.v1/capital_finance",
        "canonical-fetch-stop-policy.v1/policy_regulatory",
        "canonical-fetch-stop-policy.v1/policy_research_thinktank",
      ],
      reviewProfileIds: ["same-run-review-availability-policy.v1/policy_finance"],
      runtimeRegistrySnapshots: [
        {
          ok: true,
          status: "runtime_snapshot_published",
          registrySnapshotRef: "registry://industry/source-authority/finance/v1",
          toolRegistrySnapshotRef: "registry://industry/tool-catalog/finance/v1",
          runtimeInputRefs: [
            "industry://internal/2026-06-26/axis-tool-coverage-report.v1/artifact-a5d9b9371f3d",
            "registry://industry/source-authority/finance/v1",
          ],
          sameRunReviewAvailable: false,
        },
        {
          ok: true,
          status: "runtime_snapshot_published",
          registrySnapshotRef: "registry://industry/source-authority/policy/v1",
          toolRegistrySnapshotRef: "registry://industry/tool-catalog/policy/v1",
          runtimeInputRefs: [
            "industry://internal/2026-06-26/axis-tool-coverage-report.v1/artifact-e6203625b947",
            "registry://industry/source-authority/policy/v1",
          ],
          sameRunReviewAvailable: false,
        },
        {
          ok: true,
          status: "runtime_snapshot_published",
          registrySnapshotRef: "registry://industry/source-authority/thinktank/v1",
          toolRegistrySnapshotRef: "registry://industry/tool-catalog/thinktank/v1",
          runtimeInputRefs: [
            "industry://internal/2026-06-26/axis-tool-coverage-report.v1/artifact-fcfa36416828",
            "registry://industry/source-authority/thinktank/v1",
          ],
          sameRunReviewAvailable: false,
        },
      ],
    });
  });

  it("rejects policy-finance runtime handoff when same-run refs are incomplete", () => {
    const result = consumeFinancePolicyHandoffForRuntime({
      bundle: negativeBundle,
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

  it("rejects policy-finance runtime handoff when coverage refs cannot publish runtime snapshots", () => {
    const brokenBundle = structuredClone(currentBundle);
    const dailyInput = brokenBundle.payloads.find((payload) => payload.payload_schema === "daily-industry-evidence-pack-input.v1") as {
      coverage_refs: string[];
    };
    dailyInput.coverage_refs[0] = "industry://internal/2026-06-26/axis-tool-coverage-report.v1/missing";

    const result = consumeFinancePolicyHandoffForRuntime({
      bundle: brokenBundle,
      dispatchContext: sameRunCurrentFixture.dispatch_context,
      reservations: sameRunCurrentFixture.reservations,
      budgetArbitration: sameRunCurrentFixture.budget_arbitration,
      requiresCapacityReservation: true,
    });

    expect(result).toMatchObject({
      ok: false,
      reasonCode: "lineage_failed",
    });
  });

  it("accepts academic preparatory refs for normalization dry-run feedback without promoting formal handoff", () => {
    const fixture = readJson<ReplayWindowFixture>("fixtures/industry/agents/academic-agent/replay/academic-replay-window.json");
    const result = consumeAcademicPreparatoryHandoffForDryRun({
      bundle: buildAcademicPrepBundle(fixture),
    });

    expect(result).toMatchObject({
      ok: true,
      status: "academic_preparatory_normalization_dry_run_ready",
      normalizedEventBatchRefs: expect.any(Array),
      rejectedEventBatchRefs: expect.any(Array),
      coverageRefs: expect.any(Array),
      contributionRefs: expect.any(Array),
      promotionReady: false,
      blockedUntil: "formal_academic_handoff",
      feedbackPayloadSchema: "normalization-feedback.v1",
      feedbackPayload: {
        payload_schema: "normalization-feedback.v1",
        schema_version: "1.0.0",
        run_id: "academic-2026-06-26",
        producer_agent_id: "normalization-agent",
        feedback_status: "dry_run_ready",
      },
    });
    if (result.ok) {
      expect(result.normalizedEventBatchRefs).toHaveLength(2);
      expect(result.rejectedEventBatchRefs).toHaveLength(2);
      expect(result.coverageRefs).toHaveLength(2);
      expect(result.contributionRefs).toHaveLength(2);
    }
  });

  it("returns normalization feedback when academic preparatory refs are incomplete", () => {
    const fixture = readJson<ReplayWindowFixture>("fixtures/industry/agents/academic-agent/replay/academic-replay-window.json");
    const bundle = buildAcademicPrepBundle(fixture);
    bundle.daily_input.payload.coverage_refs = ["artifact://academic-agent/missing/coverage.json", bundle.daily_input.payload.coverage_refs[1]!];

    expect(consumeAcademicPreparatoryHandoffForDryRun({ bundle })).toMatchObject({
      ok: false,
      reasonCode: "lineage_failed",
      feedbackPayloadSchema: "normalization-feedback.v1",
      feedbackPayload: {
        payload_schema: "normalization-feedback.v1",
        feedback_status: "dry_run_rejected",
        producer_agent_id: "normalization-agent",
        feedback_ext: {
          reason_code: "lineage_failed",
        },
      },
    });
  });

  it("materializes academic formal handoff for normalization dry-run once academic artifacts arrive", () => {
    const result = consumeAcademicHandoffForDryRun({ bundle: buildAcademicFormalBundle() });

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
        run_id: "run-academic-formal",
        feedback_status: "dry_run_ready",
      },
    });
    if (result.ok) {
      expect(result.normalizedEventBatchRefs).toHaveLength(2);
      expect(result.coverageRefs).toHaveLength(2);
      expect(result.contributionRefs).toHaveLength(2);
    }
  });
});

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
}

function buildAcademicFormalBundle(): AcademicFormalHandoffBundle {
  const normalizedRefs = [
    "industry://internal/2026-06-26/events/research-paper",
    "industry://internal/2026-06-26/events/conference-academic",
  ];
  const rejectedRefs = [
    "industry://internal/2026-06-26/events/research-paper-rejected",
    "industry://internal/2026-06-26/events/conference-academic-rejected",
  ];
  const coverageRefs = [
    "industry://internal/2026-06-26/coverage/research-paper",
    "industry://internal/2026-06-26/coverage/conference-academic",
  ];
  const contributionRefs = [
    "industry://internal/2026-06-26/contribution/research-frontier",
    "industry://internal/2026-06-26/contribution/conference-academic",
  ];
  const refs = [
    ...normalizedRefs,
    ...rejectedRefs,
    ...coverageRefs,
    ...contributionRefs,
    "industry://internal/2026-06-26/daily/academic-input",
  ];
  return {
    messages: refs.map((ref) => academicMessage(ref)),
    manifests: refs.map((artifact_ref) => ({ artifact_ref })),
    artifactRefs: refs,
    payloads: [
      academicPayload("industry-signal-event-batch.v1", { responsibility_id: "research-frontier" }),
      academicPayload("industry-signal-event-batch.v1", { responsibility_id: "conference-academic" }),
      academicPayload("axis-tool-coverage-report.v1", { responsibility_id: "research-frontier" }),
      academicPayload("axis-tool-coverage-report.v1", { responsibility_id: "conference-academic" }),
      academicPayload("industry-agent-contribution.v1", { responsibility_id: "research-frontier" }),
      academicPayload("industry-agent-contribution.v1", { responsibility_id: "conference-academic" }),
      academicPayload("daily-industry-evidence-pack-input.v1", {
        payload_id: "run-academic-formal.daily",
        run_id: "run-academic-formal",
        window_end: "2026-06-26T23:59:59+08:00",
        source_message_id: "academic-formal-daily-message",
        normalized_event_batch_refs: normalizedRefs,
        rejected_event_batch_refs: rejectedRefs,
        source_message_ids: ["m1", "m2"],
        coverage_refs: coverageRefs,
        contribution_refs: contributionRefs,
      }),
    ],
    replayFixtureRefs: ["fixtures/industry/agents/academic-agent/replay/academic-replay-window.json"],
    evalFixtureRefs: ["fixtures/industry/agents/academic-agent/eval/anti-upgrade-preprint.json"],
    ownerBoundaryFixtureRefs: ["fixtures/industry/agents/academic-agent/owner-boundary/news-relays-paper.json"],
  };
}

function academicMessage(ref: string): Record<string, unknown> {
  const payload_schema = ref.includes("/coverage/")
    ? "axis-tool-coverage-report.v1"
    : ref.includes("/contribution/")
      ? "industry-agent-contribution.v1"
      : ref.includes("/daily/")
        ? "daily-industry-evidence-pack-input.v1"
        : "industry-signal-event-batch.v1";
  return {
    kind:
      payload_schema === "industry-signal-event-batch.v1"
        ? "evidence_batch"
        : payload_schema === "axis-tool-coverage-report.v1"
          ? "tool_status_report"
          : payload_schema === "industry-agent-contribution.v1"
            ? "industry_agent_contribution"
            : "daily_industry_evidence_pack_input",
    from_agent_id: "academic-agent",
    to_agent_id: "normalization-agent",
    payload_schema,
    payload_ref: ref,
  };
}

function academicPayload(payload_schema: string, extra: Record<string, unknown>): Record<string, unknown> {
  return { payload_schema, schema_version: "1.0.0", ...extra };
}

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
