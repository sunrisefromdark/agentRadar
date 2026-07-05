import { describe, expect, it } from "vitest";
import { buildExternalDiscussionTrendWindow } from "../externalDiscovery/trendWindow.ts";
import { aggregateForDate, loadedWindow, trendEvidence, TREND_TEST_DATES } from "./externalDiscussionTrendWindowFixtures.ts";

describe("external discussion trend window builder", () => {
  it("builds a 7-day public-safe project trend from daily aggregates", () => {
    const results = loadedWindow({
      "2026-07-01": aggregateForDate({
        date: "2026-07-01",
        project_evidence: [
          trendEvidence({
            scope: "project",
            target_key: "pydantic/pydantic-ai",
            date: "2026-07-01",
            mention_count: 1,
            platforms: ["hacker_news"],
          }),
        ],
      }),
      "2026-07-02": aggregateForDate({
        date: "2026-07-02",
        project_evidence: [
          trendEvidence({
            scope: "project",
            target_key: "pydantic/pydantic-ai",
            date: "2026-07-02",
            mention_count: 2,
            platforms: ["reddit", "official_blog"],
          }),
        ],
      }),
    });

    const window = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: results,
    });

    expect(window.schema_version).toBe("external-discussion-trend-window.v1");
    expect(window.window_start).toBe("2026-06-27");
    expect(window.window_end).toBe("2026-07-03");
    expect(window.coverage.expected_dates).toEqual(TREND_TEST_DATES);
    expect(window.coverage.usable_day_count).toBe(7);
    expect(window.public_safe).toBe(true);

    const trend = window.project_trends[0];
    expect(trend).toMatchObject({
      scope: "project",
      target_key: "pydantic/pydantic-ai",
      display_name: "pydantic/pydantic-ai",
      target_url: "https://github.com/pydantic/pydantic-ai",
      official_signal: true,
      mention_count_total: 3,
      source_count: 3,
      active_day_count: 2,
      platform_count: 3,
      cannot_be_primary_conclusion: true,
    });
    expect(window.direction_trends).toEqual([]);
    expect(trend?.daily_counts.find((count) => count.date === "2026-07-01")?.mention_count).toBe(1);
    expect(trend?.daily_counts.find((count) => count.date === "2026-07-02")?.mention_count).toBe(2);
  });

  it("keeps missing days in coverage instead of treating them as zero signal", () => {
    const results = loadedWindow({
      "2026-07-02": aggregateForDate({
        date: "2026-07-02",
        project_evidence: [trendEvidence({ scope: "project", target_key: "openai/agents", date: "2026-07-02", mention_count: 2 })],
      }),
    }).map((result) =>
      result.date === "2026-07-01"
        ? { status: "missing" as const, date: result.date, path: result.path }
        : result,
    );

    const window = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: results,
    });

    expect(window.status).toBe("partial");
    expect(window.coverage.missing_dates).toEqual(["2026-07-01"]);
    expect(window.project_trends[0]?.daily_counts.some((count) => count.date === "2026-07-01")).toBe(false);
    expect(window.audit.warnings.some((warning) => warning.reason_code === "window_aggregate_missing")).toBe(true);
  });

  it("does not infer official signals from non-official platforms", () => {
    const window = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: loadedWindow({
        "2026-07-01": aggregateForDate({
          date: "2026-07-01",
          project_evidence: [
            trendEvidence({
              scope: "project",
              target_key: "anthropics/claude-code",
              date: "2026-07-01",
              mention_count: 2,
              platforms: ["hacker_news", "reddit"],
            }),
          ],
        }),
      }),
    });

    expect(window.project_trends[0]?.official_signal).toBe(false);
  });

  it("keeps direction evidence out of project trends", () => {
    const window = buildExternalDiscussionTrendWindow({
      anchorDate: "2026-07-03",
      generatedAt: "2026-07-03T00:00:00.000Z",
      aggregateResults: loadedWindow({
        "2026-07-01": aggregateForDate({
          date: "2026-07-01",
          direction_evidence: [
            trendEvidence({
              scope: "direction",
              target_key: "agent-runtime",
              date: "2026-07-01",
              mention_count: 2,
              platforms: ["hacker_news", "reddit"],
            }),
          ],
        }),
      }),
    });

    expect(window.project_trends).toEqual([]);
    expect(window.direction_trends[0]?.scope).toBe("direction");
    expect(window.direction_trends[0]?.binding_confidence).toBe("low");
  });
});
