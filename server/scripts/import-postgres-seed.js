#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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
