import type { AxisSeedConfig } from "./groupProtocol.ts";

export const policyThinktankSeed: AxisSeedConfig = {
  agent_id: "policy-agent",
  responsibility_id: "policy-research-thinktank",
  axis: "policy_research_thinktank",
  primary: [
    { tool_id: "thinktank-report-registry", source_class: "official_owned_feed_or_doc" },
    { tool_id: "institution-research-briefs", source_class: "official_owned_feed_or_doc" },
  ],
  secondary: [{ tool_id: "research-library-index", source_class: "specialized_research_or_discovery" }],
  fallback: [{ tool_id: "thinktank-domain-search", source_class: "domain_structured_search" }],
  last_resort: [{ tool_id: "manual-thinktank-triage", source_class: "manual_or_local_only" }],
  registry_snapshot_ref: "registry://industry/source-authority/thinktank/v1",
  tool_registry_snapshot_ref: "registry://industry/tool-catalog/thinktank/v1",
  budget_profile_id: "axis-runtime-budget-profile.v1/policy_research_thinktank",
};
