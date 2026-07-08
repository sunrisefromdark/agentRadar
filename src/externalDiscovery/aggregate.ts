import { REDACTION_POLICY_VERSION, assertPublicSafeAggregate, stableSourceInputHash } from "./redaction.ts";
import { buildPublicActorsForEvidence } from "./publicActors.ts";
import type {
  AgentReachProviderReadResult,
  DailyExternalAggregate,
  ExternalActorTier,
  ExternalActorType,
  ExternalCandidateDisplayBucket,
  ExternalCandidateQualityBucket,
  ExternalCandidateQualityReason,
  ExternalEvidence,
  ExternalNamedRegistryActor,
  ExternalNamedActorSourceRole,
  ExternalPlatform,
  ExternalPublicActor,
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

const SOCIAL_RECENCY_WINDOW_DAYS = 30;
const SOCIAL_RECENCY_PLATFORMS = new Set<ExternalPlatform>(["x_twitter", "reddit"]);
const SOCIAL_DISCUSSION_PLATFORMS = new Set<ExternalPlatform>(["x_twitter", "reddit", "hacker_news"]);
const OFFICIAL_PLATFORMS = new Set<ExternalPlatform>(["official_web", "official_blog"]);

const qualityBucketRank: Record<ExternalCandidateQualityBucket, number> = {
  cross_platform_confirmed: 0,
  social_discussion: 1,
  official_source: 2,
  weak_single_source: 3,
};

const displayBucketRank: Record<ExternalCandidateDisplayBucket, number> = {
  project_evidence: 0,
  new_discovery: 1,
  direction_observation: 2,
  official_signal: 3,
  weak_followup: 4,
};

function rankDisplayBucket(bucket: ObservationCandidate["display_bucket"] | undefined): number {
  switch (bucket) {
    case "project_evidence":
      return 0;
    case "new_discovery":
    case "new_discoveries":
    case "community_discussions":
      return 1;
    case "direction_observation":
    case "direction_observations":
      return 2;
    case "official_signal":
    case "official_releases":
      return 3;
    case "weak_followup":
    case "needs_followup":
      return 4;
    default:
      return displayBucketRank.weak_followup;
  }
}

const qualityScoreCap: Record<ExternalCandidateQualityBucket, number> = {
  cross_platform_confirmed: 100,
  social_discussion: 75,
  official_source: 55,
  weak_single_source: 20,
};

export function buildDailyExternalAggregate(input: BuildDailyExternalAggregateInput): DailyExternalAggregate {
  const rawEvents = input.events ?? input.provider_result?.events ?? [];
  const recentEvents = filterRecentSocialEvents(rawEvents, input.date);
  const events = recentEvents.events;
  const rejectedEvents = [...(input.provider_result?.rejected_events ?? []), ...recentEvents.rejected_events];
  const projectEvidence = buildEvidence(events.filter((event) => event.scope === "project"));
  const directionEvidence = buildEvidence(events.filter((event) => event.scope === "direction"));
  const observationCandidates = normalizeObservationCandidates({
    candidates: input.observation_candidates ?? [],
    projectEvidence,
    directionEvidence,
  });
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
    project_evidence: projectEvidence,
    direction_evidence: directionEvidence,
    observation_candidates: observationCandidates,
    audit: {
      rejected_events: rejectedEvents,
      warnings: [...(input.provider_result?.warnings ?? []), ...recentEvents.warnings, ...namedActorRoleWarnings(events)],
    },
  };

  const redaction = assertPublicSafeAggregate(aggregate);
  if (!redaction.ok) {
    throw new Error(`external aggregate is not public-safe: ${redaction.reason_codes.join(",")}`);
  }

  return aggregate;
}

function normalizeObservationCandidates(input: {
  candidates: ObservationCandidate[];
  projectEvidence: ExternalEvidence[];
  directionEvidence: ExternalEvidence[];
}): ObservationCandidate[] {
  const projectEvidenceByTargetKey = evidenceByTargetKey(input.projectEvidence);
  const directionEvidenceByTargetKey = evidenceByTargetKey(input.directionEvidence);
  const baseCandidates = input.candidates.length > 0 ? input.candidates : candidatesFromEvidence(input.projectEvidence, input.directionEvidence);

  return uniqueCandidates(baseCandidates)
    .map((candidate) => normalizeObservationCandidate(candidate, projectEvidenceByTargetKey, directionEvidenceByTargetKey))
    .sort(compareCandidates);
}

function candidatesFromEvidence(projectEvidence: ExternalEvidence[], directionEvidence: ExternalEvidence[]): ObservationCandidate[] {
  const fromProject = projectEvidence.map((evidence): ObservationCandidate => ({
    candidate_kind: "project",
    target_key: evidence.target_key,
    qualification: "needs_primary_confirmation",
    can_enter_daily: false,
    can_enter_weekly: false,
    cannot_be_primary_conclusion: true,
  }));
  const fromDirection = directionEvidence.map((evidence): ObservationCandidate => ({
    candidate_kind: "direction",
    target_key: evidence.target_key,
    qualification: "direction_observation",
    can_enter_daily: false,
    can_enter_weekly: false,
    cannot_be_primary_conclusion: true,
  }));
  return [...fromProject, ...fromDirection];
}

function normalizeObservationCandidate(
  candidate: ObservationCandidate,
  projectEvidenceByTargetKey: Map<string, ExternalEvidence[]>,
  directionEvidenceByTargetKey: Map<string, ExternalEvidence[]>,
): ObservationCandidate {
  const evidence = evidenceForCandidate(candidate, projectEvidenceByTargetKey, directionEvidenceByTargetKey);
  const metrics = candidateMetrics(evidence);
  const qualityBucket = qualityBucketForCandidate(evidence, metrics);
  const displayBucket = displayBucketForCandidate(candidate, evidence, qualityBucket);
  const eligibility = eligibilityForCandidate(displayBucket, qualityBucket, metrics);
  const qualityReasons = qualityReasonsForCandidate(candidate, evidence, metrics, qualityBucket, eligibility.can_enter_weekly);

  return {
    ...candidate,
    can_enter_daily: eligibility.can_enter_daily,
    can_enter_weekly: eligibility.can_enter_weekly,
    cannot_be_primary_conclusion: true,
    quality_bucket: qualityBucket,
    display_bucket: displayBucket,
    quality_reasons: qualityReasons,
    quality_score: qualityScoreForCandidate(qualityBucket, metrics),
    evidence_ids: evidence.map((item) => item.evidence_id).sort(),
    platforms: metrics.platforms,
    mention_count: metrics.mention_count,
    distinct_actor_count: metrics.distinct_actor_count,
    top_tier_actor_count: metrics.top_tier_actor_count,
  };
}

function evidenceByTargetKey(evidence: ExternalEvidence[]): Map<string, ExternalEvidence[]> {
  const map = new Map<string, ExternalEvidence[]>();
  for (const item of evidence) {
    map.set(item.target_key, [...(map.get(item.target_key) ?? []), item]);
  }
  return map;
}

function evidenceForCandidate(
  candidate: ObservationCandidate,
  projectEvidenceByTargetKey: Map<string, ExternalEvidence[]>,
  directionEvidenceByTargetKey: Map<string, ExternalEvidence[]>,
): ExternalEvidence[] {
  if (candidate.candidate_kind === "direction" || candidate.qualification === "direction_observation") {
    return directionEvidenceByTargetKey.get(candidate.target_key) ?? projectEvidenceByTargetKey.get(candidate.target_key) ?? [];
  }
  return projectEvidenceByTargetKey.get(candidate.target_key) ?? directionEvidenceByTargetKey.get(candidate.target_key) ?? [];
}

function candidateMetrics(evidence: ExternalEvidence[]): {
  platforms: ExternalPlatform[];
  mention_count: number;
  distinct_actor_count: number;
  top_tier_actor_count: number;
  has_quality_public_actor: boolean;
  has_named_registry_actor: boolean;
  derived_signal_kinds: ExternalSignalKind[];
} {
  return {
    platforms: unique(evidence.flatMap((item) => item.platforms)).sort() as ExternalPlatform[],
    mention_count: evidence.reduce((sum, item) => sum + item.mention_count, 0),
    distinct_actor_count: evidence.reduce((sum, item) => sum + item.distinct_actor_count, 0),
    top_tier_actor_count: evidence.reduce((sum, item) => sum + item.top_tier_actor_count, 0),
    has_quality_public_actor: evidence.some((item) => hasQualityPublicActor(item.public_actors ?? [])),
    has_named_registry_actor: evidence.some((item) => item.named_registry_actors.length > 0),
    derived_signal_kinds: unique(evidence.flatMap((item) => item.derived_signal_kinds)).sort() as ExternalSignalKind[],
  };
}

function qualityBucketForCandidate(
  evidence: ExternalEvidence[],
  metrics: ReturnType<typeof candidateMetrics>,
): ExternalCandidateQualityBucket {
  if (evidence.length === 0 || metrics.platforms.length === 0) return "weak_single_source";
  if (metrics.platforms.length >= 2) return "cross_platform_confirmed";
  if (metrics.platforms.some((platform) => SOCIAL_DISCUSSION_PLATFORMS.has(platform))) return "social_discussion";
  if (metrics.platforms.every((platform) => OFFICIAL_PLATFORMS.has(platform))) {
    if (
      metrics.mention_count <= 1 &&
      metrics.distinct_actor_count <= 1 &&
      metrics.top_tier_actor_count === 0 &&
      !metrics.has_named_registry_actor &&
      !metrics.has_quality_public_actor
    ) {
      return "weak_single_source";
    }
    return "official_source";
  }
  return "weak_single_source";
}

function displayBucketForCandidate(
  candidate: ObservationCandidate,
  evidence: ExternalEvidence[],
  qualityBucket: ExternalCandidateQualityBucket,
): ExternalCandidateDisplayBucket {
  if (candidate.candidate_kind === "direction" || candidate.qualification === "direction_observation") return "direction_observation";
  if (qualityBucket === "weak_single_source") return "weak_followup";
  const platforms = unique(evidence.flatMap((item) => item.platforms)) as ExternalPlatform[];
  const derivedKinds = unique(evidence.flatMap((item) => item.derived_signal_kinds)) as ExternalSignalKind[];
  if (derivedKinds.includes("evidence")) return "project_evidence";
  if (platforms.length > 0 && platforms.every((platform) => OFFICIAL_PLATFORMS.has(platform))) return "official_signal";
  return "new_discovery";
}

function eligibilityForCandidate(
  displayBucket: ExternalCandidateDisplayBucket,
  qualityBucket: ExternalCandidateQualityBucket,
  metrics: ReturnType<typeof candidateMetrics>,
): { can_enter_daily: boolean; can_enter_weekly: boolean } {
  if (displayBucket === "direction_observation") return { can_enter_daily: false, can_enter_weekly: false };
  if (qualityBucket === "cross_platform_confirmed") return { can_enter_daily: true, can_enter_weekly: true };
  if (qualityBucket === "social_discussion") {
    return {
      can_enter_daily: true,
      can_enter_weekly: metrics.mention_count >= 2 || metrics.distinct_actor_count >= 2 || metrics.top_tier_actor_count > 0,
    };
  }
  if (qualityBucket === "official_source") {
    return {
      can_enter_daily: true,
      can_enter_weekly: metrics.mention_count >= 2 || metrics.top_tier_actor_count > 0,
    };
  }
  return { can_enter_daily: false, can_enter_weekly: false };
}

function qualityReasonsForCandidate(
  candidate: ObservationCandidate,
  evidence: ExternalEvidence[],
  metrics: ReturnType<typeof candidateMetrics>,
  qualityBucket: ExternalCandidateQualityBucket,
  canEnterWeekly: boolean,
): ExternalCandidateQualityReason[] {
  if (evidence.length === 0) return ["evidence_missing"];
  const reasons: ExternalCandidateQualityReason[] = [];
  if (qualityBucket === "cross_platform_confirmed") reasons.push("cross_platform_confirmed");
  if (qualityBucket === "social_discussion") reasons.push("social_platform_discussion");
  if (qualityBucket === "official_source") reasons.push("official_platform_signal");
  if (qualityBucket === "weak_single_source") reasons.push("weak_single_source");
  if (metrics.platforms.length === 1) reasons.push("single_platform");
  if (metrics.mention_count <= 1) reasons.push("single_event");
  if (metrics.derived_signal_kinds.includes("evidence")) reasons.push("external_evidence_present");
  if (candidate.candidate_kind === "direction" || candidate.qualification === "direction_observation") reasons.push("direction_candidate");
  if (metrics.has_named_registry_actor) reasons.push("named_registry_actor_present");
  if (metrics.has_quality_public_actor) reasons.push("quality_public_actor_present");
  if (!canEnterWeekly) reasons.push("weekly_gate_not_met");
  reasons.push("cannot_be_primary_conclusion");
  return unique(reasons);
}

function qualityScoreForCandidate(
  qualityBucket: ExternalCandidateQualityBucket,
  metrics: ReturnType<typeof candidateMetrics>,
): number {
  const base =
    (metrics.platforms.length >= 2 ? 30 : 0) +
    (metrics.platforms.some((platform) => SOCIAL_DISCUSSION_PLATFORMS.has(platform)) ? 18 : 0) +
    (metrics.platforms.some((platform) => OFFICIAL_PLATFORMS.has(platform)) ? 8 : 0) +
    Math.min(20, metrics.mention_count * 4) +
    Math.min(20, metrics.distinct_actor_count * 5) +
    Math.min(20, metrics.top_tier_actor_count * 10) +
    (metrics.has_named_registry_actor || metrics.has_quality_public_actor ? 10 : 0);
  return Math.max(0, Math.min(qualityScoreCap[qualityBucket], base));
}

function hasQualityPublicActor(publicActors: ExternalPublicActor[]): boolean {
  return publicActors.some((actor) =>
    actor.actor_role === "discussion_actor" || actor.actor_role === "community_source" || actor.actor_role === "registry_entity",
  );
}

function uniqueCandidates(candidates: ObservationCandidate[]): ObservationCandidate[] {
  const byKey = new Map<string, ObservationCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.candidate_kind}:${candidate.target_key}:${candidate.qualification}`;
    if (!byKey.has(key)) byKey.set(key, candidate);
  }
  return [...byKey.values()];
}

function compareCandidates(a: ObservationCandidate, b: ObservationCandidate): number {
  return (
    qualityBucketRank[a.quality_bucket ?? "weak_single_source"] - qualityBucketRank[b.quality_bucket ?? "weak_single_source"] ||
    rankDisplayBucket(a.display_bucket) - rankDisplayBucket(b.display_bucket) ||
    (b.quality_score ?? 0) - (a.quality_score ?? 0) ||
    (b.platforms?.length ?? 0) - (a.platforms?.length ?? 0) ||
    (b.mention_count ?? 0) - (a.mention_count ?? 0) ||
    (b.top_tier_actor_count ?? 0) - (a.top_tier_actor_count ?? 0) ||
    a.target_key.localeCompare(b.target_key)
  );
}

function filterRecentSocialEvents(events: ExternalSignalEvent[], date: string): {
  events: ExternalSignalEvent[];
  rejected_events: Array<{ event_id?: string; reason_code: string; reason_detail: string }>;
  warnings: Array<{ reason_code: string; reason_detail: string }>;
} {
  const cutoff = socialRecencyCutoff(date);
  if (!cutoff) return { events, rejected_events: [], warnings: [] };

  const accepted: ExternalSignalEvent[] = [];
  const rejected: Array<{ event_id?: string; reason_code: string; reason_detail: string }> = [];
  const invalidTimestampWarnings: Array<{ reason_code: string; reason_detail: string }> = [];

  for (const event of events) {
    if (!SOCIAL_RECENCY_PLATFORMS.has(event.platform)) {
      accepted.push(event);
      continue;
    }

    const eventTime = socialEventPublishedTime(event);
    if (!eventTime) {
      accepted.push(event);
      invalidTimestampWarnings.push({
        reason_code: "social_event_recency_timestamp_invalid",
        reason_detail: `${event.event_id} did not provide a parseable source_published_at or observed_at; kept for review`,
      });
      continue;
    }

    if (eventTime < cutoff) {
      rejected.push({
        event_id: event.event_id,
        reason_code: "event_outside_recent_social_window",
        reason_detail: `${event.platform} event is older than ${SOCIAL_RECENCY_WINDOW_DAYS} days for aggregate date ${date}`,
      });
      continue;
    }

    accepted.push(event);
  }

  return { events: accepted, rejected_events: rejected, warnings: uniqueWarnings(invalidTimestampWarnings) };
}

function socialRecencyCutoff(date: string): number | null {
  const anchor = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(anchor)) return null;
  return anchor - SOCIAL_RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function socialEventPublishedTime(event: ExternalSignalEvent): number | null {
  const candidates = [event.source_published_at, event.observed_at];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = Date.parse(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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
  const publicActors = buildPublicActorsForEvidence(events);

  return {
    evidence_id: `${firstEvent.scope}:${firstEvent.target_key}`,
    event_ids: events.map((event) => event.event_id).sort(),
    scope: firstEvent.scope,
    target_key: firstEvent.target_key,
    derived_signal_kinds: unique(events.flatMap((event) => event.derived_signal_kinds)).sort() as ExternalSignalKind[],
    platforms: unique(events.map((event) => event.platform)).sort() as ExternalPlatform[],
    named_registry_actors: buildNamedRegistryActors(events),
    public_actors: publicActors.public_actors,
    public_actor_audit: publicActors.public_actor_audit,
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
      !actor.source_roles ||
      actor.source_roles.length === 0 ||
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
          source_roles: uniqueRoles(actor.source_roles),
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
    existing.actor.source_roles = uniqueRoles([...existing.actor.source_roles, ...actor.source_roles]);
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

function namedActorRoleWarnings(events: ExternalSignalEvent[]): Array<{ reason_code: string; reason_detail: string }> {
  return events
    .filter(
      (event) =>
        event.actor.tier_basis === "registry" &&
        event.actor.registry_entity_id &&
        event.actor.registry_display_name &&
        event.actor.registry_tier &&
        (!event.actor.source_roles || event.actor.source_roles.length === 0),
    )
    .map((event) => ({
      reason_code: "named_actor_missing_source_roles",
      reason_detail: `registry actor ${event.actor.registry_entity_id} on event ${event.event_id} was not published as a named actor`,
    }));
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
    events.map((event, index) => event.actor.registry_entity_id ?? event.actor.identity_hash ?? event.actor.provider_actor_id ?? `${event.actor.actor_type}:${index}`),
  );
}

function topTierActorIds(events: ExternalSignalEvent[]): Set<string> {
  return new Set(
    events
      .filter((event) => isPublishableNamedRegistryActor(event.actor))
      .map((event) => event.actor.registry_entity_id!),
  );
}

function isPublishableNamedRegistryActor(actor: ExternalSignalEvent["actor"]): boolean {
  return (
    actor.tier_basis === "registry" &&
    Boolean(actor.registry_entity_id) &&
    Boolean(actor.registry_display_name) &&
    Boolean(actor.registry_tier) &&
    Boolean(actor.source_roles?.length) &&
    (actor.actor_type === "institution" || actor.actor_type === "team" || actor.actor_type === "person")
  );
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function uniqueWarnings<T extends { reason_code: string; reason_detail: string }>(warnings: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const warning of warnings) {
    byKey.set(`${warning.reason_code}:${warning.reason_detail}`, warning);
  }
  return [...byKey.values()];
}

function uniqueRoles(values: ExternalNamedActorSourceRole[]): ExternalNamedActorSourceRole[] {
  const order: ExternalNamedActorSourceRole[] = ["social_discussant", "official_publisher", "official_owner"];
  return order.filter((role) => values.includes(role));
}
