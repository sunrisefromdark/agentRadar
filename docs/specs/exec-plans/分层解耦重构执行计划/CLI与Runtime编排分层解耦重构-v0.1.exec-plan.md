# 执行计划：CLI 与 Runtime 编排分层解耦重构 v0.1

## 任务信息

- 版本：`v0.1`
- 当前状态：`Draft`
- 类型：增量解耦重构
- 对应 Skill：`docs/specs/agent-work/RefactorSkill.md`
- 目标工作量：`1 人 / 1 个短阶段起步`
- 主要现状：`src/cli.ts` 约 `1287` 行，命令解析、流程编排、写盘、dry-run、resume、agent-memory 接线混在同一入口。

## RefactorSkill 审核结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| Pain | `PASS` | CLI 入口继续承载编排和副作用会让 dry-run / 写盘验证变脆。 |
| Boundary | `PASS` | 只碰 runtime command shell、planning、write plan、resume，不碰 action builder 内部表达。 |
| Incremental path | `PASS` | 旧 `src/cli.ts` 保留默认 dispatch，新 runtime command 并行接一个低风险命令。 |
| Invariants | `PASS` | 命令名、参数、exit behavior、dry-run 不写盘、resume 语义不变。 |
| Evidence | `PASS` | CLI workflow tests、dry-run negative tests、target command smoke。 |
| Rollback | `PASS` | 单命令 dispatch 可指回旧实现。 |
| Delete condition | `PASS` | 旧 CLI 分支无生产引用，入口只剩 parse/dispatch/top-level error。 |

## 目标

把 CLI 和 runtime 编排拆成 commands、planning、writers、resume、dispatch。`src/cli.ts` 收缩为参数解析和 command dispatch，dry-run/write plan 成为可测试 owner。

## 目标目录形态

```text
src/runtime/
  cli/
    parseArgs.ts
    dispatch.ts
    errors.ts
  commands/
    runDaily.ts
    runWeekly.ts
    verifyDaily.ts
    visualConsole.ts
    buildKb.ts
  planning/
    dailyPlan.ts
    weeklyPlan.ts
    writePlan.ts
  writers/
    artifactWriter.ts
    dryRunSummary.ts
  resume/
    resumeState.ts
```

## 不变量

- CLI 命令名、参数、默认行为不变。
- dry-run 不写 `data/` 持久文件。
- latest / dated artifact 刷新语义不变。
- CLI 不承载业务规则，只编排下层 owner。

## 当前状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 旧默认路径 | `ACTIVE` | `src/cli.ts` 继续服务生产。 |
| 新并行路径 | `TODO` | `src/runtime/**` 待建。 |
| 切换点 | `TODO` | 每次只切一个命令 dispatch。 |
| 删旧条件 | `TODO` | 旧 CLI 分支无生产引用。 |

## 阶段进度

本计划内部按 Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 顺序执行；跨计划执行顺序以 `00-并行协作总控.md` 为准。


| Phase | 状态 | 任务 | 完成条件 |
| --- | --- | --- | --- |
| Phase 0：入口盘点 | `TODO` | 列出 command -> action -> writer -> artifact -> tests 调用链 | 有命令调用链表 |
| Phase 1：runtime shell | `TODO` | 新建 parse/dispatch/errors 和一个低风险 command wrapper | 行为等价 |
| Phase 2：write plan / dry-run owner | `TODO` | 抽 writePlan、artifactWriter、dryRunSummary | dry-run 负例通过 |
| Phase 3：核心命令迁移 | `TODO` | runDaily/runWeekly/verifyDaily 按命令迁移 | CLI workflow 和 dry-run 通过 |
| Phase 4：辅助命令迁移 | `TODO` | visualConsole/buildKb/score 等按需迁移 | 对应 smoke 通过 |
| Phase 5：删旧分支 | `TODO` | 删除旧 CLI 巨型分支 | `src/cli.ts` 只剩 parse/dispatch/top-level error |

## 已落地内容

- `2026-06-30`：仅建立计划，未改代码。

## 验证矩阵

| 文件位置或类型 | 验证内容 | 验证方式或命令 | 通过标准 |
| --- | --- | --- | --- |
| CLI workflow | 参数和 dispatch | `vitest run src/__tests__/cliWorkflow.test.ts` | 退出码 0 |
| dry-run | 不写持久 artifact | dry-run focused tests / `run-daily --dry-run` | 无持久写入 |
| run-weekly | weekly command 编排 | `run-weekly --dry-run` | 基于完整窗口，不静默拼假窗口 |
| verify-daily | verify command 编排 | `verify-daily` focused test | 失败可解释 |
| 引用搜索 | 旧 CLI 分支是否可删 | `rg <old-command-branch>` | 无生产引用 |

## 回滚策略

按命令回滚。某命令新 runtime 失败时，dispatch 指回旧 `src/cli.ts` 分支；writePlan / dryRun 失败样本必须进入 tests。

## 结论记录

- 计划符合 `RefactorSkill.md`：CLI 不承载业务规则，旧默认保留，按命令单点切换，dry-run owner 明确。

## 当前残余风险

- `src/types.ts` 可能仍是跨层类型聚合点，本计划只记录类型拆分候选，不在第一阶段直接改 schema。

## 下一阶段入口

执行 Phase 0，只读生成 CLI command -> action builder -> writer -> artifact -> tests 调用链表，选择一个低风险命令做并行新路径。

