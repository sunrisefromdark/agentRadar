import React, { useEffect, useMemo, useState } from "react";

type TelemetryPanelKey = "lowConfidence" | "singleSource" | "missingDesc";

type NarrativeItem = {
  key: string;
  name: string;
  channel: string;
  scoreLabel: string;
  confidenceLabel: string;
  reason: string;
  note: string;
  issue?: string;
};

type PipelineItem = {
  key: string;
  label: string;
  docs: number;
  distinctProjects: number;
  enabledLabel: string;
  statusLabel: string;
  notes: string;
  active: boolean;
};

type VerifyCheckItem = {
  key: string;
  name: string;
  statusLabel: string;
  detail: string;
};

type SourceTableRow = {
  source: string;
  enabledLabel: string;
  countLabel: string;
  distinctProjectsLabel: string;
  statusLabel: string;
  notes: string;
};

type AuditTableRow = {
  repoFullName: string;
  statusLabel: string;
  metricsAppliedLabel: string;
};

export type RunHealthViewProps = {
  lang?: "zh" | "en";
  pageTitle: string;
  pageSummary: string;
  verdictEyebrow: string;
  verdictTitle: string;
  verdictStatus: string;
  verdictSummary: string;
  verifiedAtLabel: string;
  verifiedAt: string;
  priorityLabel: string;
  priorityTitle: string;
  priorityActions: string[];
  telemetryLabel: string;
  telemetryTitle: string;
  lowConfidenceHeading: string;
  lowConfidenceBody: string;
  lowConfidenceCount: number;
  totalProjects: number;
  lowConfidenceProjects: NarrativeItem[];
  singleSourceHeading: string;
  singleSourceBody: string;
  singleSourceCount: number;
  singleSourcePreview: NarrativeItem[];
  singleSourceAll: NarrativeItem[];
  singleSourceFootnote: string;
  missingDescriptionHeading: string;
  missingDescriptionBody: string;
  missingDescriptionCount: number;
  missingDescriptions: NarrativeItem[];
  validationLabel: string;
  validationStatus: string;
  validationDescription: string;
  pipelinesTitle: string;
  activeNodesLabel: string;
  pipelines: PipelineItem[];
  verifySectionTitle: string;
  verifyChecks: VerifyCheckItem[];
  failureNotesTitle: string;
  failureNotes: string[];
  initialTelemetry?: TelemetryPanelKey | null;
  compatibilitySummaryTitle: string;
  compatibilitySourceTitle: string;
  compatibilityAuditTitle: string;
  compatibilityVerifyTitle: string;
  compatibilityActionTitle: string;
  sourceTableRows: SourceTableRow[];
  auditRows: AuditTableRow[];
};

declare global {
  interface Window {
    __RUN_HEALTH_INITIAL_DATA__?: Partial<RunHealthViewProps>;
  }
}

const DEFAULT_PROPS: RunHealthViewProps = {
  lang: "zh",
  pageTitle: "",
  pageSummary: "",
  verdictEyebrow: "",
  verdictTitle: "",
  verdictStatus: "PASS",
  verdictSummary: "",
  verifiedAtLabel: "",
  verifiedAt: "",
  priorityLabel: "",
  priorityTitle: "",
  priorityActions: [],
  telemetryLabel: "",
  telemetryTitle: "",
  lowConfidenceHeading: "",
  lowConfidenceBody: "",
  lowConfidenceCount: 0,
  totalProjects: 0,
  lowConfidenceProjects: [],
  singleSourceHeading: "",
  singleSourceBody: "",
  singleSourceCount: 0,
  singleSourcePreview: [],
  singleSourceAll: [],
  singleSourceFootnote: "",
  missingDescriptionHeading: "",
  missingDescriptionBody: "",
  missingDescriptionCount: 0,
  missingDescriptions: [],
  validationLabel: "",
  validationStatus: "",
  validationDescription: "",
  pipelinesTitle: "",
  activeNodesLabel: "",
  pipelines: [],
  verifySectionTitle: "",
  verifyChecks: [],
  failureNotesTitle: "",
  failureNotes: [],
  initialTelemetry: null,
  compatibilitySummaryTitle: "",
  compatibilitySourceTitle: "",
  compatibilityAuditTitle: "",
  compatibilityVerifyTitle: "",
  compatibilityActionTitle: "",
  sourceTableRows: [],
  auditRows: [],
};

const TELEMETRY_PANEL_IDS: Record<TelemetryPanelKey, string> = {
  lowConfidence: "telemetry-low-confidence",
  singleSource: "telemetry-single-source",
  missingDesc: "telemetry-missing-desc",
};

const OVERVIEW_DARK_BODY_BACKGROUND = String.raw`
    background-color: #0a0a0a;
    background-image:
      radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 0),
      linear-gradient(to right, rgba(255, 255, 255, 0.012) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.012) 1px, transparent 1px);
    background-size: 24px 24px;
`;

const REFERENCE_STYLES = String.raw`
  :root {
    --rh-bg-light: radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.04) 0%, transparent 45%),
      radial-gradient(circle at 100% 100%, rgba(6, 182, 212, 0.04) 0%, transparent 45%),
      linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  }

  body[data-route="run-health"] {
    background: var(--rh-bg-light);
  }

  html.dark body[data-route="run-health"],
  html[data-theme="dark"] body[data-route="run-health"],
  body.theme-dark[data-route="run-health"] {
${OVERVIEW_DARK_BODY_BACKGROUND}
  }

  body[data-route="run-health"] .atmosphere-layer,
  body[data-route="run-health"] .shell-ops {
    display: none !important;
  }

  body[data-route="run-health"] .page-frame-content-stage,
  body[data-route="run-health"] .route-console-shell,
  body[data-route="run-health"] .route-frame-run-health,
  body[data-route="run-health"] .primary-content.content-stage {
    padding: 0 !important;
    margin: 0 !important;
    gap: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
  }

  body[data-route="run-health"] .primary-content.content-stage {
    display: block !important;
  }

  .grid-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0.22;
    background-size: 40px 40px;
    background-image:
      linear-gradient(to right, rgba(99, 102, 241, 0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(99, 102, 241, 0.05) 1px, transparent 1px);
  }

  html.dark .grid-overlay,
  html[data-theme="dark"] .grid-overlay,
  body.theme-dark .grid-overlay {
    opacity: 0.34;
    background-image:
      linear-gradient(to right, rgba(255, 255, 255, 0.022) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.022) 1px, transparent 1px);
  }

  .glass-panel {
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(99, 102, 241, 0.08);
    box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.03), 0 1px 1px 0 rgba(99, 102, 241, 0.02);
  }

  html.dark .glass-panel,
  html[data-theme="dark"] .glass-panel,
  body.theme-dark .glass-panel {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 1px 1px 0 rgba(255, 255, 255, 0.02);
  }

  .hologram-border {
    position: relative;
  }

  .hologram-border::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1.2px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.42) 0%, rgba(6, 182, 212, 0.12) 50%, rgba(139, 92, 246, 0.42) 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    opacity: 0.72;
  }

  .run-health-stage {
    width: min(100%, 1220px);
    margin: 0 auto;
    padding: 18px 12px 52px;
  }

  .run-health-filter-chip {
    min-height: 31px;
    padding: 0 14px;
    border-radius: 999px;
    border: 1px solid rgba(99, 102, 241, 0.12);
    background: rgba(255, 255, 255, 0.5);
    color: #6366f1;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
    transition: all 180ms ease;
  }

  .run-health-filter-chip.is-active {
    color: #ffffff;
    background: linear-gradient(135deg, #6366f1 0%, #7c3aed 100%);
    box-shadow: 0 14px 28px rgba(99, 102, 241, 0.22);
  }

  html.dark .run-health-filter-chip,
  html[data-theme="dark"] .run-health-filter-chip,
  body.theme-dark .run-health-filter-chip {
    background: rgba(11, 18, 32, 0.88);
    border-color: rgba(129, 140, 248, 0.16);
    color: #a5b4fc;
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }

  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(8px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in-up {
    animation: fadeInUp 240ms ease-out;
  }

  .run-health-hidden-compat {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;

function readPayloadFromDom(): Partial<RunHealthViewProps> | null {
  if (typeof document === "undefined") return null;
  const payloadNode = document.getElementById("run-health-react-payload");
  if (!payloadNode?.textContent) return null;
  try {
    return JSON.parse(payloadNode.textContent) as Partial<RunHealthViewProps>;
  } catch {
    return null;
  }
}

function readPayloadFromWindow(): Partial<RunHealthViewProps> | null {
  if (typeof window === "undefined") return null;
  const payload = window.__RUN_HEALTH_INITIAL_DATA__;
  return payload && typeof payload === "object" ? payload : null;
}

export function parseRunHealthViewPayload(): RunHealthViewProps {
  const payload = readPayloadFromDom() ?? readPayloadFromWindow() ?? {};
  return {
    ...DEFAULT_PROPS,
    ...payload,
    priorityActions: payload.priorityActions ?? DEFAULT_PROPS.priorityActions,
    lowConfidenceProjects: payload.lowConfidenceProjects ?? DEFAULT_PROPS.lowConfidenceProjects,
    singleSourcePreview: payload.singleSourcePreview ?? DEFAULT_PROPS.singleSourcePreview,
    singleSourceAll: payload.singleSourceAll ?? DEFAULT_PROPS.singleSourceAll,
    missingDescriptions: payload.missingDescriptions ?? DEFAULT_PROPS.missingDescriptions,
    pipelines: payload.pipelines ?? DEFAULT_PROPS.pipelines,
    verifyChecks: payload.verifyChecks ?? DEFAULT_PROPS.verifyChecks,
    failureNotes: payload.failureNotes ?? DEFAULT_PROPS.failureNotes,
    initialTelemetry: payload.initialTelemetry ?? DEFAULT_PROPS.initialTelemetry,
    sourceTableRows: payload.sourceTableRows ?? DEFAULT_PROPS.sourceTableRows,
    auditRows: payload.auditRows ?? DEFAULT_PROPS.auditRows,
  };
}

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function splitNarrative(text: string): string[] {
  return text
    .split(/(?<=[。；.!?])/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function renderNarrative(text: string, className: string): React.ReactNode {
  return splitNarrative(text).map((part, index) => (
    <p key={`${index}-${part.slice(0, 24)}`} className={className}>
      {part}
    </p>
  ));
}

function normalizeChannel(channel: string): string {
  return channel === "All" ? "All" : channel;
}

export default function RunHealthView(props: RunHealthViewProps): React.ReactElement {
  const lang = props.lang ?? "zh";
  const [activeTelemetry, setActiveTelemetry] = useState<null | TelemetryPanelKey>(props.initialTelemetry ?? null);
  const [showAllSingleSources, setShowAllSingleSources] = useState(false);
  const [subFilterChannel, setSubFilterChannel] = useState("All");
  const [subSearchQuery, setSubSearchQuery] = useState("");

  useEffect(() => {
    if (!props.initialTelemetry || typeof document === "undefined") return;
    const panel = document.getElementById(TELEMETRY_PANEL_IDS[props.initialTelemetry]);
    panel?.scrollIntoView({ block: "center" });
  }, [props.initialTelemetry]);

  const channelOptions = useMemo(() => {
    const channels = Array.from(new Set(props.singleSourceAll.map((item) => item.channel))).filter(Boolean);
    return ["All", ...channels];
  }, [props.singleSourceAll]);

  const filteredSingleSources = useMemo(() => {
    return props.singleSourceAll.filter((item) => {
      const matchesChannel = subFilterChannel === "All" || item.channel === normalizeChannel(subFilterChannel);
      const matchesSearch = item.name.toLowerCase().includes(subSearchQuery.trim().toLowerCase());
      return matchesChannel && matchesSearch;
    });
  }, [props.singleSourceAll, subFilterChannel, subSearchQuery]);

  const lowConfidenceLead = props.lowConfidenceProjects[0] ?? null;
  const verdictTone =
    props.verdictStatus === "FAIL" ? "text-rose-600 dark:text-rose-400" : props.verdictStatus === "WARN" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <>
      <style>{REFERENCE_STYLES}</style>
      <div className="grid-overlay" aria-hidden="true" />
      <div className="run-health-app relative z-10 !bg-transparent !p-0 !shadow-none font-sans antialiased text-neutral-800 dark:text-neutral-100 transition-colors duration-300">
        <div className="run-health-stage">
          <section className="flex flex-col items-center text-center mb-8 md:mb-10">
            <h1 className="text-[2.2rem] md:text-[3.25rem] font-black tracking-[-0.06em] text-neutral-950 dark:text-white mb-3">
              {props.pageTitle}
            </h1>
            <div className="max-w-2xl text-sm md:text-[15px] font-medium text-neutral-500 dark:text-neutral-400 leading-7">
              {renderNarrative(props.pageSummary, "mb-2 last:mb-0")}
            </div>
          </section>

          <section className="glass-panel hologram-border p-6 md:p-8 rounded-[32px] relative overflow-hidden mb-8 md:mb-10">
            <div className="absolute top-0 right-0 w-52 h-52 bg-emerald-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between relative z-10">
              <div className="max-w-3xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-[0.24em] font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {props.verdictEyebrow}
                  </span>
                </div>
                <h2 className="text-2xl md:text-[2.2rem] font-black tracking-[-0.04em] text-neutral-950 dark:text-white">
                  {props.verdictTitle}
                </h2>
                <div className="text-sm leading-7 text-neutral-600 dark:text-neutral-300">
                  {renderNarrative(props.verdictSummary, "mb-2 last:mb-0")}
                </div>
              </div>

              <div className="w-full md:w-[188px] shrink-0 rounded-[24px] bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/20 px-5 py-6 text-center shadow-sm">
                <span className="block text-[10px] uppercase tracking-[0.24em] font-black font-mono text-emerald-600 dark:text-emerald-400 mb-3">
                  {props.lang === "zh" ? "校验已完成" : "Audit Verified"}
                </span>
                <strong className={classNames("block text-[2.25rem] leading-none font-black font-mono tracking-[-0.08em] mb-3", verdictTone)}>
                  {props.verdictStatus}
                </strong>
                <span className="block text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                  {props.verifiedAtLabel}: {props.verifiedAt}
                </span>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 flex flex-col gap-6">
              <section className="glass-panel hologram-border p-6 md:p-7 rounded-[32px] shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] font-black font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/20 px-2 py-1 rounded-md">
                      {props.priorityLabel}
                    </span>
                    <strong className="text-sm md:text-[15px] font-black text-neutral-900 dark:text-neutral-100">
                      {props.priorityTitle}
                    </strong>
                  </div>
                  <div className="space-y-3">
                    {props.priorityActions.map((action, index) => (
                      <div key={`${index}-${action.slice(0, 16)}`} className="rounded-2xl border border-indigo-500/10 bg-white/30 dark:bg-slate-950/30 px-4 py-3">
                        {renderNarrative(action, "border-l-2 border-indigo-500/30 pl-3 text-sm leading-7 text-neutral-700 dark:text-neutral-300")}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-7 pt-6 border-t border-neutral-200/50 dark:border-neutral-800/60 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] font-black font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/20 px-2 py-1 rounded-md">
                      {props.telemetryLabel}
                    </span>
                    <strong className="text-sm md:text-[15px] font-black text-neutral-900 dark:text-neutral-100">
                      {props.telemetryTitle}
                    </strong>
                  </div>

                  <div className="space-y-3.5">
                    <button
                      id={TELEMETRY_PANEL_IDS.lowConfidence}
                      type="button"
                      onClick={() => setActiveTelemetry((current) => (current === "lowConfidence" ? null : "lowConfidence"))}
                      className={classNames(
                        "w-full text-left p-4 rounded-[24px] border transition-all",
                        activeTelemetry === "lowConfidence"
                          ? "border-amber-500/40 bg-amber-500/[0.05] dark:bg-amber-500/[0.08]"
                          : "border-neutral-200/70 dark:border-neutral-800 hover:bg-white/30 dark:hover:bg-slate-950/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <strong className="text-sm md:text-[15px] font-black text-neutral-900 dark:text-white">
                          {props.lowConfidenceHeading}
                        </strong>
                        <span className="shrink-0 text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                          {activeTelemetry === "lowConfidence" ? (lang === "en" ? "COLLAPSE" : "折叠") : lang === "en" ? "DRILL DOWN" : "点击下钻"}
                        </span>
                      </div>
                      <div className="text-sm leading-7 text-neutral-500 dark:text-neutral-400">
                        {renderNarrative(props.lowConfidenceBody, "mb-2 last:mb-0")}
                      </div>

                      {activeTelemetry === "lowConfidence" && lowConfidenceLead ? (
                        <div className="mt-4 pt-4 border-t border-amber-500/20 animate-fade-in-up">
                          <div className="rounded-[22px] border border-amber-500/15 bg-white/55 dark:bg-slate-950/45 px-4 py-4">
                            <span className="block text-[10px] uppercase tracking-[0.18em] font-black font-mono text-amber-600 dark:text-amber-400 mb-2">
                              {lang === "en" ? "Project To Review" : "待复核项目"}
                            </span>
                            <strong className="block text-sm md:text-[15px] font-black font-mono text-neutral-900 dark:text-white mb-2">
                              {lowConfidenceLead.name}
                            </strong>
                            <div className="flex flex-wrap gap-2 mb-3 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                              <span>{lowConfidenceLead.scoreLabel}</span>
                              <span>{lowConfidenceLead.confidenceLabel}</span>
                              <span>{lowConfidenceLead.channel}</span>
                            </div>
                            <div className="space-y-2 text-sm leading-7 text-neutral-600 dark:text-neutral-300">
                              {renderNarrative(lowConfidenceLead.reason, "mb-2 last:mb-0")}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </button>

                    <button
                      id={TELEMETRY_PANEL_IDS.singleSource}
                      type="button"
                      onClick={() => setActiveTelemetry((current) => (current === "singleSource" ? null : "singleSource"))}
                      className={classNames(
                        "w-full text-left p-4 rounded-[24px] border transition-all",
                        activeTelemetry === "singleSource"
                          ? "border-amber-500/40 bg-amber-500/[0.05] dark:bg-amber-500/[0.08]"
                          : "border-neutral-200/70 dark:border-neutral-800 hover:bg-white/30 dark:hover:bg-slate-950/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <strong className="text-sm md:text-[15px] font-black text-neutral-900 dark:text-white">
                          {props.singleSourceHeading}
                        </strong>
                        <span className="shrink-0 text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                          {activeTelemetry === "singleSource" ? (lang === "en" ? "COLLAPSE" : "折叠") : lang === "en" ? "DRILL DOWN" : "点击下钻"}
                        </span>
                      </div>
                      <div className="text-sm leading-7 text-neutral-500 dark:text-neutral-400">
                        {renderNarrative(props.singleSourceBody, "mb-2 last:mb-0")}
                      </div>

                      {activeTelemetry === "singleSource" ? (
                        <div className="mt-4 pt-4 border-t border-amber-500/20 animate-fade-in-up" onClick={(event) => event.stopPropagation()}>
                          <div className="text-sm leading-7 text-neutral-500 dark:text-neutral-400 mb-4">
                            {renderNarrative(
                              lang === "en"
                                ? "The system highlights the single-source projects that most need manual review first."
                                : "系统会优先标出最需要人工复核的单一来源项目。",
                              "mb-2 last:mb-0",
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {props.singleSourcePreview.map((item) => (
                              <div key={item.key} className="rounded-[20px] border border-neutral-200/60 dark:border-neutral-800/60 bg-white/55 dark:bg-slate-950/45 px-4 py-3">
                                <span className="block text-[10px] font-mono font-bold text-indigo-500 dark:text-indigo-400 mb-1">
                                  {lang === "en" ? "Capture Channel" : "捕获信道"}: {item.channel}
                                </span>
                                <strong className="block text-xs md:text-[13px] font-black font-mono text-neutral-900 dark:text-white truncate" title={item.name}>
                                  {item.name}
                                </strong>
                                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">
                                  {renderNarrative(item.note, "mb-1 last:mb-0")}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="pt-4 flex justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAllSingleSources((current) => !current);
                                setSubFilterChannel("All");
                                setSubSearchQuery("");
                              }}
                              className="px-4 py-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 text-xs font-black transition-all hover:bg-indigo-500/20 flex items-center gap-2"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <span>{showAllSingleSources ? (lang === "en" ? "Hide Full Project List" : "收起完整项目列表") : lang === "en" ? "View Full Project List" : "查看完整项目列表"}</span>
                            </button>
                          </div>

                          {showAllSingleSources ? (
                            <div className="mt-4 rounded-[24px] border border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-100/55 dark:bg-neutral-950/60 px-4 py-4 space-y-4 animate-fade-in-up">
                              <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-neutral-200/50 dark:border-neutral-800/50 pb-4">
                                <div>
                                  <span className="block text-[10px] uppercase tracking-[0.2em] font-black font-mono text-indigo-500 mb-1">
                                    Secondary Telemetry Grid
                                  </span>
                                  <strong className="text-sm md:text-[15px] font-black text-neutral-900 dark:text-white">
                                    {lang === "en" ? "Full Single-Source Investigation Grid" : "全量单信号源探测网格"}
                                  </strong>
                                </div>
                                <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                                  {lang === "en" ? "Matched Projects" : "匹配项目"}: {filteredSingleSources.length} / {props.singleSourceAll.length}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {channelOptions.map((channel) => (
                                  <button
                                    key={channel}
                                    type="button"
                                    onClick={() => setSubFilterChannel(channel)}
                                    className={classNames("run-health-filter-chip", subFilterChannel === channel && "is-active")}
                                  >
                                    {channel}
                                  </button>
                                ))}
                              </div>

                              <input
                                type="text"
                                value={subSearchQuery}
                                onChange={(event) => setSubSearchQuery(event.target.value)}
                                placeholder={lang === "en" ? "Search project names..." : "搜索项目名..."}
                                className="w-full px-4 py-3 rounded-2xl text-sm bg-white/65 dark:bg-slate-950/55 border border-neutral-200/70 dark:border-neutral-800 focus:outline-none focus:border-indigo-500/60 text-neutral-800 dark:text-neutral-100"
                              />

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto no-scrollbar pr-1">
                                {filteredSingleSources.length > 0 ? (
                                  filteredSingleSources.map((item) => (
                                    <div key={item.key} className="rounded-[20px] border border-neutral-200/55 dark:border-neutral-800/60 bg-white/45 dark:bg-slate-950/40 px-4 py-3">
                                      <div className="flex items-start justify-between gap-3 mb-2">
                                        <strong className="min-w-0 text-xs md:text-[13px] font-black font-mono text-neutral-900 dark:text-neutral-100 truncate" title={item.name}>
                                          {item.name}
                                        </strong>
                                        <span className="shrink-0 text-[9px] font-mono px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                                          PENDING
                                        </span>
                                      </div>
                                      <div className="space-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                                        <p>{lang === "en" ? "Source" : "来源"}: <span className="font-mono font-bold text-indigo-500 dark:text-indigo-400">{item.channel}</span></p>
                                        <p>{item.scoreLabel}</p>
                                        <p>{item.note}</p>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="col-span-full rounded-[20px] border border-dashed border-neutral-300/80 dark:border-neutral-800 px-6 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                                    {lang === "en" ? "No projects match the current filters." : "当前筛选条件下没有匹配项目。"}
                                  </div>
                                )}
                              </div>

                              <div className="rounded-[18px] border border-neutral-200/40 dark:border-neutral-800/50 bg-white/20 dark:bg-slate-950/20 px-4 py-3 text-sm leading-7 text-neutral-500 dark:text-neutral-400">
                                {renderNarrative(props.singleSourceFootnote, "mb-2 last:mb-0")}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </button>

                    <button
                      id={TELEMETRY_PANEL_IDS.missingDesc}
                      type="button"
                      onClick={() => setActiveTelemetry((current) => (current === "missingDesc" ? null : "missingDesc"))}
                      className={classNames(
                        "w-full text-left p-4 rounded-[24px] border transition-all",
                        activeTelemetry === "missingDesc"
                          ? "border-amber-500/40 bg-amber-500/[0.05] dark:bg-amber-500/[0.08]"
                          : "border-neutral-200/70 dark:border-neutral-800 hover:bg-white/30 dark:hover:bg-slate-950/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <strong className="text-sm md:text-[15px] font-black text-neutral-900 dark:text-white">
                          {props.missingDescriptionHeading}
                        </strong>
                        <span className="shrink-0 text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                          {activeTelemetry === "missingDesc" ? (lang === "en" ? "COLLAPSE" : "折叠") : lang === "en" ? "DRILL DOWN" : "点击下钻"}
                        </span>
                      </div>
                      <div className="text-sm leading-7 text-neutral-500 dark:text-neutral-400">
                        {renderNarrative(props.missingDescriptionBody, "mb-2 last:mb-0")}
                      </div>

                      {activeTelemetry === "missingDesc" ? (
                        <div className="mt-4 pt-4 border-t border-amber-500/20 space-y-3 animate-fade-in-up">
                          {props.missingDescriptions.map((item) => (
                            <div key={item.key} className="rounded-[20px] border border-neutral-200/60 dark:border-neutral-800/60 bg-white/55 dark:bg-slate-950/45 px-4 py-4">
                              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <strong className="block text-sm md:text-[15px] font-black font-mono text-neutral-900 dark:text-white">
                                    {item.name}
                                  </strong>
                                  <div className="text-sm leading-7 text-amber-600 dark:text-amber-400">
                                    {renderNarrative(item.issue ?? item.reason, "mb-2 last:mb-0")}
                                  </div>
                                </div>
                                <span className="shrink-0 text-[10px] font-black tracking-[0.16em] uppercase rounded-full px-3 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                  {lang === "en" ? "Degraded Metadata" : "降级元数据"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </button>
                  </div>
                </div>

                <div className="mt-7 pt-6 border-t border-neutral-200/50 dark:border-neutral-800/60 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] font-black font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-1 rounded-md">
                      {props.validationLabel}
                    </span>
                    <strong className={classNames("text-sm md:text-[15px] font-black font-mono uppercase", verdictTone)}>
                      {props.validationStatus}
                    </strong>
                  </div>
                  <div className="rounded-[22px] border border-emerald-500/10 bg-white/30 dark:bg-slate-950/25 px-4 py-3">
                    {renderNarrative(props.validationDescription, "border-l-2 border-emerald-500/30 pl-3 text-sm leading-7 text-neutral-700 dark:text-neutral-300")}
                  </div>
                </div>
              </section>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-6">
              <section className="glass-panel hologram-border p-6 rounded-[32px] shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between gap-4 mb-5 border-b border-neutral-200/40 dark:border-neutral-800/60 pb-4">
                  <strong className="text-base md:text-[17px] font-black tracking-[-0.03em] text-neutral-900 dark:text-white">
                    {props.pipelinesTitle}
                  </strong>
                  <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">{props.activeNodesLabel}</span>
                </div>

                <div className="space-y-3">
                  {props.pipelines.map((pipeline) => (
                    <div key={pipeline.key} className="rounded-[20px] border border-neutral-200/50 dark:border-neutral-800/60 bg-white/40 dark:bg-neutral-950/40 px-4 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex items-center gap-3">
                          <span className={classNames("w-2.5 h-2.5 rounded-full bg-emerald-500", pipeline.active ? "animate-pulse" : "opacity-30")} />
                          <div className="min-w-0">
                            <strong className="block text-xs md:text-[13px] font-black font-mono text-neutral-900 dark:text-neutral-100 truncate">
                              {pipeline.label}
                            </strong>
                            <span className="block text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">{pipeline.notes}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-[11px]">
                          <span className="block text-neutral-500 dark:text-neutral-400">{pipeline.enabledLabel}</span>
                          <strong className="block font-mono text-neutral-800 dark:text-neutral-200 mt-1">{pipeline.docs} docs</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <section className="run-health-hidden-compat" aria-hidden="true">
            <h2>{props.compatibilitySummaryTitle}</h2>
            <h2>{props.compatibilitySourceTitle}</h2>
            <table className="run-health-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Enabled</th>
                  <th>Count</th>
                  <th>Distinct Projects</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {props.sourceTableRows.map((row) => (
                  <tr key={row.source}>
                    <td>{row.source}</td>
                    <td>{row.enabledLabel}</td>
                    <td>{row.countLabel}</td>
                    <td>{row.distinctProjectsLabel}</td>
                    <td>{row.statusLabel}</td>
                    <td>{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>{props.compatibilityAuditTitle}</h2>
            <h3>{props.compatibilityVerifyTitle}</h3>
            <div>{props.verifySectionTitle}</div>
            {props.verifyChecks.map((item) => (
              <p key={item.key}>
                {item.name}: {item.statusLabel} ({item.detail})
              </p>
            ))}
            <table className="run-health-table">
              <thead>
                <tr>
                  <th>Repository</th>
                  <th>Status</th>
                  <th>Metrics Applied</th>
                </tr>
              </thead>
              <tbody>
                {props.auditRows.map((row) => (
                  <tr key={row.repoFullName}>
                    <td>{row.repoFullName}</td>
                    <td>{row.statusLabel}</td>
                    <td>{row.metricsAppliedLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>{props.compatibilityActionTitle}</h2>
          </section>
        </div>
      </div>
    </>
  );
}
