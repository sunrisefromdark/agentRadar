import type { EvidenceAnchorModel, RouteFrameModel } from "../../src/visualConsole/types.ts";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderAttributes(attributes: Record<string, string | undefined>): string {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}="${escapeHtml(value)}"`)
    .join("");
}

export function renderPageFrame(
  frame: string,
  body: string,
  attributes: Record<string, string | undefined> = {},
): string {
  return `<section data-page-frame="${escapeHtml(frame)}"${renderAttributes(attributes)}>${body}</section>`;
}

export function renderRouteFrame(frame: RouteFrameModel, body: string): string {
  return `<div class="route-frame route-frame-${escapeHtml(frame.route)} is-tablet-single-stage" data-route-frame="${escapeHtml(frame.route)}">${body}</div>`;
}

export function renderContentStage(body: string): string {
  return renderPageFrame(
    "content-stage",
    `<main class="primary-content content-stage" aria-label="Primary Content">${body}</main>`,
    {
      class: "page-frame page-frame-content-stage",
      "data-surface-role": "stage",
    },
  );
}

export function renderConsoleRibbon(body: string): string {
  return `<section class="console-ribbon" data-console-ribbon="primary">${body}</section>`;
}

export function renderConsoleGrid(kind: "analysis" | "workbench", body: string): string {
  return `<section class="console-grid console-grid-${escapeHtml(kind)}" data-console-grid="${escapeHtml(kind)}">${body}</section>`;
}

export function renderConsoleSurface(
  kind: "main-canvas" | "secondary-canvas" | "workbench",
  body: string,
  className: string,
): string {
  return `<section class="${escapeHtml(className)}" data-console-surface="${escapeHtml(kind)}">${body}</section>`;
}

export function renderSurfaceSection(args: {
  tag?: "section" | "div" | "aside" | "article";
  className?: string;
  surfaceId: string;
  surfaceRole: string;
  body: string;
  attributes?: Record<string, string | undefined>;
}): string {
  const tag = args.tag ?? "section";
  return `<${tag} class="${escapeHtml(args.className ?? "")}" data-surface-id="${escapeHtml(args.surfaceId)}" data-surface-role="${escapeHtml(args.surfaceRole)}"${renderAttributes(args.attributes ?? {})}>${args.body}</${tag}>`;
}

export function renderReaderSurface(
  surfaceId: string,
  body: string,
  attributes: Record<string, string | undefined> = {},
): string {
  return renderSurfaceSection({
    className: "panel reader-frame",
    surfaceId,
    surfaceRole: "reader",
    body,
    attributes,
  });
}

export function renderRailSurface(
  surfaceId: string,
  body: string,
  attributes: Record<string, string | undefined> = {},
): string {
  return renderSurfaceSection({
    className: "panel route-rail route-rail-surface is-collapsed",
    surfaceId,
    surfaceRole: "rail",
    body,
    attributes,
  });
}

export function renderDockSurface(
  surfaceId: string,
  body: string,
  options: {
    ariaLabel?: string;
    detailKey?: string;
    className?: string;
    attributes?: Record<string, string | undefined>;
  } = {},
): string {
  return renderSurfaceSection({
    tag: "aside",
    className: `detail-column focus-layer reader-dock is-mobile-fullscreen ${options.className ?? ""}`.trim(),
    surfaceId,
    surfaceRole: "dock",
    body,
    attributes: {
      "data-detail-column": "true",
      "data-detail-key": options.detailKey ?? surfaceId,
      "aria-label": options.ariaLabel ?? "Detail Surface",
      tabindex: "-1",
      ...(options.attributes ?? {}),
    },
  });
}

export function renderInlineReaderFocus(
  surfaceId: string,
  body: string,
  attributes: Record<string, string | undefined> = {},
): string {
  return renderSurfaceSection({
    className: "reader-inline-focus",
    surfaceId,
    surfaceRole: "reader",
    body,
    attributes: {
      "data-inline-reader-focus": "true",
      ...attributes,
    },
  });
}

export function renderEvidenceAnchor(anchor: EvidenceAnchorModel): string {
  return `<a class="evidence-anchor" data-evidence-anchor="true" href="${escapeHtml(anchor.href)}"><span class="anchor-code">${escapeHtml(anchor.code)}</span>${escapeHtml(anchor.label)}</a>`;
}
