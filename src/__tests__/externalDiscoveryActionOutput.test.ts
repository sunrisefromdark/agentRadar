import { describe, expect, it } from "vitest";
import { buildDailyReport, renderDailyReport } from "../action/dailyReport.ts";
import { buildDailyRunSummary, renderDailyRunSummary } from "../action/runSummary.ts";
import type { AppConfig } from "../config.ts";
import type {
  DailyExternalAggregate,
  ExternalDiscoveryCoverage,
  ExternalEvidence,
  ObservationCandidate,
} from "../externalDiscovery/types.ts";

const generatedAt = "2026-06-14T01:00:00.000Z";

const config = {
  sources: {
    userInterestProfile: { enabled: false, topics: [] },
  },
  thresholds: {
    highScore: 70,
    anomalyStarDeltaDaily: 1000,
  },
  llm: {
    mode: "rules-only",
    provider: "none",
  },
} as unknown as AppConfig;

function makeEvidence(overrides: Partial<ExternalEvidence> = {}): ExternalEvidence {
  return {
    evidence_id: "external-evidence:project-1",
    event_ids: ["event-1"],
    scope: "project",
    target_key: "repo:acme/coder",
    derived_signal_kinds: ["discovery", "evidence"],
    direction_labels: [],
    platforms: ["official_blog"],
    actor_tiers: { ordinary: 1 },
    actor_types: { team: 1 },
    mention_count: 1,
    distinct_actor_count: 1,
    first_seen_at: generatedAt,
    last_seen_at: generatedAt,
    active_day_count: 1,
    cross_platform: false,
    authority_summary_cn: "external authority summary",
    intensity_summary_cn: "external intensity summary",
    persistence_summary_cn: "external persistence summary",
    caveats: ["secondary signal only"],
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<ObservationCandidate> = {}): ObservationCandidate {
  return {
    candidate_id: "external-candidate:project-1",
    scope: "project",
    candidate_kind: "needs_confirmation",
    target_key: "repo:https://github.com/acme/coder",
    display_name: "acme/coder",
    repo_url: "https://github.com/acme/coder",
    direction_labels: [],
    binding_confidence: "unbound",
    evidence_ids: ["external-evidence:project-1"],
    evidence_summary_cn: "external candidate summary",
    qualification: "needs_primary_confirmation",
    can_enter_daily: true,
    can_enter_weekly: false,
    cannot_be_primary_conclusion: true,
    caveats: ["needs primary confirmation"],
    ...overrides,
  };
}

function makeAggregate(overrides: Partial<DailyExternalAggregate> = {}): DailyExternalAggregate {
  return {
    schema_version: "external-discovery.aggregate.v1",
    date: "2026-06-14",
    generated_at: generatedAt,
    provider: "agent-reach",
    status: "ok",
    status_reason: "ok",
    source_input_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    public_safe: true,
    redaction_policy_version: "external-discovery-redaction.v1",
    contains_raw_text: false,
    contains_profile_urls: false,
    event_count: 1,
    accepted_event_count: 1,
    rejected_event_count: 0,
    platform_counts: { official_blog: 1 },
    derived_signal_kind_counts: { discovery: 1, evidence: 1 },
    direction_label_counts: {},
    project_evidence: [],
    direction_evidence: [],
    observation_candidates: [],
    audit: {
      rejected_events: [],
      warnings: [],
    },
    ...overrides,
  };
}

function makeCoverage(): ExternalDiscoveryCoverage {
  return {
    x_twitter: {
      status: "manual_import_only",
      reason: "reserved_provider_not_configured",
    },
    reddit: {
      status: "manual_import_only",
      reason: "reserved_provider_not_configured",
    },
    hacker_news: {
      status: "not_configured",
      reason: "provider_not_selected",
    },
    official_web: {
      status: "partial",
      reason: "sitemap_unavailable",
      warnings: ["official_web_partial"],
    },
    official_blog: {
      status: "ok",
    },
  };
}

describe("external discovery daily and run-summary outputs", () => {
  it("renders skipped external layer as an empty secondary section", () => {
    const aggregate = makeAggregate({
      status: "skipped",
      status_reason: "disabled_by_flag",
      event_count: 0,
      accepted_event_count: 0,
      platform_counts: {},
      derived_signal_kind_counts: {},
    });

    const report = buildDailyReport([], config, {
      date: "2026-06-14",
      generatedAt,
      externalAggregate: aggregate,
    });

    expect(report.external_discovery.external_layer_status.status).toBe("skipped");
    expect(report.external_discovery.external_layer_status.status_reason).toBe("disabled_by_flag");
    expect(report.external_discovery.external_observation_candidates).toEqual([]);
    expect(report.external_discovery.external_project_evidence_summaries).toEqual([]);
    expect(renderDailyReport(report)).toContain("External Discovery");
    expect(renderDailyReport(report)).toContain("disabled_by_flag");
  });

  it("keeps external candidates out of primary daily project boards", () => {
    const projectCandidate = makeCandidate();
    const directionCandidate = makeCandidate({
      candidate_id: "external-direction:agent-memory",
      scope: "direction",
      candidate_kind: "direction_watch",
      target_key: "topic:agent-memory",
      display_name: "agent memory",
      repo_url: undefined,
      topic_key: "agent-memory",
      qualification: "observe",
      can_enter_daily: false,
      can_enter_weekly: true,
    });
    const aggregate = makeAggregate({
      direction_label_counts: { "research-agent": 2, "office-agent": 1 },
      project_evidence: [makeEvidence()],
      direction_evidence: [makeEvidence({ evidence_id: "external-evidence:direction-1", scope: "direction", target_key: "topic:agent-memory" })],
      observation_candidates: [projectCandidate, directionCandidate],
    });

    const report = buildDailyReport([], config, {
      date: "2026-06-14",
      generatedAt,
      externalAggregate: aggregate,
    });

    expect(report.external_discovery.external_observation_candidates).toEqual([projectCandidate]);
    expect(report.external_discovery.external_direction_signal_summary.candidate_count).toBe(1);
    expect(report.external_discovery.external_direction_signal_summary.topic_keys).toEqual(["agent-memory"]);
    expect(report.external_discovery.direction_label_counts).toEqual({ "research-agent": 2, "office-agent": 1 });
    expect(renderDailyReport(report)).toContain("direction_label_counts: office-agent=1, research-agent=2");
    expect(report.today_star_projects).toEqual([]);
    expect(report.today_pulse_projects).toEqual([]);
    expect(report.mission_match_projects).toEqual([]);
  });

  it("records external discovery as a secondary run-summary audit", () => {
    const coverage = makeCoverage();
    const aggregate = makeAggregate({
      direction_label_counts: { "personal-assistant-agent": 1 },
      project_evidence: [makeEvidence()],
      observation_candidates: [makeCandidate()],
      audit: {
        coverage,
        rejected_events: [{ reason_code: "unsupported_platform", reason_detail: "platform rejected" }],
        warnings: ["registry_empty", "registry_miss"],
      },
      rejected_event_count: 1,
      event_count: 2,
    });
    const report = buildDailyReport([], config, {
      date: "2026-06-14",
      generatedAt,
      externalAggregate: aggregate,
    });

    const summary = buildDailyRunSummary([], [], report, {
      date: "2026-06-14",
      generatedAt,
      dryRun: true,
      classificationsCount: 0,
      externalDiscovery: {
        aggregate,
        aggregatePath: "data/external-discovery/2026-06-14.aggregate.json",
      },
    });

    expect(summary.external_discovery?.provider).toBe("agent-reach");
    expect(summary.external_discovery?.status).toBe("ok");
    expect(report.external_discovery.external_audit_summary.coverage).toEqual(coverage);
    expect(summary.external_discovery?.coverage).toEqual(coverage);
    expect(summary.external_discovery?.aggregate_path).toBe("data/external-discovery/2026-06-14.aggregate.json");
    expect(summary.external_discovery?.source_input_hash).toBe(aggregate.source_input_hash);
    expect(summary.external_discovery?.rejected_reason_counts).toEqual({ unsupported_platform: 1 });
    expect(summary.external_discovery?.direction_label_counts).toEqual({ "personal-assistant-agent": 1 });
    expect(summary.external_discovery?.registry_warnings).toEqual(["registry_empty", "registry_miss"]);
    expect(renderDailyRunSummary(summary)).toContain("External Discovery");
    expect(renderDailyRunSummary(summary)).toContain("secondary");
    expect(renderDailyRunSummary(summary)).toContain("direction_label_counts: personal-assistant-agent=1");
    expect(renderDailyReport(report)).toContain(
      "coverage: x_twitter=manual_import_only, reddit=manual_import_only, hacker_news=not_configured, official_web=partial, official_blog=ok",
    );
    expect(renderDailyRunSummary(summary)).toContain(
      "coverage: x_twitter=manual_import_only, reddit=manual_import_only, hacker_news=not_configured, official_web=partial, official_blog=ok",
    );
  });
});
