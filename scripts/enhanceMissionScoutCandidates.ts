import fs from "node:fs";
import path from "node:path";
import { loadRuntimeEnv } from "../src/env.ts";
import { generateMissionScoutEnhancements } from "../src/signal/missionScoutEnhancement.ts";
import type { RawSignal } from "../src/types.ts";

const MISSION_SCOUT_DIR = path.join("data", "discovery", "mission-scout");

function listMissionScoutDates(): string[] {
  if (!fs.existsSync(MISSION_SCOUT_DIR)) return [];
  return fs
    .readdirSync(MISSION_SCOUT_DIR)
    .map((entry) => /^(\d{4}-\d{2}-\d{2})\.json$/.exec(entry)?.[1])
    .filter((entry): entry is string => Boolean(entry))
    .sort();
}

function readMissionScoutSignals(date: string): RawSignal[] {
  const filepath = path.join(MISSION_SCOUT_DIR, `${date}.json`);
  const artifact = JSON.parse(fs.readFileSync(filepath, "utf8")) as { raw_signals?: RawSignal[] };
  return Array.isArray(artifact.raw_signals) ? artifact.raw_signals : [];
}

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readPositiveIntArg(name: string, fallback: number): number {
  const raw = readArg(name);
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const dates = listMissionScoutDates();
loadRuntimeEnv(process.cwd(), { overrideProcessEnv: true });
const requestedDate = readArg("date") ?? "latest";
const date = requestedDate === "latest" ? dates.at(-1) : requestedDate;
if (!date) {
  throw new Error("No mission scout date found. Expected data/discovery/mission-scout/YYYY-MM-DD.json.");
}

const limit = readPositiveIntArg("limit", 80);
const batchSize = readPositiveIntArg("batch-size", 8);
const signals = readMissionScoutSignals(date);
const artifact = await generateMissionScoutEnhancements({ date, signals, limit, batchSize });

console.log(
  JSON.stringify(
    {
      date,
      input_signals: signals.length,
      enhanced_entries: artifact.entries.length,
      output_path: path.join("data", "discovery", "mission-scout-enhancements", `${date}.json`),
    },
    null,
    2,
  ),
);
