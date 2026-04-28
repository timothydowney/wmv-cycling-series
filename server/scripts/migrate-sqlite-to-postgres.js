#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { Client } = require('pg');

const TABLE_ORDER = [
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
    } else if (arg === '--source-env') {
      parsed.sourceEnv = argv[i + 1];
      i += 1;
    } else if (arg === '--target-env') {
      parsed.targetEnv = argv[i + 1];
      i += 1;
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--confirm-destructive') {
      parsed.confirmDestructive = true;
    } else if (arg === '--allow-production-target') {
      parsed.allowProductionTarget = true;
    } else if (arg === '--skip-token-precheck') {
      parsed.skipTokenPrecheck = true;
    }
  }

  return parsed;
}

function getTokenEncryptionKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is required to validate encrypted token compatibility during migration. ' +
      'Pass --skip-token-precheck only if participant_token is empty and you explicitly accept skipping this safety check.'
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes).');
  }

  return Buffer.from(raw, 'hex');
}

function decryptTokenWithKey(encryptedData, key) {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format. Expected IV:AUTHTAG:CIPHERTEXT');
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptTokenWithKey(token, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function resolveSqlitePath(sqliteArg) {
  if (sqliteArg) {
    return path.resolve(process.cwd(), sqliteArg);
  }

  return path.resolve(__dirname, '../data/wmv.db');
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function convertValue(value, pgType) {
  if (value === null || value === undefined) {
    return null;
  }

  if (pgType === 'boolean' && (value === 0 || value === 1)) {
    return Boolean(value);
  }

  return value;
}

async function getPgTypeMap(client, tableName) {
  const result = await client.query(
    `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
    [tableName]
  );

  return new Map(result.rows.map((row) => [row.column_name, row.data_type]));
}

async function truncateTables(client) {
  const quoted = TABLE_ORDER.map((table) => quoteIdentifier(table)).join(', ');
  await client.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
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
  const missing = TABLE_ORDER.filter((tableName) => !existing.has(tableName));

  if (missing.length > 0) {
    throw new Error(
      `Target Postgres schema is missing tables: ${missing.join(', ')}. ` +
        'Create schema first, then re-run migration.'
    );
  }
}

function countSqliteRows(sqliteDb, tableName) {
  const row = sqliteDb
    .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)}`)
    .get();
  return row?.count || 0;
}

function validateTokenEncryptionCompatibility(sqliteDb) {
  const tokenRow = sqliteDb
    .prepare('SELECT access_token FROM participant_token WHERE access_token IS NOT NULL LIMIT 1')
    .get();

  if (!tokenRow) {
    console.log('[MIGRATE] Token precheck: participant_token has no rows, skipping encryption compatibility test');
    return;
  }

  const key = getTokenEncryptionKey();
  const sample = tokenRow.access_token;
  const decrypted = decryptTokenWithKey(sample, key);
  const reEncrypted = encryptTokenWithKey(decrypted, key);
  const reDecrypted = decryptTokenWithKey(reEncrypted, key);

  if (decrypted !== reDecrypted) {
    throw new Error('Token encryption precheck failed: decrypt/re-encrypt round-trip mismatch.');
  }

  console.log('[MIGRATE] Token precheck: encryption compatibility validated');
}

async function migrateTable(sqliteDb, pgClient, tableName) {
  const columnInfo = sqliteDb.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();

  if (columnInfo.length === 0) {
    console.log(`[MIGRATE] Skip ${tableName}: table not found in SQLite source`);
    return;
  }

  const columns = columnInfo.map((col) => col.name);
  const selectSql = `SELECT * FROM ${quoteIdentifier(tableName)}`;
  const rows = sqliteDb.prepare(selectSql).all();

  if (rows.length === 0) {
    console.log(`[MIGRATE] ${tableName}: 0 rows`);
    return;
  }

  const pgTypeMap = await getPgTypeMap(pgClient, tableName);
  const columnList = columns.map((col) => quoteIdentifier(col)).join(', ');
  const placeholderList = columns.map((_, idx) => `$${idx + 1}`).join(', ');
  const insertSql = `INSERT INTO ${quoteIdentifier(tableName)} (${columnList}) VALUES (${placeholderList})`;

  for (const row of rows) {
    const values = columns.map((col) => convertValue(row[col], pgTypeMap.get(col)));
    await pgClient.query(insertSql, values);
  }

  console.log(`[MIGRATE] ${tableName}: ${rows.length} rows`);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const sqlitePath = resolveSqlitePath(args.sqlite);
  const postgresUrl = args.postgres || process.env.DATABASE_URL;
  const dryRun = args.dryRun === true;
  const confirmDestructive = args.confirmDestructive === true;
  const allowProductionTarget = args.allowProductionTarget === true;
  const sourceEnv = args.sourceEnv || 'unspecified';
  const targetEnv = args.targetEnv || 'unspecified';
  const skipTokenPrecheck = args.skipTokenPrecheck === true;

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite source does not exist: ${sqlitePath}`);
  }

  if (!postgresUrl) {
    throw new Error('Missing Postgres connection. Set DATABASE_URL or pass --postgres <url>.');
  }

  if (sourceEnv !== 'unspecified' && targetEnv !== 'unspecified' && sourceEnv === targetEnv) {
    throw new Error(`Unsafe migration: source and target environments are the same (${sourceEnv}).`);
  }

  if (targetEnv === 'production' && !allowProductionTarget) {
    throw new Error(
      'Refusing to target production without explicit override. ' +
      'Re-run with --allow-production-target only during an approved downtime window.'
    );
  }

  if (!dryRun && !confirmDestructive) {
    throw new Error(
      'Destructive migration requires explicit confirmation. ' +
      'Re-run with --confirm-destructive, or use --dry-run to inspect safely.'
    );
  }

  const sqliteDb = new Database(sqlitePath, { readonly: true });
  const pgClient = new Client({ connectionString: postgresUrl });

  console.log(`[MIGRATE] SQLite source: ${sqlitePath}`);
  console.log(`[MIGRATE] Source env: ${sourceEnv}`);
  console.log(`[MIGRATE] Target env: ${targetEnv}`);
  console.log(`[MIGRATE] Mode: ${dryRun ? 'dry-run' : 'apply'}`);

  if (!skipTokenPrecheck) {
    validateTokenEncryptionCompatibility(sqliteDb);
  } else {
    console.log('[MIGRATE] Token precheck skipped by --skip-token-precheck');
  }

  try {
    await pgClient.connect();
    await ensureTargetSchemaReady(pgClient);

    if (dryRun) {
      console.log('[MIGRATE] Dry run summary (SQLite source row counts):');
      for (const tableName of TABLE_ORDER) {
        console.log(`[MIGRATE]   ${tableName}: ${countSqliteRows(sqliteDb, tableName)} rows`);
      }
      console.log('[MIGRATE] Dry run completed without modifying Postgres');
      return;
    }

    await pgClient.query('BEGIN');
    await truncateTables(pgClient);

    for (const tableName of TABLE_ORDER) {
      await migrateTable(sqliteDb, pgClient, tableName);
    }

    await pgClient.query('COMMIT');
    console.log('[MIGRATE] Completed successfully');
  } catch (error) {
    await pgClient.query('ROLLBACK');
    throw error;
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

run().catch((error) => {
  console.error(`[MIGRATE] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
