# Database Design

## Overview
This document describes the SQLite database schema for tracking weekly cycling competition results based on Strava activities.

**Scale:** Designed for <100 participants. SQLite is perfect for this - simple, fast, no separate database server needed.

## Schema Version 2.0 (Updated for Activity Tracking)

### Tables

#### `participants`
Stores information about competition participants.
```sql
CREATE TABLE participants (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  strava_athlete_id INTEGER UNIQUE,  -- NEW: Link to Strava athlete
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `segments`
Stores Strava segments used in weekly competitions + cached metadata.
```sql
CREATE TABLE segments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  strava_segment_id INTEGER NOT NULL UNIQUE,
  distance INTEGER,            -- meters (nullable until first refresh)
  average_grade REAL,          -- percentage (nullable)
  city TEXT,
  state TEXT,
  country TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### `weeks`
Defines each weekly competition objective with configurable time windows.
```sql
CREATE TABLE weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_name TEXT NOT NULL,
  date TEXT NOT NULL,  -- The Tuesday date (ISO 8601: YYYY-MM-DD)
  segment_id INTEGER NOT NULL,
  required_laps INTEGER NOT NULL DEFAULT 1,  -- How many times segment must be completed
  start_time TEXT NOT NULL,  -- ISO 8601 timestamp: when valid submissions start
  end_time TEXT NOT NULL,  -- ISO 8601 timestamp: when valid submissions end
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(segment_id) REFERENCES segments(id)
);
```
**Time Window Configuration:**
- Default: midnight (00:00:00) to 10pm (22:00:00) on event day
- Customizable per week for special events
- Enforced during activity submission validation

#### `activities` (NEW)
Stores Strava activities for each participant per week. When admin triggers batch fetch, this table is populated with the best qualifying activity for each participant.

```sql
CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  strava_activity_id INTEGER NOT NULL,  -- Strava's activity ID
  activity_url TEXT NOT NULL,  -- Full Strava URL
  activity_date TEXT NOT NULL,  -- ISO 8601 date from Strava
  validation_status TEXT DEFAULT 'pending',  -- pending, valid, invalid
  validation_message TEXT,  -- Error/success message
  validated_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(week_id) REFERENCES weeks(id),
  FOREIGN KEY(participant_id) REFERENCES participants(id),
  UNIQUE(week_id, participant_id)  -- One activity per participant per week (best activity)
);
```

**Admin Fetch Behavior:**
- When admin triggers `POST /admin/weeks/:id/fetch-results`, the system finds the **best qualifying activity** for each participant on the event day
- If an activity already exists for a participant in this week, it is replaced with the current best activity (via REPLACE INTO or DELETE + INSERT)
- This allows safe re-fetching if participants complete additional attempts after initial fetch
- Only the best activity (fastest total time with required reps) is stored per participant per week

#### `segment_efforts` (NEW)
Stores individual segment efforts extracted from activities.
```sql
CREATE TABLE segment_efforts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL,
  segment_id INTEGER NOT NULL,
  effort_index INTEGER NOT NULL,  -- 1st lap, 2nd lap, etc.
  elapsed_seconds INTEGER NOT NULL,
  start_time TEXT,  -- ISO 8601 timestamp
  pr_achieved BOOLEAN DEFAULT 0,  -- 1 if this effort was a PR, 0 otherwise
  FOREIGN KEY(activity_id) REFERENCES activities(id),
  FOREIGN KEY(segment_id) REFERENCES segments(id)
);
```
**PR Detection:** The `pr_achieved` flag is set from Strava API's segment effort response (checks if `pr_rank` is present).

#### `results` (UPDATED)
Stores calculated competition results for each participant per week.
```sql
CREATE TABLE results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  activity_id INTEGER,  -- Link to validated activity
  total_time_seconds INTEGER NOT NULL,  -- Sum of all required segment efforts
  rank INTEGER,  -- Calculated ranking (1 = fastest)
  points INTEGER,  -- Total points = base points + PR bonus
  pr_bonus_points INTEGER DEFAULT 0,  -- 1 if participant achieved PR, 0 otherwise
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(week_id) REFERENCES weeks(id),
  FOREIGN KEY(participant_id) REFERENCES participants(id),
  FOREIGN KEY(activity_id) REFERENCES activities(id),
  UNIQUE(week_id, participant_id)
);
```
**Points Calculation:**
- `base_points = (total_participants - rank) + 1`
  - This awards 1 point for each participant you beat, PLUS 1 point for competing
  - Example with 4 participants:
    - 1st place: (4 - 1) + 1 = 4 points (beat 3 people + competed)
    - 2nd place: (4 - 2) + 1 = 3 points (beat 2 people + competed)
    - 3rd place: (4 - 3) + 1 = 2 points (beat 1 person + competed)
    - 4th place: (4 - 4) + 1 = 1 point (beat 0 people + competed)
  - Someone who doesn't compete gets 0 points
- `pr_bonus_points = 1 if any segment effort has pr_achieved = 1, else 0`
- `points = base_points + pr_bonus_points`

## Data Flow

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
  participant_id,
  name,
  SUM(points) as total_points,
  COUNT(*) as weeks_completed
FROM results
JOIN participants ON results.participant_id = participants.id
GROUP BY participant_id
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
CREATE INDEX idx_activities_week_participant ON activities(week_id, participant_id);
CREATE INDEX idx_activities_status ON activities(validation_status);
CREATE INDEX idx_segment_efforts_activity ON segment_efforts(activity_id);
CREATE INDEX idx_results_week ON results(week_id);
CREATE INDEX idx_results_participant ON results(participant_id);
```

## Example Queries

### Get Week Leaderboard with Activity Links
```sql
SELECT 
  r.rank,
  p.name,
  r.total_time_seconds,
  r.points,
  a.activity_url,
  a.activity_date
FROM results r
JOIN participants p ON r.participant_id = p.id
LEFT JOIN activities a ON r.activity_id = a.id
WHERE r.week_id = ?
ORDER BY r.rank ASC;
```

### Get Participant's Segment Efforts for a Week
```sql
SELECT 
  se.effort_index,
  se.elapsed_seconds,
  se.start_time
FROM segment_efforts se
JOIN activities a ON se.activity_id = a.id
WHERE a.week_id = ? AND a.participant_id = ?
ORDER BY se.effort_index ASC;
```
