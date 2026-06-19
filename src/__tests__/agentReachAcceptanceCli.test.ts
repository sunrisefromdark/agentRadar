import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  agentReachAcceptanceExitCode,
  parseAgentReachAcceptanceSmokeArgs,
  runAgentReachAcceptanceSmoke,
} from "../agentReach/acceptanceCli.ts";
import { runAgentReachDiscover } from "../agentReach/cli.ts";
import { createInMemoryAgentReachTransport } from "../agentReach/transport.ts";
import type { AgentReachArtifactWriteResult } from "../agentReach/types.ts";

const BASE_ARGV = ["node", "src/agentReach/acceptanceCli.ts"];
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentreach-smoke-"));
  tempDirs.push(dir);
  return dir;
}

function writeResult(input?: {
  status?: "ok" | "partial" | "failed";
  hackerNewsStatus?:
    | "ok"
    | "partial"
    | "not_configured"
    | "unavailable"
    | "failed";
  items?: AgentReachArtifactWriteResult["artifact"]["items"];
}): AgentReachArtifactWriteResult {
  const status = input?.status ?? "ok";
  const hackerNewsStatus = input?.hackerNewsStatus ?? "ok";
  return {
    output_path: "data/raw/external-discovery/2026-06-19.agent-reach.json",
    dry_run: true,
    coverage_summary: `hacker_news=${hackerNewsStatus}`,
    artifact: {
      provider: "agent-reach",
      schema_version: "agent-reach.external-discovery.v1",
      provider_run_id: "agentreach-2026-06-19",
      generated_at: "2026-06-19T12:00:00.000Z",
      query: { terms: ["research agent"] },
      platforms: input?.items?.length ? ["hacker_news"] : [],
      status,
      items:
        input?.items ??
        [{
          raw_ref: "hn:smoke",
          platform: "hacker_news",
          observed_at: "2026-06-19T12:00:00.000Z",
          source_published_at: "2026-06-18T12:00:00.000Z",
          url: "https://example.com/research-agent",
          title: "Research agent",
          direction_labels: ["research-agent"],
        }],
      diagnostics: { warnings: [] },
      coverage: {
        x_twitter: { status: "manual_import_only" },
        reddit: { status: "manual_import_only" },
        hacker_news: { status: hackerNewsStatus },
        official_web: { status: "not_configured" },
        official_blog: { status: "not_configured" },
      },
    },
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("AgentReach acceptance smoke CLI", () => {
  it("uses stable exit semantics", () => {
    expect(agentReachAcceptanceExitCode("pass")).toBe(0);
    expect(agentReachAcceptanceExitCode("warn")).toBe(0);
    expect(agentReachAcceptanceExitCode("fail")).toBe(1);
  });

  it("requires an explicit config path", () => {
    expect(() =>
      parseAgentReachAcceptanceSmokeArgs([
        ...BASE_ARGV,
        "--date",
        "2026-06-19",
      ]),
    ).toThrow("--config is required");
  });

  it("uses a fixed Hacker News provider and rejects provider overrides", () => {
    expect(
      parseAgentReachAcceptanceSmokeArgs([
        ...BASE_ARGV,
        "--date",
        "2026-06-19",
        "--config",
        "config/agentreach-live.json",
      ]),
    ).toEqual({
      date: "2026-06-19",
      configPath: "config/agentreach-live.json",
    });

    expect(() =>
      parseAgentReachAcceptanceSmokeArgs([
        ...BASE_ARGV,
        "--date",
        "2026-06-19",
        "--config",
        "config/agentreach-live.json",
        "--providers",
        "reddit",
      ]),
    ).toThrow("unknown argument: --providers");
  });

  it("always invokes producer dry-run and omits the config path from output", async () => {
    let seenOptions: unknown;
    const report = await runAgentReachAcceptanceSmoke(
      {
        date: "2026-06-19",
        configPath: "C:/private/agentreach-live.json",
      },
      {
        runAgentReachDiscover: async (options) => {
          seenOptions = options;
          return writeResult();
        },
      },
    );

    expect(seenOptions).toEqual({
      date: "2026-06-19",
      configPath: "C:/private/agentreach-live.json",
      providers: ["hacker-news"],
      dryRun: true,
    });
    expect(report.outcome).toBe("pass");
    expect(JSON.stringify(report)).not.toContain("C:/private");
  });

  it("fails unconfigured Hacker News instead of claiming zero results", async () => {
    const report = await runAgentReachAcceptanceSmoke(
      {
        date: "2026-06-19",
        configPath: "config/agentreach-live.json",
      },
      {
        runAgentReachDiscover: async () =>
          writeResult({
            hackerNewsStatus: "not_configured",
            items: [],
          }),
      },
    );

    expect(report).toMatchObject({
      outcome: "fail",
      required_platform_status: "not_configured",
      reasons: ["required_platform_status:not_configured"],
    });
    expect(report.reasons).not.toContain("zero_relevant_results");
  });

  it("uses the real producer dry-run path without writing an artifact", async () => {
    const tempDir = makeTempDir();
    const configPath = path.join(tempDir, "agentreach-live.json");
    const outputPath = path.join(tempDir, "should-not-exist.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        quality: {
          lookback_days: 30,
          max_items_per_query: 3,
          max_items_per_provider: 10,
          max_items_total: 20,
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
      "utf8",
    );

    const report = await runAgentReachAcceptanceSmoke(
      { date: "2026-06-19", configPath },
      {
        runAgentReachDiscover: (options) =>
          runAgentReachDiscover(
            {
              ...options,
              outputPath,
              generatedAt: "2026-06-19T12:00:00.000Z",
            },
            {
              transport: createInMemoryAgentReachTransport(() => ({
                status: 200,
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  hits: [{
                    objectID: "smoke-no-write",
                    title: "Research agent smoke",
                    url: "https://example.com/research-agent-smoke",
                    created_at: "2026-06-18T09:00:00.000Z",
                  }],
                }),
              })),
            },
          ),
      },
    );

    expect(report.outcome).toBe("pass");
    expect(fs.existsSync(outputPath)).toBe(false);
  });

  it("converts producer exceptions to a safe failure report", async () => {
    const report = await runAgentReachAcceptanceSmoke(
      {
        date: "2026-06-19",
        configPath: "C:/private/agentreach-live.json",
      },
      {
        runAgentReachDiscover: async () => {
          throw new Error("secret token and private config path");
        },
      },
    );

    expect(report).toMatchObject({
      outcome: "fail",
      producer_status: "not_run",
      reasons: ["producer_execution_failed"],
    });
    expect(JSON.stringify(report)).not.toMatch(/secret|token|private config/i);
  });
});
