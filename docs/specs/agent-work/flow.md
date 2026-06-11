# Agent 作业流程

## 下钻规则

- Signal 任务优先读 `services/signal-ingestion.md`。
- Normalization 任务优先读 `services/normalization.md`。
- Score 任务优先读 `services/scoring-engine.md`。
- LLM 分类任务优先读 `services/llm-classification.md`。
- Action 输出任务优先读 `services/action-output.md`。
- Storage 任务优先读 `services/storage-incremental.md`。
- CLI 任务优先读 `services/cli-runtime.md`。

## 作业理解模板

动手前 SHOULD 写清：

- 本次属于 Signal、Filter 还是 Action。
- 影响哪个稳定数据模型。
- 是否会改变 score 语义。
- 是否影响 rules-only 模式。
- 如何验证 explainability。

