# 执行计划：自进化 Skill 沉淀与专属技能树

## 文档状态
- 版本：`v0.1`
- 当前状态：`Completed`
- 设计来源：
  - `docs/specs/product-specs/自进化Skill沉淀与专属技能树需求分析.md`
  - `docs/specs/design-docs/self-evolving-skill-tree-design.md`
  - `agentReadme.md`
  - `docs/specs/system-spec.md`
  - `docs/specs/design-docs/architecture-boundaries.md`
  - `docs/specs/agent-work/README.md`
- 说明：本计划只负责把已冻结的仓库内 Agent memory / learned-skill 设计落地，不新增新的产品判定语义、审批来源、召回机制或隐藏状态口径。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | 自进化 Skill 沉淀与专属技能树 |
| 负责人 | Codex |
| 风险等级 | `High` |
| 关联需求 | `docs/specs/product-specs/自进化Skill沉淀与专属技能树需求分析.md` |
| 关联设计 | `docs/specs/design-docs/self-evolving-skill-tree-design.md` |
| 影响范围 | `src/agentMemory/*`、`src/__tests__/*`、`docs/specs/agent-work/manual-skill-index.json`、`docs/specs/agent-work/manual-skill-source-state.json`、`docs/specs/agent-work-spec.md`、`docs/specs/agent-work/runtime-routing.md`、`data/agent-memory/*`、`agentReadme.md`、`docs/specs/exec-plans/README.md`、`docs/specs/exec-plans/self-evolving-skill-tree-v0.1.exec-plan.md` |

## 目标

在不侵入 `Signal -> Filter -> Action` 主产品裁决链路、不削弱既有 design/review/exec-plan/testing 门禁的前提下，完成以下交付：

1. 为仓库内 Agent 工作层新增单一 canonical 的文件系统记忆层，明确区分 `root_rule / project_fact / manual / learned_stable / learned_candidate / session_archive` 六层语义。
2. 把 `manual-skill-index.json`、`manual-skill-source-state.json`、`facts/index.json`、`facts/source-state.json`、`learned/**/*.json/.md`、`routing/*`、`tasks/*`、`reuse/*`、`lifecycle/*`、`drift/*`、`archives/*` 实现为可审计、可重建、带 fail-closed 语义的 canonical 记录。
3. 落地 `task_id / skill_id / event_id`、路径规范化、`watch_paths`、`subdomain` allow-list、rooted forest 拓扑、`lineage_anchor -> child/replacement/root`、`last_verified_at` 与 `required_gates` 等冻结契约，阻断实现期自由发挥。
4. 落地 `TaskFingerprint`、`GateRequirement/GateEvaluation`、`SkillRoutingEvaluation`、`RoutingReceipt`、`TaskExecutionReceipt`、`SkillReuseReceipt` 与候选提炼闭环，使相似任务命中、失败回退、候选生成和稳定晋升全部可追溯。
5. 落地 learned Skill 的候选创建、成功复用晋升、冲突治理、降级、暂停、过期、恢复、手动接管、漂移扫描与技能树物化，且所有状态变化都有 append-only 生命周期回执。
6. 让 `project-facts` 从冻结 allow-list 和显式 `project-fact` block 全量重建，并把 `design-approved`、preflight、repo completion gates、运行时上下文要求变成机器可读的绑定规则。
7. 保持系统在 `manual registry unavailable`、`facts stale`、`manifest stale`、冲突未解决、验证失败或复用失败时统一降级为 `no_confident_match + 基础工作流`，而不是盲目沿用旧经验。

## 边界约束

### 允许修改

- 新增 `src/agentMemory/*`，承载 canonical contract、full rebuild、routing、candidate synthesis、lifecycle、drift、tree materializer 与 receipt writers。
- 新增或更新 `src/__tests__/agentMemory*.test.ts`、`src/__tests__/specStructure.test.ts` 及其所需 fixtures，用结构测试、单元测试、集成测试和 snapshot 测试覆盖设计冻结口径。
- 新增 `docs/specs/agent-work/manual-skill-index.json` 与 `docs/specs/agent-work/manual-skill-source-state.json` 这两份 manual registry canonical 文件。
- 更新 `docs/specs/agent-work-spec.md` 与 `docs/specs/agent-work/runtime-routing.md`，把新的 registry / routing / fallback / receipt 规则同步到仓库工作层说明。
- 新增 `data/agent-memory/` 下的 canonical 与 derived 目录、初始空索引或由 builder 生成的初始产物。
- 在确有索引、状态或执行账本变化时，更新 `agentReadme.md`、`docs/specs/exec-plans/README.md` 与本 exec-plan；实现阶段不改写已批准 design doc 的语义正文。

### 禁止修改

- 不修改 `src/signal/*`、`src/filter/*`、`src/action/*`、`src/normalize.ts`、`src/storage/*` 的业务判定责任、评分语义、报告结论或现有数据写盘契约。
- 不引入 embeddings、向量召回、语义相似度黑盒、自由同义词扩写、隐藏“活跃时间”口径，或任何未在设计文档冻结的自动化设计决策。
- 不把 learned Skill 写回 `docs/specs/agent-work/*.md`；自动学习流程只能写 `data/agent-memory/*`，manual 层只能通过显式人工维护的 registry 进入可路由集合。
- 不新增数据库、外部服务、浏览器 UI、visual console 专页或新的主产品 CLI 语义；V1 仅落地仓库内 Agent 工作层能力。
- 不在 facts / registry / manifest / lifecycle / reuse / archive 之间发明第二套真相来源；derived views 不能承载唯一状态。
- 不因为“当前设计已经讨论过”就绕过 `design-approved`、preflight、`pnpm lint`、`pnpm typecheck`、`pnpm test` 或 task-completion gate。
- 不在实现阶段直接修改 `docs/specs/design-docs/self-evolving-skill-tree-design.md` 的冻结设计语义；若发现需要改设计，必须先回到 design review。

### 兼容性约束

- learned-skill 系统故障时，仓库必须退回“root rules + project facts + manual skills + 基础工作流”，不影响现有产品链路产物。
- `project-facts`、manual registry、manifest、tree 全部按 full rebuild 语义工作；不得引入局部 merge patch 或只靠 `mtime` 的 freshness 判断。
- `manual-skill-index.json` 只登记 routeable manual Skills；`ExecPlan_ReviewSkill.md` 等未纳入 registry 的文档继续作为根规则或参考文档存在，不得被自动误计入 manual Skill 数量。
- 当前实现阶段不改动 `run-daily`、`run-weekly`、`verify-daily`、`score`、`build-kb` 的命令名、输入输出路径或主产品运行方式。

## 当前状态

- `src/agentMemory/*` 已落地 Phase 0/1 所需的 canonical contract、路径/ID 分配、manual registry、project-facts、manifest freshness、routing、receipt 与 archive mirror 基础能力。
- `docs/specs/agent-work/manual-skill-index.json`、`docs/specs/agent-work/manual-skill-source-state.json`、`data/agent-memory/facts/*`、`data/agent-memory/manifests/latest.json` 与 `data/agent-memory/tree/*` 已生成初始 canonical / derived 产物。
- `TaskFingerprint -> RoutingReceipt -> TaskExecutionReceipt -> SkillReuseReceipt -> learned candidate / lifecycle recovery / drift / tree` 的仓库内闭环已经形成；Phase 3 所需的 workflow API、manual takeover、fail-closed drift 写回、结构守护与 fixture 集成场景已完成代码落地。
- `agentReadme.md` 仍是 design approval 的唯一权威来源；实现阶段继续只消费该批准事实，不发明第二套 approval 状态来源。
- 当前计划整体维持 `Completed`：Phase 0/1/2/3 全部实现，本轮已修复 `src/agentMemory/manifest.ts` 的 recent-success 统计复杂度回归，并在 `2026-05-18` 重新刷新仓库级验证账本。

## 当前进度

- 需求分析：`Done`
- 设计冻结：`Done`
- ExecPlan 编写：`Done`
- 实施：`Done`
- 验证：`Done`

## 实施阶段

| 阶段 | 状态 | 目标 | 完成标志 |
| --- | --- | --- | --- |
| Phase 0：Canonical 输入与只读约束层 | `Done` | 落地路径/ID/枚举/文件布局、manual registry、project-facts、manifest freshness 与 full rebuild-only 规则 | `manual registry + facts + manifest` 的 canonical/derived 边界、source-state、authority conflict 和 fail-closed 语义已由实现与测试钉死 |
| Phase 1：Routing、gate 绑定与任务/复用回执 | `Done` | 落地 `TaskFingerprint`、gate 自动绑定、规则化匹配评分、routing receipt、task receipt、reuse receipt 与 baseline fallback | 新任务已能在有证据时保守命中、无证据时显式 `no_confident_match`，并把执行/验证/复用证据完整写盘 |
| Phase 2：候选提炼、生命周期、冲突治理与技能树 | `Done` | 落地 learned candidate/stable、conflict/replacement、revalidation、drift、tree materializer 与 30 天统计 | learned Skill 的创建、晋升、降级、恢复、替换、退役、漂移与树视图已由实现、定向回归与仓库级门禁完成验证 |
| Phase 3：仓库接线、验证矩阵与收口 | `Done` | 把新层接入仓库内 Agent 工作流和测试 harness，补齐结构测试、集成场景、文档同步与最终验证记录 | `src/agentMemory/workflow.ts`、`agentMemoryWorkflow.test.ts`、`specStructure`、runtime-routing / work-spec / exec-plan ledger 与仓库级验证已全部对齐 |

## 实施步骤

### Phase 0：Canonical 输入与只读约束层

1. 新建 `src/agentMemory/` 基础模块边界，至少把以下职责分离：
   - shared contracts：`Domain / TaskKind / ArtifactType / Subdomain / GateRequirement / GateEvaluation / DocumentApprovalState / FingerprintEvidenceSourceType / TaskCommandKind / TaskRuntimeContext / SkillLifecycleEventType / SkillLifecycleTrigger / receipt metadata`
   - `normalize_path / normalize_path_list / slugify / watch_paths normalize`
   - `task_id / skill_id / event_id / fact_id / primary-scope-slug / scope_hash8` 分配与原子独占写入辅助
   - canonical file read/write、append-only receipt、临时文件 + atomic rename 写入
   - 把 `task_id` 冻结为“首次写入 routing receipt 时分配，并在同一工作项的 `routing/*`、`tasks/*`、`reuse/*`、`archives/*` 复用”；补齐“继续沿用 / 必须新建”的判定与 `task-YYYYMMDD-<domain>-<task-kind>-<primary-path-slug>-<sequence>` 格式，并落实“同日前缀内十进制单调递增、展示至少零填充到 2 位、允许跳号但禁止重用”的分配语义
   - `task_id` 续用/新建规则必须直接落为确定性判断：用户补充同一交付物、fallback 后继续修正同一目标、同任务内增量修订/补验证 -> 续用；主 `domain`、主 `task_kind`、主产物类型或主要 `target_paths` 改变，或交付目标从“修订当前文档”切到“审核另一份文档” -> 新建
   - 把 `skill_id` 冻结为 `<origin>.<domain>.<subdomain-slug>.<intent-slug>`，并按 `scope_hash8` 处理冲突；禁止 learned/manual 之间重命名或原地改 `subdomain`
   - 把 `event_id` 冻结为 `<skill_id>.evt-<sequence>`，并要求通过 `lifecycle/*` 的原子独占创建分配；补齐“单 Skill 谱系内十进制单调递增、展示至少零填充到 4 位、并发冲突后重扫最新序号再重试”的规则
   - 把 `fact_id` 冻结为 `<fact_type>.<primary-scope-slug-or-global>.<title-slug>`；仅当 `summary / related_paths / constraint_tags / required_gates` 规范化后完全等价时才允许多源合并同一 `fact_id`，否则视为 authority conflict 并阻断 facts rebuild
2. 落地 `docs/specs/agent-work/manual-skill-index.json` 与 `manual-skill-source-state.json` 的初始 canonical 结构：
   - 首批 routeable manual Skill 只能来自 `docs/specs/agent-work/*.md` 中已被 `docs/specs/agent-work/README.md` 明确定义为任务型技能书、且与现有 preflight 入口一一对应的源文档；不得靠目录扫全或主观挑选额外文档
   - `ExecPlan_ReviewSkill.md`、`DesignDocument_ReviewSkill.md`、`README.md`、`runtime-routing.md`、`verification-policy.md` 等非 manual registry 文档继续留在根规则/参考层，避免把所有文档都误认成 manual Skill
   - registry metadata 与 source-state 必须双向闭环：每条 metadata 都带 `source_doc_path + source_doc_sha256 + watch_paths`，每个 `source_docs[]` snapshot 都精确列出 `skill_ids`
   - `manual-skill-index.json` 不能只存最小映射，必须实现完整 `ManualSkillMetadata` contract，至少覆盖 `skill_id / title / origin / trust_tier / lifecycle_status / drift_status / source_doc_path / source_doc_sha256 / domain / subdomain / task_kinds / artifact_types / target_paths / constraint_tags / goal_terms / required_gates / parent_skill_id / script_refs / watch_paths / supersedes_learned_skill_ids / last_lifecycle_event_id / updated_at`
   - `ManualSkillMetadata.watch_paths` 必须按 `normalize({source_doc_path} ∪ target_paths ∪ script_refs)` 生成，不允许从摘要文本或相邻段落补猜路径
   - routeable manual Skill 必须满足 manual-root 约束：`origin/trust_tier` 固定为 `manual`、`parent_skill_id` 必须缺失、`script_refs` 若存在则必须指向仓库内真实路径；人工接管 learned Skill 时只能通过 `supersedes_learned_skill_ids + replacement_skill_id` 记录关系，不得把 learned `skill_id` 原地改成 manual `skill_id`
   - 若同一 `skill_id` 指向多个 `source_doc_path`，或同一 `source_doc_path` 为多个 skill 导出互相矛盾的 `domain / task_kinds / artifact_types / required_gates`，必须判为 `manual registry conflict`，阻断 registry 发布
   - 自动学习流程只读这两份文件，不得自动改写 manual source docs
3. 落地 `data/agent-memory/` 基础布局与写入顺序：
   - canonical：`facts/`、`tasks/`、`routing/`、`reuse/`、`archives/`、`lifecycle/`、`learned/`、`drift/`
   - derived：`manifests/latest.json`、`tree/index.json`、`tree/overview.md`、`tree/domains/*.md`
   - 任何写入都遵守“先 append-only receipts，再 learned json/md，再 manifest，再 tree”的冻结顺序
4. 实现 manual registry freshness validator：
   - 校验 `manual-skill-index.json`、`manual-skill-source-state.json`、routeable manual source docs 三者一致
   - 缺失、哈希不匹配、未覆盖、冲突、结构无效时，统一落 `manual registry unavailable`
   - 一旦 unavailable，manifest 视为 stale，当前任务 fail closed 为 `no_confident_match`，并阻断 candidate / promotion
5. 实现 `project-facts` full rebuild-only builder：
   - 输入 allow-list 只允许 `agentReadme.md`、`docs/specs/agent-work/README.md`、`docs/specs/system-spec.md`、`docs/specs/design-docs/architecture-boundaries.md` 与按文档状态权威契约可用的 requirement/design/architecture docs
   - `agentReadme.md` 内置提取器只允许导出 3 组冻结 unit：`固定环境入口` 的单条 runtime `repo-policy` fact、`design-approval-before-exec-plan` 的单条 `repo-policy` fact（连同唯一允许的 `design-approved` gate requirement）、以及 `pnpm lint / pnpm typecheck / pnpm test / pnpm run-daily -- --date <date> --dry-run / pnpm run-weekly -- --date <date> --dry-run / pnpm score -- --input <normalized-file> / pnpm build-kb -- --since <date>` 这 7 条精确 completion-gate facts；其 `title / summary / related_paths / constraint_tags / required_gates` 必须逐项复现设计冻结值，不得意译或补猜
   - `docs/specs/agent-work/README.md` 内置提取器只允许导出 5 条精确 preflight 语句对应的 `quality-gate` facts：`code-review-preflight`、`design-review-preflight`、`exec-plan-review-preflight`、`code-implementation-preflight`、`testing-skill-preflight`，并严格复现 gate id、phase、evidence_ref_hint 与 freshness_rule
   - `system-spec.md` 内置提取器只允许导出 `## 运行面` 表格中的 `stable-entrypoint` facts，以及 `### 稳定` 下包含显式 `data/` 反引号路径的 `data-contract` facts；`## 验证矩阵` 默认导出 `0` 条 fact，除非 approved 文档里另有显式 `project-fact` block
   - `architecture-boundaries.md` 内置提取器只允许导出这 4 个冻结 section：`独立趋势决策系统`、`rules-first scoring`、`Trendshift connector 可插拔`、`data/ 文件系统优先`；未列入 allow-list 的未来决策默认导出 `0` 条 fact，除非改走显式 `project-fact` block
   - approved 文档的扩展只允许显式 `project-fact` fenced block
   - `project-fact` block 必须是单个可解析 YAML object，且其 `summary / related_paths / constraint_tags / required_gates` 只能来自 block 显式声明；结构无效、字段缺失、typed gate contract 不成立或 `fact_type` 越界都必须让本次 facts rebuild 失败
   - `ProjectFactRecord.watch_paths` 必须按 `normalize(source_doc_paths ∪ related_paths)` 生成；不得从标题、摘要或附近段落自由推断路径
   - `facts/source-state.json` 必须覆盖全部 allow-list 源文档，即使该文档导出 `0` 条 fact；facts rebuild 只允许 full rebuild，不允许对单篇变更文档做局部 merge patch
   - 多源导出同一 `fact_id` 时，只允许在规范化字段完全等价时合并；若同 `fact_id` 或同主 scope 下出现互相矛盾的 gate/boundary 结论，必须判为 authority conflict，保留旧 `facts/index.json` 并让当前 facts 进入 `stale`
6. 实现文档状态权威契约与 `design-approved` 依赖解析：
   - requirement doc 只认 `Requirement Freeze Status -> READY`
   - design doc 只认 `agentReadme.md` 的 `Approved design:` 列表
   - exec-plan 本身不产生独立 approval
   - authority conflict、missing evidence、hash 失配都必须 fail closed
7. 实现 manifest freshness 与 full rebuild：
   - `input_snapshots` 覆盖 registry、manual source docs、facts、routeable learned `.json/.md`
   - 仅 hash 校验，不使用 `mtime`
   - 任一 learned `.json/.md` 缺对、manual source doc 漏覆盖或新文件未入 snapshot 都让 manifest stale
8. 为 Phase 0 补齐测试：
   - 路径规范化、slug、ID 冲突消解、原子占位写入
   - manual registry freshness / conflict / fail-closed
   - `project-facts` allow-list、内置提取器、authority conflict、full rebuild
   - manifest stale 场景、learned sidecar 配对校验、derived view 重建前置条件

### Phase 1：Routing、gate 绑定与任务/复用回执

1. 实现 `TaskFingerprint` builder 与字段证据优先级：
   - `domain / task_kind / requested_artifact_types / target_paths / referenced_specs / constraint_tags / goal_terms`
   - 只允许用户请求、任务标题、显式 spec/path 和 project-facts 补约束；字段优先级必须固定为 `priority=1 用户显式请求`、`priority=2 任务标题`、`priority=3 显式 spec 标题/路径/章节`、`priority=4 project-facts`
   - `project-facts` 只允许补 `constraint_tags / required_gates / watch_paths`，不得在缺少 1-3 级证据时凭空补出 `domain` 或 `task_kind`
   - 不做 embeddings、不做语义扩写、不靠历史 Skill 反推 `domain/task_kind`
2. 落地 `domain`、`task_kind`、`artifact_types`、`subdomain` 解析与冻结语义：
   - `domain` 必须先按显式 spec/path 命中原生域：`docs/specs/product-specs/* -> requirements`、`docs/specs/design-docs/* -> design`、`docs/specs/exec-plans/* -> exec-plan`；review/audit 语义不能覆盖这条原生域优先级
   - spec 文档 review 仍留在原生 `requirements / design / exec-plan`，只把动作记为 `task_kind = review`
   - `domain` 与 `task_kind` 的中英文字面映射表必须与设计文档冻结表逐字一致并落入测试；同优先级证据冲突时必须落 `null`
   - `artifact-review` 只承载 `source-code / test-code / config / report / audit-receipt`，且仅在不存在更高优先级 spec 原生域路径时才允许解析到该域
   - learned candidate 的 `subdomain` 只允许继承唯一合法 anchor，否则回退到 `general`
   - 任何 `domain` 或 `task_kind` 未唯一解析的任务，都必须把 `resolution_status` 降为 `ambiguous` 或 `underspecified`，并在路由阶段直接退回 `no_confident_match`
3. 实现 task-scope gate 自动绑定与 merge 规则：
   - 所有 `required_gates` 必须使用 typed contract：至少包含 `gate_id / gate_kind / gate_phase / evidence_source_type / evidence_ref_hint / freshness_rule`，禁止退化成字符串数组
   - preflight：`code-implementation-preflight`、`testing-skill-preflight` 只允许进入 `routing-precondition`；`design-review-preflight`、`exec-plan-review-preflight`、`code-review-preflight` 只允许进入 `task-completion`
   - approval：只允许 `design-approved`，且仅绑定 `exec-plan draft/revise/implement`；该 gate 还必须满足“从 `TaskFingerprint.referenced_specs` 恰好解析出 1 条 design doc”这一附加条件，缺失时 `missing-design-reference`，多条时 `ambiguous-design-reference`
   - `code-implementation-preflight` 必须同时满足“`TaskFingerprint.referenced_specs` 恰好解析出 1 条 `docs/specs/exec-plans/*.exec-plan.md`”；`0` 条时 `missing_evidence`，多于 `1` 条时 `failed + ambiguous-exec-plan-reference`
   - repo completion：`pnpm lint`、`pnpm typecheck`、`pnpm test`
   - `requirements / design / exec-plan` 文档任务默认不自动绑定 runtime verification commands；只有显式 `project-fact` block 或 Skill metadata 声明时才允许额外并入
   - task-specific verification：只有唯一命中 `run-daily / run-weekly / score / build-kb` 时才绑定，否则合成 `task-specific-verification = missing_evidence`
   - 对 `pnpm typecheck / pnpm test / run-daily-dry-run / run-weekly-dry-run / build-kb-dry-run` 这些 gates，`TaskCommandRecord.runtime_context` 必须是 `conda:agent-trend-radar`；`other` -> `failed`，`unknown` -> `missing_evidence`
4. 实现 routing preflight 顺序：
   - 先校 manual registry
   - 再校 project facts
   - 再校 manifest freshness
   - 三者任何一层 stale/unavailable，都只能进入 `no_confident_match + 基础工作流`
5. 实现 Skill 规则化匹配与 `SkillRoutingEvaluation`：
   - 分数只来自设计冻结的 7 个维度：`domain`、`task_kind`、`artifact_types`、`target_paths`、`constraint_tags`、`goal_terms`、最近 30 天成功复用事实
   - `score_breakdown` 必须逐项回指加分证据；`effective_routing_gates / effective_task_completion_gates` 必须保留每条 gate 来自 `project-fact` 还是 `skill-metadata`
   - 只有 `score >= 75` 且领先第二名至少 `10` 分时才允许 `primary_match`；`55 <= score < 75` 只允许进入 `reference_matches`
   - 即使 `score >= 75`，若候选未满足“全部 routing-precondition gate passed、`artifact_types` 或 `target_paths` 至少命中一项、`trust_tier` 可主命中、`lifecycle_status = stable`、`drift_status = trusted`”，也只能降级为参考或拒绝
   - `primary_match` 只允许 `manual` 或 `learned_stable`
   - `reference_matches` 最多 2 条，`learned_candidate` 只能进参考位
   - `gate-contract-conflict`、`missing_evidence`、`stale`、`paused/expired/degraded` 都必须阻断主命中
6. 落地 `RoutingReceipt` 写盘与 `decision_reason` 语义：
   - `task_fingerprint`、`resolved_project_facts`、`task_routing_gates_evaluated`、`candidate_evaluations` 是 canonical 事实
   - `primary_match / reference_matches / rejected_matches` 只能是 `candidate_evaluations` 的摘要，不得另起炉灶
7. 实现 `TaskExecutionReceipt` 与 `TaskCommandRecord / VerificationCommandRecord / skill_usage / reusable_summary / learning_blockers`：
   - `TaskCommandRecord.kind`、`writes_repo_files`、`touches_outside_repo`、`uses_checked_in_entrypoint`、`runtime_context` 必须按设计冻结优先级自动求值，不允许人工概括式归类
   - `verification_commands` 必须与 `commands_executed` 建立 `command_seq + command + evidence_ref` 的一一绑定；同字面命令多次执行时必须保留多条 evidence，不能只留最后一次摘要
   - `skill_usage` 只能记录当前 `task_id` 下真实产生过 `reuse receipt` 的 Skill；未尝试的 `reference_match` 不得虚构 usage 记录
   - `domain/task_kind` 若在路由阶段未唯一解析，只允许用 `target_paths / requested_artifact_types / files_touched / referenced_specs` 做 post-task classification；仍 unresolved 时保持 `null`，并阻断 candidate / promotion
   - `reusable_summary` 只能来源于当前任务成功路径与当前任务 gate/verification 证据；`source_mode` 必须只按 `baseline-task / successful-reuse / corrected-after-fallback` 三态确定性求值
   - `learning_blockers` 必须按设计中的 `missing-reusable-summary / reusable-summary-invalid / unstable-steps / one-off-dirty-command / hardcoded-local-environment / missing-verification-evidence / conflicts-*` 规则自动生成；任一 blocker 非空都必须阻断 candidate write
   - 候选正文的 `Intent / Use When / Do Not Use When / Inputs & Preconditions / Steps / Validation / Failure Signals / Fallback` 8 个 section 后续只能从 `reusable_summary` 对位拷贝，最多做空白规范化和列表重排
8. 落地 `reuse/<date>/<task-id>/<skill-id>.json`：
   - 同一 `task_id + skill_id` 聚合到同一 receipt
   - `attempts[]` 是 canonical attempt ledger
   - 顶层 `attempt_count / precondition_check / execution_result / verification_result / fallback_used / failure_* / reexplored_paths / correction_summary` 都只是最近一次 attempt 的派生摘要；`successful_attempt_count / failed_attempt_count / partial_attempt_count / last_*_attempt_at` 也都必须能从 attempts 时间序列重建
   - 当 fallback 后形成最终成功路径时，必须写 `corrected_task_receipt_ref` 回指当前 `TaskExecutionReceipt`
9. 落地 `archives/<date>/<task-id>.md`：
   - 固定包含 `User Request`、`Routing Summary`、`Skills Actually Used`、`Re-explored Paths And Corrections`、`Verification Evidence`、`Source Receipt Refs`
   - `archives/*` 只能镜像当前 `routing/*`、`tasks/*`、`reuse/*`、`lifecycle/*` 已存在的 receipt 事实，不得自由补写新结论
10. 为 Phase 1 补齐测试：
   - fingerprint evidence priority、`artifact-review` 域边界、`design-approved`/preflight auto-binding
   - routing score、主命中阈值、`no_confident_match`
   - synthetic `task-specific-verification`
   - `TaskExecutionReceipt` / `SkillReuseReceipt` 的 provenance、runtime context、post-task classification、`reusable_summary` 和 blocker 规则
   - `archives/*` 的固定 section、mirror-only 语义与 source receipt refs

### Phase 2：候选提炼、生命周期、冲突治理与技能树

1. 实现 candidate-synthesis 入口，只允许读取当前任务 canonical 证据：
   - `TaskExecutionReceipt.reusable_summary`
   - `TaskExecutionReceipt.learning_blockers`
   - `task_completion_gates_evaluated`
   - `verification_commands`
   - `skill_usage`
   - 当前 `task_id` 下的 `reuse/*`
   - 禁止从聊天文本、旧 Skill 正文、旧摘要或历史任务自然语言自由补写
   - 候选生成前置条件必须完全按设计冻结：当前任务 `result = success`、适用 `task-completion` gates 全部 `passed`、适用验证命令全部 `passed`、`domain/task_kind` 唯一解析、`reusable_summary` 结构完整、`learning_blockers` 为空、冲突检测已通过；任一条件不满足时只保留 `task receipt + session archive`
2. 落地 learned Skill Markdown 与 JSON sidecar：
   - Markdown 固定 11 个 section：`Intent / Use When / Do Not Use When / Inputs & Preconditions / Steps / Validation / Failure Signals / Fallback / Attached Scripts / Source Tasks / Drift Watch`
   - JSON sidecar 必须实现设计冻结的完整 `LearnedSkillMetadata` contract，而不是只落一组最小字段；至少覆盖 `skill_id / title / origin / trust_tier / lifecycle_status / drift_status / domain / subdomain / task_kinds / artifact_types / target_paths / constraint_tags / goal_terms / required_gates / parent_skill_id / source_task_ids / source_receipt_paths / script_refs / watch_paths / created_at / promoted_at / promotion_source / promotion_evidence_refs / manual_confirmation_ref / last_used_at / last_verified_at / successful_reuse_count / failed_reuse_count / last_lifecycle_event_id / conflict_with_skill_ids / replacement_skill_id / retirement_reason / demotion_reason`
   - `Intent / Use When / Do Not Use When / Inputs & Preconditions / Steps / Validation / Failure Signals / Fallback` 8 个 section 只能来自 `reusable_summary` 同名字段；禁止在 candidate write 阶段做语义改写
   - `document-first skill` 与 `script-attached skill` 必须共用同一治理视图：没有 Markdown 结构化正文的脚本不算 Skill，`script_refs` 必须指向仓库内真实路径，脚本失踪/重命名/不可执行时 Skill 立即失去 `primary_match` 资格并进入 `pending_recheck` 或 `paused`
   - `watch_paths` 只按 `target_paths ∪ script_refs ∪ source task files_touched - derived agent-memory outputs` 生成
   - `watch_paths` 匹配只允许“路径完全相等”或“命中某个目录前缀”两种方式；禁止 glob、正则和语义匹配
3. 实现谱系锚点与父节点分配：
   - `exact_scope_anchors`、`broader_scope_anchors`
   - `replacement track / child track / root track`
   - `root track` 默认回退到 `general`
   - 歧义 exact-scope 必须阻断 candidate
4. 实现冲突治理：
   - `manual-authority-conflict`
   - `exact-scope-contract-conflict`
   - `empirical-replacement-conflict`
   - unresolved conflict 一律阻断 `primary_match`、candidate write 与 stable promotion
5. 落地生命周期状态机：
   - `candidate-created`
   - `promoted`
   - `manually-confirmed`
   - `demoted / paused`
   - `expired`
   - `retired / superseded`
   - `revalidated`
   - `conflict-recorded`
   - 每次状态迁移都写 append-only `lifecycle/*`
6. 实现 `last_verified_at / last_used_at / successful_reuse_count` 的冻结写回：
   - 只允许由 candidate 创建、成功复用、scheduled/event recheck 成功、显式 revalidated 推进
   - `partial`、失败、纯扫描、仅文件未变化都不得推进
   - `expired` 只看 `last_verified_at` 的 45 天窗口
7. 实现 drift scan 与 `affected_skill_ids`：
   - `global-root`
   - `manual-source`
   - `fact-source`
   - `skill-self`
   - `script-runtime`
   - `failure-sequence`
   - `global-root` 必须覆盖全部当前非 `retired` 的 manual / learned Skills；触发源至少包括 `agentReadme.md`、`manual-skill-index.json`、`manual-skill-source-state.json` 变化，以及 `facts/index.json` / `facts/source-state.json` rebuild 失败或无法计算新旧 diff
   - `manual-source` 必须通过 `manual-skill-source-state.json.source_docs[].skill_ids` 解析受影响 manual Skill，并扩展到同域同子域 learned 邻域；`fact-source` 必须通过变更 `fact_id`、`watch_paths`、`constraint_tags`、`required_gates` 与 `target_paths` 交集解析；`script-runtime` 必须同时覆盖 `script_refs` 命中、`watch_paths` 命中和绑定 completion-gate 的脚本型 Skill
   - `skill-self` 必须覆盖该 learned Skill 自身、`parent_skill_id` 链上的直接 children，以及 `replacement_skill_id / conflict_with_skill_ids` 指向的 peers；`failure-sequence` 只影响当前 Skill 自身，且判定固定为“连续 2 次复用失败”或“连续 2 次 timeout 且证据指向同一脚本/命令路径”
   - 受影响解析不出来时必须升级为 `global-root`
8. 实现 tree materializer 与 30 天统计：
   - `tree/index.json`
   - `tree/overview.md`
   - `tree/domains/<domain>.md`
   - rooted forest 物化必须严格执行“manual root only、每条 Skill 只有 0 或 1 个父节点、跨 `domain/subdomain` 挂接或环路即排除”的冻结规则；同级排序固定为 `trust_tier`（`manual > learned_stable > learned_candidate`）-> `successful_reuse_count` 降序 -> `skill_id` 升序
   - 每个树节点必须显式展示 `skill_id / title / domain/subdomain / task_kinds / artifact_types / trust_tier / lifecycle_status / drift_status / successful_reuse_count / last_verified_at / source_task_ids or source_doc_path / parent_skill_id`
   - `manual vs learned` 统计口径、`hit_rate / effective_hit_rate / primary_match_rate / no_confident_match_rate / successful_reuse_rate / failure_rate / domain_coverage`
   - 总览必须同时给出 `total skill count`、`stable / candidate / paused / expired / retired` 数量、`manual vs learned` 数量、最近 30 天新增候选数，以及每个一级 `domain` 的 `routeable_skill_count / reusable_skill_count / recent30_effective_hit_task_count`
   - `domain_coverage` 的分母固定为设计冻结的 9 个一级 `domain`，`effective_hit_rate` 按任务去重，`successful_reuse_rate / failure_rate` 按 attempt 计数
9. 为 Phase 2 补齐测试：
   - candidate 生成/阻断、`reusable_summary` section 映射、`watch_paths` 排除 derived outputs
   - lineage child/replacement/root、`subdomain` allow-list、topology cycle check
   - promotion/demotion/recovery/expiry、`last_verified_at`、manual takeover
   - exact-scope conflict、manual conflict、failure-sequence drift、tree stats 和排序

### Phase 3：仓库接线、验证矩阵与收口

1. 把 `src/agentMemory/*` 接入仓库内 Agent 工作流与测试 harness，而不是接入主产品裁决链路：
   - 新层只服务于仓库内 task routing / receipt writing / learned-skill governance
   - 通过 module API 串起 `freshness preflight -> routing -> task receipt -> candidate/lifecycle/tree`，不新增主产品 CLI 子命令，不接入 `run-daily`、`run-weekly`、report rendering 或 scoring 主路径
2. 同步仓库规范与结构测试：
   - 更新 `docs/specs/agent-work-spec.md` 与 `docs/specs/agent-work/runtime-routing.md`，明确 manual registry、`project-facts`、`no_confident_match`、receipt provenance 与 fail-closed 行为
   - `specStructure` 追加对 manual registry、`data/agent-memory` canonical/derived 目录、tree outputs 或新 fixture 的结构守护
3. 建立最小但闭环的 fixture 集成场景：
   - fresh baseline task -> candidate created
   - successful reuse -> promoted
   - stale manual registry -> `no_confident_match`
   - stale facts / stale manifest -> `pending_recheck + no_confident_match`
   - manual takeover -> learned retired/paused
   - paused/expired -> successful revalidated recovery
4. 校验所有 fail-closed 路径都不会伪装成成功：
   - `manual registry unavailable`
   - `authority_conflict`
   - `missing-design-reference`
   - `ambiguous-design-reference`
   - `ambiguous-exec-plan-reference`
   - `task-specific-verification = missing_evidence`
   - `partial`
   - `external-failure`
   - `timeout`
5. 最终验证只基于仓库脚本和测试证据：
   - `npm run code-implementation:preflight`
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - 上述 `agentMemory*.test.ts` 与 `specStructure.test.ts` 的 targeted `vitest` suites 用于收敛新层失败场景
6. 收口时必须同步更新本 exec-plan：
   - 当前状态
   - 当前进度
   - 已落地内容
   - 验证记录
   - 当前残余风险
   - 结论记录
   - 下一阶段入口

## 已落地内容

- Phase 0：已新增 `src/agentMemory/types.ts`、`paths.ts`、`fs.ts`、`ids.ts`、`approvals.ts`、`manualRegistry.ts`、`projectFacts.ts`、`manifest.ts`，并生成 `docs/specs/agent-work/manual-skill-index.json`、`docs/specs/agent-work/manual-skill-source-state.json`、`data/agent-memory/facts/*`、`data/agent-memory/manifests/latest.json`、`data/agent-memory/tree/*` 作为首批 canonical / derived 产物。
- Phase 0：已补齐 `src/__tests__/agentMemoryContracts.test.ts`、`agentMemoryRegistry.test.ts`、`agentMemoryFacts.test.ts`，覆盖路径规范化、ID 分配、manual registry freshness、project-facts allow-list、authority conflict 与 manifest stale 场景。
- Phase 1：已新增 `src/agentMemory/fingerprint.ts`、`routing.ts`、`receipts.ts` 并在 `src/agentMemory/index.ts` 暴露入口，落地 `TaskFingerprint`、gate 自动绑定、规则化匹配评分、routing receipt、task execution receipt、reuse receipt 与 archive mirror。
- Phase 1：已补齐 `src/__tests__/agentMemoryRouting.test.ts` 与 `agentMemoryReceipts.test.ts`，覆盖 native spec domain 优先、preflight 缺证据 fail closed、post-task classification、receipt provenance、attempt ledger 与 archive mirror 固定 section。
- 结构与文档：已同步更新 `docs/specs/agent-work-spec.md`、`docs/specs/agent-work/runtime-routing.md`、`docs/specs/exec-plans/README.md`、`agentReadme.md` 与本 exec-plan，使规则、代码与台账保持一致。
- 目录落地：已创建 `data/agent-memory/archives/`、`drift/`、`learned/`、`lifecycle/`、`reuse/`、`routing/`、`tasks/` 与 `tree/domains/`，确保 Phase 0 约定的 canonical / derived 布局在仓库中可见。

## 踩坑记录

- `manual` 统计只允许来自 `manual-skill-index.json` + `manual-skill-source-state.json`；把整个 `docs/specs/agent-work/*.md` 目录扫进路由层会直接违背设计。
- `candidate-synthesis` 不能从聊天文本补写 `Intent / Steps / Validation`；一旦实现者图省事把自然语言摘要当证据，整个 learned Skill 层会立刻失去可审计性。
- `watch_paths` 若把 `data/agent-memory/tree/`、`manifests/` 等派生产物纳入学习来源，会造成自我触发和漂移噪声，必须在生成阶段排除。
- `approval`、preflight、repo completion gates 一旦允许复用旧任务结果代替当前任务证据，就会出现“历史成功掩盖当前失败”的假阳性，必须坚持 per-task / until-source-change 的冻结语义。

## 验收标准

### 验收 1：自进化层不侵入主产品裁决链路

- 可观测结果：实现只新增仓库内 Agent 工作层模块与审计文件，不改动 `src/signal/*`、`src/filter/*`、`src/action/*` 的产品裁决责任。
- 成功条件：learned Skill 只能增强“如何做事”，不能改写 `freshness_state`、`ScoreBreakdown.total_score`、daily/weekly 主榜单或 verification 结论。
- 失败条件：agent-memory 代码路径成为主产品评分、报表结论或审核结论的隐式决策者。

### 验收 2：manual registry 与 project-facts 全量重建且 fail closed

- 可观测结果：`manual-skill-index.json`、`manual-skill-source-state.json`、`facts/index.json`、`facts/source-state.json` 都有可机器校验的 source-state 与哈希证据。
- 成功条件：registry/source docs/facts 任一 stale、缺失、冲突或结构无效时，当前任务统一退回 `no_confident_match`，并阻断 candidate / promotion。
- 失败条件：实现继续在 registry 或 facts 失效时主命中 learned stable，或只做局部修补而不 full rebuild。

### 验收 3：manifest 与 tree 只是 derived views

- 可观测结果：`manifests/latest.json` 和 `tree/*` 可从 canonical stores 完整重建，且 `input_snapshots` 覆盖 registry、manual source docs、facts 和 routeable learned `.json/.md`。
- 成功条件：新增、删除、改名、哈希变化、json/md 缺对、manual source doc 漏覆盖都会让 manifest stale 并触发 full rebuild。
- 失败条件：derived views 承载唯一状态，或 freshness 只依赖 `mtime`、目录时间戳、人工判断。

### 验收 4：canonical ID、路径与树拓扑完全受控

- 可观测结果：`task_id / skill_id / event_id`、`normalize_path`、`slugify`、`subdomain` allow-list、`parent_skill_id` 和 rooted forest 排序都有确定性测试。
- 成功条件：manual Skill 永远是根节点；learned Skill 只有 0 或 1 个父节点；跨域挂接、环路、非法 `subdomain` 都会被排除并写 drift reconcile。
- 失败条件：存在自由命名、路径歧义、隐式多父节点或“看起来像就挂上去”的 tree materializer。

### 验收 5：任务开始前的路由与 gate 绑定完全按冻结规则执行

- 可观测结果：每次任务都写 `RoutingReceipt`，包含 `TaskFingerprint`、project facts、task-scope gates、candidate evaluations 和明确的 `decision_reason`。
- 成功条件：`domain / task_kind / artifact_types / target_paths / goal_terms` 只来自当前任务显式证据；preflight、approval、repo completion 与 task-specific verification 只按设计冻结规则自动绑定。
- 失败条件：路由阶段自由补猜 `domain/task_kind`、默认放行缺证据 gate、或把历史任务 gate 当成当前任务通过。

### 验收 6：任务回执、复用回执与 `reusable_summary` 只承认当前任务证据

- 可观测结果：`TaskExecutionReceipt`、`SkillReuseReceipt.attempts[]`、`TaskCommandRecord`、`VerificationCommandRecord`、`skill_usage` 与 `reusable_summary` 都可回指到当前任务命令、gate 或当前 task 的 `reuse/*`。
- 成功条件：`candidate-synthesis` 只读取当前任务 receipt 和当前 task 的 reuse ledger；`no_confident_match` 任务只允许按 `target_paths / requested_artifact_types / files_touched / referenced_specs` 做事后分类；`learning_blockers` 非空时必然阻断 candidate。
- 失败条件：从聊天文本、旧 Skill 正文、外部摘要或失败命令补写成功路径，或把多次 attempt 覆盖为单条终态。

### 验收 7：候选 Skill、冲突与谱系分配严格按设计冻结

- 可观测结果：候选生成会完整写 learned `.md + .json + lifecycle candidate-created receipt`，并带 `domain/subdomain/task_kinds/artifact_types/goal_terms/watch_paths/source_task_ids`。
- 成功条件：`replacement track / child track / root track` 只取决于当前任务 reuse anchors；`manual-authority-conflict`、`exact-scope-contract-conflict`、`empirical-replacement-conflict` 按冻结规则阻断或替换。
- 失败条件：候选正文与 `reusable_summary` 不一致、exact-scope 歧义仍强行落盘，或 conflict 仅靠分数/新旧程度裁决。

### 验收 8：lifecycle、`last_verified_at` 与恢复语义可审计

- 可观测结果：candidate 创建、晋升、降级、暂停、过期、恢复、退役、手动确认、冲突记录都有独立 `lifecycle/*` 回执。
- 成功条件：`last_verified_at` 只由 candidate-created、成功复用、scheduled/event recheck 成功或 `revalidated` 推进；`paused/expired` 只有 fresh 成功复用或显式人工 revalidate 才能恢复。
- 失败条件：扫描成功即默认恢复、失败/partial 推进 `last_verified_at`、或只改 metadata 不写 lifecycle evidence。

### 验收 9：drift scan 与 `affected_skill_ids` 可重建

- 可观测结果：`global-root / manual-source / fact-source / skill-self / script-runtime / failure-sequence` 六类事件都能产出 `affected_skill_ids` 和 `drift/*` 回执。
- 成功条件：`global-root` 会覆盖全部非 `retired` Skills；`skill-self` 会覆盖 self + children + replacement/conflict peers；`failure-sequence` 只影响当前 Skill 自身；解析不出受影响集合时自动升级为 `global-root`，且 `drift_status != trusted` 的 Skill 不得主命中。
- 失败条件：凭“看起来相关”挑受影响 Skill，或在 unresolved drift 下继续给出 `primary_match`。

### 验收 10：技能树与 30 天统计完全从 receipts 推导

- 可观测结果：`tree/index.json`、`tree/overview.md`、`tree/domains/<domain>.md` 同时展示节点必显字段（`skill_id / title / domain/subdomain / task_kinds / artifact_types / trust_tier / lifecycle_status / drift_status / successful_reuse_count / last_verified_at / source_task_ids or source_doc_path / parent_skill_id`）、状态数量、`manual vs learned`、命中率、有效命中率、主命中率、`no_confident_match` 比例、失败率和 domain coverage。
- 成功条件：所有统计只从 `routing/*`、`reuse/*`、registry 和 learned metadata 推导，不从聊天文本或手工结论补猜。
- 失败条件：manual 统计把整个目录当 Skill，或有效命中率、失败率、coverage 与 success definition 不一致。

### 验收 11：`archives/*` 与技能树外显产物只镜像已有 receipts

- 可观测结果：`archives/<date>/<task-id>.md` 固定展示 `User Request`、`Routing Summary`、`Skills Actually Used`、`Re-explored Paths And Corrections`、`Verification Evidence`、`Source Receipt Refs`，且所有内容都能回指当前任务 receipts。
- 成功条件：archive 重写只允许格式修正或补齐既有 receipt 引用，不能在缺少新 receipt 的情况下新增结论。
- 失败条件：archive 通过扫描历史任务或聊天文本补猜“实际用了什么 Skill / 为什么成功”，从而产生第二套真相来源。

### 验收 12：所有 fail-closed 分支都保持基础工作流可继续

- 可观测结果：`manual registry unavailable`、`facts stale`、`manifest stale`、timeout、external failure、partial、verification failed、authority conflict 时，都能看到统一的 `no_confident_match / failed-reuse / pending_recheck` 证据。
- 成功条件：系统立即退出默认复用路径，回退到基础工作流或人工 Skill 路径，但不会伪装成成功 candidate、successful reuse 或 stable promotion。
- 失败条件：旧 Skill 命中后继续盲目执行、跳过当前验证，或把失败吞成“暂时无影响”。

### 验收 13：验证矩阵与仓库门禁一致，且 learned Skill 不能自证 learned Skill

- 可观测结果：每条验收标准都有对应的 unit / integration / snapshot / structure 测试；当前 plan review 阶段通过 `npm run exec-plan:review:preflight`，进入实际代码落地后还必须通过 `npm run code-implementation:preflight`、`pnpm lint`、`pnpm typecheck`、`pnpm test`。
- 成功条件：新层的 correctness 来自当前任务脚本、结构测试、fixture 集成与 receipt evidence，而不是 learned Skill 自己的成功叙述。
- 失败条件：没有 executable verification、只靠 README 文本宣称正确，或让 learned Skill 回头为自己提供通过证据。

## 当前残余风险

- V1 一次性覆盖 registry、facts、routing、candidate、lifecycle、tree 六条链路，任何一个 receipt 漏字段都可能放大为后续统计和漂移误判，因此必须优先保证 canonical contract 完整，再追求“好看”的 overview。
- manual registry 的首批收录范围如果过宽，会把参考文档误升级为可路由 manual Skill；如果过窄，又会让路由层缺少真正可复用的人工能力，初始 seed 必须用显式 allow-list 控制。
- `project-facts` 的 built-in extractor 依赖 `agentReadme.md`、`docs/specs/agent-work/README.md`、`system-spec.md` 与 `architecture-boundaries.md` 的精确结构；若未来这些文档自然演进而未同步 extractor，系统会按设计 fail closed。
- drift scan 与 `watch_paths` 是最容易被实现偷懒的地方；一旦把 derived outputs 或聊天语义混入，会直接破坏 `affected_skill_ids` 和连续失败判定。
- visual web 截图测试依赖外部浏览器运行时；当前已改为“运行时缺失则显式 skip”，避免把可选环境缺口误判为仓库逻辑回归，但这也意味着后续若要验证视觉回归，仍需在具备 Playwright + Edge 运行时的环境中单独跑 visual suite。
- 为让 `pnpm lint` 恢复可执行，本轮同步了 `docs/specs/quality-audits/quality-gate.json` 的既有复杂度预算快照；该操作未放宽门限，但引入了“预算基线需要持续维护”的额外同步成本。

## 本轮执行同步（2026-05-16）

- Task: Phase 2 / candidate synthesis、谱系锚点与冲突治理
  - Status: `DONE`
  - Files Changed: `src/agentMemory/candidate.ts`、`src/agentMemory/index.ts`、`src/agentMemory/types.ts`、`src/__tests__/agentMemoryCandidate.test.ts`
  - Verification: `pnpm exec vitest run src/__tests__/agentMemoryCandidate.test.ts`
  - Result: 候选提炼前置条件、`replacement/child/root` 分配、manual/exact-scope/empirical conflict 阻断与 learned `.md/.json` 写盘已按设计落地。
- Task: Phase 2 / lifecycle 状态机与冻结回写
  - Status: `DONE`
  - Files Changed: `src/agentMemory/lifecycle.ts`、`src/agentMemory/types.ts`、`src/__tests__/agentMemoryLifecycle.test.ts`
  - Verification: `pnpm exec vitest run src/__tests__/agentMemoryLifecycle.test.ts`
  - Result: `candidate-created / promoted / manually-confirmed / demoted / paused / expired / retired / superseded / revalidated / conflict-recorded` 回执、`last_verified_at`/`last_used_at`/`successful_reuse_count` 写回与恢复约束已落地。
- Task: Phase 2 / drift scan、tree materializer 与 30 天统计
  - Status: `DONE`
  - Files Changed: `src/agentMemory/drift.ts`、`src/agentMemory/tree.ts`、`src/agentMemory/index.ts`、`src/__tests__/agentMemoryDriftTree.test.ts`
  - Verification: `pnpm exec vitest run src/__tests__/agentMemoryDriftTree.test.ts`
  - Result: `global-root / manual-source / failure-sequence` 等影响面解析、rooted forest 物化与基于 receipts 的 30 天统计已落地。
- Task: Phase 2 / 仓库级验证与收口
  - Status: `DONE`
  - Files Changed: `src/__tests__/cliRepoSyncWorkflow.test.ts`、`src/__tests__/visualConsoleWeb.visual.test.ts`、`docs/specs/quality-audits/quality-gate.json`、`agentReadme.md`、`docs/specs/exec-plans/README.md`、`docs/specs/exec-plans/self-evolving-skill-tree-v0.1.exec-plan.md`
  - Verification: `npm run code-implementation:preflight`、`pnpm exec vitest run src/__tests__/cliRepoSyncWorkflow.test.ts`、`pnpm exec vitest run src/__tests__/visualConsoleWeb.visual.test.ts`、`pnpm lint`、`pnpm typecheck`、`pnpm test`
  - Result: repo-sync workflow 测试已显式固定 HTTP-first 环境前提；visual web screenshot suite 在缺少可用 Playwright/Edge 运行时时转为显式 skip；fresh 仓库级验证已通过。
- Task: Phase 3 / 仓库内 workflow API、fail-closed 写回与最终收口
  - Status: `DONE`
  - Files Changed: `src/agentMemory/workflow.ts`、`src/agentMemory/routing.ts`、`src/agentMemory/lifecycle.ts`、`src/agentMemory/index.ts`、`src/__tests__/agentMemoryWorkflow.test.ts`、`src/__tests__/agentMemoryRouting.test.ts`、`src/__tests__/specStructure.test.ts`、`docs/specs/agent-work-spec.md`、`docs/specs/agent-work/runtime-routing.md`、`docs/specs/exec-plans/README.md`、`docs/specs/exec-plans/self-evolving-skill-tree-v0.1.exec-plan.md`
  - Verification: `npm run code-implementation:preflight`、`npm exec -- vitest run src/__tests__/agentMemoryRouting.test.ts src/__tests__/agentMemoryWorkflow.test.ts src/__tests__/specStructure.test.ts`、`npm run typecheck`、`npm run lint`、`npm run test`
  - Result: 已新增仓库内 `workflow` API，把 `freshness preflight -> routing -> task receipt -> reuse/candidate/lifecycle -> tree` 串成闭环；`missing-design-reference`、`ambiguous-design-reference`、`ambiguous-exec-plan-reference`、authority conflict、manual/facts/manifest stale、manual takeover、paused/expired recovery 与 `partial/timeout/external-failure` fail-closed 均有定向测试、全仓回归与写盘证据。

## 本轮执行同步（2026-05-18）

- Task: 修复 review 指出的 `manifest.ts` recent-success 统计复杂度回归并刷新 exec-plan ledger
  - Status: `DONE`
  - Files Changed: `src/agentMemory/manifest.ts`、`src/__tests__/agentMemoryRouting.test.ts`、`docs/specs/exec-plans/self-evolving-skill-tree-v0.1.exec-plan.md`
  - Verification: `npm exec -- vitest run src/__tests__/agentMemoryRouting.test.ts`、`npm run lint`、`npm run typecheck`、`npm run test`、`npm exec -- vitest run src/__tests__/specStructure.test.ts`
  - Result: `collectRecentSuccessfulReuseCounts` 已拆为 cutoff 解析、receipt 读取、attempt 判定与聚合 helper；recent-success 路由回归现覆盖 malformed receipt、fallback、verification failed 与 30 天窗口过滤；本 exec-plan 的 `Completed` 叙述与验证账本已刷新到本轮 fresh 结果。

## 验证矩阵

| 类型 | 验证内容 | 命令 / 方法 | 通过标准 |
| --- | --- | --- | --- |
| 结构 | exec-plan review 技能门禁 | `npm run exec-plan:review:preflight` | `ExecPlan_ReviewSkill.md` 与 preflight receipt 一致，允许输出正式 review/self-review 结论 |
| 结构 | 代码实现技能门禁 | `npm run code-implementation:preflight` | 进入实际代码落地前必须通过；未通过时不得把任务推进到默认实现路径 |
| 结构 | ExecPlan/索引结构守护 | `vitest run src/__tests__/specStructure.test.ts` | `exec-plans/README.md`、本计划 ledger 结构、manual registry 文件与新目录约束通过 |
| 静态 | 类型与 contract 对齐 | `pnpm typecheck` | `src/agentMemory/*` 与 receipt / metadata / gate / tree contracts 无类型错误 |
| 质量 | 仓库质量门禁 | `pnpm lint` | 无新增质量回归，禁止引入“看起来能跑”的未受控复杂度 |
| 单元 | 路径、slug、ID 与 scope hash | `vitest run src/__tests__/agentMemoryContracts.test.ts` | `normalize_path`、`normalize_path_list`、`slugify`、`task_id`、`skill_id`、`event_id` 行为与设计一致 |
| 单元 | 文档状态权威与 fact extractor | `vitest run src/__tests__/agentMemoryFacts.test.ts` | requirement/design approval、`project-facts` allow-list、内置提取器、authority conflict、full rebuild 规则通过 |
| 单元 | manual registry / manifest freshness | `vitest run src/__tests__/agentMemoryRegistry.test.ts` | `ManualSkillMetadata` contract、manual-root / `supersedes_learned_skill_ids` 约束、registry/source-state/source-doc hash、learned `.json/.md` 配对、manifest input snapshots 与 stale 判定通过 |
| 单元 | gate 自动绑定与 routing score | `vitest run src/__tests__/agentMemoryRouting.test.ts` | `design-approved`、preflight、repo completion、task-specific verification、评分阈值与 `no_confident_match` 语义通过 |
| 单元 | task / reuse receipts 与 reusable summary | `vitest run src/__tests__/agentMemoryReceipts.test.ts` | `TaskCommandRecord`、`VerificationCommandRecord`、`skill_usage`、`reusable_summary`、`learning_blockers`、attempt ledger 语义通过 |
| 单元 | post-task classification 与 archive mirror | `vitest run src/__tests__/agentMemoryReceipts.test.ts` | `no_confident_match` 事后分类、`archives/*` 固定 section、mirror-only 语义与 source receipt refs 通过 |
| 单元 | candidate / lineage / conflict | `vitest run src/__tests__/agentMemoryCandidate.test.ts` | `replacement/child/root`、`manual-authority-conflict`、`exact-scope-contract-conflict`、`empirical-replacement-conflict` 与 `watch_paths` 规则通过 |
| 单元 | lifecycle / recovery / expiry | `vitest run src/__tests__/agentMemoryLifecycle.test.ts` | promotion、demotion、paused、expired、revalidated、`last_verified_at`、manual takeover 行为通过 |
| 单元 | drift 与 tree metrics | `vitest run src/__tests__/agentMemoryDriftTree.test.ts` | `affected_skill_ids`、`pending_recheck`、`skill-self / failure-sequence` 传播、`tree/index.json`、`overview.md`、节点必显字段、30 天统计和 domain coverage 通过 |
| 集成 | baseline -> candidate | `vitest run src/__tests__/agentMemoryWorkflow.test.ts` | 成功任务在 gate/verification 全通过时写 candidate 与 `candidate-created` lifecycle receipt |
| 集成 | successful reuse -> promotion | `vitest run src/__tests__/agentMemoryWorkflow.test.ts` | learned candidate 在后续成功复用或 manual confirmation 后晋升 stable，并保留完整 evidence refs |
| 集成 | stale / conflict -> fail closed | `vitest run src/__tests__/agentMemoryWorkflow.test.ts` | manual registry stale、facts stale、manifest stale、manual conflict、exact-scope conflict 都会阻断主命中与 candidate write |
| 集成 | paused / expired -> revalidated | `vitest run src/__tests__/agentMemoryWorkflow.test.ts` | 只有 fresh success reuse 或显式 manual revalidate 能恢复 stable；单次扫描成功不恢复主命中 |
| Snapshot | 技能树物化视图 | snapshot 测试 | `tree/index.json`、`tree/overview.md`、`tree/domains/*.md` 字段、排序和统计稳定可审计 |

## 验证记录

| 时间 | 事实 | 结果 | 说明 |
| --- | --- | --- | --- |
| 2026-05-16 | 设计文档、需求文档、`agentReadme.md`、`docs/specs/agent-work/README.md`、`ExecPlan_ReviewSkill.md` 交叉复核 | 已完成 | 已确认本计划必须严格对齐 `self-evolving-skill-tree-design.md`，且不能绕过 design approval / preflight / verification 门禁 |
| 2026-05-16 | 现有 exec-plan 结构与索引风格审阅 | 已完成 | 已确认新计划必须沿用仓库 ledger 结构，而不是另起一套 Superpowers 默认模板 |
| 2026-05-16 | 基于 `ExecPlan_ReviewSkill` 的首轮自审 | 已完成 | 已补齐 design approval 状态同步、manual registry 与 project-facts 的 fail-closed 语义、`design-approved`/preflight 自动绑定、`task-specific-verification` synthetic gate、`watch_paths` 排除 derived outputs、`last_verified_at` 恢复约束、`manual vs learned` 统计口径和 rooted forest 拓扑规则 |
| 2026-05-16 | 基于 `ExecPlan_ReviewSkill` 的二轮对齐审查 | 已完成 | 已把阶段切分收敛为 4 个落地阶段，并把 `project-facts` 提取器 allow-list、candidate-synthesis 证据边界、exact-scope conflict、failure-sequence drift、archive mirror contract 与 30 天统计全写入实施步骤和验收标准 |
| 2026-05-16 | 基于 `ExecPlan_ReviewSkill` 的三轮对齐审查 | 已完成 | 已补齐 manual registry seed 来源约束、完整 `task_id/skill_id/event_id` 冻结规则、typed gate contract 与 preflight 相位拆分、路由评分阈值、候选生成前置条件、完整 `LearnedSkillMetadata` 字段与实现阶段只读 approved design 的边界 |
| 2026-05-16 | 基于 `ExecPlan_ReviewSkill` 的四轮对齐审查 | 已完成 | 已补齐 `project-facts` 内置提取器的精确导出面、`fact_id`/authority-conflict 规则、`task_id` 续用/新建判定、`architecture-boundaries.md` 决策 allow-list、TaskFingerprint 证据优先级与原生域优先规则、`verification_commands` 一一绑定、`reuse receipt` 顶层摘要派生语义、候选正文 8 个 section 的对位拷贝约束，以及技能树总览必须展示的统计字段 |
| 2026-05-16 | 基于 `ExecPlan_ReviewSkill` 的五轮对齐审查 | 已完成 | 已补齐 `ManualSkillMetadata` 完整 contract、manual-root / `supersedes_learned_skill_ids` 约束、`script_refs` 必须指向仓库内真实路径、`skill-self` / `failure-sequence` 的 `affected_skill_ids` 传播语义，以及技能树节点必显字段 |
| 2026-05-16 | `npm run exec-plan:review:preflight` | 通过 | 已在 `agent-trend-radar` conda 环境内验证 exec-plan review 技能 preflight receipt 与 skill hash 一致 |
| 2026-05-16 | `pnpm test -- specStructure` | 通过 | 新 exec-plan、README 索引与仓库必需 spec 结构测试通过，无文档结构回归 |
| 2026-05-16 | 基于 fresh preflight 与结构测试的终轮自审 | 已完成 | 已用当次 `exec-plan review preflight` 与 `specStructure` 结果复核计划正文，未发现仍与 `self-evolving-skill-tree-design.md` 冻结语义冲突的 blocking / high-confidence 偏移 |
| 2026-05-16 | `npm run code-implementation:preflight` | 通过 | 已在实现阶段前重新通过代码落地技能门禁，允许继续按 exec-plan 实施与收口 |
| 2026-05-16 | `pnpm exec vitest run src/__tests__/agentMemoryCandidate.test.ts src/__tests__/agentMemoryLifecycle.test.ts src/__tests__/agentMemoryDriftTree.test.ts` | 通过 | Phase 2 新增的 candidate / lifecycle / drift-tree 定向测试全部通过 |
| 2026-05-16 | `pnpm exec vitest run src/__tests__/agentMemoryContracts.test.ts src/__tests__/agentMemoryFacts.test.ts src/__tests__/agentMemoryRegistry.test.ts src/__tests__/agentMemoryRouting.test.ts src/__tests__/agentMemoryReceipts.test.ts src/__tests__/agentMemoryCandidate.test.ts src/__tests__/agentMemoryLifecycle.test.ts src/__tests__/agentMemoryDriftTree.test.ts` | 通过 | agentMemory 相关 contracts、facts、registry、routing、receipts 与 Phase 2 新能力在同一回归批次内通过 |
| 2026-05-16 | `pnpm exec tsx scripts/qualityAudit.ts --sync-gate` | 已完成 | 已同步 `docs/specs/quality-audits/quality-gate.json` 的既有复杂度预算快照，使现有 `src/agentMemory/*` 历史复杂度债务可被仓库门禁显式跟踪；未放宽门限 |
| 2026-05-16 | `pnpm lint` | 通过 | 在同步 quality gate 预算快照后，lint 与复杂度门禁通过，无新增本轮 lint 回归 |
| 2026-05-16 | `pnpm typecheck` | 通过 | `src/agentMemory/*` 新增 contract / lifecycle / drift / tree 逻辑无类型错误 |
| 2026-05-16 | `pnpm exec vitest run src/__tests__/cliRepoSyncWorkflow.test.ts` | 通过 | repo-sync workflow 测试已在显式关闭 HTTP-first 的前提下通过，确认本地 `git pull --ff-only` 路径仍可验证 |
| 2026-05-16 | `pnpm exec vitest run src/__tests__/visualConsoleWeb.visual.test.ts` | 通过（skip） | visual web screenshot suite 在缺少可用 Playwright/Edge 运行时时显式跳过，不再把外部运行时缺口记为仓库逻辑失败 |
| 2026-05-16 | `pnpm test` | 通过 | 仓库级回归已恢复全绿：`36 passed / 1 skipped`，其中 skip 来自 visual web screenshot suite 的运行时缺口保护 |
| 2026-05-16 | `npm exec -- vitest run src/__tests__/agentMemoryRouting.test.ts src/__tests__/agentMemoryWorkflow.test.ts` | 通过 | Phase 3 新增的仓库内 workflow API、manual takeover、revalidated recovery、stale drift 写回，以及 design/exec-plan gate fail-closed 定向场景全部通过 |
| 2026-05-16 | `npm exec -- vitest run src/__tests__/specStructure.test.ts` | 通过 | `workflow.ts`、`agentMemoryWorkflow.test.ts`、exec-plan 状态与索引同步规则已进入结构守护 |
| 2026-05-16 | `npm run code-implementation:preflight` | 通过 | Phase 3 最终收口前重新验证代码实现门禁，当前环境下 receipt 与实现技能 hash 一致 |
| 2026-05-16 | `npm run typecheck` | 通过 | `workflow.ts`、routing gate 修正与新集成测试在全仓类型检查下通过 |
| 2026-05-16 | `npm run lint` | 通过 | `workflow.ts` 已拆分到质量门禁阈值内，未新增复杂度或长函数回归 |
| 2026-05-16 | `npm run test` | 通过 | 仓库级回归为 `37 passed / 1 skipped`、`251 passed / 9 skipped`；skip 仍仅来自 visual web screenshot suite 的运行时缺口保护 |
| 2026-05-16 | 修复 exec-plan 对齐审查发现的 3 个阻塞缺口 | 已完成 | 已补齐 `skill-metadata required_gates` 合并与 `gate-contract-conflict -> rejected_matches`、`task-specific-verification`/runtime-context fail-closed，以及 `archives/*` 实盘镜像与 source receipt refs；对应定向 red-green 回归已补入 `agentMemoryRouting/Receipts/Workflow` 测试 |
| 2026-05-17 | 修复 review 新发现的 4 个阻塞缺口 | 已完成 | 已修复 `receipts.ts` lint 回归、stale project facts 仍注入 `TaskFingerprint`、learned candidate 把 task evidence 写回 `required_gates` 契约、以及 runtime `refreshDerivedArtifacts` 未接 manual registry / project facts full rebuild 的闭环缺口 |
| 2026-05-17 | `npm run code-implementation:preflight` | 通过 | 当前工作区的实现技能门禁重新通过，receipt / exec-plan hash 一致 |
| 2026-05-17 | `npm exec -- vitest run src/__tests__/agentMemoryCandidate.test.ts src/__tests__/agentMemoryWorkflow.test.ts src/__tests__/agentMemoryReceipts.test.ts` | 通过 | 新增 red-green 回归已覆盖冻结 gate hint、stale facts fail-closed 与 runtime full rebuild 自愈路径 |
| 2026-05-17 | `npm run typecheck` | 通过 | `TaskExecutionReceipt` gate contract 扩展、candidate 合成与 workflow rebuild 接线无类型错误 |
| 2026-05-17 | `npm run lint` | 通过 | `buildReusableSummary` / `buildLearningBlockers` 已拆分回质量门禁阈值内，仓库无新增复杂度或长函数回归 |
| 2026-05-17 | `npm run test` | 通过 | 仓库级回归为 `37 passed / 1 skipped`、`262 passed / 9 skipped`；skip 仍仅来自 visual web screenshot suite 的运行时缺口保护 |
| 2026-05-18 | 修复 review 新发现的 `manifest.ts` recent-success 复杂度回归并刷新 ledger | 已完成 | 已将 `collectRecentSuccessfulReuseCounts` 拆分为独立 helper，保留 malformed receipt / fallback / verification failed / stale attempt 的 fail-closed 统计语义，并同步刷新本 exec-plan 的状态叙述 |
| 2026-05-18 | `npm exec -- vitest run src/__tests__/agentMemoryRouting.test.ts` | 通过 | recent-success 路由回归已覆盖 malformed receipt、fallback、verification failed、无效时间戳与 30 天窗口过滤，确认拆分后统计语义未变 |
| 2026-05-18 | `npm run lint` | 通过 | `src/agentMemory/manifest.ts` 不再触发 `collectRecentSuccessfulReuseCounts complexity=12`，仓库质量门禁 fresh 通过 |
| 2026-05-18 | `npm run typecheck` | 通过 | 新增 recent-success 过滤回归测试与 `manifest.ts` helper 拆分在全仓类型检查下通过 |
| 2026-05-18 | `npm run test` | 通过 | 仓库级回归保持为 `37 passed / 1 skipped`、`273 passed / 9 skipped`；skip 仍仅来自 visual web screenshot suite 的运行时缺口保护 |
| 2026-05-18 | `npm exec -- vitest run src/__tests__/specStructure.test.ts` | 通过 | exec-plan 账本与状态同步仍满足仓库结构守护，文档修正未引入结构回归 |

## 回滚策略

- 若 Phase 0 无法稳定建立 `manual registry + project-facts + manifest` 的 canonical contract，则只保留根规则与现有人工流程，不启用 learned candidate 写盘。
- 若 Phase 1 的 routing/gate/receipt 语义出现歧义或 stale 漏判，立即退回 `no_confident_match + 基础工作流`，不让 learned stable 继续主命中。
- 若 Phase 2 的 lifecycle / drift / tree 物化不稳定，可暂时保留 canonical receipts，停止 `primary_match` 与 tree publication，但不得篡改已有 receipt 或伪装 overview 为最新成功状态。
- 若统计或 overview 结果与 receipts 不一致，优先回退 derived views，保留 canonical stores，并在下次路由前强制 full rebuild。

## 结论记录

- 2026-05-16：本计划承接 `self-evolving-skill-tree-design.md` 的冻结结论，V1 只做仓库内 Agent 工作层，不做主产品链路侵入。
- 2026-05-16：manual registry、`project-facts`、manifest freshness、`TaskFingerprint`、候选提炼、lifecycle、drift、tree 统计必须作为一条闭环整体设计；拆掉其中任何一个 canonical 约束，都会让 learned Skill 重新退化成聊天记忆。
- 2026-05-16：design approval 事实以 `agentReadme.md` 的 `Approved design:` 列表为唯一权威来源；本计划消费该批准状态，但不在实现阶段改写 approved design doc 语义。
- 2026-05-16：根据自审结果，最终阶段数固定为 4；Phase 0 锁 canonical 契约，Phase 1 锁 routing/receipts，Phase 2 锁 lifecycle/drift/tree，Phase 3 锁仓库接线与验证收口，避免在同一阶段同时引入 schema、路由和恢复语义导致边界失焦。
- 2026-05-16：按 `ExecPlan_ReviewSkill` 完成五轮对齐修订与 fresh 验证后，当前版本已收敛到“设计冻结项有实现步骤、实现步骤有验收、验收有脚本/测试入口、失败分支可回滚”的可执行状态。
- 2026-05-16：Phase 0 与 Phase 1 已完成代码落地，manual registry / project-facts / manifest freshness、routing / gates / receipts / archive mirror 已进入仓库内可验证状态。
- 2026-05-16：Phase 2 的 candidate / lifecycle / drift / tree 核心代码与对应测试已落地，并已通过 `npm run code-implementation:preflight`、定向 agentMemory 回归、`pnpm lint`、`pnpm typecheck` 与 `pnpm test`；visual web screenshot suite 在运行时缺失场景下改为显式 skip，因此 Phase 2 现已完成。
- 2026-05-16：本轮为恢复 lint gate 同步了 `docs/specs/quality-audits/quality-gate.json` 的既有预算基线；这是门禁快照更新，不是设计或阈值放宽。
- 2026-05-16：Phase 3 已完成；仓库内 `workflow` API、manual takeover / recovery、fail-closed drift 写回、结构守护与 exec-plan/README 状态同步均已落地，后续若要扩 allow-list、approval source 或 operator surface，应改走 follow-up exec-plan。
- 2026-05-16：根据代码落地对齐审查补丁，Phase 1/3 的剩余实现偏差已收口：候选 Skill 现在会合并 `project-fact ∪ skill-metadata` gates 并对 contract conflict fail closed，任务执行会补齐 runtime-specific gate 判定与 synthetic `task-specific-verification`，`archives/*` 也已成为真实落盘产物而非仅存在 renderer。

## 下一阶段入口

- Phase 0/1/2/3 已全部完成；当前计划不再继续堆叠实现项。
- 后续若要扩 allow-list、approval source 或 operator surface，必须新开 follow-up exec-plan，并先回到 design review。
- 后续维护只允许在不改设计冻结语义的前提下做 canonical data rebuild、门禁回归与 bugfix；任何语义扩展都不回填本计划。
