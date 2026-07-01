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
});
