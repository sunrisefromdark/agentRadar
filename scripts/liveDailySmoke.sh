#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: bash scripts/liveDailySmoke.sh [--date YYYY-MM-DD] [YYYY-MM-DD]" >&2
}

TIMEZONE="${TZ:-Asia/Shanghai}"
DATE_ARG=""

while (($# > 0)); do
  case "${1:-}" in
    --)
      shift
      ;;
    --date)
      if [[ -z "${2:-}" ]]; then
        echo "[live-smoke] error: --date requires YYYY-MM-DD" >&2
        usage
        exit 1
      fi
      DATE_ARG="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -n "${DATE_ARG}" ]]; then
        echo "[live-smoke] error: unexpected extra argument '${1}'" >&2
        usage
        exit 1
      fi
      DATE_ARG="${1:-}"
      shift
      ;;
  esac
done

if [[ -n "${DATE_ARG}" && ! "${DATE_ARG}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "[live-smoke] error: date must match YYYY-MM-DD, received '${DATE_ARG}'" >&2
  exit 1
fi

DATE_VALUE="${DATE_ARG:-$(TZ="${TIMEZONE}" date +%F)}"

echo "[live-smoke] date=${DATE_VALUE}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "[live-smoke] warning: GITHUB_TOKEN is not set; GitHub live delta and some realtime sources may degrade" >&2
fi

echo "[live-smoke] probing llm provider"
if ! corepack pnpm llm:smoke -- --date "${DATE_VALUE}"; then
  echo "[live-smoke] warning: llm smoke failed; continuing so daily artifacts are still generated" >&2
fi

echo "[live-smoke] running run-daily"
corepack pnpm run-daily -- --date "${DATE_VALUE}"

echo "[live-smoke] running verify-daily"
corepack pnpm verify-daily -- --date "${DATE_VALUE}"

echo "[live-smoke] generated artifacts:"
echo "  - data/reports/${DATE_VALUE}.daily.md"
echo "  - data/reports/${DATE_VALUE}.llm-smoke.json"
echo "  - data/reports/${DATE_VALUE}.run-summary.md"
echo "  - data/reports/${DATE_VALUE}.run-summary.json"
echo "  - data/raw/github/${DATE_VALUE}.enrichment.json"
echo "  - data/raw/github-stars/${DATE_VALUE}.json"
