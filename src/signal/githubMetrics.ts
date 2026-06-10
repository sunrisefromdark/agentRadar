import fs from "node:fs";
import path from "node:path";
import type { RawSignal, ScoredProject, StarDeltaWindow } from "../types.ts";
import { withRetry } from "../retry.ts";

/**
 * GitHub metrics 层只负责“拿 structured repo metrics 并给出明确来源语义”。
 * 关键约束：
 * 1. API / HTML / cache / unavailable 必须显式区分
 * 2. 拿不到真实日增时不能伪造
 * 3. 网络失败、token 缺失、fallback 降级都要能被 summary 看见
 */

export interface GitHubRepoMetrics {
  repo_full_name: string;
  repo_url: string;
  stars: number;
  forks: number;
  issues: number;
  PR: number;
  description: string;
  tags: string[];
}

export interface GitHubRepoMetricsFetchResult {
  metrics?: GitHubRepoMetrics;
  status: "api" | "html" | "cache" | "unavailable" | "invalid_repo";
  notes: string[];
}

interface GitHubRepoResponse {
  full_name: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  description: string | null;
  topics?: string[];
}

export interface GitHubStarSnapshotRecord {
  date: string;
  repo_full_name: string;
  stars: number;
  metrics_source: RawSignal["metrics_source"];
  captured_at: string;
}

export interface GitHubStarDeltaSummary {
  live_delta_attempts: number;
  live_delta_success: number;
  snapshot_delta_success: number;
  token_missing: number;
  auth_invalid: number;
  rate_limit: number;
  network_blocked: number;
}

export interface GitHubStarDeltaResolutionResult {
  signals: RawSignal[];
  summary: GitHubStarDeltaSummary;
  snapshot_records: GitHubStarSnapshotRecord[];
}

interface GitHubLiveStarDeltaResult {
  source: RawSignal["star_delta_source"];
  delta?: number;
  window?: StarDeltaWindow;
  notes: string[];
}

const GITHUB_METRICS_CACHE_DIR = path.join("tmp", "github-metrics-cache");
const GITHUB_STAR_SNAPSHOT_DIR = path.join("data", "raw", "github-stars");
const GITHUB_UNAVAILABLE_BACKOFF_MS = Number.parseInt(
  process.env["AGENT_TREND_RADAR_GITHUB_BACKOFF_MS"] ?? "30000",
  10,
);
// Exec-plan fixed budget: do not allow runtime expansion of live candidate scan scope.
const GITHUB_LIVE_STAR_FETCH_LIMIT = 20;
const GITHUB_LIVE_STAR_PAGE_SIZE = 100;
// Exec-plan fixed budget: keep live pagination bounded and deterministic.
const GITHUB_LIVE_STAR_MAX_PAGES = 3;

let githubUnavailableUntil = 0;
let githubUnavailableReason = "";
let githubHtmlUnavailableUntil = 0;
let githubHtmlUnavailableReason = "";

function readPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function mapInBatches<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map((item, index) => mapper(item, i + index)));
    results.push(...chunkResults);
  }
  return results;
}

function githubFetchTimeoutMs(): number {
  return readPositiveIntEnv("AGENT_TREND_RADAR_GITHUB_TIMEOUT_MS", 6000);
}

function githubFetchRetryAttempts(): number {
  return readPositiveIntEnv("AGENT_TREND_RADAR_GITHUB_RETRY_ATTEMPTS", 2);
}

function githubFetchRetryBaseDelayMs(): number {
  return readPositiveIntEnv("AGENT_TREND_RADAR_GITHUB_RETRY_BASE_DELAY_MS", 500);
}

function isRetryableGitHubStatus(status: number): boolean {
  return status === 403 || status === 429 || status >= 500;
}

export function extractGitHubRepoFullName(repoUrl: string): string {
  const match = repoUrl.match(/github\.com\/([^/\s)]+)\/([^/\s)#?]+)/i);
  if (!match?.[1] || !match[2]) return "";
  return `${match[1]}/${match[2].replace(/\.git$/i, "")}`;
}

function cachePathForRepo(repoFullName: string): string {
  const slug = repoFullName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return path.join(GITHUB_METRICS_CACHE_DIR, `${slug}.json`);
}

function readCachedMetrics(repoFullName: string): GitHubRepoMetrics | undefined {
  const cachePath = cachePathForRepo(repoFullName);
  if (!fs.existsSync(cachePath)) return undefined;
  return JSON.parse(fs.readFileSync(cachePath, "utf-8")) as GitHubRepoMetrics;
}

export function readCachedGitHubRepoMetrics(repoFullName: string): GitHubRepoMetrics | undefined {
  return readCachedMetrics(repoFullName);
}

function writeCachedMetrics(metrics: GitHubRepoMetrics): void {
  const cachePath = cachePathForRepo(metrics.repo_full_name);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify(metrics, null, 2)}\n`, "utf-8");
}

function snapshotPathForDate(date: string): string {
  return path.join(GITHUB_STAR_SNAPSHOT_DIR, `${date}.json`);
}

function readGitHubStarSnapshots(date: string): GitHubStarSnapshotRecord[] {
  const filePath = snapshotPathForDate(date);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as GitHubStarSnapshotRecord[];
}

function writeGitHubStarSnapshots(date: string, records: GitHubStarSnapshotRecord[]): void {
  fs.mkdirSync(GITHUB_STAR_SNAPSHOT_DIR, { recursive: true });
  fs.writeFileSync(snapshotPathForDate(date), `${JSON.stringify(records, null, 2)}\n`, "utf-8");
  fs.writeFileSync(path.join(GITHUB_STAR_SNAPSHOT_DIR, "latest.json"), `${JSON.stringify(records, null, 2)}\n`, "utf-8");
}

function previousUtcDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

function nextUtcDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function starDeltaWindowForDate(date: string): StarDeltaWindow {
  const startUtc = cstDayStartUtc(date);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return {
    since: startUtc.toISOString(),
    until: endUtc.toISOString(),
  };
}

function cstDayStartUtc(date: string): Date {
  return new Date(`${date}T00:00:00+08:00`);
}

function starDeltaSourcePriority(source: RawSignal["star_delta_source"]): number {
  if (source === "github_live") return 4;
  if (source === "github_snapshot") return 3;
  if (source === "signal") return 2;
  return 1;
}

function signalRepoFullName(signal: RawSignal): string {
  return extractGitHubRepoFullName(signal.repo_url).toLowerCase();
}

function uniqueSignalsByRepo(signals: RawSignal[]): RawSignal[] {
  const byRepo = new Map<string, RawSignal>();
  for (const signal of signals) {
    const repoFullName = signalRepoFullName(signal);
    if (!repoFullName) continue;
    if (!byRepo.has(repoFullName)) {
      byRepo.set(repoFullName, signal);
    }
  }
  return [...byRepo.values()];
}

function signalHasExplicitDelta(signal: RawSignal): boolean {
  return signal.star_delta !== undefined && signal.star_delta_source !== "unavailable";
}

function isWatchlistHit(signal: RawSignal): boolean {
  return signal.tags.includes("watchlist-hit");
}

function scoreRankByRepo(scoredProjects: ScoredProject[]): Map<string, { totalScore: number; rank: number }> {
  const byRepo = new Map<string, { totalScore: number; rank: number }>();
  for (const [rank, item] of scoredProjects.entries()) {
    byRepo.set(item.project.repo_full_name.toLowerCase(), {
      totalScore: item.score.total_score,
      rank,
    });
  }
  return byRepo;
}

function candidateSelectionKey(
  signal: RawSignal,
  previousSnapshotRepoNames: Set<string>,
  scoredProjectsByRepo: Map<string, { totalScore: number; rank: number }>,
  index: number,
): number[] {
  const repoFullName = signalRepoFullName(signal);
  const rank = scoredProjectsByRepo.get(repoFullName);
  return [
    isWatchlistHit(signal) ? 1 : 0,
    previousSnapshotRepoNames.has(repoFullName) ? 0 : 1,
    rank?.totalScore ?? -1,
    -(rank?.rank ?? Number.MAX_SAFE_INTEGER),
    signalHasExplicitDelta(signal) ? 0 : 1,
    -index,
  ];
}

function compareCandidateSelection(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return right - left;
  }
  return 0;
}

function selectLiveDeltaCandidates(
  signals: RawSignal[],
  previousSnapshotRepoNames: Set<string>,
  scoredProjects: ScoredProject[],
): RawSignal[] {
  const scoredProjectsByRepo = scoreRankByRepo(scoredProjects);
  return uniqueSignalsByRepo(signals)
    .map((signal, index) => ({ signal, index }))
    .filter(({ signal }) => !signalHasExplicitDelta(signal) || signal.star_delta_source === "unavailable")
    .sort((a, b) =>
      compareCandidateSelection(
        candidateSelectionKey(a.signal, previousSnapshotRepoNames, scoredProjectsByRepo, a.index),
        candidateSelectionKey(b.signal, previousSnapshotRepoNames, scoredProjectsByRepo, b.index),
      ),
    )
    .slice(0, GITHUB_LIVE_STAR_FETCH_LIMIT)
    .map((entry) => entry.signal);
}

function snapshotRecordsFromSignals(signals: RawSignal[], date: string): GitHubStarSnapshotRecord[] {
  const byRepo = new Map<string, GitHubStarSnapshotRecord>();
  const capturedAt = new Date().toISOString();

  for (const signal of signals) {
    const repoFullName = signalRepoFullName(signal);
    if (!repoFullName) continue;
    const existing = byRepo.get(repoFullName);
    const stars = signal.stars ?? existing?.stars ?? 0;
    const metricsSource = signal.metrics_source ?? existing?.metrics_source ?? "unavailable";
    byRepo.set(repoFullName, {
      date,
      repo_full_name: repoFullName,
      stars: Math.max(stars, existing?.stars ?? 0),
      metrics_source: metricsSource,
      captured_at: capturedAt,
    });
  }

  return [...byRepo.values()].sort((a, b) => a.repo_full_name.localeCompare(b.repo_full_name));
}

function readPreviousSnapshotMap(date: string): Map<string, GitHubStarSnapshotRecord> {
  const previousDate = previousUtcDate(date);
  return new Map(readGitHubStarSnapshots(previousDate).map((record) => [record.repo_full_name.toLowerCase(), record]));
}

function signalHasSeedableMetrics(signal: RawSignal): boolean {
  return (
    signal.stars !== undefined ||
    signal.forks !== undefined ||
    signal.issues !== undefined ||
    signal.PR !== undefined
  );
}

function githubHeaders(includeAuth = true): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "agent-radar/0.1",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (includeAuth && token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function githubAuthModeNote(): string {
  return process.env["GITHUB_TOKEN"] ? "github_token=present" : "github_token=missing";
}

function isTimeoutLike(error: unknown): boolean {
  return String(error).toLowerCase().includes("timeout");
}

function isNetworkBlockedLike(error: unknown): boolean {
  const text = String(error).toLowerCase();
  return (
    text.includes("timeout") ||
    text.includes("fetch failed") ||
    text.includes("network") ||
    text.includes("econnreset") ||
    text.includes("enotfound") ||
    text.includes("socket hang up")
  );
}

function githubHtmlHeaders(): Record<string, string> {
  return {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "agent-radar/0.1",
  };
}

function fetchTimeoutSignal(): AbortSignal | undefined {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") return undefined;
  return AbortSignal.timeout(githubFetchTimeoutMs());
}

function githubRequestInit(includeAuth = true): RequestInit {
  return {
    headers: githubHeaders(includeAuth),
    signal: fetchTimeoutSignal(),
  };
}

function githubHtmlRequestInit(): RequestInit {
  return {
    headers: githubHtmlHeaders(),
    signal: fetchTimeoutSignal(),
  };
}

function githubLiveHeaders(includeAuth = true): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.star+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "agent-radar/0.1",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (includeAuth && token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function githubLiveRequestInit(includeAuth = true): RequestInit {
  return {
    headers: githubLiveHeaders(includeAuth),
    signal: fetchTimeoutSignal(),
  };
}

async function fetchWithGitHubRetry(label: string, url: string, initFactory: () => RequestInit): Promise<Response> {
  return withRetry(label, githubFetchRetryAttempts(), githubFetchRetryBaseDelayMs(), () => fetch(url, initFactory()), {
    shouldRetryResult: (resp) => isRetryableGitHubStatus(resp.status),
    describeResult: (resp) => `HTTP ${resp.status}`,
  });
}

async function fetchWithOptionalGithubAuthRetry(
  label: string,
  url: string,
  initFactory: (includeAuth: boolean) => RequestInit,
): Promise<{ response: Response; usedUnauthenticatedRetry: boolean; initialAuthStatus?: number }> {
  const response = await fetchWithGitHubRetry(label, url, () => initFactory(true));
  if (response.status !== 401 || !process.env["GITHUB_TOKEN"]) {
    return { response, usedUnauthenticatedRetry: false };
  }

  const retryResponse = await fetchWithGitHubRetry(`${label}:unauth`, url, () => initFactory(false));
  return {
    response: retryResponse,
    usedUnauthenticatedRetry: true,
    initialAuthStatus: response.status,
  };
}

function isGithubTemporarilyUnavailable(): boolean {
  return Date.now() < githubUnavailableUntil;
}

function markGithubUnavailable(reason: string): void {
  githubUnavailableUntil = Date.now() + GITHUB_UNAVAILABLE_BACKOFF_MS;
  githubUnavailableReason = reason;
}

function clearGithubUnavailable(): void {
  githubUnavailableUntil = 0;
  githubUnavailableReason = "";
}

function isGithubHtmlTemporarilyUnavailable(): boolean {
  return Date.now() < githubHtmlUnavailableUntil;
}

function markGithubHtmlUnavailable(reason: string): void {
  githubHtmlUnavailableUntil = Date.now() + GITHUB_UNAVAILABLE_BACKOFF_MS;
  githubHtmlUnavailableReason = reason;
}

function clearGithubHtmlUnavailable(): void {
  githubHtmlUnavailableUntil = 0;
  githubHtmlUnavailableReason = "";
}

function parseLinkHeaderNextPage(link: string | null): number | undefined {
  if (!link) return undefined;
  const nextMatch = link.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="next"/i);
  return nextMatch?.[1] ? Number.parseInt(nextMatch[1], 10) : undefined;
}

function unavailableNotes(prefix: string, repoFullName: string): GitHubRepoMetricsFetchResult {
  const cached = readCachedMetrics(repoFullName);
  if (cached) {
    return {
      metrics: cached,
      status: "cache",
      notes: [`${prefix}; ${githubAuthModeNote()}; used cached metrics`],
    };
  }
  return {
    status: "unavailable",
    notes: [`${prefix}; ${githubAuthModeNote()}; no cached metrics available`],
  };
}

function parseMetricValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const match = trimmed.match(/^([\d,.]+)\s*([kKmM])?$/);
  if (!match?.[1]) return undefined;

  const base = Number.parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return undefined;
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") return Math.round(base * 1_000);
  if (suffix === "m") return Math.round(base * 1_000_000);
  return Math.round(base);
}

function stripHtml(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMetaContent(html: string, key: string, attr: "name" | "property"): string {
  const match = html.match(new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`, "i"));
  return match?.[1]?.trim() ?? "";
}

function matchLabeledCount(text: string, label: string): number {
  const match = text.match(new RegExp(`${label}\\s+([\\d.,]+\\s*[kKmM]?)`, "i"));
  return parseMetricValue(match?.[1]) ?? 0;
}

function htmlFallbackUnavailable(repoFullName: string, prefixNotes: string[], detail: string): GitHubRepoMetricsFetchResult {
  return unavailableNotes([...prefixNotes, detail].join("; "), repoFullName);
}

function buildHtmlMetrics(repoFullName: string, html: string): GitHubRepoMetrics {
  const text = stripHtml(html);
  const description =
    extractMetaContent(html, "og:description", "property") ||
    extractMetaContent(html, "description", "name") ||
    "";
  return {
    repo_full_name: repoFullName,
    repo_url: `https://github.com/${repoFullName}`,
    stars: matchLabeledCount(text, "Star"),
    forks: matchLabeledCount(text, "Fork"),
    issues: matchLabeledCount(text, "Issues"),
    PR: matchLabeledCount(text, "Pull requests"),
    description: description.replace(/\s*·\s*GitHub\s*$/i, "").trim(),
    tags: [],
  };
}

function hasUsableHtmlMetrics(metrics: GitHubRepoMetrics): boolean {
  return !(
    metrics.stars === 0 &&
    metrics.forks === 0 &&
    metrics.issues === 0 &&
    metrics.PR === 0 &&
    !metrics.description
  );
}

async function fetchGitHubRepoMetricsFromHtml(
  repoFullName: string,
  prefixNotes: string[] = [],
): Promise<GitHubRepoMetricsFetchResult> {
  // HTML fallback 只在 API 失效时兜底使用，信任等级永远低于 API。
  if (isGithubHtmlTemporarilyUnavailable()) {
    return htmlFallbackUnavailable(
      repoFullName,
      prefixNotes,
      `skipped GitHub HTML fallback after recent failure: ${githubHtmlUnavailableReason}`,
    );
  }

  try {
    const resp = await fetchWithGitHubRetry(
      `github-html:${repoFullName}`,
      `https://github.com/${repoFullName}`,
      githubHtmlRequestInit,
    );
    if (!resp.ok) {
      markGithubHtmlUnavailable(`GitHub HTML returned HTTP ${resp.status}`);
      return htmlFallbackUnavailable(repoFullName, prefixNotes, `repo HTML returned HTTP ${resp.status}`);
    }

    const html = await resp.text();
    const metrics = buildHtmlMetrics(repoFullName, html);

    if (!hasUsableHtmlMetrics(metrics)) {
      markGithubHtmlUnavailable("GitHub HTML loaded but metrics could not be parsed");
      return htmlFallbackUnavailable(repoFullName, prefixNotes, "repo HTML loaded but no structured metrics could be parsed");
    }

    writeCachedMetrics(metrics);
    clearGithubHtmlUnavailable();
    return {
      metrics,
      status: "html",
      notes: [...prefixNotes, "used GitHub repository HTML fallback metrics"],
    };
  } catch (error) {
    markGithubHtmlUnavailable(`GitHub HTML fetch threw ${String(error)}`);
    const timeoutHint = isTimeoutLike(error) ? "github_html_timeout_or_blocked" : "github_html_error";
    return htmlFallbackUnavailable(repoFullName, prefixNotes, `GitHub HTML fetch threw ${String(error)}; ${timeoutHint}`);
  }
}

function countFromLinkHeader(link: string | null, fallback: number): number {
  if (!link) return fallback;
  const match = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
  return match?.[1] ? Number.parseInt(match[1], 10) : fallback;
}

async function fetchOpenPullRequestCount(repoFullName: string): Promise<number> {
  const { response: resp } = await fetchWithOptionalGithubAuthRetry(
    `github-prs:${repoFullName}`,
    `https://api.github.com/repos/${repoFullName}/pulls?state=open&per_page=1`,
    githubRequestInit,
  );
  if (!resp.ok) return 0;
  const rows = (await resp.json()) as unknown[];
  return countFromLinkHeader(resp.headers.get("link"), rows.length);
}

function buildGitHubLiveStarDeltaResult(
  source: RawSignal["star_delta_source"],
  notes: string[],
  delta?: number,
  window?: StarDeltaWindow,
): GitHubLiveStarDeltaResult {
  return { source, notes, delta, window };
}

async function fetchGitHubLiveStarDeltaPage(
  repoFullName: string,
  page: number,
  sinceDate: Date,
  untilDate: Date,
): Promise<{ counted: number; nextPage?: number } | GitHubLiveStarDeltaResult> {
  const resp = await fetchWithGitHubRetry(
    `github-live-stars:${repoFullName}:page-${page}`,
    `https://api.github.com/repos/${repoFullName}/stargazers?per_page=${GITHUB_LIVE_STAR_PAGE_SIZE}&page=${page}`,
    () => githubLiveRequestInit(true),
  );
  let effectiveResp = resp;
  let usedUnauthenticatedRetry = false;

  if (resp.status === 401 && process.env["GITHUB_TOKEN"]) {
    usedUnauthenticatedRetry = true;
    effectiveResp = await fetchWithGitHubRetry(
      `github-live-stars:${repoFullName}:page-${page}`,
      `https://api.github.com/repos/${repoFullName}/stargazers?per_page=${GITHUB_LIVE_STAR_PAGE_SIZE}&page=${page}`,
      () => githubLiveRequestInit(false),
    );
  }

  if (!effectiveResp.ok) {
    if (effectiveResp.status === 401) {
      return buildGitHubLiveStarDeltaResult("unavailable", [
        usedUnauthenticatedRetry ? "auth_invalid" : "auth_unauthorized",
        `github_live_http_${effectiveResp.status}`,
      ]);
    }
    return effectiveResp.status === 403 || effectiveResp.status === 429
      ? buildGitHubLiveStarDeltaResult("unavailable", [`rate_limit_http_${effectiveResp.status}`])
      : buildGitHubLiveStarDeltaResult("unavailable", [`github_live_http_${effectiveResp.status}`]);
  }

  const rows = (await effectiveResp.json()) as Array<{ starred_at?: string }>;
  if (!Array.isArray(rows)) {
    return buildGitHubLiveStarDeltaResult("unavailable", ["github_live_invalid_shape"]);
  }

  const counted = rows.reduce((sum, row) => {
    if (!row?.starred_at) return sum;
    const starredAt = new Date(row.starred_at);
    if (Number.isNaN(starredAt.getTime())) return sum;
    return starredAt >= sinceDate && starredAt < untilDate ? sum + 1 : sum;
  }, 0);

  const nextPage = parseLinkHeaderNextPage(effectiveResp.headers.get("link"));
  if (!nextPage || rows.length < GITHUB_LIVE_STAR_PAGE_SIZE) {
    return { counted };
  }
  return { counted, nextPage };
}

type GitHubLiveStarDeltaCountResult = {
  counted: number;
  pagesFetched: number;
  truncated: boolean;
};

function buildGitHubLiveStarDeltaNotes(
  since: string,
  until: string,
  pagesFetched: number,
  truncated: boolean,
): string[] {
  const notes = [`live_window=${since}/${until}`, `live_pages=${pagesFetched}`];
  if (truncated) notes.push("live_scan_truncated");
  return notes;
}

function isGitHubLiveStarDeltaFailure(
  result: GitHubLiveStarDeltaCountResult | GitHubLiveStarDeltaResult,
): result is GitHubLiveStarDeltaResult {
  return "source" in result;
}

async function fetchGitHubLiveStarDeltaCount(
  repoFullName: string,
  sinceDate: Date,
  untilDate: Date,
): Promise<GitHubLiveStarDeltaCountResult | GitHubLiveStarDeltaResult> {
  let page = 1;
  let pagesFetched = 0;
  let counted = 0;
  let truncated = false;

  while (pagesFetched < GITHUB_LIVE_STAR_MAX_PAGES) {
    pagesFetched += 1;
    const pageResult = await fetchGitHubLiveStarDeltaPage(repoFullName, page, sinceDate, untilDate);
    if ("source" in pageResult) return pageResult;
    counted += pageResult.counted;
    if (!pageResult.nextPage) break;
    if (pagesFetched >= GITHUB_LIVE_STAR_MAX_PAGES) {
      truncated = true;
      break;
    }
    page = pageResult.nextPage;
  }

  return { counted, pagesFetched, truncated };
}

async function fetchGitHubLiveStarDelta(
  repoFullName: string,
  since: string,
  until: string,
): Promise<GitHubLiveStarDeltaResult> {
  if (!process.env["GITHUB_TOKEN"]) {
    return buildGitHubLiveStarDeltaResult("unavailable", ["missing_token"]);
  }

  const sinceDate = new Date(since);
  const untilDate = new Date(until);
  const window = { since, until };

  try {
    const countResult = await fetchGitHubLiveStarDeltaCount(repoFullName, sinceDate, untilDate);
    if (isGitHubLiveStarDeltaFailure(countResult)) return countResult;

    const notes = buildGitHubLiveStarDeltaNotes(since, until, countResult.pagesFetched, countResult.truncated);
    if (countResult.truncated && countResult.counted === 0) {
      return buildGitHubLiveStarDeltaResult("unavailable", [...notes, "live_scan_zero_before_window"]);
    }

    return buildGitHubLiveStarDeltaResult("github_live", notes, countResult.counted, window);
  } catch (error) {
    const failureKind = isNetworkBlockedLike(error) ? "network_blocked" : "github_live_error";
    return buildGitHubLiveStarDeltaResult("unavailable", [failureKind, String(error)]);
  }
}

export async function fetchGitHubRepoMetrics(repoUrl: string): Promise<GitHubRepoMetrics | undefined> {
  const result = await fetchGitHubRepoMetricsDetailed(repoUrl);
  return result.metrics;
}

function mergedMetricField(
  signal: RawSignal,
  existing: GitHubRepoMetrics | undefined,
  field: "stars" | "forks" | "issues" | "PR",
): number {
  return signal[field] ?? existing?.[field] ?? 0;
}

function mergedDescription(signal: RawSignal, existing: GitHubRepoMetrics | undefined): string {
  return signal.description || existing?.description || "";
}

function mergedTags(signal: RawSignal, existing: GitHubRepoMetrics | undefined): string[] {
  return [...new Set([...(existing?.tags ?? []), ...signal.tags])];
}

function mergeSeededMetrics(existing: GitHubRepoMetrics | undefined, signal: RawSignal, repoFullName: string): GitHubRepoMetrics {
  return {
    repo_full_name: repoFullName,
    repo_url: signal.repo_url,
    stars: mergedMetricField(signal, existing, "stars"),
    forks: mergedMetricField(signal, existing, "forks"),
    issues: mergedMetricField(signal, existing, "issues"),
    PR: mergedMetricField(signal, existing, "PR"),
    description: mergedDescription(signal, existing),
    tags: mergedTags(signal, existing),
  };
}

export function seedGitHubRepoMetricsCacheFromSignal(signal: RawSignal): boolean {
  const repoFullName = extractGitHubRepoFullName(signal.repo_url);
  if (!repoFullName || !signalHasSeedableMetrics(signal)) return false;

  writeCachedMetrics(mergeSeededMetrics(readCachedMetrics(repoFullName), signal, repoFullName));
  return true;
}

function invalidRepoResult(): GitHubRepoMetricsFetchResult {
  return {
    status: "invalid_repo",
    notes: ["repo_url could not be parsed into owner/repo"],
  };
}

function cachedApiFailureResult(repoFullName: string, status: number): GitHubRepoMetricsFetchResult {
  const cached = readCachedMetrics(repoFullName);
  if (cached) {
    return {
      metrics: cached,
      status: "cache",
      notes: [`repo API returned HTTP ${status}; ${githubAuthModeNote()}; used cached metrics`],
    };
  }
  return {
    status: "unavailable",
    notes: [`repo API returned HTTP ${status}; ${githubAuthModeNote()}; no cached metrics available`],
  };
}

async function fetchApiMetrics(repoFullName: string): Promise<GitHubRepoMetricsFetchResult> {
  const resp = await fetchWithGitHubRetry(
    `github-api:${repoFullName}`,
    `https://api.github.com/repos/${repoFullName}`,
    () => githubRequestInit(true),
  );
  let effectiveResp = resp;
  let usedUnauthenticatedRetry = false;
  let initialAuthStatus: number | undefined;
  if (resp.status === 401 && process.env["GITHUB_TOKEN"]) {
    usedUnauthenticatedRetry = true;
    initialAuthStatus = resp.status;
    effectiveResp = await fetchWithGitHubRetry(
      `github-api:${repoFullName}:unauth`,
      `https://api.github.com/repos/${repoFullName}`,
      () => githubRequestInit(false),
    );
  }

  if (!effectiveResp.ok) {
    if (effectiveResp.status === 403) {
      markGithubUnavailable("GitHub API returned HTTP 403");
      return fetchGitHubRepoMetricsFromHtml(repoFullName, [
        usedUnauthenticatedRetry && initialAuthStatus === 401
          ? "repo API auth returned HTTP 401; unauth retry returned HTTP 403"
          : "repo API returned HTTP 403",
        githubAuthModeNote(),
      ]);
    }
    return cachedApiFailureResult(repoFullName, effectiveResp.status);
  }

  const repo = (await effectiveResp.json()) as GitHubRepoResponse;
  const prs = await fetchOpenPullRequestCount(repo.full_name);
  const metrics = {
    repo_full_name: repo.full_name,
    repo_url: repo.html_url,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    issues: Math.max(0, repo.open_issues_count - prs),
    PR: prs,
    description: repo.description ?? "",
    tags: repo.topics ?? [],
  } satisfies GitHubRepoMetrics;

  writeCachedMetrics(metrics);
  clearGithubUnavailable();
  return {
    metrics,
    status: "api",
    notes: [
      `used fresh GitHub API metrics; ${githubAuthModeNote()}`,
      ...(usedUnauthenticatedRetry
        ? [`github api token returned HTTP ${initialAuthStatus ?? 401}; retried successfully without auth`]
        : []),
    ],
  };
}

export async function fetchGitHubRepoMetricsDetailed(repoUrl: string): Promise<GitHubRepoMetricsFetchResult> {
  const repoFullName = extractGitHubRepoFullName(repoUrl);
  if (!repoFullName) return invalidRepoResult();

  if (isGithubTemporarilyUnavailable()) {
    return fetchGitHubRepoMetricsFromHtml(repoFullName, [
      `skipped live GitHub API after recent failure: ${githubUnavailableReason}`,
    ]);
  }

  try {
    return await fetchApiMetrics(repoFullName);
  } catch (error) {
    const reason = `GitHub API fetch threw ${String(error)}`;
    markGithubUnavailable(reason);
    return fetchGitHubRepoMetricsFromHtml(
      repoFullName,
      [reason, isTimeoutLike(error) ? "github_api_timeout_or_blocked" : "github_api_error", githubAuthModeNote()],
    );
  }
}

function mergeStarDeltaResolution(
  signal: RawSignal,
  liveByRepo: Map<string, GitHubLiveStarDeltaResult>,
  currentSnapshotByRepo: Map<string, GitHubStarSnapshotRecord>,
  previousSnapshotByRepo: Map<string, GitHubStarSnapshotRecord>,
  window: StarDeltaWindow,
): RawSignal {
  const repoFullName = signalRepoFullName(signal);
  if (!repoFullName) return signal;

  const currentSnapshot = currentSnapshotByRepo.get(repoFullName);
  const previousSnapshot = previousSnapshotByRepo.get(repoFullName);
  const snapshotDelta = currentSnapshot && previousSnapshot ? currentSnapshot.stars - previousSnapshot.stars : undefined;
  const liveResolution = mergeLiveStarDelta(signal, liveByRepo.get(repoFullName), snapshotDelta, window);
  if (liveResolution) return liveResolution;

  const snapshotResolution = mergeSnapshotStarDelta(signal, snapshotDelta, window);
  if (snapshotResolution) return snapshotResolution;

  return signal.star_delta !== undefined ? preserveSignalStarDelta(signal, window) : markSignalDeltaUnavailable(signal);
}

function mergeLiveStarDelta(
  signal: RawSignal,
  live: GitHubLiveStarDeltaResult | undefined,
  snapshotDelta: number | undefined,
  window: StarDeltaWindow,
): RawSignal | undefined {
  if (live?.source !== "github_live" || live.delta === undefined) return undefined;
  if (live.delta === 0 && snapshotDelta !== undefined && snapshotDelta > 0) {
    return assignSignalStarDelta(signal, snapshotDelta, "github_snapshot", window);
  }
  return assignSignalStarDelta(signal, live.delta, "github_live", live.window ?? window);
}

function mergeSnapshotStarDelta(
  signal: RawSignal,
  snapshotDelta: number | undefined,
  window: StarDeltaWindow,
): RawSignal | undefined {
  if (snapshotDelta === undefined) return undefined;
  if (snapshotDelta < 0) {
    return signal.star_delta !== undefined ? preserveSignalStarDelta(signal, window) : markSignalDeltaUnavailable(signal);
  }
  return assignSignalStarDelta(signal, snapshotDelta, "github_snapshot", window);
}

function assignSignalStarDelta(
  signal: RawSignal,
  delta: number,
  source: RawSignal["star_delta_source"],
  window: StarDeltaWindow,
): RawSignal {
  return {
    ...signal,
    star_delta: delta,
    star_delta_source: source,
    star_delta_window: window,
  };
}

function preserveSignalStarDelta(signal: RawSignal, window: StarDeltaWindow): RawSignal {
  return {
    ...signal,
    star_delta_source: signal.star_delta_source ?? "signal",
    star_delta_window: signal.star_delta_window ?? window,
  };
}

function markSignalDeltaUnavailable(signal: RawSignal): RawSignal {
  return {
    ...signal,
    star_delta: undefined,
    star_delta_source: "unavailable",
    star_delta_window: undefined,
  };
}

function starDeltaSummaryFromNotes(notes: string[]): Partial<GitHubStarDeltaSummary> {
  const summary: Partial<GitHubStarDeltaSummary> = {};
  for (const note of notes) {
    if (note.includes("missing_token")) summary.token_missing = (summary.token_missing ?? 0) + 1;
    if (note.includes("auth_invalid") || note.includes("auth_unauthorized")) {
      summary.auth_invalid = (summary.auth_invalid ?? 0) + 1;
    }
    if (note.includes("rate_limit")) summary.rate_limit = (summary.rate_limit ?? 0) + 1;
    if (note.includes("network_blocked")) summary.network_blocked = (summary.network_blocked ?? 0) + 1;
  }
  return summary;
}

export async function resolveGitHubStarDeltas(
  signals: RawSignal[],
  date: string,
  scoredProjects: ScoredProject[] = [],
): Promise<GitHubStarDeltaResolutionResult> {
  const previousSnapshotByRepo = readPreviousSnapshotMap(date);
  const candidateSignals = selectLiveDeltaCandidates(signals, new Set(previousSnapshotByRepo.keys()), scoredProjects);
  const summary: GitHubStarDeltaSummary = {
    live_delta_attempts: candidateSignals.length,
    live_delta_success: 0,
    snapshot_delta_success: 0,
    token_missing: 0,
    auth_invalid: 0,
    rate_limit: 0,
    network_blocked: 0,
  };

  const window = starDeltaWindowForDate(date);
  const since = window.since;
  const until = window.until;
  const liveByRepo = new Map<string, GitHubLiveStarDeltaResult>();
  const concurrency = readPositiveIntEnv("AGENT_TREND_RADAR_GITHUB_LIVE_CONCURRENCY", 2);

  const liveResults = await mapInBatches(candidateSignals, concurrency, async (signal) => {
    const repoFullName = signalRepoFullName(signal);
    if (!repoFullName) {
      return { repoFullName: "", result: buildGitHubLiveStarDeltaResult("unavailable", ["invalid_repo"]) };
    }
    const result = await fetchGitHubLiveStarDelta(repoFullName, since, until);
    return { repoFullName, result };
  });

  for (const { repoFullName, result } of liveResults) {
    if (!repoFullName) continue;
    liveByRepo.set(repoFullName, result);
    if (result.source === "github_live" && result.delta !== undefined) {
      summary.live_delta_success += 1;
    }
    const counters = starDeltaSummaryFromNotes(result.notes);
    summary.token_missing += counters.token_missing ?? 0;
    summary.auth_invalid += counters.auth_invalid ?? 0;
    summary.rate_limit += counters.rate_limit ?? 0;
    summary.network_blocked += counters.network_blocked ?? 0;
  }

  const snapshotRecords = snapshotRecordsFromSignals(signals, date);
  writeGitHubStarSnapshots(date, snapshotRecords);
  const currentSnapshotByRepo = new Map(snapshotRecords.map((record) => [record.repo_full_name.toLowerCase(), record] as const));

  const mergedSignals = signals.map((signal) =>
    mergeStarDeltaResolution(signal, liveByRepo, currentSnapshotByRepo, previousSnapshotByRepo, window),
  );
  summary.snapshot_delta_success = mergedSignals.filter((signal) => signal.star_delta_source === "github_snapshot").length;

  return {
    signals: mergedSignals,
    summary,
    snapshot_records: snapshotRecords,
  };
}

export function resetGitHubMetricsRuntimeStateForTests(): void {
  clearGithubUnavailable();
  clearGithubHtmlUnavailable();
}
