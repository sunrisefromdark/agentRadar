# 服务 Spec：Storage 与增量更新

## 职责

Storage 层负责稳定落盘、增量更新、dry-run 和历史追踪。

## 路径契约

| 路径 | 内容 |
| --- | --- |
| `data/raw/` | 上游原始快照 |
| `data/normalized/` | RawSignal 和项目级归一化结果 |
| `data/scores/` | ScoreBreakdown JSONL |
| `data/reports/` | daily / weekly Markdown |
| `data/kb/` | knowledge card 和项目索引 |

## 增量 Key

- RawSignal：`source + repo_url + timestamp`
- Project：`repo_url + date`
- Score：`repo_url + date + config_hash`
- KB：`repo_url`

## dry-run

WHEN `--dry-run` 被设置，THEN 系统 MUST 不写持久文件，只输出将要写入的路径和摘要。

