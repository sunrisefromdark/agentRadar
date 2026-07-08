import { describe, expect, it } from "vitest";
import { buildDailyExternalAggregate } from "../externalDiscovery/aggregate.ts";
import type { ExternalSignalEvent } from "../externalDiscovery/types.ts";

function event(overrides: Partial<ExternalSignalEvent>): ExternalSignalEvent {
  return {
    event_id: "evt-1",
    platform: "x_twitter",
    raw_event_kind: "discussion",
    derived_signal_kinds: ["evidence"],
    scope: "project",
    target_type: "project",
    target_key: "openai/agents-sdk",
    actor: {
      actor_type: "institution",
      effective_tier: "core",
      tier_basis: "registry",
      registry_entity_id: "entity-openai",
      registry_display_name: "OpenAI",
      registry_tier: "core",
      source_roles: ["social_discussant"],
    },
    observed_at: "2026-06-30T00:00:00.000Z",
    raw_ref: "provider:event:1",
    ...overrides,
  };
}

describe("external discovery aggregate", () => {
  it("builds named_registry_actors only from registry-based actors", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event({ event_id: "evt-1" }),
        event({
          event_id: "evt-2",
          platform: "reddit",
          actor: {
            actor_type: "person",
            effective_tier: "ordinary",
            tier_basis: "provider_hint",
            provider_actor_id: "raw-person-1",
            provider_tier_hint: "core",
          },
          observed_at: "2026-06-30T02:00:00.000Z",
        }),
      ],
    });

    const evidence = aggregate.project_evidence[0]!;
    expect(evidence.named_registry_actors).toEqual([
      {
        entity_id: "entity-openai",
        display_name: "OpenAI",
        actor_type: "institution",
        registry_tier: "core",
        source_roles: ["social_discussant"],
        event_count: 1,
        platforms: ["x_twitter"],
        first_seen_at: "2026-06-30T00:00:00.000Z",
        last_seen_at: "2026-06-30T00:00:00.000Z",
      },
    ]);
    expect(evidence.actor_tiers).toMatchObject({ core: 1, ordinary: 1 });
    expect(evidence.top_tier_actor_count).toBe(1);
  });

  it("keeps registry miss and provider-only actors anonymous", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event({
          actor: {
            actor_type: "person",
            effective_tier: "ordinary",
            tier_basis: "provider_hint",
            provider_actor_id: "raw-person-2",
            provider_tier_hint: "proven",
          },
        }),
      ],
    });

    const evidence = aggregate.project_evidence[0]!;
    expect(evidence.named_registry_actors).toEqual([]);
    expect(evidence.top_tier_actor_count).toBe(0);
    expect(evidence.actor_types).toMatchObject({ person: 1 });
  });

  it("publishes public actors only when they are explicit provider fields or URL-derived sources", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event({
          event_id: "evt-x",
          platform: "x_twitter",
          url: "https://x.com/openai/status/1",
          actor: {
            actor_type: "institution",
            effective_tier: "proven",
            tier_basis: "provider_hint",
            handle: "openai",
          },
        }),
        event({
          event_id: "evt-reddit",
          platform: "reddit",
          url: "https://www.reddit.com/r/LocalLLaMA/comments/abc/project_discussion/",
          actor: {
            actor_type: "community",
            effective_tier: "ordinary",
            tier_basis: "none",
          },
          observed_at: "2026-06-30T02:00:00.000Z",
        }),
        event({
          event_id: "evt-github",
          platform: "official_web",
          raw_event_kind: "official_release",
          url: "https://github.com/anthropics/claude-code/releases/tag/v1",
          target_repo_url: "https://github.com/anthropics/claude-code",
          actor: {
            actor_type: "team",
            effective_tier: "watch",
            tier_basis: "none",
          },
          observed_at: "2026-06-30T03:00:00.000Z",
        }),
      ],
    });

    const evidence = aggregate.project_evidence[0]!;
    expect((evidence.public_actors ?? []).map((actor) => ({
      id: actor.public_actor_id,
      name: actor.display_name,
      kind: actor.source_kind,
      platforms: actor.platforms,
    }))).toEqual(expect.arrayContaining([
      { id: "github:anthropics", name: "GitHub anthropics", kind: "github_owner", platforms: ["official_web"] },
      { id: "reddit:r:localllama", name: "r/LocalLLaMA", kind: "reddit_community", platforms: ["reddit"] },
      { id: "x:openai", name: "@openai", kind: "x_handle", platforms: ["x_twitter"] },
    ]));
    expect(JSON.stringify(evidence.public_actors ?? [])).not.toContain("x.com/openai");
  });

  it("sorts named registry actors by tier, count, then name", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event({
          event_id: "evt-watch",
          actor: {
            actor_type: "team",
            effective_tier: "watch",
            tier_basis: "registry",
            registry_entity_id: "entity-zeta",
            registry_display_name: "Zeta Lab",
            registry_tier: "watch",
            source_roles: ["official_owner"],
          },
        }),
        event({ event_id: "evt-core-1" }),
        event({ event_id: "evt-core-2", platform: "official_blog", observed_at: "2026-06-30T03:00:00.000Z", actor: {
          actor_type: "institution",
          effective_tier: "core",
          tier_basis: "registry",
          registry_entity_id: "entity-openai",
          registry_display_name: "OpenAI",
          registry_tier: "core",
          source_roles: ["official_publisher"],
        } }),
      ],
    });

    expect(aggregate.project_evidence[0]?.named_registry_actors.map((actor) => actor.display_name)).toEqual(["OpenAI", "Zeta Lab"]);
    expect(aggregate.project_evidence[0]?.named_registry_actors[0]?.event_count).toBe(2);
    expect(aggregate.project_evidence[0]?.named_registry_actors[0]?.source_roles).toEqual(["social_discussant", "official_publisher"]);
  });

  it("does not publish registry actors that miss source roles", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event({
          actor: {
            actor_type: "institution",
            effective_tier: "core",
            tier_basis: "registry",
            registry_entity_id: "entity-openai",
            registry_display_name: "OpenAI",
            registry_tier: "core",
          },
        }),
      ],
    });

    expect(aggregate.project_evidence[0]?.named_registry_actors).toEqual([]);
    expect(aggregate.project_evidence[0]?.top_tier_actor_count).toBe(0);
    expect(aggregate.audit.warnings[0]?.reason_code).toBe("named_actor_missing_source_roles");
  });

  it("filters stale X and Reddit results out of the daily external aggregate", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event({
          event_id: "recent-x",
          platform: "x_twitter",
          source_published_at: "2026-06-20T00:00:00.000Z",
        }),
        event({
          event_id: "old-reddit",
          platform: "reddit",
          source_published_at: "2026-05-01T00:00:00.000Z",
          actor: {
            actor_type: "community",
            effective_tier: "ordinary",
            tier_basis: "none",
            identity_hash: "reddit-user-1",
          },
        }),
        event({
          event_id: "old-official-blog",
          platform: "official_blog",
          raw_event_kind: "blog_post",
          source_published_at: "2026-01-01T00:00:00.000Z",
        }),
      ],
    });

    expect(aggregate.accepted_event_count).toBe(2);
    expect(aggregate.rejected_event_count).toBe(1);
    expect(aggregate.platform_counts).toMatchObject({ x_twitter: 1, official_blog: 1 });
    expect(aggregate.audit.rejected_events).toEqual([
      {
        event_id: "old-reddit",
        reason_code: "event_outside_recent_social_window",
        reason_detail: "reddit event is older than 30 days for aggregate date 2026-06-30",
      },
    ]);
    expect(aggregate.project_evidence[0]?.event_ids).toEqual(["old-official-blog", "recent-x"]);
  });

  it("downgrades official single-source single-event candidates and keeps them out of weekly", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event({
          event_id: "official-weak",
          platform: "official_web",
          raw_event_kind: "official_release",
          derived_signal_kinds: ["discovery"],
          target_key: "https://example.com/agent-launch",
          actor: {
            actor_type: "team",
            effective_tier: "ordinary",
            tier_basis: "none",
          },
        }),
      ],
    });

    expect(aggregate.observation_candidates).toHaveLength(1);
    expect(aggregate.observation_candidates[0]).toMatchObject({
      target_key: "https://example.com/agent-launch",
      quality_bucket: "weak_single_source",
      display_bucket: "weak_followup",
      can_enter_daily: false,
      can_enter_weekly: false,
      cannot_be_primary_conclusion: true,
      platforms: ["official_web"],
      mention_count: 1,
      distinct_actor_count: 1,
      top_tier_actor_count: 0,
    });
    expect(aggregate.observation_candidates[0]?.quality_score).toBeLessThanOrEqual(20);
    expect(aggregate.observation_candidates[0]?.quality_reasons).toEqual(expect.arrayContaining([
      "weak_single_source",
      "single_platform",
      "single_event",
      "weekly_gate_not_met",
      "cannot_be_primary_conclusion",
    ]));
  });

  it("sorts social discussion ahead of weak official single-source candidates", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event({
          event_id: "official-weak",
          platform: "official_web",
          raw_event_kind: "official_release",
          derived_signal_kinds: ["discovery"],
          target_key: "weak-official",
          actor: {
            actor_type: "team",
            effective_tier: "ordinary",
            tier_basis: "none",
          },
        }),
        event({
          event_id: "hn-discussion",
          platform: "hacker_news",
          raw_event_kind: "discussion",
          derived_signal_kinds: ["discovery"],
          target_key: "hn-project",
          actor: {
            actor_type: "community",
            effective_tier: "ordinary",
            tier_basis: "none",
            identity_hash: "hn-user-1",
          },
        }),
      ],
    });

    expect(aggregate.observation_candidates.map((candidate) => candidate.target_key)).toEqual(["hn-project", "weak-official"]);
    expect(aggregate.observation_candidates[0]).toMatchObject({
      quality_bucket: "social_discussion",
      display_bucket: "new_discovery",
      can_enter_daily: true,
      can_enter_weekly: false,
    });
    expect(aggregate.observation_candidates[1]).toMatchObject({
      quality_bucket: "weak_single_source",
      display_bucket: "weak_followup",
      can_enter_daily: false,
      can_enter_weekly: false,
    });
  });

  it("promotes cross-platform project evidence within the external layer only", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event({
          event_id: "x-cross",
          platform: "x_twitter",
          target_key: "cross/project",
          source_published_at: "2026-06-29T00:00:00.000Z",
        }),
        event({
          event_id: "reddit-cross",
          platform: "reddit",
          target_key: "cross/project",
          source_published_at: "2026-06-29T02:00:00.000Z",
          actor: {
            actor_type: "community",
            effective_tier: "ordinary",
            tier_basis: "none",
            identity_hash: "reddit-user-1",
          },
        }),
      ],
    });

    expect(aggregate.observation_candidates[0]).toMatchObject({
      target_key: "cross/project",
      quality_bucket: "cross_platform_confirmed",
      display_bucket: "project_evidence",
      can_enter_daily: true,
      can_enter_weekly: true,
      cannot_be_primary_conclusion: true,
      platforms: ["reddit", "x_twitter"],
      mention_count: 2,
    });
    expect(aggregate.observation_candidates[0]?.quality_reasons).toContain("cross_platform_confirmed");
  });

  it("keeps direction single-day signals as direction observations without daily or weekly eligibility", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event({
          event_id: "direction-1",
          scope: "direction",
          target_type: "topic",
          target_key: "agent-browser-use",
          derived_signal_kinds: ["discovery"],
          platform: "hacker_news",
          actor: {
            actor_type: "community",
            effective_tier: "ordinary",
            tier_basis: "none",
            identity_hash: "hn-user-1",
          },
        }),
      ],
    });

    expect(aggregate.observation_candidates[0]).toMatchObject({
      candidate_kind: "direction",
      target_key: "agent-browser-use",
      qualification: "direction_observation",
      quality_bucket: "social_discussion",
      display_bucket: "direction_observation",
      can_enter_daily: false,
      can_enter_weekly: false,
      cannot_be_primary_conclusion: true,
    });
    expect(aggregate.observation_candidates[0]?.quality_reasons).toEqual(expect.arrayContaining([
      "direction_candidate",
      "weekly_gate_not_met",
      "cannot_be_primary_conclusion",
    ]));
  });

  it("does not upgrade official weak signals only because URL-derived public actors exist", () => {
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      events: [
        event({
          event_id: "official-owner-only",
          platform: "official_web",
          raw_event_kind: "official_release",
          derived_signal_kinds: ["discovery"],
          url: "https://github.com/anthropics/claude-code/releases/tag/v1",
          target_repo_url: "https://github.com/anthropics/claude-code",
          target_key: "https://github.com/anthropics/claude-code",
          actor: {
            actor_type: "team",
            effective_tier: "watch",
            tier_basis: "none",
          },
        }),
      ],
    });

    expect(aggregate.project_evidence[0]?.public_actors?.some((actor) => actor.source_kind === "github_owner")).toBe(true);
    expect(aggregate.observation_candidates[0]).toMatchObject({
      quality_bucket: "weak_single_source",
      display_bucket: "weak_followup",
      can_enter_daily: false,
      can_enter_weekly: false,
    });
  });
});
