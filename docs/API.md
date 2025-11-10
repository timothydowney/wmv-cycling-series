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

### Example: GET /weeks/:id/leaderboard

Response
```
{
  "week": { "id": 1, "week_name": "Hill Climb Week", "date": "2025-06-03", ... },
  "leaderboard": [
    {
      "participant_id": 1,
      "name": "Rider One",
      "total_time_sec": 842,
      "rank": 1,
      "base_points": 3,
      "participation": 1,
      "pr_bonus": 1,
      "total_points": 5
    },
    ...
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

Notes
- Admin endpoints assume an authenticated admin context (add auth later for production). For development/testing, use as-is.
- Full schema and relationships are in DATABASE_DESIGN.md
