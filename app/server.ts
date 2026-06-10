import http from "node:http";
import { loadRuntimeEnv } from "../src/env.ts";
import { configureGlobalNetworkProxy } from "../src/network/proxy.ts";
import { renderVisualConsole } from "../src/visualConsole/index.ts";

type ViewName = "overview" | "projects" | "weekly" | "run-health" | "observer" | "kb";

const DEFAULT_HOST = process.env.HOST?.trim() || "127.0.0.1";
const DEFAULT_PORT = Number(process.env.PORT || 3210);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeView(input: string | null): ViewName {
  const value = (input || "overview").trim();
  switch (value) {
    case "projects":
    case "weekly":
    case "run-health":
    case "observer":
    case "kb":
      return value;
    default:
      return "overview";
  }
}

function renderNav(currentView: ViewName, date: string): string {
  const items: Array<{ view: ViewName; label: string }> = [
    { view: "overview", label: "Overview" },
    { view: "projects", label: "Projects" },
    { view: "weekly", label: "Weekly" },
    { view: "run-health", label: "Run Health" },
    { view: "observer", label: "Observer" },
    { view: "kb", label: "Knowledge Base" },
  ];

  return items
    .map((item) => {
      const href = item.view === "weekly"
        ? `/?view=${item.view}&anchor-date=${encodeURIComponent(date)}`
        : `/?view=${item.view}&date=${encodeURIComponent(date)}`;
      const className = item.view === currentView ? "nav-link is-active" : "nav-link";
      return `<a class="${className}" href="${href}">${escapeHtml(item.label)}</a>`;
    })
    .join("");
}

function renderDocument(args: { view: ViewName; body: string; date: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AgentRadar OSS</title>
    <link rel="stylesheet" href="/styles.css" />
    <style>
      body { margin: 0; background: #f5f7fb; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .oss-shell { max-width: 1200px; margin: 0 auto; padding: 24px 20px 40px; }
      .oss-header { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 20px; }
      .oss-title { margin: 0; font-size: 28px; }
      .oss-subtitle { margin: 6px 0 0; color: #475569; font-size: 14px; }
      .oss-nav { display: flex; flex-wrap: wrap; gap: 8px; }
      .nav-link { text-decoration: none; color: #334155; border: 1px solid #cbd5e1; background: #fff; border-radius: 999px; padding: 8px 12px; font-size: 13px; }
      .nav-link.is-active { background: #0f172a; color: #fff; border-color: #0f172a; }
      .oss-panel { background: #fff; border: 1px solid #dbe3f0; border-radius: 20px; padding: 20px; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06); }
      .oss-meta { margin: 0 0 16px; color: #475569; font-size: 13px; }
      .oss-output { white-space: pre-wrap; word-break: break-word; line-height: 1.6; font-size: 13px; margin: 0; }
    </style>
  </head>
  <body>
    <div class="oss-shell">
      <header class="oss-header">
        <div>
          <h1 class="oss-title">AgentRadar OSS</h1>
          <p class="oss-subtitle">Read-only open-source console with no login or account system.</p>
        </div>
        <nav class="oss-nav">${renderNav(args.view, args.date)}</nav>
      </header>
      <section class="oss-panel">
        <p class="oss-meta">view=${escapeHtml(args.view)} date=${escapeHtml(args.date)}</p>
        <pre class="oss-output">${escapeHtml(args.body)}</pre>
      </section>
    </div>
  </body>
</html>`;
}

function serveStyles(response: http.ServerResponse): void {
  const css = [
    "body { min-height: 100vh; }",
    ".button-link, .tab-btn { font: inherit; }",
  ].join("\n");
  response.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=300" });
  response.end(css);
}

function startServer(): void {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (url.pathname === "/styles.css") {
      serveStyles(response);
      return;
    }

    if (url.pathname === "/healthz") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url.pathname !== "/") {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found.\n");
      return;
    }

    const view = normalizeView(url.searchParams.get("view"));
    const date = url.searchParams.get("date") || url.searchParams.get("anchor-date") || "latest";
    const output = renderVisualConsole({
      view,
      date,
      anchorDate: url.searchParams.get("anchor-date") || undefined,
      project: url.searchParams.get("project") || undefined,
      slug: url.searchParams.get("slug") || undefined,
      trendKey: url.searchParams.get("trend-key") || undefined,
      sourceView: (url.searchParams.get("source-view") as "overview" | "projects" | "weekly" | null) || undefined,
    });

    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(renderDocument({ view, body: output, date }));
  });

  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log("visual-console:web");
    console.log(`Local:   http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
  });
}

loadRuntimeEnv(process.cwd(), { overrideProcessEnv: true });
configureGlobalNetworkProxy();
startServer();
