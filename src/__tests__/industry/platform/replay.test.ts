import { describe, expect, it } from "vitest";
import deliveryManifest from "../../../../fixtures/industry/agents/community-news-agent/replay/phase6-delivery-manifest.json" with { type: "json" };
import replayRefs from "../../../../fixtures/industry/agents/community-news-agent/replay/phase6-replay-refs.json" with { type: "json" };
import { assembleProductEcosystemPhase6Inputs } from "../../../industry/platform/audit/productEcosystemPhase6Assembly.ts";

describe("industry platform Phase 6 replay assembly", () => {
  it("accepts product ecosystem Phase 6 assets while blocking weekly output until cross-group inputs arrive", () => {
    const result = assembleProductEcosystemPhase6Inputs({
      deliveryManifest,
      replayRefs,
      rootDir: process.cwd(),
    });

    expect(result).toMatchObject({
      ok: true,
      status: "product_ecosystem_phase6_inputs_accepted",
      scope: "product-ecosystem-community-news",
      platformGates: {
        formalBundle: "normalization_dry_run_ready",
        invalidGovernanceProfile: "dry_run_rejected",
        claimCriticalMissingSameRunRefs: "dispatch_context_missing",
      },
      crossGroupReady: false,
      weeklyOutputReady: false,
      blockedUntil: "three_group_phase6_assets",
    });

    if (result.ok) {
      expect(result.replayWindowIds).toEqual([
        "product-oss-release-owner-boundary",
        "community-news-owner-boundary",
        "community-news-pr-anti-upgrade",
        "community-noise-anti-upgrade",
      ]);
      expect(result.supportingFixtureRefs).toHaveLength(8);
      expect(result.replayFixtureRefs).toHaveLength(7);
      expect(result.platformConsumerRefs).toEqual(["src/industry/platform/normalization/productEcosystemDryRun.ts"]);
    }
  });

  it("rejects product ecosystem Phase 6 assembly when the dry-run gates are incomplete", () => {
    const brokenManifest = structuredClone(deliveryManifest);
    delete (brokenManifest.expected_platform_gates as Record<string, unknown>).claim_critical_missing_same_run_refs;

    expect(
      assembleProductEcosystemPhase6Inputs({
        deliveryManifest: brokenManifest,
        replayRefs,
        rootDir: process.cwd(),
      }),
    ).toMatchObject({
      ok: false,
      reasonCode: "schema_mismatch",
    });
  });
});
