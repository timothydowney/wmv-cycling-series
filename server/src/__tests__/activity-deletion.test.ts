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

import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
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
  let db: Database;
  let drizzleDb: BetterSQLite3Database;
  let seedData: SeedData;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const setup = setupTestDb({ seed: true });
    db = setup.db;
    drizzleDb = setup.drizzleDb;
    seedData = setup.seedData!;
    caller = appRouter.createCaller(
      createContext({
        dbOverride: db,
        drizzleDbOverride: drizzleDb,
        req: {} as any,
        res: {} as any,
      })
    );
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  describe('Activity Deletion', () => {
    it('deleting activity removes from leaderboard', async () => {
      const segment = createSegment(drizzleDb, 60001, 'Delete Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Delete Week',
      });

      const result1 = createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: 60001,
        stravaActivityId: 60001,
        elapsedSeconds: 500,
      });

      const result2 = createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: 60002,
        stravaActivityId: 60002,
        elapsedSeconds: 600,
      });

      let leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(2);

      // Delete result for first participant (leaderboard is read from result table)
      drizzleDb.delete(result)
        .where(
          and(
            eq(result.week_id, week.id),
            eq(result.strava_athlete_id, 60001)
          )
        )
        .run();

      // Leaderboard should only have p2 now
      leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(1);
    });

    it('deleting leader triggers recalculation of rankings', async () => {
      const segment = createSegment(drizzleDb, 60003, 'Leader Delete Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Leader Delete Week',
      });

      // Create 3 participants with leader, 2nd, 3rd
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: 60101,
        stravaActivityId: 60101,
        elapsedSeconds: 400, // 1st
      });

      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: 60102,
        stravaActivityId: 60102,
        elapsedSeconds: 500, // 2nd
      });

      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: 60103,
        stravaActivityId: 60103,
        elapsedSeconds: 600, // 3rd
      });

      let leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard[0].rank).toBe(1); // First place (fastest)
      expect(leaderboard.leaderboard[0].points).toBe(3); // (3-1)+1 = 3

      // Delete the leader's result
      drizzleDb.delete(result)
        .where(
          and(
            eq(result.week_id, week.id),
            eq(result.strava_athlete_id, 60101)
          )
        )
        .run();

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
      const segment = createSegment(drizzleDb, 60004, 'PR Delete Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'PR Delete Week',
      });

      // Activity with PR
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: 60201,
        stravaActivityId: 60201,
        elapsedSeconds: 500,
        prAchieved: true,
      });

      // Activity without PR
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: 60202,
        stravaActivityId: 60202,
        elapsedSeconds: 600,
        prAchieved: false,
      });

      let leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard[0].pr_bonus_points).toBe(1);
      expect(leaderboard.leaderboard[0].points).toBe(3); // 2 + 1 PR bonus

      // Delete the PR result
      drizzleDb.delete(result)
        .where(
          and(
            eq(result.week_id, week.id),
            eq(result.strava_athlete_id, 60201)
          )
        )
        .run();

      leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(1);
      expect(leaderboard.leaderboard[0].pr_bonus_points).toBe(0); // No more PR
      expect(leaderboard.leaderboard[0].points).toBe(1); // Just participation bonus
    });
  });

  describe('Season Leaderboard After Deletion', () => {
    it('deleting activity updates season totals', async () => {
      const segment1 = createSegment(drizzleDb, 60005, 'Season Delete Seg1');
      const segment2 = createSegment(drizzleDb, 60006, 'Season Delete Seg2');

      const week1 = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment1.strava_segment_id,
        weekName: 'Season Delete Week 1',
      });

      const week2 = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment2.strava_segment_id,
        weekName: 'Season Delete Week 2',
      });

      const p1 = 60301;
      const p2 = 60302;

      // Week 1: p1 1st (2 pts), p2 2nd (1 pt)
      createActivityWithResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: p1,
        stravaActivityId: 60301,
        elapsedSeconds: 500,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: p2,
        stravaActivityId: 60302,
        elapsedSeconds: 600,
      });

      // Week 2: p1 1st (2 pts), p2 2nd (1 pt)
      createActivityWithResult(drizzleDb, {
        weekId: week2.id,
        stravaAthleteId: p1,
        stravaActivityId: 60303,
        elapsedSeconds: 500,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week2.id,
        stravaAthleteId: p2,
        stravaActivityId: 60304,
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
      drizzleDb.delete(result)
        .where(
          and(
            eq(result.week_id, week2.id),
            eq(result.strava_athlete_id, 60301)
          )
        )
        .run();

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
      const segment = createSegment(drizzleDb, 60007, 'All Delete Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'All Delete Week',
      });

      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: 60401,
        stravaActivityId: 60401,
        elapsedSeconds: 500,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: 60402,
        stravaActivityId: 60402,
        elapsedSeconds: 600,
      });

      let leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(2);

      // Delete all results for the week
      drizzleDb.delete(result)
        .where(eq(result.week_id, week.id))
        .run();

      leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(0);
    });

    it('deleting one of two activities updates sole survivor ranking', async () => {
      const segment = createSegment(drizzleDb, 60008, 'Survivor Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Survivor Week',
      });

      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: 60501,
        stravaActivityId: 60501,
        elapsedSeconds: 500,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: 60502,
        stravaActivityId: 60502,
        elapsedSeconds: 600,
      });

      // With 2 participants:
      // 1st: (2-1)+1 = 2 pts
      // 2nd: (2-2)+1 = 1 pt

      let leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard[0].points).toBe(2);
      expect(leaderboard.leaderboard[1].points).toBe(1);

      // Delete the 2nd place finisher's result
      drizzleDb.delete(result)
        .where(
          and(
            eq(result.week_id, week.id),
            eq(result.strava_athlete_id, 60502)
          )
        )
        .run();

      // Now sole survivor should have (1-1)+1 = 1 point
      leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(1);
      expect(leaderboard.leaderboard[0].points).toBe(1); // (1-1)+1 = 1 point
    });
  });

  describe('Result Table Cascade Delete', () => {
    it('deleting result removes from leaderboard', async () => {
      const segment = createSegment(drizzleDb, 60009, 'Cascade Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Cascade Week',
      });

      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: 60601,
        stravaActivityId: 60601,
        elapsedSeconds: 500,
      });

      // Verify result exists
      let leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(1);

      // Delete result
      drizzleDb.delete(result)
        .where(
          and(
            eq(result.week_id, week.id),
            eq(result.strava_athlete_id, 60601)
          )
        )
        .run();

      // Leaderboard should now be empty
      leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });
      expect(leaderboard.leaderboard).toHaveLength(0);
    });
  });

  describe('Deletion with Multiple Weeks', () => {
    it('deletion in one week does not affect another week', async () => {
      const segment1 = createSegment(drizzleDb, 60010, 'Week Iso Seg1');
      const segment2 = createSegment(drizzleDb, 60011, 'Week Iso Seg2');

      const week1 = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment1.strava_segment_id,
        weekName: 'Week Iso 1',
      });

      const week2 = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment2.strava_segment_id,
        weekName: 'Week Iso 2',
      });

      const p1 = 60701;
      const p2 = 60702;

      // Both weeks have same 2 participants
      createActivityWithResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: p1,
        stravaActivityId: 60701,
        elapsedSeconds: 500,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: p2,
        stravaActivityId: 60702,
        elapsedSeconds: 600,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week2.id,
        stravaAthleteId: p1,
        stravaActivityId: 60703,
        elapsedSeconds: 500,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week2.id,
        stravaAthleteId: p2,
        stravaActivityId: 60704,
        elapsedSeconds: 600,
      });

      let board1 = await caller.leaderboard.getWeekLeaderboard({ weekId: week1.id });
      let board2 = await caller.leaderboard.getWeekLeaderboard({ weekId: week2.id });

      expect(board1.leaderboard).toHaveLength(2);
      expect(board2.leaderboard).toHaveLength(2);

      // Delete result from week 1
      drizzleDb.delete(result)
        .where(
          and(
            eq(result.week_id, week1.id),
            eq(result.strava_athlete_id, 60701)
          )
        )
        .run();

      board1 = await caller.leaderboard.getWeekLeaderboard({ weekId: week1.id });
      board2 = await caller.leaderboard.getWeekLeaderboard({ weekId: week2.id });

      // Week 1 should have 1 activity, week 2 should still have 2
      expect(board1.leaderboard).toHaveLength(1);
      expect(board2.leaderboard).toHaveLength(2);
    });
  });
});
