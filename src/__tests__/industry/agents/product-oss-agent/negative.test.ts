import { describe, expect, it } from "vitest";
import { buildProductPlatformArtifacts } from "../../../../industry/agents/product-oss-agent/productPlatformEventBuilder.ts";
import ownerBoundaryFixture from "../../../../../fixtures/industry/agents/product-oss-agent/owner-boundary/vendor-blog-repo-update.json" with { type: "json" };

describe("product-oss-agent owner boundary negatives", () => {
  it("does not count a vendor blog repo mention as a product-platform accepted fact", () => {
    const result = buildProductPlatformArtifacts({
      runId: "run-product-negative",
      threadId: "thread-product-negative",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T16:10:00+08:00",
      availableToolIds: ["vendor-blog-monitor"],
      canonicalSourceAvailable: false,
      sources: [
        {
          sourceId: "vendor-blog-repo",
          displayName: "Vendor Blog",
          sourceType: "vendor_blog",
          authorityTier: "ordinary",
          primarySourceDistance: "secondary",
          bucket: "accepted",
          title: "Vendor blog mentions repo release",
          summary: "The blog post mentions a repository release but is not the direct product owner.",
          topicKey: ownerBoundaryFixture.topic_key,
        },
      ],
    });

    expect(result.accepted.payload.events).toHaveLength(0);
    expect(result.diagnostic.payload.events).toHaveLength(1);
    expect(result.diagnostic.payload.events[0]?.audit.direct_owner_responsibility_id).toBe(ownerBoundaryFixture.expected_direct_owner);
    expect(result.diagnostic.payload.events[0]?.audit.rejected_reason).toBe(ownerBoundaryFixture.expected_reason);
    expect(result.diagnostic.payload.events[0]?.audit.cross_responsibility_attestation_refs).toContain("attestation://product-oss/vendor-blog-repo-boundary");
  });
});
