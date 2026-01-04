import { setupTestDb } from './setupTestDb';
import { createSeason, createSegment, createParticipant, createWeek, createResult } from './testDataHelpers';
import { GhostService } from '../services/GhostService';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type Database from 'better-sqlite3';
import { isoToUnix } from '../dateUtils';

describe('GhostService', () => {
  let db: Database.Database;
  let drizzleDb: BetterSQLite3Database;
  let service: GhostService;

  beforeEach(() => {
    const setup = setupTestDb({ seed: false });
    db = setup.db;
    drizzleDb = setup.drizzleDb;
    service = new GhostService(drizzleDb);
  });

  afterEach(() => {
    db.close();
  });

  describe('getGhostData', () => {
    it('should return empty map if no previous week exists', async () => {
      const season = createSeason(drizzleDb, 'Season 1');
      const segment = createSegment(drizzleDb, 'seg1');
      const week = createWeek(drizzleDb, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 1',
        startTime: '2025-01-01T00:00:00Z',
      });

      const ghostData = await service.getGhostData(week.id, segment.strava_segment_id, 1);
      expect(ghostData.size).toBe(0);
    });

    it('should return ghost data from the most recent previous week with same segment and laps', async () => {
      const season = createSeason(drizzleDb, 'Season 1');
      const segment = createSegment(drizzleDb, 'seg1');
      const participant = createParticipant(drizzleDb, '123', 'Alice');

      // Previous week (Week 1)
      const week1 = createWeek(drizzleDb, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 1',
        startTime: '2025-01-01T00:00:00Z',
        requiredLaps: 1,
      });
      createResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: participant.strava_athlete_id,
        totalTimeSeconds: 100,
      });

      // Current week (Week 2)
      const week2 = createWeek(drizzleDb, {
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
      const season = createSeason(drizzleDb, 'Season 1');
      const segment1 = createSegment(drizzleDb, 'seg1');
      const segment2 = createSegment(drizzleDb, 'seg2');
      const participant = createParticipant(drizzleDb, '123', 'Alice');

      // Week with different segment
      const week1 = createWeek(drizzleDb, {
        seasonId: season.id,
        stravaSegmentId: segment2.strava_segment_id, // Different segment
        weekName: 'Week 1',
        startTime: '2025-01-01T00:00:00Z',
        requiredLaps: 1,
      });
      createResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: participant.strava_athlete_id,
        totalTimeSeconds: 100,
      });

      // Current week
      const week2 = createWeek(drizzleDb, {
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
      const season = createSeason(drizzleDb, 'Season 1');
      const segment = createSegment(drizzleDb, 'seg1');
      const participant = createParticipant(drizzleDb, '123', 'Alice');

      // Week with different laps
      const week1 = createWeek(drizzleDb, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 1',
        startTime: '2025-01-01T00:00:00Z',
        requiredLaps: 2, // Different laps
      });
      createResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: participant.strava_athlete_id,
        totalTimeSeconds: 100,
      });

      // Current week
      const week2 = createWeek(drizzleDb, {
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
      const season = createSeason(drizzleDb, 'Season 1');
      const segment = createSegment(drizzleDb, 'seg1');
      const participant = createParticipant(drizzleDb, '123', 'Alice');

      // Week 1 (Oldest)
      const week1 = createWeek(drizzleDb, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 1',
        startTime: '2025-01-01T00:00:00Z',
        requiredLaps: 1,
      });
      createResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: participant.strava_athlete_id,
        totalTimeSeconds: 100,
      });

      // Week 2 (More recent)
      const week2 = createWeek(drizzleDb, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Week 2',
        startTime: '2025-01-08T00:00:00Z',
        requiredLaps: 1,
      });
      createResult(drizzleDb, {
        weekId: week2.id,
        stravaAthleteId: participant.strava_athlete_id,
        totalTimeSeconds: 90, // Improved time
      });

      // Current week (Week 3)
      const week3 = createWeek(drizzleDb, {
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
      const season = createSeason(drizzleDb, 'Season 1');
      const segment = createSegment(drizzleDb, 'seg1');
      const participant = createParticipant(drizzleDb, '123', 'Alice');

      // Future week
      const weekFuture = createWeek(drizzleDb, {
        seasonId: season.id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Future Week',
        startTime: '2025-02-01T00:00:00Z',
        requiredLaps: 1,
      });
      createResult(drizzleDb, {
        weekId: weekFuture.id,
        stravaAthleteId: participant.strava_athlete_id,
        totalTimeSeconds: 100,
      });

      // Current week
      const weekCurrent = createWeek(drizzleDb, {
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
