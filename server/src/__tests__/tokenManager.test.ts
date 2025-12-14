/**
 * Token Manager Tests
 * Tests for OAuth token lifecycle management
 */

import { getValidAccessToken } from '../tokenManager';
import { encryptToken, decryptToken } from '../encryption';
import { setupTestDb } from './setupTestDb';
import { participantToken } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

// Mock Strava client interface
interface MockStravaClient {
  refreshAccessToken(token: string): Promise<{ access_token: string; refresh_token: string; expires_at: number }>;
}

describe('Token Manager', () => {
  let drizzleDb: BetterSQLite3Database;
  let mockStravaClient: MockStravaClient;
  const testAthleteId = 12345678;

  beforeEach(() => {
    const { drizzleDb: testDb } = setupTestDb({ seed: false });
    drizzleDb = testDb;

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
      drizzleDb.insert(participantToken).values({
        strava_athlete_id: testAthleteId,
        access_token: encryptToken(testAccessToken),
        refresh_token: encryptToken(testRefreshToken),
        expires_at: futureExpiry,
        scope: 'activity:read'
      }).execute();

      const result = await getValidAccessToken(
        drizzleDb,
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
      drizzleDb.insert(participantToken).values({
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
        drizzleDb,
        mockStravaClient as MockStravaClient,
        testAthleteId
      );

      expect(result).toBe(newAccessToken);
      expect(mockStravaClient.refreshAccessToken).toHaveBeenCalledWith(oldRefreshToken);

      // Verify token was updated in database
      const updated = drizzleDb
        .select()
        .from(participantToken)
        .where(eq(participantToken.strava_athlete_id, testAthleteId))
        .get();

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
      drizzleDb.insert(participantToken).values({
        strava_athlete_id: testAthleteId,
        access_token: plaintextToken,
        refresh_token: 'plaintext_refresh',
        expires_at: futureExpiry,
        scope: 'activity:read'
      }).execute();

      const result = await getValidAccessToken(
        drizzleDb,
        mockStravaClient as MockStravaClient,
        testAthleteId
      );

      expect(result).toBe(plaintextToken);
      expect(mockStravaClient.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should throw error when participant not connected', async () => {
      await expect(
        getValidAccessToken(
          drizzleDb,
          mockStravaClient as MockStravaClient,
          testAthleteId
        )
      ).rejects.toThrow('Participant not connected to Strava');
    });

    it('should throw error when token refresh fails', async () => {
      const soonExpiry = Math.floor(Date.now() / 1000) + 1800;
      const oldAccessToken = 'old_token';
      const oldRefreshToken = 'old_refresh';

      drizzleDb.insert(participantToken).values({
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
          drizzleDb,
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

      drizzleDb.insert(participantToken).values({
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
        drizzleDb,
        mockStravaClient as MockStravaClient,
        testAthleteId
      );

      const stored = drizzleDb
        .select()
        .from(participantToken)
        .where(eq(participantToken.strava_athlete_id, testAthleteId))
        .get();

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

      drizzleDb.insert(participantToken).values({
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
        drizzleDb,
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

      drizzleDb.insert(participantToken).values({
        strava_athlete_id: testAthleteId,
        access_token: encryptToken(testAccessToken),
        refresh_token: encryptToken(testRefreshToken),
        expires_at: futureExpiry,
        scope: 'activity:read'
      }).execute();

      // First call
      const result1 = await getValidAccessToken(
        drizzleDb,
        mockStravaClient as MockStravaClient,
        testAthleteId
      );
      expect(result1).toBe(testAccessToken);

      // Second call should work independently
      const result2 = await getValidAccessToken(
        drizzleDb,
        mockStravaClient as MockStravaClient,
        testAthleteId
      );
      expect(result2).toBe(testAccessToken);

      expect(mockStravaClient.refreshAccessToken).not.toHaveBeenCalled();
    });
  });
});
