import { describe, expect, it } from "vitest";
import { runMissionScoutDiscovery } from "../signal/missionScoutDiscovery.ts";
import type { DirectionCatalogEntry } from "../signal/directionCatalog.ts";

const catalogEntry: DirectionCatalogEntry = {
  direction_key: "coding-agent",
  family_key: "agent-stack",
  display_name_cn: "编码代理",
  boundary_mode: "strict-agent",
  search_depth: "deep-daily",
  lane_types: ["canonical", "job-to-be-done", "user-speak-or-ecosystem"],
  required_terms: ["agent"],
  negative_terms: ["game"],
  evidence_verbs: ["write"],
  evidence_objects: ["code"],
  zero_result_explanation_cn: "今天还没有扫到足够相关的编码代理项目。",
  query_packs: [
    { lane_type: "canonical", templates: ["coding agent", "ai coding agent"] },
    { lane_type: "job-to-be-done", templates: ["agent that writes code", "repo coding assistant"] },
    { lane_type: "user-speak-or-ecosystem", templates: ["aider alternative", "cursor for teams"] },
  ],
};

describe("runMissionScoutDiscovery", () => {
  it("marks matched when a direction clears the quantity floor", async () => {
    const result = await runMissionScoutDiscovery({
      catalog: [catalogEntry],
      githubSearchEnabled: true,
      search: async () => ({
        status: "ok",
        raw_hits: 24,
        normalized_hits: 8,
        quality_passed_hits: 3,
        lane_hits: {
          canonical: 10,
          "job-to-be-done": 8,
          "user-speak-or-ecosystem": 6,
        },
        repo_candidates: [
          { repo_full_name: "acme/coder", repo_url: "https://github.com/acme/coder" },
          { repo_full_name: "acme/patcher", repo_url: "https://github.com/acme/patcher" },
        ],
        query_count: 6,
      }),
    });

    expect(result.coverage_atlas).toHaveLength(1);
    expect(result.coverage_atlas[0]?.outcome).toBe("matched");
    expect(result.coverage_atlas[0]?.quantity_target_met).toBe(true);
    expect(result.coverage_atlas[0]?.candidate_counts.quality_passed_hits).toBe(3);
  });

  it("distinguishes weak, zero and failed directions without collapsing them into one bucket", async () => {
    const result = await runMissionScoutDiscovery({
      catalog: [
        catalogEntry,
        { ...catalogEntry, direction_key: "memory", display_name_cn: "记忆系统" },
        { ...catalogEntry, direction_key: "browser", display_name_cn: "浏览器代理" },
      ],
      githubSearchEnabled: true,
      search: async ({ direction }) => {
        if (direction.direction_key === "coding-agent") {
          return {
            status: "ok",
            raw_hits: 12,
            normalized_hits: 4,
            quality_passed_hits: 1,
            lane_hits: { canonical: 6, "job-to-be-done": 4, "user-speak-or-ecosystem": 2 },
            repo_candidates: [],
            query_count: 6,
          };
        }
        if (direction.direction_key === "memory") {
          return {
            status: "ok",
            raw_hits: 0,
            normalized_hits: 0,
            quality_passed_hits: 0,
            lane_hits: { canonical: 0, "job-to-be-done": 0, "user-speak-or-ecosystem": 0 },
            repo_candidates: [],
            query_count: 6,
          };
        }
        return {
          status: "failed",
          raw_hits: 0,
          normalized_hits: 0,
          quality_passed_hits: 0,
          lane_hits: { canonical: 0, "job-to-be-done": 0, "user-speak-or-ecosystem": 0 },
          repo_candidates: [],
          query_count: 6,
          error: "timeout",
        };
      },
    });

    expect(result.coverage_atlas.map((item) => item.outcome)).toEqual(["weak_signal", "zero_candidate", "search_failed"]);
    expect(result.gap_ledger.map((item) => item.direction_key)).toEqual(["coding-agent", "memory", "browser"]);
  });

  it("marks directions disabled when mission github search is turned off", async () => {
    const result = await runMissionScoutDiscovery({
      catalog: [catalogEntry],
      githubSearchEnabled: false,
      search: async () => {
        throw new Error("should not be called");
      },
    });

    expect(result.coverage_atlas[0]?.outcome).toBe("disabled");
    expect(result.coverage_atlas[0]?.next_action).toBe("needs_human_seed_refinement");
    expect(result.gap_ledger[0]?.family_key).toBe("agent-stack");
    expect(result.gap_ledger[0]?.candidate_counts.raw_hits).toBe(0);
  });
});
