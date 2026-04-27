import type { Pool } from 'pg';
import type { AppDatabase } from '../../db/types';
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
  let pool: Pool;
  let orm: AppDatabase;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(async () => {
    // Setup fresh test DB for each test
    const setup = setupTestDb({ seed: false });
    pool = setup.pool;
    orm = setup.orm;
    await clearAllData(orm);
    caller = appRouter.createCaller(() =>
      createContext({
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

  it('should return null for non-existent athlete', async () => {
    const profile = await caller.profile.getMyProfile({ athleteId: '99999' });
    expect(profile).toBeNull();
  });

  it('should include timeTrialWins for flat segments (grade <= 2%)', async () => {
    const participant = await createParticipant(orm, '40001', 'TT Winner');
    const season = await createSeason(orm, 'Test Season', false);

    const ttSegment = await createSegment(orm, '40001', 'Flat Road', { averageGrade: 1.5 });
    const ttWeek = await createWeek(orm, {
      seasonId: season.id,
      stravaSegmentId: ttSegment.strava_segment_id,
      weekName: 'TT Week',
    });

    const activity = await createActivity(orm, {
      weekId: ttWeek.id,
      stravaAthleteId: participant.strava_athlete_id,
      stravaActivityId: '40001a',
    });

    await createSegmentEffort(orm, {
      activityId: activity.id,
      stravaSegmentId: ttSegment.strava_segment_id,
      elapsedSeconds: 500,
    });

    await createResult(orm, {
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
    const participant = await createParticipant(orm, '40002', 'HC Winner');
    const season = await createSeason(orm, 'Test Season', false);

    const hcSegment = await createSegment(orm, '40002', 'Mountain', { averageGrade: 5 });
    const hcWeek = await createWeek(orm, {
      seasonId: season.id,
      stravaSegmentId: hcSegment.strava_segment_id,
      weekName: 'HC Week',
    });

    const activity = await createActivity(orm, {
      weekId: hcWeek.id,
      stravaAthleteId: participant.strava_athlete_id,
      stravaActivityId: '40002a',
    });

    await createSegmentEffort(orm, {
      activityId: activity.id,
      stravaSegmentId: hcSegment.strava_segment_id,
      elapsedSeconds: 400,
    });

    await createResult(orm, {
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
