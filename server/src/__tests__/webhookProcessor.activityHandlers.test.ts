import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Database } from 'better-sqlite3';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { setupTestDb } from './setupTestDb';
import { createParticipant } from './testDataHelpers';
import { WebhookLogger } from '../webhooks/logger';
import {
  type ActivityIngestionContext,
  type ActivityWebhookHandler
} from '../webhooks/activityHandlers';
import { createWebhookProcessor } from '../webhooks/processor';

jest.mock('../stravaClient', () => ({
  getActivity: jest.fn(),
  getAthleteProfile: jest.fn()
}));

jest.mock('../tokenManager', () => ({
  getValidAccessToken: jest.fn()
}));

import * as stravaClient from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';

describe('Webhook Processor - Activity Handlers', () => {
  let db: Database;
  let orm: BetterSQLite3Database;
  let logger: WebhookLogger;

  beforeEach(() => {
    const testDb = setupTestDb({ seed: false });
    db = testDb.db;
    orm = testDb.orm || testDb.drizzleDb;
    logger = new WebhookLogger(orm);

    createParticipant(orm, '100', 'Test Athlete', { accessToken: 'fake_token' });

    jest.mocked(getValidAccessToken).mockResolvedValue('fake_token');
    jest.mocked(stravaClient.getAthleteProfile).mockResolvedValue({ weight: 72 });
    jest.mocked(stravaClient.getActivity).mockResolvedValue({
      id: 987654321,
      name: 'Morning Ride',
      start_date: '2025-06-01T10:00:00Z',
      type: 'Ride',
      distance: 12345,
      segment_efforts: []
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    db.close();
  });

  it('passes a shared normalized context to registered activity handlers in order', async () => {
    const callOrder: string[] = [];
    const receivedContexts: ActivityIngestionContext[] = [];

    const handlers: ActivityWebhookHandler[] = [
      {
        name: 'first-handler',
        handle: async (context) => {
          callOrder.push('first');
          receivedContexts.push(context);
        }
      },
      {
        name: 'second-handler',
        handle: async (context) => {
          callOrder.push('second');
          receivedContexts.push(context);
        }
      }
    ];

    const processor = createWebhookProcessor(orm, undefined, { activityHandlers: handlers });

    await processor(
      {
        object_type: 'activity',
        aspect_type: 'create',
        object_id: 987654321,
        owner_id: 100,
        event_time: Math.floor(Date.now() / 1000),
        subscription_id: 1
      },
      logger
    );

    expect(callOrder).toEqual(['first', 'second']);
    expect(receivedContexts).toHaveLength(2);
    expect(receivedContexts[0]).toBe(receivedContexts[1]);
    expect(receivedContexts[0]).toMatchObject({
      accessToken: 'fake_token',
      activityId: '987654321',
      athleteId: '100',
      athleteWeight: 72,
      participantRecord: {
        name: 'Test Athlete',
        strava_athlete_id: '100'
      },
      initialActivityData: {
        id: 987654321,
        name: 'Morning Ride'
      }
    });
    expect(stravaClient.getActivity).toHaveBeenCalledTimes(1);
  });

  it('continues past optional handler failures without aborting the event', async () => {
    const successfulHandler = jest.fn(async () => undefined);
    const handlers: ActivityWebhookHandler[] = [
      {
        name: 'non-blocking-handler',
        isolateErrors: true,
        handle: async () => {
          throw new Error('non-blocking failure');
        }
      },
      {
        name: 'successful-handler',
        handle: successfulHandler
      }
    ];

    const processor = createWebhookProcessor(orm, undefined, { activityHandlers: handlers });

    await processor(
      {
        object_type: 'activity',
        aspect_type: 'update',
        object_id: 987654321,
        owner_id: 100,
        event_time: Math.floor(Date.now() / 1000),
        subscription_id: 1
      },
      logger
    );

    expect(successfulHandler).toHaveBeenCalledTimes(1);
  });
});