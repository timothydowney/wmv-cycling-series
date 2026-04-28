/**
 * ChatToolRunner.ts
 *
 * Executes tools requested by Gemini's function calling.
 * Each tool maps to database queries using existing services,
 * or to live Strava API calls.
 */

import type { AppDatabase } from '../db/types';
import { eq, and, sql, desc } from 'drizzle-orm';
import Fuse from 'fuse.js';
import { getOne, getMany } from '../db/asyncQuery';
import {
  season, week, segment, participant, activity,
  segmentEffort, result, participantToken,
} from '../db/schema';
import { ScoringService } from './ScoringService';
import { StandingsService } from './StandingsService';
import { ProfileService } from './ProfileService';
import { JerseyService } from './JerseyService';
import { LeaderboardService } from './LeaderboardService';
import { secondsToHHMMSS } from '../dateUtils';
import * as stravaClient from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';

/**
 * Common nickname mappings for fuzzy name matching.
 * Maps lowercase nickname → array of lowercase full name variations.
 * 
 * This is a curated list covering the most common English nicknames.
 * Add club-specific variations as needed.
 */
const NICKNAME_MAP: Record<string, string[]> = {
  // Mike/Michael
  mike: ['michael'],
  mikey: ['michael'],
  mick: ['michael'],
  michael: ['mike', 'mikey'],
  
  // Tim/Timothy
  tim: ['timothy'],
  timmy: ['timothy'],
  timothy: ['tim', 'timmy'],
  
  // Tom/Thomas
  tom: ['thomas'],
  tommy: ['thomas'],
  thomas: ['tom', 'tommy'],
  
  // Bob/Robert
  bob: ['robert'],
  bobby: ['robert'],
  rob: ['robert'],
  robby: ['robert'],
  robert: ['bob', 'bobby', 'rob'],
  
  // Bill/William
  bill: ['william'],
  billy: ['william'],
  will: ['william'],
  willy: ['william'],
  william: ['bill', 'billy', 'will'],
  
  // Jim/James
  jim: ['james'],
  jimmy: ['james'],
  jamie: ['james'],
  james: ['jim', 'jimmy'],
  
  // Add more common nicknames as needed
  joe: ['joseph'],
  joseph: ['joe'],
  dave: ['david'],
  david: ['dave'],
  dan: ['daniel'],
  danny: ['daniel'],
  daniel: ['dan', 'danny'],
  matt: ['matthew'],
  matthew: ['matt'],
  chris: ['christopher'],
  christopher: ['chris'],
  steve: ['steven', 'stephen'],
  steven: ['steve'],
  stephen: ['steve'],
  rick: ['richard'],
  richard: ['rick'],
  tony: ['anthony'],
  anthony: ['tony'],
  alex: ['alexander', 'alexandra'],
  alexander: ['alex'],
  alexandra: ['alex'],
  ben: ['benjamin'],
  benjamin: ['ben'],
  sam: ['samuel', 'samantha'],
  samuel: ['sam'],
  samantha: ['sam'],
};

/**
 * Smart fuzzy match: combines nickname expansion with fuzzy search.
 * 
 * Process:
 * 1. Expand query using NICKNAME_MAP ("Mike" → ["michael", "mike", "mikey"])
 * 2. Fuzzy search all variations using Fuse.js
 * 3. Deduplicate and return ranked results
 * 
 * Returns participants matching any variation, sorted by relevance score.
 */
function fuzzyMatchName(
  candidates: { strava_athlete_id: string; name: string }[],
  searchName: string
): { strava_athlete_id: string; name: string }[] {
  const normalized = searchName.trim().toLowerCase();
  
  // Extract first name for nickname expansion
  const firstName = normalized.split(' ')[0];
  
  // Expand nicknames: check both the query itself and its mapped variations
  const variations = new Set<string>([normalized, firstName]);
  const nicknameVariations = NICKNAME_MAP[firstName] || [];
  nicknameVariations.forEach(v => variations.add(v));
  
  // Configure Fuse.js for name matching
  const fuse = new Fuse(candidates, {
    keys: ['name'],
    threshold: 0.4, // 0 = exact match, 1 = match anything
    ignoreLocation: true,
    includeScore: true,
  });
  
  // Search for all variations and collect results
  const allResults = Array.from(variations).flatMap(variant => fuse.search(variant));
  
  // Deduplicate by athlete ID, keeping best score
  const uniqueResults = new Map<string, typeof allResults[0]>();
  for (const result of allResults) {
    const id = result.item.strava_athlete_id;
    if (!uniqueResults.has(id) || (result.score ?? 1) < (uniqueResults.get(id)!.score ?? 1)) {
      uniqueResults.set(id, result);
    }
  }
  
  // Sort by score (lower is better) and return items
  return Array.from(uniqueResults.values())
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .map(r => r.item);
}

/**
 * Fuzzy match segments by name
 */
function fuzzyMatchSegment(
  candidates: { strava_segment_id: string; name: string }[],
  searchName: string
): { strava_segment_id: string; name: string }[] {
  const lower = searchName.toLowerCase().trim();
  return candidates.filter(c => c.name.toLowerCase().includes(lower));
}

export class ChatToolRunner {
  private scoringService: ScoringService;
  private standingsService: StandingsService;
  private profileService: ProfileService;
  private jerseyService: JerseyService;
  private leaderboardService: LeaderboardService;

  constructor(private db: AppDatabase) {
    this.scoringService = new ScoringService(db);
    this.standingsService = new StandingsService(db);
    this.profileService = new ProfileService(db);
    this.jerseyService = new JerseyService(db);
    this.leaderboardService = new LeaderboardService(db);
  }

  /**
   * Execute a tool by name with given arguments.
   * Returns the result as a plain object for Gemini to interpret.
   */
  async execute(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    switch (toolName) {
    case 'list_seasons':
      return this.listSeasons();
    case 'get_current_season':
      return this.getCurrentSeason();
    case 'get_season_weeks':
      return this.getSeasonWeeks(args.season_id as number);
    case 'get_week_by_name_and_season':
      return this.getWeekByNameAndSeason(
        args.week_name as string,
        args.season_name as string | undefined
      );
    case 'get_week_leaderboard':
      return this.getWeekLeaderboard(args.week_id as number);
    case 'get_season_standings':
      return this.getSeasonStandings(args.season_id as number);
    case 'list_participants':
      return this.listParticipants();
    case 'get_participant_profile':
      return this.getParticipantProfile(args.athlete_name as string);
    case 'get_participant_history':
      return this.getParticipantHistory(
        args.athlete_name as string,
        args.season_id as number | undefined
      );
    case 'get_effort_details':
      return this.getEffortDetails(
        args.week_id as number,
        args.athlete_name as string
      );
    case 'compare_athletes':
      return this.compareAthletes(
        args.athlete_names as string[],
        args.week_id as number | undefined,
        args.season_id as number | undefined
      );
    case 'get_watts_per_kg_ranking':
      return this.getWattsPerKgRanking(args.week_id as number);
    case 'get_improvement_report':
      return this.getImprovementReport(
        args.season_id as number,
        args.last_n_weeks as number | undefined
      );
    case 'get_segment_records':
      return this.getSegmentRecords(args.segment_name as string);
    case 'get_jersey_winners':
      return this.getJerseyWinners(args.season_id as number);
    case 'get_strava_recent_activities':
      return this.getStravaRecentActivities(
        args.athlete_name as string,
        args.days_back as number | undefined
      );
    case 'get_strava_athlete_profile':
      return this.getStravaAthleteProfile(args.athlete_name as string);
    default:
      return { error: `Unknown tool: ${toolName}` };
    }
  }

  // ── Helper: Resolve participant by fuzzy name ──

  private async getAllParticipants(): Promise<{ strava_athlete_id: string; name: string }[]> {
    return await getMany<{ strava_athlete_id: string; name: string }>(this.db.select({
      strava_athlete_id: participant.strava_athlete_id,
      name: participant.name,
    }).from(participant));
  }

  private async resolveParticipant(athleteName: string): Promise<{ strava_athlete_id: string; name: string } | { error: string; matches?: string[]; hint?: string }> {
    const all = await this.getAllParticipants();
    const matches = fuzzyMatchName(all, athleteName);

    if (matches.length === 0) {
      return { error: `No participant found matching "${athleteName}". Available: ${all.map(p => p.name).join(', ')}` };
    }
    if (matches.length === 1) {
      return matches[0];
    }

    // Multiple matches — check for exact match first
    const exact = matches.find(m => m.name.toLowerCase() === athleteName.toLowerCase());
    if (exact) return exact;

    // Try to narrow down by checking who has results in the current/latest season
    const now = Math.floor(Date.now() / 1000);
    const currentSeason = await getOne<{ id: number }>(this.db.select({ id: season.id })
      .from(season)
      .where(and(sql`${season.start_at} <= ${now}`, sql`${season.end_at} >= ${now}`)))
      || await getOne<{ id: number }>(this.db.select({ id: season.id }).from(season).orderBy(desc(season.end_at)).limit(1));

    let activeHint = '';
    if (currentSeason) {
      const activeIds = (await getMany<{ participantId: string }>(this.db.select({ participantId: result.strava_athlete_id })
        .from(result)
        .innerJoin(week, eq(result.week_id, week.id))
        .where(eq(week.season_id, currentSeason.id))))
        .map(r => r.participantId);

      const activeMatches = matches.filter(m => activeIds.includes(m.strava_athlete_id));
      if (activeMatches.length === 1) {
        // Only one of the matches has results this season — use them
        return activeMatches[0];
      }
      if (activeMatches.length > 0) {
        activeHint = ` Of these, ${activeMatches.map(m => m.name).join(' and ')} have results in the current season.`;
      } else {
        activeHint = ' None of these have results in the current season.';
      }
    }

    // Return all matches for Gemini to disambiguate
    return {
      error: `Multiple participants match "${athleteName}": ${matches.map(m => m.name).join(', ')}. Please be more specific.${activeHint}`,
      matches: matches.map(m => m.name),
      hint: activeHint || undefined,
    };
  }

  // ── Season & Week Tools ──

  private async listSeasons() {
    const seasons = await getMany<{ id: number; name: string; start_at: number; end_at: number }>(this.db.select({
      id: season.id,
      name: season.name,
      start_at: season.start_at,
      end_at: season.end_at,
    }).from(season).orderBy(season.start_at));

    return seasons.map(s => ({
      id: s.id,
      name: s.name,
      start_date: new Date(s.start_at * 1000).toISOString().split('T')[0],
      end_date: new Date(s.end_at * 1000).toISOString().split('T')[0],
    }));
  }

  private async getCurrentSeason() {
    const now = Math.floor(Date.now() / 1000);
    const current = await getOne<{ id: number; name: string; start_at: number; end_at: number }>(this.db.select({
      id: season.id,
      name: season.name,
      start_at: season.start_at,
      end_at: season.end_at,
    })
      .from(season)
      .where(and(
        sql`${season.start_at} <= ${now}`,
        sql`${season.end_at} >= ${now}`
      )));

    if (!current) {
      // Return the most recent season
      const latest = await getOne<{ id: number; name: string; start_at: number; end_at: number }>(this.db.select({
        id: season.id,
        name: season.name,
        start_at: season.start_at,
        end_at: season.end_at,
      }).from(season).orderBy(desc(season.end_at)).limit(1));

      if (!latest) return { error: 'No seasons found' };
      return {
        id: latest.id,
        name: latest.name,
        start_date: new Date(latest.start_at * 1000).toISOString().split('T')[0],
        end_date: new Date(latest.end_at * 1000).toISOString().split('T')[0],
        note: 'No active season — showing most recent',
      };
    }

    return {
      id: current.id,
      name: current.name,
      start_date: new Date(current.start_at * 1000).toISOString().split('T')[0],
      end_date: new Date(current.end_at * 1000).toISOString().split('T')[0],
    };
  }

  private async getSeasonWeeks(seasonId: number) {
    const weeks = await getMany<{
      id: number; week_name: string | null; segment_name: string | null; average_grade: number | null;
      distance: number | null; total_elevation_gain: number | null; required_laps: number; start_at: number;
      end_at: number; multiplier: number; notes: string | null;
    }>(this.db.select({
      id: week.id,
      week_name: week.week_name,
      segment_name: segment.name,
      average_grade: segment.average_grade,
      distance: segment.distance,
      total_elevation_gain: segment.total_elevation_gain,
      required_laps: week.required_laps,
      start_at: week.start_at,
      end_at: week.end_at,
      multiplier: week.multiplier,
      notes: week.notes,
    })
      .from(week)
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .where(eq(week.season_id, seasonId))
      .orderBy(week.start_at));

    return weeks.map((w, index) => ({
      week_number: index + 1,
      id: w.id,
      name: w.week_name,
      segment_name: w.segment_name,
      type: (w.average_grade || 0) > 2 ? 'Hill Climb' : 'Time Trial',
      average_grade_pct: w.average_grade,
      distance_km: w.distance ? Math.round(w.distance / 100) / 10 : null,
      elevation_gain_m: w.total_elevation_gain ? Math.round(w.total_elevation_gain) : null,
      required_laps: w.required_laps,
      start_date: new Date(w.start_at * 1000).toISOString().split('T')[0],
      end_date: new Date(w.end_at * 1000).toISOString().split('T')[0],
      multiplier: w.multiplier,
      notes: w.notes || undefined,
    }));
  }

  private async getWeekByNameAndSeason(weekName: string, seasonName?: string) {
    // Get all weeks with segment and season info
    const allWeeks = await getMany<{
      id: number; week_name: string | null; segment_name: string | null; season_id: number; season_name: string | null;
      start_at: number; end_at: number; average_grade: number | null; required_laps: number; multiplier: number;
    }>(this.db.select({
      id: week.id,
      week_name: week.week_name,
      segment_name: segment.name,
      season_id: week.season_id,
      season_name: season.name,
      start_at: week.start_at,
      end_at: week.end_at,
      average_grade: segment.average_grade,
      required_laps: week.required_laps,
      multiplier: week.multiplier,
    })
      .from(week)
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .leftJoin(season, eq(week.season_id, season.id))
      .orderBy(desc(week.start_at)));

    // Fuzzy match on week/segment name
    const lower = weekName.toLowerCase();
    let matches = allWeeks.filter(w =>
      (w.week_name?.toLowerCase().includes(lower)) ||
      (w.segment_name?.toLowerCase().includes(lower))
    );

    // Filter by season name if provided
    if (seasonName) {
      const seasonLower = seasonName.toLowerCase();
      matches = matches.filter(w => w.season_name?.toLowerCase().includes(seasonLower));
    }

    if (matches.length === 0) {
      return { error: `No week found matching "${weekName}"${seasonName ? ` in season "${seasonName}"` : ''}` };
    }

    return matches.map(w => ({
      week_id: w.id,
      week_name: w.week_name,
      segment_name: w.segment_name,
      season_name: w.season_name,
      type: (w.average_grade || 0) > 2 ? 'Hill Climb' : 'Time Trial',
      start_date: new Date(w.start_at * 1000).toISOString().split('T')[0],
      end_date: new Date(w.end_at * 1000).toISOString().split('T')[0],
      required_laps: w.required_laps,
      multiplier: w.multiplier,
    }));
  }

  // ── Leaderboard & Scoring Tools ──

  private async getWeekLeaderboard(weekId: number) {
    try {
      const lb = await this.leaderboardService.getWeekLeaderboard(weekId);

      return {
        week: {
          id: lb.week.id,
          name: lb.week.week_name,
          segment: lb.week.segment?.name,
          type: ((lb.week.segment?.average_grade || 0) > 2) ? 'Hill Climb' : 'Time Trial',
          required_laps: lb.week.required_laps,
          multiplier: lb.week.multiplier,
        },
        leaderboard: lb.leaderboard.map(entry => ({
          rank: entry.rank,
          name: entry.name,
          total_time: entry.time_hhmmss,
          total_time_seconds: entry.total_time_seconds,
          base_points: entry.base_points,
          participation_bonus: entry.participation_bonus,
          pr_bonus: entry.pr_bonus_points,
          multiplier: entry.multiplier,
          total_points: entry.points,
          activity_date: entry.activity_date,
          device_name: entry.device_name,
          effort_breakdown: entry.effort_breakdown?.map(e => ({
            lap: e.lap,
            time: secondsToHHMMSS(e.time_seconds),
            time_seconds: e.time_seconds,
            average_watts: e.average_watts,
            average_heartrate: e.average_heartrate,
            max_heartrate: e.max_heartrate,
            average_cadence: e.average_cadence,
            is_pr: e.is_pr,
            device_watts: e.device_watts,
            athlete_weight_kg: e.athlete_weight,
          })) || [],
        })),
      };
    } catch (error) {
      return { error: `Failed to get leaderboard for week ${weekId}: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private async getSeasonStandings(seasonId: number) {
    try {
      const standings = await this.standingsService.getSeasonStandings(seasonId, { includeProfilePictures: false });
      return standings.map(s => ({
        rank: s.rank,
        name: s.name,
        total_points: s.totalPoints,
        weeks_completed: s.weeksCompleted,
        polka_dot_wins: s.polkadotWins,
      }));
    } catch (error) {
      return { error: `Failed to get standings for season ${seasonId}: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  // ── Participant Tools ──

  private async listParticipants() {
    const participants = await getMany<{ name: string; weight_kg: number | null; active: number }>(this.db.select({
      name: participant.name,
      weight_kg: participant.weight,
      active: participant.active,
    }).from(participant).orderBy(participant.name));

    return participants.map(p => ({
      name: p.name,
      weight_kg: p.weight_kg ? Math.round(p.weight_kg * 10) / 10 : null,
      active: p.active,
    }));
  }

  private async getParticipantProfile(athleteName: string) {
    const resolved = await this.resolveParticipant(athleteName);
    if ('error' in resolved) return resolved;

    try {
      const profile = await this.profileService.getAthleteProfile(resolved.strava_athlete_id);
      if (!profile) return { error: `Profile not found for ${resolved.name}` };

      return {
        name: profile.name,
        is_connected: profile.isConnected,
        season_stats: profile.seasonStats.map(s => ({
          season: s.seasonName,
          total_points: s.totalPoints,
          weeks_participated: s.weeksParticipated,
          season_rank: s.seasonRank,
          total_participants: s.totalSeasonParticipants,
          yellow_jersey_won: s.yellowJerseyWon,
          polka_dot_jersey_won: s.polkaDotJerseyWon,
          polka_dot_wins: s.polkaDotWins,
          time_trial_wins: s.timeTrialWins,
          best_tt_rank: s.bestTTWeeklyRank,
          best_hc_rank: s.bestHCWeeklyRank,
        })),
        career_stats: {
          best_tt_weekly_rank: profile.careerStats.bestTimeTrialWeeklyRank,
          best_hc_weekly_rank: profile.careerStats.bestHillClimbWeeklyRank,
          best_tt_season_rank: profile.careerStats.bestTimeTrialSeasonRank,
          best_hc_season_rank: profile.careerStats.bestHillClimbSeasonRank,
          best_power_watts: profile.careerStats.bestPower,
          total_prs: profile.careerStats.totalPrs,
          longest_streak: profile.careerStats.longestStreak,
        },
      };
    } catch (error) {
      return { error: `Failed to get profile: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private async getParticipantHistory(athleteName: string, seasonId?: number) {
    const resolved = await this.resolveParticipant(athleteName);
    if ('error' in resolved) return resolved;

    // Get all results for this participant
    const query = await getMany<{
      week_id: number; week_name: string | null; season_id: number; season_name: string | null;
      total_time_seconds: number; segment_name: string | null; average_grade: number | null; start_at: number;
    }>(this.db.select({
      week_id: result.week_id,
      week_name: week.week_name,
      season_id: week.season_id,
      season_name: season.name,
      total_time_seconds: result.total_time_seconds,
      segment_name: segment.name,
      average_grade: segment.average_grade,
      start_at: week.start_at,
    })
      .from(result)
      .leftJoin(week, eq(result.week_id, week.id))
      .leftJoin(season, eq(week.season_id, season.id))
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .where(eq(result.strava_athlete_id, resolved.strava_athlete_id))
      .orderBy(desc(week.start_at)));

    let results = query;
    if (seasonId) {
      results = results.filter(r => r.season_id === seasonId);
    }

    // Get rank and points for each week
    const enriched = await Promise.all(results.map(async (r) => {
      const scoring = await this.scoringService.calculateWeekScoring(r.week_id);
      const myResult = scoring.results.find(s => s.participantId === resolved.strava_athlete_id);

      return {
        week_name: r.week_name,
        segment_name: r.segment_name,
        season: r.season_name,
        type: (r.average_grade || 0) > 2 ? 'Hill Climb' : 'Time Trial',
        date: new Date((r.start_at || 0) * 1000).toISOString().split('T')[0],
        total_time: secondsToHHMMSS(r.total_time_seconds),
        total_time_seconds: r.total_time_seconds,
        rank: myResult?.rank ?? null,
        total_participants: scoring.results.length,
        total_points: myResult?.totalPoints ?? 0,
        pr_bonus: myResult?.prBonusPoints ?? 0,
      };
    }));

    return {
      name: resolved.name,
      results: enriched,
    };
  }

  // ── Effort & Performance Tools ──

  private async getEffortDetails(weekId: number, athleteName: string) {
    const resolved = await this.resolveParticipant(athleteName);
    if ('error' in resolved) return resolved;

    // Find the activity for this participant in this week
    const act = await getOne<{
      id: number; strava_activity_id: string | null; athlete_weight: number | null; device_name: string | null;
    }>(this.db.select({
      id: activity.id,
      strava_activity_id: activity.strava_activity_id,
      athlete_weight: activity.athlete_weight,
      device_name: activity.device_name,
    })
      .from(activity)
      .where(and(
        eq(activity.week_id, weekId),
        eq(activity.strava_athlete_id, resolved.strava_athlete_id)
      )));

    if (!act) {
      return { error: `No activity found for ${resolved.name} in week ${weekId}` };
    }

    const efforts = await getMany<{
      effort_index: number; elapsed_seconds: number; average_watts: number | null; average_heartrate: number | null;
      max_heartrate: number | null; average_cadence: number | null; pr_achieved: number; device_watts: number | null;
    }>(this.db.select({
      effort_index: segmentEffort.effort_index,
      elapsed_seconds: segmentEffort.elapsed_seconds,
      average_watts: segmentEffort.average_watts,
      average_heartrate: segmentEffort.average_heartrate,
      max_heartrate: segmentEffort.max_heartrate,
      average_cadence: segmentEffort.average_cadence,
      pr_achieved: segmentEffort.pr_achieved,
      device_watts: segmentEffort.device_watts,
    })
      .from(segmentEffort)
      .where(eq(segmentEffort.activity_id, act.id))
      .orderBy(segmentEffort.effort_index));

    return {
      name: resolved.name,
      device: act.device_name,
      athlete_weight_kg: act.athlete_weight ? Math.round(act.athlete_weight * 10) / 10 : null,
      laps: efforts.map(e => ({
        lap: e.effort_index + 1,
        time: secondsToHHMMSS(e.elapsed_seconds),
        time_seconds: e.elapsed_seconds,
        average_watts: e.average_watts ? Math.round(e.average_watts) : null,
        average_heartrate: e.average_heartrate ? Math.round(e.average_heartrate) : null,
        max_heartrate: e.max_heartrate ? Math.round(e.max_heartrate) : null,
        average_cadence: e.average_cadence ? Math.round(e.average_cadence) : null,
        is_pr: e.pr_achieved === 1,
        device_watts: e.device_watts,
        watts_per_kg: (e.average_watts && act.athlete_weight)
          ? Math.round((e.average_watts / act.athlete_weight) * 100) / 100
          : null,
      })),
    };
  }

  private async compareAthletes(
    athleteNames: string[],
    weekId?: number,
    seasonId?: number
  ) {
    const resolved = await Promise.all(athleteNames.map(async name => ({
      input: name,
      result: await this.resolveParticipant(name),
    })));

    // Check for any errors
    const errors = resolved.filter(r => 'error' in r.result);
    if (errors.length > 0) {
      return { errors: errors.map(e => ({ name: e.input, error: (e.result as { error: string }).error })) };
    }

    const athletes = resolved.map(r => r.result as { strava_athlete_id: string; name: string });

    if (weekId) {
      // Compare for a specific week
      const scoring = await this.scoringService.calculateWeekScoring(weekId);

      return {
        week_id: weekId,
        comparison: athletes.map(a => {
          const res = scoring.results.find(s => s.participantId === a.strava_athlete_id);
          return {
            name: a.name,
            rank: res?.rank ?? 'DNF',
            total_time: res ? secondsToHHMMSS(res.totalTimeSeconds) : 'N/A',
            total_time_seconds: res?.totalTimeSeconds ?? null,
            total_points: res?.totalPoints ?? 0,
            pr_bonus: res?.prBonusPoints ?? 0,
          };
        }),
      };
    }

    // Compare season standings
    const targetSeasonId = seasonId || await this.getLatestSeasonId();
    if (!targetSeasonId) return { error: 'No season found' };

    const standings = await this.standingsService.getSeasonStandings(targetSeasonId, { includeProfilePictures: false });

    return {
      season_id: targetSeasonId,
      comparison: athletes.map(a => {
        const standing = standings.find(s => s.participantId === a.strava_athlete_id);
        return {
          name: a.name,
          rank: standing?.rank ?? 'N/A',
          total_points: standing?.totalPoints ?? 0,
          weeks_completed: standing?.weeksCompleted ?? 0,
          polka_dot_wins: standing?.polkadotWins ?? 0,
        };
      }),
    };
  }

  private async getWattsPerKgRanking(weekId: number) {
    // Get all activities for the week with their best effort watts and athlete weight
    const data = await getMany<{
      name: string | null; athlete_weight: number | null; avg_watts: number | null; max_watts: number | null;
    }>(this.db.select({
      name: participant.name,
      athlete_weight: activity.athlete_weight,
      avg_watts: sql<number>`AVG(${segmentEffort.average_watts})`,
      max_watts: sql<number>`MAX(${segmentEffort.average_watts})`,
    })
      .from(activity)
      .leftJoin(participant, eq(activity.strava_athlete_id, participant.strava_athlete_id))
      .leftJoin(segmentEffort, eq(segmentEffort.activity_id, activity.id))
      .where(and(
        eq(activity.week_id, weekId),
        sql`${segmentEffort.average_watts} IS NOT NULL`,
        sql`${activity.athlete_weight} IS NOT NULL`,
        sql`${activity.athlete_weight} > 0`
      ))
      .groupBy(activity.strava_athlete_id));

    if (data.length === 0) {
      return { error: 'No watts/kg data available for this week. Participants may not have power meters or weight data.' };
    }

    const rankings = data
      .map(d => ({
        name: d.name || 'Unknown',
        average_watts: d.avg_watts ? Math.round(d.avg_watts) : null,
        max_watts: d.max_watts ? Math.round(d.max_watts) : null,
        weight_kg: d.athlete_weight ? Math.round(d.athlete_weight * 10) / 10 : null,
        watts_per_kg: (d.avg_watts && d.athlete_weight)
          ? Math.round((d.avg_watts / d.athlete_weight) * 100) / 100
          : null,
      }))
      .filter(d => d.watts_per_kg !== null)
      .sort((a, b) => (b.watts_per_kg || 0) - (a.watts_per_kg || 0));

    return rankings.map((r, i) => ({
      rank: i + 1,
      ...r,
    }));
  }

  // ── Analysis & Trends Tools ──

  private async getImprovementReport(seasonId: number, lastNWeeks?: number) {
    // Get all weeks for the season
    const weeks = await getMany<{
      id: number; week_name: string | null; strava_segment_id: string; start_at: number;
    }>(this.db.select({
      id: week.id,
      week_name: week.week_name,
      strava_segment_id: week.strava_segment_id,
      start_at: week.start_at,
    })
      .from(week)
      .where(eq(week.season_id, seasonId))
      .orderBy(week.start_at));

    if (weeks.length < 2) {
      return { error: 'Need at least 2 weeks to calculate improvement' };
    }

    // Filter to last N weeks if specified
    const targetWeeks = lastNWeeks ? weeks.slice(-lastNWeeks) : weeks;

    // Find segments that appear more than once (for time comparison)
    const segmentAppearances = new Map<string, typeof targetWeeks>();
    for (const w of targetWeeks) {
      const existing = segmentAppearances.get(w.strava_segment_id) || [];
      existing.push(w);
      segmentAppearances.set(w.strava_segment_id, existing);
    }

    const repeatedSegments = Array.from(segmentAppearances.entries())
      .filter(([, appearances]) => appearances.length >= 2);

    if (repeatedSegments.length === 0) {
      // Fall back to relative rank improvement
      const firstWeek = targetWeeks[0];
      const lastWeek = targetWeeks[targetWeeks.length - 1];

      const firstScoring = await this.scoringService.calculateWeekScoring(firstWeek.id);
      const lastScoring = await this.scoringService.calculateWeekScoring(lastWeek.id);

      const improvements: { name: string; first_rank: number; last_rank: number; rank_change: number }[] = [];

      for (const lastResult of lastScoring.results) {
        const firstResult = firstScoring.results.find(r => r.participantId === lastResult.participantId);
        if (firstResult) {
          improvements.push({
            name: lastResult.participantName,
            first_rank: firstResult.rank,
            last_rank: lastResult.rank,
            rank_change: firstResult.rank - lastResult.rank, // positive = improved
          });
        }
      }

      improvements.sort((a, b) => b.rank_change - a.rank_change);

      return {
        comparison_type: 'rank_change',
        first_week: firstWeek.week_name,
        last_week: lastWeek.week_name,
        improvements,
      };
    }

    // Compare times on repeated segments
    const improvements: { name: string; segment: string; first_time: string; last_time: string; improvement_seconds: number; improvement_pct: number }[] = [];

    for (const [, appearances] of repeatedSegments) {
      const first = appearances[0];
      const last = appearances[appearances.length - 1];

      // Get results for both weeks
      const firstResults = await getMany<{
        athlete_id: string; name: string | null; time: number;
      }>(this.db.select({
        athlete_id: result.strava_athlete_id,
        name: participant.name,
        time: result.total_time_seconds,
      })
        .from(result)
        .leftJoin(participant, eq(result.strava_athlete_id, participant.strava_athlete_id))
        .where(eq(result.week_id, first.id)));

      const lastResults = await getMany<{
        athlete_id: string; time: number;
      }>(this.db.select({
        athlete_id: result.strava_athlete_id,
        time: result.total_time_seconds,
      })
        .from(result)
        .where(eq(result.week_id, last.id)));

      for (const fr of firstResults) {
        const lr = lastResults.find(r => r.athlete_id === fr.athlete_id);
        if (lr && fr.time > 0) {
          const diff = fr.time - lr.time;
          improvements.push({
            name: fr.name || 'Unknown',
            segment: first.week_name || '',
            first_time: secondsToHHMMSS(fr.time) || '',
            last_time: secondsToHHMMSS(lr.time) || '',
            improvement_seconds: diff,
            improvement_pct: Math.round((diff / fr.time) * 10000) / 100,
          });
        }
      }
    }

    improvements.sort((a, b) => b.improvement_pct - a.improvement_pct);

    return {
      comparison_type: 'time_improvement',
      improvements: improvements.slice(0, 10), // Top 10
    };
  }

  private async getSegmentRecords(segmentName: string) {
    // Find matching segments
    const allSegments = await getMany<{
      strava_segment_id: string; name: string;
    }>(this.db.select({
      strava_segment_id: segment.strava_segment_id,
      name: segment.name,
    }).from(segment));

    const matched = fuzzyMatchSegment(allSegments.filter(s => s.name), segmentName);
    if (matched.length === 0) {
      return { error: `No segment found matching "${segmentName}". Available: ${allSegments.map(s => s.name || 'Unknown').join(', ')}` };
    }

    const records: { segment_name: string; name: string; time: string; time_seconds: number; season: string; week: string; date: string }[] = [];

    for (const seg of matched) {
      // Get all results for weeks using this segment
      const weekResults = await getMany<{
        participant_name: string | null; total_time_seconds: number; season_name: string | null;
        week_name: string | null; start_at: number;
      }>(this.db.select({
        participant_name: participant.name,
        total_time_seconds: result.total_time_seconds,
        season_name: season.name,
        week_name: week.week_name,
        start_at: week.start_at,
      })
        .from(result)
        .leftJoin(week, eq(result.week_id, week.id))
        .leftJoin(season, eq(week.season_id, season.id))
        .leftJoin(participant, eq(result.strava_athlete_id, participant.strava_athlete_id))
        .where(eq(week.strava_segment_id, seg.strava_segment_id))
        .orderBy(result.total_time_seconds)
        .limit(10));

      for (const r of weekResults) {
        records.push({
          segment_name: seg.name,
          name: r.participant_name || 'Unknown',
          time: secondsToHHMMSS(r.total_time_seconds) || '',
          time_seconds: r.total_time_seconds,
          season: r.season_name || '',
          week: r.week_name || '',
          date: new Date((r.start_at || 0) * 1000).toISOString().split('T')[0],
        });
      }
    }

    return records;
  }

  private async getJerseyWinners(seasonId: number) {
    try {
      const yellowWinner = await this.jerseyService.getYellowJerseyWinner(seasonId);
      const polkaDotWinner = await this.jerseyService.getPolkaDotWinner(seasonId);

      return {
        yellow_jersey: yellowWinner ? {
          name: yellowWinner.name,
          total_points: yellowWinner.total_points,
        } : { note: 'No yellow jersey winner yet' },
        polka_dot_jersey: polkaDotWinner ? {
          name: polkaDotWinner.name,
          hill_climb_wins: polkaDotWinner.polka_dot_wins,
        } : { note: 'No polka dot jersey winner yet (no hill climb weeks)' },
      };
    } catch (error) {
      return { error: `Failed to get jersey winners: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  // ── Live Strava Tools ──

  private async getStravaRecentActivities(athleteName: string, daysBack: number = 7) {
    const resolved = await this.resolveParticipant(athleteName);
    if ('error' in resolved) return resolved;

    // Clamp days_back
    const days = Math.min(Math.max(daysBack, 1), 30);

    // Check if participant has a token
    const token = await getOne<{ strava_athlete_id: string }>(this.db.select({ strava_athlete_id: participantToken.strava_athlete_id })
      .from(participantToken)
      .where(eq(participantToken.strava_athlete_id, resolved.strava_athlete_id)));

    if (!token) {
      return { error: `${resolved.name} is not connected to Strava (no token available)` };
    }

    try {
      const accessToken = await getValidAccessToken(this.db, stravaClient, resolved.strava_athlete_id);
      const now = Math.floor(Date.now() / 1000);
      const after = now - (days * 86400);

      const activities = await stravaClient.listAthleteActivities(accessToken, after, now, {
        includeAllEfforts: false,
      });

      return {
        name: resolved.name,
        period: `last ${days} days`,
        activities: activities.slice(0, 20).map(a => ({
          name: a.name,
          type: a.type || a.sport_type,
          date: a.start_date ? new Date(String(a.start_date)).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          }) : 'Unknown',
          distance_km: a.distance ? Math.round(a.distance / 100) / 10 : null,
          moving_time: secondsToHHMMSS(a.moving_time as number | null),
          elevation_gain_m: a.total_elevation_gain ? Math.round(a.total_elevation_gain as number) : null,
          average_watts: a.average_watts ? Math.round(a.average_watts as number) : null,
        })),
      };
    } catch (error) {
      return { error: `Failed to fetch Strava activities for ${resolved.name}: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private async getStravaAthleteProfile(athleteName: string) {
    const resolved = await this.resolveParticipant(athleteName);
    if ('error' in resolved) return resolved;

    // Check if participant has a token
    const token = await getOne<{ strava_athlete_id: string }>(this.db.select({ strava_athlete_id: participantToken.strava_athlete_id })
      .from(participantToken)
      .where(eq(participantToken.strava_athlete_id, resolved.strava_athlete_id)));

    if (!token) {
      return { error: `${resolved.name} is not connected to Strava (no token available)` };
    }

    try {
      const accessToken = await getValidAccessToken(this.db, stravaClient, resolved.strava_athlete_id);
      const profile = await stravaClient.getAthleteProfile(resolved.strava_athlete_id, accessToken);

      return {
        name: `${profile.firstname} ${profile.lastname}`,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        sex: profile.sex,
        weight_kg: profile.weight ? Math.round(profile.weight * 10) / 10 : null,
        ftp: profile.ftp || null,
      };
    } catch (error) {
      return { error: `Failed to fetch Strava profile for ${resolved.name}: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  // ── Helper ──

  private async getLatestSeasonId(): Promise<number | null> {
    const s = await getOne<{ id: number }>(this.db.select({ id: season.id })
      .from(season)
      .orderBy(desc(season.end_at))
      .limit(1));
    return s?.id ?? null;
  }
}
