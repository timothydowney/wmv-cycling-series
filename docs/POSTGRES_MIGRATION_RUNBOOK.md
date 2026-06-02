# Postgres Migration Runbook

Local-first Postgres cutover runbook.

This runbook is the source of truth for rehearsal and production cutover decisions.

Local container baseline: PostgreSQL 18 via [docker-compose.yml](docker-compose.yml).
This repo pins `PGDATA=/var/lib/postgresql/data` in local Docker Compose and mounts that same path for deterministic local startup across machines.

Important local isolation note:
- Dev and E2E use the same Postgres container and the same Docker volume.
- Isolation is by database name in `DATABASE_URL`, not by separate volumes.
- Default targets are `wmv_local` for dev and `wmv_e2e` for E2E.

## Guardrails

- Keep production dump and restore tooling reproducible for rehearsal and local review.
- Runtime remains Postgres-only and all production-copy local workflows use Postgres dump/restore.
- Keep a rollback tag on main before merge/cutover. Current checkpoint tag: `pre-postgres-migration-sqlite-20260425`.

## Drizzle Post-Cutover Migration Lifecycle (Postgres Only)

Source of truth for schema evolution:
- Drizzle schema: `server/src/db/schema.ts`
- Applied migration history: `server/drizzle/*.sql` + `server/drizzle/meta/_journal.json`

Standard forward-migration flow:

1. Generate a new migration from schema changes:
```bash
npm run db:generate
```
2. Review generated SQL in `server/drizzle/`.
3. Apply locally:
```bash
DATABASE_URL="postgresql://wmv:wmv@localhost:5432/wmv_local" npm run db:migrate
```
4. Validate migration metadata consistency:
```bash
npm run db:check
```

CI now validates both migration metadata (`db:check`) and clean application against a fresh Postgres database (`db:migrate`).

Verify rollback tag presence on origin:
```bash
npm run db:postgres:verify-rollback-tag
```

## Phase 1: Local Postgres Bootstrap

`npm run dev` and `npm run dev:server` now default to Postgres and automatically ensure Docker Postgres is up when `DATABASE_URL` points to localhost.

1. Start local Postgres:
```bash
npm run db:postgres:up
```
2. Use the default local connection string:
```bash
export DATABASE_URL="postgresql://wmv:wmv@localhost:5432/wmv_local"
```
3. Confirm database is reachable:
```bash
npm run db:postgres:logs
```

Optional convenience startup using standard dev workflow:
```bash
npm run dev:postgres
```

Current branch status: backend runtime is Postgres-only. Bridge scripts and snapshot artifacts remain available only for migration rehearsal and rollback recovery.

## Phase 2: Prepare Postgres Schema

Initialize the local Postgres schema from Drizzle migrations:
```bash
DATABASE_URL="postgresql://wmv:wmv@localhost:5432/wmv_local" npm run db:postgres:bootstrap-schema
```

This applies the Drizzle baseline and any incremental migrations in order.

## Phase 3: Seed Local Postgres Baseline Data

1. Seed the local dev Postgres database from the committed Postgres E2E baseline:
```bash
npm run test:e2e:refresh-seed
npm run dev:server
```

`npm run test:e2e:refresh-seed` refreshes `server/data/wmv_e2e_seed.sql` from `wmv_e2e`.
`npm run dev:server` auto-creates and auto-migrates `wmv_local`, then seeds from that SQL snapshot when the DB is empty.

## Phase 4: Validate Local Runtime

## Phase 5: Local Smoke Validation

After parity passes:

1. Run backend and frontend against Postgres runtime wiring in this branch.
2. Validate core flows:
- Admin login and week management
- Fetch results
- Leaderboard read paths
- Explorer read/write paths
- Webhook event persistence

## Phase 6: E2E Workflow on Postgres

Playwright now boots backend against a dedicated Postgres E2E database.

1. Ensure E2E env points at Postgres:
```bash
cat e2e/.env.e2e
```
2. Run E2E suite:
```bash
npm run test:e2e
```

What happens automatically before backend E2E startup:
- Docker Postgres is started if `DATABASE_URL` host is localhost
- E2E target DB is created if missing
- Schema bootstrap runs
- If the E2E DB is empty, baseline data from `server/data/wmv_e2e_seed.sql` is imported

## Optional: Point E2E at Dev or Prod Snapshot Data

Use env overrides to re-target E2E backend without changing code:

Run E2E against local dev Postgres database:
```bash
ENV_FILE=e2e/.env.e2e DATABASE_URL=postgresql://wmv:wmv@localhost:5432/wmv_local npm run test:e2e
```

Run E2E against a production snapshot restored locally:
```bash
ENV_FILE=e2e/.env.e2e DATABASE_URL=postgresql://wmv:wmv@localhost:5432/wmv_prod_snapshot npm run test:e2e
```

Do not point Playwright at live production.

## Production Cutover Prerequisites

All items below must be true before touching production:

- Local migration rehearsal is repeatable.
- Row-count parity checks pass consistently.
- Postgres runtime path passes lint, typecheck, and tests.
- Rollback runbook is prepared with immutable production dump artifacts.

## Railway Rehearsal via CLI (No Runtime Cutover)

Goal: provision Railway Postgres and validate production Postgres dump restore without deploying the production runtime cutover.

Notes:
- For Railway managed Postgres, you provision a Postgres service, not a manual Docker-style volume mount.
- The `railway volume` commands are for attached app service disks, not for managed Postgres storage.

Preferred one-command workflow:
```bash
npm run db:railway:rehearse-import
```

What this script does safely and idempotently:
- Ensures rehearsal environment exists (`postgres-rehearsal`, duplicated from `production` when needed)
- Ensures a managed Postgres service exists (uses configured name or existing `Postgres` service)
- Fetches the latest production Postgres dump via Railway CLI
- Resolves a local-reachable Railway Postgres URL (`DATABASE_PUBLIC_URL`)
- Restores the dump into rehearsal Postgres and verifies table presence
- Restores the originally linked Railway environment on exit

Optional overrides:
```bash
REHEARSAL_ENV=postgres-rehearsal \
REHEARSAL_DB_SERVICE=wmv-postgres-rehearsal \
PRODUCTION_APP_SERVICE=wmv-cycling-series \
PRODUCTION_ENV=production \
PROD_DUMP_PATH=server/data/wmv_prod.dump \
npm run db:railway:rehearse-import
```

Optional SQL spot-check through Railway CLI:
```bash
railway connect -e postgres-rehearsal Postgres
```

If parity and spot-checks pass, rehearsal is complete and cutover mechanics are validated without switching production runtime.

## Production Configuration Split

Local/dev can ship now with Docker Postgres defaults. Production cutover can remain separate until Railway Postgres is provisioned.

Minimum production env at cutover:
- `DB_DIALECT=postgres`
- `DATABASE_URL=<railway postgres url>`
- existing app vars (`APP_BASE_URL`, Strava secrets, session secret, encryption key)

Use `DATABASE_URL` as the production runtime source of truth.

## Production Cutover Outline

1. Freeze writes in production.
2. Create and checksum a production Postgres dump artifact.
3. Restore the dump into Railway Postgres.
4. Validate parity and smoke checks.
5. Switch runtime to Postgres and deploy.
6. Keep pre-cutover dump artifact during observation window.

## Local Cleanup Commands

Stop local Postgres:
```bash
npm run db:postgres:down
```

Reset local Postgres volume:
```bash
npm run db:postgres:reset
```
