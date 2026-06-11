# 执行计划：项目简介去同质化

## 文档状态
- 版本：`v0.1`
- 当前状态：`In Progress`
- 设计来源：
  - `docs/specs/design-docs/project-brief-dehomogenization-design.md`

## 任务信息

| 字段 | 内容 |
| --- | --- |
| 任务名称 | 项目简介去同质化 |
| 负责人 | Codex |
| 风险等级 | `Medium` |
| 影响范围 | `src/action/projectBriefs.ts`、`src/__tests__/actionOutput.test.ts` |

## 目标

在不改动排序、评分、freshness、`why_today_cn` 和 LLM 增强校验行为的前提下，把 `project_brief_cn` 的本地 fallback 生成逻辑改成“基于项目自身 facet 组合”，确保简介来自该项目自己的 `description / tags / evidence / repo semantics / paradigm`，而不是复用家族级整句模板。

## 实施步骤

1. 先为“同家族但不同项目证据必须产出不同简介”和“弱信息时补缺失项说明”补充失败测试。
2. 重构 `src/action/projectBriefs.ts`，把 family 的职责降为语义 hint，不再直接产出整句模板。
3. 增加 facet 提取、facet 排序、brief 组装和缺失维度提示。
4. 调整 specificity 校验，让它验证“是否落到项目自身 facet”，而不是只验证 family anchor。
5. 运行定向测试，再跑相关更广的回归测试。

## 验收标准

- 同属 `coding-agent` 或 `multi-agent-runtime` 的项目，不再默认复用同一句式骨架。
- brief 能回溯到各自项目的自身信息，而不是泛泛类别标签。
- 弱信息项目仍然会给出 best-effort 用途判断，并明确缺失项。
- 现有 noisy description 防护保持有效。
