/**
 * Strava Client Tests
 * 
 * Tests for the stravaClient module that wraps the strava-v3 library.
 * These tests mock the underlying strava-v3 library to verify proper
 * error handling, parameter passing, and pagination logic.
 */

import { isoToUnix } from '../dateUtils';
import * as stravaClient from '../stravaClient';

// Mock strava-v3 before requiring stravaClient
jest.mock('strava-v3', () => {
  // Track the last mock client set for getSegment/etc tests
  let lastMockClient: any = null;

  // Create a client function that works with .call()
  const clientFunc = function(this: any, token: string) {
    // If a mock client was set via mockReturnValue, use it
    if (lastMockClient) {
      Object.assign(this, lastMockClient);
    } else {
      // Otherwise set up default mocks
      this.athlete = {
        get: jest.fn(),
        listActivities: jest.fn(),
        client: {
          getEndpoint: jest.fn()
        }
      };
      this.activities = {
        get: jest.fn(),
        listAthleteActivities: jest.fn()
      };
      this.segments = {
        get: jest.fn()
      };
      this.athletes = {
        get: jest.fn(),
        stats: jest.fn(),
        client: {
          getEndpoint: jest.fn()
        }
      };
      this.clubs = {
        listMembers: jest.fn()
      };
    }
  };

  // Add mockReturnValue to support tests that set up mock clients
  (clientFunc as any).mockReturnValue = jest.fn().mockImplementation((mockClient: any) => {
    lastMockClient = mockClient;
  });

  return {
    oauth: {
      getToken: jest.fn(),
      refreshToken: jest.fn()
    },
    client: clientFunc
  };
});

import strava from 'strava-v3';
const mockStrava = strava as any;

describe('Strava Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exchangeAuthorizationCode', () => {
    test('exchanges authorization code for tokens', async () => {
      mockStrava.oauth.getToken.mockResolvedValue({
        access_token: 'access123',
        refresh_token: 'refresh123',
        expires_at: 1234567890,
        athlete: { id: '12345', firstname: 'John', lastname: 'Doe' }
      });

      const result = await stravaClient.exchangeAuthorizationCode('code123');

      expect(result).toHaveProperty('access_token', 'access123');
      expect(result).toHaveProperty('refresh_token', 'refresh123');
      expect(result).toHaveProperty('expires_at', 1234567890);
      expect(mockStrava.oauth.getToken).toHaveBeenCalledWith('code123');
    });

    test('throws error if no access token in response', async () => {
      mockStrava.oauth.getToken.mockResolvedValue({ refresh_token: 'refresh123' });

      await expect(
        stravaClient.exchangeAuthorizationCode('code123')
      ).rejects.toThrow('No access token in OAuth response');
    });

    test('handles OAuth API errors', async () => {
      mockStrava.oauth.getToken.mockRejectedValue(new Error('Invalid code'));

      await expect(
        stravaClient.exchangeAuthorizationCode('bad_code')
      ).rejects.toThrow();
    });
  });

  describe('refreshAccessToken', () => {
    test('refreshes access token using refresh token', async () => {
      mockStrava.oauth.refreshToken.mockResolvedValue({
        access_token: 'new_access123',
        refresh_token: 'new_refresh123',
        expires_at: 9876543210
      });

      const result = await stravaClient.refreshAccessToken('refresh123');

      expect(result).toHaveProperty('access_token', 'new_access123');
      expect(result).toHaveProperty('refresh_token', 'new_refresh123');
      expect(mockStrava.oauth.refreshToken).toHaveBeenCalledWith('refresh123');
    });

    test('throws error for invalid refresh token', async () => {
      mockStrava.oauth.refreshToken.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      await expect(
        stravaClient.refreshAccessToken('invalid_token')
      ).rejects.toThrow();
    });
  });

  describe('getActivity', () => {
    test('fetches activity details from Strava', async () => {
      const mockActivity = {
        id: '123456',
        name: 'Test Activity',
        distance: 5000,
        segment_efforts: [
          { segment: { id: '100' }, elapsed_time: 300 }
        ]
      };

      const mockClient = {
        activities: {
          get: jest.fn().mockResolvedValue(mockActivity)
        }
      };

      mockStrava.client.mockReturnValue(mockClient);

      const result = await stravaClient.getActivity('123456', 'token123');

      expect(result).toEqual(mockActivity);
      expect(mockClient.activities.get).toHaveBeenCalledWith({ 
        id: '123456',
        include_all_efforts: true 
      });
    });

    test('handles activity not found (404)', async () => {
      const error = new Error('Not found') as any;
      error.statusCode = 404;

      const mockClient = {
        activities: { get: jest.fn().mockRejectedValue(error) }
      };

      mockStrava.client.mockReturnValue(mockClient);

      await expect(
        stravaClient.getActivity('99999', 'token123')
      ).rejects.toThrow('Activity not found');
    });

    test('handles invalid token (401)', async () => {
      const error = new Error('Unauthorized') as any;
      error.statusCode = 401;

      const mockClient = {
        activities: { get: jest.fn().mockRejectedValue(error) }
      };

      mockStrava.client.mockReturnValue(mockClient);

      await expect(
        stravaClient.getActivity('123456', 'expired_token')
      ).rejects.toThrow('Invalid or expired Strava token');
    });

    test('includes all efforts by default', async () => {
      const mockClient = {
        activities: { get: jest.fn().mockResolvedValue({ id: '1', segment_efforts: [] }) }
      };

      mockStrava.client.mockReturnValue(mockClient);

      await stravaClient.getActivity('123456', 'token123');

      // getActivity passes ID as string and include_all_efforts as parameter
      expect(mockClient.activities.get).toHaveBeenCalledWith({
        id: '123456',
        include_all_efforts: true
      });
    });
  });

  describe('listAthleteActivities', () => {
    test('fetches activities within time window', async () => {
      const mockActivities = [
        { id: '1', name: 'Activity 1', start_date: '2025-10-28T10:00:00Z' },
        { id: '2', name: 'Activity 2', start_date: '2025-10-28T14:00:00Z' }
      ];

      const mockClient = {
        athlete: {
          listActivities: jest.fn().mockResolvedValue(mockActivities)
        }
      };

      mockStrava.client.mockReturnValue(mockClient);

      const after = isoToUnix('2025-10-28T00:00:00Z') || 0;
      const before = isoToUnix('2025-10-28T23:59:59Z') || 0;

      const result = await stravaClient.listAthleteActivities('token123', after, before);

      expect(result).toEqual(mockActivities);
      expect(mockClient.athlete.listActivities).toHaveBeenCalledWith({
        after: after,
        before: before,
        per_page: 100,
        page: 1,
        include_all_efforts: true
      });
    });

    test('handles pagination automatically', async () => {
      // Mock responses for two pages
      const page1 = Array(100).fill(null).map((_, i) => ({ id: String(i + 1), name: `Activity ${i + 1}` }));
      const page2 = Array(50).fill(null).map((_, i) => ({ id: String(101 + i), name: `Activity ${101 + i}` }));

      const mockClient = {
        athlete: {
          listActivities: jest.fn()
            .mockResolvedValueOnce(page1)
            .mockResolvedValueOnce(page2)
        }
      };

      mockStrava.client.mockReturnValue(mockClient);

      const after = 1000;
      const before = 2000;
      const result = await stravaClient.listAthleteActivities('token123', after, before);

      expect(result.length).toBe(150);
      expect(mockClient.athlete.listActivities).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAthleteProfile', () => {
    test('fetches athlete profile through the athletes endpoint client', async () => {
      const mockProfile = {
        id: '42',
        firstname: 'Taylor',
        lastname: 'Rider',
        profile_medium: 'https://example.com/profile-medium.jpg'
      };

      const mockClient = {
        athletes: {
          client: {
            getEndpoint: jest.fn().mockResolvedValue(mockProfile)
          }
        }
      };

      mockStrava.client.mockReturnValue(mockClient);

      const result = await stravaClient.getAthleteProfile('42', 'token123');

      expect(result).toEqual(mockProfile);
      expect(mockClient.athletes.client.getEndpoint).toHaveBeenCalledWith('athletes/42');
    });

    test('wraps athlete profile errors with context', async () => {
      const mockClient = {
        athletes: {
          client: {
            getEndpoint: jest.fn().mockRejectedValue(new Error('boom'))
          }
        }
      };

      mockStrava.client.mockReturnValue(mockClient);

      await expect(
        stravaClient.getAthleteProfile('42', 'token123')
      ).rejects.toThrow('Failed to fetch athlete profile: boom');
    });
  });

  describe('getLoggedInAthlete', () => {
    test('fetches the authenticated athlete profile through the athlete endpoint client', async () => {
      const mockAthlete = {
        id: '7',
        firstname: 'Jordan',
        clubs: [{ id: '101', name: 'WMV' }]
      };

      const mockClient = {
        athlete: {
          client: {
            getEndpoint: jest.fn().mockResolvedValue(mockAthlete)
          }
        }
      };

      mockStrava.client.mockReturnValue(mockClient);

      const result = await stravaClient.getLoggedInAthlete('token123');

      expect(result).toEqual(mockAthlete);
      expect(mockClient.athlete.client.getEndpoint).toHaveBeenCalledWith('athlete');
    });

    test('wraps logged-in athlete fetch errors with context', async () => {
      const mockClient = {
        athlete: {
          client: {
            getEndpoint: jest.fn().mockRejectedValue(new Error('network down'))
          }
        }
      };

      mockStrava.client.mockReturnValue(mockClient);

      await expect(
        stravaClient.getLoggedInAthlete('token123')
      ).rejects.toThrow('Failed to fetch logged-in athlete: network down');
    });
  });

  describe('getSegment', () => {
    test('fetches segment details from Strava', async () => {
      const mockSegment = {
        id: '100',
        name: 'Test Segment',
        distance: 2500
      };

      const mockClient = {
        segments: {
          get: jest.fn().mockResolvedValue(mockSegment)
        }
      };

      mockStrava.client.mockReturnValue(mockClient);

      const result = await stravaClient.getSegment('100', 'token123');

      expect(result).toEqual(mockSegment);
      expect(mockClient.segments.get).toHaveBeenCalledWith({ id: '100' });
    });

    test('handles segment not found (404)', async () => {
      const error = new Error('Not found') as any;
      error.statusCode = 404;

      const mockClient = {
        segments: { get: jest.fn().mockRejectedValue(error) }
      };

      mockStrava.client.mockReturnValue(mockClient);

      await expect(
        stravaClient.getSegment('999', 'token123')
      ).rejects.toThrow('Segment not found');
    });
  });

  describe('getClubMembers', () => {
    test('fetches club members with default pagination settings', async () => {
      const mockMembers = [
        { id: '1', username: 'rider1', firstname: 'Rider', lastname: 'One' },
        { id: '2', username: 'rider2', firstname: 'Rider', lastname: 'Two' }
      ];

      const mockClient = {
        clubs: {
          listMembers: jest.fn().mockResolvedValue(mockMembers)
        }
      };

      mockStrava.client.mockReturnValue(mockClient);

      const result = await stravaClient.getClubMembers('club-123', {}, 'token123');

      expect(result).toEqual(mockMembers);
      expect(mockClient.clubs.listMembers).toHaveBeenCalledWith({
        id: 'club-123',
        page: 1,
        per_page: 50
      });
    });

    test('passes through custom pagination options', async () => {
      const mockClient = {
        clubs: {
          listMembers: jest.fn().mockResolvedValue([])
        }
      };

      mockStrava.client.mockReturnValue(mockClient);

      await stravaClient.getClubMembers(
        'club-123',
        { page: 3, per_page: 25 },
        'token123'
      );

      expect(mockClient.clubs.listMembers).toHaveBeenCalledWith({
        id: 'club-123',
        page: 3,
        per_page: 25
      });
    });

    test.each([
      [{ statusCode: 404 }, 'Club not found on Strava'],
      [{ statusCode: 401 }, 'Invalid or expired Strava token']
    ])('maps Strava club member errors: %p', async (errorShape, message) => {
      const error = Object.assign(new Error('request failed'), errorShape);
      const mockClient = {
        clubs: {
          listMembers: jest.fn().mockRejectedValue(error)
        }
      };

      mockStrava.client.mockReturnValue(mockClient);

      await expect(
        stravaClient.getClubMembers('club-123', {}, 'token123')
      ).rejects.toThrow(message);
    });
  });
});
