import {
  filterAndSortProjectCards,
  CJK_QUERY_NOISE_PATTERNS,
  DIRECT_SEARCH_QUALITY_SAMPLE_SIZE,
  extractMeaningfulProjectSearchCjkTerms,
  GENERIC_DIRECT_SEARCH_TOKENS,
  directSearchLooksNaturalLanguage,
  informativeDirectSearchTerms,
  directSearchTokenRecordCount,
  isCommonDirectSearchToken,
  normalizeProjectSearchText,
  paginateProjectCards,
  projectSearchRecordContainsTerm,
  projectSearchTextHasCjk,
  rankProjectSearchMatch,
  scoreProjectSearchField,
  shouldUseDirectProjectSearch,
  tokenizeProjectSearchText,
  type ProjectsWorkbenchCardRecord,
  type ProjectsWorkbenchPagination,
  type ProjectsWorkbenchSortMode,
  type ProjectsWorkbenchState,
} from "../../src/search/projectSearchKernel.ts";
import {
  FUZZY_SEARCH_MIN_CHINESE_CHARS,
  FUZZY_SEARCH_MIN_ENGLISH_CHARS,
  type FuzzyProjectSearchResponse,
  type FuzzySearchSource,
} from "../../src/search/fuzzyQueryTypes.ts";

export {
  filterAndSortProjectCards,
  CJK_QUERY_NOISE_PATTERNS,
  DIRECT_SEARCH_QUALITY_SAMPLE_SIZE,
  extractMeaningfulProjectSearchCjkTerms,
  GENERIC_DIRECT_SEARCH_TOKENS,
  directSearchLooksNaturalLanguage,
  informativeDirectSearchTerms,
  directSearchTokenRecordCount,
  isCommonDirectSearchToken,
  normalizeProjectSearchText,
  paginateProjectCards,
  projectSearchRecordContainsTerm,
  projectSearchTextHasCjk,
  rankProjectSearchMatch,
  shouldUseDirectProjectSearch,
  type ProjectsWorkbenchCardRecord,
  type ProjectsWorkbenchPagination,
  type ProjectsWorkbenchSortMode,
  type ProjectsWorkbenchState,
};

export interface SideAssistantSearchContext {
  composed_query: string;
  last_user_query: string;
  seen_project_ids: string[];
  last_project_ids: string[];
}

export interface SideAssistantMessage {
  role: "user" | "assistant";
  text: string;
  query?: string;
  source?: FuzzyProjectSearchResponse["source"];
  project_ids?: string[];
  preview_project_ids?: string[];
  clarification_options?: Array<{ label_cn: string; query: string }>;
  can_view_all?: boolean;
}

export interface SideAssistantActiveMainResult {
  query: string;
  project_ids: string[];
  scope_key: string;
}

export interface SideAssistantPlacementState {
  left: number;
  top: number;
}

export interface SideAssistantSearchSession {
  panel_open: boolean;
  messages: SideAssistantMessage[];
  search_context: SideAssistantSearchContext | null;
  active_main_result: SideAssistantActiveMainResult | null;
  quickstart_collapsed: boolean;
}

export function createEmptySideAssistantSession(): SideAssistantSearchSession {
  return {
    panel_open: false,
    messages: [],
    search_context: null,
    active_main_result: null,
    quickstart_collapsed: false,
  };
}

export function isSideAssistantMoreQuery(rawQuery: string): boolean {
  return /^(more|更多|再来|继续|换一批)$/i.test(normalizeProjectSearchText(rawQuery));
}

export function composeSideAssistantQuery(previous: SideAssistantSearchContext | null | undefined, rawQuery: string): string {
  const trimmed = String(rawQuery || "").trim();
  if (!trimmed) return "";
  if (isSideAssistantMoreQuery(trimmed)) return previous?.composed_query?.trim() || "";
  const previousQuery = previous?.composed_query?.trim() || "";
  return previousQuery ? `${previousQuery}\n补充：${trimmed}` : trimmed;
}

export function pickSideAssistantPreviewIds(projectIds: string[], seenProjectIds: string[] = [], limit = 3): string[] {
  const seen = new Set(seenProjectIds.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean));
  const preview: string[] = [];
  for (const id of projectIds) {
    const normalized = String(id || "").trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    preview.push(normalized);
    seen.add(key);
    if (preview.length >= Math.max(1, limit)) break;
  }
  return preview;
}

export function buildSideAssistantScopeKey(input: {
  path: string;
  date: string;
  lang: "zh" | "en";
  sort: ProjectsWorkbenchSortMode;
  paradigm: string;
  persistence: string;
}): string {
  return JSON.stringify({
    path: input.path || "/projects",
    date: input.date || "latest",
    lang: input.lang === "en" ? "en" : "zh",
    sort: input.sort === "growth" ? "growth" : "score",
    paradigm: input.paradigm || "all",
    persistence: input.persistence || "all",
  });
}

export function canRestoreSideAssistantMainResult(scopeKey: string | null | undefined, currentScopeKey: string): boolean {
  return Boolean(scopeKey) && scopeKey === currentScopeKey;
}

export function normalizeSideAssistantPlacement(value: unknown): SideAssistantPlacementState | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const left = Number(record.left);
  const top = Number(record.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  return { left, top };
}

export function clampSideAssistantPlacement(
  placement: SideAssistantPlacementState,
  viewport: { width: number; height: number },
  bounds: { width: number; height: number },
  margin = 8,
): SideAssistantPlacementState {
  const maxLeft = Math.max(margin, Math.floor(viewport.width - bounds.width - margin));
  const maxTop = Math.max(margin, Math.floor(viewport.height - bounds.height - margin));
  return {
    left: Math.min(Math.max(Math.floor(placement.left), margin), maxLeft),
    top: Math.min(Math.max(Math.floor(placement.top), margin), maxTop),
  };
}

export function shouldStartSideAssistantDrag(
  delta: { x: number; y: number },
  threshold = 4,
): boolean {
  return Math.hypot(delta.x, delta.y) >= threshold;
}

export function resetSideAssistantConversation(session: SideAssistantSearchSession, keepPanelOpen = true): SideAssistantSearchSession {
  return {
    panel_open: keepPanelOpen,
    messages: [],
    search_context: null,
    active_main_result: null,
    quickstart_collapsed: false,
  };
}

export function normalizeSideAssistantSession(value: unknown): SideAssistantSearchSession {
  if (!value || typeof value !== "object") return createEmptySideAssistantSession();
  const record = value as Record<string, unknown>;
  return {
    panel_open: record.panel_open === true,
    messages: Array.isArray(record.messages)
      ? record.messages
          .filter((message) => message && typeof message === "object")
          .map((message): SideAssistantMessage => {
            const item = message as Record<string, unknown>;
            return {
              role: item.role === "user" ? "user" : "assistant",
              text: typeof item.text === "string" ? item.text : "",
              query: typeof item.query === "string" ? item.query : "",
              source: typeof item.source === "string" ? (item.source as FuzzySearchSource) : undefined,
              project_ids: Array.isArray(item.project_ids) ? item.project_ids.map((entry) => String(entry || "")).filter(Boolean) : [],
              preview_project_ids: Array.isArray(item.preview_project_ids) ? item.preview_project_ids.map((entry) => String(entry || "")).filter(Boolean) : [],
              clarification_options: Array.isArray(item.clarification_options)
                ? item.clarification_options
                    .filter((option) => option && typeof option === "object")
                    .map((option) => {
                      const choice = option as Record<string, unknown>;
                      return {
                        label_cn: typeof choice.label_cn === "string" ? choice.label_cn : "",
                        query: typeof choice.query === "string" ? choice.query : "",
                      };
                    })
                    .filter((option) => option.label_cn || option.query)
                : [],
              can_view_all: item.can_view_all === true,
            };
          })
          .filter((message) => message.text)
      : [],
    search_context:
      record.search_context && typeof record.search_context === "object"
        ? {
            composed_query: typeof (record.search_context as Record<string, unknown>).composed_query === "string"
              ? ((record.search_context as Record<string, unknown>).composed_query as string)
              : "",
            last_user_query: typeof (record.search_context as Record<string, unknown>).last_user_query === "string"
              ? ((record.search_context as Record<string, unknown>).last_user_query as string)
              : "",
            seen_project_ids: Array.isArray((record.search_context as Record<string, unknown>).seen_project_ids)
              ? ((record.search_context as Record<string, unknown>).seen_project_ids as unknown[]).map((entry) => String(entry || "")).filter(Boolean)
              : [],
            last_project_ids: Array.isArray((record.search_context as Record<string, unknown>).last_project_ids)
              ? ((record.search_context as Record<string, unknown>).last_project_ids as unknown[]).map((entry) => String(entry || "")).filter(Boolean)
              : [],
          }
        : null,
    active_main_result:
      record.active_main_result && typeof record.active_main_result === "object"
        ? {
            query: typeof (record.active_main_result as Record<string, unknown>).query === "string"
              ? ((record.active_main_result as Record<string, unknown>).query as string)
              : "",
            project_ids: Array.isArray((record.active_main_result as Record<string, unknown>).project_ids)
              ? ((record.active_main_result as Record<string, unknown>).project_ids as unknown[]).map((entry) => String(entry || "")).filter(Boolean)
              : [],
            scope_key: typeof (record.active_main_result as Record<string, unknown>).scope_key === "string"
              ? ((record.active_main_result as Record<string, unknown>).scope_key as string)
              : "",
          }
        : null,
    quickstart_collapsed: record.quickstart_collapsed === true,
  };
}

export function renderClientScriptSource(): string {
  return `
      (() => {
        if (window.__visualConsoleClientBound) return;
        window.__visualConsoleClientBound = true;
        const normalizeProjectSearchText = ${normalizeProjectSearchText.toString()};
        const tokenizeProjectSearchText = ${tokenizeProjectSearchText.toString()};
        const projectSearchTextHasCjk = ${projectSearchTextHasCjk.toString()};
        const extractMeaningfulProjectSearchCjkTerms = ${extractMeaningfulProjectSearchCjkTerms.toString()};
        const projectSearchRecordContainsTerm = ${projectSearchRecordContainsTerm.toString()};
        const scoreProjectSearchField = ${scoreProjectSearchField.toString()};
        const rankProjectSearchMatch = ${rankProjectSearchMatch.toString()};
        const shouldUseDirectProjectSearch = ${shouldUseDirectProjectSearch.toString()};
        const isSideAssistantMoreQuery = ${isSideAssistantMoreQuery.toString()};
        const composeSideAssistantQuery = ${composeSideAssistantQuery.toString()};
        const pickSideAssistantPreviewIds = ${pickSideAssistantPreviewIds.toString()};
        const buildSideAssistantScopeKey = ${buildSideAssistantScopeKey.toString()};
        const canRestoreSideAssistantMainResult = ${canRestoreSideAssistantMainResult.toString()};
        const normalizeSideAssistantPlacement = ${normalizeSideAssistantPlacement.toString()};
        const clampSideAssistantPlacement = ${clampSideAssistantPlacement.toString()};
        const shouldStartSideAssistantDrag = ${shouldStartSideAssistantDrag.toString()};
        const createEmptySideAssistantSession = ${createEmptySideAssistantSession.toString()};
        const normalizeSideAssistantSession = ${normalizeSideAssistantSession.toString()};
        const directSearchLooksNaturalLanguage = ${directSearchLooksNaturalLanguage.toString()};
        const informativeDirectSearchTerms = ${informativeDirectSearchTerms.toString()};
        const directSearchTokenRecordCount = ${directSearchTokenRecordCount.toString()};
        const isCommonDirectSearchToken = ${isCommonDirectSearchToken.toString()};
        const DIRECT_SEARCH_QUALITY_SAMPLE_SIZE = ${DIRECT_SEARCH_QUALITY_SAMPLE_SIZE};
        const GENERIC_DIRECT_SEARCH_TOKENS = new Set(${JSON.stringify(Array.from(GENERIC_DIRECT_SEARCH_TOKENS))});
        const CJK_QUERY_NOISE_PATTERNS = ${JSON.stringify(CJK_QUERY_NOISE_PATTERNS)};
        const filterAndSortProjectCards = ${filterAndSortProjectCards.toString()};
        const paginateProjectCards = ${paginateProjectCards.toString()};
        const fuzzySearchMinChineseChars = ${FUZZY_SEARCH_MIN_CHINESE_CHARS};
        const fuzzySearchMinEnglishChars = ${FUZZY_SEARCH_MIN_ENGLISH_CHARS};
        const FUZZY_SEARCH_MIN_CHINESE_CHARS = fuzzySearchMinChineseChars;
        const FUZZY_SEARCH_MIN_ENGLISH_CHARS = fuzzySearchMinEnglishChars;
        const queryMeetsFuzzyTriggerThreshold = (rawQuery) => {
          const normalized = normalizeProjectSearchText(rawQuery);
          if (!normalized) return false;
          const cjkCount = Array.from(normalized).filter((char) => /[\\u3400-\\u9fff]/u.test(char)).length;
          if (cjkCount > 0) return cjkCount >= FUZZY_SEARCH_MIN_CHINESE_CHARS;
          return normalized.replace(/\\s+/g, "").length >= FUZZY_SEARCH_MIN_ENGLISH_CHARS;
        };
        const sideAssistantSessionStorageKey = "visual-console-side-assistant-search";
        const sideAssistantPlacementStorageKey = "visual-console-side-assistant-placement-v4";
        const readSideAssistantSession = () => {
          try {
            return normalizeSideAssistantSession(JSON.parse(sessionStorage.getItem(sideAssistantSessionStorageKey) || "null"));
          } catch {
            return normalizeSideAssistantSession(null);
          }
        };
        const writeSideAssistantSession = (session) => {
          try {
            sessionStorage.setItem(sideAssistantSessionStorageKey, JSON.stringify(session));
          } catch {}
        };
        const readSideAssistantPlacement = () => {
          try {
            return normalizeSideAssistantPlacement(JSON.parse(sessionStorage.getItem(sideAssistantPlacementStorageKey) || "null"));
          } catch {
            return null;
          }
        };
        const writeSideAssistantPlacement = (placement) => {
          try {
            if (!placement) {
              sessionStorage.removeItem(sideAssistantPlacementStorageKey);
              return;
            }
            sessionStorage.setItem(sideAssistantPlacementStorageKey, JSON.stringify(placement));
          } catch {}
        };
        const clearSideAssistantPlacement = () => writeSideAssistantPlacement(null);
        const applySideAssistantPlacement = (assistantHost, boundsOverride) => {
          if (!(assistantHost instanceof HTMLElement)) return null;
          const placement = readSideAssistantPlacement();
          if (!placement) {
            assistantHost.classList.remove("is-floating");
            assistantHost.style.left = "";
            assistantHost.style.top = "";
            assistantHost.style.right = "";
            assistantHost.style.transform = "";
            return null;
          }
          const rect = boundsOverride || assistantHost.getBoundingClientRect();
          const clamped = clampSideAssistantPlacement(
            placement,
            { width: window.innerWidth, height: window.innerHeight },
            { width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) },
          );
          assistantHost.classList.add("is-floating");
          assistantHost.style.left = clamped.left + "px";
          assistantHost.style.top = clamped.top + "px";
          assistantHost.style.right = "auto";
          assistantHost.style.transform = "";
          if (clamped.left !== placement.left || clamped.top !== placement.top) {
            writeSideAssistantPlacement(clamped);
          }
          return clamped;
        };
        const bindSideAssistantPlacement = ({ assistantHost, assistantLauncher, assistantPanel }) => {
          if (!(assistantHost instanceof HTMLElement) || assistantHost.dataset.projectsAiPlacementBound === "true") return;
          assistantHost.dataset.projectsAiPlacementBound = "true";
          const shouldSuppressAssistantClick = () => Number(assistantHost.dataset.projectsAiSuppressClickUntil || "0") > Date.now();
          let dragPointerId = null;
          let dragHandle = null;
          let dragOffsetX = 0;
          let dragOffsetY = 0;
          let dragBounds = null;
          let dragPlacement = null;
          let dragPendingPlacement = null;
          let dragBaseLeft = 0;
          let dragBaseTop = 0;
          let dragFrameId = 0;
          let dragStartClientX = 0;
          let dragStartClientY = 0;
          let dragMoved = false;
          const renderDragFrame = () => {
            dragFrameId = 0;
            if (!dragPendingPlacement) return;
            assistantHost.style.transform = "translate3d(" + String(dragPendingPlacement.left - dragBaseLeft) + "px, " + String(dragPendingPlacement.top - dragBaseTop) + "px, 0)";
          };
          const scheduleDragFrame = () => {
            if (dragFrameId === 0) dragFrameId = requestAnimationFrame(renderDragFrame);
          };
          const clearDrag = () => {
            if (dragFrameId !== 0) cancelAnimationFrame(dragFrameId);
            dragPointerId = null;
            dragHandle = null;
            dragBounds = null;
            dragPlacement = null;
            dragPendingPlacement = null;
            dragBaseLeft = 0;
            dragBaseTop = 0;
            dragFrameId = 0;
            dragStartClientX = 0;
            dragStartClientY = 0;
            dragMoved = false;
            document.body?.classList.remove("projects-ai-dragging");
            assistantHost.classList.remove("is-dragging");
          };
          const startDrag = (event, handle) => {
            if (!(handle instanceof HTMLElement)) return;
            const interactiveTarget = event.target instanceof Element
              ? event.target.closest("button, a, input, textarea, select, label, [data-projects-ai-option-query], [data-projects-ai-view-all='true'], [data-projects-ai-quickstart-toggle='true'], [data-projects-ai-project-link='true']")
              : null;
            if (interactiveTarget && interactiveTarget !== handle) return;
            if (event.button !== 0 || event.isPrimary === false) return;
            const hostBounds = assistantHost.getBoundingClientRect();
            dragBounds = { width: Math.max(1, Math.round(hostBounds.width)), height: Math.max(1, Math.round(hostBounds.height)) };
            dragPlacement = applySideAssistantPlacement(assistantHost, hostBounds) || {
              left: Math.round(hostBounds.left),
              top: Math.round(hostBounds.top),
            };
            dragBaseLeft = dragPlacement.left;
            dragBaseTop = dragPlacement.top;
            dragPointerId = event.pointerId;
            dragHandle = handle;
            dragStartClientX = event.clientX;
            dragStartClientY = event.clientY;
            dragOffsetX = event.clientX - hostBounds.left;
            dragOffsetY = event.clientY - hostBounds.top;
            dragHandle?.setPointerCapture?.(event.pointerId);
          };
          const launcherHandle = assistantLauncher instanceof HTMLElement ? assistantLauncher : null;
          const panelHandle = assistantPanel instanceof HTMLElement ? assistantPanel.querySelector(".projects-ai-panel-head") : null;
          launcherHandle instanceof HTMLElement &&
            launcherHandle.addEventListener("pointerdown", (event) => {
              if (assistantPanel instanceof HTMLElement && !assistantPanel.hidden) return;
              startDrag(event, launcherHandle);
            });
          launcherHandle instanceof HTMLElement && launcherHandle.addEventListener("dragstart", (event) => event.preventDefault());
          const restoreDefaultPlacement = () => {
            clearSideAssistantPlacement();
            applySideAssistantPlacement(assistantHost);
          };
          panelHandle instanceof HTMLElement && panelHandle.addEventListener("dblclick", restoreDefaultPlacement);
          document.addEventListener("pointermove", (event) => {
            if (dragPointerId !== event.pointerId || !dragBounds) return;
            if (
              !dragMoved &&
              !shouldStartSideAssistantDrag({ x: event.clientX - dragStartClientX, y: event.clientY - dragStartClientY })
            ) {
              return;
            }
            if (!dragMoved) {
              dragMoved = true;
              document.body?.classList.add("projects-ai-dragging");
              assistantHost.classList.add("is-dragging");
              assistantHost.classList.add("is-floating");
              assistantHost.style.left = dragBaseLeft + "px";
              assistantHost.style.top = dragBaseTop + "px";
              assistantHost.style.right = "auto";
              assistantHost.style.transform = "";
            }
            dragPlacement = clampSideAssistantPlacement(
              { left: event.clientX - dragOffsetX, top: event.clientY - dragOffsetY },
              { width: window.innerWidth, height: window.innerHeight },
              dragBounds,
            );
            dragPendingPlacement = dragPlacement;
            scheduleDragFrame();
            event.preventDefault();
          });
          const stopDrag = (event) => {
            if (dragPointerId !== event.pointerId) return;
            if (dragMoved && dragPlacement) {
              assistantHost.dataset.projectsAiSuppressClickUntil = String(Date.now() + 800);
              assistantHost.style.transform = "";
              assistantHost.style.left = dragPlacement.left + "px";
              assistantHost.style.top = dragPlacement.top + "px";
              assistantHost.style.right = "auto";
              writeSideAssistantPlacement(dragPlacement);
              event.preventDefault();
              event.stopPropagation();
            }
            dragHandle?.releasePointerCapture?.(event.pointerId);
            clearDrag();
          };
          document.addEventListener("pointerup", stopDrag);
          document.addEventListener("pointercancel", stopDrag);
          window.addEventListener("resize", () => {
            applySideAssistantPlacement(assistantHost);
          });
          launcherHandle instanceof HTMLElement &&
            launcherHandle.addEventListener("click", (event) => {
              if (!shouldSuppressAssistantClick()) return;
              event.preventDefault();
              event.stopPropagation();
            }, true);
          panelHandle instanceof HTMLElement &&
            panelHandle.addEventListener("click", (event) => {
              if (!shouldSuppressAssistantClick()) return;
              event.preventDefault();
              event.stopPropagation();
            }, true);
          applySideAssistantPlacement(assistantHost);
        };
        const syncSideAssistantShell = () => {
          const session = readSideAssistantSession();
          const assistantHost = document.querySelector("[data-projects-ai-assistant-host='true']");
          const assistantLauncher = document.querySelector("[data-projects-ai-launch='true']");
          const assistantPanel = document.querySelector("[data-projects-ai-panel='true']");
          const assistantInput = document.querySelector("[data-projects-ai-input='true']");
          document.body?.classList.toggle("projects-ai-open", session.panel_open === true);
          if (assistantHost instanceof HTMLElement) assistantHost.style.pointerEvents = "none";
          if (assistantLauncher instanceof HTMLElement) {
            assistantLauncher.hidden = session.panel_open === true;
            assistantLauncher.style.pointerEvents = "auto";
          }
          if (assistantPanel instanceof HTMLElement) {
            assistantPanel.hidden = session.panel_open !== true;
            assistantPanel.style.pointerEvents = "auto";
          }
          if (session.panel_open === true && assistantInput instanceof HTMLInputElement) {
            assistantInput.focus({ preventScroll: true });
          }
        };
        const setSideAssistantPanelOpen = (isOpen) => {
          const session = readSideAssistantSession();
          session.panel_open = isOpen;
          writeSideAssistantSession(session);
          syncSideAssistantShell();
          if (isOpen) {
            applySideAssistantPlacement(document.querySelector("[data-projects-ai-assistant-host='true']"));
          }
        };

        const scrollKey = "visual-console-scroll-target";
        const routes = new Set(["/overview", "/projects", "/weekly", "/run-health", "/observer", "/agentreach", "/kb"]);
        const reactRuntimeRoutes = new Set(["overview", "weekly", "run-health", "observer", "agentreach"]);
        const reactImportMapId = "visual-console-react-import-map";
        const reactMountScriptId = "visual-console-react-mount-script";
        const reactMountScriptSrc = "/app-client/mount.js";
        const reactImportMap = {
          imports: {
            react: "https://esm.sh/react@19.2.0",
            "react/jsx-runtime": "https://esm.sh/react@19.2.0/jsx-runtime",
            "react-dom/client": "https://esm.sh/react-dom@19.2.0/client?external=react",
          },
        };
        const workspaceSections = ["signals", "decisions", "watchlist", "sources"];
        const workspaceRailSections = ["decisions", "watchlist", "sources"];
        const hydrationPayloadConfigs = [
          {
            scriptId: "projects-detail-payload",
            windowKey: "__PROJECTS_DETAIL_PAYLOAD__",
          },
          {
            scriptId: "overview-react-payload",
            windowKey: "__INITIAL_DATA__",
          },
          {
            scriptId: "weekly-react-payload",
            windowKey: "__WEEKLY_INITIAL_DATA__",
          },
          {
            scriptId: "run-health-react-payload",
            windowKey: "__RUN_HEALTH_INITIAL_DATA__",
          },
          {
            scriptId: "observer-react-payload",
            windowKey: "__OBSERVER_INITIAL_DATA__",
          },
          {
            scriptId: "agentreach-react-payload",
            windowKey: "__AGENTREACH_INITIAL_DATA__",
          },
        ];
        const routePrefetchCache = new Map();
        const routePayloadCache = new Map();
        const warmRoutePrefetchCache =
          window.__visualConsoleWarmRouteCache && typeof window.__visualConsoleWarmRouteCache === "object"
            ? window.__visualConsoleWarmRouteCache
            : {};
        const warmRoutePrefetchPromiseCache =
          window.__visualConsoleWarmRoutePromises && typeof window.__visualConsoleWarmRoutePromises === "object"
            ? window.__visualConsoleWarmRoutePromises
            : {};
        const routePrefetchMaxEntries = 12;

        let autoHideNavShell = null;
        let autoHideNavLastY = 0;
        let autoHideNavTicking = false;
        let autoHideNavListenerBound = false;
        let premiumNavResizeBound = false;
        let routePrefetchIdleHandle = null;
        let projectDetailPrefetchIdleHandle = null;
        let reactRemountIdleHandle = null;
        const detailSurfaceState = { engagedKey: null };
        const themeStorageKey = "visual-console-theme";
        const themeChangeEventName = "visual-console-theme-change";
        const isThemeValue = (value) => value === "light" || value === "dark";

        const readScroll = () => {
          try { return JSON.parse(sessionStorage.getItem(scrollKey) || "null"); } catch { return null; }
        };
        const writeScroll = (payload) => {
          try { sessionStorage.setItem(scrollKey, JSON.stringify(payload)); } catch {}
        };
        const clearScroll = () => {
          try { sessionStorage.removeItem(scrollKey); } catch {}
        };
        const clearScrollForHref = (href) => {
          const payload = readScroll();
          if (payload && payload.href === href) clearScroll();
        };
        const readStoredTheme = () => {
          try {
            const value = localStorage.getItem(themeStorageKey);
            return isThemeValue(value) ? value : null;
          } catch {
            return null;
          }
        };
        const readDocumentTheme = () => {
          if (
            document.documentElement.classList.contains("dark") ||
            document.documentElement.getAttribute("data-theme") === "dark" ||
            document.body?.classList.contains("theme-dark") ||
            document.body?.getAttribute("data-theme") === "dark"
          ) {
            return "dark";
          }
          return "light";
        };
        const resolveActiveTheme = () => readStoredTheme() ?? readDocumentTheme();
        const syncThemeClasses = (theme) => {
          const resolvedTheme = theme === "dark" ? "dark" : "light";
          document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
          document.documentElement.setAttribute("data-theme", resolvedTheme);
          if (document.body instanceof HTMLBodyElement) {
            document.body.classList.remove("theme-light", "theme-dark");
            document.body.classList.add(resolvedTheme === "dark" ? "theme-dark" : "theme-light");
            document.body.setAttribute("data-theme", resolvedTheme);
          }
          return resolvedTheme;
        };
        const buildThemeAwareHref = (href, theme, nextThemeOverride = null) => {
          try {
            const url = new URL(href, window.location.href);
            if (url.origin !== window.location.origin || !routes.has(url.pathname)) return null;
            url.searchParams.set("theme", nextThemeOverride ?? theme);
            return url.toString();
          } catch {
            return null;
          }
        };
        const syncThemeOptionLinks = (theme) => {
          document.querySelectorAll("[data-theme-option]").forEach((node) => {
            if (!(node instanceof HTMLAnchorElement)) return;
            const optionTheme = isThemeValue(node.dataset.themeOption) ? node.dataset.themeOption : "light";
            const nextHref = buildThemeAwareHref(window.location.href, theme, optionTheme);
            if (nextHref) node.href = nextHref;
            node.classList.toggle("is-active", optionTheme === theme);
            node.setAttribute("aria-pressed", optionTheme === theme ? "true" : "false");
          });
          document.querySelectorAll("[data-segmented-control='theme']").forEach((control) => {
            syncSegmentedControl(control);
          });
        };
        const syncThemeAwareLinks = (theme) => {
          document.querySelectorAll("a[href]").forEach((node) => {
            if (!(node instanceof HTMLAnchorElement) || node.hasAttribute("data-theme-option")) return;
            const nextHref = buildThemeAwareHref(node.href, theme);
            if (nextHref) node.href = nextHref;
          });
          document.querySelectorAll("input[name='return_to']").forEach((node) => {
            if (!(node instanceof HTMLInputElement) || !node.value) return;
            const nextHref = buildThemeAwareHref(node.value, theme);
            if (nextHref) {
              const nextUrl = new URL(nextHref, window.location.href);
              node.value = nextUrl.pathname + nextUrl.search + nextUrl.hash;
            }
          });
        };
        const updateThemeLocation = (theme) => {
          const nextHref = buildThemeAwareHref(window.location.href, theme);
          if (nextHref) {
            window.history.replaceState(window.history.state ?? {}, "", nextHref);
          }
        };
        const persistTheme = (theme) => {
          try {
            localStorage.setItem(themeStorageKey, theme);
          } catch {}
        };
        const broadcastThemeChange = (theme) => {
          window.dispatchEvent(new CustomEvent(themeChangeEventName, { detail: { theme } }));
        };
        const applyThemePreference = (theme, options = {}) => {
          const resolvedTheme = syncThemeClasses(theme);
          if (options.persist !== false) persistTheme(resolvedTheme);
          if (options.updateLocation !== false) updateThemeLocation(resolvedTheme);
          syncThemeOptionLinks(resolvedTheme);
          syncThemeAwareLinks(resolvedTheme);
          if (options.broadcast !== false) broadcastThemeChange(resolvedTheme);
          return resolvedTheme;
        };
        const initializeThemePreference = () => {
          const theme = resolveActiveTheme();
          applyThemePreference(theme, { persist: true, updateLocation: true, broadcast: false });
          return theme;
        };
        const isDesktopViewport = () => !window.matchMedia("(max-width: 640px)").matches;
        const recordMetric = (kind, duration, href) => {
          const metrics = Array.isArray(window.__visualConsoleMetrics) ? window.__visualConsoleMetrics : [];
          metrics.push({ kind, duration, href, recordedAt: Date.now() });
          window.__visualConsoleMetrics = metrics;
        };
        const scheduleIdleTask = (callback, timeout = 180) => {
          if (typeof window.requestIdleCallback === "function") {
            return window.requestIdleCallback(callback, { timeout });
          }
          return window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 16);
        };
        const cancelIdleTask = (handle) => {
          if (handle === null || handle === undefined) return;
          if (typeof window.cancelIdleCallback === "function") {
            window.cancelIdleCallback(handle);
            return;
          }
          window.clearTimeout(handle);
        };
        const snapshotNeedsReactRuntime = (snapshot) => reactRuntimeRoutes.has(snapshot?.bodyRoute || "");
        const ensureReactImportMap = () => {
          if (document.getElementById(reactImportMapId) || document.querySelector("script[type='importmap']")) return;
          const script = document.createElement("script");
          script.id = reactImportMapId;
          script.type = "importmap";
          script.textContent = JSON.stringify(reactImportMap);
          document.head.appendChild(script);
        };
        const ensureReactRuntime = () => {
          if (typeof window.__mountVisualConsoleApps === "function") return Promise.resolve(true);
          if (window.__visualConsoleReactRuntimePromise) return window.__visualConsoleReactRuntimePromise;

          ensureReactImportMap();
          window.__visualConsoleReactRuntimePromise = new Promise((resolve) => {
            const timeout = window.setTimeout(() => {
              resolve(typeof window.__mountVisualConsoleApps === "function");
            }, 4000);
            const finish = () => {
              window.clearTimeout(timeout);
              requestAnimationFrame(() => {
                resolve(typeof window.__mountVisualConsoleApps === "function");
              });
            };
            const existingScript =
              document.getElementById(reactMountScriptId) ||
              document.querySelector('script[type="module"][src="/app-client/mount.js"]');
            if (existingScript instanceof HTMLScriptElement) {
              existingScript.addEventListener("load", finish, { once: true });
              existingScript.addEventListener("error", () => {
                window.clearTimeout(timeout);
                resolve(false);
              }, { once: true });
              if (typeof window.__mountVisualConsoleApps === "function") finish();
              return;
            }

            const script = document.createElement("script");
            script.id = reactMountScriptId;
            script.type = "module";
            script.src = reactMountScriptSrc;
            script.addEventListener("load", finish, { once: true });
            script.addEventListener("error", () => {
              window.clearTimeout(timeout);
              resolve(false);
            }, { once: true });
            document.body.appendChild(script);
          });
          return window.__visualConsoleReactRuntimePromise;
        };
        const trimRoutePrefetchCache = () => {
          while (routePrefetchCache.size > routePrefetchMaxEntries) {
            const oldestKey = routePrefetchCache.keys().next().value;
            if (!oldestKey) return;
            routePrefetchCache.delete(oldestKey);
          }
        };
        const trimRoutePayloadCache = () => {
          while (routePayloadCache.size > routePrefetchMaxEntries) {
            const oldestKey = routePayloadCache.keys().next().value;
            if (!oldestKey) return;
            routePayloadCache.delete(oldestKey);
          }
        };
        const routePrefetchCacheKey = (href, kind = "navigation") => {
          const normalizedHref = new URL(href, window.location.href).toString();
          return [kind, normalizedHref].join(":");
        };
        const rememberRoutePrefetch = (cacheKey, entry) => {
          routePrefetchCache.delete(cacheKey);
          routePrefetchCache.set(cacheKey, entry);
          trimRoutePrefetchCache();
          return entry;
        };
        const seedCurrentRoutePrefetch = (href = window.location.href) => {
          const normalizedHref = new URL(href, window.location.href).toString();
          const cacheKey = routePrefetchCacheKey(normalizedHref, "navigation");
          return rememberRoutePrefetch(cacheKey, {
            status: "ready",
            href: normalizedHref,
            finalHref: normalizedHref,
            kind: "navigation",
            snapshot: captureCurrentRouteSnapshot(),
            fetchedAt: Date.now(),
          });
        };
        const consumeWarmRoutePrefetch = (cacheKey, normalizedHref, requestKind) => {
          const warmed = warmRoutePrefetchCache[cacheKey];
          if (!warmed) return null;
          delete warmRoutePrefetchCache[cacheKey];
          const snapshot =
            requestKind === "detail" && warmed?.route === "projects-detail"
              ? warmed
              : buildNavigationSnapshot(warmed);
          return rememberRoutePrefetch(cacheKey, {
            status: "ready",
            href: normalizedHref,
            finalHref: normalizedHref,
            kind: requestKind,
            snapshot,
            fetchedAt: Date.now(),
          });
        };
        const consumeWarmRoutePrefetchPromise = (cacheKey, normalizedHref, requestKind) => {
          const warmedPromise = warmRoutePrefetchPromiseCache[cacheKey];
          if (!warmedPromise || typeof warmedPromise.then !== "function") return null;
          const request = Promise.resolve(warmedPromise)
            .then((payload) => {
              if (!payload) {
                routePrefetchCache.delete(cacheKey);
                throw new Error("prefetch-failed");
              }
              const snapshot =
                requestKind === "detail" && payload?.route === "projects-detail"
                  ? payload
                  : buildNavigationSnapshot(payload);
              const readyEntry = {
                status: "ready",
                href: normalizedHref,
                finalHref: normalizedHref,
                kind: requestKind,
                snapshot,
                fetchedAt: Date.now(),
              };
              rememberRoutePrefetch(cacheKey, readyEntry);
              return readyEntry;
            })
            .catch((error) => {
              routePrefetchCache.delete(cacheKey);
              throw error;
            });

          rememberRoutePrefetch(cacheKey, {
            status: "pending",
            href: normalizedHref,
            promise: request,
            fetchedAt: Date.now(),
          });
          return request;
        };
        const rememberRoutePayload = (href, entry) => {
          routePayloadCache.delete(href);
          routePayloadCache.set(href, entry);
          trimRoutePayloadCache();
          return entry;
        };
        const createTemplate = (html) => {
          if (!html) return null;
          const template = document.createElement("template");
          template.innerHTML = html.trim();
          return template;
        };
        const cloneTemplateElement = (template) => {
          const element = template?.content.firstElementChild;
          return element ? element.cloneNode(true) : null;
        };
        const createSnapshotRecord = (base = {}) => ({
          title: base.title || "",
          documentLang: base.documentLang || "",
          documentClassName: base.documentClassName || "",
          documentTheme: base.documentTheme || "",
          bodyClassName: base.bodyClassName || "",
          bodyRoute: base.bodyRoute || "",
          bodyTheme: base.bodyTheme || "",
          headerTemplate: base.headerTemplate || null,
          primaryTemplate: base.primaryTemplate || null,
          appShellTemplate: base.appShellTemplate || null,
          layoutTemplate: base.layoutTemplate || null,
          payloadTexts: base.payloadTexts || {},
          payloadHrefs: base.payloadHrefs || {},
        });
        const captureCurrentRouteSnapshot = () => {
          const payloadTexts = {};
          hydrationPayloadConfigs.forEach(({ scriptId }) => {
            payloadTexts[scriptId] = document.getElementById(scriptId)?.textContent ?? "";
          });
          const payloadHrefs = {};
          [
            ["observer-react-payload", document.querySelector("#observer-react-root[data-react-ssr='false']")],
            ["run-health-react-payload", document.querySelector("#run-health-react-root[data-react-ssr='false']")],
          ].forEach(([scriptId, node]) => {
            if (node instanceof HTMLElement) {
              payloadHrefs[scriptId] = node.getAttribute("data-react-payload-url") || "";
            }
          });
          return createSnapshotRecord({
            title: document.title,
            documentLang: document.documentElement.lang || "",
            documentClassName: document.documentElement.className,
            documentTheme: document.documentElement.getAttribute("data-theme") || "",
            bodyClassName: document.body?.className || "",
            bodyRoute: document.body?.getAttribute("data-route") || "",
            bodyTheme: document.body?.getAttribute("data-theme") || "",
            headerTemplate: createTemplate(document.querySelector(".page-frame-top-nav-shell")?.outerHTML || ""),
            primaryTemplate: createTemplate(document.querySelector(".primary-content")?.outerHTML || ""),
            appShellTemplate: createTemplate(document.querySelector(".app-shell")?.outerHTML || ""),
            layoutTemplate: createTemplate(document.querySelector(".primary-content .content-layout")?.outerHTML || ""),
            payloadTexts,
            payloadHrefs,
          });
        };
        const resolvePayloadScriptIdForHref = (href) => {
          try {
            const url = new URL(href, window.location.href);
            if (url.pathname === "/observer") return "observer-react-payload";
            if (url.pathname === "/run-health") return "run-health-react-payload";
          } catch {}
          return "";
        };
        const snapshotHasHydrationPayload = (snapshot, scriptId) => {
          if (!scriptId) return false;
          const payloadText = snapshot?.payloadTexts?.[scriptId];
          return typeof payloadText === "string" && payloadText.trim().length > 0;
        };
        const buildRouteSnapshot = (html) => {
          const parsed = new DOMParser().parseFromString(html, "text/html");
          const payloadTexts = {};
          hydrationPayloadConfigs.forEach(({ scriptId }) => {
            payloadTexts[scriptId] = parsed.getElementById(scriptId)?.textContent ?? "";
          });
          const payloadHrefs = {};
          [
            ["observer-react-payload", parsed.querySelector("#observer-react-root[data-react-ssr='false']")],
            ["run-health-react-payload", parsed.querySelector("#run-health-react-root[data-react-ssr='false']")],
          ].forEach(([scriptId, node]) => {
            if (node instanceof HTMLElement) {
              payloadHrefs[scriptId] = node.getAttribute("data-react-payload-url") || "";
            }
          });
          return createSnapshotRecord({
            title: parsed.title,
            documentLang: parsed.documentElement.lang || "",
            documentClassName: parsed.documentElement.className,
            documentTheme: parsed.documentElement.getAttribute("data-theme") || "",
            bodyClassName: parsed.body.className,
            bodyRoute: parsed.body.getAttribute("data-route") || "",
            bodyTheme: parsed.body.getAttribute("data-theme") || "",
            headerTemplate: createTemplate(parsed.querySelector(".page-frame-top-nav-shell")?.outerHTML || ""),
            primaryTemplate: createTemplate(parsed.querySelector(".primary-content")?.outerHTML || ""),
            appShellTemplate: createTemplate(parsed.querySelector(".app-shell")?.outerHTML || ""),
            layoutTemplate: createTemplate(parsed.querySelector(".primary-content .content-layout")?.outerHTML || ""),
            payloadTexts,
            payloadHrefs,
          });
        };
        const buildNavigationSnapshot = (payload) => {
          const headerTemplate = createTemplate(payload?.headerHtml || "");
          const primaryTemplate = createTemplate(payload?.primaryHtml || "");
          const payloadHrefs = {};
          [
            ["observer-react-payload", primaryTemplate?.content?.querySelector?.("#observer-react-root[data-react-ssr='false']")],
            ["run-health-react-payload", primaryTemplate?.content?.querySelector?.("#run-health-react-root[data-react-ssr='false']")],
          ].forEach(([scriptId, node]) => {
            if (node instanceof HTMLElement) {
              payloadHrefs[scriptId] = node.getAttribute("data-react-payload-url") || "";
            }
          });
          return createSnapshotRecord({
            title: typeof payload?.title === "string" ? payload.title : "",
            documentLang: typeof payload?.documentLang === "string" ? payload.documentLang : "",
            documentClassName: typeof payload?.documentClassName === "string" ? payload.documentClassName : "",
            documentTheme: typeof payload?.documentTheme === "string" ? payload.documentTheme : "",
            bodyClassName: typeof payload?.bodyClassName === "string" ? payload.bodyClassName : "",
            bodyRoute: typeof payload?.bodyRoute === "string" ? payload.bodyRoute : "",
            bodyTheme: typeof payload?.bodyTheme === "string" ? payload.bodyTheme : "",
            headerTemplate,
            primaryTemplate,
            payloadTexts:
              payload?.payloadTexts && typeof payload.payloadTexts === "object" && !Array.isArray(payload.payloadTexts)
                ? payload.payloadTexts
                : {},
            payloadHrefs,
          });
        };
        const resolveRoutePayloadHref = (href) => {
          const url = new URL(href, window.location.href);
          if (url.pathname === "/observer") {
            url.searchParams.set("vc_payload", "observer");
            return url.toString();
          }
          if (url.pathname === "/run-health") {
            url.searchParams.set("vc_payload", "run-health");
            return url.toString();
          }
          return null;
        };
        const resolveDetailSnapshotHref = (href) => {
          const url = new URL(href, window.location.href);
          if (url.pathname !== "/projects") return null;
          url.searchParams.set("vc_detail", "projects");
          return url.toString();
        };
        const readRoutePrefetch = async (href, options = {}) => {
          const normalizedHref = new URL(href, window.location.href).toString();
          const requestKind = options.kind === "document" ? "document" : options.kind === "detail" ? "detail" : "navigation";
          const cacheKey = routePrefetchCacheKey(normalizedHref, requestKind);
          const cached = routePrefetchCache.get(cacheKey);
          if (cached?.status === "ready") {
            rememberRoutePrefetch(cacheKey, cached);
            return cached;
          }
          if (cached?.status === "pending") return cached.promise;
          const warmed = consumeWarmRoutePrefetch(cacheKey, normalizedHref, requestKind);
          if (warmed) return warmed;
          const warming = consumeWarmRoutePrefetchPromise(cacheKey, normalizedHref, requestKind);
          if (warming) return warming;

          const requestHref =
            requestKind === "detail"
              ? resolveDetailSnapshotHref(normalizedHref) || normalizedHref
              : normalizedHref;
          const expectsJson = requestKind === "navigation" || (requestKind === "detail" && requestHref !== normalizedHref);

          const request = fetch(requestHref, {
            headers: {
              Accept: expectsJson ? "application/json" : "text/html",
              "X-Visual-Console-Nav": "1",
            },
            credentials: "same-origin",
            cache: options.priority === "background" ? "force-cache" : "default",
          })
            .then(async (response) => {
              if (!response.ok) {
                routePrefetchCache.delete(cacheKey);
                throw new Error("prefetch-failed");
              }
              const contentType = response.headers.get("content-type") || "";
              const isJson = contentType.includes("application/json");
              const payload = isJson ? await response.json() : null;
              const snapshot =
                requestKind === "detail" && payload?.route === "projects-detail"
                  ? payload
                  : isJson
                    ? buildNavigationSnapshot(payload)
                    : buildRouteSnapshot(await response.text());
              const readyEntry = {
                status: "ready",
                href: normalizedHref,
                finalHref: requestKind === "detail" ? normalizedHref : response.url || normalizedHref,
                kind: requestKind,
                snapshot,
                fetchedAt: Date.now(),
              };
              rememberRoutePrefetch(cacheKey, readyEntry);
              return readyEntry;
            })
            .catch((error) => {
              routePrefetchCache.delete(cacheKey);
              throw error;
            });

          rememberRoutePrefetch(cacheKey, {
            status: "pending",
            href: normalizedHref,
            promise: request,
            fetchedAt: Date.now(),
          });
          return request;
        };
        const readRoutePayloadPrefetch = async (href, options = {}) => {
          const normalizedHref = new URL(href, window.location.href).toString();
          const cached = routePayloadCache.get(normalizedHref);
          if (cached?.status === "ready") {
            rememberRoutePayload(normalizedHref, cached);
            return cached;
          }
          if (cached?.status === "pending") return cached.promise;

          const request = fetch(normalizedHref, {
            headers: { Accept: "application/json" },
            credentials: "same-origin",
            cache: options.priority === "background" ? "force-cache" : "default",
          })
            .then(async (response) => {
              if (!response.ok) {
                routePayloadCache.delete(normalizedHref);
                throw new Error("payload-prefetch-failed");
              }
              const payload = await response.json();
              const readyEntry = {
                status: "ready",
                href: normalizedHref,
                payload,
                fetchedAt: Date.now(),
              };
              rememberRoutePayload(normalizedHref, readyEntry);
              return readyEntry;
            })
            .catch((error) => {
              routePayloadCache.delete(normalizedHref);
              throw error;
            });

          rememberRoutePayload(normalizedHref, {
            status: "pending",
            href: normalizedHref,
            promise: request,
            fetchedAt: Date.now(),
          });
          return request;
        };
        const prefetchLinkedPayload = (href, priority = "background") => {
          const scriptId = resolvePayloadScriptIdForHref(href);
          if (!scriptId) return;
          const navigationCacheKey = routePrefetchCacheKey(href, "navigation");
          const warmedNavigation = warmRoutePrefetchCache[navigationCacheKey];
          if (snapshotHasHydrationPayload(routePrefetchCache.get(navigationCacheKey)?.snapshot, scriptId)) return;
          if (snapshotHasHydrationPayload(warmedNavigation, scriptId)) return;

          const payloadHref = resolveRoutePayloadHref(href);
          if (!payloadHref) return;
          void readRoutePayloadPrefetch(payloadHref, { priority }).catch(() => {});
        };
        const primeClientOnlyPayloads = async (snapshot) => {
          if (!snapshot?.payloadHrefs || typeof snapshot.payloadHrefs !== "object") return snapshot;
          const pendingPayloads = Object.entries(snapshot.payloadHrefs).filter(([scriptId, href]) => {
            return Boolean(href) && !snapshot.payloadTexts?.[scriptId];
          });
          await Promise.all(
            pendingPayloads.map(async ([scriptId, href]) => {
              try {
                const payloadEntry = await readRoutePayloadPrefetch(href, { priority: "navigation" });
                snapshot.payloadTexts[scriptId] = JSON.stringify(payloadEntry.payload);
              } catch {}
            }),
          );
          return snapshot;
        };
        const normalizeProjectsDetailBaseHref = (href) => {
          try {
            const url = new URL(href, window.location.href);
            url.searchParams.delete("project");
            url.searchParams.delete("slug");
            url.searchParams.delete("source_view");
            url.searchParams.delete("theme");
            url.searchParams.delete("vc_detail");
            return url.toString();
          } catch {
            return "";
          }
        };
        const readProjectsDetailPayload = () => {
          const parsePayload = (candidate) => (
            candidate && typeof candidate === "object" && candidate.route === "projects-local-details" && Array.isArray(candidate.entries)
              ? candidate
              : null
          );
          const fromWindow = parsePayload(window.__PROJECTS_DETAIL_PAYLOAD__);
          if (fromWindow) return fromWindow;
          const payloadNode = document.getElementById("projects-detail-payload");
          if (!payloadNode?.textContent?.trim()) return null;
          try {
            const parsed = JSON.parse(payloadNode.textContent);
            const normalized = parsePayload(parsed);
            if (normalized) window.__PROJECTS_DETAIL_PAYLOAD__ = normalized;
            return normalized;
          } catch {
            return null;
          }
        };
        const resolveProjectsLocalDetailSnapshot = (href) => {
          const payload = readProjectsDetailPayload();
          if (!payload) return null;
          const normalizedBaseHref = normalizeProjectsDetailBaseHref(href);
          if (!normalizedBaseHref || normalizeProjectsDetailBaseHref(payload.baseHref) !== normalizedBaseHref) return null;
          const targetUrl = new URL(href, window.location.href);
          const projectName = decodeURIComponent(targetUrl.searchParams.get("project") || "").trim().toLowerCase();
          if (!projectName) {
            return {
              route: "projects-detail",
              selectedProjectName: null,
              hasDetail: false,
              detailHtml: "",
            };
          }
          const matchedEntry = payload.entries.find((entry) => String(entry.projectName || "").trim().toLowerCase() === projectName);
          if (!matchedEntry) return null;
          return {
            route: "projects-detail",
            selectedProjectName: matchedEntry.projectName,
            hasDetail: true,
            detailHtml: matchedEntry.detailHtml || "",
          };
        };
        const hasLocalProjectsDetailForHref = (href) => Boolean(resolveProjectsLocalDetailSnapshot(href));
        const collectPrimaryRouteHrefs = (root = document) => {
          const nav = root.querySelector("[data-nav-primary='true']");
          if (!(nav instanceof HTMLElement)) return [];
          return Array.from(nav.querySelectorAll("a[href]"))
            .filter((link) => link instanceof HTMLAnchorElement && isInternalVisualRoute(link.href))
            .map((link) => new URL(link.href, window.location.href).toString())
            .filter((href, index, items) => items.indexOf(href) === index);
        };
        const isCriticalRouteHref = (href) => {
          try {
            const url = new URL(href, window.location.href);
            return (
              url.pathname === "/overview" ||
              url.pathname === "/projects" ||
              url.pathname === "/run-health" ||
              url.pathname === "/observer"
            );
          } catch {
            return false;
          }
        };
        const warmCriticalRoutes = () => {
          collectPrimaryRouteHrefs()
            .filter((href) => isCriticalRouteHref(href))
            .forEach((href) => {
              void readRoutePrefetch(href, { priority: "interactive", kind: "navigation" }).catch(() => {});
              prefetchLinkedPayload(href, "interactive");
            });
        };
        const schedulePrimaryRoutePrefetch = () => {
          cancelIdleTask(routePrefetchIdleHandle);
          routePrefetchIdleHandle = scheduleIdleTask(() => {
            routePrefetchIdleHandle = null;
            collectPrimaryRouteHrefs().forEach((href) => {
              void readRoutePrefetch(href, { priority: "background", kind: "navigation" }).catch(() => {});
              prefetchLinkedPayload(href, "background");
            });
          }, 240);
        };
        const collectProjectDetailLinks = (root = document, limit = 6) => {
          const links = [];
          const seen = new Set();
          const cards = Array.from(root.querySelectorAll("[data-project-card='true']")).filter((card) => card instanceof HTMLElement && !card.hidden);
          for (const card of cards) {
            const link = card.querySelector("[data-project-card-link='true']");
            if (!(link instanceof HTMLAnchorElement)) continue;
            if (!isInternalVisualRoute(link.href) || !shouldUseDetailSwap(link) || hasLocalProjectsDetailForHref(link.href) || seen.has(link.href)) continue;
            seen.add(link.href);
            links.push(link.href);
            if (links.length >= limit) break;
          }
          return links;
        };
        const scheduleProjectDetailPrefetch = () => {
          cancelIdleTask(projectDetailPrefetchIdleHandle);
          projectDetailPrefetchIdleHandle = scheduleIdleTask(() => {
            projectDetailPrefetchIdleHandle = null;
            collectProjectDetailLinks().forEach((href) => {
              void readRoutePrefetch(href, { priority: "background", kind: "detail" }).catch(() => {});
            });
          }, 180);
        };
        const scheduleReactRemount = () => {
          cancelIdleTask(reactRemountIdleHandle);
          reactRemountIdleHandle = scheduleIdleTask(() => {
            reactRemountIdleHandle = null;
            remountReactApps();
          }, 120);
        };
        const syncPreferenceState = () => {
          const root = document.querySelector("[data-preference-card='true']");
          const textarea = root?.querySelector("[data-preference-textarea='true']");
          const clearing = root?.querySelector("[data-preference-clearing='true']");
          if (!(textarea instanceof HTMLTextAreaElement) || !(clearing instanceof HTMLElement)) return;
          clearing.classList.toggle("is-visible", textarea.value.trim().length === 0);
        };
        const setEditing = (value) => {
          const root = document.querySelector("[data-preference-card='true']");
          const textarea = root?.querySelector("[data-preference-textarea='true']");
          if (!(root instanceof HTMLElement)) return;
          root.classList.toggle("is-editing", value);
          if (value && textarea instanceof HTMLTextAreaElement) {
            requestAnimationFrame(() => {
              textarea.focus();
              textarea.selectionStart = textarea.value.length;
              textarea.selectionEnd = textarea.value.length;
            });
          } else {
            document.querySelector("[data-preference-edit-toggle='true']")?.focus();
          }
        };
        const closeAccountSettingsPopover = (target) => {
          document.querySelectorAll("[data-account-settings-shell='true'][open]").forEach((node) => {
            if (!(node instanceof HTMLDetailsElement)) return;
            if (target instanceof Node && node.contains(target)) return;
            node.open = false;
          });
        };
        const scheduleAutoHideNavUpdate = () => {
          if (autoHideNavTicking) return;
          autoHideNavTicking = true;
          requestAnimationFrame(() => {
            const shell = autoHideNavShell instanceof HTMLElement
              ? autoHideNavShell
              : document.querySelector("[data-nav-shell='auto-hide']");
            if (!(shell instanceof HTMLElement)) {
              autoHideNavShell = null;
              autoHideNavLastY = window.scrollY;
              autoHideNavTicking = false;
              return;
            }

            autoHideNavShell = shell;
            const currentY = window.scrollY;
            const delta = currentY - autoHideNavLastY;
            if (currentY <= 24) {
              shell.classList.remove("is-nav-hidden");
            } else if (delta > 8) {
              shell.classList.add("is-nav-hidden");
            } else if (delta < -8) {
              shell.classList.remove("is-nav-hidden");
            }
            autoHideNavLastY = currentY;
            autoHideNavTicking = false;
          });
        };
        const bindAutoHideNav = () => {
          autoHideNavShell = document.querySelector("[data-nav-shell='auto-hide']");
          autoHideNavLastY = window.scrollY;
          scheduleAutoHideNavUpdate();
          if (autoHideNavListenerBound) return;
          autoHideNavListenerBound = true;
          window.addEventListener("scroll", scheduleAutoHideNavUpdate, { passive: true });
        };
        const setMobileNavHidden = (hidden) => {
          if (isDesktopViewport()) return;
          const shell = autoHideNavShell instanceof HTMLElement
            ? autoHideNavShell
            : document.querySelector("[data-nav-shell='auto-hide']");
          if (!(shell instanceof HTMLElement)) return;
          autoHideNavShell = shell;
          shell.classList.toggle("is-nav-hidden", hidden);
          if (!hidden) {
            autoHideNavLastY = window.scrollY;
          }
        };
        const syncSegmentedControl = (control) => {
          if (!(control instanceof HTMLElement)) return;
          const active = control.querySelector(".is-active[data-segmented-option='true']");
          const background = control.querySelector("[data-segmented-active='true']");
          if (!(active instanceof HTMLElement) || !(background instanceof HTMLElement)) return;

          const activeRect = active.getBoundingClientRect();
          const controlRect = control.getBoundingClientRect();
          background.style.opacity = "1";
          background.style.width = activeRect.width + "px";
          background.style.transform = "translate3d(" + (activeRect.left - controlRect.left) + "px, 2px, 0)";
        };
        const syncPremiumNavState = () => {
          const nav = document.querySelector("[data-nav-primary='true']");
          const tracker = nav?.querySelector("[data-nav-tracker='true']");
          if (nav instanceof HTMLElement && tracker instanceof HTMLElement) {
            const activeLink = nav.querySelector(".nav-link.is-active");
            if (activeLink instanceof HTMLElement && window.innerWidth >= 768) {
              const linkRect = activeLink.getBoundingClientRect();
              const navRect = nav.getBoundingClientRect();
              tracker.style.opacity = "1";
              tracker.style.width = linkRect.width + "px";
              tracker.style.height = linkRect.height + "px";
              tracker.style.transform = "translate3d(" + (linkRect.left - navRect.left) + "px, " + (linkRect.top - navRect.top) + "px, 0)";
            } else {
              tracker.style.opacity = "0";
            }
          }

          document.querySelectorAll("[data-segmented-control]").forEach((control) => {
            syncSegmentedControl(control);
          });
        };
        const bindPremiumNav = () => {
          const nav = document.querySelector("[data-nav-primary='true']");
          const tracker = nav?.querySelector("[data-nav-tracker='true']");

          if (nav instanceof HTMLElement && tracker instanceof HTMLElement && nav.dataset.premiumNavBound !== "true") {
            nav.dataset.premiumNavBound = "true";
            const links = Array.from(nav.querySelectorAll(".nav-link")).filter((link) => link instanceof HTMLAnchorElement);
            const moveTrackerTo = (link) => {
              if (!(link instanceof HTMLElement) || window.innerWidth < 768) {
                tracker.style.opacity = "0";
                return;
              }

              const linkRect = link.getBoundingClientRect();
              const navRect = nav.getBoundingClientRect();
              tracker.style.opacity = "1";
              tracker.style.width = linkRect.width + "px";
              tracker.style.height = linkRect.height + "px";
              tracker.style.transform = "translate3d(" + (linkRect.left - navRect.left) + "px, " + (linkRect.top - navRect.top) + "px, 0)";
            };

            links.forEach((link) => {
              link.addEventListener("mouseenter", () => moveTrackerTo(link));
              link.addEventListener("focus", () => moveTrackerTo(link));
              link.addEventListener("click", () => {
                links.forEach((item) => item.classList.remove("is-active"));
                link.classList.add("is-active");
                moveTrackerTo(link);
              });
            });

            nav.addEventListener("mouseleave", () => {
              moveTrackerTo(nav.querySelector(".nav-link.is-active"));
            });
          }

          document.querySelectorAll("[data-segmented-control]").forEach((control) => {
            if (!(control instanceof HTMLElement) || control.dataset.segmentedBound === "true") return;
            control.dataset.segmentedBound = "true";
            const options = Array.from(control.querySelectorAll("[data-segmented-option='true']")).filter((option) => option instanceof HTMLAnchorElement);

            options.forEach((option) => {
              option.addEventListener("focus", () => syncSegmentedControl(control));
              option.addEventListener("click", () => {
                options.forEach((item) => item.classList.remove("is-active"));
                option.classList.add("is-active");
                syncSegmentedControl(control);
              });
            });
          });

          syncPremiumNavState();
          if (premiumNavResizeBound) return;
          premiumNavResizeBound = true;
          window.addEventListener("resize", syncPremiumNavState, { passive: true });
        };
        const bindTopProjectCarousel = () => {
          if (document.querySelector("[data-react-overview='true']")) return;
          const root = document.querySelector("[data-top-project-carousel='true']");
          if (!(root instanceof HTMLElement) || root.dataset.carouselBound === "true") return;

          const slides = Array.from(root.querySelectorAll("[data-carousel-slide]")).filter((slide) => slide instanceof HTMLElement);
          const dots = Array.from(root.querySelectorAll("[data-carousel-dot]")).filter((dot) => dot instanceof HTMLElement);
          if (slides.length === 0) return;

          root.dataset.carouselBound = "true";
          const prev = root.querySelector("[data-carousel-arrow='prev']");
          const next = root.querySelector("[data-carousel-arrow='next']");
          let activeIndex = Number.parseInt(root.getAttribute("data-carousel-index") || "0", 10);
          let dragPointerId = null;
          let dragStartX = null;
          if (!Number.isFinite(activeIndex)) activeIndex = 0;

          const apply = (index) => {
            activeIndex = (index + slides.length) % slides.length;
            root.setAttribute("data-carousel-index", String(activeIndex));
            slides.forEach((slide, position) => {
              slide.setAttribute("data-slide-active", position === activeIndex ? "true" : "false");
            });
            dots.forEach((dot, position) => {
              dot.classList.toggle("is-active", position === activeIndex);
            });
          };
          const clearDrag = (pointerId = dragPointerId) => {
            if (dragPointerId !== pointerId) return;
            dragPointerId = null;
            dragStartX = null;
            root.classList.remove("is-dragging");
          };

          prev?.addEventListener("click", (event) => {
            event.preventDefault();
            apply(activeIndex - 1);
          });
          next?.addEventListener("click", (event) => {
            event.preventDefault();
            apply(activeIndex + 1);
          });
          dots.forEach((dot, index) => {
            dot.addEventListener("click", () => {
              apply(index);
            });
          });
          root.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || event.isPrimary === false) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest("button, input, textarea, select, label")) return;
            dragPointerId = event.pointerId;
            dragStartX = event.clientX;
            root.classList.add("is-dragging");
          });
          root.addEventListener("pointerup", (event) => {
            if (dragPointerId !== event.pointerId || dragStartX === null) return;
            const deltaX = event.clientX - dragStartX;
            clearDrag(event.pointerId);
            if (Math.abs(deltaX) < 48) return;
            apply(activeIndex + (deltaX < 0 ? 1 : -1));
          });
          root.addEventListener("pointercancel", (event) => {
            clearDrag(event.pointerId);
          });
          root.addEventListener("pointerleave", (event) => {
            if (!(event instanceof PointerEvent)) return;
            clearDrag(event.pointerId);
          });

          apply(activeIndex);
        };
        const bindOverviewWorkspaceRail = () => {
          if (document.querySelector("[data-react-overview='true']")) return;
          const root = document.querySelector("[data-workspace-rail='overview']");
          if (!(root instanceof HTMLElement) || root.dataset.workspaceRailBound === "true") return;

          root.dataset.workspaceRailBound = "true";
          const chips = Array.from(root.querySelectorAll("[data-workspace-chip]")).filter((chip) => chip instanceof HTMLElement);
          const panels = new Map(
            workspaceSections.map((name) => [name, document.querySelector("[data-workspace-panel='" + name + "']")]),
          );
          const prev = root.querySelector("[data-workspace-arrow='prev']");
          const next = root.querySelector("[data-workspace-arrow='next']");
          let activeIndex = 0;
          let dragPointerId = null;
          let dragStartX = null;

          const readSection = () => {
            const urlSection = new URL(window.location.href).searchParams.get("section");
            if (workspaceSections.includes(urlSection)) return urlSection;
            const attrSection = root.getAttribute("data-workspace-section");
            if (workspaceSections.includes(attrSection)) return attrSection;
            return "decisions";
          };
          const syncUrl = (section) => {
            const url = new URL(window.location.href);
            url.searchParams.set("section", section);
            history.replaceState(window.history.state ?? {}, "", url.toString());
          };
          const apply = (index, options = { syncUrl: true }) => {
            activeIndex = ((index % workspaceRailSections.length) + workspaceRailSections.length) % workspaceRailSections.length;
            const activeSection = workspaceRailSections[activeIndex];
            root.setAttribute("data-workspace-section", activeSection);
            panels.forEach((panel, name) => {
              if (panel instanceof HTMLElement) {
                panel.setAttribute("data-panel-active", name === activeSection ? "true" : "false");
              }
            });
            chips.forEach((chip) => {
              chip.classList.toggle("is-active", chip.getAttribute("data-workspace-chip") === activeSection);
            });
            if (options.syncUrl) syncUrl(activeSection);
          };
          const clearDrag = (pointerId = dragPointerId) => {
            if (dragPointerId !== pointerId) return;
            dragPointerId = null;
            dragStartX = null;
          };

          prev?.addEventListener("click", (event) => {
            event.preventDefault();
            apply(activeIndex - 1);
          });
          next?.addEventListener("click", (event) => {
            event.preventDefault();
            apply(activeIndex + 1);
          });

          root.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || event.isPrimary === false) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest("a, button, input, textarea, select, label")) return;
            dragPointerId = event.pointerId;
            dragStartX = event.clientX;
          });
          root.addEventListener("pointerup", (event) => {
            if (dragPointerId !== event.pointerId || dragStartX === null) return;
            const deltaX = event.clientX - dragStartX;
            clearDrag(event.pointerId);
            if (Math.abs(deltaX) < 48) return;
            apply(activeIndex + (deltaX < 0 ? 1 : -1));
          });
          root.addEventListener("pointercancel", (event) => {
            clearDrag(event.pointerId);
          });

          const initialSection = readSection();
          const initialIndex = workspaceRailSections.indexOf(initialSection);
          apply(initialIndex >= 0 ? initialIndex : 0);
        };
        const bindGlobalSideAssistant = () => {
          if (document.querySelector("[data-projects-workbench='true']")) return;
          const assistantHost = document.querySelector("[data-projects-ai-assistant-host='true']");
          const assistantLauncher = document.querySelector("[data-projects-ai-launch='true']");
          const assistantPanel = document.querySelector("[data-projects-ai-panel='true']");
          const assistantClose = document.querySelector("[data-projects-ai-close='true']");
          const assistantNewChat = document.querySelector("[data-projects-ai-new-chat='true']");
          const assistantForm = document.querySelector("[data-projects-ai-form='true']");
          const assistantInput = document.querySelector("[data-projects-ai-input='true']");
          const assistantSubmit = document.querySelector("[data-projects-ai-submit='true']");
          const assistantMessages = document.querySelector("[data-projects-ai-messages='true']");
          const assistantStatus = document.querySelector("[data-projects-ai-status='true']");
          if (!(assistantHost instanceof HTMLElement) || assistantHost.dataset.projectsAiBound === "true") return;
          assistantHost.dataset.projectsAiBound = "true";
          let assistantSession = readSideAssistantSession();
          let assistantPending = false;
          let assistantAbortController = null;
          const currentProjectsLang = () => (document.documentElement.lang || document.body?.getAttribute("data-lang") || "").toLowerCase().startsWith("en") ? "en" : "zh";
          const currentProjectsDate = () => new URL(window.location.href).searchParams.get("date") || "latest";
          const buildProjectsScope = () =>
            buildSideAssistantScopeKey({
              path: "/projects",
              date: currentProjectsDate(),
              lang: currentProjectsLang(),
              sort: "score",
              paradigm: "all",
              persistence: "all",
            });
          const buildAssistantProjectHref = (projectId) => {
            const normalizedProjectId = String(projectId || "").trim();
            if (!normalizedProjectId) return "";
            const target = new URL(window.location.href);
            target.pathname = "/projects";
            target.searchParams.set("lang", currentProjectsLang());
            target.searchParams.set("date", currentProjectsDate());
            target.searchParams.set("project", normalizedProjectId);
            target.searchParams.set("source_view", "projects");
            if (!target.searchParams.get("theme")) target.searchParams.set("theme", "light");
            return target.toString();
          };
          const navigateToProjectsResults = (query, projectIds) => {
            assistantSession.active_main_result = {
              query: query || assistantSession.search_context?.last_user_query || "AI 搜项目",
              project_ids: Array.isArray(projectIds) ? projectIds.map((item) => String(item || "")).filter(Boolean) : [],
              scope_key: buildProjectsScope(),
            };
            writeSideAssistantSession(assistantSession);
            const target = new URL(window.location.href);
            target.pathname = "/projects";
            target.searchParams.set("lang", currentProjectsLang());
            target.searchParams.set("date", currentProjectsDate());
            target.searchParams.delete("project");
            target.searchParams.delete("slug");
            target.searchParams.delete("source_view");
            if (typeof fetchAndApply === "function") {
              void fetchAndApply(target.toString(), "route", "push");
            } else {
              window.location.assign(target.toString());
            }
          };
          const projectLinkMap = () => new Map();
          const setAssistantStatus = (text) => {
            if (!(assistantStatus instanceof HTMLElement)) return;
            assistantStatus.hidden = !text;
            assistantStatus.textContent = text || "";
          };
          const renderAssistantMessageNode = (message) => {
            const wrapper = document.createElement("article");
            wrapper.className = "surface-card projects-ai-message " + (message.role === "user" ? "is-user" : "is-assistant");
            const label = document.createElement("div");
            label.className = "context-label";
            label.textContent = message.role === "user" ? "你" : "AI 搜项目";
            const text = document.createElement("p");
            text.className = "projects-ai-message-copy";
            text.textContent = message.text;
            wrapper.append(label, text);
            if (message.role === "assistant") {
              const linkMap = projectLinkMap();
              const previewIds = Array.isArray(message.preview_project_ids) ? message.preview_project_ids : [];
              if (previewIds.length > 0) {
                const previewList = document.createElement("div");
                previewList.className = "projects-ai-preview-list";
                previewIds.forEach((projectId) => {
                  const matched = linkMap.get(String(projectId || "").trim().toLowerCase());
                  const link = document.createElement("a");
                  link.href = matched?.href || buildAssistantProjectHref(projectId);
                  link.textContent = matched?.label || projectId;
                  link.className = "inline-link projects-ai-project-link";
                  link.dataset.projectsAiProjectLink = "true";
                  link.dataset.projectsAiProjectId = projectId;
                  const arrow = document.createElement("span");
                  arrow.className = "projects-ai-project-link-arrow";
                  arrow.textContent = "›";
                  arrow.setAttribute("aria-hidden", "true");
                  link.appendChild(arrow);
                  previewList.appendChild(link);
                });
                if (previewList.childElementCount > 0) wrapper.appendChild(previewList);
              }
              const options = Array.isArray(message.clarification_options) ? message.clarification_options : [];
              if (options.length > 0) {
                const optionRow = document.createElement("div");
                optionRow.className = "filter-chip-row projects-ai-option-row";
                options.forEach((option) => {
                  const button = document.createElement("button");
                  button.type = "button";
                  button.className = "filter-chip";
                  button.dataset.projectsAiOptionQuery = option.query || "";
                  button.textContent = option.label_cn || option.query || "";
                  optionRow.appendChild(button);
                });
                wrapper.appendChild(optionRow);
              }
              if (message.can_view_all === true && Array.isArray(message.project_ids) && message.project_ids.length > 0) {
                const actionRow = document.createElement("div");
                actionRow.className = "projects-ai-action-row";
                const button = document.createElement("button");
                button.type = "button";
                button.className = "button-link-secondary projects-ai-view-all";
                button.dataset.projectsAiViewAll = "true";
                button.dataset.projectsAiViewAllQuery = message.query || "";
                button.dataset.projectsAiProjectIds = JSON.stringify(message.project_ids);
                button.textContent = "查看全部结果";
                actionRow.appendChild(button);
                wrapper.appendChild(actionRow);
              }
            }
            return wrapper;
          };
          const renderAssistantPanel = () => {
            assistantSession = readSideAssistantSession();
            document.body?.classList.toggle("projects-ai-open", assistantSession.panel_open === true);
            assistantHost.style.pointerEvents = "none";
            if (assistantLauncher instanceof HTMLElement) {
              assistantLauncher.hidden = assistantSession.panel_open === true;
              assistantLauncher.style.pointerEvents = "auto";
            }
            const assistantQuickstart = assistantPanel?.querySelector("[data-projects-ai-quickstart='true']");
            const assistantQuickstartToggleRow = assistantPanel?.querySelector("[data-projects-ai-quickstart-toggle-row='true']");
            if (assistantPanel instanceof HTMLElement) {
              assistantPanel.hidden = assistantSession.panel_open !== true;
              assistantPanel.style.pointerEvents = "auto";
              assistantPanel.classList.toggle("is-compact", assistantSession.quickstart_collapsed === true);
            }
            if (assistantQuickstart instanceof HTMLElement) {
              assistantQuickstart.hidden = assistantSession.quickstart_collapsed === true;
            }
            if (assistantQuickstartToggleRow instanceof HTMLElement) {
              assistantQuickstartToggleRow.hidden = assistantSession.quickstart_collapsed !== true;
            }
            if (assistantMessages instanceof HTMLElement) {
              assistantMessages.innerHTML = "";
              if (assistantSession.messages.length === 0) {
                const intro = document.createElement("article");
                intro.className = "surface-card projects-ai-message projects-ai-empty-state";
                intro.textContent = "描述你想找的项目方向，我会返回简短说明、最多 3 个项目链接，并可切换到项目库承接全部结果。";
                assistantMessages.appendChild(intro);
              } else {
                assistantSession.messages.forEach((message) => {
                  assistantMessages.appendChild(renderAssistantMessageNode(message));
                });
              }
              assistantMessages.scrollTop = assistantMessages.scrollHeight;
            }
            if (assistantInput instanceof HTMLInputElement && assistantSession.panel_open === true && !assistantPending && !assistantInput.value.trim()) {
              assistantInput.focus({ preventScroll: true });
            }
            setAssistantStatus(assistantPending ? "正在搜索站内项目库…" : "");
          };
          const openAssistantPanel = () => {
            if (Number(assistantHost?.dataset.projectsAiSuppressClickUntil || "0") > Date.now()) return;
            assistantSession.panel_open = true;
            writeSideAssistantSession(assistantSession);
            renderAssistantPanel();
            applySideAssistantPlacement(assistantHost);
          };
          const closeAssistantPanel = () => {
            assistantSession.panel_open = false;
            writeSideAssistantSession(assistantSession);
            renderAssistantPanel();
          };
          const buildAssistantMessage = (response, previewIds, isMoreMode) => {
            if (response.source === "regulated_keyword_search") return response.boundary_message_cn || response.explanation_cn || "仅按站内 AI Agent 项目检索，不提供真实专业建议。";
            if (response.source === "needs_clarification") return response.explanation_cn || "需要更具体一点，我给你几个可直接点的改写。";
            if (response.source === "llm_failed_fallback") return response.explanation_cn || "扩展搜索暂不可用，先按站内热门项目给你结果。";
            if (previewIds.length === 0 && isMoreMode) return "没有更多未展示项目了，可以换个补充条件继续找。";
            if (previewIds.length === 0) return response.explanation_cn || "这轮没有匹配到可展示的项目。";
            return response.explanation_cn || ("找到 " + String(response.project_ids.length) + " 个相关项目，先给你看最值得点开的几条。");
          };
          const submitAssistantQuery = async (rawQuery) => {
            const trimmed = String(rawQuery || "").trim();
            if (!trimmed || !(assistantInput instanceof HTMLInputElement) || assistantPending) return;
            assistantSession.quickstart_collapsed = true;
            const isMoreMode = isSideAssistantMoreQuery(trimmed);
            const composedQuery = composeSideAssistantQuery(assistantSession.search_context, trimmed);
            if (!composedQuery) {
              assistantSession.messages.push({ role: "assistant", text: "先描述一个更具体的项目方向，我再帮你搜。" });
              writeSideAssistantSession(assistantSession);
              renderAssistantPanel();
              return;
            }
            if (!queryMeetsFuzzyTriggerThreshold(composedQuery)) {
              assistantSession.quickstart_collapsed = true;
              assistantSession.messages.push(
                { role: "user", text: trimmed, query: trimmed },
                { role: "assistant", text: "描述再具体一点，比如公司、任务、方向词或想看的场景。" },
              );
              writeSideAssistantSession(assistantSession);
              renderAssistantPanel();
              return;
            }
            if (assistantAbortController) assistantAbortController.abort();
            assistantAbortController = new AbortController();
            assistantPending = true;
            assistantSession.panel_open = true;
            assistantSession.quickstart_collapsed = true;
            assistantSession.messages.push({ role: "user", text: trimmed, query: trimmed });
            writeSideAssistantSession(assistantSession);
            renderAssistantPanel();
            assistantInput.value = "";
            try {
              const response = await fetch("/api/projects/fuzzy-search", {
                method: "POST",
                headers: { "content-type": "application/json" },
                cache: "no-store",
                signal: assistantAbortController.signal,
                body: JSON.stringify({
                  raw_query: composedQuery,
                  date: currentProjectsDate(),
                  lang: currentProjectsLang(),
                  filters: { paradigm: "all", persistence: "all" },
                  sort: "score",
                  page_context: { page: 1, page_size: 15, path: "/projects" },
                }),
              });
              if (!response.ok) throw new Error("fuzzy-search-failed");
              const payload = await response.json();
              const projectIds = Array.isArray(payload?.project_ids) ? payload.project_ids.map((item) => String(item || "")).filter(Boolean) : [];
              const previousSeen = isMoreMode ? assistantSession.search_context?.seen_project_ids || [] : [];
              const previewIds = pickSideAssistantPreviewIds(projectIds, previousSeen, 3);
              assistantSession.search_context = {
                composed_query: composedQuery,
                last_user_query: trimmed,
                seen_project_ids: isMoreMode ? Array.from(new Set(previousSeen.concat(previewIds))) : previewIds.slice(),
                last_project_ids: projectIds,
              };
              assistantSession.messages.push({
                role: "assistant",
                text: buildAssistantMessage(payload, previewIds, isMoreMode),
                query: trimmed,
                source: payload?.source || "",
                project_ids: projectIds,
                preview_project_ids: previewIds,
                clarification_options:
                  payload?.source === "needs_clarification" && Array.isArray(payload?.clarification_options)
                    ? payload.clarification_options.map((option) => ({ label_cn: option.label_cn || option.query || "", query: option.query || "" }))
                    : [],
                can_view_all: projectIds.length > 0,
              });
            } catch (error) {
              if (error && error.name === "AbortError") return;
              assistantSession.messages.push({
                role: "assistant",
                text: "这次搜索没有成功，但我保留了上下文，你可以直接换个说法继续问。",
                query: trimmed,
              });
            } finally {
              assistantPending = false;
              assistantAbortController = null;
              writeSideAssistantSession(assistantSession);
              renderAssistantPanel();
            }
          };
          const triggerAssistantSubmit = (event) => {
            event?.preventDefault?.();
            if (!(assistantInput instanceof HTMLInputElement) || assistantPending) return;
            void submitAssistantQuery(assistantInput.value);
          };
          assistantLauncher instanceof HTMLButtonElement && assistantLauncher.addEventListener("click", openAssistantPanel);
          assistantClose instanceof HTMLButtonElement && assistantClose.addEventListener("click", closeAssistantPanel);
          assistantNewChat instanceof HTMLButtonElement &&
            assistantNewChat.addEventListener("click", () => {
              assistantSession = resetSideAssistantConversation(assistantSession, true);
              if (assistantInput instanceof HTMLInputElement) assistantInput.value = "";
              writeSideAssistantSession(assistantSession);
              renderAssistantPanel();
            });
          assistantSubmit instanceof HTMLButtonElement && assistantSubmit.addEventListener("click", triggerAssistantSubmit);
          assistantForm instanceof HTMLFormElement && assistantForm.addEventListener("submit", triggerAssistantSubmit);
          assistantInput instanceof HTMLInputElement &&
            assistantInput.addEventListener("input", () => {
              if (assistantSession.quickstart_collapsed === true) return;
              if (!assistantInput.value.trim()) return;
              assistantSession.quickstart_collapsed = true;
              writeSideAssistantSession(assistantSession);
              renderAssistantPanel();
            });
          assistantInput instanceof HTMLInputElement &&
            assistantInput.addEventListener("keydown", (event) => {
              if (event.key !== "Enter" || event.isComposing) return;
              triggerAssistantSubmit(event);
            });
          assistantPanel instanceof HTMLElement &&
            assistantPanel.addEventListener("click", (event) => {
              const target = event.target;
              if (!(target instanceof Element)) return;
              const option = target.closest("[data-projects-ai-option-query]");
              if (option instanceof HTMLElement) {
                const nextValue = option.dataset.projectsAiOptionQuery || "";
                if (!nextValue) return;
                if (assistantInput instanceof HTMLInputElement) assistantInput.value = nextValue;
                void submitAssistantQuery(nextValue);
                return;
              }
              const viewAll = target.closest("[data-projects-ai-view-all='true']");
              if (viewAll instanceof HTMLElement) {
                let projectIds = [];
                try {
                  projectIds = JSON.parse(viewAll.dataset.projectsAiProjectIds || "[]");
                } catch {
                  projectIds = [];
                }
                navigateToProjectsResults(viewAll.dataset.projectsAiViewAllQuery || assistantSession.search_context?.last_user_query || "AI 搜项目", projectIds);
              }
            });
          bindSideAssistantPlacement({ assistantHost, assistantLauncher, assistantPanel });
          renderAssistantPanel();
        };
        const bindProjectsWorkbench = () => {
          const root = document.querySelector("[data-projects-workbench='true']");
          if (!(root instanceof HTMLElement)) return;
          if (root.dataset.projectsWorkbenchBound === "true" && typeof root.__projectsWorkbenchApply === "function") {
            root.__projectsWorkbenchApply?.();
            return;
          }
          delete root.dataset.projectsWorkbenchBound;

          root.dataset.projectsWorkbenchBound = "true";
          const search = root.querySelector("[data-projects-search='true']");
          const searchRotator = root.querySelector("[data-projects-search-rotator='true']");
          const searchExamples = Array.from(root.querySelectorAll("[data-projects-search-example]")).filter((node) => node instanceof HTMLButtonElement);
          const presetOptions = Array.from(document.querySelectorAll("[data-projects-preset-option]")).filter((option) => option instanceof HTMLButtonElement);
          const sortOptions = Array.from(root.querySelectorAll("[data-projects-sort-option]")).filter((option) => option instanceof HTMLButtonElement);
          const sortDropdown = root.querySelector("[data-projects-sort-dropdown='true']");
          const sortToggle = root.querySelector("[data-projects-sort-toggle='true']");
          const sortMenu = root.querySelector("[data-projects-sort-menu='true']");
          const sortCurrent = root.querySelector("[data-projects-sort-current='true']");
          const sortDropdownOptions = Array.from(root.querySelectorAll("[data-projects-sort-value]")).filter((option) => option instanceof HTMLButtonElement);
          const paradigmOptions = Array.from(root.querySelectorAll("[data-projects-paradigm-option]")).filter((option) => option instanceof HTMLButtonElement);
          const persistenceOptions = Array.from(root.querySelectorAll("[data-projects-persistence-option]")).filter((option) => option instanceof HTMLButtonElement);
          const previousPageButtons = Array.from(document.querySelectorAll("[data-projects-page-prev='true']")).filter((node) => node instanceof HTMLButtonElement);
          const nextPageButtons = Array.from(document.querySelectorAll("[data-projects-page-next='true']")).filter((node) => node instanceof HTMLButtonElement);
          const pageStatusNodes = Array.from(document.querySelectorAll("[data-projects-page-status='true']")).filter((node) => node instanceof HTMLElement);
          const pageSummaryNodes = Array.from(document.querySelectorAll("[data-projects-page-summary='true']")).filter((node) => node instanceof HTMLElement);
          const assistantHost = document.querySelector("[data-projects-ai-assistant-host='true']");
          const assistantLauncher = document.querySelector("[data-projects-ai-launch='true']");
          const assistantPanel = document.querySelector("[data-projects-ai-panel='true']");
          const assistantClose = document.querySelector("[data-projects-ai-close='true']");
          const assistantNewChat = document.querySelector("[data-projects-ai-new-chat='true']");
          const assistantForm = document.querySelector("[data-projects-ai-form='true']");
          const assistantInput = document.querySelector("[data-projects-ai-input='true']");
          const assistantSubmit = document.querySelector("[data-projects-ai-submit='true']");
          const assistantMessages = document.querySelector("[data-projects-ai-messages='true']");
          const assistantStatus = document.querySelector("[data-projects-ai-status='true']");
          const assistantEmptyCta = document.querySelector("[data-projects-ai-empty-cta='true']");
          const assistantMainResult = document.querySelector("[data-projects-ai-main-result='true']");
          const assistantMainResultQuery = document.querySelector("[data-projects-ai-main-result-query='true']");
          const assistantReset = document.querySelector("[data-projects-ai-reset='true']");

          if (!(search instanceof HTMLInputElement)) return;

          const rotatorTerms =
            searchRotator instanceof HTMLElement
              ? (() => {
                  try {
                    const parsed = JSON.parse(searchRotator.dataset.projectsSearchTerms || "[]");
                    return Array.isArray(parsed) ? parsed.map((term) => String(term || "").trim()).filter(Boolean) : [];
                  } catch {
                    return [];
                  }
                })()
              : [];
          let rotatorIndex = 0;
          const assistantSessionStorageKey = "visual-console-side-assistant-search";
          const emptyAssistantSession = () => ({
            panel_open: false,
            messages: [],
            search_context: null,
            active_main_result: null,
          });
          const normalizeAssistantSession = (value) => {
            if (!value || typeof value !== "object") return emptyAssistantSession();
            return {
              panel_open: value.panel_open === true,
              messages: Array.isArray(value.messages)
                ? value.messages
                    .filter((message) => message && typeof message === "object")
                    .map((message) => ({
                      role: message.role === "user" ? "user" : "assistant",
                      text: typeof message.text === "string" ? message.text : "",
                      query: typeof message.query === "string" ? message.query : "",
                      source: typeof message.source === "string" ? message.source : "",
                      project_ids: Array.isArray(message.project_ids) ? message.project_ids.map((item) => String(item || "")).filter(Boolean) : [],
                      preview_project_ids: Array.isArray(message.preview_project_ids) ? message.preview_project_ids.map((item) => String(item || "")).filter(Boolean) : [],
                      clarification_options: Array.isArray(message.clarification_options)
                        ? message.clarification_options
                            .filter((option) => option && typeof option === "object")
                            .map((option) => ({
                              label_cn: typeof option.label_cn === "string" ? option.label_cn : "",
                              query: typeof option.query === "string" ? option.query : "",
                            }))
                            .filter((option) => option.label_cn || option.query)
                        : [],
                      can_view_all: message.can_view_all === true,
                    }))
                    .filter((message) => message.text)
                : [],
              search_context:
                value.search_context && typeof value.search_context === "object"
                  ? {
                      composed_query: typeof value.search_context.composed_query === "string" ? value.search_context.composed_query : "",
                      last_user_query: typeof value.search_context.last_user_query === "string" ? value.search_context.last_user_query : "",
                      seen_project_ids: Array.isArray(value.search_context.seen_project_ids)
                        ? value.search_context.seen_project_ids.map((item) => String(item || "")).filter(Boolean)
                        : [],
                      last_project_ids: Array.isArray(value.search_context.last_project_ids)
                        ? value.search_context.last_project_ids.map((item) => String(item || "")).filter(Boolean)
                        : [],
                    }
                  : null,
              active_main_result:
                value.active_main_result && typeof value.active_main_result === "object"
                  ? {
                      query: typeof value.active_main_result.query === "string" ? value.active_main_result.query : "",
                      project_ids: Array.isArray(value.active_main_result.project_ids)
                        ? value.active_main_result.project_ids.map((item) => String(item || "")).filter(Boolean)
                        : [],
                      scope_key: typeof value.active_main_result.scope_key === "string" ? value.active_main_result.scope_key : "",
                    }
                  : null,
              quickstart_collapsed: value.quickstart_collapsed === true || (Array.isArray(value.messages) && value.messages.length > 0),
            };
          };
          const readAssistantSession = () => {
            try {
              return normalizeSideAssistantSession(JSON.parse(sessionStorage.getItem(assistantSessionStorageKey) || "null"));
            } catch {
              return normalizeSideAssistantSession(null);
            }
          };
          const writeAssistantSession = () => {
            try {
              sessionStorage.setItem(assistantSessionStorageKey, JSON.stringify(assistantSession));
            } catch {}
          };
          let assistantSession = readAssistantSession();
          let assistantPending = false;
          let assistantAbortController = null;

          const state = {
            search: search.value,
            preset: root.getAttribute("data-projects-default-preset") || "all",
            sort: "score",
            paradigm: "all",
            persistence: "all",
            page: 1,
            pageSize: Math.max(1, Number(root.getAttribute("data-projects-page-size") || "15") || 15),
          };

          const currentProjectsLang = () => (document.documentElement.lang || document.body?.getAttribute("data-lang") || "").toLowerCase().startsWith("en") ? "en" : "zh";
          const currentProjectsDate = () => new URL(window.location.href).searchParams.get("date") || "latest";
          const buildAssistantScope = () =>
            buildSideAssistantScopeKey({
              path: window.location.pathname,
              date: currentProjectsDate(),
              lang: currentProjectsLang(),
              sort: state.sort,
              paradigm: state.paradigm,
              persistence: state.persistence,
            });
          const projectCardRecords = () =>
            Array.from(document.querySelectorAll("[data-project-card='true']"))
              .filter((card) => card instanceof HTMLElement)
              .map((card) => ({
                element: card,
                searchName: [
                  card.dataset.projectName || "",
                  card.querySelector("[data-project-card-link='true']")?.textContent || "",
                ]
                  .filter(Boolean)
                  .join(" "),
                searchDescription: card.querySelector(".project-row-brief")?.textContent || "",
                searchMeta: card.dataset.projectSearch || "",
                score: Number(card.dataset.projectScore || "0"),
                growth: Number(card.dataset.projectGrowth || "0"),
                order: Number(card.dataset.projectOrder || "0"),
                preset: card.dataset.projectPreset || "",
                presets: String(card.dataset.projectPresets || "")
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
                paradigm: card.dataset.projectParadigm || "",
                persistence: card.dataset.projectPersistence || "",
              }));
          const applyAssistantProjectIds = (records, projectIds) => {
            const ids = Array.isArray(projectIds) ? projectIds : [];
            const order = new Map(ids.map((id, index) => [String(id || "").toLowerCase(), index]));
            return records
              .filter((record) => order.has((record.element.dataset.projectName || "").toLowerCase()))
              .sort((left, right) => (order.get((left.element.dataset.projectName || "").toLowerCase()) ?? 0) - (order.get((right.element.dataset.projectName || "").toLowerCase()) ?? 0));
          };
          const projectLinkMap = () =>
            new Map(
              projectCardRecords().map((record) => {
                const cardLink = record.element.querySelector("[data-project-card-link='true']");
                const href = cardLink instanceof HTMLAnchorElement ? cardLink.href : "";
                const label = cardLink?.textContent?.trim() || record.element.dataset.projectName || "";
                return [(record.element.dataset.projectName || "").trim().toLowerCase(), { href, label }];
              }),
            );
          const buildAssistantProjectHref = (projectId) => {
            const normalizedProjectId = String(projectId || "").trim();
            if (!normalizedProjectId) return "";
            const target = new URL(window.location.href);
            target.pathname = "/projects";
            target.searchParams.set("lang", currentProjectsLang());
            target.searchParams.set("date", currentProjectsDate());
            target.searchParams.set("project", normalizedProjectId);
            target.searchParams.set("source_view", "projects");
            if (!target.searchParams.get("theme")) target.searchParams.set("theme", "light");
            return target.toString();
          };
          const openAssistantPanel = () => {
            if (Number(assistantHost?.dataset.projectsAiSuppressClickUntil || "0") > Date.now()) return;
            assistantSession.panel_open = true;
            writeAssistantSession();
            renderAssistantPanel();
            applySideAssistantPlacement(assistantHost);
          };
          const closeAssistantPanel = () => {
            assistantSession.panel_open = false;
            writeAssistantSession();
            renderAssistantPanel();
          };
          const setAssistantStatus = (text) => {
            if (!(assistantStatus instanceof HTMLElement)) return;
            assistantStatus.hidden = !text;
            assistantStatus.textContent = text || "";
          };
          const renderAssistantMessageNode = (message) => {
            const wrapper = document.createElement("article");
            wrapper.className = "surface-card projects-ai-message " + (message.role === "user" ? "is-user" : "is-assistant");
            const label = document.createElement("div");
            label.className = "context-label";
            label.textContent = message.role === "user" ? "你" : "AI 搜项目";
            const text = document.createElement("p");
            text.className = "projects-ai-message-copy";
            text.textContent = message.text;
            wrapper.append(label, text);

            if (message.role === "assistant") {
              const linkMap = projectLinkMap();
              const previewIds = Array.isArray(message.preview_project_ids) ? message.preview_project_ids : [];
              if (previewIds.length > 0) {
                const previewList = document.createElement("div");
                previewList.className = "projects-ai-preview-list";
                previewIds.forEach((projectId) => {
                  const matched = linkMap.get(String(projectId || "").trim().toLowerCase());
                  const link = document.createElement("a");
                  link.href = matched?.href || buildAssistantProjectHref(projectId);
                  link.textContent = matched.label || projectId;
                  link.className = "inline-link projects-ai-project-link";
                  link.dataset.projectsAiProjectLink = "true";
                  link.dataset.projectsAiProjectId = projectId;
                  const arrow = document.createElement("span");
                  arrow.className = "projects-ai-project-link-arrow";
                  arrow.textContent = "›";
                  arrow.setAttribute("aria-hidden", "true");
                  link.appendChild(arrow);
                  previewList.appendChild(link);
                });
                if (previewList.childElementCount > 0) wrapper.appendChild(previewList);
              }

              const options = Array.isArray(message.clarification_options) ? message.clarification_options : [];
              if (options.length > 0) {
                const optionRow = document.createElement("div");
                optionRow.className = "filter-chip-row projects-ai-option-row";
                options.forEach((option) => {
                  const button = document.createElement("button");
                  button.type = "button";
                  button.className = "filter-chip";
                  button.dataset.projectsAiOptionQuery = option.query || "";
                  button.textContent = option.label_cn || option.query || "";
                  optionRow.appendChild(button);
                });
                wrapper.appendChild(optionRow);
              }

              if (message.can_view_all === true && Array.isArray(message.project_ids) && message.project_ids.length > 0) {
                const actionRow = document.createElement("div");
                actionRow.className = "projects-ai-action-row";
                const button = document.createElement("button");
                button.type = "button";
                button.className = "button-link-secondary projects-ai-view-all";
                button.dataset.projectsAiViewAll = "true";
                button.dataset.projectsAiViewAllQuery = message.query || "";
                button.dataset.projectsAiProjectIds = JSON.stringify(message.project_ids);
                button.textContent = "查看全部结果";
                actionRow.appendChild(button);
                wrapper.appendChild(actionRow);
              }
            }

            return wrapper;
          };
          function renderAssistantPanel() {
            document.body?.classList.toggle("projects-ai-open", assistantSession.panel_open === true);
            if (assistantHost instanceof HTMLElement) assistantHost.style.pointerEvents = "none";
            if (assistantLauncher instanceof HTMLElement) {
              assistantLauncher.hidden = assistantSession.panel_open === true;
              assistantLauncher.style.pointerEvents = "auto";
            }
            const assistantQuickstart = assistantPanel?.querySelector("[data-projects-ai-quickstart='true']");
            const assistantQuickstartToggleRow = assistantPanel?.querySelector("[data-projects-ai-quickstart-toggle-row='true']");
            if (assistantPanel instanceof HTMLElement) {
              assistantPanel.hidden = assistantSession.panel_open !== true;
              assistantPanel.style.pointerEvents = "auto";
              assistantPanel.classList.toggle("is-compact", assistantSession.quickstart_collapsed === true);
            }
            if (assistantQuickstart instanceof HTMLElement) {
              assistantQuickstart.hidden = assistantSession.quickstart_collapsed === true;
            }
            if (assistantQuickstartToggleRow instanceof HTMLElement) {
              assistantQuickstartToggleRow.hidden = assistantSession.quickstart_collapsed !== true;
            }
            if (assistantMessages instanceof HTMLElement) {
              assistantMessages.innerHTML = "";
              if (assistantSession.messages.length === 0) {
                const intro = document.createElement("article");
                intro.className = "surface-card projects-ai-message projects-ai-empty-state";
                intro.textContent = "描述你想找的项目方向，我会返回简短说明、最多 3 个项目链接，并可切换主列表查看全部结果。";
                assistantMessages.appendChild(intro);
              } else {
                assistantSession.messages.forEach((message) => {
                  assistantMessages.appendChild(renderAssistantMessageNode(message));
                });
              }
              assistantMessages.scrollTop = assistantMessages.scrollHeight;
            }
            if (assistantInput instanceof HTMLInputElement && assistantSession.panel_open === true && !assistantPending && !assistantInput.value.trim()) {
              assistantInput.focus({ preventScroll: true });
            }
            setAssistantStatus(assistantPending ? "正在搜索站内项目库…" : "");
          }
          const applyActiveMainResultState = () => {
            if (!(assistantMainResult instanceof HTMLElement)) return;
            const active = assistantSession.active_main_result && canRestoreSideAssistantMainResult(assistantSession.active_main_result.scope_key, buildAssistantScope())
              ? assistantSession.active_main_result
              : null;
            assistantMainResult.hidden = !active;
            if (assistantMainResultQuery instanceof HTMLElement) assistantMainResultQuery.textContent = active?.query || "";
          };
          const buildAssistantMessage = (response, previewIds, isMoreMode) => {
            if (response.source === "regulated_keyword_search") {
              return response.boundary_message_cn || response.explanation_cn || "仅按站内 AI Agent 项目检索，不提供真实专业建议。";
            }
            if (response.source === "needs_clarification") {
              return response.explanation_cn || "需要更具体一点，我给你几个可直接点的改写。";
            }
            if (response.source === "llm_failed_fallback") {
              return response.explanation_cn || "扩展搜索暂不可用，先按站内热门项目给你结果。";
            }
            if (previewIds.length === 0 && isMoreMode) {
              return "没有更多未展示项目了，可以换个补充条件继续找。";
            }
            if (previewIds.length === 0) {
              return response.explanation_cn || "这轮没有匹配到可展示的项目。";
            }
            return response.explanation_cn || ("找到 " + String(response.project_ids.length) + " 个相关项目，先给你看最值得点开的几条。");
          };
          const triggerAssistantSubmit = (event) => {
            event?.preventDefault?.();
            if (!(assistantInput instanceof HTMLInputElement) || assistantPending) return;
            void submitAssistantQuery(assistantInput.value);
          };
          const submitAssistantQuery = async (rawQuery) => {
            const trimmed = String(rawQuery || "").trim();
            if (!trimmed) return;
            assistantSession.quickstart_collapsed = true;
            const isMoreMode = isSideAssistantMoreQuery(trimmed);
            const composedQuery = composeSideAssistantQuery(assistantSession.search_context, trimmed);
            if (!composedQuery) {
              assistantSession.messages.push({
                role: "assistant",
                text: "先描述一个更具体的项目方向，我再帮你搜。",
              });
              renderAssistantPanel();
              writeAssistantSession();
              return;
            }
            if (!queryMeetsFuzzyTriggerThreshold(composedQuery)) {
              assistantSession.messages.push(
                { role: "user", text: trimmed, query: trimmed },
                { role: "assistant", text: "描述再具体一点，比如公司、任务、方向词或想看的场景。" },
              );
              renderAssistantPanel();
              writeAssistantSession();
              return;
            }

            if (assistantAbortController) assistantAbortController.abort();
            assistantAbortController = new AbortController();
            assistantPending = true;
            assistantSession.panel_open = true;
            assistantSession.messages.push({ role: "user", text: trimmed, query: trimmed });
            writeAssistantSession();
            renderAssistantPanel();
            if (assistantInput instanceof HTMLInputElement) assistantInput.value = "";

            try {
              const response = await fetch("/api/projects/fuzzy-search", {
                method: "POST",
                headers: { "content-type": "application/json" },
                cache: "no-store",
                signal: assistantAbortController.signal,
                body: JSON.stringify({
                  raw_query: composedQuery,
                  date: currentProjectsDate(),
                  lang: currentProjectsLang(),
                  filters: {
                    paradigm: state.paradigm,
                    persistence: state.persistence,
                  },
                  sort: state.sort,
                  page_context: {
                    page: state.page,
                    page_size: state.pageSize,
                    path: window.location.pathname,
                  },
                }),
              });
              if (!response.ok) throw new Error("fuzzy-search-failed");
              const payload = await response.json();
              const projectIds = Array.isArray(payload?.project_ids) ? payload.project_ids.map((item) => String(item || "")).filter(Boolean) : [];
              const previousSeen = isMoreMode ? assistantSession.search_context?.seen_project_ids || [] : [];
              const previewIds = pickSideAssistantPreviewIds(projectIds, previousSeen, 3);
              assistantSession.search_context = {
                composed_query: composedQuery,
                last_user_query: trimmed,
                seen_project_ids: isMoreMode ? Array.from(new Set(previousSeen.concat(previewIds))) : previewIds.slice(),
                last_project_ids: projectIds,
              };
              assistantSession.messages.push({
                role: "assistant",
                text: buildAssistantMessage(payload, previewIds, isMoreMode),
                query: trimmed,
                source: payload?.source || "",
                project_ids: projectIds,
                preview_project_ids: previewIds,
                clarification_options:
                  payload?.source === "needs_clarification" && Array.isArray(payload?.clarification_options)
                    ? payload.clarification_options.map((option) => ({
                        label_cn: option.label_cn || option.query || "",
                        query: option.query || "",
                      }))
                    : [],
                can_view_all: projectIds.length > 0,
              });
            } catch (error) {
              if (error && error.name === "AbortError") return;
              assistantSession.search_context = {
                composed_query: composedQuery,
                last_user_query: trimmed,
                seen_project_ids: assistantSession.search_context?.seen_project_ids || [],
                last_project_ids: assistantSession.search_context?.last_project_ids || [],
              };
              assistantSession.messages.push({
                role: "assistant",
                text: "这次搜索没有成功，但我保留了上下文，你可以直接换个说法继续问。",
                query: trimmed,
              });
            } finally {
              assistantPending = false;
              assistantAbortController = null;
              writeAssistantSession();
              renderAssistantPanel();
              apply();
            }
          };
          if (assistantSession.active_main_result && !canRestoreSideAssistantMainResult(assistantSession.active_main_result.scope_key, buildAssistantScope())) {
            assistantSession.active_main_result = null;
            writeAssistantSession();
          }

          const setOptionState = (options, activeValue, attrName) => {
            options.forEach((option) => {
              const isActive = option.getAttribute(attrName) === activeValue;
              option.classList.toggle("is-active", isActive);
              option.setAttribute("aria-pressed", isActive ? "true" : "false");
            });
          };
          const setSortDropdownOpen = (isOpen) => {
            if (!(sortToggle instanceof HTMLButtonElement) || !(sortMenu instanceof HTMLElement)) return;
            sortMenu.hidden = !isOpen;
            sortToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
            sortDropdown instanceof HTMLElement && sortDropdown.classList.toggle("is-open", isOpen);
          };
          const syncSortDropdown = () => {
            sortDropdownOptions.forEach((option) => {
              const isActive = option.getAttribute("data-projects-sort-value") === state.sort;
              option.classList.toggle("is-active", isActive);
              option.setAttribute("aria-selected", isActive ? "true" : "false");
              if (isActive && sortCurrent instanceof HTMLElement) {
                sortCurrent.textContent = option.textContent || "";
              }
            });
          };
          const closeDetailForHiddenSelection = () => {
            const currentLayout = document.querySelector(".primary-content .content-layout");
            if (!(currentLayout instanceof HTMLElement)) return;
            const currentDetail = currentLayout.querySelector(".detail-column");
            if (currentDetail instanceof HTMLElement) {
              currentDetail.remove();
            }
            currentLayout.classList.toggle("has-detail", false);
            document.querySelectorAll("[data-project-card='true'].is-selected").forEach((card) => {
              if (!(card instanceof HTMLElement)) return;
              card.classList.remove("is-selected");
              card.querySelector(".projects-pulse-dot")?.remove();
            });
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.delete("project");
            nextUrl.searchParams.delete("vc_detail");
            window.history.replaceState(window.history.state ?? {}, "", nextUrl.toString());
          };

          const apply = (options = {}) => {
            const cards = projectCardRecords();
            const lane = document.querySelector("[data-projects-lane='true']");
            const count = document.querySelector("[data-projects-count='true']");
            const emptyState = document.querySelector("[data-projects-empty='true']");
            if (!(lane instanceof HTMLElement)) return;

            const directCards = filterAndSortProjectCards(cards, state);
            const activeMainResult = assistantSession.active_main_result && canRestoreSideAssistantMainResult(assistantSession.active_main_result.scope_key, buildAssistantScope())
              ? assistantSession.active_main_result
              : null;
            const filteredCards = activeMainResult ? applyAssistantProjectIds(cards, activeMainResult.project_ids) : directCards;
            const activeProject = decodeURIComponent(new URL(window.location.href).searchParams.get("project") || "").trim().toLowerCase();
            if (activeProject) {
              const selectedIndex = filteredCards.findIndex((card) => (card.element.dataset.projectName || "").trim().toLowerCase() === activeProject);
              if (selectedIndex >= 0) {
                state.page = Math.floor(selectedIndex / state.pageSize) + 1;
              }
            }
            const page = paginateProjectCards(filteredCards, state.page, state.pageSize);
            const visibleCards = page.items;
            state.page = page.currentPage;

            cards.forEach((card) => {
              card.element.hidden = true;
            });
            visibleCards.forEach((card) => {
              card.element.hidden = false;
              lane.appendChild(card.element);
            });

            if (count instanceof HTMLElement) count.textContent = String(page.totalCount);
            if (emptyState instanceof HTMLElement) emptyState.hidden = page.totalCount > 0;

            const pageStatusText = page.totalCount === 0 ? "0 / 0" : String(page.currentPage) + " / " + String(page.pageCount);
            const pageSummaryText =
              page.totalCount === 0
                ? "0-0 / 0"
                : String(page.startIndex + 1) + "-" + String(page.endIndex) + " / " + String(page.totalCount);
            pageStatusNodes.forEach((node) => {
              node.textContent = pageStatusText;
            });
            pageSummaryNodes.forEach((node) => {
              node.textContent = pageSummaryText;
            });
            previousPageButtons.forEach((button) => {
              button.disabled = page.totalCount === 0 || page.currentPage <= 1;
              button.setAttribute("aria-disabled", button.disabled ? "true" : "false");
            });
            nextPageButtons.forEach((button) => {
              button.disabled = page.totalCount === 0 || page.currentPage >= page.pageCount;
              button.setAttribute("aria-disabled", button.disabled ? "true" : "false");
            });

            if (activeProject) {
              const selectedStillVisible = visibleCards.some((card) => (card.element.dataset.projectName || "").trim().toLowerCase() === activeProject);
              if (!selectedStillVisible) {
                closeDetailForHiddenSelection();
              }
            }

            setOptionState(sortOptions, state.sort, "data-projects-sort-option");
            syncSortDropdown();
            setOptionState(presetOptions, state.preset, "data-projects-preset-option");
            setOptionState(paradigmOptions, state.paradigm, "data-projects-paradigm-option");
            setOptionState(persistenceOptions, state.persistence, "data-projects-persistence-option");
            if (assistantEmptyCta instanceof HTMLElement) assistantEmptyCta.hidden = page.totalCount > 0;
            applyActiveMainResultState();
            scheduleProjectDetailPrefetch();
          };
          root.__projectsWorkbenchApply = apply;

          const syncSearchRotator = () => {
            if (!(searchRotator instanceof HTMLElement)) return;
            const shouldShow = rotatorTerms.length > 0 && !search.matches(":focus") && !search.value.trim();
            searchRotator.hidden = !shouldShow;
            if (!shouldShow) return;
            const nextTerm = rotatorTerms[rotatorIndex % rotatorTerms.length] || "";
            searchRotator.textContent = nextTerm;
            searchRotator.setAttribute("data-projects-search-suggestion-term", nextTerm);
          };

          search.addEventListener("input", () => {
            state.search = search.value;
            state.page = 1;
            apply();
            syncSearchRotator();
          });
          search.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            state.search = search.value;
            state.page = 1;
            apply();
            syncSearchRotator();
          });
          search.addEventListener("search", () => {
            state.search = search.value;
            state.page = 1;
            apply();
            syncSearchRotator();
          });
          search.addEventListener("focus", syncSearchRotator);
          search.addEventListener("blur", syncSearchRotator);

          if (searchRotator instanceof HTMLElement && rotatorTerms.length > 1) {
            window.setInterval(() => {
              rotatorIndex = (rotatorIndex + 1) % rotatorTerms.length;
              syncSearchRotator();
            }, 2400);
          }

          searchExamples.forEach((option) => {
            option.addEventListener("click", () => {
              const nextValue = option.getAttribute("data-projects-search-example") || "";
              search.value = nextValue;
              state.search = nextValue;
              state.page = 1;
              apply();
              syncSearchRotator();
            });
          });

          sortOptions.forEach((option) => {
            option.addEventListener("click", () => {
              state.sort = option.getAttribute("data-projects-sort-option") || "score";
              state.page = 1;
              apply();
            });
          });
          presetOptions.forEach((option) => {
            option.addEventListener("click", () => {
              state.preset = option.getAttribute("data-projects-preset-option") || "all";
              state.page = 1;
              apply();
            });
          });
          if (sortToggle instanceof HTMLButtonElement) {
            sortToggle.addEventListener("click", (event) => {
              event.preventDefault();
              const isOpen = sortToggle.getAttribute("aria-expanded") === "true";
              setSortDropdownOpen(!isOpen);
            });
          }
          sortDropdownOptions.forEach((option) => {
            option.addEventListener("click", () => {
              state.sort = option.getAttribute("data-projects-sort-value") || "score";
              state.page = 1;
              setSortDropdownOpen(false);
              apply();
            });
          });
          document.addEventListener("click", (event) => {
            if (!(sortDropdown instanceof HTMLElement)) return;
            if (event.target instanceof Node && sortDropdown.contains(event.target)) return;
            setSortDropdownOpen(false);
          });
          document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            setSortDropdownOpen(false);
          });
          paradigmOptions.forEach((option) => {
            option.addEventListener("click", () => {
              state.paradigm = option.getAttribute("data-projects-paradigm-option") || "all";
              state.page = 1;
              apply();
            });
          });
          persistenceOptions.forEach((option) => {
            option.addEventListener("click", () => {
              state.persistence = option.getAttribute("data-projects-persistence-option") || "all";
              state.page = 1;
              apply();
            });
          });
          assistantLauncher instanceof HTMLButtonElement && assistantLauncher.addEventListener("click", openAssistantPanel);
          assistantEmptyCta instanceof HTMLButtonElement && assistantEmptyCta.addEventListener("click", openAssistantPanel);
          assistantClose instanceof HTMLButtonElement && assistantClose.addEventListener("click", closeAssistantPanel);
          assistantReset instanceof HTMLButtonElement &&
            assistantReset.addEventListener("click", () => {
              state.page = 1;
              assistantSession.active_main_result = null;
              writeAssistantSession();
              apply();
            });
          assistantNewChat instanceof HTMLButtonElement &&
            assistantNewChat.addEventListener("click", () => {
              assistantSession = {
                panel_open: true,
                messages: [],
                search_context: null,
                active_main_result: null,
                quickstart_collapsed: false,
              };
              if (assistantInput instanceof HTMLInputElement) assistantInput.value = "";
              writeAssistantSession();
              renderAssistantPanel();
              apply();
            });
          assistantSubmit instanceof HTMLButtonElement &&
            assistantSubmit.addEventListener("pointerup", triggerAssistantSubmit);
          assistantSubmit instanceof HTMLButtonElement &&
            assistantSubmit.addEventListener("click", triggerAssistantSubmit);
          assistantForm instanceof HTMLFormElement &&
            assistantForm.addEventListener("submit", triggerAssistantSubmit);
          assistantInput instanceof HTMLInputElement &&
            assistantInput.addEventListener("input", () => {
              if (assistantSession.quickstart_collapsed === true) return;
              if (!assistantInput.value.trim()) return;
              assistantSession.quickstart_collapsed = true;
              writeAssistantSession();
              renderAssistantPanel();
            });
          assistantInput instanceof HTMLInputElement &&
            assistantInput.addEventListener("keydown", (event) => {
              if (event.key !== "Enter" || event.isComposing) return;
              triggerAssistantSubmit(event);
            });
          assistantPanel instanceof HTMLElement &&
            assistantPanel.addEventListener("click", (event) => {
              const target = event.target;
              if (!(target instanceof Element)) return;
              const projectLink = target.closest("[data-projects-ai-project-link='true']");
              if (projectLink instanceof HTMLAnchorElement) {
                return;
              }
              const option = target.closest("[data-projects-ai-option-query]");
              if (option instanceof HTMLElement) {
                const nextValue = option.dataset.projectsAiOptionQuery || "";
                if (!nextValue) return;
                assistantSession.quickstart_collapsed = true;
                if (assistantInput instanceof HTMLInputElement) assistantInput.value = nextValue;
                void submitAssistantQuery(nextValue);
                return;
              }
              const quickstartToggle = target.closest("[data-projects-ai-quickstart-toggle='true']");
              if (quickstartToggle instanceof HTMLElement) {
                assistantSession.quickstart_collapsed = !assistantSession.quickstart_collapsed;
                writeAssistantSession();
                renderAssistantPanel();
                return;
              }
              const viewAll = target.closest("[data-projects-ai-view-all='true']");
              if (viewAll instanceof HTMLElement) {
                let projectIds = [];
                try {
                  projectIds = JSON.parse(viewAll.dataset.projectsAiProjectIds || "[]");
                } catch {
                  projectIds = [];
                }
                state.page = 1;
                assistantSession.active_main_result = {
                  query: viewAll.dataset.projectsAiViewAllQuery || assistantSession.search_context?.last_user_query || "AI 搜项目",
                  project_ids: Array.isArray(projectIds) ? projectIds.map((item) => String(item || "")).filter(Boolean) : [],
                  scope_key: buildAssistantScope(),
                };
                writeAssistantSession();
                apply();
              }
            });
          bindSideAssistantPlacement({ assistantHost, assistantLauncher, assistantPanel });
          previousPageButtons.forEach((button) => {
            button.addEventListener("click", () => {
              if (button.disabled) return;
              state.page = Math.max(1, state.page - 1);
              apply();
              document.querySelector("[data-projects-lane='true']")?.scrollIntoView({ block: "start", behavior: "auto" });
            });
          });
          nextPageButtons.forEach((button) => {
            button.addEventListener("click", () => {
              if (button.disabled) return;
              state.page += 1;
              apply();
              document.querySelector("[data-projects-lane='true']")?.scrollIntoView({ block: "start", behavior: "auto" });
            });
          });

          syncSearchRotator();
          renderAssistantPanel();
          apply();
        };
        const restoreScrollIfNeeded = () => {
          const payload = readScroll();
          if (!payload || payload.href !== window.location.href) return;
          requestAnimationFrame(() => {
            window.scrollTo({ top: Number(payload.scrollY) || 0, behavior: "auto" });
            clearScroll();
            scheduleAutoHideNavUpdate();
          });
        };
        const detailSurfaceKey = (detail) => (
          detail instanceof HTMLElement ? (detail.dataset.detailKey || detail.getAttribute("data-detail-key") || "") : ""
        );
        const syncDetailSurfaceSelection = () => {
          const detail = document.querySelector(".detail-column");
          if (!(detail instanceof HTMLElement)) {
            detailSurfaceState.engagedKey = null;
            return null;
          }
          const isEngaged = Boolean(detailSurfaceState.engagedKey) && detailSurfaceState.engagedKey === detailSurfaceKey(detail);
          detail.dataset.detailScrollActive = isEngaged ? "true" : "false";
          return isEngaged ? detail : null;
        };
        const setEngagedDetailSurface = (detail) => {
          detailSurfaceState.engagedKey = detailSurfaceKey(detail) || null;
          return syncDetailSurfaceSelection();
        };
        const clearEngagedDetailSurface = () => {
          detailSurfaceState.engagedKey = null;
          syncDetailSurfaceSelection();
        };
        const stabilizeDetailSurface = (previousDetail, options = {}) => {
          const nextDetail = document.querySelector(".detail-column");
          if (!(nextDetail instanceof HTMLElement)) {
            clearEngagedDetailSurface();
            return;
          }
          const previousScrollTop = previousDetail instanceof HTMLElement ? previousDetail.scrollTop : 0;
          const preserveViewport = options && options.preserveViewport === true;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const maxScrollTop = Math.max(0, nextDetail.scrollHeight - nextDetail.clientHeight);
              nextDetail.scrollTop = Math.min(previousScrollTop, maxScrollTop);
              syncDetailSurfaceSelection();
              if (!isDesktopViewport()) return;
              const rect = nextDetail.getBoundingClientRect();
              if (!preserveViewport && (rect.bottom < 0 || rect.top > window.innerHeight)) {
                nextDetail.scrollIntoView({ block: "nearest", inline: "nearest" });
              }
            });
          });
        };
        const focusedDetailSurface = () => {
          const detail = document.querySelector(".detail-column");
          if (!(detail instanceof HTMLElement)) return null;
          if (detail.dataset.detailScrollActive !== "true") return null;
          return detail;
        };
        const syncHydrationPayload = (snapshot) => {
          hydrationPayloadConfigs.forEach(({ scriptId, windowKey }) => {
            const currentPayloadNode = document.getElementById(scriptId);
            const nextPayloadText = snapshot?.payloadTexts?.[scriptId] ?? "";

            if (currentPayloadNode instanceof HTMLScriptElement) {
              currentPayloadNode.textContent = nextPayloadText;
            } else if (nextPayloadText) {
              const cloned = document.createElement("script");
              cloned.id = scriptId;
              cloned.type = "application/json";
              cloned.setAttribute("charset", "utf-8");
              cloned.textContent = nextPayloadText;
              document.head.appendChild(cloned);
            }

            if (!nextPayloadText) {
              delete window[windowKey];
              return;
            }

            try {
              window[windowKey] = JSON.parse(nextPayloadText);
            } catch {
              delete window[windowKey];
            }
          });
        };
        const remountReactApps = () => {
          if (typeof window.__mountVisualConsoleApps === "function") {
            window.__mountVisualConsoleApps();
          }
        };
        const bindInteractiveSurfaces = () => {
          syncPreferenceState();
          syncSideAssistantShell();
          bindAutoHideNav();
          bindPremiumNav();
          bindTopProjectCarousel();
          bindOverviewWorkspaceRail();
          bindGlobalSideAssistant();
          bindProjectsWorkbench();
          warmCriticalRoutes();
          schedulePrimaryRoutePrefetch();
          scheduleProjectDetailPrefetch();
          if (document.querySelector("[data-react-ssr='false']")) {
            requestAnimationFrame(() => {
              remountReactApps();
            });
          } else {
            scheduleReactRemount();
          }
          document.body?.classList.remove("is-initializing");
        };
        const refreshDocumentState = (nextDoc) => {
          document.title = nextDoc.title;
          document.documentElement.lang = nextDoc.documentLang || document.documentElement.lang;
          document.documentElement.className = nextDoc.documentClassName || "";
          const nextHtmlTheme = nextDoc.documentTheme;
          if (nextHtmlTheme) {
            document.documentElement.setAttribute("data-theme", nextHtmlTheme);
          } else {
            document.documentElement.removeAttribute("data-theme");
          }
          document.body.className = nextDoc.bodyClassName || "";
          const nextRoute = nextDoc.bodyRoute;
          if (nextRoute) document.body.setAttribute("data-route", nextRoute);
          else document.body.removeAttribute("data-route");
          const nextBodyTheme = nextDoc.bodyTheme;
          if (nextBodyTheme) {
            document.body.setAttribute("data-theme", nextBodyTheme);
          } else {
            document.body.removeAttribute("data-theme");
          }
          syncHydrationPayload(nextDoc);
          bindInteractiveSurfaces();
        };
        const replacePrimaryShell = (nextDoc) => {
          const previousDetail = document.querySelector(".detail-column");
          const currentHeader = document.querySelector(".page-frame-top-nav-shell");
          const nextHeader = cloneTemplateElement(nextDoc?.headerTemplate);
          const currentPrimary = document.querySelector(".primary-content");
          const nextPrimary = cloneTemplateElement(nextDoc?.primaryTemplate);
          if (!(currentPrimary instanceof HTMLElement) || !(nextPrimary instanceof HTMLElement)) return false;
          if (currentHeader instanceof HTMLElement && nextHeader instanceof HTMLElement) {
            currentHeader.replaceWith(nextHeader);
          }
          currentPrimary.replaceWith(nextPrimary);
          refreshDocumentState(nextDoc);
          stabilizeDetailSurface(previousDetail, { preserveViewport: true });
          return true;
        };
        const replaceShell = (nextDoc) => {
          const previousDetail = document.querySelector(".detail-column");
          const currentShell = document.querySelector(".app-shell");
          const nextShell = cloneTemplateElement(nextDoc?.appShellTemplate);
          if (!(currentShell instanceof HTMLElement) || !(nextShell instanceof HTMLElement)) return false;
          currentShell.replaceWith(nextShell);
          refreshDocumentState(nextDoc);
          stabilizeDetailSurface(previousDetail, { preserveViewport: true });
          return true;
        };
        const replaceContentLayout = (nextDoc) => {
          const currentLayout = document.querySelector(".primary-content .content-layout");
          const nextLayout = cloneTemplateElement(nextDoc?.layoutTemplate);
          if (!(currentLayout instanceof HTMLElement) || !(nextLayout instanceof HTMLElement)) return false;
          const currentDetail = currentLayout.querySelector(".detail-column");
          currentLayout.replaceWith(nextLayout);
          refreshDocumentState(nextDoc);
          stabilizeDetailSurface(currentDetail);
          return true;
        };
        const applyProjectsDetailSelection = (selectedProjectName) => {
          const cards = Array.from(document.querySelectorAll("[data-project-card='true']")).filter((card) => card instanceof HTMLElement);
          const selectedKey = typeof selectedProjectName === "string" ? selectedProjectName.toLowerCase() : "";
          cards.forEach((card) => {
            const cardKey = (card.dataset.projectName || "").toLowerCase();
            const title = card.querySelector("h3");
            const pulse = title?.querySelector(".projects-pulse-dot");
            const isSelected = Boolean(selectedKey) && cardKey === selectedKey;
            card.classList.toggle("is-selected", isSelected);
            if (isSelected) {
              if (!pulse && title instanceof HTMLElement) {
                const dot = document.createElement("span");
                dot.className = "projects-pulse-dot";
                dot.setAttribute("aria-hidden", "true");
                title.appendChild(dot);
              }
            } else {
              pulse?.remove();
            }
          });
        };
        const replaceProjectsDetail = (payload) => {
          if (!payload || payload.route !== "projects-detail") return false;
          const currentLayout = document.querySelector(".primary-content .content-layout");
          if (!(currentLayout instanceof HTMLElement)) return false;
          const currentDetail = currentLayout.querySelector(".detail-column");
          const nextDetailTemplate = createTemplate(payload.detailHtml || "");
          const nextDetail = cloneTemplateElement(nextDetailTemplate);
          currentLayout.classList.toggle("has-detail", payload.hasDetail === true);
          applyProjectsDetailSelection(payload.selectedProjectName || null);
          if (nextDetail instanceof HTMLElement) {
            if (currentDetail instanceof HTMLElement) currentDetail.replaceWith(nextDetail);
            else currentLayout.appendChild(nextDetail);
          } else if (currentDetail instanceof HTMLElement) {
            currentDetail.remove();
          }
          stabilizeDetailSurface(currentDetail);
          setMobileNavHidden(payload.hasDetail === true);
          return true;
        };
        const applyLocalProjectsDetail = (href, historyMode = "push") => {
          const payload = resolveProjectsLocalDetailSnapshot(href);
          if (!payload) return false;
          const applied = replaceProjectsDetail(payload);
          if (!applied) return false;
          const finalHref = new URL(href, window.location.href).toString();
          if (historyMode === "push") window.history.pushState({}, "", finalHref);
          if (historyMode === "replace") window.history.replaceState({}, "", finalHref);
          clearScrollForHref(finalHref);
          recordMetric("detail-update", 0, finalHref);
          return true;
        };
        const fetchAndApply = async (href, mode, historyMode) => {
          const startedAt = performance.now();
          const target = new URL(buildThemeAwareHref(href, resolveActiveTheme()) || href, window.location.href);
          if (mode === "detail" && applyLocalProjectsDetail(target.toString(), historyMode)) {
            return;
          }
          let prefetched;

          try {
            prefetched = await readRoutePrefetch(target.toString(), {
              priority: mode === "detail" ? "interactive" : "navigation",
              kind: mode === "detail" ? "detail" : "navigation",
            });
          } catch {
            window.location.assign(target.toString());
            return;
          }

          const finalHref = prefetched.finalHref || target.toString();
          const nextDoc = prefetched.snapshot;
          if (mode !== "detail" || !nextDoc || nextDoc.route !== "projects-detail") {
            await primeClientOnlyPayloads(nextDoc);
          }
          if (snapshotNeedsReactRuntime(nextDoc)) {
            await ensureReactRuntime();
          }
          const applied =
            mode === "detail"
              ? nextDoc?.route === "projects-detail"
                ? replaceProjectsDetail(nextDoc)
                : replaceContentLayout(nextDoc)
              : false;
          const replaced = applied || replacePrimaryShell(nextDoc) || replaceShell(nextDoc);
          if (!replaced) {
            window.location.assign(finalHref);
            return;
          }

          if (historyMode === "push") window.history.pushState({}, "", finalHref);
          if (historyMode === "replace") window.history.replaceState({}, "", finalHref);
          if (mode === "detail") clearScrollForHref(finalHref);
          else restoreScrollIfNeeded();
          if (mode !== "detail") {
            seedCurrentRoutePrefetch(finalHref);
          }
          recordMetric(applied ? "detail-update" : "route-update", performance.now() - startedAt, finalHref);
        };
        const isInternalVisualRoute = (href) => {
          try {
            const url = new URL(href, window.location.href);
            return url.origin === window.location.origin && routes.has(url.pathname);
          } catch {
            return false;
          }
        };
        const shouldUseDetailSwap = (link) => {
          if (link.dataset.preserveScroll !== "detail") return false;
          const current = new URL(window.location.href);
          const next = new URL(buildThemeAwareHref(link.href, resolveActiveTheme()) || link.href, window.location.href);
          if (current.pathname !== next.pathname) return false;
          return ["project", "slug"].some((key) => current.searchParams.has(key) || next.searchParams.has(key));
        };
        const boot = () => {
          seedCurrentRoutePrefetch();
          initializeThemePreference();
          bindInteractiveSurfaces();
          restoreScrollIfNeeded();
          scheduleAutoHideNavUpdate();
        };

        document.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target.closest("[data-projects-ai-launch='true']")) {
            const assistantHost = document.querySelector("[data-projects-ai-assistant-host='true']");
            if (Number(assistantHost?.dataset.projectsAiSuppressClickUntil || "0") > Date.now()) return;
            setSideAssistantPanelOpen(true);
            return;
          }
          if (target.closest("[data-projects-ai-close='true']")) {
            setSideAssistantPanelOpen(false);
            return;
          }
          const projectCard = target.closest("[data-project-card='true']");
          if (
            projectCard instanceof HTMLElement &&
            !target.closest("a, button, input, textarea, select, label")
          ) {
            const link = projectCard.querySelector("[data-project-card-link='true']");
            if (link instanceof HTMLAnchorElement) {
              link.click();
              return;
            }
          }
          const link = target.closest("a");
          if (!(link instanceof HTMLAnchorElement)) return;
          const isThemeOption = isThemeValue(link.dataset.themeOption);

          if (isThemeOption) {
            event.preventDefault();
            const nextTheme = applyThemePreference(link.dataset.themeOption);
            recordMetric("theme-update", 0, window.location.href);
            prefetchLinkedPayload(window.location.href, "interactive");
            void readRoutePrefetch(window.location.href, {
              priority: "background",
              kind: "navigation",
            }).catch(() => {});
            return;
          }

          const themedHref = buildThemeAwareHref(link.href, resolveActiveTheme()) || link.href;

          if (link.hasAttribute("data-preserve-scroll")) {
            writeScroll({ href: themedHref, scrollY: window.scrollY });
          }

          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            link.target === "_blank" ||
            link.hasAttribute("download") ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            !isInternalVisualRoute(link.href)
          ) {
            return;
          }

          event.preventDefault();
          void fetchAndApply(themedHref, shouldUseDetailSwap(link) ? "detail" : "route", "push");
        });

        document.addEventListener("pointerenter", (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const link = target.closest("a");
          if (!(link instanceof HTMLAnchorElement) || !isInternalVisualRoute(link.href)) return;
          if (isThemeValue(link.dataset.themeOption)) return;
          const themedHref = buildThemeAwareHref(link.href, resolveActiveTheme()) || link.href;
          if (shouldUseDetailSwap(link) && hasLocalProjectsDetailForHref(link.href)) return;
          void readRoutePrefetch(themedHref, {
            priority: "interactive",
            kind: shouldUseDetailSwap(link) ? "detail" : "navigation",
          }).catch(() => {});
          prefetchLinkedPayload(themedHref, "interactive");
        }, { capture: true, passive: true });

        document.addEventListener("focusin", (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const link = target.closest("a");
          if (!(link instanceof HTMLAnchorElement) || !isInternalVisualRoute(link.href)) return;
          if (isThemeValue(link.dataset.themeOption)) return;
          const themedHref = buildThemeAwareHref(link.href, resolveActiveTheme()) || link.href;
          if (shouldUseDetailSwap(link) && hasLocalProjectsDetailForHref(link.href)) return;
          void readRoutePrefetch(themedHref, {
            priority: "interactive",
            kind: shouldUseDetailSwap(link) ? "detail" : "navigation",
          }).catch(() => {});
          prefetchLinkedPayload(themedHref, "interactive");
        });

        document.addEventListener("pointerdown", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const detail = target.closest(".detail-column");
          if (detail instanceof HTMLElement) {
            setEngagedDetailSurface(detail);
            return;
          }
          if (target.closest(".primary-column")) {
            clearEngagedDetailSurface();
          }
        });

        document.addEventListener("focusin", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const detail = target.closest(".detail-column");
          if (detail instanceof HTMLElement) {
            setEngagedDetailSurface(detail);
            return;
          }
          if (target.closest(".primary-column")) {
            clearEngagedDetailSurface();
          }
        });

        document.addEventListener("keydown", (event) => {
          const detail = focusedDetailSurface();
          if (detail && isDesktopViewport()) {
            const maxScrollTop = Math.max(0, detail.scrollHeight - detail.clientHeight);
            const pageStep = Math.max(160, detail.clientHeight - 72);
            if ((event.key === "PageDown" || event.key === " ") && detail.scrollTop < maxScrollTop) {
              event.preventDefault();
              detail.scrollTo({ top: Math.min(maxScrollTop, detail.scrollTop + pageStep), behavior: "auto" });
              return;
            }
            if (event.key === "PageUp" && detail.scrollTop > 0) {
              event.preventDefault();
              detail.scrollTo({ top: Math.max(0, detail.scrollTop - pageStep), behavior: "auto" });
              return;
            }
            if (event.key === "Home" && detail.scrollTop > 0) {
              event.preventDefault();
              detail.scrollTo({ top: 0, behavior: "auto" });
              return;
            }
            if (event.key === "End" && detail.scrollTop < maxScrollTop) {
              event.preventDefault();
              detail.scrollTo({ top: maxScrollTop, behavior: "auto" });
              return;
            }
          }

          const targetElement = event.target;
          const interactiveTag =
            targetElement instanceof HTMLElement ? targetElement.closest("input, textarea, select, [contenteditable='true']") : null;
          if (!event.metaKey && !event.ctrlKey && !event.altKey && !interactiveTag) {
            const action =
              event.key === "["
                ? document.querySelector("[data-nav-step='prev']")
                : event.key === "}" || (event.key === "]" && event.shiftKey)
                  ? document.querySelector("[data-nav-step='latest']")
                  : event.key === "]"
                    ? document.querySelector("[data-nav-step='next']")
                    : null;
            if (action instanceof HTMLAnchorElement) {
              event.preventDefault();
              action.click();
              return;
            }
            if (event.key === "Escape") {
              const closeLink = document.querySelector(".detail-column .close-link");
              if (closeLink instanceof HTMLAnchorElement) {
                event.preventDefault();
                closeLink.click();
                return;
              }
            }
          }

          const target = event.target;
          if (!(target instanceof HTMLTextAreaElement) || target.dataset.preferenceTextarea !== "true") return;
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            target.form?.requestSubmit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            target.value = target.defaultValue;
            syncPreferenceState();
            setEditing(false);
          }
        });

        document.addEventListener("wheel", (event) => {
          if (!isDesktopViewport() || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const hoveredDetail = target.closest(".detail-column");
          const detail = hoveredDetail instanceof HTMLElement && hoveredDetail.dataset.detailScrollActive === "true"
            ? hoveredDetail
            : focusedDetailSurface();
          if (!(detail instanceof HTMLElement)) return;
          if (!hoveredDetail && !target.closest(".primary-column")) return;
          const maxScrollTop = Math.max(0, detail.scrollHeight - detail.clientHeight);
          if (maxScrollTop <= 0) return;
          const canScrollDown = event.deltaY > 0 && detail.scrollTop < maxScrollTop;
          const canScrollUp = event.deltaY < 0 && detail.scrollTop > 0;
          if (!canScrollDown && !canScrollUp) return;
          event.preventDefault();
          detail.scrollTop = Math.min(maxScrollTop, Math.max(0, detail.scrollTop + event.deltaY));
        }, { passive: false });

        document.addEventListener("input", (event) => {
          const target = event.target;
          if (target instanceof HTMLTextAreaElement && target.dataset.preferenceTextarea === "true") {
            syncPreferenceState();
          }
        });

        document.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (!target.closest("[data-account-settings-shell='true']") && !target.closest("[data-account-settings-trigger='true']")) {
            closeAccountSettingsPopover(target);
          }
          if (target.closest("[data-preference-edit-toggle='true']")) {
            setEditing(true);
            return;
          }
          if (target.closest("[data-preference-cancel='true']")) {
            const textarea = document.querySelector("[data-preference-textarea='true']");
            if (textarea instanceof HTMLTextAreaElement) textarea.value = textarea.defaultValue;
            syncPreferenceState();
            setEditing(false);
            return;
          }
          const expandButton = target.closest("[data-preference-expand='true']");
          if (expandButton instanceof HTMLButtonElement) {
            const root = document.querySelector("[data-preference-card='true']");
            if (!(root instanceof HTMLElement)) return;
            const expanded = root.classList.toggle("is-expanded");
            expandButton.textContent = expanded ? "收起" : "展开更多";
          }
        });

        document.addEventListener("click", (event) => {
          if (isDesktopViewport()) return;
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const detailSurface = target.closest(".detail-column");
          if (!(detailSurface instanceof HTMLElement)) return;
          if (target.closest(".detail-surface-card")) return;
          const closeLink = detailSurface.querySelector(".close-link, [data-projects-close-link='true']");
          if (closeLink instanceof HTMLAnchorElement) {
            closeLink.click();
          }
        });

        document.addEventListener("keydown", (event) => {
          if (event.key !== "Escape") return;
          closeAccountSettingsPopover(null);
          setEditing(false);
        });

        window.addEventListener("popstate", () => {
          if (applyLocalProjectsDetail(window.location.href, "none")) return;
          void fetchAndApply(window.location.href, "route", "none");
        });

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", boot, { once: true });
        } else {
          boot();
        }
      })();
  `;
}

export function renderClientScript(): string {
  return `
    <script>
${renderClientScriptSource()}
    </script>
  `;
}
