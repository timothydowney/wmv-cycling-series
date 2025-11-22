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
import { LogLevel, LoggerCallback } from './types/Logger';

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
  selectedLapIndices?: number[]; // 0-based indices of which laps were selected (e.g., [1, 2] means laps 2 and 3)
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
  week?: Week,
  onLog?: LoggerCallback
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
        // Log individual efforts with their times
        if (onLog) {
          onLog(LogLevel.Info, `Found ${matchingEfforts.length} ${requiredLaps === 1 ? 'effort' : 'efforts'}:`);
          matchingEfforts.forEach((effort, idx) => {
            const minutes = Math.floor(effort.elapsed_time / 60);
            const seconds = effort.elapsed_time % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            onLog(LogLevel.Info, `  Lap ${idx + 1}: ${timeStr}`);
          });
        }
      }

      // Check if this activity qualifies
      if (matchingEfforts.length < requiredLaps) {
        console.log(
          `  ✗ Insufficient repetitions: found ${matchingEfforts.length}, need ${requiredLaps}`
        );
        continue;
      }

      // Find the best consecutive window of requiredLaps efforts
      // When an athlete rides a segment multiple times, we want the fastest
      // consecutive set (their best effort of the day), not scattered efforts
      
      let selectedEfforts: typeof matchingEfforts = [];
      let selectedTotalTime = Infinity;
      let selectedWindowIndex = -1;
      let selectedLapIndices: number[] = []; // Track which lap indices were selected

      if (matchingEfforts.length === requiredLaps) {
        // Exact number of efforts - use them all (they're already in order)
        selectedEfforts = matchingEfforts;
        selectedTotalTime = matchingEfforts.reduce((sum, e) => sum + e.elapsed_time, 0);
        selectedWindowIndex = 0;
        selectedLapIndices = Array.from({ length: requiredLaps }, (_, i) => i); // [0, 1, 2, ...]
        console.log(
          `  ℹ Exact match: ${requiredLaps} efforts found, using all of them`
        );
        if (onLog) {
          onLog(LogLevel.Success, `✓ Perfect match: all ${requiredLaps} laps will be used`);
        }
      } else if (matchingEfforts.length > requiredLaps) {
        // More efforts than required - find the best consecutive window
        console.log(
          `  ℹ Multiple attempts: ${matchingEfforts.length} efforts found, finding best consecutive ${requiredLaps}-lap window`
        );
        if (onLog) {
          onLog(LogLevel.Info, `Multiple laps found (${matchingEfforts.length}), selecting best consecutive ${requiredLaps}-lap window...`);
        }
        
        const windows: Array<{
          index: number;
          efforts: typeof matchingEfforts;
          totalTime: number;
          lapIndices: number[];
        }> = [];

        // Evaluate all possible consecutive windows
        for (let i = 0; i <= matchingEfforts.length - requiredLaps; i++) {
          const window = matchingEfforts.slice(i, i + requiredLaps);
          const windowTotalTime = window.reduce((sum, e) => sum + e.elapsed_time, 0);
          const lapIndices = Array.from({ length: requiredLaps }, (_, idx) => i + idx); // [i, i+1, i+2, ...]
          windows.push({
            index: i,
            efforts: window,
            totalTime: windowTotalTime,
            lapIndices
          });
        }

        // Log all windows for debugging (both console and UI logs)
        console.log(`    Analyzing ${windows.length} possible consecutive windows:`);
        windows.forEach((window) => {
          const effortTimes = window.efforts.map(e => {
            const m = Math.floor(e.elapsed_time / 60);
            const s = e.elapsed_time % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
          }).join(' + ');
          const totalMinutes = Math.floor(window.totalTime / 60);
          const totalSeconds = window.totalTime % 60;
          const totalTimeStr = `${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
          console.log(`      Window ${window.index + 1}: ${effortTimes} = ${totalTimeStr}`);
        });
        
        // Log to UI with window analysis
        if (onLog) {
          onLog(LogLevel.Info, `Analyzing ${windows.length} possible consecutive windows:`);
          windows.forEach((window) => {
            const effortTimes = window.efforts.map(e => {
              const m = Math.floor(e.elapsed_time / 60);
              const s = e.elapsed_time % 60;
              return `${m}:${s.toString().padStart(2, '0')}`;
            }).join(' + ');
            const totalMinutes = Math.floor(window.totalTime / 60);
            const totalSeconds = window.totalTime % 60;
            const totalTimeStr = `${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
            const lapNums = window.lapIndices.map(idx => idx + 1).join(', ');
            onLog(LogLevel.Info, `  Window ${window.index + 1} (laps ${lapNums}): ${effortTimes} = ${totalTimeStr}`);
          });
        }

        // Find the best (fastest) window
        const bestWindow = windows.reduce((best, current) =>
          current.totalTime < best.totalTime ? current : best
        );

        selectedEfforts = bestWindow.efforts;
        selectedTotalTime = bestWindow.totalTime;
        selectedWindowIndex = bestWindow.index;
        selectedLapIndices = bestWindow.lapIndices;

        console.log(
          `    ★ Best window: #${selectedWindowIndex + 1} with total time ${Math.round(selectedTotalTime / 60)} min (${selectedTotalTime}s)`
        );
        if (onLog) {
          const bestMinutes = Math.floor(bestWindow.totalTime / 60);
          const bestSeconds = bestWindow.totalTime % 60;
          const bestTimeStr = `${bestMinutes}:${bestSeconds.toString().padStart(2, '0')}`;
          const lapNums = bestWindow.lapIndices.map(idx => idx + 1).join(', ');
          onLog(LogLevel.Success, `✓ Matched! ${bestTimeStr} (laps ${lapNums} of ${matchingEfforts.length})`);
        }
      }

      const totalTime = selectedTotalTime;
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
          segmentEfforts: selectedEfforts as unknown as SegmentEffortResponse[],
          activity_url: `https://www.strava.com/activities/${fullActivity.id}`,
          device_name: (fullActivity.device_name as string | undefined) || null,
          selectedLapIndices: selectedLapIndices
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
