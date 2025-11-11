# Environment Variables Guide

## What Each Variable Does

| Variable | Backend Use | Frontend Use | Where Used | Why |
|----------|------------|------------|-----------|-----|
| **PORT** | ✅ Server listen port | ❌ | `server/src/index.js:22` | Express server binding |
| **NODE_ENV** | ✅ Session security | ❌ | `server/src/index.js:40,42` | Controls cookie.secure & sameSite |
| **CLIENT_BASE_URL** | ✅ CORS whitelist | ❌ | `server/src/index.js:23,28` | Allows frontend domain in CORS |
| **DATABASE_PATH** | ✅ SQLite location | ❌ | `server/src/index.js:24` | Points to database file |
| **SESSION_SECRET** | ✅ Session encryption | ❌ | `server/src/index.js:36` | Encrypts session cookies |
| **TOKEN_ENCRYPTION_KEY** | ✅ OAuth token encryption | ❌ | `server/src/encryption.js:11` | AES-256-GCM for Strava tokens |
| **STRAVA_CLIENT_ID** | ✅ OAuth config | ❌ | `server/src/index.js:16,503` | Strava API client ID |
| **STRAVA_CLIENT_SECRET** | ✅ OAuth config | ❌ | `server/src/index.js:17` | Strava API secret |
| **STRAVA_REDIRECT_URI** | ✅ OAuth callback | ❌ | `server/src/index.js:18,504` | Where Strava redirects after login |
| **REACT_APP_BACKEND_URL** | ❌ | ⚡ Dev only | `src/api.ts:4` | Explicit backend URL for development |

## Development Environment

**File:** `server/.env`

**9 variables needed:**
```
NODE_ENV=development
CLIENT_BASE_URL=http://localhost:5173
REACT_APP_BACKEND_URL=http://localhost:3001
DATABASE_PATH=./data/wmv.db
SESSION_SECRET=<generated>
TOKEN_ENCRYPTION_KEY=<generated>
STRAVA_CLIENT_ID=<your-client-id>
STRAVA_CLIENT_SECRET=<your-secret>
STRAVA_REDIRECT_URI=http://localhost:3001/auth/strava/callback
```

**Why `PORT` is NOT needed locally:**
- Default to 3001 via fallback in code
- You run with `npm run dev:all` which starts Express explicitly
- Express binds to this port automatically

**Why `REACT_APP_BACKEND_URL` IS needed locally:**
- Frontend (Vite) runs on `:5173`
- Backend (Express) runs on `:3001`
- Different ports = explicit URL required for API calls
- Frontend auto-detects `localhost` hostname and uses this URL

## Production Environment (Railway)

**File:** Template in `server/.env.railway`

**9 variables to set in Railway dashboard:**
```
NODE_ENV=production
CLIENT_BASE_URL=https://wmv-cycling-series.railway.app
DATABASE_PATH=/data/wmv.db
SESSION_SECRET=<generated-new-secret>
TOKEN_ENCRYPTION_KEY=<generated-new-key>
STRAVA_CLIENT_ID=<your-client-id>
STRAVA_CLIENT_SECRET=<your-secret>
STRAVA_REDIRECT_URI=https://wmv-cycling-series.railway.app/auth/strava/callback
```

**Do NOT set these in Railway:**
- **`PORT`** - Railway sets automatically (e.g., 8080)
- **`REACT_APP_BACKEND_URL`** - Frontend uses relative URLs in production

**Why `PORT` is omitted in production:**
- Railway automatically assigns a port
- Express reads `process.env.PORT` and uses it
- We don't control what port number Railway chooses

**Why `REACT_APP_BACKEND_URL` is omitted in production:**
- Both frontend and backend serve from the same domain/port
- Frontend detects it's NOT on `localhost` hostname
- Automatically uses relative URLs (e.g., `/weeks`, `/auth/strava/callback`)
- These resolve to the same domain as the frontend

## How Frontend URL Resolution Works

**Frontend code (src/api.ts):**
```typescript
const API_BASE_URL = import.meta.env.REACT_APP_BACKEND_URL || (() => {
  // If running on localhost, use explicit backend URL for development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';  // Local dev (different ports)
  }
  // Otherwise (production), use relative URLs (same domain, same port)
  return '';
})();
```

**Development (localhost:5173):**
1. `REACT_APP_BACKEND_URL` is set in `.env` to `http://localhost:3001`
2. Frontend uses this explicit URL
3. API calls: `http://localhost:3001/weeks`

**Production (wmv-cycling-series.railway.app):**
1. `REACT_APP_BACKEND_URL` is NOT set
2. Hostname is NOT localhost → falls through to default
3. API calls use relative URLs: `/weeks` → resolves to `https://wmv-cycling-series.railway.app/weeks`

## Secret Rotation Checklist

When deploying to production:

- [ ] Generate new `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- [ ] Generate new `TOKEN_ENCRYPTION_KEY`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Keep `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` (already in use)
- [ ] Update `STRAVA_REDIRECT_URI` to production domain
- [ ] Update `CLIENT_BASE_URL` to production domain
- [ ] Set `NODE_ENV=production`
- [ ] Set `DATABASE_PATH=/data/wmv.db` (Railway persistent volume)

**Note:** Old secrets in git history can be rotated as a separate security measure, but aren't strictly required since they're marked as "dev-only" secrets in the `.env` file.

## Summary Table

| Setting | Dev | Production | Port Bound? | Why Different |
|---------|-----|----------|------------|---------------|
| Frontend runs on | localhost:5173 | wmv-cycling-series.railway.app | N/A | Different environments |
| Backend runs on | localhost:3001 | wmv-cycling-series.railway.app | Yes | Same domain in prod |
| Frontend API URL | `http://localhost:3001` (explicit) | `` (relative, same domain) | N/A | Cross-port CORS vs. same-domain |
| CORS origin | localhost:5173 | wmv-cycling-series.railway.app | N/A | Origin matches where frontend runs |
| PORT env var | Optional (default 3001) | Railway-assigned | Yes | Dev vs. cloud-managed |
| REACT_APP_BACKEND_URL | Required | Omitted | No | Dev needs explicit, prod uses relative |

## Troubleshooting

**Frontend shows CORS errors:**
- Check `CLIENT_BASE_URL` matches actual frontend domain
- Check backend is running (Express listening)

**API calls fail with "localhost:3001 not found":**
- You're in production without `REACT_APP_BACKEND_URL` set?
- Or frontend is trying explicit localhost in prod?
- Solution: Ensure frontend uses relative URLs in production

**Port conflicts:**
- Dev: Change `npm run dev:all` - edit package.json to use different port
- Production: Railway auto-manages, no action needed

**Token encryption fails:**
- Missing `TOKEN_ENCRYPTION_KEY` environment variable
- Generate new one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
