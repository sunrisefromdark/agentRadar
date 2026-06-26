import { describe, expect, it } from "vitest";
import { buildDeveloperStudioArtifacts } from "../../../../industry/agents/product-oss-agent/developerStudioEventBuilder.ts";
import { buildProductPlatformArtifacts } from "../../../../industry/agents/product-oss-agent/productPlatformEventBuilder.ts";
import { buildProjectOssArtifacts } from "../../../../industry/agents/product-oss-agent/projectOssEventBuilder.ts";

const base = {
  runId: "run-product-unit",
  threadId: "thread-product-unit",
  windowStart: "2026-06-20T00:00:00+08:00",
  windowEnd: "2026-06-26T23:59:59+08:00",
  now: "2026-06-26T16:00:00+08:00",
  canonicalSourceAvailable: true,
};

describe("product-oss-agent source ownership", () => {
  it("keeps vendor releases, developer docs, and repo releases on separate owners", () => {
    const product = buildProductPlatformArtifacts({
      ...base,
      availableToolIds: ["vendor-release-notes-feed"],
      sources: [
        {
          sourceId: "vendor-release-1",
          displayName: "Vendor Release Notes",
          sourceType: "vendor_release",
          authorityTier: "core",
          primarySourceDistance: "primary",
          bucket: "accepted",
          title: "Agent product launch",
          summary: "Official release notes describe the product surface.",
        },
      ],
    });
    const developer = buildDeveloperStudioArtifacts({
      ...base,
      availableToolIds: ["developer-docs-changelog"],
      sources: [
        {
          sourceId: "sdk-docs-1",
          displayName: "SDK Docs",
          sourceType: "sdk_release",
          authorityTier: "core",
          primarySourceDistance: "primary",
          bucket: "accepted",
          title: "SDK release",
          summary: "Developer SDK release is a developer-studio signal.",
        },
      ],
    });
    const oss = buildProjectOssArtifacts({
      ...base,
      availableToolIds: ["github-release-feed"],
      sources: [
        {
          sourceId: "repo-release-1",
          displayName: "GitHub Releases",
          sourceType: "repo_release",
          authorityTier: "core",
          primarySourceDistance: "primary",
          bucket: "accepted",
          title: "Repository release",
          summary: "Repository release belongs to project-oss.",
        },
      ],
    });

    expect(product.accepted.payload.axis).toBe("product_vendor_release");
    expect(product.accepted.payload.events[0]?.audit.direct_owner_responsibility_id).toBe("product-platform");
    expect(developer.accepted.payload.axis).toBe("developer_studio");
    expect(developer.accepted.payload.events[0]?.audit.direct_owner_responsibility_id).toBe("developer-studio");
    expect(oss.accepted.payload.axis).toBe("project_open_source");
    expect(oss.accepted.payload.events[0]?.audit.direct_owner_responsibility_id).toBe("project-oss");
  });
});
