import fs from "node:fs";
import path from "node:path";
import type { SourceConfig } from "../config.ts";
import type { RawSignal } from "../types.ts";
import { signalsFromMarkdown } from "./parse.ts";

interface ManifestDate {
  date: string;
  reports: string[];
}

interface Manifest {
  dates?: ManifestDate[];
}

export interface AgentsRadarFetchResult {
  signals: RawSignal[];
  requested_date: string;
  resolved_date: string;
  fallback_used: boolean;
  notes: string[];
}

function readManifest(manifestPath: string): Manifest {
  if (!fs.existsSync(manifestPath)) return {};
  return JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Manifest;
}

function reportExists(localPath: string, date: string, reportName: string): boolean {
  return fs.existsSync(path.join(localPath, "digests", date, `${reportName}.md`));
}

function availableDates(manifest: Manifest, wantedReports: string[], localPath: string): string[] {
  const dates = manifest.dates ?? [];
  return dates
    .filter((entry) => wantedReports.some((report) => entry.reports.includes(report)))
    .map((entry) => entry.date)
    .filter((date) => wantedReports.some((report) => reportExists(localPath, date, report)));
}

function availableDatesFromManifest(manifest: Manifest, wantedReports: string[]): string[] {
  const dates = manifest.dates ?? [];
  return dates
    .filter((entry) => wantedReports.some((report) => entry.reports.includes(report)))
    .map((entry) => entry.date);
}

function pickDate(candidates: string[], explicitDate?: string): {
  requestedDate: string;
  resolvedDate: string;
  fallbackUsed: boolean;
  notes: string[];
} {
  const today = new Date().toISOString().slice(0, 10);
  const requestedDate = explicitDate ?? today;
  const sorted = [...candidates].sort((a, b) => b.localeCompare(a));

  if (sorted.includes(requestedDate)) {
    return {
      requestedDate,
      resolvedDate: requestedDate,
      fallbackUsed: false,
      notes: [`using requested digest date ${requestedDate}`],
    };
  }

  if (!explicitDate) {
    const latest = sorted[0] ?? requestedDate;
    return {
      requestedDate,
      resolvedDate: latest,
      fallbackUsed: latest !== requestedDate,
      notes:
        latest === requestedDate
          ? [`no matching digest reports found; keeping default date ${requestedDate}`]
          : [`defaulted to latest available digest date ${latest}`],
    };
  }

  const fallback = sorted.find((date) => date <= requestedDate) ?? sorted[0];
  if (!fallback) {
    return {
      requestedDate,
      resolvedDate: requestedDate,
      fallbackUsed: false,
      notes: [`no available digest fallback found for requested date ${requestedDate}`],
    };
  }

  return {
    requestedDate,
    resolvedDate: fallback,
    fallbackUsed: fallback !== requestedDate,
    notes:
      fallback === requestedDate
        ? [`using requested digest date ${requestedDate}`]
        : [`requested digest date ${requestedDate} missing; fell back to ${fallback}`],
  };
}

function normalizeGitHubRepoUrl(repoUrl: string): string | null {
  const trimmed = repoUrl.trim().replace(/\/+$/, "").replace(/\.git$/, "");
  return /^https?:\/\/github\.com\/[^/]+\/[^/]+$/i.test(trimmed) ? trimmed : null;
}

function gitHubRawUrls(repoUrl: string, branch: string, filePath: string): string[] {
  const normalized = normalizeGitHubRepoUrl(repoUrl);
  if (!normalized) return [];
  return [`${normalized}/raw/refs/heads/${branch}/${filePath}`, `${normalized}/raw/${branch}/${filePath}`];
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "text/plain, application/json",
        "User-Agent": "agent-radar/source-fetch",
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchFirstAvailableText(urls: string[], timeoutMs: number): Promise<string | null> {
  for (const url of urls) {
    const text = await fetchText(url, timeoutMs);
    if (text !== null) return text;
  }
  return null;
}

function buildResultFromLocalFiles(
  config: SourceConfig["agentsRadar"],
  manifest: Manifest,
  explicitDate?: string,
): AgentsRadarFetchResult {
  const dateSelection = pickDate(availableDates(manifest, config.reports.daily, config.localPath), explicitDate);
  const digestDir = path.join(config.localPath, "digests", dateSelection.resolvedDate);
  const signals: RawSignal[] = [];
  const missingReports: string[] = [];
  const notes = [...dateSelection.notes];

  if (dateSelection.fallbackUsed) {
    notes.push("digest_missing_for_requested_date");
  }

  for (const reportName of config.reports.daily) {
    const filePath = path.join(digestDir, `${reportName}.md`);
    if (!fs.existsSync(filePath)) {
      missingReports.push(reportName);
      continue;
    }
    const markdown = fs.readFileSync(filePath, "utf-8");
    signals.push(...signalsFromMarkdown(markdown, "agents-radar", `${dateSelection.resolvedDate}T00:00:00.000Z`));
  }

  if (missingReports.length > 0) {
    notes.push("report_parse_partial");
    notes.push(`missing_reports=${missingReports.join(",")}`);
  }
  if (signals.length === 0 && config.reports.daily.length > 0) {
    notes.push("digest_missing_for_requested_date");
  }
  notes.push(`loaded ${signals.length} signals from ${dateSelection.resolvedDate}`);

  return {
    signals,
    requested_date: dateSelection.requestedDate,
    resolved_date: dateSelection.resolvedDate,
    fallback_used: dateSelection.fallbackUsed,
    notes,
  };
}

async function tryGitHubHttpSource(
  config: SourceConfig["agentsRadar"],
  explicitDate?: string,
): Promise<AgentsRadarFetchResult | null> {
  const repoUrl = normalizeGitHubRepoUrl(config.repoUrl ?? "https://github.com/duanyytop/agents-radar");
  if (!repoUrl) return null;

  const timeoutMs = Math.min(config.refreshTimeoutMs ?? 300000, 15000);
  for (const branch of ["main", "master"]) {
    const manifestText = await fetchFirstAvailableText(gitHubRawUrls(repoUrl, branch, "manifest.json"), timeoutMs);
    if (!manifestText) continue;

    let manifest: Manifest = {};
    try {
      manifest = JSON.parse(manifestText) as Manifest;
    } catch {
      continue;
    }

    const dateSelection = pickDate(availableDatesFromManifest(manifest, config.reports.daily), explicitDate);
    const notes = [
      "remote_source_loaded",
      `agents-radar source loaded from ${repoUrl} via github-http`,
      `source_branch=${branch}`,
      ...dateSelection.notes,
    ];
    const signals: RawSignal[] = [];
    const missingReports: string[] = [];

    if (dateSelection.fallbackUsed) {
      notes.push("digest_missing_for_requested_date");
    }

    for (const reportName of config.reports.daily) {
      const reportText = await fetchFirstAvailableText(
        gitHubRawUrls(repoUrl, branch, `digests/${dateSelection.resolvedDate}/${reportName}.md`),
        timeoutMs,
      );
      if (!reportText) {
        missingReports.push(reportName);
        continue;
      }
      signals.push(...signalsFromMarkdown(reportText, "agents-radar", `${dateSelection.resolvedDate}T00:00:00.000Z`));
    }

    if (missingReports.length > 0) {
      notes.push("report_parse_partial");
      notes.push(`missing_reports=${missingReports.join(",")}`);
    }
    if (signals.length === 0 && config.reports.daily.length > 0) {
      notes.push("digest_missing_for_requested_date");
    }
    notes.push(`loaded ${signals.length} signals from ${dateSelection.resolvedDate}`);

    return {
      signals,
      requested_date: dateSelection.requestedDate,
      resolved_date: dateSelection.resolvedDate,
      fallback_used: dateSelection.fallbackUsed,
      notes,
    };
  }

  return null;
}

export async function fetchAgentsRadarSignalsDetailed(
  config: SourceConfig["agentsRadar"],
  opts: { date?: string } = {},
): Promise<AgentsRadarFetchResult> {
  const requestedDate = opts.date ?? new Date().toISOString().slice(0, 10);
  if (!config.enabled) {
    return {
      signals: [],
      requested_date: requestedDate,
      resolved_date: requestedDate,
      fallback_used: false,
      notes: ["agents-radar source disabled in config"],
    };
  }

  if (config.mode === "github-http") {
    const remote = await tryGitHubHttpSource(config, opts.date);
    if (remote) return remote;
    return {
      signals: [],
      requested_date: requestedDate,
      resolved_date: requestedDate,
      fallback_used: false,
      notes: ["remote_source_unavailable"],
    };
  }

  if (!fs.existsSync(config.manifestPath)) {
    return {
      signals: [],
      requested_date: requestedDate,
      resolved_date: requestedDate,
      fallback_used: false,
      notes: ["manifest_missing", `missing manifest: ${config.manifestPath}`],
    };
  }

  return buildResultFromLocalFiles(config, readManifest(config.manifestPath), opts.date);
}

export async function fetchAgentsRadarSignals(
  config: SourceConfig["agentsRadar"],
  opts: { date?: string } = {},
): Promise<RawSignal[]> {
  const result = await fetchAgentsRadarSignalsDetailed(config, opts);
  return result.signals;
}
