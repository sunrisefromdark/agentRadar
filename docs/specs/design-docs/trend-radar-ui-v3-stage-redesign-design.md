# 设计文档：Trend Radar UI V3 舞台化重设计

## 文档状态

- 版本：`v0.1`
- 状态：`Proposed for Review`
- 设计输入：
  - [trend-radar-ui-v3-stage-redesign-requirements.md](../product-specs/trend-radar-ui-v3-stage-redesign-requirements.md#L1)
  - [trend-radar-ui-v2-visual-redesign-design.md](trend-radar-ui-v2-visual-redesign-design.md#L1)
  - [trend-radar-overview-weekly-layout-refresh-v0.1.md](trend-radar-overview-weekly-layout-refresh-v0.1.md#L1)
  - [trend-radar-visual-console-design.md](trend-radar-visual-console-design.md#L1)
  - [system-spec.md](../system-spec.md#L1)
  - [app/server.ts](../../../app/server.ts#L1)
  - [src/visualConsole/context.ts](../../../src/visualConsole/context.ts#L1)
  - [src/visualConsole/build.ts](../../../src/visualConsole/build.ts#L1)
- 目标：在不改变 `artifact-first`、时间上下文、只读消费、SSR 主链路和跨视图钻取契约的前提下，把现有 `Visual Console` 从 `UI V2.5` 的“高可用视觉控制台”升级为 `UI V3` 的“舞台化趋势情报工作台”。

## 一句话设计

`UI-V3` 不是继续优化卡片，而是把整个浏览器消费层重构为一套稳定的 `Shell Hero / Context Instrument Bar / Content Stage` 页面骨架，并在 `Content Stage` 内部组织 `Route Stage -> Detail Dock / Reader` 的消费语法：首屏先建立可信度和主判断，再按路由人格把扫描、编辑、诊断和阅读放入不同舞台节奏中。

补充澄清：`Shell Hero` 是壳层优先级名称，不是视觉尺寸要求。它不应被实现为首屏最大的 hero 卡片；真正的首屏主舞台必须属于 route-level 内容区。

## 文档优先级与继承关系

- 本文是 [trend-radar-ui-v3-stage-redesign-requirements.md](../product-specs/trend-radar-ui-v3-stage-redesign-requirements.md#L1) 的对应设计文档，拥有 `UI-V3` 的视觉壳层、页面语法、组件角色、设计 token、动效和响应式优先级。
- [trend-radar-visual-console-design.md](trend-radar-visual-console-design.md#L1) 继续作为消费语义、artifact 所有权、读取层边界、状态模型和跨视图钻取契约基线。
- [trend-radar-ui-v2-visual-redesign-design.md](trend-radar-ui-v2-visual-redesign-design.md#L1) 继续作为 `UI V2.5` 历史基线，但其中与 `UI-V3` 相冲突的壳层结构、首屏布局、卡片组织方式和设计语言，以本文为准。
- [trend-radar-overview-weekly-layout-refresh-v0.1.md](trend-radar-overview-weekly-layout-refresh-v0.1.md#L1) 中与 `Overview / Weekly` 页面编排相关的有效结论被本文吸收；若仍有冲突，以本文为准。
- 当发生冲突时：
  - 业务语义、artifact 边界、URL 上下文、状态定义，以需求文档和 `trend-radar-visual-console-design.md` 为准。
  - 页面骨架、surface role、舞台编排、设计 token、视觉语言与响应式策略，以本文为准。

## 需求对齐映射

| 需求冻结项 | 本设计对应章节 |
| --- | --- |
| 全局从卡片墙升级为工作台 | `4. 总体设计策略`、`5. 全局壳层与页面语法` |
| `Overview` 建立 `trust gate -> lead decision -> continuation` | `6.1 Overview` |
| `Projects` 成为扫描工作台 | `6.2 Projects` |
| `Weekly` 成为 `Editorial Desk` | `6.3 Weekly` |
| `Run Health` 成为诊断审计台 | `6.4 Run Health` |
| `Long-tail Ecosystem Observer` 取代 KB 成为长尾发现工作台 | `6.5 Observer` |
| 固定 `Hero / Stage / Rail / Strip / Dock / Reader / Audit` 语法 | `5.3 Surface Role Contract`、`7. 组件系统与设计 Token` |
| 统一锚点、编号、证据导视 | `5.5 锚点与微视觉语言`、`7.4 组件语法` |
| 不引入第二真相源 | `2. 范围、非目标与冻结边界`、`3. 现状与承接前提`、`10. 工程落地与实现触达面` |
| Time Navigator 和上下文显式化 | `5.4 Time Navigator`、`10. 工程落地与实现触达面` |
| 动效、响应式、可访问性 | `8. 状态、交互与动效`、`9. 响应式、可访问性与性能` |
| 验收与交付优先级 | `11. 验证矩阵与验收映射`、`12. 实施承接顺序` |

## 1. 问题定义

当前 `Visual Console` 的核心消费语义已经成立，但承载形态仍然停留在 `UI V2.5`：

1. 页面仍主要由相似面板拼接而成，路由人格不够强。
2. 首屏主次关系不够绝对，用户需要先读容器，再读信息。
3. `Overview / Projects / Weekly` 都还残留明显的“卡片集合”痕迹。
4. `Run Health` 已有稳定定位，但原 `Knowledge Base` 槽位承载的是重复展示，不是独立价值模块。
5. 视觉“科技感”仍主要依赖玻璃、模糊和渐变，而不是框景、导视、编号和节奏。
6. 现有 SSR 输出结构和 CSS 组织仍偏向通用 panel 复用，不足以支撑稳定的 `stage / rail / dock / reader` 语义。
7. `Shell Hero` 在实现中被误读成“大型壳层 hero”，导致首屏高度被 header、路由入口卡和说明文案消耗，真正的业务主舞台被挤到首屏之后。

本设计解决的是“如何重做浏览器承载语法与设计系统”，并明确把原 `KB` 一级模块替换为 `Observer` 长尾生态观察模块，而不是继续保留一个重复展示页。

## 2. 范围、非目标与冻结边界

### 2.1 范围内

- 全局壳层重构：`Shell Hero`、`Context Instrument Bar`、氛围层、焦点层。
- 五个一级路由的舞台化重编排：`Overview / Projects / Weekly / Run Health / Observer`。
- `surface role contract` 冻结：`Hero / Stage / Rail / Strip / Dock / Reader / Audit`。
- 设计 token 重建：颜色、字体、边框、空间、状态、高光、分隔、动效。
- 时间导航的视觉重做和切片预览承载。
- Reader / Dock 的桌面端与移动端承载策略。
- 锚点导视、证据编号、矩阵映射和状态条语法。

### 2.2 非目标

- 不重算 `score / confidence / freshness / verify / trend judgment`。
- 不新增业务对象，不新增第六个一级路由，也不引入新的业务真相源、媒体资源系统或 CMS。
- 不把当前 SSR 站点改造成完整 SPA。
- 不引入营销页、游戏风或活动页表达。
- 不为了舞台感降低信息密度、可读性、键盘可达性和审计透明度。
- 不新增第二套 weekly 推导、前端事实聚合或前端趋势重建逻辑。

### 2.3 冻结边界

- 一级路由集合冻结为：`overview`、`projects`、`weekly`、`run-health`、`observer`。
- 本轮不改写既有 URL / query 上下文消费语义；若需调整 `latest`、`date / anchor` 或叶子跳转参数契约，仍以既有需求 / 设计基线为准，不在本文新增冻结规则。
- 详情消费边界保持不变：UI 只能重排和强调，不得自行扩充对象集合。
- `artifact-first`、只读消费和审计可追溯边界保持不变。
- render 层可以重组页面骨架与 surface role，但不得反向侵入 `read layer / context layer / truth layer`，不得为了舞台化改写事实上下文、真相来源或 artifact 边界。

## 3. 现状与承接前提

### 3.1 当前实现事实

现有仓库已经具备以下稳定前提：

- 浏览器版入口仍由 [app/server.ts](../../../app/server.ts#L1) 提供 Node SSR 承载。
- 读取层继续通过 [src/visualConsole/context.ts](../../../src/visualConsole/context.ts#L1) 和 [src/visualConsole/build.ts](../../../src/visualConsole/build.ts#L1) 解析 daily / weekly 上下文并构建 view model。
- 路由消费对象已经相对稳定：`Overview` 使用 run snapshot，`Projects` 使用项目榜单与详情，`Weekly` 使用 weekly markdown + structured report，`Run Health` 使用 run summary / verify / source audit，`Observer` 使用 ecosystem observer artifacts。
- `date / anchor / project / slug / trend_key / source_view / lang / theme` 已是既有 query 基线。

### 3.2 可以直接复用的契约

- `resolveDailyContext()` / `resolveWeeklyContext()` 的上下文解析规则。
- `resolveDailyTimeWindow()` / `resolveWeeklyTimeWindow()` 的切片步进规则。
- 各路由 build 函数现有的 view model 分层。
- Weekly 的结构化矩阵、核心趋势卡、弱信号卡，以及 Observer 所需的 ecosystem lane / match evidence / candidate detail 分层。

### 3.3 本轮允许新增但不越界的承载层

1. `Route Frame`
   - 用于表达每个一级路由的首屏舞台、后续轨道和详情区语义。
2. `Surface Role Components`
   - 用于把现有通用 panel 拆成 `hero / stage / rail / dock / reader / audit`。
3. `Anchor Navigation Layer`
   - 用于编号、轴位、证据锚点、focus 联动与 reader footnote。
4. `Time Navigator Surface`
   - 用于仪表条、切片段位器和 preview lane。
5. `Density Presets`
   - 用于 `scan / balanced / focus` 三类阅读密度预留，但不改变业务排序。

## 4. 总体设计策略

### 4.1 Stage Before Cards

- 页面先定义舞台、轨道、读板和停靠位，再决定局部容器。
- 卡片不再是默认一级构件，只在局部信息块内部作为次级承载。

### 4.2 Trust Before Exploration

- 每个路由都必须先明确当前判断、可信度或主叙事，再让用户展开更多对象。
- 高权重视觉只服务主判断、主趋势、主诊断链和主阅读入口。

### 4.3 One System, Many Personas

- 五个路由共享同一套 `Intelligence Terminal` 语言。
- 路由差异通过 `surface role` 比例、阅读节奏、锚点系统和框景密度体现。
- 不通过“每页完全不同主色”来制造假人格。

### 4.4 Frame, Rail, Anchor

- 高级感主要来自框景、刻度、编号、分段条、状态带和证据锚点。
- 氛围层只作为低噪音背景，不承担信息组织责任。

### 4.5 Reference Translation, Not Imitation

- 吸收 `pvp.qq.com` 的是“主舞台优先、浮动壳层、段落推进、焦点明确”的结构能力。
- 绝不复制其题材、角色、装饰资产或营销表达。

### 4.6 SSR-First Structural Expression

- 即使继续采用 SSR，输出 DOM 结构本身也必须表达 `Page Frame -> Route Stage -> Surface Role -> Detail Dock`。
- 不能继续依赖一层通用 `panel/card` 再由 CSS 人工拉开人格差异。

## 5. 全局壳层与页面语法

### 5.1 Page Frame

全局页面固定为三层：

1. `Shell Hero`
   - 品牌、当前路由人格说明、一级导航、轻量工具区。
2. `Context Instrument Bar`
   - `date / anchor`、artifact 时间、模式、顶层状态、Time Navigator。
3. `Content Stage`
   - 按路由切换的主舞台、次级轨道以及 `Dock / Reader / Mobile Fullscreen Reader` 等焦点消费区。

### 5.2 Shell Hero

Shell 必须满足：

- 顶栏像悬浮操作台，而不是一张巨型玻璃卡。
- 当前路由的人格说明在首屏可见，不仅仅是标题。
- 一级导航的当前态必须强于非当前态，具备明显段落感。
- `lang / theme / quick actions` 被收束到工具区，不与主舞台争抢。
- `Interest Profile` 退出首屏主表面，只允许进入折叠工具区或设置抽屉。
- 首屏不得出现“当前工作面说明 + 多张等权路由入口卡 + 下方再接 context bar”的后台式导航拼盘；若仍是这种骨架，判定为未进入 `UI-V3`。
- 若采用“压缩顶部控制条 + 侧边导航 rail”这类现代控制中台语法，视为符合方向；但无论采用哪种导航方式，壳层都不得成为首屏最大的内容块。

### 5.3 Surface Role Contract

#### `Hero`

- 承载当前路由在首屏唯一最重要的判断或主叙事。
- 同一屏不得出现多个等权 hero。

#### `Stage`

- 承载主扫描流、主趋势正文、主诊断链或主阅读正文。
- 视觉和空间优先级仅次于 `Hero`。

#### `Rail`

- 承载后续动作、辅助入口、总结 watchpoints 或次级上下文。
- 权重必须明显低于 `Stage`。

#### `Strip`

- 承载时间切片、状态带、过滤器、来源健康、轻量提示。
- 不能膨胀成新的主内容区。

#### `Dock`

- 承载用户当前聚焦对象的详情。
- 桌面端必须表现为固定停靠的阅读面板：独立滚动、可关闭、可恢复，并与列表或矩阵保持焦点联动；不得退化为页面上一列普通顺序内容。

#### `Reader`

- 承载长文、研究正文、机器区 / 人工区、脚注和 linked context。
- 必须有稳定阅读宽度、标题层级和节奏，不得退化为字段堆叠。

#### `Audit`

- 承载 `rejected outputs / failed / degraded / stale / empty / verify / fallback` 的显式解释。
- 绝不伪装成普通结果卡。

#### 焦点去重约束

- 同一业务对象不得在 `Hero`、`Rail`、`Dock` 中以同等视觉权重重复出现。
- 如果同一对象需要在多个 surface role 中出现，必须明确主次：`Hero` 负责判断入口，`Rail` 负责延续提示，`Dock` 负责细节消费。

### 5.4 Time Navigator

`Time Navigator` 重设计为 `instrument strip` 而非按钮组：

- 主视图显示当前切片、位置、总数和 stale 状态。
- `Prev / Next / Latest` 仍保留，但合并进仪表式步进器。
- preview 展开区呈现为 `preview lane / slice tray`，而不是另一层卡片网格。
- daily 与 weekly 的时间语义必须明显区分：
  - daily：单日切片。
  - weekly：窗口终点和 `window_start -> window_end`。

### 5.5 锚点与微视觉语言

所有路由共享一套低层导视语法：

- 统一的编号前缀。
- 统一的状态带和信号点。
- 统一的 mono 指标表达。
- 统一的证据锚点样式。
- 统一的脚注 / 回链 / 轴位映射语法。
- 任何 decorative layer 都必须服务阅读层级和判断速度；若某个视觉细节不能提升焦点识别、证据对照或阅读推进，则不得进入 `P0`。

这套语法必须同时出现在：

- `Weekly` 的六轴矩阵与证据 tile。
- `Projects` 的扫描行与详情证据区。
- `Run Health` 的诊断步骤与 source table。
- `Observer` 的 ecosystem note、match evidence、linked context 与 promotion watchpoint。

### 5.6 氛围层与主题

- 背景层使用低噪音径向光斑、格栅、雾面、框线或扫描纹理建立工作台氛围。
- 氛围层绝不能依赖重模糊或大面积渐变来支撑层级。
- Light / Dark 主题都必须具备明确、稳定的工作台氛围层，不能退化成“仅换色 token”的普通后台皮肤。
- 浅色主题必须保留纸面 / 台面 / 框景质感，不能退化成普通白底后台。
- 暗色主题必须保留框景、扫描感或仪表感等氛围支撑，不能只剩深底色与状态色点缀。

## 6. 路由级设计

### 6.1 Overview

#### 页面目标

`Overview` 是 `decision gate`，负责先回答“本轮结果能不能信”，再回答“今天先看什么”，最后给出后续动作。

#### 页面骨架

```text
Overview Route Frame
  -> Hero: Trust Gate + Lead Decision + Next Action
  -> Rail: Weekly Entry + Run Health + Risk Watchpoints
  -> Strip: Source Health / Time / Status
  -> Stage: Research Stream / Spotlight Continuation
  -> Dock: Selected Project Detail
```

#### 设计冻结

1. 首屏只有一个连续 `Hero`，内部由 `Run Trust Summary`、`Featured Decision` 和 `Next Action Cue` 组成。
2. `Weekly Entry` 和 `Run Health` 入口进入 `Rail`，不再与 Hero 同权。
3. `Source Health`、`Interest Profile` 进入 `Strip / Tool Zone`。
4. 主项目流使用 `research stream` 或 `scan band`，不再是相似大卡阵列。
5. 风险提示压缩为短促的延续区；建议动作必须作为 `Hero` 收束区的一部分在首屏明确给出。
6. 阅读顺序固定为：
   - `trust gate`
   - `lead decision`
   - `continuation`
   - `research stream`

#### 禁止回退

- 回退成 6 到 7 张等权大卡。
- 把 `Weekly Entry`、`Source Health`、`Preference` 做成首屏主表面。
- 让 spotlight 退化成列表第一张卡。

### 6.2 Projects

#### 页面目标

`Projects` 是 `scan bench`，核心体验是快速扫描、横向比较、聚焦下钻。

#### 页面骨架

```text
Projects Route Frame
  -> Strip: Filter Bench + Context Chips
  -> Stage: Scan Rows
  -> Dock: Dossier Detail (Why It Matters / Evidence / Risks / Next Actions)
  -> Rail: Optional Watchpoints / Reading Hints
```

#### 设计冻结

1. 过滤区改为 `filter bench`，像研究滤镜台，而不是普通 chips 容器。
2. 项目主列表改为 `scan row / dossier row`：
   - 左侧：`project identity + thesis`
   - 中部：`top evidence / why now`
   - 右侧：`score cluster / primary risk / next action cue`
3. 行级信息必须在不打开详情时就能扫出关键判断。
4. 当前选中行与 `Dock` 之间必须存在显式 focus 联动。
5. `Dock` 内部信息架构冻结为 `Why It Matters -> Evidence -> Risks -> Next Actions`，不得把“为什么值得看、证据是什么、风险和下一步是什么”继续留给实现层自行决定。
6. `Dock` 只服务当前焦点项目，不再像一页孤立的右侧说明书。
7. `Evidence Anchor` 必须连接行内证据摘要和详情证据展开区。

#### 禁止回退

- 退化成纯表格后台。
- 保留“每个项目一张相似卡”的主形态。
- 让详情区只重复列表已有信息而不建立证据和动作结构。

### 6.3 Weekly

#### 页面目标

`Weekly` 是 `Editorial Desk`，必须先建立本周封面，再建立证据矩阵，再进入主趋势正文。

#### 页面骨架

```text
Weekly Route Frame
  -> Hero: Weekly Cover Stage
  -> Rail: Overall Weekly Judgment
  -> Stage A: Evidence Matrix
  -> Stage B: Core Trend Storyline
  -> Strip A: Weak Signals
  -> Strip B: Watchpoints
  -> Dock: Project Detail / Trend-linked Drilldown
```

#### 设计冻结

1. 首屏必须有明确 `weekly cover stage`。
2. `Evidence Matrix` 必须早于核心趋势正文出现。
3. `Core Trend` 拥有全宽或近全宽舞台，只允许纵向主叙事。
4. `Weak Signals` 必须后置，绝不与 `Core Trend` 共用同一主故事带。
5. `Watchpoints` 独立于 `Weak Signals`。
6. 六轴矩阵、编号和证据 tile 之间必须一眼可对照。
7. 只有上游提供结构化 delta，UI 才能展示方向变化符号。
8. 页面整体应比其他路由更有封面感，但仍属于 `Intelligence Terminal`，不是宣传页。

#### 禁止回退

- 再次变成信息列表页。
- 把最重要的核心趋势正文压成半屏。
- 用装饰性大背景假装“编辑台”而不建立真实主从结构。

### 6.4 Run Health

#### 页面目标

`Run Health` 是 `diagnostic audit stage`，让用户按固定顺序完成“先诊断，再行动”。

#### 页面骨架

```text
Run Health Route Frame
  -> Hero: Can We Trust This Run
  -> Stage: Source Status Tables
  -> Audit: Verify / Rejected Outputs / Failure / Fallback Explanation
  -> Rail: Recommended Actions
```

#### 设计冻结

1. 页面固定按 `总判断 -> source status -> verify / audit context -> recommended actions` 展示，不允许交换顺序。
2. 诊断链条必须是分段舞台，不是多个内容块拼盘。
3. 表格允许保留，但必须嵌入首个 `diagnostic stage frame`；`verify`、`rejected outputs` 与 `failure / fallback` 解释进入后续 `Audit` 段。
4. `failed / degraded / stale / empty` 必须用文本、图标、标签和颜色共同表达。
5. 页面应更冷静、更收束，减少娱乐化或漂浮感。

#### 禁止回退

- 变成原始日志页。
- 与其他页面共用“玻璃卡堆叠”骨架。

### 6.5 Observer

#### 页面目标

`Observer` 是 `Long-tail Discovery Bench`，优先提供长尾生态发现、匹配证据解释和后续观察入口。

#### 页面骨架

```text
Observer Route Frame
  -> Hero: Long-tail Discovery Summary
  -> Stage: Ecosystem Lanes / Candidate Rows
  -> Rail: Observer Status / Watch Guidance / Scope Boundary
  -> Dock: Candidate Detail (Why Matched / Why It Matters / Why Not Main Board Yet / Next Watch)
```

#### 设计冻结

1. 首屏必须先回答“今天哪个生态最值得观察、为什么”。
2. 主舞台必须按 ecosystem lane 组织，而不是按 legacy KB card 组织。
3. 每个 candidate row 至少要显式展示 `ecosystem / match evidence / repo identity / why watch / why not promoted`。
4. `Dock` 的信息顺序冻结为 `Why Matched -> Why It Matters -> Why Not Main Board Yet -> Next Watch`。
5. 页面必须持续提醒“observer-only != objective hotness”，避免与主榜单语义混淆。
6. linked context 可以回链到 `Projects` / `Weekly` / `Run Health`，但 Observer 本身不得退化为 KB 阅读器或项目详情附页。

#### 禁止回退

- 回退到 `kb` 阅读器语义。
- 把 observer 做成隐藏榜单、二次评分页或伪装的项目详情页。

## 7. 组件系统与设计 Token

### 7.1 核心承载组件

`UI-V3` 冻结以下组件角色：

1. `Stage Hero`
2. `Stage Frame`
3. `Framed Panel`
4. `Context Instrument Strip`
5. `Route Tabs / Intent Tabs`
6. `Scan Row`
7. `Reader Dock`
8. `Reader Frame`
9. `Audit Panel`
10. `Status Band`
11. `Signal Chip`
12. `Evidence Tile`
13. `Evidence Anchor`
14. `Meta Rail`

### 7.2 色彩 Token

#### Dark

- `ink`
- `graphite`
- `brass`
- `cyan signal`
- `warning amber`
- `risk crimson`
- `success moss`

#### Light

- `stone`
- `parchment`
- `charcoal`
- `brass accent`
- `cyan signal`
- `warning ochre`
- `risk brick`

冻结原则：

- 色彩方向固定为“深底 / 台面底 + 金属高光 + 信号色点亮”，而不是模板化紫色科技风。
- 状态色拥有统一语义，不按页面自定义。
- 高亮只用于焦点、锚点和状态，不用于大面积背景填充。

### 7.3 字体 Token

- 标题字体需要更有舞台张力，但仍适合产品界面。
- 正文字体优先保证中英混排和长阅读舒适度。
- 数字、时间、指标、状态采用等宽数字。
- 字体选择指向研究产品和情报终端，不做字体秀。

### 7.4 组件语法

- `Stage Hero`：负责唯一主判断或主叙事。
- `Stage Frame`：负责路由级主舞台的边界和段落起点。
- `Scan Row`：负责扫描式列表，不允许退化成等权卡片。
- `Reader Dock`：负责细节承载、独立滚动和焦点返回。
- `Audit Panel`：负责 `rejected outputs`、失败、降级、`stale / empty`、verify、fallback 解释。
- `Evidence Anchor`：负责矩阵、列表、详情、reader 的跨区域映射。

### 7.5 版式与密度 Token

- 页面优先采用非对称双栏和主舞台 + 次轨布局。
- P0 预留三种信息密度姿态：
  - `scan`
  - `balanced`
  - `focus`
- 圆角、描边、分隔、高光、阴影、模糊、间距必须 token 化。
- 页面人格通过密度、框架和 surface role 比例变化表达，而不是靠完全不同主题皮肤。

## 8. 状态、交互与动效

### 8.1 状态表达

- `ready / degraded / stale / failed / empty / not-judgeable` 继续沿用既有顶层状态枚举。
- 每种状态必须同时具备：
  - 文本标签
  - 语义色
  - 图标或形状
  - 在必要场景下的解释入口

### 8.2 交互反馈

- `hover / focus / selected` 必须显著区分。
- 列表选中、矩阵命中、reader 锚点跳转和 dock 打开，都要有一致的 focus 反馈。
- 焦点迁移必须可逆，用户总能返回上一步上下文。

### 8.3 动效语法

P0 只保留四类克制动效：

1. `Scene Shift`
2. `Instrument Response`
3. `Dock Open / Close`
4. `Reader Focus`

冻结规则：

- 不使用持续炫光、浮动粒子或高频循环装饰动画。
- 动效优先传达结构变化和焦点迁移，而不是展示技术炫技。

## 9. 响应式、可访问性与性能

### 9.1 响应式

- 桌面端优先保持 `stage + rail + dock` 完整结构，且 `Dock` 继续作为固定停靠的阅读面板存在。
- 平板端允许弱化为单列主舞台 + 次轨折叠。
- 移动端降级为 `strong hero + segmented reader`，不强求保留完整桌面交互。
- 小屏下 `Dock` 必须能进入全屏 reader 模式。

### 9.2 可访问性

- 不能只靠颜色表达状态。
- 背景氛围层不得影响正文对比度。
- 键盘导航、焦点态和关闭 / 返回路径必须保留。
- 长 repo 名、长摘要、中英混排和长链接不能破版。

### 9.3 性能与实现约束

- 不允许为了装饰层引入重度前端运行时。
- 背景氛围优先使用轻量 CSS 层，而不是高成本特效。
- SSR 输出应尽量稳定，避免为视觉切换引入大量客户端重排逻辑。

## 10. 工程落地与实现触达面

### 10.1 结构触达面

- [app/server.ts](../../../app/server.ts#L1)
  - 路由级 render 结构需要从通用 panel 编排升级为 `route frame + surface role` 输出。
- [src/visualConsole/build.ts](../../../src/visualConsole/build.ts#L1)
  - 需要把现有 view model 进一步整理为 `hero / stage / rail / strip / dock / audit` 可直出的渲染模型，但这类整理只允许发生在 render / view-model 翻译层，不得反向要求 read/context/truth layer 改写事实语义。
- [src/visualConsole/context.ts](../../../src/visualConsole/context.ts#L1)
  - 保持 `date / anchor / latest` 解析规则不变，只增强 UI 显示语义。

### 10.2 样式与组件触达面

- `app/styles.css`
  - 从通用视觉皮肤升级为稳定 token 和 route-level grammar。
- 现有页面渲染组件
  - 需要引入 `Stage Hero / Scan Row / Reader Dock / Audit Panel / Evidence Anchor` 等组件边界。

### 10.3 测试与回归触达面

- `visualConsoleWeb` 相关测试需补充：
  - `route frame` 结构断言。
  - `surface role` 存在性断言。
  - `Overview / Weekly` 主从关系断言。
  - `Weekly` 核心趋势与弱信号相对位置断言。
  - `Run Health` 诊断路径顺序断言。
  - `KB` 阅读器结构断言。
  - `Time Navigator` 回归断言：`Prev / Next / Latest` 快速步进仍保留，且当前切片 / stale 语义继续显式可见。
  - 详情切换回归断言：`Dock` 打开、关闭、恢复、焦点联动与局部更新路径不被视觉改版破坏。

### 10.4 明确不触达的层

- 不改 `readLayer` 的业务事实来源。
- 不改 `context layer / truth layer` 的分层职责、输入语义和对 artifact-first 的边界定义。
- 不改 daily / weekly / run-summary / KB artifact 格式。
- 不新增前端重算的排序、趋势、可信度和风险逻辑。

## 11. 验证矩阵与验收映射

### 11.1 视觉换代验收

1. 第一眼可明确区分 `UI-V3` 与旧版卡片皮肤。
2. 整体气质更像 `Intelligence Terminal`，不是营销页，也不是普通后台。
3. 五个一级视图统一但不雷同，每页都有清晰人格。
4. `Weekly` 能被识别为 `Editorial Desk`。
5. `Observer` 能被识别为长尾生态发现工作台，而不是 KB 变体。

### 11.2 结构验收

1. `Overview` 首屏不再是等权卡片墙。
2. `Projects` 主体不再是项目卡片列表。
3. `Weekly` 的 `Core Trend` 拥有主舞台，`Weak Signals` 后置。
4. `Run Health` 明确体现诊断顺序。
5. `Observer` 明确体现 `ecosystem summary -> candidate evidence -> follow-up context`。
6. 全站存在稳定的 `Hero / Stage / Rail / Dock / Reader / Audit` 语法。
7. `Weekly` 的矩阵、轴位与证据块之间存在一眼可读的锚点关系。

### 11.3 效率验收

1. 用户能在 `10-15` 秒内判断当前结果是否值得继续消费。
2. 用户能在 `Projects` 中快速完成扫描并打开一个详情。
3. 用户能在 `Weekly` 中一眼读出主趋势与证据矩阵关系。
4. 用户能在 `Observer` 中先看到长尾发现结论，再决定是否深入某个 candidate。
5. 用户无需先理解容器布局，就能知道当前主舞台、次级入口和继续方向。

### 11.4 边界验收

1. 不破坏 `artifact-first`、时间导航、详情切换与可审计边界；既有上下文显式化与 drilldown 回链能力也必须保留。
2. 不新增前端推理或第二真相。
3. 新样式必须以 design token 和稳定组件边界落地，不能继续堆叠补丁。
4. 前端输出结构能表达 `route frame + surface role`，而不是只靠 CSS 假装有层级。

## 12. 实施承接顺序

### P0

1. 全局壳层和 `surface role contract` 落地。
2. `route frame` 骨架冻结并落地。
3. `Overview` 舞台化首屏。
4. `Projects` 扫描台化。
5. `Weekly` 封面、矩阵和主趋势舞台化。
6. `Run Health` 诊断链重构。
7. `Observer` 工作台化并取代原 `Knowledge Base` 槽位。
8. 主题、字体、边框、状态、布局 token 冻结。
9. 锚点、编号和 dock / reader 规范冻结。
10. 纯装饰性视觉细节若不能提升判断速度或阅读层级，不得占用 `P0` 范围。

### P1

1. 高级时间切片预览。
2. 更完整的场景切换与 reader focus 动效。
3. 更强的移动端阅读体验。
4. 可复用的 `section frame / stage frame` 组件体系。
5. `scan / balanced / focus` 密度姿态开放。

### P2

1. 命令面板和更强键盘流。
2. 可分享视图增强。
3. 可视化辅助组件进一步扩展。

## 13. 冻结结论

`READY FOR IMPLEMENTATION PLANNING`

本次设计冻结的核心结论是：

1. `UI-V3` 的本质是页面语法升级，而不是卡片换皮。
2. 整站必须围绕 `Shell Hero / Context Instrument Bar / Content Stage` 组织，并在 `Content Stage` 内部稳定表达 `Route Stage -> Dock / Reader`。
3. 五个路由必须共享同一套 `Intelligence Terminal` 语言，但拥有不同的人格和阅读节奏。
4. `Overview`、`Projects`、`Weekly`、`Run Health`、`Observer` 都必须从“面”级编排出发，而不是从“卡”级堆叠出发。
5. 后续实现、回归和视觉验收都必须以本文和对应需求文档为边界，不再接受回退到“继续修卡片”的方向。
