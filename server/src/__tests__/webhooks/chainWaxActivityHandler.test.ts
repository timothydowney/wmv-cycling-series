import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import Database from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { setupTestDb } from '../setupTestDb';
import { chainWaxActivity, chainWaxPeriod, chainWaxPuck } from '../../db/schema';
import { createChainWaxActivityHandler, type ActivityIngestionContext } from '../../webhooks/activityHandlers';
import { createWebhookProcessor, type WebhookService } from '../../webhooks/processor';
import { ChainWaxService } from '../../services/ChainWaxService';

function seedChainWaxState(orm: BetterSQLite3Database): void {
  const now = Math.floor(Date.now() / 1000);
  orm.insert(chainWaxPeriod).values({
    started_at: now - 3600,
    total_distance_meters: 0,
    created_at: now
  }).run();
  orm.insert(chainWaxPuck).values({
    started_at: now,
    wax_count: 0,
    is_current: true,
    created_at: now
  }).run();
}

function createContext(orm: BetterSQLite3Database): ActivityIngestionContext {
  return {
    db: orm,
    event: {
      object_type: 'activity',
      aspect_type: 'create',
      object_id: 987654321,
      owner_id: 366880,
      event_time: Math.floor(Date.now() / 1000),
      subscription_id: 1
    },
    activityId: '987654321',
    athleteId: '366880',
    participantRecord: { strava_athlete_id: '366880', name: 'Tracked Rider' },
    accessToken: 'token',
    athleteWeight: null,
    initialActivityData: {
      id: '987654321',
      name: 'Trainer Ride',
      start_date: new Date().toISOString(),
      type: 'VirtualRide',
      distance: 25000,
      segment_efforts: []
    },
    validationService: {} as any,
    getActivityWithSegmentEfforts: async () => null
  };
}

function createMockLogger() {
  return {
    logEvent: jest.fn(),
    markProcessed: jest.fn(),
    markFailed: jest.fn(),
    getLog: jest.fn(),
    getFailedEvents: jest.fn()
  };
}

describe('chainWaxActivityHandler', () => {
  let db: Database.Database;
  let orm: BetterSQLite3Database;

  beforeEach(() => {
    const testDb = setupTestDb({ seed: false });
    db = testDb.db;
    orm = testDb.orm || testDb.drizzleDb;
    seedChainWaxState(orm);
  });

  it('records tracked VirtualRide activities', async () => {
    const handler = createChainWaxActivityHandler();
    const context = createContext(orm);

    await handler.handle(context);

    const waxActivity = orm
      .select()
      .from(chainWaxActivity)
      .where(eq(chainWaxActivity.strava_activity_id, '987654321'))
      .get();

    expect(waxActivity).toBeDefined();
    expect(waxActivity?.distance_meters).toBe(25000);
  });

  it('ignores untracked or non-virtual activities', async () => {
    const handler = createChainWaxActivityHandler();
    const context = {
      ...createContext(orm),
      athleteId: '999999',
      participantRecord: { strava_athlete_id: '999999', name: 'Other Rider' },
      initialActivityData: {
        ...createContext(orm).initialActivityData,
        type: 'Ride'
      }
    };

    await handler.handle(context);

    const waxActivity = orm.select().from(chainWaxActivity).all();
    expect(waxActivity).toHaveLength(0);
  });

  it('keeps delete-event chain wax cleanup in the processor path', async () => {
    const now = Math.floor(Date.now() / 1000);
    const chainWaxService = new ChainWaxService(orm);
    chainWaxService.recordActivity('987654321', '366880', 5000, now);

    const deleteActivityMock = jest.fn().mockReturnValue({ deleted: false, changes: 0 });
    const deleteAthleteTokensMock = jest.fn().mockReturnValue({ deleted: false, changes: 0 });
    const findParticipantByAthleteIdMock = jest.fn().mockReturnValue(undefined);

    const mockService: WebhookService = {
      deleteActivity: ((stravaActivityId: string) => deleteActivityMock(stravaActivityId)) as WebhookService['deleteActivity'],
      deleteAthleteTokens: ((athleteId: string) => deleteAthleteTokensMock(athleteId)) as WebhookService['deleteAthleteTokens'],
      findParticipantByAthleteId: ((athleteId: string) => findParticipantByAthleteIdMock(athleteId)) as WebhookService['findParticipantByAthleteId']
    };

    const processor = createWebhookProcessor(orm, mockService);

    await processor(
      {
        object_type: 'activity',
        aspect_type: 'delete',
        object_id: 987654321,
        owner_id: 366880,
        event_time: now,
        subscription_id: 1
      },
      createMockLogger() as any
    );

    const waxActivity = orm
      .select()
      .from(chainWaxActivity)
      .where(eq(chainWaxActivity.strava_activity_id, '987654321'))
      .get();

    expect(deleteActivityMock).toHaveBeenCalledWith('987654321');
    expect(waxActivity).toBeUndefined();
  });
});