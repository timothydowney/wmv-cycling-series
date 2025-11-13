# Quick Start Guide

Get the app running in 5 minutes.

## Prerequisites

- **Node.js 24.x** (required for SQLite)
  - Check your version: `node --version`
  - Install/switch with nvm: `nvm install 24 && nvm use 24`

- Git (for cloning, but you already have the code)

## Setup (1 minute)

```bash
cd /path/to/strava-ncc-scrape
npm install
```

That's it. Installs both frontend and backend dependencies.

## Run (1 minute)

### For Interactive Development (Recommended)
```bash
npm run dev:all
```

Opens two servers in your terminal with colored output:
- **Frontend:** http://localhost:5173 (React app, green)
- **Backend:** http://localhost:3001 (API, blue)

Both have hot-reload. Stop with `Ctrl+C`.

### For Automated/Background Use
```bash
npm run dev:start
npm run dev:status  # Verify running
npm run dev:stop    # Stop cleanly when done
```

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

## Troubleshooting

**"Cannot find module" error**
```bash
npm install
```

**"Port already in use" error**
```bash
npm run stop  # Kills stuck processes
npm run dev:all  # Try again
```

**"node: command not found" or wrong version**
```bash
nvm install 24
nvm use 24
npm run dev:all
```

**Leaderboard shows "Error: Failed to fetch"**
- Is backend running? (Check for blue output)
- Check browser console for error
- Try refreshing page

## Next Steps

### To Explore the Code
- Frontend: `src/App.tsx` → `src/components/`
- Backend: `server/src/index.js`
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
npm run dev:all          # Start both servers (recommended)
npm run dev:server       # Start backend only
npm run dev              # Start frontend only
npm run stop             # Kill stuck processes
npm test                 # Run backend tests
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

That's it! You're now running the WMV Cycling Series app locally. 🚴

Questions? Check `docs/README.md` for the full documentation index.
