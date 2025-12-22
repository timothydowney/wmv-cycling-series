# Agent Instructions - Strava NCC Scrape

## Project Overview
Western Mass Velo cycling competition tracker.
- **Frontend**: React 18 + TypeScript + Vite (`src/`)
- **Backend**: Express + tRPC + TypeScript (`server/src/`)
- **Database**: SQLite (via `better-sqlite3`) + Drizzle ORM
- **API**: tRPC (primary), Legacy REST (phasing out)

## Critical Rules

### 1. Server Management
**ALWAYS** use the following npm scripts. **NEVER** use `pkill`, `kill`, or `killall`.
- **Check Status**: `npm run dev:status`
- **Stop Servers**: `npm run dev:cleanup`
- **Start Interactive**: `npm run dev:all` (Frontend + Backend with logs)
- **Start Background**: `npm start` (CI/Agent mode)

### 2. Timezone & Dates
- **Input**: Use `start_date` (UTC with 'Z') from Strava. **NEVER** use `start_date_local`.
- **Storage**: Store as **Unix Integers** (seconds) in SQLite.
- **Output**: Send Unix integers to frontend.
- **Display**: Format in frontend using `Intl` API (User's browser timezone).
  - Use `src/utils/dateUtils.ts` helpers.

### 3. Coding Standards
- **TypeScript**: Strict typing. No `any`.
- **tRPC**: Use `trpc.<router>.<procedure>.useQuery/useMutation`.
- **Drizzle ORM**: Use for all DB access. **Inject** `drizzleDb` into services/routers.
- **Styling**: Vanilla CSS. `src/index.css` and component-specific styles.
- **Testing**: Backend tests only (`npm test`). In-memory DB.

### 4. Git & Vcs
- **Pre-commit**: Run `npm run lint:all`.
- **Commit**: Only essential files. No temp files, no build artifacts.

## Architecture
- **Dependency Injection**: Services and Routers receive `drizzleDb`.
- **Auth**: Strava OAuth 2.0. encrypted tokens.
- **File Structure**:
  - `src/components/`: React components
  - `server/src/trpc/`: API routers
  - `server/src/services/`: Business logic
  - `server/src/db/`: Schema and migrations

## Workflow
1.  **Analyze**: Understand the task.
2.  **Plan**: Create/Update `implementation_plan.md`.
3.  **Execute**: Make changes.
4.  **Verify**: Run tests (`npm test`) and check UI (`npm run dev:all`).
5.  **Clean**: Remove temp files.
