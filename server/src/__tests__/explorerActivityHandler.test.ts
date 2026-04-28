import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
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
  let pool: Pool;
  let orm: AppDatabase;

  beforeAll(async () => {
    const testDb = setupTestDb({ seed: false });
    pool = testDb.pool;
    orm = testDb.orm;
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  beforeEach(async () => {
    await clearAllData(orm);
  });

  it('is included in the default handler pipeline', async () => {
    const handlerNames = createDefaultActivityHandlers().map((handler) => handler.name);
    expect(handlerNames).toContain('explorer');
  });

  it('records Explorer matches from webhook activity data', async () => {
    await createParticipant(orm, '4001', 'Webhook Rider');
    const campaign = await createExplorerCampaign(orm, {
      startAt: 1748736000,
      endAt: 1751327999,
    });

    await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-601',
    });

    const handler = createExplorerActivityHandler();
    await handler.handle({
      db: orm,
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

    const matches = await orm.select().from(explorerDestinationMatch).execute();
    expect(matches).toHaveLength(1);
    expect(matches[0]?.strava_athlete_id).toBe('4001');
  });
});