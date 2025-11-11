const Database = require('better-sqlite3');
const path = require('path');
const { SCHEMA } = require('../schema');
const {
  createParticipant,
  createFullUserWithActivity,
  clearAllData
} = require('./testDataHelpers');

describe('User Data Endpoints (GDPR)', () => {
  let db;
  const testDbPath = path.join(__dirname, '../../../server/data/test-gdpr.db');

  beforeAll(() => {
    // Create test database
    db = new Database(testDbPath);
    
    // Initialize schema (single source of truth)
    db.exec(SCHEMA);
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
      clearAllData(db);
    });

    test('deletes all user data in single synchronous transaction', () => {
      const stravaAthleteId = 12345;

      // Setup: Create a user with activities
      createFullUserWithActivity(db, { stravaAthleteId, name: 'Tim D' });

      // Verify data exists
      expect(db.prepare('SELECT COUNT(*) as count FROM participant WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as count FROM participant_token WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as count FROM activity WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as count FROM segment_effort').get().count).toBe(1);
      expect(db.prepare('SELECT COUNT(*) as count FROM result WHERE strava_athlete_id = ?').get(stravaAthleteId).count).toBe(1);

      // Execute deletion (synchronously)
      const deleteTransaction = db.transaction(() => {
        // Delete data in cascade order (children first, parent last)
        // Foreign key dependencies: result -> activity -> segment_effort
        // So: segment_effort first, then result, then activity, then token, then participant
        db.prepare('DELETE FROM segment_effort WHERE activity_id IN (SELECT id FROM activity WHERE strava_athlete_id = ?)')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM result WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM activity WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM participant_token WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
        
        // Log deletion AFTER deleting related data but BEFORE deleting participant
        // (deletion_request has foreign key to participant)
        const timestamp = new Date().toISOString();
        db.prepare('INSERT INTO deletion_request (strava_athlete_id, requested_at, status, completed_at) VALUES (?, ?, ?, ?)')
          .run(stravaAthleteId, timestamp, 'completed', timestamp);
        
        db.prepare('DELETE FROM participant WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
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

      // Setup: Create a user with activities
      createFullUserWithActivity(db, { 
        stravaAthleteId, 
        name: 'User Two',
        stravaSegmentId: 88888
      });

      expect(db.prepare('SELECT COUNT(*) as count FROM segment_effort').get().count).toBe(1);

      // Delete in correct order
      const deleteTransaction = db.transaction(() => {
        // result -> activity -> segment_effort (delete children first)
        db.prepare('DELETE FROM result WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM segment_effort WHERE activity_id IN (SELECT id FROM activity WHERE strava_athlete_id = ?)')
          .run(stravaAthleteId);
        db.prepare('DELETE FROM activity WHERE strava_athlete_id = ?')
          .run(stravaAthleteId);
      });

      deleteTransaction();

      expect(db.prepare('SELECT COUNT(*) as count FROM segment_effort').get().count).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as count FROM activity').get().count).toBe(0);
    });

    test('rolls back entire transaction on error', () => {
      const stravaAthleteId = 33333;

      createParticipant(db, stravaAthleteId, 'User Three', true);

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
      clearAllData(db);
    });

    test('retrieves all user data for GDPR access request', () => {
      const stravaAthleteId = 44444;

      // Setup: Create complete user profile
      createFullUserWithActivity(db, { 
        stravaAthleteId, 
        name: 'Alice',
        stravaSegmentId: 77777
      });

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

      createParticipant(db, stravaAthleteId, 'Bob');

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
      clearAllData(db);
    });

    test('removes tokens but keeps participant record', () => {
      const stravaAthleteId = 66666;

      // Setup
      createParticipant(db, stravaAthleteId, 'Charlie', true);

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
