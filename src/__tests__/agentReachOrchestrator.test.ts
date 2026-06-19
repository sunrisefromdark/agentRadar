import { describe, expect, it } from "vitest";

import {
  runAgentReachProviders,
  type RunAgentReachProvidersInput,
} from "../agentReach/orchestrator.ts";
import { selectAgentReachProviders } from "../agentReach/providerRegistry.ts";
import { AGENT_REACH_DEFAULT_QUALITY_POLICY } from "../agentReach/qualityPolicy.ts";
import { AGENT_REACH_QUERY_PACK } from "../agentReach/queryPack.ts";
import { createDisabledAgentReachTransport } from "../agentReach/transport.ts";
import type {
  AgentReachProducerProvider,
  AgentReachProviderContext,
  AgentReachProviderId,
  AgentReachProviderResult,
} from "../agentReach/types.ts";

function result(
  providerId: AgentReachProviderId,
  overrides: Partial<AgentReachProviderResult> = {},
): AgentReachProviderResult {
  return {
    provider_id: providerId,
    status: "ok",
    items: [],
    coverage: {},
    warnings: [],
    rejected_items: [],
    ...overrides,
  };
}

function fakeProvider(input: {
  id: AgentReachProviderId;
  platforms?: AgentReachProducerProvider["platforms"];
  mode?: AgentReachProducerProvider["mode"];
  run: AgentReachProducerProvider["run"];
}): AgentReachProducerProvider {
  return {
    provider_id: input.id,
    platforms: input.platforms ?? [],
    mode: input.mode ?? "active",
    default_enabled: input.mode !== "manual_import_only",
    run: input.run,
  };
}

function orchestratorInput(
  providers: AgentReachProducerProvider[],
  selectedProviderIds: AgentReachProviderId[],
  overrides: Partial<RunAgentReachProvidersInput> = {},
): RunAgentReachProvidersInput {
  return {
    selected_provider_ids: selectedProviderIds,
    providers,
    date: "2026-06-18",
    generated_at: "2026-06-18T00:00:00.000Z",
    query_pack: AGENT_REACH_QUERY_PACK,
    provider_configs: {},
    quality_policy: AGENT_REACH_DEFAULT_QUALITY_POLICY,
    transport: createDisabledAgentReachTransport(),
    ...overrides,
  };
}

describe("AgentReach provider registry", () => {
  it("selects providers in canonical registry order instead of caller order", () => {
    const rss = fakeProvider({
      id: "rss-blog",
      run: async () => result("rss-blog"),
    });
    const hackerNews = fakeProvider({
      id: "hacker-news",
      run: async () => result("hacker-news"),
    });

    const selected = selectAgentReachProviders(
      [rss, hackerNews],
      ["hacker-news", "rss-blog", "hacker-news"],
    );

    expect(selected.map((provider) => provider.provider_id)).toEqual([
      "rss-blog",
      "hacker-news",
    ]);
  });
});

describe("AgentReach orchestrator", () => {
  it("passes provider-scoped search jobs and a run-level plan summary", async () => {
    const seenContexts: Partial<Record<AgentReachProviderId, AgentReachProviderContext>> = {};
    const rss = fakeProvider({
      id: "rss-blog",
      platforms: ["official_blog"],
      run: async (context) => {
        seenContexts["rss-blog"] = context;
        return result("rss-blog", {
          coverage: { official_blog: { status: "ok" } },
        });
      },
    });
    const hackerNews = fakeProvider({
      id: "hacker-news",
      platforms: ["hacker_news"],
      run: async (context) => {
        seenContexts["hacker-news"] = context;
        return result("hacker-news", {
          coverage: { hacker_news: { status: "ok" } },
        });
      },
    });

    const summary = await runAgentReachProviders(
      orchestratorInput([rss, hackerNews], ["hacker-news", "rss-blog"], {
        query_pack: AGENT_REACH_QUERY_PACK.slice(0, 2),
        provider_configs: {
          "hacker-news": {
            live: {
              query_limit: 1,
            },
          },
        },
      }),
    );

    expect(seenContexts["rss-blog"]?.search_jobs.map((job) => job.provider_id)).toEqual([
      "rss-blog",
      "rss-blog",
      "rss-blog",
      "rss-blog",
      "rss-blog",
      "rss-blog",
    ]);
    expect(seenContexts["hacker-news"]?.search_jobs.map((job) => job.term)).toEqual([
      "research agent",
      "ai research assistant",
      "scientific agent",
    ]);
    expect(summary.search_plan_summary).toEqual({
      job_count: 9,
      provider_count: 2,
      query_entry_count: 2,
      reserved_provider_count: 0,
      max_items_per_query: AGENT_REACH_DEFAULT_QUALITY_POLICY.max_items_per_query,
      provider_job_counts: {
        "rss-blog": 6,
        "hacker-news": 3,
      },
    });
  });

  it("runs selected providers sequentially in registry order", async () => {
    const calls: string[] = [];
    const rss = fakeProvider({
      id: "rss-blog",
      platforms: ["official_blog"],
      run: async () => {
        calls.push("rss-blog:start");
        await Promise.resolve();
        calls.push("rss-blog:end");
        return result("rss-blog", {
          coverage: { official_blog: { status: "ok" } },
        });
      },
    });
    const hackerNews = fakeProvider({
      id: "hacker-news",
      platforms: ["hacker_news"],
      run: async () => {
        calls.push("hacker-news");
        return result("hacker-news", {
          coverage: { hacker_news: { status: "ok" } },
        });
      },
    });

    await runAgentReachProviders(
      orchestratorInput([rss, hackerNews], ["hacker-news", "rss-blog"]),
    );

    expect(calls).toEqual(["rss-blog:start", "rss-blog:end", "hacker-news"]);
  });

  it("isolates one provider failure and keeps later provider output", async () => {
    const rss = fakeProvider({
      id: "rss-blog",
      platforms: ["official_blog"],
      run: async () => {
        throw new Error(
          "OAuth token=secret response body=private C:\\provider\\config.json",
        );
      },
    });
    const hackerNews = fakeProvider({
      id: "hacker-news",
      platforms: ["hacker_news"],
      run: async () =>
        result("hacker-news", {
          items: [
            {
              raw_ref: "hn:1",
              platform: "hacker_news",
              observed_at: "2026-06-18T00:00:00.000Z",
            },
          ],
          coverage: { hacker_news: { status: "ok" } },
        }),
    });

    const summary = await runAgentReachProviders(
      orchestratorInput([rss, hackerNews], ["rss-blog", "hacker-news"]),
    );

    expect(summary.status).toBe("partial");
    expect(summary.items.map((item) => item.raw_ref)).toEqual(["hn:1"]);
    expect(summary.coverage.official_blog).toEqual({
      status: "failed",
      reason: "provider_execution_failed",
    });
    expect(summary.coverage.hacker_news.status).toBe("ok");
    expect(summary.warnings).toContain("provider_failed:rss-blog:unexpected");
    expect(JSON.stringify(summary)).not.toMatch(
      /OAuth|token|secret|response body|provider\\config/i,
    );
  });

  it("aggregates items, warnings, and rejections in deterministic order", async () => {
    const externalImport = fakeProvider({
      id: "external-import",
      run: async () =>
        result("external-import", {
          status: "partial",
          items: [
            {
              raw_ref: "manual:1",
              platform: "reddit",
              observed_at: "2026-06-18T00:00:00.000Z",
            },
          ],
          coverage: { reddit: { status: "partial" } },
          warnings: ["manual_warning"],
          rejected_items: [
            {
              raw_ref: "manual:rejected",
              reason_code: "invalid_item",
              reason_detail: "item must be an object",
            },
          ],
        }),
    });
    const rss = fakeProvider({
      id: "rss-blog",
      platforms: ["official_blog"],
      run: async () =>
        result("rss-blog", {
          items: [
            {
              raw_ref: "rss:1",
              platform: "official_blog",
              observed_at: "2026-06-18T00:00:00.000Z",
            },
          ],
          coverage: { official_blog: { status: "ok" } },
          warnings: ["rss_warning"],
        }),
    });

    const summary = await runAgentReachProviders(
      orchestratorInput([externalImport, rss], ["rss-blog", "external-import"]),
    );

    expect(summary.status).toBe("partial");
    expect(summary.items.map((item) => item.raw_ref)).toEqual(["manual:1", "rss:1"]);
    expect(summary.warnings).toEqual(["manual_warning", "rss_warning"]);
    expect(summary.rejected_items.map((item) => item.raw_ref)).toEqual([
      "manual:rejected",
    ]);
  });

  it("merges success and failure on one platform as partial coverage", async () => {
    const externalImport = fakeProvider({
      id: "external-import",
      run: async () =>
        result("external-import", {
          coverage: { official_blog: { status: "ok" } },
        }),
    });
    const rss = fakeProvider({
      id: "rss-blog",
      platforms: ["official_blog"],
      run: async () => {
        throw new Error("private filesystem path");
      },
    });

    const summary = await runAgentReachProviders(
      orchestratorInput([externalImport, rss], ["external-import", "rss-blog"]),
    );

    expect(summary.coverage.official_blog).toEqual({
      status: "partial",
      reason: "multiple_provider_outcomes",
    });
    expect(summary.status).toBe("partial");
  });

  it("returns failed when every attempted active provider fails", async () => {
    const rss = fakeProvider({
      id: "rss-blog",
      platforms: ["official_blog"],
      run: async () => {
        throw new Error("rss failed");
      },
    });
    const hackerNews = fakeProvider({
      id: "hacker-news",
      platforms: ["hacker_news"],
      run: async () =>
        result("hacker-news", {
          status: "unavailable",
          coverage: {
            hacker_news: {
              status: "unavailable",
              reason: "provider_transport_unavailable",
            },
          },
        }),
    });

    const summary = await runAgentReachProviders(
      orchestratorInput([rss, hackerNews], ["rss-blog", "hacker-news"]),
    );

    expect(summary.status).toBe("failed");
  });

  it("keeps reserved-only selection ok and completes every platform coverage entry", async () => {
    const x = fakeProvider({
      id: "x_twitter",
      platforms: ["x_twitter"],
      mode: "manual_import_only",
      run: async () =>
        result("x_twitter", {
          status: "manual_import_only",
          coverage: { x_twitter: { status: "manual_import_only" } },
        }),
    });
    const reddit = fakeProvider({
      id: "reddit",
      platforms: ["reddit"],
      mode: "manual_import_only",
      run: async () =>
        result("reddit", {
          status: "manual_import_only",
          coverage: { reddit: { status: "manual_import_only" } },
        }),
    });

    const summary = await runAgentReachProviders(
      orchestratorInput([x, reddit], ["reddit", "x_twitter"]),
    );

    expect(summary.status).toBe("ok");
    expect(Object.keys(summary.coverage).sort()).toEqual([
      "hacker_news",
      "official_blog",
      "official_web",
      "reddit",
      "x_twitter",
    ]);
    expect(summary.coverage.x_twitter.status).toBe("manual_import_only");
    expect(summary.coverage.reddit.status).toBe("manual_import_only");
    expect(summary.coverage.hacker_news.status).toBe("not_configured");
  });

  it("filters irrelevant and stale live provider items without degrading coverage", async () => {
    const hackerNews = fakeProvider({
      id: "hacker-news",
      platforms: ["hacker_news"],
      run: async () =>
        result("hacker-news", {
          items: [
            {
              raw_ref: "hn:irrelevant",
              platform: "hacker_news",
              observed_at: "2026-06-18T00:00:00.000Z",
              source_published_at: "2026-06-17T00:00:00.000Z",
              title: "A new AI agent",
            },
            {
              raw_ref: "hn:stale",
              platform: "hacker_news",
              observed_at: "2026-06-18T00:00:00.000Z",
              source_published_at: "2025-12-19T00:00:00.000Z",
              title: "Research agent old",
            },
            {
              raw_ref: "hn:relevant",
              platform: "hacker_news",
              observed_at: "2026-06-18T00:00:00.000Z",
              source_published_at: "2026-06-17T00:00:00.000Z",
              title: "Research agent current",
            },
          ],
          coverage: { hacker_news: { status: "ok" } },
        }),
    });

    const summary = await runAgentReachProviders(
      orchestratorInput([hackerNews], ["hacker-news"], {
        provider_configs: {
          "hacker-news": {
            live: {
              enabled: true,
              urls: ["https://hn.algolia.com/api/v1/search"],
            },
          },
        },
        quality_policy: {
          lookback_days: 180,
          max_items_per_query: 2,
          max_items_per_provider: 2,
          max_items_total: 3,
        },
      }),
    );

    expect(summary.items.map((item) => item.raw_ref)).toEqual(["hn:relevant"]);
    expect(summary.warnings).toEqual(
      expect.arrayContaining([
        "quality_filtered_irrelevant:hacker-news:1",
        "quality_filtered_stale:hacker-news:1",
      ]),
    );
    expect(summary.status).toBe("ok");
    expect(summary.coverage.hacker_news.status).toBe("ok");
  });

  it("does not freshness-filter local or manual provider imports", async () => {
    const externalImport = fakeProvider({
      id: "external-import",
      platforms: ["official_blog"],
      run: async () =>
        result("external-import", {
          items: [
            {
              raw_ref: "manual:old-but-explicit",
              platform: "official_blog",
              observed_at: "2026-06-18T00:00:00.000Z",
              source_published_at: "2020-01-01T00:00:00.000Z",
              title: "Old but explicitly imported item",
            },
          ],
          coverage: { official_blog: { status: "ok" } },
        }),
    });

    const localSummary = await runAgentReachProviders(
      orchestratorInput([externalImport], ["external-import"], {
        quality_policy: {
          lookback_days: 1,
          max_items_per_query: 2,
          max_items_per_provider: 2,
          max_items_total: 3,
        },
      }),
    );

    expect(localSummary.items.map((item) => item.raw_ref)).toEqual([
      "manual:old-but-explicit",
    ]);
    expect(
      localSummary.warnings.some((warning) =>
        warning.startsWith("quality_filtered_stale"),
      ),
    ).toBe(false);
  });

  it("applies provider limits without changing provider status or coverage", async () => {
    const hackerNews = fakeProvider({
      id: "hacker-news",
      platforms: ["hacker_news"],
      run: async () =>
        result("hacker-news", {
          items: ["1", "2", "3"].map((id) => ({
            raw_ref: `hn:${id}`,
            platform: "hacker_news" as const,
            observed_at: "2026-06-18T00:00:00.000Z",
            source_published_at: `2026-06-1${id}T00:00:00.000Z`,
            title: `Research agent ${id}`,
          })),
          coverage: { hacker_news: { status: "ok" } },
        }),
    });

    const truncatedSummary = await runAgentReachProviders(
      orchestratorInput([hackerNews], ["hacker-news"], {
        provider_configs: {
          "hacker-news": {
            live: {
              enabled: true,
              urls: ["https://hn.algolia.com/api/v1/search"],
            },
          },
        },
        quality_policy: {
          lookback_days: 180,
          max_items_per_query: 2,
          max_items_per_provider: 2,
          max_items_total: 3,
        },
      }),
    );

    expect(truncatedSummary.status).toBe("ok");
    expect(truncatedSummary.coverage.hacker_news.status).toBe("ok");
    expect(truncatedSummary.items).toHaveLength(2);
    expect(truncatedSummary.warnings).toContain(
      "quality_truncated:hacker-news:1",
    );
  });

  it("applies the final global producer item limit", async () => {
    const rss = fakeProvider({
      id: "rss-blog",
      platforms: ["official_blog"],
      run: async () =>
        result("rss-blog", {
          items: ["1", "2"].map((id) => ({
            raw_ref: `rss:${id}`,
            platform: "official_blog" as const,
            observed_at: "2026-06-18T00:00:00.000Z",
            title: `RSS item ${id}`,
          })),
          coverage: { official_blog: { status: "ok" } },
        }),
    });
    const officialWeb = fakeProvider({
      id: "official-web",
      platforms: ["official_web"],
      run: async () =>
        result("official-web", {
          items: ["1", "2"].map((id) => ({
            raw_ref: `web:${id}`,
            platform: "official_web" as const,
            observed_at: "2026-06-18T00:00:00.000Z",
            title: `Web item ${id}`,
          })),
          coverage: { official_web: { status: "ok" } },
        }),
    });

    const globalSummary = await runAgentReachProviders(
      orchestratorInput([rss, officialWeb], ["rss-blog", "official-web"], {
        quality_policy: {
          lookback_days: 180,
          max_items_per_query: 10,
          max_items_per_provider: 10,
          max_items_total: 3,
        },
      }),
    );

    expect(globalSummary.items).toHaveLength(3);
    expect(globalSummary.warnings).toContain("quality_truncated:producer:1");
  });

  it("keeps quality output deterministic across identical runs", async () => {
    const hackerNews = fakeProvider({
      id: "hacker-news",
      platforms: ["hacker_news"],
      run: async () =>
        result("hacker-news", {
          items: [
            {
              raw_ref: "hn:duplicate",
              platform: "hacker_news",
              observed_at: "2026-06-18T00:00:00.000Z",
              source_published_at: "2026-06-17T00:00:00.000Z",
              title: "Research agent duplicate",
            },
            {
              raw_ref: "hn:duplicate",
              platform: "hacker_news",
              observed_at: "2026-06-18T00:00:00.000Z",
              source_published_at: "2026-06-17T00:00:00.000Z",
              title: "Research agent duplicate copy",
              tags: ["research"],
            },
            {
              raw_ref: "hn:another",
              platform: "hacker_news",
              observed_at: "2026-06-18T00:00:00.000Z",
              source_published_at: "2026-06-16T00:00:00.000Z",
              title: "Research agent another",
            },
          ],
          coverage: { hacker_news: { status: "ok" } },
        }),
    });
    const input = orchestratorInput([hackerNews], ["hacker-news"], {
      provider_configs: {
        "hacker-news": {
          live: {
            enabled: true,
            urls: ["https://hn.algolia.com/api/v1/search"],
          },
        },
      },
      quality_policy: {
        lookback_days: 180,
        max_items_per_query: 2,
        max_items_per_provider: 2,
        max_items_total: 3,
      },
    });

    const firstRun = await runAgentReachProviders(input);
    const secondRun = await runAgentReachProviders(input);

    expect(JSON.stringify(secondRun.items)).toBe(JSON.stringify(firstRun.items));
    expect(JSON.stringify(secondRun.warnings)).toBe(
      JSON.stringify(firstRun.warnings),
    );
  });
});
