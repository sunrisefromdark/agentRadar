# 设计文档：Trend Radar Visual Console

## 文档状态

- 版本：`v0.6`
- 状态：`Proposed for Review`
- 设计输入：
  - [trend-radar-visual-console-requirement-analysis.md](../product-specs/trend-radar-visual-console-requirement-analysis.md#L1)
  - [agent-trend-radar-product-spec.md](../product-specs/agent-trend-radar-product-spec.md#L1)
  - [system-spec.md](../system-spec.md#L1)
  - [action-output.md](../services/action-output.md#L1)
  - [agent-enhancement-layer-and-weekly-trend-design.md](agent-enhancement-layer-and-weekly-trend-design.md#L1)
- 目标：在保持现有 CLI 主链路、artifact 契约和 `rules-only` / `artifact-first` 原则不变的前提下，为 `agent-trend-radar` 定义一个可视化消费层设计及其浏览器承载契约，使用户能够稳定消费 daily、weekly、run health 和 KB 产物，并完成判断、排障、回看与沉淀。

## 一句话设计

`Trend Radar Visual Console` 是一个 **local-first、artifact-first、read-first** 的统一消费层。它不生成第二套业务真相，不重算 scoring / freshness / trend judgment，只把现有 `daily / weekly / run health / KB / audit` 产物组织成一致、可追溯、可降级、可钻取的观察与排障工作台。

## 需求对齐映射

| 需求分析项 | 本设计对应章节 |
| --- | --- |
| 需求 1：先回答“本次结果靠不靠谱” | `问题定义`、`核心原则`、`Overview 视图`、`状态模型` |
| 需求 2：项目判断结论优先、证据可追 | `Projects 视图`、`项目详情视图`、`跨视图钻取契约` |
| 需求 3：提供 run health 排障工作台 | `Run Health 视图`、`失败与降级行为` |
| 需求 4：weekly 最小消费入口 | `Weekly 视图` |
| 需求 5：支持无趋势周 / 弱信号周真实语义 | `Weekly 视图`、`状态模型`、`失败与降级行为` |
| 需求 6：KB / review 连续入口 | `Knowledge Base 视图`、`跨视图钻取契约` |
| 需求 7：绑定日期 / 时间窗 / artifact 上下文 | `全局上下文模型`、`跨视图钻取契约` |
| 需求 8：artifact-first，不引入第二真相源 | `核心原则`、`数据来源与所有权`、`读取层契约` |
| 需求 9：失败 / 降级 / 空态状态语义冻结 | `状态模型`、`失败与降级行为` |
| 需求 10：rules-only / fallback / 审计上下文可见 | `Overview 视图`、`Weekly 视图`、`Run Health 视图`、`状态模型` |
| 需求 11：跨视图语义一致与可钻取 | `跨视图对象模型`、`跨视图钻取契约` |

## 1. 问题定义

当前系统的“生成能力”已经基本成立，但“消费能力”仍然分散：

- daily、weekly、run summary、verify-daily、GitHub enrichment audit、KB 仍主要通过多个文件消费。
- 用户很难先判断“这次结果是否可信”，再决定是否继续消费榜单或趋势内容。
- weekly 的周趋势语义虽然已在产物侧建立，但缺少与 daily / run health / KB 对齐的统一消费入口。
- “空结果”“失败”“过期”“降级可用”“不可用于判断”在当前文件消费模式下没有统一可见状态模型。

本设计解决的是“如何把现有 artifact 组织成统一且可审计的消费层”；它不重做 signal、filter、action 主链路，也不把 UI 变成新的平台后端或调度入口。

## 2. 核心原则

### 2.1 artifact-first

- 控制台只消费现有 artifact。
- 控制台不得重算 `ScoreBreakdown`、`freshness_state`、weekly 核心趋势归类、风险判断或客观排序。
- 控制台允许做轻量聚合、索引、跳转与状态映射，但这些映射必须可追溯到原 artifact。

### 2.2 可信度优先

- 首页和任何默认入口都必须先回答“本次结果能不能信”。
- 健康状态、freshness、verify 结论、source 状态优先于项目榜单和趋势卡片。

### 2.3 状态显式

- `无结果`、`数据失败`、`结果过期`、`降级可用`、`不可用于判断` 必须是显式状态，而不是由空白页、缺字段或“看起来正常”的卡片隐含表达。

### 2.4 weekly 是完整消费对象

- weekly 不是“一个周报文件入口”，而是和 daily / run health / KB 同级的消费对象。
- weekly 必须保留 `本周总判断 -> 核心趋势卡片 -> 弱信号 / 待观察方向` 的稳定结构，并支持“无趋势周 / 弱信号周”的真实语义。

### 2.5 只读优先

- 第一版控制台只做消费、回看、排障与进入 KB。
- 第一版不做运行触发、多用户协作、复杂编辑、在线写回。

## 3. 范围与非目标

### 3.1 范围内

- Overview 视图
- Projects 视图
- Weekly 视图
- Run Health 视图
- Knowledge Base 视图
- 日期 / 时间窗 / latest 上下文切换
- 项目详情、Weekly supporting projects、KB 的连续钻取
- 统一状态模型与降级语义
- 审计上下文的展示

### 3.2 范围外

- 不新增数据库作为主真相源
- 不新增实时 websocket dashboard
- 不把控制台变成采集、调度或运行主入口
- 不做复杂权限系统
- 不做多用户协作
- 不做 KB 机器区编辑
- 不新增独立“趋势详情”产品对象或额外一级视图
- 不在 UI 中发明新业务评分、趋势或 freshness 结论

## 4. 系统现状与设计假设

### 4.1 已有事实来源

当前仓库中的稳定产物包括：

- `data/reports/YYYY-MM-DD.daily.json`
- `data/reports/YYYY-MM-DD.daily.md`
- `data/reports/YYYY-MM-DD.run-summary.json`
- `data/reports/YYYY-MM-DD.run-summary.md`
- `data/reports/YYYY-MM-DD.weekly.md`
- `data/reports/YYYY-MM-DD.weekly.audit.json`
- `data/scores/YYYY-MM-DD.json`
- `data/kb/*.md`
- `data/kb/latest.json`
- `data/raw/github/YYYY-MM-DD.enrichment.json`
- `data/raw/github/<repo-key>.json`

### 4.2 设计假设

- daily 以结构化 JSON 为主要消费源，Markdown 主要作为人工回看补充。
- weekly 的用户可读主产物是 Markdown，审计信息来自 `weekly.audit.json`。
- KB 的用户可读主产物是 Markdown，索引信息来自 `data/kb/latest.json`。
- `verify-daily` 当前是既有 CLI 质检逻辑产出的结构化结果，不是新的独立 artifact；控制台只能复用该既有结果或其等价持久化版本，不能自定义另一套 verify 语义。
- UI 若需要极薄本地读取层，该层只能暴露文件内容与稳定映射，不承担业务重算责任。

## 5. 全局上下文模型

控制台所有视图都共享一个显式上下文对象 `ViewContext`。

### 5.1 上下文字段

- `mode`
  - `daily`
  - `weekly`
- `selected_date`
  - daily / run health / projects 使用的日期
- `selected_window`
  - weekly 使用的时间窗，至少包含 `window_start` 与 `window_end`
- `entry_kind`
  - `explicit-date`
  - `latest-shortcut`
- `resolved_artifacts`
  - 当前视图实际绑定到的 artifact 文件集合
- `generated_at`
  - 当前主视图所消费主 artifact 的生成时间

### 5.2 上下文规则

- 所有视图必须显示自己绑定到的日期或时间窗，不能只显示“latest”。
- `latest` 只允许作为快捷入口；进入后必须立即解析为具体日期或时间窗。
- daily 与 weekly 上下文不能混用：
  - daily 使用单日日期。
  - weekly 使用明确的时间窗。
- 从一个视图钻取到另一个视图时，必须继承当前上下文，而不是静默跳到新的 latest。

## 6. 跨视图对象模型

为了保证语义一致性，控制台统一只认三类用户可见核心对象：

### 6.1 Run Snapshot

代表一次 daily 运行的消费对象，来源于：

- `daily.json`
- `run-summary.json`
- `verify-daily` 的结构化结果
- `data/raw/github/YYYY-MM-DD.enrichment.json`
- 相关 source / audit artifacts

它回答：

- 这次 run 是否可信
- 这次 run 的结果是否新鲜
- 这次 run 有没有失败、降级或需要谨慎消费的地方

### 6.2 Weekly Snapshot

代表一个 weekly 时间窗的消费对象，来源于：

- `weekly.md`
- `weekly.audit.json`
- weekly artifact 内显式引用的 `scores/*.json` / daily 结构结果

它回答：

- 本周整体趋势判断是什么
- 哪些方向是核心趋势
- 哪些只是弱信号
- 本周是否尚未形成稳定趋势

边界：

- 控制台不得根据最近 7 天 `scores/*.json` 自行重建 `trend_key`、核心趋势卡片或 weak signal。
- 最近 7 天 score / daily 结果只允许用于把 weekly 已有趋势钻取到 supporting projects、evidence 引用和历史日期映射。

### 6.3 Project / KB Object

代表某个 repo 的统一消费对象，来源于：

- 当前 daily 语义以 `daily.json` 中已入榜或已展示项目为主
- `scores/*.json` 仅用于补充已被 daily / weekly artifact 明确引用的结构化字段，不得扩展出新的展示项目集合
- `data/raw/github/<repo-key>.json` 中的 enrichment 信息
- `data/kb/*.md`

它回答：

- 这个项目是什么
- 为什么今天 / 本周值得看
- 它有哪些风险与证据
- 它的历史 appearances、KB 与人工沉淀是什么

## 7. 信息架构

第一版控制台固定为 5 个一级视图：

1. `Overview`
2. `Projects`
3. `Weekly`
4. `Run Health`
5. `Knowledge Base`

说明：

- 当前设计不再采用原文中的 4 视图方案，因为最新需求已把 weekly 冻结为独立消费对象，不能继续隐藏在 Overview 或文件跳转里。
- 各视图都必须服从同一上下文模型与状态模型。

## 8. 状态模型

### 8.1 顶层消费状态

控制台顶层固定使用以下状态语义：

- `ready`
  - 结果可读且可用于判断
- `degraded`
  - 结果可读，但存在 fallback、部分 source 缺失、rules-only、增强层降级或局部失败
- `stale`
  - artifact 存在，但不满足当前日期 / 时间窗新鲜度要求
- `failed`
  - 关键 artifact 或关键 source 失败，导致结果不可安全消费
- `empty`
  - 运行成功且上下文合法，但在该视图范围内没有匹配内容
- `not-judgeable`
  - 结果能部分展示，但缺少关键证据或上下文，不应用于趋势判断

### 8.2 状态与需求语义映射

- `empty` 对应需求中的 `无结果`
- `failed` 对应需求中的 `数据失败`
- `stale` 对应需求中的 `结果过期`
- `degraded` 对应需求中的 `降级可用`
- `not-judgeable` 对应需求中的 `不可用于判断`

### 8.3 状态优先级

当一个视图同时命中多个状态时，优先级固定为：

1. `failed`
2. `not-judgeable`
3. `stale`
4. `degraded`
5. `empty`
6. `ready`

这样可避免“既失败又空”时被误显示为空状态。

### 8.4 状态触发边界

- `empty`
  - 输入 artifact 存在且读取成功，但该视图范围内无匹配项目 / 无弱信号 / 无 KB 结果。
- `failed`
  - 视图所必需的核心 artifact 缺失、解析失败、关键 source 失败且无可用等价结果。
- `stale`
  - 仅当用户请求 `latest` 或请求“当前应有的新鲜结果”时，artifact 解析到的日期 / 时间窗与该请求不一致，或 freshness 明确表明不是当前应消费结果。
  - 若用户显式打开历史日期 / 历史时间窗，且 artifact 与该显式请求一致，则即使它早于今天，也不计为 `stale`。
- `degraded`
  - `rules-only`、GitHub enrichment fallback、部分 source 缺失、增强层部分失败、weekly 仅依赖保底结构等。
- `not-judgeable`
  - 视图有内容，但缺少做判断所需的核心证据，例如 weekly 只有残缺总述、run health 无法确认关键 source 状态。

## 9. 视图设计

## 9.1 Overview 视图

### 目标

- 先回答“这次结果靠不靠谱”
- 再回答“今天 / 当前上下文最值得看的是什么”
- 再给出明显风险与下一步动作

### 输入

- `daily.json`
- `run-summary.json`
- `verify-daily` 的结构化结果
- 需要时读取关联 audit / source 信息

### 核心模块

1. `Context Header`
2. `Run Trust Summary`
3. `Source Health Summary`
4. `Top Decisions`
5. `Risks and Recommended Actions`
6. `Weekly Entry`

### 模块契约

#### Context Header

必须显示：

- 当前日期或 latest 解析后的具体日期
- 主 artifact `generated_at`
- 当前运行模式摘要
  - `rules-only`
  - enhancement fallback
  - source 缺失 / 降级

#### Run Trust Summary

必须直接显示：

- run 总体状态
- verify 结论
- `overall_daily_status`
- freshness 摘要

禁止行为：

- 先显示榜单，再把可信度信息放到二级区块

#### Source Health Summary

必须显示：

- active / empty / failed / disabled source 数量
- 明显的 source failure 或 source empty
- 是否存在 GitHub enrichment fallback

#### Top Decisions

必须显示：

- 用户当前应重点看的项目集合
- 每项至少包含 `score / confidence / paradigm / top evidence / risk / persistence`

#### Risks and Recommended Actions

必须显示：

- `watchouts`
- `recommended_actions`

#### Weekly Entry

必须存在一个明确入口进入当前相关 weekly 视图，不允许让 weekly 继续变成“去目录找文件”。

## 9.2 Projects 视图

### 目标

- 让用户直接消费 daily 项目判断
- 支持筛选噪声、风险和 persistence
- 支持进入单项目详情、KB 与历史沉淀

### 输入

- `daily.json`
- `scores/YYYY-MM-DD.json`
- 对应 raw enrichment / KB 索引

输入边界：

- Projects 视图的对象集合必须以 `daily.json` 中当前日期已展示的项目为准。
- `scores/YYYY-MM-DD.json` 只能补充 daily 已引用项目的结构化字段或支持排序/筛选回显，不能把未进入当次 daily 消费范围的项目直接扩进 Projects 视图。

### 列表字段最小集合

- `project_name`
- `repo_url`
- `score`
- `confidence`
- `paradigm`
- `persistence_state`
- `top_evidence`
- `risks`
- `next_actions`
- `matched_interest_topics`（若存在）
- `enhancement_status context`（若相关）

### 固定筛选维度

- `verdict`: `high / watch / low`
- `confidence`: `high / medium / low`
- `persistence`: `single-spike / emerging / persistent`
- `source pattern`: `single-source / multi-source / watchlist-hit`
- `risk`: `has-risk / no-risk`

说明：

- 这些筛选只能基于已有 artifact 字段，不允许前端推导新的业务标签。

## 9.3 项目详情视图

### 目标

- 回答“这个项目是什么、为什么今天 / 本周值得看、风险在哪里、历史如何、KB 在哪里”

### 输入

- 项目在 daily / scores 中的结构化结果
- raw GitHub enrichment 结果
- 对应 KB card

### 固定模块

1. `Project Identity`
2. `Score and Evidence`
3. `Risk and Next Actions`
4. `Persistence and Appearances`
5. `Run / Audit Context`
6. `Knowledge Card Preview`

### 边界

- 项目详情不能发明独立于 daily / weekly 的新结论。
- 从 weekly 趋势进入项目详情时，必须保留“它支撑哪条趋势”的上下文提示。

## 9.4 Weekly 视图

### 目标

- 把 weekly 当作独立消费对象
- 清楚表达“本周总判断 / 核心趋势 / 弱信号 / 无趋势周”
- 支持从趋势进入 supporting projects 与 KB

### 输入

- `YYYY-MM-DD.weekly.md`
- `YYYY-MM-DD.weekly.audit.json`
- 必要时读取相关 `scores/YYYY-MM-DD.json` 或 daily 结构结果用于钻取映射

输入边界：

- Weekly 视图的总判断、核心趋势、弱信号、是否可判断，必须完全以 `weekly.md` 与 `weekly.audit.json` 为准。
- `scores/YYYY-MM-DD.json` 或 daily 结构结果只允许用于 supporting project 展示、证据回链和项目详情跳转，不允许在控制台内二次归纳新的周趋势。

### 固定结构

1. `Weekly Context Header`
2. `Weekly Trust Summary`
3. `Overall Weekly Judgment`
4. `Core Trend Cards`
5. `Weak Signals / Watch Next`
6. `Optional Audit Context Blocks`

### Weekly Context Header

必须显示：

- `window_start`
- `window_end`
- weekly artifact 生成时间
- enhancement 状态
- 是否处于 `rules-only`、`agent-partial`、`agent-full`

### Weekly Trust Summary

必须显示：

- 本周 weekly 是否可用于判断
- 是否存在 `rules-only`
- 是否存在 enhancement fallback
- 是否存在“只有弱信号、尚未形成稳定趋势”

### Overall Weekly Judgment

必须展示 weekly 总判断文本，并能追溯到下方趋势卡片。

### Core Trend Cards

每张卡片必须至少展示：

- 趋势名称
- 趋势判断摘要
- 证据摘要
- 强度
- 是否值得下周继续跟踪
- `1-3` 个 supporting projects

### Optional Audit Context Blocks

仅在 weekly audit / artifact 明确存在附加区块时显示，例如个性化 focus 或 rejected outputs 摘要。

边界：

- 它不是 V1 weekly 最小消费契约的一部分，缺失时不影响需求 4 / 5 的成立。
- 它不能新增客观趋势。
- 它只能引用已存在的核心趋势、弱信号和 supporting projects。

### Weak Signals / Watch Next

必须支持两种真实情况：

- 有明确弱信号卡片
- 本周尚未形成稳定趋势，仅保留弱信号或待观察方向

### 无趋势周设计冻结

当 weekly 缺乏稳定趋势证据时：

- 不得强行凑出 `2-4` 条核心趋势卡片
- 页面必须显式显示“尚未形成稳定趋势”或等价保守语义
- 若只有弱信号区，则该状态应为 `not-judgeable` 或 `degraded`，由上游 weekly 审计上下文决定

## 9.5 Run Health 视图

### 目标

- 回答“哪里出了问题”“问题影响范围是什么”“下一步该做什么”

### 输入

- `run-summary.json`
- 既有 `verify-daily` 逻辑生成的 `VerifyDailyResult`
- `run-summary.json` 内 source 状态
- `data/raw/github/YYYY-MM-DD.enrichment.json`

输入边界：

- V1 Run Health 不新增独立 `run-health.json` 或新的 verify artifact。
- 若后续需要持久化 `verify-daily` 结果，也必须保持与现有 `VerifyDailyResult` 结构等价，不能让控制台消费另一套质检口径。

### 固定模块

1. `Verify Result Summary`
2. `Source Status Table`
3. `GitHub Enrichment Audit Table`
4. `Failure / Empty / Fallback Notes`
5. `Recommended Actions`

### 核心边界

- Run Health 不是项目内容页，必须优先展示系统运行语义。
- source empty 与 source failed 必须分开。
- API / cache / unavailable / invalid_repo 必须按现有 audit 语义原样展示，不得重新解释。

## 9.6 Knowledge Base 视图

### 目标

- 让用户浏览长期沉淀项目
- 清楚区分机器区与人工区
- 支持从项目 / 趋势进入对应 KB

### 输入

- `data/kb/latest.json`
- `data/kb/*.md`

### 固定模块

1. `KB Index`
2. `Card Reader`
3. `Machine Section`
4. `Human Section`
5. `Linked Context`

### 边界

- 第一版只读，不提供富编辑器。
- 机器区与人工区必须可视觉区分。
- 当 KB card 缺失但项目存在时，必须显示缺失状态，而不是假装没有这个项目。

## 10. 跨视图钻取契约

### 10.1 从 Overview / Projects 到项目详情

- 保留当前日期上下文
- 传递项目 key / repo identity
- 显示该项目来自当前 daily 结果

### 10.2 从 Weekly 趋势到 supporting projects

- 保留当前 weekly 时间窗
- 传递 `trend_key`
- 项目详情必须显示“该项目当前是某条 weekly 趋势的 supporting project”

### 10.3 从项目到 KB

- 保留当前来源上下文
- KB 主上下文始终使用显式 `date`；若来源是 `weekly`，则 `date` 固定解析为当前 weekly 的 `window_end`，而 `anchor` 与 `trend_key` 只作为来源上下文保留，不得替代 KB 的主上下文
- 显示对应 KB 是否存在
- KB 缺失时显示显式缺失状态

### 10.4 从 Overview 到 Run Health

- 保留当前 daily 日期上下文
- 直接定位到当前 run 的 verify / source / audit 状态

### 10.5 一致性要求

- 同一项目在 Overview、Projects、Weekly supporting project、Project Detail 中的核心结论必须一致：
  - `score`
  - `confidence`
  - `paradigm`
  - `persistence`
  - 已有风险

任何视图只允许省略字段，不允许改写字段含义。

## 11. 数据来源与所有权

## 11.1 只允许消费的主 artifact

- daily：`data/reports/YYYY-MM-DD.daily.json`
- run health：`data/reports/YYYY-MM-DD.run-summary.json`
- weekly：`data/reports/YYYY-MM-DD.weekly.md`
- weekly audit：`data/reports/YYYY-MM-DD.weekly.audit.json`
- scores：`data/scores/YYYY-MM-DD.json`
- kb index：`data/kb/latest.json`
- kb cards：`data/kb/*.md`
- github enrichment audit：`data/raw/github/YYYY-MM-DD.enrichment.json`
- repo enrichment details：`data/raw/github/<repo-key>.json`
- verify 结果：仅允许消费现有 `verify-daily` 逻辑输出的 `VerifyDailyResult`，不得发明新 schema

## 11.2 所有权边界

- scoring、freshness、weekly 趋势升级、risk flags 归 CLI / pipeline 所有。
- 控制台只拥有：
  - 读取
  - 轻量聚合
  - 视图组织
  - 状态映射
  - 上下文与钻取

## 12. 读取层契约

### 12.1 读取层定位

第一版允许存在一个极薄的本地读取层，但它不是业务层，只是 artifact adapter。

### 12.2 读取层职责

- 根据日期 / 时间窗读取对应 artifact
- 提供 stable path lookup
- 统一返回“文件不存在 / 文件损坏 / 解析失败 / 成功读取”
- 不计算新业务字段
- 不改写 artifact 结论

### 12.3 读取层最小接口

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

### 12.4 错误返回

读取层必须显式区分：

- `not_found`
- `parse_error`
- `unsupported_context`
- `ok`

这些错误必须能映射到上层状态模型，而不是被吃掉。

## 13. 失败与降级行为

### 13.1 daily 主 artifact 缺失

- Overview / Projects 进入 `failed`
- 页面显示“当前日期 daily 结果不存在”
- 不得静默跳到 latest

### 13.2 run-summary 缺失但 daily 存在

- Overview 进入 `degraded`
- Run Health 进入 `failed`
- 用户可以继续看项目内容，但必须看到“健康上下文缺失”

### 13.3 weekly markdown 存在但 weekly audit 缺失

- Weekly 视图可以继续展示主内容
- Weekly 状态至少为 `degraded`
- enhancement 状态显示为“审计上下文缺失”

### 13.4 weekly 只有弱信号、没有核心趋势

- Weekly 视图不强行渲染核心趋势卡片
- 显式展示“尚未形成稳定趋势”
- 允许仅展示弱信号区

### 13.5 source empty

- 明确显示“该 source 成功运行但没有结果”
- 不得与 `source failed` 混用

### 13.6 source failed

- 明确显示“该 source 失败”
- 若该 source 对当前判断是关键依赖，则视图状态提升为 `failed` 或 `not-judgeable`

### 13.7 rules-only / enhancement fallback

- 若 daily / weekly 产物显示 `rules-only` 或 enhancement fallback：
  - 顶部必须可见
  - 视图状态至少为 `degraded`
  - 不阻止用户继续阅读，但提示这是保底结果或部分增强结果

### 13.8 KB 缺失

- 项目仍可展示
- KB 入口显示“KB 未生成 / 不存在”
- 不得把“KB 缺失”误表现成“此项目没有历史沉淀”

### 13.9 latest 解析失败

- 不得回退到任意旧日期
- 直接进入 `failed`
- 提示 latest 快捷入口无法解析

## 14. 审计与透明性设计

### 14.1 用户可见透明字段

控制台必须让用户可见以下上下文：

- `enhancement_status`
- `rules-only` / `agent-partial` / `agent-full`
- source failure / empty / fallback
- GitHub enrichment 状态
- artifact 时间戳与日期 / 时间窗

### 14.2 设计原因

- 这些字段已经在现有 daily / weekly 设计与测试中存在，控制台必须承接，而不是隐藏。
- 用户必须能判断“我看到的是完整结果，还是保底结果，还是部分降级结果”。

## 15. 测试设计

## 15.1 需求验收映射

- 需求验收 1 对应：
  - Overview 首屏结构测试
  - 首页状态优先级测试
- 需求验收 2 对应：
  - Projects 列表字段完整性测试
  - 项目详情证据追溯测试
- 需求验收 3 对应：
  - Run Health source / verify / audit 聚合测试
- 需求验收 4 / 5 对应：
  - Weekly 独立入口测试
  - 无趋势周 / 弱信号周渲染测试
- 需求验收 6 对应：
  - 项目 -> KB 路径测试
  - 机器区 / 人工区可见性测试
- 需求验收 7 对应：
  - latest 解析与日期 / 时间窗显示测试
- 需求验收 8 对应：
  - UI 不重算业务结论的结构测试
- 需求验收 9 对应：
  - `empty / failed / stale / degraded / not-judgeable` 状态测试
- 需求验收 10 对应：
  - `rules-only / agent-partial / agent-full` 可见性测试
- 需求验收 11 对应：
  - 跨视图一致性与钻取上下文测试

## 15.2 单元测试

- 状态优先级映射正确
- latest 解析后必须绑定具体日期 / 时间窗
- source empty 与 source failed 区分正确
- weekly audit 缺失时进入 `degraded` 而不是 `ready`
- weekly 无核心趋势时只展示弱信号区
- 同一项目在多视图中的核心字段保持一致

## 15.3 集成测试

- daily + run-summary 正常时，Overview 可在首屏完成信任判断
- daily 存在而 run-summary 缺失时，Overview 与 Run Health 状态分化正确
- weekly.md + weekly.audit.json 正常时，Weekly 可展示总判断、核心趋势、弱信号
- weekly 仅有弱信号时，Weekly 不伪造核心趋势
- 从 Weekly supporting project 进入项目详情时，趋势上下文不丢失
- 从项目进入 KB 时，KB 缺失与存在行为正确

## 15.4 回归测试

- 不改变现有 artifact 路径契约
- 不要求新增数据库
- 不引入 UI 侧 scoring / freshness / trend recompute
- `rules-only` 模式仍可完整消费
- `weekly.audit.json` 缺失时仍可读正文，但必须降级

## 15.5 浏览器级验证

- 顶层导航与路由恢复
  - `Overview / Projects / Weekly / Run Health / Knowledge Base` 五个一级路由都可直接访问。
  - 刷新页面后，`selected_date / selected_window / trend_key / project / slug` 能从 URL 恢复，而不是跳回 `latest`。
- Overview 首屏顺序
  - `Context Header`、全局状态 Banner、`Run Trust Summary`、`Source Health Summary` 必须先于 `Top Decisions` 出现在首屏主内容顺序中。
- 状态 Banner 可见性
  - `failed / degraded / stale / empty / not-judgeable` 都必须以显式 Banner 或等价显式状态区展示，不能退化为空白页或仅在控制台日志出现。
- 钻取上下文继承
  - 从 weekly supporting project 进入项目详情后，URL 中仍保留 `anchor` 与 `trend_key`。
  - 从项目进入 KB 后，URL 中仍保留来源上下文，浏览器返回可回到原消费视图。
- KB 缺失显式状态
  - 当 `slug` 对应 KB card 缺失时，页面必须显示显式缺失状态，而不是空白容器。
- 启动输出与地址可发现性
  - 本地 Web 启动命令必须打印 `Local` 访问地址。
  - 端口冲突时，必须打印最终实际 URL，而不是只提示“已启动”。

## 16. 主要风险与取舍

### 取舍 1：把 Weekly 作为独立一级视图

好处：

- 与需求完全对齐
- 不再把 weekly 降格为文件入口

代价：

- 信息架构比原设计多一个一级入口

本设计选择：

- 接受多一个一级入口
- 不接受继续将 weekly 隐含在 Overview 或文件跳转中

### 取舍 2：冻结显式状态模型

好处：

- 用户能区分空、坏、旧、降级
- 失败路径可测试

代价：

- 需要额外定义状态优先级与视图映射

本设计选择：

- 接受状态建模复杂度
- 不接受用“空页面 + 默认文案”掩盖状态差异

### 取舍 3：latest 只做快捷入口

好处：

- 不破坏审计性
- 历史回看语义稳定

代价：

- 所有视图都必须显式显示解析后的上下文

本设计选择：

- 接受更多上下文显示
- 不接受 latest 成为隐藏状态

## 17. Web 承载补充设计（2026-05-03 Addendum）

本节专门补齐浏览器网页承载所需、但不应由 ExecPlan 擅自冻结的交互契约。它不改变前文已经冻结的 artifact-first 边界、状态模型和视图语义，只把这些语义映射到明确可执行的 Web 入口、路由和详情承载方式上。

### 17.1 页面承载骨架

浏览器版控制台固定采用以下页面骨架：

1. `App Header`
   - 产品名称
   - 当前环境标识（local-first / artifact-first）
   - 一级导航
2. `Context Bar`
   - 当前日期或时间窗
   - 主 artifact 时间戳
   - 当前顶层状态
   - `rules-only / agent-partial / agent-full`
3. `Global Status Banner`
   - 承载 `failed / degraded / stale / empty / not-judgeable` 的显式状态说明
4. `Primary Content`
   - 按当前一级视图的固定模块顺序渲染主内容
5. `Detail Surface`
   - 承载项目详情、KB card 或 supporting project 钻取内容

约束：

- `Global Status Banner` 必须位于 `Context Bar` 之后、主内容之前。
- Overview 首屏主内容顺序必须保持：
  - `Run Trust Summary`
  - `Source Health Summary`
  - `Top Decisions`
- 浏览器版不允许退化为“把 CLI 输出整段塞进一个 `<pre>`”。

### 17.2 详情承载区契约

V1 详情承载区冻结为“**URL 可寻址的同页详情面板**”，而不是弹窗或不可深链的临时抽屉。

- 在桌面宽度下：
  - 详情以右侧分栏面板承载
  - 左侧保留当前一级视图上下文与列表/卡片主内容
- 在窄屏下：
  - 同一条 URL 进入全屏详情页样式
  - 返回行为仍由浏览器历史记录与 URL 参数驱动

不采用以下方案：

- 非 URL 可寻址的 modal
- 刷新即丢上下文的临时 drawer
- 与主视图完全断开的匿名详情页

### 17.3 路由与 URL 契约

浏览器版一级路由固定为：

- `/overview`
- `/projects`
- `/weekly`
- `/run-health`
- `/kb`

上下文参数固定为：

- daily 语境：
  - `date=YYYY-MM-DD`
- weekly 语境：
  - `anchor=YYYY-MM-DD`
- 钻取参数：
  - `project=<repo_full_name>`
  - `trend_key=<weekly_trend_key>`
  - `slug=<kb_slug>`
  - `source_view=<overview|projects|weekly|run-health|kb>`
- 表现层 / 只读过滤参数（不改变业务上下文语义时允许追加）：
  - `lang=<zh|en>`
  - `theme=<light|dark>`
  - `board / confidence / paradigm / persistence / kb` 仅允许在 `Projects` 视图中表达只读过滤状态

示例：

- `/overview?date=2026-05-03`
- `/projects?date=2026-05-03&project=openai/codex`
- `/weekly?anchor=2026-05-03&trend_key=agent-runtime-persistent-memory&project=openai/codex`
- `/run-health?date=2026-05-03&source_view=overview`
- `/kb?slug=openai-codex&source_view=projects&date=2026-05-03&project=openai/codex`

约束：

- 一级视图切换必须通过 path 表达，不能只靠内存态切换 tab。
- 详情打开必须通过 query 参数显式表达，不能只靠本地状态。
- 浏览器刷新后，页面必须能仅凭 URL 恢复当前视图和详情上下文。
- `lang / theme / board / confidence / paradigm / persistence / kb` 这类附加参数不得替代 `date / anchor / project / trend_key / slug / source_view` 的 artifact 绑定与钻取语义。

### 17.4 跨视图钻取在 Web 中的具体规则

#### Overview / Projects -> Project Detail

- 保留原 `date`
- 进入对应一级视图路径不变
- 只新增 `project` 参数

示例：

- `/projects?date=2026-05-03` -> `/projects?date=2026-05-03&project=openai/codex`

#### Weekly -> Project Detail

- 保留原 `anchor`
- 保留 `trend_key`
- 新增 `project`

示例：

- `/weekly?anchor=2026-05-03&trend_key=agent-runtime-persistent-memory`
- `/weekly?anchor=2026-05-03&trend_key=agent-runtime-persistent-memory&project=openai/codex`

#### Project -> KB

- 切换到 `/kb`
- 保留来源上下文
- 传递 `slug`
- 若来源是 `weekly`，显式写入 `date=<current window_end>`，并同时保留 `anchor` 与 `trend_key`

示例：

- `/projects?date=2026-05-03&project=openai/codex`
- `/kb?slug=openai-codex&source_view=projects&date=2026-05-03&project=openai/codex`
- `/weekly?anchor=2026-05-03&trend_key=agent-runtime-persistent-memory&project=openai/codex`
- `/kb?slug=openai-codex&source_view=weekly&date=2026-05-03&anchor=2026-05-03&trend_key=agent-runtime-persistent-memory&project=openai/codex`

#### Overview -> Run Health

- 切换到 `/run-health`
- 保留 `date`
- 写入 `source_view=overview`

#### 关闭详情 / 返回行为

- 关闭详情只移除叶子参数：
  - 关闭项目详情时移除 `project`
  - 关闭 KB card 时移除 `slug`
- 关闭详情不得清掉父级上下文参数：
  - `date`
  - `anchor`
  - `trend_key`
  - `source_view`
- 浏览器返回按钮必须优先恢复上一个 URL，而不是触发“跳回 latest”。

### 17.5 `latest` 入口与刷新恢复

浏览器版允许 `latest` 作为快捷入口，但不允许把 `latest` 保留成最终可见上下文。

- daily 入口允许：
  - `/overview?date=latest`
  - `/projects?date=latest`
  - `/run-health?date=latest`
- weekly 入口允许：
  - `/weekly?anchor=latest`

解析规则：

- 页面加载后必须立刻把 `latest` 解析为具体日期/时间窗。
- 解析成功后，URL 必须被替换为具体值：
  - `/overview?date=latest` -> `/overview?date=2026-05-03`
  - `/weekly?anchor=latest` -> `/weekly?anchor=2026-05-03`
- 若解析失败：
  - 保持原请求路径
  - 进入 `failed`
  - 显式提示“latest 快捷入口无法解析”
- 用户刷新页面时：
  - 若 URL 已是具体日期/时间窗，则必须恢复同一上下文
  - 若 artifact 缺失，则显示失败/缺失状态，但不得静默跳转

### 17.6 本地启动与地址输出契约

浏览器版的默认本地入口固定为：

- 根命令：`npm run visual-console:web`
- 默认本地地址：`http://localhost:3210/`

启动输出至少必须包含：

- 命令名
- 实际监听端口
- `Local` URL
- 如可用则输出 `Network` URL

端口冲突规则：

- 允许自动切到下一个可用端口
- 但必须显式打印最终实际 URL
- 不允许静默换端口

### 17.7 浏览器级验证契约

浏览器实现必须至少通过以下类型的验证：

1. 导航验证
   - 5 个一级路由可直接访问
2. 首屏顺序验证
   - Overview 中 `Run Trust Summary` 先于 `Top Decisions`
3. 状态 Banner 验证
   - `failed / degraded / stale / empty / not-judgeable` 显式可见
4. 钻取上下文验证
   - weekly -> project detail 保留 `anchor + trend_key`
   - project -> kb 保留来源上下文
5. 缺失态验证
   - KB 缺失显式显示
6. 启动协议验证
   - 终端输出 `Local` URL
   - 端口冲突时打印最终 URL

## 18. 浏览器前端视觉改版补充设计（2026-05-04 Addendum）

本节补充“浏览器前端整体不够美观”的通性问题，目标不是只修一个 `兴趣方向` 模块，而是在不改变 artifact-first 与只读消费边界的前提下，统一视觉语言、页面密度、信息层级与响应式行为，让控制台更接近现代前沿产品常见的“编辑型工作台”气质，而不是传统后台表单页。

### 18.1 视觉目标

浏览器版视觉改版应同时满足以下目标：

1. `可信工作台感`
   - 首屏仍然优先回答“结果能不能信”，但表达方式从厚重告警框升级为更克制、更有层级的 editorial dashboard。
2. `前沿产品感`
   - 借鉴现代 AI 产品、研究工具和设计媒体站点常见的特征：大留白、强层级、低噪声、轻玻璃质感、明确焦点区与高质量排版。
3. `阅读效率`
   - 卡片不是越大越高级；必须通过宽度控制、字重、间距和分组关系提升扫描效率。
4. `局部高亮，整体克制`
   - 强调色只用于状态、主操作和关键趋势，不得把整页做成高饱和度监控大盘。

### 18.2 整体设计语言

视觉语言冻结为以下方向，借鉴 Linear、Vercel 等现代开发者工具的设计美学：

- `Theme-aware Workspace` (双主题工作台)
  - 必须提供 Light / Dark 模式。Light 模式基础气质为温暖浅底、低对比纹理背景、纸面感内容卡；Dark 模式采用深空灰（如 `#0A0A0A` 至 `#111111`）而非纯黑，通过极细的高丽边框（hairline borders）划分层级。
- `Soft depth & Frosted Glass` (柔和深度与毛玻璃)
  - 用轻阴影（大 blur，低 alpha）、弱描边（1px 且透明度低于 10%）和背景层次制造深度，不靠重描边和大面积纯色块。
  - 适度使用毛玻璃（`backdrop-filter: blur(12px) saturate(180%)`）用于浮层、Context Strip 和 Header，保证滚动时底色若隐若现的高级透视感。
- `Type-first hierarchy` (排版优先)
  - 优先通过标题字阶、段落宽度、字重区分、标签大小、数值颜色表达层级，不靠无限放大容器。引入严格的 `4px / 8px` 基准网格，确保所有组件的节奏感。
- `Calm & Contextual motion` (克制且基于上下文的微交互)
  - 仅允许轻量进入动画（如基于 spring 的平滑位移与透明度渐显）、悬停抬升（Hover 状态的卡片微缩放和阴影变化）和焦点过渡，不引入花哨运动。支持 Skeleton Screen 骨架屏加载，拒绝生硬的白屏或全屏 Spinner。

禁止事项：

- 不使用“满屏大圆角大卡片 + 每块都很厚”的堆叠方式（最大圆角不超过 12px 或是随层级递减）。
- 不让一级区块全部同权重同尺寸，导致页面像均质仪表盘。
- 不让表单区成为页面视觉主角，所有设置项应更像“可直接编辑的文本”而非“挖空的输入框”。

### 18.3 页面骨架与密度策略：Bento 布局与空间收敛

整体页面布局摒弃传统的“通栏铺满”做法，采用前沿的 **Bento Box（便当盒）非对称网格** 与 **Fluid Space（流体空间）** 策略，塑造紧凑、有序且充满探索感的数据空间。

#### 18.3.1 视图骨架与首屏结构

首页与各一级视图首屏统一采用全新的架构：

1. `Dynamic Floating Header` (悬浮式动态顶栏)
   - 产品名、环境属性、全局层级的导航、语言切换。
   - 桌面端取消与顶部的硬贴边（Hard Edge），采用包裹在毛玻璃内的浮动胶囊外观（Island-style），拉开与页面顶部的呼吸距（如 `top: 16px; margin: 0 auto;`），强调其“控制台”而非“网页”的属性。
2. `Immersive Context Strip` (沉浸式上下文信息带)
   - 日期、artifact 生成时间、状态、执行模式等元信息，采用紧凑的 Inline-flex 布局，用图标和徽章（Badges）代替冗长纯文本。
3. `Bento Insight Grid` (非对称便当盒洞察网格)
   - 采用 CSS Grid 布局，依据当前视图展示 3 到 5 个重点模块（例如 2x2 或 2x1 跨格布局）。
   - 将最重要的数据（如 `Run Trust Summary`）横跨多格（Span-2），次要指标则占用小方格（1x1），形成视觉上的降维差，打破均质感。
4. `Seamless Secondary Content` (无缝次级内容区)
   - 项目列表、趋势列表、KB 阅读区弱化外层卡片包裹感，变为页面的基底内容。列表项采用极细分割线或隐形边界（Invisible Borders，利用 Hover 态显示响应）呈现。

约束：

- `Context Bar` 高度极限压缩，保持在一级视野内但绝对不能抢主卡片风头。
- 一级导航与上下文区要发生材质与形状分离，避免“一层层叠放矩形栏”。
- 移动端下 Bento Grid 自动降级为线性流，但保持模块内部内容的纵向节奏。

#### 18.3.2 黄金比例阅读宽度控制

- **中心画幅限制**：不再做简单的 Full-width 100% 拉伸响应。核心容器最大宽度（`--page-max-width`）建议控制在 `1280px` 以内。
- **最佳阅读长度限制**：涉及到长篇评语或 KB 文章的正文列，必须严格约束在 `72ch` 到 `85ch` (字符数)。过长的文本行会降低阅读追踪体验。
- 项目详情弹出时（Drawer/Side Panel），应当具有毛玻璃遮罩覆盖主内容区，右栏保持稳定的黄金比例宽度（如 `400px - 480px`）。

#### 18.3.3 卡片密度与负空间弹性 (Fluid Negative Space)

- 一级卡片 padding 收敛为紧密但均匀的体系（如外框 `24px`，内部元素间距 `12px/8px/4px` 递减序列）。
- 引入 **Optical Margin Alignment（视觉页边对齐）**，特别是文字标题和卡片内图标边缘的严格对齐，去除非必要的装饰性留白。
- 对比旧版，目标是“通过网格与留白的组织，让极高的数据密度显得并不拥挤”。

### 18.4 极致渲染与视觉层级系统

页面固定采用现代 GPU 渲染友好的四层视觉层级：

1. `Atmosphere Layer`
   - 页面背景、渐变、轻纹理、远景色块
2. `Shell Layer`
   - Header、Context Strip、Status Banner 等全局壳层
3. `Content Layer`
   - 各类主卡片、表格、阅读器、列表
4. `Focus Layer`
   - 当前选中项目、详情面板、保存反馈、hover/focus 态

规则：

- 只有 `Focus Layer` 可以明显抬升。
- `Status Banner` 必须可见，但视觉权重不得持续压过主结论卡片。
- 详情面板要像“编辑侧栏”，不是另一整页大卡片。

### 18.5 设计令牌建议

为后续 CSS 改造新增或收敛以下 design tokens：

- `--page-max-width`
- `--content-max-width`
- `--surface-1`
- `--surface-2`
- `--surface-glass`
- `--border-subtle`
- `--shadow-soft`
- `--shadow-focus`
- `--radius-shell`
- `--radius-card`
- `--space-1` ~ `--space-8`
- `--text-strong`
- `--text-muted`
- `--accent-amber` 或同类暖色强调（用于趋势或提醒）
- `--accent-sage` 或同类辅助色（用于健康态或中性标签）
- `--font-sans`: `'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Noto Sans SC', sans-serif`
- `--font-mono`: `'JetBrains Mono', 'Fira Code', 'SF Mono', monospace`

约束：

- 颜色系统应从“单一棕色系页面”升级为“Light/Dark 动态自适应模型 + 一主一辅强调色”。全局避免纯对比度（忌纯黑 `#000` 搭配纯白 `#FFF`），追求视觉柔和。
- 字体系统优先提升中文阅读质感与英文标题/代码片段的识别度。数字与状态指标（得分/趋势值）强制使用等宽数字（`font-variant-numeric: tabular-nums`），保证表格或列表上下对齐。
- 阴影与模糊必须节制，配合边界光泽（inner box-shadow）解决卡片边缘在暗色模式下的糊化问题，避免廉价玻璃拟态。

### 18.6 Interest Profile 模块专项改版

`兴趣方向` 当前问题不是单点样式，而是承担了过大的视觉面积，却没有成为真正的主任务区，因此需要从“笨重表单块”改成“轻量个性化设置卡”。

#### 18.6.1 问题定义

当前 `兴趣方向` 模块存在以下问题：

- 容器过宽，阅读焦点分散。
- 文案说明与输入区混在一起，信息密度低。
- 当前兴趣、说明文字、保存操作的层级不清。
- 在 Overview 首屏中过于抢占纵向空间，挤压真正重要的运行可信度信息。

#### 18.6.2 新承载方式

`兴趣方向` 模块调整为 `Preference Card`，固定采用三段式结构：

1. `Card Header`
   - 标题
   - 一句短说明
   - 当前状态徽标，例如“未启用 / 已启用 N 项”
2. `Current Interests Preview`
   - 以 badge/chip 形式展示已保存兴趣
   - 超过 2 行时折叠，并提供“展开更多”
3. `Compact Edit Area`
   - 默认展示单行摘要或较短 textarea
   - 保存按钮与说明提示靠近输入区底部

约束：

- 默认高度必须显著小于当前版本。
- 桌面端不允许再出现横向铺满的大表单感区域。
- 未编辑时，模块应更像一个设置摘要卡，而不是长期展开的配置面板。

#### 18.6.3 编辑交互

- 默认态优先展示已保存兴趣与说明，不默认展开完整编辑姿态。
- 引入“内联编辑”或“命令面板（Command Palette）”式交互。用户点击“编辑”后，原位转变为带有智能光标聚焦的 tag-input（标签式输入）加次级 textarea。
- 强化键盘操作工作流：支持 `Cmd/Ctrl + Enter` 保存，支持 `ESC` 取消，为极客用户提供无缝的配置体验。
- 保存成功反馈使用内联淡出 success toast / notice，不额外撑高整体布局，不阻断用户阅读。
- 清空兴趣时明确提示“将关闭个性化兴趣加权”，使用柔和动画收起相关区域。

#### 18.6.4 布局规格

- 桌面端推荐宽度为 `360px` 到 `480px` 的侧向卡片，或作为 Overview Hero 区右侧辅助卡。
- 若放在单列流中，卡片内容宽度仍需受限，避免 textarea 撑满整行。
- 文案说明最大宽度不超过正文阅读宽度，避免长句横跨整块面板。

### 18.7 微型可视化（Micro-Visualization）注入

系统名为 Trend Radar，为体现“趋势”感，必须在纯文本和列表之外，克制地引入微型可视化元素：

- `Inline Sparklines`（行内迷你折线/柱状图）
  - 针对项目长期的 Score 趋势或 Star Delta 轨迹，在项目列表或详情边缘提供尺寸极小（如 `16px * 60px`宽）的 SVG 趋势微图。
  - 仅作为视觉补充，悬停时不显示复杂 Tooltip，意在传达“上升/震荡/下降”体感。
- `Radar Rating Hexagon`（极简能力/维度雷达）
  - 对 Project KB 中的能力项或多维得分，使用低对比度、半透明度填充的单色 SVG 雷达图（非粗犷彩色）。
- `Sentiment/Freshness Heat Bar`
  - 将日期或版本的 freshness 用紧凑的方块颗粒（类似 GitHub Contributions 图）进行水平平铺表现，替代单调的文本“近期更新”。

### 18.8 五个一级视图的美化一致性

本次改版不是只优化 Overview，五个一级视图都应遵循一致设计语言：

- `Overview`
  - 更像“今日判断首页”，强调信任摘要、重点项目和下一步动作。
- `Projects`
  - 更像“研究列表 + 右侧详情”的分析工作台，弱化传统表格后台感。
- `Weekly`
  - 更像“周报编辑页”，突出趋势卡片、证据摘要和 supporting projects。
- `Run Health`
  - 更像“系统体检页”，可以更冷静、更结构化，但仍保持同一品牌语气。
- `Knowledge Base`
  - 更像“阅读器”，机器区与人工区通过底色、边框和标题语义清晰分离。

### 18.9 响应式与可访问性要求

- 小屏设备下，Header、Context Strip、Status Banner 必须可折叠重排。
- 详情面板进入全屏态时，关闭与返回路径必须始终可见。
- 所有状态颜色必须在不依赖颜色的情况下仍可识别，需搭配标签文案。
- 输入框、按钮、chip 和链接必须有明确 focus 态（如基于 CSS `:focus-visible` 画出柔和的外层光晕环）。
- 中文长文本与英文 repo 名混排时，需保证断行与字距稳定，不出现按钮被长 repo 名挤爆的问题。

### 18.10 实施优先级

视觉改版建议按以下顺序实现：

1. 先统一 design tokens（包含 Dark/Light 体系）、字体栈和版线宽度。
2. 再改 Header / Context Bar / Status Banner 的整体骨架和毛玻璃应用。
3. 然后收敛 `兴趣方向` 模块为紧凑设置卡，增加内联交互。
4. 逐页细化视图。最后阶段针对需要体现“Trend”的项目加入微型图表 (Sparklines)。

### 18.11 验收标准

视觉改版完成后，至少应满足：

- 用户进入首页时，首屏不再被大块表单和均质卡片占满，深浅色模式切换丝滑无卡顿。
- `兴趣方向` 在默认态下不再是页面中面积最大的模块之一，而是高级感强的短卡配置。
- 页面在 `1440px+` 桌面宽度下仍保持阅读聚焦，留白和阴影（Depth）构建明确视觉层级。
- 五个一级视图在导航、上下文、卡片、详情栏上呈现统一的 Vercel/Linear-like 前沿风格。
- 状态、可信度、项目结论与趋势内容仍保持前文冻结的信息优先级，不因美化而牺牲可判断性。

### 18.12 浏览器交互与性能修复补充（2026-05-04 Addendum B）

本节补充本轮视觉改版后暴露出的 5 个具体交互问题。目标不是推翻前文的视觉方向，而是把“滚动行为、详情承载、文案清晰度、切换性能、KB 阅读价值”冻结为更严格的浏览器实现契约。

#### 18.12.1 问题 1：可视控制台头部跟随页面下滑，持续遮挡阅读视线

当前问题成因：

- 当前实现把 `App Header` 设计成桌面端 `position: sticky`，在长页面和阅读型场景下会长期占据视窗顶部。
- 视觉改版引入了毛玻璃和浮层质感后，悬浮头部的存在感比旧版更强，遮挡感被进一步放大。
- 该行为更适合“高频导航面板”，不适合当前以阅读、比较和详情钻取为主的工作台。

设计修复：

- 桌面端一级 Header 默认改为 **静态占位，不跟随正文滚动**。
- 仅保留轻量级的页内导航可达性，不再要求 Header 在用户下滑时始终悬浮。
- 若后续确有快速导航需求，只允许引入“滚动上返时出现、向下滚动时收起”的低干扰 compact header，不能回退为永久 sticky。

约束：

- `App Header` 与 `Detail Surface` 不得同时在桌面端采用强悬浮 sticky 策略。
- 首屏之外，任何全宽壳层都不得持续压住正文阅读区顶部。

验收标准：

- 在桌面宽度下，用户连续下滑至长列表或 KB 正文时，顶部导航不再长期覆盖正文阅读视野。
- 页面可见区域中的最高优先级对象应是当前内容，而不是导航壳层。

#### 18.12.2 问题 2：详情承载区不能独立滚动，滚轮被主页面接管

当前问题成因：

- 当前实现虽然把详情放入右侧分栏，但没有把详情列冻结为独立滚动上下文。
- 详情列采用 sticky 定位后，其内部卡片高度继续随内容增长，却没有明确的 `max-height`、`overflow-y` 和滚动边界。
- 浏览器滚轮事件最终落到页面根滚动容器，导致用户鼠标位于详情区时，实际滚动的是主页面而非详情内容。

设计修复：

- 桌面端 `Detail Surface` 冻结为 **独立滚动容器**：
  - 详情列自身固定在视窗内可见高度范围。
  - 详情列内部使用 `overflow-y: auto`。
  - 主内容区与详情区形成两个并列滚动上下文。
- 详情头部可保留在详情容器内部顶部，但仅作为详情容器内部的局部 sticky，而不是相对整页 sticky。
- 窄屏下继续退化为全屏详情页样式，但必须保证全屏详情页自身可顺畅滚动。

约束：

- 鼠标位于详情区时，滚轮、触控板滚动、PageDown 等行为必须优先作用于详情区，直到详情区滚动到边界。
- 不允许出现“详情区视觉上像阅读器，交互上却只是整页一部分”的伪承载区。

验收标准：

- 在 `Projects`、`Weekly -> supporting project`、`KB` 三类详情场景下，详情内容超出一屏时可独立滚动。
- 主页面列表位置在阅读详情期间保持稳定，不因详情区阅读而被意外带走。

#### 18.12.3 问题 3：项目列表与来源健康摘要中出现大量 `?` 分隔符，造成歧义

当前问题成因：

- 当前模板把多个元字段直接拼接为单行摘要，并使用 `?` 作为视觉分隔符。
- `?` 同时天然带有“不确定”“待确认”的语义，会与 `confidence`、`source health`、`judgeable` 等真实业务字段冲突。
- 在中英文混排场景下，`?` 也会放大 artifact 文本本身可能存在的清洗问题，让用户误以为底层数据缺失或异常。

设计修复：

- 冻结一条规则：**展示层不得把 `?` 用作信息分隔符**，除非它真的是原始文本中的问句语义。
- 项目列表中的 `confidence / paradigm / persistence` 改为以下任一结构化表达：
  - badge/chip 组
  - definition list / key-value 行
  - 使用 `·`、`/`、`｜` 等中性分隔符的语义清晰单行
- `Source Health Summary` 中的 `enabled / count` 等字段必须改为明确标签对，例如：
  - `启用：是`
  - `数量：59`
- 所有 artifact 文本进入 UI 前必须经过统一 display-normalization：
  - 去除占位问号
  - 修复 mojibake 后再渲染
  - 对空值使用 `无 / none / unavailable` 等已冻结词汇，不允许以问号代替空值

约束：

- UI 中的标点不能承担状态语义。
- 字段分隔必须可被用户一眼解释为“并列信息”，而不是“字段缺失”或“结果存疑”。

验收标准：

- `Projects` 列表和 `Source Health Summary` 中不再出现人为拼接出来的 `?` 分隔符。
- 用户不会把展示层标点误读为数据缺失、推理不确定或翻译失败。

#### 18.12.4 问题 4：模块切换延迟明显变长，尤其切到 `Projects` 时卡顿

当前问题成因：

- 当前实现仍以“服务端重新构造整页 HTML”作为主要切换路径，每次一级路由切换都会重建 Header、Context、Banner、Primary Content 与 Detail Surface。
- `Projects` 列表渲染时为每个项目同步读取多日 `scores/*.json` 以生成 sparkline，导致单次请求包含大量重复文件读取和 JSON 解析。
- 详情切换时还会重新生成整页，而不仅仅是更新右侧详情区。
- 当前前端仅保留了少量 scroll 恢复逻辑，没有建立页面级缓存、预取或局部更新机制。

设计修复：

- V1.1 浏览器实现冻结为 **“路由可寻址 + 内容增量更新优先”**：
  - 一级视图切换允许保留 URL 变化，但应优先局部更新主内容区，而不是每次整页重建。
  - 详情切换优先局部更新 `Detail Surface`，不重新渲染整页壳层。
- sparkline 数据必须从“渲染时逐项目逐日期读取”改为以下任一方案：
  - 在读取层一次性批量加载当日所需 `scores` 数据后复用
  - 在构建 artifact 时预计算轻量 trend points
  - 为同一请求建立内存级 memoization，禁止重复同步读盘
- 对高成本但非关键的视觉增强采用延迟策略：
  - 列表主文本、得分、风险先渲染
  - sparkline、hexagon 等微型图形可延后注入或按需渲染
- 视图间切换应支持预取相邻一级视图所需的最小数据集，减少首次切换等待。

约束：

- 性能优化不得改变 artifact-first 边界，不允许为提速而在前端重算趋势、评分或结论。
- 微型可视化必须服从“主信息先可读、装饰信息后补齐”的优先级。

建议指标：

- 桌面本地环境下，一级视图切换目标为“主内容可见更新”低于 `150ms`，`Projects` 视图低于 `250ms`。
- 详情切换目标为“右栏内容开始更新”低于 `100ms`。

验收标准：

- 从 `Overview` 切到 `Projects`、`Weekly`、`KB` 时，用户感知不再是整页卡住后一次性跳变。
- `Projects` 视图不再因为 sparkline 或重复读盘成为最明显的性能瓶颈。

#### 18.12.5 问题 5：知识库详情承载区像玩具，阅读价值不足

当前问题成因：

- 当前 KB 详情基本是把解析后的 section 直接顺序堆叠到右栏，缺少“阅读器”级别的信息编排。
- `Card Reader / Machine Section / Human Section / Linked Context` 仍停留在字段展示层，没有形成“摘要 -> 证据 -> 价值 -> 回链”的阅读顺序。
- 右栏宽度虽适合短摘要，但对中长篇 KB 正文、要点提炼和证据引用来说仍缺少足够的文本组织能力。
- 机器区与人工区虽然已分组，但缺少内容降噪、重点抽取、锚点导航和引用结构，导致信息价值被原始结构抵消。

设计修复：

- `Knowledge Base` 详情承载区升级为 **可阅读的右栏研究卡片 + 正文阅读器混合体**，固定采用以下层次：
  1. `Reader Header`
     - 项目名、repo 链接、更新时间、范式标签
  2. `Executive Summary`
     - 2 到 4 条来自 KB artifact 的高价值摘要句
     - 明确回答“这是什么、为什么值得读、适合继续追什么”
  3. `Machine Notes`
     - 保留机器区，但按主题折叠为短段落或要点列表
     - 默认优先展示 `Summary / Why It Matters / Signals / Risks / Next Watch`
  4. `Human Notes`
     - 若存在人工区，提升为更接近正文阅读器的样式，强调段落宽度、层级标题和引用块
  5. `Linked Context`
     - 展示与当前 daily / weekly / project 上下文的关系，而不是只显示更新时间和范式
- KB 详情必须支持“先读摘要，再下钻原文”的两段式阅读路径，避免用户一进入就面对低密度原始片段。
- 若右栏宽度不足以承载高价值阅读，应允许 KB 详情在桌面端切换到更宽的 reader mode，不能被固定窄栏永久限制。

约束：

- KB 阅读增强仍然只能基于现有 KB artifact 组织与排序，不得在 UI 层发明新的知识结论。
- “更有阅读价值”指的是更好的信息编排、摘要优先级和引用结构，不是添加装饰性组件。

验收标准：

- 用户进入 KB 详情后，首屏即可读到摘要、价值判断与上下文关联，而不是只看到字段罗列。
- 机器区与人工区的区别更加清晰，且都具备实际阅读价值。

#### 18.12.6 本补充对应的实现优先级

1. 先修复桌面端 Header 与 Detail Surface 的滚动契约，消除遮挡和错误滚动。
2. 再修复项目列表与来源健康摘要中的问号分隔和空值展示规则。
3. 然后处理 `Projects` 视图切换性能，优先移除重复同步读盘与整页重建。
4. 最后升级 KB 详情阅读器结构。

#### 18.12.7 本补充的回归验证

- 桌面端长页滚动时，Header 不再持续悬浮遮挡正文。
- `Projects`、`Weekly`、`KB` 的详情承载区都可独立滚动。
- 项目列表、来源健康摘要、KB 相关元信息中不再出现人为 `?` 分隔符。
- 一级视图切换和详情切换的体感明显快于本轮视觉改版后的版本，尤其是 `Projects`。
- KB 详情首屏具备明确阅读价值，而不是字段堆砌。

## 19. 实现就绪结论

这份设计在本次 Web addendum 后已经明确了：

- weekly 是独立一级消费视图，而不是附属入口
- 控制台的统一上下文模型、状态模型和优先级
- 各视图的固定目标、输入、模块与边界
- source empty / failed、rules-only / fallback、weekly audit 缺失、无趋势周等关键失败路径
- artifact 所有权、读取层职责与不可越界边界
- 跨视图一致性与钻取契约
- 与需求验收逐条对应的测试设计
- 浏览器承载骨架、详情承载形式、URL / query 规则、刷新恢复行为与本地启动地址协议

因此后续可以直接进入浏览器版 ExecPlan，而不需要在实现阶段继续猜：

- weekly 到底是不是独立视图
- latest 能不能替代明确日期 / 时间窗
- 空态、失败态、降级态如何区分
- run health 缺失时能否静默展示榜单
- weekly 没有稳定趋势时是否强行凑卡片
- UI 是否允许重算业务结论
- 详情是临时抽屉、弹窗还是 URL 可寻址面板
- weekly -> project、project -> kb 到底如何编码上下文
- 刷新页面后是否应该恢复 `date / anchor / trend_key / project / slug`
