import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import BatchFetchService from '../services/BatchFetchService';
import { setupTestDb, teardownTestDb, createParticipant, createSeason, createWeek, createSegment } from './testDataHelpers';
import * as stravaClient from '../stravaClient';

// Mock stravaClient
jest.mock('../stravaClient', () => ({
  listAthleteActivities: jest.fn(),
  getActivity: jest.fn() // Mock other used methods if necessary
}));

describe('BatchFetchService Retry Logic', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let service: BatchFetchService;
  let mockGetToken: jest.Mock;
  let weekId: number;

  beforeEach(async () => {
    const testDb = setupTestDb({ seed: false });
    pool = testDb.pool;
    orm = testDb.orm;

    const now = new Date();
    const seasonStart = Math.floor((now.getTime() - 24 * 60 * 60 * 1000) / 1000);
    const seasonEnd = Math.floor((now.getTime() + 24 * 60 * 60 * 1000) / 1000);
    const weekStart = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
    const weekEnd = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();

    // Setup seed data
    const season = await createSeason(orm, 'Season 1', true, {
      startAt: seasonStart,
      endAt: seasonEnd,
    });
    const segment = await createSegment(orm, '12345', 'Seg 1');
    const week = await createWeek(orm, { 
      seasonId: season.id, 
      stravaSegmentId: '12345', 
      weekName: 'Week 1',
      startTime: weekStart,
      endTime: weekEnd,
    });
    weekId = week.id;

    // Create a participant with a "valid" token entry in DB (value doesn't matter as we mock the getter)
    await createParticipant(orm, '111', 'User 1', { accessToken: 'token_1', refreshToken: 'refresh_1' });

    // Mock getValidAccessToken
    mockGetToken = jest.fn();
    
    service = new BatchFetchService(orm, mockGetToken as any);

  });
  afterEach(async () => {
    await teardownTestDb(pool);
    jest.clearAllMocks();
  });

  it('should retry with forceRefresh=true when Strava returns 401', async () => {
    // Setup mocks
    (mockGetToken as any).mockResolvedValue('valid_token');
    
    const mockListActivities = stravaClient.listAthleteActivities as jest.Mock;
    
    // First call fails with 401
    (mockListActivities as any).mockRejectedValueOnce({
      statusCode: 401,
      message: 'Authorization Error'
    });
    
    // Second call succeeds
    (mockListActivities as any).mockResolvedValueOnce([]);

    // Execute
    const result = await service.fetchWeekResults(weekId);

    // Assertions
    expect(mockGetToken).toHaveBeenCalledTimes(2);
    expect(mockGetToken).toHaveBeenNthCalledWith(1, expect.anything(), '111'); // Initial fetch
    expect(mockGetToken).toHaveBeenNthCalledWith(2, expect.anything(), '111', true); // Retry with forceRefresh=true

    expect(mockListActivities).toHaveBeenCalledTimes(2);
    expect(result.participants_processed).toBe(1);
    expect(result.summary[0].activity_found).toBe(false); // No activities found, but processed successfully
    expect(result.summary[0].reason).toBe('No qualifying activities on event day');
  });

  it('should skip participant if retry also fails', async () => {
    // Setup mocks
    (mockGetToken as any).mockResolvedValue('valid_token');
    const mockListActivities = stravaClient.listAthleteActivities as jest.Mock;

    // First call fails with 401
    (mockListActivities as any).mockRejectedValueOnce({ statusCode: 401 });
    // Second call ALSO fails (e.g. token revoked)
    (mockListActivities as any).mockRejectedValueOnce({ statusCode: 401 });

    // Execute
    const result = await service.fetchWeekResults(weekId);

    // Assertions
    expect(mockGetToken).toHaveBeenCalledTimes(2); // Tried twice
    expect(mockListActivities).toHaveBeenCalledTimes(2);
    
    expect(result.participants_processed).toBe(1);
    expect(result.summary[0].activity_found).toBe(false);
    // Should have an error reason
    expect(result.summary[0].reason).toContain('Authorization failed');
  });
});
