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
  - `AdminPanel` - Admin controls
  - `ManageSegments` - Segment management

### Backend (`/server`)

Express app on http://localhost:3001

**Structure (Pure TypeScript):**
- `server/src/index.ts` - Express setup, routes, middleware
- `server/src/routes/` - Route handlers (`.ts` files)
- `server/src/services/` - Business logic services (`.ts` files)
- `server/src/schema.ts` - Database schema
- `server/src/__tests__/` - Jest test suite (TypeScript test files)
- `server/dist/` - Compiled JavaScript output (production)
- `server/data/wmv.db` - SQLite database
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
   - If count >= required laps, select best consecutive window of laps
   - Calculate total time for that window
4. Select best (fastest total time) qualifying activity across all attempts
5. Store best activity and extract segment efforts

**Consecutive Window Selection:**
- If activity has exactly N efforts (N = required laps): use all efforts
- If activity has more than N efforts: find all possible consecutive N-length windows, select fastest window
- If activity has fewer than N efforts: activity doesn't qualify

**Example 1 (Single Effort):** If 1 lap required with 3 segment efforts [650s, 580s, 640s]:
- Window 1: [650s] = 650s total
- Window 2: [580s] = 580s total ← **Selected (fastest)**
- Window 3: [640s] = 640s total
- **Result:** Window 2 selected (single fastest effort)

**Example 2 (Multiple Efforts):** If 2 laps required with 5 segment efforts [600s, 650s, 580s, 640s, 620s]:
- Window 1: [600s, 650s] = 1250s total
- Window 2: [650s, 580s] = 1230s total
- Window 3: [580s, 640s] = 1220s total ← **Selected (fastest)**
- Window 4: [640s, 620s] = 1260s total
- **Result:** Window 3 selected (fastest consecutive pair)

**Multi-Activity Comparison:** If 2 laps required:
- Activity A: 2 efforts, 1400 sec total ✅ Qualifies
- Activity B: 5 efforts, best consecutive window 1220 sec total ✅ Qualifies
- Activity C: 1 effort ❌ Doesn't qualify
- **Result:** Activity B selected (1220s faster than 1400s)

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

## Real-Time Webhooks (Optional)

**Webhook Support:** Activities can be processed in real-time when Strava notifies your app, instead of waiting for manual admin batch fetch.

### Two Processing Modes

**1. Manual Batch Fetch (Default - Always Available)**
- Admin triggers: `POST /admin/weeks/:id/fetch-results`
- System fetches all activities for that week
- Good for: Predictable schedule, explicit control, fallback option

**2. Real-Time Webhooks (Optional - Feature Flag Gated)**
- Strava sends webhook when activity created/deleted/athlete disconnects
- Your app processes immediately in background
- Good for: Participants seeing results instantly, reduced admin work
- Requires: Public HTTPS domain, webhook subscription with Strava

Both modes use **identical activity matching logic** - results are identical whether triggered by batch fetch or webhook.

**Status:** Phase 3 complete (processor ready, feature-flagged), Phase 4 (subscription manager) in development

Full implementation: `docs/WEBHOOKS.md`

---

## Authorization & Access Control

The app uses **role-based access control** to distinguish between regular users and admins.

### Architecture

**Admins are identified by Strava athlete ID** (configured via `ADMIN_ATHLETE_IDS` environment variable):

```javascript
// Helper function parses comma-separated athlete IDs
function getAdminAthleteIds() {
  if (!process.env.ADMIN_ATHLETE_IDS) return [];
  return process.env.ADMIN_ATHLETE_IDS
    .split(',')
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id));
}

// Middleware protects admin endpoints
const requireAdmin = (req, res, next) => {
  // Must be authenticated first
  if (!req.session.stravaAthleteId) 
    return res.status(401).json({ error: 'Not authenticated' });
  
  // Check if athlete ID is in admin list
  const adminIds = getAdminAthleteIds();
  if (!adminIds.includes(req.session.stravaAthleteId))
    return res.status(403).json({ error: 'Admin access required' });
  
  next();
};

// All admin routes protected
app.post('/admin/weeks', requireAdmin, handleCreateWeek);
app.get('/admin/participants', requireAdmin, handleGetParticipants);
// ... etc
```

### User Experience

**Regular Users:**
- Navigation menu shows: "View Leaderboard" and "Disconnect from Strava"
- Cannot access `/admin/*` pages (403 error + "Access Denied" message)
- Can view leaderboards and season standings
- Can connect/disconnect from Strava

**Admins:**
- Navigation menu shows all options:
  - View Leaderboard
  - **Manage Competition** (create/edit weeks)
  - **Manage Segments** (add/update segments)
  - **Participant Status** (view connections)
  - Disconnect from Strava
- Full access to admin API endpoints

### Configuration

**Add/remove admins** by updating the `ADMIN_ATHLETE_IDS` environment variable:

Development:
```bash
# Edit server/.env
ADMIN_ATHLETE_IDS=12345678,87654321

# Restart servers
npm run dev:all
```

Production (Railway):
```
Railway Dashboard → Project Settings → Secrets
ADMIN_ATHLETE_IDS=12345678,87654321
→ Auto-redeploys with new value
```

**Safe default:** Empty `ADMIN_ATHLETE_IDS` = no one has admin access

### Security Properties

- ✅ **Immutable identity:** Athlete ID cannot be spoofed or changed
- ✅ **OAuth-backed:** Admin status requires successful Strava authentication
- ✅ **Defense-in-depth:**
  - Backend: API middleware returns 403 for non-admins
  - Frontend: UI hiding + page-level access checks
- ✅ **Atomic revocation:** Disconnecting Strava immediately revokes admin access
- ✅ **Audit logging:** Non-admin access attempts are logged

### Endpoints Protected

All admin endpoints require `requireAdmin` middleware:

| Endpoint | Purpose |
|----------|---------|
| `POST /admin/weeks` | Create competition week |
| `PUT /admin/weeks/:id` | Update week |
| `DELETE /admin/weeks/:id` | Delete week |
| `POST /admin/weeks/:id/fetch-results` | Fetch participant activities |
| `GET /admin/participants` | List connected participants |
| `GET /admin/segments` | List segments |
| `POST /admin/segments` | Add segment |
| `GET /admin/segments/:id/validate` | Validate segment from Strava |
| `GET /admin/export-data` | Export season data (dev only) |
| `POST /admin/import-data` | Import season data (dev only) |

For complete details: See `ADMIN_GUIDE.md`

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

### Timestamp Architecture (Critical)

**Golden Rule:** Timestamps flow as ISO strings with Z suffix (from Strava) → Unix seconds internally (database) → Browser timezone at display (user sees local time)

#### ⚠️ Strava API Field Usage (CRITICAL)

When processing Strava API responses, **ALWAYS use `start_date` (UTC), NEVER use `start_date_local` (local timezone)**.

**Strava Response Fields:**

| Field | Format | Timezone | Usage |
|-------|--------|----------|-------|
| `start_date` | `"2025-10-28T14:52:54Z"` | UTC (has Z) | ✅ **USE THIS** |
| `start_date_local` | `"2025-10-28T06:52:54"` | Athlete's local (no Z) | ❌ **NEVER USE** |
| `timezone` | `"(GMT-08:00) America/Los_Angeles"` | Info only | Reference only |
| `utc_offset` | `-28800` | Seconds offset | Reference only |

**Why This Matters:**
- Using `start_date_local` causes timestamps to be stored with athlete's timezone offset
- This replicates the original timezone bug
- Always use `start_date` which has explicit Z suffix (UTC, unambiguous)

**Code Example:**
```javascript
// CORRECT: Use start_date (UTC)
const unixSeconds = isoToUnix(activityData.start_date);  // ✅

// WRONG: Using start_date_local causes timezone bug
const unixSeconds = isoToUnix(activityData.start_date_local);  // ❌
```

**Applies To:**
- Activity responses: `start_date` ✅ vs `start_date_local` ❌
- Segment effort responses: `start_date` ✅ vs `start_date_local` ❌
- Lap responses: `start_date` ✅ vs `start_date_local` ❌

#### 1. From Strava API (Input)
- Strava returns `start_date` as ISO 8601 UTC: `"2025-10-28T14:30:00Z"`
- **Always includes Z suffix** (explicit UTC marker, not timezone-dependent parsing)
- Never use `start_date_local` (athlete's timezone, causes bugs)
- Pass `start_date` directly to `isoToUnix()` for conversion to Unix seconds

#### 2. Internal Storage (Database & Code)
- Store all timestamps as **INTEGER Unix seconds** (UTC-based)
- Example: `1730126400` (Oct 28, 2025 14:30:00 UTC)
- All date/time fields: `start_at`, `end_at` (INTEGER type)
- **No timezone assumptions** - Unix timestamps are absolute points in time
- Code logic: Compare timestamps as plain integers (no offset math, no DST handling)
  ```javascript
  if (activityUnix >= week.start_at && activityUnix <= week.end_at) { /* match */ }
  ```

#### 3. API Responses (Backend → Frontend)
- Return timestamps as **numbers** (Unix seconds), never as strings
- Example: `{ "week": { "start_at": 1730126400, "end_at": 1730212800 } }`
- Frontend consumes raw Unix numbers and formats at display time

#### 4. Frontend Display (Browser)
- Convert Unix seconds to user's **local timezone** using `Intl.DateTimeFormat()`
- Use formatters from `src/utils/dateUtils.ts`:
  - `formatUnixDate(unix)` → "October 28, 2025" (user's timezone)
  - `formatUnixTime(unix)` → "2:30 PM" (user's timezone)
  - `formatUnixDateShort(unix)` → "Oct 28" (user's timezone)
  - `formatUnixTimeRange(start, end)` → "2:30 PM - 4:00 PM" (user's timezone)

#### Why This Approach
- ✅ **Zero timezone math in code** - no offset calculations, no DST handling
- ✅ **Portable everywhere** - container runs UTC, deployment location irrelevant
- ✅ **Matches Strava format** - consistent with API source (ISO+Z)
- ✅ **Browser-aware** - each user sees their local time automatically
- ✅ **Testable** - Unix timestamps are deterministic, no timezone assumptions
- ✅ **No external deps** - uses built-in `Intl` API (available in all modern browsers and Node.js)

#### Common Mistakes to Avoid
- ❌ **Don't:** Use `start_date_local` from Strava (causes timezone offset bugs)
- ❌ **Don't:** Store ISO strings in database (breaks comparisons, timezone-dependent)
- ❌ **Don't:** Return ISO strings from API (forces frontend to re-parse)
- ❌ **Don't:** Use `new Date(isoString)` without Z suffix (timezone-dependent parsing)
- ❌ **Don't:** Display UTC times to users (show local timezone instead)
- ❌ **Don't:** Hardcode offsets or DST handling in code
- ✅ **DO:** Always use `start_date` from Strava API, never `start_date_local`
- ✅ **DO:** Always use Z suffix on ISO strings (explicit UTC)
- ✅ **DO:** Convert to Unix immediately at input boundary
- ✅ **DO:** Format only at display edge using `Intl` API

#### Container Configuration
- **Dockerfile:** `TZ=UTC` (all container processes run UTC)
- **Code:** `Math.floor(Date.now() / 1000)` for Unix seconds
- **Database:** All timestamps as INTEGER (Unix seconds)
- **Result:** Identical behavior in dev, test, and production environments

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
