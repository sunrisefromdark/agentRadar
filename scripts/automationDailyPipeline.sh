#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: bash scripts/automationDailyPipeline.sh [--date YYYY-MM-DD] [YYYY-MM-DD]" >&2
}

TIMEZONE="${TZ:-Asia/Shanghai}"
RUN_WEEKLY="${RUN_WEEKLY:-true}"
BACKFILL_MISSING_DAYS="${BACKFILL_MISSING_DAYS:-true}"
BUILD_KB="${BUILD_KB:-false}"
LIVE_SMOKE_RETRY_DELAY_SECONDS="${AUTOMATION_DAILY_RETRY_SLEEP_SECONDS:-3600}"
LIVE_SMOKE_MAX_ATTEMPTS="${AUTOMATION_DAILY_LIVE_SMOKE_MAX_ATTEMPTS:-2}"
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
        echo "[automation] error: --date requires YYYY-MM-DD" >&2
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
        echo "[automation] error: unexpected extra argument '${1}'" >&2
        usage
        exit 1
      fi
      DATE_ARG="${1:-}"
      shift
      ;;
  esac
done

if [[ -n "${DATE_ARG}" && ! "${DATE_ARG}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "[automation] error: date must match YYYY-MM-DD, received '${DATE_ARG}'" >&2
  exit 1
fi

DATE_VALUE="${DATE_ARG:-$(TZ="${TIMEZONE}" date +%F)}"

assert_daily_outputs() {
  local date_value="$1"
  local missing=()

  for filepath in \
    "data/reports/${date_value}.daily.json" \
    "data/reports/${date_value}.daily.md" \
    "data/reports/${date_value}.run-summary.json" \
    "data/reports/${date_value}.run-summary.md" \
    "data/reports/${date_value}.verify-daily.json" \
    "data/raw/github/${date_value}.enrichment.json"; do
    if [[ ! -f "${filepath}" ]]; then
      missing+=("${filepath}")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    echo "[automation] missing expected daily outputs:" >&2
    printf '  - %s\n' "${missing[@]}" >&2
    return 1
  fi
}

run_live_smoke_with_retry() {
  local date_value="$1"
  local attempt=1
  local last_exit=0

  while (( attempt <= LIVE_SMOKE_MAX_ATTEMPTS )); do
    echo "[automation] liveDailySmoke attempt ${attempt}/${LIVE_SMOKE_MAX_ATTEMPTS}"
    if bash scripts/liveDailySmoke.sh "${date_value}"; then
      return 0
    else
      last_exit=$?
    fi

    if (( attempt < LIVE_SMOKE_MAX_ATTEMPTS )); then
      echo "[automation] liveDailySmoke failed; retrying after ${LIVE_SMOKE_RETRY_DELAY_SECONDS}s"
      sleep "${LIVE_SMOKE_RETRY_DELAY_SECONDS}"
    fi
    attempt=$((attempt + 1))
  done

  return "${last_exit}"
}

echo "[automation] date=${DATE_VALUE}"
echo "[automation] run_weekly=${RUN_WEEKLY}"
echo "[automation] backfill_missing_days=${BACKFILL_MISSING_DAYS}"
echo "[automation] build_kb=${BUILD_KB}"

pipeline_failed=0

if ! run_live_smoke_with_retry "${DATE_VALUE}"; then
  pipeline_failed=1
  echo "[automation] warning: liveDailySmoke still failed after retry; preserving any generated artifacts for follow-up" >&2
fi

if ! assert_daily_outputs "${DATE_VALUE}"; then
  echo "[automation] attempting cached daily recovery"
  corepack pnpm recover-daily -- --date "${DATE_VALUE}"
  if ! corepack pnpm verify-daily -- --date "${DATE_VALUE}"; then
    pipeline_failed=1
    echo "[automation] warning: verify-daily still failed after cached recovery" >&2
  fi
  assert_daily_outputs "${DATE_VALUE}"
fi

echo "[automation] capturing tracked github star snapshots"
corepack pnpm capture-github-stars -- --date "${DATE_VALUE}"

if is_enabled "${RUN_WEEKLY}"; then
  weekly_cmd=(corepack pnpm sync-weekly -- --date "${DATE_VALUE}")
  if is_enabled "${BACKFILL_MISSING_DAYS}"; then
    weekly_cmd+=(--backfill-missing-days)
  fi

  echo "[automation] running weekly"
  "${weekly_cmd[@]}"
fi

if is_enabled "${BUILD_KB}"; then
  echo "[automation] running build-kb"
  corepack pnpm build-kb
fi

echo "[automation] completed"

if (( pipeline_failed != 0 )); then
  echo "[automation] completed with failures; artifacts were preserved for upload/commit" >&2
  exit 1
fi
