#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const repoRoot = path.resolve(__dirname, '..', '..');
const sourcePath = path.resolve(repoRoot, 'server/data/wmv.db');
const targetPath = path.resolve(repoRoot, 'server/data/wmv_e2e_fixture.db');

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Source database not found: ${sourcePath}`);
}

fs.copyFileSync(sourcePath, targetPath);

const db = new Database(targetPath);

db.exec(`
  DELETE FROM sessions;
  DELETE FROM participant_token;
  DELETE FROM deletion_request;
  DELETE FROM webhook_subscription;
`);

const summary = {
  participant_count: db.prepare('SELECT COUNT(*) AS count FROM participant').get().count,
  participant_token_count: db.prepare('SELECT COUNT(*) AS count FROM participant_token').get().count,
  session_count: db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count,
  webhook_subscription_count: db.prepare('SELECT COUNT(*) AS count FROM webhook_subscription').get().count,
  webhook_event_count: db.prepare('SELECT COUNT(*) AS count FROM webhook_event').get().count,
  season_count: db.prepare('SELECT COUNT(*) AS count FROM season').get().count,
  week_count: db.prepare('SELECT COUNT(*) AS count FROM week').get().count,
};

db.pragma('wal_checkpoint(FULL)');
db.exec('VACUUM');
db.close();

console.log('[E2E fixture] Built sanitized fixture database');
console.log(`[E2E fixture] Source: ${sourcePath}`);
console.log(`[E2E fixture] Target: ${targetPath}`);
console.log('[E2E fixture] Summary:', summary);