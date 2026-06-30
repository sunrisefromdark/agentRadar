import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readAgentReachProviderArtifact } from "../externalDiscovery/agentReachProvider.ts";
import { buildDailyExternalAggregate } from "../externalDiscovery/aggregate.ts";

function tempFile(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "external-discovery-"));
  return path.join(dir, name);
}

describe("agent reach provider artifact adapter", () => {
  it("returns skipped for missing default input and failed for missing explicit input", () => {
    const missingPath = path.join(os.tmpdir(), "missing-agent-reach-input.json");

    expect(readAgentReachProviderArtifact(missingPath).status).toBe("skipped");
    expect(readAgentReachProviderArtifact(missingPath, { explicitInput: true }).status).toBe("failed");
  });

  it("reads valid local JSON artifacts into canonical events", () => {
    const filepath = tempFile("agent-reach.json");
    fs.writeFileSync(
      filepath,
      JSON.stringify({
        provider: "agent-reach",
        schema_version: "agent-reach.external-discovery.v1",
        provider_run_id: "run-1",
        generated_at: "2026-06-30T00:00:00.000Z",
        query: { keyword: "agents sdk" },
        platforms: ["x_twitter"],
        status: "ok",
        items: [
          {
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
            },
            observed_at: "2026-06-30T00:00:00.000Z",
            raw_ref: "provider:event:1",
          },
        ],
      }),
      "utf-8",
    );

    const result = readAgentReachProviderArtifact(filepath, { explicitInput: true });
    expect(result.status).toBe("ok");
    expect(result.provider_run_id).toBe("run-1");
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.actor.registry_display_name).toBe("OpenAI");
    expect(result.source_input_hash).toHaveLength(64);
  });

  it("enriches provider actors with the local registry before aggregate output", () => {
    const filepath = tempFile("agent-reach-registry-enriched.json");
    fs.writeFileSync(
      filepath,
      JSON.stringify({
        provider: "agent-reach",
        schema_version: "agent-reach.external-discovery.v1",
        provider_run_id: "run-registry-enriched",
        generated_at: "2026-06-30T00:00:00.000Z",
        query: { keyword: "agents sdk" },
        platforms: ["x_twitter"],
        status: "ok",
        items: [
          {
            event_id: "evt-registry-enriched",
            platform: "x_twitter",
            raw_event_kind: "discussion",
            derived_signal_kinds: ["evidence"],
            scope: "project",
            target_type: "project",
            target_key: "openai/agents-sdk",
            actor: {
              actor_type: "institution",
              effective_tier: "unknown",
              tier_basis: "none",
              provider_actor_id: "@openai",
              provider_tier_hint: "core",
            },
            observed_at: "2026-06-30T00:00:00.000Z",
            raw_ref: "provider:event:registry-enriched",
          },
        ],
      }),
      "utf-8",
    );

    const result = readAgentReachProviderArtifact(filepath, {
      explicitInput: true,
      entityRegistry: [
        {
          entity_id: "entity-openai",
          display_name: "OpenAI",
          actor_type: "institution",
          tier: "core",
          handles: ["openai"],
          profile_urls: ["https://x.com/openai"],
          updated_at: "2026-06-30T00:00:00.000Z",
        },
      ],
    });
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      provider_result: result,
    });

    expect(result.warnings).toEqual([]);
    expect(result.events[0]?.actor).toMatchObject({
      effective_tier: "core",
      tier_basis: "registry",
      registry_display_name: "OpenAI",
    });
    expect(aggregate.project_evidence[0]?.named_registry_actors).toEqual([
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
  });

  it("does not turn social display names into named actors without a strong identifier", () => {
    const filepath = tempFile("agent-reach-display-name-only.json");
    fs.writeFileSync(
      filepath,
      JSON.stringify({
        provider: "agent-reach",
        schema_version: "agent-reach.external-discovery.v1",
        provider_run_id: "run-display-name-only",
        generated_at: "2026-06-30T00:00:00.000Z",
        query: { keyword: "agents sdk" },
        platforms: ["x_twitter"],
        status: "ok",
        items: [
          {
            event_id: "evt-display-name-only",
            platform: "x_twitter",
            raw_event_kind: "discussion",
            derived_signal_kinds: ["evidence"],
            scope: "project",
            target_type: "project",
            target_key: "openai/agents-sdk",
            actor: {
              actor_type: "institution",
              display_name: "OpenAI",
              provider_tier_hint: "core",
            },
            observed_at: "2026-06-30T00:00:00.000Z",
            raw_ref: "provider:event:display-name-only",
          },
        ],
      }),
      "utf-8",
    );

    const result = readAgentReachProviderArtifact(filepath, {
      explicitInput: true,
      entityRegistry: [
        {
          entity_id: "entity-openai",
          display_name: "OpenAI",
          actor_type: "institution",
          tier: "core",
          handles: ["openai"],
          profile_urls: ["https://x.com/openai"],
          updated_at: "2026-06-30T00:00:00.000Z",
        },
      ],
    });
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      provider_result: result,
    });

    expect(result.warnings[0]?.reason_code).toBe("registry_miss");
    expect(aggregate.project_evidence[0]?.named_registry_actors).toEqual([]);
  });

  it("keeps identity hashes out of registry actor matching", () => {
    const filepath = tempFile("agent-reach-identity-hash-not-registry.json");
    fs.writeFileSync(
      filepath,
      JSON.stringify({
        provider: "agent-reach",
        schema_version: "agent-reach.external-discovery.v1",
        provider_run_id: "run-identity-hash",
        generated_at: "2026-06-30T00:00:00.000Z",
        query: { keyword: "agents sdk" },
        platforms: ["x_twitter"],
        status: "ok",
        items: [
          {
            event_id: "evt-identity-hash",
            platform: "x_twitter",
            raw_event_kind: "discussion",
            derived_signal_kinds: ["evidence"],
            scope: "project",
            target_type: "project",
            target_key: "openai/agents-sdk",
            actor: {
              actor_type: "community",
              identity_hash: "openai",
              provider_tier_hint: "core",
            },
            observed_at: "2026-06-30T00:00:00.000Z",
            raw_ref: "provider:event:identity-hash",
          },
        ],
      }),
      "utf-8",
    );

    const result = readAgentReachProviderArtifact(filepath, {
      explicitInput: true,
      entityRegistry: [
        {
          entity_id: "entity-openai",
          display_name: "OpenAI",
          actor_type: "institution",
          tier: "core",
          handles: ["openai"],
          profile_urls: ["https://x.com/openai"],
          updated_at: "2026-06-30T00:00:00.000Z",
        },
      ],
    });
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      provider_result: result,
    });

    expect(result.events[0]?.actor).toMatchObject({
      identity_hash: "openai",
      tier_basis: "provider_hint",
    });
    expect(result.events[0]?.actor.provider_actor_id).toBeUndefined();
    expect(result.warnings[0]?.reason_code).toBe("registry_miss");
    expect(aggregate.project_evidence[0]?.named_registry_actors).toEqual([]);
    expect(aggregate.project_evidence[0]?.distinct_actor_count).toBe(1);
  });

  it("uses profile URLs and official owner context as registry-positive inputs", () => {
    const filepath = tempFile("agent-reach-profile-and-owner.json");
    fs.writeFileSync(
      filepath,
      JSON.stringify({
        provider: "agent-reach",
        schema_version: "agent-reach.external-discovery.v1",
        provider_run_id: "run-profile-owner",
        generated_at: "2026-06-30T00:00:00.000Z",
        query: { keyword: "agents sdk" },
        platforms: ["x_twitter", "official_web"],
        status: "ok",
        items: [
          {
            event_id: "evt-profile-url",
            platform: "x_twitter",
            raw_event_kind: "discussion",
            derived_signal_kinds: ["evidence"],
            scope: "project",
            target_type: "project",
            target_key: "openai/agents-sdk",
            actor: {
              actor_type: "institution",
              platform_profile_url: "https://x.com/OpenAI",
            },
            observed_at: "2026-06-30T00:00:00.000Z",
            raw_ref: "provider:event:profile-url",
          },
          {
            event_id: "evt-github-owner",
            platform: "official_web",
            raw_event_kind: "official_release",
            derived_signal_kinds: ["evidence"],
            scope: "project",
            target_type: "project",
            target_key: "openai/agents-sdk",
            actor: {
              actor_type: "institution",
              registry_entity_id: "entity-openai",
            },
            target: {
              repo_url: "https://github.com/openai/agents-sdk",
            },
            observed_at: "2026-06-30T01:00:00.000Z",
            url: "https://github.com/openai/agents-sdk/releases/tag/v1",
          },
        ],
      }),
      "utf-8",
    );

    const result = readAgentReachProviderArtifact(filepath, {
      explicitInput: true,
      entityRegistry: [
        {
          entity_id: "entity-openai",
          display_name: "OpenAI",
          actor_type: "institution",
          tier: "core",
          handles: ["openai"],
          profile_urls: ["https://x.com/openai"],
          domains: ["openai.com"],
          github_owners: ["openai"],
          updated_at: "2026-06-30T00:00:00.000Z",
        },
      ],
    });
    const aggregate = buildDailyExternalAggregate({
      date: "2026-06-30",
      generated_at: "2026-06-30T01:00:00.000Z",
      provider_result: result,
    });

    expect(aggregate.project_evidence[0]?.named_registry_actors[0]).toMatchObject({
      display_name: "OpenAI",
      event_count: 2,
      source_roles: ["social_discussant", "official_publisher", "official_owner"],
    });
  });

  it("accepts nested target and identity hash fields from real AgentReach artifacts", () => {
    const filepath = tempFile("agent-reach-real-shape.json");
    fs.writeFileSync(
      filepath,
      JSON.stringify({
        provider: "agent-reach",
        schema_version: "agent-reach.external-discovery.v1",
        provider_run_id: "run-real-shape",
        generated_at: "2026-06-30T00:00:00.000Z",
        query: { keyword: "agents sdk" },
        platforms: ["reddit"],
        status: "ok",
        items: [
          {
            platform: "reddit",
            raw_ref: "opencli:reddit:abc",
            url: "https://reddit.com/r/LocalLLaMA/comments/abc",
            observed_at: "2026-06-30T00:00:00.000Z",
            raw_event_kind: "discussion",
            derived_signal_kinds: ["discovery", "evidence"],
            actor: {
              actor_type: "community",
              identity_hash: "sha256:community-actor",
            },
            target: {
              name: "new agent memory framework",
              topic_hint: "agent memory framework",
            },
          },
        ],
      }),
      "utf-8",
    );

    const result = readAgentReachProviderArtifact(filepath, { explicitInput: true });

    expect(result.status).toBe("ok");
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      platform: "reddit",
      scope: "direction",
      target_type: "topic",
      target_key: "new agent memory framework",
      actor: {
        actor_type: "community",
        identity_hash: "sha256:community-actor",
      },
    });
    expect(result.events[0]?.event_id).toMatch(/^agent-reach:/);
  });

  it("marks mixed valid and invalid events as partial", () => {
    const filepath = tempFile("agent-reach-partial.json");
    fs.writeFileSync(
      filepath,
      JSON.stringify({
        provider: "agent-reach",
        schema_version: "agent-reach.external-discovery.v1",
        provider_run_id: "run-partial",
        generated_at: "2026-06-30T00:00:00.000Z",
        query: { keyword: "agents sdk" },
        platforms: ["reddit"],
        status: "ok",
        items: [
          {
            event_id: "evt-valid",
            platform: "reddit",
            raw_event_kind: "discussion",
            derived_signal_kinds: ["evidence"],
            scope: "project",
            target_type: "project",
            target_key: "openai/agents-sdk",
            actor: { actor_type: "community", effective_tier: "ordinary", tier_basis: "none" },
            observed_at: "2026-06-30T00:00:00.000Z",
            raw_ref: "provider:event:valid",
          },
          {
            event_id: "evt-invalid",
            platform: "reddit",
          },
        ],
      }),
      "utf-8",
    );

    const result = readAgentReachProviderArtifact(filepath, { explicitInput: true });
    expect(result.status).toBe("partial");
    expect(result.events).toHaveLength(1);
    expect(result.rejected_events[0]?.reason_code).toBe("event_schema_invalid");
  });

  it("fails ok artifacts that miss required top-level audit fields", () => {
    const filepath = tempFile("agent-reach-missing-audit.json");
    fs.writeFileSync(
      filepath,
      JSON.stringify({
        provider: "agent-reach",
        schema_version: "agent-reach.external-discovery.v1",
        status: "ok",
        platforms: ["x_twitter"],
        items: [],
      }),
      "utf-8",
    );

    const result = readAgentReachProviderArtifact(filepath, { explicitInput: true });
    expect(result.status).toBe("failed");
    expect(result.status_reason).toBe("provider_run_id_missing");
  });

  it("rejects events with empty derived_signal_kinds", () => {
    const filepath = tempFile("agent-reach-empty-derived-kinds.json");
    fs.writeFileSync(
      filepath,
      JSON.stringify({
        provider: "agent-reach",
        schema_version: "agent-reach.external-discovery.v1",
        provider_run_id: "run-empty-kinds",
        generated_at: "2026-06-30T00:00:00.000Z",
        query: { keyword: "agents sdk" },
        platforms: ["x_twitter"],
        status: "ok",
        items: [
          {
            event_id: "evt-empty-kinds",
            platform: "x_twitter",
            raw_event_kind: "discussion",
            derived_signal_kinds: [],
            scope: "project",
            target_type: "project",
            target_key: "openai/agents-sdk",
            actor: { actor_type: "community", effective_tier: "ordinary", tier_basis: "none" },
            observed_at: "2026-06-30T00:00:00.000Z",
            raw_ref: "provider:event:empty-kinds",
          },
        ],
      }),
      "utf-8",
    );

    const result = readAgentReachProviderArtifact(filepath, { explicitInput: true });
    expect(result.status).toBe("partial");
    expect(result.events).toHaveLength(0);
    expect(result.rejected_events[0]?.reason_code).toBe("event_schema_invalid");
  });
});
