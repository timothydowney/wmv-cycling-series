# GitHub Copilot Instructions for Strava NCC Scrape Project

## Project Overview
This is a React + TypeScript frontend with Node.js Express backend application for tracking Western Mass Velo's weekly cycling competition. It calculates scores, displays leaderboards, and will integrate with Strava API.

## Critical Setup Information

### Node.js Version Requirements
- **REQUIRED:** Node.js v20-24 (NOT v25+)
- The project uses `better-sqlite3` native module which requires Node 20-24
- `.nvmrc` file specifies Node 20
- If user has Node 25+, instruct them to either:
  1. Downgrade to Node 20 or 24
  2. Use `npx -p node@20` prefix for npm commands
  3. Use nvm: `nvm install 20 && nvm use 20`

### Development Server Setup

#### IMPORTANT: Always use `npm run dev:all`
- **Primary command:** `npm run dev:all` - starts BOTH backend and frontend
- This runs both servers in ONE terminal (uses `&` to background the backend)
- Backend runs on `http://localhost:3001`
- Frontend runs on `http://localhost:5173`
- To stop: Press `Ctrl+C` once (stops both)

#### Alternative (if user insists on separate terminals)
- Terminal 1: `cd server && npm start` (backend)
- Terminal 2: `npm run dev` (frontend)

### Common Issues & Solutions

#### 1. CORS Errors
- Backend is configured to accept requests from both `localhost:5173` and `127.0.0.1:5173`
- CORS config is in `server/src/index.js` around line 13-16
- If CORS errors occur, check that both servers are running

#### 2. better-sqlite3 Build Errors
- Almost always caused by wrong Node.js version
- **Solution:** Ensure Node 20-24 is being used
- Then run: `cd server && npm rebuild better-sqlite3`

#### 3. Port Already in Use
- Backend uses port 3001, frontend uses 5173
- Kill processes: `lsof -ti:3001 | xargs kill -9` or `lsof -ti:5173 | xargs kill -9`

#### 4. Database Issues
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
npm run dev:all  # PREFERRED - runs both servers
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
2. `PLAN.md` - Development roadmap and milestones
3. `DATABASE_DESIGN.md` - Complete database schema and queries
4. `ADMIN_GUIDE.md` - How to manage weekly competitions
5. `STRAVA_INTEGRATION.md` - OAuth flow and API integration plans

### Key Configuration Files
- `.nvmrc` - Node version (20)
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
- Backend has comprehensive Jest test suite (`server/src/__tests__/`)
- 59 test cases covering all endpoints
- Run: `npm test` or `cd server && npm test`
- Coverage: 94% (see `server/coverage/`)

## Common User Questions

**Q: Why do I need Node 20-24 and not 25?**
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

1. **Always check Node version first** if there are build errors
2. **Recommend `npm run dev:all`** as the primary way to run the app
3. **Check both servers are running** if there are network/CORS errors
4. **Reference the markdown docs** - they contain detailed information
5. **Don't overcomplicate** - the setup is simple when using the right commands
6. **Remember this is a work in progress** - Strava integration is planned but not done

## Project Status (as of November 2025)
- ✅ Backend API fully functional with test data
- ✅ Frontend displays leaderboards correctly
- ✅ Admin endpoints for week management
- ✅ Comprehensive test coverage
- ⏳ Strava OAuth integration (planned)
- ⏳ Activity submission and validation (planned)
- ⏳ Production deployment (not started)
