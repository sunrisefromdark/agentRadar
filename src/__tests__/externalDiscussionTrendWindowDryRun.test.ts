import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSkippedExternalDiscussionTrendWindow } from "../externalDiscovery/trendWindow.ts";
import { writeExternalDiscussionTrendWindow } from "../externalDiscovery/trendWindowIntegration.ts";

const roots: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function setupWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "external-trend-window-dry-run-"));
  roots.push(root);
  process.chdir(root);
  return root;
}

describe("external discussion trend window dry-run", () => {
  it("returns planned paths without writing date-specific or latest files", () => {
    const root = setupWorkspace();
    const trendWindow = buildSkippedExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      statusReason: "external_discovery_disabled",
    });

    const paths = writeExternalDiscussionTrendWindow({
      date: "2026-07-03",
      trendWindow,
      dryRun: true,
    });

    expect(paths.trend_window.replace(/\\/g, "/")).toBe("data/external-discovery/windows/2026-07-03.discussion-trend-window.json");
    expect(paths.trend_window_latest.replace(/\\/g, "/")).toBe("data/external-discovery/windows/latest.discussion-trend-window.json");
    expect(fs.existsSync(path.join(root, paths.trend_window))).toBe(false);
    expect(fs.existsSync(path.join(root, paths.trend_window_latest))).toBe(false);
  });
});
