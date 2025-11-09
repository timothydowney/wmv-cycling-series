#!/usr/bin/env node

/**
 * Import season and weeks data from JSON
 * Usage: node scripts/import-season-data.js [input-file]
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/wmv.db');
const db = new Database(dbPath);

// Get command line argument for input file
const inputFile = process.argv[2] || path.join(__dirname, '../data/season-export.json');

try {
  // Read import file
  if (!fs.existsSync(inputFile)) {
    throw new Error(`Import file not found: ${inputFile}`);
  }

  const importData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  
  console.log('📥 Importing season data...');
  console.log(`📅 Exported at: ${importData.exported_at}`);
  console.log(`📊 Data: ${importData.seasons.length} season(s), ${importData.weeks.length} week(s), ${importData.segments.length} segment(s)`);
  
  // Start transaction
  const importTransaction = db.transaction(() => {
    // Clear existing data (but keep participants and results)
    console.log('🗑️  Clearing existing seasons and weeks...');
    db.prepare('DELETE FROM weeks').run();
    db.prepare('DELETE FROM seasons').run();
    db.prepare('DELETE FROM segments').run();
    
    // Import segments first
    console.log(`📍 Importing ${importData.segments.length} segments...`);
    const insertSegment = db.prepare(`
      INSERT INTO segments (id, strava_segment_id, name)
      VALUES (?, ?, ?)
    `);
    
    for (const segment of importData.segments) {
      insertSegment.run(segment.id, segment.strava_segment_id, segment.name);
    }
    
    // Import seasons
    console.log(`🏆 Importing ${importData.seasons.length} seasons...`);
    const insertSeason = db.prepare(`
      INSERT INTO seasons (id, name, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    for (const season of importData.seasons) {
      insertSeason.run(
        season.id,
        season.name,
        season.start_date,
        season.end_date,
        season.is_active
      );
    }
    
    // Import weeks
    console.log(`📅 Importing ${importData.weeks.length} weeks...`);
    const insertWeek = db.prepare(`
      INSERT INTO weeks (id, season_id, week_name, date, segment_id, required_laps, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (const week of importData.weeks) {
      // Find segment_id by strava_segment_id
      const segment = db.prepare('SELECT id FROM segments WHERE strava_segment_id = ?')
        .get(week.strava_segment_id);
      
      if (!segment) {
        console.warn(`⚠️  Segment not found for week ${week.week_name}, skipping...`);
        continue;
      }
      
      insertWeek.run(
        week.id,
        week.season_id,
        week.week_name,
        week.date,
        segment.id,
        week.required_laps,
        week.start_time,
        week.end_time
      );
    }
  });
  
  importTransaction();
  
  console.log('✅ Season data imported successfully!');
  console.log('📝 Note: Participants and results were preserved');
  
} catch (error) {
  console.error('❌ Import failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
