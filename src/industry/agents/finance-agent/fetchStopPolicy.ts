export interface CapitalFinanceStopPolicyInput {
  licenseRiskHigh?: boolean;
  accessModeOptionalPaid?: boolean;
  humanExceptionRequired?: boolean;
  timeoutBudgetExhausted?: boolean;
  canonicalSourceAvailable?: boolean;
  publicFetchDisallowed?: boolean;
}

export function evaluateCapitalFinanceStopPolicy(input: CapitalFinanceStopPolicyInput): string | undefined {
  if (input.licenseRiskHigh) return "license_risk_high";
  if (input.accessModeOptionalPaid) return "access_mode_optional_paid";
  if (input.humanExceptionRequired) return "human_exception_required";
  if (input.timeoutBudgetExhausted) return "timeout_budget_exhausted";
  if (input.publicFetchDisallowed) return "public_fetch_disallowed";
  if (input.canonicalSourceAvailable === false) return "no_canonical_source_available";
  return undefined;
}
