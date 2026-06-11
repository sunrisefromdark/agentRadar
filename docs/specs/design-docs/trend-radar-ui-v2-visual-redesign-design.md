# 设计文档：Trend Radar UI V2.5 视觉重设计

## 文档状态

- 版本：`v0.4`
- 状态：`Proposed for Review`
- 设计输入：
  - [trend-radar-ui-v2-visual-redesign-requirements.md](../product-specs/trend-radar-ui-v2-visual-redesign-requirements.md#L1)
  - [trend-radar-visual-console-requirement-analysis.md](../product-specs/trend-radar-visual-console-requirement-analysis.md#L1)
  - [trend-radar-visual-console-design.md](trend-radar-visual-console-design.md#L1)
  - [system-spec.md](../system-spec.md#L1)
  - [app/server.ts](../../../app/server.ts#L1)
  - [src/visualConsole/context.ts](../../../src/visualConsole/context.ts#L1)
  - [src/visualConsole/readLayer.ts](../../../src/visualConsole/readLayer.ts#L1)
  - [src/visualConsole/build.ts](../../../src/visualConsole/build.ts#L1)
- 目标：在不改变 `artifact-first`、状态模型、URL 上下文与只读消费边界的前提下，把当前浏览器版 Visual Console 升级为一套具备品牌感、科技感、页面人格、时间漫游能力与可持续设计系统的 UI V2.5 工作台。

## 一句话设计

UI V2.5 不是给现有控制台“换皮”，而是在继续消费同一套 daily / weekly / run health / KB artifact 的前提下，把现有 SSR 浏览器承载层重构为 **One System, Many Surfaces** 的趋势情报工作台：全局壳层统一、五个一级视图人格分明、可信度优先、时间上下文显式、阅读与扫描并重。

## 文档优先级与继承关系

- 本文是 `trend-radar-ui-v2-visual-redesign-requirements.md` 的对应设计文档，拥有 UI V2.5 的视觉壳层、页面人格、时间漫游、设计系统、动效、响应式与验收设计优先级。
- [trend-radar-visual-console-design.md](trend-radar-visual-console-design.md#L1) 继续作为 Visual Console 的语义消费层、状态模型、读取层边界和跨视图钻取契约基线。
- [trend-radar-overview-weekly-layout-refresh-v0.1.md](trend-radar-overview-weekly-layout-refresh-v0.1.md#L1) 作为本设计的页面级补充文档，专门细化 `Overview / Weekly` 的首屏编排、侧轨分工、证据矩阵映射和浏览器回归口径。
- 当两者发生冲突时：
  - 业务语义、artifact 所有权、状态定义、URL 上下文，以旧设计文档和需求分析文档为准。
  - 页面外观、壳层承载、设计 token、时间漫游 UI、路由人格、细部交互，以本文为准。
  - 若冲突只发生在 `Overview / Weekly` 的页面布局、模块显隐或矩阵映射细节内，则以上述补充文档为准。

## 需求对齐映射

| 需求分析 / PRD 冻结项 | 本设计对应章节 |
| --- | --- |
| 需求 1：先回答“本次结果靠不靠谱” | `4. 总体设计策略`、`5. 全局壳层设计`、`7.1 Overview`、`9.5 状态视觉系统` |
| 需求 2：项目判断结论优先、证据可追 | `7.2 Projects`、`8. 详情承载与跨视图钻取`、`9.6 AI 透传与事实边界` |
| 需求 3：Run Health 排障工作台 | `7.1 Overview`、`7.4 Run Health`、`8. 详情承载与跨视图钻取`、`13. 失败模式与降级行为` |
| 需求 4：weekly 是完整消费对象 | `7.3 Weekly`、`8. 详情承载与跨视图钻取` |
| 需求 5：无趋势周 / 弱信号周真实语义 | `7.3 Weekly`、`9.5 状态视觉系统`、`13. 失败模式与降级行为` |
| 需求 6：KB / review 连续入口 | `7.5 Knowledge Base`、`8. 详情承载与跨视图钻取` |
| 需求 7：日期 / 时间窗 / artifact 上下文显式绑定 | `4.3 路由与 URL 契约`、`6. 时间漫游引擎`、`8. 详情承载与跨视图钻取` |
| 需求 8：artifact-first，不引入第二真相源 | `2. 范围、非目标与冻结边界`、`3. 现状与承接前提`、`4.2 承载层分层`、`12. 工程与性能契约` |
| 需求 9：失败、降级、空态可区分 | `9.5 状态视觉系统`、`10. 交互、动效与边界状态`、`13. 失败模式与降级行为` |
| 需求 10：rules-only / fallback / 审计上下文可见 | `5. 全局壳层设计`、`7.1 Overview`、`7.3 Weekly`、`7.4 Run Health`、`9.6 AI 透传与事实边界` |
| 需求 11：跨视图一致且可钻取 | `4.3 路由与 URL 契约`、`8. 详情承载与跨视图钻取` |
| PRD：全局壳层换代 | `5. 全局壳层设计` |
| PRD：Time Navigator | `6. 时间漫游引擎` |
| PRD：五个一级视图人格重建 | `7. 页面级设计` |
| PRD：Light / Dark、字体、色彩、图形系统 | `9. 设计系统` |
| PRD：动效、Loading、Edge States | `10. 交互、动效与边界状态` |
| PRD：Desktop First、移动端只读降级 | `11. 响应式与可访问性` |
| PRD：性能与工程约束 | `12. 工程与性能契约` |
| PRD：验收与优先级 | `14. 验证矩阵与验收映射`、`15. 实施承接顺序` |

## 1. 问题定义

当前 Visual Console 的消费语义已经基本建立，但 UI V1 仍然停留在“可用的浏览器承载层”：

1. 五个一级视图共享同一视觉骨架，缺乏清晰的人格分工。
2. `Overview` 仍然更像数据看板，而不是可信度优先的情报入口。
3. `Projects` 仍然更像列表页，而不是研究扫描工作台。
4. `Weekly` 已经具备语义，但视觉上还没有“周趋势编辑台”的主叙事能力。
5. `Knowledge Base` 有内容，但阅读器承载感和摘要优先级仍不足。
6. 历史回看只有日期 / anchor 参数，没有被产品化成“时间漫游”体验。
7. 现有 CSS 与承载层仍以一次性样式修补为主，不足以支撑后续持续演进。

本设计解决的是“如何重构 UI 承载方式与设计系统”，而不是重新定义 daily / weekly / KB 的业务真相。

## 2. 范围、非目标与冻结边界

## 2.1 范围内

- 浏览器版全局壳层重构：Header、Context Strip、时间漫游、详情焦点层、背景氛围层。
- `Overview / Projects / Weekly / Run Health / Knowledge Base` 五个一级视图的人格、布局和模块层级重构。
- 桌面端与移动端详情承载方式重构。
- Light / Dark 双主题、字体、色彩、图形、状态、动效和 spacing token 体系。
- 时间漫游的 UI、状态表达、步进规则、URL 显式化与历史预览承载。
- 视觉验收、浏览器回归、性能预算与无障碍要求。

## 2.2 非目标

- 不重算 `score / confidence / freshness / trend judgment / verify` 语义。
- 不引入新的后端平台、数据库或第二真相源。
- 不把本次改版升级为完整 SPA 迁移。
- 不新增第六个一级视图，不新增独立“趋势详情产品对象”。
- 不把 `Projects` 做成复杂多选矩阵比较器；多项目矩阵比较保留在 P2。
- 不让 UI 自行推断“重大范式转移”“强趋势日”“S 级项目”；UI 只能消费 artifact 显式信息或设计中定义的轻量可追溯汇总。

## 2.3 冻结边界

- 一级路由集合保持不变：`overview`、`projects`、`weekly`、`run-health`、`kb`。
- 日级上下文仍使用 `date=YYYY-MM-DD`，周级上下文仍使用 `anchor=YYYY-MM-DD`。
- `latest` 仍只允许作为快捷入口，解析后必须回写成显式 `date` 或 `anchor`。
- 详情与钻取仍以 `project`、`slug`、`trend_key`、`source_view` 等显式 query 维持上下文。
- `ready / degraded / stale / failed / empty / not-judgeable` 继续作为顶层状态基线，不新增新的业务状态枚举。

## 3. 现状与承接前提

## 3.1 当前实现事实

现有浏览器版实现已经具备以下稳定基础：

- 本地 Node SSR 服务承载，入口在 [app/server.ts](../../../app/server.ts#L1)。
- 读取层只消费 `data/reports`、`data/raw/github`、`data/kb`、`data/scores` 中的既有 artifact，入口在 [src/visualConsole/readLayer.ts](../../../src/visualConsole/readLayer.ts#L1)。
- daily / weekly 上下文解析已冻结在 [src/visualConsole/context.ts](../../../src/visualConsole/context.ts#L1)。
- 各路由 view model 已分层在 [src/visualConsole/build.ts](../../../src/visualConsole/build.ts#L1)。
- 当前浏览器测试已覆盖语义与基础视觉承载，入口在 [src/__tests__/visualConsoleWeb.test.ts](../../../src/__tests__/visualConsoleWeb.test.ts#L1) 与 [src/__tests__/visualConsoleWeb.visual.test.ts](../../../src/__tests__/visualConsoleWeb.visual.test.ts#L1)。

## 3.2 可直接复用的稳定契约

- daily 上下文解析：`resolveDailyContext()`。
- weekly 上下文解析：`resolveWeeklyContext()`。
- latest 归一化重定向：`normalizeLatestRedirect()`。
- 路由 query 基线：`date`、`anchor`、`project`、`slug`、`trend_key`、`source_view`、`lang`、`theme`。
- 项目详情与 KB 详情已经是 URL 可寻址的叶子状态。
- `RenderCache` 已存在，可继续承担本次视觉升级中的 request-level 缓存。

## 3.3 本轮新增但不越界的承载层

本轮允许新增以下承载层能力，但都必须从既有 artifact 派生：

1. `Time Navigator Index`
   - 用于历史预览、步进和热力/状态承载。
2. `Shell Token Layer`
   - 用于双主题、空间系统、状态系统、焦点层和图形语言统一。
3. `Route Layout Variants`
   - 用于五个一级视图的人格差异，但不改变消费对象。
4. `Fact vs Judgment Presentation Layer`
   - 用于显式区分客观指标、审计上下文与 AI/规则推断说明。
5. `Editorial Spotlight Slot`
   - 用于承载上游显式给出的 `editorial_spotlight`，不允许前端自行推断“重大范式转移 / S 级项目”。

## 4. 总体设计策略

## 4.1 演进原则

### 4.1.1 Evolve, not Rewrite

- 继续沿用 SSR + 路由可寻址页面，不做前端平台重写。
- 继续沿用读取层 -> view model -> render 的三段式承载，不让样式层反向驱动业务语义。

### 4.1.2 One System, Many Surfaces

- 五个一级视图共享同一套 token、状态语言、图形语法和焦点承载方式。
- 五个一级视图必须拥有不同的主叙事、首屏结构和内容密度节奏。

### 4.1.3 Trust First

- `Run Trust Summary / Verify / Freshness / Source Status / Audit Context` 必须永远处于比“漂亮数据块”更高的可见优先级。
- 任何大幅视觉强调都不能压住可信度结论。

### 4.1.4 Editorial + Analytical

- `Overview / Weekly / KB` 偏阅读与叙事。
- `Projects / Run Health` 偏扫描与分析。
- 同一页面内允许叙事区和分析区共存，但必须明确主从。

## 4.2 承载层分层

UI V2.5 继续采用以下四层承载：

```text
Artifact Layer
  -> data/reports / data/raw/github / data/kb / data/scores

Read & Context Layer
  -> readLayer.ts / context.ts
  -> daily date / weekly anchor / latest normalization

ViewModel Layer
  -> buildOverviewView / buildProjectsView / buildWeeklyView / buildRunHealthView / buildKnowledgeBaseView
  -> Time Navigator Index (derived only from artifact metadata)

Render & Token Layer
  -> app/server.ts / app/styles.css
  -> shell / route layouts / detail surface / motion / states / responsive
```

冻结规则：

- `Time Navigator Index` 只能读取 artifact 存在性、生成时间、显式状态和可计数摘要，不能引入新的趋势结论。
- Render 层可重排、聚合、强调，但不能重算 `score`、`weekly trend`、`freshness`、`verify` 结论。

## 4.3 路由与 URL 契约

| 路由 | 主上下文参数 | 叶子参数 | 说明 |
| --- | --- | --- | --- |
| `overview` | `date` | `lang`、`theme` | 今日判断首页 |
| `projects` | `date` | `project`、`board`、`confidence`、`paradigm`、`persistence`、`kb`、`source_view`、`trend_key`、`lang`、`theme` | 研究工作台 |
| `weekly` | `anchor` | `project`、`trend_key`、`source_view`、`lang`、`theme` | 周趋势编辑台 |
| `run-health` | `date` | `source_view`、`lang`、`theme` | 系统体检与审计页 |
| `kb` | `date` | `slug`、`project`、`anchor`、`trend_key`、`source_view`、`lang`、`theme` | 研究阅读器（主上下文仍为 `date`，`anchor` 仅作来源回链） |

URL 规则冻结：

1. `latest` 不得停留在最终可分享 URL 中。
2. `Weekly -> Project Detail` 必须保留 `anchor`、`trend_key` 与 `source_view=weekly`。
3. `Project -> KB` 必须保留显式 `date` 与 `source_view`；若来源为 `weekly`，则 `date` 固定解析为当前 weekly 的 `window_end`（若 artifact 未回填 `window_end`，退回当前已解析上下文中的 `window_end / anchor`），同时额外保留 `anchor` 与 `trend_key` 作为来源上下文，但不得以 `anchor` 替代 KB 的主上下文。
4. `lang` 与 `theme` 不是业务语义，但必须在所有叶子跳转中被继承。
5. `Projects` 过滤器必须 URL 显式化，并在详情打开 / 关闭时被保留。

## 5. 全局壳层设计

## 5.1 壳层结构

全局壳层固定拆为五段：

1. `Floating Workspace Header`
   - 品牌、一级导航、语言、主题。
2. `Context Strip`
   - 当前 `date / anchor`、artifact 时间、模式、状态摘要、Time Navigator。
3. `Atmosphere Layer`
   - 稳定的科技氛围底层，只服务空间感与层次感，不承载业务信息，也不得压过状态与正文。
4. `Content Stage`
   - 各路由主内容区。
5. `Focus Layer`
   - 详情面板、reader mode、保存反馈、显著 hover/focus。

## 5.2 Header 契约

- 桌面端 Header 采用浮动工作台壳层，而不是传统网站横条。
- Header 默认不在长页阅读中永久 sticky 覆盖正文；只保留首屏浮层感和必要的返回可达性。
- 导航必须统一共享以下语义：
  - `Overview` 代表“今天值不值得看”
  - `Projects` 代表“今天具体看哪些项目”
  - `Weekly` 代表“本周趋势如何组织”
  - `Run Health` 代表“结果是否可继续信任”
  - `Knowledge Base` 代表“继续阅读与沉淀”

## 5.3 Context Strip 契约

Context Strip 永远显示以下信息：

- 当前 `date` 或 `window_start -> window_end`
- artifact 生成时间
- 当前模式：`rules-only / agent-partial / agent-full / unknown`
- 顶层状态：`ready / degraded / stale / failed / empty / not-judgeable`
- Time Navigator 入口

Context Strip 禁止事项：

- 不得沦为第二排导航。
- 不得堆成长句说明；所有元信息必须结构化成 badge / chip / key-value micro row。

## 5.4 快速动作区

P0 必做：

- `lang`
- `theme`

P1 预留：

- `Command Palette`
- 日期 / 时间窗快速跳转

约束：

- 快速动作始终是壳层的辅助区，不得抢占可信度主信息区域。

## 5.5 焦点层

焦点层用于统一承载：

- 项目详情
- Weekly 支撑项目详情
- KB 阅读详情
- 保存反馈

视觉规则：

- 只有焦点层允许明显抬升。
- 抬升方式依赖边界光泽、柔和阴影和局部 blur，不使用大面积夸张描边。

## 6. 时间漫游引擎

## 6.1 角色定义

Time Navigator 是全局上下文控制器，不是普通日期选择器。它服务于：

- 在 daily / projects / run health / kb 间按 `date` 漫游。
- 在 weekly 间按 `anchor` 漫游。
- 在不丢失 artifact 真实性的前提下快速穿梭历史切片。

## 6.2 预览索引数据契约

Time Navigator 只允许使用以下派生信息：

### Daily Slice Preview

来源：

- `YYYY-MM-DD.daily.json`
- `YYYY-MM-DD.run-summary.json`
- `YYYY-MM-DD.verify-daily.json`
- `YYYY-MM-DD.enrichment.json`

可展示字段：

- `slice_key`
- `generated_at`
- `top_level_state`
- `top_decision_count`
- `source_active_count / failed_count / empty_count`
- `verify_status`
- `enhancement_status`

### Weekly Slice Preview

来源：

- `YYYY-MM-DD.weekly.md`
- `YYYY-MM-DD.weekly.audit.json`

可展示字段：

- `slice_key`
- `generated_at`
- `top_level_state`
- `core_trend_count`
- `weak_signal_count`
- `enhancement_status`
- `audit_status`

禁止事项：

- 不得根据自由文本推断“强趋势日”“重大范式转移”。
- 不得根据页面内容在前端生成新的趋势等级标签。

## 6.3 交互模型

Time Navigator 分为两层能力：

### P0 折叠态

- 显示当前 `date / anchor`、顶层状态与 artifact 时间，不得停留在抽象 `latest`。
- 当前切片 pill 本身必须是可操作入口：点击或键盘聚焦后可进入“直接选择目标切片”的选择态，而不是只能做步进。
- 支持 `Prev`、`Next`、`Latest` 三个步进控件。

### P1 展开预览态

- 显示微型时间轴或热力条。
- Daily 路由显示按日切片。
- Weekly 路由显示按 anchor 切片。
- 展开态至少允许通过点击或键盘选中某个预览节点，直接切换到目标 `date / anchor`；专门的“快速跳转输入框”仍属于 P1 增强项，而不是 P0 必须项。
- 若预览索引不足，仍保留 P0 步进，不伪造热力或强趋势预告。

键盘契约：

- `[`：上一切片
- `]`：下一切片
- `Shift + ]`：跳回最新

## 6.4 步进与上下文继承

- `Overview / Projects / Run Health / KB` 按 `date` 步进；`KB` 即使继承 `anchor`，也仍以显式 `date` 作为主步进上下文。
- `Weekly` 按 `anchor` 步进。
- 步进目标优先跳到“存在可消费 artifact 的下一个切片”。
- 步进后尽可能保留：
  - `project`
  - `slug`
  - `trend_key`
  - `source_view`
  - `board`
  - `confidence`
  - `paradigm`
  - `persistence`
  - `kb`
  - `lang`
  - `theme`

若目标切片不存在对应叶子对象：

- `project` 失效：显式关闭详情面板，保留列表/趋势上下文。
- `slug` 失效：显式回退到 KB 索引态，并展示“该卡片在目标切片不可用”。
- `trend_key` 失效：保留周视图，但切回整体 weekly 主视图。

## 6.5 状态与失败行为

- 目标切片所需核心 artifact 缺失、非法或解析失败：显示 `failed`。
- 目标切片 artifact 存在且读取成功，但当前视图范围内无匹配内容：显示 `empty`。
- artifact 缺失关键审计信息：显示 `degraded` 或 `not-judgeable`，不伪装成正常页面。
- latest 解析到非当天 / 非最新 anchor：显示 `stale`，同时 URL 回写为显式 `date` 或 `anchor`。

## 6.6 性能契约

- Time Navigator 预览索引允许在服务端按请求构建并缓存。
- 展开 Navigator 不得触发整页硬刷新。
- 切片切换优先局部更新主内容区与详情区。

## 7. 页面级设计

## 7.1 Overview

### 页面定位

`Overview` 是“今天值不值得继续看”的第一页，不是 KPI 仪表盘。

### 首屏结构

桌面端采用“三阅读区”结构，而不是“五卡拼版”：

1. `Judgment Canvas`
   - 左侧是 `Run Trust Summary`
   - 右侧是唯一的 `What To Watch First / Featured Decision`
   - 两者必须处于连续 Hero 语境中，不再拆成彼此漂浮的独立卡片
2. `Continuation Rail`
   - 只承载 `Weekly Entry + Risks & Actions`
   - 该区负责把用户从“判断”推进到“继续行动”，不再承担新的主叙事
3. `Research Stream`
   - 上方是压缩态 `Source Ribbon`
   - 下方是 `Decision Stream`
   - 这是首屏之后真正的持续研究区

`Preference / Interests` 不再属于 `Overview` 的页面级内容骨架，移入壳层工具区、设置抽屉或折叠控制区。

### Hero 的三种布局状态

1. `Normal`
   - 正常展示 `Judgment Canvas + Continuation Rail`
2. `State Alert`
   - 当顶层状态为 `failed / stale / not-judgeable` 时，可信度模块扩展为 `Judgment Canvas` 主角
3. `Editorial Spotlight`
   - 仅当上游 daily artifact 或同 run 审计上下文显式提供 `editorial_spotlight` 时启用
   - 最小输入契约冻结为：
     - `kind`
     - `title_cn`
     - `summary_cn`
     - `why_now_cn`
     - `evidence_refs[]`
   - 若该 payload 不存在，Overview 只能停留在 `Normal` 或 `State Alert`，不得根据榜单、自由文本或前端阈值自行触发 Spotlight

### 模块契约

- `Run Trust Summary`
  - 必须同时展示总体状态、verify、freshness、关键 source 摘要
  - 必须提供显式 `Open Run Health` 或等价钻取动作，且保留 `date` 与 `source_view=overview`
- `Editorial Spotlight`
  - 始终作为可选主叙事插槽，且只消费显式 payload
  - 它可以替换 `Featured Decision` 区域，但不能额外新增一个并列大模块
- `What To Watch First / Featured Decision`
  - 首屏只允许出现一个 featured decision
  - 只展示已在 daily artifact 中进入主决策区的项目，不重新排名
  - 完整项目流必须下沉到 `Decision Stream`
- `Weekly Entry`
  - 明确表现为“从 today judgment 进入 weekly briefing 的门户”
- `Risks & Actions`
  - 只保留 2-3 条高信号动作
  - 必须短、准、可执行，不得长成第二个正文区
- `Source Ribbon`
  - 只承担来源健康补充
  - 视觉上必须是压缩条带、chip 阵列或微卡阵列，而不是若干张等权大卡
- `Preference / Interests`
  - 移入壳层工具区或折叠控制区
  - 不再出现在 `Overview` P0 内容编排里

### 表面预算与冗余约束

- `Overview` 首屏除壳层外默认只允许三个阅读区：`Judgment Canvas`、`Continuation Rail`、`Research Stream`。
- `Judgment Canvas` 内部允许存在 badge、micro-panel、key-value row，但不允许再拆成多张彼此独立的大卡。
- `Continuation Rail` 默认只允许承载 `Weekly Entry` 与 `Risks & Actions` 两个次表面，不再继续扩张新的首屏主模块。
- `Research Stream` 之前不允许再插入新的大卡；任何“补充说明”都应吸附到既有阅读区中，而不是再长出一个独立模块。
- 当实现出现“大卡、中卡、小卡同时并排，且每张卡都试图成为主视觉”的情况时，应判定为违背本设计。

### 禁止事项

- 不能退化成整页均质卡片墙。
- 不能先给榜单、后给可信度。
- 不能把 `Overview` 实现成多个白卡平铺的模块拼盘。
- 不能让 `Preference`、`Source`、`Weekly Entry` 都以独立大卡争抢首屏注意力。

## 7.2 Projects

### 页面定位

`Projects` 是研究扫描工作台，不是普通清单页。

### 桌面布局

固定采用三段结构：

1. `Research Filter Strip`
2. `Scan Lane`
3. `Detail Surface`

其中 `Scan Lane + Detail Surface` 构成稳定双栏。

### Filter Strip 契约

P0 允许以下过滤维度，且都必须直接来自 artifact 已有字段：

- `board`: `today_star / context_only / all`
- `confidence`
- `paradigm`
- `persistence`
- `kb`: `present / all`

过滤器 URL 契约冻结为：

- `board`
- `confidence`
- `paradigm`
- `persistence`
- `kb`

过滤规则：

- 只能过滤，不得改写 daily artifact 的原始排序。
- 默认排序继续沿用 artifact 中的展示顺序。
- `board` 是只读 UI 过滤维度：`today_star` 只消费 `today_star_projects`，`context_only` 只消费 `context_only_projects`，`all` 只做两者并集展示并保留各自原始相对顺序；它不是 `main_board_mode` 的别名，也不能反向改写 run 级主榜单语义。
- `paradigm` 只允许基于当前切片里已存在的 `score.paradigm` 做 exact-match / deterministic slug facet，不允许前端临时聚类出新的范式树。
- `kb=present` 只表示当前请求能从既有 KB 索引解析出可预览卡片，不允许把“前端查到索引”扩展成新的业务真相。

### Scan Lane 契约

每个项目行固定包含：

- 主标题
- 一句项目介绍
- 一句“为什么今天值得看”
- `score / confidence / paradigm / persistence`
- 一条 `top evidence`
- 一条 `primary risk / next action cue`
- 微型趋势图、`appearance` cue 或等价占位；该 cue 只允许消费显式 `star_delta_daily`、`appearance_dates`、`persistence` 或同级 artifact 字段，不允许临时补造趋势线

视觉目标：

- 快速扫一眼就能知道“为什么看它”，而不是先进入详情再解释。
- 不展开详情也必须直接看见“核心证据是什么、主要风险是什么、下一步做什么”这三个最小判断入口。

### Detail Surface 契约

详情固定按以下顺序组织：

1. `Project Identity`
2. `Score and Evidence`
3. `Risk and Next Actions`
4. `Persistence and Appearances`
5. `Run / Audit Context`
6. `KB Preview`

事实与判断必须分层：

- 事实：`score`、组件 evidence、repo、状态、上下文
- 判断：`project_brief_cn`、`why_today_cn`、`risks`、`next_actions`
- 历史 / appearances 只能引用当前 artifact 已有的 `appearance_dates`、`persistence` 与可追溯来源上下文，不新增独立趋势结论

### 键盘契约

- `Tab / Shift+Tab`：在 Filter -> List -> Detail 之间稳定前进 / 回退
- `Enter`：打开当前聚焦项目详情
- `Esc`：关闭详情

### 禁止事项

- 不能退化成传统后台表格。
- 不能因为详情阅读打断列表扫描位置。

## 7.3 Weekly

### 页面定位

`Weekly` 是周趋势编辑台，不是 daily 的附属列表。

### 桌面布局

桌面端固定为六段：

1. `Cover Stage`
   - `Weekly Cover`
   - `Overview Rail / Overall Weekly Judgment`
2. `Trend Evidence Matrix`
3. `Core Trend Stage`
4. `Weak Signal Strip`
5. `Next Week Watchpoints`
6. `Detail Surface`

### 版式主从规则

- 当存在稳定 `core_trend_cards[]` 时，`Core Trend Stage` 必须占据完整内容宽度，不得与 `Weak Signals` 共享同一横向带宽。
- 每张核心趋势卡都必须是 full-width editorial card；若存在多张核心趋势卡，只允许纵向堆叠，或采用“1 张展开 + 若干折叠队列”的同轴结构，不允许回退为不同尺寸卡片混排的拼盘。
- `Weak Signal Strip` 只能出现在 `Core Trend Stage` 之后，视觉权重必须显著低于核心趋势区。
- 页面默认阅读顺序固定为：封面 -> 总判断 -> 证据矩阵 -> 核心趋势 -> 弱信号 -> 下周观察点。

### Weekly Cover 契约

Cover 区必须清晰表达：

- 当前时间窗
- 本周是否可判断
- 当前增强模式与审计状态

### Trend Evidence Matrix 契约

本页的标志性模块固定为“大六边形雷达 + 六张证据卡”。

当存在多个 `core_trend_cards[]` 时：

- Matrix 默认绑定首个核心趋势卡。
- 选择不同趋势卡时，六边形与六张证据卡同步切换到该 `trend_key`。
- Matrix 不承载跨 trend 混合聚合结果，始终只表示“当前聚焦 trend”的证据矩阵。

六边形六个轴固定映射到现有六个评分组件：

1. `star_velocity`
2. `engagement_score`
3. `architecture_shift`
4. `compounding_capability`
5. `autonomy_score`
6. `discussion_score`

映射规则冻结：

- 每张证据卡对应一个轴，不允许实现阶段自行换轴或补轴。
- 本模块是“证据编排层”，不是新的 weekly 趋势计算层。
- 每个核心趋势卡必须提供结构化 `evidence_matrix.axes[]` 输入：
  - `axis_key`
  - `value_0_to_100`
  - `status`
  - `evidence_refs[]`
- `axis_key` 只允许取上述六个固定评分组件。
- `status` 只允许取 `observed` 或 `insufficient_evidence`。
- UI 只允许消费 `core_trend_cards[].evidence_matrix.axes[]` 做雷达与证据卡渲染，不得从 supporting projects 或 `scores/*.json` 临时聚合六轴数值。
- 若上游将某轴标记为 `insufficient_evidence`，六边形保留轮廓或缺口，对应证据卡显式展示 `insufficient evidence`。

### Core Trend Stage 契约

- `Core Trend Stage` 必须是页面的主叙事舞台，默认按 `core_trend_cards[]` 的既有顺序消费，不重新排名。
- 每张核心趋势卡必须占满完整内容宽度；允许在单卡内部划分 narrative column 与 meta rail，但它们必须属于同一连续表面，而不是左右两张大卡。
- 若存在多个核心趋势卡，首张默认展开，其余核心趋势卡继续沿纵向堆叠或折叠排队；不得出现“左侧核心趋势、右侧弱信号”式并排主故事带。
- `Trend Evidence Matrix` 与 `Core Trend Stage` 必须保持同一 `trend_key` 焦点；切换焦点时，只切换当前核心趋势的矩阵与全宽卡，不引入跨 trend 聚合解释层。

### Delta 契约

`Weekly` 必须显式表达“变化量”，但 Delta 只能是对已存在证据的可追溯展示：

- 每个核心趋势卡只允许消费上游显式提供的 `delta_summary`：
  - `direction`
  - `summary_cn`
  - `evidence_refs[]`
- `direction` 只允许取 `up / down / flat / mixed / unavailable`。
- UI 不得在前端定义新的固定阈值、中位数聚合或等价规则去重算“上行 / 下行 / 持平”的周趋势方向。
- 若上游返回 `unavailable`，核心趋势卡显式显示 `delta unavailable / 样本不足`，而不是伪造箭头方向。

### Weak Signal Strip

- `Weak Signal Strip` 只承载尚未稳定、但值得继续观察的方向。
- 它必须位于 `Core Trend Stage` 之后，并以次级密度与次级对比度呈现，不得与核心趋势卡共享主舞台。
- 桌面端允许在 `Weak Signal Strip` 中使用 `2-3` 列压缩卡，但每张卡只承载短摘要、观察理由与后续链接，不得长成第二个核心趋势正文区。

### Next Week Watchpoints

- `Next Week Watchpoints` 必须显式承载 weekly 中“是否值得继续跟踪 / 后续观察点”。
- 该区只允许重排现有 `core_trend_cards[].worth_following_next_week` 与 `weak_signal_cards[].worth_following_next_week`，不新增新的周级结论。
- 当周没有稳定核心趋势时，弱信号的 follow-up watchpoints 升级为主内容。

### 无稳定趋势周

当 weekly artifact 没有核心趋势但有弱信号时：

- `Overall Weekly Judgment` 继续占主位
- `Weak Signal Strip` 升级为全宽主内容区
- 六边形保留轮廓，但全部显示为 `insufficient evidence`
- 页面必须明确写出“尚未形成稳定主趋势”

### 禁止事项

- 不能把 `Weekly` 做成文章列表或项目列表。
- 不能在存在稳定核心趋势时，让 `Weak Signals` 与 `Core Trend` 以左右等权双栏共享同一主故事带。
- 不能在证据不足时强装“稳定趋势”。

## 7.4 Run Health

### 页面定位

`Run Health` 是系统体检与审计页，不是原始日志页。

### 信息顺序

1. `Verify Result Summary`
2. `Run Summary / Trust Gate`
3. `Source Status Table`
4. `GitHub Audit Table`
5. `Failure Notes`
6. `Recommended Actions`

### 视觉语气

- 语气比其他页面更冷静、更收束。
- 仍使用同一套壳层、字体和状态语言。

### Run Summary / Trust Gate 契约

- `Trust Gate` 不是新的业务对象，而是 `run-summary.json + verify-daily` 的压缩承载层。
- 它至少展示：
  - `overall_daily_status`
  - verify 总结论
  - freshness / source 风险摘要
  - recommended actions 入口
- 它不能替代 `Verify Result Summary`，也不能发明新的可信度评分。

### 表格契约

Source / Audit 表格必须至少展示：

- source
- enabled
- count / distinct projects
- status
- notes

严重程度表达：

- 标签文案 + 图标 + 色彩联合表达
- 不允许只靠颜色区分

### 禁止事项

- 不能直接暴露未组织的日志块替代体检结构。
- 不能把 `warn / fail / empty / fallback` 混成一个提示样式。

## 7.5 Knowledge Base

### 页面定位

`Knowledge Base` 是研究阅读器，而不是字段展示页。

### 布局模式

P0 提供两种承载：

1. `Index + Reader`
   - 常规 KB 浏览
2. `Reader Focus`
   - 从项目或 weekly 钻入单张卡片时自动进入更聚焦阅读模式

### Reader 结构

固定按以下顺序组织：

1. `Reader Header`
2. `Executive Summary`
3. `Machine Notes`
4. `Human Notes`
5. `Linked Context`

### 区块语义

- `Executive Summary`
  - 只能基于现有 KB artifact 中的摘要与关键段落重排，不新增结论
- `Machine Notes`
  - 明显标为机器区，排版更结构化
- `Human Notes`
  - 明显标为人工区，排版更接近正文阅读器
- `Linked Context`
  - 展示这张卡与当前 `daily / weekly / project` 的关系

### Reader 宽度

- 常规右栏 reader：`72ch - 84ch`
- Reader Focus 模式允许更宽正文列，但仍保留阅读上限，不做全宽铺开

### 禁止事项

- 不能让 KB 首屏先出现原始字段列表。
- 不能把机器区和人工区混成同一种视觉语气。

## 8. 详情承载与跨视图钻取

## 8.1 详情承载

- 桌面端详情区必须是独立滚动容器。
- 窄屏下详情区切换为全屏 reader / detail page。
- 关闭详情只移除叶子 query，不改变主上下文。

## 8.2 钻取规则

- `Overview -> Projects`
  - 带 `date`，必要时带 `source_view=overview`
- `Overview -> Run Health`
  - 带 `date` 与 `source_view=overview`
- `Weekly -> Project Detail`
  - 必带 `anchor`、`trend_key`、`project`
  - 保留 `source_view=weekly`
- `Project -> KB`
  - 必带显式 `date` 与 `source_view`
  - 若来源是 `weekly`，显式 `date` 固定取当前 weekly 的 `window_end`；仅在 `window_end` 缺失时，才回退到当前已解析上下文中的 `anchor`
  - 额外保留 `anchor`、`trend_key` 作为来源上下文，但 `anchor` 不得替代 `date`
  - 继承 `project`

## 8.3 上下文失效的降级

- 目标项目不存在：保留列表页，详情显示显式“项目不在当前 artifact 上下文中”。
- 目标卡片不存在：保留 KB 索引，详情显示显式“卡片不存在 / 未生成”。
- 目标趋势不存在：保留 Weekly 主视图，移除 `project` 与 `trend_key` 叶子态。

## 9. 设计系统

## 9.1 主题基调

双主题都要体现“可信的研究工作台”，而不是后台模板：

- Light：温和纸面感 + 冷静科技底色
- Dark：深空灰基底 + 低对比层级光泽

两套主题都禁止：

- 纯黑纯白硬对比
- 紫色模板化主色
- 大面积渐变直接覆盖主内容区

## 9.2 字体系统

冻结如下字体策略：

- 标题 / 品牌：`Space Grotesk`, `Noto Sans SC`, `PingFang SC`, sans-serif
- UI / 正文：`IBM Plex Sans`, `Noto Sans SC`, `PingFang SC`, sans-serif
- Mono / 数字：`IBM Plex Mono`, `JetBrains Mono`, monospace

规则：

- 数字、状态指标、表格统计强制使用等宽数字。
- 中英混排优先稳定阅读，不做花哨展示字替代正文。

## 9.3 色彩系统

主色与辅助色固定为“科技可信”路线：

- 主强调：`cobalt`
- 健康辅助：`teal / sage`
- 提醒辅助：`amber`
- 失败辅助：`ember`
- 中性边界：`slate`

规则：

- 状态色始终与标签文案共同出现。
- 页面人格差异通过比例和布局表达，不靠每页切换整套主色。

## 9.4 Token 体系

P0 必须冻结以下 token 族：

- `--shell-max-width`
- `--content-max-width`
- `--reader-max-width`
- `--surface-0` ~ `--surface-3`
- `--surface-glass`
- `--border-subtle`
- `--border-strong`
- `--shadow-soft`
- `--shadow-focus`
- `--radius-shell`
- `--radius-card`
- `--radius-chip`
- `--space-1` ~ `--space-8`
- `--font-display`
- `--font-body`
- `--font-mono`
- `--motion-fast`
- `--motion-base`
- `--motion-slow`

## 9.5 状态视觉系统

| 状态 | 视觉表达 | 必须伴随的文字语义 |
| --- | --- | --- |
| `ready` | 稳定边框 + 健康色强调 | `可直接消费` |
| `degraded` | 中性底 + 提醒色标签 | `部分降级 / 谨慎参考` |
| `stale` | 旧态标签 + 明确 artifact 时间 | `最新入口已回退到历史结果` |
| `failed` | 强结构错误面板 | `结果不可用 / 需要排障` |
| `empty` | 克制空态 + 明确无结果原因 | `当前范围内无内容` |
| `not-judgeable` | 暂停判断面板 | `信息不足，当前不可据此判断` |

冻结规则：

- 状态绝不只靠颜色表达。
- 空态与失败态禁止共用同一文案。

## 9.6 AI 透传与事实边界

UI V2.5 必须同时冻结“事实 vs 判断”与“页面级 / 字段级 / 审计级透明度”：

### 事实层

- `score`
- 六个评分组件
- source count
- verify status
- generated_at
- repo / KB / linked context

### 判断层

- `project_brief_cn`
- `why_today_cn`
- `overall_judgment`
- `trend_summary_cn`
- `risks`
- `next_actions`

### 页面级透明度

- 页面级运行模式只使用 `enhancement_status`：
  - `rules-only`
  - `agent-partial`
  - `agent-full`
- 本轮不新增新的前端 AI confidence score。

### 字段级透明度

- 字段级文案只允许使用现有来源字段：
  - `enhancement_source`
  - `risk_review_source`
- UI 需明确区分：
  - `agent`
  - `template_fallback`

### 审计级透明度

- 若 daily / weekly 存在 `rejected_outputs[]`，UI 必须提供可见的审计入口或审计摘要。
- 审计入口用于解释“为什么该字段未采用 Agent 输出”，而不是生成新的判断结论。

视觉要求：

- 判断层必须带上页面级或字段级来源标签，例如 `rules-only`、`agent-partial`、`agent-full`、`template_fallback`
- 事实层不使用同样的强调边框，避免用户误读为“硬指标”

## 10. 交互、动效与边界状态

## 10.1 动效原则

- `稳`：不制造噪声
- `轻`：只做 opacity / transform / blur 的轻量变化
- `准`：只强化上下文切换、焦点建立和反馈闭环

## 10.2 路由与详情动效

- 一级视图切换：主内容区淡入 + 微位移
- 详情打开：焦点层从右侧或底部进入
- 详情关闭：不重置主列表滚动位置
- 保存反馈：内联 toast，不新增模态阻断

## 10.3 Preference Card 交互

P0 冻结为：

- 默认折叠摘要态
- 点击后进入紧凑编辑态
- `Cmd/Ctrl + Enter` 保存
- `Esc` 取消

## 10.4 Loading / Skeleton

- 不使用全页 Spinner 作为主 loading 体验
- 首选 `skeleton blocks + subtle scan line`
- 微型可视化允许延后于正文注入

## 10.5 Edge States

- `Empty`
  - 使用高级留白和明确说明，例如“今日无重大异动”
- `Error`
  - 使用结构化错误区，展示失败原因与建议动作
- `Degraded`
  - 不打断阅读，但必须被用户一眼看见

## 10.6 Focus / Hover / Keyboard

- 所有可交互元素必须有 `hover` 与 `focus-visible`
- 焦点样式用柔和光晕和边界抬升，不用刺眼高对比外框
- 键盘路径必须覆盖：
  - Header 导航
  - Time Navigator
  - Projects Filter / List / Detail
  - Preference Card 编辑

## 11. 响应式与可访问性

## 11.1 响应式

### Desktop

- 绝对 Desktop First
- 五个视图维持完整工作台结构

### Tablet

- 压缩为弱双栏或单栏
- Detail Surface 可切为下拉 / 覆盖式 reader

### Mobile

- 只读消费优先
- 详情面板进入全屏阅读模式
- 全屏详情 / reader 顶部必须始终保留清晰可见的返回或关闭入口，且不能被 Header、Time Navigator 或系统安全区遮挡
- Time Navigator 保持可用，但默认折叠

## 11.2 可访问性

- 不依赖颜色作为唯一信号
- 图表必须有文字等价表达
- Reader 对比度满足长文阅读
- 长 repo 名、长摘要、中英混排不允许破版

## 12. 工程与性能契约

## 12.1 允许触达的实现面

本设计预计只会触达以下实现面：

- [app/server.ts](../../../app/server.ts#L1)
- [app/components/ScoreEvidencePanel.tsx](../../../app/components/ScoreEvidencePanel.tsx#L1)
- [app/styles.css](../../../app/styles.css#L1)
- [src/visualConsole/build.ts](../../../src/visualConsole/build.ts#L1)
- [src/visualConsole/context.ts](../../../src/visualConsole/context.ts#L1)
- [src/visualConsole/readLayer.ts](../../../src/visualConsole/readLayer.ts#L1)
- [src/visualConsole/types.ts](../../../src/visualConsole/types.ts#L1)
- [src/visualConsole/weeklyMarkdown.ts](../../../src/visualConsole/weeklyMarkdown.ts#L1)（仅当继续从 markdown 只读提取 weekly 展示字段时）
- [src/visualConsole/kbMarkdown.ts](../../../src/visualConsole/kbMarkdown.ts#L1)（仅当 KB reader 结构需要补强时）
- 相关浏览器测试文件

上游依赖说明：

- `editorial_spotlight`、`core_trend_cards[].evidence_matrix`、`core_trend_cards[].delta_summary` 的产物契约以上游 [agent-enhancement-layer-and-weekly-trend-design.md](agent-enhancement-layer-and-weekly-trend-design.md#L1) 为准；UI 只能只读消费，不能在前端补算等价字段。
- UI 不得通过 `scores/*.json` 或 supporting projects 临时补算这些结构字段。
- 若这些结构化 payload 在本轮浏览器消费路径中尚不可读，UI 必须回退到 `Normal / State Alert` 或 text-first weekly 承载，不得通过反向解析 prose markdown、supporting projects 聚合或 `scores/*.json` 临时拼出等价结构。

不应触达：

- scoring 引擎
- signal 采集逻辑
- weekly 趋势生成逻辑

## 12.2 性能预算

- 一级视图切换：主内容可见更新时间目标 `< 150ms`
- `Projects` 首次进入：目标 `< 250ms`
- 详情切换：焦点层开始更新时间目标 `< 100ms`
- Time Navigator 展开：目标 `< 80ms`

## 12.3 渲染约束

- 任何微型可视化都必须晚于主文案可读性。
- `sparkline / heat bar / hexagon` 允许延迟注入。
- 同一请求内禁止重复同步读取同一 JSON 文件。
- 允许继续复用 `RenderCache` 做 request-level memoization。

## 12.4 不可越界约束

- 不允许为视觉效果在 UI 中重算 weekly 趋势卡。
- 不允许为时间漫游补造历史 artifact。
- 不允许为 Projects 过滤器建立新的排序真相。

## 13. 失败模式与降级行为

| 场景 | UI 行为 | 禁止行为 |
| --- | --- | --- |
| `date / anchor` 非法 | 显示失败态与无效上下文说明 | 静默跳到 latest |
| latest 解析到历史结果 | URL 回写显式日期，并标记 `stale` | 继续显示 latest 不解释 |
| daily 缺失 | `Overview / Projects / Run Health / KB` 显式 `failed`，并说明必需 artifact 缺失 | 用旧结果伪装当天结果，或把缺失包装成 `empty` |
| weekly 缺失 | Weekly 显式 `failed`，并说明 weekly artifact 缺失 | 用 daily 拼装周视图，或把缺失包装成 `empty` |
| Overview 未提供 `editorial_spotlight` | 保持 `Normal / State Alert`，不进入 Spotlight 布局 | 根据榜单、自由文本或星数阈值自行推断重大告警 |
| artifact 存在但当前范围无内容 | 显示 `empty` 与“当前范围内无内容”的显式原因 | 把 `empty` 当成 `failed`，或把失败态误写成空态 |
| weekly 无稳定趋势 | Weekly 主位显示“尚未形成稳定趋势” | 硬凑核心趋势卡 |
| Weekly 某 trend 缺少六轴值 | 六边形保留轮廓，对应轴显示 `insufficient evidence` | 从 supporting projects 或 `scores/*.json` 临时聚合雷达值 |
| verify / audit 缺失 | 显示 `degraded` 或 `not-judgeable` | 把审计缺失当作健康 |
| 项目详情失效 | 关闭详情并保留主列表 | 404 整页打断 |
| KB 卡缺失 | 保留索引并给出 `kb missing` | 空白详情页 |
| Time Navigator 预览不足 | 仍允许步进，但预览区显示样本不足 | 自由推断强趋势日 |

## 14. 验证矩阵与验收映射

| 验收目标 | 验证方式 | 具体关注点 |
| --- | --- | --- |
| 10-20 秒首轮判断成立 | 固定 fixture + 计时任务脚本 / 可用性冒烟 | 用户在 10-20 秒内说出“能不能信”和“先看什么” |
| 可信度优先 | 结构测试 + 浏览器视觉测试 | 首屏先见 trust/freshness/verify/source 状态 |
| Overview Alert Mode 不越界 | 结构测试 + integration | 只有显式 `editorial_spotlight` 才触发 Spotlight 布局；缺失时保持 Normal / State Alert |
| 五视图统一但不雷同 | 真实浏览器截图回归 | 壳层统一、路由人格差异清晰 |
| Projects 首屏可直接消费项目判断 | 结构测试 + 浏览器交互测试 | 不展开详情也能直接看到 `score / confidence / paradigm / persistence / top evidence / primary risk / next action cue` |
| Projects 扫描效率提升 | 浏览器交互测试 | Filter / List / Detail 节奏稳定，详情不抢列表 |
| Weekly 主趋势与证据关系可一眼理解 | 结构测试 + 视觉测试 | 六边形与六证据卡一一映射 |
| AI 透明度可追溯 | 结构测试 + 视觉测试 | 页面级 `enhancement_status`、字段级来源标签、审计入口语义一致 |
| Project 详情历史与沉淀连续可读 | 结构测试 + 交互测试 | `Persistence and Appearances` 可见，project -> KB / history 不丢上下文 |
| KB 首屏摘要可读 | 结构测试 + 视觉测试 | `Executive Summary` 先于原始字段出现 |
| 钻取上下文不漂移 | unit + integration | `Overview -> Run Health` 保留 `date + source_view=overview`；`Weekly -> Project -> KB` 固定保留 `anchor + trend_key + source_view=weekly`，且 `KB.date = weekly.window_end` |
| Time Navigator 不越界 | unit + integration | URL 显式化、上下文继承、无伪历史，`KB` 始终以 `date` 为主上下文，且 P0/P1 均支持直接落到显式切片 |
| 状态语义可区分 | state snapshot + visual test | `artifact missing -> failed`、`artifact present but empty -> empty`、`stale` 仅在 latest/新鲜度不匹配时出现 |
| 响应式降级稳定 | 浏览器断点测试 | 桌面双栏、移动端全屏 reader，且小屏关闭 / 返回路径始终可见 |
| 性能不显著恶化 | 本地浏览器计时 / 请求内缓存验证 | route switch、detail switch、microviz 延迟注入 |

建议测试承接：

- 继续扩展 [src/__tests__/visualConsoleWeb.test.ts](../../../src/__tests__/visualConsoleWeb.test.ts#L1) 做结构与 URL 契约守护。
- 继续扩展 [src/__tests__/visualConsoleWeb.visual.test.ts](../../../src/__tests__/visualConsoleWeb.visual.test.ts#L1) 做真实浏览器视觉与断点回归。

## 15. 实施承接顺序

## 15.1 P0

1. 全局壳层换代
2. 双主题 + token 体系冻结
3. Time Navigator 基础步进、键盘快捷键与 URL 归一化
4. `Overview / Projects / Weekly / Run Health / KB` 五视图首屏重构
5. Weekly 六边形证据矩阵与六证据卡映射
6. 详情独立滚动与移动端全屏 reader
7. KB 阅读器化
8. 状态系统、Loading、Edge States 落地

## 15.2 P1

1. 微型可视化体系
2. Weekly Delta（仅在上游提供可追溯输入时）
3. Projects 过滤器与键盘优先增强
4. 命令面板入口
5. Time Navigator 展开式热力预览增强

## 15.3 P2

1. 密度切换
2. 品牌主题扩展
3. Weekly 外部分发卡
4. Projects Matrix Compare
5. KB 双向链接增强

## 16. 实现就绪结论

这份设计已经把实现阶段最容易失控的点冻结为明确契约：

- UI V2.5 继续消费哪一套 artifact
- 壳层和五个一级视图如何分工
- Time Navigator 的数据来源、步进规则、URL 语义和失效降级
- `Weekly` 的六边形证据矩阵如何与现有六个评分组件对齐，且不越界成新的前端判断层
- 详情如何独立滚动、如何跨视图钻取、如何在上下文失效时显式降级
- Light / Dark、状态、AI 透传、Loading、Edge States 如何表达
- 实现触达面、性能预算和验证方式是什么

因此，后续可以直接进入 exec-plan，而不需要在实现阶段再猜：

- Time Navigator 能不能自己推断强趋势日
- Overview 能不能自行触发“重大范式转移 / S 级项目”Spotlight
- `Projects` 能不能重排 artifact 顺序
- `Weekly` 六边形到底映射什么轴
- `Weekly` 是否可以在前端私自定义新的聚合公式或 Delta 阈值
- KB 首屏到底先出字段还是先出摘要
- `KB` 能不能只带 `anchor` 而不带显式 `date`
- `latest` 是否可以长期停留在 URL 中
- 详情关闭后主上下文是否应被重置
