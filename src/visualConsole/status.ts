import type { TopLevelViewStatus, VisualConsoleState } from "./types.ts";

const PRIORITY: TopLevelViewStatus[] = ["failed", "not-judgeable", "stale", "degraded", "empty", "ready"];

export function selectTopStatus(statuses: TopLevelViewStatus[]): TopLevelViewStatus {
  for (const candidate of PRIORITY) {
    if (statuses.includes(candidate)) return candidate;
  }
  return "ready";
}

export function makeState(entries: Array<{ status: TopLevelViewStatus; reason: string | null | undefined }>): VisualConsoleState {
  const statuses = entries.map((entry) => entry.status);
  return {
    status: selectTopStatus(statuses),
    reasons: entries.map((entry) => entry.reason).filter((reason): reason is string => Boolean(reason)),
  };
}
