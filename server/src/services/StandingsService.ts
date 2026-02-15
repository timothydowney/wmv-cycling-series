/**
 * StandingsService.ts
 *
 * Calculates season-level standings by aggregating weekly scoring results.
 */

import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { ScoringService } from './ScoringService';
import { week, segment } from '../db/schema';
import { eq } from 'drizzle-orm';
import { JerseyService } from './JerseyService';
import { getAthleteProfilePictures } from './StravaProfileService';

export interface StandingsEntry {
  participantId: string;
  name: string;
  totalPoints: number;
  weeksCompleted: number;
  polkadotWins: number;
  profilePictureUrl: string | null;
  rank: number;
}

export class StandingsService {
  private scoringService: ScoringService;
  private jerseyService: JerseyService;

  constructor(private db: BetterSQLite3Database) {
    this.scoringService = new ScoringService(db);
    this.jerseyService = new JerseyService(db);
  }

  /**
   * Get standings for a specific season.
   * @param options.includeProfilePictures - fetch Strava profile pictures (default: true). 
   *   Set to false for lightweight queries (e.g. chat tool calls) to avoid Strava token refreshes.
   */
  async getSeasonStandings(
    seasonId: number,
    options?: { includeProfilePictures?: boolean }
  ): Promise<StandingsEntry[]> {
    const includeProfilePictures = options?.includeProfilePictures ?? true;
    const weeks = await this.db
      .select({ 
        id: week.id,
        averageGrade: segment.average_grade
      })
      .from(week)
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .where(eq(week.season_id, seasonId))
      .all();

    const standingsMap = new Map<string, {
      participantId: string;
      name: string;
      totalPoints: number;
      weeksCompleted: number;
      polkadotWins: number;
    }>();

    // Calculate scoring for each week and aggregate
    for (const w of weeks) {
      const { results } = await this.scoringService.calculateWeekScoring(w.id);
      
      const isHillClimb = this.jerseyService.isHillClimbWeek(w.averageGrade);
      
      results.forEach((res, index) => {
        const existing = standingsMap.get(res.participantId);
        
        // Polka Dot win if rank 1 and hill climb
        const isWinner = index === 0;
        const polkaWin = (isHillClimb && isWinner) ? 1 : 0;

        if (existing) {
          existing.totalPoints += res.totalPoints;
          existing.weeksCompleted += 1;
          existing.polkadotWins += polkaWin;
        } else {
          standingsMap.set(res.participantId, {
            participantId: res.participantId,
            name: res.participantName,
            totalPoints: res.totalPoints,
            weeksCompleted: 1,
            polkadotWins: polkaWin,
          });
        }
      });
    }

    // Profile pictures require Strava token refreshes for every participant (~1.4s).
    // Skip when caller doesn't need them (e.g. chat tool calls).
    let profilePictures: Map<string, string | null> | null = null;
    if (includeProfilePictures) {
      const participantIds = Array.from(standingsMap.keys());
      profilePictures = await getAthleteProfilePictures(participantIds, this.db);
    }

    // Convert map to array and add pictures
    const standingsData = Array.from(standingsMap.values()).map((entry) => {
      return {
        ...entry,
        profilePictureUrl: profilePictures?.get(entry.participantId) || null,
      };
    });

    // Sort by points
    standingsData.sort(
      (a, b) => b.totalPoints - a.totalPoints || b.weeksCompleted - a.weeksCompleted
    );

    // Assign ranks and ensure return type matches StandingsEntry
    return standingsData.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    })) as StandingsEntry[];
  }

  /**
   * Get total participants in a season (members who have at least one qualifying result)
   */
  async getSeasonParticipantCount(seasonId: number): Promise<number> {
    const standings = await this.getSeasonStandings(seasonId);
    return standings.length;
  }
}
