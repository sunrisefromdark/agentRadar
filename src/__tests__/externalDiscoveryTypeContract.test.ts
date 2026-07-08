import { describe, expect, it } from "vitest";
import {
  externalAggregateLatestPath,
  externalAggregatePath,
  externalCandidateExplanationsLatestPath,
  externalCandidateExplanationsPath,
  externalEntityRegistryPath,
  externalRawInputPath,
  externalSanitizedFixtureDirPath,
} from "../externalDiscovery/paths.ts";
import {
  EXTERNAL_CANDIDATE_DISPLAY_BUCKETS,
  EXTERNAL_CANDIDATE_QUALITY_BUCKETS,
  EXTERNAL_CANDIDATE_QUALITY_REASONS,
  EXTERNAL_NAMED_ACTOR_SOURCE_ROLES,
  EXTERNAL_PLATFORMS,
  EXTERNAL_TARGET_TYPES,
} from "../externalDiscovery/types.ts";

describe("external discovery type and path contract", () => {
  it("freezes the V1 platform and target enums", () => {
    expect(EXTERNAL_PLATFORMS).toEqual(["x_twitter", "reddit", "hacker_news", "official_web", "official_blog"]);
    expect(EXTERNAL_PLATFORMS).not.toContain("x");
    expect(EXTERNAL_TARGET_TYPES).toEqual(["project", "paper", "product", "topic"]);
    expect(EXTERNAL_TARGET_TYPES).not.toContain("direction");
    expect(EXTERNAL_TARGET_TYPES).not.toContain("unknown");
    expect(EXTERNAL_NAMED_ACTOR_SOURCE_ROLES).toEqual(["social_discussant", "official_publisher", "official_owner"]);
    expect(EXTERNAL_CANDIDATE_QUALITY_BUCKETS).toEqual([
      "cross_platform_confirmed",
      "social_discussion",
      "official_source",
      "weak_single_source",
    ]);
    expect(EXTERNAL_CANDIDATE_DISPLAY_BUCKETS).toEqual([
      "project_evidence",
      "new_discovery",
      "direction_observation",
      "official_signal",
      "weak_followup",
    ]);
    expect(EXTERNAL_CANDIDATE_QUALITY_REASONS).toEqual([
      "cross_platform_confirmed",
      "social_platform_discussion",
      "official_platform_signal",
      "weak_single_source",
      "single_platform",
      "single_event",
      "evidence_missing",
      "external_evidence_present",
      "direction_candidate",
      "named_registry_actor_present",
      "quality_public_actor_present",
      "weekly_gate_not_met",
      "cannot_be_primary_conclusion",
    ]);
  });

  it("keeps external discovery raw input and public aggregate paths separate", () => {
    expect(slash(externalRawInputPath("2026-06-30"))).toBe("data/raw/external-discovery/2026-06-30.agent-reach.json");
    expect(slash(externalAggregatePath("2026-06-30"))).toBe("data/external-discovery/2026-06-30.aggregate.json");
    expect(slash(externalAggregateLatestPath())).toBe("data/external-discovery/latest.aggregate.json");
    expect(slash(externalCandidateExplanationsPath("2026-06-30"))).toBe("data/external-discovery/2026-06-30.candidate-explanations.json");
    expect(slash(externalCandidateExplanationsLatestPath())).toBe("data/external-discovery/latest.candidate-explanations.json");
    expect(slash(externalEntityRegistryPath())).toBe("data/external-discovery/entity-registry.json");
    expect(slash(externalSanitizedFixtureDirPath())).toBe("data/raw/external-discovery/fixtures");
  });
});

function slash(value: string): string {
  return value.replace(/\\/g, "/");
}
