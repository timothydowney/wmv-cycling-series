import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import {
  createActivity,
  createParticipant,
  createResult,
  createSeason,
  createSegment,
  createWeek,
  setupTestDb,
  teardownTestDb,
} from './testDataHelpers';

const LEGACY_BROKEN_TIMESTAMP_LITERAL = 'sql`(CURRENT_TIMESTAMP)`';

function replaceCoreTablesWithLegacyTimestampDefaults(db: Database) {
  db.exec(`
    DROP TABLE IF EXISTS explorer_destination_pin;
    DROP TABLE IF EXISTS participant_token;
    DROP TABLE IF EXISTS result;
    DROP TABLE IF EXISTS activity;
    DROP TABLE IF EXISTS week;
    DROP TABLE IF EXISTS season;
    DROP TABLE IF EXISTS segment;
    DROP TABLE IF EXISTS participant;
    DROP TABLE IF EXISTS schema_migrations;
    DROP TABLE IF EXISTS webhook_event;

    CREATE TABLE participant (
      strava_athlete_id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      created_at text DEFAULT 'sql\`(CURRENT_TIMESTAMP)\`',
      active integer DEFAULT true NOT NULL,
      is_admin integer DEFAULT 0 NOT NULL,
      weight real,
      weight_updated_at text
    );

    CREATE TABLE season (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      name text NOT NULL,
      start_at integer NOT NULL,
      end_at integer NOT NULL,
      created_at text DEFAULT 'sql\`(CURRENT_TIMESTAMP)\`'
    );

    CREATE TABLE segment (
      strava_segment_id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      distance real,
      average_grade real,
      start_latitude real,
      start_longitude real,
      end_latitude real,
      end_longitude real,
      city text,
      state text,
      country text,
      created_at text DEFAULT 'sql\`(CURRENT_TIMESTAMP)\`',
      metadata_updated_at text,
      total_elevation_gain real,
      climb_category integer
    );

    CREATE TABLE week (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      season_id integer NOT NULL,
      week_name text NOT NULL,
      strava_segment_id text NOT NULL,
      required_laps integer DEFAULT 1 NOT NULL,
      start_at integer NOT NULL,
      end_at integer NOT NULL,
      multiplier integer DEFAULT 1 NOT NULL,
      created_at text DEFAULT 'sql\`(CURRENT_TIMESTAMP)\`',
      notes text DEFAULT '',
      FOREIGN KEY (season_id) REFERENCES season(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (strava_segment_id) REFERENCES segment(strava_segment_id) ON UPDATE no action ON DELETE no action
    );
    CREATE INDEX idx_week_season ON week(season_id);

    CREATE TABLE activity (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      week_id integer NOT NULL,
      strava_athlete_id text NOT NULL,
      strava_activity_id text NOT NULL,
      start_at integer NOT NULL,
      device_name text,
      validation_status text DEFAULT 'valid',
      validation_message text,
      validated_at text DEFAULT 'sql\`(CURRENT_TIMESTAMP)\`',
      created_at text DEFAULT 'sql\`(CURRENT_TIMESTAMP)\`',
      athlete_weight real,
      FOREIGN KEY (week_id) REFERENCES week(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (strava_athlete_id) REFERENCES participant(strava_athlete_id) ON UPDATE no action ON DELETE no action
    );
    CREATE INDEX idx_activity_status ON activity(validation_status);
    CREATE INDEX idx_activity_week_participant ON activity(week_id, strava_athlete_id);

    CREATE TABLE result (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      week_id integer NOT NULL,
      strava_athlete_id text NOT NULL,
      activity_id integer,
      total_time_seconds integer NOT NULL,
      created_at text DEFAULT 'sql\`(CURRENT_TIMESTAMP)\`',
      updated_at text DEFAULT 'sql\`(CURRENT_TIMESTAMP)\`',
      FOREIGN KEY (week_id) REFERENCES week(id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (strava_athlete_id) REFERENCES participant(strava_athlete_id) ON UPDATE no action ON DELETE no action,
      FOREIGN KEY (activity_id) REFERENCES activity(id) ON UPDATE no action ON DELETE no action
    );
    CREATE INDEX idx_result_participant ON result(strava_athlete_id);
    CREATE INDEX idx_result_week ON result(week_id);
    CREATE INDEX idx_result_week_athlete ON result(week_id, strava_athlete_id);

    CREATE TABLE participant_token (
      strava_athlete_id text PRIMARY KEY NOT NULL,
      access_token text NOT NULL,
      refresh_token text NOT NULL,
      expires_at integer NOT NULL,
      scope text,
      created_at text DEFAULT 'sql\`(CURRENT_TIMESTAMP)\`',
      updated_at text DEFAULT 'sql\`(CURRENT_TIMESTAMP)\`',
      FOREIGN KEY (strava_athlete_id) REFERENCES participant(strava_athlete_id) ON UPDATE no action ON DELETE cascade
    );
    CREATE INDEX idx_participant_token_participant ON participant_token(strava_athlete_id);

    CREATE TABLE schema_migrations (
      version text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      executed_at text DEFAULT 'sql\`(CURRENT_TIMESTAMP)\`'
    );

    CREATE TABLE webhook_event (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      payload text NOT NULL,
      processed integer,
      error_message text,
      created_at text DEFAULT 'sql\`(CURRENT_TIMESTAMP)\`'
    );
    CREATE INDEX idx_webhook_event_created ON webhook_event(created_at);
  `);
}

function getTablesWithBrokenTimestampDefaults(db: Database): string[] {
  const rows = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name IN (
        'participant',
        'season',
        'week',
        'activity',
        'result',
        'participant_token',
        'schema_migrations',
        'segment',
        'webhook_event'
      )
      AND sql LIKE '%sql\`(CURRENT_TIMESTAMP)\`%'
    ORDER BY name
  `).all() as Array<{ name: string }>;

  return rows.map((row) => row.name);
}

function runMigrationsWithForeignKeysDisabled(db: Database, drizzleDb: BetterSQLite3Database, migrationsFolder: string) {
  db.pragma('foreign_keys = OFF');
  try {
    migrate(drizzleDb, { migrationsFolder });
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

describe('repairCoreTimestampDefaults', () => {
  let db: Database;
  let drizzleDb: BetterSQLite3Database;
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');

  beforeAll(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    drizzleDb = testDb.drizzleDb;
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  it('audits and repairs broken non-Explorer timestamp defaults', () => {
    replaceCoreTablesWithLegacyTimestampDefaults(db);
    // Remove migration 0014 from the applied journal so this test can replay the legacy
    // pre-repair schema state and prove the new migration fixes it.
    db.exec('DELETE FROM __drizzle_migrations WHERE rowid >= 15;');

    db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run('legacy-rider', 'Legacy Rider');

    expect(getTablesWithBrokenTimestampDefaults(db)).toEqual([
      'activity',
      'participant',
      'participant_token',
      'result',
      'schema_migrations',
      'season',
      'segment',
      'webhook_event',
      'week',
    ]);

    runMigrationsWithForeignKeysDisabled(db, drizzleDb, migrationsFolder);

    expect(getTablesWithBrokenTimestampDefaults(db)).toEqual([]);

    const repairedLegacyParticipant = db.prepare(
      'SELECT created_at FROM participant WHERE strava_athlete_id = ?'
    ).get('legacy-rider') as { created_at: string };
    expect(repairedLegacyParticipant.created_at).not.toBe(LEGACY_BROKEN_TIMESTAMP_LITERAL);

    const newParticipant = createParticipant(drizzleDb, 'fresh-rider', 'Fresh Rider');
    expect(newParticipant.created_at).not.toBe(LEGACY_BROKEN_TIMESTAMP_LITERAL);

    const season = createSeason(drizzleDb, 'Timestamp Repair Season');
    const segment = createSegment(drizzleDb, 'timestamp-segment', 'Timestamp Segment');
    const week = createWeek(drizzleDb, {
      seasonId: season.id,
      stravaSegmentId: segment.strava_segment_id,
      weekName: 'Timestamp Repair Week',
    });
    const activity = createActivity(drizzleDb, {
      weekId: week.id,
      stravaAthleteId: newParticipant.strava_athlete_id,
    });
    const result = createResult(drizzleDb, {
      weekId: week.id,
      stravaAthleteId: newParticipant.strava_athlete_id,
      activityId: activity.id,
      totalTimeSeconds: 321,
    });

    expect(result.created_at).not.toBe(LEGACY_BROKEN_TIMESTAMP_LITERAL);
    expect(result.updated_at).not.toBe(LEGACY_BROKEN_TIMESTAMP_LITERAL);

    const participantSql = db.prepare(
      'SELECT sql FROM sqlite_master WHERE type = \'table\' AND name = \'participant\''
    ).get() as { sql: string };
    expect(participantSql.sql).toContain('DEFAULT (CURRENT_TIMESTAMP)');
  });
});
