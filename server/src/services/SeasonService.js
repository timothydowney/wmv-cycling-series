/**
 * SeasonService
 * Handles all season-related business logic: CRUD operations, season leaderboard calculation
 * 
 * Dependencies: db (SQLite database)
 * 
 * The service is responsible for:
 * - Retrieving seasons (all, by ID, with leaderboard)
 * - Creating new seasons with auto-deactivation of others if marked active
 * - Updating season properties (name, dates, active status)
 * - Deleting seasons (with validation: must not have weeks)
 * 
 * Error Handling:
 * - Throws descriptive errors for business logic violations
 * - Routes catch and map to HTTP status codes
 */

class SeasonService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get all seasons ordered by start_at descending (newest first)
   * @returns {Array} Array of season objects
   */
  getAllSeasons() {
    const seasons = this.db.prepare(
      'SELECT id, name, start_at, end_at, is_active FROM season ORDER BY start_at DESC'
    ).all();
    return seasons;
  }

  /**
   * Get a season by ID
   * @param {number} seasonId - The season ID
   * @returns {Object} Season object with {id, name, start_at, end_at, is_active}
   * @throws {Error} 'Season not found' if season doesn't exist
   */
  getSeasonById(seasonId) {
    const season = this.db.prepare(
      'SELECT id, name, start_at, end_at, is_active FROM season WHERE id = ?'
    ).get(seasonId);

    if (!season) {
      throw new Error('Season not found');
    }

    return season;
  }

  /**
   * Get season leaderboard with computed totals
   * Calculates standings by summing weekly scores computed on-read.
   * This ensures total points are always correct even if users delete their data.
   * 
   * @param {number} seasonId - The season ID
   * @returns {Object} {season, leaderboard}
   *   - season: {id, name, start_at, end_at}
   *   - leaderboard: Array of participants with {id, strava_athlete_id, name, total_points, weeks_completed}
   * @throws {Error} 'Season not found' if season doesn't exist
   */
  getSeasonLeaderboard(seasonId) {
    // Verify season exists
    const season = this.db.prepare(
      'SELECT id, name, start_at, end_at FROM season WHERE id = ?'
    ).get(seasonId);

    if (!season) {
      throw new Error('Season not found');
    }

    // Get all weeks in this season
    const weeks = this.db.prepare(
      'SELECT id, week_name, start_at FROM week WHERE season_id = ? ORDER BY start_at ASC'
    ).all(seasonId);

    const allParticipantScores = {};  // { athlete_id: { name, total_points, weeks_completed } }

    // Compute from activities (source of truth)
    weeks.forEach(week => {
      const activities = this.db.prepare(`
        SELECT 
          a.id as activity_id,
          a.strava_athlete_id as participant_id,
          p.name,
          SUM(se.elapsed_seconds) as total_time_seconds,
          MAX(se.pr_achieved) as achieved_pr
        FROM activity a
        JOIN segment_effort se ON a.id = se.activity_id
        JOIN participant p ON a.strava_athlete_id = p.strava_athlete_id
        WHERE a.week_id = ? AND a.validation_status = 'valid'
        GROUP BY a.id, a.strava_athlete_id, p.name
        ORDER BY total_time_seconds ASC
      `).all(week.id);

      const totalParticipants = activities.length;

      // Compute scores for this week
      activities.forEach((activity, index) => {
        const rank = index + 1;
        const basePoints = (totalParticipants - rank) + 1;
        const prBonus = activity.achieved_pr ? 1 : 0;
        const weekPoints = basePoints + prBonus;

        if (!allParticipantScores[activity.participant_id]) {
          allParticipantScores[activity.participant_id] = {
            name: activity.name,
            total_points: 0,
            weeks_completed: 0
          };
        }

        allParticipantScores[activity.participant_id].total_points += weekPoints;
        allParticipantScores[activity.participant_id].weeks_completed += 1;
      });
    });

    // Convert to sorted array
    const seasonResults = Object.entries(allParticipantScores)
      .map(([id, data]) => ({
        id: parseInt(id),
        strava_athlete_id: parseInt(id),
        name: data.name,
        total_points: data.total_points,
        weeks_completed: data.weeks_completed
      }))
      .sort((a, b) => {
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points;
        }
        return b.weeks_completed - a.weeks_completed;
      });

    return {
      season,
      leaderboard: seasonResults
    };
  }

  /**
   * Create a new season
   * If is_active is true, deactivates all other seasons first
   * 
   * @param {Object} data - Season data
   *   - name: {string} Season name (required)
   *   - start_at: {number} Unix timestamp for season start (required)
   *   - end_at: {number} Unix timestamp for season end (required)
   *   - is_active: {boolean} Whether this is the active season (optional, default false)
   * @returns {Object} Created season with {id, name, start_at, end_at, is_active}
   * @throws {Error} 'Missing required fields' if name, start_at, or end_at missing
   */
  createSeason(data) {
    const { name, start_at, end_at, is_active } = data;

    if (!name || start_at === undefined || end_at === undefined) {
      throw new Error('Missing required fields: name, start_at, end_at');
    }

    // If setting as active, deactivate other seasons first
    if (is_active) {
      this.db.prepare('UPDATE season SET is_active = 0').run();
    }

    const result = this.db.prepare(`
      INSERT INTO season (name, start_at, end_at, is_active)
      VALUES (?, ?, ?, ?)
    `).run(name, start_at, end_at, is_active ? 1 : 0);

    const newSeason = this.db.prepare(
      'SELECT id, name, start_at, end_at, is_active FROM season WHERE id = ?'
    ).get(result.lastInsertRowid);

    return newSeason;
  }

  /**
   * Update an existing season
   * If is_active is true, deactivates all other seasons first
   * 
   * @param {number} seasonId - The season ID to update
   * @param {Object} updates - Fields to update (all optional)
   *   - name: {string}
   *   - start_at: {number}
   *   - end_at: {number}
   *   - is_active: {boolean}
   * @returns {Object} Updated season with {id, name, start_at, end_at, is_active}
   * @throws {Error} 'Season not found' if season doesn't exist
   * @throws {Error} 'No fields to update' if no valid fields provided
   */
  updateSeason(seasonId, updates) {
    // Verify season exists
    const existingSeason = this.db.prepare(
      'SELECT id FROM season WHERE id = ?'
    ).get(seasonId);

    if (!existingSeason) {
      throw new Error('Season not found');
    }

    // If setting as active, deactivate other seasons first
    if (updates.is_active) {
      this.db.prepare('UPDATE season SET is_active = 0').run();
    }

    // Build dynamic UPDATE query
    const updateFields = [];
    const values = [];

    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.start_at !== undefined) {
      updateFields.push('start_at = ?');
      values.push(updates.start_at);
    }
    if (updates.end_at !== undefined) {
      updateFields.push('end_at = ?');
      values.push(updates.end_at);
    }
    if (updates.is_active !== undefined) {
      updateFields.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(seasonId);
    this.db.prepare(`UPDATE season SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);

    const updatedSeason = this.db.prepare(
      'SELECT id, name, start_at, end_at, is_active FROM season WHERE id = ?'
    ).get(seasonId);

    return updatedSeason;
  }

  /**
   * Delete a season
   * Validation: cannot delete a season that has weeks
   * 
   * @param {number} seasonId - The season ID to delete
   * @returns {Object} {message: 'Season deleted successfully'}
   * @throws {Error} 'Season not found' if season doesn't exist
   * @throws {Error} 'Cannot delete season with existing weeks' if season has weeks
   */
  deleteSeason(seasonId) {
    // Verify season exists
    const existingSeason = this.db.prepare(
      'SELECT id FROM season WHERE id = ?'
    ).get(seasonId);

    if (!existingSeason) {
      throw new Error('Season not found');
    }

    // Check if season has weeks
    const weekCount = this.db.prepare(
      'SELECT COUNT(*) as count FROM week WHERE season_id = ?'
    ).get(seasonId);

    if (weekCount.count > 0) {
      throw new Error(`Cannot delete season with existing weeks: ${weekCount.count} week(s) exist`);
    }

    this.db.prepare('DELETE FROM season WHERE id = ?').run(seasonId);

    return { message: 'Season deleted successfully' };
  }
}

module.exports = SeasonService;
