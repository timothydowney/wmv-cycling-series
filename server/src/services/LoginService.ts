/**
 * LoginService.ts
 * Handles OAuth authentication flow, session management, and token storage
 */

import { Database } from 'better-sqlite3';
import { encryptToken, decryptToken } from '../encryption';
import * as stravaClient from '../stravaClient';

interface Participant {
  id: number;
  name: string;
  strava_athlete_id: number;
  is_connected: number;
}

interface AuthStatus {
  authenticated: boolean;
  participant: Participant | null;
  is_admin: boolean;
}

class LoginService {
  constructor(
    private db: Database,
    private getAdminAthleteIds: () => number[]
  ) {}

  /**
   * Exchange authorization code for tokens and create session
   * Called at GET /auth/strava/callback
   */
  async exchangeCodeAndCreateSession(code: string): Promise<{
    participantId: number;
    athleteId: number;
    athleteName: string;
    isAdmin: boolean;
  }> {
    // Exchange code for tokens with Strava
    const tokenData = await stravaClient.exchangeAuthorizationCode(code);
    
    const athlete = tokenData.athlete as Record<string, unknown>;
    const athleteId = athlete.id as number;
    const athleteName = `${athlete.firstname} ${athlete.lastname}`;

    // Find or create participant
    const participant = this.db
      .prepare('SELECT strava_athlete_id FROM participant WHERE strava_athlete_id = ?')
      .get(athleteId) as { strava_athlete_id: number } | undefined;

    if (!participant) {
      // Create new participant
      this.db
        .prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)')
        .run(athleteId, athleteName);
    } else {
      // Update name if changed
      this.db
        .prepare('UPDATE participant SET name = ? WHERE strava_athlete_id = ?')
        .run(athleteName, athleteId);
    }

    // Store encrypted tokens for this participant
    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = encryptToken(tokenData.refresh_token);

    this.db
      .prepare(
        `INSERT OR REPLACE INTO participant_token 
         (strava_athlete_id, access_token, refresh_token, expires_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(
        athleteId,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenData.expires_at
      );

    const adminIds = this.getAdminAthleteIds();
    const isAdmin = adminIds.includes(athleteId);

    return {
      participantId: athleteId,
      athleteId,
      athleteName,
      isAdmin
    };
  }

  /**
   * Get current authentication status
   */
  getAuthStatus(athleteId?: number): AuthStatus {
    if (!athleteId) {
      return { 
        authenticated: false,
        participant: null,
        is_admin: false
      };
    }

    const participant = this.db
      .prepare('SELECT name FROM participant WHERE strava_athlete_id = ?')
      .get(athleteId) as { name: string } | undefined;

    if (!participant) {
      return { 
        authenticated: false,
        participant: null,
        is_admin: false
      };
    }

    const adminIds = this.getAdminAthleteIds();
    const isAdmin = adminIds.includes(athleteId);
    
    // Debug logging
    console.log(`[LoginService:getAuthStatus] DEBUG: athleteId=${athleteId}, adminIds=[${adminIds.join(',')}], isAdmin=${isAdmin}`);

    return {
      authenticated: true,
      participant: {
        id: athleteId,
        name: participant.name,
        strava_athlete_id: athleteId,
        is_connected: 1
      },
      is_admin: isAdmin
    };
  }

  /**
   * Disconnect Strava account
   * Deletes tokens and invalidates session
   */
  disconnectStrava(athleteId: number): { message: string } {
    // Delete tokens for this athlete
    this.db.prepare('DELETE FROM participant_token WHERE strava_athlete_id = ?').run(athleteId);

    // Note: Session deletion is handled by route handler (session.destroy)

    return { message: 'Successfully disconnected from Strava' };
  }

  /**
   * Get valid access token for a participant (auto-refreshes if needed)
   * Used before making Strava API calls
   */
  async getValidAccessToken(
    db: Database,
    athleteId: number
  ): Promise<string> {
    const tokenRecord = db
      .prepare('SELECT access_token, refresh_token, expires_at FROM participant_token WHERE strava_athlete_id = ?')
      .get(athleteId) as
      | { access_token: string; refresh_token: string; expires_at: number }
      | undefined;

    if (!tokenRecord) {
      throw new Error('Participant not connected to Strava');
    }

    const now = Math.floor(Date.now() / 1000);

    // Token expires in less than 1 hour? Refresh proactively
    if (tokenRecord.expires_at < now + 3600) {
      console.log(`Token expiring soon for athlete ${athleteId}, refreshing...`);

      // Decrypt refresh token
      const refreshToken = decryptToken(tokenRecord.refresh_token);

      // Request new tokens from Strava
      const newTokenData = await stravaClient.refreshAccessToken(refreshToken);

      // Encrypt new tokens
      const encryptedAccessToken = encryptToken(newTokenData.access_token);
      const encryptedRefreshToken = encryptToken(newTokenData.refresh_token);

      // Update database
      db.prepare(
        `UPDATE participant_token 
         SET access_token = ?, refresh_token = ?, expires_at = ?
         WHERE strava_athlete_id = ?`
      ).run(encryptedAccessToken, encryptedRefreshToken, newTokenData.expires_at, athleteId);

      return newTokenData.access_token;
    }

    // Decrypt and return existing token
    return decryptToken(tokenRecord.access_token);
  }
}

export default LoginService;
