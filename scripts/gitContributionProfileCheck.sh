#!/usr/bin/env bash

set -euo pipefail

git log --format=fuller --date=iso-strict -3
git push --dry-run --no-verify origin HEAD:main
