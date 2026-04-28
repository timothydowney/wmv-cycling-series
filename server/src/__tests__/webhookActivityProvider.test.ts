import type { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { reloadConfig } from '../config';
import { setupTestDb, teardownTestDb } from './setupTestDb';
import { createParticipant } from './testDataHelpers';
import ActivityValidationService from '../services/ActivityValidationService';
import { createActivityIngestionContext } from '../webhooks/activityContext';
import { type ActivityWebhookEvent } from '../webhooks/types';
import {
  getWebhookActivityFixtureCallLog,
  resetWebhookActivityFixtures,
  seedWebhookActivityFixture,
} from '../services/webhookActivityProvider';
import { getValidAccessToken } from '../tokenManager';
import { captureAthleteProfile } from '../services/StravaProfileCapture';
import * as stravaClientModule from '../stravaClient';

jest.mock('../tokenManager');
jest.mock('../services/StravaProfileCapture');
jest.mock('../stravaClient');

describe('webhookActivityProvider', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
    resetWebhookActivityFixtures();
  });

  afterEach(async () => {
    process.env = originalEnv;
    reloadConfig();
    resetWebhookActivityFixtures();
  });

  it('builds activity ingestion context from fixtures without live token or profile calls', async () => {
    process.env.STRAVA_API_MODE = 'fixture';
    reloadConfig();

    const testDb = setupTestDb({ seed: false });

    try {
      await createParticipant(testDb.orm, '123456', 'Fixture Rider', false);

      seedWebhookActivityFixture('555001', {
        id: '555001',
        name: 'Fixture Activity',
        start_date: '2025-10-28T12:00:00Z',
        type: 'Ride',
        segment_efforts: [
          {
            id: '55500101',
            segment: { id: '12345678', name: 'Fixture Segment' },
            elapsed_time: 480,
            start_date: '2025-10-28T12:05:00Z'
          }
        ]
      });

      const webhookEvent: ActivityWebhookEvent = {
        object_id: 555001,
        owner_id: 123456,
        object_type: 'activity',
        aspect_type: 'create',
        event_time: 1761652800,
        subscription_id: 1,
      };

      const context = await createActivityIngestionContext(
        webhookEvent,
        testDb.orm,
        new ActivityValidationService(testDb.orm)
      );

      expect(context).not.toBeNull();
      expect(context?.accessToken).toBe('fixture-token');
      expect(context?.athleteWeight).toBeNull();
      expect(context?.initialActivityData.id).toBe('555001');
      expect(context?.initialActivityData.segment_efforts).toHaveLength(1);
      expect(getValidAccessToken).not.toHaveBeenCalled();
      expect(captureAthleteProfile).not.toHaveBeenCalled();
      expect(stravaClientModule.getActivity).not.toHaveBeenCalled();
      expect(getWebhookActivityFixtureCallLog()).toHaveLength(1);
    } finally {
      teardownTestDb(testDb.pool);
    }
  });

  it('uses a seeded harness fixture in live mode without refreshing tokens', async () => {
    process.env.STRAVA_API_MODE = 'live';
    reloadConfig();

    const testDb = setupTestDb({ seed: false });

    try {
      await createParticipant(testDb.orm, '123456', 'Harness Rider', false);

      seedWebhookActivityFixture('555002', {
        id: '555002',
        name: 'Harness Fixture Activity',
        start_date: '2025-10-28T12:00:00Z',
        type: 'Ride',
        segment_efforts: [
          {
            id: '55500201',
            segment: { id: '12345679', name: 'Fixture Segment' },
            elapsed_time: 450,
            start_date: '2025-10-28T12:05:00Z'
          }
        ]
      });

      const webhookEvent: ActivityWebhookEvent = {
        object_id: 555002,
        owner_id: 123456,
        object_type: 'activity',
        aspect_type: 'create',
        event_time: 1761652800,
        subscription_id: 1,
      };

      const context = await createActivityIngestionContext(
        webhookEvent,
        testDb.orm,
        new ActivityValidationService(testDb.orm)
      );

      expect(context).not.toBeNull();
      expect(context?.accessToken).toBe('fixture-token');
      expect(context?.initialActivityData.id).toBe('555002');
      expect(getValidAccessToken).not.toHaveBeenCalled();
      expect(captureAthleteProfile).not.toHaveBeenCalled();
      expect(stravaClientModule.getActivity).not.toHaveBeenCalled();
    } finally {
      teardownTestDb(testDb.pool);
    }
  });
});