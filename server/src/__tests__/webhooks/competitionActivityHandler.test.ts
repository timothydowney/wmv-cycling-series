// @ts-nocheck
import type { Pool } from 'pg';
import type { AppDatabase } from '../../db/types';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { setupTestDb } from '../setupTestDb';
import { createParticipant, createSeason, createSegment, createWeek } from '../testDataHelpers';
import ActivityValidationService from '../../services/ActivityValidationService';
import { activity, result, segmentEffort } from '../../db/schema';
import { createCompetitionActivityHandler, type ActivityIngestionContext } from '../../webhooks/activityHandlers';
import { findBestQualifyingActivity } from '../../activityProcessor';

jest.mock('../../activityProcessor', () => {
  const actual = jest.requireActual('../../activityProcessor') as Record<string, unknown>;
  return {
    ...actual,
    findBestQualifyingActivity: jest.fn()
  };
});

describe('competitionActivityHandler', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let validationService: ActivityValidationService;
  let mockedFindBestQualifyingActivity: jest.MockedFunction<typeof findBestQualifyingActivity>;

  const firstRow = async <T>(query: { execute: () => Promise<T[]> }): Promise<T | undefined> => {
    const rows = await query.execute();
    return rows[0];
  };

  const allRows = async <T>(query: { execute: () => Promise<T[]> }): Promise<T[]> => {
    return query.execute();
  };

  beforeEach(async () => {
    const testDb = setupTestDb({ seed: false });
    pool = testDb.pool;
    orm = testDb.orm || testDb.orm;
    validationService = new ActivityValidationService(orm);
    mockedFindBestQualifyingActivity = findBestQualifyingActivity as jest.MockedFunction<typeof findBestQualifyingActivity>;
    jest.clearAllMocks();
  });

  it('stores qualifying competition activity data for a matching week', async () => {
    const now = Date.now();
    const activityStartIso = new Date(now).toISOString();
    const activityStartUnix = Math.floor(now / 1000);
    await createParticipant(orm, '100', 'Test Athlete');
    const seasonRecord = await createSeason(orm, 'Spring Season', true, {
      startAt: activityStartUnix - 86400,
      endAt: activityStartUnix + 86400
    });
    await createSegment(orm, '123456', 'Hill Climb');
    const weekRecord = await createWeek(orm, {
      seasonId: seasonRecord.id,
      stravaSegmentId: '123456',
      weekName: 'Week 1',
      startTime: new Date(now - 3600_000).toISOString(),
      endTime: new Date(now + 3600_000).toISOString()
    });

    mockedFindBestQualifyingActivity.mockResolvedValue({
      id: '987654321',
      name: 'Race Day Ride',
      start_date: activityStartIso,
      totalTime: 600,
      segmentEfforts: [
        {
          id: 'effort-1',
          segment: { id: '123456', name: 'Hill Climb' },
          elapsed_time: 600,
          start_date: activityStartIso,
          pr_rank: 1
        }
      ],
      activity_url: 'https://www.strava.com/activities/987654321',
      device_name: 'Zwift'
    });

    const context: ActivityIngestionContext = {
      db: orm,
      event: {
        object_type: 'activity',
        aspect_type: 'create',
        object_id: 987654321,
        owner_id: 100,
        event_time: Math.floor(Date.now() / 1000),
        subscription_id: 1
      },
      activityId: '987654321',
      athleteId: '100',
      participantRecord: { strava_athlete_id: '100', name: 'Test Athlete' },
      accessToken: 'token',
      athleteWeight: 72,
      initialActivityData: {
        id: '987654321',
        name: 'Race Day Ride',
        start_date: activityStartIso,
        type: 'Ride',
        segment_efforts: []
      },
      validationService,
      getActivityWithSegmentEfforts: async () => ({
        id: '987654321',
        name: 'Race Day Ride',
        start_date: activityStartIso,
        type: 'Ride',
        segment_efforts: []
      })
    };

    await createCompetitionActivityHandler().handle(context);

    const storedActivity = await firstRow(orm
      .select()
      .from(activity)
      .where(eq(activity.week_id, weekRecord.id)));
    const storedResult = await firstRow(orm
      .select()
      .from(result)
      .where(eq(result.week_id, weekRecord.id)));
    const storedEfforts = await allRows(orm
      .select()
      .from(segmentEffort)
    );

    expect(mockedFindBestQualifyingActivity).toHaveBeenCalledTimes(1);
    expect(storedActivity?.strava_activity_id).toBe('987654321');
    expect(storedActivity?.athlete_weight).toBe(72);
    expect(storedResult?.total_time_seconds).toBe(600);
    expect(storedEfforts).toHaveLength(1);
    expect(storedEfforts[0].strava_segment_id).toBe('123456');
  });

  it('skips competition processing when the activity is outside every active season', async () => {
    const now = Date.now();
    const nowUnix = Math.floor(now / 1000);
    await createParticipant(orm, '100', 'Test Athlete');
    await createSeason(orm, 'Spring Season', true, {
      startAt: nowUnix - 86400,
      endAt: nowUnix + 86400
    });
    await createSegment(orm, '123456', 'Hill Climb');
    await createWeek(orm, {
      seasonId: 1,
      stravaSegmentId: '123456',
      weekName: 'Week 1',
      startTime: new Date(now - 3600_000).toISOString(),
      endTime: new Date(now + 3600_000).toISOString()
    });

    const context: ActivityIngestionContext = {
      db: orm,
      event: {
        object_type: 'activity',
        aspect_type: 'create',
        object_id: 987654321,
        owner_id: 100,
        event_time: Math.floor(Date.now() / 1000),
        subscription_id: 1
      },
      activityId: '987654321',
      athleteId: '100',
      participantRecord: { strava_athlete_id: '100', name: 'Test Athlete' },
      accessToken: 'token',
      athleteWeight: null,
      initialActivityData: {
        id: '987654321',
        name: 'Late Ride',
        start_date: '2027-06-01T10:00:00Z',
        type: 'Ride',
        segment_efforts: []
      },
      validationService,
      getActivityWithSegmentEfforts: async () => ({
        id: '987654321',
        name: 'Late Ride',
        start_date: '2027-06-01T10:00:00Z',
        type: 'Ride',
        segment_efforts: []
      })
    };

    await createCompetitionActivityHandler().handle(context);

    expect(mockedFindBestQualifyingActivity).not.toHaveBeenCalled();
    expect(await allRows(orm.select().from(activity))).toHaveLength(0);
    expect(await allRows(orm.select().from(result))).toHaveLength(0);
    expect(await allRows(orm.select().from(segmentEffort))).toHaveLength(0);
  });
});