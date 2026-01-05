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

import { 
  type Activity as ActivityResponse, 
  type SegmentEffort as SegmentEffortResponse,
  getActivity
} from './stravaClient';
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
 * Best qualifying activity result
 */
interface BestActivity {
  id: string;
  name: string;
  start_date: string;
  totalTime: number;
  segmentEfforts: SegmentEffortResponse[];
  activity_url: string;
  device_name: string | null;
  selectedLapIndices?: number[]; // 0-based indices of which laps were selected (e.g., [1, 2] means laps 2 and 3)
}

/**
 * Find the best (fastest) consecutive window of segment efforts
 * 
 * @param matchingEfforts - List of segment efforts for the target segment
 * @param requiredLaps - Number of consecutive laps required
 * @returns The best window or null if insufficient efforts
 */
export function findBestConsecutiveWindow(
  matchingEfforts: SegmentEffortResponse[],
  requiredLaps: number
): {
  efforts: SegmentEffortResponse[];
  totalTime: number;
  startIndex: number;
  lapIndices: number[];
} | null {
  if (matchingEfforts.length < requiredLaps) {
    return null;
  }

  if (matchingEfforts.length === requiredLaps) {
    return {
      efforts: matchingEfforts,
      totalTime: matchingEfforts.reduce((sum, e) => sum + e.elapsed_time, 0),
      startIndex: 0,
      lapIndices: Array.from({ length: requiredLaps }, (_, i) => i)
    };
  }

  const windows: Array<{
    startIndex: number;
    efforts: SegmentEffortResponse[];
    totalTime: number;
    lapIndices: number[];
  }> = [];

  for (let i = 0; i <= matchingEfforts.length - requiredLaps; i++) {
    const window = matchingEfforts.slice(i, i + requiredLaps);
    const windowTotalTime = window.reduce((sum, e) => sum + e.elapsed_time, 0);
    const lapIndices = Array.from({ length: requiredLaps }, (_, idx) => i + idx);
    windows.push({
      startIndex: i,
      efforts: window,
      totalTime: windowTotalTime,
      lapIndices
    });
  }

  return windows.reduce((best, current) =>
    current.totalTime < (best?.totalTime ?? Infinity) ? current : best
  );
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
  targetSegmentId: string,
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
    id: string;
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
        id: activity.id.toString(),
        name: activity.name,
        start_date: activity.start_date instanceof Date ? activity.start_date.toISOString() : activity.start_date as string,
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
      const fullActivity = await getActivity(
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
        (effort) => effort.segment?.id !== undefined && String(effort.segment.id) === String(targetSegmentId)
      );

      // Log what segments we found vs what we were looking for
      if (matchingEfforts.length === 0) {
        const foundSegmentIds = [
          ...new Set(
            fullActivity.segment_efforts
              .map((e) => e.segment?.id)
              .filter((id): id is string => id !== undefined)
          )
        ];
        console.log(
          `  ✗ Target segment ${targetSegmentId} NOT found. Found segment IDs: ${foundSegmentIds.join(', ')}`
        );
        console.log('    Segment names in activity:');
        [
          ...new Set(
            fullActivity.segment_efforts
              .map((e) => e.segment?.name)
              .filter((name): name is string => name !== undefined)
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
          const effortLinks = matchingEfforts.map(effort => ({
            effortId: String(effort.id),
            activityId: fullActivity.id
          }));
          matchingEfforts.forEach((effort, idx) => {
            const minutes = Math.floor(effort.elapsed_time / 60);
            const seconds = effort.elapsed_time % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            const links = [effortLinks[idx]];
            onLog(LogLevel.Info, `  Lap ${idx + 1}: ${timeStr}`, undefined, links);
          });
        }
      }

      // Check if this activity qualifies
      const bestWindow = findBestConsecutiveWindow(matchingEfforts, requiredLaps);

      if (!bestWindow) {
        console.log(
          `  ✗ Insufficient repetitions: found ${matchingEfforts.length}, need ${requiredLaps}`
        );
        continue;
      }

      // Log window analysis if there were multiple options
      if (matchingEfforts.length > requiredLaps) {
        console.log(
          `  ℹ Multiple attempts: ${matchingEfforts.length} efforts found, finding best consecutive ${requiredLaps}-lap window`
        );
        if (onLog) {
          onLog(LogLevel.Info, `Multiple laps found (${matchingEfforts.length}), selecting best consecutive ${requiredLaps}-lap window...`);
        }

        // Log all windows for debugging
        for (let i = 0; i <= matchingEfforts.length - requiredLaps; i++) {
          const window = matchingEfforts.slice(i, i + requiredLaps);
          const windowTotalTime = window.reduce((sum, e) => sum + e.elapsed_time, 0);
          const effortTimes = window.map(e => {
            const m = Math.floor(e.elapsed_time / 60);
            const s = e.elapsed_time % 60;
            return `${m}:${s.toString().padStart(2, '0')}`;
          }).join(' + ');
          const totalMinutes = Math.floor(windowTotalTime / 60);
          const totalSeconds = windowTotalTime % 60;
          const totalTimeStr = `${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
          console.log(`      Window ${i + 1}: ${effortTimes} = ${totalTimeStr}`);
          
          if (onLog) {
            const lapNums = Array.from({ length: requiredLaps }, (_, idx) => i + idx + 1).join(', ');
            const effortLinks = window.map(effort => ({
              effortId: String(effort.id),
              activityId: fullActivity.id
            }));
            onLog(LogLevel.Info, `  Window ${i + 1} (laps ${lapNums}): ${effortTimes} = ${totalTimeStr}`, undefined, effortLinks);
          }
        }
      } else {
        console.log(
          `  ℹ Exact match: ${requiredLaps} efforts found, using all of them`
        );
        if (onLog) {
          onLog(LogLevel.Success, `✓ Perfect match: all ${requiredLaps} laps will be used`);
        }
      }

      const selectedEfforts = bestWindow.efforts;
      const selectedTotalTime = bestWindow.totalTime;
      const selectedWindowIndex = bestWindow.startIndex;
      const selectedLapIndices = bestWindow.lapIndices;

      console.log(
        `    ★ Best window: #${selectedWindowIndex + 1} with total time ${Math.round(selectedTotalTime / 60)} min (${selectedTotalTime}s)`
      );
      if (onLog) {
        const bestMinutes = Math.floor(selectedTotalTime / 60);
        const bestSeconds = selectedTotalTime % 60;
        const bestTimeStr = `${bestMinutes}:${bestSeconds.toString().padStart(2, '0')}`;
        const lapNums = selectedLapIndices.map(idx => idx + 1).join(', ');
        onLog(LogLevel.Success, `✓ Matched! ${bestTimeStr} (laps ${lapNums} of ${matchingEfforts.length})`);
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
          id: fullActivity.id.toString(),
          name: fullActivity.name,
          start_date: fullActivity.start_date instanceof Date ? fullActivity.start_date.toISOString() : fullActivity.start_date as string,
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
