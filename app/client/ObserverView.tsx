import React, { useEffect, useState } from "react";

export type ObserverEntry = {
  key: string;
  repoFullName: string;
  projectHref: string;
  repoUrl: string;
  isTracked: boolean;
  radarScore: number;
  baseObserverScore: number;
  trendPath: string;
  stars: number;
  forks: number;
  issues: number;
  prs: number;
  attentionReason: string;
  freshnessTag: string;
  hostLevel: string;
  historyHit: string;
  qualification: string;
  observedAt: string;
  summarySource: string;
  judgeSource: string;
  judgeDelta: string;
  whyItMatters: string;
  whyNow: string;
  verdict: string;
  recommendation: string;
  ecosystems: string[];
  labels: string[];
  pedigreeTokens: string[];
  keywords: string[];
  topics: string[];
  repoSeeds: string[];
  orgSeeds: string[];
  searchOrganizations?: string[];
  searchText?: string;
};

export type ObserverViewProps = {
  lang?: "zh" | "en";
  initialTheme: "light" | "dark";
  pageBadge: string;
  pageTitle: string;
  pageSummary: string;
  pageSummaryCaption: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchSuggestionsLabel: string;
  searchSuggestions: string[];
  searchExamples: string[];
  searchHelperBody: string;
  searchEmptyTitle: string;
  searchEmptyBody: string;
  detailEmptyTitle: string;
  detailEmptyBody: string;
  telemetryStatusLabel: string;
  telemetryStatusValue: string;
  telemetryGeneratedAtLabel: string;
  telemetryGeneratedAtValue: string;
  telemetryModeLabel: string;
  telemetryModeValue: string;
  telemetrySourceHealthLabel: string;
  telemetrySourceHealthValue: string;
  telemetryCandidateCountLabel: string;
  telemetryCandidateCountValue: string;
  telemetryEcosystemCountLabel: string;
  telemetryEcosystemCountValue: string;
  guidanceJudgeLabel: string;
  guidanceJudgeBody: string;
  guidanceLinkageLabel: string;
  guidanceLinkageBody: string;
  detailStageLabel: string;
  detailStageStatus: string;
  closeLabel: string;
  openProjectLabel: string;
  openRepositoryLabel: string;
  keepTrackingLabel: string;
  keepTrackingActiveLabel: string;
  observerScoreLabel: string;
  watchReasonLabel: string;
  freshnessLabel: string;
  tierLabel: string;
  historyLabel: string;
  whyNowTitle: string;
  positionTitle: string;
  recommendationTitle: string;
  semanticSignalsTitle: string;
  semanticSignalsHint: string;
  pedigreeLabel: string;
  keywordsLabel: string;
  topicsLabel: string;
  repoSeedsLabel: string;
  orgSeedsLabel: string;
  ecosystemsLabel: string;
  labelsLabel: string;
  summarySourceLabel: string;
  judgeSourceLabel: string;
  observedAtLabel: string;
  judgeDeltaLabel: string;
  notes: string[];
  ecosystemBadges: string[];
  entries: ObserverEntry[];
  initialSelectedKey: string | null;
  canTrack: boolean;
  trackingActionPath: string;
  trackingReturnTo: string;
  trackingSignInHref: string;
  signInToTrackLabel: string;
  csrfToken: string;
  trackingStatusRepoKey: string | null;
  trackingStatusMessage: string;
  trackingStatusTone: "success" | "neutral" | "error";
};

export type ObserverPagination<T> = {
  items: T[];
  currentPage: number;
  pageCount: number;
  pageSize: number;
  totalCount: number;
  startIndex: number;
  endIndex: number;
};

declare global {
  interface Window {
    __OBSERVER_INITIAL_DATA__?: Partial<ObserverViewProps>;
  }
}

const DEFAULT_PROPS: ObserverViewProps = {
  lang: "zh",
  initialTheme: "light",
  pageBadge: "",
  pageTitle: "",
  pageSummary: "",
  pageSummaryCaption: "",
  searchLabel: "",
  searchPlaceholder: "",
  searchSuggestionsLabel: "",
  searchSuggestions: [],
  searchExamples: [],
  searchHelperBody: "",
  searchEmptyTitle: "",
  searchEmptyBody: "",
  detailEmptyTitle: "",
  detailEmptyBody: "",
  telemetryStatusLabel: "",
  telemetryStatusValue: "",
  telemetryGeneratedAtLabel: "",
  telemetryGeneratedAtValue: "",
  telemetryModeLabel: "",
  telemetryModeValue: "",
  telemetrySourceHealthLabel: "",
  telemetrySourceHealthValue: "",
  telemetryCandidateCountLabel: "",
  telemetryCandidateCountValue: "",
  telemetryEcosystemCountLabel: "",
  telemetryEcosystemCountValue: "",
  guidanceJudgeLabel: "",
  guidanceJudgeBody: "",
  guidanceLinkageLabel: "",
  guidanceLinkageBody: "",
  detailStageLabel: "",
  detailStageStatus: "",
  closeLabel: "",
  openProjectLabel: "",
  openRepositoryLabel: "",
  keepTrackingLabel: "",
  keepTrackingActiveLabel: "",
  observerScoreLabel: "",
  watchReasonLabel: "",
  freshnessLabel: "",
  tierLabel: "",
  historyLabel: "",
  whyNowTitle: "",
  positionTitle: "",
  recommendationTitle: "",
  semanticSignalsTitle: "",
  semanticSignalsHint: "",
  pedigreeLabel: "",
  keywordsLabel: "",
  topicsLabel: "",
  repoSeedsLabel: "",
  orgSeedsLabel: "",
  ecosystemsLabel: "",
  labelsLabel: "",
  summarySourceLabel: "",
  judgeSourceLabel: "",
  observedAtLabel: "",
  judgeDeltaLabel: "",
  notes: [],
  ecosystemBadges: [],
  entries: [],
  initialSelectedKey: null,
  canTrack: false,
  trackingActionPath: "",
  trackingReturnTo: "",
  trackingSignInHref: "",
  signInToTrackLabel: "",
  csrfToken: "",
  trackingStatusRepoKey: null,
  trackingStatusMessage: "",
  trackingStatusTone: "neutral",
};

const OBSERVER_PAGE_SIZE = 15;

const OVERVIEW_DARK_BODY_BACKGROUND = String.raw`
    background-color: #0a0a0a;
    background-image:
      radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 0),
      linear-gradient(to right, rgba(255, 255, 255, 0.012) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.012) 1px, transparent 1px);
    background-size: 24px 24px;
`;

const OBSERVER_REFERENCE_STYLES = String.raw`
  :root {
    --bg-gradient-light: radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.04) 0%, transparent 45%),
      radial-gradient(circle at 100% 100%, rgba(6, 182, 212, 0.04) 0%, transparent 45%),
      linear-gradient(to bottom, #f8fafc, #f1f5f9);
  }

  body[data-route="observer"] {
    background: var(--bg-gradient-light);
    min-height: 100vh;
    overflow-x: clip;
    transition: background 0.4s ease;
  }

  body[data-route="observer"] .app-shell.app-shell-console {
    max-width: min(1680px, calc(100vw - 24px));
    padding: 6px 10px 28px;
    gap: 14px !important;
  }

  html.dark body[data-route="observer"],
  html[data-theme="dark"] body[data-route="observer"],
  body.theme-dark[data-route="observer"] {
${OVERVIEW_DARK_BODY_BACKGROUND}
  }

  body[data-route="observer"] .primary-content,
  body[data-route="observer"] .route-frame-observer,
  body[data-route="observer"] .route-console-shell {
    overflow: visible !important;
    min-height: auto !important;
  }

  body[data-route="observer"] .atmosphere-layer,
  body[data-route="observer"] .atmosphere-layer-grid {
    display: none !important;
  }

  .observer-view {
    position: relative;
    isolation: isolate;
    color: #262626;
  }

  html.dark .observer-view,
  body.theme-dark .observer-view {
    color: #f5f5f5;
  }

  .observer-view .grid-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    opacity: 0.25;
    background-size: 40px 40px;
    background-image:
      linear-gradient(to right, rgba(99, 102, 241, 0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(99, 102, 241, 0.05) 1px, transparent 1px);
  }

  html.dark .observer-view .grid-overlay,
  body.theme-dark .observer-view .grid-overlay {
    opacity: 0.1;
    background-size: 44px 44px;
    background-image:
      linear-gradient(to right, rgba(255, 255, 255, 0.009) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.009) 1px, transparent 1px);
  }

  .observer-view .glass-panel {
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(99, 102, 241, 0.08);
    box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.03), 0 1px 1px 0 rgba(99, 102, 241, 0.02);
  }

  html.dark .observer-view .glass-panel,
  body.theme-dark .observer-view .glass-panel {
    background: rgba(10, 15, 28, 0.72);
    border: 1px solid rgba(148, 163, 184, 0.12);
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.34),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .observer-view .hologram-border {
    position: relative;
  }

  .observer-view .hologram-border::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1.2px;
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.42) 0%,
      rgba(6, 182, 212, 0.12) 50%,
      rgba(139, 92, 246, 0.42) 100%
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    opacity: 0.7;
    transition: opacity 0.3s ease;
  }

  .observer-view .hologram-border:hover::before {
    opacity: 1;
  }

  .observer-view .observer-shell {
    width: min(100%, 1280px);
    margin: 0 auto;
    padding: 8px 0 40px;
    position: relative;
    z-index: 1;
  }

  .observer-view .observer-line-clamp-1 {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
  }

  .observer-view .observer-line-clamp-2 {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .observer-view .observer-copy p {
    margin: 0;
  }

  .observer-view .observer-copy p + p {
    margin-top: 8px;
  }

  .observer-view .observer-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .observer-view .observer-chip {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    border-radius: 999px;
    padding: 0 13px;
    font-size: 11.5px;
    line-height: 1;
    letter-spacing: 0.01em;
  }

  .observer-view .observer-chip-micro {
    min-height: 28px;
    padding: 0 11px;
    font-size: 11px;
  }

  .observer-view .observer-chip-compact {
    min-height: 24px;
    padding: 0 10px;
    font-size: 10px;
  }

  .observer-view .observer-text-grid {
    display: grid;
    gap: 12px;
  }

  @keyframes observer-radar-pulse {
    0% { transform: scale(0.95); opacity: 0.1; }
    50% { opacity: 0.3; }
    100% { transform: scale(1.14); opacity: 0; }
  }

  .observer-view .observer-radar-glow {
    animation: observer-radar-pulse 4s infinite ease-in-out;
  }

  @media (max-width: 1024px) {
    .observer-view .observer-shell {
      padding-inline: 4px;
    }
  }

  @media (max-width: 1024px) {
    body[data-route="observer"] .app-shell.app-shell-console {
      max-width: 100%;
      padding: 8px 10px 16px;
    }

    .observer-view .observer-react-detail-stage {
      display: none;
    }

    .observer-view .observer-shell {
      padding-inline: 0;
    }

    .observer-view .observer-react-entry-card {
      min-height: 148px;
      height: auto !important;
    }

    .observer-view .observer-mobile-detail-backdrop {
      position: fixed;
      inset: 0;
      z-index: 69;
      border: 0;
      background: rgba(6, 11, 25, 0.36);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
    }

    .observer-view .observer-react-detail-stage-mobile {
      position: fixed;
      inset: 0;
      z-index: 70;
      display: flex;
      align-items: flex-end;
      padding: max(8px, env(safe-area-inset-top)) 8px 0;
      pointer-events: none;
    }

    .observer-view .observer-react-detail-card-mobile {
      pointer-events: auto;
      height: calc(100dvh - max(8px, env(safe-area-inset-top)));
      max-height: calc(100dvh - max(8px, env(safe-area-inset-top)));
      border-radius: 24px 24px 0 0;
      padding: 14px 14px calc(14px + env(safe-area-inset-bottom));
    }

    .observer-view .observer-react-detail-card-mobile .observer-react-detail-scroll-region {
      padding-bottom: 24px;
    }

    body[data-route="observer"].observer-mobile-detail-open {
      overflow: hidden;
    }
  }
`;

function readPayloadFromDom(): Partial<ObserverViewProps> | null {
  if (typeof document === "undefined") return null;
  const payloadNode = document.getElementById("observer-react-payload");
  if (!payloadNode?.textContent) return null;

  try {
    return JSON.parse(payloadNode.textContent) as Partial<ObserverViewProps>;
  } catch {
    return null;
  }
}

function readPayloadFromWindow(): Partial<ObserverViewProps> | null {
  if (typeof window === "undefined") return null;
  const payload = window.__OBSERVER_INITIAL_DATA__;
  return payload && typeof payload === "object" ? payload : null;
}

export function parseObserverViewPayload(): ObserverViewProps {
  const payload = readPayloadFromDom() ?? readPayloadFromWindow() ?? {};
  return {
    ...DEFAULT_PROPS,
    ...payload,
    searchSuggestions: payload.searchSuggestions ?? DEFAULT_PROPS.searchSuggestions,
    searchExamples: payload.searchExamples ?? DEFAULT_PROPS.searchExamples,
    notes: payload.notes ?? DEFAULT_PROPS.notes,
    ecosystemBadges: payload.ecosystemBadges ?? DEFAULT_PROPS.ecosystemBadges,
    entries: payload.entries ?? DEFAULT_PROPS.entries,
  };
}

function splitAcademicParagraphs(text: string): string[] {
  return text
    .split(/(?<=[銆傦紒锛燂紱.!?;|])/)
    .map((part) => part.replaceAll("|", " ").trim())
    .filter(Boolean);
}

function extractLeadParagraph(text: string): string {
  const parts = splitAcademicParagraphs(text);
  return parts[0] ?? text.trim();
}

function renderParagraphBlocks(text: string, className: string): React.ReactNode {
  const parts = splitAcademicParagraphs(text);
  if (parts.length === 0) {
    return <p className={className}>{text}</p>;
  }

  return parts.map((part, index) => (
    <p key={`${part.slice(0, 12)}-${index}`} className={className}>
      {part}
    </p>
  ));
}

function renderParagraphPreview(text: string, className: string, limit = 2): React.ReactNode {
  const parts = splitAcademicParagraphs(text).slice(0, limit);
  if (parts.length === 0) {
    return <p className={className}>{text}</p>;
  }

  return parts.map((part, index) => (
    <p key={`${part.slice(0, 12)}-${index}`} className={className}>
      {part}
    </p>
  ));
}

function compactSignalGroups(
  entry: ObserverEntry | null,
  lang: "zh" | "en",
): Array<{ label: string; tone: "indigo" | "emerald" | "cyan" | "neutral" | "amber"; values: string[] }> {
  if (!entry) return [];

  const keywordAndTopics = uniqueStrings([...entry.keywords.map((value) => `#${value}`), ...entry.topics.map((value) => `@${value}`)]);
  const seedValues = uniqueStrings([...entry.repoSeeds, ...entry.orgSeeds.map((value) => `org:${value}`)]);
  const ecosystemAndLabels = uniqueStrings([...entry.ecosystems, ...entry.labels]);
  const isZh = lang === "zh";

  const groups: Array<{ label: string; tone: "indigo" | "emerald" | "cyan" | "neutral" | "amber"; values: string[] }> = [
    { label: isZh ? "谱系" : "Pedigree", tone: "neutral", values: entry.pedigreeTokens },
    { label: isZh ? "关键词" : "Keywords", tone: "indigo", values: keywordAndTopics },
    { label: isZh ? "种子" : "Seeds", tone: "cyan", values: seedValues },
    { label: isZh ? "信号" : "Signals", tone: "emerald", values: ecosystemAndLabels },
  ];

  return groups.filter((group) => group.values.length > 0);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
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

function companySearchAliases(values: Array<string | null | undefined>): string[] {
  const aliases: string[] = [];
  const haystack = values.map((value) => String(value ?? "")).join(" ");
  for (const [pattern, candidates] of COMPANY_SEARCH_ALIASES) {
    if (pattern.test(haystack)) aliases.push(...candidates);
  }
  return uniqueStrings(aliases);
}

function lowerJoined(values: Array<string | null | undefined>): string {
  return values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function repoNameSearchVariants(repoFullName: string): string[] {
  const trimmed = repoFullName.trim();
  const [owner, repo] = trimmed.split("/", 2);
  return uniqueStrings([trimmed, owner ?? "", repo ?? ""]);
}

function pedigreeCompanyTokens(entry: ObserverEntry): string[] {
  return entry.pedigreeTokens
    .filter((token) => token.startsWith("company:"))
    .map((token) => token.slice("company:".length))
    .filter(Boolean);
}

function scoreObserverEntryMatch(entry: ObserverEntry, normalizedQuery: string): number {
  const repoVariants = repoNameSearchVariants(entry.repoFullName);
  const repoNameText = lowerJoined(repoVariants);
  const organizationText = lowerJoined([
    ...repoVariants,
    ...(entry.searchOrganizations ?? []),
    ...pedigreeCompanyTokens(entry),
    ...entry.orgSeeds,
    ...companySearchAliases([
      ...repoVariants,
      ...(entry.searchOrganizations ?? []),
      ...pedigreeCompanyTokens(entry),
      ...entry.orgSeeds,
      entry.searchText,
    ]),
  ]);
  const thematicText = lowerJoined([...entry.ecosystems, ...entry.keywords, ...entry.topics, ...entry.labels, ...entry.repoSeeds, ...entry.orgSeeds]);
  const narrativeText = lowerJoined([
    entry.attentionReason,
    entry.freshnessTag,
    entry.hostLevel,
    entry.historyHit,
    entry.whyItMatters,
    entry.whyNow,
    entry.searchText,
  ]);

  if (repoVariants.some((value) => value.toLowerCase() === normalizedQuery)) return 600;
  if (repoNameText.includes(normalizedQuery)) return 520;
  if (organizationText.includes(normalizedQuery)) return 380;
  if (thematicText.includes(normalizedQuery)) return 240;
  if (narrativeText.includes(normalizedQuery)) return 120;
  return -1;
}

export function filterObserverEntries(entries: ObserverEntry[], searchQuery: string): ObserverEntry[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) return entries;

  return entries
    .map((entry, index) => ({ entry, index, score: scoreObserverEntryMatch(entry, normalizedQuery) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.entry);
}

export function paginateObserverEntries<T>(entries: T[], page: number, pageSize: number): ObserverPagination<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize) || 1);
  const totalCount = entries.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / safePageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * safePageSize;
  const endIndex = totalCount === 0 ? 0 : Math.min(startIndex + safePageSize, totalCount);

  return {
    items: entries.slice(startIndex, endIndex),
    currentPage,
    pageCount,
    pageSize: safePageSize,
    totalCount,
    startIndex,
    endIndex,
  };
}

function normalizeWheelDelta(event: Pick<WheelEvent, "deltaMode" | "deltaY"> | Pick<React.WheelEvent, "deltaMode" | "deltaY">): number {
  if (event.deltaMode === 1) return event.deltaY * 16;
  if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
  return event.deltaY;
}

function syncThemeClasses(theme: "light" | "dark"): void {
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
}

function MetricCell(props: { label: string; value: string | number }) {
  return (
    <div className="py-2 px-2.5 rounded-[18px] bg-white/45 dark:bg-slate-950/45 border border-indigo-100/60 dark:border-slate-800/70 text-center shadow-inner">
      <span className="block text-[9px] uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500 font-mono mb-1">{props.label}</span>
      <span className="block text-[14px] md:text-[15px] font-black text-neutral-800 dark:text-neutral-100 font-mono">{props.value}</span>
    </div>
  );
}

function SignalChip(props: { label: string; tone?: "indigo" | "emerald" | "cyan" | "neutral" | "amber"; size?: "micro" | "compact" }) {
  const palette =
    props.tone === "emerald"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20"
      : props.tone === "cyan"
        ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/20"
        : props.tone === "amber"
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20"
          : props.tone === "neutral"
            ? "bg-white/55 dark:bg-slate-950/55 text-neutral-600 dark:text-neutral-300 border border-neutral-200/60 dark:border-slate-800/70"
          : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20";

  const sizeClass = props.size === "compact" ? "observer-chip-compact" : "observer-chip-micro";

  return <span className={`observer-chip ${sizeClass} ${palette}`}>{props.label}</span>;
}

function ObserverPaginationControls(props: {
  currentPage: number;
  pageCount: number;
  totalCount: number;
  startIndex: number;
  endIndex: number;
  onPrevious: () => void;
  onNext: () => void;
  isZh: boolean;
}) {
  const status = props.totalCount === 0 ? "0 / 0" : `${props.currentPage} / ${props.pageCount}`;
  const previousLabel = props.isZh ? "上一页" : "Previous";
  const nextLabel = props.isZh ? "下一页" : "Next";

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <button
        type="button"
        data-observer-page-prev="true"
        onClick={props.onPrevious}
        disabled={props.totalCount === 0 || props.currentPage <= 1}
        className="min-h-[34px] rounded-full border border-indigo-100/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/60 px-3 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 transition hover:border-indigo-300/80 hover:text-indigo-600 dark:hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {previousLabel}
      </button>
      <span
        data-observer-page-status="true"
        className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 min-w-[52px] text-center"
      >
        {status}
      </span>
      <button
        type="button"
        data-observer-page-next="true"
        onClick={props.onNext}
        disabled={props.totalCount === 0 || props.currentPage >= props.pageCount}
        className="min-h-[34px] rounded-full border border-indigo-100/70 dark:border-slate-800/80 bg-white/70 dark:bg-slate-950/60 px-3 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 transition hover:border-indigo-300/80 hover:text-indigo-600 dark:hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function TrackingStatusBanner(props: { message: string; tone: "success" | "neutral" | "error" }) {
  if (!props.message) return null;

  const palette =
    props.tone === "success"
      ? "border-emerald-200/70 bg-emerald-500/[0.07] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/[0.12] dark:text-emerald-200"
      : props.tone === "error"
        ? "border-rose-200/70 bg-rose-500/[0.07] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/[0.12] dark:text-rose-200"
        : "border-indigo-200/70 bg-indigo-500/[0.07] text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/[0.12] dark:text-indigo-200";

  return <div className={`mb-3 rounded-[18px] border px-3 py-2 text-[12px] md:text-[13px] font-semibold ${palette}`}>{props.message}</div>;
}

export default function ObserverView(rawProps: ObserverViewProps): React.ReactElement {
  const props: ObserverViewProps = {
    ...DEFAULT_PROPS,
    ...rawProps,
    notes: rawProps.notes ?? DEFAULT_PROPS.notes,
    ecosystemBadges: rawProps.ecosystemBadges ?? DEFAULT_PROPS.ecosystemBadges,
    entries: rawProps.entries ?? DEFAULT_PROPS.entries,
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchSuggestionIndex, setSearchSuggestionIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(props.initialSelectedKey ?? props.entries[0]?.key ?? null);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailScrollActive, setDetailScrollActive] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const detailScrollRef = React.useRef<HTMLDivElement | null>(null);
  const mobileSelectionPrimedRef = React.useRef(false);
  const isZh = props.lang !== "en";
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const normalizedSuggestions = props.searchSuggestions.filter(Boolean);
  const activeSuggestion = normalizedSuggestions[searchSuggestionIndex % Math.max(normalizedSuggestions.length, 1)] ?? "";
  const showSuggestion = normalizedSearch.length === 0 && !searchFocused && Boolean(activeSuggestion);

  useEffect(() => {
    const html = document.documentElement;
    const resolvedTheme =
      html.classList.contains("dark") || html.getAttribute("data-theme") === "dark" || props.initialTheme === "dark" ? "dark" : "light";
    syncThemeClasses(resolvedTheme);

    const previousOverflowX = document.body.style.overflowX;
    document.body.style.overflowX = "clip";

    return () => {
      document.body.style.overflowX = previousOverflowX;
    };
  }, [props.initialTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport || mobileSelectionPrimedRef.current) return;
    mobileSelectionPrimedRef.current = true;
    setSelectedKey(null);
  }, [isMobileViewport]);

  useEffect(() => {
    if (props.entries.length === 0) {
      setSelectedKey(null);
      return;
    }

    if (selectedKey === null) {
      return;
    }

    const exists = props.entries.some((entry) => entry.key === selectedKey);
    if (!exists) {
      setSelectedKey(props.entries[0]?.key ?? null);
    }
  }, [props.entries, selectedKey]);

  useEffect(() => {
    if (normalizedSuggestions.length <= 1) return;
    const timer = window.setInterval(() => {
      setSearchSuggestionIndex((current) => (current + 1) % normalizedSuggestions.length);
    }, 2400);
    return () => {
      window.clearInterval(timer);
    };
  }, [normalizedSuggestions.length]);

  const filteredEntries = filterObserverEntries(props.entries, normalizedSearch);
  const paginatedEntries = paginateObserverEntries(filteredEntries, currentPage, OBSERVER_PAGE_SIZE);
  const visibleEntries = paginatedEntries.items;

  const selectedEntry =
    selectedKey === null
      ? null
      : visibleEntries.find((entry) => entry.key === selectedKey) ?? null;
  const scopedTrackingStatusMessage =
    selectedEntry && props.trackingStatusRepoKey === selectedEntry.key ? props.trackingStatusMessage : "";
  const selectedSignalGroups = compactSignalGroups(selectedEntry, isZh ? "zh" : "en");
  const previewEcosystemBadges = props.ecosystemBadges.slice(0, 4);
  const previewNotes = props.notes.slice(0, 2);

  useEffect(() => {
    setCurrentPage(1);
  }, [normalizedSearch]);

  useEffect(() => {
    if (paginatedEntries.currentPage !== currentPage) {
      setCurrentPage(paginatedEntries.currentPage);
    }
  }, [currentPage, paginatedEntries.currentPage]);

  useEffect(() => {
    if (selectedKey === null) return;
    const selectedVisible = visibleEntries.some((entry) => entry.key === selectedKey);
    if (!selectedVisible) {
      setSelectedKey(null);
    }
  }, [selectedKey, visibleEntries]);

  useEffect(() => {
    const scrollNode = detailScrollRef.current;
    if (scrollNode) scrollNode.scrollTo({ top: 0, behavior: "auto" });
    setDetailScrollActive(isMobileViewport);
  }, [isMobileViewport, selectedEntry?.key]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const scrollNode = detailScrollRef.current;
      if (!scrollNode || !(event.target instanceof Node)) return;
      setDetailScrollActive(scrollNode.closest(".observer-react-detail-card")?.contains(event.target) ?? false);
    };

    const handleFocusIn = (event: FocusEvent) => {
      const scrollNode = detailScrollRef.current;
      if (!scrollNode || !(event.target instanceof Node)) return;
      setDetailScrollActive(scrollNode.closest(".observer-react-detail-card")?.contains(event.target) ?? false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const shouldLockViewport = isMobileViewport && Boolean(selectedEntry);
    document.body.classList.toggle("observer-mobile-detail-open", shouldLockViewport);
    const navShell = document.querySelector("[data-nav-shell='auto-hide']");
    if (navShell instanceof HTMLElement) {
      if (shouldLockViewport) {
        navShell.classList.add("is-nav-hidden");
      } else if (typeof window !== "undefined" && window.scrollY <= 24) {
        navShell.classList.remove("is-nav-hidden");
      }
    }

    return () => {
      document.body.classList.remove("observer-mobile-detail-open");
    };
  }, [isMobileViewport, selectedEntry]);

  const handleDetailWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const scrollNode = detailScrollRef.current;
    const deltaY = normalizeWheelDelta(event);

    if (!scrollNode || deltaY === 0) return;

    if (!detailScrollActive) {
      return;
    }

    if (event.target instanceof Node && scrollNode.contains(event.target)) {
      return;
    }

    event.preventDefault();
    scrollNode.scrollBy({ top: deltaY, behavior: "auto" });
  };

  return (
    <>
      <style>{OBSERVER_REFERENCE_STYLES}</style>
      <div className="observer-view observer-react-surface !bg-transparent !p-0 !shadow-none overflow-x-clip">
        <div className="grid-overlay" />

        <div className="observer-shell">
          <section className="flex flex-col items-center text-center mb-4 md:mb-6 px-0.5 sm:px-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/15 bg-indigo-500/8 px-3.5 py-1 text-[10px] md:text-[11px] font-bold tracking-[0.18em] uppercase text-indigo-600 dark:text-indigo-300 mb-3 md:mb-4">
              <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_16px_rgba(99,102,241,0.55)] animate-pulse" />
              <span>{props.pageBadge}</span>
            </div>
            <h1 className="max-w-5xl text-[1.9rem] sm:text-[2.25rem] md:text-[3.5rem] leading-[0.98] sm:leading-[0.94] tracking-[-0.06em] md:tracking-[-0.08em] font-black text-neutral-950 dark:text-white">
              {props.pageTitle}
            </h1>
            <p className="max-w-4xl mt-3 text-[13px] md:text-[15px] leading-6 md:leading-7 font-medium text-neutral-600 dark:text-neutral-300">
              {props.pageSummary}
            </p>
            <p className="max-w-2xl mt-2 text-[11px] md:text-[13px] leading-5 md:leading-6 text-neutral-500 dark:text-neutral-400">
              {props.pageSummaryCaption}
            </p>
          </section>

          <section className="mb-4 md:mb-6">
            <label className="sr-only" htmlFor="observer-search-input">
              {props.searchLabel}
            </label>
            <div className="glass-panel hologram-border rounded-[22px] md:rounded-[26px] px-2.5 md:px-3 py-2.5 md:py-3">
              <div className="relative">
                <input
                  id="observer-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder={props.searchPlaceholder}
                  className="w-full rounded-2xl border border-indigo-100/70 dark:border-slate-800/80 bg-white/75 dark:bg-slate-950/70 px-12 md:px-14 py-2.5 md:py-3 text-[13px] md:text-sm text-neutral-800 dark:text-neutral-100 outline-none transition focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/10"
                />
                <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-neutral-400 dark:text-neutral-500">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
                  </svg>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {props.searchExamples.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setSearchQuery(term)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100/70 dark:border-slate-800/80 bg-white/55 dark:bg-slate-950/45 px-3 py-1 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 transition hover:border-indigo-300/80 hover:text-indigo-600 dark:hover:text-indigo-300"
                    >
                      <span aria-hidden="true">🔥</span>
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between px-1 mb-2.5 md:mb-3">
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                共找到 {filteredEntries.length} 条结果
              </p>
            </div>
            <div className="text-right flex flex-wrap items-center justify-end gap-2">
              <ObserverPaginationControls
                currentPage={paginatedEntries.currentPage}
                pageCount={paginatedEntries.pageCount}
                totalCount={paginatedEntries.totalCount}
                startIndex={paginatedEntries.startIndex}
                endIndex={paginatedEntries.endIndex}
                onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
                onNext={() => setCurrentPage((page) => page + 1)}
                isZh={isZh}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
            <div className="lg:col-span-6 observer-react-candidate-stage">
              <div className="glass-panel hologram-border rounded-[24px] md:rounded-[26px] px-2.5 md:px-4 py-2.5 md:py-4">
                {filteredEntries.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-indigo-100/80 dark:border-slate-800/80 bg-white/45 dark:bg-slate-950/40 px-5 py-10 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-indigo-200/70 dark:border-slate-700/80 text-neutral-400 dark:text-neutral-500">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 0 1 5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-100">{props.searchEmptyTitle}</h3>
                    <p className="mt-2 text-xs leading-6 text-neutral-500 dark:text-neutral-400">{props.searchEmptyBody}</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {visibleEntries.map((entry) => {
                      const isSelected = selectedEntry?.key === entry.key;
                      return (
                        <button
                          key={entry.key}
                          type="button"
                          onClick={() => setSelectedKey(entry.key)}
                          className={`observer-react-entry-card w-full text-left glass-panel hologram-border py-6 px-5 rounded-[18px] flex flex-col justify-between transition-all duration-300 relative overflow-hidden min-h-[184px] ${
                            isSelected
                              ? "ring-2 ring-indigo-500/30 shadow-md translate-y-[-1px] border-indigo-500/40 bg-indigo-50/10 dark:bg-indigo-950/10"
                              : "hover:translate-y-[-1px] hover:bg-neutral-50/40 dark:hover:bg-neutral-900/40"
                          }`}
                          style={{ contentVisibility: "auto", containIntrinsicSize: "184px 620px", contain: "layout style paint" }}
                        >
                          <div className="pl-1">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <h3 className="font-bold text-[14px] md:text-[16px] font-mono text-neutral-900 dark:text-white tracking-tight flex flex-1 items-center gap-1.5 min-w-0 leading-snug">
                                <span className="truncate block flex-1 min-w-0">{entry.repoFullName}</span>
                                {isSelected ? (
                                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/50 animate-pulse shrink-0"></span>
                                ) : (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                )}
                              </h3>
                              <span className="text-[12px] md:text-[13px] font-mono font-bold px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-indigo-600 dark:text-indigo-300 shrink-0">
                                {props.observerScoreLabel} {entry.radarScore}
                              </span>
                            </div>

                            <div className="text-[17px] text-neutral-500 dark:text-neutral-400 leading-7 mb-3 observer-line-clamp-2">
                              {extractLeadParagraph(entry.whyItMatters)}
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-neutral-100 dark:border-slate-800/80 pt-3 pl-1 shrink-0">
                            <div className="flex items-center space-x-2 text-[12px] md:text-[13px] min-w-0">
                              <span className="font-bold font-mono text-neutral-700 dark:text-neutral-300">
                                {entry.stars} stars
                              </span>
                              <span className="text-neutral-300 dark:text-slate-700">|</span>
                              <span className="font-semibold text-neutral-400 truncate max-w-[90px]">
                                {entry.attentionReason}
                              </span>
                            </div>

                            <div className="flex items-center space-x-1.5">
                              <svg className="w-10 h-3 shrink-0" viewBox="0 0 72 20" fill="none">
                                <path d={entry.trendPath} stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <span className="text-[11px] md:text-[12px] font-bold text-indigo-500 dark:text-indigo-300 flex items-center">
                                <span>{entry.qualification}</span>
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {!isMobileViewport ? (
              <div className="lg:col-span-6 lg:sticky lg:top-24 lg:!top-2 xl:!top-0 self-start observer-react-detail-stage">
                {selectedEntry ? (
                  <div
                    className={`observer-react-detail-card glass-panel hologram-border w-full lg:max-w-[96%] xl:max-w-[92%] mx-auto p-4 md:p-5 rounded-[28px] flex min-h-[620px] md:min-h-[640px] lg:min-h-0 lg:h-[calc(100dvh-1rem)] xl:h-[calc(100dvh-0.5rem)] flex-col relative shadow-sm overflow-hidden transition-shadow ${
                      detailScrollActive ? "shadow-[0_18px_48px_-24px_rgba(79,70,229,0.48)]" : ""
                    }`}
                    onWheel={handleDetailWheel}
                  >
                    <div className="absolute -right-16 -top-16 w-44 h-44 rounded-full border border-indigo-500/5 dark:border-indigo-500/10 pointer-events-none flex items-center justify-center">
                      <div className="w-24 h-24 rounded-full border border-indigo-500/5 dark:border-indigo-500/10 observer-radar-glow"></div>
                    </div>

                    <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                      <TrackingStatusBanner message={scopedTrackingStatusMessage} tone={props.trackingStatusTone} />

                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[12px] md:text-[13px] font-black uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500 font-mono">
                          {props.detailStageLabel}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span className="text-[12px] md:text-[13px] text-amber-500 font-mono font-bold">{props.detailStageStatus}</span>
                        </div>
                      </div>

                      <div className="flex items-start justify-between border-b border-neutral-200/40 dark:border-slate-800/40 pb-3 mb-3 gap-4">
                        <div className="min-w-0">
                          <span className="text-[11px] md:text-[12px] uppercase font-bold tracking-[0.2em] text-indigo-500 dark:text-indigo-300 font-mono">
                            {isZh ? "长尾观察档案" : "Long-tail Dossier"}
                          </span>
                          <h2 className="mt-1 text-[1.16rem] md:text-[1.32rem] font-black tracking-tight text-neutral-900 dark:text-white font-mono break-all leading-snug">
                            {selectedEntry.repoFullName}
                          </h2>
                          <p className="mt-1.5 text-[12px] md:text-[13px] text-neutral-500 dark:text-neutral-400">
                            {props.observedAtLabel}: {selectedEntry.observedAt}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={selectedEntry.projectHref}
                            className="px-3.5 py-2 text-[12px] md:text-[13px] font-bold rounded-xl bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-slate-700 transition-all"
                          >
                            {props.openProjectLabel}
                          </a>
                          <button
                            type="button"
                            onClick={() => setSelectedKey(null)}
                            className="p-1.5 rounded-xl bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 dark:hover:bg-slate-700 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all"
                            aria-label={props.closeLabel}
                            title={props.closeLabel}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div
                        ref={detailScrollRef}
                        tabIndex={0}
                        data-observer-scroll-active={detailScrollActive ? "true" : "false"}
                        aria-label={props.detailStageLabel}
                        className={`observer-react-detail-scroll-region min-h-0 flex-1 overscroll-contain pr-1 outline-none transition-all ${
                          detailScrollActive ? "overflow-y-auto" : "overflow-y-hidden"
                        } ${
                          detailScrollActive ? "rounded-[22px] ring-1 ring-indigo-500/20 ring-offset-2 ring-offset-transparent" : ""
                        }`}
                        style={{ scrollbarGutter: "stable" }}
                      >
                        <DetailContent
                          selectedEntry={selectedEntry}
                          selectedSignalGroups={selectedSignalGroups}
                          props={props}
                        />
                      </div>
                    </div>

                    <DetailFooter
                      selectedEntry={selectedEntry}
                      props={props}
                      onClose={() => setSelectedKey(null)}
                    />
                  </div>
                ) : (
                  <div className="glass-panel hologram-border rounded-[30px] px-6 py-16 text-center">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[12px] md:text-[13px] font-black uppercase tracking-[0.22em] text-neutral-400 dark:text-neutral-500 font-mono">
                        {props.detailStageLabel}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        <span className="text-[12px] text-amber-500 font-mono font-bold">{props.detailStageStatus}</span>
                      </div>
                    </div>
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-indigo-200/70 dark:border-slate-700/80 text-neutral-400 dark:text-neutral-500">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 17a1 1 0 1 0 2 0m-1-14a9 9 0 0 1 8.485 12.001c-.472 1.206-1.387 2.248-2.522 2.98-.622.401-1.12 1.05-1.241 1.78-.115.691-.73 1.239-1.431 1.239H8.709c-.701 0-1.316-.548-1.431-1.239-.121-.73-.619-1.379-1.241-1.78A8.989 8.989 0 0 1 3 12a9 9 0 0 1 9-9Z" />
                      </svg>
                    </div>
                      <h3 className="text-[15px] md:text-[16px] font-bold text-neutral-800 dark:text-neutral-100">{props.detailEmptyTitle}</h3>
                    <p className="mt-2 text-[13px] md:text-[14px] leading-7 text-neutral-500 dark:text-neutral-400">{props.detailEmptyBody}</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {filteredEntries.length > 0 ? (
            <div className="flex justify-between items-center gap-3 pt-3 px-1">
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {`${paginatedEntries.startIndex + 1}-${paginatedEntries.endIndex} / ${paginatedEntries.totalCount}`}
              </p>
              <ObserverPaginationControls
                currentPage={paginatedEntries.currentPage}
                pageCount={paginatedEntries.pageCount}
                totalCount={paginatedEntries.totalCount}
                startIndex={paginatedEntries.startIndex}
                endIndex={paginatedEntries.endIndex}
                onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
                onNext={() => setCurrentPage((page) => page + 1)}
                isZh={isZh}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
            <div className="rounded-[20px] px-4 py-3.5 bg-neutral-500/5 border border-neutral-200/50 dark:border-slate-800/60 min-h-[116px] md:min-h-[142px]">
              <span className="block text-[10px] uppercase font-bold tracking-[0.22em] text-neutral-400 dark:text-neutral-500">{props.guidanceJudgeLabel}</span>
              <div className="observer-copy mt-2 space-y-2">
                <p className="text-[12px] leading-6 text-neutral-500 dark:text-neutral-400">{extractLeadParagraph(props.guidanceJudgeBody)}</p>
                <div className="observer-chip-row">
                  <SignalChip label={`${props.telemetryCandidateCountLabel}: ${props.telemetryCandidateCountValue}`} tone="emerald" />
                  <SignalChip label={`${props.telemetryEcosystemCountLabel}: ${props.telemetryEcosystemCountValue}`} tone="cyan" />
                </div>
              </div>
            </div>
            <div className="rounded-[20px] px-4 py-3.5 bg-neutral-500/5 border border-neutral-200/50 dark:border-slate-800/60 min-h-[116px] md:min-h-[142px]">
              <span className="block text-[10px] uppercase font-bold tracking-[0.22em] text-neutral-400 dark:text-neutral-500">{props.guidanceLinkageLabel}</span>
              <div className="observer-copy mt-2 space-y-2">
                <p className="text-[12px] leading-6 text-neutral-500 dark:text-neutral-400">{extractLeadParagraph(props.guidanceLinkageBody)}</p>
                <div className="observer-chip-row">
                  <SignalChip label={`${props.telemetryStatusLabel}: ${props.telemetryStatusValue}`} tone="indigo" />
                  <SignalChip label={`${props.telemetryModeLabel}: ${props.telemetryModeValue}`} tone="amber" />
                </div>
                <div className="observer-chip-row">
                  {previewEcosystemBadges.length > 0 ? (
                    previewEcosystemBadges.map((badge) => <SignalChip key={badge} label={badge} tone="neutral" />)
                  ) : (
                    <SignalChip label={isZh ? "今天暂无生态覆盖统计。" : "No ecosystem coverage today"} tone="neutral" />
                  )}
                </div>
                <div className="observer-copy text-[11px] leading-5 text-neutral-500 dark:text-neutral-400">
                  {(previewNotes.length > 0 ? previewNotes : [isZh ? "当前没有额外的长尾观察说明。" : "There are no extra long-tail notes right now."]).map((note, index) => (
                    <p key={`${index}-${note.slice(0, 18)}`}>{note}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {isMobileViewport && selectedEntry ? (
          <>
            <button
              type="button"
              aria-label={props.closeLabel}
              className="observer-mobile-detail-backdrop"
              onClick={() => setSelectedKey(null)}
            />
            <div className="observer-react-detail-stage-mobile">
              <div
                className={`observer-react-detail-card observer-react-detail-card-mobile glass-panel hologram-border w-full p-4 rounded-[28px] flex min-h-0 flex-col relative shadow-sm overflow-hidden transition-shadow ${
                  detailScrollActive ? "shadow-[0_18px_48px_-24px_rgba(79,70,229,0.48)]" : ""
                }`}
              >
                <div className="absolute -right-16 -top-16 w-44 h-44 rounded-full border border-indigo-500/5 dark:border-indigo-500/10 pointer-events-none flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border border-indigo-500/5 dark:border-indigo-500/10 observer-radar-glow"></div>
                </div>

                <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                  <TrackingStatusBanner message={scopedTrackingStatusMessage} tone={props.trackingStatusTone} />

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500 font-mono">
                      {props.detailStageLabel}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      <span className="text-[11px] text-amber-500 font-mono font-bold">{props.detailStageStatus}</span>
                    </div>
                  </div>

                  <div className="flex items-start justify-between border-b border-neutral-200/40 dark:border-slate-800/40 pb-3 mb-3 gap-4">
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-indigo-500 dark:text-indigo-300 font-mono">
                        {isZh ? "长尾观察档案" : "Long-tail Dossier"}
                      </span>
                      <h2 className="mt-1 text-[1.08rem] font-black tracking-tight text-neutral-900 dark:text-white font-mono break-all leading-snug">
                        {selectedEntry.repoFullName}
                      </h2>
                      <p className="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                        {props.observedAtLabel}: {selectedEntry.observedAt}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedKey(null)}
                      className="p-1.5 rounded-xl bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 dark:hover:bg-slate-700 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all shrink-0"
                      aria-label={props.closeLabel}
                      title={props.closeLabel}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div
                    ref={detailScrollRef}
                    tabIndex={0}
                    data-observer-scroll-active="true"
                    aria-label={props.detailStageLabel}
                    className="observer-react-detail-scroll-region min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 outline-none rounded-[22px] ring-1 ring-indigo-500/20 ring-offset-2 ring-offset-transparent"
                    style={{ scrollbarGutter: "stable" }}
                  >
                    <DetailContent
                      selectedEntry={selectedEntry}
                      selectedSignalGroups={selectedSignalGroups}
                      props={props}
                    />
                  </div>
                </div>

                <DetailFooter
                  selectedEntry={selectedEntry}
                  props={props}
                  onClose={() => setSelectedKey(null)}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}

function DetailContent(props: {
  selectedEntry: ObserverEntry;
  selectedSignalGroups: Array<{ label: string; tone: "indigo" | "emerald" | "cyan" | "neutral" | "amber"; values: string[] }>;
  props: ObserverViewProps;
}) {
  const { selectedEntry, selectedSignalGroups } = props;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3 text-[12px] md:text-[13px] text-neutral-500 dark:text-neutral-400 bg-neutral-100/45 dark:bg-slate-950/40 border border-neutral-200/40 dark:border-slate-800/40 px-3.5 py-2.5 rounded-2xl">
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-neutral-400 font-mono">{props.props.watchReasonLabel}</span>
          <SignalChip label={selectedEntry.attentionReason} tone="indigo" size="compact" />
        </span>
        <span className="hidden sm:inline text-neutral-300 dark:text-slate-700">|</span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-neutral-400 font-mono">{props.props.freshnessLabel}</span>
          <SignalChip label={selectedEntry.freshnessTag} tone="emerald" size="compact" />
        </span>
        <span className="hidden sm:inline text-neutral-300 dark:text-slate-700">|</span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-neutral-400 font-mono">{props.props.tierLabel}</span>
          <span className="font-bold font-mono text-neutral-700 dark:text-neutral-200">{selectedEntry.hostLevel}</span>
        </span>
        <span className="hidden sm:inline text-neutral-300 dark:text-slate-700">|</span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-neutral-400 font-mono">{props.props.historyLabel}</span>
          <span className="font-bold font-mono text-neutral-700 dark:text-neutral-200">{selectedEntry.historyHit}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <MetricCell label="Stars" value={selectedEntry.stars} />
        <MetricCell label="Forks" value={selectedEntry.forks} />
        <MetricCell label="Issues" value={selectedEntry.issues} />
        <MetricCell label="PRs" value={selectedEntry.prs} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-3">
        <div className="p-3 rounded-[22px] bg-indigo-500/[0.04] dark:bg-indigo-500/[0.06] border border-indigo-100/50 dark:border-slate-800/50">
          <h3 className="text-[12px] md:text-[13px] uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500 font-bold mb-2">
            {props.props.whyNowTitle}
          </h3>
          <div className="observer-copy text-neutral-600 dark:text-neutral-300">
            {renderParagraphPreview(selectedEntry.whyNow, "text-[15px] md:text-[16px] leading-7 text-neutral-600 dark:text-neutral-300", 2)}
          </div>
        </div>

        <div className="p-3 rounded-[22px] bg-amber-500/[0.04] dark:bg-amber-500/[0.06] border border-amber-100/50 dark:border-slate-800/50">
          <h3 className="text-[12px] md:text-[13px] uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500 font-bold mb-2">
            {props.props.positionTitle}
          </h3>
          <div className="observer-copy text-neutral-600 dark:text-neutral-300">
            {renderParagraphPreview(selectedEntry.verdict, "text-[15px] md:text-[16px] leading-7 text-neutral-600 dark:text-neutral-300", 2)}
          </div>
          <div className="mt-2 pt-2 border-t border-neutral-200/30 dark:border-slate-800/40 observer-copy text-[13px] md:text-[14px] text-neutral-500 dark:text-neutral-400 leading-7">
            <p>
              <strong className="text-neutral-700 dark:text-neutral-200">{props.props.recommendationTitle}:</strong> {selectedEntry.recommendation}
            </p>
          </div>
        </div>
      </div>

      <div className="p-2.5 rounded-[18px] bg-neutral-500/[0.03] border border-neutral-200/50 dark:border-slate-800/60 mb-1">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
          <span className="block text-[11px] md:text-[12px] uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500 font-bold font-mono">
            {props.props.semanticSignalsTitle}
          </span>
          <div className="observer-chip-row gap-2">
            <SignalChip label={`${props.props.summarySourceLabel}: ${selectedEntry.summarySource}`} tone="neutral" size="compact" />
            <SignalChip label={`${props.props.judgeSourceLabel}: ${selectedEntry.judgeSource}`} tone="neutral" size="compact" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {selectedSignalGroups.slice(0, 3).map((group) => (
            <div key={group.label} className="rounded-[14px] border border-neutral-200/50 dark:border-slate-800/60 px-2 py-2">
              <div className="text-[10px] md:text-[11px] uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500 font-bold mb-1.5">{group.label}</div>
              <div className="observer-chip-row gap-1.5">
                {(group.values.length > 0 ? group.values.slice(0, 2) : ["none"]).map((token) => (
                  <SignalChip key={`${group.label}-${token}`} label={token} tone={group.tone} size="compact" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function DetailFooter(props: {
  selectedEntry: ObserverEntry;
  props: ObserverViewProps;
  onClose: () => void;
}) {
  return (
    <div className="relative z-10 border-t border-neutral-200/40 dark:border-slate-800/40 pt-3 mt-3 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={props.onClose}
        className="text-[12px] md:text-[13px] font-bold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 flex items-center gap-1 shrink-0"
      >
        <span>{props.props.closeLabel}</span>
      </button>
      <div className="flex gap-2 ml-auto">
        <a
          href={props.selectedEntry.repoUrl}
          target="_blank"
          rel="noreferrer"
          className="px-3.5 py-2 text-[12px] md:text-[13px] font-bold rounded-xl bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-slate-700 transition-all text-center"
        >
          {props.props.openRepositoryLabel}
        </a>
        {props.selectedEntry.isTracked ? (
          <button
            type="button"
            disabled
            className="px-4 py-2 text-[12px] md:text-[13px] font-bold rounded-xl bg-emerald-500 text-white shadow-sm transition-all flex items-center justify-center gap-1 cursor-default opacity-95"
          >
            <span>{props.props.keepTrackingActiveLabel}</span>
          </button>
        ) : !props.props.canTrack ? (
          <a
            href={props.props.trackingSignInHref}
            className="px-4 py-2 text-[12px] md:text-[13px] font-bold rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm transition-all flex items-center justify-center gap-1"
          >
            <span>{props.props.signInToTrackLabel}</span>
          </a>
        ) : (
          <form method="POST" action={props.props.trackingActionPath}>
            <input type="hidden" name="return_to" value={props.props.trackingReturnTo} />
            <input type="hidden" name="csrf_token" value={props.props.csrfToken} />
            <input type="hidden" name="repo_full_name" value={props.selectedEntry.repoFullName} />
            <input type="hidden" name="repo_url" value={props.selectedEntry.repoUrl} />
            <button
              type="submit"
              className="px-4 py-2 text-[12px] md:text-[13px] font-bold rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm transition-all flex items-center justify-center gap-1"
            >
              <span>{props.props.keepTrackingLabel}</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}


