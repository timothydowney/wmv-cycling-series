/**
 * ProfileService.ts
 *
 * Provides personal stats, participation history, and jersey wins for athletes.
 */

import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import { participant, season, participantToken, week, segment, result, activity, segmentEffort } from '../db/schema';
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
  bestTTWeeklyRank: number | null;
  bestHCWeeklyRank: number | null;
}

export interface CareerStats {
  bestTimeTrialWeeklyRank: number | null;
  bestHillClimbWeeklyRank: number | null;
  bestTimeTrialSeasonRank: number | null;
  bestHillClimbSeasonRank: number | null;
  bestPower: number | null;
  totalPrs: number;
  longestStreak: number;
}

export interface ProfileData {
  athleteId: string;
  name: string;
  profilePictureUrl?: string;
  isConnected: boolean;
  seasonStats: ProfileSeasonStats[];
  careerStats: CareerStats;
}

export class ProfileService {
  private standingsService: StandingsService;
  private jerseyService: JerseyService;

  constructor(private db: BetterSQLite3Database) {
    this.standingsService = new StandingsService(db);
    this.jerseyService = new JerseyService(db);
  }

  async getCareerStats(athleteId: string): Promise<CareerStats> {
    // 1. Fetch Weeks with Segment info
    const weeks = await this.db.select({
      id: week.id,
      seasonId: week.season_id,
      multiplier: week.multiplier,
      startAt: week.start_at,
      avgGrade: segment.average_grade
    })
      .from(week)
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .all();

    const weekMap = new Map(weeks.map(w => [w.id, w]));
    const hillClimbWeeks = new Set(weeks.filter(w => this.jerseyService.isHillClimbWeek(w.avgGrade)).map(w => w.id));

    // 2. Fetch Results with PR info
    const allResults = await this.db.select({
      weekId: result.week_id,
      athleteId: result.strava_athlete_id,
      time: result.total_time_seconds,
      pr: sql<number>`max(CASE WHEN ${segmentEffort.pr_achieved} = 1 THEN 1 ELSE 0 END)`
    })
      .from(result)
      .leftJoin(activity, eq(result.activity_id, activity.id))
      .leftJoin(segmentEffort, eq(activity.id, segmentEffort.activity_id))
      .groupBy(result.id)
      .all();

    // 3. Process Weekly Stats
    const weekResults = new Map<number, typeof allResults>();
    for(const r of allResults) {
      if(!weekResults.has(r.weekId)) weekResults.set(r.weekId, []);
       weekResults.get(r.weekId)!.push(r);
    }

    let bestTTRank: number | null = null;
    let bestHCRank: number | null = null;
    
    // seasonId -> { tt: Map, hc: Map }
    const seasonScores = new Map<number, { tt: Map<string, number>, hc: Map<string, number> }>();
    const initSeason = (sid: number) => {
      if(!seasonScores.has(sid)) seasonScores.set(sid, { tt: new Map(), hc: new Map() });
    };

    const userParticipatedWeekIds = new Set<number>();

    for(const [weekId, res] of weekResults.entries()) {
      const w = weekMap.get(weekId);
      if(!w) continue;

      // Sort by time (low to high)
      res.sort((a,b) => a.time - b.time);

      const totalParticipants = res.length;
      const isHC = hillClimbWeeks.has(weekId);
        
      initSeason(w.seasonId);
      const sScores = seasonScores.get(w.seasonId)!;
      const scoreMap = isHC ? sScores.hc : sScores.tt;

      res.forEach((r, idx) => {
        const rank = idx + 1;
            
        // Calculate Points
        const base = totalParticipants - rank;
        const part = 1;
        const pr = Number(r.pr);
        const points = (base + part + pr) * (w.multiplier || 1);

        // Accumulate Season Points
        scoreMap.set(r.athleteId, (scoreMap.get(r.athleteId) || 0) + points);

        // Check User Specifics
        if(r.athleteId === athleteId) {
          userParticipatedWeekIds.add(weekId);
          if(isHC) {
            if(bestHCRank === null || rank < bestHCRank) bestHCRank = rank;
          } else {
            if(bestTTRank === null || rank < bestTTRank) bestTTRank = rank;
          }
        }
      });
    }

    // 4. Calculate Season Ranks
    let bestTTSeasonRank: number | null = null;
    let bestHCSeasonRank: number | null = null;

    for(const [, scores] of seasonScores.entries()) {
      if(scores.tt.has(athleteId)) {
        const sorted = Array.from(scores.tt.entries()).sort((a,b) => b[1] - a[1]);
        const rank = sorted.findIndex(e => e[0] === athleteId) + 1;
        if(bestTTSeasonRank === null || rank < bestTTSeasonRank) bestTTSeasonRank = rank;
      }
      if(scores.hc.has(athleteId)) {
        const sorted = Array.from(scores.hc.entries()).sort((a,b) => b[1] - a[1]);
        const rank = sorted.findIndex(e => e[0] === athleteId) + 1;
        if(bestHCSeasonRank === null || rank < bestHCSeasonRank) bestHCSeasonRank = rank;
      }
    }

    // 5. Query Best Power & PRs directly
    const powerRaw = await this.db.select({
      maxPower: sql<number>`max(${segmentEffort.average_watts})`,
      prCount: sql<number>`sum(case when ${segmentEffort.pr_achieved} = 1 then 1 else 0 end)`
    })
      .from(segmentEffort)
      .innerJoin(activity, eq(segmentEffort.activity_id, activity.id))
      .where(eq(activity.strava_athlete_id, athleteId))
      .get();

    // 6. Streak
    const sortedWeeks = weeks.sort((a,b) => a.startAt - b.startAt);
    let longestStreak = 0;
    let currentStreak = 0;

    for(const w of sortedWeeks) {
      if(userParticipatedWeekIds.has(w.id)) {
        currentStreak++;
        if(currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    return {
      bestTimeTrialWeeklyRank: bestTTRank,
      bestHillClimbWeeklyRank: bestHCRank,
      bestTimeTrialSeasonRank: bestTTSeasonRank,
      bestHillClimbSeasonRank: bestHCSeasonRank,
      bestPower: powerRaw?.maxPower || 0,
      totalPrs: powerRaw?.prCount || 0,
      longestStreak
    };
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
    
    // Fetch all user weekly ranks once to avoid N+1 issues
    const weeklyRanks = await this.db.select({
      seasonId: week.season_id,
      weekId: week.id,
      avgGrade: segment.average_grade,
      rank: sql<number>`(
        SELECT count(*) + 1 
        FROM result r2 
        WHERE r2.week_id = ${result.week_id} 
        AND r2.total_time_seconds < ${result.total_time_seconds}
      )`
    })
      .from(result)
      .innerJoin(week, eq(result.week_id, week.id))
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .where(eq(result.strava_athlete_id, athleteId))
      .all();

    const seasonStats: ProfileSeasonStats[] = [];

    for (const s of seasons) {
      const standings = await this.standingsService.getSeasonStandings(s.id);
      const athleteStanding = standings.find(entry => entry.participantId === athleteId);

      if (athleteStanding) {
        // Athlete participated in this season
        let yellowJerseyWon = false;
        let polkaDotJerseyWon = false;

        // Only check "closed" season winners or current season if needed
        if (!s.is_active) {
          const yellowWinner = await this.jerseyService.getYellowJerseyWinner(s.id);
          yellowJerseyWon = yellowWinner?.strava_athlete_id === athleteId;

          const polkaDotWinner = await this.jerseyService.getPolkaDotWinner(s.id);
          polkaDotJerseyWon = polkaDotWinner?.strava_athlete_id === athleteId;
        }

        // Win counts
        const polkaDotWins = await this.jerseyService.getParticipantPolkaDotWins(s.id, athleteId);
        const timeTrialWins = await this.jerseyService.getParticipantTimeTrialWins(s.id, athleteId);

        // Best Weekly Ranks for this season
        const seasonRanks = weeklyRanks.filter(r => r.seasonId === s.id);
        let bestTTWeeklyRank: number | null = null;
        let bestHCWeeklyRank: number | null = null;

        for (const r of seasonRanks) {
          const isHC = this.jerseyService.isHillClimbWeek(r.avgGrade);
          if (isHC) {
            if (bestHCWeeklyRank === null || r.rank < bestHCWeeklyRank) bestHCWeeklyRank = r.rank;
          } else {
            if (bestTTWeeklyRank === null || r.rank < bestTTWeeklyRank) bestTTWeeklyRank = r.rank;
          }
        }

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
          bestTTWeeklyRank,
          bestHCWeeklyRank
        });
      }
    }

    // 3. Hydrate profile picture
    const profilePictures = await getAthleteProfilePictures([athleteId], this.db);

    // 4. Get Career Stats
    const careerStats = await this.getCareerStats(athleteId);

    return {
      athleteId,
      name: p.name || 'Unknown',
      profilePictureUrl: profilePictures.get(athleteId) || undefined,
      isConnected: !!token,
      seasonStats,
      careerStats,
    };
  }
}
