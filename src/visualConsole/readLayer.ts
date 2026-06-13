import fs from "node:fs";
import path from "node:path";
import type {
  DailyReport,
  DailyRunSummary,
  EcosystemObserverArtifact,
  GitHubEnrichmentAuditEntry,
  KnowledgeCard,
  VerifyDailyResult,
  WeeklyAuditReport,
  WeeklyJudgmentReport,
  WeeklyReport,
} from "../types.ts";
import { getFilesystemStateSignature, readCachedDirectoryEntries, readCachedJsonFile, readCachedTextFile } from "./fileCache.ts";
import { parseWeeklyMarkdown } from "./weeklyMarkdown.ts";
import type { DailyTimeNavigatorPreview, ReadResult, TopLevelViewStatus, WeeklyTimeNavigatorPreview } from "./types.ts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REPORTS_DIR = path.join("data", "reports");

type DerivedCacheEntry<T> = {
  signature: string;
  value: T;
};

const dailyNavigatorPreviewCache = new Map<string, DerivedCacheEntry<DailyTimeNavigatorPreview>>();
const weeklyNavigatorPreviewCache = new Map<string, DerivedCacheEntry<WeeklyTimeNavigatorPreview>>();

function readDerivedCache<T>(
  cache: Map<string, DerivedCacheEntry<T>>,
  key: string,
  signature: string,
  load: () => T,
): T {
  const cached = cache.get(key);
  if (cached && cached.signature === signature) {
    return cached.value;
  }
  const value = load();
  cache.set(key, { signature, value });
  return value;
}

function unsupported<T>(filepath: string, reason: string): ReadResult<T> {
  return { status: "unsupported_context", path: filepath, reason };
}

function readJsonStrict<T>(filepath: string): ReadResult<T> {
  if (!fs.existsSync(filepath)) return { status: "not_found", path: filepath };
  try {
    return { status: "ok", path: filepath, value: readCachedJsonFile<T>(filepath) };
  } catch (error) {
    return {
      status: "parse_error",
      path: filepath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readTextStrict(filepath: string): ReadResult<string> {
  if (!fs.existsSync(filepath)) return { status: "not_found", path: filepath };
  try {
    return { status: "ok", path: filepath, value: readCachedTextFile(filepath) };
  } catch (error) {
    return {
      status: "parse_error",
      path: filepath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function validateDateInput<T>(date: string, filepath: string): ReadResult<T> | null {
  if (!DATE_RE.test(date)) return unsupported(filepath, `expected YYYY-MM-DD but received "${date}"`);
  return null;
}

export function listAvailableDailyDates(): string[] {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  return readCachedDirectoryEntries(REPORTS_DIR)
    .map((entry) => /^(\d{4}-\d{2}-\d{2})\.daily\.json$/.exec(entry)?.[1])
    .filter((entry): entry is string => Boolean(entry))
    .sort();
}

export function listAvailableWeeklyAnchors(): string[] {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  return readCachedDirectoryEntries(REPORTS_DIR)
    .map((entry) => /^(\d{4}-\d{2}-\d{2})\.weekly\.md$/.exec(entry)?.[1])
    .filter((entry): entry is string => Boolean(entry))
    .sort();
}

export function getDailyReport(date: string): ReadResult<DailyReport> {
  const filepath = path.join("data", "reports", `${date}.daily.json`);
  return validateDateInput(date, filepath) ?? readJsonStrict<DailyReport>(filepath);
}

export function getRunSummary(date: string): ReadResult<DailyRunSummary> {
  const filepath = path.join("data", "reports", `${date}.run-summary.json`);
  return validateDateInput(date, filepath) ?? readJsonStrict<DailyRunSummary>(filepath);
}

export function getVerifyDailyResult(date: string): ReadResult<VerifyDailyResult> {
  const filepath = path.join("data", "reports", `${date}.verify-daily.json`);
  return validateDateInput(date, filepath) ?? readJsonStrict<VerifyDailyResult>(filepath);
}

export function getWeeklyReport(anchorDate: string): ReadResult<string> {
  const filepath = path.join("data", "reports", `${anchorDate}.weekly.md`);
  return validateDateInput(anchorDate, filepath) ?? readTextStrict(filepath);
}

export function getWeeklyStructuredReport(anchorDate: string): ReadResult<WeeklyReport> {
  const filepath = path.join("data", "reports", `${anchorDate}.weekly.json`);
  return validateDateInput(anchorDate, filepath) ?? readJsonStrict<WeeklyReport>(filepath);
}

export function getWeeklyJudgmentReport(anchorDate: string): ReadResult<WeeklyJudgmentReport> {
  const filepath = path.join("data", "reports", `${anchorDate}.weekly.judgment.json`);
  return validateDateInput(anchorDate, filepath) ?? readJsonStrict<WeeklyJudgmentReport>(filepath);
}

export function getWeeklyAudit(anchorDate: string): ReadResult<WeeklyAuditReport> {
  const filepath = path.join("data", "reports", `${anchorDate}.weekly.audit.json`);
  return validateDateInput(anchorDate, filepath) ?? readJsonStrict<WeeklyAuditReport>(filepath);
}

export function getScores(date: string): ReadResult<unknown[]> {
  const filepath = path.join("data", "scores", `${date}.json`);
  return validateDateInput(date, filepath) ?? readJsonStrict<unknown[]>(filepath);
}

export function getKbIndex(): ReadResult<KnowledgeCard[]> {
  return readJsonStrict<KnowledgeCard[]>(path.join("data", "kb", "latest.json"));
}

export function getKbCard(slug: string): ReadResult<string> {
  const filepath = path.join("data", "kb", `${slug}.md`);
  if (!slug.trim()) return unsupported<string>(filepath, "empty KB slug");
  return readTextStrict(filepath);
}

export function getGithubEnrichmentAudit(date: string): ReadResult<GitHubEnrichmentAuditEntry[]> {
  const filepath = path.join("data", "raw", "github", `${date}.enrichment.json`);
  return validateDateInput(date, filepath) ?? readJsonStrict<GitHubEnrichmentAuditEntry[]>(filepath);
}

export function getGithubEnrichment(repoKey: string): ReadResult<Record<string, unknown>> {
  const filepath = path.join("data", "raw", "github", `${repoKey}.json`);
  if (!repoKey.trim()) return unsupported<Record<string, unknown>>(filepath, "empty repo key");
  return readJsonStrict<Record<string, unknown>>(filepath);
}

export function getObserverArtifact(date: string): ReadResult<EcosystemObserverArtifact> {
  const filepath = path.join("data", "observer", "ecosystem-focus", `${date}.json`);
  return validateDateInput(date, filepath) ?? readJsonStrict<EcosystemObserverArtifact>(filepath);
}

function summarizeDailyPreviewState(
  daily: ReadResult<DailyReport>,
  runSummary: ReadResult<DailyRunSummary>,
  verify: ReadResult<VerifyDailyResult>,
): TopLevelViewStatus {
  if (daily.status !== "ok") return "failed";
  if (daily.value.all_projects.length === 0) return "empty";
  if (!daily.value.overall_daily_status) return "not-judgeable";
  if (runSummary.status !== "ok" || verify.status !== "ok" || daily.value.enhancement_status === "rules-only") {
    return "degraded";
  }
  return "ready";
}

function readPreviewTopDecisionCount(report: DailyReport): number {
  const todayPulseProjects = Array.isArray(report.today_pulse_projects) ? report.today_pulse_projects : [];
  const todayStarProjects = Array.isArray(report.today_star_projects) ? report.today_star_projects : [];
  return todayPulseProjects.length > 0 ? todayPulseProjects.length : todayStarProjects.length;
}

function summarizeWeeklyPreviewState(
  weekly: ReadResult<string>,
  audit: ReadResult<WeeklyAuditReport>,
  parsedWeekly: ReturnType<typeof parseWeeklyMarkdown> | null,
  judgment: ReadResult<WeeklyJudgmentReport>,
): TopLevelViewStatus {
  if (weekly.status !== "ok" || !parsedWeekly) return "failed";
  const coreCount =
    parsedWeekly.core_trend_cards.length > 0
      ? parsedWeekly.core_trend_cards.length
      : judgment.status === "ok"
        ? judgment.value.established_trends.length
        : 0;
  const weakCount =
    parsedWeekly.weak_signal_cards.length > 0
      ? parsedWeekly.weak_signal_cards.length
      : judgment.status === "ok"
        ? judgment.value.observing_trends.length
        : 0;
  const enhancementStatus =
    parsedWeekly.enhancement_status ?? (judgment.status === "ok" ? judgment.value.enhancement_status : null);
  if (coreCount === 0 && weakCount === 0) return "empty";
  if (coreCount === 0) return "not-judgeable";
  if (audit.status !== "ok" || enhancementStatus === "rules-only") return "degraded";
  return "ready";
}

export function getDailyNavigatorPreview(date: string): DailyTimeNavigatorPreview {
  const signature = getFilesystemStateSignature([
    path.join("data", "reports", `${date}.daily.json`),
    path.join("data", "reports", `${date}.run-summary.json`),
    path.join("data", "reports", `${date}.verify-daily.json`),
  ]);
  return readDerivedCache(dailyNavigatorPreviewCache, date, signature, () => {
    const daily = getDailyReport(date);
    const runSummary = getRunSummary(date);
    const verify = getVerifyDailyResult(date);
    const sourceStatus = runSummary.status === "ok" ? runSummary.value.source_status : [];

    return {
      kind: "daily",
      slice_key: date,
      generated_at: daily.status === "ok" ? daily.value.generated_at : null,
      top_level_state: summarizeDailyPreviewState(daily, runSummary, verify),
      enhancement_status: daily.status === "ok" ? daily.value.enhancement_status : null,
      top_decision_count: daily.status === "ok" ? readPreviewTopDecisionCount(daily.value) : 0,
      source_active_count: sourceStatus.filter((entry) => entry.status === "active").length,
      failed_count: sourceStatus.filter((entry) => entry.status === "failed").length,
      empty_count: sourceStatus.filter((entry) => entry.status === "empty").length,
      verify_status: verify.status === "ok" ? verify.value.status : null,
    };
  });
}

export function getWeeklyNavigatorPreview(anchorDate: string): WeeklyTimeNavigatorPreview {
  const signature = getFilesystemStateSignature([
    path.join("data", "reports", `${anchorDate}.weekly.md`),
    path.join("data", "reports", `${anchorDate}.weekly.audit.json`),
    path.join("data", "reports", `${anchorDate}.weekly.judgment.json`),
  ]);
  return readDerivedCache(weeklyNavigatorPreviewCache, anchorDate, signature, () => {
    const weekly = getWeeklyReport(anchorDate);
    const parsedWeekly = weekly.status === "ok" ? parseWeeklyMarkdown(weekly.value) : null;
    const audit = getWeeklyAudit(anchorDate);
    const judgment = getWeeklyJudgmentReport(anchorDate);
    const coreTrendCount =
      parsedWeekly?.core_trend_cards.length || (judgment.status === "ok" ? judgment.value.established_trends.length : 0);
    const weakSignalCount =
      parsedWeekly?.weak_signal_cards.length || (judgment.status === "ok" ? judgment.value.observing_trends.length : 0);
    const enhancementStatus = parsedWeekly?.enhancement_status ?? (judgment.status === "ok" ? judgment.value.enhancement_status : null);

    return {
      kind: "weekly",
      slice_key: anchorDate,
      generated_at: parsedWeekly?.generated_at ?? (judgment.status === "ok" ? judgment.value.generated_at : null),
      top_level_state: summarizeWeeklyPreviewState(weekly, audit, parsedWeekly, judgment),
      enhancement_status: enhancementStatus,
      core_trend_count: coreTrendCount,
      weak_signal_count: weakSignalCount,
      audit_status: audit.status,
    };
  });
}
