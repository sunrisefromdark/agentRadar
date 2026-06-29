import type { SourceChainDedupeBatch } from "./sourceChainDedupe.ts";

export type FactResolutionAudit = {
  audit_id: string;
  schema_version: "fact-resolution-audit.v1";
  snapshot_id: string;
  event_fact_assignments: Array<{
    event_id: string;
    fact_id: string;
    fact_resolution_state: "canonical";
    resolution_basis_codes: string[];
    confidence: "high";
    requires_manual_review: false;
  }>;
  relation_edges: [];
  high_impact_unresolved_groups: [];
};

export function buildFactResolutionAudit(input: {
  date: string;
  snapshotId: string;
  dedupeBatch: SourceChainDedupeBatch;
}): FactResolutionAudit {
  return {
    audit_id: `fact-resolution-audit-${input.date}`,
    schema_version: "fact-resolution-audit.v1",
    snapshot_id: input.snapshotId,
    event_fact_assignments: input.dedupeBatch.deduped_events.map((event) => ({
      event_id: event.eventId,
      fact_id: `fact-${event.eventId}`,
      fact_resolution_state: "canonical",
      resolution_basis_codes: ["source_chain_deduped", "owner_arbitrated"],
      confidence: "high",
      requires_manual_review: false,
    })),
    relation_edges: [],
    high_impact_unresolved_groups: [],
  };
}
