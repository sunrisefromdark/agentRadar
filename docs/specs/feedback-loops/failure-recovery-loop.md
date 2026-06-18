# 失败恢复

## External discovery failure recovery

- default missing input is `skipped` and must not block primary daily or weekly output.
- explicit input that is missing, unreadable, invalid JSON, or schema-invalid is `failed`.
- Weekly partial external aggregate windows must still allow weekly output while recording skipped and failed days.
- `verify-daily` fails unsafe public aggregate, missing audit for claimed external use, and external score contamination.

## 分级

| 等级 | 示例 | 处理 |
| --- | --- | --- |
| P0 | rules-only 失败、不可解释高分、dry-run 写文件 | 阻止合并 |
| P1 | Trendshift 临时不可用、weekly 抽象不足 | 降级 + 补测试 |
| P2 | 单个 digest 缺失、某字段为空 | 记录 warning |

## 恢复策略

- Trendshift 失败：使用 snapshot 或只运行 agents-radar source。
- agents-radar 某报告缺失：跳过该报告但保留来源缺失 evidence。
- LLM 失败：回到 rules-only。
- score 异常：输出 config_hash，允许重算。

