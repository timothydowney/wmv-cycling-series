#!/bin/bash

# Configuration
REMOTE_DB_PATH="/data/wmv.db"
LOCAL_DB_PATH="server/data/wmv_prod.db"

# Ensure server/data directory exists
mkdir -p server/data

echo "----------------------------------------------------------"
echo "🔍 Fetching checksum from production..."
REMOTE_SHA=$(railway ssh "sha256sum $REMOTE_DB_PATH" | awk '{print $1}' | tr -d '\r\n')

if [ -z "$REMOTE_SHA" ]; then
    echo "❌ Error: Could not retrieve remote checksum. Make sure you are logged into railway CLI."
    exit 1
fi

echo "   Remote SHA256: $REMOTE_SHA"

echo "----------------------------------------------------------"
echo "📥 Downloading database..."
# Use gzip + base64 to ensure binary safety and faster transfer over SSH text stream
# -w 0 disables line wrapping to prevent issues with text-stream processing
railway ssh "gzip -c $REMOTE_DB_PATH | base64 -w 0" | base64 -d -i | gunzip > "$LOCAL_DB_PATH"

echo "----------------------------------------------------------"
echo "✅ Verifying local checksum..."
LOCAL_SHA=$(sha256sum "$LOCAL_DB_PATH" | awk '{print $1}' | tr -d '\r\n')
echo "   Local SHA256:  $LOCAL_SHA"

if [ "$REMOTE_SHA" == "$LOCAL_SHA" ]; then
    echo "----------------------------------------------------------"
    echo "✨ SUCCESS! Database downloaded and verified."
    echo "   Saved to: [server/data/wmv_prod.db](server/data/wmv_prod.db)"
    
    echo "----------------------------------------------------------"
    echo "📝 Updating .env.prod with production secrets..."
    
    # Fetch variables in JSON format for easier parsing
    VARS_JSON=$(railway variables --json)
    
    # Helper function to get value from JSON
    get_var() {
      echo "$VARS_JSON" | jq -r ".$1 // \"\""
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
else
    echo "----------------------------------------------------------"
    echo "❌ ERROR: Checksum mismatch! The file may be corrupted."
    echo "----------------------------------------------------------"
    exit 1
fi
