import { stableSourceInputHash } from "./redaction.ts";
import type {
  ExternalEvidence,
  ExternalSignalEvent,
  ExternalSignalKind,
  ObservationCandidate,
} from "./types.ts";
import type { NormalizedProject } from "../types.ts";

export interface ExternalTopicCanonicalizationContext {
  userInterestTopics?: string[];
  weeklyTrendKeys?: string[];
  paradigmLabels?: string[];
}

export interface ExternalProjectMatchResult {
  evidence?: ExternalEvidence;
  candidate?: ObservationCandidate;
  rejected_reason?: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRepoUrl(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/\.git$/i, "").replace(/\/+$/, "") ?? "";
}

function stableId(prefix: string, payload: unknown): string {
  return `${prefix}:${stableSourceInputHash(JSON.stringify(payload)).slice("sha256:".length)}`;
}

function targetKeyForProject(project: NormalizedProject): string {
  return `repo:${project.repo_full_name || project.repo_url}`;
}

function actorCountKey(event: ExternalSignalEvent): string {
  return (
    event.actor.registry_entity_id ??
    event.actor.display_name?.trim().toLowerCase() ??
    `${event.platform}:${event.event_id}`
  );
}

function countBy<T extends string>(values: T[]): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function evidenceForProject(event: ExternalSignalEvent, project: NormalizedProject): ExternalEvidence {
  return {
    evidence_id: stableId("external-evidence", {
      event_id: event.event_id,
      repo_url: project.repo_url,
    }),
    event_ids: [event.event_id],
    scope: "project",
    target_key: targetKeyForProject(project),
    derived_signal_kinds: event.derived_signal_kinds,
    direction_labels: [...event.direction_labels],
    platforms: [event.platform],
    actor_tiers: countBy([event.actor.effective_tier]),
    actor_types: countBy([event.actor.actor_type]),
    mention_count: 1,
    distinct_actor_count: actorCountKey(event) ? 1 : 0,
    first_seen_at: event.observed_at,
    last_seen_at: event.observed_at,
    active_day_count: 1,
    cross_platform: false,
    authority_summary_cn: "external layer matched an existing project.",
    intensity_summary_cn: "one sanitized external event provides supporting evidence.",
    persistence_summary_cn: "one-day external observation; persistence requires continued observation.",
    caveats: ["external discovery is secondary supporting evidence only"],
  };
}

function projectCandidate(
  event: ExternalSignalEvent,
  confidence: ObservationCandidate["binding_confidence"],
  qualification: ObservationCandidate["qualification"],
  canEnterDaily: boolean,
): ObservationCandidate {
  const repoUrl = event.target.repo_url;
  const paperUrl = event.target.paper_url;
  const explicitTarget = repoUrl ?? paperUrl ?? event.target.url ?? event.target.name;
  return {
    candidate_id: stableId("external-candidate", {
      event_id: event.event_id,
      target: explicitTarget,
      confidence,
    }),
    scope: "project",
    candidate_kind: repoUrl ? "new_external_discovery" : "needs_confirmation",
    target_key: repoUrl ? `repo:${repoUrl}` : `${event.target.target_type}:${explicitTarget}`,
    display_name: event.target.name,
    ...(repoUrl ? { repo_url: repoUrl } : {}),
    ...(paperUrl ? { paper_url: paperUrl } : {}),
    direction_labels: [...event.direction_labels],
    binding_confidence: confidence,
    evidence_ids: [],
    evidence_summary_cn: "external-only candidate requires primary-source confirmation before entering primary conclusions.",
    qualification,
    can_enter_daily: canEnterDaily,
    can_enter_weekly: false,
    cannot_be_primary_conclusion: true,
    caveats: ["external-only candidate cannot be a primary conclusion"],
  };
}

function nameMatchesProject(event: ExternalSignalEvent, project: NormalizedProject): boolean {
  return slugify(event.target.name) !== "" && slugify(event.target.name) === slugify(project.project_name);
}

export function matchExternalEventToProjects(
  event: ExternalSignalEvent,
  projects: NormalizedProject[],
): ExternalProjectMatchResult {
  const targetRepoUrl = normalizeRepoUrl(event.target.repo_url);
  if (targetRepoUrl) {
    const matchedProject = projects.find((project) => normalizeRepoUrl(project.repo_url) === targetRepoUrl);
    if (matchedProject) {
      return { evidence: evidenceForProject(event, matchedProject) };
    }
    return {
      candidate: projectCandidate(event, "unbound", "needs_primary_confirmation", true),
    };
  }

  const lowConfidenceNameMatch = projects.find((project) => nameMatchesProject(event, project));
  if (lowConfidenceNameMatch) {
    return {
      candidate: projectCandidate(event, "low", "observe", false),
    };
  }

  if (event.target.paper_url || event.target.url) {
    return {
      candidate: projectCandidate(event, "unbound", "needs_primary_confirmation", true),
    };
  }

  return { rejected_reason: "target_unbound" };
}

function firstMatchingCanonicalKey(
  topicHint: string,
  values: string[] | undefined,
  returnSlug: boolean,
): string | undefined {
  const hintSlug = slugify(topicHint);
  return values?.find((value) => slugify(value) === hintSlug)
    ? returnSlug
      ? hintSlug
      : values.find((value) => slugify(value) === hintSlug)
    : undefined;
}

export function canonicalizeTopicKey(
  topicHint: string | undefined,
  context: ExternalTopicCanonicalizationContext,
): string | undefined {
  if (!topicHint || !slugify(topicHint)) return undefined;

  const userInterestTopic = firstMatchingCanonicalKey(topicHint, context.userInterestTopics, false);
  if (userInterestTopic) return userInterestTopic;

  const weeklyTrendKey = firstMatchingCanonicalKey(topicHint, context.weeklyTrendKeys, false);
  if (weeklyTrendKey) return weeklyTrendKey;

  const paradigmKey = firstMatchingCanonicalKey(topicHint, context.paradigmLabels, true);
  if (paradigmKey) return paradigmKey;

  return slugify(topicHint);
}

function canonicalizeExistingTopicKey(
  topicHint: string | undefined,
  context: ExternalTopicCanonicalizationContext,
): string | undefined {
  if (!topicHint || !slugify(topicHint)) return undefined;

  const userInterestTopic = firstMatchingCanonicalKey(topicHint, context.userInterestTopics, false);
  if (userInterestTopic) return userInterestTopic;

  const weeklyTrendKey = firstMatchingCanonicalKey(topicHint, context.weeklyTrendKeys, false);
  if (weeklyTrendKey) return weeklyTrendKey;

  return firstMatchingCanonicalKey(topicHint, context.paradigmLabels, true);
}

export function buildDirectionObservationCandidate(
  event: ExternalSignalEvent,
  context: ExternalTopicCanonicalizationContext,
): ObservationCandidate | undefined {
  if (event.target.target_type !== "topic") return undefined;
  const existingTopicKey = event.target.topic_key ?? canonicalizeExistingTopicKey(event.target.name, context);
  const providerTopicKey = event.target.topic_hint
    ? canonicalizeTopicKey(event.target.topic_hint, context)
    : undefined;
  const topicKey = existingTopicKey ?? providerTopicKey;
  if (!topicKey) return undefined;
  const hasDirectionLabels = event.direction_labels.length > 0;

  return {
    candidate_id: stableId("external-direction", {
      event_id: event.event_id,
      topic_key: topicKey,
    }),
    scope: "direction",
    candidate_kind: "direction_watch",
    target_key: `topic:${topicKey}`,
    display_name: event.target.name || topicKey,
    topic_key: topicKey,
    direction_labels: [...event.direction_labels],
    binding_confidence: "unbound",
    evidence_ids: [],
    evidence_summary_cn: "external direction observation; no explicit repo or paper binding yet.",
    qualification: "observe",
    can_enter_daily: false,
    can_enter_weekly: hasDirectionLabels,
    cannot_be_primary_conclusion: true,
    caveats: [
      "no explicit repo or paper binding yet",
      ...(hasDirectionLabels ? [] : ["missing_direction_labels"]),
    ],
  };
}

export function derivedSignalKindsForEvidence(event: ExternalSignalEvent): readonly [
  ExternalSignalKind,
  ...ExternalSignalKind[],
] {
  return event.derived_signal_kinds;
}
