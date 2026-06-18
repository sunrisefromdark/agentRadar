import { describe, expect, expectTypeOf, it } from "vitest";
import type { RawSignal, ScoreComponentName, SignalSource } from "../types.ts";
import {
  EXTERNAL_DIRECTION_LABELS,
  EXTERNAL_PLATFORMS,
  EXTERNAL_TARGET_TYPES,
  type DailyExternalAggregate,
  type ExternalDirectionLabel,
  type ExternalEvidence,
  type ExternalSignalEvent,
  type ExternalSignalKind,
  type ObservationCandidate,
} from "../externalDiscovery/types.ts";
import * as externalPaths from "../externalDiscovery/paths.ts";

type NonEmptyArray<T> = readonly [T, ...T[]];

describe("external discovery type contract", () => {
  it("freezes research and office direction labels as a closed union", () => {
    expect(EXTERNAL_DIRECTION_LABELS).toEqual([
      "research-agent",
      "literature-review-agent",
      "research-data-analysis-agent",
      "academic-writing-agent",
      "office-agent",
      "personal-assistant-agent",
      "office-productivity-agent",
      "document-agent",
      "spreadsheet-agent",
      "meeting-agent",
      "workflow-automation-agent",
      "vertical-office-agent",
      "legal-agent",
      "finance-agent",
      "sales-crm-agent",
      "hr-agent",
      "healthcare-admin-agent",
      "education-agent",
      "enterprise-ops-agent",
    ]);
    expect(EXTERNAL_DIRECTION_LABELS).toContain("research-agent");
    expect(EXTERNAL_DIRECTION_LABELS).toContain("office-agent");
    expect(EXTERNAL_DIRECTION_LABELS).not.toContain("mcp");
    expect(EXTERNAL_DIRECTION_LABELS).not.toContain("browser-agent");
    expectTypeOf<(typeof EXTERNAL_DIRECTION_LABELS)[number]>().toEqualTypeOf<ExternalDirectionLabel>();
  });

  it("threads canonical direction labels through event, evidence, candidate, and aggregate contracts", () => {
    expectTypeOf<ExternalSignalEvent["direction_labels"]>().toEqualTypeOf<ExternalDirectionLabel[]>();
    expectTypeOf<ExternalEvidence["direction_labels"]>().toEqualTypeOf<ExternalDirectionLabel[]>();
    expectTypeOf<ObservationCandidate["direction_labels"]>().toEqualTypeOf<
      ExternalDirectionLabel[]
    >();
    expectTypeOf<DailyExternalAggregate["direction_label_counts"]>().toEqualTypeOf<
      Partial<Record<ExternalDirectionLabel, number>>
    >();
  });

  it("freezes the V1 platform whitelist", () => {
    expect(EXTERNAL_PLATFORMS).toEqual([
      "x_twitter",
      "reddit",
      "hacker_news",
      "official_web",
      "official_blog",
    ]);
    expect(EXTERNAL_PLATFORMS).toContain("x_twitter");
    expect(EXTERNAL_PLATFORMS).toContain("official_blog");
    expect(EXTERNAL_PLATFORMS).not.toContain("x");
  });

  it("freezes target types without treating direction as a target type", () => {
    expect(EXTERNAL_TARGET_TYPES).toEqual(["project", "paper", "product", "topic"]);
    expect(EXTERNAL_TARGET_TYPES).toContain("product");
    expect(EXTERNAL_TARGET_TYPES).toContain("topic");
    expect(EXTERNAL_TARGET_TYPES).not.toContain("direction");
    expect(EXTERNAL_TARGET_TYPES).not.toContain("unknown");
  });

  it("allows one event to derive both discovery and evidence semantics", () => {
    const event = {
      event_id: "evt-1",
      provider: "agent-reach",
      platform: "official_blog",
      raw_event_kind: "official_release",
      derived_signal_kinds: ["discovery", "evidence"],
      observed_at: "2026-06-14T00:00:00.000Z",
      ingested_at: "2026-06-14T00:01:00.000Z",
      event_url: "https://example.com/release",
      actor: {
        actor_type: "team",
        effective_tier: "unknown",
        tier_basis: "unknown",
      },
      target: {
        target_type: "topic",
        name: "agent workflow verification",
        topic_key: "agent-workflow-verification",
        binding_confidence: "unbound",
      },
      direction_labels: [],
      tags: [],
      notes: [],
    } satisfies ExternalSignalEvent;

    expect(event.derived_signal_kinds).toEqual(["discovery", "evidence"]);
    expectTypeOf<ExternalSignalEvent["derived_signal_kinds"]>().toExtend<
      NonEmptyArray<ExternalSignalKind>
    >();
  });

  it("keeps direction as scope plus topic target, not a target type", () => {
    const directionCandidate = {
      candidate_id: "cand-direction-1",
      scope: "direction",
      candidate_kind: "direction_watch",
      target_key: "topic:agent-workflow-verification",
      display_name: "agent workflow verification",
      topic_key: "agent-workflow-verification",
      direction_labels: [],
      binding_confidence: "unbound",
      evidence_ids: ["ev-1"],
      evidence_summary_cn: "外部层仅形成方向级观察。",
      qualification: "observe",
      can_enter_daily: false,
      can_enter_weekly: true,
      cannot_be_primary_conclusion: true,
      caveats: ["尚未绑定明确 repo / paper。"],
    } satisfies ObservationCandidate;

    expect(directionCandidate.scope).toBe("direction");
    expect(directionCandidate.topic_key).toBe("agent-workflow-verification");
    expect(directionCandidate.cannot_be_primary_conclusion).toBe(true);
    expectTypeOf<ObservationCandidate["cannot_be_primary_conclusion"]>().toEqualTypeOf<true>();
  });

  it("does not extend primary RawSignal source or score component contracts", () => {
    type ExternalSignalSourceLeak = Extract<
      SignalSource,
      "agent-reach" | "external_discovery" | "x_twitter" | "reddit" | "hacker_news"
    >;
    type ExternalScoreComponentLeak = Extract<
      ScoreComponentName,
      "external_discovery" | "external_evidence" | "external_discussion"
    >;

    expectTypeOf<RawSignal["source"]>().toEqualTypeOf<SignalSource>();
    expectTypeOf<ExternalSignalSourceLeak>().toEqualTypeOf<never>();
    expectTypeOf<ExternalScoreComponentLeak>().toEqualTypeOf<never>();
  });

  it("defines Phase 1 artifact paths without a production events JSONL path", () => {
    expect(externalPaths.externalRawInputPath("2026-06-14")).toBe(
      "data/raw/external-discovery/2026-06-14.agent-reach.json",
    );
    expect(externalPaths.externalAggregatePath("2026-06-14")).toBe(
      "data/external-discovery/2026-06-14.aggregate.json",
    );
    expect(externalPaths.externalAggregateLatestPath()).toBe(
      "data/external-discovery/latest.aggregate.json",
    );
    expect(externalPaths.externalEntityRegistryPath()).toBe(
      "data/external-discovery/entity-registry.json",
    );
    expect(externalPaths.externalSanitizedFixtureDirPath()).toBe(
      "data/raw/external-discovery/fixtures",
    );
    expect(externalPaths).not.toHaveProperty("externalEventsPath");
  });

  it("requires public aggregate redaction markers and source hash in the type contract", () => {
    expectTypeOf<DailyExternalAggregate["public_safe"]>().toEqualTypeOf<true>();
    expectTypeOf<DailyExternalAggregate["source_input_hash"]>().toEqualTypeOf<string>();
    expectTypeOf<DailyExternalAggregate["contains_raw_text"]>().toEqualTypeOf<false>();
    expectTypeOf<DailyExternalAggregate["contains_profile_urls"]>().toEqualTypeOf<false>();
  });
});
