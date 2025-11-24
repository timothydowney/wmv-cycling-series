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

import { Database } from 'better-sqlite3';
import { isoToUnix } from './dateUtils';

/**
 * Segment effort data from activity
 */
interface SegmentEffortData {
  id: string | number;
  start_date: string;
  elapsed_time: number;
  pr_rank?: number;
  [key: string]: unknown;
}

/**
 * Activity data to store
 */
interface ActivityToStore {
  id: number;
  start_date: string;
  device_name?: string;
  segmentEfforts: SegmentEffortData[];
  totalTime: number;
}

/**
 * Store activity and segment efforts in database (replaces existing if present)
 * Atomically deletes ALL existing results/activities/efforts for this week+participant and inserts fresh data
 * 
 * ⚠️ CRITICAL: A refresh should completely replace all old data with fresh Strava data
 * We delete at the week+participant level (not just activity level) to ensure:
 * - No orphaned segment_effort records persist from old activities
 * - PR bonus flags are recalculated fresh from current Strava data
 * - Race conditions don't leave stale data in the database
 * 
 * @param db - Better-sqlite3 database instance
 * @param stravaAthleteId - Strava athlete ID
 * @param weekId - Week ID
 * @param activityData - Activity data with segmentEfforts
 * @param stravaSegmentId - Strava segment ID
 */
function storeActivityAndEfforts(
  db: Database,
  stravaAthleteId: number,
  weekId: number,
  activityData: ActivityToStore,
  stravaSegmentId: number
): void {
  // CRITICAL: Delete ALL old data for this week+participant (full cascade)
  // This ensures refresh completely replaces old data with fresh Strava data
  
  // Step 1: Find all activities for this week+participant
  const existingActivities = db
    .prepare(`
    SELECT id FROM activity WHERE week_id = ? AND strava_athlete_id = ?
  `)
    .all(weekId, stravaAthleteId) as Array<{ id: number }>;

  // Step 2: Delete segment efforts for all old activities
  for (const activity of existingActivities) {
    db.prepare('DELETE FROM segment_effort WHERE activity_id = ?').run(activity.id);
  }

  // Step 3: Delete results for this week+participant
  db.prepare('DELETE FROM result WHERE week_id = ? AND strava_athlete_id = ?')
    .run(weekId, stravaAthleteId);

  // Step 4: Delete all old activities for this week+participant
  db.prepare('DELETE FROM activity WHERE week_id = ? AND strava_athlete_id = ?')
    .run(weekId, stravaAthleteId);

  // Convert activity start_date to Unix timestamp
  // NOTE: Use start_date (UTC with Z suffix), NOT start_date_local (athlete's local timezone)
  // Strava API: start_date="2018-02-16T14:52:54Z" (UTC), start_date_local="2018-02-16T06:52:54" (local)
  const activityStartUnix = isoToUnix(activityData.start_date);

  // Store new activity with start_at (Unix seconds UTC)
  const activityResult = db
    .prepare(`
    INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at, device_name, validation_status)
    VALUES (?, ?, ?, ?, ?, 'valid')
  `)
    .run(
      weekId,
      stravaAthleteId,
      activityData.id,
      activityStartUnix,
      activityData.device_name || null
    );

  const activityDbId = (activityResult as { lastInsertRowid: number }).lastInsertRowid;

  // Store segment efforts
  console.log(
    `Storing ${activityData.segmentEfforts.length} segment efforts for activity ${activityDbId}`
  );
  for (let i = 0; i < activityData.segmentEfforts.length; i++) {
    const effort = activityData.segmentEfforts[i];

    // Convert effort start_date to Unix timestamp
    // NOTE: Use start_date (UTC), NOT start_date_local (athlete's local timezone)
    const effortStartUnix = isoToUnix(effort.start_date);
    // PR bonus only for pr_rank === 1 (athlete's absolute fastest ever)
    const prAchieved = effort.pr_rank === 1 ? 1 : 0;

    console.log(
      `  Effort ${i}: strava_segment_id=${stravaSegmentId}, elapsed_time=${effort.elapsed_time}, strava_effort_id=${effort.id}${prAchieved ? ' ⭐ PR' : ''}`
    );
    db.prepare(`
        INSERT INTO segment_effort (activity_id, strava_segment_id, strava_effort_id, effort_index, elapsed_seconds, start_at, pr_achieved)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
      activityDbId,
      stravaSegmentId,
      String(effort.id),
      i,
      effort.elapsed_time,
      effortStartUnix,
      prAchieved
    );
  }

  // Store result
  db.prepare(`
    INSERT OR REPLACE INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds)
    VALUES (?, ?, ?, ?)
  `).run(weekId, stravaAthleteId, activityDbId, activityData.totalTime);
}

export { storeActivityAndEfforts, type ActivityToStore, type SegmentEffortData };
