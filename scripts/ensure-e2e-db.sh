
#!/usr/bin/env bash
set -euo pipefail

ENV_PATH="${ENV_FILE:-e2e/.env.e2e}"

if [[ -f "$ENV_PATH" ]]; then
  # shellcheck disable=SC1090
  set -a
  . "$ENV_PATH"
  set +a
fi

DATABASE_URL="${DATABASE_URL:-postgresql://wmv:wmv@localhost:5432/wmv_e2e}"
SEED_SQL_PATH="${SEED_SQL_PATH:-server/data/wmv_e2e_seed.sql}"

# Ensure local Postgres runtime is reachable for localhost targets.
DB_DIALECT=postgres DATABASE_URL="$DATABASE_URL" WMV_AUTO_BOOTSTRAP_DB=false bash scripts/ensure-dev-db.sh

# Always ensure the E2E DB exists and schema is bootstrapped before seeding.
echo "[e2e-db] Ensuring target Postgres database exists"
node server/scripts/ensure-postgres-db.js --url "$DATABASE_URL"

echo "[e2e-db] Bootstrapping schema (always, for E2E)"
DATABASE_URL="$DATABASE_URL" npm --prefix server run db:pg:bootstrap:schema

# Verify that the schema is actually in place after the migration attempt.
DB_SCHEMA_OK=$(cd server && node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.argv[1] });
c.connect()
  .then(() => c.query(\"SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='participant'\"))
  .then(r => { console.log(r.rowCount > 0 ? 'ok' : 'missing'); })
  .catch(() => { console.log('missing'); })
  .finally(() => c.end());
" "$DATABASE_URL" 2>/dev/null)

if [[ "$DB_SCHEMA_OK" != "ok" ]]; then
  echo "[e2e-db] ERROR: schema bootstrap failed — participant table is missing"
  exit 1
fi

# Seed from the committed Postgres seed when the DB is empty (e.g., fresh CI environment).
PARTICIPANT_COUNT=$(cd server && node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.argv[1] });
c.connect()
  .then(() => c.query('SELECT COUNT(*) AS count FROM participant'))
  .then(r => { console.log(r.rows[0].count); })
  .catch(() => { console.log('0'); })
  .finally(() => c.end());
" "$DATABASE_URL" 2>/dev/null)

if [[ "${PARTICIPANT_COUNT:-0}" == "0" ]]; then
  if [[ -f "$SEED_SQL_PATH" ]]; then
    echo "[e2e-db] Seeding E2E database from Postgres seed (${SEED_SQL_PATH})"
    DATABASE_URL="$DATABASE_URL" node server/scripts/import-postgres-seed.js \
      --postgres "$DATABASE_URL" \
      --sql "$SEED_SQL_PATH"
  else
    echo "[e2e-db] WARNING: seed file not found at ${SEED_SQL_PATH}; E2E DB will be empty"
  fi
else
  echo "[e2e-db] E2E database already has data (${PARTICIPANT_COUNT} participants), skipping seed"
fi

if [[ "${WMV_E2E_RESET_DB_ON_BOOT:-false}" == "true" ]]; then
  echo "[e2e-db] ERROR: WMV_E2E_RESET_DB_ON_BOOT=true is no longer supported by scripts/ensure-e2e-db.sh."
  echo "[e2e-db] Automatic reset-on-boot is not supported. Drop and recreate the Postgres database, then rerun this script."
  echo "[e2e-db] Supported reset workflow: drop and recreate the Postgres database referenced by DATABASE_URL (for local E2E this is usually wmv_e2e), then rerun this script to recreate the schema."
  exit 1
fi

echo "[e2e-db] E2E Postgres database is ready"
