# GitHub Copilot Instructions

WMV Cycling Series: React 19 + TypeScript frontend with Node.js 24 Express + tRPC backend. SQLite database via Drizzle ORM.

---

## 🚨 CRITICAL: Version & Changelog Requirements

**Update these files together only in the final pre-commit pass for a user-facing commit:**

- Do not bump `VERSION` or edit `CHANGELOG.md` during planning, early implementation, or exploratory work.
- If work is not about to be committed, leave both files unchanged.
- `CHANGELOG.md` should capture the high-level user-facing delta, not a play-by-play of every intermediate edit.

1. **VERSION file** (`/VERSION`): Update semantic version number
   - Bug fixes: increment patch (0.11.0 → 0.11.1)
   - New features: increment minor (0.11.0 → 0.12.0)
   - Breaking changes: increment major (0.11.0 → 1.0.0)

2. **CHANGELOG.md** (`/CHANGELOG.md`): Add entry under `## [Unreleased]` section
   - Use `### Added`, `### Changed`, `### Fixed`, or `### Removed`
   - Be specific about what changed and why it matters to users
   - When releasing, move `[Unreleased]` to new version section with date
   - Update comparison links at bottom of file

**Example workflow:**
```bash
# After validation passes and right before commit
echo "0.11.2" > VERSION
# Edit CHANGELOG.md to add your changes
git add VERSION CHANGELOG.md <your-changed-files>
git commit -m "feat: your feature description

Version: 0.11.2"
```

**This is not optional for user-facing commits.** Update both files together immediately before staging and commit.

---

## Quick Start

**Development:**
```bash
npm run dev           # Start frontend + backend (http://localhost:5173 and :3001)
npm run dev:cleanup   # Stop all servers
```

**Testing & Building:**
```bash
npm test              # Frontend + backend tests
npm run test:e2e      # E2E tests (headless)
npm run test:e2e:headed  # E2E tests (visible browser)
npm run build         # Production build
npm run lint          # Lint both frontend + backend
npm run typecheck     # Typecheck both
```

**Node.js 24.x required.** Check: `node --version`

See [AGENTS.md](./AGENTS.md) for full npm task reference and database information.

`AGENTS.md` is the canonical shared operations reference for commands, environment separation, validation flow, and branch discipline. Prefer linking there instead of restating those details in custom agents, prompts, and skills.

## Branch Discipline

Before substantial planning or implementation work:

1. Check the current branch with `git branch --show-current`.
2. If the task is a new feature, phase, or approved slice, update `main` first.
3. Create or switch to a dedicated feature branch from `main` before making substantial changes.
4. Do not continue substantial work on an unrelated PR branch just because the workspace was already there.
5. If you discover after edits that the branch is wrong, transplant the working tree onto a fresh branch from `main` before continuing.

---

## Project Structure

```
/src                     # React frontend (TypeScript)
/server/src              # Express + tRPC backend (TypeScript)
/server/data/wmv.db      # Development database (SQLite)
/server/data/wmv_e2e.db  # E2E test database (production copy)
/e2e                     # Playwright end-to-end tests
/docs                    # Documentation (not /docs-site)
.github/workflows/       # CI/CD pipelines
```

## Technology Stack

### Frontend
- **React 19** + TypeScript + Vite
- **tRPC Client** for type-safe API calls
- **TanStack React Query (v5)** for data management
- **Tailwind CSS** for styling

### Backend
- **Express** on Node.js 24.x
- **tRPC** for type-safe RPC procedures
- **Drizzle ORM** for database queries
- **SQLite** via better-sqlite3 (file-based)
- **TypeScript only** (no `.js` files in `/server/src`)

### Testing
- **Vitest** for frontend tests
- **Jest + ts-jest** for backend unit tests (in-memory SQLite)
- **Playwright** for E2E tests (uses wmv_e2e.db)

## Operational Reference

Use [AGENTS.md](./AGENTS.md) as the source of truth for:

- npm task catalogs
- database and environment separation
- branch discipline and working-tree transplant rules
- validation and pre-commit flow

For GitHub operations such as pull request review, issue lookup, labels, search, and repository metadata, prefer GitHub MCP and workspace-integrated GitHub tools first. Use `gh` only as a fallback when the MCP path is unavailable or cannot provide the required data.

## Code Patterns & Standards

### Backend (TypeScript Only)

**Dependency Injection for Services:**
```typescript
// Services receive drizzleDb in constructor
class ActivityService {
  constructor(private db: BetterSQLite3Database) {}
  
  async getActivities(weekId: number) {
    return this.db.select().from(activity)
      .where(eq(activity.week_id, weekId))
      .all();
  }
}

// tRPC routers receive drizzleDb via context
export const leaderboardRouter = router({
  getWeekLeaderboard: publicProcedure
    .input(z.object({ weekId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { drizzleDb } = ctx;
      return await drizzleDb.select().from(result).all();
    })
});
```

**Database Queries:**
- Always use Drizzle ORM (no raw SQL unless unavoidable)
- Parameterized queries prevent SQL injection
- Transactions for data consistency

**Error Handling:**
```typescript
try {
  const data = await service.fetchData();
  return data;
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new Error('User-friendly message');
}
```

### Frontend (React + TypeScript)

**tRPC Hooks:**
```typescript
import { trpc } from '@/utils/trpc';

// Data fetching
const { data, isLoading, error } = trpc.leaderboard.getWeekLeaderboard.useQuery(
  { weekId },
  { enabled: weekId > 0 }
);

// Mutations
const mutation = trpc.week.create.useMutation({
  onSuccess: () => {
    queryClient.invalidateQueries();
  }
});
```

**Component Props:**
```typescript
interface ComponentProps {
  weekId: number;
  onSelect?: (week: Week) => void;
}

export const Component: React.FC<ComponentProps> = ({ weekId, onSelect }) => {
  // ...
};
```

Never use `any` type. Always prefer specific types.

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Functions | camelCase | `getActivitiesForWeek()` |
| Classes | PascalCase | `ActivityService`, `TokenManager` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_TIMEOUT_MS` |
| Files (components) | PascalCase | `WeeklyLeaderboard.tsx` |
| Files (utilities) | camelCase | `tokenManager.ts`, `dateUtils.ts` |
| Database tables | snake_case | `participant`, `segment_effort`, `participant_token` |

## Timestamps & Timezones

**Golden Rule:** Strava ISO (UTC) → Unix seconds (storage) → Browser timezone (display)

1. **From Strava API (Input):**
   - Use `start_date` (UTC with Z): `"2025-10-28T14:30:00Z"`
   - **Never** use `start_date_local` (timezone-dependent bugs)

2. **Internal Storage:**
   - Store as INTEGER Unix seconds (UTC-based)
   - Example: `1730126400` (absolute point in time)

3. **API Responses:**
   - Return numbers (Unix seconds), not ISO strings
   - Frontend formats at display time

4. **Frontend Display:**
   - Convert Unix to browser's local timezone via `Intl.DateTimeFormat()`
   - Use formatters in `src/utils/dateUtils.ts`

**Why:** Zero timezone math in code, portable everywhere, browser-aware display.

## Strava API Integration

**CRITICAL: Always use `start_date` (UTC), never `start_date_local`**

OAuth flow:
1. User clicks "Connect with Strava"
2. Redirect to `/auth/strava` (frontend)
3. Backend exchanges auth code for tokens
4. Tokens stored encrypted in `participant_token` table
5. Tokens auto-refresh before expiry (6-hour lifecycle)

**Activity Collection:**
- Admin triggers `POST /admin/weeks/:id/fetch-results`
- System fetches activities for all connected participants
- Filters to required segment + time window
- Selects best qualifying activity (fastest time with required reps)
- Stores in database, leaderboard auto-updates

See [docs/STRAVA_INTEGRATION.md](./docs/STRAVA_INTEGRATION.md) for complete guide.

## Testing

**Unit Tests (Backend):**
```bash
npm test              # All tests
npm run test:watch    # Watch mode
```
- In-memory SQLite via `setupTestDb` pattern
- Tests in `server/src/__tests__/`
- Cover happy path + error cases
- Aim for >85% coverage

**E2E Tests (Playwright):**
```bash
npm run test:e2e           # Headless (CI-friendly)
npm run test:e2e:headed    # Visible browser
npm run test:e2e:ui        # Interactive debugging
```
- Use separate `wmv_e2e.db` (production copy)
- Tests in `e2e/tests/`
- Use `data-testid` for robust selectors
- Run against http://localhost:3001 and :5173

## Pre-Commit Workflow

**Before committing, ALWAYS:**

1. **Run checks:**
   ```bash
   npm run lint       # Lint both frontend + backend
   npm run typecheck  # Typecheck both
   npm test           # Run frontend + backend tests
   npm run build      # Verify production build
   ```
2. **Run Docker validation for dependency and build-path changes:**
  ```bash
  npm run validate:docker
  ```
  Required when changing `package.json`, lockfiles, `server/package.json`, `Dockerfile`, install hooks/scripts, Node version checks, dependency versions, or frontend/backend build tooling.
3. **If this commit is user-facing, update `VERSION` and `CHANGELOG.md` immediately before staging and commit** (see top of this file).

**Git best practices:**
- Use `git add <specific-files>` (never `git add .`)
- Review `git status` before committing
- Delete temporary/debug files before commit
- Keep git history clean
- Include version number in commit message for releases

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):
1. Lint (frontend + backend): `npm run lint`
2. Typecheck (frontend + backend): `npm run typecheck`
3. Build (frontend + backend): `npm run build`
4. Test (backend): `npm test`
5. Docker build validation
6. Deploy to Railway (on main branch push)

All checks must pass before merge.

## Deployment

**Production:** Railway.app

**Key requirements:**
- Node.js 24.x
- Persistent volume at `/data` (SQLite database)
- Environment variables in Railway dashboard
- HTTPS auto-configured
- Auto-deploys on push to main branch

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for complete setup.

## Security Best Practices

✅ **Always:**
- Use parameterized queries (Drizzle ORM)
- Encrypt sensitive data at rest
- Validate user input
- Use HTTPS for all communication
- Handle errors gracefully (no sensitive info in messages)

❌ **Never:**
- Commit secrets or API keys to git (use `.env` + `.gitignore`)
- Store plaintext tokens (encrypt with AES-256-GCM)
- Use raw SQL concatenation
- Log sensitive data
- Hardcode credentials

See [docs/SECURITY_AUDIT.md](./docs/SECURITY_AUDIT.md) for full security review.

## Troubleshooting

### "Wrong Node version"
```bash
nvm use 24
node --version  # Verify v24.x.x
```

### "Port already in use"
```bash
npm run dev:cleanup
npm run dev
```

### "Cannot find module"
```bash
cd server && npm install
cd ..
npm install
npm run dev
```

### "Database locked" (E2E tests)
```bash
npm run dev:cleanup
npm run test:e2e
```

### TypeScript errors in IDE
```bash
npm run typecheck
```

## Documentation

For detailed information:
- **Quick start:** [docs/QUICK_START.md](./docs/QUICK_START.md)
- **Architecture:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Database:** [docs/DATABASE_DESIGN.md](./docs/DATABASE_DESIGN.md)
- **API reference:** [docs/API.md](./docs/API.md)
- **Strava integration:** [docs/STRAVA_INTEGRATION.md](./docs/STRAVA_INTEGRATION.md)
- **Scoring rules:** [docs/SCORING.md](./docs/SCORING.md)
- **Deployment:** [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- **Security audit:** [docs/SECURITY_AUDIT.md](./docs/SECURITY_AUDIT.md)
- **Admin guide:** [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)

## Key Information

| Item | Value |
|------|-------|
| Node.js | 24.x (required) |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Frontend | React 19 + TypeScript + Vite |
| Backend | Express + tRPC + TypeScript |
| Testing | Vitest (frontend) + Jest (backend) + Playwright (E2E) |
| Deployment | Railway.app |
| Hosting | Production: Railway, Development: Local |

---

**Last Updated:** February 2026  
**Version:** 3.0 (Added Version & Changelog Requirements)
