import type { ExternalDirectionLabel } from "../externalDiscovery/types.ts";

export interface AgentReachQueryEntry {
  id: string;
  terms: string[];
  direction_labels: ExternalDirectionLabel[];
  tags?: string[];
}

export const AGENT_REACH_QUERY_PACK: AgentReachQueryEntry[] = [
  {
    id: "research-agent",
    terms: ["research agent", "ai research assistant", "scientific agent"],
    direction_labels: ["research-agent"],
    tags: ["research"],
  },
  {
    id: "literature-review-agent",
    terms: ["literature review agent", "paper reading agent", "research paper assistant"],
    direction_labels: ["literature-review-agent", "research-agent"],
    tags: ["research", "papers"],
  },
  {
    id: "research-data-analysis-agent",
    terms: ["research data analysis agent", "scientific data agent"],
    direction_labels: ["research-data-analysis-agent", "research-agent"],
    tags: ["research", "data-analysis"],
  },
  {
    id: "academic-writing-agent",
    terms: ["academic writing agent", "paper writing assistant"],
    direction_labels: ["academic-writing-agent", "research-agent"],
    tags: ["research", "writing"],
  },
  {
    id: "office-agent",
    terms: ["office agent", "workplace ai agent", "productivity agent"],
    direction_labels: ["office-agent", "office-productivity-agent"],
    tags: ["office"],
  },
  {
    id: "personal-assistant-agent",
    terms: ["personal assistant agent", "executive assistant agent"],
    direction_labels: ["personal-assistant-agent", "office-agent"],
    tags: ["office", "assistant"],
  },
  {
    id: "document-agent",
    terms: ["document agent"],
    direction_labels: ["document-agent", "office-agent"],
    tags: ["office", "documents"],
  },
  {
    id: "spreadsheet-agent",
    terms: ["spreadsheet agent"],
    direction_labels: ["spreadsheet-agent", "office-agent"],
    tags: ["office", "spreadsheets"],
  },
  {
    id: "meeting-agent",
    terms: ["meeting agent"],
    direction_labels: ["meeting-agent", "office-agent"],
    tags: ["office", "meetings"],
  },
  {
    id: "workflow-automation-agent",
    terms: ["workflow automation agent", "office workflow agent"],
    direction_labels: ["workflow-automation-agent", "office-productivity-agent"],
    tags: ["office", "workflow"],
  },
  {
    id: "legal-agent",
    terms: ["legal agent"],
    direction_labels: ["legal-agent", "vertical-office-agent", "office-agent"],
    tags: ["vertical-office", "legal"],
  },
  {
    id: "finance-agent",
    terms: ["finance agent"],
    direction_labels: ["finance-agent", "vertical-office-agent", "office-agent"],
    tags: ["vertical-office", "finance"],
  },
  {
    id: "sales-crm-agent",
    terms: ["sales crm agent"],
    direction_labels: ["sales-crm-agent", "vertical-office-agent", "office-agent"],
    tags: ["vertical-office", "sales-crm"],
  },
  {
    id: "hr-agent",
    terms: ["hr agent"],
    direction_labels: ["hr-agent", "vertical-office-agent", "office-agent"],
    tags: ["vertical-office", "hr"],
  },
  {
    id: "enterprise-ops-agent",
    terms: ["enterprise operations agent"],
    direction_labels: ["enterprise-ops-agent", "vertical-office-agent"],
    tags: ["enterprise", "operations"],
  },
  {
    id: "healthcare-admin-agent",
    terms: ["healthcare admin agent"],
    direction_labels: ["healthcare-admin-agent", "vertical-office-agent"],
    tags: ["enterprise", "healthcare-admin"],
  },
  {
    id: "education-agent",
    terms: ["education agent"],
    direction_labels: ["education-agent", "vertical-office-agent"],
    tags: ["enterprise", "education"],
  },
];
