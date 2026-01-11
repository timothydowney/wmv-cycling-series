/**
 * ActivityService.ts
 *
 * Provides methods for retrieving activity and segment effort data.
 */

import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { activity, segmentEffort } from '../db/schema';

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
}
