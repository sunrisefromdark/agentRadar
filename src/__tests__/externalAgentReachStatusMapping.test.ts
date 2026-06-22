import { describe, expect, it } from "vitest";

import {
  completeAgentReachCoverage,
  mapGatewayRunStatusToProviderStatus,
} from "../externalAgentReach/statusMapping.ts";

describe("external AgentReach status mapping", () => {
  it.each([
    [{ gateway_status: "ok" as const }, "ok"],
    [{ gateway_status: "partial" as const }, "partial"],
    [{ gateway_status: "skipped" as const }, "skipped"],
    [{ gateway_status: "not_configured" as const }, "skipped"],
    [{ gateway_status: "unavailable" as const, configured: false }, "skipped"],
    [{ gateway_status: "unavailable" as const, configured: true }, "failed"],
    [{ gateway_status: "failed" as const }, "failed"],
  ])("maps gateway run status %# to public provider status %s", (input, expected) => {
    expect(mapGatewayRunStatusToProviderStatus(input)).toBe(expected);
  });

  it("does not expose coverage-only states as top-level provider statuses", () => {
    for (const gateway_status of ["not_configured", "unavailable"] as const) {
      expect(mapGatewayRunStatusToProviderStatus({ gateway_status })).not.toBe(gateway_status);
    }
  });

  it("completes missing V1 platform coverage without collapsing absence into no signal", () => {
    const coverage = completeAgentReachCoverage({
      x_twitter: { status: "ok", reason: "zero_relevant_results" },
      reddit: { status: "failed", reason: "rate_limited" },
    });

    expect(coverage).toEqual({
      x_twitter: { status: "ok", reason: "zero_relevant_results" },
      reddit: { status: "failed", reason: "rate_limited" },
      hacker_news: { status: "not_configured", reason: "platform_not_returned_by_gateway" },
      official_web: { status: "not_configured", reason: "platform_not_returned_by_gateway" },
      official_blog: { status: "not_configured", reason: "platform_not_returned_by_gateway" },
    });
  });
});
