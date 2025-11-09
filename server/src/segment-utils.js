/**
 * Segment Utilities
 * Helper functions to search and verify Strava segments
 */

const strava = require('strava-v3');

/**
 * Get segment details by Strava segment ID
 * Requires authentication token
 */
async function getSegmentDetails(segmentId, accessToken) {
  try {
    console.log(`[getSegmentDetails] Fetching segment ${segmentId}`);
    console.log(`[getSegmentDetails] Token length: ${accessToken ? accessToken.length : 'NULL'}`);
    
    // Create a client with the user's access token
    const client = new strava.client(accessToken);
    
    // Fetch the segment
    const segment = await client.segments.get({ id: segmentId });
    
    console.log(`[getSegmentDetails] Successfully fetched segment: ${segment.name}`);
    console.log(`[getSegmentDetails] All segment fields:`, Object.keys(segment));
    
    return {
      id: segment.id,
      name: segment.name,
      activity_type: segment.activity_type,
      distance: segment.distance,
      average_grade: segment.average_grade,
      maximum_grade: segment.maximum_grade,
      elevation_high: segment.elevation_high,
      elevation_low: segment.elevation_low,
      climb_category: segment.climb_category,
      city: segment.city,
      state: segment.state,
      country: segment.country,
      private: segment.private,
      hazardous: segment.hazardous,
      starred: segment.starred,
      athlete_segment_stats: segment.athlete_segment_stats,
      // Include ALL fields for debugging
      _raw: segment
    };
  } catch (error) {
    console.error(`[getSegmentDetails] Error fetching segment ${segmentId}:`, error.message);
    if (error.response) {
      console.error(`[getSegmentDetails] Strava API response:`, error.response);
    }
    throw new Error(`Failed to get segment ${segmentId}: ${error.statusCode || 'unknown'} - ${JSON.stringify(error.msg || error.message)}`);
  }
}

/**
 * Get starred segments for the authenticated athlete
 * Returns segments that the athlete has starred on Strava
 */
async function getStarredSegments(accessToken) {
  try {
    // Create a client with the user's access token
    const client = new strava.client(accessToken);
    
    // Fetch starred segments (supports pagination)
    const segments = await client.segments.listStarred({
      per_page: 200  // Get up to 200 starred segments
    });
    
    if (!segments || segments.length === 0) {
      return [];
    }
    
    return segments.map(seg => ({
      id: seg.id,
      name: seg.name,
      activity_type: seg.activity_type,
      distance: seg.distance,
      average_grade: seg.average_grade,
      maximum_grade: seg.maximum_grade,
      elevation_high: seg.elevation_high,
      elevation_low: seg.elevation_low,
      climb_category: seg.climb_category,
      city: seg.city,
      state: seg.state,
      country: seg.country,
      private: seg.private,
      starred: seg.starred
    }));
  } catch (error) {
    console.error('Error fetching starred segments:', error);
    throw new Error(`Failed to get starred segments: ${error.message}`);
  }
}

/**
 * Extract segment information from an activity
 * This shows all segments that were ridden in a specific activity
 */
async function getSegmentsFromActivity(activityId, accessToken) {
  try {
    // Create a client with the user's access token
    const client = new strava.client(accessToken);
    
    const activity = await client.activities.get({ id: activityId });
    
    if (!activity.segment_efforts || activity.segment_efforts.length === 0) {
      return [];
    }
    
    // Count occurrences of each segment
    const segmentCounts = {};
    activity.segment_efforts.forEach(effort => {
      const id = effort.segment.id;
      if (!segmentCounts[id]) {
        segmentCounts[id] = {
          id: effort.segment.id,
          name: effort.segment.name,
          activity_type: effort.segment.activity_type,
          distance: effort.segment.distance,
          average_grade: effort.segment.average_grade,
          maximum_grade: effort.segment.maximum_grade,
          elevation_high: effort.segment.elevation_high,
          elevation_low: effort.segment.elevation_low,
          climb_category: effort.segment.climb_category,
          occurrences: 0,
          efforts: []
        };
      }
      segmentCounts[id].occurrences++;
      segmentCounts[id].efforts.push({
        elapsed_time: effort.elapsed_time,
        moving_time: effort.moving_time,
        start_date: effort.start_date,
        pr_rank: effort.pr_rank
      });
    });
    
    return Object.values(segmentCounts);
  } catch (error) {
    throw new Error(`Failed to get segments from activity ${activityId}: ${error.message}`);
  }
}

module.exports = {
  getSegmentDetails,
  getStarredSegments,
  getSegmentsFromActivity
};
