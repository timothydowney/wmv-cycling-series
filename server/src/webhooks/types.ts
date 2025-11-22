/**
 * Webhook Type Definitions
 *
 * Type-safe interfaces for webhook events from Strava
 */

export interface WebhookEvent {
  aspect_type: 'create' | 'update' | 'delete';
  event_time: number;
  object_id: number;
  object_type: 'activity' | 'athlete';
  owner_id: number;
  subscription_id: number;
  updates?: Record<string, any>;
}

export interface ActivityWebhookEvent extends WebhookEvent {
  object_type: 'activity';
}

export interface AthleteWebhookEvent extends WebhookEvent {
  object_type: 'athlete';
  updates?: {
    authorized?: boolean;
    [key: string]: any;
  };
}

/**
 * Strava Activity details (minimal subset we care about)
 */
export interface StravaActivity {
  id: number;
  name: string;
  start_date: string;
  type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  elevation_gain: number;
  segment_efforts: SegmentEffort[];
}

export interface SegmentEffort {
  id: number;
  elapsed_time: number;
  moving_time: number;
  start_index: number;
  end_index: number;
  pr_achieved: boolean;
  segment: {
    id: number;
    name: string;
    distance: number;
    average_grade: number;
  };
}

/**
 * Result of webhook processing
 */
export interface WebhookProcessResult {
  success: boolean;
  message: string;
  objectId: number;
  error?: Error;
}
