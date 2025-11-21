/**
 * Database Schema Definition
 *
 * This is the single source of truth for the database schema.
 * Both production (index.js) and tests import this to ensure consistency.
 */

const SCHEMA: string = `
CREATE TABLE IF NOT EXISTS participant (
  strava_athlete_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS segment (
  strava_segment_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  distance REAL,
  average_grade REAL,
  city TEXT,
  state TEXT,
  country TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS season (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS week (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  week_name TEXT NOT NULL,
  strava_segment_id INTEGER NOT NULL,
  required_laps INTEGER NOT NULL DEFAULT 1,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(season_id) REFERENCES season(id),
  FOREIGN KEY(strava_segment_id) REFERENCES segment(strava_segment_id)
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL,
  strava_athlete_id INTEGER NOT NULL,
  strava_activity_id INTEGER NOT NULL,
  start_at INTEGER NOT NULL,
  device_name TEXT,
  validation_status TEXT DEFAULT 'valid',
  validation_message TEXT,
  validated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(week_id) REFERENCES week(id),
  FOREIGN KEY(strava_athlete_id) REFERENCES participant(strava_athlete_id),
  UNIQUE(week_id, strava_athlete_id)
);

CREATE TABLE IF NOT EXISTS segment_effort (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL,
  strava_segment_id INTEGER NOT NULL,
  strava_effort_id TEXT,
  effort_index INTEGER NOT NULL,
  elapsed_seconds INTEGER NOT NULL,
  start_at INTEGER NOT NULL,
  pr_achieved BOOLEAN DEFAULT 0,
  FOREIGN KEY(activity_id) REFERENCES activity(id),
  FOREIGN KEY(strava_segment_id) REFERENCES segment(strava_segment_id)
);

CREATE TABLE IF NOT EXISTS result (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL,
  strava_athlete_id INTEGER NOT NULL,
  activity_id INTEGER,
  total_time_seconds INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(week_id) REFERENCES week(id),
  FOREIGN KEY(strava_athlete_id) REFERENCES participant(strava_athlete_id),
  FOREIGN KEY(activity_id) REFERENCES activity(id),
  UNIQUE(week_id, strava_athlete_id)
);

CREATE TABLE IF NOT EXISTS participant_token (
  strava_athlete_id INTEGER PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  scope TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(strava_athlete_id) REFERENCES participant(strava_athlete_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deletion_request (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strava_athlete_id INTEGER NOT NULL,
  requested_at TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_week_participant ON activity(week_id, strava_athlete_id);
CREATE INDEX IF NOT EXISTS idx_activity_status ON activity(validation_status);
CREATE INDEX IF NOT EXISTS idx_segment_effort_activity ON segment_effort(activity_id);
CREATE INDEX IF NOT EXISTS idx_result_week ON result(week_id);
CREATE INDEX IF NOT EXISTS idx_result_participant ON result(strava_athlete_id);
CREATE INDEX IF NOT EXISTS idx_participant_token_participant ON participant_token(strava_athlete_id);
CREATE INDEX IF NOT EXISTS idx_week_season ON week(season_id);
`;

export { SCHEMA };
