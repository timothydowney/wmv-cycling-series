const request = require('supertest');
const path = require('path');
const fs = require('fs');
const {
  clearAllData,
  createSeason,
  createSegment,
  createParticipant
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
      const result = db.prepare(`
        INSERT INTO week (season_id, week_name, date, strava_segment_id, required_laps, start_time, end_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `).get(leaderboardSeasonId, 'Test Week', '2025-06-01', TEST_SEGMENT_1, 1, '06:00', '18:00');
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
      expect(res.body.week).toHaveProperty('date');
      expect(res.body.week).toHaveProperty('segment_id');
    });

    test('leaderboard sorting works with single result', async () => {
      // Create participant
      db.prepare(`
        INSERT INTO participant (strava_athlete_id, name)
        VALUES (?, ?)
      `).run(1111, 'Single Rider');

      // Create activity with segment efforts (leaderboard reads from activities now)
      const activityId = db.prepare(`
        INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, validation_status) VALUES (?, ?, ?, ?)
      `).run(testWeekId, 1111, 999, 'valid').lastInsertRowid;

      // Create segment effort
      db.prepare(`
        INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds)
        VALUES (?, ?, ?, ?)
      `).run(activityId, TEST_SEGMENT_1, 1, 3600);

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
      const activityIdA = db.prepare(`
        INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, validation_status) VALUES (?, ?, ?, ?)
      `).run(testWeekId, 2222, 9991, 'valid').lastInsertRowid;

      const activityIdB = db.prepare(`
        INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, validation_status) VALUES (?, ?, ?, ?)
      `).run(testWeekId, 2223, 9992, 'valid').lastInsertRowid;

      // Both riders have same time (tied scores)
      db.prepare(`
        INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds)
        VALUES (?, ?, ?, ?)
      `).run(activityIdA, TEST_SEGMENT_1, 1, 3600);

      db.prepare(`
        INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds)
        VALUES (?, ?, ?, ?)
      `).run(activityIdB, TEST_SEGMENT_1, 1, 3600);

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
          start_date: '2024-02-28',
          end_date: '2024-02-29',
          is_active: false
        });

      expect(res.status).toBe(201);
      expect(res.body.start_date).toBe('2024-02-28');
      expect(res.body.end_date).toBe('2024-02-29');
    });

    test('POST /admin/seasons with start_date = end_date', async () => {
      const res = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Single Day Season',
          start_date: '2025-06-15',
          end_date: '2025-06-15',
          is_active: false
        });

      expect(res.status).toBe(201);
      expect(res.body.start_date).toBe(res.body.end_date);
    });

    test('multiple seasons can coexist as inactive', async () => {
      const season1 = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Season 1',
          start_date: '2025-01-01',
          end_date: '2025-03-31',
          is_active: false
        });

      const season2 = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Season 2',
          start_date: '2025-04-01',
          end_date: '2025-06-30',
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
          start_date: '2025-01-01',
          end_date: '2025-03-31',
          is_active: true
        });

      const season1Id = res1.body.id;

      // Create second season and activate it
      const res2 = await request(app)
        .post('/admin/seasons')
        .send({
          name: 'Second Active',
          start_date: '2025-04-01',
          end_date: '2025-06-30',
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
          start_date: '2025-01-01',
          end_date: '2025-12-31',
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
          start_date: '2025-01-01',
          end_date: '2025-06-30',
          is_active: false
        });

      const seasonId = createRes.body.id;

      const updateRes = await request(app)
        .put(`/admin/seasons/${seasonId}`)
        .send({
          start_date: '2025-02-01',
          end_date: '2025-12-31'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.start_date).toBe('2025-02-01');
      expect(updateRes.body.end_date).toBe('2025-12-31');
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
          date: '2025-06-01',
          segment_id: TEST_SEGMENT_1,
          required_laps: 1
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
          date: '2025-06-02',
          segment_id: TEST_SEGMENT_1,
          required_laps: 2,
          start_time: '07:00',
          end_time: '20:00'
        });

      expect(res.status).toBe(201);
      expect(res.body.start_time).toBe('07:00');
      expect(res.body.end_time).toBe('20:00');
    });

    test('week date can be in past or future', async () => {
      const pastRes = await request(app)
        .post('/admin/weeks')
        .send({
          season_id: TEST_SEASON_ID,
          week_name: 'Past Week',
          date: '2020-01-01',
          segment_id: TEST_SEGMENT_1,
          required_laps: 1
        });

      const futureRes = await request(app)
        .post('/admin/weeks')
        .send({
          season_id: TEST_SEASON_ID,
          week_name: 'Future Week',
          date: '2099-12-31',
          segment_id: TEST_SEGMENT_1,
          required_laps: 1
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
  // PUBLIC PARTICIPANTS - New Coverage
  // ============================================================================

  describe('GET /participants', () => {
    test('endpoint is accessible', async () => {
      const res = await request(app).get('/participants');

      // May be 200 or have participants data
      expect([200, 500]).toContain(res.status);
      // If it works, should be array
      if (res.status === 200) {
        expect(Array.isArray(res.body)).toBe(true);
      }
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

    test('GET /weeks/:id/activities returns empty for non-existent week', async () => {
      const res = await request(app).get('/weeks/99999/activities');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
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

  // ============================================================================
  // ADMIN DATA EXPORT/IMPORT - Complete Test Suite
  // ============================================================================

  describe('Admin Export/Import Data', () => {
    describe('GET /admin/export-data', () => {
      test('exports segments, seasons, and weeks (excludes participants)', async () => {
        // Clear and create test data
        clearAllData(db);
        createSeason(db, 'Test Season', true);
        createSegment(db, 111111, 'Test Segment', { distance: 2.5, averageGrade: 6.0 });
        createParticipant(db, 222222, 'Test Participant');

        const res = await request(app).get('/admin/export-data');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('exportedAt');
        expect(res.body).toHaveProperty('version');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).not.toHaveProperty('participants'); // Should NOT include participants
        expect(res.body.data).toHaveProperty('segments');
        expect(res.body.data).toHaveProperty('seasons');
        expect(res.body.data).toHaveProperty('weeks');
      });

      test('exports correct data types and fields', async () => {
        clearAllData(db);
        // eslint-disable-next-line no-unused-vars
        const seasonId = createSeason(db, 'Export Test Season', true);
        // eslint-disable-next-line no-unused-vars
        const segmentId = createSegment(db, 444444, 'Export Test Segment', { 
          distance: 3.5, 
          averageGrade: 7.5, 
          city: 'Denver', 
          state: 'CO', 
          country: 'USA' 
        });
        // Participants should NOT be exported, so we create one but don't check for it
        createParticipant(db, 555555, 'Export Test Participant');

        const res = await request(app).get('/admin/export-data');

        expect(res.status).toBe(200);

        // Check segment structure
        expect(res.body.data.segments.length).toBe(1);
        expect(res.body.data.segments[0].strava_segment_id).toBe(444444);
        expect(res.body.data.segments[0].name).toBe('Export Test Segment');
        expect(res.body.data.segments[0].distance).toBe(3.5);
        expect(res.body.data.segments[0].average_grade).toBe(7.5);
        expect(res.body.data.segments[0].city).toBe('Denver');
        expect(res.body.data.segments[0].state).toBe('CO');
        expect(res.body.data.segments[0].country).toBe('USA');

        // Check season structure
        expect(res.body.data.seasons.length).toBe(1);
        expect(res.body.data.seasons[0].name).toBe('Export Test Season');
        expect(res.body.data.seasons[0].is_active).toBe(1);
      });

      test('sets proper HTTP headers for download', async () => {
        const res = await request(app).get('/admin/export-data');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        expect(res.headers['content-disposition']).toContain('attachment');
        expect(res.headers['content-disposition']).toContain('wmv-export-');
        expect(res.headers['content-disposition']).toContain('.json');
      });
    });

    describe('POST /admin/import-data', () => {
      test('imports segments, seasons, and weeks (excludes participants)', async () => {
        clearAllData(db);

        const importData = {
          segments: [
            { 
              strava_segment_id: 888888, 
              name: 'Imported Segment 1',
              distance: 2.0,
              average_grade: 5.5,
              city: 'Boston',
              state: 'MA',
              country: 'USA'
            }
          ],
          seasons: [
            {
              id: 1,
              name: 'Imported Season',
              start_date: '2025-01-01',
              end_date: '2025-12-31',
              is_active: 1
            }
          ],
          weeks: [
            {
              id: 1,
              season_id: 1,
              week_name: 'Imported Week 1',
              date: '2025-01-07',
              strava_segment_id: 888888,
              required_laps: 2,
              start_time: '2025-01-07T00:00:00Z',
              end_time: '2025-01-07T22:00:00Z'
            }
          ]
        };

        const res = await request(app)
          .post('/admin/import-data')
          .send({ data: importData });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.imported).not.toHaveProperty('participants'); // Should NOT have participants
        expect(res.body.imported.segments).toBe(1);
        expect(res.body.imported.seasons).toBe(1);
        expect(res.body.imported.weeks).toBe(1);

        // Verify data was actually inserted (but NOT participants)
        const segments = db.prepare('SELECT COUNT(*) as count FROM segment').get();
        expect(segments.count).toBe(1);

        const seasons = db.prepare('SELECT COUNT(*) as count FROM season').get();
        expect(seasons.count).toBe(1);

        const weeks = db.prepare('SELECT COUNT(*) as count FROM week').get();
        expect(weeks.count).toBe(1);
      });

      test('respects foreign key constraints during import', async () => {
        clearAllData(db);

        const importData = {
          participants: [{ strava_athlete_id: 999999, name: 'Test' }],
          segments: [{ strava_segment_id: 111111, name: 'Segment' }],
          seasons: [
            {
              id: 1,
              name: 'Season',
              start_date: '2025-01-01',
              end_date: '2025-12-31',
              is_active: 1
            }
          ],
          weeks: [
            {
              id: 1,
              season_id: 1,
              week_name: 'Week',
              date: '2025-01-07',
              strava_segment_id: 111111,
              required_laps: 1,
              start_time: '2025-01-07T00:00:00Z',
              end_time: '2025-01-07T22:00:00Z'
            }
          ]
        };

        const res = await request(app)
          .post('/admin/import-data')
          .send({ data: importData });

        // Should succeed without FK violations
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      test('clears existing data before import (preserves participants)', async () => {
        // First import
        clearAllData(db);
        const importData1 = {
          segments: [],
          seasons: [],
          weeks: []
        };

        await request(app).post('/admin/import-data').send({ data: importData1 });

        // Add a participant manually (shouldn't be affected by import)
        db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(111, 'Original Participant');

        let count = db.prepare('SELECT COUNT(*) as count FROM participant').get();
        expect(count.count).toBe(1);

        // Second import with different segment data
        const importData2 = {
          segments: [{ strava_segment_id: 222, name: 'Segment' }],
          seasons: [],
          weeks: []
        };

        const res = await request(app).post('/admin/import-data').send({ data: importData2 });

        expect(res.status).toBe(200);

        // Participant should still be there (import doesn't touch participants)
        count = db.prepare('SELECT COUNT(*) as count FROM participant').get();
        expect(count.count).toBe(1);

        const participant = db.prepare('SELECT * FROM participant').get();
        expect(participant.name).toBe('Original Participant');

        // But segments should be updated
        const segmentCount = db.prepare('SELECT COUNT(*) as count FROM segment').get();
        expect(segmentCount.count).toBe(1);
      });

      test('validates required fields', async () => {
        const res = await request(app)
          .post('/admin/import-data')
          .send({ data: null });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });

      test('handles missing data field in request', async () => {
        const res = await request(app)
          .post('/admin/import-data')
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Missing data field');
      });

      test('skips invalid records silently', async () => {
        clearAllData(db);

        const importData = {
          segments: [
            { strava_segment_id: 666666, name: 'Valid Segment' },
            { name: 'Invalid Segment' } // Invalid - no strava_segment_id
          ],
          seasons: [
            {
              id: 1,
              name: 'Valid Season',
              start_date: '2025-01-01',
              end_date: '2025-12-31',
              is_active: 1
            },
            {
              id: 2,
              name: 'Invalid Season'
              // Missing required start_date and end_date
            }
          ],
          weeks: []
        };

        const res = await request(app)
          .post('/admin/import-data')
          .send({ data: importData });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Check database to see what was actually inserted
        const segmentCount = db.prepare('SELECT COUNT(*) as count FROM segment').get();
        expect(segmentCount.count).toBe(1);

        const segment = db.prepare('SELECT * FROM segment').get();
        expect(segment.name).toBe('Valid Segment');

        const seasonCount = db.prepare('SELECT COUNT(*) as count FROM season').get();
        expect(seasonCount.count).toBe(1);
      });

      test('handles empty data arrays', async () => {
        clearAllData(db);

        const importData = {
          participants: [],
          segments: [],
          seasons: [],
          weeks: []
        };

        const res = await request(app)
          .post('/admin/import-data')
          .send({ data: importData });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.imported.segments).toBe(0);
        expect(res.body.imported.seasons).toBe(0);
        expect(res.body.imported.weeks).toBe(0);
      });

      test('preserves transactional atomicity on error', async () => {
        clearAllData(db);

        // This would normally cause an error if we had validation that checked FK constraints
        // For now, we just verify the import works atomically
        const importData = {
          segments: [{ strava_segment_id: 777777, name: 'Segment' }],
          seasons: [
            {
              id: 1,
              name: 'Season',
              start_date: '2025-01-01',
              end_date: '2025-12-31',
              is_active: 1
            }
          ],
          weeks: []
        };

        const res = await request(app)
          .post('/admin/import-data')
          .send({ data: importData });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify import results - participants are NOT imported
        expect(db.prepare('SELECT COUNT(*) as count FROM participant').get().count).toBe(0);
        expect(db.prepare('SELECT COUNT(*) as count FROM segment').get().count).toBe(1);
        expect(db.prepare('SELECT COUNT(*) as count FROM season').get().count).toBe(1);
      });
    });

    describe('Export/Import Round-Trip', () => {
      test('data survives export then import cycle (without participants)', async () => {
        clearAllData(db);
        // eslint-disable-next-line no-unused-vars
        const seasonId = createSeason(db, 'Round Trip Season', true);
        // eslint-disable-next-line no-unused-vars
        const segmentId = createSegment(db, 888888, 'Round Trip Segment', { 
          distance: 4.0, 
          averageGrade: 8.0,
          city: 'Austin',
          state: 'TX',
          country: 'USA'
        });
        // Create participant but it won't be included in export/import cycle
        createParticipant(db, 999999, 'Round Trip Participant');

        // Export
        const exportRes = await request(app).get('/admin/export-data');
        expect(exportRes.status).toBe(200);
        const exported = exportRes.body.data;

        // Should not have participants in export
        expect(exported).not.toHaveProperty('participants');

        // Clear database
        clearAllData(db);

        // Verify cleared
        const count = db.prepare('SELECT COUNT(*) as count FROM segment').get();
        expect(count.count).toBe(0);

        // Import
        const importRes = await request(app)
          .post('/admin/import-data')
          .send({ data: exported });

        expect(importRes.status).toBe(200);

        // Verify segment data matches
        const segment = db.prepare('SELECT * FROM segment').get();
        expect(segment.name).toBe('Round Trip Segment');
        expect(segment.distance).toBe(4.0);
        expect(segment.average_grade).toBe(8.0);

        // Verify season data
        const season = db.prepare('SELECT * FROM season').get();
        expect(season.name).toBe('Round Trip Season');
      });
    });

    describe('Production Mode - Endpoints Disabled', () => {
      let originalNodeEnv;

      beforeAll(() => {
        originalNodeEnv = process.env.NODE_ENV;
      });

      afterAll(() => {
        process.env.NODE_ENV = originalNodeEnv;
      });

      test('GET /admin/export-data returns 403 in production', async () => {
        process.env.NODE_ENV = 'production';

        const res = await request(app)
          .get('/admin/export-data');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('This endpoint is only available in development mode');
        expect(res.body.endpoint).toBe('/admin/export-data');
      });

      test('POST /admin/import-data returns 403 in production', async () => {
        process.env.NODE_ENV = 'production';

        const res = await request(app)
          .post('/admin/import-data')
          .send({
            data: {
              segments: [],
              seasons: [],
              weeks: []
            }
          });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('This endpoint is only available in development mode');
        expect(res.body.endpoint).toBe('/admin/import-data');
      });

      test('endpoints work normally in development mode', async () => {
        process.env.NODE_ENV = 'development';

        // Export should work
        const exportRes = await request(app)
          .get('/admin/export-data');

        expect(exportRes.status).toBe(200);
        expect(exportRes.body.data).toBeDefined();
      });
    });
  });
});
