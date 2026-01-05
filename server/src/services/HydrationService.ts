import { eq, isNull, and } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { activity, segmentEffort, result, week } from '../db/schema';
import * as stravaClient from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';
import { findBestConsecutiveWindow } from '../activityProcessor';

export class HydrationService {
  constructor(private db: BetterSQLite3Database) {}

  /**
   * Hydrates a single activity's efforts with performance metrics from Strava using Strava IDs.
   */
  async hydrateByStravaId(stravaActivityId: string): Promise<{ success: boolean; message?: string; updatedCount?: number }> {
    try {
      const dbActivity = await this.db.select()
        .from(activity)
        .where(eq(activity.strava_activity_id, stravaActivityId))
        .get();

      if (!dbActivity) {
        return { success: false, message: 'Activity not found in local database' };
      }

      return this.hydrateActivity(dbActivity.id);
    } catch (error) {
      console.error(`Error hydrating Strava activity ${stravaActivityId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Hydrates a single activity's efforts with performance metrics from Strava.
   */
  async hydrateActivity(activityId: number): Promise<{ success: boolean; message?: string; updatedCount?: number }> {
    try {
      const dbActivity = await this.db.select()
        .from(activity)
        .where(eq(activity.id, activityId))
        .get();

      if (!dbActivity) {
        return { success: false, message: 'Activity not found' };
      }

      // 1. Get valid access token
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken(this.db, stravaClient, dbActivity.strava_athlete_id);
      } catch {
        return { success: false, message: 'Could not get valid Strava access token' };
      }

      // 2. Fetch full activity from Strava
      const fullActivity = await stravaClient.getActivity(dbActivity.strava_activity_id, accessToken);
      if (!fullActivity || !fullActivity.segment_efforts) {
        return { success: false, message: 'Could not fetch activity details from Strava' };
      }

      // 3. Get week data to know the segment and required laps
      const weekData = await this.db.select()
        .from(week)
        .where(eq(week.id, dbActivity.week_id))
        .get();

      if (!weekData) {
        return { success: false, message: 'Week not found for this activity' };
      }

      // Filter Strava efforts to only those matching the target segment
      const matchingStravaEfforts = fullActivity.segment_efforts.filter(
        (e: any) => e.segment?.id !== undefined && String(e.segment.id) === String(weekData.strava_segment_id)
      );

      // Use the refactored window selection logic to find the best laps
      const bestWindow = findBestConsecutiveWindow(matchingStravaEfforts, weekData.required_laps);

      if (!bestWindow) {
        return { success: false, message: `Could not find ${weekData.required_laps} qualifying laps in this activity` };
      }

      const matchingStravaEffortsInWindow = bestWindow.efforts;

      // Get existing efforts from DB to match them
      const dbEfforts = await this.db.select()
        .from(segmentEffort)
        .where(eq(segmentEffort.activity_id, dbActivity.id))
        .orderBy(segmentEffort.effort_index)
        .all();

      const updatedEfforts = [];

      // Try to match each DB effort with a Strava effort from the best window
      for (const dbEffort of dbEfforts) {
        const matchedStravaEffort = matchingStravaEffortsInWindow[dbEffort.effort_index];

        if (matchedStravaEffort) {
          const updateResult = await this.db.update(segmentEffort)
            .set({
              strava_effort_id: String(matchedStravaEffort.id),
              average_watts: matchedStravaEffort.average_watts || null,
              average_heartrate: matchedStravaEffort.average_heartrate || null,
              max_heartrate: matchedStravaEffort.max_heartrate || null,
              average_cadence: matchedStravaEffort.average_cadence || null,
              device_watts: matchedStravaEffort.device_watts ?? null,
            })
            .where(eq(segmentEffort.id, dbEffort.id))
            .returning()
            .get();

          if (updateResult) {
            updatedEfforts.push(updateResult);
          }
        }
      }

      // Update the total time in the results table if we updated all efforts
      if (updatedEfforts.length === weekData.required_laps) {
        await this.db.update(result)
          .set({
            total_time_seconds: bestWindow.totalTime,
            updated_at: new Date().toISOString()
          })
          .where(eq(result.activity_id, dbActivity.id))
          .run();
      }

      return {
        success: true,
        updatedCount: updatedEfforts.length
      };
    } catch (error) {
      console.error(`Error hydrating activity ${activityId}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sweeps the database for activities that are missing performance metrics and hydrates them.
   * Respects Strava rate limits by adding a delay between requests.
   */
  async sweepAndHydrate(limit: number = 250): Promise<{ processed: number; successful: number }> {
    console.log('[Hydration] Starting background sweep for missing metrics...');
    
    // Find activities that have efforts but those efforts are missing metrics
    // We'll look for efforts where average_watts, average_heartrate, and average_cadence are all null
    // but the activity exists.
    const activitiesToHydrate = await this.db.selectDistinct({ id: activity.id })
      .from(activity)
      .innerJoin(segmentEffort, eq(segmentEffort.activity_id, activity.id))
      .where(
        and(
          isNull(segmentEffort.average_watts),
          isNull(segmentEffort.average_heartrate),
          isNull(segmentEffort.average_cadence)
        )
      )
      .limit(limit)
      .all();

    if (activitiesToHydrate.length === 0) {
      console.log('[Hydration] No activities found needing hydration.');
      return { processed: 0, successful: 0 };
    }

    console.log(`[Hydration] Found ${activitiesToHydrate.length} activities to hydrate.`);

    let successful = 0;
    for (const item of activitiesToHydrate) {
      const res = await this.hydrateActivity(item.id);
      if (res.success) {
        successful++;
      }
      
      // Wait 3 seconds between activities to be very safe with rate limits
      // Strava limit: 300 requests / 15 mins = 20 requests / min = 1 request every 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`[Hydration] Sweep complete. Processed: ${activitiesToHydrate.length}, Successful: ${successful}`);
    return { processed: activitiesToHydrate.length, successful };
  }
}
