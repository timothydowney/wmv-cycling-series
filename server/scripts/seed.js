#!/usr/bin/env node
/**
 * Database Seeding Script
 * 
 * Creates initial season and test data for development.
 * Run with: npm run seed
 * 
 * This script is safe to run multiple times - it checks for existing data.
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/wmv.db');
const db = new Database(dbPath);

console.log('🌱 Starting database seed...');

// Check if we already have a season
const existingSeasons = db.prepare('SELECT COUNT(*) as count FROM seasons').get();
if (existingSeasons.count > 0) {
  console.log('✅ Database already has seasons. Skipping seed.');
  console.log('   To re-seed, manually delete seasons or use a fresh database.');
  db.close();
  process.exit(0);
}

console.log('📊 Creating Fall 2025 season...');

db.transaction(() => {
  // Create Fall 2025 season (Oct 1 - Dec 31)
  db.prepare(`
    INSERT INTO seasons (id, name, start_date, end_date, is_active)
    VALUES (?, ?, ?, ?, ?)
  `).run(1, 'Fall 2025', '2025-10-01', '2025-12-31', 1);

  console.log('   ✓ Fall 2025 season created (Oct 1 - Dec 31, active)');

})();

db.close();

console.log('');
console.log('✅ Database seeding complete!');
console.log('');
console.log('Next steps:');
console.log('  1. Create segments via admin API (POST /admin/weeks with segment_name)');
console.log('  2. Create weeks via admin API (POST /admin/weeks)');
console.log('  3. Participants auto-created when they connect via Strava OAuth');
console.log('');
