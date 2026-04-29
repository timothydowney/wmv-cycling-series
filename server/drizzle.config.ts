import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Runtime is Postgres-only. DATABASE_URL is required for drizzle-kit migrate/push/pull
// commands but not for generate (which works from schema.ts without a live DB connection).
const databaseUrl = process.env.DATABASE_URL || '';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
