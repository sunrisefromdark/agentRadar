import { describe, expect, it } from "vitest";
import { applyEntityRegistry, type ExternalEntityRegistryEntry } from "../externalDiscovery/entityRegistry.ts";

const registry: ExternalEntityRegistryEntry[] = [
  {
    entity_id: "entity-openai",
    display_name: "OpenAI",
    actor_type: "institution",
    tier: "core",
    handles: ["openai"],
    profile_urls: ["https://x.com/openai"],
    updated_at: "2026-06-30T00:00:00.000Z",
  },
];

describe("external discovery entity registry", () => {
  it("promotes only registry hits to registry-based effective tiers", () => {
    const result = applyEntityRegistry({ registry_entity_id: "entity-openai", provider_actor_id: "raw-1", provider_tier_hint: "core" }, registry);

    expect(result.warnings).toEqual([]);
    expect(result.actor).toMatchObject({
      actor_type: "institution",
      effective_tier: "core",
      tier_basis: "registry",
      registry_entity_id: "entity-openai",
      registry_display_name: "OpenAI",
      registry_tier: "core",
    });
  });

  it("matches provider actor ids against registry handles", () => {
    const result = applyEntityRegistry({ actor_type: "institution", provider_actor_id: "@openai", provider_tier_hint: "core" }, registry);

    expect(result.warnings).toEqual([]);
    expect(result.actor).toMatchObject({
      actor_type: "institution",
      effective_tier: "core",
      tier_basis: "registry",
      registry_entity_id: "entity-openai",
      registry_display_name: "OpenAI",
      registry_tier: "core",
    });
  });

  it("keeps provider tier hints anonymous when registry misses", () => {
    const result = applyEntityRegistry({ actor_type: "person", provider_actor_id: "raw-2", provider_tier_hint: "core" }, registry);

    expect(result.warnings[0]?.reason_code).toBe("registry_miss");
    expect(result.actor.effective_tier).toBe("ordinary");
    expect(result.actor.tier_basis).toBe("provider_hint");
    expect(result.actor.registry_entity_id).toBeUndefined();
  });

  it("allows empty registry startup without creating top-tier actors", () => {
    const result = applyEntityRegistry({ actor_type: "community", provider_tier_hint: "watch" }, []);

    expect(result.warnings[0]?.reason_code).toBe("registry_empty");
    expect(result.actor.effective_tier).toBe("ordinary");
    expect(result.actor.registry_tier).toBeUndefined();
  });
});
