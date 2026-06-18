import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { buildDailyExternalAggregate } from "../externalDiscovery/aggregate.ts";
import { loadAgentReachProviderArtifact } from "../externalDiscovery/agentReachProvider.ts";
import {
  enrichExternalActorWithRegistry,
  type ExternalEntityRegistryEntry,
} from "../externalDiscovery/entityRegistry.ts";
import {
  buildDirectionObservationCandidate,
  matchExternalEventToProjects,
} from "../externalDiscovery/matching.ts";
import {
  buildWeeklyExternalDiscoveryArtifacts,
  readWeeklyExternalDiscoveryWindow,
} from "../externalDiscovery/weeklyWindow.ts";
import type { AgentReachProviderResult } from "../externalDiscovery/agentReachProvider.ts";
import type {
  DailyExternalAggregate,
  ExternalEvidence,
  ExternalSignalEvent,
  ObservationCandidate,
} from "../externalDiscovery/types.ts";
import type { NormalizedProject } from "../types.ts";

const fixtureDir = path.join(process.cwd(), "data", "raw", "external-discovery", "fixtures");
const tempDirs: string[] = [];

function fixturePath(name: string): string {
  return path.join(fixtureDir, name);
}

function loadFixture(name: string): AgentReachProviderResult {
  return loadAgentReachProviderArtifact({
    date: "2026-06-13",
    inputPath: fixturePath(name),
  });
}

function makeProject(overrides: Partial<NormalizedProject> = {}): NormalizedProject {
  return {
    project_name: "Example Project",
    repo_full_name: "example/project",
    repo_url: "https://github.com/example/project",
    ...overrides,
  } as NormalizedProject;
}

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "external-fixture-pack-"));
  tempDirs.push(dir);
  return dir;
}

function writeAggregate(dir: string, aggregate: DailyExternalAggregate): void {
  fs.writeFileSync(path.join(dir, `${aggregate.date}.aggregate.json`), JSON.stringify(aggregate, null, 2));
}

function directionEvidenceFromEvent(
  event: ExternalSignalEvent,
  date: string,
  overrides: Partial<ExternalEvidence> = {},
): ExternalEvidence {
  return {
    evidence_id: `fixture-direction-${date}-${event.platform}`,
    event_ids: [event.event_id],
    scope: "direction",
    target_key: "topic:office-agent-workflows",
    derived_signal_kinds: event.derived_signal_kinds,
    direction_labels: [...event.direction_labels],
    platforms: [event.platform],
    actor_tiers: { [event.actor.effective_tier]: 1 },
    actor_types: { [event.actor.actor_type]: 1 },
    mention_count: 1,
    distinct_actor_count: 1,
    first_seen_at: event.observed_at,
    last_seen_at: event.observed_at,
    active_day_count: 1,
    cross_platform: false,
    authority_summary_cn: "sanitized fixture direction evidence.",
    intensity_summary_cn: "one sanitized external event.",
    persistence_summary_cn: "one fixture day.",
    caveats: ["external direction evidence cannot become a primary conclusion"],
    ...overrides,
  };
}

function aggregateFromDirectionFixture(name: string, date: string): DailyExternalAggregate {
  const result = loadAgentReachProviderArtifact({
    date,
    inputPath: fixturePath(name),
  });
  const event = result.events[0];
  if (!event) throw new Error(`${name} did not produce an accepted event`);
  const candidate = buildDirectionObservationCandidate(event, {
    userInterestTopics: ["office-agent-workflows"],
  });
  if (!candidate) throw new Error(`${name} did not produce a direction candidate`);
  const evidence = directionEvidenceFromEvent(event, date, {
    evidence_id: `fixture-direction-${date}`,
    event_ids: [event.event_id],
    target_key: candidate.target_key,
    direction_labels: candidate.direction_labels,
    ...(date === "2026-06-13"
      ? {
          distinct_actor_count: 2,
          actor_tiers: { proven: 1 },
          actor_types: { institution: 1 },
        }
      : {}),
  });
  const candidateWithEvidence: ObservationCandidate = {
    ...candidate,
    evidence_ids: [evidence.evidence_id],
  };
  return buildDailyExternalAggregate({
    date,
    generatedAt: `${date}T01:00:00.000Z`,
    providerResult: result,
    directionEvidence: [evidence],
    observationCandidates: [candidateWithEvidence],
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("external discovery sanitized fixture pack", () => {
  it("covers existing-project evidence without exposing raw social fields", () => {
    const result = loadFixture("agent-reach.sample.project-evidence.sanitized.json");
    const projects = [makeProject()];
    const evidence = result.events
      .map((event) => matchExternalEventToProjects(event, projects).evidence)
      .filter((item): item is ExternalEvidence => Boolean(item));
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-13",
      providerResult: result,
      projectEvidence: evidence,
    });
    const serialized = JSON.stringify(aggregate);

    expect(result.status).toBe("ok");
    expect(aggregate.project_evidence).toHaveLength(1);
    expect(aggregate.project_evidence[0]?.target_key).toBe("repo:example/project");
    expect(aggregate.direction_label_counts["research-agent"]).toBe(1);
    expect(serialized).not.toMatch(/"content_text"|"profile_url"|"handle"|cookie|token|session|OAuth/i);
  });

  it("covers cross-platform external evidence while keeping it secondary", () => {
    const result = loadFixture("agent-reach.sample.cross-platform.sanitized.json");
    const projects = [makeProject()];
    const evidence = result.events
      .map((event) => matchExternalEventToProjects(event, projects).evidence)
      .filter((item): item is ExternalEvidence => Boolean(item));
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-13",
      providerResult: result,
      projectEvidence: evidence,
    });

    expect(result.status).toBe("ok");
    expect(aggregate.platform_counts).toMatchObject({
      reddit: 1,
      hacker_news: 1,
      official_blog: 1,
    });
    expect(aggregate.project_evidence).toHaveLength(3);
    expect(aggregate.project_evidence.every((item) => item.caveats.includes("external discovery is secondary supporting evidence only"))).toBe(true);
  });

  it("covers weekly direction observations only after the four-option gate has at least two signals", () => {
    const dir = makeTempDir();
    writeAggregate(
      dir,
      aggregateFromDirectionFixture("agent-reach.sample.weekly-direction-day-1.sanitized.json", "2026-06-13"),
    );
    writeAggregate(
      dir,
      aggregateFromDirectionFixture("agent-reach.sample.weekly-direction-day-2.sanitized.json", "2026-06-14"),
    );

    const window = readWeeklyExternalDiscoveryWindow("2026-06-14", {
      aggregatePathForDate: (date) => path.join(dir, `${date}.aggregate.json`),
    });
    const artifacts = buildWeeklyExternalDiscoveryArtifacts(window);
    const observation = artifacts.weekly_direction_observations[0];

    expect(observation?.topic_key).toBe("office-agent-workflows");
    expect(observation?.direction_labels).toEqual(["office-agent", "personal-assistant-agent"]);
    expect(observation?.satisfied_gates).toEqual([
      "cross_platform_confirmation",
      "multi_actor_confirmation",
      "multi_day_persistence",
      "registry_tier_participation",
    ]);
    expect(observation?.cannot_be_primary_conclusion).toBe(true);
  });

  it("covers registry-hit tier enrichment without copying curated handles into public aggregate", () => {
    const result = loadFixture("agent-reach.sample.registry-hit.sanitized.json");
    const event = result.events[0];
    const registry: ExternalEntityRegistryEntry[] = [
      {
        entity_id: "entity-example-research-lab",
        display_name: "Example Research Lab",
        actor_type: "institution",
        tier: "proven",
        handles: ["example-research-lab"],
        profile_urls: ["https://example.com/entities/example-research-lab"],
        updated_at: "2026-06-13T00:00:00.000Z",
      },
    ];
    if (!event) throw new Error("registry-hit fixture did not produce an accepted event");
    const enrichment = enrichExternalActorWithRegistry(event.actor, registry);
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-13",
      providerResult: {
        ...result,
        events: [{ ...event, actor: enrichment.actor }],
        warnings: [...result.warnings, ...enrichment.warnings],
      },
    });
    const serialized = JSON.stringify(aggregate);

    expect(enrichment.actor.effective_tier).toBe("proven");
    expect(enrichment.actor.tier_basis).toBe("registry");
    expect(serialized).not.toContain("example-research-lab");
    expect(serialized).not.toContain('"profile_urls"');
  });

  it("covers noisy inputs by preserving accepted sanitized events and auditing rejections", () => {
    const result = loadFixture("agent-reach.sample.invalid-noise.sanitized.json");
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-13",
      providerResult: result,
    });

    expect(result.status).toBe("partial");
    expect(result.events).toHaveLength(1);
    expect(result.rejected_events.map((item) => item.reason_code)).toEqual([
      "unsupported_platform",
      "missing_observed_at",
    ]);
    expect(result.warnings).toContain("dropped_direction_label:mcp");
    expect(aggregate.accepted_event_count).toBe(1);
    expect(aggregate.rejected_event_count).toBe(2);
  });
});
