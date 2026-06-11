# 服务 Spec：Scoring Engine

## 文档状态

- 版本：`v0.2`
- 目标：把 `NormalizedProject` 转换为可解释、可审计、可调权重的 `ScoreBreakdown`。
- 当前实现状态：rules-only 评分已落地；LLM semantic classification 尚未启用；GitHub/Trendshift 指标补全不足时会导致 engagement 分较低，这是预期降级。

## 责任范围

Scoring Engine 负责计算项目是否值得关注。它必须解释每个分数来源，不能只输出一个黑盒 total。

## 输入

- `NormalizedProject`
- `config.yaml` 中的 `weights`
- `config.yaml` 中的 `thresholds`
- 可选 semantic classification 结果（强类型 classification object）

## 输出

`ScoreBreakdown` MUST 包含：

- `total_score`
- `components`
- `verdict`
- `paradigm`
- `risks`
- `next_actions`
- `rules_only`

## 评分公式

```text
Score = w1 * star_velocity
      + w2 * engagement_score
      + w3 * architecture_shift
      + w4 * compounding_capability
      + w5 * autonomy_score
      + w6 * discussion_score
```

## 组件契约

| 组件 | 语义 | Evidence |
| --- | --- | --- |
| `star_velocity` | 日增长 / 周增长速度 | `daily_delta`、`weekly_delta`、threshold |
| `engagement_score` | forks + issues + PR，防止 fake star | forks、issues、PR、engagement ratio |
| `architecture_shift` | 是否属于 agent runtime / infra / system，而不是普通工具 | 分类标签、关键词、描述 |
| `compounding_capability` | 是否有 memory / self-improving / skill / plugin | 能力关键词和摘要 |
| `autonomy_score` | 是否减少 human-in-the-loop | autonomous、workflow、execution 等 evidence |
| `discussion_score` | 多源出现和持续出现 | source 列表、appearances |

## 规则

- 每个组件 MUST 输出 `name`、`score`、`weight`、`weighted_score`、`evidence`。
- 缺少证据时不得编造，应给低分并写明原因。
- `total_score` MUST 由组件加权结果计算。
- 权重 MUST 来自 `config.yaml`，并在 loader 中归一化。
- LLM 只能用于 semantic classification，不得直接写入最终 total。
- rules-only 模式 MUST 在无 LLM key 时仍可运行。
- 如果启用 LLM，Scoring Engine MUST 只消费强类型 classification 字段，不得消费自由文本结论来直接判定分数。
- `autonomy_score`、`compounding_capability`、`architecture_shift` 的最终分数 MUST 由 TS 规则层根据 structured evidence 计算。

## Fake Star 防护

如果 `star_velocity` 高但 forks/issues/PR 极低，`engagement_score` 不应高分，并且 `risks` SHOULD 输出 fake-star 或 hype 风险。

## 关键场景

### 场景：高增长但低互动

当项目日增 star 高于阈值，但 forks/issues/PR 很低时，系统 SHOULD 标记异常增长，同时把 engagement 分保持较低。

### 场景：多源持续出现

当项目来自 agents-radar 和 Trendshift，并在多天数据中持续出现时，系统 SHOULD 提高 discussion_score。

### 场景：rules-only

当 `llm.enabled=false` 时，系统 MUST 完成 scoring，且 `ScoreBreakdown.rules_only=true`。

### 场景：LLM 分类辅助

当 `llm.enabled=true` 时，系统 MAY 读取 classification object 作为附加 evidence；THEN `total_score` 仍 MUST 由权重和规则计算，而不是由 LLM 文本结论决定。

## 验证矩阵

| 文件位置 | 验证内容 | 验证方式 | 对应 Spec |
| --- | --- | --- | --- |
| `src/filter/scoring.ts` | 六个组件是否均输出 evidence | 单元测试 | 本文件「组件契约」 |
| `src/config.ts` | 权重读取和归一化 | 单元测试 | 本文件「规则」 |
| `src/__tests__/scoring.test.ts` | rules-only、高分、paradigm 输出、structured classification 映射 | 单元测试 | 本文件「关键场景」 |
| `data/scores/*.json` | total 是否来自 weighted sum | 冒烟检查 | 本文件「评分公式」 |
| `docs/specs/constraints/structure-tests.md` | score component 是否跨 config/spec/code/test 一致 | 结构测试 | 本文件「组件契约」 |
