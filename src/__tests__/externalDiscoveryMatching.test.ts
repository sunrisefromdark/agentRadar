import { describe, expect, it } from "vitest";
import {
  buildDirectionObservationCandidate,
  canonicalizeTopicKey,
  matchExternalEventToProjects,
} from "../externalDiscovery/matching.ts";
import type { ExternalSignalEvent } from "../externalDiscovery/types.ts";
import type { NormalizedProject } from "../types.ts";

function makeProject(overrides: Partial<NormalizedProject> = {}): NormalizedProject {
  return {
    project_name: "Example Project",
    repo_url: "https://github.com/example/project",
    repo_full_name: "example/project",
    first_seen: "2026-06-13",
    last_seen: "2026-06-14",
    sources: ["agents-radar"],
    source_counts: { "agents-radar": 1 },
    appearances: 1,
    appearance_dates: ["2026-06-14"],
    persistence_state: "single-spike",
    stars: 100,
    forks: 10,
    issues: 1,
    PR: 1,
    tags: ["agent-runtime"],
    description: "Agent runtime project",
    metrics_source: "embedded",
    metrics_trust_score: 1,
    data_trust: "high",
    star_delta_available: true,
    trust_flags: [],
    raw_signals: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<ExternalSignalEvent> = {}): ExternalSignalEvent {
  return {
    event_id: "evt-1",
    provider: "agent-reach",
    platform: "official_blog",
    raw_event_kind: "blog_post",
    derived_signal_kinds: ["discovery", "evidence"],
    observed_at: "2026-06-14T00:00:00.000Z",
    ingested_at: "2026-06-14T00:01:00.000Z",
    actor: {
      display_name: "Example Team",
      actor_type: "team",
      effective_tier: "unknown",
      tier_basis: "unknown",
    },
    target: {
      target_type: "project",
      name: "Example Project",
      repo_url: "https://github.com/example/project",
      binding_confidence: "unbound",
    },
    direction_labels: [],
    tags: [],
    notes: [],
    ...overrides,
  };
}

describe("external discovery matching and topic canonicalization", () => {
  it("builds project evidence for exact repo URL matches", () => {
    const result = matchExternalEventToProjects(makeEvent(), [makeProject()]);

    expect(result.evidence?.scope).toBe("project");
    expect(result.evidence?.target_key).toBe("repo:example/project");
    expect(result.evidence?.event_ids).toEqual(["evt-1"]);
    expect(result.evidence?.platforms).toEqual(["official_blog"]);
    expect(result.candidate).toBeUndefined();
  });

  it("keeps low-confidence name matches out of daily display", () => {
    const result = matchExternalEventToProjects(
      makeEvent({
        target: {
          target_type: "project",
          name: "Example Project",
          binding_confidence: "unbound",
        },
      }),
      [makeProject()],
    );

    expect(result.evidence).toBeUndefined();
    expect(result.candidate?.binding_confidence).toBe("low");
    expect(result.candidate?.can_enter_daily).toBe(false);
    expect(result.candidate?.cannot_be_primary_conclusion).toBe(true);
  });

  it("creates needs-primary-confirmation candidates for unmatched explicit repo targets", () => {
    const result = matchExternalEventToProjects(
      makeEvent({
        target: {
          target_type: "project",
          name: "New External Project",
          repo_url: "https://github.com/example/new-project",
          binding_confidence: "unbound",
        },
      }),
      [makeProject()],
    );

    expect(result.evidence).toBeUndefined();
    expect(result.candidate?.scope).toBe("project");
    expect(result.candidate?.qualification).toBe("needs_primary_confirmation");
    expect(result.candidate?.repo_url).toBe("https://github.com/example/new-project");
    expect(result.candidate?.cannot_be_primary_conclusion).toBe(true);
  });

  it("does not fabricate repo URLs for paper targets", () => {
    const result = matchExternalEventToProjects(
      makeEvent({
        target: {
          target_type: "paper",
          name: "Paper Target",
          paper_url: "https://arxiv.org/abs/2606.00001",
          binding_confidence: "unbound",
        },
      }),
      [makeProject()],
    );

    expect(result.candidate?.paper_url).toBe("https://arxiv.org/abs/2606.00001");
    expect(result.candidate).not.toHaveProperty("repo_url");
  });

  it("canonicalizes topic keys by user interest topic before provider hint fallback", () => {
    expect(
      canonicalizeTopicKey("Agent Runtime", {
        userInterestTopics: ["agent-runtime"],
        weeklyTrendKeys: [],
        paradigmLabels: [],
      }),
    ).toBe("agent-runtime");
    expect(canonicalizeTopicKey("Agent Workflow Verification", {})).toBe(
      "agent-workflow-verification",
    );
  });

  it("uses weekly trend keys or paradigm labels before provider hint fallback", () => {
    expect(
      canonicalizeTopicKey("memory systems", {
        weeklyTrendKeys: ["memory-systems"],
      }),
    ).toBe("memory-systems");
    expect(
      canonicalizeTopicKey("Agent Infra", {
        paradigmLabels: ["Agent Infra"],
      }),
    ).toBe("agent-infra");
  });

  it("requires stable topic keys before marking direction candidates weekly-capable", () => {
    const withoutTopicKey = buildDirectionObservationCandidate(
      makeEvent({
        target: {
          target_type: "topic",
          name: "No topic hint",
          binding_confidence: "unbound",
        },
      }),
      {},
    );
    const withTopicKey = buildDirectionObservationCandidate(
      makeEvent({
        direction_labels: ["research-agent"],
        target: {
          target_type: "topic",
          name: "Agent Workflow Verification",
          topic_key: "agent-workflow-verification",
          binding_confidence: "unbound",
        },
      }),
      {},
    );

    expect(withoutTopicKey).toBeUndefined();
    expect(withTopicKey?.scope).toBe("direction");
    expect(withTopicKey?.topic_key).toBe("agent-workflow-verification");
    expect(withTopicKey?.direction_labels).toEqual(["research-agent"]);
    expect(withTopicKey?.can_enter_weekly).toBe(true);
    expect(withTopicKey?.cannot_be_primary_conclusion).toBe(true);
    expect(withTopicKey?.caveats.join("\n")).toContain("no explicit repo or paper binding yet");
  });

  it("keeps unlabeled direction candidates out of label-driven weekly observation", () => {
    const candidate = buildDirectionObservationCandidate(
      makeEvent({
        target: {
          target_type: "topic",
          name: "Research Agent Workflows",
          topic_key: "research-agent-workflows",
          binding_confidence: "unbound",
        },
      }),
      {},
    );

    expect(candidate?.direction_labels).toEqual([]);
    expect(candidate?.can_enter_weekly).toBe(false);
    expect(candidate?.caveats).toContain("missing_direction_labels");
  });
});
