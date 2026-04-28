import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const isPostgres = process.env.DB_DIALECT === 'postgres';
if (isPostgres && !process.env.DATABASE_URL) {
  throw new Error('DB_DIALECT=postgres requires DATABASE_URL for drizzle-kit');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: isPostgres ? 'postgresql' : 'sqlite',
  dbCredentials: {
    url: isPostgres
      ? (process.env.DATABASE_URL || '')
      : (process.env.DATABASE_PATH || path.resolve(__dirname, 'data/wmv.db')),
  },
});
