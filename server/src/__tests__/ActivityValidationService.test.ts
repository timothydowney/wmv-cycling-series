/**
 * ActivityValidationService.test.ts
 * Tests for reusable activity and season validation logic
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import Database from 'better-sqlite3';
import ActivityValidationService from '../services/ActivityValidationService';
import { setupTestDb } from './setupTestDb'; // Import setupTestDb
// import { SCHEMA } from '../schema'; // Removed

describe('ActivityValidationService', () => {
  let db: Database.Database;
  let service: ActivityValidationService;
  const now = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    const { db: newDb } = setupTestDb({ seed: false }); // Use setupTestDb with no seed
    db = newDb;
    // db.pragma('foreign_keys = ON'); // Handled by Drizzle migrations if needed
    // db.exec(SCHEMA); // Removed
    service = new ActivityValidationService(db);

    // Create test segments first (required for week foreign key)
    db.prepare(
      `INSERT INTO segment (strava_segment_id, name)
       VALUES (?, ?)`
    ).run(1, 'Test Segment 1');

    db.prepare(
      `INSERT INTO segment (strava_segment_id, name)
       VALUES (?, ?)`
    ).run(2, 'Test Segment 2');

    db.prepare(
      `INSERT INTO segment (strava_segment_id, name)
       VALUES (?, ?)`
    ).run(3, 'Test Segment 3');

    // Create test seasons
    // Season 1: Currently active (started in past, ends in future)
    db.prepare(
      `INSERT INTO season (name, start_at, end_at, is_active, created_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
    ).run('Active Season', now - 86400 * 30, now + 86400 * 30); // 30 days ago to 30 days from now

    // Season 2: Closed (ended in past)
    db.prepare(
      `INSERT INTO season (name, start_at, end_at, is_active, created_at)
       VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)`
    ).run('Closed Season', now - 86400 * 60, now - 86400 * 30); // Ended 30 days ago

    // Season 3: Not started yet
    db.prepare(
      `INSERT INTO season (name, start_at, end_at, is_active, created_at)
       VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)`
    ).run('Future Season', now + 86400 * 30, now + 86400 * 60); // Starts in 30 days
  });

  describe('isSeasonClosed()', () => {
    it('returns false when season end_at is in future', () => {
      const season = db.prepare('SELECT * FROM season WHERE name = ?').get('Active Season') as any;
      const result = service.isSeasonClosed(season);

      expect(result.isClosed).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('returns true when season end_at is in past', () => {
      const season = db.prepare('SELECT * FROM season WHERE name = ?').get('Closed Season') as any;
      const result = service.isSeasonClosed(season);

      expect(result.isClosed).toBe(true);
      expect(result.reason).toContain('Season ended at');
      expect(result.end_at).toBeLessThan(now);
    });

    it('returns false when end_at is null', () => {
      // Note: end_at NOT NULL in schema, so this tests the code path anyway
      const season: any = {
        id: 999,
        name: 'No End Season',
        start_at: now - 86400,
        end_at: null, // Hypothetically null (but schema doesn't allow)
        is_active: 1,
        created_at: new Date().toISOString()
      };

      const result = service.isSeasonClosed(season);

      expect(result.isClosed).toBe(false);
    });
  });

  describe('isSeasonOpen()', () => {
    it('returns isOpen=true when season is currently active', () => {
      const season = db.prepare('SELECT * FROM season WHERE name = ?').get('Active Season') as any;
      const result = service.isSeasonOpen(season);

      expect(result.isOpen).toBe(true);
      expect(result.isClosed).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('returns isOpen=false when season has not started', () => {
      const season = db.prepare('SELECT * FROM season WHERE name = ?').get('Future Season') as any;
      const result = service.isSeasonOpen(season);

      expect(result.isOpen).toBe(false);
      expect(result.isClosed).toBe(false);
      expect(result.reason).toContain("hasn't started yet");
    });

    it('returns isOpen=false, isClosed=true when season has ended', () => {
      const season = db.prepare('SELECT * FROM season WHERE name = ?').get('Closed Season') as any;
      const result = service.isSeasonOpen(season);

      expect(result.isOpen).toBe(false);
      expect(result.isClosed).toBe(true);
      expect(result.reason).toContain('has ended');
    });

    it('returns start_at and end_at in result', () => {
      const season = db.prepare('SELECT * FROM season WHERE name = ?').get('Active Season') as any;
      const result = service.isSeasonOpen(season);

      expect(result.start_at).toBeCloseTo(now - 86400 * 30, -1);
      expect(result.end_at).toBeCloseTo(now + 86400 * 30, -1);
    });
  });

  describe('isActivityWithinTimeWindow()', () => {
    const weekStart = now - 3600; // 1 hour ago
    const weekEnd = now + 3600; // 1 hour from now
    const week = { id: 1, start_at: weekStart, end_at: weekEnd };

    it('returns valid=true when activity is within window', () => {
      const activity = {
        id: 123,
        start_date: new Date(now * 1000).toISOString() // Right now
      };

      const result = service.isActivityWithinTimeWindow(activity, week);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns valid=false when activity is before window', () => {
      const activity = {
        id: 123,
        start_date: new Date((weekStart - 3600) * 1000).toISOString() // 1 hour before window start
      };

      const result = service.isActivityWithinTimeWindow(activity, week);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('outside week window');
    });

    it('returns valid=false when activity is after window', () => {
      const activity = {
        id: 123,
        start_date: new Date((weekEnd + 3600) * 1000).toISOString() // 1 hour after window end
      };

      const result = service.isActivityWithinTimeWindow(activity, week);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('outside week window');
    });

    it('accepts activity at exact window boundaries', () => {
      const activityAtStart = {
        id: 123,
        start_date: new Date(weekStart * 1000).toISOString()
      };
      const activityAtEnd = {
        id: 124,
        start_date: new Date(weekEnd * 1000).toISOString()
      };

      expect(service.isActivityWithinTimeWindow(activityAtStart, week).valid).toBe(true);
      expect(service.isActivityWithinTimeWindow(activityAtEnd, week).valid).toBe(true);
    });

    it('returns error for invalid start_date format', () => {
      const activity = {
        id: 123,
        start_date: 'invalid-date'
      };

      const result = service.isActivityWithinTimeWindow(activity, week);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid activity start_date format');
    });
  });

  describe('isActivityWithinSeasonRange()', () => {
    it('returns valid=true when activity is within season range', () => {
      const season = db.prepare('SELECT * FROM season WHERE name = ?').get('Active Season') as any;
      const activity = {
        id: 123,
        start_date: new Date(now * 1000).toISOString()
      };

      const result = service.isActivityWithinSeasonRange(activity, season);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns valid=false when activity is before season starts', () => {
      const season = db.prepare('SELECT * FROM season WHERE name = ?').get('Active Season') as any;
      const activity = {
        id: 123,
        start_date: new Date((season.start_at - 86400) * 1000).toISOString() // 1 day before season starts
      };

      const result = service.isActivityWithinSeasonRange(activity, season);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('before season starts');
    });

    it('returns valid=false when activity is after season ends', () => {
      const season = db.prepare('SELECT * FROM season WHERE name = ?').get('Active Season') as any;
      const activity = {
        id: 123,
        start_date: new Date((season.end_at + 86400) * 1000).toISOString() // 1 day after season ends
      };

      const result = service.isActivityWithinSeasonRange(activity, season);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('after season ended');
    });

    it('returns valid=true when season has no end_at', () => {
      // Note: end_at NOT NULL in schema, so use far future instead
      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('No End Season', now - 86400, now + 86400 * 365); // 1 year in future

      const noEndSeason = db.prepare('SELECT * FROM season WHERE name = ?').get('No End Season') as any;
      const activity = {
        id: 123,
        start_date: new Date((now + 86400 * 100) * 1000).toISOString() // 100 days from now (within season)
      };

      const result = service.isActivityWithinSeasonRange(activity, noEndSeason);

      expect(result.valid).toBe(true);
    });
  });

  describe('getActiveSeason()', () => {
    it('returns active season containing timestamp', () => {
      const season = service.getActiveSeason(now);

      expect(season).not.toBeNull();
      expect(season!.name).toBe('Active Season');
    });

    it('returns null when no season contains timestamp', () => {
      const futureTimestamp = now + 86400 * 100; // 100 days in future

      const season = service.getActiveSeason(futureTimestamp);

      expect(season).toBeNull();
    });

    it('returns most recent season when timestamp is in multiple seasons', () => {
      // Create two overlapping seasons, newer one has later start_at
      const season1Start = now - 86400 * 60; // 60 days ago
      const season1End = now + 86400 * 60; // 60 days from now (overlaps with season 2)

      const season2Start = now - 86400 * 30; // 30 days ago (more recent start)
      const season2End = now + 86400 * 90; // 90 days from now

      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Overlapping Season Older', season1Start, season1End);

      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Overlapping Season Newer', season2Start, season2End);

      const season = service.getActiveSeason(now);

      expect(season).not.toBeNull();
      // Should return the one with most recent start_at (season2Start > season1Start)
      expect(season!.name).toBe('Overlapping Season Newer');
    });

    it('returns season at exact boundaries', () => {
      const season1 = db.prepare('SELECT * FROM season WHERE name = ?').get('Active Season') as any;

      // Query well before future season starts (to avoid overlap)
      // Active Season: (now - 86400*30) to (now + 86400*30)
      // Query at start_at should return the season
      const seasonAtStart = service.getActiveSeason(season1.start_at);
      expect(seasonAtStart).not.toBeNull();
      expect(seasonAtStart!.id).toBe(season1.id);

      // Query in the middle of Active Season (well before Future Season start)
      // This avoids ambiguity from overlapping boundaries
      const midpoint = Math.floor((season1.start_at + season1.end_at) / 2);
      const seasonAtMid = service.getActiveSeason(midpoint);
      expect(seasonAtMid).not.toBeNull();
      expect(seasonAtMid!.id).toBe(season1.id);
    });
  });

  describe('getAllActiveSeasonsContainingTimestamp()', () => {
    it('returns all seasons containing timestamp (handles overlapping seasons)', () => {
      // Active Season already exists from beforeEach (now-30d to now+30d)
      // Create another overlapping season
      const overlapStart = now - 86400 * 10; // 10 days ago
      const overlapEnd = now + 86400 * 10; // 10 days from now

      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Overlap Season', overlapStart, overlapEnd);

      // Query at "now" should return both Active Season and Overlap Season
      const seasons = service.getAllActiveSeasonsContainingTimestamp(now);

      expect(seasons.length).toBe(2);
      // Should be ordered by start_at DESC, then id DESC (most recent start first)
      expect(seasons[0].name).toBe('Overlap Season'); // More recent start_at (now - 10d > now - 30d)
      expect(seasons[1].name).toBe('Active Season'); // Earlier start_at
    });

    it('returns single season when only one contains timestamp', () => {
      const seasons = service.getAllActiveSeasonsContainingTimestamp(now);

      // Only Active Season should contain "now"
      expect(seasons.length).toBe(1);
      expect(seasons[0].name).toBe('Active Season');
    });

    it('returns empty array when no seasons contain timestamp', () => {
      const futureTimestamp = now + 86400 * 100;

      const seasons = service.getAllActiveSeasonsContainingTimestamp(futureTimestamp);

      expect(seasons.length).toBe(0);
    });

    it('maintains correct order with multiple overlapping seasons', () => {
      // Create 2 additional seasons all containing "now"
      const earlyStart = now - 86400 * 60; // 60 days ago
      const earlyEnd = now + 86400 * 60; // 60 days from now

      const lateStart = now - 86400 * 5; // 5 days ago
      const lateEnd = now + 86400 * 25; // 25 days from now

      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Early Start Season', earlyStart, earlyEnd);

      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Late Start Season', lateStart, lateEnd);

      // Query for "now"
      const seasons = service.getAllActiveSeasonsContainingTimestamp(now);

      // Should return 3 seasons: Active Season, Early Start, Late Start
      expect(seasons.length).toBe(3);
      // Ordered by start_at DESC (most recent start first), then id DESC
      // Late Start (now-5d) > Active (now-30d) > Early (now-60d)
      expect(seasons[0].name).toBe('Late Start Season');
      expect(seasons[1].name).toBe('Active Season');
      expect(seasons[2].name).toBe('Early Start Season');
    });
  });

  describe('getWeeksForActivityInSeason()', () => {
    beforeEach(() => {
      // Get the "Active Season" ID to use as foreign key
      const result = db.prepare('SELECT id FROM season WHERE name = ?').get('Active Season') as any;
      const seasonId = result.id;

      // Create test weeks
      const weekStart = now - 3600;
      const weekEnd = now + 3600;

      db.prepare(
        `INSERT INTO week (season_id, week_name, strava_segment_id, start_at, end_at, required_laps, created_at)
         VALUES (?, ?, 1, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run(seasonId, 'Week 1', weekStart, weekEnd);

      db.prepare(
        `INSERT INTO week (season_id, week_name, strava_segment_id, start_at, end_at, required_laps, created_at)
         VALUES (?, ?, 2, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run(seasonId, 'Week 2', now + 86400, now + 86400 + 3600);
    });

    it('returns weeks containing activity timestamp', () => {
      const result = db.prepare('SELECT id FROM season WHERE name = ?').get('Active Season') as any;
      const seasonId = result.id;

      const weeks = service.getWeeksForActivityInSeason(seasonId, now);

      expect(weeks.length).toBe(1);
      expect(weeks[0].week_name).toBe('Week 1');
    });

    it('returns empty array when no weeks contain timestamp', () => {
      const result = db.prepare('SELECT id FROM season WHERE name = ?').get('Active Season') as any;
      const seasonId = result.id;
      const futureTimestamp = now + 86400 * 100; // Way in future

      const weeks = service.getWeeksForActivityInSeason(seasonId, futureTimestamp);

      expect(weeks.length).toBe(0);
    });

    it('returns weeks in order by start_at', () => {
      const result = db.prepare('SELECT id FROM season WHERE name = ?').get('Active Season') as any;
      const seasonId = result.id;
      const midpoint = now + 86400 + 1800; // Between week 1 and week 2

      // Create overlapping week
      db.prepare(
        `INSERT INTO week (season_id, week_name, strava_segment_id, start_at, end_at, required_laps, created_at)
         VALUES (?, ?, 3, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run(seasonId, 'Week Overlap', now + 86400, now + 86400 + 7200);

      const weeks = service.getWeeksForActivityInSeason(seasonId, midpoint);

      expect(weeks[0].week_name).toBe('Week 2');
      expect(weeks[1].week_name).toBe('Week Overlap');
    });
  });

  describe('isEventInFuture()', () => {
    it('returns isFuture=true when event is in future', () => {
      const futureTimestamp = now + 86400; // Tomorrow

      const result = service.isEventInFuture(futureTimestamp);

      expect(result.isFuture).toBe(true);
      expect(result.message).toContain('future');
    });

    it('returns isFuture=false when event is in past', () => {
      const pastTimestamp = now - 86400; // Yesterday

      const result = service.isEventInFuture(pastTimestamp);

      expect(result.isFuture).toBe(false);
      expect(result.message).toBeUndefined();
    });

    it('returns isFuture=false when event is now', () => {
      const result = service.isEventInFuture(now);

      expect(result.isFuture).toBe(false);
    });
  });
});
