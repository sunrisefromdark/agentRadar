import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
  buildWeeklyExternalDiscoveryArtifacts,
  readWeeklyExternalDiscoveryWindow,
} from "../externalDiscovery/weeklyWindow.ts";
import type {
  DailyExternalAggregate,
  ExternalEvidence,
  ExternalPlatform,
  ObservationCandidate,
} from "../externalDiscovery/types.ts";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "external-direction-gate-"));
  tempDirs.push(dir);
  return dir;
}

function makeDirectionEvidence(
  id: string,
  date: string,
  platform: ExternalPlatform,
  overrides: Partial<ExternalEvidence> = {},
): ExternalEvidence {
  return {
    evidence_id: id,
    event_ids: [`${id}-event`],
    scope: "direction",
    target_key: "topic:agent-memory",
    derived_signal_kinds: ["evidence"],
    direction_labels: [],
    platforms: [platform],
    actor_tiers: { ordinary: 1 },
    actor_types: { team: 1 },
    mention_count: 1,
    distinct_actor_count: 1,
    first_seen_at: `${date}T00:00:00.000Z`,
    last_seen_at: `${date}T00:00:00.000Z`,
    active_day_count: 1,
    cross_platform: false,
    authority_summary_cn: "external direction evidence only.",
    intensity_summary_cn: "one sanitized mention.",
    persistence_summary_cn: "one day only.",
    caveats: ["external direction evidence cannot become a primary conclusion"],
    ...overrides,
  };
}

function makeDirectionCandidate(date: string, evidenceIds: string[]): ObservationCandidate {
  return {
    candidate_id: `direction-candidate-${date}`,
    scope: "direction",
    candidate_kind: "direction_watch",
    target_key: "topic:agent-memory",
    display_name: "Agent memory",
    topic_key: "agent-memory",
    direction_labels: [],
    binding_confidence: "medium",
    evidence_ids: evidenceIds,
    evidence_summary_cn: "sanitized external direction evidence.",
    qualification: "supporting_evidence_only",
    can_enter_daily: false,
    can_enter_weekly: true,
    cannot_be_primary_conclusion: true,
    caveats: ["not primary-source confirmation"],
  };
}

function makeAggregate(
  date: string,
  directionEvidence: ExternalEvidence[],
  candidates: ObservationCandidate[],
): DailyExternalAggregate {
  return {
    schema_version: "external-discovery.aggregate.v1",
    date,
    generated_at: `${date}T01:00:00.000Z`,
    provider: "agent-reach",
    status: "ok",
    status_reason: "ok",
    source_input_hash: `sha256:${date}`,
    public_safe: true,
    redaction_policy_version: "external-discovery-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    event_count: directionEvidence.length,
    accepted_event_count: directionEvidence.length,
    rejected_event_count: 0,
    platform_counts: directionEvidence.reduce<DailyExternalAggregate["platform_counts"]>((counts, evidence) => {
      for (const platform of evidence.platforms) counts[platform] = (counts[platform] ?? 0) + 1;
      return counts;
    }, {}),
    derived_signal_kind_counts: { evidence: directionEvidence.length },
    direction_label_counts: { "research-agent": directionEvidence.length },
    project_evidence: [],
    direction_evidence: directionEvidence,
    observation_candidates: candidates,
    audit: {
      rejected_events: [],
      warnings: [],
    },
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

describe("external discovery weekly direction gate", () => {
  it("creates a weekly direction observation only when at least two gate conditions are satisfied", () => {
    const dir = makeTempDir();
    const dayOneEvidence = makeDirectionEvidence("evidence-day-one", "2026-06-13", "official_blog", {
      direction_labels: ["research-agent"],
      actor_tiers: { core: 1 },
      actor_types: { institution: 1 },
      distinct_actor_count: 2,
    });
    const dayTwoEvidence = makeDirectionEvidence("evidence-day-two", "2026-06-14", "reddit", {
      direction_labels: ["research-agent"],
    });
    writeAggregate(dir, makeAggregate("2026-06-13", [dayOneEvidence], [makeDirectionCandidate("2026-06-13", ["evidence-day-one"])]));
    writeAggregate(dir, makeAggregate("2026-06-14", [dayTwoEvidence], [makeDirectionCandidate("2026-06-14", ["evidence-day-two"])]));

    const window = readWeeklyExternalDiscoveryWindow("2026-06-14", {
      aggregatePathForDate: (date) => path.join(dir, `${date}.aggregate.json`),
    });
    const artifacts = buildWeeklyExternalDiscoveryArtifacts(window);
    const observation = artifacts.weekly_direction_observations.find(
      (item) => item.topic_key === "agent-memory",
    );

    expect(observation?.satisfied_gates).toEqual([
      "cross_platform_confirmation",
      "multi_actor_confirmation",
      "multi_day_persistence",
      "registry_tier_participation",
    ]);
    expect(observation?.direction_labels).toEqual(["research-agent"]);
    expect(observation?.cannot_be_primary_conclusion).toBe(true);
    expect(artifacts.external_cross_platform_confirmations[0]?.not_primary_source_confirmation).toBe(true);
  });

  it("keeps one-gate direction evidence out of weekly direction observations", () => {
    const dir = makeTempDir();
    const evidence = makeDirectionEvidence("multi-actor-only", "2026-06-14", "official_blog", {
      direction_labels: ["research-agent"],
      distinct_actor_count: 2,
      actor_tiers: { ordinary: 2 },
    });
    writeAggregate(dir, makeAggregate("2026-06-14", [evidence], [makeDirectionCandidate("2026-06-14", ["multi-actor-only"])]));

    const window = readWeeklyExternalDiscoveryWindow("2026-06-14", {
      aggregatePathForDate: (date) => path.join(dir, `${date}.aggregate.json`),
    });
    const artifacts = buildWeeklyExternalDiscoveryArtifacts(window);

    expect(artifacts.weekly_direction_observations).toEqual([]);
    expect(artifacts.direction_gate_audit[0]?.topic_key).toBe("agent-memory");
    expect(artifacts.direction_gate_audit[0]?.satisfied_gates).toEqual(["multi_actor_confirmation"]);
  });

  it("does not count provider tier hints as registry tier participation", () => {
    const dir = makeTempDir();
    const evidence = makeDirectionEvidence("provider-hint-only", "2026-06-14", "official_blog", {
      direction_labels: ["research-agent"],
      actor_tiers: { ordinary: 1 },
      caveats: ["provider_tier_hint=core was audit-only"],
    });
    writeAggregate(dir, makeAggregate("2026-06-14", [evidence], [makeDirectionCandidate("2026-06-14", ["provider-hint-only"])]));

    const window = readWeeklyExternalDiscoveryWindow("2026-06-14", {
      aggregatePathForDate: (date) => path.join(dir, `${date}.aggregate.json`),
    });
    const artifacts = buildWeeklyExternalDiscoveryArtifacts(window);
    const audit = artifacts.direction_gate_audit[0];

    expect(audit?.satisfied_gates).not.toContain("registry_tier_participation");
    expect(artifacts.weekly_direction_observations).toEqual([]);
  });

  it("does not accumulate single-actor daily evidence into multi-actor confirmation", () => {
    const dir = makeTempDir();
    const dayOneEvidence = makeDirectionEvidence("same-actor-day-one", "2026-06-13", "official_blog", {
      direction_labels: ["research-agent"],
      distinct_actor_count: 1,
      actor_tiers: { ordinary: 1 },
    });
    const dayTwoEvidence = makeDirectionEvidence("same-actor-day-two", "2026-06-14", "official_blog", {
      direction_labels: ["research-agent"],
      distinct_actor_count: 1,
      actor_tiers: { ordinary: 1 },
    });
    writeAggregate(dir, makeAggregate("2026-06-13", [dayOneEvidence], [makeDirectionCandidate("2026-06-13", ["same-actor-day-one"])]));
    writeAggregate(dir, makeAggregate("2026-06-14", [dayTwoEvidence], [makeDirectionCandidate("2026-06-14", ["same-actor-day-two"])]));

    const window = readWeeklyExternalDiscoveryWindow("2026-06-14", {
      aggregatePathForDate: (date) => path.join(dir, `${date}.aggregate.json`),
    });
    const artifacts = buildWeeklyExternalDiscoveryArtifacts(window);
    const audit = artifacts.direction_gate_audit.find((item) => item.topic_key === "agent-memory");

    expect(audit?.satisfied_gates).toEqual(["multi_day_persistence"]);
    expect(artifacts.weekly_direction_observations).toEqual([]);
  });

  it("does not create label-driven weekly observations from unlabeled direction evidence", () => {
    const dir = makeTempDir();
    const dayOneEvidence = makeDirectionEvidence("unlabeled-day-one", "2026-06-13", "official_blog", {
      distinct_actor_count: 2,
      actor_tiers: { core: 1 },
    });
    const dayTwoEvidence = makeDirectionEvidence("unlabeled-day-two", "2026-06-14", "reddit");
    const dayOneCandidate = makeDirectionCandidate("2026-06-13", ["unlabeled-day-one"]);
    const dayTwoCandidate = makeDirectionCandidate("2026-06-14", ["unlabeled-day-two"]);
    writeAggregate(dir, makeAggregate("2026-06-13", [dayOneEvidence], [dayOneCandidate]));
    writeAggregate(dir, makeAggregate("2026-06-14", [dayTwoEvidence], [dayTwoCandidate]));

    const window = readWeeklyExternalDiscoveryWindow("2026-06-14", {
      aggregatePathForDate: (date) => path.join(dir, `${date}.aggregate.json`),
    });
    const artifacts = buildWeeklyExternalDiscoveryArtifacts(window);

    expect(artifacts.weekly_direction_observations).toEqual([]);
    expect(artifacts.direction_gate_audit).toEqual([]);
  });
});
