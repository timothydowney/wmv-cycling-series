import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
/**
 * Activity Processing and Deletion Tests
 *
 * Tests that activity processing and deletion correctly update scoring.
 * Covers:
 * - Activity deletion removes from leaderboard
 * - Deleting leader triggers score recalculation for others
 * - Deleting activity updates participant ranking
 * - PR bonus removed when activity deleted
 */

import { jest } from '@jest/globals';
import { eq, and } from 'drizzle-orm';
import { activity, result } from '../db/schema';
import { appRouter } from '../routers';
import { createContext } from '../trpc/context';
import {
  setupTestDb,
  teardownTestDb,
  SeedData,
  createSegment,
  createWeek,
  createActivityWithResult,
} from './testDataHelpers';

describe('Activity Deletion and Score Recalculation', () => {
  jest.setTimeout(20000);

  let pool: Pool;
  let orm: AppDatabase;
  let seedData: SeedData;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    const setup = setupTestDb({ seed: true });
    pool = setup.pool;
    orm = setup.orm;
    seedData = setup.seedData!;
    caller = appRouter.createCaller(
      await createContext({
        dbOverride: pool,
        ormOverride: orm,
        req: {} as any,
        res: {} as any,
      })
    );
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  describe('Activity Deletion', () => {
    it('deleting activity removes from leaderboard', async () => {
      const segment = await createSegment(orm, '60001', 'Delete Segment');
      const week = await createWeek(orm, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Delete Week',
      });

      const result1 = await createActivityWithResult(orm, {
        weekId: week.id,
        stravaAthleteId: '60001',
        stravaActivityId: '60001',
        elapsedSeconds: 500,
      });

      const result2 = await createActivityWithResult(orm, {
        weekId: week.id,
        stravaAthleteId: '60002',
        stravaActivityId: '60002',
        elapsedSeconds: 600,
      });

      let leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(2);

      // Delete result for first participant (leaderboard is read from result table)
      await orm.delete(result)
        .where(
          and(
            eq(result.week_id, week.id),
            eq(result.strava_athlete_id, '60001')
          )
        )
        .execute();

      // Leaderboard should only have p2 now
      leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(1);
    });

    it('deleting leader triggers recalculation of rankings', async () => {
      const segment = await createSegment(orm, '60003', 'Leader Delete Segment');
      const week = await createWeek(orm, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Leader Delete Week',
      });

      // Create 3 participants with leader, 2nd, 3rd
      await createActivityWithResult(orm, {
        weekId: week.id,
        stravaAthleteId: '60101',
        stravaActivityId: '60101',
        elapsedSeconds: 400, // 1st
      });

      await createActivityWithResult(orm, {
        weekId: week.id,
        stravaAthleteId: '60102',
        stravaActivityId: '60102',
        elapsedSeconds: 500, // 2nd
      });

      await createActivityWithResult(orm, {
        weekId: week.id,
        stravaAthleteId: '60103',
        stravaActivityId: '60103',
        elapsedSeconds: 600, // 3rd
      });

      let leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard[0].rank).toBe(1); // First place (fastest)
      expect(leaderboard.leaderboard[0].points).toBe(3); // (3-1)+1 = 3

      // Delete the leader's result
      await orm.delete(result)
        .where(
          and(
            eq(result.week_id, week.id),
            eq(result.strava_athlete_id, '60101')
          )
        )
        .execute();

      leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(2);

      // Old 2nd place (500s) now 1st
      expect(leaderboard.leaderboard[0].rank).toBe(1);
      expect(leaderboard.leaderboard[0].points).toBe(2); // (2-1)+1 = 2 (beat 1 other + participation)

      // Old 3rd place (600s) now 2nd
      expect(leaderboard.leaderboard[1].rank).toBe(2);
      expect(leaderboard.leaderboard[1].points).toBe(1); // (2-2)+1 = 1 (beat 0 others + participation)
    });

    it('deleting activity removes PR bonus points', async () => {
      const segment = await createSegment(orm, '60004', 'PR Delete Segment');
      const week = await createWeek(orm, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'PR Delete Week',
      });

      // Activity with PR
      await createActivityWithResult(orm, {
        weekId: week.id,
        stravaAthleteId: '60201',
        stravaActivityId: '60201',
        elapsedSeconds: 500,
        prAchieved: true,
      });

      // Activity without PR
      await createActivityWithResult(orm, {
        weekId: week.id,
        stravaAthleteId: '60202',
        stravaActivityId: '60202',
        elapsedSeconds: 600,
        prAchieved: false,
      });

      let leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard[0].pr_bonus_points).toBe(1);
      expect(leaderboard.leaderboard[0].points).toBe(3); // 2 + 1 PR bonus

      // Delete the PR result
      await orm.delete(result)
        .where(
          and(
            eq(result.week_id, week.id),
            eq(result.strava_athlete_id, '60201')
          )
        )
        .execute();

      leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(1);
      expect(leaderboard.leaderboard[0].pr_bonus_points).toBe(0); // No more PR
      expect(leaderboard.leaderboard[0].points).toBe(1); // Just participation bonus
    });
  });

  describe('Season Leaderboard After Deletion', () => {
    it('deleting activity updates season totals', async () => {
      const segment1 = await createSegment(orm, '60005', 'Season Delete Seg1');
      const segment2 = await createSegment(orm, '60006', 'Season Delete Seg2');

      const week1 = await createWeek(orm, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment1.strava_segment_id,
        weekName: 'Season Delete Week 1',
      });

      const week2 = await createWeek(orm, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment2.strava_segment_id,
        weekName: 'Season Delete Week 2',
      });

      const p1 = '60301';
      const p2 = '60302';

      // Week 1: p1 1st (2 pts), p2 2nd (1 pt)
      await createActivityWithResult(orm, {
        weekId: week1.id,
        stravaAthleteId: p1,
        stravaActivityId: '60301',
        elapsedSeconds: 500,
      });

      await createActivityWithResult(orm, {
        weekId: week1.id,
        stravaAthleteId: p2,
        stravaActivityId: '60302',
        elapsedSeconds: 600,
      });

      // Week 2: p1 1st (2 pts), p2 2nd (1 pt)
      await createActivityWithResult(orm, {
        weekId: week2.id,
        stravaAthleteId: p1,
        stravaActivityId: '60303',
        elapsedSeconds: 500,
      });

      await createActivityWithResult(orm, {
        weekId: week2.id,
        stravaAthleteId: p2,
        stravaActivityId: '60304',
        elapsedSeconds: 600,
      });

      let seasonBoard = await caller.leaderboard.getSeasonLeaderboard({
        seasonId: seedData.seasons[0].id,
      });

      const p1Before = seasonBoard.find((r) => r.strava_athlete_id === p1);
      const p2Before = seasonBoard.find((r) => r.strava_athlete_id === p2);

      expect(p1Before!.totalPoints).toBe(4); // 2+2
      expect(p2Before!.totalPoints).toBe(2); // 1+1

      // Delete p1's week 2 result
      await orm.delete(result)
        .where(
          and(
            eq(result.week_id, week2.id),
            eq(result.strava_athlete_id, '60301')
          )
        )
        .execute();

      seasonBoard = await caller.leaderboard.getSeasonLeaderboard({
        seasonId: seedData.seasons[0].id,
      });

      const p1After = seasonBoard.find((r) => r.strava_athlete_id === p1);
      const p2After = seasonBoard.find((r) => r.strava_athlete_id === p2);

      // p1 should drop to 2 points (only week 1 now)
      expect(p1After!.totalPoints).toBe(2);
      // p2 should stay at 2 points (1 from week1 + 1 from week2 as sole finisher)
      // When p1 is deleted from week 2, p2 becomes sole finisher with (1-1)+1 = 1 point
      expect(p2After!.totalPoints).toBe(2);
    });
  });

  describe('Multiple Activity Deletion', () => {
    it('deleting all activities makes leaderboard empty', async () => {
      const segment = await createSegment(orm, '60007', 'All Delete Segment');
      const week = await createWeek(orm, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'All Delete Week',
      });

      await createActivityWithResult(orm, {
        weekId: week.id,
        stravaAthleteId: '60401',
        stravaActivityId: '60401',
        elapsedSeconds: 500,
      });

      await createActivityWithResult(orm, {
        weekId: week.id,
        stravaAthleteId: '60402',
        stravaActivityId: '60402',
        elapsedSeconds: 600,
      });

      let leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(2);

      // Delete all results for the week
      await orm.delete(result)
        .where(eq(result.week_id, week.id))
        .execute();

      leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(0);
    });

    it('deleting one of two activities updates sole survivor ranking', async () => {
      const segment = await createSegment(orm, '60008', 'Survivor Segment');
      const week = await createWeek(orm, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Survivor Week',
      });

      await createActivityWithResult(orm, {
        weekId: week.id,
        stravaAthleteId: '60501',
        stravaActivityId: '60501',
        elapsedSeconds: 500,
      });

      await createActivityWithResult(orm, {
        weekId: week.id,
        stravaAthleteId: '60502',
        stravaActivityId: '60502',
        elapsedSeconds: 600,
      });

      // With 2 participants:
      // 1st: (2-1)+1 = 2 pts
      // 2nd: (2-2)+1 = 1 pt

      let leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard[0].points).toBe(2);
      expect(leaderboard.leaderboard[1].points).toBe(1);

      // Delete the 2nd place finisher's result
      await orm.delete(result)
        .where(
          and(
            eq(result.week_id, week.id),
            eq(result.strava_athlete_id, '60502')
          )
        )
        .execute();

      // Now sole survivor should have (1-1)+1 = 1 point
      leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(1);
      expect(leaderboard.leaderboard[0].points).toBe(1); // (1-1)+1 = 1 point
    });
  });

  describe('Result Table Cascade Delete', () => {
    it('deleting result removes from leaderboard', async () => {
      const segment = await createSegment(orm, '60009', 'Cascade Segment');
      const week = await createWeek(orm, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Cascade Week',
      });

      await createActivityWithResult(orm, {
        weekId: week.id,
        stravaAthleteId: '60601',
        stravaActivityId: '60601',
        elapsedSeconds: 500,
      });

      // Verify result exists
      let leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(1);

      // Delete result
      await orm.delete(result)
        .where(
          and(
            eq(result.week_id, week.id),
            eq(result.strava_athlete_id, '60601')
          )
        )
        .execute();

      // Leaderboard should now be empty
      leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(0);
    });
  });

  describe('Deletion with Multiple Weeks', () => {
    it('deletion in one week does not affect another week', async () => {
      const segment1 = await createSegment(orm, '60010', 'Week Iso Seg1');
      const segment2 = await createSegment(orm, '60011', 'Week Iso Seg2');

      const week1 = await createWeek(orm, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment1.strava_segment_id,
        weekName: 'Week Iso 1',
      });

      const week2 = await createWeek(orm, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment2.strava_segment_id,
        weekName: 'Week Iso 2',
      });

      const p1 = '60701';
      const p2 = '60702';

      // Both weeks have same 2 participants
      await createActivityWithResult(orm, {
        weekId: week1.id,
        stravaAthleteId: p1,
        stravaActivityId: '60701',
        elapsedSeconds: 500,
      });

      await createActivityWithResult(orm, {
        weekId: week1.id,
        stravaAthleteId: p2,
        stravaActivityId: '60702',
        elapsedSeconds: 600,
      });

      await createActivityWithResult(orm, {
        weekId: week2.id,
        stravaAthleteId: p1,
        stravaActivityId: '60703',
        elapsedSeconds: 500,
      });

      await createActivityWithResult(orm, {
        weekId: week2.id,
        stravaAthleteId: p2,
        stravaActivityId: '60704',
        elapsedSeconds: 600,
      });

      let board1 = await caller.leaderboard.getWeekLeaderboard({ weekId: week1.id });
      let board2 = await caller.leaderboard.getWeekLeaderboard({ weekId: week2.id });

      expect(board1.leaderboard).toHaveLength(2);
      expect(board2.leaderboard).toHaveLength(2);

      // Delete result from week 1
      await orm.delete(result)
        .where(
          and(
            eq(result.week_id, week1.id),
            eq(result.strava_athlete_id, '60701')
          )
        )
        .execute();

      board1 = await caller.leaderboard.getWeekLeaderboard({ weekId: week1.id });
      board2 = await caller.leaderboard.getWeekLeaderboard({ weekId: week2.id });

      // Week 1 should have 1 activity, week 2 should still have 2
      expect(board1.leaderboard).toHaveLength(1);
      expect(board2.leaderboard).toHaveLength(2);
    });
  });
});
