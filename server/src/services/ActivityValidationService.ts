/**
 * ActivityValidationService.ts
 * 
 * Reusable validation logic for activity processing.
 * Used by both batch fetch and webhook processor.
 * 
 * Design principle: NO webhook-specific logic, pure validation service.
 * This allows batch fetch and webhooks to use identical validation rules.
 */

import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { and, desc, asc, lte, gte, eq, or, isNull } from 'drizzle-orm';
import { season as seasonTable, week as weekTable, type Season } from '../db/schema';
import { type Activity as ActivityWithTimestamp } from '../stravaClient';
import { isoToUnix } from '../dateUtils';

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

class ActivityValidationService {
  constructor(private orm: BetterSQLite3Database) {}

  /**
   * Check if a season is currently closed (end_at has passed).
   * 
   * Used by: Webhook processor (awareness check)
   * 
   * @param season Season object with end_at timestamp
   * @returns { isClosed: boolean, reason?: string, end_at?: number }
   */
  isSeasonClosed(season: Season): { isClosed: boolean; reason?: string; end_at?: number } {
    const now = Math.floor(Date.now() / 1000); // Current Unix time

    // Explicitly check for manual closure
    if (season.is_active === 0) {
      return {
        isClosed: true,
        reason: 'Season is manually closed by administrator',
        end_at: season.end_at
      };
    }

    if (season.end_at && now > season.end_at) {
      const endDate = new Date(season.end_at * 1000).toISOString();
      return {
        isClosed: true,
        reason: `Season ended at ${endDate}`,
        end_at: season.end_at
      };
    }

    return { isClosed: false };
  }

  /**
   * Check if a season is currently open for activity submission.
   * 
   * A season is open if:
   * - Current time >= season.start_at
   * - Current time <= season.end_at (or end_at is null)
   * - is_active is 1
   * 
   * Used by: Webhook processor (business logic check)
   * 
   * @param season Season object with start_at and end_at timestamps
   * @returns { isOpen: boolean, reason?: string, start_at?: number, end_at?: number }
   */
  isSeasonOpen(season: Season): SeasonStatusResult {
    const now = Math.floor(Date.now() / 1000);

    // Check manual closure
    if (season.is_active === 0) {
      return {
        isOpen: false,
        isClosed: true,
        reason: 'Season is manually closed by administrator',
        end_at: season.end_at
      };
    }

    // Check if season has started
    if (season.start_at && now < season.start_at) {
      const startDate = new Date(season.start_at * 1000).toISOString();
      return {
        isOpen: false,
        isClosed: false,
        reason: `Season hasn't started yet (starts ${startDate})`,
        start_at: season.start_at
      };
    }

    // Check if season has ended
    if (season.end_at && now > season.end_at) {
      const endDate = new Date(season.end_at * 1000).toISOString();
      return {
        isOpen: false,
        isClosed: true,
        reason: `Season has ended (ended ${endDate})`,
        end_at: season.end_at
      };
    }

    // Season is open
    return {
      isOpen: true,
      isClosed: false,
      start_at: season.start_at,
      end_at: season.end_at
    };
  }

  /**
   * Validate that an activity timestamp falls within a week's time window.
   * 
   * Used by: findBestQualifyingActivity (via batch fetch and webhooks)
   * 
   * @param activity Activity with Strava ISO start_date
   * @param week Week with start_at and end_at as Unix seconds
   * @returns { valid: boolean, reason?: string }
   */
  isActivityWithinTimeWindow(activity: ActivityWithTimestamp, week: WeekTimeWindow): ValidationResult {
    // Convert Strava Date to Unix seconds
    const activityUnix = isoToUnix(activity.start_date);

    if (activityUnix === null) {
      return { valid: false, reason: `Invalid activity date: ${activity.start_date}` };
    }

    // Simple integer comparison (no timezone math needed)
    if (activityUnix >= week.start_at && activityUnix <= week.end_at) {
      return { valid: true };
    }

    const startDate = new Date(week.start_at * 1000).toISOString();
    const endDate = new Date(week.end_at * 1000).toISOString();
    return {
      valid: false,
      reason: `Activity ${activity.id} at ${activity.start_date} is outside week window [${startDate}, ${endDate}]`
    };
  }

  /**
   * Validate that an activity timestamp falls within a season's date range.
   * 
   * Used by: Webhook processor (pre-validation before week matching)
   * 
   * @param activity Activity with Strava ISO start_date
   * @param season Season with start_at and end_at timestamps
   * @returns { valid: boolean, reason?: string }
   */
  isActivityWithinSeasonRange(activity: ActivityWithTimestamp, season: Season): ValidationResult {
    const activityUnix = isoToUnix(activity.start_date);

    if (activityUnix === null) {
      return { valid: false, reason: `Invalid activity date: ${activity.start_date}` };
    }

    // Activity must be after season start
    if (season.start_at && activityUnix < season.start_at) {
      const startDate = new Date(season.start_at * 1000).toISOString();
      return {
        valid: false,
        reason: `Activity ${activity.id} at ${activity.start_date} is before season starts at ${startDate}`
      };
    }

    // Activity must be before season end (if end_at is set)
    if (season.end_at && activityUnix > season.end_at) {
      const endDate = new Date(season.end_at * 1000).toISOString();
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
   * If multiple seasons contain the timestamp, returns the one with the most recent start_at,
   * breaking ties by most recent ID (insertion order).
   * 
   * ⚠️ DEPRECATED: Use getAllActiveSeasonsContainingTimestamp() instead to handle overlapping seasons.
   * 
   * Used by: Webhook processor (to find which season an activity belongs to)
   * 
   * @param unixTimestamp Activity timestamp in Unix seconds (UTC)
   * @returns Season object or null if no season contains timestamp
   */
  getActiveSeason(unixTimestamp: number): Season | null {
    const rows = this.orm
      .select()
      .from(seasonTable)
      .where(
        and(
          lte(seasonTable.start_at, unixTimestamp),
          or(isNull(seasonTable.end_at), gte(seasonTable.end_at, unixTimestamp))
        )
      )
      .orderBy(desc(seasonTable.start_at), desc(seasonTable.id))
      .limit(1)
      .all();

    return rows[0] ?? null;
  }

  /**
   * Get ALL active seasons containing a given timestamp.
   * 
   * Critical for supporting overlapping seasons (e.g., Fall and Winter seasons).
   * An activity should be processed for EACH matching season independently.
   * 
   * Used by: Webhook processor (to find all seasons an activity could match)
   * 
   * @param unixTimestamp Activity timestamp in Unix seconds (UTC)
   * @returns Array of seasons that contain this timestamp, ordered by start_at DESC then id DESC
   */
  getAllActiveSeasonsContainingTimestamp(unixTimestamp: number): Season[] {
    const seasons = this.orm
      .select()
      .from(seasonTable)
      .where(
        and(
          lte(seasonTable.start_at, unixTimestamp),
          or(isNull(seasonTable.end_at), gte(seasonTable.end_at, unixTimestamp))
        )
      )
      .orderBy(desc(seasonTable.start_at), desc(seasonTable.id))
      .all();

    return seasons;
  }

  /**
   * Get all weeks in a season that could contain an activity.
   * 
   * Useful for webhook processor to check multiple weeks without
   * needing to iterate through all weeks in memory.
   * 
   * Used by: Webhook processor (optional, for detailed logging)
   * 
   * @param seasonId Season ID
   * @param activityUnix Activity timestamp in Unix seconds
   * @returns Array of weeks that overlap with activity timestamp
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
    const weeks = this.orm
      .select({ id: weekTable.id, week_name: weekTable.week_name, start_at: weekTable.start_at, end_at: weekTable.end_at })
      .from(weekTable)
      .where(and(eq(weekTable.season_id, seasonId), lte(weekTable.start_at, activityUnix), gte(weekTable.end_at, activityUnix)))
      .orderBy(asc(weekTable.start_at))
      .all();

    return weeks as Array<{ id: number; week_name: string; start_at: number; end_at: number }>;
  }

  /**
   * Convenience: Check if event date (from week) is in the future.
   * 
   * Prevents fetching activities for events that haven't happened yet.
   * Used by: Batch fetch (early exit check)
   * 
   * @param weekStartAt Week start timestamp (Unix seconds)
   * @returns { isFuture: boolean, message?: string }
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

export default ActivityValidationService;
