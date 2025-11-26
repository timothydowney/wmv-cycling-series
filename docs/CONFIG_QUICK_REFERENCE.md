# URL Configuration Quick Reference

Quick guide to understanding and using the URL configuration system.

---

## For Developers

### How It Works

The app reads **base URLs** from environment variables and derives endpoint URLs automatically:

```
.env (or env vars)
    ↓
server/src/config.ts (derives URLs)
    ↓
server/src/index.ts (uses config.frontendUrl, config.stravaRedirectUri, etc.)
    ↓
server/src/routes/auth.ts (uses config)
    ↓
Frontend calls API at config.backendUrl
```

### Local Development

**.env file:**
```dotenv
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001
```

**What gets derived:**
- `config.frontendUrl` → `http://localhost:5173`
- `config.backendUrl` → `http://localhost:3001`
- `config.stravaRedirectUri` → `http://localhost:3001/auth/strava/callback`
- `config.webhookCallbackUrl` → `http://localhost:3001/webhooks/strava`

**Run locally:**
```bash
npm run dev:all
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

### Production Deployment

**Railway Secrets (set in dashboard):**
```
APP_BASE_URL=https://wmv-cycling-series.railway.app
```

**What gets derived:**
- `config.frontendUrl` → `https://wmv-cycling-series.railway.app`
- `config.backendUrl` → `https://wmv-cycling-series.railway.app`
- `config.stravaRedirectUri` → `https://wmv-cycling-series.railway.app/auth/strava/callback`
- `config.webhookCallbackUrl` → `https://wmv-cycling-series.railway.app/webhooks/strava`

### Two Environment Modes

**Mode 1: Split Stack (Local Dev)**
```
FRONTEND_URL=http://localhost:5173    (required)
BACKEND_URL=http://localhost:3001     (optional, defaults to :3001)
```
Use when frontend and backend are on **different ports/domains**.

**Mode 2: Single App URL (Production)**
```
APP_BASE_URL=https://wmv-cycling.railway.app    (required)
```
Use when frontend and backend share the **same domain**.

---

## For DevOps / Deployment

### Railway Production Setup

1. **Create/update secrets in Railway dashboard:**
   ```
   APP_BASE_URL=https://wmv-cycling-series-prod.railway.app
   ```

2. **Remove old secrets** (if they exist):
   - ❌ Delete `CLIENT_BASE_URL`
   - ❌ Delete `STRAVA_REDIRECT_URI`
   - ❌ Delete `WEBHOOK_CALLBACK_URL`
   - ❌ Delete `REACT_APP_BACKEND_URL`

3. **Check Strava OAuth app settings:**
   - Go to https://www.strava.com/settings/api
   - Update "Authorization Callback Domain" to match your `APP_BASE_URL` domain
   - Example: `wmv-cycling-series-prod.railway.app`

4. **Deploy:**
   ```bash
   git push origin main
   # Railway auto-deploys
   ```

### Environment Checklist

- [ ] `APP_BASE_URL` set to production domain
- [ ] `DATABASE_PATH=/data/wmv.db`
- [ ] `STRAVA_CLIENT_ID` set
- [ ] `STRAVA_CLIENT_SECRET` set
- [ ] `SESSION_SECRET` set (unique for prod)
- [ ] `TOKEN_ENCRYPTION_KEY` set (unique for prod)
- [ ] `RAILWAY_RUN_UID=0` set (for persistent volume permissions)
- [ ] No old `CLIENT_BASE_URL` or `STRAVA_REDIRECT_URI` vars
- [ ] Strava OAuth app callback domain updated

---

## For Admins

**You don't need to change anything.** The configuration is handled by:
- Developers (set `.env` for local development)
- DevOps (set `APP_BASE_URL` in production)

The app works the same way - OAuth, leaderboards, activity fetching, webhooks all work as before.

---

## Troubleshooting

### "OAuth callback failed" or "Authorization denied"

**Check 1: Is config being read?**
```bash
# Look for this in server logs on startup:
[CONFIG] OAuth callback: https://your-domain.com/auth/strava/callback
```

**Check 2: Does Strava know about your domain?**
1. Go to https://www.strava.com/settings/api
2. Check "Authorization Callback Domain" matches your `APP_BASE_URL` domain
3. Example: If `APP_BASE_URL=https://wmv-cycling.railway.app`, the domain should be `wmv-cycling.railway.app`

**Check 3: Is `.env` correct?** (local dev only)
```bash
FRONTEND_URL=http://localhost:5173    # ✓ must be :5173
BACKEND_URL=http://localhost:3001     # ✓ must be :3001
```

### "Cannot find module 'config'"

The `config.ts` file must exist at `server/src/config.ts`. If missing:
```bash
# Check if file exists
ls -la server/src/config.ts

# If missing, rebuild from source
git pull origin main
npm install
```

### "Frontend cannot connect to backend"

**Check 1: Frontend knows backend URL?**
```javascript
// In browser console
console.log(window.location.origin)  // Should be http://localhost:5173 (dev)
// API calls should go to http://localhost:3001 (dev) or same domain (prod)
```

**Check 2: CORS configured correctly?**
Check server logs for:
```
[CONFIG] Frontend URL: http://localhost:5173
[CONFIG] CORS origin configured
```

---

## File Reference

| File | Purpose | When to Edit |
|------|---------|---|
| `.env` | Local dev config | When setting up local development |
| `.env.railway.example` | Production template | For documentation, shows required vars |
| `server/src/config.ts` | Config logic | When adding new derived URLs or modes |
| `server/src/index.ts` | Server startup | Uses config (no direct editing needed) |
| `server/src/routes/auth.ts` | OAuth routes | Uses config (no direct editing needed) |

---

## Configuration Modes Explained

### Mode 1: Local Development (Split Stack)

```
┌─────────────────────┐
│  Browser            │
│  localhost:5173     │
│  (React frontend)   │
└──────────┬──────────┘
           │
           ├─────────────────────────┐
           │                         │
           v                         v
    Frontend only              Backend API
    http://localhost:5173      http://localhost:3001
                               ├─ /auth/strava/callback
                               └─ /webhooks/strava

Environment: FRONTEND_URL + BACKEND_URL
```

### Mode 2: Production (Single Domain)

```
┌─────────────────────┐
│  Browser            │
│  wmv-cycling.app    │
│  (React frontend)   │
└──────────┬──────────┘
           │
           v
    Frontend + Backend (same domain)
    https://wmv-cycling.railway.app/
    ├─ / (frontend)
    ├─ /api/... (backend)
    ├─ /auth/strava/callback
    └─ /webhooks/strava

Environment: APP_BASE_URL
```

---

## Common Tasks

### Change frontend URL (local dev)

```bash
# Edit .env
FRONTEND_URL=http://localhost:3000  # Change from 5173 to 3000
BACKEND_URL=http://localhost:3001

# Restart servers
npm run dev:cleanup
npm run dev:all
```

### Change production domain

```bash
# In Railway dashboard → Settings → Secrets
APP_BASE_URL=https://new-domain.railway.app

# Then update Strava OAuth app
# https://www.strava.com/settings/api
# → Change "Authorization Callback Domain" to new-domain.railway.app
```

### Test with split stack in production

```bash
# Not recommended, but technically possible:
FRONTEND_URL=https://frontend.example.com
BACKEND_URL=https://api.example.com
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
# etc.
```

---

## Implementation Details

### Configuration Resolution Order

1. **Check for split-stack vars** (`FRONTEND_URL`)
   - If found: use `FRONTEND_URL` + `BACKEND_URL` (defaults to :3001)
   - `isSplitStack = true`

2. **Check for single-app var** (`APP_BASE_URL`)
   - If found: use `APP_BASE_URL` for both frontend and backend
   - `isSplitStack = false`

3. **Fallback to defaults**
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:3001`
   - `isSplitStack = true`

### Startup Logging

When the server starts, it logs the resolved configuration:

```
========== CONFIGURATION ==========
[CONFIG] Environment: development
[CONFIG] Split stack: true
[CONFIG] Frontend URL: http://localhost:5173
[CONFIG] Backend URL: http://localhost:3001
[CONFIG] OAuth callback: http://localhost:3001/auth/strava/callback
[CONFIG] Webhook callback: http://localhost:3001/webhooks/strava
```

This helps debug configuration issues.

---

## See Also

- **Full technical details:** `docs/URL_CONFIGURATION_REFACTOR.md`
- **Deployment guide:** `docs/DEPLOYMENT.md`
- **Architecture overview:** `docs/ARCHITECTURE.md`
- **OAuth flow:** `docs/STRAVA_INTEGRATION.md`

