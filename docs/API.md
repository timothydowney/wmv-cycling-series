# API reference

**NOTE: The project is migrating to tRPC. The REST endpoints below are legacy or specific to Auth/Webhooks.**
**For all data fetching (Week, Season, Leaderboard, Segments, Participants, Webhook Admin), refer to the tRPC routers in `server/src/routers`.**

Base URL (dev): http://localhost:3001

## Public endpoints (Legacy - Migrated to tRPC)

- `GET /segments` — **Migrated to `trpc.segment.getAll`**
- `GET /weeks` — **Migrated to `trpc.week.getAll`**
- `GET /weeks/:id` — **Migrated to `trpc.week.getById`**
- `GET /weeks/:id/leaderboard` — **Migrated to `trpc.leaderboard.getWeekLeaderboard`**
- `GET /seasons/:id/leaderboard` — **Migrated to `trpc.leaderboard.getSeasonLeaderboard`**

### GET /weeks/:id/leaderboard (Legacy)

Response shape:
```
{
  "week": {
    "id": number,
    "week_name": string,
    "date": "YYYY-MM-DD",
    "strava_segment_id": string,
    "required_laps": number,
    "start_at": number,
    "end_at": number
  },
  "leaderboard": [
    {
      "participant_id": string,
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

### GET /seasons/:id/leaderboard

Response shape:
```
{
  "season": {
    "id": number,
    "name": string,
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "is_active": 0|1
  },
  "leaderboard": [
    {
      "participant_id": string,
      "name": string,
      "total_points": number,
      "weeks_completed": number,
      "rank": number
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

**Note:** All admin endpoints require the user to be authenticated AND have their Strava athlete ID listed in the `ADMIN_ATHLETE_IDS` environment variable.

### Season management

- POST /admin/seasons — create a new season
- PUT /admin/seasons/:id — update season details
- DELETE /admin/seasons/:id — delete a season (cascades to weeks and results)

### Week management

- POST /admin/weeks — create a week (season_id, week_name, date, strava_segment_id, required_laps, start_time, end_time)
- PUT /admin/weeks/:id — update week details
- DELETE /admin/weeks/:id — delete a week (cascades to activities, efforts, and results)
- POST /admin/weeks/:id/fetch-results — **CRITICAL WORKFLOW:** Fetch all participant activities for the week, find best qualifying activity per participant, store activities and segment efforts, recalculate leaderboard

#### POST /admin/weeks/:id/fetch-results

This is the main workflow endpoint for collecting weekly competition results. Admin triggers this at the end of the event day to fetch all connected participants' activities and automatically populate the leaderboard.

**What it does:**
1. Fetches all activities from connected participants during the week's time window
2. Filters activities to those containing the required segment
3. For each participant, finds the **best qualifying activity** (fastest time with required repetitions)
4. Stores activities and segment efforts in the database
5. Recalculates rankings and points (scores computed on-read)

**Request:**
```
POST /admin/weeks/{id}/fetch-results
```

**Response:**
```json
{
  "message": "Results fetched successfully",
  "week_id": 1,
  "participants_processed": 12,
  "results_found": 10,
  "summary": [
    {
      "participant_id": "12345",
      "participant_name": "Alice",
      "activity_found": true,
      "activity_id": "987654321",
      "total_time": 1420,
      "segment_efforts": 2
    },
    {
      "participant_id": "23456",
      "participant_name": "Bob",
      "activity_found": false,
      "reason": "No qualifying activities on event day"
    }
  ]
}
```

**Activity Matching Rules:**
- Activities must be within the week's `start_time` to `end_time` window (both UTC timestamps)
- Activity must contain efforts for the week's segment
- Must have at least `required_laps` segment efforts
- If multiple qualifying activities, the fastest (lowest total time) is selected
- Safe to call multiple times: re-running updates to the current best activity

**Errors:**
- 404 Week not found
- 403 Not authenticated or not admin
- 500 Failed to fetch or process activities

### Segment management

- GET /admin/segments — list all known segments with cached metadata
- POST /admin/segments — create or update a segment (persists metadata from Strava: distance, average_grade, city, state, country)
- GET /admin/segments/:id/validate — validate a segment exists on Strava (requires at least one connected participant)

#### GET /admin/segments/:id/validate

Validate that a segment exists on Strava and fetch its metadata. Requires at least one connected participant (to use their OAuth token for API access).

**Request:**
```
GET /admin/segments/{strava_segment_id}/validate
```

**Response:**
```json
{
  "id": "12345678",
  "name": "Lookout Mountain",
  "distance": 2.5,
  "average_grade": 6.5,
  "city": "Denver",
  "state": "CO",
  "country": "USA"
}
```

**Errors:**
- 404 Segment not found on Strava
- 400 No connected participants (can't access Strava API)
- 403 Not authenticated or not admin
- 500 Failed to validate

### Participant management

- GET /admin/participants — list all participants with connection status and token expiration

## Webhook Admin (tRPC)

The `webhookAdminRouter` provides procedures for monitoring and managing Strava webhooks. These are only available to admins.

- `trpc.webhookAdmin.getStatus` — Returns current webhook subscription status and statistics.
- `trpc.webhookAdmin.getEvents` — Returns a paginated list of recently logged webhook events.
- `trpc.webhookAdmin.getEnrichedEventDetails` — Returns detailed metadata for a specific activity mentioned in a webhook event (uses `ActivityService` for summary and classification).

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
Admin endpoints require `ADMIN_ATHLETE_IDS` environment variable configuration.

## Rate limiting

No internal rate limit yet; rely on Strava's API limits for validation calls. Segment metadata cached to reduce calls.

## Related docs

- See `SCORING.md` for points calculation
- See `DATABASE_DESIGN.md` for table relationships
- See `ADMIN_GUIDE.md` for admin operations
