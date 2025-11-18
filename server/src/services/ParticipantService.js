/**
 * ParticipantService
 * Handles participant-related queries: listing and connection status
 * 
 * Dependencies: db (SQLite database)
 * 
 * The service is responsible for:
 * - Retrieving all participants (basic public info)
 * - Retrieving participants with connection status (admin view)
 * 
 * Note: User data deletion (GDPR) is handled by UserDataService
 * 
 * Error Handling:
 * - Throws descriptive errors for business logic violations
 * - Routes catch and map to HTTP status codes
 */

class ParticipantService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get all participants (basic info only)
   * Used by frontend for leaderboard display
   * 
   * @returns {Array} Array of participants with {id, name, strava_athlete_id}
   */
  getAllParticipants() {
    const participants = this.db.prepare(
      'SELECT id, name, strava_athlete_id FROM participant'
    ).all();
    return participants;
  }

  /**
   * Get all participants with connection status (admin only)
   * Shows which participants have valid Strava OAuth tokens
   * 
   * @returns {Array} Array of participants with {id, name, strava_athlete_id, has_token, token_expires_at}
   */
  getAllParticipantsWithStatus() {
    const participants = this.db.prepare(`
      SELECT 
        p.strava_athlete_id as id,
        p.name,
        p.strava_athlete_id,
        CASE WHEN pt.access_token IS NOT NULL THEN 1 ELSE 0 END as has_token,
        pt.expires_at as token_expires_at
      FROM participant p
      LEFT JOIN participant_token pt ON p.strava_athlete_id = pt.strava_athlete_id
      ORDER BY p.name
    `).all();
    return participants;
  }
}

module.exports = ParticipantService;
