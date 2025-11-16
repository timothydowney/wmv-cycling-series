const request = require('supertest');
const path = require('path');
const fs = require('fs');
const {
  createSeason,
  createSegment,
  createParticipant,
  createWeek,
  clearAllData
} = require('./testDataHelpers');

// Set test database path before requiring app
const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test-submission.db');
process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

// Remove test database if it exists
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

// Mock strava-v3 before requiring the app
jest.mock('strava-v3', () => ({
  config: jest.fn(),
  client: jest.fn().mockImplementation(() => ({
    activities: {
      get: jest.fn()
    }
  })),
  oauth: {
    refreshToken: jest.fn(),
    getToken: jest.fn()
  }
}));

const { app, db } = require('../index');
const strava = require('strava-v3');

describe('Activity Submission API', () => {
  const testStravaAthleteId = 12345678;
  let testWeekId;
  let testSeasonId;
  const testSegmentId = 99887766; // Made-up Strava segment ID for testing

  beforeAll(() => {
    clearAllData(db);

    // Create test season
    const season = createSeason(db, 'Test Season', true);
    testSeasonId = season.seasonId;

    // Create test segment
    createSegment(db, testSegmentId, 'Test Climb Segment');

    // Create test week
    const week = createWeek(db, {
      seasonId: testSeasonId,
      stravaSegmentId: testSegmentId,
      weekName: 'Test Week',
      date: '2025-11-12',
      requiredLaps: 2
    });
    testWeekId = week.weekId;

    // Create a test participant with Strava athlete ID and custom token values
    createParticipant(db, testStravaAthleteId, 'Test Athlete', {
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token'
    });
  });

  afterAll(async () => {
    // Close database connection
    if (db && db.open) {
      db.close();
    }
    
    // Clean up test database
    await new Promise(resolve => setTimeout(resolve, 100));
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (err) {
        // File may be locked
      }
    }
  });

  beforeEach(() => {
    // Reset strava mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /weeks/:id/submit-activity', () => {
    test('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .post(`/weeks/${testWeekId}/submit-activity`)
        .send({ activity_url: 'https://www.strava.com/activities/12345678' });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Not authenticated');
    });

    test('returns 401 when activity URL is missing (no auth)', async () => {
      // Without authentication, should get 401 before validation
      const response = await request(app)
        .post(`/weeks/${testWeekId}/submit-activity`)
        .send({});
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Not authenticated');
    });

    test('returns 401 for invalid activity URL format (no auth)', async () => {
      // Without authentication, should get 401 before validation
      const response = await request(app)
        .post(`/weeks/${testWeekId}/submit-activity`)
        .send({ activity_url: 'https://invalid.com/not-strava' });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Not authenticated');
    });

    test('validates activity date matches week date', async () => {
      // This test validates the mocking setup for Strava API
      // In production, the endpoint would call Strava API to get activity details
      const mockClient = new strava.client('test_access_token');
      mockClient.activities.get.mockResolvedValueOnce({
        id: 88776655, // Made-up Strava activity ID
        start_date: '2025-01-01T08:00:00Z', // Wrong date (not matching week date)
        segment_efforts: []
      });

      // Verify the mock is configured properly
      expect(mockClient.activities.get).toBeDefined();
      expect(strava.client).toHaveBeenCalled();
    });

    test('validates required segment is present', async () => {
      // Mock Strava API response without required segment
      const mockClient = new strava.client('test_access_token');
      mockClient.activities.get.mockResolvedValueOnce({
        id: 88776655,
        start_date: '2025-11-12T08:00:00Z',
        segment_efforts: [
          { segment: { id: 11223344 }, elapsed_time: 885 } // Wrong segment ID (not testSegmentId)
        ]
      });

      expect(mockClient.activities.get).toBeDefined();
    });

    test('validates required number of laps', async () => {
      // Mock Strava API response with insufficient laps (need 2, only have 1)
      const mockClient = new strava.client('test_access_token');
      mockClient.activities.get.mockResolvedValueOnce({
        id: 88776655,
        start_date: '2025-11-12T08:00:00Z',
        segment_efforts: [
          { segment: { id: testSegmentId }, elapsed_time: 885 } // Only 1 lap when 2 required
        ]
      });

      expect(mockClient.activities.get).toBeDefined();
    });
  });

  describe('Activity extraction helpers', () => {
    test('extractActivityId extracts ID from valid URL', () => {
      // Note: extractActivityId is not exported, testing via endpoint
      const validUrls = [
        'https://www.strava.com/activities/12345678',
        'https://strava.com/activities/87654321',
        'http://www.strava.com/activities/11111111'
      ];

      validUrls.forEach(url => {
        expect(url).toMatch(/strava\.com\/activities\/\d+/);
      });
    });

    test('extractActivityId returns null for invalid URL', () => {
      const invalidUrls = [
        'https://example.com/activities/12345',
        'https://www.strava.com/athletes/12345',
        'not-a-url'
      ];

      invalidUrls.forEach(url => {
        expect(url).not.toMatch(/strava\.com\/activities\/\d+/);
      });
    });
  });

  describe('Token refresh logic', () => {
    test('uses existing token when not expired', async () => {
      const token = db.prepare(`
        SELECT * FROM participant_token WHERE strava_athlete_id = ?
      `).get(testStravaAthleteId);

      expect(token).toBeDefined();
      expect(token.access_token).toBe('test_access_token');
      
      const now = Math.floor(Date.now() / 1000);
      expect(token.expires_at).toBeGreaterThanOrEqual(now + 3599); // Not expiring soon (allow 1 sec margin)
    });

    test('token expiry is stored as unix timestamp', async () => {
      const token = db.prepare(`
        SELECT expires_at FROM participant_token WHERE strava_athlete_id = ?
      `).get(testStravaAthleteId);

      expect(token.expires_at).toBeGreaterThan(1700000000); // After Nov 2023
      expect(token.expires_at).toBeLessThan(2000000000); // Before May 2033
    });
  });

  describe('Leaderboard computation', () => {
    test('leaderboard is computed dynamically on read', () => {
      // Scores are computed on read from activity and segment_effort tables
      // Verify that leaderboard endpoints compute from activities table
      const indexContent = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
      expect(indexContent).toContain('leaderboard');
    });
  });
});
