#!/bin/bash
# Writes .env.rehearsal from Railway production app vars + Railway rehearsal DB URL.
# Run this once per session (or when secrets change), then use docker compose.
set -euo pipefail

REHEARSAL_ENV="${REHEARSAL_ENV:-postgres-rehearsal}"
REHEARSAL_DB_SERVICE="${REHEARSAL_DB_SERVICE:-wmv-postgres-rehearsal}"
PRODUCTION_ENV="${PRODUCTION_ENV:-production}"
PRODUCTION_APP_SERVICE="${PRODUCTION_APP_SERVICE:-wmv-cycling-series}"
RAILWAY_PROJECT="${RAILWAY_PROJECT:-}"
LOCAL_PORT="${LOCAL_PORT:-3001}"
OUTPUT="${OUTPUT:-.env.rehearsal}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Missing required command: $1"
    exit 1
  fi
}

run_railway() {
  if [[ -n "$RAILWAY_PROJECT" ]]; then
    railway "$@" -p "$RAILWAY_PROJECT"
  else
    railway "$@"
  fi
}

resolve_db_public_url() {
  local status_json
  status_json=$(run_railway status --json)

  local svc="$REHEARSAL_DB_SERVICE"
  if ! jq -e --arg n "$svc" '.services.edges[].node.name|select(.==$n)' <<<"$status_json" >/dev/null 2>&1; then
    if jq -e --arg n "Postgres" '.services.edges[].node.name|select(.==$n)' <<<"$status_json" >/dev/null 2>&1; then
      svc="Postgres"
    else
      echo "❌ No Postgres service found in env '$REHEARSAL_ENV'" >&2
      exit 1
    fi
  fi

  for attempt in 1 2 3 4 5; do
    local url
    url=$(run_railway run -s "$svc" -e "$REHEARSAL_ENV" -- sh -lc 'printf "%s" "$DATABASE_PUBLIC_URL"' || true)
    if [[ -n "$url" ]]; then
      printf '%s' "$url"
      return 0
    fi
    echo "   Waiting for DATABASE_PUBLIC_URL on $svc ($attempt/5)..." >&2
    sleep 2
  done

  echo "❌ Could not resolve DATABASE_PUBLIC_URL for '$svc' in '$REHEARSAL_ENV'" >&2
  exit 1
}

require_cmd railway
require_cmd jq

if ! railway whoami >/dev/null 2>&1; then
  echo "❌ Railway CLI is not authenticated. Run: railway login"
  exit 1
fi

echo "🔐 Fetching production app vars from Railway..."
APP_VARS_JSON=$(run_railway variable list -s "$PRODUCTION_APP_SERVICE" -e "$PRODUCTION_ENV" --json)
if [[ -z "$APP_VARS_JSON" || "$APP_VARS_JSON" == "null" ]]; then
  echo "❌ No Railway variables returned for service '$PRODUCTION_APP_SERVICE' in env '$PRODUCTION_ENV'"
  exit 1
fi

echo "🔌 Resolving rehearsal Postgres URL..."
REHEARSAL_DB_URL="$(resolve_db_public_url)"

echo "📝 Writing $OUTPUT..."
jq -r 'to_entries[] | select(.value != null) | "\(.key)=\(.value|tostring)"' <<<"$APP_VARS_JSON" > "$OUTPUT"
cat >> "$OUTPUT" <<EOF

# --- Rehearsal overrides ---
DB_DIALECT=postgres
DATABASE_URL=$REHEARSAL_DB_URL
PORT=$LOCAL_PORT
APP_BASE_URL=http://localhost:$LOCAL_PORT
FRONTEND_URL=
BACKEND_URL=
EOF

echo ""
echo "✅ $OUTPUT written."
echo "   App vars:    service=$PRODUCTION_APP_SERVICE env=$PRODUCTION_ENV"
echo "   Database:    $REHEARSAL_DB_URL"
echo "   Local URL:   http://localhost:$LOCAL_PORT"
echo ""
echo "Next steps:"
echo "  docker compose -f docker-compose.rehearsal.yml up --build"
echo "  docker compose -f docker-compose.rehearsal.yml down"
