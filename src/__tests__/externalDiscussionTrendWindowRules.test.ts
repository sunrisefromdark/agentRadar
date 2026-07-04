import { describe, expect, it } from "vitest";
import { buildExternalDiscussionTrendWindow } from "../externalDiscovery/trendWindow.ts";
import { aggregateForDate, loadedWindow, trendEvidence } from "./externalDiscussionTrendWindowFixtures.ts";

describe("external discussion trend window rules", () => {
  it("marks single-day single-platform bursts as noise spikes", () => {
    const window = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: loadedWindow({
        "2026-07-03": aggregateForDate({
          date: "2026-07-03",
          project_evidence: [
            trendEvidence({
              scope: "project",
              target_key: "single/spike",
              date: "2026-07-03",
              mention_count: 6,
              platforms: ["hacker_news"],
              distinct_actor_count: 1,
            }),
          ],
        }),
      }),
    });

    const trend = window.project_trends[0];
    expect(trend?.momentum).toBe("spike");
    expect(trend?.verdict).toBe("noise_spike");
    expect(trend?.weekly_eligible).toBe(false);
    expect(trend?.components.find((component) => component.name === "noise_risk")?.level).toBe("high");
  });

  it("marks multi-day cross-platform project trends as external reinforcement", () => {
    const window = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: loadedWindow({
        "2026-06-30": aggregateForDate({
          date: "2026-06-30",
          project_evidence: [trendEvidence({ scope: "project", target_key: "cross/platform", date: "2026-06-30", mention_count: 1, platforms: ["hacker_news"] })],
        }),
        "2026-07-01": aggregateForDate({
          date: "2026-07-01",
          project_evidence: [trendEvidence({ scope: "project", target_key: "cross/platform", date: "2026-07-01", mention_count: 1, platforms: ["reddit"] })],
        }),
        "2026-07-02": aggregateForDate({
          date: "2026-07-02",
          project_evidence: [trendEvidence({ scope: "project", target_key: "cross/platform", date: "2026-07-02", mention_count: 2, platforms: ["hacker_news", "reddit"] })],
        }),
      }),
    });

    const trend = window.project_trends[0];
    expect(trend?.verdict).toBe("external_reinforcement");
    expect(trend?.weekly_eligible).toBe(true);
    expect(trend?.weekly_gate_reasons).toContain("cross_platform_confirmation");
    expect(trend?.weekly_gate_reasons).toContain("multi_day_persistence");
  });

  it("detects fading when early activity dominates and the last two loaded days are zero", () => {
    const window = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: loadedWindow({
        "2026-06-28": aggregateForDate({
          date: "2026-06-28",
          project_evidence: [trendEvidence({ scope: "project", target_key: "fading/project", date: "2026-06-28", mention_count: 2, platforms: ["reddit", "hacker_news"] })],
        }),
        "2026-06-29": aggregateForDate({
          date: "2026-06-29",
          project_evidence: [trendEvidence({ scope: "project", target_key: "fading/project", date: "2026-06-29", mention_count: 2, platforms: ["reddit", "hacker_news"] })],
        }),
      }),
    });

    expect(window.project_trends[0]?.momentum).toBe("fading");
  });

  it("does not force stable when counts are too weak", () => {
    const window = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: loadedWindow({
        "2026-07-02": aggregateForDate({
          date: "2026-07-02",
          project_evidence: [trendEvidence({ scope: "project", target_key: "weak/project", date: "2026-07-02", mention_count: 1, platforms: ["reddit"] })],
        }),
      }),
    });

    expect(window.project_trends[0]?.momentum).toBe("insufficient");
    expect(window.project_trends[0]?.verdict).toBe("insufficient");
  });
});
