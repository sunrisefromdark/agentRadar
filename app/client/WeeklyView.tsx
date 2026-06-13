import React, { useEffect, useMemo, useState } from "react";
import type { ScoreComponentName } from "../../src/types.ts";
import type { ParsedWeeklyEvidenceAxis } from "../../src/visualConsole/types.ts";

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

type WeeklyMatrixAxis = {
  key: ScoreComponentName;
  label: string;
  score: number;
  projectCount: number;
  evidenceCount: number;
  summary: string;
};

type WeeklyProject = {
  key: string;
  repoFullName: string;
  title: string;
  href: string;
  score: number;
  description: string;
  selectionReason: string;
  paradigm: string;
  persistence: string;
  trendPath: string;
  dailyGrowthLabel: string;
  badgeLabel: string;
};

type WeeklyTrend = {
  key: string;
  badge: string;
  title: string;
  summary: string;
  description: string;
  consensusLabel: string;
  countLabel: string;
  trendHref: string;
  matrixAxes: WeeklyMatrixAxis[];
  projects: WeeklyProject[];
};

type WeeklyTrendViewModel = WeeklyTrend & {
  viewKey: string;
  sourceKey: string | null;
};

type WeeklyWatchpoint = {
  key: string;
  tone: "core" | "weak";
  badge: string;
  title: string;
  body: string;
};

type WeeklyWeakSignal = {
  key: string;
  badge: string;
  title: string;
  body: string;
  evidence: string;
};

type WeeklyDrawerProject = {
  repoFullName: string;
  title: string;
  closeHref: string;
  openHref: string;
  kbHref: string | null;
  scoreLabel: string;
  paradigmLabel: string;
  persistenceLabel: string;
  dailyGrowthLabel: string;
  detailBadge: string;
  description: string;
  selectionReason: string;
  detailBody: string;
  identityLabel: string;
  identityHref: string;
  kbStatusLabel: string;
  kbUpdatedLabel: string;
  kbUpdatedValue: string;
  openKbLabel: string;
  closeLabel: string;
  archiveLabel: string;
  executeLabel: string;
};

export type WeeklyViewProps = {
  lang?: "zh" | "en";
  productName: string;
  navItems: NavItem[];
  languageLabel?: string;
  languageOptions?: ToggleOption[];
  themeLabel?: string;
  themeOptions: ToggleOption[];
  initialTheme: "light" | "dark";
  pageBadge: string;
  pageHint: string;
  heroTitle: string;
  heroSummary: string;
  activeWeekLabel: string;
  previousWeekLabel: string;
  activeWeekHref: string;
  previousWeekHref: string;
  previousWeekNavHref?: string | null;
  nextWeekNavHref?: string | null;
  briefingEyebrow: string;
  briefingTitle: string;
  briefingBody: string[];
  telemetryLabel: string;
  telemetryWindowLabel: string;
  telemetryWindowValue: string;
  telemetryStatusLabel: string;
  telemetryStatusValue: string;
  matrixEyebrow: string;
  matrixTitle: string;
  matrixSubtitle: string;
  matrixModeLabel: string;
  matrixEmptyTitle: string;
  matrixEmptyBody: string;
  watchpointEyebrow: string;
  watchpointTitle: string;
  trendStageEyebrow: string;
  trendStageMeta: string;
  trendCountLabel: string;
  trendSummaryTitle: string;
  noProjectsLabel: string;
  radarLinkLabel: string;
  weakSignalBadgeLabel: string;
  weeklyMemoTitle: string;
  weeklyMemoBody: string;
  watchpointsTitle: string;
  watchpointsEmptyLabel: string;
  weakSignalsTitle: string;
  weakSignalsEmptyLabel: string;
  drawerModuleLabel: string;
  drawerProjectArchitectureLabel: string;
  drawerEvaluationEvidenceLabel: string;
  drawerIdentityLabel: string;
  drawerDailyGrowthLabel: string;
  drawerParadigmLabel: string;
  drawerPersistenceLabel: string;
  drawerKnowledgeLabel: string;
  noneLabel: string;
  trends: WeeklyTrend[];
  weakSignals: WeeklyWeakSignal[];
  watchpoints: WeeklyWatchpoint[];
  initialTrendKey: string | null;
  initialProjectKey: string | null;
  drawerProjects: WeeklyDrawerProject[];
};

declare global {
  interface Window {
    __WEEKLY_INITIAL_DATA__?: Partial<WeeklyViewProps>;
  }
}

const DEFAULT_PROPS: WeeklyViewProps = {
  lang: "zh",
  productName: "趋势雷达",
  navItems: [],
  languageLabel: "语言",
  languageOptions: [],
  themeLabel: "主题",
  themeOptions: [
    { label: "Light", href: "#", active: true },
    { label: "Dark", href: "#", active: false },
  ],
  initialTheme: "light",
  pageBadge: "",
  pageHint: "",
  heroTitle: "",
  heroSummary: "",
  activeWeekLabel: "",
  previousWeekLabel: "",
  activeWeekHref: "#",
  previousWeekHref: "#",
  previousWeekNavHref: null,
  nextWeekNavHref: null,
  briefingEyebrow: "",
  briefingTitle: "",
  briefingBody: [],
  telemetryLabel: "",
  telemetryWindowLabel: "",
  telemetryWindowValue: "",
  telemetryStatusLabel: "",
  telemetryStatusValue: "",
  matrixEyebrow: "",
  matrixTitle: "",
  matrixSubtitle: "",
  matrixModeLabel: "",
  matrixEmptyTitle: "",
  matrixEmptyBody: "",
  watchpointEyebrow: "",
  watchpointTitle: "",
  trendStageEyebrow: "",
  trendStageMeta: "",
  trendCountLabel: "",
  trendSummaryTitle: "",
  noProjectsLabel: "",
  radarLinkLabel: "",
  weakSignalBadgeLabel: "",
  weeklyMemoTitle: "",
  weeklyMemoBody: "",
  watchpointsTitle: "",
  watchpointsEmptyLabel: "",
  weakSignalsTitle: "",
  weakSignalsEmptyLabel: "",
  drawerModuleLabel: "",
  drawerProjectArchitectureLabel: "",
  drawerEvaluationEvidenceLabel: "",
  drawerIdentityLabel: "",
  drawerDailyGrowthLabel: "",
  drawerParadigmLabel: "",
  drawerPersistenceLabel: "",
  drawerKnowledgeLabel: "",
  noneLabel: "",
  trends: [],
  weakSignals: [],
  watchpoints: [],
  initialTrendKey: null,
  initialProjectKey: null,
  drawerProjects: [],
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
    --bg-gradient-light: radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.04) 0%, transparent 45%),
      radial-gradient(circle at 100% 100%, rgba(6, 182, 212, 0.04) 0%, transparent 45%),
      linear-gradient(to bottom, #f8fafc, #f1f5f9);
  }

  body[data-route="weekly"] {
    background: var(--bg-gradient-light);
    transition: background 0.4s ease;
    min-height: 100vh;
  }

  html.dark body[data-route="weekly"],
  html[data-theme="dark"] body[data-route="weekly"],
  body.theme-dark[data-route="weekly"] {
${OVERVIEW_DARK_BODY_BACKGROUND}
  }

  .glass-panel {
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(99, 102, 241, 0.08);
    box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.03), 0 1px 1px 0 rgba(99, 102, 241, 0.02);
  }

  .dark .glass-panel {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
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

  .hologram-border:hover::before {
    opacity: 1;
  }

  .grid-overlay {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    opacity: 0.25;
    background-size: 40px 40px;
    background-image:
      linear-gradient(to right, rgba(99, 102, 241, 0.05) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(99, 102, 241, 0.05) 1px, transparent 1px);
  }

  .dark .grid-overlay {
    opacity: 0.1;
    background-size: 44px 44px;
    background-image:
      linear-gradient(to right, rgba(255, 255, 255, 0.009) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.009) 1px, transparent 1px);
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }

  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  @keyframes pulse-slow {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  .animate-pulse-slow {
    animation: pulse-slow 3s infinite ease-in-out;
  }

  @keyframes radar-pulse {
    0% { transform: scale(0.95); opacity: 0.1; }
    50% { opacity: 0.3; }
    100% { transform: scale(1.15); opacity: 0; }
  }

  .animate-radar-glow {
    animation: radar-pulse 4s infinite ease-in-out;
  }

  .weekly-app {
    color: #262626;
  }

  .weekly-stage {
    width: min(100%, 1148px);
    margin: 0 auto;
    padding: 18px 16px 26px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .weekly-shell-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 30px;
    padding: 14px 20px;
    border-radius: 22px;
  }

  .weekly-shell-header-left,
  .weekly-shell-controls,
  .weekly-brand,
  .weekly-shell-nav,
  .weekly-language-toggle {
    display: flex;
    align-items: center;
  }

  .weekly-shell-header-left {
    gap: 16px;
  }

  .weekly-shell-controls {
    gap: 12px;
  }

  .weekly-brand {
    gap: 12px;
    text-decoration: none;
  }

  .weekly-brand-mark {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #6366f1 0%, #9333ea 100%);
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.24);
    flex-shrink: 0;
  }

  .weekly-brand-mark svg {
    width: 16px;
    height: 16px;
  }

  .weekly-brand-text {
    font-size: 17px;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: -0.02em;
    background: linear-gradient(to right, #171717 0%, #525252 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .dark .weekly-brand-text {
    background: linear-gradient(to right, #ffffff 0%, #a3a3a3 100%);
    -webkit-background-clip: text;
    background-clip: text;
  }

  .weekly-shell-nav {
    gap: 4px;
    padding-left: 16px;
    border-left: 1px solid rgba(229, 229, 229, 0.8);
  }

  .dark .weekly-shell-nav {
    border-left-color: rgba(38, 38, 38, 0.8);
  }

  .weekly-shell-nav a,
  .weekly-language-toggle a {
    text-decoration: none;
  }

  .weekly-shell-nav a {
    padding: 5px 10px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #737373;
  }

  .weekly-shell-nav a.is-active {
    background: rgba(245, 245, 245, 0.95);
    color: #171717;
  }

  .dark .weekly-shell-nav a {
    color: #a3a3a3;
  }

  .dark .weekly-shell-nav a.is-active {
    background: rgba(38, 38, 38, 0.96);
    color: #ffffff;
  }

  .weekly-language-toggle {
    gap: 2px;
    padding: 2px;
    border-radius: 12px;
    background: rgba(245, 245, 245, 0.9);
    border: 1px solid rgba(229, 229, 229, 0.8);
  }

  .dark .weekly-language-toggle {
    background: rgba(23, 23, 23, 0.85);
    border-color: rgba(38, 38, 38, 0.9);
  }

  .weekly-language-toggle a {
    padding: 4px 9px;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 600;
    color: #737373;
  }

  .weekly-language-toggle a.is-active {
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    color: #171717;
  }

  .dark .weekly-language-toggle a {
    color: #a3a3a3;
  }

  .dark .weekly-language-toggle a.is-active {
    background: #262626;
    color: #ffffff;
  }

  .weekly-theme-toggle {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    border: 1px solid rgba(229, 229, 229, 0.8);
    background: rgba(245, 245, 245, 0.9);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .dark .weekly-theme-toggle {
    background: rgba(23, 23, 23, 0.85);
    border-color: rgba(38, 38, 38, 0.9);
  }

  .weekly-theme-toggle svg {
    width: 16px;
    height: 16px;
  }

  .weekly-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 34px;
  }

  .weekly-hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    color: #4f46e5;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.2);
    margin-bottom: 14px;
  }

  .dark .weekly-hero-badge {
    color: #818cf8;
    background: rgba(99, 102, 241, 0.2);
  }

  .weekly-hero-badge em {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #6366f1;
    display: inline-block;
  }

  .weekly-hero-badge span:last-child {
    color: #737373;
    font-weight: 400;
  }

  .dark .weekly-hero-badge span:last-child {
    color: #a3a3a3;
  }

  .weekly-hero h1 {
    margin: 0 0 12px;
    font-size: 2.2rem;
    line-height: 1.02;
    letter-spacing: -0.06em;
    font-weight: 900;
    color: #0a0a0a;
  }

  .dark .weekly-hero h1 {
    color: #ffffff;
  }

  @media (min-width: 768px) {
    .weekly-hero h1 {
      font-size: 3.25rem;
    }
  }

  .weekly-hero p {
    margin: 0;
    max-width: 980px;
    font-size: 14px;
    line-height: 1.65;
    font-weight: 500;
    color: #737373;
  }

  .dark .weekly-hero p {
    color: #a3a3a3;
  }

  .weekly-timeline-shell {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin: 0 auto 28px;
  }

  .weekly-timeline {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    border: 1px solid rgba(229, 229, 229, 0.8);
  }

  .weekly-timeline-arrow {
    width: 42px;
    height: 42px;
    border-radius: 999px;
    border: 1px solid rgba(229, 229, 229, 0.8);
    background: rgba(255, 255, 255, 0.72);
    color: #525252;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
    transition: transform 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
  }

  .weekly-timeline-arrow:hover {
    transform: translateY(-1px);
    color: #171717;
    box-shadow: 0 14px 28px rgba(15, 23, 42, 0.1);
  }

  .weekly-timeline-arrow.is-disabled {
    color: #a3a3a3;
    background: rgba(245, 245, 245, 0.78);
    box-shadow: none;
    cursor: not-allowed;
  }

  .weekly-timeline-arrow.is-disabled:hover {
    transform: none;
    color: #a3a3a3;
    box-shadow: none;
  }

  .weekly-timeline a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
    padding: 9px 20px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    color: #737373;
  }

  .weekly-timeline a.is-active {
    background: #171717;
    color: #ffffff;
    box-shadow: 0 12px 22px rgba(23, 23, 23, 0.18);
  }

  .dark .weekly-timeline a.is-active {
    background: #ffffff;
    color: #171717;
  }

  .weekly-timeline svg {
    width: 14px;
    height: 14px;
  }

  .weekly-timeline-arrow svg {
    width: 16px;
    height: 16px;
  }

  .dark .weekly-timeline-arrow {
    border-color: rgba(38, 38, 38, 0.92);
    background: rgba(23, 23, 23, 0.86);
    color: #d4d4d4;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.34);
  }

  .dark .weekly-timeline-arrow:hover {
    color: #ffffff;
  }

  .dark .weekly-timeline-arrow.is-disabled {
    color: #737373;
    background: rgba(23, 23, 23, 0.7);
    box-shadow: none;
  }

  .weekly-briefing {
    margin-bottom: 28px;
    padding: 28px;
    border-radius: 32px;
    overflow: hidden;
  }

  .weekly-briefing-body,
  .weekly-workspace {
    display: grid;
    gap: 28px;
  }

  .weekly-briefing-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .weekly-briefing-copy {
    max-width: 660px;
  }

  .weekly-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }

  .weekly-eyebrow-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #6366f1;
  }

  .weekly-eyebrow-dot.is-amber {
    background: #f59e0b;
  }

  .weekly-eyebrow-label {
    font-size: 10px;
    line-height: 1;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 700;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    color: #a3a3a3;
  }

  .dark .weekly-eyebrow-label {
    color: #737373;
  }

  .weekly-briefing-copy h2,
  .weekly-watchpoint-card h3,
  .weekly-matrix-card h3 {
    margin: 0 0 12px;
    font-size: 17px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #0a0a0a;
  }

  .dark .weekly-briefing-copy h2,
  .dark .weekly-watchpoint-card h3,
  .dark .weekly-matrix-card h3 {
    color: #ffffff;
  }

  .weekly-briefing-copy .weekly-copy-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
    line-height: 1.82;
    color: #525252;
  }

  .dark .weekly-briefing-copy .weekly-copy-stack {
    color: #d4d4d4;
  }

  .weekly-telemetry {
    width: 100%;
    padding: 14px 16px;
    border-radius: 24px;
    background: rgba(245, 245, 245, 0.55);
    border: 1px solid rgba(229, 229, 229, 0.5);
    font-size: 11px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .dark .weekly-telemetry {
    background: rgba(23, 23, 23, 0.38);
    border-color: rgba(38, 38, 38, 0.72);
  }

  .weekly-telemetry span:first-child,
  .weekly-matrix-subtitle {
    font-family: "JetBrains Mono", "Fira Code", monospace;
    color: #a3a3a3;
  }

  .weekly-workspace {
    margin-bottom: 48px;
  }

  .weekly-left-column,
  .weekly-right-column {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .weekly-matrix-card,
  .weekly-watchpoint-card {
    padding: 22px;
    border-radius: 32px;
  }

  .weekly-matrix-card {
    min-height: 344px;
  }

  .weekly-matrix-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .weekly-mode-chip {
    padding: 4px 6px;
    border-radius: 6px;
    background: rgba(99, 102, 241, 0.1);
    color: #4f46e5;
    font-size: 10px;
    font-weight: 700;
    font-family: "JetBrains Mono", "Fira Code", monospace;
  }

  .weekly-matrix-subtitle {
    margin: 0 0 18px;
    font-size: 11px;
  }

  .weekly-matrix-grid {
    display: grid;
    gap: 18px;
    align-items: center;
  }

  .weekly-radar-wrap {
    display: flex;
    justify-content: center;
    position: relative;
    min-height: 210px;
    width: 100%;
    min-width: 0;
    grid-area: radar;
  }

  .weekly-matrix-legend {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 11px;
    min-width: 168px;
    grid-area: legend;
  }

  .weekly-matrix-legend-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(229, 229, 229, 0.24);
  }

  .weekly-matrix-legend-row:last-child {
    border-bottom: 0;
  }

  .dark .weekly-matrix-legend-row {
    border-bottom-color: rgba(38, 38, 38, 0.6);
  }

  .weekly-watchpoint-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .weekly-watchpoint-item {
    padding: 16px;
    border-radius: 24px;
    border: 1px solid rgba(229, 229, 229, 0.55);
    background: rgba(115, 115, 115, 0.02);
  }

  .dark .weekly-watchpoint-item {
    border-color: rgba(38, 38, 38, 0.7);
  }

  .weekly-watchpoint-item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .weekly-watchpoint-badge {
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(245, 158, 11, 0.1);
    color: #d97706;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .dark .weekly-watchpoint-badge {
    color: #fbbf24;
  }

  .weekly-watchpoint-item h4 {
    margin: 0 0 4px;
    font-size: 14px;
    line-height: 1.25;
    font-weight: 800;
  }

  .weekly-watchpoint-item p {
    margin: 0;
    font-size: 12px;
    line-height: 1.7;
    color: #737373;
  }

  .dark .weekly-watchpoint-item p {
    color: #a3a3a3;
  }

  .weekly-trend-stage-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 6px;
    color: #a3a3a3;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .weekly-trend-stage-head strong {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }

  .weekly-trend-stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .weekly-trend-card {
    padding: 18px 20px;
    border-radius: 28px;
    cursor: pointer;
    overflow: hidden;
  }

  .weekly-trend-card-head,
  .weekly-trend-card-main,
  .weekly-trend-card-meta,
  .weekly-project-card-head,
  .weekly-project-card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .weekly-trend-card-main {
    min-width: 0;
    gap: 12px;
  }

  .weekly-trend-badge {
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    flex-shrink: 0;
    color: #4f46e5;
    background: rgba(99, 102, 241, 0.1);
  }

  .weekly-trend-card.is-selected .weekly-trend-badge {
    color: #ffffff;
    background: #6366f1;
  }

  .weekly-trend-title {
    min-width: 0;
    font-size: 16px;
    font-weight: 900;
    line-height: 1.25;
    letter-spacing: -0.03em;
    color: #171717;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .weekly-trend-card.is-selected .weekly-trend-title {
    color: #4f46e5;
  }

  .dark .weekly-trend-title {
    color: #ffffff;
  }

  .weekly-trend-card-meta {
    flex-shrink: 0;
  }

  .weekly-trend-pill {
    padding: 4px 8px;
    border-radius: 8px;
    background: rgba(245, 245, 245, 0.9);
    color: #737373;
    font-size: 11px;
  }

  .dark .weekly-trend-pill {
    background: rgba(38, 38, 38, 0.92);
    color: #d4d4d4;
  }

  .weekly-trend-expand {
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    transition: all 0.3s ease;
  }

  .weekly-trend-card.is-selected .weekly-trend-expand {
    max-height: 1200px;
    opacity: 1;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid rgba(229, 229, 229, 0.32);
  }

  .dark .weekly-trend-card.is-selected .weekly-trend-expand {
    border-top-color: rgba(38, 38, 38, 0.65);
  }

  .weekly-trend-expand p {
    margin: 0 0 16px;
    font-size: 13px;
    line-height: 1.68;
    color: #737373;
  }

  .dark .weekly-trend-expand p {
    color: #a3a3a3;
  }

  .weekly-trend-subhead {
    display: block;
    margin-bottom: 8px;
    color: #a3a3a3;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .weekly-project-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .weekly-project-card {
    padding: 14px 16px;
    border-radius: 22px;
    border: 1px solid rgba(229, 229, 229, 0.65);
    background: rgba(255, 255, 255, 0.4);
  }

  .weekly-project-card.is-selected {
    background: #171717;
    border-color: #171717;
    color: #ffffff;
    box-shadow: 0 18px 34px rgba(15, 23, 42, 0.18);
  }

  .dark .weekly-project-card {
    background: rgba(10, 10, 10, 0.3);
    border-color: rgba(38, 38, 38, 0.84);
  }

  .dark .weekly-project-card.is-selected {
    background: #ffffff;
    border-color: #ffffff;
    color: #171717;
  }

  .weekly-project-card h4 {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    font-family: "JetBrains Mono", "Fira Code", monospace;
  }

  .weekly-project-card p {
    margin: 0 0 12px;
    font-size: 11px;
    line-height: 1.72;
    color: #737373;
  }

  .weekly-project-card.is-selected p {
    color: rgba(255, 255, 255, 0.82);
  }

  .dark .weekly-project-card p {
    color: #a3a3a3;
  }

  .dark .weekly-project-card.is-selected p {
    color: rgba(23, 23, 23, 0.72);
  }

  .weekly-project-score {
    padding: 4px 6px;
    border-radius: 6px;
    font-size: 9px;
    font-weight: 700;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    background: rgba(245, 245, 245, 0.9);
    color: #4f46e5;
  }

  .weekly-project-card.is-selected .weekly-project-score {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  .dark .weekly-project-card.is-selected .weekly-project-score {
    background: rgba(0, 0, 0, 0.16);
    color: #171717;
  }

  .weekly-project-card-foot {
    padding-top: 8px;
    border-top: 1px solid rgba(229, 229, 229, 0.1);
    font-size: 9px;
  }

  .weekly-memo-card {
    padding: 18px;
    border-radius: 28px;
    background: rgba(115, 115, 115, 0.05);
    border: 1px solid rgba(229, 229, 229, 0.55);
  }

  .dark .weekly-memo-card {
    border-color: rgba(38, 38, 38, 0.7);
  }

  .weekly-memo-card span {
    display: block;
    color: #a3a3a3;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .weekly-memo-card p {
    margin: 0;
    font-size: 12px;
    line-height: 1.8;
    color: #737373;
  }

  .dark .weekly-memo-card p {
    color: #a3a3a3;
  }

  .weekly-drawer-panel {
    position: absolute;
    inset: 0 0 0 auto;
    width: min(100vw, 448px);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border-left: 1px solid rgba(229, 229, 229, 0.7);
    box-shadow: 0 18px 46px rgba(15, 23, 42, 0.18);
    padding: 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow-y: auto;
  }

  .dark .weekly-drawer-panel {
    background: rgba(10, 10, 10, 0.95);
    border-left-color: rgba(38, 38, 38, 0.8);
  }

  .weekly-drawer-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 16px;
    margin-bottom: 20px;
    border-bottom: 1px solid rgba(229, 229, 229, 0.6);
  }

  .dark .weekly-drawer-header {
    border-bottom-color: rgba(38, 38, 38, 0.7);
  }

  .weekly-drawer-header h3 {
    margin: 4px 0 0;
    font-size: 28px;
    line-height: 1.15;
    font-weight: 700;
    letter-spacing: -0.04em;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    color: #171717;
  }

  .dark .weekly-drawer-header h3 {
    color: #ffffff;
  }

  .weekly-drawer-close {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(245, 245, 245, 0.95);
    color: #737373;
  }

  .dark .weekly-drawer-close {
    background: rgba(38, 38, 38, 0.95);
    color: #a3a3a3;
  }

  .weekly-drawer-close svg {
    width: 16px;
    height: 16px;
  }

  .weekly-score-grid {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 16px;
    align-items: center;
    margin-bottom: 24px;
  }

  .weekly-score-ring {
    width: 80px;
    height: 80px;
    position: relative;
    margin: 0 auto;
  }

  .weekly-score-ring svg {
    width: 100%;
    height: 100%;
  }

  .weekly-score-ring-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .weekly-score-ring-center strong {
    font-size: 36px;
    line-height: 1;
    font-weight: 900;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    color: #171717;
  }

  .dark .weekly-score-ring-center strong {
    color: #ffffff;
  }

  .weekly-score-ring-center span {
    font-size: 8px;
    text-transform: uppercase;
    color: #a3a3a3;
  }

  .weekly-score-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .weekly-score-stat {
    padding: 10px;
    border-radius: 16px;
    background: rgba(245, 245, 245, 0.6);
    border: 1px solid rgba(229, 229, 229, 0.6);
  }

  .dark .weekly-score-stat {
    background: rgba(23, 23, 23, 0.45);
    border-color: rgba(38, 38, 38, 0.7);
  }

  .weekly-score-stat span {
    display: block;
    margin-bottom: 2px;
    font-size: 11px;
    color: #a3a3a3;
  }

  .weekly-score-stat strong {
    display: block;
    font-size: 13px;
    line-height: 1.4;
    font-weight: 700;
    color: #262626;
  }

  .dark .weekly-score-stat strong {
    color: #e5e5e5;
  }

  .weekly-drawer-stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .weekly-drawer-card {
    padding: 16px;
    border-radius: 24px;
    border: 1px solid rgba(229, 229, 229, 0.45);
  }

  .weekly-drawer-card.is-indigo {
    background: rgba(99, 102, 241, 0.02);
    border-color: rgba(224, 231, 255, 0.7);
  }

  .weekly-drawer-card.is-amber {
    background: rgba(245, 158, 11, 0.02);
    border-color: rgba(254, 243, 199, 0.7);
  }

  .dark .weekly-drawer-card {
    border-color: rgba(38, 38, 38, 0.7);
  }

  .dark .weekly-drawer-card.is-indigo {
    background: rgba(99, 102, 241, 0.04);
  }

  .dark .weekly-drawer-card.is-amber {
    background: rgba(245, 158, 11, 0.04);
  }

  .weekly-drawer-card h4 {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    color: #a3a3a3;
  }

  .weekly-drawer-card div {
    font-size: 13px;
    line-height: 1.8;
    color: #525252;
  }

  .dark .weekly-drawer-card div {
    color: #d4d4d4;
  }

  .weekly-drawer-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 16px;
    margin-top: 24px;
    border-top: 1px solid rgba(229, 229, 229, 0.6);
  }

  .dark .weekly-drawer-footer {
    border-top-color: rgba(38, 38, 38, 0.7);
  }

  .weekly-drawer-footer a,
  .weekly-drawer-footer button {
    text-decoration: none;
  }

  .weekly-drawer-footer .weekly-footer-secondary {
    color: #a3a3a3;
    font-size: 11px;
    font-weight: 700;
  }

  .weekly-drawer-actions {
    display: flex;
    gap: 8px;
  }

  .weekly-drawer-button-secondary,
  .weekly-drawer-button-primary {
    padding: 10px 16px;
    border-radius: 14px;
    font-size: 12px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .weekly-drawer-button-secondary {
    background: rgba(245, 245, 245, 0.95);
    color: #525252;
  }

  .dark .weekly-drawer-button-secondary {
    background: rgba(38, 38, 38, 0.95);
    color: #d4d4d4;
  }

  .weekly-drawer-button-primary {
    background: #6366f1;
    color: #ffffff;
    box-shadow: 0 12px 24px rgba(99, 102, 241, 0.22);
  }

  @media (max-width: 767px) {
    .weekly-stage {
      padding-left: 12px;
      padding-right: 12px;
      padding-top: 12px;
      padding-bottom: 20px;
    }

    .weekly-hero {
      margin-bottom: 22px;
    }

    .weekly-matrix-card,
    .weekly-watchpoint-card,
    .weekly-trend-card,
    .weekly-memo-card {
      padding: 16px;
      border-radius: 24px;
    }

    .weekly-matrix-top {
      gap: 10px;
      margin-bottom: 12px;
    }

    .weekly-matrix-subtitle {
      margin: 0 0 12px;
      white-space: normal;
      overflow-wrap: anywhere;
      line-height: 1.55;
    }

    .weekly-matrix-grid {
      gap: 14px;
    }

    .weekly-radar-wrap {
      min-height: 0;
      padding: 6px 0 2px;
    }

    .weekly-radar-wrap svg {
      width: min(100%, 208px);
      height: auto;
    }

    .weekly-radar-wrap text {
      display: none;
    }

    .weekly-matrix-legend {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      min-width: 0;
      font-size: 10px;
    }

    .weekly-matrix-legend-row {
      align-items: flex-start;
      gap: 4px;
      padding: 9px 10px;
      border: 1px solid rgba(229, 229, 229, 0.18);
      border-bottom: 1px solid rgba(229, 229, 229, 0.18);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.03);
    }

    .dark .weekly-matrix-legend-row {
      border-color: rgba(63, 63, 70, 0.58);
      background: rgba(15, 23, 42, 0.32);
    }

    .weekly-matrix-legend-row span:last-child {
      font-size: 12px;
    }
  }

  @media (min-width: 768px) {
    .weekly-stage {
      padding-left: 26px;
      padding-right: 26px;
    }

    .weekly-briefing-body {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
    }

    .weekly-telemetry {
      width: 198px;
      flex-shrink: 0;
    }

    .weekly-matrix-grid {
      grid-template-areas: "radar legend";
      grid-template-columns: 252px minmax(168px, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .weekly-workspace {
      grid-template-columns: minmax(0, 0.46fr) minmax(0, 0.54fr);
    }

    .weekly-left-column {
      grid-column: auto;
    }

    .weekly-right-column {
      grid-column: auto;
    }

    .weekly-left-column.is-narrow {
      grid-column: auto;
    }

    .weekly-right-column.is-wide {
      grid-column: auto;
    }
  }
`;

function readPayloadFromDom(): Partial<WeeklyViewProps> | null {
  if (typeof document === "undefined") {
    return null;
  }
  const payloadNode = document.getElementById("weekly-react-payload");
  if (!payloadNode?.textContent) {
    return null;
  }
  try {
    return JSON.parse(payloadNode.textContent) as Partial<WeeklyViewProps>;
  } catch {
    return null;
  }
}

function readPayloadFromWindow(): Partial<WeeklyViewProps> | null {
  if (typeof window === "undefined") {
    return null;
  }
  const payload = window.__WEEKLY_INITIAL_DATA__;
  return payload && typeof payload === "object" ? payload : null;
}

export function parseWeeklyViewPayload(): WeeklyViewProps {
  const payload = readPayloadFromDom() ?? readPayloadFromWindow() ?? {};
  return {
    ...DEFAULT_PROPS,
    ...payload,
    navItems: payload.navItems ?? DEFAULT_PROPS.navItems,
    languageOptions: payload.languageOptions ?? DEFAULT_PROPS.languageOptions,
    themeOptions: payload.themeOptions ?? DEFAULT_PROPS.themeOptions,
    briefingBody: payload.briefingBody ?? DEFAULT_PROPS.briefingBody,
    trends: payload.trends ?? DEFAULT_PROPS.trends,
    weakSignals: payload.weakSignals ?? DEFAULT_PROPS.weakSignals,
    watchpoints: payload.watchpoints ?? DEFAULT_PROPS.watchpoints,
    drawerProjects: payload.drawerProjects ?? DEFAULT_PROPS.drawerProjects,
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

function renderParagraphBlocks(text: string): React.ReactNode {
  const parts = splitNarrative(text);
  return parts.map((part, index) => (
    <span key={`${index}-${part.slice(0, 16)}`} className="block mb-2 last:mb-0 text-neutral-600 dark:text-neutral-300">
      {part}
    </span>
  ));
}

function buildExecutiveParagraphs(props: WeeklyViewProps): string[] {
  if (props.briefingBody.length >= 3) {
    return props.briefingBody;
  }
  if (props.weeklyMemoBody.trim()) {
    return splitNarrative(props.weeklyMemoBody);
  }
  return props.briefingBody;
}

function buildWatchpointEntries(props: WeeklyViewProps): Array<{ key: string; badge: string; title: string; body: string }> {
  if (props.weakSignals.length > 0) {
    return props.weakSignals.slice(0, 2).map((signal) => ({
      key: signal.key,
      badge: signal.badge,
      title: signal.title,
      body: signal.body || signal.evidence,
    }));
  }
  return props.watchpoints.slice(0, 2).map((point) => ({
    key: point.key,
    badge: point.badge,
    title: point.title,
    body: point.body,
  }));
}

function parseScore(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const numeric = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function syncWeeklyDrawerUrl(
  currentHref: string,
  selection: { projectKey: string | null; trendKey?: string | null },
): string {
  const url = new URL(currentHref);
  if (selection.projectKey) {
    url.searchParams.set("project", selection.projectKey);
  } else {
    url.searchParams.delete("project");
  }

  if (selection.trendKey === null) {
    url.searchParams.delete("trend_key");
  } else if (typeof selection.trendKey === "string" && selection.trendKey.trim()) {
    url.searchParams.set("trend_key", selection.trendKey);
  }

  return url.toString();
}

function buildDrawerFallback(project: WeeklyProject, props: WeeklyViewProps): WeeklyDrawerProject {
  return {
    repoFullName: project.repoFullName,
    title: project.title,
    closeHref: "#",
    openHref: project.href,
    kbHref: null,
    scoreLabel: String(Math.round(project.score)),
    paradigmLabel: project.paradigm,
    persistenceLabel: project.persistence,
    dailyGrowthLabel: project.dailyGrowthLabel,
    detailBadge: project.badgeLabel,
    description: project.description,
    selectionReason: project.selectionReason,
    detailBody: props.noneLabel,
    identityLabel: project.repoFullName,
    identityHref: "#",
    kbStatusLabel: props.noneLabel,
    kbUpdatedLabel: props.drawerKnowledgeLabel,
    kbUpdatedValue: props.noneLabel,
    openKbLabel: props.drawerKnowledgeLabel,
    closeLabel: props.noneLabel,
    archiveLabel: props.noneLabel,
    executeLabel: props.noneLabel,
  };
}

export function normalizeWeeklyTrendsForView(trends: WeeklyTrend[]): WeeklyTrendViewModel[] {
  const keyUsage = new Map<string, number>();
  return trends.map((trend, index) => {
    const rawKey = typeof trend.key === "string" ? trend.key.trim() : "";
    const sourceKey = rawKey || null;
    const keyBase = rawKey || `trend-${index + 1}`;
    const duplicateCount = keyUsage.get(keyBase) ?? 0;
    keyUsage.set(keyBase, duplicateCount + 1);

    return {
      ...trend,
      viewKey: duplicateCount === 0 ? keyBase : `${keyBase}::${duplicateCount + 1}`,
      sourceKey,
    };
  });
}

function resolveHeroCopy(lang: "zh" | "en"): { badge: string; hint: string; title: string; summary: string } {
  if (lang === "en") {
    return {
      badge: "Weekly Trends",
      hint: "What changed this week",
      title: "Weekly Trend Desk",
      summary: "A weekly summary of the project changes worth tracking and where the agent ecosystem is heading.",
    };
  }
  return {
    badge: "本周趋势",
    hint: "把这周的重要变化讲清楚",
    title: "本周重点趋势",
    summary: "Agent 会把这周值得关注的项目变化整理成趋势总结，帮助大家更快看清 Agent 正在往哪里发展。",
  };
}

function resolveBriefingTitle(lang: "zh" | "en"): string {
  return lang === "en" ? "Weekly Trend Summary" : "本周重点趋势总结";
}

function resolveMatrixTitle(lang: "zh" | "en"): string {
  return lang === "en" ? "Why This Judgment" : "为什么会得出这个判断";
}

function resolveWatchpointTitle(lang: "zh" | "en"): string {
  return lang === "en" ? "What To Keep Watching" : "接下来还要看什么";
}

function WeekNavArrow(props: {
  direction: "previous" | "next";
  href: string | null | undefined;
  label: string;
}): React.ReactElement {
  const isPrevious = props.direction === "previous";
  const icon = (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        d={isPrevious ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
      />
    </svg>
  );

  if (!props.href) {
    return (
      <span
        className="weekly-timeline-arrow is-disabled"
        data-week-nav={props.direction}
        data-week-nav-disabled="true"
        aria-disabled="true"
        aria-label={props.label}
        title={props.label}
      >
        {icon}
      </span>
    );
  }

  return (
    <a
      href={props.href}
      className="weekly-timeline-arrow"
      data-week-nav={props.direction}
      aria-label={props.label}
      title={props.label}
    >
      {icon}
    </a>
  );
}

type RadarChartProps = {
  axes: WeeklyMatrixAxis[];
};

function RadarChart({ axes }: RadarChartProps): React.ReactElement {
  const size = 180;
  const center = size / 2;
  const radius = size * 0.4;
  const radarAxes = axes.slice(0, 6);

  const getCoordinates = (index: number, value: number) => {
    const angle = ((Math.PI * 2) / 6) * index - Math.PI / 2;
    const x = center + radius * value * Math.cos(angle);
    const y = center + radius * value * Math.sin(angle);
    return { x, y };
  };

  const backgroundPolygons = [0.2, 0.4, 0.6, 0.8, 1].map((level, levelIndex) => {
    const points = radarAxes
      .map((_, axisIndex) => {
        const { x, y } = getCoordinates(axisIndex, level);
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <polygon
        key={`bg-${levelIndex}`}
        points={points}
        fill="none"
        stroke="currentColor"
        className="text-neutral-200 dark:text-neutral-800"
        strokeWidth="0.8"
      />
    );
  });

  const activePoints = radarAxes
    .map((axis, index) => {
      const { x, y } = getCoordinates(index, Math.max(0.12, Math.min(1, axis.score / 100)));
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible select-none">
      <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(99, 102, 241, 0.05)" strokeWidth="6" />
      {backgroundPolygons}
      {radarAxes.map((_, index) => {
        const { x, y } = getCoordinates(index, 1);
        return (
          <line
            key={`spoke-${index}`}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="currentColor"
            className="text-neutral-200 dark:text-neutral-800"
            strokeWidth="0.8"
            strokeDasharray="2,2"
          />
        );
      })}
      <polygon
        points={activePoints}
        fill="rgba(99, 102, 241, 0.15)"
        stroke="#6366f1"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-500 ease-out"
      />
      {radarAxes.map((axis, index) => {
        const { x, y } = getCoordinates(index, Math.max(0.12, Math.min(1, axis.score / 100)));
        const labelCoord = getCoordinates(index, 1.25);
        return (
          <g key={`dot-${axis.key}`}>
            <circle cx={x} cy={y} r="4" fill="#6366f1" stroke="#fff" strokeWidth="1.5" className="transition-all duration-500 ease-out shadow-sm" />
            <text
              x={labelCoord.x}
              y={labelCoord.y + 4}
              textAnchor="middle"
              className="fill-neutral-400 font-bold tracking-tight text-[8.5px] font-sans"
            >
              {axis.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type WeeklyDrawerProps = {
  lang: "zh" | "en";
  project: WeeklyDrawerProject | null;
  drawerModuleLabel: string;
  projectArchitectureLabel: string;
  evaluationEvidenceLabel: string;
  onClose: () => void;
};

function WeeklyDrawer({
  lang,
  project,
  drawerModuleLabel,
  projectArchitectureLabel,
  evaluationEvidenceLabel,
  onClose,
}: WeeklyDrawerProps): React.ReactElement | null {
  if (!project) {
    return null;
  }

  const scoreValue = Math.max(0, Math.min(100, parseScore(project.scoreLabel, 80)));
  const handleClose = (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    onClose();
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md z-50 transform transition-transform duration-300 ease-out translate-x-0">
      <div
        onClick={() => onClose()}
        className="fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm transition-opacity opacity-100"
      />
      <div className="weekly-drawer-panel absolute inset-y-0 right-0 w-full max-w-md bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl shadow-2xl border-l border-neutral-200/50 dark:border-neutral-800/50 p-6 flex flex-col h-full z-10 overflow-y-auto no-scrollbar justify-between">
        <div>
          <div className="weekly-drawer-header flex items-start justify-between border-b border-neutral-200/40 dark:border-neutral-800/40 pb-4 mb-5">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-500 dark:text-indigo-400 font-mono">
                {drawerModuleLabel}
              </span>
              <h3 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white font-mono mt-1">
                {project.repoFullName}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label={lang === "en" ? "Close dossier" : "关闭研判档案舱"}
              className="weekly-drawer-close p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="weekly-score-grid grid grid-cols-12 gap-4 items-center mb-6">
            <div className="col-span-4 flex justify-center">
              <div className="weekly-score-ring relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-neutral-200 dark:text-neutral-800"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-indigo-500"
                    strokeDasharray={`${scoreValue}, 100`}
                    strokeWidth="3"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="weekly-score-ring-center absolute flex flex-col items-center">
                  <strong>
                    {Math.floor(scoreValue)}
                  </strong>
                  <span className="text-[11px] text-neutral-400 uppercase tracking-[0.18em]">{lang === "en" ? "Score" : "评分"}</span>
                </div>
              </div>
            </div>
            <div className="weekly-score-stats col-span-8 grid grid-cols-2 gap-2 text-[15px]">
              <div className="weekly-score-stat p-2.5 rounded-xl bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200/50 dark:border-neutral-800/40">
                <span className="text-neutral-400 block mb-0.5">{lang === "en" ? "Paradigm" : "范式类别"}</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate block">{project.paradigmLabel}</span>
              </div>
              <div className="weekly-score-stat p-2.5 rounded-xl bg-neutral-100/50 dark:bg-neutral-900/40 border border-neutral-200/50 dark:border-neutral-800/40">
                <span className="text-neutral-400 block mb-0.5">{lang === "en" ? "Persistence" : "持续性"}</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200 block truncate">{project.persistenceLabel}</span>
              </div>
            </div>
          </div>

          <div className="weekly-drawer-stack space-y-4">
            <div className="weekly-drawer-card is-indigo p-4 rounded-2xl bg-indigo-500/[0.02] dark:bg-indigo-500/[0.04] border border-indigo-100/40 dark:border-neutral-800/40">
              <h4 className="text-xs uppercase tracking-widest text-neutral-400 dark:text-neutral-500 font-bold mb-2 font-mono">
                {projectArchitectureLabel}
              </h4>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {renderParagraphBlocks(project.description)}
              </div>
            </div>
            <div className="weekly-drawer-card is-amber p-4 rounded-2xl bg-amber-500/[0.02] dark:bg-amber-500/[0.04] border border-amber-100/40 dark:border-neutral-800/40">
              <h4 className="text-xs uppercase tracking-widest text-neutral-400 dark:text-neutral-500 font-bold mb-2 font-mono">
                {evaluationEvidenceLabel}
              </h4>
              <div className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {renderParagraphBlocks(project.selectionReason)}
              </div>
            </div>
          </div>
        </div>

        <div className="weekly-drawer-footer border-t border-neutral-200/40 dark:border-neutral-800/40 pt-4 mt-6 flex flex-col sm:flex-row gap-2 justify-between items-center">
          <button
            type="button"
            onClick={handleClose}
            className="weekly-footer-secondary text-[11px] font-bold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 flex items-center space-x-1"
          >
            <span>{project.closeLabel || (lang === "en" ? "Close Dossier" : "关闭研判档案舱")}</span>
          </button>
          <div className="weekly-drawer-actions flex space-x-2 w-full sm:w-auto shrink-0">
            <a
              href={project.openHref}
              className="weekly-drawer-button-primary flex-grow sm:flex-grow-0 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm transition-all flex items-center justify-center space-x-1"
            >
              <span>{project.executeLabel}</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WeeklyView(rawProps: WeeklyViewProps): React.ReactElement {
  const props = rawProps ?? DEFAULT_PROPS;
  const lang = props.lang ?? "zh";
  const normalizedTrends = useMemo(() => normalizeWeeklyTrendsForView(props.trends), [props.trends]);
  const heroCopy = resolveHeroCopy(lang);
  const executiveParagraphs = buildExecutiveParagraphs(props);
  const watchpointEntries = buildWatchpointEntries(props);
  const previousWeekArrowLabel = lang === "en" ? "Open previous weekly slice" : "打开前一周周视图";
  const nextWeekArrowLabel = lang === "en" ? "Open next weekly slice" : "打开后一周周视图";

  const initialTrendKey = useMemo(() => {
    if (props.initialTrendKey) {
      const matchingTrend = normalizedTrends.find((trend) => trend.sourceKey === props.initialTrendKey);
      if (matchingTrend) {
        return matchingTrend.viewKey;
      }
    }
    if (props.initialProjectKey) {
      const parentTrend = normalizedTrends.find((trend) =>
        trend.projects.some((project) => project && project.repoFullName.toLowerCase() === props.initialProjectKey?.toLowerCase()),
      );
      if (parentTrend) {
        return parentTrend.viewKey;
      }
    }
    return normalizedTrends[0]?.viewKey ?? null;
  }, [normalizedTrends, props.initialProjectKey, props.initialTrendKey]);

  const [selectedTrendKey, setSelectedTrendKey] = useState<string | null>(initialTrendKey);
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(props.initialProjectKey);
  useEffect(() => {
    setSelectedTrendKey(initialTrendKey);
  }, [initialTrendKey]);

  useEffect(() => {
    setSelectedProjectKey(props.initialProjectKey);
  }, [props.initialProjectKey]);

  const selectedTrend = useMemo(
    () => normalizedTrends.find((trend) => trend.viewKey === selectedTrendKey) ?? null,
    [normalizedTrends, selectedTrendKey],
  );

  const drawerProjectsByKey = useMemo(
    () => new Map(props.drawerProjects.map((project) => [project.repoFullName.toLowerCase(), project] as const)),
    [props.drawerProjects],
  );
  const projectTrendMap = useMemo(
    () =>
      new Map(
        normalizedTrends.flatMap((trend) =>
          trend.projects
            .filter((project): project is NonNullable<typeof project> => Boolean(project))
            .map((project) => [project.repoFullName.toLowerCase(), trend.viewKey] as const),
        ),
      ),
    [normalizedTrends],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const selectedTrendSourceKey = normalizedTrends.find((trend) => trend.viewKey === selectedTrendKey)?.sourceKey ?? null;
    const mappedTrendViewKey =
      selectedProjectKey && projectTrendMap.has(selectedProjectKey.toLowerCase())
        ? projectTrendMap.get(selectedProjectKey.toLowerCase()) ?? selectedTrendKey
        : selectedTrendKey;
    const mappedTrendKey = normalizedTrends.find((trend) => trend.viewKey === mappedTrendViewKey)?.sourceKey ?? selectedTrendSourceKey;
    const nextHref = syncWeeklyDrawerUrl(window.location.href, {
      projectKey: selectedProjectKey,
      trendKey: mappedTrendKey ?? null,
    });
    if (nextHref !== window.location.href) {
      window.history.replaceState(window.history.state, "", nextHref);
    }
  }, [normalizedTrends, projectTrendMap, selectedProjectKey, selectedTrendKey]);

  const selectedDrawerProject = useMemo(() => {
    if (!selectedProjectKey) {
      return null;
    }
    const direct = drawerProjectsByKey.get(selectedProjectKey.toLowerCase());
    if (direct) {
      return direct;
    }
    for (const trend of normalizedTrends) {
      const project = trend.projects.find((item) => item && item.repoFullName.toLowerCase() === selectedProjectKey.toLowerCase());
      if (project) {
        return buildDrawerFallback(project, props);
      }
    }
    return null;
  }, [drawerProjectsByKey, normalizedTrends, props, selectedProjectKey]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const shell = document.querySelector("[data-nav-shell='auto-hide']");
    if (!(shell instanceof HTMLElement)) return;
    if (window.matchMedia("(max-width: 1023px)").matches && selectedDrawerProject) {
      shell.classList.add("is-nav-hidden");
      return;
    }
    if (window.scrollY <= 24) {
      shell.classList.remove("is-nav-hidden");
    }
  }, [selectedDrawerProject]);

  return (
    <>
      <style>{REFERENCE_STYLES}</style>
      <div className="grid-overlay" aria-hidden="true" />
      <div className="weekly-app relative z-10 font-sans antialiased text-neutral-800 dark:text-neutral-100 transition-colors duration-300">
        <div className="weekly-stage max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col min-h-screen relative z-10">
          <section className="weekly-hero flex flex-col items-center text-center mb-10">
            <div className="weekly-hero-badge inline-flex items-center space-x-2 bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-semibold mb-4">
              <span>{heroCopy.badge}</span>
              <em className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-neutral-500 dark:text-neutral-400 font-normal">{heroCopy.hint}</span>
            </div>
            <h1 className="text-[2.2rem] md:text-[3.25rem] leading-[1.02] font-black tracking-[-0.06em] text-neutral-950 dark:text-white mb-3">
              {heroCopy.title}
            </h1>
            <p className="max-w-5xl text-neutral-500 dark:text-neutral-400 text-sm md:text-base font-medium">
              {heroCopy.summary}
            </p>
          </section>

          <section className="weekly-timeline-shell">
            <WeekNavArrow direction="previous" href={props.previousWeekNavHref} label={previousWeekArrowLabel} />
            <div className="weekly-timeline glass-panel p-1.5 rounded-full border border-neutral-200/60 dark:border-neutral-800 flex items-center shadow-lg space-x-1 self-center">
              <a href={props.previousWeekHref} className="px-6 py-2.5 text-xs font-bold rounded-full transition-all flex items-center space-x-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{props.previousWeekLabel}</span>
              </a>
              <a href={props.activeWeekHref} className="is-active px-6 py-2.5 text-xs font-bold rounded-full transition-all flex items-center space-x-1.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-extrabold shadow-md">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{props.activeWeekLabel}</span>
              </a>
            </div>
            <WeekNavArrow direction="next" href={props.nextWeekNavHref} label={nextWeekArrowLabel} />
          </section>

          <section className="weekly-briefing glass-panel hologram-border p-8 rounded-3xl relative overflow-hidden mb-8 shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="weekly-briefing-body flex flex-col md:flex-row gap-6 items-start justify-between">
              <div className="weekly-briefing-copy max-w-3xl space-y-3">
                <div className="weekly-eyebrow flex items-center space-x-2">
                  <div className="weekly-eyebrow-dot w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="weekly-eyebrow-label text-[10px] uppercase font-bold tracking-widest text-neutral-400 dark:text-neutral-500 font-mono">
                    {props.briefingEyebrow || (lang === "en" ? "Executive Briefing" : "本周简报")}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-neutral-950 dark:text-white tracking-tight">
                  {resolveBriefingTitle(lang)}
                </h2>
                <div className="weekly-copy-stack text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed space-y-3">
                  {executiveParagraphs.map((line, index) => (
                    <div key={`${index}-${line.slice(0, 16)}`}>{renderParagraphBlocks(line)}</div>
                  ))}
                </div>
              </div>
              <div className="weekly-telemetry w-full md:w-auto shrink-0 p-4 rounded-2xl bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200/40 dark:border-neutral-800/40 text-xs flex flex-col gap-1.5">
                <span className="text-neutral-400 block font-mono">{props.telemetryLabel || "Telemetry Node"}</span>
                <span className="font-bold">
                  {props.telemetryWindowLabel}: {props.telemetryWindowValue}
                </span>
                <span className="text-neutral-500 dark:text-neutral-400 font-mono">
                  {props.telemetryStatusLabel}: {props.telemetryStatusValue}
                </span>
              </div>
            </div>
          </section>

          <div className="weekly-workspace grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-16">
            <div className={classNames("weekly-left-column flex flex-col space-y-6 transition-all duration-300", selectedDrawerProject && "is-narrow", selectedDrawerProject ? "lg:col-span-5" : "lg:col-span-6")}>
              {selectedTrend ? (
                <div className="weekly-matrix-card glass-panel hologram-border p-6 rounded-3xl relative overflow-hidden shadow-sm transition-all duration-300">
                  <div className="weekly-matrix-top flex items-center justify-between mb-4">
                    <div className="weekly-eyebrow flex items-center space-x-2">
                      <div className="weekly-eyebrow-dot w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse-slow" />
                      <span className="weekly-eyebrow-label text-[10px] uppercase font-bold tracking-widest text-neutral-400 dark:text-neutral-500 font-mono">
                        {props.matrixEyebrow || "Evidence Matrix"}
                      </span>
                    </div>
                    <span className="weekly-mode-chip text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold px-1.5 py-0.5 rounded">
                      {props.matrixModeLabel || "6-Axis Telemetry"}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold mb-1 tracking-tight">{resolveMatrixTitle(lang)}</h3>
                  <p className="weekly-matrix-subtitle text-xs text-neutral-400 dark:text-neutral-500 font-mono mb-6 truncate">
                    {(props.matrixSubtitle || (lang === "en" ? "Focused Trend" : "选中趋势"))}: {selectedTrend.title}
                  </p>

                  <div className="weekly-matrix-grid grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="weekly-radar-wrap md:col-span-7 flex justify-center relative">
                      <div className="absolute inset-0 bg-indigo-500/5 rounded-full filter blur-xl animate-radar-glow pointer-events-none" />
                      <RadarChart axes={selectedTrend.matrixAxes} />
                    </div>

                    <div className="weekly-matrix-legend md:col-span-5 flex flex-col space-y-2.5 text-xs">
                      {selectedTrend.matrixAxes.map((axis, index) => (
                        <div
                          key={`${axis.key}-${axis.label}`}
                          className="weekly-matrix-legend-row flex items-center justify-between pb-1"
                        >
                          <span className="text-neutral-400">{axis.label}</span>
                          <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">{axis.score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass-panel hologram-border p-6 rounded-3xl relative overflow-hidden shadow-sm flex flex-col items-center justify-center min-h-[300px] text-center transition-all duration-300">
                  <div className="absolute inset-0 bg-indigo-500/[0.01] dark:bg-indigo-500/[0.02] pointer-events-none" />
                  <div className="w-12 h-12 rounded-full border border-dashed border-indigo-500/30 flex items-center justify-center mb-4 animate-pulse">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-1">{props.matrixEmptyTitle}</h4>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-xs leading-relaxed">{props.matrixEmptyBody}</p>
                </div>
              )}

              <div className="weekly-watchpoint-card glass-panel hologram-border p-6 rounded-3xl shadow-sm">
                <div className="weekly-eyebrow flex items-center space-x-2 mb-5">
                  <div className="weekly-eyebrow-dot is-amber w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse-slow" />
                  <span className="weekly-eyebrow-label text-[10px] uppercase font-bold tracking-widest text-neutral-400 dark:text-neutral-500 font-mono">
                    {props.watchpointEyebrow || (lang === "en" ? "Watch Next" : "持续观察")}
                  </span>
                </div>

                <h3 className="text-lg font-bold mb-4 tracking-tight">{resolveWatchpointTitle(lang)}</h3>

                <div className="weekly-watchpoint-list space-y-3.5">
                  {watchpointEntries.map((entry, index) => (
                    <div
                      key={entry.key}
                      className="weekly-watchpoint-item p-4 rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-500/[0.02]"
                    >
                      <div className="weekly-watchpoint-item-head flex items-center justify-between mb-2">
                        <span className="weekly-watchpoint-badge text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          {entry.badge}
                        </span>
                        <span className="text-[9px] text-neutral-400 font-mono">Sensor node-0{index + 1}</span>
                      </div>
                      <h4 className="text-xs md:text-sm font-black text-neutral-900 dark:text-white mb-1">{entry.title}</h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{entry.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={classNames("weekly-right-column flex flex-col space-y-6 transition-all duration-300", selectedDrawerProject && "is-wide", selectedDrawerProject ? "lg:col-span-7" : "lg:col-span-6")}>
              <div className="weekly-trend-stage-head flex items-center justify-between px-2">
                <span className="text-xs font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                  {props.trendStageEyebrow}
                </span>
                <span className="text-xs text-neutral-400 font-mono">{props.trendCountLabel}</span>
              </div>

              <h2 className="px-2 text-lg md:text-xl font-black tracking-tight text-neutral-900 dark:text-white">
                {lang === "en" ? "Core Trends" : "核心趋势"}
              </h2>

              <div className="weekly-trend-stack space-y-4">
                {normalizedTrends.map((trend) => {
                  const isTrendSelected = selectedTrend?.viewKey === trend.viewKey;
                  return (
                    <div
                      key={trend.viewKey}
                      onClick={() => {
                        setSelectedTrendKey((current) => (current === trend.viewKey ? null : trend.viewKey));
                      }}
                      className={classNames(
                        "weekly-trend-card glass-panel hologram-border p-5 rounded-3xl transition-all duration-300 cursor-pointer shadow-sm relative overflow-hidden",
                        isTrendSelected && "is-selected",
                        isTrendSelected
                          ? "ring-2 ring-indigo-500/30 bg-indigo-50/10 dark:bg-indigo-950/10 border-indigo-500/30"
                          : "hover:bg-neutral-50/30 dark:hover:bg-neutral-900/30",
                      )}
                    >
                      <div className="weekly-trend-card-head flex items-center justify-between gap-4">
                        <div className="weekly-trend-card-main flex items-center space-x-3 truncate">
                          <span
                            className={classNames(
                              "weekly-trend-badge text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded shrink-0 transition-colors",
                              isTrendSelected
                                ? "bg-indigo-500 text-white shadow"
                                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
                            )}
                          >
                            {trend.badge}
                          </span>
                          <h3
                            className={classNames(
                              "weekly-trend-title font-black tracking-tight text-sm md:text-lg truncate",
                              isTrendSelected ? "text-indigo-600 dark:text-indigo-400" : "text-neutral-900 dark:text-white",
                            )}
                          >
                            {trend.title}
                          </h3>
                        </div>
                        <div className="weekly-trend-card-meta flex items-center gap-3 shrink-0">
                          <span className="text-xs text-neutral-400">{trend.consensusLabel}</span>
                          <span className="weekly-trend-pill px-2 py-0.5 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/80 text-xs font-medium text-neutral-500 dark:text-neutral-300">
                            {trend.countLabel}
                          </span>
                          <svg
                            className={classNames(
                              "w-4 h-4 text-neutral-400 transform transition-transform duration-300",
                              isTrendSelected ? "rotate-180" : "rotate-0",
                            )}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      <div className="weekly-trend-expand transition-all duration-300 overflow-hidden">
                        <div className="mb-4">
                          <p className="text-xs md:text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{trend.description}</p>
                        </div>

                        <div className="weekly-project-list space-y-3">
                          <div className="weekly-trend-subhead text-[10px] uppercase font-bold tracking-widest text-neutral-400 mb-1 block">
                            {props.trendSummaryTitle}
                          </div>

                          {trend.projects.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-neutral-500/[0.02] border border-dashed border-neutral-200/60 dark:border-neutral-800/60 text-center text-xs text-neutral-400">
                              {props.noProjectsLabel}
                            </div>
                          ) : (
                            trend.projects.filter((project): project is NonNullable<typeof project> => Boolean(project)).map((project) => {
                              const isProjectSelected = selectedProjectKey?.toLowerCase() === project.repoFullName.toLowerCase();
                              return (
                                <div
                                  key={project.repoFullName}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedTrendKey(trend.viewKey);
                                    setSelectedProjectKey(project.repoFullName);
                                  }}
                                  className={classNames(
                                    "weekly-project-card p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between",
                                    isProjectSelected && "is-selected",
                                    isProjectSelected
                                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow"
                                      : "bg-white/40 dark:bg-neutral-950/40 border-neutral-200/60 dark:border-neutral-800/60 hover:border-neutral-300 dark:hover:border-neutral-700",
                                  )}
                                >
                                  <div className="weekly-project-card-head flex items-start justify-between gap-3 mb-2">
                                    <h4 className="font-bold text-sm font-mono tracking-tight flex items-center gap-2">
                                      <span>{project.repoFullName}</span>
                                      {isProjectSelected ? (
                                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-emerald-400 animate-pulse" />
                                      ) : null}
                                    </h4>
                                    <span
                                      className={classNames(
                                        "weekly-project-score text-[9px] font-mono font-bold px-1.5 py-0.5 rounded",
                                        isProjectSelected
                                          ? "bg-white/20 dark:bg-black/20 text-white dark:text-black"
                                          : "bg-neutral-100 dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400",
                                      )}
                                    >
                                      {lang === "en" ? "Score" : "评分"} {Math.round(project.score)}
                                    </span>
                                  </div>

                                  <p
                                    className={classNames(
                                      "text-xs leading-relaxed line-clamp-2 mb-3",
                                      isProjectSelected ? "text-neutral-200 dark:text-neutral-700" : "text-neutral-500 dark:text-neutral-400",
                                    )}
                                  >
                                    {project.description}
                                  </p>

                                  <div className="weekly-project-card-foot flex items-center justify-between border-t border-neutral-200/10 pt-2.5 text-[10px]">
                                    <div className="flex space-x-2">
                                      <span>{lang === "en" ? "Paradigm" : "范式"}: {project.paradigm}</span>
                                      <span>·</span>
                                      <span>{project.persistence}</span>
                                    </div>
                                    <div className="flex items-center space-x-1.5">
                                      <svg className="w-10 h-3 shrink-0" viewBox="0 0 72 20" fill="none">
                                        <path
                                          d={project.trendPath}
                                          stroke={isProjectSelected ? "#10b981" : "#f59e0b"}
                                          strokeWidth="2.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                      <span className="font-bold hover:underline">{props.radarLinkLabel}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="weekly-memo-card p-5 rounded-3xl bg-neutral-500/5 border border-neutral-200/50 dark:border-neutral-800/50 mt-4">
                <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
                  {props.weeklyMemoTitle}
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mt-2">
                  {props.weeklyMemoBody}
                </p>
              </div>
            </div>
          </div>
        </div>

        <WeeklyDrawer
          lang={lang}
          project={selectedDrawerProject}
          drawerModuleLabel={props.drawerModuleLabel || (lang === "zh" ? "研判档案舱" : "Dossier Module")}
          projectArchitectureLabel={props.drawerProjectArchitectureLabel || (lang === "en" ? "Project Architecture" : "项目架构描述")}
          evaluationEvidenceLabel={props.drawerEvaluationEvidenceLabel || (lang === "en" ? "Evaluation Evidence" : "评估证据")}
          onClose={() => setSelectedProjectKey(null)}
        />
      </div>
    </>
  );
}

export function mapWeeklyAxisLabel(axis: ScoreComponentName, lang: "zh" | "en"): string {
  const copy: Record<ScoreComponentName, { zh: string; en: string }> = {
    star_velocity: { zh: "增长爆发", en: "Growth Burst" },
    engagement_score: { zh: "社区共识", en: "Consensus" },
    architecture_shift: { zh: "开发速率", en: "Build Velocity" },
    compounding_capability: { zh: "商业溢价", en: "Commercial Premium" },
    autonomy_score: { zh: "沙箱安全", en: "Sandbox Safety" },
    discussion_score: { zh: "跨源验证", en: "Cross-Source Validation" },
  };
  return copy[axis][lang];
}

export function buildWeeklyMatrixAxes(
  axes: ParsedWeeklyEvidenceAxis[] | undefined,
  lang: "zh" | "en",
): WeeklyMatrixAxis[] {
  const fallbackOrder: ScoreComponentName[] = [
    "engagement_score",
    "architecture_shift",
    "star_velocity",
    "autonomy_score",
    "compounding_capability",
    "discussion_score",
  ];
  const axisMap = new Map((axes ?? []).map((axis) => [axis.axis, axis]));
  return fallbackOrder.map((key) => {
    const axis = axisMap.get(key);
    return {
      key,
      label: mapWeeklyAxisLabel(key, lang),
      score: Math.max(12, Math.round(axis?.score ?? 58)),
      projectCount: axis?.project_count ?? 0,
      evidenceCount: axis?.evidence_count ?? 0,
      summary: axis?.summary_cn ?? "",
    };
  });
}
