import { describe, expect, it } from "vitest";
import {
  EXTERNAL_TREND_COMPONENT_NAMES,
  EXTERNAL_TREND_WINDOW_READ_STATUSES,
  EXTERNAL_WEEKLY_GATE_REASONS,
  type ExternalDiscussionTrendWindow,
  type ExternalTrendItem,
} from "../externalDiscovery/types.ts";

describe("external discussion trend window type contract", () => {
  it("freezes read statuses and weekly gate reasons", () => {
    expect(EXTERNAL_TREND_WINDOW_READ_STATUSES).toEqual([
      "ok",
      "not_found",
      "parse_error",
      "partial",
      "insufficient",
      "failed",
      "skipped",
    ]);
    expect(EXTERNAL_WEEKLY_GATE_REASONS).toEqual([
      "cross_platform_confirmation",
      "multi_actor_confirmation",
      "multi_day_persistence",
      "registry_tier_participation",
    ]);
    expect(EXTERNAL_TREND_COMPONENT_NAMES).toEqual([
      "discussion_volume",
      "persistence",
      "cross_platform_confirmation",
      "actor_authority",
      "binding_confidence",
      "noise_risk",
    ]);
  });

  it("keeps trend items secondary-only", () => {
    const item: ExternalTrendItem = {
      trend_id: "project:pydantic/pydantic-ai",
      scope: "project",
      target_key: "pydantic/pydantic-ai",
      display_name: "pydantic/pydantic-ai",
      target_url: "https://github.com/pydantic/pydantic-ai",
      binding_confidence: "medium",
      official_signal: false,
      weekly_eligible: true,
      weekly_gate_reasons: ["cross_platform_confirmation", "multi_day_persistence"],
      weekly_gate_missing_reasons: ["multi_actor_confirmation", "registry_tier_participation"],
      daily_counts: [{ date: "2026-07-03", mention_count: 2, source_count: 2, platform_count: 2 }],
      mention_count_total: 2,
      source_count: 2,
      active_day_count: 1,
      platform_count: 2,
      cross_platform_days: 1,
      distinct_actor_count: 2,
      top_tier_actor_count: 0,
      named_registry_actors: [],
      components: [{ name: "noise_risk", level: "medium", evidence: ["single active day"] }],
      momentum: "spike",
      verdict: "external_reinforcement",
      cannot_be_primary_conclusion: true,
      evidence_ids: ["project:pydantic/pydantic-ai"],
      source_aggregate_dates: ["2026-07-03"],
      caveats: ["external trend is secondary evidence"],
    };

    expect(item.cannot_be_primary_conclusion).toBe(true);
    expect(item.weekly_gate_reasons).not.toContain("provider_tier_hint");
  });

  it("keeps the window public-safe by contract", () => {
    const window: ExternalDiscussionTrendWindow = {
      schema_version: "external-discussion-trend-window.v1",
      anchor_date: "2026-07-03",
      window_start: "2026-06-27",
      window_end: "2026-07-03",
      window_days: 7,
      generated_at: "2026-07-03T00:00:00.000Z",
      status: "insufficient",
      status_reason: "window_usable_days_insufficient",
      project_trends: [],
      direction_trends: [],
      coverage: {
        expected_dates: ["2026-06-27", "2026-06-28", "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03"],
        loaded_dates: [],
        missing_dates: ["2026-06-27", "2026-06-28", "2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03"],
        failed_dates: [],
        usable_day_count: 0,
        platform_counts: {},
        partial_platforms: [],
      },
      audit: {
        rejected_items: [],
        warnings: [{ reason_code: "window_usable_days_insufficient", reason_detail: "usable days 0/7" }],
      },
      public_safe: true,
      redaction_policy_version: "external-discovery-redaction.v1",
      contains_raw_text: false,
      contains_profile_urls: false,
    };

    expect(window.public_safe).toBe(true);
    expect(window.contains_raw_text).toBe(false);
    expect(window.contains_profile_urls).toBe(false);
  });
});
