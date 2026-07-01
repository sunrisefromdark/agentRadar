# 执行计划：Web SSR 与静态页面分层解耦重构 v0.1

## 任务信息

- 版本：`v0.1`
- 当前状态：`Draft`
- 类型：增量解耦重构
- 对应 Skill：`docs/specs/agent-work/RefactorSkill.md`
- 目标工作量：`1 人 / 1 个短阶段起步`
- 主要现状：`app/visualConsole/ossPages.ts` 约 `2166` 行，SSR shell、route render、OSS 页面、文案和组件拼装混放。

## RefactorSkill 审核结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| Pain | `PASS` | SSR 页面和静态 OSS 页面继续堆叠会放大页面改动风险。 |
| Boundary | `PASS` | 只碰 SSR / static page 组织，不碰 client hydration 和业务 view model。 |
| Incremental path | `PASS` | 旧 `ossPages.ts` 等入口保留 wrapper，新 route 目录并行。 |
| Invariants | `PASS` | URL、SSR 输出基础结构、公开只读浏览入口不变。 |
| Evidence | `PASS` | SSR render tests、HTML snapshot / smoke、route diff。 |
| Rollback | `PASS` | 单 route wrapper 可指回旧实现。 |
| Delete condition | `PASS` | 旧 SSR 内部实现无生产引用后删除，只留兼容导出或移除。 |

## 目标

把 Web SSR 和静态页面按 shell / route / shared components / OSS 页面分层，避免所有路由继续挤在 `app/visualConsole` 的大文件中。

## 目标目录形态

```text
app/visualConsole/
  shell/
    document.ts
    navigation.ts
    assets.ts
    layout.ts
  routes/
    overview/render.ts
    projects/render.ts
    weekly/render.ts
    run-health/render.ts
    observer/render.ts
    knowledge-base/render.ts
  components/
    cards.ts
    tables.ts
    reader.ts
    filters.ts
    assistant-entry.ts
  oss/
    document.ts
    pages.ts
    projects.ts
    routing.ts
```

## 不变量

- SSR 不重新计算 score、weekly trend、observer ranking。
- 默认 `visual-console:web` 不引入 auth/db 前置条件。
- 现有 URL、query、导航入口不变。
- Client hydration 选择器合同不变。

## 当前状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 旧默认路径 | `ACTIVE` | `app/visualConsole/ossPages.ts`、现有 render 文件继续服务生产。 |
| 新并行路径 | `TODO` | `shell/routes/components/oss` 目录尚未建立。 |
| 切换点 | `TODO` | 每次只切一个 SSR route 或 OSS route。 |
| 删旧条件 | `TODO` | 旧 route render 无生产引用。 |

## 阶段进度

本计划内部按 Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 顺序执行；跨计划执行顺序以 `00-并行协作总控.md` 为准。


| Phase | 状态 | 任务 | 完成条件 |
| --- | --- | --- | --- |
| Phase 0：SSR 职责盘点 | `TODO` | 标注 shell、route、component、OSS 文档、文案块 | 有迁移清单和 wrapper 清单 |
| Phase 1：shell 分离 | `TODO` | 抽出 document/navigation/assets/layout | route render 不再重复 shell |
| Phase 2：route 目录 | `TODO` | overview/projects/weekly/run-health/observer/kb 各建目录 | 每个 route 有独立 render owner |
| Phase 3：shared components | `TODO` | reader/cards/tables/filters/assistant-entry 进入 components | SSR 组件不在 route 间复制 |
| Phase 4：OSS 页面分层 | `TODO` | OSS document/pages/projects/routing 拆分 | OSS 页面不复制主 SSR 组件 |
| Phase 5：删旧 wrapper | `TODO` | 引用清零后删除旧实现 | 大文件收缩为导出壳或被移除 |

## 已落地内容

- `2026-06-30`：仅建立计划，未改代码。

## 验证矩阵

| 文件位置或类型 | 验证内容 | 验证方式或命令 | 通过标准 |
| --- | --- | --- | --- |
| SSR routes | HTML 输出和路由状态 | `pnpm test:visual-console:web` | 退出码 0 |
| OSS pages | 静态页面与公开只读入口 | OSS render tests / snapshot | URL 和基础结构不变 |
| Shared components | 无跨 route 复制 | `rg` / structure review | 同一组件只有一个 owner |
| Hydration selectors | SSR 输出仍可被客户端接管 | client smoke / existing tests | 交互选择器不失效 |

## 回滚策略

每个 route 保留旧 wrapper。某 route 新实现失败，只回退该 route，不影响其他 route 分层。

## 结论记录

- 计划符合 `RefactorSkill.md`：不把业务裁决移入 SSR；按 route 单点切换，保留旧入口。

## 当前残余风险

- SSR HTML 可能被客户端脚本依赖，Phase 0 必须记录 hydration selector 合同。

## 下一阶段入口

执行 Phase 0，只读标注 `ossPages.ts` 和现有 render 文件的 shell / route / component / OSS 职责块。

