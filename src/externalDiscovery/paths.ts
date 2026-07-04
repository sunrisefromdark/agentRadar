import path from "node:path";

export function externalRawInputPath(date: string): string {
  return path.join("data", "raw", "external-discovery", `${date}.agent-reach.json`);
}

export function externalAggregatePath(date: string): string {
  return path.join("data", "external-discovery", `${date}.aggregate.json`);
}

export function externalAggregateLatestPath(): string {
  return path.join("data", "external-discovery", "latest.aggregate.json");
}

export function externalCandidateExplanationsPath(date: string): string {
  return path.join("data", "external-discovery", `${date}.candidate-explanations.json`);
}

export function externalCandidateExplanationsLatestPath(): string {
  return path.join("data", "external-discovery", "latest.candidate-explanations.json");
}

export function externalTrendWindowPath(date: string): string {
  return path.join("data", "external-discovery", "windows", `${date}.discussion-trend-window.json`);
}

export function externalTrendWindowLatestPath(): string {
  return path.join("data", "external-discovery", "windows", "latest.discussion-trend-window.json");
}

export function externalEntityRegistryPath(): string {
  return path.join("data", "external-discovery", "entity-registry.json");
}

export function externalSanitizedFixtureDirPath(): string {
  return path.join("data", "raw", "external-discovery", "fixtures");
}
