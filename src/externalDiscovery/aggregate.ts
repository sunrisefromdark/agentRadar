import { writeJsonFile } from "../storage/files.ts";
import type { AgentReachProviderResult } from "./agentReachProvider.ts";
import { externalAggregateLatestPath, externalAggregatePath } from "./paths.ts";
import { assertPublicSafeAggregate, stableSourceInputHash } from "./redaction.ts";
import type {
  DailyExternalAggregate,
  ExternalEvidence,
  ExternalDiscoveryCoverage,
  ExternalPlatform,
  ExternalPlatformCoverage,
  ExternalSignalEvent,
  ExternalSignalKind,
  ObservationCandidate,
} from "./types.ts";

export const EXTERNAL_AGGREGATE_SCHEMA_VERSION = "external-discovery.aggregate.v1";
export const EXTERNAL_REDACTION_POLICY_VERSION = "external-discovery-redaction.v1";
export const SOURCE_INPUT_HASH_ABSENCE_MARKER_WARNING = "source_input_hash_absence_marker";

export interface BuildDailyExternalAggregateInput {
  date: string;
  generatedAt?: string;
  providerResult: AgentReachProviderResult;
  projectEvidence?: ExternalEvidence[];
  directionEvidence?: ExternalEvidence[];
  observationCandidates?: ObservationCandidate[];
  warnings?: string[];
}

export interface WriteDailyExternalAggregateOptions {
  dryRun?: boolean;
  aggregatePath?: string;
  latestPath?: string;
}

export interface WriteDailyExternalAggregateResult {
  aggregate_path: string;
  latest_path: string;
  planned_writes: string[];
  written_paths: string[];
  dry_run: boolean;
}

function countValues<T extends string>(values: Iterable<T>): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function derivedSignalKinds(events: ExternalSignalEvent[]): ExternalSignalKind[] {
  return events.flatMap((event) => [...event.derived_signal_kinds]);
}

function directionLabels(events: ExternalSignalEvent[]) {
  return events.flatMap((event) => [...event.direction_labels]);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function sanitizeEvidence(evidence: ExternalEvidence): ExternalEvidence {
  return {
    evidence_id: evidence.evidence_id,
    event_ids: [...evidence.event_ids],
    scope: evidence.scope,
    target_key: evidence.target_key,
    derived_signal_kinds: evidence.derived_signal_kinds,
    direction_labels: [...evidence.direction_labels],
    platforms: [...evidence.platforms],
    actor_tiers: { ...evidence.actor_tiers },
    actor_types: { ...evidence.actor_types },
    mention_count: evidence.mention_count,
    distinct_actor_count: evidence.distinct_actor_count,
    first_seen_at: evidence.first_seen_at,
    last_seen_at: evidence.last_seen_at,
    active_day_count: evidence.active_day_count,
    cross_platform: evidence.cross_platform,
    authority_summary_cn: evidence.authority_summary_cn,
    intensity_summary_cn: evidence.intensity_summary_cn,
    persistence_summary_cn: evidence.persistence_summary_cn,
    caveats: [...evidence.caveats],
  };
}

function sanitizeCandidate(candidate: ObservationCandidate): ObservationCandidate {
  return {
    candidate_id: candidate.candidate_id,
    scope: candidate.scope,
    candidate_kind: candidate.candidate_kind,
    target_key: candidate.target_key,
    display_name: candidate.display_name,
    ...(candidate.repo_url ? { repo_url: candidate.repo_url } : {}),
    ...(candidate.paper_url ? { paper_url: candidate.paper_url } : {}),
    ...(candidate.topic_key ? { topic_key: candidate.topic_key } : {}),
    direction_labels: [...candidate.direction_labels],
    binding_confidence: candidate.binding_confidence,
    evidence_ids: [...candidate.evidence_ids],
    evidence_summary_cn: candidate.evidence_summary_cn,
    qualification: candidate.qualification,
    can_enter_daily: candidate.can_enter_daily,
    can_enter_weekly: candidate.can_enter_weekly,
    cannot_be_primary_conclusion: true,
    caveats: [...candidate.caveats],
  };
}

function sanitizeCoverage(coverage: ExternalDiscoveryCoverage): ExternalDiscoveryCoverage {
  const sanitized: ExternalDiscoveryCoverage = {};
  for (const [platform, platformCoverage] of Object.entries(coverage) as Array<
    [ExternalPlatform, ExternalPlatformCoverage]
  >) {
    sanitized[platform] = {
      status: platformCoverage.status,
      ...(platformCoverage.reason ? { reason: platformCoverage.reason } : {}),
      ...(platformCoverage.warnings ? { warnings: [...platformCoverage.warnings] } : {}),
    };
  }
  return sanitized;
}

export function buildSourceInputAbsenceMarkerHash(input: {
  provider: AgentReachProviderResult["provider"];
  date: string;
  source_input_ref: string;
  status: AgentReachProviderResult["status"];
  status_reason: string;
}): string {
  return stableSourceInputHash(JSON.stringify(input));
}

function sourceInputHashForAggregate(
  date: string,
  providerResult: AgentReachProviderResult,
): { sourceInputHash: string; warnings: string[]; hasRawBytesHash: boolean } {
  if (providerResult.source_input_hash) {
    return {
      sourceInputHash: providerResult.source_input_hash,
      warnings: [],
      hasRawBytesHash: true,
    };
  }

  return {
    sourceInputHash: buildSourceInputAbsenceMarkerHash({
      provider: providerResult.provider,
      date,
      source_input_ref: providerResult.source_input_ref,
      status: providerResult.status,
      status_reason: providerResult.status_reason,
    }),
    warnings: [SOURCE_INPUT_HASH_ABSENCE_MARKER_WARNING],
    hasRawBytesHash: false,
  };
}

export function buildDailyExternalAggregate(
  input: BuildDailyExternalAggregateInput,
): DailyExternalAggregate {
  const { providerResult } = input;
  const { sourceInputHash, warnings: sourceHashWarnings, hasRawBytesHash } =
    sourceInputHashForAggregate(input.date, providerResult);
  const acceptedEventCount = providerResult.events.length;
  const rejectedEventCount = hasRawBytesHash ? providerResult.rejected_events.length : 0;
  const aggregate: DailyExternalAggregate = {
    schema_version: EXTERNAL_AGGREGATE_SCHEMA_VERSION,
    date: input.date,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    provider: providerResult.provider,
    ...(providerResult.provider_run_id ? { provider_run_id: providerResult.provider_run_id } : {}),
    status: providerResult.status,
    status_reason: providerResult.status_reason,
    source_input_hash: sourceInputHash,
    public_safe: true,
    redaction_policy_version: EXTERNAL_REDACTION_POLICY_VERSION,
    contains_raw_text: false,
    contains_profile_urls: false,
    event_count: acceptedEventCount + rejectedEventCount,
    accepted_event_count: acceptedEventCount,
    rejected_event_count: rejectedEventCount,
    platform_counts: countValues(providerResult.events.map((event) => event.platform as ExternalPlatform)),
    derived_signal_kind_counts: countValues(derivedSignalKinds(providerResult.events)),
    direction_label_counts: countValues(directionLabels(providerResult.events)),
    project_evidence: (input.projectEvidence ?? []).map(sanitizeEvidence),
    direction_evidence: (input.directionEvidence ?? []).map(sanitizeEvidence),
    observation_candidates: (input.observationCandidates ?? []).map(sanitizeCandidate),
    audit: {
      ...(providerResult.coverage ? { coverage: sanitizeCoverage(providerResult.coverage) } : {}),
      rejected_events: providerResult.rejected_events.map((event) => ({ ...event })),
      warnings: uniqueStrings([
        ...providerResult.warnings,
        ...(input.warnings ?? []),
        ...sourceHashWarnings,
      ]),
    },
  };

  const publicSafeCheck = assertPublicSafeAggregate(aggregate);
  if (!publicSafeCheck.ok) {
    throw new Error(`external aggregate is not public-safe: ${publicSafeCheck.errors.join("; ")}`);
  }

  return aggregate;
}

export function writeDailyExternalAggregate(
  aggregate: DailyExternalAggregate,
  options: WriteDailyExternalAggregateOptions = {},
): WriteDailyExternalAggregateResult {
  const publicSafeCheck = assertPublicSafeAggregate(aggregate);
  if (!publicSafeCheck.ok) {
    throw new Error(`external aggregate is not public-safe: ${publicSafeCheck.errors.join("; ")}`);
  }

  const aggregatePath = options.aggregatePath ?? externalAggregatePath(aggregate.date);
  const latestPath = options.latestPath ?? externalAggregateLatestPath();
  const plannedWrites = [aggregatePath, latestPath];
  if (options.dryRun) {
    return {
      aggregate_path: aggregatePath,
      latest_path: latestPath,
      planned_writes: plannedWrites,
      written_paths: [],
      dry_run: true,
    };
  }

  writeJsonFile(aggregatePath, aggregate);
  writeJsonFile(latestPath, aggregate);
  return {
    aggregate_path: aggregatePath,
    latest_path: latestPath,
    planned_writes: plannedWrites,
    written_paths: plannedWrites,
    dry_run: false,
  };
}
