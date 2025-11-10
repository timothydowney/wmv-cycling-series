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

No internal rate limit yet; rely on Strava’s API limits for validation calls. Segment metadata cached to reduce calls.

## Related docs

- See `SCORING.md` for points calculation
- See `DATABASE_DESIGN.md` for table relationships
