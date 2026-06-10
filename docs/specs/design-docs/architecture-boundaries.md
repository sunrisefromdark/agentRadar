# Architecture Boundaries

## Boundary Notes

- `src/signal/` is responsible for source ingestion only.
- `src/filter/` scores and ranks normalized projects.
- `src/action/` renders user-facing reports and derivative artifacts.
- `src/agentMemory/` stores reusable routing and maintenance knowledge for the open-source repository.
