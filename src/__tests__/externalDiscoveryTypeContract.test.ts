import { describe, expect, it } from "vitest";
import { externalAggregateLatestPath, externalAggregatePath, externalEntityRegistryPath, externalRawInputPath, externalSanitizedFixtureDirPath } from "../externalDiscovery/paths.ts";
import { EXTERNAL_PLATFORMS, EXTERNAL_TARGET_TYPES } from "../externalDiscovery/types.ts";

describe("external discovery type and path contract", () => {
  it("freezes the V1 platform and target enums", () => {
    expect(EXTERNAL_PLATFORMS).toEqual(["x_twitter", "reddit", "hacker_news", "official_web", "official_blog"]);
    expect(EXTERNAL_PLATFORMS).not.toContain("x");
    expect(EXTERNAL_TARGET_TYPES).toEqual(["project", "paper", "product", "topic"]);
    expect(EXTERNAL_TARGET_TYPES).not.toContain("direction");
    expect(EXTERNAL_TARGET_TYPES).not.toContain("unknown");
  });

  it("keeps external discovery raw input and public aggregate paths separate", () => {
    expect(slash(externalRawInputPath("2026-06-30"))).toBe("data/raw/external-discovery/2026-06-30.agent-reach.json");
    expect(slash(externalAggregatePath("2026-06-30"))).toBe("data/external-discovery/2026-06-30.aggregate.json");
    expect(slash(externalAggregateLatestPath())).toBe("data/external-discovery/latest.aggregate.json");
    expect(slash(externalEntityRegistryPath())).toBe("data/external-discovery/entity-registry.json");
    expect(slash(externalSanitizedFixtureDirPath())).toBe("data/raw/external-discovery/fixtures");
  });
});

function slash(value: string): string {
  return value.replace(/\\/g, "/");
}
