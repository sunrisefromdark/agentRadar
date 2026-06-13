import { copy, type UiLang } from "./copy.ts";
import { renderClientScript } from "./clientScript.ts";
import { routeTitle, toViewHref } from "./ossRouting.ts";
import type { RenderedRoute, UiTheme, WebRoute } from "./ossTypes.ts";
import { escapeHtml } from "./renderShared.ts";
import { renderShellFrame } from "./renderShell.ts";

function resolveTheme(requestUrl: URL): UiTheme {
  return requestUrl.searchParams.get("theme") === "dark" ? "dark" : "light";
}

function uiText(lang: UiLang, zh: string, en: string): string {
  return lang === "zh" ? zh : en;
}

function badge(value: string, tone = "neutral"): string {
  return `<span class="badge badge-${escapeHtml(tone)}">${escapeHtml(value)}</span>`;
}

function localizeMode(value: string, lang: UiLang): string {
  const ui = copy(lang);
  if (value === "rules-only") return ui.rulesOnly;
  if (value === "agent-partial") return ui.agentPartial;
  if (value === "agent-full") return ui.agentFull;
  return value || ui.unknown;
}

function localizeStatus(value: string, lang: UiLang): string {
  const ui = copy(lang);
  switch (value) {
    case "ready":
      return ui.ready;
    case "degraded":
      return ui.degraded;
    case "stale":
      return ui.stale;
    case "failed":
      return ui.failed;
    case "empty":
      return ui.empty;
    case "not-judgeable":
      return ui.notJudgeable;
    default:
      return value || ui.unknown;
  }
}

function localizeFieldValue(value: string | null | undefined, lang: UiLang): string {
  if (!value) return copy(lang).none;
  return value;
}

function formatArtifactTimestamp(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  return value.replace("T", " ").replace(/\.000Z?$/, "").replace(/Z$/, "");
}

function renderLanguageSwitcher(requestUrl: URL, lang: UiLang): string {
  const ui = copy(lang);
  const zhUrl = new URL(requestUrl.toString());
  zhUrl.searchParams.set("lang", "zh");
  const enUrl = new URL(requestUrl.toString());
  enUrl.searchParams.set("lang", "en");

  return `
    <div class="lang-switch premium-control-capsule" aria-label="${escapeHtml(ui.langLabel)}" data-segmented-control="language">
      <span class="segmented-active-bg" data-segmented-active="true" aria-hidden="true"></span>
      <a class="lang-option capsule-btn ${lang === "zh" ? "is-active" : ""}" data-segmented-option="true" href="${escapeHtml(`${zhUrl.pathname}${zhUrl.search}`)}" aria-label="${escapeHtml(ui.langZh)}" title="${escapeHtml(ui.langZh)}">
        <svg class="capsule-icon capsule-icon-translate" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M4 5h7M8 3v2m0 0c-.35 2.7-1.72 5.17-4 7m4-7c.54 2.1 1.62 3.86 3.25 5.28M13 19l4-9 4 9m-1.18-2.75h-5.64" />
        </svg>
        <span class="capsule-label">中</span>
      </a>
      <a class="lang-option capsule-btn ${lang === "en" ? "is-active" : ""}" data-segmented-option="true" href="${escapeHtml(`${enUrl.pathname}${enUrl.search}`)}" aria-label="${escapeHtml(ui.langEn)}" title="${escapeHtml(ui.langEn)}">
        <svg class="capsule-icon capsule-icon-translate" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M4 5h7M8 3v2m0 0c-.35 2.7-1.72 5.17-4 7m4-7c.54 2.1 1.62 3.86 3.25 5.28M13 19l4-9 4 9m-1.18-2.75h-5.64" />
        </svg>
        <span class="capsule-label">EN</span>
      </a>
    </div>
  `;
}

function renderThemeSwitcher(requestUrl: URL, lang: UiLang, theme: UiTheme): string {
  const lightUrl = new URL(requestUrl.toString());
  lightUrl.searchParams.set("theme", "light");
  const darkUrl = new URL(requestUrl.toString());
  darkUrl.searchParams.set("theme", "dark");

  return `
    <div class="theme-switch premium-control-capsule" aria-label="${escapeHtml(uiText(lang, "主题", "Theme"))}" data-segmented-control="theme">
      <span class="segmented-active-bg" data-segmented-active="true" aria-hidden="true"></span>
      <a class="theme-option capsule-btn ${theme === "light" ? "is-active" : ""}" data-segmented-option="true" data-theme-option="light" href="${escapeHtml(`${lightUrl.pathname}${lightUrl.search}`)}" aria-label="${escapeHtml(uiText(lang, "浅", "Light"))}" title="${escapeHtml(uiText(lang, "浅色", "Light"))}">
        <svg class="capsule-icon capsule-icon-sun" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M12 4V2.75M12 21.25V20M5.64 5.64l-.88-.88m14.48 14.48-.88-.88M4 12H2.75M21.25 12H20M5.64 18.36l-.88.88M19.24 4.76l-.88.88M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <span class="capsule-label">${escapeHtml(uiText(lang, "浅", "Light"))}</span>
      </a>
      <a class="theme-option capsule-btn ${theme === "dark" ? "is-active" : ""}" data-segmented-option="true" data-theme-option="dark" href="${escapeHtml(`${darkUrl.pathname}${darkUrl.search}`)}" aria-label="${escapeHtml(uiText(lang, "深", "Dark"))}" title="${escapeHtml(uiText(lang, "深色", "Dark"))}">
        <svg class="capsule-icon capsule-icon-moon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M20.25 14.15A7.2 7.2 0 019.85 3.75a8.25 8.25 0 1010.4 10.4z" />
        </svg>
        <span class="capsule-label">${escapeHtml(uiText(lang, "深", "Dark"))}</span>
      </a>
    </div>
  `;
}

function renderOpenSourceSettings(lang: UiLang): string {
  const settingsLabel = uiText(lang, "设置", "Settings");

  return `
    <div class="account-settings-shell" aria-hidden="true">
      <button class="account-settings-trigger" type="button" aria-label="${escapeHtml(settingsLabel)}" title="${escapeHtml(settingsLabel)}" disabled>
        <span class="account-settings-trigger-ring is-signed-out" aria-hidden="true"></span>
        <svg class="account-settings-trigger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11.983 4.5a1.5 1.5 0 011.441 1.084l.214.733a1.5 1.5 0 001.104 1.036l.757.194a1.5 1.5 0 01.816 2.42l-.505.597a1.5 1.5 0 000 1.94l.505.597a1.5 1.5 0 01-.816 2.42l-.757.194a1.5 1.5 0 00-1.104 1.036l-.214.733a1.5 1.5 0 01-2.882 0l-.214-.733a1.5 1.5 0 00-1.104-1.036l-.757-.194a1.5 1.5 0 01-.816-2.42l.505-.597a1.5 1.5 0 000-1.94l-.505-.597a1.5 1.5 0 01.816-2.42l.757-.194a1.5 1.5 0 001.104-1.036l.214-.733A1.5 1.5 0 0111.983 4.5z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span class="sr-only">${escapeHtml(settingsLabel)}</span>
      </button>
    </div>
  `;
}

function resolveDailyNavigationDate(rendered: RenderedRoute, requestUrl: URL): string {
  if (rendered.route === "weekly") return requestUrl.searchParams.get("date") ?? "latest";
  return rendered.model.context.selected_date ?? requestUrl.searchParams.get("date") ?? "latest";
}

function resolveWeeklyNavigationAnchor(rendered: RenderedRoute, requestUrl: URL): string {
  return (
    rendered.model.context.selected_window?.anchor_date ??
    requestUrl.searchParams.get("anchor") ??
    requestUrl.searchParams.get("anchor-date") ??
    requestUrl.searchParams.get("date") ??
    "latest"
  );
}

function routeIntent(route: WebRoute, lang: UiLang): string {
  const copyByRoute: Record<WebRoute, [string, string]> = {
    overview: ["先快速判断今天这批结果值不值得读。", "Decide quickly whether today's slice is worth reading."],
    projects: ["先扫一遍今天值得继续研究的项目。", "Scan which projects deserve deeper work today."],
    weekly: ["先抓住本周真正形成的趋势主线。", "Capture the real trend structure for this week."],
    "run-health": ["先定位这轮产物哪里需要谨慎。", "Locate what in this run needs caution first."],
    observer: ["先看哪些长尾候选值得继续观察。", "Check which observer candidates are worth continued follow-up."],
    kb: ["先读摘要，再决定要不要深入。", "Read the summary first, then decide whether to dive deeper."],
  };
  const [zh, en] = copyByRoute[route];
  return lang === "zh" ? zh : en;
}

function renderHeader(route: WebRoute, requestUrl: URL, rendered: RenderedRoute, lang: UiLang): string {
  const ui = copy(lang);
  const theme = resolveTheme(requestUrl);
  const dailyDate = resolveDailyNavigationDate(rendered, requestUrl);
  const weeklyAnchor = resolveWeeklyNavigationAnchor(rendered, requestUrl);
  const nav: Array<{ label: string; route: WebRoute; href: string }> = [
    { label: ui.navOverview, route: "overview", href: toViewHref("overview", lang, theme, { date: dailyDate }) },
    { label: ui.navProjects, route: "projects", href: toViewHref("projects", lang, theme, { date: dailyDate }) },
    { label: ui.navWeekly, route: "weekly", href: toViewHref("weekly", lang, theme, { anchor: weeklyAnchor, date: dailyDate }) },
    { label: ui.navRunHealth, route: "run-health", href: toViewHref("run-health", lang, theme, { date: dailyDate, source_view: route }) },
    { label: uiText(lang, "新兴潜力项目", "Observer"), route: "observer", href: toViewHref("observer", lang, theme, { date: dailyDate, source_view: route }) },
  ];

  return `
    <header class="app-header-homepage" data-nav-shell="auto-hide">
      <div class="homepage-nav-row">
        <div class="homepage-nav-main">
          <a href="${escapeHtml(nav[0]?.href ?? "#")}" class="homepage-nav-brand">
            <div class="brand-logo-emblem homepage-brand-mark" aria-hidden="true">
              <svg class="homepage-brand-mark-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span class="homepage-brand-copy">
              <strong data-typography="hero-title">${escapeHtml(ui.productName)}</strong>
              <span class="homepage-brand-subtitle">Control Panel</span>
            </span>
          </a>
          <nav class="homepage-primary-nav top-nav" aria-label="Primary" data-nav-primary="true">
            <div class="nav-tracker" data-nav-tracker="true" aria-hidden="true"></div>
            ${nav.map((item) => `<a class="nav-link ${item.route === route ? "is-active" : ""}" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join("")}
          </nav>
        </div>
        <div class="homepage-nav-tools header-meta">
          ${renderLanguageSwitcher(requestUrl, lang)}
          ${renderThemeSwitcher(requestUrl, lang, theme)}
          ${renderOpenSourceSettings(lang)}
        </div>
      </div>
      <div class="nav-intent-grid" aria-label="${escapeHtml(uiText(lang, "页面意图预览", "Route Intent Preview"))}">
        <article class="nav-intent-feature">
          <span class="eyebrow">${escapeHtml(uiText(lang, "当前工作面", "Active Surface"))}</span>
          <strong class="nav-intent-title">${escapeHtml(routeTitle(route, lang))}</strong>
          <p class="nav-intent-copy">${escapeHtml(routeIntent(route, lang))}</p>
        </article>
      </div>
    </header>
  `;
}

function updateNavHref(requestUrl: URL, mode: "daily" | "weekly", value: string): string {
  const next = new URL(requestUrl.toString());
  if (mode === "weekly") {
    next.searchParams.set("anchor", value);
    next.searchParams.delete("anchor-date");
  } else {
    next.searchParams.set("date", value);
  }
  return `${next.pathname}${next.search}`;
}

function renderNavigatorPreviewCard(
  preview: RenderedRoute["model"]["time_navigator"]["previews"][number],
  requestUrl: URL,
  lang: UiLang,
): string {
  const title = preview.kind === "weekly" ? uiText(lang, "周度切片", "Weekly Slice") : uiText(lang, "日度切片", "Daily Slice");
  const href = updateNavHref(requestUrl, preview.kind, preview.slice_key);
  const summary =
    preview.kind === "weekly"
      ? [
          `${uiText(lang, "核心趋势", "Core Trends")}: ${preview.core_trend_count}`,
          `${uiText(lang, "弱信号", "Weak Signals")}: ${preview.weak_signal_count}`,
          `${uiText(lang, "审计", "Audit")}: ${preview.audit_status ?? copy(lang).missing}`,
        ]
      : [
          `${uiText(lang, "重点项目", "Top Decisions")}: ${preview.top_decision_count}`,
          `${uiText(lang, "活跃来源", "Active Sources")}: ${preview.source_active_count}`,
          `${uiText(lang, "校验", "Verify")}: ${preview.verify_status ?? copy(lang).missing}`,
        ];

  return `
    <article class="navigator-preview-card status-${escapeHtml(preview.top_level_state)}">
      <div class="navigator-preview-head">
        <div>
          <span class="context-label">${escapeHtml(title)}</span>
          <h3><a href="${escapeHtml(href)}">${escapeHtml(preview.slice_key)}</a></h3>
        </div>
        ${badge(localizeStatus(preview.top_level_state, lang), preview.top_level_state === "ready" ? "sage" : "accent")}
      </div>
      <p class="meta-line">${escapeHtml(uiText(lang, "产物时间", "Artifact Time"))}: <span data-metric-kind="time">${escapeHtml(formatArtifactTimestamp(preview.generated_at, copy(lang).unknown))}</span></p>
      <ul class="navigator-preview-list">${summary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </article>
  `;
}

function renderContextBar(rendered: RenderedRoute, requestUrl: URL, lang: UiLang): string {
  const ui = copy(lang);
  const model = rendered.model;
  const navigator = model.time_navigator;
  const positionLabel =
    navigator.window.index >= 0 && navigator.window.total > 0
      ? `${navigator.window.index + 1}/${navigator.window.total}`
      : uiText(lang, "未定位", "Unpositioned");

  return `
    <section class="context-bar" aria-label="${escapeHtml(ui.contextBar)}">
      <div class="context-strip">
        <div class="context-item">
          <span class="context-label">${escapeHtml(ui.contextLabel)}</span>
          <strong>${escapeHtml(localizeFieldValue(model.banner.context_label, lang))}</strong>
        </div>
        <div class="context-item">
          <span class="context-label">${escapeHtml(ui.artifactTime)}</span>
          <strong data-metric-kind="time">${escapeHtml(formatArtifactTimestamp(model.banner.generated_at, ui.unknown))}</strong>
        </div>
        <div class="context-item">
          <span class="context-label">${escapeHtml(ui.topStatus)}</span>
          <strong data-metric-kind="status">${escapeHtml(localizeStatus(model.state.status, lang))}</strong>
        </div>
        <div class="context-item">
          <span class="context-label">${escapeHtml(ui.mode)}</span>
          <strong>${escapeHtml(localizeMode(model.banner.mode_label, lang))}</strong>
        </div>
        <div class="context-item">
          <span class="context-label">${escapeHtml(uiText(lang, "切片位置", "Slice Position"))}</span>
          <strong data-metric-kind="time">${escapeHtml(positionLabel)}</strong>
        </div>
      </div>
      <div class="navigator-strip" data-time-navigator="true">
        <div class="navigator-summary">
          <div>
            <span class="context-label">${escapeHtml(uiText(lang, "时间导航", "Time Navigator"))}</span>
            <strong>${escapeHtml(navigator.current_label)}</strong>
          </div>
          ${navigator.stale ? badge(localizeStatus("stale", lang), "accent") : ""}
        </div>
        <div class="navigator-actions">
          ${navigator.previous_key ? `<a class="navigator-action" data-nav-step="prev" href="${escapeHtml(updateNavHref(requestUrl, navigator.mode, navigator.previous_key))}">${escapeHtml(uiText(lang, "上一页", "Prev"))}</a>` : `<span class="navigator-action is-disabled">${escapeHtml(uiText(lang, "上一页", "Prev"))}</span>`}
          ${navigator.next_key ? `<a class="navigator-action" data-nav-step="next" href="${escapeHtml(updateNavHref(requestUrl, navigator.mode, navigator.next_key))}">${escapeHtml(uiText(lang, "下一页", "Next"))}</a>` : `<span class="navigator-action is-disabled">${escapeHtml(uiText(lang, "下一页", "Next"))}</span>`}
          ${navigator.latest_key ? `<a class="navigator-action" data-nav-step="latest" href="${escapeHtml(updateNavHref(requestUrl, navigator.mode, "latest"))}">${escapeHtml(uiText(lang, "最新", "Latest"))}</a>` : `<span class="navigator-action is-disabled">${escapeHtml(uiText(lang, "最新", "Latest"))}</span>`}
        </div>
        <details class="navigator-preview">
          <summary class="navigator-preview-toggle">
            <span class="navigator-current-pill" data-metric-kind="time">${escapeHtml(navigator.current_label)}</span>
            <span class="navigator-preview-copy">${escapeHtml(uiText(lang, "选择切片 · 展开预览", "Pick Slice · Expand Preview"))}</span>
          </summary>
          <div class="navigator-preview-grid">
            ${navigator.previews.map((preview) => renderNavigatorPreviewCard(preview, requestUrl, lang)).join("")}
          </div>
        </details>
      </div>
    </section>
  `;
}

export function renderStatusPill(label: string, tone: "neutral" | "good" | "warn" | "bad" = "neutral"): string {
  return `<span class="status-pill status-pill-${tone}">${escapeHtml(label)}</span>`;
}

export function summarizeStateTone(status: string): "neutral" | "good" | "warn" | "bad" {
  switch (status) {
    case "ready":
      return "good";
    case "stale":
    case "degraded":
      return "warn";
    case "failed":
      return "bad";
    default:
      return "neutral";
  }
}

export function formatCompactDateTime(value: string | null | undefined): string {
  if (!value) return "latest";
  return value.replace("T", " ").replace(/\.000Z?$/, "").replace(/Z$/, "");
}

export function renderDocument(
  rendered: RenderedRoute,
  requestUrl: URL,
  lang: UiLang,
  theme: UiTheme,
  routeFrameHtml: string,
  options: {
    reactImportMapHtml?: string;
    reactMountScriptHtml?: string;
    payloadScriptsHtml?: string;
  } = {},
): string {
  const ui = copy(lang);
  const bodyHtml = renderShellFrame({
    headerHtml: renderHeader(rendered.route, requestUrl, rendered, lang),
    contextBarHtml:
      rendered.route === "overview" ||
      rendered.route === "projects" ||
      rendered.route === "weekly" ||
      rendered.route === "run-health" ||
      rendered.route === "observer"
        ? ""
        : renderContextBar(rendered, requestUrl, lang),
    bannerHtml: "",
    routeFrameHtml,
  });

  return `<!doctype html>
<html lang="${lang === "zh" ? "zh-CN" : "en"}" data-theme="${theme}" class="${theme === "dark" ? "dark" : ""}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(ui.productName)} | ${escapeHtml(routeTitle(rendered.route, lang))}</title>
    <link rel="stylesheet" href="/styles.css" />
${options.reactImportMapHtml ?? ""}
${options.payloadScriptsHtml ?? ""}
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            fontFamily: {
              sans: ["Inter", "Noto Sans SC", "system-ui", "sans-serif"],
              mono: ["JetBrains Mono", "Fira Code", "monospace"],
            },
          },
        },
      };
    </script>
  </head>
  <body class="${theme === "dark" ? "theme-dark" : "theme-light"}" data-route="${rendered.route}" data-theme="${theme}" data-lang="${lang}">
${bodyHtml}
${options.reactMountScriptHtml ?? ""}
${renderClientScript()}
    <script>
      (() => {
        const root = document.documentElement;
        const key = "visual-console-theme";
        const params = new URLSearchParams(window.location.search);
        const explicit = params.get("theme");
        const stored = explicit || localStorage.getItem(key);
        if (stored === "dark" || stored === "light") {
          root.setAttribute("data-theme", stored);
          document.body?.setAttribute("data-theme", stored);
          document.body?.classList.remove("theme-light", "theme-dark");
          document.body?.classList.add(stored === "dark" ? "theme-dark" : "theme-light");
          if (stored === "dark") root.classList.add("dark");
          else root.classList.remove("dark");
        }

        document.querySelectorAll("[data-theme-option]").forEach((node) => {
          node.addEventListener("click", (event) => {
            const target = event.currentTarget;
            if (!(target instanceof HTMLElement)) return;
            const nextTheme = target.getAttribute("data-theme-option");
            if (nextTheme === "dark" || nextTheme === "light") {
              localStorage.setItem(key, nextTheme);
            }
          });
        });
      })();
    </script>
  </body>
</html>`;
}
