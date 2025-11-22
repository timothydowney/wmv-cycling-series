/**
 * ParticipantService.ts
 * Handles participant queries and connection status
 */

import { Database } from 'better-sqlite3';
import { getAthleteProfilePictures } from './StravaProfileService';

interface Participant {
  strava_athlete_id: number;
  name: string;
}

class ParticipantService {
  constructor(private db: Database) {}

  /**
   * Get all participants
   */
  getAllParticipants(): Participant[] {
    const participants = this.db
      .prepare('SELECT strava_athlete_id, name FROM participant ORDER BY name ASC')
      .all() as Participant[];
    return participants;
  }

  /**
   * Get all participants with connection status
   * Shows whether each participant has connected their Strava account
   * Now async to fetch profile pictures
   */
  async getAllParticipantsWithStatus(): Promise<any[]> {
    const participants = this.db
      .prepare(
        `SELECT 
          p.strava_athlete_id,
          p.name,
          CASE WHEN pt.strava_athlete_id IS NOT NULL THEN 1 ELSE 0 END as has_token,
          pt.expires_at as token_expires_at
        FROM participant p
        LEFT JOIN participant_token pt ON p.strava_athlete_id = pt.strava_athlete_id
        ORDER BY p.name ASC`
      )
      .all() as Array<{ strava_athlete_id: number; name: string; has_token: number; token_expires_at: number | null }>;

    // Fetch profile pictures for all athletes
    const athleteIds = participants.map(p => p.strava_athlete_id);
    const profilePictures = await getAthleteProfilePictures(athleteIds, this.db);

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
    const participant = this.db
      .prepare('SELECT strava_athlete_id, name FROM participant WHERE strava_athlete_id = ?')
      .get(stravaAthleteId) as Participant | undefined;
    return participant || null;
  }
}

export default ParticipantService;
