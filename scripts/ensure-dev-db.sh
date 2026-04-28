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
DEV_SOURCE_SQLITE_VALUE="${WMV_DEV_SOURCE_SQLITE_PATH:-}"
FORCE_DEV_IMPORT_VALUE="${WMV_FORCE_DEV_SQLITE_IMPORT:-false}"

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

if [[ -z "$DATABASE_NAME_VALUE" ]]; then
  echo "[dev-db] ERROR: DATABASE_URL must include a database name"
  exit 1
fi

if [[ "$DATABASE_HOST_VALUE" != "localhost" && "$DATABASE_HOST_VALUE" != "127.0.0.1" ]]; then
  echo "[dev-db] Using non-local Postgres host (${DATABASE_HOST_VALUE}); skipping Docker startup"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[dev-db] ERROR: docker is required for local Postgres host (${DATABASE_HOST_VALUE})"
  exit 1
fi

echo "[dev-db] Ensuring local Postgres container is running"
docker compose up -d postgres >/dev/null

POSTGRES_USER_VALUE="${POSTGRES_USER:-wmv}"
POSTGRES_DB_VALUE="${POSTGRES_DB:-$DATABASE_NAME_VALUE}"

for attempt in $(seq 1 40); do
  if docker compose exec -T postgres pg_isready -U "$POSTGRES_USER_VALUE" -d "$POSTGRES_DB_VALUE" >/dev/null 2>&1; then
    echo "[dev-db] Postgres is ready"
    break
  fi
  sleep 1
  echo "[dev-db] Waiting for Postgres... (${attempt}/40)"
done

if ! docker compose exec -T postgres pg_isready -U "$POSTGRES_USER_VALUE" -d "$POSTGRES_DB_VALUE" >/dev/null 2>&1; then
  echo "[dev-db] ERROR: Timed out waiting for Postgres to become ready"
  echo "[dev-db] Check container logs with: npm run db:postgres:logs"
  echo "[dev-db] If logs mention PostgreSQL 18 layout/upgrade conflicts, reset local volume with: npm run db:postgres:reset"
  exit 1
fi

if [[ "$AUTO_BOOTSTRAP_VALUE" != "true" ]]; then
  exit 0
fi

echo "[dev-db] Ensuring target database exists"
node server/scripts/ensure-postgres-db.js --url "$DATABASE_URL_VALUE" >/dev/null

TABLE_EXISTS=$(docker compose exec -T postgres psql -U "$POSTGRES_USER_VALUE" -d "$POSTGRES_DB_VALUE" -tAc "SELECT to_regclass('public.participant') IS NOT NULL")

SHOULD_IMPORT_SQLITE="false"

if [[ "$TABLE_EXISTS" != "t" ]]; then
  echo "[dev-db] Bootstrapping Postgres schema"
  DATABASE_URL="$DATABASE_URL_VALUE" npm --prefix server run db:pg:bootstrap:schema >/dev/null

  SHOULD_IMPORT_SQLITE="true"
fi

if [[ "$FORCE_DEV_IMPORT_VALUE" == "true" ]]; then
  echo "[dev-db] WMV_FORCE_DEV_SQLITE_IMPORT=true, forcing SQLite -> Postgres import"
  SHOULD_IMPORT_SQLITE="true"
fi

if [[ "$SHOULD_IMPORT_SQLITE" == "true" ]]; then
  if [[ -z "$DEV_SOURCE_SQLITE_VALUE" ]]; then
    if [[ -f "server/data/wmv.db" ]]; then
      DEV_SOURCE_SQLITE_VALUE="server/data/wmv.db"
    elif [[ -f "server/data/wmv.sqllite.db" ]]; then
      DEV_SOURCE_SQLITE_VALUE="server/data/wmv.sqllite.db"
    fi
  fi

  if [[ -n "$DEV_SOURCE_SQLITE_VALUE" ]]; then
    DEV_SOURCE_SQLITE_ABS=$(node -e "const path = require('path'); console.log(path.resolve(process.cwd(), process.argv[1]));" "$DEV_SOURCE_SQLITE_VALUE")
  else
    DEV_SOURCE_SQLITE_ABS=""
  fi

  if [[ -n "$DEV_SOURCE_SQLITE_ABS" && -f "$DEV_SOURCE_SQLITE_ABS" ]]; then
    echo "[dev-db] Importing baseline data from SQLite source: $DEV_SOURCE_SQLITE_ABS"
    DATABASE_URL="$DATABASE_URL_VALUE" npm --prefix server run db:pg:migrate:from-sqlite -- \
      --sqlite "$DEV_SOURCE_SQLITE_ABS" \
      --source-env dev-sqlite \
      --target-env dev-postgres \
      --confirm-destructive >/dev/null
  else
    echo "[dev-db] SQLite source not found (checked: ${DEV_SOURCE_SQLITE_ABS:-none}); skipping import"
  fi
else
  echo "[dev-db] Existing schema detected; using current Postgres data (set WMV_FORCE_DEV_SQLITE_IMPORT=true to re-import from SQLite)"
fi

exit 0
