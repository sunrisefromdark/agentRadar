import type { DataTrustLevel, NormalizedProject } from "../types.ts";

/**
 * 这一层只放“项目事实读取”和“轻量语义判断”。
 * 目的不是做评分，而是把后续各层共用的基础判断统一起来，
 * 避免在 confidence / risks / components 里各自拷一套 if 逻辑。
 */

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function haystack(project: NormalizedProject): string {
  return `${project.project_name} ${project.description} ${project.tags.join(" ")}`.toLowerCase();
}

export function hasAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function finiteNumberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function hasStructuredMetrics(project: NormalizedProject): boolean {
  return project.stars > 0 || project.forks > 0 || project.issues > 0 || project.PR > 0;
}

export function signalHasStructuredMetrics(signal: NormalizedProject["raw_signals"][number]): boolean {
  return signal.stars !== undefined || signal.forks !== undefined || signal.issues !== undefined || signal.PR !== undefined;
}

export function metricsSource(project: NormalizedProject): NormalizedProject["metrics_source"] {
  return project.metrics_source ?? "unavailable";
}

export function metricsTrustMultiplier(project: NormalizedProject): number {
  const source = metricsSource(project);
  if (source === "github_api") return 1;
  if (source === "github_cache") return 0.7;
  if (source === "embedded") return 0.6;
  if (source === "github_html") return 0.3;
  return 0;
}

export function metricsTrustScore(project: NormalizedProject): number {
  const trustScore = finiteNumberOrUndefined(project.metrics_trust_score);
  if (trustScore !== undefined) return trustScore;
  return metricsSource(project) === "embedded" ? 0.6 : 0;
}

export function dataTrust(project: NormalizedProject): DataTrustLevel {
  const trustScore = metricsTrustScore(project);
  if (project.data_trust) return project.data_trust;
  if (trustScore >= 0.85) return "high";
  if (trustScore >= 0.55) return "medium";
  if (trustScore > 0) return "low";
  return "unverified";
}

export function starDeltaAvailable(project: NormalizedProject): boolean {
  return project.star_delta_available ?? project.star_delta_daily !== undefined;
}

export function trustFlags(project: NormalizedProject): string[] {
  return project.trust_flags ?? [];
}

export function hasSparseEvidence(project: NormalizedProject): boolean {
  return !project.description && !hasStructuredMetrics(project);
}

export function hasDetailedDescription(project: NormalizedProject): boolean {
  return project.description.trim().length >= 60;
}

export function hasVeryDetailedDescription(project: NormalizedProject): boolean {
  return project.description.trim().length >= 120;
}

export function structuredSignalCount(project: NormalizedProject): number {
  return project.raw_signals.filter(signalHasStructuredMetrics).length;
}

export function semanticTagStrength(project: NormalizedProject): number {
  return new Set(project.tags.filter((tag) => tag.trim())).size;
}

export function withinSourceCorroboration(project: NormalizedProject): number {
  return Object.values(project.source_counts).reduce((max, count) => Math.max(max, count ?? 0), 0);
}
