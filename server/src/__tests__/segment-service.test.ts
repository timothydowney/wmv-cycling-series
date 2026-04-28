import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
// @ts-nocheck
/**
 * SegmentService Unit Tests
 * Tests for segment metadata fetching and storage service
 */

import { SegmentService } from '../services/SegmentService';
import { setupTestDb, teardownTestDb, createParticipant, createSegment, clearAllData } from './testDataHelpers';
import { segment } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import * as stravaClientMock from '../stravaClient';
import * as tokenManagerMock from '../tokenManager';

// Mock strava-v3 and stravaClient
jest.mock('strava-v3', () => ({
  config: jest.fn(),
  client: jest.fn().mockImplementation(() => ({
    activities: { get: jest.fn() }
  })),
  oauth: {
    refreshToken: jest.fn().mockResolvedValue({
      access_token: 'new_token_12345',
      refresh_token: 'new_refresh_12345',
      expires_at: Math.floor(Date.now() / 1000) + 3600
    })
  }
}));

jest.mock('../stravaClient', () => ({
  getSegment: jest.fn().mockResolvedValue({
    id: '12345678',  // NOTE: Strava API returns 'id', not 'strava_segment_id'
    name: 'Test Segment Name',
    distance: 3000,
    total_elevation_gain: 150,
    average_grade: 5.5,
    climb_category: 2,
    start_latlng: [42.3201, -72.6304],
    end_latlng: [42.3315, -72.6122],
    city: 'Test City',
    state: 'TC',
    country: 'Test Country'
  }),
  mapStravaSegmentToSegmentRow: jest.fn(segment => ({
    strava_segment_id: segment.id,
    name: segment.name,
    distance: segment.distance,
    total_elevation_gain: segment.total_elevation_gain,
    average_grade: segment.average_grade,
    climb_category: segment.climb_category,
    start_latitude: segment.start_latlng?.[0] ?? null,
    start_longitude: segment.start_latlng?.[1] ?? null,
    end_latitude: segment.end_latlng?.[0] ?? null,
    end_longitude: segment.end_latlng?.[1] ?? null,
    metadata_updated_at: '2026-04-19T12:00:00Z',
    city: segment.city,
    state: segment.state,
    country: segment.country
  }))
}));

jest.mock('../tokenManager', () => ({
  getValidAccessToken: jest.fn().mockResolvedValue('mock_access_token_123')
}));

describe('SegmentService', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let service: SegmentService;

  const TEST_SEGMENT_ID = '12345678';
  const TEST_ATHLETE_ID = '999001';

  beforeAll(async () => {
    const testDb = setupTestDb({ seed: false });
    pool = testDb.pool;
    orm = testDb.orm;
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  beforeEach(async () => {
    await clearAllData(orm);
    service = new SegmentService(orm);
  });

  describe('fetchAndStoreSegmentMetadata()', () => {
    test('should fetch segment metadata from Strava and store in database', async () => {
      // Setup: Create participant with token
      await createParticipant(orm, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      // Action: Fetch segment
      const result = await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-context');

      // Assert: Metadata returned
      expect(result).toMatchObject({
        strava_segment_id: TEST_SEGMENT_ID,
        name: 'Test Segment Name',
        distance: 3000,
        total_elevation_gain: 150,
        average_grade: 5.5,
        climb_category: 2,
        start_latitude: 42.3201,
        start_longitude: -72.6304,
        end_latitude: 42.3315,
        end_longitude: -72.6122,
        city: 'Test City',
        state: 'TC',
        country: 'Test Country'
      });

      // Assert: Data stored in database
      const [stored] = await orm.select().from(segment).where(eq(segment.strava_segment_id, TEST_SEGMENT_ID));
      expect(stored).toMatchObject({
        strava_segment_id: TEST_SEGMENT_ID,
        name: 'Test Segment Name',
        distance: 3000,
        start_latitude: 42.3201,
        end_longitude: -72.6122,
      });
      // metadata_updated_at is now timestamptz — verify the point in time, not the string format
      expect(new Date(stored.metadata_updated_at!).getTime()).toBe(new Date('2026-04-19T12:00:00Z').getTime());
    });

    test('should create placeholder segment when no connected participants', async () => {
      // Setup: No participants

      // Action: Fetch segment
      const result = await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-context');

      // Assert: Placeholder created with minimal data
      expect(result).toBeDefined();
      expect(result?.strava_segment_id).toBe(TEST_SEGMENT_ID);
      expect(result?.name).toMatch(/Segment/); // Should have placeholder name
      expect(result?.distance).toBeNull();
      expect(result?.total_elevation_gain).toBeNull();

      // Assert: Row exists in database
      const [stored] = await orm.select().from(segment).where(eq(segment.strava_segment_id, TEST_SEGMENT_ID));
      expect(stored).toBeDefined();
    });

    test('should handle API errors gracefully and create placeholder', async () => {
      // Setup
      await createParticipant(orm, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      // Mock API failure
      const getSegmentMock = stravaClientMock.getSegment as jest.Mock;
      getSegmentMock.mockRejectedValueOnce(new Error('Strava API error'));

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Action: Fetch segment
      const result = await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-context');

      // Assert: Placeholder created
      expect(result).toBeDefined();
      expect(result?.strava_segment_id).toBe(TEST_SEGMENT_ID);
      expect(result?.distance).toBeNull();

      // Assert: Error was logged to console (spied before call)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[test-context]')
      );
      consoleSpy.mockRestore();
    });

    test('should send user-friendly messages via callback without technical context', async () => {
      // Setup
      await createParticipant(orm, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      const logMessages: Array<[string, string]> = [];
      const logCallback = (level: string, msg: string) => {
        logMessages.push([level, msg]);
      };

      // Action: Fetch segment
      await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-context', logCallback);

      // Assert: Success message without context prefix
      const successMsg = logMessages.find(([level]) => level === 'success');
      expect(successMsg).toBeDefined();
      expect(successMsg![1]).not.toMatch(/\[test-context\]/); // No context prefix
      expect(successMsg![1]).toMatch(/✓ Segment metadata updated/);
      expect(successMsg![1]).toMatch(/Test Segment Name/);
    });

    test('should send error messages via callback without technical context', async () => {
      // Setup
      await createParticipant(orm, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      const getSegmentMock = stravaClientMock.getSegment as jest.Mock;
      getSegmentMock.mockRejectedValueOnce(new Error('Segment not found'));

      const logMessages: Array<[string, string]> = [];
      const logCallback = (level: string, msg: string) => {
        logMessages.push([level, msg]);
      };

      // Action: Fetch segment
      await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-context', logCallback);

      // Assert: Error message without context prefix
      const errorMsg = logMessages.find(([level]) => level === 'error');
      expect(errorMsg).toBeDefined();
      expect(errorMsg![1]).not.toMatch(/\[test-context\]/); // No context prefix
      expect(errorMsg![1]).toMatch(/Could not update segment metadata/);
    });

    test('should be idempotent (INSERT OR REPLACE)', async () => {
      // Setup
      await createParticipant(orm, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      // First fetch
      await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-1');
      const [countRes1] = await orm.select({ cnt: sql<number>`count(*)`.as('cnt') }).from(segment);
      expect(countRes1?.cnt).toBe(1);

      // Second fetch (should update, not insert)
      await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-2');
      const [countRes2] = await orm.select({ cnt: sql<number>`count(*)`.as('cnt') }).from(segment);
      expect(countRes2?.cnt).toBe(1);

      // Verify data was updated
      const [stored] = await orm.select().from(segment).where(eq(segment.strava_segment_id, TEST_SEGMENT_ID));
      expect(stored?.name).toBe('Test Segment Name');
    });

    test('should call token refresh with correct parameters', async () => {
      // Setup
      await createParticipant(orm, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'old_token',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) - 3600 // Expired
      });

      const { getValidAccessToken } = tokenManagerMock;

      // Action: Fetch segment
      await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-context');

      // Assert: Token manager was called with athlete ID
      expect(getValidAccessToken).toHaveBeenCalledWith(
        expect.any(Object), // db
        expect.any(Object), // stravaClient
        TEST_ATHLETE_ID // athleteId
      );
    });

    test('should handle different context strings for logging', async () => {
      // Setup
      await createParticipant(orm, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Test with different contexts
      await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'week-create');
      await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID + 1, 'fetch-results');
      await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID + 2, 'segment-validation');

      // Assert: Context appears in console logs (technical logs only)
      const calls = consoleSpy.mock.calls.map(c => c[0]);
      expect(calls.some(c => typeof c === 'string' && c.includes('[week-create]'))).toBe(true);
      expect(calls.some(c => typeof c === 'string' && c.includes('[fetch-results]'))).toBe(true);
      expect(calls.some(c => typeof c === 'string' && c.includes('[segment-validation]'))).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Utility Methods', () => {
    test('segmentExists() returns true for existing segment', async () => {
      await createSegment(orm, TEST_SEGMENT_ID, 'Test Segment');
      expect(await service.segmentExists(TEST_SEGMENT_ID)).toBe(true);
    });

    test('segmentExists() returns false for non-existing segment', async () => {
      expect(await service.segmentExists('99999999')).toBe(false);
    });

    test('getAllSegments() returns empty array when no segments', async () => {
      const segments = await service.getAllSegments();
      expect(segments).toEqual([]);
    });

    test('getAllSegments() returns all segments sorted by name', async () => {
      await createSegment(orm, '111', 'Zebra Climb');
      await createSegment(orm, '222', 'Apple Ridge');
      await createSegment(orm, '333', 'Mountain Peak');

      const segments = await service.getAllSegments();
      expect(segments).toHaveLength(3);
      expect(segments[0].name).toBe('Apple Ridge');
      expect(segments[1].name).toBe('Mountain Peak');
      expect(segments[2].name).toBe('Zebra Climb');
    });

    test('getAllSegments() returns complete segment data', async () => {
      await createSegment(orm, TEST_SEGMENT_ID, 'Test Segment', {
        distance: 5000,
        averageGrade: 4.5,
        totalElevationGain: 220,
        climbCategory: 3,
        startLatitude: 40.015,
        startLongitude: -105.2705,
        endLatitude: 40.025,
        endLongitude: -105.255,
        metadataUpdatedAt: '2026-04-18T16:45:00Z',
        city: 'Boulder',
        state: 'CO',
        country: 'USA'
      });

      const segments = await service.getAllSegments();
      expect(segments[0]).toMatchObject({
        strava_segment_id: TEST_SEGMENT_ID,
        name: 'Test Segment',
        distance: 5000,
        average_grade: 4.5,
        total_elevation_gain: 220,
        climb_category: 3,
        start_latitude: 40.015,
        start_longitude: -105.2705,
        end_latitude: 40.025,
        end_longitude: -105.255,
        city: 'Boulder',
        state: 'CO',
        country: 'USA'
      });
      // metadata_updated_at is now timestamptz — verify the point in time, not the string format
      expect(new Date(segments[0].metadata_updated_at!).getTime()).toBe(new Date('2026-04-18T16:45:00Z').getTime());
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined values in segment data', async () => {
      await createParticipant(orm, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      const { getSegment } = stravaClientMock;
      (getSegment as jest.Mock).mockResolvedValueOnce({
        name: 'Minimal Segment',
        distance: null,
        total_elevation_gain: null,
        average_grade: null,
        climb_category: null,
        city: null,
        state: null,
        country: null
      });

      const result = await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-context');

      expect(result).toMatchObject({
        strava_segment_id: TEST_SEGMENT_ID,
        name: 'Minimal Segment',
        distance: null,
        total_elevation_gain: null
      });
    });

    test('should handle existing placeholder when fetching fails', async () => {
      // Setup: Create placeholder first
      await createSegment(orm, TEST_SEGMENT_ID, `Segment ${TEST_SEGMENT_ID}`);

      await createParticipant(orm, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      const { getSegment } = stravaClientMock;
      (getSegment as jest.Mock).mockRejectedValueOnce(new Error('API error'));

      // Action: Try to fetch (will fail but placeholder exists)
      const result = await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-context');

      // Assert: Returns existing placeholder
      expect(result).toBeDefined();
      expect(result?.strava_segment_id).toBe(TEST_SEGMENT_ID);

      // Assert: Only 1 row in database (not duplicated)
      const [countRes] = await orm.select({ cnt: sql<number>`count(*)`.as('cnt') }).from(segment).where(eq(segment.strava_segment_id, TEST_SEGMENT_ID));
      expect(countRes?.cnt).toBe(1);
    });

    test('should not callback when logCallback is undefined', async () => {
      await createParticipant(orm, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      // Action: No callback provided
      const result = await service.fetchAndStoreSegmentMetadata(
        TEST_SEGMENT_ID,
        'test-context',
        undefined // No callback
      );

      // Assert: Still completes successfully
      expect(result).toBeDefined();
      expect(result?.strava_segment_id).toBe(TEST_SEGMENT_ID);
    });
  });
});