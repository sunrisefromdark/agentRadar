import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { buildVerifyDailyResult } from "../action/dailyVerification.ts";
import type {
  DailyExternalAuditSummary,
  DailyExternalDiscoverySection,
  DailyExternalLayerStatus,
  DailyReport,
  DailyRunSummary,
  DailyRunSummaryExternalDiscovery,
  DailyRunSummarySourceStatus,
  DailyOverallStatus,
  ScoreComponent,
} from "../types.ts";
import type { DailyExternalAggregate } from "../externalDiscovery/types.ts";

const roots: string[] = [];
const originalCwd = process.cwd();
const date = "2099-06-14";
const generatedAt = "2099-06-14T01:00:00.000Z";
const overallDailyStatus = "数据新鲜，可直接阅读" as DailyOverallStatus;

afterEach(() => {
  process.chdir(originalCwd);
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function setupWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "external-verify-"));
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

function activeSourceStatus(): DailyRunSummarySourceStatus {
  return {
    source: "github_trending",
    enabled: true,
    item_count: 1,
    distinct_projects: 1,
    status: "active",
    notes: [],
  };
}

function makeLayerStatus(status: DailyExternalLayerStatus["status"] = "ok"): DailyExternalLayerStatus {
  return {
    provider: "agent-reach",
    status,
    status_reason: status,
    source_input_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    event_count: status === "ok" ? 1 : 0,
    accepted_event_count: status === "ok" ? 1 : 0,
    rejected_event_count: 0,
  };
}

function makeExternalAuditSummary(overrides: Partial<DailyExternalAuditSummary> = {}): DailyExternalAuditSummary {
  return {
    public_safe: true,
    redaction_policy_version: "external-discovery-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    rejected_event_count: 0,
    rejected_reason_counts: {},
    warnings: [],
    ...overrides,
  };
}

function makeExternalSection(overrides: Partial<DailyExternalDiscoverySection> = {}): DailyExternalDiscoverySection {
  return {
    external_layer_status: makeLayerStatus(),
    external_observation_candidates: [],
    external_project_evidence_summaries: [],
    external_direction_signal_summary: {
      evidence_count: 0,
      candidate_count: 0,
      topic_keys: [],
    },
    direction_label_counts: {},
    external_audit_summary: makeExternalAuditSummary(),
    ...overrides,
  };
}

function makeSummary(overrides: Partial<DailyRunSummary> = {}): DailyRunSummary {
  const externalDiscovery: DailyRunSummaryExternalDiscovery = {
    provider: "agent-reach",
    status: "ok",
    status_reason: "ok",
    aggregate_path: `data/external-discovery/${date}.aggregate.json`,
    source_input_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    event_count: 1,
    accepted_event_count: 1,
    rejected_event_count: 0,
    rejected_reason_counts: {},
    direction_label_counts: {},
    public_safe: true,
    redaction_policy_version: "external-discovery-redaction.v1",
    registry_warnings: [],
    warnings: [],
  };
  return {
    date,
    generated_at: generatedAt,
    dry_run: true,
    minimum_viable_run_completed: true,
    completion_notes: [],
    overall_daily_status: overallDailyStatus,
    freshness_sources: [
      {
        source: "github_trending",
        effective_date: date,
        freshness_state: "fresh_today",
        from_realtime_run: true,
        source_role: "freshness-driving",
      },
    ],
    today_star_count: 1,
    mission_discovery_status: "degraded",
    mission_degraded_reason_codes: ["no_matched_direction"],
    counts: {
      raw_signals: 1,
      normalized_projects: 1,
      scored_projects: 1,
      high_score_projects: 1,
      anomaly_projects: 0,
      new_projects: 1,
      classifications: 1,
    },
    source_status: [activeSourceStatus()],
    quality: {
      missing_descriptions: 0,
      watchlist_hits: 0,
      low_confidence_projects: 0,
      medium_confidence_projects: 0,
      insufficient_metrics_projects: 0,
      suspicious_growth_projects: 0,
      single_source_projects: 0,
      single_spike_projects: 0,
      emerging_projects: 1,
      persistent_projects: 0,
    },
    diagnostics: {
      anomaly_share: 0,
      uniform_star_velocity_detected: false,
      metrics_source_distribution: { embedded: 1, github_api: 0, github_html: 0, github_cache: 0, unavailable: 0 },
      star_delta_source_distribution: { github_live: 0, github_snapshot: 0, signal: 1, unavailable: 0 },
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
    external_discovery: externalDiscovery,
    ...overrides,
  };
}

function makeReport(overrides: Partial<DailyReport> = {}): DailyReport {
  return {
    date,
    generated_at: generatedAt,
    enhancement_status: "rules-only",
    enhancement_audit: { rejected_outputs: [] },
    personalized_relevance_applicable: false,
    overall_daily_status: overallDailyStatus,
    freshness_sources: [],
    today_fresh_candidate_count: 1,
    context_candidate_count: 0,
    pending_confirmation_count: 0,
    main_board_mode: "fresh_today_only",
    today_star_projects: [],
    context_only_projects: [],
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
    new_projects: [],
    high_score_projects: [],
    anomaly_projects: [],
    all_projects: [],
    external_discovery: makeExternalSection(),
    ...overrides,
  };
}

function makeAggregate(overrides: Partial<DailyExternalAggregate> = {}): DailyExternalAggregate {
  return {
    schema_version: "external-discovery.aggregate.v1",
    date,
    generated_at: generatedAt,
    provider: "agent-reach",
    status: "ok",
    status_reason: "ok",
    source_input_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    public_safe: true,
    redaction_policy_version: "external-discovery-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    event_count: 1,
    accepted_event_count: 1,
    rejected_event_count: 0,
    platform_counts: { official_blog: 1 },
    derived_signal_kind_counts: { discovery: 1 },
    direction_label_counts: {},
    project_evidence: [],
    direction_evidence: [],
    observation_candidates: [],
    audit: { rejected_events: [], warnings: [] },
    ...overrides,
  };
}

function writeDailyArtifacts(root: string, summary: DailyRunSummary, report: DailyReport, aggregate: unknown): void {
  writeJson(path.join(root, "data", "reports", `${date}.run-summary.json`), summary);
  writeJson(path.join(root, "data", "reports", `${date}.daily.json`), report);
  writeJson(path.join(root, "data", "raw", "github", `${date}.enrichment.json`), []);
  writeJson(path.join(root, "data", "external-discovery", `${date}.aggregate.json`), aggregate);
}

function checkStatus(result: ReturnType<typeof buildVerifyDailyResult>, name: string): string | undefined {
  return result.checks.find((check) => check.name === name)?.status;
}

describe("external discovery verify-daily checks", () => {
  it("warns but does not fail when the external layer is skipped", () => {
    const root = setupWorkspace();
    const skippedSummary = makeSummary({
      external_discovery: {
        ...makeSummary().external_discovery!,
        status: "skipped",
        status_reason: "input_missing",
        event_count: 0,
        accepted_event_count: 0,
      },
    });
    const skippedReport = makeReport({
      external_discovery: makeExternalSection({
        external_layer_status: makeLayerStatus("skipped"),
      }),
    });
    const skippedAggregate = makeAggregate({
      status: "skipped",
      status_reason: "input_missing",
      event_count: 0,
      accepted_event_count: 0,
      platform_counts: {},
      derived_signal_kind_counts: {},
    });
    writeDailyArtifacts(root, skippedSummary, skippedReport, skippedAggregate);

    const result = buildVerifyDailyResult(date);

    expect(checkStatus(result, "external_discovery_status")).toBe("warn");
    expect(checkStatus(result, "external_public_aggregate_safe")).toBe("pass");
    expect(checkStatus(result, "external_primary_contamination")).toBe("pass");
  });

  it("fails when the public aggregate contains raw or sensitive fields", () => {
    const root = setupWorkspace();
    writeDailyArtifacts(root, makeSummary(), makeReport(), {
      ...makeAggregate(),
      content_text: "raw provider text",
      profile_url: "https://example.com/private-profile",
    });

    const result = buildVerifyDailyResult(date);

    expect(checkStatus(result, "external_public_aggregate_safe")).toBe("fail");
    expect(result.status).toBe("fail");
  });

  it("fails when the daily report claims external usage without an audit summary", () => {
    const root = setupWorkspace();
    const report = makeReport();
    delete (report.external_discovery as Partial<DailyExternalDiscoverySection>).external_audit_summary;
    writeDailyArtifacts(root, makeSummary(), report, makeAggregate());

    const result = buildVerifyDailyResult(date);

    expect(checkStatus(result, "external_daily_audit_present")).toBe("fail");
    expect(result.status).toBe("fail");
  });

  it("fails when external evidence leaks into primary score evidence", () => {
    const root = setupWorkspace();
    const discussionComponent: ScoreComponent = {
      name: "discussion_score",
      score: 10,
      weight: 0.1,
      weighted_score: 1,
      evidence: ["external-evidence:project-1"],
    };
    const report = makeReport({
      today_star_projects: [
        {
          project: {
            project_name: "Coder",
            repo_url: "https://github.com/acme/coder",
            repo_full_name: "acme/coder",
            first_seen: date,
            last_seen: date,
            sources: ["github_trending"],
            source_counts: { github_trending: 1 },
            appearances: 1,
            appearance_dates: [date],
            persistence_state: "emerging",
            stars: 100,
            forks: 1,
            issues: 0,
            PR: 0,
            tags: [],
            description: "coder",
            metrics_source: "embedded",
            metrics_trust_score: 0.8,
            data_trust: "high",
            star_delta_available: false,
            trust_flags: [],
            raw_signals: [],
          },
          score: {
            total_score: 80,
            components: [discussionComponent],
            verdict: "high",
            confidence: "high",
            trust_score: 0.8,
            data_trust: "high",
            paradigm: "agent",
            anti_noise_flags: [],
            risks: [],
            next_actions: [],
            rules_only: true,
          },
          project_class: "today_star",
          objective_score: 80,
          preference_boost: 0,
          base_final_rank: 80,
          final_rank: 80,
          matched_interest_topics: [],
          project_brief_cn: "brief",
          why_today_cn: "why",
          enhancement_source: "template_fallback",
        },
      ],
    });
    writeDailyArtifacts(root, makeSummary(), report, makeAggregate());

    const result = buildVerifyDailyResult(date);

    expect(checkStatus(result, "external_primary_contamination")).toBe("fail");
    expect(result.status).toBe("fail");
  });

  it("fails when external direction labels leak into primary score evidence", () => {
    const root = setupWorkspace();
    const discussionComponent: ScoreComponent = {
      name: "discussion_score",
      score: 10,
      weight: 0.1,
      weighted_score: 1,
      evidence: ["direction_label:research-agent"],
    };
    const report = makeReport({
      today_star_projects: [
        {
          project: {
            project_name: "Research Agent",
            repo_url: "https://github.com/acme/research-agent",
            repo_full_name: "acme/research-agent",
            first_seen: date,
            last_seen: date,
            sources: ["github_trending"],
            source_counts: { github_trending: 1 },
            appearances: 1,
            appearance_dates: [date],
            persistence_state: "emerging",
            stars: 100,
            forks: 1,
            issues: 0,
            PR: 0,
            tags: [],
            description: "research agent",
            metrics_source: "embedded",
            metrics_trust_score: 0.8,
            data_trust: "high",
            star_delta_available: false,
            trust_flags: [],
            raw_signals: [],
          },
          score: {
            total_score: 80,
            components: [discussionComponent],
            verdict: "high",
            confidence: "high",
            trust_score: 0.8,
            data_trust: "high",
            paradigm: "agent",
            anti_noise_flags: [],
            risks: [],
            next_actions: [],
            rules_only: true,
          },
          project_class: "context_only",
          objective_score: 80,
          preference_boost: 0,
          base_final_rank: 80,
          final_rank: 80,
          matched_interest_topics: [],
          project_brief_cn: "brief",
          why_today_cn: "why",
          enhancement_source: "template_fallback",
        },
      ],
    });
    writeDailyArtifacts(root, makeSummary(), report, makeAggregate());

    const result = buildVerifyDailyResult(date);

    expect(checkStatus(result, "external_primary_contamination")).toBe("fail");
    expect(result.status).toBe("fail");
  });

  it("does not treat ordinary primary-source external wording as external discovery contamination", () => {
    const root = setupWorkspace();
    const discussionComponent: ScoreComponent = {
      name: "discussion_score",
      score: 10,
      weight: 0.1,
      weighted_score: 1,
      evidence: [
        "classification.evidence=codex-external-agent-migration imports settings from external tools",
      ],
    };
    const report = makeReport({
      today_star_projects: [
        {
          project: {
            project_name: "Coder",
            repo_url: "https://github.com/acme/coder",
            repo_full_name: "acme/coder",
            first_seen: date,
            last_seen: date,
            sources: ["github_trending"],
            source_counts: { github_trending: 1 },
            appearances: 1,
            appearance_dates: [date],
            persistence_state: "emerging",
            stars: 100,
            forks: 1,
            issues: 0,
            PR: 0,
            tags: [],
            description: "supports external GUI workflows",
            metrics_source: "embedded",
            metrics_trust_score: 0.8,
            data_trust: "high",
            star_delta_available: false,
            trust_flags: [],
            raw_signals: [],
          },
          score: {
            total_score: 80,
            components: [discussionComponent],
            verdict: "high",
            confidence: "high",
            trust_score: 0.8,
            data_trust: "high",
            paradigm: "agent",
            anti_noise_flags: [],
            risks: [],
            next_actions: [],
            rules_only: true,
          },
          project_class: "today_star",
          objective_score: 80,
          preference_boost: 0,
          base_final_rank: 80,
          final_rank: 80,
          matched_interest_topics: [],
          project_brief_cn: "brief",
          why_today_cn: "why",
          enhancement_source: "template_fallback",
        },
      ],
    });
    writeDailyArtifacts(root, makeSummary(), report, makeAggregate());

    const result = buildVerifyDailyResult(date);

    expect(checkStatus(result, "external_primary_contamination")).toBe("pass");
  });
});
