#!/usr/bin/env node

/**
 * Export season and weeks data to JSON
 * Usage: node scripts/export-season-data.js [output-file]
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/wmv.db');
const db = new Database(dbPath);

// Get command line argument for output file
const outputFile = process.argv[2] || path.join(__dirname, '../data/season-export.json');

try {
  // Export seasons
  const seasons = db.prepare(`
    SELECT id, name, start_date, end_date, is_active
    FROM seasons
    ORDER BY start_date
  `).all();

  // Export weeks with segment information
  const weeks = db.prepare(`
    SELECT 
      w.id,
      w.season_id,
      w.week_name,
      w.date,
      w.required_laps,
      w.start_time,
      w.end_time,
      s.strava_segment_id,
      s.name as segment_name
    FROM weeks w
    LEFT JOIN segments s ON w.segment_id = s.id
    ORDER BY w.date
  `).all();

  // Export segments (so we can recreate them if needed)
  const segments = db.prepare(`
    SELECT id, strava_segment_id, name
    FROM segments
  `).all();

  const exportData = {
    exported_at: new Date().toISOString(),
    seasons,
    weeks,
    segments
  };

  // Write to file
  fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2));
  
  console.log('✅ Season data exported successfully!');
  console.log(`📁 Output file: ${outputFile}`);
  console.log(`📊 Exported: ${seasons.length} season(s), ${weeks.length} week(s), ${segments.length} segment(s)`);
  
} catch (error) {
  console.error('❌ Export failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
