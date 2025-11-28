/**
 * SegmentService.ts
 * Handles segment metadata fetching and storage
 * DRY consolidation of segment metadata operations used across routes
 */

import { Database } from 'better-sqlite3';
import { getSegment, mapStravaSegmentToSegmentRow } from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';
import type { SegmentRow } from '../types/database';

interface LogCallback {
  (level: string, message: string): void;
}

class SegmentService {
  constructor(private db: Database) {}

  /**
   * Fetch segment metadata from Strava API and store in database
   * Handles token retrieval, API call, and storage atomically
   * Used by: week creation, fetch-results, segment validation
   */
  async fetchAndStoreSegmentMetadata(
    segmentId: number,
    context: string, // e.g., "week-create", "fetch-results", "validation"
    logCallback?: LogCallback
  ): Promise<SegmentRow | null> {
    const log = logCallback ? (level: string, msg: string) => logCallback(level, msg) : () => {};

    try {
      // Get an access token from any connected participant
      const tokenRecord = this.db
        .prepare('SELECT strava_athlete_id FROM participant_token LIMIT 1')
        .get() as { strava_athlete_id: number } | undefined;

      if (!tokenRecord) {
        console.log(`[${context}] No connected participants, creating placeholder segment`);
        return this.createPlaceholderSegment(segmentId);
      }

      // Get valid access token (auto-refreshes if needed)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const strava = require('strava-v3');
      const stravaClient = {
        refreshAccessToken: async (rt: string) => {
          return strava.oauth.refreshToken(rt);
        }
      };
      const accessToken = await getValidAccessToken(this.db, stravaClient, tokenRecord.strava_athlete_id);

      // Fetch segment metadata from Strava
      console.log(`[${context}] Fetching segment ${segmentId} from Strava API`);
      const stravaSegment = await getSegment(segmentId, accessToken);
      const segmentData = mapStravaSegmentToSegmentRow(stravaSegment);

      // Log what we're storing (technical log, console only)
      console.log(`[${context}] Segment data from Strava:
  Name: ${segmentData.name}
  Distance: ${segmentData.distance}m
  Elevation: ${segmentData.total_elevation_gain}m
  Grade: ${segmentData.average_grade}%
  Climb Category: ${segmentData.climb_category}
  Location: ${segmentData.city || '?'}, ${segmentData.state || '?'}, ${segmentData.country || '?'}`);

      // Store in database
      this.storeSegmentMetadata(segmentId, segmentData);
      
      // User-facing success message (no technical context prefix)
      log('success', `✓ Segment metadata updated: ${segmentData.name} (${segmentData.distance}m, ${segmentData.total_elevation_gain}m elev, ${segmentData.average_grade}%)`);

      return this.getStoredSegment(segmentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[${context}] Failed to fetch segment metadata: ${message}`);
      // User-facing error message (no technical context prefix)
      log('error', `Could not update segment metadata: ${message}`);
      // Non-fatal: create placeholder to satisfy FK constraint
      return this.createPlaceholderSegment(segmentId);
    }
  }

  /**
   * Store segment metadata in database
   * INSERT OR REPLACE ensures idempotency
   */
  private storeSegmentMetadata(segmentId: number, data: any): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO segment 
        (strava_segment_id, name, distance, total_elevation_gain, average_grade, climb_category, city, state, country)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        segmentId,
        data.name,
        data.distance,
        data.total_elevation_gain,
        data.average_grade,
        data.climb_category,
        data.city,
        data.state,
        data.country
      );
  }

  /**
   * Ensure segment exists in database as placeholder (name only)
   * Used when metadata fetch fails but FK constraint requires the row
   */
  private createPlaceholderSegment(segmentId: number): SegmentRow | null {
    const existing = this.db.prepare('SELECT 1 FROM segment WHERE strava_segment_id = ?').get(segmentId);
    if (!existing) {
      this.db
        .prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)')
        .run(segmentId, `Segment ${segmentId}`);
    }
    return this.getStoredSegment(segmentId);
  }

  /**
   * Retrieve stored segment from database
   */
  private getStoredSegment(segmentId: number): SegmentRow | null {
    return (
      this.db.prepare('SELECT * FROM segment WHERE strava_segment_id = ?').get(segmentId) as SegmentRow | null
    );
  }

  /**
   * Check if segment exists in database
   */
  segmentExists(segmentId: number): boolean {
    return !!this.db.prepare('SELECT 1 FROM segment WHERE strava_segment_id = ?').get(segmentId);
  }

  /**
   * Get all segments
   */
  getAllSegments(): SegmentRow[] {
    return this.db.prepare('SELECT * FROM segment ORDER BY name ASC').all() as SegmentRow[];
  }
}

export { SegmentService, type LogCallback };
export type { SegmentRow } from '../types/database';
