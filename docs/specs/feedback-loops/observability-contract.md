# 可观测性契约

## External discovery observability

- External discovery observability must include provider status and status reason.
- Public aggregates must retain `source_input_hash` for auditability without publishing raw input.
- registry miss and rejected events must be visible in audit summaries.
- Weekly external windows must report usable day count, skipped day count, failed day count, and direction gate audit state.
- Producer artifacts and daily/run-summary outputs must expose per-platform coverage status.
- Weekly external windows must aggregate coverage status counts.
- `not_configured`, `manual_import_only`, `unavailable`, and `partial` are coverage states, not no-signal conclusions.
- Producer orchestrator warnings use `provider_failed:<provider_id>:<safe_code>` and must not include raw exception text, filesystem paths, response bodies, cookie, session, OAuth, token, account settings, or platform API credentials.
- Consumer adapter validation must reject public-unsafe `diagnostics.warnings` before they can enter daily aggregate audit output.
- Live provider observability is opt-in only: `live.enabled=true` with an allowlist URL may produce public-safe coverage summary and typed `timeout` / `http` / `unavailable` / `response_too_large` states. The default remains disabled and must not call live transport.
- X / Twitter API and Reddit API observability is reserved for future V2 high-risk provider design; current manual-import-only coverage must not be rendered as no discussion.

## AgentReach quality observability

AgentReach producer artifacts expose `AgentReachQualityPolicy` inside the
artifact query, including `lookback_days`, `max_items_per_query`,
`max_items_per_provider`, and `max_items_total`. Query enrichment follows an
atomic query entry rule to keep direction-label diagnostics explainable.

Quality diagnostics are public-safe count strings only:
`quality_filtered_irrelevant`, `quality_filtered_invalid_timestamp`,
`quality_deduplicated`, and `quality_truncated`. These diagnostics explain why
output was bounded or filtered, but they do not include URLs, config paths,
response bodies, tokens, cookies, sessions, OAuth data, or raw provider text.
When a live provider succeeds but has zero relevant results, coverage remains ok
and the warning count carries the explanation.

Quality keywords: AgentReachQualityPolicy; lookback_days; max_items_per_query; max_items_per_provider; max_items_total; atomic query entry; quality_filtered_irrelevant; quality_filtered_invalid_timestamp; quality_deduplicated; zero relevant results; coverage remains ok.

## 观测信号

| 信号 | 用途 |
| --- | --- |
| source fetch count | 判断上游是否可用 |
| normalized project count | 判断 parser 是否漂移 |
| score distribution | 判断评分是否异常偏移 |
| high-score count | 判断阈值是否过松或过严 |
| dry-run planned writes | 判断落盘路径 |
| missing evidence warnings | 判断 explainability 缺口 |

## 产物信号

- `data/raw/*`
- `data/normalized/*`
- `data/scores/*`
- `data/reports/*`
- `data/kb/*`

## 失败判据

- high-score 项目没有 evidence，视为 P0。
- rules-only 模式失败，视为 P0。
- dry-run 写入持久文件，视为 P0。
- weekly 只列项目不抽象趋势，视为 P1。

