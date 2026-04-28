import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
/**
 * WebhookProcessor.integration.test.ts
 * 
 * Integration tests for webhook processor with multiple season support.
 * Verifies that activities are correctly matched against multiple overlapping seasons.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActivityValidationService from '../services/ActivityValidationService';
import { setupTestDb, teardownTestDb } from './setupTestDb';
import { season } from '../db/schema';

describe('Webhook Processor with Multiple Season Support', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let validationService: ActivityValidationService;
  const now = Math.floor(Date.now() / 1000);

  beforeEach(async () => {
    // Create in-memory test database and run migrations
    const setup = setupTestDb({ seed: false });
    pool = setup.pool;
    orm = setup.orm;
    // validationService now uses Drizzle ORM
    validationService = new ActivityValidationService(orm);
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  describe('Activity matching multiple overlapping seasons', () => {
    it('should find all matching seasons for activity timestamp', async () => {
      // Create Fall 2025 season (Sept 1 - Nov 30)
      await orm.insert(season).values({
        name: 'Fall 2025',
        start_at: now - 86400 * 60,
        end_at: now + 86400 * 30,
      }).execute();

      // Create Winter 2025 season (Nov 1 - Jan 31, overlaps with Fall)
      await orm.insert(season).values({
        name: 'Winter 2025',
        start_at: now - 86400 * 10,
        end_at: now + 86400 * 60,
      }).execute();

      // Activity timestamp is Nov 15 (in both seasons)
      const activityTimestamp = now;

      // Get all seasons containing this timestamp
      const seasons = await validationService.getAllActiveSeasonsContainingTimestamp(activityTimestamp);

      // Should find both Fall and Winter seasons
      expect(seasons.length).toBe(2);
      expect(seasons.map((s: any) => s.name)).toContain('Fall 2025');
      expect(seasons.map((s: any) => s.name)).toContain('Winter 2025');
    });

    it('should not process activity for closed seasons', async () => {
      // Create a closed season (ended 10 days ago)
      await orm.insert(season).values({
        name: 'Closed Season',
        start_at: now - 86400 * 60,
        end_at: now - 86400 * 10,
      }).execute();

      // Create an active season (ends in 30 days)
      await orm.insert(season).values({
        name: 'Active Season',
        start_at: now - 86400 * 30,
        end_at: now + 86400 * 30,
      }).execute();

      // Activity timestamp is NOW (today)
      // This is AFTER Closed Season (not in it) but WITHIN Active Season
      const activityTimestamp = now;

      // Get all seasons containing this timestamp
      const seasons = await validationService.getAllActiveSeasonsContainingTimestamp(activityTimestamp);
      
      // Should only find the Active Season
      expect(seasons.length).toBe(1);
      expect(seasons[0].name).toBe('Active Season');

      // Verify the Closed Season is actually closed
      const allSeasons = await orm.select().from(season).execute();
      const closedSeason = allSeasons.find(s => s.name === 'Closed Season');
      expect(closedSeason).toBeDefined();
      const closedResult = validationService.isSeasonClosed(closedSeason!);
      expect(closedResult.isClosed).toBe(true);
    });

    it('should handle activity in single season only', async () => {
      // Create Fall season (Sept 1 - Nov 30)
      await orm.insert(season).values({
        name: 'Fall 2025',
        start_at: now - 86400 * 60,
        end_at: now + 86400 * 30,
      }).execute();

      // Create Winter season (Jan 1 - March 31, no overlap with Fall)
      await orm.insert(season).values({
        name: 'Winter 2025',
        start_at: now + 86400 * 60,
        end_at: now + 86400 * 150,
      }).execute();

      // Activity timestamp is in Fall only (now)
      const activityTimestamp = now;

      // Get all seasons
      const seasons = await validationService.getAllActiveSeasonsContainingTimestamp(activityTimestamp);

      // Should find only Fall season
      expect(seasons.length).toBe(1);
      expect(seasons[0].name).toBe('Fall 2025');
    });

    it('should return empty array when activity not in any season', async () => {
      // Create Fall season (Sept 1 - Nov 30)
      await orm.insert(season).values({
        name: 'Fall 2025',
        start_at: now - 86400 * 60,
        end_at: now - 86400 * 40,
      }).execute();

      // Activity timestamp is in the future (after all seasons)
      const activityTimestamp = now + 86400 * 100;

      // Get all seasons
      const seasons = await validationService.getAllActiveSeasonsContainingTimestamp(activityTimestamp);

      // Should find no seasons
      expect(seasons.length).toBe(0);
    });

    it('should maintain correct order with multiple overlapping seasons', async () => {
      // Create three overlapping seasons with different start dates
      await orm.insert(season).values({
        name: 'Season 1',
        start_at: now - 86400 * 90,
        end_at: now + 86400 * 60,
      }).execute();

      await orm.insert(season).values({
        name: 'Season 2',
        start_at: now - 86400 * 60,
        end_at: now + 86400 * 30,
      }).execute();

      await orm.insert(season).values({
        name: 'Season 3',
        start_at: now - 86400 * 30,
        end_at: now + 86400 * 5,
      }).execute();

      // Activity timestamp is now (in all three seasons)
      const activityTimestamp = now;

      // Get all seasons
      const seasons = await validationService.getAllActiveSeasonsContainingTimestamp(activityTimestamp);

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
