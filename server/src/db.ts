import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs'; // Restore fs import
import { config } from './config';

const DB_PATH = config.databasePath;
const dbDir = path.dirname(DB_PATH);

// Ensure database directory exists
try {
  // Check if directory exists and create if not
  if (!fs.existsSync(dbDir)) { // Use fs.existsSync
    console.log(`[DB] Creating database directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true }); // Use fs.mkdirSync
  }
  // Check write permissions
  fs.accessSync(dbDir, fs.constants.W_OK); // Use fs.accessSync and fs.constants
} catch (err: any) {
  console.error(`[DB] ✗ Error preparing database directory: ${err.message}`);
  // We let better-sqlite3 fail naturally if it can't write
}

import { drizzle } from 'drizzle-orm/better-sqlite3';

console.log('[DB] Connecting to database from db.ts...');
export const db: DatabaseType = new Database(DB_PATH);
export const drizzleDb = drizzle(db);
console.log('[DB] ✓ Database connection opened successfully');
