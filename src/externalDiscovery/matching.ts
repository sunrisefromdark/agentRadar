import type { NormalizedProject } from "../types.ts";
import type { ExternalSignalEvent, ObservationCandidate } from "./types.ts";

export function projectEvidenceTargetForEvent(event: ExternalSignalEvent, projects: Pick<NormalizedProject, "repo_url" | "repo_full_name">[]): string | null {
  if (event.scope !== "project") return null;
  if (event.target_type !== "project") return null;
  const matched = projects.find((project) => project.repo_url === event.target_key || project.repo_full_name === event.target_key);
  return matched?.repo_full_name ?? null;
}

export function topicKeyFromHints(args: {
  userInterestTopics?: string[];
  weeklyTrendKeys?: string[];
  providerTopicHint?: string;
}): string | null {
  const userTopic = args.userInterestTopics?.find((topic) => topic.trim().length > 0);
  if (userTopic) return kebabCase(userTopic);
  const weeklyKey = args.weeklyTrendKeys?.find((key) => key.trim().length > 0);
  if (weeklyKey) return kebabCase(weeklyKey);
  if (args.providerTopicHint && args.providerTopicHint.trim().length > 0) return kebabCase(args.providerTopicHint);
  return null;
}

export function observationCandidateForUnmatchedEvent(event: ExternalSignalEvent): ObservationCandidate | null {
  if (event.scope === "direction" && event.target_type === "topic") {
    return {
      candidate_kind: "direction",
      target_key: event.target_key,
      qualification: "direction_observation",
      can_enter_daily: false,
      can_enter_weekly: false,
      cannot_be_primary_conclusion: true,
    };
  }
  if (event.scope === "project" && (event.target_type === "project" || event.target_type === "paper" || event.target_type === "product")) {
    return {
      candidate_kind: event.target_type,
      target_key: event.target_key,
      qualification: "needs_primary_confirmation",
      can_enter_daily: true,
      can_enter_weekly: false,
      cannot_be_primary_conclusion: true,
    };
  }
  return null;
}

function kebabCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
