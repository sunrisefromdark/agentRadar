import crypto from "node:crypto";

const REPO_PREFIXES = [
  "app/",
  "config.yaml",
  "data/",
  "docs/",
  "package.json",
  "scripts/",
  "src/",
  "tsconfig.json",
] as const;

function isAbsoluteLikePath(value: string): boolean {
  return /^(?:[a-zA-Z]:[\\/]|\\\\|\/|file:\/\/|~\/)/.test(value);
}

export function normalizePath(rawPath: string): string | null {
  const trimmed = rawPath.trim();
  if (!trimmed || isAbsoluteLikePath(trimmed)) return null;

  const unixPath = trimmed.replace(/\\/g, "/");
  const isDirectory = unixPath.endsWith("/");
  const parts = unixPath.split("/").filter((part) => part.length > 0);
  const normalizedParts: string[] = [];

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      if (normalizedParts.length === 0) return null;
      normalizedParts.pop();
      continue;
    }
    normalizedParts.push(part);
  }

  if (normalizedParts.length === 0) return null;
  const joined = normalizedParts.join("/");
  return isDirectory ? `${joined}/` : joined;
}

export function normalizePathList(paths: string[]): string[] {
  const deduped = new Set<string>();
  for (const rawPath of paths) {
    const normalized = normalizePath(rawPath);
    if (normalized) deduped.add(normalized);
  }
  return Array.from(deduped).sort((left, right) => left.localeCompare(right));
}

export function normalizeWatchPaths(paths: string[]): string[] {
  const normalized = normalizePathList(paths);
  const kept: string[] = [];

  for (const current of normalized) {
    const covered = kept.some((candidate) => candidate.endsWith("/") && current.startsWith(candidate));
    if (!covered) kept.push(current);
  }

  return kept;
}

export function slugify(text: string): string {
  const trimmed = text.trim();
  const asciiCandidate = trimmed
    .replace(/[\s/_.:]+/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (asciiCandidate) return asciiCandidate;

  return `txt-${crypto.createHash("sha256").update(trimmed, "utf8").digest("hex").slice(0, 8)}`;
}

export function primaryScopeSlug(paths: string[]): string {
  const normalizedPaths = normalizePathList(paths);
  if (normalizedPaths.length === 0) return "global";
  const firstSegment = normalizedPaths[0].replace(/\/$/, "").split("/")[0] ?? "global";
  return slugify(firstSegment || "global");
}

export function isLikelyRepoPath(value: string): boolean {
  if (!value) return false;
  const normalized = normalizePath(value);
  if (!normalized) return false;
  return REPO_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix));
}

export function extractRepoPathsFromText(text: string): string[] {
  const matches = text.match(/`([^`]+)`/g) ?? [];
  return normalizePathList(
    matches
      .map((token) => token.slice(1, -1))
      .filter((candidate) => isLikelyRepoPath(candidate)),
  );
}
