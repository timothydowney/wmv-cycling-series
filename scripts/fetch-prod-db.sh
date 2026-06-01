#!/bin/bash
set -euo pipefail

# Railway source configuration
RAILWAY_PROJECT="${RAILWAY_PROJECT:-}"
RAILWAY_SERVICE="${RAILWAY_SERVICE:-wmv-cycling-series}"
RAILWAY_POSTGRES_SERVICE="${RAILWAY_POSTGRES_SERVICE:-Postgres}"
RAILWAY_ENVIRONMENT="${RAILWAY_ENVIRONMENT:-production}"

# Local destination configuration
LOCAL_SNAPSHOT_DATABASE_URL="${LOCAL_SNAPSHOT_DATABASE_URL:-postgresql://wmv:wmv@localhost:5432/wmv_prod_snapshot}"
LOCAL_DEV_DATABASE_URL="${LOCAL_DEV_DATABASE_URL:-postgresql://wmv:wmv@localhost:5432/wmv_local}"
IMPORT_TO_DEV="${IMPORT_TO_DEV:-false}"
DUMP_OUTPUT_PATH="${DUMP_OUTPUT_PATH:-server/data/wmv_prod.dump}"

TMP_DUMP_PATH="${DUMP_OUTPUT_PATH}.tmp"

cleanup() {
    rm -f "$TMP_DUMP_PATH"
}
trap cleanup EXIT

require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "❌ Missing required command: $1"
        exit 1
    fi
}

find_pg_binary() {
    local name="$1"
    local candidate

    for candidate in /usr/lib/postgresql/*/bin/"$name"; do
        if [[ -x "$candidate" ]]; then
            echo "$candidate"
        fi
    done | sort -V | tail -n 1
}

bool_true() {
    local value
    value=$(echo "$1" | tr '[:upper:]' '[:lower:]')
    [[ "$value" == "true" || "$value" == "1" || "$value" == "yes" ]]
}

quote_pg_ident() {
    local ident="$1"
    printf '"%s"' "${ident//\"/\"\"}"
}

parse_db_url() {
    local db_url="$1"

    node -e '
const u = new URL(process.argv[1]);
const dbName = u.pathname.replace(/^\//, "");
if (!dbName) {
  console.error("DATABASE_URL must include a database name");
  process.exit(1);
}
const admin = new URL(u.toString());
admin.pathname = "/postgres";
admin.search = "";
console.log(dbName);
console.log(admin.toString());
' "$db_url"
}

ensure_local_postgres_ready() {
    local target_url="$1"

    DB_DIALECT=postgres \
    DATABASE_URL="$target_url" \
    WMV_AUTO_BOOTSTRAP_DB=false \
    bash scripts/ensure-dev-db.sh
}

reset_local_database() {
    local target_url="$1"
    local target_name="$2"
    local admin_url="$3"
    local quoted_name
    quoted_name=$(quote_pg_ident "$target_name")

    psql "$admin_url" -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$target_name' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS $quoted_name;
CREATE DATABASE $quoted_name;
SQL
}

require_cmd railway
require_cmd jq
require_cmd sha256sum
require_cmd psql
require_cmd pg_dump
require_cmd pg_restore
require_cmd node

PG_DUMP_BIN="$(find_pg_binary pg_dump)"
PG_RESTORE_BIN="$(find_pg_binary pg_restore)"

if [[ -z "$PG_DUMP_BIN" ]]; then
    PG_DUMP_BIN="$(command -v pg_dump)"
fi

if [[ -z "$PG_RESTORE_BIN" ]]; then
    PG_RESTORE_BIN="$(command -v pg_restore)"
fi

BASE_RAILWAY_ARGS=()
if [[ -n "$RAILWAY_PROJECT" ]]; then
    BASE_RAILWAY_ARGS=(-p "$RAILWAY_PROJECT")
fi

APP_RAILWAY_ARGS=("${BASE_RAILWAY_ARGS[@]}" -s "$RAILWAY_SERVICE" -e "$RAILWAY_ENVIRONMENT")

find_postgres_service_with_public_url() {
    local status_json
    local candidates
    local candidate
    local candidate_vars
    local candidate_public_url

    status_json=$(railway status "${BASE_RAILWAY_ARGS[@]}" --json)

    candidates=$(echo "$status_json" | jq -r --arg env "$RAILWAY_ENVIRONMENT" '
      .environments.edges[]
      | select(.node.name == $env)
      | .node.serviceInstances.edges[].node
      | .serviceName
      | select(test("postgres"; "i"))
    ')

    if [[ -z "$candidates" ]]; then
        return 1
    fi

    while IFS= read -r candidate; do
        [[ -z "$candidate" ]] && continue
        candidate_vars=$(railway variable list "${BASE_RAILWAY_ARGS[@]}" -s "$candidate" -e "$RAILWAY_ENVIRONMENT" --json 2>/dev/null || echo '{}')
        candidate_public_url=$(echo "$candidate_vars" | jq -r '.DATABASE_PUBLIC_URL // ""')
        if [[ -n "$candidate_public_url" ]]; then
            echo "$candidate"
            return 0
        fi
    done <<< "$candidates"

    return 1
}

dump_with_docker_pg18() {
    local source_url="$1"
    local output_path="$2"

    if ! command -v docker >/dev/null 2>&1; then
        return 1
    fi

    docker run --rm postgres:18 \
        pg_dump --format=custom --no-owner --no-privileges "$source_url" > "$output_path"
}

# Ensure output directory exists
mkdir -p "$(dirname "$DUMP_OUTPUT_PATH")"

echo "----------------------------------------------------------"
echo "🔍 Fetching production variables from Railway..."
echo "   App target: service=$RAILWAY_SERVICE environment=$RAILWAY_ENVIRONMENT${RAILWAY_PROJECT:+ project=$RAILWAY_PROJECT}"

if ! railway whoami >/dev/null 2>&1; then
    echo "❌ Railway CLI is not authenticated. Run: railway login"
    exit 1
fi

VARS_JSON=$(railway variable list "${APP_RAILWAY_ARGS[@]}" --json)

get_var() {
    echo "$VARS_JSON" | jq -r --arg key "$1" '.[$key] // ""'
}

P_DATABASE_URL=$(get_var "DATABASE_URL")
P_CLIENT_ID=$(get_var "STRAVA_CLIENT_ID")
P_CLIENT_SECRET=$(get_var "STRAVA_CLIENT_SECRET")
P_SESSION_SECRET=$(get_var "SESSION_SECRET")
P_ENCRYPTION_KEY=$(get_var "TOKEN_ENCRYPTION_KEY")
P_WEBHOOK_TOKEN=$(get_var "WEBHOOK_VERIFY_TOKEN")
P_ADMINS=$(get_var "ADMIN_ATHLETE_IDS")

if [[ -z "$P_DATABASE_URL" ]]; then
    echo "❌ Production DATABASE_URL is missing for selected Railway app service/environment."
    echo "   Target: service=$RAILWAY_SERVICE environment=$RAILWAY_ENVIRONMENT"
    exit 1
fi

echo "----------------------------------------------------------"
echo "📥 Resolving production Postgres URL and creating local dump..."
echo "   Initial Postgres target: service=$RAILWAY_POSTGRES_SERVICE environment=$RAILWAY_ENVIRONMENT"

RESOLVED_POSTGRES_SERVICE="$RAILWAY_POSTGRES_SERVICE"
PG_VARS_JSON=$(railway variable list "${BASE_RAILWAY_ARGS[@]}" -s "$RESOLVED_POSTGRES_SERVICE" -e "$RAILWAY_ENVIRONMENT" --json 2>/dev/null || echo '{}')
PG_PUBLIC_DATABASE_URL=$(echo "$PG_VARS_JSON" | jq -r '.DATABASE_PUBLIC_URL // ""')

if [[ -z "$PG_PUBLIC_DATABASE_URL" ]]; then
    if AUTO_POSTGRES_SERVICE=$(find_postgres_service_with_public_url); then
        RESOLVED_POSTGRES_SERVICE="$AUTO_POSTGRES_SERVICE"
        PG_VARS_JSON=$(railway variable list "${BASE_RAILWAY_ARGS[@]}" -s "$RESOLVED_POSTGRES_SERVICE" -e "$RAILWAY_ENVIRONMENT" --json)
        PG_PUBLIC_DATABASE_URL=$(echo "$PG_VARS_JSON" | jq -r '.DATABASE_PUBLIC_URL // ""')
    fi
fi

echo "   Resolved Postgres service: $RESOLVED_POSTGRES_SERVICE"

SOURCE_DATABASE_URL="$PG_PUBLIC_DATABASE_URL"
if [[ -z "$SOURCE_DATABASE_URL" ]]; then
    SOURCE_DATABASE_URL="$P_DATABASE_URL"
fi

if [[ -z "$SOURCE_DATABASE_URL" ]]; then
    echo "❌ Could not resolve a production Postgres connection URL for dump."
    echo "   Checked app DATABASE_URL and Postgres service DATABASE_PUBLIC_URL."
    exit 1
fi

LOCAL_DUMP_ERROR_PATH=$(mktemp)
if ! "$PG_DUMP_BIN" --format=custom --no-owner --no-privileges "$SOURCE_DATABASE_URL" > "$TMP_DUMP_PATH" 2>"$LOCAL_DUMP_ERROR_PATH"; then
    echo "   Local pg_dump failed; attempting Docker postgres:18 pg_dump fallback..."
    if ! dump_with_docker_pg18 "$SOURCE_DATABASE_URL" "$TMP_DUMP_PATH"; then
        echo "❌ Failed to create Postgres dump from resolved URL and Docker fallback."
        echo "   Tried Postgres service: $RESOLVED_POSTGRES_SERVICE"
        echo "   Local pg_dump error:"
        sed 's/^/   /' "$LOCAL_DUMP_ERROR_PATH"
        echo "   Tip: install local pg_dump v18+ or install Docker to enable automatic fallback."
        rm -f "$LOCAL_DUMP_ERROR_PATH"
        exit 1
    fi
fi
rm -f "$LOCAL_DUMP_ERROR_PATH"

if [[ ! -s "$TMP_DUMP_PATH" ]]; then
    echo "❌ Dump produced an empty file."
    exit 1
fi

mv "$TMP_DUMP_PATH" "$DUMP_OUTPUT_PATH"

echo "----------------------------------------------------------"
echo "✅ Dump complete"
echo "   Saved to: $DUMP_OUTPUT_PATH"
echo "   SHA256:   $(sha256sum "$DUMP_OUTPUT_PATH" | awk '{print $1}')"

SNAPSHOT_PARSED=$(parse_db_url "$LOCAL_SNAPSHOT_DATABASE_URL")
SNAPSHOT_DB_NAME=$(echo "$SNAPSHOT_PARSED" | sed -n '1p')
SNAPSHOT_ADMIN_URL=$(echo "$SNAPSHOT_PARSED" | sed -n '2p')

echo "----------------------------------------------------------"
echo "🗄️ Restoring into local snapshot database..."
echo "   Target: $LOCAL_SNAPSHOT_DATABASE_URL"

ensure_local_postgres_ready "$LOCAL_SNAPSHOT_DATABASE_URL"
reset_local_database "$LOCAL_SNAPSHOT_DATABASE_URL" "$SNAPSHOT_DB_NAME" "$SNAPSHOT_ADMIN_URL"
"$PG_RESTORE_BIN" --no-owner --no-privileges --clean --if-exists -d "$LOCAL_SNAPSHOT_DATABASE_URL" "$DUMP_OUTPUT_PATH"

TABLE_COUNT=$(psql "$LOCAL_SNAPSHOT_DATABASE_URL" -Atc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")
if [[ "${TABLE_COUNT:-0}" == "0" ]]; then
    echo "❌ Restore validation failed: no tables found in local snapshot database."
    exit 1
fi

if bool_true "$IMPORT_TO_DEV"; then
    DEV_PARSED=$(parse_db_url "$LOCAL_DEV_DATABASE_URL")
    DEV_DB_NAME=$(echo "$DEV_PARSED" | sed -n '1p')
    DEV_ADMIN_URL=$(echo "$DEV_PARSED" | sed -n '2p')

    echo "----------------------------------------------------------"
    echo "🔁 Importing snapshot into local dev database..."
    echo "   Target: $LOCAL_DEV_DATABASE_URL"

    ensure_local_postgres_ready "$LOCAL_DEV_DATABASE_URL"
    reset_local_database "$LOCAL_DEV_DATABASE_URL" "$DEV_DB_NAME" "$DEV_ADMIN_URL"
    "$PG_RESTORE_BIN" --no-owner --no-privileges --clean --if-exists -d "$LOCAL_DEV_DATABASE_URL" "$DUMP_OUTPUT_PATH"
fi

echo "----------------------------------------------------------"
echo "📝 Updating .env.prod with production secrets + local snapshot DATABASE_URL..."

cat << EOF > .env.prod
# Server Configuration (Development mode, but using production data/secrets)
NODE_ENV=development

# URL Configuration (local development with split frontend/backend)
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001

# Runtime database dialect
DB_DIALECT=postgres

# Database (local Postgres snapshot restored from Railway production)
DATABASE_URL=$LOCAL_SNAPSHOT_DATABASE_URL

# Production Strava API Credentials (fetched from Railway)
STRAVA_CLIENT_ID=$P_CLIENT_ID
STRAVA_CLIENT_SECRET=$P_CLIENT_SECRET

# Production Secrets (required to decrypt production token data)
SESSION_SECRET=$P_SESSION_SECRET
TOKEN_ENCRYPTION_KEY=$P_ENCRYPTION_KEY

# Strava Webhook API URL
STRAVA_WEBHOOK_API_URL=http://localhost:4000

# Production Webhook Configuration
WEBHOOK_VERIFY_TOKEN=$P_WEBHOOK_TOKEN
WEBHOOK_PERSIST_EVENTS=true

# Production Admins
ADMIN_ATHLETE_IDS=$P_ADMINS
EOF

echo "   .env.prod updated successfully."
echo "----------------------------------------------------------"
echo "✨ SUCCESS!"
echo "   1) Postgres dump fetched from Railway production"
echo "   2) Local snapshot restored at: $LOCAL_SNAPSHOT_DATABASE_URL"
if bool_true "$IMPORT_TO_DEV"; then
    echo "   3) Local dev database replaced at: $LOCAL_DEV_DATABASE_URL"
fi
echo ""
echo "Next steps:"
echo "   npm run dev:prod-data"
if ! bool_true "$IMPORT_TO_DEV"; then
    echo "   IMPORT_TO_DEV=true npm run db:fetch-prod   # optional: replace local dev DB with snapshot"
fi
