import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
  buildWeeklyExternalDiscoveryArtifacts,
  readWeeklyExternalDiscoveryWindow,
} from "../externalDiscovery/weeklyWindow.ts";
import { renderWeeklyReport } from "../action/weeklyReport.ts";
import type {
  DailyExternalAggregate,
  ExternalDiscoveryCoverage,
  ExternalEvidence,
} from "../externalDiscovery/types.ts";
import type { WeeklyReport } from "../types.ts";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "external-weekly-"));
  tempDirs.push(dir);
  return dir;
}

function makeProjectEvidence(overrides: Partial<ExternalEvidence> = {}): ExternalEvidence {
  return {
    evidence_id: "external-project-evidence-1",
    event_ids: ["event-1"],
    scope: "project",
    target_key: "repo:example/project",
    derived_signal_kinds: ["evidence"],
    direction_labels: [],
    platforms: ["official_blog"],
    actor_tiers: { ordinary: 1 },
    actor_types: { team: 1 },
    mention_count: 1,
    distinct_actor_count: 1,
    first_seen_at: "2026-06-14T00:00:00.000Z",
    last_seen_at: "2026-06-14T00:00:00.000Z",
    active_day_count: 1,
    cross_platform: false,
    authority_summary_cn: "registry tier unavailable; external evidence only.",
    intensity_summary_cn: "one sanitized external mention.",
    persistence_summary_cn: "one day only.",
    caveats: ["external evidence cannot change primary score"],
    ...overrides,
  };
}

function makeAggregate(overrides: Partial<DailyExternalAggregate> = {}): DailyExternalAggregate {
  return {
    schema_version: "external-discovery.aggregate.v1",
    date: "2026-06-14",
    generated_at: "2026-06-14T01:00:00.000Z",
    provider: "agent-reach",
    status: "ok",
    status_reason: "ok",
    source_input_hash: "sha256:external-input",
    public_safe: true,
    redaction_policy_version: "external-discovery-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    event_count: 1,
    accepted_event_count: 1,
    rejected_event_count: 0,
    platform_counts: { official_blog: 1 },
    derived_signal_kind_counts: { evidence: 1 },
    direction_label_counts: {},
    project_evidence: [],
    direction_evidence: [],
    observation_candidates: [],
    audit: {
      rejected_events: [],
      warnings: [],
    },
    ...overrides,
  };
}

function makeCoverage(): ExternalDiscoveryCoverage {
  return {
    x_twitter: { status: "manual_import_only", reason: "reserved_provider_not_configured" },
    reddit: { status: "manual_import_only", reason: "reserved_provider_not_configured" },
    hacker_news: { status: "not_configured", reason: "provider_not_selected" },
    official_web: { status: "partial", reason: "sitemap_unavailable" },
    official_blog: { status: "ok" },
  };
}

function writeAggregate(dir: string, aggregate: DailyExternalAggregate): void {
  fs.writeFileSync(path.join(dir, `${aggregate.date}.aggregate.json`), JSON.stringify(aggregate, null, 2));
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("external discovery weekly aggregate window", () => {
  it("reads only the 7 daily public aggregate paths and tolerates missing or invalid days", () => {
    const dir = makeTempDir();
    const readPaths: string[] = [];
    writeAggregate(dir, makeAggregate({ date: "2026-06-10", status: "skipped", status_reason: "input_missing", event_count: 0, accepted_event_count: 0 }));
    fs.writeFileSync(path.join(dir, "2026-06-12.aggregate.json"), "{ broken json");
    writeAggregate(dir, makeAggregate({ date: "2026-06-14" }));

    const window = readWeeklyExternalDiscoveryWindow("2026-06-14", {
      aggregatePathForDate: (date) => {
        const aggregatePath = path.join(dir, `${date}.aggregate.json`);
        readPaths.push(aggregatePath);
        return aggregatePath;
      },
    });

    expect(window.window_start).toBe("2026-06-08");
    expect(window.window_end).toBe("2026-06-14");
    expect(window.day_statuses).toHaveLength(7);
    expect(readPaths).toHaveLength(7);
    expect(readPaths.join("\n")).not.toContain("data/raw/external-discovery");
    expect(window.day_statuses.find((day) => day.date === "2026-06-12")?.status).toBe("failed");
    expect(window.day_statuses.find((day) => day.date === "2026-06-13")?.status).toBe("skipped");
    expect(window.day_statuses.find((day) => day.date === "2026-06-14")?.status).toBe("ok");
    expect(window.usable_day_count).toBe(1);
    expect(window.failed_day_count).toBe(1);
    expect(window.missing_day_count).toBe(4);
    expect(window.status).toBe("partial");
  });

  it("returns a disabled weekly window without reading aggregate files", () => {
    let aggregatePathCalls = 0;

    const window = readWeeklyExternalDiscoveryWindow("2026-06-14", {
      disabled: true,
      disabledReason: "disabled_by_flag",
      aggregatePathForDate: () => {
        aggregatePathCalls += 1;
        return "should-not-be-read";
      },
    });

    expect(aggregatePathCalls).toBe(0);
    expect(window.status).toBe("skipped");
    expect(window.status_reason).toBe("disabled_by_flag");
    expect(window.usable_day_count).toBe(0);
    expect(window.day_statuses).toHaveLength(7);
    expect(window.day_statuses.every((day) => day.status === "skipped")).toBe(true);
  });

  it("summarizes project evidence from public aggregates without adding raw social fields", () => {
    const dir = makeTempDir();
    writeAggregate(
      dir,
      makeAggregate({
        project_evidence: [makeProjectEvidence()],
      }),
    );

    const window = readWeeklyExternalDiscoveryWindow("2026-06-14", {
      aggregatePathForDate: (date) => path.join(dir, `${date}.aggregate.json`),
    });
    const artifacts = buildWeeklyExternalDiscoveryArtifacts(window);
    const serialized = JSON.stringify(artifacts.external_project_evidence_summaries);

    expect(artifacts.external_project_evidence_summaries).toHaveLength(1);
    expect(artifacts.external_project_evidence_summaries[0]?.target_key).toBe("repo:example/project");
    expect(serialized).not.toContain("content_text");
    expect(serialized).not.toContain("profile_url");
    expect(serialized).not.toContain("token");
  });

  it("rejects public aggregates with invalid direction labels before weekly consumption", () => {
    const dir = makeTempDir();
    const aggregate = makeAggregate() as unknown as Record<string, unknown>;
    aggregate.direction_label_counts = { "cool-agent": 1 };
    fs.writeFileSync(
      path.join(dir, "2026-06-14.aggregate.json"),
      JSON.stringify(aggregate, null, 2),
    );

    const window = readWeeklyExternalDiscoveryWindow("2026-06-14", {
      aggregatePathForDate: (date) => path.join(dir, `${date}.aggregate.json`),
    });
    const artifacts = buildWeeklyExternalDiscoveryArtifacts(window);

    expect(window.day_statuses.find((day) => day.date === "2026-06-14")?.status).toBe("failed");
    expect(window.day_statuses.find((day) => day.date === "2026-06-14")?.status_reason).toBe(
      "aggregate_not_public_safe",
    );
    expect(window.usable_day_count).toBe(0);
    expect(artifacts.direction_label_counts).toEqual({});
  });

  it("renders weekly external discovery as a secondary evidence section", () => {
    const dir = makeTempDir();
    writeAggregate(
      dir,
      makeAggregate({
        project_evidence: [makeProjectEvidence()],
        audit: {
          coverage: makeCoverage(),
          rejected_events: [],
          warnings: [],
        },
      }),
    );
    const window = readWeeklyExternalDiscoveryWindow("2026-06-14", {
      aggregatePathForDate: (date) => path.join(dir, `${date}.aggregate.json`),
    });
    const artifacts = buildWeeklyExternalDiscoveryArtifacts(window);
    const report: WeeklyReport = {
      date: "2026-06-14",
      generated_at: "2026-06-14T01:00:00.000Z",
      window_start: "2026-06-08",
      window_end: "2026-06-14",
      enhancement_status: "rules-only",
      personalized_weekly_focus_applicable: false,
      overall_summary_cn: "weekly summary",
      supporting_trend_keys: [],
      core_trend_cards: [],
      personalized_weekly_focus: [],
      weak_signal_cards: [],
      enhancement_audit: { rejected_outputs: [] },
      ...artifacts,
    };

    const markdown = renderWeeklyReport(report);

    expect(window.coverage_status_counts).toEqual({
      x_twitter: { manual_import_only: 1 },
      reddit: { manual_import_only: 1 },
      hacker_news: { not_configured: 1 },
      official_web: { partial: 1 },
      official_blog: { ok: 1 },
    });
    expect(markdown).toContain("## External Discovery");
    expect(markdown).toContain("external discovery is secondary evidence only");
    expect(markdown).toContain(
      "coverage_status_counts: x_twitter(manual_import_only=1), reddit(manual_import_only=1), hacker_news(not_configured=1), official_web(partial=1), official_blog(ok=1)",
    );
    expect(markdown).toContain("external_project_evidence_summaries: 1");
    expect(markdown).not.toContain("content_text");
    expect(markdown).not.toContain("profile_url");
  });

  it("renders weekly direction labels without treating them as primary confirmation", () => {
    const dir = makeTempDir();
    writeAggregate(
      dir,
      makeAggregate({
        date: "2026-06-13",
        direction_label_counts: { "office-agent": 1 },
        direction_evidence: [
          makeProjectEvidence({
            evidence_id: "external-direction-office-1",
            scope: "direction",
            target_key: "topic:office-agent-workflows",
            direction_labels: ["office-agent"],
            platforms: ["official_blog"],
            distinct_actor_count: 2,
            actor_tiers: { core: 1 },
          }),
        ],
        observation_candidates: [
          {
            candidate_id: "candidate-office-1",
            scope: "direction",
            candidate_kind: "direction_watch",
            target_key: "topic:office-agent-workflows",
            display_name: "Office agent workflows",
            topic_key: "office-agent-workflows",
            direction_labels: ["office-agent"],
            binding_confidence: "medium",
            evidence_ids: ["external-direction-office-1"],
            evidence_summary_cn: "sanitized office-agent direction evidence.",
            qualification: "supporting_evidence_only",
            can_enter_daily: false,
            can_enter_weekly: true,
            cannot_be_primary_conclusion: true,
            caveats: ["not primary-source confirmation"],
          },
        ],
      }),
    );
    writeAggregate(
      dir,
      makeAggregate({
        date: "2026-06-14",
        direction_label_counts: { "office-agent": 1 },
        direction_evidence: [
          makeProjectEvidence({
            evidence_id: "external-direction-office-2",
            scope: "direction",
            target_key: "topic:office-agent-workflows",
            direction_labels: ["office-agent"],
            platforms: ["reddit"],
          }),
        ],
        observation_candidates: [
          {
            candidate_id: "candidate-office-2",
            scope: "direction",
            candidate_kind: "direction_watch",
            target_key: "topic:office-agent-workflows",
            display_name: "Office agent workflows",
            topic_key: "office-agent-workflows",
            direction_labels: ["office-agent"],
            binding_confidence: "medium",
            evidence_ids: ["external-direction-office-2"],
            evidence_summary_cn: "sanitized office-agent direction evidence.",
            qualification: "supporting_evidence_only",
            can_enter_daily: false,
            can_enter_weekly: true,
            cannot_be_primary_conclusion: true,
            caveats: ["not primary-source confirmation"],
          },
        ],
      }),
    );
    const window = readWeeklyExternalDiscoveryWindow("2026-06-14", {
      aggregatePathForDate: (date) => path.join(dir, `${date}.aggregate.json`),
    });
    const artifacts = buildWeeklyExternalDiscoveryArtifacts(window);
    const report: WeeklyReport = {
      date: "2026-06-14",
      generated_at: "2026-06-14T01:00:00.000Z",
      window_start: "2026-06-08",
      window_end: "2026-06-14",
      enhancement_status: "rules-only",
      personalized_weekly_focus_applicable: false,
      overall_summary_cn: "weekly summary",
      supporting_trend_keys: [],
      core_trend_cards: [],
      personalized_weekly_focus: [],
      weak_signal_cards: [],
      enhancement_audit: { rejected_outputs: [] },
      ...artifacts,
    };

    expect(artifacts.weekly_direction_observations[0]?.direction_labels).toEqual(["office-agent"]);
    const markdown = renderWeeklyReport(report);

    expect(markdown).toContain("direction_labels=office-agent");
    expect(markdown).toContain("direction_label_counts: office-agent=2");
    expect(markdown).toContain("external discovery is secondary evidence only");
  });
});
