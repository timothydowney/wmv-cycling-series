/**
 * UserDataService
 * Handles user data and privacy operations (GDPR compliance)
 * 
 * Dependencies: db (SQLite database), helpers (nowISO)
 * 
 * The service is responsible for:
 * - Atomic deletion of all user data (activities, results, tokens, participant)
 * - Exporting all personal data for user review
 * - Logging deletion requests for compliance
 * - Security: never expose token values in exports
 * 
 * Error Handling:
 * - Throws descriptive errors for business logic violations
 * - Routes catch and map to HTTP status codes
 */

class UserDataService {
  constructor(db, nowISO) {
    this.db = db;
    this.nowISO = nowISO;
  }

  /**
   * Delete all user data atomically (GDPR Data Deletion)
   * Deletes in proper cascade order to respect foreign key constraints:
   * 1. segment_effort (linked to activities)
   * 2. activity (main user data)
   * 3. result (computed results)
   * 4. participant_token (OAuth tokens)
   * 5. deletion_request (audit log)
   * 6. participant (main record)
   * 
   * @param {number} stravaAthleteId - Athlete ID requesting deletion
   * @returns {Object} {success: true, message, timestamp}
   * @throws {Error} Database errors during transaction
   */
  deleteUserData(stravaAthleteId) {
    const deletionTimestamp = this.nowISO();

    // Create transaction for atomic deletion
    const deleteTransaction = this.db.transaction(() => {
      // 1. Delete all segment efforts (linked to activities via foreign key)
      this.db.prepare(`
        DELETE FROM segment_effort WHERE activity_id IN (
          SELECT id FROM activity WHERE strava_athlete_id = ?
        )
      `).run(stravaAthleteId);

      // 2. Delete all activities
      this.db.prepare('DELETE FROM activity WHERE strava_athlete_id = ?').run(stravaAthleteId);

      // 3. Delete all results
      this.db.prepare('DELETE FROM result WHERE strava_athlete_id = ?').run(stravaAthleteId);

      // 4. Delete OAuth tokens (sensitive data)
      this.db.prepare('DELETE FROM participant_token WHERE strava_athlete_id = ?').run(stravaAthleteId);

      // 5. Log deletion request BEFORE deleting participant (for compliance audit trail)
      this.db.prepare(`
        INSERT INTO deletion_request (strava_athlete_id, requested_at, status, completed_at)
        VALUES (?, ?, ?, ?)
      `).run(stravaAthleteId, deletionTimestamp, 'completed', deletionTimestamp);

      // 6. Delete participant record (after logging to maintain foreign key)
      this.db.prepare('DELETE FROM participant WHERE strava_athlete_id = ?').run(stravaAthleteId);
    });

    // Execute the transaction atomically
    deleteTransaction();

    return {
      success: true,
      message: 'Your data has been deleted from the WMV application',
      timestamp: deletionTimestamp,
      info: 'All activities, results, and tokens have been removed. This action cannot be undone.',
      nextSteps: 'You can reconnect with Strava anytime to participate in future competitions'
    };
  }

  /**
   * Export all user data (GDPR Data Access Request)
   * Returns comprehensive data export with tokens redacted for security
   * 
   * @param {number} stravaAthleteId - Athlete ID requesting export
   * @returns {Object} Comprehensive data export with participant, activities, results, efforts, tokens
   * @throws {Error} 'Participant not found' if athlete has no record
   */
  getUserData(stravaAthleteId) {
    // Get participant info
    const participant = this.db.prepare(
      'SELECT * FROM participant WHERE strava_athlete_id = ?'
    ).get(stravaAthleteId);

    if (!participant) {
      throw new Error('Participant not found');
    }

    // Get all activities
    const activities = this.db.prepare(
      'SELECT * FROM activity WHERE strava_athlete_id = ?'
    ).all(stravaAthleteId);

    // Get all results
    const results = this.db.prepare(
      'SELECT * FROM result WHERE strava_athlete_id = ?'
    ).all(stravaAthleteId);

    // Get segment efforts for all activities
    const efforts = this.db.prepare(`
      SELECT se.* FROM segment_effort se
      JOIN activity a ON se.activity_id = a.id
      WHERE a.strava_athlete_id = ?
    `).all(stravaAthleteId);

    // Get token info (without actual token values for security)
    const tokenInfo = this.db.prepare(`
      SELECT 
        id,
        strava_athlete_id,
        created_at,
        updated_at,
        'REDACTED' as access_token,
        'REDACTED' as refresh_token
      FROM participant_token WHERE strava_athlete_id = ?
    `).get(stravaAthleteId);

    // Return comprehensive export
    return {
      exportedAt: this.nowISO(),
      participant: {
        name: participant.name,
        stravaAthleteId: participant.strava_athlete_id,
        createdAt: participant.created_at
      },
      activities: activities,
      results: results,
      segmentEfforts: efforts,
      tokens: tokenInfo ? { stored: true, createdAt: tokenInfo.created_at } : null,
      note: 'This is your personal data export. Tokens are redacted for security.'
    };
  }
}

module.exports = UserDataService;
