# GitHub Copilot Instructions - Strava NCC Scrape

## Project Summary
Western Mass Velo cycling competition tracker: React + TypeScript frontend with Node.js Express backend. **Status: Feature-complete and production-ready on Railway.**

---

## Critical Requirements

### Node.js Version: 24.x ONLY
- **Required for:** `better-sqlite3` native module
- **Check:** `node --version` (must be v24.x.x)
- **Fix:** `nvm install 24 && nvm use 24` (or use `npx -p node@24` prefix)

### Development: Use `npm run dev:all`
- Starts both backend (port 3001) and frontend (port 5173) simultaneously
- Uses `concurrently` with color-coded output
- Stop: Press `Ctrl+C` or run `npm run stop`

### If Processes Get Stuck
```bash
npm run stop  # Kills all dev processes and clears ports
```

---

## Quick Diagnosis Guide

### "CORS errors" or "Failed to load from backend"
→ Check both servers running: `lsof -ti:3001` and `lsof -ti:5173`

### "better-sqlite3 build error"
→ Wrong Node version. Run: `node --version` (must be 24.x)

### "Port already in use"
→ Run: `npm run stop`

### "OAuth not working locally"
→ Check `src/api.ts` - should use `http://localhost:3001` for local dev

### "Tests failing" or "Build broken"
→ Run: `npm install && npm run build && npm test`

---

## Pre-Commit Workflow

**Always run before committing:**
```bash
npm run check  # Audits, typechecks, lints, builds, tests (everything)
```

**If any check fails:**
- **Audit:** Run `npm audit:fix` and review changes
- **Type errors:** Fix TypeScript manually
- **Lint:** Run `npm run lint:fix`
- **Tests:** Fix code or test file, then rerun

---

## Implementation Guidelines

### When Adding Features
- **New API endpoint?** → Add tests in `server/src/__tests__/` FIRST or WITH the code
- **Database change?** → Update schema in `server/src/index.js`
- **Frontend component?** → Keep in `src/components/`, use existing patterns
- **API integration?** → Use `src/api.ts` client, add types to `src/types.ts`

### Testing Standards
- All endpoints must have tests (happy path + error cases)
- All business logic must have unit tests
- Aim for >85% coverage
- Run tests in watch mode during development: `cd server && npm run test:watch`

### Keep Tests Updated
- **CRITICAL:** Update tests WITH code changes, never after
- Tests should never be commented out or failing
- Each test should be isolated (no shared mutable state)

---

## Architecture Overview

**Full docs:** See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)

- **Frontend:** React 18 + TypeScript + Vite (in `src/`)
- **Backend:** Express + SQLite + better-sqlite3 (in `server/src/`)
- **Database:** SQLite (auto-created at `server/data/wmv.db`)
- **Auth:** Strava OAuth with encrypted token storage (AES-256-GCM)

### Key Features (All Complete ✅)
- ✅ Strava OAuth authentication with session persistence
- ✅ Batch activity fetching from Strava API
- ✅ Leaderboard calculations (weekly + season)
- ✅ Admin week/segment management
- ✅ Token encryption at rest
- ✅ 144 passing tests (49% coverage)

---

## OAuth & Production

### OAuth Integration Status
- ✅ **Complete and working**
- ✅ Session persistence fixed (reverse proxy configuration)
- ✅ Token encryption implemented (AES-256-GCM)
- ✅ Production-ready on Railway

**See:** [`docs/STRAVA_INTEGRATION.md`](../docs/STRAVA_INTEGRATION.md), [`docs/OAUTH_SESSION_FIX.md`](../docs/OAUTH_SESSION_FIX.md)

### Production Deployment
- Platform: **Railway.app** (recommended for <100 participants)
- Setup time: ~5 minutes
- Cost: Free tier (~$5 credit), or $0-5/month afterward
- Auto-deploys from GitHub on push to `main`

**See:** [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)

---

## Project Status (November 2025)

| Feature | Status | Notes |
|---------|--------|-------|
| Backend API | ✅ Complete | All endpoints functional, 144 tests passing |
| Frontend UI | ✅ Complete | Leaderboards, admin panel, segment management |
| Strava OAuth | ✅ Complete | Session persistence + token refresh working |
| Activity Fetching | ✅ Complete | Batch fetch endpoint implemented and tested |
| Token Encryption | ✅ Complete | AES-256-GCM at rest, automatic refresh |
| Admin Features | ✅ Complete | Week/segment/season management |
| Testing | ✅ Comprehensive | 144 tests, ~50% coverage, all passing |
| Production Deploy | ✅ Verified | Railway deployment working, tested |
| Database | ✅ Optimized | SQLite with proper schema, test data seeding |

---

## File Structure

```
Root Commands:
  npm run dev:all          → Start both servers
  npm run stop             → Kill all processes
  npm run build            → Build both frontend & backend
  npm run check            → Run all pre-commit checks
  npm test                 → Run backend test suite

Key Files:
  src/App.tsx              → Main React component
  src/api.ts               → Backend API client (all typed)
  server/src/index.js      → Express server + all endpoints
  server/src/encryption.js → Token encryption logic
  .nvmrc                   → Node version (24)
  docs/                    → Comprehensive documentation
```

---

## Debugging Production Issues

### Session/OAuth Failing in Production
→ Check reverse proxy configuration in [`docs/OAUTH_SESSION_FIX.md`](../docs/OAUTH_SESSION_FIX.md)

### Activity Fetching Failing
→ Verify Strava tokens are valid and not expired (auto-refresh happens automatically)

### Database Issues
→ See [`docs/DATABASE_DESIGN.md`](../docs/DATABASE_DESIGN.md)

### General Production Troubleshooting
→ See [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) - "Troubleshooting Production" section

---

## Important Documentation

Start here based on your role:

| Role | Start Here |
|------|-----------|
| **First time?** | [`docs/QUICK_START.md`](../docs/QUICK_START.md) |
| **Want to understand architecture?** | [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) |
| **Ready to deploy?** | [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) |
| **Manage competitions?** | [`ADMIN_GUIDE.md`](../ADMIN_GUIDE.md) |
| **See all docs** | [`docs/README.md`](../docs/README.md) |

---

## When to Ask For Help

- **Stuck on setup?** → Check `docs/QUICK_START.md`
- **Unsure about structure?** → Check `docs/ARCHITECTURE.md`
- **Tests failing?** → Run `npm install && npm test`
- **OAuth broken locally?** → Check `src/api.ts` uses localhost correctly
- **Production not working?** → Check `docs/DEPLOYMENT.md` + Railway logs
