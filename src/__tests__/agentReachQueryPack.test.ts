import { describe, expect, it } from "vitest";

import { AGENT_REACH_QUERY_PACK } from "../agentReach/queryPack.ts";
import {
  EXTERNAL_DIRECTION_LABELS,
  type ExternalDirectionLabel,
} from "../externalDiscovery/types.ts";

const allowedLabels = new Set<string>(EXTERNAL_DIRECTION_LABELS);

describe("AgentReach query pack", () => {
  it("binds every query to stable direction labels", () => {
    expect(AGENT_REACH_QUERY_PACK.length).toBeGreaterThan(0);

    for (const query of AGENT_REACH_QUERY_PACK) {
      expect(query.terms.length).toBeGreaterThan(0);
      expect(query.direction_labels.length).toBeGreaterThan(0);
      expect(query.tags ?? []).not.toEqual(query.direction_labels);
      for (const label of query.direction_labels) {
        expect(allowedLabels.has(label)).toBe(true);
      }
    }
  });

  it("covers research, office, and vertical office focus areas", () => {
    const labels = new Set<ExternalDirectionLabel>(
      AGENT_REACH_QUERY_PACK.flatMap((query) => query.direction_labels),
    );

    expect(labels.has("research-agent")).toBe(true);
    expect(labels.has("literature-review-agent")).toBe(true);
    expect(labels.has("office-agent")).toBe(true);
    expect(labels.has("personal-assistant-agent")).toBe(true);
    expect(labels.has("workflow-automation-agent")).toBe(true);
    expect(labels.has("legal-agent")).toBe(true);
    expect(labels.has("finance-agent")).toBe(true);
    expect(labels.has("enterprise-ops-agent")).toBe(true);
  });

  it.each([
    ["document agent", ["document-agent", "office-agent"]],
    ["spreadsheet agent", ["spreadsheet-agent", "office-agent"]],
    ["meeting agent", ["meeting-agent", "office-agent"]],
    ["legal agent", ["legal-agent", "vertical-office-agent", "office-agent"]],
    ["finance agent", ["finance-agent", "vertical-office-agent", "office-agent"]],
    ["sales crm agent", ["sales-crm-agent", "vertical-office-agent", "office-agent"]],
    ["hr agent", ["hr-agent", "vertical-office-agent", "office-agent"]],
    ["enterprise operations agent", ["enterprise-ops-agent", "vertical-office-agent"]],
    ["healthcare admin agent", ["healthcare-admin-agent", "vertical-office-agent"]],
    ["education agent", ["education-agent", "vertical-office-agent"]],
  ] as const)("maps %s only to its specific direction and parent labels", (term, expectedLabels) => {
    const matches = AGENT_REACH_QUERY_PACK.filter((query) => query.terms.includes(term));

    expect(matches).toHaveLength(1);
    expect(matches[0]?.direction_labels).toEqual(expectedLabels);
  });
});
