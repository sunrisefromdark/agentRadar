import { renderSurfaceSection } from "./renderShared.ts";

export function renderWeeklyRoute(args: {
  hasDetail: boolean;
  heroHtml: string;
  railHtml: string;
  matrixHtml: string;
  coreHtml: string;
  noCoreAuditHtml: string;
  weakHtml: string;
  watchHtml: string;
  dockHtml: string;
}): string {
  return [
    `<div class="content-layout weekly-editor ${args.hasDetail ? "has-detail" : ""}">`,
    '  <div class="primary-column">',
    renderSurfaceSection({
      className: "weekly-hero-stage surface-hero-frame",
      surfaceId: "weekly-cover-stage",
      surfaceRole: "hero",
      body: args.heroHtml,
    }),
    renderSurfaceSection({
      className: "weekly-judgment-rail-surface surface-rail-frame",
      surfaceId: "weekly-judgment-rail",
      surfaceRole: "rail",
      body: args.railHtml,
    }),
    renderSurfaceSection({
      className: "weekly-matrix-stage surface-stage-frame",
      surfaceId: "weekly-evidence-matrix",
      surfaceRole: "stage",
      body: args.matrixHtml,
    }),
    args.coreHtml,
    args.noCoreAuditHtml,
    renderSurfaceSection({
      className: "weekly-weak-stage surface-strip-frame",
      surfaceId: "weekly-weak-signal-strip",
      surfaceRole: "strip",
      attributes: { "data-weekly-stage": "weak-signal-strip" },
      body: args.weakHtml,
    }),
    renderSurfaceSection({
      className: "weekly-watchpoints-stage surface-strip-frame",
      surfaceId: "weekly-watchpoints-strip",
      surfaceRole: "strip",
      attributes: { "data-weekly-stage": "watchpoints" },
      body: args.watchHtml,
    }),
    "  </div>",
    args.dockHtml,
    "</div>",
  ].join("\n");
}
