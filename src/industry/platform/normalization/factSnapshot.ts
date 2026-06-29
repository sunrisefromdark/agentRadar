import { buildFactResolutionAudit, type FactResolutionAudit } from "./factResolution.ts";
import { buildOwnerTransferArtifact, type OwnerTransferArtifact } from "./ownerArbitration.ts";
import {
  buildSourceChainDedupeBatch,
  type PlatformGroupId,
  type SourceChainDedupeBatch,
} from "./sourceChainDedupe.ts";

export type ClosedFactSnapshot = {
  status: "closed" | "blocked";
  snapshot_id: string;
  claim_builder_input_ready: boolean;
  weekly_output_ready: false;
  source_chain_dedupe_batch: SourceChainDedupeBatch;
  fact_resolution_audit: FactResolutionAudit;
  owner_transfer_artifact: OwnerTransferArtifact;
};

export function buildClosedFactSnapshot(input: {
  date: string;
  bundles: Array<{ group: PlatformGroupId; bundle: unknown }>;
}): ClosedFactSnapshot {
  const snapshotId = `fact-snapshot-${input.date}`;
  const dedupeBatch = buildSourceChainDedupeBatch({ bundles: input.bundles });
  const factResolutionAudit = buildFactResolutionAudit({
    date: input.date,
    snapshotId,
    dedupeBatch,
  });
  const ownerTransferArtifact = buildOwnerTransferArtifact({ dedupeBatch });
  const closed = input.bundles.length >= 3 && dedupeBatch.deduped_event_count > 0;

  return {
    status: closed ? "closed" : "blocked",
    snapshot_id: snapshotId,
    claim_builder_input_ready: closed,
    weekly_output_ready: false,
    source_chain_dedupe_batch: dedupeBatch,
    fact_resolution_audit: factResolutionAudit,
    owner_transfer_artifact: ownerTransferArtifact,
  };
}
