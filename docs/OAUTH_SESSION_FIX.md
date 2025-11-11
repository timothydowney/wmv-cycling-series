# OAuth Session Persistence Fix - Complete Analysis

## Problem Statement

Strava OAuth connection was failing on Railway production with a critical issue: **session cookies were not persisting across the OAuth callback redirect**. The browser would get authenticated on Strava, redirect back to the app, but the session cookie would not be sent in subsequent requests, causing the user to appear as unauthenticated.

### Root Cause

The issue was **NOT** about missing `req.session.save()` or cookie policies. The real cause was:

**Express and express-session were not recognizing HTTPS connections on Railway because Railway uses a reverse proxy.**

#### The Reverse Proxy Problem

1. Internet → **Railway Proxy (nginx)** → Your Express App
2. Railway receives HTTPS traffic from users
3. Railway's proxy forwards traffic to Express as HTTP (internal network)
4. Express sees HTTP and considers the connection insecure
5. **With `secure: true`, Express refuses to set cookies over "insecure" connections**
6. Result: Browser never receives `Set-Cookie` header
7. Consequence: New session ID on every request, user always appears unauthenticated

This is a **fundamental issue for any app behind a reverse proxy** (AWS, Heroku, Railway, nginx, etc).

---

## Solution

### Minimal, Correct Fix

Only **2 configuration changes** are needed:

#### 1. Tell Express to Trust the Proxy

```javascript
// At the very beginning of your Express setup
const app = express();
app.set('trust proxy', 1);  // Trust the first proxy in the chain
```

**Why:** This tells Express to read the `X-Forwarded-Proto` header from Railway's proxy to determine the real protocol (HTTPS).

#### 2. Tell express-session to Trust the Proxy

```javascript
const sessionConfig = {
  // ... other options
  proxy: true,  // Use X-Forwarded-Proto header for secure cookie detection
  rolling: true,  // Force session cookie on every response (needed for redirects)
  cookie: {
    secure: process.env.NODE_ENV === 'production',  // HTTPS in production
    httpOnly: true,
    sameSite: 'lax',  // Allow cross-site cookies for OAuth redirect
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/'
  }
};
```

**Why:**
- `proxy: true` - Respects the proxy's `X-Forwarded-Proto` header
- `rolling: true` - Ensures session cookies are sent on **all responses**, including redirects
- `secure: true` - Now correctly detects HTTPS through the proxy
- `sameSite: 'lax'` - Allows cookies on safe redirects (POST or same-site navigation)

### The `rolling: true` Option

This is critical but often misunderstood:

- **Default behavior**: Express-session only sets `Set-Cookie` if the session was modified
- **On redirects**: `res.redirect()` bypasses normal response handling, so the cookie isn't set
- **With `rolling: true`**: Session cookie is set on EVERY response, refreshing the expiry
- **Performance impact**: Minimal (just writes an extra header)
- **Benefit**: Ensures cookies survive across redirects AND keeps sessions from expiring during normal use

---

## Changes Made (Final Implementation)

### What Was Necessary

1. ✅ `app.set('trust proxy', 1)` - **CRITICAL**
2. ✅ `proxy: true` in session config - **CRITICAL**
3. ✅ `rolling: true` in session config - **IMPORTANT**
4. ✅ Ensure `saveUninitialized: true` - **GOOD PRACTICE**
5. ✅ Use `sameSite: 'lax'` - **NECESSARY for OAuth**

### What Was NOT Necessary (Removed/Reverted)

| Change | Why Not Needed | Impact |
|--------|---------------|--------|
| Manual cookie construction | Express-session handles this correctly when proxy settings are right | Overcomplicated, error-prone |
| Extensive debug logging | The root cause didn't require investigation once proxy was understood | Clutters production logs |
| `req.session.save()` in callback | This is correct but wasn't the issue | Good practice anyway, kept it |
| Cookie middleware logging | Not needed once proxy issue identified | Unnecessary noise |

### Current Best Practice Implementation

```javascript
// Express setup
const app = express();
app.set('trust proxy', 1);  // CRITICAL for Railway/proxies

app.use(cors({ origin: CLIENT_BASE_URL, credentials: true }));
app.use(express.json());

// Session configuration
const sessionConfig = {
  name: 'wmv.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,  // New sessions get cookies
  rolling: true,  // Session cookie on every response
  proxy: true,  // Trust X-Forwarded-Proto from proxy
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/'
  }
};

app.use(session(sessionConfig));

// OAuth callback - simple and correct
app.get('/auth/strava/callback', async (req, res) => {
  // ... OAuth token exchange ...
  
  req.session.stravaAthleteId = athleteId;
  req.session.athleteName = athleteName;
  
  // Save session before redirect
  req.session.save((err) => {
    if (err) return res.redirect('/?error=session_error');
    res.redirect('/?connected=true');
    // rolling: true ensures Set-Cookie header is sent with 302 redirect
  });
});
```

---

## Key Learnings

### 1. Reverse Proxy Detection is Critical

Any app deployed behind a proxy (virtually all cloud platforms) needs:
- `app.set('trust proxy', 1)` in Express
- Proper proxy configuration in middleware

### 2. `rolling: true` is Essential for OAuth

The session middleware doesn't intercept `res.redirect()` by default. Using `rolling: true` ensures cookies survive redirects.

### 3. `sameSite: 'lax'` for Cross-Site OAuth

- `'strict'` blocks cookies on OAuth redirect (user comes from Strava.com)
- `'lax'` allows cookies on safe redirects (GET and top-level redirects)
- Required for OAuth flows to work

### 4. Debugging Session Issues

When session persists fails in production but works locally:
1. Check if app is behind a proxy (it usually is on cloud platforms)
2. Verify `trust proxy` is set
3. Check `proxy` option in session config
4. Confirm `rolling: true` is set
5. Verify `secure` cookie detection is working

---

## Testing the Fix

### Signs the Fix Worked

```
✅ Same session ID reused across requests
✅ /auth/status returns authenticated:true after redirect
✅ User remains logged in after navigating away
✅ Cookies persist across page reloads
```

### Signs Something is Still Wrong

```
❌ Different session ID on every request
❌ Session cookie not in browser (DevTools → Application → Cookies)
❌ Set-Cookie header missing from /auth/strava/callback response
❌ User gets logged out after redirect
```

### Manual Testing Steps

1. Open browser DevTools (F12)
2. Go to Application tab → Cookies
3. Clear all cookies
4. Start OAuth flow
5. Check cookies after redirect:
   - Should have `wmv.sid` cookie
   - Domain should be the production domain
   - Secure flag should be enabled
   - SameSite should be "Lax"

---

## Production Deployment Notes

### Railway Specific

- ✅ Railway's proxy automatically sets `X-Forwarded-Proto: https`
- ✅ Railway's proxy automatically sets `X-Forwarded-Host`
- ✅ Our `app.set('trust proxy', 1)` correctly trusts these headers
- ⚠️ If you use custom domains on Railway, verify `X-Forwarded-Proto` is still being set

### Other Platforms

- **AWS (ALB/ELB)**: Same setup, set `trust proxy`
- **Heroku**: Same setup, set `trust proxy`
- **Vercel**: Different architecture (serverless), may need different approach
- **Docker (self-hosted)**: Depends on your proxy configuration

---

## References

- [Express Trust Proxy](https://expressjs.com/en/guide/behind-proxies.html)
- [express-session Documentation](https://github.com/expressjs/session#options)
- [express-session - Proxy Option](https://github.com/expressjs/session#proxy)
- [Cookie SameSite Attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [Passport.js Session Configuration](https://passportjs.org/)

---

## Commits in This Fix

| Commit | Purpose | Keep? | Notes |
|--------|---------|-------|-------|
| `6d2316a` | Centralize API URLs | ✅ YES | Needed for production build correctness |
| `c193b30` | Add `req.session.save()` | ✅ YES | Best practice, doesn't hurt |
| `79749d5` | Change SameSite to 'lax' | ✅ YES | Required for OAuth |
| `1a1b84f` | Debug logging | ⚠️ PARTIALLY | Helpful but can be reduced in production |
| `ff6ddd1` | Cookie config logging | ⚠️ PARTIALLY | Can be removed now |
| `f0ff281` | Add `rolling: true` | ✅ YES | Essential for OAuth redirects |
| `1045ba0` | Add `trust proxy` settings | ✅ YES | **THE ACTUAL FIX** |

---

## Cleanup Recommendations

### 1. Remove Verbose Debug Logging (Optional)

The extensive logging (`[SESSION]`, `[COOKIE]` prefixes) was helpful for debugging but can be reduced:

```javascript
// KEEP: Startup logging (informational, runs once)
console.log('[SESSION] Initializing SQLite session store');

// KEEP: Errors (always important)
console.error('[AUTH] Session save error:', err);

// REMOVE: Per-request logging (creates too much output)
// console.log('[SESSION] Request', req.method, req.path, '- Session ID:', ...);
// console.log('[COOKIE] Setting cookie in response:', ...);
```

### 2. Update Documentation

- ✅ Create `docs/OAUTH_SESSION_FIX.md` (this file)
- ✅ Update `docs/DEPLOYMENT.md` with proxy configuration
- ✅ Update `.env.example` with SESSION_SECRET requirement

### 3. Update Copilot Instructions

The `copilot-instructions.md` should include:
- Reverse proxy requirements for cloud deployment
- How to test session persistence
- Common debugging patterns
