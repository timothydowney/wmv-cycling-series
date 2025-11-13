# API reference

Base URL (dev): http://localhost:3001

All responses are JSON.

## Public endpoints

- GET /health — service health
- GET /segments — list all known segments
- GET /weeks — list all weeks with time windows
- GET /weeks/:id — week details
- GET /weeks/:id/leaderboard — leaderboard and results for a week
- GET /season/leaderboard — season standings across all weeks
- GET /weeks/:id/activities — activities ingested for that week
- GET /activities/:id/efforts — efforts that make up an activity

### GET /weeks/:id/leaderboard

Response shape:
```
{
  "week": {
    "id": number,
    "week_name": string,
    "date": "YYYY-MM-DD",
    "segment_id": number,
    "required_laps": number,
    "start_time": "ISO8601",
    "end_time": "ISO8601"
  },
  "leaderboard": [
    {
      "participant_id": number,
      "name": string,
      "total_time_sec": number,
      "rank": number,
      "base_points": number,
      "participation": 1,
      "pr_bonus": 0|1,
      "total_points": number
    }
  ]
}
```

## OAuth and auth status

- GET /auth/strava — redirect to Strava OAuth
- GET /auth/strava/callback — Strava returns here; exchanges code for tokens; creates session
- GET /auth/status — returns connection status and participant info
- POST /auth/disconnect — revoke connection and destroy session

## Admin endpoints

Week management
- POST /admin/weeks — create week
- PUT /admin/weeks/:id — update week
- DELETE /admin/weeks/:id — delete week

Segments
- GET /admin/segments — list segments with cached metadata
- POST /admin/segments — upsert by Strava segment ID (persists metadata: distance, avg_grade, city/state/country)

Data export/import (Development only)
- GET /admin/export-data — export segments, seasons, weeks as JSON (excludes participants and tokens). **Development mode only.**
- POST /admin/import-data — import segments, seasons, weeks from JSON (clears existing, preserves participants). **Development mode only.**

Activity submission (in-progress)
- POST /weeks/:id/submit-activity — validate a Strava activity URL against the week (requires auth)

## Error responses

Errors follow a simple pattern:
```
{
  "error": string,      // short code or description
  "message": string,    // human-friendly detail
  "details": object?    // optional structured fields
}
```

Common cases:
- 400 Invalid input (missing required fields, invalid segment_id)
- 401 Not authenticated (OAuth-protected endpoints)
- 404 Resource not found (week/segment/activity absent)
- 500 Unexpected server failure

## Auth notes

Sessions use cookies (express-session). `GET /auth/status` returns participant context.
Future hardening: add admin flag/role; currently admin endpoints are open in dev.

## Rate limiting

No internal rate limit yet; rely on Strava's API limits for validation calls. Segment metadata cached to reduce calls.

## Admin Data Export/Import

⚠️ **DEVELOPMENT MODE ONLY:** These endpoints are disabled in production (`NODE_ENV=production`) and return `403 Forbidden`. They are only available in development for convenient data loading and testing. In production, the database should be backed up via the standard backup strategy (see `docs/DEPLOYMENT.md`).

### GET /admin/export-data

Export segments, seasons, and weeks as a JSON file. Participants are NOT exported (they're tied to OAuth tokens and must connect individually). This is useful for:
- Backing up season data
- Archiving completed seasons
- Transferring data between environments

**Response:**
```
{
  "exportedAt": "2025-11-12T10:30:45.123Z",
  "version": "1.0",
  "data": {
    "segments": [
      {
        "strava_segment_id": 987654,
        "name": "Lookout Mountain",
        "distance": 2.5,
        "average_grade": 6.5,
        "city": "Denver",
        "state": "CO",
        "country": "USA"
      }
    ],
    "seasons": [
      {
        "id": 1,
        "name": "2025 Fall Series",
        "start_date": "2025-09-01",
        "end_date": "2025-11-30",
        "is_active": 1
      }
    ],
    "weeks": [
      {
        "id": 1,
        "season_id": 1,
        "week_name": "Week 1: Season Opener",
        "date": "2025-09-09",
        "strava_segment_id": 987654,
        "required_laps": 2,
        "start_time": "2025-09-09T00:00:00Z",
        "end_time": "2025-09-09T22:00:00Z"
      }
    ]
  }
}
```

**Note:** Participants are intentionally excluded. They connect via OAuth and manage their own connections. OAuth tokens are never exported.

**Headers:** Content-Disposition set to download as `wmv-export-YYYY-MM-DD.json`

---

### POST /admin/import-data

Import segments, seasons, and weeks from a JSON file. This:
- Clears all existing segments, seasons, weeks (atomically)
- **Preserves all participants and OAuth tokens**
- Preserves deletion request history
- Validates foreign key relationships
- Skips invalid records (missing required fields)

**Request:**
```json
{
  "data": {
    "segments": [
      { 
        "strava_segment_id": 987654, 
        "name": "Lookout Mountain",
        "distance": 2.5,
        "average_grade": 6.5,
        "city": "Denver",
        "state": "CO",
        "country": "USA"
      }
    ],
    "seasons": [
      {
        "id": 1,
        "name": "2025 Fall Series",
        "start_date": "2025-09-01",
        "end_date": "2025-11-30",
        "is_active": 1
      }
    ],
    "weeks": [
      {
        "id": 1,
        "season_id": 1,
        "week_name": "Week 1: Season Opener",
        "date": "2025-09-09",
        "strava_segment_id": 987654,
        "required_laps": 2,
        "start_time": "2025-09-09T00:00:00Z",
        "end_time": "2025-09-09T22:00:00Z"
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "imported": {
    "segments": 1,
    "seasons": 1,
    "weeks": 1
  }
}
```

**Validation:**
- `segments`: Requires `strava_segment_id` and `name` (distance, grade, location optional)
- `seasons`: Requires `name`, `start_date`, `end_date` (id is remapped, is_active defaults to 0)
- `weeks`: Requires `season_id`, `week_name`, `strava_segment_id`, `start_time`, `end_time` (date and required_laps optional, defaults to 1 lap)

**Atomicity:** If any error occurs, the entire transaction rolls back; no partial data is imported.

**Invalid Records:** Records missing required fields are skipped silently. Only valid records are inserted.

**Participants:** Import does NOT touch participants or their OAuth tokens. Participants must connect via OAuth individually.

---

## Related docs

- See `SCORING.md` for points calculation
- See `DATABASE_DESIGN.md` for table relationships
- See `ADMIN_GUIDE.md` for how to use export/import in practice
