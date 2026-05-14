#!/usr/bin/env bash
set -euo pipefail

ENV_PATH="${ENV_FILE:-.env}"

if [[ -f "$ENV_PATH" ]]; then
  # shellcheck disable=SC1090
  set -a
  . "$ENV_PATH"
  set +a
fi

DB_DIALECT_VALUE="${DB_DIALECT:-postgres}"
DATABASE_URL_VALUE="${DATABASE_URL:-postgresql://wmv:wmv@localhost:5432/wmv_local}"
AUTO_BOOTSTRAP_VALUE="${WMV_AUTO_BOOTSTRAP_DB:-true}"
SEED_SQL_PATH_VALUE="${WMV_DEV_SEED_SQL_PATH:-server/data/wmv_e2e_seed.sql}"
SKIP_DEV_SEED_RAW_VALUE="${WMV_SKIP_DEV_SEED:-}"
ALLOW_DEV_LOCAL_SEED_VALUE="${WMV_ALLOW_DEV_LOCAL_SEED:-false}"

if [[ "$DB_DIALECT_VALUE" != "postgres" ]]; then
  echo "[dev-db] ERROR: runtime is Postgres-only in this branch, but DB_DIALECT=${DB_DIALECT_VALUE}"
  echo "[dev-db] Set DB_DIALECT=postgres and DATABASE_URL (or use defaults for localhost)."
  exit 1
fi

if [[ -z "$DATABASE_URL_VALUE" ]]; then
  echo "[dev-db] ERROR: DB_DIALECT=postgres requires DATABASE_URL"
  exit 1
fi

DATABASE_HOST_VALUE=$(node -e "const u = new URL(process.argv[1]); console.log(u.hostname);" "$DATABASE_URL_VALUE")
DATABASE_NAME_VALUE=$(node -e "const u = new URL(process.argv[1]); console.log(u.pathname.replace(/^\//, ''));" "$DATABASE_URL_VALUE")
DATABASE_ADMIN_URL_VALUE=$(node -e "const u = new URL(process.argv[1]); u.pathname = '/postgres'; u.search = ''; console.log(u.toString());" "$DATABASE_URL_VALUE")

if [[ -z "$DATABASE_NAME_VALUE" ]]; then
  echo "[dev-db] ERROR: DATABASE_URL must include a database name"
  exit 1
fi

if [[ -n "$SKIP_DEV_SEED_RAW_VALUE" ]]; then
  SKIP_DEV_SEED_VALUE="$SKIP_DEV_SEED_RAW_VALUE"
elif [[ "$DATABASE_NAME_VALUE" == "wmv_local" && "$ALLOW_DEV_LOCAL_SEED_VALUE" != "true" ]]; then
  # Guardrail: never overwrite a personal local dev DB with the shared E2E seed unless explicitly requested.
  SKIP_DEV_SEED_VALUE="true"
else
  SKIP_DEV_SEED_VALUE="false"
fi

if [[ "$DATABASE_HOST_VALUE" != "localhost" && "$DATABASE_HOST_VALUE" != "127.0.0.1" ]]; then
  echo "[dev-db] Using non-local Postgres host (${DATABASE_HOST_VALUE}); skipping Docker startup"
  exit 0
fi

POSTGRES_USER_VALUE="${POSTGRES_USER:-wmv}"
POSTGRES_READY_DB_VALUE="${POSTGRES_READY_DB:-postgres}"

if [[ "${WMV_SKIP_DOCKER_STARTUP:-false}" == "true" ]]; then
  echo "[dev-db] WMV_SKIP_DOCKER_STARTUP=true — skipping Docker Compose startup (assuming Postgres is already running)"
  # Wait for Postgres to be ready using pg_isready from the system path or node pg client.
  for attempt in $(seq 1 20); do
    if (cd server && node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.argv[1] });
c.connect().then(() => { c.end(); process.exit(0); }).catch(() => process.exit(1));" \
"$DATABASE_ADMIN_URL_VALUE" 2>/dev/null); then
      echo "[dev-db] Postgres is ready"
      break
    fi
    sleep 1
    echo "[dev-db] Waiting for Postgres... (${attempt}/20)"
  done

  if ! (cd server && node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.argv[1] });
c.connect().then(() => { c.end(); process.exit(0); }).catch(() => process.exit(1));" \
"$DATABASE_ADMIN_URL_VALUE" 2>/dev/null); then
    echo "[dev-db] ERROR: Postgres is not reachable with WMV_SKIP_DOCKER_STARTUP=true"
    echo "[dev-db] Verify DATABASE_URL host/port and that Postgres is running before retrying."
    exit 1
  fi
else
  if ! command -v docker >/dev/null 2>&1; then
    echo "[dev-db] ERROR: docker is required for local Postgres host (${DATABASE_HOST_VALUE})"
    exit 1
  fi

  echo "[dev-db] Ensuring local Postgres container is running"
  docker compose up -d postgres >/dev/null

  for attempt in $(seq 1 40); do
    if docker compose exec -T postgres pg_isready -U "$POSTGRES_USER_VALUE" -d "$POSTGRES_READY_DB_VALUE" >/dev/null 2>&1; then
      echo "[dev-db] Postgres is ready"
      break
    fi
    sleep 1
    echo "[dev-db] Waiting for Postgres... (${attempt}/40)"
  done

  if ! docker compose exec -T postgres pg_isready -U "$POSTGRES_USER_VALUE" -d "$POSTGRES_READY_DB_VALUE" >/dev/null 2>&1; then
    echo "[dev-db] ERROR: Timed out waiting for Postgres to become ready"
    echo "[dev-db] Check container logs with: npm run db:postgres:logs"
    echo "[dev-db] If logs mention PostgreSQL 18 layout/upgrade conflicts, reset local volume with: npm run db:postgres:reset"
    exit 1
  fi
fi

if [[ "$AUTO_BOOTSTRAP_VALUE" != "true" ]]; then
  exit 0
fi

echo "[dev-db] Ensuring target database exists"
node server/scripts/ensure-postgres-db.js --url "$DATABASE_URL_VALUE" >/dev/null

TABLE_EXISTS=$(cd server && node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.argv[1] });
c.connect()
  .then(() => c.query(\"SELECT to_regclass('public.participant') IS NOT NULL AS exists\"))
  .then(r => { console.log(r.rows[0].exists ? 't' : 'f'); })
  .catch(() => { console.log('f'); })
  .finally(() => c.end());
" "$DATABASE_URL_VALUE" 2>/dev/null)

SCHEMA_WAS_BOOTSTRAPPED="false"

if [[ "$TABLE_EXISTS" != "t" ]]; then
  echo "[dev-db] Bootstrapping Postgres schema"
  DATABASE_URL="$DATABASE_URL_VALUE" npm --prefix server run db:pg:bootstrap:schema >/dev/null
  SCHEMA_WAS_BOOTSTRAPPED="true"
fi

if [[ "$SKIP_DEV_SEED_VALUE" == "true" ]]; then
  if [[ "$DATABASE_NAME_VALUE" == "wmv_local" && "$ALLOW_DEV_LOCAL_SEED_VALUE" != "true" && -z "$SKIP_DEV_SEED_RAW_VALUE" ]]; then
    echo "[dev-db] Auto-seed disabled for wmv_local by default; leaving database unseeded"
    echo "[dev-db] Set WMV_ALLOW_DEV_LOCAL_SEED=true (or WMV_SKIP_DEV_SEED=false) to opt into seed import"
  else
    echo "[dev-db] WMV_SKIP_DEV_SEED=true, leaving database unseeded"
  fi
  exit 0
fi

PARTICIPANT_COUNT=$(cd server && node -e "
const { Client } = require('pg');
const c = new Client({ connectionString: process.argv[1] });
c.connect()
  .then(() => c.query('SELECT COUNT(*)::int AS count FROM participant'))
  .then(r => { console.log(r.rows[0].count); })
  .catch(() => { console.log('0'); })
  .finally(() => c.end());
" "$DATABASE_URL_VALUE" 2>/dev/null)

if [[ "${PARTICIPANT_COUNT:-0}" == "0" ]]; then
  if [[ -f "$SEED_SQL_PATH_VALUE" ]]; then
    echo "[dev-db] Seeding development database from Postgres seed (${SEED_SQL_PATH_VALUE})"
    DATABASE_URL="$DATABASE_URL_VALUE" node server/scripts/import-postgres-seed.js \
      --postgres "$DATABASE_URL_VALUE" \
      --sql "$SEED_SQL_PATH_VALUE" >/dev/null
  else
    if [[ "$SCHEMA_WAS_BOOTSTRAPPED" == "true" ]]; then
      echo "[dev-db] Seed file not found at ${SEED_SQL_PATH_VALUE}; leaving bootstrapped schema empty"
    else
      echo "[dev-db] Existing schema detected and seed file missing; preserving current database state"
    fi
  fi
else
  echo "[dev-db] Existing Postgres data detected (${PARTICIPANT_COUNT} participants); skipping seed"
fi

exit 0
