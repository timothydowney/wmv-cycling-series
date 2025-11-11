# Railway Deployment - Configuration Guide

This guide explains the idiomatic way to deploy WMV Cycling Series to Railway, based on official Railway documentation for Express.js apps.

## Architecture

- **Frontend (React + Vite):** Built as static files in `dist/`
- **Backend (Express + SQLite):** Serves API AND static frontend files
- **Database:** SQLite with persistent volume at `/data/wmv.db`
- **Deployment:** Single Node.js service on Railway

## How It Works

1. **Build Phase** (Railway runs automatically):
   - `npm install` (installs both root and server dependencies)
   - `npm run build` (builds frontend to `dist/`, installs server deps)

2. **Run Phase** (Railway runs automatically):
   - `npm start` (executes `cd server && npm start`)
   - Backend Express server starts
   - Serves static files from `dist/` + API endpoints
   - Both on same port (Port set by Railway via `PORT` env var)

3. **Deployment Access**:
   - Frontend: `https://yourdomain.railway.app/`
   - API: `https://yourdomain.railway.app/api/*`
   - Same domain, same port = no CORS issues!

## Environment Variables

### What Railway Sets Automatically

- `PORT` - Railway assigns a port (e.g., 8080). Your Express server reads this.
- `NODE_ENV` - Set this to `production` in Railway dashboard

### What You Must Set in Railway Dashboard

These are ALL the required variables. Set them in Railway Project → Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | - |
| `CLIENT_BASE_URL` | `https://yourdomain.railway.app` | Used for CORS on backend |
| `STRAVA_CLIENT_ID` | Your ID from Strava | From https://www.strava.com/settings/api |
| `STRAVA_CLIENT_SECRET` | Your secret | From https://www.strava.com/settings/api |
| `STRAVA_REDIRECT_URI` | `https://yourdomain.railway.app/auth/strava/callback` | Strava OAuth callback |
| `DATABASE_PATH` | `/data/wmv.db` | Persistent volume path |
| `SESSION_SECRET` | Random string (generate below) | Express session signing |
| `TOKEN_ENCRYPTION_KEY` | Random hex string (generate below) | OAuth token encryption |

**Do NOT set** `REACT_APP_BACKEND_URL` in Railway - leave it unset. The frontend will use the same domain as the backend (no explicit URL needed).

### Generate Secrets

```bash
# Generate SESSION_SECRET (base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate TOKEN_ENCRYPTION_KEY (hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Local Development (No Changes!)

Everything still works the same:

```bash
# Terminal 1: Start both servers
npm run dev:all

# Frontend runs on http://localhost:5173 (Vite)
# Backend runs on http://localhost:3001 (Express)
# They call each other via REACT_APP_BACKEND_URL=http://localhost:3001
```

**Key: Local dev does NOT use the built static files.** Vite serves the frontend directly, and they call each other on different ports. Railway handles the networking difference by serving everything from one port.

## Building for Production

```bash
# This is what Railway runs
npm run build

# Results:
# - dist/ folder with all static files (React app)
# - server/node_modules/ with Express dependencies
```

The `npm start` script then:
1. Reads `PORT` from Railway
2. Starts Express
3. Serves `dist/` as static files
4. Listens on the Railway-assigned PORT

## Deployment Process

### Initial Deployment

1. **In Railway Dashboard:**
   - Create new project
   - Connect GitHub repo (strava-ncc-scrape)
   - Railway auto-detects Node.js

2. **Set Environment Variables:**
   - Go to Variables tab
   - Add all 8 variables listed above
   - DO NOT add `REACT_APP_BACKEND_URL`

3. **Trigger Deploy:**
   - Railway auto-deploys on every push to main
   - Or manually click "Redeploy" in Deployments tab

4. **First Deploy Logs:**
   ```
   npm install      # Both root + server
   npm run build    # Builds frontend, installs server deps
   npm start        # Starts Express on Railway-assigned PORT
   ```

### Configuration Files

This repo includes idiomatic Railway configuration:

- **railway.toml** - Railway's config-as-code file (tells Railway how to build/run)
- **.env.example** - Local development example with comments
- **server/.env.railway** - Reference for Railway env vars (not used by Railway, just documentation)
- **.github/workflows/ci.yml** - GitHub Actions CI (runs before Railway deployment)

## Production Checklist

Before telling users about your deployed app:

- [ ] All 8 environment variables set in Railway
- [ ] GitHub Actions CI passes on latest push
- [ ] `npm run build` succeeds locally
- [ ] `npm test` passes locally
- [ ] Website loads at your Railway URL
- [ ] Can navigate between pages
- [ ] OAuth "Connect" button redirects to Strava
- [ ] Can authorize and return to app
- [ ] No errors in browser console
- [ ] No errors in Railway logs

## Key Differences from Local Dev

| Aspect | Local | Production (Railway) |
|--------|-------|----------------------|
| Frontend | Vite dev server on :5173 | Static files from Express on same port |
| Backend | Express on :3001 | Express on Railway-assigned port |
| Frontend → Backend | Explicit URL: `http://localhost:3001` | Same domain (no explicit URL) |
| Database | `./data/wmv.db` | `/data/wmv.db` (persistent volume) |
| Secrets | Plain text in `.env` | Encrypted in Railway dashboard |

## Troubleshooting

### App won't start
- Check Railway logs: Dashboard → Deployments → click a deployment → Logs tab
- Common errors:
  - `Cannot find module` → Missing env variable
  - `ENOENT` → `DATABASE_PATH` wrong or volume not mounted
  - `CORS` error → `CLIENT_BASE_URL` not set or wrong

### OAuth redirects not working
- Verify `STRAVA_REDIRECT_URI` matches your Railway domain exactly
- Update Strava app settings: https://www.strava.com/settings/api → Authorization Callback Domain

### Frontend not showing
- Verify `npm run build` creates `dist/` folder
- Check Express logs for static file serving errors
- Ensure `CLIENT_BASE_URL` is correct for CORS

### Port issues
- Railway assigns the port automatically
- Your code reads `process.env.PORT`
- You DON'T manually set port in Railway

## Resources

- [Railway Express Guide](https://docs.railway.app/guides/express)
- [Railway Config as Code](https://docs.railway.app/guides/config-as-code)
- [Railway Variables](https://docs.railway.app/guides/variables)
- [Railway Networking](https://docs.railway.app/guides/networking)

---

**Idiomatic Approach:**
This setup follows Railway's official best practices for Express.js apps and single-service full-stack deployment. No custom configuration files, no Dockerfiles, no nginx - just pure Railway + Node.js conventions.
