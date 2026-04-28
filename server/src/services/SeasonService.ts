/**
 * SeasonService.ts
 * Handles all season-related business logic: CRUD operations, season leaderboard calculation
 */

import type { AppDatabase } from '../db/types';
import { season, week } from '../db/schema'; // Only import used tables
import { eq, desc, count } from 'drizzle-orm';
import { Season, Week } from '../db/schema'; // Import the Drizzle generated types
import { getMany, getOne, exec } from '../db/asyncQuery';

class SeasonService {
  constructor(private db: AppDatabase) {}

  /**
   * Get all seasons ordered by start_at descending (newest first)
   */
  async getAllSeasons(): Promise<Season[]> {
    return await getMany<Season>(
      this.db.select().from(season).orderBy(desc(season.start_at))
    );
  }

  /**
   * Get a season by ID
   */
  async getSeasonById(seasonId: number): Promise<Season> {
    const result = await getOne<Season>(
      this.db.select().from(season).where(eq(season.id, seasonId))
    );

    if (!result) {
      throw new Error('Season not found');
    }

    return result;
  }

  /**
   * Create a new season
   */
  async createSeason(data: {
    name: string;
    start_at: number;
    end_at: number;
  }): Promise<Season> {
    const { name, start_at, end_at } = data;

    if (!name || start_at === undefined || end_at === undefined) {
      throw new Error('Missing required fields: name, start_at, end_at');
    }

    const result = await getOne<Season>(
      this.db.insert(season).values({
        name,
        start_at: start_at,
        end_at: end_at,
      }).returning()
    );

    if (!result) {
      throw new Error('Failed to create season');
    }

    return result;
  }

  /**
   * Update an existing season
   */
  async updateSeason(
    seasonId: number,
    updates: {
      name?: string;
      start_at?: number;
      end_at?: number;
    }
  ): Promise<Season> {
    // Verify season exists
    const existingSeason = await getOne<Season>(
      this.db.select().from(season).where(eq(season.id, seasonId))
    );

    if (!existingSeason) {
      throw new Error('Season not found');
    }

    // Build update object
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.start_at !== undefined) updateData.start_at = updates.start_at;
    if (updates.end_at !== undefined) updateData.end_at = updates.end_at;

    if (Object.keys(updateData).length === 0) {
      throw new Error('No fields to update');
    }

    const updatedSeason = await getOne<Season>(
      this.db.update(season)
        .set(updateData)
        .where(eq(season.id, seasonId))
        .returning()
    );

    if (!updatedSeason) {
      throw new Error('Failed to update season');
    }

    return updatedSeason;
  }

  /**
   * Delete a season
   * Validation: cannot delete a season that has weeks
   */
  async deleteSeason(seasonId: number): Promise<{ message: string }> {
    // Verify season exists
    const existingSeason = await getOne<Season>(
      this.db.select().from(season).where(eq(season.id, seasonId))
    );

    if (!existingSeason) {
      throw new Error('Season not found');
    }

    // Check if season has weeks
    const weekCountResult = await getOne<{ count: number }>(
      this.db.select({ count: count() }).from(week).where(eq(week.season_id, seasonId))
    );
    const weekCount = weekCountResult ? weekCountResult.count : 0;

    if (weekCount > 0) {
      throw new Error(
        `Cannot delete season with existing weeks: ${weekCount} week(s) exist`
      );
    }

    await exec(
      this.db.delete(season).where(eq(season.id, seasonId))
    );

    return { message: 'Season deleted successfully' };
  }

  /**
   * Clone an existing season and its weeks to a new start date
   */
  async cloneSeason(sourceSeasonId: number, newStartDate: number, newName: string): Promise<Season> {
    // 1. Get source season
    const sourceSeason = await this.getSeasonById(sourceSeasonId);
    if (!sourceSeason) {
      throw new Error('Source season not found');
    }

    // 2. Get source weeks
    const sourceWeeks = await getMany<Week>(
      this.db.select().from(week).where(eq(week.season_id, sourceSeasonId)).orderBy(week.start_at)
    );

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
    const newSeason = await this.createSeason({
      name: newName,
      start_at: newStartDate,
      end_at: newEndDate
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

      await exec(
        this.db.insert(week).values({
          season_id: newSeason.id,
          week_name: sourceWeek.week_name,
          strava_segment_id: sourceWeek.strava_segment_id,
          required_laps: sourceWeek.required_laps,
          start_at: newWeekStart,
          end_at: newWeekEnd,
          multiplier: sourceWeek.multiplier,
          notes: sourceWeek.notes
        })
      );
    }

    return newSeason;
  }
}

export default SeasonService;