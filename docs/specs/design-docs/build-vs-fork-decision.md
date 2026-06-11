# 设计文档：新建项目 vs 修改 agents-radar

## 结论

新建独立项目 `agent-trend-radar`。

## 原因

| 维度 | 修改 agents-radar | 新建 agent-trend-radar |
| --- | --- | --- |
| 职责边界 | digest 生产和趋势决策混在一起 | producer 和 decision engine 分离 |
| 数据状态 | 会把 scores、KB、history 混入 digest repo | 独立 `data/` 管理 |
| 评分演进 | 容易影响日报稳定性 | 可独立试验权重和阈值 |
| Harness | 需要复用但会加重原项目 | 可按 SDD 从零建立 |
| 风险 | 改坏现有日报链路 | 上游只读，风险低 |

## 取舍

代价是需要维护一个新项目和 connector；收益是边界清晰、可测试、可独立演进。

