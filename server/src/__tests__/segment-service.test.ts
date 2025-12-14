// @ts-nocheck
/**
 * SegmentService Unit Tests
 * Tests for segment metadata fetching and storage service
 */

import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { SegmentService } from '../services/SegmentService';
import { setupTestDb, teardownTestDb, createParticipant, createSegment, clearAllData } from './testDataHelpers';
import { segment } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

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
    id: 12345678,  // NOTE: Strava API returns 'id', not 'strava_segment_id'
    name: 'Test Segment Name',
    distance: 3000,
    total_elevation_gain: 150,
    average_grade: 5.5,
    climb_category: 2,
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
    city: segment.city,
    state: segment.state,
    country: segment.country
  }))
}));

jest.mock('../tokenManager', () => ({
  getValidAccessToken: jest.fn().mockResolvedValue('mock_access_token_123')
}));

describe('SegmentService', () => {
  let db: Database;
  let drizzleDb: BetterSQLite3Database;
  let service: SegmentService;

  const TEST_SEGMENT_ID = 12345678;
  const TEST_ATHLETE_ID = 999001;

  beforeAll(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    drizzleDb = testDb.drizzleDb;
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  beforeEach(() => {
    clearAllData(drizzleDb);
    service = new SegmentService(drizzleDb);
  });

  describe('fetchAndStoreSegmentMetadata()', () => {
    test('should fetch segment metadata from Strava and store in database', async () => {
      // Setup: Create participant with token
      createParticipant(drizzleDb, TEST_ATHLETE_ID, 'Test User', {
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
        city: 'Test City',
        state: 'TC',
        country: 'Test Country'
      });

      // Assert: Data stored in database
      const stored = await drizzleDb.select().from(segment).where(eq(segment.strava_segment_id, TEST_SEGMENT_ID)).get();
      expect(stored).toMatchObject({
        strava_segment_id: TEST_SEGMENT_ID,
        name: 'Test Segment Name',
        distance: 3000
      });
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
      const stored = await drizzleDb.select().from(segment).where(eq(segment.strava_segment_id, TEST_SEGMENT_ID)).get();
      expect(stored).toBeDefined();
    });

    test('should handle API errors gracefully and create placeholder', async () => {
      // Setup
      createParticipant(drizzleDb, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      // Mock API failure
      const { getSegment } = require('../stravaClient');
      getSegment.mockRejectedValueOnce(new Error('Strava API error'));

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
      createParticipant(drizzleDb, TEST_ATHLETE_ID, 'Test User', {
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
      createParticipant(drizzleDb, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      const { getSegment } = require('../stravaClient');
      getSegment.mockRejectedValueOnce(new Error('Segment not found'));

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
      createParticipant(drizzleDb, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      // First fetch
      await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-1');
      const countRes1 = await drizzleDb.select({ cnt: sql<number>`count(*)` }).from(segment).get();
      expect(countRes1?.cnt).toBe(1);

      // Second fetch (should update, not insert)
      await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-2');
      const countRes2 = await drizzleDb.select({ cnt: sql<number>`count(*)` }).from(segment).get();
      expect(countRes2?.cnt).toBe(1);

      // Verify data was updated
      const stored = await drizzleDb.select().from(segment).where(eq(segment.strava_segment_id, TEST_SEGMENT_ID)).get();
      expect(stored?.name).toBe('Test Segment Name');
    });

    test('should call token refresh with correct parameters', async () => {
      // Setup
      createParticipant(drizzleDb, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'old_token',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) - 3600 // Expired
      });

      const { getValidAccessToken } = require('../tokenManager');

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
      createParticipant(drizzleDb, TEST_ATHLETE_ID, 'Test User', {
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
      createSegment(drizzleDb, TEST_SEGMENT_ID, 'Test Segment');
      expect(await service.segmentExists(TEST_SEGMENT_ID)).toBe(true);
    });

    test('segmentExists() returns false for non-existing segment', async () => {
      expect(await service.segmentExists(99999999)).toBe(false);
    });

    test('getAllSegments() returns empty array when no segments', async () => {
      const segments = await service.getAllSegments();
      expect(segments).toEqual([]);
    });

    test('getAllSegments() returns all segments sorted by name', async () => {
      createSegment(drizzleDb, 111, 'Zebra Climb');
      createSegment(drizzleDb, 222, 'Apple Ridge');
      createSegment(drizzleDb, 333, 'Mountain Peak');

      const segments = await service.getAllSegments();
      expect(segments).toHaveLength(3);
      expect(segments[0].name).toBe('Apple Ridge');
      expect(segments[1].name).toBe('Mountain Peak');
      expect(segments[2].name).toBe('Zebra Climb');
    });

    test('getAllSegments() returns complete segment data', async () => {
      createSegment(drizzleDb, TEST_SEGMENT_ID, 'Test Segment', {
        distance: 5000,
        averageGrade: 4.5,
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
        city: 'Boulder',
        state: 'CO',
        country: 'USA'
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined values in segment data', async () => {
      createParticipant(drizzleDb, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      const { getSegment } = require('../stravaClient');
      getSegment.mockResolvedValueOnce({
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
      createSegment(drizzleDb, TEST_SEGMENT_ID, `Segment ${TEST_SEGMENT_ID}`);

      createParticipant(drizzleDb, TEST_ATHLETE_ID, 'Test User', {
        accessToken: 'token_123',
        refreshToken: 'refresh_123',
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      });

      const { getSegment } = require('../stravaClient');
      getSegment.mockRejectedValueOnce(new Error('API error'));

      // Action: Try to fetch (will fail but placeholder exists)
      const result = await service.fetchAndStoreSegmentMetadata(TEST_SEGMENT_ID, 'test-context');

      // Assert: Returns existing placeholder
      expect(result).toBeDefined();
      expect(result?.strava_segment_id).toBe(TEST_SEGMENT_ID);

      // Assert: Only 1 row in database (not duplicated)
      const countRes = await drizzleDb.select({ cnt: sql<number>`count(*)` }).from(segment).where(eq(segment.strava_segment_id, TEST_SEGMENT_ID)).get();
      expect(countRes?.cnt).toBe(1);
    });

    test('should not callback when logCallback is undefined', async () => {
      createParticipant(drizzleDb, TEST_ATHLETE_ID, 'Test User', {
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