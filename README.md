# WMV Cycling Series

Western Mass Velo's weekly Zwift/Strava hill climb & time trial series. React + TypeScript frontend, Express + SQLite backend. Simple to run locally; designed for small clubs.

## Quick Start

**Get running in 5 minutes:**

```bash
npm install              # Install everything
npm run dev:all         # Start both servers
# Visit http://localhost:5173
```

See [Quick Start Guide](./docs/QUICK_START.md) for details.

## Requirements

- **Node.js 24.x** (required for better-sqlite3)
- npm (bundled with Node)

**Install Node 24:**
```bash
nvm install 24 && nvm use 24
```

## Commands

```bash
npm run dev:all         # Interactive: Start frontend + backend with output (Ctrl+C to stop)
npm start               # Automated: Start both servers in background, returns immediately
npm stop                # Stop background servers cleanly
npm status              # Check if servers are running
npm cleanup             # Emergency: Force-kill orphaned processes
npm test                # Run tests
npm run build           # Build for production
```

**→ See [Dev Process Management](./docs/DEV_PROCESS_MANAGEMENT.md) for detailed guidance on when to use each.**

## What's Included

- ✅ Weekly + season leaderboards
- ✅ Admin week and segment management
- ✅ Strava OAuth (participants connect once, activities fetched automatically)
- ✅ OAuth token encryption (AES-256-GCM at rest in database)
- ✅ SQLite database with test data
- ✅ 105+ backend tests (including encryption security tests)
- ✅ Complete documentation (including security audit and encryption guide)

## Architecture

- **Frontend:** React 18 + TypeScript (Vite)
- **Backend:** Node.js 24.x + Express + SQLite
- **Auth:** Strava OAuth (per-participant tokens)
- **Deployment:** Railway.app (recommended)

See [Architecture Overview](./docs/ARCHITECTURE.md) for system design.

## Documentation

Start with one of these:

| For... | Read |
|--------|------|
| First time? | [Quick Start](./docs/QUICK_START.md) - 5 min setup |
| Understanding the system? | [Architecture](./docs/ARCHITECTURE.md) |
| Building features? | [API Reference](./docs/API.md) |
| Security & encryption? | [Security Audit](./docs/SECURITY_AUDIT.md) & [Encryption Guide](./docs/TOKEN_ENCRYPTION_GUIDE.md) |
| Deploying? | [Deployment Guide](./docs/DEPLOYMENT.md) |
| Running admin tasks? | [Admin Guide](./ADMIN_GUIDE.md) |
| Need everything? | [Documentation Index](./docs/README.md) |

## Troubleshooting

**Port in use?**
```bash
npm run stop
npm run dev:all
```

**Wrong Node version?**
```bash
nvm install 24
nvm use 24
npm run dev:all
```

**Build errors?**
```bash
npm install
cd server && npm rebuild better-sqlite3
```

See [Quick Start Guide](./docs/QUICK_START.md) for more troubleshooting.

## License

MIT