# `schemas/industry/`

This directory is the machine-readable source-of-truth surface referenced by the
industry-agent design package.

Contents:

- `canonical-schema.bundle.json`: canonical object and payload registry bundle.
- `compatibility-matrix.json`: producer/consumer compatibility expectations.
- `reason-code-registry.json`: controlled reason-code catalog.
- `state-transition-registry.json`: controlled lifecycle transition catalog.

Review rules:

- `docs/specs/design-docs/行业级Agent趋势判断设计/03-数据模型契约.md` is the
  only prose explanation source.
- This directory is the only machine-readable source.
- Downstream modules must not invent local copies of enums, payload contracts,
  reservation lanes, or state machines that are already listed here.
