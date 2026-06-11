# 设计文档：Daily Report 新鲜度与可读性重构

## 文档状态

- 版本：`v0.1`
- 状态：`Proposed for Review`
- 设计输入：
  - [日报新鲜度与可读性需求分析.md](../product-specs/日报新鲜度与可读性需求分析.md#L1)
  - [agent-trend-radar-product-spec.md](../product-specs/agent-trend-radar-product-spec.md#L1)
  - [signal-filter-action-version-design.md](signal-filter-action-version-design.md#L1)
- 目标：在不改变主评分逻辑的前提下，重构 daily report 的信息结构、新鲜度表达和候选池口径，**使用户先判断“今天这份日报是否新鲜可靠”，再查看“当天明星项目”**。

## 一句话设计

daily report 从“混合展示所有候选及证据”重构为“先给数据新鲜度结论，再只突出本次执行实时拉取得到的当天新鲜候选中的明星项目；历史 fallback 内容只能作为单独的补充观察，不能再伪装成当天热点”。

## 需求对齐映射

| 需求分析项 | 本设计对应章节 |
| --- | --- |
| 首屏优先判断数据是否**新鲜可靠** | `总体信息架构`、`总状态结论设计` |
| fallback 必须在最**显眼位置**提示 | `总状态结论设计`、`失败与降级行为` |
| daily report 应优先看**当天**明星项目 | `候选池分层设计`、`主榜单生成规则` |
| `单日出现项目` 要换成明确中文 | `统计口径重命名` |
| 项目卡片要有人话简介和今日关注理由 | `项目卡片契约` |
| 复杂指标与术语下沉 | `报告层级设计` |
| LLM 不能成为关键判断前置依赖 | `判断链路与依赖边界` |

## 问题定义

当前 daily report 有三个结构性问题：

1. 数据新鲜度被埋在 source notes 中，用户可能读了半天才发现内容来自 fallback。
2. “候选项目总数”“单日出现项目”等统计口径把观测结果和市场结论混在一起，用户容易误读。
3. 每个项目的第一层展示过度偏向工程证据与评分组件，不利于快速浏览。

本设计要解决的是“用户如何正确消费日报”，并纠正当前实现被历史 fallback 带偏的问题；它不重做 scoring，但会明确 daily 主榜单必须以实时发现层为前提。

## 范围

### 包含

- daily report Markdown/JSON 的信息结构重构
- daily report 使用的新鲜度状态模型
- 当天明星项目与历史补充项目的展示分层
- 候选池相关统计口径的重命名与定义
- 项目卡片第一层中文摘要契约
- run summary 向 daily report 暴露的新鲜度输入契约

### 不包含

- 重写 scoring 公式
- 改变 LLM 在系统中的角色
- 新增 GitHub Trending / Trendshift 以外的大型新 source
- 设计新 UI 界面
- 重做 weekly report 或 KB card 的整体结构

## 非目标

- 不追求“所有历史项目都在 daily report 中展示”
- 不把 daily report 变成完整调试审计文件
- 不让 fallback 数据继续参与“当天明星项目”主榜单竞争
- 不把组织级 watchlist 命中本身视为客观趋势加分项

## 现状与关键假设

### 现状

- 当前主评分链路为 `rules-only`
- `agents-radar` 是上游 digest 来源，不是 GitHub 官方实时源
- GitHub metrics / star delta 已具备可信链路，但当前实现更多是在“对已有候选补实时指标”，而不是“用 GitHub / Trendshift 实时发现层生成 daily 主榜单”
- 当前实现仍可能把旧 digest / snapshot 候选混入 daily 主榜单，这与需求目标不一致
- run summary 已有 source status、source notes、star delta source distribution 等运行诊断

### 关键假设

- `report date` 继续作为 daily 语义基准日期
- “当天”统一指 `report date` 对应的 UTC 日期，而不是阅读时本地自然日
- daily 主榜单的发现层必须依赖当次执行的实时拉取
- 若当次实时拉取不足以形成 fresh pool，产品上应显式降级，而不是用历史内容偷偷填满榜单

## 核心定义

### 1. Source 角色分层

为 daily report 新鲜度判断，source 分成两类：

#### `Freshness-driving sources`

这些 source 直接决定“今天是否真的有新鲜热点可看”：

- GitHub Trending
- GitHub 当日显著 star delta 信号
- watchlist orgs 中当天存在新鲜 GitHub 动态的项目
- Trendshift 当天最新推荐

这些 source 的共同要求是：

- 必须来自本次 `run-daily` 执行时的实时拉取结果
- 不是来自本地旧 digest 或旧 snapshot 回放

#### `Context sources`

这些 source 可以补充解释、语义和验证，但不应单独决定“今天的明星项目”：

- agents-radar digest
- 历史 GitHub snapshot 差值
- 历史 Trendshift snapshot

它们可以回答“这项目过去也被观察过吗”，但不能回答“它是不是今天的明星项目”。

### 1A. watchlist 与用户偏好分层

本设计明确区分两种概念：

#### `watchlist_orgs`

语义：

- 组织级重点监控名单

作用：

- 提高实时发现优先级
- 提高展示优先级
- 提高人工复核优先级

限制：

- 不直接提升客观趋势分
- 不等价于“这个项目更重要”

#### `user_interest_profile`

语义：

- 用户主动声明的关注方向

示例：

- `agent runtime`
- `memory`
- `coding agent`
- `infra / evaluation / MCP`

作用：

- 允许形成单独的偏好加权
- 允许影响最终展示排序与个性化推荐优先级

限制：

- 不得直接覆盖客观趋势分
- 不得把客观趋势分与偏好分混成不可拆分的单一黑箱总分
- daily report 展示层只允许输出一个最终排序，不展示多套并行榜单

本轮范围内的最小实现契约：

- `user_interest_profile` 属于当前设计范围，不再是未来预留项
- 输入来源固定为本地配置
- 更新方式固定为用户手动修改配置后重新执行 `run-daily`
- 前端页面输入不属于本轮范围，后续由 UI 相关计划承接

### 2. 项目展示层状态

每个项目在 daily report 中必须属于以下三类之一：

- `today_star`
  定义：至少命中一个 `Freshness-driving source` 的当日新鲜信号，并进入主榜单
- `context_only`
  定义：仅有 context source，或只来自 fallback / 历史快照，不得进入主榜单
- `pending_confirmation`
  定义：当前仅获得一次有效观测，尚未形成跨天或跨源确认

用户展示层中，“单日出现项目”统一改名为：

- `待二次确认项目`

定义固定为：

- 当前仅获得一次有效观测，尚未形成跨天或跨源确认

### 3. 新鲜度状态

daily report 首屏必须给出一个总状态结论，状态固定为三档：

- `数据新鲜，可直接阅读`
- `数据部分回退，谨慎参考`
- `数据显著过期，不建议直接用于判断`

## 总状态结论设计

### 状态判定输入

daily report 生成前，系统必须先得到每个 `Freshness-driving source` 的状态：

- `fresh_today`
  定义：该 source 在本次执行中实时拉取成功，且有效数据日期等于 `report date`
- `fallback_recent`
  定义：该 source 本次实时拉取失败，转而读取早于 `report date` 的历史数据，且回退天数不超过 2 天
- `fallback_stale`
  定义：该 source 本次实时拉取失败，转而读取早于 `report date` 超过 2 天的历史数据
- `unavailable`
  定义：该 source 本次既未实时成功，也未提供可用历史补充数据

### 总状态映射规则

#### `数据新鲜，可直接阅读`

同时满足：

- 至少 2 个 `Freshness-driving sources` 为 `fresh_today`
- 主榜单全部来自 `today_star`
- 主榜单中不存在 `context_only` 项目
- 主榜单的候选发现全部可追溯到本次执行的实时拉取

#### `数据部分回退，谨慎参考`

满足以下任一条件：

- 至少 1 个 `Freshness-driving source` 为 `fresh_today`，但另一个为 `fallback_recent` 或 `unavailable`
- 主榜单仍然全部来自 `today_star`，但 fresh source 覆盖不足 2 个
- 主榜单可生成，但候选覆盖明显不足，需要用户谨慎解释

这里的关键语义是：

- 可以接受“部分实时、部分缺失”
- 不能接受“主榜单主要由旧 digest / 旧 snapshot 补出来”

#### `数据显著过期，不建议直接用于判断`

满足以下任一条件：

- 所有 `Freshness-driving sources` 都不是 `fresh_today`
- 主榜单无法由 `today_star` 构成
- 当天只能依赖 `context_only` 或 `fallback_stale` 内容

这条状态明确意味着：

- 当前运行未能完成 daily 主榜单所需的实时发现层
- 用户可以阅读补充观察，但不应把它当成“今天的明星项目榜单”

### 首屏行为

首屏必须展示：

- 总状态结论
- 触发该状态的核心原因
- 每个 `Freshness-driving source` 的数据日期和状态

禁止行为：

- 仅在正文或注释中提 fallback
- 让用户自己阅读长说明后推断状态

## 候选池分层设计

### 候选池拆分

daily report 不再只给一个混合的“候选项目总数”，而是拆成三层：

- `当日新鲜候选数`
  定义：至少命中一个 `Freshness-driving source` 且 source 状态为 `fresh_today` 的唯一 repo 数
- `历史补充候选数`
  定义：只来自 context source 或 fallback source 的唯一 repo 数
- `待二次确认项目数`
  定义：命中 `pending_confirmation` 的唯一 repo 数

`user_interest_profile` 在本轮设计下只能影响：

- 最终展示顺序
- 个性化推荐标签

不得改变上述候选池分层定义。

### 旧口径兼容策略

- 旧的 `候选项目总数` 仍可在 JSON 或审计层保留
- 用户首屏默认不再只展示单个混合总数
- 若保留 `候选项目总数`，必须明确标注为“当前观测覆盖项目数”

## 主榜单生成规则

### 主榜单输入

主榜单只允许从 `today_star` 项目池中产生。

项目要进入 `today_star` 候选池，必须满足：

1. 至少存在一个 `Freshness-driving source` 的 `fresh_today` 信号
2. 该信号来自本次执行的实时拉取，而不是历史 fallback

这里先冻结一个两阶段模型，避免把“来源新鲜度”和“上榜筛选”混成一件事：

- `today_star 候选池准入`
  只由新鲜 source 命中决定
- `主榜单准入`
  在 `today_star` 候选池内部决定哪些项目真正展示到主榜单

也就是说：

- `today_star` 的候选语义是“这是本次执行实时发现到的当天真实新鲜候选”
- `主榜单` 的语义是“这些当天新鲜候选里，哪些值得被用户优先看到”

### 同日多新鲜源优先序

当 GitHub 新鲜源与 Trendshift 新鲜源在同一天同时提供候选时，本设计明确冻结为：

- 不设固定的来源优先序
- 不存在“GitHub 天然优先于 Trendshift”或“Trendshift 天然优先于 GitHub”的规则
- 两类 source 在进入 `today_star` 候选池时地位相同，只要命中 `fresh_today` 即视为当天新鲜候选

来源类型的作用仅限于：

- 证明项目具备当日新鲜性
- 增强“为什么今天值得关注”的说明
- 在同分场景下作为“新鲜来源覆盖更广”的 tie-break 证据

禁止实现阶段再自行决定：

- GitHub fresh 永远压过 Trendshift fresh
- Trendshift fresh 永远压过 GitHub fresh
- 按实现便利性临时设来源优先级

### scoring 的职责边界

scoring 在本设计中承担两个明确但有限的职责：

#### 职责 1：主榜单准入辅助

在已经进入 `today_star` 候选池的项目中，项目满足以下任一条件即可进入主榜单候选：

1. 满足现有评分体系下的默认入榜阈值
2. 被识别为异常增长项目
3. 命中重点 watchlist，且具备当天新鲜信号

#### 职责 2：主榜单排序

主榜单候选生成后，`total_score` 是主要排序依据。

### scoring 不承担的职责

- scoring 不能决定一个没有 `fresh_today` 信号的项目进入 `today_star`
- scoring 不能把 `context_only` 项目抬升成当天明星项目
- scoring 不能替代新鲜度状态判定

### 主榜单排序

主榜单继续使用现有可解释评分作为主排序依据，但排序只在“已通过主榜单准入的 `today_star` 候选”内部进行。

这意味着：

- scoring 逻辑不变
- 进入主榜单的前提变了：先满足新鲜度，再通过主榜单准入，最后按现有评分排序

若多个项目同分，固定 tie-break 顺序为：

1. `fresh_today` 来源数量更多者优先
2. 当日 star delta 更高者优先
3. canonical `repo_url` 字典序更小者优先

这样可保证：

- 无固定来源优先级
- 同一输入下主榜单稳定可重现

### 主榜单为空时的行为

如果 `today_star` 池为空：

- daily report 首屏必须进入 `数据显著过期，不建议直接用于判断`
- “当天明星项目”区块不得被历史 fallback 项目自动填满
- 报告可以提供“历史补充观察”区块，但必须与主榜单分离

这也意味着：

- `agents-radar` digest、历史 Trendshift snapshot、历史 GitHub snapshot 都不能拿来“补齐一个看起来像 daily 的主榜单”

### watchlist 规则

watchlist 命中本身不能让项目进入主榜单。

watchlist 项目只有在满足以下任一条件时，才算当天新鲜候选：

- 当天命中 GitHub Trending
- 当天具有显著 GitHub star delta
- 当天被 Trendshift 最新推荐命中

进一步约束：

- `watchlist_orgs` 可以帮助项目更早进入实时发现扫描范围
- `watchlist_orgs` 可以帮助项目在同等条件下获得更高展示优先级
- `watchlist_orgs` 不得直接改写 `total_score`
- `watchlist_orgs` 不得被实现成“组织白名单加分器”

### 用户偏好层规则

本轮设计固定如下：

- 偏好加权是单独层，不改写客观趋势分
- daily report 展示层只保留一个最终排序
- 审计层必须能同时保留：
  - `objective_score`
  - `preference_boost` 或等价字段
  - `final_rank` 或等价字段
- 用户在审计或详细层面必须能区分“这个项目客观上热”与“它更符合我的关注方向”
- 最终排序固定按：
  `final_score = objective_score + preference_boost`
  生成

### 用户偏好输入契约

`user_interest_profile` 在本轮的输入来源固定为配置层，位置固定为：

- `config.yaml`

最小输入结构必须能表达：

- `enabled`
- `topics`

其中：

- `enabled`
  控制是否启用偏好层
- `topics`
  为用户关注方向列表；每个 topic 至少包含：
  - `name`
  - `weight`

本轮要求的最小 topic 名称空间包括：

- `agent-runtime`
- `memory`
- `coding-agent`
- `infra`
- `evaluation`
- `mcp`

本轮不要求数据库、账号体系或前端页面输入。

### 用户偏好更新契约

- 修改入口：本地配置文件
- 更新方式：手动修改后，下一次 `run-daily` 生效
- 生效范围：仅影响个性化排序与偏好标签，不回写客观趋势分

### 多来源同日命中场景

若同一 repo 在同一天同时命中 GitHub 新鲜源和 Trendshift 新鲜源：

- 该 repo 仍只作为一个 `today_star` 候选存在
- 不创建重复项目
- “为什么今天值得关注”中应明确写出其属于“同日多新鲜源共同命中”
- 该项目在 tie-break 上拥有更高的 `fresh_today` 来源覆盖优势

## 报告层级设计

## 首屏结构

daily report 首屏固定回答三个问题：

1. 今天这份日报新不新鲜、能不能看？
2. 今天有多少真正的当日候选？
3. 如果数据有回退，风险在哪里？

首屏区块顺序固定为：

1. `今日状态`
2. `新鲜度摘要`
3. `候选池概览`
4. `当天明星项目`

### `今日状态`

展示：

- 总状态结论
- 一句中文解释
- 是否建议继续阅读主榜单

### `新鲜度摘要`

展示每个 `Freshness-driving source` 的：

- source 名称
- 有效数据日期
- 状态
- 是否发生 fallback
- 当前数据是否来自“本次实时拉取”还是“历史补充数据”

### `候选池概览`

展示：

- 当日新鲜候选数
- 历史补充候选数
- 待二次确认项目数
- 主榜单是否完全由当日新鲜候选构成

## 项目卡片契约

每个主榜单项目卡片第一层必须包含：

- 项目名
- GitHub 链接
- `这个项目是做什么的`
- `为什么今天值得关注`
- 关键事实摘要
  - 来源类型
  - stars
  - 当日 star 变化（如有）
  - 是否待二次确认

### 中文摘要要求

#### `这个项目是做什么的`

必须是人话定义，优先回答项目类别或作用，例如：

- 一个面向多代理协作的开源运行时
- 一个帮助 AI agent 管理长期记忆的基础设施项目
- 一个聚焦代码代理工作流的命令行工具

禁止：

- 直接堆 tags
- 只写 paradigm 名词
- 写成营销文案

#### `为什么今天值得关注`

必须优先体现“今日性”，例如：

- 今天同时命中 GitHub 新鲜增长和 Trendshift 推荐
- 今天 star 增长明显，且互动指标同步上升
- 今天来自重点 watchlist 组织，并出现新的趋势信号

禁止：

- 只重复总分
- 只说“因为分数高”

## 详细证据下沉规则

以下内容不得占据项目第一层：

- 完整 `ScoreBreakdown` 组件串
- 大量术语化 evidence
- 详细风险 flags 列表

这些内容应进入：

- 项目卡片第二层
- 报告附录
- run summary / JSON 审计产物

## 历史补充观察区

当存在 `context_only` 项目时，daily report 可在主榜单之后增加：

- `历史补充观察`

该区块用途：

- 提供来自 fallback/context 的补充线索
- 帮助用户理解近期上下文

必须满足：

- 明确标识“非当日新鲜主榜单”
- 不与当天明星项目混排
- 不使用会误导成当日热点的标题
- 不得在视觉上与“当天明星项目”拥有同级标题权重

## 输入 / 输出契约

## 输入

daily report renderer 在本设计下必须额外消费一个新鲜度摘要对象，至少包含：

- `report_date`
- 每个 `Freshness-driving source` 的：
  - source 名称
  - effective_date
  - freshness_state
  - fallback_reason（如有）
- `today_star_projects`
- `context_only_projects`
- `pending_confirmation_count`
- `overall_daily_status`

若启用个性化偏好层，还必须额外消费：

- `user_interest_profile`
- 每个项目的 `preference_boost`
- 每个项目的 `objective_score` 与 `final_rank`

## 输出

### Markdown

文件路径保持不变：

- `data/reports/YYYY-MM-DD.daily.md`

必须新增的信息层：

- 首屏总状态结论
- 新鲜度摘要
- 候选池拆分统计
- 当天明星项目
- 历史补充观察（按需）

### JSON

文件路径保持不变：

- `data/reports/YYYY-MM-DD.daily.json`

允许新增字段，但不删除现有核心字段。新增字段应至少包括：

- `overall_daily_status`
- `freshness_sources`
- `today_fresh_candidate_count`
- `context_candidate_count`
- `pending_confirmation_count`
- `main_board_mode`
- `project_brief_cn`
- `why_today_cn`

若启用个性化偏好层，应新增：

- `objective_score`
- `preference_boost`
- `final_rank`
- `matched_interest_topics`

## 副作用与数据归属

- 新鲜度状态是 daily report 的展示契约，不改变底层 raw/normalized/scored 数据所有权
- run summary 仍是运行审计主入口
- daily report 负责把运行审计里的新鲜度风险翻译成用户可读结论

## 判断链路与依赖边界

- 主判断标准仍是当前可解释规则评分
- LLM 不参与首屏总状态判定
- LLM 不参与“是否属于 today_star”判定
- 若未来启用 LLM，也只能辅助生成语义标签或中文摘要素材，不得替代 freshness / ranking 主判断
- `watchlist_orgs` 不参与客观趋势加分
- `user_interest_profile` 在本轮固定存在于配置层，只参与单独的偏好加权层
- 若启用 `user_interest_profile`，最终展示顺序按“客观趋势分 + 偏好增益”形成单一结果

## 兼容性

- `run-daily`、`verify-daily` 命令名保持不变
- 现有 report 路径保持不变
- 旧 JSON 字段允许保留；新增字段以追加方式引入
- 若旧运行缺少新鲜度字段，daily report 必须显式降级，而不是假定为 fresh

## 失败与降级行为

### 情况 1：所有新鲜 source 都失效

行为：

- 首屏状态必须是 `数据显著过期，不建议直接用于判断`
- 主榜单不得展示为“当天明星项目”
- 历史内容只能进“历史补充观察”
- 不得用 `agents-radar` digest 或旧 snapshot 继续生成看似完整的 daily 主榜单

### 情况 2：部分 source 新鲜，部分 fallback

行为：

- 首屏状态必须是 `数据部分回退，谨慎参考`
- 主榜单只保留 `today_star`
- fallback 项目隔离到历史补充区
- 只要项目本身不是通过本次实时发现层进入，就不能进入主榜单

### 情况 3：项目缺少中文摘要素材

行为：

- 允许降级成简短规则化描述
- 不允许直接把原始 evidence 串放到第一句简介位置

### 情况 4：待二次确认项目过多

行为：

- 首屏候选池概览必须明确提示数量
- 不得因其数量多而自动提升其榜单优先级

## 可测试性设计

### 单元测试

- 新鲜度状态映射：
  - green / yellow / red 三档映射正确
- 候选池拆分：
  - `today_star`、`context_only`、`pending_confirmation` 分类正确
- 项目卡片：
  - 必须存在两条中文摘要
- 旧字段兼容：
  - 缺少新鲜度输入时显式降级

### 集成测试

- same-day fresh GitHub + fresh Trendshift -> `数据新鲜，可直接阅读`
- fresh GitHub + stale Trendshift -> `数据部分回退，谨慎参考`
- all stale / fallback -> `数据显著过期，不建议直接用于判断`
- 当日 fresh pool 为空时，主榜单不被历史项目自动填满
- agents-radar 仅有旧 digest 且 GitHub / Trendshift 实时发现失败 -> 主榜单必须为空或显式降级，不能由 agents-radar 顶上
- GitHub metrics 虽然实时成功，但如果候选本身来自旧 context source，仍不得进入当天明星项目主榜单
- GitHub fresh 项目与 Trendshift fresh 项目同时存在时，无来源固定优先序，仅按主榜单准入与排序规则决定展示顺序
- 同分场景下，必须按 `fresh_today 来源数 -> 当日 star delta -> repo_url` 的固定 tie-break 顺序稳定输出

### 回归测试

- current scoring 结果不因本设计改变底层 total_score 计算
- 旧 run summary / daily JSON 仍可被读取
- `verify-daily` 与 run summary 不因 daily 文案结构重构而失效
- 仅配置 `watchlist_orgs` 时，`objective_score` 不因组织命中而变化
- 配置 `user_interest_profile` 时，最终排序变化可观测，但 `objective_score` 保持不变
- 修改配置中的 `user_interest_profile` 后再次执行 `run-daily`，`final_rank` 与 `preference_boost` 应随之变化

### 冒烟检查

- 生成的 daily Markdown 首屏必须先出现总状态、新鲜度摘要、候选池概览，再出现项目列表
- fallback 出现时，报告顶部必须肉眼可见

## 风险与取舍

### 取舍 1：不让历史项目填满主榜单

好处：

- daily 语义更真实

代价：

- 某些日期主榜单可能更短，甚至为空

本设计选择：

- 接受主榜单变短，也不接受用历史 fallback 伪装成当日热点

### 取舍 1A：不再让 agents-radar 承担 daily 主榜单发现职责

好处：

- daily 的“当天”语义更真实
- 不会再因为上游 digest 停更而持续产出看似正常的日报

代价：

- 如果 GitHub / Trendshift 实时拉取失败，daily 主榜单可能明显变短甚至为空

本设计选择：

- 接受主榜单变短
- 不接受继续靠旧 digest 吃老底

### 取舍 1B：偏好服务于排序，不服务于伪造客观性

好处：

- 用户可以表达关注方向
- 系统仍保留客观趋势判断的可审计性

代价：

- 报表里需要同时维护“客观分”和“偏好层结果”

本设计选择：

- 接受双层结果表达
- 不接受把偏好直接揉进唯一总分

### 取舍 2：daily report 与 run summary 的职责分离

好处：

- 用户日报更易读
- 运行审计不丢失

代价：

- 信息会分层到两个产物

本设计选择：

- 保留 run summary 作为运维/审计层
- 把 daily report 收成用户决策层

## 实现就绪结论

这份设计已经明确了：

- daily report 的目标对象
- daily 主榜单必须来自本次执行的实时发现层，而不是旧 digest / snapshot 回放
- 当日新鲜 source 的角色边界
- `watchlist_orgs` 与 `user_interest_profile` 的产品边界
- `user_interest_profile` 的当前输入来源、更新方式与输出字段
- 首屏总状态的三档映射
- today_star / context_only / pending_confirmation 的分类规则
- GitHub fresh 与 Trendshift fresh 同日并存时“不设固定来源优先序”的规则
- scoring 在 daily report 中“辅助准入 + 排序，但不决定新鲜度准入”的职责边界
- fallback 出现时的强制降级行为
- 项目卡片的首层中文摘要契约

因此后续可以直接创建 ExecPlan，而不需要在实现阶段继续猜：

- 今天主榜单能不能用历史项目补位
- 首屏是否需要状态结论
- `待二次确认项目` 到底是什么意思
- LLM 要不要介入主判断
- GitHub 新鲜源和 Trendshift 新鲜源同时出现时谁优先
- scoring 到底只是排序，还是也参与主榜单准入
