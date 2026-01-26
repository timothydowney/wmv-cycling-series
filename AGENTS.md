# Agent Instructions

Quick reference for agents and automation tools working with this repository.

## npm Tasks - Quick Reference

### Development

```bash
npm run dev           # Start both frontend + backend servers (interactive)
npm run dev:cleanup  # Stop all servers cleanly
```

When running `npm run dev`:
- Frontend (Vite): http://localhost:5173
- Backend (Express): http://localhost:3001
- Both have hot-reload
- Stop with `Ctrl+C`

### Testing

```bash
npm test             # Run unit tests (backend, in-memory SQLite)
npm run test:watch   # Watch mode (re-run tests on file changes)
npm run test:e2e     # Run E2E tests (headless, uses wmv_e2e.db)
npm run test:e2e:headed  # E2E tests with visible browser
npm run test:e2e:ui      # Playwright UI mode (interactive debugging)
```

**Important:** E2E tests use separate database (`wmv_e2e.db`) from development.

### Building & Deployment

```bash
npm run build        # Build both frontend + backend for production
npm run lint         # Lint both frontend + backend
npm run typecheck    # Typecheck both frontend + backend
npm run audit        # Security audit (frontend + backend)
```

## Database Files & Environments

### Local Development

- **File:** `server/data/wmv.db`
- **Environment:** `.env`
- **Purpose:** Local development database
- **Setup:** Auto-created on first run
- **Usage:** Used by `npm run dev`, `npm test`, and other dev tasks

### E2E Testing

- **File:** `server/data/wmv_e2e.db`
- **Environment:** `e2e/.env.e2e`
- **Purpose:** Production copy for E2E test validation
- **Setup:** Pre-populated with test data (weeks 215-223)
- **Usage:** Used by `npm run test:e2e*` tasks
- **Important:** Do not modify this database; it's read-only for testing

### Production

- **File:** `server/data/wmv_prod.db`
- **Environment:** `.env.prod` (Railway)
- **Purpose:** Live production database
- **Location:** Railway persistent volume at `/data/wmv.db`

## When to Use Which Task

| Scenario | Command | Database | Why |
|----------|---------|----------|-----|
| Local development | `npm run dev` | wmv.db | Interactive frontend + backend |
| Running unit tests | `npm test` | in-memory | Fast, isolated tests |
| Running E2E tests | `npm run test:e2e` | wmv_e2e.db | Test against prod-like data |
| Verifying prod build | `npm run build` | (doesn't use) | Ensure TypeScript compiles, Vite builds |
| Pre-commit checks | `npm run lint` + `npm run typecheck` | (doesn't use) | Catch errors before commit |
| Security review | `npm run audit` | (doesn't use) | Check dependencies for vulnerabilities |

## Key Rules for Agents

1. **Always verify Node version before starting dev:**
   ```bash
   node --version  # Must be v24.x.x
   npm run dev     # predev will validate
   ```

2. **Use correct environment files:**
   - Dev tasks → `.env` (uses wmv.db)
   - E2E tasks → `e2e/.env.e2e` (uses wmv_e2e.db)
   - Production → `.env.prod` (Railway secrets)

3. **Never mix databases:**
   - If modifying E2E database, you've made a mistake
   - If running `npm run dev` with wmv_e2e.db, you're in wrong environment
   - If running `npm test` with production database, you're in wrong environment

4. **Clean shutdown:**
   - When stopping dev: Always use `npm run dev:cleanup` (not `pkill`/`killall`)
   - Check: `npm run dev:cleanup` removes any orphaned processes

5. **Database persistence:**
   - wmv.db changes persist between dev sessions ✅
   - wmv_e2e.db should remain unchanged (test data integrity)
   - Unit tests use in-memory DB (no persistence needed)

## Special Tasks

| Task | Purpose | When to Use |
|------|---------|-------------|
| `npm run mock:strava` | Mock Strava API server (port 8002) | Testing OAuth without real Strava |
| `npm run mock:strava:kill` | Stop mock Strava server | After testing OAuth locally |
| `npm run db:fetch-prod` | Download production database | To test against real data locally |
| `npm run webhook:emit` | Emit test webhook events | Testing webhook handler logic |
| `npm run test:e2e:report` | View test report | After E2E test failures |

## Troubleshooting

### "node: command not found"
```bash
nvm use 24
node --version
```

### "Port 3001 already in use"
```bash
npm run dev:cleanup
npm run dev
```

### "Cannot find module better-sqlite3"
```bash
cd server && npm install
cd ..
npm run dev
```

### E2E tests fail with "database is locked"
- Check that `npm run dev` is not running
- Check that no other test session is active
- Run: `npm run dev:cleanup` then `npm run test:e2e`

### Wrong database being used
- Verify environment file: `cat .env | grep DATABASE_PATH`
- Dev: should be `./data/wmv.db`
- E2E: should be `./data/wmv_e2e.db`
- If wrong, check which env file is loaded

## Documentation

For detailed information, see:
- **Quick start:** [docs/QUICK_START.md](./docs/QUICK_START.md)
- **Architecture:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Database design:** [docs/DATABASE_DESIGN.md](./docs/DATABASE_DESIGN.md)
- **Strava integration:** [docs/STRAVA_INTEGRATION.md](./docs/STRAVA_INTEGRATION.md)
- **API reference:** [docs/API.md](./docs/API.md)
- **Deployment:** [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

## CI/CD Pipeline

The `.github/workflows/ci.yml` pipeline runs:
1. Lint (frontend + backend): `npm run lint`
2. Typecheck (frontend + backend): `npm run typecheck`
3. Build (frontend + backend): `npm run build`
4. Test (backend): `npm test`
5. Docker build validation

All must pass before merge to main branch.

---

**Last Updated:** January 2026  
**Node Version:** 24.x  
**Database:** SQLite (better-sqlite3)
