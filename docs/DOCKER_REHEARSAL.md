# Local Docker Rehearsal Against Railway Postgres

Run the current branch code against the Railway rehearsal database — the most production-like local validation path before cutover.

## Prerequisites

1. Populate the rehearsal database (one-time per data refresh):
   ```bash
   npm run db:railway:rehearse-import
   ```
2. Write `.env.rehearsal` from Railway secrets (once per session, or when secrets change):
   ```bash
   npm run rehearsal:env
   ```

## Run

```bash
docker compose -f docker-compose.rehearsal.yml up --build
```

- builds the production image from the current branch source
- injects production-style secrets from `.env.rehearsal`
- connects to the Railway rehearsal Postgres via `DATABASE_PUBLIC_URL` (public proxy — `railway.internal` is not reachable from your laptop)
- app available at `http://localhost:3001`

## Stop

```bash
docker compose -f docker-compose.rehearsal.yml down
```

## Notes

- `.env.rehearsal` is gitignored — it contains live production secrets.
- `APP_BASE_URL` is overridden to `http://localhost:3001` so browser redirects stay local.
- `LOCAL_PORT` env var overrides the port if 3001 is in use (default: `3001`).