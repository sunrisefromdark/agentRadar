import fs from "node:fs";

import type {
  ExternalActorType,
  ExternalNamedActorSourceRole,
  ExternalPlatform,
  ExternalRawEventKind,
  ExternalRegistryTier,
  ExternalSignalActor,
  ExternalTierBasis,
} from "./types.ts";

export interface ExternalEntityRegistryEntry {
  entity_id: string;
  display_name: string;
  actor_type: "institution" | "team" | "person";
  tier: ExternalRegistryTier;
  aliases?: string[];
  handles: string[];
  profile_urls: string[];
  domains?: string[];
  github_owners?: string[];
  updated_at: string;
}

export type EntityRegistryWarningReason = "registry_empty" | "registry_miss" | "registry_invalid" | "named_actor_role_unresolved";

export interface EntityRegistryLookupContext {
  platform: ExternalPlatform;
  raw_event_kind: ExternalRawEventKind;
  url?: string;
  target_url?: string;
  target_repo_url?: string;
}

export interface EntityRegistryLookupResult {
  actor: ExternalSignalActor;
  warnings: Array<{
    reason_code: EntityRegistryWarningReason;
    reason_detail: string;
  }>;
}

export function readEntityRegistry(filepath: string): ExternalEntityRegistryEntry[] {
  return readEntityRegistryWithWarnings(filepath).entries;
}

export function readEntityRegistryWithWarnings(filepath: string): {
  entries: ExternalEntityRegistryEntry[];
  warnings: EntityRegistryLookupResult["warnings"];
} {
  if (!fs.existsSync(filepath)) return { entries: [], warnings: [] };
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(filepath, "utf-8")) as unknown;
  } catch {
    return {
      entries: [],
      warnings: [{ reason_code: "registry_invalid", reason_detail: "entity registry is not valid JSON" }],
    };
  }
  if (!Array.isArray(value)) {
    return {
      entries: [],
      warnings: [{ reason_code: "registry_invalid", reason_detail: "entity registry must be an array" }],
    };
  }

  const entries: ExternalEntityRegistryEntry[] = [];
  const warnings: EntityRegistryLookupResult["warnings"] = [];
  for (const entry of value) {
    if (isRegistryEntry(entry)) {
      entries.push(entry);
    } else {
      warnings.push({ reason_code: "registry_invalid", reason_detail: "entity registry entry is invalid or unsafe" });
    }
  }
  return { entries, warnings };
}

export function applyEntityRegistry(
  actor: {
    actor_type?: ExternalActorType;
    provider_actor_id?: string;
    identity_hash?: string;
    display_name?: string;
    handle?: string;
    platform_profile_url?: string;
    provider_tier_hint?: ExternalSignalActor["provider_tier_hint"];
    registry_entity_id?: string;
  },
  registry: ExternalEntityRegistryEntry[],
  context?: EntityRegistryLookupContext,
): EntityRegistryLookupResult {
  if (registry.length === 0) {
    return {
      actor: anonymousActor(actor, "none"),
      warnings: [{ reason_code: "registry_empty", reason_detail: "entity registry is empty or missing" }],
    };
  }

  const match = findRegistryMatch(actor, registry, context);
  if (!match) {
    return {
      actor: anonymousActor(actor, actor.provider_tier_hint ? "provider_hint" : "none"),
      warnings: [{ reason_code: "registry_miss", reason_detail: "actor did not match entity registry" }],
    };
  }

  if (match.roles.length === 0) {
    return {
      actor: anonymousActor(actor, actor.provider_tier_hint ? "provider_hint" : "none"),
      warnings: [{ reason_code: "named_actor_role_unresolved", reason_detail: "registry actor matched but source role could not be resolved" }],
    };
  }

  return {
    actor: {
      actor_type: match.entry.actor_type,
      effective_tier: match.entry.tier,
      tier_basis: "registry",
      provider_actor_id: actor.provider_actor_id,
      identity_hash: actor.identity_hash,
      display_name: actor.display_name,
      handle: actor.handle,
      platform_profile_url: actor.platform_profile_url,
      provider_tier_hint: actor.provider_tier_hint,
      registry_entity_id: match.entry.entity_id,
      registry_display_name: match.entry.display_name,
      registry_tier: match.entry.tier,
      source_roles: match.roles,
    },
    warnings: [],
  };
}

interface RegistryMatch {
  entry: ExternalEntityRegistryEntry;
  roles: ExternalNamedActorSourceRole[];
}

function findRegistryMatch(
  actor: {
    provider_actor_id?: string;
    handle?: string;
    platform_profile_url?: string;
    registry_entity_id?: string;
  },
  registry: ExternalEntityRegistryEntry[],
  context?: EntityRegistryLookupContext,
): RegistryMatch | undefined {
  const matches: Array<{ entry: ExternalEntityRegistryEntry; roles: ExternalNamedActorSourceRole[] }> = [];

  if (actor.registry_entity_id) {
    const byEntityId = registry.find((entry) => entry.entity_id === actor.registry_entity_id);
    if (byEntityId) matches.push({ entry: byEntityId, roles: rolesForRegistryEntityContext(byEntityId, context) });
  }

  const handleInput = actor.handle ?? handleLikeProviderActorId(actor.provider_actor_id);
  const profileInput = actor.platform_profile_url ?? profileLikeProviderActorId(actor.provider_actor_id);

  if (handleInput) {
    const providerHandle = normalizeHandle(handleInput);
    const byHandle = registry.find((entry) => entry.handles.map(normalizeHandle).includes(providerHandle));
    if (byHandle) matches.push({ entry: byHandle, roles: socialRolesForContext(context) });
  }

  if (profileInput) {
    const providerUrl = normalizeUrl(profileInput);
    const byProfile = registry.find((entry) => entry.profile_urls.map(normalizeUrl).includes(providerUrl));
    if (byProfile) matches.push({ entry: byProfile, roles: socialRolesForContext(context) });
  }

  for (const entry of registry) {
    const officialRoles = officialRolesForContext(entry, context);
    if (officialRoles.length > 0) matches.push({ entry, roles: officialRoles });
  }

  const byEntity = new Map<string, RegistryMatch>();
  for (const match of matches) {
    const existing = byEntity.get(match.entry.entity_id);
    const roles = uniqueRoles([...(existing?.roles ?? []), ...match.roles]);
    byEntity.set(match.entry.entity_id, { entry: match.entry, roles });
  }

  return byEntity.values().next().value as RegistryMatch | undefined;
}

function rolesForRegistryEntityContext(entry: ExternalEntityRegistryEntry, context?: EntityRegistryLookupContext): ExternalNamedActorSourceRole[] {
  const registryEntityOfficialRole =
    context && (context.platform === "official_web" || context.platform === "official_blog" || context.raw_event_kind === "official_release" || context.raw_event_kind === "blog_post")
      ? (["official_publisher"] as ExternalNamedActorSourceRole[])
      : [];
  return uniqueRoles([...socialRolesForContext(context), ...officialRolesForContext(entry, context), ...registryEntityOfficialRole]);
}

function socialRolesForContext(context?: EntityRegistryLookupContext): ExternalNamedActorSourceRole[] {
  if (!context) return [];
  const socialPlatform = context.platform === "x_twitter" || context.platform === "reddit" || context.platform === "hacker_news";
  const socialKind =
    context.raw_event_kind === "mention" ||
    context.raw_event_kind === "discussion" ||
    context.raw_event_kind === "question" ||
    context.raw_event_kind === "showcase";
  return socialPlatform && socialKind ? ["social_discussant"] : [];
}

function officialRolesForContext(entry: ExternalEntityRegistryEntry, context?: EntityRegistryLookupContext): ExternalNamedActorSourceRole[] {
  if (!context) return [];
  const roles: ExternalNamedActorSourceRole[] = [];
  const officialPlatform = context.platform === "official_web" || context.platform === "official_blog";
  const officialKind = context.raw_event_kind === "official_release" || context.raw_event_kind === "blog_post";
  const sourceDomain = context.url ? normalizeDomain(context.url) : undefined;

  if ((officialPlatform || officialKind) && sourceDomain && (entry.domains ?? []).map(normalizeDomainValue).includes(sourceDomain)) {
    roles.push("official_publisher");
  }

  const githubOwners = [context.url, context.target_url, context.target_repo_url]
    .map(githubOwnerFromUrl)
    .filter((owner): owner is string => Boolean(owner));
  if (githubOwners.some((owner) => (entry.github_owners ?? []).map(normalizeGithubOwner).includes(owner))) {
    roles.push("official_owner");
  }

  return uniqueRoles(roles);
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

function normalizeDomain(value: string): string | undefined {
  try {
    const url = new URL(value.trim().toLowerCase());
    return normalizeDomainValue(url.hostname);
  } catch {
    return undefined;
  }
}

function normalizeDomainValue(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, "");
}

function githubOwnerFromUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim().toLowerCase());
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return undefined;
    return normalizeGithubOwner(url.pathname.split("/").filter(Boolean)[0] ?? "");
  } catch {
    return undefined;
  }
}

function normalizeGithubOwner(value: string): string {
  return value.trim().toLowerCase();
}

function handleLikeProviderActorId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith("@")) return trimmed;
  return undefined;
}

function profileLikeProviderActorId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}

function uniqueRoles(values: ExternalNamedActorSourceRole[]): ExternalNamedActorSourceRole[] {
  const order: ExternalNamedActorSourceRole[] = ["social_discussant", "official_publisher", "official_owner"];
  return order.filter((role) => values.includes(role));
}

function anonymousActor(
  actor: {
    actor_type?: ExternalActorType;
    provider_actor_id?: string;
    identity_hash?: string;
    display_name?: string;
    handle?: string;
    platform_profile_url?: string;
    provider_tier_hint?: ExternalSignalActor["provider_tier_hint"];
  },
  tierBasis: ExternalTierBasis,
): ExternalSignalActor {
  return {
    actor_type: actor.actor_type ?? "unknown",
    effective_tier: actor.actor_type === "unknown" || !actor.actor_type ? "unknown" : "ordinary",
    tier_basis: tierBasis,
    provider_actor_id: actor.provider_actor_id,
    identity_hash: actor.identity_hash,
    display_name: actor.display_name,
    handle: actor.handle,
    platform_profile_url: actor.platform_profile_url,
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
    (entry.aliases === undefined || isStringArray(entry.aliases)) &&
    Array.isArray(entry.handles) &&
    Array.isArray(entry.profile_urls) &&
    (entry.domains === undefined || isStringArray(entry.domains)) &&
    (entry.github_owners === undefined || isStringArray(entry.github_owners)) &&
    !containsUnsafeRegistryFields(entry) &&
    typeof entry.updated_at === "string"
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function containsUnsafeRegistryFields(entry: Partial<ExternalEntityRegistryEntry> & Record<string, unknown>): boolean {
  const serialized = JSON.stringify(entry).toLowerCase();
  return /\b(cookie|session|token|password|oauth|private_diagnostics|provider_diagnostics)\b/.test(serialized);
}
