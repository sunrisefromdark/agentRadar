import fs from "node:fs";
import path from "node:path";

export const DATA_DIRS = [
  "data/raw",
  "data/raw/agents-radar",
  "data/raw/github",
  "data/raw/github-stars",
  "data/raw/trendshift",
  "data/classifications",
  "data/normalized",
  "data/scores",
  "data/reports",
  "data/kb",
] as const;

export function ensureDataDirs(): void {
  for (const dir of DATA_DIRS) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writeJsonFile(filepath: string, value: unknown, dryRun = false): string {
  if (dryRun) {
    console.log(`[dry-run] would write ${filepath}`);
    return filepath;
  }
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  return filepath;
}

export function writeTextFile(filepath: string, value: string, dryRun = false): string {
  if (dryRun) {
    console.log(`[dry-run] would write ${filepath}`);
    return filepath;
  }
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, value, "utf-8");
  return filepath;
}

export function readJsonFile<T>(filepath: string, fallback: T): T {
  if (!fs.existsSync(filepath)) return fallback;
  return JSON.parse(fs.readFileSync(filepath, "utf-8")) as T;
}

export function readTextFile(filepath: string, fallback = ""): string {
  if (!fs.existsSync(filepath)) return fallback;
  return fs.readFileSync(filepath, "utf-8");
}

export function appendJsonl(filepath: string, rows: unknown[], dryRun = false): string {
  if (dryRun) {
    console.log(`[dry-run] would append ${rows.length} rows to ${filepath}`);
    return filepath;
  }
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  const payload = rows.map((row) => JSON.stringify(row)).join("\n");
  if (payload) fs.appendFileSync(filepath, `${payload}\n`, "utf-8");
  return filepath;
}
