import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyEntityRegistry, readEntityRegistryWithWarnings, type EntityRegistryLookupContext, type ExternalEntityRegistryEntry } from "../externalDiscovery/entityRegistry.ts";

const socialContext: EntityRegistryLookupContext = {
  platform: "x_twitter",
  raw_event_kind: "discussion",
  url: "https://x.com/someone/status/1",
};

const officialBlogContext: EntityRegistryLookupContext = {
  platform: "official_blog",
  raw_event_kind: "blog_post",
  url: "https://openai.com/blog/agents-sdk",
};

const githubOwnerContext: EntityRegistryLookupContext = {
  platform: "official_web",
  raw_event_kind: "official_release",
  url: "https://github.com/openai/agents-sdk/releases/tag/v1",
};

const registry: ExternalEntityRegistryEntry[] = [
  {
    entity_id: "entity-openai",
    display_name: "OpenAI",
    actor_type: "institution",
    tier: "core",
    aliases: ["OpenAI"],
    handles: ["openai"],
    profile_urls: ["https://x.com/openai"],
    domains: ["openai.com"],
    github_owners: ["openai"],
    updated_at: "2026-06-30T00:00:00.000Z",
  },
];

function tempFile(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "external-registry-"));
  return path.join(dir, name);
}

describe("external discovery entity registry", () => {
  it("promotes registry entity id hits only when a source role can be resolved", () => {
    const result = applyEntityRegistry({ registry_entity_id: "entity-openai", provider_actor_id: "raw-1", provider_tier_hint: "core" }, registry, socialContext);

    expect(result.warnings).toEqual([]);
    expect(result.actor).toMatchObject({
      actor_type: "institution",
      effective_tier: "core",
      tier_basis: "registry",
      registry_entity_id: "entity-openai",
      registry_display_name: "OpenAI",
      registry_tier: "core",
      source_roles: ["social_discussant"],
    });
  });

  it("does not publish registry entity id hits without role context", () => {
    const result = applyEntityRegistry({ registry_entity_id: "entity-openai", provider_actor_id: "raw-1", provider_tier_hint: "core" }, registry);

    expect(result.warnings[0]?.reason_code).toBe("named_actor_role_unresolved");
    expect(result.actor.tier_basis).toBe("provider_hint");
    expect(result.actor.registry_entity_id).toBeUndefined();
  });

  it("matches handles and profile URLs as social discussants", () => {
    const handleResult = applyEntityRegistry({ actor_type: "institution", handle: "@openai", provider_tier_hint: "core" }, registry, socialContext);
    const profileResult = applyEntityRegistry({ actor_type: "institution", platform_profile_url: "https://x.com/OpenAI" }, registry, socialContext);

    expect(handleResult.warnings).toEqual([]);
    expect(handleResult.actor).toMatchObject({
      effective_tier: "core",
      tier_basis: "registry",
      registry_display_name: "OpenAI",
      source_roles: ["social_discussant"],
    });
    expect(profileResult.actor.source_roles).toEqual(["social_discussant"]);
  });

  it("does not match display names or provider tier hints by themselves", () => {
    const result = applyEntityRegistry({ actor_type: "institution", display_name: "OpenAI", provider_tier_hint: "core" }, registry, socialContext);

    expect(result.warnings[0]?.reason_code).toBe("registry_miss");
    expect(result.actor.effective_tier).toBe("ordinary");
    expect(result.actor.registry_entity_id).toBeUndefined();
  });

  it("does not treat bare provider actor ids as registry handles", () => {
    const result = applyEntityRegistry({ actor_type: "institution", provider_actor_id: "openai", provider_tier_hint: "core" }, registry, socialContext);

    expect(result.warnings[0]?.reason_code).toBe("registry_miss");
    expect(result.actor.registry_entity_id).toBeUndefined();
  });

  it("matches official publisher and official owner roles from source context", () => {
    const publisher = applyEntityRegistry({ registry_entity_id: "entity-openai" }, registry, officialBlogContext);
    const owner = applyEntityRegistry({ registry_entity_id: "entity-openai" }, registry, githubOwnerContext);

    expect(publisher.actor.source_roles).toEqual(["official_publisher"]);
    expect(owner.actor.source_roles).toEqual(["official_publisher", "official_owner"]);
  });

  it("keeps provider tier hints anonymous when registry misses", () => {
    const result = applyEntityRegistry({ actor_type: "person", provider_actor_id: "raw-2", provider_tier_hint: "core" }, registry, socialContext);

    expect(result.warnings[0]?.reason_code).toBe("registry_miss");
    expect(result.actor.effective_tier).toBe("ordinary");
    expect(result.actor.tier_basis).toBe("provider_hint");
    expect(result.actor.registry_entity_id).toBeUndefined();
  });

  it("allows empty registry startup without creating top-tier actors", () => {
    const result = applyEntityRegistry({ actor_type: "community", provider_tier_hint: "watch" }, [], socialContext);

    expect(result.warnings[0]?.reason_code).toBe("registry_empty");
    expect(result.actor.effective_tier).toBe("ordinary");
    expect(result.actor.registry_tier).toBeUndefined();
  });

  it("reports invalid registry entries without allowing them to match", () => {
    const filepath = tempFile("entity-registry.json");
    fs.writeFileSync(
      filepath,
      JSON.stringify([
        {
          entity_id: "entity-unsafe",
          display_name: "Unsafe",
          actor_type: "institution",
          tier: "core",
          handles: ["unsafe"],
          profile_urls: [],
          private_diagnostics: "token should not be here",
          updated_at: "2026-06-30T00:00:00.000Z",
        },
      ]),
      "utf-8",
    );

    const result = readEntityRegistryWithWarnings(filepath);
    expect(result.entries).toEqual([]);
    expect(result.warnings[0]?.reason_code).toBe("registry_invalid");
  });
});
