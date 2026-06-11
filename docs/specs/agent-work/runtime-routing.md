# 运行时路由

## 目标

定义 Agent 在当前 Spec 体系中什么时候只看局部节点，什么时候必须回到总地图重新下钻，并补充 Agent memory 路由前置门禁。

## 规则

- 同一任务内，先完整读取一次总索引和系统级 Spec。
- 之后只读取与当前改动直接相关的节点。
- 只有任务边界变化、Spec 冲突、系统边界切换、人类明确要求、exec-plan 状态不明，或关键 canonical inputs 发生变化时，才允许重新进入总地图。
- 如果进入下一阶段，例如从本地闭环进入 Trendshift / GitHub enrichment，必须先读取对应 exec-plan，而不是沿用上一阶段上下文。

## Agent Memory 路由前置门禁

在进入 Skill routing 之前，必须按固定顺序校验：

1. `manual registry freshness`
2. `project facts freshness`
3. `manifest freshness`

补充要求：

- 校验顺序不可调换。
- 任一层返回 `unavailable`、`stale`、`missing_evidence` 或 authority conflict，都必须 fail closed 到 `no_confident_match + 基础工作流`。
- `manual-skill-index.json`、`manual-skill-source-state.json`、`facts/index.json`、`facts/source-state.json`、`manifests/latest.json` 只允许按 full rebuild + hash snapshot 语义判断 freshness，不能退化成 `mtime` 或人工目测。
- `RoutingReceipt`、`TaskExecutionReceipt`、`SkillReuseReceipt` 与 `archives/*` 必须只引用当前任务 canonical evidence，不得跨任务借用旧 gate 结果或旧成功路径。
- 仓库内 workflow API 的固定串联顺序是：`freshness preflight -> RoutingReceipt -> TaskExecutionReceipt -> SkillReuseReceipt -> learned candidate / lifecycle recovery / tree refresh`。
- 当仓库通过 checked-in entrypoint 记录 CLI / automation / development task 时，也必须复用同一条 workflow API 链路；不允许额外发明旁路记账格式。
- `run-daily`、`run-weekly`、`score`、`verify-daily`、`build-kb` 与 `record-agent-task` 这类入口如果写入 agent-memory，必须把 command evidence、verification status、产物路径与 runtime context 一并落盘，而不是只写“任务成功”的口头结论。
- `facts stale` 或 `manifest stale` 时，当前任务必须先停在 `no_confident_match`，再把受影响 learned skills 标记为 `pending_recheck` 并写入 `drift/*`；不得一边沿用旧 manifest，一边声称主命中成功。
- `design-approved` 对 `exec-plan draft/revise/implement` 一律生效：缺 design doc 是 `missing-design-reference`，多条 design doc 是 `ambiguous-design-reference`，approved/draft 同时出现是 authority conflict。
- `code-implementation-preflight` 对 code-implementation 任务一律要求恰好一条 `.exec-plan.md` 引用；多条时必须回写 `ambiguous-exec-plan-reference`。
- `partial`、`timeout`、`external-failure`、`missing-verification-evidence` 与 manual takeover conflict 都只能进入 fail-closed / pending_recheck / paused / retired 路径，不能被统计成 successful reuse 或 candidate promotion。

## 何时必须重新下钻

出现以下任一情况时，Agent 必须重新读取总地图和当前 exec-plan：

- 任务从 review 转成 implement，或从 implement 转成 verify
- 目标路径跨出了当前阶段的职责边界
- `agentReadme.md`、approved design、manual registry source docs、project-fact allow-list 文档发生变化
- manual registry、project facts、manifest 任一层变 stale
- `TaskFingerprint` 在当前任务内仍是 `ambiguous` 或 `underspecified`

## 适用场景

- 多轮协作任务
- 长时间的局部修补
- 需要控制上下文膨胀的 Agent 工作流
- 需要把实现阶段和验证阶段拆开的任务

## Open Question

- 是否要在后续加入自动结构测试，检查每次回答是否引用了正确的 Spec 节点？
