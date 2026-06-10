import fs from "node:fs";
import path from "node:path";

type CachedFileEntry<T> = {
  mtimeMs: number;
  size: number;
  value: T;
};

const textFileCache = new Map<string, CachedFileEntry<string>>();
const jsonFileCache = new Map<string, CachedFileEntry<unknown>>();
const directoryEntriesCache = new Map<string, CachedFileEntry<string[]>>();

function resolveCacheKey(filePath: string): string {
  return path.resolve(filePath);
}

function fileStats(cacheKey: string): { mtimeMs: number; size: number } {
  const stats = fs.statSync(cacheKey);
  return { mtimeMs: stats.mtimeMs, size: stats.size };
}

function readCachedValue<T>(
  cache: Map<string, CachedFileEntry<T>>,
  filePath: string,
  loader: (cacheKey: string) => T,
): T {
  const cacheKey = resolveCacheKey(filePath);
  const stats = fileStats(cacheKey);
  const cached = cache.get(cacheKey);
  if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
    return cached.value;
  }

  const value = loader(cacheKey);
  cache.set(cacheKey, {
    mtimeMs: stats.mtimeMs,
    size: stats.size,
    value,
  });
  return value;
}

export function readCachedTextFile(filePath: string): string {
  return readCachedValue(textFileCache, filePath, (cacheKey) => fs.readFileSync(cacheKey, "utf-8"));
}

export function readCachedJsonFile<T>(filePath: string): T {
  return readCachedValue(jsonFileCache, filePath, (cacheKey) => JSON.parse(fs.readFileSync(cacheKey, "utf-8")) as T) as T;
}

export function readCachedDirectoryEntries(dirPath: string): string[] {
  return readCachedValue(directoryEntriesCache, dirPath, (cacheKey) => fs.readdirSync(cacheKey));
}

export function getFilesystemStateSignature(paths: string[]): string {
  return paths
    .map((filePath) => {
      const cacheKey = resolveCacheKey(filePath);
      try {
        const stats = fileStats(cacheKey);
        return `${cacheKey}:${stats.mtimeMs}:${stats.size}`;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return `${cacheKey}:missing`;
        }
        throw error;
      }
    })
    .join("|");
}
