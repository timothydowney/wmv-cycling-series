# Railway Setup - What You Need to Do Now

This is the **final, correct, idiomatic setup** based on Railway's official Express.js documentation.

## TL;DR - 3 Steps

### Step 1: Set These 8 Variables in Railway Dashboard

Go to Railway → Your Project → Variables tab. Add each:

```
NODE_ENV = production
CLIENT_BASE_URL = https://wmv-cycling-series.railway.app
STRAVA_CLIENT_ID = 170916
STRAVA_CLIENT_SECRET = 8b6e881a410ba3f4313c85b88796d982f38a59a9
STRAVA_REDIRECT_URI = https://wmv-cycling-series.railway.app/auth/strava/callback
DATABASE_PATH = /data/wmv.db
SESSION_SECRET = (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
TOKEN_ENCRYPTION_KEY = (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### Step 2: Update Strava OAuth Settings

Go to https://www.strava.com/settings/api

- Authorization Callback Domain: `wmv-cycling-series.railway.app`

### Step 3: Wait for Deployment

- GitHub Actions automatically runs tests
- Railway automatically deploys when tests pass
- Visit https://wmv-cycling-series.railway.app

## Why This Works

**The key insight:** Railway handles networking. Your app doesn't need to know it's on a special port.

```
User Browser
    ↓
https://wmv-cycling-series.railway.app:443
    ↓ (Railway proxy)
Express Server (Railway-assigned port, e.g., 8080)
    ├─ Serves static files (React app) ← from dist/
    └─ Serves API endpoints ← Express routes
```

- Express reads `PORT` env var (set by Railway)
- Express listens on `0.0.0.0` (all interfaces)
- Railway proxies HTTPS traffic to it
- Frontend and backend share one port = no CORS issues

## What Changed Locally?

**Nothing!** Your development workflow is exactly the same:

```bash
npm run dev:all  # Still works exactly as before
```

- Vite still serves React on http://localhost:5173
- Express still runs on http://localhost:3001
- They call each other on different ports (via `REACT_APP_BACKEND_URL`)

The difference is Railway handles this automatically by serving them on the same port.

## Files You Should Know About

| File | Purpose |
|------|---------|
| `railway.toml` | Tells Railway how to build/run (idiomatic config-as-code) |
| `.env.example` | Shows what variables you need (local + production) |
| `server/.env.railway` | Reference for Railway env vars (documentation only) |
| `docs/RAILWAY_IDIOMATIC_GUIDE.md` | Full technical explanation |

## Verification Steps

1. **GitHub Actions:**
   - Push to main
   - Watch https://github.com/timothydowney/wmv-cycling-series/actions
   - Tests should pass (green ✓)

2. **Railway Deployment:**
   - Go to Railway dashboard
   - Click project
   - Click "Deployments" tab
   - Should show deployment in progress → complete

3. **Site Works:**
   - Visit https://wmv-cycling-series.railway.app
   - Website loads (not Railway's default page)
   - Can navigate pages
   - Click "Connect" → redirects to Strava
   - Can authorize and return

4. **Check Logs:**
   - Railway dashboard → Deployments → latest deployment → Logs
   - Should see `WMV backend listening on port XXXX`

## Still Using Development?

Perfect! No changes:

```bash
# Terminal 1
npm run dev:all

# Terminal 2 (optional, for test watching)
cd server && npm run test:watch
```

This runs:
- Frontend on http://localhost:5173 (Vite)
- Backend on http://localhost:3001 (Express)
- Both servers reload on save
- Tests auto-run when you save

## Production Database

- Path: `/data/wmv.db` (persistent volume)
- Auto-created on first run
- Contains all participant data, activities, scores

## What NOT to Do

❌ Don't set `REACT_APP_BACKEND_URL` in Railway  
❌ Don't create a custom Dockerfile  
❌ Don't use separate frontend/backend services  
❌ Don't hardcode the port in code  
❌ Don't commit `.env` file to git  

The idiomatic Railway approach handles all of this for you.

## Resources

- **Full Guide:** `docs/RAILWAY_IDIOMATIC_GUIDE.md`
- **Deployment Guide:** `docs/DEPLOYMENT.md`
- **Railway Docs:** https://docs.railway.app/guides/express
- **Railroad Config:** https://docs.railway.app/guides/config-as-code

---

**Status: Ready to Deploy!**

Everything is configured correctly. Just set the 8 environment variables in Railway and you're done. 🚀
