import { describe, expect, it } from "vitest";
import { assertPublicSafeAggregate, containsForbiddenPublicArtifactText, stableSourceInputHash } from "../externalDiscovery/redaction.ts";

function safeAggregate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    public_safe: true,
    contains_raw_text: false,
    contains_profile_urls: false,
    redaction_policy_version: "external-discovery-redaction.v1",
    source_input_hash: stableSourceInputHash("fixture"),
    named_registry_actors: [
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
    ],
    ...overrides,
  };
}

describe("external discovery redaction", () => {
  it("allows sanitized aggregates with registry-derived named actors", () => {
    expect(assertPublicSafeAggregate(safeAggregate()).ok).toBe(true);
  });

  it("rejects raw text, profile URLs, handles, provider diagnostics, and secrets", () => {
    expect(containsForbiddenPublicArtifactText({ content_text: "raw social text" })).toBe(true);
    expect(containsForbiddenPublicArtifactText({ profile_url: "https://x.com/raw-profile" })).toBe(true);
    expect(containsForbiddenPublicArtifactText({ handle: "@raw" })).toBe(true);
    expect(containsForbiddenPublicArtifactText({ provider_diagnostics: { trace: "private" } })).toBe(true);
    expect(containsForbiddenPublicArtifactText({ status_reason: "oauth token leaked" })).toBe(true);
    expect(containsForbiddenPublicArtifactText({ status_reason: "api token: leaked" })).toBe(true);
    expect(containsForbiddenPublicArtifactText({ status_reason: "token=leaked" })).toBe(true);
  });

  it("allows public project identifiers that contain token as a domain term", () => {
    expect(
      containsForbiddenPublicArtifactText({
        target_key: "https://github.com/swaranshu-borgaonkar/token-budget-contracts",
      }),
    ).toBe(false);
  });

  it("rejects named_registry_actors that carry raw identity fields", () => {
    const result = assertPublicSafeAggregate(
      safeAggregate({
        named_registry_actors: [
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
            handle: "@openai",
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason_codes).toContain("forbidden_key:handle");
  });

  it("requires public aggregate safety flags", () => {
    const result = assertPublicSafeAggregate(
      safeAggregate({
        public_safe: false,
        contains_raw_text: true,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason_codes).toContain("public_safe_not_true");
    expect(result.reason_codes).toContain("contains_raw_text_not_false");
  });

  it("validates public actor safety and head actor semantics", () => {
    const result = assertPublicSafeAggregate(
      safeAggregate({
        project_evidence: [
          {
            public_actors: [
              {
                public_actor_id: "x:openai",
                display_name: "@openai",
                actor_type: "institution",
                actor_role: "discussion_actor",
                authority_tier: "core",
                tier_basis: "provider_hint",
                is_head_actor: true,
                source_kind: "x_handle",
                source_basis: "explicit_actor_field",
                event_count: 1,
                platforms: ["x_twitter"],
                first_seen_at: "2026-07-05T00:00:00.000Z",
                last_seen_at: "2026-07-05T00:00:00.000Z",
              },
            ],
          },
        ],
        direction_evidence: [],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason_codes).toContain("public_actor_head_without_registry_match");
  });

  it("rejects public actor ids that are URLs", () => {
    const result = assertPublicSafeAggregate(
      safeAggregate({
        project_evidence: [
          {
            public_actors: [
              {
                public_actor_id: "https://x.com/openai",
                display_name: "@openai",
                actor_type: "institution",
                actor_role: "discussion_actor",
                tier_basis: "none",
                is_head_actor: false,
                source_kind: "x_handle",
                source_basis: "source_url_path",
                event_count: 1,
                platforms: ["x_twitter"],
                first_seen_at: "2026-07-05T00:00:00.000Z",
                last_seen_at: "2026-07-05T00:00:00.000Z",
              },
            ],
          },
        ],
        direction_evidence: [],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason_codes).toContain("public_actor_id_url");
  });

  it("rejects public actor audit status and reason mismatches", () => {
    const result = assertPublicSafeAggregate(
      safeAggregate({
        project_evidence: [
          {
            public_actor_audit: [
              {
                platform: "x_twitter",
                status: "missing",
                reason: "actor_public_identity_available",
                event_count: 1,
              },
            ],
          },
        ],
        direction_evidence: [],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason_codes).toContain("public_actor_audit_non_available_reason_mismatch");
  });
});
