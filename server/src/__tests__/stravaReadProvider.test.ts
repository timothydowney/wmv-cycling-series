import { reloadConfig } from '../config';
import { setupTestDb, teardownTestDb } from './setupTestDb';
import { createParticipant } from './testDataHelpers';
import * as stravaClientModule from '../stravaClient';
import {
  checkClubMembership,
  getAuthStatusProfilePicture,
  getWebhookActivityDetails,
} from '../services/stravaReadProvider';

jest.mock('../stravaClient');

const mockStravaClient = stravaClientModule as jest.Mocked<typeof stravaClientModule>;

describe('stravaReadProvider', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    reloadConfig();
  });

  it('returns deterministic auth status profile pictures in fixture mode', async () => {
    process.env.STRAVA_API_MODE = 'fixture';
    reloadConfig();

    const testDb = setupTestDb({ seed: false });

    try {
      const profileUrl = await getAuthStatusProfilePicture('123456', testDb.drizzleDb);

      expect(profileUrl).toMatch(/^data:image\/svg\+xml/);
      expect(mockStravaClient.getAthleteProfile).not.toHaveBeenCalled();
    } finally {
      teardownTestDb(testDb.db);
    }
  });

  it('returns false for club membership in fixture mode without calling Strava', async () => {
    process.env.STRAVA_API_MODE = 'fixture';
    reloadConfig();

    const testDb = setupTestDb({ seed: false });

    try {
      const isMember = await checkClubMembership(testDb.drizzleDb, '123456', '1495648');

      expect(isMember).toBe(false);
      expect(mockStravaClient.getLoggedInAthlete).not.toHaveBeenCalled();
    } finally {
      teardownTestDb(testDb.db);
    }
  });

  it('returns null webhook activity details in fixture mode without calling Strava', async () => {
    process.env.STRAVA_API_MODE = 'fixture';
    reloadConfig();

    const testDb = setupTestDb({ seed: false });

    try {
      const details = await getWebhookActivityDetails(testDb.drizzleDb, '123456', '999888777');

      expect(details).toBeNull();
      expect(mockStravaClient.getActivity).not.toHaveBeenCalled();
    } finally {
      teardownTestDb(testDb.db);
    }
  });

  it('uses live mode club membership checks when STRAVA_API_MODE=live', async () => {
    process.env.STRAVA_API_MODE = 'live';
    reloadConfig();

    const testDb = setupTestDb({ seed: false });

    try {
      createParticipant(testDb.drizzleDb, '123456', 'Alice', true);
      mockStravaClient.getLoggedInAthlete.mockResolvedValue({
        id: 123456,
        firstname: 'Alice',
        lastname: 'Rider',
        clubs: [{ id: 1495648, name: 'Western Mass Velo' }],
      } as any);

      const isMember = await checkClubMembership(testDb.drizzleDb, '123456', '1495648');

      expect(isMember).toBe(true);
      expect(mockStravaClient.getLoggedInAthlete).toHaveBeenCalledTimes(1);
    } finally {
      teardownTestDb(testDb.db);
    }
  });
});