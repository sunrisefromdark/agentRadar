import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import {
  assertPublicSafeEntityRegistry,
  countTopTierActors,
  enrichExternalActorWithRegistry,
  loadExternalEntityRegistry,
  type ExternalEntityRegistryEntry,
} from "../externalDiscovery/entityRegistry.ts";
import type { ExternalSignalEvent } from "../externalDiscovery/types.ts";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "external-registry-"));
  tempDirs.push(dir);
  return dir;
}

function registryPath(): string {
  return path.join(makeTempDir(), "entity-registry.json");
}

function writeRegistry(entries: unknown): string {
  const filePath = registryPath();
  fs.writeFileSync(filePath, `${JSON.stringify(entries, null, 2)}\n`, "utf-8");
  return filePath;
}

function entry(overrides: Partial<ExternalEntityRegistryEntry> = {}): ExternalEntityRegistryEntry {
  return {
    entity_id: "entity:openai",
    display_name: "OpenAI",
    actor_type: "institution",
    tier: "core",
    handles: ["@openai"],
    profile_urls: ["https://x.com/openai"],
    updated_at: "2026-06-14T00:00:00.000Z",
    ...overrides,
  };
}

function baseActor(): ExternalSignalEvent["actor"] {
  return {
    display_name: "Unknown Lab",
    actor_type: "unknown",
    provider_tier_hint: "core",
    effective_tier: "unknown",
    tier_basis: "unknown",
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("external entity registry", () => {
  it("allows missing registry files and records registry_empty", () => {
    const result = loadExternalEntityRegistry(path.join(makeTempDir(), "missing.json"));

    expect(result.entries).toEqual([]);
    expect(result.warnings).toContain("registry_empty");
  });

  it("allows an empty registry and keeps top-tier actor count at zero", () => {
    const result = loadExternalEntityRegistry(writeRegistry([]));
    const enriched = enrichExternalActorWithRegistry(baseActor(), result.entries);

    expect(result.entries).toEqual([]);
    expect(result.warnings).toContain("registry_empty");
    expect(enriched.actor.effective_tier).not.toMatch(/^(core|proven|watch)$/);
    expect(countTopTierActors([enriched.actor])).toBe(0);
  });

  it("records registry_miss and never promotes provider tier hints", () => {
    const result = loadExternalEntityRegistry(writeRegistry([entry()]));
    const enriched = enrichExternalActorWithRegistry(baseActor(), result.entries);

    expect(enriched.warnings).toContain("registry_miss");
    expect(enriched.actor.provider_tier_hint).toBe("core");
    expect(enriched.actor.effective_tier).not.toMatch(/^(core|proven|watch)$/);
    expect(enriched.actor.tier_basis).toBe("registry_miss");
    expect(countTopTierActors([enriched.actor])).toBe(0);
  });

  it("uses registry matches as the only source of core/proven/watch effective tiers", () => {
    const result = loadExternalEntityRegistry(writeRegistry([entry()]));
    const enriched = enrichExternalActorWithRegistry(
      {
        ...baseActor(),
        display_name: "OpenAI",
      },
      result.entries,
    );

    expect(enriched.warnings).toEqual([]);
    expect(enriched.actor.registry_entity_id).toBe("entity:openai");
    expect(enriched.actor.registry_tier).toBe("core");
    expect(enriched.actor.effective_tier).toBe("core");
    expect(enriched.actor.tier_basis).toBe("registry");
    expect(enriched.actor.actor_type).toBe("institution");
    expect(enriched.actor).not.toHaveProperty("handle");
    expect(enriched.actor).not.toHaveProperty("platform_profile_url");
    expect(countTopTierActors([enriched.actor])).toBe(1);
  });

  it("rejects private or raw-profile fields in public registry artifacts", () => {
    const result = assertPublicSafeEntityRegistry([
      {
        ...entry(),
        private_diagnostics: { token: "secret" },
        provider_raw_profile_dump: { profile_url: "https://x.com/private" },
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/private_diagnostics|provider_raw_profile_dump|token/i);
  });

  it("does not load unsafe registry entries with private fields", () => {
    const result = loadExternalEntityRegistry(
      writeRegistry([
        {
          ...entry(),
          private_diagnostics: { token: "secret" },
        },
      ]),
    );

    expect(result.entries).toEqual([]);
    expect(result.warnings).toContain("registry_unsafe");
    expect(result.rejected_entries[0]?.reason_code).toBe("registry_unsafe");
  });
});
