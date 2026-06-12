# 设计文档：项目搜寻体系重塑

## 文档状态

- 版本：`v0.3`
- 状态：`Approved`
- 批准备注：`2026-06-12 design review 通过；需求文档已处于 READY，且本文已冻结产品表面、目录策略、数量门槛、状态机、降级语义、兼容契约与验收口径，可直接进入 ExecPlan。`
- 设计输入：
  - [项目搜寻体系重塑需求分析.md](../product-specs/项目搜寻体系重塑需求分析.md#L1)
  - [signal-filter-action-version-design.md](signal-filter-action-version-design.md#L1)
  - [daily-report-freshness-readability-design.md](daily-report-freshness-readability-design.md#L1)
  - [ecosystem-focused-observer-design.md](ecosystem-focused-observer-design.md#L1)
  - [architecture-boundaries.md](architecture-boundaries.md#L1)
- 外部模式启发：
  - [GitHub Explore](https://github.com/explore)
  - [Topics on GitHub](https://github.com/topics)
  - [Apple App Store Discoverability](https://developer.apple.com/app-store/discoverability/)
  - [Apple App Store Getting Featured](https://developer.apple.com/app-store/getting-featured/)
  - [Spotify Discover Weekly Turns 10](https://newsroom.spotify.com/2025-06-30/discover-weekly-turns-10-celebrating-100-billion-tracks-streamed-and-a-decade-of-personalized-discovery/)
  - [Spotify Release Radar](https://newsroom.spotify.com/2021-09-08/spotifys-release-radar-personalized-playlist-celebrates-five-years-and-16-billion-streams/)
- 目标：在不把产品改造成黑盒推荐流的前提下，把当前偏“全局热榜”的项目发现链路重构为一个**覆盖优先、数量有硬下限、可解释的双栈发现产品**：它既能告诉用户“今天整个生态发生了什么”，也能稳定回答“我当前想找的行业 agent / agent 应用方向有没有被认真搜索、有没有命中、缺口在哪里”，并且通过正式的目录扩张与数量目标，显著提升用户搜到感兴趣项目的概率。

## 一句话设计

把当前“单条混合热榜”重构为一个稳定的三段式发现体验，并把“搜得更多、搜得更广”写成实现层无法回避的硬约束：

1. `今日全局脉冲`：回答“今天整个 Agent 生态最值得看的变化是什么”。
2. `与你当前任务更相关`：回答“你关心的行业 / 任务型 agent 方向今天有没有真实命中”。
3. `方向缺口账本`：回答“哪些方向我们已经主动搜索，但今天依然没有足够可信结果，以及为什么”。

这三部分不共享同一套榜单语义，不把需求相关性偷偷混进全局热度，也不再用历史补位伪装成“今天有结果”。

## 设计 Thesis

本次不是“让热榜更聪明一点”，而是把产品从“热点列表”升级成“发现工作台”。

用户真正需要的不只是更大的榜单，而是“更高命中率的可搜索项目池 + 更稳定的发现心智”：

1. 我先看今天大盘到底发生了什么。
2. 我再看我当前关心的任务方向今天有没有新东西。
3. 如果没有，我要明确知道系统已经搜过，而且知道缺的是哪一层信号。

因此本设计的核心不是再加一个分数，而是把“项目数量与垂直覆盖率不足”当成第一问题来设计，并建立一个更清晰的产品表面：

- 对全局趋势，像编辑式发现页一样给用户一个可信入口。
- 对任务型需求，像 topic / category / mission board 一样给用户明确的方向承接。
- 对空白与缺口，像运营面板一样给用户“已覆盖 / 未覆盖 / 覆盖失败”的正式语义。

## 第一约束：覆盖优先于运行成本

这次改造的最高约束不是“先把成本做轻”，而是：

> **先把用户能搜到的项目数量和垂直覆盖率做上去，运行成本是第二约束。**

原因很直接：

1. 当前系统最大的失败不是“搜得太重”，而是“搜得不够广、不够深、可消费项目太少”。
2. 如果实现层只需要证明“16 个方向都扫过一遍”，那最后很容易得到的是形式覆盖，而不是用户能感知到的命中率提升。
3. 对于智能导购、电商运营、股票研究、金融分析这类方向，市场里并不缺优质 agent，缺的是系统化收集、持续扩搜和正式纳入。

因此，所有搜索策略都必须遵循一个硬规则：

- 只要数量目标和方向库存目标没有达标，就不能因为“今天已经跑过一轮”而结束。
- `已执行搜索` 不等于 `覆盖完成`，只有达到方向与整体数量门槛，才算当天真的完成覆盖任务。

## 为什么不能继续修单榜

如果继续沿着 `today_star` 单榜做权重调参，会反复踩中同一类问题：

1. 需求相关性会被偷偷写进全局热度，用户无法理解榜单在表达什么。
2. 头部项目去重会退化成“看起来有变化”，但不一定真帮用户发现新方向。
3. 行业 agent 应用会继续停留在需求分析里的“例子”，而不会成为真正冻结的产品目录。
4. 搜不到结果时，产品只能给沉默空白，无法建立信任。

本设计的任务不是“让榜单稍微更合理”，而是重新定义这个产品如何被消费。

## 模式转译

这份设计不是照搬外部产品，而是吸收了三类成熟模式：

### 1. GitHub 的显式主题发现模式

GitHub 的 `Explore / Topics / Search qualifiers` 说明，一个好的发现系统必须有**显式主题面**和**可审计的查询入口**，而不是只靠一个神秘总榜。

本设计转译为：

- 显式 `方向目录`
- 每个方向可审计的 `query template`
- 方向级覆盖状态
- 从 observer 方向向正式目录的升级机制

### 2. App Store 的“编辑式总览 + 意图式搜索承接”

App Store 把 “Today / Discover” 和 search intent 承接开来，说明一个好的发现产品必须同时服务：

- 今天最值得看什么
- 我此刻要找什么

本设计转译为：

- `今日全局脉冲`
- `与你当前任务更相关`

两者语义独立、价值并列。

### 3. Spotify 的“稳定回访节奏 + 个性化发现通道”

Spotify 的 `Discover Weekly / Release Radar` 说明：真正驱动回访的不是抽象“多样性”，而是**稳定的发现节奏 + 新鲜变化感 + 与我有关**。

本设计转译为：

- 全局脉冲中的 `anchor seats + challenger seats`
- 任务方向中的 `mission lanes`
- 方向缺口的正式账本化表达

也就是说，本产品的“回访感”不是靠堆随机性，而是靠一套每天都成立的发现语法。

## 用户心智与产品表面

用户应该能在 10 秒内学会一句话：

> 先看今天大盘，再看我的任务方向，再看系统今天还缺什么。

为此，daily 的产品表面固定为：

1. `数据新鲜度总状态`
2. `今日全局脉冲`
3. `方向覆盖总览`
4. `与你当前任务更相关`
5. `方向缺口账本`
6. `历史补充观察`

其中：

- `今日全局脉冲` 是项目卡片区，回答“今天生态层面发生了什么”。
- `方向覆盖总览` 是方向级状态条带，回答“今天系统认真搜了哪些方向”。
- `与你当前任务更相关` 是真实需求命中区，只承载真实命中。
- `方向缺口账本` 是方向级无结果与弱结果区，不伪装成项目推荐。
- `历史补充观察` 只保留 context，不再与当日发现竞争。

## 目标到机制映射

这次设计不接受“目标都写到了，但具体靠什么达成不清楚”的文档写法，因此四类核心目标在设计阶段直接冻结为以下承接关系：

### 1. 覆盖率

不是“形式上抓过更多候选”，而是“更多必须覆盖的方向被正式扩搜，且用户关心的方向长期有足够项目库存可被命中”。

- 机制：`16 个 must-cover 方向全量扩搜` + `方向级数量门槛` + `滚动项目库存目标` + `方向覆盖总览` + `方向缺口账本`
- 用户可见证据：用户每天都能看到各方向是 `matched`、`weak_signal`、`zero_candidate` 还是 `search_failed`，并且这些方向不是只有“搜过”，而是有持续扩张中的候选和库存

### 2. 新鲜度

不是“随机换一些卡”，而是“让今天的主视野对今天真的更敏感”。

- 机制：`anchor/challenger` 双席位 + `head saturation demotion` + `explore_ribbon`
- 用户可见证据：连续多日回访时，核心区仍会出现新的挑战者，而不只是熟知头部项目重复出现

### 3. 多样性

不是加一个“多样性榜单”，而是让不同类型结果在同一次消费里真正可感知。

- 机制：`global pulse` 与 `mission match` 双栈分语义 + 任务区方向/家族公平约束 + challenger 位
- 用户可见证据：同一次浏览里，用户能分辨“全局热点”“我关心方向的命中”“今天的新挑战者”三种不同价值

### 4. 转化与留存

不是单纯调排序，而是减少“找不到、看不懂、不再回来”的三个流失点。

- 机制：`与你当前任务更相关` 独立命中区 + `Gap Ledger` 无结果语义 + `gap pressure` 反馈闭环
- 用户可见证据：任务型用户更快看到值得点开的命中；即使命中不足，也能知道系统今天搜过什么、缺口在哪里，并在后续回访中看到系统响应

## 需求对齐摘要

| 需求分析项 | 本设计的核心承接机制 |
| --- | --- |
| 覆盖率 = 方向覆盖 + 需求覆盖 | `全量 coverage sweep + 深搜命中 + 方向覆盖总览 + 缺口账本` |
| 覆盖率不能被实现层偷换成“跑过一遍” | `每方向查询下限 + 候选下限 + 滚动库存下限 + 未达标自动扩搜` |
| 区分全局热度和用户想看 | `今日全局脉冲` 与 `任务命中区` 双栈 |
| 限制头部项目长期挤占 | `anchor/challenger` 席位 + `head saturation demotion` |
| 多样性是用户可感知差异 | `challenger seats`、方向家族分布、任务区公平约束 |
| 支持垂直需求方向发现 | `V1 must-cover 目录冻结 + coverage-sweep/deep 双层发现` |
| 解释为什么出现 / 没出现 | `appearance reason` + `direction gap outcome` |
| 建立未满足需求反馈闭环 | `gap pressure ladder` + `observer -> catalog promotion` |
| 扩展后仍可审计 / 可降级 | `rules-first`、文件系统产物、方向级状态机、独立降级语义 |

## V1 硬性数量目标

本设计明确采用“双目标”约束：既要求方向覆盖，也要求项目数量。

只满足其中一个，都不能算成功。

### 1. 方向级搜索下限

- 每个 `must-cover` 方向每天至少执行 `3` 组 `query packs`
- 每组 `query pack` 至少包含 `2` 个独立 `query template`
- 每个方向每天至少要覆盖以下三类搜索意图：
  - `canonical agent lane`：标准 agent / copilot / automation 表达
  - `job-to-be-done lane`：用户任务表述，例如“股票研究”“导购转化”“客服工单处理”
  - `user-speak / industry-software lane`：更接近用户口语和行业软件生态的表达

### 2. 单方向候选下限

- 每个 `must-cover` 方向单日最低目标：
  - `raw_hits >= 20`
  - `normalized_hits >= 6`
  - `quality_passed_hits >= 2`
- 如果任一门槛未达到：
  - 不允许只标记“今天已 scout”
  - 必须自动追加 query variants、来源扩展或 lane 扩展，直到达到门槛，或正式进入 `zero_candidate + reason_code=search_exhausted`

### 3. 滚动项目库存下限

- `rolling_30d searchable catalog >= 300` 个去重后的合格项目
- 其中 `vertical / task-oriented projects >= 180`
- 每个 `must-cover` 方向 `rolling_30d qualified projects >= 12`

### 4. 新增量目标

- `rolling_7d` 至少新增 `30` 个 `qualified non-head projects`
- 如果连续 `7` 天未达到新增量目标，必须触发：
  - `source expansion review`
  - `direction seed refinement`
  - `observer promotion review`

### 5. 完成定义

当天 mission discovery 只有在以下条件同时成立时才算“完成”：

1. 全部正式方向都产生了方向状态
2. 全部正式方向都达到最小搜索下限，或被正式标记为 `zero_candidate + reason_code=search_exhausted` / `search_failed`
3. 滚动项目库存没有跌破全局与方向级下限

否则，系统应把该日视为“覆盖任务未达标”，而不是简单视为“任务已跑完”。

## 范围

### 包含

- 将项目发现从“单榜单”重构为“双栈发现 + 缺口账本”
- 冻结 V1 的 `must-cover` 行业 agent 应用目录
- 引入 `scout / deep` 双层方向发现
- 重构 global / demand exposure 语义
- 引入 `方向覆盖总览`
- 重构 `无结果语义`，区分“没有候选”“只有噪声”“有候选但不够格”
- 引入方向压力与 observer 升级机制
- 扩展 daily JSON / Markdown / visual console 的方向级与席位级字段

### 不包含

- 不重做底层 `ScoreComponent` 框架
- 不把 LLM 变成最终排序裁判
- 不把 observer-only 结果直接混入主榜
- 不引入“多样性结果”第三正式项目区
- 不做完整用户画像系统或前端偏好配置台
- 不扩张为泛软件资讯平台

## 非目标

- 不追求“一次就覆盖所有行业软件”
- 不把所有方向都深搜到底
- 不允许历史 fallback 伪装成当天命中
- 不把行业方向命中与客观全局热度混成不可解释黑箱

## 必须保持不变的边界

- 主产品仍是 `agent-related project radar`
- `rules-first scoring` 不变，LLM 只做语义与分类辅助
- `ecosystem observer` 仍是 observer，不是主榜直接来源
- 文件系统仍是 V1 默认审计存储
- `global_hot` 和 `demand_relevant` 的主语义边界必须保留

## 核心重新定义

### 1. 覆盖率

本设计中，`覆盖率` 被拆成两个不同但必须同时成立的维度：

- `目录覆盖（catalog coverage）`
  定义：V1 冻结目录中的方向，今天是否都被系统执行到了最低搜索下限，而不是只跑过一轮形式 `scout`
- `需求满足（demand fulfillment）`
  定义：当前进入 mission 计算的激活方向里，是否形成了真实、可展示、可解释的命中结果

只有 `catalog coverage + demand fulfillment` 同时可见，产品才算真的在“搜得更广”。

### 2. 发现层

本设计不再只有一个发现层，而是三条并行链路：

1. `global pulse discovery`
   - 继续发现全局热点
2. `mission scout discovery`
   - 对 V1 冻结目录做覆盖优先的全量扩搜，确保每个方向都有足够候选进入判断
3. `mission deep discovery`
   - 对重点方向和未达标方向继续深挖，直到形成可展示命中或正式缺口结论

### 3. 结果层

项目层正式结果仍只有两块主语义：

- `global_hot`
- `demand_relevant`

但方向层会新增两个正式审计面：

- `coverage_atlas`
- `gap_ledger`

这样多样性来自产品结构，而不是凭空加第三个“多样性榜单”。

## 总体架构

```text
Global Pulse Signal -----------------------------\
Mission Scout Discovery ------------------------- -> Normalize -> Objective Score -> Exposure Planner -> Daily Output
Mission Deep Discovery --------------------------/
Observer Incubation ----------------------------/
                                                   ^
                                                   |
                                     Gap Pressure / Feedback Aggregator
```

### 主原则

1. `objective_score` 仍是客观判断底座。
2. 需求相关性不写入 `objective_score`，只影响发现与曝光层。
3. 目录覆盖与需求满足必须分开表达。
4. observer 只能提供 incubating direction 和辅助证据，不能越权进入主榜。
5. “今天没有结果”必须是正式产品输出，不是运行日志。

## V1 必覆盖目录冻结

### 目录设计原则

V1 不再用“例：智能导购、股票研究、金融分析……”这种松散写法，而是冻结一张正式目录。

这张目录满足三条原则：

1. 覆盖用户高频任务型需求
2. 覆盖跨行业 agent 应用，而不只覆盖通用 infra
3. 仍然收敛在 `agent / automation / intelligent software` 问题空间内

### V1 正式 must-cover 目录

| 家族 | direction_key | 中文名称 | boundary_mode | 默认深度 | 主要回答的问题 |
| --- | --- | --- | --- | --- | --- |
| core-agent-work | coding-agent | 开发与编码代理 | `strict-agent` | `deep-daily` | 今天有没有新的 coding agent / review / patch 代理值得看？ |
| core-agent-work | browser-computer-use | 浏览器 / 桌面执行代理 | `strict-agent` | `deep-daily` | 今天有没有新的 browser/computer-use agent 值得看？ |
| core-agent-work | workflow-automation-agent | 行业工作流执行代理 | `workflow-intelligence` | `deep-daily` | 有没有把多步流程真正代理化的新产品？ |
| core-agent-work | research-knowledge-agent | 研究与知识工作代理 | `workflow-intelligence` | `deep-daily` | 有没有真正可替代研究/整理工作的 agent 型产品？ |
| revenue-commerce | shopping-commerce-agent | 智能导购与电商运营代理 | `workflow-intelligence` | `deep-daily` | 电商、导购、商品运营场景里今天有没有新 agent？ |
| revenue-commerce | sales-prospecting-agent | 销售拓客与线索运营代理 | `workflow-intelligence` | `deep-daily` | 销售、线索发现、外呼辅助场景有没有新 agent？ |
| revenue-commerce | customer-support-agent | 客服与服务台代理 | `workflow-intelligence` | `deep-daily` | 客服、工单、支持场景里有没有更强 agent？ |
| revenue-commerce | marketing-content-ops-agent | 营销内容与增长运营代理 | `workflow-intelligence` | `scout-daily` | 营销、投放、内容流水线里有没有新 agent？ |
| analysis-professional | finance-investment-research-agent | 金融分析与投研代理 | `regulated-specialist` | `deep-daily` | 投研、金融分析、决策辅助场景有没有新 agent？ |
| analysis-professional | data-analytics-bi-agent | 数据分析与 BI 代理 | `workflow-intelligence` | `deep-daily` | 数据分析、报表、业务分析场景有没有新 agent？ |
| analysis-professional | legal-compliance-agent | 法务与合规代理 | `regulated-specialist` | `scout-daily` | 合同、审查、合规流程里有没有真正可用 agent？ |
| analysis-professional | security-soc-agent | 安全运营与安全审计代理 | `regulated-specialist` | `scout-daily` | SOC、安全审计、告警处置里有没有新 agent？ |
| vertical-ops | healthcare-ops-agent | 医疗服务与临床运营代理 | `regulated-specialist` | `scout-daily` | 医疗服务流程、文书、患者运营里有没有 agent 化产品？ |
| vertical-ops | recruiting-hr-agent | 招聘与人力运营代理 | `workflow-intelligence` | `scout-daily` | 招聘筛选、候选人运营、人力流程里有没有新 agent？ |
| vertical-ops | supply-chain-procurement-agent | 供应链与采购代理 | `workflow-intelligence` | `scout-daily` | 采购、供应链协同、对账流程里有没有新 agent？ |
| vertical-ops | industrial-field-ops-agent | 工业 / 现场运维代理 | `workflow-intelligence` | `scout-daily` | 工业现场、巡检、运维流程里有没有 agent 化产品？ |

### 目录解释

这张目录不是“能想到的行业都列上”，而是四个家族、十六个方向的第一版冻结：

- `core-agent-work`：承接 agent 原生工作面
- `revenue-commerce`：承接营收与前台业务场景
- `analysis-professional`：承接高价值分析与专业服务场景
- `vertical-ops`：承接更重流程、更重组织协同的行业应用场景

这样做的价值是：

- 用户能看到“各类行业 agent 应用”被正式纳入
- 实现侧不会再猜 V1 到底要搜哪些方向
- 后续 observer 的发现可以围绕这张目录做有边界的扩张

同时要明确：

- `16 个方向` 是 V1 的**审计底座**，不是产品可覆盖面的上限
- 真正的搜索面应来自 `正式方向 * 多条 search lanes * 持续 promotion 的 incubating directions`
- 如果实现层最终只做出了“16 个标签、每个标签少量探测”，那就仍然没有解决当前项目数量不足的问题

## 目录治理：全量扩搜 + 不达标继续深搜

### 为什么不能把方向覆盖做成轻量探测

当前文档里最危险的实现歧义，是把“每天每个方向都跑一下”理解成“每天每个方向都轻量探测一下”。

这种做法会带来三个直接后果：

1. 实现层会优先追求“全部跑过”而不是“结果变多”
2. 垂直方向会长期停留在“偶尔有苗头，但库存始终上不去”
3. 用户真正想找的方向会继续维持低命中率，因为系统从未被要求把这些方向做厚

因此本设计冻结为两层发现，但第一层不再是“轻量 scout”，而是“有数量责任的 coverage sweep”：

### `coverage-sweep-daily`

作用：

- 每天对所有 16 个 must-cover 方向都执行一次**带下限的覆盖扩搜**
- 保证目录覆盖是**全量、每天发生、且不能低于最小搜索量**

特征：

- 每个方向至少 3 组 `query packs`
- 每组至少 2 个查询模板，覆盖不同用户表述和生态表述
- 不是为了“看一眼有没有”，而是为了把每个方向搜到足以进入正式判断的候选密度
- 如果单方向候选数量不足，必须继续扩搜，而不是直接结束当天任务

### `verification-deep-daily`

作用：

- 对最值得展示的方向，以及数量未达标的方向，继续做正式发现与展示级验证
- 目标不是只挑几个热点做深，而是把“搜得到但还不够厚”的方向做成真正可消费的方向库存

默认 `deep-daily` 方向：

- `coding-agent`
- `browser-computer-use`
- `workflow-automation-agent`
- `research-knowledge-agent`
- `shopping-commerce-agent`
- `sales-prospecting-agent`
- `customer-support-agent`
- `finance-investment-research-agent`
- `data-analytics-bi-agent`

### `rotating-deep`

以下方向默认 `scout-daily`，但可以按规则升级为 `deep`：

- `marketing-content-ops-agent`
- `legal-compliance-agent`
- `security-soc-agent`
- `healthcare-ops-agent`
- `recruiting-hr-agent`
- `supply-chain-procurement-agent`
- `industrial-field-ops-agent`

### 初始激活方向规则

V1 不是把“方向覆盖”留给实现层自由决定，而是在设计阶段直接冻结三层激活结构：

1. `catalog-active`
   - 默认包含全部 16 个 `must-cover` 方向
   - 每天都要执行 `coverage sweep`
   - 这是覆盖率成立的最低保证
2. `deep-active`
   - 默认包含 9 个 `deep-daily` 方向
   - 其余方向可因 `gap pressure`、数量未达标、`coverage sweep` 命中、显式兴趣信号或 observer 强证据升级进入
   - 不再设置会诱导偷懒的固定单日上限；当数量目标未达标时，`deep-active` 必须弹性扩张
3. `incubating-active`
   - 仅存在于 observer 侧
   - 可以被观察、记录、累积证据
   - 但在通过 promotion policy 之前，不进入 `must-cover` 正式目录，也不伪装成 mission 命中

这里的“显式兴趣信号”只允许来自当期可审计输入，例如搜索、收藏、订阅和显式反馈；**不依赖长期用户画像记忆系统**。这与需求分析文档中“先不把完整个性化记忆系统纳入 V1”的冻结边界保持一致。

### 升级为 deep 的条件

方向当日满足任一条件，即进入 `deep`：

1. `gap pressure` 触发
2. `coverage sweep` 阶段命中候选达到升级阈值
3. 用户显式兴趣命中
4. observer 在相关生态里连续提供强证据
5. 方向单日或滚动库存未达到数量下限

### 深搜容量原则

本设计不再接受“单日最多 12 个 deep 方向”这种容易被用来保守收缩的写法。

改为：

`fixed deep-daily > gap-promoted > quantity-deficit-promoted > explicit-interest-promoted > observer-promoted > rotating-deep`

并冻结两条规则：

1. 只要有方向低于数量门槛，`deep` 容量就必须继续向该方向让渡
2. 运行成本可以限制同一时刻并发，但不能作为“不继续补足方向库存”的理由

这样可以同时满足：

- V1 目录全覆盖
- 数量目标真实推动搜索扩张
- 用户真实需求优先

## 方向边界模式

为了避免“所有行业应用都被一个 agent 词门槛挡掉”，方向边界模式冻结为三种：

### 1. `strict-agent`

要求：

- 存在明确 `agent / autonomous / planner / operator / copilot-like executor` 证据

适用：

- coding
- browser/computer-use

### 2. `workflow-intelligence`

要求：

- 同时证明它是软件智能化/自动化系统
- 同时证明它承担的是多步任务/流程执行，而不是普通 SaaS 小功能

适用：

- commerce
- sales
- support
- BI
- recruiting
- procurement

### 3. `regulated-specialist`

要求：

- 满足 `workflow-intelligence`
- 还要有清晰专业领域语义和高价值任务证据
- 不能只是“行业软件 + AI 文案”

适用：

- finance
- legal
- healthcare
- security

### 目录条目的必备字段

```yaml
direction:
  key:
  family_key:
  display_name_cn:
  boundary_mode:
  default_depth:
  scout_queries:
  deep_queries:
  required_terms:
  evidence_verbs:
  evidence_objects:
  negative_terms:
  empty_result_copy_cn:
```

这里新增 `evidence_verbs + evidence_objects`，是为了把“它到底在帮用户做什么任务”显式写进方向定义，而不是只匹配行业名词。

### 每个方向必须冻结的 search lanes

为避免实现层把一个方向压缩成 1 到 2 条保守查询，每个方向除了字段定义，还必须冻结最少 3 类 `search lanes`：

1. `canonical lane`
   - 面向行业内常见 agent / copilot / automation / operator 表达
2. `job-to-be-done lane`
   - 面向用户真正会说出的任务表达，例如“选股研究”“导购转化”“线索筛选”“客服工单分流”
3. `ecosystem lane`
   - 面向该行业真实软件生态、工作流工具、垂直社区和供应商词汇

必要时可追加第 4 类：

4. `adjacent software lane`
   - 面向“原本不是显式 agent 词，但正在被智能化/自动化改造的软件场景”

这样做的目的不是机械增加查询数，而是强制系统覆盖：

- 平台语言
- 用户语言
- 行业语言

只有这三层同时被覆盖，像“最近很火的股票 agent”“电商导购 agent”这类需求才不会因为措辞差异被漏掉。

## 发现策略

### 1. Global Pulse Discovery

保留现有全局热点链路：

- `collectRawSignalsDetailed`
- `normalizeSignals`
- `scoreProjects`

它继续回答：

- 今天整个 Agent 生态里最值得看的变化是什么

### 2. Mission Scout Discovery

新增：

- `src/signal/missionScoutDiscovery.ts`

职责：

- 对 V1 目录全量执行带数量责任的 coverage sweep
- 按方向跑完多类 `search lanes`
- 给每个方向产出正式覆盖状态
- 判断哪些方向已经达标、哪些方向需要继续扩搜、哪些方向升级进入 deep

### 3. Mission Deep Discovery

新增：

- `src/signal/missionDeepDiscovery.ts`

职责：

- 对升级方向和数量不足方向做正式验证
- 生成任务型命中候选
- 产出项目与方向的双层解释证据
- 在方向库存未达标时继续追加 query variants / 来源扩展

### 4. Observer Incubation

复用：

- `ecosystem-focused observer`

职责变化：

- observer 不再只是“长尾展示页”
- 它还承担 `catalog incubator` 角色

也就是说：

- observer 可以发现“现有 must-cover 目录之外但反复出现的方向”
- 但必须通过单独 promotion policy 才能升级为正式 must-cover 目录条目

## 方向结果状态机

为了解决“没搜 / 搜了但没候选 / 搜了但只有噪声 / 搜了但不够格”之间的混淆，本设计重构方向状态：

- `matched`
  - 至少 1 个项目进入正式展示
- `weak_signal`
  - 有规范化候选，但都未通过展示门槛
- `noise_only`
  - 有原始命中，但都属于边界外、误报或低相关噪声
- `zero_candidate`
  - 查询执行成功，但没有形成有效候选
- `search_failed`
  - 查询失败或不可用
- `disabled`
  - 方向未启用

### 用户可见语义

对用户而言，这些状态必须被翻译成人话：

- `matched`：今天这个方向有真结果
- `weak_signal`：今天看到了苗头，但还不够格推荐
- `noise_only`：今天搜过了，但搜到的大多不是你要的那类 agent
- `zero_candidate`：今天认真搜过，但暂时没有找到候选
- `search_failed`：今天这个方向的搜索本身失败了

这比旧的 `searched_but_insufficient_signal` 更符合需求分析文档里要求的区分度。

## 曝光设计

### 核心曝光位仍为 8 个

保留：

- `core exposure slots <= 8`
- `global_hot_quota = 4`
- `demand_relevant_quota = 4`

但 8 个席位内部语义重构。

### Section A：今日全局脉冲

`global_hot_quota = 4`，但内部不再是四张同质卡片，而是：

- `anchor seats = 2`
- `challenger seats = 2`

#### Anchor seats

回答：

- 今天最不该错过的全局变化是什么

候选要求：

- objective_score 高
- fresh source 强
- 可由多源或高置信单源支持

允许头部项目进入，但受 `head saturation` 约束。

#### Challenger seats

回答：

- 除了熟知头部项目外，今天还有哪些新挑战者值得看

候选要求：

- `today_star=true`
- `head_project=false`
- 近期未连续重复占据核心曝光位
- 新鲜度或方向新颖性强

禁止：

- 被饱和头部项目占用
- 被 `context_only` 项目占用

这样，多样性不靠第三榜，而靠全局脉冲内部的“权威席位 + 挑战者席位”。

### Section B：与你当前任务更相关

`demand_relevant_quota = 4`

候选要求：

1. `direction_matches` 非空
2. 通过统一质量门槛
3. 不与 Section A 重复
4. 不属于伪相关补位

### 任务区公平规则

为了防止一个方向把任务区塞满，冻结两条规则：

1. 前 3 个任务席位中，同一方向最多占 1 席
2. 同一家族在整个任务区最多占 2 席

这样用户能真正感知“各类行业 agent 应用都在被看见”，而不是只看见一个方向的堆叠。

### Explore Ribbon：探索补位卡带

如果任务区不足 4 席，允许在 Section B 之后追加 `explore_ribbon_projects`，但它不是第三个正式结果区。
它位于 8 个 `core exposure slots` 之外，只是一个下折叠探索带，不改变核心曝光配额。

要求：

1. `today_star=true`
2. `direction_matches` 为空
3. `head_project=false`
4. 近期未连续重复曝光
5. 明确标注“不是任务命中，只是新鲜探索”

这条卡带只解决“让用户感到今天仍然有新对象可看”，不允许伪装成需求命中。

## 头部项目让位

### 头部判定

保留 exposure-only 语义，不改底层事实。

当项目满足以下条件时，记为 `head_project=true`：

- 最近 5 个完成 daily 中至少 3 次进入 `core exposure slots`
- 且其中至少 2 次位于全局脉冲前半区

### 饱和触发

满足任一条件即 `head_saturation_state=demote`：

1. 连续 3 次进入核心曝光位
2. `no_incremental_value=true`

### 让位行为

1. 仍可进入 `anchor seats`
2. 禁止进入 `challenger seats`
3. 禁止占用任务区
4. 禁止进入 `explore_ribbon_projects`
5. 同日最多 2 个饱和头部保留在全局脉冲中

这样保留真实观察价值，但不再挤占“今天有什么新变化”的叙事。

## Gap Ledger：方向缺口账本

这是本次设计最关键的新产品面之一。

它不是 debug 区，而是正式告诉用户：

- 我们今天搜了哪些方向
- 这些方向为什么没出结果
- 当前缺的是“候选”“质量”还是“边界内信号”

### 账本展示项

每条方向至少输出：

- 方向名
- 家族
- 今日搜索深度：`scout` / `deep`
- 最终状态
- 中文解释
- 原因码
- 推荐下一动作

### 下一动作类型

- `keep_watching`
- `upgrade_to_deep`
- `wait_for_more_signal`
- `needs_human_seed_refinement`
- `observer_promotion_candidate`

这保证“没结果”不是死信息，而是后续产品动作的输入。

## Feedback 闭环：方向压力梯度

本设计不再只做“缺口触发”，而是把未满足需求做成一个方向压力梯度：

### 方向压力状态

- `normal`
- `pressurized`
- `promoted`
- `relieved`

### 进入 `pressurized`

最近 7 天满足任一条件：

1. `explicit_not_found >= 1`
2. `search_zero_result >= 2`
3. `skip_repeated_head >= 3` 且无 `favorite/subscribe`
4. `click_quick_exit >= 3` 且无 `favorite/subscribe`
5. `return_visit_without_satisfaction >= 2`

### `pressurized` 的产品行为

1. 方向默认进入 `deep`
2. 任务区排序优先级上升
3. 若相关 observer 方向持续有信号，则可进入目录 promotion 审查

### 进入 `relieved`

最近 7 天满足任一条件：

1. 至少 2 次 `matched`
2. `favorite + subscribe >= 2` 且快速离开不再增长
3. 回访后 2 次运行内至少 1 次命中并伴随满意消费

这样，留存问题不再停留在口头反馈，而变成可驱动发现策略的正式信号。

## Observer -> Catalog Promotion

为了让设计不是静态目录，本设计新增目录升级规则。

### 升级前提

observer 中某个 incubating direction 满足以下全部条件：

1. 最近 7 天至少 3 次被 observer 命中
2. 与现有 must-cover 目录不重复
3. 有明确 `job-to-be-done` 语义
4. 至少有一类用户反馈或 gap pressure 与其相关
5. 不越出 `agent / automation / intelligent software` 边界

### 升级结果

- 进入下一轮设计审查的 `candidate catalog additions`
- 不允许实现层直接偷加进 must-cover 正式目录

这保证产品可以进化，但目录演进仍然可控。

## 数据契约

### 方向状态契约

```ts
interface DirectionCoverageStatus {
  direction_key: string;
  family_key: string;
  display_name_cn: string;
  boundary_mode: "strict-agent" | "workflow-intelligence" | "regulated-specialist";
  search_depth: "scout" | "deep";
  query_pack_count: number;
  query_template_count: number;
  lane_types: Array<"canonical" | "job-to-be-done" | "user-speak" | "ecosystem" | "adjacent-software">;
  pressure_state: "normal" | "pressurized" | "promoted" | "relieved";
  outcome:
    | "matched"
    | "weak_signal"
    | "noise_only"
    | "zero_candidate"
    | "search_failed"
    | "disabled";
  reason_codes: string[];
  explanation_cn: string;
  next_action:
    | "keep_watching"
    | "upgrade_to_deep"
    | "wait_for_more_signal"
    | "needs_human_seed_refinement"
    | "observer_promotion_candidate";
  candidate_counts: {
    raw_hits: number;
    boundary_passed_hits: number;
    normalized_hits: number;
    quality_passed_hits: number;
    exposed_hits: number;
  };
  quantity_target_met: boolean;
  search_exhausted?: boolean;
}
```

### Daily Report 契约扩展

```ts
today_pulse_projects: Array<DailyExposureProject>;
mission_match_projects: Array<DailyExposureProject>;
explore_ribbon_projects?: Array<DailyExposureProject>;
coverage_atlas: Array<DirectionCoverageStatus>;
gap_ledger: Array<DirectionCoverageStatus>;
```

### 兼容字段

为兼容现有 reader，保留：

```ts
global_hot_projects = today_pulse_projects
demand_relevant_projects = mission_match_projects
searched_direction_statuses = coverage_atlas
```

## 失败与降级行为

### 1. Scout 失败

如果某个方向 `scout` 失败：

- 记为 `search_failed`
- 必须出现在 `coverage_atlas`
- 不允许因为“今天没搜到”而伪装成“今天没有候选”

### 1.5 搜索下限未达标但来源已穷尽

如果某个方向已经完成规定的 lanes、query packs 和扩展重试，但仍未达到数量门槛：

- 记为 `zero_candidate` 或 `weak_signal`
- 必须附带 `reason_code=search_exhausted`
- 必须保留已尝试的 lanes 和查询计数，证明这不是“没认真搜”
- 次日默认进入优先扩搜或 seed refinement 队列

### 2. Scout 成功但 Deep 失败

如果方向完成了 `scout`，但 `deep` 失败：

- `coverage_atlas` 保留 `deep attempted but failed` 的原因说明
- 该方向今天不产生任务区命中
- gap 语义保持可信，不允许回填旧结果伪装深搜命中

### 3. 整个 mission discovery 层失败

如果 mission 层整体失败：

- `今日全局脉冲` 仍可正常产出
- `方向覆盖总览` 和 `方向缺口账本` 明确显示“本次方向发现降级”
- 不允许把 observer 或 context_only 结果提升为需求命中区

### 4. Observer 失败

- 不影响主榜
- 不产生新的 promotion candidate
- 只影响 incubating direction 的证据补充

### 5. 历史 schema 过期

- 标记 `schema_stale`
- 不允许混用旧 snapshot 充当今日方向结论

## 兼容策略

- 保留 `today_star_projects`
- 保留 `global_hot_projects` / `demand_relevant_projects`
- visual console 增加新命名，但旧 reader 仍可读兼容字段
- `context_only_projects` 继续保留在历史补充观察，不参与主视野

## 模块改动建议

建议新增或修改：

- `src/signal/directionCatalog.ts`
- `src/signal/missionScoutDiscovery.ts`
- `src/signal/missionDeepDiscovery.ts`
- `src/feedback/gapPressureAggregator.ts`
- `src/types.ts`
- `src/config.ts`
- `src/action/dailyReport.ts`
- `src/action/runSummary.ts`
- `src/visualConsole/readLayer.ts`
- `src/visualConsole/build.ts`

建议新增数据目录：

- `data/discovery/mission-scout/`
- `data/discovery/mission-deep/`
- `data/coverage/atlas/`
- `data/feedback/gap-pressure/`

## 测试策略

### 单元测试

- 16 个 must-cover 方向每天都执行 `coverage sweep`
- 每个方向都满足 `query_pack_count >= 3` 且覆盖至少 3 类 lanes
- 单方向 `raw_hits / normalized_hits / quality_passed_hits` 数量门槛判断
- `boundary_mode` 三种模式的准入规则
- `anchor / challenger` 席位选择
- 任务区同方向/同家族上限
- `zero_candidate / noise_only / weak_signal` 三类无结果区分
- `pressurized / relieved` 状态切换

### 集成测试

- `run-daily` 同时产出 `today_pulse_projects`、`mission_match_projects`、`coverage_atlas`、`gap_ledger`
- 数量门槛未达标时会自动追加扩搜，而不是提前结束 mission discovery
- 全局脉冲成功而 mission 层失败时，主产品仍可用且语义不失真
- `explore_ribbon_projects` 不混入任务区
- observer 命中不会直接污染主榜

### 回归测试

- 旧 visual console 读取兼容字段不崩溃
- weekly 仍能读取 `today_star_projects`
- `context_only` 历史项目不会补满主视野

### 验收测试

1. 所有 must-cover 方向每天都有正式覆盖状态，不再出现“根本没搜”的灰区。
2. 所有 must-cover 方向都达到最小搜索下限，或明确带有 `reason_code=search_exhausted / search_failed`，不允许出现“只轻量跑过”的伪覆盖。
3. `rolling_30d searchable catalog >= 300`，且 `vertical / task-oriented projects >= 180`。
4. 每个 must-cover 方向 `rolling_30d qualified projects >= 12`；连续低于下限会触发扩搜、seed refinement 或 promotion review。
5. 用户能明确区分“今日全局脉冲”和“与你当前任务更相关”。
6. 智能导购、股票/金融分析、browser agent、coding agent 等方向不再只是例子，而是目录中被冻结并被正式搜索。
7. 连续多日运行后，用户仍能在全局脉冲里看到新挑战者，而不是只看到熟知头部项目。
8. 当方向没有结果时，用户能区分“没候选”“只有噪声”“有苗头但不够格”“认真扩搜后仍未形成候选”。
9. 反复搜不到、跳过、快速离开会推动方向进入 `pressurized` 并升级深搜。
10. mission discovery 层失效时，产品仍能给出可信的全局脉冲，不伪装需求命中。

## 风险与取舍

### 风险 1：覆盖优先会带来更多噪声与算力消耗

缓解：

- 全量 `coverage sweep`，按边界模式过滤，再做展示级验证
- 先扩大搜索，再用数量门槛和质量门槛区分“搜到”与“可展示”
- 三种边界模式
- `evidence_verbs + evidence_objects`
- observer 只做 incubator，不做直通主榜

### 风险 2：任务区看起来像个性化黑盒

缓解：

- 任务区只承载真实 `direction_matches`
- 每张卡必须带方向与原因
- `explore_ribbon` 明确标注不是任务命中

### 风险 3：多样性再次退化成“第三榜单”

缓解：

- 只有两个正式项目区：`今日全局脉冲` 与 `任务命中区`
- 多样性由 `challenger seats`、家族公平、探索卡带实现

### 风险 4：目录被冻结后失去进化能力

缓解：

- observer -> catalog promotion
- 目录升级必须走下一轮设计审批

## 实施就绪判断

本设计已经冻结以下必须写死的产品决策：

- 产品表面：`新鲜度 -> 全局脉冲 -> 覆盖总览 -> 任务命中 -> 缺口账本 -> 历史观察`
- 双栈发现：`global pulse + mission discovery`
- 目录策略：`16 个 must-cover 方向`
- 搜索策略：`全量 coverage sweep + 不达标继续 deep`
- 硬性数量目标：`方向搜索下限 + 单方向候选下限 + 滚动库存下限 + 7 日新增量目标`
- 目录边界模式：`strict-agent / workflow-intelligence / regulated-specialist`
- 核心曝光位：`8`
- 全局 / 任务配额：`4 / 4`
- 全局脉冲内部席位：`2 anchor + 2 challenger`
- 任务区公平规则：前 3 席同方向最多 1，同家族最多 2
- 正式无结果状态：`matched / weak_signal / noise_only / zero_candidate / search_failed / disabled`
- gap pressure 状态：`normal / pressurized / promoted / relieved`
- observer 的新职责：`catalog incubator`，但不直通主榜

因此下一阶段可以直接进入 ExecPlan，而不需要实现者重新做产品级发散。
