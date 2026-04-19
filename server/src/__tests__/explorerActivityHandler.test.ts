import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  clearAllData,
  createExplorerCampaign,
  createExplorerDestination,
  createParticipant,
  setupTestDb,
  teardownTestDb,
} from './testDataHelpers';
import { explorerDestinationMatch } from '../db/schema';
import { createDefaultActivityHandlers } from '../webhooks/activityHandlers';
import { createExplorerActivityHandler } from '../webhooks/handlers/explorerActivityHandler';

describe('explorerActivityHandler', () => {
  let db: Database;
  let drizzleDb: BetterSQLite3Database;

  beforeAll(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    drizzleDb = testDb.drizzleDb;
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  beforeEach(() => {
    clearAllData(drizzleDb);
  });

  it('is included in the default handler pipeline', () => {
    const handlerNames = createDefaultActivityHandlers().map((handler) => handler.name);
    expect(handlerNames).toContain('explorer');
  });

  it('records Explorer matches from webhook activity data', async () => {
    createParticipant(drizzleDb, '4001', 'Webhook Rider');
    const campaign = createExplorerCampaign(drizzleDb, {
      startAt: 1748736000,
      endAt: 1751327999,
    });

    createExplorerDestination(drizzleDb, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-601',
    });

    const handler = createExplorerActivityHandler();
    await handler.handle({
      db: drizzleDb,
      event: {
        aspect_type: 'create',
        event_time: 0,
        object_id: 601,
        object_type: 'activity',
        owner_id: 4001,
        subscription_id: 1,
      },
      activityId: 'activity-601',
      athleteId: '4001',
      participantRecord: {
        strava_athlete_id: '4001',
        name: 'Webhook Rider',
      },
      accessToken: 'unused',
      athleteWeight: null,
      initialActivityData: {
        id: 'activity-601',
        name: 'Webhook Ride',
        start_date: '2025-06-03T09:00:00Z',
        segment_efforts: [],
      },
      validationService: {} as any,
      getActivityWithSegmentEfforts: async () => ({
        id: 'activity-601',
        name: 'Webhook Ride',
        start_date: '2025-06-03T09:00:00Z',
        segment_efforts: [
          {
            id: 'effort-601',
            elapsed_time: 190,
            start_date: '2025-06-03T09:05:00Z',
            segment: { id: 'seg-601' },
          },
        ],
      }),
    });

    const matches = drizzleDb.select().from(explorerDestinationMatch).all();
    expect(matches).toHaveLength(1);
    expect(matches[0]?.strava_athlete_id).toBe('4001');
  });
});