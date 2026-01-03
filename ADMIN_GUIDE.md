# Admin Guide

## Purpose

How to configure weeks, manage segments, and collect results.

## Admin Access Control

**Only users designated as admins can access admin features.** Regular users see only:
- Leaderboard view
- Disconnect from Strava button

Admins see the full navigation menu with:
- Manage Competition (create/edit weeks)
- Manage Segments (add/update segment metadata)
- Participant Status (view connected participants)

### Who is an Admin?

Admins are identified by their **Strava athlete ID**. The app reads a list of admin athlete IDs from the `ADMIN_ATHLETE_IDS` environment variable.

**Finding your Strava athlete ID:**
1. Log in to [Strava.com](https://strava.com)
2. Go to [Settings → Profile](https://www.strava.com/settings/profile)
3. Look at the URL bar: `https://www.strava.com/athletes/YOUR_ID_HERE`
4. Your athlete ID is the number at the end

**Example:** If your profile URL is `https://www.strava.com/athletes/12345678`, your athlete ID is `12345678`.

### How to Add/Remove Admins

Admins are configured via the `ADMIN_ATHLETE_IDS` environment variable (comma-separated list of athlete IDs).

**Development (local):**
1. Edit `.env`:
   ```
   ADMIN_ATHLETE_IDS=12345678,87654321
   ```
2. Restart servers: `npm run dev:all`

**Production (Railway):**
1. Go to Railway dashboard → Project → Settings → Secrets
2. Set `ADMIN_ATHLETE_IDS=12345678,87654321` (comma-separated, no spaces)
3. Railway auto-redeploys with new value
4. Changes take effect immediately for new logins

**Safe default:** If `ADMIN_ATHLETE_IDS` is empty or not set, no one has admin access. This is the default for security.

### Security Notes

- Admin access is based on immutable Strava athlete IDs (cannot be faked)
- All admin endpoints require authentication and admin status
- Non-admin attempts to access admin features are logged
- Admins must be connected to Strava (OAuth) to have access
- Disconnecting from Strava immediately revokes admin access

## Workflow Overview

1. **Setup Phase:**
   - Create week with segment ID, date, time window, required repetitions
   - Participants connect their Strava accounts (one-time OAuth)
   
2. **Event Day:**
   - Participants complete their rides (no manual submission needed)
   
3. **Results Collection:**
   - **Admin clicks "Fetch Results"** to collect all activities from event day
   - System finds best qualifying activity per participant
   - Leaderboard automatically updates

4. **Future:** Event-based webhooks will eliminate manual fetch step

## Segment Management

Use the "Manage Segments" admin page to:

1. Paste a Strava segment URL (or ID)
2. Automatic validation calls the backend which fetches from Strava (requires at least one connected participant token)
3. If valid and not already stored, the "Add to Database" button enables
4. Segment metadata cached: name, distance (m), average grade (%), location (city/state/country)
5. The segment list shows all stored segments as cards (click name to open Strava)
6. "Refresh Metadata" updates all stored segments (batch validates and upserts metadata)

Why cache? Reduces Strava API calls and speeds up week creation/autocomplete.

Edge cases handled:
- Invalid URL or ID → error message shown inline
- Segment already in DB → add button disabled with notice
- Average grade null from Strava → displayed as "—" (guarded in UI)

## Participant Management

### Viewing Connected Participants

```bash
curl http://localhost:3001/auth/participants
```

Shows all participants with OAuth connection status:
```json
[
  {
    "id": 1,
    "name": "Tim",
    "strava_athlete_id": "12345678",
    "connected": true,
    "connected_at": "2025-11-09T10:30:00Z"
  },
  {
    "id": 2,
    "name": "Chris",
    "strava_athlete_id": null,
    "connected": false,
    "connected_at": null
  }
]
```

**Key Points:**
- Participants connect **once** via OAuth
- No need to re-authenticate each week
- Connected participants are automatically included in all future events
- Future: Admin UI to remove/disable participants

## Competition Time Windows

Each weekly competition has a configurable time window during which activities must be completed. By default, this is:
- **Start:** Midnight (00:00:00 UTC) on the event date
- **End:** 10:00 PM (22:00:00 UTC) on the event date

This window can be customized per week to accommodate special events or different time zones.

## Creating a New Week

**Important:** Use actual Strava segment IDs. You can find these from Strava segment URLs:
- URL: `https://www.strava.com/segments/12345`
- Segment ID: `12345`

Future enhancement will add segment search/validation UI.

### Basic Example (Using Defaults)
Creates a week with midnight-to-10pm time window:

```bash
curl -X POST http://localhost:3001/admin/weeks \
  -H "Content-Type: application/json" \
  -d '{
    "week_name": "Week 3: Lookout Mountain Triple",
    "date": "2025-11-19",
    "segment_id": "23456789",
    "required_laps": 3
  }'
```

**Response:**
```json
{
  "id": 3,
  "week_name": "Week 3: Lookout Mountain Triple",
  "date": "2025-11-19",
  "segment_id": "23456789",
  "required_laps": 3,
  "start_time": "2025-11-19T00:00:00Z",
  "end_time": "2025-11-19T22:00:00Z"
}
```

### Segment ID Lookup

To find a segment ID on Strava:
1. Go to Strava.com
2. Search for the segment or view it on a recent activity
3. Copy the number from the URL: `www.strava.com/segments/[THIS_NUMBER]`
4. Use that number as `segment_id` in your week creation

**Future:** Admin UI will provide segment search and validation.

### Custom Time Window
For events with specific time requirements:

```bash
curl -X POST http://localhost:3001/admin/weeks \
  -H "Content-Type: application/json" \
  -d '{
    "week_name": "Week 4: Sunrise Challenge",
    "date": "2025-11-26",
    "segment_id": "2",
    "required_laps": 1,
    "start_time": "2025-11-26T06:00:00Z",
    "end_time": "2025-11-26T12:00:00Z"
  }'
```

## Updating a Week

You can update any aspect of a week, including the time window:

```bash
curl -X PUT http://localhost:3001/admin/weeks/3 \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "2025-11-19T07:00:00Z",
    "end_time": "2025-11-19T21:00:00Z",
    "required_laps": 5
  }'
```

Only the fields you provide will be updated. All fields are optional.

## Deleting a Week

**Warning:** This cascades and deletes all associated activities, segment efforts, and results.

```bash
curl -X DELETE http://localhost:3001/admin/weeks/3
```

**Response:**
```json
{
  "message": "Week deleted successfully",
  "weekId": 3
}
```

## Planning a Season Schedule

Since the competition doesn't run year-round, you can build out the entire schedule in advance:

### Example: Creating Multiple Weeks

```bash
# Week 1
curl -X POST http://localhost:3001/admin/weeks \
  -H "Content-Type: application/json" \
  -d '{
    "week_name": "Week 1: Season Opener - Lookout Mountain",
    "date": "2025-11-05",
    "segment_id": "1",
    "required_laps": 1
  }'

# Week 2
curl -X POST http://localhost:3001/admin/weeks \
  -H "Content-Type: application/json" \
  -d '{
    "week_name": "Week 2: Champs-Élysées Double",
    "date": "2025-11-12",
    "segment_id": "2",
    "required_laps": 2
  }'

# Week 3
curl -X POST http://localhost:3001/admin/weeks \
  -H "Content-Type: application/json" \
  -d '{
    "week_name": "Week 3: Turkey Day Hill Repeats",
    "date": "2025-11-26",
    "segment_id": "1",
    "required_laps": 5
  }'
```

## Collecting Results (Admin Fetch)

**This is the key workflow step!** After participants complete their rides, the admin triggers result collection.

### Fetch Results for a Week

```bash
curl -X POST http://localhost:3001/admin/weeks/3/fetch-results
```

**What happens:**
1. System fetches activities from event day for **all connected participants**
2. Filters activities to those containing the required segment
3. For each participant:
   - Finds all qualifying activities (activities with required number of segment repetitions)
   - Selects the **best qualifying activity** (fastest total time)
   - Stores activity and segment efforts in database
4. Recalculates leaderboard with new results
5. Returns summary of what was found

**Response:**
```json
{
  "message": "Results fetched successfully",
  "week_id": 3,
  "participants_processed": 12,
  "results_found": 10,
  "summary": [
    {
      "participant_id": "1",
      "participant_name": "Tim",
      "activity_found": true,
      "activity_id": "123456789",
      "total_time": 1420,
      "segment_efforts": 3
    },
    {
      "participant_id": "2",
      "participant_name": "Chris",
      "activity_found": false,
      "reason": "No qualifying activities on event day"
    }
  ]
}
```

### Activity Matching Rules

The system uses these rules to find the best activity:

1. **Date Filter:** Only activities on the event date within the time window
2. **Segment Filter:** Activity must contain the required segment
3. **Repetition Filter:** Activity must have the required number of segment efforts
   - If 2 laps required, need 2 segment efforts **in the same activity**
   - Activities with only 1 lap are ignored
   - Laps from different activities don't combine
4. **Best Selection:** If multiple qualifying activities, takes the one with fastest total time
5. **Re-fetch Handling:** If results already exist for a participant, re-fetching updates to the current best activity

### Example Scenarios

**Scenario 1: Participant with one qualifying activity**
- Event requires 2 laps of segment 12345
- Participant has one activity with 2 efforts on segment 12345
- Result: That activity is selected

**Scenario 2: Participant with multiple qualifying activities**
- Event requires 2 laps
- Participant Activity A: 2 efforts, total time 1500 seconds
- Participant Activity B: 2 efforts, total time 1420 seconds
- Result: Activity B is selected (faster)

**Scenario 3: Participant with non-qualifying activities**
- Event requires 2 laps
- Participant Activity A: 1 effort (not enough)
- Participant Activity B: 3 efforts (more than required - this counts!)
- Result: Activity B is selected

**Scenario 4: No qualifying activities**
- Event requires 2 laps
- Participant has activities but none with the segment, or only 1 lap
- Result: No result stored, participant doesn't appear on leaderboard

### When to Fetch Results

**Recommended timing:**
- **End of event day** (e.g., 10pm on Tuesday)
- Gives participants the full time window to complete rides
- Can re-fetch later if needed (e.g., if someone was late)

**Re-fetching:**
- Safe to fetch multiple times
- System updates to the current best activity
- Example: Fetch at 10pm, participant does another ride at 11pm, fetch again next morning

## Time Window Validation

When fetching results, activities must be within the configured time window (default midnight–22:00 UTC unless overridden). Activities outside window are ignored.

**Default window:** Midnight to 10pm on event day
- `start_time`: `2025-11-19T00:00:00Z`
- `end_time`: `2025-11-19T22:00:00Z`

**Custom windows:** Set when creating or updating the week

Activities outside the time window are ignored during result fetching.

## Deprecated: Manual Activity Submission

**Note:** The manual submission endpoint `POST /weeks/:id/submit-activity` is being phased out in favor of admin batch fetch. It may be removed in a future version.

The current workflow is:
- ❌ Participants manually submit activity URLs
- ✅ Admin fetches all results with one click

## Best Practices

1. **Create weeks in advance** - Set up the entire season schedule so participants can plan ahead
2. **Use Strava segment IDs** - Copy from segment URLs on Strava.com
3. **Verify participants are connected** - Check `/auth/participants` before the event
4. **Fetch results at end of day** - Give participants the full time window
5. **Re-fetch if needed** - Safe to fetch multiple times, updates to best activity
6. **Use consistent time windows** - Stick to midnight-10pm unless there's a specific reason to change
7. **Clear naming** - Include the segment name and lap requirement in the week name (e.g., "Week 3: Lookout Mountain - 2 Laps")
8. **Time zone awareness** - All times are in UTC; make sure participants know their local time conversion

## References

- **Scoring rules:** See `docs/SCORING.md`
- **Database design:** See `docs/DATABASE_DESIGN.md`
- **Strava OAuth:** See `docs/STRAVA_INTEGRATION.md`
- **API reference:** See `docs/API.md`
- **Architecture:** See `docs/ARCHITECTURE.md`

## Common Scenarios

### Fetching results after event day
```bash
curl -X POST http://localhost:3001/admin/weeks/1/fetch-results
```

### Re-fetching if a late participant completes the ride
```bash
# Safe to call multiple times - updates to current best activity
curl -X POST http://localhost:3001/admin/weeks/1/fetch-results
```

### Viewing the schedule
```bash
# List all weeks
curl http://localhost:3001/weeks

# Get specific week details
curl http://localhost:3001/weeks/1

# Get current leaderboard
curl http://localhost:3001/weeks/1/leaderboard
```

### Extending the deadline
If you need to give participants more time:
```bash
curl -X PUT http://localhost:3001/admin/weeks/1 \
  -H "Content-Type: application/json" \
  -d '{"end_time": "2025-11-06T02:00:00Z"}'
```

### Changing the segment mid-week
If weather or conditions require switching segments:
```bash
curl -X PUT http://localhost:3001/admin/weeks/1 \
  -H "Content-Type: application/json" \
  -d '{"segment_id": "98765432"}'
```

### Adding bonus laps
Make a week more challenging:
```bash
curl -X PUT http://localhost:3001/admin/weeks/1 \
  -H "Content-Type: application/json" \
  -d '{"required_laps": 3}'
```

## Season Data Backup & Migration

⚠️ **DEVELOPMENT MODE ONLY:** The export/import endpoints are only available in development (`NODE_ENV != production`). In production, they return `403 Forbidden` for security. This prevents accidental data exposure and ensures production schedules are managed through proper backup/restore procedures only.

## Future Enhancements

**Coming soon:**
- Admin UI for creating/editing weeks (no more curl commands!)
- Segment search and validation
- "Fetch Results" button in the UI
- Participant management dashboard
- Activity review/audit log

**Long-term:**
- Strava webhook integration for real-time results
- Automatic fetching on event day (no manual trigger needed)
- Email notifications to participants
- Season archival with historical leaderboards
