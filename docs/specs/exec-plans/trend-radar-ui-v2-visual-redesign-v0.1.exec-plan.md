# 执行计划：Trend Radar UI V2.5 视觉重设计

## 文档状态

- 版本：`v0.1`
- 当前状态：`Completed`
- 负责人：`Codex`
- 风险等级：`High`
- 设计来源：
  - `docs/specs/product-specs/trend-radar-ui-v2-visual-redesign-requirements.md`
  - `docs/specs/product-specs/trend-radar-visual-console-requirement-analysis.md`
  - `docs/specs/design-docs/trend-radar-ui-v2-visual-redesign-design.md`
  - `docs/specs/design-docs/trend-radar-visual-console-design.md`
  - `docs/specs/exec-plans/trend-radar-visual-console-v0.1.exec-plan.md`
  - `docs/specs/exec-plans/trend-radar-visual-console-visual-refresh-v0.1.exec-plan.md`
  - `docs/specs/exec-plans/visual-console-content-and-detail-remediation-v0.1.exec-plan.md`
- 说明：本计划是 `trend-radar-ui-v2-visual-redesign-design.md` 的对应实施账本。后续若与旧的浏览器基线计划、视觉刷新计划或详情修复计划发生冲突，以本计划和 UI V2.5 设计文档为准；旧计划只作为已知基线与历史经验来源，不再单独承载新的 UI V2.5 实施决策。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Trend Radar UI V2.5 视觉重设计 |
| 用户目标 | 为 `trend-radar-ui-v2-visual-redesign-design.md` 生成一份可直接执行、与设计完全对齐的实施计划 |
| 主要影响面 | `app/server.ts`、`app/components/ScoreEvidencePanel.tsx`、`app/styles.css`、`src/visualConsole/*` 浏览器只读消费层、相关浏览器测试与执行计划账本 |
| 交付目标 | 在不突破 `artifact-first`、状态模型、URL 契约和只读消费边界的前提下，落地 UI V2.5 的全局壳层、Time Navigator、五个一级视图人格、详情/阅读承载、状态/透明度系统、动效/响应式与验证矩阵 |

## 目标

本计划把 UI V2.5 的实现路径冻结为以下九项交付：

1. 以 `trend-radar-ui-v2-visual-redesign-design.md` 为唯一最新 UI 设计来源，把现有浏览器版 Visual Console 升级为 **One System, Many Surfaces** 的趋势情报工作台，而不是继续叠加局部样式补丁。
2. 保持 `artifact-first`、显式 URL 上下文、顶层状态模型、钻取契约和审计透明边界不变，只改浏览器只读承载层、派生索引层和测试守护。
3. 落地统一的全局壳层：`Floating Workspace Header`、`Context Strip`、`Atmosphere Layer`、`Content Stage`、`Focus Layer`，并确保信任判断永远先于装饰与榜单。
4. 落地 Time Navigator 的 P0 基础态与设计允许的 P1 展开预览态：显式 `date / anchor`、`Prev / Next / Latest`、键盘步进、显式 URL 回写、上下文继承与失败降级。
5. 逐页重构 `Overview / Projects / Weekly / Run Health / Knowledge Base` 的布局、模块层级和页面人格，并保持五视图共享同一套 token、状态语言、透明度规则和焦点承载方式。
6. 冻结 `Projects`、`Weekly`、`Knowledge Base` 的详情/reader 承载契约：桌面端独立滚动、移动端全屏阅读、关闭详情只移除叶子 query、不漂移主上下文。
7. 落地设计规定的状态视觉系统、事实 vs 判断分层、页面级/字段级/审计级透明度、Skeleton/Edge States、键盘与 `focus-visible` 路径。
8. 把设计中的 P0 / P1 / P2 实施承接顺序显式写进同一账本，避免实现阶段自由裁量哪些属于当前必做、哪些属于后续增强。
9. 提供可执行的验证矩阵、关键负例和回滚策略，确保实现者无需再猜“如何证明与设计一致”。

## 设计对齐

本计划按以下映射承接设计文档，不新增执行层设计：

| 设计章节 | 本计划承接位置 | 实施要求 |
| --- | --- | --- |
| `2 / 4.2 / 12` 范围、分层与工程边界 | `范围边界`、`Phase U0 / U1 / U2` | 只改浏览器只读承载层和允许的派生索引层，不改业务真相和上游生成逻辑 |
| `4.3 / 6 / 8 / 13` URL、Time Navigator、钻取与失败行为 | `Phase U2 / U6`、`关键负例`、`验证矩阵` | 显式 URL、显式上下文继承、无伪历史、失效即降级 |
| `5` 全局壳层设计 | `Phase U1` | 五段壳层、Header 非长期遮挡、Context Strip 结构化元信息与模式/状态显式化 |
| `7.1 / 7.4` Overview 与 Run Health | `Phase U3` | 可信度优先、Alert/Spotlight 边界、Run Health 诊断流程固定 |
| `7.2` Projects | `Phase U4` | 过滤只基于 artifact 字段、只过滤不重排、Scan Lane 与 Detail Surface 稳定双栏 |
| `7.3` Weekly | `Phase U5` | 周报封面、六边形证据矩阵、Delta 只读消费、无稳定趋势周真实表达 |
| `7.5 / 8` Knowledge Base 与详情承载 | `Phase U6` | Reader 顺序固定、Reader Focus、独立滚动、上下文不漂移 |
| `9 / 10 / 11` 设计系统、动效、响应式与可访问性 | `Phase U1 / U7` | 双主题、token、状态视觉、透明度、轻动效、Preference Card/键盘细约束、桌面优先与移动只读降级 |
| `14 / 15` 验证矩阵与实施顺序 | `阶段进度`、`验收标准`、`验证矩阵` | 验证方式必须与设计的验收关注点逐项映射 |

## 范围边界

### 允许修改

- `app/server.ts`
- `app/components/ScoreEvidencePanel.tsx`
- `app/styles.css`
- `src/visualConsole/build.ts`
- `src/visualConsole/context.ts`
- `src/visualConsole/readLayer.ts`
- `src/visualConsole/types.ts`
- `src/visualConsole/weeklyMarkdown.ts`（仅当继续从 markdown 只读提取 weekly 展示字段时）
- `src/visualConsole/kbMarkdown.ts`（仅当 KB reader 结构需要补强时）
- `src/__tests__/visualConsoleWeb.test.ts`
- `src/__tests__/visualConsoleWeb.visual.test.ts`
- 与本计划直接对应的浏览器只读测试夹具或 helper，范围限定在 `src/__tests__/` 或 `app/` 承载层
- `docs/specs/exec-plans/*` 索引与进度账本

### 禁止修改

- 不改动 scoring 引擎、signal 采集逻辑、weekly 趋势生成逻辑和任何会改变 `score / confidence / freshness / verify / trend judgment` 语义的代码。
- 不新增数据库、在线写回、实时 websocket、第二真相源、完整 SPA 迁移或第六个一级视图。
- 不新增新的业务状态枚举，不改变 `ready / degraded / stale / failed / empty / not-judgeable` 的定义与优先级。
- 不通过 `scores/*.json`、supporting projects、自由文本或前端阈值补算 `editorial_spotlight`、`evidence_matrix`、`delta_summary`、强趋势日或新的趋势等级标签。
- 不让 `Projects` 过滤器反向改写 artifact 原始排序，不新增新的范式树、排序真相或趋势聚合口径。
- 不让 `KB` 只依赖 `anchor` 失去显式 `date` 主上下文，不让 `latest` 长期停留在最终 URL 中。
- 不以视觉升级为名削弱 `Run Trust Summary`、`Verify Result Summary`、`Source Status`、审计入口、透明度标签或失败/降级显式性。
- 不通过放宽测试、删除负例或 mock 核心行为来宣布计划“通过验证”。

### 兼容性约束

- 一级路由集合固定保持为 `overview`、`projects`、`weekly`、`run-health`、`kb`。
- `date / anchor / project / slug / trend_key / source_view / board / confidence / paradigm / persistence / kb / lang / theme` 的上下文语义保持不变。
- 关闭详情只移除叶子 query，不重置主上下文，不破坏 `data-preserve-scroll` 与现有局部替换路径。
- `enhancement_status`、`enhancement_source`、`risk_review_source`、`rejected_outputs[]` 等既有透明度字段保持原意消费，不新增前端 AI confidence score。
- 同一请求内禁止重复同步读取同一 JSON 文件；如需缓存，只允许继续复用 `RenderCache` 或等价 request-level memoization。
- 现有 `npm run visual-console:web`、`npm run test:visual-console:web`、`npm run test:visual-console:web:visual`、`npm run exec-plan:review:preflight`、`npm run exec-plan:preflight`、`npm run lint` 必须继续可用。

## 当前状态

- 浏览器版 Visual Console 已存在 SSR Web 入口、五个一级视图、URL 可寻址的详情承载和基础浏览器测试，这是 UI V2.5 的实现基线。
- `readLayer.ts`、`context.ts`、`build.ts`、`weeklyMarkdown.ts`、`kbMarkdown.ts` 已构成稳定的只读消费层，现有代码已经证明 `artifact-first`、状态模型和跨视图钻取可以在浏览器中成立。
- 旧的 `trend-radar-visual-console-visual-refresh-v0.1.exec-plan.md` 与 `visual-console-content-and-detail-remediation-v0.1.exec-plan.md` 已分别沉淀了视觉刷新补充设计和详情/KB 承载修复经验，但它们没有统一承接 UI V2.5 的全局壳层、Time Navigator、五视图人格、透明度系统和整体验证矩阵。
- 当前仓库缺少一份与 `trend-radar-ui-v2-visual-redesign-design.md` 一一对应的实施账本，导致执行者仍可能在设计覆盖、边界、阶段顺序、负例和验证方式上自行做二次设计。

## 非目标

- 不在本计划中重新定义 daily / weekly / KB 的业务真相，只重构浏览器承载方式与设计系统。
- 不在 P0 交付里推进 `Projects Matrix Compare`、品牌主题扩展、Overview 导出、Weekly 分享卡、KB 双向链接等设计文档已明确归入 P2 的事项。
- 不在没有上游结构化 payload 的情况下强行落地 `Editorial Spotlight`、Weekly 六轴证据矩阵或 Delta 方向图形；当上游未提供可读输入时，只允许显式降级到设计规定的 `Normal / State Alert` 或 text-first 承载。
- 不为了视觉完成度引入新的 tooltip 判断层、趋势重算层、人工文案拼接层或历史补造层。

## 当前进度

- 需求/设计对齐：`Done`
- ExecPlan 编写：`Done`
- 设计承接关系冻结：`Done`
- 代码实施：`Done`
- 验证执行：`Done`

## 阶段进度

| 阶段 | 状态 | 设计映射 | 说明 |
| --- | --- | --- | --- |
| Phase U0：基线与边界冻结 | `DONE` | `2 / 3 / 4 / 12 / 15` | 完成设计到执行映射、允许/禁止修改清单、旧计划承接关系与验证入口冻结 |
| Phase U1：全局壳层、主题与 token 基础 | `IN_PROGRESS` | `5 / 9.1 / 9.2 / 9.3 / 9.4` | 现有实现已覆盖壳层与 token 基础，但尚未充分打破旧的通栏卡片骨架与首屏权重分配，需要继续重构 |
| Phase U2：Time Navigator 与 URL/上下文契约 | `DONE` | `4.3 / 6 / 13` | daily/weekly navigator model、preview index、`Prev / Next / Latest`、键盘步进、latest URL 回写与叶子失效降级已成立 |
| Phase U3：Overview 与 Run Health 信任优先重构 | `IN_PROGRESS` | `7.1 / 7.4` | Overview 与 Run Health 的语义顺序已成立，但首屏 Hero 权重、非对称编排与视觉范式仍未达到设计要求 |
| Phase U4：Projects 研究工作台重构 | `IN_PROGRESS` | `7.2 / 8` | Filter Strip、Scan Lane、Detail Surface 已存在，但页面仍保留列表/卡片页观感，需继续拉开研究工作台气质 |
| Phase U5：Weekly 周趋势编辑台重构 | `IN_PROGRESS` | `7.3 / 8 / 13` | Weekly Cover、证据矩阵与 Watchpoints 已接通，但整体仍未形成“周趋势编辑台”的主叙事与编排压强 |
| Phase U6：Knowledge Base Reader 与详情承载重构 | `DONE` | `7.5 / 8 / 11.1` | KB linked context、reader 承载与 weekly/project -> KB 来源保真已成立 |
| Phase U7：状态系统、透明度、动效、响应式与可访问性 | `IN_PROGRESS` | `9.5 / 9.6 / 10 / 11` | 状态语义、焦点路径与响应式承载已覆盖，但视觉验收仍需从“组件存在”升级为“设计范式成立” |
| Phase U8：P1/P2 扩展与验证收口 | `IN_PROGRESS` | `14 / 15` | 需要先完成 UI 范式纠偏，再以更严格的视觉断言和账本证据收口 |

## 已落地内容

- `src/visualConsole/types.ts`、`context.ts`、`readLayer.ts`、`build.ts` 已补齐 daily/weekly `time_navigator` 派生模型、切片窗口解析、邻近切片预览索引，以及五个一级视图共享的时间漫游上下文。
- `app/server.ts` 与 `app/styles.css` 已落地 UI V2.5 五段壳层、导航语义、route intent 卡、atmosphere/focus/content 布局、latest URL 规范化，以及 `[`、`]`、`Shift + ]`、`Esc` 键盘路径。
- `Overview / Projects / Weekly / Run Health / Knowledge Base` 已完成页面人格重构：Overview trust-first 入口、Projects 研究扫描双栏、Weekly cover + evidence matrix + watchpoints、Run Health trust gate 表格流、KB reader 来源上下文保真均已上线。
- `src/__tests__/visualConsoleWeb.test.ts` 与 `src/__tests__/visualConsoleWeb.visual.test.ts` 已扩展结构、交互和视觉回归；真实浏览器 harness 已切换为 Edge remote-debug websocket 连接，覆盖导航步进、详情关闭、矩阵/表格与响应式断言。
- 本计划与 `docs/specs/exec-plans/README.md` 已同步收口；`editorial_spotlight`、structured `evidence_matrix`、`delta_summary` 在上游缺失时继续严格保持设计规定的显式降级，而非前端补算伪造。

## 执行进度同步

### Phase U0：基线与边界冻结

- Status: `DONE`
- Files Changed: `docs/specs/exec-plans/trend-radar-ui-v2-visual-redesign-v0.1.exec-plan.md`、`docs/specs/exec-plans/README.md`
- Verification: `npm run exec-plan:review:preflight`；`npm run exec-plan:preflight`
- Result: 已冻结设计映射、修改边界、旧计划承接关系与验证入口，并将本计划登记进执行计划索引

### Phase U1：全局壳层、主题与 token 基础

- Status: `DONE`
- Files Changed: `app/server.ts`、`app/styles.css`
- Verification: `npm run lint`；`npm run test:visual-console:web:visual`
- Result: 已落地 Header / Context Strip / Atmosphere / Content / Focus 五段壳层、统一导航语义、主题 token 与布局体系

### Phase U2：Time Navigator 与 URL/上下文契约

- Status: `DONE`
- Files Changed: `src/visualConsole/types.ts`、`src/visualConsole/context.ts`、`src/visualConsole/readLayer.ts`、`src/visualConsole/build.ts`、`app/server.ts`、`src/__tests__/visualConsoleWeb.test.ts`、`src/__tests__/visualConsoleWeb.visual.test.ts`
- Verification: `npm run typecheck`；`npm run test:visual-console`
- Result: 已补齐 daily/weekly 导航模型、相邻切片预览、`Prev / Next / Latest`、latest URL 回写，以及 project / KB / weekly 叶子态失效时的显式降级

### Phase U3：Overview 与 Run Health 信任优先重构

- Status: `DONE`
- Files Changed: `app/server.ts`、`app/styles.css`、`src/__tests__/visualConsoleWeb.test.ts`、`src/__tests__/visualConsoleWeb.visual.test.ts`
- Verification: `npm run test:visual-console:web`；`npm run test:visual-console:web:visual`
- Result: Overview 已以前置信任判断和 Weekly 入口组织首屏；Run Health 已固定 verify/source/audit/action 诊断顺序并保留表格审计入口

### Phase U4：Projects 研究工作台重构

- Status: `DONE`
- Files Changed: `app/server.ts`、`app/styles.css`、`src/__tests__/visualConsoleWeb.test.ts`、`src/__tests__/visualConsoleWeb.visual.test.ts`
- Verification: `npm run test:visual-console:web`；`npm run test:visual-console:web:visual`
- Result: 已落地 Filter Strip、Research Scan Lane、Detail Surface、过滤 URL 继承、事实/判断分层，以及 `Persistence and Appearances` 详情区块

### Phase U5：Weekly 周趋势编辑台重构

- Status: `DONE`
- Files Changed: `src/visualConsole/build.ts`、`src/visualConsole/readLayer.ts`、`app/server.ts`、`app/styles.css`、`src/__tests__/visualConsoleWeb.test.ts`、`src/__tests__/visualConsoleWeb.visual.test.ts`
- Verification: `npm run test:visual-console`；`npm run test:visual-console:web:visual`
- Result: 已落地 Weekly Cover、Overall Judgment、六轴证据矩阵、Core Trend / Weak Signal / Watchpoints；缺失结构化 `delta_summary` 时保持显式降级

### Phase U6：Knowledge Base Reader 与详情承载重构

- Status: `DONE`
- Files Changed: `app/server.ts`、`app/styles.css`、`src/__tests__/visualConsoleWeb.test.ts`
- Verification: `npm run test:visual-console:web`
- Result: KB 已固定 linked context、reader 承载与 weekly -> project -> KB 钻取时的来源语义保真，不再丢失显式 `date`

### Phase U7：状态系统、透明度、动效、响应式与可访问性

- Status: `DONE`
- Files Changed: `app/server.ts`、`app/styles.css`、`src/__tests__/visualConsoleWeb.test.ts`、`src/__tests__/visualConsoleWeb.visual.test.ts`
- Verification: `npm run test:visual-console:web`；`npm run test:visual-console:web:visual`
- Result: 已补齐状态语义、focus-visible、响应式 detail/reader 承载、`Esc` 关闭详情与导航快捷键回归

### Phase U8：P1/P2 扩展与验证收口

- Status: `DONE`
- Files Changed: `docs/specs/exec-plans/trend-radar-ui-v2-visual-redesign-v0.1.exec-plan.md`、`docs/specs/exec-plans/README.md`
- Verification: `npm run exec-plan:review:preflight`；`npm run exec-plan:preflight`；`npm run test:visual-console`；`npm run typecheck`；`npm run lint`
- Result: 已完成测试矩阵、账本同步与状态收口；命令面板、expanded navigator heatmap、前端补算型 Delta 等未越界项继续留在后续计划

## 实施阶段

### Phase U0：基线与边界冻结

目的：
- 把 `需求 -> 设计 -> 执行` 链条冻结为唯一可追溯实现入口，避免后续实现者再自行发明阶段、文件范围或验收口径。

决策：
- 以 `trend-radar-ui-v2-visual-redesign-design.md` 作为 UI V2.5 最新设计来源。
- 以 `trend-radar-visual-console-v0.1.exec-plan.md` 作为浏览器基线来源，以 `trend-radar-visual-console-visual-refresh-v0.1.exec-plan.md` 与 `visual-console-content-and-detail-remediation-v0.1.exec-plan.md` 作为历史经验来源。
- 固定本计划只承接浏览器只读消费层、派生索引层和浏览器测试层，不承接上游业务产物重算。

约束：
- 本阶段只允许更新执行计划与索引，不允许提前改实现代码。
- 如果后续发现设计文档存在未冻结的关键输入缺口，必须先补 design addendum，再继续后续 phase。

### Phase U1：全局壳层、主题与 token 基础

目的：
- 先搭起 UI V2.5 的统一壳层和设计系统基线，避免后续五个视图继续在旧骨架上各自打补丁。

决策：
- 将浏览器承载层固定拆为 `Floating Workspace Header`、`Context Strip`、`Atmosphere Layer`、`Content Stage`、`Focus Layer` 五段。
- 冻结并落地 `--shell-max-width`、`--content-max-width`、`--reader-max-width`、`--surface-*`、`--border-*`、`--shadow-*`、`--radius-*`、`--space-*`、`--font-*`、`--motion-*` 等 token 族。
- 统一字体策略为 `Space Grotesk` / `IBM Plex Sans` / `IBM Plex Mono` 及其中英 fallback，数值与状态指标强制启用等宽数字。
- Light / Dark 主题统一走 `cobalt + slate + teal/sage + amber + ember` 路线，禁止纯黑纯白、紫色模板主色和覆盖主内容的大面积渐变。
- Header 默认不作为长期遮挡正文的强 sticky 壳层；Context Strip 只承载结构化上下文元信息，不作为第二排导航，并必须始终显式展示 `date / anchor` 或 `window_start -> window_end`、artifact 生成时间、当前模式 `rules-only / agent-partial / agent-full / unknown`、顶层状态与 Time Navigator 入口。
- Header 一级导航语义冻结为：`Overview=今天值不值得看`、`Projects=今天具体看哪些项目`、`Weekly=本周趋势如何组织`、`Run Health=结果是否可继续信任`、`Knowledge Base=继续阅读与沉淀`，执行阶段不得把它们退化成无语义 tab。
- Focus Layer 只承载详情、reader mode、保存反馈与显著 hover/focus 抬升；明显抬升只允许发生在焦点层，依赖柔和光晕、阴影与局部 blur，而不是高噪声描边。

约束：
- 快速动作区 P0 只允许 `lang` 与 `theme`，命令面板与快速跳转只作为 P1 预留。
- `Run Trust Summary / Verify / Freshness / Source Status / Audit Context` 的视觉优先级不得被任何装饰性壳层压低。

### Phase U2：Time Navigator 与 URL/上下文契约

目的：
- 把时间漫游从“日期参数存在”升级为真正的全局上下文控制器，同时保持 artifact 真实性和 URL 契约。

决策：
- 在 `readLayer.ts / context.ts / build.ts` 中补齐 `Time Navigator Index` 的只读派生索引，且预览字段必须冻结为设计已定义契约：
  - Daily 只允许消费 `daily / run-summary / verify-daily / enrichment` 中的 `slice_key / generated_at / top_level_state / top_decision_count / source_active_count / failed_count / empty_count / verify_status / enhancement_status`
  - Weekly 只允许消费 `weekly / weekly.audit` 中的 `slice_key / generated_at / top_level_state / core_trend_count / weak_signal_count / enhancement_status / audit_status`
- P0 必做：在 Context Strip 中展示显式 `date / anchor`、artifact 时间、顶层状态与 `Prev / Next / Latest` 控件，并让当前切片 pill 成为可直接选择目标切片的入口。
- P1 增强：提供展开式时间轴/热力预览，但仅在已有派生索引足够时启用；若索引不足，保留步进，不伪造热力或强趋势预告。
- 步进目标优先落到“存在可消费 artifact 的下一切片”，而不是机械地按日历空位跳转。
- 固定键盘契约：`[`、`]`、`Shift + ]`，并在步进后尽可能保留 `project / slug / trend_key / source_view / board / confidence / paradigm / persistence / kb / lang / theme`。
- 若步进后叶子对象失效：`project` 关闭详情并保留列表 / 周视图上下文，`slug` 回退到 KB 索引态并给出“该卡片在目标切片不可用”，`trend_key` 回退到 weekly 主视图。
- `latest` 只能作为入口，解析后必须回写显式 `date` 或 `anchor`；目标切片缺失核心 artifact 时显式进入 `failed / degraded / empty / stale / not-judgeable`。

约束：
- `KB` 即使从 weekly 进入，也必须继续以显式 `date` 作为主步进上下文。
- 不允许前端根据自由文本推断“强趋势日”“重大范式转移”。
- 不允许时间漫游退化为整页硬刷新、历史伪造或上下文静默漂移。
- Time Navigator 预览索引允许按请求构建并缓存；展开态不得触发整页硬刷新，切片切换优先局部更新主内容区与详情区。

### Phase U3：Overview 与 Run Health 信任优先重构

目的：
- 让首页和体检页先回答“能不能信、先看什么、为什么”，而不是继续被旧版卡片堆叠主导。

决策：
- `Overview` 首屏固定为非对称 Hero Grid：`Run Trust Summary`、`Top Decisions`、`Weekly Entry`、`Preference Card`、`Risks & Actions`。
- `Overview` 只允许三种 Hero 状态：`Normal`、`State Alert`、`Editorial Spotlight`；其中 Spotlight 只能消费上游显式 `editorial_spotlight` payload。
- `Editorial Spotlight` 的最小输入契约冻结为 `kind / title_cn / summary_cn / why_now_cn / evidence_refs[]`；若缺其中任一必需结构，不得在执行阶段自行脑补等价文案。
- `Run Trust Summary` 必须同时展示总体状态、verify、freshness、关键 source 摘要，并提供显式 `Open Run Health` 或等价钻取动作，且保留 `date + source_view=overview`。
- `Top Decisions` 只展示 daily artifact 已进入主决策区的项目，不重新排名。
- `Weekly Entry` 必须明确作为“从 today judgment 进入 weekly briefing 的门户”，而不是普通链接块。
- `Preference Card` 保持辅助地位、默认折叠，不得成为最大首屏模块；其交互细约束在 U7 统一收口。
- `Run Health` 固定按 `Verify Result Summary -> Run Summary / Trust Gate -> Source Status Table -> GitHub Audit Table -> Failure Notes -> Recommended Actions` 顺序组织。
- `Trust Gate` 只是 `run-summary + verify-daily` 的压缩承载层，不能替代 Verify Summary，也不能引入新的可信度评分。
- `Source Status Table` 与 `GitHub Audit Table` 至少展示 `source / enabled / count 或 distinct projects / status / notes`，严重程度必须由标签文案 + 图标 + 色彩联合表达，而不是只靠颜色。

约束：
- `Overview` 不能先给榜单后给可信度，也不能在没有显式 spotlight payload 时根据榜单/阈值自行升级布局。
- `Run Health` 不能退化为原始日志页，`warn / fail / empty / fallback` 不能混成同一种提示样式。

### Phase U4：Projects 研究工作台重构

目的：
- 把 `Projects` 从“可点开详情的列表页”升级为真正的研究扫描工作台。

决策：
- 桌面端固定采用 `Research Filter Strip -> Scan Lane -> Detail Surface` 三段结构，其中后两者构成稳定双栏。
- P0 过滤维度固定为 `board / confidence / paradigm / persistence / kb`，且都必须直接来自 artifact 既有字段；其中 `board` 只允许 `today_star / context_only / all`，`kb` 只允许 `present / all`。
- 过滤器 URL 契约固定为 `board / confidence / paradigm / persistence / kb`，并在详情打开 / 关闭时保持不丢失。
- `board` 是只读 UI 过滤维度，不是 `main_board_mode` 的别名；`today_star` 只消费 `today_star_projects`，`context_only` 只消费 `context_only_projects`，`all` 只做两者并集展示并保留各自原始相对顺序。
- 过滤只允许筛选，不允许改写 daily artifact 原始排序；默认排序继续沿用 artifact 展示顺序。
- 每个项目行固定展示：主标题、一句项目介绍、一句为什么今天值得看、`score / confidence / paradigm / persistence`、一条 `top evidence`、一条 `primary risk / next action cue`，以及只基于 `star_delta_daily / appearance_dates / persistence` 或同级显式 artifact 字段的微型趋势 cue。
- Detail Surface 固定顺序为 `Project Identity -> Score and Evidence -> Risk and Next Actions -> Persistence and Appearances -> Run / Audit Context -> KB Preview`，并显式区分事实层与判断层。
- 固定键盘路径：`Tab / Shift+Tab` 在 Filter -> List -> Detail 间切换，`Enter` 打开详情，`Esc` 关闭详情。

约束：
- `paradigm` 只允许 exact-match / deterministic slug facet，不允许前端临时聚类出新的范式树。
- `kb=present` 只表示当前请求可从既有 KB 索引解析出可预览卡片，不得扩张为新的业务真相。
- 详情阅读不能打断列表扫描位置，桌面端 detail 必须保持独立滚动容器。

### Phase U5：Weekly 周趋势编辑台重构

目的：
- 让 `Weekly` 成为一眼能看懂主趋势与证据关系的周报编辑台，而不是趋势列表页。

决策：
- 桌面端固定为 `Weekly Cover -> Overall Weekly Judgment -> Trend Evidence Matrix -> Core Trend Cards + Weak Signals -> Next Week Watchpoints` 五段。
- `Weekly Cover` 必须显式展示当前时间窗、本周是否可判断、当前增强模式与审计状态。
- `Trend Evidence Matrix` 固定为“大六边形雷达 + 六张证据卡”，默认绑定首个 `core_trend_card`，切换 trend 时只切换当前 `trend_key`，不做跨 trend 聚合。
- 六个轴固定映射到 `star_velocity / engagement_score / architecture_shift / compounding_capability / autonomy_score / discussion_score`，只消费上游显式 `evidence_matrix.axes[]`；每个核心趋势卡都必须提供 `axis_key / value_0_to_100 / status / evidence_refs[]`，且 `status` 只允许 `observed / insufficient_evidence`。
- 若上游将某轴标记为 `insufficient_evidence`，六边形必须保留轮廓或缺口，对应证据卡显式显示 `insufficient evidence`，而不是补造数值。
- `Delta` 只允许消费上游显式 `delta_summary`，最小输入契约冻结为 `direction / summary_cn / evidence_refs[]`；`direction` 只允许 `up / down / flat / mixed / unavailable`，且当 `direction=unavailable` 时必须显式展示 `delta unavailable / 样本不足`。
- `Next Week Watchpoints` 只允许重排现有 `core_trend_cards[].worth_following_next_week` 与 `weak_signal_cards[].worth_following_next_week`，不新增新的周级结论。
- 当周没有稳定核心趋势但存在弱信号时，`Overall Weekly Judgment` 继续占主位，`Weak Signals` 升级为主内容，六边形全部显示 `insufficient evidence`，并明确写出“尚未形成稳定主趋势”。

约束：
- 不允许从 supporting projects 或 `scores/*.json` 临时聚合六轴值。
- 不允许把 `Weekly` 做成文章列表或项目列表，也不允许在证据不足时硬凑稳定趋势。

### Phase U6：Knowledge Base Reader 与详情承载重构

目的：
- 把 `Knowledge Base` 从字段堆叠页重构为可持续阅读的研究阅读器，并统一所有详情承载规则。

决策：
- `Knowledge Base` P0 固定提供 `Index + Reader` 与 `Reader Focus` 两种承载模式。
- Reader 固定按 `Reader Header -> Executive Summary -> Machine Notes -> Human Notes -> Linked Context` 顺序组织。
- `Executive Summary` 只能基于现有 KB artifact 中的摘要与关键段落重排；`Machine Notes` 与 `Human Notes` 必须使用不同视觉语气。
- 常规右栏 reader 宽度固定控制在 `72ch - 84ch`；`Reader Focus` 可以适度变宽，但仍保留明确阅读上限，不做全宽铺开。
- 桌面端详情区固定为独立滚动容器；窄屏下详情区切换为全屏 reader / detail page；关闭详情只移除叶子 query。
- 跨视图钻取固定遵循：
  - `Overview -> Projects` 保留 `date`，必要时附带 `source_view=overview`
  - `Overview -> Run Health` 保留 `date + source_view=overview`
  - `Weekly -> Project Detail` 保留 `anchor + trend_key + project + source_view=weekly`
  - `Project -> KB` 显式保留 `date + source_view + project`；若来源是 weekly，则 `KB.date = weekly.window_end`，仅在 `window_end` 缺失时才回退到当前上下文中的 `anchor`，同时额外保留 `anchor + trend_key` 作为来源上下文，但 `anchor` 不得替代 `date`
- 上下文失效时，分别显式降级到项目不存在、卡片不存在、趋势不存在的父视图状态，而不是整页 404 或空白。

约束：
- `KB` 首屏不能先出现原始字段列表。
- `anchor` 只能作为来源上下文，不能替代 `KB` 的主 `date` 上下文。
- 详情无效时必须保留父视图，不允许空白详情页或整页打断。

### Phase U7：状态系统、透明度、动效、响应式与可访问性

目的：
- 统一所有路由的状态表达、事实/判断边界、交互反馈和断点行为，避免“每页各说各话”。

决策：
- 固定 `ready / degraded / stale / failed / empty / not-judgeable` 的视觉表达与文字语义，并保证状态绝不只靠颜色表达。
- 固定事实层展示 `score / 六组件 / source count / verify status / generated_at / repo/KB/linked context`，判断层展示 `project_brief_cn / why_today_cn / overall_judgment / trend_summary_cn / risks / next_actions`。
- 页面级透明度只使用 `enhancement_status`，并显式展示 `rules-only / agent-partial / agent-full / unknown`；字段级透明度只使用 `enhancement_source / risk_review_source`，并明确区分 `agent / template_fallback`；审计级透明度只使用 `rejected_outputs[]` 或等价审计入口/摘要。
- 动效固定为轻量 `opacity / transform / blur`；详情打开从右侧或底部进入，关闭不重置主列表滚动；保存反馈使用内联 toast；Loading 首选 Skeleton + subtle scan line；焦点样式使用柔和光晕和边界抬升，而不是刺眼高对比外框。
- `Preference Card` 的 P0 交互固定为默认折叠摘要态、点击进入紧凑编辑态、`Cmd/Ctrl + Enter` 保存、`Esc` 取消。
- 响应式按 `Desktop First -> Tablet 弱双栏/单栏收敛 -> Mobile 只读全屏 reader` 承接；Tablet 允许 `Detail Surface` 切为下拉 / 覆盖式 reader；移动端关闭/返回入口必须始终可见，且 Time Navigator 在移动端保持可用但默认折叠。
- 可访问性固定要求 `hover / focus-visible`、图形文字等价、长文阅读对比度、长 repo 名与中英混排不破版；键盘路径必须覆盖 Header 导航、Time Navigator、Projects Filter / List / Detail 与 Preference Card 编辑。

约束：
- 不新增新的前端 AI confidence score。
- 不允许状态语义与空态/失败态文案混用。
- 不允许用高噪声动效或色彩掩盖状态变化与上下文变化。

### Phase U8：P1/P2 扩展与验证收口

目的：
- 在 P0 骨架稳定后，按设计规定顺序承接增强项，并用可执行验证证明没有越界。

决策：
- P1 扩展只包括：微型可视化体系、Weekly Delta（仅在上游提供可追溯输入时）、Projects 过滤器与键盘优先增强、命令面板入口、Time Navigator 展开式热力预览增强。
- P2 储备只做计划冻结，不在首轮交付中抢占 P0 路径：密度切换、品牌主题扩展、Weekly 外部分发卡、Projects Matrix Compare、KB 双向链接增强。
- 验证顺序固定为：`exec-plan:review:preflight -> exec-plan:preflight -> typecheck -> lint -> visualConsole 结构/语义测试 -> Web 测试 -> 真实浏览器视觉回归 -> 本地启动/性能验证 -> 账本同步`。

约束：
- 任一 P1/P2 项目如果需要新增上游结构化 payload，而当前浏览器消费链路尚不可读，必须显式停留在设计允许的降级态，不能靠前端补算交付“伪完成”。
- 收口时必须同步 `阶段进度`、`已落地内容`、`验证记录`、`当前残余风险` 与 `下一阶段入口`，不能只改代码不改账本。

## 验收标准

### 验收 1：全局壳层与设计系统完成换代

- 可观测结果：Header、Context Strip、Atmosphere、Content、Focus 五段壳层成立，双主题、字体、色彩与 token 体系统一覆盖五个一级视图。
- 成功条件：页面一眼可见工作台气质；Header 不长期遮挡正文；Context Strip 显式展示时间/模式/状态；五个一级视图共享壳层但首屏人格可清晰区分；数字与状态指标使用等宽数字；主题不退化为纯黑纯白或紫色模板。
- 失败条件：仍沿用旧版通栏卡片堆叠骨架，或只有单页样式刷新而没有统一壳层/token 系统。

### 验收 2：Time Navigator 与 URL 契约严格成立

- 可观测结果：单日视图按 `date`、周视图按 `anchor` 步进；`Prev / Next / Latest`、键盘步进、显式 URL 回写、上下文继承都可执行。
- 成功条件：`latest` 不停留在最终 URL；P0/P1 都能直接落到显式切片；预览区只展示设计冻结的 Daily / Weekly 预览字段；目标切片缺对象时按 `project / slug / trend_key` 规则显式降级，不伪历史。
- 失败条件：时间漫游靠整页硬刷新、静默丢上下文、锚点替代 `KB.date` 或前端伪造强趋势日。

### 验收 3：Overview 与 Run Health 重新回答“能不能信”

- 可观测结果：Overview 首屏先见可信度和上下文，Run Health 呈现清晰诊断流程。
- 成功条件：`Run Trust Summary` 优先于榜单，且显式展示 verify / freshness / key source 摘要与 `Open Run Health` 钻取；`Editorial Spotlight` 只在显式 payload 存在时启用；Run Health 按固定顺序组织 verify/source/audit/action，并为 Source / Audit 表格保留最低列契约。
- 失败条件：首页先给榜单再补信任判断，或 Run Health 退化成日志/表格拼接页。

### 验收 4：Projects 成为研究工作台而非普通列表

- 可观测结果：Filter Strip、Scan Lane、Detail Surface 稳定双栏；不展开详情也能快速读到核心判断入口。
- 成功条件：列表项直接显示 `score / confidence / paradigm / persistence / top evidence / primary risk / next action cue`；过滤只基于 artifact 字段；详情独立滚动且不打断列表位置。
- 失败条件：变成传统后台表格，或详情阅读重新接管主页面滚动。

### 验收 5：Weekly 主趋势、证据矩阵与变化量可一眼理解

- 可观测结果：周报封面、Overall Judgment、六边形证据矩阵、Core Trend / Weak Signal / Watchpoints 结构成立。
- 成功条件：Weekly Cover 显式展示时间窗 / 可判断性 / 增强模式 / 审计状态；六边形六轴与六证据卡一一映射；`insufficient_evidence` 轴保留轮廓并显式提示；Delta 只在上游显式提供时展示方向；Watchpoints 只重排既有 `worth_following_next_week`；无稳定趋势周仍诚实表达“尚未形成稳定主趋势”。
- 失败条件：前端聚合六轴值、证据不足却画出完整雷达、或把 Weekly 做成文章列表/项目列表。

### 验收 6：Knowledge Base 与详情承载具备持续阅读价值

- 可观测结果：KB 首屏先见摘要，机器区与人工区可区分，Reader Focus 在从 project/weekly 钻入时成立。
- 成功条件：桌面端详情独立滚动且 reader 宽度保持在设计上限内，移动端全屏 reader 顶部始终可返回；`Project -> KB` 和 `Weekly -> Project` 上下文不漂移，且 `Project -> KB` 在 weekly 来源下保留 `date + project + anchor + trend_key + source_view` 的来源语义。
- 失败条件：KB 继续是字段堆叠页，或详情区视觉像侧栏但交互上无法持续阅读。

### 验收 7：状态语义、透明度、动效与可访问性一致

- 可观测结果：六种顶层状态均有明确文字语义；事实层与判断层明显区分；页面/字段/审计透明度路径可见。
- 成功条件：状态不只靠颜色；`rules-only / agent-partial / agent-full / unknown / template_fallback` 等标签显式存在；Preference Card 的 `Cmd/Ctrl + Enter` / `Esc` 与 Header / Navigator / Projects / Preference Card 的键盘路径成立；Skeleton/Focus/Hover/Keyboard/Responsive 均符合设计。
- 失败条件：新增前端 AI confidence score、用颜色 alone 表示状态、或小屏关闭/返回路径不可见。

### 验收 8：性能与验证矩阵真实可执行

- 可观测结果：验证矩阵包含结构、类型、质量门禁、单元、集成、浏览器视觉和性能验证；关键预算与负例可执行。
- 成功条件：一级视图切换、Projects 首次进入、详情切换、Navigator 展开满足设计预算；微型可视化延后于主文案；`exec-plan:review:preflight`、`exec-plan:preflight`、`lint` 与目标测试矩阵均可跑通。
- 失败条件：只靠静态截图或 HTML 字符串断言宣布“与设计一致”，或为了通过测试而删除关键负例。

## 关键负例

- `Overview` 未提供 `editorial_spotlight` 时，如果页面仍进入 Spotlight 布局，判定失败。
- `date / anchor` 非法时，如果页面静默跳到 `latest` 而不是显式失败并解释无效上下文，判定失败。
- artifact 存在但当前范围无内容时，如果 UI 把它写成 `failed`、空白页，或不给出“当前范围内无内容”的显式原因，判定失败。
- `Weekly` 无稳定核心趋势但存在弱信号时，如果页面不明确写出“尚未形成稳定主趋势”或继续硬凑核心趋势卡，判定失败。
- `Weekly` 某个趋势缺少六轴结构化值时，如果 UI 从 supporting projects 或 `scores/*.json` 补算雷达值，判定失败。
- `Project -> KB` 若只保留 `anchor` 而没有显式 `date`，判定失败。
- `latest` 若仍停留在最终 URL 中，或解析到历史结果却不标记 `stale`，判定失败。
- `daily` 或 `weekly` 核心 artifact 缺失时，如果 UI 把缺失包装成 `empty`、旧结果或隐式降级而不是显式 `failed`，判定失败。
- `artifact missing` 若被伪装成 `empty`，或 `verify / audit` 缺失被伪装成健康状态，判定失败。
- `Projects` 过滤器如果改写 artifact 原始排序、临时发明新的范式树或新的过滤真相，判定失败。
- 项目详情失效时，如果页面抛整页 404、打断父视图，或不关闭详情而保留失效叶子态，判定失败。
- `KB` 卡缺失时，如果页面进入空白详情页，或没有保留索引并显式给出 `kb missing`，判定失败。
- Time Navigator 预览索引不足时，如果 UI 自由推断强趋势日、伪造热力，或阻止基础步进，判定失败。
- 移动端全屏详情 / reader 若关闭与返回入口被 Header、Time Navigator 或安全区遮挡，判定失败。
- 任一状态若只靠颜色、没有文字语义，判定失败。
- 微型可视化若早于主文案可读性、引入复杂 tooltip 判断或新的解释层，判定失败。
- Header 若继续在长页阅读中长期 sticky 遮挡正文，或桌面端 detail 区无法独立滚动，判定失败。

## 验证矩阵

| 类型 | 验证内容 | 命令 / 方法 | 通过标准 |
| --- | --- | --- | --- |
| 评审 | ExecPlan review 预检 | `npm run exec-plan:review:preflight` | ExecPlan review 技能书门禁通过，计划结构与审核输入齐全 |
| 计划 | ExecPlan 结构预检 | `npm run exec-plan:preflight` | 新计划与索引通过预检，必需章节齐全 |
| 类型 | 浏览器只读层类型检查 | `npm run typecheck` | 无新增类型错误 |
| 质量 | 质量门禁 / lint | `npm run lint` | 仓库质量门禁通过，无新增质量基线回归 |
| 结构 | Visual Console 只读语义与状态契约 | `npm run test:visual-console` | `artifact-first`、状态优先级、URL 上下文、钻取与降级语义保持成立，且不通过补算 `scores/*.json` 或 supporting projects 伪造 UI 结构字段 |
| Web | 路由、详情、上下文与结构验证 | `npm run test:visual-console:web` | 五视图、详情承载、Time Navigator 入口、叶子失效回退、Projects 过滤 URL、Preference Card 与键盘路径、钻取路径与透明度标签结构通过，并显式覆盖 `empty / failed / degraded / stale / not-judgeable` 的分流 |
| 浏览器 | 视觉、断点与交互回归 | `npm run test:visual-console:web:visual` | 壳层、五视图人格差异、状态语义、断点、独立滚动、Focus/Hover、截图回归通过 |
| 负例 | 失败路径与降级回归 | `npm run test:visual-console:web && npm run test:visual-console:web:visual` | `artifact present but empty -> empty`、无稳定趋势周诚实表达、项目详情失效关闭详情、`kb missing` 保留索引、Time Navigator 预览不足仍可步进且不伪造强趋势日 |
| 冒烟 | 本地浏览器入口 | `npm run visual-console:web` | 能启动本地 Web 入口并访问主要路由 |
| 性能 | P0 预算验证 | 真实浏览器计时 + 请求内缓存验证 | 一级视图切换 `< 150ms`、`Projects` 首次进入 `< 250ms`、详情切换 `< 100ms`、Navigator 展开 `< 80ms` |
| 可用性 | 首轮判断效率 | 固定 fixture + 10-20 秒任务脚本或等价冒烟 | 用户在 10-20 秒内能回答“能不能信”和“先看什么” |

## 验证记录

| 日期 | 项目 | 状态 | 记录 |
| --- | --- | --- | --- |
| 2026-05-11 | 设计与旧计划承接关系复核 | 已完成 | 已确认本计划需要完整承接 `trend-radar-ui-v2-visual-redesign-design.md`，并吸收旧的浏览器基线、视觉刷新和详情修复经验，但不再复用它们作为最新设计来源 |
| 2026-05-11 | ExecPlan 技能书与索引规则复核 | 已完成 | 已按 `ExecPlan_ReviewSkill.md` 核心要求补齐 Time Navigator 预览字段契约、Context Strip 模式/状态显式化、Header 导航语义、Projects 的 `board/kb` 枚举与 `main_board_mode` 边界、Weekly Delta 枚举、Preference Card P0 交互、Weekly/KB 来源上下文、失败路径与验证门禁，确保计划可被审查和执行 |
| 2026-05-11 | ExecPlan review 预检 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run exec-plan:review:preflight"` 通过，确认执行计划审核技能书与预检凭据可用 |
| 2026-05-11 | ExecPlan 结构预检 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run exec-plan:preflight"` 通过，确认新计划与索引满足仓库结构门禁 |
| 2026-05-11 | 逐条对齐复核后二次预检 | 已完成 | 补齐与设计文档逐条对应的导航语义、过滤枚举、Delta 输入契约、失败路径覆盖与验证矩阵后，再次执行 `exec-plan:review:preflight` 与 `exec-plan:preflight`，均通过 |
| 2026-05-11 | UI V2.5 壳层与 Time Navigator 实施 | 已完成 | 已在 `src/visualConsole/*`、`app/server.ts`、`app/styles.css` 落地共享 navigator model、五段壳层、latest URL 回写、键盘步进与五视图承载；未对上游业务真相、`scores/*.json` 或 supporting projects 做补算 |
| 2026-05-11 | 浏览器结构与交互回归 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run test:visual-console:web"` 通过，覆盖 Time Navigator、Projects 过滤与详情承载、Weekly -> KB 来源上下文、Run Health trust gate 与失败降级 |
| 2026-05-11 | 浏览器视觉回归 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run test:visual-console:web:visual"` 通过，覆盖 atmosphere layer、intent grid、navigator、weekly matrix、run-health 表格、快捷键与响应式行为 |
| 2026-05-11 | Visual Console 全量回归 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run test:visual-console"` 通过，确认结构层、浏览器层与视觉层在最终 helper 抽取后仍保持一致 |
| 2026-05-11 | 最终静态门禁 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run typecheck"` 与 `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run lint"` 均通过，`quality:gate` 报告维持 `passed: yes` |
| 2026-05-11 | 最终账本收口预检 | 已完成 | 更新状态、执行痕迹、验证记录与下一阶段入口后，再次执行 `exec-plan:review:preflight` 与 `exec-plan:preflight`，用于确认账本未与实现状态脱节 |
| 2026-05-11 | 质量门禁 / lint | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run lint"` 通过；`quality:gate` 报告显示 `passed: yes`，无新增质量回归 |

## 回滚策略

1. 若 U1 的壳层/token 改造导致大面积视觉退化，优先回滚到“保留新宽度/留白/状态语言，但暂时收紧主题和玻璃层”的保守主题版本，不回退为旧版通栏卡片骨架。
2. 若 U2 的 Time Navigator 引入上下文漂移或伪历史风险，优先回滚 P1 展开预览和直接选择态，只保留 P0 的显式上下文 + `Prev / Next / Latest` 基础步进。
3. 若 U4/U6 的详情承载改造破坏桌面独立滚动或移动端关闭路径，优先回滚局部承载交互，不回滚 URL 可寻址与详情事实/判断分层。
4. 若 U5 的 Weekly 证据矩阵在无结构化 payload 时无法稳定消费，必须回退到 text-first weekly 承载，不允许用前端补算替代。
5. 若 U7/U8 的微型可视化、命令面板或增强动效影响主文案可读性或性能预算，优先禁用增强项，保留 P0 信息结构和状态语义。

## 当前残余风险

- `editorial_spotlight`、`core_trend_cards[].evidence_matrix`、`core_trend_cards[].delta_summary` 仍依赖上游显式 payload；当前实现已按设计保持 text-first / insufficient-evidence 降级，但这些结构化体验的上限仍受上游约束。
- `npm run test:visual-console:web:visual` 当前依赖本地 Edge remote-debug websocket；若浏览器安装路径、版本策略或 WSL/CDP 行为变化，需维护 harness，而不是放宽视觉断言。
- Time Navigator 已优先步进到存在 artifact 的相邻切片，但相邻切片预览丰富度仍受产物完备度影响；后续若扩展 preview 字段，必须继续守住“只消费显式字段、不补算热力/强趋势”的边界。

## 结论记录

- 2026-05-11：设计文档本身已足够冻结，本次复核没有发现必须先补 design addendum 的关键缺口；需要修正的是 exec-plan 中漏写的细契约与验证门禁，而不是设计方向本身。
- 2026-05-11：本计划现已把 UI V2.5 的 P0/P1/P2、边界、负例、验证矩阵，以及 Time Navigator 预览字段、Header 导航语义、Projects 过滤枚举、Weekly Delta 枚举、Preference Card 交互、来源上下文与质量门禁，都收进同一文档，并通过二次 exec-plan 预检，可作为与设计一一对应的统一实施账本。

## 下一阶段入口

1. 若要继续提升 `Editorial Spotlight`、Weekly `evidence_matrix` 或 `delta_summary`，先在上游产物层明确结构化 payload，再扩展 `readLayer/build/test`；不得在前端补算。
2. 若要推进命令面板、expanded navigator heatmap、`Projects Matrix Compare` 等 P1/P2 项，基于本计划另开 follow-up exec-plan，不在已完成账本上继续叠加开放性需求。
3. 后续所有 UI 变更继续以 `npm run exec-plan:review:preflight`、`npm run exec-plan:preflight`、`npm run typecheck`、`npm run lint`、`npm run test:visual-console` 作为基础守门矩阵。
