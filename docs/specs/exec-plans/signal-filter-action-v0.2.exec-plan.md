# 执行计划：Signal -> Filter -> Action v0.2 落地

## 文档状态

- 版本：`v0.2`
- 当前状态：`Completed`
- 完成口径：本计划按“MVP 优先”范围验收完成，已交付可实测的主链路最小版本；后续增强项不再继续堆叠在本计划内，而是转入独立 follow-up exec-plan。
- 目标：把已批准的 `signal-filter-action-version-design.md` 落成一条可运行、可验证、可降级、可解释的主链路，优先完成 `run-daily -> normalize -> score -> daily report -> run summary -> verify-daily` 的最小闭环。
- 原则：先守住 `Signal -> Normalize -> Score -> Daily Report` 的可运行主链路，再把 weekly、KB、真实 provider、UI 与更强新鲜度增强拆成独立后续计划。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Signal -> Filter -> Action v0.2 落地 |
| 负责人 | Codex |
| 关联设计规格 | `docs/specs/design-docs/signal-filter-action-version-design.md` |
| 关联产品规格 | `docs/specs/product-specs/agent-trend-radar-product-spec.md` |
| 关联服务规格 | `services/signal-ingestion.md`、`services/normalization.md`、`services/scoring-engine.md`、`services/action-output.md`、`services/cli-runtime.md` |
| 风险等级 | `High` |
| 影响范围 | `src/`、`src/__tests__/`、`data/`、`config.yaml`、`docs/specs/` |

## 本计划的范围定义

### 本计划已覆盖

- daily 主链路最小闭环
- 至少三类信号面的统一接入语义：
  - `agents-radar`
  - `Trendshift`
  - `GitHub enrichment`
- explainable scoring baseline
- trust-first / anti-noise 基础护栏
- 中文 daily report / run summary / verify-daily
- 多日 persistence、same-day dedupe、artifact 回退、CLI 写盘与基本 harness

### 本计划明确不再继续覆盖

- 更强 GitHub 新鲜度与 live delta 细化
- weekly 深层归纳质量继续打磨
- knowledge card 更细的表达优化
- 真实 provider 驱动的 semantic classification 端到端联调
- UI / Visual Console 落地

这些能力后续必须进入独立 exec-plan，而不是继续回填到本计划。

## 边界约束

### 允许修改

- `src/signal/*`
- `src/filter/*`
- `src/action/*`
- `src/cli.ts`
- `src/types.ts`
- `src/__tests__/*`
- `data/` 下用于主链路产物的目录与样例
- 与主链路强相关的 spec / exec-plan / runbook

### 禁止修改

- 不借本计划重写整套架构
- 不把 LLM 改成直接决定最终分数
- 不把 HTML 页面语义硬推为可信结构化指标
- 不把缺失数据强行伪装成 `0`
- 不在本计划内扩张 UI、数据库、服务化部署等新产品边界

### 兼容性约束

- 现有 CLI 命令名保持兼容：
  - `run-daily`
  - `verify-daily`
  - `score`
  - `run-weekly`
  - `build-kb`
- 现有 report / run-summary / enrichment audit 路径保持兼容
- 旧 artifact 在缺少新增字段时仍应可被读取或安全降级

## 验收标准

本计划的完成标准按 MVP 口径定义，满足以下条件即视为完成：

1. `run-daily` 能稳定产出：
   - `raw`
   - `normalized`
   - `scores`
   - `daily report`
   - `run summary`
2. `verify-daily` 能消费主链路产物并输出 `pass / warn / fail`。
3. 三类核心信号能够进入同一条 daily pipeline，并在失败时明确区分：
   - `active`
   - `empty`
   - `failed`
   - `disabled`
4. 评分输出可解释的 `ScoreBreakdown`，至少覆盖：
   - `star_velocity`
   - `engagement_score`
   - `architecture_shift`
   - `compounding_capability`
   - `autonomy_score`
   - `discussion_score`
5. `architecture_shift` 遵守“Agent 范式突破优先”的解释基准，不退化为纯工程结构判断。
6. `anti-noise` 与 `trust-first` 护栏成立：
   - 未知不填 `0`
   - 稀疏证据降级为 `insufficient_data` / `low_confidence`
   - 单源或单日项目不直接升到 `high confidence`
7. 主链路具备最小可复现验证：
   - `pnpm typecheck`
   - 至少一组单元/集成测试
   - 至少一次 CLI 级 `run-daily`
   - 至少一次 `verify-daily`

## 当前状态判断

按上述验收标准复盘，当前实际情况是：

- 主链路 MVP：已完成
- 可运行、可写盘、可自检：已完成
- 评分与置信度基础护栏：已完成
- 基础多日 persistence / dedupe / fallback：已完成
- 后续增强项：仍存在，但已超出本计划 MVP 边界

因此本计划从“持续开发计划”切换为“已完成交付记录”。

## 当前进度

- 总体进度：`Completed`
- MVP 主链路：`run-daily -> normalize -> score -> daily report -> run summary -> verify-daily` 已完成并可实测。
- 文档形态：已从“待继续铺开的开发计划”切换为“按实际交付回填的进度账本”。
- 剩余事项：仅保留风险记录与后续入口说明，不再在本计划内继续追加新范围。

## 阶段进度

| 阶段 | 状态 | 完成证据 | 备注 |
| --- | --- | --- | --- |
| Phase 0：骨架与本地最小闭环 | `Done` | CLI、normalize、rules-only scoring、daily/weekly/KB 基础产物已落地 | 已作为后续一切工作的稳定底座 |
| Phase 1：Signal enrichment | `Done` | RawSignal 校验、Trendshift snapshot/parser、GitHub fallback/cache、多日 merge、watchlist、source 状态模型已落地 | 更强 GitHub 新鲜度后移到独立计划 |
| Phase 2：Filter hardening | `Done` | explainable scoring、architecture evidence、low-confidence / insufficient-data、anti-noise、trust-first gating 已落地 | 真实 provider 语义增强后移 |
| Phase 3：Action quality | `Done` | daily report、run summary、verify-daily、weekly anti-noise summary、KB preserve merge 已落地 | weekly/KB 语言质量仍可继续增强 |
| Phase 4：Feedback & Harness closure | `Done` | typecheck、specStructure、CLI workflow、多日集成、runbook、基本 harness 收口已完成 | 更强 harness 可独立继续演进 |

## 已落地内容

### 主链路

- 已建立 `data/raw`、`data/normalized`、`data/scores`、`data/reports`、`data/kb`、`data/classifications` 产物链路。
- 已打通 `run-daily -> normalize -> score -> daily report -> run summary -> verify-daily`。
- 已支持 `run-weekly` 与 `build-kb` 的最小版本输出。

### Signal 层

- `agents-radar` 本地 digest 接入已落地。
- Trendshift snapshot fixture、parser、live 页面回退与最近 artifact fallback 已落地。
- `RawSignal` 已采用 `Zod` 做 schema 校验，并与语义防毒分层执行，避免脏输入直接污染 normalize / score。
- GitHub metrics 支持：
  - API / HTML / cache / unavailable 分层
  - cache 预热
  - timeout / fast-fail / fallback notes
  - enrichment audit 写盘
- Source 状态统一建模为：
  - `active`
  - `empty`
  - `failed`
  - `disabled`

### Normalize / Score

- 已落地跨天 merge、appearance_dates、persistence_state、source_counts。
- 已修复 same-day multi-source 对 weekly delta 的重复放大。
- 已落地 strongest-description、best-evidence line、中文 tag 推断。
- 已建立 trust-first 评分与 confidence gating。
- 已把 `architecture_shift` 固定为 Agent 范式解释，而不是普通工程结构解释。

### Action / 可观测性

- 已生成中文 `daily report`。
- 已生成中文 `run summary`。
- 已落地 `recommended_actions`、watchouts、top projects、source status。
- 已落地 `verify-daily` 命令级自检。
- 已把 KB 与报告输出的 `机器-人工` 边界固化为文档契约，不用自动流程覆盖人工保留内容。
- 已落地 `PRACTICAL_RUNBOOK.md` 作为实操手册。

### Harness / 验证

- 已有 `specStructure`、`cliWorkflow`、`githubMetrics`、`signalCollection`、`dailyVerification`、`runSummary` 等测试守护。
- 已把 `跨天/重入测试` 纳入 CLI workflow 回归，覆盖多日 persistence、out-of-order backfill 与重复运行稳定性。
- 已支持 out-of-order backfill 回归测试。
- 已补齐 conda 环境入口与 CLI 级回放路径。

## 当前残余风险

这些风险真实存在，但已不再阻塞本计划的 MVP 完成状态：

- GitHub 新鲜度仍受网络环境与 token 配置影响。
- weekly / KB 的“表达质量”仍可继续打磨。
- 真实 provider 驱动的 semantic classification 尚未做强联调。
- UI 仍仅有设计文档，没有落地实现。

这些问题应通过新 exec-plan 处理，而不是继续延长本计划生命周期。

## 验证记录

| 时间 | 命令 / 事实 | 结果 | 说明 |
| --- | --- | --- | --- |
| 2026-04-25 | `corepack pnpm typecheck` | 通过 | 类型检查基线恢复 |
| 2026-04-25 | `corepack pnpm test -- watchlist rawSignalSchema trendshiftConnector normalize scoring specStructure` | 通过 | Signal + scoring 基础回归通过 |
| 2026-04-25 | `corepack pnpm run-daily -- --date 2026-04-23 --dry-run --no-github` | 通过 | 组合链路 dry-run 跑通，`64 raw / 58 normalized / 58 scored` |
| 2026-04-25 | `corepack pnpm build-kb -- --dry-run` | 通过 | KB 最小链路可稳定生成 |
| 2026-04-25 | `corepack pnpm test -- config githubMetrics cliWorkflow llmClassification scoring actionOutput specStructure` | 通过 | 配置护栏、GitHub cache fallback、CLI 写盘、classification skeleton 全部通过 |
| 2026-04-26 | `corepack pnpm test -- runSummary actionOutput cliWorkflow` | 通过 | daily report MVP 可读性与 run summary 写盘通过 |
| 2026-04-26 | `corepack pnpm test -- cliWorkflow normalize scoring runSummary` | 通过 | 连续 3 天 persistence / dedupe / weekly delta 集成通过 |
| 2026-04-26 | `corepack pnpm test -- signalCollection githubMetrics runSummary cliWorkflow` | 通过 | source 状态细分、GitHub fallback 与 run summary 观测通过 |
| 2026-04-26 | `corepack pnpm test -- dailyVerification cliWorkflow specStructure` | 通过 | `verify-daily` 命令级自检通过 |
| 2026-04-26 | `corepack pnpm run-daily -- --date 2026-04-26` | 通过 | 真实主链路完成，MVP completion signal=true |
| 2026-04-26 | `corepack pnpm verify-daily -- --date 2026-04-26` | 先 `warn` 后 `pass` | 真实链路从 source failure 收敛到 trust-first 可接受状态 |
| 2026-04-26 | `curl example.com / github.com / api.github.com` | 部分通过 | 已确认 GitHub 不健康主要是环境出站问题，不是主链路代码失效 |
| 2026-04-27 | `corepack pnpm run-daily -- --date 2026-04-27` | 通过 | 当前链路可继续稳定产出日报与 run-summary |
| 2026-04-27 | `corepack pnpm verify-daily -- --date 2026-04-27` | `warn` | 当前 warning 主因是环境未配置 `GITHUB_TOKEN`，属于可观测的环境缺口，不再是主链路断裂 |
| 2026-04-27 | GitHub star delta trust follow-up 完成 | 已完成 | 该增强能力已从本计划拆出并独立收口 |

## 验证矩阵

| 类型 | 验证内容 | 命令 | 通过标准 |
| --- | --- | --- | --- |
| 静态 | 类型检查 | `pnpm typecheck` | 无类型错误 |
| 结构 | Spec/exec-plan 结构守护 | `pnpm test -- specStructure` | 结构测试通过 |
| 单元 | signal / score / action 关键回归 | `pnpm test -- githubMetrics signalCollection runSummary dailyVerification` | 关键模块回归通过 |
| 集成 | 多日 persistence / re-entry | `pnpm test -- cliWorkflow` | 多日合并、dedupe、out-of-order backfill 通过 |
| CLI | 最小 daily 链路 | `pnpm run-daily -- --date <date>` | raw/normalized/scored/report/run-summary 写盘 |
| CLI | daily 自检 | `pnpm verify-daily -- --date <date>` | 可输出 `pass / warn / fail` 并附原因 |
| CLI | 周报 / KB 最小链路 | `pnpm run-weekly -- --date <date>`、`pnpm build-kb -- --since <date>` | 可生成产物 |

## 回滚策略

- 若 GitHub enrichment 不稳定，允许退回 `--no-github` 路径，不阻塞 daily 主链路。
- 若 Trendshift live 页面漂移，允许退回 snapshot 模式，不阻塞 normalize / score / report。
- 若某条评分规则导致误杀，优先回退到更保守的 `insufficient_data` / `low_confidence`，而不是强推高分。
- 若 weekly / KB 表达退化，允许回退模板表达，不回退已验证的数据与评分层。

## 结论记录

- 2026-04-25：本计划正式切换为“MVP 优先”，不再把真实外部联调作为前置阻塞项。
- 2026-04-26：主链路已真实跑通，`run-daily` 与 `verify-daily` 进入可实测状态。
- 2026-04-26：trust-first scoring 成立，系统从“高分但不可信”收敛为“保守但可信”。
- 2026-04-27：GitHub star delta trust 能力已拆分为独立计划并完成，不再继续污染本计划边界。
- 2026-04-28：按当前实际情况复盘，本计划应收口为 `Completed`；剩余工作属于增强项，而不是未完成的 MVP。

## 下一阶段入口

None. 本计划已按 MVP 口径完成验收。

后续新增需求应进入新的独立 exec-plan，例如：

- GitHub 新鲜度 / 更强 live data follow-up
- weekly / KB 表达质量增强
- UI / Visual Console 落地
- 真实 provider 驱动的 classification 增强
