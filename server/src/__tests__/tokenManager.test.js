/**
 * Token Manager Tests
 * Tests for OAuth token lifecycle management
 */

const { getValidAccessToken } = require('../tokenManager');
const { encryptToken, decryptToken } = require('../encryption');

// Mock dependencies
jest.mock('../encryption');

describe('Token Manager', () => {
  let mockDb;
  let mockStravaClient;
  const testAthleteId = 12345678;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database
    mockDb = {
      prepare: jest.fn()
    };

    // Mock Strava client
    mockStravaClient = {
      refreshAccessToken: jest.fn()
    };

    // Reset encryption mocks
    encryptToken.mockImplementation(token => `encrypted_${token}`);
    decryptToken.mockImplementation(token => token.replace('encrypted_', ''));
  });

  describe('getValidAccessToken', () => {
    it('should return cached token when not expiring soon', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 7200; // 2 hours
      const mockTokenRecord = {
        strava_athlete_id: testAthleteId,
        access_token: 'encrypted_valid_token',
        refresh_token: 'encrypted_refresh_token',
        expires_at: futureExpiry
      };

      const mockStatement = {
        get: jest.fn().mockReturnValue(mockTokenRecord)
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      const result = await getValidAccessToken(mockDb, mockStravaClient, testAthleteId);

      expect(result).toBe('valid_token');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM participant_token')
      );
      expect(decryptToken).toHaveBeenCalledWith('encrypted_valid_token');
      expect(mockStravaClient.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should refresh token when expiring soon (within 1 hour)', async () => {
      const soonExpiry = Math.floor(Date.now() / 1000) + 1800; // 30 minutes
      const mockTokenRecord = {
        strava_athlete_id: testAthleteId,
        access_token: 'encrypted_old_token',
        refresh_token: 'encrypted_old_refresh',
        expires_at: soonExpiry
      };

      const newTokenData = {
        access_token: 'new_valid_token',
        refresh_token: 'new_refresh_token',
        expires_at: Math.floor(Date.now() / 1000) + 21600 // 6 hours
      };

      mockStravaClient.refreshAccessToken.mockResolvedValue(newTokenData);

      const mockSelectStatement = {
        get: jest.fn().mockReturnValue(mockTokenRecord)
      };
      const mockUpdateStatement = {
        run: jest.fn()
      };

      mockDb.prepare
        .mockReturnValueOnce(mockSelectStatement) // SELECT
        .mockReturnValueOnce(mockUpdateStatement); // UPDATE

      const result = await getValidAccessToken(mockDb, mockStravaClient, testAthleteId);

      expect(result).toBe('new_valid_token');
      expect(mockStravaClient.refreshAccessToken).toHaveBeenCalledWith('old_refresh');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE participant_token')
      );
      expect(encryptToken).toHaveBeenCalledWith('new_valid_token');
      expect(encryptToken).toHaveBeenCalledWith('new_refresh_token');
    });

    it('should handle decryption failure for plaintext tokens (migration case)', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 7200;
      const mockTokenRecord = {
        strava_athlete_id: testAthleteId,
        access_token: 'plaintext_token', // Not encrypted
        refresh_token: 'plaintext_refresh',
        expires_at: futureExpiry
      };

      const mockStatement = {
        get: jest.fn().mockReturnValue(mockTokenRecord)
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      decryptToken.mockImplementationOnce(() => {
        throw new Error('Not valid encrypted format');
      });

      const result = await getValidAccessToken(mockDb, mockStravaClient, testAthleteId);

      expect(result).toBe('plaintext_token');
      expect(mockStravaClient.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('should throw error when participant not connected', async () => {
      const mockStatement = {
        get: jest.fn().mockReturnValue(null)
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      await expect(
        getValidAccessToken(mockDb, mockStravaClient, testAthleteId)
      ).rejects.toThrow('Participant not connected to Strava');
    });

    it('should throw error when token refresh fails', async () => {
      const soonExpiry = Math.floor(Date.now() / 1000) + 1800;
      const mockTokenRecord = {
        strava_athlete_id: testAthleteId,
        access_token: 'encrypted_old_token',
        refresh_token: 'encrypted_old_refresh',
        expires_at: soonExpiry
      };

      mockStravaClient.refreshAccessToken.mockRejectedValue(
        new Error('Strava API error: Invalid refresh token')
      );

      const mockStatement = {
        get: jest.fn().mockReturnValue(mockTokenRecord)
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      await expect(
        getValidAccessToken(mockDb, mockStravaClient, testAthleteId)
      ).rejects.toThrow('Failed to refresh token');
    });

    it('should update database with new tokens after refresh', async () => {
      const soonExpiry = Math.floor(Date.now() / 1000) + 1800;
      const mockTokenRecord = {
        strava_athlete_id: testAthleteId,
        access_token: 'encrypted_old_token',
        refresh_token: 'encrypted_old_refresh',
        expires_at: soonExpiry
      };

      const newExpiry = Math.floor(Date.now() / 1000) + 21600;
      const newTokenData = {
        access_token: 'new_token',
        refresh_token: 'new_refresh',
        expires_at: newExpiry
      };

      mockStravaClient.refreshAccessToken.mockResolvedValue(newTokenData);

      const mockSelectStatement = {
        get: jest.fn().mockReturnValue(mockTokenRecord)
      };
      const mockUpdateStatement = {
        run: jest.fn()
      };

      mockDb.prepare
        .mockReturnValueOnce(mockSelectStatement)
        .mockReturnValueOnce(mockUpdateStatement);

      await getValidAccessToken(mockDb, mockStravaClient, testAthleteId);

      expect(mockUpdateStatement.run).toHaveBeenCalledWith(
        'encrypted_new_token',
        'encrypted_new_refresh',
        newExpiry,
        testAthleteId
      );
    });

    it('should handle refresh token decryption failure (migration case)', async () => {
      const soonExpiry = Math.floor(Date.now() / 1000) + 1800;
      const mockTokenRecord = {
        strava_athlete_id: testAthleteId,
        access_token: 'encrypted_valid_token',
        refresh_token: 'plaintext_refresh', // Not encrypted
        expires_at: soonExpiry
      };

      const newTokenData = {
        access_token: 'new_token',
        refresh_token: 'new_refresh',
        expires_at: Math.floor(Date.now() / 1000) + 21600
      };

      mockStravaClient.refreshAccessToken.mockResolvedValue(newTokenData);

      const mockSelectStatement = {
        get: jest.fn().mockReturnValue(mockTokenRecord)
      };
      const mockUpdateStatement = {
        run: jest.fn()
      };

      mockDb.prepare
        .mockReturnValueOnce(mockSelectStatement)
        .mockReturnValueOnce(mockUpdateStatement);

      decryptToken
        .mockImplementationOnce(() => {
          throw new Error('Not encrypted');
        });

      const result = await getValidAccessToken(mockDb, mockStravaClient, testAthleteId);

      expect(result).toBe('new_token');
      // Should have called refreshAccessToken with plaintext token
      expect(mockStravaClient.refreshAccessToken).toHaveBeenCalled();
    });

    it('should handle multiple sequential calls correctly', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 7200;
      const mockTokenRecord = {
        strava_athlete_id: testAthleteId,
        access_token: 'encrypted_token_1',
        refresh_token: 'encrypted_refresh',
        expires_at: futureExpiry
      };

      const mockStatement = {
        get: jest.fn().mockReturnValue(mockTokenRecord)
      };
      mockDb.prepare.mockReturnValue(mockStatement);

      // First call
      const result1 = await getValidAccessToken(mockDb, mockStravaClient, testAthleteId);
      expect(result1).toBe('token_1');

      // Second call should work independently
      decryptToken.mockImplementation(token => token.replace('encrypted_', ''));
      const result2 = await getValidAccessToken(mockDb, mockStravaClient, testAthleteId);
      expect(result2).toBe('token_1');

      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
    });
  });
});
