import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createFullUserWithActivity, createWeekWithResults } from './testDataHelpers';

export interface SeedData {
  seasons: any[];
  weeks: any[];
}

export function setupTestDb(): { db: Database.Database; seedData: SeedData } {
  const db = new Database(':memory:');
  const drizzleDb = drizzle(db);
  
  // Run migrations manually
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');
  const migrationSql = fs.readFileSync(path.join(migrationsFolder, '0000_init.sql'), 'utf-8');
  
  // Split by Drizzle's statement breakpoint and execute
  const statements = migrationSql.split('--> statement-breakpoint');
  for (const statement of statements) {
    if (statement.trim()) {
      db.exec(statement);
    }
  }

  // Seed basic data
  // Creating a user, season, week, activity, result implicitly
  const fullData = createFullUserWithActivity(db, { stravaAthleteId: 12345 });
  
  // Additional week with results for leaderboard testing
  const weekWithResults = createWeekWithResults(db, {
    seasonId: fullData.season.id,
    stravaSegmentId: fullData.segment.strava_segment_id,
    weekName: 'Leaderboard Week',
    participantIds: [12345, 67890],
    times: [1000, 1200]
  });

  const seedData: SeedData = {
    seasons: [fullData.season],
    weeks: [fullData.week, weekWithResults.week]
  };

  return { db, seedData };
}

export function teardownTestDb(db: Database.Database) {
  db.close();
}
