/**
 * ProfileService.ts
 *
 * Provides personal stats, participation history, and jersey wins for athletes.
 */

import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { participant, season, participantToken } from '../db/schema';
import { StandingsService } from './StandingsService';
import { JerseyService } from './JerseyService';
import { getAthleteProfilePictures } from './StravaProfileService';

export interface ProfileSeasonStats {
  seasonId: number;
  seasonName: string;
  isActive: number | null;
  totalPoints: number;
  weeksParticipated: number;
  seasonRank: number;
  totalSeasonParticipants: number;
  yellowJerseyWon: boolean;
  polkaDotJerseyWon: boolean;
  polkaDotWins: number;
  timeTrialWins: number;
}

export interface ProfileData {
  athleteId: string;
  name: string;
  profilePictureUrl?: string;
  isConnected: boolean;
  seasonStats: ProfileSeasonStats[];
}

export class ProfileService {
  private standingsService: StandingsService;
  private jerseyService: JerseyService;

  constructor(private db: BetterSQLite3Database) {
    this.standingsService = new StandingsService(db);
    this.jerseyService = new JerseyService(db);
  }

  /**
   * Get detailed profile data for an athlete, including stats for all seasons they participated in.
   */
  async getAthleteProfile(athleteId: string): Promise<ProfileData | null> {
    // 1. Get user info
    const p = await this.db
      .select()
      .from(participant)
      .where(eq(participant.strava_athlete_id, athleteId))
      .get();

    if (!p) return null;

    // Check connection status
    const token = await this.db
      .select({ id: participantToken.strava_athlete_id })
      .from(participantToken)
      .where(eq(participantToken.strava_athlete_id, athleteId))
      .get();

    // 2. Hydrate all season standings - batch optimization
    // Rather than season-by-season, we can potentially look across all season standings
    // but right now StandingsService is built season-by-season.
    // Let's optimize by only checking seasons that exist.
    const seasons = await this.db.select().from(season).orderBy(season.id).all();
    const seasonStats: ProfileSeasonStats[] = [];

    for (const s of seasons) {
      const standings = await this.standingsService.getSeasonStandings(s.id);
      const athleteStanding = standings.find(entry => entry.participantId === athleteId);

      if (athleteStanding) {
        // Athlete participated in this season
        let yellowJerseyWon = false;
        let polkaDotJerseyWon = false;

        // Only check "closed" season winners or current season if needed
        // For simplicity with the existing logic:
        if (!s.is_active) {
          const yellowWinner = await this.jerseyService.getYellowJerseyWinner(s.id);
          yellowJerseyWon = yellowWinner?.strava_athlete_id === athleteId;

          const polkaDotWinner = await this.jerseyService.getPolkaDotWinner(s.id);
          polkaDotJerseyWon = polkaDotWinner?.strava_athlete_id === athleteId;
        }

        // Win counts
        const polkaDotWins = await this.jerseyService.getParticipantPolkaDotWins(s.id, athleteId);
        const timeTrialWins = await this.jerseyService.getParticipantTimeTrialWins(s.id, athleteId);

        seasonStats.push({
          seasonId: s.id,
          seasonName: s.name,
          isActive: s.is_active,
          totalPoints: athleteStanding.totalPoints,
          weeksParticipated: athleteStanding.weeksCompleted,
          seasonRank: athleteStanding.rank || 0,
          totalSeasonParticipants: standings.length,
          yellowJerseyWon,
          polkaDotJerseyWon,
          polkaDotWins,
          timeTrialWins,
        });
      }
    }

    // 3. Hydrate profile picture
    const profilePictures = await getAthleteProfilePictures([athleteId], this.db);

    return {
      athleteId,
      name: p.name || 'Unknown',
      profilePictureUrl: profilePictures.get(athleteId) || undefined,
      isConnected: !!token,
      seasonStats,
    };
  }
}
