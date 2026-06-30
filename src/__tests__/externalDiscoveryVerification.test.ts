import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildVerifyDailyResult } from "../action/dailyVerification.ts";
import type { DailyReport, DailyRunSummary } from "../types.ts";

const roots: string[] = [];
const originalCwd = process.cwd();
const date = "2026-06-30";

afterEach(() => {
  process.chdir(originalCwd);
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function setupWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "external-discovery-verification-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "data", "reports"), { recursive: true });
  fs.mkdirSync(path.join(root, "data", "raw", "github"), { recursive: true });
  fs.mkdirSync(path.join(root, "data", "external-discovery"), { recursive: true });
  process.chdir(root);
  return root;
}

function writeJson(filepath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(value, null, 2));
}

function makeSummary(): DailyRunSummary {
  return {
    date,
    generated_at: "2026-06-30T08:00:00.000Z",
    dry_run: true,
    minimum_viable_run_completed: true,
    completion_notes: [],
    counts: {
      raw_signals: 10,
      normalized_projects: 4,
      scored_projects: 4,
      high_score_projects: 2,
      anomaly_projects: 0,
      new_projects: 4,
      classifications: 4,
    },
    source_status: [
      {
        source: "github_trending",
        enabled: true,
        item_count: 10,
        distinct_projects: 4,
        status: "active",
        notes: [],
      },
    ],
    quality: {
      missing_descriptions: 0,
      watchlist_hits: 0,
      low_confidence_projects: 0,
      medium_confidence_projects: 0,
      insufficient_metrics_projects: 0,
      suspicious_growth_projects: 0,
      single_source_projects: 0,
      single_spike_projects: 0,
      emerging_projects: 4,
      persistent_projects: 0,
    },
    diagnostics: {
      anomaly_share: 0,
      uniform_star_velocity_detected: false,
      metrics_source_distribution: { embedded: 0, github_api: 0, github_html: 0, github_cache: 0, unavailable: 0 },
      star_delta_source_distribution: { github_live: 0, github_snapshot: 0, signal: 0, unavailable: 0 },
      github_star_delta: {
        live_delta_attempts: 0,
        live_delta_success: 0,
        snapshot_delta_success: 0,
        token_missing: 0,
        auth_invalid: 0,
        rate_limit: 0,
        network_blocked: 0,
      },
    },
    top_projects: [],
    observer_top_candidates: [],
    watchouts: [],
    next_focus: [],
    recommended_actions: [],
    freshness_sources: [],
    mission_discovery_status: "degraded",
    mission_degraded_reason_codes: ["no_matched_direction"],
  };
}

function makeReport(): DailyReport {
  return {
    date,
    generated_at: "2026-06-30T08:00:00.000Z",
    enhancement_status: "rules-only",
    enhancement_audit: { rejected_outputs: [] },
    personalized_relevance_applicable: false,
    overall_daily_status: "数据新鲜，可直接阅读",
    freshness_sources: [],
    today_fresh_candidate_count: 1,
    context_candidate_count: 1,
    pending_confirmation_count: 0,
    main_board_mode: "fresh_today_only",
    today_star_projects: [],
    context_only_projects: [],
    new_projects: [],
    high_score_projects: [],
    anomaly_projects: [],
    all_projects: [],
    today_pulse_projects: [],
    mission_match_projects: [],
    explore_ribbon_projects: [],
    coverage_atlas: [],
    gap_ledger: [],
    mission_discovery_status: "degraded",
    mission_degraded_reason_codes: ["no_matched_direction"],
    global_hot_projects: [],
    demand_relevant_projects: [],
    searched_direction_statuses: [],
  } as DailyReport;
}

function makeExternalAggregate(namedActorOverrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "external-discovery.aggregate.v1",
    date,
    generated_at: "2026-06-30T08:00:00.000Z",
    provider: "agent-reach",
    status: "ok",
    source_input_hash: "abc123",
    public_safe: true,
    redaction_policy_version: "external-discovery-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    event_count: 1,
    accepted_event_count: 1,
    rejected_event_count: 0,
    platform_counts: { x_twitter: 1 },
    derived_signal_kind_counts: { evidence: 1 },
    project_evidence: [
      {
        evidence_id: "project:openai/agents-sdk",
        event_ids: ["evt-1"],
        scope: "project",
        target_key: "openai/agents-sdk",
        derived_signal_kinds: ["evidence"],
        platforms: ["x_twitter"],
        named_registry_actors: [
          {
            entity_id: "entity-openai",
            display_name: "OpenAI",
            actor_type: "institution",
            registry_tier: "core",
            source_roles: ["social_discussant"],
            event_count: 1,
            platforms: ["x_twitter"],
            first_seen_at: "2026-06-30T00:00:00.000Z",
            last_seen_at: "2026-06-30T00:00:00.000Z",
            ...namedActorOverrides,
          },
        ],
        actor_tiers: { core: 1 },
        actor_types: { institution: 1 },
        mention_count: 1,
        distinct_actor_count: 1,
        top_tier_actor_count: 1,
        first_seen_at: "2026-06-30T00:00:00.000Z",
        last_seen_at: "2026-06-30T00:00:00.000Z",
      },
    ],
    direction_evidence: [],
    observation_candidates: [],
    audit: { rejected_events: [], warnings: [] },
  };
}

function writeDailyInputs(root: string, externalAggregate: Record<string, unknown>): void {
  writeJson(path.join(root, "data", "reports", `${date}.run-summary.json`), makeSummary());
  writeJson(path.join(root, "data", "reports", `${date}.daily.json`), makeReport());
  writeJson(path.join(root, "data", "raw", "github", `${date}.enrichment.json`), []);
  writeJson(path.join(root, "data", "external-discovery", `${date}.aggregate.json`), externalAggregate);
}

describe("external discovery daily verification contract", () => {
  it("passes public-safe external aggregates with source roles", () => {
    const root = setupWorkspace();
    writeDailyInputs(root, makeExternalAggregate());

    const result = buildVerifyDailyResult(date);
    const check = result.checks.find((item) => item.name === "external_discovery_aggregate_contract");

    expect(check?.status).toBe("pass");
    expect(check?.detail).toContain("named_actor_rows=1");
  });

  it("fails persisted external aggregates with named actors missing source roles", () => {
    const root = setupWorkspace();
    const aggregate = makeExternalAggregate({ source_roles: undefined });
    writeDailyInputs(root, aggregate);

    const result = buildVerifyDailyResult(date);
    const check = result.checks.find((item) => item.name === "external_discovery_aggregate_contract");

    expect(check?.status).toBe("fail");
    expect(check?.detail).toContain("source_roles must be non-empty");
    expect(result.status).toBe("fail");
  });
});
