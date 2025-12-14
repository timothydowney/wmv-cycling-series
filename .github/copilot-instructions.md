# GitHub Copilot Instructions - Strava NCC Scrape

Western Mass Velo cycling competition tracker: React + TypeScript frontend with Node.js Express + tRPC backend. **Feature-complete and production-ready on Railway. Migrated to tRPC + Drizzle ORM (December 2025).**

---

## Quick Commands

⚠️ **CRITICAL: ALWAYS use `npm run <command>` format. NEVER use shorthand. NEVER use pkill/killall/kill.**

```bash
npm run dev:all              # Interactive: both servers with output (Ctrl+C to stop)
npm run dev:status           # Check if background servers are running
npm run dev:cleanup          # Force cleanup - use this ONLY to stop background servers
npm run test                 # Run all backend tests
npm run build                # Production build
npm run lint:all             # Lint everything
npm run check                # Full pre-commit checks (audit, typecheck, lint, build, test)
npm run lint:fix             # Auto-fix linting errors
```

**Node.js 24.x REQUIRED** (for `better-sqlite3`). Check: `node --version`

### ⚠️ CRITICAL: Server Process Management Rules

**DO NOT DEVIATE FROM THESE RULES:**

1. **BEFORE STOPPING:** Always check status first
   ```bash
   npm run dev:status
   ```

2. **TO STOP BACKGROUND SERVERS:** Use ONLY this command
   ```bash
   npm run dev:cleanup
   ```
   - **NEVER use:** `npm stop`, `npm cleanup` (wrong format)
   - **NEVER use:** `pkill`, `killall`, `kill -9` (bypasses npm targets)

3. **TO START INTERACTIVE:** Use this (and stop with Ctrl+C)
   ```bash
   npm run dev:all
   ```
   - Shows both frontend (Vite) and backend (Express + tRPC)
   - Backend available at http://localhost:3001
   - Frontend available at http://localhost:5173

4. **TO START BACKGROUND:** Use this
   ```bash
   npm start
   ```

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
npm start                    # Start both servers in background
npm run dev:status           # Check if running
npm run dev:cleanup          # Stop cleanly (always use this, never npm stop)
```
- Perfect for CI/CD, testing workflows, and agentic development
- Servers on http://localhost:3001 (backend) and http://localhost:5173 (frontend)

---

## ⚠️ ENFORCEMENT: Server Process Management (CRITICAL)

**THIS RULE IS NON-NEGOTIABLE. FOLLOW EXACTLY OR TASK FAILS.**

### The ONLY Allowed Commands

| Purpose | Command | ✅ CORRECT | ❌ WRONG |
|---------|---------|-----------|----------|
| Check if running | `npm run dev:status` | ✅ Full npm run format | `npm status` |
| Stop servers | `npm run dev:cleanup` | ✅ Full npm run format | `npm cleanup`, `npm stop` |
| Start interactive | `npm run dev:all` | ✅ Full npm run format | Shorthand commands |
| Start background | `npm start` | ✅ Only exception, full start not needed | Variations |

### What You MUST Do EVERY Time

1. **NEVER use raw process commands:**
   - ❌ `pkill -f "npm run dev:all"`
   - ❌ `pkill -9 -f "tsx src/index.ts"`
   - ❌ `killall node`
   - ❌ `kill -9 <pid>`
   - These bypass npm targets and leave orphaned processes

2. **ALWAYS use npm targets:**
   - ✅ Check first: `npm run dev:status`
   - ✅ Stop with: `npm run dev:cleanup`
   - ✅ Start with: `npm run dev:all` (interactive) or `npm start` (background)

3. **Enforcement sequence (for ANY server control):**
   ```bash
   # Step 1: ALWAYS check first
   npm run dev:status
   
   # Step 2: If running, use ONLY
   npm run dev:cleanup
   
   # Step 3: Then start as needed
   npm run dev:all          # Interactive (recommended for testing)
   # OR
   npm start                # Background
   ```

4. **If confused:**
   - Default to `npm run dev:status` first
   - Then default to `npm run dev:cleanup`
   - Never guess with pkill/kill commands

---

## Tech Stack Details (Post-Refactor)

### Frontend
- **React 18** + TypeScript + Vite
- **tRPC Client** for type-safe API calls (see `src/utils/trpc.ts`)
- **TanStack React Query** (v5+) for data fetching and caching

### Backend
- **Express** server on Node.js 24.x
- **tRPC** for type-safe RPC calls (routers in `server/src/trpc/`)
- **Drizzle ORM** for database interactions (schema in `server/src/db/schema.ts`)
- **Better SQLite3** driver (file-based SQLite database)
- **TypeScript only** in `server/src/` (no JavaScript files)

### Database
- **SQLite** file-based database (`server/data/wmv.db`)
- **Drizzle ORM** for migrations, queries, and type safety
- Persisted on Railway as volume mount at `/data/wmv.db`

### Testing
- **Jest** + **ts-jest** for backend tests
- In-memory SQLite database via `setupTestDb` pattern (no file-based test DBs)
- Tests in `server/src/__tests__/`

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

### Backend
- **All TypeScript** (`.ts` files only in `server/src/`)
- **Drizzle ORM** for all database interactions (schema in `server/src/db/schema.ts`)
- **Dependency Injection** for all services/routers (inject `drizzleDb` instance)
- **tRPC routers** in `server/src/trpc/` define all procedures (queries and mutations)
- **Services** in `server/src/services/` contain business logic
- **Never use global imports** of `db` in services
- **Never use raw SQL** unless absolutely necessary (use Drizzle ORM instead)

### Frontend
- **React 18** + TypeScript in `src/components/` and `src/utils/`
- **tRPC Client** (configured in `src/utils/trpc.ts`) for all API calls
- **Never use `src/api.ts`** for new features (legacy REST endpoint, being phased out)
- Components use `trpc.<router>.<procedure>.useQuery()` and `.useMutation()`

### Testing
- **Backend tests only** (Jest + ts-jest in `server/src/__tests__/`)
- **In-memory SQLite** via `setupTestDb` pattern (not file-based)
- **Dependency Injection** in tests: pass `drizzleDb` to services
- All endpoints and business logic must have tests (happy path + error cases)
- Aim for >85% coverage
- Run: `npm test` | Watch: `cd server && npm run test:watch` | Coverage: `npm test -- --coverage`
- **Critical:** Update tests WITH code changes, never after

---

## Code Style Examples

### TypeScript Naming Conventions

```typescript
// ✅ GOOD - Drizzle ORM with Dependency Injection
import { eq } from 'drizzle-orm';
import { activity, week } from '../db/schema';

class ActivityService {
  constructor(private db: BetterSQLite3Database) {}
  
  async getActivitiesForWeek(weekId: number) {
    return this.db
      .select()
      .from(activity)
      .where(eq(activity.week_id, weekId))
      .all();
  }
  
  async fetchActivitiesFromStrava(athleteId: number): Promise<void> {
    // Implementation with injected db
  }
}

const MAX_RETRIES = 3;
const API_TIMEOUT_MS = 5000;

// ❌ BAD - Raw SQL or global imports
import { db } from '../db'; // Don't use global imports in services
function getActivities(weekId) {
  return db.prepare('SELECT * FROM activity WHERE week_id = ?').all(weekId); // Avoid raw SQL
}
```

**Rules:**
- Functions/methods: `camelCase` (`getActivitiesForWeek`, `fetchSegmentEfforts`)
- Classes: `PascalCase` (`ActivityService`, `TokenManager`)
- Constants: `UPPER_SNAKE_CASE` (`MAX_RETRIES`, `API_TIMEOUT_MS`)
- Private members: use `private` keyword (`private db`, `private logger`)
- **Drizzle:** Always inject `drizzleDb` into service constructors

### React Component Patterns with tRPC

```typescript
// ✅ GOOD - tRPC hooks with type safety
import { trpc } from '../utils/trpc';

interface WeeklyLeaderboardProps {
  weekId: number;
}

export const WeeklyLeaderboard: React.FC<WeeklyLeaderboardProps> = ({ weekId }) => {
  // tRPC hook auto-handles loading, error, and data states
  const { data: leaderboard, isLoading, error } = trpc.leaderboard.getWeekLeaderboard.useQuery(
    { weekId },
    { enabled: weekId > 0 } // Only fetch when weekId is valid
  );

  if (isLoading) return <div>Loading leaderboard...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="weekly-leaderboard">
      {leaderboard?.leaderboard.map((entry) => (
        <div key={entry.participant_id}>{entry.name}: {entry.total_points} pts</div>
      ))}
    </div>
  );
};

// ❌ BAD - Manual API calls, no type safety
function Leaderboard({ weekId }) {
  const [results, setResults] = useState();
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setLoading(true);
    fetch(`/api/weeks/${weekId}/leaderboard`) // Manual fetch
      .then(r => r.json())
      .then(setResults)
      .catch(err => alert(err))
      .finally(() => setLoading(false));
  }, [weekId]);
  
  if (loading) return <div>Loading...</div>;
  return <div>{results?.map(r => <div>{r.name}</div>)}</div>;
}
```

**Rules:**
- **Always use tRPC hooks** for data fetching (provides type safety and auto-caching)
- Type props with `interface` (never `any`)
- Use `trpc.<router>.<procedure>.useQuery()` for queries and `.useMutation()` for mutations
- React Query (TanStack Query) handles loading/error states automatically
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
- **Use Drizzle ORM** for all database queries (no raw SQL unless essential)
- **Use Dependency Injection** for services/routers (inject `drizzleDb` in constructor)
- **Use tRPC** for all new API procedures (in `server/src/trpc/`)
- **Use tRPC hooks** in React components (`trpc.<router>.<procedure>.useQuery()`)
- Write **unit tests for new features** (include both happy path and error cases)
- **Use in-memory SQLite** via `setupTestDb` for tests (not file-based)
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
- Use raw SQL in services/routers (use Drizzle ORM instead)
- Import `db` globally in services (always inject via constructor)
- Use file-based SQLite for tests (use `setupTestDb` pattern instead)
- Create temporary files outside `.copilot-temp/` directory
- Edit `node_modules/` or generated files
- Use `git add .` (always use specific file paths)
- Commit generated files (build outputs, coverage reports)
- Store plaintext OAuth tokens (must encrypt at rest in production)
- Remove failing tests without user authorization
- Modify code logic to "fix" a linting error (use `npm run lint:fix` for style)

---

## Architecture (Essential Details)

### System Design
- **Frontend:** React 18 + TypeScript + Vite (`src/`)
  - tRPC Client for type-safe API calls
  - TanStack React Query for data management
  
- **Backend:** Express + tRPC + TypeScript (`server/src/`)
  - tRPC routers expose type-safe procedures
  - Services contain business logic (injected with `drizzleDb`)
  - Drizzle ORM for all database queries
  - SQLite database via `better-sqlite3`

- **Auth:** Strava OAuth 2.0 with AES-256-GCM token encryption
  - Token encryption at rest in database
  - Per-participant OAuth tokens (not shared)
  - Auto-refresh tokens before expiration

- **Build:** TypeScript compiles to CommonJS
  - Frontend builds to `dist/` (Vite)
  - Backend builds to `server/dist/` (tsc)
  - Production runs from compiled JavaScript

### Key Architectural Pattern: Dependency Injection
All services and routers accept a `drizzleDb` instance in their constructor. This enables:
- **Testability:** Pass in-memory DB for tests
- **Consistency:** All code uses Drizzle ORM
- **Type safety:** Full TypeScript inference

**Example:**
```typescript
// Router receives drizzleDb via context
export const leaderboardRouter = router({
  getWeekLeaderboard: publicProcedure
    .input(z.object({ weekId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { drizzleDb } = ctx; // Injected
      return await drizzleDb.select().from(result).all();
    })
});

// Service receives drizzleDb in constructor
class ActivityService {
  constructor(private db: BetterSQLite3Database) {}
  async getActivities() {
    return this.db.select().from(activity).all();
  }
}
```

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
