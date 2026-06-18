import { describe, expect, it } from "vitest";
import { buildDailyExternalEvidence } from "../externalDiscovery/dailyEvidence.ts";
import type { ExternalSignalEvent } from "../externalDiscovery/types.ts";

function makeTopicEvent(overrides: Partial<ExternalSignalEvent> = {}): ExternalSignalEvent {
  return {
    event_id: "external-topic-event-1",
    provider: "agent-reach",
    platform: "official_blog",
    raw_event_kind: "blog_post",
    derived_signal_kinds: ["discovery", "evidence"],
    observed_at: "2026-06-14T00:00:00.000Z",
    ingested_at: "2026-06-14T00:01:00.000Z",
    actor: {
      display_name: "Example Team",
      actor_type: "team",
      effective_tier: "ordinary",
      tier_basis: "registry_miss",
    },
    target: {
      target_type: "topic",
      name: "Agent Memory",
      topic_key: "agent-memory",
      binding_confidence: "unbound",
    },
    direction_labels: ["research-agent"],
    tags: [],
    notes: [],
    ...overrides,
  };
}

describe("external discovery daily evidence builder", () => {
  it("turns topic events into direction evidence linked from the weekly candidate", () => {
    const result = buildDailyExternalEvidence({
      events: [makeTopicEvent()],
      projects: [],
      topicContext: {
        weeklyTrendKeys: ["agent-memory"],
      },
    });

    expect(result.projectEvidence).toEqual([]);
    expect(result.directionEvidence).toHaveLength(1);
    expect(result.observationCandidates).toHaveLength(1);

    const evidence = result.directionEvidence[0]!;
    const candidate = result.observationCandidates[0]!;
    expect(evidence.scope).toBe("direction");
    expect(evidence.target_key).toBe("topic:agent-memory");
    expect(evidence.event_ids).toEqual(["external-topic-event-1"]);
    expect(evidence.platforms).toEqual(["official_blog"]);
    expect(evidence.actor_tiers).toEqual({ ordinary: 1 });
    expect(evidence.distinct_actor_count).toBe(1);
    expect(evidence.direction_labels).toEqual(["research-agent"]);
    expect(candidate.scope).toBe("direction");
    expect(candidate.direction_labels).toEqual(["research-agent"]);
    expect(candidate.can_enter_weekly).toBe(true);
    expect(candidate.evidence_ids).toEqual([evidence.evidence_id]);
    expect(candidate.cannot_be_primary_conclusion).toBe(true);
  });

  it("canonicalizes provider topic hints through the topic context before weekly use", () => {
    const result = buildDailyExternalEvidence({
      events: [
        makeTopicEvent({
          target: {
            target_type: "topic",
            name: "Provider raw label",
            topic_hint: "Agent Runtime",
            binding_confidence: "unbound",
          },
        }),
      ],
      projects: [],
      topicContext: {
        userInterestTopics: ["agent-runtime"],
      },
    });

    expect(result.directionEvidence).toHaveLength(1);
    expect(result.observationCandidates[0]?.topic_key).toBe("agent-runtime");
    expect(result.directionEvidence[0]?.target_key).toBe("topic:agent-runtime");
  });
});
