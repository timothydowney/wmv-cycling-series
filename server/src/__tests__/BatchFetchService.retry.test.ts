import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Database } from 'better-sqlite3';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import BatchFetchService from '../services/BatchFetchService';
import { setupTestDb, teardownTestDb, createParticipant, createSeason, createWeek, createSegment } from './testDataHelpers';
import * as stravaClient from '../stravaClient';

// Mock stravaClient
jest.mock('../stravaClient', () => ({
  listAthleteActivities: jest.fn(),
  getActivity: jest.fn() // Mock other used methods if necessary
}));

describe('BatchFetchService Retry Logic', () => {
  let db: Database;
  let orm: BetterSQLite3Database;
  let service: BatchFetchService;
  let mockGetToken: jest.Mock;
  let weekId: number;

  beforeEach(() => {
    // Mock system time to be within the season (2025)
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-02T12:00:00Z'));

    const testDb = setupTestDb();
    db = testDb.db;
    orm = testDb.orm;

    // Setup seed data
    const season = createSeason(orm, 'Season 1', true);
    const segment = createSegment(orm, '12345', 'Seg 1');
    const week = createWeek(orm, { 
      seasonId: season.id, 
      stravaSegmentId: '12345', 
      weekName: 'Week 1',
      startTime: '2025-01-01T00:00:00Z',
      endTime: '2025-01-01T23:59:59Z'
    });
    weekId = week.id;

    // Create a participant with a "valid" token entry in DB (value doesn't matter as we mock the getter)
    createParticipant(orm, '111', 'User 1', { accessToken: 'token_1', refreshToken: 'refresh_1' });

    // Mock getValidAccessToken
    mockGetToken = jest.fn();
    
    service = new BatchFetchService(orm, mockGetToken as any);
  });

  afterEach(() => {
    teardownTestDb(db);
    jest.clearAllMocks();
    jest.useRealTimers();
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
