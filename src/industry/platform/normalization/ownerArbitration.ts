import type { SourceChainDedupeBatch } from "./sourceChainDedupe.ts";

export type OwnerTransferArtifact = {
  schema_version: "owner-transfer-artifact.v1";
  status: "closed";
  owner_assignments: Array<{
    event_id: string;
    fact_id: string;
    owner_agent_id: string;
    responsibility_id: string;
    transfer_state: "retained";
    reason_codes: string[];
  }>;
};

export function buildOwnerTransferArtifact(input: { dedupeBatch: SourceChainDedupeBatch }): OwnerTransferArtifact {
  return {
    schema_version: "owner-transfer-artifact.v1",
    status: "closed",
    owner_assignments: input.dedupeBatch.deduped_events.map((event) => ({
      event_id: event.eventId,
      fact_id: `fact-${event.eventId}`,
      owner_agent_id: event.ownerAgentId,
      responsibility_id: event.responsibilityId,
      transfer_state: "retained",
      reason_codes: ["execution_context_owner"],
    })),
  };
}
