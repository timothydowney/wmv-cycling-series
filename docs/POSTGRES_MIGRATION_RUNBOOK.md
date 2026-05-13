# Postgres Migration Runbook

Local-first migration from SQLite to Postgres.

This runbook is the source of truth for rehearsal and production cutover decisions.

Local container baseline: PostgreSQL 18 via [docker-compose.yml](docker-compose.yml).
This repo pins `PGDATA=/var/lib/postgresql/data` in local Docker Compose and mounts that same path for deterministic local startup across machines.

Important local isolation note:
- Dev and E2E use the same Postgres container and the same Docker volume.
- Isolation is by database name in `DATABASE_URL`, not by separate volumes.
- Default targets are `wmv_local` for dev and `wmv_e2e` for E2E.

## Guardrails

- Keep SQLite-to-Postgres migration tooling in this branch until production cutover succeeds.
- Runtime can move to Postgres-only, but migration bridge scripts must remain available.
- Do not delete SQLite snapshots used for cutover rehearsal.
- Keep a rollback tag on main before merge/cutover. Current checkpoint tag: `pre-postgres-migration-sqlite-20260425`.

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

Current branch status: backend runtime is Postgres-only. SQLite is retained only as an export/import bridge during migration and rollback rehearsal.

## Phase 2: Prepare Postgres Schema

Initialize the local Postgres schema bridge:
```bash
DATABASE_URL="postgresql://wmv:wmv@localhost:5432/wmv_local" npm run db:postgres:bootstrap-schema
```

This creates all current application tables and indexes in local Postgres to enable data import rehearsal.

## Phase 3: Migrate Local SQLite Dev Data

1. Migrate the local dev SQLite database:
```bash
npm run db:postgres:migrate-dev
```

By default this reads `server/data/wmv.db` and writes to `DATABASE_URL`.

## Phase 4: Validate Local Parity

Run row-count parity check:
```bash
npm run db:postgres:verify-dev
```

If parity fails, stop and inspect source rows and failed tables before continuing.

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
- If `WMV_E2E_RESET_DB_ON_BOOT=true`, fixture data from `server/data/wmv_e2e_fixture.db` is imported

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
- Rollback runbook is prepared with immutable SQLite snapshot artifacts.

## Railway Rehearsal via CLI (No Runtime Cutover)

Goal: provision Railway Postgres and validate SQLite -> Postgres export/import without deploying the Postgres runtime path.

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
- Fetches the latest production SQLite snapshot with checksum verification
- Resolves a local-reachable Railway Postgres URL (`DATABASE_PUBLIC_URL`)
- Bootstraps schema, imports snapshot, and verifies row-count parity
- Restores the originally linked Railway environment on exit

Optional overrides:
```bash
REHEARSAL_ENV=postgres-rehearsal \
REHEARSAL_DB_SERVICE=wmv-postgres-rehearsal \
PRODUCTION_APP_SERVICE=wmv-cycling-series \
PRODUCTION_ENV=production \
SQLITE_SNAPSHOT_PATH=server/data/wmv_prod.db \
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

Keep `DATABASE_PATH` only for rollback bridge tooling during observation window; runtime will use `DATABASE_URL`.

## Production Cutover Outline

1. Freeze writes in production.
2. Snapshot and checksum the production SQLite database.
3. Import snapshot into Railway Postgres.
4. Validate parity and smoke checks.
5. Switch runtime to Postgres and deploy.
6. Keep pre-cutover SQLite artifact during observation window.

## Post-Cutover: Schema Change Workflow

After production cutover, all schema changes go through Drizzle migrations. This is the canonical path for every schema change from this point forward.

### Making a Schema Change

1. **Edit `server/src/db/schema.ts`** — the single source of truth for all Postgres table definitions.

2. **Generate the migration file:**
   ```bash
   DATABASE_URL="******localhost:5432/wmv_local" npm run db:generate
   ```
   This runs `drizzle-kit generate` and writes a new numbered SQL file to `server/drizzle/` and updates `server/drizzle/meta/_journal.json`.

3. **Review the generated SQL** in `server/drizzle/<number>_<name>.sql` before applying. Never edit the baseline or previously-applied migrations.

4. **Apply locally:**
   ```bash
   DATABASE_URL="******localhost:5432/wmv_local" npm run db:migrate
   ```
   Or just start the dev server — migrations apply automatically at startup:
   ```bash
   npm run dev
   ```

5. **Commit both the schema change and the migration file** together in the same PR.

6. **Production apply** — migrations run automatically when the new server binary starts on Railway. No manual step is required after deploy.

### How It Works

- `server/drizzle/0000_postgres_baseline.sql` is the single baseline representing the full schema at Postgres cutover. It is applied by Drizzle on fresh databases (new dev environments, CI).
- Drizzle tracks applied migrations in the `drizzle.__drizzle_migrations` table.
- On databases bootstrapped before this workflow was adopted, the server automatically stamps the baseline as already-applied (detected by the absence of the `drizzle` schema on a non-empty database).
- Every subsequent schema change goes through `db:generate` → review → `db:migrate`.

### Generating Without a Live DB

`drizzle-kit generate` reads `schema.ts` and compares against the last snapshot in `drizzle/meta/`. It does not require a live database connection:

```bash
npm run db:generate
# → prompts for migration name, writes server/drizzle/<N>_<name>.sql
```

### CI Validation

The CI build runs `npm run build` which compiles TypeScript and will catch schema/type mismatches. Migrations themselves are applied by the server at startup and are not run as a separate CI step — add a migration smoke test if that becomes a requirement.

## Local Cleanup Commands

Stop local Postgres:
```bash
npm run db:postgres:down
```

Reset local Postgres volume:
```bash
npm run db:postgres:reset
```

