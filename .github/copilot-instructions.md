# GitHub Copilot Instructions for Strava NCC Scrape Project

## Project Overview
This is a React + TypeScript frontend with Node.js Express backend application for tracking Western Mass Velo's weekly cycling competition. It calculates scores, displays leaderboards, and will integrate with Strava API.

## Critical Setup Information

### Node.js Version Requirements
- REQUIRED: Node.js 24.x (LTS). Node 25+ is not supported yet.
- The project uses `better-sqlite3` native module; tested and supported on Node 24.x
- `.nvmrc` file specifies Node 24
- If user is on a different Node version, instruct them to either:
  1. Use nvm: `nvm install 24 && nvm use 24`
  2. Use `npx -p node@24` prefix for npm commands

### Development Server Setup

#### IMPORTANT: Always use `npm run dev:all`
- **Primary command:** `npm run dev:all` - starts BOTH backend and frontend
- Uses `concurrently` to run both servers with color-coded output (backend=blue, frontend=green)
- Backend runs on `http://localhost:3001`
- Frontend runs on `http://localhost:5173`
- **To stop:** Press `Ctrl+C` once (stops both) OR run `npm run stop`

#### Cleanup Command
- **Use `npm run stop` or `npm run cleanup`** to kill all dev processes
- Kills nodemon, vite, and anything on ports 3001/5173
- Run this if processes get stuck or you get "port already in use" errors

#### Alternative (if user insists on separate terminals)
- Terminal 1: `cd server && npm run dev` (backend with nodemon)
- Terminal 2: `npm run dev` (frontend with vite)

### Common Issues & Solutions

#### 1. CORS Errors
- Backend is configured to accept requests from both `localhost:5173` and `127.0.0.1:5173`
- CORS config is in `server/src/index.js` around line 13-16
- If CORS errors occur, check that both servers are running

#### 2. better-sqlite3 Build Errors
- Almost always caused by wrong Node.js version
- Solution: Ensure Node 24.x is being used
- Then run: `cd server && npm rebuild better-sqlite3`

#### 3. Port Already in Use
- **Solution:** Run `npm run stop` to cleanup all processes
- Or manually: `lsof -ti:3001 | xargs kill -9` or `lsof -ti:5173 | xargs kill -9`

#### 4. Processes Not Dying
- **Solution:** Always use `npm run stop` to cleanup
- This properly kills nodemon, vite, and all child processes
- `Ctrl+C` on `npm run dev:all` should work, but use `npm run stop` if it doesn't

#### 5. Database Issues
- SQLite database is at `server/data/wmv.db`
- Auto-seeds test data on first run
- Test data includes 2 weeks, 4 participants, 2 segments

## Architecture

### Frontend (`/src`)
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite 4
- **Main Files:**
  - `src/App.tsx` - Main app component with state management
  - `src/api.ts` - Backend API client
  - `src/components/` - React components (WeeklyLeaderboard, SeasonLeaderboard, WeekSelector)

### Backend (`/server`)
- **Runtime:** Node.js (CommonJS, not ESM)
- **Framework:** Express
- **Database:** SQLite via better-sqlite3
- **Main Files:**
  - `server/src/index.js` - Express server setup, routes, database schema
  - `server/data/wmv.db` - SQLite database (auto-created)

### API Endpoints
- `GET /weeks` - List all weeks
- `GET /weeks/:id` - Get week details
- `GET /weeks/:id/leaderboard` - Week leaderboard with results
- `GET /season/leaderboard` - Season-long standings
- `POST /admin/weeks` - Create new week (admin)
- `PUT /admin/weeks/:id` - Update week (admin)
- `DELETE /admin/weeks/:id` - Delete week (admin)

## Development Workflow

### First Time Setup
```bash
npm install  # Installs both frontend and backend dependencies
```

### Running for Development
```bash
npm run dev:all  # PREFERRED - runs both servers with concurrently
```

### Stopping Servers
```bash
# Press Ctrl+C to stop both servers
# OR if processes get stuck:
npm run stop  # Kills all dev processes and clears ports
```

### Running Tests
```bash
npm test  # Runs backend test suite (94% coverage)
```

### Building for Production
```bash
npm run build  # Builds both backend and frontend
```

## Important Files & Documentation

### Read These First When Starting
1. `README.md` - General overview and setup
2. `docs/DATABASE_DESIGN.md` - Complete database schema and queries
3. `docs/STRAVA_INTEGRATION.md` - OAuth flow and API integration plans
4. `ADMIN_GUIDE.md` - How to manage weekly competitions

### Key Configuration Files
- `.nvmrc` - Node version (24)
- `package.json` - Frontend dependencies and scripts
- `server/package.json` - Backend dependencies
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript configuration

## Debugging Tips

### Check if servers are running
```bash
lsof -ti:3001  # Backend
lsof -ti:5173  # Frontend
```

### View server logs
- Backend logs appear in the terminal running `npm run dev:all`
- Frontend logs appear in browser console
- Network errors visible in browser DevTools Network tab

### Common Error Patterns
- "CORS Allow Origin Not Matching" → Backend not running or CORS misconfigured
- "Failed to load weeks" → Backend not running on port 3001
- "Module build failed" → Wrong Node.js version or missing npm install

## Strava Integration Status
- **NOT YET IMPLEMENTED** - Currently using test data
- OAuth flow designed but not coded (see `STRAVA_INTEGRATION.md`)
- Activity submission endpoint exists but returns 501 (Not Implemented)
- Test data simulates real Strava activity structure

## Testing

### Test Suite
- Backend has comprehensive Jest test suite (`server/src/__tests__/`)
- 72 test cases covering all endpoints (100% pass rate)
- Coverage: ~90% statements, ~83% branches
- Run tests with: `npm test` (runs from root, executes server tests with coverage)

### Testing Best Practices - ALWAYS FOLLOW THESE

**CRITICAL: Keep tests up to date with all code changes**
- When adding a new endpoint, add tests for it IMMEDIATELY
- When changing business logic, update affected tests in the same commit
- Never leave tests failing or commented out
- Tests should be updated BEFORE or WITH code changes, never after

**Test Isolation**
- Each test suite must clean up after itself (use `afterAll` or `afterEach` hooks)
- Tests should not depend on execution order
- Never share mutable state between tests
- Reset database state or mock data between tests
- Example: If a test creates a new active season, restore the original active season in `afterAll`

**Test Coverage Requirements**
- All API endpoints must have tests for:
  - Happy path (successful requests)
  - Error cases (404, 400, validation failures)
  - Edge cases (empty results, boundary values)
  - Security (unauthorized access for admin routes)
- All business logic functions must have unit tests
- Aim for >85% code coverage (statements and branches)

**Test Organization**
- Group related tests in `describe` blocks
- Use descriptive test names: `it('should return 404 when week does not exist')`
- Follow AAA pattern: Arrange, Act, Assert
- Keep tests focused - one assertion per test when possible
- Use `beforeEach` for common setup, not copy-paste

**Test Data Management**
- Use consistent test data across all test files
- Seed data should be minimal but representative
- Don't rely on magic numbers - use named constants
- Clean up test data that could interfere with other tests

**When to Run Tests**
- Run full test suite before committing: `npm test`
- Run specific test file during development: `npm test -- path/to/test.js`
- Run tests with coverage to find gaps: `npm test -- --coverage`
- Run tests in watch mode during active development: `npm test -- --watch`

## Pre-Commit Checks

### All-in-One Command
```bash
npm run check  # Runs EVERYTHING before committing
```

This single command runs in sequence:
1. **npm audit** - Checks for security vulnerabilities (frontend + backend)
2. **typecheck** - TypeScript type checking on frontend
3. **lint** - ESLint on both frontend (ts/tsx) and backend (js)
4. **build** - Builds both frontend and backend
5. **test** - Runs full test suite with coverage

### Individual Pre-Commit Commands

**Security & Audit:**
```bash
npm audit                  # Check both frontend and backend for vulnerabilities
npm audit:fix             # Auto-fix vulnerabilities (review changes after)
```

**Code Quality:**
```bash
npm run lint              # Lint both frontend and backend
npm run lint:fix          # Auto-fix most linting issues
npm run typecheck         # TypeScript type checking (frontend only)
```

**Build & Test:**
```bash
npm run build             # Build both frontend and backend
npm test                  # Run full backend test suite with coverage
cd server && npm run test:watch  # Backend tests in watch mode during development
```

### When to Run Checks

**Before committing:**
```bash
npm run check  # ALWAYS do this before git commit
```

**If checks fail:**
1. **Audit failures** → Run `npm audit:fix`, review what changed
2. **Type errors** → Fix the TypeScript issues manually
3. **Lint failures** → Run `npm run lint:fix` to auto-fix
4. **Build failures** → Check console output for detailed errors
5. **Test failures** → Review test output and fix code or tests

**During active development:**
- Terminal 1: `npm run dev:all` (run dev servers)
- Terminal 2: `cd server && npm run test:watch` (run backend tests in watch mode)
- Periodically: `npm run check` (full validation)

### ESLint Rules

**Frontend (React/TypeScript):**
- Inherits recommended ESLint + React plugin rules
- React hooks best practices enforced
- JSX formatting rules

**Backend (Node.js/CommonJS):**
- 2-space indentation
- Single quotes for strings
- Semicolons required
- No unused variables (prefix with `_` to ignore)
- Prefer `const` over `let` or `var`
- Strict equality (`===`, `!==`)
- No `var` keyword (use `const`/`let`)
- Console.warn/error allowed, console.log discouraged in production

### CI/CD Integration

The GitHub Actions CI workflow runs the same checks automatically on every push and PR:
1. Audits dependencies (frontend + backend)
2. Typechecks frontend
3. Lints frontend and backend
4. Builds both
5. Runs all tests

**If CI fails**, fix locally using commands above, then push again.

## Common User Questions

**Q: Why do I need Node 24 and not 25?**
A: The `better-sqlite3` native module doesn't support Node 25 yet.

**Q: Can I use just the frontend without the backend?**
A: No, the frontend depends on the backend API for all data.

**Q: How do I add a new week?**
A: Use the admin endpoint: `POST /admin/weeks` (see `ADMIN_GUIDE.md`)

**Q: Where is the Strava integration?**
A: Not implemented yet. See `STRAVA_INTEGRATION.md` for the plan.

**Q: Why two separate servers?**
A: Frontend (Vite dev server) provides hot reload. Backend (Express) serves API. In production, backend can serve static frontend files.

## When Helping Users

### Quick Diagnosis
1. **Build errors?** → Check Node version first: `node --version` (must be 24.x)
2. **CORS/network errors?** → Verify both servers running: `lsof -ti:3001` and `lsof -ti:5173`
3. **Port conflicts?** → Run `npm run stop` to cleanup stuck processes
4. **Tests failing?** → Ensure Node 24.x, then run: `npm install && npm test`
5. **OAuth/session issues in production?** → Check reverse proxy config (`app.set('trust proxy', 1)` in index.js)

### Production Deployment Notes

**CRITICAL: Reverse Proxy & Secure Cookies**

If deploying behind a reverse proxy (Railway, Heroku, AWS, etc.), session cookies won't work without proper configuration:

1. **Express must trust the proxy:**
   ```javascript
   app.set('trust proxy', 1);  // In server/src/index.js - ALREADY SET
   ```

2. **Session config must use proxy mode:**
   ```javascript
   const sessionConfig = {
     proxy: true,  // Use X-Forwarded-Proto header
     rolling: true,  // Send cookies on every response (needed for OAuth)
     cookie: { secure: true, httpOnly: true, sameSite: 'lax' }
   };
   ```
   
3. **Without this:**
   - Browser gets new session ID on every request
   - User gets logged out after OAuth redirect
   - Session cookies never persist

**See docs/OAUTH_SESSION_FIX.md for complete explanation and testing procedures.**

For Railway specifically:
- ✅ Already configured correctly in code
- ✅ Just deploy and it works
- ⚠️ If session issues occur, check reverse proxy troubleshooting in docs/DEPLOYMENT.md

### Implementation Guidelines
- **New endpoints** → Add tests in `server/src/__tests__/` BEFORE or WITH the code
- **Database changes** → Update schema in `server/src/index.js`, add migration if needed
- **Frontend components** → Keep in `src/components/`, use existing patterns
- **API integration** → Use `src/api.ts` client, add types to `src/types.ts`
- **Production issues** → Check docs/OAUTH_SESSION_FIX.md and docs/DEPLOYMENT.md first
- **Before pushing** → Run `npm run check` (catches 99% of issues)

### Key Workflow
- **Development:** `npm run dev:all` (backend + frontend together)
- **Testing during dev:** Parallel terminals: one with `npm run dev:all`, one with `cd server && npm run test:watch`
- **Before commit:** `npm run check` (audits, types, lints, builds, tests)
- **Stuck processes:** `npm run stop` (safe cleanup)
- **Production debugging:** Check logs and verify reverse proxy config

## Project Status (as of November 2025)
- ✅ Backend API fully functional with test data
- ✅ Frontend displays leaderboards correctly
- ✅ Admin endpoints for week management
- ✅ Comprehensive test coverage (144 tests, ~50% coverage)
- ✅ **Strava OAuth integration working** (session persistence fixed with reverse proxy config)
- ✅ **Production deployment on Railway (fully functional)**
- ✅ Secure cookies and session handling configured correctly
- ⏳ Activity submission and validation (partial - tokens stored, ready for implementation)
