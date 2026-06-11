# 设计文档：Signal -> Filter -> Action 版本设计规格

## 文档状态

- 版本：`v0.2`
- 状态：`Approved for Implementation`
- 目标：明确 `agent-trend-radar` 到底要设计成什么系统，而不是只把 `agents-radar` 和 `Trendshift` 的数据机械汇总。
- 参考输入：用户与 GPT-5.4 的初步方案、当前项目已落地的 SDD/Harness、Gemini 的一轮补强意见。
- 说明：外部文章只作为“先充分讨论需求，再定规格”的方法论启发；本文件只沉淀本项目自己的系统语义。

## 一句话定位

`agent-trend-radar` 不是“AI 项目资讯聚合器”，而是一个面向 `AI Agent / AI Infra / AI Tools` 的技术趋势雷达：它用高密度信号发现异常，用可解释评分过滤噪声，用知识卡片和趋势报告把观察转化为行动。

## 核心判断

用户真正缺的不是更多信息，而是更好的判断机制。

因此系统的第一性目标不是“抓更多来源”，而是：

- 更早发现异常增长。
- 判断项目是否改变系统结构，而不只是增加功能。
- 判断项目是否具备累积能力，例如 `memory`、`skill`、`self-improving`。
- 判断项目是否减少 `human-in-the-loop`。
- 判断讨论是否来自真实技术圈，而不是二次传播噪声。
- 把判断变成 `knowledge card`、`daily report` 和 `weekly trend`。

## 非目标

为了防止设计蔓延，当前系统明确不做这些事：

- 不做通用 AI 新闻聚合站。
- 不做投资建议系统。
- 不做完整的社交媒体情绪分析平台。
- 不把“自动 clone、自动跑 demo、自动写结论”作为默认主链路。
- 不在设计阶段承诺接入所有信号源。

## 设计原则

### 1. 高密度优先，不追求来源数量

信号源不是越多越好。优先接入高信息熵、低加工度、早期出现的来源；二次传播来源只用于解释和确认，不作为核心发现来源。

### 2. Star 是信号，不是价值

GitHub stars 只能说明注意力变化，不能直接说明技术价值。任何 `star_velocity` 都必须和 `engagement`、`issue/PR` 质量、多源出现、持续出现一起判断。

### 3. 关注架构变化，不被功能更新牵着走

系统优先识别 `agent runtime`、`persistent memory`、`self-improving`、`tool/skill ecosystem`、`multi-agent coordination`、`agent observability` 等范式变化，而不是普通工具功能。

### 4. LLM 只做语义分类，不做最终裁判

LLM 可以帮助判断项目描述是否包含 `runtime`、`memory`、`autonomy` 等语义，但最终分数必须由 `rules + weights + evidence` 计算。

### 5. Action 必须闭环

只看报告不够。系统必须推动三类行动：

- 记录项目卡片。
- 每周归纳趋势。
- 帮助用户决定“哪些项目值得后续人工深入验证”。

## 分析单位与时间窗

这是当前设计里必须写死的边界，否则实现阶段会反复歧义。

### 主分析单位

当前系统以 **GitHub repository** 作为主分析单位。

- 主键：`repo_url` 的 canonical form。
- `organization`、`author`、`watchlist_hit` 是 repo 的附属属性，不是一级分析单位。
- 同一组织多个 repo 可以分别打分，但 weekly report 可以再汇总为组织级趋势。

### 时间窗

| 时间窗 | 用途 | 说明 |
| --- | --- | --- |
| `daily` | daily report / anomaly detection | 当前主闭环 |
| `weekly` | weekly trend abstraction | 用于判断 persistence 和方向强化 |
| `multi-week` | 后续增强 | 用于识别真正的长期趋势，不是当前 MVP 必须项 |

### Persistence 最小定义

当前设计建议：

- `single-spike`：只在 1 个时间窗出现。
- `emerging`：连续 2-3 个时间窗出现。
- `persistent`：>= 4 个时间窗出现。

这部分不一定在 v0.1 全部实现，但文档层必须先定义。

## “系统结构变化”判断基准

这里必须写明基准，否则“是否改变系统结构”会变成拍脑袋判断。

### 基准不是“整个 AI 行业”

当前系统判断的基准不是宏观的“整个 AI 行业系统结构”，而是 **AI Agent 作为一种能力范式的默认基线**。
这里的“结构”首先指 Agent 的能力边界、自治方式、人机分工、记忆/技能组织与治理边界是否发生跃迁；工程实现形态只是证据之一，不是唯一标准。

换句话说，我们不是在问：

- 这个项目有没有改写整个 AI 行业？

而是在问：

- 这个项目相对于“普通 AI 工具 / 普通 AI Agent”的默认能力边界，是否带来了新的范式突破？

### 默认能力基线

一个“默认 AI Agent / AI Tool”在本系统里的基线大致是：

```text
model call -> prompt/template -> tool use -> single-step response
```

但这只是最基础的工程表象，真正的判断基线是下面这些能力边界：

- 以单次任务完成为中心，而不是持续自治运行。
- 默认无长期记忆，或者只有非常浅的上下文缓存。
- 工具调用是静态编排，不具备可扩展技能系统。
- 主要是“辅助人完成任务”，而不是替人持续做决策。
- 缺少可自我修正、自我累积、自我治理的机制。

也就是说，**判断基准首先是 Agent 能力范式的突破，其次才看工程实现形态是否也发生了对应变化**。

### 什么叫“改变系统结构”

当一个项目把 Agent 的能力边界、人机分工方式、持续性、可累积性或治理方式推进到新的阶段时，就应视为“结构级变化”。

这种变化不一定首先表现为工程 runtime 重构，也可以表现为：

- 能力边界突破。
- 自治程度突破。
- 记忆/技能组织方式突破。
- 多智能体协作方式突破。
- 人机协作关系突破。
- 安全/治理边界突破。

### 当前设计中应视为结构级变化的方向

以下变化都应视为结构级变化候选：

- 从一次性调用升级为 `agent runtime`。
- 从无状态升级为 `persistent memory`。
- 从固定工具集升级为 `skill / tool ecosystem`。
- 从静态行为升级为 `self-improving / feedback loop`。
- 从单 Agent 升级为 `multi-agent coordination`。
- 从“辅助用户”升级为显著减少 `human-in-the-loop` 的自治执行。
- 从黑盒调用升级为 `agent observability / evaluation / governance layer`。
- 从直接执行升级为 `sandboxed execution / approval boundary / runtime control`。
- 从“只是个 AI 应用”升级为新的 Agent 交互范式或 Agent 生产关系。

### OpenClaw 这类项目为什么可能算结构突破

像 OpenClaw 第一次出现时，之所以可能被视为结构级变化，不是因为它先改了某个工程目录结构，而是因为它可能让我们重新看待：

- Agent 是不是开始成为持续运行的主体，而不是单次问答工具。
- Agent 和工具、记忆、权限、环境的边界是不是被重新组织。
- 人类是不是从“每步下指令”转为“定义目标和边界”。

所以这里的“结构”首先是 **Agent 范式结构**，而不是单纯的代码工程结构。

### 何时只算“增加功能”

以下场景更接近“功能增强”，不应直接记为结构变化：

- 新模型适配。
- UI / CLI 改进。
- prompt 效果提升。
- 增加一个工具插件，但没有形成技能系统。
- 增加模板、工作流或 preset。
- 某个垂直场景的新应用封装。
- 普通的数据源接入或指标展示增强。

### 判定输出要求

因此 `architecture_shift` 不应只回答“高/中/低”，还应该给出：

- 判定基线是什么。
- 这个项目相对于基线突破了哪类 Agent 能力边界。
- 这种突破是“结构变化”还是“功能增强”。
- 该判断主要依据的是能力范式、工程组织方式，还是人机分工关系。

## 系统闭环

```text
Signal -> Normalize -> Filter/Score -> Action -> Feedback
```

| 层级 | 责任 | 当前状态 |
| --- | --- | --- |
| Signal | 从高密度来源发现项目级信号 | `agents-radar` 本地 digest 已接入，`Trendshift/GitHub enrichment` 待补强 |
| Normalize | 合并同一 repo 的多源信号 | 已落地 |
| Filter/Score | 计算可解释 `ScoreBreakdown` | `rules-only` 已落地 |
| Action | 输出 `knowledge card`、`daily report`、`weekly report` | 已落地 |
| Feedback | 用验证、结构测试和人工审查修正规则 | 部分落地 |

## 第一层：Signal

### 目标

Signal 层回答：哪些项目值得进入候选池？

它不回答“是否重要”，只负责尽早、保真、可回放地捕捉候选项目。

### 一级信号源

这些来源代表早期、高密度、高信息熵信号，应优先接入。

| 来源 | 作用 | 接入优先级 | 当前状态 |
| --- | --- | --- | --- |
| `agents-radar digests` | 复用上游 AI 趋势摘要 | P0 | 已接入 |
| `Trendshift` | 获取 `trending history` 和 `engagement` | P0 | connector 骨架已落地 |
| `GitHub Trending / watchlist orgs` | 发现异常升温项目与重点源头 | P0 | 待 enrichment 阶段补强 |
| `GitHub star 异常增长` | 捕捉爆发曲线 | P0 | 待 enrichment 阶段补强 |
| `X / Twitter 研究者层` | 捕捉未经加工的 early signal | P3 | 暂列为候选来源，后续有需要再接入 |
| `Substack / Newsletter` | 解释趋势方向 | P1 | 暂不接入，适合作为 weekly context |

### 二级信号源

这些来源通常已经是二次传播，价值在于补充讨论热度和解释背景，而不是最早发现项目。

| 来源 | 作用 | 接入优先级 |
| --- | --- | --- |
| `Hacker News` | 工程圈讨论和怀疑声音 | P2 |
| `Reddit r/MachineLearning` | 研究/工程争议和复现反馈 | P2 |
| `知乎 / 公众号` | 中文总结和二次传播 | P4 |
| `Ben's Bites / Latent Space / The Sequence` | 趋势解释和语境补全 | P2 |

### Source 分层规则

| 分层 | 用途 | 是否影响发现 | 是否影响评分 |
| --- | --- | --- | --- |
| `Primary` | 早期发现项目 | 是 | 是 |
| `Validation` | 验证讨论持续性 | 否 | 是，但权重低于 `Primary` |
| `Interpretation` | 帮助解释趋势 | 否 | 不直接加分，只影响 report 和 human review |

### Watchlist 边界

当前 watchlist 只作为 **优先监控补充信号**，不应天然加分。

命中 watchlist 只能说明“值得更早进入候选池”，不能说明“价值更高”。

初始 watchlist 建议：

- `NousResearch`
- `openai`
- `anthropics`
- `meta-llama` / Meta AI 相关组织
- `langchain-ai`
- `modelcontextprotocol`
- `browser-use`
- `OpenBMB`
- `HKUDS`

### `RawSignal` 数据契约

这里必须和当前实现对齐，避免“设计稿一种 schema，代码又是另一种 schema”。

#### 当前实现使用的 canonical schema

```typescript
interface RawSignal {
  project_name: string;
  repo_url: string;
  source: "agents-radar" | "trendshift" | "manual";
  timestamp: string;
  stars?: number;
  star_delta?: number;
  forks?: number;
  issues?: number;
  PR?: number;
  tags: string[];
  description?: string;
}
```

#### 设计约束

- Signal 层绝不能将缺失数据强行填充为 `0`。
- `repo_url` 是唯一主键的 canonical basis。
- `source` 必须保留，为 `discussion_score` 服务。
- `tags` 是初始诊断标签，不是最终范式判断。
- `description` 允许为空，但后续评分必须降低置信度。

#### 后续可扩展字段

以下字段值得保留在未来版本，但当前不应强行进入 schema 迁移：

- `evidence_links`
- `watchlist_hit`
- `source_tier`
- `history_points`
- `confidence`

## 第二层：Filter

### 目标

Filter 层回答：这个项目是否值得关注，为什么？

评分不是排序游戏，而是注意力分配机制。系统宁可错过一些普通热门项目，也要优先捕捉架构级变化。

### 评分公式

```text
Score = w1 * star_velocity
      + w2 * engagement_score
      + w3 * architecture_shift
      + w4 * compounding_capability
      + w5 * autonomy_score
      + w6 * discussion_score
```

### 六个组件

| 组件 | 设计作用 |
| --- | --- |
| `star_velocity` | 看增长速度，而不是 star 总量 |
| `engagement_score` | 作为反噪声骨架，防止“只火不活” |
| `architecture_shift` | 判断是否属于架构级变化 |
| `compounding_capability` | 判断是否形成累积能力 |
| `autonomy_score` | 判断是否减少 human-in-the-loop |
| `discussion_score` | 判断是否真的被技术圈持续讨论 |

### 五个核心判断

用户方案里强调的五个判断，仍是评分引擎的主骨架。

| 判断 | 对应组件 | 设计解释 |
| --- | --- | --- |
| 增长速度 | `star_velocity` | 看 `Δstars / time`，不是看 star 总数 |
| 是否改变系统结构 | `architecture_shift` | `agent runtime / infra / system` 高于普通工具 |
| 是否累积能力 | `compounding_capability` | `memory / skill / self-improving` 是范式信号 |
| 是否减少 `human-in-the-loop` | `autonomy_score` | 判断是否从辅助工具走向替人决策/执行 |
| 是否被技术圈内部讨论 | `discussion_score` | 看 issue/PR、dev 对比、持续出现、多源出现 |

### Anti-noise filter

这一块是设计稿里最容易写成“看起来合理、实现起来却误杀”的地方，所以要明确哪些是 **规则**，哪些只是 **启发式**。

#### 当前必须落地的规则

- 高 `star_velocity` + 低 `engagement` 必须产生风险提示。
- 单一来源出现的项目不得被当作长期趋势。
- 缺描述、缺 metrics 的项目必须降低置信度。

#### 当前不应写死为绝对阈值的规则

下面这些指标有价值，但不能在设计层被写成一刀切定值：

- “优质项目的 `(Forks + Issues + PRs) / Stars` 通常在 `0.05-0.15`”
- “低于 `0.01` 就一定是营销风险”

原因：

- 新 repo、早期 repo、工具类 repo 和框架类 repo 的比值差异非常大。
- issue/PR 活跃度和 star 增长存在明显时滞。
- 某些真正高价值项目在爆发早期就是“先被 star，再被使用”。

#### 设计建议

当前应采用 **分层启发式**：

| 条件 | 建议判定 |
| --- | --- |
| `star_velocity` 高，`engagement` 低，且单源出现 | 高噪声风险 |
| `star_velocity` 高，`engagement` 低，但连续多天出现 | 低置信关注，不直接判死 |
| `engagement` 高，外部 contributors 明显，且多源出现 | 高可信技术信号 |
| 样本太少，例如 repo 太新、指标不足 | `insufficient_data`，而不是 fake-star 结论 |

#### README / runnable check

Gemini 提到的“通过 README 判断可运行性”是有价值的，但当前不应直接绑定到 LLM 主链路。

更合理的设计是：

- v0.2：用确定性规则检查 README 是否存在 `install` / `quickstart` / `docker` / `usage` 片段。
- v0.3：如果需要，再引入 LLM 作为辅助语义提取，而不是硬门槛。

### 范式分类

第一版应支持以下趋势短语：

- `agent runtime`
- `persistent memory`
- `self-improving`
- `tool/skill ecosystem`
- `multi-agent coordination`
- `agent observability`
- `sandboxed execution`
- `vertical autonomous agent`
- `model-native agent capability`

趋势输出应组合成更有解释力的表达，例如：

```text
agent runtime + persistent memory + self-improving
```

### Score -> Action 映射

这部分是当前文档里还不够明确的关键点，建议先写死。

| 结果 | 含义 | 动作 |
| --- | --- | --- |
| `high` | 值得优先关注 | 进入 daily 高分区，进入 KB，进入 weekly 候选 |
| `watch` | 需要继续观察 | 保留卡片，等待 persistence 或多源验证 |
| `low` | 当前证据不足 | 不在报告主区域突出，只保留原始记录或低优先卡片 |
| `anomaly` | 增长异常但未必优质 | 独立进入 daily anomaly 区，强制展示风险 |

## 第三层：Action

### 目标

Action 层回答：看到这些信号之后，用户真正要做什么？

### 1. 雷达仓库

系统必须维护项目知识库，而不是每天覆盖式生成报告。

建议结构：

```text
data/kb/
  agents/
  models/
  infra/
  tools/
```

当前实现已生成 `data/kb/*.md`，后续可以按范式目录重组。

### Knowledge Card 边界

每个项目 card MUST 至少包含：

- 项目是什么。
- 最近为什么火。
- 属于哪个范式。
- star 增长。
- 风险与反噪声提示。
- 系统建议的下一步。

#### 机器区与人工区

Gemini 提的这点很重要，建议保留，但要写得更可执行：

- 机器可更新区域：frontmatter、metrics、signals、score、risks、next steps。
- 人工拥有区域：`## 人工判断` 或 `## Review Notes`。
- 机器在后续更新 KB 时不得改写人工区域。

这意味着未来 KB 更新器需要支持“保留受保护 section”，这是设计承诺，不只是文档偏好。

### 2. 每周趋势归纳

Weekly report 必须回答：

- 最近爆的东西有什么共同点？
- 是否强化某个方向？
- 是否出现新范式？

报告必须把项目抽象成趋势，而不是只列 repo。

### 3. 人工后续验证边界

系统当前阶段**不负责主动跑代码验证项目**。

它的职责只是：

- 帮你筛出值得关注的项目。
- 告诉你为什么它值得关注。
- 帮你形成持续趋势判断。

如果你对某个项目十分感兴趣，且它确实对你有用，你再主动去 clone、运行、读代码即可。这一步不进入当前系统主链路，也不作为当前版本的设计承诺。

### CLI 闭环

当前 CLI 只需要稳定支持：

- `run-daily`
- `score`
- `run-weekly`
- `build-kb`

## MVP 与后续版本

### v0.1：本地闭环

已完成：

- `agents-radar digest -> RawSignal`
- `Normalize`
- `rules-only scoring`
- `daily report`
- `weekly report`
- `KB cards`
- `CLI` 源开关

### v0.2：真实 enrichment

下一阶段：

- `Trendshift snapshot fixture`
- `Trendshift parser`
- `GitHub metrics enrichment`
- `watchlist org` 配置
- `scoring quality review`
- README 的确定性 runnable check

### v0.3：讨论层与解释层

后续：

- `Hacker News / Reddit` 作为 discussion evidence
- `Newsletter / Substack` 作为 weekly interpretation context
- `X/Twitter` 研究者层 signal，但需要明确 API、合规和噪声控制

### v0.4：实践验证闭环

后续：

- 如未来确有需要，再讨论是否引入“人工验证结果回写 KB”的辅助流程
- 这不是当前已承诺路线

## 当前仍需你拍板的点

这些问题不解决，后续实现容易返工：

1. **RawSignal schema 是否保持当前 flat 结构**  
   当前结论：先保持当前 flat schema，不在设计审批前强推结构迁移。
2. **KB 是否要从 flat slug 文件重组为分目录结构**  
   当前结论：先保持 flat，等范式分类稳定后再迁移目录。
4. **X/Twitter 是否真的值得纳入 roadmap**  
   当前结论：暂列为候选来源，不作为近期优先项。
5. **反噪声阈值是否采用硬编码**  
   当前结论：不在设计稿里写死绝对阈值，只保留启发式和低/高风险条件。

## 决策结论

本系统应优先做成一个“技术判断飞轮”：

```text
早期信号 -> 可解释过滤 -> 趋势抽象 -> 最小实践建议 -> KB 反馈 -> 评分修正
```

这比“接入更多 RSS / 社媒源”更重要。没有 `Filter` 和 `Action`，`Signal` 越多只会制造更多噪声。
