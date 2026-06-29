import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  buildPolicyFinanceDryRunHandoff,
  buildPolicyFinanceGroupHandoff,
  buildPolicyFinanceRuntimeReadyHandoff,
  replayPolicyFinanceRuntimeReadyFixture,
} from "../../../../industry/agents/policy-agent/index.ts";
import replayBundleFixture from "../../../../../fixtures/industry/agents/policy-agent/replay/phase1-current-bundle.json" with { type: "json" };
import negativeBundleFixture from "../../../../../fixtures/industry/agents/policy-agent/replay/phase1-missing-stable-claim-key-bundle.json" with { type: "json" };
import deliveryManifestFixture from "../../../../../fixtures/industry/agents/policy-agent/replay/phase1-delivery-manifest.json" with { type: "json" };
import nextPlatformActionsFixture from "../../../../../fixtures/industry/agents/policy-agent/replay/phase1-next-platform-actions.json" with { type: "json" };
import deliveryChecksumsFixture from "../../../../../fixtures/industry/agents/policy-agent/replay/phase1-delivery-checksums.json" with { type: "json" };
import runtimeReadyInputsFixture from "../../../../../fixtures/industry/agents/policy-agent/replay/phase1-runtime-ready-inputs.json" with { type: "json" };
import sameRunCurrentFixture from "../../../../../fixtures/industry/agents/policy-agent/compatibility/same-run-current-consumer.json" with { type: "json" };
import sameRunNegativeFixture from "../../../../../fixtures/industry/agents/policy-agent/compatibility/same-run-missing-stable-claim-key-negative.json" with { type: "json" };
import { validateFinancePolicyHandoff } from "../../../../industry/platform/contracts/financePolicyHandoff.ts";
import { loadIndustrySchemaRegistry } from "../../../../industry/platform/contracts/schemaRegistry.ts";
import { consumeFinancePolicyHandoffForRuntime } from "../../../../industry/platform/normalization/financePolicyDryRun.ts";
import type { IndustryAgentMessageEnvelope } from "../../../../industry/agents/policy-agent/groupProtocol.ts";

describe("policy-finance group replay handoff", () => {
  const replayMessages = replayBundleFixture.messages as IndustryAgentMessageEnvelope[];
  const negativeMessages = negativeBundleFixture.messages as IndustryAgentMessageEnvelope[];

  it("keeps producer artifact refs aligned across daily handoff packaging", () => {
    const result = buildPolicyFinanceGroupHandoff({
      runId: "run-group-replay-1",
      threadId: "thread-group-replay-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:00:00+08:00",
      finance: {
        runId: "run-group-replay-1",
        threadId: "thread-group-replay-1",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:00:00+08:00",
        availableToolIds: ["sec-edgar-api"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "finance-replay",
            displayName: "SEC Filing",
            sourceType: "financial_filing",
            sourceFamily: "finance_sec_filing",
            authorityTier: "core",
            primarySourceDistance: "primary",
            accessMode: "api",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "SEC EDGAR",
            bucket: "accepted",
            title: "资本主证 replay",
            summaryCn: "finance accepted replay",
            financeSignalKind: "capital_allocation",
            agentRelevanceScore: 0.91,
            agentRelevanceReasons: ["finance-replay"],
          },
        ],
      },
      regulatory: {
        runId: "run-group-replay-1",
        threadId: "thread-group-replay-1",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:00:00+08:00",
        availableToolIds: ["official-regulator-rss"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "reg-replay",
            displayName: "监管公告",
            sourceType: "policy",
            sourceFamily: "policy_government_announcement",
            authorityTier: "core",
            primarySourceDistance: "primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "Federal Register",
            bucket: "accepted",
            title: "监管主证 replay",
            summaryCn: "regulatory accepted replay",
            policySignalKind: "official_support",
            agentRelevanceScore: 0.9,
            agentRelevanceReasons: ["reg-replay"],
          },
        ],
      },
      thinktank: {
        runId: "run-group-replay-1",
        threadId: "thread-group-replay-1",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T17:00:00+08:00",
        availableToolIds: ["thinktank-report-registry"],
        canonicalSourceAvailable: true,
        sources: [
          {
            sourceId: "thinktank-replay",
            displayName: "智库报告",
            sourceType: "thinktank_report",
            sourceFamily: "thinktank_institutional_report",
            authorityTier: "proven",
            primarySourceDistance: "primary",
            accessMode: "public",
            costTier: "free",
            reviewStatus: "active",
            namedSource: "OECD.AI",
            bucket: "accepted",
            title: "智库主证 replay",
            summaryCn: "thinktank accepted replay",
            policySignalKind: "thinktank_viewpoint",
            agentRelevanceScore: 0.82,
            agentRelevanceReasons: ["thinktank-replay"],
          },
        ],
      },
    });

    expect(result.dailyInput.payload.source_message_ids).toHaveLength(12);
    expect(result.dailyInput.payload.normalized_event_batch_refs).toEqual([
      result.finance.accepted.manifest.artifact_ref,
      result.regulatory.accepted.manifest.artifact_ref,
      result.thinktank.accepted.manifest.artifact_ref,
    ]);
    expect(result.dailyInput.payload.rejected_event_batch_refs).toEqual([
      result.finance.rejected.manifest.artifact_ref,
      result.regulatory.rejected.manifest.artifact_ref,
      result.thinktank.rejected.manifest.artifact_ref,
    ]);
    expect(result.dailyInput.payload).not.toHaveProperty("events");
    expect(new Set(result.dailyInput.payload.source_message_ids).size).toBe(result.dailyInput.payload.source_message_ids.length);
  });

  it("publishes a machine-readable current bundle fixture for downstream dry-run consumption", () => {
    expect(replayMessages).toHaveLength(19);
    expect(replayBundleFixture.manifests).toHaveLength(19);
    expect(replayBundleFixture.payloads).toHaveLength(19);
    expect(replayBundleFixture.artifactRefs).toHaveLength(19);
    expect(replayMessages.every((message) => message.capability_class === "claim-critical")).toBe(true);
    expect(
      replayMessages.every(
        (message) =>
          typeof message.dispatch_context_ref === "string" &&
          typeof message.scheduling_key === "string" &&
          (typeof message.claim_partition_id === "string" || typeof message.candidate_group_id === "string"),
      ),
    ).toBe(true);
    expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), replayBundleFixture)).toEqual({
      ok: true,
      status: "accepted_for_dry_run",
    });
  });

  it("publishes a machine-readable negative bundle fixture that fails on missing stable claim key", () => {
    expect(negativeMessages).toHaveLength(19);
    expect(negativeBundleFixture.manifests).toHaveLength(19);
    expect(negativeBundleFixture.payloads).toHaveLength(19);
    expect(negativeBundleFixture.artifactRefs).toHaveLength(19);
    expect(
      negativeMessages.some(
        (message) => message.responsibility_id === "capital-finance" && message.capability_class === "claim-critical",
      ),
    ).toBe(true);
    expect(
      negativeMessages.every(
        (message) => message.responsibility_id !== "capital-finance" || (
          typeof message.dispatch_context_ref === "string" &&
          typeof message.scheduling_key === "string" &&
          message.claim_partition_id === undefined &&
          message.candidate_group_id === undefined
        ),
      ),
    ).toBe(true);
    expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), negativeBundleFixture)).toMatchObject({
      ok: false,
      reasonCode: "dispatch_context_missing",
    });
  });

  it("publishes a machine-readable delivery manifest for downstream consumers", () => {
    const root = process.cwd();
    expect(deliveryManifestFixture.policy_finance_inputs_complete_for_executor_4).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.stable_entrypoints.policy_agent_index))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.stable_entrypoints.finance_agent_index))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.stable_entrypoints.policy_finance_dry_run_helper))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.stable_entrypoints.policy_finance_runtime_ready_helper))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.stable_entrypoints.policy_finance_runtime_ready_fixture_replay))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.stable_entrypoints.policy_finance_runtime_ready_impl))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.stable_entrypoints.policy_finance_platform_runtime_replay))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.platform_consumers.normalization_dry_run))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.platform_consumers.normalization_runtime))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.platform_consumers.current_runtime_contract))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.platform_consumers.negative_runtime_contract))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.bundle_fixtures.current))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.bundle_fixtures.negative_missing_stable_claim_key))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.same_run_fixtures.current))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.same_run_fixtures.negative_missing_stable_claim_key))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.notes.handoff))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.notes.shared_runtime))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.runtime_ready_inputs.current_and_negative))).toBe(true);
    expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), replayBundleFixture)).toMatchObject({
      ok: true,
      status: deliveryManifestFixture.expected_platform_gates.current_bundle,
    });
    expect(
      consumeFinancePolicyHandoffForRuntime({
        bundle: replayBundleFixture,
        dispatchContext: sameRunCurrentFixture.dispatch_context,
        reservations: sameRunCurrentFixture.reservations,
        budgetArbitration: sameRunCurrentFixture.budget_arbitration,
        requiresCapacityReservation: true,
      }),
    ).toMatchObject({
      ok: true,
      status: deliveryManifestFixture.expected_platform_gates.current_runtime,
    });
    expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), negativeBundleFixture)).toMatchObject({
      ok: false,
      reasonCode: deliveryManifestFixture.expected_platform_gates.negative_bundle,
    });
    expect(
      consumeFinancePolicyHandoffForRuntime({
        bundle: negativeBundleFixture,
        dispatchContext: sameRunNegativeFixture.dispatch_context,
        reservations: sameRunNegativeFixture.reservations,
        budgetArbitration: sameRunNegativeFixture.budget_arbitration,
        requiresCapacityReservation: true,
      }),
    ).toMatchObject({
      ok: false,
      reasonCode: deliveryManifestFixture.expected_platform_gates.negative_bundle,
    });
  });

  it("publishes a machine-readable next-actions manifest for executor 4", () => {
    const root = process.cwd();
    expect(nextPlatformActionsFixture.status).toBe("policy_finance_runtime_integration_complete");
    expect(nextPlatformActionsFixture.executor_4_can_continue_phase1_without_more_policy_finance_inputs).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.delivery_manifest))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.current_bundle))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.negative_bundle))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.runtime_ready_inputs))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.platform_runtime_replay))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.handoff_note))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.shared_runtime_note))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.normalization_runtime))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.platform_current_runtime_fixture))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.platform_negative_runtime_fixture))).toBe(true);
    expect(nextPlatformActionsFixture.completed_platform_actions.map((action) => action.action)).toEqual([
      "consume_current_bundle",
      "consume_same_run_runtime_refs_in_runtime_path",
      "activate_shared_governance_runtime",
      "publish_policy_finance_runtime_registry_snapshots",
    ]);
    expect(nextPlatformActionsFixture.remaining_platform_actions).toHaveLength(0);
  });

  it("publishes delivery checksums for executor 4 to verify consumed inputs", () => {
    const root = process.cwd();
    expect(deliveryChecksumsFixture.algorithm).toBe("sha256");
    expect(deliveryChecksumsFixture.entries).toHaveLength(16);
    for (const entry of deliveryChecksumsFixture.entries) {
      const filePath = path.join(root, entry.path);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
      const content = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
      expect(crypto.createHash("sha256").update(content, "utf8").digest("hex")).toBe(entry.sha256);
    }
  });

  it("publishes reusable runtime-ready input fixtures for direct runtime helper consumption", () => {
    const root = process.cwd();
    expect(fs.existsSync(path.join(root, runtimeReadyInputsFixture.helper_entrypoints.dry_run))).toBe(true);
    expect(fs.existsSync(path.join(root, runtimeReadyInputsFixture.helper_entrypoints.runtime_ready))).toBe(true);
    expect(fs.existsSync(path.join(root, runtimeReadyInputsFixture.helper_entrypoints.runtime_ready_fixture_replay))).toBe(true);
    expect(fs.existsSync(path.join(root, runtimeReadyInputsFixture.helper_entrypoints.platform_runtime_replay))).toBe(true);
    expect(fs.existsSync(path.join(root, runtimeReadyInputsFixture.helper_entrypoints.platform_runtime_consumer))).toBe(true);
    expect(fs.existsSync(path.join(root, runtimeReadyInputsFixture.current.bundle))).toBe(true);
    expect(fs.existsSync(path.join(root, runtimeReadyInputsFixture.current.same_run_fixture))).toBe(true);
    expect(fs.existsSync(path.join(root, runtimeReadyInputsFixture.current.platform_current_runtime_fixture))).toBe(true);
    expect(fs.existsSync(path.join(root, runtimeReadyInputsFixture.negative_missing_stable_claim_key.bundle))).toBe(true);
    expect(fs.existsSync(path.join(root, runtimeReadyInputsFixture.negative_missing_stable_claim_key.same_run_fixture))).toBe(true);
    expect(fs.existsSync(path.join(root, runtimeReadyInputsFixture.negative_missing_stable_claim_key.platform_negative_runtime_fixture))).toBe(true);
    expect(runtimeReadyInputsFixture.current.expected_status).toBe("policy_finance_runtime_ready");
    expect(runtimeReadyInputsFixture.negative_missing_stable_claim_key.expected_case_id).toBe("same-run-missing-stable-claim-key");
    expect(runtimeReadyInputsFixture.negative_missing_stable_claim_key.expected_reason_code).toBe("dispatch_context_missing");
  });

  it("builds a runtime-ready helper result that directly consumes the platform runtime path", () => {
    const result = buildPolicyFinanceRuntimeReadyHandoff(buildRuntimeReadyInput());

    expect(result.bundle.messages).toHaveLength(19);
    expect(result.runtime).toMatchObject({
      ok: true,
      status: "policy_finance_runtime_ready",
      runtimeConsumedSameRunMessages: 19,
      reviewProfileIds: ["same-run-review-availability-policy.v1/policy_finance"],
    });
  });

  it("builds a dry-run helper result that rejects incomplete same-run refs before runtime promotion", () => {
    const result = buildPolicyFinanceDryRunHandoff(buildRuntimeReadyInput({ stableClaimKey: "missing" }));

    expect(result.bundle.messages).toHaveLength(19);
    expect(result.dryRun).toMatchObject({
      ok: false,
      reasonCode: "dispatch_context_missing",
    });
  });

  it("replays the machine-readable runtime-ready fixture through the policy-agent entrypoint", () => {
    const result = replayPolicyFinanceRuntimeReadyFixture();

    expect(result.fixture.fixture_id).toBe("policy-finance-phase1-runtime-ready-inputs.v1");
    expect(result.current_runtime_contract.dispatch_gate?.high_cost_requires_reservation_state).toBe("granted");
    expect(result.negative_runtime_case).toMatchObject({
      case_id: result.fixture.negative_missing_stable_claim_key.expected_case_id,
      expected_reason_code: result.fixture.negative_missing_stable_claim_key.expected_reason_code,
    });
    expect(result.current).toMatchObject({
      ok: true,
      status: result.fixture.current.expected_status,
    });
    expect(result.negative_missing_stable_claim_key).toMatchObject({
      ok: false,
      reasonCode: result.fixture.negative_missing_stable_claim_key.expected_reason_code,
    });
  });

  it("replays the machine-readable runtime-ready fixture through the executable script", () => {
    const artifactPath = path.join(process.cwd(), "data", "reports", "2026-06-26.policy-finance-runtime-replay.json");
    const latestArtifactPath = path.join(process.cwd(), "data", "reports", "latest.policy-finance-runtime-replay.json");
    const previousArtifact = fs.existsSync(artifactPath) ? fs.readFileSync(artifactPath, "utf8") : null;
    const previousLatestArtifact = fs.existsSync(latestArtifactPath) ? fs.readFileSync(latestArtifactPath, "utf8") : null;

    try {
      fs.rmSync(artifactPath, { force: true });
      fs.rmSync(latestArtifactPath, { force: true });
      const output = execFileSync(
        process.execPath,
        [
          path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"),
          "src/cli.ts",
          "policy-finance-runtime-replay",
          "--date",
          "2026-06-26",
        ],
        { cwd: process.cwd(), encoding: "utf8" },
      );
      const jsonStart = output.indexOf("{");
      const result = JSON.parse(output.slice(jsonStart)) as {
        artifact_kind: string;
        date: string;
        fixture_id: string;
        current_status: string;
        negative_reason_code: string;
        runtime_consumed_same_run_messages: number;
      };

      expect(result).toMatchObject({
        artifact_kind: "policy_finance_runtime_replay",
        date: "2026-06-26",
        fixture_id: "policy-finance-phase1-runtime-ready-inputs.v1",
        current_status: "policy_finance_runtime_ready",
        negative_reason_code: "dispatch_context_missing",
        runtime_consumed_same_run_messages: 19,
      });
      expect(fs.existsSync(artifactPath)).toBe(true);
      expect(fs.existsSync(latestArtifactPath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(artifactPath, "utf8"))).toMatchObject({
        artifact_kind: "policy_finance_runtime_replay",
        date: "2026-06-26",
        current_status: "policy_finance_runtime_ready",
      });
    } finally {
      previousArtifact === null ? fs.rmSync(artifactPath, { force: true }) : fs.writeFileSync(artifactPath, previousArtifact);
      previousLatestArtifact === null
        ? fs.rmSync(latestArtifactPath, { force: true })
        : fs.writeFileSync(latestArtifactPath, previousLatestArtifact);
    }
  });
});

function buildRuntimeReadyInput(options?: { stableClaimKey?: "present" | "missing" }) {
  const useMissingStableClaimKey = options?.stableClaimKey === "missing";
  const sameRunFixture = useMissingStableClaimKey ? sameRunNegativeFixture : sameRunCurrentFixture;
  const claimPartitionId =
    "claim_partition_id" in sameRunFixture && typeof sameRunFixture.claim_partition_id === "string"
      ? sameRunFixture.claim_partition_id
      : undefined;
  const candidateGroupId =
    "candidate_group_id" in sameRunFixture && typeof sameRunFixture.candidate_group_id === "string"
      ? sameRunFixture.candidate_group_id
      : undefined;

  return {
    runId: "run-group-runtime-helper-1",
    threadId: "thread-group-runtime-helper-1",
    windowStart: "2026-06-20T00:00:00+08:00",
    windowEnd: "2026-06-26T23:59:59+08:00",
    now: "2026-06-26T17:30:00+08:00",
    finance: {
      runId: "run-group-runtime-helper-1",
      threadId: "thread-group-runtime-helper-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:30:00+08:00",
      availableToolIds: ["sec-edgar-api"],
      canonicalSourceAvailable: true,
      runtimeContext: {
        capabilityClass: sameRunFixture.capability_class as "claim-critical",
        dispatchContextRef: sameRunFixture.dispatch_context_ref,
        schedulingKey: sameRunFixture.scheduling_key,
        claimPartitionId: useMissingStableClaimKey ? undefined : claimPartitionId,
        candidateGroupId: useMissingStableClaimKey ? undefined : candidateGroupId,
        claimAdmissionAssessmentRef: sameRunFixture.claim_admission_assessment_ref,
        capacityReservationRefs: sameRunFixture.capacity_reservation_refs,
      },
      sources: [
        {
          sourceId: "finance-runtime-helper",
          displayName: "SEC Filing",
          sourceType: "financial_filing" as const,
          sourceFamily: "finance_sec_filing" as const,
          authorityTier: "core" as const,
          primarySourceDistance: "primary" as const,
          accessMode: "api" as const,
          costTier: "free" as const,
          reviewStatus: "active" as const,
          namedSource: "SEC EDGAR",
          bucket: "accepted" as const,
          title: "资本主证 helper",
          summaryCn: "finance helper accepted",
          financeSignalKind: "capital_allocation" as const,
          agentRelevanceScore: 0.91,
          agentRelevanceReasons: ["finance-runtime-helper"],
        },
      ],
    },
    regulatory: {
      runId: "run-group-runtime-helper-1",
      threadId: "thread-group-runtime-helper-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:30:00+08:00",
      availableToolIds: ["official-regulator-rss"],
      canonicalSourceAvailable: true,
      runtimeContext: {
        capabilityClass: sameRunFixture.capability_class as "claim-critical",
        dispatchContextRef: sameRunFixture.dispatch_context_ref,
        schedulingKey: sameRunFixture.scheduling_key,
        claimPartitionId: useMissingStableClaimKey ? undefined : claimPartitionId,
        candidateGroupId: useMissingStableClaimKey ? undefined : candidateGroupId,
        claimAdmissionAssessmentRef: sameRunFixture.claim_admission_assessment_ref,
        capacityReservationRefs: sameRunFixture.capacity_reservation_refs,
      },
      sources: [
        {
          sourceId: "reg-runtime-helper",
          displayName: "监管公告",
          sourceType: "policy" as const,
          sourceFamily: "policy_regulatory_filing" as const,
          authorityTier: "core" as const,
          primarySourceDistance: "primary" as const,
          accessMode: "public" as const,
          costTier: "free" as const,
          reviewStatus: "active" as const,
          namedSource: "FTC",
          bucket: "accepted" as const,
          title: "监管主证 helper",
          summaryCn: "regulatory helper accepted",
          policySignalKind: "confirmed_approval" as const,
          agentRelevanceScore: 0.9,
          agentRelevanceReasons: ["reg-runtime-helper"],
        },
      ],
    },
    thinktank: {
      runId: "run-group-runtime-helper-1",
      threadId: "thread-group-runtime-helper-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:30:00+08:00",
      availableToolIds: ["thinktank-report-registry"],
      canonicalSourceAvailable: true,
      runtimeContext: {
        capabilityClass: sameRunFixture.capability_class as "claim-critical",
        dispatchContextRef: sameRunFixture.dispatch_context_ref,
        schedulingKey: sameRunFixture.scheduling_key,
        claimPartitionId: useMissingStableClaimKey ? undefined : claimPartitionId,
        candidateGroupId: useMissingStableClaimKey ? undefined : candidateGroupId,
        claimAdmissionAssessmentRef: sameRunFixture.claim_admission_assessment_ref,
        capacityReservationRefs: sameRunFixture.capacity_reservation_refs,
      },
      sources: [
        {
          sourceId: "thinktank-runtime-helper",
          displayName: "智库报告",
          sourceType: "thinktank_report" as const,
          sourceFamily: "thinktank_institutional_report" as const,
          authorityTier: "proven" as const,
          primarySourceDistance: "primary" as const,
          accessMode: "public" as const,
          costTier: "free" as const,
          reviewStatus: "active" as const,
          bucket: "accepted" as const,
          title: "智库主证 helper",
          summaryCn: "thinktank helper accepted",
          policySignalKind: "thinktank_viewpoint" as const,
          agentRelevanceScore: 0.82,
          agentRelevanceReasons: ["thinktank-runtime-helper"],
        },
      ],
    },
    dispatchContext: sameRunFixture.dispatch_context,
    reservations: sameRunFixture.reservations,
    budgetArbitration: sameRunFixture.budget_arbitration,
    requiresCapacityReservation: true,
  };
}
