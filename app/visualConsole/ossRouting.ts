import {
  buildKnowledgeBaseView,
  buildObserverView,
  buildOverviewView,
  buildProjectsView,
  buildRunHealthView,
  buildWeeklyView,
} from "../../src/visualConsole/build.ts";
import { copy } from "./ossCopy.ts";
import type { RenderedRoute, UiLang, UiTheme, WebRoute } from "./ossTypes.ts";

export function normalizeLang(input: string | null): UiLang {
  return input === "en" ? "en" : "zh";
}

export function normalizeTheme(input: string | null): UiTheme {
  return input === "dark" ? "dark" : "light";
}

export function normalizeRoutePath(pathname: string): WebRoute | null {
  switch (pathname) {
    case "/overview":
      return "overview";
    case "/projects":
      return "projects";
    case "/weekly":
      return "weekly";
    case "/run-health":
      return "run-health";
    case "/observer":
      return "observer";
    case "/kb":
      return "kb";
    default:
      return null;
  }
}

export function encodeParams(params: Record<string, string | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function toViewHref(
  route: WebRoute,
  lang: UiLang,
  theme: UiTheme,
  params: Record<string, string | undefined | null> = {},
): string {
  const baseParams = { lang, theme, ...params };
  switch (route) {
    case "overview":
      return `/overview${encodeParams(baseParams)}`;
    case "projects":
      return `/projects${encodeParams(baseParams)}`;
    case "weekly":
      return `/weekly${encodeParams(baseParams)}`;
    case "run-health":
      return `/run-health${encodeParams(baseParams)}`;
    case "observer":
      return `/observer${encodeParams(baseParams)}`;
    case "kb":
      return `/kb${encodeParams(baseParams)}`;
  }
}

export function collectCurrentRouteParams(route: WebRoute, requestUrl: URL): Record<string, string | undefined | null> {
  return {
    date: requestUrl.searchParams.get("date"),
    anchor: route === "weekly" ? requestUrl.searchParams.get("anchor") ?? requestUrl.searchParams.get("anchor-date") : undefined,
    project: requestUrl.searchParams.get("project"),
    slug: requestUrl.searchParams.get("slug"),
    trend_key: requestUrl.searchParams.get("trend_key") ?? requestUrl.searchParams.get("trend-key"),
    source_view: requestUrl.searchParams.get("source_view") ?? requestUrl.searchParams.get("source-view"),
  };
}

export function routeTitle(route: WebRoute, lang: UiLang): string {
  const ui = copy(lang);
  switch (route) {
    case "projects":
      return ui.navProjects;
    case "weekly":
      return ui.navWeekly;
    case "run-health":
      return ui.navRunHealth;
    case "observer":
      return ui.navObserver;
    case "kb":
      return ui.navKb;
    default:
      return ui.navOverview;
  }
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildRoute(route: WebRoute, requestUrl: URL): RenderedRoute {
  const date = requestUrl.searchParams.get("date") || "latest";
  const anchor = requestUrl.searchParams.get("anchor") || requestUrl.searchParams.get("anchor-date");
  const trendKey = requestUrl.searchParams.get("trend_key") || requestUrl.searchParams.get("trend-key");
  const sourceView = requestUrl.searchParams.get("source_view") || requestUrl.searchParams.get("source-view");
  switch (route) {
    case "projects":
      return {
        route,
        model: buildProjectsView(date, requestUrl.searchParams.get("project") || undefined, {
          source_view: (sourceView as "overview" | "projects" | "weekly" | null) || "projects",
          date,
          window_end: anchor,
          trend_key: trendKey,
        }),
      };
    case "weekly":
      return {
        route,
        model: buildWeeklyView(anchor || date),
      };
    case "run-health":
      return { route, model: buildRunHealthView(date) };
    case "observer":
      return { route, model: buildObserverView(date) };
    case "kb":
      return {
        route,
        model: buildKnowledgeBaseView(
          requestUrl.searchParams.get("slug") || undefined,
          requestUrl.searchParams.get("project") || undefined,
          date,
        ),
      };
    default:
      return { route: "overview", model: buildOverviewView(date) };
  }
}
