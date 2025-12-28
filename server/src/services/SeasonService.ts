/**
 * SeasonService.ts
 * Handles all season-related business logic: CRUD operations, season leaderboard calculation
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { season, week } from '../db/schema'; // Only import used tables
import { eq, desc, count } from 'drizzle-orm';
import { Season } from '../db/schema'; // Import the Drizzle generated Season type

class SeasonService {
  constructor(private db: BetterSQLite3Database) {}

  /**
   * Get all seasons ordered by start_at descending (newest first)
   */
  getAllSeasons(): Season[] {
    return this.db.select().from(season).orderBy(desc(season.start_at)).all();
  }

  /**
   * Get a season by ID
   */
  getSeasonById(seasonId: number): Season {
    const result = this.db.select().from(season).where(eq(season.id, seasonId)).get();

    if (!result) {
      throw new Error('Season not found');
    }

    return result;
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
      this.db.update(season).set({ is_active: 0 }).run();
    }

    const result = this.db.insert(season).values({
      name,
      start_at: start_at,
      end_at: end_at,
      is_active: is_active ? 1 : 0
    }).returning().get();

    return result;
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
    const existingSeason = this.db.select().from(season).where(eq(season.id, seasonId)).get();

    if (!existingSeason) {
      throw new Error('Season not found');
    }

    // If setting as active, deactivate other seasons first
    if (updates.is_active) {
      this.db.update(season).set({ is_active: 0 }).run();
    }

    // Build update object
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.start_at !== undefined) updateData.start_at = updates.start_at;
    if (updates.end_at !== undefined) updateData.end_at = updates.end_at;
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active ? 1 : 0;

    if (Object.keys(updateData).length === 0) {
      throw new Error('No fields to update');
    }

    const updatedSeason = this.db.update(season)
      .set(updateData)
      .where(eq(season.id, seasonId))
      .returning()
      .get();

    return updatedSeason;
  }

  /**
   * Delete a season
   * Validation: cannot delete a season that has weeks
   */
  deleteSeason(seasonId: number): { message: string } {
    // Verify season exists
    const existingSeason = this.db.select().from(season).where(eq(season.id, seasonId)).get();

    if (!existingSeason) {
      throw new Error('Season not found');
    }

    // Check if season has weeks
    const weekCountResult = this.db.select({ count: count() }).from(week).where(eq(week.season_id, seasonId)).get();
    const weekCount = weekCountResult ? weekCountResult.count : 0;

    if (weekCount > 0) {
      throw new Error(
        `Cannot delete season with existing weeks: ${weekCount} week(s) exist`
      );
    }

    this.db.delete(season).where(eq(season.id, seasonId)).run();

    return { message: 'Season deleted successfully' };
  }

  /**
   * Clone an existing season and its weeks to a new start date
   */
  cloneSeason(sourceSeasonId: number, newStartDate: number, newName: string): Season {
    // 1. Get source season
    const sourceSeason = this.getSeasonById(sourceSeasonId);
    if (!sourceSeason) {
      throw new Error('Source season not found');
    }

    // 2. Get source weeks
    const sourceWeeks = this.db.select().from(week).where(eq(week.season_id, sourceSeasonId)).orderBy(week.start_at).all();

    // 3. Calculate new season end date
    // We want the first week to start exactly on newStartDate.
    // So we calculate offsets relative to the FIRST WEEK, not the season start.
    let firstWeekStart = sourceSeason.start_at;
    if (sourceWeeks.length > 0) {
      firstWeekStart = sourceWeeks[0].start_at;
    }

    // Calculate duration of the original season to determine new end date
    // If we shift the start, we should shift the end by the same amount relative to the new start
    // But wait, if we align to the first week, the season "container" duration might need adjustment if it had padding.
    // For simplicity, let's keep the season duration the same, but shift the start.
    // Actually, if the user says "New Start Date" is for the first week, maybe we should set the Season Start to that too.
    // Let's assume New Start Date = Season Start Date = First Week Start Date.
    
    const seasonDuration = sourceSeason.end_at - sourceSeason.start_at;
    const newEndDate = newStartDate + seasonDuration;

    // 4. Create new season
    // This will handle deactivating other seasons if is_active is true
    const newSeason = this.createSeason({
      name: newName,
      start_at: newStartDate,
      end_at: newEndDate,
      is_active: true
    });

    // 5. Clone weeks
    for (const sourceWeek of sourceWeeks) {
      // Calculate offset in DAYS relative to the FIRST WEEK
      // This avoids DST shift issues by snapping to exact 24-hour intervals
      const diffSeconds = sourceWeek.start_at - firstWeekStart;
      const daysDiff = Math.round(diffSeconds / 86400);
      
      const duration = sourceWeek.end_at - sourceWeek.start_at;
      
      // New start is exactly N days after the first week's new start
      const newWeekStart = newStartDate + (daysDiff * 86400);
      const newWeekEnd = newWeekStart + duration;

      this.db.insert(week).values({
        season_id: newSeason.id,
        week_name: sourceWeek.week_name,
        strava_segment_id: sourceWeek.strava_segment_id,
        required_laps: sourceWeek.required_laps,
        start_at: newWeekStart,
        end_at: newWeekEnd,
        multiplier: sourceWeek.multiplier,
        notes: sourceWeek.notes
      }).run();
    }

    return newSeason;
  }
}

export default SeasonService;