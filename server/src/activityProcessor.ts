/**
 * Activity Processing Module
 *
 * Handles the business logic for:
 * - Finding qualifying activities for competitions
 * - Validating activities against time windows
 * - Processing segment efforts
 *
 * This layer sits between the Strava API client and the business logic,
 * providing clean, testable functions for activity matching and validation.
 */

import * as stravaClient from './stravaClient';
import { isoToUnix } from './dateUtils';

/**
 * Week data with time window
 */
interface Week {
  start_at: number; // Unix seconds
  end_at: number; // Unix seconds
  [key: string]: unknown;
}

/**
 * Segment effort from Strava API
 */
interface SegmentEffortResponse {
  segment: {
    id: number;
    name: string;
    [key: string]: unknown;
  };
  elapsed_time: number;
  [key: string]: unknown;
}

/**
 * Activity from Strava API
 */
interface ActivityResponse {
  id: number;
  name: string;
  start_date: string;
  segment_efforts?: SegmentEffortResponse[];
  type?: string;
  distance?: number;
  total_elevation_gain?: number;
  kudos_count?: number;
  commute?: boolean;
  trainer?: boolean;
  device_name?: string;
  [key: string]: unknown;
}

/**
 * Best qualifying activity result
 */
interface BestActivity {
  id: number;
  name: string;
  start_date: string;
  totalTime: number;
  segmentEfforts: SegmentEffortResponse[];
  activity_url: string;
  device_name: string | null;
}

/**
 * Find the best qualifying activity among a list
 *
 * Criteria:
 * 1. Activity must be within the week's time window (simple Unix comparison)
 * 2. Must contain the target segment
 * 3. Must have >= requiredLaps repetitions of the target segment
 * 4. If multiple qualify, select the one with fastest total time
 *
 * @param activities - Activities from athlete's Strava account
 * @param targetSegmentId - Strava segment ID to find
 * @param requiredLaps - Minimum repetitions needed
 * @param accessToken - Strava access token (for fetching full details)
 * @param week - Week object with { start_at, end_at } as INTEGER Unix seconds (UTC)
 * @returns Best qualifying activity or null
 */
async function findBestQualifyingActivity(
  activities: ActivityResponse[],
  targetSegmentId: number,
  requiredLaps: number,
  accessToken: string,
  week?: Week
): Promise<BestActivity | null> {
  if (!activities || activities.length === 0) {
    return null;
  }

  // Filter activities by time window using simple integer comparison
  const validActivitiesByTime: ActivityResponse[] = [];
  const rejectedActivities: Array<{
    id: number;
    name: string;
    start_date: string;
    reason: string;
  }> = [];

  for (const activity of activities) {
    if (!week) {
      // If week not provided, accept all activities (backward compat)
      validActivitiesByTime.push(activity);
      continue;
    }

    // Strava provides start_date in UTC ISO format (with Z suffix): "2025-11-15T10:30:45Z"
    const activityUnixSeconds = isoToUnix(activity.start_date);

    // week.start_at and week.end_at are already INTEGER Unix seconds (UTC)
    // Simple integer comparison (no timezone math needed!)
    if (
      activityUnixSeconds !== null &&
      activityUnixSeconds >= week.start_at &&
      activityUnixSeconds <= week.end_at
    ) {
      validActivitiesByTime.push(activity);
    } else {
      rejectedActivities.push({
        id: activity.id,
        name: activity.name,
        start_date: activity.start_date,
        reason: 'Outside time window'
      });
    }
  }

  console.log(
    `[Activity Matching] Time window validation: ${validActivitiesByTime.length}/${activities.length} activities within window`
  );
  if (rejectedActivities.length > 0) {
    console.log(
      '[Activity Matching] Rejected activities (outside time window):'
    );
    for (const rejected of rejectedActivities) {
      console.log(`  ✗ ID: ${rejected.id}, Name: '${rejected.name}'`);
    }
  }

  if (validActivitiesByTime.length > 0) {
    console.log('[Activity Matching] Valid activities by time:');
    for (const act of validActivitiesByTime) {
      const actUnix = isoToUnix(act.start_date);
      console.log(`  - ID: ${act.id}, Name: '${act.name}', Unix: ${actUnix}`);
    }
  }

  if (validActivitiesByTime.length === 0) {
    return null;
  }

  let bestActivity: BestActivity | null = null;
  let bestTime = Infinity;

  for (let actIdx = 0; actIdx < validActivitiesByTime.length; actIdx++) {
    const activity = validActivitiesByTime[actIdx];
    console.log(
      `[Activity Matching] Processing activity ${actIdx + 1}/${validActivitiesByTime.length}: ID=${activity.id}, Name='${activity.name}'`
    );

    try {
      // Fetch full activity details (includes all segment efforts)
      const fullActivity = await stravaClient.getActivity(
        activity.id,
        accessToken
      );

      if (!fullActivity.segment_efforts || fullActivity.segment_efforts.length === 0) {
        console.log(
          `  ⚠ No segment efforts found in activity ${activity.id}`
        );
        console.log(
          `    Activity type: '${fullActivity.type}', distance: ${fullActivity.distance}m, elevation: ${fullActivity.total_elevation_gain}m`
        );
        console.log(
          `    Kudos: ${fullActivity.kudos_count}, commute: ${fullActivity.commute}, trainer: ${fullActivity.trainer}`
        );
        continue;
      }

      console.log(
        `  ✓ Found ${fullActivity.segment_efforts.length} total segment efforts`
      );

      // Filter to segment efforts matching our target segment
      const matchingEfforts = fullActivity.segment_efforts.filter(
        (effort) => effort.segment.id === targetSegmentId
      );

      // Log what segments we found vs what we were looking for
      if (matchingEfforts.length === 0) {
        const foundSegmentIds = [
          ...new Set(fullActivity.segment_efforts.map((e) => e.segment.id))
        ];
        console.log(
          `  ✗ Target segment ${targetSegmentId} NOT found. Found segment IDs: ${foundSegmentIds.join(', ')}`
        );
        console.log('    Segment names in activity:');
        [
          ...new Set(
            fullActivity.segment_efforts.map((e) => e.segment.name)
          )
        ].forEach((name) => {
          console.log(`      - '${name}'`);
        });
      } else {
        console.log(
          `  ✓ Found ${matchingEfforts.length} matching segment efforts for target segment ${targetSegmentId}`
        );
      }

      // Check if this activity qualifies
      if (matchingEfforts.length < requiredLaps) {
        console.log(
          `  ✗ Insufficient repetitions: found ${matchingEfforts.length}, need ${requiredLaps}`
        );
        continue;
      }

      // Calculate total time for the fastest requiredLaps efforts
      const sortedEfforts = matchingEfforts
        .sort((a, b) => a.elapsed_time - b.elapsed_time)
        .slice(0, requiredLaps);

      const totalTime = sortedEfforts.reduce(
        (sum, e) => sum + e.elapsed_time,
        0
      );
      const totalTimeFormatted = Math.round(totalTime / 60); // in minutes

      console.log(
        `  ✓ Qualifying activity: ${requiredLaps} efforts, total time: ${totalTimeFormatted} min (${totalTime}s)`
      );

      // Keep track of best activity
      if (totalTime < bestTime) {
        console.log(
          `  ★ New best activity! (previous best: ${bestTime === Infinity ? 'none' : Math.round(bestTime / 60) + ' min'})`
        );
        bestTime = totalTime;
        bestActivity = {
          id: fullActivity.id,
          name: fullActivity.name,
          start_date: fullActivity.start_date as string,
          totalTime: totalTime,
          segmentEfforts: sortedEfforts as unknown as SegmentEffortResponse[],
          activity_url: `https://www.strava.com/activities/${fullActivity.id}`,
          device_name: (fullActivity.device_name as string | undefined) || null
        };
      } else {
        console.log(
          `  → Not better than current best (${Math.round(bestTime / 60)} min)`
        );
      }
    } catch (error) {
      // Log but continue to next activity
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ Error processing activity ${activity.id}:`, message);
      continue;
    }
  }

  if (bestActivity) {
    console.log(
      `[Activity Matching] ★ Selected best activity: ID=${bestActivity.id}, Name='${bestActivity.name}', Time=${Math.round(bestActivity.totalTime / 60)}min, Device='${bestActivity.device_name || 'unknown'}'`
    );
  } else {
    console.log('[Activity Matching] ✗ No qualifying activities found');
  }

  return bestActivity;
}

export {
  findBestQualifyingActivity,
  type Week,
  type SegmentEffortResponse,
  type ActivityResponse,
  type BestActivity
};
