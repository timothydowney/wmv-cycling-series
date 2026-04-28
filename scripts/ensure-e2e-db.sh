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

echo "[e2e-db] E2E Postgres database is ready"
