import type { MetricsSource, RawSignal, SignalSource, StarDeltaSource } from "../types.ts";

const VALID_SOURCES = new Set<SignalSource>([
  "agents-radar",
  "trendshift",
  "github_trending",
  "github_live_star_delta",
  "watchlist_live_activity",
  "manual",
]);
const VALID_METRICS_SOURCES = new Set<MetricsSource>([
  "embedded",
  "github_api",
  "github_html",
  "github_cache",
  "unavailable",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function throwValidationError(index: number, field: string, reason: string): never {
  throw new RawSignalValidationError(index, field, reason);
}

function ensureNonEmptyString(
  value: Record<string, unknown>,
  field: "project_name" | "repo_url",
  index: number,
): asserts value is Record<string, unknown> & Record<typeof field, string> {
  if (typeof value[field] !== "string" || value[field].trim().length === 0) {
    throwValidationError(index, field, "must be a non-empty string");
  }
}

function ensureSource(
  value: Record<string, unknown>,
  index: number,
): asserts value is Record<string, unknown> & { source: SignalSource } {
  if (typeof value.source !== "string" || !VALID_SOURCES.has(value.source as SignalSource)) {
    throwValidationError(
      index,
      "source",
      'must be one of "agents-radar", "trendshift", "github_trending", "github_live_star_delta", "watchlist_live_activity", or "manual"',
    );
  }
}

function ensureTimestamp(value: Record<string, unknown>, index: number): asserts value is Record<string, unknown> & { timestamp: string } {
  if (typeof value.timestamp !== "string" || Number.isNaN(Date.parse(value.timestamp))) {
    throwValidationError(index, "timestamp", "must be a valid datetime string");
  }
}

function ensureTags(value: Record<string, unknown>, index: number): asserts value is Record<string, unknown> & { tags: string[] } {
  if (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== "string")) {
    throwValidationError(index, "tags", "must be a string array");
  }
}

function ensureOptionalString(value: Record<string, unknown>, field: "description", index: number): void {
  if (value[field] !== undefined && typeof value[field] !== "string") {
    throwValidationError(index, field, "must be a string when present");
  }
}

function ensureMetricsSource(
  value: Record<string, unknown>,
  index: number,
): asserts value is Record<string, unknown> & { metrics_source?: MetricsSource } {
  if (
    value.metrics_source !== undefined &&
    (typeof value.metrics_source !== "string" || !VALID_METRICS_SOURCES.has(value.metrics_source as MetricsSource))
  ) {
    throwValidationError(index, "metrics_source", "must be a known metrics source when present");
  }
}

function ensureMetricsTrustScore(value: Record<string, unknown>, index: number): void {
  const score = value.metrics_trust_score;
  if (
    score !== undefined &&
    (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1)
  ) {
    throwValidationError(index, "metrics_trust_score", "must be a number between 0 and 1 when present");
  }
}

function ensureStarDeltaSource(value: Record<string, unknown>, index: number): void {
  if (
    value.star_delta_source !== undefined &&
    value.star_delta_source !== "signal" &&
    value.star_delta_source !== "unavailable" &&
    value.star_delta_source !== "github_live" &&
    value.star_delta_source !== "github_snapshot"
  ) {
    throwValidationError(index, "star_delta_source", 'must be one of "github_live", "github_snapshot", "signal", or "unavailable" when present');
  }
}

function ensureStarDeltaWindow(value: Record<string, unknown>, index: number): void {
  if (value.star_delta_window === undefined) return;
  if (!isPlainObject(value.star_delta_window)) {
    throwValidationError(index, "star_delta_window", "must be an object when present");
  }

  const window = value.star_delta_window as Record<string, unknown>;
  if (typeof window.since !== "string" || Number.isNaN(Date.parse(window.since))) {
    throwValidationError(index, "star_delta_window.since", "must be a valid datetime string when present");
  }
  if (typeof window.until !== "string" || Number.isNaN(Date.parse(window.until))) {
    throwValidationError(index, "star_delta_window.until", "must be a valid datetime string when present");
  }
}

function ensureOptionalNumberField(value: Record<string, unknown>, field: "stars" | "star_delta" | "forks" | "issues" | "PR", index: number): void {
  if (!isOptionalNumber(value[field])) {
    throwValidationError(index, field, "must be a non-negative number when present");
  }
}

function normalizeRawSignal(value: Record<string, unknown>): RawSignal {
  return {
    project_name: value.project_name as string,
    repo_url: value.repo_url as string,
    source: value.source as SignalSource,
    timestamp: value.timestamp as string,
    stars: value.stars as number | undefined,
    star_delta: value.star_delta as number | undefined,
    forks: value.forks as number | undefined,
    issues: value.issues as number | undefined,
    PR: value.PR as number | undefined,
    tags: value.tags as string[],
    description: value.description as string | undefined,
    metrics_source: value.metrics_source as RawSignal["metrics_source"],
    metrics_trust_score: value.metrics_trust_score as number | undefined,
    star_delta_source: value.star_delta_source as StarDeltaSource | undefined,
    star_delta_window: value.star_delta_window as RawSignal["star_delta_window"],
  };
}

/**
 * RawSignal 是所有后续评分和报告的共同入口。
 * 这里的校验要尽量把“字段语义错误”在最前面拦住，避免脏数据继续扩散到 normalize / scoring。
 */
export class RawSignalValidationError extends Error {
  constructor(
    readonly index: number,
    readonly field: string,
    readonly reason: string,
  ) {
    super(`Invalid RawSignal at index ${index}: ${field} ${reason}`);
    this.name = "RawSignalValidationError";
  }
}

export function validateRawSignal(value: unknown, index = 0): RawSignal {
  if (!isPlainObject(value)) {
    throwValidationError(index, "root", `must be an object, got ${describeValue(value)}`);
  }

  ensureNonEmptyString(value, "project_name", index);
  ensureNonEmptyString(value, "repo_url", index);
  ensureSource(value, index);
  ensureTimestamp(value, index);
  ensureTags(value, index);
  ensureOptionalString(value, "description", index);
  ensureMetricsSource(value, index);
  ensureMetricsTrustScore(value, index);
  ensureStarDeltaSource(value, index);
  ensureStarDeltaWindow(value, index);
  ensureOptionalNumberField(value, "stars", index);
  ensureOptionalNumberField(value, "star_delta", index);
  ensureOptionalNumberField(value, "forks", index);
  ensureOptionalNumberField(value, "issues", index);
  ensureOptionalNumberField(value, "PR", index);

  return normalizeRawSignal(value);
}

export function validateRawSignals(values: unknown[]): RawSignal[] {
  return values.map((value, index) => validateRawSignal(value, index));
}
