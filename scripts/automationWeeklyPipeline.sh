#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: bash scripts/automationWeeklyPipeline.sh [--date YYYY-MM-DD] [YYYY-MM-DD]" >&2
}

TIMEZONE="${TZ:-Asia/Shanghai}"
BACKFILL_MISSING_DAYS="${BACKFILL_MISSING_DAYS:-true}"
BUILD_KB="${BUILD_KB:-true}"
DATE_ARG=""

is_enabled() {
  case "${1,,}" in
    1|true|yes|y|on) return 0 ;;
    *) return 1 ;;
  esac
}

while (($# > 0)); do
  case "${1:-}" in
    --)
      shift
      ;;
    --date)
      if [[ -z "${2:-}" ]]; then
        echo "[weekly-automation] error: --date requires YYYY-MM-DD" >&2
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
        echo "[weekly-automation] error: unexpected extra argument '${1}'" >&2
        usage
        exit 1
      fi
      DATE_ARG="${1:-}"
      shift
      ;;
  esac
done

if [[ -n "${DATE_ARG}" && ! "${DATE_ARG}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "[weekly-automation] error: date must match YYYY-MM-DD, received '${DATE_ARG}'" >&2
  exit 1
fi

DATE_VALUE="${DATE_ARG:-$(TZ="${TIMEZONE}" date +%F)}"

echo "[weekly-automation] date=${DATE_VALUE}"
echo "[weekly-automation] backfill_missing_days=${BACKFILL_MISSING_DAYS}"
echo "[weekly-automation] build_kb=${BUILD_KB}"

weekly_cmd=(corepack pnpm sync-weekly -- --date "${DATE_VALUE}")
if is_enabled "${BACKFILL_MISSING_DAYS}"; then
  weekly_cmd+=(--backfill-missing-days)
fi

echo "[weekly-automation] running weekly"
"${weekly_cmd[@]}"

if is_enabled "${BUILD_KB}"; then
  echo "[weekly-automation] running build-kb"
  corepack pnpm build-kb
fi

echo "[weekly-automation] completed"
