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

  afterAll(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Admin Week Creation Edge Cases', () => {
    test('Cannot create week with non-existent segment', async () => {
      const response = await request(app)
        .post('/admin/weeks')
        .send({
          week_name: 'Bad Segment Week',
          date: '2025-12-20',
          segment_id: 99999,
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
          segment_id: 1,
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
          segment_id: 1,
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
          segment_id: 1,
          season_id: 1,
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
      // Week 1 should have activities
      const activitiesBefore = await request(app).get('/weeks/1/activities');
      expect(activitiesBefore.body.length).toBeGreaterThan(0);

      const leaderboardBefore = await request(app).get('/weeks/1/leaderboard');
      expect(leaderboardBefore.body.leaderboard.length).toBeGreaterThan(0);

      // Delete week 1
      await request(app).delete('/admin/weeks/1');

      // Verify week is gone
      const weekCheck = await request(app).get('/weeks/1');
      expect(weekCheck.status).toBe(404);

      // Activities endpoint should still work but return empty
      const activitiesAfter = await request(app).get('/weeks/1/activities');
      expect(activitiesAfter.body.length).toBe(0);
    });

    test('Season leaderboard updates after week deletion', async () => {
      const seasonBefore = await request(app).get('/season/leaderboard');
      const mattBefore = seasonBefore.body.find(p => p.name === 'Matt');
      
      // Matt should have fewer points now (only from week 2)
      expect(mattBefore.total_points).toBe(5); // Only week 2 points remain (4 base + 1 PR bonus)
      expect(mattBefore.weeks_completed).toBe(1);
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

  describe('Boundary Value Testing', () => {
    test('Activity exactly at midnight passes validation', async () => {
      let weekId;
      try {
        const createResp = await request(app)
          .post('/admin/weeks')
          .send({
            week_name: 'Midnight Test',
            date: '2026-01-15',
            segment_id: 1,
            season_id: 1,
            required_laps: 1
          })
          .set('Content-Type', 'application/json');
        weekId = createResp.body.id;

        const response = await request(app)
          .post(`/weeks/${weekId}/submit-activity`)
          .send({
            participant_id: 1,
            strava_activity_id: 99998,
            activity_url: 'https://www.strava.com/activities/99998',
            activity_date: '2026-01-15T00:00:00.000Z'
          })
          .set('Content-Type', 'application/json');

        // Should pass validation (501 = passed validation but not implemented)
        expect(response.status).toBe(501);
        expect(response.body.validation.valid).toBe(true);
      } finally {
        if (weekId) await request(app).delete(`/admin/weeks/${weekId}`);
      }
    });

    test('Activity one millisecond before midnight fails', async () => {
      let weekId;
      try {
        const createResp = await request(app)
          .post('/admin/weeks')
          .send({
            week_name: 'Before Midnight Test',
            date: '2026-01-15',
            segment_id: 1,
            season_id: 1,
            required_laps: 1
          })
          .set('Content-Type', 'application/json');
        weekId = createResp.body.id;

        const response = await request(app)
          .post(`/weeks/${weekId}/submit-activity`)
          .send({
            participant_id: 1,
            strava_activity_id: 99997,
            activity_url: 'https://www.strava.com/activities/99997',
            activity_date: '2026-01-14T23:59:59.999Z'
          })
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/time window/i);
      } finally {
        if (weekId) await request(app).delete(`/admin/weeks/${weekId}`);
      }
    });
  });
});
