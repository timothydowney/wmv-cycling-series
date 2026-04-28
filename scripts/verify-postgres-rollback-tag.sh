#!/bin/bash
set -euo pipefail

TAG_PATTERN="pre-postgres-migration-sqlite-*"

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "[ROLLBACK TAG] ERROR: git remote 'origin' not configured"
  exit 1
fi

TAGS=$(git ls-remote --tags origin "refs/tags/${TAG_PATTERN}" | awk '{print $2}' | sed 's#refs/tags/##' | sed 's/\^{}$//' | sort -u)
MATCHES=$(echo "$TAGS" | sed '/^$/d' | wc -l | tr -d ' ')

if [[ "$MATCHES" -lt 1 ]]; then
  echo "[ROLLBACK TAG] ERROR: No rollback tag matching '${TAG_PATTERN}' found on origin"
  echo "[ROLLBACK TAG] Create and push a rollback tag from main before merge"
  exit 1
fi

echo "[ROLLBACK TAG] OK: Found ${MATCHES} matching rollback tag(s) on origin"
echo "$TAGS"
