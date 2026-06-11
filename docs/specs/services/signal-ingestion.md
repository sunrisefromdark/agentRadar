# 服务 Spec：Signal Ingestion

## 文档状态

- 版本：`v0.2`
- 目标：把 agents-radar 与 Trendshift 的上游信号变成可审计、可回放、可解释的 `RawSignal`。
- 当前实现状态：agents-radar 默认 `github-http` connector 已落地，可直接读取 [duanyytop/agents-radar](https://github.com/duanyytop/agents-radar) 的已提交 digest；`repo-sync` / `local-refresh` 仍保留为兼容模式。Trendshift connector 已有 HTTP/snapshot 骨架，但真实页面解析与稳定 fixture 仍待下一阶段补强。

## 责任范围

Signal 层负责从上游来源获取原始项目信号，并保存到 `data/raw/`。这一层只负责“发现和保真”，不得提前做最终评分判断。

## 输入

### agents-radar

| 文件 | 用途 | 当前状态 |
| --- | --- | --- |
| `https://github.com/duanyytop/agents-radar` 中已提交的 `manifest.json` | 默认枚举可用日期和报告类型 | 已接入 |
| `digests/YYYY-MM-DD/ai-trending.md` | AI trending 项目、分类、描述、链接 | 已接入 |
| `digests/YYYY-MM-DD/ai-agents.md` | Agent 生态项目、Issue/PR 活跃和架构信号 | 已接入 |
| `digests/YYYY-MM-DD/ai-cli.md` | AI tool / CLI 项目和社区动态 | 已接入 |
| `digests/YYYY-MM-DD/ai-weekly.md` | 周趋势、持续出现、范式总结 | 待用于 weekly enhancement |
| 本地 checkout / `data/upstream/agents-radar` | 离线调试或显式兼容模式的可选输入根目录 | 兼容保留 |

### Trendshift

| 数据 | 用途 | 当前状态 |
| --- | --- | --- |
| trending repositories | 候选项目发现 | connector 骨架已存在 |
| stars / forks / issues / PR | engagement_score | 待真实解析 |
| trending history | star_velocity 与 discussion_score | 待真实解析 |
| repository description / tags | semantic classification | 待真实解析 |

### GitHub Metrics

GitHub metrics 是 enrichment，不是必须的 Signal 来源。GitHub API 不可用时，系统 MUST 保留已有 raw signal，不得因为缺 stars/forks/issues/PR 而丢弃项目。

### Watchlist Orgs

watchlist 只作为优先发现与补充观察信号，不直接参与评分加权。

- 命中 watchlist 的 repo SHOULD 在 Signal 层被标记为 `watchlist-hit` 或等价元标签。
- watchlist 命中 MUST 不直接提升 `total_score`。
- watchlist 命中可以影响后续 report 的关注优先级或人工审查顺序。

## 输出

每条输入候选 MUST 归一化为 `RawSignal`：

| 字段 | 语义 |
| --- | --- |
| `project_name` | 项目显示名，优先使用 GitHub `owner/repo` |
| `repo_url` | canonical GitHub URL |
| `source` | `agents-radar`、`trendshift` 或 `manual` |
| `timestamp` | 信号时间 |
| `stars` | 当前 star 数；未知时保持缺失或由后续 enrichment 补齐 |
| `star_delta` | 日增或周期增量；未知时保持缺失 |
| `forks` / `issues` / `PR` | engagement 指标；未知时保持缺失 |
| `tags` | 从上游标签、topic 或文本关键词推断的标签 |
| `description` | 上游描述或相关行文本 |

## 契约

- Signal 层 MUST 保留 source 信息，供 `discussion_score` 判断多源出现。
- Signal 层 MUST 不编造缺失指标；未知不等于真实 0。
- Signal 层 SHOULD 在 pipeline 入口使用严格 schema 校验拦截结构非法的 `RawSignal`。
- schema 校验负责拦截“字段缺失、类型错误、非法枚举”等结构问题；“未知值被错误写成 0”属于语义防毒问题，应由 normalization / scoring 继续识别和降级，而不是假装由 schema 单独解决。
- watchlist 命中只能写入补充标签或信号，不得作为直接加分项。
- agents-radar 缺少某个 digest 时 SHOULD warning 并跳过，不应生成假项目。
- Trendshift HTTP 失败时 SHOULD 降级为空 Trendshift evidence，不影响 agents-radar 本地闭环。
- GitHub enrichment 失败时 SHOULD 保留原始信号并继续 pipeline。
- `--no-trendshift`、`--no-agents-radar`、`--no-github` MUST 分别关闭对应来源或 enrichment。

## 失败模式

| 失败 | 语义 | 预期处理 |
| --- | --- | --- |
| manifest 缺失 | agents-radar 上游不可定位 | 返回空信号或显式失败，不能伪造日期 |
| digest 缺失 | 某类日报未生成 | warning 并跳过该报告 |
| Trendshift 网络失败 | 外部来源不可用 | warning 并继续本地闭环 |
| Trendshift HTML 漂移 | parser 可能失真 | snapshot 测试失败，禁止静默成功 |
| GitHub API 限流 | enrichment 不可用 | 保留 raw signal，记录风险 |
| `RawSignal` schema 非法 | 上游数据结构漂移或 parser 出错 | 在入口失败并显式报错，不进入后续 pipeline |

## 关键场景

### 场景：本地闭环

当用户执行 `run-daily --no-github --no-trendshift` 时，系统 MUST 只读取 agents-radar 本地 digest，并在 30 秒内完成 Signal -> Score -> Report dry-run 或真实写盘。

### 场景：多源讨论分

当同一 repo 同时出现在 agents-radar 和 Trendshift 时，Normalization MUST 合并 sources，Scoring MUST 给 discussion_score 多源 evidence。

### 场景：外部网络不可用

当 Trendshift 或 GitHub 不可访问时，系统 MUST 不阻断 agents-radar-only 闭环。

### 场景：watchlist 命中

当 repo owner 命中 `watchlist_orgs` 时，THEN Signal 层 SHOULD 给该信号添加 `watchlist-hit` 元标签，但后续 Scoring MUST 不因此直接加分。

### 场景：Schema 校验

当 parser 产出的 `RawSignal` 缺少必填字段、字段类型错误或 `source` 非法时，THEN pipeline MUST 在入口拒绝该信号，并记录结构错误。

## 验证矩阵

| 文件位置 | 验证内容 | 验证方式 | 对应 Spec |
| --- | --- | --- | --- |
| `src/signal/agentsRadarConnector.ts` | manifest 与 digest 读取、缺文件跳过 | 单元测试 + dry-run | 本文件「agents-radar」「失败模式」 |
| `src/signal/trendshiftConnector.ts` | HTTP/snapshot 双模式、网络失败降级 | snapshot 测试 + 集成测试 | 本文件「Trendshift」 |
| `src/signal/githubMetrics.ts` | repo URL 解析、metrics enrichment 失败不阻断 | 单元测试 | 本文件「GitHub Metrics」 |
| `src/signal/watchlist.ts` | watchlist 命中只写元标签、不改数值指标 | 单元测试 | 本文件「Watchlist Orgs」 |
| `src/signal/index.ts` | `--no-*` 源开关生效、schema 非法时入口拦截 | CLI dry-run + 单元测试 | 本文件「契约」「Schema 校验」 |
| `data/raw/*.json` | RawSignal 字段保真 | 冒烟检查 | 本文件「输出」 |
