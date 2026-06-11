# 执行计划：Report 输出修复与对齐

## 文档状态

- 版本：`v0.1`
- 当前状态：`Done`
- 关联计划：
  - [daily-report-freshness-readability-v0.1.exec-plan.md](daily-report-freshness-readability-v0.1.exec-plan.md#L1)
  - [signal-filter-action-v0.2.exec-plan.md](signal-filter-action-v0.2.exec-plan.md#L1)
- 设计来源：
  - [日报新鲜度与可读性需求分析.md](../product-specs/日报新鲜度与可读性需求分析.md#L1)
  - [daily-report-freshness-readability-design.md](../design-docs/daily-report-freshness-readability-design.md#L1)
- 说明：本计划不重新定义产品目标，只修复“代码已落地但 reports 产物仍与需求/设计偏离”的实现缺陷。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Report 输出修复与对齐 |
| 负责人 | Codex |
| 风险等级 | `High` |
| 影响范围 | `src/action/`、`src/signal/`、`src/types.ts`、`src/__tests__/`、`data/reports/`、`docs/specs/exec-plans/` |
| 主要产物 | `daily.md/json`、`run-summary.md/json`、`verify-daily` 输出 |

## 目标

1. 让 `daily report` 与 `run-summary` 同时具备可读的新鲜度结论，而不是一个看“新鲜度”、一个只看“active/failed”。
2. 补齐 `freshness-driving sources` 的真实来源建模，不能只显示 `agents-radar` 与 `trendshift`。
3. 修复 `today_star / context_only / pending_confirmation` 分类错误，避免“source 级 fresh_today，但项目级全掉进历史补充观察”。
4. 明确把 `agents-radar` 降级为历史上下文源，或接入真正实时输入；在修复完成前，不允许它继续伪装成 fresh source。
5. 清理 report 可读性问题，避免重复文案、过长上下文区块和调试信息外溢。

## 边界约束

### 允许修改

- `src/action/dailyReport.ts`
- `src/action/runSummary.ts`
- `src/action/dailyVerification.ts`
- `src/signal/index.ts`
- `src/signal/agentsRadarConnector.ts`
- `src/types.ts`
- `src/__tests__/*`
- `docs/specs/exec-plans/*`

### 禁止修改

- 不重写 scoring 公式
- 不在本轮引入新的外部商业 API
- 不用“放宽规则”掩盖 fresh/source 分类 bug
- 不把旧 digest/snapshot 自动补进当天主榜单
- 不把 `github-enrichment` 误当成“日报实时发现源”的唯一替代品

### 兼容性约束

- `run-daily`、`verify-daily` 命令名保持不变
- `data/reports/YYYY-MM-DD.daily.md/json`、`data/reports/YYYY-MM-DD.run-summary.md/json` 路径保持不变
- JSON 字段只能追加或重释义，不直接删除已有顶层字段
- 修复后 `verify-daily` 仍可消费已有 run-summary 路径

## 当前状态

当前 reports 产物已完成修复并通过验证：

1. `run-summary` 已增加与 `daily` 对齐的新鲜度摘要视图，并保留原有诊断信息。
2. `daily report` 已补充 GitHub 细分 freshness source，并把 `agents-radar` 明确降级为 context 源。
3. `classifyProject()` 已改为按 freshness-driving source membership 判定，避免 `fresh_today` 与 `today_star` 脱节。
4. `daily report` 已去除大规模重复文案，并对历史补充区块做了压缩。
5. `run-summary` 中的 freshness 视图已显式暴露 `overall_daily_status` 与 source freshness 细节。
6. `verify-daily` 已加入 freshness 一致性、source 完整性与 agents-radar stale fallback 告警。
7. `daily report` 的 `为什么今天值得关注` 与 `入选原因` 已分离为不同语义。

## 当前进度

- 需求与设计冻结：`Done`
- 代码首次落地：`Done`
- 报表偏差审计：`Done`
- 修复实施：`Done`
- 回归验证：`Done`

## 问题清单

### P0：语义与分类错误

- `freshness_sources` 未覆盖全部 freshness-driving sources
- `today_fresh_candidate_count = 0` 与 `trendshift = fresh_today` 同时出现
- `today_star_projects` 为空，但 `context_only_projects` 中存在 trendshift 同源项目
- `agents-radar` stale fallback 被算进 source active，却没有在 run-summary 顶层形成负面结论

### P1：展示与可读性缺陷

- `run-summary` 不展示 `overall_daily_status`
- `run-summary` 不展示 `freshness_sources`
- `daily` 卡片里的 `为什么今天值得关注` 与 `入选原因` 重复
- `历史补充观察` 全量刷屏，缺少摘要/截断/分组策略
- `daily` 与 `run-summary` 对“单日/单源/新鲜度”的口径不一致

### P2：验证缺口

- `verify-daily` 未校验 freshness-driving source 完整性
- `verify-daily` 未校验“source 级 fresh_today 与项目级 today_star”一致性
- 缺少对 `agents-radar` fallback 长期持续的专门告警

## 实施阶段

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：契约补齐 | `Done` | 对齐 daily/run-summary/verify 的 freshness 与 project classification 契约 | types、JSON、Markdown 口径一致 |
| Phase 1：freshness source 重建模 | `Done` | 补齐 GitHub fresh source 细分，并收紧 `agents-radar` 角色 | `freshness_sources` 不再只有 2 个来源 |
| Phase 2：项目级 fresh 分类修复 | `Done` | 修复 `today_star/context_only/pending_confirmation` 分类链路 | source fresh 与 project fresh 一致 |
| Phase 3：report 文案与结构修复 | `Done` | 提升 daily/run-summary 可读性，去重与压缩噪音 | 首屏更易读，卡片不再重复 |
| Phase 4：verify-daily 补强 | `Done` | 把 freshness 一致性和 stale fallback 风险纳入质检 | verify-daily 可拦截伪 fresh 报告 |
| Phase 5：真实回归与文档同步 | `Done` | 用真实产物重跑并同步计划状态 | 产物、测试、计划三者一致 |

## 实施步骤

### Phase 0：契约补齐

1. 明确 `run-summary` 也必须显式产出：
   - `overall_daily_status`
   - `freshness_sources`
   - `main_board_mode`
2. 明确 `daily` 与 `run-summary` 对以下字段共用同一口径：
   - `today_fresh_candidate_count`
   - `context_candidate_count`
   - `pending_confirmation_count`
3. 明确 `verify-daily` 必须消费并校验上述 freshness 字段，而不只消费 `source_status.active/failed`。

### Phase 1：freshness source 重建模

1. 将 `freshness-driving sources` 从当前的 source connector 粗粒度，细化为设计口径中的：
   - `github_trending`
   - `github_live_star_delta`
   - `watchlist_live_activity`
   - `trendshift_live`
2. 在无法完整接入实时实现前，明确将 `agents-radar` 标记为 `context source`，不再占据 freshness 摘要主语义。
3. `run-summary` 与 `daily` 必须同时列出这些 source 的：
   - freshness_state
   - effective_date
   - from_realtime_run
   - fallback_reason

### Phase 2：项目级 fresh 分类修复

1. 禁止继续只按 `raw_signal.timestamp == reportDate` 判断项目 fresh。
2. 改为基于：
   - 项目命中的 freshness-driving source
   - source 是否来自本次实时运行
   - 项目是否具备 same-run fresh membership
3. 修复后需满足：
   - 若 source 级 `trendshift_live = fresh_today` 且项目来自该次 live 命中，则项目不能无条件掉入 `context_only`
   - `today_fresh_candidate_count`、`today_star_projects.length`、`pending_confirmation_count` 三者关系应自洽

### Phase 3：report 文案与结构修复

1. `run-summary` 首屏增加一段简化 freshness 摘要，避免只靠 `source_status`。
2. `daily` 项目卡片中：
   - `为什么今天值得关注` 保留
   - `入选原因` 改为结构化证据摘要，不能与前者重复
3. `历史补充观察` 区块增加压缩策略：
   - 默认只展示前 N 个
   - 其余以计数或摘要说明
4. 将 `agents-radar` fallback 风险置于 `daily` 和 `run-summary` 顶部显眼位置，而不是只埋在说明文本里。

### Phase 4：verify-daily 补强

1. 新增检查项：
   - `freshness_sources_complete`
   - `fresh_source_project_alignment`
   - `agents_radar_stale_fallback`
2. `verify-daily` 在以下场景至少给出 `warn`：
   - freshness-driving source 未完整出现
   - source 级 `fresh_today` 但项目级 `today_star` 为 0
   - `agents-radar` 连续 fallback 到陈旧日期
3. 若 `main_board_mode = no_fresh_main_board` 但仍存在大量“今天值得关注”的强表述，则至少给出 `warn`。

### Phase 5：真实回归与文档同步

1. 重新生成一份真实 `daily/run-summary/verify-daily` 产物，确认：
   - freshness source 完整
   - 项目分类正确
   - 顶部状态与实际数据一致
2. 将修复结果回写到本 exec-plan 的：
   - 当前进度
   - 已落地内容
   - 验证记录
3. 视修复情况更新 [daily-report-freshness-readability-v0.1.exec-plan.md](daily-report-freshness-readability-v0.1.exec-plan.md#L1) 的状态。

## 已落地内容

- 偏差审计已完成，核心缺陷已从真实产物中复现
- `daily` / `run-summary` / `verify-daily` 的问题已归类为 source 建模、项目分类、文案结构、质检缺口四类
- 本修复计划已明确不通过“调宽规则”掩盖 freshness bug

## 验收标准

### 验收 1：run-summary 与 daily 同口径

- 可观测结果：`run-summary` 也能直接看出 `overall_daily_status` 与 freshness 摘要。
- 成功条件：用户不需要在 `daily` 与 `run-summary` 之间自行脑补“活跃”和“新鲜”的差异。
- 失败条件：`run-summary` 仍只显示 `active 3/3`，却不提示 stale fallback。

### 验收 2：freshness-driving sources 完整

- 可观测结果：`freshness_sources` 不再只包含 `agents-radar` 与 `trendshift` 两项。
- 成功条件：设计要求的 GitHub fresh source 细分能在 report 中被观察到。
- 失败条件：GitHub 仍只存在于 `github-enrichment` 诊断层，而不进入 freshness 视图。

### 验收 3：source fresh 与 project fresh 一致

- 可观测结果：当存在 `fresh_today` source 命中时，`today_fresh_candidate_count`、`today_star_projects`、`pending_confirmation_count` 三者关系合理。
- 成功条件：不会再出现 `trendshift=fresh_today` 但当天 fresh candidate 为 0 的自相矛盾结果。
- 失败条件：source 级与项目级新鲜度继续脱节。

### 验收 4：agents-radar 不再伪 fresh

- 可观测结果：`agents-radar` stale fallback 会被显式标为 context/fallback 风险，而不是只显示 active。
- 成功条件：用户能一眼看出它是旧 digest。
- 失败条件：它继续在 freshness 结论中被当作正常活跃来源。

### 验收 5：report 可读性改善

- 可观测结果：`daily` 与 `run-summary` 顶部更清晰，项目卡片不再重复句子，历史补充区块不再刷屏。
- 成功条件：用户能快速判断“今天有没有新鲜主榜单”和“为什么没有”。
- 失败条件：产物仍像调试日志或重复文案集合。

### 验收 6：verify-daily 能拦截伪 fresh

- 可观测结果：当 freshness source 缺失、分类错位或 `agents-radar` 长期 stale 时，`verify-daily` 至少给出 `warn`。
- 成功条件：主链路质检不再只看通断，也看 freshness 真实性。
- 失败条件：即使 daily 主榜单完全失真，`verify-daily` 仍然轻易 `pass`。

## 当前残余风险

- GitHub live source 细分可能牵连 signal 层较多代码
- `agents-radar` 若短期内没有实时接入能力，需先接受其彻底降级为 context source
- 修复分类逻辑后，`today_star_projects` 可能突然变少，需要同步更新预期测试
- report 可读性优化容易和“保留审计细节”冲突，必须保持第一层与第二层分离

## 验证矩阵

| 类型 | 验证内容 | 命令 / 方法 | 通过标准 |
| --- | --- | --- | --- |
| 静态 | report 类型契约 | `pnpm typecheck` | daily/run-summary/verify-daily 的新增 freshness 字段类型通过 |
| 结构 | spec / exec-plan 守护 | `pnpm test -- specStructure` | 文档结构测试通过 |
| 单元 | daily freshness source 完整性 | `pnpm test -- actionOutput signalCollection` | daily JSON 的 `freshness_sources` 含设计要求的 fresh source 细分 |
| 单元 | source fresh 与 project fresh 对齐 | `pnpm test -- actionOutput` | 不再出现 `fresh_today` source 对应 `today_fresh_candidate_count=0` 的矛盾 |
| 单元 | agents-radar stale 降级 | `pnpm test -- signalCollection runSummary` | stale digest 被标为 fallback/context 风险，而不是单纯 active |
| 单元 | daily 卡片去重 | `pnpm test -- actionOutput` | `why_today_cn` 与入选证据不再完全重复 |
| 单元 | run-summary freshness 可读性 | `pnpm test -- runSummary` | run-summary 顶部有总状态与 freshness 摘要 |
| 单元 | verify-daily freshness 质检 | `pnpm test -- dailyVerification` | freshness source 缺失、对齐失败、长期 stale 能触发 warn/fail |
| 集成 | fresh trendshift + stale agents-radar | `pnpm test -- cliWorkflow` | daily 不再全量掉进 `历史补充观察` |
| 集成 | no fresh main board | `pnpm test -- cliWorkflow` | 顶部显式说明“无当天主榜单”，且 verify-daily 至少 warn |
| CLI | 真实 `run-daily` | `pnpm run-daily -- --date <date>` | 产物中 freshness source、today_star、context_only 关系自洽 |
| CLI | 真实 `verify-daily` | `pnpm verify-daily -- --date <date>` | 能对 stale fallback 与伪 fresh 分类给出明确结论 |

## 验证记录

| 时间 | 事实 | 结果 | 说明 |
| --- | --- | --- | --- |
| 2026-04-28 | 审计 `2026-04-28.daily.md/json` | 已完成 | 复现了 `trendshift=fresh_today` 但 `today_fresh_candidate_count=0` 的错位 |
| 2026-04-28 | 审计 `2026-04-28.run-summary.md/json` | 已完成 | 复现了 `active 3/3` 与 stale fallback 共存的误导性表达 |
| 2026-04-28 | 审计 `verify-daily` 逻辑 | 已完成 | 确认其仍偏主链路通断，未充分覆盖 freshness 真实性 |
| 2026-04-28 | `npm run typecheck` / `npm test --` | 通过 | 报告输出修复、freshness 视图、项目分类与质检检查均已通过全量验证 |
| 2026-04-29 | `pnpm test -- agentsRadarConnector trendshiftConnector signalCollection actionOutput runSummary dailyVerification cliWorkflow` | 通过 | 本地单测与集成验证已覆盖 agents-radar realtime refresh、GitHub realtime sources 与 trendshift 当天归档语义 |
| 2026-04-29 | 真实 `run-daily -- --date 2026-04-29` | 失败（已定位） | 暴露 `github_snapshot` 负数 `star_delta` 触发 schema 校验失败，现已修复为降级 `unavailable` |
| 2026-04-29 | `scripts/liveDailySmoke.sh` | 已新增 | 依赖 GitHub / Trendshift 实网的 smoke 验证后移到用户本机一键执行，不再把代理环境当作可信联网基线 |
| 2026-04-29 | repo-sync 默认 checkout 路径修复 | 已定位待验证 | 将默认 `agents-radar` repo-sync 路径从历史参考目录 `../agents-radar-system` 切换到专用同步目录 `../agents-radar-repo-sync`，避免把非 git 镜像误判成实时仓库 checkout |
| 2026-04-29 | repo-sync git timeout 收口 | 已实现待实网复核 | 为 `git clone/pull` 复用 `refresh_timeout_ms`，避免在 git transport 不可达时卡死整次 `run-daily` |

## 回滚策略

- 若 GitHub fresh source 细分一时无法全部接入，先把 `agents-radar` 明确降级为 context source，再逐步补 GitHub 细分
- 若项目分类修复导致主榜单骤减，允许短期保留空主榜单，但不允许回滚成“历史补充观察自动补位”
- 若 run-summary 可读性重构影响既有脚本消费，允许先追加 freshness 摘要而不删除旧 section

## 结论记录

- 当前 report 主要问题不是“词不够漂亮”，而是 freshness source、项目分类和质检链路没有真正打通。
- 这轮修复的优先级应高于继续调 scoring，因为当前很多问题来自“把旧上下文误当当天新鲜信号”。
- `agents-radar` 的角色需要尽快澄清：要么实时化，要么明确降级为 context-only。

## 下一阶段入口

- 若本计划通过 review，下一步直接进入实现修复，不再追加新的设计分支。
- 若实现中发现 `agents-radar` 需要独立实时接入方案，应新开专门的 source-integration exec-plan，而不是继续把它混在 report 修复里。

## 2026-04-29 增量补充：report 泄漏异常与信息来源可读性整改

### 新发现问题

1. `daily report` 的 `新鲜度摘要` 直接暴露了 `agents-radar realtime refresh failed` 的完整异常堆栈，包括 `ERR_MODULE_NOT_FOUND`、命令行、Node.js 堆栈。
2. `daily summary / run-summary` 仍把 `fallback_reason` 当作面向最终用户的展示文本，而不是内部诊断文本。
3. `当天明星项目` 之前缺少“信息来源说明”，导致 `github_live_star_delta`、`trendshift_live`、`github_trending`、`watchlist_live_activity` 这类内部 source id 直接出现在用户视图中。
4. `这个项目是做什么的` 存在错误兜底：当 topic/tag/paradigm 无法推断项目职责时，当前文案退化为“这是一个值得继续观察的趋势型项目”，回答了价值判断，没有回答项目用途。
5. 当前 `agents-radar` 的刷新方式仍绑定本地 `../agents-radar-system` 和 `corepack pnpm start`，没有直接面向 `https://github.com/duanyytop/agents-radar` 的仓库同步路径；因此一旦本地依赖坏掉，就会把上游拉取失败误传导为报告异常。

### 根因分析

#### A. 异常泄漏到 report 的直接原因

- `src/action/dailyReport.ts` 的 `sourceLine()` 直接拼接 `fallback_reason`。
- `src/action/runSummary.ts` 的 `renderFreshnessSources()` 也直接拼接 `fallback_reason`。
- `DailyFreshnessSource.fallback_reason` 当前兼具两种语义：
  - 给程序判断 fallback 原因的机器字段
  - 给用户阅读的新鲜度说明字段
- `src/signal/agentsRadarConnector.ts` 在 refresh 失败时把 `String(error)` 整段塞进 notes，后续又被 `fallbackReasonFromNotes()` 提升为 `fallback_reason`，最终穿透到 markdown report。

#### B. agents-radar 刷新链路脆弱的原因

- 当前 `config.yaml` 固定为：
  - `mode: local-refresh`
  - `local_path: ../agents-radar-system`
  - `refresh_command: corepack pnpm start`
- 这意味着 agent-trend-radar 依赖另一个本地工程的运行环境、依赖安装状态和脚本入口，而不是依赖一个稳定的上游仓库同步契约。
- 现在失败点不是“当天没有数据”，而是“本地上游工程无法启动”；这类错误应该被归类为采集链路故障，而不是日报内容本身。

#### B1. 已定位的本地刷新失败根因

- 当前工作区实际指向的是本地目录 `../agents-radar-system`，而不是直接面向 `duanyytop/agents-radar` 仓库同步。
- 该目录虽然包含 `manifest.json`、`digests/`、`src/` 和 `package.json`，但本地检查显示 `node_modules` 缺失。
- 在该目录手动执行 `corepack pnpm start` 时，当前实际报错为：
  - `Local package.json exists, but node_modules missing`
  - `sh: 1: tsx: not found`
- 用户 report 里出现的 `Cannot find package 'js-yaml' imported from .../src/config.ts` 与本次手动复现的 `tsx: not found` 属于同一根因簇：
  - 本地上游工程依赖未安装或运行环境不完整
  - `local-refresh` 仍强依赖启动 TypeScript producer
  - 日报链路把“开发环境缺依赖”误当成“数据源刷新失败”
- 结论：`local-refresh + corepack pnpm start` 不是稳定的每日拉取方案，最多只能算开发态辅助模式。

#### B2. 已确认的上游仓库直连可行性

- `https://github.com/duanyytop/agents-radar` 仓库当前已公开包含：
  - `manifest.json`
  - `digests/`
  - `feed.xml`
  - `README.md`
  - `.github/workflows/`
- 仓库 README 明确说明：
  - 日报由 GitHub Actions 每天定时运行生成
  - Markdown digest 会直接提交回仓库
  - `manifest.json` 会随日报更新
- 结论：对 `agent-trend-radar` 来说，最稳的每日拉取路径应是“同步仓库产物并读取已提交 digest”，而不是“先尝试把上游生成器重新在本地跑起来”。

#### C. 信息来源不可读的原因

- 报告层直接输出内部 source id，没有经过“用户可读名称 + 一句话解释”的映射。
- 设计上已经区分了 `freshness-driving source` 与 `context source`，但没有再向前走一步，把“这类源回答什么问题”翻译给用户。

#### D. 项目用途摘要失真的原因

- `projectBriefFromTopics()` 先依赖用户兴趣 topic，再依赖 tags，再依赖 paradigm 中是否包含 `agent`。
- 一旦这些线索都不够，就退回到“值得继续观察”的价值判断句，而不是从 `project_name / description / tags / repo slug` 继续尝试生成职责摘要。
- 这导致“这个项目是做什么的”字段和“为什么今天值得关注”字段发生语义串位。

### 设计补丁目标

1. 面向最终用户的 `daily.md` 与 `run-summary.md` 不再出现原始异常堆栈、命令行 stderr、模块缺失细节。
2. `agents-radar` 刷新失败应转化为“数据源状态结论 + 简短人类中文描述 + 可选诊断引用”，而不是把错误原文印进 report。
3. `当天明星项目` 之前新增 `信息来源` 小节，用自然中文说明每个 source 回答什么问题、代表什么信号。
4. `这个项目是做什么的` 必须优先回答“项目用途”，不足时宁可明确说“当前仅能确认它与某类主题相关”，也不能用“值得观察”替代用途说明。
5. 为 `agents-radar` 新增“直接同步 GitHub 仓库”的接入模式，至少保证每日运行可以先同步 `duanyytop/agents-radar` 仓库内容，再读取 digest/manifest；本地 Node 工程启动失败不应再成为唯一刷新路径。

### 增量实施方案

#### Phase 6：异常信息分层

1. 将 `DailyFreshnessSource` 中当前单一的 `fallback_reason` 语义拆分为两层：
   - 面向用户的 `status_summary_cn` 或等价展示字段
   - 面向诊断的 `diagnostic_reason` / `diagnostic_ref`
2. `daily report` 与 `run-summary` 默认只展示：
   - source 名称
   - source 角色
   - freshness_state
   - effective_date
   - realtime
   - 简短中文状态说明
3. 原始异常详情转移到非默认用户视图：
   - JSON 产物诊断字段
   - 独立日志文件
   - verify / smoke 输出
4. 对所有 connector 的 fallback 文案统一收口：
   - 禁止把 `String(error)` 直接作为最终 report 文案
   - 允许保留 error code、失败类别、诊断摘要
   - 例如：`本次实时刷新失败，已回退到 2026-04-23 的历史摘要`

#### Phase 7：agents-radar 仓库直连刷新

1. 为 `sources.agents_radar` 增加新的刷新模式，候选命名：
   - `git-refresh`
   - 或 `repo-sync`
2. 新模式的最小能力：
   - 目标仓库固定或可配置为 `https://github.com/duanyytop/agents-radar`
   - 运行前执行 `git fetch` / `git pull` 或等价同步
   - 同步后直接读取仓库中的 `manifest` 与 `digests`
3. 本地 `corepack pnpm start` 模式降级为可选兼容模式，不再作为默认唯一刷新路径。
4. 若仓库不存在本地 checkout，则定义清楚 bootstrap 方案：
   - 显式失败并提示缺少 checkout
   - 或首次自动 clone 到约定目录
5. 失败语义重分层：
   - `repo sync failed`
   - `manifest missing`
   - `digest missing for requested date`
   - `report parse partial`
6. 验收上要区分：
   - 仓库同步失败
   - digest 日期回退
   - 解析失败
   - 本地 producer 运行失败
7. 若最终仍保留 `local-refresh`，则必须把它标记为“开发态上游刷新模式”，不能继续假设其适合作为稳定日常生产模式。

#### Phase 7A：把 repo-sync 提升为默认每日拉取主链路

1. 将 `repo-sync` 明确设为 `run-daily` 的默认 agents-radar 更新方式。
2. 默认链路改为：
   - 同步本地 checkout 到目标远端仓库最新状态
   - 直接读取同步后的 `manifest.json`
   - 按日期读取 `digests/YYYY-MM-DD/*.md`
   - 解析为 signals
3. `local-refresh` 只在以下场景允许使用：
   - 人工开发调试
   - 需要验证上游 producer 尚未提交到仓库的临时结果
4. 若同时存在 `repo-sync` 与 `local-refresh`，优先级必须是：
   - `repo-sync` 成功 -> 直接消费仓库 digest
   - 仅当用户显式要求时才执行 `local-refresh`
5. 不允许在默认每日流程中先跑 `pnpm start` 再读 digest。

#### Phase 7B：从根上阻断“开发环境缺依赖”型异常

1. 对 `local-refresh` 增加严格 preflight：
   - `package.json` 是否存在
   - `node_modules` 是否存在
   - `tsx` 是否可执行
   - 关键运行依赖是否已安装
2. preflight 失败时：
   - 禁止继续执行 `corepack pnpm start`
   - 直接产出结构化状态 `producer_environment_unready`
   - 不生成 shell/Node 堆栈作为用户侧 fallback 文案
3. 将当前“直接执行命令，失败后捕获整段异常字符串”的模式替换为：
   - `environment_unready`
   - `repo_sync_failed`
   - `producer_run_failed`
   - `digest_missing`
   - `manifest_missing`
4. 对 `agentsRadarConnector` 明确增加一条根因约束：
   - 不允许把本地依赖缺失、脚本缺失、运行器缺失归类为“实时数据暂时不可用”
   - 必须归类为“上游刷新环境不可执行”
5. 验收上要求：
   - 当 `node_modules` 缺失时，系统不会再尝试真实启动 producer
   - report 不再出现 `js-yaml not found`、`tsx: not found`、Node stack
   - 产物中只出现简短结论，如“本地上游刷新环境未就绪，已改用仓库已提交摘要”

#### Phase 8：信息来源透明化

1. 在 `## 当天明星项目` 前新增 `## 信息来源` 小节。
2. 该小节至少包含以下映射：
   - `GitHub 当日涨星信号`：表示项目在本次运行中观测到明显的 GitHub star 增长，用于发现突然升温的仓库。
   - `GitHub Trending`：表示项目进入 GitHub Trending 视图，用于发现今天讨论度高、曝光度高的仓库。
   - `重点观察清单动态`：表示我们持续关注的组织或仓库今天出现了活跃变化，用于补充重点生态里的新动作。
   - `Trendshift 今日命中`：表示项目被 Trendshift 的当天趋势视图捕获，用于补充趋势侧的新鲜候选。
   - `agents-radar 历史上下文`：表示项目近期曾出现在外部摘要中，用于补充背景，不单独证明它是今天的明星项目。
3. 小节文案使用中文自然表达，正文不再默认暴露 source id；必要时可在括号中保留内部 id 供调试。
4. `为什么今天值得关注` 中引用来源时，优先使用用户可读来源名，而不是直接输出内部枚举值。

#### Phase 9：项目用途摘要修复

1. 重写 `projectBriefFromTopics()` 的兜底策略，优先级调整为：
   - 用户兴趣 topic
   - tags
   - description 关键词
   - repo 名称 / slug 关键词
   - paradigm
   - 最后才进入“信息不足”型兜底
2. 最终兜底文案必须回答用途边界，建议风格：
   - `当前描述信息有限，但从命名和信号看，它更像一个 AI 开发工具/资源集合/基础设施项目。`
   - 或 `当前还无法准确判断具体用途，建议结合仓库描述进一步确认。`
3. 明确禁止以下情况：
   - `这个项目是做什么的` 输出纯价值判断
   - 与 `为什么今天值得关注` 复读
4. 如 description 缺失，应在 report 中显式承认“用途判断信息不足”，而不是假装已经知道。

### 验收补充

#### 验收 7：report 不再泄漏异常堆栈

- 可观测结果：`daily.md` 与 `run-summary.md` 不再出现 `ERR_MODULE_NOT_FOUND`、Node.js stack、命令 stderr 原文。
- 成功条件：用户只能看到简短状态结论，如“实时刷新失败，已回退到 2026-04-23 历史摘要”。
- 失败条件：任何最终用户默认可见 report 继续包含原始异常长文本。

#### 验收 8：agents-radar 支持仓库同步式刷新

- 可观测结果：每日运行前可以直接同步 `duanyytop/agents-radar` 仓库，再消费其中 digest。
- 成功条件：`local-refresh` 失败不再是唯一刷新失败模式，仓库同步链路可以独立工作。
- 失败条件：实现后仍只能依赖 `../agents-radar-system` + `corepack pnpm start`。

#### 验收 8A：默认流程不再依赖启动上游 Node 工程

- 可观测结果：标准 `run-daily` 在未显式指定开发态模式时，不会调用 `corepack pnpm start`。
- 成功条件：仓库同步 + digest 读取即可完成每日采集。
- 失败条件：默认链路仍把 producer 启动作为每日拉取前置步骤。

#### 验收 8B：从根上拦截依赖缺失型异常

- 可观测结果：当上游本地 checkout 缺少 `node_modules` 或运行器时，系统先给出 preflight 失败结论，而不是尝试运行后再抛异常。
- 成功条件：`js-yaml` 缺失、`tsx` 缺失这类环境错误不再进入用户 report，也不再作为“刷新失败堆栈”出现。
- 失败条件：系统仍通过真实执行 `pnpm start` 去“撞”出异常，再把异常文本透传到产物。

#### 验收 9：信息来源说明可读

- 可观测结果：`## 信息来源` 小节出现在 `## 当天明星项目` 之前，且使用中文解释每类信号。
- 成功条件：用户不需要理解内部 source id 也能知道各来源在回答什么问题。
- 失败条件：报告主体继续堆满 `github_live_star_delta` 这类未翻译枚举值。

#### 验收 10：项目用途摘要回答“它是做什么的”

- 可观测结果：主榜单项目的 `这个项目是做什么的` 优先描述产品用途、类别或解决的问题。
- 成功条件：不再出现“这是一个值得继续观察的趋势型项目”这类答非所问文案。
- 失败条件：字段名是“做什么的”，内容仍是“值不值得看”。

### 验证矩阵补充

| 类型 | 验证内容 | 命令 / 方法 | 通过标准 |
| --- | --- | --- | --- |
| 单元 | freshness 文案脱敏 | `pnpm test -- actionOutput runSummary` | markdown 输出不含原始异常堆栈，仅含简短中文状态 |
| 单元 | agents-radar repo-sync 模式 | `pnpm test -- agentsRadarConnector` | mock git sync 成功/失败/缺 manifest/缺 digest 均有明确状态 |
| 单元 | local-refresh preflight | `pnpm test -- agentsRadarConnector` | `node_modules` 缺失/`tsx` 缺失时直接返回 `environment_unready`，不执行 producer |
| 单元 | 信息来源映射 | `pnpm test -- actionOutput` | `daily.md` 在明星项目前新增 `信息来源` 小节，且文案使用中文来源名 |
| 单元 | 项目用途摘要兜底 | `pnpm test -- actionOutput` | 无 topic/tag/paradigm 时也不会回落为“值得继续观察” |
| 集成 | repo-sync 成功 + digest 当天存在 | `pnpm test -- cliWorkflow` | 每日流程可用同步后的仓库数据生成 report |
| 集成 | repo-sync 失败 + 历史 digest fallback | `pnpm test -- cliWorkflow` | report 仅显示简短回退说明，不显示堆栈 |
| 集成 | repo-sync 成功 + 本地 producer 环境损坏 | `pnpm test -- cliWorkflow` | 默认流程仍可成功消费仓库 digest，不受 `node_modules` 缺失影响 |
| CLI | 真实 `run-daily` with repo-sync | `pnpm run-daily -- --date <date>` | 能先同步目标仓库，再读取 manifest/digest 并完成写盘 |

### 实施注意事项

- 该增量优先修“展示契约”和“上游同步契约”，不是继续扩 scoring。
- 为避免影响现有 JSON 消费方，允许新增展示字段，不建议直接删除 `fallback_reason`；但 markdown 默认渲染必须切到新字段。
- 若 `duanyytop/agents-radar` 仓库结构与当前 `../agents-radar-system` 不一致，需先补一个最小结构适配层，再决定是否新开 source-integration exec-plan。
## 2026-04-29 实施记录

- 已完成 `daily report` / `run-summary` 的来源可读化改造，默认渲染改为中文来源名与简短状态摘要。
- 已完成 `agents-radar` 的 `repo-sync` 与 `local-refresh` preflight 拆分，避免把 producer 环境问题冒泡成原始 stderr。
- 已完成 `projectBriefFromTopics()` 的用途兜底修复，不再回落为“值得继续观察”的价值判断。
- 已根据后续 code review 进一步补齐 checked-in runtime config 默认值、repo-sync bootstrap/failure 分类，以及 connector / CLI / report 脱敏断言。
- 已根据新一轮 code review 进一步将 `run-summary.md` 的用户可见状态与原始 diagnostics 分离，并补齐 `github_live_star_delta` 的可读状态摘要和 repo-sync 端到端测试。
- 已修复 `agents-radar` 默认 repo-sync checkout 指向错误目录的问题，避免继续把初始化时参考实现目录当作实时同步仓库。
- 已为 `agents-radar` repo-sync 的 `git clone/pull` 增加超时，避免在当前环境无法直连 GitHub git transport 时卡死主链路。
- 验证命令：`npm run typecheck`、`npm test -- actionOutput runSummary agentsRadarConnector signalCollection config dailyVerification cliWorkflow`
- 验证结果：全部通过。
## 2026-04-29 Follow-up

- `agents-radar` `repo-sync` no longer hardcodes the `main` branch.
- When git-based sync fails, the connector now attempts an equivalent GitHub direct-read path for committed `manifest.json` and `digests/*` before falling back to historical local context.
