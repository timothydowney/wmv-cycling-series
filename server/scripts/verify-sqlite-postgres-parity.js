#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { Client } = require('pg');

const TABLES = [
  'sessions',
  'participant',
  'segment',
  'season',
  'week',
  'activity',
  'segment_effort',
  'result',
  'participant_token',
  'deletion_request',
  'schema_migrations',
  'webhook_event',
  'webhook_subscription',
  'explorer_campaign',
  'explorer_destination',
  'explorer_destination_match',
  'explorer_destination_pin',
  'chain_wax_period',
  'chain_wax_activity',
  'chain_wax_puck',
];

function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--sqlite') {
      parsed.sqlite = argv[i + 1];
      i += 1;
    } else if (arg === '--postgres') {
      parsed.postgres = argv[i + 1];
      i += 1;
    }
  }

  return parsed;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function ensureTargetSchemaReady(client) {
  const result = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `
  );

  const existing = new Set(result.rows.map((row) => row.table_name));
  const missing = TABLES.filter((tableName) => !existing.has(tableName));

  if (missing.length > 0) {
    throw new Error(
      `Target Postgres schema is missing tables: ${missing.join(', ')}. ` +
        'Create schema first, then re-run parity checks.'
    );
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const sqlitePath = path.resolve(process.cwd(), args.sqlite || path.join(__dirname, '../data/wmv.db'));
  const postgresUrl = args.postgres || process.env.DATABASE_URL;

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite source does not exist: ${sqlitePath}`);
  }

  if (!postgresUrl) {
    throw new Error('Missing Postgres connection. Set DATABASE_URL or pass --postgres <url>.');
  }

  const sqliteDb = new Database(sqlitePath, { readonly: true });
  const pgClient = new Client({ connectionString: postgresUrl });

  const mismatches = [];

  try {
    await pgClient.connect();
    await ensureTargetSchemaReady(pgClient);

    for (const tableName of TABLES) {
      const sqliteCount = sqliteDb
        .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`)
        .get().count;

      const pgResult = await pgClient.query(
        `SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(tableName)}`
      );
      const pgCount = pgResult.rows[0].count;

      if (sqliteCount !== pgCount) {
        mismatches.push({ tableName, sqliteCount, pgCount });
      }

      console.log(`[PARITY] ${tableName}: sqlite=${sqliteCount} postgres=${pgCount}`);
    }
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }

  if (mismatches.length > 0) {
    console.error('[PARITY] Count mismatches detected:');
    for (const mismatch of mismatches) {
      console.error(
        `  - ${mismatch.tableName}: sqlite=${mismatch.sqliteCount}, postgres=${mismatch.pgCount}`
      );
    }
    process.exit(1);
  }

  console.log('[PARITY] Row-count parity check passed for all tables');
}

run().catch((error) => {
  console.error(`[PARITY] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
