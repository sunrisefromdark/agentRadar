# AgentReach Search Next Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Advance the next AgentReach search stage by improving the opt-in producer search pipeline, provider query planning, official sitemap/page discovery, and public-safe artifact diagnostics without changing the completed consumer backend.

**Architecture:** Keep work inside `src/agentReach/` plus producer-focused tests/docs. Add a reusable search planner that converts the atomic query pack and resolved quality policy into provider search jobs, then refactor low-risk live providers to consume those jobs through the existing transport/quality/orchestrator boundary. The output remains the same `agent-reach.external-discovery.v1` artifact contract consumed later by existing `src/externalDiscovery/`.

**Tech Stack:** TypeScript, Vitest, existing AgentReach producer modules, mockable transport, public-safe artifact writer, local fixture tests.

---

## Scope correction

This stage is AgentReach search work, not consumer-backend work.

In scope:

- `src/agentReach/` search planning and provider execution.
- HN / RSS / Official Web low-risk opt-in search behavior.
- Official sitemap XML/HTML fixture support.
- Public-safe producer diagnostics and dry-run search plan summaries.
- Compatibility tests proving the generated artifact is still readable by the existing consumer adapter.

Out of scope:

- `src/search/` fuzzy/project search backend.
- `src/visualConsole/` rendering.
- daily / weekly output redesign.
- consumer backend docs or consumer implementation changes.
- X / Twitter API, Reddit OAuth/API, browser crawler, recursive web crawler, account state, cookies, sessions, OAuth, tokens.
- Any change to `RawSignal[]`, scoring, `discussion_score`, or primary daily project arrays.

## Files and responsibilities

- Create `src/agentReach/searchPlanner.ts`
  - Build stable provider search jobs from query pack, selected providers, provider configs, and quality policy.
  - Keep provider order deterministic and public-safe.
- Modify `src/agentReach/types.ts`
  - Add `AgentReachSearchJob`, `AgentReachSearchPlanSummary`, and provider context fields required by the planner.
- Modify `src/agentReach/orchestrator.ts`
  - Build the search plan once and pass provider-specific jobs into providers.
- Modify `src/agentReach/cli.ts`
  - Include search plan summary in dry-run and artifact `query`.
- Modify `src/agentReach/providers/hackerNewsProvider.ts`
  - Consume planner jobs instead of re-flattening query pack terms.
- Modify `src/agentReach/providers/rssBlogProvider.ts`
  - Consume planner jobs for local/live relevance selection where provider behavior currently depends on broad feed reads.
- Modify `src/agentReach/providers/officialWebProvider.ts`
  - Add official sitemap XML/HTML fixture parsing and bounded same-origin page extraction.
- Modify `src/agentReach/quality.ts`
  - Reuse existing relevance filtering; only add helpers if planner/provider tests reveal duplication.
- Test files:
  - Create `src/__tests__/agentReachSearchPlanner.test.ts`
  - Extend `src/__tests__/agentReachProviders.test.ts`
  - Extend `src/__tests__/agentReachCli.test.ts`
  - Extend `src/__tests__/agentReachOrchestrator.test.ts`
  - Extend `src/__tests__/externalDiscoveryAdapter.test.ts` only for generated artifact compatibility.
- Docs:
  - Update `docs/specs/exec-plans/agent-reach-artifact-producer-v0.1.exec-plan.md`
  - Update `docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md` producer addendum only
  - Update `README.md` / `README.en.md` AgentReach producer command notes only

## Task 1: Search planner contract

**Files:**

- Create: `src/agentReach/searchPlanner.ts`
- Modify: `src/agentReach/types.ts`
- Test: `src/__tests__/agentReachSearchPlanner.test.ts`

- [ ] **Step 1: Write the failing planner tests**

Create `src/__tests__/agentReachSearchPlanner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAgentReachSearchPlan } from "../agentReach/searchPlanner.ts";
import type { AgentReachQualityPolicy } from "../agentReach/types.ts";
import type { AgentReachProviderId } from "../agentReach/types.ts";

const quality: AgentReachQualityPolicy = {
  lookback_days: 30,
  max_items_per_query: 5,
  max_items_per_provider: 20,
  max_items_total: 40,
};

const queryPack = [
  {
    id: "literature-review-agent",
    terms: ["literature review agent", "paper reading agent"],
    direction_labels: ["literature-review-agent", "research-agent"],
    tags: ["research", "papers"],
  },
  {
    id: "document-agent",
    terms: ["document agent"],
    direction_labels: ["document-agent", "office-agent"],
    tags: ["office", "documents"],
  },
] as const;

describe("AgentReach search planner", () => {
  it("builds stable provider jobs in registry/provider/query/term order", () => {
    const plan = buildAgentReachSearchPlan({
      selectedProviderIds: ["hacker-news", "official-web"] as AgentReachProviderId[],
      queryPack,
      qualityPolicy: quality,
      providerConfigs: {},
    });

    expect(plan.jobs.map((job) => `${job.provider_id}:${job.query_entry_id}:${job.term}`)).toEqual([
      "official-web:literature-review-agent:literature review agent",
      "official-web:literature-review-agent:paper reading agent",
      "official-web:document-agent:document agent",
      "hacker-news:literature-review-agent:literature review agent",
      "hacker-news:literature-review-agent:paper reading agent",
      "hacker-news:document-agent:document agent",
    ]);
    expect(plan.jobs.every((job) => job.max_items === 5)).toBe(true);
    expect(plan.summary).toMatchObject({
      job_count: 6,
      provider_count: 2,
      query_entry_count: 2,
      max_items_per_query: 5,
    });
  });

  it("does not create live search jobs for import or reserved manual-only providers", () => {
    const plan = buildAgentReachSearchPlan({
      selectedProviderIds: ["external-import", "x_twitter", "reddit"] as AgentReachProviderId[],
      queryPack,
      qualityPolicy: quality,
      providerConfigs: {},
    });

    expect(plan.jobs).toEqual([]);
    expect(plan.summary.provider_count).toBe(0);
    expect(plan.summary.reserved_provider_count).toBe(2);
  });

  it("applies provider query_limit without mutating the query pack", () => {
    const plan = buildAgentReachSearchPlan({
      selectedProviderIds: ["hacker-news"] as AgentReachProviderId[],
      queryPack,
      qualityPolicy: quality,
      providerConfigs: {
        "hacker-news": {
          live: {
            enabled: true,
            urls: ["https://hn.algolia.com/api/v1/search"],
            query_limit: 1,
            timeout_ms: 1000,
            max_response_bytes: 10000,
          },
        },
      },
    });

    expect(plan.jobs.map((job) => job.query_entry_id)).toEqual(["literature-review-agent"]);
    expect(queryPack).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the planner test and confirm it fails**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachSearchPlanner.test.ts
```

Expected: module-not-found failure for `searchPlanner.ts`.

- [ ] **Step 3: Add planner types**

In `src/agentReach/types.ts`, add:

```ts
export interface AgentReachSearchJob {
  job_id: string;
  provider_id: AgentReachProviderId;
  query_entry_id: string;
  term: string;
  direction_labels: ExternalDirectionLabel[];
  tags: string[];
  max_items: number;
}

export interface AgentReachSearchPlanSummary {
  job_count: number;
  provider_count: number;
  query_entry_count: number;
  reserved_provider_count: number;
  max_items_per_query: number;
  provider_job_counts: Partial<Record<AgentReachProviderId, number>>;
}

export interface AgentReachSearchPlan {
  jobs: AgentReachSearchJob[];
  summary: AgentReachSearchPlanSummary;
}

export type AgentReachProviderConfigMap = Partial<
  Record<AgentReachProviderId, AgentReachProviderConfig>
>;
```

`AgentReachProviderConfig` and `AgentReachProviderId` already live in `src/agentReach/types.ts`; keep the alias there to avoid inventing a provider-registry dependency.

- [ ] **Step 4: Implement `src/agentReach/searchPlanner.ts`**

Create:

```ts
import type { AgentReachQueryEntry } from "./queryPack.ts";
import { AGENT_REACH_PROVIDER_REGISTRY } from "./providerRegistry.ts";
import type {
  AgentReachProviderConfigMap,
  AgentReachProviderId,
  AgentReachQualityPolicy,
  AgentReachSearchJob,
  AgentReachSearchPlan,
} from "./types.ts";

const SEARCH_PROVIDER_IDS = new Set<AgentReachProviderId>([
  "rss-blog",
  "official-web",
  "hacker-news",
]);

const RESERVED_PROVIDER_IDS = new Set<AgentReachProviderId>(["x_twitter", "reddit"]);

function stableJobId(input: {
  providerId: AgentReachProviderId;
  queryEntryId: string;
  term: string;
}): string {
  return `${input.providerId}:${input.queryEntryId}:${input.term.toLowerCase().replace(/\s+/g, "-")}`;
}

function selectedProviderOrder(selectedProviderIds: AgentReachProviderId[]): AgentReachProviderId[] {
  const selected = new Set(selectedProviderIds);
  return AGENT_REACH_PROVIDER_REGISTRY
    .map((provider) => provider.provider_id)
    .filter((providerId) => selected.has(providerId));
}

function applyQueryLimit(
  providerId: AgentReachProviderId,
  queryPack: readonly AgentReachQueryEntry[],
  providerConfigs: AgentReachProviderConfigMap,
): readonly AgentReachQueryEntry[] {
  const queryLimit = providerConfigs[providerId]?.live?.query_limit;
  return typeof queryLimit === "number" && queryLimit > 0
    ? queryPack.slice(0, queryLimit)
    : queryPack;
}

export function buildAgentReachSearchPlan(input: {
  selectedProviderIds: AgentReachProviderId[];
  queryPack: readonly AgentReachQueryEntry[];
  qualityPolicy: AgentReachQualityPolicy;
  providerConfigs: AgentReachProviderConfigMap;
}): AgentReachSearchPlan {
  const jobs: AgentReachSearchJob[] = [];
  const orderedProviders = selectedProviderOrder(input.selectedProviderIds);
  const reservedProviderCount = orderedProviders.filter((providerId) => RESERVED_PROVIDER_IDS.has(providerId)).length;

  for (const providerId of orderedProviders) {
    if (!SEARCH_PROVIDER_IDS.has(providerId)) continue;
    for (const entry of applyQueryLimit(providerId, input.queryPack, input.providerConfigs)) {
      for (const term of entry.terms) {
        jobs.push({
          job_id: stableJobId({ providerId, queryEntryId: entry.id, term }),
          provider_id: providerId,
          query_entry_id: entry.id,
          term,
          direction_labels: [...entry.direction_labels],
          tags: [...entry.tags],
          max_items: input.qualityPolicy.max_items_per_query,
        });
      }
    }
  }

  const providerJobCounts: AgentReachSearchPlan["summary"]["provider_job_counts"] = {};
  for (const job of jobs) {
    providerJobCounts[job.provider_id] = (providerJobCounts[job.provider_id] ?? 0) + 1;
  }

  return {
    jobs,
    summary: {
      job_count: jobs.length,
      provider_count: orderedProviders.filter((providerId) => SEARCH_PROVIDER_IDS.has(providerId)).length,
      query_entry_count: new Set(jobs.map((job) => job.query_entry_id)).size,
      reserved_provider_count: reservedProviderCount,
      max_items_per_query: input.qualityPolicy.max_items_per_query,
      provider_job_counts: providerJobCounts,
    },
  };
}
```

- [ ] **Step 5: Run the planner test**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachSearchPlanner.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src\agentReach\types.ts src\agentReach\searchPlanner.ts src\__tests__\agentReachSearchPlanner.test.ts
git commit -m "feat(agentreach): add producer search planner"
```

## Task 2: Wire search plan through orchestrator and CLI dry-run

**Files:**

- Modify: `src/agentReach/orchestrator.ts`
- Modify: `src/agentReach/cli.ts`
- Modify: `src/agentReach/types.ts`
- Test: `src/__tests__/agentReachOrchestrator.test.ts`
- Test: `src/__tests__/agentReachCli.test.ts`

- [ ] **Step 1: Add failing tests for search plan summary**

In `src/__tests__/agentReachOrchestrator.test.ts`, add:

```ts
it("passes provider-specific search jobs into provider context", async () => {
  const seenJobTerms: string[] = [];
  const provider = {
    provider_id: "hacker-news",
    platforms: ["hacker_news"],
    mode: "active",
    default_enabled: false,
    async run(context) {
      seenJobTerms.push(...context.search_jobs.map((job) => job.term));
      return {
        provider_id: "hacker-news",
        status: "ok",
        items: [],
        warnings: [],
        rejected_items: [],
        coverage: { hacker_news: { status: "ok" } },
      };
    },
  };

  await runAgentReachProviders({
    selected_provider_ids: ["hacker-news"],
    providers: [provider],
    date: "2026-06-19",
    query_pack: [
      { id: "document-agent", terms: ["document agent"], direction_labels: ["document-agent"], tags: ["office"] },
    ],
    quality_policy: { lookback_days: 30, max_items_per_query: 3, max_items_per_provider: 10, max_items_total: 20 },
    provider_configs: {},
    transport: createDisabledAgentReachTransport(),
    generated_at: "2026-06-19T00:00:00.000Z",
  });

  expect(seenJobTerms).toEqual(["document agent"]);
});
```

In `src/__tests__/agentReachCli.test.ts`, assert dry-run output or artifact query includes:

```ts
expect(output.query.search_plan_summary).toMatchObject({
  job_count: expect.any(Number),
  max_items_per_query: 20,
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachOrchestrator.test.ts src\__tests__\agentReachCli.test.ts
```

Expected: fail because provider context lacks `search_jobs` / `search_plan_summary`.

- [ ] **Step 3: Extend provider context**

In `src/agentReach/types.ts`, add to `AgentReachProviderContext`:

```ts
search_jobs: AgentReachSearchJob[];
search_plan_summary: AgentReachSearchPlanSummary;
```

- [ ] **Step 4: Build plan in orchestrator**

In `src/agentReach/orchestrator.ts`, import:

```ts
import { buildAgentReachSearchPlan } from "./searchPlanner.ts";
```

Before provider execution:

```ts
const searchPlan = buildAgentReachSearchPlan({
  selectedProviderIds: input.selected_provider_ids,
  queryPack: input.query_pack,
  qualityPolicy: input.quality_policy,
  providerConfigs: input.provider_configs,
});
```

When building each provider context:

```ts
search_jobs: searchPlan.jobs.filter((job) => job.provider_id === provider.provider_id),
search_plan_summary: searchPlan.summary,
```

Return or expose `search_plan_summary` in the orchestrator result if CLI builds `query` after orchestrator completion.

- [ ] **Step 5: Add CLI query metadata**

In `src/agentReach/cli.ts`, include:

```ts
search_plan_summary: result.search_plan_summary,
```

inside the artifact `query` object and dry-run output. Keep it public-safe: counts, provider IDs, and query entry IDs are allowed; config paths, response bodies, account settings, cookies, tokens, and raw HTML are not allowed.

- [ ] **Step 6: Run focused tests**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachOrchestrator.test.ts src\__tests__\agentReachCli.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit Task 2**

```powershell
git add src\agentReach\types.ts src\agentReach\orchestrator.ts src\agentReach\cli.ts src\__tests__\agentReachOrchestrator.test.ts src\__tests__\agentReachCli.test.ts
git commit -m "feat(agentreach): expose producer search plan summary"
```

## Task 3: Refactor Hacker News provider to consume planner jobs

**Files:**

- Modify: `src/agentReach/providers/hackerNewsProvider.ts`
- Test: `src/__tests__/agentReachProviders.test.ts`

- [ ] **Step 1: Add failing HN planner-job tests**

In `src/__tests__/agentReachProviders.test.ts`, add:

```ts
it("hacker-news live search uses provider search jobs instead of flattening the whole query pack", async () => {
  const requestedUrls: string[] = [];
  const transport = createInMemoryAgentReachTransport((request) => {
    requestedUrls.push(request.url);
    return {
      status: 200,
      headers: {},
      body: JSON.stringify({ hits: [] }),
    };
  });

  await hackerNewsProvider.run({
    provider_id: "hacker-news",
    provider_config: {
      live: {
        enabled: true,
        urls: ["https://hn.algolia.com/api/v1/search"],
        timeout_ms: 1000,
        max_response_bytes: 10000,
      },
    },
    transport,
    generated_at: "2026-06-19T00:00:00.000Z",
    quality_policy: { lookback_days: 30, max_items_per_query: 7, max_items_per_provider: 20, max_items_total: 40 },
    query_pack: [
      { id: "unused", terms: ["should not appear"], direction_labels: ["research-agent"], tags: [] },
    ],
    search_jobs: [
      {
        job_id: "hacker-news:document-agent:document-agent",
        provider_id: "hacker-news",
        query_entry_id: "document-agent",
        term: "document agent",
        direction_labels: ["document-agent"],
        tags: ["office"],
        max_items: 7,
      },
    ],
    search_plan_summary: {
      job_count: 1,
      provider_count: 1,
      query_entry_count: 1,
      reserved_provider_count: 0,
      max_items_per_query: 7,
      provider_job_counts: { "hacker-news": 1 },
    },
  });

  expect(requestedUrls).toHaveLength(1);
  expect(requestedUrls[0]).toContain("query=document%20agent");
  expect(requestedUrls[0]).toContain("hitsPerPage=7");
  expect(requestedUrls[0]).not.toContain("should%20not%20appear");
});
```

- [ ] **Step 2: Run provider test and confirm failure**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachProviders.test.ts
```

Expected: fail because HN still reads `query_pack.flatMap`.

- [ ] **Step 3: Update HN provider**

In `src/agentReach/providers/hackerNewsProvider.ts`, replace:

```ts
const queryLimit = context.provider_config.live.query_limit ?? 3;
const terms = context.query_pack.flatMap((entry) => entry.terms).slice(0, queryLimit);
const maxHitsPerQuery = context.quality_policy.max_items_per_query;
```

with:

```ts
const jobs = context.search_jobs.length > 0 ? context.search_jobs : [];
const terms = jobs.map((job) => job.term);
const maxHitsPerQuery = context.quality_policy.max_items_per_query;
```

If `terms.length === 0`, return `ok` coverage with zero items and warning `search_plan_empty:hacker-news`.

- [ ] **Step 4: Run HN provider tests**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachProviders.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 3**

```powershell
git add src\agentReach\providers\hackerNewsProvider.ts src\__tests__\agentReachProviders.test.ts
git commit -m "feat(agentreach): route hacker news search through planner jobs"
```

## Task 4: Add official sitemap XML/HTML fixture support

**Files:**

- Modify: `src/agentReach/providers/officialWebProvider.ts`
- Test: `src/__tests__/agentReachProviders.test.ts`

- [ ] **Step 1: Add failing official sitemap tests**

Add tests for XML sitemap and HTML sitemap fixtures:

```ts
it("official-web parses allowlisted XML sitemap and extracts relevant same-origin pages", async () => {
  const transport = createInMemoryAgentReachTransport((request) => {
    if (request.url.endsWith("/sitemap.xml")) {
      return {
        status: 200,
        headers: {},
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <urlset>
            <url><loc>https://example.com/literature-agent</loc><lastmod>2026-06-01</lastmod></url>
            <url><loc>https://other.example.com/out-of-scope</loc></url>
          </urlset>`,
      };
    }
    if (request.url.endsWith("/literature-agent")) {
      return {
        status: 200,
        headers: {},
        body: `<html><head><title>Literature Review Agent</title><meta name="description" content="AI paper reading assistant"></head></html>`,
      };
    }
    throw new Error(`unexpected url ${request.url}`);
  });

  const result = await officialWebProvider.run({
    provider_id: "official-web",
    provider_config: {
      live: {
        enabled: true,
        urls: ["https://example.com/sitemap.xml"],
        timeout_ms: 1000,
        max_response_bytes: 10000,
      },
    },
    transport,
    generated_at: "2026-06-19T00:00:00.000Z",
    quality_policy: { lookback_days: 90, max_items_per_query: 5, max_items_per_provider: 10, max_items_total: 20 },
    query_pack: [],
    search_jobs: [
      {
        job_id: "official-web:literature-review-agent:literature-review-agent",
        provider_id: "official-web",
        query_entry_id: "literature-review-agent",
        term: "literature review agent",
        direction_labels: ["literature-review-agent"],
        tags: ["research"],
        max_items: 5,
      },
    ],
    search_plan_summary: {
      job_count: 1,
      provider_count: 1,
      query_entry_count: 1,
      reserved_provider_count: 0,
      max_items_per_query: 5,
      provider_job_counts: { "official-web": 1 },
    },
  });

  expect(result.status).toBe("ok");
  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({
    platform: "official_web",
    target: { name: "Literature Review Agent" },
    direction_labels: ["literature-review-agent"],
  });
  expect(result.warnings).toContain("official-web:sitemap_urls=1");
});
```

- [ ] **Step 2: Run provider test and confirm failure**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachProviders.test.ts
```

Expected: fail because sitemap parsing is not implemented.

- [ ] **Step 3: Implement bounded sitemap parsing**

In `officialWebProvider.ts`, add helpers:

```ts
function sameOriginUrl(candidate: string, base: string): string | null {
  try {
    const parsed = new URL(candidate);
    const baseUrl = new URL(base);
    if (parsed.origin !== baseUrl.origin) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function extractXmlSitemapUrls(xml: string, baseUrl: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => sameOriginUrl(match[1].trim(), baseUrl))
    .filter((value): value is string => Boolean(value));
}

function extractHtmlSitemapUrls(html: string, baseUrl: string): string[] {
  return [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        return null;
      }
    })
    .map((url) => (url ? sameOriginUrl(url, baseUrl) : null))
    .filter((value): value is string => Boolean(value));
}
```

For each configured live URL:

- Fetch the URL.
- If it looks like sitemap XML, extract same-origin URLs.
- If it looks like HTML sitemap, extract same-origin links.
- Cap extracted URLs to `context.quality_policy.max_items_per_query`.
- Fetch only those pages through `context.transport.request`; this path is provider-specific because the shared `runLiveProvider` helper only supports a single fetch/parse pass.
- Extract title/meta description.
- Emit items only when the page title/description/url matches at least one `context.search_jobs` term using the existing quality relevance later.
- Add public-safe warnings like `official-web:sitemap_urls=<count>`.

- [ ] **Step 4: Run provider tests**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachProviders.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 4**

```powershell
git add src\agentReach\providers\officialWebProvider.ts src\__tests__\agentReachProviders.test.ts
git commit -m "feat(agentreach): support bounded official sitemap search"
```

## Task 5: Align RSS provider with planner jobs

**Files:**

- Modify: `src/agentReach/providers/rssBlogProvider.ts`
- Test: `src/__tests__/agentReachProviders.test.ts`

- [ ] **Step 1: Add failing RSS planner-job test**

Add a test:

```ts
it("rss-blog uses search jobs to keep relevant feed items and ignore unrelated entries", async () => {
  const transport = createInMemoryAgentReachTransport(() => ({
    status: 200,
    headers: {},
    body: `<?xml version="1.0"?>
        <rss><channel>
          <item><title>Document Agent launch</title><link>https://example.com/doc</link><pubDate>Fri, 19 Jun 2026 00:00:00 GMT</pubDate></item>
          <item><title>Unrelated weather update</title><link>https://example.com/weather</link><pubDate>Fri, 19 Jun 2026 00:00:00 GMT</pubDate></item>
        </channel></rss>`,
  }));

  const result = await rssBlogProvider.run({
    provider_id: "rss-blog",
    provider_config: {
      live: {
        enabled: true,
        urls: ["https://example.com/feed.xml"],
        timeout_ms: 1000,
        max_response_bytes: 10000,
      },
    },
    transport,
    generated_at: "2026-06-19T00:00:00.000Z",
    quality_policy: { lookback_days: 90, max_items_per_query: 5, max_items_per_provider: 10, max_items_total: 20 },
    query_pack: [],
    search_jobs: [
      {
        job_id: "rss-blog:document-agent:document-agent",
        provider_id: "rss-blog",
        query_entry_id: "document-agent",
        term: "document agent",
        direction_labels: ["document-agent"],
        tags: ["office"],
        max_items: 5,
      },
    ],
    search_plan_summary: {
      job_count: 1,
      provider_count: 1,
      query_entry_count: 1,
      reserved_provider_count: 0,
      max_items_per_query: 5,
      provider_job_counts: { "rss-blog": 1 },
    },
  });

  expect(result.items.map((item) => item.title)).toEqual(["Document Agent launch"]);
});
```

- [ ] **Step 2: Run provider test and confirm failure**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachProviders.test.ts
```

Expected: fail if RSS currently accepts unrelated feed entries.

- [ ] **Step 3: Filter RSS items by search jobs**

In `rssBlogProvider.ts`, add:

```ts
function matchesSearchJobText(text: string, jobs: AgentReachProviderContext["search_jobs"]): boolean {
  const normalized = text.toLowerCase();
  return jobs.length === 0 || jobs.some((job) => normalized.includes(job.term.toLowerCase()));
}
```

Apply before normalizing a feed item:

```ts
const searchable = [title, link, summary].filter(Boolean).join(" ");
if (!matchesSearchJobText(searchable, context.search_jobs)) continue;
```

When a job matches, use the matched job’s `direction_labels` and `tags` if the raw item does not already have safer labels.

- [ ] **Step 4: Run provider tests**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachProviders.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 5**

```powershell
git add src\agentReach\providers\rssBlogProvider.ts src\__tests__\agentReachProviders.test.ts
git commit -m "feat(agentreach): align rss search with planner jobs"
```

## Task 6: Artifact compatibility and public-safe query metadata

**Files:**

- Modify: `src/agentReach/artifactWriter.ts` only if public-safe validation needs an allowlist update.
- Test: `src/__tests__/agentReachArtifactWriter.test.ts`
- Test: `src/__tests__/externalDiscoveryAdapter.test.ts`

- [ ] **Step 1: Add compatibility test**

In `src/__tests__/externalDiscoveryAdapter.test.ts`, add a fixture artifact with:

```ts
query: {
  terms: ["document agent"],
  quality_policy: {
    lookback_days: 30,
    max_items_per_query: 5,
    max_items_per_provider: 20,
    max_items_total: 40,
  },
  search_plan_summary: {
    job_count: 1,
    provider_count: 1,
    query_entry_count: 1,
    reserved_provider_count: 0,
    max_items_per_query: 5,
    provider_job_counts: { "hacker-news": 1 },
  },
}
```

Assert existing `readAgentReachProviderArtifact` accepts the artifact and does not expose private config.

- [ ] **Step 2: Run compatibility tests**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachArtifactWriter.test.ts src\__tests__\externalDiscoveryAdapter.test.ts
```

Expected: pass. If writer rejects safe `search_plan_summary`, update validation narrowly.

- [ ] **Step 3: Keep query metadata public-safe**

If needed in `artifactWriter.ts`, preserve this invariant:

```ts
if (containsForbiddenPublicArtifactText(artifact.query)) {
  throw new Error("AgentReach query is not public-safe");
}
```

Do not add config path, URL credentials, response body, cookie, session, OAuth, token, or account settings to `query`.

- [ ] **Step 4: Commit Task 6**

```powershell
git add src\agentReach\artifactWriter.ts src\__tests__\agentReachArtifactWriter.test.ts src\__tests__\externalDiscoveryAdapter.test.ts
git commit -m "test(agentreach): preserve consumer compatibility for search metadata"
```

## Task 7: Producer docs only

**Files:**

- Modify: `docs/specs/exec-plans/agent-reach-artifact-producer-v0.1.exec-plan.md`
- Modify: `docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `src/__tests__/externalDiscoveryStructure.test.ts` only if existing structure guards require producer docs to stay in sync.

- [ ] **Step 1: Add structure assertions for producer-search scope**

In `src/__tests__/externalDiscoveryStructure.test.ts`, add producer-specific assertions:

```ts
expect(producerPlan).toContain("AgentReach search planner");
expect(producerPlan).toContain("official sitemap");
expect(producerPlan).toContain("run-daily does not start producer");
expect(producerPlan).toContain("consumer backend is out of PR4 search scope");
```

- [ ] **Step 2: Run structure test and confirm failure**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\externalDiscoveryStructure.test.ts
```

Expected: fail until producer docs are updated.

- [ ] **Step 3: Update producer docs**

Add a producer-only PR4 section:

```md
## PR4 AgentReach Search Next Stage

AgentReach search planner converts the atomic query pack plus quality policy into
bounded provider search jobs. Hacker News, RSS, and Official Web providers consume
those jobs through the existing opt-in producer transport. Official Web may parse
allowlisted XML/HTML sitemap fixtures and same-origin pages under configured caps.

run-daily does not start producer. Consumer backend is out of PR4 search scope.
The artifact remains `agent-reach.external-discovery.v1` and existing consumer
compatibility tests guard the boundary.
```

Do not modify completed consumer backend docs except where an existing structure test already requires a producer addendum in the shared design doc.

- [ ] **Step 4: Run structure test**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\externalDiscoveryStructure.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 7**

```powershell
git add docs\specs\exec-plans\agent-reach-artifact-producer-v0.1.exec-plan.md docs\specs\design-docs\agent-reach-external-discovery-and-evidence-design.md README.md README.en.md src\__tests__\externalDiscoveryStructure.test.ts
git commit -m "docs(agentreach): scope pr4 to producer search"
```

## Task 8: Final verification

**Files:**

- All changed producer, tests, and producer docs.

- [ ] **Step 1: Focused AgentReach search tests**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachSearchPlanner.test.ts src\__tests__\agentReachProviders.test.ts src\__tests__\agentReachOrchestrator.test.ts src\__tests__\agentReachCli.test.ts src\__tests__\agentReachArtifactWriter.test.ts src\__tests__\externalDiscoveryAdapter.test.ts src\__tests__\externalDiscoveryStructure.test.ts
```

Expected: all pass.

- [ ] **Step 2: Full tests**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__
```

Expected: all pass.

- [ ] **Step 3: Typecheck**

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
```

Expected: exit code 0.

- [ ] **Step 4: Build**

```powershell
node scripts\buildProduction.mjs
```

Expected: exit code 0.

- [ ] **Step 5: Preflight**

```powershell
.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --check
```

Expected: `[preflight] skill and exec-plan receipt verified`.

- [ ] **Step 6: Diff check**

```powershell
git diff --check
```

Expected: exit code 0.

- [ ] **Step 7: Status check**

```powershell
git status --short
```

Expected:

- No consumer-backend implementation files changed for PR4 search.
- No `src/search/` or `src/visualConsole/` changes.
- No production `data/raw/external-discovery/*.agent-reach.json` staged.
- `docs/superpowers/plans/2026-06-18-agentreach-provider-foundation.md` remains untracked unless the user explicitly asks to include it.

- [ ] **Step 8: Final commit**

```powershell
git add src\agentReach src\__tests__ docs\specs README.md README.en.md
git status --short
git commit -m "feat(agentreach): advance opt-in search planner"
```

Expected: local commit succeeds. Do not push and do not open a PR unless the user asks.

## Self-review checklist

- Search next-stage scope stays in `src/agentReach/`.
- Consumer backend/search UI changes are excluded.
- Provider jobs are bounded by `max_items_per_query`.
- Official sitemap support is same-origin, allowlisted, capped, and non-recursive.
- Artifact schema remains `agent-reach.external-discovery.v1`.
- Compatibility tests prove existing consumer adapter still reads generated artifacts.
- Public diagnostics contain counts and stable IDs only, not private paths, raw bodies, account state, or credentials.
