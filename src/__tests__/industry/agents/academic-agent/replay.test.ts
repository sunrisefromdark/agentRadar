import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildAcademicHandoffBundle,
  buildAcademicPrepBundle,
} from "../../../../industry/agents/academic-agent/handoff.ts";
import type { ReplayWindowFixture } from "../../../../industry/agents/academic-agent/types.ts";
import currentBundleFixture from "../../../../../fixtures/industry/agents/academic-agent/replay/phase1-current-bundle.json" with { type: "json" };
import negativeBundleFixture from "../../../../../fixtures/industry/agents/academic-agent/replay/phase1-missing-owner-boundary-bundle.json" with { type: "json" };
import deliveryManifestFixture from "../../../../../fixtures/industry/agents/academic-agent/replay/phase1-delivery-manifest.json" with { type: "json" };
import nextPlatformActionsFixture from "../../../../../fixtures/industry/agents/academic-agent/replay/phase1-next-platform-actions.json" with { type: "json" };
import deliveryChecksumsFixture from "../../../../../fixtures/industry/agents/academic-agent/replay/phase1-delivery-checksums.json" with { type: "json" };
import { validateAcademicHandoff } from "../../../../industry/platform/contracts/academicHandoff.ts";
import { loadIndustrySchemaRegistry } from "../../../../industry/platform/contracts/schemaRegistry.ts";

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
}

describe("academic-agent replay", () => {
  it("replays a historical window into daily handoff inputs", () => {
    const fixture = readJson<ReplayWindowFixture>(
      "fixtures/industry/agents/academic-agent/replay/academic-replay-window.json",
    );
    const bundle = buildAcademicPrepBundle(fixture);

    expect(bundle.events.length).toBeGreaterThanOrEqual(4);
    expect(bundle.daily_input.payload.source_message_ids).toHaveLength(8);
    expect(bundle.daily_input.manifest.summary_cn).toContain("daily");
  });

  it("publishes a machine-readable current bundle fixture for middle-platform dry-run", () => {
    const fixture = readJson<ReplayWindowFixture>(
      "fixtures/industry/agents/academic-agent/replay/academic-replay-window.json",
    );
    const bundle = buildAcademicHandoffBundle(fixture);

    expect(currentBundleFixture.messages).toHaveLength(13);
    expect(currentBundleFixture.manifests).toHaveLength(13);
    expect(currentBundleFixture.payloads).toHaveLength(13);
    expect(currentBundleFixture.artifactRefs).toHaveLength(13);
    expect(currentBundleFixture.positiveCanonicalFixtureRefs).toEqual(bundle.positiveCanonicalFixtureRefs);
    expect(currentBundleFixture.nearBoundaryFixtureRefs).toEqual(bundle.nearBoundaryFixtureRefs);
    expect(currentBundleFixture.replayFixtureRefs).toEqual(bundle.replayFixtureRefs);
    expect(currentBundleFixture.evalFixtureRefs).toEqual(bundle.evalFixtureRefs);
    expect(currentBundleFixture.ownerBoundaryFixtureRefs).toEqual(bundle.ownerBoundaryFixtureRefs);
    expect(validateAcademicHandoff(loadIndustrySchemaRegistry(), currentBundleFixture)).toEqual({
      ok: true,
      status: "accepted_for_dry_run",
    });
  });

  it("publishes a machine-readable negative bundle fixture for missing owner-boundary refs", () => {
    expect(negativeBundleFixture.messages).toHaveLength(13);
    expect(negativeBundleFixture.manifests).toHaveLength(13);
    expect(negativeBundleFixture.payloads).toHaveLength(13);
    expect(negativeBundleFixture.artifactRefs).toHaveLength(13);
    expect(negativeBundleFixture.positiveCanonicalFixtureRefs).toEqual([
      "fixtures/industry/agents/academic-agent/eval/positive-canonical-paper.json",
    ]);
    expect(negativeBundleFixture.nearBoundaryFixtureRefs).toEqual([
      "fixtures/industry/agents/academic-agent/eval/near-boundary-leaderboard.json",
    ]);
    expect(negativeBundleFixture.ownerBoundaryFixtureRefs).toEqual([]);
    expect(validateAcademicHandoff(loadIndustrySchemaRegistry(), negativeBundleFixture)).toMatchObject({
      ok: false,
      reasonCode: "lineage_failed",
    });
  });

  it("publishes a machine-readable delivery manifest for executor 4", () => {
    const root = process.cwd();
    expect(deliveryManifestFixture.academic_inputs_complete_for_executor_4).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.stable_entrypoints.academic_agent_index))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.platform_consumers.normalization_dry_run))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.bundle_fixtures.current))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.bundle_fixtures.negative_missing_owner_boundary))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.supporting_fixture_refs.positive_canonical[0]))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.supporting_fixture_refs.near_boundary[0]))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.supporting_fixture_refs.replay_window[0]))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.supporting_fixture_refs.eval[0]))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.supporting_fixture_refs.owner_boundary[0]))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.notes.handoff))).toBe(true);
    expect(validateAcademicHandoff(loadIndustrySchemaRegistry(), currentBundleFixture)).toMatchObject({
      ok: true,
      status: deliveryManifestFixture.expected_platform_gates.current_bundle,
    });
    expect(validateAcademicHandoff(loadIndustrySchemaRegistry(), negativeBundleFixture)).toMatchObject({
      ok: false,
      reasonCode: deliveryManifestFixture.expected_platform_gates.negative_bundle,
    });
  });

  it("publishes a machine-readable next-actions manifest for executor 4", () => {
    const root = process.cwd();
    expect(nextPlatformActionsFixture.status).toBe("academic_formal_handoff_ready");
    expect(nextPlatformActionsFixture.executor_4_can_continue_phase2_partial_without_more_academic_inputs).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.delivery_manifest))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.current_bundle))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.negative_bundle))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.positive_canonical))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.near_boundary))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.replay_window))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.eval))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.owner_boundary))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.handoff_note))).toBe(true);
    expect(fs.existsSync(path.join(root, nextPlatformActionsFixture.ready_inputs.normalization_dry_run))).toBe(true);
    expect(nextPlatformActionsFixture.remaining_platform_actions.map((action: { action: string }) => action.action)).toEqual([
      "consume_current_bundle_for_dry_run",
      "wire_academic_eval_assets_into_phase6_backlog",
    ]);
  });

  it("publishes delivery checksums for executor 4 to verify consumed inputs", () => {
    const root = process.cwd();
    expect(deliveryChecksumsFixture.algorithm).toBe("sha256");
    expect(deliveryChecksumsFixture.entries).toHaveLength(11);
    for (const entry of deliveryChecksumsFixture.entries as Array<{ path: string; sha256: string }>) {
      const filePath = path.join(root, entry.path);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
      const content = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
      expect(crypto.createHash("sha256").update(content, "utf8").digest("hex")).toBe(entry.sha256);
    }
  });
});
