import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs'; // Restore fs import
import { config, isE2EMode, validateRuntimeConfig } from './config';

validateRuntimeConfig();

const DB_PATH = config.databasePath;
const dbDir = path.dirname(DB_PATH);

function prepareE2EDatabase() {
  if (!isE2EMode() || !config.e2eResetDatabaseOnStartup) {
    return;
  }

  const sourcePath = config.e2eSourceDatabasePath;

  if (!sourcePath) {
    throw new Error('WMV E2E database reset requested without a source database path');
  }

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`WMV E2E source database not found: ${sourcePath}`);
  }

  if (path.resolve(sourcePath) === path.resolve(DB_PATH)) {
    throw new Error('WMV E2E source database path must differ from DATABASE_PATH');
  }

  fs.rmSync(`${DB_PATH}-wal`, { force: true });
  fs.rmSync(`${DB_PATH}-shm`, { force: true });
  fs.copyFileSync(sourcePath, DB_PATH);
  console.log(`[DB] Reset E2E database from ${sourcePath} -> ${DB_PATH}`);
}

// Ensure database directory exists
try {
  // Check if directory exists and create if not
  if (!fs.existsSync(dbDir)) { // Use fs.existsSync
    console.log(`[DB] Creating database directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true }); // Use fs.mkdirSync
  }
  // Check write permissions
  fs.accessSync(dbDir, fs.constants.W_OK); // Use fs.accessSync and fs.constants
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[DB] ✗ Error preparing database directory: ${message}`);
  // We let better-sqlite3 fail naturally if it can't write
}

prepareE2EDatabase();

import { drizzle } from 'drizzle-orm/better-sqlite3';

console.log('[DB] Connecting to database from db.ts...');
export const db: DatabaseType = new Database(DB_PATH);
export const drizzleDb = drizzle(db);
console.log('[DB] ✓ Database connection opened successfully');
