/**
 * Batch Fetch Service
 * 
 * Handles batch fetching of activities for a week:
 * - Retrieves all participant activities within event time window
 * - Matches activities to required segment
 * - Stores best qualifying activities
 * - Recalculates leaderboard rankings and points
 */

const { unixToISO } = require('../dateUtils');
const { findBestQualifyingActivity } = require('../activityProcessor');
const { storeActivityAndEfforts } = require('../activityStorage');

class BatchFetchService {
  constructor(db, stravaClient, getValidAccessToken) {
    this.db = db;
    this.stravaClient = stravaClient;
    this.getValidAccessToken = getValidAccessToken;
  }

  /**
   * Fetch and store results for a week
   * 
   * @param {number} weekId - Week ID to fetch results for
   * @returns {Promise<Object>} Summary with results found and participant details
   */
  async fetchWeekResults(weekId) {
    // Get week details including segment info
    // NEW SCHEMA: start_at and end_at are already INTEGER Unix seconds (UTC)
    const week = this.db.prepare(`
      SELECT w.*, s.strava_segment_id, s.name as segment_name
      FROM week w
      JOIN segment s ON w.strava_segment_id = s.strava_segment_id
      WHERE w.id = ?
    `).get(weekId);
    
    if (!week) {
      throw new Error('Week not found');
    }
    
    // ===== WEEK TIME CONTEXT =====
    console.log('\n[Batch Fetch] ========== WEEK TIME CONTEXT ==========');
    console.log(`[Batch Fetch] Week: ID=${week.id}, Name='${week.week_name}'`);
    console.log(`[Batch Fetch] Segment: ID=${week.strava_segment_id}, Name='${week.segment_name}'`);
    console.log(`[Batch Fetch] Required laps: ${week.required_laps}`);
    console.log('[Batch Fetch] Time window (Unix seconds UTC):');
    console.log(`  start_at: ${week.start_at} (${unixToISO(week.start_at)})`);
    console.log(`  end_at: ${week.end_at} (${unixToISO(week.end_at)})`);
    console.log(`[Batch Fetch] Window duration: ${week.end_at - week.start_at} seconds (${(week.end_at - week.start_at) / 3600} hours)`);
    console.log('[Batch Fetch] ========== END WEEK CONTEXT ==========\n');
    
    // Use Unix times directly (no conversion needed)
    const startUnix = week.start_at;
    const endUnix = week.end_at;
    
    // Get all connected participants (those with valid tokens)
    const participants = this.db.prepare(`
      SELECT p.strava_athlete_id, p.name, pt.access_token
      FROM participant p
      JOIN participant_token pt ON p.strava_athlete_id = pt.strava_athlete_id
      WHERE pt.access_token IS NOT NULL
    `).all();
    
    if (participants.length === 0) {
      return {
        message: 'No participants connected',
        week_id: weekId,
        participants_processed: 0,
        results_found: 0,
        summary: []
      };
    }
    
    const results = [];
    
    // Process each participant
    for (const participant of participants) {
      try {
        console.log(`\n[Batch Fetch] Processing ${participant.name} (Strava ID: ${participant.strava_athlete_id})`);
        
        // Get valid token (auto-refreshes if needed)
        const accessToken = await this.getValidAccessToken(this.db, this.stravaClient, participant.strava_athlete_id);
        
        // Fetch activities using Unix timestamps (already UTC)
        const activities = await this.stravaClient.listAthleteActivities(
          accessToken,
          startUnix,  // Unix timestamp for UTC start
          endUnix,    // Unix timestamp for UTC end
          { includeAllEfforts: true }
        );
        
        console.log(`[Batch Fetch] Found ${activities.length} total activities within time window`);
        if (activities.length > 0) {
          console.log(`[Batch Fetch] Activities for ${participant.name}:`);
          for (const act of activities) {
            console.log(`  - ID: ${act.id}, Strava ID: ${act.strava_activity_id}, Start: ${act.start_at}`);
          }
        }
        
        // Find best qualifying activity
        console.log(`[Batch Fetch] Searching for segment ${week.strava_segment_id} (${week.segment_name}), require ${week.required_laps} lap(s)`);
        const bestActivity = await findBestQualifyingActivity(
          activities,
          week.strava_segment_id,
          week.required_laps,
          accessToken,
          week  // Pass week for time window validation
        );
        
        if (bestActivity) {
          console.log(`[Batch Fetch] ✓ SUCCESS for ${participant.name}: Activity '${bestActivity.name}' (ID: ${bestActivity.id}, Time: ${Math.round(bestActivity.totalTime / 60)}min, Device: '${bestActivity.device_name || 'unknown'}')`);
          
          // Store activity and efforts
          storeActivityAndEfforts(this.db, participant.strava_athlete_id, weekId, bestActivity, week.strava_segment_id);
          
          results.push({
            participant_id: participant.strava_athlete_id,
            participant_name: participant.name,
            activity_found: true,
            activity_id: bestActivity.id,
            total_time: bestActivity.totalTime,
            segment_efforts: bestActivity.segmentEfforts.length
          });
        } else {
          console.log(`[Batch Fetch] ✗ No qualifying activities found for ${participant.name}`);
          results.push({
            participant_id: participant.strava_athlete_id,
            participant_name: participant.name,
            activity_found: false,
            reason: 'No qualifying activities on event day'
          });
        }
      } catch (error) {
        // Better error logging for diagnostics
        const errorMsg = error.message || String(error);
        console.error(`Error processing ${participant.name}:`, errorMsg);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
        if (error.errors && Array.isArray(error.errors)) {
          console.error('Sub-errors:', error.errors.map(e => e.message || String(e)));
        }
        
        results.push({
          participant_id: participant.strava_athlete_id,
          participant_name: participant.name,
          activity_found: false,
          reason: errorMsg
        });
      }
    }
    
    // Note: Scores are computed dynamically on read, not stored
    // See GET /weeks/:id/leaderboard and GET /season/leaderboard
    
    console.log(`Fetch results complete for week ${weekId}: ${results.filter(r => r.activity_found).length}/${participants.length} activities found`);
    
    return {
      message: 'Results fetched successfully',
      week_id: weekId,
      week_name: week.week_name,
      participants_processed: participants.length,
      results_found: results.filter(r => r.activity_found).length,
      summary: results
    };
  }
}

module.exports = BatchFetchService;
