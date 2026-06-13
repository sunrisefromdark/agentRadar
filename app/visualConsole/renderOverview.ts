export function renderOverviewRoute(args: {
  heroIntroHtml?: string;
  carouselHtml?: string;
  workspaceRailHtml?: string;
  workspacePanelsHtml?: string;
  heroHtml?: string;
  railHtml?: string;
  stripHtml?: string;
  spotlightHtml?: string;
  researchHtml?: string;
  dockHtml?: string;
}): string {
  const heroIntroHtml = args.heroIntroHtml ?? args.heroHtml ?? "";
  const carouselHtml = args.carouselHtml ?? `${args.stripHtml ?? ""}${args.spotlightHtml ?? ""}`;
  const workspaceRailHtml = args.workspaceRailHtml ?? args.railHtml ?? "";
  const workspacePanelsHtml = args.workspacePanelsHtml ?? `${args.researchHtml ?? ""}${args.dockHtml ?? ""}`;

  return [
    '<div class="route-console route-console-overview overview-homepage">',
    `<section class="overview-home-stage" data-home-stage="overview-hero">${heroIntroHtml}${carouselHtml}</section>`,
    workspaceRailHtml,
    `<section class="overview-workspace-stage">${workspacePanelsHtml}</section>`,
    "</div>",
  ].join("\n");
}
