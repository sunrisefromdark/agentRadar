import type { ClaimCandidateBatch } from "../trend/claimBuilder.ts";

export type CounterEvidenceAuditResult =
  | {
      ok: true;
      counter_evidence_audit: {
        schema_version: "counter-evidence-audit.v1";
        audited_by_agent_id: "audit-agent";
        audited_at: string;
        audit_mode: "closed_snapshot";
        audit_priority: "same_run";
        blocking_counter_evidence: boolean;
        counter_evidence_severity: "none" | "high";
        blocking_scopes: string[];
        supporting_event_ids_reviewed: string[];
        reviewed_claim_evidence_link_ids: string[];
        unchecked_supporting_event_ids: string[];
        sampling_reason_codes: string[];
        counter_event_ids: string[];
        missing_axis_keys: string[];
        source_bias_notes: string[];
        conflict_groups: string[];
        decision_state: "clear" | "blocking";
        contested_by_agent_ids: string[];
        escalation_reason_codes: string[];
        unresolved_questions: string[];
      };
      audit_result: {
        payload_schema: "audit-result.v1";
        schema_version: "1.0.0";
        payload_id: string;
        run_id: string;
        window_start: string;
        window_end: string;
        source_message_id: string;
        counter_evidence_audit_ref: string;
        audited_claim_candidate_ids: string[];
        blocking_claim_candidate_ids: string[];
        downgrade_recommendations: Array<{
          claim_id: string;
          reason_code: string;
        }>;
        high_impact_unresolved_group_ids: string[];
        actual_latency_ms: number;
      };
    }
  | {
      ok: false;
      reasonCode: "claim_batch_not_ready";
      message: string;
    };

export function buildCounterEvidenceAudit(input: {
  date: string;
  claimBatch: ClaimCandidateBatch;
}): CounterEvidenceAuditResult {
  if (!input.claimBatch.ok) {
    return {
      ok: false,
      reasonCode: "claim_batch_not_ready",
      message: input.claimBatch.message,
    };
  }

  const counterLinks = input.claimBatch.claim_evidence_links.filter((link) => link.polarity === "counter");
  const supportingLinks = input.claimBatch.claim_evidence_links.filter((link) => link.polarity !== "counter");
  const blockingClaimIds = [...new Set(counterLinks.map((link) => link.claim_id))];
  const auditRef = `industry://internal/${input.date}/counter-evidence-audit.v1/${input.claimBatch.payload_id}`;

  return {
    ok: true,
    counter_evidence_audit: {
      schema_version: "counter-evidence-audit.v1",
      audited_by_agent_id: "audit-agent",
      audited_at: `${input.date}T23:59:59+08:00`,
      audit_mode: "closed_snapshot",
      audit_priority: "same_run",
      blocking_counter_evidence: counterLinks.length > 0,
      counter_evidence_severity: counterLinks.length > 0 ? "high" : "none",
      blocking_scopes: counterLinks.length > 0 ? ["claim_candidate"] : [],
      supporting_event_ids_reviewed: supportingLinks.map((link) => link.event_id),
      reviewed_claim_evidence_link_ids: input.claimBatch.claim_evidence_links.map((link) => link.link_id),
      unchecked_supporting_event_ids: [],
      sampling_reason_codes: ["full_closed_snapshot"],
      counter_event_ids: counterLinks.map((link) => link.event_id),
      missing_axis_keys: [],
      source_bias_notes: [],
      conflict_groups: blockingClaimIds,
      decision_state: counterLinks.length > 0 ? "blocking" : "clear",
      contested_by_agent_ids: counterLinks.length > 0 ? ["audit-agent"] : [],
      escalation_reason_codes: counterLinks.length > 0 ? ["counter_evidence_present"] : [],
      unresolved_questions: [],
    },
    audit_result: {
      payload_schema: "audit-result.v1",
      schema_version: "1.0.0",
      payload_id: `audit-result-${input.date}`,
      run_id: input.claimBatch.run_id,
      window_start: input.claimBatch.window_start,
      window_end: input.claimBatch.window_end,
      source_message_id: input.claimBatch.payload_id,
      counter_evidence_audit_ref: auditRef,
      audited_claim_candidate_ids: input.claimBatch.generated_claim_ids,
      blocking_claim_candidate_ids: blockingClaimIds,
      downgrade_recommendations: blockingClaimIds.map((claim_id) => ({
        claim_id,
        reason_code: "counter_evidence_present",
      })),
      high_impact_unresolved_group_ids: [],
      actual_latency_ms: 0,
    },
  };
}
