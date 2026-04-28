import type { AppDatabase } from '../db/types';
/**
 * Token Manager Tests
 * Tests for OAuth token lifecycle management
 */

import { getValidAccessToken } from '../tokenManager';
import { encryptToken, decryptToken } from '../encryption';
import { setupTestDb } from './setupTestDb';
import { participant, participantToken } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getOne } from '../db/asyncQuery';

// Mock Strava client interface
interface MockStravaClient {
  refreshAccessToken(token: string): Promise<{ access_token: string; refresh_token: string; expires_at: number }>;
}

describe('Token Manager', () => {
  let orm: AppDatabase;
  let mockStravaClient: MockStravaClient;
  const testAthleteId = '12345678';

  beforeEach(async () => {
    const { orm: testDb } = setupTestDb({ seed: false });
    orm = testDb;

    await orm.insert(participant).values({
      strava_athlete_id: testAthleteId,
      name: 'Token Test Athlete',
      active: true,
    }).execute();

    // Mock Strava client
    mockStravaClient = {
      refreshAccessToken: jest.fn()
    };
  });

  describe('getValidAccessToken', () => {
    it('should return cached token when not expiring soon', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 7200; // 2 hours
      const testAccessToken = 'test_access_token_123';
      const testRefreshToken = 'test_refresh_token_456';

      // Insert a token record
      await orm.insert(participantToken).values({
        strava_athlete_id: testAthleteId,
        access_token: encryptToken(testAccessToken),
        refresh_token: encryptToken(testRefreshToken),
        expires_at: futureExpiry,
        scope: 'activity:read'
      }).execute();

      const result = await getValidAccessToken(
        orm,
        mockStravaClient as MockStravaClient,
        testAthleteId
      );

      expect(result).toBe(testAccessToken);
      expect(mockStravaClient.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should refresh token when expiring soon (within 1 hour)', async () => {
      const soonExpiry = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
      const oldAccessToken = 'old_access_token';
      const oldRefreshToken = 'old_refresh_token';
      const newAccessToken = 'new_access_token';
      const newRefreshToken = 'new_refresh_token';
      const newExpiry = Math.floor(Date.now() / 1000) + 21600; // 6 hours

      // Insert old token
      await orm.insert(participantToken).values({
        strava_athlete_id: testAthleteId,
        access_token: encryptToken(oldAccessToken),
        refresh_token: encryptToken(oldRefreshToken),
        expires_at: soonExpiry,
        scope: 'activity:read'
      }).execute();

      // Mock refresh response
      (mockStravaClient.refreshAccessToken as jest.Mock).mockResolvedValue({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_at: newExpiry
      });

      const result = await getValidAccessToken(
        orm,
        mockStravaClient as MockStravaClient,
        testAthleteId
      );

      expect(result).toBe(newAccessToken);
      expect(mockStravaClient.refreshAccessToken).toHaveBeenCalledWith(oldRefreshToken);

      // Verify token was updated in database
      const updated = await getOne<typeof participantToken.$inferSelect>(
        orm
          .select()
          .from(participantToken)
          .where(eq(participantToken.strava_athlete_id, testAthleteId))
      );

      expect(updated).toBeDefined();
      if (updated) {
        expect(decryptToken(updated.access_token)).toBe(newAccessToken);
        expect(updated.expires_at).toBe(newExpiry);
      }
    });

    it('should handle decryption failure for plaintext tokens (migration case)', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 7200;
      const plaintextToken = 'plaintext_token'; // Not encrypted

      // Insert plaintext token (migration scenario)
      await orm.insert(participantToken).values({
        strava_athlete_id: testAthleteId,
        access_token: plaintextToken,
        refresh_token: 'plaintext_refresh',
        expires_at: futureExpiry,
        scope: 'activity:read'
      }).execute();

      const result = await getValidAccessToken(
        orm,
        mockStravaClient as MockStravaClient,
        testAthleteId
      );

      expect(result).toBe(plaintextToken);
      expect(mockStravaClient.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should throw error when participant not connected', async () => {
      await expect(
        getValidAccessToken(
          orm,
          mockStravaClient as MockStravaClient,
          testAthleteId
        )
      ).rejects.toThrow('Participant not connected to Strava');
    });

    it('should throw error when token refresh fails', async () => {
      const soonExpiry = Math.floor(Date.now() / 1000) + 1800;
      const oldAccessToken = 'old_token';
      const oldRefreshToken = 'old_refresh';

      await orm.insert(participantToken).values({
        strava_athlete_id: testAthleteId,
        access_token: encryptToken(oldAccessToken),
        refresh_token: encryptToken(oldRefreshToken),
        expires_at: soonExpiry,
        scope: 'activity:read'
      }).execute();

      (mockStravaClient.refreshAccessToken as jest.Mock).mockRejectedValue(
        new Error('Strava API error: Invalid refresh token')
      );

      await expect(
        getValidAccessToken(
          orm,
          mockStravaClient as MockStravaClient,
          testAthleteId
        )
      ).rejects.toThrow('Failed to refresh token');
    });

    it('should update database with new tokens after refresh', async () => {
      const soonExpiry = Math.floor(Date.now() / 1000) + 1800;
      const oldAccessToken = 'old_access';
      const oldRefreshToken = 'old_refresh';
      const newAccessToken = 'new_access';
      const newRefreshToken = 'new_refresh';
      const newExpiry = Math.floor(Date.now() / 1000) + 21600;

      await orm.insert(participantToken).values({
        strava_athlete_id: testAthleteId,
        access_token: encryptToken(oldAccessToken),
        refresh_token: encryptToken(oldRefreshToken),
        expires_at: soonExpiry,
        scope: 'activity:read'
      }).execute();

      (mockStravaClient.refreshAccessToken as jest.Mock).mockResolvedValue({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_at: newExpiry
      });

      await getValidAccessToken(
        orm,
        mockStravaClient as MockStravaClient,
        testAthleteId
      );

      const stored = await getOne<typeof participantToken.$inferSelect>(
        orm
          .select()
          .from(participantToken)
          .where(eq(participantToken.strava_athlete_id, testAthleteId))
      );

      expect(stored).toBeDefined();
      if (!stored) throw new Error('Token not stored');

      expect(decryptToken(stored.access_token)).toBe(newAccessToken);
      expect(decryptToken(stored.refresh_token)).toBe(newRefreshToken);
      expect(stored.expires_at).toBe(newExpiry);
    });

    it('should handle refresh token decryption failure (migration case)', async () => {
      const soonExpiry = Math.floor(Date.now() / 1000) + 1800;
      const encryptedAccessToken = 'encrypted_access';
      const plaintextRefreshToken = 'plaintext_refresh'; // Not encrypted
      const newAccessToken = 'new_access';
      const newRefreshToken = 'new_refresh';
      const newExpiry = Math.floor(Date.now() / 1000) + 21600;

      await orm.insert(participantToken).values({
        strava_athlete_id: testAthleteId,
        access_token: encryptedAccessToken,
        refresh_token: plaintextRefreshToken,
        expires_at: soonExpiry,
        scope: 'activity:read'
      }).execute();

      (mockStravaClient.refreshAccessToken as jest.Mock).mockResolvedValue({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_at: newExpiry
      });

      const result = await getValidAccessToken(
        orm,
        mockStravaClient as MockStravaClient,
        testAthleteId
      );

      expect(result).toBe(newAccessToken);
      expect(mockStravaClient.refreshAccessToken).toHaveBeenCalledWith(plaintextRefreshToken);
    });

    it('should handle multiple sequential calls correctly', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 7200;
      const testAccessToken = 'test_token';
      const testRefreshToken = 'test_refresh';

      await orm.insert(participantToken).values({
        strava_athlete_id: testAthleteId,
        access_token: encryptToken(testAccessToken),
        refresh_token: encryptToken(testRefreshToken),
        expires_at: futureExpiry,
        scope: 'activity:read'
      }).execute();

      // First call
      const result1 = await getValidAccessToken(
        orm,
        mockStravaClient as MockStravaClient,
        testAthleteId
      );
      expect(result1).toBe(testAccessToken);

      // Second call should work independently
      const result2 = await getValidAccessToken(
        orm,
        mockStravaClient as MockStravaClient,
        testAthleteId
      );
      expect(result2).toBe(testAccessToken);

      expect(mockStravaClient.refreshAccessToken).not.toHaveBeenCalled();
    });
  });
});
