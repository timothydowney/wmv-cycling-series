const request = require('supertest');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

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
  
  afterAll(() => {
    // Close database connection
    db.close();
    
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Health Check', () => {
    test('GET /health returns 200 OK', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('Participants', () => {
    test('GET /participants returns array', async () => {
      const response = await request(app).get('/participants');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('GET /participants includes seeded data', async () => {
      const response = await request(app).get('/participants');
      const names = response.body.map(p => p.name);
      expect(names).toContain('Jonny');
      expect(names).toContain('Chris');
      expect(names).toContain('Matt');
      expect(names).toContain('Tim');
    });
  });

  describe('Segments', () => {
    test('GET /segments returns array', async () => {
      const response = await request(app).get('/segments');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('GET /segments includes strava_segment_id', async () => {
      const response = await request(app).get('/segments');
      expect(response.body[0]).toHaveProperty('strava_segment_id');
    });
  });

  describe('Seasons', () => {
    test('GET /seasons returns array', async () => {
      const response = await request(app).get('/seasons');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('GET /seasons includes active season', async () => {
      const response = await request(app).get('/seasons');
      const activeSeason = response.body.find(s => s.is_active === 1);
      expect(activeSeason).toBeDefined();
      expect(activeSeason).toHaveProperty('name');
      expect(activeSeason).toHaveProperty('start_date');
      expect(activeSeason).toHaveProperty('end_date');
    });

    test('GET /seasons/:id returns season details', async () => {
      const response = await request(app).get('/seasons/1');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('name');
    });

    test('GET /seasons/:id returns 404 for invalid ID', async () => {
      const response = await request(app).get('/seasons/999');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    test('GET /seasons/:id/leaderboard returns season-specific leaderboard', async () => {
      const response = await request(app).get('/seasons/1/leaderboard');
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
      expect(response.body[0]).toHaveProperty('start_time');
      expect(response.body[0]).toHaveProperty('end_time');
      expect(response.body[0]).toHaveProperty('season_id');
    });

    test('GET /weeks/:id returns week details', async () => {
      const response = await request(app).get('/weeks/1');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 1);
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
      const response = await request(app).get('/weeks/1/leaderboard');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('week');
      expect(response.body).toHaveProperty('leaderboard');
      expect(Array.isArray(response.body.leaderboard)).toBe(true);
    });

    test('GET /weeks/:id/leaderboard has correct structure', async () => {
      const response = await request(app).get('/weeks/1/leaderboard');
      const entry = response.body.leaderboard[0];
      expect(entry).toHaveProperty('rank');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('total_time_seconds');
      expect(entry).toHaveProperty('points');
      expect(entry).toHaveProperty('activity_url');
    });

    test('GET /weeks/:id/leaderboard is sorted by rank', async () => {
      const response = await request(app).get('/weeks/1/leaderboard');
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
      const response = await request(app).get('/weeks/1/activities');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('activity_url');
      expect(response.body[0]).toHaveProperty('validation_status');
    });

    test('GET /activities/:id/efforts returns segment efforts', async () => {
      const response = await request(app).get('/activities/1/efforts');
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
        segment_id: 1,
        season_id: 1,
        required_laps: 2
      };

      const response = await request(app)
        .post('/admin/weeks')
        .send(newWeek)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.week_name).toBe('Test Week');
      expect(response.body.season_id).toBe(1);
      expect(response.body.start_time).toBe('2025-12-03T00:00:00Z');
      expect(response.body.end_time).toBe('2025-12-03T22:00:00Z');

      createdWeekId = response.body.id;
    });

    test('POST /admin/weeks creates week with custom time window', async () => {
      const newWeek = {
        week_name: 'Early Bird Week',
        date: '2025-12-10',
        segment_id: 2,
        season_id: 1,
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
        season_id: 1,
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
      // Restore season 1 as active after tests to not interfere with other tests
      if (newActiveSeasonId) {
        await request(app).delete(`/admin/seasons/${newActiveSeasonId}`).catch(() => {});
      }
      await request(app)
        .put('/admin/seasons/1')
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

  describe('Activity Submission - Time Window Validation', () => {
    let testWeekId;

    beforeAll(async () => {
      // Create a test week with specific time window
      const response = await request(app)
        .post('/admin/weeks')
        .send({
          week_name: 'Validation Test Week',
          date: '2025-12-15',
          segment_id: 1,
          season_id: 1,
          required_laps: 1,
          start_time: '2025-12-15T08:00:00Z',
          end_time: '2025-12-15T18:00:00Z'
        })
        .set('Content-Type', 'application/json');

      testWeekId = response.body.id;
    });

    afterAll(async () => {
      // Clean up test week
      await request(app).delete(`/admin/weeks/${testWeekId}`);
    });

    test('POST /weeks/:id/submit-activity validates required fields', async () => {
      const response = await request(app)
        .post(`/weeks/${testWeekId}/submit-activity`)
        .send({ participant_id: 1 })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('required');
    });

    test('POST /weeks/:id/submit-activity accepts activity within time window', async () => {
      const response = await request(app)
        .post(`/weeks/${testWeekId}/submit-activity`)
        .send({
          participant_id: 1,
          strava_activity_id: 12345,
          activity_url: 'https://www.strava.com/activities/12345',
          activity_date: '2025-12-15T12:00:00Z' // Noon - within 8am-6pm window
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(501); // Not fully implemented, but passed validation
      expect(response.body.validation.valid).toBe(true);
    });

    test('POST /weeks/:id/submit-activity rejects activity before start time', async () => {
      const response = await request(app)
        .post(`/weeks/${testWeekId}/submit-activity`)
        .send({
          participant_id: 1,
          strava_activity_id: 12345,
          activity_url: 'https://www.strava.com/activities/12345',
          activity_date: '2025-12-15T06:00:00Z' // 6am - before 8am start
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/time window/i);
      expect(response.body.details).toContain('2025-12-15T08:00:00');
    });

    test('POST /weeks/:id/submit-activity rejects activity after end time', async () => {
      const response = await request(app)
        .post(`/weeks/${testWeekId}/submit-activity`)
        .send({
          participant_id: 1,
          strava_activity_id: 12345,
          activity_url: 'https://www.strava.com/activities/12345',
          activity_date: '2025-12-15T20:00:00Z' // 8pm - after 6pm end
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/time window/i);
      expect(response.body.details).toContain('2025-12-15T18:00:00');
    });

    test('POST /weeks/:id/submit-activity returns 404 for invalid week', async () => {
      const response = await request(app)
        .post('/weeks/999/submit-activity')
        .send({
          participant_id: 1,
          strava_activity_id: 12345,
          activity_url: 'https://www.strava.com/activities/12345',
          activity_date: '2025-12-15T12:00:00Z'
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404);
    });
  });

  describe('Scoring Logic', () => {
    test('Week 1 scoring: 3 participants with PR bonus', async () => {
      const response = await request(app).get('/weeks/1/leaderboard');
      const leaderboard = response.body.leaderboard;

      expect(leaderboard.length).toBe(3);
      expect(leaderboard[0].points).toBe(4); // 1st place: 3 base + 1 PR bonus (Matt)
      expect(leaderboard[0].pr_bonus_points).toBe(1); // Matt got a PR
      expect(leaderboard[1].points).toBe(2); // 2nd place: 2 base + 0 PR bonus (Jonny)
      expect(leaderboard[1].pr_bonus_points).toBe(0);
      expect(leaderboard[2].points).toBe(1); // 3rd place: 1 base + 0 PR bonus (Chris)
      expect(leaderboard[2].pr_bonus_points).toBe(0);
    });

    test('Week 2 scoring: 4 participants with PR bonuses', async () => {
      const response = await request(app).get('/weeks/2/leaderboard');
      const leaderboard = response.body.leaderboard;

      expect(leaderboard.length).toBe(4);
      expect(leaderboard[0].points).toBe(5); // 1st place: 4 base + 1 PR bonus (Matt)
      expect(leaderboard[0].pr_bonus_points).toBe(1);
      expect(leaderboard[1].points).toBe(4); // 2nd place: 3 base + 1 PR bonus (Jonny)
      expect(leaderboard[1].pr_bonus_points).toBe(1);
      expect(leaderboard[2].points).toBe(2); // 3rd place: 2 base + 0 PR bonus (Tim)
      expect(leaderboard[2].pr_bonus_points).toBe(0);
      expect(leaderboard[3].points).toBe(1); // 4th place: 1 base + 0 PR bonus (Chris)
      expect(leaderboard[3].pr_bonus_points).toBe(0);
    });

    test('Matt leads season with 9 points (including PR bonuses)', async () => {
      const response = await request(app).get('/season/leaderboard');
      const matt = response.body.find(p => p.name === 'Matt');

      expect(matt).toBeDefined();
      expect(matt.total_points).toBe(9); // 4 points week 1 + 5 points week 2
      expect(matt.weeks_completed).toBe(2);
    });

    test('Jonny has 6 points with PR bonus in week 2', async () => {
      const response = await request(app).get('/season/leaderboard');
      const jonny = response.body.find(p => p.name === 'Jonny');

      expect(jonny).toBeDefined();
      expect(jonny.total_points).toBe(6); // 2 points week 1 + 4 points week 2
      expect(jonny.weeks_completed).toBe(2);
    });

    test('Chris has 2 points (finished last both weeks, no PRs, but competed)', async () => {
      const response = await request(app).get('/season/leaderboard');
      const chris = response.body.find(p => p.name === 'Chris');

      expect(chris).toBeDefined();
      expect(chris.total_points).toBe(2); // 1 point week 1 + 1 point week 2
      expect(chris.weeks_completed).toBe(2);
    });

    test('PR bonus is visible in leaderboard response', async () => {
      const response = await request(app).get('/weeks/1/leaderboard');
      const entry = response.body.leaderboard[0];
      expect(entry).toHaveProperty('pr_bonus_points');
    });
  });

  describe('PR Tracking in Efforts', () => {
    test('GET /activities/:id/efforts includes pr_achieved flag', async () => {
      const response = await request(app).get('/activities/6/efforts'); // Matt's Week 2 activity
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('pr_achieved');
    });

    test('Activity with PR shows pr_achieved = 1', async () => {
      const response = await request(app).get('/activities/3/efforts'); // Matt's Week 1 activity with PR
      const efforts = response.body;
      expect(efforts.some(e => e.pr_achieved === 1)).toBe(true);
    });

    test('Activity without PR shows pr_achieved = 0', async () => {
      const response = await request(app).get('/activities/1/efforts'); // Jonny's Week 1 activity, no PR
      const efforts = response.body;
      expect(efforts.every(e => e.pr_achieved === 0)).toBe(true);
    });
  });
});
