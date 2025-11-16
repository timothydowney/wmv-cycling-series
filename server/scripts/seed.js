#!/usr/bin/env node
/**
 * Database Seeding Script
 * 
 * Creates initial Fall 2025 season for development.
 * Run with: npm run seed
 * 
 * Safe to run multiple times - checks for existing seasons.
 * 
 * Note: Participants, segments, and weeks are created via the admin UI.
 * Tests create their own test fixtures inline (see __tests__/).
 */

const Database = require('better-sqlite3');
const path = require('path');
const { SCHEMA } = require('../src/schema');
const { isoToUnix } = require('../src/dateUtils');

const dbPath = path.join(__dirname, '../data/wmv.db');
const db = new Database(dbPath);

console.log('🌱 Starting database seed...');

// Initialize schema
console.log('📐 Initializing database schema...');
db.exec(SCHEMA);
console.log('   ✓ Schema initialized');

// Check if we already have a season
const existingSeasons = db.prepare('SELECT COUNT(*) as count FROM season').get();
if (existingSeasons.count > 0) {
  console.log('✅ Database already has seasons. Skipping seed.');
  console.log('   To re-seed, manually delete seasons or use a fresh database.');
  db.close();
  process.exit(0);
}

console.log('📊 Creating Fall 2025 season...');

db.transaction(() => {
  // Create Fall 2025 season (Oct 1 - Dec 31, Eastern Time)
  // ISO strings represent the UTC equivalent of the local time:
  // 2025-10-01T00:00:00-04:00 (Oct 1 midnight EDT) → 2025-10-01T04:00:00Z
  // 2025-12-31T23:59:59-05:00 (Dec 31 end EST) → 2026-01-01T04:59:59Z
  const startAt = isoToUnix('2025-10-01T04:00:00Z'); // Oct 1, 2025 00:00:00 America/New_York
  const endAt = isoToUnix('2026-01-01T04:59:59Z');   // Dec 31, 2025 23:59:59 America/New_York
  
  db.prepare(`
    INSERT INTO season (id, name, start_at, end_at, is_active)
    VALUES (?, ?, ?, ?, ?)
  `).run(1, 'Fall 2025', startAt, endAt, 1);

  console.log('   ✓ Fall 2025 season created (Oct 1 - Dec 31 Eastern Time, active)');
  console.log(`   ✓ start_at: ${startAt} (${new Date(startAt * 1000).toISOString()})`);
  console.log(`   ✓ end_at: ${endAt} (${new Date(endAt * 1000).toISOString()})`);

})();

db.close();

console.log('');
console.log('✅ Database seeding complete!');
console.log('');
console.log('Next steps:');
console.log('  1. Participants connect via Strava OAuth');
console.log('  2. Admin creates segments via Manage Segments page');
console.log('  3. Admin creates weeks via Week Manager');
console.log('');
