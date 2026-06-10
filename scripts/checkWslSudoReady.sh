#!/usr/bin/env bash
set -euo pipefail

if sudo -n true >/dev/null 2>&1; then
  echo "sudo_ready:0"
else
  echo "sudo_ready:1"
fi
