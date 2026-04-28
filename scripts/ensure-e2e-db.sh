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
  SOURCE_SQLITE="${WMV_E2E_SOURCE_DATABASE_PATH:-server/data/wmv_e2e_fixture.db}"
  SOURCE_SQLITE_ABS=$(node -e "const path = require('path'); console.log(path.resolve(process.cwd(), process.argv[1]));" "$SOURCE_SQLITE")

  if [[ ! -f "$SOURCE_SQLITE_ABS" ]]; then
    echo "[e2e-db] ERROR: source fixture not found at $SOURCE_SQLITE (resolved: $SOURCE_SQLITE_ABS)"
    exit 1
  fi

  echo "[e2e-db] Resetting Postgres E2E data from SQLite fixture: $SOURCE_SQLITE_ABS"
  DATABASE_URL="$DATABASE_URL" npm --prefix server run db:pg:migrate:from-sqlite -- \
    --sqlite "$SOURCE_SQLITE_ABS" \
    --source-env e2e-sqlite-fixture \
    --target-env e2e-postgres \
    --confirm-destructive >/dev/null
fi

echo "[e2e-db] E2E Postgres database is ready"
