import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAcademicHandoffBundle,
  buildAcademicPrepBundle,
} from "../../../../industry/agents/academic-agent/handoff.ts";
import type { ReplayWindowFixture } from "../../../../industry/agents/academic-agent/types.ts";
import currentBundleFixture from "../../../../../fixtures/industry/agents/academic-agent/replay/phase1-current-bundle.json" with { type: "json" };
import negativeBundleFixture from "../../../../../fixtures/industry/agents/academic-agent/replay/phase1-missing-owner-boundary-bundle.json" with { type: "json" };
import deliveryManifestFixture from "../../../../../fixtures/industry/agents/academic-agent/replay/phase1-delivery-manifest.json" with { type: "json" };
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
    expect(negativeBundleFixture.ownerBoundaryFixtureRefs).toEqual([]);
    expect(validateAcademicHandoff(loadIndustrySchemaRegistry(), negativeBundleFixture)).toMatchObject({
      ok: false,
      reasonCode: "lineage_failed",
    });
  });

  it("publishes a machine-readable delivery manifest for executor 4", () => {
    const root = process.cwd();
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.stable_entrypoints.academic_agent_index))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.bundle_fixtures.current))).toBe(true);
    expect(fs.existsSync(path.join(root, deliveryManifestFixture.bundle_fixtures.negative_missing_owner_boundary))).toBe(true);
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
});
