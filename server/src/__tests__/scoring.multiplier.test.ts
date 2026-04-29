// @ts-nocheck
import type { AppDatabase } from '../db/types';
/**
 * Scoring Multiplier Feature - Unit Tests
 * Tests for score calculation with week multipliers applied
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { calculateWeekScoring } from '../services/ScoringService';
import { setupTestDb } from './setupTestDb';
import { week, participant, activity, result, segmentEffort, segment, season } from '../db/schema';

describe('Scoring Multiplier Feature', () => {
  let orm: AppDatabase;

  beforeEach(async () => {
    const { orm: db } = setupTestDb({ seed: false });
    orm = db;

    await orm.insert(season).values({
      name: 'Test Season',
      start_at: 1700000000,
      end_at: 1800000000,
    }).execute();

    await orm.insert(segment).values({
      strava_segment_id: '12345',
      name: 'Test Segment',
    }).execute();
  });

  describe('Score Calculation with Multiplier', () => {
    it('should calculate total points = (base + participation + pr) × multiplier', async () => {
      // Setup: Create test data
      // Week with multiplier = 2
      const [testWeek] = await orm
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
        .execute();

      // Create 3 participants
      for (let i = 1; i <= 3; i++) {
        await orm.insert(participant)
          .values({
            strava_athlete_id: '100' + i,
            name: `Athlete ${i}`,
            active: true
          })
          .execute();
      }

      // Create activities with different times
      const [activity1] = await orm
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '1001',
          strava_activity_id: '100001',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .execute();

      const [activity2] = await orm
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '1002',
          strava_activity_id: '100002',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .execute();

      const [activity3] = await orm
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '1003',
          strava_activity_id: '100003',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .execute();

      // Create results with different times
      // Participant 1: 1000 seconds (fastest - rank 1)
      await orm.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '1001',
          activity_id: activity1.id,
          total_time_seconds: 1000
        })
        .execute();

      // Participant 2: 1100 seconds (2nd - rank 2)
      await orm.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '1002',
          activity_id: activity2.id,
          total_time_seconds: 1100
        })
        .execute();

      // Participant 3: 1200 seconds (3rd - rank 3)
      await orm.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '1003',
          activity_id: activity3.id,
          total_time_seconds: 1200
        })
        .execute();

      // Create segment efforts (no PRs for this test)
      await orm.insert(segmentEffort)
        .values({
          activity_id: activity1.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1000,
          start_at: 1700043200,
          pr_achieved: 0
        })
        .execute();

      await orm.insert(segmentEffort)
        .values({
          activity_id: activity2.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1100,
          start_at: 1700043200,
          pr_achieved: 0
        })
        .execute();

      await orm.insert(segmentEffort)
        .values({
          activity_id: activity3.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1200,
          start_at: 1700043200,
          pr_achieved: 0
        })
        .execute();

      // Calculate scores
      const scores = await calculateWeekScoring(orm, testWeek.id);

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
      const [testWeek] = await orm
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
        .execute();

      // Create participant
      await orm.insert(participant)
        .values({
          strava_athlete_id: '2001',
          name: 'PR Athlete',
          active: true
        })
        .execute();

      // Create activity
      const [testActivity] = await orm
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '2001',
          strava_activity_id: '200001',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .execute();

      // Create result
      await orm.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '2001',
          activity_id: testActivity.id,
          total_time_seconds: 1000
        })
        .execute();

      // Create segment effort with PR achieved
      await orm.insert(segmentEffort)
        .values({
          activity_id: testActivity.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1000,
          start_at: 1700043200,
          pr_achieved: 1  // This is a PR
        })
        .execute();

      // Calculate scores
      const scores = await calculateWeekScoring(orm, testWeek.id);

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
      const [testWeek] = await orm
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
        .execute();

      // Create 2 participants
      await orm.insert(participant)
        .values({
          strava_athlete_id: '3001',
          name: 'Athlete 1',
          active: true
        })
        .execute();

      await orm.insert(participant)
        .values({
          strava_athlete_id: '3002',
          name: 'Athlete 2',
          active: true
        })
        .execute();

      // Create activities and results
      const [activity1] = await orm
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '3001',
          strava_activity_id: '300001',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .execute();

      const [activity2] = await orm
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '3002',
          strava_activity_id: '300002',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .execute();

      await orm.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '3001',
          activity_id: activity1.id,
          total_time_seconds: 1000
        })
        .execute();

      await orm.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '3002',
          activity_id: activity2.id,
          total_time_seconds: 1100
        })
        .execute();

      // Create segment efforts
      await orm.insert(segmentEffort)
        .values({
          activity_id: activity1.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1000,
          start_at: 1700043200,
          pr_achieved: 0
        })
        .execute();

      await orm.insert(segmentEffort)
        .values({
          activity_id: activity2.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1100,
          start_at: 1700043200,
          pr_achieved: 0
        })
        .execute();

      // Calculate scores
      const scores = await calculateWeekScoring(orm, testWeek.id);

      // Verify: Multiplier = 1 should not change the calculation
      // 1st place: base=1, participation=1, pr=0, total = 2 × 1 = 2
      // 2nd place: base=0, participation=1, pr=0, total = 1 × 1 = 1
      expect(scores.results[0].totalPoints).toBe(2);
      expect(scores.results[1].totalPoints).toBe(1);
    });

    it('should handle multiplier = 5 (maximum)', async () => {
      // Setup: Week with multiplier = 5
      const [testWeek] = await orm
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
        .execute();

      // Create participant
      await orm.insert(participant)
        .values({
          strava_athlete_id: '4001',
          name: 'Max Multiplier Athlete',
          active: true
        })
        .execute();

      // Create activity and result
      const [testActivity] = await orm
        .insert(activity)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '4001',
          strava_activity_id: '400001',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .execute();

      await orm.insert(result)
        .values({
          week_id: testWeek.id,
          strava_athlete_id: '4001',
          activity_id: testActivity.id,
          total_time_seconds: 1000
        })
        .execute();

      // Create segment effort with PR
      await orm.insert(segmentEffort)
        .values({
          activity_id: testActivity.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1000,
          start_at: 1700043200,
          pr_achieved: 1
        })
        .execute();

      // Calculate scores
      const scores = await calculateWeekScoring(orm, testWeek.id);

      // Verify: 1 participant with PR
      // base=0, participation=1, pr=1, total = 2 × 5 = 10
      expect(scores.results[0].multiplier).toBe(5);
      expect(scores.results[0].totalPoints).toBe(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle week with no results', async () => {
      // Setup: Week with no participants
      const [testWeek] = await orm
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
        .execute();

      // Calculate scores
      const scores = await calculateWeekScoring(orm, testWeek.id);

      // Verify: Empty results
      expect(scores.results).toHaveLength(0);
    });

    it('should recalculate correctly if multiplier changes between weeks', async () => {
      // This is a conceptual test - multiplier applies at query time
      // So changing a week's multiplier immediately affects leaderboard display

      const [testWeekA] = await orm
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
        .execute();

      const [testWeekB] = await orm
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
        .execute();

      // Create participant
      await orm.insert(participant)
        .values({
          strava_athlete_id: '5001',
          name: 'Multi-Week Athlete',
          active: true
        })
        .execute();

      // Create activities for both weeks
      const [activityA] = await orm
        .insert(activity)
        .values({
          week_id: testWeekA.id,
          strava_athlete_id: '5001',
          strava_activity_id: '500001',
          start_at: 1700043200,
          device_name: 'Garmin'
        })
        .returning()
        .execute();

      const [activityB] = await orm
        .insert(activity)
        .values({
          week_id: testWeekB.id,
          strava_athlete_id: '5001',
          strava_activity_id: '500002',
          start_at: 1700129600,
          device_name: 'Garmin'
        })
        .returning()
        .execute();

      // Create results
      await orm.insert(result)
        .values({
          week_id: testWeekA.id,
          strava_athlete_id: '5001',
          activity_id: activityA.id,
          total_time_seconds: 1000
        })
        .execute();

      await orm.insert(result)
        .values({
          week_id: testWeekB.id,
          strava_athlete_id: '5001',
          activity_id: activityB.id,
          total_time_seconds: 1000
        })
        .execute();

      // Create segment efforts
      await orm.insert(segmentEffort)
        .values({
          activity_id: activityA.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1000,
          start_at: 1700043200,
          pr_achieved: 0
        })
        .execute();

      await orm.insert(segmentEffort)
        .values({
          activity_id: activityB.id,
          strava_segment_id: '12345',
          effort_index: 0,
          elapsed_seconds: 1000,
          start_at: 1700129600,
          pr_achieved: 0
        })
        .execute();

      // Calculate scores for both weeks
      const scoresA = await calculateWeekScoring(orm, testWeekA.id);
      const scoresB = await calculateWeekScoring(orm, testWeekB.id);

      // Verify: Week A has multiplier = 1, Week B has multiplier = 2
      expect(scoresA.results[0].multiplier).toBe(1);
      expect(scoresA.results[0].totalPoints).toBe(1); // 0+1 (base=0, participation=1, × 1)

      expect(scoresB.results[0].multiplier).toBe(2);
      expect(scoresB.results[0].totalPoints).toBe(2); // (0+1) × 2
    });
  });
});
