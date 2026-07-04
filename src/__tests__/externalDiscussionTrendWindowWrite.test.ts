import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildExternalDiscussionTrendWindow, buildSkippedExternalDiscussionTrendWindow } from "../externalDiscovery/trendWindow.ts";
import { runDailyExternalTrendWindowIntegration, writeExternalDiscussionTrendWindow } from "../externalDiscovery/trendWindowIntegration.ts";
import type { ExternalDiscussionTrendWindow } from "../externalDiscovery/types.ts";
import { aggregateForDate, loadedWindow, trendEvidence, TREND_TEST_DATES } from "./externalDiscussionTrendWindowFixtures.ts";

const roots: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function setupWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "external-trend-window-write-"));
  roots.push(root);
  process.chdir(root);
  return root;
}

describe("external discussion trend window writes", () => {
  it("writes date-specific and latest files after public-safe checks", () => {
    const root = setupWorkspace();
    const trendWindow = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: loadedWindow({
        "2026-07-02": aggregateForDate({
          date: "2026-07-02",
          project_evidence: [trendEvidence({ scope: "project", target_key: "openai/agents", date: "2026-07-02", mention_count: 2 })],
        }),
      }),
    });

    const paths = writeExternalDiscussionTrendWindow({ date: "2026-07-03", trendWindow });

    expect(paths.trend_window.replace(/\\/g, "/")).toBe("data/external-discovery/windows/2026-07-03.discussion-trend-window.json");
    expect(paths.trend_window_latest.replace(/\\/g, "/")).toBe("data/external-discovery/windows/latest.discussion-trend-window.json");
    expect(fs.existsSync(path.join(root, paths.trend_window))).toBe(true);
    expect(fs.existsSync(path.join(root, paths.trend_window_latest))).toBe(true);
  });

  it("updates latest for insufficient, failed, and skipped public-safe artifacts", () => {
    const root = setupWorkspace();
    const insufficient = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: TREND_TEST_DATES.map((date) => ({
        status: "missing",
        date,
        path: `data/external-discovery/${date}.aggregate.json`,
      })),
    });
    expect(insufficient.status).toBe("insufficient");
    writeExternalDiscussionTrendWindow({ date: "2026-07-03", trendWindow: insufficient });
    expect(readLatest(root).status).toBe("insufficient");

    const failed = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:01:00.000Z",
      aggregateResults: TREND_TEST_DATES.map((date) => ({
        status: "failed",
        date,
        path: `data/external-discovery/${date}.aggregate.json`,
        reason_code: "window_aggregate_parse_failed",
        reason_detail: "Unexpected token",
      })),
    });
    expect(failed.status).toBe("failed");
    writeExternalDiscussionTrendWindow({ date: "2026-07-03", trendWindow: failed });
    expect(readLatest(root).status).toBe("failed");

    const skipped = buildSkippedExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:02:00.000Z",
      statusReason: "external_discovery_disabled",
    });
    writeExternalDiscussionTrendWindow({ date: "2026-07-03", trendWindow: skipped });
    expect(readLatest(root).status).toBe("skipped");
  });

  it("does not write date-specific or latest files when public-safe checks fail", () => {
    const root = setupWorkspace();
    const invalid = {
      ...buildSkippedExternalDiscussionTrendWindow({
        anchorDate: "2026-07-03",
        generatedAt: "2026-07-03T00:00:00.000Z",
        statusReason: "external_discovery_disabled",
      }),
      contains_raw_text: true,
    } as unknown as ExternalDiscussionTrendWindow;

    expect(() => writeExternalDiscussionTrendWindow({ date: "2026-07-03", trendWindow: invalid })).toThrow(/not public-safe/);
    expect(fs.existsSync(path.join(root, "data", "external-discovery", "windows", "2026-07-03.discussion-trend-window.json"))).toBe(false);
    expect(fs.existsSync(path.join(root, "data", "external-discovery", "windows", "latest.discussion-trend-window.json"))).toBe(false);
  });

  it("writes skipped from daily integration when external discovery is skipped", () => {
    const root = setupWorkspace();
    const result = runDailyExternalTrendWindowIntegration({
      date: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      currentAggregate: aggregateForDate({ date: "2026-07-03", status: "skipped" }),
    });

    expect(result.trend_window.status).toBe("skipped");
    expect(readLatest(root).status).toBe("skipped");
  });
});

function readLatest(root: string): ExternalDiscussionTrendWindow {
  return JSON.parse(
    fs.readFileSync(path.join(root, "data", "external-discovery", "windows", "latest.discussion-trend-window.json"), "utf-8"),
  ) as ExternalDiscussionTrendWindow;
}
