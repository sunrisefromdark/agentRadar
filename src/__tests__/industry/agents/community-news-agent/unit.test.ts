import { describe, expect, it } from "vitest";
import { buildCommunityDiscussionArtifacts, buildNewsNarrativeArtifacts } from "../../../../industry/agents/community-news-agent/eventBuilder.ts";

const base = {
  runId: "run-community-unit",
  threadId: "thread-community-unit",
  windowStart: "2026-06-20T00:00:00+08:00",
  windowEnd: "2026-06-26T23:59:59+08:00",
  now: "2026-06-26T17:00:00+08:00",
  canonicalSourceAvailable: true,
};

describe("community-news-agent source ownership", () => {
  it("preserves cn/global community labels without adding natural weight", () => {
    const cn = buildCommunityDiscussionArtifacts({
      ...base,
      responsibilityId: "cn-community",
      availableToolIds: ["cn-community-original-thread-index"],
      sources: [
        {
          sourceId: "cn-thread-1",
          displayName: "CN Forum",
          sourceType: "forum_post",
          authorityTier: "proven",
          primarySourceDistance: "primary",
          language: "zh",
          region: "cn",
          bucket: "accepted",
          title: "Chinese community reproduction",
          summary: "Original community reproduction.",
        },
      ],
    });
    const global = buildCommunityDiscussionArtifacts({
      ...base,
      responsibilityId: "global-community",
      availableToolIds: ["global-community-original-thread-index"],
      sources: [
        {
          sourceId: "global-issue-1",
          displayName: "GitHub Issue",
          sourceType: "issue",
          authorityTier: "proven",
          primarySourceDistance: "primary",
          language: "en",
          region: "global",
          bucket: "accepted",
          title: "Global issue reproduction",
          summary: "Original global issue reproduction.",
        },
      ],
    });

    expect(cn.accepted.payload.events[0]?.source.language).toBe("zh");
    expect(cn.contribution.payload.contribution.responsibility_id).toBe("cn-community");
    expect(global.accepted.payload.events[0]?.source.language).toBe("en");
    expect(global.contribution.payload.contribution.responsibility_id).toBe("global-community");
  });

  it("keeps native news narrative on news-pr", () => {
    const news = buildNewsNarrativeArtifacts({
      ...base,
      availableToolIds: ["news-pr-narrative-index"],
      sources: [
        {
          sourceId: "press-release-1",
          displayName: "Press Wire",
          sourceType: "press_release",
          authorityTier: "ordinary",
          primarySourceDistance: "secondary",
          language: "en",
          region: "global",
          bucket: "accepted",
          title: "Press release narrative",
          summary: "Press release is narrative context.",
        },
      ],
    });

    expect(news.accepted.payload.axis).toBe("news_pr_narrative");
    expect(news.accepted.payload.events[0]?.audit.direct_owner_responsibility_id).toBe("news-pr");
  });
});
