# 失败恢复

## External discovery failure recovery

- default missing input is `skipped` and must not block primary daily or weekly output.
- explicit input that is missing, unreadable, invalid JSON, or schema-invalid is `failed`.
- Weekly partial external aggregate windows must still allow weekly output while recording skipped and failed days.
- `verify-daily` fails unsafe public aggregate, missing audit for claimed external use, and external score contamination.
- Legacy artifacts without coverage remain readable but `verify-daily` records a warning.
- Invalid producer config fails before writing; public-unsafe items, coverage, query data, or diagnostics must never be written.
- A third-party or legacy artifact with public-unsafe `diagnostics.warnings` is schema-invalid and must fail closed without echoing the sensitive warning text.
- A platform coverage gap is recoverable by configuring a sanitized local input and rerunning `agentreach:discover`; it must not be described as no discussion.
- Provider runtime failures are isolated by `orchestrator.ts`. Safe coverage reasons include `provider_execution_failed` and `provider_transport_unavailable`; raw provider errors are converted to `AgentReachProviderError` safe codes before they enter diagnostics.
- Live provider failures are recoverable by fixing the provider allowlist URL, timeout, byte budget, or local network condition and rerunning `agentreach:discover`. Invalid `live.enabled` config fails before writing; transport failures are expressed as typed coverage states without response bodies.
- X / Twitter API and Reddit API failures are not part of the current recovery loop because those providers remain V2 high-risk opt-in designs.

## AgentReach quality recovery

Invalid `AgentReachQualityPolicy` config fails before writing. The recoverable
fields are `lookback_days`, `max_items_per_query`, `max_items_per_provider`, and
`max_items_total`; the configured values must satisfy
`max_items_per_query <= max_items_per_provider <= max_items_total`.

An atomic query entry mistake can create bad relevance labels and must be fixed
in the query pack before rerunning `agentreach:discover`. Runtime quality drops
are reported with public-safe counts such as `quality_filtered_irrelevant`,
`quality_filtered_invalid_timestamp`, `quality_deduplicated`, and
`quality_truncated`. A successful live request with zero relevant results is not
a provider failure; coverage remains ok and recovery means adjusting queries,
quality policy, or provider source coverage if the result set is too narrow.

Quality keywords: AgentReachQualityPolicy; lookback_days; max_items_per_query; max_items_per_provider; max_items_total; atomic query entry; quality_filtered_irrelevant; quality_filtered_invalid_timestamp; quality_deduplicated; zero relevant results; coverage remains ok.

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

