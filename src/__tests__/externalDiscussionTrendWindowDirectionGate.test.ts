import { describe, expect, it } from "vitest";
import { buildExternalDiscussionTrendWindow } from "../externalDiscovery/trendWindow.ts";
import { aggregateForDate, loadedWindow, trendEvidence } from "./externalDiscussionTrendWindowFixtures.ts";

describe("external discussion trend window direction weekly gate", () => {
  it("does not make a one-gate direction weekly eligible", () => {
    const window = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: loadedWindow({
        "2026-07-02": aggregateForDate({
          date: "2026-07-02",
          direction_evidence: [
            trendEvidence({
              scope: "direction",
              target_key: "agent-runtime",
              date: "2026-07-02",
              mention_count: 2,
              platforms: ["hacker_news"],
              distinct_actor_count: 1,
            }),
          ],
        }),
      }),
    });

    const trend = window.direction_trends[0];
    expect(trend?.weekly_gate_reasons).toEqual([]);
    expect(trend?.weekly_eligible).toBe(false);
    expect(trend?.verdict).not.toBe("external_reinforcement");
  });

  it("allows direction weekly eligibility only after two frozen gates", () => {
    const window = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: loadedWindow({
        "2026-07-01": aggregateForDate({
          date: "2026-07-01",
          direction_evidence: [
            trendEvidence({
              scope: "direction",
              target_key: "agent-runtime",
              date: "2026-07-01",
              mention_count: 1,
              platforms: ["hacker_news"],
              distinct_actor_count: 1,
            }),
          ],
        }),
        "2026-07-02": aggregateForDate({
          date: "2026-07-02",
          direction_evidence: [
            trendEvidence({
              scope: "direction",
              target_key: "agent-runtime",
              date: "2026-07-02",
              mention_count: 2,
              platforms: ["reddit"],
              distinct_actor_count: 2,
            }),
          ],
        }),
      }),
    });

    const trend = window.direction_trends[0];
    expect(trend?.verdict).toBe("watch_signal");
    expect(trend?.weekly_eligible).toBe(true);
    expect(trend?.weekly_gate_reasons).toEqual([
      "cross_platform_confirmation",
      "multi_actor_confirmation",
      "multi_day_persistence",
    ]);
  });

  it("does not treat provider tier hints as registry participation", () => {
    const window = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: loadedWindow({
        "2026-07-01": aggregateForDate({
          date: "2026-07-01",
          direction_evidence: [
            trendEvidence({
              scope: "direction",
              target_key: "memory-agent",
              date: "2026-07-01",
              mention_count: 1,
              platforms: ["hacker_news"],
              distinct_actor_count: 1,
              top_tier_actor_count: 0,
              named_registry_actors: [],
            }),
          ],
        }),
        "2026-07-02": aggregateForDate({
          date: "2026-07-02",
          direction_evidence: [
            trendEvidence({
              scope: "direction",
              target_key: "memory-agent",
              date: "2026-07-02",
              mention_count: 1,
              platforms: ["hacker_news"],
              distinct_actor_count: 1,
              top_tier_actor_count: 0,
              named_registry_actors: [],
            }),
          ],
        }),
      }),
    });

    const trend = window.direction_trends[0];
    expect(trend?.weekly_gate_reasons).toEqual(["multi_day_persistence"]);
    expect(trend?.weekly_gate_reasons).not.toContain("registry_tier_participation");
    expect(trend?.top_tier_actor_count).toBe(0);
  });
});
