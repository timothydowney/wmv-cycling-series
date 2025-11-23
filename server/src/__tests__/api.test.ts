// @ts-nocheck
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { isoToUnix } from '../dateUtils';
import {
  createSeason,
  createSegment,
  createParticipant,
  createWeek,
  createActivity,
  createResult,
  clearAllData,
  makeRequestAsUser
} from './testDataHelpers';

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
process.env.ADMIN_ATHLETE_IDS = '999001'; // Allow test admin access to /admin endpoints

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
  
  let testSeasonId1, testWeekId1, testActivityId1, testActivityId2;

  beforeAll(() => {
    clearAllData(db);

    // Create test season
    const season = createSeason(db, 'Test Season 2025', true);
    testSeasonId1 = season.seasonId;

    // Create test segments
    createSegment(db, TEST_SEGMENT_1, 'Test Segment 1');
    createSegment(db, TEST_SEGMENT_2, 'Test Segment 2');

    // Create test participants
    createParticipant(db, TEST_ATHLETE_1, 'Test Athlete 1');
    createParticipant(db, TEST_ATHLETE_2, 'Test Athlete 2');
    createParticipant(db, TEST_ATHLETE_3, 'Test Athlete 3');

    // Create test weeks
    const week1 = createWeek(db, {
      seasonId: season.seasonId,
      stravaSegmentId: TEST_SEGMENT_1,
      weekName: 'Test Week 1',
      date: '2025-11-05'
    });
    testWeekId1 = week1.weekId;

    createWeek(db, {
      seasonId: season.seasonId,
      stravaSegmentId: TEST_SEGMENT_2,
      weekName: 'Test Week 2',
      date: '2025-11-12',
      requiredLaps: 2
    });

    // Create test activities and results for Week 1
    const activity1 = createActivity(db, {
      weekId: testWeekId1,
      stravaAthleteId: TEST_ATHLETE_1,
      stravaActivityId: 9001,
      stravaSegmentId: TEST_SEGMENT_1,
      elapsedSeconds: 1500,
      prAchieved: false
    });
    testActivityId1 = activity1.activityId;

    const activity2 = createActivity(db, {
      weekId: testWeekId1,
      stravaAthleteId: TEST_ATHLETE_2,
      stravaActivityId: 9002,
      stravaSegmentId: TEST_SEGMENT_1,
      elapsedSeconds: 1600,
      prAchieved: true
    });
    testActivityId2 = activity2.activityId;

    // Calculate results for test week
    createResult(db, {
      weekId: testWeekId1,
      stravaAthleteId: TEST_ATHLETE_1,
      activityId: testActivityId1,
      totalTimeSeconds: 1500,
      rank: 1,
      points: 2
    });
    createResult(db, {
      weekId: testWeekId1,
      stravaAthleteId: TEST_ATHLETE_2,
      activityId: testActivityId2,
      totalTimeSeconds: 1600,
      rank: 2,
      points: 2
    });
  });
  
  afterAll(() => {
    // Close database connection
    if (db && db.open) {
      db.close();
    }
    
    // Clean up test database file
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
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
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
      expect(activeSeason).toHaveProperty('start_at');
      expect(activeSeason).toHaveProperty('end_at');
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
      const response = await request(app).get(`/weeks?season_id=${testSeasonId1}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2); // Our 2 test weeks
      expect(response.body[0]).toHaveProperty('start_at');
      expect(response.body[0]).toHaveProperty('end_at');
      expect(response.body[0]).toHaveProperty('season_id', testSeasonId1);
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

    test('GET /weeks includes participants_count for weeks with results', async () => {
      const response = await request(app).get(`/weeks?season_id=${testSeasonId1}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Week 1 should have 2 participants with valid results
      const week1 = response.body.find(w => w.id === testWeekId1);
      expect(week1).toBeDefined();
      expect(week1).toHaveProperty('participants_count');
      expect(week1.participants_count).toBe(2);
    });

    test('GET /weeks/:id includes participants_count', async () => {
      const response = await request(app).get(`/weeks/${testWeekId1}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('participants_count');
      expect(response.body.participants_count).toBe(2);
    });

    test('GET /weeks counts only participants with valid results', async () => {
      // Create a new week with no results
      const newWeek = createWeek(db, {
        seasonId: testSeasonId1,
        stravaSegmentId: TEST_SEGMENT_1,
        weekName: 'Empty Week',
        date: '2025-11-19'
      });

      const response = await request(app).get(`/weeks/${newWeek.weekId}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('participants_count');
      // Should be 0 or not counted, depending on implementation
      expect(response.body.participants_count).toBe(0);
    });

    test('GET /weeks shows participants_count as 0 for future weeks with no results', async () => {
      const response = await request(app).get(`/weeks?season_id=${testSeasonId1}`);
      expect(response.status).toBe(200);
      
      // Week 2 was created but has no results
      const week2 = response.body.find(w => w.week_name === 'Test Week 2');
      expect(week2).toBeDefined();
      expect(week2.participants_count).toBe(0);
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
      expect(entry).toHaveProperty('points');    });

    test('GET /weeks/:id/leaderboard is sorted by rank', async () => {
      const response = await request(app).get(`/weeks/${testWeekId1}/leaderboard`);
      const ranks = response.body.leaderboard.map(e => e.rank);
      const sortedRanks = [...ranks].sort((a, b) => a - b);
      expect(ranks).toEqual(sortedRanks);
    });

    test('GET /seasons/:id/leaderboard returns season standings for specific season', async () => {
      const response = await request(app).get(`/seasons/${testSeasonId1}/leaderboard`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('season');
      expect(response.body).toHaveProperty('leaderboard');
      expect(Array.isArray(response.body.leaderboard)).toBe(true);
      if (response.body.leaderboard.length > 0) {
        expect(response.body.leaderboard[0]).toHaveProperty('total_points');
        expect(response.body.leaderboard[0]).toHaveProperty('weeks_completed');
      }
    });

    test('GET /seasons/:id/leaderboard is sorted by total_points desc', async () => {
      const response = await request(app).get(`/seasons/${testSeasonId1}/leaderboard`);
      expect(response.status).toBe(200);
      const points = response.body.leaderboard.map(e => e.total_points);
      const sortedPoints = [...points].sort((a, b) => b - a);
      expect(points).toEqual(sortedPoints);
    });
  });

  describe('Admin - Week Management', () => {
    let createdWeekId;

    test('POST /admin/weeks creates new week with defaults', async () => {
      const newWeek = {
        week_name: 'Test Week',
        segment_id: TEST_SEGMENT_1, // Lookout Mountain Climb Strava segment ID
        season_id: testSeasonId1,
        required_laps: 2,
        start_at: isoToUnix('2025-12-03T00:00:00Z'),
        end_at: isoToUnix('2025-12-03T22:00:00Z')
      };
      const response = await request(app)
        .post('/admin/weeks')
        .send(newWeek)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.week_name).toBe('Test Week');
      expect(response.body.season_id).toBe(testSeasonId1);
      expect(response.body.start_at).toBe(isoToUnix('2025-12-03T00:00:00Z'));
      expect(response.body.end_at).toBe(isoToUnix('2025-12-03T22:00:00Z'));

      createdWeekId = response.body.id;
    });

    test('POST /admin/weeks creates week with custom time window', async () => {
      const newWeek = {
        week_name: 'Early Bird Week',
        segment_id: TEST_SEGMENT_2, // Champs-Élysées Strava segment ID
        season_id: testSeasonId1,
        required_laps: 1,
        start_at: isoToUnix('2025-12-10T06:00:00Z'),
        end_at: isoToUnix('2025-12-10T12:00:00Z')
      };

      const response = await request(app)
        .post('/admin/weeks')
        .send(newWeek)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body.start_at).toBe(isoToUnix('2025-12-10T06:00:00Z'));
      expect(response.body.end_at).toBe(isoToUnix('2025-12-10T12:00:00Z'));
    });

    test('POST /admin/weeks validates required fields', async () => {
      const response = await request(app)
        .post('/admin/weeks')
        .send({ week_name: 'Incomplete Week' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('POST /admin/weeks auto-creates non-existent segment', async () => {
      const testWeekData = {
        week_name: 'Auto-Create Segment Week',
        segment_id: 999,
        season_id: testSeasonId1,
        required_laps: 1,
        start_at: isoToUnix('2025-12-17T00:00:00Z'),
        end_at: isoToUnix('2025-12-17T22:00:00Z')
      };

      const response = await request(app)
        .post('/admin/weeks')
        .send(testWeekData)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body.segment_id).toBe(999);
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
      expect(response.body.start_at).toBe(isoToUnix('2025-12-03T08:00:00Z'));
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

  // Non-admin rejection tests for week management
  describe('Admin - Week Management - Non-Admin Rejection', () => {
    const testWeekData = {
      week_name: 'Test Week',
      date: '2025-12-25',
      segment_id: TEST_SEGMENT_1,
      season_id: TEST_SEASON_ID,
      required_laps: 1
    };    test('POST /admin/weeks rejects non-admin with 403', async () => {
      const response = await makeRequestAsUser(request, app, {
        method: 'post',
        path: '/admin/weeks',
        athleteId: 999999,  // Non-admin athlete ID
        data: testWeekData
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/admin|forbidden/i);
    });

    test('PUT /admin/weeks/:id rejects non-admin with 403', async () => {
      const response = await makeRequestAsUser(request, app, {
        method: 'put',
        path: `/admin/weeks/${testWeekId1}`,
        athleteId: 999999,
        data: { required_laps: 99 }
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('DELETE /admin/weeks/:id rejects non-admin with 403', async () => {
      const response = await makeRequestAsUser(request, app, {
        method: 'delete',
        path: `/admin/weeks/${testWeekId1}`,
        athleteId: 999999
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
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
        start_at: isoToUnix('2026-01-01T00:00:00Z'),
        end_at: isoToUnix('2026-12-31T23:59:59Z'),
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
        start_at: isoToUnix('2027-01-01T00:00:00Z'),
        end_at: isoToUnix('2027-12-31T23:59:59Z'),
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
          end_at: isoToUnix('2026-11-30T23:59:59Z')
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Test Season');
      expect(response.body.end_at).toBe(isoToUnix('2026-11-30T23:59:59Z'));
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

  // Non-admin rejection tests for season management
  describe('Admin - Season Management - Non-Admin Rejection', () => {
    const testSeasonData = {
      name: 'Unauthorized Season',
      start_date: '2027-01-01',
      end_date: '2027-12-31',
      is_active: 0
    };

    test('POST /admin/seasons rejects non-admin with 403', async () => {
      const response = await makeRequestAsUser(request, app, {
        method: 'post',
        path: '/admin/seasons',
        athleteId: 999999,
        data: testSeasonData
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('PUT /admin/seasons/:id rejects non-admin with 403', async () => {
      const response = await makeRequestAsUser(request, app, {
        method: 'put',
        path: `/admin/seasons/${TEST_SEASON_ID}`,
        athleteId: 999999,
        data: { name: 'Hacked Season' }
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('DELETE /admin/seasons/:id rejects non-admin with 403', async () => {
      const response = await makeRequestAsUser(request, app, {
        method: 'delete',
        path: `/admin/seasons/${TEST_SEASON_ID}`,
        athleteId: 999999
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Admin - Segment Management', () => {
    const VALID_SEGMENT_ID = 88888888;
    const UNKNOWN_SEGMENT_ID = 99999999;

    test('GET /admin/segments lists all segments', async () => {
      const response = await request(app)
        .get('/admin/segments')
        .set('Cookie', 'wmv.sid=test-admin-session');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Should include test segments created in beforeAll
      const segmentIds = response.body.map(s => s.strava_segment_id);
      expect(segmentIds).toContain(TEST_SEGMENT_1);
      expect(segmentIds).toContain(TEST_SEGMENT_2);
    });

    test('GET /admin/segments/:id/validate requires admin access', async () => {
      const response = await makeRequestAsUser(request, app, {
        method: 'get',
        path: `/admin/segments/${VALID_SEGMENT_ID}/validate`,
        athleteId: 999999  // Non-admin
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('POST /admin/segments requires admin access', async () => {
      const response = await makeRequestAsUser(request, app, {
        method: 'post',
        path: '/admin/segments',
        athleteId: 999999,  // Non-admin
        data: { segment_id: 12345 }
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  // NOTE: Manual activity submission endpoint deprecated
  // Use admin batch fetch (POST /admin/weeks/:id/fetch-results) instead
});
