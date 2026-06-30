import fs from "node:fs";

import { applyEntityRegistry, readEntityRegistry, type ExternalEntityRegistryEntry } from "./entityRegistry.ts";
import { externalEntityRegistryPath } from "./paths.ts";
import { stableSourceInputHash } from "./redaction.ts";
import type {
  AgentReachProviderReadResult,
  ExternalPlatform,
  ExternalProviderStatus,
  ExternalRawEventKind,
  ExternalSignalEvent,
  ExternalSignalKind,
  ExternalTargetType,
} from "./types.ts";

interface ReadOptions {
  explicitInput?: boolean;
  entityRegistry?: ExternalEntityRegistryEntry[];
  entityRegistryPath?: string;
}

interface ValidProviderArtifact extends Record<string, unknown> {
  provider_run_id: string;
  generated_at: string;
  query: string | Record<string, unknown>;
  platforms: ExternalPlatform[];
  status: ExternalProviderStatus;
  items: unknown[];
  status_reason?: unknown;
}

export function readAgentReachProviderArtifact(filepath: string, options: ReadOptions = {}): AgentReachProviderReadResult {
  if (!fs.existsSync(filepath)) {
    return emptyResult(options.explicitInput ? "failed" : "skipped", options.explicitInput ? "input_missing_explicit" : "input_missing");
  }

  let raw: string;
  try {
    raw = fs.readFileSync(filepath, "utf-8");
  } catch {
    return emptyResult("failed", "input_unreadable");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return emptyResult("failed", "input_invalid_json", stableSourceInputHash(raw));
  }

  if (!isRecord(parsed)) return emptyResult("failed", "provider_schema_invalid", stableSourceInputHash(raw));
  if (parsed.provider !== "agent-reach" || parsed.schema_version !== "agent-reach.external-discovery.v1") {
    return emptyResult("failed", "provider_schema_invalid", stableSourceInputHash(raw));
  }

  const topLevelContract = validateTopLevelContract(parsed);
  if (!topLevelContract.ok) {
    return emptyResult("failed", topLevelContract.reason_code, stableSourceInputHash(raw));
  }

  const artifact = parsed as ValidProviderArtifact;
  const status = artifact.status;
  const platforms = artifact.platforms;
  const events: ExternalSignalEvent[] = [];
  const rejectedEvents: AgentReachProviderReadResult["rejected_events"] = [];
  const registry = resolveEntityRegistry(options);
  const warnings: AgentReachProviderReadResult["warnings"] = [];

  for (const item of artifact.items) {
    const event = parseEvent(item);
    if (event.ok) {
      const enriched = enrichEventActor(event.value, registry);
      events.push(enriched.event);
      warnings.push(...enriched.warnings);
    } else {
      rejectedEvents.push(event.rejected);
    }
  }

  const effectiveStatus: ExternalProviderStatus =
    status === "ok" && rejectedEvents.length > 0 ? "partial" : status === "ok" && events.length === 0 ? "ok" : status;

  return {
    provider: "agent-reach",
    schema_version: "agent-reach.external-discovery.v1",
    provider_run_id: artifact.provider_run_id,
    generated_at: artifact.generated_at,
    status: effectiveStatus,
    status_reason: typeof artifact.status_reason === "string" ? artifact.status_reason : undefined,
    platforms,
    events,
    rejected_events: rejectedEvents,
    warnings: uniqueWarnings(warnings),
    source_input_hash: stableSourceInputHash(raw),
  };
}

function resolveEntityRegistry(options: ReadOptions):
  | {
      shouldApply: true;
      entries: ExternalEntityRegistryEntry[];
    }
  | {
      shouldApply: false;
      entries: [];
    } {
  if (options.entityRegistry) return { shouldApply: true, entries: options.entityRegistry };

  const registryPath = options.entityRegistryPath ?? externalEntityRegistryPath();
  if (!fs.existsSync(registryPath)) return { shouldApply: false, entries: [] };
  return { shouldApply: true, entries: readEntityRegistry(registryPath) };
}

function enrichEventActor(
  event: ExternalSignalEvent,
  registry:
    | {
        shouldApply: true;
        entries: ExternalEntityRegistryEntry[];
      }
    | {
        shouldApply: false;
        entries: [];
      },
): { event: ExternalSignalEvent; warnings: AgentReachProviderReadResult["warnings"] } {
  if (!registry.shouldApply) return { event, warnings: [] };

  const lookup = applyEntityRegistry(event.actor, registry.entries);
  return {
    event: {
      ...event,
      actor: lookup.actor,
    },
    warnings: lookup.warnings,
  };
}

function uniqueWarnings(warnings: AgentReachProviderReadResult["warnings"]): AgentReachProviderReadResult["warnings"] {
  const byKey = new Map<string, AgentReachProviderReadResult["warnings"][number]>();
  for (const warning of warnings) {
    byKey.set(`${warning.reason_code}:${warning.reason_detail}`, warning);
  }
  return [...byKey.values()];
}

function parseEvent(value: unknown):
  | { ok: true; value: ExternalSignalEvent }
  | { ok: false; rejected: AgentReachProviderReadResult["rejected_events"][number] } {
  if (!isRecord(value)) {
    return { ok: false, rejected: { reason_code: "event_not_object", reason_detail: "provider item is not an object" } };
  }

  const rawRef = typeof value.raw_ref === "string" ? value.raw_ref : undefined;
  const url = typeof value.url === "string" ? value.url : undefined;
  const observedAt = typeof value.observed_at === "string" ? value.observed_at : undefined;
  const eventId = typeof value.event_id === "string" ? value.event_id : generatedEventId({ rawRef, url, observedAt });
  const actor = isRecord(value.actor) ? value.actor : undefined;
  const target = isRecord(value.target) ? value.target : undefined;
  const targetType = isTargetType(value.target_type) ? value.target_type : inferTargetType(target);
  const scope = isScope(value.scope) ? value.scope : inferScope(targetType);
  const targetKey = typeof value.target_key === "string" ? value.target_key : inferTargetKey(value, target);
  if (
    !eventId ||
    !isExternalPlatform(value.platform) ||
    !isRawEventKind(value.raw_event_kind) ||
    !Array.isArray(value.derived_signal_kinds) ||
    value.derived_signal_kinds.length === 0 ||
    value.derived_signal_kinds.some((kind) => !isSignalKind(kind)) ||
    !targetType ||
    !scope ||
    !targetKey ||
    !actor ||
    !observedAt
  ) {
    return {
      ok: false,
      rejected: { event_id: eventId, reason_code: "event_schema_invalid", reason_detail: "provider item misses required canonical fields" },
    };
  }

  if (!url && !rawRef) {
    return {
      ok: false,
      rejected: { event_id: eventId, reason_code: "event_source_ref_missing", reason_detail: "url or raw_ref is required" },
    };
  }

  return {
    ok: true,
    value: {
      event_id: eventId,
      platform: value.platform,
      raw_event_kind: value.raw_event_kind,
      derived_signal_kinds: value.derived_signal_kinds,
      scope,
      target_type: targetType,
      target_key: targetKey,
      actor: {
        actor_type: isActorType(actor.actor_type) ? actor.actor_type : "unknown",
        effective_tier: isActorTier(actor.effective_tier) ? actor.effective_tier : "unknown",
        tier_basis: actor.tier_basis === "registry" || actor.tier_basis === "provider_hint" ? actor.tier_basis : isProviderTierHint(actor.provider_tier_hint) || isProviderTierHint(actor.tier_hint) ? "provider_hint" : "none",
        provider_actor_id: providerActorId(actor),
        provider_tier_hint: isProviderTierHint(actor.provider_tier_hint) ? actor.provider_tier_hint : isProviderTierHint(actor.tier_hint) ? actor.tier_hint : undefined,
        registry_entity_id: typeof actor.registry_entity_id === "string" ? actor.registry_entity_id : undefined,
        registry_display_name: typeof actor.registry_display_name === "string" ? actor.registry_display_name : undefined,
        registry_tier: isRegistryTier(actor.registry_tier) ? actor.registry_tier : undefined,
      },
      observed_at: observedAt,
      source_published_at: typeof value.source_published_at === "string" ? value.source_published_at : undefined,
      ingested_at: typeof value.ingested_at === "string" ? value.ingested_at : undefined,
      url,
      raw_ref: rawRef,
    },
  };
}

function generatedEventId(input: { rawRef?: string; url?: string; observedAt?: string }): string | undefined {
  const seed = input.rawRef ?? input.url;
  if (!seed || !input.observedAt) return undefined;
  return `agent-reach:${stableSourceInputHash(`${seed}:${input.observedAt}`).slice(0, 16)}`;
}

function inferTargetType(target: Record<string, unknown> | undefined): ExternalTargetType | undefined {
  if (!target) return undefined;
  if (isTargetType(target.target_type)) return target.target_type;
  if (typeof target.repo_url === "string") return "project";
  if (typeof target.paper_url === "string") return "paper";
  if (typeof target.product_url === "string") return "product";
  if (typeof target.url === "string" && /github\.com/i.test(target.url)) return "project";
  return "topic";
}

function inferScope(targetType: ExternalTargetType | undefined): ExternalSignalEvent["scope"] | undefined {
  if (!targetType) return undefined;
  return targetType === "topic" ? "direction" : "project";
}

function inferTargetKey(value: Record<string, unknown>, target: Record<string, unknown> | undefined): string | undefined {
  const candidates = [
    target?.repo_url,
    target?.paper_url,
    target?.url,
    target?.name,
    target?.topic_hint,
    value.title,
    value.raw_ref,
    value.url,
  ];
  return candidates.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)?.trim();
}

function providerActorId(actor: Record<string, unknown>): string | undefined {
  const candidates = [actor.provider_actor_id, actor.identity_hash, actor.identity_id];
  return candidates.find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)?.trim();
}

function emptyResult(status: ExternalProviderStatus, statusReason: string, sourceInputHash = ""): AgentReachProviderReadResult {
  return {
    provider: "agent-reach",
    schema_version: "agent-reach.external-discovery.v1",
    status,
    status_reason: statusReason,
    platforms: [],
    events: [],
    rejected_events: [],
    warnings: [],
    source_input_hash: sourceInputHash,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateTopLevelContract(value: Record<string, unknown>):
  | {
      ok: true;
    }
  | {
      ok: false;
      reason_code: string;
    } {
  if (typeof value.provider_run_id !== "string" || value.provider_run_id.length === 0) {
    return { ok: false, reason_code: "provider_run_id_missing" };
  }
  if (typeof value.generated_at !== "string" || value.generated_at.length === 0) {
    return { ok: false, reason_code: "generated_at_missing" };
  }
  if (!(typeof value.query === "string" || isRecord(value.query))) {
    return { ok: false, reason_code: "query_missing" };
  }
  if (!Array.isArray(value.platforms) || value.platforms.length === 0 || value.platforms.some((platform) => !isExternalPlatform(platform))) {
    return { ok: false, reason_code: "platforms_invalid" };
  }
  if (!isProviderStatus(value.status)) {
    return { ok: false, reason_code: "status_invalid" };
  }
  if (!Array.isArray(value.items)) {
    return { ok: false, reason_code: "items_invalid" };
  }
  return { ok: true };
}

function isExternalPlatform(value: unknown): value is ExternalPlatform {
  return value === "x_twitter" || value === "reddit" || value === "hacker_news" || value === "official_web" || value === "official_blog";
}

function isProviderStatus(value: unknown): value is ExternalProviderStatus {
  return value === "ok" || value === "skipped" || value === "partial" || value === "failed";
}

function isSignalKind(value: unknown): value is ExternalSignalKind {
  return value === "discovery" || value === "evidence";
}

function isRawEventKind(value: unknown): value is ExternalRawEventKind {
  return value === "mention" || value === "discussion" || value === "official_release" || value === "blog_post" || value === "question" || value === "showcase" || value === "unknown";
}

function isTargetType(value: unknown): value is ExternalTargetType {
  return value === "project" || value === "paper" || value === "product" || value === "topic";
}

function isScope(value: unknown): value is ExternalSignalEvent["scope"] {
  return value === "project" || value === "direction";
}

function isActorType(value: unknown): value is ExternalSignalEvent["actor"]["actor_type"] {
  return value === "institution" || value === "team" || value === "person" || value === "community" || value === "unknown";
}

function isActorTier(value: unknown): value is ExternalSignalEvent["actor"]["effective_tier"] {
  return value === "core" || value === "proven" || value === "watch" || value === "ordinary" || value === "unknown";
}

function isProviderTierHint(value: unknown): value is ExternalSignalEvent["actor"]["provider_tier_hint"] {
  return value === "core" || value === "proven" || value === "watch" || value === "ordinary" || value === "unknown";
}

function isRegistryTier(value: unknown): value is ExternalSignalEvent["actor"]["registry_tier"] {
  return value === "core" || value === "proven" || value === "watch";
}
