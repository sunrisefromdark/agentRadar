#!/usr/bin/env bash
set -euo pipefail

echo "===whoami==="
whoami

echo "===psql==="
command -v psql || true

echo "===pg_isready==="
command -v pg_isready || true

echo "===dpkg==="
dpkg -l | grep postgresql || true

echo "===service==="
service postgresql status || true

echo "===apt==="
ps -ef | grep apt | grep -v grep || true
