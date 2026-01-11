/**
 * BatchFetchService.ts
 * Handles batch fetching of activities for a week
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, isNotNull } from 'drizzle-orm';
import { week, season, segment, participant, participantToken } from '../db/schema';
import * as stravaClient from '../stravaClient';
import { findBestQualifyingActivity } from '../activityProcessor';
import { storeActivityAndEfforts } from '../activityStorage';
import { LogLevel, LoggerCallback, StructuredLogger } from '../types/Logger';
import ActivityValidationService from './ActivityValidationService';

interface FetchResult {
  participant_id: string;
  participant_name: string;
  activity_found: boolean;
  activity_id?: string;
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
  private validationService: ActivityValidationService;

  constructor(
    private db: BetterSQLite3Database,
    private getValidAccessToken: (
      db: BetterSQLite3Database,
      athleteId: string,
      forceRefresh?: boolean
    ) => Promise<string>
  ) {
    this.validationService = new ActivityValidationService(db);
  }

  /**
   * Fetch and store results for a week
   * Optional onLog callback for streaming progress updates
   */
  async fetchWeekResults(weekId: number, onLog?: LoggerCallback): Promise<FetchWeekResultsResponse> {
    const logger = new StructuredLogger('BatchFetch', onLog);

    // ===== FETCH WEEK DETAILS =====
    const weekData = this.db
      .select({
        id: week.id,
        week_name: week.week_name,
        season_id: week.season_id,
        strava_segment_id: week.strava_segment_id,
        required_laps: week.required_laps,
        start_at: week.start_at,
        end_at: week.end_at,
        segment_name: segment.name,
        season_id_alias: season.id,
        season_start_at: season.start_at,
        season_end_at: season.end_at,
        season_is_active: season.is_active,
        season_created_at: season.created_at
      })
      .from(week)
      .leftJoin(segment, eq(week.strava_segment_id, segment.strava_segment_id))
      .leftJoin(season, eq(week.season_id, season.id))
      .where(eq(week.id, weekId))
      .get();

    if (!weekData) {
      logger.error(`Week ${weekId} not found`);
      throw new Error(`Week ${weekId} not found`);
    }

    // ===== SEASON VALIDATION =====
    // Check if the season this week belongs to is still active
    if (weekData.season_id) {
      const seasonObj = {
        id: weekData.season_id,
        name: '', // Not used for validation
        start_at: weekData.season_start_at!,
        end_at: weekData.season_end_at!,
        is_active: weekData.season_is_active,
        created_at: weekData.season_created_at
      };

      const seasonStatus = this.validationService.isSeasonClosed(seasonObj);
      if (seasonStatus.isClosed) {
        logger.error('Season has ended - cannot fetch results');
        logger.error(`Season ended: ${seasonStatus.reason}`);
        return {
          message: 'Season has ended',
          week_id: weekId,
          week_name: weekData.week_name,
          participants_processed: 0,
          results_found: 0,
          summary: [
            {
              participant_id: '0',
              participant_name: 'All',
              activity_found: false,
              reason: `Season has ended (${seasonStatus.reason}). Cannot fetch activities for closed season.`
            }
          ]
        };
      }
    }

    // ===== WEEK TIME CONTEXT =====
    logger.section(`Starting fetch for ${weekData.week_name}`);
    logger.info(`Looking for: ${weekData.segment_name}`);
    logger.info(`Need: ${weekData.required_laps} ${weekData.required_laps === 1 ? 'lap' : 'laps'}`);

    // Use Unix times directly (no conversion needed)
    const startUnix = weekData.start_at;
    const endUnix = weekData.end_at;

    // Get all connected participants (those with valid tokens)
    const participants = this.db
      .select({
        strava_athlete_id: participant.strava_athlete_id,
        name: participant.name,
        access_token: participantToken.access_token
      })
      .from(participant)
      .innerJoin(participantToken, eq(participant.strava_athlete_id, participantToken.strava_athlete_id))
      .where(isNotNull(participantToken.access_token))
      .all();

    if (participants.length === 0) {
      logger.info('No participants connected');
      return {
        message: 'No participants connected',
        week_id: weekId,
        week_name: weekData.week_name,
        participants_processed: 0,
        results_found: 0,
        summary: []
      };
    }

    logger.info(`Checking results from ${participants.length} ${participants.length === 1 ? 'person' : 'people'}...`);

    const results: FetchResult[] = [];

    // Check if event is in the future (before attempting API calls)
    const now = Math.floor(Date.now() / 1000); // Current Unix timestamp
    if (startUnix > now) {
      const futureDate = new Date(startUnix * 1000).toLocaleDateString();
      logger.error(`Event date (${futureDate}) is in the future - cannot fetch activities before the event occurs`);
      return {
        message: 'Event date is in the future',
        week_id: weekId,
        week_name: weekData.week_name,
        participants_processed: 0,
        results_found: 0,
        summary: [
          {
            participant_id: '0',
            participant_name: 'All',
            activity_found: false,
            reason: `Event date (${futureDate}) is in the future - activities cannot be fetched before the event occurs`
          }
        ]
      };
    }

    // Process each participant
    for (const p of participants) {
      try {
        logger.section(`Checking ${p.name}...`);

        // Get valid token (auto-refreshes if needed)
        let accessToken = await this.getValidAccessToken(this.db, p.strava_athlete_id);

        // Fetch activities using Unix timestamps (already UTC)
        let activities;
        try {
          activities = await stravaClient.listAthleteActivities(accessToken, startUnix, endUnix, {
            includeAllEfforts: true
          });
        } catch (error: any) {
          // Check for 401 Unauthorized
          if (error.statusCode === 401 || (error.message && error.message.includes('Authorization Error'))) {
            logger.info(`Got 401 for ${p.name}, attempting force refresh...`);
            try {
              // Force refresh
              accessToken = await this.getValidAccessToken(this.db, p.strava_athlete_id, true);
              // Retry once
              activities = await stravaClient.listAthleteActivities(accessToken, startUnix, endUnix, {
                includeAllEfforts: true
              });
            } catch (retryError: any) {
              // If retry fails, log and SKIP this user
              logger.error(`Failed to refresh/retry for ${p.name}: ${retryError.message}`);
              results.push({
                participant_id: p.strava_athlete_id,
                participant_name: p.name,
                activity_found: false,
                reason: `Authorization failed (401): ${retryError.message}`
              });
              continue; // Skip to next participant
            }
          } else {
            throw error; // Re-throw other errors
          }
        }

        if (activities.length === 0) {
          logger.info('No activities found on that day', p.name);
        } else {
          logger.info(`Found ${activities.length} ${activities.length === 1 ? 'activity' : 'activities'} on that day`, p.name);
        }

        // Find best qualifying activity
        const bestActivity = await findBestQualifyingActivity(
          activities as any,
          weekData.strava_segment_id,
          weekData.required_laps,
          accessToken,
          weekData,
          (level, message, participantName, effortLinks) => {
            switch (level) {
            case LogLevel.Info:
              logger.info(message, participantName, effortLinks);
              break;
            case LogLevel.Success:
              logger.success(message, participantName, effortLinks);
              break;
            case LogLevel.Error:
              logger.error(message, participantName, effortLinks);
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
          
          // Check if any segment effort has a PR (pr_rank === 1 = athlete's absolute fastest ever)
          const hasPR = bestActivity.segmentEfforts.some((effort: any) => effort.pr_rank === 1);
          const prIndicator = hasPR ? ' ⭐ PR' : '';
          
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
            `✓ Matched! ${timeStr}${lapInfo}${prIndicator}`,
            p.name
          );

          // Store activity and efforts using Drizzle
          storeActivityAndEfforts(
            this.db,
            p.strava_athlete_id,
            weekId,
            {
              id: bestActivity.id,
              start_date: bestActivity.start_date,
              device_name: bestActivity.device_name || undefined,
              segmentEfforts: bestActivity.segmentEfforts as any,
              totalTime: bestActivity.totalTime
            },
            weekData.strava_segment_id
          );

          results.push({
            participant_id: p.strava_athlete_id,
            participant_name: p.name,
            activity_found: true,
            activity_id: bestActivity.id,
            total_time: bestActivity.totalTime,
            segment_efforts: bestActivity.segmentEfforts.length
          });
        } else {
          logger.info(`✗ No qualifying activities found for ${p.name}`);
          results.push({
            participant_id: p.strava_athlete_id,
            participant_name: p.name,
            activity_found: false,
            reason: 'No qualifying activities on event day'
          });
        }
      } catch (error) {
        // Better error logging for diagnostics
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Error processing ${p.name}: ${errorMsg}`);
        if (error instanceof Error && error.stack) {
          logger.error(`Stack trace: ${error.stack}`);
        }

        results.push({
          participant_id: p.strava_athlete_id,
          participant_name: p.name,
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
      week_name: weekData.week_name,
      participants_processed: participants.length,
      results_found: results.filter((r) => r.activity_found).length,
      summary: results
    };
  }
}

export default BatchFetchService;