import { drizzleDb as db } from '../db';
import { activity, participant, result, segmentEffort } from '../db/schema';
import { eq, max, sql } from 'drizzle-orm';

export interface ScoringResult {
  participantId: number;
  participantName: string;
  rank: number;
  totalTimeSeconds: number;
  basePoints: number;
  prBonusPoints: number;
  totalPoints: number;
}

export interface LeaderboardResult {
  weekId: number;
  results: ScoringResult[];
}

/**
 * Calculate scoring for a week's leaderboard using Drizzle ORM
 */
export async function calculateWeekScoringDrizzle(
  weekId: number
): Promise<LeaderboardResult> {
  // Get all results for the week, sorted by time
  const rawResults = await db
    .select({
      id: result.id,
      strava_athlete_id: result.strava_athlete_id,
      participant_name: participant.name,
      total_time_seconds: result.total_time_seconds,
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

  // Calculate scoring
  const totalParticipants = rawResults.length;
  const scoredResults: ScoringResult[] = rawResults.map((res: typeof rawResults[0], index: number) => {
    const rank = index + 1;
    const basePoints = totalParticipants - rank + 1;
    const prBonusPoints = res.pr_achieved && Number(res.pr_achieved) > 0 ? 1 : 0;
    const totalPoints = basePoints + prBonusPoints;

    return {
      participantId: res.strava_athlete_id,
      participantName: res.participant_name || 'Unknown', // Participant name might be null if no participant joined
      rank,
      totalTimeSeconds: res.total_time_seconds,
      basePoints,
      prBonusPoints,
      totalPoints,
    };
  });

  return { weekId, results: scoredResults };
}
