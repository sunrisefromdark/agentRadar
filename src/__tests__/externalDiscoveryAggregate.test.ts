import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type { AgentReachProviderResult } from "../externalDiscovery/agentReachProvider.ts";
import {
  EXTERNAL_REDACTION_POLICY_VERSION,
  SOURCE_INPUT_HASH_ABSENCE_MARKER_WARNING,
  buildDailyExternalAggregate,
  buildSourceInputAbsenceMarkerHash,
  writeDailyExternalAggregate,
} from "../externalDiscovery/aggregate.ts";
import { matchExternalEventToProjects } from "../externalDiscovery/matching.ts";
import { assertPublicSafeAggregate, stableSourceInputHash } from "../externalDiscovery/redaction.ts";
import type { ExternalDiscoveryCoverage, ExternalSignalEvent } from "../externalDiscovery/types.ts";
import type { NormalizedProject } from "../types.ts";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "external-aggregate-"));
  tempDirs.push(dir);
  return dir;
}

function makeEvent(overrides: Partial<ExternalSignalEvent> = {}): ExternalSignalEvent {
  return {
    event_id: "external-event-1",
    provider: "agent-reach",
    platform: "official_blog",
    raw_event_kind: "official_release",
    derived_signal_kinds: ["discovery", "evidence"],
    source_published_at: "2026-06-13T23:00:00.000Z",
    observed_at: "2026-06-14T00:00:00.000Z",
    ingested_at: "2026-06-14T00:01:00.000Z",
    event_url: "https://example.com/release",
    content_title: "External release",
    content_text: "raw social text should never reach public aggregate",
    actor: {
      display_name: "Example Team",
      handle: "@example_team",
      platform_profile_url: "https://example.com/profile/example-team",
      provider_tier_hint: "core",
      actor_type: "team",
      effective_tier: "ordinary",
      tier_basis: "registry_miss",
    },
    target: {
      target_type: "project",
      name: "Example Project",
      repo_url: "https://github.com/example/project",
      binding_confidence: "unbound",
    },
    metrics: { likes: 12, comments: 2 },
    direction_labels: [],
    tags: ["agent-workflow"],
    raw_ref: "agent-reach:item-1",
    notes: [],
    ...overrides,
  };
}

function makeProviderResult(
  overrides: Partial<AgentReachProviderResult> = {},
): AgentReachProviderResult {
  return {
    provider: "agent-reach",
    schema_version: "agent-reach.external-discovery.v1",
    provider_run_id: "agent-reach-run-1",
    source_input_ref: "data/raw/external-discovery/2026-06-14.agent-reach.json",
    source_input_hash: stableSourceInputHash("raw artifact bytes"),
    events: [makeEvent()],
    rejected_events: [],
    status: "ok",
    status_reason: "ok",
    warnings: [],
    ...overrides,
  };
}

function makeCoverage(): ExternalDiscoveryCoverage {
  return {
    x_twitter: {
      status: "manual_import_only",
      reason: "reserved_provider_not_configured",
    },
    reddit: {
      status: "manual_import_only",
      reason: "reserved_provider_not_configured",
    },
    hacker_news: {
      status: "not_configured",
      reason: "provider_not_selected",
    },
    official_web: {
      status: "partial",
      reason: "sitemap_unavailable",
      warnings: ["official_web_partial"],
    },
    official_blog: {
      status: "ok",
    },
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("external discovery daily aggregate", () => {
  it("builds a public-safe daily aggregate without copying raw event fields", () => {
    const providerResult = makeProviderResult({
      events: [
        makeEvent({
          direction_labels: ["research-agent", "office-agent"],
        }),
      ],
    });
    const projectEvidence = matchExternalEventToProjects(providerResult.events[0], [
      {
        project_name: "Example Project",
        repo_url: "https://github.com/example/project",
        repo_full_name: "example/project",
      } as NormalizedProject,
    ]).evidence;

    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-14",
      generatedAt: "2026-06-14T01:00:00.000Z",
      providerResult,
      projectEvidence: projectEvidence ? [projectEvidence] : [],
    });

    expect(aggregate.schema_version).toBe("external-discovery.aggregate.v1");
    expect(aggregate.date).toBe("2026-06-14");
    expect(aggregate.generated_at).toBe("2026-06-14T01:00:00.000Z");
    expect(aggregate.provider_run_id).toBe("agent-reach-run-1");
    expect(aggregate.status).toBe("ok");
    expect(aggregate.status_reason).toBe("ok");
    expect(aggregate.source_input_hash).toBe(stableSourceInputHash("raw artifact bytes"));
    expect(aggregate.public_safe).toBe(true);
    expect(aggregate.redaction_policy_version).toBe(EXTERNAL_REDACTION_POLICY_VERSION);
    expect(aggregate.contains_raw_text).toBe(false);
    expect(aggregate.contains_profile_urls).toBe(false);
    expect(aggregate.event_count).toBe(1);
    expect(aggregate.accepted_event_count).toBe(1);
    expect(aggregate.rejected_event_count).toBe(0);
    expect(aggregate.platform_counts).toEqual({ official_blog: 1 });
    expect(aggregate.derived_signal_kind_counts).toEqual({ discovery: 1, evidence: 1 });
    expect(aggregate.direction_label_counts).toEqual({
      "research-agent": 1,
      "office-agent": 1,
    });
    expect(aggregate.project_evidence).toHaveLength(1);
    expect(aggregate.project_evidence[0]?.direction_labels).toEqual(["research-agent", "office-agent"]);
    expect(aggregate.project_evidence[0]?.actor_tiers).toEqual({ ordinary: 1 });
    expect(aggregate.project_evidence[0]?.actor_tiers.core).toBeUndefined();
    expect(aggregate.audit.coverage).toBeUndefined();
    expect(aggregate).not.toHaveProperty("source_input_ref");
    expect(assertPublicSafeAggregate(aggregate).ok).toBe(true);
    expect(JSON.stringify(aggregate)).not.toContain("raw social text");
    expect(JSON.stringify(aggregate)).not.toContain("@example_team");
    expect(JSON.stringify(aggregate)).not.toContain("profile/example-team");
  });

  it("carries public-safe producer coverage into the daily aggregate audit", () => {
    const coverage = makeCoverage();

    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-14",
      generatedAt: "2026-06-14T01:00:00.000Z",
      providerResult: makeProviderResult({ coverage }),
    });

    expect(aggregate.audit.coverage).toEqual(coverage);
    expect(aggregate.audit.coverage?.official_web?.status).toBe("partial");
    expect(assertPublicSafeAggregate(aggregate).ok).toBe(true);
  });

  it("rejects public-unsafe coverage before returning an aggregate", () => {
    expect(() =>
      buildDailyExternalAggregate({
        date: "2026-06-14",
        providerResult: makeProviderResult({
          coverage: {
            ...makeCoverage(),
            official_blog: {
              status: "failed",
              reason: "OAuth token expired",
            },
          },
        }),
      }),
    ).toThrow(/public-safe/);
  });

  it("uses a stable absence marker hash for missing default input", () => {
    const providerResult = makeProviderResult({
      source_input_hash: undefined,
      events: [],
      rejected_events: [],
      status: "skipped",
      status_reason: "input_missing",
    });

    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-14",
      generatedAt: "2026-06-14T01:00:00.000Z",
      providerResult,
    });
    const expectedHash = buildSourceInputAbsenceMarkerHash({
      provider: "agent-reach",
      date: "2026-06-14",
      source_input_ref: "data/raw/external-discovery/2026-06-14.agent-reach.json",
      status: "skipped",
      status_reason: "input_missing",
    });

    expect(aggregate.source_input_hash).toBe(expectedHash);
    expect(aggregate.audit.warnings).toContain(SOURCE_INPUT_HASH_ABSENCE_MARKER_WARNING);
    expect(aggregate.event_count).toBe(0);
    expect(aggregate.accepted_event_count).toBe(0);
    expect(aggregate.rejected_event_count).toBe(0);
    expect(aggregate.project_evidence).toEqual([]);
    expect(aggregate.direction_evidence).toEqual([]);
    expect(aggregate.observation_candidates).toEqual([]);
  });

  it.each([
    ["input_missing", "explicit input path does not exist"],
    ["input_unreadable", "explicit input path could not be read"],
  ])("uses an absence marker for explicit failed input without raw bytes: %s", (reasonCode, reasonDetail) => {
    const providerResult = makeProviderResult({
      source_input_hash: undefined,
      events: [],
      rejected_events: [{ reason_code: reasonCode, reason_detail: reasonDetail }],
      status: "failed",
      status_reason: reasonCode,
    });

    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-14",
      generatedAt: "2026-06-14T01:00:00.000Z",
      providerResult,
    });

    expect(aggregate.audit.warnings).toContain(SOURCE_INPUT_HASH_ABSENCE_MARKER_WARNING);
    expect(aggregate.event_count).toBe(0);
    expect(aggregate.rejected_event_count).toBe(0);
    expect(aggregate.audit.rejected_events[0]?.reason_code).toBe(reasonCode);
  });

  it("keeps the real raw-bytes hash for JSON parse failures", () => {
    const rawBytesHash = stableSourceInputHash("{ broken json");
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-14",
      generatedAt: "2026-06-14T01:00:00.000Z",
      providerResult: makeProviderResult({
        source_input_hash: rawBytesHash,
        events: [],
        rejected_events: [{ reason_code: "json_parse_error", reason_detail: "input JSON could not be parsed" }],
        status: "failed",
        status_reason: "json_parse_error",
      }),
    });

    expect(aggregate.source_input_hash).toBe(rawBytesHash);
    expect(aggregate.audit.warnings).not.toContain(SOURCE_INPUT_HASH_ABSENCE_MARKER_WARNING);
    expect(aggregate.event_count).toBe(1);
    expect(aggregate.rejected_event_count).toBe(1);
  });

  it("rejects public-unsafe aggregate summaries before returning an aggregate", () => {
    expect(() =>
      buildDailyExternalAggregate({
        date: "2026-06-14",
        providerResult: makeProviderResult(),
        observationCandidates: [
          {
            candidate_id: "candidate-1",
            scope: "project",
            candidate_kind: "needs_confirmation",
            target_key: "project:unsafe",
            display_name: "@raw_handle",
            direction_labels: [],
            binding_confidence: "unbound",
            evidence_ids: [],
            evidence_summary_cn: "unsafe",
            qualification: "needs_primary_confirmation",
            can_enter_daily: false,
            can_enter_weekly: false,
            cannot_be_primary_conclusion: true,
            caveats: [],
          },
        ],
      }),
    ).toThrow(/public-safe/);
  });

  it("writes only aggregate/latest JSON files and dry-run creates no files", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-14",
      generatedAt: "2026-06-14T01:00:00.000Z",
      providerResult: makeProviderResult(),
    });
    const dir = makeTempDir();
    const aggregatePath = path.join(dir, "2026-06-14.aggregate.json");
    const latestPath = path.join(dir, "latest.aggregate.json");
    const eventsJsonlPath = path.join(dir, "2026-06-14.events.jsonl");

    const dryRunResult = writeDailyExternalAggregate(aggregate, {
      aggregatePath,
      latestPath,
      dryRun: true,
    });

    expect(dryRunResult.planned_writes).toEqual([aggregatePath, latestPath]);
    expect(dryRunResult.written_paths).toEqual([]);
    expect(fs.existsSync(aggregatePath)).toBe(false);
    expect(fs.existsSync(latestPath)).toBe(false);

    const writeResult = writeDailyExternalAggregate(aggregate, { aggregatePath, latestPath });

    expect(writeResult.written_paths).toEqual([aggregatePath, latestPath]);
    expect(JSON.parse(fs.readFileSync(aggregatePath, "utf-8"))).toEqual(aggregate);
    expect(JSON.parse(fs.readFileSync(latestPath, "utf-8"))).toEqual(aggregate);
    expect(fs.existsSync(eventsJsonlPath)).toBe(false);
  });

  it("plans default public aggregate paths without writing public events JSONL", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-14",
      generatedAt: "2026-06-14T01:00:00.000Z",
      providerResult: makeProviderResult(),
    });

    const result = writeDailyExternalAggregate(aggregate, { dryRun: true });

    expect(result.planned_writes).toEqual([
      "data/external-discovery/2026-06-14.aggregate.json",
      "data/external-discovery/latest.aggregate.json",
    ]);
    expect(result.planned_writes.join("\n")).not.toContain("events.jsonl");
  });
});
