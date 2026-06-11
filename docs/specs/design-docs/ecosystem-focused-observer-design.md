# 长尾生态观察模块设计

## 状态
- Date: 2026-05-28
- Status: Proposed
- Scope: `observer-only discovery module` + `first-class visual-console observer surface`，覆盖 `AI Agent / AI Infra / AI Tools`

## 目标

新增一个专门的长尾发现模块，持续观察当前主信号源覆盖不足、但对 Agent 生态很重要的细分方向。

这个模块需要回答：

- 今天哪些细分 Agent 生态产生了值得注意的新仓库候选？
- 哪些仓库即使进不了 GitHub Trending 头部榜单，也依然值得持续观察？
- 一个长尾仓库属于哪个生态，它为什么会被匹配到？
- 哪些长尾候选值得占据原先 `KB` 顶级模块的位置，成为用户需要单独查看的一级信息面？

这个模块不能混淆以下几类语义：

- `github_trending`：面向全局公开热度
- `watchlist_live_activity`：来自显式跟踪组织的活动
- `ecosystem-focused observer`：在预定义 Agent 生态中进行的定向长尾观察

## 非目标

- 不直接修改 `total_score`、`objective_score` 或主榜单的排序权重。
- 不让 observer-only 命中的仓库自动进入 daily 主榜单。
- 本阶段不改写 weekly trend 聚合逻辑。
- `v1` 不引入 Reddit、Hacker News、X 或 newsletter ingestion。
- 不把范围扩展到 `AI Agent / AI Infra / AI Tools` 之外。
- 一旦 observer 一级页面上线，不再把旧 `Knowledge Base` 保留为同等级的 first-class visual-console module。

## 问题

当前雷达在以下方向已经比较强：

- 已经进入 `agents-radar` 视野的高热项目
- GitHub 层面的广义热门项目
- 已被显式加入 watchlist 的组织

但在以下方向仍然偏弱：

- 特定 Agent 生态内部的长尾仓库
- 围绕 Claude Code、Codex、MCP、memory、observability、browser agent 的中等 star 但高信号工具
- 不足以进入大型全局榜单、但战略上很值得关注的细分仓库

`cc-viewer` 是一个典型动机样例：

- 它属于真实存在的 Agent 生态
- 它具备很强的生态语义
- 它可能长期进不了 GitHub Trending 头部列表
- 它默认也不属于 `watchlist`

这说明现有发现层更偏向头部项目，而对生态特定长尾的观察明显不足。

## 设计摘要

新增一个独立的 `ecosystem-focused observer` 模块。

这个模块：

- 与现有 signal collection 并行运行
- 使用可配置的 ecosystem definitions
- 通过 GitHub Search 的 ecosystem query 抓取候选仓库
- 产出独立的 observer artifacts
- 在 run outputs 中暴露独立的 observer status
- 不自动污染主 scoring pool

这份设计最关键的决定是“分离”：

- 它是一个 `observer module`，不是新的 objective scoring source
- observer 命中结果必须可见、可审计
- observer 到主评分池的提升，必须留到后续单独批准的 promotion policy

## 产品面替换

这份设计明确做出如下产品决策：

- 从 visual console 的一级模块中移除 `Knowledge Base`
- 用新的 `Long-tail Ecosystem Observer` 替换原先的 `KB` 导航位置

原因：

- 当前 `Overview / Projects / Weekly / Run Health` 已经覆盖了 KB 试图提供的大部分用户解释价值
- 旧 `KB` 路由本质上更像既有 artifacts 的派生展示层，而不是独立的信息价值源
- 当前产品真正缺的不是“再来一个说明页”，而是“一个专门承载长尾生态发现的一级页面”

因此，顶级导航应当从：

- `overview`
- `projects`
- `weekly`
- `run-health`
- `kb`

变为：

- `overview`
- `projects`
- `weekly`
- `run-health`
- `observer`

这里说的是产品表面替换，不等于要求在同一个实现阶段里物理删除所有 legacy `data/kb/*` artifacts。

## 生态范围

第一版冻结以下 9 个 Agent 相关生态域：

1. `coding-agents`
   目标：Claude Code、Codex、Aider、Cursor、OpenCode 风格 coding agent，本地开发代理，review/diff/patch 工具。

2. `agent-runtime`
   目标：agent runtime、orchestration、workflow engine、sandbox、scheduler、execution layer。

3. `skills-tools-mcp`
   目标：skills、plugins、tool-use、MCP、connector、tooling glue。

4. `memory-knowledge`
   目标：memory、context engineering、knowledge layer、retrieval、agent memory infrastructure。

5. `browser-computer-use`
   目标：browser agents、computer use、GUI automation、web automation、desktop control。

6. `eval-observability-governance`
   目标：eval、trace、observability、review、guardrail、policy、approval boundary。

7. `multi-agent-coordination`
   目标：swarm、multi-agent、team orchestration、role coordination。

8. `agent-ui-workbench`
   目标：agent IDE、viewer、console、workbench、operator UI、session/log viewer。

9. `agentic-rl`
   目标：agentic reinforcement learning、RL-based agent optimization、self-play、trajectory optimization、policy improvement、reward modeling、agent training loop。

这些生态定义需要足够窄，以减少噪声；又要足够宽，能够覆盖当前主雷达容易漏掉的长尾类别。

## 模块边界

### 新模块

在 signal layer 中新增专门的 observer 模块，例如：

- `src/signal/ecosystemFocusObserver.ts`

与之配套的渲染和 view-model helper 应放在 visual-console 层，例如：

- `src/action/ecosystemObserverReport.ts`
- `src/visualConsole/build.ts`
- `app/server.ts`

### 职责

observer 模块只负责：

- 构建 ecosystem-specific discovery queries
- 抓取长尾仓库候选
- 把命中结果归类到配置好的 ecosystems
- 写出 observer artifacts 和 observer status

它不负责：

- objective scoring
- 主榜单的 anti-noise ranking logic
- weekly trend abstraction
- 替代 GitHub Trending 的语义

## Visual Console 承载面

在这份设计里，第一版 user-facing observer surface 不再是可选项。

### Route contract

新增一个一级路由：

- `observer`

这个路由用于替换原先一级导航中的 `kb` 位置。

### 页面目标

`observer` 路由需要回答：

- 今天哪些生态产生了高价值长尾候选
- 每个候选为什么会被匹配到
- 它为什么有意思，即使它还不属于主 scored board
- 在考虑 promotion 之前，下一步应该继续观察什么

### 页面姿态

observer 页面应当是：

- discovery workbench
- ecosystem-first
- match-evidence-first
- 明确不对“热度权威性”背书

observer 页面不应当是：

- 主榜单替身
- 隐藏评分页
- 换皮后的 KB reader

## 配置设计

新增配置块：

```yaml
sources:
  ecosystem_focus:
    enabled: true
    mode: github-search
    recent_days: 7
    per_ecosystem_limit: 12
    max_total_candidates: 80
    ecosystems:
      - name: coding-agents
        enabled: true
        keywords: []
        topic_hints: []
        repo_seeds: []
        org_seeds: []
        negative_keywords: []
```

### 配置契约

`sources.ecosystem_focus` 包含字段：

- `enabled`
- `mode`
- `recent_days`
- `per_ecosystem_limit`
- `max_total_candidates`
- `ecosystems[]`

每个 ecosystem entry 包含：

- `name`：稳定 id
- `enabled`：该生态是否参与本轮观察
- `keywords`：正向文本词
- `topic_hints`：偏好的 GitHub topics
- `repo_seeds`：用于推导邻近发现的已知 seed repos
- `org_seeds`：经常发布相关仓库的已知组织
- `negative_keywords`：用于压制常见误报的词

### 默认姿态

上面冻结的 9 个 ecosystems 应默认出现在 `config.yaml` 中，但保持可编辑。

这样可以让模块：

- 默认就能工作，而不是空壳
- 也保留后续调优空间

## 查询策略

### Source backend

`v1` 只使用 GitHub Search。

原因：

- 与现有 GitHub realtime 模式一致
- 实现面较小
- 足够验证 ecosystem-specific long-tail discovery 是否有产品价值

`v1` 明确不使用：

- GitHub Trending HTML
- Reddit / HN
- X / Twitter
- newsletters

### Query construction

每个 ecosystem 根据以下信息生成一个或多个 GitHub Search query：

- `keywords`
- `topic_hints`
- `repo_seeds`
- `org_seeds`
- 共用的 repo scope constraints

基础约束：

- `archived:false`
- `fork:false`
- `pushed:>=<today-recent_days>`

优先排序方式：

- sort by `updated`
- order `desc`

这和广义 trending-style heat sorting 是有意不同的。

目标不是“全网最大 star 榜”，而是“所选生态中最近仍在活跃的长尾仓库”。

### Match quality gate

只有满足至少一个强生态匹配条件的仓库才应被保留：

- 仓库名或 description 命中 keyword
- 命中 topic
- 命中 org seed，且有额外正向生态证据
- 命中 repo seed adjacency，且有额外正向生态证据

以下情况应被压制：

- 只命中了很弱、很泛的 AI 通用词
- `negative_keywords` 显示大概率是误报
- 超出了仓库声明的 `AI Agent / AI Infra / AI Tools` 范围

### 去重

在 observer 模块内部：

- 跨 query 的重复仓库必须合并
- 同一个仓库可以保留多个 matched ecosystems

期望的合并结果：

- 一条 observed repo entry
- 需要时带多个 `ecosystem:<name>` labels
- 聚合后的 match evidence

## Artifact 设计

observer 模块应拥有自己独立的 artifacts，而不是写入 canonical main raw-signal file。

推荐路径：

- `data/observer/ecosystem-focus/<date>.json`
- `data/observer/ecosystem-focus/latest.json`
- 可选 summary：
  - `data/reports/<date>.ecosystem-focus.md`
  - `data/reports/<date>.ecosystem-focus.json`

### 推荐 entry 结构

```ts
interface EcosystemObserverEntry {
  repo_full_name: string;
  repo_url: string;
  observed_at: string;
  ecosystems: string[];
  matched_by: {
    keywords: string[];
    topic_hints: string[];
    repo_seeds: string[];
    org_seeds: string[];
  };
  description?: string;
  stars?: number;
  forks?: number;
  issues?: number;
  PR?: number;
  source_notes: string[];
}
```

这个结构有意比 `RawSignal` 更丰富，因为 observer 模块首先服务于 auditability 和后续跟进，而不是只服务下游 scoring。

## 与主评分的隔离

这是整份设计里最重要的边界。

### v1 保持 observer-only

observer-only 命中结果不得自动进入：

- `data/raw/<date>.json`
- `normalizeSignals(...)`
- `scoreProjects(...)`
- daily main-board ranking
- weekly trend candidate generation

原因：

- ecosystem observer query 本质上是 discovery heuristic，不是 objective corroboration
- 直接流入 `sources.length` 会悄悄抬高 `discussion_score`
- 这会破坏“独立观察模块”的原始语义

### 允许的交互

observer 模块可以影响：

- 独立的 observer artifact
- run-summary transparency
- manual review priority
- 独立的一级 `observer` visual-console route
- 如果未来另行批准，才允许影响显式 promotion logic

### Future promotion 另立设计

如果未来项目希望让 observer 命中结果影响主 candidate pool，必须通过一份新的、单独批准的设计来定义 promotion rules，例如：

- observer hit + second-source confirmation
- observer hit 连续多天持续出现
- observer hit + 足够强的 structured metrics

这些 promotion policy 不属于本设计范围。

## 状态表达与报告

observer 模块需要在 run outputs 中拥有独立的状态表达。

推荐在 run-summary 中新增：

- `observer_status.ecosystem_focus`
- `observer_candidate_count`
- `observer_ecosystem_counts`
- `observer_top_candidates`

可能状态值：

- `active`
- `empty`
- `failed`
- `disabled`

这个状态必须和当前主 `freshness-driving sources` 分离，不能改变 objective daily board 的 freshness gate 语义。

推荐的 visual-console 行为：

- `Overview` 可以轻量提示 observer findings
- `Projects` 在同仓库同时存在时，可以链接到 observer candidate
- `Weekly` 只可把 observer-only 主题作为 watchpoint 引用，不能当作已确认主趋势
- 一级 `observer` 页面成为长尾生态发现唯一的 first-class home
- 原先一级 `kb` 页面从 primary module set 中移除

## 缓存与回退

observer 模块应遵循与其他 GitHub-based fetcher 一致的可靠性姿态：

- 有 token 时优先走 authenticated GitHub API
- 遇到 `401` token failure 时允许回退到 unauthenticated 模式重试
- 记录 rate-limit 或 network failures
- live fetch 失败时，可回退到最新本地 observer snapshot

但这些 fallback semantics 必须局部限定在 observer 模块内部。

它不能：

- 伪装成 `github_trending`
- 伪装成 `watchlist_live_activity`
- 改写 objective source freshness judgment

## 初版生态调优指引

`v1` 应采用偏保守的关键词策略，依赖后续配置调优，而不是在第一稿里过度拟合。

建议：

- `coding-agents`：`claude code`、`codex`、`aider`、`cursor`、`code review`、`patch`、`diff`、`repo coding`
- `agent-runtime`：`runtime`、`orchestration`、`workflow`、`sandbox`、`scheduler`、`execution`
- `skills-tools-mcp`：`skills`、`mcp`、`plugin`、`connector`、`tool-use`
- `memory-knowledge`：`memory`、`context`、`retrieval`、`knowledge`、`rag`
- `browser-computer-use`：`browser agent`、`computer use`、`desktop`、`gui`、`automation`
- `eval-observability-governance`：`eval`、`trace`、`observability`、`review`、`guardrail`、`policy`
- `multi-agent-coordination`：`swarm`、`multi-agent`、`team`、`coordination`
- `agent-ui-workbench`：`viewer`、`console`、`workbench`、`session log`、`operator ui`
- `agentic-rl`：`agentic rl`、`reinforcement learning`、`rl agent`、`self-play`、`trajectory optimization`、`reward model`、`policy optimization`

对泛词噪声较大的生态，应积极使用 `negative_keywords`。

## 测试

### Unit tests

需要覆盖：

- ecosystem config parsing
- 从 ecosystem definitions 构造 query
- 多个 ecosystem 命中下的 repo dedupe
- `negative_keywords` suppression
- multi-ecosystem match aggregation
- `401` 后的 auth fallback
- live fetch 失败后的 cached observer fallback

### Integration tests

需要验证：

- 启用时 `run-daily` 会写出 observer artifacts
- 禁用模块时能够干净跳过 observer artifacts
- observer status 会进入 run-summary，但不会污染主 source counts
- observer-only repo 不会改变 `raw_signals`、`normalized_projects`、`scored_projects`、`today_star_count`

### Regression tests

需要显式覆盖：

- 类似 `cc-viewer` 的仓库能在 `agent-ui-workbench` 和/或 `eval-observability-governance` 下被捕获
- 不泄漏进 `discussion_score`
- 不泄漏进 `freshness-driving source` completeness gates

## 风险

- 泛生态查询仍可能有较高噪声
- GitHub Search rate limits 可能限制覆盖面
- ecosystem definitions 可能逐渐重叠
- 用户可能把 observer hits 误读成 objective hotness

## 缓解策略

- 冻结生态范围，只允许 Agent 相关
- 使用保守的 `recent_days` 和每生态预算
- 要求强正向生态证据
- 维持 `negative_keywords` filters
- 让 observer artifacts 和 status 在视觉上与主 objective outputs 保持分离
- 本阶段明确禁止 observer-only 命中进入 objective scoring

## 验收标准

- 仓库中存在独立、可配置的 `ecosystem-focused observer` 模块。
- visual console 从 first-class top-level module set 中移除 `Knowledge Base`，并以 `observer` 替代。
- 模块支持本文冻结的 9 个 ecosystems。
- 即使仓库没有出现在 `agents-radar`、GitHub Trending 或 watchlist sources 中，模块仍能发现长尾 repo candidates。
- observer artifacts 能按日期写出并可审计。
- observer status 会出现在 run outputs 中，但不改变现有 objective freshness semantics。
- observer-only repo 不会直接影响 `total_score`、`discussion_score` 或 daily main-board membership。
- 类似 `cc-viewer` 的仓库能在冻结的 ecosystem taxonomy 下被表达为合法 observed candidate。
- `observer` 页面能把 match evidence 和 ecosystem context 解释清楚，从而不再需要把独立 KB reader 作为一级模块保留。

## 待确认问题

- 后续阶段是否允许 observer hits 在满足显式确认规则后进入主 candidate pool？
- legacy `data/kb/*` artifacts 后续应被彻底删除，还是先作为 migration / compatibility shim 保留在一级产品面之外？
- 未来的 ecosystem backend 是否要在 observer-only 语义稳定后，再扩展到 HN / Reddit / X？
