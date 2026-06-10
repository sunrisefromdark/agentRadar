# Data Policy

This repository intentionally commits public historical artifacts under `data/`.

## What is version-controlled

- `data/raw/`
- `data/normalized/`
- `data/classifications/`
- `data/scores/`
- `data/reports/`
- `data/kb/`

These files are part of the project deliverable. They let readers inspect historical runs, compare scoring behavior over time, and review the generated reports without reproducing every upstream fetch.

## What is not version-controlled

- `data/upstream/`

`data/upstream/` is reserved for optional local scratch checkouts or caches, such as an explicit self-hosted `agents-radar` mirror. It is ignored by Git and is not part of the public artifact history.

## Automation behavior

The daily and weekly GitHub Actions workflows update the tracked public artifacts and commit them back into this repository. This is intentional: the repo is both code and a public historical data log.
