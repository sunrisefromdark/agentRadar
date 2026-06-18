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
- `data/raw/external-discovery/`

`data/upstream/` is reserved for optional local scratch checkouts or caches, such as an explicit self-hosted `agents-radar` mirror. It is ignored by Git and is not part of the public artifact history.

## AgentReach external raw input boundary

`data/raw/external-discovery/` is reserved for AgentReach external discovery raw input and is local-only by default. It must not be committed or uploaded by default. The only public exception is an explicitly sanitized fixture, and that fixture must not contain raw social text, unsanitized handles, profile URLs, cookies, tokens, sessions, OAuth data, passwords, or private diagnostics.

The opt-in `agentreach:discover` producer writes dated artifacts to `data/raw/external-discovery/YYYY-MM-DD.agent-reach.json`. Its local provider config may reference sanitized JSON inputs for `external-import`, `rss-blog`, `official-web`, and `hacker-news`; config paths and account settings must not be copied into the artifact. X / Twitter and Reddit are manual-import-only boundaries.

Low-risk live provider config is also local-only and explicit: `live.enabled=true` plus an allowlist URL may be used for RSS / Atom, official page, or Hacker News public search discovery. `input_path` and live config are mutually exclusive for one provider run. The produced artifact may retain public URLs and coverage states, but must not retain config paths, cookies, sessions, OAuth, tokens, account settings, private diagnostics, or response bodies.

## External discovery public artifacts

Public external discovery output belongs under `data/external-discovery/*.aggregate.json`. A public aggregate may keep summaries, counts, stable evidence IDs, platform enums, audit status, and `source_input_hash`, but it must not preserve provider raw text or profile URLs.

V1 does not publish public canonical `*.events.jsonl` files by default. If a future replayable events file is introduced, it must be explicitly public-safe and must not contain provider raw social text.

Every public aggregate must declare:

- `public_safe=true`
- `redaction_policy_version`
- `contains_raw_text=false`
- `contains_profile_urls=false`
- `source_input_hash`

When producer coverage is available, public aggregates may also retain the public-safe platform coverage summary. Missing or partial coverage must never be rendered as evidence that no discussion exists.

## Automation behavior

The daily and weekly GitHub Actions workflows update the tracked public artifacts and commit them back into this repository. This is intentional: the repo is both code and a public historical data log.
