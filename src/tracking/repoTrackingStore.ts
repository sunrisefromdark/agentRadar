import path from "node:path";
import { readJsonFile, writeJsonFile } from "../storage/files.ts";

const REPO_TRACKING_PREFERENCES_PATH = path.join("data", "preferences", "repo-tracking.json");

export interface RepoTrackingPreference {
  repo_full_name: string;
  repo_url: string;
  user_id: string | null;
  source: "observer";
  created_at: string;
  updated_at: string;
}

export interface RepoTrackingStore {
  list(options?: { userId?: string | null }): RepoTrackingPreference[];
  upsert(input: {
    repo_full_name: string;
    repo_url: string;
    user_id?: string | null;
    source?: "observer";
    tracked_at?: string;
  }): { created: boolean; record: RepoTrackingPreference };
}

function normalizedTrackingKey(repoFullName: string, userId: string | null | undefined): string {
  return `${userId ?? ""}::${repoFullName.trim().toLowerCase()}`;
}

function sortRepoTrackingPreferences(records: RepoTrackingPreference[]): RepoTrackingPreference[] {
  return [...records].sort((a, b) => {
    const left = `${a.user_id ?? ""}::${a.repo_full_name}`.toLowerCase();
    const right = `${b.user_id ?? ""}::${b.repo_full_name}`.toLowerCase();
    return left.localeCompare(right);
  });
}

export function readRepoTrackingPreferences(options: { userId?: string | null } = {}): RepoTrackingPreference[] {
  const records = sortRepoTrackingPreferences(readJsonFile<RepoTrackingPreference[]>(REPO_TRACKING_PREFERENCES_PATH, []));
  if (options.userId === undefined) return records;
  return records.filter((record) => record.user_id === options.userId);
}

export function upsertRepoTrackingPreference(input: {
  repo_full_name: string;
  repo_url: string;
  user_id?: string | null;
  source?: "observer";
  tracked_at?: string;
}): { created: boolean; record: RepoTrackingPreference } {
  const trackedAt = input.tracked_at ?? new Date().toISOString();
  const userId = input.user_id ?? null;
  const source = input.source ?? "observer";
  const records = readRepoTrackingPreferences();
  const byKey = new Map(records.map((record) => [normalizedTrackingKey(record.repo_full_name, record.user_id), record] as const));
  const key = normalizedTrackingKey(input.repo_full_name, userId);
  const existing = byKey.get(key);

  const record: RepoTrackingPreference = existing
    ? {
        ...existing,
        repo_url: input.repo_url.trim() || existing.repo_url,
        source,
        updated_at: trackedAt,
      }
    : {
        repo_full_name: input.repo_full_name.trim(),
        repo_url: input.repo_url.trim(),
        user_id: userId,
        source,
        created_at: trackedAt,
        updated_at: trackedAt,
      };

  byKey.set(key, record);
  writeJsonFile(REPO_TRACKING_PREFERENCES_PATH, sortRepoTrackingPreferences([...byKey.values()]));

  return { created: !existing, record };
}

export const localRepoTrackingStore: RepoTrackingStore = {
  list: (options) => readRepoTrackingPreferences(options),
  upsert: (input) => upsertRepoTrackingPreference(input),
};
