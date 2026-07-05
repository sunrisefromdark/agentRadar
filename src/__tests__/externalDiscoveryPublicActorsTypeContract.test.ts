import { describe, expect, it } from "vitest";
import {
  EXTERNAL_PUBLIC_ACTOR_IDENTITY_REASONS,
  EXTERNAL_PUBLIC_ACTOR_IDENTITY_STATUSES,
  EXTERNAL_PUBLIC_ACTOR_ROLES,
  EXTERNAL_PUBLIC_ACTOR_SOURCE_BASES,
  EXTERNAL_PUBLIC_ACTOR_SOURCE_KINDS,
  EXTERNAL_PUBLIC_ACTOR_TIER_BASES,
  type ExternalEvidence,
  type ExternalSignalEvent,
} from "../externalDiscovery/types.ts";

describe("external discovery public actors type contract", () => {
  it("keeps public actor enums closed over the reviewed contract", () => {
    expect(EXTERNAL_PUBLIC_ACTOR_ROLES).toEqual([
      "discussion_actor",
      "community_source",
      "official_publisher",
      "project_owner",
      "registry_entity",
    ]);
    expect(EXTERNAL_PUBLIC_ACTOR_SOURCE_KINDS).toEqual([
      "registry_entity",
      "x_handle",
      "reddit_community",
      "reddit_user",
      "hn_user",
      "github_owner",
      "official_domain",
      "provider_actor",
    ]);
    expect(EXTERNAL_PUBLIC_ACTOR_SOURCE_BASES).toContain("registry_match");
    expect(EXTERNAL_PUBLIC_ACTOR_SOURCE_BASES).toContain("explicit_actor_field");
    expect(EXTERNAL_PUBLIC_ACTOR_TIER_BASES).toEqual(["registry_match", "provider_hint", "none"]);
    expect(EXTERNAL_PUBLIC_ACTOR_IDENTITY_STATUSES).toEqual(["available", "missing", "invalid_reserved_path", "redacted"]);
    expect(EXTERNAL_PUBLIC_ACTOR_IDENTITY_REASONS).toContain("actor_public_identity_available");
    expect(EXTERNAL_PUBLIC_ACTOR_IDENTITY_REASONS).toContain("x_reserved_or_indirect_url");
  });

  it("places actor public identity status on canonical ExternalSignalEvent", () => {
    const event: ExternalSignalEvent = {
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
      observed_at: "2026-07-05T00:00:00.000Z",
      raw_ref: "provider:event:1",
      actor_public_identity_status: "available",
      actor_public_identity_reason: "actor_public_identity_available",
    };

    expect(event.actor_public_identity_status).toBe("available");
    expect(event.actor_public_identity_reason).toBe("actor_public_identity_available");
  });

  it("keeps public actors optional for old ExternalEvidence artifacts", () => {
    const evidence: ExternalEvidence = {
      evidence_id: "project:openai/agents-sdk",
      event_ids: ["evt-1"],
      scope: "project",
      target_key: "openai/agents-sdk",
      derived_signal_kinds: ["evidence"],
      platforms: ["x_twitter"],
      named_registry_actors: [],
      actor_tiers: { unknown: 1 },
      actor_types: { unknown: 1 },
      mention_count: 1,
      distinct_actor_count: 1,
      top_tier_actor_count: 0,
      first_seen_at: "2026-07-05T00:00:00.000Z",
      last_seen_at: "2026-07-05T00:00:00.000Z",
    };

    expect(evidence.public_actors).toBeUndefined();
    expect(evidence.public_actor_audit).toBeUndefined();
  });
});
