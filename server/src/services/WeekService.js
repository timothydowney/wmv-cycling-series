/**
 * WeekService
 * 
 * Encapsulates all business logic for week management:
 * - Creating weeks with segment validation
 * - Updating weeks (fields, timestamps, segments)
 * - Deleting weeks (cascade deletes activities, efforts, results)
 * - Querying weeks and leaderboards
 * 
 * Responsibility separation:
 * - Service: DB queries, business logic, validations, transactions
 * - Route handlers: HTTP status codes, error mapping, request parsing
 */

const { secondsToHHMMSS, isoToUnix, normalizeTimeWithZ, defaultDayTimeWindow } = require('../dateUtils');

class WeekService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get all weeks for a season
   * @param {number} seasonId - Season ID
   * @returns {Array} List of weeks with segment details
   */
  getAllWeeks(seasonId) {
    if (!seasonId) {
      throw new Error('season_id is required');
    }

    const query = `
      SELECT w.id, w.season_id, w.week_name, w.strava_segment_id as segment_id, w.required_laps, 
             w.start_at, w.end_at, s.name as segment_name
      FROM week w
      LEFT JOIN segment s ON w.strava_segment_id = s.strava_segment_id
      WHERE w.season_id = ?
      ORDER BY w.start_at DESC
    `;
    
    return this.db.prepare(query).all(seasonId);
  }

  /**
   * Get a single week by ID
   * @param {number} weekId - Week ID
   * @returns {Object} Week details with segment info
   * @throws {Error} Week not found
   */
  getWeekById(weekId) {
    const week = this.db.prepare(`
      SELECT w.id, w.season_id, w.week_name, w.strava_segment_id as segment_id, w.required_laps, 
             w.start_at, w.end_at, s.name as segment_name
      FROM week w
      LEFT JOIN segment s ON w.strava_segment_id = s.strava_segment_id
      WHERE w.id = ?
    `).get(weekId);

    if (!week) {
      throw new Error('Week not found');
    }

    return week;
  }

  /**
   * Get leaderboard for a week (compute scores on-read for deletion safety)
   * @param {number} weekId - Week ID
   * @returns {Object} { week, leaderboard }
   * @throws {Error} Week not found
   */
  getWeekLeaderboard(weekId) {
    const week = this.getWeekById(weekId);

    // IMPORTANT: Compute leaderboard scores on read, not from stored database records
    // This ensures scores are always correct even if users delete their data
    // Scoring is computed fresh from activities table each time
    
    // Get activities with their segment efforts (sorted by total time)
    const activitiesWithTotals = this.db.prepare(`
      SELECT 
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
      ORDER BY total_time_seconds ASC
    `).all(weekId, week.segment_id);

    // Compute leaderboard scores from activities (always correct)
    const totalParticipants = activitiesWithTotals.length;
    const leaderboard = activitiesWithTotals.map((activity, index) => {
      const rank = index + 1;
      const basePoints = (totalParticipants - rank) + 1;  // Beat (total - rank) people + 1 for competing
      const prBonus = activity.achieved_pr ? 1 : 0;
      const totalPoints = basePoints + prBonus;
      
      // Fetch individual segment efforts for this activity
      const efforts = this.db.prepare(`
        SELECT elapsed_seconds, effort_index, pr_achieved, strava_effort_id
        FROM segment_effort
        WHERE activity_id = ? AND strava_segment_id = ?
        ORDER BY effort_index ASC
      `).all(activity.activity_id, week.segment_id);
      
      // Build effort breakdown (only if more than 1 effort required)
      let effortBreakdown = null;
      if (week.required_laps > 1) {
        effortBreakdown = efforts.map(e => ({
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
        effort_breakdown: effortBreakdown,  // null if only 1 lap, array if multiple
        points: totalPoints,
        pr_bonus_points: prBonus,
        device_name: activity.device_name,
        activity_url: `https://www.strava.com/activities/${activity.strava_activity_id}/`,
        strava_effort_id: efforts.length > 0 ? efforts[0].strava_effort_id : null  // For single-lap linking
      };
    });
    
    return { week, leaderboard };
  }

  /**
   * Get activities for a week
   * @param {number} weekId - Week ID
   * @returns {Array} List of activities for the week (empty if week doesn't exist)
   */
  getWeekActivities(weekId) {
    // Note: Does NOT throw if week doesn't exist - returns empty array instead
    // This matches test expectations for /weeks/:id/activities behavior
    const activities = this.db.prepare(`
      SELECT 
        a.id,
        a.strava_athlete_id as participant_id,
        p.name as participant_name,
        a.strava_activity_id,
        a.validation_status,
        a.validation_message
      FROM activity a
      JOIN participant p ON a.strava_athlete_id = p.strava_athlete_id
      WHERE a.week_id = ?
      ORDER BY a.strava_athlete_id
    `).all(weekId);

    return activities;
  }

  /**
   * Create a new week
   * @param {Object} data - Week data { season_id, week_name, segment_id, segment_name, required_laps, start_at, end_at }
   * @returns {Object} Created week
   * @throws {Error} Validation errors (missing fields, invalid season, etc.)
   */
  createWeek(data) {
    const { season_id, week_name, segment_id, segment_name, required_laps, start_at, end_at } = data;

    console.log('WeekService.createWeek - Input data:', JSON.stringify(data, null, 2));

    let finalSeasonId = season_id;
    if (!finalSeasonId) {
      const activeSeason = this.db.prepare('SELECT id FROM season WHERE is_active = 1 LIMIT 1').get();
      if (!activeSeason) {
        console.error('No active season found');
        throw new Error('No active season found. Please create an active season first or provide season_id.');
      }
      finalSeasonId = activeSeason.id;
      console.log('Using active season:', finalSeasonId);
    }

    // Validate required fields
    if (!week_name || !segment_id || !required_laps || start_at === undefined || end_at === undefined) {
      console.error('Missing required fields:', { week_name, segment_id, required_laps, start_at, end_at });
      throw new Error('Missing required fields: week_name, segment_id, required_laps, start_at, end_at');
    }

    // Validate season exists
    const season = this.db.prepare('SELECT id FROM season WHERE id = ?').get(finalSeasonId);
    if (!season) {
      console.error('Invalid season_id:', finalSeasonId);
      throw new Error('Invalid season_id');
    }

    // Ensure segment exists
    if (segment_id) {
      const existingSegment = this.db.prepare('SELECT strava_segment_id FROM segment WHERE strava_segment_id = ?').get(segment_id);
      if (!existingSegment) {
        const segmentNameToUse = segment_name || `Segment ${segment_id}`;
        console.log('Creating new segment:', segment_id, segmentNameToUse);
        this.db.prepare(`
          INSERT INTO segment (strava_segment_id, name)
          VALUES (?, ?)
        `).run(segment_id, segmentNameToUse);
      }
    } else {
      throw new Error('segment_id is required');
    }

    try {
      console.log('Inserting week:', { 
        season_id: finalSeasonId, 
        week_name, 
        segment_id, 
        required_laps, 
        start_at, 
        end_at 
      });
      
      const result = this.db.prepare(`
        INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(finalSeasonId, week_name, segment_id, required_laps, start_at, end_at);

      const newWeek = this.db.prepare(`
        SELECT w.id, w.season_id, w.week_name, w.strava_segment_id as segment_id, w.required_laps, 
               w.start_at, w.end_at, s.name as segment_name
        FROM week w
        LEFT JOIN segment s ON w.strava_segment_id = s.strava_segment_id
        WHERE w.id = ?
      `).get(result.lastInsertRowid);

      console.log('Week created successfully:', newWeek);
      return newWeek;
    } catch (error) {
      console.error('Failed to create week:', error);
      throw error;
    }
  }

  /**
   * Update a week
   * @param {number} weekId - Week ID
   * @param {Object} updates - Fields to update { season_id, week_name, segment_id, required_laps, start_at, end_at, ... }
   * @returns {Object} Updated week
   * @throws {Error} Week not found, validation errors
   */
  updateWeek(weekId, updates) {
    const { 
      season_id, week_name, date, segment_id, required_laps, 
      start_time, end_time, start_at, end_at, segment_name 
    } = updates;

    // Check if week exists
    const existingWeek = this.db.prepare('SELECT id FROM week WHERE id = ?').get(weekId);
    if (!existingWeek) {
      throw new Error('Week not found');
    }

    // Check if any updates are provided
    const hasUpdates = season_id !== undefined || week_name !== undefined || date !== undefined || 
                       segment_id !== undefined || required_laps !== undefined || 
                       start_time !== undefined || end_time !== undefined || 
                       start_at !== undefined || end_at !== undefined;
    if (!hasUpdates) {
      throw new Error('No fields to update');
    }

    // Build dynamic update query
    const updateClauses = [];
    const values = [];

    if (season_id !== undefined) {
      const season = this.db.prepare('SELECT id FROM season WHERE id = ?').get(season_id);
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
      // Old parameter name for backwards compatibility
      const normalized = normalizeTimeWithZ(start_time);
      const unixSeconds = isoToUnix(normalized);
      updateClauses.push('start_at = ?');
      values.push(unixSeconds);
    } else if (date !== undefined && (updates.start_time === undefined && updates.start_at === undefined)) {
      // If only date is provided (and no explicit time), compute start_at as midnight on that date
      const window = defaultDayTimeWindow(date);
      const startAtUnix = isoToUnix(window.start);
      updateClauses.push('start_at = ?');
      values.push(startAtUnix);
    }

    if (end_at !== undefined) {
      const unixSeconds = typeof end_at === 'string' ? isoToUnix(end_at) : end_at;
      updateClauses.push('end_at = ?');
      values.push(unixSeconds);
    } else if (end_time !== undefined) {
      // Old parameter name for backwards compatibility
      const normalized = normalizeTimeWithZ(end_time);
      const unixSeconds = isoToUnix(normalized);
      updateClauses.push('end_at = ?');
      values.push(unixSeconds);
    } else if (date !== undefined && (updates.end_time === undefined && updates.end_at === undefined)) {
      // If only date is provided (and no explicit time), compute end_at as 10pm on that date
      const window = defaultDayTimeWindow(date);
      const endAtUnix = isoToUnix(window.end);
      updateClauses.push('end_at = ?');
      values.push(endAtUnix);
    }

    if (segment_id !== undefined) {
      if (segment_name !== undefined) {
        // segment_id with segment_name: Upsert the segment
        const existingSegment = this.db.prepare('SELECT strava_segment_id FROM segment WHERE strava_segment_id = ?').get(segment_id);
        if (existingSegment) {
          // Update existing segment name
          this.db.prepare(`
            UPDATE segment 
            SET name = ?
            WHERE strava_segment_id = ?
          `).run(segment_name, segment_id);
        } else {
          // Insert new segment
          this.db.prepare(`
            INSERT INTO segment (strava_segment_id, name)
            VALUES (?, ?)
          `).run(segment_id, segment_name);
        }
        
        // Update week to point to this Strava segment ID
        updateClauses.push('strava_segment_id = ?');
        values.push(segment_id);
      } else {
        // segment_id without segment_name: Must exist in database
        const existingSegment = this.db.prepare('SELECT strava_segment_id FROM segment WHERE strava_segment_id = ?').get(segment_id);
        if (!existingSegment) {
          throw new Error('Invalid segment_id. Segment does not exist. Provide segment_name to create it, or use an existing segment.');
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
      this.db.prepare(`
        UPDATE week 
        SET ${updateClauses.join(', ')}
        WHERE id = ?
      `).run(...values);

      const updatedWeek = this.db.prepare(`
        SELECT id, season_id, week_name, strava_segment_id as segment_id, required_laps, start_at, end_at
        FROM week WHERE id = ?
      `).get(weekId);

      return updatedWeek;
    } catch (error) {
      console.error('Failed to update week:', error);
      throw error;
    }
  }

  /**
   * Delete a week (cascade deletes activities, efforts, results)
   * @param {number} weekId - Week ID
   * @returns {Object} Confirmation message
   * @throws {Error} Week not found
   */
  deleteWeek(weekId) {
    // Check if week exists
    const existingWeek = this.db.prepare('SELECT id FROM week WHERE id = ?').get(weekId);
    if (!existingWeek) {
      throw new Error('Week not found');
    }

    try {
      this.db.transaction(() => {
        // Get all activities for this week
        const activities = this.db.prepare('SELECT id FROM activity WHERE week_id = ?').all(weekId);
        const activityIds = activities.map(a => a.id);

        // Delete segment efforts for these activities
        if (activityIds.length > 0) {
          const placeholders = activityIds.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM segment_effort WHERE activity_id IN (${placeholders})`).run(...activityIds);
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

module.exports = WeekService;
