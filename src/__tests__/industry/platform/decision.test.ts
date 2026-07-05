import { describe, expect, it } from "vitest";
import academicBundle from "../../../../fixtures/industry/agents/academic-agent/replay/phase1-current-bundle.json" with { type: "json" };
import policyBundle from "../../../../fixtures/industry/agents/policy-agent/replay/phase1-current-bundle.json" with { type: "json" };
import { buildProductEcosystemFormalHandoff } from "../../../industry/agents/community-news-agent/formalHandoff.ts";
import { buildCounterEvidenceAudit } from "../../../industry/platform/audit/counterEvidenceAudit.ts";
import { buildClosedFactSnapshot, type ClosedFactSnapshot } from "../../../industry/platform/normalization/factSnapshot.ts";
import { buildProductEcosystemInput } from "../../../industry/platform/normalization/industryRuntimeSummary.ts";
import { buildClaimCandidateBatch } from "../../../industry/platform/trend/claimBuilder.ts";
import { buildTierDecisionInput, decideClaimLedger } from "../../../industry/platform/trend/tierDecision.ts";

describe("industry platform claim-builder and audit", () => {
  it("builds claim candidates and counter-evidence audit from a closed snapshot", () => {
    const claimBatch = buildClaimCandidateBatch({
      date: "2026-06-26",
      snapshot: closedSnapshot(),
    });

    expect(claimBatch).toMatchObject({
      ok: true,
      payload_schema: "claim-candidate-batch.v1",
      schema_version: "1.0.0",
      claim_candidate_batch_ref: "industry://internal/2026-06-26/claim-candidate-batch.v1/fact-snapshot-2026-06-26",
      claim_evidence_link_batch_ref: "industry://internal/2026-06-26/claim-evidence-link-batch.v1/fact-snapshot-2026-06-26",
      rejected_event_ids: [],
    });
    if (!claimBatch.ok) throw new Error(claimBatch.message);
    expect(claimBatch.generated_claim_ids.length).toBeGreaterThan(0);
    expect(claimBatch.input_event_ids).toHaveLength(new Set(claimBatch.input_event_ids).size);

    const audit = buildCounterEvidenceAudit({
      date: "2026-06-26",
      claimBatch,
    });

    expect(audit).toMatchObject({
      ok: true,
      counter_evidence_audit: {
        schema_version: "counter-evidence-audit.v1",
        audited_by_agent_id: "audit-agent",
        blocking_counter_evidence: true,
        counter_evidence_severity: "high",
        decision_state: "blocking",
      },
      audit_result: {
        payload_schema: "audit-result.v1",
        schema_version: "1.0.0",
      },
    });
    if (!audit.ok) throw new Error(audit.message);
    expect(audit.counter_evidence_audit.counter_event_ids.length).toBeGreaterThan(0);
    expect(audit.audit_result.blocking_claim_candidate_ids.length).toBeGreaterThan(0);
  });

  it("rejects claim-builder input until the fact snapshot is closed", () => {
    const blockedSnapshot = buildClosedFactSnapshot({
      date: "2026-06-26",
      bundles: [{ group: "academic", bundle: academicBundle }],
    });

    expect(buildClaimCandidateBatch({ date: "2026-06-26", snapshot: blockedSnapshot })).toMatchObject({
      ok: false,
      reasonCode: "snapshot_not_closed",
    });
  });

  it("does not count repeated attestation assignments twice", () => {
    const snapshot = structuredClone(closedSnapshot()) as ClosedFactSnapshot;
    const repeatedAssignment = snapshot.fact_resolution_audit.event_fact_assignments[0];
    if (!repeatedAssignment) throw new Error("expected at least one fact assignment");
    snapshot.fact_resolution_audit.event_fact_assignments.push(structuredClone(repeatedAssignment));

    const claimBatch = buildClaimCandidateBatch({
      date: "2026-06-26",
      snapshot,
    });

    expect(claimBatch).toMatchObject({ ok: true });
    if (!claimBatch.ok) throw new Error(claimBatch.message);
    expect(claimBatch.input_event_ids).toHaveLength(new Set(claimBatch.input_event_ids).size);
    expect(claimBatch.claim_evidence_links.filter((link) => link.event_id === repeatedAssignment.event_id)).toHaveLength(1);
  });

  it("materializes tier decision input and claim ledger without unlocking weekly output", () => {
    const claimBatch = buildClaimCandidateBatch({
      date: "2026-06-26",
      snapshot: closedSnapshot(),
    });
    const audit = buildCounterEvidenceAudit({
      date: "2026-06-26",
      claimBatch,
    });
    const decisionInput = buildTierDecisionInput({
      date: "2026-06-26",
      claimBatch,
      audit,
    });
    const ledger = decideClaimLedger({
      date: "2026-06-26",
      decisionInput,
      claimBatch,
      audit,
    });

    expect(decisionInput).toMatchObject({
      ok: true,
      payload_schema: "trend-decision-input.v1",
      decision_context_artifact_ref: "industry://internal/2026-06-26/decision-context.v1/claim-candidate-batch-2026-06-26",
    });
    expect(ledger).toMatchObject({
      ok: true,
      weekly_output_ready: false,
    });
    if (!ledger.ok) throw new Error(ledger.message);
    expect(ledger.claim_ledgers.length).toBeGreaterThan(0);
    expect(ledger.claim_ledgers.every((item) => item.schema_version === "industry-claim-ledger.v1")).toBe(true);
    expect(ledger.claim_ledgers.some((item) => item.decision_tier === "insufficient_evidence")).toBe(true);
    expect(ledger.claim_ledgers.every((item) => item.coverage_audit_state === "full")).toBe(true);
  });
});

function closedSnapshot(): ClosedFactSnapshot {
  const { bundle: productBundle } = buildProductEcosystemFormalHandoff(buildProductEcosystemInput());
  return buildClosedFactSnapshot({
    date: "2026-06-26",
    bundles: [
      { group: "policy_finance", bundle: policyBundle },
      { group: "academic", bundle: academicBundle },
      { group: "product_ecosystem", bundle: productBundle },
    ],
  });
}
