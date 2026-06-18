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
    id: "document-spreadsheet-meeting-agent",
    terms: ["document agent", "spreadsheet agent", "meeting agent"],
    direction_labels: [
      "document-agent",
      "spreadsheet-agent",
      "meeting-agent",
      "office-agent",
    ],
    tags: ["office", "documents"],
  },
  {
    id: "workflow-automation-agent",
    terms: ["workflow automation agent", "office workflow agent"],
    direction_labels: ["workflow-automation-agent", "office-productivity-agent"],
    tags: ["office", "workflow"],
  },
  {
    id: "vertical-office-agent",
    terms: ["legal agent", "finance agent", "sales crm agent", "hr agent"],
    direction_labels: [
      "vertical-office-agent",
      "legal-agent",
      "finance-agent",
      "sales-crm-agent",
      "hr-agent",
      "office-agent",
    ],
    tags: ["vertical-office"],
  },
  {
    id: "enterprise-ops-agent",
    terms: ["enterprise operations agent", "healthcare admin agent", "education agent"],
    direction_labels: [
      "enterprise-ops-agent",
      "healthcare-admin-agent",
      "education-agent",
      "vertical-office-agent",
    ],
    tags: ["enterprise"],
  },
];
