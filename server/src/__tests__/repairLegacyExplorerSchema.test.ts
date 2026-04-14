import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { explorerCampaign, explorerDestination, explorerDestinationMatch } from '../db/schema';
import { repairLegacyExplorerSchema } from '../db/repairLegacyExplorerSchema';
import { clearAllData, createParticipant, createSeason, setupTestDb, teardownTestDb } from './testDataHelpers';

function replaceExplorerTablesWithLegacySchema(db: Database) {
  db.exec(`
    DROP TABLE IF EXISTS explorer_destination_match;
    DROP TABLE IF EXISTS explorer_destination;
    DROP TABLE IF EXISTS explorer_campaign;

    CREATE TABLE explorer_week (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      name text NOT NULL,
      start_at integer NOT NULL,
      end_at integer NOT NULL,
      status text DEFAULT 'draft' NOT NULL,
      created_at text DEFAULT (CURRENT_TIMESTAMP),
      updated_at text DEFAULT (CURRENT_TIMESTAMP)
    );
    CREATE INDEX idx_explorer_week_status ON explorer_week(status);
    CREATE INDEX idx_explorer_week_window ON explorer_week(start_at, end_at);

    CREATE TABLE explorer_destination (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      explorer_week_id integer NOT NULL,
      strava_segment_id text NOT NULL,
      source_url text,
      cached_segment_name text,
      display_label text,
      display_order integer DEFAULT 0 NOT NULL,
      surface_type text,
      category text,
      created_at text DEFAULT (CURRENT_TIMESTAMP),
      updated_at text DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY (explorer_week_id) REFERENCES explorer_week(id) ON UPDATE no action ON DELETE cascade
    );
    CREATE INDEX idx_explorer_destination_week ON explorer_destination(explorer_week_id);
    CREATE INDEX idx_explorer_destination_segment ON explorer_destination(strava_segment_id);

    CREATE TABLE explorer_destination_match (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      explorer_week_id integer NOT NULL,
      explorer_destination_id integer NOT NULL,
      strava_athlete_id text NOT NULL,
      strava_activity_id text NOT NULL,
      matched_at integer NOT NULL,
      created_at text DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY (explorer_week_id) REFERENCES explorer_week(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (explorer_destination_id) REFERENCES explorer_destination(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (strava_athlete_id) REFERENCES participant(strava_athlete_id) ON UPDATE no action ON DELETE cascade
    );
    CREATE INDEX idx_explorer_match_week_athlete ON explorer_destination_match(explorer_week_id, strava_athlete_id);
    CREATE INDEX idx_explorer_match_activity ON explorer_destination_match(strava_activity_id);
    CREATE UNIQUE INDEX idx_explorer_match_unique ON explorer_destination_match(explorer_week_id, explorer_destination_id, strava_athlete_id);
  `);
}

describe('repairLegacyExplorerSchema', () => {
  let db: Database;
  let drizzleDb: BetterSQLite3Database;

  beforeAll(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    drizzleDb = testDb.drizzleDb;
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  beforeEach(() => {
    clearAllData(drizzleDb);
  });

  it('returns false when the current campaign schema is already present', () => {
    expect(repairLegacyExplorerSchema(db)).toBe(false);
  });

  it('repairs an empty legacy Explorer schema', () => {
    replaceExplorerTablesWithLegacySchema(db);

    const repaired = repairLegacyExplorerSchema(db);

    expect(repaired).toBe(true);
    const explorerCampaignTable = db.prepare(
      'SELECT name FROM sqlite_master WHERE type = \'table\' AND name = \'explorer_campaign\''
    ).get();
    const legacyExplorerWeekTable = db.prepare(
      'SELECT name FROM sqlite_master WHERE type = \'table\' AND name = \'explorer_week\''
    ).get();

    expect(explorerCampaignTable).toBeTruthy();
    expect(legacyExplorerWeekTable).toBeUndefined();
  });

  it('migrates weekly Explorer data into the campaign model', () => {
    replaceExplorerTablesWithLegacySchema(db);

    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    createParticipant(drizzleDb, '999001', 'Legacy Rider');

    const weekInsert = db.prepare(
      'INSERT INTO explorer_week (name, start_at, end_at, status) VALUES (?, ?, ?, ?)'
    ).run('Legacy Explorer Week', seasonRecord.start_at, seasonRecord.end_at, 'active');
    const legacyWeekId = Number(weekInsert.lastInsertRowid);

    const destinationInsert = db.prepare(
      `INSERT INTO explorer_destination (
        explorer_week_id,
        strava_segment_id,
        source_url,
        cached_segment_name,
        display_label,
        display_order
      ) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      legacyWeekId,
      '12744502',
      'https://www.strava.com/segments/12744502',
      'Legacy Segment',
      'Climb One',
      0
    );
    const legacyDestinationId = Number(destinationInsert.lastInsertRowid);

    db.prepare(
      `INSERT INTO explorer_destination_match (
        explorer_week_id,
        explorer_destination_id,
        strava_athlete_id,
        strava_activity_id,
        matched_at
      ) VALUES (?, ?, ?, ?, ?)`
    ).run(legacyWeekId, legacyDestinationId, '999001', 'activity-1', seasonRecord.start_at + 3600);

    const repaired = repairLegacyExplorerSchema(db);

    expect(repaired).toBe(true);

    const campaign = drizzleDb.select().from(explorerCampaign).get();
    expect(campaign?.season_id).toBe(seasonRecord.id);
    expect(campaign?.display_name).toBe('Legacy Explorer Week');

    const destination = drizzleDb.select().from(explorerDestination).get();
    expect(destination?.explorer_campaign_id).toBe(campaign?.id);
    expect(destination?.cached_name).toBe('Legacy Segment');
    expect(destination?.display_label).toBe('Climb One');

    const match = drizzleDb
      .select()
      .from(explorerDestinationMatch)
      .where(eq(explorerDestinationMatch.explorer_destination_id, destination!.id))
      .get();
    expect(match?.explorer_campaign_id).toBe(campaign?.id);
    expect(match?.strava_athlete_id).toBe('999001');
  });
});