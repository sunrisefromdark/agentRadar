export type ProjectsWorkbenchSortMode = "score" | "growth";

export interface ProjectsWorkbenchState {
  search: string;
  sort: ProjectsWorkbenchSortMode;
  paradigm: string;
  persistence: string;
  page?: number;
  pageSize?: number;
}

export interface ProjectsWorkbenchCardRecord {
  searchName: string;
  searchDescription: string;
  searchMeta: string;
  score: number;
  growth: number;
  order: number;
  paradigm: string;
  persistence: string;
}

export interface ProjectsWorkbenchPagination<T> {
  items: T[];
  currentPage: number;
  pageCount: number;
  pageSize: number;
  totalCount: number;
  startIndex: number;
  endIndex: number;
}

export function normalizeProjectSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenizeProjectSearchText(value: string): string[] {
  return normalizeProjectSearchText(value)
    .split(/[\s,.;:!?()[\]{}"'`]+/)
    .filter(Boolean);
}

function scoreProjectSearchField(
  value: string,
  query: string,
  queryTokens: string[],
  weights: { exact: number; prefix: number; substring: number; tokenExact: number; tokenPrefix: number; tokenSubstring: number },
): number {
  const normalizedValue = normalizeProjectSearchText(value);
  if (!normalizedValue) return 0;

  let score = 0;
  if (normalizedValue === query) score += weights.exact;
  else if (normalizedValue.startsWith(query)) score += weights.prefix;
  else if (normalizedValue.includes(query)) score += weights.substring;

  const valueTokens = tokenizeProjectSearchText(normalizedValue);
  queryTokens.forEach((token) => {
    if (valueTokens.includes(token)) score += weights.tokenExact;
    else if (valueTokens.some((candidate) => candidate.startsWith(token))) score += weights.tokenPrefix;
    else if (valueTokens.some((candidate) => candidate.includes(token))) score += weights.tokenSubstring;
  });

  return score;
}

export function rankProjectSearchMatch(card: Pick<ProjectsWorkbenchCardRecord, "searchName" | "searchDescription" | "searchMeta">, query: string): number {
  const normalizedQuery = normalizeProjectSearchText(query);
  if (!normalizedQuery) return 0;

  const queryTokens = tokenizeProjectSearchText(normalizedQuery);
  return (
    scoreProjectSearchField(card.searchName, normalizedQuery, queryTokens, {
      exact: 1600,
      prefix: 1300,
      substring: 1050,
      tokenExact: 320,
      tokenPrefix: 240,
      tokenSubstring: 170,
    }) +
    scoreProjectSearchField(card.searchDescription, normalizedQuery, queryTokens, {
      exact: 520,
      prefix: 420,
      substring: 320,
      tokenExact: 140,
      tokenPrefix: 100,
      tokenSubstring: 70,
    }) +
    scoreProjectSearchField(card.searchMeta, normalizedQuery, queryTokens, {
      exact: 260,
      prefix: 200,
      substring: 150,
      tokenExact: 90,
      tokenPrefix: 60,
      tokenSubstring: 45,
    })
  );
}

export function filterAndSortProjectCards<T extends ProjectsWorkbenchCardRecord>(cards: T[], state: ProjectsWorkbenchState): T[] {
  const normalizedSearch = normalizeProjectSearchText(state.search);

  return cards
    .filter((card) => {
      const relevance = normalizedSearch ? rankProjectSearchMatch(card, normalizedSearch) : 0;
      const matchesSearch = !normalizedSearch || relevance > 0;
      const matchesParadigm = state.paradigm === "all" || card.paradigm === state.paradigm;
      const matchesPersistence = state.persistence === "all" || card.persistence === state.persistence;
      return matchesSearch && matchesParadigm && matchesPersistence;
    })
    .sort((left, right) => {
      if (normalizedSearch) {
        const leftRelevance = rankProjectSearchMatch(left, normalizedSearch);
        const rightRelevance = rankProjectSearchMatch(right, normalizedSearch);
        if (rightRelevance !== leftRelevance) return rightRelevance - leftRelevance;
      }
      const leftValue = state.sort === "growth" ? left.growth : left.score;
      const rightValue = state.sort === "growth" ? right.growth : right.score;
      if (rightValue !== leftValue) return rightValue - leftValue;
      return left.order - right.order;
    })
    .map((card) => card);
}

export function paginateProjectCards<T>(cards: T[], page: number, pageSize: number): ProjectsWorkbenchPagination<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize) || 1);
  const totalCount = cards.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / safePageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * safePageSize;
  const endIndex = totalCount === 0 ? 0 : Math.min(startIndex + safePageSize, totalCount);

  return {
    items: cards.slice(startIndex, endIndex),
    currentPage,
    pageCount,
    pageSize: safePageSize,
    totalCount,
    startIndex,
    endIndex,
  };
}

export function renderClientScriptSource(): string {
  return `
      (() => {
        if (window.__visualConsoleClientBound) return;
        window.__visualConsoleClientBound = true;
        const normalizeProjectSearchText = ${normalizeProjectSearchText.toString()};
        const tokenizeProjectSearchText = ${tokenizeProjectSearchText.toString()};
        const scoreProjectSearchField = ${scoreProjectSearchField.toString()};
        const rankProjectSearchMatch = ${rankProjectSearchMatch.toString()};
        const filterAndSortProjectCards = ${filterAndSortProjectCards.toString()};
        const paginateProjectCards = ${paginateProjectCards.toString()};

        const scrollKey = "visual-console-scroll-target";
        const routes = new Set(["/overview", "/projects", "/weekly", "/run-health", "/observer", "/kb"]);
        const reactRuntimeRoutes = new Set(["overview", "weekly", "run-health", "observer"]);
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

          const state = {
            search: search.value,
            sort: "score",
            paradigm: "all",
            persistence: "all",
            page: 1,
            pageSize: Math.max(1, Number(root.getAttribute("data-projects-page-size") || "15") || 15),
          };

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

          const apply = () => {
            const cards = Array.from(document.querySelectorAll("[data-project-card='true']")).filter((card) => card instanceof HTMLElement);
            const lane = document.querySelector("[data-projects-lane='true']");
            const count = document.querySelector("[data-projects-count='true']");
            const emptyState = document.querySelector("[data-projects-empty='true']");
            if (!(lane instanceof HTMLElement)) return;

            const filteredCards = filterAndSortProjectCards(
              cards.map((card) => ({
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
                paradigm: card.dataset.projectParadigm || "",
                persistence: card.dataset.projectPersistence || "",
              })),
              state,
            );
            const page = paginateProjectCards(filteredCards, state.page, state.pageSize);
            const visibleCards = page.items;
            state.page = page.currentPage;

            cards.forEach((card) => {
              card.hidden = true;
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

            const activeProject = decodeURIComponent(new URL(window.location.href).searchParams.get("project") || "").trim().toLowerCase();
            if (activeProject) {
              const selectedStillVisible = visibleCards.some((card) => (card.element.dataset.projectName || "").trim().toLowerCase() === activeProject);
              if (!selectedStillVisible) {
                closeDetailForHiddenSelection();
              }
            }

            setOptionState(sortOptions, state.sort, "data-projects-sort-option");
            syncSortDropdown();
            setOptionState(paradigmOptions, state.paradigm, "data-projects-paradigm-option");
            setOptionState(persistenceOptions, state.persistence, "data-projects-persistence-option");
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
          bindAutoHideNav();
          bindPremiumNav();
          bindTopProjectCarousel();
          bindOverviewWorkspaceRail();
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
