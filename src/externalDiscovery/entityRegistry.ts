import fs from "node:fs";

import type {
  ExternalActorType,
  ExternalRegistryTier,
  ExternalSignalActor,
  ExternalTierBasis,
} from "./types.ts";

export interface ExternalEntityRegistryEntry {
  entity_id: string;
  display_name: string;
  actor_type: "institution" | "team" | "person";
  tier: ExternalRegistryTier;
  handles: string[];
  profile_urls: string[];
  updated_at: string;
}

export interface EntityRegistryLookupResult {
  actor: ExternalSignalActor;
  warnings: Array<{
    reason_code: "registry_empty" | "registry_miss";
    reason_detail: string;
  }>;
}

export function readEntityRegistry(filepath: string): ExternalEntityRegistryEntry[] {
  if (!fs.existsSync(filepath)) return [];
  const value = JSON.parse(fs.readFileSync(filepath, "utf-8")) as unknown;
  if (!Array.isArray(value)) return [];
  return value.filter(isRegistryEntry);
}

export function applyEntityRegistry(
  actor: {
    actor_type?: ExternalActorType;
    provider_actor_id?: string;
    provider_tier_hint?: ExternalSignalActor["provider_tier_hint"];
    registry_entity_id?: string;
  },
  registry: ExternalEntityRegistryEntry[],
): EntityRegistryLookupResult {
  if (registry.length === 0) {
    return {
      actor: anonymousActor(actor, "none"),
      warnings: [{ reason_code: "registry_empty", reason_detail: "entity registry is empty or missing" }],
    };
  }

  const matched = findRegistryMatch(actor, registry);
  if (!matched) {
    return {
      actor: anonymousActor(actor, actor.provider_tier_hint ? "provider_hint" : "none"),
      warnings: [{ reason_code: "registry_miss", reason_detail: "actor did not match entity registry" }],
    };
  }

  return {
    actor: {
      actor_type: matched.actor_type,
      effective_tier: matched.tier,
      tier_basis: "registry",
      provider_actor_id: actor.provider_actor_id,
      provider_tier_hint: actor.provider_tier_hint,
      registry_entity_id: matched.entity_id,
      registry_display_name: matched.display_name,
      registry_tier: matched.tier,
    },
    warnings: [],
  };
}

function findRegistryMatch(
  actor: {
    provider_actor_id?: string;
    registry_entity_id?: string;
  },
  registry: ExternalEntityRegistryEntry[],
): ExternalEntityRegistryEntry | undefined {
  if (actor.registry_entity_id) {
    const byEntityId = registry.find((entry) => entry.entity_id === actor.registry_entity_id);
    if (byEntityId) return byEntityId;
  }

  if (!actor.provider_actor_id) return undefined;
  const providerActorId = actor.provider_actor_id.trim();
  if (providerActorId.length === 0) return undefined;

  const providerHandle = normalizeHandle(providerActorId);
  const providerUrl = normalizeUrl(providerActorId);
  return registry.find((entry) => {
    if (providerActorId === entry.entity_id) return true;
    if (entry.handles.map(normalizeHandle).includes(providerHandle)) return true;
    if (entry.profile_urls.map(normalizeUrl).includes(providerUrl)) return true;
    return false;
  });
}

function normalizeHandle(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      return url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "") ?? "";
    } catch {
      return trimmed.replace(/^@/, "");
    }
  }
  return trimmed.replace(/^@/, "");
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value.trim().toLowerCase());
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().toLowerCase().replace(/\/$/, "");
  }
}

function anonymousActor(
  actor: {
    actor_type?: ExternalActorType;
    provider_actor_id?: string;
    provider_tier_hint?: ExternalSignalActor["provider_tier_hint"];
  },
  tierBasis: ExternalTierBasis,
): ExternalSignalActor {
  return {
    actor_type: actor.actor_type ?? "unknown",
    effective_tier: actor.actor_type === "unknown" || !actor.actor_type ? "unknown" : "ordinary",
    tier_basis: tierBasis,
    provider_actor_id: actor.provider_actor_id,
    provider_tier_hint: actor.provider_tier_hint,
  };
}

function isRegistryEntry(value: unknown): value is ExternalEntityRegistryEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const entry = value as Partial<ExternalEntityRegistryEntry>;
  return (
    typeof entry.entity_id === "string" &&
    typeof entry.display_name === "string" &&
    (entry.actor_type === "institution" || entry.actor_type === "team" || entry.actor_type === "person") &&
    (entry.tier === "core" || entry.tier === "proven" || entry.tier === "watch") &&
    Array.isArray(entry.handles) &&
    Array.isArray(entry.profile_urls) &&
    typeof entry.updated_at === "string"
  );
}
