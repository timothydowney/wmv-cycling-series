/**
 * migrations.ts
 *
 * Flyway-style migration system for database schema changes.
 * Migrations are idempotent and can be safely re-run without side effects.
 *
 * Each migration:
 * - Has a unique version identifier (V1, V2, V3, etc.)
 * - Includes an up() function with the migration logic
 * - Uses IF NOT EXISTS or similar guards to be idempotent
 * - Is tracked in a migrations table to prevent re-execution
 *
 * Usage:
 *   const db = new Database(DB_PATH);
 *   runMigrations(db);
 */

import { Database } from 'better-sqlite3';

interface Migration {
  version: string;
  name: string;
  up: (db: Database) => void;
}

/**
 * Define all migrations in order
 * Version format: V{number}_{description}
 */
const migrations: Migration[] = [
  {
    version: 'V1',
    name: 'Add week notes column',
    up: (db: Database) => {
      // Idempotent: Check if column exists before adding
      const tableInfo = db
        .prepare('PRAGMA table_info(week)')
        .all() as Array<{ name: string; type: string }>;
      const hasNotesColumn = tableInfo.some((col) => col.name === 'notes');

      if (!hasNotesColumn) {
        db.prepare(`
          ALTER TABLE week
          ADD COLUMN notes TEXT DEFAULT ''
        `).run();
        console.log('[MIGRATION] V1: Added notes column to week table');
      } else {
        console.log('[MIGRATION] V1: notes column already exists, skipping');
      }
    }
  },
  {
    version: 'V2',
    name: 'Add elevation_gain column to segment table',
    up: () => {
      // This migration was already run in production - it added elevation_gain
      // but we've since refactored to use total_elevation_gain
      // This migration is now a no-op to maintain compatibility
      console.log('[MIGRATION] V2: Skipping (legacy migration, already executed)');
    }
  },
  {
    version: 'V3',
    name: 'Add segment metadata columns for display feature',
    up: (db: Database) => {
      // Idempotent: Check if columns exist before adding
      const tableInfo = db
        .prepare('PRAGMA table_info(segment)')
        .all() as Array<{ name: string; type: string }>;
      
      const hasOldElevationGain = tableInfo.some((col) => col.name === 'elevation_gain');
      const hasTotalElevationGain = tableInfo.some((col) => col.name === 'total_elevation_gain');
      const hasClimbCategory = tableInfo.some((col) => col.name === 'climb_category');

      // Rename old elevation_gain column to total_elevation_gain to match Strava API field name
      if (hasOldElevationGain && !hasTotalElevationGain) {
        db.prepare(`
          ALTER TABLE segment
          RENAME COLUMN elevation_gain TO total_elevation_gain
        `).run();
        console.log('[MIGRATION] V3: Renamed elevation_gain to total_elevation_gain (matches Strava API)');
      } else if (!hasTotalElevationGain) {
        // If neither column exists, create total_elevation_gain
        db.prepare(`
          ALTER TABLE segment
          ADD COLUMN total_elevation_gain REAL
        `).run();
        console.log('[MIGRATION] V3: Added total_elevation_gain column to segment table');
      } else {
        console.log('[MIGRATION] V3: total_elevation_gain column already exists, skipping');
      }

      if (!hasClimbCategory) {
        db.prepare(`
          ALTER TABLE segment
          ADD COLUMN climb_category INTEGER
        `).run();
        console.log('[MIGRATION] V3: Added climb_category column to segment table');
      } else {
        console.log('[MIGRATION] V3: climb_category column already exists, skipping');
      }
    }
  },
  {
    version: 'V4',
    name: 'Clean up duplicate elevation_gain column',
    up: (db: Database) => {
      // Handle case where both elevation_gain and total_elevation_gain exist
      // Copy data from elevation_gain to total_elevation_gain if needed, then drop elevation_gain
      const tableInfo = db
        .prepare('PRAGMA table_info(segment)')
        .all() as Array<{ name: string; type: string }>;
      
      const hasOldElevationGain = tableInfo.some((col) => col.name === 'elevation_gain');
      const hasTotalElevationGain = tableInfo.some((col) => col.name === 'total_elevation_gain');

      if (hasOldElevationGain && hasTotalElevationGain) {
        // Copy any non-null values from elevation_gain to total_elevation_gain
        db.prepare(`
          UPDATE segment 
          SET total_elevation_gain = elevation_gain 
          WHERE elevation_gain IS NOT NULL AND total_elevation_gain IS NULL
        `).run();
        console.log('[MIGRATION] V4: Copied elevation_gain data to total_elevation_gain');

        // Drop the old elevation_gain column
        // SQLite doesn't support DROP COLUMN in older versions, so we need to recreate the table
        // But most SQLite 3.35.0+ supports it. Try the modern way first, fall back if needed.
        try {
          db.prepare(`
            ALTER TABLE segment
            DROP COLUMN elevation_gain
          `).run();
          console.log('[MIGRATION] V4: Dropped old elevation_gain column');
        } catch (e) {
          // If DROP COLUMN fails, log it but don't fail the migration
          // The column won't hurt anything, just redundant
          console.log('[MIGRATION] V4: Could not drop elevation_gain column (older SQLite version), but data is safe. This is non-critical.');
        }
      } else {
        console.log('[MIGRATION] V4: No cleanup needed, skipping');
      }
    }
  },
  {
    version: 'V5',
    name: 'Add webhook event retry tracking columns',
    up: (db: Database) => {
      // Idempotent: Check if columns exist before adding
      const tableInfo = db
        .prepare('PRAGMA table_info(webhook_event)')
        .all() as Array<{ name: string; type: string }>;
      
      const hasRetryCount = tableInfo.some((col) => col.name === 'retry_count');
      const hasLastErrorAt = tableInfo.some((col) => col.name === 'last_error_at');
      const hasPayload = tableInfo.some((col) => col.name === 'payload');

      if (!hasPayload) {
        db.prepare(`
          ALTER TABLE webhook_event
          ADD COLUMN payload TEXT
        `).run();
        console.log('[MIGRATION] V5: Added payload column to webhook_event table');
      } else {
        console.log('[MIGRATION] V5: payload column already exists, skipping');
      }

      if (!hasRetryCount) {
        db.prepare(`
          ALTER TABLE webhook_event
          ADD COLUMN retry_count INTEGER DEFAULT 0
        `).run();
        console.log('[MIGRATION] V5: Added retry_count column to webhook_event table');
      } else {
        console.log('[MIGRATION] V5: retry_count column already exists, skipping');
      }

      if (!hasLastErrorAt) {
        db.prepare(`
          ALTER TABLE webhook_event
          ADD COLUMN last_error_at TEXT
        `).run();
        console.log('[MIGRATION] V5: Added last_error_at column to webhook_event table');
      } else {
        console.log('[MIGRATION] V5: last_error_at column already exists, skipping');
      }
    }
  }
];

/**
 * Run all pending migrations
 * Creates a migrations table if it doesn't exist and tracks which migrations have been run
 *
 * @param db Database connection
 */
export function runMigrations(db: Database): void {
  console.log('[MIGRATIONS] Starting migration check...');

  // Create migrations tracking table if it doesn't exist
  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      executed_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Get list of already-executed migrations
  const executedMigrations = db
    .prepare('SELECT version FROM schema_migrations')
    .all() as Array<{ version: string }>;
  const executedVersions = new Set(executedMigrations.map((m) => m.version));

  // Run pending migrations
  let migrationsRun = 0;
  for (const migration of migrations) {
    if (!executedVersions.has(migration.version)) {
      try {
        console.log(`[MIGRATIONS] Running migration: ${migration.version} - ${migration.name}`);
        migration.up(db);

        // Track that this migration was executed
        db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
          .run(migration.version, migration.name);

        console.log(`[MIGRATIONS] ✓ Migration completed: ${migration.version}`);
        migrationsRun++;
      } catch (error) {
        console.error(`[MIGRATIONS] ✗ Migration failed: ${migration.version}`, error);
        throw error;
      }
    } else {
      console.log(`[MIGRATIONS] Skipped (already executed): ${migration.version} - ${migration.name}`);
    }
  }

  if (migrationsRun === 0) {
    console.log('[MIGRATIONS] No pending migrations to run');
  } else {
    console.log(`[MIGRATIONS] ✓ Successfully ran ${migrationsRun} migration(s)`);
  }
}

export default runMigrations;
