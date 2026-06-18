# AgentReach Discovery Quality & Bounded Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn AgentReach live discovery from “can fetch public results” into a deterministic, relevant, deduplicated, explainable, and bounded result set.

**Architecture:** Add a resolved quality policy to producer context, then run live-provider results through a shared quality pipeline before orchestrator aggregation. The pipeline enriches live items from the query pack, filters irrelevant/stale/future results, canonicalizes and deduplicates URLs, applies stable ordering and provider limits, while a final orchestrator pass applies cross-provider deduplication and the global limit. Quality filtering emits public-safe diagnostic counts but never changes coverage from `ok` to `partial`.

**Tech Stack:** TypeScript, Node.js URL API, Vitest, existing AgentReach provider/orchestrator/artifact contracts.

---

## Frozen PR3 Decisions

- Keep `agent-reach.external-discovery.v1`; do not add artifact top-level fields.
- Add `quality_policy` inside the existing public-safe artifact `query` object.
- Quality config is top-level config, separate from provider config:

```json
{
  "quality": {
    "lookback_days": 180,
    "max_items_per_query": 20,
    "max_items_per_provider": 50,
    "max_items_total": 100
  },
  "providers": {}
}
```

- Defaults are `180 / 20 / 50 / 100`.
- Validation ranges:
  - `lookback_days`: `1..3650`
  - `max_items_per_query`: `1..100`
  - `max_items_per_provider`: `1..500`
  - `max_items_total`: `1..1000`
  - require `max_items_per_query <= max_items_per_provider <= max_items_total`
- Relevance and time filtering apply only when `provider_config.live.enabled === true`.
- Query entries used for relevance enrichment must be atomic: one independently matchable specific direction per entry, with only shared parent labels attached. Sibling labels such as document/spreadsheet/meeting or legal/finance/HR must never share one entry.
- Provider deduplication and provider limits apply to every provider, including local/manual imports.
- Global deduplication and `max_items_total` apply to the final producer item list.
- Quality filtering/truncation does not add `rejected_items` and does not degrade provider or platform coverage.
- A successful live request with zero relevant items remains coverage `ok`.
- Warning formats are fixed:
  - `quality_filtered_irrelevant:<provider_id>:<count>`
  - `quality_filtered_stale:<provider_id>:<count>`
  - `quality_filtered_future:<provider_id>:<count>`
  - `quality_filtered_invalid_timestamp:<provider_id>:<count>`
  - `quality_deduplicated:<provider_id>:<count>`
  - `quality_truncated:<provider_id>:<count>`
  - final-stage warnings use provider id `producer`
- Missing `source_published_at` is retained because RSS and official pages may not publish a usable timestamp.
- A present but invalid `source_published_at` is filtered for live providers and counted as `quality_filtered_invalid_timestamp`; malformed explicit timestamps must not silently bypass freshness checks.
- `generated_at` is an internal producer invariant. An invalid `generated_at` throws before quality processing rather than becoming a warning.
- HN uses `hitsPerPage=max_items_per_query`; freshness is always rechecked locally and does not rely on an upstream time-filter parameter.
- HN also applies `max_items_per_query` locally to each parsed query response in case the upstream endpoint ignores `hitsPerPage`.
- RSS and Official Web are source-driven rather than query-request-driven; they do not apply a per-query request cap, but they still obey provider and global caps.

## File Structure

- Create `src/agentReach/qualityPolicy.ts`: defaults, validation, and resolved policy.
- Create `src/agentReach/quality.ts`: query matching, label enrichment, freshness filtering, canonical URL, deduplication, merging, sorting, and truncation.
- Create `src/__tests__/agentReachQuality.test.ts`: unit tests for all quality rules.
- Modify `src/agentReach/types.ts`: quality policy types and provider context field.
- Modify `src/agentReach/queryPack.ts`: preserve atomic term-to-label mappings used by quality enrichment.
- Modify `src/agentReach/cli.ts`: parse top-level quality config, pass resolved policy, expose it in artifact query.
- Modify `src/agentReach/orchestrator.ts`: provider-stage and final-stage quality processing.
- Modify `src/agentReach/providers/hackerNewsProvider.ts`: set `hitsPerPage` from policy.
- Modify AgentReach CLI/orchestrator/provider/structure tests and producer docs.

---

### Task 0: Preserve the approved pre-PR3 repairs

**Files:**
- Modify: `src/agentReach/queryPack.ts`
- Modify: `src/externalDiscovery/agentReachProvider.ts`
- Modify: `src/__tests__/agentReachQueryPack.test.ts`
- Modify: `src/__tests__/externalDiscoveryAdapter.test.ts`
- Modify: `src/__tests__/externalDiscoveryStructure.test.ts`
- Modify: `docs/specs/constraints/architecture-constraints.md`
- Modify: `docs/specs/exec-plans/agent-reach-artifact-producer-v0.1.exec-plan.md`
- Modify: `docs/specs/feedback-loops/observability-contract.md`
- Modify: `docs/specs/feedback-loops/failure-recovery-loop.md`
- Modify: `docs/specs/services/signal-ingestion.md`
- Add: `docs/superpowers/plans/2026-06-19-agentreach-discovery-quality.md`

- [ ] **Step 1: Verify the pre-PR3 regression set**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachQueryPack.test.ts src\__tests__\externalDiscoveryAdapter.test.ts src\__tests__\externalDiscoveryStructure.test.ts
```

Expected: all tests pass, including atomic query mappings and unsafe diagnostics rejection.

- [ ] **Step 2: Verify the repository baseline**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__
.\node_modules\.bin\tsc.cmd --noEmit
node scripts\buildProduction.mjs
.\node_modules\.bin\tsx.cmd scripts\execPlanPreflight.ts --check
```

Expected: all commands exit `0`.

- [ ] **Step 3: Commit the pre-PR3 repairs separately**

```powershell
git add docs/specs/constraints/architecture-constraints.md docs/specs/exec-plans/agent-reach-artifact-producer-v0.1.exec-plan.md docs/specs/feedback-loops/observability-contract.md docs/specs/feedback-loops/failure-recovery-loop.md docs/specs/services/signal-ingestion.md docs/superpowers/plans/2026-06-19-agentreach-discovery-quality.md src/__tests__/agentReachQueryPack.test.ts src/__tests__/externalDiscoveryAdapter.test.ts src/__tests__/externalDiscoveryStructure.test.ts src/agentReach/queryPack.ts src/externalDiscovery/agentReachProvider.ts
git commit -m "fix(agentreach): align labels and consumer safety"
```

Do not add or modify the optional untracked file
`docs/superpowers/plans/2026-06-18-agentreach-provider-foundation.md`.

---

### Task 1: Add the resolved quality policy contract

**Files:**
- Create: `src/agentReach/qualityPolicy.ts`
- Modify: `src/agentReach/types.ts`
- Test: `src/__tests__/agentReachQuality.test.ts`

- [ ] **Step 1: Write failing policy tests**

Create `src/__tests__/agentReachQuality.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

import {
  AGENT_REACH_DEFAULT_QUALITY_POLICY,
  resolveAgentReachQualityPolicy,
} from "../agentReach/qualityPolicy.ts";

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
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachQuality.test.ts
```

Expected: FAIL because `qualityPolicy.ts` does not exist.

- [ ] **Step 3: Add quality policy types**

Add to `src/agentReach/types.ts`:

```ts
export interface AgentReachQualityPolicy {
  lookback_days: number;
  max_items_per_query: number;
  max_items_per_provider: number;
  max_items_total: number;
}

export type AgentReachQualityPolicyInput = Partial<AgentReachQualityPolicy>;
```

Add to `AgentReachProviderContext`:

```ts
quality_policy: AgentReachQualityPolicy;
```

- [ ] **Step 4: Implement policy resolution**

Create `src/agentReach/qualityPolicy.ts`:

```ts
import type {
  AgentReachQualityPolicy,
  AgentReachQualityPolicyInput,
} from "./types.ts";

export const AGENT_REACH_DEFAULT_QUALITY_POLICY: AgentReachQualityPolicy = {
  lookback_days: 180,
  max_items_per_query: 20,
  max_items_per_provider: 50,
  max_items_total: 100,
};

const POLICY_RANGES = {
  lookback_days: [1, 3650],
  max_items_per_query: [1, 100],
  max_items_per_provider: [1, 500],
  max_items_total: [1, 1000],
} as const;

function boundedInteger(
  key: keyof AgentReachQualityPolicy,
  value: number,
): number {
  const [minimum, maximum] = POLICY_RANGES[key];
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `quality.${key} must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

export function resolveAgentReachQualityPolicy(
  input: AgentReachQualityPolicyInput = {},
): AgentReachQualityPolicy {
  const policy: AgentReachQualityPolicy = {
    lookback_days: boundedInteger(
      "lookback_days",
      input.lookback_days ?? AGENT_REACH_DEFAULT_QUALITY_POLICY.lookback_days,
    ),
    max_items_per_query: boundedInteger(
      "max_items_per_query",
      input.max_items_per_query ??
        AGENT_REACH_DEFAULT_QUALITY_POLICY.max_items_per_query,
    ),
    max_items_per_provider: boundedInteger(
      "max_items_per_provider",
      input.max_items_per_provider ??
        AGENT_REACH_DEFAULT_QUALITY_POLICY.max_items_per_provider,
    ),
    max_items_total: boundedInteger(
      "max_items_total",
      input.max_items_total ??
        AGENT_REACH_DEFAULT_QUALITY_POLICY.max_items_total,
    ),
  };

  if (policy.max_items_per_query > policy.max_items_per_provider) {
    throw new Error(
      "quality.max_items_per_query must not exceed max_items_per_provider",
    );
  }
  if (policy.max_items_per_provider > policy.max_items_total) {
    throw new Error(
      "quality.max_items_per_provider must not exceed max_items_total",
    );
  }
  return policy;
}
```

- [ ] **Step 5: Update existing provider-context test helpers**

Every test helper constructing `AgentReachProviderContext` or orchestrator input must add:

```ts
quality_policy: AGENT_REACH_DEFAULT_QUALITY_POLICY,
```

Import the default from `qualityPolicy.ts`.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachQuality.test.ts src\__tests__\agentReachProviderFoundation.test.ts src\__tests__\agentReachProviders.test.ts src\__tests__\agentReachOrchestrator.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/agentReach/types.ts src/agentReach/qualityPolicy.ts src/__tests__/agentReachQuality.test.ts src/__tests__/agentReachProviderFoundation.test.ts src/__tests__/agentReachProviders.test.ts src/__tests__/agentReachOrchestrator.test.ts
git commit -m "feat(agentreach): define discovery quality policy"
```

---

### Task 2: Parse and expose quality config in the CLI

**Files:**
- Modify: `src/agentReach/cli.ts`
- Modify: `src/__tests__/agentReachCli.test.ts`

- [ ] **Step 1: Write failing CLI config tests**

Add these tests using the existing `makeTempDir()` helper:

```ts
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
```

- [ ] **Step 2: Run the CLI test and verify RED**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachCli.test.ts
```

Expected: FAIL because top-level `quality` is ignored.

- [ ] **Step 3: Extend the private config shape**

In `src/agentReach/cli.ts`:

```ts
interface AgentReachConfig {
  quality_policy: AgentReachQualityPolicy;
  providers?: Partial<Record<AgentReachProviderId, AgentReachProviderConfig>>;
}
```

Parse `parsed.quality` only when it is an object. Pass only known numeric keys to `resolveAgentReachQualityPolicy`; reject unknown non-object quality values.

`loadAgentReachConfig(undefined)` must return an object with
`quality_policy: AGENT_REACH_DEFAULT_QUALITY_POLICY` and no providers. When a
config contains top-level `quality` but omits `providers`, it must still parse
and retain `quality`; do not keep the current early return that discards
quality when `parsed.providers === undefined`.

No config path or raw config object may enter the artifact.

- [ ] **Step 4: Pass policy into orchestrator and artifact query**

Extend `RunAgentReachProvidersInput` with:

```ts
quality_policy: AgentReachQualityPolicy;
```

Pass the resolved policy to each provider context.

Add to artifact query:

```ts
quality_policy: config.quality_policy,
```

- [ ] **Step 5: Run focused tests and verify GREEN**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachCli.test.ts src\__tests__\agentReachOrchestrator.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/agentReach/cli.ts src/agentReach/orchestrator.ts src/__tests__/agentReachCli.test.ts src/__tests__/agentReachOrchestrator.test.ts
git commit -m "feat(agentreach): load bounded discovery policy"
```

---

### Task 3: Implement query matching and live-item enrichment

**Files:**
- Create: `src/agentReach/quality.ts`
- Modify: `src/agentReach/queryPack.ts`
- Modify: `src/__tests__/agentReachQuality.test.ts`
- Modify: `src/__tests__/agentReachQueryPack.test.ts`

- [ ] **Step 1: Write failing relevance and enrichment tests**

Add these tests:

```ts
import { enrichLiveAgentReachItem } from "../agentReach/quality.ts";
import { AGENT_REACH_QUERY_PACK } from "../agentReach/queryPack.ts";

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
```

- [ ] **Step 2: Run quality tests and verify RED**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachQuality.test.ts
```

Expected: FAIL because `quality.ts` does not exist.

- [ ] **Step 3: Implement normalized query matching**

In `src/agentReach/quality.ts`, implement:

```ts
const AGENT_MARKERS = new Set([
  "agent",
  "agents",
  "assistant",
  "assistants",
  "copilot",
  "autonomous",
]);

const GENERIC_QUERY_TOKENS = new Set([
  "ai",
  "agent",
  "agents",
  "assistant",
  "assistants",
]);

function normalizedWords(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function safeUrlPathname(value: string | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).pathname;
  } catch {
    return "";
  }
}

function searchableText(item: AgentReachProviderItem): string {
  return [
    item.title,
    item.target?.name,
    item.target?.topic_hint,
    safeUrlPathname(item.url),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}
```

For each query entry and term:

1. Exact normalized phrase substring matches.
2. Otherwise require one agent marker in item text and at least one query token not in `GENERIC_QUERY_TOKENS`.
3. If any term matches, merge that atomic entry's specific direction label, shared parent labels, and tags.
4. If no query entry matches, return `undefined`.

Catch invalid item URLs by treating pathname as empty; URL parsing must not throw.
Add a regression assertion that an item with `url: "not a url"` can still be
enriched from its title and does not throw.

- [ ] **Step 4: Run quality tests and verify GREEN**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachQuality.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/agentReach/quality.ts src/__tests__/agentReachQuality.test.ts
git commit -m "feat(agentreach): classify live discovery results"
```

---

### Task 4: Implement freshness filtering, canonical URLs, deduplication, merging, and sorting

**Files:**
- Modify: `src/agentReach/quality.ts`
- Modify: `src/__tests__/agentReachQuality.test.ts`

- [ ] **Step 1: Write failing freshness tests**

Add this table-driven test:

```ts
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
      source_published_at: "2026-06-19T00:00:00.001Z",
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
```

- [ ] **Step 2: Write failing canonical URL tests**

Add:

```ts
it("canonicalizes URLs and removes tracking parameters", () => {
  expect(
    canonicalizeAgentReachUrl(
      "HTTPS://Example.COM:443/Path?utm_source=x&b=2&a=1&ref=home#fragment",
    ),
  ).toBe("https://example.com/Path?a=1&b=2");
  expect(canonicalizeAgentReachUrl("not a url")).toBeUndefined();
});
```

Tracking parameters to strip:

- every key beginning with `utm_`
- `fbclid`
- `gclid`
- `ref`
- `ref_src`

Preserve non-tracking parameters and path case.

- [ ] **Step 3: Write failing deduplication and merge tests**

Add explicit cases:

```ts
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
```

- [ ] **Step 4: Write failing ordering and provider-limit tests**

Add an ordering test with four retained items and assert this exact order:

```ts
expect(result.items.map((item) => item.raw_ref)).toEqual([
  "hn:newer",
  "hn:more-points",
  "hn:more-comments",
  "hn:missing-date",
]);
expect(result.warnings).toContain("quality_truncated:hacker-news:1");
```

The comparator is fixed as publication date descending with missing date last,
then points descending, comments descending, and canonical URL or `raw_ref`
ascending. Truncation occurs only after enrichment, freshness filtering,
deduplication, merging, and the final provider sort.

- [ ] **Step 5: Run quality tests and verify RED**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachQuality.test.ts
```

Expected: FAIL for missing quality pipeline functions.

- [ ] **Step 6: Implement the provider-stage pipeline**

Export:

```ts
export interface AgentReachQualityResult {
  items: AgentReachProviderItem[];
  warnings: string[];
}

export function canonicalizeAgentReachUrl(value: string): string | undefined;

export function applyAgentReachProviderQuality(input: {
  providerId: AgentReachProviderId;
  items: readonly AgentReachProviderItem[];
  queryPack: readonly AgentReachQueryEntry[];
  generatedAt: string;
  policy: AgentReachQualityPolicy;
  liveEnabled: boolean;
}): AgentReachQualityResult;
```

Pipeline order:

1. When live, enrich and reject irrelevant items.
2. When live, reject stale, future, and explicitly invalid publication timestamps.
3. Stable sort.
4. Deduplicate and merge.
5. Stable sort again.
6. Truncate to provider cap.
7. Emit only non-zero count warnings.

Do not change coverage/status and do not return rejected items.

- [ ] **Step 7: Implement final producer-stage quality**

Export:

```ts
export function finalizeAgentReachProducerItems(input: {
  items: readonly AgentReachProviderItem[];
  maxItemsTotal: number;
}): AgentReachQualityResult;
```

It performs stable sort, cross-provider deduplication using the same platform-aware key, then global truncation. Use `producer` in warning identifiers.

- [ ] **Step 8: Run quality tests and verify GREEN**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachQuality.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add src/agentReach/quality.ts src/__tests__/agentReachQuality.test.ts
git commit -m "feat(agentreach): bound and deduplicate discovery output"
```

---

### Task 5: Integrate quality processing into the orchestrator

**Files:**
- Modify: `src/agentReach/orchestrator.ts`
- Modify: `src/__tests__/agentReachOrchestrator.test.ts`

- [ ] **Step 1: Write failing orchestrator integration tests**

Add five named tests with these exact assertions:

```ts
expect(summary.items.map((item) => item.raw_ref)).toEqual(["hn:relevant"]);
expect(summary.warnings).toEqual(
  expect.arrayContaining([
    "quality_filtered_irrelevant:hacker-news:1",
    "quality_filtered_stale:hacker-news:1",
  ]),
);

expect(localSummary.items.map((item) => item.raw_ref)).toEqual([
  "manual:old-but-explicit",
]);
expect(
  localSummary.warnings.some((warning) =>
    warning.startsWith("quality_filtered_stale"),
  ),
).toBe(false);

expect(truncatedSummary.status).toBe("ok");
expect(truncatedSummary.coverage.hacker_news.status).toBe("ok");
expect(truncatedSummary.items).toHaveLength(2);

expect(globalSummary.items).toHaveLength(3);
expect(globalSummary.warnings).toContain("quality_truncated:producer:1");

expect(JSON.stringify(secondRun.items)).toBe(JSON.stringify(firstRun.items));
expect(JSON.stringify(secondRun.warnings)).toBe(
  JSON.stringify(firstRun.warnings),
);
```

Use explicit provider configs:

```ts
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
```

- [ ] **Step 2: Run orchestrator tests and verify RED**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachOrchestrator.test.ts
```

Expected: FAIL because provider results are aggregated without quality processing.

- [ ] **Step 3: Apply provider-stage quality**

Immediately after provider execution and provider-id validation:

```ts
const quality = applyAgentReachProviderQuality({
  providerId: provider.provider_id,
  items: result.items,
  queryPack: input.query_pack,
  generatedAt: input.generated_at,
  policy: input.quality_policy,
  liveEnabled:
    input.provider_configs[provider.provider_id]?.live?.enabled === true,
});

result = {
  ...result,
  items: quality.items,
  warnings: [...result.warnings, ...quality.warnings],
};
```

Provider coverage and status remain unchanged.

- [ ] **Step 4: Apply final producer-stage quality**

After all providers and coverage aggregation:

```ts
const finalQuality = finalizeAgentReachProducerItems({
  items,
  maxItemsTotal: input.quality_policy.max_items_total,
});
```

Return `finalQuality.items` and append `finalQuality.warnings`. Do not include quality drops in `rejectedItemCount`.

- [ ] **Step 5: Run orchestrator tests and verify GREEN**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachOrchestrator.test.ts src\__tests__\agentReachQuality.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/agentReach/orchestrator.ts src/__tests__/agentReachOrchestrator.test.ts
git commit -m "feat(agentreach): apply discovery quality in orchestration"
```

---

### Task 6: Bound Hacker News requests and verify query-derived labels

**Files:**
- Modify: `src/agentReach/providers/hackerNewsProvider.ts`
- Modify: `src/__tests__/agentReachProviders.test.ts`

- [ ] **Step 1: Write failing HN request-bound test**

Update the HN provider test to expect:

```text
https://hn.algolia.com/api/v1/search?query=research%20agent&tags=story&hitsPerPage=5
```

when:

```ts
quality_policy: {
  lookback_days: 180,
  max_items_per_query: 5,
  max_items_per_provider: 10,
  max_items_total: 25,
}
```

- [ ] **Step 2: Write failing live-result quality tests**

In `agentReachProviders.test.ts`, make the fake HN endpoint return more than
`max_items_per_query` and assert direct provider output is locally capped even
if the fake upstream ignores `hitsPerPage`.

In `agentReachOrchestrator.test.ts`, return:

- one relevant current HN result
- one irrelevant generic-agent result
- one stale result
- one duplicate of the relevant result

Assert the provider/orchestrator output contains one item with:

```ts
{
  direction_labels: expect.arrayContaining(["research-agent"]),
  tags: expect.arrayContaining(["research"]),
}
```

and warnings for irrelevant, stale, and deduplicated counts after shared
orchestration quality processing.

- [ ] **Step 3: Run provider tests and verify RED**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachProviders.test.ts
```

Expected: FAIL because HN URLs omit `hitsPerPage`, direct HN output is not
locally capped per query, and orchestrator output is not yet quality processed.

- [ ] **Step 4: Add `hitsPerPage`**

Change HN URL construction to accept:

```ts
function hackerNewsSearchUrls(
  baseUrl: string,
  terms: string[],
  hitsPerPage: number,
): string[];
```

Append:

```text
&hitsPerPage=${hitsPerPage}
```

Use `context.quality_policy.max_items_per_query`.

Do not add upstream time-filter parameters; local freshness remains authoritative.

- [ ] **Step 5: Enforce the HN per-query cap locally**

After parsing one HN response, slice that query's normalized raw hits to:

```ts
input.context.quality_policy.max_items_per_query
```

Do this before results from multiple query URLs are combined. The upstream
`hitsPerPage` is an optimization; the local slice is the correctness boundary.

- [ ] **Step 6: Keep provider-only tests scoped correctly**

Direct `provider.run()` tests should assert request construction and normalized raw provider output. Query enrichment/filtering assertions belong in orchestrator/quality tests because that behavior is owned by the shared quality pipeline.

- [ ] **Step 7: Run provider/orchestrator tests and verify GREEN**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachProviders.test.ts src\__tests__\agentReachOrchestrator.test.ts src\__tests__\agentReachQuality.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/agentReach/providers/hackerNewsProvider.ts src/__tests__/agentReachProviders.test.ts
git commit -m "feat(agentreach): bound hacker news discovery queries"
```

---

### Task 7: Lock CLI/artifact behavior and backward compatibility

**Files:**
- Modify: `src/__tests__/agentReachCli.test.ts`
- Modify: `src/__tests__/agentReachArtifactWriter.test.ts`
- Modify: `src/__tests__/externalDiscoveryAdapter.test.ts`

- [ ] **Step 1: Add deterministic dry-run artifact tests**

Run the same injected live HN dry-run twice and assert:

```ts
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
```

- [ ] **Step 2: Add zero-result semantics test**

For a successful live response containing only irrelevant results:

```ts
expect(result.artifact.status).toBe("ok");
expect(result.artifact.coverage.hacker_news.status).toBe("ok");
expect(result.artifact.items).toEqual([]);
expect(result.artifact.diagnostics.warnings).toContain(
  "quality_filtered_irrelevant:hacker-news:1",
);
```

- [ ] **Step 3: Add writer/consumer compatibility tests**

Use the existing writer and adapter helpers and assert:

```ts
expect(writeResult.artifact.schema_version).toBe(
  "agent-reach.external-discovery.v1",
);
expect(legacyConsumerResult.status).toBe("ok");
expect(legacyConsumerResult.events).toHaveLength(1);
```

The legacy fixture's `query` object contains terms only and omits
`quality_policy`; no consumer type or schema-version migration is allowed.

- [ ] **Step 4: Run compatibility tests**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\agentReachCli.test.ts src\__tests__\agentReachArtifactWriter.test.ts src\__tests__\externalDiscoveryAdapter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/__tests__/agentReachCli.test.ts src/__tests__/agentReachArtifactWriter.test.ts src/__tests__/externalDiscoveryAdapter.test.ts
git commit -m "test(agentreach): lock bounded artifact behavior"
```

---

### Task 8: Update documentation and structural guardrails

**Files:**
- Modify: `docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md`
- Modify: `docs/specs/exec-plans/agent-reach-artifact-producer-v0.1.exec-plan.md`
- Modify: `docs/specs/services/cli-runtime.md`
- Modify: `docs/specs/feedback-loops/observability-contract.md`
- Modify: `docs/specs/feedback-loops/failure-recovery-loop.md`
- Modify: `README.md`
- Modify: `README.en.md`
- Modify: `src/__tests__/externalDiscoveryStructure.test.ts`

- [ ] **Step 1: Write the failing structure test**

Require documentation to contain:

```text
AgentReachQualityPolicy
lookback_days
max_items_per_query
max_items_per_provider
max_items_total
atomic query entry
quality_filtered_irrelevant
quality_filtered_invalid_timestamp
quality_deduplicated
zero relevant results
coverage remains ok
```

Also assert the producer exec-plan no longer claims online RSS/HN fetch is absent from the current checkpoint.

- [ ] **Step 2: Run structure test and verify RED**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\externalDiscoveryStructure.test.ts
```

Expected: FAIL until docs are updated.

- [ ] **Step 3: Update docs**

Document:

- policy defaults and validation relationships
- live-only relevance/freshness filtering
- all-provider dedup/provider caps and final global cap
- warning formats
- atomic term-to-direction mapping and the prohibition on sibling label expansion
- invalid explicit publication timestamp filtering
- deterministic ordering
- truncation not degrading coverage
- zero relevant results remaining coverage `ok`
- HN `hitsPerPage` plus local authoritative freshness check
- unchanged v1 artifact schema and consumer compatibility

Correct stale checkpoint text that says online RSS / HN fetch is not implemented.

- [ ] **Step 4: Run structure test and verify GREEN**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__\externalDiscoveryStructure.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add README.md README.en.md docs/specs/design-docs/agent-reach-external-discovery-and-evidence-design.md docs/specs/exec-plans/agent-reach-artifact-producer-v0.1.exec-plan.md docs/specs/services/cli-runtime.md docs/specs/feedback-loops/observability-contract.md docs/specs/feedback-loops/failure-recovery-loop.md src/__tests__/externalDiscoveryStructure.test.ts
git commit -m "docs(agentreach): define bounded discovery quality"
```

---

### Task 9: Full verification and real live smoke test

**Files:**
- No production file changes expected.
- Temporary smoke config must be deleted before completion.

- [ ] **Step 1: Run full automated verification**

```powershell
.\node_modules\.bin\vitest.cmd run src\__tests__
corepack pnpm run typecheck
corepack pnpm run build
corepack pnpm run code-implementation:preflight -- --check
```

Expected:

- all tests pass
- typecheck exits `0`
- build exits `0`
- preflight reports verified

- [ ] **Step 2: Record raw-artifact baseline**

```powershell
Get-ChildItem data\raw\external-discovery -File
```

Record current file list before smoke test.

- [ ] **Step 3: Run reserved-provider dry-run regression**

```powershell
corepack pnpm agentreach:discover -- --date 2026-06-18 --providers x_twitter,reddit --dry-run
```

Expected:

- `dry_run: true`
- X/Reddit remain `manual_import_only`
- no live fetch
- no raw file created

- [ ] **Step 4: Run real HN bounded smoke test**

Create a temporary ignored/untracked config containing:

```json
{
  "quality": {
    "lookback_days": 365,
    "max_items_per_query": 5,
    "max_items_per_provider": 5,
    "max_items_total": 5
  },
  "providers": {
    "hacker-news": {
      "live": {
        "enabled": true,
        "urls": ["https://hn.algolia.com/api/v1/search"],
        "query_limit": 1,
        "timeout_ms": 10000,
        "max_response_bytes": 524288
      }
    }
  }
}
```

Run:

```powershell
corepack pnpm agentreach:discover -- --date 2026-06-18 --providers hacker-news --config <temporary-config> --dry-run
```

Expected:

- status and `hacker_news` coverage are `ok`
- item count is `<= 5`
- each retained item has `research-agent` label
- stale and irrelevant items are absent
- output ordering is stable on a second identical run
- temporary config path is absent from artifact

- [ ] **Step 5: Delete temporary config and verify no raw writes**

Compare `data/raw/external-discovery` to the baseline. It must be unchanged.

- [ ] **Step 6: Review diff and status**

```powershell
git diff --check
git status --short
git log --oneline -10
```

Expected:

- no whitespace errors
- no production raw artifact
- the pre-existing optional file
  `docs/superpowers/plans/2026-06-18-agentreach-provider-foundation.md`
  remains untouched unless the user explicitly changes that decision

- [ ] **Step 7: Final code review**

Review for:

- quality filtering cannot leak query/config secrets
- query labels never enter main `RawSignal` or score
- quality warnings do not alter coverage/status
- manual imports are not relevance/freshness filtered
- output is bounded and deterministic
- no X/Reddit API or daily integration entered PR3

Only after review passes, decide whether to push or create a PR.
