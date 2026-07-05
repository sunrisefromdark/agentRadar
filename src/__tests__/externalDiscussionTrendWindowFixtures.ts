import type {
  DailyExternalAggregate,
  ExternalEvidence,
  ExternalNamedRegistryActor,
  ExternalPlatform,
} from "../externalDiscovery/types.ts";
import type { ExternalAggregateWindowReadResult } from "../externalDiscovery/trendWindow.ts";

export const TREND_TEST_DATES = ["2026-06-27", "2026-06-28", "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03"];

export function trendEvidence(args: {
  scope: "project" | "direction";
  target_key: string;
  date: string;
  mention_count?: number;
  platforms?: ExternalPlatform[];
  event_ids?: string[];
  distinct_actor_count?: number;
  top_tier_actor_count?: number;
  named_registry_actors?: ExternalNamedRegistryActor[];
}): ExternalEvidence {
  const mentionCount = args.mention_count ?? args.event_ids?.length ?? 1;
  const eventIds = args.event_ids ?? Array.from({ length: mentionCount }, (_, index) => `${args.scope}:${args.target_key}:${args.date}:${index}`);
  return {
    evidence_id: `${args.scope}:${args.target_key}:${args.date}`,
    event_ids: eventIds,
    scope: args.scope,
    target_key: args.target_key,
    derived_signal_kinds: ["evidence"],
    platforms: args.platforms ?? ["hacker_news"],
    named_registry_actors: args.named_registry_actors ?? [],
    actor_tiers: {},
    actor_types: {},
    mention_count: mentionCount,
    distinct_actor_count: args.distinct_actor_count ?? mentionCount,
    top_tier_actor_count: args.top_tier_actor_count ?? (args.named_registry_actors?.length ?? 0),
    first_seen_at: `${args.date}T00:00:00.000Z`,
    last_seen_at: `${args.date}T00:00:00.000Z`,
  };
}

export function aggregateForDate(args: {
  date: string;
  status?: DailyExternalAggregate["status"];
  project_evidence?: ExternalEvidence[];
  direction_evidence?: ExternalEvidence[];
}): DailyExternalAggregate {
  const projectEvidence = args.project_evidence ?? [];
  const directionEvidence = args.direction_evidence ?? [];
  const allEvidence = [...projectEvidence, ...directionEvidence];
  return {
    schema_version: "external-discovery.aggregate.v1",
    date: args.date,
    generated_at: `${args.date}T00:00:00.000Z`,
    provider: "agent-reach",
    status: args.status ?? "ok",
    source_input_hash: `hash-${args.date}`,
    public_safe: true,
    redaction_policy_version: "external-discovery-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    event_count: allEvidence.reduce((total, evidence) => total + evidence.event_ids.length, 0),
    accepted_event_count: allEvidence.reduce((total, evidence) => total + evidence.event_ids.length, 0),
    rejected_event_count: 0,
    platform_counts: countPlatforms(allEvidence.flatMap((evidence) => evidence.platforms)),
    derived_signal_kind_counts: { evidence: allEvidence.length },
    project_evidence: projectEvidence,
    direction_evidence: directionEvidence,
    observation_candidates: [],
    audit: { rejected_events: [], warnings: [] },
  };
}

export function loadedWindow(overrides: Record<string, DailyExternalAggregate>): ExternalAggregateWindowReadResult[] {
  return TREND_TEST_DATES.map((date) => ({
    status: "loaded",
    date,
    path: `data/external-discovery/${date}.aggregate.json`,
    aggregate: overrides[date] ?? aggregateForDate({ date }),
  }));
}

function countPlatforms(platforms: ExternalPlatform[]): Partial<Record<ExternalPlatform, number>> {
  const counts: Partial<Record<ExternalPlatform, number>> = {};
  for (const platform of platforms) {
    counts[platform] = (counts[platform] ?? 0) + 1;
  }
  return counts;
}
