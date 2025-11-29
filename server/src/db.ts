import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from './config';

const DB_PATH = config.databasePath;
const dbDir = path.dirname(DB_PATH);

// Ensure database directory exists
try {
  if (!fs.existsSync(dbDir)) {
    console.log(`[DB] Creating database directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }
  // Check write permissions
  fs.accessSync(dbDir, fs.constants.W_OK);
} catch (err: any) {
  console.error(`[DB] ✗ Error preparing database directory: ${err.message}`);
  // We let better-sqlite3 fail naturally if it can't write
}

console.log('[DB] Connecting to database from db.ts...');
export const db: DatabaseType = new Database(DB_PATH);
console.log('[DB] ✓ Database connection opened successfully');