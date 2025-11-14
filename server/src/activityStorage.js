/**
 * Activity Storage - Activity and segment effort persistence
 * Handles storing activities, segment efforts, and results atomically
 */

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
  
  // Store new activity
  const activityResult = db.prepare(`
    INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, device_name, validation_status)
    VALUES (?, ?, ?, ?, 'valid')
  `).run(weekId, stravaAthleteId, activityData.id, activityData.device_name || null);
  
  const activityDbId = activityResult.lastInsertRowid;
  
  // Store segment efforts
  console.log(`Storing ${activityData.segmentEfforts.length} segment efforts for activity ${activityDbId}`);
  for (let i = 0; i < activityData.segmentEfforts.length; i++) {
    const effort = activityData.segmentEfforts[i];
    console.log(`  Effort ${i}: strava_segment_id=${stravaSegmentId}, elapsed_time=${effort.elapsed_time}, strava_effort_id=${effort.id}`);
    db.prepare(`
        INSERT INTO segment_effort (activity_id, strava_segment_id, strava_effort_id, effort_index, elapsed_seconds, pr_achieved)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
      activityDbId,
      stravaSegmentId,
      String(effort.id),
      i,
      effort.elapsed_time,
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
