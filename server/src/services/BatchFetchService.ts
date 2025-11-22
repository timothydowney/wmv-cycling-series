/**
 * BatchFetchService.ts
 * Handles batch fetching of activities for a week
 */

import { Database } from 'better-sqlite3';
import * as stravaClient from '../stravaClient';
import { findBestQualifyingActivity } from '../activityProcessor';
import { storeActivityAndEfforts } from '../activityStorage';
import { LogLevel, LoggerCallback, StructuredLogger } from '../types/Logger';

interface FetchResult {
  participant_id: number;
  participant_name: string;
  activity_found: boolean;
  activity_id?: number;
  total_time?: number;
  segment_efforts?: number;
  reason?: string;
}

interface FetchWeekResultsResponse {
  message: string;
  week_id: number;
  week_name: string;
  participants_processed: number;
  results_found: number;
  summary: FetchResult[];
}

class BatchFetchService {
  constructor(
    private db: Database,
    private getValidAccessToken: (
      db: Database,
      athleteId: number
    ) => Promise<string>
  ) {}

  /**
   * Fetch and store results for a week
   * Optional onLog callback for streaming progress updates
   */
  async fetchWeekResults(weekId: number, onLog?: LoggerCallback): Promise<FetchWeekResultsResponse> {
    const logger = new StructuredLogger('BatchFetch', onLog);

    // ===== FETCH WEEK DETAILS =====
    const week = this.db.prepare(
      `SELECT 
        w.id, w.week_name, w.season_id, w.strava_segment_id, w.required_laps, w.start_at, w.end_at,
        s.name as segment_name
      FROM week w
      LEFT JOIN segment s ON w.strava_segment_id = s.strava_segment_id
      WHERE w.id = ?`
    ).get(weekId) as any;

    if (!week) {
      logger.error(`Week ${weekId} not found`);
      throw new Error(`Week ${weekId} not found`);
    }

    // ===== WEEK TIME CONTEXT =====
    logger.section(`Starting fetch for ${week.week_name}`);
    logger.info(`Looking for: ${week.segment_name}`);
    logger.info(`Need: ${week.required_laps} ${week.required_laps === 1 ? 'lap' : 'laps'}`);

    // Use Unix times directly (no conversion needed)
    const startUnix = week.start_at;
    const endUnix = week.end_at;

    // Get all connected participants (those with valid tokens)
    const participants = this.db
      .prepare(
        `SELECT p.strava_athlete_id, p.name, pt.access_token
         FROM participant p
         JOIN participant_token pt ON p.strava_athlete_id = pt.strava_athlete_id
         WHERE pt.access_token IS NOT NULL`
      )
      .all() as Array<{ strava_athlete_id: number; name: string; access_token: string }>;

    if (participants.length === 0) {
      logger.info('No participants connected');
      return {
        message: 'No participants connected',
        week_id: weekId,
        week_name: week.week_name,
        participants_processed: 0,
        results_found: 0,
        summary: []
      };
    }

    logger.info(`Checking results from ${participants.length} ${participants.length === 1 ? 'person' : 'people'}...`);

    const results: FetchResult[] = [];

    // Process each participant
    for (const participant of participants) {
      try {
        logger.section(`Checking ${participant.name}...`);

        // Get valid token (auto-refreshes if needed)
        const accessToken = await this.getValidAccessToken(this.db, participant.strava_athlete_id);

        // Fetch activities using Unix timestamps (already UTC)
        const activities = await stravaClient.listAthleteActivities(accessToken, startUnix, endUnix, {
          includeAllEfforts: true
        });

        if (activities.length === 0) {
          logger.info('No activities found on that day', participant.name);
        } else {
          logger.info(`Found ${activities.length} ${activities.length === 1 ? 'activity' : 'activities'} on that day`, participant.name);
        }

        // Find best qualifying activity
        const bestActivity = await findBestQualifyingActivity(
          activities as any,
          week.strava_segment_id,
          week.required_laps,
          accessToken,
          week,
          (level, message, participant, effortLinks) => {
            switch (level) {
            case LogLevel.Info:
              logger.info(message, participant, effortLinks);
              break;
            case LogLevel.Success:
              logger.success(message, participant, effortLinks);
              break;
            case LogLevel.Error:
              logger.error(message, participant, effortLinks);
              break;
            case LogLevel.Section:
              logger.section(message);
              break;
            }
          }
        );

        if (bestActivity) {
          const minutes = Math.floor(bestActivity.totalTime / 60);
          const seconds = bestActivity.totalTime % 60;
          const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          // Note: PR detection is handled per segment effort, not at activity level
          
          // Build lap info string
          let lapInfo = '';
          if (bestActivity.selectedLapIndices && bestActivity.selectedLapIndices.length > 0) {
            const totalLaps = bestActivity.segmentEfforts.length;
            const selectedLaps = bestActivity.selectedLapIndices.map(idx => idx + 1).join(', ');
            if (totalLaps > bestActivity.selectedLapIndices.length) {
              lapInfo = ` (laps ${selectedLaps} of ${totalLaps})`;
            }
          }
          
          logger.success(
            `✓ Matched! ${timeStr}${lapInfo}`,
            participant.name
          );

          // Store activity and efforts
          storeActivityAndEfforts(
            this.db,
            participant.strava_athlete_id,
            weekId,
            {
              id: bestActivity.id,
              start_date: bestActivity.start_date,
              device_name: bestActivity.device_name || undefined,
              segmentEfforts: bestActivity.segmentEfforts as any,
              totalTime: bestActivity.totalTime
            },
            week.strava_segment_id
          );

          results.push({
            participant_id: participant.strava_athlete_id,
            participant_name: participant.name,
            activity_found: true,
            activity_id: bestActivity.id,
            total_time: bestActivity.totalTime,
            segment_efforts: bestActivity.segmentEfforts.length
          });
        } else {
          logger.info(`✗ No qualifying activities found for ${participant.name}`);
          results.push({
            participant_id: participant.strava_athlete_id,
            participant_name: participant.name,
            activity_found: false,
            reason: 'No qualifying activities on event day'
          });
        }
      } catch (error) {
        // Better error logging for diagnostics
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Error processing ${participant.name}: ${errorMsg}`);
        if (error instanceof Error && error.stack) {
          logger.error(`Stack trace: ${error.stack}`);
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

    logger.success(
      `Fetch results complete for week ${weekId}: ${results.filter((r) => r.activity_found).length}/${
        participants.length
      } activities found`
    );

    return {
      message: 'Results fetched successfully',
      week_id: weekId,
      week_name: week.week_name,
      participants_processed: participants.length,
      results_found: results.filter((r) => r.activity_found).length,
      summary: results
    };
  }
}

export default BatchFetchService;
