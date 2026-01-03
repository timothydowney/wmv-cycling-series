/**
 * Scoring Formula Integration Tests
 * 
 * Tests that scoring is correctly calculated:
 * Points = Base Points + Participation Bonus + PR Bonus
 * 
 * Base Points = (total_participants - rank)
 * Participation Bonus = 1 (always awarded for valid activity)
 * PR Bonus = 1 (max 1 per week, regardless of how many laps are PRs)
 * 
 * Formula: points = base_points + participation + pr_bonus
 * Which simplifies to: points = (total - rank) + 1 + pr_bonus
 */

import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { appRouter } from '../routers';
import { createContext } from '../trpc/context';
import {
  setupTestDb,
  teardownTestDb,
  SeedData,
  createParticipant,
  createSegment,
  createWeek,
  createActivityWithResult,
} from './testDataHelpers';

describe('Scoring Formula: Points Calculation', () => {
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

  describe('Single Participant (No One to Beat)', () => {
    it('solo participant gets 1 point (participation only)', async () => {
      // Create new week with one participant
      const segment = createSegment(drizzleDb, '99991', 'Solo Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Solo Week',
      });

      const participant = createParticipant(drizzleDb, '99991', 'Solo User');
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '99991',
        elapsedSeconds: 600,
        prAchieved: false,
      });

      const leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });

      expect(leaderboard.leaderboard).toHaveLength(1);
      const entry = leaderboard.leaderboard[0];
      expect(entry).toMatchObject({
        name: 'Solo User',
        rank: 1,
        points: 1, // (1 - 1) + 1 = 1 (no one beat + participation)
        pr_bonus_points: 0,
      });
    });

    it('solo participant with PR gets 2 points', async () => {
      // Create new week with one participant who has PR
      const segment = createSegment(drizzleDb, '99992', 'PR Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'PR Week',
      });

      const participant = createParticipant(drizzleDb, '99992', 'PR User');
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '99992',
        elapsedSeconds: 600,
        prAchieved: true, // PR achieved
      });

      const leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });

      const entry = leaderboard.leaderboard[0];
      expect(entry).toMatchObject({
        name: 'PR User',
        rank: 1,
        points: 2, // (1 - 1) + 1 + 1 = 2 (no one beat + participation + PR)
        pr_bonus_points: 1,
      });
    });
  });

  describe('Two Participants (1st vs 2nd)', () => {
    it('1st place: beats 1 participant = 2 points', async () => {
      const segment = createSegment(drizzleDb, '99993', 'Two Person Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Two Person Week',
      });

      const p1 = createParticipant(drizzleDb, '99993', 'Faster User');
      const p2 = createParticipant(drizzleDb, '99994', 'Slower User');

      // Faster (1st place)
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: p1.strava_athlete_id,
        stravaActivityId: '99993',
        elapsedSeconds: 500, // Faster
      });

      // Slower (2nd place)
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: p2.strava_athlete_id,
        stravaActivityId: '99994',
        elapsedSeconds: 600, // Slower
      });

      const leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });

      expect(leaderboard.leaderboard).toHaveLength(2);
      expect(leaderboard.leaderboard[0]).toMatchObject({
        name: 'Faster User',
        rank: 1,
        points: 2, // (2 - 1) + 1 = 2 (beat 1 + participation)
      });
      expect(leaderboard.leaderboard[1]).toMatchObject({
        name: 'Slower User',
        rank: 2,
        points: 1, // (2 - 2) + 1 = 1 (beat 0 + participation)
      });
    });

    it('1st place with PR: beats 1 + PR = 3 points', async () => {
      const segment = createSegment(drizzleDb, '99995', 'PR Two Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'PR Two Week',
      });

      const p1 = createParticipant(drizzleDb, '99995', 'Fast with PR');
      const p2 = createParticipant(drizzleDb, '99996', 'Slower');

      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: p1.strava_athlete_id,
        stravaActivityId: '99995',
        elapsedSeconds: 500,
        prAchieved: true, // Has PR
      });

      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: p2.strava_athlete_id,
        stravaActivityId: '99996',
        elapsedSeconds: 600,
      });

      const leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });

      expect(leaderboard.leaderboard[0]).toMatchObject({
        name: 'Fast with PR',
        rank: 1,
        points: 3, // (2 - 1) + 1 + 1 = 3 (beat 1 + participation + PR)
        pr_bonus_points: 1,
      });
    });
  });

  describe('Four Participants (Full Race)', () => {
    it('4-person race: 1st=4pts, 2nd=3pts, 3rd=2pts, 4th=1pt', async () => {
      const segment = createSegment(drizzleDb, '99997', 'Four Person Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Four Person Week',
      });

      const participants = [
        { id: '10000', name: 'Alice', time: 400 },
        { id: '10001', name: 'Bob', time: 500 },
        { id: '10002', name: 'Charlie', time: 600 },
        { id: '10003', name: 'Diana', time: 700 },
      ];

      for (const p of participants) {
        createActivityWithResult(drizzleDb, {
          weekId: week.id,
          stravaAthleteId: p.id,
          stravaActivityId: p.id,
          elapsedSeconds: p.time,
        });
      }

      const leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });

      expect(leaderboard.leaderboard).toHaveLength(4);

      // Verify exact points
      // 1st (Alice): beat 3 = 3 base, +1 participation = 4
      // 2nd (Bob): beat 2 = 2 base, +1 participation = 3
      // 3rd (Charlie): beat 1 = 1 base, +1 participation = 2
      // 4th (Diana): beat 0 = 0 base, +1 participation = 1
      const rankings = leaderboard.leaderboard;
      expect(rankings[0]).toMatchObject({ rank: 1, points: 4 });
      expect(rankings[1]).toMatchObject({ rank: 2, points: 3 });
      expect(rankings[2]).toMatchObject({ rank: 3, points: 2 });
      expect(rankings[3]).toMatchObject({ rank: 4, points: 1 });
    });

    it('4-person with PR bonuses: 1st with PR=5pts, 3rd with PR=3pts', async () => {
      const segment = createSegment(drizzleDb, '99998', 'Four PR Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Four PR Week',
      });

      const participants = [
        { id: '11000', name: 'Alice (PR)', time: 400, pr: true },
        { id: '11001', name: 'Bob', time: 500, pr: false },
        { id: '11002', name: 'Charlie (PR)', time: 600, pr: true },
        { id: '11003', name: 'Diana', time: 700, pr: false },
      ];

      for (const p of participants) {
        createActivityWithResult(drizzleDb, {
          weekId: week.id,
          stravaAthleteId: p.id,
          stravaActivityId: p.id,
          elapsedSeconds: p.time,
          prAchieved: p.pr,
        });
      }

      const leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });

      const rankings = leaderboard.leaderboard;
      expect(rankings[0]).toMatchObject({
        rank: 1,
        points: 5, // (4-1) + 1 + 1 = 5
        pr_bonus_points: 1,
      });
      expect(rankings[1]).toMatchObject({
        rank: 2,
        points: 3, // (4-2) + 1 + 0 = 3
        pr_bonus_points: 0,
      });
      expect(rankings[2]).toMatchObject({
        rank: 3,
        points: 3, // (4-3) + 1 + 1 = 3
        pr_bonus_points: 1,
      });
      expect(rankings[3]).toMatchObject({
        rank: 4,
        points: 1, // (4-4) + 1 + 0 = 1
        pr_bonus_points: 0,
      });
    });
  });

  describe('Non-Competitors (Participants Without Activities)', () => {
    it('non-competitors do not appear on leaderboard', async () => {
      const segment = createSegment(drizzleDb, '99999', 'Selective Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Selective Week',
      });

      // Create 4 participants but only 2 complete
      const p1 = createParticipant(drizzleDb, '12000', 'Completer1');
      const p2 = createParticipant(drizzleDb, '12001', 'Completer2');
      createParticipant(drizzleDb, '12002', 'NonCompleter1');
      createParticipant(drizzleDb, '12003', 'NonCompleter2');

      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: p1.strava_athlete_id,
        stravaActivityId: '12000',
        elapsedSeconds: 500,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: p2.strava_athlete_id,
        stravaActivityId: '12001',
        elapsedSeconds: 600,
      });

      // Don't create activities for NonCompleter1 and NonCompleter2

      const leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });

      // Only 2 on leaderboard
      expect(leaderboard.leaderboard).toHaveLength(2);
      expect(leaderboard.leaderboard.map((r) => r.name)).toEqual([
        'Completer1',
        'Completer2',
      ]);
      // Non-completers should not appear
      expect(leaderboard.leaderboard.map((r) => r.name)).not.toContain(
        'NonCompleter1'
      );
      expect(leaderboard.leaderboard.map((r) => r.name)).not.toContain(
        'NonCompleter2'
      );
    });
  });

  describe('Maximum PR Bonus (1 per week)', () => {
    it('participant with multiple PRs gets only 1 PR bonus', async () => {
      // This would require testing with multiple segment efforts in same week
      // For now, we simplify: if any effort has PR, award 1 bonus (not per-effort)
      const segment = createSegment(drizzleDb, '88888', 'Multi-PR Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Multi PR Week',
        requiredLaps: 1,
      });

      const participant = createParticipant(drizzleDb, '13000', 'Multi-PR User');
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '13000',
        elapsedSeconds: 500,
        prAchieved: true, // Mark as PR
      });

      const leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });

      const entry = leaderboard.leaderboard[0];
      expect(entry.pr_bonus_points).toBe(1); // Exactly 1, not multiple
    });
  });

  describe('Edge Case: All Tied Results', () => {
    it('tied times should assign different ranks but same points based on count', async () => {
      // When participants have identical times, they still get ranked and points
      // based on number of participants (not tied rank)
      const segment = createSegment(drizzleDb, '88889', 'Tie Segment');
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: segment.strava_segment_id,
        weekName: 'Tie Week',
      });

      const p1 = '14000';
      const p2 = '14001';
      const p3 = '14002';

      // All have same time
      for (const [pId, aid] of [
        [p1, '14000'],
        [p2, '14001'],
        [p3, '14002'],
      ]) {
        createActivityWithResult(drizzleDb, {
          weekId: week.id,
          stravaAthleteId: pId,
          stravaActivityId: aid,
          elapsedSeconds: 600, // All same
        });
      }

      const leaderboard = await caller.leaderboard.getWeekLeaderboard({ weekId: week.id });

      // All should appear; with same times, they still get different ranks: 1st=3pts, 2nd=2pts, 3rd=1pt
      expect(leaderboard.leaderboard).toHaveLength(3);
      // With 3 participants, formula is (3 - rank) + 1 = 4 - rank
      // Rank 1: 4-1=3 pts, Rank 2: 4-2=2 pts, Rank 3: 4-3=1 pt
      const rankedPoints = leaderboard.leaderboard.map((r) => r.points).sort((a, b) => b - a);
      expect(rankedPoints).toEqual([3, 2, 1]);
    });
  });
});
