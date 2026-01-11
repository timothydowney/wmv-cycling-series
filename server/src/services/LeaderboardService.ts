/**
 * LeaderboardService.ts
 *
 * Provides hydrated leaderboard data for the UI, combining scoring, week details,
 * effort breakdowns, and ghost comparisons.
 */

import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { week, segment, segmentEffort } from '../db/schema';
import { ScoringService } from './ScoringService';
import { GhostService } from './GhostService';
import { secondsToHHMMSS } from '../dateUtils';

export interface LeaderboardEntryWithDetails {
  rank: number;
  participant_id: string;
  name: string;
  profile_picture_url: string | null;
  total_time_seconds: number;
  time_hhmmss: string;
  base_points: number;
  participation_bonus: number;
  pr_bonus_points: number;
  multiplier: number;
  points: number;
  activity_url: string;
  activity_date: string;
  effort_breakdown: any[] | null;
  device_name: string | null;
  ghost_comparison: any | null;
}

export interface HydratedLeaderboard {
  week: any; // Week with segment details
  leaderboard: LeaderboardEntryWithDetails[];
}

export class LeaderboardService {
  private scoringService: ScoringService;
  private ghostService: GhostService;

  constructor(private db: BetterSQLite3Database) {
    this.scoringService = new ScoringService(db);
    this.ghostService = new GhostService(db);
  }

  /**
   * Get the full hydrated leaderboard for a week.
   */
  async getWeekLeaderboard(weekId: number): Promise<HydratedLeaderboard> {
    // 1. Get week and segment details
    const weekData = await this.db.select({
      id: week.id,
      season_id: week.season_id,
      week_name: week.week_name,
      strava_segment_id: week.strava_segment_id,
      required_laps: week.required_laps,
      start_at: week.start_at,
      end_at: week.end_at,
      notes: week.notes,
      multiplier: week.multiplier,
      // Joined Segment Fields
      segment_name: segment.name,
      segment_distance: segment.distance,
      segment_total_elevation_gain: segment.total_elevation_gain,
      segment_average_grade: segment.average_grade,
      segment_climb_category: segment.climb_category,
      segment_city: segment.city,
      segment_state: segment.state,
      segment_country: segment.country,
    })
      .from(week)
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .where(eq(week.id, weekId))
      .get();

    if (!weekData) {
      throw new Error(`Week ${weekId} not found`);
    }

    // 2. Get scored results
    const { results: scoredResults } = await this.scoringService.calculateWeekScoring(weekId);

    // 3. Get ghost data
    const ghostDataMap = await this.ghostService.getGhostData(
      weekId,
      weekData.strava_segment_id,
      weekData.required_laps
    );

    // 4. Hydrate entries with effort breakdowns and ghosts
    const leaderboardEntries: LeaderboardEntryWithDetails[] = await Promise.all(
      scoredResults.map(async (res) => {
        let effortBreakdown: any[] = [];

        if (res.activityId) {
          const efforts = await this.db.select({
            lap: segmentEffort.effort_index,
            time_seconds: segmentEffort.elapsed_seconds,
            pr_achieved: segmentEffort.pr_achieved,
            strava_effort_id: segmentEffort.strava_effort_id,
            average_watts: segmentEffort.average_watts,
            average_heartrate: segmentEffort.average_heartrate,
            max_heartrate: segmentEffort.max_heartrate,
            average_cadence: segmentEffort.average_cadence,
            device_watts: segmentEffort.device_watts,
          })
            .from(segmentEffort)
            .where(eq(segmentEffort.activity_id, res.activityId))
            .orderBy(segmentEffort.effort_index)
            .all();

          effortBreakdown = efforts.map(e => ({
            lap: e.lap + 1,
            time_seconds: e.time_seconds,
            time_hhmmss: secondsToHHMMSS(e.time_seconds),
            is_pr: e.pr_achieved === 1,
            strava_effort_id: e.strava_effort_id || undefined,
            average_watts: e.average_watts,
            average_heartrate: e.average_heartrate,
            max_heartrate: e.max_heartrate,
            average_cadence: e.average_cadence,
            device_watts: e.device_watts,
          }));
        }

        // Ghost Comparison
        let ghostComparison = null;
        const ghostData = ghostDataMap.get(res.participantId);
        if (ghostData && res.totalTimeSeconds) {
          ghostComparison = {
            previous_time_seconds: ghostData.previous_time_seconds,
            previous_week_name: ghostData.previous_week_name,
            time_diff_seconds: res.totalTimeSeconds - ghostData.previous_time_seconds,
            strava_activity_id: ghostData.strava_activity_id,
          };
        }

        return {
          rank: res.rank,
          participant_id: res.participantId,
          name: res.participantName,
          profile_picture_url: res.profilePictureUrl || null,
          total_time_seconds: res.totalTimeSeconds || 0,
          time_hhmmss: secondsToHHMMSS(res.totalTimeSeconds) || '00:00:00',
          base_points: res.basePoints,
          participation_bonus: res.participationBonus,
          pr_bonus_points: res.prBonusPoints,
          multiplier: res.multiplier,
          points: res.totalPoints,
          activity_url: res.stravaActivityId
            ? `https://www.strava.com/activities/${res.stravaActivityId}`
            : '',
          activity_date: res.activityStartAt
            ? new Date(res.activityStartAt * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
            : '',
          effort_breakdown: effortBreakdown.length > 0 ? effortBreakdown : null,
          device_name: res.deviceName ?? null,
          ghost_comparison: ghostComparison,
        };
      })
    );

    return {
      week: {
        id: weekData.id,
        season_id: weekData.season_id,
        week_name: weekData.week_name,
        strava_segment_id: weekData.strava_segment_id,
        required_laps: weekData.required_laps,
        start_at: weekData.start_at,
        end_at: weekData.end_at,
        notes: weekData.notes,
        multiplier: weekData.multiplier,
        segment: {
          name: weekData.segment_name,
          distance: weekData.segment_distance,
          total_elevation_gain: weekData.segment_total_elevation_gain,
          average_grade: weekData.segment_average_grade,
          climb_category: weekData.segment_climb_category,
          city: weekData.segment_city,
          state: weekData.segment_state,
          country: weekData.segment_country,
        }
      },
      leaderboard: leaderboardEntries,
    };
  }
}
