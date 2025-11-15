/**
 * Activity Processing Module
 * 
 * Handles the business logic for:
 * - Finding qualifying activities for competitions
 * - Extracting activity information from URLs
 * - Validating activities against time windows
 * - Processing segment efforts
 * 
 * This layer sits between the Strava API client and the business logic,
 * providing clean, testable functions for activity matching and validation.
 */

const stravaClient = require('./stravaClient');

/**
 * Extract Strava activity ID from various URL formats
 * Supports:
 *  - https://www.strava.com/activities/12345678
 *  - https://www.strava.com/activities/12345678/
 *  - www.strava.com/activities/12345678
 *  - 12345678 (raw ID)
 * 
 * @param {string} input - Activity URL or ID
 * @returns {string|null} Activity ID or null if invalid format
 */
function extractActivityId(input) {
  if (!input) return null;
  
  // Try to match URL pattern
  const match = input.match(/\/activities\/(\d+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  // Try to parse as raw number
  const numMatch = input.match(/^\d+$/);
  if (numMatch) {
    return numMatch[0];
  }
  
  return null;
}



/**
 * Find the best qualifying activity among a list
 * 
 * Criteria:
 * 1. Activity must be within the week's time window (via timezoneManager)
 * 2. Must contain the target segment
 * 3. Must have >= requiredLaps repetitions of the target segment
 * 4. If multiple qualify, select the one with fastest total time
 * 
 * @param {Array} activities - Activities from athlete's Strava account
 * @param {number} targetSegmentId - Strava segment ID to find
 * @param {number} requiredLaps - Minimum repetitions needed
 * @param {string} accessToken - Strava access token (for fetching full details)
 * @param {Object} week - Week object with { start_time_utc, end_time_utc } from timezoneManager
 * @returns {Promise<Object|null>} Best qualifying activity or null
 */
async function findBestQualifyingActivity(activities, targetSegmentId, requiredLaps, accessToken, week) {
  if (!activities || activities.length === 0) {
    return null;
  }
  
  // Filter activities by time window using timezoneManager
  const { validateActivityInWeek } = require('./timezoneManager');
  const validActivitiesByTime = activities.filter(activity => {
    if (!week) {
      // If week not provided, accept all activities (backward compat)
      return true;
    }
    
    const validation = validateActivityInWeek(activity, week);
    return validation.valid;
  });
  
  console.log(`[Activity Matching] Time window validation: ${validActivitiesByTime.length}/${activities.length} activities within window`);
  
  if (validActivitiesByTime.length > 0) {
    console.log('[Activity Matching] Valid activities by time:');
    for (const act of validActivitiesByTime) {
      console.log(`  - ID: ${act.id}, Name: '${act.name}', Start: ${act.start_date_local}`);
    }
  }
  
  if (validActivitiesByTime.length === 0) {
    return null;
  }
  
  let bestActivity = null;
  let bestTime = Infinity;
  
  for (let actIdx = 0; actIdx < validActivitiesByTime.length; actIdx++) {
    const activity = validActivitiesByTime[actIdx];
    console.log(`[Activity Matching] Processing activity ${actIdx + 1}/${validActivitiesByTime.length}: ID=${activity.id}, Name='${activity.name}'`);
    
    try {
      // Fetch full activity details (includes all segment efforts)
      const fullActivity = await stravaClient.getActivity(activity.id, accessToken);
      
      if (!fullActivity.segment_efforts || fullActivity.segment_efforts.length === 0) {
        console.log(`  ⚠ No segment efforts found in activity ${activity.id}`);
        continue;
      }
      
      console.log(`  ✓ Found ${fullActivity.segment_efforts.length} total segment efforts`);
      
      // Filter to segment efforts matching our target segment
      const matchingEfforts = fullActivity.segment_efforts.filter(
        effort => effort.segment.id === targetSegmentId
      );
      
      // Log what segments we found vs what we were looking for
      if (matchingEfforts.length === 0) {
        const foundSegmentIds = [...new Set(fullActivity.segment_efforts.map(e => e.segment.id))];
        console.log(`  ✗ Target segment ${targetSegmentId} NOT found. Found segment IDs: ${foundSegmentIds.join(', ')}`);
        console.log('    Segment names in activity:');
        [...new Set(fullActivity.segment_efforts.map(e => e.segment.name))].forEach(name => {
          console.log(`      - '${name}'`);
        });
      } else {
        console.log(`  ✓ Found ${matchingEfforts.length} matching segment efforts for target segment ${targetSegmentId}`);
      }
      
      // Check if this activity qualifies
      if (matchingEfforts.length < requiredLaps) {
        console.log(`  ✗ Insufficient repetitions: found ${matchingEfforts.length}, need ${requiredLaps}`);
        continue;
      }
      
      // Calculate total time for the fastest requiredLaps efforts
      const sortedEfforts = matchingEfforts
        .sort((a, b) => a.elapsed_time - b.elapsed_time)
        .slice(0, requiredLaps);
      
      const totalTime = sortedEfforts.reduce((sum, e) => sum + e.elapsed_time, 0);
      const totalTimeFormatted = Math.round(totalTime / 60); // in minutes
      
      console.log(`  ✓ Qualifying activity: ${requiredLaps} efforts, total time: ${totalTimeFormatted} min (${totalTime}s)`);
      
      // Keep track of best activity
      if (totalTime < bestTime) {
        console.log(`  ★ New best activity! (previous best: ${bestTime === Infinity ? 'none' : Math.round(bestTime / 60) + ' min'})`);
        bestTime = totalTime;
        bestActivity = {
          id: fullActivity.id,
          name: fullActivity.name,
          start_date_local: fullActivity.start_date_local,
          totalTime: totalTime,
          segmentEfforts: sortedEfforts,
          activity_url: `https://www.strava.com/activities/${fullActivity.id}`,
          device_name: fullActivity.device_name || null
        };
      } else {
        console.log(`  → Not better than current best (${Math.round(bestTime / 60)} min)`);
      }
    } catch (error) {
      // Log but continue to next activity
      console.error(`✗ Error processing activity ${activity.id}:`, error.message);
      continue;
    }
  }
  
  if (bestActivity) {
    console.log(`[Activity Matching] ★ Selected best activity: ID=${bestActivity.id}, Name='${bestActivity.name}', Time=${Math.round(bestActivity.totalTime / 60)}min, Device='${bestActivity.device_name || 'unknown'}'`);
  } else {
    console.log('[Activity Matching] ✗ No qualifying activities found');
  }
  
  return bestActivity;
}

/**
 * Fetch activities for a time window
 * Converts ISO 8601 times to Unix timestamps and calls Strava API
 * 
 * @param {string} accessToken - Strava access token (athlete's personal token)
 * @param {string} startTime - ISO 8601 datetime (e.g., "2025-10-28T00:00:00Z")
 * @param {string} endTime - ISO 8601 datetime (e.g., "2025-10-28T22:00:00Z")
 * @returns {Promise<Array>} All activities within the time window
 */
async function fetchActivitiesInTimeWindow(accessToken, startTime, endTime) {
  const afterTimestamp = Math.floor(new Date(startTime).getTime() / 1000);
  const beforeTimestamp = Math.floor(new Date(endTime).getTime() / 1000);
  
  return stravaClient.listAthleteActivities(accessToken, afterTimestamp, beforeTimestamp, {
    includeAllEfforts: true
  });
}

module.exports = {
  extractActivityId,
  findBestQualifyingActivity,
  fetchActivitiesInTimeWindow
};
