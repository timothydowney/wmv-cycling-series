import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { JerseyService } from '../services/JerseyService';
import { setupTestDb } from './testDataHelpers';
import {
  createParticipant,
  createSegment,
  createSeason,
  createWeek,
  createActivityWithResult,
} from './testDataHelpers';

describe('JerseyService', () => {
  let drizzleDb: any;
  let sqliteDb: any;
  let jerseyService: JerseyService;
  let seedData: any;

  beforeAll(() => {
    const testDb = setupTestDb();
    drizzleDb = testDb.drizzleDb;
    sqliteDb = testDb.db;
    jerseyService = new JerseyService(drizzleDb);

    // Create seed data
    seedData = {
      seasons: [
        createSeason(drizzleDb, 'Test Season'),
        createSeason(drizzleDb, 'Another Season'),
      ],
      participants: [
        createParticipant(drizzleDb, '70001', 'Alice'),
        createParticipant(drizzleDb, '70002', 'Bob'),
        createParticipant(drizzleDb, '70003', 'Charlie'),
      ],
    };
  });

  afterAll(() => {
    sqliteDb.close();
  });

  describe('isHillClimbWeek', () => {
    it('should return true for grades > 2%', () => {
      expect(jerseyService.isHillClimbWeek(2.5)).toBe(true);
      expect(jerseyService.isHillClimbWeek(5)).toBe(true);
      expect(jerseyService.isHillClimbWeek(10)).toBe(true);
    });

    it('should return false for grades <= 2%', () => {
      expect(jerseyService.isHillClimbWeek(0)).toBe(false);
      expect(jerseyService.isHillClimbWeek(1.5)).toBe(false);
      expect(jerseyService.isHillClimbWeek(2)).toBe(false);
    });

    it('should handle null grade as 0', () => {
      expect(jerseyService.isHillClimbWeek(null)).toBe(false);
    });

    it('should handle undefined grade as 0', () => {
      expect(jerseyService.isHillClimbWeek(undefined as any)).toBe(false);
    });
  });

  describe('getParticipantPolkaDotWins', () => {
    it('should return 0 wins when participant has no hill climb wins', async () => {
      // Create a flat segment (average_grade = 1%)
      const flatSegment = createSegment(drizzleDb, '70101', 'Flat Road', { averageGrade: 1 });
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: flatSegment.strava_segment_id,
        weekName: 'Flat Week',
      });

      // Alice wins the flat week
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: seedData.participants[0].strava_athlete_id,
        stravaActivityId: '70101',
        elapsedSeconds: 500,
      });

      const wins = await jerseyService.getParticipantPolkaDotWins(
        seedData.seasons[0].id,
        seedData.participants[0].strava_athlete_id
      );

      expect(wins).toBe(0); // Flat week doesn't count
    });

    it('should count hill climb week wins for a participant', async () => {
      // Create a hill climb segment (average_grade = 5%)
      const hillSegment = createSegment(drizzleDb, '70102', 'Hill Climb', { averageGrade: 5 });
      const week = createWeek(drizzleDb, {
        seasonId: seedData.seasons[0].id,
        stravaSegmentId: hillSegment.strava_segment_id,
        weekName: 'Hill Week',
      });

      // Alice wins the hill week
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: seedData.participants[0].strava_athlete_id,
        stravaActivityId: '70102a',
        elapsedSeconds: 500,
      });

      // Bob doesn't finish
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: seedData.participants[1].strava_athlete_id,
        stravaActivityId: '70102b',
        elapsedSeconds: 600,
      });

      const aliceWins = await jerseyService.getParticipantPolkaDotWins(
        seedData.seasons[0].id,
        seedData.participants[0].strava_athlete_id
      );

      const bobWins = await jerseyService.getParticipantPolkaDotWins(
        seedData.seasons[0].id,
        seedData.participants[1].strava_athlete_id
      );

      expect(aliceWins).toBe(1); // Alice won 1 hill climb
      expect(bobWins).toBe(0); // Bob didn't win any
    });

    it('should return 0 for participants with no results in season', async () => {
      const wins = await jerseyService.getParticipantPolkaDotWins(
        seedData.seasons[0].id,
        seedData.participants[2].strava_athlete_id // Charlie - hasn't participated
      );

      expect(wins).toBe(0);
    });

    it('should count multiple hill climb wins across weeks', async () => {
      // Create two hill climb weeks
      const hill1 = createSegment(drizzleDb, '70103', 'Hill 1', { averageGrade: 4 });
      const hill2 = createSegment(drizzleDb, '70104', 'Hill 2', { averageGrade: 3.5 });

      const week1 = createWeek(drizzleDb, {
        seasonId: seedData.seasons[1].id,
        stravaSegmentId: hill1.strava_segment_id,
        weekName: 'Hill Week 1',
      });

      const week2 = createWeek(drizzleDb, {
        seasonId: seedData.seasons[1].id,
        stravaSegmentId: hill2.strava_segment_id,
        weekName: 'Hill Week 2',
      });

      const aliceId = seedData.participants[0].strava_athlete_id;
      const bobId = seedData.participants[1].strava_athlete_id;

      // Alice wins both
      createActivityWithResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: aliceId,
        stravaActivityId: '70103a',
        elapsedSeconds: 500,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: bobId,
        stravaActivityId: '70103b',
        elapsedSeconds: 600,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week2.id,
        stravaAthleteId: aliceId,
        stravaActivityId: '70104a',
        elapsedSeconds: 400,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week2.id,
        stravaAthleteId: bobId,
        stravaActivityId: '70104b',
        elapsedSeconds: 500,
      });

      const aliceWins = await jerseyService.getParticipantPolkaDotWins(
        seedData.seasons[1].id,
        aliceId
      );

      const bobWins = await jerseyService.getParticipantPolkaDotWins(
        seedData.seasons[1].id,
        bobId
      );

      expect(aliceWins).toBe(2); // Alice won both hill climbs
      expect(bobWins).toBe(0); // Bob didn't win any
    });
  });

  describe('isTimeTrialWeek', () => {
    it('should return true for grades <= 2%', () => {
      expect(jerseyService.isTimeTrialWeek(0)).toBe(true);
      expect(jerseyService.isTimeTrialWeek(1)).toBe(true);
      expect(jerseyService.isTimeTrialWeek(2)).toBe(true);
    });

    it('should return false for grades > 2%', () => {
      expect(jerseyService.isTimeTrialWeek(2.1)).toBe(false);
      expect(jerseyService.isTimeTrialWeek(5)).toBe(false);
    });

    it('should handle null grade as 0 (time trial)', () => {
      expect(jerseyService.isTimeTrialWeek(null)).toBe(true);
    });
  });

  describe('getParticipantTimeTrialWins', () => {
    it('should return 0 wins when participant has no time trial wins', async () => {
      // Create a dedicated season for this test
      const testSeason = createSeason(drizzleDb, 'TT Test - No Wins');

      // Create a steep segment (hill climb, not time trial)
      const hillSegment = createSegment(drizzleDb, '70201', 'Steep Hill', { averageGrade: 4 });
      const week = createWeek(drizzleDb, {
        seasonId: testSeason.id,
        stravaSegmentId: hillSegment.strava_segment_id,
        weekName: 'Hill Week',
      });

      // Alice finishes but doesn't win
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: seedData.participants[0].strava_athlete_id,
        stravaActivityId: '70201b',
        elapsedSeconds: 600,
      });

      const wins = await jerseyService.getParticipantTimeTrialWins(
        testSeason.id,
        seedData.participants[0].strava_athlete_id
      );

      expect(wins).toBe(0); // Hill week doesn't count as TT win
    });

    it('should count time trial week wins for a participant', async () => {
      // Create a dedicated season for this test
      const testSeason = createSeason(drizzleDb, 'TT Test - One Win');

      // Create a flat segment (time trial)
      const flatSegment = createSegment(drizzleDb, '70202', 'Flat Road', { averageGrade: 1 });
      const week = createWeek(drizzleDb, {
        seasonId: testSeason.id,
        stravaSegmentId: flatSegment.strava_segment_id,
        weekName: 'TT Week',
      });

      // Alice wins the time trial
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: seedData.participants[0].strava_athlete_id,
        stravaActivityId: '70202a',
        elapsedSeconds: 500,
      });

      // Bob finishes second
      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: seedData.participants[1].strava_athlete_id,
        stravaActivityId: '70202b',
        elapsedSeconds: 510,
      });

      const aliceWins = await jerseyService.getParticipantTimeTrialWins(
        testSeason.id,
        seedData.participants[0].strava_athlete_id
      );

      const bobWins = await jerseyService.getParticipantTimeTrialWins(
        testSeason.id,
        seedData.participants[1].strava_athlete_id
      );

      expect(aliceWins).toBe(1); // Alice won 1 time trial
      expect(bobWins).toBe(0); // Bob didn't win
    });

    it('should count multiple time trial wins across weeks', async () => {
      // Create a dedicated season for this test
      const testSeason = createSeason(drizzleDb, 'TT Test - Multiple Wins');

      // Create two time trial weeks
      const tt1 = createSegment(drizzleDb, '70203', 'TT 1', { averageGrade: 1.5 });
      const tt2 = createSegment(drizzleDb, '70204', 'TT 2', { averageGrade: 2 });

      const week1 = createWeek(drizzleDb, {
        seasonId: testSeason.id,
        stravaSegmentId: tt1.strava_segment_id,
        weekName: 'TT Week 1',
      });

      const week2 = createWeek(drizzleDb, {
        seasonId: testSeason.id,
        stravaSegmentId: tt2.strava_segment_id,
        weekName: 'TT Week 2',
      });

      const aliceId = seedData.participants[0].strava_athlete_id;
      const bobId = seedData.participants[1].strava_athlete_id;

      // Alice wins both TT weeks
      createActivityWithResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: aliceId,
        stravaActivityId: '70203a',
        elapsedSeconds: 500,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: bobId,
        stravaActivityId: '70203b',
        elapsedSeconds: 600,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week2.id,
        stravaAthleteId: aliceId,
        stravaActivityId: '70204a',
        elapsedSeconds: 400,
      });

      createActivityWithResult(drizzleDb, {
        weekId: week2.id,
        stravaAthleteId: bobId,
        stravaActivityId: '70204b',
        elapsedSeconds: 500,
      });

      const aliceWins = await jerseyService.getParticipantTimeTrialWins(
        testSeason.id,
        aliceId
      );

      const bobWins = await jerseyService.getParticipantTimeTrialWins(
        testSeason.id,
        bobId
      );

      expect(aliceWins).toBe(2); // Alice won both TT weeks
      expect(bobWins).toBe(0);
    });
  });

  describe('getPolkaDotWinner', () => {
    it('should return null if no hill climb weeks in season', async () => {
      // Create a dedicated test season for this test (don't reuse beforeAll seasons)
      const testSeason = createSeason(drizzleDb, 'Flat Only Season');

      // Create a flat week
      const flatSegment = createSegment(drizzleDb, '70105', 'Flat', { averageGrade: 1 });
      const week = createWeek(drizzleDb, {
        seasonId: testSeason.id,
        stravaSegmentId: flatSegment.strava_segment_id,
        weekName: 'All Flat',
      });

      createActivityWithResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: seedData.participants[0].strava_athlete_id,
        stravaActivityId: '70105',
        elapsedSeconds: 500,
      });

      // Check in the season with only flat weeks
      const winner = await jerseyService.getPolkaDotWinner(testSeason.id);

      expect(winner).toBeNull();
    });

    it('should identify polka dot winner correctly', async () => {
      // Create season with mixed weeks
      const testSeason = createSeason(drizzleDb, 'Polka Dot Test');

      const flatSegment = createSegment(drizzleDb, '70106', 'Flat', { averageGrade: 1 });
      const hill1 = createSegment(drizzleDb, '70107', 'Hill 1', { averageGrade: 4 });
      const hill2 = createSegment(drizzleDb, '70108', 'Hill 2', { averageGrade: 3.5 });

      const flatWeek = createWeek(drizzleDb, {
        seasonId: testSeason.id,
        stravaSegmentId: flatSegment.strava_segment_id,
        weekName: 'Flat',
      });

      const hillWeek1 = createWeek(drizzleDb, {
        seasonId: testSeason.id,
        stravaSegmentId: hill1.strava_segment_id,
        weekName: 'Hill 1',
      });

      const hillWeek2 = createWeek(drizzleDb, {
        seasonId: testSeason.id,
        stravaSegmentId: hill2.strava_segment_id,
        weekName: 'Hill 2',
      });

      const aliceId = seedData.participants[0].strava_athlete_id;
      const bobId = seedData.participants[1].strava_athlete_id;
      const charlieId = seedData.participants[2].strava_athlete_id;

      // Alice: wins flat (doesn't count) + hill1 = 1 polka dot
      createActivityWithResult(drizzleDb, {
        weekId: flatWeek.id,
        stravaAthleteId: aliceId,
        stravaActivityId: 'alice-flat',
        elapsedSeconds: 500,
      });

      createActivityWithResult(drizzleDb, {
        weekId: hillWeek1.id,
        stravaAthleteId: aliceId,
        stravaActivityId: 'alice-h1',
        elapsedSeconds: 300,
      });

      createActivityWithResult(drizzleDb, {
        weekId: hillWeek2.id,
        stravaAthleteId: aliceId,
        stravaActivityId: 'alice-h2',
        elapsedSeconds: 320,
      });

      // Bob: wins only hill2 = 1 polka dot
      createActivityWithResult(drizzleDb, {
        weekId: flatWeek.id,
        stravaAthleteId: bobId,
        stravaActivityId: 'bob-flat',
        elapsedSeconds: 700,
      });

      createActivityWithResult(drizzleDb, {
        weekId: hillWeek1.id,
        stravaAthleteId: bobId,
        stravaActivityId: 'bob-h1',
        elapsedSeconds: 400,
      });

      createActivityWithResult(drizzleDb, {
        weekId: hillWeek2.id,
        stravaAthleteId: bobId,
        stravaActivityId: 'bob-h2',
        elapsedSeconds: 310,
      });

      // Charlie: wins hill1 AND hill2 = 2 polka dots
      createActivityWithResult(drizzleDb, {
        weekId: flatWeek.id,
        stravaAthleteId: charlieId,
        stravaActivityId: 'charlie-flat',
        elapsedSeconds: 600,
      });

      createActivityWithResult(drizzleDb, {
        weekId: hillWeek1.id,
        stravaAthleteId: charlieId,
        stravaActivityId: 'charlie-h1',
        elapsedSeconds: 290,  // Fastest in hill1
      });

      createActivityWithResult(drizzleDb, {
        weekId: hillWeek2.id,
        stravaAthleteId: charlieId,
        stravaActivityId: 'charlie-h2',
        elapsedSeconds: 300,  // Fastest in hill2
      });

      const winner = await jerseyService.getPolkaDotWinner(testSeason.id);

      expect(winner).toBeDefined();
      expect(winner?.strava_athlete_id).toBe(charlieId);
      expect(winner?.polka_dot_wins).toBe(2);
      expect(winner?.name).toBe('Charlie');
    });
  });

});
