import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
/**
 * Activity Storage Tests
 * Tests for activity and segment effort persistence using Drizzle ORM
 */

import { setupTestDb, teardownTestDb } from './setupTestDb';
import { storeActivityAndEfforts, type ActivityToStore } from '../activityStorage';
import { createParticipant, createSeason, createSegment, createWeek } from './testDataHelpers';
import { activity, segmentEffort, result } from '../db/schema';

describe('Activity Storage', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let testAthleteId: string;
  let testWeekId: number;
  let testSegmentId: string;

  beforeEach(async () => {
    const setup = setupTestDb({ seed: false });
    pool = setup.pool;
    orm = setup.orm;

    // Create test data
    testAthleteId = '12345678';
    testSegmentId = '98765432';
    
    await createParticipant(orm, testAthleteId, 'Test User');
    const season = await createSeason(orm, 'Test Season');
    const segment = await createSegment(orm, testSegmentId, 'Test Segment');
    const week = await createWeek(orm, {
      seasonId: season.id,
      stravaSegmentId: segment.strava_segment_id,
      weekName: 'Test Week'
    });
    testWeekId = week.id;
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  describe('storeActivityAndEfforts', () => {
    it('should store activity and segment efforts when no existing activity', async () => {
      const activityData: ActivityToStore = {
        id: '9876543210',
        start_date: '2025-06-01T10:00:00Z',
        device_name: 'Garmin Edge 530',
        segmentEfforts: [
          {
            id: '1111111111',
            start_date: '2025-06-01T10:05:00Z',
            elapsed_time: 720
          },
          {
            id: '2222222222',
            start_date: '2025-06-01T10:07:00Z',
            elapsed_time: 710,
            pr_rank: 1 // PR achieved
          }
        ],
        totalTime: 1430
      };

      await storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      // Verify activity was inserted
      const activities = await orm.select().from(activity).execute();
      expect(activities).toHaveLength(1);
      expect(activities[0].strava_activity_id).toBe('9876543210');
      expect(activities[0].week_id).toBe(testWeekId);
      expect(activities[0].strava_athlete_id).toBe(testAthleteId);

      // Verify segment efforts were inserted
      const efforts = await orm.select().from(segmentEffort).execute();
      expect(efforts).toHaveLength(2);
      expect(efforts[0].elapsed_seconds).toBe(720);
      expect(efforts[0].pr_achieved).toBe(0);
      expect(efforts[1].elapsed_seconds).toBe(710);
      expect(efforts[1].pr_achieved).toBe(1);

      // Verify result was stored
      const results = await orm.select().from(result).execute();
      expect(results).toHaveLength(1);
      expect(results[0].total_time_seconds).toBe(1430);
    });


    it('should delete existing activity and efforts before storing new ones', async () => {
      // First, store an activity
      const firstActivity: ActivityToStore = {
        id: '9876543210',
        start_date: '2025-06-01T10:00:00Z',
        device_name: 'Garmin Edge 530',
        segmentEfforts: [
          {
            id: '1111111111',
            start_date: '2025-06-01T10:05:00Z',
            elapsed_time: 720
          }
        ],
        totalTime: 720
      };

      await storeActivityAndEfforts(orm, testAthleteId, testWeekId, firstActivity, testSegmentId);

      // Verify initial state
      expect(await orm.select().from(activity).execute()).toHaveLength(1);
      expect(await orm.select().from(segmentEffort).execute()).toHaveLength(1);
      expect(await orm.select().from(result).execute()).toHaveLength(1);

      // Now store a different activity (should replace the old one)
      const secondActivity: ActivityToStore = {
        id: '9876543211',
        start_date: '2025-06-01T11:00:00Z',
        segmentEfforts: [
          {
            id: '3333333333',
            start_date: '2025-06-01T11:05:00Z',
            elapsed_time: 650
          }
        ],
        totalTime: 650
      };

      await storeActivityAndEfforts(orm, testAthleteId, testWeekId, secondActivity, testSegmentId);

      // Verify old data was replaced
      const activities = await orm.select().from(activity).execute();
      expect(activities).toHaveLength(1);
      expect(activities[0].strava_activity_id).toBe('9876543211');

      const efforts = await orm.select().from(segmentEffort).execute();
      expect(efforts).toHaveLength(1);
      expect(efforts[0].strava_effort_id).toBe('3333333333');

      const results = await orm.select().from(result).execute();
      expect(results).toHaveLength(1);
      expect(results[0].total_time_seconds).toBe(650);
    });

    it('should handle activity with no device name', async () => {
      const activityData: ActivityToStore = {
        id: '9876543212',
        start_date: '2025-06-01T12:00:00Z',
        device_name: undefined,
        segmentEfforts: [
          {
            id: '4444444444',
            start_date: '2025-06-01T12:05:00Z',
            elapsed_time: 680
          }
        ],
        totalTime: 680
      };

      await storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      const activities = await orm.select().from(activity).execute();
      expect(activities).toHaveLength(1);
      expect(activities[0].device_name).toBeNull();
    });

    it('should handle multiple segment efforts correctly', async () => {
      const activityData: ActivityToStore = {
        id: '9876543213',
        start_date: '2025-06-01T13:00:00Z',
        device_name: 'Garmin Edge 1030+',
        segmentEfforts: [
          {
            id: '5555555555',
            start_date: '2025-06-01T13:05:00Z',
            elapsed_time: 600,
            pr_rank: 1
          },
          {
            id: '6666666666',
            start_date: '2025-06-01T13:15:00Z',
            elapsed_time: 590,
            pr_rank: 2
          },
          {
            id: '7777777777',
            start_date: '2025-06-01T13:25:00Z',
            elapsed_time: 595
          }
        ],
        totalTime: 1785
      };

      await storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      const efforts = await orm.select().from(segmentEffort).execute();
      expect(efforts).toHaveLength(3);
      expect(efforts[0].effort_index).toBe(0);
      expect(efforts[0].elapsed_seconds).toBe(600);
      expect(efforts[0].pr_achieved).toBe(1);
      expect(efforts[1].effort_index).toBe(1);
      expect(efforts[1].elapsed_seconds).toBe(590);
      expect(efforts[1].pr_achieved).toBe(0); // pr_rank = 2 means not fastest ever
      expect(efforts[2].effort_index).toBe(2);
      expect(efforts[2].elapsed_seconds).toBe(595);
      expect(efforts[2].pr_achieved).toBe(0);
    });

    it('should convert pr_rank to boolean correctly (truthy = 1, falsy = 0)', async () => {
      const activityData: ActivityToStore = {
        id: '9876543214',
        start_date: '2025-06-01T14:00:00Z',
        segmentEfforts: [
          {
            id: '8888888888',
            start_date: '2025-06-01T14:05:00Z',
            elapsed_time: 700,
            pr_rank: 1
          },
          {
            id: '9999999999',
            start_date: '2025-06-01T14:15:00Z',
            elapsed_time: 710
          },
          {
            id: '1010101010',
            start_date: '2025-06-01T14:25:00Z',
            elapsed_time: 705,
            pr_rank: 0
          }
        ],
        totalTime: 2115
      };

      await storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      const efforts = await orm.select().from(segmentEffort).execute();
      expect(efforts[0].pr_achieved).toBe(1); // pr_rank = 1 → truthy
      expect(efforts[1].pr_achieved).toBe(0); // pr_rank = null → falsy
      expect(efforts[2].pr_achieved).toBe(0); // pr_rank = 0 → falsy
    });

    it('should store result with correct total time', async () => {
      const activityData: ActivityToStore = {
        id: '9876543215',
        start_date: '2025-06-01T15:00:00Z',
        device_name: 'Wahoo Elemnt',
        segmentEfforts: [
          {
            id: '1212121212',
            start_date: '2025-06-01T15:05:00Z',
            elapsed_time: 1420
          }
        ],
        totalTime: 1420
      };

      await storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      const results = await orm.select().from(result).execute();
      expect(results).toHaveLength(1);
      expect(results[0].total_time_seconds).toBe(1420);
      expect(results[0].week_id).toBe(testWeekId);
      expect(results[0].strava_athlete_id).toBe(testAthleteId);
    });

    it('should handle transactional rollback on error', async () => {
      const activityData: ActivityToStore = {
        id: '9876543216',
        start_date: '2025-06-01T16:00:00Z',
        device_name: 'Test Device',
        segmentEfforts: [
          {
            id: '1313131313',
            start_date: '2025-06-01T16:05:00Z',
            elapsed_time: 750
          }
        ],
        totalTime: 750
      };

      const forcedFailure = new Error('forced transaction failure');
      const failingDb = {
        ...orm,
        transaction: async () => {
          throw forcedFailure;
        },
      } as unknown as AppDatabase;

      // Expect the operation to fail
      await expect(
        storeActivityAndEfforts(failingDb, testAthleteId, testWeekId, activityData, testSegmentId)
      ).rejects.toThrow('forced transaction failure');
    });

    it('should store activity with athlete weight', async () => {
      const activityData: ActivityToStore = {
        id: '9876543210',
        start_date: '2025-06-01T10:00:00Z',
        device_name: 'Garmin Edge 530',
        segmentEfforts: [
          {
            id: '1111111111',
            start_date: '2025-06-01T10:05:00Z',
            elapsed_time: 720
          }
        ],
        totalTime: 720,
        athleteWeight: 70.5  // Include weight
      };

      await storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      // Verify activity was stored with weight
      const activities = await orm.select().from(activity).execute();
      expect(activities).toHaveLength(1);
      expect(activities[0].athlete_weight).toBe(70.5);
    });

    it('should store activity with null weight when not provided', async () => {
      const activityData: ActivityToStore = {
        id: '9876543210',
        start_date: '2025-06-01T10:00:00Z',
        device_name: 'Garmin Edge 530',
        segmentEfforts: [
          {
            id: '1111111111',
            start_date: '2025-06-01T10:05:00Z',
            elapsed_time: 720
          }
        ],
        totalTime: 720
        // No athleteWeight provided
      };

      await storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      // Verify activity was stored with null weight
      const activities = await orm.select().from(activity).execute();
      expect(activities).toHaveLength(1);
      expect(activities[0].athlete_weight).toBeNull();
    });
  });
});
