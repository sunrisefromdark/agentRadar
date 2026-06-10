import fs from "node:fs";
import path from "node:path";
import { fetchGitHubRepoMetricsDetailed, type GitHubStarSnapshotRecord } from "./githubMetrics.ts";
import type { ScoredProject } from "../types.ts";
import { readJsonFile, writeJsonFile } from "../storage/files.ts";
import { readRepoTrackingPreferences } from "../tracking/repoTrackingStore.ts";

const GITHUB_STAR_SNAPSHOT_DIR = path.join("data", "raw", "github-stars");
const TRACKED_REPOS_PATH = path.join(GITHUB_STAR_SNAPSHOT_DIR, "tracked-repos.json");

export interface GitHubTrackedRepoRecord {
  repo_full_name: string;
  repo_url: string;
  first_seen_date: string;
  last_seen_date: string;
  appearances: number;
  manually_tracked?: boolean;
  tracking_source?: "manual-observer" | "hybrid";
}

interface CaptureTrackedRepoStarSnapshotsOptions {
  dryRun?: boolean;
  concurrency?: number;
  fetchRepoMetricsDetailed?: typeof fetchGitHubRepoMetricsDetailed;
}

export interface CaptureTrackedRepoStarSnapshotsResult {
  tracked_repo_count: number;
  captured_count: number;
  preserved_existing_count: number;
  unavailable_count: number;
  registry: GitHubTrackedRepoRecord[];
  records: GitHubStarSnapshotRecord[];
}

type GitHubMetricsResult = Awaited<ReturnType<typeof fetchGitHubRepoMetricsDetailed>>;

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

function trackedRepoFiles(): string[] {
  const scoreDir = path.join("data", "scores");
  if (!fs.existsSync(scoreDir)) return [];

  return fs.readdirSync(scoreDir)
    .filter((entry) => /^\d{4}-\d{2}-\d{2}\.json$/.test(entry))
    .sort();
}

function sortTrackedRepos(records: GitHubTrackedRepoRecord[]): GitHubTrackedRepoRecord[] {
  return [...records].sort((a, b) => a.repo_full_name.localeCompare(b.repo_full_name));
}

function dateOnly(value: string): string {
  return value.trim().slice(0, 10);
}

function snapshotPathForDate(date: string): string {
  return path.join(GITHUB_STAR_SNAPSHOT_DIR, `${date}.json`);
}

function metricsSourceFromGitHubStatus(status: GitHubMetricsResult["status"]): GitHubStarSnapshotRecord["metrics_source"] {
  if (status === "api") return "github_api";
  if (status === "html") return "github_html";
  if (status === "cache") return "github_cache";
  return "unavailable";
}

export function refreshTrackedRepoRegistry(options: { dryRun?: boolean } = {}): GitHubTrackedRepoRecord[] {
  const byRepo = new Map<string, GitHubTrackedRepoRecord>();

  for (const entry of trackedRepoFiles()) {
    const date = entry.replace(/\.json$/, "");
    const filepath = path.join("data", "scores", entry);
    const rows = readJsonFile<ScoredProject[]>(filepath, []);

    for (const row of rows) {
      const repoFullName = row.project?.repo_full_name?.trim();
      const repoUrl = row.project?.repo_url?.trim();
      if (!repoFullName || !repoUrl) continue;

      const key = repoFullName.toLowerCase();
      const existing = byRepo.get(key);
      if (!existing) {
        byRepo.set(key, {
          repo_full_name: repoFullName,
          repo_url: repoUrl,
          first_seen_date: date,
          last_seen_date: date,
          appearances: 1,
        });
        continue;
      }

      existing.appearances += 1;
      if (date < existing.first_seen_date) existing.first_seen_date = date;
      if (date > existing.last_seen_date) existing.last_seen_date = date;
      if (!existing.repo_url) existing.repo_url = repoUrl;
    }
  }

  for (const preference of readRepoTrackingPreferences()) {
    const key = preference.repo_full_name.toLowerCase();
    const existing = byRepo.get(key);
    if (!existing) {
      byRepo.set(key, {
        repo_full_name: preference.repo_full_name,
        repo_url: preference.repo_url,
        first_seen_date: dateOnly(preference.created_at),
        last_seen_date: dateOnly(preference.updated_at),
        appearances: 0,
        manually_tracked: true,
        tracking_source: "manual-observer",
      });
      continue;
    }

    existing.repo_url = existing.repo_url || preference.repo_url;
    existing.manually_tracked = true;
    existing.tracking_source = "hybrid";
  }

  const registry = sortTrackedRepos([...byRepo.values()]);
  writeJsonFile(TRACKED_REPOS_PATH, registry, options.dryRun ?? false);
  return registry;
}

export function readTrackedRepoRegistry(): GitHubTrackedRepoRecord[] {
  return sortTrackedRepos(readJsonFile<GitHubTrackedRepoRecord[]>(TRACKED_REPOS_PATH, []));
}

export async function captureTrackedRepoStarSnapshots(
  date: string,
  options: CaptureTrackedRepoStarSnapshotsOptions = {},
): Promise<CaptureTrackedRepoStarSnapshotsResult> {
  const dryRun = options.dryRun ?? false;
  const registry = refreshTrackedRepoRegistry({ dryRun });
  const existingRecords = readJsonFile<GitHubStarSnapshotRecord[]>(snapshotPathForDate(date), []);
  const finalByRepo = new Map(existingRecords.map((record) => [record.repo_full_name.toLowerCase(), record] as const));
  const fetcher = options.fetchRepoMetricsDetailed ?? fetchGitHubRepoMetricsDetailed;
  const concurrency = options.concurrency ?? readPositiveIntEnv("AGENT_TREND_RADAR_GITHUB_TRACKED_CONCURRENCY", 2);

  let capturedCount = 0;
  let preservedExistingCount = 0;
  let unavailableCount = 0;

  const fetched = await mapInBatches(registry, concurrency, async (record) => ({
    record,
    result: await fetcher(record.repo_url),
  }));

  for (const { record, result } of fetched) {
    const key = record.repo_full_name.toLowerCase();
    if (result.metrics) {
      capturedCount += 1;
      finalByRepo.set(key, {
        date,
        repo_full_name: result.metrics.repo_full_name,
        stars: result.metrics.stars,
        metrics_source: metricsSourceFromGitHubStatus(result.status),
        captured_at: new Date().toISOString(),
      });
      continue;
    }

    unavailableCount += 1;
    if (finalByRepo.has(key)) preservedExistingCount += 1;
  }

  const records = [...finalByRepo.values()].sort((a, b) => a.repo_full_name.localeCompare(b.repo_full_name));
  writeJsonFile(snapshotPathForDate(date), records, dryRun);
  writeJsonFile(path.join(GITHUB_STAR_SNAPSHOT_DIR, "latest.json"), records, dryRun);

  return {
    tracked_repo_count: registry.length,
    captured_count: capturedCount,
    preserved_existing_count: preservedExistingCount,
    unavailable_count: unavailableCount,
    registry,
    records,
  };
}
