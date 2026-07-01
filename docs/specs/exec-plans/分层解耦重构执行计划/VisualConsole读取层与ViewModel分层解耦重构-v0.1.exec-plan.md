# 执行计划：Visual Console 读取层与 ViewModel 分层解耦重构 v0.1

## 任务信息

- 版本：`v0.1`
- 当前状态：`Draft`
- 类型：增量解耦重构
- 对应 Skill：`docs/specs/agent-work/RefactorSkill.md`
- 目标工作量：`1 人 / 1 个短阶段起步`
- 主要现状：`src/visualConsole/build.ts` 约 `2220` 行，读取、状态、view model 组装、mapper、terminal render 辅助混放。

## RefactorSkill 审核结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| Pain | `PASS` | UI 读取层和业务 view model 混在一起，容易让页面层重新解释 artifact。 |
| Boundary | `PASS` | 只碰 `src/visualConsole` 读取 / model / mapper，不碰 Web SSR 和 Action 产物生成。 |
| Incremental path | `PASS` | 旧 `build.ts/readLayer.ts/render.ts` 保留入口，新 route model 并行。 |
| Invariants | `PASS` | latest/date、parse_error、not_found、empty、stale 状态不变。 |
| Evidence | `PASS` | visualConsole tests、route model tests、terminal/web smoke。 |
| Rollback | `PASS` | 单 route model 可指回旧 builder。 |
| Delete condition | `PASS` | 旧 build/render 重复逻辑引用清零。 |

## 目标

把 Visual Console 服务端消费面拆成 read、status、models、mappers、renderers、routes 六层，让 Web 和 terminal 消费同一结构化 view model，不在 UI 层重算业务语义。

## 目标目录形态

```text
src/visualConsole/
  read/
    artifactReaders.ts
    latestResolver.ts
    parseStatus.ts
  status/
    readStatus.ts
    emptyState.ts
    errors.ts
  models/
    overview.ts
    projects.ts
    weekly.ts
    runHealth.ts
    observer.ts
    knowledgeBase.ts
  mappers/
    scoreToProjectCard.ts
    weeklyToTrendView.ts
    observerToView.ts
  renderers/
    markdown.ts
    terminal.ts
  routes/
    overview.ts
    projects.ts
    weekly.ts
    runHealth.ts
    observer.ts
    knowledgeBase.ts
```

## 不变量

- 只读已落盘 artifact，不重算 score、ranking、weekly trend。
- `latest` 与 dated artifact 语义不变。
- parse_error、not_found、empty、stale 等状态继续可区分。
- Web 和 terminal 使用同一 view model 语义。

## 当前状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 旧默认路径 | `ACTIVE` | `build.ts/readLayer.ts/render.ts` 继续作为生产入口。 |
| 新并行路径 | `TODO` | read/status/models/mappers/renderers/routes 待建。 |
| 切换点 | `TODO` | 每次只切一个 route model。 |
| 删旧条件 | `TODO` | 旧 builder / mapper 无生产引用。 |

## 阶段进度

本计划内部按 Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 顺序执行；跨计划执行顺序以 `00-并行协作总控.md` 为准。


| Phase | 状态 | 任务 | 完成条件 |
| --- | --- | --- | --- |
| Phase 0：现状固定 | `TODO` | 盘点函数 owner、调用方、输出字段和测试 | 有 owner / caller / test 映射表 |
| Phase 1：read/status 分离 | `TODO` | 抽 artifactReaders、latestResolver、parseStatus、readStatus | 读取失败状态不变 |
| Phase 2：route model 分离 | `TODO` | overview/projects/weekly/runHealth/observer/kb 建 model builder | route model 可单测 |
| Phase 3：mapper 分离 | `TODO` | score/project/weekly/observer 转换进入 mappers | UI 不读 raw artifact 细节 |
| Phase 4：逐 route 切换 | `TODO` | 每次只切一个 route 到新 model | 对应 web/terminal 测试通过 |
| Phase 5：删旧 glue | `TODO` | 删除旧 build/render 重复逻辑 | 大文件收缩为兼容壳或移除 |

## 已落地内容

- `2026-06-30`：仅建立计划，未改代码。

## 验证矩阵

| 文件位置或类型 | 验证内容 | 验证方式或命令 | 通过标准 |
| --- | --- | --- | --- |
| read/status | latest、dated、parse_error、not_found | `vitest run src/__tests__/visualConsole*.test.ts` | 状态语义不变 |
| route model | overview/projects/weekly/runHealth/observer/kb | route-focused tests | model 输出稳定 |
| Web render | SSR 消费新 model | `pnpm test:visual-console:web` | 退出码 0 |
| Terminal smoke | terminal render | `pnpm visual-console -- --view overview --date latest` | 可读输出，无异常 |

## 回滚策略

按 route 切换。某 route 新 model 失败，仅该 route 回退旧 `build.ts` 路径；read/status 新模块保留并补失败 fixture。

## 结论记录

- 计划符合 `RefactorSkill.md`：固定现状、定义新 owner、并行 route model、逐 route 切换、引用清零删旧。

## 当前残余风险

- 当前 view model 被 Web、terminal、tests 多处隐式消费，Phase 0 必须先做调用方盘点。

## 下一阶段入口

执行 Phase 0，只读生成 `src/visualConsole` 函数 owner / 调用方 / 测试映射表。

