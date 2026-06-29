import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import academicCurrentBundle from "../../../../fixtures/industry/agents/academic-agent/replay/phase1-current-bundle.json" with { type: "json" };
import academicDeliveryManifest from "../../../../fixtures/industry/agents/academic-agent/replay/phase1-delivery-manifest.json" with { type: "json" };
import academicNextActions from "../../../../fixtures/industry/agents/academic-agent/replay/phase1-next-platform-actions.json" with { type: "json" };
import deliveryManifest from "../../../../fixtures/industry/agents/community-news-agent/replay/phase6-delivery-manifest.json" with { type: "json" };
import replayRefs from "../../../../fixtures/industry/agents/community-news-agent/replay/phase6-replay-refs.json" with { type: "json" };
import { crossGroupIntegrationReadiness } from "../../../cli.ts";
import {
  buildCrossGroupIntegrationReadiness,
  materializeCrossGroupIntegrationArtifacts,
} from "../../../industry/platform/audit/crossGroupIntegrationReadiness.ts";
import { assembleProductEcosystemPhase6Inputs } from "../../../industry/platform/audit/productEcosystemPhase6Assembly.ts";

describe("industry platform Phase 6 replay assembly", () => {
  it("freezes the platform-owned Phase 6 eval cases required by the diff audit", () => {
    for (const relativePath of [
      "fixtures/industry/platform/eval/coverage-vs-tier-case.json",
      "fixtures/industry/platform/eval/counter-override-case.json",
    ]) {
      const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8"));

      expect(fixture).toMatchObject({
        schema_version: "trend-decision-eval-case.v1",
        input_claim_or_events_ref: expect.any(String),
        expected_decision_tier: expect.any(String),
        expected_main_pillar_axes: expect.any(Array),
        expected_independent_confirmation_axes: expect.any(Array),
        expected_missing_axes: expect.any(Array),
        expected_counter_outcome: expect.any(String),
        must_not_be: expect.any(Array),
        explanation_assertions: expect.any(Array),
      });
      expect(["coverage_vs_tier_case", "counter_override_case"]).toContain(fixture.case_family);
      expect(fixture.must_not_be.length).toBeGreaterThan(0);
      expect(fixture.explanation_assertions.length).toBeGreaterThan(0);
    }
  });

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
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "industry-no-window-"));
    fs.cpSync(path.join(process.cwd(), "fixtures"), path.join(rootDir, "fixtures"), { recursive: true });
    const sourceRefs = [
      ...Object.values(deliveryManifest.stable_entrypoints),
      ...Object.values(deliveryManifest.platform_consumers),
      ...Object.values(deliveryManifest.test_entrypoints),
    ].filter((ref): ref is string => typeof ref === "string");
    for (const ref of sourceRefs) {
      const filepath = path.join(rootDir, ref);
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, "");
    }
    const result = buildCrossGroupIntegrationReadiness({
      date: "2026-06-26",
      generatedAt: "2026-06-28T12:00:00+08:00",
      rootDir,
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
    fs.rmSync(rootDir, { force: true, recursive: true });

    expect(result).toMatchObject({
      artifact_kind: "cross_group_integration_readiness",
      status: "phase5_internal_weekly_ready",
      ready_group_count: 3,
      weekly_output_ready: false,
      blocked_until: "public_projection_after_evidence_window_recovery",
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
      platform_continuation: {
        can_continue_without_more_academic_inputs: true,
        blocked_until: "public_projection_after_evidence_window_recovery",
        next_required_owner: "executor_4",
      },
      academic_feedback: {
        payload_schema: "normalization-feedback.v1",
        feedback_status: "dry_run_ready",
      },
      replay_eval_backlog: {
        status: "ready",
        group_count: 3,
        policy_finance_fixture_refs: expect.arrayContaining([
          "fixtures/industry/agents/policy-agent/replay/phase1-current-bundle.json",
          "fixtures/industry/agents/policy-agent/replay/phase1-missing-stable-claim-key-bundle.json",
          "fixtures/industry/agents/policy-agent/compatibility/same-run-missing-stable-claim-key-negative.json",
          "fixtures/industry/platform/negative/phase1-runtime.json",
        ]),
        academic_fixture_refs: [
          "fixtures/industry/agents/academic-agent/eval/positive-canonical-paper.json",
          "fixtures/industry/agents/academic-agent/eval/near-boundary-leaderboard.json",
          "fixtures/industry/agents/academic-agent/replay/academic-replay-window.json",
          "fixtures/industry/agents/academic-agent/eval/anti-upgrade-preprint.json",
          "fixtures/industry/agents/academic-agent/owner-boundary/news-relays-paper.json",
        ],
        product_ecosystem_fixture_refs: expect.arrayContaining([
          "fixtures/industry/agents/product-oss-agent/owner-boundary/vendor-blog-repo-update.json",
          "fixtures/industry/agents/community-news-agent/anti-upgrade/news-pr-heat-without-core.json",
        ]),
        product_replay_window_ids: [
          "product-oss-release-owner-boundary",
          "community-news-owner-boundary",
          "community-news-pr-anti-upgrade",
          "community-noise-anti-upgrade",
        ],
        eval_case_coverage: expect.arrayContaining([
          expect.objectContaining({
            case_family: "positive_canonical_case",
            status: "ready",
          }),
          expect.objectContaining({
            case_family: "near_boundary_case",
            status: "ready",
          }),
          expect.objectContaining({
            case_family: "anti_upgrade_case",
            status: "ready",
          }),
          expect.objectContaining({
            case_family: "coverage_vs_tier_case",
            status: "ready",
            fixture_refs: ["fixtures/industry/platform/eval/coverage-vs-tier-case.json"],
          }),
          expect.objectContaining({
            case_family: "counter_override_case",
            status: "ready",
            fixture_refs: ["fixtures/industry/platform/eval/counter-override-case.json"],
          }),
        ]),
        blocked_eval_case_families: [],
        decision_diff_audit_status: "ready",
        decision_diff_audit: {
          audit_id: "decision-diff-audit-2026-06-26",
          schema_version: "decision-diff-audit.v1",
          profile_change_set: ["phase6-eval-coverage-freeze.v1"],
          compared_run_ids: ["cross-group-2026-06-26-baseline", "cross-group-2026-06-26-phase6-eval"],
          tier_changed_claim_ids: [],
          confidence_changed_claim_ids: ["claim-coverage-vs-tier-platform-fixture"],
          coverage_state_changed_claim_ids: ["claim-coverage-vs-tier-platform-fixture"],
          expected_repairs: [
            "coverage_vs_tier_case keeps tier stable while lowering confidence when coverage is incomplete",
            "counter_override_case blocks over-promotion when strong counter evidence exists",
          ],
          unexpected_regressions: [],
          anti_overpromotion_regressions: [],
          stability_regressions: [],
        },
      },
      closed_fact_snapshot_prep: {
        status: "ready_to_start",
        fact_snapshot_ref: "industry://internal/2026-06-26/fact-snapshot.v1/pending",
        fact_resolution_audit_ref: expect.stringContaining("fact-resolution-audit.v1"),
      },
      closed_fact_snapshot: {
        status: "closed",
        claim_builder_input_ready: true,
        weekly_output_ready: false,
        fact_resolution_audit: {
          schema_version: "fact-resolution-audit.v1",
          snapshot_id: "fact-snapshot-2026-06-26",
          event_fact_assignments: expect.arrayContaining([
            expect.objectContaining({
              event_id: "paper-agent-memory-preprint",
              fact_resolution_state: "canonical",
              resolution_basis_codes: expect.arrayContaining(["academic_formal_handoff"]),
            }),
            expect.objectContaining({
              resolution_basis_codes: expect.arrayContaining(["policy_finance_runtime_ready"]),
            }),
            expect.objectContaining({
              resolution_basis_codes: expect.arrayContaining(["product_ecosystem_phase6_inputs_accepted"]),
            }),
          ]),
          relation_edges: [],
          high_impact_unresolved_groups: expect.any(Array),
        },
      },
      claim_builder: {
        status: "ready",
        candidate_batch: {
          payload_schema: "claim-candidate-batch.v1",
          input_event_ids: expect.arrayContaining(["paper-agent-memory-preprint"]),
          generated_claim_ids: expect.arrayContaining(["claim-paper-agent-memory-preprint"]),
          rejected_event_ids: [],
        },
        evidence_links: expect.arrayContaining([
          expect.objectContaining({
            claim_id: "claim-paper-agent-memory-preprint",
            event_id: "paper-agent-memory-preprint",
          }),
        ]),
      },
      counter_evidence_audit: {
        status: "passed",
        audit_request: {
          payload_schema: "audit-request.v1",
          supporting_event_ids: expect.arrayContaining(["paper-agent-memory-preprint"]),
          counter_event_ids: [],
        },
        audit_result: {
          payload_schema: "audit-result.v1",
          blocking_claim_candidate_ids: [],
          high_impact_unresolved_group_ids: [],
        },
        counter_evidence_audit: {
          schema_version: "counter-evidence-audit.v1",
          decision_state: "passed",
          blocking_counter_evidence: [],
        },
      },
      tier_decision_prep: {
        status: "ready_to_start",
        blocked_until: "tier_decision_and_weekly_packaging",
        missing_required_group_params: [],
      },
      recent_7d_evidence_window: {
        status: "missing",
        required_dates: [
          "2026-06-20",
          "2026-06-21",
          "2026-06-22",
          "2026-06-23",
          "2026-06-24",
          "2026-06-25",
          "2026-06-26",
        ],
        present_daily_pack_refs: expect.arrayContaining([
          expect.stringContaining("industry://internal/2026-06-26/daily-industry-evidence-pack.v2/"),
        ]),
        missing_daily_pack_dates: [
          "2026-06-20",
          "2026-06-21",
          "2026-06-22",
          "2026-06-23",
          "2026-06-24",
          "2026-06-25",
        ],
        usable_day_count: 1,
        missing_day_count: 6,
        recent_3d_usable_day_count: 1,
      },
      tier_profile_rules: {
        status: "ready",
        profile_refs: expect.arrayContaining([
          "docs/specs/design-docs/行业级Agent趋势判断设计/04-评分裁决与证据归一.md#claim-archetype-decision-profile.v1",
          "docs/specs/design-docs/行业级Agent趋势判断设计/03-数据模型契约.md#axis-status-threshold-profile.v1",
          "docs/specs/design-docs/行业级Agent趋势判断设计/04-评分裁决与证据归一.md#independence-credit-profile.v1",
        ]),
      },
      decision_context_artifact: {
        status: "ready",
        artifact: {
          schema_version: "decision-context-artifact.v1",
          claim_candidate_batch_ref: "industry://internal/2026-06-26/claim-candidate-batch.v1/cross-group",
          audit_result_refs: expect.arrayContaining(["audit-result-2026-06-26"]),
          missing_context_reason_codes: [],
        },
      },
      tier_decision_input: {
        status: "ready",
        payload: {
          payload_schema: "trend-decision-input.v1",
          claim_candidate_batch_ref: "industry://internal/2026-06-26/claim-candidate-batch.v1/cross-group",
          missing_context_reason_codes: [],
        },
      },
      weekly_packaging: {
        status: "ready",
        internal_weekly_section: {
          schema_version: "weekly-industry-trend-section.v2",
          evidence_window_status: {
            status: "missing",
            usable_day_count: 1,
            missing_day_count: 6,
            recent_3d_usable_day_count: 1,
          },
          publication_readiness_status: {
            status: "blocked",
            blocking_reason_codes: expect.arrayContaining(["missing_recent_7d_evidence_window"]),
          },
          governance_load_status: {
            status: "nominal",
          },
          industry_window_status: {
            status: "missing",
          },
          display_index: {
            headline_core_card_ids: [],
            blocked_public_output_card_ids: expect.any(Array),
          },
        },
        consumer_view: {
          schema_version: "consumer-weekly-industry-view.v1",
          visible_card_ids: expect.any(Array),
          hidden_card_ids: expect.any(Array),
        },
        public_projection: {
          schema_version: "public-weekly-industry-projection.v1",
          headline_core_card_ids: [],
          tier_visible_card_ids: [],
          blocked_card_ids: expect.any(Array),
          blocked_reason_codes: expect.arrayContaining(["public_blocked_until_evidence_window_recovery"]),
        },
      },
      next_platform_actions: [
        "recover_recent_7d_daily_pack_refs_for_public_projection",
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
      status: "phase5_internal_weekly_ready",
      weekly_output_ready: true,
      daily_pack_v2_ready: true,
      rolling_snapshot_ready: true,
    });
  });

  it("counts materialized daily industry evidence packs in the recent evidence window", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "industry-window-"));
    const dates = ["2026-06-20", "2026-06-21", "2026-06-22", "2026-06-24"];
    try {
      fs.cpSync(path.join(process.cwd(), "fixtures"), path.join(rootDir, "fixtures"), { recursive: true });
      const sourceRefs = [
        ...Object.values(deliveryManifest.stable_entrypoints),
        ...Object.values(deliveryManifest.platform_consumers),
        ...Object.values(deliveryManifest.test_entrypoints),
      ].filter((ref): ref is string => typeof ref === "string");
      for (const ref of sourceRefs) {
        const filepath = path.join(rootDir, ref);
        fs.mkdirSync(path.dirname(filepath), { recursive: true });
        fs.writeFileSync(filepath, "");
      }
      for (const date of dates) {
        const dir = path.join(rootDir, "data", "industry", "internal", date, "daily-industry-evidence-pack.v2");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "pack-001.json"), JSON.stringify({ schema_version: "daily-industry-evidence-pack.v2", date }));
      }

      const result = buildCrossGroupIntegrationReadiness({
        date: "2026-06-26",
        generatedAt: "2026-06-28T12:00:00+08:00",
        rootDir,
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

      expect(result.recent_7d_evidence_window).toMatchObject({
        status: "ok",
        usable_day_count: 5,
        missing_daily_pack_dates: ["2026-06-23", "2026-06-25"],
        recent_3d_usable_day_count: 2,
      });
      expect(result.recent_7d_evidence_window.present_daily_pack_refs).toEqual([
        "industry://internal/2026-06-20/daily-industry-evidence-pack.v2/pack-001",
        "industry://internal/2026-06-21/daily-industry-evidence-pack.v2/pack-001",
        "industry://internal/2026-06-22/daily-industry-evidence-pack.v2/pack-001",
        "industry://internal/2026-06-24/daily-industry-evidence-pack.v2/pack-001",
        "industry://internal/2026-06-26/daily-industry-evidence-pack.v2/ref-only",
      ]);
      expect(result.weekly_packaging.internal_weekly_section.publication_readiness_status).toMatchObject({
        status: "ready",
        blocked_card_count: 0,
        blocked_public_artifact_count: 0,
        blocking_reason_codes: [],
      });
      expect(result.weekly_output_ready).toBe(true);
      expect(result.blocked_until).toBe("ready_for_publication");
      expect(result.platform_continuation.blocked_until).toBe("ready_for_publication");
      expect(result.weekly_packaging.internal_weekly_section.lineage_refs.claim_ledger_refs.length).toBeGreaterThan(0);
      expect(result.weekly_packaging.consumer_view.visible_card_ids.length).toBeGreaterThan(0);
      expect(result.weekly_packaging.public_projection.tier_visible_card_ids.length).toBeGreaterThan(0);
      expect(result.weekly_packaging.public_projection.blocked_reason_codes).toEqual([]);
      expect(result.next_platform_actions).toEqual([]);

      const materialized = materializeCrossGroupIntegrationArtifacts({
        rootDir,
        artifact: result,
      });
      expect(materialized.dailyPack).toEqual({
        artifactRef: "industry://internal/2026-06-26/daily-industry-evidence-pack.v2/pack-001",
        storagePath: "data/industry/internal/2026-06-26/daily-industry-evidence-pack.v2/pack-001.json",
      });
      expect(materialized.rollingSnapshot).toEqual({
        artifactRef: "industry://internal/2026-06-26/rolling-evidence-window-snapshot.v1/snapshot-001",
        storagePath: "data/industry/internal/2026-06-26/rolling-evidence-window-snapshot.v1/snapshot-001.json",
      });
      expect(materialized.weeklySection).toEqual({
        artifactRef: "industry://internal/2026-06-26/weekly-industry-trend-section.v2/cross-group",
        storagePath: "data/industry/internal/2026-06-26/weekly-industry-trend-section.v2/cross-group.json",
      });
      expect(materialized.consumerView).toEqual({
        artifactRef: "industry://consumer/2026-06-26/consumer-weekly-industry-view.v1/cross-group",
        storagePath: "data/industry/consumer/2026-06-26/consumer-weekly-industry-view.v1/cross-group.json",
      });
      expect(materialized.publicProjection).toEqual({
        artifactRef: "industry://public/2026-06-26/public-weekly-industry-projection.v1/cross-group",
        storagePath: "data/industry/public/2026-06-26/public-weekly-industry-projection.v1/cross-group.json",
      });
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(rootDir, "data", "industry", "internal", "2026-06-26", "daily-industry-evidence-pack.v2", "pack-001.json"),
            "utf8",
          ),
        ),
      ).toMatchObject({
        schema_version: "daily-industry-evidence-pack.v2",
        date: "2026-06-26",
      });
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(
              rootDir,
              "data",
              "industry",
              "internal",
              "2026-06-26",
              "rolling-evidence-window-snapshot.v1",
              "snapshot-001.json",
            ),
            "utf8",
          ),
        ),
      ).toMatchObject({
        schema_version: "rolling-evidence-window-snapshot.v1",
        snapshot_id: "rolling-evidence-window-2026-06-26",
      });
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(
              rootDir,
              "data",
              "industry",
              "internal",
              "2026-06-26",
              "weekly-industry-trend-section.v2",
              "cross-group.json",
            ),
            "utf8",
          ),
        ),
      ).toMatchObject({
        schema_version: "weekly-industry-trend-section.v2",
        lineage_refs: {
          claim_ledger_refs: expect.any(Array),
        },
      });
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(
              rootDir,
              "data",
              "industry",
              "public",
              "2026-06-26",
              "public-weekly-industry-projection.v1",
              "cross-group.json",
            ),
            "utf8",
          ),
        ),
      ).toMatchObject({
        schema_version: "public-weekly-industry-projection.v1",
        blocked_reason_codes: [],
      });
    } finally {
      fs.rmSync(rootDir, { force: true, recursive: true });
    }
  });
});
