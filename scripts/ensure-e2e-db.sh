#!/usr/bin/env bash
set -euo pipefail

ENV_PATH="${ENV_FILE:-e2e/.env.e2e}"

if [[ -f "$ENV_PATH" ]]; then
  # shellcheck disable=SC1090
  set -a
  . "$ENV_PATH"
  set +a
fi

export DB_DIALECT="${DB_DIALECT:-postgres}"
export DATABASE_URL="${DATABASE_URL:-postgresql://wmv:wmv@localhost:5432/wmv_e2e}"
export WMV_AUTO_BOOTSTRAP_DB=false

bash scripts/ensure-dev-db.sh

echo "[e2e-db] Ensuring target Postgres database exists"
node server/scripts/ensure-postgres-db.js --url "$DATABASE_URL"

echo "[e2e-db] Ensuring schema exists"
DATABASE_URL="$DATABASE_URL" npm --prefix server run db:pg:bootstrap:schema >/dev/null

if [[ "${WMV_E2E_RESET_DB_ON_BOOT:-false}" == "true" ]]; then
  echo "[e2e-db] ERROR: WMV_E2E_RESET_DB_ON_BOOT=true is no longer supported by scripts/ensure-e2e-db.sh."
  echo "[e2e-db] The legacy SQLite fixture import/reset flow has been removed, so WMV_E2E_RESET_DB_ON_BOOT and WMV_E2E_SOURCE_DATABASE_PATH are ignored here."
  echo "[e2e-db] Supported reset workflow: drop and recreate the Postgres database referenced by DATABASE_URL (for local E2E this is usually wmv_e2e), then rerun this script to recreate the schema."
  exit 1
fi

echo "[e2e-db] E2E Postgres database is ready"
