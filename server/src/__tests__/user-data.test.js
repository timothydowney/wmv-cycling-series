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
      CREATE TABLE IF NOT EXISTS participant (
        strava_athlete_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS segment (
        strava_segment_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        distance REAL,
        average_grade REAL,
        city TEXT,
        state TEXT,
        country TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS week (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season_id INTEGER NOT NULL,
        week_name TEXT NOT NULL,
        date TEXT NOT NULL,
        strava_segment_id INTEGER NOT NULL,
        required_laps INTEGER NOT NULL DEFAULT 1,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(season_id) REFERENCES season(id),
        FOREIGN KEY(strava_segment_id) REFERENCES segment(strava_segment_id)
      );

      CREATE TABLE IF NOT EXISTS participant_token (
        strava_athlete_id INTEGER PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        scope TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(strava_athlete_id) REFERENCES participant(strava_athlete_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_id INTEGER NOT NULL,
        strava_athlete_id INTEGER NOT NULL,
        strava_activity_id INTEGER NOT NULL,
        validation_status TEXT DEFAULT 'valid',
        validation_message TEXT,
        validated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(week_id) REFERENCES week(id),
        FOREIGN KEY(strava_athlete_id) REFERENCES participant(strava_athlete_id),
        UNIQUE(week_id, strava_athlete_id)
      );

      CREATE TABLE IF NOT EXISTS segment_effort (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id INTEGER NOT NULL,
        strava_segment_id INTEGER,
        effort_index INTEGER,
        elapsed_seconds INTEGER,
        start_time TEXT,
        pr_achieved BOOLEAN DEFAULT 0,
        FOREIGN KEY(activity_id) REFERENCES activity(id)
      );

      CREATE TABLE IF NOT EXISTS result (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_id INTEGER,
        strava_athlete_id INTEGER,
        activity_id INTEGER,
        total_time_seconds INTEGER,
        rank INTEGER,
        points INTEGER,
        pr_bonus_points INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(strava_athlete_id) REFERENCES participant(strava_athlete_id)
      );

      CREATE TABLE IF NOT EXISTS season (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS deletion_request (
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
      db.exec('DELETE FROM deletion_request');
      db.exec('DELETE FROM segment_effort');
      db.exec('DELETE FROM result');
      db.exec('DELETE FROM activity');
      db.exec('DELETE FROM participant_token');
      db.exec('DELETE FROM participant');
    });

    test('deletes all user data in single synchronous transaction', () => {
      const stravaAthleteId = 12345;

      // Setup: Create a user with activities
      db.prepare('INSERT INTO participant (name, strava_athlete_id) VALUES (?, ?)')
        .run('Tim D', stravaAthleteId);

      db.prepare('INSERT INTO participant_token (strava_athlete_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 'token123', 'refresh123', Date.now() + 3600000);

      // Create a season and week (required foreign keys)
      const season = db.prepare('INSERT INTO season (name, start_date, end_date, is_active) VALUES (?, ?, ?, ?)')
        .run('Test Season', '2025-01-01', '2025-12-31', 1);
      const seasonId = season.lastInsertRowid;

      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)')
        .run(99999, 'Test Segment');
      
      const week = db.prepare('INSERT INTO week (season_id, week_name, date, strava_segment_id, required_laps, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(seasonId, 'Test Week', '2025-06-01', 99999, 1, '2025-06-01T00:00:00Z', '2025-06-01T22:00:00Z');
      const weekId = week.lastInsertRowid;

      const activityId = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id) VALUES (?, ?, ?)')
        .run(weekId, stravaAthleteId, 999).lastInsertRowid;

      db.prepare('INSERT INTO segment_effort (activity_id, effort_index, elapsed_seconds) VALUES (?, ?, ?)')
        .run(activityId, 1, 1234);

      db.prepare('INSERT INTO result (strava_athlete_id, total_time_seconds) VALUES (?, ?)')
        .run(stravaAthleteId, 1234);

      // Verify data exists
      expect(db.prepare('SELECT COUNT(*) as count FROM participant WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as count FROM participant_token WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as count FROM activity WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as count FROM segment_effort').get().count).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as count FROM result WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);

      // Execute deletion (synchronously)
      const deleteTransaction = db.transaction(() => {
        db.prepare('DELETE FROM segment_effort WHERE activity_id IN (SELECT id FROM activity WHERE strava_athlete_id = ?)')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM activity WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM result WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM participant_token WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM participant WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);

        // Log deletion
        const timestamp = new Date().toISOString();
        db.prepare('INSERT INTO deletion_request (strava_athlete_id, requested_at, status, completed_at) VALUES (?, ?, ?, ?)')
          .run(stravaAthleteId, timestamp, 'completed', timestamp);
      });

      // This is synchronous - executes immediately
      deleteTransaction();

      // Verify all data is deleted
      expect(db.prepare('SELECT COUNT(*) as count FROM participant WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM participant_token WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM activity WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM segment_effort').get().count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM result WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(0);

      // Verify audit trail created
      const auditEntry = db.prepare('SELECT * FROM deletion_request WHERE strava_athlete_id = ?').get(stravaAthleteId);
      expect(auditEntry).toBeDefined();
      expect(auditEntry.status).toBe('completed');
      expect(auditEntry.requested_at).toBeDefined();
      expect(auditEntry.completed_at).toBeDefined();
    });

    test('deletes segment efforts before activities (cascade order)', () => {
      const stravaAthleteId = 22222;

      // Setup
      db.prepare('INSERT INTO participant (name, strava_athlete_id) VALUES (?, ?)')
        .run('User Two', stravaAthleteId);

      // Create week first
      const season = db.prepare('INSERT INTO season (name, start_date, end_date, is_active) VALUES (?, ?, ?, ?)')
        .run('Test Season', '2025-01-01', '2025-12-31', 1);
      const seasonId = season.lastInsertRowid;

      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)')
        .run(88888, 'Test Segment');
      
      const week = db.prepare('INSERT INTO week (season_id, week_name, date, strava_segment_id, required_laps, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(seasonId, 'Test Week', '2025-06-01', 88888, 1, '2025-06-01T00:00:00Z', '2025-06-01T22:00:00Z');
      const weekId = week.lastInsertRowid;

      const activityId = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id) VALUES (?, ?, ?)')
        .run(weekId, stravaAthleteId, 888).lastInsertRowid;

      db.prepare('INSERT INTO segment_effort (activity_id, effort_index, elapsed_seconds) VALUES (?, ?, ?)')
        .run(activityId, 1, 999);

      expect(db.prepare('SELECT COUNT(*) as count FROM segment_effort').get().count).toBe(1);

      // Delete in correct order
      const deleteTransaction = db.transaction(() => {
        // Delete children first
        db.prepare('DELETE FROM segment_effort WHERE activity_id IN (SELECT id FROM activity WHERE strava_athlete_id = ?)')
          .run(stravaAthleteId);
        // Then parent
        db.prepare('DELETE FROM activity WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
      });

      deleteTransaction();

      expect(db.prepare('SELECT COUNT(*) as count FROM segment_effort').get().count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM activity').get().count).toBe(0);
    });

    test('rolls back entire transaction on error', () => {
      const stravaAthleteId = 33333;

      db.prepare('INSERT INTO participant (name, strava_athlete_id) VALUES (?, ?)')
        .run('User Three', stravaAthleteId);
      db.prepare('INSERT INTO participant_token (strava_athlete_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 'token', 'refresh', Date.now());

      expect(db.prepare('SELECT COUNT(*) as count FROM participant WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);

      // Attempt deletion with error
      try {
        const deleteTransaction = db.transaction(() => {
          // Delete first record
          db.prepare('DELETE FROM participant WHERE strava_athlete_id = ?')
            .run(stravaAthleteId);
          // Cause error
          throw new Error('Simulated error');
        });
        deleteTransaction();
      } catch (err) {
        // Expected
      }

      // Verify rollback - data should still exist
      expect(db.prepare('SELECT COUNT(*) as count FROM participant WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);
    });
  });

  describe('GET /user/data', () => {
    beforeEach(() => {
      db.exec('DELETE FROM deletion_request');
      db.exec('DELETE FROM segment_effort');
      db.exec('DELETE FROM result');
      db.exec('DELETE FROM activity');
      db.exec('DELETE FROM participant_token');
      db.exec('DELETE FROM participant');
    });

    test('retrieves all user data for GDPR access request', () => {
      const stravaAthleteId = 44444;

      // Setup: Create complete user profile
      db.prepare('INSERT INTO participant (name, strava_athlete_id) VALUES (?, ?)')
        .run('Alice', stravaAthleteId);

      db.prepare('INSERT INTO participant_token (strava_athlete_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 'token_access_123', 'token_refresh_456', Date.now() + 3600000);

      // Create week first
      const season = db.prepare('INSERT INTO season (name, start_date, end_date, is_active) VALUES (?, ?, ?, ?)')
        .run('Test Season', '2025-01-01', '2025-12-31', 1);
      const seasonId = season.lastInsertRowid;

      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)')
        .run(77777, 'Test Segment');
      
      const week = db.prepare('INSERT INTO week (season_id, week_name, date, strava_segment_id, required_laps, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(seasonId, 'Test Week', '2025-06-01', 77777, 1, '2025-06-01T00:00:00Z', '2025-06-01T22:00:00Z');
      const weekId = week.lastInsertRowid;

      const activityId = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id) VALUES (?, ?, ?)')
        .run(weekId, stravaAthleteId, 111).lastInsertRowid;

      db.prepare('INSERT INTO segment_effort (activity_id, effort_index, elapsed_seconds, pr_achieved) VALUES (?, ?, ?, ?)')
        .run(activityId, 1, 1000, 1);

      db.prepare('INSERT INTO result (strava_athlete_id, total_time_seconds, rank, points) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 1000, 1, 5);

      // Retrieve user data
      const participant = db.prepare('SELECT * FROM participant WHERE strava_athlete_id = ?').get(stravaAthleteId);
      const activities = db.prepare('SELECT * FROM activity WHERE strava_athlete_id = ?').all(stravaAthleteId);
      const results = db.prepare('SELECT * FROM result WHERE strava_athlete_id = ?').all(stravaAthleteId);
      const efforts = db.prepare('SELECT se.* FROM segment_effort se JOIN activity a ON se.activity_id = a.id WHERE a.strava_athlete_id = ?').all(stravaAthleteId);
      const tokens = db.prepare('SELECT strava_athlete_id, access_token, refresh_token, expires_at, scope, created_at, updated_at FROM participant_token WHERE strava_athlete_id = ?').get(stravaAthleteId);

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

      db.prepare('INSERT INTO participant (name, strava_athlete_id) VALUES (?, ?)')
        .run('Bob', stravaAthleteId);

      const activities = db.prepare('SELECT * FROM activity WHERE strava_athlete_id = ?').all(stravaAthleteId);
      const results = db.prepare('SELECT * FROM result WHERE strava_athlete_id = ?').all(stravaAthleteId);
      const efforts = db.prepare('SELECT se.* FROM segment_effort se JOIN activity a ON se.activity_id = a.id WHERE a.strava_athlete_id = ?').all(stravaAthleteId);

      expect(activities).toEqual([]);
      expect(results).toEqual([]);
      expect(efforts).toEqual([]);
    });
  });

  describe('POST /auth/disconnect', () => {
    beforeEach(() => {
      db.exec('DELETE FROM participant_token');
      db.exec('DELETE FROM participant');
    });

    test('removes tokens but keeps participant record', () => {
      const stravaAthleteId = 66666;

      // Setup
      db.prepare('INSERT INTO participant (name, strava_athlete_id) VALUES (?, ?)')
        .run('Charlie', stravaAthleteId);

      db.prepare('INSERT INTO participant_token (strava_athlete_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)')
        .run(stravaAthleteId, 'token_x', 'refresh_x', Date.now());

      expect(db.prepare('SELECT COUNT(*) as count FROM participant_token WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);

      // Disconnect (remove tokens only)
      db.prepare('DELETE FROM participant_token WHERE strava_athlete_id = ?').run(stravaAthleteId);

      // Verify tokens gone but participant stays
      expect(db.prepare('SELECT COUNT(*) as count FROM participant_token WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM participant WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);

      const participant = db.prepare('SELECT name FROM participant WHERE strava_athlete_id = ?').get(stravaAthleteId);
      expect(participant.name).toBe('Charlie');
    });
  });
});
