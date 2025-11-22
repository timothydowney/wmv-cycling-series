/**
 * SeasonService.ts
 * Handles all season-related business logic: CRUD operations, season leaderboard calculation
 */

import { Database } from 'better-sqlite3';
import { getAthleteProfilePictures } from './StravaProfileService';

interface Season {
  id: number;
  name: string;
  start_at: number;
  end_at: number;
  is_active: number;
}

interface LeaderboardEntry {
  id: number;
  strava_athlete_id: number;
  name: string;
  total_points: number;
  weeks_completed: number;
  profile_picture_url?: string | null;
}

interface SeasonLeaderboard {
  season: Omit<Season, 'is_active'>;
  leaderboard: LeaderboardEntry[];
}

class SeasonService {
  constructor(private db: Database) {}

  /**
   * Get all seasons ordered by start_at descending (newest first)
   */
  getAllSeasons(): Season[] {
    const seasons = this.db
      .prepare('SELECT id, name, start_at, end_at, is_active FROM season ORDER BY start_at DESC')
      .all() as Season[];
    return seasons;
  }

  /**
   * Get a season by ID
   */
  getSeasonById(seasonId: number): Season {
    const season = this.db
      .prepare('SELECT id, name, start_at, end_at, is_active FROM season WHERE id = ?')
      .get(seasonId) as Season | undefined;

    if (!season) {
      throw new Error('Season not found');
    }

    return season;
  }

  /**
   * Get season leaderboard with computed totals
   * Calculates standings by summing weekly scores computed on-read
   * Now async to fetch profile pictures from Strava
   */
  async getSeasonLeaderboard(seasonId: number): Promise<SeasonLeaderboard> {
    // Verify season exists
    const season = this.db
      .prepare('SELECT id, name, start_at, end_at FROM season WHERE id = ?')
      .get(seasonId) as Omit<Season, 'is_active'> | undefined;

    if (!season) {
      throw new Error('Season not found');
    }

    // Get all weeks in this season
    const weeks = this.db
      .prepare('SELECT id, week_name, start_at FROM week WHERE season_id = ? ORDER BY start_at ASC')
      .all(seasonId) as Array<{ id: number; week_name: string; start_at: number }>;

    const allParticipantScores: Record<
      number,
      { name: string; total_points: number; weeks_completed: number }
    > = {};

    // Compute from activities (source of truth)
    weeks.forEach((week) => {
      const activities = this.db
        .prepare(
          `SELECT 
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
          ORDER BY total_time_seconds ASC`
        )
        .all(week.id) as Array<{
          activity_id: number;
          participant_id: number;
          name: string;
          total_time_seconds: number;
          achieved_pr: number;
        }>;

      const totalParticipants = activities.length;

      // Compute scores for this week
      activities.forEach((activity, index) => {
        const rank = index + 1;
        const basePoints = totalParticipants - rank + 1;
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

    // Convert to array and fetch profile pictures
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

    // Fetch profile pictures for all athletes
    const athleteIds = seasonResults.map(r => r.strava_athlete_id);
    const profilePictures = await getAthleteProfilePictures(athleteIds, this.db);

    // Add profile pictures to results
    const leaderboardWithPictures = seasonResults.map(result => ({
      ...result,
      profile_picture_url: profilePictures.get(result.strava_athlete_id) || null
    }));

    return {
      season,
      leaderboard: leaderboardWithPictures
    };
  }

  /**
   * Create a new season
   * If is_active is true, deactivates all other seasons first
   */
  createSeason(data: {
    name: string;
    start_at: number;
    end_at: number;
    is_active?: boolean;
  }): Season {
    const { name, start_at, end_at, is_active } = data;

    if (!name || start_at === undefined || end_at === undefined) {
      throw new Error('Missing required fields: name, start_at, end_at');
    }

    // If setting as active, deactivate other seasons first
    if (is_active) {
      this.db.prepare('UPDATE season SET is_active = 0').run();
    }

    const result = this.db
      .prepare(
        `INSERT INTO season (name, start_at, end_at, is_active)
         VALUES (?, ?, ?, ?)`
      )
      .run(name, start_at, end_at, is_active ? 1 : 0);

    const newSeason = this.db
      .prepare('SELECT id, name, start_at, end_at, is_active FROM season WHERE id = ?')
      .get(result.lastInsertRowid) as Season;

    return newSeason;
  }

  /**
   * Update an existing season
   * If is_active is true, deactivates all other seasons first
   */
  updateSeason(
    seasonId: number,
    updates: {
      name?: string;
      start_at?: number;
      end_at?: number;
      is_active?: boolean;
    }
  ): Season {
    // Verify season exists
    const existingSeason = this.db
      .prepare('SELECT id FROM season WHERE id = ?')
      .get(seasonId) as { id: number } | undefined;

    if (!existingSeason) {
      throw new Error('Season not found');
    }

    // If setting as active, deactivate other seasons first
    if (updates.is_active) {
      this.db.prepare('UPDATE season SET is_active = 0').run();
    }

    // Build dynamic UPDATE query
    const updateFields: string[] = [];
    const values: any[] = [];

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
    this.db
      .prepare(`UPDATE season SET ${updateFields.join(', ')} WHERE id = ?`)
      .run(...values);

    const updatedSeason = this.db
      .prepare('SELECT id, name, start_at, end_at, is_active FROM season WHERE id = ?')
      .get(seasonId) as Season;

    return updatedSeason;
  }

  /**
   * Delete a season
   * Validation: cannot delete a season that has weeks
   */
  deleteSeason(seasonId: number): { message: string } {
    // Verify season exists
    const existingSeason = this.db
      .prepare('SELECT id FROM season WHERE id = ?')
      .get(seasonId) as { id: number } | undefined;

    if (!existingSeason) {
      throw new Error('Season not found');
    }

    // Check if season has weeks
    const weekCount = this.db
      .prepare('SELECT COUNT(*) as count FROM week WHERE season_id = ?')
      .get(seasonId) as { count: number };

    if (weekCount.count > 0) {
      throw new Error(
        `Cannot delete season with existing weeks: ${weekCount.count} week(s) exist`
      );
    }

    this.db.prepare('DELETE FROM season WHERE id = ?').run(seasonId);

    return { message: 'Season deleted successfully' };
  }
}

export default SeasonService;
