# GitHub Copilot Instructions - Strava NCC Scrape

## Project Summary
Western Mass Velo cycling competition tracker: React + TypeScript frontend with Node.js Express backend. **Status: Feature-complete and production-ready on Railway.**

---

## Critical Requirements

### Node.js Version: 24.x ONLY
- **Required for:** `better-sqlite3` native module
- **Check:** `node --version` (must be v24.x.x)
- **Fix:** `nvm install 24 && nvm use 24` (or use `npx -p node@24` prefix)

### Development: Use `npm run dev:all`
- Starts both backend (port 3001) and frontend (port 5173) simultaneously
- Uses `concurrently` with color-coded output
- Stop: Press `Ctrl+C` or run `npm run stop`

### If Processes Get Stuck
```bash
npm run stop  # Kills all dev processes and clears ports
```

---

## Quick Diagnosis Guide

### "CORS errors" or "Failed to load from backend"
→ Check both servers running: `lsof -ti:3001` and `lsof -ti:5173`

### "better-sqlite3 build error"
→ Wrong Node version. Run: `node --version` (must be 24.x)

### "Port already in use"
→ Run: `npm run stop`

### "OAuth not working locally"
→ Check `src/api.ts` - should use `http://localhost:3001` for local dev

### "Tests failing" or "Build broken"
→ Run: `npm install && npm run build && npm test`

---

## Pre-Commit Workflow

**Always run before committing:**
```bash
npm run check  # Audits, typechecks, lints, builds, tests (everything)
```

**If any check fails:**
- **Audit:** Run `npm audit:fix` and review changes
- **Type errors:** Fix TypeScript manually
- **Lint:** Run `npm run lint:fix`
- **Tests:** Fix code or test file, then rerun

---

## Implementation Guidelines

### When Adding Features
- **New API endpoint?** → Add tests in `server/src/__tests__/` FIRST or WITH the code
- **Database change?** → Update schema in `server/src/index.js`
- **Frontend component?** → Keep in `src/components/`, use existing patterns
- **API integration?** → Use `src/api.ts` client, add types to `src/types.ts`

### Testing Standards
- All endpoints must have tests (happy path + error cases)
- All business logic must have unit tests
- Aim for >85% coverage
- Run tests in watch mode during development: `cd server && npm run test:watch`

### Keep Tests Updated
- **CRITICAL:** Update tests WITH code changes, never after
- Tests should never be commented out or failing
- Each test should be isolated (no shared mutable state)

---

## Architecture Overview

**Full docs:** See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)

- **Frontend:** React 18 + TypeScript + Vite (in `src/`)
- **Backend:** Express + SQLite + better-sqlite3 (in `server/src/`)
- **Database:** SQLite (auto-created at `server/data/wmv.db`)
- **Auth:** Strava OAuth with encrypted token storage (AES-256-GCM)

### Key Features (All Complete ✅)
- ✅ Strava OAuth authentication with session persistence
- ✅ Batch activity fetching from Strava API
- ✅ Leaderboard calculations (weekly + season)
- ✅ Admin week/segment management
- ✅ Token encryption at rest
- ✅ 144 passing tests (49% coverage)

---

## OAuth & Production

### OAuth Integration Status
- ✅ **Complete and working**
- ✅ Session persistence fixed (reverse proxy configuration)
- ✅ Token encryption implemented (AES-256-GCM)
- ✅ Production-ready on Railway

**See:** [`docs/STRAVA_INTEGRATION.md`](../docs/STRAVA_INTEGRATION.md), [`docs/OAUTH_SESSION_FIX.md`](../docs/OAUTH_SESSION_FIX.md)

### Production Deployment
- Platform: **Railway.app** (recommended for <100 participants)
- Setup time: ~5 minutes
- Cost: Free tier (~$5 credit), or $0-5/month afterward
- Auto-deploys from GitHub on push to `main`

**See:** [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)

---

## Compliance & Privacy Requirements ✅ COMPLETE

**Status:** All compliance requirements implemented and tested for production deployment.

### Legal Compliance

**GDPR & Privacy:**
- ✅ Privacy policy published: [`PRIVACY_POLICY.md`](../PRIVACY_POLICY.md)
- ✅ User data deletion endpoint: `POST /user/data/delete` (48-hour SLA)
- ✅ Data access endpoint: `GET /user/data` (for GDPR data access requests)
- ✅ Data retention: Max 7 days cache per Strava API Agreement
- ✅ Encryption: AES-256-GCM for all OAuth tokens at rest
- ✅ Security audit: [`docs/SECURITY_AUDIT.md`](../docs/SECURITY_AUDIT.md) - APPROVED FOR PRODUCTION

**Strava API Agreement:**
- ✅ Community Application classification (awaiting confirmation from developers@strava.com)
- ✅ No data monetization or third-party sharing
- ✅ Proper OAuth scopes: `activity:read`, `profile:read_all`
- ✅ Token encryption implemented
- ✅ Strava attribution in UI footer
- ✅ Privacy notice on login screen

See: [`docs/STRAVA_INTEGRATION.md`](../docs/STRAVA_INTEGRATION.md) - "API Agreement Compliance" section

### Pre-Launch Verification Checklist

**Before Production Deployment, Verify:**
- [ ] All 144 tests passing: `npm test`
- [ ] No TypeScript errors: `npm run build`
- [ ] Privacy policy visible at `/PRIVACY_POLICY.md`
- [ ] Footer displays "Powered by Strava" link
- [ ] Login screen shows privacy notice with link to PRIVACY_POLICY.md
- [ ] Token encryption working (28 encryption tests passing)
- [ ] Data deletion endpoint tested: `POST /user/data/delete`
- [ ] Data access endpoint tested: `GET /user/data`
- [ ] Delete audit trail table populated: `deletion_requests`
- [ ] OAuth tokens are encrypted in database (not plaintext)
- [ ] Session cookies marked: `secure=true`, `httpOnly=true`, `sameSite=lax`
- [ ] HTTPS enforced on production (Railway auto-redirect)

### Running Pre-Launch Checks

```bash
# Automated compliance check
npm run check  # Tests, lint, audit, build, type checking

# Manual verification
npm test       # 144 tests should pass
npm run build  # No build errors

# Database verification (in Node REPL or via admin UI)
sqlite3 server/data/wmv.db
  SELECT COUNT(*) FROM participants;
  SELECT COUNT(*) FROM participant_tokens;
  SELECT COUNT(*) FROM deletion_requests;
```

### Data Handling (Critical)

**User Data Flow:**
1. User clicks "Connect with Strava"
2. Privacy notice displayed (link to PRIVACY_POLICY.md)
3. User redirected to Strava OAuth
4. User authorizes; Strava returns code
5. Backend exchanges code for tokens
6. **Tokens encrypted with AES-256-GCM before storage**
7. Session created; user sees "Connected as [Name]"

**Deletion Flow (GDPR):**
1. User clicks "Disconnect from Strava"
2. Confirmation dialog: "Are you sure?"
3. `POST /user/data/delete` called
4. **Atomic transaction** deletes:
   - Segment efforts (linked to activities)
   - Activities (linked to results)
   - Results (linked to participant)
   - OAuth tokens (encrypted or plaintext)
   - Participant record
   - Audit log entry in `deletion_requests`
5. Session destroyed
6. User logged out
7. **48-hour SLA for completion** (implemented as immediate, can be extended)

**No Sensitive Data Stored:**
- ❌ Passwords (OAuth only)
- ❌ Email addresses (not collected)
- ❌ Credit cards (free app)
- ❌ Private activities (Strava API respects visibility)
- ❌ Health metrics (only segment times)
- ❌ Location history (only event day activity)

### API Endpoints Related to Compliance

| Endpoint | Purpose | Protected | Notes |
|----------|---------|-----------|-------|
| `POST /auth/strava` | OAuth redirect | Public | Redirects to Strava |
| `GET /auth/strava/callback` | OAuth callback | Strava | Token exchange, encryption |
| `GET /auth/status` | Check connection | Public | Returns name + connection status |
| `POST /auth/disconnect` | Revoke connection | Auth required | Deletes tokens, session |
| `POST /user/data/delete` | Delete all data | Auth required | **GDPR compliant** (48-hour SLA) |
| `GET /user/data` | Export data | Auth required | **GDPR data access request** |

### Important: Token Encryption Details

**Implementation:**
- Algorithm: AES-256-GCM (Advanced Encryption Standard, 256-bit key, Galois/Counter Mode)
- Key Source: `TOKEN_ENCRYPTION_KEY` environment variable (64 hex chars = 256 bits)
- IV: Random 128-bit per encryption (prevents replay attacks)
- Auth Tag: 128-bit HMAC (detects tampering)
- Storage Format: `IV:AUTHTAG:CIPHERTEXT` (all hexadecimal, safe for database)

**Verification:**
- Run: `npm test` → Look for "Encryption" test suite (28 tests)
- All tests should pass ✅
- No plaintext tokens in database

**Example Test:**
```bash
✓ should encrypt and decrypt correctly
✓ should use random IV (different ciphertexts for same plaintext)
✓ should detect any bit of tampering (authentication tag)
```

### When Adding New Features

**CRITICAL: Compliance Must Keep Pace**

If you add any feature that:
- **Collects new data** → Update PRIVACY_POLICY.md
- **Stores user data** → Ensure it's deleted in `POST /user/data/delete`
- **Handles secrets** → Ensure it's encrypted (like tokens)
- **Modifies auth flow** → Test both deletion and OAuth flows
- **Changes API response** → Update `GET /user/data` endpoint

**Example: If Adding Email Collection**
1. Add email field to `participants` table
2. Update PRIVACY_POLICY.md with email retention policy
3. Add email to `POST /user/data/delete` deletion query
4. Add email to `GET /user/data` response
5. Test deletion endpoint: `DELETE FROM participants WHERE ...` should delete email
6. Update tests to verify deletion
7. Update `docs/STRAVA_INTEGRATION.md` compliance section
8. Run: `npm run check` (tests, lint, audit, build)

---

## Documentation Philosophy

**Keep documentation focused for external readers.** Avoid creating new markdown files for implementation details you're working on—instead:

- **Update existing docs** when you change features (e.g., `docs/SCORING.md`, `docs/API.md`)
- **Tell the user in chat** about refactorings, fixes, and internal architecture improvements
- **Create new files only for** user-facing guides that will stay stable (e.g., ADMIN_GUIDE.md, DEPLOYMENT.md)

**Example:** If you refactor leaderboard scoring logic, update `docs/SCORING.md` with the key architectural note, then explain the changes in chat. Don't create `SCORING_ARCHITECTURE.md` as a separate file.

## Project Status (November 2025)

| Feature | Status | Notes |
|---------|--------|-------|
| Backend API | ✅ Complete | All endpoints functional, 150 tests passing |
| Frontend UI | ✅ Complete | Leaderboards, admin panel, segment management |
| Strava OAuth | ✅ Complete | Session persistence + token refresh working |
| Activity Fetching | ✅ Complete | Batch fetch endpoint implemented and tested |
| Token Encryption | ✅ Complete | AES-256-GCM at rest, automatic refresh |
| Admin Features | ✅ Complete | Week/segment/season management |
| Leaderboard Scoring | ✅ Refactored | Compute-on-read architecture, deletion-safe |
| Testing | ✅ Comprehensive | 150 tests, 48.78% coverage, all passing |
| Production Deploy | ✅ Verified | Railway deployment working, tested |
| Database | ✅ Optimized | SQLite with proper schema, test data seeding |

---

## File Structure

```
Root Commands:
  npm run dev:all          → Start both servers
  npm run stop             → Kill all processes
  npm run build            → Build both frontend & backend
  npm run check            → Run all pre-commit checks
  npm test                 → Run backend test suite

Key Files:
  src/App.tsx              → Main React component
  src/api.ts               → Backend API client (all typed)
  server/src/index.js      → Express server + all endpoints
  server/src/encryption.js → Token encryption logic
  .nvmrc                   → Node version (24)
  docs/                    → Comprehensive documentation
```

---

## Debugging Production Issues

### Session/OAuth Failing in Production
→ Check reverse proxy configuration in [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) - "CRITICAL: Reverse Proxy Configuration" section

### Activity Fetching Failing
→ Verify Strava tokens are valid and not expired (auto-refresh happens automatically)

### Database Issues
→ See [`docs/DATABASE_DESIGN.md`](../docs/DATABASE_DESIGN.md)

### General Production Troubleshooting
→ See [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) - "Troubleshooting Production" section

---

## Important Documentation

Start here based on your role:

| Role | Start Here |
|------|-----------|
| **First time?** | [`docs/QUICK_START.md`](../docs/QUICK_START.md) |
| **Want to understand architecture?** | [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) |
| **Ready to deploy?** | [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) |
| **Manage competitions?** | [`ADMIN_GUIDE.md`](../ADMIN_GUIDE.md) |
| **See all docs** | [`docs/README.md`](../docs/README.md) |

---

## When to Ask For Help

- **Stuck on setup?** → Check `docs/QUICK_START.md`
- **Unsure about structure?** → Check `docs/ARCHITECTURE.md`
- **Tests failing?** → Run `npm install && npm test`
- **OAuth broken locally?** → Check `src/api.ts` uses localhost correctly
- **Production not working?** → Check `docs/DEPLOYMENT.md` + Railway logs
