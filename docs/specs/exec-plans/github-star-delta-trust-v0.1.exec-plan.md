# 执行计划：GitHub Star Delta Trust v0.1

## 文档状态
- 版本：`v0.1`
- 当前状态：`Completed`
- 目标：为 Agent Trend Radar 建立“可信优先”的 GitHub star 日增链路，解决当前 report 中 `daily_delta=unavailable` 大面积出现、以及“总 stars 不等于当日增长”的语义缺口。
- 原则：优先使用 GitHub 官方可验证接口；本地快照只作为审计与兜底层；严禁从 HTML 或总 stars 伪造日增。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | GitHub Star Delta Trust |
| 负责人 | Codex |
| 关联总计划 | `docs/specs/exec-plans/signal-filter-action-v0.2.exec-plan.md` |
| 关联服务规格 | `services/signal-ingestion.md`、`services/normalization.md`、`services/scoring-engine.md`、`services/action-output.md`、`services/cli-runtime.md` |
| 风险等级 | `High` |
| 主要外部依赖 | GitHub REST API、`GITHUB_TOKEN`、本地 snapshot 写盘 |

## 背景与问题定义

当前系统已能稳定补齐 GitHub 的 `stars/forks/issues/PR` 总量，但 `star_delta_daily` 主要仍依赖上游 signal 自带字段：

1. GitHub enrichment 当前只补结构化总量指标，不直接产出 `daily_delta`。
2. `normalize` 当前只接受显式 `star_delta_source=signal` 的日增证据。
3. 当 GitHub 网络不可达、只命中 `cache` 时，report 中大量项目会落成 `daily_delta=unavailable`。
4. 如果未来直接用总 stars 差值、HTML 语义猜测或页面文案硬推日增，会带来新的数据污染风险。

因此，本计划的目标不是“让所有项目都一定有日增”，而是建立四层优先级明确、来源可追溯、失败可解释的 star delta 体系。

## 设计原则

### 四层来源优先级

1. `github_live`
   - 适用于今天首次进入候选池的新项目。
   - 通过 GitHub 官方 REST `List stargazers`，配 `Accept: application/vnd.github.star+json`，统计时间窗口内的 `starred_at`。
   - 只在认证和配额可接受时执行，不做全量无差别扫描。

2. `github_snapshot`
   - 适用于已有历史观测的老项目。
   - 每日持久化 GitHub 官方 `stargazerCount` 总量，用相邻日期快照计算日增。
   - 这是官方总量的本地时间序列化，不是“凭空造本地数据”。

3. `signal`
   - 上游信号如 Trendshift / agents-radar 已明确给出可信 `star_delta` 时保留。
   - 必须在 report 与评分证据里单独标注来源。

4. `unavailable`
   - 上述三层都拿不到时，明确标记不可用。
   - 不猜、不从 HTML 推、不用总 stars 冒充当日增长。

### 时间窗口与幂等语义

- `github_live` 的统计窗口统一使用 `UTC`。
- `run-daily --date YYYY-MM-DD` 的 live 统计窗口固定为：
  - `since = YYYY-MM-DDT00:00:00.000Z`
  - `until = YYYY-MM-(DD+1)T00:00:00.000Z`
- `since` 为闭区间，`until` 为开区间，即 `[since, until)`。
- `github_snapshot` 的日期键统一使用 `UTC date`，不使用本地时区日切。
- 同一 `date` 同一 `repo_full_name` 的 snapshot 记录必须幂等：
  - 同日重跑时按主键覆盖，不允许追加重复记录。
  - 只要输入总 stars 不变，重跑后计算出的最终 delta 结果必须不变。
- `github_snapshot` 仅在“相邻 UTC 日期快照都存在”时生效，不做跨天补差。

### 信任与控制约束

- GitHub HTML fallback 最多只允许补 `stars/forks/issues/PR/description`，不允许产生 `daily_delta`。
- 新项目不依赖本地快照获得首日 `daily_delta`，优先尝试 `github_live`。
- 不对所有 repo 全量拉 stargazer 历史，只对候选项目、优先项目或必要项目做实时查询。
- `github_live` 首版必须受确定性预算约束，不允许按实现临场扩范围。
- `GITHUB_TOKEN` 为 P0 前置配置要求；未配置时系统必须明确降级，而不是默默跑空。
- 所有 delta 都必须附带 `star_delta_source`，并在报告中可见。

### P0 Live 候选集与预算规则

- `github_live` 的输入来源只能来自当前这次 `run-daily` 已经生成的候选项目集合，不允许额外扫描仓库外列表。
- 候选筛选顺序固定为：
  1. `watchlist-hit` 项目
  2. 当天首次出现的新项目
  3. 已进入当前 `score` 输出前列的高优先级项目
- 其中“高优先级项目”的来源固定为当前运行内的评分结果，不允许重新定义一套平行候选池。
- 首版每日 live 查询上限固定为 `20` 个 repo。
- 预算分配规则固定为：
  - 先取全部 `watchlist-hit`
  - 再补新项目
  - 仍有余额时，再按当前评分结果从高到低补足
- 若某一层已超过预算，则按当前评分结果排序后截断到预算上限。
- 上述候选选择必须是纯函数式、可复现的：同一输入候选集与同一评分结果下，选出的 live repo 列表必须一致。

## 允许修改边界

### 允许修改

- `src/signal/githubMetrics.ts`
- `src/signal/index.ts`
- `src/normalize.ts`
- `src/action/dailyReport.ts`
- `src/action/runSummary.ts`
- `src/action/dailyVerification.ts`
- `src/config.ts`
- `src/types.ts`
- `src/__tests__/githubMetrics.test.ts`
- `src/__tests__/signalCollection.test.ts`
- `src/__tests__/normalize.test.ts`
- `src/__tests__/cliWorkflow.test.ts`
- `src/__tests__/actionOutput.test.ts`
- `src/__tests__/runSummary.test.ts`
- `src/__tests__/dailyVerification.test.ts`
- `data/raw/github-stars/` 下新增日期化产物约定
- 与本计划直接相关的 exec-plan / README 索引同步

### 禁止修改

- 不修改 `score` 口径本身，不借本计划顺手调评分权重或 confidence 阈值。
- 不修改 Trendshift / agents-radar 的解析语义，除非为兼容新 `star_delta_source` 做最小接线。
- 不引入第三方 stars API 作为主来源。
- 不新增 UI、weekly、knowledge base 范围内的产品行为。
- 不修改现有 CLI 命令名：
  - `run-daily`
  - `verify-daily`
  - `score`
  - `run-weekly`
  - `build-kb`

### 兼容性约束

- 现有 report 字段必须向后兼容，新增字段只能追加，不能重命名旧字段。
- 现有 `metrics_source` 语义保持不变；新增的是 `star_delta_source` 的细分使用。
- 旧数据若没有 `github_live` / `github_snapshot`，必须继续被正常读取并落为 `signal` 或 `unavailable`。
- `data/raw/github/*.enrichment.json` 现有结构保持兼容，只允许追加新诊断字段。

## 验收标准

本计划完成时，至少满足以下条件：

1. `run-daily` 对候选项目能按优先级尝试 `github_live -> github_snapshot -> signal -> unavailable`。
2. 今天新进入候选池、且 GitHub 官方接口可达的项目，可以在首日直接拿到 `github_live` 日增。
3. 老项目在存在相邻 UTC 日期快照时，可以稳定产出 `github_snapshot` 日增。
4. HTML fallback 不再产生任何伪日增；无法验证时必须落成 `unavailable`。
5. `star_delta_source` 至少支持：`github_live`、`github_snapshot`、`signal`、`unavailable`。
6. `run-summary` / `daily report` 能显示 delta 来源分布、失败原因、token 缺失或限流提示。
7. 同日重跑不改变最终 delta 结果。
8. 至少有一组脚本化测试覆盖：
   - live delta 成功
   - snapshot delta 成功
   - token 缺失降级
   - HTML 只补总量不补 delta
   - report 展示 delta 来源
   - 同日重跑幂等

## 当前状态判断

当前代码基础已经具备以下前提：

- GitHub enrichment 已有 `api / html / cache / unavailable` 分层。
- `metrics_source`、`metrics_trust_score`、`star_delta_source` 已存在基础模型。
- `run-summary` 已有 source status、metrics source distribution 与中文排障建议。

当前缺口主要集中在：

- 没有 `github_live_star_delta` 实时计算能力。
- 没有 `github_snapshot` 按日期写盘与相邻日差值计算能力。
- `normalize` 目前不能消费 `github_live` / `github_snapshot` 两类 delta。
- 报告侧还不能清晰展示“日增来自官方 live、快照、上游 signal 还是 unavailable”。

## 已落地内容

当前与本计划直接相关、已存在于仓库中的基础能力：

- 已有 GitHub enrichment 分层：`api / html / cache / unavailable`。
- 已有 `metrics_source`、`metrics_trust_score` 与基础 `star_delta_source` 模型。
- 已有 `run-summary`、`daily report`、`verify-daily` 中文诊断产物。
- 已有 GitHub enrichment per-repo audit 写盘：`data/raw/github/*.enrichment.json`。
- 已有 `run-daily` / `verify-daily` 主链路，可作为本计划的真实验收入口。
- 已将 `github_live` 首版候选预算收紧为代码级固定值 `20`，并移除环境变量放大入口，确保与 exec-plan 的确定性预算约束一致。
- 已将 `github_live` 候选选择接入当前 run 的预评分结果，并把 `star_delta_window` 以结构化字段写回 `RawSignal`，不再只依赖 notes 文本。

当前尚未落地的内容：

- `github_live_star_delta`
- `github_snapshot` 写盘与回填
- `star_delta_source_distribution`
- token 缺失下的 live delta 专项自检

## 阶段进度

| 阶段 | 状态 | 目标 | 依赖 | 验证 |
| --- | --- | --- | --- | --- |
| P0：live delta 与 token 配置 | `Completed` | 建立 `github_live` 路径与 token 前置检查 | 现有 GitHub enrichment / config / report 诊断 | 单元测试 + dry-run + 失败原因审计，已通过 |
| P1：snapshot 持久化与回填 | `Completed` | 建立 `github_snapshot` 路径与相邻日差值 | P0 的 live / total stars 读取能力 | 快照读写测试 + 多日集成测试，已通过 |
| P2：报告、观测与限流策略 | `Completed` | 暴露 delta 来源分布、限流/失败原因、深度回填策略 | P0 + P1 | report 测试 + run-summary 测试，已通过 |

## Phase P0：GitHub Live Delta

### 目标

为“今天首次进入候选池的新项目”提供可信的首日 star 日增能力，不依赖本地快照。

### 范围

- `src/signal/githubMetrics.ts`
- `src/signal/index.ts`
- `src/config.ts`
- `src/types.ts`
- `src/__tests__/githubMetrics.test.ts`
- `src/__tests__/signalCollection.test.ts`

### 任务

1. 增加 `GITHUB_TOKEN` 配置检查与运行时提示：
   - token 缺失时明确记录为 `missing_token`
   - 不阻塞主链路，但禁止进入高成本 live delta 路径
2. 实现 `github_live_star_delta(owner, repo, since, until)`：
   - 优先使用 GitHub 官方 REST `List stargazers`
   - 配置 `Accept: application/vnd.github.star+json`
   - 统计 `[since, until)` 内的 `starred_at`
3. 控制 live 拉取范围：
   - 默认只对当前 `run-daily` 产生的候选项目执行
   - 按固定优先级选择：`watchlist-hit -> 新项目 -> 当前评分前列项目`
   - 首版每日 live 查询上限固定为 `20`
   - 高优先级项目来源固定为当前运行内的评分输出，而不是额外定义新列表
4. 对 live delta 结果显式写入：
   - `star_delta`
   - `star_delta_source=github_live`
   - `star_delta_window`
   - 失败原因摘要
5. 明确不可用条件：
   - token 缺失
   - rate limit
   - network timeout
   - response shape 异常
   都必须落成 `unavailable`，不能降级为伪值

### 验收

- 有 token 且 mock 响应成功时，能正确统计固定 UTC 窗口内的 star 数量。
- 无 token 时，主链路继续运行，但 `github_live` 被显式跳过并留下原因。
- HTML fallback 成功时，只补总量，不补 delta。
- 同一日期同一输入重跑，`github_live` 统计结果一致。
- 当 `watchlist-hit`、新项目和高优先级项目同时存在时，live 候选选择顺序与每日 `20` 个上限保持稳定且可复现。

## Phase P1：GitHub Snapshot Delta

### 目标

为已有历史观测的项目建立低成本、可审计的日增回填能力。

### 范围

- `src/signal/githubMetrics.ts`
- `src/normalize.ts`
- `src/cli.ts`
- `src/types.ts`
- `data/raw/github-stars/`
- `src/__tests__/githubMetrics.test.ts`
- `src/__tests__/normalize.test.ts`
- `src/__tests__/cliWorkflow.test.ts`

### 任务

1. 每次 `run-daily` 成功获取 GitHub 总量后，写入日期化 snapshot：
   - `data/raw/github-stars/<date>.json`
2. snapshot 结构需至少包含：
   - `date`
   - `repo_full_name`
   - `stars`
   - `metrics_source`
   - `captured_at`
3. snapshot 写盘规则：
   - 逻辑主键为 `date + repo_full_name`
   - 同日重跑覆盖，不追加
   - 写盘前后能通过 audit 追溯本次来源
4. 相邻 UTC 日期快照可用时，计算：
   - `today.stars - previous.stars`
   - 并写成 `star_delta_source=github_snapshot`
5. 非相邻日期、缺快照、总量回退异常时：
   - 不计算 delta
   - 保留 `unavailable`
6. `normalize` 接收 `github_snapshot` 与 `github_live` 两类 delta 来源。

### 验收

- 连续两天 snapshot 存在时，老项目能正确得到 `github_snapshot` 日增。
- 中间缺天或总量异常时，不会伪造 delta。
- 同日重跑不会改变 snapshot 最终值，也不会污染下一次 delta。
- 多日集成测试能验证 snapshot 路径与 persistence 逻辑共存正常。

## Phase P2：报告、观测与限流策略

### 目标

让 report 不只是显示“有/没有日增”，而是能说明“为什么有、为什么没有、来自哪一层”。

### 范围

- `src/action/dailyReport.ts`
- `src/action/runSummary.ts`
- `src/action/dailyVerification.ts`
- `src/__tests__/actionOutput.test.ts`
- `src/__tests__/runSummary.test.ts`
- `src/__tests__/dailyVerification.test.ts`

### 任务

1. `daily report` 展示：
   - `日增`
   - `日增来源`
   - `官方 live / snapshot / signal / unavailable`
2. `run-summary` 展示：
   - `star_delta_source_distribution`
   - `live_delta_attempts`
   - `live_delta_success`
   - `snapshot_delta_success`
   - `token_missing`
   - `rate_limit`
   - `network_blocked`
3. `verify-daily` 增加告警：
   - token 缺失且 live delta 被整体跳过
   - 新项目占比高但 live delta 命中率过低
4. 限流与成本控制：
   - 首版只对高优先级项目做 live delta
   - 保留后续对 GraphQL/深度回填的扩展入口

### 验收

- 用户能从 report 直接看出一个项目的日增是 live、snapshot、signal 还是 unavailable。
- `run-summary` 能清楚区分 token 缺失、限流、网络失败和正常 unavailable。

## 验证记录

| 日期 | 验证 | 结果 | 备注 |
| --- | --- | --- | --- |
| 2026-04-27 | `pnpm test -- specStructure` | 通过 | 新 exec-plan 已接入索引，结构测试通过 |
| 2026-04-27 | 当前 report / enrichment 产物复盘 | 已完成分析 | 已确认 `daily_delta=unavailable` 主因是缺少 GitHub 星标时间序列层，而非 report 渲染错误 |
| 2026-04-27 | `bash.exe -lc "cd /home/adduser/AgentProjection/agent-trend-radar && ./node_modules/.bin/tsx scripts/execPlanPreflight.ts --check"` | 通过 | Skill + exec-plan receipt 硬约束已生效 |
| 2026-04-27 | `bash.exe -lc "cd /home/adduser/AgentProjection/agent-trend-radar && ./node_modules/.bin/tsc --noEmit"` | 通过 | 类型检查无错误 |
| 2026-04-27 | `bash.exe -lc "cd /home/adduser/AgentProjection/agent-trend-radar && ./node_modules/.bin/vitest run"` | 通过 | 100 tests passed |
| 2026-04-27 | `bash.exe -lc "cd /home/adduser/AgentProjection/agent-trend-radar && ./node_modules/.bin/tsx scripts/qualityAudit.ts --gate"` | 通过 | 质量门禁无新增回归 |
| 2026-04-27 | 回应 review 后将 `github_live` 候选预算从 env 可配置收紧为固定 `20` | 已完成 | 已移除 `AGENT_TREND_RADAR_GITHUB_LIVE_LIMIT` / `AGENT_TREND_RADAR_GITHUB_LIVE_MAX_PAGES` 放大入口，并补回归测试 |
| 2026-04-27 | 按最新 review 修正 live 候选排序与窗口字段 | 已完成 | live 候选已按当前 score 输出前列截断，`star_delta_window` 已作为结构化字段回写并补测试 |
| 2026-04-27 | 调整 GitHub 请求默认超时与重试参数 | 已完成 | 默认超时已从 `4000ms` 提升到 `10000ms`，GitHub API / HTML / live star delta 均接入 `3` 次重试 |
| 2026-04-27 | 补充 `GITHUB_TOKEN` 配置与弱网调优教程 | 已完成 | `PRACTICAL_RUNBOOK.md` 已新增 token 创建、shell 注入、永久生效与 GitHub 超时/重试覆盖说明 |

## 脚本化验收矩阵

| 类型 | 验证内容 | 命令或方法 | 通过标准 |
| --- | --- | --- | --- |
| 单元 | live delta 时间窗口统计 | `pnpm test -- githubMetrics` | `starred_at` 计数正确 |
| 单元 | live 候选集预算选择 | `pnpm test -- signalCollection` | `watchlist-hit -> 新项目 -> 高优先级` 顺序稳定，且不超过 `20` |
| 单元 | token 缺失降级 | `pnpm test -- githubMetrics signalCollection` | 不阻塞主链路，原因可见 |
| 单元 | snapshot 差值计算 | `pnpm test -- githubMetrics normalize` | 仅相邻日差值生效 |
| 单元 | 同日重跑幂等 | `pnpm test -- githubMetrics cliWorkflow` | 同日覆盖不追加，最终 delta 不变 |
| 回归 | report 显示 delta 来源 | `pnpm test -- actionOutput runSummary dailyVerification` | 中文报告出现来源字段 |
| 集成 | 多日 run-daily | `pnpm test -- cliWorkflow` | 新项目走 live，老项目可走 snapshot |
| 静态 | 类型检查 | `pnpm typecheck` | 无类型错误 |

## 风险与取舍

- REST `List stargazers` 对热门仓库可能分页很多，初版不能全量无差别拉取。
- 若不设确定性候选上限，live 成本会向评分侧或候选池规模漂移；因此首版必须严格守住 `20` 个 repo 的 daily budget。
- token 是 live delta 的必要条件，但即使有 token，网络不可达仍可能失败。
- snapshot 适合作为稳定兜底，不适合作为新项目首日唯一来源。
- 不建议把第三方 stars API 当主来源，除非后续单独立项评估其 SLA、语义与限流策略。

## 回滚策略

- 若 `github_live` 成本或限流不可接受，可暂时关闭 live delta，仅保留 snapshot 与 signal。
- 若 snapshot 写盘引入脏数据，可停用 snapshot delta，只保留总量快照审计，不参与评分。
- 若 report 变得过于复杂，先保留 run-summary 的诊断字段，daily report 只展示简化来源标签。

## 结论记录

- 2026-04-27：结合本地实现与 report 产物复盘，已确认当前大面积 `daily_delta=unavailable` 的主因是“系统尚未建立 GitHub 星标时间序列层”，而不是 report 渲染错误。
- 2026-04-27：已明确采用四层优先级方案：`github_live -> github_snapshot -> signal -> unavailable`。
- 2026-04-27：已把 `GITHUB_TOKEN` 设为 P0 前置配置要求；无 token 时不得默默伪装为正常 live enrichment。
- 2026-04-27：根据 exec-plan review 意见，已补齐“已落地内容 / 验证记录”、UTC 时间窗口、同日重跑幂等规则，以及允许修改 / 禁止修改 / 兼容性约束。
- 2026-04-27：根据后续 review 意见，已将 `github_live` 首版预算硬性固定为 `20` 个 repo，取消环境变量扩展入口，并补充对应回归测试与验证记录。
- 2026-04-27：根据最新 review 意见，已将 live 候选选择接入当前 run 的预评分结果，并把 `star_delta_window` 从 notes 提升为结构化字段，确保审计可追踪。
- 2026-04-27：为适应弱网环境，已将 GitHub 请求默认超时提升到 `10000ms`，并为 GitHub API / HTML / live star delta 全部接入 `3` 次重试；同时补齐 `GITHUB_TOKEN` 配置教程，便于真实环境复现。

## 下一阶段入口

None. 当前 exec-plan 已完成，后续新增需求应进入新的 exec-plan 或独立 follow-up。
