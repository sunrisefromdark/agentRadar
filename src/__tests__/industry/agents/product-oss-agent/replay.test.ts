import { describe, expect, it } from "vitest";
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
});
