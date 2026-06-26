import { assessConferenceFreshness } from "./conferenceFreshness.ts";
import { getConferenceSource } from "./conferenceSourceCatalog.ts";
import {
  academicAgentId,
  executionContextFor,
  responsibilityForAxis,
  type ConferenceSeed,
  type EventBucket,
  type IndustrySignalEvent,
} from "./types.ts";

function buildConferenceCitationRefs(seed: ConferenceSeed): string[] {
  const refs: string[] = [];
  if (seed.canonical_refs?.proceedings_url) refs.push(seed.canonical_refs.proceedings_url);
  if (seed.canonical_refs?.official_url) refs.push(seed.canonical_refs.official_url);
  if (seed.canonical_refs?.leaderboard_url) refs.push(seed.canonical_refs.leaderboard_url);
  return refs;
}

function classifyConferenceSeed(seed: ConferenceSeed): { bucket: EventBucket; reason_codes: string[] } {
  const citationRefs = buildConferenceCitationRefs(seed);
  if (!seed.published_at) {
    return { bucket: "diagnostic", reason_codes: ["missing_source_published_at"] };
  }
  if (!seed.venue || citationRefs.length === 0) {
    return { bucket: "rejected", reason_codes: ["missing_canonical_venue"] };
  }
  if (seed.polarity === "counter") {
    return { bucket: "counter", reason_codes: ["counter_evidence_reported"] };
  }
  return { bucket: "accepted", reason_codes: [] };
}

export function buildConferenceEvent(seed: ConferenceSeed): IndustrySignalEvent {
  const source = getConferenceSource(seed.source_key);
  const citationRefs = buildConferenceCitationRefs(seed);
  const freshness = assessConferenceFreshness(seed.freshness_anchor_kind, seed.published_at, seed.observed_at);
  const audit = classifyConferenceSeed(seed);

  return {
    event_id: seed.id,
    schema_version: "industry-signal-event.v1",
    observed_at: seed.observed_at,
    source_published_at: seed.published_at,
    ingested_at: seed.observed_at,
    freshness_anchor_kind: seed.freshness_anchor_kind,
    freshness_profile_id: freshness.profile_id,
    axis: "conference_academic",
    source_polarity_cue: seed.polarity,
    source: {
      source_id: seed.source_key,
      display_name: source.display_name,
      source_url: seed.source_url,
      source_type: source.source_type,
      authority_tier: source.authority_tier,
      primary_source_distance: source.primary_source_distance,
    },
    agent_relevance: {
      state: "agent_core",
      score: 1,
      summary_cn: "会议官方材料，直接服务学术会议轴判断。",
    },
    evidence: {
      title: seed.title,
      summary_cn: seed.summary_cn,
      citation_trace_refs: citationRefs,
      canonical_ref: citationRefs[0],
    },
    collected_by_agent_id: academicAgentId,
    responsibility_id: responsibilityForAxis("conference_academic"),
    execution_context: executionContextFor("conference_academic"),
    audit: {
      bucket: audit.bucket,
      reason_codes: audit.reason_codes,
      direct_fact_owner_agent_id: academicAgentId,
    },
  };
}

export function buildConferenceEvents(seeds: ConferenceSeed[]): IndustrySignalEvent[] {
  return seeds.map(buildConferenceEvent);
}
