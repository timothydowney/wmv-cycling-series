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
  totalSeasonParticipants: number;
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

  const seasonStats: ProfileSeasonStats[] = [];

  for (const s of seasons) {
    const jerseyService = new JerseyService(drizzleDb);
    
    // Calculate season ranking by getting all weeks and computing points for all participants
    const seasonWeeks = await drizzleDb
      .select()
      .from(week)
      .where(eq(week.season_id, s.id))
      .all();

    if (seasonWeeks.length === 0) {
      continue; // No weeks in season, skip
    }

    const seasonLeaderboard = new Map<string, number>();
    const weeksParticipatedMap = new Map<string, number>();
    
    // For each week, calculate all participant points
    for (const w of seasonWeeks) {
      const weekResults = await drizzleDb
        .select()
        .from(result)
        .where(eq(result.week_id, w.id))
        .orderBy(result.total_time_seconds)
        .all();

      const participantCount = weekResults.length;
      const weekMultiplier = w.multiplier ?? 1;
      
      for (let i = 0; i < weekResults.length; i++) {
        const res = weekResults[i];
        const rank = i + 1;
        const athleteIdInRes = res.strava_athlete_id;
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
        
        const weekPoints = (basePoints + participationBonus + prBonusPoints) * weekMultiplier;
        
        seasonLeaderboard.set(athleteIdInRes, (seasonLeaderboard.get(athleteIdInRes) || 0) + weekPoints);
        weeksParticipatedMap.set(athleteIdInRes, (weeksParticipatedMap.get(athleteIdInRes) || 0) + 1);
      }
    }

    // Capture the target athlete's stats for this season
    const totalPoints = seasonLeaderboard.get(athleteId) || 0;
    const weeksParticipated = weeksParticipatedMap.get(athleteId) || 0;

    // Only include season if the athlete participated
    if (weeksParticipated > 0) {
      // Sort to get ranking
      const sorted = Array.from(seasonLeaderboard.entries())
        .sort((a, b) => b[1] - a[1]);

      const totalSeasonParticipants = sorted.length;
      const seasonRank = sorted.findIndex(([id]) => id === athleteId) + 1;

      let yellowJerseyWon = false;
      let polkaDotJerseyWon = false;

      if (!s.is_active) {
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
        weeksParticipated,
        seasonRank,
        totalSeasonParticipants,
        yellowJerseyWon,
        polkaDotJerseyWon,
        polkaDotWins,
        timeTrialWins,
      });
    }
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
