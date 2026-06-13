import { renderSurfaceSection } from "./renderShared.ts";

export function renderProjectsRoute(args: {
  heroHtml: string;
  hasDetail: boolean;
  filterHtml: string;
  rowsHtml: string;
  stageTopHtml?: string;
  stageBottomHtml?: string;
  dockHtml: string;
  emptyDockHtml?: string;
  railHtml?: string;
}): string {
  return [
    '<div class="projects-route-shell">',
    args.heroHtml,
    renderSurfaceSection({
      className: "projects-filter-strip-surface surface-strip-frame",
      surfaceId: "projects-filter-bench",
      surfaceRole: "strip",
      body: args.filterHtml,
    }),
    args.stageTopHtml ?? "",
    `<div class="content-layout projects-workbench ${args.hasDetail ? "has-detail" : ""}">`,
    '  <div class="primary-column">',
    renderSurfaceSection({
      className: "projects-scan-stage surface-stage-frame",
      surfaceId: "projects-scan-rows",
      surfaceRole: "stage",
      attributes: { "data-projects-stage": "scan-rows" },
      body: args.rowsHtml,
    }),
    "  </div>",
    args.hasDetail ? args.dockHtml : (args.emptyDockHtml ?? ""),
    "</div>",
    args.stageBottomHtml ?? "",
    "</div>",
  ].join("\n");
}
