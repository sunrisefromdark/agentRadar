import {
  buildKnowledgeBaseView,
  buildObserverView,
  buildOverviewView,
  buildProjectsView,
  buildRunHealthView,
  buildWeeklyView,
} from "./build.ts";
import {
  renderKnowledgeBaseView,
  renderObserverView,
  renderOverviewView,
  renderProjectsView,
  renderRunHealthView,
  renderWeeklyView,
} from "./render.ts";

export interface VisualConsoleRequest {
  view: "overview" | "projects" | "weekly" | "run-health" | "observer" | "knowledge-base" | "kb";
  date?: string;
  anchorDate?: string;
  project?: string;
  slug?: string;
  trendKey?: string;
  sourceView?: "overview" | "projects" | "weekly";
}

export function renderVisualConsole(request: VisualConsoleRequest): string {
  switch (request.view) {
    case "overview":
      return renderOverviewView(buildOverviewView(request.date ?? "latest"));
    case "projects":
      return renderProjectsView(
        buildProjectsView(request.date ?? "latest", request.project, {
          source_view: request.sourceView ?? (request.trendKey ? "weekly" : "projects"),
          date: request.date ?? null,
          window_end: request.anchorDate ?? null,
          trend_key: request.trendKey ?? null,
        }),
      );
    case "weekly":
      return renderWeeklyView(buildWeeklyView(request.anchorDate ?? request.date ?? "latest"));
    case "run-health":
      return renderRunHealthView(buildRunHealthView(request.date ?? "latest"));
    case "observer":
      return renderObserverView(buildObserverView(request.date ?? "latest"));
    case "kb":
    case "knowledge-base":
      return renderKnowledgeBaseView(buildKnowledgeBaseView(request.slug, request.project, request.date ?? "latest"));
    default:
      return "Unknown visual console view.";
  }
}
