import { renderDockSurface, renderInlineReaderFocus, renderSurfaceSection } from "./renderShared.ts";

export function renderKnowledgeBaseRoute(args: {
  hasDetail: boolean;
  ribbonHtml?: string;
  indexHtml: string;
  dockHtml: string;
  detailAriaLabel: string;
  detailKey: string;
  inlineFocusHtml: string;
  emptyReaderHtml?: string;
  emptyDockHtml?: string;
}): string {
  return [
    `<div class="content-layout kb-route-frame ${args.hasDetail ? "has-detail" : ""}">`,
    '  <div class="primary-column">',
    args.ribbonHtml
      ? renderSurfaceSection({
          className: "kb-summary-surface surface-strip-frame",
          surfaceId: "kb-summary-strip",
          surfaceRole: "strip",
          body: args.ribbonHtml,
        })
      : "",
    renderSurfaceSection({
      className: "kb-index-stage surface-stage-frame",
      surfaceId: "kb-index-stage",
      surfaceRole: "stage",
      body: args.indexHtml,
    }),
    args.hasDetail
      ? ""
      : (args.emptyReaderHtml
          ? renderInlineReaderFocus("kb-inline-reader-focus", args.emptyReaderHtml)
          : ""),
    "  </div>",
    args.hasDetail
      ? renderDockSurface("kb-related-dock", args.dockHtml, {
          ariaLabel: args.detailAriaLabel,
          detailKey: args.detailKey,
        })
      : (args.emptyDockHtml
          ? renderDockSurface("kb-related-dock", args.emptyDockHtml, {
              ariaLabel: args.detailAriaLabel,
              detailKey: args.detailKey,
            })
          : ""),
    args.hasDetail ? renderInlineReaderFocus("kb-inline-reader-focus", args.inlineFocusHtml) : "",
    "</div>",
  ].join("\n");
}
