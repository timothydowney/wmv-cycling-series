#!/bin/bash
set -euo pipefail

# Configuration
REMOTE_DB_PATH="${REMOTE_DB_PATH:-/data/wmv.db}"
LOCAL_DB_PATH="${LOCAL_DB_PATH:-server/data/wmv_prod.db}"
RAILWAY_PROJECT="${RAILWAY_PROJECT:-}"
RAILWAY_SERVICE="${RAILWAY_SERVICE:-wmv-cycling-series}"
RAILWAY_ENVIRONMENT="${RAILWAY_ENVIRONMENT:-production}"

TMP_DOWNLOAD_PATH="${LOCAL_DB_PATH}.tmp"

cleanup() {
    rm -f "$TMP_DOWNLOAD_PATH"
}
trap cleanup EXIT

require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "❌ Missing required command: $1"
        exit 1
    fi
}

is_sha256() {
    [[ "$1" =~ ^[a-f0-9]{64}$ ]]
}

require_cmd railway
require_cmd sha256sum
require_cmd base64
require_cmd gzip
require_cmd jq

RAILWAY_ARGS=(-s "$RAILWAY_SERVICE" -e "$RAILWAY_ENVIRONMENT")
if [[ -n "$RAILWAY_PROJECT" ]]; then
    RAILWAY_ARGS=(-p "$RAILWAY_PROJECT" "${RAILWAY_ARGS[@]}")
fi

# Ensure output directory exists
mkdir -p "$(dirname "$LOCAL_DB_PATH")"

echo "----------------------------------------------------------"
echo "🔍 Fetching checksum from production..."
echo "   Target: service=$RAILWAY_SERVICE environment=$RAILWAY_ENVIRONMENT${RAILWAY_PROJECT:+ project=$RAILWAY_PROJECT}"

if ! railway ssh "${RAILWAY_ARGS[@]}" "test -f '$REMOTE_DB_PATH'" >/dev/null 2>&1; then
    echo "❌ Remote database not found at $REMOTE_DB_PATH for selected service/environment."
    echo "   Tip: verify Railway context or override RAILWAY_SERVICE/RAILWAY_ENVIRONMENT."
    exit 1
fi

RAW_CHECKSUM_OUTPUT=$(railway ssh "${RAILWAY_ARGS[@]}" "sha256sum '$REMOTE_DB_PATH'")
REMOTE_SHA=$(echo "$RAW_CHECKSUM_OUTPUT" | awk '{print $1}' | tr -d '\r\n')

if ! is_sha256 "$REMOTE_SHA"; then
    echo "❌ Invalid checksum response from remote target."
    echo "   Raw response: ${RAW_CHECKSUM_OUTPUT}"
    exit 1
fi

echo "   Remote SHA256: $REMOTE_SHA"

echo "----------------------------------------------------------"
echo "📥 Downloading database..."
# Use gzip + base64 to ensure binary safety and faster transfer over SSH text stream.
railway ssh "${RAILWAY_ARGS[@]}" "gzip -c '$REMOTE_DB_PATH' | base64 -w 0" | base64 -d -i | gunzip > "$TMP_DOWNLOAD_PATH"

if [[ ! -s "$TMP_DOWNLOAD_PATH" ]]; then
    echo "❌ Download produced an empty file."
    exit 1
fi

echo "----------------------------------------------------------"
echo "✅ Verifying local checksum..."
LOCAL_SHA=$(sha256sum "$TMP_DOWNLOAD_PATH" | awk '{print $1}' | tr -d '\r\n')
echo "   Local SHA256:  $LOCAL_SHA"

if [[ "$REMOTE_SHA" != "$LOCAL_SHA" ]]; then
    echo "----------------------------------------------------------"
    echo "❌ ERROR: Checksum mismatch! The file may be corrupted."
    echo "----------------------------------------------------------"
    exit 1
fi

mv "$TMP_DOWNLOAD_PATH" "$LOCAL_DB_PATH"

echo "----------------------------------------------------------"
echo "✨ SUCCESS! Database downloaded and verified."
echo "   Saved to: $LOCAL_DB_PATH"

echo "----------------------------------------------------------"
echo "📝 Updating .env.prod with production secrets..."

# Fetch variables in JSON format for easier parsing
VARS_JSON=$(railway variable list "${RAILWAY_ARGS[@]}" --json)

# Helper function to get value from JSON
get_var() {
    echo "$VARS_JSON" | jq -r --arg key "$1" '.[$key] // ""'
}

P_CLIENT_ID=$(get_var "STRAVA_CLIENT_ID")
P_CLIENT_SECRET=$(get_var "STRAVA_CLIENT_SECRET")
P_SESSION_SECRET=$(get_var "SESSION_SECRET")
P_ENCRYPTION_KEY=$(get_var "TOKEN_ENCRYPTION_KEY")
P_WEBHOOK_TOKEN=$(get_var "WEBHOOK_VERIFY_TOKEN")
P_ADMINS=$(get_var "ADMIN_ATHLETE_IDS")

cat << EOF > .env.prod
# Server Configuration (Development mode, but using production data/secrets)
NODE_ENV=development

# URL Configuration (local development with split frontend/backend)
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001

# Production Strava API Credentials (fetched from Railway)
STRAVA_CLIENT_ID=$P_CLIENT_ID
STRAVA_CLIENT_SECRET=$P_CLIENT_SECRET

# Database (Points to the production copy you just fetched)
DATABASE_PATH=./data/wmv_prod.db

# Production Secrets (REQUIRED to decrypt data in the production DB)
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
