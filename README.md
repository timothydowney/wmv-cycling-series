# WMV Cycling Series

Western Mass Velo's weekly Zwift/Strava hill climb & time trial series. React + TypeScript frontend, Express + Postgres backend. Simple to run locally; designed for small clubs.

## 📖 User Documentation

**New to WMV Cycling Series?** Check out the [**Athlete & Admin Documentation Site**](https://timothydowney.github.io/wmv-cycling-series/)!

- 🚴 **Athlete guides:** Getting started, connecting Strava, understanding leaderboards & PR bonuses
- 👥 **Admin guides:** Creating weeks, fetching results, managing segments, troubleshooting
- 📚 **Learning:** How scoring works, project overview, and more

All documentation is written for end users (no technical jargon required).

---

## Quick Start

**Get running in 5 minutes:**

```bash
npm install              # Install everything
npm run dev             # Start frontend + backend
# Visit http://localhost:5173
```

See [Quick Start Guide](./docs/QUICK_START.md) for developer setup details.

## Requirements

- **Node.js 24.x** (project runtime requirement)
- npm (bundled with Node)

**Install Node 24:**
```bash
nvm install 24 && nvm use 24
```

## Commands

```bash
npm run dev             # Start frontend + backend for normal local development
npm run db:fetch-prod   # Fetch production Postgres dump, restore local snapshot DB, generate .env.prod
npm run dev:prod-data   # Start frontend + backend against the restored local snapshot DB
npm run dev:cleanup     # Stop orphaned local servers
npm test                # Run tests
npm run test:e2e        # Run Playwright against the dedicated E2E preset
npm run build           # Build for production
```

For the env-mode matrix and what each variable actually means, see [URL Configuration Quick Reference](./docs/CONFIG_QUICK_REFERENCE.md).

**→ See [Quick Start Guide](./docs/QUICK_START.md) for detailed guidance on when to use each preset.**

## What's Included

- ✅ Weekly + season leaderboards
- ✅ Admin week and segment management
- ✅ Strava OAuth (participants connect once, activities fetched automatically)
- ✅ OAuth token encryption (AES-256-GCM at rest in database)
- ✅ Postgres database with test data
- ✅ 450+ backend tests (including encryption security tests)
- ✅ Complete documentation (including security audit and encryption guide)

## Architecture

- **Frontend:** React 18 + TypeScript (Vite) + tRPC Client
- **Backend:** Node.js 24.x + Express + tRPC Server + Postgres
- **Database:** Postgres via Drizzle ORM
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
| Security & encryption? | [Security Audit](./docs/SECURITY_AUDIT.md) (includes token encryption details) |
| Deploying? | [Deployment Guide](./docs/DEPLOYMENT.md) |
| Running admin tasks? | [Admin Guide](./ADMIN_GUIDE.md) |
| Need everything? | [Documentation Index](./docs/README.md) |

## Troubleshooting

**Port in use?**
```bash
npm run dev:cleanup
npm run dev
```

**Wrong Node version?**
```bash
nvm install 24
nvm use 24
npm run dev
```

**Build errors?**
```bash
npm install
cd server && npm install
```

See [Quick Start Guide](./docs/QUICK_START.md) for more troubleshooting.

## License

MIT
