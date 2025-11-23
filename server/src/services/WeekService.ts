/**
 * WeekService.ts
 * Encapsulates all business logic for week management
 */

import { Database } from 'better-sqlite3';
import {
  secondsToHHMMSS,
  isoToUnix,
  normalizeTimeWithZ,
  defaultDayTimeWindow
} from '../dateUtils';
import { getAthleteProfilePictures } from './StravaProfileService';

// Notes field constraints
const NOTES_MAX_LENGTH = 1000;

interface Week {
  id: number;
  season_id: number;
  week_name: string;
  segment_id: number;
  required_laps: number;
  start_at: number;
  end_at: number;
  notes?: string;
  segment_name?: string;
  segment_distance?: number;
  total_elevation_gain?: number;
  segment_average_grade?: number;
}

interface Leaderboard {
  rank: number;
  participant_id: number;
  name: string;
  total_time_seconds: number;
  time_hhmmss: string | null;
  profile_picture_url?: string | null; // Strava athlete profile picture
  effort_breakdown?: Array<{
    lap: number;
    time_seconds: number;
    time_hhmmss: string | null;
    is_pr: boolean;
    strava_effort_id?: string;
  }>;
  points: number;
  pr_bonus_points: number;
  device_name?: string;
  activity_url: string;
  strava_effort_id?: string | null;
}

interface WeekLeaderboardResponse {
  week: Week;
  leaderboard: Leaderboard[];
}

class WeekService {
  constructor(private db: Database) {}

  /**
   * Get all weeks for a season
   */
  getAllWeeks(seasonId: number): Week[] {
    if (!seasonId) {
      throw new Error('season_id is required');
    }

    const query = `
      SELECT w.id, w.season_id, w.week_name, w.strava_segment_id as segment_id, w.required_laps, 
             w.start_at, w.end_at, w.notes, s.name as segment_name, 
             s.distance as segment_distance, s.total_elevation_gain, s.average_grade as segment_average_grade,
             COUNT(DISTINCT r.strava_athlete_id) as participants_count
      FROM week w
      LEFT JOIN segment s ON w.strava_segment_id = s.strava_segment_id
      LEFT JOIN result r ON w.id = r.week_id
      WHERE w.season_id = ?
      GROUP BY w.id, w.season_id, w.week_name, w.strava_segment_id, w.required_laps, w.start_at, w.end_at, w.notes, s.name,
               s.distance, s.total_elevation_gain, s.average_grade
      ORDER BY w.start_at DESC
    `;

    return this.db.prepare(query).all(seasonId) as Week[];
  }

  /**
   * Get a single week by ID
   */
  getWeekById(weekId: number): Week {
    const week = this.db
      .prepare(
        `SELECT w.id, w.season_id, w.week_name, w.strava_segment_id as segment_id, w.required_laps, 
                w.start_at, w.end_at, w.notes, s.name as segment_name,
                s.distance as segment_distance, s.total_elevation_gain, s.average_grade as segment_average_grade,
                COUNT(DISTINCT r.strava_athlete_id) as participants_count
         FROM week w
         LEFT JOIN segment s ON w.strava_segment_id = s.strava_segment_id
         LEFT JOIN result r ON w.id = r.week_id
         WHERE w.id = ?
         GROUP BY w.id, w.season_id, w.week_name, w.strava_segment_id, w.required_laps, w.start_at, w.end_at, w.notes, s.name,
                  s.distance, s.total_elevation_gain, s.average_grade`
      )
      .get(weekId) as Week | undefined;

    if (!week) {
      throw new Error('Week not found');
    }

    return week;
  }

  /**
   * Get leaderboard for a week (compute scores on-read for deletion safety)
   * Now async to fetch profile pictures from Strava
   */
  async getWeekLeaderboard(weekId: number): Promise<WeekLeaderboardResponse> {
    const week = this.getWeekById(weekId);

    // IMPORTANT: Compute leaderboard scores on read, not from stored database records
    // This ensures scores are always correct even if users delete their data

    // Get activities with their segment efforts (sorted by total time)
    const activitiesWithTotals = this.db
      .prepare(
        `SELECT 
          a.id as activity_id,
          a.strava_athlete_id as participant_id,
          a.strava_activity_id,
          a.device_name,
          p.name,
          SUM(se.elapsed_seconds) as total_time_seconds,
          MAX(se.pr_achieved) as achieved_pr
        FROM activity a
        JOIN segment_effort se ON a.id = se.activity_id
        JOIN participant p ON a.strava_athlete_id = p.strava_athlete_id
        WHERE a.week_id = ? AND a.validation_status = 'valid' AND se.strava_segment_id = ?
        GROUP BY a.id, a.strava_athlete_id, a.strava_activity_id, a.device_name, p.name
        ORDER BY total_time_seconds ASC`
      )
      .all(weekId, week.segment_id) as Array<{
      activity_id: number;
      participant_id: number;
      strava_activity_id: number;
      device_name: string | null;
      name: string;
      total_time_seconds: number;
      achieved_pr: number;
    }>;

    // Fetch profile pictures for all athletes in this leaderboard
    const athleteIds = activitiesWithTotals.map(a => a.participant_id);
    const profilePictures = await getAthleteProfilePictures(athleteIds, this.db);

    // Compute leaderboard scores from activities (always correct)
    const totalParticipants = activitiesWithTotals.length;
    const leaderboard: Leaderboard[] = activitiesWithTotals.map((activity, index) => {
      const rank = index + 1;
      const basePoints = totalParticipants - rank + 1;
      const prBonus = activity.achieved_pr ? 1 : 0;
      const totalPoints = basePoints + prBonus;

      // Fetch individual segment efforts for this activity
      const efforts = this.db
        .prepare(
          `SELECT elapsed_seconds, effort_index, pr_achieved, strava_effort_id
           FROM segment_effort
           WHERE activity_id = ? AND strava_segment_id = ?
           ORDER BY effort_index ASC`
        )
        .all(activity.activity_id, week.segment_id) as Array<{
        elapsed_seconds: number;
        effort_index: number;
        pr_achieved: number;
        strava_effort_id: string;
      }>;

      // Build effort breakdown (only if more than 1 effort required)
      let effortBreakdown: Leaderboard['effort_breakdown'] = undefined;
      if (week.required_laps > 1) {
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
        participant_id: activity.participant_id,
        name: activity.name,
        total_time_seconds: activity.total_time_seconds,
        time_hhmmss: secondsToHHMMSS(activity.total_time_seconds),
        profile_picture_url: profilePictures.get(activity.participant_id) || null,
        effort_breakdown: effortBreakdown,
        points: totalPoints,
        pr_bonus_points: prBonus,
        device_name: activity.device_name || undefined,
        activity_url: `https://www.strava.com/activities/${activity.strava_activity_id}/`,
        strava_effort_id: efforts.length > 0 ? efforts[0].strava_effort_id : null
      };
    });

    return { week, leaderboard };
  }

  /**
   * Get activities for a week
   */
  getWeekActivities(weekId: number): Array<{
    id: number;
    participant_id: number;
    participant_name: string;
    strava_activity_id: number;
    validation_status: string;
    validation_message?: string;
  }> {
    const activities = this.db
      .prepare(
        `SELECT 
          a.id,
          a.strava_athlete_id as participant_id,
          p.name as participant_name,
          a.strava_activity_id,
          a.validation_status,
          a.validation_message
        FROM activity a
        JOIN participant p ON a.strava_athlete_id = p.strava_athlete_id
        WHERE a.week_id = ?
        ORDER BY a.strava_athlete_id`
      )
      .all(weekId) as Array<{
      id: number;
      participant_id: number;
      participant_name: string;
      strava_activity_id: number;
      validation_status: string;
      validation_message?: string;
    }>;

    return activities;
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
        .prepare('SELECT id FROM season WHERE is_active = 1 LIMIT 1')
        .get() as { id: number } | undefined;
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
    const season = this.db
      .prepare('SELECT id FROM season WHERE id = ?')
      .get(finalSeasonId) as { id: number } | undefined;
    if (!season) {
      console.error('Invalid season_id:', finalSeasonId);
      throw new Error('Invalid season_id');
    }

    // Ensure segment exists
    if (segment_id) {
      const existingSegment = this.db
        .prepare('SELECT strava_segment_id FROM segment WHERE strava_segment_id = ?')
        .get(segment_id) as { strava_segment_id: number } | undefined;
      if (!existingSegment) {
        const segmentNameToUse = segment_name || `Segment ${segment_id}`;
        console.log('Creating new segment:', segment_id, segmentNameToUse);
        this.db
          .prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)')
          .run(segment_id, segmentNameToUse);
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
        .prepare(
          `INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(finalSeasonId, week_name, segment_id, required_laps, start_at, end_at, notes || '');

      const newWeek = this.db
        .prepare(
          `SELECT w.id, w.season_id, w.week_name, w.strava_segment_id as segment_id, w.required_laps, 
                  w.start_at, w.end_at, w.notes, s.name as segment_name
           FROM week w
           LEFT JOIN segment s ON w.strava_segment_id = s.strava_segment_id
           WHERE w.id = ?`
        )
        .get((result as any).lastInsertRowid) as Week;

      console.log('Week created successfully:', newWeek);
      return newWeek;
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
      .prepare('SELECT id FROM week WHERE id = ?')
      .get(weekId) as { id: number } | undefined;
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

    // Build dynamic update query
    const updateClauses: string[] = [];
    const values: any[] = [];

    if (season_id !== undefined) {
      const season = this.db
        .prepare('SELECT id FROM season WHERE id = ?')
        .get(season_id) as { id: number } | undefined;
      if (!season) {
        throw new Error('Invalid season_id');
      }
      updateClauses.push('season_id = ?');
      values.push(season_id);
    }

    if (week_name !== undefined) {
      updateClauses.push('week_name = ?');
      values.push(week_name);
    }

    // Handle timestamp updates (support both old and new parameter names)
    if (start_at !== undefined) {
      const unixSeconds = typeof start_at === 'string' ? isoToUnix(start_at) : start_at;
      updateClauses.push('start_at = ?');
      values.push(unixSeconds);
    } else if (start_time !== undefined) {
      const normalized = normalizeTimeWithZ(start_time);
      const unixSeconds = isoToUnix(normalized);
      updateClauses.push('start_at = ?');
      values.push(unixSeconds);
    } else if (date !== undefined && updates.start_time === undefined && updates.start_at === undefined) {
      const window = defaultDayTimeWindow(date);
      if (window) {
        const startAtUnix = isoToUnix(window.start);
        updateClauses.push('start_at = ?');
        values.push(startAtUnix);
      }
    }

    if (end_at !== undefined) {
      const unixSeconds = typeof end_at === 'string' ? isoToUnix(end_at) : end_at;
      updateClauses.push('end_at = ?');
      values.push(unixSeconds);
    } else if (end_time !== undefined) {
      const normalized = normalizeTimeWithZ(end_time);
      const unixSeconds = isoToUnix(normalized);
      updateClauses.push('end_at = ?');
      values.push(unixSeconds);
    } else if (date !== undefined && updates.end_time === undefined && updates.end_at === undefined) {
      const window = defaultDayTimeWindow(date);
      if (window) {
        const endAtUnix = isoToUnix(window.end);
        updateClauses.push('end_at = ?');
        values.push(endAtUnix);
      }
    }

    if (notes !== undefined) {
      // Validate notes length
      if (notes && notes.length > NOTES_MAX_LENGTH) {
        throw new Error(`Notes cannot exceed ${NOTES_MAX_LENGTH} characters (provided: ${notes.length})`);
      }
      updateClauses.push('notes = ?');
      values.push(notes || '');
    }

    if (segment_id !== undefined) {
      if (segment_name !== undefined) {
        // segment_id with segment_name: Upsert the segment
        const existingSegment = this.db
          .prepare('SELECT strava_segment_id FROM segment WHERE strava_segment_id = ?')
          .get(segment_id) as { strava_segment_id: number } | undefined;
        if (existingSegment) {
          // Update existing segment name
          this.db
            .prepare('UPDATE segment SET name = ? WHERE strava_segment_id = ?')
            .run(segment_name, segment_id);
        } else {
          // Insert new segment
          this.db
            .prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)')
            .run(segment_id, segment_name);
        }

        // Update week to point to this Strava segment ID
        updateClauses.push('strava_segment_id = ?');
        values.push(segment_id);
      } else {
        // segment_id without segment_name: Must exist in database
        const existingSegment = this.db
          .prepare('SELECT strava_segment_id FROM segment WHERE strava_segment_id = ?')
          .get(segment_id) as { strava_segment_id: number } | undefined;
        if (!existingSegment) {
          throw new Error(
            'Invalid segment_id. Segment does not exist. Provide segment_name to create it, or use an existing segment.'
          );
        }
        updateClauses.push('strava_segment_id = ?');
        values.push(segment_id);
      }
    }

    if (required_laps !== undefined) {
      updateClauses.push('required_laps = ?');
      values.push(required_laps);
    }

    if (updateClauses.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(weekId);

    try {
      this.db.prepare(`UPDATE week SET ${updateClauses.join(', ')} WHERE id = ?`).run(...values);

      const updatedWeek = this.db
        .prepare(
          `SELECT id, season_id, week_name, strava_segment_id as segment_id, required_laps, start_at, end_at, notes
           FROM week WHERE id = ?`
        )
        .get(weekId) as Week;

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
      .prepare('SELECT id FROM week WHERE id = ?')
      .get(weekId) as { id: number } | undefined;
    if (!existingWeek) {
      throw new Error('Week not found');
    }

    try {
      this.db.transaction(() => {
        // Get all activities for this week
        const activities = this.db
          .prepare('SELECT id FROM activity WHERE week_id = ?')
          .all(weekId) as Array<{ id: number }>;
        const activityIds = activities.map((a) => a.id);

        // Delete segment efforts for these activities
        if (activityIds.length > 0) {
          const placeholders = activityIds.map(() => '?').join(',');
          this.db
            .prepare(`DELETE FROM segment_effort WHERE activity_id IN (${placeholders})`)
            .run(...activityIds);
        }

        // Delete results for this week
        this.db.prepare('DELETE FROM result WHERE week_id = ?').run(weekId);

        // Delete activities for this week
        this.db.prepare('DELETE FROM activity WHERE week_id = ?').run(weekId);

        // Delete the week itself
        this.db.prepare('DELETE FROM week WHERE id = ?').run(weekId);
      })();

      return { message: 'Week deleted successfully', weekId };
    } catch (error) {
      console.error('Failed to delete week:', error);
      throw error;
    }
  }
}

export default WeekService;
