import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { participant } from '../db/schema';
import * as stravaClient from '../stravaClient';

/**
 * Capture and update athlete profile data from Strava
 * Fetches the athlete's profile and updates participant table with relevant fields
 * 
 * Currently captures:
 * - weight: Athlete's weight in kg
 * 
 * Future extensions can capture additional profile fields as needed
 * 
 * @param db Database connection
 * @param athleteId Strava athlete ID
 * @param accessToken Valid Strava access token
 * @returns Object with captured profile data (weight in kg or null if unavailable)
 */
export async function captureAthleteProfile(
  db: BetterSQLite3Database,
  athleteId: string,
  accessToken: string
): Promise<{ weight: number | null }> {
  try {
    const athleteProfile = await stravaClient.getAthleteProfile(athleteId, accessToken);
    const weight = athleteProfile?.weight || null;
    
    // Only update if weight is a valid positive number (Strava API returns 0 for missing weight)
    if (weight && weight > 0) {
      db.update(participant)
        .set({
          weight: weight,
          weight_updated_at: new Date().toISOString(),
        })
        .where(eq(participant.strava_athlete_id, athleteId))
        .run();
      
      console.log(`[StravaProfileCapture] Updated athlete ${athleteId}: weight=${weight}kg`);
    } else if (weight === 0) {
      console.debug(`[StravaProfileCapture] Athlete ${athleteId} has no weight set in Strava (value: 0)`);
    }
    
    return { weight: weight && weight > 0 ? weight : null };
  } catch (error) {
    console.warn(
      `[StravaProfileCapture] Could not fetch profile data for athlete ${athleteId}:`,
      error instanceof Error ? error.message : String(error)
    );
    return { weight: null };
  }
}
