# 执行计划：最小闭环

## 目标

实现第一阶段：`Signal -> Score -> Daily Report`。

## 步骤

1. 实现 config loader。
2. 实现 agents-radar connector。
3. 实现 Trendshift snapshot/http connector 接口。
4. 实现 RawSignal normalizer 和 dedupe。
5. 实现 rules-only scoring engine。
6. 输出 ScoreBreakdown。
7. 生成 daily report。

## 验证

| 类型 | 验证 |
| --- | --- |
| 单元 | score components、normalization、config |
| 集成 | 使用 agents-radar 真实 digest 生成 daily dry-run |
| 回归 | rules-only 不依赖 LLM |
| 冒烟 | `run-daily --dry-run` |

