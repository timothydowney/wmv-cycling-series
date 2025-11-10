# Architecture Overview

High-level system design for WMV Cycling Series.

## Tech Stack

- **Frontend:** React 18 + TypeScript (Vite)
- **Backend:** Node.js 24.x + Express + SQLite
- **Database:** SQLite via better-sqlite3
- **Auth:** Express sessions + Strava OAuth

## System Architecture

### Frontend (`/src`)

Vite dev server on http://localhost:5173

**Structure:**
- `App.tsx` - Main component with state management
- `api.ts` - HTTP client for backend
- `components/` - UI components
  - `WeeklyLeaderboard` - Week results display
  - `SeasonLeaderboard` - Season standings
  - `WeekSelector` - Week picker
  - `StravaConnect` - OAuth connection button
  - `ActivitySubmission` - Activity submission form
  - `AdminPanel` - Admin controls
  - `ManageSegments` - Segment management

### Backend (`/server`)

Express app on http://localhost:3001

**Structure:**
- `server/src/index.js` - Express setup, routes, DB schema
- `server/data/wmv.db` - SQLite database
- `server/src/__tests__/` - Jest test suite
- `server/scripts/` - Database seed/import/export helpers

**Routes:**
- **Public:** `/weeks`, `/weeks/:id/leaderboard`, `/season/leaderboard`
- **Auth:** `/auth/strava`, `/auth/strava/callback`, `/auth/status`, `/POST auth/disconnect`
- **Admin:** `/admin/weeks`, `/admin/segments`, `/admin/weeks/:id/fetch-results`

See `docs/API.md` for complete reference.

### Database

SQLite file-based database at `server/data/wmv.db`

**Core tables:**
- `participants` - Users
- `segments` - Strava segments
- `weeks` - Weekly competitions
- `activities` - Strava activities per participant per week
- `segment_efforts` - Individual lap times
- `results` - Calculated leaderboard scores
- `participant_tokens` - OAuth tokens (1 per participant)

**For complete schema:** See `docs/DATABASE_DESIGN.md`

---

## Data Flow

### Weekly Competition Flow

1. **Admin creates week** with segment ID, date, and time window
   - `POST /admin/weeks`
2. **Participants connect Strava** (one-time OAuth)
   - `GET /auth/strava` → `GET /auth/strava/callback`
3. **Participants ride** and sync to Strava (no app interaction)
4. **Admin triggers batch fetch** at end of event day
   - `POST /admin/weeks/:id/fetch-results`
5. **System fetches activities** for all connected participants
   - Filters to required segment and time window
   - Finds best qualifying activity (required reps + fastest time)
   - Stores activities and segment efforts
6. **Leaderboard automatically updates**
   - Rankings calculated by time
   - Points awarded (beat others + PR bonus)
7. **Participants view results**
   - `GET /weeks/:id/leaderboard`
   - `GET /season/leaderboard`

### Activity Matching Algorithm

For each participant:
1. Fetch activities within event time window
2. Filter activities containing required segment
3. For each activity:
   - Count segment efforts for required segment
   - If count >= required laps, calculate total time
4. Select best (fastest total time) qualifying activity
5. Store best activity and extract segment efforts

**Example:** If 2 laps required:
- Activity A: 2 efforts, 1400 sec total ✅ Qualifies
- Activity B: 2 efforts, 1500 sec total ✅ Qualifies
- Activity C: 1 effort ❌ Doesn't qualify
- **Result:** Activity A selected (faster)

See `docs/STRAVA_INTEGRATION.md` for implementation details.

---

## OAuth Flow

```
User clicks "Connect"
  ↓
Redirect to /auth/strava
  ↓
Backend redirects to Strava OAuth authorize
  ↓
User authorizes on Strava
  ↓
Strava redirects to /auth/strava/callback?code=...
  ↓
Backend exchanges code for access/refresh tokens
  ↓
Backend stores tokens in participant_tokens table
  ↓
Frontend shows "Connected as [Name]"
```

**Key details:**
- Each participant has unique tokens
- Access tokens expire every 6 hours
- Refresh tokens auto-refresh before expiry
- Sessions store participant context (browser cookie)

Full implementation: `docs/STRAVA_INTEGRATION.md`

---

## Scoring System

**Points = Base Points + PR Bonus**

**Base Points:** Number of participants you beat + 1 (for competing)
- Example with 4 finishers:
  - 1st place beats 3 → 3 base points
  - 2nd place beats 2 → 2 base points
  - 3rd place beats 1 → 1 base point
  - 4th place beats 0 → 0 base points

**PR Bonus:** +1 if you set a personal record on any segment effort

**Season Points:** Sum of all weekly points

Details: `docs/SCORING.md`

---

## Development Environment

### Local Setup

```bash
npm install          # Install both frontend & backend deps
npm run dev:all      # Start both servers
npm test             # Run tests
npm run build        # Build for production
```

### File Structure

```
/
├── src/              # Frontend (React)
├── server/           # Backend (Express)
├── docs/             # Documentation
├── public/           # Static assets
├── package.json      # Frontend deps
├── server/package.json  # Backend deps
└── vite.config.ts    # Vite config
```

### Environment Variables

**Development:** Defaults work, optional Strava credentials in `.env`
**Production:** Set on hosting platform (see `docs/DEPLOYMENT.md`)

---

## Deployment

**Recommended:** Railway.app (simple, one platform, perfect for <100 participants)

**What happens:**
1. Push to GitHub main branch
2. Railway auto-deploys
3. App live at `your-app.railway.app`

**Details:** `docs/DEPLOYMENT.md`

---

## Testing

Backend Jest test suite:
- 95+ test cases
- ~90% coverage
- Covers all endpoints and business logic

```bash
npm test              # Run tests
npm test -- --watch  # Watch mode
npm test -- --coverage  # Show coverage
```

See test files: `server/src/__tests__/`

---

## Build & Production

### Frontend Build
```bash
npm run build:frontend
```
Outputs static files to `dist/`

### Backend
- Node.js only (no build needed)
- Better-sqlite3 requires compilation on install

### Production Build
```bash
npm run build
```
Builds frontend and ensures backend deps installed

---

## Scale & Performance

**Designed for:** <100 participants, weekly competitions

**Database Performance:**
- SQLite handles thousands of activities easily
- Indexes on week, participant, activity lookups
- No pagination needed (data set is small)

**API Performance:**
- Leaderboard queries: <10ms
- Activity fetch: Limited by Strava API rate limits (not your bottleneck)
- No caching needed (traffic is minimal)

**If you scale beyond 100 participants:**
- Migrate to PostgreSQL (same SQL, one-click on Railway)
- Add caching layer (Redis)
- Add CDN for frontend assets
- But WMV will never need this

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **SQLite** | Simple, no extra service, perfect for <100 participants |
| **Node.js 24** | Required for better-sqlite3 native module support |
| **Express** | Lightweight, perfect for simple REST API |
| **React** | Modern UI framework, excellent for leaderboards |
| **Vite** | Fast dev server, small bundle size |
| **Strava OAuth** | Standard OAuth, no need to store passwords |
| **Single-platform (Railway)** | Minimal ops overhead, great DX |

---

## See Also

- **Quick start:** `docs/QUICK_START.md`
- **Database schema:** `docs/DATABASE_DESIGN.md`
- **API reference:** `docs/API.md`
- **Strava integration:** `docs/STRAVA_INTEGRATION.md`
- **Scoring rules:** `docs/SCORING.md`
- **Admin operations:** `ADMIN_GUIDE.md`
- **Deployment:** `docs/DEPLOYMENT.md`
- **Full docs index:** `docs/README.md`
