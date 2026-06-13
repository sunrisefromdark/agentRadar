# 设计文档索引

设计文档记录架构决策、边界划分、取舍与替代方案。它不是代码清单，而是解释“为什么这样设计”。

## 审核顺序

- 如果任务属于 `design doc review` 或 `design audit`，请先读 `docs/specs/design-docs/DesignDocument_ReviewSkill.md`。
- design-doc review 任务的默认顺序是：先读技能书，再看目标 design doc、需求分析、相关架构与项目规则，最后给出结论。
- design-doc review 任务的仓库级门禁由 `scripts/designReviewPreflight.ts` 和 `design-review-preflight.json` 提供。
- 在进入正式 design review 结论前，必须先通过 `npm run design-review:preflight`；统一入口可用 `npm run skills:preflight`。

## 当前文件

- `architecture-boundaries.md`：系统边界和架构取舍。
- `agent-enhancement-layer-and-weekly-trend-design.md`：冻结 Agent 增强消费层的五层语义、daily 个性化与风险复核边界，以及 weekly 趋势抽象结构。
- `agent-reach-external-discovery-and-evidence-design.md`：冻结 AgentReach 外部发现与补证信号层的 provider artifact、事件模型、daily / weekly 消费、降级审计与 V1 平台边界。
- `build-vs-fork-decision.md`：为什么独立新建项目，而不是直接改 agents-radar。
- `daily-report-freshness-readability-design.md`：daily report 的新鲜度状态、主榜单分层、fallback 降级与用户可读卡片设计。
- `historical-replay-integrity-design.md`：历史 daily / weekly backfill 的双运行模式、source 历史能力分级、归档/回执与独立验证设计。
- `natural-language-fuzzy-search-recommendation-design.md`：自然语言模糊搜索与推荐入口设计框架，冻结请求解释卡、主/次结果轨、有限口语白名单、冲突澄清门槛、结果契约与 rules-only 降级边界。
- `postgresql-auth-and-user-state-design.md`：PostgreSQL 认证与用户态隔离设计，冻结 GitHub OAuth + Email Magic Link、server session、`/preferences` / tracking 的按用户持久化，以及 CSRF / SSRF 等安全边界。
- `reuse-from-agents-radar.md`：哪些 agents-radar-system 模块可以直接搬运、改造复用或仅参考。
- `self-evolving-skill-tree-design.md`：冻结仓库内 Agent 自进化 Skill 的分层记忆、候选提炼、保守路由、生命周期治理与技能树物化规则。
- `signal-filter-action-version-design.md`：agent-trend-radar 的较完整版本设计规格，定义 Signal / Filter / Action 闭环、信号源优先级、评分判定、反噪声机制和行动输出。
- `trend-radar-overview-weekly-layout-refresh-v0.1.md`：Overview / Weekly 页面级布局补充设计，冻结总览判断主舞台、周视图编辑台、侧轨职责与六轴证据矩阵映射规则。
- `trend-radar-ui-v3-stage-redesign-design.md`：UI V3 舞台化重设计规格，冻结全局工作台语法、五路由舞台人格、`surface role` 组件契约与设计 token 演进边界。
- `trend-radar-visual-console-design.md`：可视化控制台设计规格，定义如何基于现有 daily/run-summary/KB/GitHub audit 产物做 local-first 的 UI 观察层。
- `trend-radar-ui-v2-visual-redesign-design.md`：UI V2.5 视觉重设计规格，冻结全局壳层、时间漫游、五视图人格、设计系统、动效、响应式与浏览器验收契约。
