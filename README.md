# WMV Cycling Series

Western Mass Velo’s weekly Zwift/Strava hill climb & time trial series. React + TypeScript frontend, Express + SQLite backend. Simple to run locally; designed for small clubs.

## Requirements

- Node.js 24.x (LTS) — required for better-sqlite3
- npm (bundled with Node)

Tip: `.nvmrc` pins Node 24. If you use nvm:
```bash
nvm install 24 && nvm use 24
```

## Quick start

Install deps (frontend + backend):
```bash
npm install
```

Run both servers (frontend on 5173, backend on 3001):
```bash
npm run dev:all
```

Stop/cleanup (kills stuck vite/nodemon/ports):
```bash
npm run stop
```

Build:
```bash
npm run build
```

Test (backend):
```bash
npm test
```

## What’s included

- Leaderboards: weekly + season
- Admin: manage weeks, manage segments (validate via Strava, store metadata)
- Participant Strava OAuth (planned flow; test data by default)
- SQLite DB with seed/test data

## Dev workflow

- Preferred: `npm run dev:all` (runs backend + frontend together)
- Separate (optional):
  - Backend: `npm run dev:server` (in project root)
  - Frontend: `npm run dev`

If you see “port already in use,” run `npm run stop`.

## Configuration

Optional (for live Strava validation/OAuth):
1) Copy env and set credentials
```bash
cp server/.env.example server/.env
```
2) Edit `server/.env` with your Strava app credentials

Without credentials, the app uses test data and local validation where possible.

## Troubleshooting

- better-sqlite3 build errors: ensure Node 24.x; then `cd server && npm rebuild better-sqlite3`
- CORS/network: make sure both servers are running (5173, 3001)
- Stuck processes/ports: `npm run stop`

## Docs

- docs index: `docs/README.md`
- architecture overview: `docs/ARCHITECTURE.md`
- API reference: `docs/API.md`
- scoring rules: `docs/SCORING.md`
- admin guide: `ADMIN_GUIDE.md`
- database design: `DATABASE_DESIGN.md`
- roadmap: `PLAN.md`
- Strava integration plan: `STRAVA_INTEGRATION.md`

## License

MIT (suggested). Add a LICENSE file if you plan to distribute publicly.