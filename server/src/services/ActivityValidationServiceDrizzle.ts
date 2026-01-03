/**
 * ActivityValidationServiceDrizzle.ts
 * 
 * Drizzle-based implementation of ActivityValidationService.
 * Reusable validation logic for activity processing.
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { and, desc, asc, lte, gte, or, isNull, eq } from 'drizzle-orm';
import { season, week, Season } from '../db/schema';
import { isoToUnix } from '../dateUtils';
import { type Activity as ActivityWithTimestamp } from '../stravaClient';

/**
 * Week with time window as Unix seconds (UTC)
 */
interface WeekTimeWindow {
  id: number;
  start_at: number; // Unix seconds (UTC)
  end_at: number; // Unix seconds (UTC)
  [key: string]: unknown;
}

/**
 * Validation result with reason for failures
 */
interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Season status check result
 */
interface SeasonStatusResult {
  isOpen: boolean;
  isClosed: boolean;
  reason?: string;
  start_at?: number;
  end_at?: number;
}

class ActivityValidationServiceDrizzle {
  constructor(private db: BetterSQLite3Database) { }

  /**
   * Check if a season is currently closed (end_at has passed).
   */
  isSeasonClosed(seasonData: Season): { isClosed: boolean; reason?: string; end_at?: number } {
    const now = Math.floor(Date.now() / 1000); // Current Unix time

    // Explicitly check for manual closure
    // Note: Drizzle schema has is_active as integer (0 or 1), no boolean mode
    if (seasonData.is_active === 0) {
      return {
        isClosed: true,
        reason: 'Season is manually closed by administrator',
        end_at: seasonData.end_at
      };
    }

    if (seasonData.end_at && now > seasonData.end_at) {
      const endDate = new Date(seasonData.end_at * 1000).toISOString();
      return {
        isClosed: true,
        reason: `Season ended at ${endDate}`,
        end_at: seasonData.end_at
      };
    }

    return { isClosed: false };
  }

  /**
   * Check if a season is currently open for activity submission.
   */
  isSeasonOpen(seasonData: Season): SeasonStatusResult {
    const now = Math.floor(Date.now() / 1000);

    // Check manual closure
    if (seasonData.is_active === 0) {
      return {
        isOpen: false,
        isClosed: true,
        reason: 'Season is manually closed by administrator',
        end_at: seasonData.end_at
      };
    }

    // Check if season has started
    if (seasonData.start_at && now < seasonData.start_at) {
      const startDate = new Date(seasonData.start_at * 1000).toISOString();
      return {
        isOpen: false,
        isClosed: false,
        reason: `Season hasn't started yet (starts ${startDate})`,
        start_at: seasonData.start_at
      };
    }

    // Check if season has ended
    if (seasonData.end_at && now > seasonData.end_at) {
      const endDate = new Date(seasonData.end_at * 1000).toISOString();
      return {
        isOpen: false,
        isClosed: true,
        reason: `Season has ended (ended ${endDate})`,
        end_at: seasonData.end_at
      };
    }

    // Season is open
    return {
      isOpen: true,
      isClosed: false,
      start_at: seasonData.start_at,
      end_at: seasonData.end_at
    };
  }

  /**
   * Validate that an activity timestamp falls within a week's time window.
   */
  isActivityWithinTimeWindow(activity: ActivityWithTimestamp, weekData: WeekTimeWindow): ValidationResult {
    // Convert Strava ISO to Unix seconds
    const activityUnix = isoToUnix(activity.start_date);

    if (activityUnix === null) {
      return {
        valid: false,
        reason: `Invalid activity start_date format: ${activity.start_date}`
      };
    }

    // Simple integer comparison (no timezone math needed)
    if (activityUnix >= weekData.start_at && activityUnix <= weekData.end_at) {
      return { valid: true };
    }

    const startDate = new Date(weekData.start_at * 1000).toISOString();
    const endDate = new Date(weekData.end_at * 1000).toISOString();
    return {
      valid: false,
      reason: `Activity ${activity.id} at ${activity.start_date} is outside week window [${startDate}, ${endDate}]`
    };
  }

  /**
   * Validate that an activity timestamp falls within a season's date range.
   */
  isActivityWithinSeasonRange(activity: ActivityWithTimestamp, seasonData: Season): ValidationResult {
    const activityUnix = isoToUnix(activity.start_date);

    if (activityUnix === null) {
      return {
        valid: false,
        reason: `Invalid activity start_date format: ${activity.start_date}`
      };
    }

    // Activity must be after season start
    if (seasonData.start_at && activityUnix < seasonData.start_at) {
      const startDate = new Date(seasonData.start_at * 1000).toISOString();
      return {
        valid: false,
        reason: `Activity ${activity.id} at ${activity.start_date} is before season starts at ${startDate}`
      };
    }

    // Activity must be before season end (if end_at is set)
    if (seasonData.end_at && activityUnix > seasonData.end_at) {
      const endDate = new Date(seasonData.end_at * 1000).toISOString();
      return {
        valid: false,
        reason: `Activity ${activity.id} at ${activity.start_date} is after season ended at ${endDate}`
      };
    }

    return { valid: true };
  }

  /**
   * Get the active season containing a given timestamp.
   * 
   * ⚠️ DEPRECATED: Use getAllActiveSeasonsContainingTimestamp() instead to handle overlapping seasons.
   */
  getActiveSeason(unixTimestamp: number): Season | null {
    const result = this.db
      .select()
      .from(season)
      .where(
        and(
          lte(season.start_at, unixTimestamp),
          or(isNull(season.end_at), gte(season.end_at, unixTimestamp))
        )
      )
      .orderBy(desc(season.start_at), desc(season.id))
      .limit(1)
      .get();

    return result || null;
  }

  /**
   * Get ALL active seasons containing a given timestamp.
   */
  getAllActiveSeasonsContainingTimestamp(unixTimestamp: number): Season[] {
    return this.db
      .select()
      .from(season)
      .where(
        and(
          lte(season.start_at, unixTimestamp),
          or(isNull(season.end_at), gte(season.end_at, unixTimestamp))
        )
      )
      .orderBy(desc(season.start_at), desc(season.id))
      .all();
  }

  /**
   * Get all weeks in a season that could contain an activity.
   */
  getWeeksForActivityInSeason(
    seasonId: number,
    activityUnix: number
  ): Array<{
    id: number;
    week_name: string;
    start_at: number;
    end_at: number;
  }> {
    return this.db
      .select({
        id: week.id,
        week_name: week.week_name,
        start_at: week.start_at,
        end_at: week.end_at
      })
      .from(week)
      .where(
        and(
          eq(week.season_id, seasonId),
          lte(week.start_at, activityUnix),
          gte(week.end_at, activityUnix)
        )
      )
      .orderBy(asc(week.start_at))
      .all();
  }

  /**
   * Convenience: Check if event date (from week) is in the future.
   */
  isEventInFuture(weekStartAt: number): { isFuture: boolean; message?: string } {
    const now = Math.floor(Date.now() / 1000);

    if (weekStartAt > now) {
      const eventDate = new Date(weekStartAt * 1000).toLocaleDateString();
      return {
        isFuture: true,
        message: `Event date (${eventDate}) is in the future - cannot fetch activities before the event occurs`
      };
    }

    return { isFuture: false };
  }
}

export default ActivityValidationServiceDrizzle;