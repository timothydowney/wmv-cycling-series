/**
 * WebhookProcessor.integration.test.ts
 * 
 * Integration tests for webhook processor with multiple season support.
 * Verifies that activities are correctly matched against multiple overlapping seasons.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import ActivityValidationService from '../services/ActivityValidationService';
import { setupTestDb } from './setupTestDb'; // Import setupTestDb
// import { SCHEMA } from '../schema'; // Removed

describe('Webhook Processor with Multiple Season Support', () => {
  let db: Database.Database;
  let validationService: ActivityValidationService;
  const now = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    // Create in-memory test database and run migrations
    const { db: newDb } = setupTestDb({ seed: false });
    db = newDb;
    // validationService needs the raw db instance
    validationService = new ActivityValidationService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Activity matching multiple overlapping seasons', () => {
    it('should find all matching seasons for activity timestamp', () => {
      // Create Fall 2025 season (Sept 1 - Nov 30)
      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Fall 2025', now - 86400 * 60, now + 86400 * 30);

      // Create Winter 2025 season (Nov 1 - Jan 31, overlaps with Fall)
      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Winter 2025', now - 86400 * 10, now + 86400 * 60);

      // Activity timestamp is Nov 15 (in both seasons)
      const activityTimestamp = now;

      // Get all seasons containing this timestamp
      const seasons = validationService.getAllActiveSeasonsContainingTimestamp(activityTimestamp);

      // Should find both Fall and Winter seasons
      expect(seasons.length).toBe(2);
      expect(seasons.map((s: any) => s.name)).toContain('Fall 2025');
      expect(seasons.map((s: any) => s.name)).toContain('Winter 2025');
    });

    it('should not process activity for closed seasons', () => {
      // Create a closed season (ended 10 days ago)
      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Closed Season', now - 86400 * 60, now - 86400 * 10);

      // Create an active season (ends in 30 days)
      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Active Season', now - 86400 * 30, now + 86400 * 30);

      // Activity timestamp is NOW (today)
      // This is AFTER Closed Season (not in it) but WITHIN Active Season
      const activityTimestamp = now;

      // Get all seasons containing this timestamp
      const seasons = validationService.getAllActiveSeasonsContainingTimestamp(activityTimestamp);
      
      // Should only find the Active Season
      expect(seasons.length).toBe(1);
      expect(seasons[0].name).toBe('Active Season');

      // Verify the Closed Season is actually closed
      const allSeasons = db.prepare('SELECT * FROM season').all() as any[];
      const closedSeason = allSeasons.find(s => s.name === 'Closed Season');
      const closedResult = validationService.isSeasonClosed(closedSeason);
      expect(closedResult.isClosed).toBe(true);
    });

    it('should handle activity in single season only', () => {
      // Create Fall season (Sept 1 - Nov 30)
      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Fall 2025', now - 86400 * 60, now + 86400 * 30);

      // Create Winter season (Jan 1 - March 31, no overlap with Fall)
      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Winter 2025', now + 86400 * 60, now + 86400 * 150);

      // Activity timestamp is in Fall only (now)
      const activityTimestamp = now;

      // Get all seasons
      const seasons = validationService.getAllActiveSeasonsContainingTimestamp(activityTimestamp);

      // Should find only Fall season
      expect(seasons.length).toBe(1);
      expect(seasons[0].name).toBe('Fall 2025');
    });

    it('should return empty array when activity not in any season', () => {
      // Create Fall season (Sept 1 - Nov 30)
      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Fall 2025', now - 86400 * 60, now - 86400 * 40);

      // Activity timestamp is in the future (after all seasons)
      const activityTimestamp = now + 86400 * 100;

      // Get all seasons
      const seasons = validationService.getAllActiveSeasonsContainingTimestamp(activityTimestamp);

      // Should find no seasons
      expect(seasons.length).toBe(0);
    });

    it('should maintain correct order with multiple overlapping seasons', () => {
      // Create three overlapping seasons with different start dates
      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Season 1', now - 86400 * 90, now + 86400 * 60);

      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Season 2', now - 86400 * 60, now + 86400 * 30);

      db.prepare(
        `INSERT INTO season (name, start_at, end_at, is_active, created_at)
         VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`
      ).run('Season 3', now - 86400 * 30, now + 86400 * 5);

      // Activity timestamp is now (in all three seasons)
      const activityTimestamp = now;

      // Get all seasons
      const seasons = validationService.getAllActiveSeasonsContainingTimestamp(activityTimestamp);

      // Should find all three
      expect(seasons.length).toBe(3);

      // Verify they're ordered by start_at DESC, id DESC
      // (most recently started first)
      expect(seasons[0].name).toBe('Season 3');
      expect(seasons[1].name).toBe('Season 2');
      expect(seasons[2].name).toBe('Season 1');
    });
  });
});
