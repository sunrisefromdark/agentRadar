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

export function externalEntityRegistryPath(): string {
  return path.join("data", "external-discovery", "entity-registry.json");
}

export function externalSanitizedFixtureDirPath(): string {
  return path.join("data", "raw", "external-discovery", "fixtures");
}
