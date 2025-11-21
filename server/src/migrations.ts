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
