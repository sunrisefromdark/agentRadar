# 执行计划：Trend Radar Visual Console

## 文档状态

- 版本：`v0.2`
- 当前状态：`Reopened for Web Upgrade`
- 设计来源：
  - `docs/specs/product-specs/trend-radar-visual-console-requirement-analysis.md`
  - `docs/specs/design-docs/trend-radar-visual-console-design.md`
  - `docs/specs/product-specs/agent-trend-radar-product-spec.md`
  - `docs/specs/system-spec.md`
  - `docs/specs/services/action-output.md`
  - `docs/specs/design-docs/agent-enhancement-layer-and-weekly-trend-design.md`
- 说明：`v0.1` 已完成 CLI 形态的只读消费层基线，但当前交付形态对真实用户不够友好；`v0.2` 将在不新增新的产品语义、业务判断口径或第二真相源的前提下，把最终用户入口升级为浏览器本地网页，并把 CLI 保留为开发/排障基线。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Trend Radar Visual Console |
| 负责人 | Codex |
| 风险等级 | `High` |
| 关联需求 | `docs/specs/product-specs/trend-radar-visual-console-requirement-analysis.md` |
| 关联设计 | `docs/specs/design-docs/trend-radar-visual-console-design.md` |
| 影响范围 | 控制台只读读取层、浏览器前端容器、本地只读 Web 入口、上下文/状态映射、Overview / Projects / Weekly / Run Health / Knowledge Base 视图、跨视图钻取、启动脚本、测试与文档索引 |

## 目标

在不改动现有 CLI 主链路、artifact 契约和业务判断所有权的前提下，完成以下交付：

1. 提供一个 **local-first、artifact-first、read-first** 的浏览器版 Visual Console，作为最终用户默认入口；CLI `visual-console` 保留为开发/排障基线，而不再是主要消费界面。
2. 落地一个最小但明确的网页信息架构：顶层导航、上下文栏、状态/可信度 Banner、主内容区、项目/KB 详情承载区，避免“只是把 CLI 文本搬进浏览器”。
3. 落地设计中冻结的统一 `ViewContext`、顶层状态模型、状态优先级和错误映射，确保 `latest`、历史日期、weekly 时间窗的消费语义一致。
4. 把设计规定的三类核心对象 `Run Snapshot / Weekly Snapshot / Project / KB Object` 变成跨视图共享的只读消费模型，避免不同页面各自解释 artifact。
5. 按设计实现 5 个一级视图：`Overview`、`Projects`、`Weekly`、`Run Health`、`Knowledge Base`，并严格遵守各视图的输入、模块和边界。
6. 落地项目详情、weekly supporting projects、Overview -> Run Health、项目 -> KB 等连续钻取路径，并保持日期 / 时间窗 / trend_key 等上下文不丢失。
7. 提供明确、可重复的本地启动方式与可访问地址：
   - 根命令别名固定为 `npm run visual-console:web`
   - 底层前端容器可放在 `app/`，例如 `npm --prefix ./app run dev`
   - 默认优先使用 `http://localhost:3210/`
   - 若端口被占用，必须显式打印实际监听地址，不能让用户猜测
8. 显式展示 `enhancement_status`、`rules-only / agent-partial / agent-full`、source failure / empty / fallback、GitHub enrichment 状态与 artifact 时间戳，承接现有审计透明字段。
9. 用单元、集成、结构守护、浏览器冒烟和启动输出校验证明控制台不重算业务结论，且失败 / 降级 / 空态 / 无趋势周等关键路径可验证。

## 边界约束

### 允许修改

- `src/storage/files.ts`
- `src/types.ts`
- `src/date.ts`
- `src/cli.ts`
- `src/__tests__/*`
- `scripts/*`
- `package.json`
- `tsconfig.json`
- `app/*`
- 新增控制台只读模块与测试模块，限定在 `src/` 下的控制台实现切片中
- `docs/specs/exec-plans/*`

### 禁止修改

- 不改动 `src/filter/*`、`src/signal/*`、`src/normalize.ts` 中任何会改变 signal、scoring、freshness、weekly 趋势升级或风险判断语义的实现。
- 不新增数据库、服务端主真相源、实时 websocket dashboard 或在线写回链路。
- 不把浏览器版实现退化为“打开网页后展示一整屏 CLI 原始文本”；网页必须提供基础导航、分区、状态提示和可点击钻取。
- 不新增独立“趋势详情”一级对象、额外一级视图或多用户协作能力。
- 不在控制台里重算 `ScoreBreakdown`、`freshness_state`、weekly 核心趋势归类、risk flags、客观排序或 verify 口径。
- 不把 `scores/*.json` 或 daily 结构结果扩张成 weekly 新趋势，也不把未进入当次 daily 消费范围的项目扩进 Projects 视图。
- 不修改 `daily.json`、`run-summary.json`、`weekly.md`、`weekly.audit.json`、`kb`、GitHub enrichment 审计的既有字段含义。
- 不隐藏或弱化 `rules-only`、fallback、source empty / failed、weekly audit 缺失等审计信息。
- 不把实现期的技术选型反推成新的产品设计结论；若需要改设计边界，必须回到 design review。

### 兼容性约束

- 现有 `run-daily`、`run-weekly`、`verify-daily`、`build-kb` 命令名保持不变。
- 现有 `visual-console` CLI 入口保留，但降级为开发/排障基线，不再视为最终用户主入口。
- 现有 `data/reports/`、`data/scores/`、`data/kb/`、`data/raw/github/` 的主 artifact 路径保持不变。
- 控制台若需要极薄读取层，只能做 stable path lookup、解析和错误映射，不得承担业务重算责任。
- `VerifyDailyResult` 只能复用既有结构或其等价持久化版本，不能发明新的 verify schema。
- 同一日期 / 时间窗下，CLI 与控制台对核心状态和核心结论的解释必须一致。
- 浏览器版本地启动后，必须输出明确的 `Local` 访问地址；默认端口建议固定为 `3210`，若冲突则要显式展示实际端口。

## 当前状态

当前仓库已具备控制台所依赖的 artifact 和消费基础，但现状仍停留在“CLI 可用、网页入口缺失”：

- daily、run summary、weekly、weekly audit、KB、GitHub enrichment audit 已能稳定写盘。
- `enhancement_status`、`rules-only / agent-partial / agent-full`、weekly supporting projects、risk / trust / persistence 等关键消费字段已在产物侧存在。
- 已新增 `visual-console` CLI 入口，可按 `Overview / Projects / Weekly / Run Health / Knowledge Base` 视图消费现有 artifact，适合作为语义基线与排障工具。
- 已补齐读取层、视图上下文、状态模型、跨视图对象模型、失败降级映射和钻取契约，并用结构守护锁定“不重算业务结论”边界。
- 浏览器版入口、导航结构、页面分区、启动命令、URL 输出协议和端口冲突策略尚未落地，这部分是 `v0.2` 的新增交付。

## 2026-05-03 Web UX 增补范围

本轮在既有 `v0.2` 浏览器实现之上追加两个受控改进，仍然不改变 artifact-first 边界，不引入新的业务判断链路：

1. 双语界面
   - 页面右上角新增语言选择器。
   - URL 级上下文新增 `lang=<zh|en>`，刷新后必须恢复。
   - 中文界面使用统一中文 UI 文案；英文界面使用统一英文 UI 文案，避免导航、Banner、模块标题与操作按钮中英混杂。
   - 语言切换只作用于浏览器承载层文案与可安全映射的展示字段，不得改写底层 artifact。
2. Overview 卡片信息密度与详情交互
   - `Top Decisions` 卡片必须同时展示“项目介绍”和“入选原因”，不允许只展示其中之一。
   - 项目介绍优先复用 daily artifact 中已有的 `project_brief_cn` / 项目 description，不新增重算字段。
   - 点击项目进入 `Detail Surface` 时，必须保留当前阅读滚动位置，避免回到页面顶部导致浏览中断。
   - 关闭详情时同样应保持同页上下文与阅读位置，只移除叶子参数。

## 当前进度

- 需求分析：`Done`
- 设计编写：`Done（含 Web Addendum）`
- 设计评审：`Pending`
- ExecPlan 编写：`Done`
- CLI 基线实施：`Done`
- 浏览器网页实施：`Done`
- 验证：`Done`

## 2026-05-03 范围修订：升级为浏览器网页

### 变更原因

- 当前 CLI 版 `visual-console` 已证明 artifact-first 的消费语义成立，但对非开发者或日常消费用户不够友好。
- 设计文档冻结了消费边界、状态模型和视图语义，但没有把最终承载形态细化到“浏览器网页的导航、布局、启动约定和本地访问方式”。
- 因此本次修订不推翻 `v0.1` 的语义层实现，而是在其之上补一层浏览器承载方案，并把 CLI 明确收敛为基线工具。

### 修订后的交付定义

1. 交付物从“CLI 渲染的可视化控制台”升级为“浏览器本地网页控制台 + CLI 基线工具”。
2. 页面仍然只读、本地优先、artifact-first；不引入数据库、在线写回或新的业务判断链路。
3. CLI `visual-console` 保留，用于：
   - 对照浏览器渲染语义
   - 无浏览器时的排障
   - 结构守护与测试 fixture 基线

### 设计依赖与冻结来源

本计划不再自行冻结新的前端产品/交互决策；浏览器承载相关规则统一以 [trend-radar-visual-console-design.md](../design-docs/trend-radar-visual-console-design.md#L868) 中的 Web addendum 为准，具体包括：

- 页面承载骨架：`17.1 页面承载骨架`
- 详情承载区契约：`17.2 详情承载区契约`
- 路由与 URL 契约：`17.3 路由与 URL 契约`
- 跨视图钻取 Web 规则：`17.4 跨视图钻取在 Web 中的具体规则`
- `latest` 与刷新恢复：`17.5 latest 入口与刷新恢复`
- 启动与地址输出：`17.6 本地启动与地址输出契约`
- 浏览器级验证：`17.7 浏览器级验证契约`

### v0.2 浏览器实施阶段

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase W0：网页承载设计补丁 | `Done` | 把浏览器承载形态、页面骨架、导航方式、详情承载区和启动约定补充到设计文档 Web addendum | 浏览器信息架构、路由/详情契约、启动协议和浏览器级验证已回收到设计文档冻结 |
| Phase W1：本地 Web 运行时与读取桥接 | `Done` | 落地浏览器前端容器与本地只读读取桥接，复用现有 artifact 语义层 | 网页可读取本地 artifact，且不引入业务重算 |
| Phase W2：Overview / Projects / Run Health 网页化 | `In Progress` | 把日常高频消费路径转成浏览器分区与可点击钻取，并补齐双语 UI 与 Overview 信息密度 | 用户可在网页中完成信任判断、项目浏览和排障跳转，且 UI 文案不再中英混杂 |
| Phase W3：Weekly / Knowledge Base / 详情钻取网页化 | `In Progress` | 落地 weekly、KB、supporting projects 与项目详情连续路径，并修复详情打开/关闭时的阅读滚动体验 | weekly 与 KB 在网页中具备稳定入口和上下文继承，详情打开后不打断当前阅读位置 |
| Phase W4：启动体验、端口策略与浏览器冒烟 | `Done` | 固化启动命令、URL 输出、端口冲突行为与最小冒烟回归 | 启动日志清晰、端口不猜测、浏览器冒烟通过 |

### v0.2 验收补充

- 成功条件：普通用户无需理解 CLI 参数，即可通过浏览器完成 daily / weekly / run health / KB 的主要消费路径。
- 成功条件：网页的视图语义、状态语义和钻取语义与现有 CLI 基线一致。
- 成功条件：启动命令、访问 URL、详情承载形式、路由/上下文恢复行为均与设计文档 Web addendum 一致。
- 失败条件：网页只是 CLI 文本的原样包裹，或任何关键判断语义在网页与 CLI 之间发生漂移。

## v0.1 CLI 实施阶段（已完成，保留为历史基线）

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：边界冻结与承载层对齐 | `Done` | 把控制台实现边界、artifact 所有权、读取层职责和交付切片钉死到计划里 | `src/visualConsole/*` 只依赖现有 artifact、既有 verify 结构与只读解析/渲染逻辑 |
| Phase 1：读取层、上下文与状态模型 | `Done` | 落地 `ViewContext`、读取错误模型、状态优先级与 `latest` 解析逻辑 | `ok / not_found / parse_error / unsupported_context`、`latest` 解析与状态优先级均已落地并有测试覆盖 |
| Phase 2：跨视图对象与路由骨架 | `Done` | 落地 `Run Snapshot / Weekly Snapshot / Project / KB Object` 的只读组装层与 5 个一级视图骨架 | 5 个一级视图均由共享 snapshot / KB / weekly markdown 解析层驱动 |
| Phase 3：Overview / Projects / Project Detail / Run Health | `Done` | 实现日消费、项目判断与排障主链路 | Overview 首屏先展示可信度；Projects / Project Detail / Run Health 已可按上下文钻取 |
| Phase 4：Weekly / Knowledge Base / 跨视图钻取 | `Done` | 实现 weekly 独立消费、无趋势周语义、KB 浏览与关键跳转契约 | Weekly 独立视图、弱信号周语义、项目到 KB 和 weekly 到项目的上下文继承均已落地 |
| Phase 5：验证、回归与收口 | `Done` | 补齐测试矩阵、结构守护、CLI 冒烟与文档索引 | `npm run typecheck`、`npm test -- visualConsole`、`npm run exec-plan:preflight` 与 CLI 冒烟均通过 |

## v0.1 CLI 实施步骤（历史记录）

### Phase 0：边界冻结与承载层对齐

对应设计章节：
- `2. 核心原则`
- `3. 范围与非目标`
- `11. 数据来源与所有权`
- `12. 读取层契约`

1. 把控制台的实现范围锁定为只读消费层，不承接采集、调度、写回、数据库、权限或协作。
2. 明确控制台只允许消费以下主 artifact：
   - `data/reports/YYYY-MM-DD.daily.json`
   - `data/reports/YYYY-MM-DD.run-summary.json`
   - `data/reports/YYYY-MM-DD.weekly.md`
   - `data/reports/YYYY-MM-DD.weekly.audit.json`
   - `data/scores/YYYY-MM-DD.json`
   - `data/kb/latest.json`
   - `data/kb/*.md`
   - `data/raw/github/YYYY-MM-DD.enrichment.json`
   - `data/raw/github/<repo-key>.json`
   - 既有 `VerifyDailyResult`
3. 明确控制台只拥有：
   - 读取
   - 轻量聚合
   - 视图组织
   - 状态映射
   - 上下文与钻取
4. 在实现切片上冻结“控制台专属模块”和“现有业务链路模块”的边界，避免后续实施误改 scoring / signal / weekly 趋势归纳逻辑。
5. 若需要新增控制台入口或脚本，只允许新增读取、渲染、结构守护与本地启动相关能力，不新增服务端产品语义。

### Phase 1：读取层、上下文与状态模型

对应设计章节：
- `4. 系统现状与设计假设`
- `5. 全局上下文模型`
- `8. 状态模型`
- `12. 读取层契约`
- `13. 失败与降级行为`

1. 落地极薄读取层最小接口，与设计保持一一对应：
   - `getDailyReport(date)`
   - `getRunSummary(date)`
   - `getVerifyDailyResult(date)`
   - `getWeeklyReport(windowOrAnchorDate)`
   - `getWeeklyAudit(windowOrAnchorDate)`
   - `getScores(date)`
   - `getKbIndex()`
   - `getKbCard(slug)`
   - `getGithubEnrichmentAudit(date)`
   - `getGithubEnrichment(repoKey)`
2. 读取层返回值必须显式区分：
   - `ok`
   - `not_found`
   - `parse_error`
   - `unsupported_context`
3. 落地统一 `ViewContext`，至少包含：
   - `mode`
   - `selected_date`
   - `selected_window`
   - `entry_kind`
   - `resolved_artifacts`
   - `generated_at`
4. 固定 `latest` 只作为快捷入口：
   - 进入后必须立即解析为具体日期或时间窗
   - 解析失败直接进入 `failed`
   - 不得静默回退到任意旧日期
5. 落地顶层状态模型与优先级：
   - `ready`
   - `degraded`
   - `stale`
   - `failed`
   - `empty`
   - `not-judgeable`
   - 优先级固定为 `failed -> not-judgeable -> stale -> degraded -> empty -> ready`
6. 明确状态触发映射：
   - daily 缺失时 Overview / Projects 为 `failed`
   - daily 缺失时页面显式显示“当前日期 daily 结果不存在”，且不得静默跳到 `latest`
   - run-summary 缺失但 daily 存在时 Overview 为 `degraded`、Run Health 为 `failed`
   - run-summary 缺失但 daily 存在时，用户仍可继续消费项目内容，但必须看到“健康上下文缺失”
   - `stale` 只在用户请求 `latest` 或“当前应有的新鲜结果”但 artifact 实际解析到的日期 / 时间窗不满足该请求时触发；若用户显式打开历史日期 / 历史时间窗，且 artifact 与请求一致，则不得标记为 `stale`
   - weekly markdown 存在但 weekly audit 缺失时 Weekly 至少为 `degraded`
   - weekly markdown 存在但 weekly audit 缺失时，enhancement 状态显式显示“审计上下文缺失”
   - 只有弱信号、没有核心趋势时 Weekly 不强行渲染核心趋势卡片
   - source empty 与 source failed 必须区分
   - `not-judgeable` 只用于“有内容但缺少关键判断证据或关键上下文”的场景，不得与 `empty` 或 `failed` 混用
   - KB 缺失时项目仍可展示，但 KB 入口必须显式显示“KB 未生成 / 不存在”
   - `latest` 解析失败时直接进入 `failed`，并提示“latest 快捷入口无法解析”
7. 保证 daily 上下文和 weekly 上下文不混用，所有跳转都继承当前解析后的日期或时间窗，而不是跳回新的 `latest`。

### Phase 2：跨视图对象与路由骨架

对应设计章节：
- `6. 跨视图对象模型`
- `7. 信息架构`
- `10. 跨视图钻取契约`
- `14. 审计与透明性设计`

1. 为控制台冻结三类共享只读对象：
   - `Run Snapshot`
   - `Weekly Snapshot`
   - `Project / KB Object`
2. `Run Snapshot` 只允许由以下 artifact 组装：
   - `daily.json`
   - `run-summary.json`
   - `VerifyDailyResult`
   - `data/raw/github/YYYY-MM-DD.enrichment.json`
   - 相关 source / audit 信息
3. `Weekly Snapshot` 只允许由以下 artifact 组装：
   - `weekly.md`
   - `weekly.audit.json`
   - weekly artifact 已显式引用的 `scores/*.json` / daily 结构结果
4. `Project / KB Object` 的项目集合边界固定为：
   - daily 只认 `daily.json` 已展示项目
   - weekly 只认 weekly artifact 已显式引用的 supporting projects 或弱信号项目
   - `scores/*.json` 只能补充已引用项目字段，不能扩出新项目集
5. 为 5 个一级视图建立统一路由/入口骨架：
   - `Overview`
   - `Projects`
   - `Weekly`
   - `Run Health`
   - `Knowledge Base`
6. 顶层骨架必须在每个主视图显式展示：
   - 当前日期或时间窗
   - 主 artifact 时间戳
   - `enhancement_status`
   - `rules-only / agent-partial / agent-full`
   - source failure / empty / fallback
   - GitHub enrichment 状态
7. 透明字段只允许承接已有 artifact 事实，不允许前端拼装新的可信度标签或趋势解释。

### Phase 3：Overview / Projects / Project Detail / Run Health

对应设计章节：
- `9.1 Overview 视图`
- `9.2 Projects 视图`
- `9.3 项目详情视图`
- `9.5 Run Health 视图`
- `13. 失败与降级行为`

1. Overview 必须按固定顺序落地：
   - `Context Header`
   - `Run Trust Summary`
   - `Source Health Summary`
   - `Top Decisions`
   - `Risks and Recommended Actions`
   - `Weekly Entry`
2. Overview 首屏必须先回答“这次结果靠不靠谱”，禁止先显示榜单再补可信度。
3. `Context Header` 必须显式显示：
   - 当前日期或 latest 解析后的具体日期
   - 主 artifact `generated_at`
   - 当前运行模式摘要，包括 `rules-only`、enhancement fallback、source 缺失 / 降级
4. `Run Trust Summary` 必须直接展示：
   - run 总体状态
   - verify 结论
   - `overall_daily_status`
   - freshness 摘要
5. `Source Health Summary` 必须直接展示：
   - active / empty / failed / disabled source 数量
   - 明显 source failure / empty
   - GitHub enrichment fallback
6. `Top Decisions` 只允许消费当前 daily 已展示项目，每项至少回显：
   - `score`
   - `confidence`
   - `paradigm`
   - `top evidence`
   - `risk`
   - `persistence`
7. Projects 视图的列表字段最小集合固定为：
   - `project_name`
   - `repo_url`
   - `score`
   - `confidence`
   - `paradigm`
   - `persistence_state`
   - `top_evidence`
   - `risks`
   - `next_actions`
   - `matched_interest_topics`
   - `enhancement_status context`
8. Projects 固定筛选维度固定为：
   - `verdict`: `high / watch / low`
   - `confidence`: `high / medium / low`
   - `persistence`: `single-spike / emerging / persistent`
   - `source pattern`: `single-source / multi-source / watchlist-hit`
   - `risk`: `has-risk / no-risk`
   - 且都只能基于已有 artifact 字段回显，不能推导新标签
9. 项目详情固定模块必须落地：
   - `Project Identity`
   - `Score and Evidence`
   - `Risk and Next Actions`
   - `Persistence and Appearances`
   - `Run / Audit Context`
   - `Knowledge Card Preview`
10. 项目详情不得发明独立于 daily / weekly 的新结论；若从 weekly 趋势进入，必须显式保留所属 `trend_key` 上下文。
11. Run Health 不新增独立 `run-health.json` 或新的 verify artifact；若后续需要持久化 verify 结果，也必须与既有 `VerifyDailyResult` 结构等价。
12. Run Health 固定模块必须落地：
   - `Verify Result Summary`
   - `Source Status Table`
   - `GitHub Enrichment Audit Table`
   - `Failure / Empty / Fallback Notes`
   - `Recommended Actions`
13. Run Health 必须优先展示系统运行语义，而不是项目内容；`source empty`、`source failed`、`API / cache / unavailable / invalid_repo` 必须按现有 audit 语义原样展示。

### Phase 4：Weekly / Knowledge Base / 跨视图钻取

对应设计章节：
- `9.4 Weekly 视图`
- `9.6 Knowledge Base 视图`
- `10. 跨视图钻取契约`
- `13. 失败与降级行为`
- `14. 审计与透明性设计`

1. Weekly 必须作为独立一级视图落地，而不是文件入口或 Overview 附属区块。
2. Weekly 只允许消费：
   - `YYYY-MM-DD.weekly.md`
   - `YYYY-MM-DD.weekly.audit.json`
   - 为钻取映射所需的 `scores/YYYY-MM-DD.json` / daily 结构结果
3. Weekly 固定结构必须落地：
   - `Weekly Context Header`
   - `Weekly Trust Summary`
   - `Overall Weekly Judgment`
   - `Core Trend Cards`
   - `Weak Signals / Watch Next`
   - `Optional Audit Context Blocks`
4. `Weekly Context Header` 必须显式显示：
   - `window_start`
   - `window_end`
   - weekly artifact 生成时间
   - enhancement 状态
   - 是否处于 `rules-only`、`agent-partial`、`agent-full`
5. `Weekly Trust Summary` 必须显式显示：
   - 本周 weekly 是否可用于判断
   - 是否存在 `rules-only`
   - 是否存在 enhancement fallback
   - 是否存在“只有弱信号、尚未形成稳定趋势”
6. Weekly 的总判断、核心趋势、弱信号和是否可判断，必须完全以 `weekly.md` 与 `weekly.audit.json` 为准。
7. Weekly `Core Trend Cards` 每张卡片至少显示：
   - 趋势名称
   - 趋势判断摘要
   - 证据摘要
   - 强度
   - 是否值得下周继续跟踪
   - `1-3` 个 supporting projects
8. 当 weekly 缺乏稳定趋势证据时：
   - 不得强行渲染 `2-4` 条核心趋势卡片
   - 必须显式展示“尚未形成稳定趋势”或等价保守语义
   - 允许仅展示弱信号或待观察方向
9. `Optional Audit Context Blocks` 只能引用已存在的核心趋势、弱信号和 supporting projects；缺失时不影响 V1 最小消费契约成立。
10. Knowledge Base 固定模块必须落地：
   - `KB Index`
   - `Card Reader`
   - `Machine Section`
   - `Human Section`
   - `Linked Context`
11. KB 第一版只读；机器区与人工区必须可视觉区分；KB 缺失时必须显式呈现“缺失”，不能伪装成“没有历史沉淀”。
12. 跨视图钻取契约必须逐条落地：
   - Overview / Projects -> 项目详情：保留当前 daily 日期和项目 identity
   - Weekly 趋势 -> supporting projects：保留当前 weekly 时间窗和 `trend_key`
   - 项目 -> KB：保留来源上下文，并显式呈现 KB 是否存在
   - Overview -> Run Health：保留当前 daily 日期并定位到 verify / source / audit 状态
13. 同一项目在 Overview、Projects、Weekly supporting project、Project Detail 中的核心结论必须保持一致：
   - `score`
   - `confidence`
   - `paradigm`
   - `persistence`
   - 已有风险

### Phase 5：验证、回归与收口

对应设计章节：
- `15. 测试设计`
- `17. 实现就绪结论`

1. 补齐控制台读取层、状态映射、5 个一级视图、项目详情、KB、钻取上下文与关键失败路径的单元和集成测试。
2. 补齐“UI 不重算业务结论”的结构守护，证明控制台没有重写 scoring / freshness / weekly judgment 口径。
3. 为 `latest`、历史日期 / 时间窗、weekly audit 缺失、无趋势周、source empty / failed、KB 缺失等路径补齐回归测试。
4. 同步更新 exec-plan 索引、验证记录和阶段状态；只有在 preflight 与结构守护通过后，才允许进入代码实施。
5. 若验证发现需要改产品语义或设计边界，停止实施并回到 design review，不在实现期私自扩边界。
6. 验证设计章节 `15.1 / 15.2 / 15.3 / 15.4` 的测试要求都已映射到可执行检查，不允许只保留笼统的“补测试”描述。

## 已落地内容

- `daily / weekly / run-summary / weekly.audit / KB / GitHub enrichment` 的 artifact 产物已稳定存在，可作为控制台唯一事实来源。
- daily / weekly 已具备 `enhancement_status`、`rules-only / agent-partial / agent-full`、supporting projects、risk / trust / persistence 等关键消费字段。
- `run-daily`、`run-weekly`、`verify-daily`、`build-kb` 等 CLI 主链路和产物路径已经冻结，可作为控制台只读消费底座。

## 踩坑记录

- 控制台最容易失控的地方不是渲染，而是“顺手在读取层或 view-model 层重新推导业务结论”。后续实施时必须先守住 artifact 所有权，再谈页面组装和交互。

## 验收标准

### 验收 1：控制台仍是 artifact-first 消费层

- 可观测结果：同一日期 / 时间窗下，控制台与 CLI 的核心结论一致。
- 成功条件：控制台只消费既有 artifact，并做轻量聚合、状态映射和钻取，不重算 scoring / freshness / weekly judgment / risk flags / verify 语义。
- 失败条件：控制台生成新的业务事实、隐藏事实来源或与 artifact 语义漂移。

### 验收 2：上下文与 latest 语义显式且可追

- 可观测结果：所有主视图都显式展示解析后的日期或时间窗，以及主 artifact 时间戳。
- 成功条件：`latest` 只作为快捷入口；进入后必须解析为具体日期 / 时间窗；解析失败进入 `failed`，绝不静默回退。
- 失败条件：用户看见的仍是模糊的“latest”，或历史日期 / weekly 时间窗被混读。

### 验收 3：状态模型与失败降级语义冻结

- 可观测结果：`ready / degraded / stale / failed / empty / not-judgeable` 都可被测试和用户界面直接观察。
- 成功条件：状态优先级、触发边界、source empty / failed 区分、weekly audit 缺失、无趋势周等都按设计落地。
- 失败条件：空态、坏态、旧态、降级态被混成一种“看起来正常”的结果。

### 验收 4：Overview 首屏先回答“能不能信”

- 可观测结果：Overview 首屏先展示 `Run Trust Summary` 与 `Source Health Summary`，再展示项目和动作建议。
- 成功条件：用户无需先看榜单，就能判断 run 状态、verify 结论、freshness 和 source 风险。
- 失败条件：Overview 退化成排行榜或资讯流，可信度信息被放到二级区块。

### 验收 5：Projects 与项目详情是“结论优先、证据可追”

- 可观测结果：Projects 列表和项目详情都能直接看到 `score / confidence / paradigm / evidence / risk / persistence / next actions`，并能继续追到上下文与 KB。
- 成功条件：Projects 只展示当次 daily 已展示项目；项目详情不发明新结论；从 weekly 进入时保留趋势上下文。
- 失败条件：Projects 扩入未展示项目，或项目详情脱离 daily / weekly 口径单独解释。

### 验收 6：Weekly 是独立消费对象，不是文件入口

- 可观测结果：Weekly 视图可独立展示本周总判断、核心趋势、弱信号、supporting projects 与可选 audit 区块。
- 成功条件：总判断、核心趋势、弱信号完全以 `weekly.md` 和 `weekly.audit.json` 为准；钻取映射只做 supporting project 展示和证据回链。
- 失败条件：weekly 仍退化成 Markdown 文件查看器，或控制台二次归纳新趋势。

### 验收 7：无趋势周 / 弱信号周语义真实可见

- 可观测结果：当 weekly 缺乏稳定趋势时，页面明确显示“尚未形成稳定趋势”，且允许只展示弱信号区。
- 成功条件：不为凑结构强行渲染核心趋势卡片；状态按 `not-judgeable` 或 `degraded` 的设计边界呈现。
- 失败条件：把单日热度或证据不足内容伪装成稳定周趋势。

### 验收 8：Run Health 是排障工作台，不是项目内容页

- 可观测结果：Run Health 可以统一查看 verify 结果、source 状态、GitHub enrichment 审计、fallback 与 recommended actions。
- 成功条件：source empty / failed 分开；API / cache / unavailable / invalid_repo 按既有 audit 语义原样展示。
- 失败条件：系统运行语义被项目内容淹没，或 audit 被控制台重解释。

### 验收 9：KB / review 连续入口成立

- 可观测结果：用户可以从项目 / 趋势进入 KB，浏览 `KB Index`、卡片内容、机器区和人工区。
- 成功条件：KB 缺失时明确显示缺失状态；机器区和人工区可区分；来源上下文能保留。
- 失败条件：KB 入口断裂，或把“缺失”误表达成“没有沉淀”。

### 验收 10：跨视图语义一致且可钻取

- 可观测结果：同一项目在 Overview、Projects、Weekly supporting project、Project Detail 中的核心结论一致。
- 成功条件：各视图只允许省略字段，不允许改写 `score / confidence / paradigm / persistence / risks` 含义；所有关键跳转都继承上下文。
- 失败条件：不同视图对同一对象给出冲突结论，或跳转后丢失日期 / 时间窗 / trend_key。

## 当前残余风险

- 仓库目前以 CLI 和 artifact 产出为中心，控制台承载层若边界不清，最容易把读取适配层演变成新的业务拼装层。
- Weekly 视图既要承接现有 weekly artifact，又要支持钻取 supporting projects；若实现偷懒，很容易越界到“根据 scores 重新归纳趋势”。
- 状态模型是本计划的高风险点；如果优先级和失败映射没有统一收口，不同页面会各自定义 `degraded / failed / empty`。
- 浏览器版虽然已有设计补丁，但若 URL / query / refresh restore 没有严格按设计落地，很容易出现“页面能跳，但上下文丢了”的问题。
- 浏览器级验证若继续停留在 CLI 语义层测试，最容易漏掉 Banner 排序、详情承载和 KB 缺失等真实用户体验回归。

## 设计测试映射

- 需求验收 1 对应 `Overview` 首屏结构测试与首页状态优先级测试。
- 需求验收 2 对应 `Projects` 列表字段完整性测试与项目详情证据追溯测试。
- 需求验收 3 对应 `Run Health source / verify / audit` 聚合测试。
- 需求验收 4 / 5 对应 `Weekly` 独立入口测试与无趋势周 / 弱信号周渲染测试。
- 需求验收 6 对应项目 -> KB 路径测试与机器区 / 人工区可见性测试。
- 需求验收 7 对应 `latest` 解析与日期 / 时间窗显示测试。
- 需求验收 8 对应 UI 不重算业务结论的结构测试。
- 需求验收 9 对应 `empty / failed / stale / degraded / not-judgeable` 状态测试。
- 需求验收 10 对应 `rules-only / agent-partial / agent-full` 可见性测试。
- 需求验收 11 对应跨视图一致性与钻取上下文测试。

## 验证矩阵

| 类型 | 验证内容 | 命令 / 方法 | 通过标准 |
| --- | --- | --- | --- |
| 静态 | 类型与只读契约对齐 | `pnpm typecheck` | 控制台上下文、状态、读取结果、共享对象类型通过 |
| 结构 | exec-plan / spec 结构守护 | `pnpm test -- specStructure` | 新计划与索引通过结构测试 |
| 结构 | UI 不重算业务结论 | `pnpm test -- visualConsole structureGuards` | 不引入 UI 侧 scoring / freshness / weekly judgment / verify recompute |
| 单元 | 读取层错误映射 | `pnpm test -- visualConsole readLayer` | `ok / not_found / parse_error / unsupported_context` 映射正确 |
| 单元 | `latest` 解析与上下文绑定 | `pnpm test -- visualConsole viewContext` | `latest` 解析后绑定具体日期 / 时间窗；失败时进入 `failed` |
| 单元 | 顶层状态优先级 | `pnpm test -- visualConsole statusModel` | `failed -> not-judgeable -> stale -> degraded -> empty -> ready` 固定成立 |
| 单元 | 状态显式展示语义 | `pnpm test -- visualConsole statusModel` | daily 缺失显示“当前日期 daily 结果不存在”；`latest` 解析失败显示“latest 快捷入口无法解析”；weekly audit 缺失显示“审计上下文缺失” |
| 单元 | Overview 首屏结构 | `pnpm test -- visualConsole overview` | 信任判断先于榜单展示 |
| 单元 | Projects 字段与筛选边界 | `pnpm test -- visualConsole projects` | 只展示 daily 已展示项目，筛选只基于已有 artifact 字段 |
| 单元 | 项目详情证据追溯与上下文继承 | `pnpm test -- visualConsole projectDetail` | 证据可追溯；从 weekly 进入时保留 `trend_key` 提示 |
| 单元 | Weekly 固定结构与无趋势周 | `pnpm test -- visualConsole weekly` | 仅弱信号时不伪造核心趋势卡片 |
| 单元 | Run Health source / verify / audit 聚合 | `pnpm test -- visualConsole runHealth` | source empty、failed、fallback、verify 与 audit 聚合显示正确 |
| 单元 | KB 缺失与机器区 / 人工区呈现 | `pnpm test -- visualConsole kb` | KB 缺失显式可见，机器区 / 人工区可区分 |
| 单元 | 透明字段可见性 | `pnpm test -- visualConsole transparency` | `rules-only / agent-partial / agent-full`、source failure / empty / fallback、GitHub enrichment 状态可见 |
| 单元 | 跨视图一致性 | `pnpm test -- visualConsole drilldown` | 同一项目核心字段在多视图保持一致 |
| 集成 | daily + run-summary 正常链路 | `pnpm test -- cliWorkflow visualConsole` | Overview 可完成首屏信任判断并进入 Projects / Run Health |
| 集成 | daily 存在但 run-summary 缺失 | `pnpm test -- cliWorkflow visualConsole` | Overview 为 `degraded`，Run Health 为 `failed`，且用户能看到“健康上下文缺失” |
| 集成 | weekly 正常链路 | `pnpm test -- cliWorkflow visualConsole` | Weekly 展示总判断、核心趋势、弱信号、supporting projects |
| 集成 | weekly audit 缺失链路 | `pnpm test -- cliWorkflow visualConsole` | Weekly 仍可读正文，但状态至少为 `degraded`，且 enhancement 状态显示“审计上下文缺失” |
| 集成 | 项目 -> KB / Weekly -> 项目详情 | `pnpm test -- cliWorkflow visualConsole` | 钻取时日期 / 时间窗 / trend_key 不丢失；从项目进入 KB 时，KB 缺失与存在行为正确 |
| 浏览器 | 一级导航与 URL 恢复 | `npm run test:visual-console:web -- navigation` | 5 个一级路由可直接访问；刷新后保留 `date / anchor / project / trend_key / slug` |
| 浏览器 | Overview 首屏顺序与状态 Banner | `npm run test:visual-console:web -- overview` | `Context Bar`/Banner/`Run Trust Summary`/`Source Health Summary` 先于 `Top Decisions`；`failed / degraded / stale / empty / not-judgeable` 显式可见 |
| 浏览器 | Weekly -> Project Detail 上下文继承 | `npm run test:visual-console:web -- drilldown` | 点击 supporting project 后 URL 保留 `anchor + trend_key + project` |
| 浏览器 | Project -> KB 缺失态与返回行为 | `npm run test:visual-console:web -- kb` | KB 缺失显式显示；浏览器返回恢复原 `source_view` 与日期/时间窗上下文 |
| 浏览器 | 启动输出与端口冲突 | `npm run test:visual-console:web -- startup` | 启动日志打印 `Local` URL；端口冲突时打印最终实际 URL |
| 回归 | UI 不重算业务结论 | 结构守护 + 对照 fixture | 控制台展示与 artifact 核心事实一致 |
| 回归 | `rules-only` 与降级可消费 | `pnpm test -- visualConsole regression` | `rules-only` 模式仍可完整消费，且状态至少为 `degraded` |
| 回归 | `weekly.audit.json` 缺失正文可读 | `pnpm test -- visualConsole regression` | `weekly.audit.json` 缺失时仍可读正文，但必须降级 |
| 计划 | ExecPlan 预检 | `npm run exec-plan:preflight` | 计划文件和索引通过预检 |

## 验证记录

| 时间 | 事实 | 结果 | 说明 |
| --- | --- | --- | --- |
| 2026-05-02 | 需求文档与设计文档对齐复核 | 已完成 | 已确认 ExecPlan 必须完全对齐 `trend-radar-visual-console-design.md`，不得新增新的 UI 产品语义 |
| 2026-05-02 | 现有仓库结构与 artifact 基线审阅 | 已完成 | 已确认仓库已有稳定 artifact 与 CLI 主链路，但尚无完成态的 Visual Console 消费层 |
| 2026-05-02 | 现有 exec-plan 模板、索引规则与计划骨架复核 | 已完成 | 已确认新计划必须包含目标、边界、验收、验证矩阵、回滚和下一阶段入口 |
| 2026-05-02 | Visual Console 代码实现完成 | 已完成 | 已新增 `src/visualConsole/*`、`visual-console` CLI 入口、5 个只读视图、weekly markdown / KB markdown 解析与上下文钻取 |
| 2026-05-02 | 类型、结构守护与计划 preflight 验证 | 已完成 | `npm run typecheck`、`npm test -- visualConsole`、`npm run exec-plan:preflight` 全部通过 |
| 2026-05-02 | CLI 冒烟验证 | 已完成 | `npm run visual-console -- --view overview --date 2026-05-01` 已可输出可信度优先的 Overview 视图 |
| 2026-05-02 | Visual Console verify 消费链路复核与整改 | 已完成 | 已将控制台从“调用 `buildVerifyDailyResult` 现算”修正为“只读取 `verify-daily` 等价持久化结果”，并补充 `verify-daily.json` 写盘与回归测试 |
| 2026-05-03 | Web upgrade review 修复 | 已完成 | 已把页面骨架、详情承载、URL / query、刷新恢复、启动协议与浏览器级验证补回设计文档 Web addendum；ExecPlan 改为引用设计冻结结果并补齐浏览器验证矩阵 |
| 2026-05-03 | 详情面板固定侧栏体验修复 | 已完成 | 已把宽屏详情承载从随文档流 `sticky` 调整为右侧固定面板，打开详情后无需回到页面顶部才能看到内容 |

## ExecPlan Progress Update

- Task: Phase 0：边界冻结与承载层对齐
- Status: DONE
- Files Changed: `src/visualConsole/readLayer.ts`、`src/visualConsole/context.ts`、`src/visualConsole/index.ts`、`src/cli.ts`
- Verification: `npm run typecheck`；`npm test -- visualConsole`
- Result: 控制台入口、读取层、`latest` 解析与只读边界已落地，结构守护确认未导入 `filter / signal / normalize` 主链路

- Task: Phase 1：读取层、上下文与状态模型
- Status: DONE
- Files Changed: `src/visualConsole/readLayer.ts`、`src/visualConsole/context.ts`、`src/visualConsole/status.ts`、`src/visualConsole/types.ts`
- Verification: `npm run typecheck`；`npm test -- visualConsole`
- Result: `ok / not_found / parse_error / unsupported_context`、`ViewContext`、固定状态优先级已落地并通过测试

- Task: Phase 2：跨视图对象与路由骨架
- Status: DONE
- Files Changed: `src/visualConsole/build.ts`、`src/visualConsole/index.ts`、`src/visualConsole/types.ts`
- Verification: `npm run typecheck`；`npm test -- visualConsole`
- Result: `Run Snapshot / Weekly Snapshot / Project / KB Object` 已进入共享只读组装层，5 个一级视图由统一入口分发

- Task: Phase 3：Overview / Projects / Project Detail / Run Health
- Status: DONE
- Files Changed: `src/visualConsole/build.ts`、`src/visualConsole/render.ts`、`src/cli.ts`、`src/__tests__/visualConsole.test.ts`
- Verification: `npm test -- visualConsole`；`npm run visual-console -- --view overview --date 2026-05-01`
- Result: Overview 首屏先展示可信度；Projects / Project Detail 保留 `date / trend_key`；Run Health 显式展示 verify / source / audit 状态

- Task: Phase 4：Weekly / Knowledge Base / 跨视图钻取
- Status: DONE
- Files Changed: `src/visualConsole/weeklyMarkdown.ts`、`src/visualConsole/kbMarkdown.ts`、`src/visualConsole/build.ts`、`src/visualConsole/render.ts`、`src/__tests__/visualConsole.test.ts`
- Verification: `npm test -- visualConsole`
- Result: Weekly 以 `weekly.md` + `weekly.audit.json` 为准；弱信号周进入 `not-judgeable`；项目到 KB、weekly 到项目的上下文继承已测试覆盖

- Task: Phase 5：验证、回归与收口
- Status: DONE
- Files Changed: `src/__tests__/visualConsole.test.ts`、`package.json`、`docs/specs/exec-plans/trend-radar-visual-console-v0.1.exec-plan.md`
- Verification: `npm run typecheck`；`npm test -- visualConsole`；`npm run exec-plan:preflight`
- Result: 类型检查、测试矩阵、计划 preflight 与 CLI 冒烟全部通过，执行计划账本已同步

- Task: Phase W1：本地 Web 运行时与读取桥接
- Status: DONE
- Files Changed: `app/server.ts`、`app/styles.css`、`package.json`、`tsconfig.json`
- Verification: `npm run typecheck`；`npm run visual-console:web`
- Result: 已落地浏览器本地 Web 入口，直接复用 `src/visualConsole/build.ts` 只读语义层进行服务端渲染，未引入新的业务重算、数据库或写回链路

- Task: Phase W2：Overview / Projects / Run Health 网页化
- Status: DONE
- Files Changed: `app/server.ts`、`app/styles.css`
- Verification: `npm run test:visual-console:web`
- Result: 已实现 `App Header`、`Context Bar`、`Global Status Banner` 与主内容分区；Overview 首屏保持 `Run Trust Summary -> Source Health Summary -> Top Decisions` 顺序，Projects / Run Health 已具备 URL 驱动的网页入口

- Task: Phase W3：Weekly / Knowledge Base / 详情钻取网页化
- Status: DONE
- Files Changed: `app/server.ts`、`app/styles.css`、`src/__tests__/visualConsoleWeb.test.ts`
- Verification: `npm run test:visual-console:web`
- Result: 已实现 Weekly、KB 与同页详情面板；weekly -> project detail 保留 `anchor + trend_key`，project -> kb 保留来源上下文，KB 缺失态显式可见；宽屏下详情面板固定在右侧可视区，不再因为页面滚动而回到顶部寻找详情

- Task: Phase W4：启动体验、端口策略与浏览器冒烟
- Status: DONE
- Files Changed: `app/server.ts`、`src/__tests__/visualConsoleWeb.test.ts`
- Verification: `npm run test:visual-console:web`；`npm run exec-plan:preflight`；`timeout 5s npm run visual-console:web`
- Result: 根命令固定为 `npm run visual-console:web`，默认输出 `Local: http://localhost:3210/`；端口冲突时自动切换并显式打印最终 URL；浏览器级路由、状态 Banner、钻取和启动协议验证均已覆盖

## 回滚策略

- 若控制台读取层实现不稳定，允许先回退到“只提供最小读取与错误映射”，但不得把失败路径伪装成成功读取。
- 若某个视图在落地中越界到业务重算，必须回退该视图到只读 artifact 展示，而不是让错误口径继续进入 UI。
- 若 Weekly 钻取映射实现不稳定，允许暂时只保留趋势 -> supporting projects 的只读显示，不允许回退成根据 scores 重算趋势。
- 若 KB 连续入口未达标，允许先保留项目详情中的显式 KB 存在性提示，但不得隐藏“KB 缺失”事实。

## 结论记录

- 2026-05-02：本计划承接 `trend-radar-visual-console-design.md` 的冻结结论，控制台必须先是“可信度与审计入口”，再是“榜单或趋势消费页”。
- 2026-05-02：控制台实施的核心不是“做一个页面”，而是把 `ViewContext`、状态模型、共享消费对象和跨视图契约收成同一套只读语义层。
- 2026-05-02：Weekly 必须作为独立一级视图落地，且无趋势周 / 弱信号周必须保留真实语义，不能在 UI 中二次包装。
- 2026-05-02：读取层、状态映射和钻取契约必须先行冻结，否则后续任何页面都可能重新解释 artifact，破坏 artifact-first 原则。
- 2026-05-02：本轮实现选择通过 `visual-console` CLI 承载只读消费层，不引入新的服务端或前端运行时，也不改变既有 CLI 主链路。
- 2026-05-03：确认 CLI 形态虽然满足语义验证，但不满足最终用户体验预期；后续交付改为浏览器本地网页，CLI 收敛为语义基线与排障工具。
- 2026-05-03：浏览器版所需的页面骨架、详情承载、路由/URL、刷新恢复和启动协议已回收到设计文档 Web addendum；ExecPlan 后续只负责引用并执行，不再越界代替设计冻结交互决策。

## 下一阶段入口

- 浏览器版实现阶段已完成，后续若继续迭代，仍需严格按设计文档 Web addendum 保持页面骨架、详情承载、路由/URL 和启动协议不漂移。
- 保留现有 CLI 作为对照基线；后续若出现页面语义漂移，必须先回看 CLI 输出与 artifact。
- 若 weekly markdown / KB markdown 渲染格式发生变化，需同步补充 `src/visualConsole/weeklyMarkdown.ts` 与 `src/visualConsole/kbMarkdown.ts` 的解析守护测试。
## 2026-05-03 Implementation Trace

- Task: Align Visual Console implementation and tests with `docs/specs/reviews/trend-radar-visual-console-v0.1.testing-review.md`
- Status: DONE
- Files Changed:
  - `src/visualConsole/render.ts`
  - `src/visualConsole/index.ts`
  - `src/cli.ts`
  - `src/__tests__/visualConsole.test.ts`
  - `src/__tests__/cliWorkflow.test.ts`
- Verification:
  - `wsl bash -lc './node_modules/.bin/vitest run visualConsole'`
  - `wsl bash -lc './node_modules/.bin/vitest run cliWorkflow visualConsole'`
  - `wsl bash -lc 'npm run typecheck'`
- Result:
  - Visual Console weekly rendering now exposes the testing-review-required trust/judgment/audit structure.
  - CLI accepts `kb` as a Knowledge Base alias.
  - Visual Console and CLI workflow coverage now includes read-layer states, stale/latest handling, weekly/core-trend rendering, KB sections, artifact allow-list checks, and CLI smoke/drilldown paths.

## 2026-05-03 Web Implementation Trace

- Task: Implement the browser-hosted Visual Console defined by `docs/specs/exec-plans/trend-radar-visual-console-v0.1.exec-plan.md`
- Status: DONE
- Files Changed:
  - `app/server.ts`
  - `app/styles.css`
  - `package.json`
  - `tsconfig.json`
  - `src/__tests__/visualConsoleWeb.test.ts`
- Verification:
  - `wsl bash -lc 'npm run typecheck'`
  - `wsl bash -lc 'npm run test:visual-console:web'`
  - `wsl bash -lc 'npm run exec-plan:preflight'`
  - `wsl bash -lc 'timeout 5s npm run visual-console:web'`
- Result:
  - Added a local-first browser entrypoint at `npm run visual-console:web` with default `http://localhost:3210/` startup output.
  - Implemented server-rendered `Overview / Projects / Weekly / Run Health / Knowledge Base` pages with `App Header` / `Context Bar` / `Global Status Banner` / `Detail Surface`.
  - Preserved URL-addressable detail drilldowns, `latest` normalization, status visibility, and context retention without introducing any business recomputation layer.

## 2026-05-03 Web UX Addendum Trace

- Task: Implement the 2026-05-03 Web UX addendum for bilingual UI and Overview/detail interaction
- Status: DONE
- Files Changed:
  - `app/server.ts`
  - `app/styles.css`
  - `src/__tests__/visualConsoleWeb.test.ts`
- Verification:
  - `wsl.exe -d Ubuntu-22.04 bash -lc 'cd /home/adduser/AgentProjection/agent-trend-radar && npm run typecheck'`
  - `wsl.exe -d Ubuntu-22.04 bash -lc 'cd /home/adduser/AgentProjection/agent-trend-radar && npm run test:visual-console:web'`
  - `wsl.exe -d Ubuntu-22.04 bash -lc 'cd /home/adduser/AgentProjection/agent-trend-radar && npm run exec-plan:preflight'`
- Result:
  - Added localized field-level UI copy for bilingual browser rendering, so Chinese and English surfaces no longer mix hardcoded English metric labels inside headers, summaries, and status tables.
  - Added visible styling for the top-right language switcher while preserving `lang` plus drilldown context in generated URLs.
  - Locked the addendum requirements with web tests covering language switching, Top Decisions dual-field rendering, detail open/close scroll-preservation wiring, drilldown context retention, and startup URL fallback behavior.

## 2026-05-03 English Localization And Local-Date Remediation Trace

- Task: Fix English-page mixed language / garbled text exposure and align `latest` date semantics with the user-local calendar day
- Status: DONE
- Files Changed:
  - `app/server.ts`
  - `src/visualConsole/context.ts`
  - `src/__tests__/visualConsoleWeb.test.ts`
  - `docs/specs/exec-plans/trend-radar-visual-console-v0.1.exec-plan.md`
- Verification:
  - `corepack pnpm test -- visualConsoleWeb`
  - `corepack pnpm typecheck`
- Result:
  - English pages now prefer translating the same artifact-backed user-facing fields (`project_brief_cn` / `why_today_cn` / weekly text) instead of switching to raw repository descriptions, which removes a major source of mixed-language and mojibake output.
  - Added a read-time text normalization step in the Web layer so common legacy mojibake strings no longer leak directly into the English surface.
  - Updated `latest` stale detection to use the same user-local date basis as the CLI default weekly anchor, keeping CLI and Web “today/latest” semantics aligned.

## 2026-05-03 Web Detail Layout And Interest Profile Trace

- Task: Widen the detail surface, hide empty detail placeholders by default, format artifact timestamps for readability, and add a persistent user-interest input flow
- Status: DONE
- Files Changed:
  - `app/server.ts`
  - `app/styles.css`
  - `src/__tests__/visualConsoleWeb.test.ts`
- Verification:
  - `npm run typecheck`
  - `npm run test:visual-console:web`
- Result:
  - The browser layout now uses the full page width more effectively, with a wider right-side detail surface that only renders after a project or KB card is actually selected.
  - `Projects` / `Weekly` / `Knowledge Base` no longer reserve a blank placeholder card before selection, while invalid drilldowns still surface explicit missing states.
  - Artifact timestamps are formatted as `date time timezone` for readability instead of raw ISO strings.
  - Added a browser-side interest-profile form backed by `config.yaml`, so selected directions are submitted to the server and persisted into `sources.user_interest_profile` for downstream backend consumption.

## 2026-05-03 Follow-up Fix Trace

- Task: Repair the detail panel regression, move interest input into the Visual Console header, and support free-form interest keywords
- Status: DONE
- Files Changed:
  - `app/server.ts`
  - `app/styles.css`
  - `src/config.ts`
  - `src/types.ts`
  - `src/action/projectBriefs.ts`
  - `src/__tests__/visualConsoleWeb.test.ts`
  - `src/__tests__/config.test.ts`
- Verification:
  - `npm run typecheck`
  - `npm run test:visual-console:web`
  - `npx vitest run src/__tests__/config.test.ts`
- Result:
  - Fixed the two-column detail layout so project drilldown content renders again after selection instead of disappearing behind an invalid grid declaration.
  - Moved the interest editor into the Visual Console header area so it appears as one compact control block instead of feeling like a repeated content module.
  - Replaced fixed topic checkboxes with free-form keyword input persisted into `config.yaml`, while keeping backend matching compatible through generic string-based interest topics.
