# 执行计划：Action 报告输出分层解耦重构 v0.1

## 任务信息

- 版本：`v0.1`
- 当前状态：`Draft`
- 类型：增量解耦重构
- 对应 Skill：`docs/specs/agent-work/RefactorSkill.md`
- 目标工作量：`1 人 / 1 个短阶段起步`
- 主要现状：`src/action/weeklyEnhancement.ts` 约 `1889` 行，`dailyReport.ts`、`runSummary.ts`、`dailyVerification.ts` 分别承担 builder、policy、render、status、verification 多重职责。

## RefactorSkill 审核结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| Pain | `PASS` | 报告输出逻辑和业务表达散在 action 大文件中，新增报告字段容易跨文件补丁。 |
| Boundary | `PASS` | 只碰 action 输出层，不碰 CLI dispatch、source/score 事实生产、Web view model。 |
| Incremental path | `PASS` | 旧 action 文件保留导出，新 daily/weekly/run-summary/verification 子目录并行。 |
| Invariants | `PASS` | daily/weekly/run-summary/verify artifact 字段和语义不变。 |
| Evidence | `PASS` | action tests、daily/weekly dry-run、report snapshot / semantic assertions。 |
| Rollback | `PASS` | 单 report builder 可回退旧导出。 |
| Delete condition | `PASS` | 旧 action 根文件无业务 builder 引用。 |

## 目标

把 action 输出拆成 daily、weekly、run-summary、verification、project-library 子域，每个子域再拆 builder、sections、renderers、status/policy，避免报告文案、状态判断和产物组装继续混在一个文件里。

## 目标目录形态

```text
src/action/
  daily/
    reportBuilder.ts
    sections/
    freshness.ts
    renderMarkdown.ts
  weekly/
    enhancement/
    judgment/
    industry/
    renderMarkdown.ts
  run-summary/
    builder.ts
    status.ts
  verification/
    dailyVerify.ts
    contracts.ts
  project-library/
    builder.ts
```

## 不变量

- Report 层只表达结构化事实，不重新计算 score、tier、weekly trend。
- weekly report 必须继续输出趋势抽象，不退化成项目列表。
- run-summary / verify-daily 继续解释失败来源。
- LLM/free text 不直接决定 score、tier、claim truth。

## 当前状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 旧默认路径 | `ACTIVE` | `src/action/*.ts` 继续服务生产。 |
| 新并行路径 | `TODO` | action 子域目录待建。 |
| 切换点 | `TODO` | 每次只切一个 report builder 或 renderer。 |
| 删旧条件 | `TODO` | 旧 root action builder 无生产引用。 |

## 阶段进度

本计划内部按 Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 顺序执行；跨计划执行顺序以 `00-并行协作总控.md` 为准。


| Phase | 状态 | 任务 | 完成条件 |
| --- | --- | --- | --- |
| Phase 0：报告职责盘点 | `TODO` | 盘点 daily/weekly/run-summary/verify 的 builder、policy、render、status | 有职责和测试映射表 |
| Phase 1：daily 分层 | `TODO` | daily report builder/sections/freshness/render 拆分 | daily tests 通过，输出不变 |
| Phase 2：run-summary / verification 分层 | `TODO` | run-summary status 与 daily verification contracts 拆分 | verify/run-summary tests 通过 |
| Phase 3：weekly 分层 | `TODO` | weekly enhancement/judgment/industry/render 拆分 | weekly 趋势断言通过 |
| Phase 4：project-library 分层 | `TODO` | project library builder 独立 | 现有 project-library 输出不变 |
| Phase 5：删旧 wrapper | `TODO` | 根 action 文件只保留兼容导出或移除 | 引用清零，回归通过 |

## 已落地内容

- `2026-06-30`：仅建立计划，未改代码。

## 验证矩阵

| 文件位置或类型 | 验证内容 | 验证方式或命令 | 通过标准 |
| --- | --- | --- | --- |
| daily | freshness、sections、markdown | daily/action tests 或 `run-daily --dry-run` | 输出结构不变 |
| weekly | enhancement、judgment、industry、markdown | weekly tests 或 `run-weekly --dry-run` | 有趋势抽象 |
| run-summary | source status、recommended actions | run-summary tests | 失败原因可解释 |
| verification | daily verify contracts | verify tests / `verify-daily` | 失败可审计 |
| 引用搜索 | 旧 action builder 是否可删 | `rg <old-builder>` | 无生产引用 |

## 回滚策略

按 report 子域回滚。某 builder 新路径失败，旧 action 导出继续作为默认，失败样本进入该子域测试。

## 结论记录

- 计划符合 `RefactorSkill.md`：不改变 report 行为，不隐藏业务变化，按 report 子域单点切换。

## 当前残余风险

- weeklyEnhancement 可能同时含增强、判断和渲染辅助，Phase 0 必须先拆概念再移动代码。

## 下一阶段入口

执行 Phase 0，只读生成 action root 文件到 report 子域、artifact、测试的映射表。

