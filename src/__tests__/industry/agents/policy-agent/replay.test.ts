import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildPolicyFinanceGroupHandoff } from "../../../../industry/agents/policy-agent/index.ts";
import replayBundleFixture from "../../../../../fixtures/industry/agents/policy-agent/replay/phase1-current-bundle.json" with { type: "json" };
import negativeBundleFixture from "../../../../../fixtures/industry/agents/policy-agent/replay/phase1-missing-stable-claim-key-bundle.json" with { type: "json" };
import deliveryManifestFixture from "../../../../../fixtures/industry/agents/policy-agent/replay/phase1-delivery-manifest.json" with { type: "json" };
import nextPlatformActionsFixture from "../../../../../fixtures/industry/agents/policy-agent/replay/phase1-next-platform-actions.json" with { type: "json" };
import deliveryChecksumsFixture from "../../../../../fixtures/industry/agents/policy-agent/replay/phase1-delivery-checksums.json" with { type: "json" };
import { validateFinancePolicyHandoff } from "../../../../industry/platform/contracts/financePolicyHandoff.ts";
import { loadIndustrySchemaRegistry } from "../../../../industry/platform/contracts/schemaRegistry.ts";
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
            authorityTier: "core",
            primarySourceDistance: "primary",
            bucket: "accepted",
            title: "资本主证 replay",
            summaryCn: "finance accepted replay",
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
            authorityTier: "core",
            primarySourceDistance: "primary",
            bucket: "accepted",
            title: "监管主证 replay",
            summaryCn: "regulatory accepted replay",
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
            authorityTier: "proven",
            primarySourceDistance: "primary",
            bucket: "accepted",
            title: "智库主证 replay",
            summaryCn: "thinktank accepted replay",
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
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.stable_entrypoints.policy_agent_index))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.stable_entrypoints.finance_agent_index))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.bundle_fixtures.current))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.bundle_fixtures.negative_missing_stable_claim_key))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.same_run_fixtures.current))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.same_run_fixtures.negative_missing_stable_claim_key))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.notes.handoff))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.notes.shared_runtime))).toBe(true);
    expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), replayBundleFixture)).toMatchObject({
      ok: true,
      status: deliveryManifestFixture.expected_platform_gates.current_bundle,
    });
    expect(validateFinancePolicyHandoff(loadIndustrySchemaRegistry(), negativeBundleFixture)).toMatchObject({
      ok: false,
      reasonCode: deliveryManifestFixture.expected_platform_gates.negative_bundle,
    });
  });

  it("publishes a machine-readable next-actions manifest for executor 4", () => {
    const root = process.cwd();
    expect(nextPlatformActionsFixture.status).toBe("waiting_for_executor_4");
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.delivery_manifest))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.current_bundle))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.negative_bundle))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.handoff_note))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.shared_runtime_note))).toBe(true);
    expect(nextPlatformActionsFixture.required_platform_actions).toHaveLength(3);
  });

  it("publishes delivery checksums for executor 4 to verify consumed inputs", () => {
    const root = process.cwd();
    expect(deliveryChecksumsFixture.algorithm).toBe("sha256");
    expect(deliveryChecksumsFixture.entries).toHaveLength(10);
    for (const entry of deliveryChecksumsFixture.entries) {
      expect(fs.existsSync(path.join(root, entry.path))).toBe(true);
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
