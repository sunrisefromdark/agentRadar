import type {
  DirectionBoundaryMode,
  DirectionCatalogDepth,
  DirectionCatalogEntry,
  DirectionLaneType,
  DirectionQueryPack,
} from "../types.ts";

export type { DirectionCatalogEntry, DirectionQueryPack } from "../types.ts";

export const PROJECT_SEARCH_CONSTANTS = {
  directionCount: 16,
  queryPackCountMin: 3,
  queryTemplateCountPerPackMin: 2,
  directionRawHitsMin: 20,
  directionNormalizedHitsMin: 6,
  directionQualityPassedHitsMin: 2,
  globalHotQuota: 4,
  demandRelevantQuota: 4,
  anchorSeatCount: 2,
  challengerSeatCount: 2,
} as const;

function makeDirection(
  direction_key: string,
  family_key: string,
  display_name_cn: string,
  boundary_mode: DirectionBoundaryMode,
  search_depth: DirectionCatalogDepth,
  canonical: string,
): DirectionCatalogEntry {
  return {
    direction_key,
    family_key,
    display_name_cn,
    boundary_mode,
    search_depth,
    lane_types: ["canonical", "job-to-be-done", "user-speak", "ecosystem", "adjacent-software"],
    required_terms: canonical.split(" "),
    negative_terms: ["game", "gaming"],
    evidence_verbs: ["build", "automate", "coordinate"],
    evidence_objects: ["agent", "workflow", "software"],
    zero_result_explanation_cn: `今天还没有扫到足够可靠的「${display_name_cn}」候选。`,
    query_packs: [
      { lane_type: "canonical", templates: [canonical, `open source ${canonical}`] },
      { lane_type: "job-to-be-done", templates: [`software for ${canonical}`, `${canonical} workflow`] },
      {
        lane_type: "user-speak-or-ecosystem",
        templates: [`${canonical} github`, `${canonical} automation`],
      },
    ],
  };
}

export const DIRECTION_CATALOG: DirectionCatalogEntry[] = [
  makeDirection("coding-agent", "core-agent-work", "开发与编码代理", "strict-agent", "deep-daily", "coding agent"),
  makeDirection("browser-computer-use", "core-agent-work", "浏览器 / 桌面执行代理", "strict-agent", "deep-daily", "browser computer use agent"),
  makeDirection("workflow-automation-agent", "core-agent-work", "行业工作流执行代理", "workflow-intelligence", "deep-daily", "workflow automation agent"),
  makeDirection("research-knowledge-agent", "core-agent-work", "研究与知识工作代理", "workflow-intelligence", "deep-daily", "research knowledge agent"),
  makeDirection("shopping-commerce-agent", "revenue-commerce", "智能导购与电商运营代理", "workflow-intelligence", "deep-daily", "shopping commerce agent"),
  makeDirection("sales-prospecting-agent", "revenue-commerce", "销售拓客与线索运营代理", "workflow-intelligence", "deep-daily", "sales prospecting agent"),
  makeDirection("customer-support-agent", "revenue-commerce", "客服与服务台代理", "workflow-intelligence", "deep-daily", "customer support agent"),
  makeDirection("marketing-content-ops-agent", "revenue-commerce", "营销内容与增长运营代理", "workflow-intelligence", "scout-daily", "marketing content ops agent"),
  makeDirection("finance-investment-research-agent", "analysis-professional", "金融分析与投研代理", "regulated-specialist", "deep-daily", "finance investment research agent"),
  makeDirection("data-analytics-bi-agent", "analysis-professional", "数据分析与 BI 代理", "workflow-intelligence", "deep-daily", "data analytics bi agent"),
  makeDirection("legal-compliance-agent", "analysis-professional", "法务与合规代理", "regulated-specialist", "scout-daily", "legal compliance agent"),
  makeDirection("security-soc-agent", "analysis-professional", "安全运营与安全审计代理", "regulated-specialist", "scout-daily", "security soc agent"),
  makeDirection("healthcare-ops-agent", "vertical-ops", "医疗服务与临床运营代理", "regulated-specialist", "scout-daily", "healthcare ops agent"),
  makeDirection("recruiting-hr-agent", "vertical-ops", "招聘与人力运营代理", "workflow-intelligence", "scout-daily", "recruiting hr agent"),
  makeDirection("supply-chain-procurement-agent", "vertical-ops", "供应链与采购代理", "workflow-intelligence", "scout-daily", "supply chain procurement agent"),
  makeDirection("industrial-field-ops-agent", "vertical-ops", "工业 / 现场运维代理", "workflow-intelligence", "scout-daily", "industrial field ops agent"),
];

export function getDirectionByKey(directionKey: string): DirectionCatalogEntry | undefined {
  return DIRECTION_CATALOG.find((item) => item.direction_key === directionKey);
}
