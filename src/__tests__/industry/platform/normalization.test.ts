import { describe, expect, it } from "vitest";
import currentBundleFixture from "../../../../fixtures/industry/agents/policy-agent/replay/phase1-current-bundle.json" with { type: "json" };
import negativeBundleFixture from "../../../../fixtures/industry/agents/policy-agent/replay/phase1-missing-stable-claim-key-bundle.json" with { type: "json" };
import sameRunCurrentFixture from "../../../../fixtures/industry/agents/policy-agent/compatibility/same-run-current-consumer.json" with { type: "json" };
import sameRunNegativeFixture from "../../../../fixtures/industry/agents/policy-agent/compatibility/same-run-missing-stable-claim-key-negative.json" with { type: "json" };
import { consumeFinancePolicyHandoffForDryRun } from "../../../industry/platform/normalization/financePolicyDryRun.ts";
import type { FinancePolicyHandoffBundle } from "../../../industry/platform/contracts/financePolicyHandoff.ts";

describe("industry platform normalization dry-run", () => {
  it("materializes the policy-finance current bundle without a producer wrapper", () => {
    const result = consumeFinancePolicyHandoffForDryRun({
      bundle: currentBundleFixture as FinancePolicyHandoffBundle,
      dispatchContext: sameRunCurrentFixture.dispatch_context,
      reservations: sameRunCurrentFixture.reservations,
      budgetArbitration: sameRunCurrentFixture.budget_arbitration,
      requiresCapacityReservation: true,
    });

    expect(result).toEqual({
      ok: true,
      status: "normalization_dry_run_ready",
      normalizedEventBatchRefs: [
        "industry://internal/2026-06-26/industry-signal-event-batch.v1/artifact-db38e9289fd9",
        "industry://internal/2026-06-26/industry-signal-event-batch.v1/artifact-f060994f979f",
        "industry://internal/2026-06-26/industry-signal-event-batch.v1/artifact-08e24477f2f6",
      ],
      rejectedEventBatchRefs: [
        "industry://internal/2026-06-26/industry-signal-event-batch.v1/artifact-a1d50f3eef0c",
        "industry://internal/2026-06-26/industry-signal-event-batch.v1/artifact-84c26a2cdf7b",
        "industry://internal/2026-06-26/industry-signal-event-batch.v1/artifact-f9f411bbf48c",
      ],
      coverageRefs: [
        "industry://internal/2026-06-26/axis-tool-coverage-report.v1/artifact-a5d9b9371f3d",
        "industry://internal/2026-06-26/axis-tool-coverage-report.v1/artifact-e6203625b947",
        "industry://internal/2026-06-26/axis-tool-coverage-report.v1/artifact-fcfa36416828",
      ],
      contributionRefs: [
        "industry://internal/2026-06-26/industry-agent-contribution.v1/artifact-26f2355c0b55",
        "industry://internal/2026-06-26/industry-agent-contribution.v1/artifact-22d14bc3c145",
        "industry://internal/2026-06-26/industry-agent-contribution.v1/artifact-c4823b591078",
      ],
      governanceProfileIds: [
        "axis-runtime-budget-profile.v1/capital_finance",
        "axis-runtime-budget-profile.v1/policy_regulatory",
        "axis-runtime-budget-profile.v1/policy_research_thinktank",
      ],
    });
  });

  it("rejects the policy-finance negative bundle before normalization dry-run", () => {
    const result = consumeFinancePolicyHandoffForDryRun({
      bundle: negativeBundleFixture as FinancePolicyHandoffBundle,
      dispatchContext: sameRunNegativeFixture.dispatch_context,
      reservations: sameRunNegativeFixture.reservations,
      budgetArbitration: sameRunNegativeFixture.budget_arbitration,
      requiresCapacityReservation: true,
    });

    expect(result).toMatchObject({
      ok: false,
      reasonCode: "dispatch_context_missing",
    });
  });
});
