import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './db/schema';
import { config, validateRuntimeConfig } from './config';
import type { AppDatabase, RawDatabase } from './db/types';

validateRuntimeConfig();

if (config.databaseDialect !== 'postgres') {
  throw new Error(
    'The runtime server branch is now Postgres-only. Set DB_DIALECT=postgres and DATABASE_URL ' +
      'before starting the backend, and use the SQLite migration bridge scripts to populate Postgres first.'
  );
}

console.log('[DB] Connecting to database from db.ts...');
export const db: RawDatabase = new Pool({ connectionString: config.databaseUrl });
export const drizzleDb: AppDatabase = drizzle({ client: db, schema });
console.log('[DB] ✓ Database connection opened successfully');
