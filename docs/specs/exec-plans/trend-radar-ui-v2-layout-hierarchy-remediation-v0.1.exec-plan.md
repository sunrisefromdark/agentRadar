# 执行计划：Trend Radar UI V2 布局与信息层级纠偏 v0.1

## 文档状态

- 版本：`v0.1`
- 当前状态：`Blocked`
- 负责人：`Codex`
- 风险等级：`High`
- 设计来源：
  - `docs/specs/product-specs/trend-radar-ui-v2-visual-redesign-requirements.md`
  - `docs/specs/design-docs/trend-radar-ui-v2-visual-redesign-design.md`
  - `docs/specs/design-docs/trend-radar-overview-weekly-layout-refresh-v0.1.md`
- 审核约束：
  - `docs/specs/exec-plans/ExecPlan_ReviewSkill.md`
- 说明：本计划是对已完成 `trend-radar-ui-v2-visual-redesign-v0.1.exec-plan.md` 的 follow-up remediation。它不重做整站 UI V2.5，只处理最新设计文档刚冻结的布局与信息层级问题：卡片过多、首屏表面失控、`Weekly` 核心趋势卡半屏化、`Weak Signals` 越级抢占主舞台。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Trend Radar UI V2 布局与信息层级纠偏 |
| 用户触发问题 | 卡片过多、大小混杂、排版混乱、冗余信息过多；`Weekly` 核心趋势卡被 `Weak Signals` 挤占，未能占满主叙事宽度 |
| 主要影响面 | `Overview` 与 `Weekly` 首屏结构、共享表面预算、浏览器端排版与视觉回归守护 |
| 交付目标 | 在不突破 `artifact-first`、URL 契约、状态模型与只读消费边界的前提下，把 `Overview` 与 `Weekly` 修正为主从清晰、表面数量受控、核心趋势全宽叙事的 UI V2 follow-up 版本 |

## 目标

本计划只解决以下六件事，不额外发明新的产品行为：

1. 把 `Overview` 首屏严格收敛为 `Judgment Canvas -> Continuation Rail -> Research Stream` 三阅读区，停止多张等权大卡拼盘。
2. 把 `Weekly` 改成 `Cover Stage -> Trend Evidence Matrix -> Core Trend Stage -> Weak Signal Strip -> Next Week Watchpoints` 的顺序阅读流，终止“核心趋势半屏 + 弱信号半屏”的横向竞争。
3. 明确冻结首屏表面预算与卡片权重：微型信息继续存在，但必须吸附到主表面内，不再各自长成独立大卡。
4. 保持现有 `Weekly` 六轴证据矩阵、`delta_summary`、`worth_following_next_week`、详情钻取、无稳定趋势周降级等只读契约不变。
5. 增补结构测试与浏览器视觉回归，确保后续实现无法再次退回“多卡混排”或“核心趋势被弱信号挤占”的旧版式。
6. 让这份计划在粒度、边界、验收和验证矩阵上满足 `ExecPlan_ReviewSkill.md` 的可审核要求。

## 设计对齐

| 设计来源 | 本计划承接位置 | 实施要求 |
| --- | --- | --- |
| `requirements / 1.2` 当前 UI 核心问题 | `当前状态`、`Phase H1 / H2` | 解决卡片过多、尺度混杂、`Weekly` 主次倒置 |
| `requirements / 9.1 Overview` | `Phase H1`、`验收 1` | 只保留三阅读区、一个 featured decision、压缩 `Source Ribbon`、移出 `Preference / Interests` |
| `requirements / 9.3 Weekly` | `Phase H2`、`验收 2` | `Core Trend Stage` 全宽、矩阵先于趋势、`Weak Signals` 后置且降级 |
| `requirements / 15.3 结构升级验收` | `验收标准`、`关键负例` | 验证核心趋势不再与弱信号等权并排 |
| `design / 7.1 Overview` | `Phase H1` | 首屏三阅读区、表面预算与冗余约束、`Editorial Spotlight` 只读边界 |
| `design / 7.3 Weekly` | `Phase H2` | 六段桌面布局、`Core Trend Stage` 契约、`Weak Signal Strip` 契约、无稳定趋势周降级 |
| `layout-refresh addendum / 1` | `Phase H1` | `Judgment Canvas` 连续表面感、`Continuation Rail` 克制化、研究流后置 |
| `layout-refresh addendum / 2` | `Phase H2` | 核心趋势全宽主舞台、弱信号后置次级区、`Watchpoints` 独立 |
| `layout-refresh addendum / 3 / 4 / 5` | `Phase H3 / H4` | 响应式保持单列主趋势、自检体感转成浏览器验收与负例 |

## 范围边界

### 允许修改

- `app/server.ts`
- `app/styles.css`
- `src/__tests__/visualConsoleWeb.test.ts`
- `src/__tests__/visualConsoleWeb.visual.test.ts`
- `docs/specs/exec-plans/README.md`
- `docs/specs/exec-plans/trend-radar-ui-v2-layout-hierarchy-remediation-v0.1.exec-plan.md`
- `src/visualConsole/build.ts`
- `src/visualConsole/types.ts`

### 允许修改的条件

- 只有当 `app/server.ts` 当前无法直接按现有 `OverviewViewModel` / `WeeklyViewModel` 完成重新编排时，才允许触达 `src/visualConsole/build.ts` 或 `src/visualConsole/types.ts`。
- 对 `build.ts / types.ts` 的改动只允许做只读消费层的字段整形、排序显式化或模板承载便利化，不允许新增任何新的周趋势结论、权重、阈值或聚合逻辑。

### 禁止修改

- 不改动 `src/visualConsole/readLayer.ts`、`src/visualConsole/context.ts` 的 URL 解析、时间漫游、历史切片和上下文继承语义。
- 不改动 scoring、signal、daily/weekly 生成逻辑，不改变 `score / confidence / freshness / verify / trend judgment` 语义。
- 不新增新的 artifact payload、前端 AI confidence score、趋势等级、强趋势日推断、热力推断或第二真相源。
- 不把 `Preference / Interests` 重新放回 `Overview` 的页面级主内容区。
- 不通过删除结构断言、放宽视觉测试或只更新截图来掩盖版式没有真正纠偏的问题。

### 兼容性约束

- 一级路由保持 `overview / projects / weekly / run-health / kb` 不变。
- 现有 `date / anchor / project / slug / trend_key / source_view / lang / theme` 语义保持不变。
- `Weekly -> Project Detail`、`Project -> KB`、详情关闭只移除叶子 query、桌面端 detail 独立滚动、移动端全屏 detail/read mode 必须继续成立。
- `editorial_spotlight`、`evidence_matrix.axes[]`、`delta_summary`、`worth_following_next_week` 只消费既有显式字段，不允许前端补算。

## 当前状态

- 需求文档已经新增对 `Overview` 首屏表面预算的冻结要求，并明确禁止大中小卡混排、多个大卡同时抢首屏。
- 主设计文档已经把 `Weekly` 改为六段结构，并冻结了 `Core Trend Stage` 全宽、`Weak Signal Strip` 后置、`Next Week Watchpoints` 独立的规则。
- 页面级补充文档已经把这次纠偏的“视觉走查与体感自检”写成显式规格，明确指出：如果 `Weak Signals` 与 `Core Trend` 同处一条左右双栏主故事带，应视为设计失败。
- 当前实现层仍保留 `.weekly-story-grid` 与相关并排结构，且 `Overview` 首屏仍有回退到多卡拼盘的风险，说明代码与最新设计尚未重新对齐。
- 现有已完成的 `trend-radar-ui-v2-visual-redesign-v0.1.exec-plan.md` 记录的是更早一轮 UI V2.5 实施账本，不足以覆盖这次 follow-up 的层级纠偏要求，因此需要独立 follow-up plan。

## 非目标

- 不重新打开整站 UI V2.5 的全量改版，不重做 `Projects`、`Run Health`、`Knowledge Base` 的产品定义。
- 不顺带推进新的命令面板、expanded navigator heatmap、品牌主题扩展、KB 双向链接或 `Projects Matrix Compare`。
- 不引入新的交互式趋势切换器、复杂 tab 状态或卡片折叠系统；首轮实现优先采用最直接、最稳妥的全宽纵向叙事方案。
- 不因为追求“更漂亮”而削弱 `Run Trust Summary`、六轴证据矩阵、状态标签、透明度标签或失败降级显式性。

## 当前进度

- 设计修订：`Done`
- 执行计划编写：`Done`
- 实施代码：`Done`
- 验证执行：`Blocked`

## 阶段进度

| 阶段 | 状态 | 设计映射 | 说明 |
| --- | --- | --- | --- |
| Phase H0：规格锁定与实现基线复核 | `DONE` | `requirements / 9.1 / 9.3`、`design / 7.1 / 7.3`、`addendum / 1 / 2 / 4` | 已完成设计文档修订与实现热点定位 |
| Phase H1：Overview 首屏层级纠偏 | `DONE` | `requirements / 9.1`、`design / 7.1`、`addendum / 1` | 已把首页收敛为 `Judgment Canvas -> Continuation Rail -> Research Stream`，并把 `Preference / Interests` 移回壳层工具区 |
| Phase H2：Weekly 全宽主趋势与弱信号降级 | `DONE` | `requirements / 9.3`、`design / 7.3`、`addendum / 2` | 已改为 `Cover -> Matrix -> Core Trend Stage -> Weak Signal Strip -> Watchpoints` 的纵向叙事流，并移除旧主故事带 |
| Phase H3：响应式、自检体感与视觉预算收口 | `DONE` | `addendum / 3 / 4 / 5` | 已收口桌面/平板/窄屏断点，确保核心趋势保持单列主舞台，弱信号次级后置 |
| Phase H4：测试、回归与账本同步 | `BLOCKED` | `requirements / 15.3`、`addendum / 5` | 结构测试、视觉测试、全量 Visual Console 回归与 preflight 已完成；`npm run lint` 仍被仓库既有 quality gate 债务阻塞 |

## 已落地内容

- `docs/specs/product-specs/trend-radar-ui-v2-visual-redesign-requirements.md` 已冻结 `Overview` 首屏表面预算、`Weekly` 全宽 `Core Trend Stage` 与结构验收口径。
- `docs/specs/design-docs/trend-radar-ui-v2-visual-redesign-design.md` 已冻结新的 `Weekly` 六段结构、`Core Trend Stage` 契约与 `Weak Signal Strip` 契约。
- `docs/specs/design-docs/trend-radar-overview-weekly-layout-refresh-v0.1.md` 已重写为页面级补充文档，新增“视觉走查与体感自检”。
- `app/server.ts` 已把 `Overview` 重排为 `Judgment Canvas -> Continuation Rail -> Research Stream`，并把 `Weekly` 重排为 `Cover -> Matrix -> Core Trend Stage -> Weak Signal Strip -> Watchpoints`。
- `app/styles.css` 已收口 `Overview` / `Weekly` 的桌面、平板和移动端布局，确保核心趋势保持单列主舞台、弱信号次级后置。
- `src/__tests__/visualConsoleWeb.test.ts` 与 `src/__tests__/visualConsoleWeb.visual.test.ts` 已新增结构断言、视觉断言与“无稳定趋势周”降级断言。
- `docs/specs/exec-plans/README.md` 已同步索引状态与下一步说明。

## 实施阶段

### Phase H0：规格锁定与实现基线复核

目的：

- 在动代码前，把最新需求、设计、补充设计和现有实现的冲突面一次性点清，避免执行层再次自由解读“哪些卡该保留、哪些卡该后置”。

决策：

- 以 `trend-radar-ui-v2-visual-redesign-design.md` 与 `trend-radar-overview-weekly-layout-refresh-v0.1.md` 作为本计划的唯一页面布局来源。
- 以 `app/server.ts` 中 `Overview` / `Weekly` 渲染结构和 `app/styles.css` 中相关 class 为主要纠偏对象。
- 明确把当前 `.weekly-story-grid`、`Overview` 首屏独立白卡过多、`Preference` 在首页主内容区重新出现，视为本计划要消除的实现信号。

约束：

- 本阶段只允许做规格比对、选择目标文件与列出测试缺口，不改任何数据语义。

### Phase H1：Overview 首屏层级纠偏

目的：

- 让用户在进入 `Overview` 后，按设计要求顺序读到“能不能信 -> 先看什么 -> 继续往哪里走”，而不是先被多个大小不一的卡打断。

决策：

- 在 `app/server.ts` 中把 `Overview` 主内容显式组织为三个阅读区：`Judgment Canvas`、`Continuation Rail`、`Research Stream`。
- `Judgment Canvas` 只保留 `Run Trust Summary` 与一个 `Featured Decision`，并让它们处于同一连续 Hero 表面。
- `Continuation Rail` 只承载 `Weekly Entry` 与 `Risks & Actions`，不再新增新的首屏主模块。
- `Source Ribbon` 进入 `Research Stream` 顶部，并以压缩条带/微卡承载；`Decision Stream` 继续位于其后。
- 若 `Preference / Interests` 当前仍在 `Overview` 主内容区展示，则只允许把它移回壳层工具区、折叠区或设置入口；不得删除其功能，不得改表单语义。

约束：

- 不允许新增第二个 featured decision，不允许改变 daily artifact 中项目顺序或重新排名。
- 不允许用“隐藏模块”来伪造简化；`Weekly Entry`、`Risks & Actions`、`Source Ribbon` 都必须保留，但只能在正确层级出现。

### Phase H2：Weekly 全宽主趋势与弱信号降级

目的：

- 把 `Weekly` 从“核心趋势与弱信号抢半屏”的状态，修正为“封面 -> 证据 -> 全宽核心趋势 -> 次级弱信号 -> 观察点”的清晰周报阅读流。

决策：

- 在 `app/server.ts` 中拆除 `Core Trend` 与 `Weak Signals` 的同层并排结构，不再渲染旧的 `weekly-story-grid` 主故事带。
- 先渲染 `Weekly Cover` 与 `Overall Weekly Judgment`，再渲染 `Trend Evidence Matrix`，再进入 `Core Trend Stage`。
- `Core Trend Stage` 的首轮实现固定采用“纵向全宽堆叠”方案：
  - 第一张核心趋势卡默认展开。
  - 其余核心趋势卡按现有 `core_trend_cards[]` 顺序继续纵向排列。
  - 首轮不新增 tab、轮播、折叠队列等新交互状态。
- `Weak Signals` 独立后置为 `Weak Signal Strip`，只在核心趋势区之后出现；桌面端可以使用压缩多列，但必须是次级视觉权重。
- `Next Week Watchpoints` 保持独立区块，不再混进弱信号面板。
- 当不存在稳定核心趋势但存在弱信号时，继续沿用设计冻结的降级：`Weak Signal Strip` 升级为全宽主内容区，矩阵保留 `insufficient evidence` 轮廓。

约束：

- 不允许从 `supporting projects` 或 `scores/*.json` 额外推导新的 `core_trend` 顺序、雷达值或 delta 方向。
- 不允许为了“省事”保留左右双栏主故事带，再仅仅把宽度稍微调大。

### Phase H3：响应式、自检体感与视觉预算收口

目的：

- 把补充设计里的“体感自检”转成可执行的排版约束，避免桌面端修好了、平板和窄屏又把核心趋势拆回小卡。

决策：

- 在 `app/styles.css` 中为 `Overview` 与 `Weekly` 新结构建立明确的 desktop / tablet / mobile 布局分支。
- `Core Trend Stage` 在所有断点都保持单列主舞台；窄屏只允许纵向收缩，不允许重新并排。
- `Weak Signal Strip` 只在桌面端使用压缩多列；在中小屏收敛为单列。
- `Overview` 首屏的 `Judgment Canvas` 与 `Continuation Rail` 在桌面端保持双栏，在中小屏收敛为单列，但不打乱阅读顺序。
- 统一收紧过多的独立阴影、边框和卡尺寸差异，确保“主舞台、次级区、微型补充区”的视觉压强差有明确规律。

约束：

- 不改变现有 detail 独立滚动、焦点层、键盘快捷键和移动端全屏 detail/read mode 的既有行为。
- 不因为减少卡片数量而把多个语义不同的状态标签挤成不可读的一行噪声。

### Phase H4：测试、回归与账本同步

目的：

- 把这次纠偏的核心风险转成结构断言、视觉断言和负例，保证后续不能再无声退化。

决策：

- 在 `src/__tests__/visualConsoleWeb.test.ts` 中新增或收紧以下结构断言：
  - `Overview` 首屏只出现一个 featured decision。
  - `Overview` 主内容区不再出现 `Preference / Interests` 主模块。
  - `Weekly` 中 `Trend Evidence Matrix` 出现在 `Core Trend Stage` 之前。
  - 当存在稳定核心趋势时，`Weak Signals` 不与 `Core Trend Stage` 位于同一横向主故事带。
  - `Next Week Watchpoints` 独立于 `Weak Signal Strip`。
- 在 `src/__tests__/visualConsoleWeb.visual.test.ts` 中新增或更新浏览器视觉回归：
  - `Overview` 首屏三阅读区。
  - `Weekly` 全宽核心趋势卡。
  - 无稳定趋势周下 `Weak Signal Strip` 升级为主内容区。
- 同步更新 `docs/specs/exec-plans/README.md` 与本计划自身的验证记录、结论记录、下一阶段入口。

约束：

- 不允许只更新截图而没有对应结构断言。
- 不允许通过放宽选择器、删除负例或降低断点覆盖来“让测试通过”。

## 验收标准

### 验收 1：Overview 首屏不再是卡片拼盘

- 可观测结果：主内容区呈现 `Judgment Canvas -> Continuation Rail -> Research Stream` 三阅读区。
- 成功条件：只有一个 featured decision；`Weekly Entry`、`Risks & Actions` 位于连续行动侧轨；`Source Ribbon` 位于研究流顶部；`Preference / Interests` 不再占据首页主内容。
- 失败条件：首屏再次出现多个等权大卡、多个 featured decision、`Preference` 回到主内容区，或用户需要先理解容器才能理解信息。

### 验收 2：Weekly 核心趋势重新占据主舞台

- 可观测结果：页面呈现 `Cover -> Matrix -> Core Trend Stage -> Weak Signal Strip -> Watchpoints` 的顺序。
- 成功条件：当存在稳定核心趋势时，首张核心趋势卡必须是全宽主叙事卡；`Weak Signals` 位于其后，且不再左右并排；`Watchpoints` 独立。
- 失败条件：保留旧的左右双栏主故事带，或核心趋势卡仍然只获得半屏宽度。

### 验收 3：矩阵与弱信号的主次关系成立

- 可观测结果：矩阵先于核心趋势区，弱信号晚于核心趋势区。
- 成功条件：六轴矩阵保持原有只读契约；证据矩阵、核心趋势、弱信号、观察点的顺序与设计一致；无稳定趋势周时触发明确降级。
- 失败条件：前端补算雷达、矩阵排到后面、弱信号抢到核心趋势之前，或无稳定趋势周仍强凑核心趋势正文。

### 验收 4：响应式与体感自检可通过

- 可观测结果：桌面、平板、手机都不把核心趋势拆成左右小卡；弱信号只做后置次级区。
- 成功条件：`Core Trend Stage` 在所有断点保持单列主舞台；`Weak Signal Strip` 在窄屏收敛为单列；`Overview` 在窄屏仍保持原始阅读顺序。
- 失败条件：断点切换后重新出现大中小卡混排，或小屏核心趋势被拆散。

## 关键负例

- `Overview` 首屏再次渲染两个以上 featured decision，判定失败。
- `Overview` 主内容区仍然出现 `Preference / Interests` 卡，判定失败。
- `Overview` 的 `Weekly Entry`、`Risks & Actions`、`Source Ribbon` 再次变成三张并列大卡，判定失败。
- `Weekly` 当存在稳定核心趋势时，若 `Weak Signals` 与 `Core Trend` 位于同一横向主故事带，判定失败。
- `Weekly` 若矩阵出现在核心趋势之后，判定失败。
- `Weekly` 若使用新的 tab、轮播或折叠交互来掩盖旧布局，而设计未明确要求这些新状态，判定失败。
- 无稳定趋势周若没有明确写出“尚未形成稳定主趋势”，判定失败。
- 任何实现若通过新增前端聚合或补算来支撑新布局，判定失败。

## 验证矩阵

| 类型 | 验证内容 | 命令 / 方法 | 通过标准 |
| --- | --- | --- | --- |
| 计划 | ExecPlan review 预检 | `npm run exec-plan:review:preflight` | 计划结构、审核输入与门禁材料齐全 |
| 计划 | ExecPlan 结构预检 | `npm run exec-plan:preflight` | 新计划与索引通过仓库 preflight |
| 类型 | 浏览器层类型检查 | `npm run typecheck` | 无新增类型错误 |
| 质量 | 基础质量门禁 | `npm run lint` | 无新增 lint / quality 回归 |
| 结构 | Web 结构与层级断言 | `npm run test:visual-console:web` | `Overview` / `Weekly` 新结构、顺序、负例全部通过 |
| 浏览器 | 视觉与断点回归 | `npm run test:visual-console:web:visual` | 首屏三阅读区、全宽核心趋势、断点收敛都通过 |
| 回归 | 全量 Visual Console 回归 | `npm run test:visual-console` | 结构层、浏览器层与视觉层一致，无破坏既有语义 |
| 冒烟 | 本地 UI 走查 | `npm run visual-console:web` | 可人工确认 `Overview` 与 `Weekly` 体感走查通过 |

## 验证记录

| 日期 | 项目 | 状态 | 记录 |
| --- | --- | --- | --- |
| 2026-05-13 | 设计文档纠偏 | 已完成 | 已把 `Overview` 表面预算、`Weekly` 全宽 `Core Trend Stage`、`Weak Signal Strip` 后置、体感自检与结构验收写回需求/设计/补充设计文档 |
| 2026-05-13 | ExecPlan 审核约束复核 | 已完成 | 已按 `ExecPlan_ReviewSkill.md` 检查计划必须包含设计映射、允许/禁止修改、验收、负例、验证矩阵和回滚策略 |
| 2026-05-13 | 实施热点定位 | 已完成 | 已确认 `app/server.ts` 中 `Overview` / `Weekly` 渲染结构与 `app/styles.css` 中 `.weekly-story-grid` 相关规则是主纠偏入口 |
| 2026-05-13 | ExecPlan review 预检 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run exec-plan:review:preflight"` 通过 |
| 2026-05-13 | ExecPlan 结构预检 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run exec-plan:preflight"` 通过 |
| 2026-05-13 | CodeImplementation preflight | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run code-implementation:preflight"` 通过 |
| 2026-05-13 | Overview / Weekly 布局实现 | 已完成 | 已在 `app/server.ts` / `app/styles.css` 中完成三阅读区与五段周报布局落地，并把 `Preference / Interests` 移回壳层工具区 |
| 2026-05-13 | Web 结构断言 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run test:visual-console:web"` 通过 |
| 2026-05-13 | 浏览器视觉回归 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run test:visual-console:web:visual"` 通过 |
| 2026-05-13 | 全量 Visual Console 回归 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run test:visual-console"` 通过 |
| 2026-05-13 | 浏览器层类型检查 | 已完成 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run typecheck"` 通过 |
| 2026-05-13 | 仓库级质量门禁 | 阻塞 | `wsl bash -lc "cd /home/adduser/AgentProjection/agent-trend-radar && npm run lint"` 失败；quality gate 报告的 protected debt 位于未改动的既有热点文件 `src/action/weeklyEnhancement.ts`、`src/visualConsole/build.ts`、`src/visualConsole/weeklyMarkdown.ts`，不属于本次允许修改范围 |

## 回滚策略

1. 若 `Overview` 三阅读区改造导致壳层、导航或详情路径回归，优先回滚 `Overview` 局部模板结构，不回滚全局壳层、URL 契约与详情独立滚动基线。
2. 若 `Weekly` 全宽核心趋势改造导致矩阵、详情钻取或无稳定趋势周降级失效，优先回滚 `Weekly` 新排版结构，保留既有只读数据消费路径。
3. 若响应式收口导致小屏阅读路径混乱，优先回滚断点样式，不回滚桌面端全宽主趋势结构。
4. 若视觉测试无法稳定证明“核心趋势不再半屏”，优先加强结构断言与人工走查说明，不通过放宽截图门槛宣布完成。

## 当前残余风险

- `npm run lint` 当前仍会因为仓库既有 quality gate 债务失败；若后续要求本计划在仓库级门禁上全绿，需要为 `src/action/weeklyEnhancement.ts`、`src/visualConsole/build.ts`、`src/visualConsole/weeklyMarkdown.ts` 的存量热点单开治理计划。
- `Weekly` 首轮实现固定采用“纵向全宽堆叠”方案，后续如果产品要引入交互式趋势切换器，应另开 follow-up plan，而不是在本轮内偷偷扩 scope。
- 浏览器视觉回归仍依赖本地浏览器环境；如果断点与截图稳定性不足，需要补结构断言兜底，而不是弱化设计目标。

## 结论记录

- 2026-05-13：这次 follow-up 的核心不是“继续美化”，而是把最新设计中已经冻结的布局主从关系落实为可执行的代码与测试约束。
- 2026-05-13：本计划未引入新的页面行为、趋势语义或 payload 需求，所有改动都限定在浏览器只读承载层、样式层与测试层，符合当前设计和 `ExecPlan_ReviewSkill.md` 的边界要求。
- 2026-05-13：`Overview` 三阅读区、`Weekly` 五段周报与“无稳定趋势周”降级都已落地并通过结构/视觉/全量 Visual Console 回归；当前唯一未通过项是仓库既有 quality gate 债务导致的 `npm run lint` 阻塞。

## 下一阶段入口

1. 如需把本计划从 `Blocked` 推进到完全收口，先为仓库级 quality gate 存量债务单开治理计划，明确是否允许触达 `src/action/weeklyEnhancement.ts`、`src/visualConsole/build.ts`、`src/visualConsole/weeklyMarkdown.ts`。
2. 若后续只继续 UI follow-up，不应在本计划内引入交互式趋势切换器、payload 扩展或额外前端补算。
3. 若继续承接新的布局 follow-up，必须在本计划基础上先同步 `README` 状态，再新增新的 exec-plan 或补充记录。
