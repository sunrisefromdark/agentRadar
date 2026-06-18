import fs from "node:fs";

import { externalAggregatePath } from "./paths.ts";
import { assertPublicSafeAggregate } from "./redaction.ts";
import {
  EXTERNAL_PLATFORMS,
  type DailyExternalAggregate,
  type ExternalDirectionLabel,
  type ExternalEvidence,
  type ExternalPlatform,
  type ObservationCandidate,
} from "./types.ts";
import type {
  WeeklyDirectionObservation,
  WeeklyExternalCoverageStatusCounts,
  WeeklyExternalCrossPlatformConfirmation,
  WeeklyExternalDirectionGate,
  WeeklyExternalDirectionGateAudit,
  WeeklyExternalDiscoveryArtifacts,
  WeeklyExternalDiscoveryDayStatus,
  WeeklyExternalDiscoveryWindow,
} from "../types.ts";

export interface ReadWeeklyExternalDiscoveryWindowOptions {
  disabled?: boolean;
  disabledReason?: string;
  aggregatePathForDate?: (date: string) => string;
}

interface TopicAccumulator {
  topic_key: string;
  display_name: string;
  evidence_ids: Set<string>;
  platforms: Set<ExternalPlatform>;
  dates: Set<string>;
  direction_labels: Set<ExternalDirectionLabel>;
  distinct_actor_count: number;
  registry_tier_actor_count: number;
  caveats: Set<string>;
}

const WEEKLY_DIRECTION_GATE_ORDER: WeeklyExternalDirectionGate[] = [
  "cross_platform_confirmation",
  "multi_actor_confirmation",
  "multi_day_persistence",
  "registry_tier_participation",
];

function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weeklyWindowDates(anchorDate: string): string[] {
  const anchor = parseDateOnly(anchorDate);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() - (6 - index));
    return formatDateOnly(date);
  });
}

function isUsableStatus(status: DailyExternalAggregate["status"]): boolean {
  return status === "ok" || status === "partial";
}

function safeStatusReason(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function disabledDayStatus(date: string, reason: string): WeeklyExternalDiscoveryDayStatus {
  return {
    date,
    aggregate_path: externalAggregatePath(date),
    status: "skipped",
    status_reason: reason,
    usable: false,
    event_count: 0,
    accepted_event_count: 0,
    rejected_event_count: 0,
  };
}

function missingDayStatus(date: string, aggregatePath: string): WeeklyExternalDiscoveryDayStatus {
  return {
    date,
    aggregate_path: aggregatePath,
    status: "skipped",
    status_reason: "aggregate_missing",
    usable: false,
    event_count: 0,
    accepted_event_count: 0,
    rejected_event_count: 0,
  };
}

function failedDayStatus(
  date: string,
  aggregatePath: string,
  reason: string,
): WeeklyExternalDiscoveryDayStatus {
  return {
    date,
    aggregate_path: aggregatePath,
    status: "failed",
    status_reason: reason,
    usable: false,
    event_count: 0,
    accepted_event_count: 0,
    rejected_event_count: 0,
  };
}

function aggregateDayStatus(
  aggregate: DailyExternalAggregate,
  aggregatePath: string,
): WeeklyExternalDiscoveryDayStatus {
  const usable = isUsableStatus(aggregate.status);
  return {
    date: aggregate.date,
    aggregate_path: aggregatePath,
    status: aggregate.status,
    status_reason: aggregate.status_reason,
    usable,
    source_input_hash: aggregate.source_input_hash,
    event_count: aggregate.event_count,
    accepted_event_count: aggregate.accepted_event_count,
    rejected_event_count: aggregate.rejected_event_count,
    public_safe: true,
  };
}

function coverageStatusCounts(
  aggregates: DailyExternalAggregate[],
): WeeklyExternalCoverageStatusCounts {
  const counts: WeeklyExternalCoverageStatusCounts = {};
  for (const aggregate of aggregates) {
    const coverage = aggregate.audit.coverage;
    if (!coverage) continue;
    for (const platform of EXTERNAL_PLATFORMS) {
      const status = coverage[platform]?.status;
      if (!status) continue;
      const platformCounts = counts[platform] ?? {};
      platformCounts[status] = (platformCounts[status] ?? 0) + 1;
      counts[platform] = platformCounts;
    }
  }
  return counts;
}

function windowStatus(
  dayStatuses: WeeklyExternalDiscoveryDayStatus[],
  disabled: boolean,
): Pick<WeeklyExternalDiscoveryWindow, "status" | "status_reason"> {
  if (disabled) return { status: "skipped", status_reason: "disabled_by_flag" };
  const usableCount = dayStatuses.filter((day) => day.usable).length;
  const failedCount = dayStatuses.filter((day) => day.status === "failed").length;
  if (usableCount === 7) return { status: "ok", status_reason: "all_aggregate_days_usable" };
  if (usableCount > 0) return { status: "partial", status_reason: "partial_aggregate_window" };
  if (failedCount > 0) return { status: "failed", status_reason: "no_usable_external_aggregate_days" };
  return { status: "skipped", status_reason: "no_external_aggregate_days" };
}

function readAggregate(date: string, aggregatePath: string): {
  aggregate?: DailyExternalAggregate;
  dayStatus: WeeklyExternalDiscoveryDayStatus;
  missing: boolean;
} {
  if (!fs.existsSync(aggregatePath)) {
    return { dayStatus: missingDayStatus(date, aggregatePath), missing: true };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(aggregatePath, "utf-8"));
  } catch {
    return { dayStatus: failedDayStatus(date, aggregatePath, "aggregate_invalid_json"), missing: false };
  }

  const publicSafe = assertPublicSafeAggregate(parsed);
  if (!publicSafe.ok) {
    return { dayStatus: failedDayStatus(date, aggregatePath, "aggregate_not_public_safe"), missing: false };
  }

  const aggregate = parsed as DailyExternalAggregate;
  if (aggregate.date !== date) {
    return { dayStatus: failedDayStatus(date, aggregatePath, "aggregate_date_mismatch"), missing: false };
  }

  return {
    aggregate,
    dayStatus: aggregateDayStatus(aggregate, aggregatePath),
    missing: false,
  };
}

export function readWeeklyExternalDiscoveryWindow(
  anchorDate: string,
  options: ReadWeeklyExternalDiscoveryWindowOptions = {},
): WeeklyExternalDiscoveryWindow {
  const dates = weeklyWindowDates(anchorDate);
  if (options.disabled) {
    const reason = options.disabledReason ?? "disabled_by_flag";
    const dayStatuses = dates.map((date) => disabledDayStatus(date, reason));
    return {
      provider: "agent-reach",
      window_start: dates[0] ?? anchorDate,
      window_end: dates[dates.length - 1] ?? anchorDate,
      status: "skipped",
      status_reason: reason,
      day_statuses: dayStatuses,
      usable_day_count: 0,
      missing_day_count: 0,
      failed_day_count: 0,
      skipped_day_count: dayStatuses.length,
      aggregate_paths: dayStatuses.map((day) => day.aggregate_path),
      aggregates: [],
      coverage_status_counts: {},
    };
  }

  const dayStatuses: WeeklyExternalDiscoveryDayStatus[] = [];
  const aggregates: DailyExternalAggregate[] = [];
  let missingDayCount = 0;
  const aggregatePaths: string[] = [];

  for (const date of dates) {
    const aggregatePath = options.aggregatePathForDate?.(date) ?? externalAggregatePath(date);
    aggregatePaths.push(aggregatePath);
    const result = readAggregate(date, aggregatePath);
    dayStatuses.push(result.dayStatus);
    if (result.missing) missingDayCount += 1;
    if (result.aggregate) aggregates.push(result.aggregate);
  }

  const status = windowStatus(dayStatuses, false);
  return {
    provider: "agent-reach",
    window_start: dates[0] ?? anchorDate,
    window_end: dates[dates.length - 1] ?? anchorDate,
    ...status,
    day_statuses: dayStatuses,
    usable_day_count: dayStatuses.filter((day) => day.usable).length,
    missing_day_count: missingDayCount,
    failed_day_count: dayStatuses.filter((day) => day.status === "failed").length,
    skipped_day_count: dayStatuses.filter((day) => day.status === "skipped").length,
    aggregate_paths: aggregatePaths,
    aggregates,
    coverage_status_counts: coverageStatusCounts(aggregates),
  };
}

function isUsableAggregate(aggregate: DailyExternalAggregate): boolean {
  return isUsableStatus(aggregate.status);
}

function topicKeyFromTargetKey(targetKey: string): string {
  return targetKey.startsWith("topic:") ? targetKey.slice("topic:".length) : targetKey;
}

function topicKeyForEvidence(evidence: ExternalEvidence): string | undefined {
  if (evidence.scope !== "direction") return undefined;
  if (evidence.direction_labels.length === 0) return undefined;
  const topicKey = topicKeyFromTargetKey(evidence.target_key).trim();
  return topicKey.length > 0 ? topicKey : undefined;
}

function topicKeyForCandidate(candidate: ObservationCandidate): string | undefined {
  if (candidate.scope !== "direction" || !candidate.can_enter_weekly) return undefined;
  if (candidate.direction_labels.length === 0) return undefined;
  return candidate.topic_key?.trim() || topicKeyFromTargetKey(candidate.target_key).trim() || undefined;
}

function getOrCreateTopic(
  topics: Map<string, TopicAccumulator>,
  topicKey: string,
): TopicAccumulator {
  const existing = topics.get(topicKey);
  if (existing) return existing;
  const topic: TopicAccumulator = {
    topic_key: topicKey,
    display_name: topicKey,
    evidence_ids: new Set(),
    platforms: new Set(),
    dates: new Set(),
    direction_labels: new Set(),
    distinct_actor_count: 0,
    registry_tier_actor_count: 0,
    caveats: new Set(),
  };
  topics.set(topicKey, topic);
  return topic;
}

function addEvidenceToTopic(topic: TopicAccumulator, aggregate: DailyExternalAggregate, evidence: ExternalEvidence): void {
  topic.evidence_ids.add(evidence.evidence_id);
  topic.dates.add(aggregate.date);
  for (const platform of evidence.platforms) topic.platforms.add(platform);
  for (const label of evidence.direction_labels) topic.direction_labels.add(label);
  // Public aggregates do not carry actor identities, so do not sum across days.
  topic.distinct_actor_count = Math.max(topic.distinct_actor_count, evidence.distinct_actor_count);
  topic.registry_tier_actor_count = Math.max(
    topic.registry_tier_actor_count,
    (evidence.actor_tiers.core ?? 0) +
      (evidence.actor_tiers.proven ?? 0) +
      (evidence.actor_tiers.watch ?? 0),
  );
  for (const caveat of evidence.caveats) topic.caveats.add(caveat);
}

function collectDirectionTopics(aggregates: DailyExternalAggregate[]): Map<string, TopicAccumulator> {
  const topics = new Map<string, TopicAccumulator>();
  for (const aggregate of aggregates.filter(isUsableAggregate)) {
    for (const candidate of aggregate.observation_candidates) {
      const topicKey = topicKeyForCandidate(candidate);
      if (!topicKey) continue;
      const topic = getOrCreateTopic(topics, topicKey);
      topic.display_name = candidate.display_name;
      for (const label of candidate.direction_labels) topic.direction_labels.add(label);
      for (const evidenceId of candidate.evidence_ids) topic.evidence_ids.add(evidenceId);
      for (const caveat of candidate.caveats) topic.caveats.add(caveat);
    }

    for (const evidence of aggregate.direction_evidence) {
      const topicKey = topicKeyForEvidence(evidence);
      if (!topicKey) continue;
      addEvidenceToTopic(getOrCreateTopic(topics, topicKey), aggregate, evidence);
    }
  }
  return topics;
}

function satisfiedGates(topic: TopicAccumulator): WeeklyExternalDirectionGate[] {
  const gateSet = new Set<WeeklyExternalDirectionGate>();
  if (topic.platforms.size >= 2) gateSet.add("cross_platform_confirmation");
  if (topic.distinct_actor_count >= 2) gateSet.add("multi_actor_confirmation");
  if (topic.dates.size >= 2) gateSet.add("multi_day_persistence");
  if (topic.registry_tier_actor_count >= 1) gateSet.add("registry_tier_participation");
  return WEEKLY_DIRECTION_GATE_ORDER.filter((gate) => gateSet.has(gate));
}

function buildDirectionObservation(
  topic: TopicAccumulator,
  gates: WeeklyExternalDirectionGate[],
): WeeklyDirectionObservation {
  const platforms = [...topic.platforms].sort();
  const evidenceIds = [...topic.evidence_ids].sort();
  return {
    topic_key: topic.topic_key,
    display_name: topic.display_name,
    direction_labels: [...topic.direction_labels].sort(),
    evidence_ids: evidenceIds,
    satisfied_gates: gates,
    gate_count: gates.length,
    platforms,
    active_day_count: topic.dates.size,
    distinct_actor_count: topic.distinct_actor_count,
    registry_tier_actor_count: topic.registry_tier_actor_count,
    cannot_be_primary_conclusion: true,
    evidence_summary_cn: `External direction evidence met ${gates.length} weekly gate(s) and remains secondary.`,
    caveats: [
      "external direction observation cannot become a primary conclusion",
      "external cross-platform confirmation is not primary-source multi-source confirmation",
      ...[...topic.caveats].sort(),
    ],
  };
}

function buildGateAudit(
  topic: TopicAccumulator,
  gates: WeeklyExternalDirectionGate[],
  reason: WeeklyExternalDirectionGateAudit["reason"],
): WeeklyExternalDirectionGateAudit {
  return {
    topic_key: topic.topic_key,
    display_name: topic.display_name,
    satisfied_gates: gates,
    gate_count: gates.length,
    evidence_ids: [...topic.evidence_ids].sort(),
    reason,
    cannot_be_primary_conclusion: true,
  };
}

function buildCrossPlatformConfirmation(
  observation: WeeklyDirectionObservation,
): WeeklyExternalCrossPlatformConfirmation | undefined {
  if (!observation.satisfied_gates.includes("cross_platform_confirmation")) return undefined;
  return {
    topic_key: observation.topic_key,
    platforms: observation.platforms,
    evidence_ids: observation.evidence_ids,
    not_primary_source_confirmation: true,
    cannot_be_primary_conclusion: true,
  };
}

function mergeDirectionLabelCounts(
  aggregates: DailyExternalAggregate[],
): Partial<Record<ExternalDirectionLabel, number>> {
  const counts: Partial<Record<ExternalDirectionLabel, number>> = {};
  for (const aggregate of aggregates.filter(isUsableAggregate)) {
    for (const [label, count] of Object.entries(aggregate.direction_label_counts) as Array<
      [ExternalDirectionLabel, number | undefined]
    >) {
      if (typeof count === "number" && count > 0) {
        counts[label] = (counts[label] ?? 0) + count;
      }
    }
  }
  return counts;
}

export function buildWeeklyExternalDiscoveryArtifacts(
  window: WeeklyExternalDiscoveryWindow,
): WeeklyExternalDiscoveryArtifacts {
  const topics = collectDirectionTopics(window.aggregates);
  const weeklyDirectionObservations: WeeklyDirectionObservation[] = [];
  const directionGateAudit: WeeklyExternalDirectionGateAudit[] = [];

  for (const topic of [...topics.values()].sort((left, right) => left.topic_key.localeCompare(right.topic_key))) {
    const gates = satisfiedGates(topic);
    const accepted = gates.length >= 2;
    directionGateAudit.push(buildGateAudit(topic, gates, accepted ? "accepted" : "insufficient_gate_count"));
    if (accepted) weeklyDirectionObservations.push(buildDirectionObservation(topic, gates));
  }

  const externalCrossPlatformConfirmations = weeklyDirectionObservations
    .map(buildCrossPlatformConfirmation)
    .filter((item): item is WeeklyExternalCrossPlatformConfirmation => Boolean(item));

  return {
    external_discovery_window: window,
    direction_label_counts: mergeDirectionLabelCounts(window.aggregates),
    weekly_direction_observations: weeklyDirectionObservations,
    external_project_evidence_summaries: window.aggregates
      .filter(isUsableAggregate)
      .flatMap((aggregate) => aggregate.project_evidence),
    external_cross_platform_confirmations: externalCrossPlatformConfirmations,
    direction_gate_audit: directionGateAudit,
  };
}
