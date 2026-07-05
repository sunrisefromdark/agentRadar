import type {
  ExternalActorType,
  ExternalPlatform,
  ExternalPublicActor,
  ExternalPublicActorAudit,
  ExternalPublicActorIdentityReason,
  ExternalPublicActorIdentityStatus,
  ExternalPublicActorRole,
  ExternalPublicActorSourceBasis,
  ExternalPublicActorSourceKind,
  ExternalPublicActorTierBasis,
  ExternalSignalEvent,
} from "./types.ts";

export interface PublicActorsForEvidence {
  public_actors: ExternalPublicActor[];
  public_actor_audit: ExternalPublicActorAudit[];
}

interface PublicActorCandidate {
  public_actor_id: string;
  display_name: string;
  actor_type: ExternalActorType;
  actor_role: ExternalPublicActorRole;
  authority_tier?: ExternalPublicActor["authority_tier"];
  tier_basis: ExternalPublicActorTierBasis;
  is_head_actor: boolean;
  source_kind: ExternalPublicActorSourceKind;
  source_basis: ExternalPublicActorSourceBasis;
}

interface UrlCandidate {
  url: URL;
  source_basis: ExternalPublicActorSourceBasis;
  source_field: "source" | "target";
}

const registryTierRank: Record<NonNullable<ExternalPublicActor["authority_tier"]>, number> = {
  core: 0,
  proven: 1,
  watch: 2,
  ordinary: 3,
  unknown: 4,
};

const discussionRoles = new Set<ExternalPublicActorRole>([
  "discussion_actor",
  "community_source",
  "registry_entity",
]);

const xReservedPathParts = new Set(["i", "intent", "share", "login", "redirect"]);
const githubReservedOwners = new Set(["features", "marketplace", "topics", "trending", "explore", "login"]);

export function buildPublicActorsForEvidence(events: ExternalSignalEvent[]): PublicActorsForEvidence {
  return {
    public_actors: mergePublicActors(events.flatMap((event) => extractPublicActorsFromEvent(event))),
    public_actor_audit: buildPublicActorAudit(events),
  };
}

export function extractPublicActorsFromEvent(event: ExternalSignalEvent): ExternalPublicActor[] {
  const candidates: PublicActorCandidate[] = [
    ...registryActorCandidates(event),
    ...explicitActorCandidates(event),
    ...urlActorCandidates(event),
  ];
  const seen = new Set<string>();
  const actors: ExternalPublicActor[] = [];

  for (const candidate of candidates) {
    const key = publicActorKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    actors.push(toPublicActor(candidate, event));
  }

  return actors;
}

export function buildPublicActorAudit(events: ExternalSignalEvent[]): ExternalPublicActorAudit[] {
  const byKey = new Map<string, ExternalPublicActorAudit>();
  for (const event of events) {
    const identity = publicActorIdentityForEvent(event);
    const key = `${event.platform}:${identity.status}:${identity.reason}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.event_count += 1;
    } else {
      byKey.set(key, {
        platform: event.platform,
        status: identity.status,
        reason: identity.reason,
        event_count: 1,
      });
    }
  }

  return [...byKey.values()].sort(
    (a, b) =>
      a.platform.localeCompare(b.platform) ||
      a.status.localeCompare(b.status) ||
      a.reason.localeCompare(b.reason),
  );
}

export function publicActorIdentityForEvent(event: ExternalSignalEvent): {
  status: ExternalPublicActorIdentityStatus;
  reason: ExternalPublicActorIdentityReason;
} {
  if (event.actor_public_identity_status && event.actor_public_identity_reason) {
    return {
      status: event.actor_public_identity_status,
      reason: event.actor_public_identity_reason,
    };
  }

  if (extractPublicActorsFromEvent(event).length > 0) {
    return { status: "available", reason: "actor_public_identity_available" };
  }

  if (hasXReservedOrIndirectUrl(event)) {
    return { status: "invalid_reserved_path", reason: "x_reserved_or_indirect_url" };
  }

  if ((event.platform === "official_web" || event.platform === "official_blog") && !hasAnySourceUrl(event)) {
    return { status: "missing", reason: "official_source_url_missing" };
  }

  if (hasRegistryHint(event)) {
    return { status: "missing", reason: "registry_entity_not_matched" };
  }

  return { status: "missing", reason: "actor_public_identity_missing" };
}

function mergePublicActors(actors: ExternalPublicActor[]): ExternalPublicActor[] {
  const byKey = new Map<string, ExternalPublicActor>();

  for (const actor of actors) {
    const key = publicActorKey(actor);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...actor, platforms: [...actor.platforms].sort() as ExternalPlatform[] });
      continue;
    }

    existing.event_count += actor.event_count;
    existing.platforms = unique([...existing.platforms, ...actor.platforms]).sort() as ExternalPlatform[];
    existing.first_seen_at = earliestIso(existing.first_seen_at, actor.first_seen_at);
    existing.last_seen_at = latestIso(existing.last_seen_at, actor.last_seen_at);
  }

  return [...byKey.values()].sort(publicActorSort);
}

function registryActorCandidates(event: ExternalSignalEvent): PublicActorCandidate[] {
  const actor = event.actor;
  const isRegistryActor =
    actor.tier_basis === "registry" &&
    actor.registry_entity_id &&
    actor.registry_display_name &&
    actor.registry_tier &&
    (actor.actor_type === "institution" || actor.actor_type === "team" || actor.actor_type === "person");
  if (!isRegistryActor) return [];
  if (!actor.source_roles?.includes("social_discussant")) return [];
  const registryEntityId = actor.registry_entity_id;
  const registryDisplayName = actor.registry_display_name;
  const registryTier = actor.registry_tier;
  if (!registryEntityId || !registryDisplayName || !registryTier) return [];

  return [
    {
      public_actor_id: `registry:${registryEntityId}`,
      display_name: registryDisplayName,
      actor_type: actor.actor_type,
      actor_role: "registry_entity",
      authority_tier: registryTier,
      tier_basis: "registry_match",
      is_head_actor: true,
      source_kind: "registry_entity",
      source_basis: "registry_match",
    },
  ];
}

function explicitActorCandidates(event: ExternalSignalEvent): PublicActorCandidate[] {
  const actor = event.actor;
  const candidates: PublicActorCandidate[] = [];

  if (event.platform === "x_twitter") {
    const handle = firstSafePublicToken([
      actor.handle,
      actor.author,
      actor.username,
      actor.user,
      handleLikeProviderActorId(actor.provider_actor_id),
      xHandleFromProfileUrl(actor.platform_profile_url),
    ]);
    if (handle) {
      candidates.push(actorCandidateFromToken(event, {
        public_actor_id: `x:${handle.toLowerCase()}`,
        display_name: `@${handle}`,
        actor_type: actor.actor_type === "unknown" ? "person" : actor.actor_type,
        actor_role: "discussion_actor",
        source_kind: "x_handle",
        source_basis: "explicit_actor_field",
      }));
    }
  }

  if (event.platform === "reddit") {
    const subreddit = firstSafePublicToken([actor.subreddit, actor.community]);
    if (subreddit) {
      candidates.push(actorCandidateFromToken(event, {
        public_actor_id: `reddit:r:${subreddit.toLowerCase()}`,
        display_name: `r/${subreddit}`,
        actor_type: "community",
        actor_role: "community_source",
        source_kind: "reddit_community",
        source_basis: "explicit_actor_field",
      }));
    }

    const user = firstSafePublicToken([
      actor.author,
      actor.username,
      actor.user,
      actor.handle,
      handleLikeProviderActorId(actor.provider_actor_id),
    ]);
    if (user) {
      candidates.push(actorCandidateFromToken(event, {
        public_actor_id: `reddit:u:${user.toLowerCase()}`,
        display_name: `u/${user}`,
        actor_type: "person",
        actor_role: "discussion_actor",
        source_kind: "reddit_user",
        source_basis: "explicit_actor_field",
      }));
    }
  }

  if (event.platform === "hacker_news") {
    const user = firstSafePublicToken([
      actor.hn_user,
      actor.author,
      actor.username,
      actor.user,
      actor.handle,
      handleLikeProviderActorId(actor.provider_actor_id),
    ]);
    if (user) {
      candidates.push(actorCandidateFromToken(event, {
        public_actor_id: `hn:${user.toLowerCase()}`,
        display_name: `HN ${user}`,
        actor_type: "person",
        actor_role: "discussion_actor",
        source_kind: "hn_user",
        source_basis: "explicit_actor_field",
      }));
    }
  }

  const providerDisplayName = safePublicDisplayName(actor.display_name);
  if (providerDisplayName && candidates.length === 0 && isSocialPlatform(event.platform)) {
    candidates.push(actorCandidateFromToken(event, {
      public_actor_id: `provider:${event.platform}:${providerDisplayName.toLowerCase()}`,
      display_name: providerDisplayName,
      actor_type: actor.actor_type === "unknown" ? "person" : actor.actor_type,
      actor_role: "discussion_actor",
      source_kind: "provider_actor",
      source_basis: "explicit_actor_field",
    }));
  }

  return candidates;
}

function urlActorCandidates(event: ExternalSignalEvent): PublicActorCandidate[] {
  const candidates: PublicActorCandidate[] = [];
  const urls = urlCandidates(event);

  for (const candidate of urls) {
    const hostname = candidate.url.hostname.toLowerCase().replace(/^www\./, "");
    const parts = candidate.url.pathname.split("/").map((part) => part.trim()).filter(Boolean);

    if (event.platform === "x_twitter" && (hostname === "x.com" || hostname === "twitter.com")) {
      if (candidate.source_field !== "source") continue;
      const handle = safePublicToken(parts[0]);
      if (handle && !isXReservedPart(handle)) {
        candidates.push(actorCandidateFromToken(event, {
          public_actor_id: `x:${handle.toLowerCase()}`,
          display_name: `@${handle}`,
          actor_type: event.actor.actor_type === "unknown" ? "person" : event.actor.actor_type,
          actor_role: "discussion_actor",
          source_kind: "x_handle",
          source_basis: "source_url_path",
        }));
      }
      continue;
    }

    if (event.platform === "reddit" && (hostname === "reddit.com" || hostname.endsWith(".reddit.com"))) {
      if (candidate.source_field !== "source") continue;
      const [kind, value] = parts;
      if (kind?.toLowerCase() === "r") {
        const subreddit = safePublicToken(value);
        if (subreddit) {
          candidates.push(actorCandidateFromToken(event, {
            public_actor_id: `reddit:r:${subreddit.toLowerCase()}`,
            display_name: `r/${subreddit}`,
            actor_type: "community",
            actor_role: "community_source",
            source_kind: "reddit_community",
            source_basis: "source_url_path",
          }));
        }
      }
      if (kind?.toLowerCase() === "user" || kind?.toLowerCase() === "u") {
        const user = safePublicToken(value);
        if (user) {
          candidates.push(actorCandidateFromToken(event, {
            public_actor_id: `reddit:u:${user.toLowerCase()}`,
            display_name: `u/${user}`,
            actor_type: "person",
            actor_role: "discussion_actor",
            source_kind: "reddit_user",
            source_basis: "source_url_path",
          }));
        }
      }
      continue;
    }

    if (event.platform === "hacker_news" && hostname === "news.ycombinator.com" && parts[0] === "user") {
      if (candidate.source_field !== "source") continue;
      const user = safePublicToken(candidate.url.searchParams.get("id") ?? undefined);
      if (user) {
        candidates.push(actorCandidateFromToken(event, {
          public_actor_id: `hn:${user.toLowerCase()}`,
          display_name: `HN ${user}`,
          actor_type: "person",
          actor_role: "discussion_actor",
          source_kind: "hn_user",
          source_basis: "source_url_path",
        }));
      }
      continue;
    }

    if (hostname === "github.com") {
      const owner = safePublicToken(parts[0]);
      if (owner && !githubReservedOwners.has(owner.toLowerCase())) {
        candidates.push(actorCandidateFromToken(event, {
          public_actor_id: `github:${owner.toLowerCase()}`,
          display_name: `GitHub ${owner}`,
          actor_type: event.actor.actor_type === "person" ? "person" : "team",
          actor_role: "project_owner",
          source_kind: "github_owner",
          source_basis: candidate.source_basis,
        }));
      }
      continue;
    }

    if ((event.platform === "official_web" || event.platform === "official_blog") && candidate.source_field === "source") {
      candidates.push(actorCandidateFromToken(event, {
        public_actor_id: `domain:${hostname}`,
        display_name: hostname,
        actor_type: event.actor.actor_type === "institution" || event.actor.actor_type === "team" ? event.actor.actor_type : "team",
        actor_role: "official_publisher",
        source_kind: "official_domain",
        source_basis: "official_source_url",
      }));
    }
  }

  return candidates;
}

function actorCandidateFromToken(
  event: ExternalSignalEvent,
  input: Omit<PublicActorCandidate, "authority_tier" | "tier_basis" | "is_head_actor">,
): PublicActorCandidate {
  const tierBasis = event.actor.provider_tier_hint ? "provider_hint" : "none";
  return {
    ...input,
    authority_tier: event.actor.provider_tier_hint,
    tier_basis: tierBasis,
    is_head_actor: false,
  };
}

function toPublicActor(candidate: PublicActorCandidate, event: ExternalSignalEvent): ExternalPublicActor {
  return {
    public_actor_id: candidate.public_actor_id,
    display_name: candidate.display_name,
    actor_type: candidate.actor_type,
    actor_role: candidate.actor_role,
    authority_tier: candidate.authority_tier,
    tier_basis: candidate.tier_basis,
    is_head_actor: candidate.is_head_actor,
    source_kind: candidate.source_kind,
    source_basis: candidate.source_basis,
    event_count: 1,
    platforms: [event.platform],
    first_seen_at: event.observed_at,
    last_seen_at: event.observed_at,
  };
}

function urlCandidates(event: ExternalSignalEvent): UrlCandidate[] {
  const values: Array<{ value?: string; source_basis: ExternalPublicActorSourceBasis; source_field: UrlCandidate["source_field"] }> = [
    { value: event.url, source_basis: "source_url_path", source_field: "source" },
    { value: event.source_url, source_basis: "source_url_path", source_field: "source" },
    { value: event.permalink, source_basis: "source_url_path", source_field: "source" },
    { value: event.discussion_url, source_basis: "source_url_path", source_field: "source" },
    { value: event.target_url, source_basis: "target_official_url", source_field: "target" },
    { value: event.target_repo_url, source_basis: "target_official_url", source_field: "target" },
  ];
  const seen = new Set<string>();
  const result: UrlCandidate[] = [];

  for (const item of values) {
    const url = parseHttpUrl(item.value);
    if (!url) continue;
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ url, source_basis: item.source_basis, source_field: item.source_field });
  }

  return result;
}

function hasXReservedOrIndirectUrl(event: ExternalSignalEvent): boolean {
  return urlCandidates(event).some((candidate) => {
    const hostname = candidate.url.hostname.toLowerCase().replace(/^www\./, "");
    if (hostname !== "x.com" && hostname !== "twitter.com") return false;
    const parts = candidate.url.pathname.split("/").map((part) => part.trim()).filter(Boolean);
    return parts.some(isXReservedPart);
  });
}

function hasAnySourceUrl(event: ExternalSignalEvent): boolean {
  return Boolean(event.url || event.source_url || event.permalink || event.discussion_url);
}

function hasRegistryHint(event: ExternalSignalEvent): boolean {
  return Boolean(
    event.actor.registry_entity_id ||
      event.actor.registry_display_name ||
      event.actor.provider_tier_hint ||
      event.actor.display_name,
  );
}

function parseHttpUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function xHandleFromProfileUrl(value: string | undefined): string | undefined {
  const url = parseHttpUrl(value);
  if (!url) return undefined;
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname !== "x.com" && hostname !== "twitter.com") return undefined;
  const handle = url.pathname.split("/").filter(Boolean)[0];
  return isXReservedPart(handle) ? undefined : handle;
}

function handleLikeProviderActorId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith("@")) return trimmed;
  if (/^u\//i.test(trimmed)) return trimmed;
  return undefined;
}

function firstSafePublicToken(values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const token = safePublicToken(value);
    if (token) return token;
  }
  return undefined;
}

function safePublicToken(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/^@/, "").replace(/^u\//i, "").replace(/^r\//i, "");
  return normalized && /^[a-zA-Z0-9_.-]{1,80}$/.test(normalized) ? normalized : undefined;
}

function safePublicDisplayName(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 80) return undefined;
  if (/https?:\/\//i.test(normalized)) return undefined;
  if (/[\u0000-\u001F\u007F]/.test(normalized)) return undefined;
  if (/\b(cookie|session|oauth|bearer|token|api[_ -]?key|password)\b/i.test(normalized)) return undefined;
  return normalized;
}

function isXReservedPart(value: string | undefined): boolean {
  return Boolean(value && xReservedPathParts.has(value.toLowerCase()));
}

function isSocialPlatform(platform: ExternalPlatform): boolean {
  return platform === "x_twitter" || platform === "reddit" || platform === "hacker_news";
}

function publicActorKey(actor: Pick<ExternalPublicActor, "public_actor_id" | "actor_role" | "source_kind">): string {
  return `${actor.public_actor_id}:${actor.actor_role}:${actor.source_kind}`;
}

function publicActorSort(a: ExternalPublicActor, b: ExternalPublicActor): number {
  const aRegistry = a.source_kind === "registry_entity" ? 0 : 1;
  const bRegistry = b.source_kind === "registry_entity" ? 0 : 1;
  return (
    aRegistry - bRegistry ||
    Number(b.is_head_actor) - Number(a.is_head_actor) ||
    registryTierRank[a.authority_tier ?? "unknown"] - registryTierRank[b.authority_tier ?? "unknown"] ||
    b.event_count - a.event_count ||
    a.display_name.localeCompare(b.display_name)
  );
}

function earliestIso(a: string, b: string): string {
  return a <= b ? a : b;
}

function latestIso(a: string, b: string): string {
  return a >= b ? a : b;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function actorRoleCanEnterDiscussion(actor: Pick<ExternalPublicActor, "actor_role">): boolean {
  return discussionRoles.has(actor.actor_role);
}
