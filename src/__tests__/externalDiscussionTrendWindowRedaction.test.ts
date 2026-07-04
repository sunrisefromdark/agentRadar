import { describe, expect, it } from "vitest";
import { assertPublicSafeTrendWindow } from "../externalDiscovery/redaction.ts";

function safeTrendWindow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "external-discussion-trend-window.v1",
    anchor_date: "2026-07-03",
    window_start: "2026-06-27",
    window_end: "2026-07-03",
    window_days: 7,
    generated_at: "2026-07-03T00:00:00.000Z",
    status: "ok",
    project_trends: [],
    direction_trends: [],
    coverage: {
      expected_dates: [],
      loaded_dates: [],
      missing_dates: [],
      failed_dates: [],
      usable_day_count: 0,
      platform_counts: {},
      partial_platforms: [],
    },
    audit: { rejected_items: [], warnings: [] },
    public_safe: true,
    redaction_policy_version: "external-discovery-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    ...overrides,
  };
}

describe("external discussion trend window redaction", () => {
  it("accepts public-safe trend windows", () => {
    expect(assertPublicSafeTrendWindow(safeTrendWindow()).ok).toBe(true);
  });

  it("rejects raw provider identity or private text leakage", () => {
    const result = assertPublicSafeTrendWindow(
      safeTrendWindow({
        project_trends: [
          {
            trend_id: "project:test",
            handle: "@raw",
            platform_profile_url: "https://x.com/raw-profile",
            status_reason: "oauth token leaked",
          },
        ],
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason_codes).toContain("forbidden_key:handle");
    expect(result.reason_codes).toContain("forbidden_key:platform_profile_url");
    expect(result.reason_codes).toContain("forbidden_profile_url_text");
    expect(result.reason_codes).toContain("forbidden_secret_text");
  });

  it("requires trend-window schema and safety flags", () => {
    const result = assertPublicSafeTrendWindow(
      safeTrendWindow({
        schema_version: "external-discovery.aggregate.v1",
        public_safe: false,
        contains_raw_text: true,
        contains_profile_urls: true,
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason_codes).toContain("invalid_trend_window_schema_version");
    expect(result.reason_codes).toContain("public_safe_not_true");
    expect(result.reason_codes).toContain("contains_raw_text_not_false");
    expect(result.reason_codes).toContain("contains_profile_urls_not_false");
  });
});
