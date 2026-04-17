# Agent Instructions

Quick reference for agents and automation tools working with this repository.

This file is the canonical operations reference for shared agents in this repo. Custom agents and prompts should prefer linking here instead of restating command catalogs, environment rules, or validation sequences in full.

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
npm test             # Run frontend Vitest + backend Jest tests
npm run test:watch   # Watch mode (re-run tests on file changes)
npm run test:e2e     # Run E2E tests (headless, uses the Playwright E2E env)
npm run test:e2e:headed  # E2E tests with visible browser
npm run test:e2e:ui      # Playwright UI mode (interactive debugging)
```

**Important:** Treat Playwright as a dedicated E2E environment, not as an implicit extension of normal local development. `npm run test:e2e` sets `ENV_FILE` for the Playwright process, but the frontend and backend still need to be started with the intended E2E wiring; the harness should declare that wiring explicitly and fail fast when it is missing.

For UI work, prefer focused unit tests first and add Playwright only where browser integration is the point of the change. Use the hardened E2E harness for auth, route wiring, and full-stack mutation flows that unit tests cannot prove reliably.

### Building & Deployment

```bash
npm run build        # Build both frontend + backend for production
npm run lint         # Lint both frontend + backend
npm run typecheck    # Typecheck both frontend + backend
npm run audit        # Security audit (frontend + backend)
```

Before merging or opening a substantive PR, run `npm run audit` locally alongside lint, typecheck, tests, and build so CI is not the first place dependency vulnerabilities are discovered.

## Database Files & Environments

### Local Development

- **File:** `server/data/wmv.db`
- **Environment:** `.env`
- **Purpose:** Local development database
- **Setup:** Auto-created on first run
- **Usage:** Used by `npm run dev`, `npm test`, and other dev tasks

### E2E Testing

- **Environment:** `e2e/.env.e2e`
- **Purpose:** Dedicated backend/runtime wiring for deterministic browser tests
- **Current reality:** If the backend is started without `ENV_FILE=e2e/.env.e2e` or equivalent E2E wiring, config can still use the default `.env`, so do not assume isolation unless the harness explicitly verifies it
- **Expected direction:** Use an explicit backend E2E mode plus explicit provider selection for outbound integrations, and fail fast when the intended E2E setup is absent
- **Usage:** Used by `npm run test:e2e*` tasks

### Production

- **File:** `server/data/wmv_prod.db`
- **Environment:** `.env.prod` (Railway)
- **Purpose:** Live production database
- **Location:** Railway persistent volume at `/data/wmv.db`

## When to Use Which Task

| Scenario | Command | Database | Why |
|----------|---------|----------|-----|
| Local development | `npm run dev` | wmv.db | Interactive frontend + backend |
| Running unit tests | `npm test` | frontend: none, backend: in-memory | Fast, isolated tests across frontend + backend |
| Running E2E tests | `npm run test:e2e` | explicit E2E env | Test against deterministic, intentionally wired backend behavior |
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
   - E2E tasks → `e2e/.env.e2e` (must declare E2E wiring explicitly and should fail fast if missing)
   - Production → `.env.prod` (Railway secrets)

3. **Never mix databases:**
   - Do not let Playwright silently reuse shared dev state
   - If E2E behavior depends on a separate DB or fixtures, verify the harness selected them explicitly
   - If running `npm test` with production database, you're in wrong environment

4. **Clean shutdown:**
   - When stopping dev: Always use `npm run dev:cleanup` (not `pkill`/`killall`)
   - Check: `npm run dev:cleanup` removes any orphaned processes

5. **E2E harness consistency:**
   - Keep test-environment checks centralized in config, bootstrapping, and scripts rather than scattering them through feature code
   - Use one explicit backend E2E mode for test-only wiring such as auth helpers and fail-fast validation
   - Choose outbound integration behavior explicitly, for example live, fixture-backed, or mock-server-backed
   - Unit tests use in-memory DB and should remain independent of Playwright wiring

6. **Branch discipline:**
   - Before substantial planning or coding, check the current branch with `git branch --show-current`
   - If the work is a new slice or feature, start from updated `main` and create a dedicated branch such as `feat/<slice-name>`
   - Do not pile substantial feature work onto an unrelated PR branch, even if the workspace is already open there
   - If you discover mid-task that you are on the wrong branch, transplant the working tree onto a fresh branch from `main` before continuing

7. **Version and changelog timing:**
   - Treat `VERSION` and `CHANGELOG.md` as final pre-commit bookkeeping for user-facing commits
   - Do not update either file during planning or mid-implementation
   - Keep changelog entries high-level rather than a play-by-play of intermediate edits

8. **GitHub workflow tools:**
   - For pull requests, review comments, issues, labels, searches, and repository metadata, prefer GitHub MCP and workspace-integrated GitHub tools first
   - Fall back to `gh` only when the MCP path is unavailable, missing a needed capability, or returning incomplete results
   - When falling back to `gh`, keep the usage targeted and explain the blocker or gap that required the fallback

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
- E2E: verify the Playwright env file and backend mode you intended are actually loaded
- If wrong, check which env file is loaded and whether the harness failed fast

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
4. Test (frontend + backend): `npm test`
5. Docker build validation

All must pass before merge to main branch.

---

**Last Updated:** January 2026  
**Node Version:** 24.x  
**Database:** SQLite (better-sqlite3)
