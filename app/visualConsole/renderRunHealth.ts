import { renderSurfaceSection } from "./renderShared.ts";

export function renderRunHealthRoute(args: {
  heroHtml: string;
  sourceHtml: string;
  auditHtml: string;
  actionsHtml: string;
}): string {
  return [
    '<div class="run-health-grid">',
    renderSurfaceSection({
      className: "run-health-trust-hero surface-hero-frame",
      surfaceId: "run-health-trust-hero",
      surfaceRole: "hero",
      body: args.heroHtml,
    }),
    renderSurfaceSection({
      className: "run-health-source-stage surface-stage-frame",
      surfaceId: "run-health-source-stage",
      surfaceRole: "stage",
      body: args.sourceHtml,
    }),
    renderSurfaceSection({
      className: "run-health-audit-stage surface-audit-frame",
      surfaceId: "run-health-audit-stage",
      surfaceRole: "audit",
      body: args.auditHtml,
    }),
    renderSurfaceSection({
      className: "run-health-actions-rail surface-rail-frame",
      surfaceId: "run-health-actions-rail",
      surfaceRole: "rail",
      body: args.actionsHtml,
    }),
    "</div>",
  ].join("\n");
}
