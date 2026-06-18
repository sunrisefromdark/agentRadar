import type { NormalizedProject } from "../types.ts";
import {
  buildDirectionObservationCandidate,
  matchExternalEventToProjects,
  type ExternalTopicCanonicalizationContext,
} from "./matching.ts";
import { stableSourceInputHash } from "./redaction.ts";
import type { ExternalEvidence, ExternalSignalEvent, ObservationCandidate } from "./types.ts";

export interface BuildDailyExternalEvidenceInput {
  events: ExternalSignalEvent[];
  projects: NormalizedProject[];
  topicContext: ExternalTopicCanonicalizationContext;
}

export interface DailyExternalEvidenceBuildResult {
  projectEvidence: ExternalEvidence[];
  directionEvidence: ExternalEvidence[];
  observationCandidates: ObservationCandidate[];
  warnings: string[];
}

function stableId(prefix: string, payload: unknown): string {
  return `${prefix}:${stableSourceInputHash(JSON.stringify(payload)).slice("sha256:".length)}`;
}

function countBy<T extends string>(values: T[]): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function buildDirectionEvidence(
  event: ExternalSignalEvent,
  candidate: ObservationCandidate,
): ExternalEvidence {
  return {
    evidence_id: stableId("external-evidence", {
      event_id: event.event_id,
      topic_key: candidate.topic_key ?? candidate.target_key,
      scope: "direction",
    }),
    event_ids: [event.event_id],
    scope: "direction",
    target_key: candidate.target_key,
    derived_signal_kinds: event.derived_signal_kinds,
    direction_labels: [...event.direction_labels],
    platforms: [event.platform],
    actor_tiers: countBy([event.actor.effective_tier]),
    actor_types: countBy([event.actor.actor_type]),
    mention_count: 1,
    distinct_actor_count: 1,
    first_seen_at: event.observed_at,
    last_seen_at: event.observed_at,
    active_day_count: 1,
    cross_platform: false,
    authority_summary_cn: "External direction evidence is secondary only.",
    intensity_summary_cn: "One sanitized external mention.",
    persistence_summary_cn: "Single-day external observation.",
    caveats: ["external direction evidence cannot become a primary conclusion"],
  };
}

export function buildDailyExternalEvidence(
  input: BuildDailyExternalEvidenceInput,
): DailyExternalEvidenceBuildResult {
  const projectEvidence: ExternalEvidence[] = [];
  const directionEvidence: ExternalEvidence[] = [];
  const observationCandidates: ObservationCandidate[] = [];
  const warningSet = new Set<string>();

  for (const event of input.events) {
    if (event.target.target_type === "topic") {
      const directionCandidate = buildDirectionObservationCandidate(event, input.topicContext);
      if (directionCandidate) {
        const evidence = buildDirectionEvidence(event, directionCandidate);
        directionEvidence.push(evidence);
        observationCandidates.push({
          ...directionCandidate,
          evidence_ids: [evidence.evidence_id],
        });
      } else {
        warningSet.add("external_topic_unbound");
      }
      continue;
    }

    const match = matchExternalEventToProjects(event, input.projects);
    if (match.evidence) projectEvidence.push(match.evidence);
    if (match.candidate) observationCandidates.push(match.candidate);
    if (match.rejected_reason) warningSet.add(`external_match_${match.rejected_reason}`);
  }

  return {
    projectEvidence,
    directionEvidence,
    observationCandidates,
    warnings: [...warningSet],
  };
}
