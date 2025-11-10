# Architecture overview

## Tech stack
- Frontend: React 18 + TypeScript (Vite dev/build)
- Backend: Node.js 24.x (Express, CommonJS)
- Database: SQLite via better-sqlite3
- Auth: Express sessions; Strava OAuth (planned UI, backend implemented)

## Frontend structure
- src/App.tsx — top-level state and routing (leaderboards, admin)
- src/api.ts — HTTP client for backend API
- src/components/* — UI components
  - WeeklyLeaderboard, SeasonLeaderboard, WeekManager
  - ManageSegments + SegmentCard (segment validation, list, refresh metadata)

Dev server on http://localhost:5173 (Vite)

## Backend structure
- server/src/index.js — Express app, DB schema, routes
- server/data/wmv.db — SQLite database (auto-created)
- server/scripts/* — seed, import/export helpers
- server/src/__tests__ — Jest test suite

API highlights
- Weeks: list, detail, leaderboard
- Season leaderboard
- Activities: per-week list and per-activity efforts
- Admin: create/update/delete weeks; manage segments (with metadata cache)
- OAuth: Strava connect/status/disconnect; token refresh utility

Dev server on http://localhost:3001 (nodemon in dev)

## Data model
- Core tables: seasons, participants, segments, weeks, activities, segment_efforts, results, participant_tokens
- Segments store cached metadata (distance, avg_grade, city/state/country) to reduce Strava API calls
- See DATABASE_DESIGN.md for full schema and queries

## Flows

Weekly results (current)
1) Admin defines week with segment + date/time window + required laps
2) Activities (test data or submission endpoint) are processed
3) For each participant: select best qualifying activity on the day
4) Sum efforts, rank by total time, compute points

Segment management
1) Validate a Strava segment by URL/ID (requires a connected token)
2) Store the segment with metadata (cached)
3) "Refresh Metadata" updates all stored segment details from Strava

## Environment
- Node 24.x enforced via engines and check-node scripts
- CORS configured for 5173 in development
- Sessions stored in-memory (dev); production should use a durable store

## Build & test
- Root build: builds frontend and ensures server deps installed
- Tests: `cd server && npm test` (run from root via `npm test`)
- Coverage: backend tests; see server/coverage (do not commit in normal workflow)
