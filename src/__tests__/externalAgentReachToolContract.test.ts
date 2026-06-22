import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  AGENTREACH_TOOL_NAMES,
  buildAgentReachGatewayRequest,
} from "../externalAgentReach/toolSurface.ts";

describe("external AgentReach tool contract", () => {
  it("exposes stable task-level agentreach tool names", () => {
    expect(AGENTREACH_TOOL_NAMES).toEqual([
      "agentreach.capabilities",
      "agentreach.search",
      "agentreach.collectActorMessages",
      "agentreach.discoverProjects",
      "agentreach.collectTrendSignals",
    ]);
  });

  it("builds backend-agnostic gateway requests for V1 formal platforms", () => {
    const request = buildAgentReachGatewayRequest({
      intent: "collect_trend_signals",
      platforms: ["x_twitter", "reddit"],
      topic: "research agents",
      actors: [{ registry_id: "actor:openai", name: "OpenAI" }],
      time_window: { since: "2026-06-15", until: "2026-06-22" },
      max_results: 25,
      budget: { max_items_per_platform: 15 },
      allowed_evidence_classes: ["trend_signal", "actor_message"],
    });

    expect(request).toEqual({
      intent: "collect_trend_signals",
      platforms: ["x_twitter", "reddit"],
      topic: "research agents",
      actors: [{ registry_id: "actor:openai", name: "OpenAI" }],
      time_window: { since: "2026-06-15", until: "2026-06-22" },
      max_results: 25,
      budget: { max_items_per_platform: 15 },
      allowed_evidence_classes: ["trend_signal", "actor_message"],
      public_safety_mode: "public_safe_only",
    });
    expect(JSON.stringify(request).toLowerCase()).not.toContain("opencli");
    expect(JSON.stringify(request).toLowerCase()).not.toContain("mcporter");
    expect(JSON.stringify(request).toLowerCase()).not.toContain("cookie");
    expect(JSON.stringify(request).toLowerCase()).not.toContain("token");
  });

  it("rejects platforms outside the V1 formal external-discovery scope", () => {
    expect(() =>
      buildAgentReachGatewayRequest({
        intent: "search",
        platforms: ["x_twitter", "youtube"],
        query: "agent runtime",
      }),
    ).toThrow("unsupported_external_platform:youtube");
  });

  it("keeps the external AgentReach bridge independent from legacy producers and live providers", () => {
    const moduleDir = path.join(process.cwd(), "src", "externalAgentReach");
    const moduleFiles = fs
      .readdirSync(moduleDir)
      .filter((entry) => entry.endsWith(".ts"));

    for (const file of moduleFiles) {
      const text = fs.readFileSync(path.join(moduleDir, file), "utf-8");
      expect(text).not.toMatch(/from\s+["']\.\.\/agentReach\//);
      expect(text).not.toContain("runAgentReachProviders");
      expect(text).not.toContain("AGENT_REACH_PROVIDER_REGISTRY");
      expect(text).not.toContain("webSearchProvider");
      expect(text).not.toContain("xTwitterProvider");
      expect(text).not.toContain("redditProvider");
    }
  });
});
