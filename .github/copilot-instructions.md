# GitHub Copilot Instructions - Strava NCC Scrape

## Project Summary
Western Mass Velo cycling competition tracker: React + TypeScript frontend with Node.js Express backend. **Status: Feature-complete and production-ready on Railway.**

---

## Critical Requirements

### Node.js Version: 24.x ONLY
- **Required for:** `better-sqlite3` native module
- **Check:** `node --version` (must be v24.x.x)
- **Fix:** `nvm install 24 && nvm use 24` (or use `npx -p node@24` prefix)

### Development: Two Options

#### For Interactive Development (Recommended)
```bash
npm run dev:all     # Foreground, colored output, both servers together
                    # Stop: Ctrl+C
```

#### For Automated/Agentic Use (Recommended for Scripts)
```bash
npm run dev:start   # Background, returns immediately, tracks PID
npm run dev:status  # Check if running
npm run dev:stop    # Clean shutdown (normal case)
npm run dev:cleanup # Force-kill all dev processes (emergency only)
```

**Key for agents:** Use `dev:cleanup` if `dev:stop` fails or if you encounter orphaned processes. See `docs/DEV_PROCESS_MANAGEMENT.md` and `AGENT_USAGE.md` for detailed patterns.

### Cleanup
```bash
npm run stop        # Alias for dev:stop (clean shutdown)
npm run dev:cleanup # Emergency: force-kill orphaned processes if dev:stop fails
```

**Full documentation:** See [`docs/DEV_PROCESS_MANAGEMENT.md`](../docs/DEV_PROCESS_MANAGEMENT.md) for complete process management guide and [`AGENT_USAGE.md`](../AGENT_USAGE.md) for agentic workflow patterns.

---

## Timestamp Strategy (Critical for Consistency)

**Golden Rule:** Timestamps flow as ISO strings with Z suffix → Unix seconds internally → Browser timezone at display

### ⚠️ CRITICAL: Strava API Field Usage

When processing Strava API responses, **ALWAYS use `start_date` (UTC), NEVER use `start_date_local` (local timezone).**

**This is the #1 timezone bug source. It was caught and fixed in November 2025.**

**Strava Response Fields:**

| Field | Format | Timezone | Usage |
|-------|--------|----------|-------|
| `start_date` | `"2025-10-28T14:52:54Z"` | UTC (has Z) | ✅ **USE THIS** |
| `start_date_local` | `"2025-10-28T06:52:54"` | Athlete's local (no Z) | ❌ **NEVER USE** |

**Why This Matters:**
- Using `start_date_local` causes timestamps to be stored with athlete's timezone offset
- This replicates the original timezone bug that forced the entire UTC refactoring
- Always use `start_date` which has explicit Z suffix (UTC, unambiguous)

**Code Example:**
```javascript
// CORRECT: Use start_date (UTC)
const unixSeconds = isoToUnix(activityData.start_date);  // ✅

// WRONG: Using start_date_local causes timezone bug
const unixSeconds = isoToUnix(activityData.start_date_local);  // ❌
```

**Applies To:** Activity, SegmentEffort, and Lap responses from Strava API

### 1. From Strava API (Input)
- Strava returns `start_date` as ISO 8601 UTC: `"2025-10-28T14:30:00Z"`
- **Always includes Z suffix** (explicit UTC marker, not timezone-dependent parsing)
- Never use `start_date_local` (athlete's timezone, causes bugs)
- Pass `start_date` directly to `isoToUnix()` for conversion to Unix seconds

### 2. Internal Storage (Database)
- Store all timestamps as **INTEGER Unix seconds** (UTC-based)
- Example: `1730126400` (Oct 28, 2025 14:30:00 UTC)
- All database fields: `start_at`, `end_at`, `start_at` (INTEGER type)
- No timezone assumptions in database layer - timestamps are absolute points in time

### 3. API Responses (Backend → Frontend)
- Return timestamps as **numbers** (Unix seconds)
- Example: `{ "week": { "start_at": 1730126400, "end_at": 1730212800 } }`
- Never return ISO strings from API - always raw Unix

### 4. Frontend Display (Edge)
- Convert Unix seconds to user's browser timezone using `Intl.DateTimeFormat()`
- Use formatters from `src/utils/dateUtils.ts`:
  - `formatUnixDate(unix)` → "October 28, 2025" (user's timezone)
  - `formatUnixTime(unix)` → "2:30 PM" (user's timezone)
  - `formatUnixDateShort(unix)` → "Oct 28" (user's timezone)
  - `formatUnixTimeRange(start, end)` → "2:30 PM - 4:00 PM" (user's timezone)

### Why This Approach
- ✅ **Zero timezone math in code** - no offset calculations, no DST handling
- ✅ **Portable everywhere** - container runs UTC, deployment location irrelevant
- ✅ **Matches Strava format** - consistent with API source
- ✅ **Browser-aware** - each user sees their local time automatically
- ✅ **Testable** - Unix timestamps are deterministic, no timezone assumptions

### Common Mistakes to Avoid
- ❌ **Don't:** Store ISO strings in database (breaks comparisons, timezone-dependent)
- ❌ **Don't:** Return ISO strings from API (forces frontend to re-parse)
- ❌ **Don't:** Use `new Date(isoString)` without Z suffix (timezone-dependent parsing)
- ❌ **Don't:** Display UTC times to users (show local timezone instead)
- ✅ **DO:** Always use Z suffix on ISO strings
- ✅ **DO:** Convert to Unix immediately at input
- ✅ **DO:** Format only at display edge using `Intl` API

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

**Before committing, ALWAYS:**

1. **Be selective about files added to git** - CRITICAL: Only add files that belong in the repo
   - Check `git status` BEFORE adding files
   - Only `git add` specific files you intentionally modified (don't use `git add .`)
   - Review each file: Is this essential to the project?
   - **Delete:** Temporary scripts, debug files, duplicate files (`.js` + `.cjs`), test artifacts
   - **Never commit:**
     - Generated files (build outputs, coverage reports)
     - Temporary exploration/scratch files
     - Node debug logs (`.ndjson`, memory dumps)
     - IDE-specific files not in `.gitignore`
   - **Rationale:** Keep git history clean and repo lean; makes reviewing changes easier

2. **Clean up junk files** - Remove any temporary, debug, or duplicate files you created during development
   - Check `git status` for unintended files BEFORE staging
   - Look for duplicate files (e.g., `.js` and `.cjs` versions, temporary scripts)
   - Remove test/debug artifacts
   - This prevents bloating the repo with accidental files

3. **Run the linter** (automatically enforced by pre-commit hook):
```bash
npm run lint:all  # Runs both frontend and backend linters
```

4. **Run full checks** if making substantial changes:
```bash
npm run check  # Audits, typechecks, lints, builds, tests (everything)
```

**If any check fails:**
- **Audit:** Run `npm audit:fix` and review changes
- **Type errors:** Fix TypeScript manually
- **Lint:** Run `npm run lint:fix`
- **Tests:** Fix code or test file, then rerun

**Remember:** The pre-commit hook will block commits with linting errors. Clean up all junk before committing to keep the repo tidy.

---

## Implementation Guidelines

### Code Organization
- **API routes & middleware:** `server/src/index.js` (Express setup, routes)
- **API client:** `server/src/stravaClient.js` (Strava API wrapper)
- **Business logic:** `server/src/activityProcessor.js` (activity matching algorithm)
- **Database layer:** `server/src/tokenManager.js` (token lifecycle), `server/src/activityStorage.js` (persistence)
- **Database schema:** `server/src/schema.js` (single source of truth)
- **Encryption:** `server/src/encryption.js` (AES-256-GCM token encryption)
- **Frontend:** `src/components/` (React components), `src/api.ts` (HTTP client)

### When Adding Features
- **New API endpoint?** → Add tests in `server/src/__tests__/` FIRST or WITH the code
- **New business logic?** → Create a separate module in `server/src/` with tests
- **Frontend component?** → Keep in `src/components/`, use existing patterns
- **Database schema change?** → Update `server/src/schema.js`
- **Strava API call?** → Use `stravaClient` module functions

### Testing Standards
- All endpoints must have tests (happy path + error cases)
- All business logic must have unit tests  
- Aim for >85% coverage
- Run tests: `npm test` or watch mode: `cd server && npm run test:watch`
- **CRITICAL:** Update tests WITH code changes, never after
- Each test should be isolated (no shared mutable state)

---

## Architecture Overview

**Full docs:** See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)

**Current stack:**
- **Frontend:** React 18 + TypeScript + Vite (`src/`)
- **Backend:** Express + SQLite + better-sqlite3 (`server/src/`)
- **Database:** SQLite with schema in `server/src/schema.js`
- **Auth:** Strava OAuth with AES-256-GCM token encryption

**Key features:**
- ✅ Strava OAuth with session persistence
- ✅ Batch activity fetching (pagination + all segment efforts)
- ✅ Leaderboard calculations (weekly + season)
- ✅ Admin week/segment management
- ✅ Token encryption at rest + auto-refresh
- ✅ 268 passing tests (66.49% coverage)

---

## Security & Compliance

### Current Status
- ✅ **Token Encryption:** AES-256-GCM at rest (28 tests passing)
- ✅ **GDPR Compliance:** Privacy policy + automatic data deletion (48-hour SLA)
- ✅ **OAuth Security:** Per-participant tokens, auto-refresh, no credential sharing
- ✅ **Session Security:** Secure cookies, proxy configuration, HTTPS enforced
- ✅ **Production Ready:** Security audit complete, approved for deployment

### Documentation
- **[SECURITY_AUDIT.md](../docs/SECURITY_AUDIT.md)** - Complete security review (token encryption, session management, secrets, pre-launch checklist)
- **[PRIVACY_POLICY.md](../PRIVACY_POLICY.md)** - GDPR/CCPA compliance, data retention, user rights, breach notification
- **[STRAVA_INTEGRATION.md](../docs/STRAVA_INTEGRATION.md)** - API Agreement compliance, OAuth implementation, data handling

### Key Implementation Details

**Token Encryption:**
- Algorithm: AES-256-GCM (military-grade)
- Tested: 28 tests passing with tampering detection
- Transparent: Automatically encrypted on storage, decrypted on retrieval
- Never logged: Tokens used only for Strava API calls

**Data Deletion (GDPR):**
- User-triggered: "Disconnect" or "Request Data Deletion" in app
- Atomic: Single transaction deletes all user data (cascade deletions)
- SLA: 48 hours for complete removal
- Logged: Deletion request tracked in audit table

**When Adding Features:**
1. Check PRIVACY_POLICY.md for data handling requirements
2. If adding new data collection, update privacy policy
3. If storing secrets, use encryption (see SECURITY_AUDIT.md)
4. If modifying auth, verify session tests still pass
5. Run: `npm run check` (covers tests, lint, audit, build)

---

## OAuth & Production

### Current Status
- ✅ **OAuth Integration:** Complete with session persistence and reverse proxy support
- ✅ **Production Deployment:** Railway.app (recommended for <100 participants)

**See:** [`docs/STRAVA_INTEGRATION.md`](../docs/STRAVA_INTEGRATION.md) for OAuth details and [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for deployment guide

---

## Documentation Philosophy

**Keep documentation focused for external readers.** Avoid creating new markdown files for implementation details you're working on—instead:

- **Update existing docs** when you change features (e.g., `docs/SCORING.md`, `docs/API.md`)
- **Tell the user in chat** about refactorings, fixes, and internal architecture improvements
- **Create new files only for** user-facing guides that will stay stable (e.g., ADMIN_GUIDE.md, DEPLOYMENT.md)

**Example:** If you refactor leaderboard scoring logic, update `docs/SCORING.md` with the key architectural note, then explain the changes in chat. Don't create `SCORING_ARCHITECTURE.md` as a separate file.

---

## Temporary Documentation Files (For Agent Use)

When generating detailed analysis, review reports, or summaries during development work, save them to `.copilot-temp/` directory to keep them organized and prevent accidental commits.

### Guidelines for Copilot Agent

**IMPORTANT: Use `.copilot-temp/` ONLY. Never create files in `/tmp/` or other system directories.**

**When to create temp files:**
- Comprehensive code reviews or refactoring reports
- Step-by-step analysis of complex changes
- Migration guides or detailed validation summaries
- Architecture diagrams or system overview documents

**Where to save:**
```bash
.copilot-temp/                 # Directory (gitignored) - ONLY valid location
├── refactoring-review.md
├── security-audit-2024.md
├── migration-guide.md
└── [other analysis files]
```

**Do NOT:**
- ❌ Create temp files in `/tmp/` or other system directories
- ❌ Use `cat` or `run_in_terminal` commands to display file contents (wastes tokens)
- ❌ Display full file contents to the user unless explicitly requested

**DO:**
- ✅ Save analysis/summaries to `.copilot-temp/[descriptive-name].md`
- ✅ Reference files by name in conversation ("See `.copilot-temp/refactoring-review.md` for details")
- ✅ Let the user read files directly if they need full content (they can open in editor)
- ✅ Use `read_file` only when you need to reference specific content from your own temp files

**Cleanup before commits:**
```bash
rm -rf .copilot-temp/*.md     # Remove temp analysis files before final commit
```

**Why this matters:**
- Keeps git history clean (no analysis artifacts)
- Prevents accidental publication of work-in-progress documentation
- `.copilot-temp/` is already gitignored and properly set up
- Avoids wasting tokens on unnecessary file I/O and display operations
- Maintains focus on task completion rather than documentation artifacts

---

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
