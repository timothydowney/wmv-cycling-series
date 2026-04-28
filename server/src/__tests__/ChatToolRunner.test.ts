import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
/**
 * ChatToolRunner.test.ts
 *
 * Tests for the ChatToolRunner service which executes
 * tool calls requested by the Gemini model.
 */

import { ChatToolRunner } from '../services/ChatToolRunner';
import {
  setupTestDb,
  teardownTestDb,
  SeedData,
  createParticipant,
  createSeason,
  createSegment,
  createWeek,
  createResult,
  createActivityWithResult,
} from './testDataHelpers';

describe('ChatToolRunner', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let runner: ChatToolRunner;

  beforeAll(async () => {
    const setup = setupTestDb({ seed: false });
    pool = setup.pool;
    orm = setup.orm;
    runner = new ChatToolRunner(orm);
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  // Seed basic data before each test group
  let seasonId: number;
  let weekId: number;

  beforeAll(async () => {
    // Create test data
    const season = await createSeason(orm, 'Fall 2025', true);
    seasonId = season.id;

    const seg = await createSegment(orm, 'seg001', 'Mountain Loop', {
      averageGrade: 5.0,
      distance: 3200,
    });

    const wk = await createWeek(orm, {
      seasonId: season.id,
      stravaSegmentId: seg.strava_segment_id,
      weekName: 'Week 1 - Mountain Loop',
      requiredLaps: 1,
    });
    weekId = wk.id;

    await createParticipant(orm, 'athlete1', 'Alice Smith', false);
    await createParticipant(orm, 'athlete2', 'Bob Johnson', false);

    await createActivityWithResult(orm, {
      weekId: wk.id,
      stravaAthleteId: 'athlete1',
      stravaActivityId: 'act001',
      elapsedSeconds: 600,
    });

    await createActivityWithResult(orm, {
      weekId: wk.id,
      stravaAthleteId: 'athlete2',
      stravaActivityId: 'act002',
      elapsedSeconds: 720,
    });
  });

  describe('list_seasons', () => {
    it('should return all seasons', async () => {
      const result = await runner.execute('list_seasons', {});
      expect(Array.isArray(result)).toBe(true);
      const seasons = result as { id: number; name: string }[];
      expect(seasons.length).toBeGreaterThanOrEqual(1);
      expect(seasons.some(s => s.name === 'Fall 2025')).toBe(true);
    });
  });

  describe('get_current_season', () => {
    it('should return the current or most recent season', async () => {
      const result = await runner.execute('get_current_season', {}) as Record<string, unknown>;
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
    });
  });

  describe('get_season_weeks', () => {
    it('should return weeks for a season', async () => {
      const result = await runner.execute('get_season_weeks', { season_id: seasonId });
      expect(Array.isArray(result)).toBe(true);
      const weeks = result as { id: number; name: string }[];
      expect(weeks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('get_week_leaderboard', () => {
    it('should return leaderboard for a week', async () => {
      const result = await runner.execute('get_week_leaderboard', { week_id: weekId }) as Record<string, unknown>;
      expect(result).toHaveProperty('week');
      expect(result).toHaveProperty('leaderboard');
      const leaderboard = (result as { leaderboard: { rank: number; name: string }[] }).leaderboard;
      expect(leaderboard.length).toBe(2);
      // Faster time (600s) should be rank 1
      expect(leaderboard[0].name).toBe('Alice Smith');
    });
  });

  describe('get_season_standings', () => {
    it('should return standings for a season', async () => {
      const result = await runner.execute('get_season_standings', { season_id: seasonId });
      expect(Array.isArray(result)).toBe(true);
      const standings = result as { rank: number; name: string; total_points: number }[];
      expect(standings.length).toBe(2);
    });
  });

  describe('list_participants', () => {
    it('should return all participants', async () => {
      const result = await runner.execute('list_participants', {});
      expect(Array.isArray(result)).toBe(true);
      const participants = result as { name: string }[];
      expect(participants.some(p => p.name === 'Alice Smith')).toBe(true);
      expect(participants.some(p => p.name === 'Bob Johnson')).toBe(true);
    });
  });

  describe('get_participant_profile', () => {
    it('should return profile for a known athlete', async () => {
      const result = await runner.execute('get_participant_profile', { athlete_name: 'Alice' }) as Record<string, unknown>;
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('season_stats');
    });

    it('should return error for unknown athlete', async () => {
      const result = await runner.execute('get_participant_profile', { athlete_name: 'Nonexistent Person' }) as Record<string, unknown>;
      expect(result).toHaveProperty('error');
    });
  });

  describe('compare_athletes', () => {
    it('should compare athletes in a specific week', async () => {
      const result = await runner.execute('compare_athletes', {
        athlete_names: ['Alice', 'Bob'],
        week_id: weekId,
      }) as Record<string, unknown>;
      expect(result).toHaveProperty('comparison');
      const comparison = (result as { comparison: { name: string; rank: number }[] }).comparison;
      expect(comparison.length).toBe(2);
    });

    it('should return error for unknown athlete names', async () => {
      const result = await runner.execute('compare_athletes', {
        athlete_names: ['Alice', 'Unknown Person'],
      }) as Record<string, unknown>;
      expect(result).toHaveProperty('errors');
    });
  });

  describe('get_effort_details', () => {
    it('should return effort details for a specific athlete and week', async () => {
      const result = await runner.execute('get_effort_details', {
        week_id: weekId,
        athlete_name: 'Alice',
      }) as Record<string, unknown>;
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('laps');
    });

    it('should return error for athlete not in that week', async () => {
      // Create a new participant with no activity in this week
      await createParticipant(orm, 'athlete3', 'Charlie Nodata', false);
      const result = await runner.execute('get_effort_details', {
        week_id: weekId,
        athlete_name: 'Charlie',
      }) as Record<string, unknown>;
      expect(result).toHaveProperty('error');
    });
  });

  describe('get_jersey_winners', () => {
    it('should return jersey winners for a season', async () => {
      const result = await runner.execute('get_jersey_winners', { season_id: seasonId }) as Record<string, unknown>;
      expect(result).toHaveProperty('yellow_jersey');
      expect(result).toHaveProperty('polka_dot_jersey');
    });
  });

  describe('get_segment_records', () => {
    it('should return records for a known segment', async () => {
      const result = await runner.execute('get_segment_records', { segment_name: 'Mountain' });
      expect(Array.isArray(result)).toBe(true);
      const records = result as { name: string; time_seconds: number }[];
      expect(records.length).toBeGreaterThanOrEqual(1);
    });

    it('should return error for unknown segment', async () => {
      const result = await runner.execute('get_segment_records', { segment_name: 'ZZZNonexistent' }) as Record<string, unknown>;
      expect(result).toHaveProperty('error');
    });
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool name', async () => {
      const result = await runner.execute('nonexistent_tool', {}) as Record<string, unknown>;
      expect(result).toHaveProperty('error');
      expect((result as { error: string }).error).toContain('Unknown tool');
    });
  });

  describe('fuzzy name matching', () => {
    it('should match partial names case-insensitively', async () => {
      const result = await runner.execute('get_participant_profile', { athlete_name: 'alice' }) as Record<string, unknown>;
      expect(result).toHaveProperty('name');
      expect((result as { name: string }).name).toBe('Alice Smith');
    });

    it('should match by last name', async () => {
      const result = await runner.execute('get_participant_profile', { athlete_name: 'Johnson' }) as Record<string, unknown>;
      expect(result).toHaveProperty('name');
      expect((result as { name: string }).name).toBe('Bob Johnson');
    });
  });
});
