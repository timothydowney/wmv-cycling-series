/**
 * SegmentService.ts
 * Handles segment metadata fetching and storage
 * DRY consolidation of segment metadata operations used across routes
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { getSegment, mapStravaSegmentToSegmentRow } from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';
import { Segment } from '../db/schema'; // Import Drizzle Segment type
import { segment, participantToken } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

interface LogCallback {
  (level: string, message: string): void;
}

class SegmentService {
  constructor(private db: BetterSQLite3Database) {}

  /**
   * Fetch segment metadata from Strava API and store in database
   * Handles token retrieval, API call, and storage atomically
   * Used by: week creation, fetch-results, segment validation
   */
  async fetchAndStoreSegmentMetadata(
    segmentId: string,
    context: string, // e.g., "week-create", "fetch-results", "validation"
    logCallback?: LogCallback,
    preferredAthleteId?: string // Optional: Try this athlete first
  ): Promise<Segment | null> {
    const log = logCallback ? (level: string, msg: string) => logCallback(level, msg) : () => {};

    try {
      let tokenRecord;

      // Try preferred athlete first
      if (preferredAthleteId) {
        tokenRecord = this.db
          .select({ strava_athlete_id: participantToken.strava_athlete_id })
          .from(participantToken)
          .where(eq(participantToken.strava_athlete_id, preferredAthleteId))
          .get();
      }

      // Fallback to any connected participant if preferred not found
      if (!tokenRecord) {
        tokenRecord = this.db
          .select({ strava_athlete_id: participantToken.strava_athlete_id })
          .from(participantToken)
          .limit(1)
          .get();
      }

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
      
      // Use canonical token manager with Drizzle DB
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
  private storeSegmentMetadata(segmentId: string, data: any): void {
    this.db
      .insert(segment)
      .values({
        strava_segment_id: segmentId,
        name: data.name,
        distance: data.distance,
        total_elevation_gain: data.total_elevation_gain,
        average_grade: data.average_grade,
        climb_category: data.climb_category,
        city: data.city,
        state: data.state,
        country: data.country
      })
      .onConflictDoUpdate({
        target: segment.strava_segment_id,
        set: {
          name: data.name,
          distance: data.distance,
          total_elevation_gain: data.total_elevation_gain,
          average_grade: data.average_grade,
          climb_category: data.climb_category,
          city: data.city,
          state: data.state,
          country: data.country
        }
      })
      .run();
  }

  /**
   * Ensure segment exists in database as placeholder (name only)
   * Used when metadata fetch fails but FK constraint requires the row
   */
  private createPlaceholderSegment(segmentId: string): Segment | null {
    const existing = this.db
      .select({ strava_segment_id: segment.strava_segment_id })
      .from(segment)
      .where(eq(segment.strava_segment_id, segmentId))
      .get();
      
    if (!existing) {
      this.db
        .insert(segment)
        .values({
          strava_segment_id: segmentId,
          name: `Segment ${segmentId}`
        })
        .run();
    }
    return this.getStoredSegment(segmentId);
  }

  /**
   * Retrieve stored segment from database
   */
  private getStoredSegment(segmentId: string): Segment | null {
    const result = this.db
      .select()
      .from(segment)
      .where(eq(segment.strava_segment_id, segmentId))
      .get();
      
    return result || null;
  }

  /**
   * Check if segment exists in database
   */
  segmentExists(segmentId: string): boolean {
    const result = this.db
      .select({ strava_segment_id: segment.strava_segment_id })
      .from(segment)
      .where(eq(segment.strava_segment_id, segmentId))
      .get();
      
    return !!result;
  }

  /**
   * Create or update a segment manually
   */
  createSegment(data: {
    strava_segment_id: string;
    name: string;
    distance?: number;
    total_elevation_gain?: number;
    average_grade?: number;
    climb_category?: number | null;
    city?: string;
    state?: string;
    country?: string;
  }): Segment {
    this.storeSegmentMetadata(data.strava_segment_id, data);
    const stored = this.getStoredSegment(data.strava_segment_id);
    if (!stored) throw new Error('Failed to create segment');
    return stored;
  }

  /**
   * Get all segments
   */
  getAllSegments(): Segment[] {
    return this.db.select().from(segment).orderBy(asc(segment.name)).all();
  }
}

export { SegmentService };
export type { LogCallback };