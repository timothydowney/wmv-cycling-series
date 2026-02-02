/**
 * Activity Storage Tests
 * Tests for activity and segment effort persistence using Drizzle ORM
 */

import { setupTestDb } from './setupTestDb';
import { storeActivityAndEfforts, type ActivityToStore } from '../activityStorage';
import { createParticipant, createSeason, createSegment, createWeek } from './testDataHelpers';
import { activity, segmentEffort, result } from '../db/schema';
import Database from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

describe('Activity Storage', () => {
  let db: Database.Database;
  let orm: BetterSQLite3Database;
  let testAthleteId: string;
  let testWeekId: number;
  let testSegmentId: string;

  beforeEach(() => {
    const setup = setupTestDb({ seed: false });
    db = setup.db;
    orm = setup.orm;

    // Create test data
    testAthleteId = '12345678';
    testSegmentId = '98765432';
    
    createParticipant(orm, testAthleteId, 'Test User');
    const season = createSeason(orm, 'Test Season');
    const segment = createSegment(orm, testSegmentId, 'Test Segment');
    const week = createWeek(orm, {
      seasonId: season.id,
      stravaSegmentId: segment.strava_segment_id,
      weekName: 'Test Week'
    });
    testWeekId = week.id;
  });

  afterEach(() => {
    db.close();
  });

  describe('storeActivityAndEfforts', () => {
    it('should store activity and segment efforts when no existing activity', () => {
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

      storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      // Verify activity was inserted
      const activities = orm.select().from(activity).all();
      expect(activities).toHaveLength(1);
      expect(activities[0].strava_activity_id).toBe('9876543210');
      expect(activities[0].week_id).toBe(testWeekId);
      expect(activities[0].strava_athlete_id).toBe(testAthleteId);

      // Verify segment efforts were inserted
      const efforts = orm.select().from(segmentEffort).all();
      expect(efforts).toHaveLength(2);
      expect(efforts[0].elapsed_seconds).toBe(720);
      expect(efforts[0].pr_achieved).toBe(0);
      expect(efforts[1].elapsed_seconds).toBe(710);
      expect(efforts[1].pr_achieved).toBe(1);

      // Verify result was stored
      const results = orm.select().from(result).all();
      expect(results).toHaveLength(1);
      expect(results[0].total_time_seconds).toBe(1430);
    });


    it('should delete existing activity and efforts before storing new ones', () => {
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

      storeActivityAndEfforts(orm, testAthleteId, testWeekId, firstActivity, testSegmentId);

      // Verify initial state
      expect(orm.select().from(activity).all()).toHaveLength(1);
      expect(orm.select().from(segmentEffort).all()).toHaveLength(1);
      expect(orm.select().from(result).all()).toHaveLength(1);

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

      storeActivityAndEfforts(orm, testAthleteId, testWeekId, secondActivity, testSegmentId);

      // Verify old data was replaced
      const activities = orm.select().from(activity).all();
      expect(activities).toHaveLength(1);
      expect(activities[0].strava_activity_id).toBe('9876543211');

      const efforts = orm.select().from(segmentEffort).all();
      expect(efforts).toHaveLength(1);
      expect(efforts[0].strava_effort_id).toBe('3333333333');

      const results = orm.select().from(result).all();
      expect(results).toHaveLength(1);
      expect(results[0].total_time_seconds).toBe(650);
    });

    it('should handle activity with no device name', () => {
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

      storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      const activities = orm.select().from(activity).all();
      expect(activities).toHaveLength(1);
      expect(activities[0].device_name).toBeNull();
    });

    it('should handle multiple segment efforts correctly', () => {
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

      storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      const efforts = orm.select().from(segmentEffort).all();
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

    it('should convert pr_rank to boolean correctly (truthy = 1, falsy = 0)', () => {
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

      storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      const efforts = orm.select().from(segmentEffort).all();
      expect(efforts[0].pr_achieved).toBe(1); // pr_rank = 1 → truthy
      expect(efforts[1].pr_achieved).toBe(0); // pr_rank = null → falsy
      expect(efforts[2].pr_achieved).toBe(0); // pr_rank = 0 → falsy
    });

    it('should store result with correct total time', () => {
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

      storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      const results = orm.select().from(result).all();
      expect(results).toHaveLength(1);
      expect(results[0].total_time_seconds).toBe(1420);
      expect(results[0].week_id).toBe(testWeekId);
      expect(results[0].strava_athlete_id).toBe(testAthleteId);
    });

    it('should handle transactional rollback on error', () => {
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

      // Close the DB to cause an error
      db.close();

      // Expect the operation to fail
      expect(() => {
        storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);
      }).toThrow();
    });

    it('should store activity with athlete weight', () => {
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

      storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      // Verify activity was stored with weight
      const activities = orm.select().from(activity).all();
      expect(activities).toHaveLength(1);
      expect(activities[0].athlete_weight).toBe(70.5);
    });

    it('should store activity with null weight when not provided', () => {
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

      storeActivityAndEfforts(orm, testAthleteId, testWeekId, activityData, testSegmentId);

      // Verify activity was stored with null weight
      const activities = orm.select().from(activity).all();
      expect(activities).toHaveLength(1);
      expect(activities[0].athlete_weight).toBeNull();
    });
  });
});
