import { describe, expect, it } from "vitest";
import { runMissionDeepDiscovery } from "../signal/missionDeepDiscovery.ts";
import type { DirectionCoverageStatus, ScoredProject } from "../types.ts";

function makeCoverage(directionKey: string, outcome: DirectionCoverageStatus["outcome"]): DirectionCoverageStatus {
  return {
    direction_key: directionKey,
    family_key: "agent-stack",
    display_name_cn: directionKey,
    boundary_mode: "strict-agent",
    search_depth: "deep",
    query_pack_count: 3,
    query_template_count: 6,
    lane_types: ["canonical", "job-to-be-done", "user-speak-or-ecosystem"],
    pressure_state: "normal",
    outcome,
    reason_codes: [],
    explanation_cn: "",
    next_action: "keep_watching",
    candidate_counts: {
      raw_hits: 24,
      boundary_passed_hits: 8,
      normalized_hits: 8,
      quality_passed_hits: 3,
      exposed_hits: 1,
    },
    quantity_target_met: outcome === "matched",
    search_exhausted: false,
  };
}

function makeScored(repo: string, tags: string[]): ScoredProject {
  return {
    project: {
      project_name: repo.split("/")[1] ?? repo,
      repo_url: `https://github.com/${repo}`,
      repo_full_name: repo,
      first_seen: "2026-06-10T00:00:00.000Z",
      last_seen: "2026-06-12T00:00:00.000Z",
      sources: ["github_trending"],
      source_counts: { github_trending: 1 },
      appearances: 2,
      appearance_dates: ["2026-06-11", "2026-06-12"],
      persistence_state: "emerging",
      stars: 1000,
      star_delta_daily: 80,
      forks: 10,
      issues: 5,
      PR: 1,
      tags,
      description: `${tags.join(" ")} project`,
      metrics_source: "embedded",
      metrics_trust_score: 0.7,
      data_trust: "medium",
      star_delta_available: true,
      star_delta_source: "signal",
      trust_flags: [],
      raw_signals: [],
    },
    score: {
      total_score: 82,
      components: [],
      verdict: "high",
      confidence: "high",
      trust_score: 0.8,
      data_trust: "medium",
      paradigm: "agentic",
      anti_noise_flags: [],
      risks: [],
      next_actions: [],
      rules_only: true,
    },
  };
}

describe("runMissionDeepDiscovery", () => {
  it("promotes qualified mission matches and preserves appearance reasons", async () => {
    const result = await runMissionDeepDiscovery({
      coverageAtlas: [makeCoverage("coding-agent", "matched")],
      scoredProjects: [makeScored("acme/coder", ["agent", "coding-agent"])],
      explicitInterestSignals: [{ direction_key: "coding-agent", signal_type: "search", timestamp: "2026-06-12T00:00:00.000Z" }],
    });

    expect(result.mission_match_projects).toHaveLength(1);
    expect(result.mission_match_projects[0]?.direction_matches).toEqual(["coding-agent"]);
    expect(result.mission_match_projects[0]?.appearance_reason_codes).toContain("mission_direction_match");
    expect(result.mission_discovery_status).toBe("active");
  });

  it("marks search exhausted when deep review still cannot form qualified matches", async () => {
    const result = await runMissionDeepDiscovery({
      coverageAtlas: [makeCoverage("memory", "weak_signal")],
      scoredProjects: [],
      explicitInterestSignals: [{ direction_key: "memory", signal_type: "favorite", timestamp: "2026-06-12T00:00:00.000Z" }],
    });

    expect(result.coverage_atlas[0]?.search_exhausted).toBe(true);
    expect(result.gap_ledger[0]?.reason_codes).toContain("search_exhausted");
  });
});
