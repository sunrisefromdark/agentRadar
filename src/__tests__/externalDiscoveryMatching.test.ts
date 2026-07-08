import { describe, expect, it } from "vitest";
import { observationCandidateForUnmatchedEvent, projectEvidenceTargetForEvent, topicKeyFromHints } from "../externalDiscovery/matching.ts";
import type { ExternalSignalEvent } from "../externalDiscovery/types.ts";

const baseEvent: ExternalSignalEvent = {
  event_id: "evt-1",
  platform: "official_blog",
  raw_event_kind: "official_release",
  derived_signal_kinds: ["discovery", "evidence"],
  scope: "project",
  target_type: "project",
  target_key: "https://github.com/openai/agents-sdk",
  actor: {
    actor_type: "institution",
    effective_tier: "core",
    tier_basis: "registry",
    registry_entity_id: "entity-openai",
    registry_display_name: "OpenAI",
    registry_tier: "core",
  },
  observed_at: "2026-06-30T00:00:00.000Z",
  raw_ref: "provider:event:1",
};

describe("external discovery matching", () => {
  it("matches project events by exact repo URL", () => {
    expect(
      projectEvidenceTargetForEvent(baseEvent, [
        {
          repo_url: "https://github.com/openai/agents-sdk",
          repo_full_name: "openai/agents-sdk",
        },
      ]),
    ).toBe("openai/agents-sdk");
  });

  it("canonicalizes topic hints in the frozen priority order", () => {
    expect(topicKeyFromHints({ userInterestTopics: ["Browser Computer Use"], providerTopicHint: "ignored" })).toBe("browser-computer-use");
    expect(topicKeyFromHints({ weeklyTrendKeys: ["Agent Runtime"], providerTopicHint: "ignored" })).toBe("agent-runtime");
    expect(topicKeyFromHints({ providerTopicHint: "Voice Agent Ops" })).toBe("voice-agent-ops");
    expect(topicKeyFromHints({})).toBeNull();
  });

  it("creates bounded observation candidates without primary-conclusion authority", () => {
    expect(observationCandidateForUnmatchedEvent(baseEvent)).toMatchObject({
      candidate_kind: "project",
      qualification: "needs_primary_confirmation",
      can_enter_daily: true,
      can_enter_weekly: false,
      cannot_be_primary_conclusion: true,
    });
    expect(
      observationCandidateForUnmatchedEvent({
        ...baseEvent,
        scope: "direction",
        target_type: "topic",
        target_key: "browser-computer-use",
      }),
    ).toMatchObject({
      candidate_kind: "direction",
      qualification: "direction_observation",
      can_enter_daily: false,
      can_enter_weekly: false,
      cannot_be_primary_conclusion: true,
    });
  });
});
