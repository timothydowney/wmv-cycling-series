import { router, publicProcedure } from '../trpc/init';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { participant, season, result, week, segmentEffort } from '../db/schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { JerseyService } from '../services/JerseyService';
import { getAthleteProfilePictures } from '../services/StravaProfileService';

export interface ProfileSeasonStats {
  seasonId: number;
  seasonName: string;
  isActive: number | null;
  totalPoints: number;
  weeksParticipated: number;
  seasonRank: number;
  yellowJerseyWon: boolean;
  polkaDotJerseyWon: boolean;
  polkaDotWins: number;
  timeTrialWins: number;
}

export interface MyProfileData {
  athleteId: string;
  name: string;
  profilePictureUrl?: string;
  seasonStats: ProfileSeasonStats[];
}

/**
 * Get profile data for the authenticated user
 * Returns personal stats including season participation and jersey wins
 */
async function getMyProfile(
  drizzleDb: BetterSQLite3Database,
  athleteId: string
): Promise<MyProfileData | null> {
  // Get participant info
  const p = await drizzleDb
    .select()
    .from(participant)
    .where(eq(participant.strava_athlete_id, athleteId))
    .get();

  if (!p) {
    return null;
  }

  // Get all seasons
  const seasons = await drizzleDb.select().from(season).orderBy(season.id).all();

  const jerseyService = new JerseyService(drizzleDb);
  const seasonStats: ProfileSeasonStats[] = [];

  for (const s of seasons) {
    // Get all results for participant in this season
    const results = await drizzleDb
      .select({
        week_id: result.week_id,
        activity_id: result.activity_id,
        total_time_seconds: result.total_time_seconds,
      })
      .from(result)
      .where(eq(result.strava_athlete_id, athleteId))
      .all();

    // Filter to only this season's results
    const seasonResults = [];
    for (const res of results) {
      if (res.week_id) {
        const w = await drizzleDb
          .select({ season_id: week.season_id })
          .from(week)
          .where(eq(week.id, res.week_id))
          .get();
        
        if (w && w.season_id === s.id) {
          seasonResults.push(res);
        }
      }
    }

    let totalPoints = 0;
    for (const res of seasonResults) {
      if (res.week_id) {
        // Calculate points for this week using the same logic as leaderboard
        const weekResults = await drizzleDb
          .select({
            strava_athlete_id: result.strava_athlete_id,
            total_time_seconds: result.total_time_seconds,
          })
          .from(result)
          .where(eq(result.week_id, res.week_id))
          .orderBy(result.total_time_seconds)
          .all();

        const participantCount = weekResults.length;
        const rankIndex = weekResults.findIndex(r => r.strava_athlete_id === athleteId);
        const rank = rankIndex + 1;

        if (rankIndex >= 0) {
          const basePoints = participantCount - rank;
          const participationBonus = 1;

          // Check for PR bonus
          let prBonusPoints = 0;
          if (res.activity_id) {
            const effortWithPr = await drizzleDb
              .select()
              .from(segmentEffort)
              .where(eq(segmentEffort.activity_id, res.activity_id))
              .all();

            prBonusPoints = effortWithPr.some(e => e.pr_achieved) ? 1 : 0;
          }

          totalPoints += basePoints + participationBonus + prBonusPoints;
        }
      }
    }

    // Calculate season ranking (only for closed seasons)
    let seasonRank = 0;
    let yellowJerseyWon = false;
    let polkaDotJerseyWon = false;

    if (!s.is_active) {
      // Get all participants' points for this season to rank
      const allParticipants = await drizzleDb
        .select({ strava_athlete_id: result.strava_athlete_id })
        .from(result)
        .where(eq(result.strava_athlete_id, athleteId))
        .all();
      if (allParticipants.length > 0) {
        // Calculate season ranking by getting all weeks and computing points for all participants
        const seasonWeeks = await drizzleDb
          .select()
          .from(week)
          .where(eq(week.season_id, s.id))
          .all();

        const seasonLeaderboard = new Map<string, number>();
        
        // For each week, calculate all participant points
        for (const w of seasonWeeks) {
          const weekResults = await drizzleDb
            .select()
            .from(result)
            .where(eq(result.week_id, w.id))
            .orderBy(result.total_time_seconds)
            .all();

          const participantCount = weekResults.length;
          
          for (let i = 0; i < weekResults.length; i++) {
            const res = weekResults[i];
            const rank = i + 1;
            const basePoints = participantCount - rank;
            const participationBonus = 1;
            
            // Check for PR bonus
            let prBonusPoints = 0;
            if (res.activity_id) {
              const effortWithPr = await drizzleDb
                .select()
                .from(segmentEffort)
                .where(eq(segmentEffort.activity_id, res.activity_id))
                .all();
              prBonusPoints = effortWithPr.some(e => e.pr_achieved) ? 1 : 0;
            }
            
            const weekPoints = basePoints + participationBonus + prBonusPoints;
            const currentPoints = seasonLeaderboard.get(res.strava_athlete_id) || 0;
            seasonLeaderboard.set(res.strava_athlete_id, currentPoints + weekPoints);
          }
        }

        // Sort to get ranking
        const sorted = Array.from(seasonLeaderboard.entries())
          .sort((a, b) => b[1] - a[1]);

        seasonRank = sorted.findIndex(([id]) => id === athleteId) + 1;
      }

      // Check for yellow jersey win
      const yellowWinner = await jerseyService.getYellowJerseyWinner(s.id);
      yellowJerseyWon = yellowWinner?.strava_athlete_id === athleteId;

      // Check for polka dot jersey win
      const polkaDotWinner = await jerseyService.getPolkaDotWinner(s.id);
      polkaDotJerseyWon = polkaDotWinner?.strava_athlete_id === athleteId;
    }

    // Get polka dot wins for this season (only for closed seasons)
    const polkaDotWins = !s.is_active ? await jerseyService.getParticipantPolkaDotWins(s.id, athleteId) : 0;

    // Get time trial wins for this season (only for closed seasons)
    const timeTrialWins = !s.is_active ? await jerseyService.getParticipantTimeTrialWins(s.id, athleteId) : 0;

    seasonStats.push({
      seasonId: s.id,
      seasonName: s.name,
      isActive: s.is_active,
      totalPoints,
      weeksParticipated: seasonResults.length,
      seasonRank,
      yellowJerseyWon,
      polkaDotJerseyWon,
      polkaDotWins,
      timeTrialWins,
    });
  }

  // Get profile picture from service
  const profilePictures = await getAthleteProfilePictures([athleteId], drizzleDb);
  const profilePictureUrl = profilePictures.get(athleteId) || undefined;

  return {
    athleteId,
    name: p.name || 'Unknown',
    profilePictureUrl,
    seasonStats,
  };
}

export const profileRouter = router({
  getMyProfile: publicProcedure
    .input(z.object({ athleteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const profile = await getMyProfile(ctx.drizzleDb, input.athleteId);
      return profile;
    }),
});
