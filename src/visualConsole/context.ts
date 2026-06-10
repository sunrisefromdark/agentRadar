import path from "node:path";
import { toLocalDateStr } from "../date.ts";
import { listAvailableDailyDates, listAvailableWeeklyAnchors } from "./readLayer.ts";
import type { ArtifactRef, ContextResolution, TimeSliceWindow, ViewContext, WeeklyWindow } from "./types.ts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function baseContext(mode: "daily" | "weekly", entryKind: "explicit-date" | "latest-shortcut"): ViewContext {
  return {
    mode,
    selected_date: null,
    selected_window: null,
    entry_kind: entryKind,
    resolved_artifacts: [],
    generated_at: null,
    stale: false,
  };
}

function expectedDailyArtifacts(date: string): ArtifactRef[] {
  return [
    { kind: "daily", path: path.join("data", "reports", `${date}.daily.json`) },
    { kind: "run-summary", path: path.join("data", "reports", `${date}.run-summary.json`) },
    { kind: "verify-daily", path: path.join("data", "reports", `${date}.verify-daily.json`) },
    { kind: "github-enrichment-audit", path: path.join("data", "raw", "github", `${date}.enrichment.json`) },
  ];
}

function expectedWeeklyArtifacts(anchorDate: string): ArtifactRef[] {
  return [
    { kind: "weekly-markdown", path: path.join("data", "reports", `${anchorDate}.weekly.md`) },
    { kind: "weekly-judgment", path: path.join("data", "reports", `${anchorDate}.weekly.judgment.json`) },
    { kind: "weekly-audit", path: path.join("data", "reports", `${anchorDate}.weekly.audit.json`) },
  ];
}

function weeklyWindow(anchorDate: string): WeeklyWindow {
  const end = new Date(`${anchorDate}T00:00:00.000Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return {
    window_start: start.toISOString().slice(0, 10),
    window_end: anchorDate,
    anchor_date: anchorDate,
  };
}

function resolveTimeSliceWindow(values: string[], selectedValue: string | null): TimeSliceWindow {
  if (!selectedValue) {
    return {
      current: null,
      previous: null,
      next: null,
      latest: values.at(-1) ?? null,
      index: -1,
      total: values.length,
    };
  }

  const index = values.indexOf(selectedValue);
  if (index < 0) {
    return {
      current: selectedValue,
      previous: null,
      next: null,
      latest: values.at(-1) ?? null,
      index: -1,
      total: values.length,
    };
  }

  return {
    current: selectedValue,
    previous: values[index - 1] ?? null,
    next: values[index + 1] ?? null,
    latest: values.at(-1) ?? null,
    index,
    total: values.length,
  };
}

export function resolveNearestWeeklyAnchor(referenceDate: string | null | undefined): string | null {
  const anchors = listAvailableWeeklyAnchors();
  if (anchors.length === 0) return null;
  if (!referenceDate || referenceDate === "latest") return anchors.at(-1) ?? null;
  if (anchors.includes(referenceDate)) return referenceDate;
  return anchors.filter((anchor) => anchor <= referenceDate).at(-1) ?? anchors.at(-1) ?? null;
}

export function resolveDailyContext(dateOrLatest: string): ContextResolution {
  const context = baseContext("daily", dateOrLatest === "latest" ? "latest-shortcut" : "explicit-date");
  if (dateOrLatest !== "latest" && !DATE_RE.test(dateOrLatest)) {
    return { status: "failed", context, message: `unsupported daily date "${dateOrLatest}"` };
  }

  const resolvedDate = dateOrLatest === "latest" ? listAvailableDailyDates().at(-1) ?? null : dateOrLatest;
  if (!resolvedDate) return { status: "failed", context, message: "latest 快捷入口无法解析" };

  context.selected_date = resolvedDate;
  context.resolved_artifacts = expectedDailyArtifacts(resolvedDate);
  context.stale = dateOrLatest === "latest" && resolvedDate !== toLocalDateStr(new Date());
  return { status: "ok", context };
}

export function resolveWeeklyContext(anchorDateOrLatest: string): ContextResolution {
  const context = baseContext("weekly", anchorDateOrLatest === "latest" ? "latest-shortcut" : "explicit-date");
  if (anchorDateOrLatest !== "latest" && !DATE_RE.test(anchorDateOrLatest)) {
    return { status: "failed", context, message: `unsupported weekly anchor "${anchorDateOrLatest}"` };
  }

  const resolvedAnchor = anchorDateOrLatest === "latest" ? resolveNearestWeeklyAnchor(null) : resolveNearestWeeklyAnchor(anchorDateOrLatest);
  if (!resolvedAnchor) return { status: "failed", context, message: "latest 快捷入口无法解析" };

  context.selected_date = resolvedAnchor;
  context.selected_window = weeklyWindow(resolvedAnchor);
  context.resolved_artifacts = expectedWeeklyArtifacts(resolvedAnchor);
  context.stale =
    (anchorDateOrLatest === "latest" && resolvedAnchor !== toLocalDateStr(new Date())) ||
    (anchorDateOrLatest !== "latest" && resolvedAnchor !== anchorDateOrLatest);
  return { status: "ok", context };
}

export function resolveDailyTimeWindow(date: string | null): TimeSliceWindow {
  return resolveTimeSliceWindow(listAvailableDailyDates(), date);
}

export function resolveWeeklyTimeWindow(anchorDate: string | null): TimeSliceWindow {
  return resolveTimeSliceWindow(listAvailableWeeklyAnchors(), anchorDate);
}
