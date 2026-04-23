# Quick Start Guide

Get the app running in 5 minutes.

## Prerequisites

- **Node.js 24.x** (required for SQLite)
  - Check your version: `node --version`
  - Install/switch with nvm: `nvm install 24 && nvm use 24`

- Git (for cloning, but you already have the code)

## Setup (1 minute)

```bash
cd /path/to/wmv-cycling-series
npm install
```

That's it. Installs both frontend and backend dependencies.

## Run (1 minute)

### For Interactive Development (Recommended)
```bash
npm run dev
```

Opens two servers in your terminal with colored output:
- **Frontend:** http://localhost:5173 (React app, green)
- **Backend:** http://localhost:3001 (API, blue)

Both have hot-reload. Stop with `Ctrl+C`.

### For Reviewing the Webhook Admin UI with Production-Like Data
```bash
npm run db:fetch-prod
npm run dev:prod-data
```

This refreshes a local copy of the production database, writes `.env.prod`, and starts the app against that snapshot on the normal local ports.

**If you hit orphaned processes:**
```bash
npm run dev:cleanup
```

See `docs/DEV_PROCESS_MANAGEMENT.md` for detailed process management guide.

## Verify (1 minute)

1. Open http://localhost:5173 in browser
2. You should see:
   - "WMV Cycling Series" heading
   - Week selector dropdown
   - Leaderboard table
   - Season leaderboard tab

3. Click "Week 1: Season Opener" → See test data leaderboard
4. Click "Season Leaderboard" → See season standings

✅ **If you see data, you're ready to go!**

## Runtime Presets

Use these presets instead of memorizing individual env vars:

| Goal | Command | Env file | What changes |
|------|---------|----------|--------------|
| Normal local development | `npm run dev` | `.env` | Standard local app behavior on `:5173` and `:3001` |
| Review webhook admin UI with production-like data | `npm run db:fetch-prod` then `npm run dev:prod-data` | `.env.prod` | Uses a refreshed local production DB copy and production secrets for realistic admin UI review |
| Playwright E2E | `npm run test:e2e` | `e2e/.env.e2e` | Uses dedicated E2E ports, fixture-backed Strava, E2E auth, and E2E DB reset |

The important rule is simple:
- `ENV_FILE` selects a preset.
- `WMV_RUNTIME_MODE` is only for E2E-specific boot/runtime behavior.
- `STRAVA_API_MODE` controls whether backend Strava-dependent flows run live or deterministic.

See [CONFIG_QUICK_REFERENCE.md](./CONFIG_QUICK_REFERENCE.md) for the full matrix.

## Troubleshooting

**"Cannot find module" error**
```bash
npm install
```

**"Port already in use" error**
```bash
npm run dev:cleanup
npm run dev
```

**"node: command not found" or wrong version**
```bash
nvm install 24
nvm use 24
npm run dev
```

**Leaderboard shows "Error: Failed to fetch"**
- Is backend running? (Check for blue output)
- Check browser console for error
- Try refreshing page

## Next Steps

### To Explore the Code
- Frontend: `src/App.tsx` → `src/components/` (TypeScript + React)
- Backend: `server/src/index.ts` → `server/src/routes/` and `server/src/services/` (Pure TypeScript)
- Tests: `server/src/__tests__/` (TypeScript test files with Jest + ts-jest)
- Database: `server/data/wmv.db` (SQLite)

### To Run Tests
```bash
npm test
```

### To Build for Production
```bash
npm run build
```

### To Learn More
- **Architecture & design:** `docs/ARCHITECTURE.md`
- **Scoring rules:** `docs/SCORING.md`
- **API reference:** `docs/API.md`
- **Admin workflow:** `ADMIN_GUIDE.md`
- **Strava integration:** `docs/STRAVA_INTEGRATION.md`
- **Full documentation:** `docs/README.md`

## Common Commands

```bash
npm run dev              # Start frontend + backend interactively
npm run db:fetch-prod    # Refresh local production DB copy and .env.prod
npm run dev:prod-data    # Start app against the production DB copy
npm run dev:cleanup      # Clean up local servers
npm test                 # Run frontend + backend unit tests
npm run test:e2e         # Run Playwright E2E tests
npm run build            # Build for production
npm run build:frontend   # Build React app only
```

## Development Workflow

**Make a change:**
1. Edit code (frontend or backend)
2. Save file
3. App auto-reloads
4. Refresh browser if needed

**Test a new feature:**
1. Add code
2. Run tests: `npm test`
3. Commit when passing

**Deploy to production:**
1. Push to `main` branch
2. Railway auto-deploys
3. See `docs/DEPLOYMENT.md` for details

---

That's it! You're now running the WMV Cycling Series app locally.

Questions? Check `docs/README.md` for the full documentation index.
