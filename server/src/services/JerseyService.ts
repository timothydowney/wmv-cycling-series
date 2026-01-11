/**
 * JerseyService.ts
 *
 * Centralizes jersey calculations for season leaderboards and profile pages.
 * Provides reusable methods for computing jersey winners and stats.
 *
 * Jersey Rules:
 * - Hill Climb Week: average_grade > 2%
 *   - Winner gets Polka Dot jersey for that week
 * - Time Trial (TT) Week: average_grade ≤ 2%
 *   - Winner gets Yellow jersey for that week
 * - Season Polka Dot: Won by participant with most hill climb week wins
 * - Season Yellow: Won by participant with most total points
 */

import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { week, segment, result } from '../db/schema';
import { calculateWeekScoringDrizzle } from './ScoringServiceDrizzle';

export class JerseyService {
  constructor(private db: BetterSQLite3Database) {}

  /**
   * Check if a week is hill climb eligible for polka dot jersey
   * @param averageGrade - Grade percentage from segment
   * @returns true if averageGrade > 2%
   */
  isHillClimbWeek(averageGrade: number | null): boolean {
    return (averageGrade || 0) > 2;
  }

  /**
   * Check if a week is a time trial week (not a hill climb)
   * @param averageGrade - Grade percentage from segment
   * @returns true if averageGrade ≤ 2%
   */
  isTimeTrialWeek(averageGrade: number | null): boolean {
    return (averageGrade || 0) <= 2;
  }

  /**
   * Get polka dot jersey winner for a season
   * (participant with most week wins on hill climb weeks)
   *
   * @param seasonId - Season to calculate for
   * @returns { name, strava_athlete_id, polka_dot_wins } or null if no winner
   */
  async getPolkaDotWinner(seasonId: number) {
    // Get all weeks in season with their segment info
    const weeksWithGrades = await this.db
      .select({
        week_id: week.id,
        average_grade: segment.average_grade,
      })
      .from(week)
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .where(eq(week.season_id, seasonId))
      .all();

    // Filter to hill climb weeks
    const hillClimbWeeks = weeksWithGrades.filter(w =>
      this.isHillClimbWeek(w.average_grade)
    );

    if (hillClimbWeeks.length === 0) {
      return null; // No hill climb weeks
    }

    // Track polka dot wins per participant
    const polkaDotStats = new Map<
      string,
      { name: string; polka_dot_wins: number }
    >();

    // For each hill climb week, find the winner
    for (const hcWeek of hillClimbWeeks) {
      // Calculate week scoring to get rank 1
      const weekScoring = await calculateWeekScoringDrizzle(this.db, hcWeek.week_id);

      if (weekScoring.results.length > 0) {
        // First result is rank 1 (already sorted by time in calculateWeekScoringDrizzle)
        const winner = weekScoring.results[0];
        const existing = polkaDotStats.get(winner.participantId);

        if (existing) {
          polkaDotStats.set(winner.participantId, {
            name: existing.name,
            polka_dot_wins: existing.polka_dot_wins + 1,
          });
        } else {
          polkaDotStats.set(winner.participantId, {
            name: winner.participantName,
            polka_dot_wins: 1,
          });
        }
      }
    }

    // Return winner (most polka dot wins)
    let topWinner = null;
    let maxWins = 0;

    for (const [athleteId, stats] of polkaDotStats) {
      if (stats.polka_dot_wins > maxWins) {
        maxWins = stats.polka_dot_wins;
        topWinner = {
          strava_athlete_id: athleteId,
          name: stats.name,
          polka_dot_wins: stats.polka_dot_wins,
        };
      }
    }

    return topWinner;
  }

  /**
   * Get polka dot wins for a specific participant in a season
   * (how many hill climb weeks they won)
   *
   * @param seasonId - Season to calculate for
   * @param participantId - Participant to check
   * @returns Number of hill climb week wins
   */
  async getParticipantPolkaDotWins(seasonId: number, participantId: string) {
    // Get all weeks in season with their segment info
    const weeksWithGrades = await this.db
      .select({
        week_id: week.id,
        average_grade: segment.average_grade,
      })
      .from(week)
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .where(eq(week.season_id, seasonId))
      .all();

    // Filter to hill climb weeks
    const hillClimbWeeks = weeksWithGrades.filter(w =>
      this.isHillClimbWeek(w.average_grade)
    );

    if (hillClimbWeeks.length === 0) {
      return 0; // No hill climb weeks
    }

    let polkaDotWins = 0;

    // For each hill climb week, check if participant is rank 1
    for (const hcWeek of hillClimbWeeks) {
      const weekScoring = await calculateWeekScoringDrizzle(this.db, hcWeek.week_id);

      // Check if this participant is rank 1
      if (weekScoring.results.length > 0) {
        const winner = weekScoring.results[0];
        if (winner.participantId === participantId) {
          polkaDotWins++;
        }
      }
    }

    return polkaDotWins;
  }

  /**
   * Get yellow jersey winner for a season
   * (participant with most total points)
   *
   * @param seasonId - Season to calculate for
   * @returns { name, strava_athlete_id, total_points } or null if no results
   */
  async getYellowJerseyWinner(seasonId: number) {
    // Get all results for this season
    const allResults = await this.db
      .select()
      .from(result)
      .all();

    if (allResults.length === 0) {
      return null; // No results in database
    }

    // Get all weeks to filter by season
    const allWeeks = await this.db
      .select()
      .from(week)
      .where(eq(week.season_id, seasonId))
      .all();

    const weekIds = new Set(allWeeks.map(w => w.id));

    // Filter results to only this season
    const seasonResults = allResults.filter(r => weekIds.has(r.week_id));

    if (seasonResults.length === 0) {
      return null; // No results in this season
    }

    // Sum points per participant using calculateWeekScoringDrizzle
    const pointsByParticipant = new Map<string, { name: string; total_points: number }>();

    for (const weekId of weekIds) {
      const weekScoring = await calculateWeekScoringDrizzle(this.db, weekId);
      
      for (const result of weekScoring.results) {
        const athleteId = result.participantId;
        const points = result.basePoints + result.participationBonus + result.prBonusPoints;
        const existing = pointsByParticipant.get(athleteId);

        if (existing) {
          pointsByParticipant.set(athleteId, {
            name: existing.name,
            total_points: existing.total_points + points,
          });
        } else {
          pointsByParticipant.set(athleteId, {
            name: result.participantName,
            total_points: points,
          });
        }
      }
    }

    // Find winner (most total points)
    let topWinner = null;
    let maxPoints = -1;

    for (const [athleteId, stats] of pointsByParticipant) {
      if (stats.total_points > maxPoints) {
        maxPoints = stats.total_points;
        topWinner = {
          strava_athlete_id: athleteId,
          name: stats.name,
          total_points: stats.total_points,
        };
      }
    }

    return topWinner;
  }

  /**
   * Get yellow jersey wins for a specific participant
   * (count of seasons where they won overall/had most points)
   *
   * @param participantId - Participant to check
   * @param seasonIds - List of closed season IDs to check
   * @returns Number of seasons they won
   */
  async getParticipantYellowJerseyWins(
    participantId: string,
    seasonIds: number[]
  ): Promise<number> {
    let yellowWins = 0;

    for (const seasonId of seasonIds) {
      const winner = await this.getYellowJerseyWinner(seasonId);
      if (winner && winner.strava_athlete_id === participantId) {
        yellowWins++;
      }
    }

    return yellowWins;
  }

  /**
   * Get time trial wins for a specific participant in a season
   * (count of TT weeks they won - weeks with grade ≤ 2%)
   *
   * @param seasonId - Season to calculate for
   * @param participantId - Participant to check
   * @returns Number of TT week wins
   */
  async getParticipantTimeTrialWins(
    seasonId: number,
    participantId: string
  ): Promise<number> {
    // Get all weeks in season with their segment info
    const weeksWithGrades = await this.db
      .select({
        week_id: week.id,
        average_grade: segment.average_grade,
      })
      .from(week)
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .where(eq(week.season_id, seasonId))
      .all();

    // Filter to TT weeks (not hill climbs)
    const timeTrialWeeks = weeksWithGrades.filter(w =>
      this.isTimeTrialWeek(w.average_grade)
    );

    if (timeTrialWeeks.length === 0) {
      return 0; // No TT weeks
    }

    let timeTrialWins = 0;

    // For each TT week, check if participant is rank 1
    for (const ttWeek of timeTrialWeeks) {
      const weekScoring = await calculateWeekScoringDrizzle(this.db, ttWeek.week_id);

      // Check if this participant is rank 1
      if (weekScoring.results.length > 0) {
        const winner = weekScoring.results[0];
        if (winner.participantId === participantId) {
          timeTrialWins++;
        }
      }
    }

    return timeTrialWins;
  }
}
