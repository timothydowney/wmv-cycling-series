# Final Deployment Configuration Verification

## ✅ Verification Results

### 1. Environment Variables

**Local Development (.env file):**
```
PORT=3001
NODE_ENV=development
CLIENT_BASE_URL=http://localhost:5173
REACT_APP_BACKEND_URL=http://localhost:3001
DATABASE_PATH=./data/wmv.db
SESSION_SECRET=dev-secret
TOKEN_ENCRYPTION_KEY=dev-key
```

**Railway Production (Dashboard):**
Must set these 8 variables:
```
NODE_ENV=production
CLIENT_BASE_URL=https://wmv-cycling-series.railway.app
STRAVA_CLIENT_ID=170916
STRAVA_CLIENT_SECRET=(actual secret)
STRAVA_REDIRECT_URI=https://wmv-cycling-series.railway.app/auth/strava/callback
DATABASE_PATH=/data/wmv.db
SESSION_SECRET=(generated secret)
TOKEN_ENCRYPTION_KEY=(generated key)
```

**Do NOT set in Railway:**
- `PORT` - Railway sets this automatically
- `REACT_APP_BACKEND_URL` - Leave unset for production

### 2. Port Configuration

**Local Development:**
- Frontend: `http://localhost:5173` (Vite dev server)
- Backend: `http://localhost:3001` (Express)
- Frontend calls backend via `REACT_APP_BACKEND_URL=http://localhost:3001`
- Different ports, different processes, explicit URL needed

**Railway Production:**
- Single port (assigned by Railway, e.g., 8080)
- Dockerfile calls `npm start` → Express server starts
- Express reads `PORT` env var (set by Railway)
- Express listens on `0.0.0.0:PORT`
- Railway proxies HTTPS → Express on that port
- Both frontend (from `/dist`) and backend API serve from same port
- No explicit `REACT_APP_BACKEND_URL` needed (frontend uses relative URLs to same domain)

### 3. Code Verification

**Backend (server/src/index.js):**
```javascript
const PORT = process.env.PORT || 3001;              // ✅ Correct
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || 'http://localhost:5173';  // ✅ Correct
app.listen(PORT, '0.0.0.0', () => {...});           // ✅ Listens on all interfaces
app.use(cors({ origin: CLIENT_BASE_URL, ... }));    // ✅ CORS configured
```

**Frontend (src/api.ts):**
```typescript
const API_BASE_URL = import.meta.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';  // ✅ Correct
```

This means:
- Local: Uses `http://localhost:3001` (explicit)
- Production: Uses `undefined` (will be relative URLs in browser)
  - Actually, when env var is undefined, it defaults to `'http://localhost:3001'`
  - But in Docker, `REACT_APP_BACKEND_URL` is NOT set during build
  - So the bundled code will have `API_BASE_URL = undefined || 'http://localhost:3001'`
  - This is wrong! Need to fix this.

**⚠️ ISSUE FOUND:** The frontend will try `http://localhost:3001` in production!

### 4. Local Development - ✅ WORKS

Tested `npm run dev:all`:
- Backend starts on :3001 ✅
- Frontend starts on :5173 ✅
- Both connect properly ✅
- Hot reload works ✅
- No errors ✅

### 5. Docker Build - ✅ WORKS

Tested locally:
- Dockerfile builds successfully ✅
- Multi-stage build optimizes correctly ✅
- better-sqlite3 compiles with node:24-slim ✅
- Container runs and server starts ✅

## 🔴 PROBLEM: Frontend API URL in Production

**Current behavior:**
- When building frontend in Docker, `REACT_APP_BACKEND_URL` is not set
- So it defaults to `'http://localhost:3001'` in the bundled code
- In production, browser tries to reach `http://localhost:3001` (from user's machine!)
- This fails - frontend can't reach backend

**Solution needed:**
The frontend needs to use a **relative URL** for production. In development, it needs explicit URL.

Two approaches:

**Option A: Make API calls relative (best for same-domain serving)**
```typescript
// src/api.ts
const API_BASE_URL = import.meta.env.REACT_APP_BACKEND_URL || '';
// Uses relative URLs in production: /weeks, /auth/strava/callback, etc.
// Uses explicit http://localhost:3001 in dev (but need REACT_APP_BACKEND_URL set)
```

**Option B: Detect environment at runtime**
```typescript
const API_BASE_URL = (() => {
  if (import.meta.env.REACT_APP_BACKEND_URL) return import.meta.env.REACT_APP_BACKEND_URL;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  return ''; // relative URLs for production
})();
```

**Recommendation:** Option A (simpler, works for your architecture)

## Summary

### What Works ✅
- Local development: `npm run dev:all` works perfectly
- Docker build: Builds and runs locally
- Backend code: Correctly reads PORT and env vars
- Database path: Both local (./data/wmv.db) and production (/data/wmv.db) work
- Port configuration: Correct for both environments

### What Needs Fixing 🔴
- Frontend API URL: Must use relative URLs in production

### What to Do

1. **Fix src/api.ts** to use relative URLs for production
2. **In Railway environment:** Keep these 8 variables set (don't change)
3. **Local dev:** Works as-is, no changes needed
4. **Push & deploy:** Railway will auto-detect Dockerfile and use it

