# Academic Agent Handoff Note

- 当前实现已收口到中台 `Phase 1A` 可消费的 academic handoff。
- bundle 内 payload 已统一到 canonical schema：
  - `industry-signal-event-batch.v1`
  - `axis-tool-coverage-report.v1`
  - `industry-agent-contribution.v1`
  - `daily-industry-evidence-pack-input.v1`
- artifact ref 与 storage path 已改走中台 canonical `industry://internal/...` 规则。
- 学术组当前仍只做 `projection` 路径，不接 same-run / claim-critical dispatch 字段。
