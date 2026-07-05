import { describe, expect, it } from "vitest";
import antiUpgradeFixture from "../../../../../fixtures/industry/agents/product-oss-agent/anti-upgrade/vendor-blog-mentioned-repo.json" with { type: "json" };
import ownerBoundaryFixture from "../../../../../fixtures/industry/agents/product-oss-agent/owner-boundary/vendor-blog-repo-update.json" with { type: "json" };
import propagationFixture from "../../../../../fixtures/industry/agents/product-oss-agent/propagation/official-release-news-retell.json" with { type: "json" };
import { buildProductPlatformArtifacts } from "../../../../industry/agents/product-oss-agent/productPlatformEventBuilder.ts";
import { buildProjectOssArtifacts } from "../../../../industry/agents/product-oss-agent/projectOssEventBuilder.ts";

describe("product-oss-agent replay stability", () => {
  it("replays project-oss release windows with stable refs", () => {
    const input = {
      runId: "run-product-replay",
      threadId: "thread-product-replay",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T16:30:00+08:00",
      availableToolIds: ["github-release-feed"],
      canonicalSourceAvailable: true,
      sources: [
        {
          sourceId: "repo-release-replay",
          displayName: "GitHub Releases",
          sourceType: "repo_release" as const,
          authorityTier: "core" as const,
          primarySourceDistance: "primary" as const,
          bucket: "accepted" as const,
          title: "Replayable repo release",
          summary: "Stable replay for project OSS.",
        },
      ],
    };

    const first = buildProjectOssArtifacts(input);
    const second = buildProjectOssArtifacts(input);

    expect(first.accepted.envelope.message_id).toBe(second.accepted.envelope.message_id);
    expect(first.accepted.manifest.artifact_ref).toBe(second.accepted.manifest.artifact_ref);
    expect(first.coverage.payload.report.accepted_ref_count).toBe(1);
  });

  it("replays Phase6 owner-boundary, anti-upgrade, and propagation fixtures", () => {
    const boundary = buildProductPlatformArtifacts({
      runId: "run-product-phase6-replay",
      threadId: "thread-product-phase6-replay",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T16:35:00+08:00",
      availableToolIds: ["vendor-blog-monitor"],
      canonicalSourceAvailable: false,
      sources: [
        {
          sourceId: "vendor-blog-repo",
          displayName: "Vendor Blog",
          sourceType: ownerBoundaryFixture.source_type as "vendor_blog",
          authorityTier: "ordinary" as const,
          primarySourceDistance: "secondary" as const,
          bucket: "accepted" as const,
          title: "Vendor blog mentions repo release",
          summary: "The blog post mentions a repository release but is not the direct product owner.",
          topicKey: ownerBoundaryFixture.topic_key,
        },
        {
          sourceId: propagationFixture.case_id,
          displayName: "Official Release Retell",
          sourceType: "news" as const,
          authorityTier: "ordinary" as const,
          primarySourceDistance: "secondary" as const,
          bucket: propagationFixture.retell_treatment === "context" ? ("diagnostic" as const) : ("accepted" as const),
          title: "Official release retold by news",
          summary: "The retell stays as context for product platform owner propagation.",
        },
      ],
    });
    const ownerBoundaryEvent = boundary.diagnostic.payload.events.find((event) => event.source.source_id === "vendor-blog-repo");
    const propagationEvent = boundary.diagnostic.payload.events.find((event) => event.source.source_id === propagationFixture.case_id);

    expect(boundary.accepted.payload.events).toHaveLength(0);
    expect(ownerBoundaryEvent?.audit.direct_owner_responsibility_id).toBe(ownerBoundaryFixture.expected_direct_owner);
    expect(ownerBoundaryEvent?.audit.rejected_reason).toBe(ownerBoundaryFixture.expected_reason);
    expect(ownerBoundaryEvent?.audit.cross_responsibility_attestation_refs).toContain(
      antiUpgradeFixture.expected_attestation_ref,
    );
    expect(propagationEvent?.audit.direct_owner_responsibility_id).toBe(propagationFixture.origin_owner);
    expect(propagationEvent?.bucket).toBe("diagnostic");
    expect(antiUpgradeFixture.expected_core_upgrade_allowed).toBe(false);
    expect(propagationFixture.origin_owner).toBe("product-platform");
    expect(propagationFixture.retell_treatment).toBe("context");
    expect(propagationFixture.expected_no_double_accepted).toBe(true);
  });
});
