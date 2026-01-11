import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { setupTestDb, teardownTestDb, clearAllData } from '../testDataHelpers';
import {
  createParticipant,
  createSegment,
  createSeason,
  createWeek,
  createActivity,
  createSegmentEffort,
  createResult,
} from '../testDataHelpers';

describe('profileRouter.getMyProfile', () => {
  let db: any;
  let drizzleDb: any;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    // Setup fresh test DB for each test
    const setup = setupTestDb();
    db = setup.db;
    drizzleDb = setup.drizzleDb;
    clearAllData(drizzleDb);
    caller = appRouter.createCaller(
      createContext({
        dbOverride: db,
        drizzleDbOverride: drizzleDb,
        req: {} as any,
        res: {} as any,
      })
    );
  });

  afterEach(() => {
    teardownTestDb(db);
  });

  it('should return null for non-existent athlete', async () => {
    const profile = await caller.profile.getMyProfile({ athleteId: '99999' });
    expect(profile).toBeNull();
  });

  it('should include timeTrialWins for flat segments (grade <= 2%)', async () => {
    const participant = createParticipant(drizzleDb, '40001', 'TT Winner');
    const season = createSeason(drizzleDb, 'Test Season', false);

    const ttSegment = createSegment(drizzleDb, '40001', 'Flat Road', { averageGrade: 1.5 });
    const ttWeek = createWeek(drizzleDb, {
      seasonId: season.id,
      stravaSegmentId: ttSegment.strava_segment_id,
      weekName: 'TT Week',
    });

    const activity = createActivity(drizzleDb, {
      weekId: ttWeek.id,
      stravaAthleteId: participant.strava_athlete_id,
      stravaActivityId: '40001a',
    });

    createSegmentEffort(drizzleDb, {
      activityId: activity.id,
      stravaSegmentId: ttSegment.strava_segment_id,
      elapsedSeconds: 500,
    });

    createResult(drizzleDb, {
      weekId: ttWeek.id,
      stravaAthleteId: participant.strava_athlete_id,
      activityId: activity.id,
      totalTimeSeconds: 500,
    });

    const profile = await caller.profile.getMyProfile({ athleteId: participant.strava_athlete_id });

    expect(profile?.seasonStats[0].timeTrialWins).toBe(1);
    expect(profile?.seasonStats[0].polkaDotWins).toBe(0);
  });

  it('should include polkaDotWins for steep segments (grade > 2%)', async () => {
    const participant = createParticipant(drizzleDb, '40002', 'HC Winner');
    const season = createSeason(drizzleDb, 'Test Season', false);

    const hcSegment = createSegment(drizzleDb, '40002', 'Mountain', { averageGrade: 5 });
    const hcWeek = createWeek(drizzleDb, {
      seasonId: season.id,
      stravaSegmentId: hcSegment.strava_segment_id,
      weekName: 'HC Week',
    });

    const activity = createActivity(drizzleDb, {
      weekId: hcWeek.id,
      stravaAthleteId: participant.strava_athlete_id,
      stravaActivityId: '40002a',
    });

    createSegmentEffort(drizzleDb, {
      activityId: activity.id,
      stravaSegmentId: hcSegment.strava_segment_id,
      elapsedSeconds: 400,
    });

    createResult(drizzleDb, {
      weekId: hcWeek.id,
      stravaAthleteId: participant.strava_athlete_id,
      activityId: activity.id,
      totalTimeSeconds: 400,
    });

    const profile = await caller.profile.getMyProfile({ athleteId: participant.strava_athlete_id });

    expect(profile?.seasonStats[0].timeTrialWins).toBe(0);
    expect(profile?.seasonStats[0].polkaDotWins).toBe(1);
  });
});
