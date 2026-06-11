# 执行计划：复用 agents-radar-system 代码搭建 agent-trend-radar

## 文档状态

- 版本：`v0.2`
- 当前状态：`In Progress`
- 目标：指导从 0 到 1 搭建 agent-trend-radar 时，哪些代码直接从 agents-radar-system 复制，哪些复制后改造，哪些明确不搬运。
- 原则：能安全 cp 的不重写；能 cp 后小改的不要从零写；但不能把 agents-radar 的 digest producer 主链路和发布边界误搬进本项目。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | 复用 agents-radar-system 代码搭建 agent-trend-radar |
| 负责人 | Codex |
| 关联产品规格 | `docs/specs/product-specs/agent-trend-radar-product-spec.md` |
| 关联服务规格 | `services/signal-ingestion.md`、`services/normalization.md`、`services/scoring-engine.md`、`services/action-output.md`、`services/cli-runtime.md` |
| 影响范围 | `src/`、`data/`、`config.yaml`、`package.json`、`docs/specs/` |

## 当前进度

| 阶段 | 状态 | 完成证据 | 残余事项 |
| --- | --- | --- | --- |
| 阶段 1：直接复制通用基础层 | `Done` | `src/date.ts`、`src/providers/`、`src/__tests__/providers.test.ts` 已落地 | 无 |
| 阶段 2：改造配置与 LLM 调用 | `Done` | `src/config.ts`、`src/llm.ts` 已落地；rules-only 默认可运行 | LLM classification 仍未启用 |
| 阶段 3：文件落盘与报告构建 | `Done` | `src/storage/files.ts`、`src/action/*` 已落地；`data/reports` 和 `data/kb` 已生成 | 报告质量依赖后续 enrichment |
| 阶段 4：上游连接器 | `In Progress` | `agentsRadarConnector`、`trendshiftConnector`、`githubMetrics` 已有骨架；本地 agents-radar-only 闭环通过 | Trendshift 真实解析和 GitHub metrics 真实补全待下一计划 |
| 阶段 5：暂不搬运边界 | `Done` | 未搬运 digest producer 主链路、MCP、发布器、通知模块 | 后续如接 CI/通知需新建计划 |

## 已落地内容

- 复制并保留 `date.ts`、LLM provider 抽象和 provider 测试。
- 新增 `types.ts`、`config.ts`、`logger.ts`、`retry.ts`、`llm.ts`。
- 新增 `signal/agentsRadarConnector.ts`、`signal/trendshiftConnector.ts`、`signal/githubMetrics.ts`、`signal/parse.ts`、`signal/index.ts`。
- 新增 `normalize.ts` 与 `filter/scoring.ts`。
- 新增 `action/dailyReport.ts`、`action/weeklyReport.ts`、`action/knowledgeCard.ts`。
- 新增 `storage/files.ts` 与 `cli.ts`。
- 新增 `normalize.test.ts`、`scoring.test.ts`，复用并通过 `providers.test.ts`。
- 新增 CLI 源开关：`--no-github`、`--no-trendshift`、`--no-agents-radar`。
- 已生成本地数据产物：`data/raw/latest.json`、`data/normalized/latest.json`、`data/scores/latest.json`、`data/reports/2026-04-23.daily.md`、`data/reports/2026-04-23.weekly.md`、`data/kb/latest.json`。

## 验证记录

| 时间 | 命令 | 结果 | 说明 |
| --- | --- | --- | --- |
| 2026-04-23 | `corepack pnpm typecheck` | 通过 | TypeScript 编译检查通过 |
| 2026-04-23 | `corepack pnpm test` | 通过，`3` 个测试文件、`33` 个测试 | provider、normalization、scoring 测试通过 |
| 2026-04-23 | `corepack pnpm run-daily -- --dry-run --no-github --no-trendshift` | 通过 | 本地 agents-radar-only dry-run：`62` raw、`58` normalized、`58` scored |
| 2026-04-23 | `corepack pnpm run-daily -- --no-github --no-trendshift` | 通过 | 本地闭环真实写盘 |
| 2026-04-23 | `corepack pnpm run-weekly -- --no-github --no-trendshift` | 通过 | 基于 latest scores 生成 weekly report |
| 2026-04-23 | `corepack pnpm build-kb -- --no-github --no-trendshift` | 通过 | 生成 `58` 张 KB cards |

## 当前残余风险

- 由于本地闭环使用 `--no-github --no-trendshift`，多数项目的 `stars/forks/issues/PR` 仍为 `0`，不能代表最终评分质量。
- Trendshift HTTP 抓取曾因网络失败降级；需要 snapshot fixture 和真实页面解析测试。
- Weekly report 当前会把大量项目归为 `AI project with insufficient paradigm signal`，说明范式分类规则需要 enrichment 和规则补强。
- `config.test.ts`、`llm.test.ts`、`storage/files` 测试仍未补齐。

## 下一阶段入口

进入 `trendshift-github-enrichment.exec-plan.md`，只做一个短阶段：

```bash
corepack pnpm run-daily -- --dry-run --no-agents-radar --no-github
```

若 Trendshift 网络仍不稳定，先改为 snapshot fixture，不继续长程重试。

## 背景

agent-trend-radar 与 agents-radar-system 使用相近的 TypeScript / Node / pnpm 工程栈，也共享部分工程问题：

- YAML 配置读取。
- 日期、CST/UTC、sleep helper。
- LLM Provider 抽象和 429 retry。
- Markdown 报告生成。
- 文件系统落盘。
- Vitest 测试风格。

但两者系统职责不同：

- agents-radar-system 是上游 digest producer。
- agent-trend-radar 是下游 trend decision engine。

因此复用必须围绕“通用工具层”和“实现模式”展开，不能搬运主业务链路。

## 总体策略

### 阶段 1：直接复制通用基础层

目标是尽快建立可运行的基础工具，不浪费 token 重写已验证的通用逻辑。

| 来源文件 | 目标文件 | 处理方式 | 理由 |
| --- | --- | --- | --- |
| `../agents-radar-system/src/date.ts` | `src/date.ts` | 直接 cp 后按需删减 | CST/UTC 日期、sleep helper 通用 |
| `../agents-radar-system/src/providers/` | `src/providers/` | 直接 cp 目录后改默认语义 | Provider 抽象可复用，后续只服务 semantic classification |
| `../agents-radar-system/src/__tests__/providers.test.ts` | `src/__tests__/providers.test.ts` | cp 后改期望文案 | Provider 测试覆盖 SDK mock、空响应、秘钥不泄漏 |

### 阶段 2：复制后改造配置与 LLM 调用

目标是复用结构，但替换成 agent-trend-radar 的配置和 score/LLM 边界。

| 来源文件 | 目标文件 | 处理方式 | 必改点 |
| --- | --- | --- | --- |
| `../agents-radar-system/src/config.ts` | `src/config.ts` | cp 后重写 schema | 读取 `config.yaml` 的 source、weights、thresholds、llm、runtime |
| `../agents-radar-system/src/report.ts` | `src/llm.ts` 或 `src/providers/call.ts` | 抽取 `callLlm`、429 retry、并发限制 | 删除 `saveFile` 和 agents-radar footer；强调 LLM 只做 classification |
| `../agents-radar-system/src/__tests__/config.test.ts` | `src/__tests__/config.test.ts` | cp 后重写用例 | 测试权重、阈值、source 默认、rules-only |
| `../agents-radar-system/src/__tests__/report.test.ts` | `src/__tests__/llm.test.ts` | cp 后保留 429/retry 测试 | 删除 saveFile/footer 断言 |

### 阶段 3：改造文件落盘与报告构建模式

目标是快速建立 `data/` 落盘、daily report 和后续 weekly/KB 的输出框架。

| 来源文件 | 目标文件 | 处理方式 | 必改点 |
| --- | --- | --- | --- |
| `../agents-radar-system/src/report.ts` | `src/storage/files.ts` | 只借鉴 `saveFile` 模式 | 路径改为 `data/raw|normalized|scores|reports|kb`，支持 dry-run |
| `../agents-radar-system/src/report-builders.ts` | `src/action/dailyReport.ts` | 参考 Markdown 拼接模式，不直接复制业务内容 | 输出围绕 ScoreBreakdown evidence |
| `../agents-radar-system/src/rollup.ts` | `src/action/weeklyReport.ts` | 参考“读取最近 7 天 + 截断 + 汇总”模式 | 输入改为 `data/scores/*.jsonl`，不是 digest Markdown 摘要 |
| `../agents-radar-system/src/__tests__/rollup.test.ts` | `src/__tests__/weeklyReport.test.ts` | 借鉴日期/周字符串测试 | 周报必须断言趋势短语输出 |

### 阶段 4：按需改造上游连接器

目标是复用 agents-radar 的采集经验，但不重复生产它已经生产的 digest。

| 来源文件 | 目标文件 | 处理方式 | 必改点 |
| --- | --- | --- | --- |
| `../agents-radar-system/src/trending.ts` | `src/signal/trendshiftConnector.ts` | 只参考 HTML fetch、User-Agent、失败降级 | 上游换成 `https://trendshift.io`，保留 snapshot 测试 |
| `../agents-radar-system/src/github.ts` | `src/signal/githubMetrics.ts` | 只抽 GitHub repo metrics 类型和 fetch helper | 不搬 Issue 创建、label、neutralize 发布逻辑 |
| 无直接来源 | `src/signal/agentsRadarConnector.ts` | 新写，但可参考 manifest/RSS 枚举模式 | 读取 `../agents-radar-system/manifest.json` 和 `digests/` |

### 阶段 5：暂不搬运的边界

以下代码不要在第一阶段搬运，避免扩大范围。

| 来源 | 原因 |
| --- | --- |
| `../agents-radar-system/src/index.ts` | 主链路职责不同，不能复用 digest producer 编排 |
| `../agents-radar-system/src/prompts.ts` | 针对 AI CLI/Agent 日报，不适合 ScoreBreakdown |
| `../agents-radar-system/src/prompts-data.ts` | 针对多源日报和 rollup，不适合本项目 Action 层 |
| `../agents-radar-system/src/report-savers.ts` | 绑定 GitHub Issue 发布和日报类型 |
| `../agents-radar-system/mcp/` | 本项目第一阶段不做 MCP |
| `../agents-radar-system/.github/workflows/*` | 实现未完成前不接 CI/Actions |
| `../agents-radar-system/index.html` / `feed.xml` | Web/RSS 发布不是当前目标 |
| `../agents-radar-system/src/notify.ts` / `src/feishu.ts` | 通知不是第一阶段目标 |

## 详细实施顺序

### Step 1：复制 date helper

动作：

1. cp `../agents-radar-system/src/date.ts` 到 `src/date.ts`。
2. 删除或保留无害 helper，但不得引入 agents-radar 报告语义。
3. 增加或调整测试，确保 CST 日期用于 data 文件名和 report 日期。

验证：

- 单元测试：CST date、UTC string、sleep。
- 冒烟：能 import `src/date.ts`。

### Step 2：复制 Provider 抽象

动作：

1. cp `../agents-radar-system/src/providers/` 到 `src/providers/`。
2. cp `../agents-radar-system/src/__tests__/providers.test.ts` 到 `src/__tests__/providers.test.ts`。
3. 修改文案：Provider 仅服务 `semantic classification`。
4. 确认 `llm.enabled=false` 时不会创建 Provider。

验证：

- Provider 工厂测试。
- 空响应测试。
- secret 不泄漏测试。
- rules-only 不触发 Provider 测试。

### Step 3：改造 LLM 调用层

动作：

1. 从 `../agents-radar-system/src/report.ts` 抽 `callLlm`、`is429`、并发限制、retry。
2. 新建 `src/llm.ts` 或 `src/providers/call.ts`。
3. 删除 agents-radar 的 `saveFile`、`autoGenFooter`、报告 token 常量。
4. 新增 semantic classification token budget。

验证：

- 429 retry。
- 非 429 直接抛错。
- 并发 slot 不泄漏。
- rules-only 模式不调用 LLM。

### Step 4：改造 config loader

动作：

1. cp `../agents-radar-system/src/config.ts` 到 `src/config.ts`。
2. 重写 RawConfig / RadarConfig 为 TrendRadarConfig。
3. 支持 `sources.agents_radar`、`sources.trendshift`、`llm`、`weights`、`thresholds`、`runtime`。
4. 校验权重缺失、负数、总和异常。

验证：

- `config.yaml` 缺失时使用默认。
- 部分字段缺失时分段默认。
- 权重读取和归一化。
- rules-only 默认。

### Step 5：建立 storage/files

动作：

1. 参考 `saveFile` 新建 `src/storage/files.ts`。
2. 实现 writeJsonl、readJsonl、writeMarkdown、ensureDir。
3. 所有写入函数必须支持 dry-run。

验证：

- dry-run 不写文件。
- 正常写入创建父目录。
- JSONL 读写 roundtrip。

### Step 6：实现 agents-radar connector

动作：

1. 新写 `src/signal/agentsRadarConnector.ts`。
2. 读取 `config.sources.agents_radar.manifest_path`。
3. 根据 date 和 report types 定位 Markdown。
4. 解析 GitHub links、表格项目、列表项目为 RawSignal。
5. 保存 raw snapshot。

可借鉴：

- `generate-manifest.ts` 的日期目录枚举思路。
- `mcp/src/index.ts` 的 manifest/report 读取思路，但不要搬 MCP 协议。

验证：

- 用 `../agents-radar-system/manifest.json` fixture。
- 用 `ai-trending.md`、`ai-agents.md` fixture。
- 缺 report 时 warning，不生成假项目。

### Step 7：实现 Trendshift connector

动作：

1. 新写 `src/signal/trendshiftConnector.ts`。
2. 先支持 `snapshot` 模式。
3. 再支持 `http` 模式抓取 `https://trendshift.io` 页面。
4. 输出 RawSignal，不编造缺失指标。

可借鉴：

- `trending.ts` 的 fetch + User-Agent + 失败降级。
- `web.ts` 的 metadata-only 边界意识。

验证：

- snapshot fixture。
- HTTP 失败降级。
- HTML 结构变化时不静默成功。

### Step 8：实现 normalization

动作：

1. 新写 `src/signal/normalizer.ts`。
2. canonicalize GitHub repo URL。
3. 合并 sources、tags、description、metrics。

验证：

- 同 repo 多源合并。
- 缺 repo_url 的信号跳过或进入 warning。
- agents-radar 自然语言不覆盖 Trendshift 结构化指标。

### Step 9：实现 scoring engine

动作：

1. 新写 `src/filter/scoreEngine.ts`。
2. 实现 6 个组件。
3. 输出 ScoreBreakdown。
4. 所有组件必须带 evidence。

验证：

- 每个组件成功路径和缺证据路径。
- fake-star 防护。
- 权重变化影响 total。
- total 等于 weighted sum。

### Step 10：实现 daily report

动作：

1. 参考 `report-builders.ts` 的 Markdown 拼接模式。
2. 新写 `src/action/dailyReport.ts`。
3. 输出今日新项目、高分项目、异常增长项目、趋势短语。

验证：

- 快照测试。
- 高分项目必须展示 evidence。
- 异常增长低 engagement 必须标风险。

## 与最小闭环计划的关系

本计划是 `minimum-loop.exec-plan.md` 的代码复用版。实施时应优先执行本文件，因为它明确哪些能 cp，避免重复造轮子。

## 验证矩阵

| 类型 | 验证内容 | 命令或方法 |
| --- | --- | --- |
| 单元 | date/config/llm/storage/scoring | `pnpm test` |
| 集成 | agents-radar connector + normalization + score | `run-daily --date <date> --dry-run` |
| 回归 | rules-only 不调用 Provider | targeted test |
| 结构 | config weights 与 scoring Spec 一致 | 后续 `spec-structure-check` |
| 文档 | 搬运状态与 Spec 同步 | 审查本文件和 `reuse-from-agents-radar.md` |

## 回滚策略

- 如果直接 cp 的模块引入不必要依赖，先删减目标文件，而不是改上游项目。
- 如果 Provider 搬运导致安装依赖过多，可以保留接口和测试，延迟安装 SDK。
- 如果 Trendshift HTTP 解析不稳定，回退到 snapshot 模式，保持最小闭环可运行。

## Open Question

- Provider SDK 依赖是否第一阶段就安装，还是先保留接口和 mock 测试？
- Trendshift 是否后续提供稳定 API？如果有，应优先替换 HTTP HTML parser。
- 是否在 Step 10 后立即接 weekly report，还是先补完整 ScoreBreakdown 结构测试？
