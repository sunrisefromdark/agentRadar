# Agent 作业规范

## 文档状态

- 版本：`v0.3`
- 适用对象：负责读取仓库、生成 Spec、实现代码、补测试、执行验证的 Agent。
- 目标：把“先看 Spec，再动代码，再验证，再更新进度”的流程变成可复用协议。

## 标准作业流程

### 1. 任务分类

Agent MUST 先判断任务属于哪类：

- 补 Harness / Spec
- 实现 Signal connector
- 实现 normalization / dedupe
- 实现 scoring component
- 实现 LLM semantic classification
- 实现 Action report / KB
- 实现 CLI / config / storage
- 做验证、漂移扫描或执行计划收口

### 2. 先读地图与逐级下潜

在动手编写或构思实现代码之前，Agent MUST 进行逐级下潜式的上下文获取与评估。严禁直接根据局部代码或直觉进行修改。

下潜阅读顺序与目标：

1. 全局系统与文档索引
   - 必读：`docs/specs/README.md` 和 `docs/specs/system-spec.md`
   - 目标：了解系统整体鸟瞰图、服务定位、宏观数据流以及当前所在的架构层级
2. 目标服务的边界与约束
   - 必读：相关的 `product-specs/*.md` 和 `services/*.md`
   - 目标：确认职责边界、核心输入输出契约、状态机以及业务约束
3. 架构约束与测试防护
   - 必读：`docs/specs/constraints/architecture-constraints.md`、`docs/specs/constraints/structure-tests.md` 和相关 `feedback-loops/*.md`
   - 目标：确认哪些红线不能碰，以及如何验证修改没有造成架构漂移
4. 具体落地的执行计划与避坑指南
   - 必读：相关的 `docs/specs/exec-plans/*.md` 和 `docs/specs/agent-work/agent-pitfalls.md`
   - 目标：确认当前阶段、上下文状态以及已知基础设施陷阱

影响面评估（Blast Radius）：

- 上游影响：当前实现是否要求上游组件新增字段或更改调用约定
- 下游影响：当前输出格式或行为变化是否会破坏现有报告、评估或消费方预期
- 跨模块影响：若改动基础类型或通用模块，必须一次性找出所有受影响文件并同步更新

### 3. 修改纪律

- 新 source MUST 补 `services/signal-ingestion.md`、config 说明和结构测试。
- 新 score component MUST 补 `services/scoring-engine.md`、解释规则和测试。
- 新 report MUST 补 `services/action-output.md` 和产品场景。
- 新 CLI 命令 MUST 补 `services/cli-runtime.md`、README 和 exec-plan。
- 新落盘格式 MUST 补 `services/storage-incremental.md`。
- 不得让 LLM 直接决定最终 `ScoreBreakdown.total_score`。
- 不得把 agents-radar 的自然语言报告当成唯一事实来源。
- 不得把 Trendshift HTML 临时结构写成稳定契约。

### 4. 执行计划与 Agent Memory 台账

每个活跃 exec-plan MUST 维护以下字段：

- `当前状态`
- `当前进度`
- `已落地内容`
- `验证记录`
- `当前残余风险`
- `下一阶段入口`

如果本轮修改了代码但没有更新 exec-plan 进度，视为 Harness 漂移。

针对仓库内 Agent memory / learned-skill 层，新增以下强约束：

- routeable manual skills 只能来自 `docs/specs/agent-work/manual-skill-index.json` 与 `docs/specs/agent-work/manual-skill-source-state.json`
- `project-facts` 只能来自 allow-list 文档的 full rebuild，canonical 文件为 `data/agent-memory/facts/index.json` 与 `data/agent-memory/facts/source-state.json`
- `data/agent-memory/manifests/latest.json`、`data/agent-memory/tree/*` 只能是 derived views，不能承载唯一状态
- manual registry、project facts、manifest 任一 stale 或 unavailable 时，路由必须 fail closed 到 `no_confident_match + 基础工作流`
- `src/agentMemory/workflow.ts` 服务两类受控入口：仓库内 Agent 工作流，以及通过 checked-in entrypoint 触发的 CLI/automation 工作流记账；固定链路仍然是 `freshness preflight -> routing -> task receipt -> reuse/candidate/lifecycle -> tree`
- 允许接入的产品/自动化入口必须是 checked-in entrypoint，并且只记录当前执行的 canonical command、verification evidence 与产物路径；当前允许的主链路入口包括 `run-daily`、`run-weekly`、`score`、`verify-daily`、`build-kb`
- 开发任务流若不直接走仓库内 Agent module API，则必须通过 checked-in receipt 入口（如 `record-agent-task`）落账；不得靠聊天文本或人工摘要补写 learned-skill 证据
- `routing/*`、`tasks/*`、`reuse/*`、`archives/*` 只能记录当前任务 canonical 事实，不得从聊天文本或旧摘要自由补写

补充规则：

- 如果当前任务仍处于设计文档讨论 / 审核中，且用户尚未明确批准该设计文档，Agent MUST 不创建对应 exec-plan
- 在这种情况下，Agent SHOULD 把设计讨论状态、待确认问题和下一步建议写入仓库根目录的 `agentReadme.md`
- `manual registry unavailable`、`facts stale`、`manifest stale`、`partial`、`timeout`、`external-failure`、approval authority conflict、缺 design/exec-plan 引用或缺 task-specific verification 时，不得伪装成 candidate created、successful reuse 或 stable promotion
- `facts stale` 或 `manifest stale` 触发的 fail-closed 任务，必须把受影响 learned skills 写回 `pending_recheck`，并落 `drift/*` 证据，而不是静默忽略

### 5. 验证闭环

每次变更 SHOULD 明确：

- 单元测试
- 集成测试
- 回归测试
- 冒烟测试
- E2E 或 dry-run 验证

如果某类验证不适用，MUST 说明原因和替代验证方式。

## 输出要求

任务结束时 SHOULD 说明：

- 读取了哪些 Spec
- 修改了哪些行为
- 哪些契约保持不变
- 跑了哪些验证
- exec-plan 当前状态是什么
- 哪些 Open Question 仍需人工确认

## 禁区

- 不得先扫代码再凭局部实现猜系统意图
- 不得把长程安装、真实网络抓取、全量 E2E 和业务实现塞进同一轮
- 不得写不可解释的分数
- 不得让 rules-only 模式退化为“没有 LLM 就不能跑”
- 不得在验证失败时削弱测试来证明当前实现正确
