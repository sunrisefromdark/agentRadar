import { describe, expect, it } from "vitest";
import { buildPublicActorsForEvidence } from "../externalDiscovery/publicActors.ts";
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
      actor_type: "unknown",
      effective_tier: "unknown",
      tier_basis: "none",
    },
    observed_at: "2026-07-05T00:00:00.000Z",
    raw_ref: "provider:event:1",
    ...overrides,
  };
}

describe("external discovery public actors", () => {
  it("extracts X handles as discussion actors and audits available identity", () => {
    const result = buildPublicActorsForEvidence([
      event({
        url: "https://x.com/openai/status/123",
        actor: {
          actor_type: "institution",
          effective_tier: "ordinary",
          tier_basis: "provider_hint",
          handle: "OpenAI",
          provider_tier_hint: "core",
        },
      }),
    ]);

    expect(result.public_actors).toEqual([
      expect.objectContaining({
        public_actor_id: "x:openai",
        display_name: "@OpenAI",
        actor_role: "discussion_actor",
        source_kind: "x_handle",
        source_basis: "explicit_actor_field",
        tier_basis: "provider_hint",
        is_head_actor: false,
      }),
    ]);
    expect(result.public_actor_audit).toEqual([
      { platform: "x_twitter", status: "available", reason: "actor_public_identity_available", event_count: 1 },
    ]);
  });

  it("separates Reddit communities from Reddit users", () => {
    const result = buildPublicActorsForEvidence([
      event({
        event_id: "evt-community",
        platform: "reddit",
        url: "https://www.reddit.com/r/LocalLLaMA/comments/abc/project_discussion/",
        actor: {
          actor_type: "community",
          effective_tier: "ordinary",
          tier_basis: "none",
          subreddit: "LocalLLaMA",
        },
      }),
      event({
        event_id: "evt-user",
        platform: "reddit",
        url: "https://www.reddit.com/user/agentbuilder/comments/abc",
        actor: {
          actor_type: "person",
          effective_tier: "ordinary",
          tier_basis: "none",
          username: "agentbuilder",
        },
        observed_at: "2026-07-05T01:00:00.000Z",
      }),
    ]);

    expect(result.public_actors.map((actor) => ({
      id: actor.public_actor_id,
      role: actor.actor_role,
      kind: actor.source_kind,
    }))).toEqual([
      { id: "reddit:r:localllama", role: "community_source", kind: "reddit_community" },
      { id: "reddit:u:agentbuilder", role: "discussion_actor", kind: "reddit_user" },
    ]);
  });

  it("extracts HN users from explicit fields and user URLs", () => {
    const result = buildPublicActorsForEvidence([
      event({
        platform: "hacker_news",
        url: "https://news.ycombinator.com/user?id=pg",
        actor: {
          actor_type: "person",
          effective_tier: "ordinary",
          tier_basis: "none",
          hn_user: "pg",
        },
      }),
    ]);

    expect(result.public_actors[0]).toMatchObject({
      public_actor_id: "hn:pg",
      display_name: "HN pg",
      actor_role: "discussion_actor",
      source_kind: "hn_user",
    });
  });

  it("keeps GitHub owners as project sources instead of discussion actors", () => {
    const result = buildPublicActorsForEvidence([
      event({
        platform: "official_web",
        raw_event_kind: "official_release",
        url: "https://github.com/anthropics/claude-code/releases/tag/v1",
        target_repo_url: "https://github.com/anthropics/claude-code",
        actor: {
          actor_type: "team",
          effective_tier: "ordinary",
          tier_basis: "none",
        },
      }),
    ]);

    expect(result.public_actors[0]).toMatchObject({
      public_actor_id: "github:anthropics",
      display_name: "GitHub anthropics",
      actor_role: "project_owner",
      source_kind: "github_owner",
      is_head_actor: false,
    });
  });

  it("keeps official domains out of discussion actors", () => {
    const result = buildPublicActorsForEvidence([
      event({
        platform: "official_blog",
        raw_event_kind: "blog_post",
        source_url: "https://blog.langchain.com/agent-runtime-update/",
        actor: {
          actor_type: "team",
          effective_tier: "ordinary",
          tier_basis: "none",
        },
      }),
    ]);

    expect(result.public_actors[0]).toMatchObject({
      public_actor_id: "domain:blog.langchain.com",
      actor_role: "official_publisher",
      source_kind: "official_domain",
      source_basis: "official_source_url",
      is_head_actor: false,
    });
  });

  it("allows registry social actors to be head public discussion sources", () => {
    const result = buildPublicActorsForEvidence([
      event({
        actor: {
          actor_type: "institution",
          effective_tier: "core",
          tier_basis: "registry",
          registry_entity_id: "entity-openai",
          registry_display_name: "OpenAI",
          registry_tier: "core",
          source_roles: ["social_discussant"],
        },
      }),
    ]);

    expect(result.public_actors[0]).toMatchObject({
      public_actor_id: "registry:entity-openai",
      display_name: "OpenAI",
      actor_role: "registry_entity",
      source_kind: "registry_entity",
      source_basis: "registry_match",
      tier_basis: "registry_match",
      is_head_actor: true,
    });
  });

  it("does not turn official-only registry matches into discussion actors", () => {
    const result = buildPublicActorsForEvidence([
      event({
        platform: "official_web",
        raw_event_kind: "official_release",
        actor: {
          actor_type: "institution",
          effective_tier: "core",
          tier_basis: "registry",
          registry_entity_id: "entity-openai",
          registry_display_name: "OpenAI",
          registry_tier: "core",
          source_roles: ["official_owner"],
        },
      }),
    ]);

    expect(result.public_actors.some((actor) => actor.actor_role === "registry_entity")).toBe(false);
    expect(result.public_actor_audit).toEqual([
      { platform: "official_web", status: "missing", reason: "official_source_url_missing", event_count: 1 },
    ]);
  });

  it("audits X reserved paths without inventing handles", () => {
    const result = buildPublicActorsForEvidence([
      event({
        url: "https://x.com/i/status/123",
        actor: {
          actor_type: "unknown",
          effective_tier: "unknown",
          tier_basis: "none",
        },
      }),
    ]);

    expect(result.public_actors).toEqual([]);
    expect(result.public_actor_audit).toEqual([
      { platform: "x_twitter", status: "invalid_reserved_path", reason: "x_reserved_or_indirect_url", event_count: 1 },
    ]);
  });

  it("does not publish opaque provider actor ids as social handles", () => {
    const result = buildPublicActorsForEvidence([
      event({
        actor: {
          actor_type: "person",
          effective_tier: "ordinary",
          tier_basis: "none",
          provider_actor_id: "45f8279ab8e97386",
        },
      }),
    ]);

    expect(result.public_actors).toEqual([]);
    expect(result.public_actor_audit).toEqual([
      { platform: "x_twitter", status: "missing", reason: "actor_public_identity_missing", event_count: 1 },
    ]);
  });

  it("does not extract discussion actors from target URLs", () => {
    const result = buildPublicActorsForEvidence([
      event({
        target_url: "https://x.com/openai",
        actor: {
          actor_type: "unknown",
          effective_tier: "unknown",
          tier_basis: "none",
        },
      }),
    ]);

    expect(result.public_actors).toEqual([]);
    expect(result.public_actor_audit).toEqual([
      { platform: "x_twitter", status: "missing", reason: "actor_public_identity_missing", event_count: 1 },
    ]);
  });
});
