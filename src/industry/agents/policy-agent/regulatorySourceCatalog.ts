import type { AxisSeedConfig } from "./groupProtocol.ts";

export const policyRegulatorySeed: AxisSeedConfig = {
  agent_id: "policy-agent",
  responsibility_id: "policy-regulatory",
  axis: "policy_regulatory",
  primary: [
    { tool_id: "official-regulator-rss", source_class: "official_structured_api" },
    { tool_id: "government-policy-library", source_class: "official_owned_feed_or_doc" },
  ],
  secondary: [{ tool_id: "regulator-open-data", source_class: "official_structured_api" }],
  fallback: [{ tool_id: "policy-domain-search", source_class: "domain_structured_search" }],
  last_resort: [{ tool_id: "manual-regulatory-triage", source_class: "manual_or_local_only" }],
  registry_snapshot_ref: "registry://industry/source-authority/policy/v1",
  tool_registry_snapshot_ref: "registry://industry/tool-catalog/policy/v1",
  budget_profile_id: "axis-runtime-budget-profile.v1/policy_regulatory",
};
