# GitHub Copilot Instructions - Strava NCC Scrape

Western Mass Velo cycling competition tracker: React + TypeScript frontend with Node.js Express backend. **Feature-complete and production-ready on Railway.**

---

## Quick Commands

```bash
npm run dev:all              # Interactive: both servers with output (Ctrl+C to stop)
npm start                    # Automated: start both servers in background, returns immediately
npm stop                     # Stop background servers cleanly
npm status                   # Check if servers running
npm cleanup                  # Emergency: force-kill orphaned dev processes
npm test                     # Run all backend tests
npm run build                # Production build
npm run lint:all             # Lint everything
npm run check                # Full pre-commit checks (audit, typecheck, lint, build, test)
npm run lint:fix             # Auto-fix linting errors
```

**Node.js 24.x REQUIRED** (for `better-sqlite3`). Check: `node --version`

### Development Options

**Interactive Development (Recommended for Local Work)**
```bash
npm run dev:all
```
- Shows both servers in one terminal with colored output
- Stop with Ctrl+C
- Good for debugging and watching logs

**Background Operation (For Agents & Automation)**
```bash
npm start          # Returns immediately; servers run in background
npm status         # Check if running
npm stop           # Stop cleanly
```
- Perfect for CI/CD, testing workflows, and agentic development
- Servers on http://localhost:3001 (backend) and http://localhost:5173 (frontend)

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

## Implementation Standards

**Backend:** All code is TypeScript (`.ts` files only in `server/src/`)

**Frontend:** React 18 + TypeScript in `src/components/` and `src/utils/`

**API client:** `src/api.ts` handles all backend calls

**Tests:** All endpoints and business logic must have tests (happy path + error cases). Aim for >85% coverage.
- Run: `npm test` (Jest + ts-jest)
- Watch mode: `cd server && npm run test:watch`
- Test files: `server/src/__tests__/*.test.ts` (all TypeScript)
- **Critical:** Update tests WITH code changes, never after

---

## Code Style Examples

### TypeScript Naming Conventions

```typescript
// ✅ GOOD - Clear, descriptive names following conventions
function getUserActivitiesForWeek(userId: number, weekId: number): Activity[] {
  return db.prepare(
    'SELECT * FROM activities WHERE user_id = ? AND week_id = ?'
  ).all(userId, weekId);
}

class ActivityService {
  private db: Database;
  private logger: Logger;
  
  async fetchActivitiesFromStrava(athleteId: number): Promise<void> {
    // Implementation
  }
}

const MAX_RETRIES = 3;
const API_TIMEOUT_MS = 5000;

// ❌ BAD - Vague names, no clear intent
function get(x, y) {
  return db.prepare('SELECT * FROM activities WHERE user_id = ? AND week_id = ?').all(x, y);
}

const max = 3;
const timeout = 5000;
```

**Rules:**
- Functions/methods: `camelCase` (`getUserActivities`, `fetchSegmentEfforts`)
- Classes: `PascalCase` (`ActivityService`, `TokenManager`)
- Constants: `UPPER_SNAKE_CASE` (`MAX_RETRIES`, `API_KEY`)
- Private members: Prefix with `_` or use `private` keyword (`_cache`, `private db`)

### React Component Patterns

```typescript
// ✅ GOOD - Typed props, clear component logic
interface WeeklyLeaderboardProps {
  weekId: number;
  onRefresh?: () => Promise<void>;
}

export const WeeklyLeaderboard: React.FC<WeeklyLeaderboardProps> = ({ weekId, onRefresh }) => {
  const [results, setResults] = useState<LeaderboardResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFetchResults = async () => {
    setLoading(true);
    try {
      const data = await api.getWeekLeaderboard(weekId);
      setResults(data);
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="weekly-leaderboard">
      {/* JSX */}
    </div>
  );
};

// ❌ BAD - No prop typing, mixed concerns
function Leaderboard(props) {
  const [results, setResults] = useState();
  
  useEffect(() => {
    api.getWeekLeaderboard(props.weekId)
      .then(setResults)
      .catch(err => alert(err)); // Bad error handling
  });
  
  return <div>{results?.map(r => <div>{r.name}</div>)}</div>;
}
```

**Rules:**
- Always type props with `interface` (never `any`)
- Use `React.FC<Props>` for functional components
- Handle errors explicitly (not with `alert()`)
- Keep components focused on single responsibility

### Error Handling

```typescript
// ✅ GOOD - Explicit error handling
try {
  const token = await getValidAccessToken(participantId);
  if (!token) {
    throw new Error('Participant not connected to Strava');
  }
  const activities = await stravaClient.getActivities(token);
  return activities;
} catch (error) {
  logger.error('Failed to fetch activities', { participantId, error });
  throw new Error(`Activity fetch failed for participant ${participantId}`);
}

// ❌ BAD - Silent failures, no context
try {
  const activities = await stravaClient.getActivities(token);
  return activities;
} catch (e) {
  console.log('error'); // No context
  return [];  // Silent failure
}
```

**Rules:**
- Always provide context in error messages (what failed, why, for what resource)
- Use `logger` for production, `console.error` for development
- Never silently swallow errors (no empty catch blocks)
- Re-throw with context when appropriate

---

## Boundaries (3-Tier System)

### ✅ **Always Do**
- Write **TypeScript only** in backend (`server/src/` must be `.ts` files, no `.js`)
- Write **unit tests for new features** (include both happy path and error cases)
- **Verify Node version** before starting dev (`node --version` must be 24.x)
- **Check `git status` before committing** to verify you're only adding intended files
- **Run linter before committing** (`npm run lint:all` must pass)
- **Use `start_date` from Strava** API (UTC), never `start_date_local` (local timezone)
- **Convert timestamps to Unix seconds** immediately at input boundary
- **Format timestamps at display edge** using browser timezone via `Intl.DateTimeFormat()`

### ⚠️ **Ask First (Before Proceeding)**
- Database schema changes (discuss impact on migrations)
- Adding new dependencies (verify no conflicts)
- Modifying production config or environment variables
- Creating new major features (discuss scope)
- Changing authentication or session handling
- Modifying the leaderboard scoring logic (complex, deletion-safe architecture)

### 🚫 **Never Do**
- Commit secrets, API keys, or `.env` values to git
- Use `start_date_local` from Strava (causes timezone bugs)
- Create temporary files outside `.copilot-temp/` directory
- Edit `node_modules/` or generated files
- Use `git add .` (always use specific file paths)
- Commit generated files (build outputs, coverage reports)
- Store plaintext OAuth tokens (must encrypt at rest in production)
- Remove failing tests without user authorization
- Modify code logic to "fix" a linting error (use `npm run lint:fix` for style)

---

## Architecture (Essential Details)

- **Frontend:** React 18 + TypeScript + Vite (`src/`)
- **Backend:** Express + TypeScript + SQLite (`server/src/`)
- **Auth:** Strava OAuth with AES-256-GCM token encryption
- **Build:** TypeScript compiles to CommonJS for production

**See:** [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for complete system design

---

## Security

✅ **Current Status:**
- Token encryption: AES-256-GCM at rest
- GDPR compliant with 48-hour data deletion SLA
- OAuth per-participant with auto-refresh
- Secure cookies + proxy configuration
- Production-ready security audit complete

**Key principle:** Never commit secrets, API keys, or plaintext OAuth tokens. Encrypt tokens at rest in production.

**When adding features:** Check [`docs/PRIVACY_POLICY.md`](../PRIVACY_POLICY.md) for data handling requirements and [`docs/SECURITY_AUDIT.md`](../docs/SECURITY_AUDIT.md) for security patterns.

**See:** [`docs/STRAVA_INTEGRATION.md`](../docs/STRAVA_INTEGRATION.md) for OAuth details and [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for production setup

---

## Communication: Work Summary vs. File Creation

**Core principle:** Explain what you did in chat. Use files strategically, not as a workaround for explanation.

**DO:**
- ✅ Explain changes directly in conversation (clear, concise summary)
- ✅ Say "I updated X because Y" and move forward
- ✅ When doing analysis/reviews, save to `.copilot-temp/[descriptive-name].md` for user reference
- ✅ Keep responses focused and brief—avoid repetition
- ✅ When the main work is editing an existing file, prefer updating that file (don't also create temp summaries)

**DO NOT:**
- ❌ Create temp files AND also create duplicate analysis in `/tmp/` (use `.copilot-temp/` only)
- ❌ Use `cat` or `run_in_terminal` to display temp file contents back to user (they can open in editor)
- ❌ Say "let me create a summary" and repeat what you already said in chat
- ❌ Create multiple summaries/reviews of the same work
- ❌ Create temp files if the main work is editing a single existing file (just explain in chat)

**When to use `.copilot-temp/`:**
- Comprehensive code reviews or analysis during refactoring
- Detailed reports on findings/changes
- Step-by-step documentation of complex changes
- Migration guides or validation summaries

**When NOT to use `.copilot-temp/`:**
- Editing a specific existing file (the file itself is the main deliverable)
- Simple tasks with straightforward explanations
- Changes that just need brief chat summary

Remember: `.copilot-temp/` files are for user reference only. Delete them before final commits.

---

## Getting Help

**Quick Start:** [`docs/QUICK_START.md`](../docs/QUICK_START.md)
**Architecture:** [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
**API Reference:** [`docs/API.md`](../docs/API.md)
**Database:** [`docs/DATABASE_DESIGN.md`](../docs/DATABASE_DESIGN.md)
**Deployment:** [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)
**Admin Guide:** [`ADMIN_GUIDE.md`](../ADMIN_GUIDE.md)
**Scoring:** [`docs/SCORING.md`](../docs/SCORING.md)
**All Docs:** [`docs/README.md`](../docs/README.md)
