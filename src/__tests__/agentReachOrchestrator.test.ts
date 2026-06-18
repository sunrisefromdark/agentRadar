import { describe, expect, it } from "vitest";

import { runAgentReachProviders } from "../agentReach/orchestrator.ts";
import { selectAgentReachProviders } from "../agentReach/providerRegistry.ts";
import { createDisabledAgentReachTransport } from "../agentReach/transport.ts";
import type {
  AgentReachProducerProvider,
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
) {
  return {
    selected_provider_ids: selectedProviderIds,
    providers,
    date: "2026-06-18",
    generated_at: "2026-06-18T00:00:00.000Z",
    query_pack: [],
    provider_configs: {},
    transport: createDisabledAgentReachTransport(),
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
});
