#!/usr/bin/env node

const { Client } = require('pg');

function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url') {
      parsed.url = argv[i + 1];
      i += 1;
    }
  }

  return parsed;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const connectionString = args.url || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Missing Postgres connection string. Pass --url or set DATABASE_URL.');
  }

  const target = new URL(connectionString);
  const targetDbName = target.pathname.replace(/^\//, '');

  if (!targetDbName) {
    throw new Error('DATABASE_URL must include a database name in the path component.');
  }

  const adminUrl = new URL(connectionString);
  adminUrl.pathname = '/postgres';

  const client = new Client({ connectionString: adminUrl.toString() });

  try {
    await client.connect();

    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDbName]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`[db-ensure] Database already exists: ${targetDbName}`);
      return;
    }

    await client.query(`CREATE DATABASE ${quoteIdentifier(targetDbName)}`);
    console.log(`[db-ensure] Created database: ${targetDbName}`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(`[db-ensure] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
