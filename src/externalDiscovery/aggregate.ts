import { REDACTION_POLICY_VERSION, assertPublicSafeAggregate, stableSourceInputHash } from "./redaction.ts";
import type {
  AgentReachProviderReadResult,
  DailyExternalAggregate,
  ExternalActorTier,
  ExternalActorType,
  ExternalEvidence,
  ExternalNamedRegistryActor,
  ExternalPlatform,
  ExternalSignalEvent,
  ExternalSignalKind,
  ObservationCandidate,
} from "./types.ts";

export interface BuildDailyExternalAggregateInput {
  date: string;
  generated_at: string;
  provider_result?: AgentReachProviderReadResult;
  events?: ExternalSignalEvent[];
  observation_candidates?: ObservationCandidate[];
  source_input_hash?: string;
}

const registryTierRank: Record<ExternalNamedRegistryActor["registry_tier"], number> = {
  core: 0,
  proven: 1,
  watch: 2,
};

export function buildDailyExternalAggregate(input: BuildDailyExternalAggregateInput): DailyExternalAggregate {
  const events = input.events ?? input.provider_result?.events ?? [];
  const rejectedEvents = input.provider_result?.rejected_events ?? [];
  const aggregate: DailyExternalAggregate = {
    schema_version: "external-discovery.aggregate.v1",
    date: input.date,
    generated_at: input.generated_at,
    provider: "agent-reach",
    provider_run_id: input.provider_result?.provider_run_id,
    status: input.provider_result?.status ?? "ok",
    status_reason: input.provider_result?.status_reason,
    source_input_hash: input.source_input_hash ?? input.provider_result?.source_input_hash ?? stableSourceInputHash(JSON.stringify(events)),
    public_safe: true,
    redaction_policy_version: REDACTION_POLICY_VERSION,
    contains_raw_text: false,
    contains_profile_urls: false,
    event_count: events.length + rejectedEvents.length,
    accepted_event_count: events.length,
    rejected_event_count: rejectedEvents.length,
    platform_counts: countPlatforms(events),
    derived_signal_kind_counts: countSignalKinds(events),
    project_evidence: buildEvidence(events.filter((event) => event.scope === "project")),
    direction_evidence: buildEvidence(events.filter((event) => event.scope === "direction")),
    observation_candidates: input.observation_candidates ?? [],
    audit: {
      rejected_events: rejectedEvents,
      warnings: input.provider_result?.warnings ?? [],
    },
  };

  const redaction = assertPublicSafeAggregate(aggregate);
  if (!redaction.ok) {
    throw new Error(`external aggregate is not public-safe: ${redaction.reason_codes.join(",")}`);
  }

  return aggregate;
}

function buildEvidence(events: ExternalSignalEvent[]): ExternalEvidence[] {
  const grouped = new Map<string, ExternalSignalEvent[]>();
  for (const event of events) {
    const groupKey = `${event.scope}:${event.target_key}`;
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), event]);
  }

  return Array.from(grouped.values())
    .map((groupEvents) => evidenceFromEvents(groupEvents))
    .sort((a, b) => a.target_key.localeCompare(b.target_key));
}

function evidenceFromEvents(events: ExternalSignalEvent[]): ExternalEvidence {
  const firstEvent = events[0];
  if (!firstEvent) throw new Error("cannot build external evidence from empty events");
  const observedTimes = events.map((event) => event.observed_at).sort();

  return {
    evidence_id: `${firstEvent.scope}:${firstEvent.target_key}`,
    event_ids: events.map((event) => event.event_id).sort(),
    scope: firstEvent.scope,
    target_key: firstEvent.target_key,
    derived_signal_kinds: unique(events.flatMap((event) => event.derived_signal_kinds)).sort() as ExternalSignalKind[],
    platforms: unique(events.map((event) => event.platform)).sort() as ExternalPlatform[],
    named_registry_actors: buildNamedRegistryActors(events),
    actor_tiers: countBy(events.map((event) => event.actor.effective_tier)),
    actor_types: countBy(events.map((event) => event.actor.actor_type)),
    mention_count: events.length,
    distinct_actor_count: distinctActorIds(events).size,
    top_tier_actor_count: topTierActorIds(events).size,
    first_seen_at: observedTimes[0]!,
    last_seen_at: observedTimes[observedTimes.length - 1]!,
  };
}

function buildNamedRegistryActors(events: ExternalSignalEvent[]): ExternalNamedRegistryActor[] {
  const byEntity = new Map<string, { actor: ExternalNamedRegistryActor; dates: string[] }>();

  for (const event of events) {
    const actor = event.actor;
    if (
      actor.tier_basis !== "registry" ||
      !actor.registry_entity_id ||
      !actor.registry_display_name ||
      !actor.registry_tier ||
      (actor.actor_type !== "institution" && actor.actor_type !== "team" && actor.actor_type !== "person")
    ) {
      continue;
    }

    const existing = byEntity.get(actor.registry_entity_id);
    if (!existing) {
      byEntity.set(actor.registry_entity_id, {
        actor: {
          entity_id: actor.registry_entity_id,
          display_name: actor.registry_display_name,
          actor_type: actor.actor_type,
          registry_tier: actor.registry_tier,
          event_count: 1,
          platforms: [event.platform],
          first_seen_at: event.observed_at,
          last_seen_at: event.observed_at,
        },
        dates: [event.observed_at],
      });
      continue;
    }

    existing.actor.event_count += 1;
    existing.actor.platforms = unique([...existing.actor.platforms, event.platform]).sort() as ExternalPlatform[];
    existing.dates.push(event.observed_at);
    existing.dates.sort();
    existing.actor.first_seen_at = existing.dates[0]!;
    existing.actor.last_seen_at = existing.dates[existing.dates.length - 1]!;
  }

  return Array.from(byEntity.values())
    .map((entry) => entry.actor)
    .sort(
      (a, b) =>
        registryTierRank[a.registry_tier] - registryTierRank[b.registry_tier] ||
        b.event_count - a.event_count ||
        a.display_name.localeCompare(b.display_name),
    );
}

function countPlatforms(events: ExternalSignalEvent[]): Partial<Record<ExternalPlatform, number>> {
  return countBy(events.map((event) => event.platform));
}

function countSignalKinds(events: ExternalSignalEvent[]): Partial<Record<ExternalSignalKind, number>> {
  return countBy(events.flatMap((event) => event.derived_signal_kinds));
}

function countBy<T extends string>(values: T[]): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function distinctActorIds(events: ExternalSignalEvent[]): Set<string> {
  return new Set(
    events.map((event, index) => event.actor.registry_entity_id ?? event.actor.provider_actor_id ?? `${event.actor.actor_type}:${index}`),
  );
}

function topTierActorIds(events: ExternalSignalEvent[]): Set<string> {
  return new Set(
    events
      .filter((event) => event.actor.tier_basis === "registry" && event.actor.registry_entity_id && event.actor.registry_tier)
      .map((event) => event.actor.registry_entity_id!),
  );
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
