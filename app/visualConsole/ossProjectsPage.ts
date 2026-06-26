import fs from "node:fs";
import path from "node:path";
import { buildProjectSearchText } from "../../src/search/projectSearchIndex.ts";
import type { ScoredProject } from "../../src/types.ts";
import { readCachedJsonFile } from "../../src/visualConsole/fileCache.ts";
import type { ProjectsViewModel } from "../../src/visualConsole/types.ts";
import { copy } from "./ossCopy.ts";
import { slugify, toViewHref } from "./ossRouting.ts";
import type { UiLang, UiTheme } from "./ossTypes.ts";
import { escapeHtml, renderDockSurface } from "./renderShared.ts";
import { renderProjectsRoute } from "./renderProjects.ts";

type ProjectsLocalDetailPayload = {
  route: "projects-local-details";
  baseHref: string;
  selectedProjectName: string | null;
  entries: Array<{
    projectName: string;
    href: string;
    detailHtml: string;
  }>;
};

const PROJECT_SEARCH_FALLBACK_SUGGESTIONS = ["claw", "memory", "skill", "openai sdk"];
const SEARCH_EXAMPLE_TERMS = ["claw", "memory agent", "openai sdk"];
const PROJECT_BUCKET_ORDER = ["today_pulse", "mission_match", "explore_ribbon", "historical_context"] as const;
type ProjectBucketKey = (typeof PROJECT_BUCKET_ORDER)[number];

function uiText(lang: UiLang, zh: string, en: string): string {
  return lang === "zh" ? zh : en;
}

function preserveScrollAttr(value = "detail"): string {
  return ` data-preserve-scroll="${value}"`;
}

function formatProjectMetricValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function containsChineseText(value: string | null | undefined): boolean {
  return /[\u3400-\u9fff]/.test(String(value ?? ""));
}

function firstChineseText(...values: Array<string | null | undefined>): string | null {
  return values.find((value) => containsChineseText(value)) ?? null;
}

function localizedProjectFallbackIntro(project: ProjectsViewModel["projects"][number]): string {
  const directionValues = [
    ...(project.direction_matches ?? []),
    ...(project.matched_interest_topics ?? []),
    ...project.project.tags,
    project.project.description,
    project.project.repo_full_name,
  ].join(" ");
  const name = project.project.repo_full_name || project.project.project_name;

  if (/\bfinance-investment-research-agent\b|\b(finance|financial|investment|investing|trading|stock|stocks|a-stock|us-stock|quant|portfolio|market)\b/i.test(directionValues)) {
    return `${name} 是一个金融投研/股票分析相关项目，适合继续观察其数据接入、分析流程和自动化能力。`;
  }
  if (/\bresearch-knowledge-agent\b|\b(research|knowledge|rag|retrieval|literature|paper|papers|notebook|citation|scientific|science|academic)\b/i.test(directionValues)) {
    return `${name} 是一个科研与知识工作相关项目，适合继续观察其文献处理、检索和研究辅助能力。`;
  }
  if (/\bworkflow-automation-agent\b|\b(productivity|workflow|automation|office|email|meeting|calendar|document|spreadsheet|excel|slides|presentation|operations)\b/i.test(directionValues)) {
    return `${name} 是一个办公提效与工作流自动化相关项目，适合继续观察其文档、协作和流程执行能力。`;
  }
  if (/\bshopping-commerce-agent\b|\b(e-?commerce|commerce|shopping|shopify|taobao|pinduoduo|jd)\b/i.test(directionValues)) {
    return `${name} 是一个电商与导购场景相关项目，适合继续观察其商品、交易和商家经营支持能力。`;
  }

  return `${name} 是一个值得继续跟踪的 AI 项目，当前可从仓库活跃度、应用场景和后续迭代中判断价值。`;
}

function projectIntroduction(project: ProjectsViewModel["projects"][number], lang: UiLang): string {
  if (lang === "en") {
    return project.project.description || project.project_brief_cn || "A project worth continued tracking.";
  }
  return firstChineseText(project.project_brief_cn, project.appearance_explanation_cn, project.why_today_cn) ?? localizedProjectFallbackIntro(project);
}

function projectSelectionReason(project: ProjectsViewModel["projects"][number], lang: UiLang): string {
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

function localizePersistence(value: string, lang: UiLang): string {
  if (lang === "zh") {
    if (value === "emerging") return "新兴";
    if (value === "persistent") return "持续";
    if (value === "single-spike") return "单次脉冲";
  }
  if (value === "emerging") return "Emerging";
  if (value === "persistent") return "Persistent";
  if (value === "single-spike") return "Single Spike";
  return value;
}

function localizeConfidence(value: string, lang: UiLang): string {
  if (lang !== "zh") return value;
  if (value === "high") return "高";
  if (value === "medium") return "中";
  if (value === "low") return "低";
  return value;
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
  [/\bfinance-investment-research-agent\b|\b(finance|financial|investment|investing|trading|stock|stocks|a-stock|us-stock|quant|portfolio|market)\b/i, ["股票", "投研", "金融", "量化", "交易"]],
  [/\bresearch-knowledge-agent\b|\b(research|knowledge|rag|retrieval|literature|paper|papers|notebook|citation|scientific|science|academic|document research)\b/i, ["科研", "研究", "知识工作", "文献", "论文", "检索", "知识库"]],
  [/\bworkflow-automation-agent\b|\b(productivity|workflow|automation|office|email|meeting|calendar|schedule|document|documents|spreadsheet|excel|slides|presentation|backoffice|operations)\b/i, ["办公提效", "效率", "自动化", "工作流", "邮件", "会议", "日历", "文档", "表格", "幻灯片"]],
  [/\bcustomer-support-agent\b|\b(customer-support|helpdesk|service-desk)\b/i, ["客服", "服务台", "工单"]],
  [/\bsales-prospecting-agent\b|\b(sales|prospecting|lead)\b/i, ["销售", "拓客", "线索"]],
  [/\bmarketing-content-ops-agent\b|\b(marketing|content|growth)\b/i, ["营销", "内容运营", "增长"]],
];

const DIRECTION_KEYWORD_ALIASES = new Map<string, string[]>([
  ["shopping-commerce-agent", ["电商", "导购", "购物", "商品", "商城", "比价", "商家经营"]],
  ["finance-investment-research-agent", ["股票", "投研", "金融", "量化", "交易"]],
  ["research-knowledge-agent", ["科研", "研究", "知识工作", "文献", "论文", "检索", "知识库"]],
  ["workflow-automation-agent", ["办公提效", "效率", "自动化", "工作流", "邮件", "会议", "日历", "文档", "表格", "幻灯片"]],
  ["customer-support-agent", ["客服", "服务台", "工单"]],
  ["sales-prospecting-agent", ["销售", "拓客", "线索"]],
  ["marketing-content-ops-agent", ["营销", "内容运营", "增长"]],
]);

function uniqueProjectSearchStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function companySearchAliases(values: Array<string | null | undefined>): string[] {
  const haystack = values.map((value) => String(value ?? "")).join(" ");
  const aliases: string[] = [];
  for (const [pattern, candidates] of COMPANY_SEARCH_ALIASES) {
    if (pattern.test(haystack)) aliases.push(...candidates);
  }
  return uniqueProjectSearchStrings(aliases);
}

function directionSearchAliases(values: Array<string | null | undefined>): string[] {
  const haystack = values.map((value) => String(value ?? "")).join(" ");
  const aliases: string[] = [];
  for (const [pattern, candidates] of DIRECTION_SEARCH_ALIASES) {
    if (pattern.test(haystack)) aliases.push(...candidates);
  }
  return uniqueProjectSearchStrings(aliases);
}

function directionKeyAliases(values: Array<string | null | undefined>): string[] {
  const aliases: string[] = [];
  values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .forEach((value) => {
      DIRECTION_KEYWORD_ALIASES.get(value)?.forEach((alias) => aliases.push(alias));
    });
  return uniqueProjectSearchStrings(aliases);
}

function normalizeSearchSuggestionTerm(value: string): string {
  return value.trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ");
}

function collectSearchSuggestionTerm(
  accumulator: Map<string, { score: number; sources: Set<string> }>,
  value: string,
  sourceKey: string,
  weight: number,
): void {
  const normalized = normalizeSearchSuggestionTerm(value);
  if (!normalized || normalized.length < 3) return;
  if (/^(agent|project|projects|repo|repository|github|tool|tools|system|systems)$/.test(normalized)) return;
  const current = accumulator.get(normalized) ?? { score: 0, sources: new Set<string>() };
  current.score += weight;
  current.sources.add(sourceKey);
  accumulator.set(normalized, current);
}

function collectSearchSuggestionsFromText(
  accumulator: Map<string, { score: number; sources: Set<string> }>,
  value: string,
  sourceKey: string,
  weight: number,
): void {
  const normalized = normalizeSearchSuggestionTerm(value);
  if (!normalized) return;

  const words = normalized
    .split(/[^a-z0-9.+#-]+/i)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);
  for (const word of words) {
    collectSearchSuggestionTerm(accumulator, word, sourceKey, weight);
  }

  const phraseTokens = normalized.split(/\s+/).filter((token) => token.length >= 2);
  for (let index = 0; index < phraseTokens.length - 1; index += 1) {
    const phrase = `${phraseTokens[index]} ${phraseTokens[index + 1]}`;
    if (phrase.length >= 6) {
      collectSearchSuggestionTerm(accumulator, phrase, sourceKey, weight * 0.9);
    }
  }
}

function finalizeSearchSuggestions(
  accumulator: Map<string, { score: number; sources: Set<string> }>,
  fallback: string[],
): string[] {
  const stableTerms = Array.from(accumulator.entries())
    .filter(([, stats]) => stats.sources.size >= 2 || stats.score >= 5)
    .sort((left, right) => {
      const [, leftStats] = left;
      const [, rightStats] = right;
      if (rightStats.sources.size !== leftStats.sources.size) return rightStats.sources.size - leftStats.sources.size;
      if (rightStats.score !== leftStats.score) return rightStats.score - leftStats.score;
      return left[0].localeCompare(right[0]);
    })
    .map(([term]) => term);

  return Array.from(new Set([...stableTerms, ...fallback.map((term) => normalizeSearchSuggestionTerm(term))])).slice(0, 6);
}

function deriveProjectSearchSuggestions(projects: ProjectsViewModel["projects"]): string[] {
  const ranked = new Map<string, { score: number; sources: Set<string> }>();

  projects.forEach((project) => {
    const sourceKey = project.project.repo_full_name.toLowerCase();
    project.project.tags.forEach((tag) => collectSearchSuggestionTerm(ranked, tag, sourceKey, 3));
    project.matched_interest_topics.forEach((topic) => collectSearchSuggestionTerm(ranked, topic.replace(/-/g, " "), sourceKey, 2.5));
    collectSearchSuggestionsFromText(ranked, project.project.repo_full_name, sourceKey, 1.5);
    collectSearchSuggestionsFromText(ranked, project.project.description ?? "", sourceKey, 1.4);
    collectSearchSuggestionsFromText(ranked, projectSelectionReason(project, "en"), sourceKey, 1.2);
    companySearchAliases([project.project.repo_full_name, project.project.project_name, project.project.description, ...project.project.tags]).forEach((alias) =>
      collectSearchSuggestionTerm(ranked, alias, sourceKey, 2.2),
    );
  });

  return finalizeSearchSuggestions(ranked, PROJECT_SEARCH_FALLBACK_SUGGESTIONS);
}

function projectBucketKey(project: ProjectsViewModel["projects"][number]): ProjectBucketKey {
  if (project.exposure_bucket === "today_pulse") return "today_pulse";
  if (project.exposure_bucket === "mission_match") return "mission_match";
  if (project.exposure_bucket === "explore_ribbon") return "explore_ribbon";
  return "historical_context";
}

function projectBucketLabel(bucket: ProjectBucketKey, lang: UiLang): string {
  switch (bucket) {
    case "today_pulse":
      return uiText(lang, "今日全局脉冲", "Today Pulse");
    case "mission_match":
      return uiText(lang, "与你当前任务更相关", "Mission Match");
    case "explore_ribbon":
      return uiText(lang, "探索补位带", "Explore Ribbon");
    case "historical_context":
      return uiText(lang, "历史补充观察", "Historical Context");
  }
}

function projectBucketDescription(bucket: ProjectBucketKey, lang: UiLang): string {
  switch (bucket) {
    case "today_pulse":
      return uiText(lang, "全局热度与新鲜度最高的一层，保留主视角。", "The global surface with the strongest freshness and shared momentum.");
    case "mission_match":
      return uiText(lang, "和当前任务、方向覆盖或兴趣命中更贴近的项目。", "Projects that line up more directly with the current task and direction coverage.");
    case "explore_ribbon":
      return uiText(lang, "当任务命中不足时，用来补充新鲜探索，不伪装成正式命中。", "Fresh exploration capacity that never pretends to be a formal mission hit.");
    case "historical_context":
      return uiText(lang, "保留上下文、连续性和复盘价值的补充样本。", "Backfill context preserved for continuity, comparison, and later review.");
  }
}

function renderProjectsBucketDeck(model: ProjectsViewModel, lang: UiLang): string {
  const counts: Record<ProjectBucketKey, number> = {
    today_pulse: model.today_pulse_projects.length,
    mission_match: model.mission_match_projects.length,
    explore_ribbon: model.explore_ribbon_projects.length,
    historical_context: model.historical_context_projects.length,
  };
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return `
    <div class="projects-bucket-deck" data-project-bucket-deck="true">
      ${PROJECT_BUCKET_ORDER.map((bucket, index) => {
        const count = counts[bucket];
        const share = total > 0 ? Math.max(4, Math.round((count / total) * 100)) : 0;
        return `
        <article class="projects-bucket-card projects-bucket-card-${escapeHtml(bucket)}" data-project-bucket-card="${escapeHtml(bucket)}" style="--bucket-share: ${escapeHtml(String(share))}%">
          <div class="projects-bucket-card-head">
            <span class="projects-bucket-index">${escapeHtml(String(index + 1).padStart(2, "0"))}</span>
            <span class="projects-bucket-label">${escapeHtml(projectBucketLabel(bucket, lang))}</span>
          </div>
          <div class="projects-bucket-value-row">
            <strong>${escapeHtml(String(count))}</strong>
            <span>${escapeHtml(uiText(lang, "项目", "items"))}</span>
          </div>
          <div class="projects-bucket-meter" aria-hidden="true"><span></span></div>
          <p>${escapeHtml(projectBucketDescription(bucket, lang))}</p>
        </article>
      `;
      }).join("")}
    </div>
  `;
}

function removeLeafQuery(requestUrl: URL, key: string): string {
  const next = new URL(requestUrl.toString());
  next.searchParams.delete(key);
  return `${next.pathname}${next.search}`;
}

function section(title: string, body: string): string {
  return `<section class="panel"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function dockSection(key: string, title: string, body: string): string {
  return `<section class="panel" data-dock-section="${escapeHtml(key)}"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function scoresPathForDate(date: string): string {
  return path.join(process.cwd(), "data", "scores", `${date}.json`);
}

function readScoresForDate(date: string | null | undefined): ScoredProject[] | null {
  if (!date || date === "latest") return null;
  const target = scoresPathForDate(date);
  if (!fs.existsSync(target)) return null;
  try {
    return readCachedJsonFile<ScoredProject[]>(target);
  } catch {
    return null;
  }
}

function buildSparklinePoints(project: ProjectsViewModel["projects"][number]): number[] | null {
  const dates = project.project.appearance_dates.slice(-7);
  if (dates.length < 2) return null;

  const points: number[] = [];
  for (const date of dates) {
    const scores = readScoresForDate(date);
    if (!scores) return null;
    const match = scores.find((entry) => entry.project.repo_full_name.toLowerCase() === project.project.repo_full_name.toLowerCase());
    if (!match) return null;
    points.push(Number(match.score.total_score));
  }

  return points.length >= 2 ? points : null;
}

function renderSparkline(project: ProjectsViewModel["projects"][number], lang: UiLang): string {
  const points = buildSparklinePoints(project);
  if (!points) return "";

  const width = 72;
  const height = 20;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pathData = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * (width - 2) + 1;
      const y = height - (((point - min) / span) * (height - 4) + 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return `
    <span class="micro-sparkline" data-sparkline="true" aria-label="${escapeHtml(uiText(lang, "趋势轨迹", "Trend Momentum"))}">
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true">
        <path d="${pathData}" fill="none" stroke="var(--accent-amber)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
      <span class="micro-caption">${escapeHtml(uiText(lang, "趋势轨迹", "Trend Momentum"))}</span>
    </span>
  `;
}

function renderProjectsSearchShell(searchSuggestions: string[], lang: UiLang, initialQuery = ""): string {
  const suggestionTerms = searchSuggestions.length > 0 ? searchSuggestions : PROJECT_SEARCH_FALLBACK_SUGGESTIONS;
  void suggestionTerms;
  const safeInitialQuery = initialQuery.trim().slice(0, 200);
  return `
    <div class="projects-search-block">
      <div class="projects-search-shell">
        <span class="projects-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
          </svg>
        </span>
        <label class="sr-only" for="projects-search-input">${escapeHtml(uiText(lang, "搜索项目", "Search Projects"))}</label>
        <input
          id="projects-search-input"
          type="search"
          data-projects-search="true"
          placeholder="${escapeHtml(uiText(lang, "搜索项目、仓库、公司名或方向词", "Search projects, repos, companies, or directions"))}"
          value="${escapeHtml(safeInitialQuery)}"
          autocomplete="off"
        />
        <div class="sort-wrapper projects-sort-dropdown" data-projects-sort-dropdown="true">
          <span class="sort-label projects-sort-dropdown-prefix">${escapeHtml(uiText(lang, "排序", "Sort"))}</span>
          <div class="sort-control projects-sort-value-area">
            <button type="button" class="sort-trigger projects-sort-dropdown-button" data-projects-sort-toggle="true" aria-haspopup="listbox" aria-expanded="false">
              <span class="projects-sort-dropdown-current" data-projects-sort-current="true">${escapeHtml(uiText(lang, "按雷达评分", "Sort By Score"))}</span>
              <span class="projects-sort-dropdown-caret" aria-hidden="true">▾</span>
            </button>
            <div class="sort-menu projects-sort-dropdown-menu" data-projects-sort-menu="true" role="listbox" aria-label="${escapeHtml(uiText(lang, "排序方式", "Sort Mode"))}" hidden>
              <button type="button" class="projects-sort-dropdown-option is-active" data-projects-sort-value="score" role="option" aria-selected="true">${escapeHtml(uiText(lang, "按雷达评分", "Sort By Score"))}</button>
              <button type="button" class="projects-sort-dropdown-option" data-projects-sort-value="growth" role="option" aria-selected="false">${escapeHtml(uiText(lang, "按增速插值", "Sort By Growth"))}</button>
            </div>
          </div>
        </div>
      </div>
      <div class="projects-search-helper" data-projects-search-helper="true">
        <div class="filter-chip-row">
          ${SEARCH_EXAMPLE_TERMS.map((term) => `<button type="button" class="filter-chip projects-hot-search-chip" data-projects-search-example="${escapeHtml(term)}"><span aria-hidden="true">🔥</span>${escapeHtml(term)}</button>`).join("")}
        </div>
      </div>
    </div>
  `;
}

export function renderProjectsAssistantShell(lang: UiLang): string {
  const quickQueries = [
    uiText(lang, "浏览器智能体", "Browser agents"),
    uiText(lang, "金融投研 Agent", "Research agents"),
    uiText(lang, "客服自动化", "Support automation"),
    uiText(lang, "Agent IDE", "Agent IDE"),
  ];
  return `
    <div
      data-projects-ai-assistant-host="true"
      class="projects-ai-assistant-host"
    >
      <button
        type="button"
        class="button-link projects-ai-launch"
        data-projects-ai-launch="true"
        aria-label="${escapeHtml(uiText(lang, "打开 AI 搜项目", "Open AI Project Search"))}"
      >
        <span class="projects-ai-launch-avatar" aria-hidden="true">
          <img class="projects-ai-launch-image" src="/app-assets/projects-ai-avatar.png?v=2" alt="" />
        </span>
      </button>
      <section
        class="surface-card projects-ai-panel"
        data-projects-ai-panel="true"
        hidden
        aria-label="${escapeHtml(uiText(lang, "AI 搜项目", "AI Project Search"))}"
      >
        <div class="projects-ai-panel-head">
          <div>
            <strong>${escapeHtml(uiText(lang, "AI 搜项目", "AI Project Search"))}</strong>
            <span class="projects-ai-panel-copy">${escapeHtml(uiText(lang, "站内项目库", "Local library"))}</span>
          </div>
          <div class="projects-ai-panel-actions">
            <button type="button" class="projects-ai-icon-button" data-projects-ai-new-chat="true" aria-label="${escapeHtml(uiText(lang, "新对话", "New Chat"))}" title="${escapeHtml(uiText(lang, "新对话", "New Chat"))}">+</button>
            <button type="button" class="projects-ai-icon-button" data-projects-ai-close="true" aria-label="${escapeHtml(uiText(lang, "关闭", "Close"))}" title="${escapeHtml(uiText(lang, "关闭", "Close"))}">&times;</button>
          </div>
        </div>
        <div class="projects-ai-quickstart" data-projects-ai-quickstart="true">
          <p class="meta-line projects-ai-quickstart-copy">${escapeHtml(uiText(lang, "先给一个方向，我返回 3 条线索；需要展开再进入项目库承接。", "Start with a direction and I will return three leads."))}</p>
          <div class="projects-ai-quickstart-grid">
            ${quickQueries
              .map(
                (query) => `
                  <button
                    type="button"
                    class="projects-ai-quickstart-card"
                    data-projects-ai-option-query="${escapeHtml(query)}"
                  >${escapeHtml(query)}</button>
                `,
              )
              .join("")}
          </div>
        </div>
        <div class="projects-ai-quickstart-toggle-row" data-projects-ai-quickstart-toggle-row="true" hidden>
          <button type="button" class="button-link-secondary projects-ai-quickstart-toggle" data-projects-ai-quickstart-toggle="true">${escapeHtml(uiText(lang, "推荐方向", "Suggestions"))}</button>
        </div>
        <div data-projects-ai-messages="true" class="projects-ai-messages"></div>
        <div data-projects-ai-status="true" class="meta-line projects-ai-status" hidden></div>
        <form data-projects-ai-form="true" class="projects-ai-form">
          <label class="sr-only" for="projects-ai-search-input">${escapeHtml(uiText(lang, "AI 搜项目输入框", "AI Project Search Input"))}</label>
          <input
            id="projects-ai-search-input"
            type="search"
            data-projects-ai-input="true"
            class="projects-ai-input"
            placeholder="${escapeHtml(uiText(lang, "例如：找自动化投研、Agent IDE、浏览器智能体", "Try: agent IDE, browser agents, research automation"))}"
            autocomplete="off"
          />
          <div class="projects-ai-form-row">
            <span class="meta-line projects-ai-form-copy">${escapeHtml(uiText(lang, "输入“更多”继续", "Type more to continue"))}</span>
            <button type="submit" class="button-link projects-ai-submit" data-projects-ai-submit="true">${escapeHtml(uiText(lang, "发送", "Send"))}</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderProjectsFilterStripV3(projects: ProjectsViewModel["projects"], lang: UiLang, initialQuery = ""): string {
  const paradigms = ["Agent System", "Runtime", "Tool"];
  const persistenceStates = Array.from(new Set(projects.map((project) => project.project.persistence_state)));
  const searchSuggestions = deriveProjectSearchSuggestions(projects);

  return `
    <section class="projects-filter-strip projects-command-deck" aria-label="${escapeHtml(uiText(lang, "项目过滤", "Project Filters"))}" data-projects-workbench="true" data-projects-page-size="15">
      <div class="projects-command-row">
        ${renderProjectsSearchShell(searchSuggestions, lang, initialQuery)}
      </div>
      <div class="projects-filter-groups">
        <div class="filter-group">
          <span class="context-label">${escapeHtml(uiText(lang, "技术范式", "Paradigm"))}</span>
          <div class="filter-chip-row">
            <button type="button" class="filter-chip is-active" data-projects-paradigm-option="all" aria-pressed="true">${escapeHtml(uiText(lang, "全部", "All"))}</button>
            ${paradigms.map((paradigm) => `<button type="button" class="filter-chip" data-projects-paradigm-option="${escapeHtml(paradigm)}" aria-pressed="false">${escapeHtml(paradigm)}</button>`).join("")}
          </div>
        </div>
        <div class="filter-group">
          <span class="context-label">${escapeHtml(uiText(lang, "持续评级", "Persistence"))}</span>
          <div class="filter-chip-row">
            <button type="button" class="filter-chip is-active" data-projects-persistence-option="all" aria-pressed="true">${escapeHtml(uiText(lang, "全部", "All"))}</button>
            ${persistenceStates.map((state) => `<button type="button" class="filter-chip" data-projects-persistence-option="${escapeHtml(state)}" aria-pressed="false">${escapeHtml(localizePersistence(state, lang))}</button>`).join("")}
          </div>
        </div>
      </div>
      <div class="projects-extension-note">
        <span class="context-label">${escapeHtml(uiText(lang, "AI 搜索入口", "AI Search Entry"))}</span>
        <p>${escapeHtml(uiText(lang, "主搜索框只做关键词过滤；自然语言搜索请从右下角的 AI 搜项目 进入。", "The main search box now stays keyword-only; use AI Project Search for natural-language lookups."))}</p>
      </div>
    </section>
  `;
}

function renderProjectsPaginationControls(totalCount: number, lang: UiLang, position: "top" | "bottom"): string {
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const statusText = totalCount === 0 ? "0 / 0" : `1 / ${pageCount}`;
  const summaryText = totalCount === 0 ? "0-0 / 0" : `1-${Math.min(pageSize, totalCount)} / ${totalCount}`;

  return `
    <div class="projects-pagination-shell projects-pagination-shell-${escapeHtml(position)}" data-projects-pagination="${escapeHtml(position)}">
      <div class="projects-pagination-copy">
        <span class="projects-page-summary" data-projects-page-summary="true">${escapeHtml(summaryText)}</span>
      </div>
      <div class="projects-pagination-controls" aria-label="${escapeHtml(uiText(lang, "项目分页", "Project Pagination"))}">
        <button type="button" class="projects-page-button" data-projects-page-prev="true" aria-disabled="true" disabled>${escapeHtml(uiText(lang, "上一页", "Previous"))}</button>
        <span class="projects-page-status" data-projects-page-status="true">${escapeHtml(statusText)}</span>
        <button type="button" class="projects-page-button" data-projects-page-next="true" aria-disabled="${pageCount > 1 ? "false" : "true"}"${pageCount > 1 ? "" : " disabled"}>${escapeHtml(uiText(lang, "下一页", "Next"))}</button>
      </div>
    </div>
  `;
}

function projectRouteHref(model: ProjectsViewModel, project: ProjectsViewModel["projects"][number], requestUrl: URL, lang: UiLang): string {
  return toViewHref("projects", lang, resolveTheme(requestUrl), {
    date: model.context.selected_date,
    project: project.project.repo_full_name,
    source_view: "projects",
  });
}

function renderProjectsListV3(projects: ProjectsViewModel["projects"], model: ProjectsViewModel, requestUrl: URL, lang: UiLang): string {
  const ui = copy(lang);
  if (projects.length === 0) {
    return `<p class="empty-copy">${escapeHtml(ui.none)}</p>`;
  }

  const selectedKey = model.selected_project?.project.project.repo_full_name.toLowerCase() ?? null;

  return `
    <div class="projects-scan-lane" data-projects-lane="true">
      ${projects
        .map((project, index) => {
          const href = projectRouteHref(model, project, requestUrl, lang);
          const paradigmFamily = projectParadigmFamily(project.score.paradigm);
          const persistenceLabel = localizePersistence(project.project.persistence_state, lang);
          const growthValue = projectGrowthValue(project);
          const starValue = formatProjectMetricValue(Number(project.project.stars ?? 0));
          const scoreValue = Number(project.score.total_score);
          const isSelected = selectedKey === project.project.repo_full_name.toLowerCase();

          return `
            <article
              class="project-row research-card projects-scan-row projects-scan-card${isSelected ? " is-selected" : ""}"
              data-project-card="true"
              data-project-name="${escapeHtml(project.project.repo_full_name)}"
              data-project-search="${escapeHtml(buildProjectSearchText(project, lang))}"
              data-project-paradigm="${escapeHtml(paradigmFamily)}"
              data-project-persistence="${escapeHtml(project.project.persistence_state)}"
              data-project-score="${escapeHtml(String(scoreValue))}"
              data-project-growth="${escapeHtml(String(growthValue))}"
              data-project-order="${escapeHtml(String(index))}"
              data-project-bucket="${escapeHtml(projectBucketKey(project))}"
            >
              <div class="card-head projects-scan-card-head">
                <div class="projects-scan-card-title-block">
                  <h3>
                    <a href="${escapeHtml(href)}" data-evidence-anchor-link="row-to-dock" data-project-card-link="true"${preserveScrollAttr()}>${escapeHtml(project.project.repo_full_name)}</a>
                    ${isSelected ? '<span class="projects-pulse-dot" aria-hidden="true"></span>' : ""}
                  </h3>
                </div>
                <span class="projects-score-badge projects-star-badge">
                  <span class="projects-star-badge-icon" aria-hidden="true">★</span>
                  <span>${escapeHtml(starValue)}</span>
                </span>
              </div>
              <p class="project-row-brief">${escapeHtml(projectIntroduction(project, lang))}</p>
              <div class="projects-chip-strip">
                <span class="projects-chip">${escapeHtml(persistenceLabel)}</span>
                <span class="projects-chip is-growth">
                  <span>+${escapeHtml(formatProjectMetricValue(growthValue))} stars</span>
                  <span class="projects-growth-arrow" aria-hidden="true">↑</span>
                </span>
              </div>
              <div class="projects-side-sparkline">
                ${renderSparkline(project, lang)}
                <a class="projects-scan-link" href="${escapeHtml(href)}" data-project-card-link="true"${preserveScrollAttr()}>
                  <span>${escapeHtml(uiText(lang, "探测下钻", "Drill Down"))}</span>
                  <span aria-hidden="true">›</span>
                </a>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
    <div class="projects-empty-state" data-projects-empty="true" hidden>
      <p class="empty-copy">${escapeHtml(uiText(lang, "当前没有匹配的项目，请调整过滤条件。", "No projects match the active scan filters."))}</p>
      <button type="button" class="button-link" data-projects-ai-empty-cta="true">${escapeHtml(uiText(lang, "打开 AI 搜项目", "Open AI Project Search"))}</button>
    </div>
  `;
}

function renderProjectSignalIndex(detail: ProjectsViewModel["selected_project"], lang: UiLang): string {
  const ui = copy(lang);
  if (!detail) return "";

  const project = detail.project;
  const dailyGrowth = projectGrowthValue(project);
  const weeklyGrowth = Number(project.project.star_delta_weekly ?? 0);
  const evidenceCount = project.score.components.reduce((total, component) => total + component.evidence.length, 0);
  const sources = Object.entries(project.project.source_counts)
    .filter(([, count]) => Number(count) > 0)
    .map(([source, count]) => `${source}: ${count}`)
    .join(" | ") || ui.none;

  return `
    <div class="projects-signal-grid">
      <article class="projects-signal-card">
        <span class="context-label">${escapeHtml(ui.confidence)}</span>
        <strong>${escapeHtml(localizeConfidence(project.score.confidence, lang))}</strong>
        <p>${escapeHtml(uiText(lang, "以评分置信度和字段完整度共同校验。", "Validated by score confidence and artifact completeness."))}</p>
      </article>
      <article class="projects-signal-card">
        <span class="context-label">${escapeHtml(uiText(lang, "增长差值", "Growth Delta"))}</span>
        <strong>+${escapeHtml(formatProjectMetricValue(dailyGrowth))}</strong>
        <p>${escapeHtml(uiText(lang, `日增 ${formatProjectMetricValue(dailyGrowth)} / 周增 ${formatProjectMetricValue(weeklyGrowth)}`, `Daily ${formatProjectMetricValue(dailyGrowth)} / Weekly ${formatProjectMetricValue(weeklyGrowth)}`))}</p>
      </article>
      <article class="projects-signal-card">
        <span class="context-label">${escapeHtml(uiText(lang, "证据密度", "Evidence Density"))}</span>
        <strong>${escapeHtml(String(evidenceCount))}</strong>
        <p>${escapeHtml(uiText(lang, "按评分组件和证据片段累计。", "Counted from score components and evidence fragments."))}</p>
      </article>
      <article class="projects-signal-card">
        <span class="context-label">${escapeHtml(uiText(lang, "信号来源", "Signal Sources"))}</span>
        <strong>${escapeHtml(String(project.project.sources.length))}</strong>
        <p>${escapeHtml(sources)}</p>
      </article>
    </div>
  `;
}

function projectAssessmentTrace(project: ProjectsViewModel["projects"][number], lang: UiLang): string {
  const rawTrace =
    project.position_rationale_cn ??
    project.risk_review_note_cn ??
    project.score.risks[0] ??
    project.score.components.flatMap((component) => component.evidence).find(Boolean) ??
    project.why_today_cn ??
    copy(lang).none;
  return rawTrace || copy(lang).none;
}

function renderProjectDetailV4(detail: ProjectsViewModel["selected_project"], requestUrl: URL, lang: UiLang): string {
  const ui = copy(lang);
  if (!detail) return "";

  const closeHref = removeLeafQuery(requestUrl, "project");
  const slug = detail.kb_preview ? slugify(detail.kb_preview.project_name) : null;
  const kbHref = toViewHref("kb", lang, resolveTheme(requestUrl), {
    slug,
    source_view: detail.binding.source_view,
    date: detail.binding.date,
    anchor: detail.binding.window_end,
    trend_key: detail.binding.trend_key,
    project: detail.project.project.repo_full_name,
  });
  const scoreValue = Number(detail.project.score.total_score);
  const paradigmFamily = projectParadigmFamily(detail.project.score.paradigm);
  const leadEvidence = detail.project.score.components.map((item) => item.evidence[0]).find(Boolean) ?? ui.none;
  const historySummary = uiText(
    lang,
    `首次捕获于 ${detail.project.project.first_seen || ui.none} 的 agents-radar 节点；在随后的七天内累计有 ${detail.project.project.appearances} 次触发 Trendshift 实时增幅警报；当前已被 ${detail.project.project.sources.length} 个核心来源持续收录。`,
    `First captured on ${detail.project.project.first_seen || ui.none} in the agents-radar lane; it then triggered ${detail.project.project.appearances} cumulative Trendshift growth alerts across the following window, and is still carried by ${detail.project.project.sources.length} core sources.`,
  );

  return `
    <div class="detail-surface-card projects-dossier-shell projects-dossier-shell-v4">
      <div class="projects-dossier-orbit" aria-hidden="true"></div>
      <div class="detail-head projects-dossier-head" data-detail-head="true">
        <div class="projects-dossier-title-block">
          <p class="eyebrow">${escapeHtml(uiText(lang, "研判档案舱", "DOSSIER MODULE"))}</p>
          <h2>${escapeHtml(detail.project.project.repo_full_name)}</h2>
        </div>
        <a class="close-link projects-dossier-close" href="${escapeHtml(closeHref)}"${preserveScrollAttr()} aria-label="${escapeHtml(ui.close)}"><span aria-hidden="true">&times;</span></a>
      </div>
      <div class="projects-stage-meta projects-dossier-verified-bar">
        <span class="projects-stage-verified">${escapeHtml(uiText(lang, "已校验", "Verified"))}</span>
      </div>
      <section class="projects-dossier-linkbar">
        <div class="projects-dossier-linkcopy">
          <span class="projects-github-glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.59 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.49-1.11-1.49-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.55 2.34 1.1 2.91.84.09-.66.35-1.1.64-1.36-2.22-.26-4.56-1.15-4.56-5.12 0-1.13.39-2.05 1.03-2.77-.11-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.06A9.3 9.3 0 0 1 12 6.94c.85 0 1.7.12 2.5.36 1.9-1.33 2.75-1.06 2.75-1.06.54 1.42.2 2.47.1 2.73.64.72 1.02 1.64 1.02 2.77 0 3.98-2.34 4.86-4.57 5.11.36.31.68.93.68 1.88 0 1.36-.01 2.46-.01 2.79 0 .27.18.59.69.48A10.27 10.27 0 0 0 22 12.26C22 6.59 17.52 2 12 2Z"/>
            </svg>
          </span>
          <a href="${escapeHtml(detail.project.project.repo_url)}" target="_blank" rel="noreferrer">${escapeHtml(detail.project.project.repo_url)}</a>
        </div>
        <div class="projects-dossier-linkactions">
          <a class="button-link" href="${escapeHtml(detail.project.project.repo_url)}" target="_blank" rel="noreferrer">${escapeHtml(uiText(lang, "访问仓库", "Visit Repository"))}</a>
        </div>
      </section>
      <section class="projects-dossier-overview">
        <div class="projects-score-ring-shell" style="--project-score:${escapeHtml(String(scoreValue))}">
          <div class="projects-score-ring">
            <div class="projects-score-ring-core">
              <strong>${escapeHtml(formatProjectMetricValue(scoreValue))}</strong>
              <span>${escapeHtml(ui.score)}</span>
            </div>
          </div>
        </div>
        <div class="projects-dossier-kpis">
          <article class="projects-kpi-card"><span class="context-label">${escapeHtml(ui.paradigm)}</span><strong>${escapeHtml(paradigmFamily)}</strong></article>
          <article class="projects-kpi-card"><span class="context-label">${escapeHtml(ui.persistence)}</span><strong>${escapeHtml(localizePersistence(detail.project.project.persistence_state, lang))}</strong></article>
        </div>
      </section>
      ${dockSection("architecture", uiText(lang, "项目架构描述", "Architecture Overview"), `<div class="projects-detail-copy"><p>${escapeHtml(projectIntroduction(detail.project, lang))}</p></div>`)}
      ${dockSection("evidence", uiText(lang, "校验分数与评估证据", "Score and Evidence"), `<div class="projects-evidence-summary"><span class="projects-evidence-pill">${escapeHtml(uiText(lang, "证据已校验", "Evidence verified"))}</span><p>${escapeHtml(leadEvidence)}</p><p>${escapeHtml(projectSelectionReason(detail.project, lang))}</p><p><strong>${escapeHtml(uiText(lang, "研判证据", "Assessment Trace"))}:</strong> ${escapeHtml(projectAssessmentTrace(detail.project, lang))}</p></div>`)}
      ${dockSection("history", uiText(lang, "持续性与历史出现记录", "Persistence and History"), `<div class="projects-history-inline"><span class="projects-history-badge">${escapeHtml(uiText(lang, `累计捕获 ${detail.project.project.appearances} 次`, `${detail.project.project.appearances} Captures`))}</span><p>${escapeHtml(historySummary)}</p></div>`)}
      ${dockSection("signal-index", uiText(lang, "持续性信号指数", "Persistence Signal Index"), renderProjectSignalIndex(detail, lang))}
      ${dockSection(
        "kb-preview",
        ui.kbPreview,
        detail.kb_preview
          ? `<p>${escapeHtml(detail.kb_preview.project_name)}</p><p class="meta-line">${escapeHtml(uiText(lang, "更新时间", "Updated At"))}: ${escapeHtml(String(detail.kb_preview.updated_at ?? ui.none))}</p><a class="button-link" href="${escapeHtml(kbHref)}"${preserveScrollAttr()}>${escapeHtml(uiText(lang, "打开知识归档", "Open Knowledge Archive"))}</a>`
          : `<p>${escapeHtml(uiText(lang, "当前没有可展示的知识卡。", "No knowledge card is available yet."))}</p>`,
      )}
      <div class="projects-dossier-actions">
        <div class="projects-dossier-action-row">
          <a class="button-link button-link-secondary" href="${escapeHtml(closeHref)}"${preserveScrollAttr()}>${escapeHtml(uiText(lang, "返回列表", "Back To List"))}</a>
          <a class="button-link" href="${escapeHtml(detail.project.project.repo_url)}" target="_blank" rel="noreferrer">${escapeHtml(uiText(lang, "访问项目仓库", "Visit Repository"))}</a>
        </div>
      </div>
    </div>
  `;
}

function renderProjectsHeroStage(lang: UiLang): string {
  return `
    <section class="projects-hero-stage" aria-label="${escapeHtml(uiText(lang, "项目英雄区", "Projects Hero"))}">
      <div class="projects-hero-pill">
        <strong class="projects-hero-pill-primary">${escapeHtml(uiText(lang, "项目列表", "High Fidelity Scan Deck"))}</strong>
        <span class="projects-hero-pill-separator" aria-hidden="true">&bull;</span>
        <span class="projects-hero-pill-copy">${escapeHtml(uiText(lang, "看详情不打断浏览", "Multi-Angle Drilldown"))}</span>
        <span class="projects-hero-pill-separator" aria-hidden="true">&bull;</span>
        <span class="projects-hero-pill-copy">${escapeHtml(uiText(lang, "当前数据已同步", "Live Verification Active"))}</span>
      </div>
      <h1>${escapeHtml(uiText(lang, "项目库", "Project Library"))}</h1>
      <p>${escapeHtml(uiText(lang, "这里会把今天值得关注的项目整理在一起，方便你快速判断先看哪个。", "This page groups together the projects worth your attention today, so you can quickly decide what to read first."))}</p>
    </section>
  `;
}

function resolveTheme(requestUrl: URL): UiTheme {
  return requestUrl.searchParams.get("theme") === "dark" ? "dark" : "light";
}

export function buildProjectsLocalDetailPayload(model: ProjectsViewModel, requestUrl: URL, lang: UiLang): ProjectsLocalDetailPayload {
  const baseHref = toViewHref("projects", lang, resolveTheme(requestUrl), {
    date: model.context.selected_date,
    source_view: "projects",
  });

  return {
    route: "projects-local-details",
    baseHref,
    selectedProjectName: model.selected_project?.project.project.repo_full_name ?? null,
    entries: model.projects.map((project) => {
      const href = projectRouteHref(model, project, requestUrl, lang);
      const detailView: ProjectsViewModel["selected_project"] = {
        project,
        binding: {
          source_view: "projects",
          date: model.context.selected_date ?? "latest",
          window_end: null,
          trend_key: null,
        },
        kb_preview: null,
        kb_missing: true,
      };
      const detailHtml = renderDockSurface("projects-dossier-dock", renderProjectDetailV4(detailView, new URL(href, "http://localhost"), lang), {
        ariaLabel: uiText(lang, "详情面板", "Detail Surface"),
        detailKey: project.project.repo_full_name,
      });

      return {
        projectName: project.project.repo_full_name,
        href,
        detailHtml,
      };
    }),
  };
}

export function renderProjectsWorkbenchPage(model: ProjectsViewModel, requestUrl: URL, lang: UiLang, _theme: UiTheme): string {
  const ui = copy(lang);
  const hasDetail = Boolean(model.selected_project || requestUrl.searchParams.get("project"));
  const initialQuery = requestUrl.searchParams.get("q") || "";
  const dockHtml = hasDetail
    ? renderDockSurface("projects-dossier-dock", renderProjectDetailV4(model.selected_project, requestUrl, lang), {
        ariaLabel: uiText(lang, "详情面板", "Detail Surface"),
        detailKey: model.selected_project?.project.project.repo_full_name ?? requestUrl.searchParams.get("project") ?? "project-detail",
      })
    : "";

  return (
    renderProjectsRoute({
    heroHtml: renderProjectsHeroStage(lang),
    hasDetail,
    filterHtml: renderProjectsFilterStripV3(model.projects, lang, initialQuery),
    stageTopHtml: `
      <div class="section-head weekly-matrix-shell-head projects-stage-head projects-stage-head-pagination-only">
        <div class="projects-stage-meta">
          <span class="projects-stage-count-label">${escapeHtml(uiText(lang, "共找到", "Found"))} <span data-projects-count="true">${escapeHtml(String(model.projects.length))}</span> ${escapeHtml(uiText(lang, "条结果", "results"))}</span>
          ${renderProjectsPaginationControls(model.projects.length, lang, "top")}
        </div>
      </div>
      <div class="status-banner" data-projects-ai-main-result="true" hidden>
        <div class="status-banner-head">
          <span class="context-label">${escapeHtml(uiText(lang, "AI 助手结果", "AI Assistant Results"))}</span>
          <strong data-projects-ai-main-result-query="true"></strong>
        </div>
        <p>${escapeHtml(uiText(lang, "主列表当前只显示本轮 AI 搜项目 返回的项目。", "The main list is showing only the projects returned by the latest AI search."))}</p>
        <div class="filter-chip-row">
          <button type="button" class="filter-chip" data-projects-ai-reset="true">${escapeHtml(uiText(lang, "返回普通项目库", "Back To Default Library"))}</button>
        </div>
      </div>
      ${renderProjectsBucketDeck(model, lang)}
    `,
    rowsHtml: renderProjectsListV3(model.projects, model, requestUrl, lang),
    stageBottomHtml: renderProjectsPaginationControls(model.projects.length, lang, "bottom"),
    dockHtml,
    emptyDockHtml: "",
    })
  );
}
