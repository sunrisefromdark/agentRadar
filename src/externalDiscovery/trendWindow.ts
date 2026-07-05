import fs from "node:fs";
import { externalAggregatePath } from "./paths.ts";
import { REDACTION_POLICY_VERSION, assertPublicSafeTrendWindow } from "./redaction.ts";
import type {
  DailyExternalAggregate,
  ExternalDiscussionTrendWindow,
  ExternalEvidence,
  ExternalEvidenceScope,
  ExternalNamedRegistryActor,
  ExternalPlatform,
  ExternalTrendBindingConfidence,
  ExternalTrendComponent,
  ExternalTrendComponentLevel,
  ExternalTrendCoverage,
  ExternalTrendDailyCount,
  ExternalTrendItem,
  ExternalTrendMomentum,
  ExternalTrendVerdict,
  ExternalWeeklyGateReason,
} from "./types.ts";

export type ExternalAggregateWindowReadResult =
  | { status: "loaded"; date: string; path: string; aggregate: DailyExternalAggregate }
  | { status: "missing"; date: string; path: string }
  | { status: "failed"; date: string; path: string; reason_code: string; reason_detail: string };

export interface BuildExternalDiscussionTrendWindowInput {
  anchorDate: string;
  generatedAt: string;
  aggregateResults?: ExternalAggregateWindowReadResult[];
}

const WEEKLY_GATE_REASONS: ExternalWeeklyGateReason[] = [
  "cross_platform_confirmation",
  "multi_actor_confirmation",
  "multi_day_persistence",
  "registry_tier_participation",
];

export function externalTrendWindowDates(anchorDate: string): string[] {
  const anchor = parseDateUtc(anchorDate);
  return Array.from({ length: 7 }, (_, index) => formatDateUtc(addDays(anchor, index - 6)));
}

export function readExternalAggregateWindow(anchorDate: string): ExternalAggregateWindowReadResult[] {
  return externalTrendWindowDates(anchorDate).map((date) => {
    const filepath = externalAggregatePath(date);
    if (!fs.existsSync(filepath)) {
      return { status: "missing", date, path: filepath };
    }
    try {
      const aggregate = JSON.parse(fs.readFileSync(filepath, "utf-8")) as DailyExternalAggregate;
      if (aggregate.schema_version !== "external-discovery.aggregate.v1") {
        return {
          status: "failed",
          date,
          path: filepath,
          reason_code: "window_aggregate_schema_mismatch",
          reason_detail: `unexpected schema_version ${String((aggregate as { schema_version?: unknown }).schema_version)}`,
        };
      }
      return { status: "loaded", date, path: filepath, aggregate };
    } catch (error) {
      return {
        status: "failed",
        date,
        path: filepath,
        reason_code: "window_aggregate_parse_failed",
        reason_detail: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

export function buildExternalDiscussionTrendWindow(input: BuildExternalDiscussionTrendWindowInput): ExternalDiscussionTrendWindow {
  const expectedDates = externalTrendWindowDates(input.anchorDate);
  const results = input.aggregateResults ?? readExternalAggregateWindow(input.anchorDate);
  const coverage = buildCoverage(expectedDates, results);
  const loadedAggregates = results
    .filter((result): result is Extract<ExternalAggregateWindowReadResult, { status: "loaded" }> => result.status === "loaded")
    .map((result) => result.aggregate);

  const audit: ExternalDiscussionTrendWindow["audit"] = {
    rejected_items: [],
    warnings: [],
  };

  if (coverage.usable_day_count < 3) {
    audit.warnings.push({
      reason_code: "window_usable_days_insufficient",
      reason_detail: `usable days ${coverage.usable_day_count}/7`,
    });
  }

  for (const missingDate of coverage.missing_dates) {
    audit.warnings.push({
      reason_code: "window_aggregate_missing",
      reason_detail: `missing aggregate for ${missingDate}`,
    });
  }
  for (const failedDate of coverage.failed_dates) {
    audit.warnings.push({
      reason_code: failedDate.reason_code,
      reason_detail: `${failedDate.date}: ${failedDate.reason_detail}`,
    });
  }

  const projectTrends = buildTrendItems("project", expectedDates, loadedAggregates, coverage, audit);
  const directionTrends = buildTrendItems("direction", expectedDates, loadedAggregates, coverage, audit);
  const status = windowStatus(coverage, loadedAggregates, projectTrends, directionTrends);
  const statusReason = windowStatusReason(status, coverage);

  const trendWindow: ExternalDiscussionTrendWindow = {
    schema_version: "external-discussion-trend-window.v1",
    anchor_date: input.anchorDate,
    window_start: expectedDates[0]!,
    window_end: expectedDates[expectedDates.length - 1]!,
    window_days: 7,
    generated_at: input.generatedAt,
    status,
    status_reason: statusReason,
    project_trends: projectTrends,
    direction_trends: directionTrends,
    coverage,
    audit,
    public_safe: true,
    redaction_policy_version: REDACTION_POLICY_VERSION,
    contains_raw_text: false,
    contains_profile_urls: false,
  };

  const safety = assertPublicSafeTrendWindow(trendWindow);
  if (!safety.ok) {
    throw new Error(`external discussion trend window is not public-safe: ${safety.reason_codes.join(",")}`);
  }

  return trendWindow;
}

export function buildSkippedExternalDiscussionTrendWindow(args: {
  anchorDate: string;
  generatedAt: string;
  statusReason: string;
}): ExternalDiscussionTrendWindow {
  const expectedDates = externalTrendWindowDates(args.anchorDate);
  return {
    schema_version: "external-discussion-trend-window.v1",
    anchor_date: args.anchorDate,
    window_start: expectedDates[0]!,
    window_end: expectedDates[expectedDates.length - 1]!,
    window_days: 7,
    generated_at: args.generatedAt,
    status: "skipped",
    status_reason: args.statusReason,
    project_trends: [],
    direction_trends: [],
    coverage: {
      expected_dates: expectedDates,
      loaded_dates: [],
      missing_dates: [],
      failed_dates: [],
      usable_day_count: 0,
      platform_counts: {},
      partial_platforms: [],
    },
    audit: {
      rejected_items: [],
      warnings: [{ reason_code: "external_trend_window_skipped", reason_detail: args.statusReason }],
    },
    public_safe: true,
    redaction_policy_version: REDACTION_POLICY_VERSION,
    contains_raw_text: false,
    contains_profile_urls: false,
  };
}

function buildCoverage(expectedDates: string[], results: ExternalAggregateWindowReadResult[]): ExternalTrendCoverage {
  const byDate = new Map(results.map((result) => [result.date, result] as const));
  const loadedDates: string[] = [];
  const missingDates: string[] = [];
  const failedDates: ExternalTrendCoverage["failed_dates"] = [];
  const platformCounts: Partial<Record<ExternalPlatform, number>> = {};
  const partialPlatforms = new Set<ExternalPlatform>();
  let usableDayCount = 0;

  for (const date of expectedDates) {
    const result = byDate.get(date);
    if (!result || result.status === "missing") {
      missingDates.push(date);
      continue;
    }
    if (result.status === "failed") {
      failedDates.push({
        date,
        reason_code: result.reason_code,
        reason_detail: result.reason_detail,
      });
      continue;
    }

    loadedDates.push(date);
    if (result.aggregate.status === "ok" || result.aggregate.status === "partial") {
      usableDayCount += 1;
    }
    if (result.aggregate.status === "failed") {
      failedDates.push({
        date,
        reason_code: "window_aggregate_failed_status",
        reason_detail: result.aggregate.status_reason ?? "aggregate status failed",
      });
    }
    if (result.aggregate.status === "partial") {
      for (const platform of Object.keys(result.aggregate.platform_counts) as ExternalPlatform[]) {
        partialPlatforms.add(platform);
      }
    }
    for (const [platform, count] of Object.entries(result.aggregate.platform_counts) as Array<[ExternalPlatform, number]>) {
      platformCounts[platform] = (platformCounts[platform] ?? 0) + count;
    }
  }

  return {
    expected_dates: expectedDates,
    loaded_dates: loadedDates,
    missing_dates: missingDates,
    failed_dates: failedDates,
    usable_day_count: usableDayCount,
    platform_counts: platformCounts,
    partial_platforms: [...partialPlatforms].sort(),
  };
}

function buildTrendItems(
  scope: ExternalEvidenceScope,
  expectedDates: string[],
  aggregates: DailyExternalAggregate[],
  coverage: ExternalTrendCoverage,
  audit: ExternalDiscussionTrendWindow["audit"],
): ExternalTrendItem[] {
  const evidenceByTarget = new Map<string, Array<{ date: string; evidence: ExternalEvidence }>>();
  for (const aggregate of aggregates) {
    const evidenceList = scope === "project" ? aggregate.project_evidence : aggregate.direction_evidence;
    for (const evidence of evidenceList) {
      const key = evidence.target_key.trim();
      if (!key) {
        audit.rejected_items.push({
          scope,
          reason_code: "trend_item_unstable_target_key",
          reason_detail: `empty target_key in aggregate ${aggregate.date}`,
        });
        continue;
      }
      evidenceByTarget.set(key, [...(evidenceByTarget.get(key) ?? []), { date: aggregate.date, evidence }]);
    }
  }

  return [...evidenceByTarget.entries()]
    .map(([targetKey, entries]) => trendItemFromEvidence(scope, targetKey, expectedDates, entries, coverage, audit))
    .filter((item): item is ExternalTrendItem => Boolean(item))
    .sort((left, right) => right.mention_count_total - left.mention_count_total || left.target_key.localeCompare(right.target_key));
}

function trendItemFromEvidence(
  scope: ExternalEvidenceScope,
  targetKey: string,
  expectedDates: string[],
  entries: Array<{ date: string; evidence: ExternalEvidence }>,
  coverage: ExternalTrendCoverage,
  audit: ExternalDiscussionTrendWindow["audit"],
): ExternalTrendItem | null {
  const stableTarget = isStableTargetKey(targetKey);
  if (!stableTarget) {
    audit.rejected_items.push({
      scope,
      target_key: targetKey,
      reason_code: scope === "direction" ? "direction_without_stable_topic_key" : "trend_item_unstable_target_key",
      reason_detail: "target_key is empty or contains unsupported whitespace/control characters",
    });
    return null;
  }

  const evidenceByDate = new Map(entries.map((entry) => [entry.date, entry.evidence] as const));
  const dailyCounts: ExternalTrendDailyCount[] = expectedDates
    .filter((date) => coverage.loaded_dates.includes(date))
    .map((date) => {
      const evidence = evidenceByDate.get(date);
      return {
        date,
        mention_count: evidence?.mention_count ?? 0,
        source_count: evidence ? unique(evidence.event_ids).length : 0,
        platform_count: evidence ? evidence.platforms.length : 0,
      };
    });
  const evidenceItems = entries.map((entry) => entry.evidence);
  const evidenceIds = unique(evidenceItems.map((evidence) => evidence.evidence_id)).sort();
  const sourceAggregateDates = unique(entries.map((entry) => entry.date)).sort();
  const platforms = unique(evidenceItems.flatMap((evidence) => evidence.platforms));
  const namedRegistryActors = mergeNamedRegistryActors(evidenceItems);
  const mentionCountTotal = evidenceItems.reduce((total, evidence) => total + evidence.mention_count, 0);
  const sourceCount = unique(evidenceItems.flatMap((evidence) => evidence.event_ids)).length;
  const activeDayCount = dailyCounts.filter((count) => count.mention_count > 0).length;
  const crossPlatformDays = dailyCounts.filter((count) => count.platform_count >= 2).length;
  const topTierActorCount = unique(namedRegistryActors.map((actor) => actor.entity_id)).length;
  const distinctActorCount = Math.max(0, ...evidenceItems.map((evidence) => evidence.distinct_actor_count));
  const officialSignal = platforms.includes("official_web") || platforms.includes("official_blog");
  const bindingConfidence = bindingConfidenceForTarget(scope, targetKey);
  const caveats: string[] = [];

  if (distinctActorCount > 0 && evidenceItems.length > 1) {
    caveats.push("distinct_actor_count uses conservative daily maximum because cross-evidence public actor identity is not always available");
  }
  if (bindingConfidence === "low" && scope === "direction") {
    caveats.push("direction-level signal is not bound to a specific repo, paper, or product");
  }
  if (bindingConfidence === "low" && scope === "project") {
    caveats.push("project trend target is not confidently bound to a canonical repo URL");
  }
  if (coverage.partial_platforms.length > 0) {
    caveats.push(`partial external window: ${coverage.partial_platforms.join(", ")}`);
  }

  const components = buildComponents({
    mentionCountTotal,
    activeDayCount,
    platformCount: platforms.length,
    crossPlatformDays,
    distinctActorCount,
    topTierActorCount,
    bindingConfidence,
    officialSignal,
    coverage,
    dailyCounts,
  });
  const momentum = momentumFor(dailyCounts, coverage.usable_day_count, mentionCountTotal, activeDayCount);
  const weeklyGateReasons = weeklyGateReasonsFor({
    platformCount: platforms.length,
    distinctActorCount,
    activeDayCount,
    topTierActorCount,
  });
  const weeklyGateMissingReasons = WEEKLY_GATE_REASONS.filter((reason) => !weeklyGateReasons.includes(reason));
  const verdict = verdictFor({
    scope,
    momentum,
    components,
    bindingConfidence,
    activeDayCount,
    platformCount: platforms.length,
    topTierActorCount,
    officialSignal,
    weeklyGateReasons,
  });
  const weeklyEligible = weeklyEligibleFor(scope, verdict, weeklyGateReasons);

  if (verdict === "noise_spike") {
    audit.rejected_items.push({
      scope,
      target_key: targetKey,
      reason_code: "trend_item_single_day_single_platform",
      reason_detail: `${targetKey} is treated as noise risk rather than weekly positive material`,
    });
  }
  if (namedRegistryActors.length === 0) {
    audit.warnings.push({
      reason_code: "named_actor_registry_empty",
      reason_detail: `${targetKey} has no public-safe named registry actor hit`,
    });
  }

  return {
    trend_id: `${scope}:${stableHashInput(targetKey)}`,
    scope,
    target_key: targetKey,
    display_name: displayNameForTarget(targetKey),
    target_url: targetUrlForTarget(targetKey),
    binding_confidence: bindingConfidence,
    official_signal: officialSignal,
    weekly_eligible: weeklyEligible,
    weekly_gate_reasons: weeklyGateReasons,
    weekly_gate_missing_reasons: weeklyGateMissingReasons,
    daily_counts: dailyCounts,
    mention_count_total: mentionCountTotal,
    source_count: sourceCount,
    active_day_count: activeDayCount,
    platform_count: platforms.length,
    cross_platform_days: crossPlatformDays,
    distinct_actor_count: distinctActorCount,
    top_tier_actor_count: topTierActorCount,
    named_registry_actors: namedRegistryActors,
    components,
    momentum,
    verdict,
    cannot_be_primary_conclusion: true,
    evidence_ids: evidenceIds,
    source_aggregate_dates: sourceAggregateDates,
    caveats,
  };
}

function buildComponents(args: {
  mentionCountTotal: number;
  activeDayCount: number;
  platformCount: number;
  crossPlatformDays: number;
  distinctActorCount: number;
  topTierActorCount: number;
  bindingConfidence: ExternalTrendBindingConfidence;
  officialSignal: boolean;
  coverage: ExternalTrendCoverage;
  dailyCounts: ExternalTrendDailyCount[];
}): ExternalTrendComponent[] {
  const maxDailyShare = maxDailyMentionShare(args.dailyCounts, args.mentionCountTotal);
  const noiseRisk = noiseRiskLevel({
    activeDayCount: args.activeDayCount,
    platformCount: args.platformCount,
    topTierActorCount: args.topTierActorCount,
    officialSignal: args.officialSignal,
    bindingConfidence: args.bindingConfidence,
    mentionCountTotal: args.mentionCountTotal,
    maxDailyShare,
    partialWindow: args.coverage.partial_platforms.length > 0 || args.coverage.failed_dates.length > 0,
  });

  return [
    {
      name: "discussion_volume",
      level: bucket(args.mentionCountTotal, [
        [0, "none"],
        [2, "low"],
        [5, "medium"],
      ]),
      evidence: [`mention_count_total=${args.mentionCountTotal}`],
    },
    {
      name: "persistence",
      level: args.activeDayCount === 0 ? "none" : args.activeDayCount === 1 ? "low" : args.activeDayCount <= 3 ? "medium" : "high",
      evidence: [`active_day_count=${args.activeDayCount}`],
    },
    {
      name: "cross_platform_confirmation",
      level: args.platformCount <= 1 ? "none" : args.crossPlatformDays >= 2 ? "high" : "medium",
      evidence: [`platform_count=${args.platformCount}`, `cross_platform_days=${args.crossPlatformDays}`],
    },
    {
      name: "actor_authority",
      level: args.topTierActorCount > 0 ? "high" : args.distinctActorCount >= 2 ? "medium" : args.distinctActorCount > 0 ? "low" : "none",
      evidence: [`distinct_actor_count=${args.distinctActorCount}`, `top_tier_actor_count=${args.topTierActorCount}`],
    },
    {
      name: "binding_confidence",
      level: bindingComponentLevel(args.bindingConfidence),
      evidence: [`binding_confidence=${args.bindingConfidence}`],
    },
    {
      name: "noise_risk",
      level: noiseRisk,
      evidence: [`max_daily_share=${maxDailyShare.toFixed(2)}`],
    },
  ];
}

function momentumFor(
  dailyCounts: ExternalTrendDailyCount[],
  usableDayCount: number,
  mentionCountTotal: number,
  activeDayCount: number,
): ExternalTrendMomentum {
  if (usableDayCount < 3 || mentionCountTotal < 2) return "insufficient";

  const maxDailyShare = maxDailyMentionShare(dailyCounts, mentionCountTotal);
  if (activeDayCount === 1 || maxDailyShare >= 0.7) return "spike";

  const early = dailyCounts.slice(0, 4);
  const late = dailyCounts.slice(4);
  if (early.length === 0 || late.length === 0) return "insufficient";

  const earlyAvg = sumMentions(early) / early.length;
  const lateAvg = sumMentions(late) / late.length;
  const lastTwoLoaded = dailyCounts.slice(-2);

  if (activeDayCount >= 2 && lateAvg >= Math.max(earlyAvg + 1, earlyAvg * 1.5)) return "rising";
  if (
    activeDayCount >= 2 &&
    earlyAvg >= Math.max(lateAvg + 1, lateAvg * 1.5) &&
    lastTwoLoaded.length === 2 &&
    lastTwoLoaded.every((count) => count.mention_count === 0)
  ) {
    return "fading";
  }
  if (activeDayCount >= 3 && maxDailyShare < 0.6) return "stable";
  return "insufficient";
}

function verdictFor(args: {
  scope: ExternalEvidenceScope;
  momentum: ExternalTrendMomentum;
  components: ExternalTrendComponent[];
  bindingConfidence: ExternalTrendBindingConfidence;
  activeDayCount: number;
  platformCount: number;
  topTierActorCount: number;
  officialSignal: boolean;
  weeklyGateReasons: ExternalWeeklyGateReason[];
}): ExternalTrendVerdict {
  if (args.momentum === "insufficient") return "insufficient";
  const noiseRisk = componentLevel(args.components, "noise_risk");
  if (noiseRisk === "high" && args.momentum === "spike") return "noise_spike";
  if (args.scope === "direction") {
    return args.weeklyGateReasons.length >= 2 && noiseRisk !== "high" ? "watch_signal" : "noise_spike";
  }
  if (
    args.bindingConfidence !== "none" &&
    args.activeDayCount >= 2 &&
    (args.platformCount >= 2 || args.topTierActorCount >= 1 || args.officialSignal)
  ) {
    return "external_reinforcement";
  }
  return noiseRisk === "high" ? "noise_spike" : "watch_signal";
}

function weeklyGateReasonsFor(args: {
  platformCount: number;
  distinctActorCount: number;
  activeDayCount: number;
  topTierActorCount: number;
}): ExternalWeeklyGateReason[] {
  const reasons: ExternalWeeklyGateReason[] = [];
  if (args.platformCount >= 2) reasons.push("cross_platform_confirmation");
  if (args.distinctActorCount >= 2) reasons.push("multi_actor_confirmation");
  if (args.activeDayCount >= 2) reasons.push("multi_day_persistence");
  if (args.topTierActorCount >= 1) reasons.push("registry_tier_participation");
  return reasons;
}

function weeklyEligibleFor(scope: ExternalEvidenceScope, verdict: ExternalTrendVerdict, reasons: ExternalWeeklyGateReason[]): boolean {
  if (scope === "project") return verdict === "external_reinforcement";
  return verdict === "watch_signal" && reasons.length >= 2;
}

function windowStatus(
  coverage: ExternalTrendCoverage,
  aggregates: DailyExternalAggregate[],
  projectTrends: ExternalTrendItem[],
  directionTrends: ExternalTrendItem[],
): ExternalDiscussionTrendWindow["status"] {
  if (coverage.loaded_dates.length === 0 && coverage.failed_dates.length > 0) return "failed";
  if (coverage.usable_day_count < 3) return "insufficient";
  if (
    coverage.failed_dates.length > 0 ||
    coverage.missing_dates.length > 0 ||
    coverage.partial_platforms.length > 0 ||
    aggregates.some((aggregate) => aggregate.status === "partial")
  ) {
    return "partial";
  }
  void projectTrends;
  void directionTrends;
  return "ok";
}

function windowStatusReason(status: ExternalDiscussionTrendWindow["status"], coverage: ExternalTrendCoverage): string | undefined {
  if (status === "failed") return "window_aggregate_parse_failed";
  if (status === "insufficient") return "window_usable_days_insufficient";
  if (status === "partial") {
    if (coverage.failed_dates.length > 0) return "window_aggregate_partial_failure";
    if (coverage.missing_dates.length > 0) return "window_aggregate_missing";
    if (coverage.partial_platforms.length > 0) return "window_platform_partial";
  }
  return undefined;
}

function mergeNamedRegistryActors(evidenceItems: ExternalEvidence[]): ExternalNamedRegistryActor[] {
  const byEntity = new Map<string, ExternalNamedRegistryActor>();
  for (const actor of evidenceItems.flatMap((evidence) => evidence.named_registry_actors)) {
    const existing = byEntity.get(actor.entity_id);
    if (!existing) {
      byEntity.set(actor.entity_id, { ...actor, platforms: [...actor.platforms], source_roles: [...actor.source_roles] });
      continue;
    }
    existing.event_count += actor.event_count;
    existing.platforms = unique([...existing.platforms, ...actor.platforms]).sort() as ExternalPlatform[];
    existing.source_roles = unique([...existing.source_roles, ...actor.source_roles]);
    existing.first_seen_at = existing.first_seen_at < actor.first_seen_at ? existing.first_seen_at : actor.first_seen_at;
    existing.last_seen_at = existing.last_seen_at > actor.last_seen_at ? existing.last_seen_at : actor.last_seen_at;
  }
  return [...byEntity.values()].sort((left, right) => right.event_count - left.event_count || left.display_name.localeCompare(right.display_name));
}

function bindingConfidenceForTarget(scope: ExternalEvidenceScope, targetKey: string): ExternalTrendBindingConfidence {
  if (!isStableTargetKey(targetKey)) return "none";
  if (scope === "direction") return "low";
  return isRepoLikeTarget(targetKey) ? "medium" : "low";
}

function bindingComponentLevel(confidence: ExternalTrendBindingConfidence): ExternalTrendComponentLevel {
  if (confidence === "high") return "high";
  if (confidence === "medium") return "medium";
  if (confidence === "low") return "low";
  return "none";
}

function noiseRiskLevel(args: {
  activeDayCount: number;
  platformCount: number;
  topTierActorCount: number;
  officialSignal: boolean;
  bindingConfidence: ExternalTrendBindingConfidence;
  mentionCountTotal: number;
  maxDailyShare: number;
  partialWindow: boolean;
}): ExternalTrendComponentLevel {
  if (args.mentionCountTotal === 0) return "high";
  if (
    (args.activeDayCount === 1 && args.platformCount === 1 && args.topTierActorCount === 0 && !args.officialSignal) ||
    args.bindingConfidence === "none" ||
    (args.mentionCountTotal >= 3 && args.maxDailyShare >= 0.8 && args.platformCount < 2)
  ) {
    return "high";
  }
  if (args.mentionCountTotal <= 2 || args.platformCount === 1 || args.bindingConfidence === "low" || args.partialWindow) {
    return "medium";
  }
  return "low";
}

function bucket(value: number, ranges: Array<[number, ExternalTrendComponentLevel]>): ExternalTrendComponentLevel {
  for (const [max, level] of ranges) {
    if (value <= max) return level;
  }
  return "high";
}

function componentLevel(components: ExternalTrendComponent[], name: ExternalTrendComponent["name"]): ExternalTrendComponentLevel {
  return components.find((component) => component.name === name)?.level ?? "none";
}

function maxDailyMentionShare(dailyCounts: ExternalTrendDailyCount[], total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, ...dailyCounts.map((count) => count.mention_count)) / total;
}

function sumMentions(counts: ExternalTrendDailyCount[]): number {
  return counts.reduce((total, count) => total + count.mention_count, 0);
}

function isStableTargetKey(targetKey: string): boolean {
  return targetKey.trim().length > 0 && !/[\r\n\t]/.test(targetKey);
}

function displayNameForTarget(targetKey: string): string {
  const repo = repoFullNameFromTarget(targetKey);
  if (repo) return repo;
  return targetKey.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || targetKey;
}

function targetUrlForTarget(targetKey: string): string | undefined {
  const repo = repoFullNameFromTarget(targetKey);
  return repo ? `https://github.com/${repo}` : undefined;
}

function isRepoLikeTarget(targetKey: string): boolean {
  return Boolean(repoFullNameFromTarget(targetKey));
}

function repoFullNameFromTarget(targetKey: string): string | undefined {
  const trimmed = targetKey.trim().replace(/\.git$/i, "");
  const githubMatch = /^https?:\/\/github\.com\/([^/\s]+\/[^/\s#?]+)/i.exec(trimmed);
  if (githubMatch) return githubMatch[1]!.toLowerCase();
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) return trimmed.toLowerCase();
  return undefined;
}

function stableHashInput(targetKey: string): string {
  return targetKey.trim().toLowerCase().replace(/[^a-z0-9._/-]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function parseDateUtc(date: string): Date {
  const parsed = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) throw new Error(`invalid date: ${date}`);
  return new Date(parsed);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
