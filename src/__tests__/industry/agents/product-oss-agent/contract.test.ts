import { describe, expect, it } from "vitest";
import { collectProductContributionRefs } from "../../../../industry/agents/product-oss-agent/contributionLedger.ts";
import { collectProductCoverageRefs } from "../../../../industry/agents/product-oss-agent/coverageReport.ts";
import { buildProductOssHandoff } from "../../../../industry/agents/product-oss-agent/handoff.ts";

describe("product-oss-agent contract drafts", () => {
  it("produces three product-side coverage and contribution refs", () => {
    const result = buildProductOssHandoff({
      productPlatform: {
        runId: "run-product-contract",
        threadId: "thread-product-contract",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T16:20:00+08:00",
        availableToolIds: ["vendor-release-notes-feed"],
        canonicalSourceAvailable: true,
        sources: [],
      },
      developerStudio: {
        runId: "run-product-contract",
        threadId: "thread-product-contract",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T16:20:00+08:00",
        availableToolIds: ["developer-docs-changelog"],
        canonicalSourceAvailable: true,
        sources: [],
      },
      projectOss: {
        runId: "run-product-contract",
        threadId: "thread-product-contract",
        windowStart: "2026-06-20T00:00:00+08:00",
        windowEnd: "2026-06-26T23:59:59+08:00",
        now: "2026-06-26T16:20:00+08:00",
        availableToolIds: ["github-release-feed"],
        canonicalSourceAvailable: true,
        sources: [],
      },
    });

    expect(collectProductCoverageRefs([result.productPlatform, result.developerStudio, result.projectOss])).toHaveLength(3);
    expect(collectProductContributionRefs([result.productPlatform, result.developerStudio, result.projectOss])).toHaveLength(3);
    expect(result.productPlatform.coverage.envelope.payload_schema).toBe("axis-tool-coverage-report.v1");
    expect(result.projectOss.contribution.payload.contribution.responsibility_id).toBe("project-oss");
  });
});
