/**
 * BatchFetchService.ts
 * Handles batch fetching of activities for a week
 */

import { Database } from 'better-sqlite3';
import * as stravaClient from '../stravaClient';
import { unixToISO } from '../dateUtils';
import { findBestQualifyingActivity } from '../activityProcessor';
import { storeActivityAndEfforts } from '../activityStorage';

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
   */
  async fetchWeekResults(weekId: number): Promise<FetchWeekResultsResponse> {
    // Get week details including segment info
    const week = this.db
      .prepare(
        `SELECT w.*, s.strava_segment_id, s.name as segment_name
         FROM week w
         JOIN segment s ON w.strava_segment_id = s.strava_segment_id
         WHERE w.id = ?`
      )
      .get(weekId) as any;

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
    console.log(
      `[Batch Fetch] Window duration: ${week.end_at - week.start_at} seconds (${
        (week.end_at - week.start_at) / 3600
      } hours)`
    );
    console.log('[Batch Fetch] ========== END WEEK CONTEXT ==========\n');

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
      return {
        message: 'No participants connected',
        week_id: weekId,
        week_name: week.week_name,
        participants_processed: 0,
        results_found: 0,
        summary: []
      };
    }

    const results: FetchResult[] = [];

    // Process each participant
    for (const participant of participants) {
      try {
        console.log(
          `\n[Batch Fetch] Processing ${participant.name} (Strava ID: ${participant.strava_athlete_id})`
        );

        // Get valid token (auto-refreshes if needed)
        const accessToken = await this.getValidAccessToken(this.db, participant.strava_athlete_id);

        // Fetch activities using Unix timestamps (already UTC)
        const activities = await stravaClient.listAthleteActivities(accessToken, startUnix, endUnix, {
          includeAllEfforts: true
        });

        console.log(`[Batch Fetch] Found ${activities.length} total activities within time window`);
        if (activities.length > 0) {
          console.log(`[Batch Fetch] Activities for ${participant.name}:`);
          for (const act of activities) {
            console.log(`  - ID: ${act.id}`);
          }
        }

        // Find best qualifying activity
        console.log(
          `[Batch Fetch] Searching for segment ${week.strava_segment_id} (${week.segment_name}), require ${week.required_laps} lap(s)`
        );
        const bestActivity = await findBestQualifyingActivity(
          activities as any,
          week.strava_segment_id,
          week.required_laps,
          accessToken,
          week
        );

        if (bestActivity) {
          console.log(
            `[Batch Fetch] ✓ SUCCESS for ${participant.name}: Activity '${bestActivity.name}' (ID: ${bestActivity.id}, Time: ${Math.round(
              bestActivity.totalTime / 60
            )}min, Device: '${bestActivity.device_name || 'unknown'}')`
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
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Error processing ${participant.name}:`, errorMsg);
        if (error instanceof Error && error.stack) {
          console.error('Stack trace:', error.stack);
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

    console.log(
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
