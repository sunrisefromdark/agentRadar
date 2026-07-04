import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildExternalDiscussionTrendWindow, buildSkippedExternalDiscussionTrendWindow } from "../externalDiscovery/trendWindow.ts";
import {
  readExternalDiscussionTrendWindowByDate,
  readLatestExternalDiscussionTrendWindow,
  writeExternalDiscussionTrendWindow,
} from "../externalDiscovery/trendWindowIntegration.ts";
import { aggregateForDate, loadedWindow, trendEvidence } from "./externalDiscussionTrendWindowFixtures.ts";

const roots: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function setupWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "external-trend-window-read-"));
  roots.push(root);
  process.chdir(root);
  return root;
}

describe("external discussion trend window read status", () => {
  it("does not fallback from a date-specific read to latest", () => {
    setupWorkspace();
    const skipped = buildSkippedExternalDiscussionTrendWindow({
      anchorDate: "2026-07-02",
      generatedAt: "2026-07-02T00:00:00.000Z",
      statusReason: "external_discovery_disabled",
    });
    writeExternalDiscussionTrendWindow({ date: "2026-07-02", trendWindow: skipped });

    expect(readLatestExternalDiscussionTrendWindow().read_status).toBe("skipped");
    const dateSpecific = readExternalDiscussionTrendWindowByDate("2026-07-03");
    expect(dateSpecific.read_status).toBe("not_found");
    expect(dateSpecific.trend_window).toBeUndefined();
  });

  it("maps invalid JSON and schema mismatch to parse_error", () => {
    const root = setupWorkspace();
    fs.mkdirSync(path.join(root, "data", "external-discovery", "windows"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "data", "external-discovery", "windows", "2026-07-03.discussion-trend-window.json"),
      "{not-json",
      "utf-8",
    );
    expect(readExternalDiscussionTrendWindowByDate("2026-07-03").read_status).toBe("parse_error");

    fs.writeFileSync(
      path.join(root, "data", "external-discovery", "windows", "2026-07-03.discussion-trend-window.json"),
      JSON.stringify({ schema_version: "wrong" }),
      "utf-8",
    );
    expect(readExternalDiscussionTrendWindowByDate("2026-07-03").read_status).toBe("parse_error");
  });

  it("passes through the artifact status for valid windows", () => {
    setupWorkspace();
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
    writeExternalDiscussionTrendWindow({ date: "2026-07-03", trendWindow });

    const result = readExternalDiscussionTrendWindowByDate("2026-07-03");
    expect(result.read_status).toBe(trendWindow.status);
    expect(result.trend_window?.schema_version).toBe("external-discussion-trend-window.v1");
  });
});
