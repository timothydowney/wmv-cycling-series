/**
 * Scoring Multiplier Feature - Unit Tests
 * Tests for score calculation with week multipliers applied
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { calculateWeekScoringDrizzle } from '../services/ScoringServiceDrizzle';
import { setupTestDb } from './setupTestDb';
import { week, participant, activity, result, segmentEffort, segment } from '../db/schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

describe('Scoring Multiplier Feature', () => {
  let drizzleDb: BetterSQLite3Database;

  beforeEach(() => {
    const { drizzleDb: db } = setupTestDb();
    drizzleDb = db;
  });

  describe('Score Calculation with Multiplier', () => {
    it('should calculate total points = (base + participation + pr) × multiplier', async () => {
      // Setup: Create test data
      // Week with multiplier = 2
      const testWeek = drizzleDb
        .insert(week)
        .values({
          season_id: 1,
          week_name: 'Test Week - 2x Multiplier',
          strava_segment_id: '12345',
          required_laps: 1,
          start_at: 1700000000,
          end_at: 1700086400,
          multiplier: 2,
          notes: ''
        })
        .returning()
        .get();

      // Create 3 participants
      for (let i = 1; i <= 3; i++) {
        drizzleDb.insert(participant)
          .values({
            strava_athlete_id: '1000' + i,
            name: `Athlete ${i}`,
            active: true
          })
          .run();
      }

      // Create activities with different times
      const activity1 = drizzleDb
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '1001',
          strava_activity_id: '100001',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .get();

      const activity2 = drizzleDb
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '1002',
          strava_activity_id: '100002',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .get();

      const activity3 = drizzleDb
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '1003',
          strava_activity_id: '100003',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .get();

      // Create results with different times
      // Participant 1: 1000 seconds (fastest - rank 1)
      drizzleDb.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '1001',
          activity_id: activity1.id,
          total_time_seconds: 1000
        })
        .run();

      // Participant 2: 1100 seconds (2nd - rank 2)
      drizzleDb.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '1002',
          activity_id: activity2.id,
          total_time_seconds: 1100
        })
        .run();

      // Participant 3: 1200 seconds (3rd - rank 3)
      drizzleDb.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '1003',
          activity_id: activity3.id,
          total_time_seconds: 1200
        })
        .run();

      // Create segment efforts (no PRs for this test)
      drizzleDb.insert(segmentEffort)
        .values({
          activity_id: activity1.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1000,
          start_at: 1700043200,
          pr_achieved: 0
        })
        .run();

      drizzleDb.insert(segmentEffort)
        .values({
          activity_id: activity2.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1100,
          start_at: 1700043200,
          pr_achieved: 0
        })
        .run();

      drizzleDb.insert(segmentEffort)
        .values({
          activity_id: activity3.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1200,
          start_at: 1700043200,
          pr_achieved: 0
        })
        .run();

      // Calculate scores
      const scores = await calculateWeekScoringDrizzle(drizzleDb, testWeek.id);

      // Verify results
      expect(scores.results).toHaveLength(3);

      // Participant 1 (1st place):
      // basePoints = 3 - 1 = 2
      // participationBonus = 1
      // prBonusPoints = 0
      // subtotal = 3
      // totalPoints = 3 × 2 = 6
      expect(scores.results[0].basePoints).toBe(2);
      expect(scores.results[0].participationBonus).toBe(1);
      expect(scores.results[0].prBonusPoints).toBe(0);
      expect(scores.results[0].multiplier).toBe(2);
      expect(scores.results[0].totalPoints).toBe(6);

      // Participant 2 (2nd place):
      // basePoints = 3 - 2 = 1
      // participationBonus = 1
      // prBonusPoints = 0
      // subtotal = 2
      // totalPoints = 2 × 2 = 4
      expect(scores.results[1].basePoints).toBe(1);
      expect(scores.results[1].participationBonus).toBe(1);
      expect(scores.results[1].prBonusPoints).toBe(0);
      expect(scores.results[1].multiplier).toBe(2);
      expect(scores.results[1].totalPoints).toBe(4);

      // Participant 3 (3rd place):
      // basePoints = 3 - 3 = 0
      // participationBonus = 1
      // prBonusPoints = 0
      // subtotal = 1
      // totalPoints = 1 × 2 = 2
      expect(scores.results[2].basePoints).toBe(0);
      expect(scores.results[2].participationBonus).toBe(1);
      expect(scores.results[2].prBonusPoints).toBe(0);
      expect(scores.results[2].multiplier).toBe(2);
      expect(scores.results[2].totalPoints).toBe(2);
    });

    it('should apply multiplier correctly with PR bonus', async () => {
      // Setup: Week with multiplier = 3, one participant with PR
      const testWeek = drizzleDb
        .insert(week)
        .values({
          season_id: 1,
          week_name: 'Test Week - PR Bonus with Multiplier',
          strava_segment_id: '12345',
          required_laps: 1,
          start_at: 1700000000,
          end_at: 1700086400,
          multiplier: 3,
          notes: ''
        })
        .returning()
        .get();

      // Create participant
      drizzleDb.insert(participant)
        .values({
          strava_athlete_id: '2001',
          name: 'PR Athlete',
          active: true
        })
        .run();

      // Create activity
      const testActivity = drizzleDb
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '2001',
          strava_activity_id: '200001',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .get();

      // Create result
      drizzleDb.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '2001',
          activity_id: testActivity.id,
          total_time_seconds: 1000
        })
        .run();

      // Create segment effort with PR achieved
      drizzleDb.insert(segmentEffort)
        .values({
          activity_id: testActivity.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1000,
          start_at: 1700043200,
          pr_achieved: 1  // This is a PR
        })
        .run();

      // Calculate scores
      const scores = await calculateWeekScoringDrizzle(drizzleDb, testWeek.id);

      // Verify: Only 1 participant, so base = 1 - 1 = 0
      // participation = 1
      // pr_bonus = 1
      // subtotal = 2
      // totalPoints = 2 × 3 = 6
      expect(scores.results).toHaveLength(1);
      expect(scores.results[0].basePoints).toBe(0);
      expect(scores.results[0].participationBonus).toBe(1);
      expect(scores.results[0].prBonusPoints).toBe(1);
      expect(scores.results[0].multiplier).toBe(3);
      expect(scores.results[0].totalPoints).toBe(6);
    });

    it('should handle multiplier = 1 (no change from standard calculation)', async () => {
      // Setup: Week with default multiplier = 1
      const testWeek = drizzleDb
        .insert(week)
        .values({
          season_id: 1,
          week_name: 'Test Week - No Multiplier',
          strava_segment_id: '12345',
          required_laps: 1,
          start_at: 1700000000,
          end_at: 1700086400,
          multiplier: 1,  // Default
          notes: ''
        })
        .returning()
        .get();

      // Create 2 participants
      drizzleDb.insert(participant)
        .values({
          strava_athlete_id: '3001',
          name: 'Athlete 1',
          active: true
        })
        .run();

      drizzleDb.insert(participant)
        .values({
          strava_athlete_id: '3002',
          name: 'Athlete 2',
          active: true
        })
        .run();

      // Create activities and results
      const activity1 = drizzleDb
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '3001',
          strava_activity_id: '300001',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .get();

      const activity2 = drizzleDb
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '3002',
          strava_activity_id: '300002',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .get();

      drizzleDb.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '3001',
          activity_id: activity1.id,
          total_time_seconds: 1000
        })
        .run();

      drizzleDb.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '3002',
          activity_id: activity2.id,
          total_time_seconds: 1100
        })
        .run();

      // Create segment efforts
      drizzleDb.insert(segmentEffort)
        .values({
          activity_id: activity1.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1000,
          start_at: 1700043200,
          pr_achieved: 0
        })
        .run();

      drizzleDb.insert(segmentEffort)
        .values({
          activity_id: activity2.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1100,
          start_at: 1700043200,
          pr_achieved: 0
        })
        .run();

      // Calculate scores
      const scores = await calculateWeekScoringDrizzle(drizzleDb, testWeek.id);

      // Verify: Multiplier = 1 should not change the calculation
      // 1st place: base=1, participation=1, pr=0, total = 2 × 1 = 2
      // 2nd place: base=0, participation=1, pr=0, total = 1 × 1 = 1
      expect(scores.results[0].totalPoints).toBe(2);
      expect(scores.results[1].totalPoints).toBe(1);
    });

    it('should handle multiplier = 5 (maximum)', async () => {
      // Setup: Week with multiplier = 5
      const testWeek = drizzleDb
        .insert(week)
        .values({
          season_id: 1,
          week_name: 'Test Week - Max Multiplier',
          strava_segment_id: '12345',
          required_laps: 1,
          start_at: 1700000000,
          end_at: 1700086400,
          multiplier: 5,
          notes: ''
        })
        .returning()
        .get();

      // Create participant
      drizzleDb.insert(participant)
        .values({
          strava_athlete_id: '4001',
          name: 'Max Multiplier Athlete',
          active: true
        })
        .run();

      // Create activity and result
      const testActivity = drizzleDb
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '4001',
          strava_activity_id: '400001',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .get();

      drizzleDb.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '4001',
          activity_id: testActivity.id,
          total_time_seconds: 1000
        })
        .run();

      // Create segment effort with PR
      drizzleDb.insert(segmentEffort)
        .values({
          activity_id: testActivity.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1000,
          start_at: 1700043200,
          pr_achieved: 1
        })
        .run();

      // Calculate scores
      const scores = await calculateWeekScoringDrizzle(drizzleDb, testWeek.id);

      // Verify: 1 participant with PR
      // base=0, participation=1, pr=1, total = 2 × 5 = 10
      expect(scores.results[0].multiplier).toBe(5);
      expect(scores.results[0].totalPoints).toBe(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle week with no results', async () => {
      // Setup: Week with no participants
      const testWeek = drizzleDb
        .insert(week)
        .values({
          season_id: 1,
          week_name: 'Empty Week',
          strava_segment_id: '12345',
          required_laps: 1,
          start_at: 1700000000,
          end_at: 1700086400,
          multiplier: 2,
          notes: ''
        })
        .returning()
        .get();

      // Calculate scores
      const scores = await calculateWeekScoringDrizzle(drizzleDb, testWeek.id);

      // Verify: Empty results
      expect(scores.results).toHaveLength(0);
    });

    it('should recalculate correctly if multiplier changes between weeks', async () => {
      // This is a conceptual test - multiplier applies at query time
      // So changing a week's multiplier immediately affects leaderboard display

      const testWeekA = drizzleDb
        .insert(week)
        .values({
          season_id: 1,
          week_name: 'Week A - 1x',
          strava_segment_id: '12345',
          required_laps: 1,
          start_at: 1700000000,
          end_at: 1700086400,
          multiplier: 1,
          notes: ''
        })
        .returning()
        .get();

      const testWeekB = drizzleDb
        .insert(week)
        .values({
          season_id: 1,
          week_name: 'Week B - 2x',
          strava_segment_id: '12345',
          required_laps: 1,
          start_at: 1700086401,
          end_at: 1700172800,
          multiplier: 2,
          notes: ''
        })
        .returning()
        .get();

      // Create participant
      drizzleDb.insert(participant)
        .values({
          strava_athlete_id: '5001',
          name: 'Multi-Week Athlete',
          active: true
        })
        .run();

      // Create activities for both weeks
      const activityA = drizzleDb
        .insert(activity)
        .values({
          week_id: testWeekA.id,
          strava_athlete_id: '5001',
          strava_activity_id: '500001',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .get();

      const activityB = drizzleDb
        .insert(activity)
        .values({
          week_id: testWeekB.id,
          strava_athlete_id: '5001',
          strava_activity_id: '500002',
          start_at: 1700129600,
          device_name: 'Garmin'
        })
        .returning()
        .get();

      // Create results
      drizzleDb.insert(result)
        .values({
          week_id: testWeekA.id,
          strava_athlete_id: '5001',
          activity_id: activityA.id,
          total_time_seconds: 1000
        })
        .run();

      drizzleDb.insert(result)
        .values({
          week_id: testWeekB.id,
          strava_athlete_id: '5001',
          activity_id: activityB.id,
          total_time_seconds: 1000
        })
        .run();

      // Create segment efforts
      drizzleDb.insert(segmentEffort)
        .values({
          activity_id: activityA.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1000,
          start_at: 1700043200,
          pr_achieved: 0
        })
        .run();

      drizzleDb.insert(segmentEffort)
        .values({
          activity_id: activityB.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1000,
          start_at: 1700129600,
          pr_achieved: 0
        })
        .run();

      // Calculate scores for both weeks
      const scoresA = await calculateWeekScoringDrizzle(drizzleDb, testWeekA.id);
      const scoresB = await calculateWeekScoringDrizzle(drizzleDb, testWeekB.id);

      // Verify: Week A has multiplier = 1, Week B has multiplier = 2
      expect(scoresA.results[0].multiplier).toBe(1);
      expect(scoresA.results[0].totalPoints).toBe(1); // 0+1 (base=0, participation=1, × 1)

      expect(scoresB.results[0].multiplier).toBe(2);
      expect(scoresB.results[0].totalPoints).toBe(2); // (0+1) × 2
    });
  });
});
