/**
 * Token Manager - OAuth token lifecycle management
 * Handles token storage, retrieval, decryption, and refresh
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { participantToken } from './db/schema';
import { eq } from 'drizzle-orm';
import { decryptToken, encryptToken } from './encryption';

/**
 * Token record from the database
 */
interface TokenRecord {
  strava_athlete_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * New token data from Strava API refresh
 */
interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

/**
 * Strava client interface
 */
interface StravaClient {
  refreshAccessToken(refreshToken: string): Promise<TokenData>;
}

/**
 * Get a valid access token for a participant, refreshing if needed (Drizzle)
 * Canonical method name retained: getValidAccessToken
 * @param db - Drizzle database instance
 * @param stravaClient - Strava API client
 * @param stravaAthleteId - The participant's Strava athlete ID
 * @param forceRefresh - Whether to force a refresh even if valid
 * @returns Valid access token
 */
async function getValidAccessToken(
  db: BetterSQLite3Database,
  stravaClient: StravaClient,
  stravaAthleteId: number,
  forceRefresh: boolean = false
): Promise<string> {
  const tokenRecord = db
    .select()
    .from(participantToken)
    .where(eq(participantToken.strava_athlete_id, stravaAthleteId))
    .get();

  if (!tokenRecord) {
    throw new Error('Participant not connected to Strava');
  }

  // Decrypt the stored refresh token (for checking expiry and refresh)
  let refreshToken = tokenRecord.refresh_token;
  try {
    refreshToken = decryptToken(tokenRecord.refresh_token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Failed to decrypt refresh token for ${stravaAthleteId}. May be plaintext from before encryption: ${message}`
    );
    // If decryption fails, assume it's plaintext (migration case)
  }

  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp

  // Token expires in less than 1 hour? OR force refresh requested?
  if (forceRefresh || tokenRecord.expires_at < now + 3600) {
    console.log(
      `Token ${forceRefresh ? 'force refresh' : 'expiring soon'} for participant ${stravaAthleteId}, refreshing...`
    );

    try {
      // Use stravaClient to refresh the token
      const newTokenData = await stravaClient.refreshAccessToken(refreshToken);

      // Update database with NEW tokens (both access and refresh tokens change!)
      // Store encrypted
      db
        .update(participantToken)
        .set({
          access_token: encryptToken(newTokenData.access_token),
          refresh_token: encryptToken(newTokenData.refresh_token),
          expires_at: newTokenData.expires_at,
          updated_at: new Date().toISOString()
        })
        .where(eq(participantToken.strava_athlete_id, stravaAthleteId))
        .run();

      // Return the plaintext access token (kept in memory for use)
      return newTokenData.access_token;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to refresh token: ${message}`);
    }
  }

  // Token still valid, decrypt and return it
  try {
    const accessToken = decryptToken(tokenRecord.access_token);
    return accessToken;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Failed to decrypt access token for ${stravaAthleteId}. May be plaintext from before encryption: ${message}`
    );
    // If decryption fails, assume it's plaintext (migration case)
    return tokenRecord.access_token;
  }
}
export { getValidAccessToken, type TokenRecord, type TokenData, type StravaClient };
