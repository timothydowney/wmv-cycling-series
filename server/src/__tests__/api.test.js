const request = require('supertest');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

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
const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'test.db');
process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

// Remove test database if it exists
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

const { app, db } = require('../index');

describe('WMV Backend API', () => {
  // Test data IDs
  const TEST_SEASON_ID = 1;
  const TEST_SEGMENT_1 = 12345678; // Lookout Mountain
  const TEST_SEGMENT_2 = 23456789; // Champs-Élysées
  const TEST_ATHLETE_1 = 1001001; // Test Athlete 1
  const TEST_ATHLETE_2 = 1001002; // Test Athlete 2
  const TEST_ATHLETE_3 = 1001003; // Test Athlete 3
  
  let testWeekId1, testWeekId2, testActivityId1, testActivityId2;

  beforeAll(() => {
    // Clear all data - ensure clean slate for tests
    db.prepare('DELETE FROM results').run();
    db.prepare('DELETE FROM segment_efforts').run();
    db.prepare('DELETE FROM activities').run();
    db.prepare('DELETE FROM weeks').run();
    db.prepare('DELETE FROM participant_tokens').run();
    db.prepare('DELETE FROM participants').run();
    db.prepare('DELETE FROM segments').run();
    db.prepare('DELETE FROM seasons').run();

    // Create test season
    db.prepare(`
      INSERT INTO seasons (id, name, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(TEST_SEASON_ID, 'Test Season 2025', '2025-11-01', '2025-12-31', 1);

    // Create test segments
    db.prepare(`
      INSERT INTO segments (strava_segment_id, name)
      VALUES (?, ?), (?, ?)
    `).run(
      TEST_SEGMENT_1, 'Test Segment 1',
      TEST_SEGMENT_2, 'Test Segment 2'
    );

    // Create test participants
    db.prepare(`
      INSERT INTO participants (strava_athlete_id, name)
      VALUES (?, ?), (?, ?), (?, ?)
    `).run(
      TEST_ATHLETE_1, 'Test Athlete 1',
      TEST_ATHLETE_2, 'Test Athlete 2',
      TEST_ATHLETE_3, 'Test Athlete 3'
    );

    // Create test weeks
    const week1Result = db.prepare(`
      INSERT INTO weeks (season_id, week_name, date, segment_id, required_laps, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      TEST_SEASON_ID, 'Test Week 1', '2025-11-05',
      TEST_SEGMENT_1, 1,
      '2025-11-05T00:00:00Z', '2025-11-05T22:00:00Z'
    );
    testWeekId1 = week1Result.lastInsertRowid;

    const week2Result = db.prepare(`
      INSERT INTO weeks (season_id, week_name, date, segment_id, required_laps, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      TEST_SEASON_ID, 'Test Week 2', '2025-11-12',
      TEST_SEGMENT_2, 2,
      '2025-11-12T00:00:00Z', '2025-11-12T22:00:00Z'
    );
    testWeekId2 = week2Result.lastInsertRowid;

    // Create test activities and results for Week 1
    const activity1 = db.prepare(`
      INSERT INTO activities (week_id, strava_athlete_id, strava_activity_id, activity_url, activity_date, validation_status)
      VALUES (?, ?, ?, ?, ?, 'valid')
    `).run(testWeekId1, TEST_ATHLETE_1, 9001, 'https://www.strava.com/activities/9001', '2025-11-05');
    testActivityId1 = activity1.lastInsertRowid;
    
    db.prepare(`
      INSERT INTO segment_efforts (activity_id, segment_id, effort_index, elapsed_seconds, pr_achieved)
      VALUES (?, ?, ?, ?, ?)
    `).run(testActivityId1, TEST_SEGMENT_1, 1, 1500, 0);

    const activity2 = db.prepare(`
      INSERT INTO activities (week_id, strava_athlete_id, strava_activity_id, activity_url, activity_date, validation_status)
      VALUES (?, ?, ?, ?, ?, 'valid')
    `).run(testWeekId1, TEST_ATHLETE_2, 9002, 'https://www.strava.com/activities/9002', '2025-11-05');
    testActivityId2 = activity2.lastInsertRowid;
    
    db.prepare(`
      INSERT INTO segment_efforts (activity_id, segment_id, effort_index, elapsed_seconds, pr_achieved)
      VALUES (?, ?, ?, ?, ?)
    `).run(testActivityId2, TEST_SEGMENT_1, 1, 1600, 1);

    // Calculate results for test week
    db.prepare(`
      INSERT INTO results (week_id, strava_athlete_id, activity_id, total_time_seconds, rank, points, pr_bonus_points)
      VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)
    `).run(
      testWeekId1, TEST_ATHLETE_1, testActivityId1, 1500, 1, 2, 0,
      testWeekId1, TEST_ATHLETE_2, testActivityId2, 1600, 2, 2, 1
    );
  });
  
  afterAll(async () => {
    // Close database connection
    if (db && db.open) {
      db.close();
    }
    
    // Clean up test database file
    await new Promise(resolve => setTimeout(resolve, 100));
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (err) {
        // File may be locked by other processes
      }
    }
  });

  describe('Health Check', () => {
    test('GET /health returns 200 OK', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('Segments', () => {
    test('GET /segments returns array', async () => {
      const response = await request(app).get('/segments');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2); // Our 2 test segments
    });

    test('GET /segments includes strava_segment_id', async () => {
      const response = await request(app).get('/segments');
      expect(response.body[0]).toHaveProperty('strava_segment_id');
      expect(response.body[0].strava_segment_id).toBe(TEST_SEGMENT_1);
    });
  });

  describe('Seasons', () => {
    test('GET /seasons returns array', async () => {
      const response = await request(app).get('/seasons');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1); // Our test season
    });

    test('GET /seasons includes active season', async () => {
      const response = await request(app).get('/seasons');
      const activeSeason = response.body.find(s => s.is_active === 1);
      expect(activeSeason).toBeDefined();
      expect(activeSeason.id).toBe(TEST_SEASON_ID);
      expect(activeSeason).toHaveProperty('name');
      expect(activeSeason).toHaveProperty('start_date');
      expect(activeSeason).toHaveProperty('end_date');
    });

    test('GET /seasons/:id returns season details', async () => {
      const response = await request(app).get(`/seasons/${TEST_SEASON_ID}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', TEST_SEASON_ID);
      expect(response.body).toHaveProperty('name');
    });

    test('GET /seasons/:id returns 404 for invalid ID', async () => {
      const response = await request(app).get('/seasons/999');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('GET /seasons/:id/leaderboard returns season-specific leaderboard', async () => {
      const response = await request(app).get(`/seasons/${TEST_SEASON_ID}/leaderboard`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('season');
      expect(response.body).toHaveProperty('leaderboard');
      expect(Array.isArray(response.body.leaderboard)).toBe(true);
      if (response.body.leaderboard.length > 0) {
        expect(response.body.leaderboard[0]).toHaveProperty('total_points');
        expect(response.body.leaderboard[0]).toHaveProperty('weeks_completed');
      }
    });
  });

  describe('Weeks', () => {
    test('GET /weeks returns array with time windows', async () => {
      const response = await request(app).get('/weeks');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2); // Our 2 test weeks
      expect(response.body[0]).toHaveProperty('start_time');
      expect(response.body[0]).toHaveProperty('end_time');
      expect(response.body[0]).toHaveProperty('season_id', TEST_SEASON_ID);
    });

    test('GET /weeks/:id returns week details', async () => {
      const response = await request(app).get(`/weeks/${testWeekId1}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testWeekId1);
      expect(response.body).toHaveProperty('week_name');
      expect(response.body).toHaveProperty('required_laps');
    });

    test('GET /weeks/:id returns 404 for invalid ID', async () => {
      const response = await request(app).get('/weeks/999');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Leaderboards', () => {
    test('GET /weeks/:id/leaderboard returns week and leaderboard', async () => {
      const response = await request(app).get(`/weeks/${testWeekId1}/leaderboard`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('week');
      expect(response.body).toHaveProperty('leaderboard');
      expect(Array.isArray(response.body.leaderboard)).toBe(true);
    });

    test('GET /weeks/:id/leaderboard has correct structure', async () => {
      const response = await request(app).get(`/weeks/${testWeekId1}/leaderboard`);
      const entry = response.body.leaderboard[0];
      expect(entry).toHaveProperty('rank');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('total_time_seconds');
      expect(entry).toHaveProperty('points');
      expect(entry).toHaveProperty('activity_url');
    });

    test('GET /weeks/:id/leaderboard is sorted by rank', async () => {
      const response = await request(app).get(`/weeks/${testWeekId1}/leaderboard`);
      const ranks = response.body.leaderboard.map(e => e.rank);
      const sortedRanks = [...ranks].sort((a, b) => a - b);
      expect(ranks).toEqual(sortedRanks);
    });

    test('GET /season/leaderboard returns season standings', async () => {
      const response = await request(app).get('/season/leaderboard');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('total_points');
      expect(response.body[0]).toHaveProperty('weeks_completed');
    });

    test('GET /season/leaderboard is sorted by total_points desc', async () => {
      const response = await request(app).get('/season/leaderboard');
      const points = response.body.map(e => e.total_points);
      const sortedPoints = [...points].sort((a, b) => b - a);
      expect(points).toEqual(sortedPoints);
    });
  });

  describe('Activities', () => {
    test('GET /weeks/:id/activities returns activities list', async () => {
      const response = await request(app).get(`/weeks/${testWeekId1}/activities`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('activity_url');
      expect(response.body[0]).toHaveProperty('validation_status');
    });

    test('GET /activities/:id/efforts returns segment efforts', async () => {
      const response = await request(app).get(`/activities/${testActivityId1}/efforts`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('effort_index');
      expect(response.body[0]).toHaveProperty('elapsed_seconds');
    });
  });

  describe('Admin - Week Management', () => {
    let createdWeekId;

    test('POST /admin/weeks creates new week with defaults', async () => {
      const newWeek = {
        week_name: 'Test Week',
        date: '2025-12-03',
        segment_id: TEST_SEGMENT_1, // Lookout Mountain Climb Strava segment ID
        season_id: TEST_SEASON_ID,
        required_laps: 2
      };

      const response = await request(app)
        .post('/admin/weeks')
        .send(newWeek)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.week_name).toBe('Test Week');
      expect(response.body.season_id).toBe(TEST_SEASON_ID);
      expect(response.body.start_time).toBe('2025-12-03T00:00:00Z');
      expect(response.body.end_time).toBe('2025-12-03T22:00:00Z');

      createdWeekId = response.body.id;
    });

    test('POST /admin/weeks creates week with custom time window', async () => {
      const newWeek = {
        week_name: 'Early Bird Week',
        date: '2025-12-10',
        segment_id: TEST_SEGMENT_2, // Champs-Élysées Strava segment ID
        season_id: TEST_SEASON_ID,
        required_laps: 1,
        start_time: '2025-12-10T06:00:00Z',
        end_time: '2025-12-10T12:00:00Z'
      };

      const response = await request(app)
        .post('/admin/weeks')
        .send(newWeek)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body.start_time).toBe('2025-12-10T06:00:00Z');
      expect(response.body.end_time).toBe('2025-12-10T12:00:00Z');
    });

    test('POST /admin/weeks validates required fields', async () => {
      const response = await request(app)
        .post('/admin/weeks')
        .send({ week_name: 'Incomplete Week' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('POST /admin/weeks validates segment exists', async () => {
      const newWeek = {
        week_name: 'Invalid Segment Week',
        date: '2025-12-17',
        segment_id: 999,
        season_id: TEST_SEASON_ID,
        required_laps: 1
      };

      const response = await request(app)
        .post('/admin/weeks')
        .send(newWeek)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/segment/i);
    });

    test('PUT /admin/weeks/:id updates week fields', async () => {
      const response = await request(app)
        .put(`/admin/weeks/${createdWeekId}`)
        .send({
          required_laps: 5,
          start_time: '2025-12-03T08:00:00Z'
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.required_laps).toBe(5);
      expect(response.body.start_time).toBe('2025-12-03T08:00:00Z');
    });

    test('PUT /admin/weeks/:id returns 404 for invalid ID', async () => {
      const response = await request(app)
        .put('/admin/weeks/999')
        .send({ required_laps: 3 })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
    });

    test('DELETE /admin/weeks/:id deletes week', async () => {
      const response = await request(app)
        .delete(`/admin/weeks/${createdWeekId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.weekId).toBe(createdWeekId);

      // Verify it's actually deleted
      const getResponse = await request(app).get(`/weeks/${createdWeekId}`);
      expect(getResponse.status).toBe(404);
    });

    test('DELETE /admin/weeks/:id returns 404 for invalid ID', async () => {
      const response = await request(app).delete('/admin/weeks/999');
      expect(response.status).toBe(404);
    });
  });

  describe('Admin - Season Management', () => {
    let createdSeasonId;
    let newActiveSeasonId;

    afterAll(async () => {
      // Restore test season as active after tests to not interfere with other tests
      if (newActiveSeasonId) {
        await request(app).delete(`/admin/seasons/${newActiveSeasonId}`).catch(() => {});
      }
      await request(app)
        .put(`/admin/seasons/${TEST_SEASON_ID}`)
        .send({ is_active: 1 })
        .set('Content-Type', 'application/json');
    });

    test('POST /admin/seasons creates new season', async () => {
      const newSeason = {
        name: 'Test Season 2026',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        is_active: 0
      };

      const response = await request(app)
        .post('/admin/seasons')
        .send(newSeason)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Season 2026');
      expect(response.body.is_active).toBe(0);

      createdSeasonId = response.body.id;
    });

    test('POST /admin/seasons deactivates other seasons when creating active season', async () => {
      const newSeason = {
        name: 'New Active Season',
        start_date: '2027-01-01',
        end_date: '2027-12-31',
        is_active: 1
      };

      const response = await request(app)
        .post('/admin/seasons')
        .send(newSeason)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body.is_active).toBe(1);
      
      // Store ID for cleanup
      newActiveSeasonId = response.body.id;

      // Check that all other seasons are now inactive
      const allSeasons = await request(app).get('/seasons');
      const activeSeasons = allSeasons.body.filter(s => s.is_active === 1);
      expect(activeSeasons.length).toBe(1);
      expect(activeSeasons[0].id).toBe(response.body.id);
    });

    test('POST /admin/seasons validates required fields', async () => {
      const response = await request(app)
        .post('/admin/seasons')
        .send({ name: 'Incomplete Season' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('PUT /admin/seasons/:id updates season', async () => {
      const response = await request(app)
        .put(`/admin/seasons/${createdSeasonId}`)
        .send({
          name: 'Updated Test Season',
          end_date: '2026-11-30'
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Test Season');
      expect(response.body.end_date).toBe('2026-11-30');
    });

    test('PUT /admin/seasons/:id returns 404 for invalid ID', async () => {
      const response = await request(app)
        .put('/admin/seasons/999')
        .send({ name: 'Nonexistent' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
    });

    test('DELETE /admin/seasons/:id prevents deletion if season has weeks', async () => {
      // Season 1 has weeks from seed data
      const response = await request(app).delete('/admin/seasons/1');
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/cannot delete season with existing weeks/i);
    });

    test('DELETE /admin/seasons/:id deletes season without weeks', async () => {
      const response = await request(app).delete(`/admin/seasons/${createdSeasonId}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Verify it's actually deleted
      const getResponse = await request(app).get(`/admin/seasons/${createdSeasonId}`);
      expect(getResponse.status).toBe(404);
    });

    test('DELETE /admin/seasons/:id returns 404 for invalid ID', async () => {
      const response = await request(app).delete('/admin/seasons/999');
      expect(response.status).toBe(404);
    });
  });

  // NOTE: Activity submission tests removed - they require authentication and Strava API mocking
  // See activity-submission.test.js for comprehensive activity submission tests with proper mocking

  describe('PR Tracking in Efforts', () => {
    test('GET /activities/:id/efforts includes pr_achieved flag', async () => {
      const response = await request(app).get(`/activities/${testActivityId2}/efforts`); // Activity with PR
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('pr_achieved');
    });

    test('Activity with PR shows pr_achieved = 1', async () => {
      const response = await request(app).get(`/activities/${testActivityId2}/efforts`); // TEST_ATHLETE_2 activity with PR
      const efforts = response.body;
      expect(efforts.some(e => e.pr_achieved === 1)).toBe(true);
    });

    test('Activity without PR shows pr_achieved = 0', async () => {
      const response = await request(app).get(`/activities/${testActivityId1}/efforts`); // TEST_ATHLETE_1 activity without PR
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('pr_achieved');
    });

    test('Activity with PR shows pr_achieved = 1', async () => {
      const response = await request(app).get(`/activities/${testActivityId2}/efforts`); // TEST_ATHLETE_2 activity with PR
      const efforts = response.body;
      expect(efforts.some(e => e.pr_achieved === 1)).toBe(true);
    });

    test('Activity without PR shows pr_achieved = 0', async () => {
      const response = await request(app).get(`/activities/${testActivityId1}/efforts`); // TEST_ATHLETE_1 activity without PR
      const efforts = response.body;
      expect(efforts.every(e => e.pr_achieved === 0)).toBe(true);
    });
  });
});
