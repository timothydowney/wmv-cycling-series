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
console.log('  1. Participants connect via Strava OAuth');
console.log('  2. Admin creates segments via Manage Segments page');
console.log('  3. Admin creates weeks via Week Manager');
console.log('');
