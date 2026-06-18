import { describe, expect, it } from "vitest";

import {
  AGENT_REACH_DEFAULT_QUALITY_POLICY,
  resolveAgentReachQualityPolicy,
} from "../agentReach/qualityPolicy.ts";
import { AGENT_REACH_QUERY_PACK } from "../agentReach/queryPack.ts";
import {
  applyAgentReachProviderQuality,
  canonicalizeAgentReachUrl,
  enrichLiveAgentReachItem,
  finalizeAgentReachProducerItems,
} from "../agentReach/quality.ts";
import type { AgentReachProviderItem } from "../agentReach/types.ts";

describe("AgentReach quality policy", () => {
  it("uses stable bounded defaults", () => {
    expect(resolveAgentReachQualityPolicy()).toEqual({
      lookback_days: 180,
      max_items_per_query: 20,
      max_items_per_provider: 50,
      max_items_total: 100,
    });
    expect(AGENT_REACH_DEFAULT_QUALITY_POLICY).toEqual(
      resolveAgentReachQualityPolicy(),
    );
  });

  it("accepts valid overrides", () => {
    expect(
      resolveAgentReachQualityPolicy({
        lookback_days: 30,
        max_items_per_query: 5,
        max_items_per_provider: 10,
        max_items_total: 25,
      }),
    ).toEqual({
      lookback_days: 30,
      max_items_per_query: 5,
      max_items_per_provider: 10,
      max_items_total: 25,
    });
  });

  it.each([
    [{ lookback_days: 0 }, "lookback_days"],
    [{ lookback_days: 3651 }, "lookback_days"],
    [{ max_items_per_query: 101 }, "max_items_per_query"],
    [{ max_items_per_provider: 501 }, "max_items_per_provider"],
    [{ max_items_total: 1001 }, "max_items_total"],
    [
      {
        max_items_per_query: 20,
        max_items_per_provider: 10,
        max_items_total: 100,
      },
      "max_items_per_query",
    ],
    [
      {
        max_items_per_query: 10,
        max_items_per_provider: 100,
        max_items_total: 50,
      },
      "max_items_per_provider",
    ],
  ] as const)("rejects invalid policy %j", (input, message) => {
    expect(() => resolveAgentReachQualityPolicy(input)).toThrow(message);
  });
});

describe("AgentReach live item enrichment", () => {
  it("maps matching query entries to direction labels and tags", () => {
    const result = enrichLiveAgentReachItem({
      item: {
        raw_ref: "hn:1",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        title: "Building a deep research agent",
        url: "https://example.com/deep-research-agent",
      },
      queryPack: AGENT_REACH_QUERY_PACK,
    });

    expect(result?.direction_labels).toContain("research-agent");
    expect(result?.tags).toContain("research");
  });

  it("matches marker plus domain term without requiring the exact phrase", () => {
    const result = enrichLiveAgentReachItem({
      item: {
        raw_ref: "hn:spreadsheet",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        title: "An autonomous system for spreadsheet work",
        url: "https://example.com/spreadsheet-work",
      },
      queryPack: AGENT_REACH_QUERY_PACK,
    });

    expect(result?.direction_labels).toEqual([
      "spreadsheet-agent",
      "office-agent",
    ]);
    expect(result?.tags).toEqual(["office", "spreadsheets"]);
  });

  it("drops live items that only contain a generic agent marker", () => {
    expect(
      enrichLiveAgentReachItem({
        item: {
          raw_ref: "hn:generic",
          platform: "hacker_news",
          observed_at: "2026-06-18T00:00:00.000Z",
          title: "A new AI agent",
          url: "https://example.com/new-ai-agent",
        },
        queryPack: AGENT_REACH_QUERY_PACK,
      }),
    ).toBeUndefined();
  });

  it("merges existing labels and tags without duplicates", () => {
    const result = enrichLiveAgentReachItem({
      item: {
        raw_ref: "hn:research",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        title: "Research agent workflow",
        url: "https://example.com/research-agent",
        direction_labels: ["research-agent"],
        tags: ["research", "workflow"],
      },
      queryPack: AGENT_REACH_QUERY_PACK,
    });

    expect(result?.direction_labels).toEqual(["research-agent"]);
    expect(result?.tags).toEqual(["research", "workflow"]);
  });

  it("does not add sibling direction labels for an atomic query match", () => {
    const result = enrichLiveAgentReachItem({
      item: {
        raw_ref: "hn:sheet",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        title: "Spreadsheet agent launch",
        url: "https://example.com/spreadsheet-agent",
      },
      queryPack: AGENT_REACH_QUERY_PACK,
    });

    expect(result?.direction_labels).toEqual([
      "spreadsheet-agent",
      "office-agent",
    ]);
    expect(result?.direction_labels).not.toContain("document-agent");
    expect(result?.direction_labels).not.toContain("meeting-agent");
  });

  it("does not infer research subdirection labels from shared parent terms", () => {
    const result = enrichLiveAgentReachItem({
      item: {
        raw_ref: "hn:shared-research",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        title: "Research-driven agents",
        url: "https://example.com/research-driven-agents",
      },
      queryPack: AGENT_REACH_QUERY_PACK,
    });

    expect(result?.direction_labels).toEqual(["research-agent"]);
    expect(result?.direction_labels).not.toContain("literature-review-agent");
    expect(result?.direction_labels).not.toContain("research-data-analysis-agent");
  });

  it("does not throw when an otherwise relevant item has an invalid URL", () => {
    const result = enrichLiveAgentReachItem({
      item: {
        raw_ref: "hn:bad-url",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        title: "Research agent with malformed URL",
        url: "not a url",
      },
      queryPack: AGENT_REACH_QUERY_PACK,
    });

    expect(result?.direction_labels).toContain("research-agent");
  });
});

describe("AgentReach provider and producer quality", () => {
  it("filters stale, future, and invalid live timestamps while retaining boundaries and missing dates", () => {
    const items: AgentReachProviderItem[] = [
      {
        raw_ref: "hn:stale",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        source_published_at: "2025-12-19T23:59:59.999Z",
        title: "Research agent stale",
      },
      {
        raw_ref: "hn:cutoff",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        source_published_at: "2025-12-20T00:00:00.000Z",
        title: "Research agent cutoff",
      },
      {
        raw_ref: "hn:future",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        source_published_at: "2026-06-18T00:00:00.001Z",
        title: "Research agent future",
      },
      {
        raw_ref: "hn:invalid",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        source_published_at: "not-a-date",
        title: "Research agent invalid date",
      },
      {
        raw_ref: "hn:missing",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        title: "Research agent without publication date",
      },
    ];

    const result = applyAgentReachProviderQuality({
      providerId: "hacker-news",
      items,
      queryPack: AGENT_REACH_QUERY_PACK,
      generatedAt: "2026-06-18T00:00:00.000Z",
      policy: AGENT_REACH_DEFAULT_QUALITY_POLICY,
      liveEnabled: true,
    });

    expect(result.items.map((item) => item.raw_ref)).toEqual([
      "hn:cutoff",
      "hn:missing",
    ]);
    expect(result.warnings).toEqual([
      "quality_filtered_stale:hacker-news:1",
      "quality_filtered_future:hacker-news:1",
      "quality_filtered_invalid_timestamp:hacker-news:1",
    ]);
  });

  it("fails fast when generatedAt is invalid", () => {
    expect(() =>
      applyAgentReachProviderQuality({
        providerId: "hacker-news",
        items: [],
        queryPack: AGENT_REACH_QUERY_PACK,
        generatedAt: "invalid-generated-at",
        policy: AGENT_REACH_DEFAULT_QUALITY_POLICY,
        liveEnabled: true,
      }),
    ).toThrow(/generatedAt/);
  });

  it("canonicalizes URLs and removes tracking parameters", () => {
    expect(
      canonicalizeAgentReachUrl(
        "HTTPS://Example.COM:443/Path?utm_source=x&b=2&a=1&ref=home#fragment",
      ),
    ).toBe("https://example.com/Path?a=1&b=2");
    expect(canonicalizeAgentReachUrl("not a url")).toBeUndefined();
  });

  it("uses HN raw_ref as the discussion identity", () => {
    const result = finalizeAgentReachProducerItems({
      items: [
        {
          raw_ref: "hn:1",
          platform: "hacker_news",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/target?utm_source=one",
          direction_labels: ["research-agent"],
          metrics: { points: 10 },
        },
        {
          raw_ref: "hn:1",
          platform: "hacker_news",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/target",
          tags: ["research"],
          metrics: { points: 20, comments: 3 },
        },
        {
          raw_ref: "hn:2",
          platform: "hacker_news",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/target",
        },
      ],
      maxItemsTotal: 10,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        raw_ref: "hn:1",
        direction_labels: ["research-agent"],
        tags: ["research"],
        metrics: { comments: 3, points: 20 },
      }),
    );
    expect(result.warnings).toContain("quality_deduplicated:producer:1");
  });

  it("deduplicates canonical URLs only within one non-HN platform", () => {
    const result = finalizeAgentReachProducerItems({
      items: [
        {
          raw_ref: "rss:1",
          platform: "official_blog",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/Post?utm_source=rss",
        },
        {
          raw_ref: "rss:2",
          platform: "official_blog",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/Post",
        },
        {
          raw_ref: "web:1",
          platform: "official_web",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/Post",
        },
      ],
      maxItemsTotal: 10,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.platform).sort()).toEqual([
      "official_blog",
      "official_web",
    ]);
  });

  it("does not introduce empty actor or target objects while merging duplicates", () => {
    const result = finalizeAgentReachProducerItems({
      items: [
        {
          raw_ref: "rss:1",
          platform: "official_blog",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/Post?utm_source=rss",
        },
        {
          raw_ref: "rss:2",
          platform: "official_blog",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/Post",
        },
      ],
      maxItemsTotal: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty("actor");
    expect(result.items[0]).not.toHaveProperty("target");
  });

  it("sorts deterministically before applying the provider limit", () => {
    const items: AgentReachProviderItem[] = [
      {
        raw_ref: "hn:missing-date",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        title: "Research agent missing date",
      },
      {
        raw_ref: "hn:more-comments",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        source_published_at: "2026-06-16T00:00:00.000Z",
        title: "Research agent comments",
        metrics: { points: 5, comments: 20 },
      },
      {
        raw_ref: "hn:older",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        source_published_at: "2026-06-15T00:00:00.000Z",
        title: "Research agent older",
      },
      {
        raw_ref: "hn:newer",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        source_published_at: "2026-06-17T00:00:00.000Z",
        title: "Research agent newer",
      },
      {
        raw_ref: "hn:more-points",
        platform: "hacker_news",
        observed_at: "2026-06-18T00:00:00.000Z",
        source_published_at: "2026-06-16T00:00:00.000Z",
        title: "Research agent points",
        metrics: { points: 10, comments: 1 },
      },
    ];

    const result = applyAgentReachProviderQuality({
      providerId: "hacker-news",
      items,
      queryPack: AGENT_REACH_QUERY_PACK,
      generatedAt: "2026-06-18T00:00:00.000Z",
      policy: {
        lookback_days: 180,
        max_items_per_query: 20,
        max_items_per_provider: 4,
        max_items_total: 100,
      },
      liveEnabled: true,
    });

    expect(result.items.map((item) => item.raw_ref)).toEqual([
      "hn:newer",
      "hn:more-points",
      "hn:more-comments",
      "hn:older",
    ]);
    expect(result.warnings).toContain("quality_truncated:hacker-news:1");
  });
});
