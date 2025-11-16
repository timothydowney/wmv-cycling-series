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

const { isoToUnix } = require('./dateUtils');

/**
 * Store activity and segment efforts in database (replaces existing if present)
 * Atomically deletes existing activity/efforts/results and inserts new ones
 * @param {Object} db - Better-sqlite3 database instance
 * @param {number} stravaAthleteId - Strava athlete ID
 * @param {number} weekId - Week ID
 * @param {Object} activityData - Activity data with segmentEfforts
 * @param {number} stravaSegmentId - Strava segment ID
 */
function storeActivityAndEfforts(db, stravaAthleteId, weekId, activityData, stravaSegmentId) {
  // Delete existing activity for this participant/week if exists
  const existing = db.prepare(`
    SELECT id FROM activity WHERE week_id = ? AND strava_athlete_id = ?
  `).get(weekId, stravaAthleteId);
  
  if (existing) {
    db.prepare('DELETE FROM result WHERE activity_id = ?').run(existing.id);
    db.prepare('DELETE FROM segment_effort WHERE activity_id = ?').run(existing.id);
    db.prepare('DELETE FROM activity WHERE id = ?').run(existing.id);
  }
  
  // Convert activity start_date to Unix timestamp
  // NOTE: Use start_date (UTC with Z suffix), NOT start_date_local (athlete's local timezone)
  // Strava API: start_date="2018-02-16T14:52:54Z" (UTC), start_date_local="2018-02-16T06:52:54" (local)
  const activityStartUnix = isoToUnix(activityData.start_date);
  
  // Store new activity with start_at (Unix seconds UTC)
  const activityResult = db.prepare(`
    INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at, device_name, validation_status)
    VALUES (?, ?, ?, ?, ?, 'valid')
  `).run(weekId, stravaAthleteId, activityData.id, activityStartUnix, activityData.device_name || null);
  
  const activityDbId = activityResult.lastInsertRowid;
  
  // Store segment efforts
  console.log(`Storing ${activityData.segmentEfforts.length} segment efforts for activity ${activityDbId}`);
  for (let i = 0; i < activityData.segmentEfforts.length; i++) {
    const effort = activityData.segmentEfforts[i];
    
    // Convert effort start_date to Unix timestamp
    // NOTE: Use start_date (UTC), NOT start_date_local (athlete's local timezone)
    const effortStartUnix = isoToUnix(effort.start_date);
    
    console.log(`  Effort ${i}: strava_segment_id=${stravaSegmentId}, elapsed_time=${effort.elapsed_time}, strava_effort_id=${effort.id}`);
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
      effort.pr_rank ? 1 : 0
    );
  }
  
  // Store result
  db.prepare(`
    INSERT OR REPLACE INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds)
    VALUES (?, ?, ?, ?)
  `).run(weekId, stravaAthleteId, activityDbId, activityData.totalTime);
}

module.exports = {
  storeActivityAndEfforts
};
