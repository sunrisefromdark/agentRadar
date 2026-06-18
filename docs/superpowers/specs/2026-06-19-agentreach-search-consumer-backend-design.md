# AgentReach Search Consumer Backend Design

## Context

AgentReach producer can now generate bounded, public-safe `agent-reach.external-discovery.v1` artifacts with quality policy metadata. The existing consumer already converts those artifacts into `DailyExternalAggregate`, including project evidence, direction evidence, and `ObservationCandidate[]`.

This design defines the next stage: make those sanitized AgentReach observations usable by the existing search/backend consumption path without changing the primary scoring model.

## Decision

Use option B: add a complete consumer-side search loop for AgentReach observations.

Matched AgentReach evidence enriches existing project search records. Unmatched but qualified `ObservationCandidate` entries become separate external observation search results. They are searchable and reportable, but they remain secondary external observations and cannot become primary daily conclusions.

## Goals

- Let project search find AgentReach-backed external evidence for existing repo-matched projects.
- Let users search unmatched external candidates as standalone observation results.
- Preserve the artifact boundary: search consumes `DailyExternalAggregate`, not producer internals or provider raw input.
- Keep external observations out of `RawSignal[]`, `discussion_score`, `today_star_projects`, and primary freshness-driving sources.
- Make daily, weekly, run-summary, and verify outputs explain what external search coverage was available.

## Non-goals

- No automatic `run-daily` producer invocation.
- No X / Twitter API, Reddit API, OAuth, cookie, session, or account-state collection.
- No remote latest artifact fetch.
- No new primary score component.
- No promotion of unmatched external candidates into primary project cards.
- No recursive web crawler or large-scale official-site discovery.

## Data model

Add a secondary search result model rather than forcing external candidates into the existing project card model.

```ts
export type AgentReachSearchResultKind =
  | "project_external_evidence"
  | "external_observation_candidate";

export interface AgentReachExternalSearchResult {
  schema_version: "agentreach.external-search-result.v1";
  result_kind: AgentReachSearchResultKind;
  result_id: string;
  display_name: string;
  target_key: string;
  repo_url?: string;
  topic_key?: string;
  direction_labels: ExternalDirectionLabel[];
  evidence_ids: string[];
  evidence_summary_cn: string;
  qualification: ExternalCandidateQualification;
  binding_confidence: ExternalBindingConfidence;
  can_enter_daily: boolean;
  can_enter_weekly: boolean;
  cannot_be_primary_conclusion: true;
  search_text: string;
  caveats: string[];
}
```

Existing project search records gain optional external metadata only for search text and explanation:

```ts
external_evidence_search_text?: string;
external_evidence_count?: number;
external_direction_labels?: ExternalDirectionLabel[];
```

These fields must not affect score, freshness state, rank, star delta, or project class.

## Search behavior

The search backend returns two lanes:

1. `projects`: existing project cards, optionally enriched with external evidence search text.
2. `external_observations`: unmatched AgentReach observation candidates.

The direct/fuzzy search pipeline can search both lanes, but ranking stays lane-local. Project results do not outrank each other because of external evidence alone; external observations are displayed after project results unless the query only matches external observations.

Searchable text for external observations includes:

- `display_name`
- `target_key`
- `topic_key`
- `direction_labels`
- `evidence_summary_cn`
- `qualification`
- `binding_confidence`
- `caveats`

Searchable text for repo-matched projects can include only public-safe external summaries and direction labels from `DailyExternalAggregate.project_evidence`.

## Daily consumption

Daily output should expose an external search section with:

- count of repo-matched external evidence entries;
- count of standalone external observation candidates;
- top external observation candidates allowed by `can_enter_daily`;
- coverage status summary from `DailyExternalAggregate.audit.coverage`;
- caveat text that external observations are secondary and cannot be primary conclusions.

Daily must not add these candidates to `today_star_projects`, `today_pulse_projects`, `mission_match_projects`, `RawSignal[]`, or scoring inputs.

## Weekly consumption

Weekly continues to read only the 7-day `DailyExternalAggregate[]` window. It may show external observation persistence when weekly gate rules pass, but the output remains secondary:

- direction-level observation summaries;
- repeated unmatched external candidates by `target_key` or `topic_key`;
- coverage status counts across the window;
- clear caveats that external observations are not primary trend confirmations.

## Verification

Verification must fail if:

- external observation candidates appear in `RawSignal[]`;
- external candidates are included in primary daily project arrays;
- external evidence changes primary score or `discussion_score`;
- raw social text, profile URLs, handles, credentials, cookies, sessions, OAuth, tokens, or private diagnostics appear in search output;
- weekly reads provider raw input instead of daily aggregate windows.

Verification may warn if:

- no external aggregate exists;
- coverage is incomplete;
- legacy fixtures lack coverage;
- all external observations are filtered out by search quality or qualification.

## Implementation shape

Suggested files:

- `src/externalDiscovery/searchResults.ts`: convert `DailyExternalAggregate` to secondary external search results.
- `src/search/projectSearchIndex.ts`: append safe external evidence search text to matched project records.
- `src/search/fuzzyProjectSearchService.ts`: carry a second result lane for external observations.
- `src/action/dailyReport.ts`: render external search digest in JSON/Markdown.
- `src/action/weeklyEnhancement.ts` and `src/action/weeklyReport.ts`: summarize weekly external observation persistence.
- `src/action/dailyVerification.ts`: enforce non-contamination and public-safe search output checks.
- `src/__tests__/agentReachSearchConsumerBackend.test.ts`: lane behavior and non-contamination tests.
- `src/__tests__/externalDiscoverySearchResults.test.ts`: aggregate-to-search-result conversion tests.

## Acceptance criteria

- A repo-matched AgentReach evidence item is searchable through existing project search text.
- An unmatched `ObservationCandidate` appears as an external observation search result.
- External observations are never present in primary project arrays or scoring inputs.
- Query results preserve separate `projects` and `external_observations` lanes.
- Daily and weekly output include external search coverage/caveat summaries.
- Verify catches contamination into `RawSignal[]`, score, primary arrays, or unsafe text.
- Existing full test suite and typecheck pass.

