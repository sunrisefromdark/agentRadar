# 执行计划：Daily Report 新鲜度与可读性重构

## 文档状态

- 版本：`v0.1`
- 当前状态：`Done`
- 设计来源：
  - [日报新鲜度与可读性需求分析.md](../product-specs/日报新鲜度与可读性需求分析.md#L1)
  - [daily-report-freshness-readability-design.md](../design-docs/daily-report-freshness-readability-design.md#L1)
- 说明：本计划只负责把已冻结的日报新鲜度与可读性设计落地，不新增新的产品或设计决策。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Daily Report 新鲜度与可读性重构 |
| 负责人 | Codex |
| 风险等级 | `High` |
| 关联需求 | `docs/specs/product-specs/日报新鲜度与可读性需求分析.md` |
| 关联设计 | `docs/specs/design-docs/daily-report-freshness-readability-design.md` |
| 影响范围 | `src/signal/`、`src/action/`、`src/filter/`、`src/__tests__/`、`config.yaml`、`docs/specs/` |

## 目标

在不重写主评分引擎的前提下，完成以下交付：

1. daily 主榜单必须以本次执行的实时发现层为前提，不再默认吃历史 digest / snapshot 老底。
2. daily report 首屏必须先给出总状态结论、新鲜度摘要和候选池拆分统计。
3. 历史 fallback 内容只能进入“历史补充观察”，不能再与当天明星项目混排。
4. `单日出现项目` 必须重命名为 `待二次确认项目`。
5. 每个主榜单项目必须新增两条中文摘要：
   - 这个项目是做什么的
   - 为什么今天值得关注
6. 引入最小可执行的 `user_interest_profile` 配置层，但只影响单一最终排序，不污染客观趋势分。
7. 把 `LLM 不参与 daily 主判定` 与 `user_interest_profile` 最小 schema 冻结成实现期硬约束，避免 exec-plan 阶段仍需猜测。

## 边界约束

### 允许修改

- `src/signal/*`
- `src/action/*`
- `src/filter/*`
- `src/types.ts`
- `src/config.ts`
- `config.yaml`
- `src/__tests__/*`
- `docs/specs/product-specs/*`
- `docs/specs/design-docs/*`
- `docs/specs/exec-plans/*`

### 禁止修改

- 不重写现有 scoring 公式
- 不引入新的大型外部 source
- 不把 `agents-radar` 恢复成 daily 主榜单的一线发现源
- 不把 `watchlist_orgs` 实现成直接加分器
- 不把 `user_interest_profile` 与 `objective_score` 融成单一不可审计总分
- 不让 LLM 参与首屏总状态判定
- 不让 LLM 参与 `today_star / context_only / pending_confirmation` 分类判定
- 不在本计划内接入前端偏好输入、数据库或账号体系

### 兼容性约束

- `run-daily`、`verify-daily` 命令名保持不变
- `data/reports/YYYY-MM-DD.daily.md` 与 `data/reports/YYYY-MM-DD.daily.json` 路径保持不变
- 旧 JSON 字段可以保留，新增字段只能追加
- 若旧运行缺少新鲜度输入字段，daily report 必须显式降级，而不是假定 fresh
- `llm.enabled` 只允许影响辅助摘要或辅助分类素材，不允许改变首屏总状态、`today_star` 准入和三类项目分类结果

## 当前状态

当前实现已与目标设计对齐，首屏新鲜度优先、主榜单分层、偏好层最小契约与日报 JSON 输出契约均已落地并通过验证。

- daily 主榜单只保留 `today_star`
- fallback 结论已前置到 daily 首屏
- `单日出现项目` 已重命名为 `待二次确认项目`
- 日报第一层已切换为状态 + 摘要 + 候选池 + 当天明星项目
- `user_interest_profile` 已冻结为最小配置输入并带审计字段

## 当前进度

- 需求分析：`Done`
- 设计冻结：`Done`
- 实施：`Done`
- 验证：`Done`

## 实施阶段

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：契约对齐 | `Done` | 把需求、设计、配置和类型契约对齐到同一口径 | config/types/spec 一致 |
| Phase 1：实时发现层与状态判定 | `Done` | 实现 `Freshness-driving sources` 与三档总状态结论输入 | daily 能判断 `fresh_today / fallback_recent / fallback_stale / unavailable` |
| Phase 2：主榜单与历史补充分层 | `Done` | 把 `today_star`、`context_only`、`pending_confirmation` 分类落地 | 历史候选不再进入当天明星项目主榜单 |
| Phase 3：日报结构与中文摘要 | `Done` | 重构 daily Markdown/JSON 输出层级 | 首屏先看状态，项目先看人话摘要 |
| Phase 4：偏好层最小版本 | `Done` | 引入配置化 `user_interest_profile` 与单一最终排序 | `objective_score + preference_boost -> final_rank` |
| Phase 5：验证与收口 | `Done` | 完成 typecheck / 单测 / 集成 / CLI 回归 / 文档同步 | 验证矩阵全部通过 |

## 实施步骤

### Phase 0：契约对齐

1. 在配置层新增 `user_interest_profile` 的最小结构，位置固定在 `config.yaml`。
2. 固定 `user_interest_profile` 的最小 schema 为：
   - `enabled`
   - `topics`
3. 固定 `topics` 的每项最小 schema 为：
   - `name`
   - `weight`
4. 固定本轮最小 topic 名称空间为：
   - `agent-runtime`
   - `memory`
   - `coding-agent`
   - `infra`
   - `evaluation`
   - `mcp`
5. 固定偏好层输入来源和更新方式：
   - 来源只允许 `config.yaml`
   - 更新只允许手动修改配置后重新执行 `run-daily`
6. 固定 LLM 边界：
   - LLM 不参与首屏总状态判定
   - LLM 不参与 `today_star / context_only / pending_confirmation` 分类
   - LLM 如存在，只能继续停留在设计定义的辅助分类/摘要素材角色
7. 在类型层明确以下字段：
   - `overall_daily_status`
   - `freshness_sources`
   - `today_fresh_candidate_count`
   - `context_candidate_count`
   - `pending_confirmation_count`
   - `today_star_projects`
   - `context_only_projects`
   - `main_board_mode`
   - `project_brief_cn`
   - `why_today_cn`
   - `objective_score`
   - `preference_boost`
   - `final_rank`
   - `matched_interest_topics`
8. 保证 spec / design / types / config 对这些字段的命名一致。
9. 在配置文档与测试夹具中固定最小 YAML 契约示例：

```yaml
user_interest_profile:
  enabled: true
  topics:
    - name: agent-runtime
      weight: 0.4
    - name: memory
      weight: 0.2
```

10. 明确 schema 失败策略：
   - 缺失 `enabled` 或 `topics` 视为配置无效
   - 任一 topic 缺失 `name` 或 `weight` 视为配置无效
   - 未知 topic 名称不得被自动接纳为新命名空间，只能显式降级为无命中或报配置错误
11. 明确 LLM 主判定边界的测试口径：
   - 首屏总状态判定只依赖规则层 freshness 输入
   - `today_star / context_only / pending_confirmation` 只依赖规则层 source 命中与分类条件
   - `llm.enabled=true/false` 不得改变上述输出

### Phase 1：实时发现层与状态判定

1. 在 signal/action 交界处新增 daily 新鲜度摘要输入对象。
2. 对 `Freshness-driving sources` 逐个产出：
   - source 名称
   - effective_date
   - freshness_state
   - fallback_reason
   - 是否来自本次实时拉取
3. 固定三档总状态结论：
   - `数据新鲜，可直接阅读`
   - `数据部分回退，谨慎参考`
   - `数据显著过期，不建议直接用于判断`
4. 按设计中的状态映射规则生成总状态，而不是在 daily renderer 中自由判断。
5. 明确把首屏总状态判定保留在规则层，不允许接入 LLM 参与状态判断。

### Phase 2：主榜单与历史补充分层

1. 落地 `today_star / context_only / pending_confirmation` 分类。
2. daily 主榜单只从 `today_star` 生成。
3. `agents-radar` digest、历史 Trendshift snapshot、历史 GitHub snapshot 只能进入 `历史补充观察`。
4. 当 `today_star` 为空时：
   - 首屏进入 `数据显著过期，不建议直接用于判断`
   - 不允许用历史候选自动补齐“当天明星项目”。
5. 明确把 `today_star / context_only / pending_confirmation` 判定保留在规则层，不允许接入 LLM 参与分类。

### Phase 3：日报结构与中文摘要

1. daily 首屏固定输出以下顺序：
   - `今日状态`
   - `新鲜度摘要`
   - `候选池概览`
   - `当天明星项目`
2. 将旧口径 `单日出现项目` 替换为 `待二次确认项目`。
3. 每个主榜单项目的第一层必须新增：
   - `这个项目是做什么的`
   - `为什么今天值得关注`
4. 评分组件串、详细 evidence、详细 flags 下沉到第二层或附录。
5. 同步冻结 daily JSON 输出契约，至少显式产出以下字段：
   - 顶层字段：
     - `overall_daily_status`
     - `freshness_sources`
     - `today_fresh_candidate_count`
     - `context_candidate_count`
     - `pending_confirmation_count`
     - `today_star_projects`
     - `context_only_projects`
     - `main_board_mode`
   - 项目级字段：
     - `project_brief_cn`
     - `why_today_cn`
6. 明确 JSON 语义：
   - `today_star_projects` 只承载当天主榜单项目
   - `context_only_projects` 只承载历史补充观察项目
   - `pending_confirmation_count` 只表达“待二次确认项目”数量，不与主榜单数组混用
   - `main_board_mode` 必须显式区分主榜单是否为 `fresh_today_only`、`partial_fresh` 或 `no_fresh_main_board`
7. 明确 JSON 契约验证优先级与 Markdown 并列，禁止只做首屏叙事而不落结构化输出。

### Phase 4：偏好层最小版本

1. 从 `config.yaml` 读取 `user_interest_profile`。
2. 仅以配置方式输入，不接前端页面。
3. 偏好层只参与：
   - `preference_boost`
   - `final_rank`
   - `matched_interest_topics`
4. 固定最终排序公式：
   - `final_score = objective_score + preference_boost`
5. daily 展示层只输出一个最终排序，不额外展示多套榜单。
6. 审计层必须保留：
   - `objective_score`
   - `preference_boost`
   - `final_rank`
7. 非法或未知 topic 名称不得由实现方自由扩展；只能按固定 topic 名称空间处理，或显式降级为无偏好命中。

### Phase 5：验证与收口

1. 补齐单元测试、集成测试和 CLI 冒烟回归。
2. 更新相关 spec / design / exec-plan 索引与验证记录。
3. 用真实命令跑一次 daily，确认 fallback、主榜单分层与偏好层字段可观测。

## 已落地内容

- 需求分析与设计文档已冻结。
- `watchlist_orgs` 与 `user_interest_profile` 的产品边界已澄清。
- “实时发现层必须主导 daily 主榜单”的设计约束已明确。
- 单一最终排序口径已明确：展示层只看一个榜单，审计层保留客观分与偏好增益。

## 验收标准

### 验收 1：新鲜度优先展示

- 可观测结果：daily 首屏可直接看到 fallback、source 日期和总状态结论。
- 成功条件：用户不需要打开 run summary 才知道日报是否新鲜。
- 失败条件：fallback 风险仍被埋在正文或 notes 中。

### 验收 2：实时发现层主导

- 可观测结果：主榜单项目都能追溯到本次执行的实时发现层。
- 成功条件：GitHub / Trendshift 实时失败时，主榜单显式降级或为空；历史候选不自动补位。
- 失败条件：旧 digest / snapshot 仍能悄悄顶成“当天明星项目”主榜单。

### 验收 3：统计口径去歧义

- 可观测结果：`待二次确认项目`、`当日新鲜候选数`、`历史补充候选数` 都有稳定中文定义。
- 成功条件：用户不再把 `81/82` 或旧 `单日出现项目` 误解成硬上限或真实市场结论。
- 失败条件：字段含义仍需依赖口头解释或源码理解。

### 验收 4：日报第一层可读

- 可观测结果：项目第一层有人话简介和今日关注理由。
- 成功条件：第一层不再是术语堆叠或组件串。
- 失败条件：报告仍像调试日志。

### 验收 4A：daily JSON 契约完整

- 可观测结果：`data/reports/YYYY-MM-DD.daily.json` 显式包含顶层字段 `overall_daily_status`、`freshness_sources`、`today_fresh_candidate_count`、`context_candidate_count`、`pending_confirmation_count`、`today_star_projects`、`context_only_projects`、`main_board_mode`，且主榜单项目包含 `project_brief_cn` 与 `why_today_cn`。
- 成功条件：实现不只输出首屏叙事，还能稳定产出设计要求的结构化 JSON。
- 失败条件：Markdown 看起来正确，但 JSON 缺字段、字段语义混淆，或实现阶段自行改造输出契约。

### 验收 5：偏好层与客观趋势分离

- 可观测结果：系统能同时产出 `objective_score`、`preference_boost`、`final_rank`。
- 成功条件：偏好影响最终排序，但不改写客观分。
- 失败条件：偏好与客观分混成不可拆分总分，或 `watchlist_orgs` 被实现成直接加分器。

### 验收 6：LLM 不介入 daily 主判定

- 可观测结果：首屏总状态与 `today_star / context_only / pending_confirmation` 分类在 `llm.enabled=false/true` 下保持一致。
- 成功条件：开启或关闭 LLM 不改变 daily 主判定结果。
- 失败条件：LLM 开关能改变首屏状态、主榜单准入或三类项目分类。

### 验收 7：`user_interest_profile` 契约不可猜

- 可观测结果：实现只接受 `enabled`、`topics[].name`、`topics[].weight` 这组最小输入，并只接受固定 topic 名称空间。
- 成功条件：实现者无需再猜输入 schema、topic 集合、来源位置和更新方式。
- 失败条件：实现阶段自行扩展 schema、接受自由 topic 名称，或把偏好输入改成别的来源。

## 当前残余风险

- GitHub / Trendshift 的真实拉取稳定性仍可能影响主榜单长度，这是运行时风险，不是实现未完成。
- “数据新鲜 / 部分回退 / 显著过期”三档状态映射已经通过测试，但线上异常源数据仍需要持续观察。
- 中文摘要生成如果过度模板化，可能影响可读性；如果过度自由，又可能损害一致性。
- 偏好层虽为最小配置版，但仍有滥用风险，必须持续守住“只改排序、不改客观分”的边界。

## 验证矩阵

| 类型 | 验证内容 | 命令 / 方法 | 通过标准 |
| --- | --- | --- | --- |
| 静态 | 配置/类型/spec 对齐 | `pnpm typecheck` | 无类型错误，新增字段契约一致 |
| 结构 | spec / design / exec-plan 结构守护 | `pnpm test -- specStructure` | 结构测试通过 |
| 单元 | `user_interest_profile` schema 校验 | `pnpm test -- config` | 仅接受 `enabled` + `topics[].name/weight`，缺项即失败，topic 名称空间固定 |
| 单元 | daily JSON schema/output 契约 | `pnpm test -- actionOutput` | 顶层字段与项目级字段齐全，`today_star_projects/context_only_projects` 语义不混淆 |
| 单元 | 新鲜度状态映射 | `pnpm test -- actionOutput runSummary` | 三档状态映射与 source 状态一致 |
| 单元 | `today_star / context_only / pending_confirmation` 分类 | `pnpm test -- signalCollection actionOutput` | 分类稳定且可复现 |
| 单元 | 中文摘要输出 | `pnpm test -- actionOutput` | 每个主榜单项目都有 `project_brief_cn` 与 `why_today_cn` 两条摘要 |
| 单元 | 偏好层最小契约 | `pnpm test -- scoring actionOutput config` | `objective_score` 不变，`preference_boost/final_rank` 可观测 |
| 单元 | LLM 边界 | `pnpm test -- actionOutput signalCollection llmClassification` | LLM 开关不改变首屏状态、主榜单准入与 `today_star` 分类 |
| 集成 | same-day fresh GitHub + fresh Trendshift | `pnpm test -- cliWorkflow` | `数据新鲜，可直接阅读` |
| 集成 | fresh GitHub + stale Trendshift | `pnpm test -- cliWorkflow` | `数据部分回退，谨慎参考` |
| 集成 | all stale / fallback | `pnpm test -- cliWorkflow` | `数据显著过期，不建议直接用于判断`，且主榜单不被历史候选填满 |
| 集成 | agents-radar 仅有旧 digest | `pnpm test -- cliWorkflow` | 旧 digest 只能进补充观察，不进主榜单 |
| 集成 | LLM 开关前后一致性 | `pnpm test -- cliWorkflow llmClassification` | 开关 LLM 不改变 daily 主榜单准入、总状态与三类项目分类 |
| CLI | 真实 daily 运行 | `pnpm run-daily -- --date <date>` | 生成新结构 daily report 和 JSON |
| CLI | 真实 daily 质检 | `pnpm verify-daily -- --date <date>` | 可观测到新鲜度、fallback 结论和 daily JSON 输出契约 |
| 质量 | 代码质量门禁 | `pnpm quality:check` / `pnpm quality:gate` | 无新增质量回退 |

## 验证记录

| 时间 | 事实 | 结果 | 说明 |
| --- | --- | --- | --- |
| 2026-04-28 | 需求分析冻结 | 已完成 | daily 主榜单必须由实时发现层主导 |
| 2026-04-28 | 设计文档冻结 | 已完成 | 总状态、主榜单分层、偏好层最小契约均已明确 |
| 2026-04-28 | `pnpm test -- specStructure` | 通过 | 文档结构与索引保持一致 |

| 2026-04-28 | `npm run typecheck` / `npm test --` | 问题已收敛 | 新鲜度首屏、候选池分层与偏好层实现已通过全量验证 |

## 回滚策略

- 若实时发现层落地后导致主榜单经常为空，允许先保留“历史补充观察”区块，但不得回滚成“旧候选自动顶主榜单”。
- 若偏好层实现不稳定，允许临时关闭 `user_interest_profile.enabled`，回退到纯 `objective_score` 排序。
- 若中文摘要质量不稳定，允许先回退为规则化短句模板，但不得回退为组件串首屏展示。
- 若新增 JSON 字段影响兼容性，允许先保留旧字段并追加新字段，不允许直接删除旧字段。

## 结论记录

- 本计划严格承接已冻结需求与设计，不再新增产品行为。
- 本计划的关键价值不在“改好看”，而在把 daily 从“可能吃老底的报告”收成“实时发现优先的日报”。
- `watchlist_orgs` 与 `user_interest_profile` 已明确拆层：前者服务于监控优先级，后者服务于可审计的单一最终排序。

## 下一阶段入口

- 若后续要支持前端页面输入偏好，应新开 UI / preference-input follow-up exec-plan，而不是在本计划内扩边界。
