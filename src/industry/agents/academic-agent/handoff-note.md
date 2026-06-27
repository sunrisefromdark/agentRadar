# Academic Agent Handoff Note

- 当前实现已收口到中台 `Phase 1A` 可消费的 academic formal handoff。
- 稳定入口已通过 `src/industry/agents/academic-agent/index.ts` 导出 `buildAcademicHandoffBundle(...)` 与 `buildAcademicPrepBundle(...)`。
- formal bundle 内 payload 已统一到 canonical schema：
  - `industry-signal-event-batch.v1`
  - `axis-tool-coverage-report.v1`
  - `industry-agent-contribution.v1`
  - `daily-industry-evidence-pack-input.v1`
- artifact ref 与 storage path 已改走中台 canonical `industry://internal/...` 规则。
- 当前可直接交中台的固定文件入口：
  - `fixtures/industry/agents/academic-agent/replay/phase1-current-bundle.json`
  - `fixtures/industry/agents/academic-agent/replay/phase1-missing-owner-boundary-bundle.json`
  - `fixtures/industry/agents/academic-agent/replay/phase1-delivery-manifest.json`
- delivery manifest 已显式带出 replay / eval / owner-boundary fixture refs。
- 学术组当前仍只做 `projection` 路径，不接 same-run / claim-critical dispatch 字段。
