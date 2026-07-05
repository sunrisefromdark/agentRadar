import { describe, expect, it } from "vitest";
import {
  clampSideAssistantPlacement,
  canRestoreSideAssistantMainResult,
  composeSideAssistantQuery,
  createEmptySideAssistantSession,
  normalizeSideAssistantPlacement,
  pickSideAssistantPreviewIds,
  renderClientScriptSource,
  resetSideAssistantConversation,
  shouldStartSideAssistantDrag,
} from "../../app/visualConsole/clientScript.ts";
import { renderPrimary } from "../../app/visualConsole/ossPages.ts";
import { buildOverviewView, buildProjectsView } from "../visualConsole/build.ts";

describe("visual console fuzzy project search", () => {
  it("moves natural-language search into the side assistant shell", () => {
    const html = renderPrimary(
      { route: "projects", model: buildProjectsView("2026-06-12") },
      new URL("http://localhost/projects?date=2026-06-12"),
      "zh",
      "light",
    );

    expect(html).toContain('data-projects-ai-assistant-host="true"');
    expect(html).toContain('data-projects-ai-launch="true"');
    expect(html).toContain('draggable="false"');
    expect(html).toContain('data-projects-ai-panel="true"');
    expect(html).toContain('data-projects-ai-input="true"');
    expect(html).toContain('data-projects-ai-main-result="true"');
    expect(html).toContain('data-projects-ai-empty-cta="true"');
    expect(html).not.toContain('data-projects-fuzzy-status="true"');
    expect(html).not.toContain('data-projects-fuzzy-options="true"');
  });

  it("renders the side assistant shell on non-project routes too", () => {
    const html = renderPrimary(
      { route: "overview", model: buildOverviewView("2026-06-12") },
      new URL("http://localhost/overview?date=2026-06-12"),
      "zh",
      "light",
    );

    expect(html).toContain('data-projects-ai-assistant-host="true"');
    expect(html).toContain('data-projects-ai-option-query="浏览器智能体"');
  });

  it("keeps the endpoint but only wires it to assistant submission", () => {
    const source = renderClientScriptSource();

    expect(source).toContain("/api/projects/fuzzy-search");
    expect(source).toContain("const bindGlobalSideAssistant = () =>");
    expect(source).toContain("const submitAssistantQuery = async (rawQuery) =>");
    expect(source).toContain("visual-console-side-assistant-placement-v4");
    expect(source).toContain('panelHandle instanceof HTMLElement && panelHandle.addEventListener("dblclick", restoreDefaultPlacement)');
    expect(source).toContain('window.addEventListener("resize", () =>');
    expect(source).toContain('launcherHandle.addEventListener("dragstart"');
    expect(source).toContain("requestAnimationFrame(renderDragFrame)");
    expect(source).toContain("translate3d(");
    expect(source).not.toContain("assistantHost.style.width");
    expect(source).not.toContain("onLauncherTap");
    expect(source.match(/clearSideAssistantPlacement\(\);/g)).toHaveLength(1);
    expect(source).toContain("renderAssistantPanel();\n            applySideAssistantPlacement(assistantHost);");
    expect(source).toContain("assistantForm instanceof HTMLFormElement");
    expect(source).toContain("composeSideAssistantQuery(assistantSession.search_context, trimmed)");
    expect(source).not.toContain("shouldUseDirectProjectSearch(cards, state.search, directCards) === false");
    expect(source).not.toContain("fuzzySearchDebounceMs");
    expect(source).not.toContain("syncFuzzySearch");
    expect(source).not.toContain("data-projects-fuzzy-status");
  });

  it("composes follow-up queries and keeps more as the previous query", () => {
    const session = {
      composed_query: "浏览器智能体",
      last_user_query: "浏览器智能体",
      seen_project_ids: [],
      last_project_ids: [],
    };

    expect(composeSideAssistantQuery(session, "找做投研的")).toBe("浏览器智能体\n补充：找做投研的");
    expect(composeSideAssistantQuery(session, "更多")).toBe("浏览器智能体");
    expect(composeSideAssistantQuery(null, "Agent IDE")).toBe("Agent IDE");
  });

  it("limits previews to three and skips seen ids for more mode", () => {
    expect(pickSideAssistantPreviewIds(["a", "b", "c", "d"], [], 3)).toEqual(["a", "b", "c"]);
    expect(pickSideAssistantPreviewIds(["a", "b", "c", "d"], ["a", "c"], 3)).toEqual(["b", "d"]);
  });

  it("restores only when scope keys still match", () => {
    expect(canRestoreSideAssistantMainResult("same", "same")).toBe(true);
    expect(canRestoreSideAssistantMainResult("old", "new")).toBe(false);
    expect(canRestoreSideAssistantMainResult("", "new")).toBe(false);
  });

  it("normalizes and clamps side assistant placement inside the viewport", () => {
    expect(normalizeSideAssistantPlacement({ left: 12, top: 24 })).toEqual({ left: 12, top: 24 });
    expect(normalizeSideAssistantPlacement({ left: "12", top: 24 })).toEqual({ left: 12, top: 24 });
    expect(normalizeSideAssistantPlacement({ left: "x", top: 24 })).toBeNull();

    expect(
      clampSideAssistantPlacement(
        { left: -40, top: 800 },
        { width: 400, height: 300 },
        { width: 120, height: 80 },
      ),
    ).toEqual({ left: 8, top: 212 });
  });

  it("starts dragging only after movement clears the threshold", () => {
    expect(shouldStartSideAssistantDrag({ x: 1, y: 1 })).toBe(false);
    expect(shouldStartSideAssistantDrag({ x: 2, y: 0 })).toBe(false);
    expect(shouldStartSideAssistantDrag({ x: 4, y: 0 })).toBe(true);
    expect(shouldStartSideAssistantDrag({ x: 0, y: -5 })).toBe(true);
  });

  it("resets new chat without forcing the panel closed", () => {
    const cleared = resetSideAssistantConversation(
      {
        panel_open: true,
        messages: [{ role: "user", text: "找浏览器智能体" }],
        search_context: {
          composed_query: "找浏览器智能体",
          last_user_query: "找浏览器智能体",
          seen_project_ids: ["a"],
          last_project_ids: ["a", "b"],
        },
        active_main_result: {
          query: "找浏览器智能体",
          project_ids: ["a", "b"],
          scope_key: "scope",
        },
        quickstart_collapsed: true,
      },
      true,
    );

    expect(cleared).toEqual({
      ...createEmptySideAssistantSession(),
      panel_open: true,
    });
  });
});
