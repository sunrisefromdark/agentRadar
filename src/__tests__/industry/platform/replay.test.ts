import { describe, expect, it } from "vitest";
import academicCurrentBundle from "../../../../fixtures/industry/agents/academic-agent/replay/phase1-current-bundle.json" with { type: "json" };
import academicDeliveryManifest from "../../../../fixtures/industry/agents/academic-agent/replay/phase1-delivery-manifest.json" with { type: "json" };
import academicNextActions from "../../../../fixtures/industry/agents/academic-agent/replay/phase1-next-platform-actions.json" with { type: "json" };
import deliveryManifest from "../../../../fixtures/industry/agents/community-news-agent/replay/phase6-delivery-manifest.json" with { type: "json" };
import replayRefs from "../../../../fixtures/industry/agents/community-news-agent/replay/phase6-replay-refs.json" with { type: "json" };
import { crossGroupIntegrationReadiness } from "../../../cli.ts";
import { buildCrossGroupIntegrationReadiness } from "../../../industry/platform/audit/crossGroupIntegrationReadiness.ts";
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

  it("advances ready groups into the cross-group integration backlog without unlocking weekly output", () => {
    const result = buildCrossGroupIntegrationReadiness({
      date: "2026-06-26",
      generatedAt: "2026-06-28T12:00:00+08:00",
      rootDir: process.cwd(),
      academic: {
        bundle: academicCurrentBundle,
        deliveryManifest: academicDeliveryManifest,
        nextActions: academicNextActions,
      },
      productEcosystem: {
        deliveryManifest,
        replayRefs,
      },
    });

    expect(result).toMatchObject({
      artifact_kind: "cross_group_integration_readiness",
      status: "phase3_backlog_ready",
      ready_group_count: 3,
      weekly_output_ready: false,
      blocked_until: "closed_fact_snapshot_and_audit",
      daily_pack_v2_ready: true,
      rolling_snapshot_ready: true,
      policy_finance: {
        status: "policy_finance_runtime_ready",
        candidate_pool_ready: true,
        negative_reason_code: "dispatch_context_missing",
      },
      academic: {
        status: "normalization_dry_run_ready",
        formal_handoff_ready: true,
        eval_backlog_ready: true,
      },
      product_ecosystem: {
        status: "product_ecosystem_phase6_inputs_accepted",
        eval_backlog_ready: true,
      },
      next_platform_actions: [
        "assemble_cross_group_replay_eval_backlog",
        "start_closed_fact_snapshot",
      ],
      reject_list: [],
    });
  });

  it("exposes cross-group integration readiness through the CLI artifact command", async () => {
    const writes: string[] = [];
    const originalLog = console.log;
    console.log = (text?: unknown) => {
      if (typeof text === "string") writes.push(text);
    };
    try {
      await crossGroupIntegrationReadiness({
        date: "2026-06-26",
        dryRun: true,
        enrichGithub: true,
        includeAgentsRadar: true,
        includeTrendshift: true,
        configPath: "config.yaml",
      });
    } finally {
      console.log = originalLog;
    }

    expect(JSON.parse(writes.at(-1) ?? "{}")).toMatchObject({
      artifact_kind: "cross_group_integration_readiness",
      status: "phase3_backlog_ready",
      weekly_output_ready: false,
      daily_pack_v2_ready: true,
      rolling_snapshot_ready: true,
    });
  });
});
