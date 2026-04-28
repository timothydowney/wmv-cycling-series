#!/bin/bash
set -euo pipefail

# Rehearsal target (safe sandbox)
REHEARSAL_ENV="${REHEARSAL_ENV:-postgres-rehearsal}"
REHEARSAL_DB_SERVICE="${REHEARSAL_DB_SERVICE:-wmv-postgres-rehearsal}"

# Production source (read-only fetch)
PRODUCTION_ENV="${PRODUCTION_ENV:-production}"
PRODUCTION_APP_SERVICE="${PRODUCTION_APP_SERVICE:-wmv-cycling-series}"

# Optional explicit project id/name for all railway commands
RAILWAY_PROJECT="${RAILWAY_PROJECT:-}"

# Snapshot behavior
SQLITE_SNAPSHOT_PATH="${SQLITE_SNAPSHOT_PATH:-server/data/wmv_prod.db}"
REFRESH_PROD_SNAPSHOT="${REFRESH_PROD_SNAPSHOT:-true}"
SQLITE_SNAPSHOT_PATH_ABS=""

if [[ "$REHEARSAL_ENV" == "$PRODUCTION_ENV" ]]; then
  echo "❌ REHEARSAL_ENV and PRODUCTION_ENV cannot be the same value: $REHEARSAL_ENV"
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing required command: $1"
    exit 1
  fi
}

has_service() {
  local name="$1"
  local json="$2"
  jq -e --arg name "$name" '.services.edges[].node.name | select(. == $name)' <<<"$json" >/dev/null 2>&1
}

run_railway() {
  if [[ -n "$RAILWAY_PROJECT" ]]; then
    railway "$@" -p "$RAILWAY_PROJECT"
  else
    railway "$@"
  fi
}

echo "----------------------------------------------------------"
echo "🚦 Preflight checks"
require_cmd railway
require_cmd jq
require_cmd npm

if ! railway whoami >/dev/null 2>&1; then
  echo "❌ Railway CLI is not authenticated. Run: railway login"
  exit 1
fi

ENV_LIST_JSON=$(run_railway environment list --json)
ORIGINAL_LINKED_ENV=$(jq -r '.environments[] | select(.isLinked == true) | .name' <<<"$ENV_LIST_JSON" | head -n 1)

echo "   Current linked Railway env: ${ORIGINAL_LINKED_ENV:-none}"

echo "----------------------------------------------------------"
echo "🧱 Ensuring rehearsal environment exists (${REHEARSAL_ENV})"
if ! jq -e --arg env "$REHEARSAL_ENV" '.environments[] | select(.name == $env)' <<<"$ENV_LIST_JSON" >/dev/null 2>&1; then
  echo "   Creating environment ${REHEARSAL_ENV} (duplicated from ${PRODUCTION_ENV})"
  run_railway environment new "$REHEARSAL_ENV" --duplicate "$PRODUCTION_ENV" >/dev/null
else
  echo "   Environment already exists"
fi

# We may need to link the environment for `railway add` if creating a DB service.
if [[ "$ORIGINAL_LINKED_ENV" != "$REHEARSAL_ENV" ]]; then
  echo "   Linking env ${REHEARSAL_ENV} for setup operations"
  run_railway environment link "$REHEARSAL_ENV" >/dev/null
fi

cleanup_restore_env() {
  if [[ -n "${ORIGINAL_LINKED_ENV:-}" ]]; then
    if [[ "$(run_railway environment list --json | jq -r '.environments[] | select(.isLinked == true) | .name' | head -n 1)" != "$ORIGINAL_LINKED_ENV" ]]; then
      echo "   Restoring linked Railway env: $ORIGINAL_LINKED_ENV"
      run_railway environment link "$ORIGINAL_LINKED_ENV" >/dev/null || true
    fi
  fi
}
trap cleanup_restore_env EXIT

echo "----------------------------------------------------------"
echo "🗄️ Ensuring rehearsal Postgres service exists"
STATUS_JSON=$(run_railway status --json)
SELECTED_DB_SERVICE="$REHEARSAL_DB_SERVICE"

if has_service "$REHEARSAL_DB_SERVICE" "$STATUS_JSON"; then
  echo "   Found service: $REHEARSAL_DB_SERVICE"
elif has_service "Postgres" "$STATUS_JSON"; then
  SELECTED_DB_SERVICE="Postgres"
  echo "   Requested service not found; using existing Postgres service: $SELECTED_DB_SERVICE"
else
  echo "   Creating managed Postgres service: $REHEARSAL_DB_SERVICE"
  run_railway add -d postgres -s "$REHEARSAL_DB_SERVICE" >/dev/null
  SELECTED_DB_SERVICE="$REHEARSAL_DB_SERVICE"
fi

echo "----------------------------------------------------------"
echo "📦 Ensuring latest production snapshot is available"
if [[ "$REFRESH_PROD_SNAPSHOT" == "true" ]]; then
  RAILWAY_SERVICE="$PRODUCTION_APP_SERVICE" RAILWAY_ENVIRONMENT="$PRODUCTION_ENV" RAILWAY_PROJECT="$RAILWAY_PROJECT" bash scripts/fetch-prod-db.sh
else
  echo "   Skipping fetch (REFRESH_PROD_SNAPSHOT=false)"
fi

if [[ ! -s "$SQLITE_SNAPSHOT_PATH" ]]; then
  echo "❌ SQLite snapshot not found or empty: $SQLITE_SNAPSHOT_PATH"
  exit 1
fi

SQLITE_SNAPSHOT_PATH_ABS=$(cd "$(dirname "$SQLITE_SNAPSHOT_PATH")" && pwd)/"$(basename "$SQLITE_SNAPSHOT_PATH")"

echo "----------------------------------------------------------"
echo "🔌 Resolving rehearsal DATABASE_URL from Railway"
RAILWAY_PG_URL=""
RAILWAY_PG_PUBLIC_URL=""
RAILWAY_PG_PRIVATE_URL=""
for attempt in 1 2 3 4 5; do
  RAILWAY_PG_PUBLIC_URL=$(run_railway run -s "$SELECTED_DB_SERVICE" -e "$REHEARSAL_ENV" -- sh -lc 'printf "%s" "$DATABASE_PUBLIC_URL"' || true)
  RAILWAY_PG_PRIVATE_URL=$(run_railway run -s "$SELECTED_DB_SERVICE" -e "$REHEARSAL_ENV" -- sh -lc 'printf "%s" "$DATABASE_URL"' || true)

  if [[ -n "$RAILWAY_PG_PUBLIC_URL" ]]; then
    RAILWAY_PG_URL="$RAILWAY_PG_PUBLIC_URL"
    break
  fi

  if [[ -n "$RAILWAY_PG_PRIVATE_URL" && "$RAILWAY_PG_PRIVATE_URL" != *"railway.internal"* ]]; then
    RAILWAY_PG_URL="$RAILWAY_PG_PRIVATE_URL"
    break
  fi

  echo "   Waiting for DATABASE_PUBLIC_URL on $SELECTED_DB_SERVICE ($attempt/5)..."
  sleep 2
done

if [[ -z "$RAILWAY_PG_URL" ]]; then
  echo "❌ Could not resolve a local-reachable Postgres URL for service '$SELECTED_DB_SERVICE' in env '$REHEARSAL_ENV'"
  echo "   DATABASE_PUBLIC_URL='${RAILWAY_PG_PUBLIC_URL}'"
  echo "   DATABASE_URL='${RAILWAY_PG_PRIVATE_URL}'"
  echo "   Tip: ensure the Postgres service is provisioned and exposes DATABASE_PUBLIC_URL."
  exit 1
fi

echo "   Rehearsal DB service: $SELECTED_DB_SERVICE"
echo "   Rehearsal env: $REHEARSAL_ENV"

echo "----------------------------------------------------------"
echo "🏗️ Bootstrapping schema + importing snapshot"
DATABASE_URL="$RAILWAY_PG_URL" npm --prefix server run db:pg:bootstrap:schema
DATABASE_URL="$RAILWAY_PG_URL" npm --prefix server run db:pg:migrate:from-sqlite -- \
  --sqlite "$SQLITE_SNAPSHOT_PATH_ABS" \
  --source-env "$PRODUCTION_ENV" \
  --target-env "$REHEARSAL_ENV" \
  --confirm-destructive

echo "----------------------------------------------------------"
echo "🧪 Verifying parity"
DATABASE_URL="$RAILWAY_PG_URL" npm --prefix server run db:pg:verify:parity -- --sqlite "$SQLITE_SNAPSHOT_PATH_ABS"

echo "----------------------------------------------------------"
echo "✅ Rehearsal import completed successfully"
echo "   Environment: $REHEARSAL_ENV"
echo "   Postgres service: $SELECTED_DB_SERVICE"
echo "   Snapshot: $SQLITE_SNAPSHOT_PATH"
echo "   Optional SQL shell: railway connect -e $REHEARSAL_ENV $SELECTED_DB_SERVICE"
