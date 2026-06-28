import fs from "node:fs";
import path from "node:path";

type RecordLike = Record<string, unknown>;

type Phase6AssemblyInput = {
  deliveryManifest: RecordLike;
  replayRefs: RecordLike;
  rootDir: string;
};

type PlatformGates = {
  formalBundle: "normalization_dry_run_ready";
  invalidGovernanceProfile: "dry_run_rejected";
  claimCriticalMissingSameRunRefs: "dispatch_context_missing";
};

export type ProductEcosystemPhase6AssemblyResult =
  | {
      ok: true;
      status: "product_ecosystem_phase6_inputs_accepted";
      scope: "product-ecosystem-community-news";
      replayWindowIds: string[];
      supportingFixtureRefs: string[];
      replayFixtureRefs: string[];
      platformConsumerRefs: string[];
      platformGates: PlatformGates;
      crossGroupReady: false;
      weeklyOutputReady: false;
      blockedUntil: "three_group_phase6_assets";
    }
  | {
      ok: false;
      reasonCode: "schema_mismatch" | "lineage_failed";
      message: string;
    };

const EXPECTED_GATES: PlatformGates = {
  formalBundle: "normalization_dry_run_ready",
  invalidGovernanceProfile: "dry_run_rejected",
  claimCriticalMissingSameRunRefs: "dispatch_context_missing",
};

function record(value: unknown): RecordLike {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function values(recordValue: unknown): string[] {
  return Object.values(record(recordValue)).flatMap((value) => (typeof value === "string" ? [value] : strings(value)));
}

function requireExisting(rootDir: string, refs: string[]): ProductEcosystemPhase6AssemblyResult | undefined {
  const missing = refs.find((ref) => !fs.existsSync(path.join(rootDir, ref)));
  return missing ? { ok: false, reasonCode: "lineage_failed", message: `Missing Phase 6 ref: ${missing}` } : undefined;
}

export function assembleProductEcosystemPhase6Inputs(input: Phase6AssemblyInput): ProductEcosystemPhase6AssemblyResult {
  if (input.deliveryManifest.manifest_id !== "product-ecosystem-phase6-delivery-manifest.v1") {
    return { ok: false, reasonCode: "schema_mismatch", message: "Unexpected product ecosystem Phase 6 manifest." };
  }
  if (input.deliveryManifest.product_ecosystem_inputs_complete_for_executor_4_phase6 !== true) {
    return { ok: false, reasonCode: "lineage_failed", message: "Product ecosystem Phase 6 inputs are not marked complete." };
  }
  if (input.replayRefs.refs_id !== "product-ecosystem-phase6-replay-refs.v1") {
    return { ok: false, reasonCode: "schema_mismatch", message: "Unexpected product ecosystem Phase 6 replay refs." };
  }
  if (input.replayRefs.status !== "ready_for_platform_phase6_assembly") {
    return { ok: false, reasonCode: "lineage_failed", message: "Product ecosystem replay refs are not ready." };
  }

  const gates = record(input.deliveryManifest.expected_platform_gates);
  if (
    gates.formal_bundle !== EXPECTED_GATES.formalBundle ||
    gates.invalid_governance_profile !== EXPECTED_GATES.invalidGovernanceProfile ||
    gates.claim_critical_missing_same_run_refs !== EXPECTED_GATES.claimCriticalMissingSameRunRefs
  ) {
    return { ok: false, reasonCode: "schema_mismatch", message: "Product ecosystem Phase 6 gates are incomplete." };
  }

  const replayWindows = Array.isArray(input.replayRefs.replay_windows) ? input.replayRefs.replay_windows.map(record) : [];
  const replayWindowIds = replayWindows.map((window) => window.window_id).filter((item): item is string => typeof item === "string");
  const replayFixtureRefs = replayWindows.flatMap((window) => strings(window.fixture_refs));
  const supportingFixtureRefs = values(input.deliveryManifest.supporting_fixture_refs);
  const platformConsumerRefs = values(input.deliveryManifest.platform_consumers);
  const testEntryRefs = values(input.deliveryManifest.test_entrypoints);
  const stableEntrypointRefs = values(input.deliveryManifest.stable_entrypoints);

  if (!replayWindowIds.length || !supportingFixtureRefs.length || !platformConsumerRefs.length) {
    return { ok: false, reasonCode: "lineage_failed", message: "Product ecosystem Phase 6 assembly refs are incomplete." };
  }

  const missing = requireExisting(input.rootDir, [
    ...new Set([...supportingFixtureRefs, ...replayFixtureRefs, ...platformConsumerRefs, ...testEntryRefs, ...stableEntrypointRefs]),
  ]);
  if (missing) return missing;

  return {
    ok: true,
    status: "product_ecosystem_phase6_inputs_accepted",
    scope: "product-ecosystem-community-news",
    replayWindowIds,
    supportingFixtureRefs: [...new Set(supportingFixtureRefs)],
    replayFixtureRefs,
    platformConsumerRefs,
    platformGates: EXPECTED_GATES,
    crossGroupReady: false,
    weeklyOutputReady: false,
    blockedUntil: "three_group_phase6_assets",
  };
}
