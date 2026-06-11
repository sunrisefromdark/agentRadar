# 设计文档：自进化 Skill 沉淀与专属技能树

## 文档状态

- 版本：`v0.6`
- 状态：`Approved for Implementation`
- 设计输入：
  - [自进化Skill沉淀与专属技能树需求分析.md](../product-specs/自进化Skill沉淀与专属技能树需求分析.md#L1)
  - [agentReadme.md](../../../agentReadme.md#L1)
  - [architecture-boundaries.md](architecture-boundaries.md#L1)
  - [system-spec.md](../system-spec.md#L1)
  - [docs/specs/agent-work/README.md](../agent-work/README.md#L1)
- 目标：在不侵入 `Signal -> Filter -> Action` 主产品裁决链路、不削弱现有 design/review/exec-plan/verification 门禁的前提下，为仓库内 Agent 工作层补上一条可审计的 `任务执行 -> Skill 候选提炼 -> 分层记忆 -> 相似任务路由 -> 失效纠偏 -> 技能树治理` 闭环。

## 一句话设计

把当前“人工技能书 + 聊天记忆”的松散模式，升级为“根规则 / 项目稳定事实 / 人工 Skill / 自动学习 Skill / 会话归档”分层、以 canonical metadata 驱动的仓库内 Agent 记忆系统：任务开始前先结合项目稳定事实做保守路由，任务结束后只对已验证成功的可复用路径提名候选 Skill，候选经复用或显式人工确认后晋升为 learned stable Skill；所有 learned 状态落在单一 canonical skill store 中，`manifests/*` 与 `tree/*` 只是可重建派生视图。

## 需求对齐映射

| 需求分析项 | 本设计对应章节 |
| --- | --- |
| 自进化能力只能停留在仓库内 Agent 工作层 | `边界与职责`、`与主产品链路的隔离` |
| 任务结束后要标准化判断是否沉淀 Skill | `候选提炼判定`、`任务完成后的闭环` |
| Skill 必须是结构化资产 | `Skill 资产模型`、`脚本挂接契约` |
| 必须建立分层记忆 | `分层记忆与信任层`、`项目稳定事实层`、`文件系统布局` |
| 任务开始前必须做 Skill 检索与路由 | `任务开始前的路由流程` |
| Skill 复用失败后必须降级、修正、反写 | `复用失败与纠偏闭环` |
| 结果要形成技能树而不是列表 | `技能树模型与浏览视图` |
| 自进化仍受现有治理体系约束 | `治理与审批边界` |
| Skill 必须有生命周期与失效复核 | `生命周期状态机`、`漂移扫描` |
| 必须有可观测成长证据 | `可观测性与审计产物`、`Canonical 状态与派生产物` |

## 问题定义

当前仓库已经有三类高价值资产，但它们没有形成可复用闭环：

1. `agentReadme.md` 和 `docs/specs/agent-work/*` 定义了强规则与人工 Skill。
2. 代码、脚本、验证命令和 spec 文档承载了大量已经跑通的执行经验。
3. 会话过程里存在很多“这次怎么做对了”的临时上下文。

缺口在于：

- 这些经验没有统一的沉淀入口，重复任务仍常从零开始。
- 自动学习如果直接写进主规范，会污染根规则和人工 Skill 的信任边界。
- 旧经验失效时，当前仓库没有统一的“保守降级 + 反写修正”机制。
- 即使产出越来越多的 Skill 文件，也缺少状态、来源、复用频次和最近验证语义，无法真正形成技能树。

因此本设计解决的是“仓库内 Agent 工作层如何可控自进化”，而不是趋势雷达主产品如何自动改写业务裁决。

## 范围

### 包含

- 仓库内 Agent 任务的分层记忆模型，显式包含 `project-facts`
- 人工 Skill registry、人工新增 Skill、以及人工修订 learned Skill 的收敛路径
- learned Skill 的 canonical 文件系统布局、元数据模型和 Markdown 契约
- canonical 状态与派生索引/技能树的重建规则
- 任务开始前基于 `domain / task_kind / artifact / goal / constraint / path` 的 Skill 路由
- 任务结束后的候选提炼、晋升、降级和替换规则
- 高频 stable Skill 的定期复核与事件触发漂移扫描
- 技能树索引、领域分类、状态浏览与成长统计
- learned Skill 与人工 Skill、根规则、项目稳定事实、verification receipts 的边界关系

### 不包含

- 改写 `src/signal/*`、`src/filter/*`、`src/action/*` 的主产品评分和报告判定语义
- 让趋势雷达的 daily/weekly 报告自动调用 learned Skill 决定业务结论
- 让 learned Skill 自动生成或自动批准对应 exec-plan
- 设计新的前端 UI、visual console 专页或用户交互界面
- 把 Codex/Claude/ChatGPT 某一家的线程协议当作冻结前提

## 非目标

- 不追求一次性导入 GenericAgent 的全部运行范式。
- 不把 learned stable Skill 提升为与人工 Skill 等价的最高信任层。
- 不允许候选 Skill 仅凭单次成功任务就默认高置信复用。
- 不让脚本文件替代结构化 Skill 说明、来源记录和验证语义。
- 不用 embeddings 黑盒召回替代当前仓库可审计的规则化路由。

## 边界与职责

### 与主产品链路的隔离

自进化 Skill 系统是仓库内 Agent 工作层能力，不属于趋势雷达产品判定层。它只能帮助 Agent 更快、更稳地完成：

- requirement analysis
- design drafting
- exec-plan drafting
- code implementation
- code review
- testing
- visual console work
- automation work
- repo ops

它不能直接决定：

- `Signal -> Filter -> Action` 任一业务字段
- `freshness_state`
- `ScoreBreakdown.total_score`
- daily / weekly 主榜单
- verification 结论本身

### 信任优先级

V1 冻结以下优先级，后级永远不得静默覆盖前级：

1. `root_rule`
   - `agentReadme.md`
   - approved spec / architecture constraints
2. `project_fact`
   - 从 approved specs、`system-spec.md`、架构约束中提炼出的稳定仓库事实
3. `manual`
   - 现有人工 Skill 书
   - 未来人工新增 Skill
   - 对 learned Skill 的人工修订版
4. `learned_stable`
   - 通过本设计沉淀、可默认复用、但仍低于人工 Skill 的自动学习 Skill
5. `learned_candidate`
   - 仅可提名或辅助参考的候选 Skill
6. `session_archive`
   - 只提供来源证据，不直接参与默认复用

结论：

- learned Skill 只能增强“如何做事”，不能改写“什么是对的”。
- `project_fact` 参与约束绑定与漂移判断，但不是 `primary_match`。
- 只有显式登记到人工 registry、且通过 manual registry freshness 校验的 manual Skill 才是可路由的人工 Skill。

## 总体架构

```text
task intake
  -> task fingerprint builder
  -> project fact resolver
  -> manual / learned skill router
  -> routing receipt
  -> task execution (baseline or reused path)
  -> verification receipts
  -> candidate synthesizer
  -> canonical skill store updater
  -> manifest rebuild
  -> tree materializer
  -> periodic / event-driven drift scan
```

核心原则：

1. 路由前置，但命中必须保守。
2. 项目稳定事实先于 Skill 匹配生效，用于补约束、补门禁、补漂移语义。
3. learned Skill 的可信度来自可追溯来源和后续复用结果，不来自一次性生成。
4. canonical 状态与派生产物分离，路由与统计都不能让派生产物成为唯一真相。
5. 漂移检测失败时先降级复用资格，再考虑重新晋升。

## 分层记忆与信任层

V1 将仓库内 Agent 相关记忆明确拆成六层：

| 记忆层 | 作用 | 来源 | 是否可默认复用 |
| --- | --- | --- | --- |
| `root-rules` | 根规则、审批边界、不可越界约束 | `agentReadme.md`、approved specs | 是，且永远优先 |
| `project-facts` | 仓库结构、稳定入口、长期规则、门禁事实 | approved specs / architecture constraints 的提炼索引 | 否，作为约束上下文 |
| `manual-skills` | 人工管理的可路由 Skill | `docs/specs/agent-work/*.md` + `manual-skill-index.json` + `manual-skill-source-state.json` | 是 |
| `routing-index` | 面向新任务的极简召回快照 | 由 canonical stores 派生 | 是，但仅作路由快照，不是行为真相 |
| `learned-skills` | 自动学习得到的候选/稳定 Skill | generated Markdown + JSON | `stable` 可保守复用，`candidate` 不可主命中 |
| `session-archives` | 任务过程、验证结果、来源证据 | generated receipts + archive | 否，仅做审计与再学习输入 |

此分层直接对应需求中的“元规则 / 路由索引 / 项目稳定事实 / Skill / 会话归档”，并明确把“人工规范”和“自动经验”分离。

## 文件系统布局

V1 以纯文件系统为唯一冻结入口。人工与自动资产分区存放，自动学习资产全部落在 `data/agent-memory/`，不得写回 `docs/specs/agent-work/`。

```text
docs/specs/agent-work/
  *.md                                   # 人工 Skill 与仓库规范
  manual-skill-index.json                # 可路由 manual skill 的 canonical metadata
  manual-skill-source-state.json         # routeable manual skill 源文档快照与 freshness 状态

data/agent-memory/
  facts/index.json                       # canonical project facts
  facts/source-state.json                # canonical project-fact source snapshot，用于检测上游源文档是否过期
  tasks/YYYY-MM-DD/<task-id>.json        # 任务执行回执
  routing/YYYY-MM-DD/<task-id>.json      # 任务开始前的路由决策回执
  reuse/YYYY-MM-DD/<task-id>/<skill-id>.json
                                        # 每次 Skill 复用尝试的独立回执；同一 task 可对应多份
  archives/YYYY-MM-DD/<task-id>.md       # 会话归档与来源摘要
  lifecycle/YYYY-MM-DD/<event-id>.json   # Skill 生命周期、替换、冲突与人工确认回执
  learned/<domain>/<skill-id>.md         # learned Skill SOP 正文
  learned/<domain>/<skill-id>.json       # learned Skill canonical metadata
  drift/YYYY-MM-DD/<scan-id>.json        # 漂移扫描与 reconcile 结果
  manifests/latest.json                  # derived routing snapshot
  tree/index.json                        # derived 技能树总索引
  tree/overview.md                       # derived 技能树总览
  tree/domains/<domain>.md               # derived 分域浏览页

scripts/skills/<skill-id>/...            # 可选脚本挂接目录
```

约束：

- `docs/specs/agent-work/*` 只容纳人工冻结资产，自动学习流程不得向该目录直接写入。
- 只有 `manual-skill-index.json` 中显式登记、且被 `manual-skill-source-state.json` 覆盖并验证 freshness 的条目，才参与 manual Skill 路由与 `manual vs learned` 统计；其他文档仍可作为根规则或参考文档存在。
- learned Skill 的 Markdown 与 JSON sidecar 必须同名同目录，`lifecycle_status` 只存于 JSON，不再通过 `candidate/` 与 `stable/` 目录重复表达。
- `reuse/YYYY-MM-DD/<task-id>/` 目录下每个 `skill_id` 只能写一份独立 `reuse receipt`；禁止把多条 Skill 的复用结果覆盖到同一个文件里。
- `scripts/skills/<skill-id>/` 是脚本型 Skill 的唯一新增脚本挂接位置；引用现有 `scripts/*` 也允许，但必须在 metadata 中显式登记。

## Canonical 状态与派生产物

V1 冻结以下单一真相规则：

1. `docs/specs/agent-work/manual-skill-index.json`、`docs/specs/agent-work/manual-skill-source-state.json`、`data/agent-memory/facts/index.json`、`data/agent-memory/facts/source-state.json`、`data/agent-memory/learned/**/*.json`、以及所有 append-only receipts 是 canonical 记录。
2. learned Skill 的 Markdown 正文是 canonical SOP 正文，但不能覆盖 JSON 中的 `skill_id / trust_tier / lifecycle_status / drift_status / required_gates / domain`。
3. `data/agent-memory/manifests/latest.json` 与 `data/agent-memory/tree/*` 全部是 derived views；它们允许被完全重建，不得承载唯一状态。
4. 路由器只有在 `manifests/latest.json` 不早于其依赖的 canonical 输入时才可直接使用；否则必须先重建 manifest。

### `manifests/latest.json` freshness 契约

V1 不允许实现阶段自行决定“manifest 算不算新鲜”。`manifests/latest.json` 必须内嵌一份 machine-checkable 的输入快照，而不是只靠文件修改时间。

```ts
type ManifestInputKind =
  | "manual-skill-index"
  | "manual-skill-source-state"
  | "manual-skill-source-doc"
  | "project-facts-index"
  | "project-facts-source-state"
  | "learned-skill-json"
  | "learned-skill-markdown";

interface ManifestInputSnapshot {
  path: string;
  input_kind: ManifestInputKind;
  content_sha256: string;
  observed_at: string;
  skill_id?: string;
}

interface RoutingManifest {
  generated_at: string;
  input_snapshots: ManifestInputSnapshot[];
  routing_index: SkillRoutingIndexEntry[];
  routeable_skill_ids: string[];
}
```

冻结语义：

1. `input_snapshots` 必须完整覆盖以下当前 canonical 输入：
   - `docs/specs/agent-work/manual-skill-index.json`
   - `docs/specs/agent-work/manual-skill-source-state.json`
   - `manual-skill-source-state.json.source_docs[].path` 中当前全部 routeable manual source docs
   - `data/agent-memory/facts/index.json`
   - `data/agent-memory/facts/source-state.json`
   - 每一条 routeable learned Skill 对应的 `.json` 与同名 `.md`
2. 路由器在直接使用 `manifests/latest.json` 前，必须重新计算上述每个输入文件的当前 `sha256`，并与 `input_snapshots[].content_sha256` 逐一比对。
3. 只要出现以下任一情况，`manifests/latest.json` 就视为 `stale`，不得继续用于路由：
   - 任一 snapshot 指向的文件当前不存在
   - 当前 canonical 输入的 `sha256` 与 snapshot 不一致
   - 当前 `manual-skill-index.json` 与 `manual-skill-source-state.json` 引用的任一路由级 manual source doc 未被 `input_snapshots` 覆盖
   - 当前磁盘上新增了某条 routeable learned Skill 的 `.json` 或 `.md`，但 `input_snapshots` 未覆盖
   - 某条 learned Skill 的 `.json/.md` 不再成对存在
4. `generated_at` 只用于审计，不是 freshness 判定依据；V1 明确禁止只靠 `mtime` 或目录时间戳判断 manifest 是否可用。
5. manifest rebuild 必须 full rebuild：
   - 重新枚举当前全部 routeable learned Skill
   - 重新计算所有 canonical 输入哈希
   - 重新生成整份 `routing_index` 与 `routeable_skill_ids`

写入顺序冻结为：

1. 先写 append-only receipt：`tasks/*`、`routing/*`、`reuse/*`、`drift/*`、`archives/*`、`lifecycle/*`
2. 再通过临时文件 + 原子 rename 写入或更新 learned Skill 的 `.json` 与 `.md`
3. 再从 `manual-skill-index.json`、`manual-skill-source-state.json`、`facts/index.json`、`facts/source-state.json`、以及全部 routeable learned Skill 的 `.json/.md` 重建 `manifests/latest.json` 与其 `input_snapshots`
   - 同时把当前全部 routeable manual source docs 作为 `manual-skill-source-doc` snapshots 写入 `input_snapshots`
4. 再从同一批 canonical 输入重建 `tree/index.json`、`tree/overview.md` 和 `tree/domains/*.md`
5. 如果步骤 3 或 4 失败，canonical 记录依然保留，但派生产物必须被视为 stale，下一次路由前必须先重建
6. 如果 learned Skill 的 `.json/.md` 配对不完整，或目录 domain 与 JSON `domain` 不一致，该 Skill 必须从 manifest 中排除，并在 `drift/*` 中写入 reconcile 失败记录

## Canonical 标识与谱系契约

V1 冻结所有跨 receipt / metadata / tree 节点共享的 ID 语义，禁止实现阶段自行发明“差不多能用”的标识规则。

### `task_id`

- `task_id` 是一次工作项的 canonical 标识；工作项定义为“同一用户目标、同一主产物、同一主路径范围下的一次完整交付尝试”。
- `task_id` 必须在首次写入 `routing receipt` 时分配，并被该工作项的 `routing/*`、`tasks/*`、`reuse/*`、`archives/*` 复用；后续回执只能引用，不能重新生成。
- 以下情况继续沿用同一 `task_id`：
  - 用户对同一交付物补充说明
  - Skill 复用失败后回退到基础工作流并继续修正
  - 同一任务内对同一目标文件进行增量修订、补验证、补脚本
- 以下情况必须新建 `task_id`：
  - 主 `domain` 或主 `task_kind` 改变
  - 目标产物类型或主要 `target_paths` 改变
  - 用户从“修订当前设计”切换为“审核另一份设计”这类交付目标切换
- `task_id` 格式冻结为 `task-YYYYMMDD-<domain-or-unspecified>-<task-kind-or-unspecified>-<primary-path-slug-or-no-path>-<sequence>`。
- `<primary-path-slug>` 必须取 `normalize_path_list(target_paths)` 排序后的首个路径；若该路径为空则固定为 `no-path`。
- 其中 `sequence` 是同一天内、同一 `domain/task_kind/primary-path-slug` 前缀下的单调递增十进制序号；展示时至少零填充到 2 位，但不设上限，超过 `99` 后自然扩展为 `100`、`101` 等。
- `sequence` 只用于消解同一天内相同前缀的多个不同工作项；一旦写入，不得因后续补充信息或重建派生产物而改变。
- `task_id` 的分配必须通过对 canonical `routing/YYYY-MM-DD/<task-id>.json` 的原子独占创建完成：先计算候选值，再尝试写入首份 `routing receipt`；若目标路径已存在，必须重新扫描当前 canonical 记录并重试，直到成功。
- 任务 ID 分配允许跳号，但不允许重用已分配、已尝试写入或已被并发占用的 `task_id`。

### `skill_id`

- `skill_id` 在 `manual` 与 `learned` 两个 trust tier 中全局唯一。
- `skill_id` 一旦写入 canonical store 即不可重命名；标题、摘要、步骤可修订，但 `skill_id` 不变。
- 默认格式冻结为 `<origin>.<domain>.<subdomain-slug>.<intent-slug>`。
- 其中 `<subdomain-slug>` 必须来自前述 `domain` 作用域 allow-list；不得写自由文本。
- `<intent-slug>` 必须按以下顺序确定来源文本：`sort(goal_terms)[0]`；若 `goal_terms` 为空，则取 `<task_kind>-<sort(artifact_types)[0] or generic>`；再按后述 `slugify` 规则生成。
- 若生成的基础 ID 与现存 Skill 冲突，则必须计算 `scope_hash8 = sha256(JSON.stringify({ domain, subdomain, task_kinds: sort(task_kinds), artifact_types: sort(artifact_types), target_paths: normalize_path_list(target_paths), goal_terms: sort(goal_terms) })).slice(0, 8)`，并落为 `<base>.<scope_hash8>`。
- 若冲突双方的规范化 scope tuple 完全相同，则视为同一 Skill 的更新，不得重复创建第二条 Skill。
- learned Skill 被 manual Skill 接管时，必须创建或更新 manual 条目并通过 `supersedes_learned_skill_ids` / `replacement_skill_id` 记录关系；不得原地把 learned `skill_id` 改成 manual `skill_id`。
- 因 `skill_id` 不可重命名，`subdomain` 变更只能通过创建 replacement Skill 表达；不得原地修改既有 Skill 的 `subdomain` 后继续沿用原 `skill_id`。

### 路径规范化与 slug 契约

V1 不允许实现阶段各自发明“路径怎么规范化”“中文标题怎么压成 slug”。所有 ID、scope tuple、路径前缀匹配和树节点索引统一使用以下确定性规则：

1. `normalize_path(path)`
   - 输入必须是仓库内相对路径；不得保留绝对路径盘符、`file://`、WSL UNC 前缀或工作区外路径
   - 统一把 `\\` 转成 `/`
   - 折叠重复 `/`
   - 消除 `.` 段，解析 `..`；若解析后越出仓库根，则该路径无效
   - 目录路径必须以 `/` 结尾；文件路径不得以 `/` 结尾
2. `normalize_path_list(paths)`
   - 对每个元素先执行 `normalize_path`
   - 删除空值与无效路径
   - 去重后按字典序排序
   - 仅当文档显式要求“父目录覆盖子路径”时才允许额外裁剪；否则保留全部规范化后的显式路径
3. `slugify(text)`
   - 先取 UTF-8 原文并去掉首尾空白
   - 若原文在替换空格、`/`、`_`、`.`、`:` 为 `-`，转小写并删除其余非 `[a-z0-9-]` ASCII 字符后仍得到非空结果，则：
     - 合并连续 `-`
     - 去掉首尾 `-`
     - 使用该结果
   - 否则固定回退为 `txt-<sha256(utf8(text)).slice(0, 8)>`
   - 明确禁止使用 LLM 改写、自由拼音化或手写别名表来生成 slug
4. `primary-path-slug`、`intent-slug`、`title-slug` 都必须由上面的 `slugify` 规则生成；实现不得再引入第二套“更易读”的备用算法
5. `normalized_scope_tuple`、`scope_hash8`、`fact_id` 中涉及的 `target_paths` / `related_paths` 比较与序列化，必须统一使用 `normalize_path_list(...)`

### `event_id`

- `event_id` 只在单条 Skill 谱系内要求唯一，不在全仓库跨 Skill 复用。
- 格式冻结为 `<skill_id>.evt-<sequence>`，其中 `sequence` 是该 Skill 现有 `lifecycle/*` 回执上的单调递增十进制序号；展示时至少零填充到 4 位，但不设上限，超过 `9999` 后自然扩展。
- 同一生命周期事件只能对应一个 `event_id`；补证据时更新该事件的 canonical 后继状态不允许重号覆写，必须新增后续生命周期回执。
- `event_id` 的分配同样必须通过对 canonical `lifecycle/YYYY-MM-DD/<event_id>.json` 的原子独占创建完成；若发生并发冲突，必须按当前谱系的最新序号重新计算并重试。

### `reuse receipt` 的标识约束

- `reuse/<date>/<task-id>/<skill-id>.json` 是 `task_id + skill_id` 这一对的 canonical per-attempt ledger，而不是只保留终态的摘要。
- 同一任务内如果同一 Skill 被多次尝试，不新增第二个同名 receipt，而是在同一 receipt 的 `attempts[]` 中按顺序追加 attempt，并同步更新派生 summary 字段。
- 30 天统计中的“按任务去重”只能使用 `task_id`，不能从聊天轮次、命令次数或文件数反推。

## 项目稳定事实层

`project-facts` 是 V1 新增的只读层，用来承载“仓库长期成立且会影响路由/治理”的事实，例如：

- 模块边界
- 稳定入口命令
- 质量门禁
- 数据落盘契约
- 审批与审批前置关系

它的来源是 approved specs、`system-spec.md`、`architecture-boundaries.md` 和同等级已批准架构约束，而不是 learned Skill 自己生成的结论。

```ts
type GateKind =
  | "approval"
  | "preflight"
  | "verification-command"
  | "repo-policy";

type GateState =
  | "passed"
  | "failed"
  | "not_applicable"
  | "missing_evidence"
  | "stale";

type GateEvidenceSourceType =
  | "root-rule"
  | "project-fact"
  | "document-status"
  | "task-receipt"
  | "command-exit";

type GateFreshnessRule =
  | "per-task"
  | "until-source-change"
  | "until-replaced";

type GatePhase =
  | "routing-precondition"
  | "task-completion";

interface GateRequirement {
  gate_id: string;
  gate_kind: GateKind;
  gate_phase: GatePhase;
  evidence_source_type: GateEvidenceSourceType;
  evidence_ref_hint: string;
  freshness_rule: GateFreshnessRule;
}

interface GateEvaluation {
  gate_id: string;
  gate_kind: GateKind;
  gate_phase: GatePhase;
  evaluator:
    | "routing"
    | "task-execution"
    | "candidate-synthesis"
    | "promotion"
    | "drift-scan";
  evidence_source_type: GateEvidenceSourceType;
  evidence_ref: string;
  freshness_rule: GateFreshnessRule;
  state: GateState;
  evaluated_at: string;
  detail: string;
}

interface ProjectFactRecord {
  fact_id: string;
  title: string;
  fact_type:
    | "module-boundary"
    | "stable-entrypoint"
    | "quality-gate"
    | "data-contract"
    | "repo-policy";
  summary: string;
  source_doc_paths: string[];
  related_paths: string[];
  constraint_tags: string[];
  required_gates: GateRequirement[];
  watch_paths: string[];
  updated_at: string;
}

interface ProjectFactSourceSnapshot {
  path: string;
  content_sha256: string;
  observed_at: string;
  derived_fact_ids: string[];
}

interface ProjectFactSourceState {
  generated_at: string;
  source_docs: ProjectFactSourceSnapshot[];
}
```

`project-facts` 的设计语义：

- 它参与 `constraint_tags` 与 `required_gates` 的绑定和校验。
- 它参与 learned Skill 的 `watch_paths` 漂移触发。
- 它不作为 `primary_match` 候选，不与 manual/learned Skill 争夺命中位。
- `facts/source-state.json` 是 `project-facts` 的 canonical 上游快照；进入路由前，系统必须先对比其中 `source_docs[].path` 的当前内容与快照哈希。
- 只要任一 `source_docs[].path` 发生变化且 `facts/index.json` 尚未按新源文档重建，就必须把 `project-facts` 视为 `stale`：先重建 facts，重建失败则当前任务保守降级为 `no_confident_match`，并把受影响 Skill 标记为 `pending_recheck`。
- `routing-precondition` gate 只允许用当前权威状态求值，不能被历史任务回执“补通过”；`task-completion` gate 则在当前任务执行/验证阶段重新求值，来源任务回执只允许用于既有 Skill 的 promotion 或 drift audit，不允许为新任务路由放行。

### 文档状态权威契约

V1 不允许实现阶段自行猜“approved / frozen / draft”是什么意思。`approval` gate 与 `project-facts` allow-list 只能使用下面冻结的权威来源与判定顺序。

```ts
type DocumentApprovalState =
  | "passed"
  | "failed"
  | "missing_evidence"
  | "authority_conflict";
```

按文档类型冻结如下：

1. requirement analysis：`docs/specs/product-specs/*.md`
   - 唯一正向通过信号：文档内存在一个标题精确匹配 `## 10. Requirement Freeze Status`，或匹配 `## 10. Requirement Freeze Status（...）` 的二级标题
   - 并且该标题到下一个同级标题之间的第一个非空行必须是精确的 `` `READY` `` 或 `READY`
   - 只列出状态菜单的模板文本，例如 `- READY`、`- NOT_READY`，不构成通过信号
   - 缺少该标题，或该标题下的首个非空状态值不是 `READY`，都不算通过
2. design doc：`docs/specs/design-docs/*.md`
   - 唯一正向通过信号：路径显式出现在 `agentReadme.md` 的 `Approved design:` 列表
   - 文档头里的 `状态：Approved` 只可作为佐证，不能单独让 `design-approved` 通过
   - 若同一路径仍出现在 `Current design discussion` / `Drafted design doc` 语义下，视为 `authority_conflict`
3. exec-plan：`docs/specs/exec-plans/*.exec-plan.md`
   - V1 不从 exec-plan 文档导出独立 `approval` 通过信号
   - exec-plan 文档在本设计里只承担三类权威输入：`referenced_specs` 目标解析、`code-implementation-preflight` 的当前任务约束，以及 approved 文档内未来显式 `project-fact` block 的来源文档
   - 仅存在文件、仅存在本地状态字段、或只因“设计大概已经讨论过”都不构成独立 approval
4. 仓库级治理输入：`agentReadme.md`、`docs/specs/agent-work/README.md`、`system-spec.md`、`architecture-boundaries.md`
   - 它们本身属于权威根输入，不再额外套 `approval` gate

统一判定顺序：

1. 先按目标路径识别文档类型。
2. 再只读取该类型允许的权威来源。
3. 若正向来源缺失，则落 `missing_evidence`。
4. 若正向来源与同一文档的显式负向来源冲突，则落 `authority_conflict`，并以 fail-closed 方式处理：
   - `GateEvaluation.state = stale`
   - detail 必须写明冲突来源
   - 当前任务不得把该 gate 视为 `passed`

### `project-facts` 构建与重建契约

V1 不允许实现者自行决定“facts 怎么抽”。`project-facts` builder 的语义冻结如下：

1. 输入源必须是显式 allow-list，而不是目录扫全仓：
   - `agentReadme.md`
   - `docs/specs/agent-work/README.md`
   - `system-spec.md`
   - `architecture-boundaries.md`
   - 按前述“文档状态权威契约”判定为可用的 requirement、design 或架构约束文档
2. 抽取只能基于冻结的“fact-export unit”，禁止自由摘要、LLM 改写或实现阶段自行猜测：
   - `agentReadme.md` 内置提取器
   - `docs/specs/agent-work/README.md` 内置提取器
   - `system-spec.md` 内置提取器
   - `architecture-boundaries.md` 内置提取器
   - approved requirement / design / 架构约束文档中的显式 `project-fact` fenced block
3. `agentReadme.md` 内置提取器只允许导出三类 fact-export unit：
   - `### 0. 固定环境入口` 只允许导出 1 条 `repo-policy` fact：
     - `title` 固定为 `agent-trend-radar-conda-environment`
     - `summary` 必须按原顺序拼接该节中的两条命令与随后的规范句：
       - `source ~/miniconda3/etc/profile.d/conda.sh`
       - `conda activate agent-trend-radar`
       - `如果 Agent 需要运行 pnpm test、pnpm typecheck、pnpm run-daily、pnpm run-weekly 或 pnpm build-kb，MUST 先进入 agent-trend-radar conda 环境，不能在 base 环境或未激活环境中直接执行。`
     - `related_paths` 固定为 `agentReadme.md`、`package.json`
     - `constraint_tags` 固定包含 `repo-policy` 与 `runtime-environment`
     - `required_gates` 固定为空数组；V1 不额外发明新的 runtime gate，而是由下文冻结的命令证据契约约束相关 verification/preflight 命令的运行上下文
   - `## Design Approval Rule (Must Follow)` 只允许导出 1 条 `repo-policy` fact：
      - `title` 固定为 `design-approval-before-exec-plan`
      - `summary` 必须按原顺序拼接该节中的两条规范句：
        - Before the user explicitly approves a design document, do **not** create the corresponding `exec-plan`.
        - Only after the user explicitly approves the design document may the matching `docs/specs/exec-plans/*.exec-plan.md` be created or updated as the implementation plan.
     - `related_paths` 固定为 `agentReadme.md`、`docs/specs/design-docs/`、`docs/specs/exec-plans/`
     - `constraint_tags` 固定包含 `repo-policy` 与 `design-approval-rule`
     - 该 fact 的 `fact_id` 必须按前文规则稳定落为 `repo-policy.agentreadme-md.design-approval-before-exec-plan`
     - `required_gates` 固定只带一条 `GateRequirement`：
       - `design-approved` -> `gate_kind = approval`、`gate_phase = routing-precondition`、`evidence_source_type = document-status`、`evidence_ref_hint = docs/specs/design-docs/*.md`、`freshness_rule = until-source-change`
   - `## Completion Is Script-Gated (Must Follow)` 下“验收标准 -> 脚本映射（最低要求）”中的以下精确命令项，并逐条导出一条 `quality-gate` fact：
     - `pnpm lint`
     - `pnpm typecheck`
     - `pnpm test`
     - `pnpm run-daily -- --date <date> --dry-run`
     - `pnpm run-weekly -- --date <date> --dry-run`
     - `pnpm score -- --input <normalized-file>`
     - `pnpm build-kb -- --since <date>`
   - 每条 fact 的 `title` 固定为该命令原文；`summary` 必须是对应 bullet 原句全文；不得改写
   - `pnpm lint` / `pnpm typecheck` / `pnpm test` 三条 fact：
     - `related_paths` 固定为 `agentReadme.md`、`package.json`、`src/`、`app/`、`scripts/`、`tsconfig.json`、`config.yaml`
     - `constraint_tags` 固定包含 `quality-gate` 与 `repo-completion-static`
     - `required_gates` 固定各带一条 `GateRequirement`：
       - `pnpm lint` -> `gate_kind = verification-command`、`gate_phase = task-completion`、`evidence_source_type = command-exit`、`evidence_ref_hint = pnpm lint`、`freshness_rule = per-task`
       - `pnpm typecheck` -> `gate_kind = verification-command`、`gate_phase = task-completion`、`evidence_source_type = command-exit`、`evidence_ref_hint = pnpm typecheck`、`freshness_rule = per-task`
       - `pnpm test` -> `gate_kind = verification-command`、`gate_phase = task-completion`、`evidence_source_type = command-exit`、`evidence_ref_hint = pnpm test`、`freshness_rule = per-task`
   - `pnpm run-daily -- --date <date> --dry-run` fact：
     - `related_paths` 固定为 `agentReadme.md`、`package.json`、`src/signal/`、`src/filter/`、`src/action/`、`src/storage/`、`data/reports/`
     - `constraint_tags` 固定包含 `quality-gate` 与 `entrypoint-run-daily`
     - `required_gates` 固定带一条 `GateRequirement`：
       - `run-daily-dry-run` -> `gate_kind = verification-command`、`gate_phase = task-completion`、`evidence_source_type = command-exit`、`evidence_ref_hint = pnpm run-daily -- --date <date> --dry-run`、`freshness_rule = per-task`
   - `pnpm run-weekly -- --date <date> --dry-run` fact：
     - `related_paths` 固定为 `agentReadme.md`、`package.json`、`src/action/`、`src/storage/`、`data/reports/`
     - `constraint_tags` 固定包含 `quality-gate` 与 `entrypoint-run-weekly`
     - `required_gates` 固定带一条 `GateRequirement`：
       - `run-weekly-dry-run` -> `gate_kind = verification-command`、`gate_phase = task-completion`、`evidence_source_type = command-exit`、`evidence_ref_hint = pnpm run-weekly -- --date <date> --dry-run`、`freshness_rule = per-task`
   - `pnpm score -- --input <normalized-file>` fact：
     - `related_paths` 固定为 `agentReadme.md`、`package.json`、`src/filter/`、`src/storage/`、`data/normalized/`、`data/scores/`
     - `constraint_tags` 固定包含 `quality-gate` 与 `entrypoint-score`
     - `required_gates` 固定带一条 `GateRequirement`：
       - `score-dry-run` -> `gate_kind = verification-command`、`gate_phase = task-completion`、`evidence_source_type = command-exit`、`evidence_ref_hint = pnpm score -- --input <normalized-file>`、`freshness_rule = per-task`
   - `pnpm build-kb -- --since <date>` fact：
     - `related_paths` 固定为 `agentReadme.md`、`package.json`、`src/action/`、`src/storage/`、`data/kb/`
     - `constraint_tags` 固定包含 `quality-gate` 与 `entrypoint-build-kb`
     - `required_gates` 固定带一条 `GateRequirement`：
       - `build-kb-dry-run` -> `gate_kind = verification-command`、`gate_phase = task-completion`、`evidence_source_type = command-exit`、`evidence_ref_hint = pnpm build-kb -- --since <date>`、`freshness_rule = per-task`
   - 除上述 fixed-environment policy、design-approval policy 与精确命令项外，`agentReadme.md` 其他文本在 V1 默认导出 `0` 条 fact；若后续要新增 approval / repo-wide completion gate，必须先在设计中补充新的内置提取规则或显式 `project-fact` block 契约
4. `system-spec.md` 内置提取器只允许三类 fact-export unit：
   - `## 运行面` 表格：每一行导出一条 `stable-entrypoint` fact
     - `title` = `入口` 列原文
     - `summary` = `作用` + `稳定性` 两列按原顺序拼接
     - `related_paths` 只允许来自该行内显式出现的反引号仓库路径；若该行没有显式仓库路径，则留空数组
     - `constraint_tags` 固定包含 `stable-entrypoint`
     - `required_gates` 固定为空；若某入口需要门禁，必须改用显式 `project-fact` block 额外导出
   - `### 稳定` 下的 bullet：只有当 bullet 内含至少一个显式反引号仓库路径，且该路径位于 `data/` 下时，才导出一条 `data-contract` fact
     - `title` = 该 bullet 的首个显式反引号路径
     - `summary` = bullet 原文
     - `related_paths` = 该 bullet 内全部显式反引号仓库路径
     - `constraint_tags` 固定包含 `data-contract`
     - 不含显式仓库路径的 bullet 在 V1 不导出 fact，除非补显式 `project-fact` block
   - `## 验证矩阵` 表格默认不自动导出 `ProjectFactRecord`
     - 若需要把某行验证约束提升为 `quality-gate` fact，必须在对应 requirement / design / 架构约束文档中通过显式 `project-fact` block 冻结
5. `architecture-boundaries.md` 内置提取器只允许按 `## 决策：<title>` 精确标题导出以下 facts：
   - `独立趋势决策系统` -> `fact_type = module-boundary`
   - `rules-first scoring` -> `fact_type = repo-policy`
   - `Trendshift connector 可插拔` -> `fact_type = module-boundary`
   - `data/ 文件系统优先` -> `fact_type = data-contract`
   - `title` = `<title>` 原文
   - `summary` = 对应标题下的正文原文
   - `related_paths` 只允许来自该 section 正文内显式反引号仓库路径；若正文未显式给出路径，则留空数组
   - `constraint_tags` 固定包含与 `fact_type` 同名的基础 tag
   - 任何未来新增、且标题不在上述 allow-list 内的 `## 决策：...` section，默认导出 `0` 条 fact；若要参与 `project-facts`，必须改用显式 `project-fact` block
6. `docs/specs/agent-work/README.md` 内置提取器只允许导出“任务类型 -> preflight 命令”类 `quality-gate` facts：
   - 只允许识别以下精确任务钩子语句，并逐条导出一条 fact：
     - “代码落地审查任务的机器可检查硬约束是 `npm run code-review:preflight`，不通过就不得继续进入正式 code review 结论输出。”
     - “design-doc review 任务在输出结论前必须先通过 `npm run design-review:preflight`。”
     - “exec-plan review 任务在输出结论前必须先通过 `npm run exec-plan:review:preflight`。”
     - “如果任务属于‘根据 exec-plan 实施代码落地’，必须先读取 `CodeImplementation_Skill.md` 并通过 `npm run code-implementation:preflight`。”
     - “如果任务属于测试设计、补测、回归验证，必须先读取 `TestingSkill.md` 并通过 `npm run testing-skill:preflight`。”
   - 每条 fact 的 `summary` 必须是对应原句全文；不得改写
   - `related_paths` 固定为 `docs/specs/agent-work/README.md` 与 `package.json`
   - `constraint_tags` 固定包含 `quality-gate`
   - `required_gates` 固定各带一条 `GateRequirement`：
     - `code-review-preflight` -> `gate_kind = preflight`、`gate_phase = task-completion`、`evidence_source_type = command-exit`、`evidence_ref_hint = npm run code-review:preflight`、`freshness_rule = per-task`
     - `design-review-preflight` -> `gate_kind = preflight`、`gate_phase = task-completion`、`evidence_source_type = command-exit`、`evidence_ref_hint = npm run design-review:preflight`、`freshness_rule = per-task`
     - `exec-plan-review-preflight` -> `gate_kind = preflight`、`gate_phase = task-completion`、`evidence_source_type = command-exit`、`evidence_ref_hint = npm run exec-plan:review:preflight`、`freshness_rule = per-task`
     - `code-implementation-preflight` -> `gate_kind = preflight`、`gate_phase = routing-precondition`、`evidence_source_type = command-exit`、`evidence_ref_hint = npm run code-implementation:preflight`、`freshness_rule = per-task`
     - `testing-skill-preflight` -> `gate_kind = preflight`、`gate_phase = routing-precondition`、`evidence_source_type = command-exit`、`evidence_ref_hint = npm run testing-skill:preflight`、`freshness_rule = per-task`
   - 除上述精确语句外，`docs/specs/agent-work/README.md` 其他文本在 V1 默认导出 `0` 条 fact；若后续要新增可绑定 gate，必须先在设计中补充新的内置提取规则或显式 `project-fact` block 契约
7. 显式 `project-fact` block 是 approved requirement / design / 架构约束文档导出 fact 的唯一通用扩展机制：

```ts
interface ProjectFactExportBlock {
  fact_type: ProjectFactRecord["fact_type"];
  title: string;
  summary: string;
  related_paths?: string[];
  constraint_tags?: string[];
  required_gates?: GateRequirement[];
}
```

   - Markdown 语法固定为 fenced code block，info string 必须是 `project-fact`
   - block body 必须能被解析为单个 YAML object，并满足上面的字段结构
   - `summary`、`title`、`related_paths`、`constraint_tags`、`required_gates` 只允许使用 block 中显式声明的值；不得从周围自然语言补猜
   - `required_gates` 若缺失则视为空数组
   - 任一 block 结构无效、字段缺失、`fact_type` 不在 allow-list 内、或 `required_gates` 不满足前文 typed contract，都视为 facts rebuild 失败
8. 字段生成与规范化规则冻结如下：
   - 一条 `ProjectFactRecord` 只承载一个 fact-export unit；禁止把多个 unit 合并后再总结
   - `summary` 只能是 unit 的原文、原表格单元格拼接结果，或 `project-fact` block 中显式给出的摘要；不得同义改写
   - `related_paths` 只能来自 unit 内显式仓库路径、`project-fact` block 的 `related_paths`，或本设计对某个内置提取器显式冻结的固定 `related_paths`
   - `primary-scope-slug` = `related_paths` 规范化、排序后的首个路径的首段；若 `related_paths` 为空，则为 `global`
   - `fact_id = <fact_type>.<primary-scope-slug-or-global>.<title-slug>`，其中 `title-slug` 仅由 `title` 规范化得到
   - `watch_paths = normalize(source_doc_paths ∪ related_paths)`；不得从 `summary`、标题或相邻段落额外猜路径
   - `required_gates` 只允许来自显式 `project-fact` block，或本设计对某个内置提取器显式冻结的 gate 输出；内置提取器若未声明门禁，则对应 fact 一律输出空数组
9. V1 只允许 full rebuild，不做增量 merge patch：
   - 任何一次重建都必须重新读取整套 allow-list
   - 不允许只对单篇变更文档局部改写 `facts/index.json`
10. 一条 `ProjectFactRecord` 只承载一个稳定约束单元：
   - 一个模块边界
   - 一个稳定入口命令
   - 一组不可拆分的质量门禁
   - 一个数据落盘契约
   - 一个审批前置关系
   - 禁止把多个无直接因果关系的约束揉成一条 fact
11. 当多个源文档导出同一 `fact_id` 时：
   - 如果 `summary / related_paths / constraint_tags / required_gates` 规范化后等价，则合并为一条 fact，并对 `source_doc_paths / watch_paths` 取并集
   - 如果语义不等价，则视为 authority conflict：本次重建失败，禁止发布新的 `facts/index.json`
12. 若两个不同 `fact_id` 指向相同主 scope 且导出互相矛盾的 `required_gates` 或边界结论，也视为 authority conflict，处理同上。
13. `facts/source-state.json` 必须覆盖全部 allow-list 源文档，即使某份源文档本次没有导出任何 fact，也要留下快照与 `derived_fact_ids = []`。
14. authority conflict、源文档缺失、源文档状态按前述契约判定为非通过、任一 fact-export unit 结构无效、或重建过程中任一结构校验失败时：
   - 本次 facts rebuild 失败
   - 旧 `facts/index.json` 不得被部分覆盖
   - `project-facts` 视为 `stale`
   - 当前任务路由保守失败为 `no_confident_match`

## 领域分类与技能树模型

需求文档已经冻结 V1 初始分类方向。本设计将其收敛为一级领域枚举：

- `requirements`
- `design`
- `exec-plan`
- `code-implementation`
- `artifact-review`
- `testing`
- `visual-console`
- `automation`
- `repo-ops`

其中 `artifact-review` 是仓库“review / audit”能力域的 canonical slug。它只承载对 `source-code`、`test-code`、`config`、`report`、`audit-receipt` 等实现或交付产物的审查；对 `requirement-doc`、`design-doc`、`exec-plan` 的 review 任务仍落在各自原生 `domain`，再用 `task_kind = review` 表达动作。

每条可路由 Skill 必须至少具备：

- 一个一级 `domain`
- 一个二级 `subdomain`
- 至少一个 `task_kinds`
- 至少一个 `artifact_types`
- 一组 `target_paths`
- 一组 `watch_paths`
- 一组 `required_gates`

每条 learned Skill 还必须具备：

- 零到一个 `parent_skill_id`
- 一组 `source_task_ids`
- 一组 `source_receipt_paths`

这意味着技能树不是按文件夹深度自然形成，而是由显式元数据驱动，再物化为 `tree/index.json` 和 Markdown 浏览页。

### 二级 `subdomain` 冻结规则

`subdomain` 不是自由字符串，而是 `domain` 作用域内的受控 slug。V1 允许的取值冻结为：

| `domain` | 允许的 `subdomain` |
| --- | --- |
| `requirements` | `general`、`requirement-analysis`、`spec-gap-audit` |
| `design` | `general`、`design-doc`、`design-review`、`architecture-boundary` |
| `exec-plan` | `general`、`exec-plan-drafting`、`exec-plan-review` |
| `code-implementation` | `general`、`feature-delivery`、`bug-fix`、`refactor` |
| `artifact-review` | `general`、`code-review`、`artifact-audit` |
| `testing` | `general`、`test-design`、`regression-validation` |
| `visual-console` | `general`、`ui-implementation`、`visual-regression` |
| `automation` | `general`、`workflow-automation`、`scheduled-automation` |
| `repo-ops` | `general`、`script-maintenance`、`dependency-ops`、`workspace-hygiene` |

冻结语义：

1. `manual` Skill 只能从对应 `domain` 的 allow-list 中显式选择一个 `subdomain`。
2. `learned` candidate 只允许两种确定性来源：
   - 若它按后述“谱系锚点与父节点分配契约”确定存在唯一合法谱系锚点，且当前任务与该锚点仍属同一 `domain`，则继承该锚点的 `subdomain`
   - 否则一律落到该 `domain` 下的 `general`
3. V1 明确选择“宁可保守落到 `general`，也不允许实现阶段发明新的细分类”。
4. 因为 `skill_id` 已编码 `subdomain`，一条已写入 canonical store 的 Skill 不允许静默修改 `subdomain`；若后续需要更窄分类，必须创建 replacement Skill，并通过 `replacement_skill_id` / `supersedes_learned_skill_ids` 建立谱系关系。
5. 任一不在 allow-list 内的 `subdomain`，都视为 metadata invalid：该 Skill 必须从 manifest 与 tree 中排除，并写入 `drift/*` reconcile 失败记录。

### 技能树拓扑冻结规则

V1 的“技能树”冻结为“按 `domain` 分组的 rooted forest”，而不是任意图或隐式 DAG。

冻结语义：

1. 每条 routeable Skill 只有一个可选的 `parent_skill_id`：
   - 缺失表示该 Skill 是所在 `domain` 下的根节点
   - 不允许多个父节点
2. `manual` Skill 必须是根节点：
   - `manual` metadata 不允许填写 `parent_skill_id`
   - 人工接管 learned Skill 时，通过 `replacement_skill_id` / `supersedes_learned_skill_ids` 记录替换关系，而不是把 manual Skill 挂到 learned Skill 下面
3. `learned` Skill 的 `parent_skill_id` 若存在，必须同时满足：
   - 指向一条已存在的 `manual` 或 `learned_stable` Skill
   - 与当前 Skill 属于同一 `domain`
   - 与当前 Skill 属于同一 `subdomain`
   - 不能指向自己
4. 任一 parent 链都不得形成环；tree materializer 必须对每个 `domain` 做显式 cycle check。
5. 物化顺序冻结为：
   - 先按 `domain`
   - 再取该 `domain` 下全部根节点
   - 每个非根节点只在其唯一父节点下出现一次
   - 同级节点排序按 `trust_tier`（`manual` > `learned_stable` > `learned_candidate`）、再按 `successful_reuse_count` 降序、最后按 `skill_id` 升序
6. 若出现缺失 parent、跨 `domain/subdomain` 挂接、manual Skill 带 parent、或环路：
   - 该 Skill 视为 topology invalid
   - 必须从 manifest 与 `tree/*` 一并排除
   - 必须在 `drift/*` 中写入 reconcile 失败记录
   - 当前任务不得把它作为 `primary_match` 或 `reference_match`

### 谱系锚点与父节点分配契约

V1 不允许实现阶段根据“语义上像不像”自由挑 `parent_skill_id`。谱系只能从当前任务里有明确复用证据的既有 Skill 推导。

先冻结一组共享判定单元：

- `normalized_scope_tuple`
  - `<domain, subdomain, sort(task_kinds), sort(artifact_types), normalize(target_paths), sort(constraint_tags), sort(goal_terms)>`
- `lineage_anchor`
  - 只允许来自当前 `task_id` 下、已经写出 `reuse/<date>/<task-id>/<skill-id>.json` 的既有 Skill
  - 仅凭 `reference_match`、历史命中记录、聊天文字或相似标题，不足以成为谱系锚点

父节点/替换判定冻结为：

1. 先从同一 `domain` 的 `lineage_anchor` 中收集 `exact_scope_anchors`
   - 判定条件：锚点与新候选的 `normalized_scope_tuple` 完全相等
2. 再收集 `broader_scope_anchors`
   - 判定条件：
     - 同一 `domain/subdomain`
     - 锚点的 `task_kinds` 与 `artifact_types` 对新候选分别构成相等或真超集
     - 锚点的 `target_paths` 对新候选 `target_paths` 构成前缀覆盖
     - 且不属于 `exact_scope_anchors`
3. 分流顺序固定如下：
   - 若 `exact_scope_anchors.length = 1`
     - 新候选进入 `replacement track`
     - 新候选自己的 `parent_skill_id` 必须等于被替换锚点当前的 `parent_skill_id`；不得把被替换 Skill 本身挂成父节点
   - 若 `exact_scope_anchors.length > 1`
     - 阻断 candidate 写入
     - `TaskExecutionReceipt.rejected_learning_reasons` 必须写入 `lineage-ambiguous-exact-scope`
   - 若 `exact_scope_anchors.length = 0` 且 `broader_scope_anchors.length = 1`
     - 新候选进入 `child track`
     - `parent_skill_id = broader_scope_anchors[0].skill_id`
   - 若 `exact_scope_anchors.length = 0` 且 `broader_scope_anchors.length != 1`
     - 新候选进入 `root track`
     - `parent_skill_id = null`
     - `subdomain` 必须按前述规则保守落到 `general`
4. `replacement track`、`child track`、`root track` 只能三选一；实现阶段不得追加第四种“半替换 / 半父子”状态。
5. `root track` 只表示“当前任务没有唯一可审计的父节点”，不表示“它语义上与历史 Skill 毫无关系”；后续只有新的同任务复用证据才能把它重新归入 child/replacement。
6. 一条候选如果因为 exact-scope 歧义被阻断，本次任务仍可保留 `task receipt` 与 `session archive`，但不得写 learned candidate。
7. `replacement track` 真正生效时点只允许发生在后续 `promoted` 或人工接管：
   - 被替换 Skill 必须写入 `replacement_skill_id = <new-skill-id>`
   - 被替换 Skill 必须追加 `superseded` 或 `retired` 生命周期回执
   - 新 Skill 继承被替换 Skill 原来的树位置，而不是把旧 Skill 挂成自己的父节点

### 冲突与替换契约

`conflict_with_skill_ids` 不是自由备注，而是“这些 Skill 不能继续并列 routeable”的 canonical 记录。

V1 只冻结三类冲突：

1. `manual-authority-conflict`
   - 新候选或既有 learned Skill 与某条 `manual` Skill 处于同一 `domain/subdomain`
   - 且双方 `normalized_scope_tuple` 完全相等
2. `exact-scope-contract-conflict`
   - 两条 learned Skill 的 `normalized_scope_tuple` 完全相等
   - 且它们规范化后的 `required_gates` 或 `script_refs` 不相等
3. `empirical-replacement-conflict`
   - 当前任务里某条既有 Skill 已产生 `reuse receipt`
   - 且其 attempt 结果为 `failed` 或 `partial`
   - 同一任务随后形成了针对同一 `normalized_scope_tuple` 的成功、可验证修正路径

冲突检测时机冻结为：

- `candidate-synthesis`
  - 比较“当前拟写入候选”与同一 `domain/subdomain` 下全部 routeable manual / learned Skill
- `promotion`
  - 比较“待晋升候选”与同一 `domain/subdomain` 下全部 routeable manual / learned Skill
- `drift-scan`
  - 在 source doc、脚本、gate 或 watch-path 变化后，比较当前 routeable 技能集合

冲突后的固定处理如下：

1. `manual-authority-conflict`
   - `manual` 永远获胜
   - 当前任务不得自动写入 learned candidate
   - `TaskExecutionReceipt.rejected_learning_reasons` 必须写入 `manual-authority-conflict:<manual-skill-id>`
   - 若冲突发生在既有 learned stable 与 manual 之间：
     - learned stable 必须写入 `conflict_with_skill_ids`
     - `drift_status = degraded`
     - `lifecycle_status = paused`
     - 必须追加 `event_type = conflict-recorded` 的生命周期回执
2. `exact-scope-contract-conflict`
   - 若当前任务没有同时满足 `empirical-replacement-conflict` 的替换证据，则不得并列保留第二条 routeable learned Skill
   - 当前任务不得自动写入 learned candidate
   - `TaskExecutionReceipt.rejected_learning_reasons` 必须写入 `exact-scope-conflict-unresolved:<skill-id>`
   - 若冲突发生在两条既有 routeable learned Skill 之间：
     - 两者都必须写入彼此的 `conflict_with_skill_ids`
     - 两者都至少进入 `pending_recheck`
     - 其中 `learned_stable` 必须再进入 `paused`
     - 在冲突未解除前，任一方都不得作为 `primary_match`
3. `empirical-replacement-conflict`
   - 这是唯一允许 exact-scope 新 Skill 继续自动进入 candidate 的路径
   - 新候选必须进入前述 `replacement track`
   - 被替换目标必须是当前任务内真实被尝试过的 Skill，不能只靠历史相似性声明“我替换它”
   - 新候选在晋升前，被替换 Skill 最多进入 `pending_recheck`
   - 新候选一旦晋升或被人工接管：
     - 被替换 Skill 必须写 `replacement_skill_id`
     - 被替换 Skill 必须进入 `retired` 或 `paused`
     - 必须补写 `conflict-recorded` 与 `superseded/retired` 生命周期回执

补充冻结规则：

- 除 `manual` 必胜外，任何冲突都不能靠 routing score、trust tier、文件新旧或“看起来更像”自动裁决。
- 冲突裁决必须可回指到 `reuse receipt`、`required_gates`、`script_refs` 或生命周期回执；不得只写自然语言备注。
- 任一 unresolved conflict 都必须阻断 `primary_match`、stable promotion 和并列 routeable 共存。

### 多 Skill 命中时的用户可见语义

V1 冻结三种输出语义：

- `primary_match`
  - 仅允许 0 或 1 条
  - 仅允许 `manual` 或 `learned_stable`
- `reference_matches`
  - 最多 2 条
  - 可包含 `learned_candidate`
- `no_confident_match`
  - 当主命中不足够可信时必须显式返回

这直接补齐需求里“多 Skill 同时命中时如何表达”的缺口，并坚持“宁可漏召回，不可高置信误调用”。

## Skill 资产模型

### 共享枚举

```ts
type Domain =
  | "requirements"
  | "design"
  | "exec-plan"
  | "code-implementation"
  | "artifact-review"
  | "testing"
  | "visual-console"
  | "automation"
  | "repo-ops";

type TaskKind =
  | "analyze"
  | "draft"
  | "revise"
  | "review"
  | "implement"
  | "verify"
  | "debug"
  | "operate";

type ArtifactType =
  | "requirement-doc"
  | "design-doc"
  | "exec-plan"
  | "source-code"
  | "test-code"
  | "config"
  | "report"
  | "skill-doc"
  | "skill-script"
  | "audit-receipt";

type Subdomain =
  | "general"
  | "requirement-analysis"
  | "spec-gap-audit"
  | "design-doc"
  | "design-review"
  | "architecture-boundary"
  | "exec-plan-drafting"
  | "exec-plan-review"
  | "feature-delivery"
  | "bug-fix"
  | "refactor"
  | "code-review"
  | "artifact-audit"
  | "test-design"
  | "regression-validation"
  | "ui-implementation"
  | "visual-regression"
  | "workflow-automation"
  | "scheduled-automation"
  | "script-maintenance"
  | "dependency-ops"
  | "workspace-hygiene";
```

`domain` 表示任务落在哪个仓库能力域；`task_kind` 表示在该能力域内做什么动作；`artifact_types` 表示目标产物是什么。三者必须独立，不允许用同一个粗粒度枚举重复表达。`artifact-review` 只是 review/audit 能力域的 slug，不得拿来覆盖 requirement/design/exec-plan 文档本身的原生领域。

### Manual Skill registry

V1 不要求现有 manual Skill 文档全部改写成统一 Markdown 头部，但要求所有“可路由的人工 Skill”都必须进入统一 registry：

- 每条可路由 manual Skill 必须有一个 `docs/specs/agent-work/*.md` 源文档
- 同时必须在 `docs/specs/agent-work/manual-skill-index.json` 中有一条 canonical metadata
- 人工修订 learned Skill 时，必须以新的或更新后的 manual Skill 条目落入这个 registry，而不是再引入第二种人工信任层

`manual-skill-index.json` 与 `manual-skill-source-state.json` 共同构成 manual registry freshness contract。其失败语义冻结为：

- 它们是 manual layer routeability 的唯一机器可读权威；任一文件缺失、损坏、结构无效，或 registry/source-state/源文档三者不同步时，都视为 manual registry unavailable。
- 当 manual registry unavailable 时：
  - 所有 manual Skill 立即失去 routeability
  - `manifests/latest.json` 必须视为 stale
  - 当前任务路由不得退化为“只靠 learned stable 继续主命中”，而必须整体 fail closed 为 `no_confident_match`
  - 任务仍可继续基础工作流，但不得写新的 learned candidate，也不得执行 stable promotion，因为无法完成与 manual layer 的冲突检查
- 只有在 registry 修复并完成 manifest 重建后，manual / learned 路由与候选写入资格才可恢复。

```ts
interface ManualSkillSourceSnapshot {
  path: string;
  content_sha256: string;
  observed_at: string;
  skill_ids: string[];
}

interface ManualSkillRegistrySourceState {
  generated_at: string;
  source_docs: ManualSkillSourceSnapshot[];
}

interface ManualSkillMetadata {
  skill_id: string;
  title: string;
  origin: "manual";
  trust_tier: "manual";
  lifecycle_status: "stable" | "paused" | "retired";
  drift_status: "trusted" | "pending_recheck" | "degraded";
  source_doc_path: string;
  source_doc_sha256: string;
  domain: Domain;
  subdomain: Subdomain;
  task_kinds: TaskKind[];
  artifact_types: ArtifactType[];
  target_paths: string[];
  constraint_tags: string[];
  goal_terms: string[];
  required_gates: GateRequirement[];
  parent_skill_id?: string;
  script_refs: string[];
  watch_paths: string[];
  supersedes_learned_skill_ids?: string[];
  last_lifecycle_event_id?: string;
  updated_at: string;
}
```

`manual-skill-source-state.json` 的冻结语义：

1. 它是 routeable manual Skill 源文档的 canonical 快照，而不是可选缓存。
2. V1 只校验显式登记到 `manual-skill-index.json` 的 `source_doc_path`，不允许靠目录扫全 `docs/specs/agent-work/*.md` 自动猜哪些文档可路由。
3. 每条 `ManualSkillMetadata` 都必须带 `source_doc_path + source_doc_sha256`，且：
   - `source_doc_path` 必须在 `manual-skill-source-state.json.source_docs[]` 中出现
   - 对应 snapshot 的 `content_sha256` 必须与 metadata 的 `source_doc_sha256` 相等
   - 当前磁盘上的源文档哈希必须继续等于该 snapshot 的 `content_sha256`
4. `manual-skill-source-state.json.source_docs[].skill_ids` 必须精确列出引用该源文档的全部 `skill_id`；不允许出现“registry 有条目但 source-state 没覆盖”或“source-state 声称 routeable skill 但 registry 不存在”的双向漂移。
5. 若同一 `skill_id` 在 registry 中指向多个不同 `source_doc_path`，或同一 `source_doc_path` 对多个 skill 导出互相矛盾的 `domain / task_kinds / artifact_types / required_gates`，则视为 manual registry conflict。
6. manual registry rebuild/validation 只允许 full validation，不允许局部跳过：
   - 重新读取全部 routeable `source_doc_path`
   - 重新计算每个源文档的 `content_sha256`
   - 重新生成 `manual-skill-source-state.json`
   - 校验 registry 中每条 metadata 的 `source_doc_sha256`、`source_doc_path`、`skill_id` 映射是否仍然一致
7. 任一源文档缺失、哈希不匹配、source-state 缺项、skill_id 映射不一致、或结构校验失败时：
   - manual registry unavailable
   - 旧 `manual-skill-index.json` 与 `manual-skill-source-state.json` 不得被部分覆盖
   - 当前任务路由保守失败为 `no_confident_match`
8. `manual-skill-index.json` 与 `manual-skill-source-state.json` 修复后，必须先完成 registry freshness 校验，再允许 manifest rebuild 恢复 routeability。

### Learned Skill Markdown 结构

每条 learned Skill 的 Markdown 正文必须固定包含以下章节：

1. `Intent`
2. `Use When`
3. `Do Not Use When`
4. `Inputs & Preconditions`
5. `Steps`
6. `Validation`
7. `Failure Signals`
8. `Fallback`
9. `Attached Scripts`
10. `Source Tasks`
11. `Drift Watch`

这保证 learned Skill 永远不是一段聊天摘要，而是带边界、验证和回退语义的结构化 SOP。

### Learned Skill JSON sidecar

```ts
interface LearnedSkillMetadata {
  skill_id: string;
  title: string;
  origin: "learned";
  trust_tier: "learned_candidate" | "learned_stable";
  lifecycle_status: "candidate" | "stable" | "paused" | "expired" | "retired";
  drift_status: "trusted" | "pending_recheck" | "degraded";
  domain: Domain;
  subdomain: Subdomain;
  task_kinds: TaskKind[];
  artifact_types: ArtifactType[];
  target_paths: string[];
  constraint_tags: string[];
  goal_terms: string[];
  required_gates: GateRequirement[];
  parent_skill_id?: string;
  source_task_ids: string[];
  source_receipt_paths: string[];
  script_refs: string[];
  watch_paths: string[];
  created_at: string;
  promoted_at?: string;
  promotion_source?: "successful-reuse" | "manual-confirmation";
  promotion_evidence_refs?: string[];
  manual_confirmation_ref?: string;
  last_used_at?: string;
  last_verified_at?: string;
  successful_reuse_count: number;
  failed_reuse_count: number;
  last_lifecycle_event_id: string;
  conflict_with_skill_ids: string[];
  replacement_skill_id?: string;
  retirement_reason?: string;
  demotion_reason?: string;
}
```

### `last_verified_at` 冻结语义

`last_verified_at` 表示“这条 Skill 最近一次拿到 fresh、可审计验证证据的时间”，不是自由填写的展示字段。

唯一允许推进该字段的事件只有四类：

1. `candidate-created`
   - 初始值必须取来源 `TaskExecutionReceipt.created_at`
2. 成功复用
   - 仅当某次 reuse attempt 同时满足 `execution_result = success`、`verification_result = passed`、`fallback_used = false`
   - 写回值必须取当前任务 `TaskExecutionReceipt.created_at`
3. stable Skill 的定期/事件复核成功
   - 写回值必须取对应 `event_type = revalidated` 的 `SkillLifecycleEventReceipt.created_at`
4. `paused/expired -> stable` 的恢复成功，或纯文档型 Skill 的显式人工 revalidate
   - 写回值同样必须取对应 `revalidated` 生命周期回执的 `created_at`

明确禁止：

- 不得让失败或 `partial` 的 reuse attempt 推进 `last_verified_at`
- 不得仅凭“文件没变”或“扫描没报错”推进 `last_verified_at`
- 不得使用隐藏时间戳、命中文本时间或聊天时间替代上述 canonical receipt 时间

因此：

- 任何计入 `successful_reuse_count` 的成功复用，都必须同时更新 `last_used_at` 与 `last_verified_at`
- `expired` 判定只能基于 `last_verified_at`；实现不得再引入第二套未公开的“活跃时间”口径
- 定期/事件复核成功只推进 `last_verified_at`，不得顺带推进 `last_used_at` 或 `successful_reuse_count`

### `watch_paths` 生成契约

V1 不允许实现者凭“看起来相关”去填 `watch_paths`。该字段必须按以下确定性规则生成：

1. 所有 `watch_paths` 都必须是规范化后的仓库内路径：
   - 使用 `/` 作为分隔符
   - 不允许 `.` / `..` 残留
   - 目录前缀必须以 `/` 结尾
   - 去重后按字典序排序
   - 若某父目录已存在，则删去它完全覆盖的子路径
2. `ProjectFactRecord.watch_paths = normalize(source_doc_paths ∪ related_paths)`；不得从 `summary` 文本再额外猜路径。
3. `ManualSkillMetadata.watch_paths = normalize({source_doc_path} ∪ target_paths ∪ script_refs)`。
4. `LearnedSkillMetadata.watch_paths = normalize(target_paths ∪ script_refs ∪ source task 的 files_touched)`，其中 source task 只允许来自 `source_receipt_paths` 回指的 `TaskExecutionReceipt`。
5. `LearnedSkillMetadata.watch_paths` 在收集 `files_touched` 时，必须排除自进化系统自己的派生产物，至少包括：
   - `data/agent-memory/tasks/`
   - `data/agent-memory/routing/`
   - `data/agent-memory/reuse/`
   - `data/agent-memory/archives/`
   - `data/agent-memory/lifecycle/`
   - `data/agent-memory/drift/`
   - `data/agent-memory/manifests/`
   - `data/agent-memory/tree/`
6. 任一 routeable Skill 的 `watch_paths` 归一化后都必须非空；若 learned candidate 生成时拿不到非空 `watch_paths`，则阻断 candidate 写入，只保留 `task receipt` 与 `session archive`。
7. 事件触发复核时，只允许两种匹配方式：
   - 变更路径与某条 `watch_paths` 完全相等
   - 变更路径落在某个目录前缀型 `watch_paths` 之下
8. V1 不允许在 `watch_paths` 中引入 glob、正则或 LLM 语义匹配；保守过触发是允许的，漏触发不允许。

### 生命周期审计回执

```ts
type SkillLifecycleEventType =
  | "candidate-created"
  | "promoted"
  | "manually-confirmed"
  | "demoted"
  | "paused"
  | "expired"
  | "retired"
  | "superseded"
  | "conflict-recorded"
  | "revalidated";

type SkillLifecycleTrigger =
  | "task-success"
  | "successful-reuse"
  | "manual-confirmation"
  | "scheduled-recheck"
  | "event-recheck"
  | "drift-failure"
  | "source-doc-change"
  | "script-missing"
  | "gate-change"
  | "manual-supersession"
  | "inactivity-expiration"
  | "conflict-resolution";

interface SkillLifecycleEventReceipt {
  event_id: string;
  skill_id: string;
  event_type: SkillLifecycleEventType;
  trigger: SkillLifecycleTrigger;
  created_at: string;
  from_trust_tier?: "manual" | "learned_candidate" | "learned_stable";
  to_trust_tier?: "manual" | "learned_candidate" | "learned_stable";
  from_lifecycle_status?: "candidate" | "stable" | "paused" | "expired" | "retired";
  to_lifecycle_status?: "candidate" | "stable" | "paused" | "expired" | "retired";
  reason: string;
  evidence_refs: string[];
  related_skill_ids: string[];
  gate_evaluations?: GateEvaluation[];
  manual_confirmation_ref?: string;
}
```

冻结语义：

- `lifecycle/*` 是 append-only canonical receipts，负责记录升级、替换、冲突、降级、过期、废弃和人工确认原因。
- `*.json` metadata 只缓存当前状态摘要；任何“为什么升/降/退/冲突”的解释都必须回指对应 `SkillLifecycleEventReceipt`，不能只留布尔值或时间戳。
- 候选生成、stable 晋升、人工接管 learned Skill、冲突裁决、降级、恢复、过期和退役都必须各写一份独立生命周期回执。

### 任务回执

```ts
type TaskResultReason =
  | "none"
  | "invalid-input"
  | "timeout"
  | "external-failure"
  | "execution-error"
  | "verification-failed"
  | "unresolved-classification"
  | "stale-project-facts"
  | "stale-skill-metadata";

type TaskClassificationSource =
  | "routing-fingerprint"
  | "post-task-target-path"
  | "post-task-artifact"
  | "post-task-files-touched"
  | "post-task-referenced-spec"
  | "unresolved";

interface TaskClassificationResolution {
  domain_source: TaskClassificationSource;
  task_kind_source: TaskClassificationSource;
  notes: string[];
}

type TaskCommandKind =
  | "read-only"
  | "preflight"
  | "verification"
  | "repo-script"
  | "repo-cli"
  | "ad-hoc-write"
  | "external-tool";

type TaskRuntimeContext =
  | "conda:agent-trend-radar"
  | "other"
  | "unknown";

interface TaskCommandRecord {
  seq: number;
  command: string;
  kind: TaskCommandKind;
  exit_status: "passed" | "failed";
  runtime_context: TaskRuntimeContext;
  writes_repo_files: boolean;
  touches_outside_repo: boolean;
  uses_checked_in_entrypoint: boolean;
  evidence_ref: string;
}

type ReusablePathSourceMode =
  | "baseline-task"
  | "successful-reuse"
  | "corrected-after-fallback";

type LearningBlockerReason =
  | "missing-reusable-summary"
  | "reusable-summary-invalid"
  | "unstable-steps"
  | "one-off-dirty-command"
  | "hardcoded-local-environment"
  | "missing-verification-evidence"
  | "conflicts-root-rules"
  | "conflicts-project-facts"
  | "conflicts-approved-specs";

interface LearningBlocker {
  reason: LearningBlockerReason;
  evidence_refs: string[];
  detail: string;
}

interface ReusableSummary {
  source_mode: ReusablePathSourceMode;
  source_command_seqs: number[];
  source_reuse_attempt_refs: string[];
  intent: string;
  use_when: string[];
  do_not_use_when: string[];
  inputs_preconditions: string[];
  steps: string[];
  validation: string[];
  failure_signals: string[];
  fallback: string[];
}

interface VerificationCommandRecord {
  command_seq: number;
  command: string;
  kind: "preflight" | "verification-command";
  status: "passed" | "failed" | "not_run";
  evidence_ref: string;
}

type TaskSkillUsageOutcome =
  | "successful-reuse"
  | "corrected-after-fallback"
  | "failed-reuse";

interface TaskSkillUsageRecord {
  skill_id: string;
  match_role: "primary" | "reference";
  reuse_receipt_ref: string;
  attempt_seqs: number[];
  outcome: TaskSkillUsageOutcome;
  reexplored_paths: string[];
}

interface TaskExecutionReceipt {
  task_id: string;
  created_at: string;
  user_request_summary: string;
  domain: Domain | null;
  task_kind: TaskKind | null;
  requested_artifact_types: ArtifactType[];
  target_paths: string[];
  constraint_tags: string[];
  goal_terms: string[];
  referenced_specs: string[];
  commands_executed: TaskCommandRecord[];
  files_touched: string[];
  classification_resolution: TaskClassificationResolution;
  task_completion_gates_evaluated: GateEvaluation[];
  verification_commands: VerificationCommandRecord[];
  skill_usage: TaskSkillUsageRecord[];
  result: "success" | "partial" | "failed";
  result_reason: TaskResultReason;
  reusable_summary?: ReusableSummary;
  learning_blockers: LearningBlocker[];
  rejected_learning_reasons?: string[];
}
```

`TaskCommandRecord`、`files_touched`、`verification_commands`、`skill_usage`、`reusable_summary` 与 `learning_blockers` 的冻结语义：

1. `TaskCommandRecord.kind` 不允许实现阶段按“看起来像什么”自由填写，必须按以下优先级确定：
   - 若该命令被当前任务 `verification_commands[*]` 直接引用，且其 `kind = preflight`，则 `TaskCommandRecord.kind = preflight`
   - 若该命令被当前任务 `verification_commands[*]` 直接引用，且其 `kind = verification-command`，则 `TaskCommandRecord.kind = verification`
   - 若 `writes_repo_files = true` 且 `uses_checked_in_entrypoint = false`，则必须记为 `ad-hoc-write`
   - 若 `uses_checked_in_entrypoint = true`，且主入口是仓库内 `scripts/*` 下的已检入脚本，则记为 `repo-script`
   - 若 `uses_checked_in_entrypoint = true`，且主入口是 `package.json` script、`src/cli.ts`、`app/server.ts` 或其他仓库内已检入 CLI / app 入口，则记为 `repo-cli`
   - 若命令的主要执行效果依赖仓库外的脚本、二进制包装层、临时文件或外部工具编排，且不满足以上条件，则记为 `external-tool`
   - 其余仅读取仓库、收集上下文、不产生 gate 证据也不写仓库文件的命令，才允许记为 `read-only`
2. `uses_checked_in_entrypoint = true` 的冻结判定：
   - 只允许在命令直接执行仓库内已检入文件，或直接调用 `package.json` 中映射到仓库内已检入入口的 script 时取 `true`
   - heredoc、inline python/node/shell one-liner、临时拷贝脚本、用户主目录下脚本，即使读取了仓库文件，也必须取 `false`
3. `writes_repo_files = true` 的冻结判定：
   - 只有当前任务命令实际创建、修改、重命名或删除仓库内文件，或调用了已知会在非 dry-run 模式下持久化写入仓库的 checked-in entrypoint，才允许取 `true`
   - 只读命令、preflight、dry-run、以及仅输出到终端/临时 stdout 证据的命令，都必须取 `false`
4. `touches_outside_repo = true` 的冻结判定：
   - 只要当前任务最终成功路径依赖仓库外文件系统路径、用户主目录下临时脚本/产物、或非仓库受控本地资源，即必须取 `true`
   - 固定 conda 激活前置、Node/pnpm/conda 运行时本身，以及仓库内 checked-in 入口的正常执行，不单独算作 `touches_outside_repo = true`
5. `files_touched` 不是 `target_paths` 的镜像，而是当前任务实际写入结果的 canonical 集合：
   - 只允许记录当前任务中被创建、修改、重命名或删除的仓库内路径
   - 必须使用仓库相对路径、`/` 分隔符、去除 `.` / `..`、去重后按字典序排序
   - 默认记录精确文件路径；只有当 checked-in entrypoint 可确定地写入一个稳定目录且 receipt 生成时拿不到精确文件列表，才允许退化为目录前缀路径，且目录项必须以 `/` 结尾并删除其完全覆盖的子路径
   - 不得写入仓库外路径；仓库外影响只能体现在 `touches_outside_repo`
6. `verification_commands` 是当前任务所有 gate 命令证据的 canonical 投影，不是自由文本摘要：
   - 每条 entry 都必须唯一回指到 `commands_executed[]` 中恰好一条 `seq`
   - `command` 必须与对应 `TaskCommandRecord.command` 完全相等
   - `evidence_ref` 必须与对应 `TaskCommandRecord.evidence_ref` 完全相等
   - `kind` 只能是 `preflight` 或 `verification-command`
   - 同一字面命令在同一任务内若执行多次，必须保留多条 entry，并通过 `command_seq` 区分；不得只保留最后一次的模糊摘要
7. 任一 `preflight` 或 `verification-command` gate 若要在 `GateEvaluation` 中判成 `passed` / `failed`，证据只允许回指：
   - 当前任务 `verification_commands[*].evidence_ref`
   - 与之对应的 `commands_executed[*].evidence_ref`
   - 或等价 reuse attempt 中显式记录的命令证据
   - 不得只写命令字符串而不绑定唯一 `command_seq`
8. 若某条 gate 绑定的是 `agentReadme.md` 固定环境规则覆盖的命令：
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm run-daily -- --date <date> --dry-run`
   - `pnpm run-weekly -- --date <date> --dry-run`
   - `pnpm build-kb -- --since <date>`
   则对应 `TaskCommandRecord.runtime_context` 必须为 `conda:agent-trend-radar`
   - 若为 `other`，对应 gate 必须判为 `failed`，且 `detail` 必须写明 `wrong-runtime-context`
   - 若为 `unknown`，对应 gate 必须判为 `missing_evidence`，不得默认放行
9. `skill_usage` 是“本次任务到底用了哪些已有 Skill、哪些地方重新探索了”的 canonical 任务级出口，不允许只靠扫描 `reuse/*` 目录时临时拼装：
   - 只允许为当前 `task_id` 下实际产生过 `reuse receipt` 的 `skill_id` 写 entry；未尝试的 `reference_match` 不得写入
   - 每条 entry 的 `reuse_receipt_ref` 必须唯一回指到当前任务的 `reuse/YYYY-MM-DD/<task-id>/<skill-id>.json`
   - `attempt_seqs` 必须只列出该 `reuse receipt` 中与最终 task-level 结论直接相关的 attempts
   - `outcome = successful-reuse` 仅当该 Skill 在当前任务中的相关 attempts 全部满足 `execution_result = success`、`verification_result = passed`、`fallback_used = false`
   - `outcome = corrected-after-fallback` 仅当该 Skill 在当前任务中出现过 failed / partial attempt 或 `fallback_used = true`，但任务最终形成了成功的修正路径
   - `outcome = failed-reuse` 用于“该 Skill 被尝试过，但本次任务没有把它带入成功默认复用路径”
   - `reexplored_paths` 必须来自对应 `reuse receipt.attempts[].reexplored_paths` 的并集；没有重新探索时保持空数组
   - 若当前任务没有尝试任何已有 Skill，则 `skill_usage = []`
10. `candidate-synthesis` 只允许读取当前任务的：
   - `TaskExecutionReceipt.reusable_summary`
   - `TaskExecutionReceipt.learning_blockers`
   - `TaskExecutionReceipt.task_completion_gates_evaluated`
   - `TaskExecutionReceipt.verification_commands`
   - `TaskExecutionReceipt.skill_usage`
   - 当前 `task_id` 下的 `reuse/*` 回执
   - 不允许直接从聊天文本、ExecPlan、历史任务自然语言摘要或 source task 的旧 Skill 正文重新自由编故事
11. `reusable_summary` 是候选 Skill 正文的唯一结构化输入，而不是可选备注：
   - 缺失 `reusable_summary` => `learning_blockers` 必须包含 `missing-reusable-summary`
   - 结构不完整、任一 section 为空、或 section 无法回指到当前任务证据 => `learning_blockers` 必须包含 `reusable-summary-invalid`
12. `source_mode` 只允许按当前任务证据确定性求值：
   - 当前任务不存在任何 `reuse receipt` => `baseline-task`
   - 存在 `reuse receipt`，且全部相关 attempts 都是 `execution_result = success`、`verification_result = passed`、`fallback_used = false` => `successful-reuse`
   - 只要当前任务存在任一 failed / partial reuse attempt，或任一 attempt `fallback_used = true`，且任务最终成功 => `corrected-after-fallback`
13. `source_command_seqs` 必须只指向当前任务中 `exit_status = passed` 且真正构成最终成功路径的命令；失败 attempt 对应命令不得混入 `Steps`。
14. `source_reuse_attempt_refs` 的冻结口径：
   - `baseline-task`：空数组
   - `successful-reuse`：列出支撑最终成功路径的 success attempts
   - `corrected-after-fallback`：列出本次任务里失败/partial 的旧 attempts 与最终成功路径直接相关的 attempts；不得引用别的 `task_id`
15. `reusable_summary` 的 section 来源固定如下：
   - `intent`：只允许由 `domain`、`task_kind`、`requested_artifact_types`、`target_paths`、`goal_terms` 归一化拼接得到
   - `use_when`：只允许来自当前任务已解析出的 `domain/task_kind`、`requested_artifact_types`、`target_paths`、通过的 `routing-precondition` / `task-completion` gates，以及 `referenced_specs`
   - `do_not_use_when`：只允许来自 `learning_blockers`、当前任务里出现过的 `failure_kind` / `failure_stage`、未满足时必须回退的 gate 条件，或按固定模板把当前任务 `Use When` 中的 gate / path / artifact 前置条件反向表述为“缺少这些条件时不得复用”
   - `inputs_preconditions`：只允许来自 `target_paths`、`constraint_tags`、通过的 `required_gates`、`referenced_specs`
   - `steps`：每一条都必须能回指到 `source_command_seqs` 中的至少一条命令；不允许从失败命令、聊天解释或周边自然语言中补写
   - `validation`：只允许来自 `verification_commands.status = passed` 的命令，或 `task_completion_gates_evaluated.state = passed` 的 verification/preflight gates
   - `failure_signals`：优先来自当前任务内 failed / partial reuse attempts 的 `failure_kind / failure_reason / failure_stage`，或当前任务 gate 失败时的 `GateEvaluation.detail`；若当前任务没有失败 attempt，则固定回写“出现 `precondition_check failed`、`verification failed`、`stale-*`、脚本缺失或 task-specific verification 缺失时，视为本 Skill 失效信号”
   - `fallback`：优先取当前任务 reuse attempts 中的 `correction_summary` / `reexplored_paths`；若当前任务没有失败 reuse attempt，则固定回写“遇到 `precondition_check failed`、`verification failed`、`stale-*`、脚本缺失或不满足当前 `required_gates` 时，立即退出默认复用路径并回退到基础工作流”
16. `learning_blockers` 不是自由文本，而是候选提炼的 canonical 阻断器：
   - `one-off-dirty-command`：`source_command_seqs` 中任一命令 `kind = ad-hoc-write`
   - `hardcoded-local-environment`：`source_command_seqs` 中任一命令 `touches_outside_repo = true` 或 `uses_checked_in_entrypoint = false`
   - `unstable-steps`：`source_command_seqs` 为空，或任一步 `steps` 无法回指到 `source_command_seqs`
   - `missing-verification-evidence`：`validation` 为空，或存在 `verification_commands.status != passed`、或 task-completion gate 未全部 `passed`
   - `conflicts-root-rules` / `conflicts-project-facts` / `conflicts-approved-specs`：必须分别回指到当前任务中的 root-rule、project-fact、approval / repo-policy gate 失败或冲突证据
17. 若 `learning_blockers` 非空，则：
   - 当前任务不得生成 learned candidate
   - `rejected_learning_reasons` 必须覆盖全部 blocker reason
   - 允许保留 `task receipt` 与 `session archive`，但不得进入 candidate write / stable promotion 分子
18. 候选 Skill Markdown 正文的 `Intent / Use When / Do Not Use When / Inputs & Preconditions / Steps / Validation / Failure Signals / Fallback` 八个 section，必须逐字段拷贝自 `reusable_summary`；只允许做空白规范化、列表编号重排和路径格式规范化，不允许语义改写。

任务执行分类冻结规则：

1. 若 `routing receipt.task_fingerprint.domain/task_kind` 已唯一解析，则 `TaskExecutionReceipt` 默认沿用该值，`classification_resolution.*_source = routing-fingerprint`。
2. 若路由阶段因 `domain` 或 `task_kind` 未解析而进入 `no_confident_match`，执行阶段只允许用以下当前任务证据补齐：
   - `target_paths`
   - `requested_artifact_types`
   - `files_touched`
   - `referenced_specs`
3. 事后补齐时不允许使用历史 learned Skill 命中、旧 `reuse/*` 回执或 LLM 自由语义猜测。
4. 若执行结束后仍无法把 `domain` 或 `task_kind` 唯一解析出来，则对应字段保持 `null`，并把 `classification_resolution.*_source` 设为 `unresolved`。
5. 任务即使在 `domain/task_kind = null` 时也可以 `result = success`，但：
   - `result_reason` 只能是 `none` 或 `unresolved-classification`
   - 该任务不得生成 learned candidate
   - 该任务不得作为 stable promotion 的新鲜成功复用证据

### Task Fingerprint 与路由回执

```ts
type FingerprintField =
  | "domain"
  | "task_kind"
  | "requested_artifact_types"
  | "target_paths"
  | "referenced_specs"
  | "constraint_tags"
  | "goal_terms";

type FingerprintEvidenceSourceType =
  | "user-request"
  | "task-title"
  | "explicit-path"
  | "quoted-spec-title"
  | "project-fact";

interface TaskFingerprintEvidence {
  field: FingerprintField;
  value: string;
  source_type: FingerprintEvidenceSourceType;
  source_ref: string;
  priority: 1 | 2 | 3 | 4;
}

interface TaskFingerprint {
  domain: Domain | null;
  task_kind: TaskKind | null;
  requested_artifact_types: ArtifactType[];
  target_paths: string[];
  referenced_specs: string[];
  constraint_tags: string[];
  goal_terms: string[];
  resolution_status: "resolved" | "ambiguous" | "underspecified";
  field_evidence: TaskFingerprintEvidence[];
  resolution_notes: string[];
}

interface BoundGateRequirement {
  gate: GateRequirement;
  source_layer: "project-fact" | "skill-metadata";
  source_ref: string;
}

type ScoreDimension =
  | "domain"
  | "task_kind"
  | "artifact_types"
  | "target_paths"
  | "constraint_tags"
  | "goal_terms"
  | "recent-success";

interface SkillRoutingScoreComponent {
  dimension: ScoreDimension;
  points: number;
  evidence: string;
}

interface SkillRoutingEvaluation {
  skill_id: string;
  score: number;
  score_breakdown: SkillRoutingScoreComponent[];
  effective_routing_gates: BoundGateRequirement[];
  routing_gate_evaluations: GateEvaluation[];
  effective_task_completion_gates: BoundGateRequirement[];
  decision: "primary_match" | "reference_match" | "rejected";
  rejection_reasons: string[];
}

interface RoutingReceipt {
  task_id: string;
  created_at: string;
  task_fingerprint: TaskFingerprint;
  resolved_project_facts: string[];
  task_routing_gates_evaluated: GateEvaluation[];
  candidate_evaluations: SkillRoutingEvaluation[];
  primary_match: string | null;
  reference_matches: string[];
  rejected_matches: Array<{
    skill_id: string;
    reasons: string[];
  }>;
  decision_reason: string;
}
```

### 路由索引条目

```ts
interface SkillRoutingIndexEntry {
  skill_id: string;
  trust_tier: "manual" | "learned_stable" | "learned_candidate";
  lifecycle_status: "candidate" | "stable" | "paused" | "expired" | "retired";
  drift_status: "trusted" | "pending_recheck" | "degraded";
  domain: Domain;
  task_kinds: TaskKind[];
  artifact_types: ArtifactType[];
  target_paths: string[];
  constraint_tags: string[];
  goal_terms: string[];
  required_gates: GateRequirement[];
  last_verified_at?: string;
  successful_reuse_count: number;
}
```

## 任务开始前的路由流程

### 1. 构建 Task Fingerprint

路由层在任务开始时生成 `TaskFingerprint`，字段固定为：

- `domain`
- `task_kind`
- `requested_artifact_types`
- `target_paths`
- `referenced_specs`
- `constraint_tags`
- `goal_terms`

冻结语义：

- `domain` 必须落入前述一级领域枚举之一
- `task_kind` 必须落入共享枚举，且必须与 `domain` 独立
- `goal_terms` 在 V1 中只允许来自用户请求、任务标题或已引用 spec 标题中的显式短语；不做 embeddings、不做同义词扩写

字段构建证据源优先级冻结为：

1. `priority = 1`：用户请求里的显式动作词、显式产物词、显式仓库路径，以及显式任务类短语（例如 `code review` / `artifact audit`）
2. `priority = 2`：任务标题里的显式动作词、显式产物词
3. `priority = 3`：已显式引用的 spec 标题、文档路径、章节标题
4. `priority = 4`：`project-facts` 只读约束补充；它只能补 `constraint_tags / required_gates / watch_paths`，不能在缺少 1-3 级证据时凭空发明 `domain` 或 `task_kind`

字段级冻结规则：

- `domain`
  - 先看显式路径或已引用 spec 路径是否一致落入单一原生域；该规则优先于泛化的 review 语义，例如 `docs/specs/design-docs/* -> design`、`docs/specs/product-specs/* -> requirements`、`docs/specs/exec-plans/* -> exec-plan`
  - 若当前任务显式要求 `review/audit`，但显式路径已经唯一落入 `requirements / design / exec-plan` 之一，则 `domain` 仍取该原生域，只把动作记为 `task_kind = review`
  - 只有当当前任务的显式目标产物或显式路径指向 `source-code`、`test-code`、`config`、`report`、`audit-receipt`，或用户显式说 `code review` / `artifact audit` 且不存在更高优先级的 spec 原生域路径时，才允许解析为 `artifact-review`
  - 若以上规则都不满足，再看 `priority = 1/2` 是否出现显式任务域词；V1 冻结以下中英文字面等价映射：`requirements / requirement / 需求 / 需求分析 -> requirements`、`design / design doc / 设计 / 设计文档 -> design`、`exec-plan / execution plan / 执行计划 / 实施计划 -> exec-plan`、`code implementation / feature delivery / bug fix / refactor / 开发 / 实现 / 修复 / 重构 -> code-implementation`、`artifact review / code review / artifact audit / 审核 / 审查 -> artifact-review`、`testing / test / regression / 测试 / 补测 / 回归 -> testing`、`visual console / ui / frontend / 视觉界面 / 前端 -> visual-console`、`automation / workflow / scheduled task / 自动化 / 工作流 / 定时任务 -> automation`、`repo ops / repository ops / script maintenance / dependency ops / 仓库运维 / 脚本维护 / 依赖维护 -> repo-ops`
  - 若同优先级证据指向多个不同域，或只有低优先级弱提示，则 `domain = null`
- `task_kind`
  - 只允许通过显式动作词映射；V1 冻结以下中英文字面等价映射：`analyze / summarize / 分析 / 总结 / 梳理 -> analyze`、`draft / write / 起草 / 撰写 -> draft`、`revise / update / tighten / revise doc / 修订 / 修改 / 收紧 -> revise`、`review / audit / 审核 / 审查 -> review`、`implement / build / fix / deliver / 实现 / 开发 / 修复 / 交付 -> implement`、`verify / test / check / validate / 验证 / 测试 / 检查 -> verify`、`debug / investigate failure / troubleshoot / 排查 / 调试 / 定位故障 -> debug`、`operate / run / publish / execute / 运行 / 发布 / 执行 -> operate`
  - 若同优先级同时出现多个互斥动作，或只有模糊意图没有显式动作词，则 `task_kind = null`
- `requested_artifact_types`
  - 只从显式目标文件、文件扩展名、产物名词中提取；允许多值
  - 若用户没有明确要求产物类型，则保持空数组，不允许根据历史 Skill 补猜
- `target_paths`
  - 只收集用户请求、任务标题、已引用 spec 中显式出现的仓库路径
  - 不允许根据命中的旧 Skill 追加未被当前任务提及的路径
- `referenced_specs`
  - 只收集当前任务显式引用的仓库内 spec 路径
  - 只允许写入规范化后的 `docs/specs/**/*.md` 仓库相对路径，并在写入前去重排序
  - 若用户只提到“某个需求/设计/exec-plan”但没有给出仓库路径，则保持空数组；V1 不允许根据历史 Skill、`project-facts` 或语义相似度补猜
- `constraint_tags`
  - 先取用户显式约束，例如“不要改主产品链路”“必须过 preflight”
  - 再由 `project-facts` 补齐与这些路径/领域直接相关的稳定约束
  - 若显式约束与 `project-facts` 冲突，必须记入 `resolution_notes` 并降级为 `ambiguous`
- `goal_terms`
  - 只允许保留用户请求、任务标题、已引用 spec 标题中的原始短语
  - 不做同义词扩写、不做 embeddings 召回、不做 LLM 改写

歧义与回退规则冻结为：

- `domain` 或 `task_kind` 任何一项为 `null`，`resolution_status` 必须不是 `resolved`，本次路由强制降级为 `no_confident_match`
- 同一字段只要同优先级证据冲突，就必须记为 `ambiguous`；高优先级证据可以覆盖低优先级证据，但必须在 `field_evidence` 和 `resolution_notes` 中留下来源
- `requested_artifact_types / target_paths / referenced_specs / constraint_tags / goal_terms` 允许为空，但空值必须原样进入 receipt，不得在实现阶段私自补猜；若某条任务级 gate 明确要求其中某个字段非空，则应在 gate 求值阶段落为 `missing_evidence` 或 `failed`
- `routing receipt` 必须保留 `field_evidence`，保证之后能审计“为什么被归到这个 domain/task_kind”

示例：

- 审核设计文档：`domain = design`，`task_kind = review`
- 审核 exec-plan：`domain = exec-plan`，`task_kind = review`
- code review：`domain = artifact-review`，`task_kind = review`
- 修订测试技能书：`domain = testing`，`task_kind = revise`
- 实施仓库脚本：`domain = repo-ops`，`task_kind = implement`

### 2. 校验 manual registry、project facts 与门禁

在 Skill 匹配前，系统必须先完成以下 freshness preflight，任一步失败都必须 fail closed：

- 校验 `docs/specs/agent-work/manual-skill-index.json`
- 校验 `docs/specs/agent-work/manual-skill-source-state.json`
- 重新计算 `manual-skill-source-state.json.source_docs[].path` 中全部 routeable manual source docs 的当前 `sha256`
- 再校验 `data/agent-memory/facts/index.json` 与 `facts/source-state.json`
- 上述校验全部通过后，才允许直接消费 `data/agent-memory/manifests/latest.json`

manual registry preflight 的冻结语义：

- `manual-skill-index.json`、`manual-skill-source-state.json` 和当前 manual source docs 三者必须同时一致：
  - registry 中每条 `source_doc_path` 都必须出现在 `manual-skill-source-state.json.source_docs[]`
  - source-state 中每个 routeable `source_doc_path` 的当前磁盘哈希都必须等于 `content_sha256`
  - registry 中每条 metadata 的 `source_doc_sha256` 都必须等于对应 source-state snapshot 的 `content_sha256`
- manifest 只要被直接用于路由，其 `input_snapshots` 就必须覆盖全部 routeable manual source docs；不得只校验 registry JSON 文件本身
- 任一路由级 manual source doc 发生变化、缺失、未被 source-state 覆盖、或 registry/source-state/source doc 三者不同步时，都视为 `manual registry unavailable`
- `manual registry unavailable` 时：
  - `manifests/latest.json` 必须视为 `stale`
  - 当前任务必须保守降级为 `no_confident_match`
  - 仍可继续基础工作流
  - 不得写新的 learned candidate，也不得执行 stable promotion

在 manual registry freshness 通过后，系统再读取 `data/agent-memory/facts/index.json` 与 `facts/source-state.json`：

- 为当前任务补齐或校验 `constraint_tags`
- 汇总当前任务共享的 task-scope `required_gates`
- 对每个候选 Skill，把 task-scope gates 与该 Skill 自身 `required_gates` 做确定性合并，并按 `gate_phase` 拆成 `routing-precondition` 与 `task-completion`
- 识别与本次任务相关的 `watch_paths`

`required_gates` 的绑定规则冻结为：

- `project-facts` 只能补充与当前 `domain / task_kind / target_paths` 直接相关的门禁，不得把整个仓库的所有 gate 全量塞给单个任务
- `project-facts` 中的 `approval` gate 只允许通过下文冻结的“任务类型 approval gates 的自动绑定契约”进入 task-scope gates；不得因为某条 `repo-policy` fact 存在，就把全部 approval gate 无差别挂到每个任务上
- Skill metadata 只能贡献当前候选 Skill 自己声明的 `required_gates`，不得把其他 Skill 的 gate 借入本候选
- 每个候选 Skill 的 effective gate set = task-scope gates ∪ skill metadata gates，并按 `gate_id + gate_kind + gate_phase` 去重
- 若同一候选 Skill 的 gate merge 中出现相同去重键，但 `evidence_source_type / evidence_ref_hint / freshness_rule` 不一致，则该 Skill 必须直接进入 `rejected_matches`，理由为 `gate-contract-conflict`
- task-scope 的 `routing-precondition` gate 必须在路由时立即求值，并写入 `task_routing_gates_evaluated`
- 每个候选 Skill 自己的 effective `routing-precondition` gate 也必须在路由时立即求值，并写入 `candidate_evaluations[*].routing_gate_evaluations`
- 每个候选 Skill 的 effective `task-completion` gate 只登记到 `candidate_evaluations[*].effective_task_completion_gates`，进入执行阶段后再对实际复用到的 Skill 重新求值；不得在路由时拿来源任务回执冒充当前任务通过
- 同一 gate 进入任一 `GateEvaluation` 时，必须带上 `gate_id / gate_kind / gate_phase / evidence_source_type / evidence_ref / freshness_rule`
- 路由阶段只允许使用当前权威文档状态、`project-facts` 和当前任务显式输入；缺失证据时必须落 `missing_evidence`，不得默认视为 `passed`

任务类型 preflight gates 的自动绑定契约冻结为：

1. 下列映射是 V1 唯一允许的自动绑定规则：
   - `domain = design` 且 `task_kind = review`，并且目标产物或路径落在 `design-doc` / `docs/specs/design-docs/*` -> 自动并入 `design-review-preflight`
   - `domain = exec-plan` 且 `task_kind = review`，并且目标产物或路径落在 `exec-plan` / `docs/specs/exec-plans/*` -> 自动并入 `exec-plan-review-preflight`
   - `domain = artifact-review` 且 `task_kind = review`，并且 `requested_artifact_types` 命中 `source-code`、`test-code` 或 `config` -> 自动并入 `code-review-preflight`
   - `domain = code-implementation` 且 `task_kind = implement` -> 自动并入 `code-implementation-preflight`
   - `domain = testing` 且 `task_kind` 属于 `draft`、`revise`、`verify` -> 自动并入 `testing-skill-preflight`
2. `artifact-review` 但目标产物只有 `report` 或 `audit-receipt` 时，V1 不自动绑定 `code-review-preflight`；若需要附加 preflight，必须由 explicit `project-fact` block 或 Skill metadata 明确声明。
3. 除上面五条外，不允许实现阶段再根据“看起来像 review / implementation / testing”自由补绑其他 preflight gate。
4. 自动绑定出的 preflight gate 在 V1 的相位冻结如下：
   - `design-review-preflight` -> `task-completion`
   - `exec-plan-review-preflight` -> `task-completion`
   - `code-review-preflight` -> `task-completion`
   - `code-implementation-preflight` -> `routing-precondition`
   - `testing-skill-preflight` -> `routing-precondition`
5. 对 `routing-precondition` 型 preflight：
   - 必须在进入默认复用路径、代码实现路径或测试执行路径之前，以当前任务命令成功退出拿到 fresh 证据
   - 证据必须先写入 `task_routing_gates_evaluated`
   - 若缺失或失败，当前任务不得进入对应默认执行路径；必须 fail closed 为 `no_confident_match`，并先补齐 preflight 或缺失的任务输入
6. 对 `task-completion` 型 preflight：
   - 必须在输出正式 review / audit / completion 结论前，以当前任务命令成功退出拿到 fresh 证据
   - 历史任务回执不能替代当前任务 preflight
7. `code-implementation-preflight` 的附加绑定条件冻结如下：
   - `TaskFingerprint.referenced_specs` 必须恰好包含 1 条 `docs/specs/exec-plans/*.exec-plan.md`
   - 若为 `0` 条，则该 gate 评估结果必须为 `missing_evidence`
   - 若多于 `1` 条，则该 gate 评估结果必须为 `failed`，并在 `detail` 中写明 `ambiguous-exec-plan-reference`
   - 未满足该附加条件时，当前任务不得进入代码实现路径，也不得把后续结果计入 candidate creation、successful reuse 或 stable promotion
8. 若当前任务显式符合多条自动绑定规则，必须全部并入；若多条规则导出相同 `gate_id` 以外的冲突契约，则该任务必须 fail closed，并把冲突写入 `task_completion_gates_evaluated` 或 `rejected_matches`。

任务类型 approval gates 的自动绑定契约冻结为：

1. V1 唯一允许的 task-scope approval 来源，是 `agentReadme.md` 内置提取器导出的 `repo-policy.agentreadme-md.design-approval-before-exec-plan` fact；除这条 fact 外，不允许实现阶段私自再发明第二套 approval 来源。
2. `design-approved` 只允许在以下场景自动并入 task-scope `routing-precondition` gates：
   - `domain = exec-plan`
   - `task_kind` 属于 `draft`、`revise`、`implement`
   - 目标产物或目标路径落在 `exec-plan` / `docs/specs/exec-plans/*`
3. 上述 `design-approved` 的目标文档解析规则冻结如下：
   - 必须从 `TaskFingerprint.referenced_specs` 中解析出恰好 1 条 `docs/specs/design-docs/*.md`
   - 若为 `0` 条，则该 gate 评估结果必须为 `missing_evidence`，并在 `detail` 中写明 `missing-design-reference`
   - 若多于 `1` 条，则该 gate 评估结果必须为 `failed`，并在 `detail` 中写明 `ambiguous-design-reference`
   - 若唯一 design doc 已解析出，则 `GateEvaluation.evidence_ref` 必须回指该 design doc 路径，并完全按前述“文档状态权威契约”判断其是否 `passed`
4. approval auto-binding 的 fail-closed 行为冻结如下：
   - 任一自动绑定的 `approval` gate 只要不是 `passed`，当前任务都必须先落为 `no_confident_match`
   - `domain = exec-plan` 且命中上述 `design-approved` 规则时，若 gate 未通过，当前任务只允许继续做只读分析或治理反馈；不得创建或更新 `docs/specs/exec-plans/*.exec-plan.md`
5. `domain = code-implementation` 的治理边界在 V1 不通过额外发明 `exec-plan-approved` 来表达：
   - 当前任务仍必须满足 `code-implementation-preflight`
   - `TaskFingerprint.referenced_specs` 仍必须恰好解析出 1 条 `docs/specs/exec-plans/*.exec-plan.md`
   - 若未来需要把“某份 exec-plan 可进入默认实现路径”冻结成独立 approval 语义，必须先在根规则中显式新增对应 authority source；在此之前不得从 design-approval rule 反向推出新的 `approval` gate
6. 以下场景默认不自动绑定 approval gate：
   - `domain = design` 下的 `draft` / `revise` / `review`
   - `domain = exec-plan` 且 `task_kind = review`
   - `domain = requirements`
   - `artifact-review`、`testing`、`visual-console`、`automation`、`repo-ops`
   - 原因是这些任务要么本身就是为了产出审批前文档，要么需要能够审计“尚未批准”的事实，而不是在路由前被审批 gate 静默挡住
7. 除上述自动绑定规则外，其他 approval gate 只能来自显式 Skill metadata；即使来自 Skill metadata，也必须继续遵守同一套目标文档解析与“文档状态权威契约”，若当前任务无法唯一解析目标文档，则 gate 评估结果必须为 `missing_evidence` 或 `failed`，不得默认 `passed`。

仓库级 completion gates 的绑定契约冻结为：

1. `agentReadme.md` 导出的 `pnpm lint`、`pnpm typecheck`、`pnpm test` 三条 facts 统称 `repo-completion-static`。
2. 当当前任务满足任一条件时，task-scope `task-completion` gates 必须自动并入这三条 gate：
   - `domain` 属于 `code-implementation`、`testing`、`visual-console`、`repo-ops`
   - `requested_artifact_types` 中包含 `source-code`、`test-code`、`config`、`skill-script`
   - `target_paths` 或执行后 `files_touched` 命中 `src/`、`app/`、`scripts/`、`package.json`、`tsconfig.json`、`config.yaml`
3. `run-daily-dry-run`、`run-weekly-dry-run`、`score-dry-run`、`build-kb-dry-run` 四条 gate 只能来自前述 `agentReadme.md` completion-gate facts，不允许实现阶段私自发明第五条“看起来差不多”的任务特定验证命令。
4. 若当前任务的 `target_paths` 或执行后的 `files_touched` 与上述四条 entrypoint facts 的 `related_paths` 恰好命中 `1` 条，则必须把对应 gate 并入 `task-completion` gates。
5. 若当前任务修改了主产品运行路径（`src/signal/`、`src/filter/`、`src/action/`、`src/storage/`、`data/reports/`、`data/kb/`），但按前述规则命中 `0` 条或 `>1` 条 entrypoint gate，则不得猜测：
   - 必须生成一条 synthetic `GateEvaluation`
   - `gate_id = task-specific-verification`
   - `gate_kind = verification-command`
   - `gate_phase = task-completion`
   - `evidence_source_type = project-fact`
   - `state = missing_evidence`
   - `detail` 必须写明“未唯一解析出 run-daily / run-weekly / score / build-kb 中的哪一条任务特定验证命令”
   - 当前任务不得把该结果计入 candidate creation、successful reuse 或 stable promotion
6. `requirements`、`design`、`exec-plan` 三类文档任务默认不自动绑定上述 runtime verification commands；只有当 explicit `project-fact` block 或 Skill metadata 明确声明了附加 gate，才允许额外并入。
7. 若路由阶段只靠 `target_paths` 还无法唯一解析 entrypoint gate，但执行后 `files_touched` 可以唯一解析，则 `task_execution` / `candidate-synthesis` 必须按 `files_touched` 结果补齐 gate；不得因为路由阶段暂时未解析就永久跳过任务特定验证。
8. 对以下命令对应的 gate：
   - `pnpm typecheck`
   - `pnpm test`
   - `run-daily-dry-run`
   - `run-weekly-dry-run`
   - `build-kb-dry-run`
   其证据绑定的 `TaskCommandRecord.runtime_context` 必须为 `conda:agent-trend-radar`
   - 若为 `other`，gate 必须判为 `failed`
   - 若为 `unknown`，gate 必须判为 `missing_evidence`
   - `pnpm lint` 与 `score-dry-run` 默认不继承该固定环境约束；若未来根规则扩大范围，必须先补充对应 fact-export 契约

如果 `facts/index.json`、`facts/source-state.json` 缺失、结构无效或已过期：

- 系统不得假装仍有完整约束上下文
- 本次路由必须保守降级为 `no_confident_match`
- 仍可继续基础工作流

如果 manual registry 已通过、facts 也通过，但 `manifests/latest.json.input_snapshots` 与当前 manual source docs / facts / learned `.json/.md` 任一不一致：

- 系统必须先 full rebuild manifest
- rebuild 失败则本次路由保守降级为 `no_confident_match`
- 不得跳过 manifest freshness 直接拿旧 `routing_index` 继续主命中

### 3. 匹配与评分

V1 采用可审计的规则化匹配，不使用 embeddings 黑盒召回。每条 Skill 按以下规则打分：

- 同 `domain`：`+20`
- 同 `task_kind`：`+20`
- `artifact_types` 有交集：`+20`
- `target_paths` 前缀有交集：`+15`
- `constraint_tags` 有交集：`+10`
- `goal_terms` 有精确交集：`+10`
- 最近 30 天内成功复用过：`+5`

每个进入排序的候选 Skill 都必须产出一份 `SkillRoutingEvaluation`：

- `score_breakdown` 必须逐条解释每一项加分来自哪些字段证据
- `effective_routing_gates` / `effective_task_completion_gates` 必须保留每条 gate 来自 `project-fact` 还是 `skill-metadata`
- `routing_gate_evaluations` 必须只记录该候选 Skill 合并后的 effective `routing-precondition` gate 结果
- `decision` 只能是 `primary_match`、`reference_match` 或 `rejected`

主命中前置条件冻结为：

- 候选 Skill 自己的 `routing_gate_evaluations` 中的 gate 必须全部为 `passed`
- `artifact_types` 或 `target_paths` 至少有一项命中
- `trust_tier` 只能是 `manual` 或 `learned_stable`
- `lifecycle_status` 必须是 `stable`
- `drift_status` 必须是 `trusted`

路由阈值冻结为：

- `score >= 75` 且领先第二名至少 `10` 分，才允许成为 `primary_match`
- `55 <= score < 75` 的结果可进入 `reference_matches`
- `score >= 75` 但未满足主命中前置条件的结果，只能降级为 `reference_matches` 或 `rejected_matches`
- `learned_candidate` 无论分数多高，都不能成为 `primary_match`
- `paused`、`expired`、`retired` 或 `degraded` 的 Skill，不进入 `primary_match`

### 4. 路由结果语义

每次任务开始都必须写出 `routing receipt`，包括：

- `task_fingerprint`
- `resolved_project_facts`
- `task_routing_gates_evaluated`
- `candidate_evaluations`
- `primary_match`
- `reference_matches`
- `rejected_matches`
- `decision_reason`

当 manifest 缺失/过期、facts 缺失、候选冲突或命中依据不足时，系统必须失败为 `no_confident_match`，并继续基础工作流，而不是猜测式套用旧经验。

其中：

- `task_fingerprint` 必须包含每个字段的 `field_evidence` 与 `resolution_notes`
- `task_routing_gates_evaluated` 只记录当前任务共享的 `routing-precondition` gate，必须逐条写出 `GateEvaluation`
- `candidate_evaluations` 必须逐条保留每个候选 Skill 的 `score_breakdown`、合并后的 effective gates、候选级 `routing_gate_evaluations`、执行期仍需满足的 `effective_task_completion_gates`，以及被拒绝时的 `rejection_reasons`
- `primary_match`、`reference_matches` 与 `rejected_matches` 都只是 `candidate_evaluations` 的摘要投影；三者不得脱离 `candidate_evaluations` 单独生成
- 任何候选 Skill 的 `routing_gate_evaluations` 里只要出现 `failed / not_applicable / missing_evidence / stale`，都视为该候选 gate 未满足
- `decision_reason` 必须能直接解释是“强制未命中”“主命中”“仅辅助参考”中的哪一种，以及阻塞主命中的具体原因

## 任务完成后的闭环

### 候选提炼判定

只有同时满足以下条件的任务，才允许生成候选 Skill：

1. `TaskExecutionReceipt.result = success`
2. `TaskExecutionReceipt.task_completion_gates_evaluated` 已在当前任务中生成完整 `GateEvaluation`，且所有适用 `task-completion` gate 都为 `passed`
3. 所有适用的 `verification_commands` 为 `passed`
4. `TaskExecutionReceipt.domain` 与 `task_kind` 都已被当前任务证据唯一解析为非空
5. 存在清晰的 `requested_artifact_types`、`target_paths` 或 `files_touched`
6. `TaskExecutionReceipt.reusable_summary` 存在，且通过前述结构校验
7. `TaskExecutionReceipt.learning_blockers` 为空
8. `candidate-synthesis` 已完成与同一 `domain/subdomain` 下全部 routeable manual / learned Skill 的冲突检测，且不存在未解除的 `manual-authority-conflict`、`exact-scope-contract-conflict` 或 `empirical-replacement-conflict`

任何一个条件不满足，系统只写 `task receipt` 和 `session archive`，不得写候选 Skill。

候选提炼阶段的门禁语义冻结为：

- `task_completion_gates_evaluated` 必须覆盖当前任务实际执行过的 Skill 所对应的全部 effective `task-completion` gate；若任务最终走基础工作流，则只覆盖该工作流仍然适用的 `task-completion` gate
- 任意 `failed / not_applicable / missing_evidence / stale` 都视为门禁未满足，阻断候选 Skill 写入
- 候选提炼不得复用“来源任务曾经过 gate”来替代本次任务的 gate 证据
- 候选 Skill 写入时，必须同时写出一份 `event_type = candidate-created` 的 `SkillLifecycleEventReceipt`
- 候选提炼不得重新解析聊天文本来补 `Intent / Steps / Validation`；正文只能来自当前任务 `reusable_summary`

### 候选 Skill 生成内容

候选 Skill 必须从任务回执中显式填出；字段来源冻结为：

- `Intent` = `TaskExecutionReceipt.reusable_summary.intent`
- `Use When` = `TaskExecutionReceipt.reusable_summary.use_when`
- `Do Not Use When` = `TaskExecutionReceipt.reusable_summary.do_not_use_when`
- `Inputs & Preconditions` = `TaskExecutionReceipt.reusable_summary.inputs_preconditions`
- `Steps` = `TaskExecutionReceipt.reusable_summary.steps`
- `Validation` = `TaskExecutionReceipt.reusable_summary.validation`
- `Failure Signals` = `TaskExecutionReceipt.reusable_summary.failure_signals`
- `Fallback` = `TaskExecutionReceipt.reusable_summary.fallback`
- 来源任务与文件路径
- `domain / subdomain / task_kind / artifact_types / goal_terms / constraint_tags / watch_paths`

补充冻结规则：

- `reusable_summary.source_mode = corrected-after-fallback` 时，候选正文里的 `Steps` 只允许表达最终成功路径；失败过的旧路径只能进入 `Failure Signals` 或 `Fallback`
- `reusable_summary.source_mode = successful-reuse` 时，候选正文允许吸收本次成功复用的 path，但不得把历史 source task 的旧正文原样复制过来覆盖当前任务证据
- 任一正文 section 若无法回指到 `reusable_summary` 对应字段，或该字段为空，则 candidate write 必须失败
- `rejected_learning_reasons` 必须至少覆盖：`learning_blockers.reason`、gate 未满足原因、冲突阻断原因

候选生成后默认属性为：

- `trust_tier = learned_candidate`
- `lifecycle_status = candidate`
- `drift_status = trusted`
- `last_verified_at = source TaskExecutionReceipt.created_at`
- `drift_status = trusted` 只表示候选元数据与来源回执新鲜，不赋予 `primary_match` 资格；候选仍必须满足 stable / 主命中前置条件后才能进入默认复用位

### 脚本挂接契约

V1 允许两类 Skill 共存：

1. `document-first skill`
   - 只有 Markdown + JSON 元数据
2. `script-attached skill`
   - Markdown + JSON 元数据 + `script_refs`

冻结规则：

- 没有 Markdown 结构化说明的脚本，不算 Skill。
- `script_refs` 必须指向仓库内真实路径。
- 脚本失踪、重命名或不可执行时，Skill 自动失去 `primary_match` 资格。

这补齐了需求中“脚本型 Skill 与纯文档型 Skill 的统一治理视图”缺口。

## 生命周期状态机

### 晋升规则

候选 Skill 晋升为 learned stable Skill，必须同时满足：

1. 来源任务已完成验证并有完整 `TaskExecutionReceipt`
2. Skill Markdown 结构完整
3. 未与根规则、项目稳定事实、manual Skill 或 approved specs 冲突
4. 满足以下二选一：
   - 后续至少发生 1 次成功复用并通过验证
   - 维护者显式写入 `event_type = manually-confirmed` 的生命周期回执，并提供 `manual_confirmation_ref`

晋升后属性变化为：

- `trust_tier = learned_stable`
- `lifecycle_status = stable`
- `promoted_at` 写入时间戳
- `promotion_source / promotion_evidence_refs / last_lifecycle_event_id` 必须同步更新
- 必须追加一份 `event_type = promoted` 的 `SkillLifecycleEventReceipt`，记录晋升原因、证据和相关 gate 评估

### 降级规则

learned stable Skill 出现以下任一情况时必须降级：

- 连续 2 次复用验证失败，且发生在 14 天内；该判定必须按该 Skill 在全部 `reuse/*` 回执中的 attempt 时间序列计算，而不是只看某一份 receipt 的最终状态
- `watch_paths` 命中的关键文件发生变化后未通过复核
- 挂接脚本缺失、关键命令失效或 `required_gates` 改变

降级结果：

- 先把 `drift_status` 设为 `degraded`
- 再把 `lifecycle_status` 设为 `paused`
- 从 `primary_match` 候选集中移除
- 同时写入 `event_type = demoted` 或 `paused` 的生命周期回执，显式记录 `demotion_reason`、证据和触发源

### 恢复规则

`paused` 或 `expired` 的 learned stable Skill 只能通过显式 `revalidated` 流程回到 `stable`，禁止静默把 metadata 改回可复用态。

恢复到 `stable` 必须同时满足：

1. 触发该次降级/过期的最近原因已被当前证据解除：
   - 挂接脚本已恢复
   - 相关 `watch_paths` 变化已重新检查
   - `required_gates` 已按当前权威状态重新求值
2. Skill 当前的 Markdown / JSON / `script_refs` / `watch_paths` 结构完整且可解析
3. 当前轮 `routing-precondition` 与适用的 `task-completion` gate 都已生成 fresh `GateEvaluation`，且全部为 `passed`
4. 满足以下二选一：
   - 存在一次新的成功复用：`execution_result = success`、`verification_result = passed`、`fallback_used = false`
   - 对纯文档型 Skill，维护者显式写入 `event_type = revalidated` 的生命周期回执，并提供 `manual_confirmation_ref`，解释为什么无需脚本执行也足以恢复默认复用资格

恢复成功后的状态回写冻结为：

- `trust_tier` 保持 `learned_stable`
- `lifecycle_status = stable`
- `drift_status = trusted`
- `last_verified_at` 必须更新为本次恢复证据对应的时间
- 若本次存在成功复用，`last_used_at` 也必须同步更新
- `demotion_reason` 必须清空为当前无效；历史原因只保留在 `lifecycle/*`
- 必须追加一份 `event_type = revalidated` 的 `SkillLifecycleEventReceipt`

补充冻结规则：

- `retired` 不能被恢复，只能保留索引与审计。
- 仅凭一次“定期扫描通过”或“上游文件暂时没变”不足以让 `paused/expired` Skill 自动回到 `stable`。
- 若定期/事件复核只证明“漂移原因已解除”，但没有新的成功复用或显式人工确认，则该 Skill 最多保持 `pending_recheck`，不得恢复 `primary_match` 资格。

### 过期与废弃

- `expired`
  - stable Skill 的 `last_verified_at` 连续 45 天未被推进
  - 由于成功复用与成功复核都必须推进 `last_verified_at`，实现阶段不得再额外引入第二套“是否过期”时间口径
- `retired`
  - 被明确替换、人工废弃，或确认不再符合仓库工作方式

`expired` 可以经重新验证回到 `stable`，`retired` 只能保留索引与审计，不再参与路由。

补充冻结规则：

- 进入 `expired`、`retired`、`superseded` 或 `conflict-recorded` 时，必须写对应 `SkillLifecycleEventReceipt`
- 如果某条 learned Skill 被 manual Skill 接管，必须同时：
  - 在 learned metadata 写入 `replacement_skill_id / retirement_reason / last_lifecycle_event_id`
  - 在 `lifecycle/*` 写入 `event_type = superseded` 或 `retired` 的回执，并把 manual Skill `skill_id` 放入 `related_skill_ids`

## 复用失败与纠偏闭环

### 复用尝试记录

每次 Skill 被使用都必须写一份 `reuse receipt`：

```ts
type ReuseFailureKind =
  | "none"
  | "invalid-input"
  | "timeout"
  | "external-failure"
  | "execution-error"
  | "verification-failed"
  | "stale-project-facts"
  | "stale-skill-metadata";

interface SkillReuseAttempt {
  attempt_seq: number;
  attempted_at: string;
  precondition_check: "passed" | "failed";
  execution_result: "success" | "partial" | "failed";
  verification_result: "passed" | "failed" | "not_run";
  fallback_used: boolean;
  failure_stage: "none" | "precondition-check" | "execution" | "verification";
  failure_kind: ReuseFailureKind;
  failure_reason?: string;
  failure_evidence_refs: string[];
  reexplored_paths: string[];
  correction_summary?: string;
}

interface SkillReuseReceipt {
  task_id: string;
  skill_id: string;
  match_role: "primary" | "reference";
  attempts: SkillReuseAttempt[];
  attempt_count: number;
  last_attempted_at: string;
  precondition_check: "passed" | "failed";
  execution_result: "success" | "partial" | "failed";
  verification_result: "passed" | "failed" | "not_run";
  fallback_used: boolean;
  failure_stage: "none" | "precondition-check" | "execution" | "verification";
  failure_kind: ReuseFailureKind;
  failure_reason?: string;
  failure_evidence_refs: string[];
  reexplored_paths: string[];
  correction_summary?: string;
  successful_attempt_count: number;
  failed_attempt_count: number;
  partial_attempt_count: number;
  last_success_attempt_at?: string;
  last_failure_attempt_at?: string;
  corrected_task_receipt_ref?: string;
}
```

冻结规则：

- 同一 `task_id` 如果实际复用了多条 Skill，必须为每个 `skill_id` 各写一份 `reuse receipt`
- 同一 `task_id + skill_id` 内的多次尝试必须聚合到同一 receipt，并在 `attempts[]` 中按 `attempt_seq` 单调追加，不得额外写第二份同名 receipt
- `attempts[]` 是 canonical attempt ledger；顶层 `attempt_count / precondition_check / execution_result / verification_result / fallback_used / failure_* / reexplored_paths / correction_summary` 都只是“最近一次 attempt 的派生摘要”，必须可从 `attempts[]` 重建
- `successful_attempt_count / failed_attempt_count / partial_attempt_count / last_success_attempt_at / last_failure_attempt_at` 也必须从 `attempts[]` 推导，不得独立写出与 `attempts[]` 矛盾的值
- `failure_stage = none` 时，`failure_reason` 可以为空；否则必须显式写出失败原因
- `failure_evidence_refs` 必须指向命令输出、回执路径、文档状态或脚本路径，不能只写抽象判断
- `fallback_used = true` 时，`reexplored_paths` 与 `correction_summary` 至少要有一项非空，用来说明哪些部分重新探索、修正到了哪里
- 修正后若任务最终成功，`corrected_task_receipt_ref` 必须回指本次任务的 `TaskExecutionReceipt`
- 连续失败、连续 timeout、最近 30 天成功复用率/失败率、以及漂移扫描里的“连续 2 次复用失败”都必须按跨 receipt 的 `attempts[]` 时间序列计算，不能只看每份 receipt 的终态摘要
- 只有 `execution_result = success`、`verification_result = passed`、`fallback_used = false` 的 attempt 才计入 successful reuse，并且必须同步：
  - 更新目标 Skill 的 `successful_reuse_count`
  - `last_used_at = attempt.attempted_at`
  - `last_verified_at = 当前 TaskExecutionReceipt.created_at`

### 执行期失败分类

- `invalid-input`
  - 例如当前任务路径、产物类型、前置文档状态与 Skill `Use When / Inputs & Preconditions` 不匹配
  - 结果必须是 `precondition_check = failed`、`execution_result = failed`、`verification_result = not_run`
- `timeout`
  - 任何脚本、命令或验证在 Skill 约定窗口内未完成，都视为 `execution_result = failed`
  - 必须保留超时命令、时间窗口和中断证据；不得把 timeout 视为“未发生失败”
- `external-failure`
  - 例如网络、权限、外部服务、上游依赖、环境锁导致的失败
  - 必须写入 `failure_kind = external-failure`
  - 它阻断本次候选生成与成功复用计数；只有当失败来源属于 Skill 已声明依赖，或连续重复出现时，才进入后续 drift / demotion 判定
- `execution-error`
  - 命令退出非 0、脚本路径错误、脚本语义过期、文件约束违反等执行期错误
  - 视为 Skill 路径本身失败，允许直接进入 `pending_recheck`
- `partial`
  - 当任务只完成部分产物、只修复部分步骤、或 fallback 后仍残留未验证环节时，`TaskExecutionReceipt.result` 必须为 `partial`
  - 与之对应的 `SkillReuseReceipt.execution_result` 也必须为 `partial`
  - `partial` 不得计入 successful reuse、effective hit、candidate creation 或 stable promotion
- `stale-project-facts` / `stale-skill-metadata`
  - 这两类失败必须映射到 `GateEvaluation.state = stale`
  - 默认复用路径必须停止，受影响 Skill 至少进入 `pending_recheck`
- `unsafe SQL`
  - V1 不引入数据库或 SQL 写路径，本项固定为 `not_applicable`
  - 任一未来引入 DB-backed canonical store 的方案，必须另开 requirement + design，不得沿用本设计直接扩展

### 失败时的固定行为

当出现以下任一情况时，系统必须执行统一 fail-closed 行为：

- `precondition_check = failed`
- `execution_result = failed`
- `execution_result = partial`
- `failure_kind = timeout`
- `failure_kind = external-failure`
- `failure_kind = stale-project-facts`
- `failure_kind = stale-skill-metadata`
- `verification_result != passed`

固定行为如下：

1. 立即退出该 Skill 的默认复用路径
2. 回退到基础工作流或人工 Skill 路径
3. 在 `reuse receipt` 中写入结构化失败原因、失败证据与重新探索范围
4. 生成当前任务的 `TaskExecutionReceipt` 时，必须把对应失败映射到 `result / result_reason / task_completion_gates_evaluated`
5. 若形成修正后的可验证路径，把 `corrected_task_receipt_ref` 回指到本次任务回执，并重新送入候选提炼判定

补充冻结规则：

- `execution_result = partial` 时，`verification_result` 不允许为 `passed`
- `failure_kind = timeout` 时，本次 Skill 不得写成功复用；若连续两次 timeout 且证据指向同一脚本/命令路径，则可触发 `pending_recheck`
- `failure_kind = external-failure` 时，若证据显示只是当前环境偶发故障、且不属于 Skill 声明依赖，则只记 failed reuse，不自动降级 stable Skill
- `result = partial` 或 `result = failed` 的任务不得生成 learned candidate
- 任一 `stale-*` 失败都必须阻断 `primary_match`、candidate write 和 stable promotion，直到相关 canonical 状态重建完成

禁止行为：

- 旧 Skill 命中后继续盲目强行执行
- 因为“以前成功过”而跳过这次验证

## 漂移扫描

需求文档要求设计阶段冻结节奏和触发条件，V1 统一如下。

### 高频 stable Skill 定义

满足任一条件即视为高频 stable Skill：

- `successful_reuse_count >= 5`
- 最近 30 天成功复用次数 `>= 3`

### 定期复核节奏

- 高频 stable Skill：每 `14` 天至少复核一次
- 其他 stable Skill：每 `30` 天至少复核一次

### 受影响 Skill 解析契约

V1 不允许实现阶段凭“看起来相关”去决定哪些 Skill 进入 `pending_recheck`。每次 drift 事件都必须先解析 `affected_skill_ids`，再写状态回执。

单个 drift 事件的影响范围冻结为：

1. `global-root` 事件：直接影响全部当前非 `retired` 的 manual / learned Skills
   - `agentReadme.md` 变化
   - `manual-skill-index.json` 变化
   - `manual-skill-source-state.json` 变化
   - `facts/index.json` / `facts/source-state.json` rebuild 失败或无法计算新旧 diff
2. `manual-source` 事件：影响“被改 manual Skill + 它的 learned 邻域”
   - 先通过 `manual-skill-source-state.json.source_docs[].skill_ids` 解析出变更源文档对应的 manual `skill_id`
   - 再把以下 learned Skills 一并纳入：
     - 同一 `domain/subdomain` 的 learned Skills
     - `parent_skill_id` 指向这些 manual Skills 的 learned descendants
     - `conflict_with_skill_ids` 或 `replacement_skill_id` 指向这些 manual Skills 的 learned Skills
     - 出现在对应 manual metadata `supersedes_learned_skill_ids` 中的 learned Skills
   - 若 source-state 无法把变更文档唯一映射到 `skill_ids`，则升级为 `global-root`
3. `fact-source` 事件：影响与变更 facts 真正绑定的 Skills
   - 若可从旧/新 `facts/index.json` 计算出变更 `fact_id` 集合，则受影响 Skill 满足任一条件即可：
     - `watch_paths` 命中变更的 fact source doc 或 `related_paths`
     - `constraint_tags` 与变更 facts 的 `constraint_tags` 有交集
     - `required_gates.gate_id` 或 `evidence_ref_hint` 与变更 facts 导出的 gate 集合有交集
     - `target_paths` 与变更 facts 的 `related_paths` 存在前缀交集
   - 若无法算出变更 `fact_id` 集合，或 `facts/index.json` 当前已 stale，则升级为 `global-root`
4. `skill-self` 事件：影响 Skill 自身及其谱系邻域
   - 任一 learned `.json` 或同名 `.md` 变化时：
     - 该 `skill_id` 自身
     - `parent_skill_id` 链上的直接 children
     - `replacement_skill_id` / `conflict_with_skill_ids` 指向的 peers
5. `script-runtime` 事件：影响脚本与运行时相关 Skills
   - `scripts/**` 变化：命中 `script_refs` 或 `watch_paths` 的 Skills
   - `package.json` / `config.yaml` 变化：
     - 命中 `watch_paths` 的 Skills
     - 全部 `script_refs` 非空的 Skills
     - 全部带有 `repo-completion-static` 相关约束标签，或绑定了 `run-daily-dry-run` / `run-weekly-dry-run` / `score-dry-run` / `build-kb-dry-run` 这些 task-completion gates 的 Skills
6. `failure-sequence` 事件：只影响当前 Skill 自身
   - 连续 2 次复用失败
   - 连续 2 次 timeout 且证据指向同一脚本/命令路径

多事件同时发生时：

- `affected_skill_ids` 取并集
- 只要任一事件落入 `global-root`，整批复核就必须按 `global-root` 处理
- 若某事件既无法落入上述 6 类之一，也无法从当前 canonical 状态求出 `affected_skill_ids`，则必须 fail closed 为 `global-root`

### 事件触发复核

出现以下事件时，必须立刻把相关 Skill 标记为 `pending_recheck`：

- `agentReadme.md` 变化
- `docs/specs/agent-work/manual-skill-index.json` 变化
- `docs/specs/agent-work/manual-skill-source-state.json` 变化
- `docs/specs/agent-work/*.md` 中被 registry 引用的源文档变化
- `data/agent-memory/facts/index.json` 或 `facts/source-state.json` 变化
- 任一 `data/agent-memory/learned/**/*.json` 或其同名 `.md` 变化
- 任一出现在 `facts/source-state.json.source_docs[].path` 或 `ProjectFactRecord.source_doc_paths` 中的上游源文档变化
- `package.json`、`config.yaml` 变化
- `scripts/**` 变化
- Skill 自身 `watch_paths` 命中的路径变化
- 连续 2 次复用失败；该判定必须按该 Skill 在全部 `reuse/*` 回执中的 attempt 时间序列计算

### 复核后的状态回写

- 当前 `lifecycle_status = stable` 且复核成功：
  - `drift_status = trusted`
  - `last_verified_at` 必须更新为该次 `revalidated` 生命周期回执的 `created_at`
  - 不得因此更新 `last_used_at` 或 `successful_reuse_count`
  - 必须写一份 `event_type = revalidated` 的生命周期回执
  - `trigger` 只能是 `scheduled-recheck` 或 `event-recheck`
- 当前 `lifecycle_status = paused` 或 `expired` 且复核只证明“没有继续漂移”：
  - `lifecycle_status` 保持不变
  - `drift_status` 至多回到 `pending_recheck`
  - 不得仅凭本次复核恢复 `primary_match`
- 复核失败：
  - `drift_status = degraded`
  - 必要时 `lifecycle_status = paused`

只要 `drift_status != trusted`，该 Skill 就不能作为 `primary_match`。

## 可观测性与审计产物

V1 的可观测性不是单一统计面板，而是以下文件系统审计产物的组合：

- `docs/specs/agent-work/manual-skill-index.json`：当前有哪些可路由 manual Skill
- `docs/specs/agent-work/manual-skill-source-state.json`：当前哪些 manual Skill 源文档被快照覆盖，是否仍与 registry 同步
- `facts/index.json`：当前仓库有哪些稳定事实在参与约束绑定
- `facts/source-state.json`：当前 `project-facts` 是基于哪些上游源文档快照构建的
- `tasks/*`：这次任务做了什么、实际用了哪些已有 Skill、验证了什么
- `routing/*`：任务开始前为什么命中或未命中
- `reuse/*`：Skill 复用是否成功，失败时如何降级
- `archives/*`：来源会话和对用户/审计可读的任务摘要
- `lifecycle/*`：为什么某条 Skill 被创建、晋升、降级、替换、冲突裁决或退役
- `drift/*`：为什么某条 Skill 被标记为待复核、降级或 reconcile 失败
- `manifests/latest.json`：供路由使用的派生快照
- `tree/*`：当前仓库已经学会了什么、哪些仍可信

任何“增长结论”都必须能回指到这些原始回执，而不能只留聚合统计。

### `archives/*` 最小结构

V1 不允许实现阶段自由决定 session archive 写什么。`archives/YYYY-MM-DD/<task-id>.md` 至少必须包含以下固定 section：

1. `User Request`
   - 来自 `TaskExecutionReceipt.user_request_summary`
2. `Routing Summary`
   - 来自 `routing/<date>/<task-id>.json` 的 `primary_match`、`reference_matches`、`decision_reason`
3. `Skills Actually Used`
   - 逐条镜像 `TaskExecutionReceipt.skill_usage`
   - 若为空，必须显式写 `No reused skills in this task.`
4. `Re-explored Paths And Corrections`
   - 来自 `TaskExecutionReceipt.skill_usage[*].reexplored_paths`
   - 若所有 entry 都为空，必须显式写 `No re-exploration was required.`
5. `Verification Evidence`
   - 只允许汇总当前任务 `verification_commands` 与 `task_completion_gates_evaluated` 中 `passed / failed / missing_evidence / stale` 的结果摘要
6. `Source Receipt Refs`
   - 必须列出当前任务对应的 `routing/*`、`tasks/*`、相关 `reuse/*`、以及若发生生命周期变化时的 `lifecycle/*`

冻结语义：

- `archives/*` 是用户/审计可读摘要，不是新的 canonical 真相来源；它只能镜像已有 receipt，不能补写 receipt 中不存在的事实。
- `Skills Actually Used` 与 `Re-explored Paths And Corrections` 只允许来自当前任务 `TaskExecutionReceipt.skill_usage`；不得通过扫描历史同类任务或聊天文本补猜。
- 同一 `task_id` 的 archive 若被重写，只允许做格式修正或补齐已经存在的 receipt 引用；不得在缺少新 receipt 的情况下新增结论。

V1 同时冻结以下统计口径：

- `hit_rate`：最近 30 天内，存在 `primary_match` 或至少 1 条 `reference_match` 的 routed tasks / 最近 30 天全部 routed tasks
- `effective_hit_rate`
  - 分子按任务数统计，不按 receipt 数统计
  - 同一 `task_id` 只要至少有一份 `reuse receipt` 中存在某次 attempt 同时满足 `execution_result = success`、`verification_result = passed` 且 `fallback_used = false`，即可计为一次有效命中
  - 同一任务存在多份 `reuse receipt` 时，不因多次成功重复计数
  - 分母与 `hit_rate` 完全一致：最近 30 天全部 routed tasks
- `primary_match_rate`：最近 30 天内，存在 `primary_match` 的 routed tasks / 最近 30 天全部 routed tasks
- `no_confident_match_rate`：最近 30 天内，返回 `no_confident_match` 的 routed tasks / 最近 30 天全部 routed tasks
- `successful_reuse_rate`：最近 30 天内，全部 `reuse receipt.attempts[]` 中满足 `execution_result = success`、`verification_result = passed` 且 `fallback_used = false` 的 attempt 次数 / 最近 30 天全部 reuse attempts；该口径必须与前文 `successful reuse`、`successful_reuse_count` 和 `effective_hit_rate` 的成功定义保持一致
- `failure_rate`：最近 30 天内，全部 `reuse receipt.attempts[]` 中满足 `execution_result = failed`、`execution_result = partial` 或 `verification_result = failed` 的 attempt 次数 / 最近 30 天全部 reuse attempts
- `domain_coverage[domain]`
  - 分母固定为 V1 冻结的 9 个一级 `domain`
  - 对单个 `domain`，必须同时给出：
    - `routeable_skill_count` = 当前未被 manifest 排除、且 `lifecycle_status != retired` 的全部 skills 数量
    - `reusable_skill_count` = 当前可作为 `primary_match` 的 skills 数量，即 `manual` 或 `learned_stable` 且 `lifecycle_status = stable` 且 `drift_status = trusted`
    - `recent30_effective_hit_task_count` = 最近 30 天内，以该 `domain` 记账且计入 `effective_hit_rate` 分子的任务数
  - `overview.md` 里的“一级领域覆盖度”固定指 `reusable_skill_count > 0` 的 domain 数 / 9；不得改成文件数占比、候选数占比或自由口径

上述统计只能从 `routing/*` 与 `reuse/*` 回执推导，不得从聊天文本或手工描述反推。

## 技能树模型与浏览视图

### 物化产物

技能树至少输出三类文件：

1. `tree/index.json`
   - 机器可读总索引
2. `tree/overview.md`
   - 人类可读总览
3. `tree/domains/<domain>.md`
   - 按领域浏览 `manual / stable / candidate / paused / expired / retired` 技能

### 必须展示的字段

每个树节点至少展示：

- `skill_id`
- `title`
- `domain/subdomain`
- `task_kinds`
- `artifact_types`
- `trust_tier`
- `lifecycle_status`
- `drift_status`
- `successful_reuse_count`
- `last_verified_at`
- `source_task_ids` 或 `source_doc_path`
- `parent_skill_id`

### 技能树统计

`tree/index.json` 和 `overview.md` 必须同时给出：

- 总技能数
- stable / candidate / paused / expired / retired 数量
- manual vs learned 数量
- 最近 30 天新增候选数
- 最近 30 天命中率
- 最近 30 天有效命中率
- 最近 30 天主命中率
- 最近 30 天 `no_confident_match` 比例
- 最近 30 天成功复用率
- 最近 30 天失败率
- 每个一级领域的覆盖度

其中 `manual` 统计只计算 `manual-skill-index.json` 中已登记且通过 `manual-skill-source-state.json` freshness 校验的可路由 manual Skill，不把所有 `agent-work` 文档都误算为 Skill。

这满足“成长效果可被衡量”和“技能树是结构化可浏览资产”两项验收。

## 治理与审批边界

### 不得绕过的门禁

learned Skill 可以记录哪些门禁在来源任务中通过过，但它自己不能取消门禁。V1 冻结以下原则：

- design 相关 Skill 不能绕过 `design approval`
- exec-plan 相关 Skill 不能在设计未批准时引导创建对应 exec-plan
- code 相关 Skill 不能绕过 typecheck、test 和任务特定验证
- review 相关 Skill 不能把“照旧复用”当作 review 结论

### required_gates

每条可路由 Skill 的 `required_gates` 都必须显式列出 typed gate requirement，而不是只写字符串名称。V1 允许的 `gate_kind` 只有：

- `approval`
- `preflight`
- `verification-command`
- `repo-policy`

对应证据语义冻结为：

- `gate_phase = routing-precondition`
  - 只用于“当前任务在进入默认复用前，是否具备继续尝试该 Skill 的前置条件”
  - 只能由当前权威文档状态、`project-facts` 和当前任务显式输入求值
  - 来源任务回执、历史成功记录或旧 `reuse receipt` 一律不能把它判成 `passed`
- `gate_phase = task-completion`
  - 只用于“当前任务执行结束后，是否满足写候选、计成功复用、允许晋升等完成态门禁”
  - 对新任务必须使用当前任务的 preflight / verification / execution 证据重新求值
  - 来源任务回执只允许在 promotion / drift-scan 中作为既有 Skill 的历史证据，不允许替代当前任务门禁

- `approval`
  - 只能按前述“文档状态权威契约”中的允许来源与判定顺序求值
  - 不能因为“正在讨论”或“以前通过过类似设计”而判为 `passed`
  - task-scope 自动绑定只允许按前文“任务类型 approval gates 的自动绑定契约”发生；不得在实现阶段自由扩大到其他任务类型
- `preflight`
  - 当 `gate_phase = routing-precondition` 时，证据必须是当前任务在进入默认复用/实现/测试路径前执行的 preflight 命令成功退出
  - 当 `gate_phase = task-completion` 时，证据必须是当前任务在输出正式 review / audit / completion 结论前执行的 preflight 命令成功退出
  - 两种情况下都必须带唯一的 `command_seq + evidence_ref` 绑定，并能回指到当前任务 `verification_commands` 与 `commands_executed`
  - 来源任务回执中的 preflight 记录只允许在 `promotion` 或 `drift-scan` 中作为历史审计证据，不能替代当前任务 preflight
- `verification-command`
  - 证据必须落在 `TaskExecutionReceipt.verification_commands` 或等价 reuse receipt 中，且保留具体命令与唯一 `command_seq / evidence_ref` 绑定
- `repo-policy`
  - 证据必须回指 `agentReadme.md` 或 `project-facts` 的具体约束条目，不能只写“符合仓库规范”

V1 默认相位约束：

- `approval`、`repo-policy` 默认属于 `routing-precondition`
- `verification-command` 默认属于 `task-completion`
- `preflight` 的相位不允许实现阶段自由选择；只能按前文“任务类型 preflight gates 的自动绑定契约”或显式 `project-fact` / Skill metadata 中冻结的映射取值
- V1 只允许 `code-implementation-preflight`、`testing-skill-preflight` 进入 `routing-precondition`；`code-review-preflight`、`design-review-preflight`、`exec-plan-review-preflight` 只能进入 `task-completion`

常见 gate_id 例如：

- `design-approved`
- `code-review-preflight`
- `design-review-preflight`
- `exec-plan-review-preflight`
- `code-implementation-preflight`
- `testing-skill-preflight`
- `pnpm typecheck`
- `pnpm test`

冻结判定规则：

- 每条 `required_gates` 都必须带 `evidence_ref_hint` 与 `freshness_rule`
- 每条 `required_gates` 都必须带 `gate_phase`
- 路由、任务执行、候选提炼、晋升、漂移复核都必须生成同结构的 `GateEvaluation`
- `routing` 只评估 `routing-precondition`；`task-execution` / `candidate-synthesis` 必须重新评估 `task-completion`
- 任何 `failed / not_applicable / missing_evidence / stale` 都算 gate 未满足，阻断候选 Skill 写入、`primary_match` 与 stable 晋升
- `task_routing_gates_evaluated`、`candidate_evaluations[*].routing_gate_evaluations`、`task_completion_gates_evaluated` 和 lifecycle receipt 中的 gate 证据，都必须能追溯到文档状态、命令结果或回执路径

### 与 manual Skill 的关系

- `manual` 是唯一的人工 Skill 信任层，覆盖现有人工 Skill、未来人工新增 Skill，以及对 learned Skill 的人工修订版。
- learned Skill 不得复用已有 manual Skill 的 `skill_id`。
- learned Skill 不得自动改写 `docs/specs/agent-work/*`。
- 当人工修订某条 learned Skill 时，结果必须以 `docs/specs/agent-work/*.md` + `manual-skill-index.json` 条目落地，并通过 `supersedes_learned_skill_ids` 指向被替换的 learned Skill。
- 被 manual Skill 显式接管的 learned Skill，必须写入 `replacement_skill_id` 并进入 `retired` 或 `paused`，同时落一份 `superseded/retired` 生命周期回执；不得继续以并列高置信候选参与主命中。

## 与主产品链路的兼容性

本设计对当前主产品仓库的兼容原则是：

- 不修改 `src/signal/*`、`src/filter/*`、`src/action/*` 的业务判定责任
- 只新增仓库内 Agent 工作层模块，例如未来的 `src/agentMemory/*`
- 只新增附加数据目录和审计文件，不重写现有 `data/raw`、`data/normalized`、`data/scores`、`data/reports`、`data/kb`
- learned Skill 系统故障时，仓库必须退回“只有根规则 + project facts + manual Skill + 基础工作流”的旧模式

因此该能力是增量增强，不是对主产品链路的结构性侵入。

## 失败模式

| 失败模式 | 处理方式 |
| --- | --- |
| `manifests/latest.json` 缺失或过期 | 先从 canonical stores 重建；重建失败则视为 `no_confident_match`，继续基础工作流 |
| `docs/specs/agent-work/manual-skill-index.json` 或 `manual-skill-source-state.json` 缺失、损坏、结构无效，或与源文档不同步 | 视为 manual registry unavailable；manifest 标记为 stale；当前任务 fail closed 为 `no_confident_match`；只允许基础工作流，禁止 candidate / promotion 写入 |
| `facts/index.json`、`facts/source-state.json` 缺失、损坏或与上游源文档不一致 | 先重建 facts 层；重建失败则视为无法完成约束绑定，路由保守失败为 `no_confident_match`，并把受影响 Skill 置为 `pending_recheck` |
| `manifests/latest.json.input_snapshots` 与当前 routeable manual source docs、facts、或 learned Skill `.json/.md` 集合/哈希不一致 | 视为 manifest stale；先 full rebuild；重建失败则当前任务保守失败为 `no_confident_match` |
| `approval` gate 所依赖的文档状态来源缺失，或 `agentReadme.md` 与文档显式状态冲突 | `GateEvaluation.state = stale`；detail 写明 `authority_conflict` 或 `missing_evidence`；阻断对应主命中 / 候选写入 / 晋升 |
| learned Skill `.json/.md` 配对不完整或 domain 不一致 | 该 Skill 从 manifest 中排除，并写入 `drift/*` reconcile 记录 |
| `subdomain` 不在对应 `domain` allow-list 内，或既有 Skill 试图原地改写 `subdomain` | 视为 metadata invalid；该 Skill 从 manifest 与 `tree/*` 排除，并写入 `drift/*` reconcile 记录 |
| `parent_skill_id` 缺失目标、跨 `domain/subdomain`、manual Skill 带 parent，或 parent 链形成环 | 视为 topology invalid；该 Skill 从 manifest 与 `tree/*` 排除，并写入 `drift/*` reconcile 记录 |
| 新候选与既有 manual Skill 发生 `manual-authority-conflict` | 阻断 candidate 写入；`TaskExecutionReceipt.rejected_learning_reasons` 写入 `manual-authority-conflict:<skill-id>`；若是既有 learned stable 与 manual 冲突，则 learned stable 进入 `paused + degraded` |
| 新候选与既有 learned Skill 发生 `exact-scope-contract-conflict`，但当前任务没有 `empirical-replacement-conflict` 证据 | 阻断 candidate 写入；`TaskExecutionReceipt.rejected_learning_reasons` 写入 `exact-scope-conflict-unresolved:<skill-id>` |
| 候选提炼信息不完整，或候选提炼阶段 `required_gates` 未全部通过 | 只保留 `task receipt` 和 `session archive`，不生成候选 Skill |
| 任务执行成功，但 `domain` 或 `task_kind` 在当前任务证据下仍无法唯一解析 | 允许保留成功 `task receipt` 与 `session archive`，但阻断 learned candidate 写入与 stable promotion 证据计入 |
| routeable Skill 的 `watch_paths` 归一化后为空 | learned candidate 阻断写入；既有 Skill 进入 `pending_recheck`，不得参与主命中，直到 metadata 修复并重建 manifest |
| 挂接脚本路径失效 | Skill 失去主命中资格，并进入 `pending_recheck` |
| Skill 执行超时 | `reuse receipt.failure_kind = timeout`；立即回退；阻断 successful reuse / candidate creation；必要时触发 `pending_recheck` |
| Skill 因外部依赖失败或只完成部分产物 | 写入 `external-failure` 或 `partial`；阻断 candidate / promotion；仅在证据表明是 Skill 声明依赖漂移或连续重复时触发降级 |
| stable Skill 复用失败 | 立即回退、记录失败、重新提炼修正路径 |
| 漂移扫描失败 | 设为 `degraded`，必要时 `paused` |
| `paused` / `expired` Skill 只有扫描成功但没有 fresh 成功复用或显式人工确认 | 保持原 `lifecycle_status`，`drift_status` 最多回到 `pending_recheck`，不得恢复 `primary_match` |
| 生命周期变更只更新 metadata，未留下原因与证据 | 视为审计失败；该次晋升/降级/退役无效，必须补写 `lifecycle/*` 回执后才能生效 |
| 技能树物化失败 | 不阻断任务完成，但必须留下 stale derived view 记录 |

## 可测试性与验证矩阵

| 验收目标 | 需要验证的设计行为 | 建议验证方式 |
| --- | --- | --- |
| 首次任务后可生成候选 Skill | `TaskExecutionReceipt -> learned candidate` 判定正确 | 单元测试 + fixture 集成测试 |
| 候选提炼不依赖实现猜测 | `reusable_summary` section 映射、`learning_blockers` 阻断、多 attempt `source_mode` 取舍、正文只能来自当前任务证据 | 单元测试 + fixture 集成测试 |
| 相似任务前可保守命中 Skill | `TaskFingerprint + project facts -> routing receipt` 正确输出主命中/辅助参考/未命中 | 单元测试 + snapshot 测试 |
| manual Skill 可被机器路由但不误把所有文档当作 Skill | `manual-skill-index.json` + `manual-skill-source-state.json` 共同控制 manual routeability 与统计口径 | 单元测试 + 结构测试 |
| manual registry 异常时 fail closed | `manual-skill-index.json`、`manual-skill-source-state.json` 或任一 routeable manual source doc 缺失/损坏/失同步时，路由退回 `no_confident_match`，且阻断 candidate / promotion | 单元测试 + 集成测试 |
| canonical 状态与派生索引可重建 | learned json/md 写入、manual source doc freshness 校验、manifest 重建、tree 重建、stale 处理正确 | 集成测试 |
| manifest freshness 可机器判定 | `input_snapshots` 覆盖 manual registry 文件、routeable manual source docs、facts、learned 输入，且 manual source docs / learned `.json/.md` 新增、删失、哈希变化都会使 manifest stale | 单元测试 + 集成测试 |
| repo-wide completion gates 可机器绑定 | `agentReadme.md` completion-gate facts 提取、`pnpm lint/typecheck/test` 自动绑定、entrypoint verification 唯一解析与 `task-specific-verification` fail-closed 行为正确 | 单元测试 + 结构测试 + 集成测试 |
| canonical ID 稳定可追溯 | `task_id / skill_id / event_id` 生成、并发冲突消解、超限宽度扩展、同任务重试复用与 supersede 链接一致 | 单元测试 + fixture 集成测试 |
| `subdomain` 与树拓扑受控且可重建 | `subdomain` allow-list、`general` fallback、`parent_skill_id` 单父约束、cycle check、tree 排序与排除逻辑正确 | 单元测试 + 集成测试 |
| `parent_skill_id / replacement` 分配不依赖实现猜测 | `lineage_anchor` 只来自当前任务 `reuse receipt`，`exact_scope_anchors / broader_scope_anchors` 分流、root fallback 与 replacement track 行为正确 | 单元测试 + fixture 集成测试 |
| exact-scope conflict 治理可审计 | `manual-authority-conflict`、`exact-scope-contract-conflict`、`empirical-replacement-conflict` 的阻断、replacement 与 pause 行为正确 | 单元测试 + 集成测试 |
| `project-facts` builder 可重建且遇冲突 fail closed | allow-list 输入、内置提取器、显式 `project-fact` blocks、full rebuild、authority conflict、source-state 快照行为正确 | 单元测试 + 集成测试 |
| `approval` gate 不依赖实现猜测 | requirement/design 文档只接受冻结的权威来源，且 `design-approved` 只按冻结的 task-type auto-binding 进入对应任务；code-implementation 不得从 design-approval rule 反向发明新的 approval gate | 单元测试 + 结构测试 |
| gate 相位不混淆 | `routing-precondition` 只阻断主命中，`task-completion` 只在当前任务完成后判定候选/复用成功 | 单元测试 + 集成测试 |
| `no_confident_match` 任务可落账但不会被误学习 | 任务可在 `domain/task_kind = null` 下成功结束，但只能保留 `task receipt` / `session archive`，不得生成 candidate | 单元测试 + 集成测试 |
| Skill 复用失败可降级纠偏 | `reuse receipt.attempts[]`、降级、回退、再提炼闭环成立，且连续失败按 attempt 粒度可重建 | 集成测试 |
| execution timeout / external failure / partial result 有统一回写 | `TaskExecutionReceipt`、`SkillReuseReceipt.attempts[]`、gate 状态与候选阻断逻辑一致 | 单元测试 + 集成测试 |
| `watch_paths` 触发源确定且可审计 | facts/manual/learned 三层 `watch_paths` 的生成、归一化、目录前缀匹配与自生成产物排除逻辑正确 | 单元测试 + 集成测试 |
| drift `affected_skill_ids` 传播规则可重建 | `global-root` / `manual-source` / `fact-source` / `skill-self` / `script-runtime` / `failure-sequence` 六类事件的受影响 Skill 集合解析正确，且 unresolved 时 fail closed | 单元测试 + 集成测试 |
| 生命周期审计可追溯 | `lifecycle/*` 能解释 candidate 创建、晋升、冲突、替换、降级、退役原因 | 单元测试 + 集成测试 |
| `paused/expired` Skill 恢复闭环完整 | 只有 fresh 成功复用或显式人工确认才能触发 `revalidated` 并恢复 `stable`；单次扫描成功不足以恢复主命中 | 单元测试 + 集成测试 |
| `last_verified_at` 与过期口径一致 | candidate 创建、成功复用、stable recheck、revalidated 恢复都会按冻结来源推进 `last_verified_at`，失败/partial/仅扫描不推进，45 天过期只看该字段 | 单元测试 + 集成测试 |
| 技能树可浏览 | `tree/index.json`、`overview.md`、domain pages 输出完整 | snapshot 测试 |
| 不破坏治理边界 | `required_gates` typed contract、manual/learned 分层、设计未批准不生成 exec-plan 引导 | 结构测试 + 集成测试 |
| 成长效果可衡量 | 命中率、有效命中率分母、复用率、失效率、最近验证时间与 9 个一级 domain 覆盖度正确更新 | 单元测试 |
| 高频 stable Skill 可复核 | 定期与事件触发扫描均能改变 `drift_status`，且 `project-facts` 源文档变化会触发相关 Skill 复核 | 单元测试 + 集成测试 |

仓库级验证门槛不变：

- `npm run design-review:preflight`
- `pnpm typecheck`
- `pnpm test`

后续实现若新增 `src/agentMemory/*`，必须补齐对应结构测试和行为测试，且不能用 learned Skill 自证 learned Skill。

## 开放问题

当前无阻塞性开放问题。

设计阶段已冻结的关键口径：

1. `manual` 是唯一的人工 Skill 信任层，不再拆出第二种人工子层。
2. `project-facts` 是只读约束层，参与路由与漂移判断，但不直接占用主命中位。
3. learned Skill 采用单一 canonical store；`manifests/*` 与 `tree/*` 只是派生视图。
4. `domain`、`task_kind`、`artifact_types` 是三组独立路由维度，不能重复表达；`subdomain` 只能来自 `domain` 作用域 allow-list，且默认保守落到 `general`。
5. 技能树是按 `domain` 分组的 rooted forest：每条 Skill 至多一个父节点，manual Skill 永远是根节点，环路与跨域挂接一律无效。
6. `watch_paths` 必须按 facts/manual/learned 三层的确定性规则生成；不允许实现阶段自由猜测。
7. `paused` / `expired` Skill 只能通过 fresh 成功复用或显式人工确认恢复，单次扫描成功不足以恢复主命中。
8. 多 Skill 竞争时必须优先保守失败，而不是强行给出“看起来像对的”命中。

## 设计结论

这份修订后的设计补齐了此前阻塞进入 ExecPlan 设计的四个关键缺口：

- 定义了统一的 manual Skill registry 与人工修订 learned Skill 的收敛路径
- 补上了 `project-facts` 层，恢复需求要求的“项目稳定事实”分层
- 把 learned Skill 收敛到单一 canonical store，并冻结 manifest/tree 的派生与重建规则
- 把任务路由改写为 `domain / task_kind / artifact / goal / constraint / path` 联合匹配，消除了重复语义

本轮再补齐十六条阻塞性契约：

- 为每个候选 Skill 增加候选级 `SkillRoutingEvaluation`，冻结 task-scope gate 与 `Skill.required_gates` 的合并、去重、冲突拒绝和路由证据归属
- 把 `reuse receipt` 从 terminal summary 改成带 `attempts[]` 的 canonical per-attempt ledger，使连续失败治理与复用统计都能按 attempt 粒度审计
- 为 manual registry 增加 `manual-skill-source-state.json`、`source_doc_sha256` 和 full-validation freshness contract，消除“失同步”判定依赖实现猜测
- 冻结 `project-facts` 的 fact-export unit、内置提取器与显式 `project-fact` block 契约，阻断实现阶段自由抽取
- 把 routeable manual source docs 纳入 manifest freshness 与任务开始前 preflight，消除“registry 文件没变但源文档已漂移”的漏检
- 冻结 `subdomain` 的 domain-scoped allow-list 与 `general` fallback，阻断自由字符串扩散
- 把技能树拓扑收敛为 rooted forest，补齐单父约束、root 规则、排序和 cycle check
- 为 `watch_paths` 增加 facts/manual/learned 三层的确定性生成契约，冻结漂移触发来源
- 为 `TaskCommandRecord`、`writes_repo_files`、`touches_outside_repo` 与 `files_touched` 补上确定性归类契约，阻断实现阶段自由判定“哪些步骤算可学习路径”
- 补齐 `paused` / `expired` Skill 的显式恢复规则，确保生命周期既能降级也能恢复且无需实现猜测
- 补齐 `effective_hit_rate` 分母与一级领域覆盖度公式，确保成长指标 machine-checkable
- 为任务级 `skill_usage` 与 `archives/*` 增加最小审计结构，确保“本次用了哪些旧 Skill、哪些地方重新探索了”有固定出口
- 为 `candidate-synthesis` 增加结构化 `reusable_summary + learning_blockers` 契约，冻结候选正文字段映射、多 attempt 取舍与拒绝条件来源
- 把 `agentReadme.md` 的 repo-wide completion gates 纳入 `project-facts` allow-list，冻结 `pnpm lint / typecheck / test` 与任务特定 dry-run 验证的机器可读来源和绑定规则
- 把 `agentReadme.md` 的固定 conda 环境入口与 design approval rule 机器化为可导出的 `repo-policy` facts，冻结相关 verification 命令的运行上下文证据要求，以及 `design-approved` 的 task-type auto-binding 与 fail-closed 语义
- 为漂移扫描补齐 `affected_skill_ids` 解析契约，冻结 root/manual/fact/script/failure 事件到受影响 Skill 集合的传播规则

因此在不触碰主产品裁决层的前提下，文档已经具备再次进入 design review 的完整契约。
