import type { UserInterestTopicName } from "../types.ts";

export interface StoredInterestTopic {
  name: UserInterestTopicName;
  weight: number;
}

export function normalizeInterestTopicsForStorage(topics: UserInterestTopicName[]): StoredInterestTopic[] {
  const normalized = [...new Set(topics.map((topic) => topic.trim()).filter((topic) => topic.length > 0))];
  if (normalized.length === 0) return [];
  const weight = Number((1 / normalized.length).toFixed(4));
  return normalized.map((name) => ({ name, weight }));
}

export function upsertUserPreferencesRow(input: {
  userId: string;
  topics: UserInterestTopicName[];
  now: string;
}): {
  user_id: string;
  interest_topics_json: StoredInterestTopic[];
  ui_lang: null;
  ui_theme: null;
  created_at: string;
  updated_at: string;
} {
  return {
    user_id: input.userId,
    interest_topics_json: normalizeInterestTopicsForStorage(input.topics),
    ui_lang: null,
    ui_theme: null,
    created_at: input.now,
    updated_at: input.now,
  };
}

export function upsertUserTrackedRepoRow(input: {
  userId: string;
  repoFullName: string;
  repoUrl: string;
  source: "observer";
  now: string;
}): {
  user_id: string;
  repo_full_name: string;
  repo_url: string;
  source: "observer";
  created_at: string;
  updated_at: string;
} {
  return {
    user_id: input.userId,
    repo_full_name: input.repoFullName.trim().toLowerCase(),
    repo_url: input.repoUrl.trim(),
    source: input.source,
    created_at: input.now,
    updated_at: input.now,
  };
}
