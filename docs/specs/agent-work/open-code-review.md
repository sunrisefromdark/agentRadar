# Open Code Review Integration

This repository uses `alibaba/open-code-review` as an AI-assisted review layer around deterministic checks and human code review. It does not replace `corepack pnpm typecheck`, `corepack pnpm test`, or the evidence rules in `docs/specs/agent-work/codeReviewSkill.md`.

## Default Review Timing

Use diff review as the normal path:

```bash
corepack pnpm code-review:ocr
```

The wrapper runs `ocr review --audience agent` and always applies the repository hard exclude list. `ocr review` workspace mode can include staged, unstaged, and untracked changes, so generated folders and data outputs must stay excluded by default.

Use preview mode to inspect the review scope without calling the LLM:

```bash
corepack pnpm code-review:ocr -- --preview
```

## Scan Policy

Use scan only for baseline audits, large refactors, or targeted high-risk shared areas:

```bash
corepack pnpm code-review:ocr:scan
```

The wrapper scans `src,scripts,app` by default, applies a token budget, and excludes:

```text
node_modules/**,dist/**,tmp/**,data/**,github-pages-site/**,github-profile/**,.git/**,.env,.env.*,pnpm-lock.yaml
```

Extra `--exclude` values are additive only. They cannot remove the repository hard exclude list. The OCR `include` field is not a hard allow-list; it can bypass built-in default excludes, so this repository relies on hard excludes plus scan `--path` for boundaries.

Data files are excluded by default because OCR is wired as a code-change review tool here. Any data schema, seed, or sample-data review should be a deliberate one-off command with a follow-up plan that names the scope.

## Local Pre-Push Gate

The default pre-push hook still runs deterministic checks only:

```bash
corepack pnpm typecheck
corepack pnpm test
```

Enable OCR locally only when you want AI review to block pushes:

```bash
AGENT_RADAR_OCR_PRE_PUSH=1 git push
```

This runs `corepack pnpm code-review:ocr:required`. The required mode fails when the `ocr` CLI is missing; the optional mode skips with a clear message.

## Pull Request Workflow

`.github/workflows/open-code-review.yml` is disabled by default. Enable it by setting:

```text
OCR_REVIEW_ENABLED=true
```

The workflow uses `pull_request`, never `pull_request_target`. Fork PRs are skipped with a notice because repository secrets are unavailable and should not be exposed to untrusted code.

For same-repository PRs, CI reviews the PR diff with explicit refs:

```bash
ocr review --from <base-sha> --to <head-sha> --audience agent --format json
```

The workflow is non-blocking unless:

```text
OCR_REVIEW_BLOCKING=true
```

In non-blocking mode, missing provider config, `ocr llm test` failure, and `ocr review` failure write a status artifact and finish successfully. In blocking mode, the final gate fails unless the status is `review_passed`.

## Provider Configuration

Repository CI uses Open Code Review's official environment variables:

```text
OCR_LLM_URL
OCR_LLM_TOKEN
OCR_LLM_MODEL
OCR_USE_ANTHROPIC
OCR_LLM_AUTH_HEADER
OCR_LLM_EXTRA_HEADERS
OCR_LLM_TIMEOUT
```

Use GitHub Variables for `OCR_LLM_URL`, `OCR_LLM_MODEL`, `OCR_USE_ANTHROPIC`, `OCR_LLM_AUTH_HEADER`, and `OCR_LLM_TIMEOUT`. Use GitHub Secrets for `OCR_LLM_TOKEN` and optional secret header values such as `OCR_LLM_EXTRA_HEADERS`.

Anthropic and other providers must still map through these OCR variables in CI. Do not configure CI with `OCR_ANTHROPIC_API_KEY`; that is not part of this repository's OCR runtime contract.

## Artifacts

The workflow uploads an `open-code-review` artifact with short retention:

```text
artifacts/open-code-review/review.json
artifacts/open-code-review/status.json
```

`review.json` contains only OCR JSON stdout. Skip reasons, config failures, LLM connectivity failures, and review failures go to `status.json` or stderr. The workflow must not upload OCR session JSONL, viewer data, provider request/response logs, tokens, or private diagnostics.

## Policy Summary

- Normal work: run typecheck and tests during development, then `ocr review` before push or PR when useful.
- First adoption: run one targeted `ocr scan` to create a baseline backlog.
- Ongoing maintenance: review changed code by default.
- High-risk changes: enable the local pre-push OCR gate or set the PR workflow to blocking after the signal quality is trusted.
