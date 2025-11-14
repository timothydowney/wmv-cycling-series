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
 * Validate activity falls within a time window
 * @param {string} activityDateLocal - ISO 8601 datetime (e.g., "2025-10-28T14:30:00Z")
 * @param {Object} week - Week object with { start_time, end_time }
 * @returns {Object} { valid: boolean, message: string }
 */
function validateActivityTimeWindow(activityDateLocal, week) {
  try {
    const activityTime = new Date(activityDateLocal).getTime();
    const startTime = new Date(week.start_time).getTime();
    const endTime = new Date(week.end_time).getTime();
    
    if (activityTime < startTime) {
      return {
        valid: false,
        message: `Activity ${activityDateLocal} is before window start ${week.start_time}`
      };
    }
    
    if (activityTime > endTime) {
      return {
        valid: false,
        message: `Activity ${activityDateLocal} is after window end ${week.end_time}`
      };
    }
    
    return { valid: true, message: 'Activity within time window' };
  } catch (error) {
    return { valid: false, message: `Time validation error: ${error.message}` };
  }
}

/**
 * Find the best qualifying activity among a list
 * 
 * Criteria:
 * 1. Must contain the target segment
 * 2. Must have >= requiredLaps repetitions of the target segment
 * 3. If multiple qualify, select the one with fastest total time
 * 
 * @param {Array} activities - Activities from athlete's Strava account
 * @param {number} targetSegmentId - Strava segment ID to find
 * @param {number} requiredLaps - Minimum repetitions needed
 * @param {string} accessToken - Strava access token (for fetching full details)
 * @returns {Promise<Object|null>} Best qualifying activity or null
 */
async function findBestQualifyingActivity(activities, targetSegmentId, requiredLaps, accessToken) {
  if (!activities || activities.length === 0) {
    return null;
  }
  
  let bestActivity = null;
  let bestTime = Infinity;
  
  for (const activity of activities) {
    try {
      // Fetch full activity details (includes all segment efforts)
      const fullActivity = await stravaClient.getActivity(activity.id, accessToken);
      
      if (!fullActivity.segment_efforts || fullActivity.segment_efforts.length === 0) {
        continue;
      }
      
      // Filter to segment efforts matching our target segment
      const matchingEfforts = fullActivity.segment_efforts.filter(
        effort => effort.segment.id === targetSegmentId
      );
      
      // Check if this activity qualifies
      if (matchingEfforts.length < requiredLaps) {
        continue;
      }
      
      // Calculate total time for the fastest requiredLaps efforts
      const sortedEfforts = matchingEfforts
        .sort((a, b) => a.elapsed_time - b.elapsed_time)
        .slice(0, requiredLaps);
      
      const totalTime = sortedEfforts.reduce((sum, e) => sum + e.elapsed_time, 0);
      
      // Keep track of best activity
      if (totalTime < bestTime) {
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
      }
    } catch (error) {
      // Log but continue to next activity
      console.error(`Error processing activity ${activity.id}:`, error.message);
      continue;
    }
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
  validateActivityTimeWindow,
  findBestQualifyingActivity,
  fetchActivitiesInTimeWindow
};
