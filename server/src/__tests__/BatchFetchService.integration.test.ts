/**
 * BatchFetchService.integration.test.ts
 * 
 * Integration tests for BatchFetchService with season validation.
 * Focuses on verifying that batch fetch respects season end dates.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import Database from 'better-sqlite3';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import BatchFetchService from '../services/BatchFetchService';
import { setupTestDb } from './setupTestDb'; // Import setupTestDb
// import { SCHEMA } from '../schema'; // Removed

describe('BatchFetchService with Season Validation', () => {
  let db: Database.Database;
  let drizzleDb: BetterSQLite3Database;
  let service: BatchFetchService;
  const now = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    // Create in-memory test database and run migrations
    const testDb = setupTestDb({ seed: false });
    db = testDb.db;
    drizzleDb = testDb.drizzleDb;

    // Create a common segment for all tests in this suite
    db.prepare(
      `INSERT INTO segment (strava_segment_id, name, distance, average_grade)
       VALUES (?, ?, ?, ?)`
    ).run(999999, 'Test Segment', 2500, 6.5);

    // Create service instance with mock token provider (reset for each test)
    service = new BatchFetchService(drizzleDb, async () => 'mock-token');
  });


  afterEach(() => {
    db.close();
  });

  describe('fetchWeekResults() with closed season', () => {
    it('should return error when trying to fetch for week in closed season', async () => {
      // Create a closed season (ended 1 day ago)
      const closedSeasonId = db
        .prepare(
          `INSERT INTO season (name, start_at, end_at, is_active, created_at)
           VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
        )
        .run('Closed Season', now - 86400 * 30, now - 86400) as any;

      // Create a segment
      db.prepare(
        `INSERT INTO segment (strava_segment_id, name, distance, average_grade)
         VALUES (?, ?, ?, ?)`
      ).run(12345, 'Test Segment', 2500, 6.5);

      // Create a week in the closed season
      const weekId = db
        .prepare(
          `INSERT INTO week (season_id, week_name, strava_segment_id, start_at, end_at, required_laps, created_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        )
        .run(
          closedSeasonId.lastInsertRowid,
          'Closed Week',
          12345,
          now - 86400 * 20,
          now - 86400 * 19,
          1
        ) as any;

      // Try to fetch results
      const result = await service.fetchWeekResults(weekId.lastInsertRowid as number);

      // Should fail gracefully
      expect(result.message).toBe('Season has ended');
      expect(result.participants_processed).toBe(0);
      expect(result.results_found).toBe(0);
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.summary[0].activity_found).toBe(false);
      expect(result.summary[0].reason).toContain('Season has ended');
    });

    it('should successfully fetch when season is still active', async () => {
      // Create an active season (started 30 days ago, ends 30 days from now)
      const activeSeasonId = db
        .prepare(
          `INSERT INTO season (name, start_at, end_at, is_active, created_at)
           VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
        )
        .run('Active Season', now - 86400 * 30, now + 86400 * 30) as any;

      // Create a segment
      db.prepare(
        `INSERT INTO segment (strava_segment_id, name, distance, average_grade)
         VALUES (?, ?, ?, ?)`
      ).run(12345, 'Test Segment', 2500, 6.5);

      // Create a week in the active season (yesterday)
      const weekId = db
        .prepare(
          `INSERT INTO week (season_id, week_name, strava_segment_id, start_at, end_at, required_laps, created_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        )
        .run(
          activeSeasonId.lastInsertRowid,
          'Active Week',
          12345,
          now - 86400,
          now - 86400 + 86400,
          1
        ) as any;

      // Try to fetch results
      const result = await service.fetchWeekResults(weekId.lastInsertRowid as number);

      // Should NOT fail on season validation
      // (will fail later with "No participants connected", which is expected in this test)
      expect(result.message).not.toBe('Season has ended');
      expect(result.participants_processed).toBe(0); // No participants, but season check passed
      expect(result.summary.length).toBe(0); // No summary entries for "no participants" case
    });

  });
});
