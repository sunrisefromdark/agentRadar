import { describe, expect, it } from "vitest";
import { buildCommunityDiscussionArtifacts, buildNewsNarrativeArtifacts } from "../../../../industry/agents/community-news-agent/eventBuilder.ts";
import noiseFixture from "../../../../../fixtures/industry/agents/community-news-agent/anti-upgrade/community-noise-seo-content.json" with { type: "json" };
import retellFixture from "../../../../../fixtures/industry/agents/community-news-agent/owner-boundary/community-post-news-retell.json" with { type: "json" };

describe("community-news-agent negative cases", () => {
  it("keeps media retell as context instead of a second accepted owner fact", () => {
    const news = buildNewsNarrativeArtifacts({
      runId: "run-community-negative-1",
      threadId: "thread-community-negative-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:10:00+08:00",
      availableToolIds: ["news-pr-narrative-index"],
      canonicalSourceAvailable: true,
      sources: [
        {
          sourceId: "news-retell-1",
          displayName: "Media Retell",
          sourceType: "media_report",
          authorityTier: "ordinary",
          primarySourceDistance: "secondary",
          language: "zh",
          region: "cn",
          bucket: "accepted",
          title: "Media retells community thread",
          summary: "The media report retells an original community post.",
          retellsSourceId: "cn-thread-original",
        },
      ],
    });

    expect(news.accepted.payload.events).toHaveLength(0);
    expect(news.diagnostic.payload.events).toHaveLength(1);
    expect(news.diagnostic.payload.events[0]?.audit.direct_owner_responsibility_id).toBe(retellFixture.original_owner);
    expect(news.diagnostic.payload.events[0]?.audit.rejected_reason).toBe(retellFixture.expected_reason);
    expect(news.diagnostic.payload.events[0]?.audit.relation_refs[0]).toContain("relation://retells/");
  });

  it("rejects seo community noise", () => {
    const community = buildCommunityDiscussionArtifacts({
      runId: "run-community-negative-2",
      threadId: "thread-community-negative-2",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:20:00+08:00",
      responsibilityId: "global-community",
      availableToolIds: ["global-issue-and-forum-search"],
      canonicalSourceAvailable: false,
      sources: [
        {
          sourceId: "seo-noise",
          displayName: "SEO roundup",
          sourceType: "seo_content",
          authorityTier: "excluded",
          primarySourceDistance: "secondary",
          language: "en",
          region: "global",
          bucket: "accepted",
          title: "SEO roundup",
          summary: "Low quality SEO content is not accepted.",
        },
      ],
    });

    expect(community.accepted.payload.events).toHaveLength(0);
    expect(community.rejected.payload.events[0]?.audit.rejected_reason).toBe(noiseFixture.expected_reason);
  });
});
