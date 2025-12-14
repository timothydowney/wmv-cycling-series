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
}

export default SeasonService;