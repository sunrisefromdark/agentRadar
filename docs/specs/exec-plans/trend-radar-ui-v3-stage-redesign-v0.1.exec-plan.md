# Trend Radar UI V3 Stage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不突破 `artifact-first`、只读消费、时间上下文、SSR 主链路与跨视图钻取契约的前提下，把浏览器版 `Visual Console` 从 `UI V2.5` 升级为 `UI V3` 的“舞台化趋势情报工作台”。

**Architecture:** 保持 `src/visualConsole/*` 的读取与事实语义不变，只在 view-model 翻译层和 SSR render 层引入 `Page Frame -> Route Frame -> Surface Role -> Dock/Reader` 语法。把当前集中在 [app/server.ts](../../../app/server.ts) 的 3000+ 行字符串渲染逻辑拆成可测试的 shell、route、shared render 模块，再由 [app/styles.css](../../../app/styles.css) 落地新的 token、surface grammar、responsive 和 motion 约束。

**Tech Stack:** Node SSR, TypeScript, React server rendering (现有 `renderToStaticMarkup` 能力), plain CSS tokens, Vitest, browser visual regression。

---

# 执行计划：Trend Radar UI V3 舞台化前端重设计

## 文档状态

- 版本：`v0.1`
- 当前状态：`Needs Layout Realignment`
- 负责人：`Codex`
- 风险等级：`High`
- 设计来源：
  - `docs/specs/product-specs/trend-radar-ui-v3-stage-redesign-requirements.md`
  - `docs/specs/design-docs/trend-radar-ui-v3-stage-redesign-design.md`
  - `docs/specs/design-docs/trend-radar-visual-console-design.md`
  - `docs/specs/exec-plans/trend-radar-ui-v2-visual-redesign-v0.1.exec-plan.md`
- 说明：本文是 `trend-radar-ui-v3-stage-redesign-design.md` 的对应实施账本。若与 UI V2.5 旧计划、旧视觉刷新计划或局部 remediation 计划冲突，以 `UI V3` 需求文档和设计文档为准；旧计划仅作为实现经验与回归风险来源，不再主导新的结构决策。

## 纠偏说明（2026-05-20）

此前这份执行计划曾被标记为 `Implemented`，但这一定义过早，且验收口径有偏差。复盘当前页面与目标参考图后，问题已经明确：

1. 真正跑偏的步骤不是业务语义层，而是把 `Shell Hero / Route Frame / Surface Role` 的“结构命名”误当成了“现代布局落地”。
2. 执行与验收过度关注 `data-surface-id`、类名存在、顺序断言、局部 computed style 和可回归性，却没有把“第一屏真实构图是否已经切到现代控制中台语法”作为硬门槛。
3. `Shell Hero` 被误实现为大体量壳层卡片，路由入口继续以等权卡片拼盘存在，导致真实 viewport 仍然是旧后台骨架。
4. 因此，旧的 `Passed` / `Implemented` 只能说明“DOM 语义和测试脚手架通过”，不能说明“UI-V3 的现代布局目标已经达成”。

自本次修订起，这份计划的主目标不再是继续巩固 `surface role` 命名，而是纠正首屏构图、壳层厚度、导航形态和主舞台主导关系。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Trend Radar UI V3 Stage Redesign |
| 用户目标 | 为 `docs/specs/design-docs/trend-radar-ui-v3-stage-redesign-design.md` 生成一份可直接执行、边界和约束完全一致的执行计划 |
| 主要影响面 | `app/server.ts`、`app/styles.css`、新增 `app/visualConsole/*` SSR render 模块、`src/visualConsole/build.ts`、`src/visualConsole/types.ts`、`src/__tests__/visualConsoleWeb*.ts`、`docs/specs/exec-plans/README.md` |
| 交付目标 | 让浏览器端输出稳定表达 `Shell Hero / Context Instrument Bar / Content Stage / Route Frame / Surface Role / Dock / Reader / Audit`，并让五个一级路由按设计文档指定顺序和人格落地 |

## 目标

1. 以 `UI V3` 设计文档为唯一最新设计源，替换当前 V2.5 的“卡片集合 + 壳层补丁”实现思路，转为 `stage-first` 的 SSR 输出结构。
2. 保持 `overview / projects / weekly / run-health / kb` 路由集合、`date / anchor / project / slug / trend_key / source_view / lang / theme` 语义、`artifact-first` 边界与只读消费不变。
3. 在 `src/visualConsole/build.ts` 内把现有路由 view model 进一步整理为可直接渲染的 `hero / stage / rail / strip / dock / reader / audit` 结构，不反向侵入 `read layer / context layer / truth layer`。
4. 彻底拆掉对“一层通用 panel/card + CSS 硬拉人格差异”的依赖，让 SSR DOM 本身表达 `Page Frame -> Route Frame -> Surface Role -> Detail Dock`。
5. 把 `Overview / Projects / Weekly / Run Health / Knowledge Base` 分别重构为 `decision gate / scan bench / editorial desk / diagnostic audit stage / research reader`，同时保持同一套 `Intelligence Terminal` 语言。
6. 冻结 `Hero / Stage / Rail / Strip / Dock / Reader / Audit`、Time Navigator、锚点编号、证据导视、状态带、`Interest Profile` 工具区归位、Hero/Rail/Dock 焦点去重、Reader/Dock 行为与密度预留的实现契约。
7. 用可执行测试矩阵覆盖结构顺序、语义边界、桌面/移动端 Dock-Reader 行为、动效约束、响应式和可访问性，不允许通过删除负例或放宽断言“过计划”。

## 设计对齐

| 设计章节 | 本计划承接位置 | 实施要求 |
| --- | --- | --- |
| `2. 范围、非目标与冻结边界` | `范围边界`、`Phase V3-0` | 不改业务真相、路由集合、URL 语义、artifact 边界、只读消费与 SSR 主链路 |
| `3. 现状与承接前提` | `当前状态` | 明确复用现有 `build.ts` / `context.ts` / 现有 fixture 与 Web 测试守护，不重复设计业务层 |
| `4. 总体设计策略` | `Phase V3-1 ~ V3-5` | 落地 `Stage Before Cards`、`Trust Before Exploration`、`Frame, Rail, Anchor` 与 `SSR-First Structural Expression` |
| `5. 全局壳层与页面语法` | `Phase V3-1`、`Phase V3-5` | 建立 Page Frame、Shell Hero、Context Instrument Bar、Surface Role Contract、Time Navigator、微视觉语法 |
| `6. 路由级设计` | `Phase V3-2 ~ V3-4` | 五个路由按设计给出的舞台顺序和人格重构 |
| `7. 组件系统与设计 Token` | `Phase V3-1`、`Phase V3-5` | 建立 Stage Hero、Stage Frame、Scan Row、Reader Dock、Audit Panel、Evidence Anchor 等承载组件边界 |
| `8. 状态、交互与动效` | `Phase V3-5` | 只保留 `Scene Shift / Instrument Response / Dock Open-Close / Reader Focus` 四类 P0 动效 |
| `9. 响应式、可访问性与性能` | `Phase V3-5`、`验证矩阵` | 桌面保留 `stage + rail + dock`，移动端降级为 `strong hero + segmented reader`，不引入高成本前端运行时，并显式验证 typography / tabular numerics |
| `10. 工程落地与实现触达面` | `文件结构与职责切分` | 只改 render/view-model/style/test 层，禁止触碰事实分层与 artifact 生成逻辑 |
| `11. 验证矩阵与验收映射` | `验收标准`、`验证矩阵`、`关键负例` | 所有验收点必须有对应测试入口 |
| `12. 实施承接顺序` | `阶段进度` | P0/P1/P2 不混写，P1/P2 不能抢占 P0 路径 |

## 范围边界

### 允许修改

- `app/server.ts`
- `app/styles.css`
- `app/components/ScoreEvidencePanel.tsx`
- 新增 `app/visualConsole/copy.ts`
- 新增 `app/visualConsole/renderShared.ts`
- 新增 `app/visualConsole/renderShell.ts`
- 新增 `app/visualConsole/renderOverview.ts`
- 新增 `app/visualConsole/renderProjects.ts`
- 新增 `app/visualConsole/renderWeekly.ts`
- 新增 `app/visualConsole/renderRunHealth.ts`
- 新增 `app/visualConsole/renderKnowledgeBase.ts`
- 新增 `app/visualConsole/clientScript.ts`
- `src/visualConsole/build.ts`
- `src/visualConsole/types.ts`
- `src/__tests__/visualConsoleWeb.test.ts`
- `src/__tests__/visualConsoleWeb.visual.test.ts`
- `docs/specs/exec-plans/README.md`
- 本执行计划文档自身

### 禁止修改

- 不改 `src/filter/*`、`src/signal/*`、`src/action/*`、`src/types.ts` 中任何会改变 `score / confidence / freshness / verify / trend judgment` 的业务逻辑。
- 不改 `src/visualConsole/readLayer.ts`、`src/visualConsole/context.ts` 的事实解析规则、`latest` 解析契约、artifact 发现逻辑与上下文语义。
- 不改 daily / weekly / run-summary / verify / KB artifact 格式，不新增新的 truth source、CMS、媒体系统、数据库、前端聚合真相或第六个一级路由。
- 不把 SSR 站点改写为完整 SPA，不引入重型客户端状态管理，不依赖高频粒子、持续发光或复杂 WebGL/Canvas 特效支撑层级。
- 不为了舞台感牺牲信息密度、键盘可达性、审计透明度、状态显式化与跨视图回链能力。

### 兼容性约束

- 继续支持 `npm run visual-console:web`、`npm run test:visual-console`、`npm run test:visual-console:web`、`npm run test:visual-console:web:visual`、`npm run exec-plan:preflight`。
- 继续保留 detail 局部替换与 `data-preserve-scroll="detail"` 路径，不允许改回整页重建作为默认 detail 交互。
- 继续使用 request-level cache，不允许因为舞台化把同一请求的 sparkline/score 读取回退为重复扫盘。

## 当前状态

- 当前浏览器端主实现集中在 [app/server.ts](../../../app/server.ts)，文件约 `3116` 行，既负责 request parsing、URL 归一化、copy、本地交互脚本，又负责五个路由的完整字符串渲染。
- 当前样式集中在 [app/styles.css](../../../app/styles.css)，文件约 `2345` 行，已经具备 V2.5 设计 token、detail 独立滚动、Time Navigator 与 visual regression 基线，但整体语法仍偏 `panel/card`。
- [src/visualConsole/build.ts](../../../src/visualConsole/build.ts) 已稳定提供五个路由的只读 view model，入口函数位于 `buildOverviewView()`、`buildProjectsView()`、`buildWeeklyView()`、`buildRunHealthView()`、`buildKnowledgeBaseView()`。
- [src/__tests__/visualConsoleWeb.test.ts](../../../src/__tests__/visualConsoleWeb.test.ts) 与 [src/__tests__/visualConsoleWeb.visual.test.ts](../../../src/__tests__/visualConsoleWeb.visual.test.ts) 已经守住 V2.5 结构顺序、URL 语义、detail 交互与视觉断言，是本次重构的主要回归护栏。
- 当前仓库缺少一份与 `trend-radar-ui-v3-stage-redesign-design.md` 一一对应的实施账本，导致后续执行容易在“哪些属于允许重构、哪些属于越界重算”上再次设计。

## 当前进度

- 需求/设计对齐：`Done`
- ExecPlan 编写：`Done`
- ExecPlan 预检：`Passed`
- 代码实施：`Drifted`
- 结构/视觉回归：`Passed but insufficient`

## 文件结构与职责切分

### View-model 层

- 修改 [src/visualConsole/types.ts](../../../src/visualConsole/types.ts)
  - 新增 `SurfaceRole`、`StageDensityPreset`、`StatusBandModel`、`EvidenceAnchorModel`、`RouteFrameModel`、`ShellHeroModel`、`InstrumentStripModel`，以及承载焦点主次去重所需的 surface metadata。
- 修改 [src/visualConsole/build.ts](../../../src/visualConsole/build.ts)
  - 保持 artifact 读取不变，只补充 route-level frame model，把现有 route view model 整理为可直接映射 `hero / stage / rail / strip / dock / reader / audit` 的只读结构。

### SSR render 层

- 新增 `app/visualConsole/copy.ts`
  - 从 `app/server.ts` 抽出 UI copy、route persona 文案、status 标签与标题映射。
- 新增 `app/visualConsole/renderShared.ts`
  - 放置 `escapeHtml`、`toViewHref`、`renderMetaPairs`、`renderStatusBand`、`renderEvidenceAnchor`、`renderFramedPanel`、`renderReaderDock` 等共享 render primitive。
- 新增 `app/visualConsole/renderShell.ts`
  - 渲染 `Shell Hero`、`Context Instrument Bar`、一级导航、theme/lang 开关与 `Time Navigator Surface`。
- 新增 `app/visualConsole/renderOverview.ts`
- 新增 `app/visualConsole/renderProjects.ts`
- 新增 `app/visualConsole/renderWeekly.ts`
- 新增 `app/visualConsole/renderRunHealth.ts`
- 新增 `app/visualConsole/renderKnowledgeBase.ts`
  - 五个文件分别负责 route frame 与 surface role 输出。
- 新增 `app/visualConsole/clientScript.ts`
  - 从 `app/server.ts` 抽离 detail swap、focus return、navigator instrumentation、scroll preservation。
- 修改 [app/server.ts](../../../app/server.ts)
  - 只保留 request parsing、route model build、document assembly、server start/close。

### 样式与测试层

- 修改 [app/styles.css](../../../app/styles.css)
  - 从 `panel/card` token 迁移为 `shell/stage/rail/dock/reader/audit` 语法。
- 修改 [app/components/ScoreEvidencePanel.tsx](../../../app/components/ScoreEvidencePanel.tsx)
  - 只允许对 `Evidence Tile / Evidence Anchor / Status Band` 的呈现做 UI V3 对齐，不改评分含义。
- 修改 [src/__tests__/visualConsoleWeb.test.ts](../../../src/__tests__/visualConsoleWeb.test.ts)
  - 结构顺序、URL 语义、state visible、dock/reader contract。
- 修改 [src/__tests__/visualConsoleWeb.visual.test.ts](../../../src/__tests__/visualConsoleWeb.visual.test.ts)
  - 视觉布局、computed style、responsive、focus、motion、detail behavior。

## 阶段进度

| 阶段 | 状态 | 设计映射 | 说明 |
| --- | --- | --- | --- |
| Phase V3-0：边界冻结与模块拆分 | `DONE` | `2 / 3 / 10 / 12` | 已冻结 render/view-model/style/test 触达面，并完成 shell/shared/route/client 的 SSR 模块拆分 |
| Phase V3-1：全局 Page Frame 与 Surface Role 语法 | `DONE` | `4 / 5 / 7` | 已建立 Shell Hero、Context Instrument Bar、Route Frame 与 Surface Role Contract |
| Phase V3-2：Overview / Projects 舞台化 | `DONE` | `6.1 / 6.2` | 已落地 `decision gate` 与 `scan bench`，并保持 detail/dock 钻取契约 |
| Phase V3-3：Weekly / Run Health 舞台化 | `DONE` | `6.3 / 6.4` | 已落地 `editorial desk` 与 `diagnostic audit stage` |
| Phase V3-4：Knowledge Base / Dock / Reader / Anchors | `DONE` | `6.5 / 5.5 / 7.4` | 已落地 `research reader`、meta rail、evidence anchor 与 inline reader focus |
| Phase V3-5：Token、typography、motion、responsive、a11y | `DONE` | `7 / 8 / 9` | 已补齐 typography / metric hooks、双 atmosphere layer、reader-dock 响应式语义与 visual harness 运行契约 |
| Phase V3-6：验证、回归与账本收口 | `DONE` | `11 / 12` | 已运行 preflight、typecheck、结构测试、视觉测试并回填记录；`lint` 失败已按既有质量债记录 |

## 任务分解

### Task 1: 冻结 UI V3 承载模型并抽出可维护的 render 模块

**Files:**
- Create: `app/visualConsole/copy.ts`
- Create: `app/visualConsole/renderShared.ts`
- Create: `app/visualConsole/renderShell.ts`
- Create: `app/visualConsole/clientScript.ts`
- Modify: `app/server.ts:1-3116`
- Modify: `src/visualConsole/types.ts`
- Modify: `src/visualConsole/build.ts:400-620`
- Test: `src/__tests__/visualConsoleWeb.test.ts`

- [ ] **Step 1: 先写结构守护测试，锁定新的 Page Frame 语法**

```ts
it("renders shell hero, context instrument bar, and content stage in V3 order", async () => {
  const html = await (await fetch(`${server.localUrl}overview?lang=en&date=2026-05-01`)).text();
  const bodyHtml = html.slice(html.indexOf("<body"));
  expect(bodyHtml.indexOf('data-page-frame="shell-hero"')).toBeLessThan(bodyHtml.indexOf('data-page-frame="context-instrument-bar"'));
  expect(bodyHtml.indexOf('data-page-frame="context-instrument-bar"')).toBeLessThan(bodyHtml.indexOf('data-page-frame="content-stage"'));
  expect(html).toContain('data-surface-role="hero"');
  expect(html).toContain('data-surface-role="stage"');
});
```

- [ ] **Step 2: 运行单测，确认当前实现尚未满足 UI V3 结构**

Run: `npm run test:visual-console:web -- --runInBand`

Expected: 至少新增的 `data-page-frame="shell-hero"` / `data-surface-role="hero"` 断言失败。

- [ ] **Step 3: 在 view-model 层补齐 UI V3 承载类型**

```ts
export type SurfaceRole = "hero" | "stage" | "rail" | "strip" | "dock" | "reader" | "audit";

export interface SurfaceBlockModel {
  id: string;
  role: SurfaceRole;
  title: string;
  eyebrow?: string | null;
  body?: string | null;
  state?: TopLevelViewStatus | "neutral";
  primaryObjectKey?: string | null;
  emphasis?: "primary" | "secondary" | "tertiary";
  slots?: string[];
  sections?: string[];
  anchors?: EvidenceAnchorModel[];
}

export interface RouteFrameModel {
  route: "overview" | "projects" | "weekly" | "run-health" | "kb";
  hero: SurfaceBlockModel | null;
  stage: SurfaceBlockModel[];
  rail: SurfaceBlockModel[];
  strip: SurfaceBlockModel[];
  dock: SurfaceBlockModel | null;
  reader: SurfaceBlockModel | null;
  audit: SurfaceBlockModel[];
}
```

- [ ] **Step 4: 把 `app/server.ts` 拆成 shell/shared/client 模块**

```ts
// app/server.ts
import { renderShellFrame } from "./visualConsole/renderShell.ts";
import { renderContentStage, renderRouteFrame } from "./visualConsole/renderShared.ts";
import { renderClientScript } from "./visualConsole/clientScript.ts";

function renderDocument(rendered: RenderModel, requestUrl: URL, lang: UiLang): string {
  return [
    "<!doctype html>",
    `<html lang="${lang === "zh" ? "zh-CN" : "en"}">`,
    "<head>...</head>",
    "<body>",
    renderShellFrame({ rendered, requestUrl, lang }),
    renderContentStage(renderRouteFrame({ rendered, requestUrl, lang })),
    renderClientScript(),
    "</body>",
    "</html>",
  ].join("");
}
```

- [ ] **Step 5: 跑回归，确认拆分后路由仍可访问**

Run: `npm run test:visual-console:web`

Expected: 所有既有路由可访问测试继续通过，新增 Page Frame 语法测试转绿。

- [ ] **Step 6: 提交**

```bash
git add app/server.ts app/visualConsole/copy.ts app/visualConsole/renderShared.ts app/visualConsole/renderShell.ts app/visualConsole/clientScript.ts src/visualConsole/types.ts src/visualConsole/build.ts src/__tests__/visualConsoleWeb.test.ts
git commit -m "feat: scaffold ui v3 shell and route frame grammar"
```

### Task 2: 为 `build.ts` 输出稳定的 Surface Role / Route Frame 结构

**Files:**
- Modify: `src/visualConsole/build.ts`
- Modify: `src/visualConsole/types.ts`
- Test: `src/__tests__/visualConsoleWeb.test.ts`

- [ ] **Step 1: 先补 route frame 映射测试，防止实现时回退到 panel/card 语法**

```ts
it("maps overview and projects into design-frozen route frame roles", async () => {
  const overview = buildOverviewView("2026-05-01");
  expect(overview.frame.hero?.id).toBe("overview-decision-gate-hero");
  expect(overview.frame.hero?.slots).toEqual(["trust-gate", "lead-decision", "next-action-cue"]);
  expect(overview.frame.hero?.primaryObjectKey).toBe("overview-featured-decision");
  expect(overview.frame.rail.map((surface) => surface.id)).toEqual(["overview-context-rail"]);
  expect(overview.frame.strip.map((surface) => surface.id)).toEqual(["overview-instrument-strip"]);
  expect(overview.frame.strip[0]?.slots).toContain("interest-profile-tool-zone");
  expect(
    overview.frame.rail.every(
      (surface) => surface.primaryObjectKey !== "overview-featured-decision" || surface.emphasis === "secondary",
    ),
  ).toBe(true);
  expect(overview.frame.stage.map((surface) => surface.id)).toEqual([
    "overview-spotlight-continuation-stage",
    "overview-research-stream-stage",
  ]);
  expect(overview.frame.dock?.id).toBe("overview-selected-project-dock");

  const projects = buildProjectsView("2026-05-01");
  expect(projects.frame.stage.map((surface) => surface.id)).toEqual(["projects-scan-rows"]);
  expect(projects.frame.dock?.sections).toEqual(["why-it-matters", "evidence", "risks", "next-actions"]);
  expect(projects.frame.rail.map((surface) => surface.id)).toEqual(["projects-reading-hints-rail"]);
});
```

- [ ] **Step 2: 跑目标测试，确认当前 `build.ts` 还没有 `frame` 输出**

Run: `vitest run src/__tests__/visualConsoleWeb.test.ts -t "maps overview and projects into design-frozen route frame roles"`

Expected: `frame` 不存在或关键 `id` 不匹配。

- [ ] **Step 3: 在每个 route view model 中新增 `frame` 字段**

```ts
return {
  context: resolved.context,
  banner: ...,
  state,
  time_navigator: ...,
  frame: {
    route: "overview",
    hero: {
      id: "overview-decision-gate-hero",
      role: "hero",
      title: "Decision Gate",
      primaryObjectKey: "overview-featured-decision",
      emphasis: "primary",
      slots: ["trust-gate", "lead-decision", "next-action-cue"],
    },
    rail: [{ id: "overview-context-rail", role: "rail", title: "Weekly Entry / Run Health / Risk Watchpoints", emphasis: "secondary" }],
    strip: [{ id: "overview-instrument-strip", role: "strip", title: "Source Health / Time / Status / Interest Profile Tool Zone", slots: ["source-health", "time-status", "interest-profile-tool-zone"] }],
    stage: [
      { id: "overview-spotlight-continuation-stage", role: "stage", title: "Spotlight Continuation" },
      { id: "overview-research-stream-stage", role: "stage", title: "Research Stream" },
    ],
    dock: { id: "overview-selected-project-dock", role: "dock", title: "Selected Project Detail" },
    reader: null,
    audit: [],
  },
};
```

- [ ] **Step 4: 把五个路由都映射到设计文档指定的语义顺序**

```ts
// weekly
frame: {
  route: "weekly",
  hero: { id: "weekly-cover-stage", role: "hero", title: "Weekly Cover Stage" },
  stage: [
    { id: "weekly-evidence-matrix", role: "stage", title: "Evidence Matrix" },
    { id: "weekly-core-trend-stage", role: "stage", title: "Core Trend Storyline" },
  ],
  rail: [{ id: "weekly-judgment-rail", role: "rail", title: "Overall Weekly Judgment" }],
  strip: [
    { id: "weekly-weak-signal-strip", role: "strip", title: "Weak Signals" },
    { id: "weekly-watchpoints-strip", role: "strip", title: "Watchpoints" },
  ],
  dock: { id: "weekly-project-dock", role: "dock", title: "Project Detail" },
  reader: null,
  audit: [],
},
```

- [ ] **Step 5: 跑构建和结构测试**

Run: `npm run typecheck && npm run test:visual-console:web`

Expected: `frame` 类型通过，路由模型测试通过。

- [ ] **Step 6: 提交**

```bash
git add src/visualConsole/types.ts src/visualConsole/build.ts src/__tests__/visualConsoleWeb.test.ts
git commit -m "feat: add ui v3 route frame models"
```

### Task 3: 落地全局 Shell Hero、Context Instrument Bar、Time Navigator Surface

**Files:**
- Create: `app/visualConsole/renderShell.ts`
- Modify: `app/server.ts`
- Modify: `app/styles.css`
- Test: `src/__tests__/visualConsoleWeb.test.ts`
- Test: `src/__tests__/visualConsoleWeb.visual.test.ts`

- [ ] **Step 1: 写 failing test，锁定 Shell Hero 与 Instrument Bar 的顺序和职责**

```ts
it("keeps shell hero and instrument bar separate from content stage", async () => {
  const html = await (await fetch(`${server.localUrl}overview?lang=en&date=2026-05-01`)).text();
  const weeklyHtml = await (await fetch(`${server.localUrl}weekly?lang=en&anchor=2026-05-01`)).text();
  expect(html).toContain('data-shell-hero="true"');
  expect(html).toContain('data-context-instrument-bar="true"');
  expect(html).toContain('data-time-navigator-surface="instrument-strip"');
  expect(html).toContain('data-time-preview-lane="true"');
  expect(html).toContain('data-time-slice-kind="daily"');
  expect(weeklyHtml).toContain('data-time-slice-kind="weekly"');
  expect(weeklyHtml).toContain('data-time-window-range');
  expect(html).not.toContain('class="header-preference-slot overview-preference-slot"');
  expect(html).not.toMatch(/data-context-instrument-bar="true"[\\s\\S]*data-interest-profile-slot="tool-zone"/);
  expect(html).toContain('data-surface-id="overview-instrument-strip"');
  expect(html).toContain('data-interest-profile-slot="tool-zone"');
});
```

- [ ] **Step 2: 写最小 Shell render 实现**

```ts
export function renderShellFrame(args: RenderShellArgs): string {
  return `
    <div class="shell-hero" data-page-frame="shell-hero" data-shell-hero="true">
      ${renderPrimaryNav(args)}
      ${renderRoutePersona(args)}
      ${renderUtilityZone(args)}
    </div>
    <div class="context-instrument-bar" data-page-frame="context-instrument-bar" data-context-instrument-bar="true">
      ${renderContextBadges(args)}
      ${renderTimeNavigatorSurface(args)}
    </div>
  `;
}

function renderTimeNavigatorSurface(args: RenderShellArgs): string {
  const navigator = args.rendered.time_navigator;
  const isWeekly = navigator.kind === "weekly";
  return `
    <section
      class="time-navigator-surface"
      data-time-navigator-surface="instrument-strip"
      data-time-slice-kind="${isWeekly ? "weekly" : "daily"}"
    >
      <div class="time-instrument-stepper">
        <button type="button">Prev</button>
        <div class="time-instrument-summary">
          <span>${navigator.current_label}</span>
          <span>${navigator.position_label}</span>
          <span>${navigator.is_stale ? "Stale" : "Fresh"}</span>
          ${isWeekly ? `<span data-time-window-range="${navigator.window_start} -> ${navigator.window_end}">${navigator.window_start} -> ${navigator.window_end}</span>` : ""}
        </div>
        <button type="button">Next</button>
        <button type="button">Latest</button>
      </div>
      <div class="time-preview-lane" data-time-preview-lane="true">
        ${renderTimePreviewSlices(navigator)}
      </div>
    </section>
  `;
}
```

- [ ] **Step 3: 用 V3 token 重写对应样式，不让 Header 退回巨型玻璃卡**

```css
.shell-hero {
  display: grid;
  gap: 16px;
  border: 1px solid var(--frame-border-strong);
  background: var(--shell-surface);
}

.context-instrument-bar {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  border-top: 1px solid var(--frame-border-subtle);
}
```

- [ ] **Step 4: 跑结构与视觉测试**

Run: `npm run test:visual-console:web && npm run test:visual-console:web:visual`

Expected: Shell Hero / Instrument Bar 顺序正确，Time Navigator 以 `instrument strip + preview lane` 呈现，daily / weekly 时间语义显式区分，visual test 中 header 不再承担主内容卡片职责，`Interest Profile` 不出现在全局 instrument bar，而是只出现在路由级 `Strip / Tool Zone` 或折叠工具区。

- [ ] **Step 5: 提交**

```bash
git add app/server.ts app/visualConsole/renderShell.ts app/styles.css src/__tests__/visualConsoleWeb.test.ts src/__tests__/visualConsoleWeb.visual.test.ts
git commit -m "feat: implement ui v3 shell hero and instrument bar"
```

### Task 4: 重构 `Overview` 和 `Projects` 为 `decision gate` 与 `scan bench`

**Files:**
- Create: `app/visualConsole/renderOverview.ts`
- Create: `app/visualConsole/renderProjects.ts`
- Modify: `app/server.ts`
- Modify: `app/styles.css`
- Modify: `app/components/ScoreEvidencePanel.tsx`
- Test: `src/__tests__/visualConsoleWeb.test.ts:356-842`
- Test: `src/__tests__/visualConsoleWeb.visual.test.ts`

- [ ] **Step 1: 先锁定 `Overview` 的顺序和 `Projects` 的 scan row + dock 语法**

```ts
it("renders overview as a frozen decision gate route frame", async () => {
  const html = await (await fetch(`${server.localUrl}overview?lang=en&date=2026-05-01`)).text();
  expect(html).toContain('data-surface-id="overview-decision-gate-hero"');
  expect(html).toContain('data-hero-slot="trust-gate"');
  expect(html).toContain('data-hero-slot="lead-decision"');
  expect(html).toContain('data-hero-slot="next-action-cue"');
  expect(html).toContain('data-interest-profile-slot="tool-zone"');
  expect(html.indexOf('data-surface-id="overview-decision-gate-hero"'))
    .toBeLessThan(html.indexOf('data-surface-id="overview-context-rail"'));
  expect(html.indexOf('data-surface-id="overview-context-rail"'))
    .toBeLessThan(html.indexOf('data-surface-id="overview-instrument-strip"'));
  expect(html.indexOf('data-surface-id="overview-instrument-strip"'))
    .toBeLessThan(html.indexOf('data-surface-id="overview-spotlight-continuation-stage"'));
  expect(html.indexOf('data-surface-id="overview-spotlight-continuation-stage"'))
    .toBeLessThan(html.indexOf('data-surface-id="overview-research-stream-stage"'));
  expect(html).toContain('data-surface-id="overview-selected-project-dock"');
});

it("renders projects rows as scan rows with a frozen dossier dock", async () => {
  const html = await (await fetch(`${server.localUrl}projects?lang=en&date=2026-05-01&project=openai%2Fcodex`)).text();
  expect(html).toContain('data-projects-stage="scan-rows"');
  expect(html).toContain('data-surface-id="projects-dossier-dock"');
  expect(html).toContain('data-dock-section="why-it-matters"');
  expect(html).toContain('data-dock-section="evidence"');
  expect(html).toContain('data-dock-section="risks"');
  expect(html).toContain('data-dock-section="next-actions"');
  expect(html).toContain('data-evidence-anchor-link="row-to-dock"');
  expect(html).toContain('data-surface-id="projects-reading-hints-rail"');
  expect(html).not.toContain('class="project-card-grid"');
});
```

- [ ] **Step 2: 在 `renderOverview.ts` 中实现唯一 Hero、Rail、Strip、Stage 与 Dock**

```ts
export function renderOverviewRoute(model: OverviewViewModel, requestUrl: URL, lang: UiLang, cache: RenderCache): string {
  return `
    <section class="route-frame overview-route-frame">
      ${renderHeroSurface(
        "overview-decision-gate-hero",
        [
          renderTrustGate(model, lang),
          renderLeadDecision(model, requestUrl, lang, cache),
          renderNextActionCue(model, requestUrl, lang),
        ].join(""),
      )}
      ${renderRailSurface("overview-context-rail", renderOverviewContextRail(model, requestUrl, lang))}
      ${renderStripSurface("overview-instrument-strip", renderOverviewInstrumentStrip(model, requestUrl, lang, cache))}
      ${renderStageSurface("overview-spotlight-continuation-stage", renderSpotlightContinuation(model, requestUrl, lang, cache))}
      ${renderStageSurface("overview-research-stream-stage", renderResearchStream(model, requestUrl, lang, cache))}
      ${renderDockSurface("overview-selected-project-dock", renderOverviewSelectedProject(model, requestUrl, lang, cache))}
    </section>
  `;
}
```

- [ ] **Step 3: 在 `renderProjects.ts` 中实现 `filter bench -> scan rows -> dossier dock -> reading hints rail`**

```ts
export function renderProjectsRoute(model: ProjectsViewModel, requestUrl: URL, lang: UiLang, cache: RenderCache): string {
  return `
    <section class="route-frame projects-route-frame">
      ${renderStripSurface("projects-filter-bench", renderProjectsFilterStrip(model, requestUrl, lang))}
      ${renderStageSurface("projects-scan-rows", renderProjectsRows(model.projects, requestUrl, lang, cache))}
      ${model.selected_project ? renderDockSurface("projects-dossier-dock", renderProjectDossierDock(model.selected_project, requestUrl, lang)) : ""}
      ${renderRailSurface("projects-reading-hints-rail", renderProjectsReadingHints(model, lang))}
    </section>
  `;
}
```

- [ ] **Step 4: 调整 `ScoreEvidencePanel` 为 evidence tile / anchor 语法**

```tsx
export function ScoreEvidencePanel(...) {
  return (
    <section className="evidence-tile-stack" data-evidence-tile="true">
      <header className="status-band">...</header>
      <ol className="evidence-anchor-list" data-evidence-anchor-link="row-to-dock">...</ol>
    </section>
  );
}

export function renderProjectDossierDock(detail: ProjectsViewModel["selected_project"], requestUrl: URL, lang: UiLang): string {
  return [
    renderDockSection("why-it-matters", renderWhyItMatters(detail, lang)),
    renderDockSection("evidence", renderProjectDetailEvidence(detail, requestUrl, lang)),
    renderDockSection("risks", renderProjectRisks(detail, lang)),
    renderDockSection("next-actions", renderProjectNextActions(detail, lang)),
  ].join("");
}
```

- [ ] **Step 5: 跑目标测试**

Run: `npm run test:visual-console:web && npm run test:visual-console:web:visual`

Expected: `Overview` 不再回退到等权卡片墙，`Projects` detail 继续是固定 Dock，visual test 中 `detail-column` 仍可独立滚动。

- [ ] **Step 6: 提交**

```bash
git add app/visualConsole/renderOverview.ts app/visualConsole/renderProjects.ts app/server.ts app/styles.css app/components/ScoreEvidencePanel.tsx src/__tests__/visualConsoleWeb.test.ts src/__tests__/visualConsoleWeb.visual.test.ts
git commit -m "feat: stage overview and projects for ui v3"
```

### Task 5: 重构 `Weekly` 与 `Run Health` 为 `Editorial Desk` 和 `Diagnostic Audit Stage`

**Files:**
- Create: `app/visualConsole/renderWeekly.ts`
- Create: `app/visualConsole/renderRunHealth.ts`
- Modify: `app/server.ts`
- Modify: `app/styles.css`
- Test: `src/__tests__/visualConsoleWeb.test.ts`
- Test: `src/__tests__/visualConsoleWeb.visual.test.ts`

- [ ] **Step 1: 先锁定 `Weekly` 和 `Run Health` 的舞台顺序**

```ts
it("renders weekly as cover -> matrix -> core trend -> weak signals -> watchpoints", async () => {
  const html = await (await fetch(`${server.localUrl}weekly?lang=en&anchor=2026-05-01`)).text();
  expect(html.indexOf('data-surface-id="weekly-cover-stage"')).toBeLessThan(html.indexOf('data-surface-id="weekly-evidence-matrix"'));
  expect(html.indexOf('data-surface-id="weekly-evidence-matrix"')).toBeLessThan(html.indexOf('data-surface-id="weekly-core-trend-stage"'));
});

it("keeps weak signals postposed when no stable core trend exists", async () => {
  const html = await (await fetch(`${server.localUrl}weekly?lang=en&anchor=2026-04-10`)).text();
  expect(html).toContain('data-surface-id="weekly-no-core-trend-audit"');
  expect(html.indexOf('data-surface-id="weekly-no-core-trend-audit"'))
    .toBeLessThan(html.indexOf('data-surface-id="weekly-weak-signal-strip"'));
  expect(html).not.toContain('data-weekly-weak-signals-promoted="true"');
});

it("renders run health as judgment -> source table -> audit -> actions", async () => {
  const html = await (await fetch(`${server.localUrl}run-health?lang=en&date=2026-05-01`)).text();
  expect(html.indexOf('data-surface-id="run-health-trust-hero"')).toBeLessThan(html.indexOf('data-surface-id="run-health-source-stage"'));
  expect(html.indexOf('data-surface-id="run-health-source-stage"')).toBeLessThan(html.indexOf('data-surface-id="run-health-audit-stage"'));
});

it("renders run health states with text, icon hooks, labels, and explanations", async () => {
  const html = await (await fetch(`${server.localUrl}run-health?lang=en&date=2026-05-01`)).text();
  expect(html).toContain('data-status-band="failed"');
  expect(html).toContain('data-status-icon="failed"');
  expect(html).toContain('data-status-text="Failed"');
  expect(html).toContain('data-status-explainer="failure"');
  expect(html).toContain('data-status-band="degraded"');
  expect(html).toContain('data-status-band="stale"');
  expect(html).toContain('data-status-band="empty"');
  expect(html).toContain('data-status-band="not-judgeable"');
  expect(html).toContain('data-run-health-audit-section="verify"');
  expect(html).toContain('data-run-health-audit-section="rejected-outputs"');
  expect(html).toContain('data-run-health-audit-section="failure-fallback"');
});
```

- [ ] **Step 2: 实现 `Weekly` 的 cover/matrix/core/weak/watch 结构**

```ts
export function renderWeeklyRoute(model: WeeklyViewModel, detailProject: ProjectsViewModel["selected_project"] | null, requestUrl: URL, lang: UiLang): string {
  return `
    <section class="route-frame weekly-route-frame">
      ${renderHeroSurface(model.frame.hero, { id: "weekly-cover-stage" })}
      ${renderRailSurface("weekly-judgment-rail", renderWeeklyJudgment(model, lang))}
      ${renderStageSurface("weekly-evidence-matrix", renderWeeklyMatrix(model, lang))}
      ${renderStageSurface("weekly-core-trend-stage", renderWeeklyCoreStory(model, requestUrl, lang))}
      ${renderStripSurface("weekly-weak-signal-strip", renderWeeklyWeakSignals(model, requestUrl, lang))}
      ${renderStripSurface("weekly-watchpoints-strip", renderWeeklyWatchpoints(model, lang))}
      ${detailProject ? renderDockSurface("weekly-project-dock", renderProjectDetail(detailProject, requestUrl, lang)) : ""}
    </section>
  `;
}
```

- [ ] **Step 3: 实现 `Run Health` 的 audit role，不伪装成普通结果卡，并补齐状态矩阵语义**

```ts
export function renderRunHealthRoute(model: RunHealthViewModel, lang: UiLang): string {
  return `
    <section class="route-frame run-health-route-frame">
      ${renderHeroSurface(model.frame.hero, { id: "run-health-trust-hero" })}
      ${renderStageSurface("run-health-source-stage", renderSourceStatusTables(model, lang))}
      ${renderAuditSurface("run-health-audit-stage", renderRunAudit(model, lang))}
      ${renderRailSurface("run-health-actions-rail", renderRecommendedActions(model, lang))}
    </section>
  `;
}
```

- [ ] **Step 3.1: 把 `verify / rejected outputs / failure / fallback` 固定为 `Audit` 内的分段语义**

```ts
export function renderRunAudit(model: RunHealthViewModel, lang: UiLang): string {
  return [
    renderAuditSection("verify", renderVerifySummary(model, lang)),
    renderAuditSection("rejected-outputs", renderRejectedOutputs(model, lang)),
    renderAuditSection("failure-fallback", renderFailureAndFallback(model, lang)),
  ].join("");
}
```

- [ ] **Step 4: 处理“无稳定核心趋势周”时的受控空态 / 审计态**

```ts
const coreStage = hasCoreTrend
  ? renderStageSurface("weekly-core-trend-stage", coreHtml)
  : renderAuditSurface(
      "weekly-no-core-trend-audit",
      renderWeeklyNoCoreTrendAudit({
        summary: ui.noWeeklyTrend,
        reasons: model.audit_summary,
        nextAction: renderWeeklyRecoveryCue(model, requestUrl, lang),
      }),
    );

const weakStage = renderStripSurface(
  "weekly-weak-signal-strip",
  renderWeeklyWeakSignals(model, requestUrl, lang),
);
```

- [ ] **Step 5: 跑回归**

Run: `npm run test:visual-console:web && npm run test:visual-console:web:visual`

Expected: `Weekly` 的结构顺序、`no core trend audit` 场景、`Weak Signals` 后置约束、`Run Health` source/audit 表格，以及 `verify / rejected outputs / failure / fallback` 在 `Audit` 段内的显式解释全部通过。

- [ ] **Step 6: 提交**

```bash
git add app/visualConsole/renderWeekly.ts app/visualConsole/renderRunHealth.ts app/server.ts app/styles.css src/__tests__/visualConsoleWeb.test.ts src/__tests__/visualConsoleWeb.visual.test.ts
git commit -m "feat: stage weekly and run health for ui v3"
```

### Task 6: 把 `Knowledge Base`、Dock/Reader、Anchor 语法落到位

**Files:**
- Create: `app/visualConsole/renderKnowledgeBase.ts`
- Modify: `app/server.ts`
- Modify: `app/styles.css`
- Modify: `app/components/ScoreEvidencePanel.tsx`
- Test: `src/__tests__/visualConsoleWeb.test.ts`
- Test: `src/__tests__/visualConsoleWeb.visual.test.ts`

- [ ] **Step 1: 先加 reader-focused 结构测试**

```ts
it("renders knowledge base as summary-first reader with meta rail", async () => {
  const html = await (await fetch(`${server.localUrl}kb?lang=en&slug=openai-codex&date=2026-05-01`)).text();
  expect(html).toContain('data-surface-role="reader"');
  expect(html).toContain('data-surface-id="kb-executive-summary"');
  expect(html).toContain('data-surface-id="kb-machine-notes"');
  expect(html).toContain('data-surface-id="kb-human-notes"');
  expect(html).toContain('data-surface-id="kb-meta-rail"');
  expect(html).toContain('data-inline-reader-focus="true"');
  expect(html).toContain('data-kb-footnotes="true"');
  expect(html).toContain('data-kb-provenance="true"');
  expect(html).toContain('data-brief-kind="lightweight-brief"');
});
```

- [ ] **Step 2: 实现 `Knowledge Base Route Frame`**

```ts
export function renderKnowledgeBaseRoute(model: KnowledgeBaseViewModel, requestUrl: URL, lang: UiLang): string {
  const drilldownHtml = model.selected_card ? renderKbDrilldown(model, requestUrl, lang) : "";
  return `
    <section class="route-frame kb-route-frame">
      ${renderHeroSurface(model.frame.hero, { id: "kb-executive-summary" })}
      ${renderReaderSurface("kb-machine-notes", renderMachineNotes(model, lang))}
      ${renderReaderSurface("kb-human-notes", renderHumanNotes(model, lang))}
      ${renderRailSurface("kb-meta-rail", renderKbMetaRail({
        linkedContext: renderLinkedContext(model, requestUrl, lang),
        footnotes: renderKbFootnotes(model, requestUrl, lang),
        provenance: renderKbProvenance(model, lang),
        lightweightBriefs: renderLightweightBriefs(model, requestUrl, lang),
      }))}
      ${drilldownHtml ? renderDockSurface("kb-related-dock", drilldownHtml) : ""}
      ${drilldownHtml ? renderInlineReaderFocus("kb-inline-reader-focus", drilldownHtml) : ""}
    </section>
  `;
}
```

- [ ] **Step 3: 统一 Reader/Dock 的桌面与移动端契约**

```css
.reader-dock {
  position: sticky;
  top: var(--dock-top-offset);
  max-height: calc(100vh - var(--dock-top-offset) - var(--space-6));
  overflow-y: auto;
}

.reader-inline-focus {
  display: none;
}

@media (max-width: 640px) {
  .reader-dock {
    position: fixed;
    inset: 0;
    max-height: none;
  }

  .reader-inline-focus {
    display: block;
  }
}
```

- [ ] **Step 4: 把编号、证据锚点、回链语法统一成 shared primitive**

```ts
export function renderEvidenceAnchor(anchor: EvidenceAnchorModel): string {
  return `<a class="evidence-anchor" data-evidence-anchor="true" href="${anchor.href}"><span class="anchor-code">${anchor.code}</span>${escapeHtml(anchor.label)}</a>`;
}
```

- [ ] **Step 5: 跑目标测试**

Run: `npm run test:visual-console:web && npm run test:visual-console:web:visual`

Expected: KB 继续保留 linked context / footnotes / provenance，轻量卡片明确标识为 `lightweight brief`，Related Drilldown 在桌面走 `Dock`、在 reader-first 场景走 `Inline Reader Focus`，Dock/Reader 桌面独立滚动与移动端全屏 reader 都通过。

- [ ] **Step 6: 提交**

```bash
git add app/visualConsole/renderKnowledgeBase.ts app/server.ts app/styles.css app/components/ScoreEvidencePanel.tsx src/__tests__/visualConsoleWeb.test.ts src/__tests__/visualConsoleWeb.visual.test.ts
git commit -m "feat: implement ui v3 reader dock and anchor language"
```

### Task 7: 收敛 V3 token、typography、motion、responsive 与 accessibility

**Files:**
- Modify: `app/styles.css`
- Modify: `app/server.ts`
- Test: `src/__tests__/visualConsoleWeb.visual.test.ts`

- [ ] **Step 1: 先写视觉断言，锁定 V3 token 与 layout 行为**

```ts
it("keeps desktop stage-rail-dock, tablet collapse, mobile full-reader behavior, and resilient long-content layout", async () => {
  await page.goto(`${server.localUrl}overview?lang=en&date=2026-05-01&theme=light`);
  await expect(page.locator("[data-atmosphere-layer='paper-frame']")).toHaveCount(1);
  await expect(page.locator("[data-typography='hero-title']")).toHaveCount(1);
  await page.goto(`${server.localUrl}overview?lang=en&date=2026-05-01&theme=dark`);
  await expect(page.locator("[data-atmosphere-layer='instrument-grid']")).toHaveCount(1);
  await expect(page.locator("[data-route='overview'] [data-surface-id='overview-instrument-strip']")).toHaveCount(1);
  await expect(page.locator("[data-route='projects'] [data-surface-id='projects-dossier-dock']")).toHaveCount(1);
  await expect(page.locator("[data-route='projects'] [data-dock-section='evidence']")).toHaveCount(1);
  await expect(page.locator("[data-route='kb'] [data-surface-role='reader']")).toHaveCount(2);
  await expect(page.locator("[data-metric-kind='time']")).toHaveCSS("font-variant-numeric", "tabular-nums");

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${server.localUrl}projects?lang=en&date=2026-05-01&project=openai%2Fcodex`);
  await expect(page.locator(".route-frame.is-tablet-single-stage")).toHaveCount(1);
  await expect(page.locator(".route-rail.is-collapsed")).toHaveCount(1);

  await page.goto(`${server.localUrl}kb?lang=zh&slug=long-mixed-content&date=2026-05-01`);
  await expect(page.locator("[data-long-content-fixture='true']")).toHaveCount(1);
  await expect(page.locator(".reader-frame.is-overflowing")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".reader-dock.is-mobile-fullscreen")).toHaveCount(1);
  await expect(page.locator("[data-route='kb'] [data-inline-reader-focus='true']")).toHaveCount(1);
});
```

- [ ] **Step 2: 落地字体 token 与等宽数字契约**

```css
:root {
  --font-display: "IBM Plex Sans", "Segoe UI", sans-serif;
  --font-body: "Noto Sans SC", "Segoe UI", sans-serif;
  --font-mono: "IBM Plex Mono", "SFMono-Regular", monospace;
}

[data-typography="hero-title"] {
  font-family: var(--font-display);
}

[data-typography="body-copy"] {
  font-family: var(--font-body);
}

[data-metric-kind="time"],
[data-metric-kind="score"],
[data-metric-kind="status"] {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: 把主题 token 从 V2.5 名称升级为 V3 语法**

```css
:root {
  --shell-surface: color-mix(in srgb, var(--parchment) 82%, transparent);
  --stage-surface: color-mix(in srgb, var(--stone) 92%, transparent);
  --rail-surface: color-mix(in srgb, var(--stone) 84%, transparent);
  --audit-surface: color-mix(in srgb, var(--warning-ochre) 12%, var(--stone));
  --frame-border-strong: rgba(58, 54, 42, 0.22);
  --signal-cyan: #3db7c6;
  --risk-brick: #9b4b3f;
}

[data-theme="dark"] {
  --shell-surface: color-mix(in srgb, var(--graphite) 84%, transparent);
  --stage-surface: color-mix(in srgb, var(--ink) 92%, transparent);
  --rail-surface: color-mix(in srgb, var(--graphite) 76%, transparent);
  --audit-surface: color-mix(in srgb, var(--warning-amber) 14%, var(--ink));
}
```

- [ ] **Step 4: 只保留设计文档允许的四类 P0 动效**

```css
.scene-shift-enter { transition: opacity 180ms ease, transform 180ms ease; }
.instrument-response { transition: background-color 140ms ease, border-color 140ms ease; }
.dock-open-close { transition: transform 180ms ease, opacity 180ms ease; }
.reader-focus { transition: box-shadow 160ms ease; }
```

- [ ] **Step 5: 显式守住 a11y 约束**

```css
:focus-visible {
  outline: 2px solid var(--signal-cyan);
  outline-offset: 3px;
}

.status-band[data-state="failed"]::before { content: "Failed"; }
```

- [ ] **Step 6: 跑视觉测试**

Run: `npm run test:visual-console:web:visual`

Expected: Desktop 保持 `stage + rail + dock`，tablet 进入单列主舞台 + 次轨折叠，mobile 进入 segmented reader，长 repo 名/长摘要/中英混排/长 URL 不破版，标题/正文/指标字体分工明确且指标使用 `tabular-nums`，全站状态表达不只依赖颜色，且 Light / Dark 都保留稳定的工作台氛围层而不是仅换色。

- [ ] **Step 7: 提交**

```bash
git add app/styles.css app/server.ts src/__tests__/visualConsoleWeb.visual.test.ts
git commit -m "feat: finalize ui v3 typography tokens motion and accessibility"
```

### Task 8: 运行完整验证并同步账本

**Files:**
- Modify: `docs/specs/exec-plans/trend-radar-ui-v3-stage-redesign-v0.1.exec-plan.md`
- Modify: `docs/specs/exec-plans/README.md`

- [ ] **Step 1: 运行 exec-plan 预检**

Run: `npm run exec-plan:review:preflight && npm run exec-plan:preflight`

Expected: 计划结构、索引登记、章节完整性全部通过。

- [ ] **Step 2: 运行类型、结构、Web、视觉回归**

Run: `npm run typecheck && npm run test:visual-console && npm run test:visual-console:web && npm run test:visual-console:web:visual`

Expected: 结构测试、语义测试、视觉测试全部通过，且覆盖 `Overview` 的 strip/dock、`Projects` 的 frozen dock IA、`Weekly` 的 no-core-trend audit、`Run Health` 的多通道状态表达与 `Audit` 解释入口、`Knowledge Base` 的 dock or inline reader focus，以及 `Time Navigator` 的 preview lane / daily-weekly window semantics、tablet 降级和长内容不破版。

- [ ] **Step 3: 如仓库 `lint` 在该变更集下可运行，则补跑**

Run: `npm run lint`

Expected: 无新引入质量门禁回归；若因仓库既有债务失败，需在验证记录中显式记录而不是忽略。

- [ ] **Step 4: 回填实施状态、验证记录、残余风险与下一阶段入口**

```md
- 当前状态：`Implemented`
- ExecPlan 预检：`Passed`
- 结构/视觉回归：`Passed`
- 残余风险：仅保留设计文档允许的 P1/P2 项，不在本计划内继续扩写
```

- [ ] **Step 5: 提交**

```bash
git add docs/specs/exec-plans/trend-radar-ui-v3-stage-redesign-v0.1.exec-plan.md docs/specs/exec-plans/README.md
git commit -m "docs: finalize ui v3 stage redesign exec plan"
```

## 验收标准

### 验收 1：整站从卡片墙升级为工作台

- 可观察结果：首屏稳定呈现 `Shell Hero -> Context Instrument Bar -> Content Stage`，并且 `Content Stage` 内继续表达 `Route Frame -> Surface Role -> Dock/Reader`。
- 成功条件：DOM 和样式都不再依赖单层 `panel/card` 伪装层级；页面第一眼更像 `Intelligence Terminal`，而不是玻璃后台或营销页。
- 成功条件补充：首屏必须先出现 route-level 主舞台，而不是“壳层说明 + 路由入口卡片拼盘”；用户第一眼看到的应是业务主内容或控制中台主画布，而不是导航卡。
- 失败条件：继续用等权卡片或大块容器堆出层级，路由人格仍只能靠颜色差异辨认。
- 失败条件补充：如果 `Shell Hero` 继续占据首屏最大面积，或顶部/侧边导航仍被实现成内容卡片集合，则即使 `surface role`、测试和 token 全部通过，仍判定失败。

### 验收 2：五个一级路由都有明确人格与顺序

- `Overview`：`Hero(trust gate + lead decision + next action) -> Rail(weekly entry + run health + risk watchpoints) -> Strip(source health / time / status + interest profile tool zone) -> Stage(spotlight continuation + research stream) -> Dock(selected project detail)`
- `Projects`：`Strip(filter bench + context chips) -> Stage(scan rows) -> Dock(Why It Matters -> Evidence -> Risks -> Next Actions, with row-to-dock Evidence Anchor) -> Rail(watchpoints / reading hints)`
- `Weekly`：`Hero(cover) -> Rail(overall weekly judgment) -> Stage(evidence matrix) -> Stage(core trend storyline or no-core-trend audit) -> Strip(weak signals) -> Strip(watchpoints) -> Dock(project detail / trend-linked drilldown)`
- `Run Health`：`overall judgment -> source status -> verify/audit -> recommended actions`
- `Knowledge Base`：`executive summary -> machine notes -> human notes -> meta rail(linked context / footnotes / provenance + lightweight brief labeling) -> related dock or inline reader focus`

### 验收 3：Time Navigator、锚点、证据导视与状态带统一

- 可观察结果：`Prev / Next / Latest` 继续可用，但变为 `instrument strip`；daily 与 weekly 语义明显区分；`Evidence Anchor`、编号前缀、状态带跨路由一致。
- 失败条件：Time Navigator 再次退回按钮堆，或 weekly/day 语义混淆。

### 验收 4：不突破冻结边界

- 不改 route set、URL 语义、artifact 边界、只读消费、审计可追溯。
- 不新增第二真相源，不新增前端排序真相、趋势真相、freshness 真相。
- 不把 render 重构带到 `read layer / context layer / truth layer`。

### 验收 5：效率验收成立

- 用户能在 `10-15` 秒内判断当前结果是否值得继续消费。
- 用户能在 `Projects` 中快速完成扫描并打开一个详情。
- 用户能在 `Weekly` 中一眼读出主趋势与证据矩阵关系。
- 用户能在 `KB` 中先读结论，再决定是否深入。

### 验收 6：桌面/移动端 Dock 与 Reader 行为成立

- 桌面端：保留 `stage + rail + dock`，detail 独立滚动、可关闭、可恢复。
- 平板端：允许降级为单列主舞台 + 次轨折叠，但不得丢失主舞台、详情回链和焦点返回路径。
- 移动端：允许降级为 `strong hero + segmented reader`，Dock 可全屏阅读且返回路径清晰。

### 验收 7：动效、响应式、可访问性和性能受控

- 只保留四类 P0 动效。
- 状态表达不只依赖颜色，并且关键状态至少同时具备文本标签、状态带/语义色、图标或形状钩子、解释入口。
- Light / Dark 两套主题都必须保留独立的工作台氛围层，不能退化成纯 token 换色。
- 背景氛围不影响正文对比度。
- 长 repo 名、长摘要、中英混排和长 URL 不破版。
- 不为氛围层引入重型前端运行时。

## 关键负例

- `Overview` 首屏如果再次出现多个等权 hero，判定失败。
- `Overview` 如果把 `lead decision` 从单一 Hero 拆出去，或遗漏 `Strip / Dock`，判定失败。
- `Projects` 如果退回“一项目一张等权卡”，判定失败。
- `Projects` 如果 `Dock` 内部不再固定为 `Why It Matters -> Evidence -> Risks -> Next Actions`，或 `Evidence Anchor` 不能连通行内摘要与详情，判定失败。
- 同一业务对象如果在 `Hero`、`Rail`、`Dock` 中以同等视觉权重重复出现，或计划未标明主次关系，判定失败。
- `Weekly` 如果 `Weak Signals` 与 `Core Trend` 共享同一主舞台带且无主次，判定失败。
- `Weekly` 如果没有 `Core Trend` 时把 `Weak Signals` 提升成主舞台而不是进入受控空态 / 审计态，判定失败。
- `Run Health` 如果把 `Audit` 伪装成普通结果卡，判定失败。
- `Run Health` 如果 `failed / degraded / stale / empty / not-judgeable` 仍只靠颜色区分，或缺少文本/图形/解释入口任一要素，判定失败。
- `Knowledge Base` 如果正文再次退化为字段堆叠，或既没有 `Dock` 也没有 `Inline Reader Focus` 承接下钻，判定失败。
- `Dock` 如果再次变成普通顺序内容列而非固定停靠阅读面板，判定失败。
- 任一断点如果平板未能降级为单列主舞台 + 次轨折叠，或移动端未提供清晰返回路径，判定失败。
- 任一视图如果因长 repo 名、长摘要、中英混排或长 URL 发生破版，判定失败。
- 任一实现如果改写 `src/visualConsole/context.ts` 的 `latest`、`date / anchor`、nearest weekly anchor 语义，判定越界失败。
- 任一可视化如果通过文件时间、系统时间或前端推导补算 freshness/trend，判定越界失败。

## 验证矩阵

| 类型 | 验证内容 | 命令 / 方法 | 通过标准 |
| --- | --- | --- | --- |
| 计划 | ExecPlan review 预检 | `npm run exec-plan:review:preflight` | 计划结构与索引登记通过 |
| 计划 | ExecPlan 结构预检 | `npm run exec-plan:preflight` | 新计划可被仓库规则识别 |
| 类型 | TypeScript 类型检查 | `npm run typecheck` | 新增 frame/surface 类型无错误 |
| 结构 | visualConsole 只读语义回归 | `npm run test:visual-console` | `artifact-first`、URL 语义、state priority 继续成立 |
| Web | 路由与 detail 结构回归 | `npm run test:visual-console:web` | 路由顺序、`Overview` hero/rail/strip/stage/dock、`Projects` frozen dock IA、`Weekly` no-core-trend audit、`Run Health` audit order 与多通道状态表达、`Time Navigator` preview lane 与 daily/weekly window semantics、detail swap、source context 全部通过 |
| 视觉 | 视觉/断点/滚动/focus 回归 | `npm run test:visual-console:web:visual` | shell、route persona、dock/reader、desktop/tablet/mobile responsive、focus-visible、KB footnotes/provenance/lightweight brief、Light/Dark 氛围层、inline reader focus、长 repo 名/长摘要/中英混排/长 URL 不破版，以及 typography/tabular numerics 全部通过 |
| 场景 | 效率验收 walkthrough | 人工 walkthrough：`overview -> projects -> weekly -> kb` | 能在 `10-15` 秒内完成“是否继续消费”的首轮判断；`Projects` 可快速扫描并打开详情；`Weekly` 可直接建立主趋势与证据矩阵关系；`KB` 可先读结论再决定是否深入 |
| 质量 | 质量门禁 | `npm run lint` | 无本次引入的 quality gate 回归 |
| 冒烟 | 本地启动 | `npm run visual-console:web` | 本地 Web 入口可启动并访问五个主路由 |

## 回滚策略

1. 如果 Page Frame / Surface Role 模块拆分引入路由不可访问问题，先回滚到“server 仍集中调度，但保留 `frame` 数据结构”的中间态，不回退设计边界。
2. 如果某个路由的舞台化改造破坏 detail scroll / close / focus return，优先回滚该路由 render 模块，不回滚全局 Shell Hero / Instrument Bar。
3. 如果视觉 token 改造导致对比度或移动端阅读失真，回滚 token 与 layout 映射，不回滚路由 frame 模型。
4. 如果 visual regression harness 因环境问题不稳定，修 harness，不删除 visual assertion。

## 已落地内容（历史记录，非现状判断）

- 已完成 UI V3 的 SSR shell / route frame / surface role 落地，并保持 `artifact-first`、URL 语义、detail 局部替换与 request-level cache 不变。
- 已在 `app/server.ts`、`app/styles.css` 与 `app/visualConsole/*` 上完成 phase V3-5 收口：补齐 `data-theme`、`data-typography`、`data-metric-kind`、双 atmosphere layer、status band 语义、dock/rail 响应式状态类与 motion hooks。
- 已在 `src/__tests__/visualConsoleWeb.visual.test.ts` 修复 Playwright bundled runtime 解析逻辑，恢复 browser visual regression 执行能力，并新增 phase5 桌面/平板/移动端 reader-dock、typography 与 metric hook 断言。
- 但以上内容仅代表结构脚手架和测试基线存在，不再自动等价于“现代控制中台布局已达成”。

## 验证记录

| 日期 | 项目 | 状态 | 记录 |
| --- | --- | --- | --- |
| 2026-05-18 | `trend-radar-ui-v3-stage-redesign-design.md` 对齐复核 | 已完成 | 已逐条核对范围、非目标、冻结边界、工程触达面与验收矩阵，并据此生成本执行计划 |
| 2026-05-18 | `npm run exec-plan:review:preflight` | Passed | exec-plan review skill 与 receipt 校验通过 |
| 2026-05-18 | `npm run exec-plan:preflight` | Passed | code implementation preflight 与 exec-plan receipt 校验通过 |
| 2026-05-18 | `npm run typecheck` | Passed | TypeScript 无新增错误 |
| 2026-05-18 | `npm run test:visual-console:web` | Passed | 23 个 Web 结构/语义测试全部通过 |
| 2026-05-18 | `npm run test:visual-console:web:visual` | Passed | 10 个 browser visual regression 测试全部通过，visual harness 不再被整体 skip |
| 2026-05-18 | `npm run test:visual-console` | Passed | visualConsole + cliWorkflow 共 56 个相关测试全部通过 |
| 2026-05-18 | `npm run lint` | Passed | quality gate 已转绿；此前集中在 `src/action/projectBriefs.ts`、`src/llmClassification.ts`、`src/signal/githubMetrics.ts` 与 `src/visualConsole/build.ts` 的回归项已完成治理 |

## 结论记录

- `LAYOUT DRIFT CONFIRMED`
- 浏览器端已经具备 `Shell Hero -> Context Instrument Bar -> Content Stage -> Route Frame -> Surface Role -> Dock/Reader/Audit` 的命名结构，但这还不等于现代化布局已落地。
- 当前真实问题在于首屏构图、导航形态和壳层厚度仍停留在旧后台骨架，导致 UI-V3 的目标只完成了“语义脚手架”，没有完成“现代控制中台布局”。
- 后续修复优先级应是：先修 layout grammar，再修视觉皮肤；先修 viewport 主次，再修 token 细节。
- P1/P2 中的高级切片预览、密度预设开放、命令面板、可分享视图增强全部后置，直到本次 layout realignment 完成。

## 下一阶段入口

1. 如需继续推进 P1/P2 的密度预设、命令面板或可分享视图增强，单开新的 follow-up exec-plan。
2. 后续任何 UI V3 变更继续复用本计划的验证矩阵，尤其保留 browser visual regression 与 Dock/Reader 响应式断言。
