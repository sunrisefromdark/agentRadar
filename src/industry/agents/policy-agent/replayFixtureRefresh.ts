import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildPolicyFinanceHandoffBundle, buildPolicyFinanceGroupHandoff } from "./handoff.ts";

type SameRunFixture = {
  capability_class: "claim-critical";
  dispatch_context_ref: string;
  scheduling_key: string;
  claim_partition_id?: string;
  candidate_group_id?: string;
  claim_admission_assessment_ref: string;
  capacity_reservation_refs: string[];
};

const CURRENT_BUNDLE_PATH = "fixtures/industry/agents/policy-agent/replay/phase1-current-bundle.json";
const NEGATIVE_BUNDLE_PATH = "fixtures/industry/agents/policy-agent/replay/phase1-missing-stable-claim-key-bundle.json";
const DELIVERY_CHECKSUMS_PATH = "fixtures/industry/agents/policy-agent/replay/phase1-delivery-checksums.json";
const SAME_RUN_CURRENT_PATH = "fixtures/industry/agents/policy-agent/compatibility/same-run-current-consumer.json";
const SAME_RUN_NEGATIVE_PATH = "fixtures/industry/agents/policy-agent/compatibility/same-run-missing-stable-claim-key-negative.json";

const DELIVERY_CHECKSUM_PATHS = [
  "fixtures/industry/agents/policy-agent/replay/phase1-delivery-manifest.json",
  "fixtures/industry/agents/policy-agent/replay/phase1-next-platform-actions.json",
  "fixtures/industry/agents/policy-agent/replay/phase1-runtime-ready-inputs.json",
  CURRENT_BUNDLE_PATH,
  NEGATIVE_BUNDLE_PATH,
  SAME_RUN_CURRENT_PATH,
  SAME_RUN_NEGATIVE_PATH,
  "src/industry/agents/policy-agent/handoff-note.md",
  "src/industry/agents/policy-agent/shared-runtime-note.md",
  "src/industry/agents/policy-agent/index.ts",
  "src/industry/agents/policy-agent/handoff.ts",
  "src/industry/agents/finance-agent/index.ts",
  "src/industry/platform/normalization/financePolicyDryRun.ts",
  "src/industry/platform/normalization/policyFinanceRuntimeReplay.ts",
  "fixtures/industry/platform/current-consumer/phase1-runtime.json",
  "fixtures/industry/platform/negative/phase1-runtime.json",
] as const;

export function refreshPolicyFinanceReplayFixtures(rootDir = process.cwd()): {
  currentBundlePath: string;
  negativeBundlePath: string;
  deliveryChecksumsPath: string;
} {
  const currentSameRun = readJson<SameRunFixture>(rootDir, SAME_RUN_CURRENT_PATH);
  const negativeSameRun = readJson<SameRunFixture>(rootDir, SAME_RUN_NEGATIVE_PATH);

  const currentBundle = buildBundle(currentSameRun, false);
  const negativeBundle = buildBundle(negativeSameRun, true);

  writeJson(rootDir, CURRENT_BUNDLE_PATH, currentBundle);
  writeJson(rootDir, NEGATIVE_BUNDLE_PATH, negativeBundle);
  writeJson(rootDir, DELIVERY_CHECKSUMS_PATH, {
    manifest_id: "policy-finance-phase1-delivery-checksums.v1",
    algorithm: "sha256",
    entries: DELIVERY_CHECKSUM_PATHS.map((relativePath) => ({
      path: relativePath,
      sha256: sha256(fs.readFileSync(path.join(rootDir, relativePath), "utf8").replace(/\r\n/g, "\n")),
    })),
  });

  return {
    currentBundlePath: CURRENT_BUNDLE_PATH,
    negativeBundlePath: NEGATIVE_BUNDLE_PATH,
    deliveryChecksumsPath: DELIVERY_CHECKSUMS_PATH,
  };
}

function buildBundle(sameRunFixture: SameRunFixture, omitStableClaimKey: boolean) {
  const current = buildPolicyFinanceGroupHandoff({
    runId: "run-group-runtime-helper-1",
    threadId: "thread-group-runtime-helper-1",
    windowStart: "2026-06-20T00:00:00+08:00",
    windowEnd: "2026-06-26T23:59:59+08:00",
    now: "2026-06-26T17:30:00+08:00",
    finance: {
      runId: "run-group-runtime-helper-1",
      threadId: "thread-group-runtime-helper-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:30:00+08:00",
      availableToolIds: ["sec-edgar-api"],
      canonicalSourceAvailable: true,
      runtimeContext: runtimeContextFromFixture(sameRunFixture, omitStableClaimKey),
      sources: [
        {
          sourceId: "finance-runtime-helper",
          displayName: "SEC Filing",
          sourceType: "financial_filing",
          sourceFamily: "finance_sec_filing",
          authorityTier: "core",
          primarySourceDistance: "primary",
          accessMode: "api",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "SEC EDGAR",
          bucket: "accepted",
          title: "资本主证 helper",
          summaryCn: "finance helper accepted",
          financeSignalKind: "capital_allocation",
          agentRelevanceScore: 0.91,
          agentRelevanceReasons: ["finance-runtime-helper"],
        },
      ],
    },
    regulatory: {
      runId: "run-group-runtime-helper-1",
      threadId: "thread-group-runtime-helper-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:30:00+08:00",
      availableToolIds: ["official-regulator-rss"],
      canonicalSourceAvailable: true,
      runtimeContext: runtimeContextFromFixture(sameRunFixture, omitStableClaimKey),
      sources: [
        {
          sourceId: "reg-runtime-helper",
          displayName: "监管公告",
          sourceType: "policy",
          sourceFamily: "policy_regulatory_filing",
          authorityTier: "core",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "Federal Register",
          bucket: "accepted",
          title: "监管主证 helper",
          summaryCn: "regulatory helper accepted",
          policySignalKind: "confirmed_approval",
          agentRelevanceScore: 0.9,
          agentRelevanceReasons: ["reg-runtime-helper"],
        },
      ],
    },
    thinktank: {
      runId: "run-group-runtime-helper-1",
      threadId: "thread-group-runtime-helper-1",
      windowStart: "2026-06-20T00:00:00+08:00",
      windowEnd: "2026-06-26T23:59:59+08:00",
      now: "2026-06-26T17:30:00+08:00",
      availableToolIds: ["thinktank-report-registry"],
      canonicalSourceAvailable: true,
      runtimeContext: runtimeContextFromFixture(sameRunFixture, omitStableClaimKey),
      sources: [
        {
          sourceId: "thinktank-runtime-helper",
          displayName: "智库报告",
          sourceType: "thinktank_report",
          sourceFamily: "thinktank_institutional_report",
          authorityTier: "proven",
          primarySourceDistance: "primary",
          accessMode: "public",
          costTier: "free",
          reviewStatus: "active",
          namedSource: "RAND",
          bucket: "accepted",
          title: "智库主证 helper",
          summaryCn: "thinktank helper accepted",
          policySignalKind: "thinktank_viewpoint",
          agentRelevanceScore: 0.82,
          agentRelevanceReasons: ["thinktank-runtime-helper"],
        },
      ],
    },
  });

  return buildPolicyFinanceHandoffBundle(current);
}

function runtimeContextFromFixture(sameRunFixture: SameRunFixture, omitStableClaimKey: boolean) {
  return {
    capabilityClass: sameRunFixture.capability_class,
    dispatchContextRef: sameRunFixture.dispatch_context_ref,
    schedulingKey: sameRunFixture.scheduling_key,
    claimPartitionId: omitStableClaimKey ? undefined : sameRunFixture.claim_partition_id,
    candidateGroupId: omitStableClaimKey ? undefined : sameRunFixture.candidate_group_id,
    claimAdmissionAssessmentRef: sameRunFixture.claim_admission_assessment_ref,
    capacityReservationRefs: sameRunFixture.capacity_reservation_refs,
  };
}

function readJson<T>(rootDir: string, relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8")) as T;
}

function writeJson(rootDir: string, relativePath: string, value: unknown): void {
  fs.writeFileSync(path.join(rootDir, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
