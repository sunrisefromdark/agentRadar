import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  evaluateAgentReachArtifact,
  failedAgentReachAcceptanceReport,
} from "../agentReach/acceptance.ts";
import { writeAgentReachArtifact } from "../agentReach/artifactWriter.ts";
import { runAgentReachProviders } from "../agentReach/orchestrator.ts";
import { AGENT_REACH_PROVIDER_REGISTRY } from "../agentReach/providerRegistry.ts";
import { AGENT_REACH_QUERY_PACK } from "../agentReach/queryPack.ts";
import { applyAgentReachProviderQuality } from "../agentReach/quality.ts";
import { createInMemoryAgentReachTransport } from "../agentReach/transport.ts";
import { loadAgentReachProviderArtifact } from "../externalDiscovery/agentReachProvider.ts";
import type {
  AgentReachProviderArtifact,
  AgentReachProviderItem,
  AgentReachQualityPolicy,
} from "../agentReach/types.ts";

interface QualityFixture {
  generated_at: string;
  policy: AgentReachQualityPolicy;
  items: AgentReachProviderItem[];
  expected: {
    accepted_raw_refs: string[];
    warnings: string[];
  };
}

interface HackerNewsFixture {
  hits: Array<{
    objectID: string;
  }>;
}

function fixtureJson<T>(name: string): T {
  const filepath = path.join(
    process.cwd(),
    "data",
    "raw",
    "external-discovery",
    "fixtures",
    name,
  );
  return JSON.parse(fs.readFileSync(filepath, "utf8")) as T;
}

function artifact(
  overrides: Partial<AgentReachProviderArtifact> = {},
): AgentReachProviderArtifact {
  return {
    provider: "agent-reach",
    schema_version: "agent-reach.external-discovery.v1",
    provider_run_id: "agentreach-acceptance-fixture",
    generated_at: "2026-06-19T12:00:00.000Z",
    query: { terms: ["research agent"] },
    platforms: ["hacker_news"],
    status: "ok",
    items: [
      {
        raw_ref: "hn:acceptance",
        platform: "hacker_news",
        observed_at: "2026-06-19T12:00:00.000Z",
        source_published_at: "2026-06-18T12:00:00.000Z",
        url: "https://example.com/research-agent",
        title: "Research agent launch",
        direction_labels: ["research-agent"],
      },
    ],
    diagnostics: { warnings: [] },
    coverage: {
      x_twitter: { status: "manual_import_only" },
      reddit: { status: "manual_import_only" },
      hacker_news: { status: "ok" },
      official_web: { status: "not_configured" },
      official_blog: { status: "not_configured" },
    },
    ...overrides,
  };
}

describe("AgentReach producer acceptance baseline", () => {
  it("freezes representative research and office quality outcomes", () => {
    const fixture = fixtureJson<QualityFixture>(
      "agent-reach.quality-baseline.sanitized.json",
    );

    const result = applyAgentReachProviderQuality({
      providerId: "hacker-news",
      items: fixture.items,
      queryPack: AGENT_REACH_QUERY_PACK,
      generatedAt: fixture.generated_at,
      policy: fixture.policy,
      liveEnabled: true,
    });

    expect(result.items.map((item) => item.raw_ref)).toEqual(
      fixture.expected.accepted_raw_refs,
    );
    expect(result.warnings).toEqual(fixture.expected.warnings);
    expect(
      result.items.find((item) => item.raw_ref === "hn:accept-research")
        ?.metrics,
    ).toEqual({
      points: 30,
      comments: 8,
    });
    expect(
      Object.fromEntries(
        result.items.map((item) => [item.raw_ref, item.direction_labels]),
      ),
    ).toEqual({
      "hn:accept-research": ["research-agent"],
      "hn:accept-literature": [
        "literature-review-agent",
        "research-agent",
      ],
      "hn:accept-office": ["office-agent", "office-productivity-agent"],
      "hn:accept-spreadsheet": ["spreadsheet-agent", "office-agent"],
      "hn:accept-workflow": [
        "workflow-automation-agent",
        "office-productivity-agent",
      ],
    });
  });

  it("loads stable sanitized Hacker News and quality fixtures", () => {
    const hackerNewsFixture = fixtureJson<HackerNewsFixture>(
      "agent-reach.hacker-news-response.sanitized.json",
    );
    const qualityFixture = fixtureJson<QualityFixture>(
      "agent-reach.quality-baseline.sanitized.json",
    );

    expect(Array.isArray(hackerNewsFixture.hits)).toBe(true);
    expect(hackerNewsFixture.hits.map((hit) => hit.objectID)).toEqual([
      "fixture-hn-1",
      "fixture-hn-irrelevant",
      "fixture-hn-stale",
    ]);

    const sensitiveFixtureText =
      `${JSON.stringify(hackerNewsFixture)}${JSON.stringify(qualityFixture)}`;
    expect(sensitiveFixtureText).not.toMatch(
      /cookie|token|session|password|oauth|profile_url|content_text/i,
    );
  });

  it("passes a usable public-safe producer artifact", () => {
    expect(evaluateAgentReachArtifact(artifact())).toMatchObject({
      schema_version: "agent-reach.acceptance.v1",
      outcome: "pass",
      producer_status: "ok",
      item_count: 1,
      usable_item_count: 1,
      required_platform: "hacker_news",
      required_platform_status: "ok",
      coverage_status_counts: {
        manual_import_only: 2,
        not_configured: 2,
        ok: 1,
      },
      reasons: [],
    });
  });

  it("distinguishes zero relevant results from provider failure", () => {
    expect(evaluateAgentReachArtifact(artifact({ items: [] }))).toMatchObject({
      outcome: "warn",
      producer_status: "ok",
      reasons: ["zero_relevant_results"],
    });

    expect(
      evaluateAgentReachArtifact(
        artifact({
          status: "failed",
          items: [],
          coverage: {
            ...artifact().coverage,
            hacker_news: {
              status: "failed",
              reason: "provider_execution_failed",
            },
          },
        }),
      ),
    ).toMatchObject({
      outcome: "fail",
      producer_status: "failed",
      required_platform_status: "failed",
      reasons: [
        "producer_status:failed",
        "required_platform_status:failed",
      ],
    });
  });

  it("distinguishes partial, unconfigured, and unavailable HN coverage", () => {
    expect(
      evaluateAgentReachArtifact(
        artifact({
          status: "partial",
          diagnostics: { warnings: ["live_fetch_failed:timeout"] },
          coverage: {
            ...artifact().coverage,
            hacker_news: {
              status: "partial",
              reason: "provider_transport_partial",
            },
          },
        }),
      ),
    ).toMatchObject({
      outcome: "warn",
      required_platform_status: "partial",
      reasons: [
        "producer_status:partial",
        "required_platform_status:partial",
      ],
    });

    expect(
      evaluateAgentReachArtifact(
        artifact({
          items: [],
          coverage: {
            ...artifact().coverage,
            hacker_news: {
              status: "not_configured",
              reason: "provider_input_not_configured",
            },
          },
        }),
      ),
    ).toMatchObject({
      outcome: "fail",
      required_platform_status: "not_configured",
      reasons: ["required_platform_status:not_configured"],
    });

    expect(
      evaluateAgentReachArtifact(
        artifact({
          status: "failed",
          items: [],
          coverage: {
            ...artifact().coverage,
            hacker_news: {
              status: "unavailable",
              reason: "provider_transport_unavailable",
            },
          },
        }),
      ),
    ).toMatchObject({
      outcome: "fail",
      required_platform_status: "unavailable",
      reasons: [
        "producer_status:failed",
        "required_platform_status:unavailable",
      ],
    });
  });

  it("audits incomplete and duplicate items", () => {
    const duplicate = artifact().items[0];
    if (!duplicate) throw new Error("acceptance fixture item is missing");

    expect(
      evaluateAgentReachArtifact(
        artifact({
          items: [
            duplicate,
            { ...duplicate, title: undefined, direction_labels: undefined },
          ],
        }),
      ),
    ).toMatchObject({
      outcome: "warn",
      duplicate_identity_count: 1,
      missing_title_count: 1,
      missing_direction_labels_count: 1,
      reasons: ["incomplete_item_fields", "duplicate_item_identity"],
    });
  });

  it("fails malformed artifacts without required Hacker News coverage", () => {
    const malformed = artifact();
    delete (malformed.coverage as Partial<typeof malformed.coverage>)
      .hacker_news;

    expect(evaluateAgentReachArtifact(malformed)).toMatchObject({
      outcome: "fail",
      required_platform_status: "failed",
      reasons: ["required_platform_missing:hacker_news"],
    });
  });

  it("warns when accepted items are missing source published time", () => {
    const item = artifact().items[0];
    if (!item) throw new Error("acceptance fixture item is missing");

    expect(
      evaluateAgentReachArtifact(
        artifact({
          items: [{ ...item, source_published_at: undefined }],
        }),
      ),
    ).toMatchObject({
      outcome: "warn",
      missing_source_published_at_count: 1,
      reasons: ["missing_source_published_at"],
    });
  });

  it("fails unsafe artifacts and returns safe producer failure reports", () => {
    expect(
      evaluateAgentReachArtifact(
        artifact({
          query: { credential_hint: "token secret-value" },
        }),
      ),
    ).toMatchObject({
      outcome: "fail",
      reasons: ["public_safety_violation"],
    });

    const report = failedAgentReachAcceptanceReport();
    const serialized = JSON.stringify(report);
    expect(report).toMatchObject({
      outcome: "fail",
      producer_status: "not_run",
      required_platform_status: "failed",
      reasons: ["producer_execution_failed"],
    });
    expect(serialized).not.toMatch(/config|stack|token/i);
  });

  it("runs a sanitized HN response through provider, quality, artifact, and consumer", async () => {
    const response = fixtureJson<Record<string, unknown>>(
      "agent-reach.hacker-news-response.sanitized.json",
    );
    const transport = createInMemoryAgentReachTransport(() => ({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(response),
    }));
    const researchEntry = AGENT_REACH_QUERY_PACK.find(
      (entry) => entry.id === "research-agent",
    );
    if (!researchEntry) {
      throw new Error("research-agent query entry is missing");
    }
    const queryPack = [{
      ...researchEntry,
      terms: ["research agent"],
    }];

    const summary = await runAgentReachProviders({
      selected_provider_ids: ["hacker-news"],
      providers: AGENT_REACH_PROVIDER_REGISTRY,
      date: "2026-06-19",
      generated_at: "2026-06-19T12:00:00.000Z",
      query_pack: queryPack,
      provider_configs: {
        "hacker-news": {
          live: {
            enabled: true,
            urls: ["https://hn.algolia.com/api/v1/search"],
            query_limit: 1,
          },
        },
      },
      quality_policy: {
        lookback_days: 30,
        max_items_per_query: 10,
        max_items_per_provider: 20,
        max_items_total: 40,
      },
      transport,
    });

    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "agentreach-acceptance-"),
    );
    const outputPath = path.join(
      tempDir,
      "2026-06-19.agent-reach.json",
    );
    try {
      const writeResult = writeAgentReachArtifact({
        date: "2026-06-19",
        outputPath,
        providerRunId: "agentreach-acceptance",
        generatedAt: "2026-06-19T12:00:00.000Z",
        query: { terms: queryPack.flatMap((entry) => entry.terms) },
        platforms: ["hacker_news"],
        status: summary.status,
        items: summary.items,
        diagnostics: { warnings: summary.warnings },
        coverage: summary.coverage,
      });
      const consumer = loadAgentReachProviderArtifact({
        date: "2026-06-19",
        inputPath: outputPath,
      });

      expect(writeResult.artifact.items.map((item) => item.raw_ref)).toEqual([
        "hn:fixture-hn-1",
      ]);
      expect(writeResult.artifact.diagnostics.warnings).toEqual([
        "quality_filtered_irrelevant:hacker-news:1",
        "quality_filtered_stale:hacker-news:1",
      ]);
      expect(consumer.status).toBe("ok");
      expect(consumer.events).toHaveLength(1);
      expect(consumer.events[0]?.direction_labels).toContain(
        "research-agent",
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
