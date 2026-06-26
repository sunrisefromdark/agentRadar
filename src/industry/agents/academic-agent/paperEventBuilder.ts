import { buildPaperCitationTrace } from "./paperCitationTrace.ts";
import { assessPaperFreshness } from "./paperFreshness.ts";
import { getPaperSource } from "./paperSourceCatalog.ts";
import {
  academicAgentId,
  executionContextFor,
  responsibilityForAxis,
  type EventBucket,
  type IndustrySignalEvent,
  type PaperSeed,
} from "./types.ts";

function classifyPaperSeed(seed: PaperSeed): { bucket: EventBucket; reason_codes: string[] } {
  const citation = buildPaperCitationTrace(seed);
  if (!seed.published_at) {
    return { bucket: "diagnostic", reason_codes: ["missing_source_published_at"] };
  }
  if (citation.status === "missing") {
    return { bucket: "rejected", reason_codes: ["missing_citation_trace"] };
  }
  if (seed.polarity === "counter") {
    return { bucket: "counter", reason_codes: ["counter_evidence_reported"] };
  }
  return { bucket: "accepted", reason_codes: [] };
}

export function buildPaperEvent(seed: PaperSeed): IndustrySignalEvent {
  const source = getPaperSource(seed.source_key);
  const citation = buildPaperCitationTrace(seed);
  const freshness = assessPaperFreshness(seed.freshness_anchor_kind, seed.published_at, seed.observed_at);
  const audit = classifyPaperSeed(seed);

  return {
    event_id: seed.id,
    schema_version: "industry-signal-event.v1",
    observed_at: seed.observed_at,
    source_published_at: seed.published_at,
    ingested_at: seed.observed_at,
    freshness_anchor_kind: seed.freshness_anchor_kind,
    freshness_profile_id: freshness.profile_id,
    axis: "research_paper",
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
      summary_cn: "学术一手源，直接服务研究前沿判断。",
    },
    evidence: {
      title: seed.title,
      summary_cn: seed.summary_cn,
      citation_trace_refs: citation.citation_refs,
      canonical_ref: citation.canonical_ref,
    },
    collected_by_agent_id: academicAgentId,
    responsibility_id: responsibilityForAxis("research_paper"),
    execution_context: executionContextFor("research_paper"),
    audit: {
      bucket: audit.bucket,
      reason_codes: audit.reason_codes,
      direct_fact_owner_agent_id: academicAgentId,
      anti_upgrade_guard:
        seed.freshness_anchor_kind === "first_release" && !seed.canonical_refs?.proceedings_url
          ? "single_preprint_not_core"
          : undefined,
    },
  };
}

export function buildPaperEvents(seeds: PaperSeed[]): IndustrySignalEvent[] {
  return seeds.map(buildPaperEvent);
}
