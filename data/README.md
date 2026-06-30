# Data Policy

This repository intentionally commits public historical artifacts under `data/`.

## What is version-controlled

- `data/raw/`
- `data/normalized/`
- `data/classifications/`
- `data/scores/`
- `data/reports/`
- `data/kb/`
- `data/external-discovery/*.aggregate.json`

These files are part of the project deliverable. They let readers inspect historical runs, compare scoring behavior over time, and review the generated reports without reproducing every upstream fetch.

## What is not version-controlled

- `data/upstream/`
- `data/raw/external-discovery/`

`data/upstream/` is reserved for optional local scratch checkouts or caches, such as an explicit self-hosted `agents-radar` mirror. It is ignored by Git and is not part of the public artifact history.

`data/raw/external-discovery/` is local-only AgentReach provider input. It may contain imported platform references or private runner context and must not be committed or uploaded by default. Only sanitized fixtures under `data/raw/external-discovery/fixtures/` may be version-controlled.

Public external discovery history belongs in `data/external-discovery/*.aggregate.json`. These aggregates must be public-safe: no raw social text, no profile URLs, no raw handles, no cookie/session/token/OAuth material, and no public `*.events.jsonl` default artifact.

## Automation behavior

The daily and weekly GitHub Actions workflows update the tracked public artifacts and commit them back into this repository. This is intentional: the repo is both code and a public historical data log.
