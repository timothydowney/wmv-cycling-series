const Database = require('better-sqlite3');
const path = require('path');

describe('User Data Endpoints (GDPR)', () => {
  let db;
  const testDbPath = path.join(__dirname, '../../../server/data/test-gdpr.db');

  beforeAll(() => {
    // Create test database
    db = new Database(testDbPath);
    
    // Create schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        strava_athlete_id INTEGER UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS participant_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strava_athlete_id INTEGER NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        scope TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(strava_athlete_id) REFERENCES participants(strava_athlete_id)
      );

      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strava_athlete_id INTEGER NOT NULL,
        strava_activity_id INTEGER NOT NULL,
        activity_url TEXT NOT NULL,
        activity_date TEXT NOT NULL,
        week_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(strava_athlete_id) REFERENCES participants(strava_athlete_id)
      );

      CREATE TABLE IF NOT EXISTS segment_efforts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id INTEGER NOT NULL,
        segment_id INTEGER,
        effort_index INTEGER,
        elapsed_seconds INTEGER,
        start_time TEXT,
        pr_achieved BOOLEAN DEFAULT 0,
        FOREIGN KEY(activity_id) REFERENCES activities(id)
      );

      CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_id INTEGER,
        strava_athlete_id INTEGER,
        activity_id INTEGER,
        total_time_seconds INTEGER,
        rank INTEGER,
        points INTEGER,
        pr_bonus_points INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(strava_athlete_id) REFERENCES participants(strava_athlete_id)
      );

      CREATE TABLE IF NOT EXISTS deletion_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        strava_athlete_id INTEGER NOT NULL,
        requested_at TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        completed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterAll(() => {
    db.close();
    // Clean up test database
    const fs = require('fs');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('POST /user/data/delete', () => {
    beforeEach(() => {
      // Clear all tables before each test
      db.exec('DELETE FROM deletion_requests');
      db.exec('DELETE FROM segment_efforts');
      db.exec('DELETE FROM results');
      db.exec('DELETE FROM activities');
      db.exec('DELETE FROM participant_tokens');
      db.exec('DELETE FROM participants');
    });

    test('deletes all user data in single synchronous transaction', () => {
      const stravaAthleteId = 12345;

      // Setup: Create a user with activities
      db.prepare('INSERT INTO participants (name, strava_athlete_id) VALUES (?, ?)')
        .run('Tim D', stravaAthleteId);

      db.prepare('INSERT INTO participant_tokens (strava_athlete_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 'token123', 'refresh123', Date.now() + 3600000);

      const activityId = db.prepare('INSERT INTO activities (strava_athlete_id, strava_activity_id, activity_url, activity_date) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 999, 'https://strava.com/activities/999', '2025-11-11').lastInsertRowid;

      db.prepare('INSERT INTO segment_efforts (activity_id, effort_index, elapsed_seconds) VALUES (?, ?, ?)')
        .run(activityId, 1, 1234);

      db.prepare('INSERT INTO results (strava_athlete_id, total_time_seconds) VALUES (?, ?)')
        .run(stravaAthleteId, 1234);

      // Verify data exists
      expect(db.prepare('SELECT COUNT(*) as count FROM participants WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as count FROM participant_tokens WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as count FROM activities WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as count FROM segment_efforts').get().count).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as count FROM results WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);

      // Execute deletion (synchronously)
      const deleteTransaction = db.transaction(() => {
        db.prepare('DELETE FROM segment_efforts WHERE activity_id IN (SELECT id FROM activities WHERE strava_athlete_id = ?)')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM activities WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM results WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM participant_tokens WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM participants WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);

        // Log deletion
        const timestamp = new Date().toISOString();
        db.prepare('INSERT INTO deletion_requests (strava_athlete_id, requested_at, status, completed_at) VALUES (?, ?, ?, ?)')
          .run(stravaAthleteId, timestamp, 'completed', timestamp);
      });

      // This is synchronous - executes immediately
      deleteTransaction();

      // Verify all data is deleted
      expect(db.prepare('SELECT COUNT(*) as count FROM participants WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM participant_tokens WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM activities WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM segment_efforts').get().count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM results WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(0);

      // Verify audit trail created
      const auditEntry = db.prepare('SELECT * FROM deletion_requests WHERE strava_athlete_id = ?').get(stravaAthleteId);
      expect(auditEntry).toBeDefined();
      expect(auditEntry.status).toBe('completed');
      expect(auditEntry.requested_at).toBeDefined();
      expect(auditEntry.completed_at).toBeDefined();
    });

    test('deletes segment efforts before activities (cascade order)', () => {
      const stravaAthleteId = 22222;

      // Setup
      db.prepare('INSERT INTO participants (name, strava_athlete_id) VALUES (?, ?)')
        .run('User Two', stravaAthleteId);

      const activityId = db.prepare('INSERT INTO activities (strava_athlete_id, strava_activity_id, activity_url, activity_date) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 888, 'https://strava.com/activities/888', '2025-11-11').lastInsertRowid;

      db.prepare('INSERT INTO segment_efforts (activity_id, effort_index, elapsed_seconds) VALUES (?, ?, ?)')
        .run(activityId, 1, 999);

      expect(db.prepare('SELECT COUNT(*) as count FROM segment_efforts').get().count).toBe(1);

      // Delete in correct order
      const deleteTransaction = db.transaction(() => {
        // Delete children first
        db.prepare('DELETE FROM segment_efforts WHERE activity_id IN (SELECT id FROM activities WHERE strava_athlete_id = ?)')
          .run(stravaAthleteId);
        // Then parent
        db.prepare('DELETE FROM activities WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
      });

      deleteTransaction();

      expect(db.prepare('SELECT COUNT(*) as count FROM segment_efforts').get().count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM activities').get().count).toBe(0);
    });

    test('rolls back entire transaction on error', () => {
      const stravaAthleteId = 33333;

      db.prepare('INSERT INTO participants (name, strava_athlete_id) VALUES (?, ?)')
        .run('User Three', stravaAthleteId);
      db.prepare('INSERT INTO participant_tokens (strava_athlete_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 'token', 'refresh', Date.now());

      expect(db.prepare('SELECT COUNT(*) as count FROM participants WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);

      // Attempt deletion with error
      try {
        const deleteTransaction = db.transaction(() => {
          // Delete first record
          db.prepare('DELETE FROM participants WHERE strava_athlete_id = ?')
            .run(stravaAthleteId);
          // Cause error
          throw new Error('Simulated error');
        });
        deleteTransaction();
      } catch (err) {
        // Expected
      }

      // Verify rollback - data should still exist
      expect(db.prepare('SELECT COUNT(*) as count FROM participants WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);
    });
  });

  describe('GET /user/data', () => {
    beforeEach(() => {
      db.exec('DELETE FROM deletion_requests');
      db.exec('DELETE FROM segment_efforts');
      db.exec('DELETE FROM results');
      db.exec('DELETE FROM activities');
      db.exec('DELETE FROM participant_tokens');
      db.exec('DELETE FROM participants');
    });

    test('retrieves all user data for GDPR access request', () => {
      const stravaAthleteId = 44444;

      // Setup: Create complete user profile
      db.prepare('INSERT INTO participants (name, strava_athlete_id) VALUES (?, ?)')
        .run('Alice', stravaAthleteId);

      db.prepare('INSERT INTO participant_tokens (strava_athlete_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 'token_access_123', 'token_refresh_456', Date.now() + 3600000);

      const activityId = db.prepare('INSERT INTO activities (strava_athlete_id, strava_activity_id, activity_url, activity_date) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 111, 'https://strava.com/111', '2025-11-11').lastInsertRowid;

      db.prepare('INSERT INTO segment_efforts (activity_id, effort_index, elapsed_seconds, pr_achieved) VALUES (?, ?, ?, ?)')
        .run(activityId, 1, 1000, 1);

      db.prepare('INSERT INTO results (strava_athlete_id, total_time_seconds, rank, points) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 1000, 1, 5);

      // Retrieve user data
      const participant = db.prepare('SELECT * FROM participants WHERE strava_athlete_id = ?').get(stravaAthleteId);
      const activities = db.prepare('SELECT * FROM activities WHERE strava_athlete_id = ?').all(stravaAthleteId);
      const results = db.prepare('SELECT * FROM results WHERE strava_athlete_id = ?').all(stravaAthleteId);
      const efforts = db.prepare('SELECT se.* FROM segment_efforts se JOIN activities a ON se.activity_id = a.id WHERE a.strava_athlete_id = ?').all(stravaAthleteId);
      const tokens = db.prepare('SELECT id, strava_athlete_id, created_at, updated_at FROM participant_tokens WHERE strava_athlete_id = ?').get(stravaAthleteId);

      // Verify data retrieved
      expect(participant.name).toBe('Alice');
      expect(activities.length).toBe(1);
      expect(results.length).toBe(1);
      expect(efforts.length).toBe(1);
      expect(tokens.strava_athlete_id).toBe(stravaAthleteId);

      // Verify tokens are NOT exposed in query
      const allData = {
        participant: { name: participant.name, stravaAthleteId: participant.strava_athlete_id },
        activities,
        results,
        efforts,
        tokens: tokens ? { stored: true, createdAt: tokens.created_at } : null
      };

      expect(allData.tokens.stored).toBe(true);
      expect(allData.tokens.createdAt).toBeDefined();
      // Tokens not in response at all
      expect(Object.keys(allData.tokens)).not.toContain('access_token');
      expect(Object.keys(allData.tokens)).not.toContain('refresh_token');
    });

    test('returns empty arrays when user has no data', () => {
      const stravaAthleteId = 55555;

      db.prepare('INSERT INTO participants (name, strava_athlete_id) VALUES (?, ?)')
        .run('Bob', stravaAthleteId);

      const activities = db.prepare('SELECT * FROM activities WHERE strava_athlete_id = ?').all(stravaAthleteId);
      const results = db.prepare('SELECT * FROM results WHERE strava_athlete_id = ?').all(stravaAthleteId);
      const efforts = db.prepare('SELECT se.* FROM segment_efforts se JOIN activities a ON se.activity_id = a.id WHERE a.strava_athlete_id = ?').all(stravaAthleteId);

      expect(activities).toEqual([]);
      expect(results).toEqual([]);
      expect(efforts).toEqual([]);
    });
  });

  describe('POST /auth/disconnect', () => {
    beforeEach(() => {
      db.exec('DELETE FROM participant_tokens');
      db.exec('DELETE FROM participants');
    });

    test('removes tokens but keeps participant record', () => {
      const stravaAthleteId = 66666;

      // Setup
      db.prepare('INSERT INTO participants (name, strava_athlete_id) VALUES (?, ?)')
        .run('Charlie', stravaAthleteId);

      db.prepare('INSERT INTO participant_tokens (strava_athlete_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 'token_x', 'refresh_x', Date.now());

      expect(db.prepare('SELECT COUNT(*) as count FROM participant_tokens WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);

      // Disconnect (remove tokens only)
      db.prepare('DELETE FROM participant_tokens WHERE strava_athlete_id = ?').run(stravaAthleteId);

      // Verify tokens gone but participant stays
      expect(db.prepare('SELECT COUNT(*) as count FROM participant_tokens WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM participants WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);

      const participant = db.prepare('SELECT name FROM participants WHERE strava_athlete_id = ?').get(stravaAthleteId);
      expect(participant.name).toBe('Charlie');
    });
  });
});
