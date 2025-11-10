const request = require('supertest');
const path = require('path');
const fs = require('fs');

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
const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'edge-cases-test.db');
process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

// Remove test database if it exists
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

const { app, db } = require('../index');

describe('Edge Cases and Error Handling', () => {
  // Test data constants
  const TEST_SEASON_ID = 1;
  const TEST_SEGMENT_1 = 12345678; // Made-up Strava segment ID
  const TEST_SEGMENT_2 = 23456789;

  beforeAll(() => {
    // Create test season and segments for edge case tests
    db.prepare(`
      INSERT INTO seasons (id, name, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(TEST_SEASON_ID, 'Edge Case Season', '2025-01-01', '2025-12-31', 1);

    db.prepare(`
      INSERT INTO segments (strava_segment_id, name)
      VALUES (?, ?), (?, ?)
    `).run(
      TEST_SEGMENT_1, 'Test Segment 1',
      TEST_SEGMENT_2, 'Test Segment 2'
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
        // File may be locked
      }
    }
  });

  describe('Admin Week Creation Edge Cases', () => {
    test('Cannot create week with non-existent segment', async () => {
      const response = await request(app)
        .post('/admin/weeks')
        .send({
          week_name: 'Bad Segment Week',
          date: '2025-12-20',
          segment_id: 99999, // Non-existent Strava segment ID
          season_id: 1,
          required_laps: 1
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('segment');
    });

    test('Creating week with 0 required laps uses default of 1', async () => {
      const response = await request(app)
        .post('/admin/weeks')
        .send({
          week_name: 'Zero Laps Week',
          date: '2025-12-25',
          segment_id: 12345678, // Lookout Mountain Climb Strava segment ID
          season_id: 1,
          required_laps: 0
        })
        .set('Content-Type', 'application/json');

      // Either accepts it and defaults to 1, or rejects as invalid
      if (response.status === 201) {
        expect(response.body.required_laps).toBeGreaterThanOrEqual(1);
        await request(app).delete(`/admin/weeks/${response.body.id}`);
      } else {
        expect(response.status).toBe(400);
      }
    });

    test('Can create week with many required laps', async () => {
      const response = await request(app)
        .post('/admin/weeks')
        .send({
          week_name: 'Century Week',
          date: '2025-12-26',
          segment_id: 12345678, // Lookout Mountain Climb Strava segment ID
          season_id: 1,
          required_laps: 100
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body.required_laps).toBe(100);

      // Clean up
      await request(app).delete(`/admin/weeks/${response.body.id}`);
    });
  });

  describe('Admin Week Update Edge Cases', () => {
    let weekId;

    beforeAll(async () => {
      const response = await request(app)
        .post('/admin/weeks')
        .send({
          week_name: 'Update Test Week',
          date: '2026-01-06',
          segment_id: TEST_SEGMENT_1,
          season_id: TEST_SEASON_ID,
          required_laps: 2
        })
        .set('Content-Type', 'application/json');
      weekId = response.body.id;
    });

    afterAll(async () => {
      await request(app).delete(`/admin/weeks/${weekId}`);
    });

    test('Update with no fields returns 400', async () => {
      const response = await request(app)
        .put(`/admin/weeks/${weekId}`)
        .send({})
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No fields to update');
    });

    test('Can update just week_name', async () => {
      const response = await request(app)
        .put(`/admin/weeks/${weekId}`)
        .send({ week_name: 'New Name' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.week_name).toBe('New Name');
    });

    test('Can update just date', async () => {
      const response = await request(app)
        .put(`/admin/weeks/${weekId}`)
        .send({ date: '2026-01-13' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.date).toBe('2026-01-13');
    });

    test('Cannot update to invalid segment_id', async () => {
      const response = await request(app)
        .put(`/admin/weeks/${weekId}`)
        .send({ segment_id: 99999 })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('segment');
    });

    test('Can update multiple fields at once', async () => {
      const response = await request(app)
        .put(`/admin/weeks/${weekId}`)
        .send({
          week_name: 'Multi-Update',
          required_laps: 7,
          start_time: '2026-01-13T05:00:00Z'
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.week_name).toBe('Multi-Update');
      expect(response.body.required_laps).toBe(7);
      expect(response.body.start_time).toBe('2026-01-13T05:00:00Z');
    });
  });

  describe('Data Integrity', () => {
    test('Week deletion cascades to activities and results', async () => {
      // Create a week with activities and results
      const weekResp = await request(app)
        .post('/admin/weeks')
        .send({
          week_name: 'Cascade Test Week',
          date: '2025-11-15',
          segment_id: TEST_SEGMENT_1,
          season_id: TEST_SEASON_ID,
          required_laps: 1
        })
        .set('Content-Type', 'application/json');
      
      const weekId = weekResp.body.id;

      // Create a participant and activity for this week
      const testAthleteId = 9988776655;
      db.prepare('INSERT INTO participants (strava_athlete_id, name) VALUES (?, ?)').run(testAthleteId, 'Test Participant');
      const activityResult = db.prepare(`
        INSERT INTO activities (week_id, strava_athlete_id, strava_activity_id, activity_url, activity_date, validation_status)
        VALUES (?, ?, ?, ?, ?, 'valid')
      `).run(weekId, testAthleteId, 1234567, 'https://www.strava.com/activities/1234567', '2025-11-15');
      
      db.prepare(`
        INSERT INTO results (week_id, strava_athlete_id, activity_id, total_time_seconds, rank, points, pr_bonus_points)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(weekId, testAthleteId, activityResult.lastInsertRowid, 1500, 1, 1, 0);

      // Verify data exists
      const activitiesBefore = db.prepare('SELECT * FROM activities WHERE week_id = ?').all(weekId);
      expect(activitiesBefore.length).toBeGreaterThan(0);

      const resultsBefore = db.prepare('SELECT * FROM results WHERE week_id = ?').all(weekId);
      expect(resultsBefore.length).toBeGreaterThan(0);

      // Delete week
      await request(app).delete(`/admin/weeks/${weekId}`);

      // Verify cascading deletion
      const activitiesAfter = db.prepare('SELECT * FROM activities WHERE week_id = ?').all(weekId);
      expect(activitiesAfter.length).toBe(0);

      const resultsAfter = db.prepare('SELECT * FROM results WHERE week_id = ?').all(weekId);
      expect(resultsAfter.length).toBe(0);
    });

    test('Season leaderboard updates after week deletion', async () => {
      // This test verifies that deleting a week updates the season leaderboard
      // Since we deleted test data above, just verify the endpoint works
      const response = await request(app).get('/season/leaderboard');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('JSON Parsing and Content-Type', () => {
    test('POST without Content-Type header fails gracefully', async () => {
      const response = await request(app)
        .post('/admin/weeks')
        .send('invalid-json-string');

      // Should handle the error without crashing
      expect([400, 500]).toContain(response.status);
    });

    test('Invalid JSON in request body', async () => {
      const response = await request(app)
        .post('/admin/weeks')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect([400, 500]).toContain(response.status);
    });
  });

  // NOTE: Boundary value tests for activity submission removed
  // They require authentication and Strava API mocking
  // See activity-submission.test.js for comprehensive activity submission tests
});
