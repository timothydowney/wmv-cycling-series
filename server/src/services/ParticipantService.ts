/**
 * ParticipantService.ts
 * Handles participant queries and connection status
 */

import type { AppDatabase } from '../db/types';
import { participant, participantToken } from '../db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { Participant } from '../db/schema'; // Import Drizzle Participant type
import { exec, getMany, getOne } from '../db/asyncQuery';
import { getAthleteProfilePictures } from './StravaProfileService';

class ParticipantService {
  constructor(private db: AppDatabase) {}

  /**
   * Get all participants
   */
  async getAllParticipants(): Promise<Participant[]> {
    return getMany<Participant>(
      this.db
        .select()
        .from(participant)
        .orderBy(asc(participant.name))
    );
  }

  /**
   * Get all participants with connection status
   * Shows whether each participant has connected their Strava account
   * Now async to fetch profile pictures
   */
  async getAllParticipantsWithStatus(): Promise<any[]> {
    const participants = await getMany<{
      strava_athlete_id: string;
      name: string;
      is_admin: boolean;
      has_token: number;
      token_expires_at: number | null;
    }>(
      this.db
        .select({
          strava_athlete_id: participant.strava_athlete_id,
          name: participant.name,
          is_admin: participant.is_admin,
          has_token: sql<number>`CASE WHEN ${participantToken.strava_athlete_id} IS NOT NULL THEN 1 ELSE 0 END`,
          token_expires_at: participantToken.expires_at
        })
        .from(participant)
        .leftJoin(participantToken, eq(participant.strava_athlete_id, participantToken.strava_athlete_id))
        .orderBy(asc(participant.name))
    );

    // Fetch profile pictures for all athletes
    const athleteIds = participants.map(p => p.strava_athlete_id);
    const profilePictures = await getAthleteProfilePictures(athleteIds, this.db);

    return participants.map((p, index) => ({
      id: index + 1, // Generate an id for React keys
      strava_athlete_id: p.strava_athlete_id,
      name: p.name,
      is_admin: Boolean(p.is_admin),
      is_connected: p.has_token,
      has_token: Boolean(p.has_token),
      token_expires_at: p.token_expires_at ? String(p.token_expires_at) : undefined,
      profile_picture_url: profilePictures.get(p.strava_athlete_id) || null
    }));
  }

  async setParticipantAdminStatus(stravaAthleteId: string, isAdmin: boolean): Promise<void> {
    const existingParticipant = await this.getParticipantByStravaAthleteId(stravaAthleteId);

    if (!existingParticipant) {
      throw new Error('Participant not found');
    }

    await exec(
      this.db
        .update(participant)
        .set({ is_admin: isAdmin })
        .where(eq(participant.strava_athlete_id, stravaAthleteId))
    );
  }

  /**
   * Get a participant by Strava athlete ID
   */
  async getParticipantByStravaAthleteId(stravaAthleteId: string): Promise<Participant | null> {
    const result = await getOne<Participant>(
      this.db
        .select()
        .from(participant)
        .where(eq(participant.strava_athlete_id, stravaAthleteId))
    );

    return result || null;
  }
}

export default ParticipantService;