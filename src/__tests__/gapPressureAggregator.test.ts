import { describe, expect, it } from "vitest";
import { aggregateGapPressure, applyObserverPromotions } from "../feedback/gapPressureAggregator.ts";

describe("aggregateGapPressure", () => {
  it("marks a direction pressurized when any frozen threshold is hit", () => {
    const result = aggregateGapPressure({
      date: "2026-06-12",
      feedbackEvents: [
        { direction_key: "coding-agent", event_type: "search_zero_result", timestamp: "2026-06-11T00:00:00.000Z" },
        { direction_key: "coding-agent", event_type: "search_zero_result", timestamp: "2026-06-12T00:00:00.000Z" },
      ],
    });

    expect(result.direction_states["coding-agent"]?.pressure_state).toBe("pressurized");
  });

  it("marks a direction relieved only when the relief conditions are satisfied", () => {
    const result = aggregateGapPressure({
      date: "2026-06-12",
      feedbackEvents: [
        { direction_key: "memory", event_type: "matched", timestamp: "2026-06-10T00:00:00.000Z" },
        { direction_key: "memory", event_type: "matched", timestamp: "2026-06-12T00:00:00.000Z" },
      ],
    });

    expect(result.direction_states["memory"]?.pressure_state).toBe("relieved");
  });

  it("carries recent pressure counts forward so repeated zero results across days become actionable", () => {
    const result = aggregateGapPressure({
      date: "2026-06-12",
      previousDirectionStates: {
        "shopping-commerce-agent": {
          pressure_state: "normal",
          counts: { search_zero_result: 1 },
        },
      },
      feedbackEvents: [
        {
          direction_key: "shopping-commerce-agent",
          event_type: "search_zero_result",
          timestamp: "2026-06-12T00:00:00.000Z",
        },
      ],
    });

    expect(result.direction_states["shopping-commerce-agent"]?.counts.search_zero_result).toBe(2);
    expect(result.direction_states["shopping-commerce-agent"]?.pressure_state).toBe("pressurized");
  });

  it("promotes related directions when observer promotion candidates are present", () => {
    const result = aggregateGapPressure({
      date: "2026-06-12",
      feedbackEvents: [],
    });

    const promoted = applyObserverPromotions(result.direction_states, [
      {
        direction_key: "multi-agent-coordination",
        display_name_cn: "多代理协作生态",
        status: "incubating-active",
        observer_hits_7d: 3,
        candidate_repo_count: 1,
        related_ecosystems: ["multi-agent-coordination"],
        related_catalog_direction_keys: ["workflow-automation-agent"],
        related_gap_pressure_states: ["pressurized"],
        representative_repos: [{ repo_full_name: "acme/swarm", repo_url: "https://github.com/acme/swarm" }],
        evidence: ["observer_hits_7d=3"],
        unmet_gates: [],
        promotion_candidate: true,
        review_queue: "observer promotion review",
      },
    ]);

    expect(promoted["workflow-automation-agent"]?.pressure_state).toBe("promoted");
  });
});
