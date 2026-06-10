#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

SMOKE_DATE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --smoke-date)
      SMOKE_DATE="${2:-}"
      if [[ -z "${SMOKE_DATE}" ]]; then
        echo "[visual-console-test] error: --smoke-date requires YYYY-MM-DD" >&2
        exit 1
      fi
      shift 2
      ;;
    *)
      echo "[visual-console-test] error: unknown argument: $1" >&2
      echo "usage: bash scripts/runVisualConsoleTests.sh [--smoke-date YYYY-MM-DD]" >&2
      exit 1
      ;;
  esac
done

echo "[visual-console-test] root=${ROOT_DIR}"

echo "[visual-console-test] step 1/4: testing-skill preflight"
corepack pnpm testing-skill:preflight

echo "[visual-console-test] step 2/4: visualConsole vitest suite"
corepack pnpm test -- --no-file-parallelism visualConsole

echo "[visual-console-test] step 3/4: cliWorkflow vitest suite"
corepack pnpm test -- --no-file-parallelism cliWorkflow

echo "[visual-console-test] step 4/4: typecheck"
corepack pnpm typecheck

if [[ -n "${SMOKE_DATE}" ]]; then
  echo "[visual-console-test] optional smoke: date=${SMOKE_DATE}"

  for required in \
    "data/reports/${SMOKE_DATE}.daily.json" \
    "data/reports/${SMOKE_DATE}.run-summary.json" \
    "data/reports/${SMOKE_DATE}.weekly.md" \
    "data/kb/latest.json"; do
    if [[ ! -f "${required}" ]]; then
      echo "[visual-console-test] error: missing required smoke artifact: ${required}" >&2
      exit 1
    fi
  done

  corepack pnpm visual-console -- --view overview --date "${SMOKE_DATE}" >/dev/null
  corepack pnpm visual-console -- --view projects --date "${SMOKE_DATE}" >/dev/null
  corepack pnpm visual-console -- --view run-health --date "${SMOKE_DATE}" >/dev/null
  corepack pnpm visual-console -- --view weekly --anchor-date "${SMOKE_DATE}" >/dev/null
  corepack pnpm visual-console -- --view kb --date "${SMOKE_DATE}" --project openai/codex >/dev/null
fi

echo "[visual-console-test] success"
