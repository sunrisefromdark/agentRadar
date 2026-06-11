# 执行计划：Ecosystem Focused Observer v0.1

## 文档状态

- 版本：`v0.1`
- 当前状态：`Proposed`
- 负责人：`Codex`
- 风险等级：`High`
- 设计来源：
  - [ecosystem-focused-observer-design.md](../design-docs/ecosystem-focused-observer-design.md#L1)
- 关联计划：
  - [signal-filter-action-v0.2.exec-plan.md](signal-filter-action-v0.2.exec-plan.md#L1)
  - [report-output-remediation-v0.1.exec-plan.md](report-output-remediation-v0.1.exec-plan.md#L1)
  - [trend-radar-ui-v3-stage-redesign-v0.1.exec-plan.md](trend-radar-ui-v3-stage-redesign-v0.1.exec-plan.md#L13)
- 说明：本计划只承接 `observer-only discovery module` 与 `first-class observer surface`。若实现需要让 observer 命中进入主评分池、改写 weekly 聚合，或把 backend 扩到 GitHub Search 之外，必须新开后续设计与 exec-plan。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Ecosystem Focused Observer v0.1 |
| 用户目标 | 为 `docs/specs/design-docs/ecosystem-focused-observer-design.md` 生成一份与设计严格一致、可直接实施的执行计划 |
| 主要影响面 | `config.yaml`、`src/config.ts`、`src/signal/*`、`src/action/*`、`src/types.ts`、`src/cli.ts`、`src/visualConsole/*`、`app/server.ts`、`app/styles.css`、`src/__tests__/*`、`docs/specs/exec-plans/README.md` |
| 交付目标 | 新增独立 observer 模块、独立 artifacts/run-summary status、一级 `observer` 路由，并将 `kb` 从一级导航中替换掉 |

## 目标

1. 按设计文档冻结一个独立、可配置、可审计的 `ecosystem-focused observer` 模块，只做 Agent 生态内的长尾发现，不参与 objective scoring。
2. 为 `config.yaml` 增加默认启用的 `sources.ecosystem_focus` 配置块，并预置设计文档冻结的 9 个 ecosystems。
3. 在 `run-daily` 链路中并行运行 observer，写出独立 artifacts 与 observer report，同时把 observer 状态追加到 `run-summary`，但不污染主 `freshness-driving sources`、`raw_signals`、`normalized_projects`、`scored_projects`。
4. 在 Visual Console 中新增一级 `observer` 页面，承载 ecosystem-first、match-evidence-first 的观察工作台，并把原一级 `kb` 导航位置替换为 `observer`。
5. 保持 `build-kb`、`data/kb/*`、旧知识卡片资产与主评分链路兼容，除“一级产品面降级”外，不在本计划里做物理删除或 promotion policy 设计。

## 设计对齐

| 设计章节 | 本计划承接位置 | 实施要求 |
| --- | --- | --- |
| `目标 / 非目标 / 设计摘要` | `目标`、`边界约束`、`Phase 0` | observer 只做定向长尾发现，严禁引入主评分、weekly 聚合或外部新 backend |
| `产品面替换 / Visual Console 承载面` | `Phase 4`、`验收 6` | 一级导航从 `kb` 切到 `observer`，页面姿态必须是 discovery workbench，而不是换皮 KB |
| `生态范围 / 配置设计` | `Phase 1`、`验收 2` | 冻结 9 个 ecosystems，作为默认配置写入 `config.yaml` 且保持可编辑 |
| `查询策略 / Match quality gate / 去重` | `Phase 2`、`验收 3` | 只用 GitHub Search，按 updated desc 搜索，强匹配留存、弱匹配压制、多生态命中聚合 |
| `Artifact 设计 / 与主评分隔离` | `Phase 3`、`验收 1 / 4 / 5` | 只写独立 observer artifacts 与 status；不得流入 `data/raw`、`normalizeSignals()`、`scoreProjects()` |
| `状态表达与报告 / 缓存与回退` | `Phase 2 / 3 / 4`、`验收 5 / 7` | `observer_status` 独立表达，局部处理 401 / rate-limit / cached snapshot fallback |
| `测试 / 风险 / 缓解策略 / 验收标准` | `关键负例`、`验证矩阵`、`回滚策略` | 每个设计验收项都必须有单测、集成测试或 UI 回归入口 |

## 边界约束

### 允许修改

- `config.yaml`
- `src/config.ts`
- `src/types.ts`
- `src/signal/index.ts`
- 新增 `src/signal/ecosystemFocusObserver.ts`
- 允许新增 observer 专用 helper，例如 `src/signal/ecosystemFocusGithubSearch.ts`
- `src/action/*` 中与 observer report / run-summary 输出相关的文件
- `src/cli.ts`
- `src/visualConsole/build.ts`
- `src/visualConsole/types.ts`
- `src/visualConsole/index.ts`
- `app/server.ts`
- 允许新增 `app/visualConsole/renderObserver.ts`
- `app/styles.css`
- `src/__tests__/*`
- `docs/specs/exec-plans/README.md`
- 本执行计划文档自身

### 禁止修改

- 不改 `total_score`、`objective_score`、`discussion_score` 的计算公式与权重。
- 不让 observer-only 命中写入 `data/raw/<date>.json`、`normalizeSignals(...)`、`scoreProjects(...)`、daily 主榜单或 weekly trend candidate generation。
- 不把 observer 伪装成 `github_trending`、`watchlist_live_activity` 或新的 freshness-driving source。
- 不在 `v1` 引入 Reddit、Hacker News、X、newsletter、GitHub Trending HTML 或其他非 GitHub Search backend。
- 不把生态范围扩到 `AI Agent / AI Infra / AI Tools` 之外。
- 不在本计划内删除 `data/kb/*`、废除 `build-kb`，或把 KB 资产从仓库中彻底清空。

### 兼容性约束

- 继续支持 `run-daily`、`verify-daily`、`visual-console`、`visual-console:web`、`build-kb`。
- `data/reports/YYYY-MM-DD.run-summary.md/json` 路径保持不变；只允许追加 observer 字段，不直接删改现有顶层字段。
- `data/observer/ecosystem-focus/<date>.json` 与 `latest.json` 为新增 canonical observer artifacts；不得借用 `data/raw/*` 充当 observer 落盘位置。
- `kb` 可以保留为非一级产品面的兼容入口或深链承接，但不得继续出现在一级导航、primary module set 或主工作台文案中。
- 若实现过程中发现必须修改 `docs/specs/services/signal-ingestion.md`、`cli-runtime.md`、`visual-console` 相关 Spec，同步更新时只能补 observer 契约，不能顺手引入额外新设计。

## 当前状态

1. `config.yaml` 与 `src/config.ts` 当前尚无 `sources.ecosystem_focus` 配置，也没有冻结的 9 个 ecosystems 默认值。
2. `src/signal/` 当前只有 `agentsRadar / trendshift / GitHub metrics / watchlist` 等链路，还不存在独立的 observer fetcher、query builder、match gate、fallback 与 artifact writer。
3. `run-summary` 当前没有 `observer_status.ecosystem_focus`、`observer_candidate_count`、`observer_ecosystem_counts`、`observer_top_candidates` 结构。
4. `src/visualConsole/*`、`src/cli.ts` 与 `app/server.ts` 当前一级路由仍以 `kb` / `knowledge-base` 为一等成员，没有 `observer` 路由。
5. `app/styles.css` 与 Web/CLI 测试矩阵目前围绕 `kb` 页面与五个旧路由编排，尚未覆盖 observer 页面的人格、解释文案与跨视图链接。

## 当前进度

- 设计对齐与范围冻结：`Done`
- ExecPlan 编写：`Done`
- ExecPlan / skills 预检：`Passed`
- 代码实施：`Completed`
- 回归验证：`In Progress`

## 文件结构与职责切分

### 配置与类型层

- 修改 [config.yaml](../../../config.yaml#L1)
  - 增加 `sources.ecosystem_focus` 默认配置、预算与 9 个 ecosystems。
- 修改 [src/config.ts](../../../src/config.ts#L1)
  - 新增 observer 配置解析、校验与默认值；拒绝未知字段并保证默认配置可直接工作。
- 修改 [src/types.ts](../../../src/types.ts#L1)
  - 新增 observer artifact、status、view-model 所需类型，不改现有 score truth 类型语义。

### Signal 与 artifact 层

- 新增 `src/signal/ecosystemFocusObserver.ts`
  - 负责 query 生成、GitHub Search 调用、匹配证据聚合、负向词压制、去重、多生态归并、局部 fallback 与 observer artifact 输出。
- 修改 `src/signal/index.ts`
  - 将 observer 纳入 `run-daily` 编排，但保持与主 signal pool 隔离。
- 新增或修改 `src/action/*`
  - 负责 observer report / summary 序列化与 `run-summary` 的 observer 状态写入。

### Visual Console 与路由层

- 修改 `src/cli.ts`、`src/visualConsole/index.ts`、`src/visualConsole/types.ts`
  - 增加 `observer` 视图枚举与 CLI/web 入口。
- 修改 `src/visualConsole/build.ts`
  - 构建 observer route 的只读 view-model，并在 `overview / projects / weekly` 中追加与 observer 相关的轻量上下文。
- 修改 `app/server.ts`
  - 将一级导航从 `kb` 替换为 `observer`，接入 observer route render 与兼容深链处理。
- 新增 `app/visualConsole/renderObserver.ts`
  - 以 workbench 方式展示 ecosystem counts、候选卡片、match evidence、观察建议与风险说明。
- 修改 `app/styles.css`
  - 增加 observer 页面样式，同时移除 `kb` 作为一级舞台的视觉优先级。

### 测试与账本层

- 新增 `src/__tests__/ecosystemFocusObserver.test.ts`
  - 守住 query、match gate、dedupe、fallback、multi-ecosystem aggregation。
- 修改 `src/__tests__/cliWorkflow.test.ts`
  - 守住 `run-daily` / `run-summary` / artifact 分离。
- 修改 `src/__tests__/visualConsole.test.ts`、`src/__tests__/visualConsoleWeb.test.ts`、`src/__tests__/visualConsoleWeb.visual.test.ts`
  - 守住 `observer` 路由、一级导航替换、跨视图链接与兼容行为。
- 修改 [docs/specs/exec-plans/README.md](README.md#L1)
  - 把本计划登记为活跃计划。

## 阶段进度

| 阶段 | 状态 | 设计映射 | 说明 |
| --- | --- | --- | --- |
| Phase 0：边界冻结与契约补齐 | `Done` | `目标 / 非目标 / 与主评分隔离 / 待确认问题` | observer-only 边界、KB 顶级替换规则、兼容性约束和验收映射已写入类型与实现 |
| Phase 1：配置与 taxonomy 落地 | `Done` | `生态范围 / 配置设计` | 已补齐默认配置、9 个 ecosystems、解析校验与默认预算 |
| Phase 2：observer 抓取、匹配、去重与回退 | `Done` | `查询策略 / Match quality gate / 去重 / 缓存与回退` | 已实现 GitHub Search query、强匹配留存、局部 fallback 与多生态合并 |
| Phase 3：run-daily 编排、独立 artifact 与 run-summary status | `Done` | `Artifact 设计 / 状态表达与报告 / 与主评分隔离` | 已并行运行 observer、写独立 artifacts、追加 observer status，且未污染主评分池 |
| Phase 4：一级 `observer` 页面与导航替换 | `Done` | `产品面替换 / Visual Console 承载面` | 已上线 observer workbench，替换 `kb` 顶级位置，并保留 KB 兼容深链 |
| Phase 5：验证、回归与账本同步 | `In Progress` | `测试 / 风险 / 验收标准` | 已完成 observer 目标回归；仓库既有部分非 observer Web 断言仍待单独收口 |

## 实施步骤

### Phase 0：边界冻结与契约补齐

1. 在 `src/types.ts` 与相关 action/type helper 中补齐 observer artifact、observer summary、observer route 所需的显式结构。
2. 明确 observer-only 结果不得进入：
   - `data/raw/<date>.json`
   - `normalizeSignals(...)`
   - `scoreProjects(...)`
   - daily main-board ranking
   - weekly trend candidate generation
3. 明确 `kb` 的本轮处理原则：
   - 从一级导航与 primary route set 移除
   - 保留 legacy `data/kb/*` 与 `build-kb`
   - 若保留兼容入口，也只能是非一级产品面
4. 若在实现前发现必须定义 promotion policy、weekly 吸纳逻辑或非 GitHub Search backend，立即停止本计划实施并回到 design addendum。

### Phase 1：配置与 taxonomy 落地

1. 在 `config.yaml` 中新增：
   - `enabled`
   - `mode`
   - `recent_days`
   - `per_ecosystem_limit`
   - `max_total_candidates`
   - `ecosystems[]`
2. 将以下 9 个 ecosystems 作为默认配置写入：
   - `coding-agents`
   - `agent-runtime`
   - `skills-tools-mcp`
   - `memory-knowledge`
   - `browser-computer-use`
   - `eval-observability-governance`
   - `multi-agent-coordination`
   - `agent-ui-workbench`
   - `agentic-rl`
3. 为每个 ecosystem entry 支持并校验：
   - `name`
   - `enabled`
   - `keywords`
   - `topic_hints`
   - `repo_seeds`
   - `org_seeds`
   - `negative_keywords`
4. 采用设计文档给出的保守关键词策略作为初始默认值，不在本计划中做激进扩词或跨域生态扩展。

### Phase 2：observer 抓取、匹配、去重与回退

1. 只用 GitHub Search 作为 `v1` backend，按 ecosystem 生成一个或多个 query，基础约束固定为：
   - `archived:false`
   - `fork:false`
   - `pushed:>=<today-recent_days>`
   - `sort=updated`
   - `order=desc`
2. 实现强匹配留存规则，仅保留满足以下至少一项的仓库：
   - 仓库名或 description 命中 keyword
   - 命中 topic
   - 命中 org seed 且存在额外正向生态证据
   - 命中 repo seed adjacency 且存在额外正向生态证据
3. 实现压制规则，以下仓库必须过滤掉：
   - 只命中弱泛词的候选
   - 命中 `negative_keywords` 的明显误报
   - 脱离 `AI Agent / AI Infra / AI Tools` 范围的仓库
4. 在 observer 模块内部完成：
   - 跨 query 去重
   - 多生态命中聚合
   - `matched_by` 证据归并
   - `ecosystem:<name>` labels 生成
5. 局部实现可靠性姿态：
   - 有 token 时优先 authenticated GitHub API
   - `401` 时回退 unauthenticated 重试
   - 记录 rate-limit / network failure
   - live fetch 失败时回退最新本地 observer snapshot
6. 所有 fallback 语义必须只留在 observer 模块内部，不得改写主 freshness 判断。

### Phase 3：run-daily 编排、独立 artifact 与 run-summary status

1. 将 observer 放到 `run-daily` 的并行发现阶段，但输出路径只允许为：
   - `data/observer/ecosystem-focus/<date>.json`
   - `data/observer/ecosystem-focus/latest.json`
   - 可选 `data/reports/<date>.ecosystem-focus.md/json`
2. 产物 entry 至少包含：
   - `repo_full_name`
   - `repo_url`
   - `observed_at`
   - `ecosystems`
   - `matched_by`
   - `description`
   - `stars`
   - `forks`
   - `issues`
   - `PR`
   - `source_notes`
3. 在 `run-summary` 中新增 observer 透明度字段：
   - `observer_status.ecosystem_focus`
   - `observer_candidate_count`
   - `observer_ecosystem_counts`
   - `observer_top_candidates`
4. 状态值只允许：
   - `active`
   - `empty`
   - `failed`
   - `disabled`
5. 明确 observer 的 allowed interaction 仅限于：
   - 独立 artifact
   - run-summary transparency
   - manual review priority
   - 独立 observer visual-console route
6. 显式验证 observer-only 命中不会改变：
   - `raw_signals`
   - `normalized_projects`
   - `scored_projects`
   - `today_star_count`
   - `discussion_score`

### Phase 4：一级 `observer` 页面与导航替换

1. 新增一级 `observer` 路由，并把现有一级导航中的 `kb` 位置替换为 `observer`。
2. observer 页面必须回答设计文档要求的四个问题：
   - 今天哪些生态产生了高价值长尾候选
   - 每个候选为什么会被匹配到
   - 为什么它有意思，即使还不属于主 scored board
   - promotion 之前下一步该继续观察什么
3. 页面姿态必须是：
   - discovery workbench
   - ecosystem-first
   - match-evidence-first
   - 明确不对热度权威性背书
4. 页面显式禁止变成：
   - 主榜单替身
   - 隐藏评分页
   - 换皮后的 KB reader
5. 在 `overview` 中允许轻量提示 observer findings，在 `projects` 中允许同仓库链接到 observer candidate，在 `weekly` 中只允许把 observer-only 主题作为 watchpoint 引用，不能当成已确认主趋势。
6. 若保留 `/kb` 或 CLI `kb` 兼容入口，只能作为次级深链，不得继续出现在一级导航、默认落地页或新的 observer 文案中。

### Phase 5：验证、回归与账本同步

1. 跑完 ExecPlan 与 skills 预检，确认计划结构、索引与技能凭据有效。
2. 跑 observer 单测、run-daily 集成测试、visual-console CLI/Web 回归，覆盖 artifact、run-summary、route、兼容入口与 UI 解释。
3. 若实现导致主评分、weekly、freshness-driving sources 或 KB 资产被误改，视为回归失败，不得通过“调整断言”过计划。
4. 完成后同步更新：
   - `当前状态`
   - `当前进度`
   - `已落地内容`
   - `验证记录`
   - `当前残余风险`
   - `结论记录`

## 已落地内容

- 设计文档已明确冻结 observer-only 边界、9 个 ecosystems、GitHub Search backend、独立 artifacts、run-summary status 与一级 `observer` 页面替换策略。
- 当前仓库已有可复用的 `config`、`run-daily`、`visual-console`、`kb` 与 Web/CLI 测试骨架，可作为 observer 实施的承接层。
- 本计划已把“保留 legacy KB 资产，但移除 KB 一级产品位”写成显式兼容约束，避免实施期误删历史资产或误保留顶级导航。

## 验收标准

### 验收 1：observer 是独立模块，不进入主评分池

- 可观测结果：仓库中存在独立、可配置的 observer 模块与 observer artifacts。
- 成功条件：observer-only 命中不会进入 `data/raw`、`normalizeSignals()`、`scoreProjects()` 或 daily 主榜单。
- 失败条件：observer 命中抬高 `discussion_score`、改变 main-board membership，或混入 weekly trend candidate。

### 验收 2：9 个 ecosystems 作为默认 taxonomy 生效

- 可观测结果：`config.yaml` 默认包含冻结的 9 个 ecosystems，且可编辑。
- 成功条件：模块开箱即用，不是空壳配置。
- 失败条件：taxonomy 缺项、命名漂移，或需要手工补配置后才能运行。

### 验收 3：GitHub Search 查询、匹配与去重符合设计

- 可观测结果：observer 候选保留 match evidence，支持多生态聚合，并对弱泛词误报做压制。
- 成功条件：类似 `cc-viewer` 的仓库能在冻结 taxonomy 下被合法捕获。
- 失败条件：只靠泛词噪声入选，或多 query 重复仓库未合并。

### 验收 4：observer artifacts 可审计且可回退

- 可观测结果：`data/observer/ecosystem-focus/<date>.json`、`latest.json` 可按日期写出，并携带 `matched_by` / `source_notes`。
- 成功条件：live fetch 失败时可回退最新 observer snapshot，且失败语义留在 observer 模块内。
- 失败条件：observer 产物写进主 raw-signal 文件，或 fallback 伪装成主 source freshness。

### 验收 5：run-summary 正确表达 observer 状态

- 可观测结果：`run-summary` 中出现 `observer_status.ecosystem_focus`、`observer_candidate_count`、`observer_ecosystem_counts`、`observer_top_candidates`。
- 成功条件：observer 状态与主 freshness-driving sources 分离，不改 objective freshness gate。
- 失败条件：observer status 缺失，或被当成新的主 source active/fresh 判据。

### 验收 6：一级产品面从 `kb` 切到 `observer`

- 可观测结果：Visual Console 顶级导航与 route frame 使用 `observer`，不再把 `kb` 暴露为同等级 first-class module。
- 成功条件：observer 页面成为长尾生态发现唯一的一级 home。
- 失败条件：`kb` 与 `observer` 并列为一级模块，或 observer 只是 KB 内容换皮。

### 验收 7：observer 页面解释充分但不背书热度

- 可观测结果：observer 页面能清楚解释 ecosystem context、match evidence 与后续观察建议。
- 成功条件：用户能理解“值得观察”而非“已进入主榜单”。
- 失败条件：页面暗示 observer 命中等同于 objective hotness，或把候选伪装成已确认趋势。

## 关键负例

1. observer-only repo 出现在 `data/raw/<date>.json`、`normalized_projects`、`scored_projects` 或 daily main board。
2. observer 命中导致 `discussion_score`、`total_score` 或 `today_star_count` 发生变化。
3. observer 页面使用“热榜”“主趋势已确认”之类主榜单语气，而不展示 match evidence。
4. `kb` 虽然名称改成 `observer`，但页面仍只是在读 `data/kb/*` 或沿用 KB reader 结构，没有 ecosystem-first discovery 视角。
5. GitHub Search 失败后直接把 observer 状态伪装成 `github_trending active` 或主 freshness source 正常。
6. 为了让测试通过而删除负例、放宽断言，或把核心逻辑完全 mock 掉。

## 当前残余风险

1. 泛生态查询仍可能存在噪声，需要依赖后续 `negative_keywords` 与 seed 调优。
2. GitHub Search rate limits 可能压缩覆盖面，导致某些 ecosystem 当天只能得到 `empty` 或 `failed`。
3. 当前仓库的 `kb` 触达面较多，一级导航替换时若兼容入口处理不慎，容易造成深链回归。
4. 旧 UI V3 计划默认顶级路由包含 `kb`，实现 observer 时必须以本设计为准，避免双重来源冲突。

## 验证矩阵

| 文件位置或类型 | 验证内容 | 验证方式或命令 | 对应 Spec | 通过标准 |
| --- | --- | --- | --- | --- |
| `docs/specs/exec-plans/*` | ExecPlan 审核预检 | `source ~/miniconda3/etc/profile.d/conda.sh && conda activate agent-trend-radar && npm run exec-plan:review:preflight` | `docs/specs/exec-plans/ExecPlan_ReviewSkill.md` | 计划与设计对齐、review receipt 通过 |
| `docs/specs/exec-plans/*` | ExecPlan 结构预检 | `source ~/miniconda3/etc/profile.d/conda.sh && conda activate agent-trend-radar && npm run exec-plan:preflight` | `docs/specs/constraints/structure-tests.md` | 新计划与索引满足结构门禁 |
| `src/__tests__/specStructure.test.ts` | 新计划与索引结构守护 | `source ~/miniconda3/etc/profile.d/conda.sh && conda activate agent-trend-radar && pnpm test -- specStructure` | `docs/specs/constraints/structure-tests.md` | 活跃计划账本、索引与必需章节齐全 |
| `src/__tests__/ecosystemFocusObserver.test.ts` | query 生成、强匹配、负向词压制、去重、401 fallback、snapshot fallback | `source ~/miniconda3/etc/profile.d/conda.sh && conda activate agent-trend-radar && vitest run src/__tests__/ecosystemFocusObserver.test.ts` | 设计文档 `查询策略 / Match quality gate / 去重 / 缓存与回退` | 单测全部通过，覆盖正例和负例 |
| `src/__tests__/cliWorkflow.test.ts` | `run-daily` 写 observer artifacts、run-summary status，并覆盖 `disabled / empty / failed / active` 状态表达，且不污染主评分链路 | `source ~/miniconda3/etc/profile.d/conda.sh && conda activate agent-trend-radar && vitest run src/__tests__/cliWorkflow.test.ts` | 设计文档 `Artifact 设计 / 与主评分隔离 / 状态表达与报告` | observer 产物存在、状态枚举符合契约，主 `raw/normalized/scored` 不变 |
| `src/__tests__/visualConsole.test.ts` | CLI `visual-console --view observer`、兼容入口与 route 枚举 | `source ~/miniconda3/etc/profile.d/conda.sh && conda activate agent-trend-radar && vitest run src/__tests__/visualConsole.test.ts` | 设计文档 `Route contract / 页面目标` | CLI 输出 observer 页面，`kb` 不再是一级默认视图 |
| `src/__tests__/visualConsoleWeb.test.ts` | 顶级导航替换、observer 页面解释、跨视图链接与兼容深链 | `source ~/miniconda3/etc/profile.d/conda.sh && conda activate agent-trend-radar && npm run test:visual-console:web` | 设计文档 `产品面替换 / Visual Console 承载面` | Web 路由与文案符合 observer 语义 |
| `src/__tests__/visualConsoleWeb.visual.test.ts` | observer 页面视觉承载与 workbench 姿态，不复刻 KB reader 结构 | `source ~/miniconda3/etc/profile.d/conda.sh && conda activate agent-trend-radar && npm run test:visual-console:web:visual` | 设计文档 `页面姿态` | observer 是 workbench，而非 KB reader 复刻 |
| `src/**/*.ts` | 类型完整性与实现边界 | `source ~/miniconda3/etc/profile.d/conda.sh && conda activate agent-trend-radar && npm run typecheck` | 设计文档 `模块边界 / 配置设计 / 状态表达` | 类型检查通过，无越界字段漂移 |

## 验证记录

| 日期 | 验证项 | 结果 | 说明 |
| --- | --- | --- | --- |
| 2026-05-28 | 设计文档逐条对齐复核 | 已完成 | 已核对目标、非目标、9 个 ecosystems、observer-only 隔离、artifact 路径、run-summary 字段、UI 替换与测试要求 |
| 2026-05-28 | ExecPlan 初稿落盘 | 已完成 | 已生成与设计一一对应的实施账本，并登记索引待更新 |
| 2026-05-28 | `npm run exec-plan:review:preflight` | 通过 | exec-plan review skill 与 receipt 校验通过 |
| 2026-05-28 | `npm run exec-plan:preflight` | 通过 | exec-plan 结构与 receipt 校验通过 |
| 2026-05-28 | `pnpm test -- specStructure` | 通过 | 新计划与索引通过结构测试 |
| 2026-05-28 | `npm run skills:preflight` | 通过 | code review、design review、exec-plan review、code implementation 与 testing skill 预检全部通过 |

## 回滚策略

1. 若 observer 抓取噪声过高或回退语义不稳定，优先将 `sources.ecosystem_focus.enabled` 设为 `false`，恢复主链路仅依赖既有 source。
2. 若一级 `observer` 页面导致深链或导航回归，先保留 observer artifacts 与 run-summary status，再把一级导航临时切回现有稳定集合，同时保留 observer 非默认入口用于继续调试。
3. 若 run-summary observer 字段影响既有消费方，先回退 observer summary 字段写入，但保留独立 artifacts，不得通过把 observer 写进 `data/raw/*` 解决兼容。
4. 禁止以删除 `data/kb/*`、删除 `build-kb` 或放宽评分断言的方式“回滚”。

## 结论记录

1. 本计划严格遵循设计文档的“分离”原则：observer 是独立 discovery module，不是新的 objective scoring source。
2. 本计划没有引入设计文档之外的新产品行为；唯一的显式产品替换是把一级 `kb` 导航改为 `observer`，并将 KB 降级为非一级兼容资产。
3. 若实现阶段出现“observer 命中要不要进入主 candidate pool”“是否扩展到 HN / Reddit / X”之类问题，必须作为后续设计，而不是在本计划中边做边定。

## 下一阶段入口

1. 先运行 `exec-plan:review:preflight`、`exec-plan:preflight` 与 `specStructure`，确认计划和索引通过门禁。
2. 通过后按 `Phase 1 -> Phase 5` 顺序实施，禁止先做 UI 再倒推 observer artifact 或评分隔离。
3. 本计划完成后，如需推进 promotion policy、observer hit 进入 candidate pool、多源 backend 扩展或 KB 资产彻底移除，另开 follow-up design 与 exec-plan。
