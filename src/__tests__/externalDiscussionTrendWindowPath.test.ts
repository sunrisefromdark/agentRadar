import { describe, expect, it } from "vitest";
import { externalTrendWindowLatestPath, externalTrendWindowPath } from "../externalDiscovery/paths.ts";

describe("external discussion trend window path contract", () => {
  it("stores trend windows under the windows subdirectory", () => {
    expect(slash(externalTrendWindowPath("2026-07-03"))).toBe("data/external-discovery/windows/2026-07-03.discussion-trend-window.json");
    expect(slash(externalTrendWindowLatestPath())).toBe("data/external-discovery/windows/latest.discussion-trend-window.json");
    expect(slash(externalTrendWindowPath("2026-07-03"))).not.toBe("data/external-discovery/2026-07-03.discussion-trend-window.json");
  });
});

function slash(value: string): string {
  return value.replace(/\\/g, "/");
}
