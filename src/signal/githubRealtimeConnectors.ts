import fs from "node:fs";
import path from "node:path";
import type { SourceConfig } from "../config.ts";
import { toLocalDateStr } from "../date.ts";
import { withRetry } from "../retry.ts";
import type { DailyFreshnessSource, RawSignal } from "../types.ts";
import { extractGitHubRepoFullName } from "./githubMetrics.ts";

interface GitHubTrendingRepo {
  repoFullName: string;
  description?: string;
  stars?: number;
  forks?: number;
  issues?: number;
  topics?: string[];
}

interface GitHubRepoListItem {
  full_name?: string;
  html_url?: string;
  description?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  topics?: string[];
  pushed_at?: string;
  updated_at?: string;
}

interface GitHubSearchResponse {
  items?: GitHubRepoListItem[];
}

export interface RealtimeSourceFetchResult {
  signals: RawSignal[];
  freshnessSource: DailyFreshnessSource;
  notes: string[];
}

const GITHUB_TRENDING_LIMIT = 25;
const WATCHLIST_PER_ORG_LIMIT = 5;
const RAW_SIGNAL_DIR = path.join("data", "raw");

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

function githubHtmlHeaders(): Record<string, string> {
  return {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "agent-radar/0.1",
  };
}

function githubApiHeaders(): Record<string, string> {
  return githubApiHeadersWithAuth(true);
}

function githubApiHeadersWithAuth(includeAuth: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "agent-radar/0.1",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (includeAuth && token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function fetchGitHubApiWithAuthFallback(url: string): Promise<{
  response: Response;
  usedUnauthenticatedRetry: boolean;
  initialAuthStatus?: number;
}> {
  const tokenPresent = Boolean(process.env["GITHUB_TOKEN"]);
  const response = await withRetry(
    `github-realtime:${url}`,
    3,
    1000,
    () =>
      fetch(url, {
        headers: githubApiHeadersWithAuth(true),
      }),
    {
      shouldRetryResult: (resp) => resp.status === 403 || resp.status === 429 || resp.status >= 500,
      describeResult: (resp) => `HTTP ${resp.status}`,
    },
  );
  if (response.status !== 401 || !tokenPresent) {
    return { response, usedUnauthenticatedRetry: false };
  }

  const retryResponse = await withRetry(
    `github-realtime:${url}:unauth`,
    3,
    1000,
    () =>
      fetch(url, {
        headers: githubApiHeadersWithAuth(false),
      }),
    {
      shouldRetryResult: (resp) => resp.status === 403 || resp.status === 429 || resp.status >= 500,
      describeResult: (resp) => `HTTP ${resp.status}`,
    },
  );
  return { response: retryResponse, usedUnauthenticatedRetry: true, initialAuthStatus: response.status };
}

function repoTimestamp(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function cleanText(text: string | undefined): string {
  return (text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildUnavailableFreshnessSource(
  source: DailyFreshnessSource["source"],
  requestedDate: string,
  reason: string,
  statusSummaryCn = "实时抓取失败，当天没有可用信号",
  fromRealtimeRun = false,
): DailyFreshnessSource {
  return {
    source,
    effective_date: requestedDate,
    freshness_state: "unavailable",
    fallback_reason: reason,
    status_summary_cn: statusSummaryCn,
    diagnostic_reason: reason,
    from_realtime_run: fromRealtimeRun,
    source_role: "freshness-driving",
  };
}

function fallbackFreshnessState(resolvedDate: string, requestedDate: string): DailyFreshnessSource["freshness_state"] {
  const resolved = new Date(`${resolvedDate}T00:00:00.000Z`);
  const requested = new Date(`${requestedDate}T00:00:00.000Z`);
  const deltaDays = Math.max(0, Math.round((requested.getTime() - resolved.getTime()) / 86_400_000));
  return deltaDays <= 2 ? "fallback_recent" : "fallback_stale";
}

function sourceFallbackSummaryCn(
  source: DailyFreshnessSource["source"],
  fallbackDate: string,
  count: number,
): string {
  if (source === "github_trending") {
    return `GitHub Trending 实时抓取不可用，已回退到 ${fallbackDate} 的快照结果（${count} 个成功）`;
  }
  return `重点观察清单动态实时抓取不可用，已回退到 ${fallbackDate} 的最近结果（${count} 个成功）`;
}

function readFallbackSignals(
  source: DailyFreshnessSource["source"],
  requestedDate: string,
): { date: string; signals: RawSignal[] } | undefined {
  if (!fs.existsSync(RAW_SIGNAL_DIR)) return undefined;

  const datedFiles = fs
    .readdirSync(RAW_SIGNAL_DIR)
    .filter((entry) => /^\d{4}-\d{2}-\d{2}\.json$/.test(entry))
    .map((entry) => entry.replace(/\.json$/, ""))
    .filter((date) => date < requestedDate)
    .sort((a, b) => b.localeCompare(a));

  for (const date of datedFiles) {
    try {
      const rows = JSON.parse(fs.readFileSync(path.join(RAW_SIGNAL_DIR, `${date}.json`), "utf-8")) as RawSignal[];
      const signals = rows.filter((signal) => signal.source === source);
      if (signals.length > 0) return { date, signals };
    } catch {}
  }

  return undefined;
}

function buildFallbackRealtimeResult(
  source: DailyFreshnessSource["source"],
  requestedDate: string,
  liveFailureReason: string,
): RealtimeSourceFetchResult | undefined {
  const fallback = readFallbackSignals(source, requestedDate);
  if (!fallback) return undefined;

  return {
    signals: fallback.signals,
    freshnessSource: {
      source,
      effective_date: fallback.date,
      freshness_state: fallbackFreshnessState(fallback.date, requestedDate),
      fallback_reason: liveFailureReason,
      status_summary_cn: sourceFallbackSummaryCn(source, fallback.date, fallback.signals.length),
      diagnostic_reason: liveFailureReason,
      from_realtime_run: false,
      source_role: "freshness-driving",
    },
    notes: [liveFailureReason, `loaded ${fallback.signals.length} fallback signals from ${fallback.date}`],
  };
}

function hasRealtimeFetchFailure(notes: string[]): boolean {
  return notes.some((note) => /http \d+|fetch failed|timeout|rate limit|network/i.test(note));
}

function buildFreshnessSource(
  source: DailyFreshnessSource["source"],
  requestedDate: string,
  signals: RawSignal[],
  notes: string[],
): DailyFreshnessSource {
  if (signals.length === 0) {
    if (source === "watchlist_live_activity" && !hasRealtimeFetchFailure(notes)) {
      return buildUnavailableFreshnessSource(
        source,
        requestedDate,
        notes[0] ?? "no watchlist org realtime activity detected",
        "实时抓取成功，但当天没有新的重点观察清单动态",
        true,
      );
    }

    return buildUnavailableFreshnessSource(source, requestedDate, notes[0] ?? "source produced no usable realtime signals");
  }

  const statusSummary =
    source === "github_trending"
      ? `GitHub Trending 实时发现成功，发现 ${signals.length} 个候选`
      : `重点观察清单实时活动抓取成功，发现 ${signals.length} 个候选`;

  return {
    source,
    effective_date: requestedDate,
    freshness_state: "fresh_today",
    status_summary_cn: statusSummary,
    from_realtime_run: true,
    source_role: "freshness-driving",
  };
}

function parseTrendingReposFromHtml(html: string): GitHubTrendingRepo[] {
  const repos: GitHubTrendingRepo[] = [];
  const seen = new Set<string>();
  const articleRegex = /<article[\s\S]*?<h2[\s\S]*?<a[^>]+href="\/([^"/\s]+\/[^"/\s]+)"[\s\S]*?<\/h2>([\s\S]*?)<\/article>/gi;

  for (const match of html.matchAll(articleRegex)) {
    const repoFullName = match[1]?.trim();
    if (!repoFullName || seen.has(repoFullName.toLowerCase())) continue;
    const articleBody = match[0] ?? "";
    const descriptionMatch = articleBody.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    repos.push({
      repoFullName,
      description: cleanText(descriptionMatch?.[1]),
    });
    seen.add(repoFullName.toLowerCase());
    if (repos.length >= GITHUB_TRENDING_LIMIT) break;
  }

  return repos;
}

function parseTrendingReposFromSearchResponse(items: GitHubRepoListItem[]): GitHubTrendingRepo[] {
  const repos: GitHubTrendingRepo[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const repoFullName = item.full_name?.trim();
    if (!repoFullName || seen.has(repoFullName.toLowerCase())) continue;
    repos.push({
      repoFullName,
      description: item.description ?? undefined,
      stars: item.stargazers_count,
      forks: item.forks_count,
      issues: item.open_issues_count,
      topics: Array.isArray(item.topics) ? item.topics : undefined,
    });
    seen.add(repoFullName.toLowerCase());
    if (repos.length >= GITHUB_TRENDING_LIMIT) break;
  }

  return repos;
}

function trendingSignalsFromRepos(repos: GitHubTrendingRepo[], date: string, source: "api" | "html"): RawSignal[] {
  return repos.map((repo) => {
    const tags = new Set(["github-trending", "fresh-today"]);
    for (const topic of repo.topics ?? []) tags.add(topic);

    const signal: RawSignal = {
      project_name: repo.repoFullName,
      repo_url: `https://github.com/${repo.repoFullName}`,
      source: "github_trending",
      timestamp: repoTimestamp(date),
      tags: [...tags],
      description: repo.description,
    };

    if (source === "api") {
      signal.stars = repo.stars;
      signal.forks = repo.forks;
      signal.issues = repo.issues;
      signal.metrics_source = "github_api";
      signal.metrics_trust_score = 1;
    }

    return signal;
  });
}

function isRepoUpdatedToday(repo: GitHubRepoListItem, date: string): boolean {
  const updatedAt = repo.pushed_at ?? repo.updated_at;
  return typeof updatedAt === "string" && toLocalDateStr(new Date(updatedAt)) === date;
}

function watchlistSignalsForOrg(org: string, repos: GitHubRepoListItem[], date: string): RawSignal[] {
  return repos
    .filter((repo) => isRepoUpdatedToday(repo, date))
    .slice(0, WATCHLIST_PER_ORG_LIMIT)
    .map((repo) => {
      const repoFullName = repo.full_name ?? extractGitHubRepoFullName(repo.html_url ?? "");
      return {
        project_name: repoFullName,
        repo_url: repo.html_url ?? `https://github.com/${repoFullName}`,
        source: "watchlist_live_activity",
        timestamp: repoTimestamp(date),
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        issues: repo.open_issues_count,
        tags: ["watchlist-hit", `watchlist:${org}`, "fresh-today"],
        description: repo.description ?? undefined,
        metrics_source: "github_api",
        metrics_trust_score: 1,
      } satisfies RawSignal;
    });
}

function trendingSearchQuery(date: string): string {
  return `stars:>1 pushed:>=${date} archived:false fork:false`;
}

async function fetchTrendingReposViaGitHubApi(date: string): Promise<{ repos: GitHubTrendingRepo[]; notes: string[] } | undefined> {
  try {
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", trendingSearchQuery(date));
    url.searchParams.set("sort", "stars");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", String(GITHUB_TRENDING_LIMIT));

    const { response: resp, usedUnauthenticatedRetry } = await fetchGitHubApiWithAuthFallback(url.toString());
    if (!resp.ok) {
      return undefined;
    }

    const body = (await resp.json()) as GitHubSearchResponse;
    const repos = parseTrendingReposFromSearchResponse(Array.isArray(body.items) ? body.items : []);
    if (repos.length === 0) return undefined;
    return {
      repos,
      notes: [
        `github trending api search succeeded for ${date}`,
        `parsed ${repos.length} candidates from GitHub Search API`,
        ...(usedUnauthenticatedRetry ? ["github api token returned 401; retried successfully without auth"] : []),
      ],
    };
  } catch {
    return undefined;
  }
}

async function fetchTrendingReposViaHtml(date: string): Promise<{ repos: GitHubTrendingRepo[]; notes: string[] } | undefined> {
  try {
    const resp = await fetch("https://github.com/trending?since=daily", {
      headers: githubHtmlHeaders(),
    });
    if (!resp.ok) return undefined;

    const html = await resp.text();
    const repos = parseTrendingReposFromHtml(html);
    if (repos.length === 0) return undefined;
    return {
      repos,
      notes: [`fetched GitHub Trending live HTML for ${date}`, `parsed ${repos.length} trending repos`],
    };
  } catch {
    return undefined;
  }
}

export async function fetchGitHubTrendingSignals(date: string): Promise<RealtimeSourceFetchResult> {
  const apiResult = await fetchTrendingReposViaGitHubApi(date);
  if (apiResult) {
    const signals = trendingSignalsFromRepos(apiResult.repos, date, "api");
    return {
      signals,
      freshnessSource: buildFreshnessSource("github_trending", date, signals, apiResult.notes),
      notes: apiResult.notes,
    };
  }

  const htmlResult = await fetchTrendingReposViaHtml(date);
  if (htmlResult) {
    const signals = trendingSignalsFromRepos(htmlResult.repos, date, "html");
    return {
      signals,
      freshnessSource: buildFreshnessSource("github_trending", date, signals, htmlResult.notes),
      notes: htmlResult.notes,
    };
  }

  const note = "github trending live fetch failed via both GitHub Search API and HTML fallback";
  const fallback = buildFallbackRealtimeResult("github_trending", date, note);
  if (fallback) return fallback;
  return {
    signals: [],
    freshnessSource: buildUnavailableFreshnessSource("github_trending", date, note),
    notes: [note],
  };
}

export async function fetchWatchlistLiveActivitySignals(
  watchlistOrgs: SourceConfig["watchlistOrgs"],
  date: string,
): Promise<RealtimeSourceFetchResult> {
  const collected: RawSignal[] = [];
  const notes: string[] = [];
  let successfulOrgCount = 0;
  const concurrency = readPositiveIntEnv("AGENT_TREND_RADAR_WATCHLIST_CONCURRENCY", 2);
  const results = await mapInBatches(watchlistOrgs, concurrency, async (org) => {
    try {
      const { response: resp, usedUnauthenticatedRetry, initialAuthStatus } = await fetchGitHubApiWithAuthFallback(
        `https://api.github.com/orgs/${org}/repos?sort=updated&per_page=${WATCHLIST_PER_ORG_LIMIT}`,
      );
      if (!resp.ok) {
        return {
          org,
          signals: [] as RawSignal[],
          notes: [
            usedUnauthenticatedRetry && initialAuthStatus === 401
              ? `watchlist org ${org} auth returned HTTP 401; unauth retry returned HTTP ${resp.status}`
              : `watchlist org ${org} returned HTTP ${resp.status}`,
          ],
        };
      }

      successfulOrgCount += 1;
      const repos = (await resp.json()) as GitHubRepoListItem[];
      const orgSignals = watchlistSignalsForOrg(org, Array.isArray(repos) ? repos : [], date);
      const orgNotes =
        orgSignals.length > 0
          ? [`watchlist org ${org} produced ${orgSignals.length} realtime repos`]
          : usedUnauthenticatedRetry
            ? [`watchlist org ${org} retried successfully without auth but had no same-day activity`]
            : [];
      return { org, signals: orgSignals, notes: orgNotes };
    } catch (error) {
      return { org, signals: [] as RawSignal[], notes: [`watchlist org ${org} fetch failed: ${String(error)}`] };
    }
  });

  for (const result of results) {
    collected.push(...result.signals);
    notes.push(...result.notes);
  }

  if (collected.length === 0 && successfulOrgCount > 0) {
    notes.push(
      successfulOrgCount === watchlistOrgs.length
        ? "no watchlist org realtime activity detected"
        : `watchlist realtime fetch partially succeeded (${successfulOrgCount}/${watchlistOrgs.length}) but found no same-day activity`,
    );
  } else if (collected.length === 0 && notes.length === 0) {
    notes.push("no watchlist org realtime activity detected");
  }

  if (collected.length === 0 && hasRealtimeFetchFailure(notes)) {
    const fallback = buildFallbackRealtimeResult("watchlist_live_activity", date, notes[0] ?? "watchlist realtime fetch failed");
    if (fallback) return fallback;
  }

  return {
    signals: collected,
    freshnessSource: buildFreshnessSource("watchlist_live_activity", date, collected, notes),
    notes,
  };
}
