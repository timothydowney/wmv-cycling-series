/**
 * Strava API Client Module
 * 
 * Encapsulates all interactions with the Strava API.
 * Provides a clean, testable interface for:
 * - OAuth token management
 * - Activity fetching and validation
 * - Segment information retrieval
 * 
 * This module centralizes error handling and API parameter management
 * to make testing and maintenance easier.
 */

const strava = require('strava-v3');

/**
 * OAuth: Exchange authorization code for tokens
 * @param {string} code - Authorization code from Strava OAuth flow
 * @returns {Promise<Object>} Token data { access_token, refresh_token, expires_at, athlete }
 * @throws {Error} If token exchange fails
 */
async function exchangeAuthorizationCode(code) {
  try {
    const tokenData = await strava.oauth.getToken(code);
    
    if (!tokenData || !tokenData.access_token) {
      throw new Error('No access token in OAuth response');
    }
    
    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      athlete: tokenData.athlete
    };
  } catch (error) {
    throw new Error(`OAuth token exchange failed: ${error.message}`);
  }
}

/**
 * OAuth: Refresh an expired access token using refresh token
 * @param {string} refreshToken - Refresh token from previous OAuth exchange
 * @returns {Promise<Object>} New token data { access_token, refresh_token, expires_at }
 * @throws {Error} If token refresh fails
 */
async function refreshAccessToken(refreshToken) {
  try {
    const newTokenData = await strava.oauth.refreshToken(refreshToken);
    
    if (!newTokenData || !newTokenData.access_token) {
      throw new Error('No access token in refresh response');
    }
    
    return {
      access_token: newTokenData.access_token,
      refresh_token: newTokenData.refresh_token,
      expires_at: newTokenData.expires_at
    };
  } catch (error) {
    throw new Error(`Token refresh failed: ${error.message}`);
  }
}

/**
 * Activities: Fetch a single activity by ID
 * @param {number} activityId - Strava activity ID
 * @param {string} accessToken - Valid Strava access token
 * @returns {Promise<Object>} Activity data including segment_efforts
 * @throws {Error} If activity fetch fails
 */
async function getActivity(activityId, accessToken) {
  try {
    console.log(`[Strava API] Fetching full activity details for ID: ${activityId}`);
    const client = new strava.client(accessToken);
    
    const activity = await client.activities.get({ id: activityId, include_all_efforts: true });
    
    if (!activity) {
      throw new Error('No activity data returned');
    }
    
    const effortCount = activity.segment_efforts ? activity.segment_efforts.length : 0;
    console.log(`[Strava API] ✓ Activity ${activityId} loaded: '${activity.name}', ${effortCount} segment efforts, type: '${activity.type}'`);
    return activity;
  } catch (error) {
    if (error.statusCode === 404) {
      throw new Error('Activity not found on Strava');
    } else if (error.statusCode === 401) {
      throw new Error('Invalid or expired Strava token');
    }
    throw new Error(`Failed to fetch activity: ${error.message}`);
  }
}

/**
 * Activities: Fetch all activities for authenticated athlete within time window
 * Handles pagination to get ALL activities (not just first page)
 * 
 * @param {string} accessToken - Valid Strava access token (athlete's personal token)
 * @param {number} afterTimestamp - Unix timestamp (start of window)
 * @param {number} beforeTimestamp - Unix timestamp (end of window)
 * @param {Object} options - Optional configuration
 * @param {number} options.perPage - Activities per page (default: 100, max: 100)
 * @param {boolean} options.includeAllEfforts - Include all segment efforts, not just top 3 (default: true)
 * @returns {Promise<Array>} All activities within the time window
 * @throws {Error} If activity fetch fails
 */
async function listAthleteActivities(accessToken, afterTimestamp, beforeTimestamp, options = {}) {
  try {
    const client = new strava.client(accessToken);
    const perPage = options.perPage || 100; // Max allowed by Strava
    const includeAllEfforts = options.includeAllEfforts !== false; // Default true
    
    // Convert timestamps to readable dates for logging
    const afterDate = new Date(afterTimestamp * 1000).toISOString();
    const beforeDate = new Date(beforeTimestamp * 1000).toISOString();
    console.log(`[Strava API] listAthleteActivities: fetching activities between ${afterDate} and ${beforeDate}`);
    console.log(`  Timestamps: after=${afterTimestamp}, before=${beforeTimestamp}`);
    console.log(`  Options: perPage=${perPage}, includeAllEfforts=${includeAllEfforts}`);
    
    let allActivities = [];
    let page = 1;
    let hasMorePages = true;
    
    // Pagination loop: fetch all pages
    while (hasMorePages) {
      console.log(`[Strava API] Fetching page ${page}...`);
      const activities = await client.athlete.listActivities({
        after: afterTimestamp,
        before: beforeTimestamp,
        per_page: perPage,
        page: page,
        include_all_efforts: includeAllEfforts
      });
      
      console.log(`[Strava API] Page ${page} returned ${activities ? activities.length : 0} activities`);
      
      if (!activities || activities.length === 0) {
        console.log(`[Strava API] No more activities on page ${page}, stopping pagination`);
        hasMorePages = false;
      } else {
        allActivities = allActivities.concat(activities);
        console.log(`[Strava API] Total activities so far: ${allActivities.length}`);
        
        // Stop if we got fewer than perPage items (indicates last page)
        if (activities.length < perPage) {
          console.log(`[Strava API] Got ${activities.length} activities (< ${perPage}), likely last page`);
          hasMorePages = false;
        }
        
        page++;
      }
    }
    
    console.log(`[Strava API] ✓ Fetch complete: ${allActivities.length} total activities returned`);
    return allActivities;
  } catch (error) {
    // Handle AggregateError and other error types
    let errorMsg = error.message || String(error);
    
    if (error.errors && Array.isArray(error.errors)) {
      // AggregateError contains multiple errors
      const messages = error.errors.map(e => e.message || String(e)).join('; ');
      errorMsg = `${error.message} [${messages}]`;
    }
    
    throw new Error(`Failed to fetch activities: ${errorMsg}`);
  }
}

/**
 * Segments: Fetch segment details by ID
 * @param {number} segmentId - Strava segment ID
 * @param {string} accessToken - Valid Strava access token
 * @returns {Promise<Object>} Segment data { id, name, distance, average_grade, city, state, country }
 * @throws {Error} If segment fetch fails
 */
async function getSegment(segmentId, accessToken) {
  try {
    const client = new strava.client(accessToken);
    
    const segment = await client.segments.get({ id: segmentId });
    
    if (!segment) {
      throw new Error('No segment data returned');
    }
    
    return {
      id: segment.id,
      name: segment.name,
      distance: segment.distance,
      average_grade: segment.average_grade,
      city: segment.city,
      state: segment.state,
      country: segment.country
    };
  } catch (error) {
    if (error.statusCode === 404) {
      throw new Error('Segment not found on Strava');
    } else if (error.statusCode === 401) {
      throw new Error('Invalid or expired Strava token');
    }
    throw new Error(`Failed to fetch segment: ${error.message}`);
  }
}

module.exports = {
  exchangeAuthorizationCode,
  refreshAccessToken,
  getActivity,
  listAthleteActivities,
  getSegment
};
