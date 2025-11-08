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
Stores Strava segments used in weekly competitions.
```sql
CREATE TABLE segments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  strava_segment_id INTEGER NOT NULL UNIQUE,
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
Stores submitted Strava activities for validation and tracking.
```sql
CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  strava_activity_id INTEGER NOT NULL,  -- Strava's activity ID
  activity_url TEXT NOT NULL,  -- Full Strava URL submitted by participant
  activity_date TEXT NOT NULL,  -- ISO 8601 date from Strava
  validation_status TEXT DEFAULT 'pending',  -- pending, valid, invalid
  validation_message TEXT,  -- Error/success message
  validated_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(week_id) REFERENCES weeks(id),
  FOREIGN KEY(participant_id) REFERENCES participants(id),
  UNIQUE(week_id, participant_id)  -- One submission per participant per week
);
```

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
- `base_points = total_participants - rank`
- `pr_bonus_points = 1 if any segment effort has pr_achieved = 1, else 0`
- `points = base_points + pr_bonus_points`

## Data Flow

### Activity Submission & Validation
1. Participant submits Strava activity URL for a specific week
2. Backend extracts activity ID from URL
3. Backend fetches activity details via Strava API
4. Validation checks:
   - Activity date matches week's designated Tuesday
   - Activity contains segment efforts for the week's segment
   - Number of segment efforts >= required laps
5. Store activity record with validation status
6. If valid, extract segment efforts and store each lap
7. Calculate total time (sum of required laps)
8. Store result for leaderboard

### Scoring Calculation
1. Query all valid results for a week
2. Sort by `total_time_seconds` ASC
3. Assign rank (1 = fastest)
4. Calculate base points: `base_points = (total_participants - rank)`
   - 1st place: total - 1 = beats everyone
   - Last place: total - total = 0 = beats no one
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

### Migration Steps (v1.0 → v2.1)
1. Add new tables: `activities`, `segment_efforts`
2. Alter `participants` to add `strava_athlete_id`
3. Alter `weeks` to:
   - Rename `laps` → `required_laps`
   - Add `start_time` (NOT NULL, default: `{date}T00:00:00Z`)
   - Add `end_time` (NOT NULL, default: `{date}T22:00:00Z`)
4. Alter `results` to add: `activity_id`, `total_time_seconds`, `rank`, `points`, `updated_at`
5. Backfill: Convert existing `elapsed_seconds` to `total_time_seconds`
6. Recalculate all ranks and points with corrected formula

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
