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
  },
  {
    version: 'V6',
    name: 'Refactor webhook_subscription table to lean schema',
    up: (db: Database) => {
      // This migration simplifies webhook_subscription to store only essential data:
      // - verify_token (we generate this)
      // - subscription_payload (complete JSON from Strava)
      // - last_refreshed_at (when we last synced with Strava)
      // 
      // The presence of a record = enabled, absence = disabled
      // All Strava metadata (id, created_at, updated_at, etc) is in the payload
      
      const tableInfo = db
        .prepare('PRAGMA table_info(webhook_subscription)')
        .all() as Array<{ name: string; type: string }>;
      
      const hasSubscriptionPayload = tableInfo.some((col) => col.name === 'subscription_payload');

      // If payload column doesn't exist, we need to migrate
      if (!hasSubscriptionPayload) {
        console.log('[MIGRATION] V6: Refactoring webhook_subscription table...');
        
        // Since we don't care about preserving old data, we can drop and recreate
        db.prepare('DROP TABLE IF EXISTS webhook_subscription').run();
        console.log('[MIGRATION] V6: Dropped old webhook_subscription table');

        // Create new lean schema
        db.prepare(`
          CREATE TABLE webhook_subscription (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            verify_token TEXT,
            subscription_payload TEXT,
            last_refreshed_at TEXT
          )
        `).run();
        console.log('[MIGRATION] V6: Created new lean webhook_subscription table');

        // Drop old index if it exists
        db.prepare('DROP INDEX IF EXISTS idx_webhook_subscription_enabled').run();
        db.prepare('DROP INDEX IF EXISTS idx_webhook_subscription_status').run();
        console.log('[MIGRATION] V6: Dropped old indexes');
      } else {
        console.log('[MIGRATION] V6: subscription_payload column already exists, skipping');
      }
    }
  },
  {
    version: 'V7',
    name: 'Simplify webhook_event table to lean schema',
    up: (db: Database) => {
      // This migration simplifies webhook_event to store only essential data:
      // - id (primary key)
      // - payload (raw JSON from Strava webhook)
      // - processed (boolean, has this been handled?)
      // - error_message (string, why did it fail if processed=0?)
      // - created_at (timestamp for expiry and sorting)
      //
      // All parsed event data (aspect_type, object_type, object_id, etc) 
      // can be extracted from the payload when needed.
      // This makes debugging much easier - we always have the raw data.
      
      const tableInfo = db
        .prepare('PRAGMA table_info(webhook_event)')
        .all() as Array<{ name: string; type: string }>;
      
      // Check if table has the old schema with extra columns
      const hasAspectType = tableInfo.some((col) => col.name === 'aspect_type');

      if (hasAspectType) {
        console.log('[MIGRATION] V7: Simplifying webhook_event table...');
        
        // Drop and recreate the table (we don't care about old event data)
        db.prepare('DROP TABLE IF EXISTS webhook_event').run();
        console.log('[MIGRATION] V7: Dropped old webhook_event table');

        // Create new lean schema
        db.prepare(`
          CREATE TABLE webhook_event (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payload TEXT NOT NULL,
            processed BOOLEAN DEFAULT 0,
            error_message TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
        console.log('[MIGRATION] V7: Created new lean webhook_event table');

        // Create simple index for sorting/filtering
        db.prepare(`
          CREATE INDEX IF NOT EXISTS idx_webhook_event_created ON webhook_event(created_at)
        `).run();
        console.log('[MIGRATION] V7: Created index on created_at');

        // Drop all old indexes
        db.prepare('DROP INDEX IF EXISTS idx_webhook_event_processed').run();
        db.prepare('DROP INDEX IF EXISTS idx_webhook_event_owner').run();
        console.log('[MIGRATION] V7: Dropped old indexes');
      } else {
        console.log('[MIGRATION] V7: Table already simplified, skipping');
      }
    }
  },
  {
    version: 'V8',
    name: 'Add subscription_id column to webhook_subscription table with CHECK constraint',
    up: (db: Database) => {
      // This migration adds a separate subscription_id column to store Strava's subscription ID
      // independently from the JSON payload. This prevents ID confusion:
      // - id (INTEGER PRIMARY KEY = 1, our database key, never changes)
      // - subscription_id (Strava's subscription ID, e.g., 5, changes on renewal)
      //
      // Previously, we were extracting the ID from the JSON payload, but if the payload
      // was corrupted, the ID would be wrong when trying to delete from Strava.
      // Now we store it directly for clean, reliable access.
      //
      // NOTE: SQLite doesn't allow ALTER TABLE to add CHECK constraints, so we must
      // recreate the table to enforce the constraint.
      
      const tableInfo = db
        .prepare('PRAGMA table_info(webhook_subscription)')
        .all() as Array<{ name: string; type: string }>;
      
      const hasSubscriptionId = tableInfo.some((col) => col.name === 'subscription_id');
      const hasCheckConstraint = tableInfo.length > 0 && 
        db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='webhook_subscription'")
          .get() as { sql: string } | undefined;
      
      // Check if constraint is missing (old table without CHECK)
      const needsRecreate = hasCheckConstraint && 
        !(hasCheckConstraint as any).sql?.includes('CHECK');

      if (!hasSubscriptionId || needsRecreate) {
        console.log('[MIGRATION] V8: Recreating webhook_subscription table with subscription_id and CHECK constraint...');
        
        // Save existing data if any
        const existingData = db.prepare(`
          SELECT id, verify_token, subscription_payload, last_refreshed_at
          FROM webhook_subscription
          WHERE id = 1
          LIMIT 1
        `).get() as any;

        // Drop old table
        db.prepare('DROP TABLE IF EXISTS webhook_subscription').run();
        console.log('[MIGRATION] V8: Dropped old webhook_subscription table');

        // Create new table with all columns including CHECK constraint
        db.prepare(`
          CREATE TABLE webhook_subscription (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            verify_token TEXT NOT NULL,
            subscription_payload TEXT,
            subscription_id INTEGER,
            last_refreshed_at TEXT,
            CHECK (id = 1)
          )
        `).run();
        console.log('[MIGRATION] V8: Created new webhook_subscription table with subscription_id and CHECK constraint');

        // Restore existing data if any
        if (existingData) {
          db.prepare(`
            INSERT INTO webhook_subscription (id, verify_token, subscription_payload, last_refreshed_at)
            VALUES (?, ?, ?, ?)
          `).run(existingData.id, existingData.verify_token, existingData.subscription_payload, existingData.last_refreshed_at);
          console.log('[MIGRATION] V8: Restored existing subscription data');
        }
      } else {
        console.log('[MIGRATION] V8: subscription_id column already exists with CHECK constraint, skipping');
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
