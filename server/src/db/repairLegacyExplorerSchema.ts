import BetterSqlite3 from 'better-sqlite3';

type SqliteDatabase = InstanceType<typeof BetterSqlite3>;

interface LegacyWeekRow {
  id: number;
  name: string;
  start_at: number;
  end_at: number;
}

interface LegacyDestinationRow {
  id: number;
  explorer_week_id: number;
  strava_segment_id: string;
  source_url: string | null;
  cached_segment_name: string | null;
  display_label: string | null;
  display_order: number;
  surface_type: string | null;
  category: string | null;
}

interface LegacyMatchRow {
  id: number;
  explorer_week_id: number;
  explorer_destination_id: number;
  strava_athlete_id: string;
  strava_activity_id: string;
  matched_at: number;
}

interface SeasonRow {
  id: number;
}

function tableExists(db: SqliteDatabase, tableName: string): boolean {
  const row = db.prepare(
    'SELECT name FROM sqlite_master WHERE type = \'table\' AND name = ?'
  ).get(tableName) as { name: string } | undefined;

  return Boolean(row);
}

function countRows(db: SqliteDatabase, tableName: string): number {
  if (!tableExists(db, tableName)) {
    return 0;
  }

  const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count: number };
  return row.count;
}

function createCampaignExplorerTables(db: SqliteDatabase) {
  db.exec(`
    CREATE TABLE explorer_campaign (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      season_id integer NOT NULL,
      display_name text,
      rules_blurb text,
      created_at text DEFAULT (CURRENT_TIMESTAMP),
      updated_at text DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY (season_id) REFERENCES season(id) ON UPDATE no action ON DELETE cascade
    );

    CREATE TABLE explorer_destination (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      explorer_campaign_id integer NOT NULL,
      strava_segment_id text NOT NULL,
      source_url text,
      cached_name text,
      display_label text,
      display_order integer DEFAULT 0 NOT NULL,
      surface_type text,
      category text,
      created_at text DEFAULT (CURRENT_TIMESTAMP),
      updated_at text DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY (explorer_campaign_id) REFERENCES explorer_campaign(id) ON UPDATE no action ON DELETE cascade
    );

    CREATE TABLE explorer_destination_match (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      explorer_campaign_id integer NOT NULL,
      explorer_destination_id integer NOT NULL,
      strava_athlete_id text NOT NULL,
      strava_activity_id text NOT NULL,
      matched_at integer NOT NULL,
      created_at text DEFAULT (CURRENT_TIMESTAMP),
      FOREIGN KEY (explorer_campaign_id) REFERENCES explorer_campaign(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (explorer_destination_id) REFERENCES explorer_destination(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (strava_athlete_id) REFERENCES participant(strava_athlete_id) ON UPDATE no action ON DELETE cascade
    );

    CREATE INDEX idx_explorer_destination_campaign ON explorer_destination(explorer_campaign_id);
    CREATE INDEX idx_explorer_destination_segment ON explorer_destination(strava_segment_id);
    CREATE INDEX idx_explorer_match_campaign_athlete ON explorer_destination_match(explorer_campaign_id, strava_athlete_id);
    CREATE INDEX idx_explorer_match_activity ON explorer_destination_match(strava_activity_id);
    CREATE UNIQUE INDEX idx_explorer_match_unique ON explorer_destination_match(explorer_campaign_id, explorer_destination_id, strava_athlete_id);
  `);
}

function migrateLegacyExplorerRows(db: SqliteDatabase) {
  const legacyWeeks = db.prepare(
    'SELECT id, name, start_at, end_at FROM explorer_week_legacy ORDER BY start_at ASC, id ASC'
  ).all() as LegacyWeekRow[];
  const legacyDestinations = db.prepare(
    `SELECT id, explorer_week_id, strava_segment_id, source_url, cached_segment_name, display_label, display_order, surface_type, category
     FROM explorer_destination_legacy
     ORDER BY explorer_week_id ASC, display_order ASC, id ASC`
  ).all() as LegacyDestinationRow[];
  const legacyMatches = db.prepare(
    `SELECT id, explorer_week_id, explorer_destination_id, strava_athlete_id, strava_activity_id, matched_at
     FROM explorer_destination_match_legacy
     ORDER BY id ASC`
  ).all() as LegacyMatchRow[];

  const findSeasonForWeek = db.prepare(
    `SELECT id
     FROM season
     WHERE start_at <= ? AND end_at >= ?
     ORDER BY start_at DESC, id DESC
     LIMIT 1`
  );
  const insertCampaign = db.prepare(
    'INSERT INTO explorer_campaign (season_id, display_name, rules_blurb) VALUES (?, ?, ?)'
  );
  const insertDestination = db.prepare(
    `INSERT INTO explorer_destination (
      explorer_campaign_id,
      strava_segment_id,
      source_url,
      cached_name,
      display_label,
      display_order,
      surface_type,
      category
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertMatch = db.prepare(
    `INSERT OR IGNORE INTO explorer_destination_match (
      explorer_campaign_id,
      explorer_destination_id,
      strava_athlete_id,
      strava_activity_id,
      matched_at
    ) VALUES (?, ?, ?, ?, ?)`
  );

  const campaignIdBySeasonId = new Map<number, number>();
  const campaignIdByLegacyWeekId = new Map<number, number>();
  const nextDisplayOrderByCampaignId = new Map<number, number>();
  const destinationIdByLegacyDestinationId = new Map<number, number>();
  const destinationIdByCampaignSegmentKey = new Map<string, number>();

  for (const legacyWeek of legacyWeeks) {
    const seasonRecord = findSeasonForWeek.get(legacyWeek.start_at, legacyWeek.end_at) as SeasonRow | undefined;
    if (!seasonRecord) {
      continue;
    }

    let campaignId = campaignIdBySeasonId.get(seasonRecord.id);
    if (!campaignId) {
      const inserted = insertCampaign.run(seasonRecord.id, legacyWeek.name, null);
      campaignId = Number(inserted.lastInsertRowid);
      campaignIdBySeasonId.set(seasonRecord.id, campaignId);
      nextDisplayOrderByCampaignId.set(campaignId, 0);
    }

    campaignIdByLegacyWeekId.set(legacyWeek.id, campaignId);
  }

  for (const legacyDestination of legacyDestinations) {
    const campaignId = campaignIdByLegacyWeekId.get(legacyDestination.explorer_week_id);
    if (!campaignId) {
      continue;
    }

    const destinationKey = `${campaignId}:${legacyDestination.strava_segment_id}`;
    const existingDestinationId = destinationIdByCampaignSegmentKey.get(destinationKey);
    if (existingDestinationId) {
      destinationIdByLegacyDestinationId.set(legacyDestination.id, existingDestinationId);
      continue;
    }

    const displayOrder = nextDisplayOrderByCampaignId.get(campaignId) ?? 0;
    const inserted = insertDestination.run(
      campaignId,
      legacyDestination.strava_segment_id,
      legacyDestination.source_url,
      legacyDestination.cached_segment_name,
      legacyDestination.display_label,
      displayOrder,
      legacyDestination.surface_type,
      legacyDestination.category
    );

    const destinationId = Number(inserted.lastInsertRowid);
    destinationIdByLegacyDestinationId.set(legacyDestination.id, destinationId);
    destinationIdByCampaignSegmentKey.set(destinationKey, destinationId);
    nextDisplayOrderByCampaignId.set(campaignId, displayOrder + 1);
  }

  for (const legacyMatch of legacyMatches) {
    const campaignId = campaignIdByLegacyWeekId.get(legacyMatch.explorer_week_id);
    const destinationId = destinationIdByLegacyDestinationId.get(legacyMatch.explorer_destination_id);

    if (!campaignId || !destinationId) {
      continue;
    }

    insertMatch.run(
      campaignId,
      destinationId,
      legacyMatch.strava_athlete_id,
      legacyMatch.strava_activity_id,
      legacyMatch.matched_at
    );
  }
}

export function repairLegacyExplorerSchema(db: SqliteDatabase): boolean {
  const hasLegacyWeekTable = tableExists(db, 'explorer_week');
  const hasCampaignTable = tableExists(db, 'explorer_campaign');

  if (!hasLegacyWeekTable || hasCampaignTable) {
    return false;
  }

  const legacyWeekCount = countRows(db, 'explorer_week');
  const legacyDestinationCount = countRows(db, 'explorer_destination');
  const legacyMatchCount = countRows(db, 'explorer_destination_match');

  console.log(
    '[DB] Legacy Explorer weekly schema detected; repairing to campaign schema ' +
    `(weeks=${legacyWeekCount}, destinations=${legacyDestinationCount}, matches=${legacyMatchCount})`
  );

  const repairTransaction = db.transaction(() => {
    db.exec(`
      ALTER TABLE explorer_destination_match RENAME TO explorer_destination_match_legacy;
      ALTER TABLE explorer_destination RENAME TO explorer_destination_legacy;
      ALTER TABLE explorer_week RENAME TO explorer_week_legacy;

      DROP INDEX IF EXISTS idx_explorer_match_week_athlete;
      DROP INDEX IF EXISTS idx_explorer_match_activity;
      DROP INDEX IF EXISTS idx_explorer_match_unique;
      DROP INDEX IF EXISTS idx_explorer_destination_week;
      DROP INDEX IF EXISTS idx_explorer_destination_segment;
      DROP INDEX IF EXISTS idx_explorer_week_status;
      DROP INDEX IF EXISTS idx_explorer_week_window;
    `);

    createCampaignExplorerTables(db);
    migrateLegacyExplorerRows(db);

    db.exec(`
      DROP TABLE explorer_destination_match_legacy;
      DROP TABLE explorer_destination_legacy;
      DROP TABLE explorer_week_legacy;
    `);
  });

  repairTransaction();
  console.log('[DB] ✓ Legacy Explorer schema repaired');
  return true;
}