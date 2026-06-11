# 服务 Spec：LLM Semantic Classification

## 职责

LLM 只用于 semantic classification，帮助识别架构范式和能力标签。

## 允许

- 判断项目是否属于 agent runtime、infra、system、ordinary tool。
- 提取 memory、self-improving、skill、autonomy、MCP、sandbox 等语义标签。
- 输出分类置信度和证据短句。

## 输出契约

LLM 输出 MUST 是强类型结构，供规则层消费，而不是自由文本直接参与打分。

推荐最小输出形态：

```json
{
  "paradigm_class": "agent_runtime",
  "has_persistent_memory": true,
  "has_self_improving_loop": false,
  "has_skill_ecosystem": true,
  "autonomy_level": "medium",
  "has_governance_boundary": false,
  "evidence_snippets": ["mentions persistent memory", "describes tool ecosystem"],
  "confidence": 0.78
}
```

- 布尔字段、枚举字段和置信度字段 SHOULD 有固定 key。
- TypeScript 规则层 MUST 负责把这些字段映射到各组件分数。
- 如果 LLM 返回非结构化文本或非法 JSON，系统 MUST 将其视为 classification 失败，而不是自由解释后继续打分。

## 禁止

- 直接给项目总分。
- 覆盖数值指标。
- 编造 stars、forks、issues、PR。
- 在 rules-only 模式中成为必需依赖。
- 以长自由文本替代强类型 classification 结果。

## rules-only 模式

WHEN `llm.enabled=false`，THEN 系统 MUST 使用规则词典和结构化字段完成评分。

WHEN `llm.enabled=true`，THEN LLM 也只提供 classification 属性，不得绕过 TypeScript 规则层直接写入 `ScoreBreakdown`。
