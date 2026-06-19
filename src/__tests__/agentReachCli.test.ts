import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseAgentReachDiscoverArgs, runAgentReachDiscover } from "../agentReach/cli.ts";
import { defaultAgentReachProviderIds } from "../agentReach/providerRegistry.ts";
import { createInMemoryAgentReachTransport } from "../agentReach/transport.ts";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-reach-cli-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("AgentReach producer CLI", () => {
  it("delegates provider execution and aggregation to the orchestrator", () => {
    const source = fs.readFileSync("src/agentReach/cli.ts", "utf-8");

    expect(source).toContain('from "./orchestrator.ts"');
    expect(source).toContain("runAgentReachProviders");
    expect(source).toContain('from "./providerRegistry.ts"');
    expect(source).not.toContain("function computeStatus");
    expect(source).not.toContain("function runProvider");
    expect(source).not.toContain("loadRssBlogProvider");
    expect(source).not.toContain("loadOfficialWebProvider");
    expect(source).not.toContain("loadHackerNewsProvider");
    expect(source).not.toContain("loadExternalImportProvider");
  });

  it("is wired as an independent package script", () => {
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["agentreach:discover"]).toBe("tsx src/agentReach/cli.ts");
  });

  it("fails fast for empty or unknown providers", () => {
    expect(() =>
      parseAgentReachDiscoverArgs([
        "node",
        "src/agentReach/cli.ts",
        "--date",
        "2026-06-18",
        "--providers",
        "",
      ]),
    ).toThrow(/at least one provider/);

    expect(() =>
      parseAgentReachDiscoverArgs([
        "node",
        "src/agentReach/cli.ts",
        "--date",
        "2026-06-18",
        "--providers",
        "unknown-provider",
      ]),
    ).toThrow(/unknown provider/);
  });

  it("fails fast for an invalid date before deriving the output path", () => {
    expect(() =>
      parseAgentReachDiscoverArgs([
        "node",
        "src/agentReach/cli.ts",
        "--date",
        "../../reports/escaped",
        "--providers",
        "x_twitter",
        "--dry-run",
      ]),
    ).toThrow(/YYYY-MM-DD/);

    expect(() =>
      runAgentReachDiscover({
        date: "../../reports/escaped",
        providers: ["x_twitter"],
        dryRun: true,
      }),
    ).toThrow(/YYYY-MM-DD/);
  });

  it("accepts the pnpm script argument separator before CLI flags", () => {
    const opts = parseAgentReachDiscoverArgs([
      "node",
      "src/agentReach/cli.ts",
      "--",
      "--date",
      "2026-06-18",
      "--providers",
      "external-import",
      "--dry-run",
    ]);

    expect(opts.date).toBe("2026-06-18");
    expect(opts.providers).toEqual(["external-import"]);
    expect(opts.dryRun).toBe(true);
  });

  it("uses the shared default provider helper when no providers are specified", () => {
    const opts = parseAgentReachDiscoverArgs([
      "node",
      "src/agentReach/cli.ts",
      "--date",
      "2026-06-18",
      "--dry-run",
    ]);

    expect(opts.providers).toEqual(defaultAgentReachProviderIds());
  });

  it("dry-runs reserved providers without writing or crawling", async () => {
    const outputPath = path.join(makeTempDir(), "2026-06-18.agent-reach.json");
    const opts = parseAgentReachDiscoverArgs([
      "node",
      "src/agentReach/cli.ts",
      "--date",
      "2026-06-18",
      "--providers",
      "x_twitter,reddit",
      "--output",
      outputPath,
      "--dry-run",
    ]);

    const result = await runAgentReachDiscover(opts);

    expect(result.dry_run).toBe(true);
    expect(result.artifact.status).toBe("ok");
    expect(result.artifact.coverage.x_twitter.status).toBe("manual_import_only");
    expect(result.artifact.coverage.reddit.status).toBe("manual_import_only");
    expect(result.artifact.items).toEqual([]);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("writes external import artifacts for run-daily consumption", async () => {
    const dir = makeTempDir();
    const importPath = path.join(dir, "external-import.json");
    const outputPath = path.join(dir, "2026-06-18.agent-reach.json");
    fs.writeFileSync(
      importPath,
      JSON.stringify({
        items: [
          {
            raw_ref: "manual:official-blog:1",
            platform: "official_blog",
            observed_at: "2026-06-18T00:00:00.000Z",
            url: "https://example.com/agent-release",
            title: "Agent release",
            target: { name: "Example Agent" },
            direction_labels: ["office-agent"],
          },
        ],
      }),
      "utf-8",
    );

    const opts = parseAgentReachDiscoverArgs([
      "node",
      "src/agentReach/cli.ts",
      "--date",
      "2026-06-18",
      "--providers",
      "external-import",
      "--external-import",
      importPath,
      "--output",
      outputPath,
    ]);

    const result = await runAgentReachDiscover(opts);

    expect(result.dry_run).toBe(false);
    expect(result.artifact.items).toHaveLength(1);
    expect(result.artifact.coverage.official_blog.status).toBe("ok");
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it("loads configured low-risk provider inputs without wiring producer into run-daily", async () => {
    const dir = makeTempDir();
    const rssPath = path.join(dir, "rss-blog.json");
    const outputPath = path.join(dir, "2026-06-18.agent-reach.json");
    const configPath = path.join(dir, "agentreach.config.json");
    fs.writeFileSync(
      rssPath,
      JSON.stringify({
        items: [
          {
            raw_ref: "rss:blog:configured",
            observed_at: "2026-06-18T00:00:00.000Z",
            url: "https://example.com/blog/configured-agent",
            title: "Configured Agent",
          },
        ],
      }),
      "utf-8",
    );
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        providers: {
          "rss-blog": {
            input_path: rssPath,
          },
        },
      }),
      "utf-8",
    );

    const result = await runAgentReachDiscover(
      parseAgentReachDiscoverArgs([
        "node",
        "src/agentReach/cli.ts",
        "--date",
        "2026-06-18",
        "--providers",
        "rss-blog",
        "--config",
        configPath,
        "--output",
        outputPath,
        "--dry-run",
      ]),
    );

    expect(result.artifact.items[0]?.platform).toBe("official_blog");
    expect(result.artifact.coverage.official_blog.status).toBe("ok");
    expect(result.artifact.query).toEqual(
      expect.objectContaining({
        config_loaded: true,
      }),
    );
    expect(JSON.stringify(result.artifact)).not.toContain(configPath);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("loads and exposes a public-safe quality policy", async () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, "agentreach.config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        quality: {
          lookback_days: 30,
          max_items_per_query: 5,
          max_items_per_provider: 10,
          max_items_total: 25,
        },
        providers: {},
      }),
      "utf-8",
    );

    const result = await runAgentReachDiscover(
      parseAgentReachDiscoverArgs([
        "node",
        "src/agentReach/cli.ts",
        "--date",
        "2026-06-18",
        "--providers",
        "x_twitter",
        "--config",
        configPath,
        "--dry-run",
      ]),
    );

    expect(result.artifact.query).toEqual(
      expect.objectContaining({
        quality_policy: {
          lookback_days: 30,
          max_items_per_query: 5,
          max_items_per_provider: 10,
          max_items_total: 25,
        },
      }),
    );
    expect(JSON.stringify(result.artifact)).not.toContain(configPath);
  });

  it("loads quality-only config without requiring providers", async () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, "agentreach.config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        quality: {
          lookback_days: 45,
          max_items_per_query: 4,
          max_items_per_provider: 8,
          max_items_total: 16,
        },
      }),
      "utf-8",
    );

    const result = await runAgentReachDiscover(
      parseAgentReachDiscoverArgs([
        "node",
        "src/agentReach/cli.ts",
        "--date",
        "2026-06-18",
        "--providers",
        "x_twitter",
        "--config",
        configPath,
        "--dry-run",
      ]),
    );

    expect(result.artifact.query).toEqual(
      expect.objectContaining({
        quality_policy: {
          lookback_days: 45,
          max_items_per_query: 4,
          max_items_per_provider: 8,
          max_items_total: 16,
        },
      }),
    );
  });

  it("uses default quality policy without config", async () => {
    const result = await runAgentReachDiscover(
      parseAgentReachDiscoverArgs([
        "node",
        "src/agentReach/cli.ts",
        "--date",
        "2026-06-18",
        "--providers",
        "x_twitter",
        "--dry-run",
      ]),
    );

    expect(result.artifact.query).toEqual(
      expect.objectContaining({
        quality_policy: {
          lookback_days: 180,
          max_items_per_query: 20,
          max_items_per_provider: 50,
          max_items_total: 100,
        },
      }),
    );
  });

  it("fails before writing for invalid quality config", () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, "agentreach.config.json");
    const outputPath = path.join(dir, "2026-06-18.agent-reach.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        quality: {
          max_items_per_query: 20,
          max_items_per_provider: 10,
          max_items_total: 100,
        },
        providers: {},
      }),
      "utf-8",
    );

    expect(() =>
      runAgentReachDiscover(
        parseAgentReachDiscoverArgs([
          "node",
          "src/agentReach/cli.ts",
          "--date",
          "2026-06-18",
          "--providers",
          "x_twitter",
          "--config",
          configPath,
          "--output",
          outputPath,
          "--dry-run",
        ]),
      ),
    ).toThrow(/max_items_per_query/);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("fails fast when a provider config mixes local input and live fetch", async () => {
    const dir = makeTempDir();
    const rssPath = path.join(dir, "rss-blog.json");
    const configPath = path.join(dir, "agentreach.config.json");
    fs.writeFileSync(rssPath, JSON.stringify({ items: [] }), "utf-8");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        providers: {
          "rss-blog": {
            input_path: rssPath,
            live: {
              enabled: true,
              urls: ["https://example.com/rss.xml"],
            },
          },
        },
      }),
      "utf-8",
    );

    expect(() =>
      runAgentReachDiscover(
        parseAgentReachDiscoverArgs([
          "node",
          "src/agentReach/cli.ts",
          "--date",
          "2026-06-18",
          "--providers",
          "rss-blog",
          "--config",
          configPath,
          "--dry-run",
        ]),
      ),
    ).toThrow(/cannot combine input_path and live/);
  });

  it("fails fast for non-public or secret-bearing live URLs", () => {
    const cases = [
      "file:///tmp/rss.xml",
      "https://user:pass@example.com/rss.xml",
      "https://example.com/rss.xml?token=secret",
      "https://example.com/rss.xml?oauth=secret",
      "https://example.com/rss.xml?session=secret",
    ];

    for (const url of cases) {
      const dir = makeTempDir();
      const configPath = path.join(dir, "agentreach.config.json");
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          providers: {
            "rss-blog": {
              live: {
                enabled: true,
                urls: [url],
              },
            },
          },
        }),
        "utf-8",
      );

      expect(() =>
        runAgentReachDiscover(
          parseAgentReachDiscoverArgs([
            "node",
            "src/agentReach/cli.ts",
            "--date",
            "2026-06-18",
            "--providers",
            "rss-blog",
            "--config",
            configPath,
            "--dry-run",
          ]),
        ),
      ).toThrow(/provider live.urls must be public-safe/);
    }
  });

  it("dry-runs explicitly enabled live RSS config through an injected transport and prints coverage summary", async () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, "agentreach.config.json");
    const outputPath = path.join(dir, "2026-06-18.agent-reach.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        providers: {
          "rss-blog": {
            live: {
              enabled: true,
              urls: ["https://example.com/rss.xml"],
            },
          },
        },
      }),
      "utf-8",
    );
    const transport = createInMemoryAgentReachTransport(() => ({
      status: 200,
      headers: { "content-type": "application/rss+xml" },
      body: `<rss><channel><item>
        <title>Research agent RSS launch</title>
        <link>https://example.com/blog/live-rss-agent</link>
        <pubDate>Thu, 18 Jun 2026 10:00:00 GMT</pubDate>
      </item></channel></rss>`,
    }));

    const result = await runAgentReachDiscover(
      parseAgentReachDiscoverArgs([
        "node",
        "src/agentReach/cli.ts",
        "--date",
        "2026-06-18",
        "--providers",
        "rss-blog",
        "--config",
        configPath,
        "--output",
        outputPath,
        "--dry-run",
      ]),
      { transport },
    );

    expect(result.dry_run).toBe(true);
    expect(result.artifact.items[0]?.title).toBe("Research agent RSS launch");
    expect(result.artifact.coverage.official_blog.status).toBe("ok");
    expect(result.artifact.query).toEqual(
      expect.objectContaining({
        search_plan_summary: {
          job_count: 27,
          provider_count: 1,
          query_entry_count: 17,
          reserved_provider_count: 0,
          max_items_per_query: 20,
          provider_job_counts: {
            "rss-blog": 27,
          },
        },
      }),
    );
    expect(result.coverage_summary).toContain("official_blog=ok");
    expect(JSON.stringify(result.artifact)).not.toContain(configPath);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("dry-runs bounded live Hacker News artifacts deterministically", async () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, "agentreach.config.json");
    const outputPath = path.join(dir, "2026-06-18.agent-reach.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        quality: {
          lookback_days: 30,
          max_items_per_query: 2,
          max_items_per_provider: 2,
          max_items_total: 2,
        },
        providers: {
          "hacker-news": {
            live: {
              enabled: true,
              urls: ["https://hn.algolia.com/api/v1/search"],
              query_limit: 1,
            },
          },
        },
      }),
      "utf-8",
    );
    const transport = createInMemoryAgentReachTransport(() => ({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hits: [
          {
            objectID: "1",
            title: "Research agent one",
            url: "https://example.com/research-agent-one?utm_source=hn",
            created_at: "2026-06-17T00:00:00.000Z",
            points: 10,
            num_comments: 1,
          },
          {
            objectID: "2",
            title: "Research agent two",
            url: "https://example.com/research-agent-two",
            created_at: "2026-06-16T00:00:00.000Z",
            points: 5,
            num_comments: 3,
          },
          {
            objectID: "3",
            title: "Research agent three",
            url: "https://example.com/research-agent-three",
            created_at: "2026-06-15T00:00:00.000Z",
          },
        ],
      }),
    }));
    const opts = {
      ...parseAgentReachDiscoverArgs([
        "node",
        "src/agentReach/cli.ts",
        "--date",
        "2026-06-18",
        "--providers",
        "hacker-news",
        "--config",
        configPath,
        "--output",
        outputPath,
        "--dry-run",
      ]),
      generatedAt: "2026-06-18T00:00:00.000Z",
    };

    const first = await runAgentReachDiscover(opts, { transport });
    const second = await runAgentReachDiscover(opts, { transport });

    expect(first.artifact.query).toEqual(
      expect.objectContaining({
        quality_policy: {
          lookback_days: 30,
          max_items_per_query: 2,
          max_items_per_provider: 2,
          max_items_total: 2,
        },
      }),
    );
    expect(first.artifact.items.length).toBeLessThanOrEqual(2);
    expect(JSON.stringify(first.artifact.items)).toBe(
      JSON.stringify(second.artifact.items),
    );
    expect(JSON.stringify(first.artifact.diagnostics.warnings)).not.toMatch(
      /https?:|config|response body|token|cookie|session|oauth/i,
    );
    expect(first.dry_run).toBe(true);
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("keeps successful live discovery ok when quality removes every relevant item", async () => {
    const dir = makeTempDir();
    const configPath = path.join(dir, "agentreach.config.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        providers: {
          "hacker-news": {
            live: {
              enabled: true,
              urls: ["https://hn.algolia.com/api/v1/search"],
              query_limit: 1,
            },
          },
        },
      }),
      "utf-8",
    );
    const transport = createInMemoryAgentReachTransport(() => ({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hits: [
          {
            objectID: "generic",
            title: "A new AI agent",
            url: "https://example.com/new-ai-agent",
            created_at: "2026-06-17T00:00:00.000Z",
          },
        ],
      }),
    }));

    const result = await runAgentReachDiscover(
      {
        ...parseAgentReachDiscoverArgs([
          "node",
          "src/agentReach/cli.ts",
          "--date",
          "2026-06-18",
          "--providers",
          "hacker-news",
          "--config",
          configPath,
          "--dry-run",
        ]),
        generatedAt: "2026-06-18T00:00:00.000Z",
      },
      { transport },
    );

    expect(result.artifact.status).toBe("ok");
    expect(result.artifact.coverage.hacker_news.status).toBe("ok");
    expect(result.artifact.items).toEqual([]);
    expect(result.artifact.diagnostics.warnings).toContain(
      "quality_filtered_irrelevant:hacker-news:3",
    );
  });

  it("marks the artifact failed when the only active provider has no usable items", async () => {
    const dir = makeTempDir();
    const rssPath = path.join(dir, "rss-blog.json");
    const configPath = path.join(dir, "agentreach.config.json");
    fs.writeFileSync(
      rssPath,
      JSON.stringify({
        items: [
          {
            raw_ref: "rss:blog:unsafe",
            observed_at: "2026-06-18T00:00:00.000Z",
            url: "https://example.com/blog/unsafe",
            text: "OAuth token must not enter the artifact",
          },
        ],
      }),
      "utf-8",
    );
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        providers: {
          "rss-blog": {
            input_path: rssPath,
          },
        },
      }),
      "utf-8",
    );

    const result = await runAgentReachDiscover(
      parseAgentReachDiscoverArgs([
        "node",
        "src/agentReach/cli.ts",
        "--date",
        "2026-06-18",
        "--providers",
        "rss-blog",
        "--config",
        configPath,
        "--dry-run",
      ]),
    );

    expect(result.artifact.items).toEqual([]);
    expect(result.artifact.coverage.official_blog.status).toBe("failed");
    expect(result.artifact.status).toBe("failed");
  });

  it("keeps successful provider output when another selected provider fails", async () => {
    const dir = makeTempDir();
    const rssPath = path.join(dir, "rss-blog.json");
    const configPath = path.join(dir, "agentreach.config.json");
    fs.writeFileSync(
      rssPath,
      JSON.stringify({
        items: [
          {
            raw_ref: "rss:blog:ok",
            observed_at: "2026-06-18T00:00:00.000Z",
            url: "https://example.com/blog/ok",
          },
        ],
      }),
      "utf-8",
    );
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        providers: {
          "rss-blog": {
            input_path: rssPath,
          },
          "official-web": {
            input_path: path.join(dir, "missing.json"),
          },
        },
      }),
      "utf-8",
    );

    const result = await runAgentReachDiscover(
      parseAgentReachDiscoverArgs([
        "node",
        "src/agentReach/cli.ts",
        "--date",
        "2026-06-18",
        "--providers",
        "rss-blog,official-web",
        "--config",
        configPath,
        "--dry-run",
      ]),
    );

    expect(result.artifact.status).toBe("partial");
    expect(result.artifact.items).toHaveLength(1);
    expect(result.artifact.coverage.official_blog.status).toBe("ok");
    expect(result.artifact.coverage.official_web.status).toBe("failed");
    expect(result.artifact.diagnostics.warnings).toContain(
      "provider_failed:official-web:input_missing",
    );
  });

  it("writes a failed dry-run artifact for malformed configured external import", async () => {
    const dir = makeTempDir();
    const inputPath = path.join(dir, "external-import.json");
    fs.writeFileSync(inputPath, JSON.stringify({ unexpected: true }), "utf-8");

    const result = await runAgentReachDiscover(
      parseAgentReachDiscoverArgs([
        "node",
        "src/agentReach/cli.ts",
        "--date",
        "2026-06-18",
        "--providers",
        "external-import",
        "--external-import",
        inputPath,
        "--dry-run",
      ]),
    );

    expect(result.artifact.status).toBe("failed");
    expect(result.artifact.items).toEqual([]);
    expect(result.artifact.diagnostics.warnings).toContain(
      "provider_failed:external-import:input_invalid",
    );
  });
});
