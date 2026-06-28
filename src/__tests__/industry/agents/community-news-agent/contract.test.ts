import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import deliveryManifest from "../../../../../fixtures/industry/agents/community-news-agent/replay/phase6-delivery-manifest.json" with { type: "json" };
import replayRefs from "../../../../../fixtures/industry/agents/community-news-agent/replay/phase6-replay-refs.json" with { type: "json" };
import {
  buildProductEcosystemFormalHandoff,
  type ProductEcosystemFormalHandoffBundle,
  validateProductEcosystemFormalHandoff,
} from "../../../../industry/agents/community-news-agent/formalHandoff.ts";
import { buildProductEcosystemHandoff } from "../../../../industry/agents/community-news-agent/handoff.ts";
import { consumeProductEcosystemHandoffForDryRun } from "../../../../industry/platform/normalization/productEcosystemDryRun.ts";
import { loadIndustrySchemaRegistry } from "../../../../industry/platform/contracts/schemaRegistry.ts";

function buildContractInput() {
  const base = {
    runId: "run-ecosystem-contract",
    threadId: "thread-ecosystem-contract",
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

describe("product ecosystem handoff draft", () => {
  it("builds five coverage refs, six contribution refs, and light daily input", () => {
    const result = buildProductEcosystemHandoff(buildContractInput());
    const daily = result.dailyInput.payload;

    expect(daily.coverage_refs).toHaveLength(5);
    expect(daily.contribution_refs).toHaveLength(6);
    expect(daily.normalized_event_batch_refs).toHaveLength(6);
    expect(daily.rejected_event_batch_refs).toHaveLength(6);
    expect(daily.normalized_event_batch_refs).toContain(result.cnCommunity.accepted.manifest.artifact_ref);
    expect(daily.normalized_event_batch_refs).toContain(result.globalCommunity.accepted.manifest.artifact_ref);
    expect(daily.source_message_ids).toContain(result.newsPr.diagnostic.envelope.message_id);
    expect(daily.source_message_ids).toContain(result.newsPr.counter.envelope.message_id);
    expect(daily).not.toHaveProperty("events");
    expect(result.communityDiscussion.coverage.payload.report.accepted_ref_count).toBe(2);
    expect(result.newsPr.accepted.payload.events).toHaveLength(0);
    expect(result.newsPr.diagnostic.payload.events).toHaveLength(1);
  });
});

describe("product ecosystem formal handoff freeze", () => {
  it("publishes a Phase6 delivery manifest with complete owner, anti-upgrade, noise, propagation, and replay refs", () => {
    const manifest = deliveryManifest as Record<string, unknown>;
    const fixtures = manifest.supporting_fixture_refs as Record<string, string[]>;
    const expectedFixtureGroups = ["owner_boundary", "anti_upgrade", "community_noise_negative", "propagation", "replay"];

    expect(manifest.manifest_id).toBe("product-ecosystem-phase6-delivery-manifest.v1");
    expect(manifest.product_ecosystem_inputs_complete_for_executor_4_phase6).toBe(true);
    expect(Object.keys(fixtures).sort()).toEqual(expectedFixtureGroups.sort());
    expect(fixtures.owner_boundary).toHaveLength(2);
    expect(fixtures.anti_upgrade).toHaveLength(3);
    expect(fixtures.community_noise_negative).toEqual([
      "fixtures/industry/agents/community-news-agent/anti-upgrade/community-noise-seo-content.json",
    ]);
    expect(fixtures.propagation).toHaveLength(2);
    expect(fixtures.replay).toEqual(["fixtures/industry/agents/community-news-agent/replay/phase6-replay-refs.json"]);
    expect(manifest.expected_platform_gates).toMatchObject({
      formal_bundle: "normalization_dry_run_ready",
      invalid_governance_profile: "dry_run_rejected",
      claim_critical_missing_same_run_refs: "dispatch_context_missing",
    });

    for (const ref of [
      ...manifestPathValues(manifest.stable_entrypoints),
      ...manifestPathValues(manifest.platform_consumers),
      ...manifestPathValues(manifest.test_entrypoints),
      ...Object.values(fixtures).flat(),
    ]) {
      expect(fs.existsSync(path.join(process.cwd(), ref)), ref).toBe(true);
    }
  });

  it("publishes Phase6 replay refs that point to existing negative and propagation fixtures", () => {
    const refs = replayRefs as { replay_windows: Array<{ fixture_refs: string[]; test_entrypoint: string }> };

    expect(refs.replay_windows.map((item) => item.fixture_refs).flat()).toEqual(
      expect.arrayContaining([
        "fixtures/industry/agents/product-oss-agent/owner-boundary/vendor-blog-repo-update.json",
        "fixtures/industry/agents/product-oss-agent/anti-upgrade/vendor-blog-mentioned-repo.json",
        "fixtures/industry/agents/product-oss-agent/propagation/official-release-news-retell.json",
        "fixtures/industry/agents/community-news-agent/owner-boundary/community-post-news-retell.json",
        "fixtures/industry/agents/community-news-agent/propagation/news-retells-community-thread.json",
        "fixtures/industry/agents/community-news-agent/anti-upgrade/news-pr-heat-without-core.json",
        "fixtures/industry/agents/community-news-agent/anti-upgrade/community-noise-seo-content.json",
      ]),
    );

    for (const window of refs.replay_windows) {
      expect(fs.existsSync(path.join(process.cwd(), window.test_entrypoint)), window.test_entrypoint).toBe(true);
      for (const ref of window.fixture_refs) {
        expect(fs.existsSync(path.join(process.cwd(), ref)), ref).toBe(true);
      }
    }
  });

  it("accepts the current formal bundle for dry-run consumption", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());
    const daily = bundle.payloads.find((payload) => payload.payload_schema === "daily-industry-evidence-pack-input.v1");

    expect(validateProductEcosystemFormalHandoff(loadIndustrySchemaRegistry(), bundle)).toEqual({
      ok: true,
      status: "accepted_for_dry_run",
    });
    expect(bundle.messages.every((message) => typeof message.payload_ref === "string" && message.payload_ref.startsWith("industry://internal/"))).toBe(true);
    expect(bundle.payloads.filter((payload) => payload.payload_schema === "axis-tool-coverage-report.v1")).toHaveLength(5);
    expect(bundle.payloads.filter((payload) => payload.payload_schema === "industry-agent-contribution.v1")).toHaveLength(6);
    expect(daily?.coverage_refs).toHaveLength(5);
    expect(daily?.contribution_refs).toHaveLength(6);
    expect(daily).not.toHaveProperty("events");
    expect(daily).not.toHaveProperty("accepted_events");
    expect(daily).not.toHaveProperty("rejected_events");
  });

  it("keeps the formal bundle consumable by platform normalization dry-run", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());

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
      feedbackPayloadSchema: "normalization-feedback.v1",
      feedbackPayload: {
        payload_schema: "normalization-feedback.v1",
        feedback_status: "dry_run_ready",
      },
      runtimeSnapshot: {
        ok: true,
        status: "runtime_snapshot_published",
      },
    });
    if (result.ok) {
      expect(result.normalizedEventBatchRefs).toHaveLength(6);
      expect(result.rejectedEventBatchRefs).toHaveLength(6);
      expect(result.coverageRefs).toHaveLength(5);
      expect(result.contributionRefs).toHaveLength(6);
    }
  });

  it("keeps rejected normalization feedback visible for unresolved governance refs", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());
    const brokenBundle = clone(bundle);
    const coverage = brokenBundle.payloads.find((payload) => payload.payload_schema === "axis-tool-coverage-report.v1");
    if (coverage && typeof coverage.budget_status === "object" && coverage.budget_status !== null) {
      (coverage.budget_status as Record<string, unknown>).profile_id = "product-ecosystem-formal-handoff.v1";
    }

    expect(consumeProductEcosystemHandoffForDryRun({ bundle: brokenBundle })).toMatchObject({
      ok: false,
      reasonCode: "schema_mismatch",
      feedbackPayloadSchema: "normalization-feedback.v1",
      feedbackPayload: {
        payload_schema: "normalization-feedback.v1",
        feedback_status: "dry_run_rejected",
        feedback_ext: {
          reason_code: "schema_mismatch",
        },
      },
    });
  });

  it("rejects claim-critical product ecosystem messages without same-run dispatch refs", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());
    const claimCriticalBundle = clone(bundle);
    claimCriticalBundle.messages[0] = {
      ...claimCriticalBundle.messages[0],
      capability_class: "claim-critical",
    };

    expect(consumeProductEcosystemHandoffForDryRun({ bundle: claimCriticalBundle })).toMatchObject({
      ok: false,
      reasonCode: "dispatch_context_missing",
      feedbackPayloadSchema: "normalization-feedback.v1",
      feedbackPayload: {
        payload_schema: "normalization-feedback.v1",
        feedback_status: "dry_run_rejected",
        feedback_ext: {
          reason_code: "dispatch_context_missing",
        },
      },
    });
  });

  it("accepts previous compatible same-major producer versions", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());
    const registry = clone(loadIndustrySchemaRegistry());
    const formalSchemas = new Set([
      "industry-signal-event-batch.v1",
      "axis-tool-coverage-report.v1",
      "industry-agent-contribution.v1",
      "daily-industry-evidence-pack-input.v1",
    ]);

    for (const entry of registry.compatibility.entries) {
      if (formalSchemas.has(entry.schema_id)) entry.current_version = "1.1.0";
    }

    expect(validateProductEcosystemFormalHandoff(registry, bundle)).toEqual({
      ok: true,
      status: "accepted_for_dry_run",
    });
  });

  it("rejects unknown higher-major producer versions", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());
    const higherMajorBundle = clone(bundle);
    higherMajorBundle.payloads[0].schema_version = "2.0.0";

    expect(validateProductEcosystemFormalHandoff(loadIndustrySchemaRegistry(), higherMajorBundle)).toMatchObject({
      ok: false,
      reasonCode: "unsupported_version",
    });
  });

  it("rejects daily refs that are missing from manifest and artifact refs", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());
    const missingRefBundle = clone(bundle);
    const daily = missingRefBundle.payloads.find((payload) => payload.payload_schema === "daily-industry-evidence-pack-input.v1");
    const missingRef = Array.isArray(daily?.coverage_refs) ? daily.coverage_refs[0] : "";

    missingRefBundle.manifests = missingRefBundle.manifests.filter((manifest) => manifest.artifact_ref !== missingRef);
    missingRefBundle.artifactRefs = missingRefBundle.artifactRefs.filter((artifactRef) => artifactRef !== missingRef);

    expect(validateProductEcosystemFormalHandoff(loadIndustrySchemaRegistry(), missingRefBundle)).toMatchObject({
      ok: false,
      reasonCode: "lineage_failed",
    });
  });

  it("rejects formal bundles with a missing payload", () => {
    const { bundle } = buildProductEcosystemFormalHandoff(buildContractInput());
    const missingPayloadBundle: ProductEcosystemFormalHandoffBundle = {
      ...clone(bundle),
      payloads: bundle.payloads.slice(1),
    };

    expect(validateProductEcosystemFormalHandoff(loadIndustrySchemaRegistry(), missingPayloadBundle)).toMatchObject({
      ok: false,
      reasonCode: "lineage_failed",
    });
  });
});

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function manifestPathValues(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).filter((item): item is string => typeof item === "string");
}
