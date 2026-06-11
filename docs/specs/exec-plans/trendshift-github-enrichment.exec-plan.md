# Trendshift / GitHub Enrichment 执行计划

## 文档状态

- 版本：`v0.2`
- 当前状态：`Superseded`
- 文档角色：历史计划归档，不再作为活跃执行入口。
- 承接关系：
  - Trendshift / GitHub enrichment 主体能力已由 [signal-filter-action-v0.2.exec-plan.md](signal-filter-action-v0.2.exec-plan.md#L1) 的 `Phase 1：Signal enrichment` 承接并完成 MVP 收口。
  - GitHub star 日增可信链路已由 [github-star-delta-trust-v0.1.exec-plan.md](github-star-delta-trust-v0.1.exec-plan.md#L1) 独立承接并完成。
- 保留原因：用于说明早期拆分思路，以及后续计划是如何吸收本计划范围的。

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | Trendshift / GitHub enrichment |
| 当前状态 | `Superseded` |
| 负责人 | Codex |
| 关联产品规格 | `docs/specs/product-specs/agent-trend-radar-product-spec.md` |
| 关联服务规格 | `services/signal-ingestion.md`、`services/scoring-engine.md`、`services/action-output.md` |
| 原始影响范围 | `src/signal/`、`src/filter/`、`src/__tests__/`、`data/raw/trendshift/` |
| 当前执行边界 | 不再单独推进；仅保留历史映射与验证记录 |

## 原始目标

补齐真实 engagement 数据，使评分不再主要依赖 agents-radar Markdown 中的自然语言线索，而是能结合 Trendshift 与 GitHub metrics 判断 star velocity、engagement 和 discussion persistence。

## 当前状态

本计划不再活跃。原因不是取消需求，而是需求已经被拆分并吸收到两个更合适的计划里：

- Trendshift parser、snapshot、source 状态、GitHub enrichment fallback/cache 等“主链路最小可运行”能力，已经并入总计划并完成。
- GitHub star 日增的可信度问题，后来被识别为独立的数据可信性课题，因此单独拆成 star delta trust 计划。

换句话说，这份文档已经完成了“早期范围澄清”的历史使命，但不再适合作为当前推进入口。

## 当前进度

- 计划形态：`Archived as Superseded`
- 原始四个阶段：不再按本文继续执行
- 范围承接情况：
  - Trendshift snapshot / parser：已落地
  - GitHub metrics enrichment：已落地基础版
  - GitHub star delta trust：已拆到独立计划并落地
  - 评分质量复查：已在总计划中完成 trust-first / anti-noise 收口

## 约束

这些约束作为历史决策仍然有效，并已被后续计划继承：

- 不得把 Trendshift 当前 HTML 结构写成不可变契约。
- 不得在网络失败时长程重试；失败后必须有明确降级路径。
- 不得把未知 metrics 编造成真实 `0`。
- 不得让 enrichment 失败阻断 agents-radar-only 本地闭环。
- 不得让 LLM 直接决定最终分数。

## 阶段进度

| 阶段 | 原始意图 | 当前状态 | 承接去向 |
| --- | --- | --- | --- |
| 阶段 1：Trendshift snapshot fixture | 保存并解析稳定 fixture | `Done elsewhere` | 已由总计划 Phase 1 落地 |
| 阶段 2：Trendshift parser | 提取 repo、stars、forks、issues、PR、history | `Done elsewhere` | 已由总计划 Phase 1 落地 |
| 阶段 3：GitHub metrics enrichment | 补 repo metrics，处理 rate limit | `Done elsewhere` | 基础版由总计划承接，star delta 可信链路由独立计划承接 |
| 阶段 4：评分质量复查 | 检查 high score 和 anomaly 是否更合理 | `Done elsewhere` | 已在总计划 Phase 2 / Phase 3 收口 |

## 已落地内容

- Trendshift snapshot fixture 与 parser 已落地。
- Trendshift live 失败时的 snapshot fallback 已落地。
- GitHub metrics 已具备 `api / html / cache / unavailable` 分层与审计写盘。
- Source 状态已统一为 `active / empty / failed / disabled`。
- enrichment 失败不会再阻断 daily 主链路。
- GitHub star 日增已升级为 `live / snapshot / signal / unavailable` 四层可信链路。

## 验证记录

| 时间 | 事实 | 结果 | 说明 |
| --- | --- | --- | --- |
| 早期草案阶段 | 本文曾作为 Trendshift / GitHub enrichment 的拆分草案 | 已完成历史角色 | 但未作为最终活跃计划继续推进 |
| 2026-04-26 | `signalCollection / githubMetrics / runSummary / cliWorkflow` 回归通过 | 通过 | 证明 source 状态、GitHub fallback 与观测链路已稳定 |
| 2026-04-26 | `run-daily -- --date 2026-04-26` | 通过 | 证明 enrichment 已能进入真实主链路 |
| 2026-04-27 | `verify-daily -- --date 2026-04-27` | `warn` | warning 主因收敛为 token / 环境，而非计划范围未落地 |
| 2026-04-27 | GitHub star delta trust 计划完成 | 已完成 | 本计划里最棘手的 star delta 可信性问题已由独立计划收口 |

## 验证矩阵

以下验证已由后续计划实际承接，不再要求在本历史计划下单独执行：

| 类型 | 验证内容 | 当前归属 |
| --- | --- | --- |
| 单元 | Trendshift fixture / parser | `signal-filter-action-v0.2` |
| 单元 | GitHub metrics / fallback / source notes | `signal-filter-action-v0.2` |
| 集成 | daily 主链路 + enrichment | `signal-filter-action-v0.2` |
| 可信链路 | GitHub star delta live / snapshot / signal | `github-star-delta-trust-v0.1` |

## 回滚策略

- 若需要查看早期范围来源，可回读本文，但不得再把它恢复成活跃计划。
- 若后续要继续增强 Trendshift 或 GitHub 数据质量，应新开 follow-up exec-plan，而不是在本文追加新阶段。
- 若出现历史描述与当前实现不一致，应以承接计划和最新验证记录为准。

## 结论记录

- 本计划是早期拆分草案，不再反映当前执行真相。
- 其核心范围已经被后续两个计划完整吸收：
  - `signal-filter-action-v0.2`
  - `github-star-delta-trust-v0.1`
- 因此它应继续保留为 `Superseded`，而不是误导为“仍待执行的活跃计划”。

## 下一阶段入口

None。

后续相关工作请直接进入更准确的计划：

- [signal-filter-action-v0.2.exec-plan.md](signal-filter-action-v0.2.exec-plan.md#L1)
- [github-star-delta-trust-v0.1.exec-plan.md](github-star-delta-trust-v0.1.exec-plan.md#L1)
