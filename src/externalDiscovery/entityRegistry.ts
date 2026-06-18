import fs from "node:fs";

import { externalEntityRegistryPath } from "./paths.ts";
import type { RedactionCheckResult } from "./redaction.ts";
import {
  EXTERNAL_ACTOR_TYPES,
  EXTERNAL_REGISTRY_TIERS,
  type ExternalActorTier,
  type ExternalActorType,
  type ExternalRegistryTier,
  type ExternalSignalEvent,
} from "./types.ts";

export interface ExternalEntityRegistryEntry {
  entity_id: string;
  display_name: string;
  actor_type: Exclude<ExternalActorType, "community" | "unknown">;
  tier: ExternalRegistryTier;
  handles: string[];
  profile_urls: string[];
  updated_at: string;
}

export interface ExternalEntityRegistryLoadResult {
  entries: ExternalEntityRegistryEntry[];
  warnings: string[];
  rejected_entries: Array<{
    index: number;
    reason_code: string;
    reason_detail: string;
  }>;
}

export interface ExternalActorRegistryEnrichment {
  actor: ExternalSignalEvent["actor"];
  warnings: string[];
  matched_entry?: ExternalEntityRegistryEntry;
}

const REGISTRY_ACTOR_TYPES = ["institution", "team", "person"] as const;
const PRIVATE_REGISTRY_KEYS = new Set([
  "cookie",
  "cookies",
  "token",
  "tokens",
  "session",
  "sessions",
  "oauth",
  "password",
  "passwords",
  "private_diagnostics",
  "diagnostics",
  "raw_profile",
  "raw_profile_dump",
  "provider_raw_profile",
  "provider_raw_profile_dump",
]);
const SENSITIVE_TEXT_PATTERN = /\b(cookie|session|token|password|oauth)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRegistryActorType(value: unknown): value is ExternalEntityRegistryEntry["actor_type"] {
  return (
    typeof value === "string" &&
    REGISTRY_ACTOR_TYPES.includes(value as ExternalEntityRegistryEntry["actor_type"])
  );
}

function isRegistryTier(value: unknown): value is ExternalRegistryTier {
  return typeof value === "string" && EXTERNAL_REGISTRY_TIERS.includes(value as ExternalRegistryTier);
}

function normalizeName(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function normalizeHandle(value: string | undefined): string {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function normalizeUrl(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\/+$/, "") ?? "";
}

function collectForbiddenRegistryPaths(
  value: unknown,
  currentPath: string,
  paths: string[],
  seen: WeakSet<object>,
): void {
  if (typeof value === "string") {
    if (SENSITIVE_TEXT_PATTERN.test(value)) paths.push(currentPath);
    return;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return;
    seen.add(value);
    value.forEach((item, index) => {
      collectForbiddenRegistryPaths(item, `${currentPath}[${index}]`, paths, seen);
    });
    return;
  }

  if (!isRecord(value)) return;
  if (seen.has(value)) return;
  seen.add(value);

  for (const [key, child] of Object.entries(value)) {
    const childPath = currentPath ? `${currentPath}.${key}` : key;
    if (PRIVATE_REGISTRY_KEYS.has(key.toLowerCase())) {
      paths.push(childPath);
      continue;
    }
    collectForbiddenRegistryPaths(child, childPath, paths, seen);
  }
}

export function assertPublicSafeEntityRegistry(value: unknown): RedactionCheckResult {
  const errors: string[] = [];
  if (!Array.isArray(value)) return { ok: false, errors: ["registry must be an array"] };

  const forbiddenPaths: string[] = [];
  collectForbiddenRegistryPaths(value, "", forbiddenPaths, new WeakSet<object>());
  if (forbiddenPaths.length > 0) {
    errors.push(`forbidden registry field or text detected: ${forbiddenPaths.join(", ")}`);
  }

  value.forEach((entry, index) => {
    const validation = validateRegistryEntry(entry);
    if (!validation.entry) {
      errors.push(`registry[${index}] ${validation.errors.join("; ")}`);
    }
  });

  return { ok: errors.length === 0, errors };
}

function validateRegistryEntry(value: unknown): {
  entry?: ExternalEntityRegistryEntry;
  errors: string[];
} {
  const errors: string[] = [];
  if (!isRecord(value)) return { errors: ["entry must be an object"] };

  const entityId = value.entity_id;
  const displayName = value.display_name;
  const actorType = value.actor_type;
  const tier = value.tier;
  const handles = value.handles;
  const profileUrls = value.profile_urls;
  const updatedAt = value.updated_at;

  if (!isNonEmptyString(entityId)) errors.push("entity_id is required");
  if (!isNonEmptyString(displayName)) errors.push("display_name is required");
  if (!isRegistryActorType(actorType)) {
    errors.push(`actor_type must be one of ${REGISTRY_ACTOR_TYPES.join(", ")}`);
  }
  if (!isRegistryTier(tier)) errors.push("tier must be core/proven/watch");
  if (!isStringArray(handles)) errors.push("handles must be string[]");
  if (!isStringArray(profileUrls)) errors.push("profile_urls must be string[]");
  if (!isNonEmptyString(updatedAt)) errors.push("updated_at is required");

  if (errors.length > 0) return { errors };
  return {
    entry: {
      entity_id: entityId as string,
      display_name: displayName as string,
      actor_type: actorType as ExternalEntityRegistryEntry["actor_type"],
      tier: tier as ExternalRegistryTier,
      handles: handles as string[],
      profile_urls: profileUrls as string[],
      updated_at: updatedAt as string,
    },
    errors,
  };
}

export function loadExternalEntityRegistry(
  registryPath = externalEntityRegistryPath(),
): ExternalEntityRegistryLoadResult {
  if (!fs.existsSync(registryPath)) {
    return { entries: [], warnings: ["registry_empty"], rejected_entries: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  } catch {
    return {
      entries: [],
      warnings: ["registry_invalid"],
      rejected_entries: [
        {
          index: -1,
          reason_code: "registry_invalid",
          reason_detail: "registry JSON could not be read or parsed",
        },
      ],
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      entries: [],
      warnings: ["registry_invalid"],
      rejected_entries: [
        {
          index: -1,
          reason_code: "registry_invalid",
          reason_detail: "registry must be an array",
        },
      ],
    };
  }

  const publicSafe = assertPublicSafeEntityRegistry(parsed);
  if (!publicSafe.ok) {
    return {
      entries: [],
      warnings: ["registry_unsafe"],
      rejected_entries: [
        {
          index: -1,
          reason_code: "registry_unsafe",
          reason_detail: publicSafe.errors.join("; "),
        },
      ],
    };
  }

  const entries: ExternalEntityRegistryEntry[] = [];
  const rejectedEntries: ExternalEntityRegistryLoadResult["rejected_entries"] = [];
  parsed.forEach((entry, index) => {
    const validation = validateRegistryEntry(entry);
    if (validation.entry) {
      entries.push(validation.entry);
    } else {
      rejectedEntries.push({
        index,
        reason_code: "registry_entry_invalid",
        reason_detail: validation.errors.join("; "),
      });
    }
  });

  return {
    entries,
    warnings: entries.length === 0 ? ["registry_empty"] : [],
    rejected_entries: rejectedEntries,
  };
}

function matchesEntry(
  actor: ExternalSignalEvent["actor"],
  entry: ExternalEntityRegistryEntry,
): boolean {
  const actorName = normalizeName(actor.display_name);
  if (actorName && actorName === normalizeName(entry.display_name)) return true;

  const actorHandle = normalizeHandle(actor.handle);
  if (actorHandle && entry.handles.map(normalizeHandle).includes(actorHandle)) return true;

  const actorProfileUrl = normalizeUrl(actor.platform_profile_url);
  if (actorProfileUrl && entry.profile_urls.map(normalizeUrl).includes(actorProfileUrl)) return true;

  return false;
}

function missTier(actor: ExternalSignalEvent["actor"]): ExternalActorTier {
  return actor.actor_type === "unknown" && !actor.display_name ? "unknown" : "ordinary";
}

export function enrichExternalActorWithRegistry(
  actor: ExternalSignalEvent["actor"],
  entries: ExternalEntityRegistryEntry[],
): ExternalActorRegistryEnrichment {
  const matchedEntry = entries.find((entry) => matchesEntry(actor, entry));
  if (!matchedEntry) {
    return {
      actor: {
        ...actor,
        registry_entity_id: undefined,
        registry_tier: undefined,
        effective_tier: missTier(actor),
        tier_basis: "registry_miss",
      },
      warnings: ["registry_miss"],
    };
  }

  return {
    actor: {
      ...actor,
      display_name: actor.display_name ?? matchedEntry.display_name,
      actor_type: matchedEntry.actor_type,
      registry_entity_id: matchedEntry.entity_id,
      registry_tier: matchedEntry.tier,
      effective_tier: matchedEntry.tier,
      tier_basis: "registry",
    },
    warnings: [],
    matched_entry: matchedEntry,
  };
}

export function countTopTierActors(actors: ExternalSignalEvent["actor"][]): number {
  return actors.filter(
    (actor) =>
      actor.tier_basis === "registry" &&
      EXTERNAL_REGISTRY_TIERS.includes(actor.effective_tier as ExternalRegistryTier),
  ).length;
}

export function isExternalActorType(value: unknown): value is ExternalActorType {
  return typeof value === "string" && EXTERNAL_ACTOR_TYPES.includes(value as ExternalActorType);
}
