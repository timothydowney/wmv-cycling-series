/**
 * LoginService.ts
 * Handles OAuth authentication flow, session management, and token storage
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { participant, participantToken } from '../db/schema';
import { encryptToken, decryptToken } from '../encryption';
import * as stravaClient from '../stravaClient';
import { getAthleteProfilePicture } from './StravaProfileService';

interface ParticipantData {
  strava_athlete_id: number;
  name: string;
  is_connected: boolean;
  profile_picture_url?: string | null;
}

interface AuthStatus {
  authenticated: boolean;
  participant: ParticipantData | null;
  is_admin: boolean;
}

class LoginService {
  constructor(
    private drizzleDb: BetterSQLite3Database,
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

    // Find or create participant using Drizzle
    const existingParticipant = this.drizzleDb
      .select({ strava_athlete_id: participant.strava_athlete_id })
      .from(participant)
      .where(eq(participant.strava_athlete_id, athleteId))
      .get();

    console.log(`[LOGIN] Looking for participant ${athleteId}: found =`, !!existingParticipant);

    if (!existingParticipant) {
      // Create new participant
      console.log(`[LOGIN] Creating new participant ${athleteId}: ${athleteName}`);
      this.drizzleDb.insert(participant).values({
        strava_athlete_id: athleteId,
        name: athleteName
      }).run();
    } else {
      // Update name if changed
      console.log(`[LOGIN] Updating existing participant ${athleteId}: ${athleteName}`);
      this.drizzleDb
        .update(participant)
        .set({ name: athleteName })
        .where(eq(participant.strava_athlete_id, athleteId))
        .run();
    }

    // Store encrypted tokens for this participant
    const encryptedAccessToken = encryptToken(tokenData.access_token);
    const encryptedRefreshToken = encryptToken(tokenData.refresh_token);

    this.drizzleDb
      .insert(participantToken)
      .values({
        strava_athlete_id: athleteId,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        expires_at: tokenData.expires_at
      })
      .onConflictDoUpdate({
        target: participantToken.strava_athlete_id,
        set: {
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          expires_at: tokenData.expires_at
        }
      })
      .run();

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
  async getAuthStatus(athleteId?: number): Promise<AuthStatus> {
    if (!athleteId) {
      return { 
        authenticated: false,
        participant: null,
        is_admin: false
      };
    }

    const participantData = this.drizzleDb
      .select({ name: participant.name, strava_athlete_id: participant.strava_athlete_id })
      .from(participant)
      .where(eq(participant.strava_athlete_id, athleteId))
      .get();

    console.log(`[LOGIN] getAuthStatus for athlete ${athleteId}: participant data =`, participantData);

    if (!participantData) {
      console.log(`[LOGIN] Participant not found for athlete ${athleteId}`);
      return { 
        authenticated: false,
        participant: null,
        is_admin: false
      };
    }

    // Check if participant has valid tokens
    const tokenCheck = this.drizzleDb
      .select({ strava_athlete_id: participantToken.strava_athlete_id })
      .from(participantToken)
      .where(eq(participantToken.strava_athlete_id, athleteId))
      .get();

    const adminIds = this.getAdminAthleteIds();
    const isAdmin = adminIds.includes(athleteId);

    let profilePictureUrl: string | null = null;
    if (tokenCheck) {
      try {
        const accessToken = await this.getValidAccessToken(athleteId);
        profilePictureUrl = await getAthleteProfilePicture(athleteId, accessToken);
      } catch (error) {
        console.warn(`[LOGIN] Failed to fetch profile picture for athlete ${athleteId}:`, error);
      }
    }

    return {
      authenticated: true,
      participant: {
        name: participantData.name,
        strava_athlete_id: participantData.strava_athlete_id,
        is_connected: !!tokenCheck,
        profile_picture_url: profilePictureUrl
      },
      is_admin: isAdmin
    };
  }

  /**
   * Disconnect Strava account
   * Deletes tokens and invalidates session
   */
  disconnectStrava(athleteId: number): { message: string } {
    // Delete tokens for this athlete using Drizzle
    this.drizzleDb
      .delete(participantToken)
      .where(eq(participantToken.strava_athlete_id, athleteId))
      .run();

    // Note: Session deletion is handled by route handler (session.destroy)

    return { message: 'Successfully disconnected from Strava' };
  }

  /**
   * Get valid access token for a participant (auto-refreshes if needed)
   * Used before making Strava API calls
   */
  async getValidAccessToken(
    athleteId: number
  ): Promise<string> {
    const tokenRecord = this.drizzleDb
      .select({
        access_token: participantToken.access_token,
        refresh_token: participantToken.refresh_token,
        expires_at: participantToken.expires_at
      })
      .from(participantToken)
      .where(eq(participantToken.strava_athlete_id, athleteId))
      .get();

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

      // Update database using Drizzle
      this.drizzleDb
        .update(participantToken)
        .set({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          expires_at: newTokenData.expires_at
        })
        .where(eq(participantToken.strava_athlete_id, athleteId))
        .run();

      return newTokenData.access_token;
    }

    // Decrypt and return existing token
    return decryptToken(tokenRecord.access_token);
  }
}

export default LoginService;
