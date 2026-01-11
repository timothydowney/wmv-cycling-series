import { router, publicProcedure } from './init';
import { z } from 'zod';
import { StandingsService } from '../services/StandingsService';
import { HydrationService } from '../services/HydrationService';
import { LeaderboardService } from '../services/LeaderboardService';
import { ActivityService } from '../services/ActivityService';

export const leaderboardRouter = router({
  getWeekLeaderboard: publicProcedure
    .input(z.object({ weekId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const { orm: drizzleDb } = ctx;
        const leaderboardService = new LeaderboardService(drizzleDb);
        const result = await leaderboardService.getWeekLeaderboard(input.weekId);

        return {
          week: {
            ...result.week,
            segment_id: result.week.strava_segment_id, // Add compatibility field
            participants_count: result.leaderboard.length
          },
          leaderboard: result.leaderboard
        };
      } catch (error) {
        console.error('ERROR in getWeekLeaderboard:', error);
        throw error;
      }
    }),
  getSeasonLeaderboard: publicProcedure
    .input(z.object({ seasonId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { orm: drizzleDb } = ctx;
      const standingsService = new StandingsService(drizzleDb);
      const standings = await standingsService.getSeasonStandings(input.seasonId);

      return standings.map(s => ({
        rank: s.rank,
        name: s.name,
        totalPoints: s.totalPoints,
        weeksCompleted: s.weeksCompleted,
        polkadotWins: s.polkadotWins,
        strava_athlete_id: s.participantId,
        profile_picture_url: s.profilePictureUrl
      }));
    }),

  hydrateEffortDetails: publicProcedure
    .input(z.object({
      stravaActivityId: z.string(),
      stravaAthleteId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { orm: drizzleDb } = ctx;
        const hydrationService = new HydrationService(drizzleDb);
        const activityService = new ActivityService(drizzleDb);
        
        const res = await hydrationService.hydrateByStravaId(input.stravaActivityId);
        
        if (!res.success) {
          return { success: false, message: res.message };
        }

        // Fetch updated efforts to return to UI
        const efforts = await activityService.getEffortsByStravaId(input.stravaActivityId);

        if (!efforts) {
          return { success: false, message: 'Activity not found after hydration' };
        }

        return {
          success: true,
          updatedCount: res.updatedCount,
          efforts
        };
      } catch (error) {
        console.error('Error hydrating effort details:', error);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }),
});