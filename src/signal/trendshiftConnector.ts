import fs from "node:fs";
import path from "node:path";
import type { SourceConfig } from "../config.ts";
import type { RawSignal } from "../types.ts";
import { parseTrendshiftSignals } from "./trendshiftParser.ts";

export interface TrendshiftFetchResult {
  signals: RawSignal[];
  requested_date: string;
  resolved_date: string;
  fallback_used: boolean;
  notes: string[];
}

interface SnapshotLookupResult {
  html: string;
  resolvedDate?: string;
  fallbackUsed: boolean;
  notes: string[];
}

interface TrendshiftHtmlResult {
  html: string;
  resolvedDate: string;
  fallbackUsed: boolean;
  notes: string[];
}

function snapshotPath(config: SourceConfig["trendshift"], date: string): string {
  return path.join(config.snapshotDir, `${date}.html`);
}

function readSnapshotFile(config: SourceConfig["trendshift"], date: string): string {
  const snapshot = snapshotPath(config, date);
  return fs.existsSync(snapshot) ? fs.readFileSync(snapshot, "utf-8") : "";
}

function findLatestSnapshotDate(snapshotDir: string, beforeOrOnDate?: string): string | undefined {
  if (!fs.existsSync(snapshotDir)) return undefined;
  const candidates = fs
    .readdirSync(snapshotDir)
    .filter((entry) => /^\d{4}-\d{2}-\d{2}\.html$/.test(entry))
    .map((entry) => entry.replace(/\.html$/, ""))
    .sort((a, b) => b.localeCompare(a));

  if (beforeOrOnDate) {
    return candidates.find((date) => date <= beforeOrOnDate) ?? candidates[0];
  }

  return candidates[0];
}

function readLatestSnapshotFile(config: SourceConfig["trendshift"], requestedDate: string): SnapshotLookupResult {
  const exactSnapshot = readSnapshotFile(config, requestedDate);
  if (exactSnapshot) {
    return {
      html: exactSnapshot,
      resolvedDate: requestedDate,
      fallbackUsed: false,
      notes: [`using requested Trendshift snapshot ${requestedDate}`],
    };
  }

  const fallbackDate = findLatestSnapshotDate(config.snapshotDir, requestedDate);
  if (!fallbackDate) {
    return {
      html: "",
      fallbackUsed: false,
      notes: [`no Trendshift snapshot found for ${requestedDate} or any earlier date`],
    };
  }

  return {
    html: readSnapshotFile(config, fallbackDate),
    resolvedDate: fallbackDate,
    fallbackUsed: fallbackDate !== requestedDate,
    notes: [`requested Trendshift snapshot ${requestedDate} missing; fell back to ${fallbackDate}`],
  };
}

function parseSignals(html: string, resolvedDate: string): RawSignal[] {
  return parseTrendshiftSignals(html, `${resolvedDate}T00:00:00.000Z`);
}

function stampSignalsForRealtimeRun(signals: RawSignal[], requestedDate: string): RawSignal[] {
  const timestamp = `${requestedDate}T00:00:00.000Z`;
  return signals.map((signal) => ({
    ...signal,
    timestamp,
  }));
}

function buildTrendshiftResult(
  signals: RawSignal[],
  requestedDate: string,
  resolvedDate: string,
  fallbackUsed: boolean,
  notes: string[],
): TrendshiftFetchResult {
  return {
    signals,
    requested_date: requestedDate,
    resolved_date: resolvedDate,
    fallback_used: fallbackUsed,
    notes,
  };
}

function buildDisabledResult(date: string): TrendshiftFetchResult {
  return buildTrendshiftResult([], date, date, false, ["trendshift source disabled in config"]);
}

function buildDryRunSnapshotResult(
  config: SourceConfig["trendshift"],
  date: string,
): TrendshiftFetchResult | undefined {
  const snapshot = readLatestSnapshotFile(config, date);
  if (!snapshot.html) return undefined;
  return buildTrendshiftResult(
    parseSignals(snapshot.html, snapshot.resolvedDate ?? date),
    date,
    snapshot.resolvedDate ?? date,
    snapshot.fallbackUsed,
    ["dry-run forced Trendshift snapshot mode", ...snapshot.notes],
  );
}

function shouldUseDryRunSnapshot(config: SourceConfig["trendshift"], dryRun: boolean | undefined): boolean {
  return Boolean(dryRun && config.mode === "http");
}

function buildEmptyHtmlResult(date: string, htmlResult: TrendshiftHtmlResult): TrendshiftFetchResult {
  return buildTrendshiftResult([], date, htmlResult.resolvedDate, htmlResult.fallbackUsed, [
    ...htmlResult.notes,
    "Trendshift produced no HTML content",
  ]);
}

function shouldPersistLiveSnapshot(config: SourceConfig["trendshift"], dryRun: boolean | undefined): boolean {
  return !dryRun && config.mode === "http";
}

function persistLiveSnapshot(config: SourceConfig["trendshift"], date: string, html: string): void {
  fs.mkdirSync(config.snapshotDir, { recursive: true });
  fs.writeFileSync(snapshotPath(config, date), html, "utf-8");
}

function tryFallbackFromEmptyLiveSignals(
  config: SourceConfig["trendshift"],
  requestedDate: string,
  htmlResult: TrendshiftHtmlResult,
): TrendshiftFetchResult | undefined {
  if (config.mode !== "http") return undefined;

  const fallbackSnapshot = readLatestSnapshotFile(config, requestedDate);
  if (!fallbackSnapshot.html) return undefined;

  const fallbackDate = fallbackSnapshot.resolvedDate ?? requestedDate;
  const fallbackSignals = parseSignals(fallbackSnapshot.html, fallbackDate);
  if (fallbackSignals.length === 0) return undefined;

  return buildTrendshiftResult(
    fallbackSignals,
    requestedDate,
    fallbackDate,
    true,
    [
      ...htmlResult.notes,
      "live Trendshift HTML parsed to 0 signals; fell back to latest usable snapshot",
      ...fallbackSnapshot.notes,
      `loaded ${fallbackSignals.length} Trendshift signals from ${fallbackDate}`,
    ],
  );
}

function buildParsedSignalsResult(
  config: SourceConfig["trendshift"],
  requestedDate: string,
  htmlResult: TrendshiftHtmlResult,
): TrendshiftFetchResult {
  const liveSignals = parseSignals(htmlResult.html, htmlResult.resolvedDate);
  const fallbackResult = tryFallbackFromEmptyLiveSignals(config, requestedDate, htmlResult);
  if (liveSignals.length === 0 && fallbackResult) {
    return fallbackResult;
  }

  const normalizedSignals =
    !htmlResult.fallbackUsed && htmlResult.resolvedDate === requestedDate
      ? stampSignalsForRealtimeRun(liveSignals, requestedDate)
      : liveSignals;

  return buildTrendshiftResult(
    normalizedSignals,
    requestedDate,
    htmlResult.resolvedDate,
    htmlResult.fallbackUsed,
    [...htmlResult.notes, `loaded ${normalizedSignals.length} Trendshift signals from ${htmlResult.resolvedDate}`],
  );
}

async function readTrendshiftHtml(config: SourceConfig["trendshift"], date: string): Promise<TrendshiftHtmlResult> {
  if (config.mode === "snapshot") {
    const snapshot = readLatestSnapshotFile(config, date);
    return {
      html: snapshot.html,
      resolvedDate: snapshot.resolvedDate ?? date,
      fallbackUsed: snapshot.fallbackUsed,
      notes: snapshot.notes,
    };
  }

  try {
    const resp = await fetch(config.baseUrl, {
      headers: {
        Accept: "text/html",
        "User-Agent": "agent-radar/0.1",
      },
    });
    if (!resp.ok) throw new Error(`Trendshift fetch failed: HTTP ${resp.status}`);
    return {
      html: await resp.text(),
      resolvedDate: date,
      fallbackUsed: false,
      notes: [`fetched live Trendshift HTML for ${date}`],
    };
  } catch (error) {
    const fallbackSnapshot = readLatestSnapshotFile(config, date);
    if (fallbackSnapshot.html) {
      return {
        html: fallbackSnapshot.html,
        resolvedDate: fallbackSnapshot.resolvedDate ?? date,
        fallbackUsed: true,
        notes: [`live fetch failed: ${String(error)}`, ...fallbackSnapshot.notes],
      };
    }
    throw error;
  }
}

/**
 * Trendshift connector 负责把 live / snapshot / fallback 三条路径统一成同一种返回语义。
 * 这样上层 source orchestration 只看 signals + notes，不需要再知道“这次是 HTTP 还是快照补位”。
 */
export async function fetchTrendshiftSignalsDetailed(
  config: SourceConfig["trendshift"],
  opts: { date?: string; dryRun?: boolean } = {},
): Promise<TrendshiftFetchResult> {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  if (!config.enabled) return buildDisabledResult(date);

  if (shouldUseDryRunSnapshot(config, opts.dryRun)) {
    const dryRunResult = buildDryRunSnapshotResult(config, date);
    if (dryRunResult) return dryRunResult;
  }

  const htmlResult = await readTrendshiftHtml(config, date);
  if (!htmlResult.html) {
    return buildEmptyHtmlResult(date, htmlResult);
  }

  if (shouldPersistLiveSnapshot(config, opts.dryRun)) {
    persistLiveSnapshot(config, date, htmlResult.html);
  }

  return buildParsedSignalsResult(config, date, htmlResult);
}

export async function fetchTrendshiftSignals(
  config: SourceConfig["trendshift"],
  opts: { date?: string; dryRun?: boolean } = {},
): Promise<RawSignal[]> {
  const result = await fetchTrendshiftSignalsDetailed(config, opts);
  return result.signals;
}
