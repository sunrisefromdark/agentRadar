import fs from "node:fs";
import path from "node:path";
import { buildAcademicPrepBundle } from "../../agents/academic-agent/handoff.ts";
import type { ReplayWindowFixture } from "../../agents/academic-agent/types.ts";
import { buildProductEcosystemFormalHandoff } from "../../agents/community-news-agent/formalHandoff.ts";
import type { IndustryRuntimeSummaryArtifact } from "../../../types.ts";
import { validateSharedGovernanceBaseline } from "../contracts/sharedGovernance.ts";
import { loadIndustrySchemaRegistry } from "../contracts/schemaRegistry.ts";
import { consumeAcademicPreparatoryHandoffForDryRun } from "./academicDryRun.ts";
import { replayPolicyFinanceRuntimeReadyFixture } from "./policyFinanceRuntimeReplay.ts";
import { consumeProductEcosystemHandoffForDryRun } from "./productEcosystemDryRun.ts";
import {
  getPlatformRegistrySnapshotGroup,
  loadPlatformRegistrySnapshotFixture,
} from "../registry/runtimeSnapshot.ts";

export function buildIndustryRuntimeSummaryArtifact(input: {
  date: string;
  generatedAt: string;
  rootDir?: string;
}): IndustryRuntimeSummaryArtifact {
  const rootDir = input.rootDir ?? process.cwd();
  const platformContract = readJson<{
    fixture_id: string;
    published_for: string[];
    handoff_payload_schemas: string[];
    feedback_payload_schemas: string[];
    runtime_artifact_schemas: string[];
    shared_governance_profile_ids: string[];
    dispatch_gate: {
      same_run_requires: string[];
      high_cost_requires_reservation_state: string;
      budget_rejected_blocks_start: boolean;
      async_only_review_is_not_same_run_available: boolean;
    };
    event_consumer_gate: {
      execution_context_primary_responsibility_matches_responsibility: boolean;
      operational_executor_id_required: boolean;
      takeover_requires_takeover_audit_ref: boolean;
    };
  }>(rootDir, "fixtures/industry/platform/current-consumer/phase1-runtime.json");
  const sharedGovernance = validateSharedGovernanceBaseline(loadIndustrySchemaRegistry());
  const phase2RegistrySnapshot = loadPlatformRegistrySnapshotFixture();

  const policyFinance = replayPolicyFinanceRuntimeReadyFixture({ rootDir });
  if (!policyFinance.current.ok || policyFinance.current.status !== policyFinance.fixture.current.expected_status) {
    throw new Error(`policy-finance runtime summary mismatch: expected ${policyFinance.fixture.current.expected_status}`);
  }
  if (
    policyFinance.negative_missing_stable_claim_key.ok ||
    policyFinance.negative_missing_stable_claim_key.reasonCode !==
      policyFinance.fixture.negative_missing_stable_claim_key.expected_reason_code
  ) {
    throw new Error(
      `policy-finance negative runtime summary mismatch: expected ${policyFinance.fixture.negative_missing_stable_claim_key.expected_reason_code}`,
    );
  }

  const academicFixture = readJson<ReplayWindowFixture>(
    rootDir,
    "fixtures/industry/agents/academic-agent/replay/academic-replay-window.json",
  );
  const academic = consumeAcademicPreparatoryHandoffForDryRun({
    bundle: buildAcademicPrepBundle(academicFixture),
  });
  if (!academic.ok) {
    throw new Error(`academic preparatory summary mismatch: ${academic.reasonCode}`);
  }

  const { bundle } = buildProductEcosystemFormalHandoff(buildProductEcosystemInput());
  const productSnapshot = getPlatformRegistrySnapshotGroup("product_ecosystem", phase2RegistrySnapshot);
  const product = consumeProductEcosystemHandoffForDryRun({
    bundle,
    registrySnapshotRef: productSnapshot.registry_snapshot_ref,
    toolRegistrySnapshotRef: productSnapshot.tool_registry_snapshot_ref,
    seedRefs: productSnapshot.seed_refs,
    authorityRefs: productSnapshot.authority_refs,
    manualReviewPoolSlots: phase2RegistrySnapshot.review_availability.manual_review_pool_slots,
    reviewAvailability: {
      same_run_review_mode: phase2RegistrySnapshot.review_availability.same_run_review_mode,
      reviewer_on_duty_count: phase2RegistrySnapshot.review_availability.reviewer_on_duty_count,
    },
  });
  if (!product.ok) {
    throw new Error(`product ecosystem summary mismatch: ${product.reasonCode}`);
  }

  return {
    artifact_kind: "industry_runtime_summary",
    date: input.date,
    generated_at: input.generatedAt,
    overall_status: "industry_runtime_contracts_ready",
    platform_contract: {
      fixture_id: platformContract.fixture_id,
      registry_snapshot_fixture_id: phase2RegistrySnapshot.fixture_id,
      published_for: platformContract.published_for,
      handoff_payload_schema_count: platformContract.handoff_payload_schemas.length,
      feedback_payload_schema_count: platformContract.feedback_payload_schemas.length,
      runtime_artifact_schema_count: platformContract.runtime_artifact_schemas.length,
      shared_governance_published: sharedGovernance.ok,
      shared_governance_profile_count: platformContract.shared_governance_profile_ids.length,
      dispatch_gate: {
        same_run_requires_count: platformContract.dispatch_gate.same_run_requires.length,
        high_cost_requires_reservation_state: platformContract.dispatch_gate.high_cost_requires_reservation_state,
        budget_rejected_blocks_start: platformContract.dispatch_gate.budget_rejected_blocks_start,
        async_only_review_is_not_same_run_available:
          platformContract.dispatch_gate.async_only_review_is_not_same_run_available,
      },
      event_consumer_gate: {
        execution_context_primary_responsibility_matches_responsibility:
          platformContract.event_consumer_gate.execution_context_primary_responsibility_matches_responsibility,
        operational_executor_id_required: platformContract.event_consumer_gate.operational_executor_id_required,
        takeover_requires_takeover_audit_ref: platformContract.event_consumer_gate.takeover_requires_takeover_audit_ref,
      },
    },
    policy_finance: {
      status: policyFinance.current.status,
      negative_reason_code: policyFinance.negative_missing_stable_claim_key.reasonCode,
      runtime_consumed_same_run_messages: policyFinance.current.runtimeConsumedSameRunMessages,
      activation_profile_ids: policyFinance.current.activationProfileIds,
      stop_profile_ids: policyFinance.current.stopProfileIds,
      review_profile_ids: policyFinance.current.reviewProfileIds,
    },
    product_ecosystem: {
      status: product.status,
      normalized_event_batch_refs_count: product.normalizedEventBatchRefs.length,
      coverage_refs_count: product.coverageRefs.length,
      contribution_refs_count: product.contributionRefs.length,
    },
    academic_preparatory: {
      status: academic.status,
      blocked_until: academic.blockedUntil,
      promotion_ready: academic.promotionReady,
      normalized_event_batch_refs_count: academic.normalizedEventBatchRefs.length,
    },
  };
}

function readJson<T>(rootDir: string, relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8")) as T;
}

export function buildProductEcosystemInput() {
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
