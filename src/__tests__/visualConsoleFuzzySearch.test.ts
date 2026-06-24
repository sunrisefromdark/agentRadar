import { describe, expect, it } from "vitest";
import { renderClientScriptSource } from "../../app/visualConsole/clientScript.ts";
import { renderProjectsWorkbenchPage } from "../../app/visualConsole/ossProjectsPage.ts";
import { buildProjectsView } from "../visualConsole/build.ts";

describe("visual console fuzzy project search", () => {
  it("renders the fuzzy status surface without changing project fact fields", () => {
    const html = renderProjectsWorkbenchPage(
      buildProjectsView("2026-06-12"),
      new URL("http://localhost/projects?date=2026-06-12"),
      "zh",
      "light",
    );

    expect(html).toContain('data-projects-fuzzy-status="true"');
    expect(html).toContain('data-projects-fuzzy-label="true"');
    expect(html).toContain('data-projects-fuzzy-title="true"');
    expect(html).toContain('data-projects-fuzzy-message="true"');
    expect(html).toContain('data-projects-fuzzy-options="true"');
    expect(html).toContain('data-project-search=');
    expect(html).not.toContain("rawOutput");
  });

  it("keeps fuzzy requests behind the direct-quality gate and trigger threshold", () => {
    const source = renderClientScriptSource();

    expect(source).toContain("/api/projects/fuzzy-search");
    expect(source).toContain("shouldUseDirectProjectSearch(cards, state.search, directCards) === false");
    expect(source).toContain("shouldTriggerFuzzy && queryMeetsFuzzyTriggerThreshold(state.search)");
    expect(source).toContain("window.setTimeout");
    expect(source).toContain("fuzzySearchDebounceMs");
    expect(source).toContain("AbortController");
    expect(source).not.toContain("import_projectSearchKernel");
    expect(source).not.toMatch(/\bimport_[A-Za-z0-9_]+\b/);
  });

  it("can initialize fuzzy search from the q query parameter for manual verification links", () => {
    const html = renderProjectsWorkbenchPage(
      buildProjectsView("2026-06-12"),
      new URL("http://localhost/projects?date=2026-06-12&q=%E7%BE%8E%E8%82%A1%E4%BB%8A%E5%A4%A9%E4%B9%B0%E4%BB%80%E4%B9%88"),
      "zh",
      "light",
    );
    const source = renderClientScriptSource();

    expect(html).toContain('value="美股今天买什么"');
    expect(source).toContain('apply({ fuzzyTrigger: state.search ? "immediate" : "debounced" })');
  });

  it("guards stale responses and does not label direct results as AI-optimized", () => {
    const source = renderClientScriptSource();

    expect(source).toContain("sequence !== fuzzySequence || key !== buildFuzzyRequestKey()");
    expect(source).toContain('response.source === "needs_clarification"');
    expect(source).toContain('response.source !== "direct_search"');
    expect(source).not.toContain("AI 已优化搜索");
    expect(source).not.toContain("rawOutput");
  });

  it("uses hot projects without reapplying the original zero-result query", () => {
    const source = renderClientScriptSource();

    expect(source).toContain("const hotProjectCards = (records) =>");
    expect(source).toContain('search: ""');
    expect(source).toContain("applyFuzzyProjectIds(cards, fuzzyState.response)");
  });

  it("lets ready fuzzy responses override direct result count when rendering ordered ids", () => {
    const source = renderClientScriptSource();

    expect(source).toContain('const useFuzzyResponse = fuzzyState.status === "ready" && fuzzyState.key === currentFuzzyKey');
    expect(source).toContain('const useFuzzyFallback = fuzzyState.status === "error" && fuzzyState.key === currentFuzzyKey');
    expect(source.indexOf('fuzzyState.key === key && (fuzzyState.status === "loading" || fuzzyState.status === "ready" || fuzzyState.status === "error")')).toBeLessThan(
      source.indexOf("const canTrigger = shouldTriggerFuzzy && queryMeetsFuzzyTriggerThreshold(state.search)"),
    );
    expect(source).not.toContain('directCards.length === 0 && fuzzyState.status === "ready"');
  });

  it("keeps projects preset as local page state and forwards it only through fuzzy page context", () => {
    const html = renderProjectsWorkbenchPage(
      buildProjectsView("2026-06-12"),
      new URL("http://localhost/projects?date=2026-06-12"),
      "zh",
      "light",
    );
    const source = renderClientScriptSource();

    expect(html).toContain('data-projects-default-preset="all"');
    expect(html).toContain('data-projects-preset-option="all"');
    expect(html).not.toContain("预设视图");
    expect(html).not.toContain("当前契约");
    expect(source).toContain('preset: root.getAttribute("data-projects-default-preset") || "all"');
    expect(source).toContain('setOptionState(presetOptions, state.preset, "data-projects-preset-option")');
    expect(source).toContain('path: window.location.pathname + "?preset=" + encodeURIComponent(state.preset)');
  });
});
