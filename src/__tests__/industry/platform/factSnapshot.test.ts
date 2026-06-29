import { describe, expect, it } from "vitest";
import academicBundle from "../../../../fixtures/industry/agents/academic-agent/replay/phase1-current-bundle.json" with { type: "json" };
import policyBundle from "../../../../fixtures/industry/agents/policy-agent/replay/phase1-current-bundle.json" with { type: "json" };
import { buildProductEcosystemFormalHandoff } from "../../../industry/agents/community-news-agent/formalHandoff.ts";
import { buildClosedFactSnapshot } from "../../../industry/platform/normalization/factSnapshot.ts";

describe("industry platform closed fact snapshot", () => {
  it("closes a full three-group fact snapshot before claim-builder can read it", () => {
    const { bundle: productBundle } = buildProductEcosystemFormalHandoff(buildProductEcosystemInput());
    const result = buildClosedFactSnapshot({
      date: "2026-06-26",
      bundles: [
        { group: "policy_finance", bundle: policyBundle },
        { group: "academic", bundle: academicBundle },
        { group: "product_ecosystem", bundle: productBundle },
      ],
    });

    expect(result).toMatchObject({
      status: "closed",
      snapshot_id: "fact-snapshot-2026-06-26",
      claim_builder_input_ready: true,
      weekly_output_ready: false,
      source_chain_dedupe_batch: {
        status: "deduped",
        input_group_count: 3,
        duplicate_event_count: 0,
      },
      owner_transfer_artifact: {
        schema_version: "owner-transfer-artifact.v1",
        status: "closed",
      },
      fact_resolution_audit: {
        schema_version: "fact-resolution-audit.v1",
        snapshot_id: "fact-snapshot-2026-06-26",
        high_impact_unresolved_groups: [],
      },
    });
    expect(result.source_chain_dedupe_batch.deduped_event_count).toBeGreaterThan(10);
    expect(result.fact_resolution_audit.event_fact_assignments.length).toBe(result.source_chain_dedupe_batch.deduped_event_count);
    expect(result.owner_transfer_artifact.owner_assignments.length).toBe(result.source_chain_dedupe_batch.deduped_event_count);
  });
});

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
