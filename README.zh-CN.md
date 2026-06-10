# AgentRadar

面向 AI Agent 生态的开源趋势雷达与研究工作台。

[English](./README.md) · 中文

---

## 这是什么

AgentRadar 会持续采集公开的 Agent 生态信号，做归一化、评分、周趋势归纳、知识卡沉淀和新兴项目观察，最后把这些结果整理成一套可浏览、可追溯、可二次加工的本地产物。

你可以把它理解成一套给研究者、开发者、投资人、产品经理、Agent Builder 用的开源雷达系统：

- 它不是聊天机器人，而是一条可重复运行的数据与分析流水线
- 它不是“黑盒推荐”，而是尽量保留证据链、评分项和趋势判断依据
- 它不是只看单日热度，而是同时看日级、周级和持续性变化

如果你经常会问下面这些问题，这个项目就是为你准备的：

- 今天 Agent 圈里哪些项目最值得看？
- 哪些仓库只是一天热度，哪些是真的在持续抬头？
- 本周真正形成趋势的方向是什么？
- 新出现但还没进入主榜单的潜力项目有哪些？
- 某个项目为什么会上榜，证据是什么？

---

## 为什么值得 Star

很多人都会做“抓一下 GitHub Trending”，但真正麻烦的是后半段：

- 不同来源的信号怎么对齐
- 当天热度和长期持续性怎么一起看
- 趋势结论怎么尽量可解释
- 新项目怎么在还没爆发前就进入观察
- 这些东西怎么每天、每周稳定地产出

AgentRadar 把这些事串成了一套完整工作流，并且把结果沉淀为可检查的产物，而不是只留下一句“我觉得这个方向很火”。

如果这类开源研究基础设施对你有帮助，欢迎给这个仓库一个 Star。我们也非常感谢背后的公开数据源和开源生态，如果它们对你有帮助，也请顺手给它们一些 Star。

---

## 它能做什么

### 1. 每日趋势雷达

系统会聚合多个公开来源，生成当日项目清单、评分结果、证据摘要和运行状态。

你能得到：

- `data/reports/YYYY-MM-DD.daily.json`
- `data/reports/YYYY-MM-DD.daily.md`
- `data/reports/YYYY-MM-DD.run-summary.json`
- `data/reports/YYYY-MM-DD.verify-daily.json`

### 2. 每周趋势归纳

系统会把近 7 天窗口内的项目表现、主题聚类、证据关系和规则结果组织起来，再生成周趋势判断。

你能得到：

- `data/reports/YYYY-MM-DD.weekly.json`
- `data/reports/YYYY-MM-DD.weekly.md`
- `data/reports/YYYY-MM-DD.weekly.judgment.json`
- `data/reports/YYYY-MM-DD.weekly.audit.json`

### 3. 知识卡沉淀

每天的高价值项目会被整理成知识卡，方便回看、索引和后续二次研究。

你能得到：

- `data/kb/latest.json`
- `data/kb/*.md`

### 4. 新兴项目观察

除了主榜单，系统还会专门追踪那些“还没成熟但值得盯住”的新兴项目，把它们单独放进 observer 视图。

你能得到：

- `data/observer/ecosystem-focus/*.json`

### 5. 本地只读工作台

开源版自带一个本地 Web 控制台，用来浏览已有产物，但**不包含登录、注册、会话和账号体系**。

---

## 系统里的 Agent

这个项目不是“一个 Agent”，而是一组职责明确、彼此衔接的 agent / workflow。

### 1. Signal Collection Agent

职责：

- 从公开来源拉取原始信号
- 处理基础结构差异
- 写入 `data/raw/`

对应能力：

- `agents-radar` 上游摘要读取
- Trendshift 快照读取
- GitHub Trending / 实时指标 / Watchlist 活动补充

### 2. Normalization & Scoring Agent

职责：

- 把不同来源的原始信号规范成统一结构
- 结合评分规则给项目打分
- 形成可解释的排序结果

对应产物：

- `data/normalized/`
- `data/scores/`
- `data/classifications/`

### 3. Daily Report Agent

职责：

- 生成当天主榜单
- 组织项目摘要、为何上榜、风险提示、推荐动作
- 生成日报和运行摘要

对应代码方向：

- `src/action/dailyReport.ts`
- `src/action/runSummary.ts`
- `src/action/dailyVerification.ts`

### 4. Weekly Trend Review Agent

职责：

- 在周窗口里识别真正的趋势主题
- 审视哪些候选趋势应该保留、合并、拆分、降级
- 输出更适合“研究判断”的周报结果

对应代码方向：

- `src/action/weeklyJudgmentRules.ts`
- `src/action/weeklyEnhancement.ts`
- `src/action/weeklyTrendAgent.ts`
- `src/action/weeklyReport.ts`

### 5. Observer Agent

职责：

- 不只盯主榜单，而是从更广的 Agent 生态里搜潜力仓库
- 给“新出现但值得关注”的项目一个观察池
- 帮你在主趋势形成之前提前看到变化

对应代码方向：

- `src/signal/ecosystemFocusObserver.ts`

### 6. Knowledge Card Agent

职责：

- 把项目沉淀成长期可回看的知识卡
- 方便做项目档案、研究索引和二次利用

对应代码方向：

- `src/action/knowledgeCard.ts`

### 7. Agent Memory Workflow

职责：

- 记录一部分开发任务和流程上下文
- 让项目本身更适合持续演化与自动化协作

对应代码方向：

- `src/agentMemory/`

说明：

- 这是项目内部的工作流能力，不是面向开源用户的登录态产品能力
- 开源版保留了这些文件，但不包含任何用户登录体系

---

## 数据源致谢

这个项目高度受益于开源社区和公开数据源。特别感谢：

- [agents-radar](https://github.com/duanyytop/agents-radar)
- [Trendshift](https://trendshift.io)
- [GitHub](https://github.com)
- 广泛的 Agent 开源建设者与生态仓库维护者

如果这些上游项目、平台和公开生态对你有帮助，欢迎给它们一些 Star，也欢迎给 AgentRadar 一个 Star，让更多人能看到这套开源研究工作流。

---

## 支持观察的生态方向

当前配置里，系统重点观察这些方向：

- coding agents
- agent runtime
- skills / tools / MCP
- memory / knowledge
- browser / computer use
- eval / observability / governance
- multi-agent coordination
- agent UI / workbench

这些方向来自仓库内的可配置规则，而不是写死在模型 prompt 里的“感觉判断”。

---

## 仓库结构

```text
agentRadar/
├── app/                     # 开源版只读 Web 入口
├── data/                    # 已生成的日报 / 周报 / 评分 / KB / observer 产物
├── scripts/                 # 自动化脚本
├── src/
│   ├── action/              # 日报 / 周报 / KB 等核心工作流
│   ├── agentMemory/         # agent memory 工作流
│   ├── db/                  # 数据库相关基础模块
│   ├── filter/              # 评分与过滤
│   ├── providers/           # LLM provider 适配
│   ├── signal/              # 数据源抓取与聚合
│   ├── storage/             # 文件读写
│   └── visualConsole/       # 控制台数据构建
├── README.md                # English
├── README.zh-CN.md          # 中文主文档
```

---

## 快速开始

### 1. 安装依赖

```bash
corepack pnpm install
```

### 2. 准备环境变量

```bash
cp .env.example .env
```

说明：

- 如果你只是浏览已提交产物，不一定需要补任何 key
- 如果你要运行带 LLM 增强的流程，再补对应 provider 的 key

### 3. 启动本地 Web 控制台

```bash
corepack pnpm visual-console:web
```

默认打开：

- `http://127.0.0.1:3210`

### 4. 直接看命令行视图

```bash
corepack pnpm visual-console -- --view overview --date latest
```

---

## 常用命令

### 每日流程

```bash
corepack pnpm run-daily
corepack pnpm verify-daily
corepack pnpm score
```

### 每周流程

```bash
corepack pnpm run-weekly
corepack pnpm sync-weekly
```

### 其他

```bash
corepack pnpm capture-github-stars
corepack pnpm build-kb
corepack pnpm typecheck
corepack pnpm test
```

---

## 产物是怎么流动的

一个最常见的路径是：

1. 抓取原始信号到 `data/raw/`
2. 归一化到 `data/normalized/`
3. 分类与评分到 `data/classifications/` 和 `data/scores/`
4. 生成日报 / 周报 / observer / kb 到 `data/reports/`、`data/observer/`、`data/kb/`
5. 用 CLI 或本地 Web 控制台浏览这些产物

这意味着你既可以把它当“本地研究工具”，也可以把它当“每日自动产物生成器”。

---

## 开源版边界

为了避免泄露配置、密钥和私有攻击面，当前开源版明确不包含：

- 登录
- 注册
- OAuth
- session / account settings
- 本地 auth bootstrap
- 私有部署模板
- 私有运维文档
- `.env` / `.env.local`

也就是说，开源版是一个**无登录、只读浏览、可运行数据流程**的公开版本。

---

## FAQ

### 1. 这个项目适合谁用？

它适合：

- 关注 Agent 生态的研究者
- 想持续追踪趋势的开发者
- 需要把公开信号变成结构化产物的团队
- 想搭自己的内部雷达或情报工作流的人

### 2. 这个项目是不是必须依赖数据库？

不是。

当前主路径是文件产物驱动，可以先浏览和运行大部分公开流程。某些数据库模块仍保留在代码里，是为了兼容部分工作流，但不代表你必须先搭数据库才能使用。

### 3. 为什么 Web 控制台是只读的？

这是刻意设计的安全边界。开源版不提供用户体系，也不暴露任何登录相关入口，这样更安全，也更容易维护。

### 4. 我能不能把它改成自己的内部雷达？

可以。最常见的做法是：

- 改 `config.yaml`
- 替换或扩展数据源
- 调整评分规则
- 接入你自己的自动化产物生成方式

### 5. 我可以把它改造成自己的版本吗？

可以。最常见的方式是：

- 改 `config.yaml`
- 换或扩展数据源
- 调整评分规则
- 把 CLI 和产物接进你自己的自动化系统

---

## 贡献

欢迎：

- 提 Issue 反馈 bug
- 提 PR 改进 README、规则、数据源和工作流
- 提出你希望增加的生态方向和观察维度

如果你计划长期维护自己的派生版本，建议先确定你自己的安全边界，再决定哪些能力保留为只读、哪些能力对外开放。

---

## Star History

如果这个项目对你有帮助，欢迎 Star。

也欢迎把它推荐给同样在关注 Agent 生态、趋势研究、开源情报和工作流自动化的朋友。
