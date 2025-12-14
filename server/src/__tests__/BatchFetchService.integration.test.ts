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
import { setupTestDb } from './setupTestDb';
import { createSegment, createSeason, createWeek } from './testDataHelpers';

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
    createSegment(drizzleDb, 999999, 'Test Segment', { distance: 2500, averageGrade: 6.5 });

    // Create service instance with mock token provider (reset for each test)
    service = new BatchFetchService(drizzleDb, async () => 'mock-token');
  });


  afterEach(() => {
    db.close();
  });

  describe('fetchWeekResults() with closed season', () => {
    it('should return error when trying to fetch for week in closed season', async () => {
      // Create a closed season (ended 1 day ago)
      const closedSeason = createSeason(drizzleDb, 'Closed Season', true, {
        startAt: now - 86400 * 30,
        endAt: now - 86400
      });

      // Create a segment
      const segment = createSegment(drizzleDb, 12345, 'Test Segment', { distance: 2500, averageGrade: 6.5 });

      // Create a week in the closed season
      const week = createWeek(drizzleDb, {
        seasonId: closedSeason.id,
        weekName: 'Closed Week',
        stravaSegmentId: 12345,
        startTime: new Date((now - 86400 * 20) * 1000).toISOString(),
        endTime: new Date((now - 86400 * 19) * 1000).toISOString(),
        requiredLaps: 1
      });

      // Try to fetch results
      const result = await service.fetchWeekResults(week.id);

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
      const activeSeason = createSeason(drizzleDb, 'Active Season', true, {
        startAt: now - 86400 * 30,
        endAt: now + 86400 * 30
      });

      // Create a segment
      const segment = createSegment(drizzleDb, 12345, 'Test Segment', { distance: 2500, averageGrade: 6.5 });

      // Create a week in the active season (yesterday)
      const week = createWeek(drizzleDb, {
        seasonId: activeSeason.id,
        weekName: 'Active Week',
        stravaSegmentId: 12345,
        startTime: new Date((now - 86400) * 1000).toISOString(),
        endTime: new Date((now - 86400 + 86400) * 1000).toISOString(),
        requiredLaps: 1
      });

      // Try to fetch results
      const result = await service.fetchWeekResults(week.id);

      // Should NOT fail on season validation
      // (will fail later with "No participants connected", which is expected in this test)
      expect(result.message).not.toBe('Season has ended');
      expect(result.participants_processed).toBe(0); // No participants, but season check passed
      expect(result.summary.length).toBe(0); // No summary entries for "no participants" case
    });

  });
});
