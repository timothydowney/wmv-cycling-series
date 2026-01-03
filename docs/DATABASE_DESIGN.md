# Database Design

## Overview
This document describes the SQLite database schema for tracking weekly cycling competition results based on Strava activities.

**Scale:** Designed for <100 participants. SQLite is perfect for this - simple, fast, no separate database server needed.

## Schema Overview

The database is managed using **Drizzle ORM**. The source of truth for the schema is [server/src/db/schema.ts](../server/src/db/schema.ts).

### Core Tables

- **`participant`**: Stores athlete information and connection status.
- **`segment`**: Cached Strava segment metadata (distance, grade, location).
- **`season`**: Defines competition periods (e.g., "2025 Season").
- **`week`**: Individual weekly events linked to a season and a segment.
- **`activity`**: The best qualifying Strava activity for a participant in a given week.
- **`segment_effort`**: Individual laps/efforts extracted from a qualifying activity.
- **`result`**: Calculated rankings and times (points are computed on-read).
- **`participant_token`**: Encrypted OAuth tokens for Strava API access.
- **`webhook_event`**: Log of received Strava webhook events for monitoring.

For the full SQL definitions and indexes, see the [Drizzle schema file](../server/src/db/schema.ts).

## Data Flow

### Timestamp Strategy (Critical for Consistency)

**Golden Rule:** ISO strings with Z suffix (from Strava) → Unix seconds internally → Browser timezone at display

1. **From Strava API (Input)**
   - Strava returns `start_date_local` as ISO 8601 UTC: `"2025-10-28T14:30:00Z"`
   - Always includes Z suffix (means UTC, not timezone-dependent parsing)
   - Pass directly to `isoToUnix()` for conversion to Unix seconds

2. **Internal Storage (Database & Code)**
   - Store all timestamps as **INTEGER Unix seconds** (UTC-based)
   - Example: `1730126400` (Oct 28, 2025 14:30:00 UTC)
   - All date/time fields: `start_at`, `end_at`, `start_at` (INTEGER type)
   - No timezone assumptions in database layer - timestamps are absolute points in time
   - Code logic: Compare timestamps as plain integers (no offset math, no DST handling)

3. **API Responses (Backend → Frontend)**
   - Return timestamps as **numbers** (Unix seconds)
   - Example: `{ "week": { "start_at": 1730126400, "end_at": 1730212800 } }`
   - Never return ISO strings from API - always raw Unix
   - Frontend consumes raw Unix and formats at display time

4. **Frontend Display (Edge)**
   - Convert Unix seconds to user's browser timezone using `Intl.DateTimeFormat()`
   - Use formatters from `src/utils/dateUtils.ts` for display
   - Each user automatically sees their local time without config needed

**Why This Approach:**
- ✅ Zero timezone math in code (no offset calculations, no DST)
- ✅ Portable everywhere (container runs UTC, deployment irrelevant)
- ✅ Matches Strava format (ISO+Z consistent with API source)
- ✅ Browser-aware (each user sees their local time)
- ✅ Testable (Unix timestamps deterministic, no timezone assumptions)

**Common Mistakes to Avoid:**
- ❌ Don't store ISO strings in database (breaks comparisons, timezone-dependent)
- ❌ Don't return ISO strings from API (forces frontend to re-parse)
- ❌ Don't use `new Date(isoString)` without Z suffix (timezone-dependent parsing)
- ✅ DO always use Z suffix on ISO strings (explicit UTC)
- ✅ DO convert to Unix immediately at input
- ✅ DO format only at display edge using `Intl` API

### Admin Batch Fetch Workflow (Primary)
1. Admin triggers `POST /admin/weeks/:id/fetch-results` at end of event day
2. System retrieves all connected participants (those with OAuth tokens)
3. For each participant:
   - Fetch activities from event day (using time window)
   - Filter to activities containing required segment
   - Identify activities with required number of segment repetitions
   - Select best qualifying activity (fastest total time)
   - Store activity record or replace existing one
   - Extract and store segment efforts
   - Calculate total time (sum of required laps)
4. Recalculate leaderboard rankings and points
5. Return summary of results found

**Re-fetch Handling:**
- Safe to fetch multiple times for same week
- System updates to current best activity if participant has completed additional attempts
- Previous activity is replaced (due to `UNIQUE(week_id, participant_id)` constraint)

### Activity Validation (Deprecated - Manual Submission)
Note: Manual submission via `POST /weeks/:id/submit-activity` is deprecated in favor of admin batch fetch.

1. ~~Participant submits Strava activity URL for a specific week~~
2. ~~Backend extracts activity ID from URL~~
3. ~~Backend fetches activity details via Strava API~~
4. Validation checks (same for both manual and batch fetch):
   - Activity date within time window (start_time to end_time)
   - Activity contains segment efforts for the week's segment
   - Number of segment efforts >= required laps
5. Store activity record with validation status
6. Extract segment efforts and store each lap
7. Calculate total time (sum of required laps)
8. Store result for leaderboard

### Scoring Calculation
1. Query all valid results for a week
2. Sort by `total_time_seconds` ASC
3. Assign rank (1 = fastest)
4. Calculate base points: `base_points = (total_participants - rank) + 1`
   - 1st place: (total - 1) + 1 = total points (beats everyone + competed)
   - Last place: (total - total) + 1 = 1 point (beats no one + competed)
   - Non-competitor: 0 points (didn't compete)
5. Check for PR bonus: if any segment effort has `pr_achieved = 1`, add 1 bonus point
6. Total points = base_points + pr_bonus_points
7. Update results table with rank, points, and pr_bonus_points

### Season Leaderboard
```sql
SELECT 
  strava_athlete_id,
  name,
  SUM(points) as total_points,
  COUNT(*) as weeks_completed
FROM results
JOIN participants ON results.strava_athlete_id = participants.strava_athlete_id
GROUP BY strava_athlete_id
ORDER BY total_points DESC;
```

## Migration from Current Schema

### Current (v1.0)
- `results` table stores only: `week_id`, `participant_id`, `elapsed_seconds`
- No activity tracking
- No validation history

### Migration Steps (v1.0 → v2.2)
1. Add new tables: `activities`, `segment_efforts`
2. Alter `participants` to add `strava_athlete_id`
3. Alter `weeks` to:
   - Rename `laps` → `required_laps`
   - Add `start_time` (NOT NULL, default: `{date}T00:00:00Z`)
   - Add `end_time` (NOT NULL, default: `{date}T22:00:00Z`)
4. Alter `results` to add: `activity_id`, `total_time_seconds`, `rank`, `points`, `updated_at`
5. Add segment metadata columns (distance, average_grade, city, state, country)
6. Backfill: Convert existing `elapsed_seconds` to `total_time_seconds`
7. Recalculate all ranks and points with corrected formula

## Indexes for Performance
```sql
CREATE INDEX idx_activity_status ON activities(validation_status);
CREATE INDEX idx_activity_week_participant ON activities(week_id, strava_athlete_id);
CREATE INDEX idx_segment_effort_activity ON segment_efforts(activity_id);
CREATE INDEX idx_result_week ON results(week_id);
CREATE INDEX idx_result_participant ON results(strava_athlete_id);
```

## Example Queries

### Get Week Leaderboard with Activity Links
```sql
SELECT 
  r.total_time_seconds,
  p.name,
  a.strava_activity_id,
  a.start_at
FROM results r
JOIN participants p ON r.strava_athlete_id = p.strava_athlete_id
LEFT JOIN activities a ON r.activity_id = a.id
WHERE r.week_id = ?
ORDER BY r.total_time_seconds ASC;
```

### Get Participant's Segment Efforts for a Week
```sql
SELECT 
  se.effort_index,
  se.elapsed_seconds,
  se.start_at
FROM segment_efforts se
JOIN activities a ON se.activity_id = a.id
WHERE a.week_id = ? AND a.strava_athlete_id = ?
ORDER BY se.effort_index ASC;
```