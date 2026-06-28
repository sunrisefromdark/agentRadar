import fs from "node:fs";
import path from "node:path";
import type { FinancePolicyHandoffBundle } from "../contracts/financePolicyHandoff.ts";
import {
  consumeFinancePolicyHandoffForRuntime,
  type FinancePolicyRuntimeResult,
} from "./financePolicyDryRun.ts";

type RuntimeFixtureRecord = Record<string, unknown>;

export type PolicyFinanceRuntimeReadyFixturePaths = {
  fixture_id: string;
  helper_entrypoints: {
    dry_run: string;
    runtime_ready: string;
    runtime_ready_fixture_replay: string;
    platform_runtime_replay?: string;
    platform_runtime_consumer: string;
  };
  current: {
    bundle: string;
    same_run_fixture: string;
    platform_current_runtime_fixture: string;
    expected_status: string;
  };
  negative_missing_stable_claim_key: {
    bundle: string;
    same_run_fixture: string;
    platform_negative_runtime_fixture: string;
    expected_case_id: string;
    expected_reason_code: string;
  };
};

export type PlatformCurrentRuntimeFixture = {
  dispatch_gate?: {
    high_cost_requires_reservation_state?: string;
    async_only_review_is_not_same_run_available?: boolean;
  };
};

export type PlatformNegativeRuntimeFixture = {
  cases?: Array<{
    case_id?: string;
    expected_reason_code?: string;
  }>;
};

export type PolicyFinanceRuntimeReadyReplayResult = {
  fixture: PolicyFinanceRuntimeReadyFixturePaths;
  current_runtime_contract: PlatformCurrentRuntimeFixture;
  negative_runtime_case?: { case_id?: string; expected_reason_code?: string };
  current: FinancePolicyRuntimeResult;
  negative_missing_stable_claim_key: FinancePolicyRuntimeResult;
};

export const DEFAULT_POLICY_FINANCE_RUNTIME_READY_FIXTURE_PATH =
  "fixtures/industry/agents/policy-agent/replay/phase1-runtime-ready-inputs.json";

export function replayPolicyFinanceRuntimeReadyFixture(input?: {
  rootDir?: string;
  fixturePath?: string;
}): PolicyFinanceRuntimeReadyReplayResult {
  const rootDir = input?.rootDir ?? process.cwd();
  const fixturePath = input?.fixturePath ?? DEFAULT_POLICY_FINANCE_RUNTIME_READY_FIXTURE_PATH;
  const fixture = readJson<PolicyFinanceRuntimeReadyFixturePaths>(rootDir, fixturePath);

  const currentBundle = readJson<FinancePolicyHandoffBundle>(rootDir, fixture.current.bundle);
  const currentSameRun = readJson<RuntimeFixtureRecord>(rootDir, fixture.current.same_run_fixture);
  const currentRuntimeContract = readJson<PlatformCurrentRuntimeFixture>(rootDir, fixture.current.platform_current_runtime_fixture);
  const negativeBundle = readJson<FinancePolicyHandoffBundle>(rootDir, fixture.negative_missing_stable_claim_key.bundle);
  const negativeSameRun = readJson<RuntimeFixtureRecord>(rootDir, fixture.negative_missing_stable_claim_key.same_run_fixture);
  const negativeRuntimeContract = readJson<PlatformNegativeRuntimeFixture>(
    rootDir,
    fixture.negative_missing_stable_claim_key.platform_negative_runtime_fixture,
  );
  const requiresCapacityReservation = currentRuntimeContract.dispatch_gate?.high_cost_requires_reservation_state === "granted";
  const negativeRuntimeCase = negativeRuntimeContract.cases?.find(
    (item) => item.case_id === fixture.negative_missing_stable_claim_key.expected_case_id,
  );

  return {
    fixture,
    current_runtime_contract: currentRuntimeContract,
    negative_runtime_case: negativeRuntimeCase,
    current: consumeFinancePolicyHandoffForRuntime({
      bundle: currentBundle,
      dispatchContext: objectField(currentSameRun, "dispatch_context"),
      reservations: arrayField(currentSameRun, "reservations"),
      budgetArbitration: objectField(currentSameRun, "budget_arbitration"),
      requiresCapacityReservation,
    }),
    negative_missing_stable_claim_key: consumeFinancePolicyHandoffForRuntime({
      bundle: negativeBundle,
      dispatchContext: objectField(negativeSameRun, "dispatch_context"),
      reservations: arrayField(negativeSameRun, "reservations"),
      budgetArbitration: objectField(negativeSameRun, "budget_arbitration"),
      requiresCapacityReservation,
    }),
  };
}

function readJson<T>(rootDir: string, relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8")) as T;
}

function objectField(record: RuntimeFixtureRecord, key: string): object | undefined {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as object) : undefined;
}

function arrayField(record: RuntimeFixtureRecord, key: string): object[] | undefined {
  const value = record[key];
  return Array.isArray(value) ? (value as object[]) : undefined;
}
