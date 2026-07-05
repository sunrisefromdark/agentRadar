import fs from "node:fs";
import { writeJsonFile } from "../storage/files.ts";
import { externalTrendWindowLatestPath, externalTrendWindowPath } from "./paths.ts";
import { assertPublicSafeTrendWindow } from "./redaction.ts";
import {
  buildExternalDiscussionTrendWindow,
  buildSkippedExternalDiscussionTrendWindow,
  readExternalAggregateWindow,
  type ExternalAggregateWindowReadResult,
} from "./trendWindow.ts";
import type { DailyExternalAggregate, ExternalDiscussionTrendWindow } from "./types.ts";
import type { ExternalTrendWindowReadStatus, ExternalTrendWindowStatus } from "./types.ts";

export interface DailyExternalTrendWindowIntegrationResult {
  trend_window: ExternalDiscussionTrendWindow;
  paths: {
    trend_window: string;
    trend_window_latest: string;
  };
}

export interface ExternalDiscussionTrendWindowReadResult {
  read_status: ExternalTrendWindowReadStatus;
  path: string;
  trend_window?: ExternalDiscussionTrendWindow;
  error?: string;
}

const TREND_WINDOW_ARTIFACT_STATUSES: ExternalTrendWindowStatus[] = [
  "ok",
  "partial",
  "failed",
  "insufficient",
  "skipped",
];

export function readExternalDiscussionTrendWindowByDate(date: string): ExternalDiscussionTrendWindowReadResult {
  return readExternalDiscussionTrendWindowFromPath(externalTrendWindowPath(date));
}

export function readLatestExternalDiscussionTrendWindow(): ExternalDiscussionTrendWindowReadResult {
  return readExternalDiscussionTrendWindowFromPath(externalTrendWindowLatestPath());
}

function readExternalDiscussionTrendWindowFromPath(filepath: string): ExternalDiscussionTrendWindowReadResult {
  if (!fs.existsSync(filepath)) {
    return { read_status: "not_found", path: filepath };
  }

  try {
    const trendWindow = JSON.parse(fs.readFileSync(filepath, "utf-8")) as ExternalDiscussionTrendWindow;
    const validationError = validateTrendWindowArtifact(trendWindow);
    if (validationError) {
      return { read_status: "parse_error", path: filepath, error: validationError };
    }
    return {
      read_status: trendWindow.status,
      path: filepath,
      trend_window: trendWindow,
    };
  } catch (error) {
    return {
      read_status: "parse_error",
      path: filepath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function validateTrendWindowArtifact(value: ExternalDiscussionTrendWindow): string | undefined {
  if (!value || typeof value !== "object") return "trend window artifact must be an object";
  if (value.schema_version !== "external-discussion-trend-window.v1") {
    return `unexpected schema_version ${String((value as { schema_version?: unknown }).schema_version)}`;
  }
  if (!TREND_WINDOW_ARTIFACT_STATUSES.includes(value.status)) {
    return `unexpected status ${String((value as { status?: unknown }).status)}`;
  }
  const safety = assertPublicSafeTrendWindow(value);
  if (!safety.ok) {
    return `public-safe check failed: ${safety.reason_codes.join(",")}`;
  }
  return undefined;
}

export function writeExternalDiscussionTrendWindow(args: {
  date: string;
  trendWindow: ExternalDiscussionTrendWindow;
  dryRun?: boolean;
}): DailyExternalTrendWindowIntegrationResult["paths"] {
  const safety = assertPublicSafeTrendWindow(args.trendWindow);
  if (!safety.ok) {
    throw new Error(`external discussion trend window is not public-safe: ${safety.reason_codes.join(",")}`);
  }

  const trendWindowPath = externalTrendWindowPath(args.date);
  const trendWindowLatestPath = externalTrendWindowLatestPath();
  writeJsonFile(trendWindowPath, args.trendWindow, args.dryRun);
  writeJsonFile(trendWindowLatestPath, args.trendWindow, args.dryRun);

  return {
    trend_window: trendWindowPath,
    trend_window_latest: trendWindowLatestPath,
  };
}

export function runDailyExternalTrendWindowIntegration(args: {
  date: string;
  generatedAt: string;
  dryRun?: boolean;
  currentAggregate: DailyExternalAggregate;
}): DailyExternalTrendWindowIntegrationResult {
  const trendWindow =
    args.currentAggregate.status === "skipped"
      ? buildSkippedExternalDiscussionTrendWindow({
          anchorDate: args.date,
          generatedAt: args.generatedAt,
          statusReason: args.currentAggregate.status_reason ?? "external_discovery_skipped",
        })
      : buildExternalDiscussionTrendWindow({
          anchorDate: args.date,
          generatedAt: args.generatedAt,
          aggregateResults: currentAggregateWindow(args.date, args.currentAggregate),
        });

  const paths = writeExternalDiscussionTrendWindow({
    date: args.date,
    trendWindow,
    dryRun: args.dryRun,
  });

  return {
    trend_window: trendWindow,
    paths,
  };
}

function currentAggregateWindow(date: string, aggregate: DailyExternalAggregate): ExternalAggregateWindowReadResult[] {
  return readExternalAggregateWindow(date).map((result) =>
    result.date === date
      ? {
          status: "loaded",
          date,
          path: result.path,
          aggregate,
        }
      : result,
  );
}
