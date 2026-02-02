/**
 * ScoringService.ts
 *
 * Centralizes the scoring logic for the competition.
 * Calculates rank, points, and bonuses for participants in a given week.
 */

import { activity, participant, result, segmentEffort, week } from '../db/schema';
import { eq, max, sql } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { getAthleteProfilePictures } from './StravaProfileService';

export interface ScoringResult {
  participantId: string;
  participantName: string;
  profilePictureUrl?: string | null;
  rank: number;
  totalTimeSeconds: number;
  basePoints: number;
  participationBonus: number;
  prBonusPoints: number;
  multiplier: number;
  totalPoints: number;
  // Optional metadata useful for leaderboard display
  activityId?: number | null;
  stravaActivityId?: string | null;
  activityStartAt?: number | null;
  deviceName?: string | null;
  athleteWeight?: number | null;  // Weight in kg from activity (Strava API format)
}

export interface LeaderboardResult {
  weekId: number;
  results: ScoringResult[];
}

export class ScoringService {
  constructor(private db: BetterSQLite3Database) {}

  /**
   * Calculate scoring for a week's leaderboard.
   * Applies multiplier to all scoring components: (basePoints + participationBonus + prBonusPoints) * multiplier
   */
  async calculateWeekScoring(weekId: number): Promise<LeaderboardResult> {
    // Get week multiplier
    const weekData = await this.db
      .select({ multiplier: week.multiplier })
      .from(week)
      .where(eq(week.id, weekId))
      .get();

    const multiplier = weekData?.multiplier ?? 1;

    // Get all results for the week, sorted by time
    const rawResults = await this.db
      .select({
        resultId: result.id,
        strava_athlete_id: result.strava_athlete_id,
        participant_name: participant.name,
        total_time_seconds: result.total_time_seconds,
        activity_id: result.activity_id,
        strava_activity_id: activity.strava_activity_id,
        activity_start_at: activity.start_at,
        device_name: activity.device_name,
        athlete_weight: activity.athlete_weight,  // Weight in kg (Strava API format)
        pr_achieved: max(sql<number>`case when ${segmentEffort.pr_achieved} = 1 then 1 else 0 end`).as('pr_achieved'),
      })
      .from(result)
      .leftJoin(participant, eq(result.strava_athlete_id, participant.strava_athlete_id))
      .leftJoin(activity, eq(result.activity_id, activity.id))
      .leftJoin(segmentEffort, eq(activity.id, segmentEffort.activity_id))
      .where(eq(result.week_id, weekId))
      .groupBy(result.strava_athlete_id, result.id, participant.name, result.total_time_seconds)
      .orderBy(result.total_time_seconds)
      .all();

    if (rawResults.length === 0) {
      return { weekId, results: [] };
    }

    const totalParticipants = rawResults.length;

    // Fetch profile pictures for all participants
    const participantIds = rawResults.map(r => r.strava_athlete_id);
    const profilePictures = await getAthleteProfilePictures(participantIds, this.db);

    const scoredResults: ScoringResult[] = rawResults.map((res, index) => {
      const rank = index + 1;
      // basePoints = number of participants beaten = (total - rank)
      const basePoints = totalParticipants - rank;
      const participationBonus = 1; // Always 1 point for participating
      const prBonusPoints = res.pr_achieved && Number(res.pr_achieved) > 0 ? 1 : 0;
      
      const subtotal = basePoints + participationBonus + prBonusPoints;
      const totalPoints = subtotal * multiplier;

      return {
        participantId: res.strava_athlete_id,
        participantName: res.participant_name || 'Unknown',
        profilePictureUrl: profilePictures.get(res.strava_athlete_id) || null,
        rank,
        totalTimeSeconds: res.total_time_seconds,
        basePoints,
        participationBonus,
        prBonusPoints,
        multiplier,
        totalPoints,
        activityId: res.activity_id,
        stravaActivityId: res.strava_activity_id,
        activityStartAt: res.activity_start_at,
        deviceName: res.device_name,
        athleteWeight: res.athlete_weight,  // Weight in kg from activity (Strava API format)
      };
    });

    return { weekId, results: scoredResults };
  }
}

/**
 * @deprecated Use ScoringService class instead
 */
export async function calculateWeekScoring(
  drizzleDb: BetterSQLite3Database,
  weekId: number
): Promise<LeaderboardResult> {
  const service = new ScoringService(drizzleDb);
  return service.calculateWeekScoring(weekId);
}
