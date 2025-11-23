/**
 * Database Row Types
 *
 * Type-safe definitions for all database table rows.
 * Used throughout services and routes to replace `as any` patterns.
 *
 * These types match the schema defined in schema.ts and are used for:
 * - Typed query results from better-sqlite3
 * - Function parameter validation
 * - Return type safety
 *
 * Pattern: For each table, define both the Row type and optional Insert/Update types
 */

/**
 * Participant row from database
 * Represents a user who has connected their Strava account
 */
export interface ParticipantRow {
  strava_athlete_id: number;
  name: string;
  created_at: string; // ISO 8601 timestamp
}

/**
 * Segment row from database
 * Represents a Strava segment that can be used in competitions
 */
export interface SegmentRow {
  strava_segment_id: number;
  name: string;
  distance?: number | null; // meters
  average_grade?: number | null; // percentage
  total_elevation_gain?: number | null; // meters
  climb_category?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  created_at: string; // ISO 8601 timestamp
}

/**
 * Season row from database
 * Represents a season (e.g., "Fall 2025 MTB Series")
 */
export interface SeasonRow {
  id: number;
  name: string;
  start_at: number; // Unix seconds (UTC)
  end_at: number; // Unix seconds (UTC)
  is_active: number; // SQLite boolean (0 or 1)
  created_at: string; // ISO 8601 timestamp
}

/**
 * Week row from database
 * Represents a single competition week
 */
export interface WeekRow {
  id: number;
  season_id: number;
  week_name: string;
  strava_segment_id: number;
  required_laps: number;
  start_at: number; // Unix seconds (UTC)
  end_at: number; // Unix seconds (UTC)
  notes: string | null; // Markdown notes
  created_at: string; // ISO 8601 timestamp
}

/**
 * Activity row from database
 * Represents a Strava activity that a participant submitted for a week
 */
export interface ActivityRow {
  id: number;
  week_id: number;
  strava_athlete_id: number;
  strava_activity_id: number;
  start_at: number; // Unix seconds (UTC)
  device_name: string | null;
  validation_status: 'valid' | 'invalid' | 'pending';
  validation_message: string | null;
  validated_at: string; // ISO 8601 timestamp
  created_at: string; // ISO 8601 timestamp
}

/**
 * Segment effort row from database
 * Represents a single completion of a segment (one "lap")
 */
export interface SegmentEffortRow {
  id: number;
  activity_id: number;
  strava_segment_id: number;
  strava_effort_id: string | null;
  effort_index: number; // 0-based index of which lap this is
  elapsed_seconds: number;
  start_at: number; // Unix seconds (UTC)
  pr_achieved: number; // SQLite boolean (0 or 1)
}

/**
 * Result row from database
 * Represents a participant's result for a week (automatically calculated)
 */
export interface ResultRow {
  id: number;
  week_id: number;
  strava_athlete_id: number;
  activity_id: number | null;
  total_time_seconds: number;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Participant token row from database
 * Stores OAuth tokens for a participant
 */
export interface ParticipantTokenRow {
  strava_athlete_id: number;
  access_token: string; // Encrypted at rest
  refresh_token: string; // Encrypted at rest
  expires_at: number; // Unix seconds (UTC)
  scope: string | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Deletion request row from database
 * Tracks data deletion requests from participants
 */
export interface DeletionRequestRow {
  id: number;
  strava_athlete_id: number;
  requested_at: string; // ISO 8601 timestamp
  status: 'pending' | 'completed' | 'failed';
  completed_at: string | null; // ISO 8601 timestamp
}

/**
 * Webhook event row from database
 * Logs webhook events from Strava for debugging and monitoring
 */
export interface WebhookEventRow {
  id: number;
  subscription_id: number | null;
  aspect_type: string;
  object_type: string;
  object_id: number;
  owner_id: number;
  processed: number; // SQLite boolean (0 or 1)
  processed_at: string | null; // ISO 8601 timestamp
  error_message: string | null;
  created_at: string; // ISO 8601 timestamp
}

/**
 * Count result from COUNT(*) query
 * Used for admin dashboard statistics
 */
export interface CountRow {
  count: number;
}

/**
 * Session row (from better-sqlite3-session-store)
 * Stores Express session data
 */
export interface SessionRow {
  sid: string;
  sess: string; // JSON-serialized session object
  expiresAt: number; // Unix milliseconds
}

/**
 * Helper type: Extract the insert/update fields from a row type
 * Used for parameterized queries
 */
export type InsertParticipant = Omit<ParticipantRow, 'created_at'>;
export type InsertSegment = Omit<SegmentRow, 'created_at'>;
export type InsertSeason = Omit<SeasonRow, 'id' | 'created_at'>;
export type InsertWeek = Omit<WeekRow, 'id' | 'created_at'>;
export type InsertActivity = Omit<ActivityRow, 'id' | 'created_at' | 'validated_at'>;
export type InsertSegmentEffort = Omit<SegmentEffortRow, 'id'>;
export type InsertResult = Omit<ResultRow, 'id' | 'created_at' | 'updated_at'>;
export type InsertParticipantToken = Omit<ParticipantTokenRow, 'created_at' | 'updated_at'>;
export type InsertDeletionRequest = Omit<DeletionRequestRow, 'id'>;
export type InsertWebhookEvent = Omit<WebhookEventRow, 'id' | 'created_at'>;

/**
 * Union type for all database rows
 * Useful for generic logging or serialization
 */
export type AnyDatabaseRow =
  | ParticipantRow
  | SegmentRow
  | SeasonRow
  | WeekRow
  | ActivityRow
  | SegmentEffortRow
  | ResultRow
  | ParticipantTokenRow
  | DeletionRequestRow
  | WebhookEventRow;

/**
 * Type guard functions for runtime validation
 */

export function isParticipantRow(row: unknown): row is ParticipantRow {
  const obj = row as Record<string, unknown>;
  return (
    typeof obj?.strava_athlete_id === 'number' &&
    typeof obj?.name === 'string' &&
    typeof obj?.created_at === 'string'
  );
}

export function isSegmentRow(row: unknown): row is SegmentRow {
  const obj = row as Record<string, unknown>;
  return (
    typeof obj?.strava_segment_id === 'number' &&
    typeof obj?.name === 'string' &&
    typeof obj?.created_at === 'string'
  );
}

export function isSeasonRow(row: unknown): row is SeasonRow {
  const obj = row as Record<string, unknown>;
  return (
    typeof obj?.id === 'number' &&
    typeof obj?.name === 'string' &&
    typeof obj?.start_at === 'number' &&
    typeof obj?.end_at === 'number' &&
    typeof obj?.is_active === 'number' &&
    typeof obj?.created_at === 'string'
  );
}

export function isWeekRow(row: unknown): row is WeekRow {
  const obj = row as Record<string, unknown>;
  return (
    typeof obj?.id === 'number' &&
    typeof obj?.season_id === 'number' &&
    typeof obj?.week_name === 'string' &&
    typeof obj?.strava_segment_id === 'number' &&
    typeof obj?.required_laps === 'number' &&
    typeof obj?.start_at === 'number' &&
    typeof obj?.end_at === 'number' &&
    typeof obj?.created_at === 'string'
  );
}

export function isActivityRow(row: unknown): row is ActivityRow {
  const obj = row as Record<string, unknown>;
  const validStatuses = ['valid', 'invalid', 'pending'];
  return (
    typeof obj?.id === 'number' &&
    typeof obj?.week_id === 'number' &&
    typeof obj?.strava_athlete_id === 'number' &&
    typeof obj?.strava_activity_id === 'number' &&
    typeof obj?.start_at === 'number' &&
    typeof obj?.validation_status === 'string' &&
    validStatuses.includes(obj.validation_status as string) &&
    typeof obj?.created_at === 'string'
  );
}

export function isSegmentEffortRow(row: unknown): row is SegmentEffortRow {
  const obj = row as Record<string, unknown>;
  return (
    typeof obj?.id === 'number' &&
    typeof obj?.activity_id === 'number' &&
    typeof obj?.strava_segment_id === 'number' &&
    (typeof obj?.strava_effort_id === 'string' || obj?.strava_effort_id === null) &&
    typeof obj?.effort_index === 'number' &&
    typeof obj?.elapsed_seconds === 'number' &&
    typeof obj?.start_at === 'number' &&
    typeof obj?.pr_achieved === 'number'
  );
}

export function isResultRow(row: unknown): row is ResultRow {
  const obj = row as Record<string, unknown>;
  return (
    typeof obj?.id === 'number' &&
    typeof obj?.week_id === 'number' &&
    typeof obj?.strava_athlete_id === 'number' &&
    typeof obj?.total_time_seconds === 'number' &&
    typeof obj?.created_at === 'string' &&
    typeof obj?.updated_at === 'string'
  );
}

export function isCountRow(row: unknown): row is CountRow {
  const obj = row as Record<string, unknown>;
  return typeof obj?.count === 'number';
}
