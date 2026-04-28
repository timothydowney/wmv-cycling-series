import type { Pool } from 'pg';
import { reloadConfig } from '../config';
import { encryptToken } from '../encryption';
import { setupTestDb, teardownTestDb } from './setupTestDb';
import { createParticipant } from './testDataHelpers';
import * as stravaClientModule from '../stravaClient';
import {
  resetWebhookActivityFixtures,
  seedWebhookActivityFixture,
} from '../services/webhookActivityProvider';
import {
  checkClubMembership,
  clearWebhookActivityDetailsCache,
  getAuthStatusProfilePicture,
  getWebhookActivityDetails,
  getWebhookActivityDetailsResult,
} from '../services/stravaReadProvider';

jest.mock('../stravaClient');

const mockStravaClient = stravaClientModule as jest.Mocked<typeof stravaClientModule>;

describe('stravaReadProvider', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
    resetWebhookActivityFixtures();
    clearWebhookActivityDetailsCache();
  });

  afterEach(async () => {
    process.env = originalEnv;
    reloadConfig();
    resetWebhookActivityFixtures();
    clearWebhookActivityDetailsCache();
  });

  it('returns deterministic auth status profile pictures in fixture mode', async () => {
    process.env.STRAVA_API_MODE = 'fixture';
    reloadConfig();

    const testDb = setupTestDb({ seed: false });

    try {
      const profileUrl = await getAuthStatusProfilePicture('123456', testDb.orm);

      expect(profileUrl).toMatch(/^data:image\/svg\+xml/);
      expect(mockStravaClient.getAthleteProfile).not.toHaveBeenCalled();
    } finally {
      teardownTestDb(testDb.pool);
    }
  });

  it('returns false for club membership in fixture mode without calling Strava', async () => {
    process.env.STRAVA_API_MODE = 'fixture';
    reloadConfig();

    const testDb = setupTestDb({ seed: false });

    try {
      const isMember = await checkClubMembership(testDb.orm, '123456', '1495648');

      expect(isMember).toBe(false);
      expect(mockStravaClient.getLoggedInAthlete).not.toHaveBeenCalled();
    } finally {
      teardownTestDb(testDb.pool);
    }
  });

  it('returns null webhook activity details in fixture mode without calling Strava', async () => {
    process.env.STRAVA_API_MODE = 'fixture';
    reloadConfig();

    const testDb = setupTestDb({ seed: false });

    try {
      const details = await getWebhookActivityDetails(testDb.orm, '123456', '999888777');

      expect(details).toBeNull();
      expect(mockStravaClient.getActivity).not.toHaveBeenCalled();
    } finally {
      teardownTestDb(testDb.pool);
    }
  });

  it('returns seeded harness webhook activity details in live mode without calling Strava', async () => {
    process.env.STRAVA_API_MODE = 'live';
    reloadConfig();

    const testDb = setupTestDb({ seed: false });

    try {
      seedWebhookActivityFixture('999888777', {
        id: '999888777',
        name: 'Harness Admin Preview',
        start_date: '2025-10-28T12:00:00Z',
        sport_type: 'Ride',
        distance: 12345,
        moving_time: 2222,
        total_elevation_gain: 333,
        device_name: 'Harness Trainer',
        segment_efforts: [
          {
            id: '99988877701',
            segment: { id: '12345678', name: 'Fixture Segment' },
            elapsed_time: 480,
            start_date: '2025-10-28T12:05:00Z'
          }
        ]
      });

      const details = await getWebhookActivityDetails(testDb.orm, '123456', '999888777');

      expect(details).toEqual({
        activity_id: '999888777',
        name: 'Harness Admin Preview',
        type: 'Ride',
        distance_m: 12345,
        moving_time_sec: 2222,
        elevation_gain_m: 333,
        start_date_iso: '2025-10-28T12:00:00Z',
        device_name: 'Harness Trainer',
        segment_effort_count: 1,
        visibility: null,
      });
      expect(mockStravaClient.getActivity).not.toHaveBeenCalled();
    } finally {
      teardownTestDb(testDb.pool);
    }
  });

  it('uses live mode club membership checks when STRAVA_API_MODE=live', async () => {
    process.env.STRAVA_API_MODE = 'live';
    reloadConfig();

    const testDb = setupTestDb({ seed: false });

    try {
      await createParticipant(testDb.orm, '123456', 'Alice', {
        accessToken: encryptToken('test-access-token'),
        refreshToken: encryptToken('test-refresh-token'),
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
      });
      mockStravaClient.getLoggedInAthlete.mockResolvedValue({
        id: 123456,
        firstname: 'Alice',
        lastname: 'Rider',
        clubs: [{ id: 1495648, name: 'Western Mass Velo' }],
      } as any);

      const isMember = await checkClubMembership(testDb.orm, '123456', '1495648');

      expect(isMember).toBe(true);
      expect(mockStravaClient.getLoggedInAthlete).toHaveBeenCalledTimes(1);
    } finally {
      teardownTestDb(testDb.pool);
    }
  });

  it('classifies missing activity details as private or unavailable and caches the result briefly', async () => {
    process.env.STRAVA_API_MODE = 'live';
    reloadConfig();

    const testDb = setupTestDb({ seed: false });

    try {
      await createParticipant(testDb.orm, '123456', 'Alice', {
        accessToken: encryptToken('test-access-token'),
        refreshToken: encryptToken('test-refresh-token'),
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
      });
      mockStravaClient.getActivity.mockRejectedValue({ statusCode: 404 });

      const firstResult = await getWebhookActivityDetailsResult(testDb.orm, '123456', '999000111');
      const secondResult = await getWebhookActivityDetailsResult(testDb.orm, '123456', '999000111');

      expect(firstResult).toMatchObject({
        details: null,
        status: 'private_or_unavailable',
        cached: false,
      });
      expect(secondResult).toMatchObject({
        details: null,
        status: 'private_or_unavailable',
        cached: true,
      });
      expect(mockStravaClient.getActivity).toHaveBeenCalledTimes(1);
    } finally {
      teardownTestDb(testDb.pool);
    }
  });
});