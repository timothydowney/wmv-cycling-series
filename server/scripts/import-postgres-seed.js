#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const IDENTITY_TABLES = [
  'activity',
  'chain_wax_activity',
  'chain_wax_period',
  'chain_wax_puck',
  'deletion_request',
  'explorer_campaign',
  'explorer_destination',
  'explorer_destination_match',
  'explorer_destination_pin',
  'result',
  'season',
  'segment_effort',
  'webhook_event',
  'webhook_subscription',
  'week',
];

function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--postgres') {
      parsed.postgres = argv[i + 1];
      i += 1;
    } else if (arg === '--sql') {
      parsed.sql = argv[i + 1];
      i += 1;
    }
  }

  return parsed;
}

function resolveSqlPath(sqlArg) {
  if (sqlArg) {
    return path.resolve(process.cwd(), sqlArg);
  }

  return path.resolve(__dirname, '../data/wmv_e2e_seed.sql');
}

function stripPgDumpMetaCommands(sqlText) {
  return sqlText
    .split('\n')
    .filter((line) => !line.startsWith('\\restrict ') && !line.startsWith('\\unrestrict '))
    .join('\n');
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function syncIdentitySequences(client) {
  for (const tableName of IDENTITY_TABLES) {
    const regclass = `public.${tableName}`;
    const seqResult = await client.query('SELECT pg_get_serial_sequence($1, $2) AS seq', [regclass, 'id']);
    const sequenceName = seqResult.rows[0]?.seq;

    if (!sequenceName) {
      continue;
    }

    const maxResult = await client.query(`SELECT MAX(id)::bigint AS max_id FROM ${quoteIdentifier(tableName)}`);
    const maxId = maxResult.rows[0]?.max_id;

    if (maxId === null || maxId === undefined) {
      await client.query('SELECT setval($1, 1, false)', [sequenceName]);
    } else {
      await client.query('SELECT setval($1, $2::bigint, true)', [sequenceName, maxId]);
    }
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const postgresUrl = args.postgres || process.env.DATABASE_URL;
  const sqlPath = resolveSqlPath(args.sql);

  if (!postgresUrl) {
    throw new Error('Missing Postgres connection. Set DATABASE_URL or pass --postgres <url>.');
  }

  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Postgres seed SQL does not exist: ${sqlPath}`);
  }

  const rawSql = fs.readFileSync(sqlPath, 'utf8');
  const sql = stripPgDumpMetaCommands(rawSql);

  const client = new Client({ connectionString: postgresUrl });

  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query(sql);
    await syncIdentitySequences(client);
    await client.query('COMMIT');
    console.log(`[SEED] Imported Postgres seed from ${sqlPath}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(`[SEED] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
