import { renderContentStage, renderPageFrame } from "./renderShared.ts";

export function renderShellFrame(args: {
  headerHtml: string;
  contextBarHtml: string;
  bannerHtml: string;
  routeFrameHtml: string;
}): string {
  const headerChrome = args.headerHtml
    ? renderPageFrame(
        "top-nav-shell",
        `<div class="top-nav-shell" data-console-shell="top-nav">${args.headerHtml}</div>`,
        {
          class: "page-frame page-frame-top-nav-shell",
          "data-surface-role": "shell",
        },
      )
    : "";
  const shellChrome = args.contextBarHtml || args.bannerHtml
    ? `
      <section class="shell-main shell-ops">${args.contextBarHtml}${args.bannerHtml}</section>
    `
    : "";

  return [
    '  <div class="app-shell app-shell-console">',
    '    <div class="atmosphere-layer" data-atmosphere-layer="paper-frame" aria-hidden="true"></div>',
    '    <div class="atmosphere-layer atmosphere-layer-grid" data-atmosphere-layer="instrument-grid" aria-hidden="true"></div>',
    headerChrome,
    renderContentStage(`
      <div class="route-console-shell">
        ${shellChrome}
        ${args.routeFrameHtml}
      </div>
    `),
    "  </div>",
  ].join("\n");
}
