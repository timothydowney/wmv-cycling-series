/**
 * Request DTO Types
 *
 * Type definitions for HTTP request bodies.
 * Used to validate and type incoming requests with compile-time safety.
 *
 * Pattern: For each endpoint that accepts a request body, define a corresponding request type
 * Usage in routes:
 *   const body = req.body as CreateWeekRequest;
 *   this.weekService.createWeek(body);
 */

/**
 * Week Creation Request
 * POST /admin/weeks
 */
export interface CreateWeekRequest {
  season_id: number;
  week_name: string;
  segment_id: number;
  required_laps?: number;
  start_at?: number;
  end_at?: number;
  notes?: string;
}

/**
 * Week Update Request
 * PUT /admin/weeks/:id
 */
export interface UpdateWeekRequest {
  week_name?: string;
  segment_id?: number;
  required_laps?: number;
  start_at?: number;
  end_at?: number;
  start_time?: string; // ISO string for convenience in UI
  end_time?: string; // ISO string for convenience in UI
  notes?: string;
}

/**
 * Segment Creation Request
 * POST /admin/segments
 */
export interface CreateSegmentRequest {
  name: string;
  strava_segment_id: number;
  distance?: number;
  average_grade?: number;
  city?: string;
  state?: string;
  country?: string;
}

/**
 * Season Creation Request
 * POST /admin/seasons
 */
export interface CreateSeasonRequest {
  name: string;
  start_at: number;
  end_at: number;
  is_active?: boolean;
}

/**
 * Season Update Request
 * PUT /admin/seasons/:id
 */
export interface UpdateSeasonRequest {
  name?: string;
  start_at?: number;
  end_at?: number;
  is_active?: boolean;
}
