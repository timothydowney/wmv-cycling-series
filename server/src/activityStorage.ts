/**
 * Activity Storage - Activity and segment effort persistence
 * Handles storing activities, segment efforts, and results atomically
 *
 * ⚠️ CRITICAL: Strava API Field Formats
 *
 * When processing Strava activity responses, use these fields:
 *
 * Activity level:
 *   - start_date: "2018-02-16T14:52:54Z" (UTC with Z suffix) ✅ USE THIS
 *   - start_date_local: "2018-02-16T06:52:54" (athlete's local timezone) ❌ DON'T USE
 *   - timezone: "(GMT-08:00) America/Los_Angeles" (athlete's timezone)
 *   - utc_offset: -28800 (offset in seconds from UTC)
 *
 * Segment effort level (also in activity.segment_efforts[]):
 *   - start_date: "2018-02-16T14:52:54Z" (UTC with Z suffix) ✅ USE THIS
 *   - start_date_local: "2018-02-16T06:52:54" (athlete's local timezone) ❌ DON'T USE
 *
 * Why this matters:
 * Using start_date_local would cause timezone bugs because it's the athlete's local time,
 * not UTC. Always use start_date which has the Z suffix indicating UTC time.
 * All database timestamps are stored as Unix seconds (UTC-based), so we must convert
 * from UTC ISO strings (start_date) not local timezone strings (start_date_local).
 *
 * Conversion flow:
 *   Strava API → start_date (UTC ISO string with Z)
 *                    ↓
 *            isoToUnix() converts to Unix seconds
 *                    ↓
 *            Database stored as INTEGER Unix seconds (UTC)
 *                    ↓
 *            API returns numbers, frontend formats with browser timezone
 */

import { isoToUnix } from './dateUtils';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { activity, segmentEffort, result } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { type SegmentEffort } from './stravaClient';

/**
 * Activity data to store
 */
interface ActivityToStore {
  id: string;
  start_date: string;
  device_name?: string;
  segmentEfforts: SegmentEffort[];
  totalTime: number;
}

/**
 * Store activity and segment efforts in database using Drizzle (replaces existing if present)
 * Atomically deletes ALL existing results/activities/efforts for this week+participant and inserts fresh data
 * 
 * @param db - Drizzle database instance
 * @param stravaAthleteId - Strava athlete ID
 * @param weekId - Week ID
 * @param activityData - Activity data with segmentEfforts
 * @param stravaSegmentId - Strava segment ID
 */
function storeActivityAndEfforts(
  db: BetterSQLite3Database,
  stravaAthleteId: string,
  weekId: number,
  activityData: ActivityToStore,
  stravaSegmentId: string
): void {
  // Use a transaction to ensure atomicity
  db.transaction((tx) => {
    // CRITICAL: Delete ALL old data for this week+participant (full cascade)
    // This ensures refresh completely replaces old data with fresh Strava data
    
    // Step 1: Find all activities for this week+participant
    const existingActivities = tx
      .select({ id: activity.id })
      .from(activity)
      .where(and(eq(activity.week_id, weekId), eq(activity.strava_athlete_id, stravaAthleteId)))
      .all();

    // Step 2: Delete segment efforts for all old activities
    for (const act of existingActivities) {
      tx.delete(segmentEffort).where(eq(segmentEffort.activity_id, act.id)).run();
    }

    // Step 3: Delete results for this week+participant
    tx.delete(result)
      .where(and(eq(result.week_id, weekId), eq(result.strava_athlete_id, stravaAthleteId)))
      .run();

    // Step 4: Delete all old activities for this week+participant
    tx.delete(activity)
      .where(and(eq(activity.week_id, weekId), eq(activity.strava_athlete_id, stravaAthleteId)))
      .run();

    // Convert activity start_date to Unix timestamp
    const activityStartUnix = isoToUnix(activityData.start_date);

    // Store new activity
    const activityResult = tx
      .insert(activity)
      .values({
        week_id: weekId,
        strava_athlete_id: stravaAthleteId,
        strava_activity_id: activityData.id,
        start_at: activityStartUnix || 0, // Fallback to 0 if null, though validation should catch this
        device_name: activityData.device_name || null,
        validation_status: 'valid'
      })
      .returning({ id: activity.id })
      .get();

    if (!activityResult) throw new Error('Failed to insert activity');
    const activityDbId = activityResult.id;

    // Store segment efforts
    console.log(
      `Storing ${activityData.segmentEfforts.length} segment efforts for activity ${activityDbId}`
    );
    
    for (let i = 0; i < activityData.segmentEfforts.length; i++) {
      const effort = activityData.segmentEfforts[i];
      const effortStartUnix = isoToUnix(effort.start_date);
      const prAchieved = effort.pr_rank === 1 ? 1 : 0;

      console.log(
        `  Effort ${i}: strava_segment_id=${stravaSegmentId}, elapsed_time=${effort.elapsed_time}, strava_effort_id=${effort.id}${prAchieved ? ' ⭐ PR' : ''}`
      );
      
      tx.insert(segmentEffort).values({
        activity_id: activityDbId,
        strava_segment_id: stravaSegmentId,
        strava_effort_id: effort.id,
        effort_index: i,
        elapsed_seconds: effort.elapsed_time,
        start_at: effortStartUnix || 0,
        pr_achieved: prAchieved
      }).run();
    }

    // Store result
    // SQLite doesn't support INSERT OR REPLACE directly via Drizzle's standard API easily for complex cases without onConflictDoUpdate
    // But since we deleted everything above, a simple INSERT is correct and safe here.
    tx.insert(result)
      .values({
        week_id: weekId,
        strava_athlete_id: stravaAthleteId,
        activity_id: activityDbId,
        total_time_seconds: activityData.totalTime
      })
      .run();
  });
}

export { storeActivityAndEfforts, type ActivityToStore };

