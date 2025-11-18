/**
 * Login Service
 * 
 * Handles all OAuth-related logic:
 * - Exchange authorization codes for tokens
 * - Token refresh and validation
 * - Session management
 * - Login/logout flow
 * 
 * This service encapsulates the OAuth flow so routes just call methods,
 * not implement the logic directly.
 */

class LoginService {
  constructor(db, stravaClient, encryptToken, getAdminAthleteIds) {
    this.db = db;
    this.stravaClient = stravaClient;
    this.encryptToken = encryptToken;
    this.getAdminAthleteIds = getAdminAthleteIds;
  }

  /**
   * Exchange OAuth authorization code for tokens and create session
   * 
   * Flow:
   * 1. Exchange code for tokens from Strava
   * 2. Create/update participant record
   * 3. Store encrypted tokens
   * 4. Populate session with athlete info
   * 
   * @param {string} code - Authorization code from Strava
   * @param {Object} session - Express session object to populate
   * @param {string} scope - OAuth scope granted by user
   * @returns {Promise<Object>} Session info { stravaAthleteId, athleteName }
   */
  async exchangeCodeAndCreateSession(code, session, scope) {
    console.log('Exchanging OAuth code for tokens...');
    
    // Exchange authorization code for tokens using stravaClient
    const tokenData = await this.stravaClient.exchangeAuthorizationCode(code);
    
    const stravaAthleteId = tokenData.athlete.id;
    const athleteName = `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`;
    
    console.log(`OAuth successful for Strava athlete ${stravaAthleteId} (${athleteName})`);
    
    // Upsert participant in database (using athlete ID as primary key)
    this.db.prepare(`
      INSERT INTO participant (strava_athlete_id, name)
      VALUES (?, ?)
      ON CONFLICT(strava_athlete_id) DO UPDATE SET name = excluded.name
    `).run(stravaAthleteId, athleteName);
    
    console.log(`Participant record ensured for ${athleteName}`);
    
    // Store tokens for this participant (ENCRYPTED)
    this.db.prepare(`
      INSERT OR REPLACE INTO participant_token 
      (strava_athlete_id, access_token, refresh_token, expires_at, scope)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      stravaAthleteId,
      this.encryptToken(tokenData.access_token),
      this.encryptToken(tokenData.refresh_token),
      tokenData.expires_at,
      scope || tokenData.scope
    );
    
    console.log(`Tokens stored (encrypted) for participant ${stravaAthleteId}`);
    
    // Store session (use Strava athlete ID as the session identifier)
    session.stravaAthleteId = stravaAthleteId;
    session.athleteName = tokenData.athlete.firstname;
    
    return {
      stravaAthleteId,
      athleteName: tokenData.athlete.firstname
    };
  }

  /**
   * Get current authentication status for a session
   * 
   * @param {number} stravaAthleteId - Athlete ID from session (null if not authenticated)
   * @returns {Object} { authenticated, participant, is_admin }
   */
  getAuthStatus(stravaAthleteId) {
    if (!stravaAthleteId) {
      console.log('[AUTH_STATUS] No session found - not authenticated');
      return {
        authenticated: false,
        participant: null,
        is_admin: false
      };
    }

    console.log(`[AUTH_STATUS] Checking status for athlete ${stravaAthleteId}`);
    
    const participant = this.db.prepare(`
      SELECT p.strava_athlete_id, p.name,
             CASE WHEN pt.strava_athlete_id IS NOT NULL THEN 1 ELSE 0 END as is_connected
      FROM participant p
      LEFT JOIN participant_token pt ON p.strava_athlete_id = pt.strava_athlete_id
      WHERE p.strava_athlete_id = ?
    `).get(stravaAthleteId);
    
    console.log('[AUTH_STATUS] Found participant:', participant);
    
    // Check if user is admin
    const adminIds = this.getAdminAthleteIds();
    const isAdmin = adminIds.includes(stravaAthleteId);
    
    return {
      authenticated: true,
      participant: participant,
      is_admin: isAdmin
    };
  }

  /**
   * Disconnect user from Strava (delete tokens)
   * 
   * Note: Session destruction is handled by the route handler via req.session.destroy()
   * This service only handles token cleanup
   * 
   * @param {number} stravaAthleteId - Strava athlete ID
   * @returns {void}
   */
  disconnectStrava(stravaAthleteId) {
    console.log(`Disconnecting athlete ${stravaAthleteId} from Strava...`);
    
    // Delete tokens from database
    this.db.prepare('DELETE FROM participant_token WHERE strava_athlete_id = ?').run(stravaAthleteId);
    
    console.log(`Tokens deleted for athlete ${stravaAthleteId}`);
  }
}

module.exports = LoginService;
