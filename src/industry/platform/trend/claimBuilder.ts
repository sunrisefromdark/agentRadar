import type { ClosedFactSnapshot } from "../normalization/factSnapshot.ts";

export type ClaimEvidenceLink = {
  link_id: string;
  claim_id: string;
  event_id: string;
  fact_id: string;
  polarity: string;
};

export type ClaimCandidateBatch =
  | {
      ok: true;
      payload_schema: "claim-candidate-batch.v1";
      schema_version: "1.0.0";
      payload_id: string;
      run_id: string;
      window_start: string;
      window_end: string;
      source_message_id: string;
      claim_candidate_batch_ref: string;
      claim_evidence_link_batch_ref: string;
      claim_builder_audit_refs: string[];
      candidate_group_ids: string[];
      input_event_ids: string[];
      generated_claim_ids: string[];
      deferred_event_ids: string[];
      rejected_event_ids: string[];
      claim_evidence_links: ClaimEvidenceLink[];
    }
  | {
      ok: false;
      reasonCode: "snapshot_not_closed";
      message: string;
    };

export function buildClaimCandidateBatch(input: {
  date: string;
  snapshot: ClosedFactSnapshot;
}): ClaimCandidateBatch {
  if (input.snapshot.status !== "closed" || !input.snapshot.claim_builder_input_ready) {
    return {
      ok: false,
      reasonCode: "snapshot_not_closed",
      message: "Claim-builder requires a closed fact snapshot.",
    };
  }

  const eventsById = new Map(input.snapshot.source_chain_dedupe_batch.deduped_events.map((event) => [event.eventId, event]));
  const assignments = uniqueBy(input.snapshot.fact_resolution_audit.event_fact_assignments, (item) => item.event_id);
  const links = assignments
    .map((assignment): ClaimEvidenceLink | undefined => {
      const event = eventsById.get(assignment.event_id);
      if (!event) return undefined;
      const claimId = `claim-${assignment.fact_id}`;
      return {
        link_id: `link-${assignment.event_id}`,
        claim_id: claimId,
        event_id: assignment.event_id,
        fact_id: assignment.fact_id,
        polarity: event.polarity,
      };
    })
    .filter((link): link is ClaimEvidenceLink => Boolean(link));

  return {
    ok: true,
    payload_schema: "claim-candidate-batch.v1",
    schema_version: "1.0.0",
    payload_id: `claim-candidate-batch-${input.date}`,
    run_id: `industry-weekly-${input.date}`,
    window_start: `${input.date}T00:00:00+08:00`,
    window_end: `${input.date}T23:59:59+08:00`,
    source_message_id: input.snapshot.snapshot_id,
    claim_candidate_batch_ref: `industry://internal/${input.date}/claim-candidate-batch.v1/${input.snapshot.snapshot_id}`,
    claim_evidence_link_batch_ref: `industry://internal/${input.date}/claim-evidence-link-batch.v1/${input.snapshot.snapshot_id}`,
    claim_builder_audit_refs: [input.snapshot.fact_resolution_audit.audit_id],
    candidate_group_ids: [...new Set(links.map((link) => link.fact_id))],
    input_event_ids: links.map((link) => link.event_id),
    generated_claim_ids: [...new Set(links.map((link) => link.claim_id))],
    deferred_event_ids: [],
    rejected_event_ids: [],
    claim_evidence_links: links,
  };
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
