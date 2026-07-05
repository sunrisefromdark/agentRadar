import { describe, expect, it } from "vitest";
import { renderClientScriptSource } from "../../app/visualConsole/clientScript.ts";
import { renderDocument } from "../../app/visualConsole/ossDocument.ts";
import { renderPrimary } from "../../app/visualConsole/ossPages.ts";
import { buildRoute, normalizeRoutePath, routeTitle, toViewHref } from "../../app/visualConsole/ossRouting.ts";

describe("AgentReach visual-console route", () => {
  it("registers /agentreach as an independent route with Chinese nav copy", () => {
    expect(normalizeRoutePath("/agentreach")).toBe("agentreach");
    expect(routeTitle("agentreach", "zh")).toBe("外部发现");
    expect(toViewHref("agentreach", "zh", "light", { date: "2026-06-29", source_view: "observer" })).toBe(
      "/agentreach?lang=zh&theme=light&date=2026-06-29&source_view=observer",
    );
  });

  it("places 外部发现 immediately after 新兴潜力项目 in the shell nav", () => {
    const requestUrl = new URL("http://localhost/agentreach?lang=zh&theme=light&date=2026-06-29");
    const rendered = buildRoute("agentreach", requestUrl);
    const html = renderDocument(rendered, requestUrl, "zh", "light", renderPrimary(rendered, requestUrl, "zh", "light"));
    const navStart = html.indexOf('<nav class="homepage-primary-nav');
    const navEnd = html.indexOf("</nav>", navStart);
    const navHtml = html.slice(navStart, navEnd);

    expect(rendered.route).toBe("agentreach");
    expect(navHtml.indexOf("新兴潜力项目")).toBeGreaterThan(-1);
    expect(navHtml.indexOf("外部发现")).toBeGreaterThan(navHtml.indexOf("新兴潜力项目"));
    expect(html).toContain('id="agentreach-react-root"');
    expect(navHtml).not.toContain(">AgentReach</a>");
  });

  it("keeps client navigation and payload prefetch aware of the AgentReach route", () => {
    const script = renderClientScriptSource();

    expect(script).toContain('"/agentreach"');
    expect(script).toContain('"agentreach"');
    expect(script).toContain("agentreach-react-payload");
    expect(script).toContain("__AGENTREACH_INITIAL_DATA__");
  });
});
