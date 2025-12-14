import { router, publicProcedure } from './init';
import { z } from 'zod';
import { week, result, participant, activity, segmentEffort } from '../db/schema';
import { eq } from 'drizzle-orm';
import { calculateWeekScoringDrizzle } from '../services/ScoringServiceDrizzle';
import { getAthleteProfilePictures } from '../services/StravaProfileService';
import { LeaderboardEntryWithDetails } from './types';

// Helper to format seconds into HH:MM:SS or MM:SS
function formatSecondsToHHMMSS(totalSeconds: number | null): string {
  if (totalSeconds === null || isNaN(totalSeconds)) {
    return '00:00';
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds - (hours * 3600)) / 60);
  const seconds = totalSeconds - (hours * 3600) - (minutes * 60);

  const parts = [];
  if (hours > 0) {
    parts.push(hours.toString());
  }
  parts.push(minutes.toString().padStart(2, '0'));
  parts.push(seconds.toString().padStart(2, '0'));

  return parts.join(':');
}

export const leaderboardRouter = router({
  getWeekLeaderboard: publicProcedure
    .input(z.object({ weekId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { orm: drizzleDb } = ctx; // Prefer canonical `orm` alias (same instance)

      const weekData = await drizzleDb.select({
        id: week.id,
        season_id: week.season_id,
        week_name: week.week_name,
        strava_segment_id: week.strava_segment_id,
        required_laps: week.required_laps,
        start_at: week.start_at,
        end_at: week.end_at,
        notes: week.notes,
      })
        .from(week)
        .where(eq(week.id, input.weekId))
        .get();

      if (!weekData) {
        throw new Error(`Week ${input.weekId} not found`);
      }

      // Fetch results with participant and activity details
      // Rank and points are NOT stored in DB, so we must fetch raw data and calculate them
      const rawResults = await drizzleDb.select({
        // Result fields
        id: result.id,
        week_id: result.week_id,
        participant_id: result.strava_athlete_id, // use strava_athlete_id as participant_id
        total_time_seconds: result.total_time_seconds,
        
        // Participant fields
        name: participant.name,
        // profile_picture_url is not in the schema shown in schema.ts, removing to avoid error
        // If it exists in DB but not schema, we need to add it to schema.ts. 
        // For now, assuming schema.ts is source of truth.
        
        // Activity fields
        activity_id: result.activity_id,
        strava_activity_id: activity.strava_activity_id,
        activity_start_at: activity.start_at,
        device_name: activity.device_name,
        
        // PR info (calculated via subquery or just checking segment efforts later)
        // For now, we'll fetch efforts per row to be safe and accurate
      })
        .from(result)
        .leftJoin(participant, eq(result.strava_athlete_id, participant.strava_athlete_id))
        .leftJoin(activity, eq(result.activity_id, activity.id))
        .where(eq(result.week_id, input.weekId))
        .orderBy(result.total_time_seconds)
        .all();

      const totalParticipants = rawResults.length;

      // Fetch profile pictures for all participants in this leaderboard
      const participantIds = rawResults
        .map(r => r.participant_id)
        .filter(id => id !== null) as number[];
      
      const profilePictures = await getAthleteProfilePictures(
        participantIds,
        drizzleDb
      );

      const leaderboardEntries: LeaderboardEntryWithDetails[] = await Promise.all(
        rawResults.map(async (rawResult, index) => {
          // Calculate Rank and Points
          const rank = index + 1;
          const basePoints = totalParticipants - rank + 1;
          
          let prBonusPoints = 0;
          let effortBreakdown: any[] = [];

          if (rawResult.activity_id) {
            const efforts = await drizzleDb.select({
              lap: segmentEffort.effort_index,
              time_seconds: segmentEffort.elapsed_seconds,
              pr_achieved: segmentEffort.pr_achieved,
              strava_effort_id: segmentEffort.strava_effort_id,
            })
              .from(segmentEffort)
              .where(eq(segmentEffort.activity_id, rawResult.activity_id))
              .orderBy(segmentEffort.effort_index)
              .all();
            
            // Check for PR
            const hasPr = efforts.some(e => e.pr_achieved === 1);
            if (hasPr) {
              prBonusPoints = 1;
            }

            effortBreakdown = efforts.map(e => ({
              lap: e.lap + 1, // 0-based index to 1-based lap
              time_seconds: e.time_seconds,
              time_hhmmss: formatSecondsToHHMMSS(e.time_seconds),
              is_pr: e.pr_achieved === 1,
              strava_effort_id: e.strava_effort_id ? Number(e.strava_effort_id) : undefined
            }));
          }

          const totalPoints = basePoints + prBonusPoints;

          return {
            rank: rank,
            participant_id: rawResult.participant_id,
            name: rawResult.name || 'Unknown',
            profile_picture_url: profilePictures.get(rawResult.participant_id) || null,
            total_time_seconds: rawResult.total_time_seconds || 0,
            time_hhmmss: formatSecondsToHHMMSS(rawResult.total_time_seconds),
            points: totalPoints,
            pr_bonus_points: prBonusPoints,
            activity_url: rawResult.strava_activity_id
              ? `https://www.strava.com/activities/${rawResult.strava_activity_id}`
              : '',
            activity_date: rawResult.activity_start_at
              ? new Date(rawResult.activity_start_at * 1000).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
              : '',
            // Only show effort breakdown if more than 1 lap required
            effort_breakdown: weekData.required_laps > 1 && effortBreakdown.length > 0 ? effortBreakdown : null,
            device_name: rawResult.device_name,
          };
        })
      );
      
      // Construct the Week object expected by frontend
      // We use the data we fetched from 'week' table
      const frontendWeekData = {
        id: weekData.id,
        season_id: weekData.season_id,
        week_name: weekData.week_name,
        segment_id: weekData.strava_segment_id, // Frontend legacy prop
        strava_segment_id: weekData.strava_segment_id,
        required_laps: weekData.required_laps,
        start_at: weekData.start_at,
        end_at: weekData.end_at,
        notes: weekData.notes || undefined, // Convert null to undefined
      };

      return {
        week: frontendWeekData,
        leaderboard: leaderboardEntries,
      };
    }),
  getSeasonLeaderboard: publicProcedure
    .input(z.object({ seasonId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { orm: drizzleDb } = ctx; // Prefer canonical `orm` alias (same instance)

      // Get all weeks in this season
      const weeks = await drizzleDb
        .select({ id: week.id })
        .from(week)
        .where(eq(week.season_id, input.seasonId))
        .all();

      if (weeks.length === 0) {
        return [];
      }

      // Calculate scoring for each week and sum by participant
      const participantTotals: Map<number, {
        name: string;
        totalPoints: number;
        weeksCompleted: number;
      }> = new Map();

      for (const w of weeks) {
        const weekResults = await calculateWeekScoringDrizzle(drizzleDb, w.id); // Pass drizzleDb
        
        for (const res of weekResults.results) {
          const existing = participantTotals.get(res.participantId);
          if (existing) {
            participantTotals.set(res.participantId, {
              name: existing.name,
              totalPoints: existing.totalPoints + res.totalPoints,
              weeksCompleted: existing.weeksCompleted + 1
            });
          } else {
            participantTotals.set(res.participantId, {
              name: res.participantName,
              totalPoints: res.totalPoints,
              weeksCompleted: 1
            });
          }
        }
      }

      // Convert to array and sort by points
      const leaderboardResults = Array.from(participantTotals.entries())
        .map(([participantId, data]) => ({
          participantId,
          name: data.name,
          totalPoints: data.totalPoints,
          weeksCompleted: data.weeksCompleted
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

      // Fetch profile pictures for all participants in the season
      const participantIds = leaderboardResults.map(r => r.participantId);
      const profilePictures = await getAthleteProfilePictures(
        participantIds,
        drizzleDb
      );

      return leaderboardResults.map((res, index) => ({
        rank: index + 1,
        name: res.name,
        totalPoints: res.totalPoints,
        weeksCompleted: res.weeksCompleted,
        // Add missing fields expected by SeasonStanding interface if any
        // For now, matching the shape returned previously
        strava_athlete_id: res.participantId, // Aliasing for frontend compat if needed
        profile_picture_url: profilePictures.get(res.participantId) || null 
      }));
    }),
});