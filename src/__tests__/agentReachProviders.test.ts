import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  externalImportProvider,
  loadExternalImportProvider,
} from "../agentReach/providers/externalImportProvider.ts";
import {
  hackerNewsProvider,
  loadHackerNewsProvider,
} from "../agentReach/providers/hackerNewsProvider.ts";
import {
  officialWebProvider,
  loadOfficialWebProvider,
} from "../agentReach/providers/officialWebProvider.ts";
import { redditProvider } from "../agentReach/providers/redditProvider.ts";
import {
  loadRssBlogProvider,
  rssBlogProvider,
} from "../agentReach/providers/rssBlogProvider.ts";
import { xTwitterProvider } from "../agentReach/providers/xTwitterProvider.ts";
import { AGENT_REACH_QUERY_PACK } from "../agentReach/queryPack.ts";
import { createDisabledAgentReachTransport } from "../agentReach/transport.ts";
import type {
  AgentReachProducerProvider,
  AgentReachProviderContext,
  AgentReachProviderId,
} from "../agentReach/types.ts";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-reach-provider-"));
  tempDirs.push(dir);
  return dir;
}

function writeImportArtifact(value: unknown): string {
  const filePath = path.join(makeTempDir(), "external-import.json");
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  return filePath;
}

function providerContext(inputPath?: string): AgentReachProviderContext {
  return {
    date: "2026-06-18",
    generated_at: "2026-06-18T00:00:00.000Z",
    query_pack: AGENT_REACH_QUERY_PACK,
    provider_config: {
      ...(inputPath ? { input_path: inputPath } : {}),
    },
    transport: createDisabledAgentReachTransport(),
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("AgentReach external import provider", () => {
  it("keeps normalization implementation in normalizer.ts", () => {
    const normalizerSource = fs.readFileSync("src/agentReach/normalizer.ts", "utf-8");
    const externalImportSource = fs.readFileSync(
      "src/agentReach/providers/externalImportProvider.ts",
      "utf-8",
    );

    expect(normalizerSource).toContain(
      "export function normalizeAgentReachProviderItems",
    );
    expect(normalizerSource).not.toContain(
      'from "./providers/externalImportProvider.ts"',
    );
    expect(externalImportSource).toContain('from "../normalizer.ts"');
    expect(externalImportSource).not.toContain(
      "function normalizeAgentReachProviderItems",
    );
  });

  it("runs active providers through one asynchronous provider contract", async () => {
    const fixtures: Partial<Record<AgentReachProviderId, string>> = {
      "external-import": writeImportArtifact({
        items: [
          {
            raw_ref: "manual:official-blog:contract",
            platform: "official_blog",
            observed_at: "2026-06-18T00:00:00.000Z",
            url: "https://example.com/blog/contract",
          },
        ],
      }),
      "rss-blog": writeImportArtifact({
        items: [
          {
            raw_ref: "rss:contract",
            observed_at: "2026-06-18T00:00:00.000Z",
            url: "https://example.com/blog/contract",
          },
        ],
      }),
      "official-web": writeImportArtifact({
        items: [
          {
            raw_ref: "official:contract",
            observed_at: "2026-06-18T00:00:00.000Z",
            url: "https://example.com/agents/contract",
          },
        ],
      }),
      "hacker-news": writeImportArtifact({
        items: [
          {
            raw_ref: "hn:contract",
            observed_at: "2026-06-18T00:00:00.000Z",
            url: "https://news.ycombinator.com/item?id=42",
          },
        ],
      }),
    } as const;
    const providers: AgentReachProducerProvider[] = [
      externalImportProvider,
      rssBlogProvider,
      officialWebProvider,
      hackerNewsProvider,
    ];

    for (const provider of providers) {
      const inputPath = fixtures[provider.provider_id];
      if (!inputPath) throw new Error(`missing test fixture for ${provider.provider_id}`);
      const result = await provider.run(providerContext(inputPath));
      expect(result.provider_id).toBe(provider.provider_id);
      expect(result.status).toBe("ok");
      expect(result.items).toHaveLength(1);
    }
  });

  it("returns not_configured for active providers without local input", async () => {
    for (const provider of [
      externalImportProvider,
      rssBlogProvider,
      officialWebProvider,
      hackerNewsProvider,
    ]) {
      const result = await provider.run(providerContext());
      expect(result.status).toBe("not_configured");
      expect(result.items).toEqual([]);
    }
  });

  it("runs reserved providers as manual-import-only placeholders", async () => {
    for (const provider of [xTwitterProvider, redditProvider]) {
      const result = await provider.run(providerContext());
      expect(result).toMatchObject({
        provider_id: provider.provider_id,
        status: "manual_import_only",
        items: [],
        rejected_items: [],
      });
      expect(result.coverage[provider.platform]?.status).toBe(
        "manual_import_only",
      );
    }
  });

  it("loads sanitized manual import items for reserved platforms without crawling", () => {
    const inputPath = writeImportArtifact({
      items: [
        {
          raw_ref: "manual:x:1",
          platform: "x_twitter",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://x.com/example/status/1",
          title: "Research agent launch discussion",
          target: { name: "Research Agent" },
          direction_labels: ["research-agent"],
          tags: ["manual-import"],
        },
      ],
    });

    const result = loadExternalImportProvider({ inputPath });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.platform).toBe("x_twitter");
    expect(result.coverage.x_twitter?.status).toBe("ok");
    expect(result.warnings).toEqual([]);
    expect(result.rejected_items).toEqual([]);
  });

  it("keeps only V1 classification hints from manual import items", () => {
    const inputPath = writeImportArtifact({
      items: [
        {
          raw_ref: "manual:official-blog:classification",
          platform: "official_blog",
          raw_event_kind: "blog_post",
          derived_signal_kinds: ["discovery", "unsupported", "evidence"],
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/blog/agent-release",
        },
      ],
    });

    const result = loadExternalImportProvider({ inputPath });

    expect(result.items[0]?.raw_event_kind).toBe("blog_post");
    expect(result.items[0]?.derived_signal_kinds).toEqual(["discovery", "evidence"]);
  });

  it("rejects unsupported platforms and public-unsafe fields", () => {
    const inputPath = writeImportArtifact({
      items: [
        {
          raw_ref: "manual:bad-platform",
          platform: "youtube",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/video",
        },
        {
          raw_ref: "manual:unsafe",
          platform: "reddit",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://reddit.com/r/agents/comments/1",
          text: "raw content with OAuth token should not be imported",
        },
      ],
    });

    const result = loadExternalImportProvider({ inputPath });

    expect(result.items).toEqual([]);
    expect(result.coverage.reddit?.status).toBe("failed");
    expect(result.rejected_items.map((item) => item.reason_code)).toEqual([
      "unsupported_platform",
      "public_unsafe_item",
    ]);
  });

  it("marks platform coverage partial when accepted and rejected items coexist", () => {
    const inputPath = writeImportArtifact({
      items: [
        {
          raw_ref: "manual:reddit:ok",
          platform: "reddit",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://reddit.com/r/agents/comments/ok",
        },
        {
          raw_ref: "manual:reddit:unsafe",
          platform: "reddit",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://reddit.com/r/agents/comments/unsafe",
          text: "OAuth token must not enter the artifact",
        },
      ],
    });

    const result = loadExternalImportProvider({ inputPath });

    expect(result.items).toHaveLength(1);
    expect(result.rejected_items).toHaveLength(1);
    expect(result.coverage.reddit?.status).toBe("partial");
  });

  it("rejects items without url or raw_ref", () => {
    const inputPath = writeImportArtifact({
      items: [
        {
          platform: "official_blog",
          observed_at: "2026-06-18T00:00:00.000Z",
          title: "Missing trace reference",
        },
      ],
    });

    const result = loadExternalImportProvider({ inputPath });

    expect(result.items).toEqual([]);
    expect(result.coverage.official_blog?.status).toBe("failed");
    expect(result.rejected_items[0]?.reason_code).toBe("missing_trace_ref");
  });

  it("loads low-risk provider fixture items with provider default platforms", () => {
    const rssPath = writeImportArtifact({
      items: [
        {
          raw_ref: "rss:blog:1",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/blog/agent-release",
          title: "Agent release blog",
        },
      ],
    });
    const officialWebPath = writeImportArtifact({
      items: [
        {
          raw_ref: "official:web:1",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/agents",
          title: "Agent product page",
        },
      ],
    });
    const hackerNewsPath = writeImportArtifact({
      items: [
        {
          raw_ref: "hn:item:1",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://news.ycombinator.com/item?id=1",
          title: "Agent discussion",
        },
      ],
    });

    expect(loadRssBlogProvider({ inputPath: rssPath }).items[0]?.platform).toBe("official_blog");
    expect(loadOfficialWebProvider({ inputPath: officialWebPath }).items[0]?.platform).toBe("official_web");
    expect(loadHackerNewsProvider({ inputPath: hackerNewsPath }).items[0]?.platform).toBe("hacker_news");
  });

  it("rejects a low-risk provider item that declares another provider platform", () => {
    const rssPath = writeImportArtifact({
      items: [
        {
          raw_ref: "rss:wrong-platform",
          platform: "reddit",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/blog/wrong-platform",
        },
      ],
    });

    const result = loadRssBlogProvider({ inputPath: rssPath });

    expect(result.items).toEqual([]);
    expect(result.rejected_items[0]?.reason_code).toBe("provider_platform_mismatch");
    expect(result.coverage.official_blog?.status).toBe("failed");
    expect(result.coverage.reddit).toBeUndefined();
  });

  it("rejects malformed external import top-level schema", () => {
    const inputPath = writeImportArtifact({ unexpected: true });

    expect(() => loadExternalImportProvider({ inputPath })).toThrow(/items\[\]/);
  });

  it("drops invalid direction labels before producing provider items", () => {
    const inputPath = writeImportArtifact({
      items: [
        {
          raw_ref: "manual:labels",
          platform: "official_blog",
          observed_at: "2026-06-18T00:00:00.000Z",
          url: "https://example.com/blog/labels",
          direction_labels: ["office-agent", "cool-agent"],
        },
      ],
    });

    const result = loadExternalImportProvider({ inputPath });

    expect(result.items[0]?.direction_labels).toEqual(["office-agent"]);
    expect(result.warnings).toContain("dropped_direction_label:cool-agent");
    expect(JSON.stringify(result.items)).not.toContain("cool-agent");
  });

  it("keeps X and Reddit as disabled manual-import-only provider descriptors", () => {
    expect(xTwitterProvider).toMatchObject({
      provider_id: "x_twitter",
      platform: "x_twitter",
      platforms: ["x_twitter"],
      mode: "manual_import_only",
      default_enabled: false,
    });
    expect(redditProvider).toMatchObject({
      provider_id: "reddit",
      platform: "reddit",
      platforms: ["reddit"],
      mode: "manual_import_only",
      default_enabled: false,
    });
  });
});
