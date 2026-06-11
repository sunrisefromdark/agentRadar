# 执行计划：代码质量治理 v0.1

## 文档状态
- 版本：`v0.1`
- 当前状态：`Done`
- 目标：为 Agent Trend Radar 建立一套可执行、可验收、可逐步落地的代码质量治理计划，优先解决：
  - `if` / `else if` 分支膨胀导致的“屎山式”复杂度
  - 缺少中文注释，业务语义难以维护
  - 规则散落、命名不统一、函数边界模糊
  - 缺少自动化质量门禁，导致质量只能靠人工感觉判断

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | 代码质量治理 v0.1 |
| 负责人 | Codex |
| 影响范围 | `src/filter/`、`src/signal/`、`src/action/`、`src/providers/`、`src/__tests__/`、`docs/specs/exec-plans/README.md` |
| 主要问题样本 | `src/filter/scoring.ts`、`src/providers/openai-compatible.ts`、`src/providers/index.ts`、`src/providers/anthropic.ts` |
| 交付物 | 代码质量规范 exec-plan、后续分阶段重构准则、验证矩阵 |

## 参考规范

本计划优先参考以下高质量开源规范，作为“约束来源”而不是“照搬全文”：

1. Google TypeScript Style Guide
   - https://google.github.io/styleguide/tsguide.html
   - 重点参考：命名、可读性、注释、模块边界、类型表达
2. Airbnb JavaScript Style Guide
   - https://github.com/airbnb/javascript
   - 重点参考：函数职责、条件分支可读性、解构、变量约束、模块组织
3. ESLint `complexity` 规则
   - https://eslint.org/docs/latest/rules/complexity
   - 重点参考：圈复杂度要有明确上限，不能靠主观感觉判断

## 当前问题判断

基于当前代码观察，问题不是“代码不能跑”，而是“长期维护成本已经开始变坏”：

1. `src/filter/scoring.ts` 明显承担了过多职责：
   - 规则判断
   - 证据拼装
   - 置信度裁剪
   - 风险文案
   - 下一步动作生成
   - trust 语义兜底

2. 条件分支过密：
   - 多个函数包含连续 `if / else if / if`
   - 分支既包含业务判断，又包含降级逻辑，又包含文案拼接
   - 使得“改一个规则，牵动三处语义”成为高概率事件

3. 注释体系不足：
   - 目前大多数业务代码缺少中文注释
   - 尤其是评分、降噪、trust-first 这类“为什么这么做”非常依赖领域背景
   - 没有注释时，新人只能读条件分支猜语义

4. 自动化约束不足：
   - 当前有测试和 typecheck，但没有把复杂度、函数长度、注释要求、模块边界纳入门禁
   - 导致“代码能跑”与“代码好维护”之间缺一道质量闸门

## 治理原则

后续治理统一遵循以下原则：

1. 先拆职责，再谈美化。
   - 先消掉职责耦合和条件堆叠，再谈格式层面的整洁。

2. 先让业务规则显式化，再让实现简洁化。
   - 对评分、trust、降噪这种领域规则，优先抽成命名清晰的规则函数、规则表或 policy 层。

3. 中文注释只写“为什么”，不写“这行代码在做什么”。
   - 例外：复杂数据结构、跨阶段状态语义、反直觉降级逻辑，必须写中文注释。

4. 规则代码优先可测试、可替换、可审计。
   - 评分规则不能继续堆在一个超长文件里靠顺序隐式生效。

5. 不一次性大爆炸重写。
   - 用 phased refactor 逐段替换，保证主链路始终可运行。

## 质量规范

### 1. 模块职责规范

1. 单文件只负责一个主要职责。
   - `scoring.ts` 这类文件后续必须拆分为：
     - 基础度量函数
     - 组件评分函数
     - 置信度 / trust gating
     - 风险与动作文案
     - 汇总 orchestration

2. Provider 层只负责“协议适配”和“错误语义转换”。
   - 不应混入过多业务判断。

3. Action 层只负责“渲染与表达”。
   - 不应再次做复杂评分判断。

### 2. 函数复杂度规范

1. 默认函数圈复杂度上限：`10`
   - 超过即必须拆分，除非有明确豁免说明。

2. 默认函数长度上限：`60` 行
   - 超过后必须拆子函数或提炼数据结构。

3. 单个函数内禁止同时承担这三类责任中的两类以上：
   - 业务判定
   - 数据变换
   - 文案渲染

4. 连续 `if / else if` 超过 `4` 个分支时，优先改为：
   - lookup table
   - strategy map
   - policy function list
   - 显式 rule object 数组

### 3. 注释与命名规范

1. 核心业务函数必须有中文注释，解释“为什么存在”和“边界语义”。

2. 以下场景强制写中文注释：
   - trust-first scoring
   - fallback / degrade 逻辑
   - persistence 语义
   - anti-hype / anti-noise 规则
   - 历史 artifact 兼容逻辑

3. 注释风格：
   - 优先块注释，放在复杂逻辑上方
   - 不写废话注释
   - 注释描述“为什么”与“约束”，不是逐句翻译代码

4. 命名要求：
   - 布尔函数统一用 `is/has/can/should`
   - 规则函数统一用 `infer/compute/build/validate`
   - 禁止含糊命名如 `handleData`, `doStuff`, `processThing`

### 4. 规则表达规范

1. 评分规则优先数据化，而不是继续堆 `if`。
   - 能表驱动的尽量表驱动
   - 能规则对象化的尽量规则对象化

2. 文案生成与评分判定分离。
   - `score` 负责产出结构化事实
   - `report` / `summary` 负责把事实转成中文文案

3. 降级逻辑必须显式可见。
   - 不能把 “unavailable -> 0 -> 低分” 这种隐式污染藏在普通分支里

### 5. 工具门禁规范

建议逐步引入以下自动化门禁：

1. ESLint complexity
   - 对核心目录启用复杂度检查

2. ESLint max-lines-per-function 或等价规则
   - 对超长函数做硬告警

3. 注释缺失检查
   - 先做人审规则，后续再考虑自定义 lint

4. PR / 提交前验证
   - `typecheck`
   - `tests`
   - `lint`
   - 关键 CLI 冒烟测试

## 非目标

本计划当前不做以下事情：

1. 不把所有文件一次性重写成所谓“完美架构”。
2. 不为追求模式而模式化。
3. 不在没有测试护栏前大规模迁移评分逻辑。
4. 不把“中文注释”误解成“每一行都要加注释”。

## 分阶段计划

### Phase 0：基线审计

目标：
- 建立可量化的“质量现状”

任务：
1. 统计核心文件的函数长度、圈复杂度、导出函数数量。
2. 标出第一批热点文件：
   - `src/filter/scoring.ts`
   - `src/signal/githubMetrics.ts`
   - `src/action/runSummary.ts`
   - `src/providers/*`
3. 建立“允许暂时保留”的技术债清单，避免重构范围失控。

验收：
1. 形成热点文件排行榜。
2. 每个热点文件至少写清楚：
   - 为什么复杂
   - 应先拆哪块
   - 哪些测试必须先补

### Phase 0 完成记录

已完成：

1. 新增脚本化质量审计：
   - `scripts/qualityAudit.ts`
   - `corepack pnpm quality:audit`
   - `corepack pnpm quality:check`
2. 新增质量审计产物目录：
   - `docs/specs/quality-audits/README.md`
   - `docs/specs/quality-audits/code-quality-baseline-2026-04-26.{md,json}`
3. 新增面向 reviewer 的项目专用规则补充：
   - `docs/specs/agent-work/codeReviewSkill.md`
   - 明确要求 reviewer 结合 `quality:audit` / `quality:check` 与本 exec-plan 做客观审查

本轮脚本化基线结果：

1. 复杂度最高的生产函数是 `src/filter/scoring.ts:inferConfidence`，复杂度 `42`。
2. 第二热点是 `src/signal/rawSignalSchema.ts:validateRawSignal`，复杂度 `30`。
3. 第三热点是 `src/action/runSummary.ts:recommendedActions`，复杂度 `25`。
4. 最大生产长函数是 `src/signal/index.ts:collectRawSignalsDetailed`，长度 `148` 行。
5. 缺少中文注释的热点文件共有 `6` 个：
   - `src/filter/scoring.ts`
   - `src/action/runSummary.ts`
   - `src/signal/githubMetrics.ts`
   - `src/providers/openai-compatible.ts`
   - `src/providers/index.ts`
   - `src/providers/anthropic.ts`

Phase 0 结论：

1. 代码质量问题已经被脚本客观识别，不再依赖 LLM 主观判断。
2. 第一优先级治理对象应维持为：
   - `src/filter/scoring.ts`
   - `src/action/runSummary.ts`
   - `src/signal/index.ts`
   - `src/signal/rawSignalSchema.ts`
3. Provider 文件当前复杂度不高，但因为缺少中文注释，仍应纳入首批整理。

### Phase 1：规则层拆分

目标：
- 优先治理 `scoring.ts` 这种 if 密集核心文件

任务：
1. 把 `scoring.ts` 拆成多个职责清晰的模块。
2. 把 trust / confidence gating 抽成独立 policy。
3. 把风险文案、建议动作与纯评分逻辑分离。
4. 为复杂业务规则补中文注释。

验收：
1. `scoring.ts` 主文件长度显著下降。
2. 单函数复杂度大幅收敛。
3. 不降低当前测试覆盖。
4. 输出行为与现有主链路保持兼容。

### Phase 1 当前进展

已完成：

1. 已将原 `src/filter/scoring.ts` 拆分为 4 个职责文件：
   - `src/filter/scoringShared.ts`
   - `src/filter/scoreComponents.ts`
   - `src/filter/confidencePolicy.ts`
   - `src/filter/projectNarrative.ts`
2. `src/filter/scoring.ts` 已收敛为薄 orchestration 层，只负责：
   - 组装 component scores
   - 调用 anti-noise / confidence policy
   - 汇总 trust / paradigm / risks / next actions
3. 已为评分入口层、confidence policy、共享事实层补充中文注释，明确 trust-first 与 anti-hype 的边界语义。
4. 已为 provider 热点文件补充中文注释：
   - `src/providers/openai-compatible.ts`
   - `src/providers/index.ts`
   - `src/providers/anthropic.ts`
5. 已为剩余热点文件补充中文注释：
   - `src/action/runSummary.ts`
   - `src/signal/githubMetrics.ts`

当前结果：

1. `src/filter/scoring.ts` 已不再是复杂度热点主文件。
2. 质量审计中“缺少中文注释的热点文件”已从 `6` 降到 `0`。
3. 评分相关测试、summary 测试、verification 测试、action output 测试与 spec 结构测试均通过。

当前残留问题：

1. 复杂度热点已经从“单文件屎山”转移为更明确的独立 policy / narrative 函数：
   - `src/filter/confidencePolicy.ts`
   - `src/filter/projectNarrative.ts`
2. `scoreArchitectureShift` 仍是长函数，但复杂度已经压在阈值内，后续可继续表驱动化。
3. `quality:check` 仍然不会通过，因为仓内还有 `runSummary.ts`、`signal/index.ts`、`rawSignalSchema.ts` 等历史热点未治理完。

### Phase 2：Provider 与 Connector 清理

目标：
- 清理协议适配层的边界和错误语义

任务：
1. 统一 provider 接口风格。
2. 把网络错误、认证错误、限流错误显式分类。
3. 为 GitHub / LLM provider 的关键降级路径补中文注释。

验收：
1. provider 层不再混入评分或业务表达逻辑。
2. 错误分类清晰，summary 可直接消费。

### Phase 2 当前进展

已完成：

1. 新增统一 provider 错误语义层：
   - `src/providers/providerErrors.ts`
   - 显式分类 `auth / rate_limit / timeout / network / invalid_request / empty_response / response_shape / unknown`
2. 已让 provider 层统一抛出 `ProviderCallError`：
   - `src/providers/openai-compatible.ts`
   - `src/providers/anthropic.ts`
3. 已在 provider 对外出口统一导出错误工具：
   - `src/providers/types.ts`
   - `src/providers/index.ts`
4. 已让 `src/llm.ts` 改为消费 provider 归一化后的错误语义，不再依赖 `String(error).includes("429")` 这类脆弱判断。
5. 已让 `src/llmClassification.ts` 日志保留 provider 错误分类结果，避免 classification 失败时只剩一串 SDK 原始错误文本。
6. 已扩展 `src/__tests__/providers.test.ts`，覆盖：
   - empty response
   - response shape mismatch
   - rate limit classification
   - auth classification

当前结果：

1. provider 层已经更接近“协议适配 + 错误语义转换”的单一职责。
2. `llm.ts` 的重试策略现在建立在显式错误类型上，而不是字符串猜测。
3. 热点文件中文注释继续保持完整，`quality:audit` 中“缺少中文注释的热点文件”仍为 `0`。

当前残留问题：

1. provider / connector 层的 Phase 2 残留热点已完成治理：
   - `src/providers/providerErrors.ts` 当前 `max_complexity=5`
   - `src/signal/index.ts` 当前 `max_complexity=9`
   - `src/signal/rawSignalSchema.ts` 当前 `max_complexity=6`
   - `src/signal/trendshiftConnector.ts` 当前 `max_complexity=7`
2. Phase 2 已不再以 provider / connector 为主要阻塞点。
3. 下一批质量热点已转移到：
   - `src/action/runSummary.ts`
   - `src/action/dailyVerification.ts`
   - `src/filter/confidencePolicy.ts`
   - `src/filter/projectNarrative.ts`
   - `src/config.ts`

### Phase 2 Connector Follow-up

本轮继续完成了 Phase 2 剩余的 connector 清理，重点是把“主流程编排”和“字段校验 / fallback 细节”彻底拆开。

已完成：

1. `src/signal/index.ts`
   - 将 `collectRawSignalsDetailed()` 拆成主编排 + primary sources + schema/watchlist + GitHub enrichment 多个子流程。
   - 当前质量审计结果：`max_complexity=9`，已低于阈值。
2. `src/signal/rawSignalSchema.ts`
   - 将逐字段串行校验拆成一组小型 `ensure*` 规则函数。
   - 当前质量审计结果：`max_complexity=6`，已低于阈值。
3. `src/signal/trendshiftConnector.ts`
   - 将 dry-run / snapshot / HTTP / empty-live-fallback 路径拆成独立 helper。
   - 当前质量审计结果：`max_complexity=7`，已低于阈值。

验证记录：

1. `npm run typecheck`
2. `npm run test -- signalCollection rawSignalSchema trendshiftConnector specStructure`
3. `npm run quality:audit -- --date 2026-04-27`

结果说明：

1. 本轮关闭了 Phase 2 剩余的 connector 热点，不再由 `signal/index.ts`、`rawSignalSchema.ts`、`trendshiftConnector.ts` 占据优先级。
2. `quality:check` 仍不会全绿，但失败焦点已稳定转移到 action/filter/config 层，而不是 connector / provider 层。

### Phase 3：门禁落地

目标：
- 把规范变成自动约束

任务：
1. 引入复杂度 lint。
2. 引入函数长度或等价告警。
3. 在 CI 或本地脚本里加入质量检查入口。

验收：
1. 新增复杂函数会被自动告警。
2. 主链路验证不受影响。

### Phase 3 当前进展

已完成：

1. 将 `scripts/qualityAudit.ts` 升级为双模式脚本：
   - `quality:check`
     - 严格模式，直接反映“全仓距离理想状态还有多远”
   - `quality:gate`
     - 门禁模式，基于历史债务预算阻止新增回归
2. 新增历史债务预算文件：
   - `docs/specs/quality-audits/quality-gate.json`
   - 明确记录当前允许保留的复杂函数与长函数预算
3. 新增本地与 CI 入口：
   - `npm run quality:gate`
   - `npm run quality:ci`
   - `.github/workflows/quality-gate.yml`
4. 修正热点文件中文注释门禁遗漏：
   - `src/action/dailyVerification.ts`

当前结果：

1. `quality:gate` 已可通过，说明脚本门禁已经具备实用性，不再只是 Phase 0 的审计工具。
2. `quality:ci` 已可通过，说明类型检查与门禁组合入口已可直接挂到 CI。
3. `quality:check` 已可通过，说明当前仓库已经达到了同一套阈值下的严格标准。

验证记录：

1. `npm run typecheck`
2. `npm run quality:gate`
3. `npm run quality:ci`
4. `npm run quality:check`
5. `npm run test -- specStructure`

### 收口结果

已完成：

1. 继续治理 action / filter / config / normalize / GitHub metrics 剩余热点：
   - `src/action/runSummary.ts`
   - `src/action/dailyVerification.ts`
   - `src/filter/confidencePolicy.ts`
   - `src/filter/projectNarrative.ts`
   - `src/filter/scoreComponents.ts`
   - `src/config.ts`
   - `src/normalize.ts`
   - `src/signal/githubMetrics.ts`
   - `src/cli.ts`
   - `src/signal/trendshiftParser.ts`
2. `quality:check` 已通过。
3. `quality:gate` 已通过。
4. `quality-gate.json` 中的历史债务预算已清零，说明当前门禁不再依赖临时豁免。

最终验证：

1. `npm run typecheck`
2. `npm run test -- scoring githubMetrics config normalize runSummary dailyVerification specStructure`
3. `npm run quality:check`
4. `npm run quality:gate`

最终结论：

1. 这份代码质量治理 exec-plan 已经完成从“人工 review 约束”到“脚本门禁 + CI 门禁”的闭环。
2. 当前仓库在既定阈值下已无复杂度、函数长度、热点中文注释缺失的超标项。

## 验收标准

本计划进入“已落地”至少需要满足：

1. 核心热点文件完成第一轮职责拆分。
2. `scoring.ts` 不再承担评分、置信度、风险文案、动作文案四种职责的混合实现。
3. 核心领域逻辑具备必要中文注释。
4. 至少一类复杂度门禁已自动化。
5. 重构前后 `run-daily` 与 `verify-daily` 行为无主链路回归。

## 验证矩阵

| 类型 | 验证内容 | 方法 | 通过标准 |
| --- | --- | --- | --- |
| 静态 | 类型检查 | `pnpm typecheck` | 无类型错误 |
| 静态 | 复杂度检查 | `pnpm lint` 或新增 quality script | 超阈值函数可被识别 |
| 回归 | 评分链路 | `pnpm test -- scoring runSummary dailyVerification` | 输出不回归 |
| 集成 | daily 主链路 | `pnpm run-daily -- --date <date>` | 主链路稳定完成 |
| 集成 | daily 自检 | `pnpm verify-daily -- --date <date>` | 自检结果符合预期 |

## 风险与回滚

1. 最大风险是“边拆边改规则”，导致质量治理变成行为变更。
   - 回滚策略：先冻结规则语义，只拆结构，不改分数口径。

2. 第二个风险是“拆得太碎”，读起来比现在更难找。
   - 回滚策略：模块化以职责为边界，不机械按文件行数切碎。

3. 第三个风险是“注释写太多太空”。
   - 回滚策略：只保留能解释领域语义和边界条件的中文注释。

## 审核问题

这份计划在进入实现前，建议你重点审核这 4 点。我已审核

1. 接受把 `scoring.ts` 作为第一优先级治理对象。
2. 接受“核心业务逻辑必须有中文注释”的硬规范。
3. 接受引入复杂度门禁，而不是继续只靠人工 code review。
4. 接受本轮先做结构重构，不主动改评分口径。

## 下一步入口

如果这份 exec-plan 审核通过，下一步就进入：

1. 先做 Phase 0 基线审计。
2. 给出热点文件复杂度清单。
3. 再提交第一轮 `scoring.ts` 拆分实施方案，而不是直接大改全仓。

## Phase 2 Review Follow-up

本轮根据外部 reviewer 的反馈，对 Phase 2 做了收口修复，重点不是新增能力，而是补齐“分类语义已经定义，但调用方没有真正消费”的落差。

已完成：

1. `src/llm.ts` 已从只重试 `rate_limit`，改为统一消费 `isRetryableProviderError()`。
   - 这意味着 `timeout / network / rate_limit` 现在都会走同一套显式重试路径。
   - `llm` 层不再把 `retryable` 当作死 metadata。
2. `src/providers/providerErrors.ts` 已改为“小谓词 + 规则表”结构。
   - `classifyProviderError()` 不再是 Phase 2 新引入的复杂度热点。
   - 最新 `quality:audit` 结果显示该文件 `max_complexity=5`，已低于脚本阈值。
3. 已补回归测试：
   - `src/__tests__/llm.test.ts`：验证 retryable 错误会重试，non-retryable 错误不会重试。
   - `src/__tests__/providers.test.ts`：补充 `timeout / network` 分类语义断言。

验证记录：

1. `npm run typecheck`
2. `npm run test -- llm providers specStructure`
3. `npm run quality:audit -- --date 2026-04-27`
4. `npm run quality:check`
   - 结果仍按预期失败，但失败热点已不再包含 `src/providers/providerErrors.ts`，说明本次修复确实关闭了 reviewer 指出的第二个问题，而不是把热点留在原地。
