import type { ProjectsViewModel } from "../visualConsole/types.ts";
import type { ProjectsWorkbenchSortMode } from "./projectSearchKernel.ts";

export type ProjectSearchLang = "zh" | "en";

export interface ProjectSearchRecord {
  projectId: string;
  project: ProjectsViewModel["projects"][number];
  searchName: string;
  searchDescription: string;
  searchMeta: string;
  score: number;
  growth: number;
  order: number;
  paradigm: string;
  persistence: string;
}

export interface ProjectSearchActiveFilters {
  paradigm?: string;
  persistence?: string;
  sort?: ProjectsWorkbenchSortMode;
}

const COMPANY_SEARCH_ALIASES: Array<[RegExp, string[]]> = [
  [/\b(byte[-\s]?dance|bytedance[-\s]?seed|ui[-\s]?tars)\b/i, ["ByteDance", "字节", "字节跳动"]],
  [/\b(tencent|tencentarc|hunyuan)\b/i, ["Tencent", "腾讯"]],
  [/\b(alibaba|alibabacloud|aliyun|qwen|tongyi)\b/i, ["Alibaba", "阿里", "阿里巴巴", "通义"]],
  [/\b(baidu|qianfan|ernie)\b/i, ["Baidu", "百度", "文心"]],
  [/\b(netease|youdao)\b/i, ["NetEase", "网易", "有道"]],
  [/\b(microsoft|azure|vscode)\b/i, ["Microsoft", "微软"]],
  [/\b(google|deepmind|gemini)\b/i, ["Google", "谷歌", "DeepMind"]],
  [/\b(openai|chatgpt|codex)\b/i, ["OpenAI", "ChatGPT", "Codex"]],
  [/\b(anthropic|claude)\b/i, ["Anthropic", "Claude"]],
  [/\b(moonshot|kimi)\b/i, ["Moonshot", "月之暗面", "Kimi"]],
  [/\b(deepseek)\b/i, ["DeepSeek", "深度求索"]],
  [/\b(huggingface|hugging[-\s]?face)\b/i, ["Hugging Face", "抱抱脸"]],
  [/\b(meta|facebook)\b/i, ["Meta", "Facebook"]],
];

const DIRECTION_SEARCH_ALIASES: Array<[RegExp, string[]]> = [
  [/\bshopping-commerce-agent\b|\b(e-?commerce|commerce|shopping|shopify|tiktok-shop|taobao|pinduoduo|jd)\b/i, ["电商", "导购", "购物", "商品", "商城", "比价", "商家经营"]],
  [/\bfinance-investment-research-agent\b|\b(finance|investment|trading|stock|quant)\b/i, ["股票", "投研", "金融", "量化", "交易"]],
  [/\bcustomer-support-agent\b|\b(customer-support|helpdesk|service-desk)\b/i, ["客服", "服务台", "工单"]],
  [/\bsales-prospecting-agent\b|\b(sales|prospecting|lead)\b/i, ["销售", "拓客", "线索"]],
  [/\bmarketing-content-ops-agent\b|\b(marketing|content|growth)\b/i, ["营销", "内容运营", "增长"]],
];

function uniqueProjectSearchStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

export function companySearchAliases(values: Array<string | null | undefined>): string[] {
  const haystack = values.map((value) => String(value ?? "")).join(" ");
  const aliases: string[] = [];
  for (const [pattern, candidates] of COMPANY_SEARCH_ALIASES) {
    if (pattern.test(haystack)) aliases.push(...candidates);
  }
  return uniqueProjectSearchStrings(aliases);
}

export function directionSearchAliases(values: Array<string | null | undefined>): string[] {
  const haystack = values.map((value) => String(value ?? "")).join(" ");
  const aliases: string[] = [];
  for (const [pattern, candidates] of DIRECTION_SEARCH_ALIASES) {
    if (pattern.test(haystack)) aliases.push(...candidates);
  }
  return uniqueProjectSearchStrings(aliases);
}

export function buildDirectionAliasSummary(): string {
  return DIRECTION_SEARCH_ALIASES.map(([, aliases]) => aliases.join(", ")).join(" | ");
}

function projectIntroduction(project: ProjectsViewModel["projects"][number], lang: ProjectSearchLang): string {
  if (lang === "en") {
    return project.project.description || project.project_brief_cn || "A project worth continued tracking.";
  }
  return project.project_brief_cn || project.appearance_explanation_cn || project.project.description || "暂无摘要。";
}

function projectSelectionReason(project: ProjectsViewModel["projects"][number], lang: ProjectSearchLang): string {
  if (lang === "en") {
    return project.why_today_cn || `Radar score ${project.score.total_score}; worth continued tracking.`;
  }
  return project.why_today_cn || project.appearance_explanation_cn || "暂无研判原因。";
}

function projectGrowthValue(project: ProjectsViewModel["projects"][number]): number {
  return Number(project.project.star_delta_daily ?? 0);
}

function projectParadigmFamily(paradigm: string): string {
  const normalized = paradigm.toLowerCase();
  if (normalized.includes("agent")) return "Agent System";
  if (normalized.includes("runtime")) return "Runtime";
  return "Tool";
}

export function buildProjectSearchText(project: ProjectsViewModel["projects"][number], lang: ProjectSearchLang): string {
  const repoOwner = project.project.repo_full_name.split("/")[0] ?? "";
  return [
    project.project.repo_full_name,
    project.project.project_name,
    repoOwner,
    project.project.repo_url,
    project.project.description,
    projectIntroduction(project, lang),
    projectSelectionReason(project, lang),
    project.appearance_explanation_cn,
    project.project_brief_cn,
    project.why_today_cn,
    project.position_rationale_cn,
    project.exposure_bucket,
    project.score.paradigm,
    project.project.persistence_state,
    ...project.project.tags,
    ...project.project.sources,
    ...project.project.raw_signals.flatMap((signal) => [signal.project_name, signal.repo_url, signal.description ?? "", signal.source, ...signal.tags]),
    ...project.matched_interest_topics,
    ...(project.direction_matches ?? []),
    ...companySearchAliases([
      project.project.repo_full_name,
      project.project.project_name,
      repoOwner,
      project.project.description,
      project.project_brief_cn,
      project.why_today_cn,
      ...project.project.tags,
    ]),
    ...directionSearchAliases([
      project.project.repo_full_name,
      project.project.project_name,
      project.project.description,
      project.project_brief_cn,
      project.why_today_cn,
      ...project.project.tags,
      ...project.matched_interest_topics,
      ...(project.direction_matches ?? []),
      ...project.project.raw_signals.flatMap((signal) => [signal.description ?? "", ...signal.tags]),
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function buildProjectSearchRecords(projects: ProjectsViewModel["projects"], lang: ProjectSearchLang): ProjectSearchRecord[] {
  return projects.map((project, index) => ({
    projectId: project.project.repo_full_name,
    project,
    searchName: [project.project.repo_full_name, project.project.project_name].filter(Boolean).join(" "),
    searchDescription: projectIntroduction(project, lang),
    searchMeta: buildProjectSearchText(project, lang),
    score: Number(project.score.total_score ?? project.final_rank ?? 0),
    growth: projectGrowthValue(project),
    order: index,
    paradigm: projectParadigmFamily(project.score.paradigm),
    persistence: project.project.persistence_state,
  }));
}

export function buildSearchFieldsSummary(): string {
  return [
    "name: repo full name and project name",
    "description: project brief and repository description",
    "tags: project tags, source tags, direction matches, interest topics",
    "direction: mission direction keys and Chinese aliases",
    "reason: why_today, appearance explanation, position rationale",
    "metadata: repo owner, source names, exposure bucket, persistence, paradigm",
  ].join("\n");
}
