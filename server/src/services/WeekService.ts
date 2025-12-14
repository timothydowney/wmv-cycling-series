/**
 * WeekService.ts
 * Encapsulates all business logic for week management
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { week, segment, result, activity, participant, segmentEffort, season } from '../db/schema';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import { Week } from '../db/schema'; // Import Drizzle Week type
import { WeekWithDetails } from '../types/custom'; // Import the new custom type
import {
  secondsToHHMMSS,
  isoToUnix,
  normalizeTimeWithZ,
  defaultDayTimeWindow
} from '../dateUtils';
import { getAthleteProfilePictures } from './StravaProfileService';

// Notes field constraints
const NOTES_MAX_LENGTH = 1000;

class WeekService {
  constructor(private db: BetterSQLite3Database) {}

  /**
   * Get all weeks for a season - lightweight version for dropdowns (no participant count)
   * Much faster: no JOINs to result table, no COUNT aggregation
   * Used by: week selector dropdown on main page
   */
  async getAllWeeksSummary(seasonId: number): Promise<WeekWithDetails[]> {
    if (!seasonId) {
      throw new Error('season_id is required');
    }

    return this.db
      .select({
        id: week.id,
        season_id: week.season_id,
        week_name: week.week_name,
        strava_segment_id: week.strava_segment_id,
        required_laps: week.required_laps,
        start_at: week.start_at,
        end_at: week.end_at,
        notes: week.notes,
        created_at: week.created_at,
        // Joined fields
        segment_name: segment.name,
        segment_distance: segment.distance,
        segment_total_elevation_gain: segment.total_elevation_gain,
        segment_average_grade: segment.average_grade,
        segment_climb_category: segment.climb_category,
        segment_city: segment.city,
        segment_state: segment.state,
        segment_country: segment.country,
        participants_count: sql<number>`0`, // Placeholder - not used in dropdown
      })
      .from(week)
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .where(eq(week.season_id, seasonId))
      .orderBy(desc(week.start_at))
      .all() as unknown as WeekWithDetails[];
  }

  /**
   * Get all weeks for a season - full version with participant count
   * Used by: admin schedule table (ScheduleTable.tsx) which displays participants_count
   * NOTE: Database index on result(week_id, strava_athlete_id) improves performance
   */
  async getAllWeeks(seasonId: number): Promise<WeekWithDetails[]> { // Specify return type
    if (!seasonId) {
      throw new Error('season_id is required');
    }

    return this.db
      .select({
        id: week.id,
        season_id: week.season_id,
        week_name: week.week_name,
        strava_segment_id: week.strava_segment_id,
        required_laps: week.required_laps,
        start_at: week.start_at,
        end_at: week.end_at,
        notes: week.notes,
        created_at: week.created_at,
        // Joined fields
        segment_name: segment.name,
        segment_distance: segment.distance,
        segment_total_elevation_gain: segment.total_elevation_gain,
        segment_average_grade: segment.average_grade,
        segment_climb_category: segment.climb_category,
        segment_city: segment.city,
        segment_state: segment.state,
        segment_country: segment.country,
        participants_count: sql<number>`cast(count(distinct ${result.strava_athlete_id}) as integer)`, // Cast to integer
      })
      .from(week)
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .leftJoin(result, eq(week.id, result.week_id))
      .where(eq(week.season_id, seasonId))
      .groupBy(week.id, segment.strava_segment_id) // Group by segment.strava_segment_id
      .orderBy(desc(week.start_at))
      .all() as unknown as WeekWithDetails[];
  }

  /**
   * Get a single week by ID
   */
  async getWeekById(weekId: number): Promise<WeekWithDetails> { // Specify return type
    const foundWeek = this.db
      .select({
        id: week.id,
        season_id: week.season_id,
        week_name: week.week_name,
        strava_segment_id: week.strava_segment_id,
        required_laps: week.required_laps,
        start_at: week.start_at,
        end_at: week.end_at,
        notes: week.notes,
        created_at: week.created_at,
        // Joined fields
        segment_name: segment.name,
        segment_distance: segment.distance,
        segment_total_elevation_gain: segment.total_elevation_gain,
        segment_average_grade: segment.average_grade,
        segment_climb_category: segment.climb_category,
        segment_city: segment.city,
        segment_state: segment.state,
        segment_country: segment.country,
        participants_count: sql<number>`cast(count(distinct ${result.strava_athlete_id}) as integer)`, // Cast to integer
      })
      .from(week)
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .leftJoin(result, eq(week.id, result.week_id))
      .where(eq(week.id, weekId))
      .groupBy(week.id, segment.strava_segment_id) // Group by segment.strava_segment_id
      .get() as unknown as WeekWithDetails;

    if (!foundWeek) {
      throw new Error('Week not found');
    }

    // Ensure return value is a promise since function is async-compatible (even if better-sqlite3 is sync)
    return Promise.resolve(foundWeek);
  }

  /**
   * Get leaderboard for a week (compute scores on-read for deletion safety)
   * Now async to fetch profile pictures from Strava
   */
  async getWeekLeaderboard(weekId: number): Promise<{ week: any; leaderboard: any[] }> {
    const weekData = await this.getWeekById(weekId); // Await the promise

    // IMPORTANT: Compute leaderboard scores on read, not from stored database records
    // This ensures scores are always correct even if users delete their data

    // Get activities with their segment efforts (sorted by total time)
    const activitiesWithTotals = this.db
      .select({
        activity_id: activity.id,
        participant_id: activity.strava_athlete_id,
        strava_activity_id: activity.strava_activity_id,
        device_name: activity.device_name,
        name: participant.name,
        total_time_seconds: sql<number>`sum(${segmentEffort.elapsed_seconds})`,
        achieved_pr: sql<number>`max(${segmentEffort.pr_achieved})`
      })
      .from(activity)
      .innerJoin(segmentEffort, eq(activity.id, segmentEffort.activity_id))
      .innerJoin(participant, eq(activity.strava_athlete_id, participant.strava_athlete_id))
      .where(and(
        eq(activity.week_id, weekId),
        eq(activity.validation_status, 'valid'),
        eq(segmentEffort.strava_segment_id, weekData.strava_segment_id)
      ))
      .groupBy(activity.id)
      .orderBy(sql`sum(${segmentEffort.elapsed_seconds}) asc`)
      .all();

    // Fetch profile pictures for all athletes in this leaderboard
    const athleteIds = activitiesWithTotals.map(a => a.participant_id);
    const profilePictures = await getAthleteProfilePictures(athleteIds, this.db);

    // Compute leaderboard scores from activities (always correct)
    const totalParticipants = activitiesWithTotals.length;
    const leaderboard: any[] = activitiesWithTotals.map((act, index) => {
      const rank = index + 1;
      const basePoints = totalParticipants - rank + 1;
      const prBonus = act.achieved_pr ? 1 : 0;
      const totalPoints = basePoints + prBonus;

      // Fetch individual segment efforts for this activity
      const efforts = this.db
        .select({
          elapsed_seconds: segmentEffort.elapsed_seconds,
          effort_index: segmentEffort.effort_index,
          pr_achieved: segmentEffort.pr_achieved,
          strava_effort_id: segmentEffort.strava_effort_id
        })
        .from(segmentEffort)
        .where(and(
          eq(segmentEffort.activity_id, act.activity_id),
          eq(segmentEffort.strava_segment_id, weekData.strava_segment_id)
        ))
        .orderBy(segmentEffort.effort_index)
        .all();

      // Build effort breakdown (only if more than 1 effort required)
      let effortBreakdown: any[] | undefined = undefined;
      if (weekData.required_laps > 1) {
        effortBreakdown = efforts.map((e) => ({
          lap: e.effort_index + 1,
          time_seconds: e.elapsed_seconds,
          time_hhmmss: secondsToHHMMSS(e.elapsed_seconds),
          is_pr: e.pr_achieved ? true : false,
          strava_effort_id: e.strava_effort_id
        }));
      }

      return {
        rank: rank,
        participant_id: act.participant_id,
        name: act.name,
        total_time_seconds: act.total_time_seconds,
        time_hhmmss: secondsToHHMMSS(act.total_time_seconds),
        profile_picture_url: profilePictures.get(act.participant_id) || null,
        effort_breakdown: effortBreakdown,
        points: totalPoints,
        pr_bonus_points: prBonus,
        device_name: act.device_name || undefined,
        activity_url: `https://www.strava.com/activities/${act.strava_activity_id}/`,
        strava_effort_id: efforts.length > 0 ? efforts[0].strava_effort_id : null
      };
    });

    return { week: weekData, leaderboard };
  }

  /**
   * Get activities for a week
   */
  getWeekActivities(weekId: number) {
    return this.db
      .select({
        id: activity.id,
        participant_id: activity.strava_athlete_id,
        participant_name: participant.name,
        strava_activity_id: activity.strava_activity_id,
        validation_status: activity.validation_status,
        validation_message: activity.validation_message
      })
      .from(activity)
      .innerJoin(participant, eq(activity.strava_athlete_id, participant.strava_athlete_id))
      .where(eq(activity.week_id, weekId))
      .orderBy(activity.strava_athlete_id)
      .all();
  }

  /**
   * Create a new week
   */
  createWeek(data: {
    season_id?: number;
    week_name: string;
    segment_id: number;
    segment_name?: string;
    required_laps: number;
    start_at?: number;
    end_at?: number;
    notes?: string;
  }): Week {
    const { season_id, week_name, segment_id, segment_name, required_laps, start_at, end_at, notes } =
      data;

    console.log('WeekService.createWeek - Input data:', JSON.stringify(data, null, 2));

    let finalSeasonId = season_id;
    if (!finalSeasonId) {
      const activeSeason = this.db
        .select()
        .from(season)
        .where(eq(season.is_active, 1))
        .limit(1)
        .get();
      
      if (!activeSeason) {
        console.error('No active season found');
        throw new Error(
          'No active season found. Please create an active season first or provide season_id.'
        );
      }
      finalSeasonId = activeSeason.id;
      console.log('Using active season:', finalSeasonId);
    }

    // Validate required fields
    if (
      !week_name ||
      !segment_id ||
      !required_laps ||
      start_at === undefined ||
      end_at === undefined
    ) {
      console.error('Missing required fields:', {
        week_name,
        segment_id,
        required_laps,
        start_at,
        end_at
      });
      throw new Error('Missing required fields: week_name, segment_id, required_laps, start_at, end_at');
    }

    // Validate season exists
    const seasonExists = this.db
      .select({ id: season.id })
      .from(season)
      .where(eq(season.id, finalSeasonId))
      .get();
      
    if (!seasonExists) {
      console.error('Invalid season_id:', finalSeasonId);
      throw new Error('Invalid season_id');
    }

    // Ensure segment exists
    if (segment_id) {
      const existingSegment = this.db
        .select({ strava_segment_id: segment.strava_segment_id })
        .from(segment)
        .where(eq(segment.strava_segment_id, segment_id))
        .get();
        
      if (!existingSegment) {
        const segmentNameToUse = segment_name || `Segment ${segment_id}`;
        console.log('Creating new segment:', segment_id, segmentNameToUse);
        this.db
          .insert(segment)
          .values({
            strava_segment_id: segment_id,
            name: segmentNameToUse
          })
          .run();
      }
    } else {
      throw new Error('segment_id is required');
    }

    // Validate notes length
    if (notes && notes.length > NOTES_MAX_LENGTH) {
      throw new Error(`Notes cannot exceed ${NOTES_MAX_LENGTH} characters (provided: ${notes.length})`);
    }

    try {
      console.log('Inserting week:', {
        season_id: finalSeasonId,
        week_name,
        segment_id,
        required_laps,
        start_at,
        end_at,
        notes
      });

      const result = this.db
        .insert(week)
        .values({
          season_id: finalSeasonId,
          week_name,
          strava_segment_id: segment_id,
          required_laps,
          start_at,
          end_at,
          notes: notes || ''
        })
        .returning()
        .get();

      // We need to return the joined structure, so we fetch it back
      // Note: Drizzle's returning() only gives the inserted row
      return result;
    } catch (error) {
      console.error('Failed to create week:', error);
      throw error;
    }
  }

  /**
   * Update a week
   */
  updateWeek(
    weekId: number,
    updates: {
      season_id?: number;
      week_name?: string;
      date?: string;
      segment_id?: number;
      required_laps?: number;
      start_time?: string;
      end_time?: string;
      start_at?: number;
      end_at?: number;
      segment_name?: string;
      notes?: string;
    }
  ): Week {
    const {
      season_id,
      week_name,
      date,
      segment_id,
      required_laps,
      start_time,
      end_time,
      start_at,
      end_at,
      segment_name,
      notes
    } = updates;

    // Check if week exists
    const existingWeek = this.db
      .select({ id: week.id })
      .from(week)
      .where(eq(week.id, weekId))
      .get();
      
    if (!existingWeek) {
      throw new Error('Week not found');
    }

    // Check if any updates are provided
    const hasUpdates =
      season_id !== undefined ||
      week_name !== undefined ||
      date !== undefined ||
      segment_id !== undefined ||
      required_laps !== undefined ||
      start_time !== undefined ||
      end_time !== undefined ||
      start_at !== undefined ||
      end_at !== undefined ||
      notes !== undefined;
    if (!hasUpdates) {
      throw new Error('No fields to update');
    }

    // Build update object
    const updateData: any = {};

    if (season_id !== undefined) {
      const seasonExists = this.db
        .select({ id: season.id })
        .from(season)
        .where(eq(season.id, season_id))
        .get();
        
      if (!seasonExists) {
        throw new Error('Invalid season_id');
      }
      updateData.season_id = season_id;
    }

    if (week_name !== undefined) {
      updateData.week_name = week_name;
    }

    // Handle timestamp updates
    if (start_at !== undefined) {
      const unixSeconds = typeof start_at === 'string' ? isoToUnix(start_at) : start_at;
      updateData.start_at = unixSeconds;
    } else if (start_time !== undefined) {
      const normalized = normalizeTimeWithZ(start_time);
      const unixSeconds = isoToUnix(normalized);
      updateData.start_at = unixSeconds;
    } else if (date !== undefined && updates.start_time === undefined && updates.start_at === undefined) {
      const window = defaultDayTimeWindow(date);
      if (window) {
        updateData.start_at = isoToUnix(window.start);
      }
    }

    if (end_at !== undefined) {
      const unixSeconds = typeof end_at === 'string' ? isoToUnix(end_at) : end_at;
      updateData.end_at = unixSeconds;
    } else if (end_time !== undefined) {
      const normalized = normalizeTimeWithZ(end_time);
      const unixSeconds = isoToUnix(normalized);
      updateData.end_at = unixSeconds;
    } else if (date !== undefined && updates.end_time === undefined && updates.end_at === undefined) {
      const window = defaultDayTimeWindow(date);
      if (window) {
        updateData.end_at = isoToUnix(window.end);
      }
    }

    if (notes !== undefined) {
      if (notes && notes.length > NOTES_MAX_LENGTH) {
        throw new Error(`Notes cannot exceed ${NOTES_MAX_LENGTH} characters (provided: ${notes.length})`);
      }
      updateData.notes = notes || '';
    }

    if (segment_id !== undefined) {
      if (segment_name !== undefined) {
        // segment_id with segment_name: Upsert the segment
        const existingSegment = this.db
          .select({ strava_segment_id: segment.strava_segment_id })
          .from(segment)
          .where(eq(segment.strava_segment_id, segment_id))
          .get();
          
        if (existingSegment) {
          this.db
            .update(segment)
            .set({ name: segment_name })
            .where(eq(segment.strava_segment_id, segment_id))
            .run();
        } else {
          this.db
            .insert(segment)
            .values({ strava_segment_id: segment_id, name: segment_name })
            .run();
        }
        updateData.strava_segment_id = segment_id;
      } else {
        // segment_id without segment_name: Must exist in database
        const existingSegment = this.db
          .select({ strava_segment_id: segment.strava_segment_id })
          .from(segment)
          .where(eq(segment.strava_segment_id, segment_id))
          .get();
          
        if (!existingSegment) {
          throw new Error(
            'Invalid segment_id. Segment does not exist. Provide segment_name to create it, or use an existing segment.'
          );
        }
        updateData.strava_segment_id = segment_id;
      }
    }

    if (required_laps !== undefined) {
      updateData.required_laps = required_laps;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No fields to update');
    }

    try {
      const updatedWeek = this.db
        .update(week)
        .set(updateData)
        .where(eq(week.id, weekId))
        .returning()
        .get();

      return updatedWeek;
    } catch (error) {
      console.error('Failed to update week:', error);
      throw error;
    }
  }

  /**
   * Delete a week (cascade deletes activities, efforts, results)
   */
  deleteWeek(weekId: number): { message: string; weekId: number } {
    // Check if week exists
    const existingWeek = this.db
      .select({ id: week.id })
      .from(week)
      .where(eq(week.id, weekId))
      .get();
      
    if (!existingWeek) {
      throw new Error('Week not found');
    }

    try {
      this.db.transaction((tx) => {
        // Get all activities for this week
        const activities = tx
          .select({ id: activity.id })
          .from(activity)
          .where(eq(activity.week_id, weekId))
          .all();
          
        const activityIds = activities.map((a) => a.id);

        // Delete segment efforts for these activities
        if (activityIds.length > 0) {
          tx.delete(segmentEffort).where(inArray(segmentEffort.activity_id, activityIds)).run();
        }

        // Delete results for this week
        tx.delete(result).where(eq(result.week_id, weekId)).run();

        // Delete activities for this week
        tx.delete(activity).where(eq(activity.week_id, weekId)).run();

        // Delete the week itself
        tx.delete(week).where(eq(week.id, weekId)).run();
      });

      return { message: 'Week deleted successfully', weekId };
    } catch (error) {
      console.error('Failed to delete week:', error);
      throw error;
    }
  }
}

export default WeekService;
