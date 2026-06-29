import type { ClaimLedgerResult, IndustryClaimLedger } from "../trend/tierDecision.ts";

export type IndustryTrendCard = {
  card_id: string;
  schema_version: "industry-trend-card.v1";
  claim_id: string;
  claim_ledger_ref: string;
  trend_name_cn: string;
  claim_cn: string;
  decision_tier: IndustryClaimLedger["decision_tier"];
  decision_confidence: IndustryClaimLedger["decision_confidence"];
  coverage_audit_state: IndustryClaimLedger["coverage_audit_state"];
  consumer_readiness_state: IndustryClaimLedger["consumer_readiness_state"];
  consumer_display_priority: number;
  evidence_matrix: { claim_evidence_link_refs: string[] };
  leading_axes: string[];
  supporting_axes: string[];
  missing_axes: string[];
  counter_axes: string[];
  freshness_summary: string;
  source_trace_refs: string[];
};

export type WeeklyIndustryTrendSection = {
  section_id: string;
  schema_version: "weekly-industry-trend-section.v2";
  window_start: string;
  window_end: string;
  evidence_window_status: "closed";
  publication_readiness_status: "blocked_public_output";
  governance_load_status: "normal";
  industry_window_status: "ready_internal_only";
  run_snapshot: Record<string, unknown>;
  core_industry_trends: IndustryTrendCard[];
  observing_industry_trends: IndustryTrendCard[];
  wind_probes: IndustryTrendCard[];
  project_heat_clusters: IndustryTrendCard[];
  insufficient_evidence_directions: IndustryTrendCard[];
  display_index: {
    headline_core_card_ids: string[];
    needs_review_card_ids: string[];
  };
  agent_contribution_report: Record<string, unknown>;
  tool_coverage_report: Record<string, unknown>;
  lineage_refs: {
    claim_ledger_refs: string[];
  };
  run_budget_summary: Record<string, unknown>;
  ordering_basis: string;
};

export function buildWeeklyIndustryTrendSection(input: {
  date: string;
  claimLedger: Extract<ClaimLedgerResult, { ok: true }>;
}): WeeklyIndustryTrendSection {
  const cards = input.claimLedger.claim_ledgers.map((ledger) => cardFromLedger(input.date, ledger));

  return {
    section_id: `weekly-industry-trend-section-${input.date}`,
    schema_version: "weekly-industry-trend-section.v2",
    window_start: `${input.date}T00:00:00+08:00`,
    window_end: `${input.date}T23:59:59+08:00`,
    evidence_window_status: "closed",
    publication_readiness_status: "blocked_public_output",
    governance_load_status: "normal",
    industry_window_status: "ready_internal_only",
    run_snapshot: { review_availability_snapshot: "async_only" },
    core_industry_trends: [],
    observing_industry_trends: cards.filter((card) => card.decision_tier === "observing_industry_trend"),
    wind_probes: [],
    project_heat_clusters: [],
    insufficient_evidence_directions: cards.filter((card) => card.decision_tier === "insufficient_evidence"),
    display_index: {
      headline_core_card_ids: [],
      needs_review_card_ids: cards.map((card) => card.card_id),
    },
    agent_contribution_report: {},
    tool_coverage_report: {},
    lineage_refs: {
      claim_ledger_refs: input.claimLedger.claim_ledgers.map((ledger) => `industry://internal/${input.date}/industry-claim-ledger.v1/${ledger.claim_id}`),
    },
    run_budget_summary: {},
    ordering_basis: "consumer_readiness_state_then_display_priority",
  };
}

function cardFromLedger(date: string, ledger: IndustryClaimLedger): IndustryTrendCard {
  return {
    card_id: `card-${ledger.claim_id}`,
    schema_version: "industry-trend-card.v1",
    claim_id: ledger.claim_id,
    claim_ledger_ref: `industry://internal/${date}/industry-claim-ledger.v1/${ledger.claim_id}`,
    trend_name_cn: ledger.claim_id,
    claim_cn: ledger.claim_id,
    decision_tier: ledger.decision_tier,
    decision_confidence: ledger.decision_confidence,
    coverage_audit_state: ledger.coverage_audit_state,
    consumer_readiness_state: ledger.consumer_readiness_state,
    consumer_display_priority: ledger.consumer_display_priority,
    evidence_matrix: { claim_evidence_link_refs: ledger.claim_evidence_link_refs },
    leading_axes: [],
    supporting_axes: ledger.claim_evidence_link_refs,
    missing_axes: [],
    counter_axes: ledger.decision_tier === "insufficient_evidence" ? ledger.claim_evidence_link_refs : [],
    freshness_summary: "current closed snapshot",
    source_trace_refs: ledger.claim_evidence_link_refs,
  };
}
