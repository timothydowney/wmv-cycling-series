/**
 * ParticipantService.ts
 * Handles participant queries and connection status
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { participant, participantToken } from '../db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { Participant } from '../db/schema'; // Import Drizzle Participant type
import { getAthleteProfilePictures } from './StravaProfileService';

class ParticipantService {
  constructor(private db: BetterSQLite3Database) {}

  /**
   * Get all participants
   */
  getAllParticipants(): Participant[] {
    return this.db
      .select()
      .from(participant)
      .orderBy(asc(participant.name))
      .all();
  }

  /**
   * Get all participants with connection status
   * Shows whether each participant has connected their Strava account
   * Now async to fetch profile pictures
   */
  async getAllParticipantsWithStatus(): Promise<any[]> {
    const participants = this.db
      .select({
        strava_athlete_id: participant.strava_athlete_id,
        name: participant.name,
        has_token: sql<number>`CASE WHEN ${participantToken.strava_athlete_id} IS NOT NULL THEN 1 ELSE 0 END`,
        token_expires_at: participantToken.expires_at
      })
      .from(participant)
      .leftJoin(participantToken, eq(participant.strava_athlete_id, participantToken.strava_athlete_id))
      .orderBy(asc(participant.name))
      .all();

    // Fetch profile pictures for all athletes
    const athleteIds = participants.map(p => p.strava_athlete_id);
    const profilePictures = await getAthleteProfilePictures(athleteIds, (this.db as any).$client);

    return participants.map((p, index) => ({
      id: index + 1, // Generate an id for React keys
      strava_athlete_id: p.strava_athlete_id,
      name: p.name,
      is_connected: p.has_token,
      has_token: Boolean(p.has_token),
      token_expires_at: p.token_expires_at ? String(p.token_expires_at) : undefined,
      profile_picture_url: profilePictures.get(p.strava_athlete_id) || null
    }));
  }

  /**
   * Get a participant by Strava athlete ID
   */
  getParticipantByStravaAthleteId(stravaAthleteId: number): Participant | null {
    const result = this.db
      .select()
      .from(participant)
      .where(eq(participant.strava_athlete_id, stravaAthleteId))
      .get();
      
    return result || null;
  }
}

export default ParticipantService;