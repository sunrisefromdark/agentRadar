import React, { useEffect, useRef, useState } from "react";

type NavItem = {
  label: string;
  href: string;
  active: boolean;
};

type ToggleOption = {
  label: string;
  href: string;
  active: boolean;
};

type WorkspaceSection = "signals" | "decisions" | "watchlist" | "sources";
type WorkspaceRailSection = Exclude<WorkspaceSection, "signals">;

type OverviewProject = {
  repoFullName: string;
  radarScore: number;
  recommendationText: string;
  dailyGrowth: number;
  trendPath: string;
  descriptionText: string;
  selectionReasonText: string;
  paradigmLongText: string | null;
  persistenceLabel: string;
  detailBadge: string;
  detailBody: string;
  signalText: string;
  href: string;
};

type DecisionCard = {
  key: string;
  href: string;
  title: string;
  confidenceBadgeHtml: string;
  sparklineHtml: string;
  scoreBadgeHtml: string;
  reason: string;
};

type SourceCard = {
  key: string;
  source: string;
  statusBadgeHtml: string;
  metaPairsHtml: string;
  itemCount?: number;
  status?: string;
};

type SelectedProjectState = {
  key: string;
  title: string;
  repoFullName: string;
  href: string;
  detailBadge: string;
  detailBody: string;
  radarScoreLabel: string;
  persistenceLabel: string;
  paradigmLabel: string;
  dailyGrowth: number;
  descriptionText: string;
  selectionReasonText: string;
  trendPath: string;
};

type DecisionMatrixItem = {
  key: string;
  href: string;
  title: string;
  reason: string;
  confidenceBadgeHtml: string;
  sparklineHtml: string;
  scoreBadgeHtml: string;
  detail: SelectedProjectState;
};

type RiskDiagnosticItem = {
  key: string;
  title: string;
  tone: "critical" | "warning";
  body: string;
  actionHref: string | null;
  actionLabel: string;
};

const OVERVIEW_DECISION_MATRIX_LIMIT = 4;

const WORKSPACE_RAIL_SECTIONS: WorkspaceRailSection[] = ["decisions", "watchlist", "sources"];

export type AppProps = {
  lang?: string;
  productName: string;
  navItems: NavItem[];
  languageLabel?: string;
  languageOptions?: ToggleOption[];
  themeLabel?: string;
  themeOptions: ToggleOption[];
  heroEyebrow: string;
  heroTitle: string;
  heroSummary: string;
  statusLine: string;
  runHealthLabel?: string;
  runHealthHref?: string;
  projectsLabel?: string;
  projectsHref?: string;
  topDecisionsLabel?: string;
  selectionReasonLabel?: string;
  nextActionsLabel?: string;
  prevLabel: string;
  nextLabel: string;
  readFirstLabel?: string;
  projectDetailLabel: string;
  initialTheme: "light" | "dark";
  initialSection: WorkspaceSection;
  noneLabel: string;
  signalSummaryLabel: string;
  signalPostureTitle: string;
  signalPostureBody: string;
  signalFreshnessHtml: string;
  signalMetaHtml: string;
  decisionsPanelLabel: string;
  decisionsPanelTitle: string;
  leadDecisionName: string | null;
  leadDecisionReason: string | null;
  leadDecisionHref: string | null;
  decisionCards: DecisionCard[];
  risksPanelLabel: string;
  risksPanelTitle: string;
  watchlistItems: string[];
  weeklyEntryLabel: string;
  weeklyPanelTitle: string;
  weeklySummary: string;
  weeklyHref: string | null;
  openWeeklyLabel: string;
  sourcesPanelLabel: string;
  sourcesPanelTitle: string;
  sourceCards: SourceCard[];
  riskDiagnostics?: RiskDiagnosticItem[];
  projects: OverviewProject[];
  githubStarLabel?: string;
  githubStarHref?: string;
  githubStarFormAction?: string | null;
  githubStarMode?: "direct" | "external";
  githubStarCsrfToken?: string;
  githubStarReturnTo?: string;
  githubStarStatusText?: string | null;
};

declare global {
  interface Window {
    __INITIAL_DATA__?: Partial<AppProps>;
  }
}

const DEFAULT_PROPS: AppProps = {
  productName: "Trend Radar",
  navItems: [],
  themeOptions: [
    { label: "Light", href: "#", active: true },
    { label: "Dark", href: "#", active: false },
  ],
  heroEyebrow: "",
  heroTitle: "",
  heroSummary: "",
  statusLine: "",
  prevLabel: "Prev",
  nextLabel: "Next",
  projectDetailLabel: "Project Detail",
  initialTheme: "light",
  initialSection: "signals",
  noneLabel: "none",
  signalSummaryLabel: "Signals",
  signalPostureTitle: "Signal Posture",
  signalPostureBody: "",
  signalFreshnessHtml: "",
  signalMetaHtml: "",
  decisionsPanelLabel: "Decisions",
  decisionsPanelTitle: "Decisions",
  leadDecisionName: null,
  leadDecisionReason: null,
  leadDecisionHref: null,
  decisionCards: [],
  risksPanelLabel: "Watchlist",
  risksPanelTitle: "Watchlist",
  watchlistItems: [],
  weeklyEntryLabel: "Weekly",
  weeklyPanelTitle: "Weekly",
  weeklySummary: "",
  weeklyHref: null,
  openWeeklyLabel: "Open Weekly",
  sourcesPanelLabel: "Sources",
  sourcesPanelTitle: "Sources",
  sourceCards: [],
  riskDiagnostics: [],
  projects: [],
  githubStarLabel: "⭐ Star on GitHub",
  githubStarHref: "https://github.com/sunrisefromdark/agentRadar",
  githubStarFormAction: null,
  githubStarMode: "external",
  githubStarCsrfToken: "",
  githubStarReturnTo: "",
  githubStarStatusText: null,
};

function readPayloadFromDom(): Partial<AppProps> | null {
  if (typeof document === "undefined") return null;
  const payloadNode = document.getElementById("overview-react-payload");
  if (!payloadNode?.textContent) return null;

  try {
    return JSON.parse(payloadNode.textContent) as Partial<AppProps>;
  } catch {
    return null;
  }
}

function readPayloadFromWindow(): Partial<AppProps> | null {
  if (typeof window === "undefined") return null;
  const payload = window.__INITIAL_DATA__;
  return payload && typeof payload === "object" ? payload : null;
}

export function parseOverviewAppPayload(): AppProps {
  const payload = readPayloadFromDom() ?? readPayloadFromWindow() ?? {};
  return {
    ...DEFAULT_PROPS,
    ...payload,
    navItems: payload.navItems ?? DEFAULT_PROPS.navItems,
    themeOptions: payload.themeOptions ?? DEFAULT_PROPS.themeOptions,
    decisionCards: payload.decisionCards ?? DEFAULT_PROPS.decisionCards,
    watchlistItems: payload.watchlistItems ?? DEFAULT_PROPS.watchlistItems,
    sourceCards: payload.sourceCards ?? DEFAULT_PROPS.sourceCards,
    riskDiagnostics: payload.riskDiagnostics ?? DEFAULT_PROPS.riskDiagnostics,
    projects: payload.projects ?? DEFAULT_PROPS.projects,
  };
}

function HtmlFragment(props: { html: string; className?: string }) {
  return <div className={props.className} dangerouslySetInnerHTML={{ __html: props.html }} />;
}

function Sparkline(props: { path: string; className?: string; stroke?: string }) {
  if (!props.path) return null;

  return (
    <svg className={props.className ?? "w-16 h-5"} viewBox="0 0 72 20" fill="none" aria-hidden="true" data-sparkline="true">
      <path d={props.path} stroke={props.stroke ?? "#6366f1"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeOverviewTab(value: WorkspaceSection): WorkspaceRailSection {
  return value === "watchlist" || value === "sources" ? value : "decisions";
}

function projectKeyFromHref(value: string): string {
  try {
    const url = new URL(value, "http://localhost");
    return decodeURIComponent(url.searchParams.get("project") ?? "").trim();
  } catch {
    return "";
  }
}

function extractSvgPathFromHtml(value: string): string {
  const match = value.match(/d="([^"]+)"/i);
  return match?.[1] ?? "";
}

function buildSelectedProjectFromOverviewProject(project: OverviewProject): SelectedProjectState {
  return {
    key: project.repoFullName,
    title: project.repoFullName,
    repoFullName: project.repoFullName,
    href: project.href,
    detailBadge: project.detailBadge,
    detailBody: project.detailBody,
    radarScoreLabel: String(project.radarScore),
    persistenceLabel: project.persistenceLabel,
    paradigmLabel: project.paradigmLongText ?? "n/a",
    dailyGrowth: project.dailyGrowth,
    descriptionText: project.descriptionText,
    selectionReasonText: project.selectionReasonText,
    trendPath: project.trendPath,
  };
}

function buildSelectedProjectFromDecisionCard(card: DecisionCard, projects: OverviewProject[]): SelectedProjectState {
  const projectFromHref = projectKeyFromHref(card.href);
  const matchedProject =
    projects.find((project) => project.repoFullName === projectFromHref)
    ?? projects.find((project) => project.repoFullName === card.title)
    ?? projects.find((project) => project.href === card.href)
    ?? null;

  if (matchedProject) return buildSelectedProjectFromOverviewProject(matchedProject);

  return {
    key: card.key,
    title: card.title,
    repoFullName: card.title,
    href: card.href,
    detailBadge: stripHtml(card.confidenceBadgeHtml) || "Follow-up Decision",
    detailBody: card.reason,
    radarScoreLabel: stripHtml(card.scoreBadgeHtml).replace(/^Score\s*/i, "").trim() || "n/a",
    persistenceLabel: "Watch",
    paradigmLabel: "agent-runtime",
    dailyGrowth: 0,
    descriptionText: card.reason,
    selectionReasonText: card.reason,
    trendPath: extractSvgPathFromHtml(card.sparklineHtml),
  };
}

function buildDecisionMatrixItems(app: AppProps): DecisionMatrixItem[] {
  if (app.decisionCards.length > 0) {
    return app.decisionCards.slice(0, OVERVIEW_DECISION_MATRIX_LIMIT).map((card) => ({
      key: card.key,
      href: card.href,
      title: card.title,
      reason: card.reason,
      confidenceBadgeHtml: card.confidenceBadgeHtml,
      sparklineHtml: card.sparklineHtml,
      scoreBadgeHtml: card.scoreBadgeHtml,
      detail: buildSelectedProjectFromDecisionCard(card, app.projects),
    }));
  }

  return app.projects.slice(0, OVERVIEW_DECISION_MATRIX_LIMIT).map((project) => ({
    key: project.repoFullName,
    href: project.href,
    title: project.repoFullName,
    reason: project.selectionReasonText,
    confidenceBadgeHtml: `<span class="badge badge-accent">${project.detailBadge}</span>`,
    sparklineHtml: `<svg class="w-14 h-4" viewBox="0 0 72 20" fill="none"><path d="${project.trendPath}" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
    scoreBadgeHtml: `<span class="badge badge-neutral">Score ${project.radarScore}</span>`,
    detail: buildSelectedProjectFromOverviewProject(project),
  }));
}

function buildRiskDiagnosticItems(app: AppProps): RiskDiagnosticItem[] {
  if ((app.riskDiagnostics?.length ?? 0) > 0) {
    return app.riskDiagnostics ?? [];
  }

  const isZh = app.lang !== "en";
  const primaryActionHref = app.leadDecisionHref ?? app.projects[0]?.href ?? app.projectsHref ?? null;
  const secondaryActionHref = app.projectsHref ?? app.leadDecisionHref ?? app.projects[0]?.href ?? null;
  const diagnostics = [
    {
      key: "primary",
      title: "Telemetry Alert",
      tone: "critical" as const,
      body: app.watchlistItems[0] ?? app.signalPostureBody ?? app.noneLabel,
      actionHref: primaryActionHref,
      actionLabel: app.projectDetailLabel,
    },
    {
      key: "secondary",
      title: "Metadata Deficiency",
      tone: "warning" as const,
      body:
        app.watchlistItems[1] ??
        (isZh
          ? "发现有潜在高优项目缺失关键英文描述及语义指标，建议在纳入主判断前先做批量补全与校验。"
          : "Potential high-priority items are missing key descriptions and semantic signals, so batch enrichment should happen before they affect the main judgment."),
      actionHref: secondaryActionHref,
      actionLabel: isZh ? "批量捕获" : "Batch Enrich",
    },
  ];

  return diagnostics.filter((item) => item.body.trim().length > 0);
}

function CompatibilityArtifacts(props: { app: AppProps }) {
  return (
    <div className="hidden" aria-hidden="true">
      <a href={props.app.projects[0]?.href ?? "#"} data-preserve-scroll="detail">
        {props.app.projectDetailLabel}
      </a>
    </div>
  );
}

type CoreDecisionCardProps = {
  item: DecisionMatrixItem;
  onOpen: (detail: SelectedProjectState) => void;
  trendLabel: string;
  detailLabel: string;
};

function CoreDecisionCard(props: CoreDecisionCardProps) {
  const { item, onOpen, trendLabel, detailLabel } = props;

  return (
    <article className="decision-card overview-decision-row">
      <div className="overview-decision-body">
        <div className="overview-decision-head">
          <button
            type="button"
            className="text-left transition-colors hover:text-indigo-500"
            onClick={() => onOpen(item.detail)}
          >
            {item.title}
          </button>
          <HtmlFragment html={item.scoreBadgeHtml} className="micro-row shrink-0" />
        </div>
        <p className="overview-decision-copy">{item.reason}</p>
      </div>

      <div className="overview-decision-footer">
        <div className="overview-decision-trend">
          <HtmlFragment html={item.sparklineHtml} className="micro-row" />
          <span className="overview-decision-trend-label">{trendLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => onOpen(item.detail)}
          className="overview-decision-link transition-all hover:underline"
        >
          <span>{detailLabel}</span>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </article>
  );
}

type SourceMonitorCardProps = {
  card: SourceCard;
  isZh: boolean;
};

function LegacySourceMonitorCard(props: SourceMonitorCardProps) {
  const isHealthy = props.card.status ? props.card.status === "active" : /active|ready|enabled|pass|yes/i.test(props.card.statusBadgeHtml);
  const volumeCount = typeof props.card.itemCount === "number" ? props.card.itemCount : 0;
  const stateLabel = isHealthy ? (props.isZh ? "正常" : "ACTIVE") : (props.isZh ? "观察" : "MONITOR");
  const flowLabel = isHealthy ? (props.isZh ? "链路在线" : "Pipeline Live") : (props.isZh ? "链路观察中" : "Pipeline Watch");
  const idLabel = props.isZh ? "编号" : "ID";
  const volumeLabel = props.isZh ? "文档量" : "VOLUME COUNT";
  const docsLabel = props.isZh ? "份" : "DOCS";
  const passLabel = isHealthy ? (props.isZh ? "通过" : "PASS") : (props.isZh ? "待检" : "FAIL");

  return (
    <article className="overview-source-card overview-reference-card">
      <div className="overview-source-card-top">
        <div className="overview-source-card-status">
          <div className="flex items-center gap-2">
            <span className="overview-source-card-dot"></span>
            <span className="overview-source-card-state">{stateLabel}</span>
          </div>
          <span className="overview-source-card-flow">{flowLabel}</span>
        </div>

        <div className="overview-source-card-identity">
          <h4>{props.card.source}</h4>
          <p>{idLabel}: data-pipeline-{props.card.key}</p>
        </div>
      </div>

      <div className="overview-source-card-footer">
        <div>
          <p className="overview-source-card-volume-label">{volumeLabel}</p>
          <div className="overview-source-card-volume">
            <span>{volumeCount}</span>
            <span>{docsLabel}</span>
          </div>
        </div>
        <div>
          <span className="overview-source-card-pass">{passLabel}</span>
        </div>
      </div>
    </article>
  );
}

function SourceMonitorCard(props: SourceMonitorCardProps) {
  const isHealthy = props.card.status ? props.card.status === "active" : /active|ready|enabled|pass|yes/i.test(props.card.statusBadgeHtml);
  const volumeCount = typeof props.card.itemCount === "number" ? props.card.itemCount : 0;
  const stateLabel = isHealthy ? (props.isZh ? "\u6b63\u5e38" : "ACTIVE") : (props.isZh ? "\u89c2\u5bdf" : "MONITOR");
  const flowLabel = isHealthy ? (props.isZh ? "\u94fe\u8def\u5728\u7ebf" : "Pipeline Live") : (props.isZh ? "\u94fe\u8def\u89c2\u5bdf\u4e2d" : "Pipeline Watch");
  const idLabel = props.isZh ? "\u7f16\u53f7" : "ID";
  const volumeLabel = props.isZh ? "\u6587\u6863\u91cf" : "VOLUME COUNT";
  const docsLabel = props.isZh ? "\u4efd" : "DOCS";
  const passLabel = isHealthy ? (props.isZh ? "\u901a\u8fc7" : "PASS") : (props.isZh ? "\u5f85\u68c0" : "FAIL");

  return (
    <article className="overview-source-card overview-reference-card">
      <div className="overview-source-card-top">
        <div className="overview-source-card-status">
          <div className="flex items-center gap-2">
            <span className="overview-source-card-dot"></span>
            <span className="overview-source-card-state">{stateLabel}</span>
          </div>
          <span className="overview-source-card-flow">{flowLabel}</span>
        </div>

        <div className="overview-source-card-identity">
          <h4>{props.card.source}</h4>
          <p>{idLabel}: data-pipeline-{props.card.key}</p>
        </div>
      </div>

      <div className="overview-source-card-footer">
        <div>
          <p className="overview-source-card-volume-label">{volumeLabel}</p>
          <div className="overview-source-card-volume">
            <span>{volumeCount}</span>
            <span>{docsLabel}</span>
          </div>
        </div>
        <div>
          <span className="overview-source-card-pass">{passLabel}</span>
        </div>
      </div>
    </article>
  );
}

type RiskDiagnosticsPanelProps = {
  isZh: boolean;
  label: string;
  title: string;
  diagnostics: RiskDiagnosticItem[];
  weeklyEntryLabel: string;
  weeklyTitle: string;
  weeklySummary: string;
  weeklyHref: string | null;
  weeklyActionLabel: string;
  noneLabel: string;
};

function RiskDiagnosticsPanel(props: RiskDiagnosticsPanelProps) {
  const advisoryCopy = props.isZh
    ? "为了提升全息模型的校验可信度，建议研发团队在优先信任低置信度序列之前，主动对缺失描述或关键指标的项目进行一键回补与语义校验，确保高维特征检索的准确度。"
    : "Before low-confidence sequences influence the main model judgment, missing descriptions and key metrics should be batch-enriched and semantically validated to keep retrieval accuracy stable.";
  const secondaryAdvisory = props.isZh
    ? "同时，我们将持续关注单信号源支撑项目的后续演化，优先观察是否出现跨源印证、持续活跃或语义方向收敛等更稳定的判断依据。"
    : "Single-source-backed items should remain under observation until cross-source confirmation, persistence, or stronger semantic convergence appears.";

  return (
    <div className="overview-watchlist-shell overview-watchlist-diagnostics">
      <div className="overview-watchlist-head">
        <div className="overview-watchlist-head-icon">
          <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <p className="overview-reference-kicker font-mono">{props.isZh ? "SAFETY DIAGNOSTICS" : props.label}</p>
          <h3 className="overview-watchlist-title">{props.isZh ? "接下来继续观察什么" : props.title}</h3>
        </div>
      </div>

      <div className="overview-watchlist-stack">
        {props.diagnostics.length > 0 ? (
          props.diagnostics.map((item) => (
            <article
              key={item.key}
              className={`overview-risk-band p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                item.tone === "critical"
                  ? "is-critical bg-red-500/5 border border-red-500/10"
                  : "is-warning bg-amber-500/5 border border-amber-500/10"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${item.tone === "critical" ? "bg-red-500" : "bg-amber-500"} animate-ping`}></span>
                  <span className={`text-xs font-black uppercase font-mono ${item.tone === "critical" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {item.title}
                  </span>
                </div>
                <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300">{item.body}</p>
              </div>
              {item.actionHref ? (
                <a
                  href={item.actionHref}
                  className={`shrink-0 px-4 py-1.5 text-xs font-bold text-white rounded-lg shadow-sm transition-all ${
                    item.tone === "critical" ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"
                  }`}
                >
                  {item.actionLabel}
                </a>
              ) : null}
            </article>
          ))
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{props.noneLabel}</p>
        )}

        <section className="overview-watchlist-advisory">
          <p className="overview-watchlist-advisory-kicker">{props.isZh ? "专家诊断建议与响应对策" : "Expert Recommendations"}</p>
          <p className="overview-watchlist-advisory-copy">{advisoryCopy}</p>
          <p className="overview-watchlist-advisory-copy">{secondaryAdvisory}</p>
        </section>
      </div>
    </div>
  );
}

type HologramDetailDrawerProps = {
  project: SelectedProjectState | null;
  actionLabel: string;
  lang?: "zh" | "en";
  onClose: () => void;
};

function HologramDetailDrawer(props: HologramDetailDrawerProps) {
  const isOpen = Boolean(props.project);
  const project = props.project;
  const isZh = props.lang !== "en";

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md z-50 transition-transform duration-300 ease-out" style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)', pointerEvents: isOpen ? 'auto' : 'none' }}>
      <button
        type="button"
        aria-label={isZh ? "关闭详情抽屉" : "Close detail drawer"}
        className={`fixed inset-0 w-screen h-screen bg-black/20 dark:bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={props.onClose}
        style={{ left: '-100vw' }} /* trick to make overlay cover whole screen while fixed inside right-0 */
      />
      
      <aside
        className="absolute inset-y-0 right-0 w-full max-w-md bg-white/90 dark:bg-neutral-900/95 backdrop-blur-2xl shadow-2xl border-l border-neutral-200/50 dark:border-neutral-800/50 p-6 flex flex-col h-full z-10"
        aria-hidden={isOpen ? "false" : "true"}
      >
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200/50 dark:border-neutral-800/50 mb-6">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
            <span className="text-xs font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 font-mono">
              {isZh ? "情报档案舱" : "Intelligence Dossier"}
            </span>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center justify-center transition-all"
          >
            <svg className="w-4 h-4 text-neutral-500 dark:text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto no-scrollbar space-y-6">
          <div className="mb-5">
            <p className="text-[11px] uppercase tracking-[0.32em] text-indigo-500 dark:text-indigo-300 font-black">
              {project?.detailBadge ?? (isZh ? "项目详情" : "Project Detail")}
            </p>
            <h3 className="text-2xl font-black font-mono text-neutral-900 dark:text-white tracking-tight mt-2">
              {project?.repoFullName ?? (isZh ? "概览详情" : "Overview Detail")}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <article className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/45 border border-neutral-200/60 dark:border-neutral-800/80">
              <span className="text-xs text-neutral-500 block mb-1">{isZh ? "雷达分" : "Radar Score"}</span>
              <strong className="text-lg font-bold text-neutral-900 dark:text-white">{project?.radarScoreLabel ?? (isZh ? "无" : "n/a")}</strong>
            </article>
            <article className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/45 border border-neutral-200/60 dark:border-neutral-800/80">
              <span className="text-xs text-neutral-500 block mb-1">{isZh ? "持续性" : "Persistence"}</span>
              <strong className="text-lg font-bold text-neutral-900 dark:text-white">{project?.persistenceLabel ?? (isZh ? "观察中" : "Watch")}</strong>
            </article>
          </div>

          {project?.trendPath ? (
            <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/45 border border-neutral-200/60 dark:border-neutral-800/80">
              <Sparkline path={project.trendPath} className="w-full h-10" stroke="#6366f1" />
            </div>
          ) : null}

          <div className="space-y-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300 mt-6">
            <section>
              <h4 className="font-black text-neutral-800 dark:text-white mb-2">{isZh ? "项目简介" : "Project Introduction"}</h4>
              <p className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/45 border border-neutral-200/60 dark:border-neutral-800/80">
                {project?.descriptionText ?? project?.detailBody ?? ""}
              </p>
            </section>

            <section>
              <h4 className="font-black text-neutral-800 dark:text-white mb-2">{isZh ? "今日关注原因" : "Why It Matters Today"}</h4>
              <p className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/45 border border-neutral-200/60 dark:border-neutral-800/80">
                {project?.selectionReasonText ?? project?.detailBody ?? ""}
              </p>
            </section>
          </div>

          <div className="border-t border-neutral-200/60 dark:border-neutral-800/80 pt-4 mt-6 space-y-2 mb-8">
            <div className="flex justify-between text-[11px] gap-3">
              <span className="text-neutral-400">{isZh ? "范式" : "Paradigm"}</span>
              <span className="font-mono text-neutral-700 dark:text-neutral-300 text-right">{project?.paradigmLabel ?? (isZh ? "无" : "n/a")}</span>
            </div>
            <div className="flex justify-between text-[11px] gap-3">
              <span className="text-neutral-400">{isZh ? "日增" : "Daily Growth"}</span>
              <span className="font-mono text-neutral-700 dark:text-neutral-300 text-right">+{project?.dailyGrowth ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-neutral-200/50 dark:border-neutral-800/50 mt-6 flex justify-end space-x-2">
          <button
            type="button"
            onClick={props.onClose}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
          >
            {isZh ? "关闭舱门" : "Close"}
          </button>
          {project?.href ? (
            <a
              href={project.href}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm transition-all flex items-center space-x-1"
            >
              <span>{props.actionLabel}</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </a>
          ) : (
            <button
              type="button"
              className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm transition-all flex items-center space-x-1"
            >
              <span>{props.actionLabel}</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function App(rawProps: Partial<AppProps>) {
  const payloadProps = typeof rawProps?.productName === "string" ? rawProps : parseOverviewAppPayload();
  const app: AppProps = {
    ...DEFAULT_PROPS,
    ...payloadProps,
    navItems: payloadProps.navItems ?? DEFAULT_PROPS.navItems,
    themeOptions: payloadProps.themeOptions ?? DEFAULT_PROPS.themeOptions,
    decisionCards: payloadProps.decisionCards ?? DEFAULT_PROPS.decisionCards,
    watchlistItems: payloadProps.watchlistItems ?? DEFAULT_PROPS.watchlistItems,
    sourceCards: payloadProps.sourceCards ?? DEFAULT_PROPS.sourceCards,
    projects: payloadProps.projects ?? DEFAULT_PROPS.projects,
  };

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDark, setIsDark] = useState(app.initialTheme === "dark");
  const [activeTab, setActiveTab] = useState<WorkspaceRailSection>(normalizeOverviewTab(app.initialSection));
  const [selectedProject, setSelectedProject] = useState<SelectedProjectState | null>(null);
  const isZh = app.lang !== "en";
  const localeClass = isZh ? "locale-zh" : "locale-en";
  const overviewLabels = {
    tabDecisions: isZh ? "核心决策" : "Decision Desk",
    tabWatchlist: isZh ? "监控清单" : "Watch Queue",
    tabSources: isZh ? "源头健康" : "Source Pulse",
    radarScore: isZh ? "雷达分" : "Radar Score",
    trendSparkline: isZh ? "趋势火花线" : "Signal Momentum",
    dailyGrowth: isZh ? "日增" : "Daily growth",
    projectIntroduction: isZh ? "项目简介" : "Project Introduction",
    whyToday: isZh ? "今日关注原因" : "Why It Matters Today",
    paradigm: isZh ? "范式" : "Paradigm",
    persistence: isZh ? "持续性" : "Persistence",
    hotSpots: isZh ? "今日重点" : "TODAY'S FOCUS",
    leadOverview: isZh ? "最值得先看的方向" : "What To Read First",
    sourcesEyebrow: isZh ? "健康监控" : "PIPELINE STATUS",
    sourcesTitle: isZh ? "数据来源是否正常" : "Source Health Overview",
    sourcesHealthy: isZh ? "全部数据管道正常联通" : "All source pipelines are live",
    trendLine: isZh ? "趋势线" : "Momentum",
  };

  const workspaceTabs = [
    {
      key: "decisions" as const,
      label: "核心决策 (Decisions)",
      icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
    },
    {
      key: "watchlist" as const,
      label: "监控清单 (Watchlist)",
      icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    },
    {
      key: "sources" as const,
      label: "源头健康 (Sources)",
      icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.25 7.5V6a3.75 3.75 0 017.5 0v1.5m-9 0h10.5A2.25 2.25 0 0119.5 9.75v8.25a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 18V9.75A2.25 2.25 0 016.75 7.5z" /></svg>,
    },
  ];
  workspaceTabs[0].label = overviewLabels.tabDecisions;
  workspaceTabs[1].label = overviewLabels.tabWatchlist;
  workspaceTabs[2].label = overviewLabels.tabSources;

  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const isDragging = useRef(false);
  const workspaceDragStartX = useRef<number | null>(null);
  const lastScrollY = useRef(0);

  const syncThemeClasses = (theme: "light" | "dark") => {
    const html = document.documentElement;
    const body = document.body;

    if (theme === "dark") {
      html.classList.add("dark");
      html.setAttribute("data-theme", "dark");
      body.classList.remove("theme-light");
      body.classList.add("theme-dark");
      body.setAttribute("data-theme", "dark");
      return;
    }

    html.classList.remove("dark");
    html.setAttribute("data-theme", "light");
    body.classList.remove("theme-dark");
    body.classList.add("theme-light");
    body.setAttribute("data-theme", "light");
  };

  useEffect(() => {
    const html = document.documentElement;
    const resolvedTheme = html.classList.contains("dark") || html.getAttribute("data-theme") === "dark" ? "dark" : app.initialTheme;
    syncThemeClasses(resolvedTheme);
    setIsDark(resolvedTheme === "dark");
  }, [app.initialTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleThemeChange = (event: Event) => {
      const nextTheme =
        event instanceof CustomEvent && event.detail?.theme === "dark"
          ? "dark"
          : event instanceof CustomEvent && event.detail?.theme === "light"
            ? "light"
            : document.documentElement.classList.contains("dark") || document.documentElement.getAttribute("data-theme") === "dark"
              ? "dark"
              : "light";
      syncThemeClasses(nextTheme);
      setIsDark(nextTheme === "dark");
    };

    window.addEventListener("visual-console-theme-change", handleThemeChange);
    return () => window.removeEventListener("visual-console-theme-change", handleThemeChange);
  }, []);

  useEffect(() => {
    if (currentIndex < app.projects.length) return;
    setCurrentIndex(0);
  }, [app.projects.length, currentIndex]);

  useEffect(() => {
    setActiveTab(normalizeOverviewTab(app.initialSection));
  }, [app.initialSection]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") === activeTab) return;
    url.searchParams.set("section", activeTab);
    window.history.replaceState(window.history.state ?? {}, "", url.toString());
  }, [activeTab]);

  useEffect(() => {
    if (!selectedProject || typeof window === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedProject(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedProject]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const shell = document.querySelector("[data-nav-shell='auto-hide']");
    if (!(shell instanceof HTMLElement)) return;
    if (window.matchMedia("(max-width: 1023px)").matches && selectedProject) {
      shell.classList.add("is-nav-hidden");
      return;
    }
    if (window.scrollY <= 24) {
      shell.classList.remove("is-nav-hidden");
    }
  }, [selectedProject]);

  const handlePrev = () => {
    if (app.projects.length === 0) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : app.projects.length - 1));
  };

  const handleNext = () => {
    if (app.projects.length === 0) return;
    setCurrentIndex((prev) => (prev < app.projects.length - 1 ? prev + 1 : 0));
  };

  const handleWorkspaceStep = (delta: number) => {
    const currentTabIndex = WORKSPACE_RAIL_SECTIONS.indexOf(activeTab);
    const nextIndex = (currentTabIndex + delta + WORKSPACE_RAIL_SECTIONS.length) % WORKSPACE_RAIL_SECTIONS.length;
    setActiveTab(WORKSPACE_RAIL_SECTIONS[nextIndex]);
  };

  const handleWorkspacePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("a, button, input, textarea, select, label")) return;
    workspaceDragStartX.current = event.clientX;
  };

  const handleWorkspacePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (workspaceDragStartX.current === null) return;
    const deltaX = event.clientX - workspaceDragStartX.current;
    workspaceDragStartX.current = null;
    if (Math.abs(deltaX) < 48) return;
    handleWorkspaceStep(deltaX < 0 ? 1 : -1);
  };

  const handleWorkspacePointerCancel = () => {
    workspaceDragStartX.current = null;
  };

  const handleDragStart = (event: React.MouseEvent | React.TouchEvent) => {
    if (app.projects.length <= 1) return;
    isDragging.current = true;
    startX.current = "touches" in event ? event.touches[0].clientX : event.clientX;
    if (trackRef.current) {
      trackRef.current.style.transition = "none";
    }
  };

  const handleDragMove = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !trackRef.current) return;
    const currentX = "touches" in event ? event.touches[0].clientX : event.clientX;
    const diffX = currentX - startX.current;
    const offsetPercent = currentIndex * 100;
    const movePercent = offsetPercent - (diffX / trackRef.current.clientWidth) * 100;
    trackRef.current.style.transform = `translateX(-${movePercent}%)`;
  };

  const handleDragEnd = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!trackRef.current) return;

    trackRef.current.style.transition = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
    const endX = "changedTouches" in event ? event.changedTouches[0].clientX : event.clientX;
    const diffX = endX - startX.current;
    const threshold = trackRef.current.clientWidth * 0.15;

    if (Math.abs(diffX) > threshold) {
      if (diffX > 0) {
        handlePrev();
      } else {
        handleNext();
      }
      return;
    }

    trackRef.current.style.transform = `translateX(-${currentIndex * 100}%)`;
  };

  const radarBeamBackground = isDark
    ? "conic-gradient(from 0deg at 50% 50%, rgba(139,92,246,0.22) 0deg, rgba(99,102,241,0.06) 120deg, transparent 360deg)"
    : "conic-gradient(from 0deg at 50% 50%, rgba(99,102,241,0.08) 0deg, rgba(139,92,246,0.02) 120deg, transparent 360deg)";
  const heroProject = app.projects[currentIndex] ?? app.projects[0] ?? null;
  const decisionMatrixItems = buildDecisionMatrixItems(app);
  const diagnosticItems = buildRiskDiagnosticItems(app);
  const decisionLeadDetail = heroProject
    ? buildSelectedProjectFromOverviewProject(heroProject)
    : selectedProject;

  return (
    <div className={`route-console route-console-overview overview-homepage ${localeClass}`} style={{ display: "block", width: "100%", margin: "0 auto", padding: 0, gap: 0 }}>
      <div className="holographic-console-wrapper w-full flex flex-col items-center pb-16" style={{ width: "100%", padding: 0 }}>
        <main className="overview-home-main max-w-6xl mx-auto px-4 md:px-5 py-6 md:py-8 flex flex-col items-center w-full">
          <section className="overview-home-stage w-full flex flex-col items-center" data-home-stage="overview-hero">
            <div className="overview-home-intro text-center max-w-xl mb-6 md:mb-9">
              {app.heroEyebrow ? (
                <div className="inline-flex items-center space-x-2 bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-[10px] md:text-[11px] font-semibold tracking-wide mb-2.5 md:mb-3">
                  <span>{app.heroEyebrow}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  <span>{app.statusLine}</span>
                </div>
              ) : null}
              <h1 className="overview-home-title text-[1.5rem] sm:text-[1.65rem] md:text-[2.1rem] font-extrabold tracking-tight text-neutral-900 dark:text-white mb-2" data-typography="hero-title">
                {app.heroTitle}
              </h1>
              <p className="overview-home-summary text-[13px] md:text-[15px] text-neutral-500 dark:text-neutral-400 font-medium">{app.heroSummary}</p>
              <div className="overview-home-actions action-row flex items-center justify-center gap-2 mt-3.5 md:mt-4">
                <a className="button-link" href={app.runHealthHref ?? "#"}>{app.runHealthLabel ?? "Run Health"}</a>
                <a className="button-link is-secondary" href={app.projectsHref ?? "#"}>{app.projectsLabel ?? "Projects"}</a>
                {app.githubStarMode === "direct" ? (
                  <form method="POST" action={app.githubStarFormAction ?? "/github/star"} data-github-star-mode="direct" className="inline-flex">
                    <input type="hidden" name="csrf_token" value={app.githubStarCsrfToken ?? ""} />
                    <input type="hidden" name="return_to" value={app.githubStarReturnTo ?? ""} />
                    <button type="submit" className="button-link is-secondary">
                      {app.githubStarLabel ?? "⭐ Star on GitHub"}
                    </button>
                  </form>
                ) : (
                  <a
                    className="button-link is-secondary"
                    href={app.githubStarHref ?? "https://github.com/sunrisefromdark/agentRadar"}
                    target="_blank"
                    rel="noreferrer"
                    data-github-star-mode="external"
                  >
                    {app.githubStarLabel ?? "⭐ Star on GitHub"}
                  </a>
                )}
              </div>
              {app.githubStarStatusText ? (
                <p className="mt-2 text-[11px] md:text-[12px] text-neutral-500 dark:text-neutral-400 font-medium">
                  {app.githubStarStatusText}
                </p>
              ) : null}
            </div>

            <section className="overview-top-project-carousel relative w-full max-w-[68rem] mx-auto px-1.5 md:px-3 py-1.5" data-top-project-carousel="true">
              <div className="overview-carousel-stage-shell relative w-full min-h-[468px] sm:min-h-[430px] md:h-[384px] rounded-[2rem] md:rounded-[3rem] overflow-hidden bg-gradient-to-tr from-indigo-50/60 via-white/80 to-slate-50/70 dark:from-neutral-900 dark:via-neutral-950 dark:to-indigo-950/40 shadow-[0_22px_52px_rgba(99,102,241,0.08)] border border-indigo-100/80 dark:border-neutral-800/80 flex items-stretch md:items-center justify-center">
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
                  <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full animate-[spin_24s_linear_infinite]" style={{ background: radarBeamBackground }} />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[368px] h-[368px] rounded-full border border-indigo-500/[0.04] dark:border-indigo-500/10" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[232px] h-[232px] rounded-full border border-purple-500/[0.03] dark:border-purple-500/5" />
                  <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-indigo-500/[0.05] via-indigo-500/0 to-transparent dark:from-indigo-500/[0.08] rounded-t-[100%] border-t border-indigo-100/50 dark:border-neutral-800/50" />
                  <div className="absolute -bottom-8 left-1/3 w-32 h-32 bg-indigo-200/20 dark:bg-indigo-500/5 rounded-full blur-3xl" />
                </div>

                {heroProject ? (
                  <div className="relative w-full overflow-hidden z-10 md:h-full" id="carousel-viewport">
                    <div
                      ref={trackRef}
                      className="relative z-10 flex w-full md:h-full transition-transform duration-500 ease-out cursor-grab active:cursor-grabbing select-none items-stretch"
                      data-carousel-track="true"
                      style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                      onMouseDown={handleDragStart}
                      onMouseMove={handleDragMove}
                      onMouseUp={handleDragEnd}
                      onMouseLeave={handleDragEnd}
                      onTouchStart={handleDragStart}
                      onTouchMove={handleDragMove}
                      onTouchEnd={handleDragEnd}
                    >
                      {app.projects.map((project) => (
                        <div key={project.repoFullName} className="flex-shrink-0 w-full flex items-start md:items-center justify-center px-4 sm:px-6 md:px-12" data-carousel-card="true">
                          <div className="overview-carousel-project-layout w-full max-w-[44rem] grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 items-center">
                            <div className="overview-carousel-project-meta md:col-span-4 flex flex-col items-center md:items-start text-center md:text-left space-y-4">
                              <div className="inline-flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                <span>{project.recommendationText}</span>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold font-mono block">{overviewLabels.radarScore}</span>
                                <div className="flex items-baseline justify-center md:justify-start space-x-1.5">
                                  <span className="text-[2.45rem] sm:text-5xl md:text-[3.5rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-950 to-indigo-700 dark:from-white dark:to-indigo-300 tracking-tight font-mono">
                                    {project.radarScore}
                                  </span>
                                  <span className="text-[11px] font-bold text-neutral-400 font-mono">/ 100</span>
                                </div>
                              </div>

                              <div className="space-y-1.5 w-32 md:w-36">
                                <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold font-mono block">{overviewLabels.trendSparkline}</span>
                                <div className="flex items-center space-x-3">
                                  <Sparkline path={project.trendPath} />
                                  <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 font-mono">{project.signalText}</span>
                                </div>
                              </div>
                            </div>

                            <div className="overview-carousel-project-copy md:col-span-8 flex flex-col justify-between h-full space-y-3">
                              <div>
                                <h2 className="overview-carousel-project-title text-[1.02rem] sm:text-xl md:text-[1.9rem] font-black text-neutral-900 dark:text-white tracking-tight font-mono mb-2.5 md:mb-3 border-b border-indigo-100/50 dark:border-neutral-800/50 pb-2 flex items-center justify-between gap-3">
                                  <a href={project.href} data-preserve-scroll="detail">{project.repoFullName}</a>
                                  <span className="overview-carousel-growth text-[11px] font-mono text-neutral-400 dark:text-neutral-500">{isZh ? `${overviewLabels.dailyGrowth} ${project.dailyGrowth}` : `${overviewLabels.dailyGrowth}: ${project.dailyGrowth}`}</span>
                                </h2>

                                <div className="overview-carousel-project-prose space-y-3 text-neutral-600 dark:text-neutral-300">
                                  <p className="text-[11px] md:text-[13px] leading-relaxed font-medium">
                                    <strong className="text-indigo-600 dark:text-indigo-400 font-bold mr-1">{overviewLabels.projectIntroduction}:</strong>
                                    {project.descriptionText}
                                  </p>
                                  <p className="text-[11px] md:text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                                    <strong className="text-indigo-600 dark:text-indigo-400 font-bold mr-1">{overviewLabels.whyToday}:</strong>
                                    {project.selectionReasonText}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                                <span className="text-[10px] font-semibold bg-indigo-50/50 dark:bg-neutral-900 border border-indigo-100/40 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 px-2.5 py-1 rounded-full">
                                  {overviewLabels.paradigm}: {project.paradigmLongText ?? app.noneLabel}
                                </span>
                                <span className="text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full">
                                  {overviewLabels.persistence}: {project.persistenceLabel}
                                </span>
                                <button
                                  onClick={() => setSelectedProject(buildSelectedProjectFromOverviewProject(project))}
                                  className="ml-auto text-[11px] font-bold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center space-x-1 hover:underline transition-all"
                                  type="button"
                                >
                                  <span>{app.projectDetailLabel}</span>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10 px-8 text-center">
                    <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">{app.noneLabel}</p>
                  </div>
                )}

                <button
                  onClick={handlePrev}
                  className="absolute left-4 md:left-6 w-10 h-10 rounded-full bg-white/60 dark:bg-neutral-900/60 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-500 border border-indigo-100 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 transition-all flex items-center justify-center z-20 shadow-md"
                  type="button"
                  aria-label={app.prevLabel}
                  data-carousel-arrow="prev"
                >
                  <span className="overview-arrow-glyph" aria-hidden="true">‹</span>
                </button>

                <button
                  onClick={handleNext}
                  className="absolute right-4 md:right-6 w-10 h-10 rounded-full bg-white/60 dark:bg-neutral-900/60 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-500 border border-indigo-100 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200 transition-all flex items-center justify-center z-20 shadow-md"
                  type="button"
                  aria-label={app.nextLabel}
                  data-carousel-arrow="next"
                >
                  <span className="overview-arrow-glyph" aria-hidden="true">›</span>
                </button>
              </div>

              <div className="flex items-center justify-center space-x-2 mt-4 md:mt-6" id="carousel-dots">
                {app.projects.map((project, index) => (
                  <button
                    key={project.repoFullName}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${index === currentIndex ? "bg-indigo-500 w-3.5" : "bg-neutral-300 dark:bg-neutral-700 w-1.5"}`}
                    type="button"
                    aria-label={project.repoFullName}
                  />
                ))}
              </div>
            </section>

            <footer
              className="overview-footer-rail overview-workspace-rail overview-holo-dock w-full flex justify-center mt-4 md:mt-6"
              data-workspace-rail="overview"
              data-workspace-section={activeTab}
              onPointerDown={handleWorkspacePointerDown}
              onPointerUp={handleWorkspacePointerUp}
              onPointerCancel={handleWorkspacePointerCancel}
              onPointerLeave={handleWorkspacePointerCancel}
            >
              <div className="overview-workspace-track overview-reference-tabs">
                {workspaceTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    data-console-tab={tab.key}
                    data-workspace-chip={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`tab-btn overview-workspace-chip overview-reference-tab ${activeTab === tab.key ? "is-active" : ""}`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </footer>

            <section className="overview-workspace-stage w-full mt-4 md:mt-6">
              <section className="hidden" data-workspace-panel="signals" data-panel-active="false" aria-hidden="true">
                <article className="panel">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">{app.signalSummaryLabel}</p>
                      <h2>{app.signalPostureTitle}</h2>
                    </div>
                  </div>
                  <p className="reader-copy">{app.signalPostureBody}</p>
                </article>
              </section>

              <section className="overview-workspace-panel overview-console-panel" data-workspace-panel="decisions" data-panel-active={activeTab === "decisions" ? "true" : "false"}>
                <article className="panel overview-decisions-compat-panel" aria-hidden="true">
                  <p className="empty-copy">{app.decisionsPanelTitle}</p>
                </article>
                <div className="overview-decision-grid overview-decisions-compat-grid" aria-hidden="true">
                  <div className="overview-compat-grid-probe">
                    <p className="empty-copy">{decisionMatrixItems[0]?.title ?? app.noneLabel}</p>
                  </div>
                </div>
                <div className="overview-decisions-layout grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="overview-decisions-summary-column overview-decisions-hotspots-column lg:col-span-4 flex flex-col space-y-6">
                    <article className="overview-hotspots-card flex flex-col h-full justify-between">
                      <div>
                        <p className="overview-reference-kicker font-mono">{overviewLabels.hotSpots}</p>
                        <h3 className="overview-hotspots-title">{overviewLabels.leadOverview}</h3>
                        <p className="overview-hotspots-copy mb-6">
                          {app.leadDecisionName
                            ? `今天最值得关注的方向，目前主要由 ${app.leadDecisionName} 代表。`
                            : app.signalPostureBody}
                        </p>
                        {app.leadDecisionReason ? <p className="overview-hotspots-copy">{app.leadDecisionReason}</p> : null}
                        {!app.leadDecisionReason && app.signalPostureBody && app.leadDecisionName ? (
                          <p className="overview-hotspots-copy">{app.signalPostureBody}</p>
                        ) : null}
                      </div>
                    </article>
                  </div>

                  <div className="overview-decisions-cards-column overview-decisions-matrix-column lg:col-span-8">
                    <div className="overview-decision-grid overview-decision-matrix overview-decision-matrix-two-up grid grid-cols-1 md:grid-cols-2 gap-4">
                      {decisionMatrixItems.length > 0 ? (
                        decisionMatrixItems.map((item) => (
                          <CoreDecisionCard key={item.key} item={item} onOpen={setSelectedProject} trendLabel={overviewLabels.trendLine} detailLabel={app.projectDetailLabel} />
                        ))
                      ) : (
                        <article className="glass-panel p-5 rounded-2xl">
                          <p className="empty-copy">{app.noneLabel}</p>
                        </article>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="overview-workspace-panel overview-console-panel" data-workspace-panel="watchlist" data-panel-active={activeTab === "watchlist" ? "true" : "false"}>
                <RiskDiagnosticsPanel
                  isZh={isZh}
                  label={app.risksPanelLabel}
                  title={app.risksPanelTitle}
                  diagnostics={diagnosticItems}
                  weeklyEntryLabel={app.weeklyEntryLabel}
                  weeklyTitle={app.weeklyPanelTitle}
                  weeklySummary={app.weeklySummary}
                  weeklyHref={app.weeklyHref}
                  weeklyActionLabel={app.openWeeklyLabel}
                  noneLabel={app.noneLabel}
                />
              </section>

              <section className="overview-workspace-panel overview-console-panel" data-workspace-panel="sources" data-panel-active={activeTab === "sources" ? "true" : "false"}>
                <div className="overview-sources-shell">
                  <div className="overview-sources-header">
                    <div>
                      <p className="overview-reference-kicker font-mono">{overviewLabels.sourcesEyebrow}</p>
                      <h3 className="overview-sources-title">{overviewLabels.sourcesTitle}</h3>
                    </div>
                    <div className="overview-sources-status">
                      <span className="overview-sources-status-dot"></span>
                      <span className="overview-sources-status-copy">{overviewLabels.sourcesHealthy}</span>
                    </div>
                  </div>

                  <div className="overview-sources-pipeline overview-source-grid">
                    {app.sourceCards.length > 0 ? (
                      app.sourceCards.map((card) => <SourceMonitorCard key={card.key} card={card} isZh={isZh} />)
                    ) : (
                      <article className="glass-panel p-5 rounded-2xl">
                        <p className="empty-copy">{app.noneLabel}</p>
                      </article>
                    )}
                  </div>
                </div>
              </section>
            </section>
          </section>

          <CompatibilityArtifacts app={app} />
        </main>

        <HologramDetailDrawer project={selectedProject} actionLabel={app.projectDetailLabel} lang={isZh ? "zh" : "en"} onClose={() => setSelectedProject(null)} />
      </div>
    </div>
  );
}
