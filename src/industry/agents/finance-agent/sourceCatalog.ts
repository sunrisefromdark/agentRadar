import type { AxisSeedConfig } from "../policy-agent/groupProtocol.ts";

export const capitalFinanceSeed: AxisSeedConfig = {
  agent_id: "finance-agent",
  responsibility_id: "capital-finance",
  axis: "capital_finance",
  primary: [
    { tool_id: "sec-edgar-api", source_class: "official_structured_api" },
    { tool_id: "portfolio-company-ir-feed", source_class: "official_owned_feed_or_doc" },
    { tool_id: "public-company-filings", source_class: "official_owned_feed_or_doc" },
    { tool_id: "earnings-call-transcripts", source_class: "official_owned_feed_or_doc" },
    { tool_id: "public-ma-announcements", source_class: "official_owned_feed_or_doc" },
  ],
  secondary: [
    { tool_id: "company-investor-relations-docs", source_class: "official_owned_feed_or_doc" },
    { tool_id: "public-fund-reports", source_class: "official_owned_feed_or_doc" },
    { tool_id: "industry-finance-data", source_class: "specialized_research_or_discovery" },
  ],
  fallback: [
    { tool_id: "licensed-market-discovery", source_class: "domain_structured_search" },
    { tool_id: "market-report-research", source_class: "specialized_research_or_discovery" },
  ],
  last_resort: [{ tool_id: "manual-finance-triage", source_class: "manual_or_local_only" }],
  registry_snapshot_ref: "registry://industry/source-authority/finance/v1",
  tool_registry_snapshot_ref: "registry://industry/tool-catalog/finance/v1",
  budget_profile_id: "axis-runtime-budget-profile.v1/capital_finance",
};
