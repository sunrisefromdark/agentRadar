# Spec / Harness 成熟化执行计划

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Spec / Harness 成熟化 |
| 当前状态 | `Done` |
| 负责人 | Codex |
| 关联规格 | `docs/specs/README.md`、`agent-work-spec.md`、`constraints/structure-tests.md` |
| 影响范围 | `docs/specs/`、`src/__tests__/specStructure.test.ts` |

## 目标

学习 `text2sq` 的通用 SDD/Harness 架构：文档分层、Agent 必读顺序、服务契约、失败模式、验证矩阵、执行计划进度账本和结构测试，而不是复制它的项目特定功能文档。

## 约束

- 不照搬 `text2sq` 的项目特定节点。
- 不引入与 agent-trend-radar 无关的功能 Spec，例如 Text2SQL、FalkorDB、memory policy、memory versioning。
- 保留通用架构模式：索引、系统地图、服务规格、执行计划、设计文档、约束、反馈回路。
- 活跃 exec-plan 必须有当前进度。

## 阶段进度

| 阶段 | 状态 | 完成证据 | 说明 |
| --- | --- | --- | --- |
| 审阅参考结构 | `Done` | 已对照 `text2sq/docs/specs` 的索引、服务 Spec、exec-plan、结构测试 | 学习结构，不复制业务内容 |
| 补强总索引 | `Done` | `docs/specs/README.md` 已更新 | 增加维护原则、当前状态、Agent 必读顺序 |
| 补强 Agent 作业规范 | `Done` | `agent-work-spec.md`、`agent-work/README.md` 已更新 | 增加 exec-plan 进度要求 |
| 补强服务规格 | `Done` | `signal-ingestion.md`、`scoring-engine.md`、`action-output.md` 已更新 | 增加文档状态、契约、失败模式、场景和验证矩阵 |
| 补强执行计划 | `Done` | `exec-plans/README.md`、`reuse-agents-radar-code.exec-plan.md` 已更新 | 增加当前进度、验证记录、残余风险和下一阶段入口 |
| 纠偏过拟合 | `Done` | 已删除 `memory-policy.md`、`memory-versioning.md` | 这些属于参考项目特定功能，不属于本项目通用 Harness |
| 加结构测试 | `Done` | `src/__tests__/specStructure.test.ts` 已新增 | 守护目录结构、exec-plan 进度和 score component 一致性 |

## 已落地内容

- `docs/specs/README.md`：升级为更完整的 Harness 索引和维护规则。
- `docs/specs/agent-work-spec.md`：加入活跃 exec-plan 的进度账本要求。
- `docs/specs/agent-work/README.md`：保留通用子规范索引，移除 text2sq 特定 memory 节点。
- `docs/specs/agent-work/runtime-routing.md`：保留为通用 Agent 工作流路由规范。
- `docs/specs/services/signal-ingestion.md`：升级为完整服务规格。
- `docs/specs/services/scoring-engine.md`：升级为完整服务规格。
- `docs/specs/services/action-output.md`：升级为完整服务规格。
- `docs/specs/constraints/structure-tests.md`：加入 exec-plan 进度账本结构规则。
- `src/__tests__/specStructure.test.ts`：新增结构守护测试。

## 验证记录

| 时间 | 命令 | 结果 | 说明 |
| --- | --- | --- | --- |
| 2026-04-23 | `Select-String` 扫描 `memory-policy`、`memory-versioning`、`FalkorDB`、`Text2SQL`、`QueryWeaver` | 通过 | 未发现参考项目特定残留 |
| 2026-04-23 | `corepack pnpm test` | 通过，`4` 个测试文件、`36` 个测试 | 新增结构测试通过 |
| 2026-04-23 | `corepack pnpm typecheck` | 通过 | TypeScript 编译检查通过 |

## 验证矩阵

| 类型 | 验证内容 | 命令或方法 | 对应 Spec | 通过标准 |
| --- | --- | --- | --- | --- |
| 单元 | 结构测试是否能发现缺失 Harness 节点 | `corepack pnpm test` | `constraints/structure-tests.md` | 测试通过 |
| 回归 | 不再要求 memory policy/versioning | `Select-String` + 结构测试 | `agent-work/README.md` | 无无关节点引用 |
| 冒烟 | TypeScript 测试文件可编译 | `corepack pnpm typecheck` | `constraints/structure-tests.md` | 无类型错误 |
| 文档审查 | 活跃 exec-plan 是否包含进度 | 人工审查 + 结构测试 | `agent-work-spec.md` | 包含当前状态、进度、验证、风险、下一步 |
| E2E | 不适用 | 本轮只改 Spec/Harness，不改用户运行链路 | 本文件 | 由既有 daily/weekly/KB 闭环验证覆盖 |

## 回滚策略

- 如果结构测试误伤正常文档演进，先调整结构测试规则，不删除进度账本要求。
- 如果某个 Spec 节点被证明是项目特定而非通用 Harness，删除节点并更新索引。
- 如果未来新增业务层 Spec，必须先确认它是否属于 agent-trend-radar 的系统语义，而不是参考项目遗留。

## 结论记录

- 最终实现了什么：当前 Spec 体系已从“目录骨架”升级为包含通用 Harness 索引、服务契约、执行计划进度、结构测试的可维护体系。
- 纠偏内容：删除误引入的 `memory-policy.md` 和 `memory-versioning.md`，明确不照搬参考项目特定功能。
- 还剩下什么 open question：是否需要把结构测试进一步扩展到所有 service Spec 的最小结构检查。
- 下一阶段入口：进入 `trendshift-github-enrichment.exec-plan.md`，补真实 Trendshift/GitHub 数据闭环。
