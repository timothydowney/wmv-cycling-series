import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
// import fs from 'fs'; // No longer needed
import { participant, season, segment, week, activity, result } from '../db/schema';
import { InsertActivity, InsertParticipant, InsertSeason, InsertSegment, InsertWeek, InsertResult } from './testDataHelpers';

export interface SeedData {
  seasons: any[];
  weeks: any[];
}

export function setupTestDb(options?: { seed?: boolean }): { db: Database.Database; drizzleDb: BetterSQLite3Database; seedData?: SeedData } {
  const { seed = true } = options || {};

  const db = new Database(':memory:');
  const drizzleDb = drizzle(db);
  
  // Run Drizzle migrations
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');
  migrate(drizzleDb, { migrationsFolder });

  let seedData: SeedData | undefined = undefined;

  if (seed) {
    // Manually seed data for debugging Foreign Key issues
    const p1_data: InsertParticipant = { strava_athlete_id: 100, name: 'Test User 1', active: true };
    const testParticipant = drizzleDb.insert(participant).values(p1_data).returning().get();

    const s1_data: InsertSeason = { 
      name: 'Test Season', 
      start_at: Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000), 
      end_at: Math.floor(new Date('2025-12-31T23:59:59Z').getTime() / 1000),   
      is_active: 1 
    };
    const testSeason = drizzleDb.insert(season).values(s1_data).returning().get();
    
    const sg1_data: InsertSegment = { strava_segment_id: 1000, name: 'Test Segment' };
    const testSegment = drizzleDb.insert(segment).values(sg1_data).returning().get();

    const w1_data: InsertWeek = {
      season_id: testSeason.id,
      week_name: 'Test Week',
      strava_segment_id: testSegment.strava_segment_id,
      required_laps: 1,
      start_at: Math.floor(new Date('2025-06-01T00:00:00Z').getTime() / 1000), 
      end_at: Math.floor(new Date('2025-06-01T22:00:00Z').getTime() / 1000), 
    };
    const testWeek = drizzleDb.insert(week).values(w1_data).returning().get();

    const a1_data: InsertActivity = {
      week_id: testWeek.id,
      strava_athlete_id: testParticipant.strava_athlete_id,
      strava_activity_id: Math.floor(Math.random() * 1000000000),
      start_at: Math.floor(new Date('2025-06-01T10:00:00Z').getTime() / 1000), 
      validation_status: 'valid'
    };
    const testActivity = drizzleDb.insert(activity).values(a1_data).returning().get();
    
    const r1_data: InsertResult = {
      week_id: testWeek.id,
      strava_athlete_id: testParticipant.strava_athlete_id,
      activity_id: testActivity.id,
      total_time_seconds: 100
    };
    drizzleDb.insert(result).values(r1_data).returning().get();

    // Create second participant for leaderboard testing
    const p2_data: InsertParticipant = { strava_athlete_id: 200, name: 'Test User 2', active: true };
    const testParticipant2 = drizzleDb.insert(participant).values(p2_data).returning().get();

    const a2_data: InsertActivity = {
      week_id: testWeek.id,
      strava_athlete_id: testParticipant2.strava_athlete_id,
      strava_activity_id: Math.floor(Math.random() * 1000000000),
      start_at: Math.floor(new Date('2025-06-01T11:00:00Z').getTime() / 1000),
      validation_status: 'valid'
    };
    const testActivity2 = drizzleDb.insert(activity).values(a2_data).returning().get();

    const r2_data: InsertResult = {
      week_id: testWeek.id,
      strava_athlete_id: testParticipant2.strava_athlete_id,
      activity_id: testActivity2.id,
      total_time_seconds: 200 
    };
    drizzleDb.insert(result).values(r2_data).returning().get();

    seedData = {
      seasons: [testSeason],
      weeks: [testWeek]
    };
  }

  return { db, drizzleDb, seedData };
}

export function teardownTestDb(db: Database.Database) {
  db.close();
}