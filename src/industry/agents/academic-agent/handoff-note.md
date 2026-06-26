# Academic Agent Handoff Note

- 当前实现只做到 `academic-agent -> normalization-agent` 的 preparatory handoff。
- 已对齐 canonical 的只有 `event-batch.v1` 与 `axis-tool-coverage-report.v1`。
- `industry-agent-contribution.v1`、`daily-industry-evidence-pack-input.v1` 目前仍是本地 seam，并在 payload 中显式标注 `upstream_payload_schema`。
- 待中台继续对接：canonical schema 真源替换、正式 payload registry、current consumer fixture、same-run dispatch/budget 接线。
