# 服务 Spec：Normalization

## 职责

Normalization 层负责把多个 RawSignal 合并为项目级视图，并保留来源证据。

## Canonical Key

- 优先使用 canonical `repo_url`。
- GitHub URL 必须规范化为 `https://github.com/<owner>/<repo>`。
- 同一项目在 agents-radar 和 Trendshift 中出现时必须合并，不得重复评分。
- 同一 repo 在不同日期重复出现时 MUST 视为同一主分析对象的连续观测，而不是新的独立项目。

## 合并规则

- tags 取并集。
- description 优先使用更具体且来源明确的描述。
- stars、forks、issues、pr 优先使用 Trendshift 或结构化 source。
- agents-radar 的自然语言证据保留为 `evidence_text`，不直接覆盖结构化指标。
- `sources` MUST 保留多源集合，供 discussion_score 使用。
- `appearances` 或等价历史字段 MUST 能反映跨天出现次数，供 persistence 判定使用。
- 多天数据 merge MUST 是追加历史观测，而不是用最新一天覆盖全部历史。

## 输出

- `data/normalized/YYYY-MM-DD.raw-signals.jsonl`
- `data/normalized/YYYY-MM-DD.projects.jsonl`

## 时序与重入契约

- Normalize MUST 支持同 repo 的跨天重入，不得把连续多天出现的项目当作彼此无关的孤立样本。
- 当用户重复运行同一日期的 pipeline 时，Normalization SHOULD 保持幂等，不制造重复 appearance。
- persistence 相关判断所需的历史信息 MUST 可由 normalized 层或其上游缓存稳定读取。

## 验收场景

WHEN 同一 repo 同时出现在 `ai-trending.md` 和 Trendshift，THEN normalized project MUST 合并 sources，并提升 discussion_score 的证据基础。

WHEN 同一 repo 连续 3 天都被采集到，THEN normalized project MUST 保留至少 3 次 appearance 证据，供 `emerging` / `persistent` 判断使用。
