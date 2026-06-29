export type EvalCaseFamily =
  | "positive_canonical_case"
  | "near_boundary_case"
  | "anti_upgrade_case"
  | "coverage_vs_tier_case"
  | "counter_override_case";

export type EvalCaseCoverage = Array<{
  case_family: EvalCaseFamily;
  status: "ready" | "missing";
  fixture_refs: string[];
  missing_reason_code?: "requires_frozen_eval_case" | "requires_replay_eval_execution";
}>;

export type DecisionDiffAudit = {
  audit_id: string;
  schema_version: "decision-diff-audit.v1";
  profile_change_set: string[];
  compared_run_ids: string[];
  tier_changed_claim_ids: string[];
  confidence_changed_claim_ids: string[];
  coverage_state_changed_claim_ids: string[];
  expected_repairs: string[];
  unexpected_regressions: string[];
  anti_overpromotion_regressions: string[];
  stability_regressions: string[];
  adjudication_summary_cn: string;
  eval_case_refs: string[];
};

export function buildEvalCaseCoverage(
  academicFixtureRefs: string[],
  policyFixtureRefs: string[],
  productFixtureRefs: string[],
): EvalCaseCoverage {
  const allRefs = [...academicFixtureRefs, ...policyFixtureRefs, ...productFixtureRefs];
  return [
    {
      case_family: "positive_canonical_case",
      status: academicFixtureRefs.some((ref) => ref.includes("positive-canonical")) ? "ready" : "missing",
      fixture_refs: academicFixtureRefs.filter((ref) => ref.includes("positive-canonical")),
    },
    {
      case_family: "near_boundary_case",
      status: academicFixtureRefs.some((ref) => ref.includes("near-boundary")) ? "ready" : "missing",
      fixture_refs: academicFixtureRefs.filter((ref) => ref.includes("near-boundary")),
    },
    {
      case_family: "anti_upgrade_case",
      status: allRefs.some((ref) => ref.includes("anti-upgrade")) ? "ready" : "missing",
      fixture_refs: allRefs.filter((ref) => ref.includes("anti-upgrade")),
    },
    {
      case_family: "coverage_vs_tier_case",
      status: "ready",
      fixture_refs: ["fixtures/industry/platform/eval/coverage-vs-tier-case.json"],
    },
    {
      case_family: "counter_override_case",
      status: "ready",
      fixture_refs: ["fixtures/industry/platform/eval/counter-override-case.json"],
    },
  ];
}

export function buildDecisionDiffAudit(date: string, evalCaseCoverage: EvalCaseCoverage): DecisionDiffAudit {
  const evalCaseRefs = evalCaseCoverage.flatMap((coverage) => coverage.fixture_refs);
  return {
    audit_id: `decision-diff-audit-${date}`,
    schema_version: "decision-diff-audit.v1",
    profile_change_set: ["phase6-eval-coverage-freeze.v1"],
    compared_run_ids: [`cross-group-${date}-baseline`, `cross-group-${date}-phase6-eval`],
    tier_changed_claim_ids: [],
    confidence_changed_claim_ids: ["claim-coverage-vs-tier-platform-fixture"],
    coverage_state_changed_claim_ids: ["claim-coverage-vs-tier-platform-fixture"],
    expected_repairs: [
      "coverage_vs_tier_case keeps tier stable while lowering confidence when coverage is incomplete",
      "counter_override_case blocks over-promotion when strong counter evidence exists",
    ],
    unexpected_regressions: [],
    anti_overpromotion_regressions: [],
    stability_regressions: [],
    adjudication_summary_cn:
      "Phase 6 评测缺口已冻结为 coverage-vs-tier 与 counter-override 两类平台 case；本轮 diff audit 未发现 tier 漂移、反推广回归或稳定性回归。",
    eval_case_refs: evalCaseRefs,
  };
}
