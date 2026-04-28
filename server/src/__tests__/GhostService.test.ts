import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
import { setupTestDb, teardownTestDb } from './setupTestDb';
import { createSeason, createSegment, createParticipant, createWeek, createResult } from './testDataHelpers';
import { GhostService } from '../services/GhostService';
import { isoToUnix } from '../dateUtils';

describe('GhostService', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let service: GhostService;

  beforeEach(async () => {
    const setup = setupTestDb({ seed: false });
    pool = setup.pool;
    orm = setup.orm;
    service = new GhostService(orm);
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  describe('getGhostData', () => {
    it('should return empty map if no previous week exists', async () => {
      const season = await createSeason(orm, 'Season 1');
      const segment = await createSegment(orm, 'seg1');
      const week = await createWeek(orm, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 1',
        startTime: '2025-01-01T00:00:00Z',
      });

      const ghostData = await service.getGhostData(week.id, segment.strava_segment_id, 1);
      expect(ghostData.size).toBe(0);
    });

    it('should return ghost data from the most recent previous week with same segment and laps', async () => {
      const season = await createSeason(orm, 'Season 1');
      const segment = await createSegment(orm, 'seg1');
      const participant = await createParticipant(orm, '123', 'Alice');

      // Previous week (Week 1)
      const week1 = await createWeek(orm, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 1',
        startTime: '2025-01-01T00:00:00Z',
        requiredLaps: 1,
      });
      await createResult(orm, {
        weekId: week1.id,
        stravaAthleteId: participant.strava_athlete_id,
        totalTimeSeconds: 100,
      });

      // Current week (Week 2)
      const week2 = await createWeek(orm, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 2',
        startTime: '2025-01-08T00:00:00Z',
        requiredLaps: 1,
      });

      const ghostData = await service.getGhostData(week2.id, segment.strava_segment_id, 1);
      
      expect(ghostData.size).toBe(1);
      expect(ghostData.get(participant.strava_athlete_id)).toEqual({
        previous_time_seconds: 100,
        previous_week_name: 'Week 1',
      });
    });

    it('should ignore weeks with different segments', async () => {
      const season = await createSeason(orm, 'Season 1');
      const segment1 = await createSegment(orm, 'seg1');
      const segment2 = await createSegment(orm, 'seg2');
      const participant = await createParticipant(orm, '123', 'Alice');

      // Week with different segment
      const week1 = await createWeek(orm, {
        seasonId: season.id,
        stravaSegmentId: segment2.strava_segment_id, // Different segment
        weekName: 'Week 1',
        startTime: '2025-01-01T00:00:00Z',
        requiredLaps: 1,
      });
      await createResult(orm, {
        weekId: week1.id,
        stravaAthleteId: participant.strava_athlete_id,
        totalTimeSeconds: 100,
      });

      // Current week
      const week2 = await createWeek(orm, {
        seasonId: season.id,
        stravaSegmentId: segment1.strava_segment_id,
        weekName: 'Week 2',
        startTime: '2025-01-08T00:00:00Z',
        requiredLaps: 1,
      });

      const ghostData = await service.getGhostData(week2.id, segment1.strava_segment_id, 1);
      expect(ghostData.size).toBe(0);
    });

    it('should ignore weeks with different required laps', async () => {
      const season = await createSeason(orm, 'Season 1');
      const segment = await createSegment(orm, 'seg1');
      const participant = await createParticipant(orm, '123', 'Alice');

      // Week with different laps
      const week1 = await createWeek(orm, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 1',
        startTime: '2025-01-01T00:00:00Z',
        requiredLaps: 2, // Different laps
      });
      await createResult(orm, {
        weekId: week1.id,
        stravaAthleteId: participant.strava_athlete_id,
        totalTimeSeconds: 100,
      });

      // Current week
      const week2 = await createWeek(orm, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 2',
        startTime: '2025-01-08T00:00:00Z',
        requiredLaps: 1,
      });

      const ghostData = await service.getGhostData(week2.id, segment.strava_segment_id, 1);
      expect(ghostData.size).toBe(0);
    });

    it('should pick the most recent previous week if multiple exist', async () => {
      const season = await createSeason(orm, 'Season 1');
      const segment = await createSegment(orm, 'seg1');
      const participant = await createParticipant(orm, '123', 'Alice');

      // Week 1 (Oldest)
      const week1 = await createWeek(orm, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 1',
        startTime: '2025-01-01T00:00:00Z',
        requiredLaps: 1,
      });
      await createResult(orm, {
        weekId: week1.id,
        stravaAthleteId: participant.strava_athlete_id,
        totalTimeSeconds: 100,
      });

      // Week 2 (More recent)
      const week2 = await createWeek(orm, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 2',
        startTime: '2025-01-08T00:00:00Z',
        requiredLaps: 1,
      });
      await createResult(orm, {
        weekId: week2.id,
        stravaAthleteId: participant.strava_athlete_id,
        totalTimeSeconds: 90, // Improved time
      });

      // Current week (Week 3)
      const week3 = await createWeek(orm, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 3',
        startTime: '2025-01-15T00:00:00Z',
        requiredLaps: 1,
      });

      const ghostData = await service.getGhostData(week3.id, segment.strava_segment_id, 1);
      
      expect(ghostData.size).toBe(1);
      expect(ghostData.get(participant.strava_athlete_id)).toEqual({
        previous_time_seconds: 90, // Should match Week 2
        previous_week_name: 'Week 2',
      });
    });

    it('should ignore weeks that start after the current week', async () => {
      const season = await createSeason(orm, 'Season 1');
      const segment = await createSegment(orm, 'seg1');
      const participant = await createParticipant(orm, '123', 'Alice');

      // Future week
      const weekFuture = await createWeek(orm, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Future Week',
        startTime: '2025-02-01T00:00:00Z',
        requiredLaps: 1,
      });
      await createResult(orm, {
        weekId: weekFuture.id,
        stravaAthleteId: participant.strava_athlete_id,
        totalTimeSeconds: 100,
      });

      // Current week
      const weekCurrent = await createWeek(orm, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Current Week',
        startTime: '2025-01-01T00:00:00Z',
        requiredLaps: 1,
      });

      const ghostData = await service.getGhostData(weekCurrent.id, segment.strava_segment_id, 1);
      expect(ghostData.size).toBe(0);
    });
  });
});
