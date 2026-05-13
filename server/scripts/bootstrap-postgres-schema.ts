#!/usr/bin/env tsx

import { Client } from 'pg';
import { POSTGRES_SCHEMA_DDL } from '../src/db/postgresSchemaDdl';

async function run(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    for (const statement of POSTGRES_SCHEMA_DDL) {
      await client.query(statement);
    }

    console.log('[BOOTSTRAP] Postgres schema bootstrap completed successfully');
  } finally {
    await client.end();
  }
}

run().catch((error: unknown) => {
  console.error(`[BOOTSTRAP] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
