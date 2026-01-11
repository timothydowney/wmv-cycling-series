/**
 * Webhook Processor - Segment Efforts Retry Logic Tests
 *
 * Tests the retry mechanism in `processActivityEvent` that handles the race condition
 * where Strava webhooks arrive before segment efforts are fully processed on Strava's end.
 *
 * Core Behavior:
 * - Max 4 attempts to fetch segment efforts
 * - Exponential backoff: 15s, 45s, 90s between retries
 * - Stops early if efforts found before max attempts
 * - Skips activity and continues if max retries exhausted
 *
 * NOTE: Tests use mocked sleep/delays to avoid needing 4+ minutes per test.
 * The actual processor uses real delays in production.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { setupTestDb } from './setupTestDb';
import { WebhookLogger } from '../webhooks/logger';
import { createWebhookProcessor } from '../webhooks/processor';
import ActivityValidationService from '../services/ActivityValidationService';
import {
  createParticipant,
  createSeason,
  createSegment,
  createWeek
} from './testDataHelpers';

// Mock Strava client to simulate retry scenarios
jest.mock('../stravaClient');
import * as stravaClientModule from '../stravaClient';

// Mock tokenManager
jest.mock('../tokenManager');
import { getValidAccessToken } from '../tokenManager';

// Mock setTimeout to avoid real delays - this lets tests run fast
const originalSetTimeout = global.setTimeout;
let setTimeoutCalls: { delay: number; callback: () => void }[] = [];

beforeAll(() => {
  global.setTimeout = ((callback: any, delay: any) => {
    setTimeoutCalls.push({ delay, callback });
    // Execute immediately so we don't actually wait
    callback();
    return null as any;
  }) as any;
});

describe('Webhook Processor - Segment Efforts Retry Logic', () => {
  let db: Database;
  let orm: BetterSQLite3Database;
  let logger: WebhookLogger;
  let mockStravaGetActivity: any;

  beforeEach(() => {
    const testDb = setupTestDb({ seed: false });
    db = testDb.db;
    orm = testDb.orm || testDb.drizzleDb;
    logger = new WebhookLogger(orm);

    // Mock getValidAccessToken to return a fake token
    (getValidAccessToken as any).mockResolvedValue('fake_token');

    // Mock stravaClient.getActivity - will be configured per test
    mockStravaGetActivity = jest.fn();
    mockStravaGetActivity.mockResolvedValue({
      id: 987654321,
      name: 'Ride',
      start_date: new Date().toISOString(),
      type: 'Ride',
      segment_efforts: []
    });
    (stravaClientModule.getActivity as any) = mockStravaGetActivity;
  });

  afterEach(() => {
    jest.clearAllMocks();
    setTimeoutCalls = [];
    db.close();
  });

  afterAll(() => {
    // Restore original setTimeout
    global.setTimeout = originalSetTimeout;
  });

  // Helper to verify backoff delays were called
  const getBackoffDelays = () => setTimeoutCalls.map(call => call.delay).sort((a, b) => a - b);

  it('should succeed on first attempt if segment efforts are present', async () => {
    // Arrange - Activity already has segment efforts
    createParticipant(orm, '100', 'Test Athlete', { accessToken: 'fake_token' });

    const activityWithEfforts: any = {
      id: 987654321,
      name: 'Morning Ride',
      start_date: new Date().toISOString(),
      type: 'Ride',
      segment_efforts: [
        {
          id: 1,
          segment: { id: 123456, name: 'Test Segment' },
          elapsed_time: 250,
          start_date: new Date().toISOString(),
          pr_rank: null
        }
      ]
    };

    mockStravaGetActivity.mockResolvedValueOnce(activityWithEfforts);

    // Act
    const processor = createWebhookProcessor(orm);
    const event = {
      object_type: 'activity',
      aspect_type: 'create',
      object_id: 987654321,
      owner_id: 100
    };

    await processor(event as any, logger);

    // Assert - No retries needed
    expect(mockStravaGetActivity).toHaveBeenCalledTimes(1);
    expect(getBackoffDelays()).toEqual([]);
  });

  it('should retry when segment efforts are missing, then stop when found', async () => {
    // Arrange - Efforts not ready on first call, ready on second
    createParticipant(orm, '100', 'Test Athlete', { accessToken: 'fake_token' });

    const activityNoEfforts: any = {
      id: 987654321,
      name: 'Morning Ride',
      start_date: new Date().toISOString(),
      type: 'Ride',
      segment_efforts: []
    };

    const activityWithEfforts: any = {
      ...activityNoEfforts,
      segment_efforts: [
        {
          id: 1,
          segment: { id: 123456, name: 'Test Segment' },
          elapsed_time: 250,
          start_date: new Date().toISOString(),
          pr_rank: null
        }
      ]
    };

    mockStravaGetActivity
      .mockResolvedValueOnce(activityNoEfforts)
      .mockResolvedValueOnce(activityWithEfforts);

    // Act
    const processor = createWebhookProcessor(orm);
    const event = {
      object_type: 'activity',
      aspect_type: 'create',
      object_id: 987654321,
      owner_id: 100
    };

    await processor(event as any, logger);

    // Assert - Should have stopped after finding efforts
    expect(mockStravaGetActivity).toHaveBeenCalledTimes(2);
    expect(getBackoffDelays()).toContain(15000); // First backoff
    expect(getBackoffDelays()).not.toContain(45000); // Didn't reach second backoff
  });

  it('should stop early once segment efforts are found on any retry', async () => {
    // Arrange - Efforts found on third attempt (not on fourth)
    createParticipant(orm, '100', 'Test Athlete', { accessToken: 'fake_token' });

    const activityNoEfforts: any = {
      id: 987654321,
      name: 'Morning Ride',
      start_date: new Date().toISOString(),
      type: 'Ride',
      segment_efforts: []
    };

    const activityWithEfforts: any = {
      ...activityNoEfforts,
      segment_efforts: [
        {
          id: 1,
          segment: { id: 123456, name: 'Test Segment' },
          elapsed_time: 250,
          start_date: new Date().toISOString(),
          pr_rank: null
        }
      ]
    };

    // Empty, empty, success (never hits 4th attempt)
    mockStravaGetActivity
      .mockResolvedValueOnce(activityNoEfforts)
      .mockResolvedValueOnce(activityNoEfforts)
      .mockResolvedValueOnce(activityWithEfforts);

    // Act
    const processor = createWebhookProcessor(orm);
    const event = {
      object_type: 'activity',
      aspect_type: 'create',
      object_id: 987654321,
      owner_id: 100
    };

    await processor(event as any, logger);

    // Assert - Should have stopped at 3 attempts
    expect(mockStravaGetActivity).toHaveBeenCalledTimes(3);
    expect(getBackoffDelays()).toContain(15000);
    expect(getBackoffDelays()).toContain(45000);
    expect(getBackoffDelays()).not.toContain(90000); // Didn't need 3rd backoff
  });

  it('should verify exponential backoff delays are scheduled correctly', async () => {
    // Arrange - This test specifically validates the backoff sequence
    createParticipant(orm, '100', 'Test Athlete', { accessToken: 'fake_token' });

    // Return efforts on 4th attempt after 3 failures
    const activityNoEfforts: any = {
      id: 987654321,
      name: 'Morning Ride',
      start_date: new Date().toISOString(),
      type: 'Ride',
      segment_efforts: []
    };

    const activityWithEfforts: any = {
      ...activityNoEfforts,
      segment_efforts: [
        {
          id: 1,
          segment: { id: 123456, name: 'Test Segment' },
          elapsed_time: 250,
          start_date: new Date().toISOString(),
          pr_rank: null
        }
      ]
    };

    mockStravaGetActivity
      .mockResolvedValueOnce(activityNoEfforts)
      .mockResolvedValueOnce(activityNoEfforts)
      .mockResolvedValueOnce(activityNoEfforts)
      .mockResolvedValueOnce(activityWithEfforts);

    // Act
    const processor = createWebhookProcessor(orm);
    const event = {
      object_type: 'activity',
      aspect_type: 'create',
      object_id: 987654321,
      owner_id: 100
    };

    await processor(event as any, logger);

    // Assert - All three backoff delays should be present
    const delays = getBackoffDelays();
    expect(delays).toEqual([15000, 45000, 90000]);
    expect(mockStravaGetActivity).toHaveBeenCalledTimes(4);
  });

  it('should exhaust retries and give up after max attempts', async () => {
    // Arrange - Efforts never come
    createParticipant(orm, '100', 'Test Athlete', { accessToken: 'fake_token' });

    const activityNoEfforts: any = {
      id: 987654321,
      name: 'Morning Ride',
      start_date: new Date().toISOString(),
      type: 'Ride',
      segment_efforts: [] // Always empty
    };

    mockStravaGetActivity.mockResolvedValue(activityNoEfforts);

    // Act
    const processor = createWebhookProcessor(orm);
    const event = {
      object_type: 'activity',
      aspect_type: 'create',
      object_id: 987654321,
      owner_id: 100
    };

    await processor(event as any, logger);

    // Assert - Should attempt all 4 times, then stop
    expect(mockStravaGetActivity).toHaveBeenCalledTimes(4);
    const delays = getBackoffDelays();
    expect(delays).toEqual([15000, 45000, 90000]);
  });

  it('should recover from race condition: missing efforts on attempts 1-3, found on 4th', async () => {
    // Arrange - Simulates real-world race condition: webhook arrives before Strava finishes
    // processing segment efforts. Retries eventually succeed on final attempt.
    createParticipant(orm, '100', 'Test Athlete', { accessToken: 'fake_token' });

    const activityNoEfforts: any = {
      id: 987654321,
      name: 'Race Day Ride',
      start_date: new Date().toISOString(),
      type: 'Ride',
      segment_efforts: []
    };

    const activityWithEfforts: any = {
      ...activityNoEfforts,
      segment_efforts: [
        {
          id: 1,
          segment: { id: 123456, name: 'Climb' },
          elapsed_time: 180,
          start_date: new Date().toISOString(),
          pr_rank: 5
        },
        {
          id: 2,
          segment: { id: 123456, name: 'Climb' },
          elapsed_time: 175,
          start_date: new Date().toISOString(),
          pr_rank: 3
        }
      ]
    };

    // Attempts 1-3: no efforts, Attempt 4: success
    mockStravaGetActivity
      .mockResolvedValueOnce(activityNoEfforts)
      .mockResolvedValueOnce(activityNoEfforts)
      .mockResolvedValueOnce(activityNoEfforts)
      .mockResolvedValueOnce(activityWithEfforts);

    // Act
    const processor = createWebhookProcessor(orm);
    const event = {
      object_type: 'activity',
      aspect_type: 'create',
      object_id: 987654321,
      owner_id: 100
    };

    await processor(event as any, logger);

    // Assert - All 4 attempts used, success on last
    expect(mockStravaGetActivity).toHaveBeenCalledTimes(4);
    const delays = getBackoffDelays();
    expect(delays).toEqual([15000, 45000, 90000]);
  });

  it('should handle gracefully when response has null or empty efforts', async () => {
    // Arrange - Activity response structure is valid, but efforts field is null (not an array)
    // This verifies the code doesn't crash on unexpected response shapes
    createParticipant(orm, '100', 'Test Athlete', { accessToken: 'fake_token' });

    const activityNullEfforts: any = {
      id: 987654321,
      name: 'Morning Ride',
      start_date: new Date().toISOString(),
      type: 'Ride',
      segment_efforts: null // Null instead of array
    };

    mockStravaGetActivity.mockResolvedValue(activityNullEfforts);

    // Act
    const processor = createWebhookProcessor(orm);
    const event = {
      object_type: 'activity',
      aspect_type: 'create',
      object_id: 987654321,
      owner_id: 100
    };

    await processor(event as any, logger);

    // Assert - Should retry as if efforts were empty, exhaust retries gracefully
    expect(mockStravaGetActivity).toHaveBeenCalledTimes(4);
    const delays = getBackoffDelays();
    expect(delays).toEqual([15000, 45000, 90000]);
  });

  it('should use the same token for all retry attempts', async () => {
    // Arrange
    createParticipant(orm, '100', 'Test Athlete', { accessToken: 'fake_token' });

    const activityWithEfforts: any = {
      id: 987654321,
      name: 'Ride',
      start_date: new Date().toISOString(),
      type: 'Ride',
      segment_efforts: [
        {
          id: 1,
          segment: { id: 123456, name: 'Segment' },
          elapsed_time: 250,
          start_date: new Date().toISOString(),
          pr_rank: null
        }
      ]
    };

    mockStravaGetActivity.mockResolvedValue(activityWithEfforts);
    (getValidAccessToken as any).mockResolvedValue('fake_token');

    // Act
    const processor = createWebhookProcessor(orm);
    const event = {
      object_type: 'activity',
      aspect_type: 'create',
      object_id: 987654321,
      owner_id: 100
    };

    await processor(event as any, logger);

    // Assert - getValidAccessToken called (token refresh happens, not per-retry)
    expect(getValidAccessToken).toHaveBeenCalled();
    // All calls to getActivity should use same token
    mockStravaGetActivity.mock.calls.forEach((call: any[]) => {
      expect(call[1]).toBe('fake_token');
    });
  });
});
