/**
 * ActivityService.ts
 *
 * Provides methods for retrieving activity and segment effort data.
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import { activity, segmentEffort, week, season } from '../db/schema';

export class ActivityService {
  constructor(private db: BetterSQLite3Database) {}

  /**
   * Get all segment efforts for a given Strava activity ID.
   */
  async getEffortsByStravaId(stravaActivityId: string) {
    const dbActivity = await this.db.select()
      .from(activity)
      .where(eq(activity.strava_activity_id, stravaActivityId))
      .get();

    if (!dbActivity) {
      return null;
    }

    const efforts = await this.db.select()
      .from(segmentEffort)
      .where(eq(segmentEffort.activity_id, dbActivity.id))
      .orderBy(segmentEffort.effort_index)
      .all();

    return efforts.map(e => ({
      lap: e.effort_index + 1,
      average_watts: e.average_watts,
      average_heartrate: e.average_heartrate,
      max_heartrate: e.max_heartrate,
      average_cadence: e.average_cadence,
      device_watts: e.device_watts,
    }));
  }

  /**
   * Get all database activities and their associated week/season info for a Strava activity ID.
   * Used for webhook enrichment to show where an activity was stored.
   */
  async getStoredActivityMatches(stravaActivityId: string) {
    return this.db
      .select({
        activity_id: activity.id,
        strava_activity_id: activity.strava_activity_id,
        week_id: week.id,
        week_name: week.week_name,
        season_id: season.id,
        season_name: season.name,
        segment_effort_count: sql<number>`COUNT(${segmentEffort.id})`,
        total_time_seconds: sql<number>`COALESCE(SUM(${segmentEffort.elapsed_seconds}), 0)`
      })
      .from(activity)
      .innerJoin(week, eq(activity.week_id, week.id))
      .innerJoin(season, eq(week.season_id, season.id))
      .leftJoin(segmentEffort, eq(activity.id, segmentEffort.activity_id))
      .where(eq(activity.strava_activity_id, stravaActivityId))
      .groupBy(week.id, season.id)
      .orderBy(season.id, week.id)
      .all();
  }
}
