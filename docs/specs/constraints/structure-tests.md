# 结构测试规范

## 目标

结构测试不是功能测试，而是检查 Spec、目录和关键契约是否还在。它的作用是让 Agent 和人类都能快速发现 Harness 漂移。

## 目录级检查

- `docs/specs/` 必须存在。
- `system-spec.md` 必须存在。
- `agent-work-spec.md` 必须存在。
- `agent-work/` 必须存在，并包含子规范目录索引。
- `agent-work/README.md` 必须存在，并作为子规范入口索引。
- `agent-work/runtime-routing.md` 必须存在，用于约束 Agent 何时回到总地图、何时只读局部节点。
- `product-specs/` 必须存在并包含至少一个产品规格。
- `services/` 必须存在并包含核心服务规格。
- `exec-plans/`、`design-docs/`、`constraints/`、`feedback-loops/` 必须存在。

## 内容级检查

### 服务规格最小结构

每个服务规格 SHOULD 至少包含：

- 文档状态。
- 责任范围或职责。
- 输入。
- 输出。
- 契约。
- 失败模式。
- 关键场景。
- 验证矩阵。

### 产品规格最小结构

每个产品规格 SHOULD 至少包含：

- 用户画像或用户结果。
- 场景矩阵。
- 验收判据。
- 非目标。
- 失败标准。

### 执行计划最小结构

每个执行计划 SHOULD 至少包含：

- 任务信息。
- 目标。
- 约束。
- 当前状态。
- 阶段进度。
- 已落地内容或结论记录。
- 验证记录或验证矩阵。
- 回滚策略。
- 下一阶段入口或后续跟进事项。

### 验证矩阵标准

所有验证矩阵 SHOULD 同时包含以下列：

- 文件位置或类型。
- 验证内容。
- 验证方式或命令。
- 对应 Spec。
- 通过标准；如果未写通过标准，必须在文字中说明。

## 项目专属一致性检查

### Score Component 一致性

检查以下位置是否包含同一组组件：

- `config.yaml` 的 `weights`。
- `docs/specs/services/scoring-engine.md`。
- `src/filter/scoring.ts`。
- `src/__tests__/scoring.test.ts`。

### CLI 命令一致性

检查以下位置是否同步：

- `package.json` scripts。
- `docs/specs/services/cli-runtime.md`。
- `README.md`。
- `src/cli.ts`。

### Source Connector 一致性

新增 source 时必须出现在：

- `config.yaml`。
- `docs/specs/services/signal-ingestion.md`。
- 对应 connector。
- 对应 parser 或 dry-run 测试。

### LLM 边界

检查实现中不得存在由 LLM 直接写入 `ScoreBreakdown.total_score` 的路径。

检查 `llm-classification` 对应实现是否以强类型字段或等价结构为输出边界，而不是把自由文本直接喂给评分器。

### KB 人工区保护

检查 `knowledgeCard` 相关 spec、exec-plan 与测试中是否明确存在“机器区 / 人工区”或等价 protected section 契约。

### 时序与重入

检查 normalization、scoring、action 的 spec 和测试中是否覆盖跨天 merge、persistence 与 `build-kb` 重入更新场景。

### Schema 与语义防毒分层

检查 Signal Spec 与 exec-plan 中是否区分：

- schema 校验：字段缺失、类型错误、非法枚举。
- 语义防毒：未知值被错填为 `0`、样本不足、低置信数据降级。

### Exec-plan 进度账本

活跃 exec-plan 必须记录：

- `当前状态`。
- `阶段进度`。
- `验证记录`。
- `当前残余风险` 或 `残余风险`。
- `下一阶段入口`。

## 漂移检查

- 新增 source 但没有对应 Signal Spec 时，应当标记为漂移。
- 新增 score component 但没有更新 config/spec/code/test 时，应当标记为漂移。
- 新增 report 但没有产品场景和 Action Spec 时，应当标记为漂移。
- 新增 CLI 命令但没有进入 README 和 CLI Runtime Spec 时，应当标记为漂移。
- 新增作业流程但没有进入 `agent-work-spec.md` 或 `agent-work/` 子规范时，应当标记为漂移。
- 修改代码但没有更新活跃 exec-plan 进度时，应当标记为漂移。

## 建议的结构测试落点

| 文件位置 | 验证内容 | 验证方式 | 对应 Spec |
| --- | --- | --- | --- |
| `src/__tests__/specStructure.test.ts` | 目录是否包含 system / agent-work / product / service / exec-plan / design / constraints / feedback 分层 | 结构测试 | `docs/specs/README.md` |
| `src/__tests__/specStructure.test.ts` | 活跃 exec-plan 是否包含当前状态、阶段进度、验证记录和下一阶段入口 | 结构测试 | 本文件「Exec-plan 进度账本」 |
| `src/__tests__/specStructure.test.ts` | Score components 是否在 config/spec/code 中一致 | 结构测试 | `docs/specs/services/scoring-engine.md` |
| `src/__tests__/specStructure.test.ts` | LLM 边界、KB 人工区保护、时序重入、schema/语义防毒分层是否已写入 spec | 结构测试 | 本文件「LLM 边界」「KB 人工区保护」「时序与重入」「Schema 与语义防毒分层」 |
