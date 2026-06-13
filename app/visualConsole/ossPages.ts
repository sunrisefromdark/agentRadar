import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DailyExposureProject, DirectionCoverageStatus, DirectionGapLedgerEntry, KnowledgeCard } from "../../src/types.ts";
import { buildProjectsView } from "../../src/visualConsole/build.ts";
import type { KnowledgeBaseViewModel, ObserverViewModel, OverviewViewModel, ProjectsViewModel, RunHealthViewModel, WeeklyViewModel } from "../../src/visualConsole/types.ts";
import App, { type AppProps as OverviewReactAppProps } from "../client/App.tsx";
import ObserverView, { type ObserverViewProps } from "../client/ObserverView.tsx";
import RunHealthView, { type RunHealthViewProps } from "../client/RunHealth.tsx";
import WeeklyView, { buildWeeklyMatrixAxes, type WeeklyViewProps } from "../client/WeeklyView.tsx";
import { ScoreEvidencePanel } from "../components/ScoreEvidencePanel.tsx";
import { copy } from "./ossCopy.ts";
import { renderProjectsWorkbenchPage } from "./ossProjectsPage.ts";
import { formatCompactDateTime, renderStatusPill, summarizeStateTone } from "./ossDocument.ts";
import { slugify, toViewHref } from "./ossRouting.ts";
import type { RenderedRoute, UiLang, UiTheme } from "./ossTypes.ts";
import { renderKnowledgeBaseRoute } from "./renderKnowledgeBase.ts";
import { renderOverviewRoute } from "./renderOverview.ts";
import { renderProjectsRoute } from "./renderProjects.ts";
import { renderRunHealthRoute } from "./renderRunHealth.ts";
import { escapeHtml, renderDockSurface, renderRailSurface, renderRouteFrame, renderSurfaceSection } from "./renderShared.ts";
import { renderWeeklyRoute } from "./renderWeekly.ts";

const PROJECT_REPO_HREF = "https://github.com/sunrisefromdark/agentRadar";
const OBSERVER_SEARCH_FALLBACK_SUGGESTIONS = ["claw", "memory agent", "openai sdk"];

function uiText(lang: UiLang, zh: string, en: string): string {
  return lang === "zh" ? zh : en;
}

export function renderPrimary(rendered: RenderedRoute, requestUrl: URL, lang: UiLang, theme: UiTheme): string {
  const routeHtml = (() => {
    switch (rendered.route) {
      case "overview":
        return renderOverviewPage(rendered.model, requestUrl, lang, theme);
      case "projects":
        return renderProjectsWorkbenchPage(rendered.model, requestUrl, lang, theme);
      case "weekly":
        return renderWeeklyPage(rendered.model, requestUrl, lang, theme);
      case "run-health":
        return renderRunHealthPage(rendered.model, lang);
      case "observer":
        return renderObserverPage(rendered.model, requestUrl, lang, theme);
      case "kb":
        return renderKnowledgeBasePage(rendered.model, requestUrl, lang, theme);
    }
  })();

  return renderRouteFrame(rendered.model.route_frame, `<div class="surface-route-wrap">${routeHtml}</div>`);
}

const OVERVIEW_WORKSPACE_SECTIONS = ["signals", "decisions", "watchlist", "sources"] as const;
type OverviewWorkspaceSection = (typeof OVERVIEW_WORKSPACE_SECTIONS)[number];

function resolveOverviewWorkspaceSection(requestUrl: URL): OverviewWorkspaceSection {
  const value = requestUrl.searchParams.get("section");
  return OVERVIEW_WORKSPACE_SECTIONS.includes(value as OverviewWorkspaceSection) ? (value as OverviewWorkspaceSection) : "decisions";
}

function overviewProjectIntro(project: DailyExposureProject | ProjectsViewModel["projects"][number]): string {
  return project.project_brief_cn || project.appearance_explanation_cn || project.why_today_cn || project.project.description || "none";
}

function overviewProjectReason(project: DailyExposureProject | ProjectsViewModel["projects"][number]): string {
  return project.why_today_cn || project.appearance_explanation_cn || project.project_brief_cn || "none";
}

function buildOverviewTrendPath(score: number, index: number): string {
  const ceiling = Math.max(2, 18 - Math.min(14, Math.round(score / 8)));
  const midA = Math.max(2, ceiling + ((index % 3) - 1) * 2);
  const midB = Math.max(2, ceiling - (index % 2 === 0 ? 3 : -2));
  return `M1 18 L12.7 18 L24.3 ${midA} L36 ${midB} L47.7 ${ceiling} L59.3 ${Math.max(2, ceiling - 1)} L71 ${Math.max(2, ceiling - 2)}`;
}

function buildBadgeHtml(label: string, tone: "neutral" | "accent" | "sage" = "neutral"): string {
  return `<span class="badge badge-${tone}">${escapeHtml(label)}</span>`;
}

function buildSparklineSvgHtml(path: string): string {
  return `<svg class="w-14 h-4" viewBox="0 0 72 20" fill="none"><path d="${escapeHtml(path)}" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
}

function projectBoardValue(project: ProjectsViewModel["projects"][number]): string {
  const value = (project as unknown as Record<string, unknown>)["project_class"];
  return typeof value === "string" && value.length > 0 ? value : "today_star";
}

function projectBoardLabel(board: string, lang: UiLang): string {
  if (board === "today_star") return uiText(lang, "主榜", "Main Board");
  if (board === "context_only") return uiText(lang, "上下文", "Context Only");
  if (board === "pending_confirmation") return uiText(lang, "待确认", "Pending Confirmation");
  return board;
}

function buildMetaPairsHtml(items: Array<{ label: string; value: string }>): string {
  return `
    <div class="meta-pairs">
      ${items.map((item) => `
        <span class="meta-pair meta-pair-neutral">
          <span class="meta-label">${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </span>
      `).join("")}
    </div>
  `;
}

function mapRunHealthStatusToVerdict(status: string): "PASS" | "WARN" | "FAIL" {
  switch (status) {
    case "ready":
      return "PASS";
    case "failed":
      return "FAIL";
    default:
      return "WARN";
  }
}

function readableText(value: string | null | undefined, fallback: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return fallback;
  if (/\u951f/.test(trimmed)) return fallback;
  const garbleHits = (trimmed.match(/[�]/g) ?? []).length;
  if (garbleHits >= 2) return fallback;
  return trimmed;
}

function updateUrlSearch(requestUrl: URL, updates: Record<string, string | null | undefined>): string {
  const next = new URL(requestUrl.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value) next.searchParams.set(key, value);
    else next.searchParams.delete(key);
  }
  return `${next.pathname}${next.search}`;
}

function observerEntryKey(repoFullName: string): string {
  return repoFullName.trim().toLowerCase();
}

function uniqueObserverStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
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
  if (/^(agent|project|projects|github|open source|watch|candidate|observer|tool|tools)$/.test(normalized)) return;
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

function buildObserverTrendPathFromScores(observerScore: number, baseScore: number, stars: number, appearances: number): string {
  const start = 18;
  const second = Math.max(11, 18 - Math.min(6, Math.round(baseScore / 18)));
  const third = Math.max(7, 18 - Math.min(9, Math.round(observerScore / 12)));
  const fourth = Math.max(4, third - Math.min(3, Math.round(Math.log10(Math.max(stars, 1)))));
  const fifth = Math.max(2, fourth - Math.min(2, Math.max(0, appearances - 1)));
  return `M1 ${start} L18 ${second} L36 ${third} L54 ${fourth} L71 ${fifth}`;
}

const OBSERVER_SEARCH_EXAMPLES = ["claw", "memory agent", "openai sdk"];

function deriveObserverSearchSuggestions(entries: ObserverViewProps["entries"]): string[] {
  const ranked = new Map<string, { score: number; sources: Set<string> }>();

  for (const entry of entries) {
    const sourceKey = entry.repoFullName.toLowerCase();
    entry.keywords.forEach((value) => collectSearchSuggestionTerm(ranked, value, sourceKey, 3));
    entry.topics.forEach((value) => collectSearchSuggestionTerm(ranked, value, sourceKey, 2.5));
    entry.labels.forEach((value) => collectSearchSuggestionTerm(ranked, value, sourceKey, 2));
    entry.ecosystems.forEach((value) => collectSearchSuggestionTerm(ranked, value.replace(/-/g, " "), sourceKey, 1.8));
    collectSearchSuggestionsFromText(ranked, entry.repoFullName, sourceKey, 1.4);
    collectSearchSuggestionsFromText(ranked, entry.whyItMatters, sourceKey, 0.9);
    collectSearchSuggestionsFromText(ranked, entry.whyNow, sourceKey, 0.8);
  }

  return finalizeSearchSuggestions(ranked, OBSERVER_SEARCH_FALLBACK_SUGGESTIONS);
}

function formatObserverJudgeDelta(value: number | null | undefined): string {
  const delta = value ?? 0;
  return `${delta >= 0 ? "+" : ""}${delta}`;
}

function mapWeeklyAxisSummary(summary: string | null | undefined, lang: UiLang): string {
  return readableText(summary, lang === "zh" ? "证据矩阵摘要待补充。" : "Evidence summary is pending.");
}

function localizeFieldValue(value: string | null | undefined, _lang: UiLang): string {
  return String(value ?? "").trim();
}

function localizePersistence(value: string, lang: UiLang): string {
  const normalized = value.trim().toLowerCase();
  if (lang === "zh") {
    if (normalized === "emerging") return "新兴";
    if (normalized === "persistent") return "持续";
    if (normalized === "single-pulse") return "单次脉冲";
  }
  return value;
}

function isMissingDescription(description: string | null | undefined, projectName: string, paradigm: string): boolean {
  const normalized = String(description ?? "").trim();
  if (!normalized) return true;
  const lower = normalized.toLowerCase();
  if (lower === projectName.toLowerCase()) return true;
  if (lower.includes("no description") || lower.includes("暂无描述") || lower.includes("description unavailable")) return true;
  if (normalized.length < 24) return true;
  return !paradigm.trim();
}

function observerHaystackFromProject(project: ProjectsViewModel["projects"][number]): string {
  return [
    project.project.project_name,
    project.project.repo_full_name,
    project.project.description,
    project.project_brief_cn,
    project.why_today_cn,
    project.position_rationale_cn,
    project.score.paradigm,
    ...project.project.tags,
    ...project.project.sources,
    ...project.matched_interest_topics,
    ...(project.direction_matches ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function deriveSupplementObserverEcosystems(project: ProjectsViewModel["projects"][number]): string[] {
  const haystack = observerHaystackFromProject(project);
  const ecosystems: string[] = [];

  if (/(agent|coding|claude code|codex|cursor|aider|code review)/.test(haystack)) ecosystems.push("coding-agents");
  if (/(runtime|orchestration|workflow|execution|sandbox|agent runtime)/.test(haystack)) ecosystems.push("agent-runtime");
  if (/(mcp|skill|skills|plugin|tool-use|connector)/.test(haystack)) ecosystems.push("skills-tools-mcp");
  if (/(memory|knowledge|rag|retrieval|context|vector)/.test(haystack)) ecosystems.push("memory-knowledge");
  if (/(eval|guardrail|observability|telemetry|review|policy|trace)/.test(haystack)) ecosystems.push("eval-observability-governance");
  if (/(browser|computer use|desktop|playwright|operator ui|viewer|console)/.test(haystack)) ecosystems.push("browser-computer-use");
  if (/(multi-agent|swarm|team)/.test(haystack)) ecosystems.push("multi-agent-coordination");
  if (/(reinforcement learning|agentic rl|reward model|policy optimization|trl)/.test(haystack)) ecosystems.push("agentic-rl");

  return uniqueObserverStrings(ecosystems).slice(0, 3);
}

function deriveSupplementObserverReason(project: ProjectsViewModel["projects"][number]): string {
  if (project.project.tags.some((tag) => tag.startsWith("watchlist:"))) return "priority-company";
  if (project.project.sources.includes("github_trending") || project.project.sources.includes("github_live_star_delta")) return "breakout-newcomer";
  return "ecosystem-signal";
}

function deriveSupplementObserverTier(project: ProjectsViewModel["projects"][number]): string {
  if (project.project.tags.includes("watchlist-hit") || project.project.stars >= 1000) return "proven";
  if (project.project.appearances >= 3 || project.project.sources.length >= 2) return "watch";
  return "none";
}

function deriveSupplementObserverHistory(project: ProjectsViewModel["projects"][number]): string {
  if (project.project.appearances >= 5) return "validated";
  if (project.project.appearances >= 3) return "mixed";
  if (project.project.appearances >= 2) return "emerging";
  return "none";
}

function deriveSupplementObserverFreshness(project: ProjectsViewModel["projects"][number]): string {
  if (project.project.tags.includes("fresh-today")) return "active-today";
  if (project.project.sources.includes("watchlist_live_activity") || project.project.sources.includes("github_live_star_delta")) return "active-week";
  if (project.project.sources.includes("trendshift") || project.project.sources.includes("github_trending")) return "active-window";
  return "context-window";
}

function deriveSupplementObserverQualification(project: ProjectsViewModel["projects"][number]): string {
  if (project.final_rank >= 86 && project.project.sources.length >= 2) return "strong-watch";
  return "keep-observing";
}

function buildSupplementObserverEntries(
  selectedDate: string | null,
  lang: UiLang,
  theme: UiTheme,
  existingKeys: Set<string>,
): ObserverViewProps["entries"] {
  if (!selectedDate) return [];

  return buildProjectsView(selectedDate).projects
    .filter((project) => project.project_class === "context_only" || project.exposure_bucket === "explore_ribbon")
    .filter((project) => !existingKeys.has(observerEntryKey(project.project.repo_full_name)))
    .map((project) => {
      const ecosystems = deriveSupplementObserverEcosystems(project);
      const attentionReason = deriveSupplementObserverReason(project);
      const hostLevel = deriveSupplementObserverTier(project);
      const historyHit = deriveSupplementObserverHistory(project);
      const freshnessTag = deriveSupplementObserverFreshness(project);
      const qualification = deriveSupplementObserverQualification(project);
      const repoOwner = project.project.repo_full_name.split("/")[0]?.trim() ?? "";
      const orgSeeds = uniqueObserverStrings(
        project.project.tags.filter((tag) => tag.startsWith("watchlist:")).map((tag) => tag.replace("watchlist:", "")),
      );
      const repoSeeds = uniqueObserverStrings(
        project.project.raw_signals
          .map((signal) => signal.repo_url.replace(/^https?:\/\/github\.com\//i, ""))
          .filter((value) => value.toLowerCase() !== project.project.repo_full_name.toLowerCase()),
      ).slice(0, 4);
      const keywords = uniqueObserverStrings(
        project.project.tags.filter((tag) => !tag.includes(":") && !tag.startsWith("watchlist") && tag.length <= 24),
      ).slice(0, 6);
      const labels = uniqueObserverStrings([
        `freshness:${freshnessTag}`,
        `tier:${hostLevel}`,
        `history:${historyHit}`,
        `class:${project.project_class}`,
        ...ecosystems.map((ecosystem) => `ecosystem:${ecosystem}`),
      ]).slice(0, 8);

      return {
        key: observerEntryKey(project.project.repo_full_name),
        repoFullName: project.project.repo_full_name,
        projectHref: toViewHref("projects", lang, theme, {
          date: selectedDate,
          project: project.project.repo_full_name,
          source_view: "observer",
        }),
        repoUrl: project.project.repo_url,
        isTracked: false,
        radarScore: Math.round(project.final_rank),
        baseObserverScore: Math.round(project.base_final_rank),
        trendPath: buildObserverTrendPathFromScores(
          Math.round(project.final_rank),
          Math.round(project.base_final_rank),
          project.project.stars ?? 0,
          project.project.appearances ?? 0,
        ),
        stars: project.project.stars ?? 0,
        forks: project.project.forks ?? 0,
        issues: project.project.issues ?? 0,
        prs: project.project.PR ?? 0,
        attentionReason,
        freshnessTag,
        hostLevel,
        historyHit,
        qualification,
        observedAt: formatCompactDateTime(project.project.last_seen),
        summarySource: project.summary_source ?? project.enhancement_source ?? "template_fallback",
        judgeSource: project.judge_source ?? "rules-only",
        judgeDelta: `${(project.judge_score_delta ?? 0) >= 0 ? "+" : ""}${project.judge_score_delta ?? 0}`,
        whyItMatters: readableText(
          overviewProjectIntro(project),
          lang === "zh" ? "暂无摘要。" : "This candidate is still under observation while the supporting summary is being consolidated.",
        ),
        whyNow: readableText(
          overviewProjectReason(project),
          lang === "zh" ? "当前 why-now 证据还不够充分，所以先留在待观察项目里继续跟踪。" : "The latest why-now evidence is still being consolidated, so this project remains in the long-tail watch pool for now.",
        ),
        verdict: readableText(
          project.position_rationale_cn,
          lang === "zh" ? "当前仍需更多跨源确认与持续活跃度信号，暂不进入主榜升级通道。" : "This candidate still needs more cross-source confirmation and sustained activity.",
        ),
        recommendation: readableText(
          localizeFieldValue(project.watchlist_note_cn ?? project.score.next_actions[0], lang),
          lang === "zh" ? "继续观察 README 更新频率、版本节奏、跨源命中与社区反馈变化。" : "Keep monitoring README updates, release cadence, cross-source hits, and community response.",
        ),
        ecosystems,
        labels,
        pedigreeTokens: uniqueObserverStrings([
          ...orgSeeds.map((seed) => `company:${seed}`),
          hostLevel !== "none" ? `tier:${hostLevel}` : null,
        ]),
        keywords,
        topics: uniqueObserverStrings(project.matched_interest_topics ?? []).slice(0, 4),
        repoSeeds,
        orgSeeds,
        searchOrganizations: uniqueObserverStrings([repoOwner, ...orgSeeds]),
        searchText: observerHaystackFromProject(project),
      };
    });
}

function buildRunHealthReactPropsLegacy(model: RunHealthViewModel, lang: UiLang): RunHealthViewProps {
  const ui = copy(lang);
  const summary = model.run_snapshot?.run_summary;
  const verifyResult = model.run_snapshot?.verify_result;
  const sourceStatus = summary?.source_status ?? [];
  const quality = summary?.quality;
  const verdictStatus = mapRunHealthStatusToVerdict(model.state.status);
  const failureNotes = [
    ...(summary?.mission_degraded_reason_codes ?? []),
    ...(model.banner.notes ?? []),
  ].filter(Boolean);

  return {
    lang,
    pageTitle: uiText(lang, "数据状态", "Run Health"),
    pageSummary: uiText(
      lang,
      "先确认这一轮产物是否健康，再看哪些项目还需要补证、哪些数据源正在降级。", "Check whether this run is healthy first, then inspect which projects still need evidence and which sources are degraded.",
    ),
    verdictEyebrow: uiText(lang, "运行结论", "Run Verdict"),
    verdictTitle: summary?.mission_discovery_status ?? model.banner.source_health ?? model.state.status,
    verdictStatus,
    verdictSummary: model.banner.notes[0] ?? model.banner.source_health ?? ui.none,
    verifiedAtLabel: uiText(lang, "产物时间", "Generated At"),
    verifiedAt: formatCompactDateTime(model.banner.generated_at),
    priorityLabel: uiText(lang, "优先动作", "Priority Actions"),
    priorityTitle: uiText(lang, "先处理这些缺口", "Fix These Gaps First"),
    priorityActions: verifyResult?.recommended_actions?.slice(0, 4) ?? failureNotes.slice(0, 4),
    telemetryLabel: uiText(lang, "关键遥测", "Telemetry"),
    telemetryTitle: uiText(lang, "哪些地方最需要复核", "What Needs Review Most"),
    lowConfidenceHeading: uiText(lang, "低置信度项目", "Low-Confidence Projects"),
    lowConfidenceBody: uiText(
      lang,
      "这些项目当前缺少足够的交叉来源或语义支撑，消费优先级应当下调。", "These projects still lack enough cross-source or semantic support and should be consumed more cautiously.",
    ),
    lowConfidenceCount: quality?.low_confidence_projects ?? 0,
    totalProjects:
      sourceStatus.reduce((sum, item) => sum + item.item_count, 0) +
        (quality?.medium_confidence_projects ?? 0) +
        (quality?.insufficient_metrics_projects ?? 0) >
      0
        ? sourceStatus.reduce((sum, item) => sum + item.item_count, 0)
        : 0,
    lowConfidenceProjects: [],
    singleSourceHeading: uiText(lang, "单一来源项目", "Single-Source Projects"),
    singleSourceBody: uiText(
      lang,
      "这些项目仍旧只由单一信号源支撑，需要跨源或跨天确认。", "These projects are still backed by a single signal source and need cross-source or next-day confirmation.",
    ),
    singleSourceCount: quality?.single_source_projects ?? 0,
    singleSourcePreview: [],
    singleSourceAll: [],
    singleSourceFootnote: "",
    missingDescriptionHeading: uiText(lang, "描述缺失项目", "Missing Description Projects"),
    missingDescriptionBody: uiText(
      lang,
      "描述缺失会降低语义判断质量，也会影响后续趋势聚类与推荐。", "Missing descriptions degrade semantic judgment and weaken downstream clustering and recommendation quality.",
    ),
    missingDescriptionCount: quality?.missing_descriptions ?? 0,
    missingDescriptions: [],
    validationLabel: uiText(lang, "校验状态", "Validation"),
    validationStatus: verifyResult?.status ?? ui.none,
    validationDescription:
      verifyResult?.recommended_actions?.[0] ?? model.banner.notes[0] ?? model.banner.source_health ?? ui.none,
    pipelinesTitle: uiText(lang, "数据源管线", "Source Pipelines"),
    activeNodesLabel: uiText(lang, "活跃节点", "Active Nodes"),
    pipelines: sourceStatus.map((item) => ({
      key: item.source,
      label: item.source,
      docs: item.item_count,
      distinctProjects: item.item_count,
      enabledLabel: item.enabled ? uiText(lang, "已启用", "Enabled") : uiText(lang, "未启用", "Disabled"),
      statusLabel: item.status,
      notes: item.notes.join(" | ") || ui.none,
      active: item.status === "active",
    })),
    verifySectionTitle: uiText(lang, "校验明细", "Verification Checks"),
    verifyChecks: (verifyResult?.checks ?? []).map((check) => ({
      key: check.name,
      name: check.name,
      statusLabel: check.status,
      detail: check.detail,
    })),
    failureNotesTitle: uiText(lang, "失败与降级说明", "Failure And Degradation Notes"),
    failureNotes,
    initialTelemetry: null,
    compatibilitySummaryTitle: uiText(lang, "运行概览", "Run Summary"),
    compatibilitySourceTitle: uiText(lang, "来源状态表", "Source Status"),
    compatibilityAuditTitle: uiText(lang, "覆盖与缺口", "Coverage And Gaps"),
    compatibilityVerifyTitle: uiText(lang, "校验结果", "Verification"),
    compatibilityActionTitle: uiText(lang, "建议动作", "Recommended Actions"),
    sourceTableRows: sourceStatus.map((item) => ({
      source: item.source,
      enabledLabel: item.enabled ? uiText(lang, "是", "Yes") : uiText(lang, "否", "No"),
      countLabel: String(item.item_count),
      distinctProjectsLabel: String(item.item_count),
      statusLabel: item.status,
      notes: item.notes.join(" | ") || ui.none,
    })),
    auditRows: [],
  };
}

export function buildRunHealthReactProps(model: RunHealthViewModel, lang: UiLang): RunHealthViewProps {
  const ui = copy(lang);
  const snapshot = model.run_snapshot;
  const summary = snapshot?.run_summary;
  const verifyResult = snapshot?.verify_result;
  const sourceStatus = summary?.source_status ?? [];
  const allProjects = snapshot?.daily_report.all_projects ?? [];
  const quality = summary?.quality;
  const verdictStatus = mapRunHealthStatusToVerdict(model.state.status);
  const verifyStatus = verifyResult?.status ?? (model.state.status === "ready" ? "pass" : model.state.status === "degraded" || model.state.status === "stale" ? "warn" : "fail");
  const verifyChecks = verifyResult?.checks ?? [];
  const failureNotes = [
    ...(summary?.mission_degraded_reason_codes ?? []),
    ...(model.banner.notes ?? []),
  ].filter(Boolean).map((item) => readableText(localizeFieldValue(item, lang), ui.none));
  const totalProjects = allProjects.length || summary?.counts.scored_projects || 0;
  const snapshotDate = verifyResult?.date ?? summary?.date ?? model.context.selected_date ?? "latest";
  const uniqueRecommendedActions = [
    ...new Set([...(summary?.recommended_actions ?? []), ...(verifyResult?.recommended_actions ?? [])]),
  ].map((item) => readableText(localizeFieldValue(item, lang), lang === "zh" ? "保持当前稳定基线，继续监控。" : "Keep the current stable baseline and continue monitoring."));
  const overallStatusText = readableText(
    localizeFieldValue(snapshot?.daily_report.overall_daily_status ?? model.banner.source_health, lang),
    lang === "zh" ? "当前数据状态结论仍在等待完整校验。" : "The overall run-health verdict is still waiting for full verification.",
  );
  const humanVerifyStatus =
    lang === "zh"
      ? verifyStatus === "pass"
        ? "通过"
        : verifyStatus === "warn"
          ? "警告"
          : "失败"
      : verifyStatus.toUpperCase();
  const projectChannel = (project: (typeof allProjects)[number]): string => {
    return project.project.sources[0] ?? project.project.raw_signals[0]?.source ?? "manual";
  };
  const confidenceLabel = (confidence: string): string => {
    if (lang === "zh") {
      if (confidence === "high") return "高置信";
      if (confidence === "medium") return "中置信";
      if (confidence === "low") return "低置信";
    }
    return confidence.toUpperCase();
  };
  const lowConfidenceProjects = allProjects
    .filter((project) => project.score.confidence === "low" || project.project.data_trust === "low")
    .sort((left, right) => Number(left.score.total_score) - Number(right.score.total_score))
    .map((project) => ({
      key: project.project.repo_full_name,
      name: project.project.repo_full_name,
      channel: projectChannel(project),
      scoreLabel: lang === "zh" ? `评分 ${Math.round(Number(project.score.total_score))} / 100` : `Score ${Math.round(Number(project.score.total_score))} / 100`,
      confidenceLabel: confidenceLabel(project.score.confidence),
      reason: readableText(
        localizeFieldValue(project.score.risks[0] ?? project.project.trust_flags[0] ?? project.score.anti_noise_flags[0] ?? project.project.description, lang),
        lang === "zh" ? "该项目目前缺少足够的交叉来源与语义支撑，系统已自动降低其消费优先级。" : "This node lacks enough cross-source and semantic support, so the system automatically reduced its consumption priority.",
      ),
      note: lang === "zh" ? "自动限制其在主榜前列的曝光权重" : "Exposure weight is automatically capped before the main board.",
    }));
  const singleSourceProjects = allProjects
    .filter((project) => new Set(project.project.sources).size <= 1)
    .sort((left, right) => Number(right.score.total_score) - Number(left.score.total_score))
    .map((project) => ({
      key: project.project.repo_full_name,
      name: project.project.repo_full_name,
      channel: projectChannel(project),
      scoreLabel: lang === "zh" ? `评分 ${Math.round(Number(project.score.total_score))} / 100` : `Score ${Math.round(Number(project.score.total_score))} / 100`,
      confidenceLabel: confidenceLabel(project.score.confidence),
      reason: readableText(
        localizeFieldValue(project.score.risks[0] ?? project.project.description, lang),
        lang === "zh" ? "当前仍只由单一信号源支撑，需要等待跨源印证。" : "The project is still backed by one source only and needs cross-source confirmation.",
      ),
      note: lang === "zh"
        ? `等待次日时序判定，当前持久性为 ${readableText(localizePersistence(project.project.persistence_state, lang), "持续观察")}`
        : `Awaiting next-day persistence judgment. Current persistence: ${readableText(localizePersistence(project.project.persistence_state, lang), "watch")}.`,
    }));
  const missingDescriptionProjects = allProjects
    .filter((project) => isMissingDescription(project.project.description, project.project.project_name, project.score.paradigm))
    .slice(0, 8)
    .map((project) => ({
      key: project.project.repo_full_name,
      name: project.project.repo_full_name,
      channel: projectChannel(project),
      scoreLabel: lang === "zh" ? `评分 ${Math.round(Number(project.score.total_score))} / 100` : `Score ${Math.round(Number(project.score.total_score))} / 100`,
      confidenceLabel: confidenceLabel(project.score.confidence),
      reason: readableText(
        localizeFieldValue(project.project.description, lang),
        lang === "zh" ? "该节点缺少稳定描述文本，系统无法可靠建立语义画像。" : "The node does not have stable descriptive text, so semantic profiling is degraded.",
      ),
      note: lang === "zh" ? "已降低检索与推荐权重" : "Retrieval and recommendation weights are reduced.",
      issue:
        lang === "zh"
          ? !String(project.project.description ?? "").trim()
            ? "缺少仓库描述，语义检索链路会明显降级。"
            : String(project.project.description ?? "").trim().length < 24
              ? "描述过短，缺少足够的能力特征词。"
              : "缺少足够稳定的范式或元数据特征。"
          : !String(project.project.description ?? "").trim()
            ? "Repository description is missing, so semantic retrieval degrades noticeably."
            : String(project.project.description ?? "").trim().length < 24
              ? "Description is too short and lacks capability-specific keywords."
              : "Paradigm or metadata signatures are still too weak for stable indexing.",
    }));
  const lowConfidenceCount = quality?.low_confidence_projects ?? lowConfidenceProjects.length;
  const singleSourceCount = quality?.single_source_projects ?? singleSourceProjects.length;
  const missingDescriptionCount = missingDescriptionProjects.length;
  const activeSources = sourceStatus.filter((item) => item.status === "active").length;
  const failedSources = sourceStatus.filter((item) => item.status === "failed").length;
  const verdictSummary =
    lang === "zh"
      ? `系统已完成本轮数据检查，当前状态为“${overallStatusText}”。校验结果为 ${humanVerifyStatus}，活跃来源 ${activeSources} 个，失败来源 ${failedSources} 个。这里只提示会影响判断的问题。`
      : `This run has finished its data check and is currently "${overallStatusText}". Verification is ${humanVerifyStatus}, with ${activeSources} active sources and ${failedSources} failed sources. Only issues that can affect decisions are shown here.`;
  const validationDescription =
    verifyChecks.length > 0
      ? lang === "zh"
        ? `当前校验姿态为 ${humanVerifyStatus}。${verifyChecks
            .slice(0, 2)
            .map((check) => `${check.name} 为 ${check.status}，${readableText(localizeFieldValue(check.detail, lang), "状态已同步")}`)
            .join("；")}。`
        : `Validation posture is ${humanVerifyStatus}. ${verifyChecks
            .slice(0, 2)
            .map((check) => `${check.name} is ${check.status}: ${readableText(localizeFieldValue(check.detail, lang), "status synced")}`)
            .join("; ")}.`
      : lang === "zh"
        ? "当前仅保留会改变是否继续消费、继续判断或继续下钻的校验结论。"
        : "Only verification outcomes that change whether the operator should keep consuming, judging, or drilling deeper are preserved.";

  return {
    lang,
    pageTitle: uiText(lang, "数据源状态", "Run Health Console"),
    pageSummary: uiText(
      lang,
      "看看今天的数据和校验有没有问题，避免误判。", "Monitor dataflow lifecycle posture and confirm verification integrity before any decision is consumed.",
    ),
    verdictEyebrow: "Operations Verdict Stance",
    verdictTitle: uiText(lang, `本次数据检查结果（${verdictStatus}）`, `Full Run Self-Inspection Verdict (${verdictStatus})`),
    verdictStatus,
    verdictSummary,
    verifiedAtLabel: uiText(lang, "截面日期", "Snapshot Date"),
    verifiedAt: snapshotDate,
    priorityLabel: "Prioritized Actions",
    priorityTitle: uiText(lang, "现在最该处理的问题", "Priority Actions Before Consumption"),
    priorityActions:
      uniqueRecommendedActions.length > 0
        ? uniqueRecommendedActions
        : [
            lang === "zh"
              ? "当前没有新增高优先修复动作，可以把本次稳定运行姿态作为后续增强校验的基线。"
              : "No new high-priority remediation action is required, so this run can serve as the baseline for the next enhancement cycle.",
          ],
    telemetryLabel: "Critical Telemetry",
    telemetryTitle: uiText(lang, "有哪些异常需要留意（点击条目查看详情）", "Anomalies And Key Observations (Click To Drill Deeper)"),
    lowConfidenceHeading: uiText(lang, `1. 低置信度项目异常占比为 ${lowConfidenceCount}/${totalProjects || 0}`, `1. Low-confidence anomaly share is ${lowConfidenceCount}/${totalProjects || 0}`),
    lowConfidenceBody: uiText(
      lang,
      lowConfidenceCount > 0
        ? `当前仍有 ${lowConfidenceCount}/${totalProjects || 0} 个低置信度项目。它们的依据还不够稳，所以暂时不会进入主要判断。`
        : "当前没有低置信度项目外溢到主观察面，整体数据环境保持纯净。",
      lowConfidenceCount > 0
        ? `There are still ${lowConfidenceCount}/${totalProjects || 0} low-confidence projects. Their support is not stable enough yet, so they stay out of the main decision path.`
        : "No low-confidence node is leaking into the primary observation layer right now, so the data environment remains clean.",
    ),
    lowConfidenceCount,
    totalProjects,
    lowConfidenceProjects,
    singleSourceHeading: uiText(lang, `2. 仍有 ${singleSourceCount} 个项目只有单一信号源支撑`, `2. ${singleSourceCount} projects are still backed by a single signal source`),
    singleSourceBody: uiText(
      lang,
      singleSourceCount > 0
        ? "这些项目目前只被一个来源捕捉到。要让它们进入判断，最好先看更多来源或再观察一天。"
        : "当前没有处于单信号源锁定态的项目。",
      singleSourceCount > 0
        ? "These projects are currently backed by only one source. Before they affect decisions, they should pick up support from more sources or hold for another day."
        : "There is no project locked to a single-source state right now.",
    ),
    singleSourceCount,
    singleSourcePreview: singleSourceProjects.slice(0, 3),
    singleSourceAll: singleSourceProjects,
    singleSourceFootnote: uiText(
      lang,
      "这些项目现在处于继续观察阶段。系统会先自动去噪；如果第二天还是没有更多来源跟进，它们仍不会进入主要判断。", "These projects are still in the watch phase. The system filters noise first, and if no additional sources confirm them on the next day, they stay outside the main decision path.",
    ),
    missingDescriptionHeading: uiText(lang, `3. 有 ${missingDescriptionCount} 个项目存在描述缺失或过短`, `3. ${missingDescriptionCount} projects have missing or underspecified descriptions`),
    missingDescriptionBody: uiText(
      lang,
      missingDescriptionCount > 0
        ? "这些项目的描述或元数据不够完整，可能影响检索和排序，所以系统已经自动降低了它们的权重。"
        : "当前没有发现明显的描述缺失节点。",
      missingDescriptionCount > 0
        ? "These projects do not have complete enough descriptions or metadata, which can affect retrieval and ranking, so their weight has already been reduced automatically."
        : "No obvious description deficiency was detected in the current slice.",
    ),
    missingDescriptionCount,
    missingDescriptions: missingDescriptionProjects,
    validationLabel: "Validation Stance",
    validationStatus: verdictStatus,
    validationDescription,
    pipelinesTitle: uiText(lang, "数据源状态与更新速度", "Data Sources: Status And Update Speed"),
    activeNodesLabel: `${sourceStatus.length} Active Nodes`,
    pipelines: sourceStatus.map((item) => ({
      key: item.source,
      label: item.source,
      docs: item.item_count,
      distinctProjects: item.distinct_projects ?? item.item_count,
      enabledLabel: uiText(lang, `启用: ${item.enabled ? "是" : "否"}`, `Enabled: ${item.enabled ? "Yes" : "No"}`),
      statusLabel: item.status,
      notes: readableText(
        item.notes.map((note) => localizeFieldValue(note, lang)).join(" · "),
        lang === "zh" ? `项目覆盖 ${item.distinct_projects ?? item.item_count} 个` : `${item.distinct_projects ?? item.item_count} distinct projects covered`,
      ),
      active: item.enabled && item.status === "active",
    })),
    verifySectionTitle: uiText(lang, "校验结果", "Verification Snapshot"),
    verifyChecks: verifyChecks.map((check) => ({
      key: check.name,
      name: check.name,
      statusLabel: check.status.toUpperCase(),
      detail: readableText(localizeFieldValue(check.detail, lang), lang === "zh" ? "状态已同步" : "status synced"),
    })),
    failureNotesTitle: uiText(lang, "失败和备用方案", "Failure And Fallback Notes"),
    failureNotes: failureNotes.length > 0 ? failureNotes : [lang === "zh" ? "当前没有需要额外上浮的失败或回退说明。" : "There is no extra failure or fallback note to surface right now."],
    initialTelemetry: null,
    compatibilitySummaryTitle: uiText(lang, "这批数据现在能不能用", "Run Summary / Trust Gate"),
    compatibilitySourceTitle: uiText(lang, "来源状态表", "Source Status Table"),
    compatibilityAuditTitle: uiText(lang, "校验 / 审计 / 失败回退", "Verify / Audit / Failure Fallback"),
    compatibilityVerifyTitle: uiText(lang, "异常面板映射", "Telemetry Mappings"),
    compatibilityActionTitle: uiText(lang, "建议动作", "Recommended Actions"),
    sourceTableRows: sourceStatus.map((item) => ({
      source: item.source,
      enabledLabel: item.enabled ? uiText(lang, "是", "Yes") : uiText(lang, "否", "No"),
      countLabel: String(item.item_count),
      distinctProjectsLabel: String(item.distinct_projects ?? item.item_count),
      statusLabel: item.status,
      notes: readableText(
        item.notes.map((note) => localizeFieldValue(note, lang)).join(" · "),
        lang === "zh" ? `项目覆盖 ${item.distinct_projects ?? item.item_count} 个` : `${item.distinct_projects ?? item.item_count} distinct projects covered`,
      ),
    })),
    auditRows: [
      ...verifyChecks.map((check) => ({
        repoFullName: check.name,
        statusLabel: check.status.toUpperCase(),
        metricsAppliedLabel: readableText(localizeFieldValue(check.detail, lang), lang === "zh" ? "状态已同步" : "status synced"),
      })),
      ...failureNotes.map((note, index) => ({
        repoFullName: lang === "zh" ? `失败说明 ${index + 1}` : `Failure note ${index + 1}`,
        statusLabel: lang === "zh" ? "注意" : "NOTE",
        metricsAppliedLabel: note,
      })),
    ],
  };
}

export function buildOverviewReactProps(model: OverviewViewModel, requestUrl: URL, lang: UiLang, theme: UiTheme): OverviewReactAppProps {
  const ui = copy(lang);
  const selectedDate = model.context.selected_date ?? requestUrl.searchParams.get("date") ?? "latest";
  const weeklyAnchor = model.weekly_entry?.anchor_date ?? selectedDate;
  const sourceItems = model.run_snapshot?.run_summary?.source_status ?? [];
  const activeSources = sourceItems.filter((item) => item.status === "active").length;
  const verifyStatus = model.run_snapshot?.verify_result?.status ?? ui.none;
  const dailyStatus = model.run_snapshot?.daily_report.overall_daily_status ?? model.banner.source_health ?? ui.none;
  const overviewHref = toViewHref("overview", lang, theme, { date: selectedDate });
  const projectsHref = toViewHref("projects", lang, theme, { date: selectedDate });
  const weeklyHref = toViewHref("weekly", lang, theme, { date: selectedDate, anchor: weeklyAnchor });
  const runHealthHref = toViewHref("run-health", lang, theme, { date: selectedDate, source_view: "overview" });
  const observerHref = toViewHref("observer", lang, theme, { date: selectedDate, source_view: "overview" });
  const slides = model.top_decisions.slice(0, 5);
  const continuationProjects = model.top_decisions.slice(1, 5);
  const leadDecision = model.top_decisions[0] ?? null;

  return {
    lang,
    productName: ui.productName,
    navItems: [
      { label: ui.navOverview, href: overviewHref, active: true },
      { label: ui.navProjects, href: projectsHref, active: false },
      { label: ui.navWeekly, href: weeklyHref, active: false },
      { label: ui.navRunHealth, href: runHealthHref, active: false },
      { label: uiText(lang, "新兴潜力项目", "Observer"), href: observerHref, active: false },
    ],
    languageLabel: ui.langLabel,
    languageOptions: [
      { label: ui.langZh, href: toViewHref("overview", "zh", theme, { date: selectedDate }), active: lang === "zh" },
      { label: ui.langEn, href: toViewHref("overview", "en", theme, { date: selectedDate }), active: lang === "en" },
    ],
    themeLabel: uiText(lang, "主题", "Theme"),
    themeOptions: [
      { label: uiText(lang, "浅色", "Light"), href: toViewHref("overview", lang, "light", { date: selectedDate }), active: theme === "light" },
      { label: uiText(lang, "深色", "Dark"), href: toViewHref("overview", lang, "dark", { date: selectedDate }), active: theme === "dark" },
    ],
    heroEyebrow: uiText(lang, "今日必读", "Read First"),
    heroTitle: uiText(lang, "先看今天最重要的项目", "Read The Top Projects First"),
    heroSummary: uiText(lang, "一个更短的首页，只放今天最值得先读的项目。", "A shorter homepage that only surfaces the projects worth reading first."),
    statusLine: uiText(
      lang,
      `数据 ${dailyStatus}，可直接阅读 · 校验 ${verifyStatus}`,
      `Data ${dailyStatus}, ready to read · Verify ${verifyStatus}`,
    ),
    runHealthLabel: uiText(lang, "查看数据状态", "Run Health"),
    runHealthHref,
    projectsLabel: uiText(lang, "项目列表", "Projects"),
    projectsHref,
    topDecisionsLabel: uiText(lang, "今日重点项目", "Top Project"),
    selectionReasonLabel: uiText(lang, "入选原因", "Why It Matters Today"),
    nextActionsLabel: uiText(lang, "下一步动作", "Next Actions"),
    prevLabel: uiText(lang, "上一页", "Prev"),
    nextLabel: uiText(lang, "下一页", "Next"),
    readFirstLabel: uiText(lang, "今日必读", "Read First"),
    projectDetailLabel: uiText(lang, "项目详情", "Project Detail"),
    initialTheme: theme,
    initialSection: "decisions",
    noneLabel: ui.none,
    signalSummaryLabel: uiText(lang, "这批数据靠不靠谱", "Run Trust Summary"),
    signalPostureTitle: uiText(lang, "今天整体情况", "Signal Posture"),
    signalPostureBody: dailyStatus,
    signalFreshnessHtml: "",
    signalMetaHtml: buildMetaPairsHtml([
      { label: uiText(lang, "校验结果摘要", "Verify Summary"), value: verifyStatus },
      { label: uiText(lang, "活跃来源", "Active Sources"), value: String(activeSources) },
      { label: uiText(lang, "重点项目", "Top Decisions"), value: String(model.top_decisions.length) },
    ]),
    decisionsPanelLabel: uiText(lang, "今日重点项目", "Top Decisions"),
    decisionsPanelTitle: "Lead Decision And Continuations",
    leadDecisionName: leadDecision?.project.project_name ?? null,
    leadDecisionReason: leadDecision ? overviewProjectReason(leadDecision) : null,
    leadDecisionHref: leadDecision ? projectHref(leadDecision, requestUrl, lang, theme) : null,
    decisionCards: continuationProjects.map((project, index) => ({
      key: project.project.repo_full_name,
      href: projectHref(project, requestUrl, lang, theme),
      title: project.project.project_name,
      confidenceBadgeHtml: buildBadgeHtml(project.score.confidence, "accent"),
      sparklineHtml: buildSparklineSvgHtml(buildOverviewTrendPath(Number(project.score.total_score), index + 1)),
      scoreBadgeHtml: buildBadgeHtml(`${uiText(lang, "分数", "Score")} ${project.score.total_score}`, "neutral"),
      reason: overviewProjectReason(project),
    })),
    risksPanelLabel: uiText(lang, "风险与建议动作", "What To Watch Next"),
    risksPanelTitle: "What To Watch Next",
    watchlistItems: model.risks_and_actions.slice(0, 4),
    weeklyEntryLabel: "Weekly Entry",
    weeklyPanelTitle: "Continue In Weekly",
    weeklySummary: uiText(
      lang,
      "把今天的主判断继续带到本周趋势台，查看稳定趋势和后续观察点。", "Continue from today's lead decision into the weekly desk for stable trends and watchpoints.",
    ),
    weeklyHref,
    openWeeklyLabel: uiText(lang, "看本周趋势", "Open Weekly"),
    sourcesPanelLabel: uiText(lang, "数据来源情况", "Source Health"),
    sourcesPanelTitle: "Source Health Overview",
    sourceCards: sourceItems.map((item) => ({
      key: item.source,
      source: item.source,
      itemCount: item.item_count,
      status: item.status,
      statusBadgeHtml: buildBadgeHtml(item.status, item.status === "active" ? "sage" : "accent"),
      metaPairsHtml: buildMetaPairsHtml([
        { label: uiText(lang, "启用", "Enabled"), value: item.enabled ? uiText(lang, "是", "Yes") : uiText(lang, "否", "No") },
        { label: uiText(lang, "数量", "Count"), value: String(item.item_count) },
      ]),
    })),
    riskDiagnostics: [
      ...(model.risks_and_actions.length > 0 ? [{
        key: "risk-summary",
        title: "Telemetry Alert",
        tone: "critical" as const,
        body: model.risks_and_actions[0] ?? ui.none,
        actionHref: runHealthHref,
        actionLabel: uiText(lang, "项目详情", "Project Detail"),
      }] : []),
    ],
    projects: slides.map((project, index) => ({
      repoFullName: project.project.repo_full_name,
      radarScore: Number(project.score.total_score),
      recommendationText:
        Number(project.score.total_score) >= 95
          ? uiText(lang, "高优推荐", "High Priority")
          : Number(project.score.total_score) >= 85
            ? uiText(lang, "重点跟踪", "Track Closely")
            : uiText(lang, "观察名单", "Watchlist"),
      dailyGrowth: Number(project.project.star_delta_daily ?? 0),
      trendPath: buildOverviewTrendPath(Number(project.score.total_score), index),
      descriptionText: overviewProjectIntro(project),
      selectionReasonText: overviewProjectReason(project),
      paradigmLongText: project.score.paradigm,
      persistenceLabel: project.project.persistence_state,
      detailBadge: projectBoardLabel(projectBoardValue(project), lang),
      detailBody: `${overviewProjectIntro(project)} ${overviewProjectReason(project)}`.trim(),
      signalText: uiText(lang, "动量信号", "Momentum"),
      href: projectHref(project, requestUrl, lang, theme),
    })),
    githubStarLabel: uiText(lang, "⭐ Star on GitHub", "⭐ Star on GitHub"),
    githubStarHref: PROJECT_REPO_HREF,
    githubStarStatusText: null,
  };
}

function renderOverviewTopProjectCarousel(model: OverviewViewModel, requestUrl: URL, lang: UiLang, theme: UiTheme): string {
  const ui = copy(lang);
  const slides = model.top_decisions.slice(0, 4);
  const runHealthHref = toViewHref("run-health", lang, theme, { date: model.context.selected_date ?? "latest" });
  const projectsHref = toViewHref("projects", lang, theme, { date: model.context.selected_date ?? "latest" });
  const trustHeadline = `${model.banner.context_label} · ${model.banner.source_health}`;
  const statusLine = `${model.state.status} · ${model.banner.mode_label}`;

  return `
    <section class="overview-top-project-carousel" data-top-project-carousel="true" data-carousel-index="0">
      <button class="overview-carousel-arrow overview-carousel-arrow-prev" type="button" data-carousel-arrow="prev" aria-label="Prev">‹</button>
      <div class="overview-carousel-track">
        ${(slides.length > 0 ? slides : [null]).map((project, index) => {
          const href = project ? projectHref(project, requestUrl, lang, theme) : projectsHref;
          const projectName = project?.project.project_name ?? "No Project Ready Yet";
          const repoName = project?.project.repo_full_name ?? "n/a";
          const summary = project ? overviewProjectIntro(project) : ui.none;
          const reason = project ? overviewProjectReason(project) : ui.none;
          const nextAction = project?.score.next_actions[0] ?? ui.none;
          return `
            <article class="overview-carousel-slide" data-carousel-slide data-slide-active="${index === 0 ? "true" : "false"}">
              <div class="overview-carousel-atmosphere" aria-hidden="true">
                <span class="overview-carousel-orb overview-carousel-orb-left"></span>
                <span class="overview-carousel-stage-plate"></span>
                <span class="overview-carousel-orb overview-carousel-orb-right"></span>
              </div>
              <div class="overview-carousel-content">
                <div class="overview-carousel-showcase">
                  <div class="overview-carousel-showcase-grid" aria-hidden="true"></div>
                  <div class="overview-carousel-showcase-accent overview-carousel-showcase-accent-left" aria-hidden="true"></div>
                  <div class="overview-carousel-showcase-accent overview-carousel-showcase-accent-right" aria-hidden="true"></div>
                  <section class="overview-home-intro">
                    <div class="overview-home-intro-copy">
                      <p class="eyebrow">${escapeHtml(ui.badgeOverview)}</p>
                      <h1 data-typography="hero-title">${escapeHtml(uiText(lang, "先看今天最重要的项目", "Read The Top Projects First"))}</h1>
                      <p class="overview-home-summary">${escapeHtml(trustHeadline)}</p>
                    </div>
                    <div class="overview-home-actions action-row">
                      <a class="button-link" href="${escapeHtml(runHealthHref)}">${escapeHtml(ui.openRunHealth)}</a>
                      <a class="button-link is-secondary" href="${escapeHtml(projectsHref)}">${escapeHtml(ui.openProjects)}</a>
                      <a class="button-link is-secondary" href="${escapeHtml(PROJECT_REPO_HREF)}" target="_blank" rel="noreferrer">${escapeHtml(ui.openRepo)}</a>
                    </div>
                    <p class="overview-home-statusline">${escapeHtml(statusLine)}</p>
                  </section>
                  <div class="overview-carousel-stage-layout">
                    <article class="overview-carousel-mini-card overview-carousel-mini-card-lead">
                      <p class="eyebrow">${escapeHtml(uiText(lang, "主看板", "Main Board"))}</p>
                      <strong class="overview-mini-value">${escapeHtml(repoName)}</strong>
                      <p>${escapeHtml(reason)}</p>
                    </article>
                    <article class="overview-carousel-mini-card overview-carousel-mini-card-score">
                      <p class="eyebrow">${escapeHtml(ui.score)}</p>
                      <div class="overview-mini-metrics">
                        <div class="overview-carousel-chip-row">
                          ${project ? renderStatusPill(`${ui.score} ${project.score.total_score}`, "good") : renderStatusPill(ui.none, "neutral")}
                          ${project ? renderStatusPill(project.score.confidence, "neutral") : ""}
                          ${project ? renderStatusPill(project.score.paradigm, "neutral") : ""}
                        </div>
                      </div>
                    </article>
                    <div class="overview-carousel-ribbon">
                      <div class="overview-carousel-ribbon-main">
                        <p class="eyebrow">${escapeHtml(uiText(lang, "今日主项目", "Top Project"))}</p>
                        <h2><a href="${escapeHtml(href)}">${escapeHtml(projectName)}</a></h2>
                        <p class="overview-carousel-ribbon-summary">${escapeHtml(summary)}</p>
                      </div>
                      <div class="overview-carousel-ribbon-side">
                        <div>
                          <span class="context-label">${escapeHtml(ui.projectReasons)}</span>
                          <p>${escapeHtml(reason)}</p>
                        </div>
                        <div class="overview-carousel-nextline">
                          <span class="context-label">${escapeHtml(ui.nextActions)}</span>
                          <p>${escapeHtml(nextAction)}</p>
                        </div>
                      </div>
                    </div>
                    <article class="overview-carousel-mini-card overview-carousel-mini-card-next">
                      <p class="eyebrow">${escapeHtml(ui.nextActions)}</p>
                      <p>${escapeHtml(nextAction)}</p>
                    </article>
                    <article class="overview-carousel-mini-card overview-carousel-mini-card-spark">
                      <p class="eyebrow">${escapeHtml(uiText(lang, "七日信号", "7d Signal"))}</p>
                      <p>${escapeHtml(project?.project.persistence_state ?? ui.none)}</p>
                    </article>
                    <article class="overview-carousel-mini-card overview-carousel-mini-card-focus">
                      <p class="eyebrow">${escapeHtml(uiText(lang, "今日关注", "Today's Focus"))}</p>
                      <strong class="overview-mini-value">${escapeHtml(projectName)}</strong>
                      <p>${escapeHtml(summary)}</p>
                    </article>
                  </div>
                </div>
              </div>
            </article>
          `;
        }).join("")}
      </div>
      <button class="overview-carousel-arrow overview-carousel-arrow-next" type="button" data-carousel-arrow="next" aria-label="Next">›</button>
      <div class="overview-carousel-pagination" aria-label="${escapeHtml(ui.topProjects)}">
        ${slides.map((_, index) => `<span class="overview-carousel-dot ${index === 0 ? "is-active" : ""}" data-carousel-dot="${index}"></span>`).join("")}
      </div>
    </section>
  `;
}

function renderOverviewWorkspaceRail(requestUrl: URL): string {
  const activeSection = resolveOverviewWorkspaceSection(requestUrl);
  const labels: Record<OverviewWorkspaceSection, string> = {
    signals: "Signals",
    decisions: "Decisions",
    watchlist: "Watchlist",
    sources: "Sources",
  };

  return `
    <section class="overview-workspace-rail" data-workspace-rail="overview" data-workspace-section="${escapeHtml(activeSection)}">
      <button class="overview-workspace-arrow" type="button" data-workspace-arrow="prev" aria-label="Prev">‹</button>
      <div class="overview-workspace-track">
        ${OVERVIEW_WORKSPACE_SECTIONS.map((section) => `<span class="overview-workspace-chip ${section === activeSection ? "is-active" : ""}" data-workspace-chip="${escapeHtml(section)}">${escapeHtml(labels[section])}</span>`).join("")}
      </div>
      <button class="overview-workspace-arrow" type="button" data-workspace-arrow="next" aria-label="Next">›</button>
    </section>
  `;
}

function renderOverviewWorkspacePanels(model: OverviewViewModel, requestUrl: URL, lang: UiLang, theme: UiTheme): string {
  const ui = copy(lang);
  const activeSection = resolveOverviewWorkspaceSection(requestUrl);
  const leadDecision = model.top_decisions[0] ?? null;
  const continuationProjects = model.top_decisions.slice(1, 5);
  const sourceItems = model.run_snapshot?.run_summary?.source_status ?? [];
  const weeklyHref = model.weekly_entry ? toViewHref("weekly", lang, theme, { anchor: model.weekly_entry.anchor_date ?? "latest", date: model.context.selected_date ?? "latest" }) : null;

  return [
    `
      <section class="overview-workspace-panel" data-workspace-panel="signals" data-panel-active="${activeSection === "signals" ? "true" : "false"}">
        <article class="panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">${escapeHtml(ui.trustSummary)}</p>
              <h2>${escapeHtml("Signal Posture")}</h2>
            </div>
          </div>
          <p class="reader-copy">${escapeHtml(model.banner.source_health)}</p>
          <div class="micro-stack">
            <div class="overview-watchlist-advisory">
              <p class="overview-watchlist-advisory-kicker">${escapeHtml(model.banner.mode_label)}</p>
              <p class="overview-watchlist-advisory-copy">${escapeHtml(model.banner.context_label)}</p>
            </div>
          </div>
        </article>
      </section>
    `,
    `
      <section class="overview-workspace-panel" data-workspace-panel="decisions" data-panel-active="${activeSection === "decisions" ? "true" : "false"}">
        <article class="panel">
          <div class="section-head">
            <div>
              <p class="eyebrow">${escapeHtml(ui.topProjects)}</p>
              <h2>${escapeHtml("Lead Decision And Continuations")}</h2>
            </div>
          </div>
          ${
            leadDecision
              ? `<p class="reader-copy"><strong>${escapeHtml(leadDecision.project.project_name)}</strong> · ${escapeHtml(overviewProjectReason(leadDecision))}</p><div class="action-row"><a class="button-link" href="${escapeHtml(projectHref(leadDecision, requestUrl, lang, theme))}">${escapeHtml(ui.selectedDetail)}</a></div>`
              : `<p class="empty-copy">${escapeHtml(ui.none)}</p>`
          }
        </article>
        <div class="overview-decision-grid overview-decision-matrix overview-decision-matrix-two-up">
          ${continuationProjects.map((project) => `
            <article class="decision-card overview-decision-row">
              <div class="card-head overview-decision-head">
                <h3><a href="${escapeHtml(projectHref(project, requestUrl, lang, theme))}">${escapeHtml(project.project.project_name)}</a></h3>
                ${renderStatusPill(project.score.confidence, "neutral")}
              </div>
              <p class="overview-decision-copy">${escapeHtml(overviewProjectReason(project))}</p>
              <div class="overview-decision-footer">
                ${renderStatusPill(`${ui.score} ${project.score.total_score}`, "good")}
                ${renderStatusPill(project.score.paradigm, "neutral")}
              </div>
            </article>
          `).join("") || `<p class="empty-copy">${escapeHtml(ui.none)}</p>`}
        </div>
      </section>
    `,
    `
      <section class="overview-workspace-panel" data-workspace-panel="watchlist" data-panel-active="${activeSection === "watchlist" ? "true" : "false"}">
        <article class="overview-watchlist-shell">
          <div class="overview-watchlist-head">
            <div class="overview-watchlist-head-icon">!</div>
            <div>
              <p class="eyebrow">${escapeHtml(ui.actionRail)}</p>
              <h2 class="overview-watchlist-title">${escapeHtml("What To Watch Next")}</h2>
            </div>
          </div>
          <div class="overview-watchlist-stack">
            ${model.risks_and_actions.slice(0, 4).map((item) => `<div class="overview-watchlist-advisory"><p class="overview-watchlist-advisory-copy">${escapeHtml(item)}</p></div>`).join("") || `<p class="empty-copy">${escapeHtml(ui.none)}</p>`}
          </div>
          ${weeklyHref ? `<div class="action-row"><a class="button-link" href="${escapeHtml(weeklyHref)}">${escapeHtml(ui.openWeekly)}</a></div>` : ""}
        </article>
      </section>
    `,
    `
      <section class="overview-workspace-panel" data-workspace-panel="sources" data-panel-active="${activeSection === "sources" ? "true" : "false"}">
        <article class="overview-sources-shell">
          <div class="overview-sources-header">
            <div>
              <p class="eyebrow">${escapeHtml(ui.sourceHealth)}</p>
              <h3 class="overview-sources-title">${escapeHtml("Source Health Overview")}</h3>
            </div>
            <div class="overview-sources-status">
              <span class="overview-sources-status-dot"></span>
              <span class="overview-sources-status-copy">${escapeHtml(model.state.status)}</span>
            </div>
          </div>
          <div class="overview-source-grid">
            ${sourceItems.map((item) => `
              <article class="overview-source-card">
                <div class="overview-source-card-top">
                  <div class="overview-source-card-identity">
                    <h4>${escapeHtml(item.source)}</h4>
                    <p>${escapeHtml(item.notes.join(" | ") || model.banner.context_label)}</p>
                  </div>
                  <div class="overview-source-card-status">
                    <span class="overview-source-card-dot"></span>
                    <span class="overview-source-card-state">${escapeHtml(item.status)}</span>
                  </div>
                </div>
                <div class="overview-source-card-footer">
                  <span class="overview-source-card-volume-label">Count</span>
                  <div class="overview-source-card-volume"><span>${escapeHtml(String(item.item_count))}</span><span>${escapeHtml(item.enabled ? "enabled" : "disabled")}</span></div>
                </div>
              </article>
            `).join("") || `<p class="empty-copy">${escapeHtml(ui.none)}</p>`}
          </div>
        </article>
      </section>
    `,
  ].join("");
}

function renderOverviewPage(model: OverviewViewModel, requestUrl: URL, lang: UiLang, theme: UiTheme): string {
  return `
    <div id="overview-react-root" data-react-overview="true">
      ${renderToStaticMarkup(createElement(App, buildOverviewReactProps(model, requestUrl, lang, theme)))}
    </div>
  `;
}

function renderOverviewProjectCard(project: DailyExposureProject, requestUrl: URL, lang: UiLang, theme: UiTheme): string {
  return `
    <a class="project-card" href="${escapeHtml(projectHref(project, requestUrl, lang, theme))}">
      <span class="card-kicker">${escapeHtml((project.direction_matches ?? ["overview"]).slice(0, 2).join(" | "))}</span>
      <h3>${escapeHtml(project.project.project_name)}</h3>
      <p>${escapeHtml(project.project_brief_cn || project.why_today_cn)}</p>
      <div class="inline-actions">
        ${renderStatusPill(`score ${project.score.total_score}`, "good")}
        ${renderStatusPill(project.score.confidence, "neutral")}
      </div>
    </a>
  `;
}

function renderLeadProjectReader(project: DailyExposureProject): string {
  const scorePanel = renderToStaticMarkup(createElement(ScoreEvidencePanel, {
    radarLabel: project.project.project_name,
    summaryCards: [
      { label: "Score", value: String(project.score.total_score), tone: "accent", wide: true },
      { label: "Confidence", value: project.score.confidence, tone: "signal" },
      { label: "Paradigm", value: project.score.paradigm, tone: "neutral", wide: true },
    ],
    metrics: project.score.components.map((component) => ({
      key: component.name,
      label: component.name.replaceAll("_", " "),
      score: String(component.score),
      share: `${Math.round(component.weight * 100)}%`,
      evidence: component.evidence[0] ?? "none",
    })),
  }));

  return `
    <div class="long-copy">
      <p><strong>${escapeHtml(project.project.project_name)}</strong> | <span class="mini-code">${escapeHtml(project.project.repo_full_name)}</span></p>
      <p>${escapeHtml(project.project_brief_cn)}</p>
      <p>${escapeHtml(project.why_today_cn)}</p>
      <p>${escapeHtml(project.appearance_explanation_cn ?? project.personalization_reason_cn ?? project.project.description)}</p>
      ${scorePanel}
    </div>
  `;
}

function renderProjectListItem(
  project: DailyExposureProject | ProjectsViewModel["projects"][number],
  requestUrl: URL,
  lang: UiLang,
  theme: UiTheme,
  selected = false,
): string {
  return `
    <a class="project-list-item ${selected ? "is-active" : ""}" href="${escapeHtml(projectHref(project, requestUrl, lang, theme))}">
      <span class="eyebrow">${escapeHtml(project.exposure_bucket ?? "project")}</span>
      <h3>${escapeHtml(project.project.project_name)}</h3>
      <div class="project-meta">
        <span>${escapeHtml(project.project.repo_full_name)}</span>
        <span>${escapeHtml(project.score.paradigm)}</span>
        <span>${escapeHtml(project.project.persistence_state)}</span>
      </div>
      <p class="hero-copy">${escapeHtml(project.appearance_explanation_cn ?? project.project_brief_cn)}</p>
    </a>
  `;
}

function projectHref(
  project: DailyExposureProject | ProjectsViewModel["projects"][number],
  requestUrl: URL,
  lang: UiLang,
  theme: UiTheme,
): string {
  return toViewHref("projects", lang, theme, {
    date: requestUrl.searchParams.get("date") || "latest",
    project: project.project.repo_full_name,
    source_view: "projects",
  });
}

function renderProjectsPage(model: ProjectsViewModel, requestUrl: URL, lang: UiLang, theme: UiTheme): string {
  const ui = copy(lang);
  const heroHtml = `
    <section class="hero-card">
      <span class="hero-badge">${escapeHtml(ui.projectList)}</span>
      <h2 class="hero-title">${escapeHtml(model.selected_project?.project.project.project_name ?? ui.projectList)}</h2>
      <p class="hero-copy">${escapeHtml(model.banner.notes[0] ?? model.banner.context_label)}</p>
    </section>
  `;

  const filterHtml = `
    <div class="metric-grid">
      <article class="metric-card"><span class="metric-label">Today Pulse</span><strong class="metric-value">${model.today_pulse_projects.length}</strong></article>
      <article class="metric-card"><span class="metric-label">Mission Match</span><strong class="metric-value">${model.mission_match_projects.length}</strong></article>
      <article class="metric-card"><span class="metric-label">Explore Ribbon</span><strong class="metric-value">${model.explore_ribbon_projects.length}</strong></article>
      <article class="metric-card"><span class="metric-label">History</span><strong class="metric-value">${model.historical_context_projects.length}</strong></article>
    </div>
  `;

  const rowsHtml = `
    <div class="project-list">
      ${model.projects.map((project) => renderProjectListItem(project, requestUrl, lang, theme, model.selected_project?.project.project.repo_full_name === project.project.repo_full_name)).join("")}
    </div>
  `;

  const dockHtml = model.selected_project
    ? renderDockSurface(
        "projects-detail-dock",
        renderSelectedProjectDetail(model.selected_project.project, ui),
        { detailKey: model.selected_project.project.project.repo_full_name, ariaLabel: ui.selectedDetail },
      )
    : "";

  const emptyDockHtml = renderDockSurface(
    "projects-detail-dock",
    `<div class="dock-placeholder">${escapeHtml(ui.noSelection)}</div>`,
    { detailKey: "empty", ariaLabel: ui.selectedDetail },
  );

  return renderProjectsRoute({
    heroHtml,
    hasDetail: Boolean(model.selected_project),
    filterHtml,
    rowsHtml,
    dockHtml,
    emptyDockHtml,
  });
}

function renderSelectedProjectDetail(project: ProjectsViewModel["projects"][number], ui: ReturnType<typeof copy>): string {
  const scorePanel = renderToStaticMarkup(createElement(ScoreEvidencePanel, {
    radarLabel: project.project.project_name,
    summaryCards: [
      { label: ui.score, value: String(project.score.total_score), tone: "accent", wide: true },
      { label: ui.confidence, value: project.score.confidence, tone: "signal" },
      { label: ui.persistence, value: project.project.persistence_state, tone: "neutral" },
    ],
    metrics: project.score.components.map((component) => ({
      key: component.name,
      label: component.name.replaceAll("_", " "),
      score: String(component.score),
      share: `${Math.round(component.weight * 100)}%`,
      evidence: component.evidence[0] ?? "none",
    })),
  }));

  return `
    <section class="reader-card">
      <div class="section-header">
        <h2>${escapeHtml(project.project.project_name)}</h2>
        ${renderStatusPill(`${ui.score} ${project.score.total_score}`, "good")}
      </div>
      <div class="kb-reader-copy">
        <p><span class="mini-code">${escapeHtml(project.project.repo_full_name)}</span></p>
        <p>${escapeHtml(project.project_brief_cn)}</p>
        <p>${escapeHtml(project.why_today_cn)}</p>
        <p>${escapeHtml(project.appearance_explanation_cn ?? project.personalization_reason_cn ?? project.project.description)}</p>
        <p><strong>${escapeHtml(ui.risks)}:</strong> ${escapeHtml(project.score.risks.join(" | ") || "none")}</p>
        <p><strong>${escapeHtml(ui.nextActions)}:</strong> ${escapeHtml(project.score.next_actions.join(" | ") || "none")}</p>
      </div>
      ${scorePanel}
    </section>
  `;
}

export function buildWeeklyReactProps(model: WeeklyViewModel, requestUrl: URL, lang: UiLang, theme: UiTheme): WeeklyViewProps {
  const ui = copy(lang);
  const snapshot = model.weekly_snapshot;
  const matrix = snapshot?.markdown.evidence_matrix ?? null;
  const coreCards = snapshot?.markdown.core_trend_cards ?? [];
  const weakSignalCards = snapshot?.markdown.weak_signal_cards ?? [];
  const activeAnchor =
    model.context.selected_window?.anchor_date ??
    requestUrl.searchParams.get("anchor") ??
    requestUrl.searchParams.get("anchor-date") ??
    requestUrl.searchParams.get("date") ??
    "latest";
  const dailyDate = model.context.selected_date ?? requestUrl.searchParams.get("date") ?? activeAnchor;
  const previousNavAnchor = model.time_navigator.previous_key;
  const nextAnchor = model.time_navigator.next_key;
  const previousAnchor = previousNavAnchor ?? model.time_navigator.current_key ?? activeAnchor;
  const weeklyWindowLabel = model.context.selected_window
    ? `${model.context.selected_window.window_start} -> ${model.context.selected_window.window_end}`
    : activeAnchor;
  const focusedTrend = coreCards[0] ?? null;
  const titleFallback = uiText(lang, "本周重点趋势", "Weekly Trend Desk");
  const summaryFallback = uiText(
    lang,
    "本周趋势尚未完全收敛，先从证据矩阵和支撑项目关系里看主线。", "This weekly slice has not fully converged yet, so start from the evidence matrix and supporting projects.",
  );

  const drawerProjects: WeeklyViewProps["drawerProjects"] = coreCards.flatMap((card) =>
    card.supporting_projects.map((project) => {
      const repoFullName = project.repo_url.replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "") || project.project_name;
      return {
        repoFullName,
        title: project.project_name,
        closeHref: updateUrlSearch(requestUrl, { project: null }),
        openHref: toViewHref("projects", lang, theme, {
          date: dailyDate,
          project: repoFullName,
          source_view: "weekly",
          trend_key: card.trend_key,
        }),
        kbHref: toViewHref("kb", lang, theme, {
          date: model.context.selected_window?.window_end ?? dailyDate,
          project: repoFullName,
          source_view: "weekly",
          trend_key: card.trend_key,
        }),
        scoreLabel: String(Math.round(project.final_rank ?? project.base_final_rank ?? project.objective_score ?? 0)),
        paradigmLabel: readableText(project.personalization_reason_cn, uiText(lang, "周度支撑项目", "Weekly Support")),
        persistenceLabel: project.risk_review_required ? uiText(lang, "待审计", "Audit Pending") : uiText(lang, "持续跟进", "Persistent"),
        dailyGrowthLabel: uiText(lang, "趋势支撑角色", "Trend Carrier"),
        detailBadge: readableText(project.watchlist_note_cn, uiText(lang, "周度下钻", "Weekly Drilldown")),
        description: readableText(project.project_brief_cn, summaryFallback),
        selectionReason: readableText(project.why_this_week_cn, summaryFallback),
        detailBody: readableText(project.risk_review_note_cn, ui.none),
        identityLabel: project.repo_url,
        identityHref: project.repo_url,
        kbStatusLabel: project.enhancement_source === "agent" ? uiText(lang, "已补充知识", "Knowledge Linked") : uiText(lang, "待补充知识", "KB Pending"),
        kbUpdatedLabel: ui.generatedAt,
        kbUpdatedValue: formatCompactDateTime(snapshot?.markdown.generated_at),
        openKbLabel: ui.openKbCard,
        closeLabel: ui.close,
        archiveLabel: uiText(lang, "知识卡", "Knowledge Base"),
        executeLabel: uiText(lang, "查看项目", "Open Project"),
      };
    }),
  );

  const trends: WeeklyViewProps["trends"] = coreCards.map((card, index) => ({
    key: card.trend_key,
    badge: uiText(lang, `核心趋势 · ${String(index + 1).padStart(2, "0")}`, `Core Trend · ${String(index + 1).padStart(2, "0")}`),
    title: readableText(card.trend_name_cn, titleFallback),
    summary: readableText(card.trend_summary_cn, summaryFallback),
    description: readableText(card.evidence_summary_cn ?? card.trend_summary_cn, summaryFallback),
    consensusLabel: uiText(
      lang,
      `共识 ${Math.max(12, Math.round(card.evidence_matrix?.axes?.[0]?.score ?? matrix?.axes?.[0]?.score ?? 58))}%`,
      `Consensus ${Math.max(12, Math.round(card.evidence_matrix?.axes?.[0]?.score ?? matrix?.axes?.[0]?.score ?? 58))}%`,
    ),
    countLabel: uiText(lang, `${card.supporting_projects.length} 个项目`, `${card.supporting_projects.length} projects`),
    trendHref: toViewHref("weekly", lang, theme, {
      date: dailyDate,
      anchor: activeAnchor,
      trend_key: card.trend_key,
    }),
    matrixAxes: buildWeeklyMatrixAxes(card.evidence_matrix?.axes ?? matrix?.axes, lang).map((axis) => ({
      ...axis,
      summary: mapWeeklyAxisSummary(axis.summary, lang),
    })),
    projects: card.supporting_projects.map((project, projectIndex) => {
      const repoFullName = project.repo_url.replace(/^https:\/\/github\.com\//, "").replace(/\/$/, "") || project.project_name;
      return {
        key: repoFullName,
        repoFullName,
        title: project.project_name,
        href: toViewHref("weekly", lang, theme, {
          date: dailyDate,
          anchor: activeAnchor,
          trend_key: card.trend_key,
          project: repoFullName,
        }),
        score: Math.round(project.final_rank ?? project.base_final_rank ?? project.objective_score ?? 0),
        description: readableText(project.project_brief_cn, summaryFallback),
        selectionReason: readableText(project.why_this_week_cn, summaryFallback),
        paradigm: readableText(project.personalization_reason_cn, uiText(lang, "周度支撑项目", "Weekly Support")),
        persistence: project.risk_review_required ? uiText(lang, "待审计", "Audit Pending") : uiText(lang, "持续跟进", "Persistent"),
        trendPath: projectIndex % 2 === 0 ? "M1 18 L18 18 L36 10 L52 10 L71 2" : "M1 18 L24 13 L42 10 L58 6 L71 4",
        dailyGrowthLabel: uiText(lang, "趋势角色", "Trend Role"),
        badgeLabel: readableText(project.watchlist_note_cn, ui.none),
      };
    }),
  }));

  const watchpoints: WeeklyViewProps["watchpoints"] = [
    ...coreCards.flatMap((card, index) =>
      card.worth_following_next_week
        ? [{
            key: `core-${card.trend_key}-${index}`,
            tone: "core" as const,
            badge: uiText(lang, "趋势观察", "Trend Watch"),
            title: readableText(card.trend_name_cn, titleFallback),
            body: readableText(card.worth_following_next_week, ui.none),
          }]
        : [],
    ),
    ...weakSignalCards.flatMap((card, index) =>
      card.worth_following_next_week
        ? [{
            key: `weak-${card.trend_key}-${index}`,
            tone: "weak" as const,
            badge: uiText(lang, "弱信号观察", "Weak Watch"),
            title: readableText(card.signal_name_cn, uiText(lang, "弱信号", "Weak Signal")),
            body: readableText(card.worth_following_next_week, ui.none),
          }]
        : [],
    ),
  ];

  const weakSignals: WeeklyViewProps["weakSignals"] = weakSignalCards.map((card, index) => ({
    key: `${card.trend_key}-${index}`,
    badge: uiText(lang, "弱信号观察", "Weak Signal"),
    title: readableText(card.signal_name_cn, uiText(lang, "弱信号", "Weak Signal")),
    body: readableText(card.why_weak_cn, ui.none),
    evidence: readableText(card.evidence_summary_cn, ui.none),
  }));

  return {
    lang,
    productName: ui.productName,
    navItems: [
      { label: ui.navOverview, href: toViewHref("overview", lang, theme, { date: dailyDate }), active: false },
      { label: ui.navProjects, href: toViewHref("projects", lang, theme, { date: dailyDate }), active: false },
      { label: ui.navWeekly, href: toViewHref("weekly", lang, theme, { date: dailyDate, anchor: activeAnchor }), active: true },
      { label: ui.navRunHealth, href: toViewHref("run-health", lang, theme, { date: dailyDate }), active: false },
      { label: uiText(lang, "新兴潜力项目", "Observer"), href: toViewHref("observer", lang, theme, { date: dailyDate }), active: false },
    ],
    languageLabel: ui.langLabel,
    languageOptions: [
      { label: ui.langZh, href: updateUrlSearch(requestUrl, { lang: "zh" }), active: lang === "zh" },
      { label: ui.langEn, href: updateUrlSearch(requestUrl, { lang: "en" }), active: lang === "en" },
    ],
    themeLabel: uiText(lang, "主题", "Theme"),
    themeOptions: [
      { label: uiText(lang, "浅色", "Light"), href: updateUrlSearch(requestUrl, { theme: "light" }), active: theme === "light" },
      { label: uiText(lang, "深色", "Dark"), href: updateUrlSearch(requestUrl, { theme: "dark" }), active: theme === "dark" },
    ],
    initialTheme: theme,
    pageBadge: uiText(lang, "本周趋势", "Weekly Holographic Deck"),
    pageHint: uiText(lang, "把这周的重要变化整理成一页趋势总结", "Multi-source convergence · Trend lock"),
    heroTitle: readableText(matrix?.focused_trend_name_cn ?? focusedTrend?.trend_name_cn, titleFallback),
    heroSummary: readableText(model.overall_judgment ?? snapshot?.markdown.overall_summary_cn, summaryFallback),
    activeWeekLabel: uiText(lang, `周度截面 ${activeAnchor}`, `Weekly slice ${activeAnchor}`),
    previousWeekLabel: uiText(lang, `周度截面 ${previousAnchor}`, `Weekly slice ${previousAnchor}`),
    activeWeekHref: toViewHref("weekly", lang, theme, { date: dailyDate, anchor: activeAnchor }),
    previousWeekHref: toViewHref("weekly", lang, theme, { date: dailyDate, anchor: previousAnchor }),
    previousWeekNavHref: previousNavAnchor ? toViewHref("weekly", lang, theme, { date: dailyDate, anchor: previousNavAnchor }) : null,
    nextWeekNavHref: nextAnchor ? toViewHref("weekly", lang, theme, { date: dailyDate, anchor: nextAnchor }) : null,
    briefingEyebrow: uiText(lang, "本周简报", "Executive Briefing"),
    briefingTitle: uiText(lang, "本周重点趋势总结", "Weekly Technical Judgment"),
    briefingBody: readableText(model.overall_judgment ?? snapshot?.markdown.overall_summary_cn, summaryFallback)
      .split(/(?<=[。？！!?])\s+/)
      .filter(Boolean)
      .slice(0, 3),
    telemetryLabel: uiText(lang, "本周观察摘要", "Weekly Snapshot"),
    telemetryWindowLabel: uiText(lang, "观测区间", "Observation Window"),
    telemetryWindowValue: weeklyWindowLabel,
    telemetryStatusLabel: "Status",
    telemetryStatusValue: snapshot?.audit_status === "ok" ? uiText(lang, "已校验并签署", "Verified & Signed") : uiText(lang, "缺少审计", "Audit Missing"),
    matrixEyebrow: uiText(lang, "证据矩阵", "Evidence Matrix"),
    matrixTitle: uiText(lang, "为什么会得出这个判断", "Why This Trend Emerged"),
    matrixSubtitle: uiText(lang, "选中趋势", "Focused Trend"),
    matrixModeLabel: uiText(lang, "六项判断", "6 Signals"),
    matrixEmptyTitle: uiText(lang, "证据矩阵未激活", "Evidence Matrix Is Idle"),
    matrixEmptyBody: uiText(lang, "当前周报缺少可投影的矩阵轴，请先阅读趋势摘要。", "The current weekly artifact does not expose a usable matrix yet."),
    watchpointEyebrow: uiText(lang, "持续观察", "Watch Next"),
    watchpointTitle: uiText(lang, "接下来还要看什么", "What To Follow Next"),
    trendStageEyebrow: uiText(lang, "本周已形成的趋势", "Confirmed Trends"),
    trendStageMeta: uiText(lang, "本周已经比较明确的方向", "Directions already visible this week"),
    trendCountLabel: uiText(lang, `${trends.length} 个方向已加载`, `${trends.length} directions loaded`),
    trendSummaryTitle: uiText(lang, "趋势关联支撑项目", "Trend-linked Projects"),
    noProjectsLabel: uiText(lang, "当前趋势还没有附带可展开项目。", "This trend does not include expandable projects yet."),
    radarLinkLabel: uiText(lang, "雷达透视", "Radar Perspective"),
    weakSignalBadgeLabel: uiText(lang, "观察带", "Observing Strip"),
    weeklyMemoTitle: uiText(lang, "Agent 审计结论", "Agent Audit Conclusion"),
    weeklyMemoBody: readableText(snapshot?.markdown.overall_summary_cn, summaryFallback),
    watchpointsTitle: uiText(lang, "下周继续跟进", "Follow Next Week"),
    watchpointsEmptyLabel: uiText(lang, "当前没有额外待跟进观察点。", "There are no extra watchpoints in the current weekly slice."),
    weakSignalsTitle: uiText(lang, "待观察趋势", "Observing Trends"),
    weakSignalsEmptyLabel: uiText(lang, "当前没有单独列出的弱信号。", "No explicit weak signals right now."),
    drawerModuleLabel: uiText(lang, "研判档案舱", "Dossier Module"),
    drawerProjectArchitectureLabel: uiText(lang, "项目架构描述", "Project Architecture"),
    drawerEvaluationEvidenceLabel: uiText(lang, "评估证据", "Evaluation Evidence"),
    drawerIdentityLabel: ui.projectIdentity,
    drawerDailyGrowthLabel: uiText(lang, "趋势角色", "Trend Role"),
    drawerParadigmLabel: ui.paradigm,
    drawerPersistenceLabel: ui.persistence,
    drawerKnowledgeLabel: ui.kbPreview,
    noneLabel: ui.none,
    trends,
    weakSignals,
    watchpoints,
    initialTrendKey: requestUrl.searchParams.get("trend_key") ?? requestUrl.searchParams.get("trend-key") ?? trends[0]?.key ?? null,
    initialProjectKey: requestUrl.searchParams.get("project") ?? null,
    drawerProjects,
  };
}

function renderWeeklyPage(model: WeeklyViewModel, requestUrl: URL, lang: UiLang, theme: UiTheme): string {
  return `
    <div id="weekly-react-root" data-react-weekly="true">
      ${renderToStaticMarkup(createElement(WeeklyView, buildWeeklyReactProps(model, requestUrl, lang, theme)))}
    </div>
  `;
}

function renderRunHealthPage(model: RunHealthViewModel, lang: UiLang): string {
  return `
    <div id="run-health-react-root" data-react-run-health="true">
      ${renderToStaticMarkup(createElement(RunHealthView, buildRunHealthReactProps(model, lang)))}
    </div>
  `;
}

function renderCoverageEntries(entries: DirectionCoverageStatus[]): string {
  return entries.map((entry) => `
    <div class="plain-list-item">
      <strong>${escapeHtml(entry.display_name_cn)} <span class="mini-code">${escapeHtml(entry.direction_key)}</span></strong>
      <p>outcome=${escapeHtml(entry.outcome)} pressure=${escapeHtml(entry.pressure_state)} target=${escapeHtml(String(entry.quantity_target_met))}</p>
      <p>${escapeHtml(entry.explanation_cn)}</p>
    </div>
  `).join("") || `<div class="plain-list-item">coverage atlas missing</div>`;
}

function renderGapEntries(entries: DirectionGapLedgerEntry[]): string {
  return entries.map((entry) => `
    <div class="plain-list-item">
      <strong>${escapeHtml(entry.display_name_cn)} <span class="mini-code">${escapeHtml(entry.direction_key)}</span></strong>
      <p>outcome=${escapeHtml(entry.outcome)} exhausted=${escapeHtml(String(entry.search_exhausted))}</p>
      <p>${escapeHtml(entry.explanation_cn)}</p>
    </div>
  `).join("") || `<div class="plain-list-item">gap ledger missing</div>`;
}

function buildObserverReactPropsLegacy(model: ObserverViewModel, requestUrl: URL, lang: UiLang, theme: UiTheme): ObserverViewProps {
  const ui = copy(lang);
  const artifact = model.artifact;
  const entries: ObserverViewProps["entries"] = (artifact?.entries ?? []).map((entry) => {
    const repoKey = observerEntryKey(entry.repo_full_name);
    return {
      key: repoKey,
      repoFullName: entry.repo_full_name,
      projectHref: toViewHref("projects", lang, theme, {
        date: model.context.selected_date ?? requestUrl.searchParams.get("date") ?? "latest",
        project: entry.repo_full_name,
        source_view: "observer",
      }),
      repoUrl: entry.repo_url,
      radarScore: entry.observer_score ?? 0,
      baseObserverScore: entry.base_observer_score ?? entry.observer_score ?? 0,
      trendPath: buildObserverTrendPathFromScores(
        entry.observer_score ?? 0,
        entry.base_observer_score ?? entry.observer_score ?? 0,
        entry.stars ?? 0,
        entry.historical_precision_score ?? 0,
      ),
      stars: entry.stars ?? 0,
      forks: entry.forks ?? 0,
      issues: entry.issues ?? 0,
      prs: entry.PR ?? 0,
      attentionReason: entry.long_tail_reason ?? "ecosystem-signal",
      freshnessTag: entry.freshness_label ?? entry.breakout_label ?? "context-window",
      hostLevel: entry.entity_tier ?? "none",
      historyHit: entry.historical_precision_label ?? "none",
      qualification: entry.position_qualification ?? "keep-observing",
      observedAt: formatCompactDateTime(entry.observed_at),
      summarySource: entry.summary_source ?? "template_fallback",
      judgeSource: entry.judge_source ?? "rules-only",
      judgeDelta: formatObserverJudgeDelta(entry.judge_score_delta),
      whyItMatters: readableText(
        entry.project_brief_cn ?? entry.description,
        lang === "zh" ? "摘要暂未补齐，先保留在观察池中。" : "Summary is still being consolidated for this observer candidate.",
      ),
      whyNow: readableText(
        entry.why_now_cn,
        lang === "zh" ? "当前时效性理由仍在补充，先继续观察。" : "Why-now evidence is still being consolidated.",
      ),
      verdict: readableText(
        entry.position_rationale_cn,
        lang === "zh" ? "当前仍需更多跨源确认与持续活跃度信号。" : "This candidate still needs more cross-source confirmation and sustained activity.",
      ),
      recommendation: readableText(
        entry.watch_next_cn,
        lang === "zh" ? "继续观察 README 更新频率、版本节奏和跨源命中变化。" : "Keep monitoring release cadence, README updates, and cross-source hits.",
      ),
      ecosystems: entry.ecosystems ?? [],
      labels: entry.labels ?? [],
      pedigreeTokens: uniqueObserverStrings([
        ...(entry.pedigree?.builders.map((value) => `builder:${value}`) ?? []),
        ...(entry.pedigree?.companies.map((value) => `company:${value}`) ?? []),
        ...(entry.pedigree?.engineers.map((value) => `engineer:${value}`) ?? []),
      ]),
      keywords: entry.matched_by.keywords ?? [],
      topics: entry.matched_by.topic_hints ?? [],
      repoSeeds: entry.matched_by.repo_seeds ?? [],
      orgSeeds: entry.matched_by.org_seeds ?? [],
      searchOrganizations: uniqueObserverStrings([entry.repo_full_name.split("/")[0] ?? "", ...(entry.pedigree?.companies ?? [])]),
      searchText: uniqueObserverStrings([
        entry.repo_full_name,
        entry.repo_url,
        entry.description ?? "",
        entry.project_brief_cn ?? "",
        entry.why_now_cn ?? "",
        entry.position_rationale_cn ?? "",
        entry.watch_next_cn ?? "",
      ]).join(" "),
    };
  });

  const requestedCandidateKey = observerEntryKey(requestUrl.searchParams.get("candidate") ?? "");
  const initialSelectedKey = entries.some((entry) => entry.key === requestedCandidateKey) ? requestedCandidateKey : entries[0]?.key ?? null;

  return {
    lang,
    initialTheme: theme,
    pageBadge: uiText(lang, "新兴潜力项目", "Long-tail Watch"),
    pageTitle: uiText(lang, "待观察项目", "Long-tail Watch"),
    pageSummary: uiText(
      lang,
      "这里保留主仓库的观察带展示层，用来浏览研究机构、创业公司、大厂团队和开源社区里仍在发酵的新项目。", "This keeps the main observer display layer for emerging projects that are still early but worth watching.",
    ),
    pageSummaryCaption: "",
    searchLabel: uiText(lang, "搜索项目", "Search Projects"),
    searchPlaceholder: uiText(lang, "搜索项目、仓库、公司名或方向词", "Search projects, repos, companies, or themes"),
    searchSuggestionsLabel: uiText(lang, "系统建议", "Suggestions"),
    searchSuggestions: deriveObserverSearchSuggestions(entries),
    searchExamples: OBSERVER_SEARCH_EXAMPLES,
    searchHelperBody: uiText(lang, "可以搜项目名、仓库名、公司名，或方向词。", "Search by project, repo, company, or direction words."),
    searchEmptyTitle: uiText(lang, "没有命中当前检索条件的观察项目", "No observer candidates match the current filter"),
    searchEmptyBody: uiText(lang, "可以尝试缩短关键词，或切回生态与种子维度继续浏览。", "Try a shorter query or switch back to ecosystems and seeds."),
    detailEmptyTitle: uiText(lang, "右侧观察舱已折叠", "The observer cabin is collapsed"),
    detailEmptyBody: uiText(lang, "点击左侧任意候选卡片即可重新打开详情。", "Select any candidate card on the left to reopen the detail cabin."),
    telemetryStatusLabel: uiText(lang, "状态", "Status"),
    telemetryStatusValue: artifact?.status ?? "missing",
    telemetryGeneratedAtLabel: ui.generatedAt,
    telemetryGeneratedAtValue: formatCompactDateTime(artifact?.generated_at),
    telemetryModeLabel: uiText(lang, "增强模式", "Enhancement Mode"),
    telemetryModeValue: model.banner.mode_label,
    telemetrySourceHealthLabel: uiText(lang, "源健康度", "Source Health"),
    telemetrySourceHealthValue: model.banner.source_health,
    telemetryCandidateCountLabel: uiText(lang, "候选数", "Candidates"),
    telemetryCandidateCountValue: String(entries.length),
    telemetryEcosystemCountLabel: uiText(lang, "生态数", "Ecosystems"),
    telemetryEcosystemCountValue: String(Object.keys(artifact?.ecosystem_counts ?? {}).length),
    guidanceJudgeLabel: uiText(lang, "为什么它在这里", "Watch Heuristic"),
    guidanceJudgeBody: uiText(lang, "这些项目还没形成稳定共识，但已经出现值得继续观察的信号。", "These projects have promising signals but not enough consensus for the main board yet."),
    guidanceLinkageLabel: uiText(lang, "怎么查看详情", "Dock Linkage"),
    guidanceLinkageBody: uiText(lang, "点击左侧候选项目，会在右侧固定打开详情。", "Selecting a candidate opens the sticky cabin on the right."),
    detailStageLabel: uiText(lang, "项目观察详情", "Observer Detail Cabin"),
    detailStageStatus: uiText(lang, "观察中", "Observing"),
    closeLabel: ui.close,
    openProjectLabel: uiText(lang, "项目详情", "Project Detail"),
    openRepositoryLabel: uiText(lang, "访问仓库", "Open Repository"),
    keepTrackingLabel: uiText(lang, "加入持续追踪", "Keep Tracking"),
    keepTrackingActiveLabel: uiText(lang, "已加入持续追踪", "Tracking Active"),
    observerScoreLabel: uiText(lang, "项目潜力估计", "Observer Score"),
    watchReasonLabel: uiText(lang, "关注理由", "Watch Reason"),
    freshnessLabel: uiText(lang, "新鲜度", "Freshness"),
    tierLabel: uiText(lang, "层级", "Pedigree"),
    historyLabel: uiText(lang, "历史命中", "History"),
    whyNowTitle: uiText(lang, "为什么现在值得看", "Why Now"),
    positionTitle: uiText(lang, "当前判断和建议", "Current Judgment"),
    recommendationTitle: uiText(lang, "观察建议", "Watch Next"),
    semanticSignalsTitle: uiText(lang, "相关线索", "Signals"),
    semanticSignalsHint: uiText(lang, "这里把关键词、主题和来源线索压缩在一起，方便快速判断是否继续观察。", "Keywords, topics, and seed evidence are grouped here for faster judgment."),
    pedigreeLabel: uiText(lang, "谱系", "Pedigree"),
    keywordsLabel: uiText(lang, "关键词", "Keywords"),
    topicsLabel: uiText(lang, "主题", "Topics"),
    repoSeedsLabel: uiText(lang, "仓库种子", "Repo Seeds"),
    orgSeedsLabel: uiText(lang, "组织种子", "Org Seeds"),
    ecosystemsLabel: uiText(lang, "命中生态", "Matched Ecosystems"),
    labelsLabel: uiText(lang, "观察标签", "Watch Labels"),
    summarySourceLabel: uiText(lang, "摘要来源", "Summary Source"),
    judgeSourceLabel: uiText(lang, "瑁佸喅鏉ユ簮", "Judgment Source"),
    observedAtLabel: uiText(lang, "观察时间", "Observed At"),
    judgeDeltaLabel: uiText(lang, "判断增量", "Judgment Delta"),
    notes: model.banner.notes,
    ecosystemBadges: Object.entries(artifact?.ecosystem_counts ?? {}).map(([name, count]) => `${name}: ${count}`),
    entries,
    initialSelectedKey,
  };
}

export function buildObserverReactProps(model: ObserverViewModel, requestUrl: URL, lang: UiLang, theme: UiTheme): ObserverViewProps {
  const ui = copy(lang);
  const artifact = model.artifact;
  const primaryEntries: ObserverViewProps["entries"] = (artifact?.entries ?? []).map((entry) => {
    const repoKey = observerEntryKey(entry.repo_full_name);
    return {
      key: repoKey,
      repoFullName: entry.repo_full_name,
      projectHref: toViewHref("projects", lang, theme, {
        date: model.context.selected_date ?? requestUrl.searchParams.get("date") ?? "latest",
        project: entry.repo_full_name,
        source_view: "observer",
      }),
      repoUrl: entry.repo_url,
      isTracked: false,
      radarScore: entry.observer_score ?? 0,
      baseObserverScore: entry.base_observer_score ?? entry.observer_score ?? 0,
      trendPath: buildObserverTrendPathFromScores(
        entry.observer_score ?? 0,
        entry.base_observer_score ?? entry.observer_score ?? 0,
        entry.stars ?? 0,
        entry.historical_precision_score ?? 0,
      ),
      stars: entry.stars ?? 0,
      forks: entry.forks ?? 0,
      issues: entry.issues ?? 0,
      prs: entry.PR ?? 0,
      attentionReason: entry.long_tail_reason ?? "ecosystem-signal",
      freshnessTag: entry.freshness_label ?? entry.breakout_label ?? "context-window",
      hostLevel: entry.entity_tier ?? "none",
      historyHit: entry.historical_precision_label ?? "none",
      qualification: entry.position_qualification ?? "keep-observing",
      observedAt: formatCompactDateTime(entry.observed_at),
      summarySource: entry.summary_source ?? "template_fallback",
      judgeSource: entry.judge_source ?? "rules-only",
      judgeDelta: formatObserverJudgeDelta(entry.judge_score_delta),
      whyItMatters: readableText(
        entry.project_brief_cn ?? entry.description,
        lang === "zh" ? "摘要暂未补齐，先保留在观察池中。" : "Summary is still being consolidated for this observer candidate.",
      ),
      whyNow: readableText(
        entry.why_now_cn,
        lang === "zh" ? "当前时效性理由仍在补充，先继续观察。" : "Why-now evidence is still being consolidated.",
      ),
      verdict: readableText(
        entry.position_rationale_cn,
        lang === "zh" ? "当前仍需更多跨源确认与持续活跃度信号。" : "This candidate still needs more cross-source confirmation and sustained activity.",
      ),
      recommendation: readableText(
        entry.watch_next_cn,
        lang === "zh" ? "继续观察 README 更新频率、版本节奏和跨源命中变化。" : "Keep monitoring release cadence, README updates, and cross-source hits.",
      ),
      ecosystems: entry.ecosystems ?? [],
      labels: entry.labels ?? [],
      pedigreeTokens: uniqueObserverStrings([
        ...(entry.pedigree?.builders.map((value) => `builder:${value}`) ?? []),
        ...(entry.pedigree?.companies.map((value) => `company:${value}`) ?? []),
        ...(entry.pedigree?.engineers.map((value) => `engineer:${value}`) ?? []),
      ]),
      keywords: entry.matched_by.keywords ?? [],
      topics: entry.matched_by.topic_hints ?? [],
      repoSeeds: entry.matched_by.repo_seeds ?? [],
      orgSeeds: entry.matched_by.org_seeds ?? [],
      searchOrganizations: uniqueObserverStrings([entry.repo_full_name.split("/")[0] ?? "", ...(entry.pedigree?.companies ?? [])]),
      searchText: uniqueObserverStrings([
        entry.repo_full_name,
        entry.repo_url,
        entry.description ?? "",
        entry.project_brief_cn ?? "",
        entry.why_now_cn ?? "",
        entry.position_rationale_cn ?? "",
        entry.watch_next_cn ?? "",
      ]).join(" "),
    };
  });
  const entries = [
    ...primaryEntries,
    ...buildSupplementObserverEntries(
      model.context.selected_date ?? requestUrl.searchParams.get("date") ?? "latest",
      lang,
      theme,
      new Set(primaryEntries.map((entry) => entry.key)),
    ),
  ];

  const requestedCandidateKey = observerEntryKey(requestUrl.searchParams.get("candidate") ?? "");
  const initialSelectedKey = entries.some((entry) => entry.key === requestedCandidateKey) ? requestedCandidateKey : entries[0]?.key ?? null;
  const combinedEcosystemCounts = entries.reduce<Record<string, number>>((accumulator, entry) => {
    for (const ecosystem of entry.ecosystems) {
      accumulator[ecosystem] = (accumulator[ecosystem] ?? 0) + 1;
    }
    return accumulator;
  }, {});

  return {
    lang,
    initialTheme: theme,
    pageBadge: uiText(lang, "新兴潜力项目", "Long-tail Watch"),
    pageTitle: uiText(lang, "待观察项目", "Long-tail Watch"),
    pageSummary: uiText(
      lang,
      "这里用来观察来自研究机构、创业公司、大厂团队、开源社区和独立开发者的新兴项目，尤其是那些还没完全火起来、但已经显出潜力的方向。", "Projects Worth Watching Beyond The Mainstream",
    ),
    pageSummaryCaption: uiText(
      lang,
      "这些项目会先放在这里持续观察，等理由更充分、信号更稳定后，它们才会进入重点列表。", "These projects stay here until the reasons to watch them become clearer and the signals hold up.",
    ),
    searchLabel: uiText(lang, "搜索项目", "Search Projects"),
    searchPlaceholder: uiText(lang, "搜索项目、仓库、公司名或方向词", "Search projects, repos, companies, or directions"),
    searchSuggestionsLabel: uiText(lang, "系统建议", "Suggestions"),
    searchSuggestions: deriveObserverSearchSuggestions(entries),
    searchExamples: OBSERVER_SEARCH_EXAMPLES,
    searchHelperBody: uiText(
      lang,
      "可以搜项目名、仓库名、公司名，或者方向词。比如：claw、memory agent、openai sdk。输入后会同时匹配名称、摘要和生态标签。",
      "Search by project, repo, company, or direction words. For example: claw, memory agent, openai sdk. Matches names, summaries, and ecosystem tags together.",
    ),
    searchEmptyTitle: uiText(lang, "没有命中当前检索条件的长尾候选", "No long-tail candidates match the current filter"),
    searchEmptyBody: uiText(lang, "可以尝试缩短关键词，或退回到生态与种子维度继续浏览。", "Try a shorter query or fall back to ecosystem and seed terms."),
    detailEmptyTitle: uiText(lang, "右侧观察舱已折叠", "The diagnostic cabin is temporarily collapsed"),
    detailEmptyBody: uiText(lang, "点击左侧任意候选卡片，即可重新打开粘性诊断舱。", "Select any candidate card on the left to reopen the sticky diagnostic cabin."),
    telemetryStatusLabel: uiText(lang, "状态", "Status"),
    telemetryStatusValue: artifact?.status ?? "missing",
    telemetryGeneratedAtLabel: ui.generatedAt,
    telemetryGeneratedAtValue: formatCompactDateTime(artifact?.generated_at),
    telemetryModeLabel: uiText(lang, "增强模式", "Enhancement Mode"),
    telemetryModeValue: model.banner.mode_label,
    telemetrySourceHealthLabel: uiText(lang, "源健康度", "Source Health"),
    telemetrySourceHealthValue: model.banner.source_health,
    telemetryCandidateCountLabel: uiText(lang, "候选数", "Candidates"),
    telemetryCandidateCountValue: String(entries.length),
    telemetryEcosystemCountLabel: uiText(lang, "生态数", "Ecosystems"),
    telemetryEcosystemCountValue: String(Object.keys(combinedEcosystemCounts).length),
    guidanceJudgeLabel: uiText(lang, "为什么它在这里", "Watch Heuristic"),
    guidanceJudgeBody: uiText(lang, "这些项目还没形成稳定共识，但已经出现值得继续观察的信号。", "These projects have promising signals but not enough consensus for the main board yet."),
    guidanceLinkageLabel: uiText(lang, "怎么查看详情", "Dock Linkage"),
    guidanceLinkageBody: uiText(lang, "点击左侧候选项目，会在右侧固定打开详情。", "Selecting a candidate opens the sticky cabin on the right."),
    detailStageLabel: uiText(lang, "项目观察详情", "Observer Detail Cabin"),
    detailStageStatus: uiText(lang, "观察中", "Observing"),
    closeLabel: ui.close,
    openProjectLabel: uiText(lang, "项目详情", "Project Detail"),
    openRepositoryLabel: uiText(lang, "访问仓库", "Open Repository"),
    keepTrackingLabel: uiText(lang, "加入持续追踪", "Keep Tracking"),
    keepTrackingActiveLabel: uiText(lang, "已加入持续追踪", "Tracking Active"),
    observerScoreLabel: uiText(lang, "项目潜力估计", "Observer Score"),
    watchReasonLabel: uiText(lang, "关注理由", "Watch Reason"),
    freshnessLabel: uiText(lang, "新鲜度", "Freshness"),
    tierLabel: uiText(lang, "层级", "Pedigree"),
    historyLabel: uiText(lang, "历史命中", "History"),
    whyNowTitle: uiText(lang, "为什么现在值得看", "Why Now"),
    positionTitle: uiText(lang, "当前判断和建议", "Current Judgment"),
    recommendationTitle: uiText(lang, "观察建议", "Watch Next"),
    semanticSignalsTitle: uiText(lang, "相关线索", "Signals"),
    semanticSignalsHint: uiText(lang, "这里把关键词、主题和来源线索压缩在一起，方便快速判断是否继续观察。", "Keywords, topics, and seed evidence are grouped here for faster judgment."),
    pedigreeLabel: uiText(lang, "谱系", "Pedigree"),
    keywordsLabel: uiText(lang, "关键词", "Keywords"),
    topicsLabel: uiText(lang, "主题", "Topics"),
    repoSeedsLabel: uiText(lang, "仓库种子", "Repo Seeds"),
    orgSeedsLabel: uiText(lang, "组织种子", "Org Seeds"),
    ecosystemsLabel: uiText(lang, "命中生态", "Matched Ecosystems"),
    labelsLabel: uiText(lang, "观察标签", "Watch Labels"),
    summarySourceLabel: uiText(lang, "摘要来源", "Summary Source"),
    judgeSourceLabel: uiText(lang, "判断来源", "Judgment Source"),
    observedAtLabel: uiText(lang, "观察时间", "Observed At"),
    judgeDeltaLabel: uiText(lang, "判断增量", "Judgment Delta"),
    notes: model.banner.notes,
    ecosystemBadges: Object.entries(combinedEcosystemCounts).map(([name, count]) => `${name}: ${count}`),
    entries,
    initialSelectedKey,
  };
}

function renderObserverPage(model: ObserverViewModel, requestUrl: URL, lang: UiLang, theme: UiTheme): string {
  return `
    <div id="observer-react-root" data-react-observer="true">
      ${renderToStaticMarkup(createElement(ObserverView, buildObserverReactProps(model, requestUrl, lang, theme)))}
    </div>
  `;
}

function renderKnowledgeBasePage(model: KnowledgeBaseViewModel, requestUrl: URL, lang: UiLang, theme: UiTheme): string {
  const ui = copy(lang);
  const selected = model.selected_card;
  const ribbonHtml = selected
    ? `<div class="metric-grid"><article class="metric-card"><span class="metric-label">${escapeHtml(ui.kbReader)}</span><strong class="metric-value">${escapeHtml(selected.project_name)}</strong></article><article class="metric-card"><span class="metric-label">${escapeHtml(ui.generatedAt)}</span><strong class="metric-value">${escapeHtml(formatCompactDateTime(selected.updated_at))}</strong></article></div>`
    : undefined;
  const indexHtml = `
    <div class="project-list">
      ${(model.index ?? []).map((card) => renderKbIndexItem(card, requestUrl, lang, theme, selected?.project_name === card.project_name)).join("") || `<div class="dock-placeholder">${escapeHtml(ui.noKb)}</div>`}
    </div>
  `;
  const dockBody = selected
    ? renderKbDetail(selected)
    : `<div class="dock-placeholder">${escapeHtml(ui.noKb)}</div>`;

  return renderKnowledgeBaseRoute({
    hasDetail: Boolean(selected),
    ribbonHtml,
    indexHtml,
    dockHtml: dockBody,
    detailAriaLabel: ui.kbReader,
    detailKey: selected ? selected.project_name : "empty-kb",
    inlineFocusHtml: selected ? renderKbDetail(selected) : `<div class="dock-placeholder">${escapeHtml(ui.noKb)}</div>`,
    emptyReaderHtml: `<div class="dock-placeholder">${escapeHtml(ui.noKb)}</div>`,
    emptyDockHtml: `<div class="dock-placeholder">${escapeHtml(ui.noKb)}</div>`,
  });
}

function renderKbIndexItem(card: KnowledgeCard, requestUrl: URL, lang: UiLang, theme: UiTheme, selected: boolean): string {
  return `
    <a class="project-list-item ${selected ? "is-active" : ""}" href="${escapeHtml(toViewHref("kb", lang, theme, { date: requestUrl.searchParams.get("date") || "latest", slug: slugify(card.project_name) }))}">
      <span class="eyebrow">${escapeHtml(card.paradigm)}</span>
      <h3>${escapeHtml(card.project_name)}</h3>
      <div class="project-meta">
        <span>${escapeHtml(card.repo_url)}</span>
        <span>${escapeHtml(formatCompactDateTime(card.updated_at))}</span>
      </div>
    </a>
  `;
}

function renderKbDetail(card: KnowledgeBaseViewModel["selected_card"]): string {
  if (!card) return "";
  return `
    <section class="reader-card">
      <div class="section-header">
        <h2>${escapeHtml(card.project_name)}</h2>
        <span class="mini-code">${escapeHtml(card.paradigm)}</span>
      </div>
      <div class="kb-reader-copy">
        <p><a href="${escapeHtml(card.repo_url)}" target="_blank" rel="noreferrer">${escapeHtml(card.repo_url)}</a></p>
        ${card.sections.machine_sections.map((section) => `<p><strong>${escapeHtml(section.title)}:</strong> ${escapeHtml(section.body.join(" "))}</p>`).join("")}
        ${card.sections.human_sections.map((section) => `<p><strong>${escapeHtml(section.title)}:</strong> ${escapeHtml(section.body.join(" "))}</p>`).join("")}
      </div>
    </section>
  `;
}


