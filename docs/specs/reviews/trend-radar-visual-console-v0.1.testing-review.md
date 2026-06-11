# Testing Result

## Summary（总结）

- 测试范围：`docs/specs/exec-plans/trend-radar-visual-console-v0.1.exec-plan.md`
- 目标：为 Visual Console 的只读消费边界、读取层、状态模型、5 个一级视图、跨视图钻取和降级路径设计完整测试方案。
- 覆盖判断：已按 ExecPlan 的 Phase 0-5、10 条验收标准、验证矩阵和残余风险拆成可执行测试项。
- 当前状态：本文档是测试设计稿；本次仅完成设计与映射，没有在本文档工作中实际运行 `visualConsole` 测试。

---

## ExecPlan Coverage（覆盖情况）

| ExecPlan Step | Test Case | Covered |
| --- | --- | --- |
| Phase 0.1-0.5 只读边界冻结 | artifact allow-list、禁止业务重算、模块依赖守护测试 | YES |
| Phase 1.1-1.3 读取层接口 | `getDailyReport/getWeeklyReport/getKbCard/...` 返回态测试 | YES |
| Phase 1.4 `latest` 快捷入口 | 解析成功、解析失败、历史日期不回退测试 | YES |
| Phase 1.5-1.6 顶层状态模型 | `failed -> not-judgeable -> stale -> degraded -> empty -> ready` 优先级测试 | YES |
| Phase 1.6 失败映射 | daily 缺失、run-summary 缺失、weekly audit 缺失、KB 缺失测试 | YES |
| Phase 1.7 上下文隔离 | daily / weekly 上下文不混用测试 | YES |
| Phase 2 跨视图只读对象 | `Run Snapshot / Weekly Snapshot / Project / KB Object` 组装测试 | YES |
| Phase 2 项目集合边界 | Projects 不扩新项目、weekly 只认显式 supporting projects 测试 | YES |
| Phase 2 透明字段展示 | `enhancement_status`、fallback、GitHub enrichment 状态测试 | YES |
| Phase 3 Overview | 首屏信任优先、Top Decisions 字段齐全测试 | YES |
| Phase 3 Projects | 列表字段、筛选维度和项目详情模块测试 | YES |
| Phase 3 Run Health | verify/source/audit 聚合与 recommended actions 测试 | YES |
| Phase 4 Weekly | 独立一级视图、无趋势周、弱信号周、audit 可选区块测试 | YES |
| Phase 4 KB | KB Index/Card Reader/Machine/Human/Linked Context 测试 | YES |
| Phase 4 钻取契约 | Overview -> Run Health、Weekly -> Project、Project -> KB 上下文继承测试 | YES |
| Phase 5 结构守护与回归 | UI 不重算业务结论、rules-only 可消费、weekly audit 缺失降级测试 | YES |

---

## Test Plan（测试计划）

### 1. 只读边界与读取层

| Test Target | Test Type | File to Add or Modify | Assertions | Failure Mode / Regression Protected |
| --- | --- | --- | --- | --- |
| artifact allow-list | 结构测试 | `src/__tests__/visualConsole.test.ts` | 控制台只读取 ExecPlan 允许的 artifact | 防止扩读非批准输入 |
| 不导入主业务重算模块 | 结构测试 | `src/__tests__/visualConsole.test.ts` | 不导入 `filter / signal / normalize` 计算链路 | 防止 UI 层重算评分或趋势 |
| 读取层返回态 | 单测 | `src/__tests__/visualConsole.test.ts` | `ok / not_found / parse_error / unsupported_context` 映射正确 | 防止错误被吞掉或误判为可读 |
| `latest` 解析 | 单测 | `src/__tests__/visualConsole.test.ts` | 成功时落具体日期 / 时间窗；失败时进入 `failed` | 防止静默回退到旧数据 |
| 历史日期不标 `stale` | 单测 | `src/__tests__/visualConsole.test.ts` | 显式历史请求且 artifact 匹配时不得判旧 | 防止历史视图误报异常 |

### 2. 顶层状态模型与失败映射

| Test Target | Test Type | File to Add or Modify | Assertions | Failure Mode / Regression Protected |
| --- | --- | --- | --- | --- |
| 状态优先级固定 | 单测 | `src/__tests__/visualConsole.test.ts` | `failed -> not-judgeable -> stale -> degraded -> empty -> ready` | 防止各视图自行解释优先级 |
| daily 缺失 | 集成 | `src/__tests__/visualConsole.test.ts`、`src/__tests__/cliWorkflow.test.ts` | Overview / Projects 为 `failed`，文案显式说明 daily 缺失 | 防止跳到 `latest` 掩盖缺失 |
| run-summary 缺失 | 集成 | `src/__tests__/visualConsole.test.ts` | Overview 为 `degraded`，Run Health 为 `failed`，项目仍可读 | 防止健康上下文缺失导致整站不可用 |
| weekly audit 缺失 | 集成 | `src/__tests__/visualConsole.test.ts` | Weekly 正文仍可读，但状态降级并显示“审计上下文缺失” | 防止把缺审计伪装成完整成功 |
| KB 缺失 | 单测 | `src/__tests__/visualConsole.test.ts` | 项目仍可展示，但 KB 入口必须显式缺失 | 防止“缺失”被误写成“没有沉淀” |
| 无趋势周 / 仅弱信号周 | 单测 | `src/__tests__/visualConsole.test.ts` | 不渲染伪造 core trends，显示保守语义 | 防止 UI 二次包装新趋势 |

### 3. 共享对象与视图结构

| Test Target | Test Type | File to Add or Modify | Assertions | Failure Mode / Regression Protected |
| --- | --- | --- | --- | --- |
| `Run Snapshot` 组装 | 单测 | `src/__tests__/visualConsole.test.ts` | 仅由 daily/run-summary/verify/enrichment audit 组成 | 防止 snapshot 混入额外推导结果 |
| `Weekly Snapshot` 组装 | 单测 | `src/__tests__/visualConsole.test.ts` | 仅由 weekly.md/weekly.audit/显式引用 daily-scores 组成 | 防止 weekly 重新归纳趋势 |
| `Project / KB Object` 边界 | 单测 | `src/__tests__/visualConsole.test.ts` | Projects 只展示 daily 已展示项目；weekly 只展示显式 supporting/weak signal 项目 | 防止扩张项目集合 |
| 透明字段展示 | 单测 | `src/__tests__/visualConsole.test.ts` | 每个主视图均显式显示日期、artifact 时间戳、enhancement_status、source / GitHub 状态 | 防止透明性信息被隐藏 |

### 4. Overview / Projects / Project Detail / Run Health

| Test Target | Test Type | File to Add or Modify | Assertions | Failure Mode / Regression Protected |
| --- | --- | --- | --- | --- |
| Overview 首屏结构 | 单测 | `src/__tests__/visualConsole.test.ts` | `Run Trust Summary` 与 `Source Health Summary` 先于榜单出现 | 防止 Overview 退化成排行页 |
| Top Decisions 字段齐全 | 单测 | `src/__tests__/visualConsole.test.ts` | 每项回显 `score/confidence/paradigm/evidence/risk/persistence` | 防止关键判断信息缺失 |
| Projects 列表字段 | 单测 | `src/__tests__/visualConsole.test.ts` | 字段完整，`matched_interest_topics` 和 enhancement context 可见 | 防止项目视图信息碎片化 |
| Projects 筛选边界 | 单测 | `src/__tests__/visualConsole.test.ts` | 筛选只基于 artifact 现有字段，不生成新标签 | 防止前端造分类 |
| Project Detail 模块齐全 | 单测 | `src/__tests__/visualConsole.test.ts` | 六个固定模块齐全，且从 weekly 进入时保留 `trend_key` | 防止详情页脱离原上下文 |
| Run Health 排障语义 | 集成 | `src/__tests__/visualConsole.test.ts` | verify/source/audit/fallback/recommended actions 按原语义展示 | 防止运维语义被内容语义覆盖 |

### 5. Weekly / KB / 钻取路径

| Test Target | Test Type | File to Add or Modify | Assertions | Failure Mode / Regression Protected |
| --- | --- | --- | --- | --- |
| Weekly 独立一级视图 | 集成 | `src/__tests__/visualConsole.test.ts` | Weekly 可独立打开，不依附 Overview 或文件查看器 | 防止周报视图退化 |
| Core Trend Cards 最小展示 | 单测 | `src/__tests__/visualConsole.test.ts` | 趋势名、摘要、证据、强度、下周是否继续跟踪、1-3 supporting projects | 防止周报卡片缺关键信息 |
| 弱信号周保守语义 | 单测 | `src/__tests__/visualConsole.test.ts` | 只显示 weak signals / watch next，不强补 core trends | 防止 UI 为凑版式失真 |
| Optional Audit Context Blocks | 单测 | `src/__tests__/visualConsole.test.ts` | 只引用已有核心趋势、弱信号、supporting projects | 防止 audit 块变第二解释器 |
| KB 机器区 / 人工区 | 单测 | `src/__tests__/visualConsole.test.ts` | 两个区块视觉可区分，Linked Context 保留来源 | 防止 KB 信息混层 |
| Overview -> Run Health | 集成 | `src/__tests__/cliWorkflow.test.ts` | 保留当前 daily 日期并定位 verify/source/audit | 防止跳转后换上下文 |
| Weekly -> Project Detail | 集成 | `src/__tests__/cliWorkflow.test.ts` | 保留 weekly 时间窗与 `trend_key` | 防止趋势来源丢失 |
| Project -> KB | 集成 | `src/__tests__/cliWorkflow.test.ts` | 保留来源上下文，并正确显示 KB 存在 / 缺失 | 防止 KB 入口断裂 |

### 6. 回归与执行顺序

| Test Target | Test Type | File to Add or Modify | Assertions | Failure Mode / Regression Protected |
| --- | --- | --- | --- | --- |
| UI 不重算业务结论 | 结构 / 回归 | `src/__tests__/visualConsole.test.ts` | 同一项目在多视图 `score/confidence/paradigm/persistence/risks` 一致 | 防止视图层改写业务事实 |
| `rules-only` 可消费 | 回归 | `src/__tests__/visualConsole.test.ts` | `rules-only` 模式仍可读，且至少降级展示 | 防止增强缺失导致界面崩掉 |
| `weekly.audit.json` 缺失正文仍可读 | 回归 | `src/__tests__/visualConsole.test.ts` | 正文可读但必须降级 | 防止 hard fail |
| CLI 冒烟 | 集成 / 冒烟 | `src/__tests__/cliWorkflow.test.ts` | `visual-console --view overview/projects/weekly/run-health/kb` 均可在 fixture 下运行 | 防止入口回归 |

### 7. 建议执行顺序

1. `npm run testing-skill:preflight`
2. `pnpm test -- visualConsole`
3. `pnpm test -- cliWorkflow visualConsole`
4. `pnpm typecheck`
5. `npm run visual-console -- --view overview --date <fixture-date>`
6. `npm run visual-console -- --view weekly --date <fixture-date>`

---

## Tests Added / Updated（测试变更）

- `src/__tests__/visualConsole.test.ts`
  - 补读取态、状态优先级、5 个一级视图、无趋势周、透明字段、结构守护和回归测试。
- `src/__tests__/cliWorkflow.test.ts`
  - 补 `visual-console` CLI 入口、跨视图钻取与缺失 artifact 降级链路。
- 如需拆分粒度：
  - 可按 `readLayer / statusModel / overview / projects / weekly / runHealth / kb / drilldown / regression` 分段组织 `describe` 块，但仍保持在现有 `visualConsole` 测试文件下优先。

---

## Execution Results（执行结果）

- Command: `Get-Content -Raw -Encoding UTF8 docs/specs/agent-work/TestingSkill.md`
  - Result: 已读取并按技能要求组织本文档。
- Command: `Get-Content -Raw -Encoding UTF8 docs/specs/exec-plans/trend-radar-visual-console-v0.1.exec-plan.md`
  - Result: 已提取只读边界、状态模型、视图结构、钻取契约和验证矩阵。
- Command: 其他测试命令
  - Result: 本文档阶段未执行；本文仅产出测试设计，不宣称通过。

---

## Coverage Gaps（覆盖缺口）

- 无阻塞性缺口。
- 实际执行时需要准备至少两组 fixture：
  - 一组完整链路 fixture，用于 overview / projects / weekly / run-health / kb 正常渲染。
  - 一组降级 fixture，用于 daily 缺失、run-summary 缺失、weekly audit 缺失、KB 缺失、弱信号周。
- 若后续 Visual Console 从 CLI 入口扩展到其他交互容器，需新增容器层测试，但不属于当前 ExecPlan。

---

## Violations（违规）

- 未发现超出当前 ExecPlan 的测试扩权。
- 本文没有把“前端容器升级”或“更多一级视图”写成测试目标，因为它们不在当前计划内。

---

## Final Assessment（最终评估）

- PASS（测试设计覆盖充分；执行状态待后续测试落地验证）

---

## Suggested Next Step（下一步）

- 先依据本文补强 `visualConsole` 与 `cliWorkflow` 相关测试，再用一组正常 fixture 和一组降级 fixture 跑完建议顺序，确保读层、状态层和跨视图语义同时被验证。
