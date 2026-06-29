import type { CounterEvidenceAuditResult } from "../audit/counterEvidenceAudit.ts";
import type { ClaimCandidateBatch } from "./claimBuilder.ts";

export type TrendDecisionInput =
  | {
      ok: true;
      payload_schema: "trend-decision-input.v1";
      schema_version: "1.0.0";
      payload_id: string;
      run_id: string;
      window_start: string;
      window_end: string;
      source_message_id: string;
      claim_candidate_batch_ref: string;
      claim_evidence_link_batch_ref: string;
      decision_context_artifact_ref: string;
      missing_context_reason_codes: string[];
      project_weekly_artifact_refs: string[];
    }
  | {
      ok: false;
      reasonCode: "claim_batch_not_ready" | "audit_not_ready";
      message: string;
    };

export type IndustryClaimLedger = {
  claim_id: string;
  schema_version: "industry-claim-ledger.v1";
  decision_tier: "observing_industry_trend" | "insufficient_evidence";
  decision_confidence: "medium" | "low";
  coverage_audit_state: "full";
  consumer_readiness_state: "needs_review";
  consumer_display_priority: number;
  claim_evidence_link_refs: string[];
  counter_evidence_audit_ref: string;
  fact_resolution_audit_ref: string;
};

export type ClaimLedgerResult =
  | {
      ok: true;
      weekly_output_ready: false;
      claim_ledgers: IndustryClaimLedger[];
    }
  | {
      ok: false;
      reasonCode: "decision_input_not_ready" | "claim_batch_not_ready" | "audit_not_ready";
      message: string;
    };

export function buildTierDecisionInput(input: {
  date: string;
  claimBatch: ClaimCandidateBatch;
  audit: CounterEvidenceAuditResult;
}): TrendDecisionInput {
  if (!input.claimBatch.ok) {
    return { ok: false, reasonCode: "claim_batch_not_ready", message: input.claimBatch.message };
  }
  if (!input.audit.ok) {
    return { ok: false, reasonCode: "audit_not_ready", message: input.audit.message };
  }

  return {
    ok: true,
    payload_schema: "trend-decision-input.v1",
    schema_version: "1.0.0",
    payload_id: `trend-decision-input-${input.date}`,
    run_id: input.claimBatch.run_id,
    window_start: input.claimBatch.window_start,
    window_end: input.claimBatch.window_end,
    source_message_id: input.audit.audit_result.payload_id,
    claim_candidate_batch_ref: input.claimBatch.claim_candidate_batch_ref,
    claim_evidence_link_batch_ref: input.claimBatch.claim_evidence_link_batch_ref,
    decision_context_artifact_ref: `industry://internal/${input.date}/decision-context.v1/${input.claimBatch.payload_id}`,
    missing_context_reason_codes: [],
    project_weekly_artifact_refs: [],
  };
}

export function decideClaimLedger(input: {
  date: string;
  decisionInput: TrendDecisionInput;
  claimBatch: ClaimCandidateBatch;
  audit: CounterEvidenceAuditResult;
}): ClaimLedgerResult {
  if (!input.decisionInput.ok) {
    return { ok: false, reasonCode: "decision_input_not_ready", message: input.decisionInput.message };
  }
  if (!input.claimBatch.ok) {
    return { ok: false, reasonCode: "claim_batch_not_ready", message: input.claimBatch.message };
  }
  if (!input.audit.ok) {
    return { ok: false, reasonCode: "audit_not_ready", message: input.audit.message };
  }
  const claimBatch = input.claimBatch;
  const audit = input.audit;

  const blocking = new Set(audit.audit_result.blocking_claim_candidate_ids);
  const linksByClaim = new Map<string, string[]>();
  for (const link of claimBatch.claim_evidence_links) {
    linksByClaim.set(link.claim_id, [...(linksByClaim.get(link.claim_id) ?? []), link.link_id]);
  }

  return {
    ok: true,
    weekly_output_ready: false,
    claim_ledgers: claimBatch.generated_claim_ids.map((claim_id, index) => ({
      claim_id,
      schema_version: "industry-claim-ledger.v1",
      decision_tier: blocking.has(claim_id) ? "insufficient_evidence" : "observing_industry_trend",
      decision_confidence: blocking.has(claim_id) ? "low" : "medium",
      coverage_audit_state: "full",
      consumer_readiness_state: "needs_review",
      consumer_display_priority: index + 1,
      claim_evidence_link_refs: linksByClaim.get(claim_id) ?? [],
      counter_evidence_audit_ref: audit.audit_result.counter_evidence_audit_ref,
      fact_resolution_audit_ref: claimBatch.claim_builder_audit_refs[0] ?? "",
    })),
  };
}
