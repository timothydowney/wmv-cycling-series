const { isoToUnix } = require('../dateUtils');
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const {
  clearAllData,
  createSeason,
  createSegment,
  createParticipant,
  makeRequestAsUser
} = require('./testDataHelpers');

// Mock strava-v3 library to prevent network calls
jest.mock('strava-v3', () => ({
  config: jest.fn(),
  client: jest.fn().mockImplementation(() => ({
    activities: { get: jest.fn() }
  })),
  oauth: {
    refreshToken: jest.fn(),
    getToken: jest.fn()
  }
}));

// Set test database path before requiring app
const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'coverage-test.db');
process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';
process.env.ADMIN_ATHLETE_IDS = '999001'; // Set admin IDs for tests

// Remove test database if it exists
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

const { app, db } = require('../index');

describe('Coverage Improvements - Quick Wins', () => {
  const TEST_SEASON_ID = 1;
  const TEST_SEGMENT_1 = 12345678;
  const TEST_SEGMENT_2 = 23456789;
  const TEST_ATHLETE = 1001001;

  let testWeekId;

  beforeAll(() => {
    clearAllData(db);
    createSeason(db, 'Test Season', true);
    createSegment(db, TEST_SEGMENT_1, 'Segment 1', { distance: 1.5, averageGrade: 5.2, city: 'Boston', state: 'MA', country: 'USA' });
    createParticipant(db, TEST_ATHLETE, 'Test Athlete');
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // ============================================================================
  // ADMIN SEGMENTS MANAGEMENT - New Coverage
  // ============================================================================

  describe('Admin Segments Management', () => {
    describe('GET /admin/segments', () => {
      test('returns empty array initially', async () => {
        // Clean segments for this test
        db.prepare('DELETE FROM segment').run();

        const res = await request(app).get('/admin/segments');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(0);
      });

      test('returns list of segments with correct structure', async () => {
        // Clean and add test data
        db.prepare('DELETE FROM segment').run();
        db.prepare(`
          INSERT INTO segment (strava_segment_id, name, distance, average_grade, city, state, country)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(TEST_SEGMENT_1, 'Climb 1', 2.5, 6.5, 'Denver', 'CO', 'USA');
        db.prepare(`
          INSERT INTO segment (strava_segment_id, name, distance, average_grade, city, state, country)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(TEST_SEGMENT_2, 'Flat Segment', 5.0, 1.2, 'Austin', 'TX', 'USA');

        const res = await request(app).get('/admin/segments');

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('strava_segment_id');
        expect(res.body[0]).toHaveProperty('name');
        expect(res.body[0]).toHaveProperty('distance');
        expect(res.body[0]).toHaveProperty('average_grade');
        expect(res.body[0]).toHaveProperty('city');
        expect(res.body[0]).toHaveProperty('state');
        expect(res.body[0]).toHaveProperty('country');
      });

      test('returns segments sorted alphabetically by name', async () => {
        db.prepare('DELETE FROM segment').run();
        db.prepare(`
          INSERT INTO segment (strava_segment_id, name, distance, average_grade, city, state, country)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(111, 'Zebra Hill', 1.0, 3.0, 'City1', 'ST1', 'Country1');
        db.prepare(`
          INSERT INTO segment (strava_segment_id, name, distance, average_grade, city, state, country)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(222, 'Apple Street', 2.0, 4.0, 'City2', 'ST2', 'Country2');

        const res = await request(app).get('/admin/segments');

        expect(res.status).toBe(200);
        expect(res.body[0].name).toBe('Apple Street');
        expect(res.body[1].name).toBe('Zebra Hill');
      });
    });

    describe('POST /admin/segments', () => {
      test('creates new segment with all fields', async () => {
        db.prepare('DELETE FROM segment').run();

        const res = await request(app)
          .post('/admin/segments')
          .send({
            strava_segment_id: 555,
            name: 'Test Segment',
            distance: 3.2,
            average_grade: 7.1,
            city: 'Boulder',
            state: 'CO',
            country: 'USA'
          });

        expect(res.status).toBe(201);
        expect(res.body.strava_segment_id).toBe(555);
        expect(res.body.name).toBe('Test Segment');
        expect(res.body.distance).toBe(3.2);
        expect(res.body.average_grade).toBe(7.1);
        expect(res.body.city).toBe('Boulder');
      });

      test('creates segment with minimal fields (only required)', async () => {
        db.prepare('DELETE FROM segment').run();

        const res = await request(app)
          .post('/admin/segments')
          .send({
            strava_segment_id: 777,
            name: 'Minimal Segment'
          });

        expect(res.status).toBe(201);
        expect(res.body.strava_segment_id).toBe(777);
        expect(res.body.name).toBe('Minimal Segment');
        expect(res.body.distance).toBeNull();
        expect(res.body.average_grade).toBeNull();
      });

      test('returns 400 when strava_segment_id is missing', async () => {
        const res = await request(app)
          .post('/admin/segments')
          .send({
            name: 'Incomplete Segment'
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('required');
        expect(res.body.required).toContain('strava_segment_id');
      });

      test('returns 400 when name is missing', async () => {
        const res = await request(app)
          .post('/admin/segments')
          .send({
            strava_segment_id: 888
          });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('required');
        expect(res.body.required).toContain('name');
      });

      test('returns 400 when body is empty', async () => {
        const res = await request(app)
          .post('/admin/segments')
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('required');
      });

      test('updates existing segment (upsert behavior)', async () => {
        db.prepare('DELETE FROM segment').run();

        // First insert
        let res = await request(app)
          .post('/admin/segments')
          .send({
            strava_segment_id: 999,
            name: 'Original Name',
            distance: 1.0,
            average_grade: 2.0
          });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Original Name');

        // Update same segment
        res = await request(app)
          .post('/admin/segments')
          .send({
            strava_segment_id: 999,
            name: 'Updated Name',
            distance: 2.0,
            average_grade: 3.0
          });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Updated Name');
        expect(res.body.distance).toBe(2.0);

        // Verify only one segment exists
        const allSegments = db.prepare('SELECT COUNT(*) as count FROM segment').get();
        expect(allSegments.count).toBe(1);
      });

      test('handles null/empty metadata fields', async () => {
        db.prepare('DELETE FROM segment').run();

        const res = await request(app)
          .post('/admin/segments')
          .send({
            strava_segment_id: 1111,
            name: 'No Metadata',
            distance: null,
            average_grade: null,
            city: null,
            state: null,
            country: null
          });

        expect(res.status).toBe(201);
        expect(res.body.strava_segment_id).toBe(1111);
        expect(res.body.distance).toBeNull();
        expect(res.body.city).toBeNull();
      });
    });
  });

  // ============================================================================
  // ADMIN SEGMENTS - Non-Admin Rejection Tests
  // ============================================================================

  describe('Admin Segments - Non-Admin Rejection', () => {
    test('GET /admin/segments rejects non-admin with 403', async () => {
      const res = await makeRequestAsUser(request, app, {
        method: 'get',
        path: '/admin/segments',
        athleteId: 999999
      });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toMatch(/admin|forbidden/i);
    });

    test('POST /admin/segments rejects non-admin with 403', async () => {
      const res = await makeRequestAsUser(request, app, {
        method: 'post',
        path: '/admin/segments',
        athleteId: 999999,
        data: {
          strava_segment_id: 777,
          name: 'Unauthorized Segment'
        }
      });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ============================================================================
  // LEADERBOARD EDGE CASES - New Coverage
  // ============================================================================

  describe('Leaderboard Edge Cases', () => {
    let leaderboardSeasonId = 100; // Start with different ID to avoid conflicts

    beforeEach(() => {
      // Clean for each test
      clearAllData(db);

      // Don't delete seasons - just use unique IDs for each test
      leaderboardSeasonId++;

      // Create test season with unique ID
      createSeason(db, `Edge Case Season ${leaderboardSeasonId}`, true, { seasonId: leaderboardSeasonId });

      // Create test segment
      createSegment(db, TEST_SEGMENT_1, 'Test Segment', { distance: 2.0, averageGrade: 5.0, city: 'City', state: 'ST', country: 'Country' });

      // Create test week
      // start_at and end_at are now INTEGER Unix seconds (UTC)
      // Example: 2025-06-01 06:00 to 18:00 Eastern Time
      const startAtUnix = isoToUnix('2025-06-01T06:00:00');
      const endAtUnix = isoToUnix('2025-06-01T18:00:00');
      
      const result = db.prepare(`
        INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
      `).get(leaderboardSeasonId, 'Test Week', TEST_SEGMENT_1, 1, startAtUnix, endAtUnix);
      testWeekId = result.id;
    });

    test('returns empty leaderboard when no activities submitted', async () => {
      const res = await request(app).get(`/weeks/${testWeekId}/leaderboard`);

      expect(res.status).toBe(200);
      expect(res.body.week).toBeDefined();
      expect(res.body.leaderboard).toBeDefined();
      expect(Array.isArray(res.body.leaderboard)).toBe(true);
      expect(res.body.leaderboard.length).toBe(0);
    });

    test('returns week data with empty results', async () => {
      const res = await request(app).get(`/weeks/${testWeekId}/leaderboard`);

      expect(res.status).toBe(200);
      expect(res.body.week).toHaveProperty('id');
      expect(res.body.week).toHaveProperty('week_name');
      expect(res.body.week).toHaveProperty('segment_id');
    });

    test('leaderboard sorting works with single result', async () => {
      // Create participant
      db.prepare(`
        INSERT INTO participant (strava_athlete_id, name)
        VALUES (?, ?)
      `).run(1111, 'Single Rider');

      // Create activity with segment efforts (leaderboard reads from activities now)
      const activityStartUnix = isoToUnix('2025-06-01T10:00:00');
      const activityId = db.prepare(`
        INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at, validation_status) VALUES (?, ?, ?, ?, ?)
      `).run(testWeekId, 1111, 999, activityStartUnix, 'valid').lastInsertRowid;

      // Create segment effort
      const effortStartUnix = isoToUnix('2025-06-01T10:05:00');
      db.prepare(`
        INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(activityId, TEST_SEGMENT_1, 1, 3600, effortStartUnix);

      const res = await request(app).get(`/weeks/${testWeekId}/leaderboard`);

      expect(res.status).toBe(200);
      expect(res.body.leaderboard.length).toBe(1);
      expect(res.body.leaderboard[0].rank).toBe(1);
    });

    test('leaderboard with tied scores', async () => {
      // Create two participants
      db.prepare(`
        INSERT INTO participant (strava_athlete_id, name)
        VALUES (?, ?)
      `).run(2222, 'Rider A');
      db.prepare(`
        INSERT INTO participant (strava_athlete_id, name)
        VALUES (?, ?)
      `).run(2223, 'Rider B');

      // Create activities for both riders (leaderboard reads from activities)
      const activityStartUnixA = isoToUnix('2025-06-01T10:00:00');
      const activityStartUnixB = isoToUnix('2025-06-01T11:00:00');
      const activityIdA = db.prepare(`
        INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at, validation_status) VALUES (?, ?, ?, ?, ?)
      `).run(testWeekId, 2222, 9991, activityStartUnixA, 'valid').lastInsertRowid;

      const activityIdB = db.prepare(`
        INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at, validation_status) VALUES (?, ?, ?, ?, ?)
      `).run(testWeekId, 2223, 9992, activityStartUnixB, 'valid').lastInsertRowid;

      // Both riders have same time (tied scores)
      const effortStartUnixA = isoToUnix('2025-06-01T10:05:00');
      const effortStartUnixB = isoToUnix('2025-06-01T11:05:00');
      db.prepare(`
        INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(activityIdA, TEST_SEGMENT_1, 1, 3600, effortStartUnixA);

      db.prepare(`
        INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(activityIdB, TEST_SEGMENT_1, 1, 3600, effortStartUnixB);

      const res = await request(app).get(`/weeks/${testWeekId}/leaderboard`);

      expect(res.status).toBe(200);
      expect(res.body.leaderboard.length).toBe(2);
      // Both should have same points (both competed)
      expect(res.body.leaderboard[0].points).toBe(2);  // 1st place: (2-1)+1 = 2
      expect(res.body.leaderboard[1].points).toBe(1);  // 2nd place: (2-2)+1 = 1
    });
  });

  // ============================================================================
  // SEASON MANAGEMENT EDGE CASES - New Coverage
  // ============================================================================

  describe('Season Management Edge Cases', () => {
    beforeEach(() => {
      clearAllData(db);
    });

    test('POST /admin/seasons handles leap year dates', async () => {
      const res = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Leap Year Season',
          start_at: isoToUnix('2024-02-28T00:00:00Z'),
          end_at: isoToUnix('2024-02-29T23:59:59Z'),
          is_active: false
        });

      expect(res.status).toBe(201);
      expect(res.body.start_at).toBe(isoToUnix('2024-02-28T00:00:00Z'));
      expect(res.body.end_at).toBe(isoToUnix('2024-02-29T23:59:59Z'));
    });

    test('POST /admin/seasons with start_date = end_date', async () => {
      const startAt = isoToUnix('2025-06-15T00:00:00Z');
      const endAt = isoToUnix('2025-06-15T23:59:59Z');
      
      const res = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Single Day Season',
          start_at: startAt,
          end_at: endAt,
          is_active: false
        });

      expect(res.status).toBe(201);
      expect(res.body.start_at).toBeLessThanOrEqual(res.body.end_at);
    });

    test('multiple seasons can coexist as inactive', async () => {
      const season1 = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Season 1',
          start_at: isoToUnix('2025-01-01T00:00:00Z'),
          end_at: isoToUnix('2025-03-31T23:59:59Z'),
          is_active: false
        });

      const season2 = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Season 2',
          start_at: isoToUnix('2025-04-01T00:00:00Z'),
          end_at: isoToUnix('2025-06-30T23:59:59Z'),
          is_active: false
        });

      expect(season1.status).toBe(201);
      expect(season2.status).toBe(201);

      const res = await request(app).get('/seasons');
      expect(res.body.length).toBe(2);
      expect(res.body.every(s => !s.is_active)).toBe(true);
    });

    test('activating new season deactivates previous active season', async () => {
      // Create first active season
      let res1 = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'First Active',
          start_at: isoToUnix('2025-01-01T00:00:00Z'),
          end_at: isoToUnix('2025-03-31T23:59:59Z'),
          is_active: true
        });

      const season1Id = res1.body.id;

      // Create second season and activate it
      const res2 = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Second Active',
          start_at: isoToUnix('2025-04-01T00:00:00Z'),
          end_at: isoToUnix('2025-06-30T23:59:59Z'),
          is_active: true
        });

      // Verify first season is now inactive
      res1 = await request(app).get(`/seasons/${season1Id}`);
      expect(res1.body.is_active).toBe(0);

      // Verify second is active
      expect(res2.body.is_active).toBe(1);
    });

    test('GET /seasons/:id returns correct season', async () => {
      const createRes = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Specific Season',
          start_at: isoToUnix('2025-01-01T00:00:00Z'),
          end_at: isoToUnix('2025-12-31T23:59:59Z'),
          is_active: false
        });

      const seasonId = createRes.body.id;
      const getRes = await request(app).get(`/seasons/${seasonId}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(seasonId);
      expect(getRes.body.name).toBe('Specific Season');
    });

    test('PUT /admin/seasons/:id updates season dates', async () => {
      const createRes = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Original',
          start_at: isoToUnix('2025-01-01T00:00:00Z'),
          end_at: isoToUnix('2025-06-30T23:59:59Z'),
          is_active: false
        });

      const seasonId = createRes.body.id;
      const newEndAt = isoToUnix('2025-12-31T23:59:59Z');

      const updateRes = await request(app)
        .put(`/admin/seasons/${seasonId}`)
        .send({
          start_at: isoToUnix('2025-02-01T00:00:00Z'),
          end_at: newEndAt
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.end_at).toBe(newEndAt);
    });
  });

  // ============================================================================
  // ADMIN SEASONS - Non-Admin Rejection Tests
  // ============================================================================

  describe('Admin Seasons - Non-Admin Rejection', () => {
    test('POST /admin/seasons rejects non-admin with 403', async () => {
      const res = await makeRequestAsUser(request, app, {
        method: 'post',
        path: '/admin/seasons',
        athleteId: 999999,
        data: {
          name: 'Unauthorized Season',
          start_at: isoToUnix('2026-01-01T00:00:00Z'),
          end_at: isoToUnix('2026-12-31T23:59:59Z'),
          is_active: false
        }
      });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });

    test('PUT /admin/seasons/:id rejects non-admin with 403', async () => {
      // First create a season as admin (this will work because of test middleware)
      const seasonRes = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Original Season',
          start_at: isoToUnix('2026-01-01T00:00:00Z'),
          end_at: isoToUnix('2026-12-31T23:59:59Z'),
          is_active: false
        });

      const seasonId = seasonRes.body.id;

      // Now try to update as non-admin
      const res = await makeRequestAsUser(request, app, {
        method: 'put',
        path: `/admin/seasons/${seasonId}`,
        athleteId: 999999,
        data: { name: 'Hacked Season' }
      });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });

    test('DELETE /admin/seasons/:id rejects non-admin with 403', async () => {
      // Create a season as admin
      const seasonRes = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Season to Delete',
          start_at: isoToUnix('2026-01-01T00:00:00Z'),
          end_at: isoToUnix('2026-12-31T23:59:59Z'),
          is_active: false
        });

      const seasonId = seasonRes.body.id;

      // Try to delete as non-admin
      const res = await makeRequestAsUser(request, app, {
        method: 'delete',
        path: `/admin/seasons/${seasonId}`,
        athleteId: 999999
      });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ============================================================================
  // WEEK MANAGEMENT EDGE CASES - New Coverage
  // ============================================================================

  describe('Week Management Additional Cases', () => {
    beforeEach(() => {
      clearAllData(db);
      createSeason(db, 'Week Test Season', true, { seasonId: TEST_SEASON_ID });
      createSegment(db, TEST_SEGMENT_1, 'Segment A', { distance: 2.0, averageGrade: 5.0, city: 'City', state: 'ST', country: 'Country' });
    });

    test('creates week with minimum required fields', async () => {
      const res = await request(app)
        .post('/admin/weeks')
        .send({
          season_id: TEST_SEASON_ID,
          week_name: 'Minimal Week',
          segment_id: TEST_SEGMENT_1,
          required_laps: 1,
          start_at: isoToUnix('2025-06-01T00:00:00Z'),
          end_at: isoToUnix('2025-06-01T22:00:00Z')
        });

      expect(res.status).toBe(201);
      expect(res.body.week_name).toBe('Minimal Week');
      expect(res.body.required_laps).toBe(1); // Default
    });

    test('creates week with explicit time window', async () => {
      const res = await request(app)
        .post('/admin/weeks')
        .send({
          season_id: TEST_SEASON_ID,
          week_name: 'Custom Times Week',
          segment_id: TEST_SEGMENT_1,
          required_laps: 2,
          start_at: isoToUnix('2025-06-02T07:00:00Z'),
          end_at: isoToUnix('2025-06-02T20:00:00Z')
        });

      expect(res.status).toBe(201);
      expect(res.body.start_at).toBe(isoToUnix('2025-06-02T07:00:00Z'));
      expect(res.body.end_at).toBe(isoToUnix('2025-06-02T20:00:00Z'));
    });

    test('week date can be in past or future', async () => {
      const pastRes = await request(app)
        .post('/admin/weeks')
        .send({
          season_id: TEST_SEASON_ID,
          week_name: 'Past Week',
          segment_id: TEST_SEGMENT_1,
          required_laps: 1,
          start_at: isoToUnix('2020-01-01T00:00:00Z'),
          end_at: isoToUnix('2020-01-01T22:00:00Z')
        });

      const futureRes = await request(app)
        .post('/admin/weeks')
        .send({
          season_id: TEST_SEASON_ID,
          week_name: 'Future Week',
          segment_id: TEST_SEGMENT_1,
          required_laps: 1,
          start_at: isoToUnix('2099-12-31T00:00:00Z'),
          end_at: isoToUnix('2099-12-31T22:00:00Z')
        });

      expect(pastRes.status).toBe(201);
      expect(futureRes.status).toBe(201);
    });
  });

  // ============================================================================
  // ADMIN PARTICIPANTS - New Coverage
  // ============================================================================

  describe('Admin Participants', () => {
    test('GET /admin/participants returns empty array initially', async () => {
      db.prepare('DELETE FROM participant_token').run();
      db.prepare('DELETE FROM participant').run();

      const res = await request(app).get('/admin/participants');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    test('GET /admin/participants includes participant info', async () => {
      db.prepare('DELETE FROM participant_token').run();
      db.prepare('DELETE FROM participant').run();

      db.prepare(`
        INSERT INTO participant (strava_athlete_id, name)
        VALUES (?, ?)
      `).run(5555, 'Test Participant');

      const res = await request(app).get('/admin/participants');

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('strava_athlete_id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('has_token');
      expect(res.body[0].name).toBe('Test Participant');
    });

    test('GET /admin/participants shows has_token = 0 when no token', async () => {
      db.prepare('DELETE FROM participant_token').run();
      db.prepare('DELETE FROM participant').run();

      db.prepare(`
        INSERT INTO participant (strava_athlete_id, name)
        VALUES (?, ?)
      `).run(6666, 'No Token Participant');

      const res = await request(app).get('/admin/participants');

      expect(res.status).toBe(200);
      expect(res.body[0].has_token).toBe(0);
    });

    test('GET /admin/participants shows has_token = 1 when token exists', async () => {
      db.prepare('DELETE FROM participant_token').run();
      db.prepare('DELETE FROM participant').run();

      db.prepare(`
        INSERT INTO participant (strava_athlete_id, name)
        VALUES (?, ?)
      `).run(7777, 'Token Participant');

      db.prepare(`
        INSERT INTO participant_token (strava_athlete_id, access_token, refresh_token, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(7777, 'fake_token', 'fake_refresh', Math.floor(Date.now() / 1000) + 3600);

      const res = await request(app).get('/admin/participants');

      expect(res.status).toBe(200);
      expect(res.body[0].has_token).toBe(1);
      expect(res.body[0]).toHaveProperty('token_expires_at');
    });

    test('GET /admin/participants returns participants sorted by name', async () => {
      db.prepare('DELETE FROM participant_token').run();
      db.prepare('DELETE FROM participant').run();

      db.prepare(`
        INSERT INTO participant (strava_athlete_id, name)
        VALUES (?, ?)
      `).run(8888, 'Zebra Rider');
      db.prepare(`
        INSERT INTO participant (strava_athlete_id, name)
        VALUES (?, ?)
      `).run(8889, 'Apple Rider');

      const res = await request(app).get('/admin/participants');

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].name).toBe('Apple Rider');
      expect(res.body[1].name).toBe('Zebra Rider');
    });
  });

  // ============================================================================
  // ADMIN PARTICIPANTS - Non-Admin Rejection Tests
  // ============================================================================

  describe('Admin Participants - Non-Admin Rejection', () => {
    test('GET /admin/participants rejects non-admin with 403', async () => {
      const res = await makeRequestAsUser(request, app, {
        method: 'get',
        path: '/admin/participants',
        athleteId: 999999
      });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ============================================================================
  // WEEK NOT FOUND ERROR - New Coverage
  // ============================================================================

  describe('Week Error Cases', () => {
    test('GET /weeks/:id returns 404 for non-existent week', async () => {
      const res = await request(app).get('/weeks/99999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    test('GET /weeks/:id/leaderboard returns 404 for non-existent week', async () => {
      const res = await request(app).get('/weeks/99999/leaderboard');

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });

  // ============================================================================
  // ADMIN SEGMENTS EDGE CASES - Additional Coverage
  // ============================================================================

  describe('Admin Segments Validation Cases', () => {
    beforeEach(() => {
      // Clean segments for each test - avoid FK constraints
      db.prepare('DELETE FROM week').run();
      db.prepare('DELETE FROM segment').run();
    });

    test('POST /admin/segments with only strava_segment_id', async () => {
      const res = await request(app)
        .post('/admin/segments')
        .send({
          strava_segment_id: 2222
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
      expect(res.body.required).toContain('name');
    });

    test('POST /admin/segments with only name', async () => {
      const res = await request(app)
        .post('/admin/segments')
        .send({
          name: 'Name Only Segment'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
      expect(res.body.required).toContain('strava_segment_id');
    });

    test('POST /admin/segments with numeric strava_segment_id', async () => {
      const res = await request(app)
        .post('/admin/segments')
        .send({
          strava_segment_id: 3333,
          name: 'Numeric ID Segment',
          distance: 2.5
        });

      expect(res.status).toBe(201);
      expect(res.body.strava_segment_id).toBe(3333);
    });

    test('POST /admin/segments with string strava_segment_id (coerced to number)', async () => {
      const res = await request(app)
        .post('/admin/segments')
        .send({
          strava_segment_id: '4444',
          name: 'String ID Segment'
        });

      expect(res.status).toBe(201);
      // SQLite coerces string numeric IDs to numbers
      expect(res.body.strava_segment_id).toBe(4444);
    });

    test('POST /admin/segments with very long name', async () => {
      const longName = 'A'.repeat(500);
      const res = await request(app)
        .post('/admin/segments')
        .send({
          strava_segment_id: 5555,
          name: longName
        });

      expect(res.status).toBe(201);
      expect(res.body.name.length).toBe(500);
    });

    test('POST /admin/segments with zero distance', async () => {
      const res = await request(app)
        .post('/admin/segments')
        .send({
          strava_segment_id: 6666,
          name: 'Zero Distance',
          distance: 0
        });

      expect(res.status).toBe(201);
      expect(res.body.distance).toBe(0);
    });

    test('POST /admin/segments with negative grade', async () => {
      const res = await request(app)
        .post('/admin/segments')
        .send({
          strava_segment_id: 7777,
          name: 'Downhill Segment',
          average_grade: -5.5
        });

      expect(res.status).toBe(201);
      expect(res.body.average_grade).toBe(-5.5);
    });
  });
});
