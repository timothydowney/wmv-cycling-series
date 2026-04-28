/**
 * ActivityService.ts
 *
 * Provides methods for retrieving activity and segment effort data.
 */

import type { AppDatabase } from '../db/types';
import { eq, sql } from 'drizzle-orm';
import { activity, segmentEffort, week, season } from '../db/schema';
import { getOne, getMany } from '../db/asyncQuery';

export class ActivityService {
  constructor(private db: AppDatabase) {}

  /**
   * Get all segment efforts for a given Strava activity ID.
   */
  async getEffortsByStravaId(stravaActivityId: string) {
    const dbActivity = await getOne<typeof activity.$inferSelect>(
      this.db.select()
        .from(activity)
        .where(eq(activity.strava_activity_id, stravaActivityId))
    );

    if (!dbActivity) {
      return null;
    }

    const efforts = await getMany<typeof segmentEffort.$inferSelect>(
      this.db.select()
        .from(segmentEffort)
        .where(eq(segmentEffort.activity_id, dbActivity.id))
        .orderBy(segmentEffort.effort_index)
    );

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
    return await getMany<{
      activity_id: number;
      strava_activity_id: string;
      week_id: number;
      week_name: string;
      season_id: number;
      season_name: string;
      segment_effort_count: number;
      total_time_seconds: number;
    }>(
      this.db
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
        .groupBy(week.id, week.week_name, season.id, season.name, activity.id, activity.strava_activity_id)
        .orderBy(season.id, week.id)
    );
  }
}
