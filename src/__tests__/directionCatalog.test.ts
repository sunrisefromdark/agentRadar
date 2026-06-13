import { describe, expect, it } from "vitest";
import { DIRECTION_CATALOG, PROJECT_SEARCH_CONSTANTS, getDirectionByKey } from "../signal/directionCatalog.ts";

describe("directionCatalog", () => {
  it("freezes the v1 must-cover catalog with the expected coverage constraints", () => {
    expect(DIRECTION_CATALOG).toHaveLength(16);
    expect(new Set(DIRECTION_CATALOG.map((item) => item.family_key)).size).toBe(4);
    expect(PROJECT_SEARCH_CONSTANTS.queryPackCountMin).toBe(3);
    expect(PROJECT_SEARCH_CONSTANTS.queryTemplateCountPerPackMin).toBe(2);
    expect(PROJECT_SEARCH_CONSTANTS.globalHotQuota).toBe(4);
    expect(PROJECT_SEARCH_CONSTANTS.demandRelevantQuota).toBe(4);
    expect(PROJECT_SEARCH_CONSTANTS.anchorSeatCount).toBe(2);
    expect(PROJECT_SEARCH_CONSTANTS.challengerSeatCount).toBe(2);
    expect(DIRECTION_CATALOG.filter((item) => item.search_depth === "deep-daily")).toHaveLength(9);
    expect(DIRECTION_CATALOG.filter((item) => item.search_depth === "scout-daily")).toHaveLength(7);
  });

  it("ensures every direction carries the required search lanes and evidence metadata", () => {
    for (const direction of DIRECTION_CATALOG) {
      expect(direction.query_packs.length).toBeGreaterThanOrEqual(3);
      expect(direction.query_packs.every((pack) => pack.templates.length >= 2)).toBe(true);
      expect(direction.lane_types).toEqual(
        expect.arrayContaining(["canonical", "job-to-be-done", "user-speak", "ecosystem"]),
      );
      expect(direction.required_terms.length).toBeGreaterThan(0);
      expect(direction.evidence_verbs.length).toBeGreaterThan(0);
      expect(direction.evidence_objects.length).toBeGreaterThan(0);
      expect(direction.zero_result_explanation_cn.length).toBeGreaterThan(0);
    }
  });

  it("supports direction lookup by key", () => {
    const direction = getDirectionByKey("coding-agent");

    expect(direction?.display_name_cn).toBe("开发与编码代理");
    expect(direction?.boundary_mode).toBeDefined();
  });
});
