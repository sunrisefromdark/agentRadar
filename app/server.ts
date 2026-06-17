import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { loadConfig } from "../src/config.ts";
import { loadRuntimeEnv } from "../src/env.ts";
import { configureGlobalNetworkProxy } from "../src/network/proxy.ts";
import { buildEndpointErrorFuzzyResponse, searchFuzzyProjects, type FuzzySearchCache } from "../src/search/fuzzyProjectSearchService.ts";
import type { FuzzyProjectSearchRequest, FuzzyProjectSearchResponse } from "../src/search/fuzzyQueryTypes.ts";
import { FUZZY_SEARCH_RESPONSE_SCHEMA_VERSION } from "../src/search/fuzzyQueryTypes.ts";
import { buildProjectsView } from "../src/visualConsole/build.ts";
import { renderDocument } from "./visualConsole/ossDocument.ts";
import { buildProjectsLocalDetailPayload } from "./visualConsole/ossProjectsPage.ts";
import {
  buildObserverReactProps,
  buildOverviewReactProps,
  buildRunHealthReactProps,
  buildWeeklyReactProps,
  renderPrimary,
} from "./visualConsole/ossPages.ts";
import { buildRoute, normalizeLang, normalizeRoutePath, normalizeTheme, toViewHref } from "./visualConsole/ossRouting.ts";
import type { RenderedRoute, UiLang, UiTheme } from "./visualConsole/ossTypes.ts";

const DEFAULT_HOST = process.env.HOST?.trim() || "127.0.0.1";
const DEFAULT_PORT = Number(process.env.PORT || 3210);
const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(APP_DIR, "client");
const STYLE_PATH = path.join(APP_DIR, "styles.css");
const STYLE_CACHE_CONTROL = "public, max-age=300";
const CLIENT_ROUTE_PREFIX = "/app-client/";
const CLIENT_MOUNT_ROUTE = `${CLIENT_ROUTE_PREFIX}mount.js`;

type CachedClientModule = {
  mtimeMs: number;
  size: number;
  value: string;
};

export interface VisualConsoleServerOptions {
  buildProjectsView?: typeof buildProjectsView;
  loadConfig?: typeof loadConfig;
  searchFuzzyProjects?: typeof searchFuzzyProjects;
}

const defaultServerOptions: Required<VisualConsoleServerOptions> = {
  buildProjectsView,
  loadConfig,
  searchFuzzyProjects,
};
const cachedClientModules = new Map<string, CachedClientModule>();
const fuzzySearchCache: FuzzySearchCache = new Map();

function renderStyleAsset(): string {
  return fs.readFileSync(STYLE_PATH, "utf-8");
}

function serializeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function routeRequiresClientReactRuntime(route: RenderedRoute["route"]): boolean {
  return route === "overview" || route === "observer" || route === "weekly" || route === "run-health";
}

function renderReactImportMap(): string {
  return [
    '    <script type="importmap">',
    serializeJsonForHtml({
      imports: {
        react: "https://esm.sh/react@19.2.0",
        "react/jsx-runtime": "https://esm.sh/react@19.2.0/jsx-runtime",
        "react-dom/client": "https://esm.sh/react-dom@19.2.0/client?external=react",
      },
    }),
    "    </script>",
  ].join("\n");
}

function rewriteClientModuleSpecifiers(source: string): string {
  return source
    .replace(/((?:import|export)\s[^"'`]*?\sfrom\s*["'])([^"']+)\.(ts|tsx)(["'])/g, "$1$2.js$4")
    .replace(/(import\s*\(\s*["'])([^"']+)\.(ts|tsx)(["']\s*\))/g, "$1$2.js$4");
}

function transpileClientModule(sourcePath: string): string {
  const stats = fs.statSync(sourcePath);
  const cached = cachedClientModules.get(sourcePath);
  if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
    return cached.value;
  }

  const source = fs.readFileSync(sourcePath, "utf-8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowImportingTsExtensions: true,
    },
    fileName: sourcePath,
  });
  const value = rewriteClientModuleSpecifiers(transpiled.outputText);
  cachedClientModules.set(sourcePath, {
    mtimeMs: stats.mtimeMs,
    size: stats.size,
    value,
  });
  return value;
}

function resolveClientAssetSourcePath(safePath: string): string | null {
  const directPath = path.join(CLIENT_DIR, safePath);
  if (directPath.startsWith(CLIENT_DIR) && fs.existsSync(directPath)) {
    return directPath;
  }

  if (safePath.endsWith(".js")) {
    for (const extension of [".ts", ".tsx"]) {
      const candidate = path.join(CLIENT_DIR, safePath.replace(/\.js$/u, extension));
      if (candidate.startsWith(CLIENT_DIR) && fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function respondJavaScript(response: http.ServerResponse, code: string): void {
  response.writeHead(200, { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" });
  response.end(code);
}

function handleClientAsset(requestUrl: URL, response: http.ServerResponse): boolean {
  if (!requestUrl.pathname.startsWith(CLIENT_ROUTE_PREFIX)) return false;

  const relativePath = requestUrl.pathname.slice(CLIENT_ROUTE_PREFIX.length);
  const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const sourcePath = resolveClientAssetSourcePath(safePath);

  if (!sourcePath) {
    respondText(response, 404, "Not found.\n");
    return true;
  }

  respondJavaScript(response, transpileClientModule(sourcePath));
  return true;
}

function resolveHydrationPayloadScripts(rendered: RenderedRoute, requestUrl: URL, lang: UiLang, theme: UiTheme): string {
  const payloads: Array<{ id: string; value: unknown | null }> = [
    {
      id: "projects-detail-payload",
      value: rendered.route === "projects" ? buildProjectsLocalDetailPayload(rendered.model, requestUrl, lang) : null,
    },
    {
      id: "overview-react-payload",
      value: rendered.route === "overview" ? buildOverviewReactProps(rendered.model, requestUrl, lang, theme) : null,
    },
    {
      id: "weekly-react-payload",
      value: rendered.route === "weekly" ? buildWeeklyReactProps(rendered.model, requestUrl, lang, theme) : null,
    },
    {
      id: "run-health-react-payload",
      value: rendered.route === "run-health" ? buildRunHealthReactProps(rendered.model, lang) : null,
    },
    {
      id: "observer-react-payload",
      value: rendered.route === "observer" ? buildObserverReactProps(rendered.model, requestUrl, lang, theme) : null,
    },
  ];

  return payloads
    .filter((entry) => entry.value !== null)
    .map((entry) => `    <script id="${entry.id}" type="application/json" charset="utf-8">${serializeJsonForHtml(entry.value)}</script>`)
    .join("\n");
}

function redirect(response: http.ServerResponse, location: string): void {
  response.writeHead(302, { location, "cache-control": "no-store" });
  response.end();
}

function respondHtml(response: http.ServerResponse, html: string): void {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(html);
}

function respondText(response: http.ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  response.end(body);
}

function respondJson(response: http.ServerResponse, payload: unknown): void {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

function respondJsonStatus(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request: http.IncomingMessage, maxBytes = 64 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error("request_body_too_large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseFuzzyProjectSearchRequest(payload: unknown): FuzzyProjectSearchRequest | null {
  const raw = asRecord(payload);
  const rawQuery = typeof raw.raw_query === "string" ? raw.raw_query : typeof raw.query === "string" ? raw.query : "";
  if (!rawQuery.trim()) return null;
  const filters = asRecord(raw.filters);
  const pageContext = asRecord(raw.page_context);
  return {
    raw_query: rawQuery,
    date: typeof raw.date === "string" ? raw.date : undefined,
    lang: raw.lang === "en" ? "en" : "zh",
    filters: {
      paradigm: typeof filters.paradigm === "string" ? filters.paradigm : undefined,
      persistence: typeof filters.persistence === "string" ? filters.persistence : undefined,
    },
    sort: raw.sort === "growth" ? "growth" : "score",
    page_context: {
      page: typeof pageContext.page === "number" ? pageContext.page : undefined,
      page_size: typeof pageContext.page_size === "number" ? pageContext.page_size : undefined,
      path: typeof pageContext.path === "string" ? pageContext.path : undefined,
    },
  };
}

function emptyEndpointErrorResponse(request: FuzzyProjectSearchRequest): FuzzyProjectSearchResponse {
  return {
    schema_version: FUZZY_SEARCH_RESPONSE_SCHEMA_VERSION,
    raw_query: request.raw_query,
    normalized_query: request.raw_query.trim().toLowerCase().replace(/\s+/g, " "),
    source: "llm_failed_fallback",
    result_mode: "hot_projects",
    project_ids: [],
    explanation_cn: "项目搜索解释暂不可用，先展示当前热门项目。",
    clarification_options: [],
    diagnostics: {
      direct_result_count: 0,
      llm_triggered: true,
      cache_status: "bypass",
      decision: "hot_only",
      expanded_query_count: 0,
      expanded_result_count: 0,
      unsupported_filters: [],
      fallback_reason: "endpoint_error",
    },
  };
}

async function handleFuzzySearchApiRequest(request: http.IncomingMessage, response: http.ServerResponse, options: Required<VisualConsoleServerOptions>): Promise<void> {
  if (request.method !== "POST") {
    respondJsonStatus(response, 405, { error: "method_not_allowed", message: "POST required." });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await readRequestBody(request) || "{}");
  } catch {
    respondJsonStatus(response, 400, { error: "invalid_fuzzy_search_request", message: "Request body must be valid JSON." });
    return;
  }

  const fuzzyRequest = parseFuzzyProjectSearchRequest(payload);
  if (!fuzzyRequest) {
    respondJsonStatus(response, 400, { error: "invalid_fuzzy_search_request", message: "raw_query must be a non-empty string." });
    return;
  }

  let view;
  try {
    view = options.buildProjectsView(fuzzyRequest.date ?? "latest");
    const config = options.loadConfig();
    respondJson(
      response,
      await options.searchFuzzyProjects({
        request: fuzzyRequest,
        view,
        llm: config.llm,
        cache: fuzzySearchCache,
      }),
    );
  } catch {
    try {
      view ??= options.buildProjectsView(fuzzyRequest.date ?? "latest");
      respondJson(response, buildEndpointErrorFuzzyResponse(fuzzyRequest, view));
    } catch {
      respondJson(response, emptyEndpointErrorResponse(fuzzyRequest));
    }
  }
}

async function handleVisualConsoleRequest(request: http.IncomingMessage, response: http.ServerResponse, options: Required<VisualConsoleServerOptions>): Promise<void> {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (handleClientAsset(requestUrl, response)) {
      return;
    }

    if (requestUrl.pathname === "/styles.css") {
      response.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": STYLE_CACHE_CONTROL });
      response.end(renderStyleAsset());
      return;
    }

    if (requestUrl.pathname === "/healthz") {
      respondJson(response, { ok: true });
      return;
    }

    if (requestUrl.pathname === "/api/projects/fuzzy-search") {
      await handleFuzzySearchApiRequest(request, response, options);
      return;
    }

    if (requestUrl.pathname === "/") {
      redirect(
        response,
        toViewHref(
          "overview",
          normalizeLang(requestUrl.searchParams.get("lang")),
          normalizeTheme(requestUrl.searchParams.get("theme")),
          { date: requestUrl.searchParams.get("date") || "latest" },
        ),
      );
      return;
    }

    const route = normalizeRoutePath(requestUrl.pathname);
    if (!route) {
      respondText(response, 404, "Not found.\n");
      return;
    }

    const lang = normalizeLang(requestUrl.searchParams.get("lang"));
    const theme = normalizeTheme(requestUrl.searchParams.get("theme"));
    const rendered = buildRoute(route, requestUrl);
    const routeFrameHtml = renderPrimary(rendered, requestUrl, lang, theme);
    const includeReactRuntime = routeRequiresClientReactRuntime(rendered.route);
    respondHtml(
      response,
      renderDocument(rendered, requestUrl, lang, theme, routeFrameHtml, {
        reactImportMapHtml: includeReactRuntime ? renderReactImportMap() : "",
        reactMountScriptHtml: includeReactRuntime ? `    <script type="module" src="${CLIENT_MOUNT_ROUTE}"></script>` : "",
        payloadScriptsHtml: resolveHydrationPayloadScripts(rendered, requestUrl, lang, theme),
      }),
    );
}

export function createVisualConsoleServer(options: VisualConsoleServerOptions = {}): http.Server {
  const resolvedOptions = {
    ...defaultServerOptions,
    ...options,
  };
  return http.createServer((request, response) => {
    void handleVisualConsoleRequest(request, response, resolvedOptions).catch(() => {
      if (!response.headersSent) {
        respondText(response, 500, "Internal server error.\n");
      } else {
        response.end();
      }
    });
  });
}

export function startServer(): void {
  const server = createVisualConsoleServer();
  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log("visual-console:web");
    console.log(`Local:   http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  loadRuntimeEnv(process.cwd(), { overrideProcessEnv: true });
  configureGlobalNetworkProxy();
  startServer();
}
