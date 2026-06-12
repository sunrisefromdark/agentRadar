# 执行计划索引

执行计划不是一次性 TODO，而是 Agent 的进度账本。任何代码、测试、数据产物或 Spec 行为发生变化后，相关 exec-plan 都必须同步更新当前状态、验证记录和下一阶段入口。

## 当前文件

| 文件 | 状态 | 用途 | 下一步 |
| --- | --- | --- | --- |
| `self-evolving-skill-tree-v0.1.exec-plan.md` | `Completed` | 为仓库内 Agent 工作层落地分层记忆、manual registry、project-facts、learned skill lifecycle、routing receipts 与技能树治理 | Phase 3 已完成；后续若要扩 allow-list、approval source 或 operator surface，必须新开 follow-up exec-plan |
| `trend-radar-ui-v3-stage-redesign-v0.1.exec-plan.md` | `Completed` | 为 `UI V3` 舞台化前端重设计落地 Page Frame、Surface Role Contract、五个一级路由舞台化、Dock/Reader 语法与验证矩阵 | 已完成实现与验证；后续如需推进 P1/P2 增强或治理既有 lint 质量债，另开 follow-up exec-plan |
| `trend-radar-ui-v2-layout-hierarchy-remediation-v0.1.exec-plan.md` | `Blocked` | 纠正 UI V2 中 `Overview` 卡片拼盘、`Weekly` 核心趋势半屏化、弱信号越级抢主舞台等信息层级与排版问题 | UI 实现与回归已完成；仓库级 `npm run lint` 仍被既有 quality gate 债务阻塞，若要全绿需单独治理 |
| `trend-radar-ui-v2-visual-redesign-v0.1.exec-plan.md` | `Completed` | 为 UI V2.5 视觉重设计落地统一壳层、Time Navigator、五视图人格、详情/reader 承载、状态/透明度系统与整体验证矩阵 | 如需承接新的上游 structured payload，再单开 follow-up exec-plan |
| `visual-console-content-and-detail-remediation-v0.1.exec-plan.md` | `Completed` | 修复 Visual Console 中项目介绍同质化/误导、详情承载区滚动回归，以及知识卡片阅读价值不足的问题，并把 daily/weekly 文案生成边界与浏览器承载修复收敛为单次可验证交付 | 已与当前设计、代码和验证记录同步；后续如需继续细化项目介绍语义，单开 follow-up |
| `trend-radar-visual-console-visual-refresh-v0.1.exec-plan.md` | `Proposed` | 为浏览器版 Visual Console 落地 2026-05-04 视觉改版补充设计，统一双主题 tokens、Bento 骨架、`兴趣方向` `Preference Card`、五视图美化一致性与响应式验收 | 进入 exec-plan review，通过后实施 |
| `trend-radar-visual-console-v0.1.exec-plan.md` | `Proposed` | 为 Trend Radar Visual Console 落地统一读取层、状态模型、5 个一级消费视图与跨视图钻取契约 | 进入 exec-plan review，通过后实施 |
| `agent-enhancement-layer-and-weekly-trend-v0.2.exec-plan.md` | `Completed` | 为 daily / weekly 报告落地 Agent 增强消费层、风险复核、显式个性化与 7 天周趋势抽象 | 已与当前设计、代码和验证记录同步；后续新增语义要求走补充记录或 follow-up |
| `report-output-remediation-v0.1.exec-plan.md` | `Proposed` | 修复当前 `daily / run-summary / verify-daily` 产物中 freshness source、项目分类、可读性和质检口径偏差 | 进入修复 review，通过后实施 |
| `ecosystem-focused-observer-v0.1.exec-plan.md` | `Proposed` | 为 `ecosystem-focused-observer-design.md` 落地独立长尾生态观察模块、observer artifacts / run-summary status，以及替换一级 `kb` 导航的 `observer` 工作台 | 进入 exec-plan review，通过后实施 |
| `project-search-system-redesign-v0.1.exec-plan.md` | `Proposed` | 为 `project-search-system-redesign-design.md` 落地双栈发现、16 个 must-cover 目录、mission scout/deep、coverage atlas、gap ledger、gap pressure、observer incubator 与新日报/控制台契约 | 进入 exec-plan review，通过后实施 |
| `daily-report-freshness-readability-v0.1.exec-plan.md` | `In Progress` | 落地 daily report 的实时发现优先、新鲜度状态首屏、主榜单/历史补充分层与最小偏好层 | 结合 `report-output-remediation-v0.1.exec-plan.md` 完成实现偏差修复后再收口 |
| `harness-bootstrap.exec-plan.md` | `Done` | SDD/Harness 初始目录搭建 | 由当前索引和结构测试继续守护 |
| `code-quality-governance-v0.1.exec-plan.md` | `Done` | 约束 if 分支膨胀、中文注释缺失、复杂度失控与缺少门禁的问题 | 已完成脚本门禁、CI 门禁与全仓阈值收口，后续仅按门禁持续维护 |
| `github-star-delta-trust-v0.1.exec-plan.md` | `Done` | 为 GitHub star 日增建立可信优先的 `live / snapshot / signal / unavailable` 四层链路 | 已完成落地；后续如需继续扩预算或 GraphQL 深化，应新开 follow-up |
| `minimum-loop.exec-plan.md` | `Superseded` | 最小闭环实现计划 | 已被 `reuse-agents-radar-code.exec-plan.md` 承接 |
| `reuse-agents-radar-code.exec-plan.md` | `In Progress` | 从 `agents-radar-system` 复用代码搭建 agent-trend-radar | 继续进入 Trendshift / GitHub enrichment |
| `signal-filter-action-v0.2.exec-plan.md` | `Done` | 将已批准的 Signal / Filter / Action 设计转为 phased implementation，并完成可运行 MVP 主链路 | 后续增强项改用独立 exec-plan 推进，不再继续堆叠在本计划内 |
| `spec-harness-maturation.exec-plan.md` | `Done` | 按通用 SDD/Harness 架构成熟化当前 Spec 体系 | 后续由结构测试守护 |
| `trendshift-github-enrichment.exec-plan.md` | `Superseded` | 补齐 Trendshift 解析、GitHub metrics 和真实 engagement | 已折叠为 `signal-filter-action-v0.2.exec-plan.md` 的 Phase 1 |

## 审核门禁

- 如果任务属于 `exec-plan review` / `exec-plan audit`，必须先读 `ExecPlan_ReviewSkill.md`，并先通过 `npm run exec-plan:review:preflight`。
- 如果任务属于“根据某份 exec-plan 实施代码落地”，必须先读 `docs/specs/agent-work/CodeImplementation_Skill.md`，并通过 `npm run code-implementation:preflight`。
- 如果任务属于“审核代码落地是否和某份 exec-plan 一致”，必须先读 `docs/specs/agent-work/codeReviewSkill.md`，并通过 `npm run code-review:preflight`。
- 如果任务属于测试补强或回归验证，必须先读 `docs/specs/agent-work/TestingSkill.md`，并通过 `npm run testing-skill:preflight`。
- 仓库级统一技能门禁入口是 `npm run skills:preflight`；未通过 gate 时，不应继续给出正式结论或实施结果。

## 活跃计划规则

每个活跃计划必须包含：

- 任务信息
- 目标
- 验收标准（Acceptance Criteria）
- 当前状态
- 阶段进度
- 已落地内容
- 验证记录
- 验证矩阵
- 回滚策略
- 结论记录
- 下一阶段入口

## 当前项目进度摘要

- 本地 agents-radar-only 闭环已经完成并写盘。
- `pnpm typecheck` 通过。
- `pnpm test` 通过。
- 已生成 `data/raw`、`data/normalized`、`data/scores`、`data/reports`、`data/kb`。
- `run-daily` 已有 run summary、source status、recommended actions 与 `verify-daily` 自检链路。
- 跨天 persistence、same-day dedupe 与 weekly growth 的时序行为已由集成测试守护。
- 代码质量治理已完成门禁收口，`quality:check` 与 `quality:gate` 均已通过。
- `signal-filter-action-v0.2` 已按 MVP 口径完成收口；当前仓库已具备可实测主链路。
- GitHub star 日增可信链路也已完成独立收口；后续增强应以新 exec-plan 继续推进，而不是回填已完成计划。
- daily report 的新鲜度与可读性重构已进入独立 exec-plan 设计评审阶段，当前尚未实施代码变更。
