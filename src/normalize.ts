import type {
  DataTrustLevel,
  MetricsSource,
  NormalizedProject,
  RawSignal,
  SignalSource,
  StarDeltaSource,
} from "./types.ts";
import { extractGitHubRepoFullName } from "./signal/githubMetrics.ts";

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function toDateOnly(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function latestTimestamp(signals: RawSignal[]): string {
  return signals.map((signal) => signal.timestamp).sort().at(-1) ?? new Date().toISOString();
}

function earliestTimestamp(signals: RawSignal[]): string {
  return signals.map((signal) => signal.timestamp).sort()[0] ?? new Date().toISOString();
}

function mergeSourceCounts(
  previous: Partial<Record<SignalSource, number>> | undefined,
  current: RawSignal[],
): Partial<Record<SignalSource, number>> {
  const next: Partial<Record<SignalSource, number>> = { ...(previous ?? {}) };
  for (const signal of current) {
    next[signal.source] = (next[signal.source] ?? 0) + 1;
  }
  return next;
}

function mergeAppearanceDates(previous: string[] | undefined, current: RawSignal[]): string[] {
  return uniq([...(previous ?? []), ...current.map((signal) => toDateOnly(signal.timestamp))]).sort();
}

function inferPersistenceState(appearanceDates: string[]): NormalizedProject["persistence_state"] {
  if (appearanceDates.length >= 4) return "persistent";
  if (appearanceDates.length >= 2) return "emerging";
  return "single-spike";
}

function dedupeRawSignals(previous: RawSignal[] | undefined, current: RawSignal[]): RawSignal[] {
  const byKey = new Map<string, RawSignal>();
  for (const signal of [...(previous ?? []), ...current]) {
    const key = `${signal.repo_url}::${signal.source}::${signal.timestamp}`;
    byKey.set(key, signal);
  }
  return [...byKey.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function maxOptional(values: Array<number | undefined>): number {
  const numeric = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return numeric.length > 0 ? Math.max(...numeric) : 0;
}

function finiteNumberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function metricsSourcePriority(source: MetricsSource): number {
  if (source === "github_api") return 5;
  if (source === "github_cache") return 4;
  if (source === "embedded") return 3;
  if (source === "github_html") return 2;
  return 1;
}

function starDeltaSourcePriority(source: StarDeltaSource | undefined): number {
  if (source === "github_live") return 4;
  if (source === "github_snapshot") return 3;
  if (source === "signal") return 2;
  return 1;
}

function inferredMetricsSource(signal: RawSignal): MetricsSource {
  return signal.metrics_source ??
    (signal.stars !== undefined || signal.forks !== undefined || signal.issues !== undefined || signal.PR !== undefined
      ? "embedded"
      : "unavailable");
}

function selectPrimaryMetricsSource(signals: RawSignal[], previous?: NormalizedProject): MetricsSource {
  const all = [...signals.map(inferredMetricsSource), previous?.metrics_source ?? "unavailable"];
  return all.sort((a, b) => metricsSourcePriority(b) - metricsSourcePriority(a))[0] ?? "unavailable";
}

function averageTrustScore(signals: RawSignal[], previous?: NormalizedProject): number {
  const scores = signals.map((signal) => {
    const trustScore = finiteNumberOrUndefined(signal.metrics_trust_score);
    return trustScore ?? (inferredMetricsSource(signal) === "embedded" ? 0.6 : 0);
  });
  const previousTrustScore = finiteNumberOrUndefined(previous?.metrics_trust_score);
  if (previousTrustScore !== undefined) scores.push(previousTrustScore);
  const numericScores = scores.filter((value): value is number => Number.isFinite(value));
  if (numericScores.length === 0) return 0;
  return Number((numericScores.reduce((sum, value) => sum + value, 0) / numericScores.length).toFixed(2));
}

function trustLevelFromScore(score: number): DataTrustLevel {
  if (score >= 0.85) return "high";
  if (score >= 0.55) return "medium";
  if (score > 0) return "low";
  return "unverified";
}

function trustFlags(
  primaryMetricsSource: MetricsSource,
  trustScore: number,
  starDeltaAvailable: boolean,
  stars: number,
  forks: number,
  issues: number,
  PR: number,
): string[] {
  const flags: string[] = [];
  if (primaryMetricsSource === "github_html") flags.push("html_metrics_fallback");
  if (primaryMetricsSource === "unavailable") flags.push("unverified_metrics");
  if (!starDeltaAvailable) flags.push("daily_delta_unavailable");
  if (stars > 0 && forks > stars) flags.push("fork_star_ratio_anomaly");
  if (stars > 0 && issues + PR > stars * 2) flags.push("activity_scale_anomaly");
  if (trustScore <= 0.3) flags.push("low_data_trust");
  return flags;
}

function descriptionQuality(signal: RawSignal): number {
  const description = signal.description?.trim() ?? "";
  if (!description) return -1;

  const noisy = looksLikeNoisyDescription(description);
  let score = descriptionTextQuality(description);
  if (description.includes(" ")) score += 10;
  if (signal.stars !== undefined || signal.forks !== undefined || signal.issues !== undefined || signal.PR !== undefined) {
    score += 20;
  }
  score += Math.min(signal.tags.length, noisy ? 2 : 6) * 5;
  return score;
}

function descriptionTextQuality(description: string): number {
  const trimmed = description.trim();
  if (!trimmed) return -1;

  const noisy = looksLikeNoisyDescription(trimmed);
  let score = noisy ? Math.min(trimmed.length, 80) : trimmed.length;
  if (!noisy) score += 40;
  if (!/\[[^\]]+\]\([^)]+\)/.test(trimmed) && !/https?:\/\//i.test(trimmed)) score += 20;
  if (/[.!?。！？]/.test(trimmed)) score += 10;
  if (noisy) score -= 220;
  return score;
}

function looksLikeNoisyDescription(description: string): boolean {
  return (
    /^\s*-\s*\[[^\]]+\]\(https:\/\/github\.com\//i.test(description) ||
    /\[[^\]]+\]\([^)]+\)/.test(description) ||
    /https?:\/\//i.test(description) ||
    /\|\s*\[/.test(description) ||
    /\*\*/.test(description) ||
    /[#][0-9]{2,}/.test(description)
  );
}

function pickBestDescription(signals: RawSignal[], previousDescription = ""): string {
  const bestSignalDescription = [...signals]
    .sort((a, b) => descriptionQuality(b) - descriptionQuality(a))
    .find((signal) => signal.description?.trim())?.description?.trim();

  if (!previousDescription.trim()) return bestSignalDescription ?? "";
  if (!bestSignalDescription) return previousDescription;

  const previousScore = descriptionTextQuality(previousDescription);
  const currentScore = descriptionQuality({
    project_name: "",
    repo_url: "",
    source: "manual",
    timestamp: "",
    tags: [],
    description: bestSignalDescription,
  });
  return currentScore >= previousScore ? bestSignalDescription : previousDescription;
}

function groupSignalsByRepo(signals: RawSignal[]): Map<string, RawSignal[]> {
  const grouped = new Map<string, RawSignal[]>();
  for (const signal of signals) {
    const repoFullName = extractGitHubRepoFullName(signal.repo_url);
    if (!repoFullName) continue;
    const key = repoFullName.toLowerCase();
    grouped.set(key, [...(grouped.get(key) ?? []), signal]);
  }
  return grouped;
}

function explicitDeltaSignals(signals: RawSignal[]): RawSignal[] {
  return signals.filter((signal) => signal.star_delta !== undefined && signal.star_delta_source !== "unavailable");
}

function bestDeltaSignals(signals: RawSignal[]): RawSignal[] {
  const deltaSignals = explicitDeltaSignals(signals);
  if (deltaSignals.length === 0) return [];
  const bestPriority = Math.max(...deltaSignals.map((signal) => starDeltaSourcePriority(signal.star_delta_source)));
  return deltaSignals.filter((signal) => starDeltaSourcePriority(signal.star_delta_source) === bestPriority);
}

function combinedSources(previous: NormalizedProject | undefined, group: RawSignal[]): SignalSource[] {
  return uniq([...(previous?.sources ?? []), ...group.map((signal) => signal.source)]) as SignalSource[];
}

function combinedTags(previous: NormalizedProject | undefined, group: RawSignal[]): string[] {
  return uniq([...(previous?.tags ?? []), ...group.flatMap((signal) => signal.tags)]);
}

function metricMax(group: RawSignal[], previousValue: number | undefined, field: "stars" | "forks" | "issues" | "PR"): number {
  return maxOptional([...group.map((signal) => signal[field]), previousValue]);
}

function starDeltaWeekly(previous: NormalizedProject | undefined, starDeltaDaily: number | undefined): number | undefined {
  const previousWeekly = previous?.star_delta_weekly;
  return starDeltaDaily !== undefined ? (previousWeekly ?? 0) + starDeltaDaily : previousWeekly;
}

function buildNormalizedProject(
  key: string,
  group: RawSignal[],
  previousByRepo: Map<string, NormalizedProject>,
): NormalizedProject {
  const repoFullName = extractGitHubRepoFullName(group[0]?.repo_url ?? "");
  const prev = previousByRepo.get(key);
  const uniqueGroup = dedupeRawSignals([], group);
  const mergedRawSignals = dedupeRawSignals(prev?.raw_signals, group);
  const deltaSignals = bestDeltaSignals(uniqueGroup);
  const starDeltaDaily = deltaSignals.length > 0 ? maxOptional(deltaSignals.map((signal) => signal.star_delta)) : undefined;
  const starDeltaSource = deltaSignals[0]?.star_delta_source ?? "unavailable";
  const appearanceDates = mergeAppearanceDates(prev?.appearance_dates, uniqueGroup);
  const stars = metricMax(uniqueGroup, prev?.stars, "stars");
  const forks = metricMax(uniqueGroup, prev?.forks, "forks");
  const issues = metricMax(uniqueGroup, prev?.issues, "issues");
  const PR = metricMax(uniqueGroup, prev?.PR, "PR");
  const metricsTrustScore = averageTrustScore(mergedRawSignals, prev);
  const primaryMetricsSource = selectPrimaryMetricsSource(mergedRawSignals, prev);
  const starDeltaAvailable = starDeltaDaily !== undefined;

  return {
    project_name: repoFullName,
    repo_url: `https://github.com/${repoFullName}`,
    repo_full_name: repoFullName,
    first_seen: prev?.first_seen ?? earliestTimestamp(group),
    last_seen: latestTimestamp(mergedRawSignals),
    sources: combinedSources(prev, uniqueGroup),
    source_counts: mergeSourceCounts(prev?.source_counts, uniqueGroup),
    appearances: appearanceDates.length,
    appearance_dates: appearanceDates,
    persistence_state: inferPersistenceState(appearanceDates),
    stars,
    star_delta_daily: starDeltaDaily,
    star_delta_weekly: starDeltaWeekly(prev, starDeltaDaily),
    star_delta_source: starDeltaSource,
    forks,
    issues,
    PR,
    tags: combinedTags(prev, uniqueGroup),
    description: pickBestDescription(mergedRawSignals, prev?.description ?? ""),
    metrics_source: primaryMetricsSource,
    metrics_trust_score: metricsTrustScore,
    data_trust: trustLevelFromScore(metricsTrustScore),
    star_delta_available: starDeltaAvailable,
    trust_flags: trustFlags(primaryMetricsSource, metricsTrustScore, starDeltaAvailable, stars, forks, issues, PR),
    raw_signals: mergedRawSignals,
  };
}

export function normalizeSignals(signals: RawSignal[], previous: NormalizedProject[] = []): NormalizedProject[] {
  const previousByRepo = new Map(previous.map((project) => [project.repo_full_name.toLowerCase(), project]));
  const grouped = groupSignalsByRepo(signals);

  return [...grouped.entries()]
    .map(([key, group]) => buildNormalizedProject(key, group, previousByRepo))
    .sort((a, b) => (b.star_delta_daily ?? 0) - (a.star_delta_daily ?? 0) || b.stars - a.stars);
}
